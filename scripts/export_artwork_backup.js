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

async function exportBackup() {
  console.log('Querying all 910 songs from Supabase for safety backup...');
  
  const { data: songs, count, error } = await supabase
    .from('songs')
    .select('id, title, artist_name, album_name, cover_url, audio_url, cloudinary_public_id, cloudinary_asset_id, genre, duration, release_year, created_at', { count: 'exact' })
    .order('created_at', { ascending: true });

  if (error || !songs) {
    console.error('Failed to export songs backup:', error);
    process.exit(1);
  }

  const backupData = {
    exportedAt: new Date().toISOString(),
    totalSongs: count,
    songs: songs,
  };

  const backupPath = path.resolve(__dirname, 'backup_songs_artwork_before_update.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8');

  console.log(`[BACKUP SUCCESS] Successfully exported ${count} songs to:`);
  console.log(`  -> ${backupPath}`);
  console.log(`  File size: ${(fs.statSync(backupPath).size / 1024).toFixed(1)} KB`);
}

exportBackup().catch(err => {
  console.error('Backup error:', err);
  process.exit(1);
});

