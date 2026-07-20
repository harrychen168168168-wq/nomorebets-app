import { resolveHasAccess } from '@/access';
import { useAuth } from '@/auth';
import PaywallModal from '@/components/PaywallModal';
import { getPlanDay, PLAN_DAYS } from '@/planTasks';
import { getTodayString, loadData, saveData } from '@/storage';
import { getSubscriptionSnapshot } from '@/subscription';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// The paid main course: today's task from the 90-day plan. Free users get the first 3 days as a
// taste, then it's locked. Progress is engagement-based: it advances at most one plan day per calendar
// day the user opens the app, and NEVER skips — so forgetting for a while just pauses progress rather
// than jumping ahead and losing the missed days' tasks.
const FREE_PREVIEW_DAYS = 3;

export default function PlanTodayCard() {
  const { user } = useAuth();
  const [day, setDay] = useState(1);
  const [isPro, setIsPro] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Transient popup shown at the moment of tapping; the lasting per-day status lives in statusMap.
  const [popup, setPopup] = useState<null | 'done' | 'need_time'>(null);
  const [statusMap, setStatusMap] = useState<Record<number, 'done' | 'need_time'>>({});

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
        const rawStatus = await loadData('planTaskStatus');
        // An invited guardian member has no subscription of their own but their payer's plan covers
        // them — without this they hit the day-4 lock like a free user.
        const access = await resolveHasAccess(user?.id, snap);
        if (!active) return;
        setDay(progress);
        setIsPro(access);
        setStatusMap(rawStatus ? JSON.parse(rawStatus) : {});
        setLoaded(true);
      })();
      return () => {
        active = false;
      };
    }, [user?.id])
  );

  async function markStatus(next: 'done' | 'need_time') {
    setPopup(next);
    const updated = { ...statusMap, [day]: next };
    setStatusMap(updated);
    await saveData('planTaskStatus', JSON.stringify(updated));
  }

  if (!loaded) return null;
  const task = getPlanDay(day);
  if (!task) return null;
  const locked = !isPro && day > FREE_PREVIEW_DAYS;
  const todayStatus = statusMap[day];
  const completedCount = Object.values(statusMap).filter((s) => s === 'done').length;

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
      ) : todayStatus === 'done' ? (
        <>
          <Text style={styles.label}>今天的任务 · 第 {day} 天 / 90</Text>
          <Text style={styles.titleDone}>{task.title} ✓</Text>
          <View style={styles.doneBox}>
            <Text style={styles.doneBoxTitle}>你真棒 🎉 今日已完成</Text>
            <Text style={styles.doneBoxCount}>累计完成 {completedCount} 天</Text>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.label}>今天的任务 · 第 {day} 天 / 90</Text>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.body}>{task.body}</Text>
          {todayStatus === 'need_time' ? (
            <Text style={styles.waitNote}>没关系，慢慢来，你随时可以回到这件事。</Text>
          ) : null}
          <View style={styles.feedbackRow}>
            <TouchableOpacity style={[styles.fbBtn, styles.fbBtnDone]} onPress={() => markStatus('done')}>
              <Text style={styles.fbBtnDoneText}>我做到了</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.fbBtn, styles.fbBtnWait]} onPress={() => markStatus('need_time')}>
              <Text style={styles.fbBtnWaitText}>我还需要时间</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal visible={popup !== null} transparent animationType="fade" onRequestClose={() => setPopup(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {popup === 'done' ? (
              <>
                <Text style={styles.modalTitleDone}>你真棒 🎉</Text>
                <TouchableOpacity style={styles.modalBtn} onPress={() => setPopup(null)}><Text style={styles.modalBtnText}>继续</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalText}>我知道你一时心中还有不甘，学会放下，有舍才有得，坚持下去。你会看到希望。</Text>
                <TouchableOpacity style={styles.modalBtn} onPress={() => setPopup(null)}><Text style={styles.modalBtnText}>我再坚持一下</Text></TouchableOpacity>
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
  titleDone: { fontSize: 17, fontWeight: 'bold', color: '#2E7D32', marginBottom: 8 },
  body: { fontSize: 14, color: '#444', lineHeight: 23 },
  doneBox: { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  doneBoxTitle: { fontSize: 15, fontWeight: 'bold', color: '#2E7D32' },
  doneBoxCount: { fontSize: 12, color: '#5B8C5A', marginTop: 4 },
  waitNote: { fontSize: 13, color: '#9A6A00', backgroundColor: '#FFF8E7', borderRadius: 10, padding: 12, marginTop: 14, lineHeight: 20 },
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
  modalBox: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 20, paddingHorizontal: 22, width: '100%', maxWidth: 300 },
  modalTitleDone: { fontSize: 20, fontWeight: 'bold', color: '#2E7D32', textAlign: 'center', marginBottom: 16 },
  modalText: { fontSize: 14, color: '#5D4037', lineHeight: 21, textAlign: 'center', marginBottom: 16 },
  modalBtn: { backgroundColor: '#2E7D32', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
