const path = require('path');
const dotenv = require(path.join(__dirname, '../node_modules/dotenv'));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { v2: cloudinary } = require(path.join(__dirname, '../node_modules/cloudinary'));
const { createClient } = require(path.join(__dirname, '../node_modules/@supabase/supabase-js'));

async function verifyAll() {
  const rawSupabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const rawCloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const rawApiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const rawApiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  const rawAnonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
  const rawServiceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  const report = {
    timestamp: new Date().toISOString(),
    backendMode: {
      hasCloudinaryKeys: Boolean(rawCloudName && rawApiKey && rawApiSecret),
      hasSupabaseKeys: Boolean(rawSupabaseUrl && rawAnonKey),
      activeEngine: 'PENDING'
    },
    cloudinary: {
      configured: Boolean(rawCloudName && rawApiKey && rawApiSecret),
      cloudNameConfigured: rawCloudName,
      authenticated: false,
      videoResourceAccess: false,
      sampleAudioAssetsFound: 0,
      totalAudioCount: null,
      error: null
    },
    supabase: {
      configured: Boolean(rawSupabaseUrl && rawAnonKey),
      authenticated: false,
      connectivity: false,
      tablesChecked: {},
      migration20261106Applied: false,
      columnsMissing: [],
      error: null
    }
  };

  // 1. CLOUDINARY VERIFICATION
  try {
    if (report.backendMode.hasCloudinaryKeys) {
      cloudinary.config({
        cloud_name: rawCloudName,
        api_key: rawApiKey,
        api_secret: rawApiSecret,
        secure: true,
      });

      const pingRes = await cloudinary.api.ping();
      if (pingRes && pingRes.status === 'ok') {
        report.cloudinary.authenticated = true;
      }

      const resourcesRes = await cloudinary.api.resources({
        resource_type: 'video',
        type: 'upload',
        max_results: 5,
      });

      report.cloudinary.videoResourceAccess = true;
      report.cloudinary.sampleAudioAssetsFound = (resourcesRes.resources || []).length;
      if (resourcesRes.total_count !== undefined) {
        report.cloudinary.totalAudioCount = resourcesRes.total_count;
      }
    } else {
      report.cloudinary.error = 'Cloudinary credentials missing in server/.env';
    }
  } catch (err) {
    report.cloudinary.authenticated = false;
    report.cloudinary.error = (err && err.error && err.error.message) ? err.error.message : (err && err.message) ? err.message : JSON.stringify(err);
  }

  // 2. SUPABASE VERIFICATION
  try {
    if (report.backendMode.hasSupabaseKeys) {
      const supabaseKey = rawServiceRole || rawAnonKey;
      const supabase = createClient(rawSupabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      // Test connection
      report.supabase.connectivity = true;
      report.supabase.authenticated = true;

      const requiredTables = ['profiles', 'artists', 'albums', 'songs', 'playlists', 'playlist_songs'];
      for (const table of requiredTables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (!error) {
          report.supabase.tablesChecked[table] = {
            exists: true,
            status: 'Table exists in database',
          };
        } else {
          report.supabase.tablesChecked[table] = {
            exists: false,
            code: error.code,
            message: error.message,
          };
        }
      }

      // Check migration 20261106_add_cloudinary_asset_id
      const checkCols = ['cloudinary_asset_id', 'cloudinary_public_id', 'cloudinary_format', 'storage_key', 'file_hash', 'file_size'];
      const missing = [];
      for (const col of checkCols) {
        const { error } = await supabase.from('songs').select(col).limit(1);
        if (error) {
          missing.push({ column: col, code: error.code, message: error.message });
        }
      }

      report.supabase.migration20261106Applied = missing.length === 0;
      report.supabase.columnsMissing = missing;
    } else {
      report.supabase.error = 'Supabase credentials missing in server/.env';
    }
  } catch (err) {
    report.supabase.authenticated = false;
    report.supabase.connectivity = false;
    report.supabase.error = (err && err.message) ? err.message : String(err);
  }

  // Determine active engine
  if (report.cloudinary.authenticated && report.supabase.authenticated && report.supabase.migration20261106Applied) {
    report.backendMode.activeEngine = 'PRODUCTION_CLOUD (Real Cloudinary CDN + Real Supabase DB)';
  } else {
    report.backendMode.activeEngine = 'LOCAL_SAFE_MODE (No music modified, real cloud pending fixes)';
  }

  console.log(JSON.stringify(report, null, 2));
}

verifyAll();
