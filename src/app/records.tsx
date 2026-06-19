import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import PageContainer from '@/components/PageContainer';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { DailyRecord, getTodayString, readDailyRecords, upsertDailyRecord } from '../storage';

const MOODS = ['😊 平静', '😄 开心', '😰 焦虑', '😔 低落', '😤 愤怒', '😴 疲惫'];
const GAME_TYPES = ['百家乐', '老虎机', '扑克', '21点', '轮盘', '7张', '体育博彩', '麻将', '骰子', '其他'];

const MONEY_USES = [
  { icon: '🍽️', label: '家庭聚餐', unit: 80, unitLabel: '次' },
  { icon: '👕', label: '孩子衣服', unit: 25, unitLabel: '件' },
  { icon: '🏠', label: '房租', unit: 1200, unitLabel: '个月' },
  { icon: '📚', label: '课外课', unit: 50, unitLabel: '节' },
  { icon: '🚗', label: '汽车保养', unit: 80, unitLabel: '次' },
  { icon: '✈️', label: '全家旅行', unit: 3000, unitLabel: '次' },
];

export default function RecordsPage() {
  const today = getTodayString();
  const todayDate = new Date();
  const [activeTab, setActiveTab] = useState('daily');
  const [gambled, setGambled] = useState<boolean | null>(null);
  const [mood, setMood] = useState('');
  const [impulse, setImpulse] = useState(0);
  const [note, setNote] = useState('');
  const [location, setLocation] = useState('');
  const [gameType, setGameType] = useState('');
  const [result, setResult] = useState<'win' | 'lose' | 'break_even' | ''>('');
  const [amount, setAmount] = useState('');
  const [saved, setSaved] = useState(false);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarYear, setCalendarYear] = useState(todayDate.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(todayDate.getMonth());

  const loadRecordIntoForm = useCallback((date: string, source: DailyRecord[]) => {
    const record = source.find((item) => item.date === date);
    setSelectedDate(date);
    setGambled(record ? record.gambled : null);
    setMood(record?.mood ?? '');
    setImpulse(record?.impulse ?? 0);
    setNote(record?.note ?? '');
    setLocation(record?.location ?? '');
    setGameType(record?.gameType ?? '');
    setResult(record?.result ?? '');
    setAmount(record?.amount ? String(record.amount) : '');
    setSaved(!!record);
  }, []);

  const refreshRecords = useCallback(async () => {
    const loaded = await readDailyRecords();
    setRecords(loaded);
    loadRecordIntoForm(selectedDate, loaded);
  }, [loadRecordIntoForm, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      refreshRecords();
    }, [refreshRecords])
  );

  async function saveDaily() {
    if (gambled === null) {
      Alert.alert('请选择今天有没有赌博', '先选择“没有”或“有”，再保存记录。');
      return;
    }
    const newRecord: DailyRecord = {
      date: selectedDate,
      gambled,
      mood,
      impulse,
      note,
      location: gambled ? location : '',
      gameType: gambled ? gameType : '',
      result: gambled ? result : '',
      amount: gambled && result === 'lose' ? Number(amount) || 0 : 0,
    };
    const updated = await upsertDailyRecord(newRecord);
    setRecords(updated);
    setSaved(true);
    setActiveTab('calendar');
  }

  const lossAmount = Number(amount) || 0;

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const blanks = Array.from({ length: firstDay }, (_, index) => ({ type: 'blank' as const, key: `blank-${index}` }));
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return {
        type: 'day' as const,
        key: dateStr,
        day,
        dateStr,
        record: records.find((item) => item.date === dateStr),
        isFuture: dateStr > today,
      };
    });
    return [...blanks, ...days];
  }, [calendarMonth, calendarYear, records, today]);

  function prevMonth() {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  }

  function nextMonth() {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  }

  return (
    <PageContainer>
      <KeyboardAwareScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📋 记录</Text>
          <Text style={styles.headerSub}>当前编辑：{selectedDate}</Text>
        </View>

        <View style={styles.tabRow}>
          {[
            { key: 'daily', label: selectedDate === today ? '今日记录' : '编辑记录' },
            { key: 'calendar', label: '日历' },
            { key: 'history', label: '历史' },
          ].map(tab => (
            <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => setActiveTab(tab.key)}>
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'daily' && (
          <View>
            {saved && (
              <View style={styles.savedBadge}>
                <Text style={styles.savedText}>✅ {selectedDate} 已记录，可以继续修改</Text>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.questionTitle}>这一天有没有赌博？</Text>
              <View style={styles.optionRow}>
                <TouchableOpacity style={[styles.optionBtn, gambled === false && styles.optionGood]} onPress={() => setGambled(false)}>
                  <Text style={[styles.optionText, gambled === false && styles.optionGoodText]}>✅ 没有</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.optionBtn, gambled === true && styles.optionBad]} onPress={() => setGambled(true)}>
                  <Text style={[styles.optionText, gambled === true && styles.optionBadText]}>有</Text>
                </TouchableOpacity>
              </View>
            </View>

            {gambled === true && (
              <>
                <View style={styles.card}>
                  <Text style={styles.questionTitle}>在哪里赌的？</Text>
                  <TextInput style={styles.inputBox} placeholder="例如：某某赌场、网上平台..." value={location} onChangeText={setLocation} />
                </View>

                <View style={styles.card}>
                  <Text style={styles.questionTitle}>赌博类型？</Text>
                  <View style={styles.reasonGrid}>
                    {GAME_TYPES.map(item => (
                      <TouchableOpacity key={item} style={[styles.reasonBtn, gameType === item && styles.optionGood]} onPress={() => setGameType(item)}>
                        <Text style={[styles.reasonText, gameType === item && styles.optionGoodText]}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.questionTitle}>结果如何？</Text>
                  <View style={styles.optionRow}>
                    {[
                      { key: 'win', label: '赢了' },
                      { key: 'lose', label: '输了' },
                      { key: 'break_even', label: '持平' },
                    ].map(item => (
                      <TouchableOpacity key={item.key} style={[styles.optionBtn, result === item.key && (item.key === 'win' ? styles.optionGood : styles.optionBad)]} onPress={() => setResult(item.key as DailyRecord['result'])}>
                        <Text style={styles.optionText}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {result === 'lose' && (
                  <View style={styles.card}>
                    <Text style={styles.questionTitle}>输了多少钱？</Text>
                    <View style={styles.inputRow}>
                      <Text style={styles.currency}>$</Text>
                      <TextInput style={styles.input} placeholder="输入金额" keyboardType="numeric" value={amount} onChangeText={setAmount} />
                    </View>
                    {lossAmount > 0 && (
                      <View style={styles.lossCard}>
                        <Text style={styles.lossTitle}>这笔钱本可以...</Text>
                        {MONEY_USES.map(item => {
                          const count = Math.floor(lossAmount / item.unit);
                          if (count === 0) return null;
                          return (
                            <View key={item.label} style={styles.lossRow}>
                              <Text style={styles.lossIcon}>{item.icon}</Text>
                              <Text style={styles.lossText}>{item.label} <Text style={styles.lossNum}>{count} {item.unitLabel}</Text></Text>
                            </View>
                          );
                        })}
                        <View style={styles.encourageBox}>
                          <Text style={styles.encourageText}>记录这一次需要很大的勇气。你愿意面对，说明你还没有放弃。</Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {result === 'win' && (
                  <View style={styles.winWarning}>
                    <Text style={styles.winWarningText}>⚠️ 今天赢了，但请记住</Text>
                    <Text style={styles.winWarningSubText}>赌场的设计让你短期可能赢，但长期概率永远对庄家有利。今天的赢，往往是下次更大损失的开始。</Text>
                  </View>
                )}
              </>
            )}

            <View style={styles.card}>
              <Text style={styles.questionTitle}>这一天的情绪？</Text>
              <View style={styles.moodGrid}>
                {MOODS.map(item => (
                  <TouchableOpacity key={item} style={[styles.moodBtn, mood === item && styles.moodSelected]} onPress={() => setMood(item)}>
                    <Text style={[styles.moodText, mood === item && styles.moodSelectedText]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.questionTitle}>赌博冲动程度？</Text>
              <View style={styles.impulseRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <TouchableOpacity key={n} style={[styles.impulseBtn, impulse === n && styles.impulseSelected]} onPress={() => setImpulse(n)}>
                    <Text style={styles.impulseEmoji}>{n === 1 ? '😌' : n === 2 ? '🙂' : n === 3 ? '😰' : n === 4 ? '😤' : '🚨'}</Text>
                    <Text style={[styles.impulseText, impulse === n && styles.impulseSelectedText]}>{n === 1 ? '很低' : n === 2 ? '较低' : n === 3 ? '一般' : n === 4 ? '较强' : '很强'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.questionTitle}>这一天发生了什么？</Text>
              <TextInput style={styles.textArea} placeholder="写下感受，不用很多字，几句话就好..." multiline numberOfLines={4} value={note} onChangeText={setNote} />
            </View>

            <TouchableOpacity style={styles.btnSave} onPress={saveDaily}>
              <Text style={styles.btnSaveText}>💾 保存记录</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'calendar' && (
          <View style={styles.card}>
            <View style={styles.calendarNav}>
              <TouchableOpacity onPress={prevMonth} style={styles.navBtn}><Text style={styles.navBtnText}>‹</Text></TouchableOpacity>
              <Text style={styles.calendarTitle}>{calendarYear}年{calendarMonth + 1}月</Text>
              <TouchableOpacity onPress={nextMonth} style={styles.navBtn}><Text style={styles.navBtnText}>›</Text></TouchableOpacity>
            </View>
            <View style={styles.weekRow}>{['日', '一', '二', '三', '四', '五', '六'].map(d => <Text key={d} style={styles.weekLabel}>{d}</Text>)}</View>
            <View style={styles.calendarGrid}>
              {calendarDays.map(item => {
                if (item.type === 'blank') return <View key={item.key} style={styles.calendarCell} />;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.calendarCell, selectedDate === item.dateStr && styles.calendarCellSelected, item.record && !item.record.gambled && styles.calendarGood, item.record && item.record.gambled && styles.calendarBad, item.isFuture && styles.calendarFuture]}
                    onPress={() => {
                      if (item.isFuture) return;
                      loadRecordIntoForm(item.dateStr, records);
                      setActiveTab('daily');
                    }}
                    disabled={item.isFuture}
                  >
                    <Text style={[styles.calendarDay, selectedDate === item.dateStr && styles.calendarDaySelected, item.isFuture && styles.calendarDayFuture]}>{item.day}</Text>
                    {item.record && <Text style={styles.calendarDot}>{item.record.gambled ? '❌' : '✅'}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.calendarLegend}>
              <Text style={styles.legendItem}>✅ 无赌博</Text>
              <Text style={styles.legendItem}>❌ 有赌博</Text>
              <Text style={styles.legendItem}>空白 未记录</Text>
            </View>
          </View>
        )}

        {activeTab === 'history' && (
          <View>
            {records.length === 0 ? (
              <View style={styles.emptyCard}><Text style={styles.emptyText}>还没有记录，从今天开始吧！</Text></View>
            ) : (
              records.map(record => (
                <TouchableOpacity key={record.date} style={[styles.historyCard, record.gambled && styles.historyCardBad]} onPress={() => { loadRecordIntoForm(record.date, records); setActiveTab('daily'); }}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyDate}>{record.date}</Text>
                    <Text style={record.gambled ? styles.historyBad : styles.historyGood}>{record.gambled ? '❌ 有赌博' : '✅ 无赌博'}</Text>
                  </View>
                  {record.gambled && record.location ? <Text style={styles.historyDetail}>📍 {record.location}</Text> : null}
                  {record.gambled && record.gameType ? <Text style={styles.historyDetail}>🎲 {record.gameType}</Text> : null}
                  {record.gambled && record.result ? <Text style={styles.historyDetail}>{record.result === 'win' ? '💰 赢了' : record.result === 'lose' ? `💸 输了 $${record.amount}` : '➖ 持平'}</Text> : null}
                  {record.mood ? <Text style={styles.historyDetail}>{record.mood}</Text> : null}
                  {record.note ? <Text style={styles.historyNote}>{record.note}</Text> : null}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </KeyboardAwareScrollView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF7' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#2E7D32' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 4 },
  tabRow: { flexDirection: 'row', margin: 16, marginBottom: 8, backgroundColor: '#eee', borderRadius: 10, padding: 4 },
  tab: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, color: '#888' },
  tabTextActive: { color: '#2E7D32', fontWeight: 'bold' },
  savedBadge: { backgroundColor: '#E8F5E9', margin: 16, marginBottom: 8, borderRadius: 10, padding: 12, alignItems: 'center' },
  savedText: { color: '#2E7D32', fontWeight: 'bold', fontSize: 13 },
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  questionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  optionRow: { flexDirection: 'row', gap: 12 },
  optionBtn: { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 14, alignItems: 'center' },
  optionGood: { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' },
  optionBad: { borderColor: '#D32F2F', backgroundColor: '#FFF1F1' },
  optionText: { fontSize: 15, color: '#555' },
  optionGoodText: { color: '#2E7D32', fontWeight: 'bold' },
  optionBadText: { color: '#D32F2F', fontWeight: 'bold' },
  inputBox: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#333' },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reasonBtn: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  reasonText: { fontSize: 14, color: '#555' },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12 },
  currency: { fontSize: 18, color: '#333', marginRight: 8 },
  input: { flex: 1, fontSize: 18, paddingVertical: 12, color: '#333' },
  lossCard: { backgroundColor: '#FFF8F0', borderRadius: 12, padding: 16, marginTop: 16 },
  lossTitle: { fontSize: 15, fontWeight: 'bold', color: '#E67E22', marginBottom: 12 },
  lossRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#FFE0C0' },
  lossIcon: { fontSize: 22, marginRight: 12 },
  lossText: { fontSize: 14, color: '#555' },
  lossNum: { fontWeight: 'bold', color: '#E67E22' },
  encourageBox: { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 14, marginTop: 14 },
  encourageText: { fontSize: 13, color: '#2E7D32', lineHeight: 21, textAlign: 'center' },
  winWarning: { backgroundColor: '#FFF8E7', margin: 16, marginBottom: 8, borderRadius: 12, padding: 16 },
  winWarningText: { fontSize: 15, fontWeight: 'bold', color: '#E67E22', marginBottom: 6 },
  winWarningSubText: { fontSize: 13, color: '#666', lineHeight: 20 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moodBtn: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  moodSelected: { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' },
  moodText: { fontSize: 13, color: '#555' },
  moodSelectedText: { color: '#2E7D32', fontWeight: 'bold' },
  impulseRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  impulseBtn: { flex: 1, alignItems: 'center', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, paddingVertical: 12 },
  impulseSelected: { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' },
  impulseEmoji: { fontSize: 22 },
  impulseText: { fontSize: 11, color: '#888', marginTop: 4 },
  impulseSelectedText: { color: '#2E7D32', fontWeight: 'bold' },
  textArea: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#333', minHeight: 100, textAlignVertical: 'top' },
  btnSave: { backgroundColor: '#2E7D32', margin: 16, borderRadius: 12, padding: 18, alignItems: 'center' },
  btnSaveText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  calendarTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, color: '#888', fontWeight: 'bold' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calendarCellSelected: { backgroundColor: '#2E7D32' },
  calendarGood: { backgroundColor: '#E8F5E9' },
  calendarBad: { backgroundColor: '#FFF1F1' },
  calendarDay: { fontSize: 14, color: '#333' },
  calendarDaySelected: { color: '#fff', fontWeight: 'bold' },
  calendarDot: { fontSize: 8 },
  calendarLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16 },
  legendItem: { fontSize: 12, color: '#888' },
  emptyCard: { margin: 16, padding: 40, alignItems: 'center' },
  emptyText: { color: '#aaa', fontSize: 15 },
  historyCard: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 16 },
  historyCardBad: { borderLeftWidth: 4, borderLeftColor: '#FFCDD2' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  historyDate: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  historyGood: { fontSize: 13, color: '#2E7D32' },
  historyBad: { fontSize: 13, color: '#D32F2F' },
  historyDetail: { fontSize: 13, color: '#666', marginBottom: 4 },
  historyNote: { fontSize: 13, color: '#444', marginTop: 4, lineHeight: 20, fontStyle: 'italic' },
  calendarNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { padding: 8 },
  navBtnText: { fontSize: 24, color: '#2E7D32', fontWeight: 'bold' },
  calendarFuture: { opacity: 0.3 },
  calendarDayFuture: { color: '#aaa' },
});
