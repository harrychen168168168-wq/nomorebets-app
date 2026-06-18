import { useAuth } from '@/auth';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/config';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function LoginScreen() {
  const { signInWithEmail, continueAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin() {
    if (!email.trim()) {
      Alert.alert('请输入邮箱', '登录后可以保存记录、恢复会员状态，并为以后换手机同步做准备。');
      return;
    }
    try {
      setLoading(true);
      await signInWithEmail(email, displayName);
    } catch (error: any) {
      Alert.alert('登录失败', error?.message || '请检查邮箱后重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    try {
      setLoading(true);
      await continueAsGuest();
    } catch {
      Alert.alert('无法进入', '请稍后再试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🌱</Text>
        </View>
        <Text style={styles.title}>NoMoreBets</Text>
        <Text style={styles.subtitle}>登录后，你的戒赌记录和会员状态会绑定到同一个身份。</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>进入你的戒赌空间</Text>
          <TextInput
            style={styles.input}
            placeholder="邮箱地址"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="昵称（可选）"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleEmailLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>登录 / 创建本地账号</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleGuest} disabled={loading}>
            <Text style={styles.secondaryText}>先以访客模式进入</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>为什么需要登录？</Text>
          <Text style={styles.infoText}>• 绑定 App Store 会员状态</Text>
          <Text style={styles.infoText}>• 防止误删数据</Text>
          <Text style={styles.infoText}>• 为后续云端备份和换手机恢复预留</Text>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.warningText}>本 App 不是医疗服务、心理治疗或紧急救援工具。如有自伤、伤人或紧急危险，请立即拨打 988 或 911。</Text>
        </View>

        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
            <Text style={styles.legalLink}>隐私政策</Text>
          </TouchableOpacity>
          <Text style={styles.legalDivider}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={styles.legalLink}>使用条款</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAF7' },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },
  logoCircle: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  logoEmoji: { fontSize: 42 },
  title: { fontSize: 34, fontWeight: 'bold', color: '#2E7D32', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginTop: 10, marginBottom: 28 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#333', marginBottom: 12, backgroundColor: '#fff' },
  primaryButton: { backgroundColor: '#2E7D32', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  secondaryButton: { borderWidth: 1.5, borderColor: '#2E7D32', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  secondaryText: { color: '#2E7D32', fontSize: 15, fontWeight: 'bold' },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginTop: 18 },
  infoTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  infoText: { fontSize: 13, color: '#666', lineHeight: 22 },
  warningCard: { backgroundColor: '#FFF8E7', borderRadius: 14, padding: 14, marginTop: 14 },
  warningText: { fontSize: 12, color: '#7A4C00', lineHeight: 18, textAlign: 'center' },
  legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  legalLink: { color: '#2E7D32', fontSize: 12, textDecorationLine: 'underline' },
  legalDivider: { color: '#aaa', marginHorizontal: 8 },
});
