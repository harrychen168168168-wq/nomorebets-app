import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// In-app privacy policy shown as a full-screen modal so it works everywhere — including the login
// and onboarding screens that render outside the tab navigator. The verbatim text mirrors the
// published policy at nezha2capital.com/privacy so the app never has to open a web page for it.
const EFFECTIVE = '生效日期：2026.07.08';

const INTRO =
  'NEZHA 2 CAPITAL INC 重视用户隐私。本政策适用于我们的全部产品，包括 StudyTeacher AI、长岛华人圈 Nassau Connect、NO MORE BETS 与 AI 验屋师。';

const SECTIONS: { h: string; body: string[] }[] = [
  {
    h: '一、我们收集的信息',
    body: [
      '根据你使用的产品不同，我们可能收集以下信息：',
      '账号信息：注册长岛华人圈、NO MORE BETS 或 AI 验屋师时提供的昵称、邮箱、头像；通过 Apple / Google 登录时由对应平台提供的基本资料。注册 StudyTeacher AI 账号时，我们保存你的邮箱、加密后的密码（不可还原的哈希值）以及 AI 使用次数统计，仅用于登录和额度管理。',
      '用户内容：你在长岛华人圈发布的帖子、聊天消息、二手 / 租房 / 招聘信息；在 NO MORE BETS 中记录的打卡数据、承诺内容、重要联系人与 AI 倾诉对话；在 AI 验屋师中拍摄的验屋照片、备注与生成的报告；在 StudyTeacher AI 中上传的教材文件与提问内容。NO MORE BETS 中的戒赌记录属于敏感个人信息，我们仅用于向你本人（及你主动授权的守护人）展示，绝不用于广告或对外披露。',
      '设备与日志信息：设备型号、系统版本、应用崩溃日志等，用于改进产品稳定性。',
      '推送凭证：如你允许通知，我们会保存用于发送推送的设备令牌。',
    ],
  },
  {
    h: '二、信息的使用方式',
    body: [
      '提供、维护和改进产品核心功能（如社区交流、AI 讲解、报告生成）。',
      '实现 AI 功能：你主动提交的文本、教材片段或照片会被发送给 AI 服务处理（见下一条）。',
      '发送与你相关的通知（如新消息提醒），你可以随时在系统设置中关闭。',
      '保障账号与社区安全，处理违规内容举报。',
    ],
  },
  {
    h: '三、AI 功能与第三方服务',
    body: [
      'AI 处理：AI 讲解、问答、照片分析等功能由 OpenAI 等第三方 AI 服务提供技术支持。我们只传输完成当次请求所必需的内容，不会将你的数据用于训练我们自己的模型。',
      '登录服务：Apple 登录、Google 登录由对应平台按其隐私政策处理。',
      '云服务：社区数据托管在可靠的云服务商（如 Supabase）；StudyTeacher AI 的年付云同步数据存储于 Cloudflare R2 对象存储；订阅提醒等邮件通过邮件服务商发送。网页端订阅由 Stripe 处理，应用内购买由 Apple App Store / Google Play 处理，我们不接触你的银行卡信息。',
    ],
  },
  {
    h: '四、数据存储与安全',
    body: [
      '本地优先：默认情况下，StudyTeacher AI 的教材库、译文、学习进度、书签、词汇本、笔记与高亮保存在你自己设备的浏览器中，不上传到我们的服务器。',
      'NO MORE BETS 的云端备份：为了让你换手机或重装 App 后不丢失记录，你的每日打卡（含日记文字、金额、心情、冲动等级）、连续天数、重要联系人与目标，会在保存的同时备份到我们的云端数据库，按用户隔离、经 HTTPS 传输。这些内容只用于向你本人恢复数据；守护人看到的仅是你授权的状态摘要（今日是否守住、连续天数、心情、冲动等级），不含日记全文、金额、联系人。你可以在「我的 → 注销账号」中删除全部云端数据。',
      '年付云同步（可选）：若你开启年付版的云同步，上述数据会以加密方式存储在云端（静态加密 + 全程 HTTPS 传输加密）、按用户隔离与访问控制，仅用于向你本人跨设备同步；你可随时导出或删除。',
      '数据保留：我们仅在提供服务所必需的期间保留数据。云端数据在 Pro 到期后保留 60 天（供导出或续费），期间每 10 天提醒一次；之后、以及连续 12 个月未访问的，将被删除。账号注销后将删除或匿名化相关个人信息。',
    ],
  },
  {
    h: '五、信息共享',
    body: [
      '我们不出售你的个人信息。仅在以下情况共享必要信息：为实现功能所必需的第三方服务（如 AI 处理、云托管、推送）；法律法规要求；或为保护用户与公众的安全。',
    ],
  },
  {
    h: '六、你的权利',
    body: [
      '你可以随时在应用内查看、更正你的个人资料。',
      '你可以删除自己发布的内容，或申请注销账号并删除关联数据。',
      '如需行使上述权利或有任何隐私问题，请联系 support@nezha2capital.com，我们会在合理期限内处理。',
    ],
  },
  {
    h: '七、儿童隐私',
    body: ['我们的产品不面向 13 岁以下儿童。如果我们发现误收集了儿童的个人信息，将尽快删除。'],
  },
  {
    h: '八、政策更新',
    body: ['我们可能不时更新本政策。重大变更会在官网或应用内显著位置公告。更新后继续使用产品即表示接受修订后的政策。'],
  },
  {
    h: '九、联系我们',
    body: ['NEZHA 2 CAPITAL INC', '邮箱：support@nezha2capital.com'],
  },
];

export default function PrivacyPolicyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose}><Text style={styles.close}>← 返回</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <Text style={styles.title}>隐私政策</Text>
          <Text style={styles.effective}>{EFFECTIVE}</Text>
          <Text style={styles.intro}>{INTRO}</Text>
          {SECTIONS.map((s) => (
            <View key={s.h} style={styles.section}>
              <Text style={styles.sectionTitle}>{s.h}</Text>
              {s.body.map((p, i) => (
                <Text key={i} style={styles.para}>{p}</Text>
              ))}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAF7' },
  topBar: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#F8FAF7' },
  close: { fontSize: 15, color: '#2E7D32', fontWeight: 'bold' },
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#2E7D32' },
  effective: { fontSize: 12, color: '#999', marginTop: 6 },
  intro: { fontSize: 14, color: '#444', lineHeight: 23, marginTop: 14 },
  section: { marginTop: 22 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#2E7D32', marginBottom: 8 },
  para: { fontSize: 14, color: '#444', lineHeight: 23, marginBottom: 10 },
});
