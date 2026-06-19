import { useAuth } from '@/auth';
import PageContainer from '@/components/PageContainer';
import { APP_VERSION } from '@/config';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DailyRecord, loadData as loadStoredData, readDailyRecords } from '../storage';

type AdminStats = { totalRecords: number; noGambleDays: number; relapseDays: number; totalLoss: number; contacts: number; goals: number; lastRecordDate: string };

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

  useFocusEffect(useCallback(() => {
    const load = async () => {
      const [records, contactsRaw, goalsRaw] = await Promise.all([readDailyRecords(), loadStoredData('importantContacts'), loadStoredData('myGoals')]);
      const contacts = contactsRaw ? JSON.parse(contactsRaw) : [];
      const goals = goalsRaw ? JSON.parse(goalsRaw) : [];
      setStats(calcStats(records, contacts, goals));
    };
    load();
  }, []));

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
        <View style={styles.noticeCard}><Text style={styles.noticeTitle}>隐私保护模式</Text><Text style={styles.noticeText}>这里只显示当前账号的统计和配置，不直接展示日记、联系人电话、未来信等敏感内容。正式接后端后，管理员权限应继续由服务器校验。</Text></View>
        <View style={styles.grid}>
          <View style={styles.statCard}><Text style={styles.statValue}>{stats.totalRecords}</Text><Text style={styles.statLabel}>总记录</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{stats.noGambleDays}</Text><Text style={styles.statLabel}>无赌天数</Text></View>
          <View style={styles.statCard}><Text style={[styles.statValue, styles.statDanger]}>{stats.relapseDays}</Text><Text style={styles.statLabel}>有赌记录</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>${stats.totalLoss}</Text><Text style={styles.statLabel}>累计损失</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{stats.contacts}</Text><Text style={styles.statLabel}>联系人</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{stats.goals}</Text><Text style={styles.statLabel}>目标</Text></View>
        </View>
        <View style={styles.card}><Text style={styles.cardTitle}>版本与审核</Text><Text style={styles.rowText}>App 版本：{APP_VERSION}</Text><Text style={styles.rowText}>最近记录：{stats.lastRecordDate}</Text><Text style={styles.rowText}>管理员权限：本地角色校验，后端接入后替换为服务器角色。</Text></View>
        <View style={styles.card}><Text style={styles.cardTitle}>后续后台功能</Text><Text style={styles.rowText}>· 公告管理</Text><Text style={styles.rowText}>· 用户反馈列表</Text><Text style={styles.rowText}>· 强制更新配置</Text><Text style={styles.rowText}>· AI 安全提示词配置</Text><Text style={styles.rowText}>· 管理员操作日志</Text></View>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  statCard: { width: '50%', padding: 4 },
  statValue: { backgroundColor: '#fff', borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingTop: 18, textAlign: 'center', fontSize: 26, fontWeight: 'bold', color: '#2E7D32' },
  statDanger: { color: '#D32F2F' },
  statLabel: { backgroundColor: '#fff', borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingBottom: 16, textAlign: 'center', fontSize: 12, color: '#666' },
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 18 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  rowText: { fontSize: 13, color: '#555', lineHeight: 22 },
  primaryBtn: { backgroundColor: '#1565C0', margin: 16, borderRadius: 12, padding: 15, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  blockedRoot: { flex: 1, backgroundColor: '#F8FAF7', alignItems: 'center', justifyContent: 'center', padding: 24 },
  blockedIcon: { fontSize: 48, marginBottom: 12 },
  blockedTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  blockedText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 16 },
});
