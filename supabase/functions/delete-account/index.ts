import { corsHeaders, json } from '../_shared/http.ts';

function env(name: string) {
  return Deno.env.get(name) || '';
}

// Fully delete the caller's own account. App Store 5.1.1(v) requires real account deletion, not
// just clearing data. We identify the caller from THEIR OWN JWT (never a client-sent id) and then
// delete the auth user with the service role — the FK `on delete cascade` removes their profiles
// and user_kv rows. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected into edge functions.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return json({ error: 'missing_token' }, 401);

  const base = env('SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!base || !serviceKey) return json({ error: 'server_misconfigured' }, 500);

  try {
    // Resolve the caller from their token — this is the only id we trust to delete.
    const userRes = await fetch(base + '/auth/v1/user', {
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + jwt },
    });
    if (!userRes.ok) return json({ error: 'invalid_token' }, 401);
    const user = await userRes.json();
    const uid = user?.id;
    if (!uid) return json({ error: 'no_user' }, 401);

    const delRes = await fetch(base + '/auth/v1/admin/users/' + encodeURIComponent(uid), {
      method: 'DELETE',
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey },
    });
    if (!delRes.ok) {
      const detail = await delRes.text();
      return json({ error: 'delete_failed', detail: detail.slice(0, 200) }, 500);
    }
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'server_error' }, 500);
  }
});
