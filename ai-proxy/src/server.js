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
  annualMonthlyAiLimit: readNumber('ANNUAL_MONTHLY_AI_LIMIT', 100),
  addonPacks: parseAddonPacks(),
  globalMonthlyBudgetCents: readNumber('GLOBAL_MONTHLY_BUDGET_CENTS', 500),
  reservedCostCents: readNumber('RESERVED_COST_PER_AI_CALL_CENTS', 1),
  maxOutputTokens: readNumber('MAX_OUTPUT_TOKENS', 180),
  maxInputChars: readNumber('MAX_INPUT_CHARS', 1800),
  maxMessages: readNumber('MAX_MESSAGES', 12),
  appSecret: process.env.APP_PROXY_SHARED_SECRET || '',
  usageStorePath: process.env.USAGE_STORE_PATH || './data/usage-ledger.json',
};

const replies = {
  aiDisabled: 'AI is temporarily off. Please use the local emergency steps first.',
  missingUser: 'Please sign in before using AI.',
  emptyMessage: 'Please type how you feel right now.',
  proRequired: 'AI is available only for active annual Pro members.',
  monthlyNoAi: 'Monthly Pro includes basic features, but AI requires annual Pro.',
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

async function withLedger(update) {
  const ledger = await readLedger();
  const result = await update(ledger);
  await writeLedger(ledger);
  return result;
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
  if (productId && config.annualProductIds.includes(productId)) return { type: 'annual', productId };
  if (productId && config.monthlyProductIds.includes(productId)) return { type: 'monthly', productId };
  return { type: 'unknown', productId: productId || '' };
}

function findActiveSubscriptionProductId(subscriptions) {
  const now = Date.now();
  const activeIds = [];
  for (const [productId, subscription] of Object.entries(subscriptions || {})) {
    const expires = subscription?.expires_date ? new Date(subscription.expires_date) : null;
    if (!expires || !Number.isFinite(expires.getTime()) || expires.getTime() > now) activeIds.push(productId);
  }
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
    return { ok: true, reason: 'disabled', plan: { type: 'annual', productId: 'local_test' }, addonGrants: [] };
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
    addonGrants: collectAddonGrants(subscriber),
  };
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
  return {
    plan: plan.type,
    monthlyLimit: plan.type === 'annual' ? config.annualMonthlyAiLimit : 0,
    monthlyUsed: monthUsage.baseCalls || 0,
    monthlyRemaining:
      plan.type === 'annual'
        ? Math.max(0, config.annualMonthlyAiLimit - (monthUsage.baseCalls || 0))
        : 0,
    addonCreditCentsRemaining,
    usingAddonBeforeMonthlyQuota: addonCreditCentsRemaining > 0,
    globalBudgetRemainingCents: Math.max(0, config.globalMonthlyBudgetCents - globalUsage.reservedCents),
  };
}

async function reserveAiUse(appUserId, plan, addonGrants) {
  return withLedger(async (ledger) => {
    const month = todayMonth();
    const userUsage = ensureUserUsage(ledger, appUserId);
    const globalUsage = ensureGlobalUsage(ledger, month);
    userUsage.monthly[month] ||= { baseCalls: 0, addonCalls: 0, reservedCents: 0 };
    const monthUsage = userUsage.monthly[month];

    applyAddonGrants(userUsage, addonGrants);

    if (plan.type === 'monthly') {
      return {
        ok: false,
        status: 403,
        code: 'monthly_plan_no_ai',
        message: replies.monthlyNoAi,
        usage: buildUsage(plan, monthUsage, userUsage, globalUsage),
      };
    }

    if (plan.type !== 'annual') {
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
    } else if (monthUsage.baseCalls < config.annualMonthlyAiLimit) {
      monthUsage.baseCalls += 1;
      source = 'annual_monthly_quota';
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

async function refundAiUse(appUserId, reservation) {
  if (!reservation) return;
  await withLedger(async (ledger) => {
    const userUsage = ensureUserUsage(ledger, appUserId);
    const globalUsage = ensureGlobalUsage(ledger, reservation.month);
    const monthUsage = userUsage.monthly[reservation.month];
    if (!monthUsage) return {};

    if (reservation.source === 'annual_monthly_quota') {
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

    const membership = await verifyMembership(appUserId);
    if (!membership.ok) {
      json(res, 402, {
        reply: replies.proRequired,
        error: 'annual_pro_required',
        reason: membership.reason,
      });
      return;
    }

    const budget = await reserveAiUse(appUserId, membership.plan, membership.addonGrants);
    if (!budget.ok) {
      json(res, budget.status, {
        reply: budget.message,
        error: budget.code,
        fallback: localSupportReply(text),
        usage: budget.usage,
        needsAddon: budget.code === 'addon_required',
      });
      return;
    }

    reservation = budget.reservation;
    const reply = safeText(await callAI(messages), 500) || localSupportReply(text);
    json(res, 200, { reply, source: config.provider, usage: budget.usage });
  } catch (error) {
    console.error('[ai/chat]', error);
    await refundAiUse(appUserId, reservation);
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
    monthlyAiAllowed: false,
    annualMonthlyAiLimit: config.annualMonthlyAiLimit,
    addonPackCount: config.addonPacks.size,
    globalMonthlyBudgetCents: config.globalMonthlyBudgetCents,
    reservedCostPerAiCallCents: config.reservedCostCents,
  });
}

if (process.argv.includes('--check')) {
  console.log('Config OK');
  process.exit(0);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return;
  }
  if (req.method === 'GET' && url.pathname === '/health') {
    handleHealth(res);
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
