import * as mm from 'music-metadata-browser';

export interface ExtractedTrackMetadata {
  file: File;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number; // in seconds
  releaseYear: number;
  artworkBlob?: Blob;
  artworkUrl?: string;
  fileHash: string; // SHA-256 hexadecimal string
  fileSize: number; // in bytes
  isDuplicate?: boolean;
  duplicateReason?: string;
}

/**
 * Computes the SHA-256 hash of a file using Web Crypto API.
 * Matches standard sha256 checksums exactly.
 */
export async function computeFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Intelligently cleans and parses a filename to extract title and album/artist hints.
 * e.g. "Abhi Mujh Mein Kahin (From 'Agneepath').mp3" -> title: "Abhi Mujh Mein Kahin", album: "Agneepath"
 * e.g. "Artist - Track Title.mp3" -> artist: "Artist", title: "Track Title"
 */
export function parseFilename(filename: string): { title: string; artist: string; album: string } {
  const baseName = filename.replace(/\.[^/.]+$/, '').trim();
  let title = baseName;
  let artist = 'AISHU Collection';
  let album = 'AISHU';

  // Check for "Artist - Title" format
  if (baseName.includes(' - ')) {
    const parts = baseName.split(' - ');
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }
  }

  // Check for (From "Movie/Album")
  const fromMatch = title.match(/\(From\s+["'“]([^"'”]+)["'”]\)/i);
  if (fromMatch) {
    album = fromMatch[1].trim();
    // Keep movie info or clean it
    title = title.replace(/\(From\s+["'“][^"'”]+["'”]\)/i, '').trim();
  }

  // Remove trailing cleanups
  title = title.replace(/\s+/g, ' ').trim();

  return { title: title || baseName, artist, album };
}

/**
 * Extracts all available ID3 metadata, artwork, exact duration, and SHA-256 hash from an audio file.
 */
export async function extractAudioMetadata(file: File): Promise<ExtractedTrackMetadata> {
  // 1. Compute SHA-256 hash
  const fileHash = await computeFileHash(file);
  const { title: filenameTitle, artist: filenameArtist, album: filenameAlbum } = parseFilename(file.name);

  let title = filenameTitle;
  let artist = filenameArtist;
  let album = filenameAlbum;
  let genre = 'Soundtrack';
  let duration = 0;
  let releaseYear = new Date().getFullYear();
  let artworkBlob: Blob | undefined;
  let artworkUrl: string | undefined;

  // 2. Parse ID3 / audio metadata with music-metadata-browser
  try {
    const metadata = await mm.parseBlob(file, { duration: true, skipCovers: false });
    
    if (metadata.common.title?.trim()) {
      title = metadata.common.title.trim();
    }
    if (metadata.common.artist?.trim()) {
      artist = metadata.common.artist.trim();
    }
    if (metadata.common.album?.trim()) {
      album = metadata.common.album.trim();
    }
    if (metadata.common.genre && metadata.common.genre.length > 0) {
      genre = metadata.common.genre[0].trim();
    }
    if (metadata.common.year) {
      releaseYear = metadata.common.year;
    }
    if (metadata.format.duration) {
      duration = Math.round(metadata.format.duration);
    }

    // Extract embedded cover artwork if present
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0];
      artworkBlob = new Blob([new Uint8Array(pic.data)], { type: pic.format });
      artworkUrl = URL.createObjectURL(artworkBlob);
    }
  } catch (err) {
    // If ID3 parsing fails or has no tags, fallback gracefully
    console.warn(`ID3 parse notice for ${file.name}:`, err);
  }

  // 3. Fallback duration detection using Audio element if duration is still missing
  if (!duration || duration <= 0) {
    duration = await probeAudioDuration(file);
  }

  return {
    file,
    title,
    artist,
    album,
    genre,
    duration: duration || 180,
    releaseYear,
    artworkBlob,
    artworkUrl,
    fileHash,
    fileSize: file.size,
  };
}

/**
 * Probes audio duration using standard HTML5 Audio element
 */
function probeAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = 'metadata';

      const cleanup = () => {
        URL.revokeObjectURL(url);
        audio.removeEventListener('loadedmetadata', onLoaded);
        audio.removeEventListener('error', onError);
      };

      const onLoaded = () => {
        const d = Math.round(audio.duration) || 180;
        cleanup();
        resolve(d);
      };

      const onError = () => {
        cleanup();
        resolve(180); // default 3 min fallback if cannot probe
      };

      audio.addEventListener('loadedmetadata', onLoaded);
      audio.addEventListener('error', onError);
      audio.src = url;

      // Timeout safety after 4 seconds
      setTimeout(() => {
        cleanup();
        resolve(180);
      }, 4000);
    } catch {
      resolve(180);
    }
  });
}
