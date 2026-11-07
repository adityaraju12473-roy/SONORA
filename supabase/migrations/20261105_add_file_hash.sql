-- Add file_hash, file_size, and storage_key columns to songs table for exact deduplication
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS file_hash TEXT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS storage_key TEXT;

CREATE INDEX IF NOT EXISTS idx_songs_file_hash ON public.songs(file_hash);

