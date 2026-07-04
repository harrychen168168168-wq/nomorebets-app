// 诊断问卷（14 题）+ 依赖评分。见 PAYWALL_FLOW_DESIGN.md §2。
// 纯数据 + 纯函数；UI 在 components/onboarding/QuizStep.tsx，结果计算在 ResultsStep.tsx 里调用。

export type QuizAnswerValue = string | string[];
export type QuizAnswers = Record<string, QuizAnswerValue>;

export type QuizOption = { value: string; label: string };
export type QuizQuestion = {
  id: string;
  screen: 1 | 2 | 3;
  type: 'single' | 'multi' | 'free';
  title: string;
  options?: QuizOption[];
  placeholder?: string;
  optional?: boolean; // 自由填写默认可留空，不挡「继续」
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // ── 屏 1：行为/数据 ──
  {
    id: 'duration', screen: 1, type: 'single', title: '你赌了多久了？',
    options: [
      { value: 'lt1', label: '不到 1 年' },
      { value: '1to3', label: '1–3 年' },
      { value: '3to10', label: '3–10 年' },
      { value: 'gt10', label: '超过 10 年' },
    ],
  },
  {
    id: 'type', screen: 1, type: 'single', title: '主要是哪一种？',
    options: [
      { value: 'casino', label: '赌场' },
      { value: 'online', label: '线上赌场' },
      { value: 'sports', label: '体育博彩' },
      { value: 'lottery', label: '彩票' },
      { value: 'cards', label: '棋牌 / 麻将' },
      { value: 'trading', label: '交易式赌博' },
      { value: 'other', label: '其他' },
    ],
  },
  {
    id: 'frequency', screen: 1, type: 'single', title: '最近半年，多久赌一次？',
    options: [
      { value: 'daily', label: '几乎每天' },
      { value: 'weekly_several', label: '每周几次' },
      { value: 'weekly', label: '每周一次' },
      { value: 'monthly', label: '一个月几次' },
    ],
  },
  {
    id: 'monthlyLoss', screen: 1, type: 'single', title: '平均每个月，大概输多少？',
    options: [
      { value: 'lt500', label: '$500 以下' },
      { value: '500_2000', label: '$500 – 2,000' },
      { value: '2000_5000', label: '$2,000 – 5,000' },
      { value: '5000_10000', label: '$5,000 – 10,000' },
      { value: 'gt10000', label: '$10,000 以上' },
    ],
  },
  {
    id: 'borrowing', screen: 1, type: 'single', title: '有没有为了赌借过钱？',
    options: [
      { value: 'never', label: '从来没有' },
      { value: 'once_twice', label: '有过一两次' },
      { value: 'often', label: '经常' },
      { value: 'in_debt', label: '现在还背着赌债' },
    ],
  },

  // ── 屏 2：债务 + 触发 + Lie/Bet 量表 ──
  {
    id: 'debtPayoff', screen: 2, type: 'single', title: '现在的赌债，靠正常收入要还多久？',
    options: [
      { value: 'none', label: '没有赌债' },
      { value: 'months', label: '几个月' },
      { value: 'years', label: '一两年' },
      { value: 'cant', label: '不敢算' },
    ],
  },
  {
    id: 'triggers', screen: 2, type: 'multi', title: '什么时候最容易想赌？（可多选）',
    options: [
      { value: 'night', label: '夜深人静' },
      { value: 'payday', label: '发工资那几天' },
      { value: 'weekend', label: '周末没事' },
      { value: 'passby', label: '路过赌场' },
      { value: 'lowmood', label: '心情不好' },
      { value: 'friends', label: '朋友约' },
    ],
  },
  {
    id: 'chasing', screen: 2, type: 'single', title: '上次赢钱之后，你是收手了，还是继续赌到输光？',
    options: [
      { value: 'stopped', label: '收手了' },
      { value: 'till_broke', label: '继续赌到输光' },
      { value: 'unsure', label: '记不清了' },
    ],
  },
  {
    id: 'hide', screen: 2, type: 'single', title: '你有没有对家人隐瞒过你到底赌了多少？',
    options: [
      { value: 'yes', label: '有' },
      { value: 'no', label: '没有' },
    ],
  },
  {
    id: 'tolerance', screen: 2, type: 'single', title: '你是不是要赌越来越大的金额才够刺激？',
    options: [
      { value: 'yes', label: '是' },
      { value: 'no', label: '不是' },
    ],
  },

  // ── 屏 3：情绪 / 身份 ──
  {
    id: 'impact', screen: 3, type: 'multi', title: '赌博已经影响到了哪些？（可多选）',
    options: [
      { value: 'savings', label: '存款见底' },
      { value: 'debt', label: '背上债务' },
      { value: 'marriage', label: '夫妻关系' },
      { value: 'children', label: '孩子' },
      { value: 'work', label: '工作' },
      { value: 'sleep', label: '睡眠' },
      { value: 'selfworth', label: '看不起自己' },
    ],
  },
  {
    id: 'regret', screen: 3, type: 'free', optional: true,
    title: '赌博让你失去过什么、到现在都后悔？',
    placeholder: '写下来，只有你自己看得到…',
  },
  {
    id: 'rockBottom', screen: 3, type: 'single',
    title: '你有过"这次真的不能再这样下去了"的时刻吗？',
    options: [
      { value: 'now', label: '有，就是现在' },
      { value: 'several', label: '有过好几次' },
      { value: 'unsure', label: '说不清' },
    ],
  },
  {
    id: 'motivation', screen: 3, type: 'free', optional: true,
    title: '如果戒成了，你最想把钱花在谁身上？最想听到谁对你说什么？',
    placeholder: '例如：孩子的学费；想听爱人说一句「你变回来了」…',
  },
];

export function quizScreens(): QuizQuestion[][] {
  return [1, 2, 3].map((s) => QUIZ_QUESTIONS.filter((q) => q.screen === s));
}

// 一屏是否答完（自由题可留空；单选要有值；多选至少选一个）
export function isScreenComplete(screen: 1 | 2 | 3, answers: QuizAnswers): boolean {
  return QUIZ_QUESTIONS.filter((q) => q.screen === screen).every((q) => {
    if (q.optional || q.type === 'free') return true;
    const v = answers[q.id];
    if (q.type === 'multi') return Array.isArray(v) && v.length > 0;
    return typeof v === 'string' && v.length > 0;
  });
}

const MONTHLY_LOSS_MIDPOINTS: Record<string, number> = {
  lt500: 250,
  '500_2000': 1250,
  '2000_5000': 3500,
  '5000_10000': 7500,
  gt10000: 12000,
};

// 用户填的月损失区间取中值，喂省钱计数器和付费墙文案。默认 0。
export function monthlyLossFromAnswer(answers: QuizAnswers): number {
  const v = answers.monthlyLoss;
  return typeof v === 'string' ? MONTHLY_LOSS_MIDPOINTS[v] || 0 : 0;
}

const SCORE_WEIGHTS: Record<string, Record<string, number>> = {
  duration: { lt1: 0, '1to3': 1, '3to10': 2, gt10: 3 },
  frequency: { monthly: 0, weekly: 1, weekly_several: 2, daily: 3 },
  borrowing: { never: 0, once_twice: 1, often: 2, in_debt: 3 },
  debtPayoff: { none: 0, months: 1, years: 2, cant: 3 },
  chasing: { stopped: 0, unsure: 1, till_broke: 2 },
  hide: { no: 0, yes: 2 },
  tolerance: { no: 0, yes: 2 },
};

export type DependenceResult = { score: number; dots: number; label: string };

// 依赖程度 1–5 点。加权行为题 + Lie/Bet + 影响面数量。最低给 2（能下载戒赌 App 说明已需警惕）。
export function scoreDependence(answers: QuizAnswers): DependenceResult {
  let score = 0;
  for (const [id, table] of Object.entries(SCORE_WEIGHTS)) {
    const v = answers[id];
    if (typeof v === 'string') score += table[v] || 0;
  }
  const impact = answers.impact;
  if (Array.isArray(impact)) score += Math.min(3, impact.length * 0.5);

  let dots: number;
  if (score < 4) dots = 2;
  else if (score < 8) dots = 3;
  else if (score < 13) dots = 4;
  else dots = 5;

  const label = dots >= 5 ? '严重依赖' : dots === 4 ? '较重' : dots === 3 ? '偏重' : '需要警惕';
  return { score, dots, label };
}
