import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from './env';

let supabaseClient: SupabaseClient | null = null;
let supabaseAdminClient: SupabaseClient | null = null;

if (ENV.hasSupabase) {
  supabaseClient = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);
  
  if (ENV.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseAdminClient = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } else {
    supabaseAdminClient = supabaseClient;
  }
}

export { supabaseClient, supabaseAdminClient };
