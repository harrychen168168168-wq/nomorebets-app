import LoginScreen from '@/app/login';
import FirstProfileSetup from '@/components/FirstProfileSetup';
import PaywallModal from '@/components/PaywallModal';
import SubscriptionGate from '@/components/SubscriptionGate';
import { AuthProvider, useAuth } from '@/auth';
import { checkAppAccess, configureRevenueCat } from '@/subscription';
import { loadData, saveData } from '@/storage';
import { Tabs } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

function AppShell() {
  const { user, loading, isAdminCandidate } = useAuth();
  const [showOnboardingPaywall, setShowOnboardingPaywall] = useState(false);
  const previousProfileComplete = useRef<boolean | null>(null);
  const [access, setAccess] = useState<{ status: 'checking' | 'allowed' | 'locked'; reason?: string }>({ status: 'checking' });

  const refreshAccess = useCallback(async () => {
    if (!user) return;
    setAccess({ status: 'checking' });
    const result = await checkAppAccess(user.id);
    setAccess(result.allowed ? { status: 'allowed' } : { status: 'locked', reason: result.reason });
  }, [user?.id]);

  useEffect(() => {
    if (user?.profileComplete) refreshAccess();
  }, [user?.profileComplete, refreshAccess]);

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

  // Whole-app subscription gate. Admin accounts (by email) always bypass so the owner can manage
  // the app and moderate without a subscription. Crisis hotlines stay reachable inside the gate.
  if (!isAdminCandidate && access.status === 'checking') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAF7' }}>
        <ActivityIndicator color="#2E7D32" />
        <Text style={{ marginTop: 12, color: '#666' }}>正在确认订阅状态...</Text>
      </View>
    );
  }

  if (!isAdminCandidate && access.status === 'locked') {
    return <SubscriptionGate onUnlock={refreshAccess} reason={access.reason} />;
  }

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
      <Tabs.Screen name="explore" options={{ href: null }} />
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
