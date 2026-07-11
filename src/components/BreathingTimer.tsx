import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

// The opposite of the paywall's draining bar: a calm breathing orb. It expands on the inhale and
// contracts (a little longer) on the exhale, so the user has something soothing to follow while the
// urge passes — 3.5s in / 4.5s out: a natural, easy-to-follow pace that still keeps the exhale
// longer than the inhale (which calms the nervous system). Native-driven, smooth, cheap.
const INHALE = 3500;
const EXHALE = 4500;

export default function BreathingTimer({ secondsLeft }: { secondsLeft: number }) {
  const orb = useRef(new Animated.Value(0.72)).current; // 0.72 (exhaled) -> 1 (inhaled)
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  useEffect(() => {
    let mounted = true;
    const breatheIn = () => {
      if (!mounted) return;
      setPhase('in');
      Animated.timing(orb, { toValue: 1, duration: INHALE, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start(
        ({ finished }) => { if (finished && mounted) breatheOut(); }
      );
    };
    const breatheOut = () => {
      if (!mounted) return;
      setPhase('out');
      Animated.timing(orb, { toValue: 0.72, duration: EXHALE, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start(
        ({ finished }) => { if (finished && mounted) breatheIn(); }
      );
    };
    breatheIn();
    return () => { mounted = false; orb.stopAnimation(); };
  }, [orb]);

  const haloScale = useMemo(() => orb.interpolate({ inputRange: [0.72, 1], outputRange: [0.85, 1.25] }), [orb]);
  const haloOpacity = useMemo(() => orb.interpolate({ inputRange: [0.72, 1], outputRange: [0.22, 0.5] }), [orb]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <View style={styles.wrap}>
      <View style={styles.orbBox}>
        <Animated.View style={[styles.halo, { transform: [{ scale: haloScale }], opacity: haloOpacity }]} pointerEvents="none" />
        <Animated.View style={[styles.orb, { transform: [{ scale: orb }] }]}>
          <Text style={styles.word}>{phase === 'in' ? '吸气' : '呼气'}</Text>
        </Animated.View>
      </View>
      <Text style={styles.time}>{mm}:{ss}</Text>
      <Text style={styles.hint}>跟着圆圈呼吸——它放大就吸气，缩小就呼气。冲动会像海浪一样退下去。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 6, paddingBottom: 4 },
  orbBox: { width: 210, height: 210, alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  halo: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: '#A5D6A7' },
  orb: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#2E7D32', alignItems: 'center', justifyContent: 'center' },
  word: { color: '#fff', fontSize: 30, fontWeight: 'bold', letterSpacing: 6 },
  time: { fontSize: 22, fontWeight: 'bold', color: '#2E7D32', marginTop: 12, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 12, color: '#888', marginTop: 8, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8 },
});
