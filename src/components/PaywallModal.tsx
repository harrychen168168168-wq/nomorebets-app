import { ANNUAL_PRODUCT_IDS, LIFETIME_PRODUCT_IDS, MONTHLY_PRODUCT_IDS, MUTUAL_PRODUCT_IDS, PRIVACY_POLICY_URL, TERMS_URL } from '@/config';
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
  const [selected, setSelected] = useState<PlanType>('LIFETIME');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) loadOfferings();
  }, [visible]);

  async function loadOfferings() {
    if (Platform.OS !== 'ios') {
      setLoading(false);
      setErrorMsg('订阅购买需要在 iOS 真机、TestFlight 或 App Store 环境中测试。');
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
      if (pkgs.length === 0) setErrorMsg('暂时无法加载订阅选项，请检查 App Store Connect 与 RevenueCat 产品配置。');
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
  const lifetime = useMemo(() => pickPackage(packages, 'LIFETIME'), [packages]);
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
                  ? '你每月大约输 $' + monthlyLoss.toLocaleString() + '。给自己一个能真正守住它的计划——头 7 天免费。'
                  : '选择你的方案，头 7 天免费。'}
            </Text>

            {onboardingPrompt ? (
              <View style={styles.recommendCard}>
                <Text style={styles.recommendTitle}>最省心：一次买断，永久拥有</Text>
                <Text style={styles.recommendLine}>戒赌是长期的事。一次付清就永久解锁全部功能，不用每年续费、也不怕忘记取消。</Text>
                <Text style={styles.recommendLine}>还没准备好一次付清？也可以选家庭守护版，先免费体验 7 天。</Text>
              </View>
            ) : null}

            <View style={styles.featuresCard}>
              <Text style={styles.sectionTitle}>计划区别（都解锁全部功能）</Text>
              <Text style={styles.featureLine}>终身会员：一次付清，永久解锁全部功能，不再续费（无免费试用）。</Text>
              <Text style={styles.featureLine}>个人自救版：解锁全部自救功能，含 AI 每月 50 次，适合一个人开始。</Text>
              <Text style={styles.featureLine}>家庭守护版：全部功能 + 可邀请一位家人守护；AI 每月 100 次为家庭共享额度。</Text>
              {mutual ? <Text style={styles.featureLine}>互相守护版：全部功能 + 一对一互相守护；双方各自 AI 每月 100 次。</Text> : null}
              <Text style={styles.featureLine}>邀请权限跟主会员同一天到期，不会比主会员多出额外免费天数。</Text>
              <Text style={styles.featureLine}>AI 有次数限制，避免滥用和成本失控。</Text>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#2E7D32" />
                <Text style={styles.loadingText}>正在读取 App Store 订阅选项...</Text>
              </View>
            ) : hasPlans ? (
              <View style={styles.plans}>
                {lifetime && (
                  <TouchableOpacity style={[styles.lifetimeCard, selected === 'LIFETIME' && styles.lifetimeCardSelected]} onPress={() => setSelected('LIFETIME')} disabled={purchasing}>
                    <View style={styles.planTopRow}>
                      <Text style={styles.lifetimeName}>终身会员 · 一次买断</Text>
                      <View style={styles.badgeGold}><Text style={styles.badgeText}>🔥 最超值</Text></View>
                    </View>
                    <View style={styles.priceRow}>
                      <Text style={styles.lifetimePrice}>{lifetime.product.priceString}</Text>
                      <Text style={styles.lifetimeOnce}>一次付清 · 永久拥有</Text>
                    </View>
                    {lifetimeYears > 0 ? (
                      <Text style={styles.lifetimeCompare}>≈ {lifetimeYears} 年的订阅费，之后永远免费。订满两年，买断更划算。</Text>
                    ) : null}
                    <View style={styles.lifetimeBenefits}>
                      <Text style={styles.lifetimeBenefitStrong}>戒赌是一辈子的事——一次搞定，再不用每年续费、记着取消。</Text>
                      <Text style={styles.lifetimeBenefit}>永久解锁全部功能：90 天计划、AI 冲动倾诉、周月报告、守护邀请、无限联系人和目标。</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {lifetime && (annual || monthly || mutual) ? (
                  <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>或按期订阅</Text><View style={styles.dividerLine} /></View>
                ) : null}
                {annual && (
                  <TouchableOpacity style={[styles.planCard, selected === 'ANNUAL' && styles.planSelected]} onPress={() => setSelected('ANNUAL')} disabled={purchasing}>
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
                      <Text style={styles.planBenefitStrong}>一顿饭钱，给身边重要的人一整年的陪伴和守护。</Text>
                      <Text style={styles.planBenefit}>适合由家人发起守护。把日常记录、紧急联系人、目标提醒和冲动应对放在一起，关键时刻多一个拉住他的入口。</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {monthly && (
                  <TouchableOpacity style={[styles.planCard, selected === 'MONTHLY' && styles.planSelected]} onPress={() => setSelected('MONTHLY')} disabled={purchasing}>
                    <View style={styles.planTopRow}><Text style={styles.planName}>个人自救版</Text></View>
                    <Text style={styles.planPrice}>{monthly.product.priceString} / 月</Text>
                    <Text style={styles.planSub}>{getPlanSubtitle(monthly, '7天免费自救体验后按月自动续订')}</Text>
                    <View style={styles.planBenefits}>
                      <Text style={styles.planBenefitStrong}>一杯咖啡钱，给自己一个月时间，从赌场冲动里慢慢拉回来。</Text>
                      <Text style={styles.planBenefit}>适合先建立打卡、记录、紧急联系人和目标提醒，并使用每月 50 次 AI 冲动倾诉，把最难的第一个月撑过去。</Text>
                    </View>
                  </TouchableOpacity>
                )}


                {mutual && (
                  <TouchableOpacity style={[styles.planCard, selected === 'MUTUAL' && styles.planSelected]} onPress={() => setSelected('MUTUAL')} disabled={purchasing}>
                    <View style={styles.planTopRow}>
                      <Text style={styles.planName}>互相守护版</Text>
                    </View>
                    <Text style={styles.planPrice}>{mutual.product.priceString} / 年</Text>
                    <Text style={styles.planSub}>{getPlanSubtitle(mutual, '7天免费自救体验后按年自动续订')}</Text>
                    <View style={styles.planBenefits}>
                      <Text style={styles.planBenefitStrong}>我们相互扶持，一起努力，让生活变得更好。</Text>
                      <Text style={styles.planBenefit}>适合朋友、伴侣、兄弟姐妹，或任何想一起戒赌的两个人。不是互相责备，而是一起把生活过得更好。</Text>
                    </View>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.primaryBtn, (!selectedPackage || purchasing) && styles.disabledBtn]} onPress={() => handlePurchase(selectedPackage)} disabled={!selectedPackage || purchasing}>
                  {purchasing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{selected === 'LIFETIME' ? '一次买断 · 永久解锁' + (lifetime ? ' ' + lifetime.product.priceString : '') : selected === 'ANNUAL' ? '开始 7 天家庭守护体验' : selected === 'MUTUAL' ? '开始 7 天互相守护体验' : '开始 7 天个人自救体验'}</Text>}
                </TouchableOpacity>
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

            <Text style={styles.disclaimer}>
              付款通过 Apple ID 处理。试用结束后会自动续订，除非在当前周期结束前至少 24 小时取消。删除 App 不会自动取消 Apple 订阅。
            </Text>
            <View style={styles.linkRow}>
              <TouchableOpacity onPress={handleRestore} disabled={purchasing}><Text style={styles.linkText}>恢复购买</Text></TouchableOpacity>
              <Text style={styles.dot}>·</Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}><Text style={styles.linkText}>管理订阅</Text></TouchableOpacity>
            </View>
            <View style={styles.linkRow}>
              <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}><Text style={styles.legalLink}>隐私政策</Text></TouchableOpacity>
              <Text style={styles.dot}>·</Text>
              <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}><Text style={styles.legalLink}>使用条款</Text></TouchableOpacity>
            </View>
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
