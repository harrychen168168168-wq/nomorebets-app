import { useAuth } from '@/auth';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import GuardianSharingPanel from '@/components/GuardianSharingPanel';
import PageContainer from '@/components/PageContainer';
import ReminderSettingsCard from '@/components/ReminderSettingsCard';
import PaywallModal from '@/components/PaywallModal';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/config';
import { configureRevenueCat, customerInfoToSnapshot, formatSubscriptionDate, getFriendlyPurchaseError, getSubscriptionSnapshot, SubscriptionSnapshot } from '@/subscription';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Purchases from 'react-native-purchases';
import { loadData as loadStoredData, resetAllData, saveData as saveStoredData } from '../storage';

type Contact = { name: string; relation: string; phone: string; photo?: string };
type Goal = { title: string; target: number; current: number; deadline: string };

const RELATIONS = ['配偶', '子女', '父母', '兄弟姐妹', '朋友', '其他'];
const FREE_CONTACT_LIMIT = 1;
const FREE_GOAL_LIMIT = 1;

export default function ProfilePage() {
  const { user, isAdmin, isAdminCandidate, signOut, deleteAccount, unlockAdmin, lockAdmin, updateProfile } = useAuth();
  const router = useRouter();
  const [streak, setStreak] = useState(0);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeSection, setActiveSection] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<string | undefined>();
  const [subscription, setSubscription] = useState<SubscriptionSnapshot | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactPhoto, setNewContactPhoto] = useState('');
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalCurrent, setNewGoalCurrent] = useState('');
  const [newGoalDeadline, setNewGoalDeadline] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.displayName || '');
  const [profileAvatar, setProfileAvatar] = useState(user?.avatarUri || '');

  const isPro = !!subscription?.isPro;
  const isMonthlyPro = subscription?.planType === 'monthly';
  const isAnnualPro = subscription?.planType === 'annual';
  const isMutualPro = subscription?.planType === 'mutual';
  // Freemium: the local tools (contacts/goals/photos) are free for everyone to maximize retention
  // and grow the user base. Monetization comes from AI 冲动倾诉 and the guardian feature, which are
  // gated separately (emergency.tsx for AI, GuardianSharingPanel for invites).
  const hasFullAccess = true;

  useEffect(() => {
    setProfileName(user?.displayName || '');
    setProfileAvatar(user?.avatarUri || '');
  }, [user?.id, user?.displayName, user?.avatarUri]);

  useFocusEffect(useCallback(() => {
    loadData();
    refreshSubscription();
  }, [user?.id]));

  async function loadData() {
    const [s, c, g] = await Promise.all([loadStoredData('streak'), loadStoredData('importantContacts'), loadStoredData('myGoals')]);
    setStreak(Number(s) || 0);
    setContacts(c ? JSON.parse(c) : []);
    setGoals(g ? JSON.parse(g) : []);
  }

  async function refreshSubscription() {
    setSubscriptionLoading(true);
    const snapshot = await getSubscriptionSnapshot();
    setSubscription(snapshot);
    setSubscriptionLoading(false);
  }

  function requirePro(featureName: string) {
    if (hasFullAccess) return true;
    setPaywallFeature(featureName);
    setShowPaywall(true);
    return false;
  }

  async function handleRestorePurchase() {
    if (restoreLoading) return;
    if (Platform.OS !== 'ios') {
      Alert.alert('恢复购买', '订阅恢复需要在 iOS 真机、TestFlight 或 App Store 环境中测试。');
      return;
    }
    try {
      setRestoreLoading(true);
      await configureRevenueCat();
      const customerInfo = await Purchases.restorePurchases();
      const snapshot = customerInfoToSnapshot(customerInfo);
      setSubscription(snapshot);
      if (snapshot.isPro) Alert.alert('恢复成功', snapshot.planType === 'mutual' ? '互相守护版已激活。' : snapshot.planType === 'annual' ? '家庭守护版已激活。' : '个人自救版已激活。');
      else Alert.alert('没有找到有效订阅', '请确认当前 Apple ID 是否购买过该订阅。');
    } catch (error) {
      Alert.alert('恢复失败', getFriendlyPurchaseError(error));
    } finally {
      setRestoreLoading(false);
    }
  }

  async function pickAccountAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!result.canceled) setProfileAvatar(result.assets[0].uri);
  }

  async function saveAccountProfile() {
    await updateProfile({ displayName: profileName, avatarUri: profileAvatar });
    setEditingProfile(false);
    Alert.alert('已保存', '头像和名字已更新。');
  }

  async function pickPhoto() {
    if (!requirePro('联系人照片')) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!result.canceled) setNewContactPhoto(result.assets[0].uri);
  }

  function startAddContact() {
    if (!hasFullAccess && contacts.length >= FREE_CONTACT_LIMIT) {
      requirePro('添加更多重要联系人');
      return;
    }
    setActiveSection('contact');
  }

  function startAddGoal() {
    if (!hasFullAccess && goals.length >= FREE_GOAL_LIMIT) {
      requirePro('添加更多戒赌目标');
      return;
    }
    setActiveSection('goal');
  }

  async function saveContact() {
    if (!newContactName.trim()) return;
    if (!hasFullAccess && contacts.length >= FREE_CONTACT_LIMIT) {
      requirePro('添加更多重要联系人');
      return;
    }
    const newContact: Contact = { name: newContactName.trim(), relation: newContactRelation || '重要的人', phone: newContactPhone.trim(), photo: hasFullAccess ? newContactPhoto : '' };
    const updated = [...contacts, newContact];
    await saveStoredData('importantContacts', JSON.stringify(updated));
    setContacts(updated);
    setNewContactName('');
    setNewContactRelation('');
    setNewContactPhone('');
    setNewContactPhoto('');
    setActiveSection('');
  }

  async function deleteContact(index: number) {
    const updated = contacts.filter((_, i) => i !== index);
    await saveStoredData('importantContacts', JSON.stringify(updated));
    setContacts(updated);
  }

  async function saveGoal() {
    if (!newGoalTitle.trim()) return;
    if (!hasFullAccess && goals.length >= FREE_GOAL_LIMIT) {
      requirePro('添加更多戒赌目标');
      return;
    }
    const newGoal: Goal = { title: newGoalTitle.trim(), target: Number(newGoalTarget) || 0, current: Number(newGoalCurrent) || 0, deadline: newGoalDeadline.trim() };
    const updated = [...goals, newGoal];
    await saveStoredData('myGoals', JSON.stringify(updated));
    setGoals(updated);
    setNewGoalTitle('');
    setNewGoalTarget('');
    setNewGoalCurrent('');
    setNewGoalDeadline('');
    setActiveSection('');
  }

  async function deleteGoal(index: number) {
    const updated = goals.filter((_, i) => i !== index);
    await saveStoredData('myGoals', JSON.stringify(updated));
    setGoals(updated);
  }

  async function confirmReset() {
    await resetAllData();
    setStreak(0);
    setContacts([]);
    setGoals([]);
    setShowResetConfirm(false);
    router.push('/');
  }

  async function confirmDeleteAccount() {
    await deleteAccount();
    setShowDeleteConfirm(false);
  }

  function callNumber(number: string) {
    Linking.openURL('tel:' + number);
  }

  function openSubscriptionManagement() {
    Linking.openURL(subscription?.managementURL || 'https://apps.apple.com/account/subscriptions');
  }

  function formatAccountSub() {
    if (user?.mode === 'guest') return '访客模式 · 本机保存';
    if (user?.mode === 'apple') return user.email ? 'Apple 登录 · ' + user.email : 'Apple 登录';
    if (user?.mode === 'google') return user.email ? 'Google 登录 · ' + user.email : 'Google 登录';
    return user?.email || '本机邮箱账号';
  }

  async function handleAdminUnlock() {
    const ok = await unlockAdmin(adminPin);
    if (!ok) {
      Alert.alert('验证失败', '管理员 PIN 不正确。');
      return;
    }
    setAdminPin('');
    Alert.alert('验证成功', '管理员入口已开启。');
  }

  function subscriptionRemainingDaysText() {
    if (!isPro) return '';
    const expiration = subscription?.expirationDate;
    if (!expiration) return '剩余会员天数：长期有效';
    const expiresAt = new Date(expiration).getTime();
    if (Number.isNaN(expiresAt)) return '剩余会员天数：暂时无法计算';
    const days = Math.max(0, Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24)));
    return '剩余会员天数：' + days + ' 天';
  }

  function subscriptionDescription() {
    if (subscriptionLoading) return '正在刷新订阅状态...';
    const remaining = subscriptionRemainingDaysText();
    const renewalDate = '到期/续订日期：' + formatSubscriptionDate(subscription?.expirationDate);
    if (isMutualPro) return remaining + ' · ' + renewalDate + ' · 互相守护版：双方各自 AI 每月 100 次。';
    if (isAnnualPro) return remaining + ' · ' + renewalDate + ' · 家庭守护版：含全部功能和家庭共享 AI 每月 100 次。';
    if (isMonthlyPro) return remaining + ' · ' + renewalDate + ' · 个人自救版：含 AI 每月 50 次，不包含邀请共享。';
    return '个人自救版含 AI 每月 50 次；家庭守护版解锁家人守护和共享 AI；互相守护版适合两个人一起戒赌。';
  }

  return (
    <PageContainer>
      <KeyboardAwareScrollView style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>我的</Text><Text style={styles.headerStreak}>已坚持 {streak} 天</Text></View>

        <View style={styles.accountCard}>
          <TouchableOpacity style={styles.accountAvatar} onPress={() => setEditingProfile(true)}>
            {user?.avatarUri ? <Image source={{ uri: user.avatarUri }} style={styles.accountAvatarImage} /> : <Text style={styles.accountAvatarText}>{isAdmin ? '🛡️' : '🌱'}</Text>}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.accountName}>{user?.displayName || '用户'}</Text>
            <Text style={styles.accountSub}>{formatAccountSub()}</Text>
            <TouchableOpacity onPress={() => setEditingProfile(true)}><Text style={styles.editProfileLink}>编辑头像和名字</Text></TouchableOpacity>
          </View>
          <TouchableOpacity onPress={signOut}><Text style={styles.logoutText}>退出</Text></TouchableOpacity>
        </View>

        {editingProfile && (
          <View style={styles.profileEditCard}>
            <TouchableOpacity style={styles.avatarPicker} onPress={pickAccountAvatar}>
              {profileAvatar ? <Image source={{ uri: profileAvatar }} style={styles.avatarPreview} /> : <Text style={styles.avatarPickerText}>选择头像</Text>}
            </TouchableOpacity>
            <TextInput style={styles.inputBox} placeholder="显示名字" value={profileName} onChangeText={setProfileName} />
            <View style={styles.formBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setEditingProfile(false)}><Text style={styles.btnCancelText}>取消</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={saveAccountProfile}><Text style={styles.btnSaveText}>保存</Text></TouchableOpacity>
            </View>
          </View>
        )}

        <View style={[styles.subscriptionCard, isPro && styles.subscriptionCardActive]}>
          <View style={styles.subscriptionTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.subscriptionTitle, isPro && styles.subscriptionTitleActive]}>{isMutualPro ? '互相守护版已激活' : isAnnualPro ? '家庭守护版已激活' : isMonthlyPro ? '个人自救版已激活' : '会员方案'}</Text>
              <Text style={styles.subscriptionSub}>{subscriptionDescription()}</Text>
            </View>
            {subscriptionLoading ? <ActivityIndicator color="#2E7D32" /> : null}
          </View>
          {subscription?.error && !isPro ? <Text style={styles.subscriptionWarn}>{subscription.error}</Text> : null}
          <View style={styles.subscriptionActions}>
            {!isPro && <TouchableOpacity style={styles.subscriptionPrimary} onPress={() => { setPaywallFeature(undefined); setShowPaywall(true); }}><Text style={styles.subscriptionPrimaryText}>查看会员方案</Text></TouchableOpacity>}
            {isMonthlyPro && <TouchableOpacity style={styles.subscriptionPrimary} onPress={() => { setPaywallFeature(undefined); setShowPaywall(true); }}><Text style={styles.subscriptionPrimaryText}>升级家庭守护版</Text></TouchableOpacity>}
            <TouchableOpacity style={styles.subscriptionSecondary} onPress={handleRestorePurchase} disabled={restoreLoading}>{restoreLoading ? <ActivityIndicator color="#2E7D32" /> : <Text style={styles.subscriptionSecondaryText}>恢复购买</Text>}</TouchableOpacity>
            <TouchableOpacity style={styles.subscriptionSecondary} onPress={openSubscriptionManagement}><Text style={styles.subscriptionSecondaryText}>管理订阅</Text></TouchableOpacity>
          </View>
        </View>

        <GuardianSharingPanel subscription={subscription} />

        <ReminderSettingsCard />

        {isAdminCandidate && (
          <View style={styles.adminVerifyCard}>
            <Text style={styles.adminVerifyTitle}>管理员验证</Text>
            <Text style={styles.adminVerifySub}>管理员功能需要二次验证。正式接后端后，应改为服务器角色校验。</Text>
            {isAdmin ? (
              <>
                <TouchableOpacity style={styles.adminBanner} onPress={() => router.push('/admin')}><Text style={styles.adminText}>进入管理员中心</Text></TouchableOpacity>
                <TouchableOpacity style={styles.adminLockBtn} onPress={lockAdmin}><Text style={styles.adminLockText}>锁定管理员入口</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput style={styles.inputBox} placeholder="输入管理员 PIN" value={adminPin} onChangeText={setAdminPin} secureTextEntry keyboardType="number-pad" />
                <TouchableOpacity style={styles.adminBanner} onPress={handleAdminUnlock}><Text style={styles.adminText}>验证管理员身份</Text></TouchableOpacity>
              </>
            )}
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardTitleRow}><Text style={styles.cardTitle}>重要的人</Text>{!hasFullAccess && <Text style={styles.freeBadge}>免费 {contacts.length}/{FREE_CONTACT_LIMIT}</Text>}</View>
          <Text style={styles.cardSub}>危急时刻，他们是你最重要的力量。可以添加多位联系人和照片。</Text>
          {contacts.map((c, i) => (
            <View key={c.name + i} style={styles.contactRow}>
              {c.photo ? <Image source={{ uri: c.photo }} style={styles.contactPhoto} /> : <View style={styles.contactPhotoPlaceholder}><Text style={{ fontSize: 20 }}>👤</Text></View>}
              <View style={styles.contactInfo}><Text style={styles.contactName}>{c.name}</Text><Text style={styles.contactDetail}>{c.relation}{c.phone ? ' · ' + c.phone : ''}</Text></View>
              {c.phone ? <TouchableOpacity onPress={() => callNumber(c.phone)}><Text style={styles.callBtn}>拨打</Text></TouchableOpacity> : null}
              <TouchableOpacity onPress={() => deleteContact(i)}><Text style={styles.deleteBtn}>删除</Text></TouchableOpacity>
            </View>
          ))}
          {activeSection === 'contact' ? (
            <View style={styles.addForm}>
              <TextInput style={styles.inputBox} placeholder="姓名" value={newContactName} onChangeText={setNewContactName} />
              <View style={styles.relationRow}>{RELATIONS.map((r) => <TouchableOpacity key={r} style={[styles.relationBtn, newContactRelation === r && styles.relationSelected]} onPress={() => setNewContactRelation(r)}><Text style={[styles.relationText, newContactRelation === r && styles.relationTextSelected]}>{r}</Text></TouchableOpacity>)}</View>
              <TextInput style={styles.inputBox} placeholder="电话号码（可选）" value={newContactPhone} onChangeText={setNewContactPhone} keyboardType="phone-pad" />
              <TouchableOpacity style={[styles.photoBtn, !hasFullAccess && styles.photoBtnLocked]} onPress={pickPhoto}>{newContactPhoto ? <Image source={{ uri: newContactPhoto }} style={styles.photoPreview} /> : <Text style={styles.photoBtnText}>{hasFullAccess ? '添加照片（可选）' : '联系人照片为家庭守护版功能'}</Text>}</TouchableOpacity>
              <View style={styles.formBtns}><TouchableOpacity style={styles.btnCancel} onPress={() => setActiveSection('')}><Text style={styles.btnCancelText}>取消</Text></TouchableOpacity><TouchableOpacity style={styles.btnSave} onPress={saveContact}><Text style={styles.btnSaveText}>保存</Text></TouchableOpacity></View>
            </View>
          ) : <TouchableOpacity style={styles.btnAdd} onPress={startAddContact}><Text style={styles.btnAddText}>+ 添加重要的人</Text></TouchableOpacity>}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}><Text style={styles.cardTitle}>我的目标</Text>{!hasFullAccess && <Text style={styles.freeBadge}>免费 {goals.length}/{FREE_GOAL_LIMIT}</Text>}</View>
          <Text style={styles.cardSub}>把节省下来的钱用在真正重要的事上。可以添加多个目标。</Text>
          {goals.map((g, i) => {
            const progress = g.target > 0 ? Math.min((g.current / g.target) * 100, 100) : 0;
            return (
              <View key={g.title + i} style={styles.goalCard}>
                <View style={styles.goalHeader}><Text style={styles.goalTitle}>{g.title}</Text><TouchableOpacity onPress={() => deleteGoal(i)}><Text style={styles.deleteBtn}>删除</Text></TouchableOpacity></View>
                <View style={styles.progressBar}><View style={[styles.progressFill, { width: (String(progress) + '%') as any }]} /></View>
                <Text style={styles.goalProgress}>${g.current} / ${g.target} ({Math.round(progress)}%)</Text>
                {g.deadline ? <Text style={styles.goalDeadline}>目标日期：{g.deadline}</Text> : null}
              </View>
            );
          })}
          {activeSection === 'goal' ? (
            <View style={styles.addForm}>
              <TextInput style={styles.inputBox} placeholder="目标名称" value={newGoalTitle} onChangeText={setNewGoalTitle} />
              <TextInput style={styles.inputBox} placeholder="目标金额 $" value={newGoalTarget} onChangeText={setNewGoalTarget} keyboardType="numeric" />
              <TextInput style={styles.inputBox} placeholder="当前已存 $" value={newGoalCurrent} onChangeText={setNewGoalCurrent} keyboardType="numeric" />
              <TextInput style={styles.inputBox} placeholder="目标日期（如 2026-12-31）" value={newGoalDeadline} onChangeText={setNewGoalDeadline} />
              <View style={styles.formBtns}><TouchableOpacity style={styles.btnCancel} onPress={() => setActiveSection('')}><Text style={styles.btnCancelText}>取消</Text></TouchableOpacity><TouchableOpacity style={styles.btnSave} onPress={saveGoal}><Text style={styles.btnSaveText}>保存</Text></TouchableOpacity></View>
            </View>
          ) : <TouchableOpacity style={styles.btnAdd} onPress={startAddGoal}><Text style={styles.btnAddText}>+ 添加目标</Text></TouchableOpacity>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>求助资源</Text>
          <Text style={styles.cardSub}>你不是一个人在战斗。</Text>
          <TouchableOpacity style={styles.resourceBtn} onPress={() => callNumber('1-800-522-4700')}><Text style={styles.resourceBtnText}>全国赌博热线</Text><Text style={styles.resourceBtnSub}>1-800-522-4700（24小时）</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.resourceBtn, { marginTop: 10 }]} onPress={() => callNumber('988')}><Text style={styles.resourceBtnText}>心理危机热线</Text><Text style={styles.resourceBtnSub}>988（24小时）</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.resourceBtn, { marginTop: 10 }]} onPress={() => Linking.openURL('mailto:' + SUPPORT_EMAIL)}><Text style={styles.resourceBtnText}>联系支持</Text><Text style={styles.resourceBtnSub}>{SUPPORT_EMAIL}</Text></TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>隐私与安全</Text>
          <Text style={styles.cardSub}>管理账号、隐私政策和本地数据。</Text>
          <TouchableOpacity style={styles.securityBtn} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}><Text style={styles.securityText}>隐私政策</Text></TouchableOpacity>
          <TouchableOpacity style={styles.securityBtn} onPress={() => Linking.openURL(TERMS_URL)}><Text style={styles.securityText}>使用条款</Text></TouchableOpacity>
          {!showDeleteConfirm ? <TouchableOpacity style={styles.securityDangerBtn} onPress={() => setShowDeleteConfirm(true)}><Text style={styles.securityDangerText}>删除账号与本机数据</Text></TouchableOpacity> : (
            <View style={styles.deleteBox}>
              <Text style={styles.dangerWarning}>删除后，本机账号和该账号下的数据会被清除。Apple 订阅需要到 Apple ID 订阅管理里单独取消。</Text>
              <View style={styles.formBtns}><TouchableOpacity style={styles.btnCancel} onPress={() => setShowDeleteConfirm(false)}><Text style={styles.btnCancelText}>取消</Text></TouchableOpacity><TouchableOpacity style={[styles.btnDanger, { flex: 1 }]} onPress={confirmDeleteAccount}><Text style={styles.btnDangerText}>确认删除</Text></TouchableOpacity></View>
            </View>
          )}
        </View>

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>危险操作</Text>
          {!showResetConfirm ? <TouchableOpacity style={styles.btnDanger} onPress={() => setShowResetConfirm(true)}><Text style={styles.btnDangerText}>清除当前账号数据</Text></TouchableOpacity> : (
            <View>
              <Text style={styles.dangerWarning}>确定要清除当前账号的所有记录、联系人、目标和设置吗？此操作不可恢复。</Text>
              <View style={styles.formBtns}><TouchableOpacity style={styles.btnCancel} onPress={() => setShowResetConfirm(false)}><Text style={styles.btnCancelText}>取消</Text></TouchableOpacity><TouchableOpacity style={[styles.btnDanger, { flex: 1 }]} onPress={confirmReset}><Text style={styles.btnDangerText}>确认清除</Text></TouchableOpacity></View>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
        <PaywallModal visible={showPaywall} featureName={paywallFeature} onClose={() => setShowPaywall(false)} onSuccess={() => { setShowPaywall(false); refreshSubscription(); }} />
      </KeyboardAwareScrollView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF7' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#2E7D32' },
  headerStreak: { fontSize: 14, color: '#888', marginTop: 4 },
  accountCard: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center' },
  accountAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' },
  accountAvatarImage: { width: 46, height: 46, borderRadius: 23 },
  accountAvatarText: { fontSize: 24 },
  accountName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  accountSub: { fontSize: 12, color: '#888', marginTop: 2 },
  logoutText: { color: '#2E7D32', fontSize: 13, fontWeight: 'bold' },
  editProfileLink: { color: '#2E7D32', fontSize: 12, marginTop: 6, fontWeight: 'bold' },
  profileEditCard: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  avatarPicker: { alignSelf: 'center', width: 86, height: 86, borderRadius: 43, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 14, overflow: 'hidden' },
  avatarPreview: { width: 86, height: 86, borderRadius: 43 },
  avatarPickerText: { color: '#2E7D32', fontSize: 13, fontWeight: 'bold' },
  subscriptionCard: { margin: 16, marginBottom: 0, backgroundColor: '#FFF8E1', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FFD54F' },
  subscriptionCardActive: { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' },
  subscriptionTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subscriptionTitle: { fontSize: 16, color: '#F57F17', fontWeight: 'bold', marginBottom: 4 },
  subscriptionTitleActive: { color: '#2E7D32' },
  subscriptionSub: { fontSize: 12, color: '#666', lineHeight: 18 },
  subscriptionWarn: { fontSize: 12, color: '#7A4C00', lineHeight: 18, marginTop: 8 },
  subscriptionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  subscriptionPrimary: { backgroundColor: '#2E7D32', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  subscriptionPrimaryText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  subscriptionSecondary: { borderWidth: 1, borderColor: '#2E7D32', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, minWidth: 78, alignItems: 'center' },
  subscriptionSecondaryText: { color: '#2E7D32', fontSize: 13, fontWeight: 'bold' },
  adminVerifyCard: { margin: 16, marginBottom: 0, backgroundColor: '#E8F0FE', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#90CAF9' },
  adminVerifyTitle: { fontSize: 15, color: '#1565C0', fontWeight: 'bold', marginBottom: 4 },
  adminVerifySub: { fontSize: 12, color: '#555', lineHeight: 18, marginBottom: 12 },
  adminBanner: { backgroundColor: '#1565C0', borderRadius: 12, padding: 14, alignItems: 'center' },
  adminText: { fontSize: 14, color: '#fff', fontWeight: 'bold' },
  adminLockBtn: { alignItems: 'center', paddingTop: 10 },
  adminLockText: { fontSize: 12, color: '#1565C0', textDecorationLine: 'underline' },
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  freeBadge: { fontSize: 11, color: '#2E7D32', backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  cardSub: { fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 19 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 8 },
  contactPhoto: { width: 44, height: 44, borderRadius: 22 },
  contactPhotoPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  contactDetail: { fontSize: 13, color: '#888', marginTop: 2 },
  callBtn: { color: '#2E7D32', fontSize: 13, fontWeight: 'bold' },
  deleteBtn: { color: '#D32F2F', fontSize: 13, marginLeft: 8 },
  addForm: { marginTop: 12 },
  inputBox: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#333', marginBottom: 10 },
  relationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  relationBtn: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  relationSelected: { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' },
  relationText: { fontSize: 13, color: '#555' },
  relationTextSelected: { color: '#2E7D32', fontWeight: 'bold' },
  photoBtn: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 10 },
  photoBtnLocked: { backgroundColor: '#F8FAF7' },
  photoBtnText: { color: '#888', fontSize: 14 },
  photoPreview: { width: 80, height: 80, borderRadius: 40 },
  formBtns: { flexDirection: 'row', gap: 10 },
  btnCancel: { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 12, alignItems: 'center' },
  btnCancelText: { color: '#888', fontSize: 14 },
  btnSave: { flex: 1, backgroundColor: '#2E7D32', borderRadius: 10, padding: 12, alignItems: 'center' },
  btnSaveText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  btnAdd: { borderWidth: 1.5, borderColor: '#2E7D32', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 },
  btnAddText: { color: '#2E7D32', fontSize: 14, fontWeight: 'bold' },
  goalCard: { backgroundColor: '#F8FAF7', borderRadius: 10, padding: 14, marginBottom: 10 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  goalTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  progressBar: { height: 8, backgroundColor: '#eee', borderRadius: 4, marginBottom: 6 },
  progressFill: { height: 8, backgroundColor: '#2E7D32', borderRadius: 4 },
  goalProgress: { fontSize: 13, color: '#666' },
  goalDeadline: { fontSize: 12, color: '#888', marginTop: 4 },
  resourceBtn: { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 16 },
  resourceBtnText: { fontSize: 15, fontWeight: 'bold', color: '#2E7D32' },
  resourceBtnSub: { fontSize: 13, color: '#666', marginTop: 4 },
  securityBtn: { backgroundColor: '#F8FAF7', borderRadius: 10, padding: 14, marginBottom: 10 },
  securityText: { fontSize: 14, color: '#333', fontWeight: 'bold' },
  securityDangerBtn: { borderWidth: 1.5, borderColor: '#D32F2F', borderRadius: 10, padding: 14, alignItems: 'center' },
  securityDangerText: { color: '#D32F2F', fontSize: 14, fontWeight: 'bold' },
  deleteBox: { backgroundColor: '#FFF1F1', borderRadius: 10, padding: 14 },
  dangerCard: { backgroundColor: '#FFF1F1', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  dangerTitle: { fontSize: 15, fontWeight: 'bold', color: '#D32F2F', marginBottom: 12 },
  dangerWarning: { fontSize: 13, color: '#D32F2F', lineHeight: 20, marginBottom: 12 },
  btnDanger: { borderWidth: 1.5, borderColor: '#D32F2F', borderRadius: 10, padding: 14, alignItems: 'center' },
  btnDangerText: { color: '#D32F2F', fontSize: 14, fontWeight: 'bold' },
});
