import { useAuth } from '@/auth';
import { containsSelfHarm, isCommunityConfigured, listApprovedStories, PublicStory, submitPublicStory } from '@/community';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import StoryCard from './StoryCard';

const CATEGORIES = ['精选故事', '最新故事', '赌场戒赌', '今天没有进赌场', '复赌后重新开始', '我撑过来的方法'];

export default function PublicStoriesPanel() {
  const { user } = useAuth();
  const [stories, setStories] = useState<PublicStory[]>([]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [displayMode, setDisplayMode] = useState<'anonymous' | 'nickname'>('anonymous');

  const loadStories = useCallback(() => {
    listApprovedStories(40).then(setStories).catch(() => setStories([]));
  }, []);

  useFocusEffect(useCallback(() => {
    loadStories();
  }, [loadStories]));

  async function submitStory() {
    const text = body.trim();
    if (!user) return;
    if (!text) {
      Alert.alert('先写一点内容', '可以只写几句话，管理员通过后才会公开。');
      return;
    }
    if (!isCommunityConfigured()) {
      Alert.alert('需要配置 Supabase', '公开故事墙要跨用户展示，需要先配置 Supabase URL 和 anon key。');
      return;
    }
    if (containsSelfHarm(text) || containsSelfHarm(title)) {
      Alert.alert('先照顾好自己', '这条内容包含自伤相关的表达，不适合公开发布。你现在的安全最重要：请联系身边可信的人，或拨打/发短信 988（心理危机热线）。如果有立即危险，请拨打 911。', [{ text: '我知道了' }]);
      return;
    }
    const hasNickname = !!user.displayName?.trim();
    const effectiveMode: 'anonymous' | 'nickname' = displayMode === 'nickname' && hasNickname ? 'nickname' : 'anonymous';
    if (displayMode === 'nickname' && !hasNickname) {
      Alert.alert('还没有昵称', '你还没有设置昵称，这条故事会以“匿名用户”发布。你可以在“我的”页面设置昵称后再用昵称发布。');
    }
    try {
      await submitPublicStory({
        authorUserId: user.id,
        displayMode: effectiveMode,
        displayName: effectiveMode === 'nickname' ? (user.displayName as string).trim() : '匿名用户',
        gamblingType: 'casino',
        title: title.trim() || '今天我也在坚持',
        excerpt: text.slice(0, 90),
        body: text,
      });
      setTitle('');
      setBody('');
      setDisplayMode('anonymous');
      Alert.alert('已提交审核', '通过后会出现在公开故事墙。');
    } catch (error: any) {
      Alert.alert('提交失败', error?.message || '请稍后再试。');
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>戒赌故事</Text>
      <Text style={styles.cardSub}>这里只显示审核通过的公开故事。没有评论、私信或群聊，只有固定鼓励和举报。</Text>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((item) => <TouchableOpacity key={item} style={[styles.categoryBtn, category === item && styles.categoryActive]} onPress={() => setCategory(item)}><Text style={styles.categoryText}>{item}</Text></TouchableOpacity>)}
      </View>
      {!isCommunityConfigured() ? <Text style={styles.notice}>Supabase 未配置：当前无法加载真实跨用户故事。配置后这里会显示 approved 故事。</Text> : null}
      {stories.length === 0 ? <Text style={styles.empty}>还没有审核通过的公开故事。成为第一个分享的人吧。</Text> : stories.map((story) => <StoryCard key={story.id} story={story} userId={user?.id || 'signed_out'} />)}

      <View style={styles.submitBox}>
        <Text style={styles.submitTitle}>我也想分享</Text>
        <Text style={styles.cardSub}>每日记录不会自动公开。这里提交的是你确认后的公开故事草稿。</Text>
        <TextInput style={styles.inputBox} value={title} onChangeText={setTitle} placeholder="故事标题（可选）" />
        <TextInput style={styles.textArea} value={body} onChangeText={setBody} multiline placeholder="写下你差点去赌场但撑住的一刻，或复赌后重新开始的信号。" />
        <View style={styles.modeRow}>
          <TouchableOpacity style={[styles.modeBtn, displayMode === 'anonymous' && styles.modeActive]} onPress={() => setDisplayMode('anonymous')}><Text style={styles.modeText}>匿名发布</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.modeBtn, displayMode === 'nickname' && styles.modeActive]} onPress={() => setDisplayMode('nickname')}><Text style={styles.modeText}>使用昵称</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.submitBtn} onPress={submitStory}><Text style={styles.submitBtnText}>提交审核</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 18 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#24352A', marginBottom: 6 },
  cardSub: { fontSize: 12, color: '#777', lineHeight: 18, marginBottom: 12 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  categoryBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  categoryActive: { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' },
  categoryText: { fontSize: 12, color: '#333' },
  notice: { backgroundColor: '#FFF8E7', color: '#7A4C00', padding: 10, borderRadius: 10, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  empty: { color: '#777', fontSize: 13, lineHeight: 20, marginBottom: 12 },
  submitBox: { backgroundColor: '#F8FAF7', borderRadius: 12, padding: 14, marginTop: 8 },
  submitTitle: { fontSize: 15, fontWeight: 'bold', color: '#2E7D32', marginBottom: 4 },
  inputBox: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#333', backgroundColor: '#fff', marginBottom: 10 },
  textArea: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#333', backgroundColor: '#fff', minHeight: 110, textAlignVertical: 'top' },
  modeRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modeBtn: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, alignItems: 'center' },
  modeActive: { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' },
  modeText: { fontSize: 13, color: '#333', fontWeight: 'bold' },
  submitBtn: { backgroundColor: '#2E7D32', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
