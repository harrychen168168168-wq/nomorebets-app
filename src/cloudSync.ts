import { supabase, isSupabaseConfigured } from './supabase';

// Pure Supabase data access for syncing per-user app data to the cloud. Knows nothing about
// AsyncStorage — storage.ts owns the local cache and calls these to mirror/restore. Every call
// rides the logged-in user's JWT, so RLS (user_id = auth.uid()) enforces isolation server-side;
// we still pass user_id explicitly so inserts satisfy the WITH CHECK policy.

const KV_TABLE = 'user_kv';
const PROFILE_TABLE = 'profiles';

export type CloudKv = { k: string; v: string };

export type CloudProfile = {
  display_name?: string | null;
  avatar_uri?: string | null;
  profile_complete?: boolean | null;
};

function canSync(userId?: string | null): userId is string {
  return isSupabaseConfigured() && !!userId && userId !== 'signed_out';
}

// Pull every key/value this user has in the cloud (used on login / reinstall to restore data).
export async function cloudFetchAll(userId?: string | null): Promise<CloudKv[]> {
  if (!canSync(userId)) return [];
  const { data, error } = await supabase.from(KV_TABLE).select('k,v').eq('user_id', userId);
  if (error) throw error;
  return Array.isArray(data) ? (data as CloudKv[]) : [];
}

export async function cloudUpsert(userId: string | null | undefined, key: string, value: string) {
  if (!canSync(userId)) return;
  const { error } = await supabase
    .from(KV_TABLE)
    .upsert({ user_id: userId, k: key, v: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id,k' });
  if (error) throw error;
}

export async function cloudUpsertMany(userId: string | null | undefined, entries: [string, string][]) {
  if (!canSync(userId) || entries.length === 0) return;
  const now = new Date().toISOString();
  const rows = entries.map(([k, v]) => ({ user_id: userId, k, v, updated_at: now }));
  const { error } = await supabase.from(KV_TABLE).upsert(rows, { onConflict: 'user_id,k' });
  if (error) throw error;
}

export async function cloudRemove(userId: string | null | undefined, keys: string[]) {
  if (!canSync(userId) || keys.length === 0) return;
  const { error } = await supabase.from(KV_TABLE).delete().eq('user_id', userId).in('k', keys);
  if (error) throw error;
}

export async function cloudDeleteAll(userId: string | null | undefined) {
  if (!canSync(userId)) return;
  await supabase.from(KV_TABLE).delete().eq('user_id', userId);
  await supabase.from(PROFILE_TABLE).delete().eq('user_id', userId);
}

export async function cloudGetProfile(userId?: string | null): Promise<CloudProfile | null> {
  if (!canSync(userId)) return null;
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select('display_name,avatar_uri,profile_complete')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as CloudProfile) || null;
}

export async function cloudUpsertProfile(userId: string | null | undefined, profile: CloudProfile) {
  if (!canSync(userId)) return;
  const { error } = await supabase
    .from(PROFILE_TABLE)
    .upsert({ user_id: userId, ...profile, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}
