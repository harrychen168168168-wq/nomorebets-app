import { useAuth } from '@/auth';
import { ActiveSanction, isCommunityConfigured, liftSanction, listActiveSanctions, listOpenReports, listPendingStories, moderateStory, PublicStory, resolveReport, sanctionStoryAuthor, SanctionLevel } from '@/community';
import PageContainer from '@/components/PageContainer';
import { APP_VERSION } from '@/config';
import { DailyRecord, loadData as loadStoredData, readDailyRecords } from '@/storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AdminStats = { totalRecords: number; noGambleDays: number; relapseDays: number; totalLoss: number; contacts: number; goals: number; lastRecordDate: string };

function safeList(raw: string | null) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function calcStats(records: DailyRecord[], contacts: unknown[], goals: unknown[]): AdminStats {
  return {
    totalRecords: records.length,
    noGambleDays: records.filter((record) => !record.gambled).length,
    relapseDays: records.filter((record) => record.gambled).length,
    totalLoss: records.filter((record) => record.result === 'lose').reduce((sum, record) => sum + (record.amount || 0), 0),
    contacts: contacts.length,
    goals: goals.length,
    lastRecordDate: records[0]?.date || '暂无',
  };
}

export default function AdminPage() {
  const { isAdmin, user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats>({ totalRecords: 0, noGambleDays: 0, relapseDays: 0, totalLoss: 0, contacts: 0, goals: 0, lastRecordDate: '暂无' });
  const [pendingStories, setPendingStories] = useState<PublicStory[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [sanctions, setSanctions] = useState<ActiveSanction[]>([]);
  const [adminError, setAdminError] = useState('');

  const load = useCallback(async () => {
    const [records, contactsRaw, goalsRaw] = await Promise.all([readDailyRecords(), loadStoredData('importantContacts'), loadStoredData('myGoals')]);
    setStats(calcStats(records, safeList(contactsRaw), safeList(goalsRaw)));
    if (isCommunityConfigured()) {
      try {
        const [stories, openReports, activeSanctions] = await Promise.all([listPendingStories(), listOpenReports(), listActiveSanctions()]);
        setPendingStories(stories);
        setReports(openReports);
        setSanctions(activeSanctions);
        setAdminError('');
      } catch (error: any) {
        setPendingStories([]);
        setReports([]);
        setSanctions([]);
        setAdminError(error?.message || '管理员函数暂时不可用。');
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  async function reviewStory(story: PublicStory, status: 'approved' | 'rejected' | 'hidden' | 'deleted') {
    try {
      await moderateStory(story.id, status, user?.id || 'admin', status === 'rejected' ? '不符合公开故事规则' : '');
      await load();
      Alert.alert('已处理', '管理员操作已记录。');
    } catch (error: any) {
      Alert.alert('处理失败', error?.message || '请检查 Supabase 权限。');
    }
  }

  async function closeReport(report: any, status: 'resolved' | 'dismissed') {
    try {
      await resolveReport(report.id, user?.id || 'admin', status);
      await load();
    } catch (error: any) {
      Alert.alert('处理失败', error?.message || '请检查 Supabase 权限。');
    }
  }

  function confirmLift(sanction: ActiveSanction) {
    Alert.alert('解除这条限制？', '解除后该用户可以重新发布公开故事。这条限制记录会保留在审核日志里。', [
      { text: '取消', style: 'cancel' },
      {
        text: '解除',
        onPress: async () => {
          try {
            await liftSanction(sanction.id, user?.id || 'admin');
            await load();
            Alert.alert('已解除', '该用户已恢复发布权限。');
          } catch (error: any) {
            Alert.alert('解除失败', error?.message || '请检查 Supabase 权限。');
          }
        },
      },
    ]);
  }

  const SANCTION_LABELS: { level: SanctionLevel; label: string }[] = [
    { level: 'warning', label: '警告' },
    { level: 'mute_7d', label: '禁言7天' },
    { level: 'mute_30d', label: '禁言30天' },
    { level: 'blocked', label: '封锁' },
  ];

  function confirmSanction(story: PublicStory, level: SanctionLevel, label: string) {
    Alert.alert('限制该用户', '确定对作者执行“' + label + '”？', [
      { text: '取消', style: 'cancel' },
      {
        text: label,
        style: 'destructive',
        onPress: async () => {
          try {
            await sanctionStoryAuthor(story.id, level, '违规公开故事：' + story.title, user?.id || 'admin');
            await load();
            Alert.alert('已处理', '已对该用户执行：' + label + '。被限制用户将无法再发布公开故事。');
          } catch (error: any) {
            Alert.alert('处理失败', error?.message || '请检查 Supabase 权限。');
          }
        },
      },
    ]);
  }

  if (!isAdmin) {
    return (
      <PageContainer>
        <View style={styles.blockedRoot}>
          <Text style={styles.blockedIcon}>🔒</Text>
          <Text style={styles.blockedTitle}>没有管理员权限</Text>
          <Text style={styles.blockedText}>该页面只对管理员账号开放。</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/profile')}><Text style={styles.primaryBtnText}>返回我的页面</Text></TouchableOpacity>
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ScrollView style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>管理员中心</Text><Text style={styles.headerSub}>当前账号：{user?.email}</Text></View>
        <View style={styles.noticeCard}><Text style={styles.noticeTitle}>审核安全模式</Text><Text style={styles.noticeText}>公开故事必须先审核，举报需要及时处理。管理员身份由服务端校验你的登录令牌 + 邮箱白名单，App 内不保存任何管理员密钥。</Text></View>
        {!isCommunityConfigured() ? <View style={styles.warnCard}><Text style={styles.warnText}>Supabase 未配置：无法加载跨用户待审核故事和举报。</Text></View> : null}
        {adminError ? <View style={styles.warnCard}><Text style={styles.warnText}>管理员功能不可用：{adminError}。请用管理员邮箱登录，并确认 community-admin 已部署、Supabase 里 ADMIN_EMAILS 白名单已配置。</Text></View> : null}

        <View style={styles.grid}>
          <View style={styles.statCard}><Text style={styles.statValue}>{stats.totalRecords}</Text><Text style={styles.statLabel}>本机记录</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{stats.noGambleDays}</Text><Text style={styles.statLabel}>无赌天数</Text></View>
          <View style={styles.statCard}><Text style={[styles.statValue, styles.statDanger]}>{stats.relapseDays}</Text><Text style={styles.statLabel}>高风险记录</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{pendingStories.length}</Text><Text style={styles.statLabel}>待审故事</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>待审核故事</Text>
          {pendingStories.length === 0 ? <Text style={styles.rowText}>暂无待审核故事。</Text> : pendingStories.map((story) => (
            <View key={story.id} style={styles.reviewItem}>
              <Text style={styles.storyTitle}>{story.displayName} · {story.title}</Text>
              <Text style={styles.rowText}>{story.body}</Text>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.goodBtn} onPress={() => reviewStory(story, 'approved')}><Text style={styles.goodText}>通过</Text></TouchableOpacity>
                <TouchableOpacity style={styles.warnBtn} onPress={() => reviewStory(story, 'rejected')}><Text style={styles.warnBtnText}>拒绝</Text></TouchableOpacity>
                <TouchableOpacity style={styles.dangerBtn} onPress={() => reviewStory(story, 'deleted')}><Text style={styles.dangerText}>删除</Text></TouchableOpacity>
              </View>
              <View style={styles.actions}>
                {SANCTION_LABELS.map((item) => (
                  <TouchableOpacity key={item.level} style={item.level === 'blocked' ? styles.dangerBtn : styles.warnBtn} onPress={() => confirmSanction(story, item.level, item.label)}>
                    <Text style={item.level === 'blocked' ? styles.dangerText : styles.warnBtnText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>举报处理</Text>
          {reports.length === 0 ? <Text style={styles.rowText}>暂无未处理举报。</Text> : reports.map((report) => (
            <View key={report.id} style={styles.reviewItem}>
              <Text style={styles.storyTitle}>原因：{report.reason}</Text>
              <Text style={styles.rowText}>故事 ID：{report.story_id}</Text>
              {report.detail ? <Text style={styles.rowText}>说明：{report.detail}</Text> : null}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.goodBtn} onPress={() => closeReport(report, 'resolved')}><Text style={styles.goodText}>标记已处理</Text></TouchableOpacity>
                <TouchableOpacity style={styles.warnBtn} onPress={() => closeReport(report, 'dismissed')}><Text style={styles.warnBtnText}>驳回举报</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>生效中的限制</Text>
          {sanctions.length === 0 ? <Text style={styles.rowText}>暂无生效中的限制。</Text> : sanctions.map((sanction) => (
            <View key={sanction.id} style={styles.reviewItem}>
              <Text style={styles.storyTitle}>{SANCTION_LABELS.find((item) => item.level === sanction.level)?.label || sanction.level}</Text>
              {sanction.reason ? <Text style={styles.rowText}>原因：{sanction.reason}</Text> : null}
              <Text style={styles.rowText}>{sanction.activeUntil ? '到期：' + sanction.activeUntil.slice(0, 10) : '永久生效（不会自动到期）'}</Text>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.goodBtn} onPress={() => confirmLift(sanction)}><Text style={styles.goodText}>解除限制</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>版本与权限</Text>
          <Text style={styles.rowText}>App 版本：{APP_VERSION}</Text>
          <Text style={styles.rowText}>最近记录：{stats.lastRecordDate}</Text>
          <Text style={styles.rowText}>限制与解除均在服务端执行并写入审核日志；封锁不会自动到期，需要在上方手动解除。</Text>
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/profile')}><Text style={styles.primaryBtnText}>返回我的页面</Text></TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF7' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 16 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#1565C0' },
  headerSub: { fontSize: 12, color: '#666', marginTop: 6, textAlign: 'center' },
  noticeCard: { backgroundColor: '#E8F0FE', margin: 16, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#90CAF9' },
  noticeTitle: { fontSize: 16, fontWeight: 'bold', color: '#1565C0', marginBottom: 8 },
  noticeText: { fontSize: 13, color: '#333', lineHeight: 20 },
  warnCard: { backgroundColor: '#FFF8E7', marginHorizontal: 16, borderRadius: 12, padding: 14 },
  warnText: { color: '#7A4C00', fontSize: 13, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  statCard: { width: '50%', padding: 4 },
  statValue: { backgroundColor: '#fff', borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingTop: 18, textAlign: 'center', fontSize: 26, fontWeight: 'bold', color: '#2E7D32' },
  statDanger: { color: '#D32F2F' },
  statLabel: { backgroundColor: '#fff', borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingBottom: 16, textAlign: 'center', fontSize: 12, color: '#666' },
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 18 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  reviewItem: { backgroundColor: '#F8FAF7', borderRadius: 12, padding: 12, marginBottom: 10 },
  storyTitle: { fontSize: 14, color: '#24352A', fontWeight: 'bold', marginBottom: 6 },
  rowText: { fontSize: 13, color: '#555', lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  goodBtn: { backgroundColor: '#E8F5E9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  goodText: { color: '#2E7D32', fontSize: 13, fontWeight: 'bold' },
  warnBtn: { backgroundColor: '#FFF8E7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  warnBtnText: { color: '#E67E22', fontSize: 13, fontWeight: 'bold' },
  dangerBtn: { backgroundColor: '#FFF1F1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  dangerText: { color: '#C62828', fontSize: 13, fontWeight: 'bold' },
  primaryBtn: { backgroundColor: '#1565C0', margin: 16, borderRadius: 12, padding: 15, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  blockedRoot: { flex: 1, backgroundColor: '#F8FAF7', alignItems: 'center', justifyContent: 'center', padding: 24 },
  blockedIcon: { fontSize: 48, marginBottom: 12 },
  blockedTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  blockedText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 16 },
});
