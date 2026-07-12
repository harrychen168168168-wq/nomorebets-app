import { useAuth } from '@/auth';
import BreathingTimer from '@/components/BreathingTimer';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import PageContainer from '@/components/PageContainer';
import PaywallModal from '@/components/PaywallModal';
import { isCommunityConfigured, listGuardianLinks } from '@/community';
import { AI_ADDON_10_PRODUCT_ID, AI_PROXY_URL } from '@/config';
import { configureRevenueCat, getSubscriptionSnapshot } from '@/subscription';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Purchases from 'react-native-purchases';
import { loadData as loadStoredData, saveData } from '../storage';

const MOODS = [
  { emoji: '😰', label: '焦虑' },
  { emoji: '😞', label: '低落' },
  { emoji: '😡', label: '愤怒' },
  { emoji: '😵', label: '疲惫' },
  { emoji: '😶', label: '麻木' },
  { emoji: '😣', label: '压力大' },
];

const CRISIS_KEYWORDS = ['自杀', '不想活', '活不下去', '伤害自己', '杀了自己', '伤人', '杀人', '结束生命'];

function isCrisisText(text: string) {
  return CRISIS_KEYWORDS.some((keyword) => text.includes(keyword));
}

function localSupportReply(text: string) {
  if (isCrisisText(text)) return '你现在的安全最重要。请马上离开危险物品，联系身边真人，并立即拨打 988 或 911。';
  if (text.includes('翻本') || text.includes('赢回来')) return '想翻本是最危险的信号。先暂停 5 分钟，把钱从手边移开，今天不做任何赌博决定。';
  if (text.includes('工资') || text.includes('钱')) return '发工资日很容易冲动。现在先把钱转到安全账户，或交给家人保管一部分。你保护的是未来。';
  if (text.includes('压力') || text.includes('焦虑')) return '压力是真的，但赌博会把压力变成更大的债。先做三次慢呼吸，再出门走 10 分钟。';
  return '我听到了。现在先不要做决定，只撑过接下来的 5 分钟。把手机拿远一点，喝口水，给重要的人发一句“我需要你陪我一下”。';
}

export default function EmergencyPage() {
  const { user } = useAuth();
  const [isWaiting, setIsWaiting] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const [mood, setMood] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [lastLoss, setLastLoss] = useState(0);
  const [contacts, setContacts] = useState<any[]>([]);
  const [aiMessages, setAiMessages] = useState<{ role: string; text: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [isAiEligible, setIsAiEligible] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiUsage, setAiUsage] = useState<{ plan?: string; monthlyLimit?: number; monthlyRemaining?: number; addonCreditCentsRemaining?: number } | null>(null);
  const [aiNeedsAddon, setAiNeedsAddon] = useState(false);
  const [aiAddonLoading, setAiAddonLoading] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<number | null>(null);

  const refreshAiEligibility = useCallback(async () => {
    const snapshot = await getSubscriptionSnapshot();
    // Any active Pro entitlement unlocks AI — including the lifetime buyout (planType 'lifetime').
    let eligible = snapshot.isPro;
    // Invited family/mutual guardian members do not have their own subscription, but the AI proxy
    // grants them shared quota. Let an active guardian link open the chat; the server makes the
    // final decision (and shows a fallback if the payer's plan is no longer active).
    if (!eligible && user?.id && isCommunityConfigured()) {
      const links = await listGuardianLinks(user.id).catch(() => []);
      eligible = links.length > 0;
    }
    setIsAiEligible(eligible);
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    loadData();
    refreshAiEligibility();
  }, [refreshAiEligibility]));

  useEffect(() => {
    if (!isWaiting) return;
    if (countdown === 0) {
      setIsWaiting(false);
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [isWaiting, countdown]);

  async function loadData() {
    const records = await loadStoredData('dailyRecords');
    if (records) {
      const parsed = JSON.parse(records);
      const lastGamble = parsed.find((r: any) => r.gambled && r.result === 'lose');
      if (lastGamble) setLastLoss(lastGamble.amount || 0);
    }
    const contactData = await loadStoredData('importantContacts');
    if (contactData) setContacts(JSON.parse(contactData));
    else setContacts([]);
  }

  async function buyAiAddon() {
    if (aiAddonLoading) return;
    if (!AI_ADDON_10_PRODUCT_ID) {
      setAiError('AI 加购包还没有配置。');
      return;
    }
    try {
      setAiAddonLoading(true);
      setAiError('');
      await configureRevenueCat();
      const products = await Purchases.getProducts([AI_ADDON_10_PRODUCT_ID], Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION);
      const product = products[0];
      if (!product) {
        setAiError('AI 加购包暂时不可购买，请稍后再试。');
        return;
      }
      await Purchases.purchaseStoreProduct(product);
      setAiNeedsAddon(false);
      setAiError('AI 加购包已购买。请再发送一次消息刷新额度。');
    } catch (error: any) {
      if (!error?.userCancelled) setAiError('AI 加购包购买失败，请稍后再试。');
    } finally {
      setAiAddonLoading(false);
    }
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
        body: JSON.stringify({ appUserId: user?.id, messages: newMessages.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })) }),
      });
      const data = await response.json().catch(() => ({}));
      if (data?.usage) setAiUsage(data.usage);
      if (!response.ok) {
        setAiNeedsAddon(!!data?.needsAddon || data?.error === 'addon_required');
        setAiError(data?.reply || data?.fallback || 'AI 暂时不可用。');
        const reply = data.reply || data.fallback || localSupportReply(userMsg);
        setAiMessages([...newMessages, { role: 'assistant', text: reply }]);
        return;
      }
      setAiNeedsAddon(false);
      const reply = data.reply || localSupportReply(userMsg);
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
      <KeyboardAwareScrollView style={styles.container}>
        <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              {modalType === 'no' ? (
                <>
                  <Text style={styles.modalTitle}>为自己骄傲</Text>
                  <Text style={styles.modalText}>你刚刚做了一件很了不起的事。冲动来了，你没有屈服。这是真正的力量。</Text>
                  <TouchableOpacity style={styles.modalBtn} onPress={() => setShowModal(false)}><Text style={styles.modalBtnText}>我做到了</Text></TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle}>没关系，诚实需要勇气</Text>
                  <Text style={styles.modalText}>你今天去了。但你打开了这个 App，说明你内心有一部分还想改变。回去记录这一次，不是惩罚自己，而是了解自己。</Text>
                  <TouchableOpacity style={styles.modalBtn} onPress={() => setShowModal(false)}><Text style={styles.modalBtnText}>我会重新开始</Text></TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

        <View style={styles.header}><Text style={styles.headerTitle}>我现在想去赌场</Text><Text style={styles.headerSub}>冲动不是命令。它只是一个感觉。它会过去。</Text></View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>此刻你的感受是？</Text>
          <Text style={styles.cardSub}>了解自己的情绪，是第一步。</Text>
          <View style={styles.moodGrid}>
            {MOODS.map((m) => <TouchableOpacity key={m.label} style={[styles.moodBtn, mood === m.label && styles.moodSelected]} onPress={() => setMood(m.label)}><Text style={styles.moodEmoji}>{m.emoji}</Text><Text style={[styles.moodLabel, mood === m.label && styles.moodLabelSelected]}>{m.label}</Text></TouchableOpacity>)}
          </View>
          {mood !== '' && <View style={styles.moodResponse}><Text style={styles.moodResponseText}>这种感觉是真的，但它会过去。现在先不要做决定，给自己 5 分钟。</Text></View>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>先给自己 5 分钟</Text>
          <Text style={styles.cardSub}>冲动通常会在几分钟内变弱。跟着呼吸，撑过这一段。</Text>
          {isWaiting ? (
            <BreathingTimer secondsLeft={countdown} />
          ) : (
            <>
              <Text style={styles.countdown}>{minutes}:{seconds}</Text>
              <Text style={styles.countdownLabel}>冷静倒计时</Text>
            </>
          )}
          <TouchableOpacity style={[styles.btnGreen, isWaiting && styles.btnDisabled]} disabled={isWaiting} onPress={() => { setIsWaiting(true); setCountdown(300); }}><Text style={styles.btnGreenText}>{isWaiting ? '跟着呼吸…' : '我愿意等 5 分钟'}</Text></TouchableOpacity>
        </View>

        {lastLoss > 0 && (
          <View style={styles.lossCard}>
            <Text style={styles.lossTitle}>上次你输了 ${lastLoss}</Text>
            <Text style={styles.lossSub}>那次之后你是什么感觉？这次真的会不一样吗？</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>联系重要的人</Text>
          <Text style={styles.cardSub}>看看他们的脸。你不是一个人。</Text>
          {contacts.length > 0 ? contacts.slice(0, 3).map((c: any, i: number) => (
            <View key={i} style={styles.contactBtn}>
              <TouchableOpacity onPress={() => setExpandedPhoto(expandedPhoto === i ? null : i)}>{c.photo ? <Image source={{ uri: c.photo }} style={styles.contactPhoto} /> : <Text style={styles.contactEmoji}>👤</Text>}</TouchableOpacity>
              <View style={{ flex: 1 }}><Text style={styles.contactName}>{c.name}</Text><Text style={styles.contactRelation}>{c.relation}</Text></View>
              <TouchableOpacity onPress={() => c.phone && Linking.openURL('tel:' + c.phone)}><Text style={styles.contactCall}>拨打</Text></TouchableOpacity>
            </View>
          )) : <View style={styles.noContactBox}><Text style={styles.noContactText}>还没有添加联系人</Text><Text style={styles.noContactSub}>去“我的”页面添加重要的人。</Text></View>}
          {expandedPhoto !== null && contacts[expandedPhoto]?.photo && <TouchableOpacity style={styles.photoModal} onPress={() => setExpandedPhoto(null)}><Image source={{ uri: contacts[expandedPhoto].photo }} style={styles.photoLarge} /><Text style={styles.photoModalClose}>点击关闭</Text></TouchableOpacity>}
          <TouchableOpacity style={styles.hotlineBtn} onPress={() => Linking.openURL('tel:1-800-522-4700')}><Text style={styles.hotlineBtnText}>全国赌博问题热线 1-800-522-4700</Text></TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>有话想说吗？</Text>
          <Text style={styles.cardSub}>AI 冲动倾诉包含在个人自救版、家庭守护版和互相守护版中。它不代替医生或心理治疗；遇到危险请联系真人或拨打 988 / 911。</Text>
          {!showAiChat ? (
            <TouchableOpacity style={styles.btnAi} onPress={() => {
              if (!isAiEligible) { setShowPaywall(true); return; }
              setShowAiChat(true);
              setAiMessages([{ role: 'assistant', text: '我在这里。不管发生了什么，你都可以先跟我说。此刻你感觉怎么样？' }]);
            }}><Text style={styles.btnAiText}>开始 AI 冲动倾诉</Text></TouchableOpacity>
          ) : (
            <View>
              <ScrollView style={styles.chatScroll} nestedScrollEnabled>
                {aiMessages.map((msg, i) => <View key={i} style={[styles.chatBubble, msg.role === 'user' ? styles.chatUser : styles.chatAi]}><Text style={[styles.chatText, msg.role === 'user' ? styles.chatUserText : styles.chatAiText]}>{msg.text}</Text></View>)}
                {aiLoading && <View style={styles.chatAi}><Text style={styles.chatAiText}>正在回复...</Text></View>}
              </ScrollView>
              {aiUsage ? <View style={styles.aiUsageBox}>{aiUsage.plan === 'lifetime' ? (
                <Text style={styles.aiUsageText}>本月 AI 倾诉：无限次（终身会员）</Text>
              ) : (
                <>
                  <Text style={styles.aiUsageText}>本月基础额度剩余：{aiUsage.monthlyRemaining ?? 0}/{aiUsage.monthlyLimit ?? '—'}</Text>
                  <Text style={styles.aiUsageText}>加购包余额：${(((aiUsage.addonCreditCentsRemaining ?? 0) / 100).toFixed(2))}</Text>
                </>
              )}</View> : null}
              {aiNeedsAddon ? <TouchableOpacity style={styles.aiAddonBtn} onPress={buyAiAddon} disabled={aiAddonLoading}><Text style={styles.aiAddonBtnText}>{aiAddonLoading ? '购买中...' : '购买 AI 加购包'}</Text></TouchableOpacity> : null}
              {aiError ? <Text style={styles.aiError}>{aiError}</Text> : null}
              <View style={styles.chatInputRow}><TextInput style={styles.chatInput} placeholder="说说你的感受..." value={aiInput} onChangeText={setAiInput} multiline /><TouchableOpacity style={styles.chatSend} onPress={sendAiMessage}><Text style={styles.chatSendText}>发送</Text></TouchableOpacity></View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.questionTitle}>你现在还要去赌场吗？</Text>
          <TouchableOpacity style={styles.btnFinalGood} onPress={async () => { setModalType('no'); setShowModal(true); const n = (Number(await loadStoredData('urgesResisted')) || 0) + 1; await saveData('urgesResisted', String(n)); }}><Text style={styles.btnFinalGoodText}>我选择不去</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btnFinalBad, { marginTop: 12 }]} onPress={() => { setModalType('yes'); setShowModal(true); }}><Text style={styles.btnFinalBadText}>我还是去了</Text></TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
        <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} featureName="AI 冲动倾诉" onSuccess={() => { refreshAiEligibility(); setShowPaywall(false); }} />
      </KeyboardAwareScrollView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF7' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#E67E22', textAlign: 'center' },
  headerSub: { fontSize: 13, color: '#666', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 19 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2E7D32', marginBottom: 16, textAlign: 'center' },
  modalText: { fontSize: 14, color: '#333', lineHeight: 22, marginBottom: 24 },
  modalBtn: { backgroundColor: '#2E7D32', borderRadius: 12, padding: 16, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  aiError: { fontSize: 12, color: '#E67E22', backgroundColor: '#FFF8E7', padding: 10, borderRadius: 10, marginBottom: 10, lineHeight: 17 },
  aiUsageBox: { backgroundColor: '#F8FAF7', borderRadius: 10, padding: 10, marginBottom: 10 },
  aiUsageText: { fontSize: 12, color: '#2E7D32', lineHeight: 18 },
  aiAddonBtn: { backgroundColor: '#1565C0', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 10 },
  aiAddonBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
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
