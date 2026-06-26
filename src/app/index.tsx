import PageContainer from '@/components/PageContainer';
import HomeCompanionStories from '@/components/HomeCompanionStories';
import MoneySavedCard from '@/components/MoneySavedCard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { checkInNoGamble, claimProtectionCardToday, completeAccompany, completeWalk, getProtectionState, loadAppState } from '../storage';

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

export default function HomePage() {
  const router = useRouter();
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [monthlyDays, setMonthlyDays] = useState(0);
  const [monthlyLoss, setMonthlyLoss] = useState(0);
  const [todayChecked, setTodayChecked] = useState(false);
  const [walked, setWalked] = useState(false);
  const [accompanied, setAccompanied] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [todayGambled, setTodayGambled] = useState(false);
  const [protectionAvailable, setProtectionAvailable] = useState(0);
  const [todayProtected, setTodayProtected] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        const state = await loadAppState();
        setStreak(state.streak);
        setLongestStreak(state.longestStreak);
        setMonthlyDays(state.monthlyDays);
        setTodayChecked(state.todayChecked);
        setWalked(state.walkedToday);
        setAccompanied(state.accompaniedToday);
        setMonthlyLoss(state.monthlyLoss);
        setTodayGambled(state.todayGambled);
        const prot = await getProtectionState();
        setProtectionAvailable(prot.available);
        setTodayProtected(prot.todayProtected);
        setLoading(false);
      };
      init();
    }, [])
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
    setLongestStreak(result.newLongest);
    setMonthlyDays(result.newMonthlyDays);
    setMonthlyLoss(state.monthlyLoss);
    setTodayChecked(true);
    setTodayGambled(false);
    Alert.alert('承诺已记录 🌱', '你已连续坚持 ' + result.newStreak + ' 天。每一天都算数，明天再来一次。');
  }

  async function handleUseProtection() {
    const ok = await claimProtectionCardToday();
    if (!ok) {
      Alert.alert('本月保护卡已用完', '每个日历月有 1 张保护卡，下个月会恢复。');
      return;
    }
    const state = await loadAppState();
    setStreak(state.streak);
    setLongestStreak(state.longestStreak);
    const prot = await getProtectionState();
    setProtectionAvailable(prot.available);
    setTodayProtected(prot.todayProtected);
    Alert.alert('已用保护卡 🛡️', '今天的记录不会中断你的连续天数。这不是失败，是重新站稳。');
  }

  async function handleWalk() {
    await completeWalk();
    setWalked(true);
  }

  async function handleAccompany() {
    await completeAccompany();
    setAccompanied(true);
  }

  if (loading) return <View style={styles.loadingContainer}><Text style={styles.loadingText}>加载中...</Text></View>;

  return (
    <PageContainer>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>新的开始</Text>
          <Text style={styles.headerSub}>NoMoreBets</Text>
          <View style={styles.warmBox}>
            <Text style={styles.warmTitle}>你不是一个人在战斗</Text>
            <Text style={styles.warmText}>无论今天发生了什么，你打开这个 App，就已经是在往回走。</Text>
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
            <View style={styles.statBox}><Text style={styles.statNum}>${monthlyLoss}</Text><Text style={styles.statLabel}>本月损失</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}><Text style={styles.statNum}>{longestStreak}</Text><Text style={styles.statLabel}>最长记录</Text></View>
          </View>
          {todayChecked && (
            <View style={[styles.checkedBadge, todayGambled && styles.checkedBadgeRed]}>
              <Text style={[styles.checkedText, todayGambled && styles.checkedTextRed]}>{todayGambled ? '今天已有赌场记录' : '今天已记录'}</Text>
            </View>
          )}
        </View>

        <MoneySavedCard />

        <View style={styles.pledgeCard}>
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
        <View style={styles.taskCard}>
          <Text style={styles.taskTitle}>今天先守住一件事</Text>
          <View style={styles.taskRow}><Text style={styles.taskItem}>今天状态记录</Text><Text style={[styles.taskStatus, todayChecked && styles.taskDone]}>{todayChecked ? '已完成' : '未完成'}</Text></View>
          <TouchableOpacity style={styles.taskRow} onPress={handleWalk}><Text style={styles.taskItem}>出门散步 10 分钟</Text><Text style={[styles.taskStatus, walked && styles.taskDone]}>{walked ? '已完成' : '点击完成'}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.taskRow} onPress={handleAccompany}><Text style={styles.taskItem}>陪伴家人</Text><Text style={[styles.taskStatus, accompanied && styles.taskDone]}>{accompanied ? '已完成' : '点击完成'}</Text></TouchableOpacity>
        </View>

        <HomeCompanionStories />
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
  statDivider: { width: 1, backgroundColor: '#eee' },
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
  taskCard: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  taskTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  taskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  taskItem: { fontSize: 14, color: '#444' },
  taskStatus: { fontSize: 13, color: '#bbb' },
  taskDone: { color: '#2E7D32', fontWeight: 'bold' },
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
});
