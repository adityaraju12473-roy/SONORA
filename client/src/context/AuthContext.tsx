import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile } from '../types';
import { useToast } from './ToastContext';
import { supabase } from '../config/supabase';

export interface AuthResult {
  success: boolean;
  error?: string;
  requiresEmailConfirmation?: boolean;
}

interface AuthContextType {
  user: Profile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<AuthResult>;
  signup: (email: string, pass: string, username: string, fullName: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authModalView: 'login' | 'signup' | 'forgot';
  setAuthModalView: (view: 'login' | 'signup' | 'forgot') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalView, setAuthModalView] = useState<'login' | 'signup' | 'forgot'>('login');
  const { showToast } = useToast();

  const fetchAndSetProfile = async (authUser: any) => {
    try {
      if (!supabase || !authUser) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!error && profile) {
        setUser(profile as Profile);
      } else {
        const fallbackProfile: Profile = {
          id: authUser.id,
          email: authUser.email || '',
          username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'User',
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.username || 'User',
          avatar_url:
            authUser.user_metadata?.avatar_url ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
          role: 'user',
        };
        setUser(fallbackProfile);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Clean up any legacy demo tokens from previous tests
    localStorage.removeItem('sonora_demo_user');
    const existingToken = localStorage.getItem('sonora_token');
    if (existingToken && existingToken.startsWith('demo_token_')) {
      localStorage.removeItem('sonora_token');
    }

    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;

    // 1. Initial session restoration from Supabase persistent storage
    const restoreSession = async () => {
      try {
        const { data: { session }, error } = await client.auth.getSession();
        if (error) {
          console.warn('Supabase getSession warning:', error.message);
        }

        if (session && mounted) {
          localStorage.setItem('sonora_token', session.access_token);
          await fetchAndSetProfile(session.user);
        } else if (mounted) {
          setUser(null);
          localStorage.removeItem('sonora_token');
        }
      } catch (err) {
        console.error('Session restoration error:', err);
        if (mounted) {
          setUser(null);
          localStorage.removeItem('sonora_token');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    // 2. Listen to live auth events (SIGN_IN, TOKEN_REFRESH, SIGN_OUT)
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session) {
          localStorage.setItem('sonora_token', session.access_token);
          await fetchAndSetProfile(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem('sonora_token');
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string): Promise<AuthResult> => {
    if (!supabase) {
      const err = 'Supabase client is not configured on the client.';
      showToast(err, 'error');
      return { success: false, error: err };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (error) {
        let friendly = error.message;
        if (
          error.message.toLowerCase().includes('email not confirmed') ||
          (error as any).code === 'email_not_confirmed'
        ) {
          friendly =
            'Your email address has not been confirmed yet. Please verify your email before signing in.';
        } else if (
          error.message.toLowerCase().includes('invalid login credentials') ||
          (error as any).code === 'invalid_credentials'
        ) {
          friendly = 'Invalid email address or password. Please verify your credentials and try again.';
        }
        showToast(friendly, 'error');
        return { success: false, error: friendly };
      }

      if (data?.session) {
        localStorage.setItem('sonora_token', data.session.access_token);
        await fetchAndSetProfile(data.user);
        setAuthModalOpen(false);
        showToast(
          `Welcome back, ${data.user.user_metadata?.full_name || data.user.email}!`,
          'success'
        );
        return { success: true };
      }

      const noSessionErr = 'Login succeeded but no active session was returned. Please verify your account.';
      showToast(noSessionErr, 'error');
      return { success: false, error: noSessionErr };
    } catch (err: any) {
      const msg = err.message || 'An unexpected login error occurred.';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const signup = async (
    email: string,
    pass: string,
    username: string,
    fullName: string
  ): Promise<AuthResult> => {
    if (!supabase) {
      const err = 'Supabase client is not configured on the client.';
      showToast(err, 'error');
      return { success: false, error: err };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: {
          data: {
            username: username.trim(),
            full_name: fullName.trim() || username.trim(),
          },
        },
      });

      if (error) {
        showToast(error.message || 'Signup failed', 'error');
        return { success: false, error: error.message };
      }

      if (data.session) {
        localStorage.setItem('sonora_token', data.session.access_token);
        await fetchAndSetProfile(data.user);
        setAuthModalOpen(false);
        showToast('Account created successfully! Welcome to SONORA.', 'success');
        return { success: true };
      } else if (data.user) {
        setAuthModalOpen(false);
        const confirmMsg =
          'Account registered! If email confirmation is enabled, please check your inbox before signing in.';
        showToast(confirmMsg, 'info');
        return { success: true, requiresEmailConfirmation: true, error: confirmMsg };
      }

      return { success: false, error: 'Registration could not be completed.' };
    } catch (err: any) {
      const msg = err.message || 'Signup failed';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem('sonora_token');
    showToast('Signed out of SONORA.', 'info');
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user || !supabase) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
      setUser({ ...user, ...updates });
      showToast('Profile updated successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Profile update failed', 'error');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isAdmin: user?.role === 'admin',
        loading,
        login,
        signup,
        logout,
        updateProfile,
        authModalOpen,
        setAuthModalOpen,
        authModalView,
        setAuthModalView,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
