const fs = require('fs');
const audit = JSON.parse(fs.readFileSync('scripts/full_audit_report.json', 'utf8'));

console.log('=== ALL 11 MEDIUM CONFIDENCE TRACKS ===');
audit.mediumConfidence.forEach((x, i) => {
  console.log(`${i+1}. "${x.title}" -> Matched: "${x.matchedTrack}" by "${x.matchedArtist}" (similarity: ${(x.similarity*100).toFixed(1)}%)`);
});

console.log('\n=== ALL 5 AMBIGUOUS TRACKS ===');
audit.ambiguous.forEach((x, i) => {
  console.log(`${i+1}. "${x.title}" -> Reason: ${x.reason}`);
});

console.log('\n=== SAMPLE UNMATCHED TRACKS (first 10 of 84) ===');
audit.unmatched.slice(0, 10).forEach((x, i) => {
  console.log(`${i+1}. "${x.title}" (ID: ${x.id})`);
});

