import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Only the PUBLIC anon key reaches the browser — Row Level Security is what
// actually protects the data (see plan.md §6). The service_role key must never
// live in frontend code or env.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and set ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see Supabase → Settings → API).',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
