import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { ADMIN_EMAILS, ADMIN_LOCAL_PIN } from './config';
import { cloudDeleteAll, cloudGetProfile, cloudUpsertProfile } from './cloudSync';
import { pullCloudIntoLocal, resetAllData } from './storage';
import { supabase } from './supabase';
import { configureRevenueCat } from './subscription';

export type AppUser = {
  id: string;
  email?: string;
  displayName: string;
  avatarUri?: string;
  profileComplete?: boolean;
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
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
  unlockAdmin: (pin: string) => Promise<boolean>;
  lockAdmin: () => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateProfile: (updates: { displayName?: string; avatarUri?: string; profileComplete?: boolean }) => Promise<void>;
};

// Apple/Google now hand us the provider's identity token (a JWT) which Supabase verifies natively.
// rawNonce is only for Apple: the credential is requested with the SHA-256 hash of this nonce, and
// Supabase re-hashes rawNonce to validate the token's nonce claim (replay protection).
export type SocialSignInPayload = {
  idToken: string;
  rawNonce?: string;
  email?: string | null;
  displayName?: string | null;
};

// storage.ts reads this same key to scope the local cache and to know which cloud rows to sync.
const CURRENT_USER_KEY = 'auth.currentUser';

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeName(name?: string | null) {
  return name?.trim() || '';
}

function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return ADMIN_EMAILS.map(normalizeEmail).includes(normalizeEmail(email));
}

function modeFromSession(sessionUser: SupabaseUser): AppUser['mode'] {
  if (sessionUser.is_anonymous) return 'guest';
  const provider = sessionUser.app_metadata?.provider;
  if (provider === 'apple') return 'apple';
  if (provider === 'google') return 'google';
  return 'email';
}

function fallbackName(mode: AppUser['mode'], email?: string) {
  if (mode === 'guest') return '访客用户';
  if (email) return email.split('@')[0] || '用户';
  if (mode === 'apple') return 'Apple 用户';
  if (mode === 'google') return 'Google 用户';
  return '用户';
}

function translateAuthError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return '邮箱或密码不正确。';
  if (lower.includes('already registered') || lower.includes('already been registered')) return '这个邮箱已经注册，请直接登录。';
  if (lower.includes('anonymous sign-ins are disabled')) return '访客登录暂未开启，请稍后再试或改用邮箱登录。';
  if (lower.includes('email not confirmed')) return '请先到邮箱点开确认链接后再登录。';
  if (lower.includes('password should be at least')) return '密码太短，至少需要 6 位。';
  if (lower.includes('otp') || lower.includes('token has expired') || lower.includes('expired or is invalid')) return '验证码不正确或已过期，请重新获取。';
  return message || '请稍后再试。';
}

async function bindRevenueCatUser(userId: string) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    await configureRevenueCat();
    await Purchases.logIn(userId);
  } catch (error) {
    console.log('[Auth] RevenueCat logIn failed:', error);
  }
}

// Offline fallback: the last locally cached AppUser, but only if it is this exact user id (so we
// never leak one account's profile onto another).
async function readCachedUser(userId: string): Promise<AppUser | null> {
  try {
    const raw = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppUser;
    return parsed?.id === userId ? parsed : null;
  } catch {
    return null;
  }
}

async function hydrateUser(sessionUser: SupabaseUser): Promise<AppUser> {
  const email = sessionUser.email || undefined;
  const mode = modeFromSession(sessionUser);
  let profile = null;
  try {
    profile = await cloudGetProfile(sessionUser.id);
  } catch {
    // offline / first run — fall back below to the last cached profile for this same user.
  }
  // When the cloud is unreachable, reuse the last known local values so a user who already finished
  // onboarding isn't forced back through the funnel / paywall on an offline relaunch.
  const cached = profile ? null : await readCachedUser(sessionUser.id);
  return {
    id: sessionUser.id,
    email,
    displayName: profile?.display_name || cached?.displayName || fallbackName(mode, email),
    avatarUri: profile?.avatar_uri || cached?.avatarUri || undefined,
    profileComplete: profile ? !!profile.profile_complete : !!cached?.profileComplete,
    role: isAdminEmail(email) ? 'admin' : 'user',
    mode,
    createdAt: sessionUser.created_at || new Date().toISOString(),
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const applySession = useCallback(async (session: Session | null, shouldPull: boolean) => {
    if (!session?.user) {
      await AsyncStorage.removeItem(CURRENT_USER_KEY);
      setUser(null);
      setAdminUnlocked(false);
      return;
    }
    const appUser = await hydrateUser(session.user);
    // Write the current user BEFORE pulling: storage.ts derives the cloud user id from this key.
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(appUser));
    await bindRevenueCatUser(appUser.id);
    if (shouldPull) await pullCloudIntoLocal().catch(() => false);
    setUser(appUser);
    setAdminUnlocked(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        await applySession(data.session, true);
      } catch (error) {
        console.warn('[auth] init failed:', error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      // INITIAL_SESSION is already handled by getSession above; token refreshes keep the same user.
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
      applySession(session, event === 'SIGNED_IN');
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const registerWithEmail = useCallback(async (emailInput: string, password: string, displayName?: string) => {
    const email = normalizeEmail(emailInput);
    if (!email.includes('@')) throw new Error('请输入有效邮箱。');
    if (password.length < 6) throw new Error('密码至少需要 6 位。');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(translateAuthError(error.message));
    if (!data.session?.user) {
      // Email confirmation is ON in project settings — there is no session yet.
      throw new Error('注册成功，请到邮箱点开确认链接后再登录。');
    }
    const name = displayName?.trim() || email.split('@')[0] || '用户';
    await cloudUpsertProfile(data.session.user.id, { display_name: name, profile_complete: false }).catch(() => {});
  }, []);

  const signInWithEmailPassword = useCallback(async (emailInput: string, password: string) => {
    const email = normalizeEmail(emailInput);
    if (!email.includes('@')) throw new Error('请输入有效邮箱。');
    if (!password) throw new Error('请输入密码。');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translateAuthError(error.message));
  }, []);

  const signInWithSocial = useCallback(async (mode: 'apple' | 'google', payload: SocialSignInPayload) => {
    if (!payload.idToken) throw new Error('登录信息不完整，请重试。');
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: mode,
      token: payload.idToken,
      ...(payload.rawNonce ? { nonce: payload.rawNonce } : {}),
    });
    if (error) throw new Error(translateAuthError(error.message));
    // Apple/Google only return the user's name on the FIRST authorization. Capture it once.
    const name = normalizeName(payload.displayName);
    if (data.session?.user && name) {
      const existing = await cloudGetProfile(data.session.user.id).catch(() => null);
      if (!existing?.display_name) await cloudUpsertProfile(data.session.user.id, { display_name: name }).catch(() => {});
    }
  }, []);

  const signInWithApple = useCallback((payload: SocialSignInPayload) => signInWithSocial('apple', payload), [signInWithSocial]);
  const signInWithGoogle = useCallback((payload: SocialSignInPayload) => signInWithSocial('google', payload), [signInWithSocial]);

  // Email password reset via OTP code (no deep link): Supabase emails a code, the user enters it
  // here, then we verify it (which opens a recovery session) and set the new password.
  const requestPasswordReset = useCallback(async (emailInput: string) => {
    const email = normalizeEmail(emailInput);
    if (!email.includes('@')) throw new Error('请输入有效邮箱。');
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(translateAuthError(error.message));
  }, []);

  const confirmPasswordReset = useCallback(async (emailInput: string, code: string, newPassword: string) => {
    const email = normalizeEmail(emailInput);
    if (!email.includes('@')) throw new Error('请输入有效邮箱。');
    if (!code.trim()) throw new Error('请输入邮箱里的验证码。');
    if (newPassword.length < 6) throw new Error('新密码至少需要 6 位。');
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'recovery' });
    if (verifyError) throw new Error(translateAuthError(verifyError.message));
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw new Error(translateAuthError(updateError.message));
  }, []);

  const unlockAdmin = useCallback(async (pin: string) => {
    const allowed = user?.role === 'admin' && pin.trim() === ADMIN_LOCAL_PIN;
    setAdminUnlocked(allowed);
    return allowed;
  }, [user?.role]);

  const lockAdmin = useCallback(() => setAdminUnlocked(false), []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        await configureRevenueCat();
        await Purchases.logOut();
      } catch (error) {
        console.log('[Auth] RevenueCat logOut skipped:', error);
      }
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    // Fully delete the auth user server-side (App Store requirement); cascades the cloud rows.
    // Best-effort: even if the function is unreachable we still clear local data and sign out.
    try {
      await supabase.functions.invoke('delete-account');
    } catch (error) {
      console.log('[Auth] delete-account function failed:', error);
    }
    if (user?.id) await cloudDeleteAll(user.id).catch(() => {});
    await resetAllData();
    await supabase.auth.signOut();
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        await configureRevenueCat();
        await Purchases.logOut();
      } catch (error) {
        console.log('[Auth] RevenueCat logOut after delete skipped:', error);
      }
    }
  }, [user?.id]);

  const updateProfile = useCallback(async (updates: { displayName?: string; avatarUri?: string; profileComplete?: boolean }) => {
    if (!user) return;
    const nextUser: AppUser = {
      ...user,
      displayName: updates.displayName?.trim() || user.displayName,
      avatarUri: updates.avatarUri ?? user.avatarUri,
      profileComplete: updates.profileComplete ?? user.profileComplete,
    };
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    await cloudUpsertProfile(user.id, {
      display_name: nextUser.displayName,
      avatar_uri: nextUser.avatarUri ?? null,
      profile_complete: !!nextUser.profileComplete,
    }).catch(() => {});
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
    requestPasswordReset,
    confirmPasswordReset,
    unlockAdmin,
    lockAdmin,
    signOut,
    deleteAccount,
    updateProfile,
  }), [adminUnlocked, confirmPasswordReset, deleteAccount, loading, lockAdmin, registerWithEmail, requestPasswordReset, signInWithApple, signInWithEmailPassword, signInWithGoogle, signOut, unlockAdmin, updateProfile, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
