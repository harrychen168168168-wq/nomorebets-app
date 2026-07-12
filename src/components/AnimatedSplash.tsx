import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

// Custom animated splash: green halo grows in → sprout springs in → wordmark slides up →
// tagline fades in → a 3-dot wave pulses → hold → the whole screen fades out into the app.
// Background matches the native splash (#F8FAF7) so the handoff has no white flash.
function makeDotPulse(v: Animated.Value) {
  return Animated.sequence([
    Animated.timing(v, { toValue: 1, duration: 340, useNativeDriver: true }),
    Animated.timing(v, { toValue: 0.25, duration: 340, useNativeDriver: true }),
  ]);
}

export default function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const root = useRef(new Animated.Value(1)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.55)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(14)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.25)).current;
  const dot2 = useRef(new Animated.Value(0.25)).current;
  const dot3 = useRef(new Animated.Value(0.25)).current;
  const [passThrough, setPassThrough] = useState(false);

  useEffect(() => {
    // Hand off from the native splash to this one (same background → seamless).
    SplashScreen.hideAsync().catch(() => {});

    const dotLoop = Animated.loop(
      Animated.stagger(170, [makeDotPulse(dot1), makeDotPulse(dot2), makeDotPulse(dot3)])
    );

    const intro = Animated.sequence([
      Animated.parallel([
        Animated.timing(halo, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 55, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 480, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 460, useNativeDriver: true }),
      Animated.delay(750),
    ]);

    const fade = Animated.timing(root, { toValue: 0, duration: 480, easing: Easing.in(Easing.cubic), useNativeDriver: true });

    dotLoop.start();
    intro.start(({ finished }) => {
      if (!finished) return;
      // The app underneath is being revealed by the fade — stop the overlay from swallowing its touches.
      setPassThrough(true);
      fade.start(({ finished: fadeDone }) => {
        dotLoop.stop();
        if (fadeDone) onDone();
      });
    });

    return () => {
      dotLoop.stop();
      intro.stop();
      fade.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Animated.View pointerEvents={passThrough ? 'none' : 'auto'} style={[styles.root, { opacity: root }]}>
      <View style={styles.center}>
        <Animated.View style={[styles.halo, { opacity: halo, transform: [{ scale: haloScale }] }]} />
        <Animated.Text style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>🌱</Animated.Text>
      </View>
      <Animated.Text style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>NoMoreBets</Animated.Text>
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>每一天，都是新的开始</Animated.Text>
      <Animated.Text style={[styles.warmLine, { opacity: taglineOpacity }]}>你不是一个人在战斗</Animated.Text>
      <View style={styles.dots}>
        <Animated.View style={[styles.dot, { opacity: dot1 }]} />
        <Animated.View style={[styles.dot, { opacity: dot2 }]} />
        <Animated.View style={[styles.dot, { opacity: dot3 }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F8FAF7', alignItems: 'center', justifyContent: 'center', zIndex: 999, elevation: 999 },
  center: { alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  halo: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#E8F5E9' },
  logo: { fontSize: 70 },
  title: { fontSize: 30, fontWeight: 'bold', color: '#2E7D32', letterSpacing: 0.5 },
  tagline: { fontSize: 14, color: '#8A8A8A', marginTop: 10 },
  warmLine: { fontSize: 15, fontWeight: 'bold', color: '#2E7D32', marginTop: 12, letterSpacing: 0.3 },
  dots: { flexDirection: 'row', gap: 8, marginTop: 34 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2E7D32' },
});
