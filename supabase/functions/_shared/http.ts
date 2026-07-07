export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function readJson(req: Request) {
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}

function env(name: string) {
  return Deno.env.get(name) || '';
}

// Verify the caller's Supabase login token and confirm their email is on the ADMIN_EMAILS allowlist.
// No shared secret is baked into the app — the admin just uses their normal login; the master key
// never leaves the server.
export async function requireAdmin(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^[Bb]earer\s+/, '');
  if (!token) return { ok: false, status: 401, error: 'unauthorized_admin', email: '', userId: '' };
  let email = '';
  let userId = '';
  try {
    const res = await fetch(env('SUPABASE_URL').replace(/\/$/, '') + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: env('SUPABASE_ANON_KEY') },
    });
    if (!res.ok) return { ok: false, status: 401, error: 'unauthorized_admin', email: '', userId: '' };
    const user = await res.json();
    email = String(user?.email || '').trim().toLowerCase();
    userId = String(user?.id || '');
  } catch {
    return { ok: false, status: 401, error: 'unauthorized_admin', email: '', userId: '' };
  }
  const allow = env('ADMIN_EMAILS').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!allow.length) return { ok: false, status: 500, error: 'missing_admin_allowlist', email, userId };
  if (!email || !allow.includes(email)) return { ok: false, status: 403, error: 'forbidden_admin', email, userId };
  return { ok: true, status: 200, error: '', email, userId };
}

export function requireWebhookSecret(req: Request) {
  const secret = env('REVENUECAT_WEBHOOK_SECRET');
  if (!secret) return { ok: false, status: 500, error: 'missing_webhook_secret' };
  const received = req.headers.get('authorization') || req.headers.get('x-revenuecat-secret') || '';
  if (received !== secret && received !== 'Bearer ' + secret) return { ok: false, status: 401, error: 'unauthorized_webhook' };
  return { ok: true, status: 200, error: '' };
}

export async function rest(path: string, init: RequestInit = {}) {
  const url = env('SUPABASE_URL').replace(/\/$/, '') + '/rest/v1/' + path;
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: 'Bearer ' + env('SUPABASE_SERVICE_ROLE_KEY'),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.error || 'supabase_rest_failed');
  return data;
}

export function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  crypto.getRandomValues(new Uint8Array(8)).forEach((value) => {
    code += alphabet[value % alphabet.length];
  });
  return code;
}
