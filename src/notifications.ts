import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getCurrentUserName, loadData, saveData } from './storage';

// Local high-risk-time reminders — fully on-device, NO push server / APNs.
// Research gap #1 for this category is proactive trigger-time intervention: a gentle nudge at
// the moments relapse is most likely (late night, weekends, payday) when willpower is lowest.
// Morning/nightly/weekend are scheduled as one-shot DATE notifications for the next 14 days,
// rotating through the message pools by calendar day — so every day shows a different line even
// if the app is never opened. Each app open re-schedules (cancel all -> rebuild), which rolls the
// 14-day window forward and applies any settings changes immediately.

export type ReminderSettings = {
  enabled: boolean;
  morningEnabled: boolean;
  morningHour: number; // 0-23
  nightlyEnabled: boolean;
  nightlyHour: number; // 0-23
  weekendEnabled: boolean;
  weekendHour: number; // 0-23
  paydayEnabled: boolean;
  paydayDay: number; // 1-31 (clamped to month length)
  paydayHour: number; // 0-23
  birthdayEnabled: boolean;
};

const REMINDER_KEY = 'reminderSettings';
const PAYDAY_MONTHS_AHEAD = 6;

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  // Default ON for retention — the daily nudge is the single biggest thing that keeps a habit app
  // alive. Permission is requested at onboarding; without it syncReminders schedules nothing.
  enabled: true,
  morningEnabled: true,
  morningHour: 9,
  nightlyEnabled: true,
  nightlyHour: 21,
  weekendEnabled: true,
  weekendHour: 20,
  paydayEnabled: false,
  paydayDay: 15,
  paydayHour: 10,
  birthdayEnabled: true,
};

const MORNING_MESSAGES = [
  '早安。新的一天开始了，昨天的你已经很努力，今天也慢慢来。',
  '早上好。先给自己倒杯水，深呼吸一下。今天你依然可以守住自己。',
  '新的一天。你不需要一次赢下整场，只要过好今天这一天就够了。',
  '早安。想想你真正想守护的人和事，让它陪你度过今天。',
  '起床了。又是不赌的一天的开始，为决定这样过日子的你骄傲。',
  '早安。今天只做一件事：把今天过好。别的都可以明天再说。',
  '新的早晨。你省下的每一块钱，都在悄悄变成你想要的生活。',
  '早上好。吃顿好早餐，身体稳了，心就稳一半。',
  '今天醒来，你依然是那个在往回走的人。这件事本身就值得骄傲。',
  '早上好。今天可能有平静，也可能有难关——你都见过，也都撑过。',
  '早安。把今天要做的一件小事想好，忙起来的日子最安全。',
  '新的一天。翻翻你的坚持天数，那个数字是你一天一天挣来的。',
  '早上好。你不是在戒掉什么，你是在把人生一点点拿回来。',
  '早安。今天会路过高风险的地方吗？提前绕一下，离得远，心就轻。',
  '早晨好。给重要的人发句早安吧，你在乎的人也在乎你。',
  '早安。别小看普通的一天，普通的日子就是你赢回来的东西。',
];

const NIGHTLY_MESSAGES = [
  '夜深了，这是一天里最容易冲动的时刻。打开 App，记录今天，给自己一句承诺。',
  '又守住了一天。睡前对自己说一句“今天我没有去赌”，明天会轻一点。',
  '安静的夜里冲动最容易出现。需要的话，先做一次深呼吸，或者打给重要的人。',
  '今晚的你，正在为家人和未来的自己存下一点东西。晚安。',
  '睡前把手机放远一点。夜里的念头，大多熬不过一个好觉。',
  '今天无论过得怎么样，你都走到了晚上。这就够了，晚安。',
  '夜里想东想西很正常。别做决定，先睡觉，明天的你更清醒。',
  '睡前把今天的感受记下来，哪怕一句话。看清自己，才能赢它。',
  '晚安。你今天省下的不只是钱，还有一晚安稳的觉。',
  '睡前想一件今天做得好的小事。你比自己以为的做得好。',
  '夜深了。如果此刻很难，先撑过这十分钟，冲动是会退潮的。',
  '今晚早点睡。疲惫是冲动的帮凶，睡饱的人不好骗。',
  '晚安。明天的你，会感谢今晚稳稳睡下的你。',
  '一天结束了。不管完美不完美，你还在路上，这才最重要。',
  '夜里最安静，也最容易听见旧习惯的声音。听见就好，不必回应。',
  '睡前最后一件事：对自己说声辛苦了。你在走这条路，就很了不起。',
];

const WEEKEND_MESSAGES = [
  '周末来了，空闲和聚会最容易勾起冲动。提前想好今晚怎么过，比临时硬扛更稳。',
  '高风险时段提醒：如果今晚有冲动，先打开“冲动”页，别一个人扛。',
  '周末是很多人最难的时候。你已经走到这里了，今晚也一样可以守住。',
  '周末愉快。把日子排满一点：陪家人、出门走走，别给空虚留位置。',
  '今晚要是有人约局，那句话准备好了吗——“我最近在戒，这次不去了。”',
  '周末出门少带现金，绕开老路线。用环境帮自己，比意志力可靠。',
  '空下来的晚上，做顿好吃的，或看部想看的片子。生活好过了，冲动就弱了。',
  '周末夜是硬仗，但你不是第一次打了。撑过今晚，明天又是新的一天。',
];

const PAYDAY_MESSAGES = [
  '发薪日到了——钱在手里的时候，是最危险的时刻。先把要存的钱安排好。',
  '今天进账了。提醒自己：这笔钱是给家人和目标的，不是给赌场的。',
  '钱多的时候冲动也会变大。看看“我的目标”，想想你真正想用它做的事。',
  '工资到账，先转一部分到安全账户。钱不过夜，冲动无门。',
  '发薪日快乐。这个月的辛苦钱，值得花在让你抬得起头的地方。',
  '今天钱包最满，念头也可能最多。今天不做任何下注决定，就是最好的理财。',
];

// Calendar-day index (local) used to rotate through the message pools: each date deterministically
// gets its own line, consecutive days never repeat, and re-scheduling on app open doesn't reshuffle
// today's message.
function localDayIndex(date: Date) {
  return Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86400000);
}

function clampHour(hour: number) {
  if (!Number.isFinite(hour)) return 21;
  return Math.min(23, Math.max(0, Math.round(hour)));
}

function clampDay(day: number) {
  if (!Number.isFinite(day)) return 15;
  return Math.min(31, Math.max(1, Math.round(day)));
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  const raw = await loadData(REMINDER_KEY);
  if (!raw) return { ...DEFAULT_REMINDER_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_REMINDER_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_REMINDER_SETTINGS };
  }
}

export async function setReminderSettings(settings: ReminderSettings) {
  await saveData(REMINDER_KEY, JSON.stringify(settings));
  await syncReminders(settings);
  return settings;
}

export async function getPermissionGranted(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  return !!current.granted;
}

// Returns true only if we end up with granted permission. Asks the OS prompt when allowed.
export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.status === 'denied' && !current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return !!requested.granted;
}

// Next N monthly paydays after now, as one-shot dates (clamped to each month's last day).
function nextPaydayDates(day: number, hour: number, count = PAYDAY_MONTHS_AHEAD): Date[] {
  const now = new Date();
  const safeDay = clampDay(day);
  const result: Date[] = [];
  for (let offset = 0; offset <= count && result.length < count; offset++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const lastDayOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const target = new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(safeDay, lastDayOfMonth), hour, 0, 0, 0);
    if (target.getTime() > now.getTime()) result.push(target);
  }
  return result;
}

function birthdayMessage(name: string) {
  const who = name ? name + '，' : '';
  return who + '祝你生日快乐 🎂 又陪自己走过了一年。今天，好好爱自己，也为坚持到现在的你骄傲。';
}

// The next occurrence of the user's birthday at 00:00 (this year if still ahead, else next year).
// Scheduled as a one-shot DATE so it survives even if the app is never opened; re-armed each open.
function nextBirthdayDate(birthday?: string | null): Date | null {
  if (!birthday) return null;
  const parts = String(birthday).split('-').map(Number);
  if (parts.length < 3) return null;
  const [, month, day] = parts;
  if (!month || !day) return null;
  const now = new Date();
  let target = new Date(now.getFullYear(), month - 1, day, 0, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target = new Date(now.getFullYear() + 1, month - 1, day, 0, 0, 0, 0);
  return Number.isFinite(target.getTime()) ? target : null;
}

// How many days of morning/nightly/weekend reminders to schedule ahead as individual one-shot
// notifications. 14 days × 2/day + ~4 weekend + 6 payday + 1 birthday ≈ 39 pending — safely under
// iOS's 64-notification cap. Rotating per-date through the pools means every day shows a DIFFERENT
// line even if the app is never opened; each open re-arms the next 14 days.
const DAYS_AHEAD = 14;

// Cancel everything and rebuild the schedule from settings. Safe to call on every app open.
export async function syncReminders(settingsInput?: ReminderSettings) {
  if (Platform.OS === 'web') return;
  const settings = settingsInput ?? (await getReminderSettings());
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.enabled) return;
  if (!(await getPermissionGranted())) return;

  const now = new Date();
  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const rotation = localDayIndex(day);

    if (settings.morningEnabled) {
      const fireAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), clampHour(settings.morningHour), 0, 0, 0);
      if (fireAt.getTime() > now.getTime()) {
        await Notifications.scheduleNotificationAsync({
          content: { title: '早安 ☀️', body: MORNING_MESSAGES[rotation % MORNING_MESSAGES.length], sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
        });
      }
    }

    if (settings.nightlyEnabled) {
      const fireAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), clampHour(settings.nightlyHour), 0, 0, 0);
      if (fireAt.getTime() > now.getTime()) {
        await Notifications.scheduleNotificationAsync({
          content: { title: '今晚，守住自己 🌙', body: NIGHTLY_MESSAGES[rotation % NIGHTLY_MESSAGES.length], sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
        });
      }
    }

    // getDay(): 5 = Friday, 6 = Saturday — the two weekend high-risk evenings.
    if (settings.weekendEnabled && (day.getDay() === 5 || day.getDay() === 6)) {
      const fireAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), clampHour(settings.weekendHour), 0, 0, 0);
      if (fireAt.getTime() > now.getTime()) {
        await Notifications.scheduleNotificationAsync({
          content: { title: '周末高风险时段 🛡️', body: WEEKEND_MESSAGES[rotation % WEEKEND_MESSAGES.length], sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
        });
      }
    }
  }

  if (settings.paydayEnabled) {
    const paydays = nextPaydayDates(settings.paydayDay, clampHour(settings.paydayHour));
    for (const date of paydays) {
      await Notifications.scheduleNotificationAsync({
        content: { title: '发薪日，钱在手里时最危险 💰', body: PAYDAY_MESSAGES[localDayIndex(date) % PAYDAY_MESSAGES.length], sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    }
  }

  if (settings.birthdayEnabled) {
    const birthdayDate = nextBirthdayDate(await loadData('birthday'));
    if (birthdayDate) {
      await Notifications.scheduleNotificationAsync({
        content: { title: '🎂 生日快乐', body: birthdayMessage(await getCurrentUserName()), sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: birthdayDate },
      });
    }
  }
}

export async function cancelAllReminders() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
