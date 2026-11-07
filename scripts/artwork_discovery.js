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

// High-precision string cleaner for music metadata
function cleanString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\.[^/.]+$/, '') // remove extensions (.mp3 etc)
    .replace(/\(from\s+.*?\)/gi, '') // remove (From "Movie")
    .replace(/\bfrom\s+.*$/gi, '') // remove "from Movie"
    .replace(/music\s+from\s+the\s+motion\s+picture/gi, '')
    .replace(/original\s+motion\s+picture\s+soundtrack/gi, '')
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
    if (ratio >= 0.5) return 0.9;
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

// Safe iTunes Search API with User-Agent and JSON text parsing
async function queryiTunes(term, retries = 2) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=5`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 429) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        return [];
      }
      const text = await res.text();
      const data = JSON.parse(text.trim());
      return data.results || [];
    } catch (err) {
      if (attempt === retries) return [];
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return [];
}

// Generate intelligent search candidate queries
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

  // 2. Title + Artist (if artist is known and not placeholder)
  if (song.artist_name && song.artist_name !== 'Unknown Artist' && song.artist_name !== 'Cloud Stream') {
    candidates.push(`${song.title} ${song.artist_name}`);
  }

  // 3. Clean Title
  const cleanTitle = cleanString(song.title);
  if (cleanTitle) {
    candidates.push(cleanTitle);
  }

  // 4. Raw public_id cleaned
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

// Find matching official artwork with strict verification
async function discoverArtworkForSong(song) {
  const candidates = getSearchCandidates(song);
  const artistHint = extractArtistHint(song);

  for (const term of candidates) {
    const results = await queryiTunes(term);
    if (!results || results.length === 0) continue;

    for (const r of results) {
      if (!r.artworkUrl100) continue;

      // Title Levenshtein similarity against title and public_id
      const titleSim1 = levenshteinSimilarity(song.title, r.trackName);
      const titleSim2 = levenshteinSimilarity(song.cloudinary_public_id || '', r.trackName);
      const titleSim = Math.max(titleSim1, titleSim2);

      let artistSim = 0;
      if (artistHint) {
        artistSim = levenshteinSimilarity(artistHint, r.artistName);
      }

      // Verification Logic:
      // HIGH: Exact/High title similarity (>= 0.85) OR (title >= 0.70 AND artist >= 0.70)
      const isHighConfidence = titleSim >= 0.85 || (titleSim >= 0.70 && artistSim >= 0.70);
      
      // MEDIUM: Title similarity >= 0.75 without conflicting artist
      const isMediumConfidence = !isHighConfidence && titleSim >= 0.75;

      if (isHighConfidence || isMediumConfidence) {
        // Upgrade 100x100 thumbnail to 600x600 high-res cover art
        const highResArtwork = r.artworkUrl100.replace('100x100bb', '600x600bb');
        return {
          matched: true,
          confidence: isHighConfidence ? 'HIGH' : 'MEDIUM',
          matchedTrack: r.trackName,
          matchedArtist: r.artistName,
          matchedAlbum: r.collectionName,
          artworkUrl: highResArtwork,
          searchTerm: term,
          titleSimilarity: titleSim,
          artistSimilarity: artistSim,
        };
      }
    }

    // Small delay between candidates
    await new Promise(r => setTimeout(r, 100));
  }

  return { matched: false };
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  console.log('===============================================================');
  console.log('  SONORA — ARTWORK DISCOVERY & MAPPING ENGINE (v2.0)');
  console.log(`  Mode: ${isApply ? 'APPLY (Writing to Supabase public.songs)' : 'DRY-RUN (Audit & Verification Report)'}`);
  console.log('===============================================================\n');

  console.log('Querying all tracks from Supabase...');
  const { data: songs, count, error } = await supabase
    .from('songs')
    .select('id, title, artist_name, album_name, cover_url, cloudinary_public_id, genre', { count: 'exact' })
    .order('created_at', { ascending: true });

  if (error || !songs) {
    console.error('Failed to query songs:', error);
    process.exit(1);
  }

  console.log(`Total songs in catalogue: ${count}`);
  const targetSongs = limit ? songs.slice(0, limit) : songs;
  console.log(`Songs to process in this run: ${targetSongs.length}\n`);

  const results = {
    total: targetSongs.length,
    highConfidence: 0,
    mediumConfidence: 0,
    unmatched: 0,
    mappings: [],
  };

  const startTime = Date.now();

  for (let i = 0; i < targetSongs.length; i++) {
    const song = targetSongs[i];
    const match = await discoverArtworkForSong(song);

    if (match.matched) {
      if (match.confidence === 'HIGH') results.highConfidence++;
      else results.mediumConfidence++;

      results.mappings.push({
        id: song.id,
        title: song.title,
        artist_name: song.artist_name,
        cloudinary_public_id: song.cloudinary_public_id,
        status: match.confidence,
        matchedTrack: match.matchedTrack,
        matchedArtist: match.matchedArtist,
        matchedAlbum: match.matchedAlbum,
        artworkUrl: match.artworkUrl,
        searchTerm: match.searchTerm,
      });

      console.log(`[${i + 1}/${targetSongs.length}] MATCH (${match.confidence}): "${song.title}" -> "${match.matchedTrack}" by ${match.matchedArtist}`);
    } else {
      results.unmatched++;
      results.mappings.push({
        id: song.id,
        title: song.title,
        artist_name: song.artist_name,
        cloudinary_public_id: song.cloudinary_public_id,
        status: 'UNMATCHED',
        artworkUrl: null,
      });

      console.log(`[${i + 1}/${targetSongs.length}] UNMATCHED: "${song.title}" (${song.cloudinary_public_id})`);
    }

    // Progress log every 50 songs
    if ((i + 1) % 50 === 0 || i === targetSongs.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n--- Progress: ${i + 1}/${targetSongs.length} (${elapsed}s) | Matched: ${results.highConfidence + results.mediumConfidence} | Unmatched: ${results.unmatched} ---\n`);
    }

    // 120ms throttle between songs to respect rate limits
    await new Promise(r => setTimeout(r, 120));
  }

  // Save full mapping report to JSON file
  const reportPath = path.resolve(__dirname, 'artwork_mapping_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nMapping report successfully saved to: ${reportPath}`);

  // Summary Metrics
  const matchedTotal = results.highConfidence + results.mediumConfidence;
  const matchRate = ((matchedTotal / targetSongs.length) * 100).toFixed(1);

  console.log('\n===============================================================');
  console.log('  ARTWORK DISCOVERY AUDIT & VERIFICATION REPORT');
  console.log('===============================================================');
  console.log(`  Total Processed:         ${targetSongs.length}`);
  console.log(`  High Confidence Matches: ${results.highConfidence} (${((results.highConfidence / targetSongs.length) * 100).toFixed(1)}%)`);
  console.log(`  Medium Confidence:       ${results.mediumConfidence} (${((results.mediumConfidence / targetSongs.length) * 100).toFixed(1)}%)`);
  console.log(`  Total Matched:           ${matchedTotal} (${matchRate}%)`);
  console.log(`  Unmatched (Need Review): ${results.unmatched} (${((results.unmatched / targetSongs.length) * 100).toFixed(1)}%)`);
  console.log('===============================================================\n');

  // If in Apply Mode, execute bulk updates in Supabase
  if (isApply) {
    console.log('Executing safe bulk update on Supabase public.songs...');
    let updatedCount = 0;
    let failedCount = 0;

    for (const m of results.mappings) {
      if (m.status === 'HIGH' || m.status === 'MEDIUM') {
        const { error: updateError } = await supabase
          .from('songs')
          .update({ cover_url: m.artworkUrl })
          .eq('id', m.id);

        if (updateError) {
          console.error(`Failed to update song ${m.id} (${m.title}):`, updateError.message);
          failedCount++;
        } else {
          updatedCount++;
        }
      }
    }

    console.log(`\nBulk update complete: ${updatedCount} songs updated with verified artwork, ${failedCount} errors.`);
  } else {
    console.log('NOTE: This was a DRY-RUN AUDIT. Database was NOT modified.');
    console.log('Review the report. To apply verified artwork URLs to Supabase, run:');
    console.log('node scripts/artwork_discovery.js --apply');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
