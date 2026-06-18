import PageContainer from '@/components/PageContainer';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { checkInNoGamble, checkInRelapse, completeAccompany, completeWalk, loadAppState } from '../storage';

const QUOTES = [
  "赌场赢的是概率，你赢的是人生。",
  "每一天不赌博，都是送给家人最好的礼物。",
  "冲动是魔鬼，理智是你真正的力量。",
  "你戒掉的不只是赌博，是重新拿回了自己的人生。",
  "今天的坚持，是明天家人笑容的来源。",
  "钱输了可以再赚，时间和家人的信任输了很难再回来。",
  "你比你想象的更强大。",
  "每一次说不，都是对未来的一次投资。",
  "戒赌不是失去什么，而是找回真正的自己。",
  "此刻的坚持，就是最好的你。",
];

const MILESTONES = [
  { days: 1, emoji: '🌱', label: '第一步' },
  { days: 7, emoji: '🌿', label: '一周勇士' },
  { days: 30, emoji: '🌳', label: '一月坚强' },
  { days: 90, emoji: '🏆', label: '三月英雄' },
  { days: 180, emoji: '💎', label: '半年蜕变' },
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
  const [showRelapseConfirm, setShowRelapseConfirm] = useState(false);
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
    const timer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const currentMilestone = MILESTONES.filter(m => streak >= m.days).pop() || MILESTONES[0];
  const nextMilestone = MILESTONES.find(m => streak < m.days);

  async function handleNoGamble() {
    if (todayChecked) return;
    const result = await checkInNoGamble(streak, monthlyDays, longestStreak);
    const state = await loadAppState();
    setStreak(result.newStreak);
    setLongestStreak(result.newLongest);
    setMonthlyDays(result.newMonthlyDays);
    setMonthlyLoss(state.monthlyLoss);
    setTodayChecked(true);
    setTodayGambled(false);
  }

  async function handleRelapse() {
    setShowRelapseConfirm(true);
  }

  async function confirmRelapse() {
    await checkInRelapse();
    setStreak(0);
    setTodayChecked(true);
    setTodayGambled(true);
    setShowRelapseConfirm(false);
  }

  async function handleWalk() {
    await completeWalk();
    setWalked(true);
  }

  async function handleAccompany() {
    await completeAccompany();
    setAccompanied(true);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <PageContainer>
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>新的开始</Text>
        <Text style={styles.headerSub}>NoMoreBets</Text>
        <View style={styles.warmBox}>
          <Text style={styles.warmTitle}>你不是一个人在战斗 💚</Text>
          <Text style={styles.warmText}>无论今天发生了什么，你打开这个App，就已经是勇气的表现。我们陪着你，一步一步来。</Text>
        </View>
      </View>

     <View style={styles.mainCard}>
        {/* 里程碑标签 */}
        <View style={styles.milestoneBadge}>
          <Text style={styles.milestoneEmoji}>{currentMilestone.emoji}</Text>
          <Text style={styles.milestoneLabel}>{currentMilestone.label}</Text>
        </View>

        {/* 天数 */}
        <Text style={styles.alreadyText}>已坚持</Text>
        <View style={styles.daysRow}>
          <Text style={styles.daysNumber}>{streak}</Text>
          <Text style={styles.daysUnit}>天</Text>
        </View>
        <Text style={styles.daysDesc}>每一天不赌博，都是新的开始</Text>

        {/* 下一里程碑进度 */}
        {nextMilestone && (
          <View style={styles.progressRow}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min((streak / nextMilestone.days) * 100, 100)}%` }]} />
            </View>
            <Text style={styles.progressLabel}>距「{nextMilestone.emoji}{nextMilestone.label}」还有 {nextMilestone.days - streak} 天</Text>
          </View>
        )}
        </View>
        {/* 语录 */}
        <View style={styles.quoteBox}>
          <Text style={styles.quoteText}>💬 {QUOTES[quoteIndex]}</Text>
        </View>

        {/* 三项统计 */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{monthlyDays}</Text>
            <Text style={styles.statLabel}>本月无赌</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>${monthlyLoss}</Text>
            <Text style={styles.statLabel}>本月损失</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{longestStreak}</Text>
            <Text style={styles.statLabel}>最长记录</Text>
          </View>
        </View>

        {todayChecked && (
          <View style={[styles.checkedBadge, todayGambled && styles.checkedBadgeRed]}>
            <Text style={[styles.checkedText, todayGambled && styles.checkedTextRed]}>
              {todayGambled ? '⚠️ 今天有赌博记录' : '✅ 今天已打卡'}
            </Text>
          </View>
        )}

      <TouchableOpacity
        style={[styles.btnGreen, (todayChecked || todayGambled) && styles.btnDisabled]}
        onPress={handleNoGamble}
        disabled={todayChecked || todayGambled}
      >
        <Text style={styles.btnGreenText}>
          {todayGambled ? '今天已有赌博记录' : '✅ 今天我没有赌博'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnOutline} onPress={handleRelapse}>
        <Text style={styles.btnOutlineText}>😔 今天没有忍住</Text>
      </TouchableOpacity>
      {showRelapseConfirm && (
        <View style={styles.confirmBox}>
          <Text style={styles.confirmTitle}>诚实面对，重新出发</Text>
          <Text style={styles.confirmText}>记录这次失误需要很大的勇气。你愿意重新开始吗？</Text>
          <View style={styles.confirmBtns}>
            <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowRelapseConfirm(false)}>
              <Text style={styles.confirmCancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmOk} onPress={confirmRelapse}>
              <Text style={styles.confirmOkText}>重新开始 💪</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.btnOrange} onPress={() => router.push('/emergency')}>
        <Text style={styles.btnOrangeText}>🚨 我想去赌场了</Text>
      </TouchableOpacity>

      <View style={styles.taskCard}>
        <Text style={styles.taskTitle}>💪 今日小目标</Text>
        <View style={styles.taskRow}>
          <Text style={styles.taskItem}>🌅 今天打卡</Text>
          <Text style={[styles.taskStatus, todayChecked && styles.taskDone]}>
            {todayChecked ? '已完成 ✓' : '未完成'}
          </Text>
        </View>
        <TouchableOpacity style={styles.taskRow} onPress={handleWalk}>
          <Text style={styles.taskItem}>🚶 出门散步10分钟</Text>
          <Text style={[styles.taskStatus, walked && styles.taskDone]}>
            {walked ? '已完成 ✓' : '点击完成'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.taskRow} onPress={handleAccompany}>
          <Text style={styles.taskItem}>❤️ 陪伴家人</Text>
          <Text style={[styles.taskStatus, accompanied && styles.taskDone]}>
            {accompanied ? '已完成 ✓' : '点击完成'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.encourageCard}>
        <Text style={styles.encourageTitle}>🌟 你知道吗？</Text>
        <Text style={styles.encourageText}>
          {streak >= 30
            ? `坚持${streak}天了！你的大脑已经在恢复中，冲动越来越少，这是科学证明的事实。继续走下去。`
            : streak >= 7
            ? `坚持${streak}天了！这段时间你的大脑正在慢慢恢复正常的多巴胺分泌，冲动会越来越少。`
            : streak >= 1
            ? `你已经坚持了${streak}天！每一天不赌博，大脑都在悄悄修复。继续加油。`
            : `今天是新的开始。迈出第一步，点击上方打卡，告诉自己：我可以的。`}
        </Text>
      </View>

      <View style={{height: 40}} />
    </ScrollView>
    </PageContainer>
  );
}const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAF7' },
  loadingText: { fontSize: 16, color: '#888' },
  container: { flex: 1, backgroundColor: '#F8FAF7' },
  header: { alignItems: 'center', paddingTop: 50, paddingBottom: 8, paddingHorizontal: 16 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#2E7D32' },
  headerSub: { fontSize: 13, color: '#aaa', marginTop: 2 },
  warmBox: { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 16, marginTop: 14, width: '100%' },
  warmTitle: { fontSize: 16, fontWeight: 'bold', color: '#2E7D32', marginBottom: 6, textAlign: 'center' },
  warmText: { fontSize: 13, color: '#444', textAlign: 'center', lineHeight: 21 },
  milestoneBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8E7', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 12, gap: 6 },
  milestoneEmoji: { fontSize: 20 },
  milestoneLabel: { fontSize: 14, fontWeight: 'bold', color: '#E67E22' },
  progressRow: { width: '100%', marginTop: 12, marginBottom: 4 },
  progressBar: { height: 6, backgroundColor: '#eee', borderRadius: 3, width: '100%', marginBottom: 6 },
  progressFill: { height: 6, backgroundColor: '#2E7D32', borderRadius: 3 },
  progressLabel: { fontSize: 11, color: '#888', textAlign: 'center' },
  mainCard: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  alreadyText: { fontSize: 16, color: '#888', marginBottom: 4 },
  daysRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  daysNumber: { fontSize: 80, fontWeight: 'bold', color: '#2E7D32', lineHeight: 88 },
  daysUnit: { fontSize: 28, color: '#2E7D32', marginBottom: 12 },
  daysDesc: { fontSize: 13, color: '#888', marginTop: 4, textAlign: 'center' },
  quoteBox: { backgroundColor: '#FFF8E7', borderRadius: 10, padding: 12, marginTop: 14, width: '100%' },
  quoteText: { fontSize: 13, color: '#5D4037', textAlign: 'center', lineHeight: 20, fontStyle: 'italic' },
  statsRow: { flexDirection: 'row', marginTop: 16, width: '100%' },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: 'bold', color: '#2E7D32' },
  statLabel: { fontSize: 11, color: '#aaa', marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: '#eee' },
  checkedBadge: { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 12, alignSelf: 'center' },
  checkedText: { color: '#2E7D32', fontSize: 13 },
  btnGreen: { backgroundColor: '#2E7D32', margin: 16, marginBottom: 8, borderRadius: 12, padding: 18, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#A5D6A7' },
  btnGreenText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  btnOutline: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 12, padding: 18, alignItems: 'center', borderWidth: 1.5, borderColor: '#ccc' },
  btnOutlineText: { color: '#555', fontSize: 18 },
  btnOrange: { backgroundColor: '#E67E22', margin: 16, marginBottom: 8, borderRadius: 12, padding: 18, alignItems: 'center' },
  btnOrangeText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  taskCard: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  taskTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  taskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  taskItem: { fontSize: 14, color: '#444' },
  taskStatus: { fontSize: 13, color: '#bbb' },
  taskDone: { color: '#2E7D32', fontWeight: 'bold' },
  encourageCard: { backgroundColor: '#E8F5E9', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  encourageTitle: { fontSize: 15, fontWeight: 'bold', color: '#2E7D32', marginBottom: 8 },
  encourageText: { fontSize: 13, color: '#444', lineHeight: 22 },
  checkedBadgeRed: { backgroundColor: '#FFF1F1' },
  checkedTextRed: { color: '#D32F2F' },
  confirmBox: { backgroundColor: '#FFF8E7', margin: 16, marginTop: 0, borderRadius: 12, padding: 20 },
  confirmTitle: { fontSize: 16, fontWeight: 'bold', color: '#E67E22', marginBottom: 8 },
  confirmText: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 16 },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  confirmCancel: { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 12, alignItems: 'center' },
  confirmCancelText: { color: '#888', fontSize: 14 },
  confirmOk: { flex: 1, backgroundColor: '#2E7D32', borderRadius: 10, padding: 12, alignItems: 'center' },
  confirmOkText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});