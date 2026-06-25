import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ENCOURAGEMENTS, PublicStory, reactToStory, reportStory } from '@/community';
import { gamblingTypeLabel } from '@/storyTemplates';

type Props = {
  story: PublicStory;
  userId: string;
  compact?: boolean;
};

const REPORT_REASONS = [
  { label: '赌博广告', value: 'gambling_ad' },
  { label: '引诱赌博', value: 'gambling_trigger' },
  { label: '辱骂攻击', value: 'abuse' },
  { label: '借钱/诈骗', value: 'scam' },
  { label: '暴露隐私', value: 'privacy' },
  { label: '自伤风险', value: 'self_harm' },
  { label: '色情/暴力', value: 'sexual_violence' },
  { label: '其他', value: 'other' },
] as const;

export default function StoryCard({ story, userId, compact = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const isAi = story.source === 'ai' || story.displayMode === 'ai';

  async function sendReaction(label: string) {
    try {
      setBusy(true);
      await reactToStory(story.id, userId, label);
      Alert.alert('已送出鼓励', '这条鼓励会帮助故事作者知道自己被看见。');
    } catch (error: any) {
      Alert.alert('暂时无法送出', error?.message || '请稍后再试。');
    } finally {
      setBusy(false);
    }
  }

  function chooseReport() {
    Alert.alert('举报故事', '请选择原因', [
      ...REPORT_REASONS.map((reason) => ({
        text: reason.label,
        onPress: () => submitReport(reason.value),
      })),
      { text: '取消', style: 'cancel' },
    ]);
  }

  async function submitReport(reason: typeof REPORT_REASONS[number]['value']) {
    try {
      setBusy(true);
      await reportStory(story.id, userId, reason);
      Alert.alert('已提交举报', '管理员会审核这条内容。');
    } catch (error: any) {
      Alert.alert('举报失败', error?.message || '请稍后再试。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <Text style={styles.meta}>{isAi ? 'AI 陪伴故事' : story.displayName} · {gamblingTypeLabel(story.gamblingType)}</Text>
      <Text style={styles.title}>{story.title}</Text>
      <Text style={styles.body}>{expanded || compact ? story.body : story.excerpt}</Text>
      {!compact && story.body.length > story.excerpt.length ? (
        <TouchableOpacity onPress={() => setExpanded(!expanded)}><Text style={styles.readMore}>{expanded ? '收起' : '阅读全文'}</Text></TouchableOpacity>
      ) : null}
      <View style={styles.actions}>
        {ENCOURAGEMENTS.slice(0, compact ? 2 : 5).map((label) => (
          <TouchableOpacity key={label} style={styles.actionBtn} onPress={() => sendReaction(label)} disabled={busy || isAi}>
            <Text style={[styles.actionText, isAi && styles.disabledText]}>{label}</Text>
          </TouchableOpacity>
        ))}
        {!isAi ? (
          <TouchableOpacity style={styles.reportBtn} onPress={chooseReport} disabled={busy}>
            <Text style={styles.reportText}>举报</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E6EFE6' },
  compactCard: { width: 280, marginRight: 12 },
  meta: { fontSize: 12, color: '#2E7D32', fontWeight: 'bold', marginBottom: 8 },
  title: { fontSize: 16, color: '#24352A', fontWeight: 'bold', marginBottom: 8 },
  body: { fontSize: 13, color: '#444', lineHeight: 21 },
  readMore: { fontSize: 12, color: '#2E7D32', fontWeight: 'bold', marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionBtn: { backgroundColor: '#E8F5E9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  actionText: { fontSize: 12, color: '#2E7D32', fontWeight: 'bold' },
  disabledText: { color: '#8AAE8D' },
  reportBtn: { borderWidth: 1, borderColor: '#F1B7B7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  reportText: { fontSize: 12, color: '#C62828', fontWeight: 'bold' },
});
