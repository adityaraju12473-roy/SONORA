-- ==============================================================================
-- ADD CLOUDINARY_ASSET_ID AND DEDUPLICATION INDEXES TO SONGS TABLE
-- ==============================================================================

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS cloudinary_asset_id TEXT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS cloudinary_format TEXT DEFAULT 'mp3';
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS file_hash TEXT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Unique and fast lookup indexes for Cloudinary asset deduplication
CREATE INDEX IF NOT EXISTS idx_songs_cloudinary_asset_id ON public.songs(cloudinary_asset_id);
CREATE INDEX IF NOT EXISTS idx_songs_cloudinary_public_id ON public.songs(cloudinary_public_id);

