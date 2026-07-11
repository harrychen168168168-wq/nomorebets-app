import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

// A "watch it slip away" launch-offer countdown: a bar that drains smoothly from the right (native
// transform, so it moves every frame — not a once-a-second jump), a heartbeat flame, a soft glow
// that pulses, and the whole thing turning red + pulsing harder in the final minute.
export default function PromoCountdown({
  deadline,
  totalMs,
  secondsLeft,
  regularPrice,
}: {
  deadline: number;
  totalMs: number;
  secondsLeft: number;
  regularPrice?: string;
}) {
  const [trackW, setTrackW] = useState(0);
  const drain = useRef(new Animated.Value(1)).current; // 1 = full, 0 = empty
  const pulse = useRef(new Animated.Value(0)).current;

  const urgent = secondsLeft <= 60;

  useEffect(() => {
    const remainingMs = Math.max(0, deadline - Date.now());
    drain.setValue(totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0);
    const bar = Animated.timing(drain, {
      toValue: 0,
      duration: remainingMs,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    bar.start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      bar.stop();
      loop.stop();
    };
  }, [deadline, totalMs, drain, pulse]);

  // Drain the bar by sliding a full-width fill left under an overflow-hidden track (native, smooth).
  const translateX = useMemo(() => drain.interpolate({ inputRange: [0, 1], outputRange: [-trackW, 0] }), [drain, trackW]);
  const flameScale = useMemo(() => pulse.interpolate({ inputRange: [0, 1], outputRange: [1, urgent ? 1.32 : 1.18] }), [pulse, urgent]);
  const glowOpacity = useMemo(() => pulse.interpolate({ inputRange: [0, 1], outputRange: [0, urgent ? 0.5 : 0.28] }), [pulse, urgent]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <View style={[styles.wrap, urgent && styles.wrapUrgent]}>
      <Animated.View style={[styles.glow, urgent && styles.glowUrgent, { opacity: glowOpacity }]} pointerEvents="none" />
      <View style={styles.row}>
        <Animated.Text style={[styles.flame, { transform: [{ scale: flameScale }] }]}>🔥</Animated.Text>
        <View style={styles.mid}>
          <Text style={[styles.title, urgent && styles.textUrgent]}>限时买断特惠 · 一年订阅的钱</Text>
          <Text style={styles.sub}>倒计时结束后恢复原价{regularPrice ? ' ' + regularPrice : ''}</Text>
        </View>
        <Text style={[styles.time, urgent && styles.textUrgent]}>{mm}:{ss}</Text>
      </View>
      <View style={styles.track} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.fill, urgent && styles.fillUrgent, { width: trackW, transform: [{ translateX }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#FFF3E6', borderRadius: 16, borderWidth: 2, borderColor: '#E67E22', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, marginBottom: 14, overflow: 'hidden' },
  wrapUrgent: { backgroundColor: '#FDECEA', borderColor: '#C0392B' },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#E67E22' },
  glowUrgent: { backgroundColor: '#C0392B' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flame: { fontSize: 30 },
  mid: { flex: 1 },
  title: { fontSize: 15, fontWeight: 'bold', color: '#B85C00' },
  sub: { fontSize: 12, color: '#9A6A00', marginTop: 2 },
  time: { fontSize: 30, fontWeight: 'bold', color: '#E67E22', fontVariant: ['tabular-nums'], letterSpacing: 1 },
  textUrgent: { color: '#C0392B' },
  track: { height: 12, backgroundColor: 'rgba(0,0,0,0.10)', borderRadius: 6, marginTop: 12, overflow: 'hidden' },
  fill: { height: 12, backgroundColor: '#E67E22', borderRadius: 6 },
  fillUrgent: { backgroundColor: '#C0392B' },
});
