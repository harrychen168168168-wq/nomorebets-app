import { DailyRecord, getTodayString, loadData, readDailyRecords } from '@/storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// Home "坚持力" card — replaces the estimated-savings card (which was meaningless because real
// win/loss varies). Everything here is REAL behavioral data: current streak, how many urges the
// user resisted (每次在"冲动"页选"我选择不去" 记一次), and a 14-day check-in calendar.
const DAYS_SHOWN = 14;

function addDays(dateStr: string, delta: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

export default function StreakStrengthCard() {
  const [urges, setUrges] = useState(0);
  const [streak, setStreak] = useState(0);
  const [records, setRecords] = useState<DailyRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [u, s, recs] = await Promise.all([loadData('urgesResisted'), loadData('streak'), readDailyRecords()]);
        if (!active) return;
        setUrges(Number(u) || 0);
        setStreak(Number(s) || 0);
        setRecords(recs);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const today = getTodayString();
  const map = new Map(records.map((r) => [r.date, r]));
  const cells: { date: string; kind: 'good' | 'bad' | 'none' }[] = [];
  for (let i = DAYS_SHOWN - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const rec = map.get(date);
    cells.push({ date, kind: rec ? (rec.gambled ? 'bad' : 'good') : 'none' });
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>你的坚持力</Text>
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.num}>{streak}</Text><Text style={styles.label}>连续天数</Text></View>
        <View style={styles.vline} />
        <View style={styles.stat}><Text style={styles.num}>{urges}</Text><Text style={styles.label}>扛住冲动</Text></View>
      </View>
      <Text style={styles.calLabel}>最近 14 天打卡</Text>
      <View style={styles.calRow}>
        {cells.map((c) => (
          <View key={c.date} style={[styles.cell, c.kind === 'good' && styles.cellGood, c.kind === 'bad' && styles.cellBad]} />
        ))}
      </View>
      <Text style={styles.hint}>
        {urges > 0
          ? '你已经 ' + urges + ' 次在冲动面前选择了不去——每一次都是真实的力量。'
          : '冲动来了就去"冲动"页扛住它，这里会记下你每一次的胜利。'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', margin: 16, marginTop: 8, marginBottom: 8, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E6EFE6' },
  title: { fontSize: 16, fontWeight: 'bold', color: '#24352A', marginBottom: 14 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  stat: { flex: 1, alignItems: 'center' },
  num: { fontSize: 32, fontWeight: 'bold', color: '#2E7D32' },
  label: { fontSize: 12, color: '#888', marginTop: 2 },
  vline: { width: 1, height: 36, backgroundColor: '#eee' },
  calLabel: { fontSize: 12, color: '#888', marginBottom: 8 },
  calRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  cell: { width: 18, height: 18, borderRadius: 4, backgroundColor: '#EEF1EE' },
  cellGood: { backgroundColor: '#2E7D32' },
  cellBad: { backgroundColor: '#E57373' },
  hint: { fontSize: 12, color: '#777', lineHeight: 18, marginTop: 12 },
});
