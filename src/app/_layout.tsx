import LoginScreen from '@/app/login';
import FirstProfileSetup from '@/components/FirstProfileSetup';
import PaywallModal from '@/components/PaywallModal';
import { AuthProvider, useAuth } from '@/auth';
import { configureRevenueCat } from '@/subscription';
import { syncReminders } from '@/notifications';
import { loadData, saveData } from '@/storage';
import * as Notifications from 'expo-notifications';
import { Tabs } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';

// Foreground presentation for our local high-risk-time reminders (banner + sound, no badge).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function AppShell() {
  const { user, loading } = useAuth();
  const [showOnboardingPaywall, setShowOnboardingPaywall] = useState(false);
  const previousProfileComplete = useRef<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      previousProfileComplete.current = null;
      setShowOnboardingPaywall(false);
      return;
    }
    const wasComplete = previousProfileComplete.current;
    const isComplete = !!user.profileComplete;
    if (wasComplete === false && isComplete) {
      loadData('onboardingPaywallShown').then(async (shown) => {
        if (!shown) {
          await saveData('onboardingPaywallShown', '1');
          setShowOnboardingPaywall(true);
        }
      });
    }
    previousProfileComplete.current = isComplete;
  }, [user?.id, user?.profileComplete]);

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

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAF7' }}>
        <ActivityIndicator color="#2E7D32" />
        <Text style={{ marginTop: 12, color: '#666' }}>正在准备你的戒赌空间...</Text>
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  if (!user.profileComplete) return <FirstProfileSetup />;

  return (
    <>
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
    <PaywallModal
      visible={showOnboardingPaywall}
      defaultPlan="ANNUAL"
      onboardingPrompt
      onClose={() => setShowOnboardingPaywall(false)}
      onSuccess={() => setShowOnboardingPaywall(false)}
    />
    </>
  );
}

export default function Layout() {
  useEffect(() => {
    configureRevenueCat();
  }, []);

  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
