import { ANNUAL_PRODUCT_IDS, LIFETIME_LAUNCH_PRODUCT_IDS, LIFETIME_PRODUCT_IDS, MONTHLY_PRODUCT_IDS, MUTUAL_PRODUCT_IDS, TERMS_URL } from '@/config';
import PromoCountdown from '@/components/PromoCountdown';
import PrivacyPolicyModal from '@/components/PrivacyPolicyModal';
import { loadData, saveData } from '@/storage';
import { configureRevenueCat, customerInfoToSnapshot, getFriendlyPurchaseError } from '@/subscription';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  featureName?: string;
  defaultPlan?: PlanType;
  onboardingPrompt?: boolean;
  monthlyLoss?: number; // 漏斗注入：付费墙文案锚定用户填的月损失（B2 起使用）
};

type PlanType = 'ANNUAL' | 'MONTHLY' | 'MUTUAL' | 'LIFETIME';

const MUTUAL_KEYWORDS = ['mutual', 'couple', 'partner', 'duo', 'pair'];

// First-session launch offer: a real, cheaper buyout product (LIFETIME_LAUNCH_PRODUCT_IDS, e.g.
// $79.99) is shown with a persisted countdown; when it expires the regular buyout
// (LIFETIME_PRODUCT_IDS, e.g. $99.99) is shown instead. Two REAL products — never a fake price on one.
const PROMO_DURATION_MS = 5 * 60 * 1000;

// Store-specific billing copy/links. iOS strings stay exactly as before; Android points at Google Play.
const IS_ANDROID = Platform.OS === 'android';
const MANAGE_SUBSCRIPTION_URL = IS_ANDROID
  ? 'https://play.google.com/store/account/subscriptions'
  : 'https://apps.apple.com/account/subscriptions';

function isMutualProduct(productId: string) {
  const id = productId.toLowerCase();
  return MUTUAL_PRODUCT_IDS.some((x) => x.toLowerCase() === id) || MUTUAL_KEYWORDS.some((keyword) => id.includes(keyword));
}

function isLifetimeProduct(productId: string) {
  const id = productId.toLowerCase();
  return LIFETIME_PRODUCT_IDS.some((x) => x.toLowerCase() === id) || id.includes('lifetime') || id.includes('forever');
}

// Exact product ids from config win first; packageType/keyword matching is only a fallback.
// The family (ANNUAL) card must never fall onto the mutual or lifetime product — their ids can also
// contain "year", which is exactly how cards could get mixed up.
function pickPackage(packages: PurchasesPackage[], type: PlanType): PurchasesPackage | undefined {
  const exactSource =
    type === 'MUTUAL' ? MUTUAL_PRODUCT_IDS :
    type === 'ANNUAL' ? ANNUAL_PRODUCT_IDS :
    type === 'LIFETIME' ? LIFETIME_PRODUCT_IDS :
    MONTHLY_PRODUCT_IDS;
  const exactIds = exactSource.map((x) => x.toLowerCase());
  const exact = packages.find((p) => exactIds.includes(p.product.identifier.toLowerCase()));
  if (exact) return exact;
  if (type === 'LIFETIME') return packages.find((p) => isLifetimeProduct(p.product.identifier));
  if (type === 'MUTUAL') return packages.find((p) => isMutualProduct(p.product.identifier));
  const candidates = packages.filter((p) => !isMutualProduct(p.product.identifier) && !isLifetimeProduct(p.product.identifier));
  const byType = candidates.find((p) => p.packageType === type);
  if (byType) return byType;
  const keywords = type === 'ANNUAL' ? ['yearly', 'annual', 'year'] : ['monthly', 'month'];
  return candidates.find((p) => keywords.some((keyword) => p.product.identifier.toLowerCase().includes(keyword)));
}

function getPlanSubtitle(pkg: PurchasesPackage, fallback: string) {
  const description = pkg.product.description?.trim();
  if (description && description.length < 70) return description;
  return fallback;
}

export default function PaywallModal({ visible, onClose, onSuccess, featureName, defaultPlan = 'LIFETIME', onboardingPrompt = false, monthlyLoss = 0 }: Props) {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [selected, setSelected] = useState<PlanType>('LIFETIME');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [promoDeadline, setPromoDeadline] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    if (visible) loadOfferings();
  }, [visible]);

  // Persisted per-user launch countdown: starts the first time the paywall is opened and genuinely
  // expires (the deadline is saved), so "限时" is real — after it, the buyout shows the regular price.
  useEffect(() => {
    if (!visible) return;
    let active = true;
    (async () => {
      try {
        let deadline = Number(await loadData('paywallPromoDeadline')) || 0;
        if (!deadline) {
          deadline = Date.now() + PROMO_DURATION_MS;
          await saveData('paywallPromoDeadline', String(deadline));
        }
        if (active) { setPromoDeadline(deadline); setNowTs(Date.now()); }
      } catch {
        // storage unavailable — just skip the promo
      }
    })();
    return () => { active = false; };
  }, [visible]);

  useEffect(() => {
    if (!visible || !promoDeadline) return;
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visible, promoDeadline]);

  async function loadOfferings() {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      setLoading(false);
      setErrorMsg('订阅购买需要在 iOS 或 Android 真机 / 应用商店环境中测试。');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      await configureRevenueCat();
      const offerings = await Purchases.getOfferings();
      const pkgs = offerings.current?.availablePackages ?? [];
      setPackages(pkgs);
      if (pickPackage(pkgs, defaultPlan)) setSelected(defaultPlan);
      else if (pickPackage(pkgs, 'LIFETIME')) setSelected('LIFETIME');
      else if (pickPackage(pkgs, 'ANNUAL')) setSelected('ANNUAL');
      else if (pickPackage(pkgs, 'MUTUAL')) setSelected('MUTUAL');
      else if (pickPackage(pkgs, 'MONTHLY')) setSelected('MONTHLY');
      if (pkgs.length === 0) setErrorMsg('暂时无法加载订阅选项，请检查应用商店与 RevenueCat 产品配置。');
    } catch (error) {
      console.log('[Paywall] load offerings failed:', error);
      setErrorMsg(getFriendlyPurchaseError(error));
    } finally {
      setLoading(false);
    }
  }

  const annual = useMemo(() => pickPackage(packages, 'ANNUAL'), [packages]);
  const monthly = useMemo(() => pickPackage(packages, 'MONTHLY'), [packages]);
  const mutual = useMemo(() => pickPackage(packages, 'MUTUAL'), [packages]);
  const regularLifetime = useMemo(() => pickPackage(packages, 'LIFETIME'), [packages]);
  const launchLifetime = useMemo(() => {
    const ids = LIFETIME_LAUNCH_PRODUCT_IDS.map((x) => x.toLowerCase());
    return packages.find((p) => ids.includes(p.product.identifier.toLowerCase()));
  }, [packages]);
  // Countdown: seconds left in the first-session launch offer.
  const countdownRemaining = promoDeadline ? Math.max(0, Math.ceil((promoDeadline - nowTs) / 1000)) : 0;
  // Promo is on only while the timer is live AND the launch product is really cheaper than the regular.
  const promoActive = !!launchLifetime && countdownRemaining > 0 && (!regularLifetime || launchLifetime.product.price < regularLifetime.product.price);
  // The buyout package actually shown/charged: launch price during the countdown, regular price after.
  const lifetime = promoActive ? launchLifetime : (regularLifetime ?? launchLifetime);
  const selectedPackage = selected === 'MUTUAL' ? mutual : selected === 'LIFETIME' ? lifetime : selected === 'ANNUAL' ? annual : monthly;
  const hasPlans = !!annual || !!monthly || !!mutual || !!lifetime;
  // Real anchor: 12× the monthly price struck through next to the annual price ("save X%").
  const annualSavingsPct = annual && monthly && monthly.product.price > 0
    ? Math.max(0, Math.round((1 - annual.product.price / (monthly.product.price * 12)) * 100))
    : 0;
  // Personalized: how many days of the user's own gambling loss the annual price equals.
  const annualLossDays = annual && monthlyLoss > 0
    ? Math.max(1, Math.round(annual.product.price / (monthlyLoss / 30)))
    : 0;
  // Lifetime vs annual: how many years of subscription the one-time buyout price equals.
  const lifetimeYears = lifetime && annual && annual.product.price > 0
    ? Math.round((lifetime.product.price / annual.product.price) * 10) / 10
    : 0;
  // How many days of the user's own gambling loss the one-time buyout equals — the sharpest hook for
  // a gambling app (a heavy loser's lifetime unlock can cost less than a single day of bets).
  const lifetimeLossDays = lifetime && monthlyLoss > 0
    ? Math.max(1, Math.round(lifetime.product.price / (monthlyLoss / 30)))
    : 0;

  function finishWithSnapshot(customerInfo: any) {
    const snapshot = customerInfoToSnapshot(customerInfo);
    if (!snapshot.isPro) {
      Alert.alert('正在确认订阅', '购买流程已完成，但会员状态还没同步。请稍后点“恢复购买”。');
      return;
    }
    Alert.alert(
      '已解锁',
      snapshot.planType === 'mutual' ? '互相守护版已解锁。'
        : snapshot.planType === 'annual' ? '家庭守护版已解锁全部功能。'
        : snapshot.planType === 'lifetime' ? '终身会员已解锁全部功能。'
        : snapshot.planType === 'monthly' ? '个人自救版已解锁。'
        : '会员已解锁。'
    );
    onSuccess();
  }

  async function handlePurchase(pkg?: PurchasesPackage) {
    if (!pkg || purchasing) return;
    try {
      setPurchasing(true);
      await configureRevenueCat();
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      finishWithSnapshot(customerInfo);
    } catch (error: any) {
      if (!error?.userCancelled) Alert.alert('购买失败', getFriendlyPurchaseError(error));
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    if (purchasing) return;
    try {
      setPurchasing(true);
      await configureRevenueCat();
      const customerInfo = await Purchases.restorePurchases();
      finishWithSnapshot(customerInfo);
    } catch (error) {
      Alert.alert('恢复失败', getFriendlyPurchaseError(error));
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.closeIcon} onPress={onClose} disabled={purchasing}>
            <Text style={styles.closeIconText}>×</Text>
          </TouchableOpacity>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.heroIcon}><Text style={styles.heroEmoji}>🌱</Text></View>
            <Text style={styles.title}>{onboardingPrompt ? '开启你的 90 天新生计划' : 'NoMoreBets 自救计划'}</Text>
            <Text style={styles.subtitle}>
              {featureName
                ? '“' + featureName + '”需要有效订阅。'
                : onboardingPrompt && monthlyLoss > 0
                  ? '你每月大约输 $' + monthlyLoss.toLocaleString() + '。给自己一个能真正守住它的计划——订阅方案头 7 天免费。'
                  : '选择你的方案。订阅方案头 7 天免费，买断一次付清、永久拥有。'}
            </Text>

            {onboardingPrompt ? (
              <View style={styles.recommendCard}>
                <Text style={styles.recommendTitle}>最省心：一次买断，永久拥有</Text>
                <Text style={styles.recommendLine}>戒赌是长期的事——一次付清，永久解锁，不用年年续费、也不怕忘记取消。</Text>
              </View>
            ) : null}

            <View style={styles.allAccessStrip}>
              <Text style={styles.allAccessText}>每个方案都解锁全部功能——区别只在 AI 次数和守护方式。</Text>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#2E7D32" />
                <Text style={styles.loadingText}>正在读取订阅选项...</Text>
              </View>
            ) : hasPlans ? (
              <View style={styles.plans}>
                {lifetime && (
                  <TouchableOpacity style={[styles.lifetimeCard, selected === 'LIFETIME' && styles.lifetimeCardSelected]} onPress={() => { setSelected('LIFETIME'); handlePurchase(lifetime); }} disabled={purchasing}>
                    <View style={styles.planTopRow}>
                      <Text style={styles.lifetimeName}>终身会员 · 一次买断</Text>
                      <View style={styles.badgeGold}><Text style={styles.badgeText}>{promoActive ? '🔥 促销价' : '🔥 最超值'}</Text></View>
                    </View>
                    <View style={styles.priceRow}>
                      {promoActive && regularLifetime ? <Text style={styles.lifetimeWas}>{regularLifetime.product.priceString}</Text> : null}
                      <Text style={styles.lifetimePrice}>{lifetime.product.priceString}</Text>
                      <Text style={styles.lifetimeOnce}>一次付清 · 永久拥有</Text>
                    </View>
                    {lifetimeLossDays > 0 ? (
                      <Text style={styles.lifetimeLoss}>≈ 你 {lifetimeLossDays} 天输掉的钱，换一辈子不再碰赌。</Text>
                    ) : null}
                    {!promoActive && lifetimeYears > 0 ? (
                      <Text style={styles.lifetimeCompare}>≈ {lifetimeYears} 年的订阅费，之后永远免费。订满两年，买断更划算。</Text>
                    ) : null}
                    <View style={styles.lifetimeBenefits}>
                      <Text style={styles.lifetimeBenefitStrong}>一次搞定，永久解锁全部功能，不用年年续费、记着取消。</Text>
                      <Text style={styles.lifetimeBenefit}>90 天计划 · AI 冲动倾诉 · 守护邀请 · 全部无限，一辈子。</Text>
                    </View>
                    {promoActive && promoDeadline ? (
                      <PromoCountdown embedded deadline={promoDeadline} totalMs={PROMO_DURATION_MS} secondsLeft={countdownRemaining} regularPrice={regularLifetime?.product.priceString} />
                    ) : null}
                  </TouchableOpacity>
                )}
                {lifetime && (annual || monthly || mutual) ? (
                  <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>或按期订阅</Text><View style={styles.dividerLine} /></View>
                ) : null}
                {annual && (
                  <TouchableOpacity style={[styles.planCard, selected === 'ANNUAL' && styles.planSelected]} onPress={() => { setSelected('ANNUAL'); handlePurchase(annual); }} disabled={purchasing}>
                    <View style={styles.planTopRow}>
                      <Text style={styles.planName}>家庭守护版</Text>
                      <View style={styles.badge}><Text style={styles.badgeText}>含 7 天免费</Text></View>
                    </View>
                    <View style={styles.priceRow}>
                      <Text style={styles.planPrice}>{annual.product.priceString} / 年</Text>
                      {monthly && annualSavingsPct > 0 ? (
                        <Text style={styles.anchor}>原价 <Text style={styles.strike}>{monthly.product.priceString}×12</Text> · 省 {annualSavingsPct}%</Text>
                      ) : null}
                    </View>
                    <Text style={styles.planSub}>{getPlanSubtitle(annual, '7 天免费体验，之后按年自动续订')}{annualLossDays > 0 ? ' · 约等于你 ' + annualLossDays + ' 天的赌博损失' : ''}</Text>
                    <View style={styles.planBenefits}>
                      <Text style={styles.planBenefitStrong}>一顿饭钱，让家人守护你一整年。</Text>
                      <Text style={styles.planBenefit}>全部功能 + 邀 1 位家人守护 · AI 每月 100 次 · 含 7 天免费</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {monthly && (
                  <TouchableOpacity style={[styles.planCard, selected === 'MONTHLY' && styles.planSelected]} onPress={() => { setSelected('MONTHLY'); handlePurchase(monthly); }} disabled={purchasing}>
                    <View style={styles.planTopRow}><Text style={styles.planName}>个人自救版</Text></View>
                    <Text style={styles.planPrice}>{monthly.product.priceString} / 月</Text>
                    <Text style={styles.planSub}>{getPlanSubtitle(monthly, '7天免费自救体验后按月自动续订')}</Text>
                    <View style={styles.planBenefits}>
                      <Text style={styles.planBenefitStrong}>一杯咖啡钱，先撑过最难的第一个月。</Text>
                      <Text style={styles.planBenefit}>全部功能 + AI 每月 50 次，一个人先开始 · 含 7 天免费</Text>
                    </View>
                  </TouchableOpacity>
                )}


                {mutual && (
                  <TouchableOpacity style={[styles.planCard, selected === 'MUTUAL' && styles.planSelected]} onPress={() => { setSelected('MUTUAL'); handlePurchase(mutual); }} disabled={purchasing}>
                    <View style={styles.planTopRow}>
                      <Text style={styles.planName}>互相守护版</Text>
                    </View>
                    <Text style={styles.planPrice}>{mutual.product.priceString} / 年</Text>
                    <Text style={styles.planSub}>{getPlanSubtitle(mutual, '7天免费自救体验后按年自动续订')}</Text>
                    <View style={styles.planBenefits}>
                      <Text style={styles.planBenefitStrong}>两个人一起戒，比一个人走得远。</Text>
                      <Text style={styles.planBenefit}>全部功能 + 一对一互相守护 · 双方各 AI 每月 100 次</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {purchasing ? (
                  <View style={styles.purchasingRow}><ActivityIndicator color="#2E7D32" /><Text style={styles.purchasingText}>正在处理…</Text></View>
                ) : (
                  <Text style={styles.tapHint}>点选任一方案即可购买（{IS_ANDROID ? 'Google Play' : 'Apple'} 会再次确认）</Text>
                )}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>订阅暂时不可用</Text>
                <Text style={styles.emptyText}>{errorMsg ?? '暂时无法加载订阅选项。'}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={loadOfferings} disabled={purchasing}>
                  <Text style={styles.retryText}>重新加载</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* The buyout is a one-time non-consumable: no trial, no renewal. Showing the
                auto-renew disclosure on it states billing behaviour that does not apply. */}
            <Text style={styles.disclaimer}>
              {IS_ANDROID
                ? (selected === 'LIFETIME'
                    ? '付款通过 Google Play 处理。终身会员是一次性买断，付一次永久拥有，不会自动续订、也不会再扣费。'
                    : '付款通过 Google Play 处理。试用结束后会自动续订，除非在当前周期结束前至少 24 小时取消。删除 App 不会自动取消 Google Play 订阅。')
                : (selected === 'LIFETIME'
                    ? '付款通过 Apple ID 处理。终身会员是一次性买断，付一次永久拥有，不会自动续订、也不会再扣费。'
                    : '付款通过 Apple ID 处理。试用结束后会自动续订，除非在当前周期结束前至少 24 小时取消。删除 App 不会自动取消 Apple 订阅。')}
            </Text>
            <View style={styles.linkRow}>
              <TouchableOpacity onPress={handleRestore} disabled={purchasing}><Text style={styles.linkText}>恢复购买</Text></TouchableOpacity>
              <Text style={styles.dot}>·</Text>
              <TouchableOpacity onPress={() => Linking.openURL(MANAGE_SUBSCRIPTION_URL)}><Text style={styles.linkText}>管理订阅</Text></TouchableOpacity>
            </View>
            <View style={styles.linkRow}>
              <TouchableOpacity onPress={() => setShowPrivacy(true)}><Text style={styles.legalLink}>隐私政策</Text></TouchableOpacity>
              <Text style={styles.dot}>·</Text>
              <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}><Text style={styles.legalLink}>使用条款</Text></TouchableOpacity>
            </View>
            <PrivacyPolicyModal visible={showPrivacy} onClose={() => setShowPrivacy(false)} />
            <TouchableOpacity onPress={onClose} style={styles.laterBtn} disabled={purchasing}>
              <Text style={styles.laterText}>暂不订阅，先免费使用</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'flex-end' },
  container: { maxHeight: '92%', backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 16 },
  closeIcon: { position: 'absolute', top: 12, right: 18, zIndex: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center' },
  closeIconText: { fontSize: 24, color: '#777', lineHeight: 28 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 34 },
  heroIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  heroEmoji: { fontSize: 34 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2E7D32', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 21, marginBottom: 16 },
  recommendCard: { backgroundColor: '#FFF8E7', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F3D493' },
  recommendTitle: { fontSize: 15, fontWeight: 'bold', color: '#7A4C00', marginBottom: 7 },
  recommendLine: { fontSize: 13, color: '#6F5A28', lineHeight: 19, marginBottom: 5 },
  recommendWarn: { fontSize: 12, color: '#9A5A00', lineHeight: 18, fontWeight: 'bold' },
  featuresCard: { backgroundColor: '#F8FAF7', borderRadius: 18, padding: 14, marginBottom: 16 },
  allAccessStrip: { backgroundColor: '#F1F8F1', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 14 },
  allAccessText: { fontSize: 13, color: '#2E7D32', textAlign: 'center', lineHeight: 18, fontWeight: 'bold' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  featureLine: { fontSize: 13, color: '#555', lineHeight: 20, marginBottom: 5 },
  loadingBox: { alignItems: 'center', paddingVertical: 24 },
  loadingText: { color: '#777', fontSize: 13, marginTop: 10 },
  plans: { gap: 10 },
  planCard: { borderWidth: 1.5, borderColor: '#E2E2E2', borderRadius: 16, padding: 15, backgroundColor: '#fff' },
  planSelected: { borderColor: '#2E7D32', backgroundColor: '#F1F8F1' },
  planTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  planName: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  badge: { backgroundColor: '#2E7D32', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeGold: { backgroundColor: '#E67E22', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  anchor: { fontSize: 12, color: '#E67E22', fontWeight: 'bold' },
  strike: { textDecorationLine: 'line-through', color: '#aaa', fontWeight: 'normal' },
  lifetimeCard: { borderWidth: 2, borderColor: '#E67E22', borderRadius: 16, padding: 16, backgroundColor: '#FFF8F0' },
  lifetimeCardSelected: { backgroundColor: '#FFF1E3', shadowColor: '#E67E22', shadowOpacity: 0.22, shadowRadius: 8, elevation: 3 },
  lifetimeName: { fontSize: 16, fontWeight: 'bold', color: '#B85C00' },
  lifetimePrice: { fontSize: 26, fontWeight: 'bold', color: '#E67E22' },
  lifetimeOnce: { fontSize: 13, color: '#B85C00', fontWeight: 'bold' },
  lifetimeCompare: { fontSize: 12, color: '#9A6A00', marginTop: 4, fontWeight: 'bold' },
  lifetimeWas: { fontSize: 16, color: '#B08968', textDecorationLine: 'line-through', fontWeight: 'bold' },
  lifetimeLoss: { fontSize: 13, color: '#B85C00', fontWeight: 'bold', marginTop: 6, lineHeight: 19 },
  lifetimeUrgent: { fontSize: 12, color: '#C0392B', fontWeight: 'bold', marginTop: 4, lineHeight: 17 },
  lifetimeBenefits: { backgroundColor: 'rgba(230,126,34,0.08)', borderRadius: 10, padding: 10, marginTop: 10 },
  lifetimeBenefitStrong: { fontSize: 13, color: '#B85C00', fontWeight: 'bold', marginBottom: 4, lineHeight: 18 },
  lifetimeBenefit: { fontSize: 12, color: '#6F5A28', lineHeight: 18 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#eee' },
  dividerText: { fontSize: 12, color: '#aaa', marginHorizontal: 10 },
  planPrice: { fontSize: 22, fontWeight: 'bold', color: '#2E7D32', marginBottom: 2 },
  planSub: { fontSize: 12, color: '#777', lineHeight: 17 },
  planBenefits: { backgroundColor: '#F8FAF7', borderRadius: 10, padding: 10, marginTop: 10 },
  planBenefitStrong: { fontSize: 12, color: '#2E7D32', fontWeight: 'bold', marginBottom: 4 },
  planBenefit: { fontSize: 12, color: '#555', lineHeight: 17 },
  primaryBtn: { backgroundColor: '#2E7D32', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 6 },
  disabledBtn: { opacity: 0.65 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  purchasingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  purchasingText: { color: '#2E7D32', fontSize: 14, fontWeight: 'bold' },
  tapHint: { textAlign: 'center', color: '#999', fontSize: 12, paddingTop: 8 },
  emptyState: { alignItems: 'center', backgroundColor: '#FFF8E7', borderRadius: 16, padding: 16, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#7A4C00', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#7A4C00', textAlign: 'center', lineHeight: 19, marginBottom: 12 },
  retryBtn: { borderWidth: 1, borderColor: '#2E7D32', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#2E7D32', fontSize: 14, fontWeight: 'bold' },
  disclaimer: { fontSize: 11, color: '#777', lineHeight: 17, textAlign: 'center', marginTop: 14, marginBottom: 12 },
  linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  linkText: { color: '#2E7D32', fontSize: 13, fontWeight: 'bold', textDecorationLine: 'underline' },
  legalLink: { color: '#777', fontSize: 12, textDecorationLine: 'underline' },
  dot: { color: '#aaa', marginHorizontal: 8 },
  laterBtn: { alignItems: 'center', paddingVertical: 8 },
  laterText: { color: '#999', fontSize: 13 },
});
