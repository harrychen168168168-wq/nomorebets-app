import { corsHeaders, json, readJson, requireWebhookSecret, rest } from '../_shared/http.ts';

function split(value: string | undefined) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function planForProduct(productId: string) {
  if (split(Deno.env.get('MUTUAL_PRODUCT_IDS')).includes(productId)) return 'mutual';
  if (split(Deno.env.get('ANNUAL_PRODUCT_IDS')).includes(productId)) return 'annual';
  if (split(Deno.env.get('MONTHLY_PRODUCT_IDS')).includes(productId)) return 'monthly';
  const lower = productId.toLowerCase();
  if (lower.includes('mutual') || lower.includes('couple') || lower.includes('duo')) return 'mutual';
  if (lower.includes('year') || lower.includes('annual')) return 'annual';
  if (lower.includes('month')) return 'monthly';
  return 'unknown';
}

function monthlyLimit(plan: string) {
  if (plan === 'monthly') return Number(Deno.env.get('MONTHLY_AI_LIMIT') || 50);
  if (plan === 'annual' || plan === 'mutual') return Number(Deno.env.get('ANNUAL_MONTHLY_AI_LIMIT') || 100);
  return 0;
}

function msToIso(value: unknown) {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secret = requireWebhookSecret(req);
  if (!secret.ok) return json({ error: secret.error }, secret.status);

  try {
    const payload = await readJson(req);
    const event = payload.event || payload;
    const appUserId = String(event.app_user_id || event.original_app_user_id || '');
    const productId = String(event.product_id || event.product_identifier || '');
    const eventId = String(event.id || event.event_id || crypto.randomUUID());
    const type = String(event.type || '').toUpperCase();
    if (!appUserId || !productId) return json({ error: 'missing_app_user_or_product' }, 400);

    const plan = planForProduct(productId);
    const expiresAt = msToIso(event.expiration_at_ms);
    // CANCELLATION / BILLING_ISSUE only mean auto-renew is off or a payment retry is pending;
    // the entitlement stays valid until the expiration date. Only revoke once it has actually
    // expired (or on EXPIRATION / REFUND). This keeps invited family/mutual members from losing
    // shared AI the moment the payer turns off auto-renew.
    const expiredByDate = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
    const revoked = ['EXPIRATION', 'REFUND'].includes(type) || expiredByDate;
    const status = revoked ? 'expired' : 'active';
    const willRenew = typeof event.will_renew === 'boolean' ? event.will_renew : null;

    await rest('subscription_memberships?on_conflict=app_user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ app_user_id: appUserId, product_id: productId, plan_type: plan, status, expires_at: expiresAt, will_renew: willRenew, revenuecat_event_id: eventId, updated_at: new Date().toISOString() }),
    });

    if (plan !== 'unknown') {
      const quotaId = appUserId;
      await rest('ai_quota_groups?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ id: quotaId, owner_user_id: appUserId, plan_type: plan, monthly_limit: monthlyLimit(plan), status, expires_at: expiresAt, updated_at: new Date().toISOString() }),
      });
    }

    return json({ ok: true, appUserId, plan, status });
  } catch (error) {
    console.error('[revenuecat-webhook]', error);
    return json({ error: error instanceof Error ? error.message : 'server_error' }, 500);
  }
});
