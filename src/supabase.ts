import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

// Single Supabase client for the whole app. Auth sessions are persisted in AsyncStorage and
// auto-refreshed, so a logged-in user stays signed in across app restarts. The session JWT is
// attached to every PostgREST request, which is what makes the per-user RLS policies (user_id =
// auth.uid()) actually isolate each account's data.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // We use native sign-in (Apple/Google id tokens, email/password), not the URL redirect flow.
    detectSessionInUrl: false,
  },
});

export function isSupabaseConfigured() {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}
