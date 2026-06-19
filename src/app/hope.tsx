import PageContainer from '@/components/PageContainer';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { loadData as loadStoredData, saveData as saveStoredData } from '../storage';

const DAILY_QUOTES = [
  '赌场赢的是概率，你赢回的是人生。',
  '每一天不赌博，都是送给家人最好的礼物。',
  '你比你想象的更强大。',
  '每一次说不，都是对未来的一次投资。',
  '此刻的坚持，就是最好的你。',
];

const MILESTONES = [
  { days: 1, emoji: '🌱', title: '第 1 天', desc: '你已经迈出最难的第一步。' },
  { days: 7, emoji: '🧠', title: '第 7 天', desc: '冲动会开始变弱，你的大脑正在重新学习平静。' },
  { days: 30, emoji: '🌳', title: '第 30 天', desc: '新的生活节奏正在建立。' },
  { days: 90, emoji: '🏆', title: '第 90 天', desc: '家庭关系和财务状况会开始明显改善。' },
  { days: 365, emoji: '👑', title: '第 365 天', desc: '你已经证明自己可以重新掌控人生。' },
];

const STORIES = [
  { name: 'David，43 岁', preview: '我在赌场停车场坐了两个小时，最后没有进去。', full: '那天我本来准备把最后一点钱拿去翻本。坐在车里时，我看到了孩子发来的消息：爸爸你几点回家？我突然明白，我真正想赢回来的不是钱，是家。那天我没有进去。后来我每天只做一件事：今天不赌。现在已经一年多了。' },
  { name: 'Jenny，35 岁', preview: '我欠了很多信用卡债，但我终于开始面对。', full: '最难的不是还钱，是承认自己需要改变。我把每一次冲动写下来，把工资先转到安全账户。两年后，我还清了债。那是我这辈子最勇敢的事。' },
  { name: 'Michael，51 岁', preview: '我赌了二十年，以为自己戒不了。', full: '后来我不再对自己说“永远不赌”，我只问自己：今天不去可以吗？今天是第二年第四个月。答案还是可以。' },
];

export default function HopePage() {
  const [streak, setStreak] = useState(0);
  const [monthlyLoss, setMonthlyLoss] = useState(0);
  const [expandedStory, setExpandedStory] = useState<number | null>(null);
  const [whyQuit, setWhyQuit] = useState('');
  const [savedWhyQuit, setSavedWhyQuit] = useState('');
  const [letter, setLetter] = useState('');
  const [savedLetter, setSavedLetter] = useState('');
  const [showLetterInput, setShowLetterInput] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [myStory, setMyStory] = useState('');
  const [myStoryName, setMyStoryName] = useState('');
  const [editingStory, setEditingStory] = useState(false);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  useEffect(() => {
    const timer = setInterval(() => setQuoteIndex((prev) => (prev + 1) % DAILY_QUOTES.length), 10000);
    return () => clearInterval(timer);
  }, []);

  async function loadData() {
    const [s, loss, why, fl, story, storyName] = await Promise.all([
      loadStoredData('streak'),
      loadStoredData('monthlyLoss'),
      loadStoredData('whyQuit'),
      loadStoredData('futureLetter'),
      loadStoredData('myStory'),
      loadStoredData('myStoryName'),
    ]);
    setStreak(Number(s) || 0);
    setMonthlyLoss(Number(loss) || 0);
    if (why) { setWhyQuit(why); setSavedWhyQuit(why); }
    if (fl) setSavedLetter(fl);
    if (story) setMyStory(story);
    if (storyName) setMyStoryName(storyName);
  }

  async function saveWhyQuit() {
    await saveStoredData('whyQuit', whyQuit);
    setSavedWhyQuit(whyQuit);
  }

  async function saveLetter() {
    await saveStoredData('futureLetter', letter);
    setSavedLetter(letter);
    setShowLetterInput(false);
  }

  async function saveMyStory() {
    await saveStoredData('myStory', myStory);
    await saveStoredData('myStoryName', myStoryName);
    setEditingStory(false);
  }

  const yearlyLoss = monthlyLoss * 12;
  const currentMilestone = MILESTONES.filter((m) => streak >= m.days).pop();
  const nextMilestone = MILESTONES.find((m) => streak < m.days);

  return (
    <PageContainer>
      <ScrollView style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>希望与动力</Text><Text style={styles.headerSub}>每一天都是新的可能。</Text></View>
        <View style={styles.quoteCard}><Text style={styles.quoteLabel}>今日语录</Text><Text style={styles.quoteText}>「{DAILY_QUOTES[quoteIndex]}」</Text></View>
        <View style={styles.choiceCard}><Text style={styles.choiceTitle}>{streak > 0 ? '你已经坚持了 ' + streak + ' 天' : '今天是新的开始'}</Text><Text style={styles.choiceText}>你选择了家人，选择了未来，也选择了真正的自己。</Text></View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>坚持后的变化</Text>
          <Text style={styles.cardSub}>很多人在恢复过程中会经历这些积极变化。</Text>
          {MILESTONES.map((m, i) => {
            const reached = streak >= m.days;
            const isCurrent = currentMilestone?.days === m.days;
            return <View key={i} style={[styles.milestoneRow, isCurrent && styles.milestoneRowCurrent]}><View style={[styles.milestoneDot, reached ? styles.milestoneDotReached : styles.milestoneDotFuture]}><Text style={styles.milestoneDotText}>{reached ? '✓' : ''}</Text></View><View style={styles.milestoneContent}><Text style={[styles.milestoneTitle, reached && styles.milestoneTitleReached]}>{m.emoji} {m.title}</Text><Text style={[styles.milestoneDesc, reached && styles.milestoneTitleReached]}>{m.desc}</Text></View></View>;
          })}
          {nextMilestone && <View style={styles.nextMilestoneBox}><Text style={styles.nextMilestoneText}>距离“{nextMilestone.emoji} {nextMilestone.title}”还剩 {nextMilestone.days - streak} 天</Text></View>}
        </View>

        {yearlyLoss > 0 && <View style={styles.calcCard}><Text style={styles.calcTitle}>如果你坚持一年...</Text><Text style={styles.calcSub}>按当前月均损失计算</Text><Text style={styles.calcAmount}>${yearlyLoss.toLocaleString()}</Text><Text style={styles.calcAmountLabel}>一年可以节省</Text></View>}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>我为什么戒赌</Text><Text style={styles.cardSub}>写下你的理由，危急时刻翻出来看。</Text>
          {savedWhyQuit !== '' ? <View style={styles.savedBox}><Text style={styles.savedText}>{savedWhyQuit}</Text><TouchableOpacity onPress={() => setSavedWhyQuit('')}><Text style={styles.editBtn}>修改</Text></TouchableOpacity></View> : <><TextInput style={styles.textArea} placeholder="例如：为了孩子、为了家、为了重新做回自己..." multiline numberOfLines={4} value={whyQuit} onChangeText={setWhyQuit} /><TouchableOpacity style={styles.btnSave} onPress={saveWhyQuit}><Text style={styles.btnSaveText}>保存</Text></TouchableOpacity></>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>写给未来的自己</Text><Text style={styles.cardSub}>写一封信给三个月后的你。</Text>
          {savedLetter !== '' && !showLetterInput ? <View style={styles.letterBox}><Text style={styles.letterText}>{savedLetter}</Text><TouchableOpacity onPress={() => { setLetter(savedLetter); setShowLetterInput(true); }}><Text style={styles.editBtn}>重新写</Text></TouchableOpacity></View> : <><TextInput style={styles.textArea} placeholder="亲爱的未来的我，现在的我正在努力改变..." multiline numberOfLines={6} value={letter} onChangeText={setLetter} /><TouchableOpacity style={styles.btnSave} onPress={saveLetter}><Text style={styles.btnSaveText}>保存这封信</Text></TouchableOpacity></>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>鼓励故事</Text><Text style={styles.cardSub}>这些故事用于鼓励和参考，你也可以写下自己的经历。</Text>
          {STORIES.map((story, i) => <View key={i} style={styles.storyCard}><TouchableOpacity onPress={() => setExpandedStory(expandedStory === i ? null : i)}><Text style={styles.storyName}>{story.name}</Text><Text style={styles.storyPreview}>{story.preview}</Text><Text style={styles.storyReadMore}>{expandedStory === i ? '收起' : '阅读完整故事'}</Text></TouchableOpacity>{expandedStory === i && <Text style={styles.storyFull}>{story.full}</Text>}</View>)}
          <View style={styles.myStoryBox}>
            <Text style={styles.myStoryTitle}>写下你的故事</Text><Text style={styles.myStorySub}>你的故事可能正是某个人需要看到的。</Text>
            {myStory !== '' && !editingStory ? <View><View style={styles.myStoryNameRow}><Text style={styles.storyName}>{myStoryName || '匿名'}</Text><Text style={styles.myStoryStreak}>坚持了 {streak} 天</Text></View><Text style={styles.storyFull}>{myStory}</Text><TouchableOpacity onPress={() => setEditingStory(true)}><Text style={styles.editBtn}>修改故事</Text></TouchableOpacity></View> : <View><TextInput style={styles.inputBox} placeholder="你叫什么（可匿名）" value={myStoryName} onChangeText={setMyStoryName} /><TextInput style={[styles.textArea, { marginTop: 10 }]} placeholder="写下你的故事..." multiline numberOfLines={6} value={myStory} onChangeText={setMyStory} /><TouchableOpacity style={styles.btnSave} onPress={saveMyStory}><Text style={styles.btnSaveText}>保存我的故事</Text></TouchableOpacity></View>}
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF7' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#2E7D32' },
  headerSub: { fontSize: 13, color: '#888', marginTop: 4 },
  quoteCard: { backgroundColor: '#FFF8E7', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  quoteLabel: { fontSize: 12, color: '#E67E22', fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  quoteText: { fontSize: 16, color: '#5D4037', textAlign: 'center', lineHeight: 26, fontStyle: 'italic' },
  choiceCard: { backgroundColor: '#E8F5E9', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  choiceTitle: { fontSize: 17, fontWeight: 'bold', color: '#2E7D32', marginBottom: 8, textAlign: 'center' },
  choiceText: { fontSize: 13, color: '#444', textAlign: 'center', lineHeight: 22 },
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#888', marginBottom: 16 },
  milestoneRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-start' },
  milestoneRowCurrent: { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 10, margin: -4, marginBottom: 12 },
  milestoneDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  milestoneDotReached: { backgroundColor: '#2E7D32' },
  milestoneDotFuture: { backgroundColor: '#ddd' },
  milestoneDotText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  milestoneContent: { flex: 1 },
  milestoneTitle: { fontSize: 15, fontWeight: 'bold', color: '#aaa', marginBottom: 2 },
  milestoneTitleReached: { color: '#333' },
  milestoneDesc: { fontSize: 13, color: '#bbb', lineHeight: 20 },
  nextMilestoneBox: { backgroundColor: '#FFF8E7', borderRadius: 10, padding: 12, marginTop: 8 },
  nextMilestoneText: { fontSize: 13, color: '#E67E22', textAlign: 'center' },
  calcCard: { backgroundColor: '#F3F8FF', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  calcTitle: { fontSize: 17, fontWeight: 'bold', color: '#1565C0', marginBottom: 4 },
  calcSub: { fontSize: 13, color: '#888', marginBottom: 16 },
  calcAmount: { fontSize: 48, fontWeight: 'bold', color: '#1565C0', textAlign: 'center' },
  calcAmountLabel: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 16 },
  savedBox: { backgroundColor: '#F8FAF7', borderRadius: 10, padding: 14 },
  savedText: { fontSize: 14, color: '#333', lineHeight: 22 },
  editBtn: { color: '#2E7D32', fontSize: 13, marginTop: 8, fontWeight: 'bold' },
  textArea: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#333', minHeight: 100, textAlignVertical: 'top', marginBottom: 12 },
  btnSave: { backgroundColor: '#2E7D32', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnSaveText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  letterBox: { backgroundColor: '#F8FAF7', borderRadius: 10, padding: 14 },
  letterText: { fontSize: 14, color: '#333', lineHeight: 22, fontStyle: 'italic' },
  storyCard: { backgroundColor: '#F8FAF7', borderRadius: 12, padding: 16, marginBottom: 12 },
  storyName: { fontSize: 14, fontWeight: 'bold', color: '#2E7D32', marginBottom: 4 },
  storyPreview: { fontSize: 13, color: '#666', marginBottom: 8, fontStyle: 'italic' },
  storyReadMore: { fontSize: 12, color: '#2E7D32', fontWeight: 'bold' },
  storyFull: { fontSize: 13, color: '#444', lineHeight: 22, marginTop: 12 },
  myStoryBox: { backgroundColor: '#F0FFF4', borderRadius: 12, padding: 16, marginTop: 12 },
  myStoryTitle: { fontSize: 15, fontWeight: 'bold', color: '#2E7D32', marginBottom: 4 },
  myStorySub: { fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 20 },
  myStoryNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  myStoryStreak: { fontSize: 12, color: '#2E7D32', fontWeight: 'bold' },
  inputBox: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#333', marginBottom: 10 },
});
