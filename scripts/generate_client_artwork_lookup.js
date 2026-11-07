const fs = require('fs');
const path = require('path');

const auditPath = path.resolve(__dirname, 'full_audit_report.json');
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

const lookup = {};

// 1. High confidence (810)
audit.highConfidence.forEach(item => {
  lookup[item.id] = {
    status: 'VERIFIED',
    matchedArtist: item.matchedArtist || item.artist_name,
    matchedAlbum: item.matchedAlbum || item.title,
    matchedTrack: item.matchedTrack || item.title,
    artworkUrl: item.artworkUrl,
    similarity: item.similarity
  };
});

// 2. Medium confidence (11)
audit.mediumConfidence.forEach(item => {
  lookup[item.id] = {
    status: 'MEDIUM_CONFIDENCE',
    matchedArtist: item.matchedArtist,
    matchedAlbum: item.matchedAlbum,
    matchedTrack: item.matchedTrack,
    artworkUrl: item.artworkUrl,
    similarity: item.similarity,
    reason: item.reason || 'Similarity threshold requires verification'
  };
});

// 3. Ambiguous (5)
audit.ambiguous.forEach(item => {
  lookup[item.id] = {
    status: 'AMBIGUOUS',
    matchedArtist: item.matchedArtist,
    matchedAlbum: item.matchedAlbum,
    matchedTrack: item.matchedTrack,
    artworkUrl: item.artworkUrl,
    reason: item.reason
  };
});

// 4. Unmatched (84)
audit.unmatched.forEach(item => {
  lookup[item.id] = {
    status: 'UNMATCHED',
    matchedArtist: null,
    matchedAlbum: null,
    matchedTrack: null,
    artworkUrl: null,
    reason: 'No high-confidence match discovered in catalogue index'
  };
});

const outDir = path.resolve(__dirname, '../client/src/data');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, 'songAuditLookup.json');
fs.writeFileSync(outPath, JSON.stringify(lookup, null, 2), 'utf8');

console.log(`Generated song audit lookup for ${Object.keys(lookup).length} songs at ${outPath}`);

