import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { ADMIN_EMAILS } from './config';
import { configureRevenueCat } from './subscription';
import { resetAllData } from './storage';

export type AppUser = {
  id: string;
  email?: string;
  displayName: string;
  role: 'user' | 'admin';
  mode: 'email' | 'guest';
  createdAt: string;
};

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithEmail: (email: string, displayName?: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const CURRENT_USER_KEY = 'auth.currentUser';
const SAVED_USERS_KEY = 'auth.savedUsers';
const GUEST_ID_KEY = 'auth.guestId';

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function makeStableId(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return `user_${Math.abs(hash).toString(36)}`;
}

async function bindRevenueCatUser(userId: string) {
  if (Platform.OS !== 'ios') return;
  try {
    await configureRevenueCat();
    await Purchases.logIn(userId);
  } catch (error) {
    console.log('[Auth] RevenueCat logIn failed:', error);
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const raw = await AsyncStorage.getItem(CURRENT_USER_KEY);
        if (raw) {
          const parsed: AppUser = JSON.parse(raw);
          setUser(parsed);
          await bindRevenueCatUser(parsed.id);
        }
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const persistUser = useCallback(async (nextUser: AppUser) => {
    const rawUsers = await AsyncStorage.getItem(SAVED_USERS_KEY);
    const users: AppUser[] = rawUsers ? JSON.parse(rawUsers) : [];
    const filtered = users.filter((item) => item.id !== nextUser.id);
    await AsyncStorage.multiSet([
      [CURRENT_USER_KEY, JSON.stringify(nextUser)],
      [SAVED_USERS_KEY, JSON.stringify([nextUser, ...filtered])],
    ]);
    setUser(nextUser);
    await bindRevenueCatUser(nextUser.id);
  }, []);

  const signInWithEmail = useCallback(async (emailInput: string, displayName?: string) => {
    const email = normalizeEmail(emailInput);
    if (!email.includes('@')) throw new Error('请输入有效邮箱');
    const role = ADMIN_EMAILS.map(normalizeEmail).includes(email) ? 'admin' : 'user';
    const nextUser: AppUser = {
      id: makeStableId(email),
      email,
      displayName: displayName?.trim() || email.split('@')[0] || '用户',
      role,
      mode: 'email',
      createdAt: new Date().toISOString(),
    };
    await persistUser(nextUser);
  }, [persistUser]);

  const continueAsGuest = useCallback(async () => {
    let guestId = await AsyncStorage.getItem(GUEST_ID_KEY);
    if (!guestId) {
      guestId = `guest_${Date.now().toString(36)}`;
      await AsyncStorage.setItem(GUEST_ID_KEY, guestId);
    }
    const nextUser: AppUser = {
      id: guestId,
      displayName: '访客用户',
      role: 'user',
      mode: 'guest',
      createdAt: new Date().toISOString(),
    };
    await persistUser(nextUser);
  }, [persistUser]);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
    setUser(null);
    if (Platform.OS === 'ios') {
      try {
        await configureRevenueCat();
        await Purchases.logOut();
      } catch (error) {
        console.log('[Auth] RevenueCat logOut skipped:', error);
      }
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    // 当前版本为本地账号：删除账号时同时清除本机保存的戒赌记录、联系人、目标和设置。
    await resetAllData();
    setUser(null);
    if (Platform.OS === 'ios') {
      try {
        await configureRevenueCat();
        await Purchases.logOut();
      } catch (error) {
        console.log('[Auth] RevenueCat logOut after delete skipped:', error);
      }
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAdmin: user?.role === 'admin',
    signInWithEmail,
    continueAsGuest,
    signOut,
    deleteAccount,
  }), [continueAsGuest, deleteAccount, loading, signInWithEmail, signOut, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
