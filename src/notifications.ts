import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getCurrentUserName, loadData, saveData } from './storage';

// Local high-risk-time reminders — fully on-device, NO push server / APNs.
// Research gap #1 for this category is proactive trigger-time intervention: a gentle nudge at
// the moments relapse is most likely (late night, weekends, payday) when willpower is lowest.
// We re-schedule on every app open (cancel all -> rebuild from settings) so the rolling payday
// window stays fresh and time/day changes take effect immediately.

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
];

const NIGHTLY_MESSAGES = [
  '夜深了，这是一天里最容易冲动的时刻。打开 App，记录今天，给自己一句承诺。',
  '又守住了一天。睡前对自己说一句“今天我没有去赌”，明天会轻一点。',
  '安静的夜里冲动最容易出现。需要的话，先做一次深呼吸，或者打给重要的人。',
  '今晚的你，正在为家人和未来的自己存下一点东西。晚安。',
];

const WEEKEND_MESSAGES = [
  '周末来了，空闲和聚会最容易勾起冲动。提前想好今晚怎么过，比临时硬扛更稳。',
  '高风险时段提醒：如果今晚有冲动，先打开“冲动”页，别一个人扛。',
  '周末是很多人最难的时候。你已经走到这里了，今晚也一样可以守住。',
];

const PAYDAY_MESSAGES = [
  '发薪日到了——钱在手里的时候，是最危险的时刻。先把要存的钱安排好。',
  '今天进账了。提醒自己：这笔钱是给家人和目标的，不是给赌场的。',
  '钱多的时候冲动也会变大。看看“我的目标”，想想你真正想用它做的事。',
];

function pick(list: string[]) {
  return list[Math.floor(Math.random() * list.length)];
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

// Cancel everything and rebuild the schedule from settings. Safe to call on every app open.
export async function syncReminders(settingsInput?: ReminderSettings) {
  if (Platform.OS === 'web') return;
  const settings = settingsInput ?? (await getReminderSettings());
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.enabled) return;
  if (!(await getPermissionGranted())) return;

  if (settings.morningEnabled) {
    await Notifications.scheduleNotificationAsync({
      content: { title: '早安 ☀️', body: pick(MORNING_MESSAGES), sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: clampHour(settings.morningHour), minute: 0 },
    });
  }

  if (settings.nightlyEnabled) {
    await Notifications.scheduleNotificationAsync({
      content: { title: '今晚，守住自己 🌙', body: pick(NIGHTLY_MESSAGES), sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: clampHour(settings.nightlyHour), minute: 0 },
    });
  }

  if (settings.weekendEnabled) {
    // weekday: 1 = Sunday ... 6 = Friday, 7 = Saturday
    for (const weekday of [6, 7]) {
      await Notifications.scheduleNotificationAsync({
        content: { title: '周末高风险时段 🛡️', body: pick(WEEKEND_MESSAGES), sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: clampHour(settings.weekendHour), minute: 0 },
      });
    }
  }

  if (settings.paydayEnabled) {
    for (const date of nextPaydayDates(settings.paydayDay, clampHour(settings.paydayHour))) {
      await Notifications.scheduleNotificationAsync({
        content: { title: '发薪日，钱在手里时最危险 💰', body: pick(PAYDAY_MESSAGES), sound: true },
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
