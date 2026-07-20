import { resolveHasAccess } from '@/access';
import { useAuth } from '@/auth';
import HomeCompanionStories from '@/components/HomeCompanionStories';
import PageContainer from '@/components/PageContainer';
import PaywallModal from '@/components/PaywallModal';
import PlanTodayCard from '@/components/PlanTodayCard';
import { getReminderSettings } from '@/notifications';
import { maybeAskReview, REVIEW_STREAK_7 } from '@/review';
import { getSubscriptionSnapshot } from '@/subscription';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { checkInNoGamble, claimProtectionCardToday, getProtectionState, getTodayString, loadAppState, loadData, loadMoneyState, readDailyRecords, saveData } from '../storage';

const QUOTES = [
  '赌场赢的是概率，你赢回的是人生。',
  '每一天不赌，都是送给家人最好的礼物。',
  '冲动会过去，选择会留下。',
  '你戒掉的不只是赌博，是重新拿回自己的人生。',
  '今天守住，明天就会轻一点。',
];

const MILESTONES = [
  { days: 1, emoji: '🌱', label: '第一步' },
  { days: 7, emoji: '🌿', label: '一周勇士' },
  { days: 30, emoji: '🌳', label: '一月坚持' },
  { days: 90, emoji: '🏆', label: '三月英雄' },
  { days: 365, emoji: '👑', label: '一年新生' },
];

// Turn a loss amount into everyday things it could have bought — the visual gut-punch.
// Only tiers the amount actually covers (n >= 1) are shown, biggest first, max 3.
const LOSS_EQUIV = [
  { per: 40, emoji: '👕', label: (n: number) => `给孩子买 ${n} 件新衣服` },
  { per: 120, emoji: '🍽️', label: (n: number) => `带全家下 ${n} 次馆子` },
  { per: 300, emoji: '🎢', label: (n: number) => `陪孩子玩 ${n} 天游乐园` },
  { per: 1500, emoji: '✈️', label: (n: number) => `带全家旅行 ${n} 次` },
  { per: 15000, emoji: '🚗', label: (n: number) => (n > 1 ? `换 ${n} 辆二手车` : '给自己换一辆二手车') },
  { per: 50000, emoji: '🏠', label: (_n: number) => '一套房子的首付' },
];

function lossEquivalents(amount: number) {
  return LOSS_EQUIV
    .map((e) => ({ ...e, n: Math.floor(amount / e.per) }))
    .filter((e) => e.n >= 1)
    .slice(-3)
    .reverse();
}

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [streak, setStreak] = useState(0);
  const [monthlyDays, setMonthlyDays] = useState(0);
  const [monthlyLoss, setMonthlyLoss] = useState(0);
  const [todayChecked, setTodayChecked] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [todayGambled, setTodayGambled] = useState(false);
  const [protectionAvailable, setProtectionAvailable] = useState(0);
  const [todayProtected, setTodayProtected] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [showReconvert, setShowReconvert] = useState(false);
  const [reconvertLoss, setReconvertLoss] = useState(0);
  const [showLossDetail, setShowLossDetail] = useState(false);
  const [lossItems, setLossItems] = useState<{ date: string; amount: number; gameType: string }[]>([]);

  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        const state = await loadAppState();
        setStreak(state.streak);
        setMonthlyDays(state.monthlyDays);
        setTodayChecked(state.todayChecked);
        setMonthlyLoss(state.monthlyLoss);
        setTodayGambled(state.todayGambled);
        const snap = await getSubscriptionSnapshot();
        // Paint from local state first. The guardian-link lookup below is a network call, and
        // gating the first frame on it left free users (who never short-circuit on isPro) staring
        // at 「加载中...」 for as long as the request took to fail.
        setIsPro(snap.isPro);
        const localProt = await getProtectionState(snap.isPro ? 3 : 1);
        setProtectionAvailable(localProt.available);
        setTodayProtected(localProt.todayProtected);
        setLoading(false);

        // Guardian members are covered by their payer's plan; without this they get one protection
        // card and a re-convert paywall aimed at someone whose family already paid for them.
        const pro = await resolveHasAccess(user?.id, snap);
        if (pro !== snap.isPro) {
          setIsPro(pro);
          const prot = await getProtectionState(pro ? 3 : 1);
          setProtectionAvailable(prot.available);
          setTodayProtected(prot.todayProtected);
        }
        if (!pro) maybeReconvert(state.streak);
      };
      init();
    }, [user?.id])
  );

  useEffect(() => {
    const timer = setInterval(() => setQuoteIndex((prev) => (prev + 1) % QUOTES.length), 10000);
    return () => clearInterval(timer);
  }, []);

  const currentMilestone = MILESTONES.filter((m) => streak >= m.days).pop() || MILESTONES[0];
  const nextMilestone = MILESTONES.find((m) => streak < m.days);

  async function handlePledge() {
    if (todayChecked) return;
    const result = await checkInNoGamble();
    const state = await loadAppState();
    setStreak(result.newStreak);
    setMonthlyDays(result.newMonthlyDays);
    setMonthlyLoss(state.monthlyLoss);
    setTodayChecked(true);
    setTodayGambled(false);
    // Ask for a rating only after they dismiss the celebration, and only once they've earned a real
    // week — a 7-day streak is this app's peak-pride moment, which is when a rating ask is welcome.
    Alert.alert('承诺已记录 🌱', '你已连续坚持 ' + result.newStreak + ' 天。每一天都算数，明天再来一次。', [
      { text: '好', onPress: () => { if (result.newStreak >= 7) maybeAskReview(REVIEW_STREAK_7); } },
    ]);
  }

  async function handleUseProtection() {
    const max = isPro ? 3 : 1;
    const ok = await claimProtectionCardToday(max);
    if (!ok) {
      Alert.alert('本月保护卡已用完', isPro ? '每个日历月有 3 张保护卡，下个月会恢复。' : '免费版每月 1 张保护卡；升级会员每月 3 张。');
      return;
    }
    const state = await loadAppState();
    setStreak(state.streak);
    const prot = await getProtectionState(max);
    setProtectionAvailable(prot.available);
    setTodayProtected(prot.todayProtected);
    Alert.alert('已用保护卡 🛡️', '今天的记录不会中断你的连续天数。这不是失败，是重新站稳。');
  }

  // Re-conversion at hot moments: day-7 streak and payday (non-Pro only, once each).
  async function openReconvert() {
    const money = await loadMoneyState();
    setReconvertLoss(money.baselineMonthlySpend);
    setShowReconvert(true);
  }

  async function maybeReconvert(currentStreak: number) {
    const today = getTodayString();
    const month = today.slice(0, 7);
    if (currentStreak >= 7 && !(await loadData('reconv_day7'))) {
      await saveData('reconv_day7', '1');
      openReconvert();
      return;
    }
    const settings = await getReminderSettings();
    const dayNum = Number(today.slice(8, 10));
    if (settings.paydayEnabled && dayNum === settings.paydayDay && !(await loadData('reconv_payday_' + month))) {
      await saveData('reconv_payday_' + month, '1');
      openReconvert();
    }
  }

  async function openLossDetail() {
    const records = await readDailyRecords();
    const month = getTodayString().slice(0, 7);
    const items = records
      .filter((r) => r.date.startsWith(month) && r.gambled && r.result === 'lose')
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r) => ({ date: r.date, amount: Number(r.amount) || 0, gameType: r.gameType || '' }));
    setLossItems(items);
    setShowLossDetail(true);
  }

  if (loading) return <View style={styles.loadingContainer}><Text style={styles.loadingText}>加载中...</Text></View>;

  return (
    <PageContainer>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>新的开始</Text>
          <Text style={styles.headerSub}>NoMoreBets</Text>
          <View style={styles.warmBox}>
            <Text style={styles.warmText}>无论今天发生了什么，你打开这个 App，就已经在自救了。</Text>
          </View>
        </View>

        <View style={styles.mainCard}>
          <View style={styles.milestoneBadge}>
            <Text style={styles.milestoneEmoji}>{currentMilestone.emoji}</Text>
            <Text style={styles.milestoneLabel}>{currentMilestone.label}</Text>
          </View>
          <Text style={styles.alreadyText}>已坚持</Text>
          <View style={styles.daysRow}><Text style={styles.daysNumber}>{streak}</Text><Text style={styles.daysUnit}>天</Text></View>
          <Text style={styles.daysDesc}>每一天不去赌场，都是新的开始。</Text>
          {nextMilestone && (
            <View style={styles.progressRow}>
              <View style={styles.progressBar}><View style={[styles.progressFill, { width: (String(Math.min((streak / nextMilestone.days) * 100, 100)) + '%') as any }]} /></View>
              <Text style={styles.progressLabel}>距离“{nextMilestone.emoji} {nextMilestone.label}”还剩 {nextMilestone.days - streak} 天</Text>
            </View>
          )}
          <View style={styles.quoteBox}><Text style={styles.quoteText}>{QUOTES[quoteIndex]}</Text></View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}><Text style={styles.statNum}>{monthlyDays}</Text><Text style={styles.statLabel}>本月守住</Text></View>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statBox} onPress={openLossDetail} activeOpacity={0.7}><Text style={styles.statNum}>${monthlyLoss}</Text><Text style={styles.statLabelLink}>本月损失 ›</Text></TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statBox} onPress={() => router.push('/emergency')} activeOpacity={0.7}><Text style={styles.statActionIcon}>💪</Text><Text style={styles.statLabelLink}>扛住冲动 ›</Text></TouchableOpacity>
          </View>

          <View style={styles.pledgeSection}>
            {todayChecked && !todayGambled ? (
              <>
                <Text style={styles.pledgeDoneTitle}>✓ 今天已承诺不赌</Text>
                <Text style={styles.pledgeStreakBig}>已连续 {streak} 天</Text>
                <Text style={styles.pledgeWarm}>你今天又为自己赢回了一天。明天再来一次。</Text>
              </>
            ) : todayGambled ? (
              todayProtected ? (
                <>
                  <Text style={styles.pledgeDoneTitle}>🛡️ 今天已用保护卡</Text>
                  <Text style={styles.pledgeStreakBig}>已连续 {streak} 天</Text>
                  <Text style={styles.pledgeWarm}>连续记录保住了。这不是失败，是重新站稳，明天继续。</Text>
                </>
              ) : (
                <>
                  <Text style={styles.pledgeWarm}>今天有过高风险记录——这不是结局。明天是新的一天，你随时可以重新承诺。</Text>
                  {protectionAvailable > 0 ? (
                    <TouchableOpacity style={styles.protectBtn} onPress={handleUseProtection}>
                      <Text style={styles.protectBtnText}>🛡️ 用一张保护卡保住连续记录（本月剩 {protectionAvailable} 张）</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )
            ) : (
              <>
                <Text style={styles.pledgeTitle}>今天的承诺</Text>
                <Text style={styles.pledgeSub}>每天郑重地对自己说一次“今天不赌”，是最简单也最有力的一步。</Text>
                <TouchableOpacity style={styles.pledgeBtn} onPress={handlePledge}>
                  <Text style={styles.pledgeBtnText}>我承诺：今天不赌</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <PlanTodayCard />

        <View style={styles.sceneCard}>
          <Text style={styles.sceneTitle}>今天你需要哪种帮助？</Text>
          <Text style={styles.sceneSub}>赌场冲动不一定每天出现，但它来的时候很危险。先选一个最符合你现在情况的入口。</Text>
          <TouchableOpacity style={styles.btnOrange} onPress={() => router.push('/emergency')}>
            <Text style={styles.btnOrangeText}>我现在想去赌场</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={() => router.push({ pathname: '/records', params: { mode: 'relapse' } })}>
            <Text style={styles.btnOutlineText}>我刚从赌场回来</Text>
          </TouchableOpacity>
        </View>
        <HomeCompanionStories />
        <PaywallModal visible={showReconvert} onboardingPrompt monthlyLoss={reconvertLoss} onClose={() => setShowReconvert(false)} onSuccess={() => { setShowReconvert(false); setIsPro(true); }} />

        <Modal visible={showLossDetail} transparent animationType="fade" onRequestClose={() => setShowLossDetail(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>本月损失明细</Text>
              <Text style={styles.modalTotal}>本月累计损失 ${monthlyLoss}</Text>
              {lossItems.length === 0 ? (
                <Text style={styles.modalEmpty}>本月暂无损失记录，继续保持。</Text>
              ) : (
                <ScrollView style={styles.modalList}>
                  {lossItems.map((item, idx) => (
                    <View key={item.date + '_' + idx} style={styles.lossRow}>
                      <View style={styles.lossRowLeft}>
                        <Text style={styles.lossDate}>{item.date}</Text>
                        {item.gameType ? <Text style={styles.lossType}>{item.gameType}</Text> : null}
                      </View>
                      <Text style={styles.lossAmount}>-${item.amount}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
              {monthlyLoss > 0 && lossEquivalents(monthlyLoss).length > 0 ? (
                <View style={styles.equivBox}>
                  <Text style={styles.equivTitle}>这些钱，本可以是——</Text>
                  {lossEquivalents(monthlyLoss).map((e) => (
                    <Text key={e.per} style={styles.equivRow}>{e.emoji} {e.label(e.n)}</Text>
                  ))}
                </View>
              ) : null}
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowLossDetail(false)}>
                <Text style={styles.modalCloseText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <View style={{ height: 40 }} />
      </ScrollView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAF7' },
  loadingText: { fontSize: 16, color: '#888' },
  container: { flex: 1, backgroundColor: '#F8FAF7' },
  header: { alignItems: 'center', paddingTop: 50, paddingBottom: 8, paddingHorizontal: 16 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#2E7D32' },
  headerSub: { fontSize: 13, color: '#aaa', marginTop: 2 },
  warmBox: { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 16, marginTop: 14, width: '100%' },
  warmTitle: { fontSize: 16, fontWeight: 'bold', color: '#2E7D32', marginBottom: 6, textAlign: 'center' },
  warmText: { fontSize: 13, color: '#444', textAlign: 'center', lineHeight: 21 },
  mainCard: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  milestoneBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8E7', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 12, gap: 6 },
  milestoneEmoji: { fontSize: 20 },
  milestoneLabel: { fontSize: 14, fontWeight: 'bold', color: '#E67E22' },
  alreadyText: { fontSize: 16, color: '#888', marginBottom: 4 },
  daysRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  daysNumber: { fontSize: 80, fontWeight: 'bold', color: '#2E7D32', lineHeight: 88 },
  daysUnit: { fontSize: 28, color: '#2E7D32', marginBottom: 12 },
  daysDesc: { fontSize: 13, color: '#888', marginTop: 4, textAlign: 'center' },
  progressRow: { width: '100%', marginTop: 12, marginBottom: 4 },
  progressBar: { height: 6, backgroundColor: '#eee', borderRadius: 3, width: '100%', marginBottom: 6 },
  progressFill: { height: 6, backgroundColor: '#2E7D32', borderRadius: 3 },
  progressLabel: { fontSize: 11, color: '#888', textAlign: 'center' },
  quoteBox: { backgroundColor: '#FFF8E7', borderRadius: 10, padding: 12, marginTop: 14, width: '100%' },
  quoteText: { fontSize: 13, color: '#5D4037', textAlign: 'center', lineHeight: 20, fontStyle: 'italic' },
  statsRow: { flexDirection: 'row', marginTop: 16, width: '100%' },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: 'bold', color: '#2E7D32' },
  statLabel: { fontSize: 11, color: '#aaa', marginTop: 2, textAlign: 'center' },
  statLabelLink: { fontSize: 11, color: '#2E7D32', fontWeight: 'bold', marginTop: 2, textAlign: 'center' },
  statActionIcon: { fontSize: 20, lineHeight: 24 },
  statDivider: { width: 1, backgroundColor: '#eee' },
  pledgeSection: { width: '100%', marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#F0F0F0', alignItems: 'center' },
  checkedBadge: { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 12, alignSelf: 'center' },
  checkedBadgeRed: { backgroundColor: '#FFF1F1' },
  checkedText: { color: '#2E7D32', fontSize: 13 },
  checkedTextRed: { color: '#D32F2F' },
  btnGreen: { backgroundColor: '#2E7D32', marginTop: 10, borderRadius: 12, padding: 18, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#A5D6A7' },
  btnGreenText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  btnOutline: { backgroundColor: '#fff', marginTop: 10, borderRadius: 12, padding: 18, alignItems: 'center', borderWidth: 1.5, borderColor: '#ccc' },
  btnOutlineText: { color: '#555', fontSize: 18 },
  btnOrange: { backgroundColor: '#E67E22', marginTop: 12, borderRadius: 12, padding: 18, alignItems: 'center' },
  btnOrangeText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  confirmBox: { backgroundColor: '#FFF8E7', margin: 16, marginTop: 0, borderRadius: 12, padding: 20 },
  confirmTitle: { fontSize: 16, fontWeight: 'bold', color: '#E67E22', marginBottom: 8 },
  confirmText: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 16 },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  confirmCancel: { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 12, alignItems: 'center' },
  confirmCancelText: { color: '#888', fontSize: 14 },
  confirmOk: { flex: 1, backgroundColor: '#2E7D32', borderRadius: 10, padding: 12, alignItems: 'center' },
  confirmOkText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  pledgeCard: { backgroundColor: '#fff', margin: 16, marginTop: 8, marginBottom: 8, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E6EFE6' },
  pledgeTitle: { fontSize: 17, fontWeight: 'bold', color: '#2E7D32', marginBottom: 6 },
  pledgeSub: { fontSize: 13, color: '#777', lineHeight: 20, textAlign: 'center', marginBottom: 14 },
  pledgeBtn: { backgroundColor: '#2E7D32', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 36, alignItems: 'center', width: '100%' },
  pledgeBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  pledgeDoneTitle: { fontSize: 16, fontWeight: 'bold', color: '#2E7D32', marginBottom: 4 },
  pledgeStreakBig: { fontSize: 34, fontWeight: 'bold', color: '#2E7D32', marginBottom: 8 },
  pledgeWarm: { fontSize: 13, color: '#666', lineHeight: 21, textAlign: 'center' },
  protectBtn: { backgroundColor: '#FFF8E7', borderWidth: 1.5, borderColor: '#F3D493', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', marginTop: 14, width: '100%' },
  protectBtnText: { color: '#9A6A00', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  storySection: { marginTop: 8, paddingVertical: 18 },
  storyHeaderRow: { paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  storyTitle: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  storyMore: { fontSize: 13, color: '#2E7D32', fontWeight: 'bold' },
  storyScroll: { paddingHorizontal: 16, gap: 12 },
  storyCard: { width: 250, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E6EFE6' },
  storyCardTitle: { fontSize: 15, fontWeight: 'bold', color: '#2E7D32', marginBottom: 8 },
  storyCardText: { fontSize: 13, color: '#444', lineHeight: 20 },
  sceneCard: { backgroundColor: '#fff', margin: 16, marginTop: 8, marginBottom: 8, borderRadius: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  sceneTitle: { fontSize: 18, fontWeight: 'bold', color: '#2E7D32', marginBottom: 8 },
  sceneSub: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 10 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 380, maxHeight: '75%' },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#2E7D32', marginBottom: 4, textAlign: 'center' },
  modalTotal: { fontSize: 13, color: '#888', marginBottom: 12, textAlign: 'center' },
  modalEmpty: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 24, lineHeight: 20 },
  modalList: { flexGrow: 0 },
  lossRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  lossRowLeft: { flex: 1, paddingRight: 12 },
  lossDate: { fontSize: 14, color: '#444' },
  lossType: { fontSize: 11, color: '#aaa', marginTop: 2 },
  lossAmount: { fontSize: 15, fontWeight: 'bold', color: '#D32F2F' },
  equivBox: { backgroundColor: '#FFF8E7', borderRadius: 12, padding: 14, marginTop: 12 },
  equivTitle: { fontSize: 13, fontWeight: 'bold', color: '#9A6A00', marginBottom: 8 },
  equivRow: { fontSize: 14, color: '#5D4037', lineHeight: 26 },
  modalCloseBtn: { marginTop: 14, backgroundColor: '#2E7D32', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  modalCloseText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
