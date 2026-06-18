import PageContainer from '@/components/PageContainer';
import PaywallModal from '@/components/PaywallModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AI_PROXY_URL } from '@/config';
import { getSubscriptionSnapshot } from '@/subscription';
import { Image, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const MOODS = [
  { emoji: '😰', label: '焦虑' },
  { emoji: '😔', label: '低落' },
  { emoji: '😤', label: '愤怒' },
  { emoji: '😴', label: '疲惫' },
  { emoji: '😶', label: '麻木' },
  { emoji: '😣', label: '压力大' },
];

const CRISIS_KEYWORDS = ['自杀', '不想活', '活不下去', '伤害自己', '杀了自己', '伤人', '杀人', '结束生命'];

function isCrisisText(text: string) {
  return CRISIS_KEYWORDS.some((keyword) => text.includes(keyword));
}

function localSupportReply(text: string) {
  if (isCrisisText(text)) {
    return '你现在的安全最重要。请马上离开危险物品，联系身边真人，并立即拨打 988 或 911。你不需要一个人扛。';
  }
  if (text.includes('翻本') || text.includes('赢回来')) {
    return '想翻本是最危险的信号。先暂停5分钟，把钱从手边移开，给一个信任的人发消息。今天不做任何赌博决定。';
  }
  if (text.includes('发工资') || text.includes('钱')) {
    return '发工资日很容易冲动。现在先把钱转到安全账户，或交给家人保管一部分。你保护的是未来。';
  }
  if (text.includes('压力') || text.includes('焦虑')) {
    return '压力是真的，但赌博会把压力变成更大的债。先做三次慢呼吸，再出门走10分钟。冲动会过去。';
  }
  return '我听到了。现在先不要做决定，只撑过接下来的5分钟。把手机拿远一点，喝口水，给重要的人发一句“我需要你陪我一下”。';
}

export default function EmergencyPage() {
  const [isWaiting, setIsWaiting] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const [mood, setMood] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [lastLoss, setLastLoss] = useState(0);
  const [contacts, setContacts] = useState<any[]>([]);
  const [aiMessages, setAiMessages] = useState<{role: string, text: string}[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [reason, setReason] = useState('');
  const [expandedPhoto, setExpandedPhoto] = useState<number | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [aiError, setAiError] = useState('');
  useFocusEffect(
    useCallback(() => {
      loadData();
      getSubscriptionSnapshot().then((snapshot) => setIsPro(snapshot.isPro));
    }, [])
  );

  useEffect(() => {
    if (!isWaiting) return;
    if (countdown === 0) { setIsWaiting(false); return; }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [isWaiting, countdown]);

  async function loadData() {
    const records = await AsyncStorage.getItem('dailyRecords');
    if (records) {
      const parsed = JSON.parse(records);
      const lastGamble = parsed.find((r: any) => r.gambled && r.result === 'lose');
      if (lastGamble) setLastLoss(lastGamble.amount || 0);
    }
    const contactData = await AsyncStorage.getItem('importantContacts');
    if (contactData) setContacts(JSON.parse(contactData));
  }

 async function sendAiMessage() {
    if (!aiInput.trim() || aiLoading) return;
    setAiError('');
    const userMsg = aiInput.trim();
    setAiInput('');
    const newMessages = [...aiMessages, { role: 'user', text: userMsg }];
    setAiMessages(newMessages);

    if (isCrisisText(userMsg)) {
      setAiMessages([...newMessages, { role: 'assistant', text: localSupportReply(userMsg) }]);
      return;
    }

    setAiLoading(true);
    try {
      if (!AI_PROXY_URL) {
        setAiMessages([...newMessages, { role: 'assistant', text: localSupportReply(userMsg) }]);
        return;
      }

      const response = await fetch(AI_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
          safetyContext: 'gambling recovery support, Chinese, short supportive reply, crisis escalation to 988/911',
        }),
      });
      if (!response.ok) throw new Error(`AI proxy error: ${response.status}`);
      const data = await response.json();
      const reply = data.reply || data.choices?.[0]?.message?.content || localSupportReply(userMsg);
      setAiMessages([...newMessages, { role: 'assistant', text: reply }]);
    } catch {
      setAiError('AI 后端暂时不可用，已切换为本机急救回复。');
      setAiMessages([...newMessages, { role: 'assistant', text: localSupportReply(userMsg) }]);
    } finally {
      setAiLoading(false);
    }
  }


  const minutes = String(Math.floor(countdown / 60)).padStart(2, '0');
  const seconds = String(countdown % 60).padStart(2, '0');

  return (
    <PageContainer>
    <ScrollView style={styles.container}>

      {/* 弹窗 */}
      {showModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {modalType === 'no' ? (
              <>
                <Text style={styles.modalTitle}>🏆 为自己感到骄傲</Text>
                <Text style={styles.modalText}>{'你刚刚做了一件很了不起的事。\n\n冲动来了，你没有屈服。这不是软弱，这是真正的力量。\n\n这一刻，你选择了自己，也选择了家人。'}</Text>
                <TouchableOpacity style={styles.modalBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.modalBtnText}>我做到了 💚</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>没关系，诚实需要勇气</Text>
                <Text style={styles.modalText}>{'你今天去了。但你打开了这个App，走完了这个流程。\n\n这说明你内心有一部分是想改变的。那个部分，才是真正的你。\n\n回去记录这一次，不是惩罚自己，而是了解自己。'}</Text>
                <TouchableOpacity style={styles.modalBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.modalBtnText}>去记录这一次</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}  

      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚨 我想去赌场了</Text>
        <Text style={styles.headerSub}>冲动不是命令。它只是一个感觉。它会过去。</Text>
      </View>

      {/* 1. 我现在的感受 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>此刻你的感受是？</Text>
        <Text style={styles.cardSub}>了解自己的情绪，是第一步。</Text>
        <View style={styles.moodGrid}>
          {MOODS.map(m => (
            <TouchableOpacity
              key={m.label}
              style={[styles.moodBtn, mood === m.label && styles.moodSelected]}
              onPress={() => setMood(m.label)}
            >
              <Text style={styles.moodEmoji}>{m.emoji}</Text>
              <Text style={[styles.moodLabel, mood === m.label && styles.moodLabelSelected]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {mood !== '' && (
          <View style={styles.moodResponse}>
            <Text style={styles.moodResponseText}>
              {mood === '焦虑' ? '焦虑时去赌博，往往输得更多，因为判断力下降了。先让自己静下来。' :
               mood === '低落' ? '低落时最容易冲动。赌博不会让你感觉更好，只会让明天更低落。' :
               mood === '愤怒' ? '愤怒时做的决定往往会后悔。给自己10分钟，等愤怒过去。' :
               mood === '疲惫' ? '疲惫时意志力最弱。你现在需要的是休息，不是刺激。' :
               mood === '麻木' ? '感到麻木很正常。你不需要通过赌博来找回感觉。' :
               '压力来了，但赌博只会加倍压力。先把压力说给一个你信任的人听。'}
            </Text>
          </View>
        )}
      </View>
      {/* 为什么想去 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>你为什么想去？</Text>
        <Text style={styles.cardSub}>说出来，冲动会减弱一半。</Text>
        <View style={styles.moodGrid}>
          {[
            { label: '翻本', response: '翻本的感觉很真实，但赌场的概率永远对你不利。上一次你是怎么离开的？' },
            { label: '压力大', response: '压力真实存在，但赌博只会在压力上再加一层。试试出去走10分钟。' },
            { label: '无聊', response: '无聊是可以解决的。打开一部电影，给朋友发消息，任何事都比赌博代价小。' },
            { label: '朋友约', response: '真正的朋友会尊重你说不。你可以约他们做别的事。' },
            { label: '发工资', response: '发工资是最危险的时刻。先把钱转给家人，或者转入另一个账户，让钱先离手。' },
            { label: '情绪低落', response: '你值得被好好照顾。低落时需要的是陪伴，不是刺激。联系一个你信任的人。' },
            { label: '习惯了', response: '习惯是可以改变的。你今天打开这个App，就已经在改变了。' },
            { label: '其他', response: '不管什么原因，你现在感受到的冲动是真实的。但它会过去，真的会过去。' },
          ].map(item => (
            <TouchableOpacity
              key={item.label}
              style={[styles.moodBtn, reason === item.label && styles.moodSelected]}
              onPress={() => setReason(item.label)}
            >
              <Text style={[styles.moodLabel, reason === item.label && styles.moodLabelSelected]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {reason !== '' && (
          <View style={styles.moodResponse}>
            <Text style={styles.moodResponseText}>
              {[
                { label: '翻本', response: '翻本的感觉很真实，但赌场的概率永远对你不利。上一次你是怎么离开的？' },
                { label: '压力大', response: '压力真实存在，但赌博只会在压力上再加一层。试试出去走10分钟。' },
                { label: '无聊', response: '无聊是可以解决的。打开一部电影，给朋友发消息，任何事都比赌博代价小。' },
                { label: '朋友约', response: '真正的朋友会尊重你说不。你可以约他们做别的事。' },
                { label: '发工资', response: '发工资是最危险的时刻。先把钱转给家人，或者转入另一个账户，让钱先离手。' },
                { label: '情绪低落', response: '你值得被好好照顾。低落时需要的是陪伴，不是刺激。联系一个你信任的人。' },
                { label: '习惯了', response: '习惯是可以改变的。你今天打开这个App，就已经在改变了。' },
                { label: '其他', response: '不管什么原因，你现在感受到的冲动是真实的。但它会过去，真的会过去。' },
              ].find(i => i.label === reason)?.response}
            </Text>
          </View>
        )}
        <View style={styles.factBox}>
          <Text style={styles.factTitle}>💡 你知道吗？</Text>
          <Text style={styles.factText}>• 要是能赢走赌场的钱，赌场就不会越盖越大、越来越豪华。</Text>
          <Text style={styles.factText}>• 赌场提供的免费饮料、礼品、返水，都是用你输的钱买的——而且还不属于你。</Text>
          <Text style={styles.factText}>• 输钱皆因赢钱起。第一次赢，是赌场让你赢的。</Text>
          <Text style={styles.factText}>• 赌场不怕你赢钱，就怕你不来。</Text>
          <Text style={styles.factText}>• 所有赌博游戏的概率都对庄家有利，这是数学，不是运气。</Text>
          <Text style={styles.factText}>• 全世界没有一个职业赌徒能长期稳定赢钱，但赌场每年都在盈利。</Text>
        </View>
      </View>

      {/* 2. 先停下来5分钟 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>先给自己5分钟</Text>
        <Text style={styles.cardSub}>研究表明，冲动通常在5分钟内自然减弱。</Text>
        <Text style={styles.countdown}>{minutes}:{seconds}</Text>
        <Text style={styles.countdownLabel}>冷静倒计时</Text>
        {isWaiting && (
          <View style={styles.breathCard}>
            <Text style={styles.breathText}>
              {countdown > 240 ? '🌬️ 慢慢吸气... 4秒' :
               countdown > 180 ? '😮‍💨 屏住呼吸... 4秒' :
               countdown > 120 ? '💨 慢慢呼气... 4秒' :
               countdown > 60 ? '🧘 感受身体放松下来...' :
               '💚 你快撑过去了，冲动正在减弱...'}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.btnGreen, isWaiting && styles.btnDisabled]}
          onPress={() => { setIsWaiting(true); setCountdown(300); }}
        >
          <Text style={styles.btnGreenText}>{isWaiting ? '计时中...' : '我愿意等5分钟'}</Text>
        </TouchableOpacity>
      </View>

      {/* 3. 上次的代价 */}
      {lastLoss > 0 && (
        <View style={styles.lossCard}>
          <Text style={styles.lossTitle}>💸 上次你输了 ${lastLoss}</Text>
          <Text style={styles.lossSub}>那次之后你是什么感觉？这次会不一样吗？</Text>
          <View style={styles.lossRows}>
            {[
              { icon: '🍽️', text: `${Math.floor(lastLoss / 80)} 次家庭聚餐` },
              { icon: '👕', text: `孩子 ${Math.floor(lastLoss / 25)} 件衣服` },
              { icon: '🏠', text: `月租的 ${Math.round((lastLoss / 1200) * 100)}%` },
            ].map(item => (
              <View key={item.text} style={styles.lossRow}>
                <Text style={styles.lossIcon}>{item.icon}</Text>
                <Text style={styles.lossRowText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 4. 联系重要的人 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📞 联系重要的人</Text>
        <Text style={styles.cardSub}>看看他们的脸。你还想去赌吗？</Text>
        {contacts.length > 0 ? (
          <>
            {contacts.slice(0, 3).map((c: any, i: number) => (
              <View key={i} style={styles.contactBtn}>
                <TouchableOpacity onPress={() => setExpandedPhoto(expandedPhoto === i ? null : i)}>
                  {c.photo ? (
                    <Image source={{uri: c.photo}} style={styles.contactPhoto} />
                  ) : (
                    <Text style={styles.contactEmoji}>👤</Text>
                  )}
                </TouchableOpacity>
                <View style={{flex: 1}}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  <Text style={styles.contactRelation}>{c.relation}</Text>
                </View>
                <TouchableOpacity onPress={() => c.phone && Linking.openURL(`tel:${c.phone}`)}>
                  <Text style={styles.contactCall}>📞 拨打</Text>
                </TouchableOpacity>
              </View>
            ))}
            {expandedPhoto !== null && contacts[expandedPhoto]?.photo && (
              <TouchableOpacity style={styles.photoModal} onPress={() => setExpandedPhoto(null)}>
                <Image source={{uri: contacts[expandedPhoto].photo}} style={styles.photoLarge} />
                <Text style={styles.photoModalClose}>点击关闭</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.noContactBox}>
            <Text style={styles.noContactText}>还没有添加联系人</Text>
            <Text style={styles.noContactSub}>去「我的」页面添加重要的人</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.hotlineBtn}
          onPress={() => Linking.openURL('tel:1-800-522-4700')}
        >
          <Text style={styles.hotlineBtnText}>📞 全国赌博问题热线 1-800-522-4700</Text>
        </TouchableOpacity>
      </View>

      {/* 5. AI倾诉 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>💬 有话想说吗？</Text>
        <Text style={styles.cardSub}>没有人在身边？和AI说说你的感受。不代替医生或心理治疗，遇到危险请立即联系真人或拨打 988 / 911。</Text>
       {!showAiChat ? (
            <TouchableOpacity style={styles.btnAi} onPress={() => {
              if (!isPro) {
                setShowPaywall(true);
                return;
              }
              setShowAiChat(true);
              setAiMessages([{ role: 'assistant', text: '我在这里。不管发生了什么，你都可以跟我说。此刻你感觉怎么样？' }]);
            }}>
              <Text style={styles.btnAiText}>💬 开始 AI 倾诉（高级版）</Text>
            </TouchableOpacity>
          ) : (
            <View>
              <ScrollView style={styles.chatScroll} nestedScrollEnabled>
                {aiMessages.map((msg, i) => (
                  <View key={i} style={[styles.chatBubble, msg.role === 'user' ? styles.chatUser : styles.chatAi]}>
                    <Text style={[styles.chatText, msg.role === 'user' ? styles.chatUserText : styles.chatAiText]}>
                      {msg.text}
                    </Text>
                  </View>
                ))}
                {aiLoading && (
                  <View style={styles.chatAi}>
                    <Text style={styles.chatAiText}>正在回复...</Text>
                  </View>
                )}
              </ScrollView>
              {aiError ? <Text style={styles.aiError}>{aiError}</Text> : null}
              <View style={styles.chatInputRow}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="说说你的感受..."
                  value={aiInput}
                  onChangeText={setAiInput}
                  multiline
                />
                <TouchableOpacity style={styles.chatSend} onPress={sendAiMessage}>
                  <Text style={styles.chatSendText}>发送</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
      </View>

      {/* 6. 最终决定 */}
      <View style={styles.card}>
        <Text style={styles.questionTitle}>你现在还要去赌场吗？</Text>
        <TouchableOpacity
          style={styles.btnFinalGood}
          onPress={() => { setModalType('no'); setShowModal(true); }}
        >
          <Text style={styles.btnFinalGoodText}>✅ 我选择不去</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnFinalBad, {marginTop: 12}]}
          onPress={() => { setModalType('yes'); setShowModal(true); }}
        >
          <Text style={styles.btnFinalBadText}>❌ 我还是去了</Text>
        </TouchableOpacity>
      </View>

      <View style={{height: 40}} />
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName="AI 冲动倾诉"
        onSuccess={() => {
          setIsPro(true);
          setShowPaywall(false);
        }}
      />
    </ScrollView>
    </PageContainer>
  );
}const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF7' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#E67E22', textAlign: 'center' },
  headerSub: { fontSize: 13, color: '#666', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#888', marginBottom: 16 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moodBtn: { width: '30%', alignItems: 'center', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, paddingVertical: 12 },
  moodSelected: { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' },
  moodEmoji: { fontSize: 24 },
  moodLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  moodLabelSelected: { color: '#2E7D32', fontWeight: 'bold' },
  moodResponse: { backgroundColor: '#F3F8FF', borderRadius: 10, padding: 14, marginTop: 14 },
  moodResponseText: { fontSize: 13, color: '#1565C0', lineHeight: 20 },
  countdown: { fontSize: 64, fontWeight: 'bold', color: '#2E7D32', textAlign: 'center' },
  countdownLabel: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 16 },
  breathCard: { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 14, marginBottom: 16 },
  breathText: { fontSize: 16, fontWeight: 'bold', color: '#2E7D32', textAlign: 'center' },
  btnGreen: { backgroundColor: '#2E7D32', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#A5D6A7' },
  btnGreenText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  lossCard: { backgroundColor: '#FFF8F0', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  lossTitle: { fontSize: 17, fontWeight: 'bold', color: '#E67E22', marginBottom: 4 },
  lossSub: { fontSize: 13, color: '#666', marginBottom: 14 },
  lossRows: {},
  lossRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#FFE0C0' },
  lossIcon: { fontSize: 20, marginRight: 12 },
  lossRowText: { fontSize: 14, color: '#555' },
  contactBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAF7', borderRadius: 12, padding: 14, marginBottom: 10 },
  contactEmoji: { fontSize: 24, marginRight: 12 },
  contactName: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  contactRelation: { fontSize: 12, color: '#888' },
  contactCall: { fontSize: 13, color: '#2E7D32', fontWeight: 'bold' },
  noContactBox: { backgroundColor: '#F8FAF7', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 12 },
  noContactText: { fontSize: 14, color: '#888', marginBottom: 4 },
  noContactSub: { fontSize: 12, color: '#aaa', textAlign: 'center' },
  hotlineBtn: { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  hotlineBtnText: { color: '#2E7D32', fontSize: 13, fontWeight: 'bold' },
  btnAi: { backgroundColor: '#F3F8FF', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnAiText: { color: '#1565C0', fontSize: 15, fontWeight: 'bold' },
  questionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  btnFinalGood: { backgroundColor: '#2E7D32', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnFinalGoodText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  btnFinalBad: { borderWidth: 1.5, borderColor: '#D32F2F', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnFinalBadText: { color: '#D32F2F', fontSize: 17 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 999, padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2E7D32', marginBottom: 16, textAlign: 'center' },
  modalText: { fontSize: 14, color: '#333', lineHeight: 22, marginBottom: 24 },
  modalBtn: { backgroundColor: '#2E7D32', borderRadius: 12, padding: 16, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  factBox: { backgroundColor: '#F8FAF7', borderRadius: 10, padding: 14, marginTop: 16 },
  factTitle: { fontSize: 14, fontWeight: 'bold', color: '#2E7D32', marginBottom: 10 },
  factText: { fontSize: 13, color: '#444', lineHeight: 22, marginBottom: 4 },
  aiOptions: { gap: 4 },
  aiNote: { fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 8 },
  aiError: { fontSize: 12, color: '#E67E22', backgroundColor: '#FFF8E7', padding: 10, borderRadius: 10, marginBottom: 10, lineHeight: 17 },
  chatScroll: { maxHeight: 300, marginBottom: 10 },
  chatBubble: { maxWidth: '85%', borderRadius: 12, padding: 12, marginBottom: 8 },
  chatUser: { alignSelf: 'flex-end', backgroundColor: '#2E7D32' },
  chatAi: { alignSelf: 'flex-start', backgroundColor: '#F3F8FF', borderRadius: 12, padding: 12, marginBottom: 8 },
  chatText: { fontSize: 14, lineHeight: 20 },
  chatUserText: { color: '#fff' },
  chatAiText: { color: '#1565C0' },
  chatInputRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  chatInput: { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 14, color: '#333', maxHeight: 80 },
  chatSend: { backgroundColor: '#2E7D32', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  chatSendText: { color: '#fff', fontWeight: 'bold' },
  photoModal: { backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 16, padding: 20, alignItems: 'center', marginTop: 10 },
  photoLarge: { width: 240, height: 240, borderRadius: 120 },
  photoModalClose: { color: '#fff', fontSize: 13, marginTop: 12, opacity: 0.7 },
  contactPhoto: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
});