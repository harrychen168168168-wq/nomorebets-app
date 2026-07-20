import { isCommunityConfigured, listGuardianLinks } from './community';
import { getSubscriptionSnapshot, SubscriptionSnapshot } from './subscription';

// An invited guardian member never buys anything — the payer's plan covers them, and the AI proxy
// already honours that (verifySharedMembership). Every other gate in the app read the local
// RevenueCat entitlement instead, so the person actually being watched over was treated as a free
// user: 90-day plan locked from day 4, one contact, one goal, one protection card, and re-convert
// paywalls popping up at someone whose family already paid for them.
//
// Fails CLOSED on purpose. If the link lookup errors we keep whatever the local entitlement said
// rather than opening up — a network blip must never hand the paid features to every free user.
// (emergency.tsx has used this same shape for AI eligibility since before this helper existed.)
export async function resolveHasAccess(
  userId?: string | null,
  snapshot?: SubscriptionSnapshot | null,
): Promise<boolean> {
  const snap = snapshot ?? (await getSubscriptionSnapshot());
  if (snap.isPro) return true;
  if (!userId || !isCommunityConfigured()) return false;
  const links = await listGuardianLinks(userId).catch(() => []);
  // Only the INVITED member rides on someone else's plan. guardian/listLinks returns the caller's
  // owner-side links too, so counting every row would let a payer whose own subscription lapsed
  // keep full access forever through the link they created themselves.
  return links.some((link) => link.memberUserId === userId);
}

// Known gap, deliberately not closed here: this trusts that an active link still means the payer is
// paying. The server does check (ai-proxy verifySharedMembership re-reads the owner's membership on
// every AI call), so AI access is correct; these local gates are not. Closing it properly means
// routing through the proxy's /access — a network round trip on paths that currently answer from
// local state, so it wants a deliberate decision rather than a late-night patch.
