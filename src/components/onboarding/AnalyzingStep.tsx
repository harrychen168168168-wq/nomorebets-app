import PageContainer from '@/components/PageContainer';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

// 2.2 秒的"正在分析"仪式感过渡，然后自动进结果页。
export default function AnalyzingStep({ onDone }: { onDone: () => void }) {
  const [dots, setDots] = useState('');
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    const dotTimer = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '·')), 400);
    const done = setTimeout(onDone, 2200);
    return () => {
      loop.stop();
      clearInterval(dotTimer);
      clearTimeout(done);
    };
  }, [onDone, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <PageContainer>
      <View style={styles.root}>
        <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
        <Text style={styles.title}>正在分析你的情况{dots}</Text>
        <Text style={styles.sub}>结合你刚才的回答，为你生成专属评估</Text>
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAF7', alignItems: 'center', justifyContent: 'center', padding: 32 },
  ring: { width: 64, height: 64, borderRadius: 32, borderWidth: 5, borderColor: '#E8F5E9', borderTopColor: '#2E7D32', marginBottom: 24 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#2E7D32', textAlign: 'center' },
  sub: { fontSize: 14, color: '#888', marginTop: 10, textAlign: 'center', lineHeight: 21 },
});
