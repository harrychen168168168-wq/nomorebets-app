import { PRIVACY_POLICY_URL, TERMS_URL } from '@/config';
import { configureRevenueCat, customerInfoToSnapshot, getFriendlyPurchaseError } from '@/subscription';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  featureName?: string;
};

type PlanType = 'ANNUAL' | 'MONTHLY';

function pickPackage(packages: PurchasesPackage[], type: PlanType): PurchasesPackage | undefined {
  const byType = packages.find((p) => p.packageType === type);
  if (byType) return byType;
  const keywords = type === 'ANNUAL' ? ['yearly', 'annual', 'year'] : ['monthly', 'month'];
  return packages.find((p) => keywords.some((keyword) => p.product.identifier.toLowerCase().includes(keyword)));
}

function getPlanSubtitle(pkg: PurchasesPackage, fallback: string) {
  const description = pkg.product.description?.trim();
  if (description && description.length < 70) return description;
  return fallback;
}

export default function PaywallModal({ visible, onClose, onSuccess, featureName }: Props) {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PlanType>('ANNUAL');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAiFeature = featureName?.includes('AI');

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
      if (pickPackage(pkgs, 'ANNUAL')) setSelected('ANNUAL');
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
  const selectedPackage = selected === 'ANNUAL' ? annual : monthly;
  const hasPlans = !!annual || !!monthly;

  function finishWithSnapshot(customerInfo: any) {
    const snapshot = customerInfoToSnapshot(customerInfo);
    if (!snapshot.isPro) {
      Alert.alert('正在确认订阅', '购买流程已完成，但会员状态还没同步。请稍后点“恢复购买”。');
      return;
    }
    if (isAiFeature && snapshot.planType !== 'annual') {
      Alert.alert('AI 仅限年付会员', '你的月付会员已生效，但 AI 冲动倾诉需要年付会员或后续加购包。');
      return;
    }
    Alert.alert('订阅已生效', snapshot.planType === 'annual' ? '年付会员已解锁全部功能。' : '月付基础会员已解锁基础功能。');
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
            <Text style={styles.title}>NoMoreBets 会员</Text>
            <Text style={styles.subtitle}>
              {featureName ? '“' + featureName + '”需要对应会员权限。' : '请选择适合你的会员方案。'}月付和年付权益不同，购买前请看清楚。
            </Text>

            <View style={styles.featuresCard}>
              <Text style={styles.sectionTitle}>权益差别</Text>
              <Text style={styles.featureLine}>月付基础会员：适合日常记录，解锁更多联系人、更多目标、更多复盘记录。</Text>
              <Text style={styles.featureLine}>年付高级会员：解锁全部功能，包含 AI 冲动倾诉每月 100 次。</Text>
              <Text style={styles.featureLine}>AI 用完后可买 9.99 加购包；系统按 3 美元成本上限控制，防止成本失控。</Text>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#2E7D32" />
                <Text style={styles.loadingText}>正在读取 App Store 订阅选项...</Text>
              </View>
            ) : hasPlans ? (
              <View style={styles.plans}>
                {annual && (
                  <TouchableOpacity style={[styles.planCard, selected === 'ANNUAL' && styles.planSelected]} onPress={() => setSelected('ANNUAL')} disabled={purchasing}>
                    <View style={styles.planTopRow}>
                      <Text style={styles.planName}>年付高级会员</Text>
                      <View style={styles.badge}><Text style={styles.badgeText}>推荐</Text></View>
                    </View>
                    <Text style={styles.planPrice}>{annual.product.priceString} / 年</Text>
                    <Text style={styles.planSub}>{getPlanSubtitle(annual, '3 天免费试用后按年自动续订')}</Text>
                    <View style={styles.planBenefits}>
                      <Text style={styles.planBenefitStrong}>包含：全部基础功能 + AI 每月 100 次</Text>
                      <Text style={styles.planBenefit}>联系人照片、更多目标、长期复盘、完整急救工具</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {monthly && (
                  <TouchableOpacity style={[styles.planCard, selected === 'MONTHLY' && styles.planSelected]} onPress={() => setSelected('MONTHLY')} disabled={purchasing}>
                    <View style={styles.planTopRow}><Text style={styles.planName}>月付基础会员</Text></View>
                    <Text style={styles.planPrice}>{monthly.product.priceString} / 月</Text>
                    <Text style={styles.planSub}>{getPlanSubtitle(monthly, '3 天免费试用后按月自动续订')}</Text>
                    <View style={styles.planBenefits}>
                      <Text style={styles.planBenefitStrong}>不包含 AI 冲动倾诉</Text>
                      <Text style={styles.planBenefit}>解锁更多联系人、更多目标和基础复盘功能</Text>
                    </View>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[styles.primaryBtn, (!selectedPackage || purchasing) && styles.disabledBtn]} onPress={() => handlePurchase(selectedPackage)} disabled={!selectedPackage || purchasing}>
                  {purchasing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{selected === 'ANNUAL' ? '开始年付高级会员试用' : '开始月付基础会员试用'}</Text>}
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
              <Text style={styles.laterText}>以后再说，继续使用免费功能</Text>
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
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
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
