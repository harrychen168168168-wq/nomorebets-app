import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import PageContainer from '@/components/PageContainer';
import { isScreenComplete, QuizAnswers, quizScreens } from '@/onboardingQuiz';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Forward-only 诊断问卷：3 屏，答完一屏才能继续，不能后退（不给思考缝隙）。
export default function QuizStep({ onComplete }: { onComplete: (answers: QuizAnswers) => void }) {
  const screens = useMemo(() => quizScreens(), []);
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const screenNo = (page + 1) as 1 | 2 | 3;
  const questions = screens[page];
  const canContinue = isScreenComplete(screenNo, answers);
  const isLast = page === screens.length - 1;

  function setSingle(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }
  function toggleMulti(id: string, value: string) {
    setAnswers((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [id]: next };
    });
  }
  function setFree(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function next() {
    if (!canContinue) return;
    if (isLast) onComplete(answers);
    else setPage((p) => p + 1);
  }

  return (
    <PageContainer>
      <KeyboardAwareScrollView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: (String(((page + 1) / screens.length) * 100) + '%') as any }]} /></View>
          <Text style={styles.progressLabel}>第 {page + 1} / {screens.length} 步</Text>
        </View>

        {questions.map((q) => (
          <View key={q.id} style={styles.qBlock}>
            <Text style={styles.qTitle}>{q.title}</Text>
            {q.type === 'free' ? (
              <TextInput
                style={styles.freeInput}
                placeholder={q.placeholder}
                placeholderTextColor="#aaa"
                value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                onChangeText={(t) => setFree(q.id, t)}
                multiline
              />
            ) : (
              <View style={styles.options}>
                {q.options!.map((opt) => {
                  const selected = q.type === 'multi'
                    ? Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt.value)
                    : answers[q.id] === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.opt, selected && styles.optSelected]}
                      onPress={() => (q.type === 'multi' ? toggleMulti(q.id, opt.value) : setSingle(q.id, opt.value))}
                    >
                      <Text style={[styles.optText, selected && styles.optTextSelected]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity style={[styles.btn, !canContinue && styles.btnDisabled]} onPress={next} disabled={!canContinue}>
          <Text style={styles.btnText}>{isLast ? '看看我的情况' : '继续'}</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </KeyboardAwareScrollView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF7' },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 8 },
  progressBar: { height: 6, backgroundColor: '#E6EFE6', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#2E7D32', borderRadius: 3 },
  progressLabel: { fontSize: 12, color: '#888', marginTop: 8 },
  qBlock: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 18 },
  qTitle: { fontSize: 17, fontWeight: 'bold', color: '#24352A', marginBottom: 14, lineHeight: 24 },
  options: { gap: 10 },
  opt: { borderWidth: 1.5, borderColor: '#E2E2E2', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 },
  optSelected: { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' },
  optText: { fontSize: 15, color: '#333' },
  optTextSelected: { color: '#2E7D32', fontWeight: 'bold' },
  freeInput: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 14, fontSize: 15, color: '#333', minHeight: 90, textAlignVertical: 'top', backgroundColor: '#fff' },
  btn: { backgroundColor: '#2E7D32', marginHorizontal: 16, marginTop: 8, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#A5D6A7' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
