import { ADMIN_FUNCTION_SECRET_FOR_LOCAL_TESTS, SUPABASE_ANON_KEY, SUPABASE_FUNCTIONS_URL, SUPABASE_URL } from './config';
import { calculateStats, DailyRecord, getTodayString } from './storage';
import { CompanionStory, GamblingType, getDailyAiCompanionStories } from './storyTemplates';

export type PublicStoryStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'hidden' | 'deleted';
export type DisplayMode = 'anonymous' | 'nickname' | 'ai' | 'system';
export type ReportReason = 'gambling_ad' | 'gambling_trigger' | 'abuse' | 'scam' | 'privacy' | 'self_harm' | 'sexual_violence' | 'other';
export type GuardianRelationshipType = 'family' | 'mutual';
export type GuardianRole = 'payer_guardian' | 'protected_user' | 'peer';

export type PublicStory = CompanionStory & {
  id: string;
  sourceRecordDate?: string;
  authorUserId?: string;
  displayMode: DisplayMode;
  displayName: string;
  status: PublicStoryStatus;
  source: 'user' | 'ai' | 'system';
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
};

export type StoryReport = {
  id: string;
  storyId: string;
  reporterUserId: string;
  reason: ReportReason;
  detail?: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
};

export type InviteLink = {
  id: string;
  code: string;
  ownerUserId: string;
  type: GuardianRelationshipType;
  status: 'active' | 'accepted' | 'cancelled' | 'expired';
  expiresAt?: string;
  createdAt: string;
};

export type GuardianLink = {
  id: string;
  type: GuardianRelationshipType;
  ownerUserId: string;
  memberUserId: string;
  status: 'active' | 'cancelled';
  shareMood: boolean;
  shareImpulse: boolean;
  shareTodayStatus: boolean;
  shareStreak: boolean;
  shareEmergency: boolean;
  createdAt: string;
  cancelledAt?: string;
};

export const ENCOURAGEMENTS = ['我懂你', '一起坚持', '谢谢你', '这句话帮到我', '今天我也撑住'];

export function isCommunityConfigured() {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

function mapStory(row: any): PublicStory {
  return {
    id: String(row.id),
    sourceRecordDate: row.source_record_date || undefined,
    authorUserId: row.author_user_id || undefined,
    displayMode: row.display_mode || 'anonymous',
    displayName: row.display_name || '匿名用户',
    gamblingType: row.gambling_type || 'casino',
    title: row.title || '今天也有人在坚持',
    excerpt: row.excerpt || '',
    body: row.body || row.excerpt || '',
    status: row.status || 'pending',
    source: row.source || 'user',
    createdAt: row.created_at || new Date().toISOString(),
    publishedAt: row.published_at || undefined,
    reviewedAt: row.reviewed_at || undefined,
    reviewedBy: row.reviewed_by || undefined,
    rejectionReason: row.rejection_reason || undefined,
  };
}

async function supabase(path: string, init: RequestInit = {}) {
  if (!isCommunityConfigured()) throw new Error('Supabase 还没有配置。');
  const response = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.error || 'Supabase 请求失败。');
  return data;
}

function functionsBaseUrl() {
  if (SUPABASE_FUNCTIONS_URL) return SUPABASE_FUNCTIONS_URL.replace(/\/$/, '');
  if (!SUPABASE_URL) return '';
  return SUPABASE_URL.replace(/\/$/, '').replace('.supabase.co', '.functions.supabase.co');
}

async function callFunction(name: string, body: Record<string, unknown>, admin = false) {
  if (!isCommunityConfigured()) throw new Error('Supabase 还没有配置。');
  const base = functionsBaseUrl();
  if (!base) throw new Error('Supabase Functions URL 还没有配置。');
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  if (admin && ADMIN_FUNCTION_SECRET_FOR_LOCAL_TESTS) headers['x-admin-secret'] = ADMIN_FUNCTION_SECRET_FOR_LOCAL_TESTS;
  const response = await fetch(base + '/' + name, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || data?.message || '后端函数请求失败。');
  return data;
}

export async function listApprovedStories(limit = 20): Promise<PublicStory[]> {
  if (!isCommunityConfigured()) return [];
  const rows = await supabase(
    'public_stories?select=*&status=eq.approved&source=eq.user&order=published_at.desc.nullslast,created_at.desc&limit=' + limit
  );
  return Array.isArray(rows) ? rows.map(mapStory) : [];
}

export async function listHomeCompanionStories(limit = 6): Promise<PublicStory[]> {
  const userStories = await listApprovedStories(limit).catch(() => []);
  const aiStories = getDailyAiCompanionStories(getTodayString(), 3);
  return [...userStories, ...aiStories].slice(0, limit) as PublicStory[];
}

export async function submitPublicStory(story: {
  sourceRecordDate?: string;
  authorUserId: string;
  displayMode: 'anonymous' | 'nickname';
  displayName: string;
  gamblingType: GamblingType;
  title: string;
  excerpt: string;
  body: string;
}) {
  if (containsSelfHarm(story.body) || containsSelfHarm(story.title)) {
    throw new Error('self_harm_blocked');
  }
  const row = {
    source_record_date: story.sourceRecordDate,
    author_user_id: story.authorUserId,
    display_mode: story.displayMode,
    display_name: story.displayMode === 'anonymous' ? '匿名用户' : story.displayName,
    gambling_type: story.gamblingType,
    title: story.title,
    excerpt: story.excerpt,
    body: story.body,
    status: 'pending',
    source: 'user',
  };
  // return=minimal: the anon SELECT policy only exposes approved stories, so we cannot read a
  // freshly inserted pending row back. Requesting the representation would fail the RLS check.
  await supabase('public_stories', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
  return mapStory(row);
}

export async function reactToStory(storyId: string, userId: string, reaction: string) {
  // De-duplicate: one (story, user, reaction) row only, so repeated taps don't inflate counts.
  await supabase('story_reactions?on_conflict=story_id,user_id,reaction', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ story_id: storyId, user_id: userId, reaction }),
  });
}

export async function reportStory(storyId: string, reporterUserId: string, reason: ReportReason, detail = '') {
  await supabase('story_reports', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ story_id: storyId, reporter_user_id: reporterUserId, reason, detail, status: 'open' }),
  });
}

export async function listPendingStories() {
  const data = await callFunction('community-admin', { action: 'listPendingStories' }, true);
  const rows = data.stories;
  return Array.isArray(rows) ? rows.map(mapStory) : [];
}

export async function listOpenReports() {
  const data = await callFunction('community-admin', { action: 'listOpenReports' }, true);
  const rows = data.reports;
  return Array.isArray(rows) ? rows : [];
}

export async function moderateStory(storyId: string, status: 'approved' | 'rejected' | 'hidden' | 'deleted', adminUserId: string, reason = '') {
  await callFunction('community-admin', { action: 'moderateStory', storyId, status, adminUserId, reason }, true);
}

export async function resolveReport(reportId: string, adminUserId: string, status: 'resolved' | 'dismissed') {
  await callFunction('community-admin', { action: 'resolveReport', reportId, status, adminUserId }, true);
}

export type SanctionLevel = 'warning' | 'mute_7d' | 'mute_30d' | 'blocked';

export async function sanctionUser(userId: string, level: SanctionLevel, reason: string, adminUserId: string) {
  await callFunction('community-admin', { action: 'sanctionUser', userId, level, reason, adminUserId }, true);
}

export async function createGuardianInvite(ownerUserId: string, type: GuardianRelationshipType) {
  const data = await callFunction('guardian', { action: 'createInvite', userId: ownerUserId, type });
  return data.invite as InviteLink;
}

export async function acceptGuardianInvite(code: string, memberUserId: string) {
  await callFunction('guardian', { action: 'acceptInvite', userId: memberUserId, code });
}

function mapLinkRow(row: any): GuardianLink {
  return {
    id: row.id,
    type: row.type,
    ownerUserId: row.owner_user_id,
    memberUserId: row.member_user_id,
    status: row.status,
    shareMood: !!row.share_mood,
    shareImpulse: !!row.share_impulse,
    shareTodayStatus: !!row.share_today_status,
    shareStreak: !!row.share_streak,
    shareEmergency: !!row.share_emergency,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
  };
}

export async function listGuardianLinks(userId: string): Promise<GuardianLink[]> {
  if (!isCommunityConfigured()) return [];
  const data = await callFunction('guardian', { action: 'listLinks', userId });
  const rows = data.links;
  return Array.isArray(rows) ? rows.map(mapLinkRow) : [];
}

export type SharedStatus = {
  todayDate?: string | null;
  todayRecorded?: boolean | null;
  todayHighRisk?: boolean | null;
  mood?: string | null;
  impulse?: number | null;
  streak?: number | null;
  longestStreak?: number | null;
  updatedAt?: string | null;
};

export type LinkedStatus = {
  link: GuardianLink;
  viewable: boolean;
  status: SharedStatus | null;
};

// Push only the shareable summary of the current user's recovery status to the backend so that
// linked guardians can see it. Never sends note text, money amounts, location, or contacts.
export async function pushMyGuardianStatus(userId: string) {
  if (!isCommunityConfigured() || !userId) return;
  const stats = await calculateStats();
  await callFunction('guardian', {
    action: 'pushStatus',
    userId,
    status: {
      todayDate: getTodayString(),
      todayRecorded: stats.todayChecked,
      todayHighRisk: stats.todayGambled,
      mood: stats.todayRecord?.mood || '',
      impulse: stats.todayRecord?.impulse || 0,
      streak: stats.streak,
      longestStreak: stats.longestStreak,
    },
  });
}

export async function listLinkedStatuses(userId: string): Promise<LinkedStatus[]> {
  if (!isCommunityConfigured() || !userId) return [];
  const data = await callFunction('guardian', { action: 'getLinkedStatus', userId });
  const rows = data.statuses;
  return Array.isArray(rows)
    ? rows.map((row: any) => ({ link: mapLinkRow(row.link), viewable: !!row.viewable, status: row.status || null }))
    : [];
}

export async function cancelGuardianLink(linkId: string, actorUserId: string, otherUserId: string) {
  await callFunction('guardian', { action: 'cancelLink', userId: actorUserId, linkId, otherUserId });
}

const SELF_HARM_KEYWORDS = [
  '自杀', '不想活', '活不下去', '伤害自己', '杀了自己', '结束生命', '想死', '轻生',
  'suicide', 'kill myself', 'end my life', 'self harm', 'self-harm',
];

// Crisis/self-harm content must not be turned into a public story. Used to block submission and
// route the user to emergency help instead (see App Store UGC guideline 1.2 + crisis handling).
export function containsSelfHarm(text: string) {
  const lower = String(text || '').toLowerCase();
  return SELF_HARM_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
}

export function buildStoryDraftFromRecord(record: DailyRecord) {
  const title = record.gambled ? '我看清了一次高风险信号' : '今天我没有走进赌场';
  const trigger = record.note.trim() || (record.gambled ? '今天出现了很强的冲动，我开始看清自己最容易失控的时刻。' : '今天有过冲动，但我把自己从那个方向拉了回来。');
  const body = record.gambled
    ? '今天发生了一次高风险行为。' + trigger + ' 这不是结局，而是一个需要认真看清的信号。下一次，我要更早离开环境，把钱和路线提前安排好。'
    : trigger + ' 我没有把今天交给赌场。对我来说，撑过这一刻就是一次真正的改变。下一次冲动来时，我会继续先离开触发环境，联系一个可信的人。';
  return {
    title,
    excerpt: body.slice(0, 90),
    body,
    gamblingType: 'casino' as GamblingType,
  };
}
