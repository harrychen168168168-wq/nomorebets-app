import { useAuth } from '@/auth';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import PageContainer from '@/components/PageContainer';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { computeAge, getTodayString } from '../storage';

export type ProfileStepData = {
  name: string;
  avatarUri: string;
  quitStartDate: string;
  birthday: string;
  whyQuit: string;
};

// Step 1 of the onboarding funnel. Collects profile fields and hands them up; persistence,
// permission request and reminder scheduling happen at the end of the flow (OnboardingFlow).
export default function FirstProfileSetup({ onComplete }: { onComplete: (data: ProfileStepData) => void }) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.displayName || '');
  const [avatarUri, setAvatarUri] = useState(user?.avatarUri || '');
  const [quitStartDate, setQuitStartDate] = useState(getTodayString());
  const [birthday, setBirthday] = useState('');
  const [whyQuit, setWhyQuit] = useState('');

  const birthdayAge = computeAge(birthday);

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  }

  function submit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('先填一个昵称', '昵称只用于 App 内显示，可以是真名，也可以是你愿意使用的名字。');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(quitStartDate.trim())) {
      Alert.alert('日期格式不正确', '请按 2026-06-19 这样的格式填写戒赌开始日期。');
      return;
    }
    const trimmedBirthday = birthday.trim();
    if (trimmedBirthday && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedBirthday)) {
      Alert.alert('生日格式不正确', '请按 1990-01-15 这样的格式填写生日，或先留空。');
      return;
    }
    onComplete({
      name: trimmedName,
      avatarUri,
      quitStartDate: quitStartDate.trim(),
      birthday: trimmedBirthday,
      whyQuit: whyQuit.trim(),
    });
  }

  return (
    <PageContainer>
      <KeyboardAwareScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>🌱</Text>
          <Text style={styles.title}>先设置你的资料</Text>
          <Text style={styles.subtitle}>这些资料只用于帮你记录戒赌进度，不会公开展示。</Text>
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.avatarButton} onPress={pickAvatar}>
            {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>添加头像</Text>}
          </TouchableOpacity>

          <Text style={styles.label}>昵称</Text>
          <TextInput style={styles.input} placeholder="例如：Harry" value={name} onChangeText={setName} returnKeyType="next" />

          <Text style={styles.label}>戒赌开始日期</Text>
          <TextInput style={styles.input} placeholder="2026-06-19" value={quitStartDate} onChangeText={setQuitStartDate} keyboardType="numbers-and-punctuation" />

          <Text style={styles.label}>你的生日</Text>
          <TextInput style={styles.input} placeholder="例如 1990-01-15（用于生日祝福，可留空）" value={birthday} onChangeText={setBirthday} keyboardType="numbers-and-punctuation" />
          {birthdayAge !== null ? <Text style={styles.ageHint}>年龄：{birthdayAge} 岁 · 生日当天 0 点会收到一句祝福</Text> : null}

          <Text style={styles.label}>你为什么想戒赌？</Text>
          <TextInput
            style={styles.textArea}
            placeholder="例如：为了家人、为了还清债务、为了重新掌控生活..."
            value={whyQuit}
            onChangeText={setWhyQuit}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity style={styles.saveButton} onPress={submit}>
            <Text style={styles.saveText}>继续</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteText}>换账号登录时，每个账号都会使用自己的资料、记录、联系人和目标。</Text>
        </View>
      </KeyboardAwareScrollView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF7' },
  header: { alignItems: 'center', paddingTop: 46, paddingHorizontal: 24, paddingBottom: 18 },
  logo: { fontSize: 44, marginBottom: 10 },
  title: { fontSize: 26, color: '#2E7D32', fontWeight: 'bold', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginTop: 8 },
  card: { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 20 },
  avatarButton: { alignSelf: 'center', width: 92, height: 92, borderRadius: 46, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 18, overflow: 'hidden' },
  avatarImage: { width: 92, height: 92, borderRadius: 46 },
  avatarText: { color: '#2E7D32', fontSize: 13, fontWeight: 'bold' },
  label: { fontSize: 14, color: '#333', fontWeight: 'bold', marginBottom: 8, marginTop: 10 },
  ageHint: { fontSize: 12, color: '#2E7D32', marginTop: 6 },
  input: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#333', backgroundColor: '#fff' },
  textArea: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 14, minHeight: 110, fontSize: 15, color: '#333', backgroundColor: '#fff' },
  saveButton: { backgroundColor: '#2E7D32', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  noteCard: { backgroundColor: '#FFF8E7', marginHorizontal: 16, marginTop: 2, borderRadius: 14, padding: 14 },
  noteText: { color: '#7A4C00', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
