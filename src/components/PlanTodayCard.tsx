import PaywallModal from '@/components/PaywallModal';
import { getPlanDay, PLAN_DAYS } from '@/planTasks';
import { getTodayString, loadData, saveData } from '@/storage';
import { getSubscriptionSnapshot } from '@/subscription';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// The paid main course: today's task from the 90-day plan. Free users get the first 3 days as a
// taste, then it's locked. Progress is engagement-based: it advances at most one plan day per calendar
// day the user opens the app, and NEVER skips — so forgetting for a while just pauses progress rather
// than jumping ahead and losing the missed days' tasks.
const FREE_PREVIEW_DAYS = 3;

export default function PlanTodayCard() {
  const [day, setDay] = useState(1);
  const [isPro, setIsPro] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [response, setResponse] = useState<null | 'done' | 'need_time'>(null);

  // Reset the self-check when the plan day advances, so a new day starts with fresh buttons.
  useEffect(() => { setResponse(null); }, [day]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const snap = await getSubscriptionSnapshot();
        const today = getTodayString();
        // Advance at most one plan day per calendar day the user opens the app; never skip.
        let progress = Number(await loadData('planDay')) || 0;
        const lastAdvance = await loadData('planLastAdvanceDate');
        if (progress < 1) {
          progress = 1;
          await saveData('planDay', '1');
          await saveData('planLastAdvanceDate', today);
        } else if (lastAdvance !== today) {
          progress = Math.min(PLAN_DAYS.length, progress + 1);
          await saveData('planDay', String(progress));
          await saveData('planLastAdvanceDate', today);
        }
        if (!active) return;
        setDay(progress);
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
      {locked ? (
        <>
          <Text style={styles.label}>90 天新生计划</Text>
          <Text style={styles.title}>一天一件小事，陪你走完 90 天</Text>
          <Text style={styles.lockedBody}>切断触发 → 稳住习惯 → 修复关系 → 拿回人生。解锁后，每天给你一件具体、能做到的小事。</Text>
          <TouchableOpacity style={styles.unlockBtn} onPress={() => setShowPaywall(true)}>
            <Text style={styles.unlockText}>🔒 解锁完整 90 天计划</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.label}>今天的任务 · 第 {day} 天 / 90</Text>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.body}>{task.body}</Text>
          <View style={styles.feedbackRow}>
            <TouchableOpacity style={[styles.fbBtn, styles.fbBtnDone]} onPress={() => setResponse('done')}>
              <Text style={styles.fbBtnDoneText}>我做到了</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.fbBtn, styles.fbBtnWait]} onPress={() => setResponse('need_time')}>
              <Text style={styles.fbBtnWaitText}>我还需要时间</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal visible={response !== null} transparent animationType="fade" onRequestClose={() => setResponse(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {response === 'done' ? (
              <>
                <Text style={styles.modalTitleDone}>你真棒 🎉</Text>
                <TouchableOpacity style={styles.modalBtn} onPress={() => setResponse(null)}><Text style={styles.modalBtnText}>继续</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalText}>我知道你一时心中还有不甘，学会放下，有舍才有得，坚持下去。你会看到希望。</Text>
                <TouchableOpacity style={styles.modalBtn} onPress={() => setResponse(null)}><Text style={styles.modalBtnText}>我再坚持一下</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  feedbackRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  fbBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  fbBtnDone: { backgroundColor: '#2E7D32' },
  fbBtnDoneText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  fbBtnWait: { backgroundColor: '#FFF8E7', borderWidth: 1.5, borderColor: '#F3D493' },
  fbBtnWaitText: { color: '#9A6A00', fontSize: 15, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%' },
  modalTitleDone: { fontSize: 24, fontWeight: 'bold', color: '#2E7D32', textAlign: 'center', marginBottom: 24 },
  modalText: { fontSize: 15, color: '#5D4037', lineHeight: 24, textAlign: 'center', marginBottom: 24 },
  modalBtn: { backgroundColor: '#2E7D32', borderRadius: 12, padding: 16, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
