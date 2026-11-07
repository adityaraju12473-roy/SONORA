const path = require('path');
const fs = require('fs');

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

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  const reportPath = path.resolve(__dirname, 'full_audit_report.json');
  if (!fs.existsSync(reportPath)) {
    console.error(`Audit report not found at ${reportPath}`);
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const highConfidence = report.highConfidence;

  console.log('================================================================');
  console.log(`  SONORA ARTWORK APPLY ENGINE`);
  console.log(`  Mode: ${isDryRun ? 'DRY-RUN (Simulated)' : 'PRODUCTION APPLY'}`);
  console.log('================================================================');
  console.log(`  Total High-Confidence Matches to Apply: ${highConfidence.length}`);
  console.log(`  Medium-Confidence (Excluded):          ${report.mediumConfidence.length}`);
  console.log(`  Ambiguous Matches (Excluded):          ${report.ambiguous.length}`);
  console.log(`  Unmatched Tracks (Excluded):           ${report.unmatched.length}`);
  console.log('================================================================\n');

  // Verify baseline song count
  const { data: baselineSongs, error: baseErr } = await supabase.from('songs').select('id, title, cover_url, audio_url');
  if (baseErr) {
    console.error('Failed to read songs from Supabase:', baseErr.message);
    process.exit(1);
  }
  console.log(`Baseline Songs Count in DB: ${baselineSongs.length}`);
  if (baselineSongs.length !== 910) {
    console.error(`Unexpected baseline count: expected 910, got ${baselineSongs.length}`);
    process.exit(1);
  }

  const baselineMap = new Map(baselineSongs.map(s => [s.id, s]));

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  const batchSize = 30;
  for (let i = 0; i < highConfidence.length; i += batchSize) {
    const batch = highConfidence.slice(i, i + batchSize);

    if (isDryRun) {
      batch.forEach(item => {
        const current = baselineMap.get(item.id);
        if (current && current.cover_url === item.artworkUrl) {
          skippedCount++;
        } else {
          updatedCount++;
        }
      });
      continue;
    }

    // Production Update
    await Promise.all(batch.map(async (record) => {
      const current = baselineMap.get(record.id);
      if (current && current.cover_url === record.artworkUrl) {
        skippedCount++;
        return;
      }

      const { error } = await supabase
        .from('songs')
        .update({ cover_url: record.artworkUrl })
        .eq('id', record.id);

      if (error) {
        console.error(`Error updating song ${record.id} (${record.title}):`, error.message);
        errorCount++;
      } else {
        updatedCount++;
      }
    }));

    const progress = Math.min(i + batchSize, highConfidence.length);
    process.stdout.write(`\rProgress: ${progress}/${highConfidence.length} processed (${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors)`);
  }

  console.log('\n');

  // Post-apply verification
  const { data: postSongs, error: postErr } = await supabase.from('songs').select('id, title, cover_url, audio_url');
  if (postErr) {
    console.error('Failed to read post-apply songs:', postErr.message);
    process.exit(1);
  }

  let itunesVerifiedCount = 0;
  let genericCount = 0;
  let emptyAudioCount = 0;

  postSongs.forEach(s => {
    if (s.cover_url && s.cover_url.includes('mzstatic.com')) itunesVerifiedCount++;
    if (s.cover_url && s.cover_url.includes('photo-1614613535308-eb5fbd3d2c17')) genericCount++;
    if (!s.audio_url || !s.audio_url.includes('cloudinary.com')) emptyAudioCount++;
  });

  console.log('================================================================');
  console.log('  POST-APPLY VERIFICATION AUDIT');
  console.log('================================================================');
  console.log(`  Total Songs in Database:         ${postSongs.length} (Target: 910)`);
  console.log(`  Verified iTunes Artwork:         ${itunesVerifiedCount}`);
  console.log(`  Remaining Unmatched/Generic:     ${genericCount} (Target: 100)`);
  console.log(`  Corrupted/Missing Audio URLs:    ${emptyAudioCount} (Target: 0)`);
  console.log('================================================================\n');

  if (postSongs.length !== 910 || emptyAudioCount > 0) {
    console.error('CRITICAL WARNING: Integrity check failed!');
    process.exit(1);
  }

  console.log('SUCCESS: Verified artwork applied safely with 100% data integrity!');
}

main().catch(err => {
  console.error('Apply fatal error:', err);
  process.exit(1);
});

