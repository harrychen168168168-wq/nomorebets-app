import PageContainer from '@/components/PageContainer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const DAILY_QUOTES = [
  "赌场赢的是概率，你赢的是人生。",
  "每一天不赌博，都是送给家人最好的礼物。",
  "你戒掉的不只是赌博，是重新拿回了自己的人生。",
  "钱输了可以再赚，时间和家人的信任输了很难再回来。",
  "你比你想象的更强大。",
  "此刻的坚持，就是最好的你。",
  "戒赌不是失去什么，而是找回真正的自己。",
  "每一次说不，都是对未来的一次投资。",
  "今天的坚持，是明天家人笑容的来源。",
  "冲动是魔鬼，理智是你真正的力量。",
];

const MILESTONES = [
  { days: 1, emoji: '🌱', title: '第1天', desc: '大脑开始减少对赌博的渴望信号，这是改变的起点。' },
  { days: 3, emoji: '😴', title: '第3天', desc: '睡眠开始改善，焦虑感略有下降，身体在悄悄恢复。' },
  { days: 7, emoji: '🧠', title: '第7天', desc: '多巴胺系统开始恢复正常分泌，你的大脑在重新学习快乐。' },
  { days: 14, emoji: '💪', title: '第14天', desc: '冲动频率明显减少，自控力显著增强。' },
  { days: 30, emoji: '🌳', title: '第30天', desc: '大脑奖励回路基本恢复，情绪趋于稳定，家人开始感受到变化。' },
  { days: 90, emoji: '💎', title: '第90天', desc: '财务状况开始明显改善，家庭关系在修复，你已经不一样了。' },
  { days: 180, emoji: '🏆', title: '第180天', desc: '新的生活习惯已经建立，赌博的诱惑越来越弱。' },
  { days: 365, emoji: '👑', title: '第365天', desc: '研究显示，坚持一年后复发率大幅下降。你做到了别人做不到的事。' },
];

const STORIES = [
  {
    name: 'David，43岁',
    preview: '我输掉了房子的首付，以为一切都完了...',
    full: '我输掉了房子的首付，以为一切都完了。老婆差点离开我，孩子不敢跟朋友说爸爸做什么。那天我在赌场停车场坐了两个小时，不知道怎么回家。\n\n后来我用了这个App，每天打卡，有冲动就打开冲动页面。前三个月最难，有几次差点又去了。但我想到孩子的脸，就没有进去。\n\n现在是第14个月。我们买了房子。孩子上周说爸爸你变了，变好了。那一刻我哭了。',
  },
  {
    name: 'Jenny，35岁',
    preview: '我是线上赌博，家人完全不知道，直到信用卡爆了...',
    full: '我是线上赌博，家人完全不知道，直到信用卡爆了，欠了8万多。那种羞耻感，我不知道怎么描述。\n\n我没有告诉任何人，一个人开始戒。用App记录每一天，每次想赌就写日记。\n\n花了两年还清了债。那是我这辈子最勇敢的事。',
  },
  {
    name: 'Michael，51岁',
    preview: '赌了二十年，以为自己戒不了...',
    full: '赌了二十年，以为自己戒不了。试过很多次，最长坚持了三个月，然后又回去了。\n\n第七次尝试的时候，我改变了一件事：我不再跟自己说"我永远不赌了"，而是每天只问自己"今天不去可以吗？"\n\n今天是第二年第四个月。我还是每天问自己那个问题。答案还是可以。',
  },
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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % DAILY_QUOTES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  async function loadData() {
    const s = await AsyncStorage.getItem('streak');
    const loss = await AsyncStorage.getItem('monthlyLoss');
    const why = await AsyncStorage.getItem('whyQuit');
    const fl = await AsyncStorage.getItem('futureLetter');
    const story = await AsyncStorage.getItem('myStory');
    const storyName = await AsyncStorage.getItem('myStoryName');
    setStreak(Number(s) || 0);
    setMonthlyLoss(Number(loss) || 0);
    if (why) { setWhyQuit(why); setSavedWhyQuit(why); }
    if (fl) { setSavedLetter(fl); }
    if (story) setMyStory(story);
    if (storyName) setMyStoryName(storyName);
  }

  async function saveWhyQuit() {
    await AsyncStorage.setItem('whyQuit', whyQuit);
    setSavedWhyQuit(whyQuit);
  }

  async function saveLetter() {
    await AsyncStorage.setItem('futureLetter', letter);
    setSavedLetter(letter);
    setShowLetterInput(false);
  }

  async function saveMyStory() {
    await AsyncStorage.setItem('myStory', myStory);
    await AsyncStorage.setItem('myStoryName', myStoryName);
    setEditingStory(false);
  }

  const yearlyLoss = monthlyLoss * 12;
  const currentMilestone = MILESTONES.filter(m => streak >= m.days).pop();
  const nextMilestone = MILESTONES.find(m => streak < m.days);

  return (
    <PageContainer>
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🌱 希望与动力</Text>
        <Text style={styles.headerSub}>每一天都是新的可能</Text>
      </View>

      <View style={styles.quoteCard}>
        <Text style={styles.quoteLabel}>今日语录</Text>
        <Text style={styles.quoteText}>「{DAILY_QUOTES[quoteIndex]}」</Text>
      </View>

      <View style={styles.choiceCard}>
        <Text style={styles.choiceTitle}>
          {streak > 0 ? `你已经坚持了 ${streak} 天` : '今天是新的开始'}
        </Text>
        <Text style={styles.choiceText}>
          {streak > 0
            ? `这 ${streak} 天里，你每一天都做出了正确的选择。\n你选择了家人，选择了未来，选择了真正的自己。`
            : '迈出第一步，告诉自己：我可以的。'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🧬 坚持后身体的变化</Text>
        <Text style={styles.cardSub}>这些都是科学研究证实的</Text>
        {MILESTONES.map((m, i) => {
          const reached = streak >= m.days;
          const isCurrent = currentMilestone?.days === m.days;
          return (
            <View key={i} style={[styles.milestoneRow, isCurrent && styles.milestoneRowCurrent]}>
              <View style={[styles.milestoneDot, reached ? styles.milestoneDotReached : styles.milestoneDotFuture]}>
                <Text style={styles.milestoneDotText}>{reached ? '✓' : ''}</Text>
              </View>
              <View style={styles.milestoneContent}>
                <Text style={[styles.milestoneTitle, reached && styles.milestoneTitleReached]}>
                  {m.emoji} {m.title}
                </Text>
                <Text style={[styles.milestoneDesc, reached && styles.milestoneTitleReached]}>
                  {m.desc}
                </Text>
              </View>
            </View>
          );
        })}
        {nextMilestone && (
          <View style={styles.nextMilestoneBox}>
            <Text style={styles.nextMilestoneText}>
              距离「{nextMilestone.emoji} {nextMilestone.title}」还有 {nextMilestone.days - streak} 天
            </Text>
          </View>
        )}
      </View>

      {yearlyLoss > 0 && (
        <View style={styles.calcCard}>
          <Text style={styles.calcTitle}>💰 如果你坚持一年...</Text>
          <Text style={styles.calcSub}>按照你目前的月均损失计算</Text>
          <Text style={styles.calcAmount}>${yearlyLoss.toLocaleString()}</Text>
          <Text style={styles.calcAmountLabel}>一年可以节省</Text>
          {[
            { icon: '✈️', text: `${Math.floor(yearlyLoss / 3000)} 次全家旅行` },
            { icon: '🎓', text: `孩子大学学费的 ${Math.round((yearlyLoss / 20000) * 100)}%` },
            { icon: '🏠', text: `房子首付的 ${Math.round((yearlyLoss / 50000) * 100)}%` },
            { icon: '🚗', text: `一辆 ${yearlyLoss >= 30000 ? 'Toyota Camry' : yearlyLoss >= 15000 ? '二手好车' : '代步车'}` },
          ].map(item => (
            <View key={item.text} style={styles.calcRow}>
              <Text style={styles.calcIcon}>{item.icon}</Text>
              <Text style={styles.calcText}>{item.text}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>❤️ 我为什么戒赌</Text>
        <Text style={styles.cardSub}>写下你的理由，危急时刻翻出来看</Text>
        {savedWhyQuit !== '' ? (
          <View style={styles.savedBox}>
            <Text style={styles.savedText}>{savedWhyQuit}</Text>
            <TouchableOpacity onPress={() => setSavedWhyQuit('')}>
              <Text style={styles.editBtn}>修改</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.textArea}
              placeholder="例如：为了孩子，为了老婆，为了重新做回自己..."
              multiline
              numberOfLines={4}
              value={whyQuit}
              onChangeText={setWhyQuit}
            />
            <TouchableOpacity style={styles.btnSave} onPress={saveWhyQuit}>
              <Text style={styles.btnSaveText}>保存</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📝 写给未来的自己</Text>
        <Text style={styles.cardSub}>写一封信给三个月后的你</Text>
        {savedLetter !== '' && !showLetterInput ? (
          <View style={styles.letterBox}>
            <Text style={styles.letterText}>{savedLetter}</Text>
            <TouchableOpacity onPress={() => { setLetter(savedLetter); setShowLetterInput(true); }}>
              <Text style={styles.editBtn}>重新写</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.textArea}
              placeholder="亲爱的未来的我，现在的我正在努力改变..."
              multiline
              numberOfLines={6}
              value={letter}
              onChangeText={setLetter}
            />
            <TouchableOpacity style={styles.btnSave} onPress={saveLetter}>
              <Text style={styles.btnSaveText}>封存这封信</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>💬 真实故事</Text>
        <Text style={styles.cardSub}>他们做到了，你也可以。</Text>
        {STORIES.map((story, i) => (
          <View key={i} style={styles.storyCard}>
            <TouchableOpacity onPress={() => setExpandedStory(expandedStory === i ? null : i)}>
              <Text style={styles.storyName}>{story.name}</Text>
              <Text style={styles.storyPreview}>{story.preview}</Text>
              <Text style={styles.storyReadMore}>{expandedStory === i ? '收起 ▲' : '阅读完整故事 ▼'}</Text>
            </TouchableOpacity>
            {expandedStory === i && (
              <Text style={styles.storyFull}>{story.full}</Text>
            )}
          </View>
        ))}

        <View style={styles.myStoryBox}>
          <Text style={styles.myStoryTitle}>✍️ 写下你的故事</Text>
          <Text style={styles.myStorySub}>你经历过什么？是什么让你决定改变？你的故事可能正是某个人需要看到的。</Text>
          {myStory !== '' && !editingStory ? (
            <View>
              <View style={styles.myStoryNameRow}>
                <Text style={styles.storyName}>{myStoryName || '匿名'}</Text>
                <Text style={styles.myStoryStreak}>坚持了 {streak} 天</Text>
              </View>
              <Text style={styles.storyFull}>{myStory}</Text>
              <TouchableOpacity onPress={() => setEditingStory(true)}>
                <Text style={styles.editBtn}>修改故事</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TextInput
                style={styles.inputBox}
                placeholder="你叫什么（可匿名）"
                value={myStoryName}
                onChangeText={setMyStoryName}
              />
              <TextInput
                style={[styles.textArea, {marginTop: 10}]}
                placeholder="写下你的故事..."
                multiline
                numberOfLines={6}
                value={myStory}
                onChangeText={setMyStory}
              />
              <TouchableOpacity style={styles.btnSave} onPress={saveMyStory}>
                <Text style={styles.btnSaveText}>保存我的故事</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={{height: 40}} />
    </ScrollView>
    </PageContainer>
  );
}const styles = StyleSheet.create({
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
  calcRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#DCE8FF' },
  calcIcon: { fontSize: 20, marginRight: 12 },
  calcText: { fontSize: 14, color: '#333' },
  savedBox: { backgroundColor: '#F8FAF7', borderRadius: 10, padding: 14 },
  savedText: { fontSize: 14, color: '#333', lineHeight: 22 },
  editBtn: { color: '#2E7D32', fontSize: 13, marginTop: 8, fontWeight: 'bold' },
  textArea: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#333', minHeight: 100, textAlignVertical: 'top', marginBottom: 12 },
  btnSave: { backgroundColor: '#2E7D32', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnSaveText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  btnOutline: { borderWidth: 1.5, borderColor: '#2E7D32', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnOutlineText: { color: '#2E7D32', fontSize: 15, fontWeight: 'bold' },
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