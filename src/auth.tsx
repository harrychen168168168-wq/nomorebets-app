import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { ADMIN_EMAILS, ADMIN_LOCAL_PIN } from './config';
import { configureRevenueCat } from './subscription';
import { resetAllData } from './storage';

export type AppUser = {
  id: string;
  email?: string;
  displayName: string;
  avatarUri?: string;
  role: 'user' | 'admin';
  mode: 'email' | 'guest' | 'apple' | 'google';
  createdAt: string;
};

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  isAdminCandidate: boolean;
  registerWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  signInWithApple: (payload: SocialSignInPayload) => Promise<void>;
  signInWithGoogle: (payload: SocialSignInPayload) => Promise<void>;
  unlockAdmin: (pin: string) => Promise<boolean>;
  lockAdmin: () => void;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateProfile: (updates: { displayName?: string; avatarUri?: string }) => Promise<void>;
};

type StoredAccount = AppUser & { passwordHash?: string; passwordSalt?: string };

export type SocialSignInPayload = {
  providerUserId: string;
  email?: string | null;
  displayName?: string | null;
};

const CURRENT_USER_KEY = 'auth.currentUser';
const SAVED_USERS_KEY = 'auth.savedUsers';
const GUEST_ID_KEY = 'auth.guestId';

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function makeStableId(seed: string, prefix = 'user') {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return prefix + '_' + Math.abs(hash).toString(36);
}

function normalizeName(name?: string | null) {
  return name?.trim() || '';
}

function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return ADMIN_EMAILS.map(normalizeEmail).includes(normalizeEmail(email));
}

function publicUser(account: StoredAccount): AppUser {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    avatarUri: account.avatarUri,
    role: account.role,
    mode: account.mode,
    createdAt: account.createdAt,
  };
}

async function readAccounts(): Promise<StoredAccount[]> {
  const rawUsers = await AsyncStorage.getItem(SAVED_USERS_KEY);
  if (!rawUsers) return [];
  try {
    const users = JSON.parse(rawUsers);
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

async function hashPassword(password: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + ':' + password);
}

function makeSalt() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
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
  const [adminUnlocked, setAdminUnlocked] = useState(false);

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

  const persistUser = useCallback(async (nextUser: AppUser, account?: StoredAccount) => {
    const users = await readAccounts();
    const stored = account ?? nextUser;
    const filtered = users.filter((item) => item.id !== nextUser.id);
    await AsyncStorage.multiSet([
      [CURRENT_USER_KEY, JSON.stringify(nextUser)],
      [SAVED_USERS_KEY, JSON.stringify([stored, ...filtered])],
    ]);
    setUser(nextUser);
    setAdminUnlocked(false);
    await bindRevenueCatUser(nextUser.id);
  }, []);

  const registerWithEmail = useCallback(async (emailInput: string, password: string, displayName?: string) => {
    const email = normalizeEmail(emailInput);
    if (!email.includes('@')) throw new Error('请输入有效邮箱。');
    if (password.length < 6) throw new Error('密码至少需要 6 位。');
    const users = await readAccounts();
    const existing = users.find((item) => item.mode === 'email' && normalizeEmail(item.email || '') === email);
    if (existing?.passwordHash) throw new Error('这个邮箱已经注册，请直接登录。');
    const salt = makeSalt();
    const account: StoredAccount = {
      id: existing?.id || makeStableId(email, 'email'),
      email,
      displayName: displayName?.trim() || email.split('@')[0] || '用户',
      role: isAdminEmail(email) ? 'admin' : 'user',
      mode: 'email',
      createdAt: existing?.createdAt || new Date().toISOString(),
      passwordSalt: salt,
      passwordHash: await hashPassword(password, salt),
    };
    await persistUser(publicUser(account), account);
  }, [persistUser]);

  const signInWithEmailPassword = useCallback(async (emailInput: string, password: string) => {
    const email = normalizeEmail(emailInput);
    if (!email.includes('@')) throw new Error('请输入有效邮箱。');
    if (!password) throw new Error('请输入密码。');
    const users = await readAccounts();
    const account = users.find((item) => item.mode === 'email' && normalizeEmail(item.email || '') === email);
    if (!account) throw new Error('没有找到这个邮箱，请先注册。');
    if (!account.passwordHash || !account.passwordSalt) throw new Error('这个本地账号还没有密码，请用注册入口设置密码。');
    const passwordHash = await hashPassword(password, account.passwordSalt);
    if (passwordHash !== account.passwordHash) throw new Error('密码不正确。');
    const refreshed: StoredAccount = { ...account, role: isAdminEmail(account.email) ? 'admin' : 'user' };
    await persistUser(publicUser(refreshed), refreshed);
  }, [persistUser]);

  const signInWithSocial = useCallback(async (mode: 'apple' | 'google', payload: SocialSignInPayload) => {
    const providerUserId = payload.providerUserId.trim();
    if (!providerUserId) throw new Error('登录信息不完整，请重试。');
    const id = makeStableId(mode + ':' + providerUserId, mode);
    const users = await readAccounts();
    const existing = users.find((item) => item.id === id);
    const email = payload.email || existing?.email;
    const displayName = normalizeName(payload.displayName) || existing?.displayName || (email ? email.split('@')[0] : mode === 'apple' ? 'Apple 用户' : 'Google 用户');
    const account: StoredAccount = {
      id,
      email: email || undefined,
      displayName,
      avatarUri: existing?.avatarUri,
      role: isAdminEmail(email) ? 'admin' : 'user',
      mode,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    await persistUser(publicUser(account), account);
  }, [persistUser]);

  const signInWithApple = useCallback((payload: SocialSignInPayload) => signInWithSocial('apple', payload), [signInWithSocial]);
  const signInWithGoogle = useCallback((payload: SocialSignInPayload) => signInWithSocial('google', payload), [signInWithSocial]);

  const continueAsGuest = useCallback(async () => {
    let guestId = await AsyncStorage.getItem(GUEST_ID_KEY);
    if (!guestId) {
      guestId = 'guest_' + Date.now().toString(36);
      await AsyncStorage.setItem(GUEST_ID_KEY, guestId);
    }
    await persistUser({ id: guestId, displayName: '访客用户', role: 'user', mode: 'guest', createdAt: new Date().toISOString() });
  }, [persistUser]);

  const unlockAdmin = useCallback(async (pin: string) => {
    const allowed = user?.role === 'admin' && pin.trim() === ADMIN_LOCAL_PIN;
    setAdminUnlocked(allowed);
    return allowed;
  }, [user?.role]);

  const lockAdmin = useCallback(() => setAdminUnlocked(false), []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
    setUser(null);
    setAdminUnlocked(false);
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
    if (user) {
      const users = await readAccounts();
      await AsyncStorage.setItem(SAVED_USERS_KEY, JSON.stringify(users.filter((item) => item.id !== user.id)));
    }
    await resetAllData();
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
    setUser(null);
    setAdminUnlocked(false);
    if (Platform.OS === 'ios') {
      try {
        await configureRevenueCat();
        await Purchases.logOut();
      } catch (error) {
        console.log('[Auth] RevenueCat logOut after delete skipped:', error);
      }
    }
  }, [user]);

  const updateProfile = useCallback(async (updates: { displayName?: string; avatarUri?: string }) => {
    if (!user) return;
    const nextUser: AppUser = {
      ...user,
      displayName: updates.displayName?.trim() || user.displayName,
      avatarUri: updates.avatarUri ?? user.avatarUri,
    };
    const users = await readAccounts();
    const existing = users.find((item) => item.id === user.id);
    const nextAccount: StoredAccount = { ...(existing ?? nextUser), ...nextUser };
    const filtered = users.filter((item) => item.id !== user.id);
    await AsyncStorage.multiSet([
      [CURRENT_USER_KEY, JSON.stringify(nextUser)],
      [SAVED_USERS_KEY, JSON.stringify([nextAccount, ...filtered])],
    ]);
    setUser(nextUser);
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAdmin: user?.role === 'admin' && adminUnlocked,
    isAdminCandidate: user?.role === 'admin',
    registerWithEmail,
    signInWithEmailPassword,
    signInWithApple,
    signInWithGoogle,
    unlockAdmin,
    lockAdmin,
    continueAsGuest,
    signOut,
    deleteAccount,
    updateProfile,
  }), [adminUnlocked, continueAsGuest, deleteAccount, loading, lockAdmin, registerWithEmail, signInWithApple, signInWithEmailPassword, signInWithGoogle, signOut, unlockAdmin, updateProfile, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
