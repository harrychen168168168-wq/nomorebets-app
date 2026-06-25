import { useAuth } from '@/auth';
import { acceptGuardianInvite, cancelGuardianLink, createGuardianInvite, GuardianLink, isCommunityConfigured, LinkedStatus, listLinkedStatuses, pushMyGuardianStatus } from '@/community';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SubscriptionSnapshot } from '@/subscription';

type Props = {
  subscription: SubscriptionSnapshot | null;
};

function formatStatusTime(value?: string | null) {
  if (!value) return '未知时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知时间';
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return diffMin + ' 分钟前';
  if (diffMin < 1440) return Math.floor(diffMin / 60) + ' 小时前';
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

export default function GuardianSharingPanel({ subscription }: Props) {
  const { user } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [acceptCode, setAcceptCode] = useState('');
  const [linked, setLinked] = useState<LinkedStatus[]>([]);

  const planType = subscription?.planType;
  const canInviteFamily = planType === 'annual';
  const canInviteMutual = planType === 'mutual';

  const load = useCallback(async () => {
    if (!user) return;
    // Publish my own shareable status first, then read what my linked guardian(s) shared with me.
    await pushMyGuardianStatus(user.id).catch(() => {});
    const statuses = await listLinkedStatuses(user.id).catch(() => []);
    setLinked(statuses);
  }, [user]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  async function makeInvite(type: 'family' | 'mutual') {
    if (!user) return;
    if (!isCommunityConfigured()) {
      Alert.alert('需要配置 Supabase', '邀请码和共享关系需要真实后端。');
      return;
    }
    try {
      const invite = await createGuardianInvite(user.id, type);
      setInviteCode(invite.code);
      Alert.alert('邀请码已生成', invite.code + '\n对方安装 App 后输入这个邀请码即可同步有效期和共享关系。');
    } catch (error: any) {
      Alert.alert('生成失败', error?.message || '请稍后再试。');
    }
  }

  async function acceptInvite() {
    if (!user || !acceptCode.trim()) return;
    try {
      await acceptGuardianInvite(acceptCode, user.id);
      setAcceptCode('');
      await load();
      Alert.alert('已加入', '共享关系已建立，有效期跟邀请人同步。');
    } catch (error: any) {
      Alert.alert('加入失败', error?.message || '请检查邀请码。');
    }
  }

  async function stopSharing(link: GuardianLink) {
    if (!user) return;
    const otherUserId = link.ownerUserId === user.id ? link.memberUserId : link.ownerUserId;
    Alert.alert('取消共享？', '任何一方都可以随时取消。取消后对方会收到 App 内通知。', [
      { text: '先不取消', style: 'cancel' },
      {
        text: '取消共享',
        style: 'destructive',
        onPress: async () => {
          await cancelGuardianLink(link.id, user.id, otherUserId);
          await load();
        },
      },
    ]);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>守护邀请与共享</Text>
      <Text style={styles.sub}>家庭守护版是一位家人单向守护；互相守护版是一对一互相看见。共享不包含日记全文、金额、电话、邮箱、真实姓名、精确位置或 AI 聊天内容。</Text>
      {!isCommunityConfigured() ? <Text style={styles.notice}>Supabase 未配置，邀请码暂不可用。</Text> : null}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, !canInviteFamily && styles.disabled]} disabled={!canInviteFamily} onPress={() => makeInvite('family')}><Text style={styles.actionText}>生成家庭守护邀请码</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, !canInviteMutual && styles.disabled]} disabled={!canInviteMutual} onPress={() => makeInvite('mutual')}><Text style={styles.actionText}>生成互相守护邀请码</Text></TouchableOpacity>
      </View>
      {inviteCode ? <Text style={styles.codeBox}>当前邀请码：{inviteCode}</Text> : null}
      <View style={styles.acceptBox}>
        <TextInput style={styles.input} value={acceptCode} onChangeText={setAcceptCode} autoCapitalize="characters" placeholder="输入对方的邀请码" />
        <TouchableOpacity style={styles.acceptBtn} onPress={acceptInvite}><Text style={styles.acceptText}>加入</Text></TouchableOpacity>
      </View>
      {linked.length === 0 ? <Text style={styles.empty}>暂无共享关系。</Text> : linked.map(({ link, viewable, status }) => (
        <View key={link.id} style={styles.linkCard}>
          <View style={styles.linkHeader}>
            <Text style={styles.linkTitle}>{link.type === 'family' ? '家庭守护' : '互相守护'}</Text>
            <TouchableOpacity onPress={() => stopSharing(link)}><Text style={styles.cancelText}>取消</Text></TouchableOpacity>
          </View>
          {!viewable ? (
            <Text style={styles.linkSub}>你正在被家人守护。对方不公开自己的记录，你只需要专注自己的戒赌就好。</Text>
          ) : status ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusLine}>
                {link.type === 'family' ? '被守护人' : '对方'}今日：
                {status.todayRecorded == null ? '未公开' : status.todayHighRisk ? '⚠️ 有高风险记录' : status.todayRecorded ? '✅ 今天守住了' : '今天还没记录'}
              </Text>
              {status.streak != null ? <Text style={styles.statusLine}>连续坚持：{status.streak} 天（最长 {status.longestStreak ?? 0} 天）</Text> : null}
              {status.mood ? <Text style={styles.statusLine}>心情：{status.mood}</Text> : null}
              {status.impulse != null ? <Text style={styles.statusLine}>冲动等级：{status.impulse}/10</Text> : null}
              <Text style={styles.statusTime}>更新于 {formatStatusTime(status.updatedAt)}</Text>
            </View>
          ) : (
            <Text style={styles.linkSub}>对方还没有同步状态。等对方打开 App 并记录后，这里会显示今日状态、连续天数、心情和冲动等级。</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { margin: 16, marginBottom: 0, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E6EFE6' },
  title: { fontSize: 16, color: '#24352A', fontWeight: 'bold', marginBottom: 6 },
  sub: { fontSize: 12, color: '#666', lineHeight: 18, marginBottom: 12 },
  notice: { backgroundColor: '#FFF8E7', color: '#7A4C00', padding: 10, borderRadius: 10, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  actions: { gap: 8 },
  actionBtn: { backgroundColor: '#2E7D32', borderRadius: 10, padding: 12, alignItems: 'center' },
  disabled: { backgroundColor: '#B9C7B9' },
  actionText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  codeBox: { backgroundColor: '#E8F5E9', color: '#2E7D32', padding: 12, borderRadius: 10, marginTop: 10, fontWeight: 'bold', textAlign: 'center' },
  acceptBox: { flexDirection: 'row', gap: 8, marginTop: 12 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, color: '#333' },
  acceptBtn: { backgroundColor: '#1565C0', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  acceptText: { color: '#fff', fontWeight: 'bold' },
  empty: { color: '#888', fontSize: 12, marginTop: 12 },
  linkCard: { backgroundColor: '#F8FAF7', padding: 12, borderRadius: 10, marginTop: 10 },
  linkHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkTitle: { fontSize: 14, color: '#24352A', fontWeight: 'bold' },
  linkSub: { fontSize: 12, color: '#666', lineHeight: 18, marginTop: 6 },
  cancelText: { color: '#C62828', fontSize: 13, fontWeight: 'bold' },
  statusBox: { marginTop: 8, gap: 4 },
  statusLine: { fontSize: 13, color: '#33433A', lineHeight: 19 },
  statusTime: { fontSize: 11, color: '#9AA59C', marginTop: 4 },
});
