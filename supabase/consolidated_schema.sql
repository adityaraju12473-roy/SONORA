-- ==============================================================================
-- SONORA CONSOLIDATED DATABASE SCHEMA & PRIVATE ROW LEVEL SECURITY (RLS)
-- Environment: Supabase PostgreSQL
-- Architecture: Private, Single-User Music Streaming Application
-- Security Profile: Zero public/anonymous access. Authenticated user & backend only.
-- Safe: Does NOT contain DROP TABLE, DELETE, or TRUNCATE statements.
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. CORE CATALOGUE & USER TABLES
-- ==============================================================================

-- Profiles Table (Linked with Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Artists Table
CREATE TABLE IF NOT EXISTS public.artists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    bio TEXT,
    avatar_url TEXT,
    header_url TEXT,
    genre TEXT,
    monthly_listeners INT DEFAULT 0,
    is_verified BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Albums Table
CREATE TABLE IF NOT EXISTS public.albums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    artist_id UUID REFERENCES public.artists(id) ON DELETE SET NULL,
    artist_name TEXT NOT NULL,
    cover_url TEXT NOT NULL,
    release_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    genre TEXT,
    total_tracks INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Songs Table (with Complete Cloudinary CDN & Audio Ingestion Columns)
CREATE TABLE IF NOT EXISTS public.songs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    artist_id UUID REFERENCES public.artists(id) ON DELETE SET NULL,
    artist_name TEXT NOT NULL,
    album_id UUID REFERENCES public.albums(id) ON DELETE SET NULL,
    album_name TEXT,
    genre TEXT NOT NULL DEFAULT 'Alternative',
    duration INT NOT NULL DEFAULT 0, -- in seconds
    release_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    cover_url TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    cloudinary_public_id TEXT,
    cloudinary_asset_id TEXT,
    cloudinary_format TEXT DEFAULT 'mp3',
    storage_key TEXT,
    file_hash TEXT,
    file_size BIGINT,
    plays_count INT DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    is_trending BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Playlists Table (Default private for single-user isolation)
CREATE TABLE IF NOT EXISTS public.playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Playlist Songs (Ordered mapping of songs to playlists)
CREATE TABLE IF NOT EXISTS public.playlist_songs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID REFERENCES public.playlists(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
    position INT NOT NULL DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(playlist_id, song_id)
);

-- Favourites Table
CREATE TABLE IF NOT EXISTS public.favourites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, song_id)
);

-- Listening History Table
CREATE TABLE IF NOT EXISTS public.listening_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
    played_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- 3. HIGH-SPEED INDEXES & DEDUPLICATION LOOKUPS
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_songs_cloudinary_asset_id ON public.songs(cloudinary_asset_id);
CREATE INDEX IF NOT EXISTS idx_songs_cloudinary_public_id ON public.songs(cloudinary_public_id);
CREATE INDEX IF NOT EXISTS idx_songs_file_hash ON public.songs(file_hash);
CREATE INDEX IF NOT EXISTS idx_songs_artist ON public.songs(artist_id);
CREATE INDEX IF NOT EXISTS idx_songs_album ON public.songs(album_id);
CREATE INDEX IF NOT EXISTS idx_songs_genre ON public.songs(genre);
CREATE INDEX IF NOT EXISTS idx_songs_plays ON public.songs(plays_count DESC);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON public.playlist_songs(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_favourites_user ON public.favourites(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user_played ON public.listening_history(user_id, played_at DESC);

-- ==============================================================================
-- 4. AUTOMATIC PROFILE CREATION TRIGGER (ON USER SIGN-UP)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_first_user BOOLEAN;
  assigned_role TEXT;
BEGIN
  -- Determine whether this is the first registered profile in the database
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1) INTO is_first_user;

  -- The very first user to register receives 'admin' (the application owner)
  -- All subsequent registrations strictly receive 'user'
  IF is_first_user THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'user';
  END IF;

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to prevent unauthorized role escalation
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
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

-- ==============================================================================
-- 5. STRICT PRIVATE ROW LEVEL SECURITY (RLS) POLICIES
-- Zero public access. Authenticated user & backend service role only.
-- ==============================================================================

-- Enable RLS across every table (denies all access by default)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_history ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- PROFILES: Strictly private to the owner. Never exposed publicly or to anon.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- MUSIC CATALOGUE (Songs, Albums, Artists):
-- Read-only for authenticated user. Anonymous/public access is BLOCKED.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Songs are viewable by everyone" ON public.songs;
DROP POLICY IF EXISTS "Authenticated users can view songs" ON public.songs;
CREATE POLICY "Authenticated users can view songs" ON public.songs
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Artists are viewable by everyone" ON public.artists;
DROP POLICY IF EXISTS "Authenticated users can view artists" ON public.artists;
CREATE POLICY "Authenticated users can view artists" ON public.artists
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Albums are viewable by everyone" ON public.albums;
DROP POLICY IF EXISTS "Authenticated users can view albums" ON public.albums;
CREATE POLICY "Authenticated users can view albums" ON public.albums
    FOR SELECT
    TO authenticated
    USING (true);

-- ------------------------------------------------------------------------------
-- PLAYLISTS & PLAYLIST TRACKS:
-- Restricted to the authenticated playlist owner.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Playlists are viewable by everyone" ON public.playlists;
DROP POLICY IF EXISTS "Users can view own playlists" ON public.playlists;
CREATE POLICY "Users can view own playlists" ON public.playlists
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR (is_public = true AND auth.uid() IS NOT NULL));

DROP POLICY IF EXISTS "Users can create own playlists" ON public.playlists;
CREATE POLICY "Users can create own playlists" ON public.playlists
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own playlists" ON public.playlists;
CREATE POLICY "Users can update own playlists" ON public.playlists
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own playlists" ON public.playlists;
CREATE POLICY "Users can delete own playlists" ON public.playlists
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Playlist songs are viewable by everyone" ON public.playlist_songs;
DROP POLICY IF EXISTS "Users can view songs in own playlists" ON public.playlist_songs;
CREATE POLICY "Users can view songs in own playlists" ON public.playlist_songs
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.playlists 
        WHERE id = playlist_songs.playlist_id 
        AND (user_id = auth.uid() OR is_public = true)
      )
    );

DROP POLICY IF EXISTS "Users can manage songs in own playlists" ON public.playlist_songs;
CREATE POLICY "Users can manage songs in own playlists" ON public.playlist_songs
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.playlists 
        WHERE id = playlist_songs.playlist_id 
        AND user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.playlists 
        WHERE id = playlist_songs.playlist_id 
        AND user_id = auth.uid()
      )
    );

-- ------------------------------------------------------------------------------
-- FAVOURITES & LISTENING HISTORY:
-- Strictly private to the individual authenticated user.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own favourites" ON public.favourites;
CREATE POLICY "Users can manage own favourites" ON public.favourites
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own history" ON public.listening_history;
CREATE POLICY "Users can manage own history" ON public.listening_history
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- 6. LEAST-PRIVILEGE POSTGRESQL TABLE & SCHEMA PERMISSIONS (GRANTS)
-- ==============================================================================

-- 6.1. Schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 6.2. Revoke all privileges from anon (zero public access)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

-- 6.3. Service Role (Backend sync, audio ingestion, admin operations)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- 6.4. Authenticated User (Least-privilege catalogue read & personal library CRUD)
GRANT SELECT ON TABLE public.songs, public.albums, public.artists TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.playlists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.playlist_songs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.favourites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.listening_history TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 6.5. Default privileges for future schema objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

