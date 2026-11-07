import { Song } from '../types';
import { dataStore } from '../data/dataStore';
import path from 'path';
import fs from 'fs';

// Load audit lookup for verified artist & track metadata
let auditLookup: Record<string, any> = {};
try {
  const lookupPath = path.resolve(__dirname, '../data/songAuditLookup.json');
  if (fs.existsSync(lookupPath)) {
    auditLookup = JSON.parse(fs.readFileSync(lookupPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not load songAuditLookup.json in playlistImporterService:', e);
}

export interface ImportedTrack {
  position: number;
  originalTitle: string;
  originalArtist: string;
  originalAlbum?: string;
  duration?: number;
}

export interface MatchedImportTrack extends ImportedTrack {
  isMatched: boolean;
  matchConfidence: number; // 0.0 to 1.0
  matchConfidenceLevel: 'HIGH' | 'MEDIUM' | 'UNMATCHED';
  matchReason?: string;
  matchedSong?: Song;
}

export interface PlaylistImportPreview {
  source: 'spotify' | 'youtube';
  playlistId: string;
  title: string;
  description?: string;
  coverUrl?: string;
  totalTracks: number;
  matchedCount: number;
  unmatchedCount: number;
  tracks: MatchedImportTrack[];
}

/**
 * Normalizes title for fuzzy comparison
 */
function cleanText(str?: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\.[^/.]+$/, '') // remove extensions
    .replace(/\(from\s+["'“].*?["'”]\)/gi, '')
    .replace(/\bfrom\s+.*$/gi, '') // strip "From Movie", etc.
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\b(feat|ft)\b.*?$/gi, '')
    .replace(/\b(official\s+video|official\s+audio|lyric\s+video|remaster(ed)?)\b/gi, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Token overlap score (containment & Jaccard)
 */
function tokenOverlap(t1: string, t2: string): number {
  const words1 = new Set(cleanText(t1).split(' ').filter(w => w.length > 1));
  const words2 = new Set(cleanText(t2).split(' ').filter(w => w.length > 1));
  if (words1.size === 0 || words2.size === 0) return 0;
  let matches = 0;
  for (const w of words1) {
    if (words2.has(w)) matches++;
  }
  return matches / Math.min(words1.size, words2.size);
}

/**
 * Levenshtein similarity (0 to 1)
 */
function levenshteinSimilarity(s1: string, s2: string): number {
  const a = cleanText(s1);
  const b = cleanText(s2);
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;

  const costs: number[] = [];
  for (let i = 0; i <= a.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= b.length; j++) {
      if (i === 0) costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (a.charAt(i - 1) !== b.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[b.length] = lastValue;
  }

  return (longerLength - costs[b.length]) / parseFloat(longerLength.toString());
}

/**
 * Parse input playlist URL
 */
export function parsePlaylistUrl(url: string): { source: 'spotify' | 'youtube'; playlistId: string } {
  const trimmed = (url || '').trim();

  // 1. Spotify
  const spotifyMatch = trimmed.match(/spotify(?:\.com)?(?:\/intl-[a-z]{2})?(?:\/embed)?\/playlist\/([a-zA-Z0-9]+)/) ||
                       trimmed.match(/spotify:playlist:([a-zA-Z0-9]+)/);
  if (spotifyMatch && spotifyMatch[1]) {
    return { source: 'spotify', playlistId: spotifyMatch[1] };
  }

  // 2. YouTube Music / YouTube
  const ytMatch = trimmed.match(/(?:music\.youtube\.com|youtube\.com|youtu\.be)\/.*?[?&]list=([a-zA-Z0-9_-]+)/);
  if (ytMatch && ytMatch[1]) {
    return { source: 'youtube', playlistId: ytMatch[1] };
  }

  throw new Error('Unsupported or invalid playlist URL. Please provide a valid Spotify (open.spotify.com/playlist/...) or YouTube Music (music.youtube.com/playlist?list=...) link.');
}

/**
 * Retrieve Spotify Access Token using Client Credentials
 */
async function getSpotifyApiToken(clientId: string, clientSecret: string): Promise<string> {
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(`Spotify authentication failed: ${errorData.error_description || res.statusText}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Fetch Spotify Playlist using Web API with full pagination
 */
async function fetchSpotifyWebAPI(
  playlistId: string,
  clientId: string,
  clientSecret: string
): Promise<{ title: string; description?: string; coverUrl?: string; tracks: ImportedTrack[] }> {
  const token = await getSpotifyApiToken(clientId, clientSecret);

  // 1. Fetch Playlist metadata and first batch
  const initialUrl = `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,description,images,tracks(total,next,items(track(name,artists(name),album(name),duration_ms)))`;
  const res = await fetch(initialUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404 || res.status === 403) {
    throw new Error('Spotify playlist not found or is private. Please ensure the playlist is set to Public on Spotify.');
  }
  if (!res.ok) {
    throw new Error(`Spotify API error: HTTP ${res.status}`);
  }

  const data = await res.json();
  const title = data.name || 'Imported Spotify Playlist';
  const description = data.description || '';
  const coverUrl = data.images?.[0]?.url || undefined;
  const tracks: ImportedTrack[] = [];

  const addItems = (items: any[]) => {
    for (const item of items) {
      if (!item?.track) continue;
      const t = item.track;
      const artistNames = (t.artists || []).map((a: any) => a.name).join(', ') || 'Unknown Artist';
      tracks.push({
        position: tracks.length,
        originalTitle: t.name || 'Untitled Track',
        originalArtist: artistNames,
        originalAlbum: t.album?.name,
        duration: t.duration_ms ? Math.round(t.duration_ms / 1000) : 180,
      });
    }
  };

  addItems(data.tracks?.items || []);

  // 2. Paginate remaining tracks if any (Spotify limits to 100 per page)
  let nextUrl = data.tracks?.next;
  while (nextUrl) {
    const pageRes = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!pageRes.ok) break;
    const pageData = await pageRes.json();
    addItems(pageData.items || []);
    nextUrl = pageData.next;
  }

  return { title, description, coverUrl, tracks };
}

/**
 * Fetch Spotify Playlist using Public Embed (No API Keys Required)
 */
async function fetchSpotifyEmbed(
  playlistId: string
): Promise<{ title: string; description?: string; coverUrl?: string; tracks: ImportedTrack[] }> {
  const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  });

  if (res.status === 404 || res.status === 403) {
    throw new Error('Spotify playlist not found or is private. Please verify the URL.');
  }

  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('Could not parse Spotify playlist. Please check that the playlist is publicly accessible.');
  }

  try {
    const json = JSON.parse(match[1]);
    const entity = json.props?.pageProps?.state?.data?.entity;
    if (!entity) {
      throw new Error('Spotify playlist data was empty or restricted.');
    }

    const title = entity.name || 'Imported Spotify Playlist';
    const description = entity.subtitle || '';
    const coverUrl = entity.coverArt?.sources?.[0]?.url;
    const rawTrackList = entity.trackList || [];

    const tracks: ImportedTrack[] = rawTrackList.map((item: any, idx: number) => ({
      position: idx,
      originalTitle: item.title || 'Untitled Track',
      originalArtist: item.subtitle || 'Unknown Artist',
      duration: item.duration ? Math.round(item.duration / 1000) : 180,
    }));

    return { title, description, coverUrl, tracks };
  } catch (err: any) {
    throw new Error(`Failed to parse Spotify playlist content: ${err.message}`);
  }
}

/**
 * Fetch YouTube Music Playlist using YouTube Data API v3 with Pagination
 */
async function fetchYouTubeDataAPI(
  playlistId: string,
  apiKey: string
): Promise<{ title: string; description?: string; coverUrl?: string; tracks: ImportedTrack[] }> {
  // 1. Fetch playlist metadata
  const metaUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey}`;
  const metaRes = await fetch(metaUrl);
  if (!metaRes.ok) {
    const errorData = await metaRes.json().catch(() => ({}));
    throw new Error(`YouTube API error: ${errorData.error?.message || metaRes.statusText}`);
  }

  const metaData = await metaRes.json();
  if (!metaData.items || metaData.items.length === 0) {
    throw new Error('YouTube playlist not found or is private. Make sure the playlist is set to Public or Unlisted.');
  }

  const playlistSnippet = metaData.items[0].snippet;
  const title = playlistSnippet.title || 'Imported YouTube Playlist';
  const description = playlistSnippet.description || '';
  const coverUrl = playlistSnippet.thumbnails?.maxres?.url ||
                   playlistSnippet.thumbnails?.standard?.url ||
                   playlistSnippet.thumbnails?.high?.url;

  // 2. Paginate playlist items
  const tracks: ImportedTrack[] = [];
  let pageToken: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    const tokenParam: string = pageToken ? `&pageToken=${pageToken}` : '';
    const itemsUrl: string = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}${tokenParam}&key=${apiKey}`;
    const itemsRes = await fetch(itemsUrl);
    if (!itemsRes.ok) break;

    const itemsData: any = await itemsRes.json();
    for (const item of itemsData.items || []) {
      const snip = item.snippet;
      if (!snip || snip.title === 'Private video' || snip.title === 'Deleted video') continue;

      let songTitle: string = snip.title;
      let artistName: string = snip.videoOwnerChannelTitle?.replace(/ - Topic$/i, '') || 'YouTube Music';

      // Parse standard "Artist - Title" format common in YouTube Music
      if (songTitle.includes(' - ')) {
        const parts = songTitle.split(' - ');
        artistName = parts[0].trim();
        songTitle = parts.slice(1).join(' - ').trim();
      }

      tracks.push({
        position: tracks.length,
        originalTitle: songTitle,
        originalArtist: artistName,
        duration: 180,
      });
    }

    pageToken = itemsData.nextPageToken;
    hasMore = Boolean(pageToken);
  }

  return { title, description, coverUrl, tracks };
}

/**
 * Fallback oEmbed verification for YouTube Music when API key is unconfigured
 */
async function fetchYouTubeOEmbed(
  playlistId: string
): Promise<{ title: string; coverUrl?: string }> {
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/playlist?list=${playlistId}&format=json`;
  const res = await fetch(oembedUrl);
  if (!res.ok) {
    throw new Error('YouTube Music playlist not found or is private. Please ensure the link is publicly accessible.');
  }
  const data = await res.json();
  return {
    title: data.title || 'YouTube Music Playlist',
    coverUrl: data.thumbnail_url,
  };
}

/**
 * Title Similarity combining Levenshtein and Dice word-token coefficient.
 * Prevents small substrings (e.g. "I Love You") from falsely matching longer songs.
 */
function titleSimilarity(t1: string, t2: string): number {
  const c1 = cleanText(t1);
  const c2 = cleanText(t2);
  if (!c1 || !c2) return 0;
  if (c1 === c2) return 1.0;

  const lev = levenshteinSimilarity(c1, c2);

  const w1 = new Set(c1.split(' ').filter(w => w.length > 1));
  const w2 = new Set(c2.split(' ').filter(w => w.length > 1));
  if (w1.size === 0 || w2.size === 0) return lev;

  let matches = 0;
  for (const w of w1) {
    if (w2.has(w)) matches++;
  }
  const dice = (2 * matches) / (w1.size + w2.size);

  // Exact or near-exact string match
  if (lev >= 0.88) return lev;

  // If words have zero overlap, it's not a match (e.g. Loser vs Closer)
  if (matches === 0) return lev * 0.5;

  return lev * 0.5 + dice * 0.5;
}

/**
 * Match imported tracks against the 910-song SONORA library
 */
export async function matchTracksAgainstCatalogue(
  importedTracks: ImportedTrack[]
): Promise<MatchedImportTrack[]> {
  const songs = await dataStore.getSongs({});

  return importedTracks.map((imported) => {
    let bestMatch: Song | null = null;
    let highestScore = 0;
    let matchReason = '';

    for (const song of songs) {
      const audit = auditLookup[song.id];
      const verifiedArtist = audit?.matchedArtist || (song.artist_name !== 'Unknown Artist' ? song.artist_name : '');
      const verifiedTitle = audit?.matchedTrack || song.title;

      // 1. Title Similarity
      const titleScoreDB = titleSimilarity(imported.originalTitle, song.title);
      const titleScoreVerified = titleSimilarity(imported.originalTitle, verifiedTitle);
      const titleScore = Math.max(titleScoreDB, titleScoreVerified);

      // Strict minimum title threshold: must be >= 0.75
      if (titleScore < 0.75) continue;

      // 2. Artist Similarity
      const artistOverlapDB = tokenOverlap(imported.originalArtist, song.artist_name);
      const artistOverlapVerified = tokenOverlap(imported.originalArtist, verifiedArtist);
      const artistLevVerified = levenshteinSimilarity(imported.originalArtist, verifiedArtist);

      const artistScore = Math.max(artistOverlapDB, artistOverlapVerified, artistLevVerified);

      // Strict Rule: If both imported and catalogue song have specified artists and they have 0 match, reject!
      const hasBothArtists = Boolean(
        imported.originalArtist &&
        imported.originalArtist !== 'Unknown Artist' &&
        verifiedArtist &&
        verifiedArtist !== 'Unknown Artist'
      );
      if (hasBothArtists && artistScore < 0.25) {
        continue;
      }

      // Weight score: 70% title, 30% artist
      const effectiveArtistScore = hasBothArtists ? artistScore : 0.6;
      const combinedScore = titleScore * 0.70 + effectiveArtistScore * 0.30;

      if (combinedScore > highestScore) {
        highestScore = combinedScore;
        bestMatch = song;
        matchReason = `Matched with ${Math.round(titleScore * 100)}% title & ${Math.round(effectiveArtistScore * 100)}% artist similarity`;
      }
    }

    if (bestMatch && highestScore >= 0.78) {
      const level = highestScore >= 0.88 ? 'HIGH' : 'MEDIUM';
      return {
        ...imported,
        isMatched: true,
        matchConfidence: parseFloat(highestScore.toFixed(2)),
        matchConfidenceLevel: level,
        matchReason,
        matchedSong: bestMatch,
      };
    }

    return {
      ...imported,
      isMatched: false,
      matchConfidence: 0,
      matchConfidenceLevel: 'UNMATCHED',
      matchReason: 'Track not found in SONORA library catalogue',
    };
  });
}

/**
 * Main Orchestrator: Fetch playlist metadata + Match tracks against SONORA library
 */
export async function processPlaylistImport(
  url: string,
  options?: {
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    youtubeApiKey?: string;
  }
): Promise<PlaylistImportPreview> {
  const { source, playlistId } = parsePlaylistUrl(url);

  let title = 'Imported Playlist';
  let description = '';
  let coverUrl: string | undefined = undefined;
  let tracks: ImportedTrack[] = [];

  if (source === 'spotify') {
    const clientId = options?.spotifyClientId || process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = options?.spotifyClientSecret || process.env.SPOTIFY_CLIENT_SECRET;

    if (clientId && clientSecret) {
      try {
        const result = await fetchSpotifyWebAPI(playlistId, clientId, clientSecret);
        title = result.title;
        description = result.description || '';
        coverUrl = result.coverUrl;
        tracks = result.tracks;
      } catch (err: any) {
        console.warn('Spotify Web API failed, falling back to public embed parser:', err.message);
        const fallback = await fetchSpotifyEmbed(playlistId);
        title = fallback.title;
        description = fallback.description || '';
        coverUrl = fallback.coverUrl;
        tracks = fallback.tracks;
      }
    } else {
      // Direct public embed fetch (no keys required)
      const result = await fetchSpotifyEmbed(playlistId);
      title = result.title;
      description = result.description || '';
      coverUrl = result.coverUrl;
      tracks = result.tracks;
    }
  } else if (source === 'youtube') {
    const apiKey = options?.youtubeApiKey || process.env.YOUTUBE_API_KEY;
    if (apiKey) {
      const result = await fetchYouTubeDataAPI(playlistId, apiKey);
      title = result.title;
      description = result.description || '';
      coverUrl = result.coverUrl;
      tracks = result.tracks;
    } else {
      // Try oEmbed verification first
      const oembed = await fetchYouTubeOEmbed(playlistId);
      throw new Error(
        `Found YouTube Music playlist "${oembed.title}". A YouTube Data API v3 key is required to enumerate the playlist tracklist. Please enter your YouTube API Key in the settings below or configure YOUTUBE_API_KEY in server/.env.`
      );
    }
  }

  // Match imported tracks against catalogue
  const matchedTracks = await matchTracksAgainstCatalogue(tracks);
  const matchedCount = matchedTracks.filter((t) => t.isMatched).length;
  const unmatchedCount = matchedTracks.length - matchedCount;

  return {
    source,
    playlistId,
    title,
    description,
    coverUrl,
    totalTracks: matchedTracks.length,
    matchedCount,
    unmatchedCount,
    tracks: matchedTracks,
  };
}
