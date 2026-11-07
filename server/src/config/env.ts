import path from 'path';
import dotenv from 'dotenv';

// Automatically locate server/.env whether started from root or server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config();

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
  // Cloudflare R2
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || '',
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || '',

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  hasSupabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
  hasR2: Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME),
  hasCloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),

  getMissingCredentials(): { supabase: string[]; r2: string[]; cloudinary: string[] } {
    const supabaseMissing: string[] = [];
    if (!process.env.SUPABASE_URL) supabaseMissing.push('SUPABASE_URL');
    if (!process.env.SUPABASE_ANON_KEY) supabaseMissing.push('SUPABASE_ANON_KEY');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) supabaseMissing.push('SUPABASE_SERVICE_ROLE_KEY');

    const r2Missing: string[] = [];
    if (!process.env.R2_ACCOUNT_ID) r2Missing.push('R2_ACCOUNT_ID');
    if (!process.env.R2_ACCESS_KEY_ID) r2Missing.push('R2_ACCESS_KEY_ID');
    if (!process.env.R2_SECRET_ACCESS_KEY) r2Missing.push('R2_SECRET_ACCESS_KEY');
    if (!process.env.R2_BUCKET_NAME) r2Missing.push('R2_BUCKET_NAME');

    const cloudinaryMissing: string[] = [];
    if (!process.env.CLOUDINARY_CLOUD_NAME) cloudinaryMissing.push('CLOUDINARY_CLOUD_NAME');
    if (!process.env.CLOUDINARY_API_KEY) cloudinaryMissing.push('CLOUDINARY_API_KEY');
    if (!process.env.CLOUDINARY_API_SECRET) cloudinaryMissing.push('CLOUDINARY_API_SECRET');

    return {
      supabase: supabaseMissing,
      r2: r2Missing,
      cloudinary: cloudinaryMissing,
    };
  }
};
