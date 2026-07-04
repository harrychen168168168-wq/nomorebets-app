import PageContainer from '@/components/PageContainer';
import { monthlyLossFromAnswer, QuizAnswers, scoreDependence } from '@/onboardingQuiz';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 痛感页：把用户填的数字换算成年损失 / 5 年投影，给依赖程度评分。
// 措辞用"和你相似的人的经验"，不做医学断言（App Store 合规）。
export default function ResultsStep({ answers, onNext }: { answers: QuizAnswers; onNext: () => void }) {
  const { dots, label } = scoreDependence(answers);
  const monthly = monthlyLossFromAnswer(answers);
  const yearly = monthly * 12;
  const fiveYear = monthly * 60;
  const motivation = typeof answers.motivation === 'string' ? answers.motivation.trim() : '';
  const triggers = Array.isArray(answers.triggers) ? (answers.triggers as string[]) : [];
  const paydayRisk = triggers.includes('payday');

  const goalText = motivation || '你真正想守护的人和事';

  return (
    <PageContainer>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>你的情况分析</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>依赖程度</Text>
          <View style={styles.dotsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={[styles.dot, i <= dots ? styles.dotOn : styles.dotOff]} />
            ))}
          </View>
          <Text style={styles.dotsLabel}>{label}</Text>
        </View>

        {yearly > 0 ? (
          <View style={styles.lossCard}>
            <Text style={styles.lossLabel}>按你填的数字，你每年大约输掉</Text>
            <Text style={styles.lossBig}>${yearly.toLocaleString()}</Text>
            <Text style={styles.lossSub}>
              如果继续 5 年，就是 <Text style={styles.lossHighlight}>${fiveYear.toLocaleString()}</Text>
              ——够用在「{goalText}」上。
            </Text>
          </View>
        ) : null}

        <View style={styles.mirrorCard}>
          <Text style={styles.mirrorText}>
            和你相似的人（{label}、{paydayRisk ? '发薪日冲动型' : '有固定触发场景'}），最危险的往往是
            {paydayRisk ? '发工资后的 72 小时' : '独处和空虚的时刻'}。好消息是：这些时刻是可以提前防住的。
          </Text>
        </View>

        <Text style={styles.reassure}>这不是审判，是一张让你看清自己的地图。接下来，我们一起把它变好。</Text>

        <TouchableOpacity style={styles.btn} onPress={onNext}>
          <Text style={styles.btnText}>看看我的 90 天计划</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF7' },
  header: { alignItems: 'center', paddingTop: 56, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#2E7D32' },
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20, alignItems: 'center' },
  cardLabel: { fontSize: 13, color: '#888', marginBottom: 12 },
  dotsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  dot: { width: 22, height: 22, borderRadius: 11 },
  dotOn: { backgroundColor: '#E67E22' },
  dotOff: { backgroundColor: '#Eee' },
  dotsLabel: { fontSize: 16, fontWeight: 'bold', color: '#E67E22' },
  lossCard: { backgroundColor: '#FFF8F0', margin: 16, marginBottom: 8, borderRadius: 16, padding: 22, alignItems: 'center' },
  lossLabel: { fontSize: 14, color: '#7A4C00', marginBottom: 6 },
  lossBig: { fontSize: 44, fontWeight: 'bold', color: '#E67E22', marginBottom: 10 },
  lossSub: { fontSize: 14, color: '#5D4037', textAlign: 'center', lineHeight: 22 },
  lossHighlight: { fontWeight: 'bold', color: '#E67E22' },
  mirrorCard: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  mirrorText: { fontSize: 14, color: '#444', lineHeight: 23 },
  reassure: { fontSize: 13, color: '#888', textAlign: 'center', marginHorizontal: 24, marginTop: 8, lineHeight: 20 },
  btn: { backgroundColor: '#2E7D32', margin: 16, marginTop: 16, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
