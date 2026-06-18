import { StyleSheet, Text, View } from 'react-native';
export default function ExplorePage() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>探索</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF7', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2E7D32' },
});