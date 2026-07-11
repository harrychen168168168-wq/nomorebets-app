import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import PageContainer from '@/components/PageContainer';
import PublicStoriesPanel from '@/components/PublicStoriesPanel';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HopeWallPage() {
  const router = useRouter();
  return (
    <PageContainer>
      <KeyboardAwareScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>← 返回</Text></TouchableOpacity>
          <Text style={styles.title}>励志墙</Text>
          <Text style={styles.sub}>看看别人怎么撑过最难的时刻，也可以在下面写下你自己的故事。</Text>
        </View>
        <PublicStoriesPanel />
        <View style={{ height: 40 }} />
      </KeyboardAwareScrollView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF7' },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 4 },
  back: { fontSize: 14, color: '#2E7D32', fontWeight: 'bold', marginBottom: 10 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#2E7D32' },
  sub: { fontSize: 13, color: '#777', marginTop: 6, lineHeight: 19 },
});
