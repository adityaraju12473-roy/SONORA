const path = require('path');
const fs = require('fs');

// Initialize Supabase Client
const serverDir = path.resolve(__dirname, '../server');
const { createClient } = require(path.join(serverDir, 'node_modules/@supabase/supabase-js'));
require(path.join(serverDir, 'node_modules/dotenv')).config({ path: path.join(serverDir, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in server/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Persistent Cache File to survive restarts and prevent redundant API requests
const CACHE_FILE = path.resolve(__dirname, 'artwork_cache.json');
let searchCache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    searchCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log(`Loaded ${Object.keys(searchCache).length} cached search queries from ${CACHE_FILE}`);
  } catch {
    searchCache = {};
  }
}

function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(searchCache, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save search cache:', err.message);
  }
}

// Clean string for high-precision music matching
function cleanString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\.[^/.]+$/, '') // remove extensions (.mp3, .wav)
    .replace(/\(from\s+.*?\)/gi, '') // remove (From "Movie")
    .replace(/\bfrom\s+.*$/gi, '') // remove "from Movie"
    .replace(/music\s+from\s+the\s+motion\s+picture/gi, '')
    .replace(/original\s+motion\s+picture\s+soundtrack/gi, '')
    .replace(/\(?\bfeat(\.|\b).*?\)?$/gi, '') // remove feat. / ft.
    .replace(/\(?\bft(\.|\b).*?\)?$/gi, '')
    .replace(/\(?\bremaster(ed)?.*?\)?$/gi, '') // remove remastered
    .replace(/\(?\bexplicit\)?$/gi, '')
    .replace(/\[.*?\]/g, '') // remove brackets
    .replace(/[\(\)]/g, ' ')
    .replace(/[_\-\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein similarity with prefix verification
function levenshteinSimilarity(a, b) {
  const s1 = cleanString(a);
  const s2 = cleanString(b);
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0;

  // Prefix match check with length ratio safeguard
  if (s1.startsWith(s2) || s2.startsWith(s1)) {
    const ratio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    if (ratio >= 0.6) return 0.92;
  }

  const m = s1.length, n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return 1 - dp[m][n] / Math.max(m, n);
}

// Resilient iTunes Search with Exponential Backoff for 429 Rate Limits
async function queryiTunesWithBackoff(term) {
  const cacheKey = term.toLowerCase().trim();
  if (searchCache[cacheKey]) {
    return searchCache[cacheKey];
  }

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=5`;
  const maxRetries = 4;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      });

      if (res.status === 429 || res.status === 403) {
        const delay = (attempt + 1) * 6000; // 6s, 12s, 18s, 24s backoff
        console.warn(`[HTTP ${res.status}] Rate limit on "${term}". Backing off for ${(delay / 1000)}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) {
        return [];
      }

      const text = await res.text();
      try {
        const data = JSON.parse(text.trim());
        const results = data.results || [];
        searchCache[cacheKey] = results;
        return results;
      } catch {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`Network error on "${term}":`, err.message);
        return [];
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return [];
}

// Generate smart search queries from metadata
function getSearchCandidates(song) {
  const candidates = [];
  const pub = song.cloudinary_public_id || '';

  // 1. If public_id has "Song_-_Artist" or "Artist_-_Song"
  if (pub.includes('_-_') || pub.includes(' - ')) {
    const sep = pub.includes('_-_') ? '_-_' : ' - ';
    const parts = pub.split(sep);
    if (parts.length >= 2) {
      const p0 = parts[0].replace(/_/g, ' ').trim();
      const p1 = parts[1].replace(/_/g, ' ').trim();
      candidates.push(`${p0} ${p1}`);
      candidates.push(`${p1} ${p0}`);
      candidates.push(p0);
      candidates.push(p1);
    }
  }

  // 2. Movie extracted from "From Movie"
  const fromMatch = (song.title || '').match(/\bfrom\s+(.+)$/i);
  if (fromMatch && fromMatch[1]) {
    const moviePart = fromMatch[1].replace(/[\(\)]/g, '').trim();
    const songPart = cleanString(song.title);
    if (songPart && moviePart) {
      candidates.push(`${songPart} ${moviePart}`);
    }
  }

  // 3. Title + Artist (if artist is known)
  if (song.artist_name && song.artist_name !== 'Unknown Artist' && song.artist_name !== 'Cloud Stream') {
    candidates.push(`${cleanString(song.title)} ${cleanString(song.artist_name)}`);
  }

  // 4. Clean Title
  const cleanTitle = cleanString(song.title);
  if (cleanTitle) {
    candidates.push(cleanTitle);
  }

  // 5. Raw public_id cleaned
  const cleanPub = pub.replace(/_/g, ' ').replace(/\.[^/.]+$/, '').trim();
  if (cleanPub && cleanPub !== cleanTitle) {
    candidates.push(cleanPub);
  }

  return Array.from(new Set(candidates.filter(c => c && c.length >= 2)));
}

// Extract artist hint if available
function extractArtistHint(song) {
  if (song.artist_name && song.artist_name !== 'Unknown Artist' && song.artist_name !== 'Cloud Stream') {
    return song.artist_name;
  }
  const pub = song.cloudinary_public_id || '';
  if (pub.includes('_-_') || pub.includes(' - ')) {
    const sep = pub.includes('_-_') ? '_-_' : ' - ';
    const parts = pub.split(sep);
    if (parts.length >= 2) {
      return parts[1].replace(/_/g, ' ').trim();
    }
  }
  return null;
}

// List of common ubiquitous single-word titles that require strict artist confirmation
const UBIQUITOUS_TITLES = new Set([
  'stay', 'work', 'home', 'sunday', 'hold on', 'hello', 'run', 'time',
  'alone', 'forever', 'alive', 'one', 'hero', 'without you', 'sorry', 'dil',
  'love', 'you', 'me', 'us', 'crazy', 'baby', 'money'
]);

// Discover and strictly classify artwork for a song
async function evaluateSongArtwork(song) {
  const candidates = getSearchCandidates(song);
  const artistHint = extractArtistHint(song);
  const cleanTitle = cleanString(song.title);

  // Check for ubiquitous single-word title with unknown artist
  const isUbiquitous = UBIQUITOUS_TITLES.has(cleanTitle) && !artistHint;

  let bestMedium = null;
  let bestAmbiguous = null;

  for (const term of candidates) {
    const results = await queryiTunesWithBackoff(term);
    if (!results || results.length === 0) continue;

    for (const r of results) {
      if (!r.artworkUrl100) continue;

      let titleSim = Math.max(
        levenshteinSimilarity(song.title, r.trackName),
        levenshteinSimilarity(song.cloudinary_public_id || '', r.trackName)
      );

      // If public_id has parts, also check parts against trackName
      const pub = song.cloudinary_public_id || '';
      let part0 = '', part1 = '';
      if (pub.includes('_-_') || pub.includes(' - ')) {
        const sep = pub.includes('_-_') ? '_-_' : ' - ';
        const parts = pub.split(sep);
        if (parts.length >= 2) {
          part0 = parts[0].replace(/_/g, ' ').trim();
          part1 = parts[1].replace(/_/g, ' ').trim();
          titleSim = Math.max(
            titleSim,
            levenshteinSimilarity(part0, r.trackName),
            levenshteinSimilarity(part1, r.trackName)
          );
        }
      }

      let artistSim = 0;
      if (artistHint) {
        artistSim = levenshteinSimilarity(artistHint, r.artistName);
      }
      if (part0 || part1) {
        artistSim = Math.max(
          artistSim,
          levenshteinSimilarity(part0, r.artistName),
          levenshteinSimilarity(part1, r.artistName)
        );
      }

      // Check for Ambiguity
      if (isUbiquitous && results.length >= 2) {
        if (!bestAmbiguous) {
          bestAmbiguous = {
            status: 'AMBIGUOUS',
            reason: `Common single-word title "${song.title}" without artist metadata matches multiple distinct tracks (${results.slice(0, 3).map(x => x.artistName).join(', ')})`,
            matchedTrack: r.trackName,
            matchedArtist: r.artistName,
            matchedAlbum: r.collectionName,
            artworkUrl: r.artworkUrl100.replace('100x100bb', '600x600bb'),
            titleSimilarity: titleSim,
          };
        }
        continue;
      }

      // HIGH CONFIDENCE:
      // Case A: Exact or very high title match (>= 0.90) and not ubiquitous
      // Case B: High title (>= 0.75) AND verified artist match (>= 0.70)
      const isHighConfidence = (titleSim >= 0.75 && artistSim >= 0.70) || (titleSim >= 0.90 && !isUbiquitous);

      if (isHighConfidence) {
        return {
          status: 'HIGH',
          matchedTrack: r.trackName,
          matchedArtist: r.artistName,
          matchedAlbum: r.collectionName,
          artworkUrl: r.artworkUrl100.replace('100x100bb', '600x600bb'),
          searchTerm: term,
          titleSimilarity: titleSim,
          artistSimilarity: artistSim,
        };
      }

      // MEDIUM CONFIDENCE:
      // Sub-threshold similarity between 0.72 and 0.89
      if (titleSim >= 0.72 && !bestMedium) {
        bestMedium = {
          status: 'MEDIUM',
          matchedTrack: r.trackName,
          matchedArtist: r.artistName,
          matchedAlbum: r.collectionName,
          artworkUrl: r.artworkUrl100.replace('100x100bb', '600x600bb'),
          searchTerm: term,
          titleSimilarity: titleSim,
          artistSimilarity: artistSim,
        };
      }
    }

    // Pacing delay
    await new Promise(r => setTimeout(r, 60));
  }

  if (bestMedium) return bestMedium;
  if (bestAmbiguous) return bestAmbiguous;
  return { status: 'UNMATCHED' };
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');

  console.log('================================================================');
  console.log('  SONORA 2.0 — COMPLETE ARTWORK DISCOVERY & SAFETY AUDIT');
  console.log(`  Execution Mode: ${isApply ? 'APPLY (Updating Supabase public.songs)' : 'DRY-RUN (Full Audit & Safety Report)'}`);
  console.log('================================================================\n');

  console.log('Fetching all 910 tracks from Supabase...');
  const { data: songs, count, error } = await supabase
    .from('songs')
    .select('id, title, artist_name, album_name, cover_url, cloudinary_public_id, genre', { count: 'exact' })
    .order('created_at', { ascending: true });

  if (error || !songs) {
    console.error('Failed to load songs from database:', error);
    process.exit(1);
  }

  console.log(`Successfully retrieved ${count} tracks from Supabase.`);
  console.log('Initiating discovery audit across ALL songs...\n');

  const report = {
    auditedAt: new Date().toISOString(),
    totalSongs: songs.length,
    highConfidence: [],
    mediumConfidence: [],
    ambiguous: [],
    unmatched: [],
  };

  const startTime = Date.now();

  // Process with concurrency = 2 for optimal throughput while avoiding rate limits
  const CONCURRENCY = 2;
  let currentIndex = 0;

  async function worker(workerId) {
    while (currentIndex < songs.length) {
      const idx = currentIndex++;
      const song = songs[idx];

      const evaluation = await evaluateSongArtwork(song);

      const record = {
        id: song.id,
        title: song.title,
        artist_name: song.artist_name,
        cloudinary_public_id: song.cloudinary_public_id,
        current_cover_url: song.cover_url,
        status: evaluation.status,
        matchedTrack: evaluation.matchedTrack || null,
        matchedArtist: evaluation.matchedArtist || null,
        matchedAlbum: evaluation.matchedAlbum || null,
        artworkUrl: evaluation.artworkUrl || null,
        similarity: evaluation.titleSimilarity || 0,
        reason: evaluation.reason || null,
      };

      if (evaluation.status === 'HIGH') {
        report.highConfidence.push(record);
        console.log(`[${idx + 1}/${songs.length}] HIGH: "${song.title}" -> "${evaluation.matchedTrack}" by ${evaluation.matchedArtist}`);
      } else if (evaluation.status === 'MEDIUM') {
        report.mediumConfidence.push(record);
        console.log(`[${idx + 1}/${songs.length}] MEDIUM: "${song.title}" -> "${evaluation.matchedTrack}" by ${evaluation.matchedArtist} (Sim: ${evaluation.titleSimilarity.toFixed(2)})`);
      } else if (evaluation.status === 'AMBIGUOUS') {
        report.ambiguous.push(record);
        console.log(`[${idx + 1}/${songs.length}] AMBIGUOUS: "${song.title}" -> ${evaluation.reason}`);
      } else {
        report.unmatched.push(record);
        console.log(`[${idx + 1}/${songs.length}] UNMATCHED: "${song.title}" (${song.cloudinary_public_id})`);
      }

      if ((idx + 1) % 25 === 0 || idx === songs.length - 1) {
        saveCache();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n>>> [PROGRESS ${idx + 1}/${songs.length}] Elapsed: ${elapsed}s | High: ${report.highConfidence.length} | Medium: ${report.mediumConfidence.length} | Ambiguous: ${report.ambiguous.length} | Unmatched: ${report.unmatched.length} <<<\n`);
      }

      await new Promise(r => setTimeout(r, 120));
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i));
  await Promise.all(workers);

  // Final cache save
  saveCache();

  // Save Complete Dry-Run Audit Report to JSON
  const reportPath = path.resolve(__dirname, 'full_audit_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nFull dry-run report written to: ${reportPath}`);

  // Summary Metrics
  const total = songs.length;
  const highCount = report.highConfidence.length;
  const medCount = report.mediumConfidence.length;
  const ambCount = report.ambiguous.length;
  const unCount = report.unmatched.length;

  console.log('\n================================================================');
  console.log('  FINAL ARTWORK AUDIT METRICS (910 SONGS)');
  console.log('================================================================');
  console.log(`  Total Catalogue:         ${total}`);
  console.log(`  HIGH-CONFIDENCE MATCHES: ${highCount} (${((highCount / total) * 100).toFixed(1)}%)  <-- Eligible for automatic apply`);
  console.log(`  MEDIUM-CONFIDENCE:       ${medCount} (${((medCount / total) * 100).toFixed(1)}%)   <-- Excluded from automatic apply`);
  console.log(`  AMBIGUOUS MATCHES:       ${ambCount} (${((ambCount / total) * 100).toFixed(1)}%)   <-- Excluded from automatic apply`);
  console.log(`  UNMATCHED TRACKS:        ${unCount} (${((unCount / total) * 100).toFixed(1)}%)   <-- Excluded from automatic apply`);
  console.log('================================================================\n');

  if (isApply) {
    console.log('APPLYING ONLY HIGH-CONFIDENCE MATCHES TO SUPABASE...');
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Batched updates
    const batchSize = 25;
    for (let i = 0; i < report.highConfidence.length; i += batchSize) {
      const batch = report.highConfidence.slice(i, i + batchSize);
      await Promise.all(batch.map(async (record) => {
        // Idempotency: skip if already correct
        if (record.current_cover_url === record.artworkUrl) {
          skippedCount++;
          return;
        }

        const { error: updateError } = await supabase
          .from('songs')
          .update({ cover_url: record.artworkUrl })
          .eq('id', record.id);

        if (updateError) {
          console.error(`Failed to update song ${record.id}:`, updateError.message);
          failedCount++;
        } else {
          updatedCount++;
        }
      }));
      console.log(`Updated batch ${Math.min(i + batchSize, report.highConfidence.length)}/${report.highConfidence.length}...`);
    }

    console.log(`\n[APPLY COMPLETE] ${updatedCount} songs updated with verified artwork.`);
    console.log(`                 ${skippedCount} songs already had correct artwork.`);
    console.log(`                 ${failedCount} errors.`);
  } else {
    console.log('STATUS: Dry-run complete. Database public.songs was NOT modified.');
    console.log('Waiting for user review and approval before applying.');
  }
}

main().catch(err => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
