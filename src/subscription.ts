import { Platform } from 'react-native';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { AI_PROXY_URL, ANNUAL_PRODUCT_IDS, LIFETIME_PRODUCT_IDS, MONTHLY_PRODUCT_IDS, MUTUAL_PRODUCT_IDS, REVENUECAT_ENTITLEMENT_ID, REVENUECAT_IOS_KEY } from './config';

const FALLBACK_ENTITLEMENT_IDS = ['pro', 'premium', 'NO_MORE_BETS_PRO'];
const ENTITLEMENT_IDS = Array.from(new Set([REVENUECAT_ENTITLEMENT_ID, ...FALLBACK_ENTITLEMENT_IDS].filter(Boolean)));
const APPLE_SUBSCRIPTION_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';

let configured = false;

export type PlanType = 'monthly' | 'annual' | 'mutual' | 'lifetime' | 'unknown' | 'none';

export type SubscriptionSnapshot = {
  isPro: boolean;
  checkedAt: string;
  activeEntitlementId?: string;
  expirationDate?: string | null;
  willRenew?: boolean | null;
  managementURL?: string;
  originalAppUserId?: string;
  productIdentifier?: string;
  planType?: PlanType;
  activeProductIds?: string[];
  error?: string;
};

export async function configureRevenueCat() {
  if (Platform.OS !== 'ios' || configured) return;
  Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
  configured = true;
}

function normalizeId(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function matchesProductId(productId: string | undefined | null, ids: string[]) {
  const normalized = normalizeId(productId);
  return !!normalized && ids.map(normalizeId).includes(normalized);
}

export function getActiveEntitlement(customerInfo?: CustomerInfo | null) {
  const active = customerInfo?.entitlements?.active ?? {};
  const exact = ENTITLEMENT_IDS.find((id) => active[id]);
  if (exact) return { id: exact, entitlement: active[exact] };
  const firstId = Object.keys(active)[0];
  if (firstId) return { id: firstId, entitlement: active[firstId] };
  return null;
}

export function hasActivePro(customerInfo?: CustomerInfo | null) {
  return !!getActiveEntitlement(customerInfo);
}

export function getSubscriptionManageUrl(customerInfo?: CustomerInfo | null) {
  return (customerInfo as any)?.managementURL || APPLE_SUBSCRIPTION_MANAGE_URL;
}

export function inferPlanType(productIdentifier?: string | null): PlanType {
  const id = normalizeId(productIdentifier);
  if (!id) return 'none';
  if (matchesProductId(id, LIFETIME_PRODUCT_IDS)) return 'lifetime';
  if (matchesProductId(id, MUTUAL_PRODUCT_IDS)) return 'mutual';
  if (matchesProductId(id, ANNUAL_PRODUCT_IDS)) return 'annual';
  if (matchesProductId(id, MONTHLY_PRODUCT_IDS)) return 'monthly';
  if (id.includes('lifetime') || id.includes('forever')) return 'lifetime';
  if (id.includes('mutual') || id.includes('couple') || id.includes('partner') || id.includes('duo')) return 'mutual';
  if (id.includes('annual') || id.includes('year') || id.includes('yearly')) return 'annual';
  if (id.includes('month') || id.includes('monthly')) return 'monthly';
  return 'unknown';
}

function collectProductIds(customerInfo: CustomerInfo, entitlement: any) {
  const ids = new Set<string>();
  const add = (value?: string | null) => {
    const normalized = String(value || '').trim();
    if (normalized) ids.add(normalized);
  };
  add(entitlement?.productIdentifier);
  add(entitlement?.product_identifier);
  add(entitlement?.productId);
  add(entitlement?.product_id);
  for (const id of ((customerInfo as any)?.activeSubscriptions || [])) add(id);
  for (const id of ((customerInfo as any)?.allPurchasedProductIdentifiers || [])) add(id);
  return Array.from(ids);
}

function resolvePlanFromProducts(productIds: string[], fallbackProductId?: string | null): { planType: PlanType; productIdentifier?: string } {
  const lifetime = productIds.find((id) => matchesProductId(id, LIFETIME_PRODUCT_IDS) || inferPlanType(id) === 'lifetime');
  if (lifetime) return { planType: 'lifetime', productIdentifier: lifetime };
  const mutual = productIds.find((id) => matchesProductId(id, MUTUAL_PRODUCT_IDS) || inferPlanType(id) === 'mutual');
  if (mutual) return { planType: 'mutual', productIdentifier: mutual };
  const annual = productIds.find((id) => matchesProductId(id, ANNUAL_PRODUCT_IDS) || inferPlanType(id) === 'annual');
  if (annual) return { planType: 'annual', productIdentifier: annual };
  const monthly = productIds.find((id) => matchesProductId(id, MONTHLY_PRODUCT_IDS) || inferPlanType(id) === 'monthly');
  if (monthly) return { planType: 'monthly', productIdentifier: monthly };
  const fallbackPlan = inferPlanType(fallbackProductId);
  return { planType: fallbackPlan, productIdentifier: fallbackProductId || productIds[0] };
}

export async function getSubscriptionSnapshot(): Promise<SubscriptionSnapshot> {
  if (Platform.OS !== 'ios') {
    return {
      isPro: false,
      planType: 'none',
      checkedAt: new Date().toISOString(),
      managementURL: APPLE_SUBSCRIPTION_MANAGE_URL,
      error: '订阅购买只能在 iOS 真机、TestFlight 或 App Store 环境使用。',
    };
  }
  try {
    await configureRevenueCat();
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfoToSnapshot(customerInfo);
  } catch (error) {
    console.log('[Subscription] snapshot failed:', error);
    return {
      isPro: false,
      planType: 'none',
      checkedAt: new Date().toISOString(),
      managementURL: APPLE_SUBSCRIPTION_MANAGE_URL,
      error: getFriendlyPurchaseError(error),
    };
  }
}

export function customerInfoToSnapshot(customerInfo: CustomerInfo): SubscriptionSnapshot {
  const active = getActiveEntitlement(customerInfo);
  const entitlement: any = active?.entitlement;
  const fallbackProductId = entitlement?.productIdentifier ?? entitlement?.product_identifier ?? entitlement?.productId ?? entitlement?.product_id;
  const productIds = collectProductIds(customerInfo, entitlement);
  const resolved = resolvePlanFromProducts(productIds, fallbackProductId);
  return {
    isPro: !!active,
    activeEntitlementId: active?.id,
    productIdentifier: resolved.productIdentifier,
    activeProductIds: productIds,
    planType: active ? resolved.planType : 'none',
    expirationDate: entitlement?.expirationDate ?? null,
    willRenew: entitlement?.willRenew ?? null,
    checkedAt: new Date().toISOString(),
    managementURL: getSubscriptionManageUrl(customerInfo),
    originalAppUserId: (customerInfo as any)?.originalAppUserId,
  };
}

export async function checkProStatus(): Promise<boolean> {
  const snapshot = await getSubscriptionSnapshot();
  return snapshot.isPro;
}

export function formatSubscriptionDate(dateValue?: string | null) {
  if (!dateValue) return '暂无到期时间';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '暂无到期时间';
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

export function getFriendlyPurchaseError(error: any) {
  const message = String(error?.message || error || '');
  if (error?.userCancelled) return '你已取消购买。';
  if (message.toLowerCase().includes('network')) return '网络连接失败，请检查网络后重试。';
  if (message.toLowerCase().includes('configuration')) return '订阅配置暂时不可用，请检查 RevenueCat 和 App Store Connect 产品配置。';
  if (message.toLowerCase().includes('not allowed')) return '当前设备或 Apple ID 暂时不允许购买。';
  return '订阅暂时无法完成，请稍后重试或使用“恢复购买”。';
}

export type AppAccess = { allowed: boolean; source?: 'own' | 'shared'; reason?: string };

// Whole-app subscription gate. A user may use the app if they have their own active subscription,
// or (for an invited guardian member) if their payer's subscription is still active. The payer
// check runs on the proxy, which verifies RevenueCat live — so access stops the moment the
// payer's subscription lapses. Fails OPEN on network/proxy errors so an outage never locks out a
// paying user (AI and other server resources stay independently gated server-side).
export async function checkAppAccess(appUserId?: string): Promise<AppAccess> {
  // Subscriptions only exist on iOS in this app; never hard-lock a platform that cannot subscribe.
  if (Platform.OS !== 'ios') return { allowed: true, source: 'own', reason: 'non_ios' };

  const snapshot = await getSubscriptionSnapshot();
  if (snapshot.isPro) return { allowed: true, source: 'own' };

  if (!appUserId || !AI_PROXY_URL) return { allowed: false, reason: 'no_subscription' };
  try {
    const base = AI_PROXY_URL.replace(/\/ai\/chat$/, '');
    const res = await fetch(base + '/access?appUserId=' + encodeURIComponent(appUserId));
    const data = await res.json().catch(() => ({}));
    if (data?.hasAccess) return { allowed: true, source: 'shared' };
    return { allowed: false, reason: data?.reason || 'no_subscription' };
  } catch {
    return { allowed: true, source: 'own', reason: 'access_check_unavailable' };
  }
}
