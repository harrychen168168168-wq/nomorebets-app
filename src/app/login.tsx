import { useAuth } from '@/auth';
import { GOOGLE_IOS_CLIENT_ID, PRIVACY_POLICY_URL, TERMS_URL } from '@/config';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type AuthMode = 'login' | 'register';

export default function LoginScreen() {
  const { registerWithEmail, signInWithEmailPassword, signInWithApple, signInWithGoogle, requestPasswordReset, confirmPasswordReset } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loadingAction, setLoadingAction] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetStage, setResetStage] = useState<'request' | 'verify'>('request');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const googleConfigured = Platform.OS === 'ios' && !!GOOGLE_IOS_CLIENT_ID;

  const loading = loadingAction !== '';

  // Native Google Sign-In returns a backend-verifiable id_token directly (no browser redirect).
  useEffect(() => {
    if (Platform.OS !== 'web' && GOOGLE_IOS_CLIENT_ID) GoogleSignin.configure({ iosClientId: GOOGLE_IOS_CLIENT_ID });
  }, []);

  const primaryLabel = useMemo(() => authMode === 'login' ? '邮箱登录' : '注册邮箱账号', [authMode]);

  async function handleEmailAuth() {
    if (!email.trim()) {
      Alert.alert('请输入邮箱', '邮箱会用来绑定本机账号和会员状态。');
      return;
    }
    if (password.length < 6) {
      Alert.alert('请输入密码', '密码至少需要 6 位。');
      return;
    }
    try {
      setLoadingAction('email');
      if (authMode === 'login') {
        await signInWithEmailPassword(email, password);
        Alert.alert('登录成功', '已进入你的账号。');
      } else {
        await registerWithEmail(email, password, displayName);
        Alert.alert('注册成功', '账号已创建。以后请用这个邮箱登录。');
      }
    } catch (error: any) {
      Alert.alert(authMode === 'login' ? '登录失败' : '注册失败', error?.message || '请检查后重试。');
    } finally {
      setLoadingAction('');
    }
  }

  function openResetFlow() {
    setResetMode(true);
    setResetStage('request');
    setResetCode('');
    setNewPassword('');
  }

  function closeResetFlow() {
    setResetMode(false);
    setResetStage('request');
    setResetCode('');
    setNewPassword('');
  }

  async function handleSendResetCode() {
    if (!email.trim()) {
      Alert.alert('请输入邮箱', '我们会把验证码发到这个邮箱。');
      return;
    }
    try {
      setLoadingAction('reset');
      await requestPasswordReset(email);
      setResetStage('verify');
      Alert.alert('验证码已发送', '请查收邮箱里的验证码（也看看垃圾邮件箱）。');
    } catch (error: any) {
      Alert.alert('发送失败', error?.message || '请稍后再试。');
    } finally {
      setLoadingAction('');
    }
  }

  async function handleConfirmReset() {
    if (!resetCode.trim()) {
      Alert.alert('请输入验证码', '验证码在你的邮箱里。');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('新密码太短', '新密码至少需要 6 位。');
      return;
    }
    try {
      setLoadingAction('reset');
      await confirmPasswordReset(email, resetCode, newPassword);
      Alert.alert('密码已重置', '已用新密码登录。');
      // A recovery session is now active — AppShell switches to the app automatically.
    } catch (error: any) {
      Alert.alert('重置失败', error?.message || '请检查验证码后重试。');
    } finally {
      setLoadingAction('');
    }
  }

  async function handleAppleLogin() {
    if (Platform.OS !== 'ios') {
      Alert.alert('Apple 登录', 'Apple 登录需要在 iOS 真机、TestFlight 或 App Store 环境中使用。');
      return;
    }
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        Alert.alert('Apple 登录不可用', '当前设备暂时不支持 Sign in with Apple。');
        return;
      }
      setLoadingAction('apple');
      // Supabase validates Apple's id_token against a nonce: we send Apple the SHA-256 hash and
      // Supabase the raw value (replay protection).
      const rawNonce = Array.from(await Crypto.getRandomBytesAsync(16)).map((b) => b.toString(16).padStart(2, '0')).join('');
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) {
        Alert.alert('Apple 登录失败', '没有收到 Apple 身份令牌，请稍后重试。');
        return;
      }
      const nameParts = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean);
      await signInWithApple({ idToken: credential.identityToken, rawNonce, email: credential.email, displayName: nameParts.join(' ') });
      Alert.alert('登录成功', 'Apple 账号已登录。');
    } catch (error: any) {
      if (error?.code !== 'ERR_REQUEST_CANCELED') Alert.alert('Apple 登录失败', '请稍后再试。');
    } finally {
      setLoadingAction('');
    }
  }

  async function handleGoogleLogin() {
    if (Platform.OS !== 'ios') {
      Alert.alert('Google 登录', 'Google 登录需要在 iOS 真机、TestFlight 或 App Store 环境中使用。');
      return;
    }
    if (!googleConfigured) {
      Alert.alert('Google 登录未配置', '请先在 src/config.ts 填入 Google iOS Client ID。');
      return;
    }
    try {
      setLoadingAction('google');
      await GoogleSignin.hasPlayServices();
      const result: any = await GoogleSignin.signIn();
      if (result?.type === 'cancelled') return;
      const idToken = result?.data?.idToken ?? result?.idToken;
      const profile = result?.data?.user ?? result?.user;
      if (!idToken) {
        Alert.alert('Google 登录失败', '没有拿到 Google 身份令牌，请稍后重试。');
        return;
      }
      await signInWithGoogle({ idToken, email: profile?.email, displayName: profile?.name });
      Alert.alert('登录成功', 'Google 账号已登录。');
    } catch (error: any) {
      if (error?.code !== statusCodes.SIGN_IN_CANCELLED) Alert.alert('Google 登录失败', error?.message || '请稍后再试。');
    } finally {
      setLoadingAction('');
    }
  }


  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logoCircle}><Text style={styles.logoEmoji}>🌱</Text></View>
        <Text style={styles.title}>NoMoreBets</Text>
        <Text style={styles.subtitle}>登录后，每个账号会使用自己的戒赌记录、联系人、目标和会员状态。</Text>

        {!resetMode ? (
          <View style={styles.card}>
            <View style={styles.segment}>
              {([['login', '登录'], ['register', '注册']] as const).map(([key, label]) => (
                <TouchableOpacity key={key} style={[styles.segmentItem, authMode === key && styles.segmentActive]} onPress={() => setAuthMode(key)} disabled={loading}>
                  <Text style={[styles.segmentText, authMode === key && styles.segmentTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput style={styles.input} placeholder="邮箱地址" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder="密码（至少 6 位）" secureTextEntry value={password} onChangeText={setPassword} />
            {authMode === 'register' && <TextInput style={styles.input} placeholder="昵称（可选）" value={displayName} onChangeText={setDisplayName} />}
            <TouchableOpacity style={styles.primaryButton} onPress={handleEmailAuth} disabled={loading}>
              {loadingAction === 'email' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{primaryLabel}</Text>}
            </TouchableOpacity>
            {authMode === 'login' && (
              <TouchableOpacity style={styles.forgotRow} onPress={openResetFlow} disabled={loading}>
                <Text style={styles.forgotLink}>忘记密码？</Text>
              </TouchableOpacity>
            )}

            <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.dividerText}>或</Text><View style={styles.divider} /></View>

            <TouchableOpacity style={styles.providerButton} onPress={handleAppleLogin} disabled={loading}>
              {loadingAction === 'apple' ? <ActivityIndicator color="#111" /> : <Text style={styles.providerText}>使用 Apple 登录</Text>}
            </TouchableOpacity>
            {googleConfigured && (
              <TouchableOpacity style={styles.providerButton} onPress={handleGoogleLogin} disabled={loading}>
                {loadingAction === 'google' ? <ActivityIndicator color="#111" /> : <Text style={styles.providerText}>使用 Google 登录</Text>}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.resetTitle}>重置密码</Text>
            {resetStage === 'request' ? (
              <>
                <Text style={styles.resetHint}>输入你的邮箱，我们会把验证码发过去。</Text>
                <TextInput style={styles.input} placeholder="邮箱地址" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} />
                <TouchableOpacity style={styles.primaryButton} onPress={handleSendResetCode} disabled={loading}>
                  {loadingAction === 'reset' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>发送验证码</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.resetHint}>验证码已发到 {email}，输入验证码并设置新密码。</Text>
                <TextInput style={styles.input} placeholder="邮箱验证码" keyboardType="number-pad" autoCapitalize="none" value={resetCode} onChangeText={setResetCode} />
                <TextInput style={styles.input} placeholder="新密码（至少 6 位）" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
                <TouchableOpacity style={styles.primaryButton} onPress={handleConfirmReset} disabled={loading}>
                  {loadingAction === 'reset' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>重置并登录</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.forgotRow} onPress={handleSendResetCode} disabled={loading}>
                  <Text style={styles.forgotLink}>没收到？重新发送</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.backRow} onPress={closeResetFlow} disabled={loading}>
              <Text style={styles.backLink}>← 返回登录</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>账号说明</Text>
          <Text style={styles.infoText}>· 登录后，你的记录会安全同步到云端。</Text>
          <Text style={styles.infoText}>· 换手机或重装后，用同一个登录方式即可找回数据。</Text>
          <Text style={styles.infoText}>· 支持邮箱、Apple、Google 登录。</Text>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.warningText}>本 App 不是医疗服务、心理治疗或紧急救援工具。如有自伤、伤人或紧急危险，请立即拨打 988 或 911。</Text>
        </View>

        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}><Text style={styles.legalLink}>隐私政策</Text></TouchableOpacity>
          <Text style={styles.legalDivider}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}><Text style={styles.legalLink}>使用条款</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAF7' },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 70, paddingBottom: 40 },
  logoCircle: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  logoEmoji: { fontSize: 42 },
  title: { fontSize: 34, fontWeight: 'bold', color: '#2E7D32', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginTop: 10, marginBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  segment: { flexDirection: 'row', backgroundColor: '#F1F3F1', borderRadius: 12, padding: 4, marginBottom: 16 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { fontSize: 14, color: '#777', fontWeight: 'bold' },
  segmentTextActive: { color: '#2E7D32' },
  input: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#333', marginBottom: 12, backgroundColor: '#fff' },
  primaryButton: { backgroundColor: '#2E7D32', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  forgotRow: { alignItems: 'center', paddingVertical: 10 },
  forgotLink: { color: '#2E7D32', fontSize: 13, fontWeight: 'bold' },
  resetTitle: { fontSize: 18, fontWeight: 'bold', color: '#2E7D32', marginBottom: 6, textAlign: 'center' },
  resetHint: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 14, textAlign: 'center' },
  backRow: { alignItems: 'center', paddingTop: 6 },
  backLink: { color: '#888', fontSize: 13 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  divider: { flex: 1, height: 1, backgroundColor: '#eee' },
  dividerText: { color: '#aaa', fontSize: 12, marginHorizontal: 10 },
  providerButton: { borderWidth: 1.5, borderColor: '#DADCE0', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10, backgroundColor: '#fff' },
  providerText: { color: '#222', fontSize: 15, fontWeight: 'bold' },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginTop: 18 },
  infoTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  infoText: { fontSize: 13, color: '#666', lineHeight: 22 },
  warningCard: { backgroundColor: '#FFF8E7', borderRadius: 14, padding: 14, marginTop: 14 },
  warningText: { fontSize: 12, color: '#7A4C00', lineHeight: 18, textAlign: 'center' },
  legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  legalLink: { color: '#2E7D32', fontSize: 12, textDecorationLine: 'underline' },
  legalDivider: { color: '#aaa', marginHorizontal: 8 },
});
