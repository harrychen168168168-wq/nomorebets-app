import PageContainer from '@/components/PageContainer';
import { monthlyLossFromAnswer, QuizAnswers } from '@/onboardingQuiz';
import { PLAN_PHASES } from '@/planTasks';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function addDays(base: Date, days: number) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  return d;
}

// 计划预览：4 阶段 + 到第 90 天的具体日期和预计省下的钱（用户填的月损失驱动）。
export default function PlanPreviewStep({ answers, onNext }: { answers: QuizAnswers; onNext: () => void }) {
  const monthly = monthlyLossFromAnswer(answers);
  const savedByDay90 = Math.round((monthly / 30) * 90);
  const day90 = addDays(new Date(), 90);
  const day90Text = `${day90.getMonth() + 1} 月 ${day90.getDate()} 日`;

  return (
    <PageContainer>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>你的 90 天新生计划</Text>
          <Text style={styles.headerSub}>一天一件小事，我们陪你走完</Text>
        </View>

        {PLAN_PHASES.map((p) => (
          <View key={p.phase} style={styles.phaseCard}>
            <View style={styles.phaseTop}>
              <Text style={styles.phaseDays}>第 {p.range[0]}–{p.range[1]} 天</Text>
              <Text style={styles.phaseName}>{p.name}</Text>
            </View>
            <Text style={styles.phaseTheme}>{p.theme}</Text>
          </View>
        ))}

        {savedByDay90 > 0 ? (
          <View style={styles.goalCard}>
            <Text style={styles.goalText}>到 <Text style={styles.goalHighlight}>{day90Text}</Text>，你已经省下</Text>
            <Text style={styles.goalBig}>${savedByDay90.toLocaleString()}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.btn} onPress={onNext}>
          <Text style={styles.btnText}>我准备好了</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF7' },
  header: { alignItems: 'center', paddingTop: 56, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#2E7D32' },
  headerSub: { fontSize: 14, color: '#888', marginTop: 6 },
  phaseCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 16, padding: 18 },
  phaseTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  phaseDays: { fontSize: 12, color: '#2E7D32', fontWeight: 'bold', backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  phaseName: { fontSize: 16, fontWeight: 'bold', color: '#24352A' },
  phaseTheme: { fontSize: 13, color: '#666', lineHeight: 20 },
  goalCard: { backgroundColor: '#0B7A3B', marginHorizontal: 16, marginTop: 6, borderRadius: 16, padding: 22, alignItems: 'center' },
  goalText: { fontSize: 14, color: '#CDEBD7' },
  goalHighlight: { color: '#fff', fontWeight: 'bold' },
  goalBig: { fontSize: 40, fontWeight: 'bold', color: '#fff', marginTop: 6 },
  btn: { backgroundColor: '#2E7D32', margin: 16, marginTop: 16, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
