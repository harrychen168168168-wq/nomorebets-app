import PageContainer from '@/components/PageContainer';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { checkInNoGamble, completeAccompany, completeWalk, loadAppState } from '../storage';

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

const HOME_STORIES = [
  { title: '从停车场回头', body: '有人曾经在赌场停车场坐了两个小时，最后没有进去。那一天不是完美的一天，却是他人生重新开始的一天。' },
  { title: '把工资交给未来', body: '发工资那天最危险。先把钱转到安全账户，给家人发一句“帮我守住”，你不是软弱，是在保护未来。' },
  { title: '只撑过今天', body: '戒赌不用一次证明一辈子。你只需要先撑过今天，明天醒来，你会感谢今晚没有下注的自己。' },
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

  async function handleNoGamble() {
    if (todayChecked) return;
    const result = await checkInNoGamble();
    const state = await loadAppState();
    setStreak(result.newStreak);
    setLongestStreak(result.newLongest);
    setMonthlyDays(result.newMonthlyDays);
    setMonthlyLoss(state.monthlyLoss);
    setTodayChecked(true);
    setTodayGambled(false);
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

                <View style={styles.sceneCard}>
          <Text style={styles.sceneTitle}>今天你需要哪种帮助？</Text>
          <Text style={styles.sceneSub}>赌场冲动不一定每天出现，但它来的时候很危险。先选一个最符合你现在情况的入口。</Text>
          <TouchableOpacity style={styles.btnOrange} onPress={() => router.push('/emergency')}>
            <Text style={styles.btnOrangeText}>我现在想去赌场</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={() => router.push({ pathname: '/records', params: { mode: 'relapse' } })}>
            <Text style={styles.btnOutlineText}>我刚从赌场回来</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnGreen, todayChecked && styles.btnDisabled]} onPress={handleNoGamble} disabled={todayChecked}>
            <Text style={styles.btnGreenText}>{todayGambled ? '今天已有赌场记录' : todayChecked ? '今天已记录' : '我今天没有去赌场'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.taskCard}>
          <Text style={styles.taskTitle}>今天先守住一件事</Text>
          <View style={styles.taskRow}><Text style={styles.taskItem}>今天状态记录</Text><Text style={[styles.taskStatus, todayChecked && styles.taskDone]}>{todayChecked ? '已完成' : '未完成'}</Text></View>
          <TouchableOpacity style={styles.taskRow} onPress={handleWalk}><Text style={styles.taskItem}>出门散步 10 分钟</Text><Text style={[styles.taskStatus, walked && styles.taskDone]}>{walked ? '已完成' : '点击完成'}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.taskRow} onPress={handleAccompany}><Text style={styles.taskItem}>陪伴家人</Text><Text style={[styles.taskStatus, accompanied && styles.taskDone]}>{accompanied ? '已完成' : '点击完成'}</Text></TouchableOpacity>
        </View>

        <View style={styles.storySection}>
          <View style={styles.storyHeaderRow}>
            <Text style={styles.storyTitle}>励志故事</Text>
            <TouchableOpacity onPress={() => router.push('/hope')}><Text style={styles.storyMore}>查看更多</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyScroll}>
            {HOME_STORIES.map((story) => (
              <View key={story.title} style={styles.storyCard}>
                <Text style={styles.storyCardTitle}>{story.title}</Text>
                <Text style={styles.storyCardText}>{story.body}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
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
