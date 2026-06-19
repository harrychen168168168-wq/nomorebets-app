import { Platform } from 'react-native';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { REVENUECAT_ENTITLEMENT_ID, REVENUECAT_IOS_KEY } from './config';

const FALLBACK_ENTITLEMENT_IDS = ['pro', 'premium', 'NO_MORE_BETS_PRO'];
const ENTITLEMENT_IDS = Array.from(new Set([REVENUECAT_ENTITLEMENT_ID, ...FALLBACK_ENTITLEMENT_IDS].filter(Boolean)));
const APPLE_SUBSCRIPTION_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';

let configured = false;

export type SubscriptionSnapshot = {
  isPro: boolean;
  checkedAt: string;
  activeEntitlementId?: string;
  expirationDate?: string | null;
  willRenew?: boolean | null;
  managementURL?: string;
  originalAppUserId?: string;
  productIdentifier?: string;
  planType?: 'monthly' | 'annual' | 'unknown' | 'none';
  error?: string;
};

export async function configureRevenueCat() {
  if (Platform.OS !== 'ios' || configured) return;
  try {
    Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
    configured = true;
  } catch (error) {
    console.log('[RevenueCat] configure failed:', error);
  }
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

export function inferPlanType(productIdentifier?: string | null): SubscriptionSnapshot['planType'] {
  const id = String(productIdentifier || '').toLowerCase();
  if (!id) return 'none';
  if (id.includes('annual') || id.includes('year') || id.includes('yearly')) return 'annual';
  if (id.includes('month') || id.includes('monthly')) return 'monthly';
  return 'unknown';
}

export async function getSubscriptionSnapshot(): Promise<SubscriptionSnapshot> {
  if (Platform.OS !== 'ios') {
    return {
      isPro: false,
      planType: 'none',
      checkedAt: new Date().toISOString(),
      managementURL: APPLE_SUBSCRIPTION_MANAGE_URL,
      error: '订阅购买仅在 iOS 真机或 TestFlight / App Store 环境可用。',
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
  const productIdentifier = entitlement?.productIdentifier ?? entitlement?.product_identifier ?? entitlement?.productId ?? entitlement?.product_id;

  return {
    isPro: !!active,
    activeEntitlementId: active?.id,
    productIdentifier,
    planType: inferPlanType(productIdentifier),
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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getFriendlyPurchaseError(error: any) {
  const message = String(error?.message || error || '');
  if (error?.userCancelled) return '你已取消购买。';
  if (message.toLowerCase().includes('network')) return '网络连接失败，请检查网络后重试。';
  if (message.toLowerCase().includes('configuration')) return '订阅配置暂时不可用，请检查 RevenueCat 和 App Store Connect 产品配置。';
  if (message.toLowerCase().includes('not allowed')) return '当前设备或 Apple ID 暂时不允许购买。';
  return '订阅暂时无法完成，请稍后重试或使用“恢复购买”。';
}
