import { useAuth } from '@/auth';
import { listHomeCompanionStories, PublicStory } from '@/community';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import StoryCard from './StoryCard';

export default function HomeCompanionStories() {
  const router = useRouter();
  const { user } = useAuth();
  const [stories, setStories] = useState<PublicStory[]>([]);

  useEffect(() => {
    listHomeCompanionStories(6).then(setStories).catch(() => setStories([]));
  }, []);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>今天也有人在坚持</Text>
          <Text style={styles.sub}>看看别人怎么撑过最难的时刻。</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/hopewall' as never)}><Text style={styles.more}>查看更多</Text></TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {stories.map((story) => <StoryCard key={story.id} story={story} userId={user?.id || 'signed_out'} compact />)}
      </ScrollView>
      <View style={styles.links}>
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/hopewall' as never)}><Text style={styles.linkText}>我也想分享</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.linkBtn, styles.urgeBtn]} onPress={() => router.push('/emergency')}><Text style={styles.urgeText}>我现在很想赌</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: 18 },
  headerRow: { paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 17, fontWeight: 'bold', color: '#24352A' },
  sub: { fontSize: 12, color: '#777', marginTop: 4, lineHeight: 17, maxWidth: 250 },
  more: { fontSize: 13, color: '#2E7D32', fontWeight: 'bold' },
  scroll: { paddingHorizontal: 16 },
  links: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 4 },
  linkBtn: { flex: 1, backgroundColor: '#E8F5E9', borderRadius: 10, padding: 12, alignItems: 'center' },
  linkText: { color: '#2E7D32', fontWeight: 'bold', fontSize: 13 },
  urgeBtn: { backgroundColor: '#FFF1E7' },
  urgeText: { color: '#E67E22', fontWeight: 'bold', fontSize: 13 },
});
