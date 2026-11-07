-- ==============================================================================
-- SONORA MIGRATION: 20261106_security_and_grants.sql
-- Target: Supabase PostgreSQL
-- Purpose:
--   1. Secure Admin Assignment: Only the first registered account becomes 'admin';
--      subsequent registrations become 'user'. Prevents metadata privilege escalation.
--   2. Role Immutability: Prevents non-admin/client users from modifying their role.
--   3. Least-Privilege Table Grants: Grant minimum PostgreSQL permissions to
--      'authenticated' and 'service_role' while completely revoking access from 'anon'.
--   4. RLS Enforcement: Preserves strict private isolation for all user data.
-- Safe: Zero DROP TABLE, DELETE, or TRUNCATE statements.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SECURE FIRST-USER-ONLY ADMIN TRIGGER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_first_user BOOLEAN;
  assigned_role TEXT;
BEGIN
  -- Check if any profile already exists in the system
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1) INTO is_first_user;

  -- The very first registered user is automatically designated as 'admin' (Owner)
  -- All subsequent registrations strictly receive 'user'
  IF is_first_user THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'user';
  END IF;

  -- Insert profile, ignoring any client-supplied 'role' in raw_user_meta_data
  INSERT INTO public.profiles (id, email, username, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'),
    assigned_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. PREVENT PRIVILEGE ESCALATION ON PROFILES
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  -- If the role is being altered, ensure caller has service_role or admin privilege
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_user != 'service_role' AND COALESCE(auth.role(), '') != 'service_role' THEN
      RAISE EXCEPTION 'Privilege escalation rejected: User role cannot be modified by client.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

-- ------------------------------------------------------------------------------
-- 3. MINIMAL DATABASE TABLE PERMISSIONS (LEAST PRIVILEGE)
-- ------------------------------------------------------------------------------

-- Ensure schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Revoke all table, sequence, and routine privileges from anonymous/unauthenticated users
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

-- Grant service_role full administrative access (used strictly by backend Cloudinary sync & admin API)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Grant authenticated users least-privilege permissions:
-- 3.1. Catalogue (Music catalogue is read-only for clients; uploads/sync happen via backend)
GRANT SELECT ON TABLE public.songs, public.albums, public.artists TO authenticated;

-- 3.2. User Profile (View and update their own profile; guarded by RLS and role protection trigger)
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

-- 3.3. Personal Library (Manage own playlists, favourites, and listening history under RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.playlists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.playlist_songs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.favourites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.listening_history TO authenticated;

-- 3.4. Sequence usage
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. DEFAULT PRIVILEGES (Ensures future tables grant proper backend access)
-- ------------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

