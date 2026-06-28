import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

// Build-25 crash hunt: the whole Supabase init runs at module load (imported via auth -> _layout),
// so if anything here throws it kills app startup before any error handler is set. Wrap EVERYTHING
// (the URL polyfill, the supabase-js import, and createClient) so a failure can never crash the app
// — instead we capture the message in `supabaseInitError` and the app shows it on screen.
export let supabaseInitError: string | null = null;

let client: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-url-polyfill/auto');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@supabase/supabase-js');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    supabaseInitError = 'Missing SUPABASE_URL / SUPABASE_ANON_KEY at runtime (env not inlined?).';
  } else {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
} catch (error: any) {
  supabaseInitError = String(error?.message || error || 'unknown supabase init error').slice(0, 700);
  // eslint-disable-next-line no-console
  console.warn('[supabase] init failed:', error);
}

export const supabase: any = client;

export function isSupabaseConfigured() {
  return !!supabase;
}
