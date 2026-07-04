import PaywallModal from '@/components/PaywallModal';
import { getPlanDay, PLAN_DAYS } from '@/planTasks';
import { loadMoneyState } from '@/storage';
import { getSubscriptionSnapshot } from '@/subscription';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// The paid main course: today's task from the 90-day plan. Free users get the first 3 days as a
// taste, then it's locked behind the paywall (you can't sell a plan that isn't really there).
const FREE_PREVIEW_DAYS = 3;

export default function PlanTodayCard() {
  const [day, setDay] = useState(1);
  const [isPro, setIsPro] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const money = await loadMoneyState();
        const snap = await getSubscriptionSnapshot();
        if (!active) return;
        setDay(Math.min(PLAN_DAYS.length, Math.max(1, money.daysSinceQuit)));
        setIsPro(snap.isPro);
        setLoaded(true);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  if (!loaded) return null;
  const task = getPlanDay(day);
  if (!task) return null;
  const locked = !isPro && day > FREE_PREVIEW_DAYS;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>今天的任务 · 第 {day} 天 / 90</Text>
      <Text style={styles.title}>{task.title}</Text>
      {locked ? (
        <>
          <Text style={styles.lockedBody}>{task.body.slice(0, 22)}……</Text>
          <TouchableOpacity style={styles.unlockBtn} onPress={() => setShowPaywall(true)}>
            <Text style={styles.unlockText}>🔒 解锁完整 90 天计划</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.body}>{task.body}</Text>
      )}
      <PaywallModal visible={showPaywall} onboardingPrompt onClose={() => setShowPaywall(false)} onSuccess={() => { setShowPaywall(false); setIsPro(true); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', margin: 16, marginTop: 8, marginBottom: 8, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E6EFE6' },
  label: { fontSize: 12, color: '#E67E22', fontWeight: 'bold', marginBottom: 6 },
  title: { fontSize: 17, fontWeight: 'bold', color: '#24352A', marginBottom: 8 },
  body: { fontSize: 14, color: '#444', lineHeight: 23 },
  lockedBody: { fontSize: 14, color: '#999', lineHeight: 23 },
  unlockBtn: { backgroundColor: '#FFF8E7', borderWidth: 1.5, borderColor: '#F3D493', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  unlockText: { color: '#9A6A00', fontSize: 14, fontWeight: 'bold' },
});
