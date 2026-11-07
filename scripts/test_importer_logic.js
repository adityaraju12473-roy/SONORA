const path = require('path');
const fs = require('fs');

const serverDir = path.resolve(__dirname, '../server');
const { createClient } = require(path.join(serverDir, 'node_modules/@supabase/supabase-js'));
require(path.join(serverDir, 'node_modules/dotenv')).config({ path: path.join(serverDir, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const auditLookup = JSON.parse(fs.readFileSync(path.join(__dirname, '../client/src/data/songAuditLookup.json'), 'utf8'));

function cleanText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/\bfrom\s+.*$/gi, '') // strips "From Bhediya", "From Beast", etc.!
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\b(feat|ft)\b.*?$/gi, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordTokens(str) {
  return new Set(cleanText(str).split(' ').filter(w => w.length > 1));
}

function tokenOverlapScore(t1, t2) {
  const words1 = wordTokens(t1);
  const words2 = wordTokens(t2);
  if (words1.size === 0 || words2.size === 0) return 0;
  let matches = 0;
  for (const w of words1) {
    if (words2.has(w)) matches++;
  }
  // Jaccard & containment
  const overlap = matches / Math.min(words1.size, words2.size);
  return overlap;
}

async function testMatching() {
  const { data: songs } = await supabase.from('songs').select('*');

  const sampleImported = [
    { title: 'Amplifier', artist: 'Imran Khan' },
    { title: 'Ambitionz Az A Ridah', artist: '2Pac' },
    { title: 'Apna Bana Le', artist: 'Arijit Singh, Sachin-Jigar' },
    { title: 'Halamithi Habibo (From "Beast")', artist: 'Anirudh Ravichander' },
    { title: 'Ala Bolelo', artist: 'Anirudh' },
    { title: 'Stop The Wedding!', artist: 'Ashe' },
  ];

  sampleImported.forEach(target => {
    let bestMatch = null;
    let bestScore = 0;

    for (const song of songs) {
      const audit = auditLookup[song.id];
      const verifiedArtist = audit?.matchedArtist || (song.artist_name !== 'Unknown Artist' ? song.artist_name : '');
      const verifiedTitle = audit?.matchedTrack || song.title;

      // 1. Title matching against both DB title and verified title
      const titleOverlapDB = tokenOverlapScore(target.title, song.title);
      const titleOverlapVerified = tokenOverlapScore(target.title, verifiedTitle);
      const titleScore = Math.max(titleOverlapDB, titleOverlapVerified);

      if (titleScore < 0.75) continue;

      // 2. Artist matching against both DB artist and verified artist
      let artistScore = 0.5; // neutral if missing
      const artistOverlapDB = tokenOverlapScore(target.artist, song.artist_name);
      const artistOverlapVerified = tokenOverlapScore(target.artist, verifiedArtist);
      const rawArtistScore = Math.max(artistOverlapDB, artistOverlapVerified);

      if (rawArtistScore > 0) {
        artistScore = rawArtistScore;
      }

      // Title must be high (>= 0.75). If artists contradict, penalize.
      const totalScore = titleScore * 0.7 + artistScore * 0.3;
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestMatch = { song, score: totalScore, verifiedArtist, verifiedTitle };
      }
    }

    if (bestMatch && bestScore >= 0.75) {
      console.log(`✔ MATCHED: "${target.title}" by "${target.artist}" -> "${bestMatch.song.title}" (${bestMatch.verifiedArtist}) [Confidence: ${(bestScore * 100).toFixed(0)}%]`);
    } else {
      console.log(`✖ UNMATCHED: "${target.title}" by "${target.artist}"`);
    }
  });
}

testMatching();
