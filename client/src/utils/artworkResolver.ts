import { Song } from '../types';
import songAuditLookup from '../data/songAuditLookup.json';

const GENERIC_FALLBACK_PATTERN = /photo-1614613535308-eb5fbd3d2c17/i;

// In-memory cache for resolved artworks
const artworkCache = new Map<string, string>();

/**
 * Checks whether the given cover URL is the default generic image or empty
 */
export function isGenericArtwork(url?: string | null): boolean {
  if (!url) return true;
  return GENERIC_FALLBACK_PATTERN.test(url);
}

/**
 * Checks if a song has verified official album artwork.
 */
export function isSongArtworkVerified(song?: Song | null): boolean {
  if (!song) return false;
  if (song.cover_url && !isGenericArtwork(song.cover_url) && song.cover_url.includes('mzstatic.com')) {
    return true;
  }
  const auditEntry = (songAuditLookup as Record<string, any>)[song.id];
  return auditEntry?.status === 'VERIFIED' && Boolean(auditEntry?.artworkUrl);
}

/**
 * Generates a clean, modern minimalist placeholder for unverified tracks.
 * Clearly labels the track with its title and a "MANUAL REVIEW" indicator.
 */
export function getUnverifiedArtworkPlaceholder(title?: string | null, artist?: string | null): string {
  const safeTitle = (title || 'Track').replace(/["'<>]/g, '').slice(0, 22);
  const initial = (title || 'S').trim().charAt(0).toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <rect width="600" height="600" fill="#131316"/>
    <circle cx="300" cy="270" r="130" fill="#1c1c22" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
    <text x="300" y="295" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="76" font-weight="700" fill="#ffffff" text-anchor="middle">${initial}</text>
    <rect x="190" y="440" width="220" height="32" rx="16" fill="rgba(245,158,11,0.12)" stroke="rgba(245,158,11,0.35)" stroke-width="1.5"/>
    <text x="300" y="461" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" letter-spacing="1.5" fill="#f59e0b" text-anchor="middle">MANUAL REVIEW</text>
    <text x="300" y="512" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#71717a" text-anchor="middle">${safeTitle}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Returns immediate verified artwork for a song:
 * 1. If song.cover_url has the verified iTunes URL (mzstatic.com), returns it directly.
 * 2. If song is in the verified audit lookup, returns its verified 600x600 iTunes URL.
 * 3. Otherwise returns a clean unverified placeholder clearly tagged for manual review.
 * NEVER returns random images or generic photo placeholders.
 */
export function getImmediateSongArtwork(song?: Song | null): string {
  if (!song) {
    return getUnverifiedArtworkPlaceholder('Track');
  }

  const cacheKey = song.id || song.title;
  if (artworkCache.has(cacheKey)) {
    return artworkCache.get(cacheKey)!;
  }

  // 1. Direct verified cover from database record
  if (song.cover_url && !isGenericArtwork(song.cover_url)) {
    artworkCache.set(cacheKey, song.cover_url);
    return song.cover_url;
  }

  // 2. Check verified audit lookup table
  const auditEntry = (songAuditLookup as Record<string, any>)[song.id];
  if (auditEntry?.status === 'VERIFIED' && auditEntry.artworkUrl) {
    artworkCache.set(cacheKey, auditEntry.artworkUrl);
    return auditEntry.artworkUrl;
  }

  // 3. Fallback for unverified tracks (tagged for manual review)
  const placeholder = getUnverifiedArtworkPlaceholder(song.title, song.artist_name);
  artworkCache.set(cacheKey, placeholder);
  return placeholder;
}

/**
 * Async artwork resolver (hook companion):
 * Returns immediate verified artwork without flicker.
 */
export async function fetchOfficialArtwork(song: Song): Promise<string | null> {
  return getImmediateSongArtwork(song);
}
