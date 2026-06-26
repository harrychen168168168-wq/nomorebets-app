import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { loadMoneyState, MoneyState, setBaselineMonthlySpend, setSavingsGoal } from '../storage';

// The single strongest motivator for a gambler is money. This card turns "days clean" into a
// concrete, daily-growing "money saved" number, optionally tied to a personal savings goal.
export default function MoneySavedCard() {
  const [money, setMoney] = useState<MoneyState | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [spend, setSpend] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalAmount, setGoalAmount] = useState('');

  const load = useCallback(() => {
    loadMoneyState().then((m) => {
      setMoney(m);
      setSpend(m.baselineMonthlySpend ? String(m.baselineMonthlySpend) : '');
      setGoalTitle(m.savingsGoal.title);
      setGoalAmount(m.savingsGoal.amount ? String(m.savingsGoal.amount) : '');
    });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function save() {
    await setBaselineMonthlySpend(Number(spend) || 0);
    await setSavingsGoal({ title: goalTitle, amount: Number(goalAmount) || 0 });
    setMode('view');
    load();
  }

  if (!money) return null;

  // First-time setup: ask for the baseline spend so the home can compute "money saved".
  if (!money.hasBaseline && mode === 'view') {
    return (
      <View style={styles.setupCard}>
        <Text style={styles.setupTitle}>看看你戒赌省下了多少钱 💰</Text>
        <Text style={styles.setupSub}>填一个大概数字，首页就会每天帮你算“已经省下多少”。这是坚持下去最实在的动力。</Text>
        <Text style={styles.label}>你以前平均每月在赌博上花多少？</Text>
        <View style={styles.inputRow}>
          <Text style={styles.dollar}>$</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={spend} onChangeText={setSpend} placeholder="例如 1000" />
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={save}><Text style={styles.saveText}>开始计算</Text></TouchableOpacity>
      </View>
    );
  }

  if (mode === 'edit') {
    return (
      <View style={styles.setupCard}>
        <Text style={styles.setupTitle}>编辑省钱设置</Text>
        <Text style={styles.label}>以前平均每月赌博花费</Text>
        <View style={styles.inputRow}><Text style={styles.dollar}>$</Text><TextInput style={styles.input} keyboardType="numeric" value={spend} onChangeText={setSpend} placeholder="例如 1000" /></View>
        <Text style={styles.label}>这些钱我要用来（可选）</Text>
        <TextInput style={styles.inputFull} value={goalTitle} onChangeText={setGoalTitle} placeholder="例如 还清信用卡 / 给孩子存学费 / 一次旅行" />
        <Text style={styles.label}>目标金额（可选）</Text>
        <View style={styles.inputRow}><Text style={styles.dollar}>$</Text><TextInput style={styles.input} keyboardType="numeric" value={goalAmount} onChangeText={setGoalAmount} placeholder="例如 5000" /></View>
        <View style={styles.editBtns}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => { setMode('view'); load(); }}><Text style={styles.cancelText}>取消</Text></TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn2} onPress={save}><Text style={styles.saveText}>保存</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  const goal = money.savingsGoal;
  const progress = goal.amount > 0 ? Math.min((money.savedAmount / goal.amount) * 100, 100) : 0;
  return (
    <View style={styles.heroCard}>
      <Text style={styles.heroLabel}>戒赌至今已省下</Text>
      <Text style={styles.heroAmount}>${money.savedAmount.toLocaleString()}</Text>
      <Text style={styles.heroDays}>已经走过 {money.daysSinceQuit} 天 · 每天都在省</Text>
      {goal.title ? (
        <View style={styles.goalBox}>
          <Text style={styles.goalTitle}>🎯 {goal.title}</Text>
          {goal.amount > 0 ? (
            <>
              <View style={styles.progressBar}><View style={[styles.progressFill, { width: (String(progress) + '%') as any }]} /></View>
              <Text style={styles.goalProgress}>${money.savedAmount.toLocaleString()} / ${goal.amount.toLocaleString()}（{Math.round(progress)}%）</Text>
            </>
          ) : null}
        </View>
      ) : null}
      <TouchableOpacity onPress={() => setMode('edit')}><Text style={styles.editLink}>编辑省钱设置 / 储蓄目标</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: { backgroundColor: '#0B7A3B', margin: 16, marginBottom: 8, borderRadius: 18, padding: 22, alignItems: 'center' },
  heroLabel: { color: '#CDEBD7', fontSize: 14, marginBottom: 4 },
  heroAmount: { color: '#fff', fontSize: 46, fontWeight: 'bold', letterSpacing: 0.5 },
  heroDays: { color: '#CDEBD7', fontSize: 13, marginTop: 6 },
  goalBox: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 14, marginTop: 16, width: '100%' },
  goalTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4, marginBottom: 6 },
  progressFill: { height: 8, backgroundColor: '#FFD54F', borderRadius: 4 },
  goalProgress: { color: '#EAF6EE', fontSize: 12 },
  editLink: { color: '#CDEBD7', fontSize: 12, marginTop: 14, textDecorationLine: 'underline' },
  setupCard: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#E6EFE6' },
  setupTitle: { fontSize: 17, fontWeight: 'bold', color: '#0B7A3B', marginBottom: 6 },
  setupSub: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 14 },
  label: { fontSize: 13, color: '#444', fontWeight: 'bold', marginBottom: 8, marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, marginBottom: 6 },
  dollar: { fontSize: 18, color: '#0B7A3B', fontWeight: 'bold', marginRight: 6 },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#333' },
  inputFull: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#333', marginBottom: 6 },
  saveBtn: { backgroundColor: '#0B7A3B', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10 },
  saveBtn2: { flex: 1, backgroundColor: '#0B7A3B', borderRadius: 12, padding: 13, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  editBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 13, alignItems: 'center' },
  cancelText: { color: '#888', fontSize: 15 },
});
