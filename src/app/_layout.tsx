import LoginScreen from '@/app/login';
import AnimatedSplash from '@/components/AnimatedSplash';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';
import { AuthProvider, useAuth } from '@/auth';
import { supabaseInitError } from '@/supabase';
import { SUPPORT_EMAIL } from '@/config';
import { configureRevenueCat } from '@/subscription';
import { syncReminders } from '@/notifications';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';

// Keep the native splash up until our animated splash takes over; safety-hide after 4s so a
// failure to mount the animated splash can never leave the app stuck on the native splash.
SplashScreen.preventAutoHideAsync().catch(() => {});
setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, 4000);

// Foreground presentation for our local high-risk-time reminders (banner + sound, no badge).
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (error) {
  console.warn('[notifications] setNotificationHandler failed:', error);
}

function AppShell() {
  const { user, loading } = useAuth();

  // Rebuild the rolling local-reminder schedule on sign-in and whenever the app comes to the
  // foreground (keeps the payday window fresh and re-applies any settings changes).
  useEffect(() => {
    if (!user) return;
    syncReminders();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncReminders();
    });
    return () => sub.remove();
  }, [user?.id]);

  if (supabaseInitError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAF7', padding: 24 }}>
        <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#2E7D32', marginBottom: 10 }}>暂时无法启动</Text>
        <Text style={{ fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 21, marginBottom: 14 }}>请检查网络后重新打开 App。如果问题一直出现，请发邮件到 {SUPPORT_EMAIL} 联系我们。</Text>
        <Text selectable style={{ fontSize: 11, color: '#9AA59C', lineHeight: 16 }}>{supabaseInitError}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAF7' }}>
        <ActivityIndicator color="#2E7D32" />
        <Text style={{ marginTop: 12, color: '#666' }}>正在准备你的戒赌空间...</Text>
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  if (!user.profileComplete) return <OnboardingFlow />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2E7D32',
        tabBarInactiveTintColor: '#B0B0B0',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#eee',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11 },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: '首页', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text> }} />
      <Tabs.Screen name="emergency" options={{ title: '冲动', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🚨</Text> }} />
      <Tabs.Screen name="records" options={{ title: '记录', tabBarIcon: () => <Text style={{ fontSize: 20 }}>📋</Text> }} />
      <Tabs.Screen name="hope" options={{ title: '希望', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🌱</Text> }} />
      <Tabs.Screen name="profile" options={{ title: '我的', tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20 }}>{focused ? '🙋' : '🙍'}</Text> }} />
      <Tabs.Screen name="admin" options={{ href: null }} />
      <Tabs.Screen name="login" options={{ href: null }} />
    </Tabs>
  );
}

export default function Layout() {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    configureRevenueCat();
    // Safety net: never keep the animated splash up longer than ~5s.
    const timer = setTimeout(() => setSplashDone(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AuthProvider>
      <AppShell />
      {!splashDone ? <AnimatedSplash onDone={() => setSplashDone(true)} /> : null}
    </AuthProvider>
  );
}
