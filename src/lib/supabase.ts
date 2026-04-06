import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dinbwugbwnkrzljuocbs.supabase.co';
const supabaseAnonKey = 'sb_publishable_XQXGJDPXCEsMkk_xr6ok7A_xw9ZK6WQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
