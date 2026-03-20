import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * isMockMode = true when Supabase credentials are not configured.
 * The app will run with local mock data so you can preview the UI
 * before connecting a real Supabase project.
 */
export const isMockMode = !supabaseUrl || !supabaseAnonKey;

// In mock mode we still create a client instance so imports don't break,
// but all actual network calls are guarded by isMockMode checks.
export const supabase = createClient(
  isMockMode ? 'https://placeholder.supabase.co' : supabaseUrl,
  isMockMode ? 'placeholder-anon-key' : supabaseAnonKey,
);
