import AsyncStorage from '@react-native-async-storage/async-storage';

const CURRENT_USER_KEY = 'auth.currentUser';

const KEYS = {
  STREAK: 'streak',
  LONGEST_STREAK: 'longestStreak',
  MONTHLY_DAYS: 'monthlyDays',
  MONTHLY_LOSS: 'monthlyLoss',
  LAST_CHECKIN_DATE: 'lastCheckinDate',
  LAST_CHECKIN_TYPE: 'lastCheckinType',
  QUIT_START_DATE: 'quitStartDate',
  WALKED_DATE: 'walkedDate',
  ACCOMPANIED_DATE: 'accompaniedDate',
  LAST_MONTH_RESET: 'lastMonthReset',
  DAILY_RECORDS: 'dailyRecords',
};

const APP_DATA_KEYS = [
  ...Object.values(KEYS),
  'importantContacts',
  'myGoals',
  'whyQuit',
  'futureLetter',
  'myStory',
  'myStoryName',
  'myStories',
];

export type DailyRecord = {
  date: string;
  gambled: boolean;
  mood: string;
  impulse: number;
  note: string;
  location: string;
  gameType: string;
  result: 'win' | 'lose' | 'break_even' | '';
  amount: number;
};

async function getCurrentUserId() {
  const raw = await AsyncStorage.getItem(CURRENT_USER_KEY);
  if (!raw) return 'signed_out';
  try {
    const parsed = JSON.parse(raw);
    return String(parsed?.id || 'signed_out').replace(/[^a-zA-Z0-9_.-]/g, '_');
  } catch {
    return 'signed_out';
  }
}

async function scopedKey(key: string) {
  const userId = await getCurrentUserId();
  return 'user.' + userId + '.' + key;
}

async function getScopedItem(key: string) {
  return AsyncStorage.getItem(await scopedKey(key));
}

async function setScopedItem(key: string, value: string) {
  await AsyncStorage.setItem(await scopedKey(key), value);
}

async function removeScopedItems(keys: string[]) {
  const scopedKeys = await Promise.all(keys.map((key) => scopedKey(key)));
  await AsyncStorage.multiRemove(scopedKeys);
}

async function scopedMultiSet(entries: [string, string][]) {
  const scopedEntries = await Promise.all(entries.map(async ([key, value]) => [await scopedKey(key), value] as [string, string]));
  await AsyncStorage.multiSet(scopedEntries);
}

export function getTodayString() {
  return getLocalDateString(new Date());
}

export function getLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function addDays(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

function normalizeRecord(record: Partial<DailyRecord> & { date: string }): DailyRecord {
  return {
    date: record.date,
    gambled: !!record.gambled,
    mood: record.mood ?? '',
    impulse: Number(record.impulse) || 0,
    note: record.note ?? '',
    location: record.gambled ? record.location ?? '' : '',
    gameType: record.gambled ? record.gameType ?? '' : '',
    result: record.gambled ? record.result ?? '' : '',
    amount: record.gambled && record.result === 'lose' ? Number(record.amount) || 0 : 0,
  };
}

export async function saveData(key: string, value: string) {
  await setScopedItem(key, value);
}

export async function loadData(key: string): Promise<string | null> {
  return getScopedItem(key);
}

export async function readDailyRecords(): Promise<DailyRecord[]> {
  const raw = await getScopedItem(KEYS.DAILY_RECORDS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.date)
      .map((item) => normalizeRecord(item))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export async function writeDailyRecords(records: DailyRecord[]) {
  const normalized = records
    .filter((item) => item.date)
    .map((item) => normalizeRecord(item))
    .sort((a, b) => b.date.localeCompare(a.date));
  await setScopedItem(KEYS.DAILY_RECORDS, JSON.stringify(normalized));
  await syncAppStateFromRecords(normalized);
  return normalized;
}

export async function upsertDailyRecord(record: DailyRecord) {
  const existing = await readDailyRecords();
  const filtered = existing.filter((item) => item.date !== record.date);
  return writeDailyRecords([normalizeRecord(record), ...filtered]);
}

export async function deleteDailyRecord(date: string) {
  const existing = await readDailyRecords();
  return writeDailyRecords(existing.filter((item) => item.date !== date));
}

async function getStoredLongest() {
  const stored = await getScopedItem(KEYS.LONGEST_STREAK);
  return Number(stored) || 0;
}

export async function calculateStats(recordsInput?: DailyRecord[]) {
  const records = recordsInput ?? await readDailyRecords();
  const today = getTodayString();
  const currentMonth = today.slice(0, 7);
  const recordMap = new Map(records.map((record) => [record.date, record]));

  const monthlyDays = records.filter((record) => record.date.startsWith(currentMonth) && !record.gambled).length;
  const monthlyLoss = records
    .filter((record) => record.date.startsWith(currentMonth) && record.gambled && record.result === 'lose')
    .reduce((sum, record) => sum + (Number(record.amount) || 0), 0);

  let streak = 0;
  let cursor = today;
  while (true) {
    const record = recordMap.get(cursor);
    if (record && !record.gambled) {
      streak += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    if (!record && cursor === today) {
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }

  let longestFromRecords = 0;
  let running = 0;
  const ascending = [...records].sort((a, b) => a.date.localeCompare(b.date));
  let previousDate = '';
  for (const record of ascending) {
    const continuous = previousDate === '' || addDays(previousDate, 1) === record.date;
    if (!continuous) running = 0;
    if (!record.gambled) {
      running += 1;
      longestFromRecords = Math.max(longestFromRecords, running);
    } else {
      running = 0;
    }
    previousDate = record.date;
  }

  const storedLongest = await getStoredLongest();
  const longestStreak = Math.max(storedLongest, longestFromRecords, streak);
  const todayRecord = recordMap.get(today);

  return { streak, longestStreak, monthlyDays, monthlyLoss, todayChecked: !!todayRecord, todayGambled: !!todayRecord?.gambled, todayRecord };
}

export async function syncAppStateFromRecords(recordsInput?: DailyRecord[]) {
  const records = recordsInput ?? await readDailyRecords();
  const stats = await calculateStats(records);
  const today = getTodayString();
  const currentMonth = today.slice(0, 7);
  const todayRecord = stats.todayRecord;

  const entries: [string, string][] = [
    [KEYS.STREAK, String(stats.streak)],
    [KEYS.LONGEST_STREAK, String(stats.longestStreak)],
    [KEYS.MONTHLY_DAYS, String(stats.monthlyDays)],
    [KEYS.MONTHLY_LOSS, String(stats.monthlyLoss)],
    [KEYS.LAST_MONTH_RESET, currentMonth],
  ];

  if (todayRecord) {
    entries.push([KEYS.LAST_CHECKIN_DATE, today]);
    entries.push([KEYS.LAST_CHECKIN_TYPE, todayRecord.gambled ? 'relapse' : 'no_gamble']);
  }

  await scopedMultiSet(entries);
  if (!todayRecord) await removeScopedItems([KEYS.LAST_CHECKIN_DATE, KEYS.LAST_CHECKIN_TYPE]);
  return stats;
}

export async function loadAppState() {
  const today = getTodayString();
  const [quitStartDate, walkedDate, accompaniedDate, records] = await Promise.all([
    getScopedItem(KEYS.QUIT_START_DATE),
    getScopedItem(KEYS.WALKED_DATE),
    getScopedItem(KEYS.ACCOMPANIED_DATE),
    readDailyRecords(),
  ]);
  const stats = await syncAppStateFromRecords(records);

  return {
    streak: stats.streak,
    longestStreak: stats.longestStreak,
    monthlyDays: stats.monthlyDays,
    monthlyLoss: stats.monthlyLoss,
    todayChecked: stats.todayChecked,
    todayGambled: stats.todayGambled,
    walkedToday: walkedDate === today,
    accompaniedToday: accompaniedDate === today,
    quitStartDate: quitStartDate || today,
  };
}

export async function checkInNoGamble() {
  const today = getTodayString();
  const existing = (await readDailyRecords()).find((record) => record.date === today);
  const updatedRecord = normalizeRecord({ ...existing, date: today, gambled: false, result: '', amount: 0 });
  const updated = await upsertDailyRecord(updatedRecord);
  const stats = await calculateStats(updated);
  return { newStreak: stats.streak, newLongest: stats.longestStreak, newMonthlyDays: stats.monthlyDays };
}

export async function checkInRelapse() {
  const today = getTodayString();
  const existing = (await readDailyRecords()).find((record) => record.date === today);
  await upsertDailyRecord(normalizeRecord({ ...existing, date: today, gambled: true, result: existing?.result || '' }));
}

export async function completeWalk() {
  await setScopedItem(KEYS.WALKED_DATE, getTodayString());
}

export async function completeAccompany() {
  await setScopedItem(KEYS.ACCOMPANIED_DATE, getTodayString());
}

export async function updateMonthlyLoss(amount: number) {
  await setScopedItem(KEYS.MONTHLY_LOSS, String(amount));
}

export async function resetAllData() {
  await removeScopedItems(APP_DATA_KEYS);
}

export async function calcMonthlyLoss(): Promise<number> {
  const stats = await calculateStats();
  return stats.monthlyLoss;
}
