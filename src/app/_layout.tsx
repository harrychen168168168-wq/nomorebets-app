import LoginScreen from '@/app/login';
import FirstProfileSetup from '@/components/FirstProfileSetup';
import { AuthProvider, useAuth } from '@/auth';
import { configureRevenueCat } from '@/subscription';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

function AppShell() {
  const { user, loading } = useAuth();

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
