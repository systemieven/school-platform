import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
  },
});

// Process OAuth hash immediately on page load (before React mounts).
// This ensures access_token fragments from OAuth redirects are consumed
// and the session is stored in localStorage before any component renders.
if (window.location.hash.includes('access_token')) {
  supabase.auth.getSession();
}
