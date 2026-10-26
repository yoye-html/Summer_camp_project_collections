import { createClient } from '@supabase/supabase-js';

// Environment variables from Vite .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    '[BleNe] Missing Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Running in demo / unconfigured mode. Set these variables in .env.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
