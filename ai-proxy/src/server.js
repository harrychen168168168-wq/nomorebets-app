import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { URL } from 'node:url';

async function loadDotEnv() {
  try {
    const raw = await fs.readFile('.env', 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env is optional in hosted environments.
  }
}

await loadDotEnv();

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function parseAddonPacks() {
  const packs = new Map();

  for (const entry of splitList(process.env.AI_ADDON_PACKS)) {
    const [productId, creditCents] = entry.split(':').map((part) => part.trim());
    const cents = Number(creditCents);
    if (productId && Number.isFinite(cents) && cents > 0) packs.set(productId, cents);
  }

  const fixedPacks = [
    ['AI_ADDON_10_PRODUCT_IDS', 'AI_ADDON_10_CREDIT_CENTS', 300],
    ['AI_ADDON_20_PRODUCT_IDS', 'AI_ADDON_20_CREDIT_CENTS', 600],
    ['AI_ADDON_50_PRODUCT_IDS', 'AI_ADDON_50_CREDIT_CENTS', 1500],
  ];

  for (const [idsKey, centsKey, fallbackCents] of fixedPacks) {
    const cents = readNumber(centsKey, fallbackCents);
    for (const productId of splitList(process.env[idsKey])) {
      if (cents > 0) packs.set(productId, cents);
    }
  }

  return packs;
}

const config = {
  port: readNumber('PORT', 8787),
  enabled: process.env.AI_ENABLED !== 'false',
  provider: (process.env.AI_PROVIDER || 'openai').toLowerCase(),
  openaiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  groqKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  requireRevenueCatPro: process.env.REQUIRE_REVENUECAT_PRO !== 'false',
  revenueCatSecretKey: process.env.REVENUECAT_SECRET_KEY || '',
  revenueCatEntitlementId: process.env.REVENUECAT_ENTITLEMENT_ID || 'NO MORE BETS Pro',
  monthlyProductIds: splitList(process.env.MONTHLY_PRODUCT_IDS),
  annualProductIds: splitList(process.env.ANNUAL_PRODUCT_IDS),
  mutualProductIds: splitList(process.env.MUTUAL_PRODUCT_IDS),
  monthlyAiLimit: readNumber('MONTHLY_AI_LIMIT', 50),
  annualMonthlyAiLimit: readNumber('ANNUAL_MONTHLY_AI_LIMIT', 100),
  addonPacks: parseAddonPacks(),
  globalMonthlyBudgetCents: readNumber('GLOBAL_MONTHLY_BUDGET_CENTS', 500),
  reservedCostCents: readNumber('RESERVED_COST_PER_AI_CALL_CENTS', 1),
  maxOutputTokens: readNumber('MAX_OUTPUT_TOKENS', 180),
  maxInputChars: readNumber('MAX_INPUT_CHARS', 1800),
  maxMessages: readNumber('MAX_MESSAGES', 12),
  appSecret: process.env.APP_PROXY_SHARED_SECRET || '',
  usageStorePath: process.env.USAGE_STORE_PATH || './data/usage-ledger.json',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  useSupabaseAiGroups: process.env.USE_SUPABASE_AI_GROUPS === 'true',
};

const replies = {
  aiDisabled: 'AI is temporarily off. Please use the local emergency steps first.',
  missingUser: 'Please sign in before using AI.',
  emptyMessage: 'Please type how you feel right now.',
  proRequired: 'AI is available only for active Pro members.',
  unknownPlan: 'AI is not enabled for this product yet. Please contact support.',
  addonRequired: 'Your monthly AI chats and add-on credit are used. Please buy another AI add-on pack to continue.',
  globalBudget: 'AI is paused by the monthly safety budget. Local support is still available.',
  unauthorized: 'AI is temporarily unavailable.',
  crisis:
    'Your safety matters most right now. Step away from danger, contact a real person immediately, and call 988 or 911 if you may hurt yourself or someone else.',
  local:
    'I hear you. Pause for 5 minutes, move money away from reach, drink water, and message one trusted person now.',
  chase:
    'Trying to win it back is the danger signal. Stop for 5 minutes, move money away, and make no gambling decision today.',
  payday:
    'Payday can trigger urges. Move part of the money to a safe account or ask family to hold it before the urge grows.',
  pressure:
    'The pressure is real, but gambling makes it heavier. Take three slow breaths, walk outside for 10 minutes, and let the urge pass.',
};

const crisisKeywords = [
  'suicide',
  'kill myself',
  'hurt myself',
  'hurt someone',
  'end my life',
  'i want to die',
  'self harm',
  'zisha',
  'zi sha',
];

function todayMonth(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function isCrisisText(text) {
  const lower = String(text || '').toLowerCase();
  return crisisKeywords.some((keyword) => lower.includes(keyword));
}

function localSupportReply(text) {
  const lower = String(text || '').toLowerCase();
  if (isCrisisText(lower)) return replies.crisis;
  if (lower.includes('win back') || lower.includes('chase') || lower.includes('recover loss')) {
    return replies.chase;
  }
  if (lower.includes('payday') || lower.includes('salary') || lower.includes('money')) {
    return replies.payday;
  }
  if (lower.includes('pressure') || lower.includes('stress') || lower.includes('anxiety')) {
    return replies.pressure;
  }
  return replies.local;
}

function safeText(value, maxChars = config.maxInputChars) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .slice(-config.maxMessages)
    .map((message) => {
      const role = message?.role === 'assistant' ? 'assistant' : 'user';
      return { role, content: safeText(message?.content || message?.text || '') };
    })
    .filter((message) => message.content);
}

function latestUserText(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') return messages[index].content;
  }
  return '';
}

async function readLedger() {
  try {
    const raw = await fs.readFile(config.usageStorePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: parsed.users || {},
      global: parsed.global || {},
    };
  } catch {
    return { users: {}, global: {} };
  }
}

async function writeLedger(ledger) {
  await fs.mkdir(path.dirname(config.usageStorePath), { recursive: true });
  await fs.writeFile(config.usageStorePath, JSON.stringify(ledger, null, 2), 'utf8');
}

// Serialize all read-modify-write access to the usage ledger. The proxy is single-instance, so
// chaining every withLedger call through one promise prevents two concurrent AI requests from
// reading the same ledger and overwriting each other (which would let users bypass quota/budget).
let ledgerLock = Promise.resolve();

async function withLedger(update) {
  const run = ledgerLock.then(async () => {
    const ledger = await readLedger();
    const result = await update(ledger);
    await writeLedger(ledger);
    return result;
  });
  ledgerLock = run.then(() => undefined, () => undefined);
  return run;
}

function ensureUserUsage(ledger, appUserId) {
  ledger.users[appUserId] ||= {
    monthly: {},
    addonCreditCents: 0,
    grantedTransactions: {},
  };
  ledger.users[appUserId].monthly ||= {};
  ledger.users[appUserId].grantedTransactions ||= {};
  ledger.users[appUserId].addonCreditCents ||= 0;
  return ledger.users[appUserId];
}

function ensureGlobalUsage(ledger, month) {
  ledger.global ||= {};
  ledger.global[month] ||= { calls: 0, reservedCents: 0 };
  return ledger.global[month];
}

function resolvePlan(productId) {
  if (productId && config.mutualProductIds.includes(productId)) return { type: 'mutual', productId };
  if (productId && config.annualProductIds.includes(productId)) return { type: 'annual', productId };
  if (productId && config.monthlyProductIds.includes(productId)) return { type: 'monthly', productId };
  return { type: 'unknown', productId: productId || '' };
}

async function supabaseRest(pathname) {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) return null;
  const response = await fetch(config.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + pathname, {
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) return null;
  return response.json();
}

function findActiveSubscriptionProductId(subscriptions) {
  const now = Date.now();
  const activeIds = [];
  for (const [productId, subscription] of Object.entries(subscriptions || {})) {
    const expires = subscription?.expires_date ? new Date(subscription.expires_date) : null;
    if (!expires || !Number.isFinite(expires.getTime()) || expires.getTime() > now) activeIds.push(productId);
  }
  const mutual = activeIds.find((productId) => config.mutualProductIds.includes(productId));
  if (mutual) return mutual;
  const annual = activeIds.find((productId) => config.annualProductIds.includes(productId));
  if (annual) return annual;
  const monthly = activeIds.find((productId) => config.monthlyProductIds.includes(productId));
  if (monthly) return monthly;
  return activeIds[0] || '';
}

function collectAddonGrants(subscriber) {
  const grants = [];
  const purchasesByProduct = subscriber?.non_subscriptions || {};

  for (const [productId, purchases] of Object.entries(purchasesByProduct)) {
    const creditCents = config.addonPacks.get(productId);
    if (!creditCents || !Array.isArray(purchases)) continue;

    for (const purchase of purchases) {
      if (purchase?.refunded_at) continue;
      const transactionId = [
        productId,
        purchase?.id ||
          purchase?.store_transaction_id ||
          purchase?.transaction_id ||
          purchase?.purchase_date ||
          purchase?.original_purchase_date ||
          JSON.stringify(purchase),
      ].join(':');

      grants.push({
        productId,
        transactionId,
        creditCents,
      });
    }
  }

  return grants;
}

async function verifyMembership(appUserId) {
  if (!config.requireRevenueCatPro) {
    return { ok: true, reason: 'disabled', plan: { type: 'annual', productId: 'local_test' }, quotaKey: appUserId, addonGrants: [] };
  }

  if (!config.revenueCatSecretKey) return { ok: false, reason: 'missing_revenuecat_secret' };

  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      Authorization: `Bearer ${config.revenueCatSecretKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) return { ok: false, reason: `revenuecat_${response.status}` };

  const data = await response.json();
  const subscriber = data?.subscriber || {};
  const entitlements = subscriber.entitlements || {};
  const entitlement = entitlements[config.revenueCatEntitlementId];

  if (!entitlement) return { ok: false, reason: 'no_entitlement' };

  const expires = entitlement.expires_date ? new Date(entitlement.expires_date) : null;
  if (expires && Number.isFinite(expires.getTime()) && expires.getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  const productId = entitlement.product_identifier || findActiveSubscriptionProductId(subscriber.subscriptions);
  return {
    ok: true,
    reason: 'active',
    productId,
    plan: resolvePlan(productId),
    quotaKey: appUserId,
    addonGrants: collectAddonGrants(subscriber),
  };
}

async function verifySharedMembership(appUserId) {
  if (!config.useSupabaseAiGroups) return { ok: false, reason: 'supabase_ai_groups_disabled' };
  const links = await supabaseRest(
    'guardian_links?select=*&status=eq.active&or=(owner_user_id.eq.' + encodeURIComponent(appUserId) + ',member_user_id.eq.' + encodeURIComponent(appUserId) + ')&limit=5'
  );
  if (!Array.isArray(links) || links.length === 0) return { ok: false, reason: 'no_guardian_link' };

  for (const link of links) {
    const ownerUserId = String(link.owner_user_id || '');
    const memberUserId = String(link.member_user_id || '');
    const membershipRows = await supabaseRest('subscription_memberships?select=*&app_user_id=eq.' + encodeURIComponent(ownerUserId) + '&status=eq.active&limit=1');
    let membership = Array.isArray(membershipRows) ? membershipRows[0] : null;
    let ownerPlan = membership ? { type: membership.plan_type, productId: membership.product_id || '' } : null;
    if (membership) {
      const expires = membership.expires_at ? new Date(membership.expires_at) : null;
      if (expires && Number.isFinite(expires.getTime()) && expires.getTime() < Date.now()) continue;
    } else {
      const directOwner = await verifyMembership(ownerUserId);
      if (!directOwner.ok) continue;
      ownerPlan = directOwner.plan;
      membership = { product_id: directOwner.productId || ownerPlan.productId || '' };
    }

    if (link.type === 'family' && ownerPlan?.type === 'annual') {
      return {
        ok: true,
        reason: 'family_guardian_shared',
        productId: membership.product_id,
        plan: { type: 'annual', productId: membership.product_id || 'family_guardian' },
        quotaKey: String(link.ai_quota_group_id || ownerUserId),
        addonGrants: [],
      };
    }

    if (link.type === 'mutual' && ownerPlan?.type === 'mutual') {
      return {
        ok: true,
        reason: 'mutual_guardian_shared',
        productId: membership.product_id,
        plan: { type: 'mutual', productId: membership.product_id || 'mutual_guardian' },
        quotaKey: appUserId === ownerUserId ? ownerUserId : memberUserId,
        addonGrants: [],
      };
    }
  }

  return { ok: false, reason: 'no_active_shared_membership' };
}

function applyAddonGrants(userUsage, addonGrants) {
  const applied = [];
  for (const grant of addonGrants || []) {
    if (userUsage.grantedTransactions[grant.transactionId]) continue;
    userUsage.grantedTransactions[grant.transactionId] = {
      productId: grant.productId,
      creditCents: grant.creditCents,
      grantedAt: new Date().toISOString(),
    };
    userUsage.addonCreditCents += grant.creditCents;
    applied.push(grant);
  }
  return applied;
}

function buildUsage(plan, monthUsage, userUsage, globalUsage) {
  const addonCreditCentsRemaining = Math.max(0, userUsage.addonCreditCents || 0);
  const monthlyLimit = plan.type === 'monthly' ? config.monthlyAiLimit : plan.type === 'annual' || plan.type === 'mutual' ? config.annualMonthlyAiLimit : 0;
  return {
    plan: plan.type,
    monthlyLimit,
    monthlyUsed: monthUsage.baseCalls || 0,
    monthlyRemaining: Math.max(0, monthlyLimit - (monthUsage.baseCalls || 0)),
    addonCreditCentsRemaining,
    usingAddonBeforeMonthlyQuota: addonCreditCentsRemaining > 0,
    globalBudgetRemainingCents: Math.max(0, config.globalMonthlyBudgetCents - globalUsage.reservedCents),
  };
}

async function reserveAiUse(quotaKey, plan, addonGrants) {
  return withLedger(async (ledger) => {
    const month = todayMonth();
    const userUsage = ensureUserUsage(ledger, quotaKey);
    const globalUsage = ensureGlobalUsage(ledger, month);
    userUsage.monthly[month] ||= { baseCalls: 0, addonCalls: 0, reservedCents: 0 };
    const monthUsage = userUsage.monthly[month];

    applyAddonGrants(userUsage, addonGrants);

    const monthlyLimit = plan.type === 'monthly' ? config.monthlyAiLimit : plan.type === 'annual' || plan.type === 'mutual' ? config.annualMonthlyAiLimit : 0;

    if (monthlyLimit <= 0) {
      return {
        ok: false,
        status: 403,
        code: 'unknown_product',
        message: replies.unknownPlan,
        usage: buildUsage(plan, monthUsage, userUsage, globalUsage),
      };
    }

    if (globalUsage.reservedCents + config.reservedCostCents > config.globalMonthlyBudgetCents) {
      return {
        ok: false,
        status: 503,
        code: 'global_budget_limit',
        message: replies.globalBudget,
        usage: buildUsage(plan, monthUsage, userUsage, globalUsage),
      };
    }

    let source = '';
    if (userUsage.addonCreditCents >= config.reservedCostCents) {
      userUsage.addonCreditCents -= config.reservedCostCents;
      monthUsage.addonCalls = (monthUsage.addonCalls || 0) + 1;
      source = 'addon_credit';
    } else if (monthUsage.baseCalls < monthlyLimit) {
      monthUsage.baseCalls += 1;
      source = plan.type + '_monthly_quota';
    } else {
      return {
        ok: false,
        status: 402,
        code: 'addon_required',
        message: replies.addonRequired,
        usage: buildUsage(plan, monthUsage, userUsage, globalUsage),
      };
    }

    monthUsage.reservedCents = (monthUsage.reservedCents || 0) + config.reservedCostCents;
    globalUsage.calls += 1;
    globalUsage.reservedCents += config.reservedCostCents;

    return {
      ok: true,
      reservation: { month, source, reservedCostCents: config.reservedCostCents },
      usage: {
        ...buildUsage(plan, monthUsage, userUsage, globalUsage),
        billedTo: source,
      },
    };
  });
}

async function refundAiUse(quotaKey, reservation) {
  if (!reservation) return;
  await withLedger(async (ledger) => {
    const userUsage = ensureUserUsage(ledger, quotaKey);
    const globalUsage = ensureGlobalUsage(ledger, reservation.month);
    const monthUsage = userUsage.monthly[reservation.month];
    if (!monthUsage) return {};

    if (String(reservation.source || '').endsWith('_monthly_quota')) {
      monthUsage.baseCalls = Math.max(0, (monthUsage.baseCalls || 0) - 1);
    } else if (reservation.source === 'addon_credit') {
      monthUsage.addonCalls = Math.max(0, (monthUsage.addonCalls || 0) - 1);
      userUsage.addonCreditCents = (userUsage.addonCreditCents || 0) + reservation.reservedCostCents;
    }

    monthUsage.reservedCents = Math.max(0, (monthUsage.reservedCents || 0) - reservation.reservedCostCents);
    globalUsage.calls = Math.max(0, (globalUsage.calls || 0) - 1);
    globalUsage.reservedCents = Math.max(0, (globalUsage.reservedCents || 0) - reservation.reservedCostCents);
    return {};
  });
}

async function callOpenAI(messages) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openaiModel,
      messages,
      temperature: 0.4,
      max_tokens: config.maxOutputTokens,
    }),
  });

  if (!response.ok) throw new Error(`openai_${response.status}`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callGroq(messages) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.groqModel,
      messages,
      temperature: 0.4,
      max_tokens: config.maxOutputTokens,
    }),
  });

  if (!response.ok) throw new Error(`groq_${response.status}`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callAI(userMessages) {
  const systemPrompt = [
    'You are a short, warm Chinese gambling-recovery support assistant.',
    'Do not provide medical diagnosis, therapy, financial advice, or emergency services.',
    'Keep replies under 120 Chinese characters.',
    'For self-harm, harm-to-others, or immediate danger, tell the user to contact real people and call 988 or 911.',
    'Focus on delaying urges, moving money away, contacting support, and one next action.',
  ].join(' ');

  const messages = [{ role: 'system', content: systemPrompt }, ...userMessages];

  if (config.provider === 'groq') {
    if (!config.groqKey) throw new Error('missing_groq_key');
    return callGroq(messages);
  }

  if (!config.openaiKey) throw new Error('missing_openai_key');
  return callOpenAI(messages);
}

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 16 * 1024) throw new Error('body_too_large');
  }
  return body ? JSON.parse(body) : {};
}

function requireAppSecret(req, res) {
  if (!config.appSecret) return true;
  if (req.headers['x-app-secret'] === config.appSecret) return true;
  json(res, 401, { reply: replies.unauthorized, error: 'unauthorized' });
  return false;
}

async function handleChat(req, res) {
  let body = {};
  let appUserId = '';
  let quotaKey = '';
  let reservation = null;

  try {
    if (!requireAppSecret(req, res)) return;
    body = await readJsonBody(req);

    if (!config.enabled) {
      json(res, 503, { reply: replies.aiDisabled, error: 'ai_disabled' });
      return;
    }

    appUserId = safeText(body?.appUserId, 128);
    if (!appUserId) {
      json(res, 400, { reply: replies.missingUser, error: 'missing_app_user_id' });
      return;
    }

    const messages = normalizeMessages(body?.messages);
    const text = latestUserText(messages);
    if (!text) {
      json(res, 400, { reply: replies.emptyMessage, error: 'empty_message' });
      return;
    }

    if (isCrisisText(text)) {
      json(res, 200, { reply: replies.crisis, source: 'crisis_local', usageFree: true });
      return;
    }

    let membership = await verifyMembership(appUserId);
    if (!membership.ok) {
      const sharedMembership = await verifySharedMembership(appUserId);
      if (sharedMembership.ok) membership = sharedMembership;
    }
    if (!membership.ok) {
      json(res, 402, {
        reply: replies.proRequired,
        error: 'pro_required',
        reason: membership.reason,
      });
      return;
    }

    quotaKey = membership.quotaKey || appUserId;
    const budget = await reserveAiUse(quotaKey, membership.plan, membership.addonGrants);
    if (!budget.ok) {
      json(res, budget.status, {
        reply: budget.message,
        error: budget.code,
        fallback: localSupportReply(text),
        usage: { ...budget.usage, quotaKey },
        needsAddon: budget.code === 'addon_required',
      });
      return;
    }

    reservation = budget.reservation;
    const reply = safeText(await callAI(messages), 500) || localSupportReply(text);
    json(res, 200, { reply, source: config.provider, usage: { ...budget.usage, quotaKey } });
  } catch (error) {
    console.error('[ai/chat]', error);
    await refundAiUse(quotaKey || appUserId, reservation);
    const fallback = localSupportReply(latestUserText(normalizeMessages(body?.messages)));
    json(res, 502, { reply: fallback, error: 'ai_backend_failed' });
  }
}

function handleHealth(res) {
  json(res, 200, {
    ok: true,
    aiEnabled: config.enabled,
    provider: config.provider,
    requireRevenueCatPro: config.requireRevenueCatPro,
    monthlyAiAllowed: true,
    monthlyAiLimit: config.monthlyAiLimit,
    annualMonthlyAiLimit: config.annualMonthlyAiLimit,
    mutualMonthlyAiLimit: config.annualMonthlyAiLimit,
    useSupabaseAiGroups: config.useSupabaseAiGroups,
    addonPackCount: config.addonPacks.size,
    globalMonthlyBudgetCents: config.globalMonthlyBudgetCents,
    reservedCostPerAiCallCents: config.reservedCostCents,
  });
}

// Lightweight gate check for the app's subscription wall. Does NOT consume AI quota.
// Returns whether this user may use the app: their own active subscription, or (for an invited
// guardian member) the payer's live subscription. Reuses the same checks as /ai/chat, so access
// always follows the payer's real subscription and stops the moment it lapses.
async function handleAccess(req, res, url) {
  if (!requireAppSecret(req, res)) return;
  const appUserId = safeText(url.searchParams.get('appUserId'), 128);
  if (!appUserId) {
    json(res, 400, { hasAccess: false, error: 'missing_app_user_id' });
    return;
  }
  try {
    let membership = await verifyMembership(appUserId);
    let source = 'own';
    if (!membership.ok) {
      membership = await verifySharedMembership(appUserId);
      source = 'shared';
    }
    if (!membership.ok) {
      json(res, 200, { hasAccess: false, reason: membership.reason });
      return;
    }
    json(res, 200, { hasAccess: true, source, plan: membership.plan?.type || 'unknown' });
  } catch (error) {
    console.error('[access]', error);
    json(res, 200, { hasAccess: false, error: 'access_check_failed' });
  }
}

if (process.argv.includes('--check')) {
  console.log('Config OK');
  process.exit(0);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end();
    return;
  }
  if (req.method === 'GET' && url.pathname === '/health') {
    handleHealth(res);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/access') {
    await handleAccess(req, res, url);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/ai/chat') {
    await handleChat(req, res);
    return;
  }
  json(res, 404, { error: 'not_found' });
});

server.listen(config.port, () => {
  console.log(`NoMoreBets AI proxy listening on :${config.port}`);
});
