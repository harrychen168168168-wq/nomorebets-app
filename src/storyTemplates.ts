import { getTodayString } from './storage';

export type GamblingType = 'casino' | 'online_casino' | 'sports_betting' | 'lottery' | 'cards' | 'trading_impulse' | 'other';

export type CompanionStory = {
  id: string;
  displayName: string;
  displayMode: 'anonymous' | 'nickname' | 'ai' | 'system';
  gamblingType: GamblingType;
  title: string;
  excerpt: string;
  body: string;
  source: 'user' | 'ai' | 'system';
  status: 'approved';
  createdAt: string;
  publishedAt?: string;
  themeId?: string;
  dateKey?: string;
};

const AI_THEMES = [
  {
    id: 'casino-route',
    title: '先不要靠近停车场',
    body: '今天最危险的时刻，可能不是已经开始赌，而是准备转弯去赌场那一分钟。大脑会说“只看一眼”，但以前的经验已经证明，靠近环境就会更难停下。今天先做一件小事：改一条路回家，不进停车场，先撑过这一小时。',
  },
  {
    id: 'payday-cash',
    title: '发工资当天先保护钱',
    body: '发工资当天很容易被“翻本”的念头拉走。钱一到手，冲动会把它说成机会，但真正要守住的是接下来一个月的生活。今天先把一部分钱转到安全账户，或交给家人保管，不带现金靠近赌场。',
  },
  {
    id: 'last-round',
    title: '最后一把通常不是最后',
    body: '“最后一把”听起来像结束，其实常常是继续损失的入口。你不需要靠再赌一次证明自己能停，你现在离开，才是在把选择权拿回来。今天的行动很简单：删除赌博 App，离开触发地点，给可信的人发一句“我需要你陪我一下”。',
  },
  {
    id: 'night-urge',
    title: '夜里的冲动会过去',
    body: '夜里孤单、压力和不甘心会放大想赌的声音。这个声音不等于命令，它只是一个会下降的冲动波。现在先喝水，把银行卡放远，打开灯，等十分钟再决定下一步。',
  },
  {
    id: 'weekend-risk',
    title: '周末先安排出口',
    body: '周末空下来时，赌场会显得更近。不要等冲动来了再硬扛，提前安排一个出口：不带现金出门，约人吃饭，走不会经过赌场的路线。今天不是证明一辈子，只是守住这个周末。',
  },
  {
    id: 'chasing-loss',
    title: '想翻本是危险信号',
    body: '想翻本的时候，大脑会把损失包装成“差一点就回来”。但越想马上补回来，越容易把损失扩大。今天先承认这个信号：我现在处在高风险里。下一步不是下注，是停止继续损失。',
  },
  {
    id: 'ad-trigger',
    title: '看到广告也可以不跟着走',
    body: '赌场广告和平台推送会故意制造“机会感”。你看见它，不代表你必须回应它。现在先把推送关掉，把页面划走，做一个和赌博无关的小动作，让这次触发断在这里。',
  },
  {
    id: 'bored-urge',
    title: '无聊不等于一定要赌',
    body: '空下来的时候，大脑会把赌博当成最快的填充方式。但无聊只是一个信号，说明你需要一点别的东西。现在先给自己安排一件具体的小事：散步、洗澡、给家人发条消息，让这段空白有别的出口。',
  },
  {
    id: 'after-loss',
    title: '输钱后的不甘心最危险',
    body: '刚输完钱时，不甘心会推着你想马上赢回来。这正是损失最容易扩大的时刻。今天先承认：现在的判断不可靠。把卡和现金放远，今天不再做任何下注决定，等情绪平稳再说。',
  },
  {
    id: 'small-win',
    title: '赢了一点更要及时收手',
    body: '赢了一点的时候，大脑会说“手感来了”。但赌场就是靠这种感觉让人留下。真正的赢，是带着这一点离开。今天的行动：现在就停下，把钱收好，去做一件和赌博无关的事。',
  },
  {
    id: 'give-card',
    title: '把银行卡交给信任的人',
    body: '靠意志力硬扛很累，也不稳。给冲动设一道物理障碍会更有效。今天可以做一件实在的事：把主要银行卡或现金交给家人保管，让“想赌也拿不到钱”替你挡住最冲动的那一刻。',
  },
  {
    id: 'delete-app',
    title: '先删掉赌博 App',
    body: '手机里留着赌博 App，等于把入口一直开着。删掉它不代表你软弱，而是减少一次次被勾起的机会。今天先卸载相关 App，退出账号，关掉相关推送，让触发变难一点。',
  },
  {
    id: 'no-cash',
    title: '出门先不带现金',
    body: '冲动来的时候，手边有没有钱，往往决定了结果。今天出门前先做一个小决定：不带现金，少带一张卡。等你回到安全的状态，再去想钱的事。先用环境帮自己一把。',
  },
  {
    id: 'friend-invite',
    title: '朋友约去赌场可以拒绝',
    body: '被朋友拉着去赌场时，很难当场说不。可以提前准备一句话：“我最近在戒，这次不去了。”真正的朋友会理解。今天先想好怎么婉拒，或者改约一个不在赌场的活动。',
  },
  {
    id: 'holiday-risk',
    title: '节假日提前做好准备',
    body: '节假日时间多、情绪起伏大，是高风险时段。不要等冲动来了再扛，提前安排：把日子排满一点，约人陪伴，避开会经过赌场的路线。今天先为接下来的假期准备一个出口。',
  },
  {
    id: 'parking-lot',
    title: '不进停车场就先赢了一半',
    body: '很多次复赌，都是从“只是去停车场坐一下”开始的。靠近就更难离开。今天给自己定一条线：不进停车场，不靠近入口。把车开走，或者干脆换一条路，先守住这条边界。',
  },
  {
    id: 'mood-low',
    title: '心情差时先照顾情绪',
    body: '心情低落时，赌博像是一种逃避，但它只会让之后更沉。你需要的不是赌，是被照顾。今天先做一件对自己温柔的小事：喝点热的，联系一个让你安心的人，把这段难受先撑过去。',
  },
];

const COMPANION_NICKNAMES = [
  '阿俊', '老陈', '想回家的人', '重新开始', '一步一步来', '为了孩子戒', '不再翻本',
  '江边慢跑', '早睡的老王', '戒赌的阿明', '守住这个月', '阿强', '换条路回家', '老周',
  '每天进步一点', '小林', '撑过今晚',
];

function hashDate(dateKey: string) {
  let value = 0;
  for (let i = 0; i < dateKey.length; i += 1) value = (value * 31 + dateKey.charCodeAt(i)) % 9973;
  return value;
}

export function getDailyAiCompanionStories(dateKey = getTodayString(), count = 3): CompanionStory[] {
  const start = hashDate(dateKey) % AI_THEMES.length;
  return Array.from({ length: Math.min(count, AI_THEMES.length) }, (_, index) => {
    const themeIndex = (start + index * 2) % AI_THEMES.length;
    const theme = AI_THEMES[themeIndex];
    return {
      id: 'ai-' + dateKey + '-' + theme.id,
      displayName: COMPANION_NICKNAMES[themeIndex % COMPANION_NICKNAMES.length],
      displayMode: 'ai',
      gamblingType: 'casino',
      title: theme.title,
      excerpt: theme.body.slice(0, 86),
      body: theme.body,
      source: 'ai',
      status: 'approved',
      createdAt: dateKey,
      publishedAt: dateKey,
      themeId: theme.id,
      dateKey,
    };
  });
}

// Seeded, developer-written example recovery stories that populate the story wall when there are
// not yet enough approved real-user stories. These are composite scenarios, NOT real identifiable
// users, and are disclosed as example content in the App Store review notes. Shown anonymously.
const WALL_SEED_STORIES: { gamblingType: GamblingType; title: string; body: string }[] = [
  { gamblingType: 'casino', title: '我在停车场坐了两个小时', body: '那天我准备把最后一点钱拿去翻本。坐在车里时，孩子发来一条消息：爸爸你几点回家？我突然明白，我真正想赢回来的不是钱，是家。那天我没有进去。后来我每天只做一件事：今天不赌。现在一年多了。' },
  { gamblingType: 'online_casino', title: '删掉 App 那天，我松了一口气', body: '我以为卸载赌博 App 会很难受，结果删完反而轻松了——那个一直开着的入口终于关上了。头三天最难，我把手机放在客厅充电，人睡卧室。撑过第一周，念头就淡了很多。' },
  { gamblingType: 'sports_betting', title: '发薪日，我先把钱转走了', body: '以前工资一到账，当晚就没了。这次我在到账那一刻，先转了一大半到一个我平时不看的账户。钱不在手边，冲动就没了着力点。这个月，第一次到月底还有钱。' },
  { gamblingType: 'casino', title: '我把银行卡交给了老婆', body: '靠意志力我扛不住，我承认。于是我把主卡交给她保管，手机里只留基本生活费。想赌也拿不到钱——这不是没面子，是我给自己修的一道墙。' },
  { gamblingType: 'lottery', title: '复赌那晚之后，我没有放弃', body: '坚持了 40 天，那晚还是没忍住。第二天我很想干脆算了。但我打开这个 App，把那次记了下来，看清了是什么把我拉过去的。复赌不是终点，是一个要看懂的信号。现在我从那天重新数，又是新的 26 天。' },
  { gamblingType: 'cards', title: '我告诉了一个信任的朋友', body: '一直瞒着，太累了。我只跟一个朋友说了句“我在戒，帮我看着点”。没想到说出来之后，那种一个人硬扛的感觉轻了一半。有人知道，我就没那么容易骗自己。' },
  { gamblingType: 'casino', title: '换了一条回家的路', body: '我以前每天下班都路过那家赌场，几乎是本能地就拐进去。后来我硬是绕远路回家。离得远，冲动就弱一半。一个小动作，帮我守住了很多个晚上。' },
  { gamblingType: 'online_casino', title: '现在我睡得着觉了', body: '戒赌之前，我整夜整夜地盯着屏幕，白天没精神。戒了三个月，最明显的变化不是存款，是我能睡整觉了。身体先好起来，人就稳了。钱是慢慢回来的，觉是马上回来的。' },
  { gamblingType: 'sports_betting', title: '把所有赌球推送都关了', body: '以前一到周末，手机就不停弹比分和赔率，像有人在耳边喊。我一条条把这些推送全关了，取关了那些群。世界一下安静了，我也不再一有比赛就心痒。' },
  { gamblingType: 'casino', title: '陪孩子的那半小时', body: '有天晚上我又想溜出去，儿子拉着我要我陪他搭积木。我坐下来陪了半小时，抬头发现那股冲动不知什么时候过去了。原来最好的挡箭牌，就是身边真实的人。' },
  { gamblingType: 'trading_impulse', title: '我把交易软件也删了', body: '我不去赌场，但整天盯着盘面加杠杆，其实是一回事。承认这点花了我很久。删掉那个软件那天，手是抖的，但删完，心里那根一直绷着的弦终于松了。' },
  { gamblingType: 'lottery', title: '路过彩票店，我没进去', body: '每天下班都路过那家店，以前总要买两张。今天我攥着手机里的省钱数字，走了过去，没进。就这一次"没进去"，让我相信下一次我也能。' },
  { gamblingType: 'casino', title: '把还债写进了计划', body: '欠的钱压得我喘不过气，越急越想赌一把翻本。后来我把每一笔债列出来，排了个能承受的还款顺序，每月还一点。慢是慢，但每还一笔，我腰杆就直一分。' },
  { gamblingType: 'cards', title: '半夜想赌，我打给了朋友', body: '凌晨两点，那个念头又上来了。我没有点开任何东西，而是打给了那个知道我在戒的朋友。我们没聊什么大道理，就是说了会儿话，等我挂电话，天快亮了，我也睡着了。' },
  { gamblingType: 'casino', title: '老婆开始把钱交给我管一点', body: '我戒到第 60 天那天，她主动让我管一部分家用。那一刻我差点哭出来——不是因为钱，是因为她眼里，我又变回那个可以被信任的人了。信任是一件件小事垒回来的。' },
  { gamblingType: 'online_casino', title: '无聊的时候我去跑步', body: '以前一闲下来就想赌，说到底是不知道拿这些时间干嘛。现在冲动一来，我就换鞋出门跑二十分钟。跑完一身汗，那点躁动早没了。运动是最便宜的解药。' },
];

export function getWallSeedStories(): CompanionStory[] {
  return WALL_SEED_STORIES.map((s, index) => ({
    id: 'seed-' + index,
    displayName: '匿名用户',
    displayMode: 'system',
    gamblingType: s.gamblingType,
    title: s.title,
    excerpt: s.body.slice(0, 90),
    body: s.body,
    source: 'system',
    status: 'approved',
    createdAt: '2026-01-01',
  }));
}

export function gamblingTypeLabel(type?: GamblingType | string) {
  switch (type) {
    case 'online_casino': return '线上赌场';
    case 'sports_betting': return '体育博彩';
    case 'lottery': return '彩票';
    case 'cards': return '棋牌/麻将';
    case 'trading_impulse': return '交易式赌博冲动';
    case 'other': return '其他';
    case 'casino':
    default:
      return '赌场';
  }
}
