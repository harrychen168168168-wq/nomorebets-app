import PageContainer from '@/components/PageContainer';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 承诺仪式：按住 3 秒签下承诺。用户自己的话（昵称 + 动机）锁定决心。
export default function CommitmentStep({ name, motivation, onComplete }: { name: string; motivation: string; onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const done = useRef(false);

  const goal = motivation.trim() || '我爱的人';

  function start() {
    if (done.current) return;
    const startAt = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - startAt) / 3000);
      setProgress(p);
      if (p >= 1) {
        stop(false);
        done.current = true;
        onComplete();
      }
    }, 30);
  }

  function stop(reset = true) {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    if (reset && !done.current) setProgress(0);
  }

  return (
    <PageContainer>
      <View style={styles.root}>
        <Text style={styles.title}>签下你的承诺</Text>
        <View style={styles.pledgeCard}>
          <Text style={styles.pledgeText}>
            我，<Text style={styles.strong}>{name || '我'}</Text>，为了<Text style={styles.strong}>{goal}</Text>，
            从今天起，一天一天把人生赢回来。
          </Text>
        </View>

        <TouchableOpacity activeOpacity={0.9} style={styles.holdBtn} onPressIn={start} onPressOut={() => stop()}>
          <View style={[styles.holdFill, { width: (String(progress * 100) + '%') as any }]} />
          <Text style={styles.holdText}>{progress >= 1 ? '已签下' : '按住 3 秒，签下承诺'}</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>这一步只对你自己，没有人在看。</Text>
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAF7', justifyContent: 'center', padding: 28 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2E7D32', textAlign: 'center', marginBottom: 24 },
  pledgeCard: { backgroundColor: '#fff', borderRadius: 18, padding: 26, marginBottom: 32, borderWidth: 1, borderColor: '#E6EFE6' },
  pledgeText: { fontSize: 19, color: '#24352A', lineHeight: 32, textAlign: 'center' },
  strong: { fontWeight: 'bold', color: '#2E7D32' },
  holdBtn: { height: 58, borderRadius: 14, backgroundColor: '#2E7D32', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  holdFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#1B5E20' },
  holdText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  hint: { fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 16 },
});
