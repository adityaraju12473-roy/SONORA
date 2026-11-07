import { Request, Response, NextFunction } from 'express';
import { supabaseClient, supabaseAdminClient } from '../config/supabase';
import { ENV } from '../config/env';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role: 'admin' | 'user';
    username?: string;
    full_name?: string;
  };
}

/**
 * Strict Supabase JWT Authentication Middleware
 * Validates cryptographically signed Supabase access tokens.
 * Zero demo fallbacks, zero hardcoded credentials.
 */
export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized: Authentication token is required to access SONORA services',
    });
  }

  const token = authHeader.split(' ')[1]?.trim();
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized: Malformed Authorization header',
    });
  }

  if (!ENV.hasSupabase || !supabaseClient) {
    return res.status(500).json({
      error: 'Authentication failed: Supabase connection is not configured on the server',
    });
  }

  try {
    // 1. Validate JWT with Supabase Auth
    const clientToUse = supabaseAdminClient || supabaseClient;
    const { data: { user }, error: authError } = await clientToUse.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid or expired session token',
      });
    }

    // 2. Resolve user role and profile metadata strictly from the database
    let role: 'admin' | 'user' = 'user';
    let username = user.email?.split('@')[0] || 'User';
    let full_name = username;

    // Query database profile using admin client (never trust client metadata for roles)
    if (supabaseAdminClient) {
      try {
        const { data: profile } = await supabaseAdminClient
          .from('profiles')
          .select('role, username, full_name')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          if (profile.role === 'admin') role = 'admin';
          if (profile.username) username = profile.username;
          if (profile.full_name) full_name = profile.full_name;
        }
      } catch (err) {
        console.warn('Could not query profile table:', err);
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      role,
      username,
      full_name,
    };

    return next();
  } catch (err: any) {
    console.error('Authentication verification exception:', err);
    return res.status(401).json({
      error: 'Unauthorized: Session validation failed',
    });
  }
}

/**
 * Enforces admin authorization for curator studio and upload functions
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden: Admin / Curator privileges are required for this action',
    });
  }

  return next();
}

/**
 * Optional authentication middleware:
 * Populates req.user if a valid token is provided, but does not block requests if unauthenticated.
 */
export async function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split(' ')[1]?.trim();
  if (!token || !ENV.hasSupabase || !supabaseClient) {
    return next();
  }

  try {
    const clientToUse = supabaseAdminClient || supabaseClient;
    const { data: { user }, error: authError } = await clientToUse.auth.getUser(token);
    if (!authError && user) {
      req.user = {
        id: user.id,
        email: user.email,
        role: 'user',
        username: user.email?.split('@')[0] || 'User',
      };
    }
  } catch {
    // Continue anonymously
  }
  return next();
}
