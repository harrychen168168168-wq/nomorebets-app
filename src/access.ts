import { AI_PROXY_URL } from './config';
import { getSubscriptionSnapshot, SubscriptionSnapshot } from './subscription';

// An invited guardian member never buys anything — the payer's plan covers them, and the AI proxy
// already honours that. Every other gate in the app read the local RevenueCat entitlement instead,
// so the person actually being watched over was treated as a free user: 90-day plan locked from
// day 4, one contact, one goal, one protection card, and re-convert paywalls aimed at someone
// whose family already paid for them.
//
// The answer comes from the proxy's /access, which re-reads the payer's live subscription on every
// call (verifyMembership → verifySharedMembership) and also enforces the tier rules: a family link
// only grants access while the payer holds annual or lifetime, a mutual link only while they hold
// mutual. Deriving it locally from "an active guardian_links row exists" cannot see any of that —
// a payer who lapsed or downgraded would keep handing out access indefinitely.

const ACCESS_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 60000;

// Four screens ask this on every focus. Without a cache a free user pays a round trip each time
// they switch tabs; the in-flight map also collapses the home screen's own concurrent asks.
// Only definite answers from the server are cached — a timeout must never be remembered, or one
// blip would lock a guardian member out for the rest of the TTL.
const answerCache = new Map<string, { value: boolean; at: number }>();
const inFlight = new Map<string, Promise<boolean | null>>();

function accessBaseUrl() {
  return AI_PROXY_URL ? AI_PROXY_URL.replace(/\/ai\/chat$/, '') : '';
}

// Fails CLOSED. These are paid-feature gates, so an unreachable proxy must not hand the paid
// experience to every free user. (An earlier unused checkAppAccess helper failed OPEN — it had been
// written as a whole-app door, where the right default is to never lock a paying customer out
// during an outage. Opposite question, opposite default. It was deleted rather than reused so the
// two defaults can't be confused again.)
// Returns null when the server did not give a usable answer, so the caller can fail closed without
// that non-answer poisoning the cache.
async function askServer(userId: string): Promise<boolean | null> {
  const base = accessBaseUrl();
  if (!base) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ACCESS_TIMEOUT_MS);
  try {
    const response = await fetch(base + '/access?appUserId=' + encodeURIComponent(userId), {
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    return typeof data?.hasAccess === 'boolean' ? data.hasAccess : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function hasSharedAccess(userId: string): Promise<boolean> {
  const cached = answerCache.get(userId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  let pending = inFlight.get(userId);
  if (!pending) {
    pending = askServer(userId).finally(() => inFlight.delete(userId));
    inFlight.set(userId, pending);
  }
  const answer = await pending;
  if (answer === null) return false;
  answerCache.set(userId, { value: answer, at: Date.now() });
  return answer;
}

export async function resolveHasAccess(
  userId?: string | null,
  snapshot?: SubscriptionSnapshot | null,
): Promise<boolean> {
  const snap = snapshot ?? (await getSubscriptionSnapshot());
  // Anyone with their own entitlement is answered locally and instantly — no network on the path
  // that every paying customer takes.
  if (snap.isPro) return true;
  if (!userId) return false;
  return hasSharedAccess(userId);
}
