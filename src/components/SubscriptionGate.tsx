import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Purchases from 'react-native-purchases';
import PaywallModal from './PaywallModal';
import { configureRevenueCat, customerInfoToSnapshot, getFriendlyPurchaseError } from '@/subscription';

type Props = {
  onUnlock: () => void;
  reason?: string;
};

// Whole-app lock shown when there is no active subscription (own or via an active payer).
// Everything is gated EXCEPT the crisis hotlines, which stay reachable for user safety.
export default function SubscriptionGate({ onUnlock, reason }: Props) {
  const [showPaywall, setShowPaywall] = useState(false);
  const [busy, setBusy] = useState(false);

  const sharedHint = reason === 'no_active_shared_membership' || reason === 'no_guardian_link' || reason === 'no_entitlement';

  async function handleRestore() {
    if (busy) return;
    try {
      setBusy(true);
      await configureRevenueCat();
      const info = await Purchases.restorePurchases();
      if (customerInfoToSnapshot(info).isPro) {
        onUnlock();
      } else {
        Alert.alert('没有找到有效订阅', '当前 Apple ID 没有有效订阅。如果你是被守护人，请确认守护你的人订阅仍然有效。');
      }
    } catch (error) {
      Alert.alert('恢复失败', getFriendlyPurchaseError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.icon}>🌱</Text>
      <Text style={styles.title}>继续你的戒赌之路</Text>
      <Text style={styles.body}>
        使用 NoMoreBets 需要有效的订阅。
        {sharedHint
          ? '如果你是被家人或伙伴守护的用户，请确认守护你的人订阅仍然有效；或自己开通订阅。'
          : '你的订阅可能已到期或已取消，续订后即可继续使用全部功能。'}
      </Text>

      <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowPaywall(true)}>
        <Text style={styles.primaryText}>查看订阅方案</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={handleRestore} disabled={busy}>
        {busy ? <ActivityIndicator color="#2E7D32" /> : <Text style={styles.secondaryText}>恢复购买</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.refreshBtn} onPress={onUnlock}>
        <Text style={styles.refreshText}>我已订阅 / 已被重新守护，刷新</Text>
      </TouchableOpacity>

      <View style={styles.crisisCard}>
        <Text style={styles.crisisTitle}>需要立即帮助？这些随时可用</Text>
        <TouchableOpacity style={styles.crisisBtn} onPress={() => Linking.openURL('tel:988')}>
          <Text style={styles.crisisBtnText}>心理危机热线 988</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.crisisBtn} onPress={() => Linking.openURL('tel:1-800-522-4700')}>
          <Text style={styles.crisisBtnText}>全国赌博热线 1-800-522-4700</Text>
        </TouchableOpacity>
        <Text style={styles.crisisNote}>如果你处于立即危险，请拨打 911。</Text>
      </View>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSuccess={() => { setShowPaywall(false); onUnlock(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAF7', alignItems: 'center', justifyContent: 'center', padding: 28 },
  icon: { fontSize: 52, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#2E7D32', marginBottom: 12, textAlign: 'center' },
  body: { fontSize: 14, color: '#555', lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  primaryBtn: { backgroundColor: '#2E7D32', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40, alignItems: 'center', width: '100%' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  secondaryBtn: { borderWidth: 1.5, borderColor: '#2E7D32', borderRadius: 14, paddingVertical: 14, alignItems: 'center', width: '100%', marginTop: 12 },
  secondaryText: { color: '#2E7D32', fontSize: 15, fontWeight: 'bold' },
  refreshBtn: { paddingVertical: 14, alignItems: 'center' },
  refreshText: { color: '#888', fontSize: 13, textDecorationLine: 'underline' },
  crisisCard: { backgroundColor: '#FFF8F0', borderRadius: 16, padding: 16, width: '100%', marginTop: 16, borderWidth: 1, borderColor: '#FFE0B2' },
  crisisTitle: { fontSize: 14, fontWeight: 'bold', color: '#E67E22', marginBottom: 12, textAlign: 'center' },
  crisisBtn: { backgroundColor: '#FFF', borderRadius: 10, padding: 13, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#F1D2B0' },
  crisisBtnText: { color: '#C0392B', fontSize: 14, fontWeight: 'bold' },
  crisisNote: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 4 },
});
