import { useAuth } from '@/auth';
import { buildStoryDraftFromRecord, containsSelfHarm, isCommunityConfigured, pushMyGuardianStatus, submitPublicStory } from '@/community';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import PageContainer from '@/components/PageContainer';
import { DailyRecord, deleteDailyRecord, getTodayString, readDailyRecords, upsertDailyRecord } from '@/storage';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const MOODS = ['平静', '开心', '焦虑', '低落', '愤怒', '疲惫'];
const GAME_TYPES = ['赌场', '线上赌场', '体育博彩', '彩票', '棋牌/麻将', '交易式赌博冲动', '其他'];

function emptyForm(date: string): DailyRecord {
  return { date, gambled: false, mood: '', impulse: 0, note: '', location: '', gameType: '赌场', result: '', amount: 0 };
}

function formatDate(date: string) {
  const [, month, day] = date.split('-');
  return Number(month) + '月' + Number(day) + '日';
}

function resultLabel(record: DailyRecord) {
  if (!record.gambled) return '没有去赌场';
  if (record.result === 'win') return '去了赌场 · 有赢钱诱因';
  if (record.result === 'lose') return '去了赌场 · 发生损失';
  if (record.result === 'break_even') return '去了赌场 · 持平';
  return '去了赌场';
}

function reviewSummary(record: DailyRecord) {
  if (record.gambled) return '这不是结局，是需要看清的信号。下次重点是提前离开环境，先停止继续损失。';
  return '今天你守住了一个关键选择。下次冲动出现时，继续先离开触发环境，把这一小时撑过去。';
}

export default function RecordsPage() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const today = getTodayString();
  const [activeTab, setActiveTab] = useState<'daily' | 'calendar' | 'history' | 'review'>('daily');
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [form, setForm] = useState<DailyRecord>(emptyForm(today));
  const [editing, setEditing] = useState(true);
  const [storyDraft, setStoryDraft] = useState<{ title: string; excerpt: string; body: string } | null>(null);
  const [displayMode, setDisplayMode] = useState<'anonymous' | 'nickname'>('anonymous');

  const selectedRecord = records.find((record) => record.date === selectedDate);

  const refreshRecords = useCallback(async () => {
    const loaded = await readDailyRecords();
    setRecords(loaded);
    const current = loaded.find((record) => record.date === selectedDate);
    setForm(current || emptyForm(selectedDate));
  }, [selectedDate]);

  useFocusEffect(useCallback(() => {
    refreshRecords();
  }, [refreshRecords]));

  useEffect(() => {
    if (params.mode === 'relapse') {
      setSelectedDate(today);
      setForm({ ...emptyForm(today), gambled: true, gameType: '赌场' });
      setActiveTab('daily');
      setEditing(true);
    }
  }, [params.mode, today]);

  const calendarDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { date, day, record: records.find((item) => item.date === date), future: date > today };
    });
  }, [records, today]);

  function loadForEdit(date: string) {
    const record = records.find((item) => item.date === date);
    setSelectedDate(date);
    setForm(record || emptyForm(date));
    setEditing(true);
    setActiveTab('daily');
  }

  function openReview(date: string) {
    const record = records.find((item) => item.date === date);
    if (!record) {
      loadForEdit(date);
      return;
    }
    setSelectedDate(date);
    setForm(record);
    setEditing(false);
    setActiveTab('review');
  }

  async function saveDaily() {
    const saved = await upsertDailyRecord({
      ...form,
      date: selectedDate,
      location: form.gambled ? form.location : '',
      gameType: form.gambled ? form.gameType || '赌场' : '赌场',
      result: form.gambled ? form.result : '',
      amount: form.gambled && form.result === 'lose' ? Number(form.amount) || 0 : 0,
    });
    setRecords(saved);
    setEditing(false);
    setActiveTab('review');
    // Keep linked guardians' view fresh right after a record is saved.
    if (user) pushMyGuardianStatus(user.id).catch(() => {});
  }

  async function removeRecord() {
    Alert.alert('删除这条记录？', '删除后本机无法恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const updated = await deleteDailyRecord(selectedDate);
          setRecords(updated);
          setActiveTab('history');
        },
      },
    ]);
  }

  function prepareStoryDraft(record: DailyRecord) {
    setStoryDraft(buildStoryDraftFromRecord(record));
    setDisplayMode('anonymous');
  }

  async function submitDraft() {
    if (!storyDraft || !selectedRecord || !user) return;
    if (!isCommunityConfigured()) {
      Alert.alert('需要配置 Supabase', '公开故事要跨用户展示，需要先配置 EXPO_PUBLIC_SUPABASE_URL 和 EXPO_PUBLIC_SUPABASE_ANON_KEY。');
      return;
    }
    if (containsSelfHarm(storyDraft.body) || containsSelfHarm(storyDraft.title)) {
      Alert.alert('先照顾好自己', '这条内容包含自伤相关的表达，不适合公开发布。你现在的安全最重要：请联系身边可信的人，或拨打/发短信 988（心理危机热线）。如果有立即危险，请拨打 911。', [{ text: '我知道了' }]);
      return;
    }
    const hasNickname = !!user.displayName?.trim();
    const effectiveMode: 'anonymous' | 'nickname' = displayMode === 'nickname' && hasNickname ? 'nickname' : 'anonymous';
    if (displayMode === 'nickname' && !hasNickname) {
      Alert.alert('还没有昵称', '你还没有设置昵称，这条故事会以“匿名用户”发布。你可以在“我的”页面设置昵称后再用昵称发布。');
    }
    try {
      await submitPublicStory({
        sourceRecordDate: selectedRecord.date,
        authorUserId: user.id,
        displayMode: effectiveMode,
        displayName: effectiveMode === 'nickname' ? (user.displayName as string).trim() : '匿名用户',
        gamblingType: 'casino',
        title: storyDraft.title,
        excerpt: storyDraft.excerpt,
        body: storyDraft.body,
      });
      setStoryDraft(null);
      Alert.alert('已提交审核', '管理员通过后才会公开展示。你的每日记录仍然是私密的。');
    } catch (error: any) {
      Alert.alert('提交失败', error?.message || '请稍后再试。');
    }
  }

  function updateForm(updates: Partial<DailyRecord>) {
    setForm((current) => ({ ...current, ...updates }));
  }

  return (
    <PageContainer>
      <KeyboardAwareScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{activeTab === 'review' ? '当日回顾' : activeTab === 'history' ? '戒赌日志' : '今日记录'}</Text>
          <Text style={styles.headerSub}>{selectedDate}</Text>
        </View>

        <View style={styles.tabRow}>
          {[
            { key: 'daily', label: '今日记录' },
            { key: 'calendar', label: '日历' },
            { key: 'history', label: '戒赌日志' },
          ].map((tab) => (
            <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => tab.key === 'daily' ? loadForEdit(today) : setActiveTab(tab.key as any)}>
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'daily' && editing ? (
          <View>
            <View style={styles.card}>
              <Text style={styles.questionTitle}>这一天有没有去赌场或赌博？</Text>
              <View style={styles.optionRow}>
                <TouchableOpacity style={[styles.optionBtn, !form.gambled && styles.optionGood]} onPress={() => updateForm({ gambled: false, result: '', amount: 0 })}><Text style={styles.optionText}>没有去赌场</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.optionBtn, form.gambled && styles.optionBad]} onPress={() => updateForm({ gambled: true, gameType: form.gameType || '赌场' })}><Text style={styles.optionText}>去了赌场</Text></TouchableOpacity>
              </View>
            </View>

            {form.gambled ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.questionTitle}>赌博类型</Text>
                  <View style={styles.grid}>{GAME_TYPES.map((type) => <TouchableOpacity key={type} style={[styles.chip, form.gameType === type && styles.chipActive]} onPress={() => updateForm({ gameType: type })}><Text style={styles.chipText}>{type}</Text></TouchableOpacity>)}</View>
                </View>
                <View style={styles.card}>
                  <Text style={styles.questionTitle}>地点或高风险场景</Text>
                  <TextInput style={styles.inputBox} value={form.location} onChangeText={(location) => updateForm({ location })} placeholder="例如：路过赌场、发工资后、独处、停车场附近" />
                </View>
                <View style={styles.card}>
                  <Text style={styles.questionTitle}>当天结果</Text>
                  <View style={styles.optionRow}>
                    {[
                      { key: 'win', label: '赢了一点' },
                      { key: 'lose', label: '发生损失' },
                      { key: 'break_even', label: '持平' },
                    ].map((item) => <TouchableOpacity key={item.key} style={[styles.optionBtn, form.result === item.key && styles.optionBad]} onPress={() => updateForm({ result: item.key as DailyRecord['result'] })}><Text style={styles.optionText}>{item.label}</Text></TouchableOpacity>)}
                  </View>
                  {form.result === 'lose' ? <TextInput style={[styles.inputBox, { marginTop: 12 }]} keyboardType="numeric" value={String(form.amount || '')} onChangeText={(amount) => updateForm({ amount: Number(amount) || 0 })} placeholder="损失金额 $" /> : null}
                </View>
              </>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.questionTitle}>心情</Text>
              <View style={styles.grid}>{MOODS.map((item) => <TouchableOpacity key={item} style={[styles.chip, form.mood === item && styles.chipActive]} onPress={() => updateForm({ mood: item })}><Text style={styles.chipText}>{item}</Text></TouchableOpacity>)}</View>
            </View>

            <View style={styles.card}>
              <Text style={styles.questionTitle}>冲动等级：{form.impulse}/10</Text>
              <View style={styles.grid}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => <TouchableOpacity key={value} style={[styles.impulseBtn, form.impulse === value && styles.impulseActive]} onPress={() => updateForm({ impulse: value })}><Text style={styles.impulseText}>{value}</Text></TouchableOpacity>)}</View>
            </View>

            <View style={styles.card}>
              <Text style={styles.questionTitle}>今天最危险的一刻 / 备注</Text>
              <TextInput style={styles.textArea} multiline value={form.note} onChangeText={(note) => updateForm({ note })} placeholder="写下触发点、你怎么撑住，或下次要提前避开的信号。" />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={saveDaily}><Text style={styles.primaryBtnText}>保存记录</Text></TouchableOpacity>
          </View>
        ) : null}

        {activeTab === 'calendar' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>本月记录</Text>
            <View style={styles.calendarGrid}>
              {calendarDays.map((item) => (
                <TouchableOpacity key={item.date} disabled={item.future} style={[styles.dayCell, item.record && !item.record.gambled && styles.dayGood, item.record?.gambled && styles.dayBad, item.future && styles.dayFuture]} onPress={() => item.record ? openReview(item.date) : loadForEdit(item.date)}>
                  <Text style={styles.dayText}>{item.day}</Text>
                  {item.record ? <Text style={styles.dayDot}>{item.record.gambled ? '高风险' : '守住'}</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {activeTab === 'history' ? (
          <View>
            {records.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyText}>还没有戒赌日志。先从今天记录一次真实状态。</Text></View> : records.map((record) => (
              <TouchableOpacity key={record.date} style={styles.logCard} onPress={() => openReview(record.date)}>
                <Text style={styles.logDate}>{formatDate(record.date)}</Text>
                <Text style={record.gambled ? styles.logBad : styles.logGood}>{resultLabel(record)} · 冲动 {record.impulse || 0}/10</Text>
                <Text style={styles.logDetail}>诱因：{record.location || record.note || '未填写'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {activeTab === 'review' && selectedRecord ? (
          <View>
            <View style={styles.reviewHero}>
              <Text style={styles.reviewDate}>{formatDate(selectedRecord.date)}</Text>
              <Text style={selectedRecord.gambled ? styles.reviewBad : styles.reviewGood}>{resultLabel(selectedRecord)}</Text>
              <Text style={styles.reviewText}>{reviewSummary(selectedRecord)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>当日信息</Text>
              <Text style={styles.rowText}>赌博类型：{selectedRecord.gameType || '赌场'}</Text>
              <Text style={styles.rowText}>冲动等级：{selectedRecord.impulse || 0}/10</Text>
              <Text style={styles.rowText}>心情：{selectedRecord.mood || '未填写'}</Text>
              <Text style={styles.rowText}>高风险场景：{selectedRecord.location || '未填写'}</Text>
              <Text style={styles.rowText}>今天最危险的一刻：{selectedRecord.note || '未填写'}</Text>
              <Text style={styles.rowText}>下次提醒：提前离开环境，不带现金，不靠近赌场，先联系一个真人。</Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => loadForEdit(selectedRecord.date)}><Text style={styles.primaryBtnText}>编辑这条记录</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => prepareStoryDraft(selectedRecord)}><Text style={styles.secondaryBtnText}>生成公开故事草稿</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => Alert.alert('一周分析', '后续会接 AI 周分析；当前先保留入口，不影响记录。')}><Text style={styles.secondaryBtnText}>让 AI 分析这一周</Text></TouchableOpacity>
            <TouchableOpacity style={styles.dangerBtn} onPress={removeRecord}><Text style={styles.dangerBtnText}>删除这条记录</Text></TouchableOpacity>
          </View>
        ) : null}

        {storyDraft ? (
          <View style={styles.draftBox}>
            <Text style={styles.cardTitle}>公开故事草稿</Text>
            <Text style={styles.cardSub}>每日记录默认永远私密。只有你确认提交后，管理员审核通过才会公开。</Text>
            <TextInput style={styles.inputBox} value={storyDraft.title} onChangeText={(title) => setStoryDraft({ ...storyDraft, title })} />
            <TextInput style={styles.textArea} multiline value={storyDraft.body} onChangeText={(body) => setStoryDraft({ ...storyDraft, body, excerpt: body.slice(0, 90) })} />
            <View style={styles.optionRow}>
              <TouchableOpacity style={[styles.optionBtn, displayMode === 'anonymous' && styles.optionGood]} onPress={() => setDisplayMode('anonymous')}><Text style={styles.optionText}>匿名发布</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.optionBtn, displayMode === 'nickname' && styles.optionGood]} onPress={() => setDisplayMode('nickname')}><Text style={styles.optionText}>使用昵称</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={submitDraft}><Text style={styles.primaryBtnText}>提交审核</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStoryDraft(null)}><Text style={styles.secondaryBtnText}>取消</Text></TouchableOpacity>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </KeyboardAwareScrollView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF7' },
  header: { alignItems: 'center', paddingTop: 56, paddingBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#2E7D32' },
  headerSub: { fontSize: 12, color: '#777', marginTop: 4 },
  tabRow: { flexDirection: 'row', margin: 16, marginBottom: 8, backgroundColor: '#eee', borderRadius: 10, padding: 4 },
  tab: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, color: '#777' },
  tabTextActive: { color: '#2E7D32', fontWeight: 'bold' },
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 14, padding: 18 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#24352A', marginBottom: 8 },
  cardSub: { fontSize: 12, color: '#777', lineHeight: 18, marginBottom: 12 },
  questionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 14 },
  optionRow: { flexDirection: 'row', gap: 10 },
  optionBtn: { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 13, alignItems: 'center' },
  optionGood: { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' },
  optionBad: { borderColor: '#D32F2F', backgroundColor: '#FFF1F1' },
  optionText: { fontSize: 14, color: '#444', fontWeight: 'bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  chipActive: { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' },
  chipText: { fontSize: 13, color: '#444' },
  inputBox: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#333', backgroundColor: '#fff', marginBottom: 10 },
  textArea: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#333', minHeight: 110, textAlignVertical: 'top', backgroundColor: '#fff' },
  impulseBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  impulseActive: { borderColor: '#E67E22', backgroundColor: '#FFF1E7' },
  impulseText: { fontSize: 14, color: '#333', fontWeight: 'bold' },
  primaryBtn: { backgroundColor: '#2E7D32', margin: 16, marginBottom: 8, borderRadius: 12, padding: 15, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  secondaryBtn: { backgroundColor: '#E8F5E9', margin: 16, marginTop: 4, marginBottom: 8, borderRadius: 12, padding: 14, alignItems: 'center' },
  secondaryBtnText: { color: '#2E7D32', fontSize: 14, fontWeight: 'bold' },
  dangerBtn: { borderWidth: 1, borderColor: '#F1B7B7', margin: 16, marginTop: 4, borderRadius: 12, padding: 14, alignItems: 'center' },
  dangerBtnText: { color: '#C62828', fontSize: 14, fontWeight: 'bold' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayCell: { width: '13%', minHeight: 54, borderRadius: 10, backgroundColor: '#F8FAF7', alignItems: 'center', justifyContent: 'center', padding: 4 },
  dayGood: { backgroundColor: '#E8F5E9' },
  dayBad: { backgroundColor: '#FFF1F1' },
  dayFuture: { opacity: 0.35 },
  dayText: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  dayDot: { fontSize: 9, color: '#666', marginTop: 2 },
  emptyCard: { backgroundColor: '#fff', margin: 16, borderRadius: 14, padding: 20 },
  emptyText: { fontSize: 14, color: '#777', lineHeight: 22 },
  logCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E6EFE6' },
  logDate: { fontSize: 16, color: '#24352A', fontWeight: 'bold', marginBottom: 6 },
  logGood: { fontSize: 13, color: '#2E7D32', fontWeight: 'bold' },
  logBad: { fontSize: 13, color: '#C62828', fontWeight: 'bold' },
  logDetail: { fontSize: 12, color: '#777', marginTop: 6 },
  reviewHero: { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 22, alignItems: 'center' },
  reviewDate: { fontSize: 15, color: '#777', marginBottom: 8 },
  reviewGood: { fontSize: 22, color: '#2E7D32', fontWeight: 'bold', marginBottom: 10 },
  reviewBad: { fontSize: 22, color: '#C62828', fontWeight: 'bold', marginBottom: 10 },
  reviewText: { fontSize: 14, color: '#444', lineHeight: 22, textAlign: 'center' },
  rowText: { fontSize: 14, color: '#444', lineHeight: 24 },
  draftBox: { backgroundColor: '#FFFDF7', margin: 16, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#FFE0A8' },
});
