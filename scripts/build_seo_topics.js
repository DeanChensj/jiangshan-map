#!/usr/bin/env node
/**
 * Programmatic Static SEO/GEO Topic Page Generator for Jiangshan Historical Atlas (江山时序)
 *
 * Generates zero-query-string static HTML landing pages under `topics/*.html` for:
 *   1. All 18 historical eras (`topics/<dynasty.key>.html`)
 *   2. All 7 biographical journeys (`topics/journey-<key>.html`)
 *   3. 9 high-search-intent classical poetry routes & historical battles (`topics/<slug>.html`)
 *   4. Master index directory (`topics/index.html`)
 *
 * Also synchronizes `sitemap.xml` and `#seo-atlas-directory` in `index.html`.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { CONTROLLER_SCRIPTS } = require('./sync_version');

const ROOT = path.resolve(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');
const TOPICS_DIR = path.join(ROOT, 'topics');
const SOURCES_DIR = path.join(ROOT, 'data', 'sources');
const BASE_URL = 'https://deanchen.me/jiangshan-map';
const LASTMOD = '2026-11-18';

function loadSourcesBundle() {
  const worksPath = path.join(SOURCES_DIR, 'works.json');
  const works = fs.existsSync(worksPath) ? JSON.parse(fs.readFileSync(worksPath, 'utf8')) : {};
  const refs = new Map();
  if (fs.existsSync(SOURCES_DIR)) {
    const files = fs
      .readdirSync(SOURCES_DIR)
      .filter((f) => f.endsWith('.json') && f !== 'works.json' && f !== 'baseline.json')
      .sort();
    for (const f of files) {
      const obj = JSON.parse(fs.readFileSync(path.join(SOURCES_DIR, f), 'utf8'));
      for (const [k, list] of Object.entries(obj)) {
        if (Array.isArray(list) && list.length > 0) {
          refs.set(k, list);
        }
      }
    }
  }
  return { works, refs };
}

function formatSourceCitationsHtml(recordKey, sourcesBundle) {
  if (!sourcesBundle || !sourcesBundle.refs) return '';
  const list = sourcesBundle.refs.get(recordKey);
  if (!Array.isArray(list) || list.length === 0) return '';
  const byWork = new Map();
  for (const r of list) {
    const w = sourcesBundle.works[r.w];
    const wTitle = w ? w.zh : r.w;
    if (!byWork.has(wTitle)) byWork.set(wTitle, []);
    const locs = byWork.get(wTitle);
    const loc = (r.loc || '').trim();
    if (loc && !locs.includes(loc)) locs.push(loc);
  }
  const parts = [];
  for (const [wTitle, locs] of byWork.entries()) {
    parts.push(`${escHtml(wTitle)}${locs.length ? ` ${escHtml(locs.join('、'))}` : ''}`);
  }
  if (!parts.length) return '';
  return `<div class="source-cite"><strong>史料出处：</strong>${parts.join('；')}</div>`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtYearZh(y) {
  return y < 0 ? `公元前${Math.abs(y)}年` : `公元${y}年`;
}

function fmtYearShortZh(y) {
  return y < 0 ? `前${Math.abs(y)}` : `${y}`;
}

function fmtYearEn(y) {
  return y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`;
}

function fmtDynSpanZh(d) {
  return d.key === 'prc'
    ? `${fmtYearShortZh(d.fromYear)}—`
    : `${fmtYearShortZh(d.fromYear)}—${fmtYearShortZh(d.toYear)}`;
}

function fmtDynSpanEn(d) {
  return d.key === 'prc'
    ? `${fmtYearEn(d.fromYear)} –`
    : `${fmtYearEn(d.fromYear)} – ${fmtYearEn(d.toYear)}`;
}

function loadAtlasRuntime() {
  const sandbox = {
    window: {},
    URLSearchParams,
    setTimeout,
    clearTimeout,
    location: {
      search: '',
      origin: 'https://deanchen.me',
      pathname: '/jiangshan-map/',
    },
  };
  sandbox.window.location = sandbox.location;
  sandbox.window.URLSearchParams = URLSearchParams;
  sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);

  for (const file of [
    'china_geo_data.js',
    'atlas_boot.js',
    'atlas_snapshots.js',
    'map_data.js',
    'lore_core.js',
    'lore_detail.js',
    'i18n_dict.js',
    'zh_hant.js',
    ...CONTROLLER_SCRIPTS.map((rel) => path.basename(rel)),
  ]) {
    const code = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  }

  const ControllerClass = sandbox.window.HistoricalAtlasController;
  const dynasties = sandbox.window.DYNASTY_DATA;
  const provinces = sandbox.window.PROVINCE_OUTLINES;
  const corridors = sandbox.window.CORRIDOR_DATA;
  const snapshots = sandbox.window.ATLAS_SNAPSHOTS;
  const loreData = sandbox.window.ATLAS_LORE_DATA;
  const enLocale = sandbox.window.EN_LOCALE;

  const ctrl = Object.create(ControllerClass.prototype);
  Object.assign(ctrl, {
    dynasties,
    provinces,
    corridors,
    snapshots,
    enLocale,
    locale: 'zh',
    year: -403,
    minYear: dynasties[0].fromYear,
    maxYear: dynasties[dynasties.length - 1].toYear,
    camera: { x: 350, y: 215, w: 500, h: 420, zoom: 2 },
    projector: new sandbox.window.MercatorProjector(1000, 700, {
      west: 66,
      east: 142,
      south: 14,
      north: 55,
    }),
  });

  return { ctrl, dynasties, snapshots, loreData, enLocale, provinces };
}

const FEATURED_TOPICS = [
  {
    slug: 'dufu-763',
    categoryZh: '古诗词地理路线',
    categoryEn: 'Classical Poetry Route',
    titleZh: '杜甫《闻官军收河南河北》归乡路线历史地图（763年）',
    titleEn: "Du Fu's 763 CE Homeward Route in 'Hearing the Imperial Army Retook Henan and Hebei'",
    shortZh: '杜甫《闻官军收河南河北》归乡路线图（763年 · 唐代宗广德元年）',
    inspectQuery: { year: 763, place: '剑外,巴峡,巫峡,襄阳,洛阳' },
    mapHref: `${BASE_URL}/?year=763&place=%E5%89%91%E5%A4%96,%E5%B7%B4%E5%B3%A1,%E5%B7%AB%E5%B3%A1,%E8%A5%84%E9%98%B3,%E6%B4%9B%E9%98%B3`,
    poemQuote: '剑外忽传收蓟北，初闻涕泪满衣裳。却看妻子愁何在，漫卷诗书喜欲狂。白日放歌须纵酒，青春作伴好还乡。即从巴峡穿巫峡，便下襄阳向洛阳。',
    poemAuthor: '唐 · 杜甫《闻官军收河南河北》（唐代宗广德元年 · 公元763年春作于梓州）',
    summaryZh:
      '公元763年（唐代宗广德元年）正月，史朝义兵败自缢，持续八年的安史之乱宣告结束。流寓剑南东川梓州（今四川绵阳三台，“剑外”）的杜甫闻讯狂喜，挥毫写下“生平第一首快诗”《闻官军收河南河北》，在诗中勾勒出一条横跨巴蜀、三峡、江汉与中原的水陆归乡路线：自剑外（梓州）启程，顺嘉陵江入长江经巴峡（今重庆巴南、奉节一带），穿巫峡（今重庆巫山至湖北巴东）出夔门，转汉水北上襄阳（今湖北襄阳），再由陆路直奔故里洛阳（今河南洛阳偃师首阳山）。',
    summaryEn:
      'In spring 763 CE (first year of the Guangde era under Emperor Daizong of Tang), news of the end of the eight-year An Lushan Rebellion reached Du Fu in Zizhou (modern Santai, Mianyang, Sichuan — "beyond Jianmen Pass"). Overjoyed, he composed his famous regulated verse envisioning a rapid river-and-land voyage home: from Jianwai through Baxia and Wuxia along the Three Gorges, up toward Xiangyang, and onward to his ancestral home in Luoyang.',
    keywords: [
      '闻官军收河南河北地图',
      '即从巴峡穿巫峡便下襄阳向洛阳路线图',
      '杜甫归乡路线地图',
      '剑外巴峡巫峡襄阳洛阳古今地名',
      '唐代历史地图763年',
      '江山时序',
    ],
  },
  {
    slug: 'sushi-exile',
    categoryZh: '古诗词地理路线',
    categoryEn: 'Classical Poetry Route',
    titleZh: '苏轼《自题金山画像》“黄州惠州儋州”跨年贬谪路线历史地图（1079—1097年）',
    titleEn: "Su Shi's Multi-Year Exile Route: Huzhou, Huangzhou, Huizhou & Danzhou (1079–1097 CE)",
    shortZh: '苏轼《自题金山画像》跨年贬谪路线图（1079—1097年 · 北宋）',
    inspectQuery: { year: '1079,1080,1094,1097', place: '湖州,黄州,惠州,儋州' },
    mapHref: `${BASE_URL}/?year=1079,1080,1094,1097&place=%E6%B9%96%E5%B7%9E,%E9%BB%84%E5%B7%9E,%E6%83%A0%E5%B7%9E,%E5%84%8B%E5%B7%9E`,
    poemQuote: '心似已灰之木，身如不系之舟。问汝平生功业，黄州惠州儋州。',
    poemAuthor: '北宋 · 苏轼《自题金山画像》（建中靖国元年 · 公元1101年北归途中作）',
    summaryZh:
      '北宋元丰二年（1079年），苏轼于湖州知州任上因“乌台诗案”被捕入狱，次年（1080年）贬为黄州（今湖北黄冈）团练副使，在此写下《念奴娇·赤壁怀古》与前后《赤壁赋》；哲宗绍圣元年（1094年）再贬岭南惠州（今广东惠州），留有“日啖荔枝三百颗，不辞长作岭南人”；绍圣四年（1097年）更跨琼州海峡远贬海南儋州（今海南儋州中和镇）。这四处跨越江南、江淮、岭南与海南岛的贬谪之地，构成了苏东坡晚年《自题金山画像》“问汝平生功业，黄州惠州儋州”的旷世人生轨迹。',
    summaryEn:
      'Following the Crow Terrace Poetry Trial in Huzhou (1079 CE), Su Shi (Su Dongpo) was banished successively to Huangzhou (1080 CE, modern Huanggang, Hubei), Huizhou in Lingnan (1094 CE, modern Huizhou, Guangdong), and across the Qiongzhou Strait to Danzhou on Hainan Island (1097 CE). Near the end of his life in 1101 CE, he immortalized this 3,000-kilometer arc in his self-inscription: "Ask of my lifelong achievements: Huangzhou, Huizhou, Danzhou."',
    keywords: [
      '问汝平生功业黄州惠州儋州地图',
      '苏轼贬谪路线图',
      '自题金山画像历史地图',
      '乌台诗案湖州黄州惠州儋州古今地名',
      '北宋路州历史地图',
      '江山时序',
    ],
  },
  {
    slug: 'wentianxiang-lingdingyang',
    categoryZh: '古诗词地理路线',
    categoryEn: 'Classical Poetry Route',
    titleZh: '文天祥《过零丁洋》“惶恐滩头说惶恐，零丁洋里叹零丁”抗元路线历史地图（1275—1279年）',
    titleEn: "Wen Tianxiang's Resistance Route & 'Crossing Lingdingyang' Historical Map (1275–1279 CE)",
    shortZh: '文天祥《过零丁洋》抗元路线图（1275—1279年 · 南宋末）',
    inspectQuery: { year: '1275,1277,1278,1279', place: '赣州,惶恐滩,零丁洋,崖山' },
    mapHref: `${BASE_URL}/?year=1275,1277,1278,1279&place=%E8%B5%A3%E5%B7%9E,%E6%83%B6%E6%81%90%E6%BB%A9,%E9%9B%B6%E4%B8%81%E6%B4%8B,%E5%B4%96%E5%B1%B1`,
    poemQuote: '辛苦遭逢起一经，干戈寥落四周星。山河破碎风飘絮，身世浮沉雨打萍。惶恐滩头说惶恐，零丁洋里叹零丁。人生自古谁无死？留取丹心照汗青。',
    poemAuthor: '南宋 · 文天祥《过零丁洋》（祥兴二年 · 公元1279年正月作于珠江口零丁洋战船）',
    summaryZh:
      '南宋德祐元年（1275年），赣州知州文天祥散尽家财起兵勤王；景炎二年（1277年）在江西抗元兵败，经赣江十八滩之首“惶恐滩”（今江西吉安万安县赣江险滩）退往闽粤；祥兴元年（1278年）冬于广东海丰五坡岭被俘，次年（1279年）正月被元军押解途经珠江口“零丁洋”（今广东珠江口伶仃洋海域）威逼招降张世杰，文天祥赋《过零丁洋》明志；同年二月崖山（今广东江门新会崖门）海战爆发，南宋覆亡。',
    summaryEn:
      'From raising loyalist forces in Ganzhou (1275 CE) and retreating past Huangkong Shoal on the Gan River in Jiangxi (1277 CE), to his capture and passage across Lingdingyang in the Pearl River Estuary (1278–1279 CE) on the eve of the Battle of Yamen (1279 CE), Wen Tianxiang’s poem links four iconic geographic landmarks of the fall of Southern Song.',
    keywords: [
      '过零丁洋历史地图',
      '惶恐滩头说惶恐零丁洋里叹零丁地图位置',
      '文天祥抗元路线图',
      '惶恐滩零丁洋崖山古今地名',
      '南宋末年崖山海战地图',
      '江山时序',
    ],
  },
  {
    slug: 'hanyu-languan',
    categoryZh: '古诗词地名考据',
    categoryEn: 'Poetic Landmark & Pass',
    titleZh: '韩愈《左迁至蓝关示侄孙湘》“雪拥蓝关马不前”历史地图与蓝田关沿革（819年）',
    titleEn: "Han Yu's 'Demoted and Arriving at Languan Pass' (819 CE) Historical Map & Genealogy",
    shortZh: '韩愈《左迁至蓝关示侄孙湘》历史地图定位（819年 · 唐宪宗元和十四年）',
    inspectQuery: { year: 819, place: '蓝关' },
    targetDisplayTitle: '蓝关（秦汉峣关 · 隋唐蓝田关）',
    mapHref: `${BASE_URL}/?year=819&place=%E8%93%9D%E5%85%B3`,
    poemQuote: '一封朝奏九重天，夕贬潮州路八千。欲为圣明除弊事，肯将衰朽惜残年！云横秦岭家何在？雪拥蓝关马不前。知汝远来应有意，好收吾骨瘴江边。',
    poemAuthor: '唐 · 韩愈《左迁至蓝关示侄孙湘》（唐宪宗元和十四年 · 公元819年正月）',
    summaryZh:
      '唐宪宗元和十四年（公元819年）正月，刑部侍郎韩愈因上《论佛骨表》触怒宪宗，由京师长安（今陕西西安）贬为岭南潮州刺史。韩愈冒严寒出长安东南行，翻越秦岭主脊的蓝田关（简称“蓝关”，即秦汉峣关故址、隋唐蓝田关，位于今陕西省西安市蓝田县东南秦岭七盘岭至蓝桥镇山谷），大雪封山之际侄孙韩湘赶来相送，韩愈遂作千古名篇《左迁至蓝关示侄孙湘》。蓝关扼关中平原经武关道通往商州（今陕西商洛）、南阳及江南岭南之咽喉。',
    summaryEn:
      'In January 819 CE (14th year of the Yuanhe era), Han Yu was banished from the Tang capital Chang’an to Chaozhou in Lingnan after presenting his Memorial on the Buddha’s Bone. Crossing the Qinling Mountains southeast of Chang’an via Languan (Lantian Pass, modern Lantian County, Xi’an, Shaanxi), heavy snow blocked his horse along the Shangzhou–Wuguan corridor, inspiring his celebrated poem.',
    keywords: [
      '雪拥蓝关马不前蓝关在哪里',
      '左迁至蓝关示侄孙湘历史地图',
      '蓝关古今地名对照',
      '秦岭蓝田关地图位置',
      '韩愈贬潮州路线地图',
      '江山时序',
    ],
  },
  {
    slug: 'shuihu-jiangzhou',
    categoryZh: '名著地理与同名辨析',
    categoryEn: 'Literary Geography & Toponym Disambiguation',
    titleZh: '《水浒传》宋江刺配江州与浔阳楼历史地图（1102年 · 宋代江西九江 vs 秦汉重庆江州辨析）',
    titleEn: "Song Jiang's Exile to Jiangzhou & Xunyang Tower in 'Water Margin' (1102 CE Historical Map)",
    shortZh: '《水浒传》宋江刺配江州与浔阳楼历史地图（1102年 · 北宋徽宗崇宁年间）',
    inspectQuery: { year: 1102, place: '浔阳' },
    targetDisplayTitle: '江州 / 浔阳（治浔阳县，今江西省九江市）',
    mapHref: `${BASE_URL}/?year=1102&place=%E6%B5%94%E9%98%B3&hover=%E6%B1%9F%E5%B7%9E`,
    poemQuote: '心在山东身在吴，飘蓬震垲幔嗟吁。他时若遂凌云志，敢笑黄巢不丈夫！',
    poemAuthor: '《水浒传》第三十九回 · 浔阳楼宋江吟反诗（背景年代：北宋徽宗崇宁年间 · 约1102年）',
    summaryZh:
      '中国历史地理中最著名的“同名异地”案例之一便是“江州”：秦汉至六朝前期的“江州”为巴郡治所，位于嘉陵江入长江处的今重庆市渝中区；而自东晋设江州并移治寻阳（浔阳）后，隋唐宋明所谓的“江州”均指长江中下游赣北重镇——今江西省九江市。白居易《琵琶行》“江州司马青衫湿”与《水浒传》宋江刺配江州牢城、于浔阳江畔浔阳楼醉题反诗，在北宋（1102年）行政区划中皆属江南西路江州（治浔阳县，今江西省九江市浔阳区）。',
    summaryEn:
      'One of Chinese historical geography’s classic homonym traps is "Jiangzhou": during the Qin, Han, and Three Kingdoms periods, Jiangzhou referred to modern Chongqing at the confluence of the Jialing and Yangtze rivers; from the Eastern Jin, Tang, and Song dynasties onward, Jiangzhou was seated at Xunyang (modern Jiujiang, Jiangxi). Both Bai Juyi’s "Pipa Song" and Song Jiang’s exile to Jiangzhou in Water Margin (c. 1102 CE, Northern Song) take place in Jiangnan West Circuit’s Jiangzhou (Jiujiang, Jiangxi).',
    keywords: [
      '宋江刺配江州是现在的哪里',
      '水浒传江州浔阳楼历史地图',
      '古代江州是重庆还是九江',
      '江州司马青衫湿是哪里',
      '北宋江南西路江州地图',
      '江山时序',
    ],
  },
  {
    slug: 'xinqiji-jingkou',
    categoryZh: '古诗词地名考据',
    categoryEn: 'Poetic Landmark & Border Geopolitics',
    titleZh: '辛弃疾《永遇乐·京口北固亭怀古》1205年宋金对峙历史地图与镇江京口沿革',
    titleEn: "Xin Qiji's 'Yongyule: Memories of the Past at Beigu Pavilion in Jingkou' (1205 CE Map)",
    shortZh: '辛弃疾《永遇乐·京口北固亭怀古》天下局势图（1205年 · 南宋宁宗开禧元年）',
    inspectQuery: { year: 1205, place: '京口' },
    targetDisplayTitle: '京口（三国东吴铁瓮城 · 南宋镇江府，今江苏省镇江市）',
    mapHref: `${BASE_URL}/?year=1205&place=%E4%BA%AC%E5%8F%A3`,
    poemQuote: '千古江山，英雄无觅，孙仲谋处。舞榭歌台，风流总被，雨打风吹去。斜阳草树，寻常巷陌，人道寄奴曾住。想当年，金戈铁马，气吞万里如虎。',
    poemAuthor: '南宋 · 辛弃疾《永遇乐·京口北固亭怀古》（宋宁宗开禧元年 · 公元1205年任镇江知府时作）',
    summaryZh:
      '南宋宁宗开禧元年（公元1205年），六十六岁的辛弃疾出任镇江知府，登临长江南岸京口（今江苏省镇江市京口区）北固山上的北固亭。彼时南宋与金朝以淮河—大散关为界，镇江府（京口）扼长江与大运河交汇处，为拱卫行在临安（今杭州）与建康（今南京）的江防前哨。辛弃疾隔江北望金朝统治下的淮北中原，追怀三国孙权建都京口（铁瓮城）、南朝宋武帝刘裕（小字寄奴）由京口举兵北伐气吞万里，同时借南朝宋文帝元嘉二十七年（450年）“元嘉草草，封狼居胥，赢得仓皇北顾”劝诫韩侂胄切勿轻率北伐。',
    summaryEn:
      'In 1205 CE (first year of the Kaixi era), 66-year-old Xin Qiji served as Prefect of Zhenjiang (ancient Jingkou, modern Zhenjiang, Jiangsu) on the southern bank of the Yangtze River. Looking north toward Jin-controlled territory across the Huai River frontier, he invoked Sun Quan of Wu and Liu Yu (Emperor Wu of Liu Song) while warning against an unprepared northern expedition.',
    keywords: [
      '永遇乐京口北固亭怀古历史地图',
      '京口是现在的哪个城市',
      '1205年南宋与金朝疆域地图',
      '元嘉草草封狼居胥历史背景地图',
      '镇江京口古今政区沿革',
      '江山时序',
    ],
  },
  {
    slug: 'battle-changping',
    categoryZh: '重大历史战役',
    categoryEn: 'Decisive Ancient Battle',
    titleZh: '长平之战历史地图（公元前260年 · 战国秦赵上党长平决战与版图演变）',
    titleEn: 'Battle of Changping Historical Map (260 BCE · Warring States Qin vs. Zhao Campaign)',
    shortZh: '长平之战历史地图（前260年 · 战国秦赵决战）',
    inspectQuery: { year: -260, place: '长平' },
    targetDisplayTitle: '长平（韩国上党郡 · 今山西省晋城市高平市）',
    mapHref: `${BASE_URL}/?year=-260&place=%E9%95%BF%E5%B9%B3`,
    poemQuote: '秦人开关延敌，九国之师，逡巡而不敢进。',
    poemAuthor: '西汉 · 贾谊《过秦论》论战国秦赵争衡',
    summaryZh:
      '公元前262年至前260年（秦昭襄王四十七年、赵孝成王六年），秦、赵两国围绕战略要地韩之上党郡（今山西长治、晋城高平一带，太行山之巅俯瞰中原与河东）展开战国规模最大的战略决战。前260年，赵王以赵括代廉颇为将，秦王密遣武安君白起为上将军。白起采取佯败诱敌、迂回穿插战术，截断赵军粮道四十六日，赵括突围中箭身亡，四十万赵军降卒被坑杀于长平（今山西省晋城市高平市）。此役彻底摧毁东方六国中唯一能与秦军正面对抗的赵国军事主力，奠定秦统一六国之基。',
    summaryEn:
      'Fought in 260 BCE around Shangdang and Changping (modern Gaoping, Jincheng, Shanxi) atop the Taihang Mountains, the Battle of Changping saw Qin general Bai Qi encircle and annihilate Zhao Kuo’s 400,000-strong Zhao army, shattering the military balance of the Warring States.',
    keywords: [
      '长平之战历史地图',
      '长平是现在的哪里',
      '公元前260年战国七雄地图',
      '上党郡长平古今地名对照',
      '白起赵括长平之战地理位置',
      '江山时序',
    ],
  },
  {
    slug: 'battle-chibi',
    categoryZh: '重大历史战役',
    categoryEn: 'Decisive Ancient Battle',
    titleZh: '赤壁之战历史地图（公元208年 · 东汉建安十三年孙刘联军火烧赤壁与三国鼎立版图）',
    titleEn: 'Battle of Red Cliffs (Chibi) Historical Map (208 CE · End of Han & Three Kingdoms)',
    shortZh: '赤壁之战历史地图（208年 · 东汉建安十三年）',
    inspectQuery: { year: 208, place: '赤壁' },
    targetDisplayTitle: '赤壁（东汉荆州南郡 · 今湖北省咸宁市赤壁市）',
    mapHref: `${BASE_URL}/?year=208&place=%E8%B5%A4%E5%A3%81`,
    poemQuote: '遥想公瑾当年，小乔初嫁了，雄姿英发。羽扇纶巾，谈笑间，樯櫓灰飞烟灭。',
    poemAuthor: '北宋 · 苏轼《念奴娇·赤壁怀古》',
    summaryZh:
      '东汉献帝建安十三年（公元208年）秋，统一北方的曹操挥师南下荆州，刘琮举州降曹，刘备自樊城退守夏口（今湖北武汉），遣诸葛亮赴柴桑（今江西九江）联结孙权。孙权命周瑜、程普率水军三万与刘备合兵，逆长江而上，与曹军遭遇于赤壁、乌林（今湖北省咸宁市赤壁市西北长江南岸，隔江对岸为洪湖乌林）。黄盖用火攻诈降计焚毁曹军连环战船，曹操经华容道败退江陵、北归邺城，自此奠定魏、蜀、吴三国鼎立之战略格局。',
    summaryEn:
      'In winter 208 CE (13th year of the Jian’an era), the allied river fleets of Sun Quan (led by Zhou Yu) and Liu Bei (advised by Zhuge Liang) defeated Cao Cao’s northern expedition by fire attack at Red Cliffs (Chibi, modern Chibi, Hubei) opposite Wulin on the middle Yangtze River, establishing the tripartite division of China.',
    keywords: [
      '赤壁之战历史地图',
      '208年建安十三年东汉三国地图',
      '赤壁乌林柴桑夏口江陵地理位置',
      '三国赤壁是湖北黄冈还是咸宁赤壁',
      '赤壁之战古今地名对照',
      '江山时序',
    ],
  },
  {
    slug: 'battle-feishui',
    categoryZh: '重大历史战役',
    categoryEn: 'Decisive Ancient Battle',
    titleZh: '淝水之战历史地图（公元383年 · 东晋与前秦八公山淝水决战及南北分裂版图）',
    titleEn: 'Battle of Feishui Historical Map (383 CE · Eastern Jin vs. Former Qin Campaign)',
    shortZh: '淝水之战历史地图（383年 · 东晋太元八年）',
    inspectQuery: { year: 383, place: '淝水' },
    targetDisplayTitle: '淝水（古肥水 · 今安徽省淮南市寿县城东）',
    mapHref: `${BASE_URL}/?year=383&place=%E6%B7%9D%E6%B0%B4`,
    poemQuote: '余兵皆弃甲宵遁，闻风声鹤唳，皆以为王师已至。',
    poemAuthor: '《晋书·谢玄传》记太元八年（公元383年）淝水之战',
    summaryZh:
      '公元376年（东晋太元元年、前秦建元十二年），前秦天王苻坚灭前凉与代国，统一整个中国北方，与定都建康（今南京）的东晋形成南北对峙。公元383年（太元八年）秋，苻坚率号称百万大军南征，前锋苻融攻占寿阳（今安徽省淮南市寿县），与谢石、谢玄、刘牢之统率的八万东晋“北府兵”隔淝水（古肥水，流经寿春城东入淮河）对峙。谢玄用计诱使秦军后撤半渡而击，朱序于阵后高呼“秦兵败矣”，前秦大军溃散，“投鞭断流、草木皆兵、风声鹤唳”皆出于此役。战后北方迅速再度瓦解，慕容垂建后燕、姚苌建后秦，拓跋珪重建代（北魏）。',
    summaryEn:
      'In autumn 383 CE, Former Qin ruler Fu Jian marched south after unifying northern China, confronting 80,000 elite Eastern Jin "Northern Garrison" troops under Xie Xuan across the Fei River at Shouyang (modern Shouxian, Huainan, Anhui). The rout of Former Qin preserved Eastern Jin in the south and triggered the rapid fragmentation of northern China.',
    keywords: [
      '淝水之战历史地图',
      '383年东晋前秦疆域地图',
      '淝水寿春八公山是现在的哪里',
      '风声鹤唳草木皆兵历史地图',
      '东晋十六国历史地图',
      '江山时序',
    ],
  },
];

function renderSharedHead({
  title,
  description,
  keywords,
  canonicalUrl,
  jsonLdObj,
}) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(description)}" />
  <meta name="keywords" content="${escHtml(keywords.join(', '))}" />
  <meta name="author" content="Jiangshan Atlas (江山时序)" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <meta name="applicable-device" content="pc,mobile" />
  <meta name="mobile-agent" content="format=html5;url=${escHtml(canonicalUrl)}" />
  <meta http-equiv="Cache-Control" content="no-transform" />
  <meta http-equiv="Cache-Control" content="no-siteapp" />
  <meta name="theme-color" content="#f5efe2" />
  <link rel="canonical" href="${escHtml(canonicalUrl)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="江山时序 · Jiangshan Historical Atlas" />
  <meta property="og:locale" content="zh_CN" />
  <meta property="og:locale:alternate" content="en_US" />
  <meta property="og:title" content="${escHtml(title)}" />
  <meta property="og:description" content="${escHtml(description)}" />
  <meta property="og:url" content="${escHtml(canonicalUrl)}" />
  <meta property="og:image" content="${BASE_URL}/assets/og_preview.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escHtml(title)}" />
  <meta name="twitter:description" content="${escHtml(description)}" />
  <meta name="twitter:image" content="${BASE_URL}/assets/og_preview.png" />
  <link rel="icon" type="image/svg+xml" href="../assets/favicon.svg" />
  <script type="application/ld+json">
${JSON.stringify(jsonLdObj, null, 2)}
  </script>
  <style>
    :root {
      --bg-paper: #f5efe2;
      --bg-card: #fbf7ee;
      --ink-main: #221d17;
      --ink-muted: #5e5346;
      --cinnabar: #9e2a22;
      --cinnabar-hover: #7d1e17;
      --gold-border: #d5c7ae;
      --accent-teal: #275d52;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: var(--bg-paper);
      color: var(--ink-main);
      font-family: "Noto Serif SC", "Songti SC", "STSong", "PingFang SC", "Microsoft YaHei", serif;
      line-height: 1.72;
    }
    .top-bar {
      background: #ece3d0;
      border-bottom: 1px solid var(--gold-border);
      padding: 0.75rem 1.25rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .brand-link {
      text-decoration: none;
      color: var(--ink-main);
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      font-weight: 700;
      font-size: 1.08rem;
    }
    .seal-badge {
      background: var(--cinnabar);
      color: #fff8ee;
      padding: 0.18rem 0.5rem;
      border-radius: 4px;
      font-size: 0.92rem;
      letter-spacing: 0.06em;
    }
    .top-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
      font-size: 0.9rem;
    }
    .top-nav a {
      color: var(--ink-muted);
      text-decoration: none;
      padding: 0.25rem 0.55rem;
      border-radius: 4px;
      border: 1px solid transparent;
    }
    .top-nav a:hover {
      color: var(--cinnabar);
      border-color: var(--gold-border);
      background: var(--bg-card);
    }
    main {
      max-width: 980px;
      margin: 0 auto;
      padding: 1.75rem 1.25rem 3.5rem;
    }
    .breadcrumb {
      font-size: 0.86rem;
      color: var(--ink-muted);
      margin-bottom: 1rem;
    }
    .breadcrumb a {
      color: var(--ink-muted);
      text-decoration: none;
    }
    .breadcrumb a:hover { color: var(--cinnabar); text-decoration: underline; }
    .hero-card {
      background: var(--bg-card);
      border: 1px solid var(--gold-border);
      border-left: 5px solid var(--cinnabar);
      border-radius: 8px;
      padding: 1.4rem 1.5rem;
      margin-bottom: 1.6rem;
      box-shadow: 0 2px 10px rgba(34, 29, 23, 0.05);
    }
    .kicker {
      display: inline-block;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--cinnabar);
      background: rgba(158, 42, 34, 0.09);
      padding: 0.15rem 0.55rem;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }
    h1 {
      margin: 0.2rem 0 0.6rem;
      font-size: 1.65rem;
      line-height: 1.35;
      color: var(--ink-main);
    }
    .en-sub {
      font-size: 0.95rem;
      color: var(--ink-muted);
      margin: 0 0 0.9rem;
    }
    .meta-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      margin: 0.85rem 0 1.15rem;
    }
    .meta-pill {
      background: #efe7d6;
      border: 1px solid var(--gold-border);
      padding: 0.22rem 0.68rem;
      border-radius: 999px;
      font-size: 0.85rem;
      color: var(--ink-main);
    }
    .cta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
      margin-top: 1.1rem;
    }
    .cta-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: var(--cinnabar);
      color: #fff9f0;
      text-decoration: none;
      font-weight: 600;
      padding: 0.62rem 1.2rem;
      border-radius: 6px;
      font-size: 0.96rem;
      transition: background 0.15s ease;
    }
    .cta-btn:hover { background: var(--cinnabar-hover); }
    .cta-btn.secondary {
      background: transparent;
      color: var(--ink-main);
      border: 1px solid var(--gold-border);
    }
    .cta-btn.secondary:hover {
      border-color: var(--cinnabar);
      color: var(--cinnabar);
    }
    .section-card {
      background: var(--bg-card);
      border: 1px solid var(--gold-border);
      border-radius: 8px;
      padding: 1.25rem 1.4rem;
      margin-bottom: 1.4rem;
    }
    h2 {
      margin: 0 0 0.85rem;
      font-size: 1.22rem;
      border-bottom: 1px solid var(--gold-border);
      padding-bottom: 0.45rem;
      color: var(--ink-main);
    }
    h3 {
      margin: 1rem 0 0.4rem;
      font-size: 1.05rem;
      color: var(--ink-main);
    }
    blockquote.poem-box {
      margin: 0.9rem 0;
      padding: 0.85rem 1.15rem;
      background: #f2ead9;
      border-left: 4px solid var(--accent-teal);
      border-radius: 4px;
      font-size: 1.04rem;
    }
    blockquote.poem-box cite {
      display: block;
      margin-top: 0.35rem;
      font-size: 0.86rem;
      color: var(--ink-muted);
      font-style: normal;
    }
    .table-wrap {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      margin-top: 0.5rem;
    }
    table.data-table {
      width: 100%;
      min-width: 620px;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    table.data-table th,
    table.data-table td {
      border: 1px solid var(--gold-border);
      padding: 0.5rem 0.65rem;
      text-align: left;
      vertical-align: top;
    }
    table.data-table th {
      background: #ece3d0;
      font-weight: 600;
    }
    table.data-table tr:nth-child(even) td {
      background: rgba(236, 227, 208, 0.32);
    }
    table.data-table a {
      color: var(--cinnabar);
      text-decoration: none;
      font-weight: 600;
    }
    table.data-table a:hover { text-decoration: underline; }
    .chip-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.6rem;
    }
    .chip-link {
      display: inline-block;
      background: #f0e8d8;
      border: 1px solid var(--gold-border);
      color: var(--ink-main);
      text-decoration: none;
      padding: 0.3rem 0.7rem;
      border-radius: 6px;
      font-size: 0.87rem;
    }
    .chip-link:hover {
      border-color: var(--cinnabar);
      color: var(--cinnabar);
      background: #fffdf8;
    }
    .stop-card {
      border: 1px solid var(--gold-border);
      border-radius: 6px;
      padding: 0.9rem 1.05rem;
      margin-bottom: 0.85rem;
      background: #fdfaf3;
    }
    .stop-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: baseline;
      gap: 0.5rem;
      margin-bottom: 0.35rem;
    }
    .stop-badge {
      background: var(--cinnabar);
      color: #fff;
      font-size: 0.78rem;
      padding: 0.1rem 0.45rem;
      border-radius: 4px;
      margin-right: 0.4rem;
    }
    .camp-badge {
      display: inline-block;
      color: #fff;
      font-size: 0.76rem;
      font-weight: 600;
      padding: 0.1rem 0.48rem;
      border-radius: 4px;
      margin-right: 0.38rem;
    }
    .source-cite {
      margin-top: 0.38rem;
      padding-top: 0.3rem;
      border-top: 1px dashed rgba(213, 199, 174, 0.75);
      font-size: 0.83rem;
      color: var(--ink-muted);
      line-height: 1.55;
    }
    .story-link-pill {
      display: inline-block;
      margin-left: 0.4rem;
      padding: 0.08rem 0.45rem;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--cinnabar);
      background: rgba(158, 42, 34, 0.1);
      border: 1px solid rgba(158, 42, 34, 0.3);
      border-radius: 4px;
      text-decoration: none;
    }
    .story-link-pill:hover {
      background: var(--cinnabar);
      color: #fff;
      text-decoration: none !important;
    }
    .diff-add { color: #1f5c3a; font-weight: 600; }
    .diff-rem { color: #8c2d24; font-weight: 600; }
    .diff-same { color: var(--ink-muted); font-size: 0.85rem; }
    .act-heading {
      margin: 1.25rem 0 0.65rem;
      padding: 0.4rem 0.75rem;
      background: #ece3d0;
      border-left: 4px solid var(--cinnabar);
      border-radius: 4px;
      font-size: 1.02rem;
      font-weight: 700;
      color: var(--ink-main);
    }
    .embed-card {
      background: var(--bg-card);
      border: 1px solid var(--gold-border);
      border-radius: 8px;
      padding: 1rem 1.15rem 1.1rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 10px rgba(34, 29, 23, 0.05);
    }
    .embed-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.65rem;
    }
    .embed-header h2 {
      margin: 0;
      padding: 0;
      border: none;
      font-size: 1.12rem;
    }
    .embed-hint {
      font-size: 0.84rem;
      color: var(--ink-muted);
    }
    .embed-frame-wrap {
      position: relative;
      width: 100%;
      height: 500px;
      border: 1px solid var(--gold-border);
      border-radius: 6px;
      overflow: hidden;
      background: #efe7d6;
    }
    @media (max-width: 640px) {
      .embed-frame-wrap { height: 390px; }
    }
    .embed-iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
    }
    .carto-note-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;
      margin-top: 0.6rem;
    }
    .carto-note-item {
      background: #fdfaf3;
      border: 1px solid var(--gold-border);
      border-left: 4px solid var(--accent-teal);
      border-radius: 6px;
      padding: 0.75rem 1rem;
    }
    .carto-note-item strong {
      color: var(--ink-main);
      display: block;
      margin-bottom: 0.22rem;
      font-size: 0.96rem;
    }
    .carto-note-item p {
      margin: 0;
      font-size: 0.9rem;
      color: var(--ink-muted);
      line-height: 1.65;
    }
    footer.page-footer {
      margin-top: 2.2rem;
      padding-top: 1.2rem;
      border-top: 1px solid var(--gold-border);
      font-size: 0.85rem;
      color: var(--ink-muted);
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0.75rem;
    }
    footer.page-footer a {
      color: var(--cinnabar);
      text-decoration: none;
    }
  </style>
  <script defer src="https://events.vercount.one/js"></script>
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "dc645937f75341b2a7416bd1fb81b635"}'></script>
</head>`;
}

function renderTopHeader() {
  return `  <header class="top-bar">
    <a class="brand-link" href="${BASE_URL}/">
      <span class="seal-badge">江山时序</span>
      <span>中国历史地图 · 战国 → 今</span>
    </a>
    <nav class="top-nav" aria-label="专题图志导航">
      <a href="${BASE_URL}/">进入交互式主地图</a>
      <a href="${BASE_URL}/topics/index.html">专题图志总目录</a>
      <a href="https://github.com/DeanChensj/jiangshan-map" target="_blank" rel="noopener noreferrer">GitHub 开源仓库</a>
    </nav>
  </header>`;
}

function renderFooter(allDynasties) {
  const dynLinks = allDynasties
    .map(
      (d) =>
        `<a class="chip-link" href="${BASE_URL}/topics/${d.key}.html">${escHtml(d.title)}（${fmtDynSpanZh(d)}）</a>`
    )
    .join('\n        ');
  return `    <section class="section-card">
      <h2>中国十八历史时期疆域图志速查（403 BCE — 2026 CE）</h2>
      <div class="chip-grid">
        ${dynLinks}
      </div>
    </section>
    <footer class="page-footer">
      <div>© 江山时序（Jiangshan Historical Atlas）· <a href="${BASE_URL}/">deanchen.me/jiangshan-map</a> · 历史疆域与政区为示意性近似</div>
      <div><a href="${BASE_URL}/topics/index.html">专题图志总览</a> · <a href="${BASE_URL}/sitemap.xml">Sitemap</a> · <a href="${BASE_URL}/llms.txt">LLMs.txt</a> · <a href="mailto:deancsj@gmail.com">联系与勘误：deancsj@gmail.com</a></div>
    </footer>`;
}

function renderEmbedMapSection({ iframeSrc, titleZh, hintZh }) {
  return `    <section class="embed-card" aria-label="交互式历史地图预览">
      <div class="embed-header">
        <h2>${escHtml(titleZh)}</h2>
        <span class="embed-hint">${escHtml(hintZh || '点击地图即可缩放、拖拽或拨动底部时间轴')}</span>
      </div>
      <div class="embed-frame-wrap">
        <iframe class="embed-iframe" src="${escHtml(iframeSrc)}" title="${escHtml(titleZh)}" loading="lazy" allowfullscreen></iframe>
      </div>
    </section>`;
}

const DYNASTY_CARTOGRAPHIC_NOTES = {
  zhanguo: [
    {
      title: '巴蜀疆界循涪江—嘉陵江自然分水岭',
      detail:
        '摒弃以东经 105° 经线直线切分巴蜀的简化画法，依据四川盆地山川地理，沿涪江与嘉陵江分水岭、渠江及大巴山脉走势标绘前 316 年秦司马错灭巴蜀前的巴国与蜀国边界。',
    },
    {
      title: '战国郡制按史籍建置年份渐进浮现',
      detail:
        '前 403—前 317 年初期快照仅呈现秦关中（内史）、魏上郡与韩（后入赵）上党郡三处早期边郡；秦置汉中郡（前 312）、赵置云中雁门代郡（前 300）、秦置黔中巫郡（前 280—前 277）、陇西南阳郡（前 272）、太原东郡（前 247—前 242）及薛郡（前 223）均严格随历史设郡节点逐阶段出现。',
    },
    {
      title: '先秦古海岸线与河口三角洲复原',
      detail:
        '复原战国时期古渤海湾西岸（岸线退至今天津歧口至河北沧州以西）、苏北与长江口漏斗湾（崇明沙洲尚未发育）及珠江三角洲古海湾岸线，避免将现代填海与千年泥沙淤积陆地误标为先秦疆域。',
    },
  ],
  qin: [
    {
      title: '三十六郡至四十余郡的疆域演进',
      detail:
        '前 221 年秦始皇初并天下分置三十六郡；前 214 年蒙恬北逐匈奴收河南地（新秦中）、略取岭南置南海、桂林、象郡并与闽越故地置闽中郡，完整呈现秦盛期四十余郡格局。',
    },
    {
      title: '秦末（前 209—前 207）动态裂变与赵佗据南海',
      detail:
        '拆分前 209 年大泽乡起义陈胜建“张楚”、六国旧贵族复立，以及前 207 年项羽巨鹿破秦主力两幅过渡快照；按《史记·南越列传》校准前 207 年南海尉赵佗初绝秦道时仅据南海郡，桂林、象郡至秦亡后方为赵佗兼并。',
    },
  ],
  xihan: [
    {
      title: '元鼎至元封（前 111—前 108）四方开疆逐年切片',
      detail:
        '将汉武帝元鼎六年（前 111）平南越置南海交趾九郡并分置张掖敦煌、元封元年（前 110）平闽越并于海南岛置珠崖儋耳二郡、元封二年（前 109）开西南夷置益州郡、元封三年（前 108）灭卫氏朝鲜置乐浪四郡拆分为四幅连续快照。',
    },
    {
      title: '十三刺史部与西域都护府山川边界',
      detail:
        '按《汉书·地理志》标绘司隶校尉部与十三刺史部监察区；河西走廊、河套与匈奴边界严格循祁连山、贺兰山与阴山自然分水岭，神爵二年（前 60）后纳入西域都护府统辖之天山南北诸国。',
    },
  ],
  donghan: [
    {
      title: '西域“三绝三通”与西域长史府制度区分',
      detail:
        '精准还原永初元年（107）因羌乱隔绝陇道罢西域都护（107—123 年西域脱离东汉羁縻），至延光二年（123）班勇以西域长史屯柳中复通西域的变迁；此后东汉终世以“西域长史府”行都护之职。',
    },
    {
      title: '永昌郡西界与王景治河故道',
      detail:
        '西南纳入汉明帝永平十二年（69）哀牢内附所置永昌郡（涵盖澜沧江以西叶榆、不韦至高黎贡山）；黄河水系按永平十三年（70）王景治河后由千乘入渤海的东汉至唐宋初故道标绘。',
    },
  ],
  sanguo: [
    {
      title: '魏蜀吴三家僵持的自然山川锁钥',
      detail:
        '曹魏与蜀汉以秦岭褒斜、子午、散关及陇右祁连山分界；曹魏与孙吴于淮南（合肥、寿春、濡须口）及江汉（襄阳、江陵）形成夹淮、夹江南北拉锯；蜀、吴自222年夷陵之战后以巫峡、武陵山脉划界。',
    },
    {
      title: '交广分置、公孙渊辽东与魏灭蜀终局',
      detail:
        '涵盖黄武五年（226）士燮卒后孙权分交州置广州、景初二年（238）司马懿平定辽东燕王公孙渊，以及景元四年（263）邓艾、钟会灭蜀后魏吴南北对峙的晚期格局。',
    },
  ],
  xijin: [
    {
      title: '太康一统十九州制与秦汉古海岸线衔接',
      detail:
        '太康元年（280）王濬楼船下益州克建业灭吴，结束汉末以来近百年分裂，政区按《晋书·地理志》还原司、兖、豫、冀、幽、平、并、雍、凉、秦、梁、益、宁、青、徐、荆、扬、交、广十九州。',
    },
    {
      title: '八王之乱至永嘉五胡起兵的空间因果链',
      detail:
        '在 280—316 年间细分永康（300）、永安（304，刘渊起兵左国城建汉、李雄据成都建国）、永嘉五年（311，洛阳陷落怀帝被掳）与建兴四年（316，长安陷落西晋覆亡）快照，呈现北方裂变过程。',
    },
  ],
  dongjin: [
    {
      title: '北伐消长边界与前秦陷蜀期间的南中（宁州）归属',
      detail:
        '东晋北界随祖逖、桓温、谢玄（淝水之战后收复淮北河南）、刘裕（灭南燕、后秦收复洛阳长安）动态伸缩；373—384 年前秦攻占梁、益二州期间，南中宁州（今云南、黔西）仍由东晋刺史奉晋正朔固守。',
    },
    {
      title: '十六国与吐谷浑去省界化山川校准',
      detail:
        '北方十六国及吐谷浑（317—668）疆界摒弃现代省界套用，沿祁连山、日月山、黄河河曲、太行山与燕山山脉分水岭精密咬合。',
    },
  ],
  nanbei: [
    {
      title: '北魏北疆越过“六镇”抵阴山漠南',
      detail:
        '439 年北魏太武帝统一北方后，北疆越过沃野、怀朔、武川、抚冥、柔玄、怀荒六镇军事防线涵盖阴山以北漠南草场，准确反映六镇拱卫平城与洛阳的战略纵深。',
    },
    {
      title: '东西魏、北齐北周与梁陈江淮拉锯',
      detail:
        '完整还原 534 年北魏分裂后东魏（北齐）与西魏（北周）以黄河、洛阳、潼关争衡，以及侯景之乱后西魏取蜀与江陵（后梁）、北齐尽占淮南至北周灭齐的疆域演变。',
    },
  ],
  sui: [
    {
      title: '大业统郡与隋唐大运河水系贯通',
      detail:
        '按《隋书·地理志》大业三年（607）改州为郡后的建制标绘中原、河北、河东、关陇、巴蜀、江表、淮海、岭南诸郡区，并标绘以东都洛阳为中心贯通南北的永济渠、通济渠、山阳渎与江南河。',
    },
    {
      title: '大业五年（609）西平吐谷浑与河源且末四郡',
      detail:
        '还原隋炀帝大业五年亲征吐谷浑后，于青海湖及柴达木盆地置西海、河源、鄯善、且末四郡的极盛西疆，以及大业末年（617）瓦岗、窦建德、李渊等群雄并起的隋末格局。',
    },
  ],
  tang: [
    {
      title: '安西四镇三度得失与六大都护府动态消长',
      detail:
        '逐阶段还原贞观十四年（640）置安西都护府、显庆二年（657）灭西突厥置昆陵与濛池都护府，以及咸亨元年（670）与垂拱二年（686）安西四镇两度陷于吐蕃、长寿元年（692）王孝杰复四镇、安史之乱后河西陇右尽陷吐蕃直至大中五年（851）张议潮归义军收复河西的完整过程。',
    },
    {
      title: '武周改制（690—705）、开元十五道与南诏兴起',
      detail:
        '690—705 年主政权切换为武则天“周（武周）”并定都神都洛阳；开元二十一年（733）由唐初十道析置为十五道；738 年皮逻阁合一六诏受封云南王，764—907 年间按唐与南诏在大渡河、黔中、雅州、嶲州的实控线划界。',
    },
    {
      title: '开成五年（840）回鹘汗国崩溃后的漠北易主',
      detail:
        '840 年黠戛斯破回鹘牙帐后，漠北高原切换为黠戛斯疆域，回鹘仅存阿尔泰山以西及西迁天山（高昌回鹘）、河西（甘州回鹘）残部。',
    },
  ],
  wudai: [
    {
      title: '十国精确州郡范围：马楚、荆南与杨吴南唐',
      detail:
        '马楚版图不含贵州（黔中土司羁縻区），南包桂管（桂林）至 951 年入南汉；荆南（高氏）独立标绘江陵、归、峡三州锁钥；鄂、黄、蕲三州划归杨吴与南唐。',
    },
    {
      title: '泉漳“清源军”独立割据与后蜀秦凤四州',
      detail:
        '947 年后留从效据泉、漳二州置清源军（名义奉南唐、后周正朔而实为闽南独立割据政区）；秦、凤、阶、成四州自 947 年入后蜀，直至显德二年（955）周世宗西征方入后周。',
    },
  ],
  beisong: [
    {
      title: '燕云十六州宋辽白沟河界线与西北横山拉锯',
      detail:
        '北宋北界循白沟河（今河北保定、雄安至山西雁门关一线）与辽南京道、西京道接壤；西北还原与党项（西夏）在灵州、横山及王韶“熙河开边”（熙河路、陇右河湟）的得失演变。',
    },
    {
      title: '元丰二十三路与大渡河宋理分界',
      detail:
        '按《元丰九域志》标绘二十三路与京畿东京开封府、西京河南府、北京大名府、南京应天府四京；西南四川川峡四路与大理国严格循大渡河及滇西山脉分界。',
    },
  ],
  nansong: [
    {
      title: '绍兴和议“淮河中流—大散关”宋金边界',
      detail:
        '绍兴十二年（1142）《绍兴和议》后，南宋与金朝东起淮河入海口循淮河中流，经唐、邓二州之间西抵秦岭大散关及大渡河，精准呈现两淮、京襄、川陕三大战区防线。',
    },
    {
      title: '金都三迁（上京→中都→汴京）与蒙元灭金包抄南宋',
      detail:
        '同步演绎 1153 年完颜亮迁都燕京（金中都）、1214 年金宣宗避蒙古兵锋南迁汴京（金南京）、1234 年蔡州灭金，以及 1253 年忽必烈革囊渡金沙江灭大理对南宋形成南北合围的格局。',
    },
  ],
  yuan: [
    {
      title: '中书省（腹里）、宣政院与十大行省（含库页岛）',
      detail:
        '还原元代中书省直辖腹里（河北、山东、山西）、宣政院辖吐蕃之地，以及岭北、辽阳（含库页岛苦夷）、河南江北、江浙、江西（含粤东）、湖广（含广西、海南、黔）、陕西、四川、云南、甘肃十大行省。',
    },
    {
      title: '元末（1335 / 1367）周边政权清理与群雄并起',
      detail:
        '1335 年快照及时移除已覆亡的日本镰仓幕府、波斯伊利汗国与缅甸蒲甘王朝；1351—1367 年快照完整刻画韩宋、陈友谅大汉、张士诚大周、明玉珍大夏与朱元璋西吴的兼并过程。',
    },
  ],
  ming: [
    {
      title: '两京十三布政使司、奴儿干都司与交趾布政使司',
      detail:
        '还原京师（北直隶）、南京（南直隶）与十三布政使司，东北纳入永乐七年（1409）所置奴儿干都司（含黑龙江口特林及库页岛囊哈儿卫），西南在 1407—1427 年阶段标绘交趾布政使司。',
    },
    {
      title: '大宁都司的得失（1388—1407 vs 永乐内徙后）',
      detail:
        '洪武二十一年（1388）至永乐初，燕山以北至西辽河流域属明大宁都司；永乐初大宁都司内徙保定、将故地畀予兀良哈朵颜三卫后，明北界退守宣府、蓟镇与明长城一线。',
    },
    {
      title: '明代海岸线与台湾“台江内海”复原',
      detail:
        '苏北、长江口、珠江三角洲及台湾台南海岸均按明代岸线还原，清晰呈现明末荷据与明郑时期一鲲身（安平）沙洲与赤嵌隔“台江内海”相望的古地理形态。',
    },
  ],
  qing: [
    {
      title: '内地十八省、东北三将军与蒙藏新疆藩部体制',
      detail:
        '区分内地十八省布政使司与盛京、吉林、黑龙江三将军辖区、伊犁将军（统辖天山南北与巴尔喀什湖以东）、乌里雅苏台将军（外蒙古喀尔喀四部、唐努乌梁海）及驻藏大臣辖区。',
    },
    {
      title: '1689《尼布楚条约》至 1860《北京条约》边界变迁',
      detail:
        '1689—1858 年东北疆界循外兴安岭至海并囊括库页岛；1858《瑷珲条约》、1860《北京条约》与 1864《勘分西北界约记》后按阶段展示黑龙江以北、乌苏里江以东（含库页岛）与巴尔喀什湖以东的割让过程。',
    },
    {
      title: '台南台江内海淤积（1823）与光绪台湾建省（1885）',
      detail:
        '清初至嘉庆年间台南西侧仍保持台江内海古岸线，道光三年（1823）曾文溪改道注入后台江内海淤积成陆；光绪十一年（1885）台湾由福建台湾道升格建省。',
    },
  ],
  roc: [
    {
      title: '1928年前后“直隶/奉天/北京”改制与首都动态迁徙',
      detail:
        '1928 年 6 月国民革命军克复北京前，省名保持“直隶、奉天”，都城称“北京”；1928 年 6 月后改称“河北、辽宁”与“北平”，并增置热河、察哈尔、绥远、宁夏、青海、西康诸省。首都标记随年份在南京、北京（北洋时期）、武汉与重庆（抗战陪都）间动态跟随。',
    },
    {
      title: '1926年末北伐快照、1938抗战相持态势与外蒙古精密边界',
      detail:
        '单列 1926 年末北伐初年、1938—1944 年抗战相持阶段（重庆陪都大后方、陕甘宁边区与日占沦陷区对峙）等关键历史断面；外蒙古与民国北部诸省共享同一条无裂缝拓扑边界。',
    },
  ],
  prc: [
    {
      title: '现代三十四省级政区沿革与海岸线基准',
      detail:
        '完整收录 23 个省、5 个自治区、4 个直辖市与香港、澳门 2 个特别行政区，涵盖 1954—1955 年省制调整、1988 年海南建省、1997 年重庆直辖及港澳回归等关键里程碑与权威文献出处。',
    },
  ],
};

function renderCartographicNotesSection(d) {
  const notes = DYNASTY_CARTOGRAPHIC_NOTES[d.key];
  if (!Array.isArray(notes) || notes.length === 0) return '';
  const itemsHtml = notes
    .map(
      (n) => `        <div class="carto-note-item">
          <strong>${escHtml(n.title)}</strong>
          <p>${escHtml(n.detail)}</p>
        </div>`
    )
    .join('\n');
  return `    <section class="section-card">
      <h2>四、${escHtml(d.title)}舆图边界、山川形胜与政区考据札记</h2>
      <p>以下记录「江山时序」在绘制${escHtml(d.title)}（${fmtDynSpanZh(d)}）疆域多边形、古海岸线与州郡政区时所依据的历史地理考据准则：</p>
      <div class="carto-note-grid">
${itemsHtml}
      </div>
    </section>\n\n`;
}

function buildDynastyPage(d, idx, allDynasties, snapshots, enLocale, ctrl, provinces, sourcesBundle) {
  ctrl.locale = 'en';
  const titleEn = ctrl.dynastyName(d);
  const seatEn = ctrl.dynastySeat(d);
  const summaryEn = ctrl.dynastySummary(d);
  ctrl.locale = 'zh';

  const focusY = d.focusYear !== undefined ? d.focusYear : d.fromYear;
  const spanZh = fmtDynSpanZh(d);
  const spanEn = fmtDynSpanEn(d);
  const canonicalUrl = `${BASE_URL}/topics/${d.key}.html`;
  const mapUrl = `${BASE_URL}/?year=${focusY}`;

  const pageTitle = `${d.title}历史地图（${spanZh} · ${titleEn}）· 疆域演变、州郡政区、古今地名对照与重大事件 | 江山时序`;
  const spanFullZh = d.key === 'prc' ? `${fmtYearZh(d.fromYear)}至今` : `${fmtYearZh(d.fromYear)}至${fmtYearZh(d.toYear)}`;
  const pageDesc = `${d.title}历史地图（${spanFullZh}，都城：${d.seat}）：${d.summary} 收录${(d.phases || []).length || 1}幅多阶段版图快照、${(d.settlements || []).length}座城池古今地名对照与${(d.milestones || []).length}项编年重大历史事件。`;

  const phases = d.phases && d.phases.length > 0 ? d.phases : [{ until: d.toYear, snap: d.snapKey }];
  const usePrefectureDivs = d.key === 'zhanguo' || d.key === 'qin';
  let prevPolities = [];
  let prevPrefs = [];
  const phaseRowsHtml = phases
    .map((ph, pIdx) => {
      const sy = pIdx === 0 ? d.fromYear : phases[pIdx - 1].until;
      const ey = (ph.until === undefined || pIdx === phases.length - 1) ? d.toYear : ph.until - 1;
      const midYear = sy === 0 ? 1 : Math.floor((sy + ey) / 2);
      const eraStr = ctrl.formatEraLabel(midYear, d);
      const sk = ph.snap || ph.snapKey || d.snapKey;

      let polities = [];
      let prefs = [];
      let snapCaption = '';
      if (d.key === 'prc') {
        polities = ['中华人民共和国'];
        prefs = (provinces || []).map((p) => p.title).filter(Boolean);
      } else if (sk && snapshots[sk]) {
        const snap = snapshots[sk];
        if (snap.caption) {
          snapCaption = String(snap.caption).replace(/^[^·]+·\s*/, '').trim();
        }
        polities = Array.from(
          new Set(
            (snap.polities || [])
              .filter((p) => p.role === 'main' || p.role === 'rival' || p.role === 'protectorate')
              .map((p) => p.title)
              .filter(Boolean)
          )
        );
        const primaryDivs = usePrefectureDivs
          ? snap.prefectures || snap.regions || []
          : snap.regions || [];
        prefs = Array.from(new Set(primaryDivs.map((r) => r.title).filter(Boolean)));
      }
      const overviewRaw = String(ph.overview || snapCaption || '')
        .replace(/^[^·]{1,28}·\s*/, '')
        .trim();
      const overviewText = overviewRaw
        ? `<br/><small style="color:#5e5346;">${escHtml(overviewRaw)}</small>`
        : '';
      const phaseSpanStr =
        d.key === 'prc' && pIdx === phases.length - 1
          ? `${fmtYearShortZh(sy)} —`
          : `${fmtYearShortZh(sy)} — ${fmtYearShortZh(ey)}`;

      let prefCellHtml = '';
      if (pIdx === 0) {
        const baseList = escHtml(prefs.slice(0, 14).join('、') || '全境省区');
        const moreSuffix = prefs.length > 14 ? ` 等共 ${prefs.length} 个政区` : '';
        prefCellHtml = `${baseList}${moreSuffix}`;
      } else {
        const comparePrefs = prefs.length > 0 && prevPrefs.length > 0;
        const addedPrefs = comparePrefs ? prefs.filter((x) => !prevPrefs.includes(x)) : [];
        const removedPrefs = comparePrefs ? prevPrefs.filter((x) => !prefs.includes(x)) : [];
        const addedPols = polities.filter((x) => !prevPolities.includes(x));
        const removedPols = prevPolities.filter((x) => !polities.includes(x));
        const diffLines = [];
        if (addedPols.length) {
          diffLines.push(`<span class="diff-add">＋新增/建置：</span>${escHtml(addedPols.join('、'))}`);
        }
        if (removedPols.length) {
          diffLines.push(`<span class="diff-rem">－更替/罢撤：</span>${escHtml(removedPols.join('、'))}`);
        }
        if (addedPrefs.length) {
          diffLines.push(
            `<span class="diff-add">＋新增政区：</span>${escHtml(addedPrefs.slice(0, 10).join('、'))}${
              addedPrefs.length > 10 ? ` 等 ${addedPrefs.length} 处` : ''
            }`
          );
        }
        if (removedPrefs.length) {
          diffLines.push(
            `<span class="diff-rem">－失守/省并政区：</span>${escHtml(removedPrefs.slice(0, 10).join('、'))}${
              removedPrefs.length > 10 ? ` 等 ${removedPrefs.length} 处` : ''
            }`
          );
        }
        if (diffLines.length > 0) {
          prefCellHtml = diffLines.join('<br/>');
        } else {
          const divCount = prefs.length || prevPrefs.length;
          prefCellHtml = `<span class="diff-same">州道/省区建制同上阶段${divCount ? `（共 ${divCount} 政区）` : ''}，详见左侧阶段提要</span>`;
        }
      }
      prevPolities = polities;
      if (prefs.length > 0) prevPrefs = prefs;

      return `          <tr>
            <td>第 ${pIdx + 1} 阶段</td>
            <td><strong>${phaseSpanStr}</strong><br/><small>${escHtml(eraStr)}</small>${overviewText}</td>
            <td>${escHtml(polities.join('、') || d.title)}</td>
            <td>${prefCellHtml}</td>
            <td><a href="${BASE_URL}/?year=${midYear}">查看 ${fmtYearShortZh(midYear)}年 舆图 →</a></td>
          </tr>`;
    })
    .join('\n');

  const settlements = d.settlements || [];
  const settlementRowsHtml = settlements
    .map((s) => {
      const roleStr = s.isCapital ? '★ 都城/首府' : s.tier === 1 ? '核心重镇' : '州郡治所/名城';
      const placeLink = `${BASE_URL}/?year=${focusY}&place=${encodeURIComponent(s.ancient)}`;
      return `          <tr>
            <td><strong>${escHtml(s.ancient)}</strong></td>
            <td>${escHtml(s.modern || s.ancient)}</td>
            <td>${roleStr}</td>
            <td>${s.coord[0].toFixed(2)}°E, ${s.coord[1].toFixed(2)}°N</td>
            <td><a href="${escHtml(placeLink)}">地图定位与沿革 →</a></td>
          </tr>`;
    })
    .join('\n');

  const milestones = d.milestones || [];
  const milestoneRowsHtml = milestones
    .map((m) => {
      const mk = `${d.key}:${m.year}`;
      const enPair = (enLocale.milestones && enLocale.milestones[mk]) || [];
      const eraLabel = ctrl._eventEraLabel(d, m);
      const mUrl = `${BASE_URL}/?year=${m.year}`;
      const storyMatch =
        typeof ctrl._findStoryForMilestone === 'function'
          ? ctrl._findStoryForMilestone(d.key, m)
          : null;
      const storyBadgeHtml = storyMatch
        ? `<a class="story-link-pill" href="${BASE_URL}/topics/story-${escHtml(storyMatch.key)}.html">始末沙盘图志 &rarr;</a>`
        : '';
      const citeHtml = formatSourceCitationsHtml(`milestone:${mk}`, sourcesBundle);
      return `          <tr>
            <td><strong>${fmtYearShortZh(m.year)}年</strong><br/><small>${escHtml(eraLabel)}</small></td>
            <td><strong>${escHtml(m.headline)}</strong>${storyBadgeHtml}${enPair[0] ? `<br/><small>${escHtml(enPair[0])}</small>` : ''}</td>
            <td>${escHtml(m.note || '')}${citeHtml}</td>
            <td><a href="${escHtml(mUrl)}">定格此年 →</a></td>
          </tr>`;
    })
    .join('\n');

  const prevDyn = idx > 0 ? allDynasties[idx - 1] : null;
  const nextDyn = idx < allDynasties.length - 1 ? allDynasties[idx + 1] : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: pageTitle,
        description: pageDesc,
        url: canonicalUrl,
        datePublished: LASTMOD,
        dateModified: LASTMOD,
        inLanguage: ['zh-CN', 'en'],
        author: {
          '@type': 'Organization',
          name: '江山时序 (Jiangshan Historical Atlas)',
          url: `${BASE_URL}/`,
        },
        isPartOf: {
          '@type': 'WebSite',
          name: '江山时序 · 中国历史地图',
          url: `${BASE_URL}/`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '江山时序首页', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: '专题图志总览', item: `${BASE_URL}/topics/index.html` },
          { '@type': 'ListItem', position: 3, name: `${d.title}历史地图（${spanZh}）`, item: canonicalUrl },
        ],
      },
    ],
  };

  const keywords = [
    `${d.title}历史地图`,
    `${d.title}版图疆域`,
    `${d.title}行政区划州郡`,
    `${d.title}古今地名对照表`,
    `${d.title}都城${d.seat}`,
    `${titleEn} historical map`,
    '中国历史地图时间轴',
    '江山时序',
  ];

  const html = `${renderSharedHead({
    title: pageTitle,
    description: pageDesc,
    keywords,
    canonicalUrl,
    jsonLdObj: jsonLd,
  })}
<body>
${renderTopHeader()}
  <main>
    <nav class="breadcrumb" aria-label="面包屑导航">
      <a href="${BASE_URL}/">江山时序首页</a> &rsaquo;
      <a href="${BASE_URL}/topics/index.html">专题图志总目录</a> &rsaquo;
      <span>${escHtml(d.title)}历史地图（${escHtml(spanZh)}）</span>
    </nav>

    <article class="hero-card">
      <span class="kicker">中国历代疆域与政区专题图志 · 第 ${idx + 1} / ${allDynasties.length} 篇</span>
      <h1>${escHtml(d.title)}历史地图（${escHtml(spanZh)}）· 疆域演变、州郡政区与古今地名</h1>
      <p class="en-sub">${escHtml(titleEn)} Historical Atlas (${escHtml(spanEn)}) · Capital: ${escHtml(seatEn)}</p>
      <div class="meta-pills">
        <span class="meta-pill"><strong>起止年代：</strong>${d.key === 'prc' ? `${fmtYearZh(d.fromYear)} —` : `${fmtYearZh(d.fromYear)} — ${fmtYearZh(d.toYear)}`}</span>
        <span class="meta-pill"><strong>历代都城：</strong>${escHtml(d.seat)}</span>
        <span class="meta-pill"><strong>版图演变阶段：</strong>${phases.length} 个时期快照</span>
        <span class="meta-pill"><strong>收录名城：</strong>${settlements.length} 座古城</span>
        <span class="meta-pill"><strong>编年大事：</strong>${milestones.length} 项关键节点</span>
      </div>
      <p>${escHtml(d.summary)}</p>
      ${summaryEn ? `<p class="en-sub">${escHtml(summaryEn)}</p>` : ''}
      <div class="cta-row">
        <a class="cta-btn" href="${escHtml(mapUrl)}">立即打开「${escHtml(d.title)}」交互式历史地图（${fmtYearShortZh(focusY)}年）&rarr;</a>
        <a class="cta-btn secondary" href="${escHtml(mapUrl)}&amp;lang=en">Open Interactive Map in English &rarr;</a>
        ${prevDyn ? `<a class="cta-btn secondary" href="${BASE_URL}/topics/${prevDyn.key}.html">&larr; 上一时期：${escHtml(prevDyn.title)}</a>` : ''}
        ${nextDyn ? `<a class="cta-btn secondary" href="${BASE_URL}/topics/${nextDyn.key}.html">下一时期：${escHtml(nextDyn.title)} &rarr;</a>` : ''}
      </div>
    </article>

${renderEmbedMapSection({
  iframeSrc: `../?embed=1&year=${focusY}&from=${d.fromYear}&to=${d.key === 'prc' ? 2026 : d.toYear}`,
  titleZh: `${d.title}交互式历史舆图预览（${spanZh} · 可拨动底部时间轴切换阶段）`,
  hintZh: '点击地图激活交互 · 右上角可全屏打开主地图',
})}

    <section class="section-card">
      <h2>一、${escHtml(d.title)}版图演变阶段与政权州郡格局（${phases.length} 阶段快照）</h2>
      <p>在「江山时序」交互式舆图中拖动底部时间轴滑块，或点击下方各阶段链接，即可查看${escHtml(d.title)}不同年份的政权疆域消长、州道郡县边界及黄河改道水系：</p>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>阶段</th>
              <th>年代范围与代表年号</th>
              <th>并立政权 / 核心版图</th>
              <th>政区格局与阶段疆域变化</th>
              <th>交互式地图直达</th>
            </tr>
          </thead>
          <tbody>
${phaseRowsHtml}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section-card">
      <h2>二、${escHtml(d.title)}古今地名对照表与点地溯源（共收录 ${settlements.length} 座城池）</h2>
      <p>点击任一城池右侧的「地图定位与沿革」，即可在地图上自动飞跃至该城坐标并展开「点地溯源 · 两千四百年政区沿革」卡片：</p>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>历史古地名</th>
              <th>现代对应省市 / 地点</th>
              <th>层级</th>
              <th>经纬度坐标</th>
              <th>点地溯源</th>
            </tr>
          </thead>
          <tbody>
${settlementRowsHtml}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section-card">
      <h2>三、${escHtml(d.title)}重大历史事件编年表与正史出处（${milestones.length} 项）</h2>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>年份与帝王年号</th>
              <th>历史事件（中英对照）</th>
              <th>史事背景、地理空间影响与史料出处</th>
              <th>地图定格</th>
            </tr>
          </thead>
          <tbody>
${milestoneRowsHtml}
          </tbody>
        </table>
      </div>
    </section>

${renderCartographicNotesSection(d)}${renderFooter(allDynasties)}
  </main>
</body>
</html>
`;

  fs.writeFileSync(path.join(TOPICS_DIR, `${d.key}.html`), html, 'utf8');
  return {
    slug: d.key,
    url: canonicalUrl,
    titleZh: `${d.title}历史地图（${spanZh}）`,
    titleEn: `${titleEn} Historical Map (${spanEn})`,
    descZh: `${d.seat} · ${phases.length}阶段版图 · ${settlements.length}座古城与${milestones.length}项大事`,
    descEn: `Capital: ${seatEn} · ${phases.length} territory phases, ${settlements.length} cities & ${milestones.length} events`,
  };
}

function buildStorylinePage(s, idx, allStories, allDynasties, sourcesBundle) {
  const slug = `story-${s.key}`;
  const canonicalUrl = `${BASE_URL}/topics/${slug}.html`;
  const mapUrl = `${BASE_URL}/?event=${encodeURIComponent(s.key)}`;
  const stops = s.stops || [];
  const camps = s.camps || [];
  const spanZh =
    Array.isArray(s.span) && s.span.length === 2
      ? `${fmtYearShortZh(s.span[0])}—${fmtYearShortZh(s.span[1])}年`
      : '';
  const spanEn =
    Array.isArray(s.span) && s.span.length === 2
      ? `${fmtYearEn(s.span[0])} – ${fmtYearEn(s.span[1])}`
      : '';

  const stopsChainZh = stops.map((st) => `${st.ancientZh}（今${st.modernZh}）`).join(' → ');
  const stopsChainEn = stops.map((st) => `${st.ancientEn} (${st.modernEn})`).join(' → ');

  const pageTitle = `${s.zh}历史地图（${spanZh} · ${s.en}）· 双阵营对抗沙盘、${stops.length}站全过程与史料出处 | 江山时序`;
  const pageDesc = `${s.zh}（${s.en}，${s.courtesyZh}）：${s.descZh} 全程共 ${stops.length} 个关键时空节点（${stopsChainZh}），提供双阵营对抗沙盘、古今地名对照与一手史籍出处。`;

  const campMap = new Map(camps.map((c) => [c.key, c]));
  const campPillsHtml = camps
    .map(
      (c) =>
        `<span class="meta-pill"><span class="camp-badge" style="background:${escHtml(c.color || '#9e2a22')};">${escHtml(
          c.zh
        )}</span><small>${escHtml(c.en)}</small></span>`
    )
    .join('\n        ');

  const personSourceHtml = formatSourceCitationsHtml(`person:${s.key}`, sourcesBundle);

  let lastActZh = '';
  const stopCardsHtml = stops
    .map((st, sIdx) => {
      let actHeaderHtml = '';
      if (st.actZh && st.actZh !== lastActZh) {
        lastActZh = st.actZh;
        actHeaderHtml = `      <div class="act-heading">${escHtml(st.actZh)}${
          st.actEn ? ` <small style="font-weight:400; color:#5e5346; margin-left:0.5rem;">${escHtml(st.actEn)}</small>` : ''
        }</div>\n`;
      }
      const campObj = campMap.get(st.camp);
      const campBadgeHtml = campObj
        ? `<span class="camp-badge" style="background:${escHtml(campObj.color || '#9e2a22')};">${escHtml(campObj.zh)}</span>`
        : '';
      const stopMapUrl = `${BASE_URL}/?event=${encodeURIComponent(s.key)}&stop=${sIdx}`;
      const actorsList = Array.isArray(st.actors) && st.actors.length
        ? `<div style="font-size:0.85rem; color:#5e5346; margin:0.2rem 0;"><strong>核心人物：</strong>${st.actors
            .map((a) => `${escHtml(a.zh)}（${escHtml(a.en)}）`)
            .join('、')}</div>`
        : '';
      const vectorParts = [];
      if (st.fromLabelZh) vectorParts.push(st.fromLabelZh);
      if (Array.isArray(st.prongs)) {
        for (const pr of st.prongs) {
          if (pr.fromLabelZh) vectorParts.push(pr.fromLabelZh);
        }
      }
      const vectorHtml = vectorParts.length
        ? `<div style="font-size:0.85rem; color:#5e5346; margin:0.2rem 0;"><strong>进军方向：</strong>自 ${escHtml(
            vectorParts.join(' / ')
          )} 推进至 ${escHtml(st.ancientZh)}</div>`
        : '';
      const timeLabelZh = `${fmtYearShortZh(st.year)}年${st.subEraZh ? ` · ${st.subEraZh}` : ''}`;

      return `${actHeaderHtml}      <div class="stop-card">
        <div class="stop-header">
          <div>
            <span class="stop-badge">第 ${sIdx + 1} 幕</span>${campBadgeHtml}
            <strong>${escHtml(st.ancientZh)}（今${escHtml(st.modernZh)}）· ${escHtml(st.titleZh)}</strong>
            <small style="color:#5e5346; margin-left:0.4rem;">${escHtml(st.ancientEn)} (${escHtml(st.modernEn)}) — ${escHtml(st.titleEn)}</small>
          </div>
          <div>
            <strong>${escHtml(timeLabelZh)}</strong> ·
            <a href="${escHtml(stopMapUrl)}" style="color:#9e2a22; text-decoration:none; font-weight:600;">沙盘推演此站 &rarr;</a>
          </div>
        </div>
        ${actorsList}${vectorHtml}
        <p style="margin:0.4rem 0;">${escHtml(st.descZh)}</p>
        <p class="en-sub" style="margin:0.25rem 0 0.5rem;">${escHtml(st.descEn)}</p>
        ${
          st.quoteZh
            ? `<blockquote class="poem-box">${escHtml(st.quoteZh)}<cite>${escHtml(st.quoteEn || '')}</cite></blockquote>`
            : ''
        }
      </div>`;
    })
    .join('\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: pageTitle,
        description: pageDesc,
        url: canonicalUrl,
        datePublished: LASTMOD,
        dateModified: LASTMOD,
        inLanguage: ['zh-CN', 'en'],
        author: {
          '@type': 'Organization',
          name: '江山时序 (Jiangshan Historical Atlas)',
          url: `${BASE_URL}/`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '江山时序首页', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: '专题图志总览', item: `${BASE_URL}/topics/index.html` },
          { '@type': 'ListItem', position: 3, name: `${s.zh}历史地图`, item: canonicalUrl },
        ],
      },
    ],
  };

  const keywords = [
    `${s.zh}历史地图`,
    `${s.zh}路线图`,
    `${s.zh}全过程地图`,
    ...(s.aliases || []),
    ...stops.map((st) => st.ancientZh),
    '事件始末沙盘',
    '江山时序',
  ];

  const html = `${renderSharedHead({
    title: pageTitle,
    description: pageDesc,
    keywords,
    canonicalUrl,
    jsonLdObj: jsonLd,
  })}
<body>
${renderTopHeader()}
  <main>
    <nav class="breadcrumb" aria-label="面包屑导航">
      <a href="${BASE_URL}/">江山时序首页</a> &rsaquo;
      <a href="${BASE_URL}/topics/index.html">专题图志总目录</a> &rsaquo;
      <span>${escHtml(s.zh)}（${escHtml(spanZh)}）</span>
    </nav>

    <article class="hero-card">
      <span class="kicker">事件始末 · 双阵营对抗历史沙盘图志（第 ${idx + 1} / ${allStories.length} 篇）</span>
      <h1>${escHtml(s.zh)}历史地图（${escHtml(s.courtesyZh)}）</h1>
      <p class="en-sub">${escHtml(s.en)} (${escHtml(s.courtesyEn)})</p>
      <div class="meta-pills">
        <span class="meta-pill"><strong>起止年代：</strong>${escHtml(spanZh)}</span>
        <span class="meta-pill"><strong>推演节点：</strong>共 ${stops.length} 站</span>
        ${campPillsHtml}
      </div>
      <p>${escHtml(s.descZh)}</p>
      <p class="en-sub">${escHtml(s.descEn)}</p>
      <p><strong>全线关键节点：</strong>${escHtml(stopsChainZh)}。</p>
      ${personSourceHtml}
      <div class="cta-row">
        <a class="cta-btn" href="${escHtml(mapUrl)}">在交互式地图中推演「${escHtml(s.zh)}」双阵营沙盘 &rarr;</a>
        <a class="cta-btn secondary" href="${escHtml(mapUrl)}&amp;lang=en">Open Two-Camp Sandtable in English &rarr;</a>
        <a class="cta-btn secondary" href="${BASE_URL}/topics/index.html">返回专题图志总览</a>
      </div>
    </article>

${renderEmbedMapSection({
  iframeSrc: `../?embed=1&event=${encodeURIComponent(s.key)}`,
  titleZh: `${s.zh}双阵营对抗历史沙盘实时预览（${spanZh}）`,
  hintZh: '点击地图即可交互推演 · 右上角可全屏打开沙盘',
})}

    <section class="section-card">
      <h2>${escHtml(s.zh)} · 全程 ${stops.length} 幕时空推演、古今地名与史料引文详解</h2>
${stopCardsHtml}
    </section>

${renderFooter(allDynasties)}
  </main>
</body>
</html>
`;

  fs.writeFileSync(path.join(TOPICS_DIR, `${slug}.html`), html, 'utf8');
  return {
    slug,
    key: s.key,
    url: canonicalUrl,
    titleZh: `${s.zh}历史地图（${spanZh}）`,
    titleEn: `${s.en} (${spanEn})`,
    descZh: `${s.courtesyZh} · 双阵营${stops.length}站沙盘：${stops.map((st) => st.ancientZh).join(' → ')}`,
    descEn: `${s.courtesyEn} · ${stops.length}-stop sandtable: ${stops.map((st) => st.ancientEn).join(' → ')}`,
  };
}

function buildJourneyPage(j, idx, allJourneys, allDynasties, sourcesBundle) {
  const slug = `journey-${j.key}`;
  const canonicalUrl = `${BASE_URL}/topics/${slug}.html`;
  const mapUrl = `${BASE_URL}/?person=${encodeURIComponent(j.key)}`;
  const stops = j.stops || [];
  const stopsChainZh = stops.map((s) => `${s.ancientZh}（今${s.modernZh}）`).join(' → ');
  const stopsChainEn = stops.map((s) => `${s.ancientEn} (${s.modernEn})`).join(' → ');

  const cleanSpanZh = j.spanZh.replace(/[（）()]/g, ' · ').replace(/\s*·\s*$/, '');
  const cleanSpanEn = j.spanEn.replace(/[（）()]/g, ' · ').replace(/\s*·\s*$/, '');

  const pageTitle = `${j.titleZh}路线图（${cleanSpanZh}）· ${stops.length}站古今地名对照与诗词纪事 | 江山时序`;
  const pageDesc = `${j.titleZh}（${j.titleEn}，${cleanSpanZh}）历史地图时空轨迹，全线共 ${stops.length} 站：${stopsChainZh}。提供逐站帝王年号、古今政区对照、经典史料诗词与交互式路线回放。`;

  const yearSeen = new Map();
  const stopCardsHtml = stops
    .map((s, sIdx) => {
      const cnt = (yearSeen.get(s.year) || 0) + 1;
      yearSeen.set(s.year, cnt);
      const stopKeySuffix = cnt > 1 ? `${s.year}-${cnt}` : `${s.year}`;
      const stopCiteHtml = formatSourceCitationsHtml(`journey:${j.key}:${stopKeySuffix}`, sourcesBundle);
      const stopMapUrl = `${BASE_URL}/?person=${encodeURIComponent(j.key)}&stop=${sIdx}`;
      return `      <div class="stop-card">
        <div class="stop-header">
          <div>
            <span class="stop-badge">第 ${sIdx + 1} 站</span>
            <strong>${escHtml(s.ancientZh)}（今${escHtml(s.modernZh)}）· ${escHtml(s.titleZh)}</strong>
            <small style="color:#5e5346; margin-left:0.4rem;">${escHtml(s.ancientEn)} (${escHtml(s.modernEn)}) — ${escHtml(s.titleEn)}</small>
          </div>
          <div>
            <strong>${fmtYearShortZh(s.year)}年（${escHtml(s.eraZh)}）</strong> ·
            <a href="${escHtml(stopMapUrl)}" style="color:#9e2a22; text-decoration:none; font-weight:600;">在地图定位此站 &rarr;</a>
          </div>
        </div>
        <p style="margin:0.4rem 0;">${escHtml(s.descZh)}</p>
        <p class="en-sub" style="margin:0.25rem 0 0.5rem;">${escHtml(s.descEn)}</p>
        ${
          s.quoteZh
            ? `<blockquote class="poem-box">${escHtml(s.quoteZh)}<cite>${escHtml(s.quoteEn || '')}</cite></blockquote>`
            : ''
        }${stopCiteHtml}
      </div>`;
    })
    .join('\n');

  const personSourceHtml = formatSourceCitationsHtml(`person:${j.key}`, sourcesBundle);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: pageTitle,
        description: pageDesc,
        url: canonicalUrl,
        datePublished: LASTMOD,
        dateModified: LASTMOD,
        inLanguage: ['zh-CN', 'en'],
        author: {
          '@type': 'Organization',
          name: '江山时序 (Jiangshan Historical Atlas)',
          url: `${BASE_URL}/`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '江山时序首页', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: '专题图志总览', item: `${BASE_URL}/topics/index.html` },
          { '@type': 'ListItem', position: 3, name: j.titleZh, item: canonicalUrl },
        ],
      },
    ],
  };

  const keywords = [
    `${j.titleZh}`,
    `${j.shortZh}路线图`,
    `${j.shortZh}古今地名对照`,
    `${j.titleEn} map`,
    ...stops.map((s) => s.ancientZh),
    '点人溯事',
    '江山时序',
  ];

  const html = `${renderSharedHead({
    title: pageTitle,
    description: pageDesc,
    keywords,
    canonicalUrl,
    jsonLdObj: jsonLd,
  })}
<body>
${renderTopHeader()}
  <main>
    <nav class="breadcrumb" aria-label="面包屑导航">
      <a href="${BASE_URL}/">江山时序首页</a> &rsaquo;
      <a href="${BASE_URL}/topics/index.html">专题图志总目录</a> &rsaquo;
      <span>${escHtml(j.titleZh)}</span>
    </nav>

    <article class="hero-card">
      <span class="kicker">点人溯事 · 历史人物生平行迹专题（第 ${idx + 1} / ${allJourneys.length} 篇）</span>
      <h1>${escHtml(j.titleZh)}（${escHtml(cleanSpanZh)}）</h1>
      <p class="en-sub">${escHtml(j.titleEn)} (${escHtml(cleanSpanEn)})</p>
      <div class="meta-pills">
        <span class="meta-pill"><strong>时代跨度：</strong>${escHtml(cleanSpanZh)}</span>
        <span class="meta-pill"><strong>途经站点：</strong>共 ${stops.length} 站</span>
        <span class="meta-pill"><strong>起点 → 终点：</strong>${escHtml(stops[0].ancientZh)} → ${escHtml(stops[stops.length - 1].ancientZh)}</span>
      </div>
      <p><strong>全线途经古今地名：</strong>${escHtml(stopsChainZh)}。</p>
      <p class="en-sub"><strong>Route Stops:</strong> ${escHtml(stopsChainEn)}.</p>
      ${personSourceHtml}
      <div class="cta-row">
        <a class="cta-btn" href="${escHtml(mapUrl)}">在交互式历史地图中播放「${escHtml(j.titleZh)}」全线动画 &rarr;</a>
        <a class="cta-btn secondary" href="${escHtml(mapUrl)}&amp;lang=en">Play Interactive Journey in English &rarr;</a>
      </div>
    </article>

${renderEmbedMapSection({
  iframeSrc: `../?embed=1&person=${encodeURIComponent(j.key)}`,
  titleZh: `${j.titleZh}交互式历史舆图路线预览（${cleanSpanZh}）`,
  hintZh: '点击地图即可缩放查看各站 · 右上角可全屏播放动画',
})}

    <section class="section-card">
      <h2>${escHtml(j.titleZh)} · 逐站时空坐标、古今地名与史料诗词详解（${stops.length} 站）</h2>
${stopCardsHtml}
    </section>

${renderFooter(allDynasties)}
  </main>
</body>
</html>
`;

  fs.writeFileSync(path.join(TOPICS_DIR, `${slug}.html`), html, 'utf8');
  return {
    slug,
    url: canonicalUrl,
    titleZh: `${j.titleZh}（${cleanSpanZh}）`,
    titleEn: `${j.titleEn} (${cleanSpanEn})`,
    descZh: `共${stops.length}站：${stops.map((s) => s.ancientZh).join(' → ')}`,
    descEn: `${stops.length} stops: ${stops.map((s) => s.ancientEn).join(' → ')}`,
  };
}

function buildFeaturedTopicPage(topic, allDynasties, ctrl) {
  const canonicalUrl = `${BASE_URL}/topics/${topic.slug}.html`;
  const info = ctrl.inspect(topic.inspectQuery);
  const isRoute = Array.isArray(info.route) && info.route.length > 1;

  const pageTitle = `${topic.titleZh} · 古今地名政区沿革 | 江山时序`;
  const pageDesc = `${topic.titleZh}：${topic.summaryZh.slice(0, 140)}… 交互式历史地图定位、帝王年号与两千四百年古今政区沿革。`;

  let detailSectionHtml = '';
  if (isRoute) {
    const routeRows = info.route
      .map((st, idx) => {
        const stopLink = `${BASE_URL}/?year=${st.year}&place=${encodeURIComponent(st.place)}`;
        let placeDisplay = st.place;
        if (topic.slug === 'dufu-763' && st.place === '洛阳') {
          placeDisplay = '洛阳（东都 / 河南府）';
        } else if (st.resolvedName && st.resolvedName !== st.place && !st.resolvedName.includes('亭')) {
          placeDisplay = `${st.place}（${st.resolvedName}）`;
        }
        let modernLoc = st.modern || '';
        let modProv = st.modernProvince || '';
        if (topic.slug === 'wentianxiang-lingdingyang' && st.place === '零丁洋') {
          modernLoc = '广东珠江口伶仃洋海面';
          modProv = '广东省';
        }
        let adminStr = Array.from(new Set([...(st.regions || []), ...(st.prefectures || [])]))
          .map((p) => p.replace(/\(([^)]+)\)/g, '（$1）'))
          .join(' · ');
        if (topic.slug === 'sushi-exile' && st.year >= 1021 && adminStr.includes('祯州')) {
          adminStr = adminStr.replace(/祯州/g, '惠州');
        }
        let polityStr = st.polity || '';
        if (topic.slug === 'wentianxiang-lingdingyang') {
          if (st.place === '零丁洋') {
            polityStr = '南宋抗元水军海域';
            adminStr = '元军水陆围攻';
          } else if (st.place === '崖山') {
            polityStr = '南宋流亡行朝据点（元军合围）';
            adminStr = '广南东路 · 广州（元江西行省广州路）';
          } else if (st.place === '惶恐滩') {
            polityStr = '元军控制（文天祥抗元收复吉州）';
            adminStr = '江南西路 · 吉州（元江西行省吉安路）';
          }
        }
        let eraStr = st.era;
        if (topic.slug === 'wentianxiang-lingdingyang') {
          if (st.year === 1277) eraStr = '南宋端宗·景炎二年（元至元十四年）';
          else if (st.year === 1279) eraStr = '南宋少帝·祥兴二年（元至元十六年）';
        }
        const adminCombined = [polityStr, adminStr].filter(Boolean).join(' · ');

        return `          <tr>
            <td>第 ${idx + 1} 站</td>
            <td><strong>${fmtYearShortZh(st.year)}年</strong><br/><small>${escHtml(eraStr)}</small></td>
            <td><strong>${escHtml(placeDisplay)}</strong></td>
            <td>${escHtml(modernLoc)}${modProv ? `（${escHtml(modProv)}）` : ''}</td>
            <td>${escHtml(adminCombined)}</td>
            <td>${st.coord[0].toFixed(2)}°E, ${st.coord[1].toFixed(2)}°N</td>
            <td><a href="${escHtml(stopLink)}">单站定位 &rarr;</a></td>
          </tr>`;
      })
      .join('\n');

    detailSectionHtml = `    <section class="section-card">
      <h2>一、路线各站时空坐标与历史政区解析（总航程/里程约 ${info.routeDistanceKm} 公里）</h2>
      <p>以下数据由「江山时序」历史地理引擎（<code>window.atlasAPI.inspect</code>）按各站对应历史年份自动解算：</p>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>站序</th>
              <th>历史年份与年号</th>
              <th>诗文/史籍古地名</th>
              <th>现代地理位置</th>
              <th>当时所属政权与州道政区</th>
              <th>经纬度</th>
              <th>交互式地图</th>
            </tr>
          </thead>
          <tbody>
${routeRows}
          </tbody>
        </table>
      </div>
    </section>`;
  } else {
    // Single place: compute 18-dynasty administrative genealogy at this coordinate/place!
    const targetPlace = topic.inspectQuery.place;
    const resolvedDisplayTitle = topic.targetDisplayTitle || info.resolvedName || targetPlace;

    const genRows = allDynasties
      .map((d) => {
        const sampleY = d.focusYear !== undefined ? d.focusYear : d.fromYear;
        const dInfo = ctrl.inspect({ year: sampleY, place: targetPlace });
        // In early Warring States (-403 BCE), only border commanderies (上党郡, 上郡, 关中内史) existed;
        // avoid nearest-vertex region fallback assigning 关中（内史）or 上党郡 to Chu/Yue heartland cities.
        const rawAdminList =
          d.key === 'zhanguo'
            ? dInfo.polity === '秦'
              ? [...(dInfo.regions || []), ...(dInfo.prefectures || [])]
              : dInfo.prefectures || []
            : [...(dInfo.regions || []), ...(dInfo.prefectures || [])];
        const adminParts = Array.from(
          new Set(rawAdminList.map((p) => String(p).replace(/\(([^)]+)\)/g, '（$1）')))
        ).filter(Boolean);
        let adminStr =
          adminParts.join(' · ') ||
          (d.key === 'zhanguo' ? `${dInfo.polity || d.title}直辖（未设郡）` : `${dInfo.polity || d.title}直辖`);
        if (topic.slug === 'xinqiji-jingkou' && d.key === 'qin') {
          adminStr = '会稽郡（鄣郡）';
        } else if (topic.slug === 'battle-chibi') {
          if (d.key === 'donghan') adminStr = '荆州（刺史部） · 江夏郡';
          else if (d.key === 'sanguo' || d.key === 'dongjin') adminStr = '荆州 · 江夏郡';
        } else if (topic.slug === 'hanyu-languan' && (d.key === 'dongjin' || d.key === 'nanbeichao')) {
          adminStr = '雍州 · 京兆郡（上洛郡界）';
        }

        const cleanFallbackSeat = `${targetPlace}（今${info.modern || ''}）`;
        let nearStr = '';
        if (topic.slug === 'shuihu-jiangzhou') {
          const nc = dInfo.nearestCity;
          if (nc && nc.distanceKm <= 55 && !nc.ancient.includes('琵琶亭')) {
            nearStr =
              nc.distanceKm <= 25
                ? `${nc.ancient}（今${nc.modern}）`
                : `${nc.ancient}（今${nc.modern}，距 ${nc.distanceKm} km）`;
          } else {
            nearStr = '江州 / 浔阳（今江西九江）';
          }
        } else {
          const nc = dInfo.nearestCity;
          const isCrossMountainHenan =
            topic.slug === 'battle-changping' &&
            nc &&
            (nc.modern.includes('洛阳') || nc.modern.includes('开封') || nc.modern.includes('荥阳') || nc.modern.includes('郑州'));
          if (nc && nc.distanceKm <= 55 && !isCrossMountainHenan) {
            nearStr =
              nc.distanceKm <= 25
                ? `${nc.ancient}（今${nc.modern}）`
                : `${nc.ancient}（今${nc.modern}，距 ${nc.distanceKm} km）`;
          } else {
            nearStr = cleanFallbackSeat;
          }
        }

        const rowUrl = `${BASE_URL}/?year=${sampleY}&place=${encodeURIComponent(targetPlace)}`;
        return `          <tr>
            <td><strong>${escHtml(d.title)}</strong>（${fmtDynSpanZh(d)}）</td>
            <td>${escHtml(dInfo.era)}</td>
            <td>${escHtml(dInfo.polity || d.title)}</td>
            <td>${escHtml(adminStr)}</td>
            <td>${escHtml(nearStr)}</td>
            <td><a href="${escHtml(rowUrl)}">查看该朝版图 &rarr;</a></td>
          </tr>`;
      })
      .join('\n');

    let adminNow = Array.from(new Set([...(info.regions || []), ...(info.prefectures || [])]))
      .map((p) => String(p).replace(/\(([^)]+)\)/g, '（$1）'))
      .join(' · ');
    let polityNow = info.polity || '';
    if (topic.slug === 'battle-chibi') {
      polityNow = '东汉荆州南郡';
      adminNow = '孙刘抗曹前线（与曹操水军乌林隔江对峙）';
    }
    const adminCombined = [polityNow, adminNow].filter(Boolean).join(' · ');

    detailSectionHtml = `    <section class="section-card">
      <h2>一、目标时空节点精准考据（${fmtYearZh(info.year)} · ${escHtml(info.era)}）</h2>
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr>
              <th style="width:24%">查询古地名 / 典故地标</th>
              <td><strong>${escHtml(resolvedDisplayTitle)}</strong></td>
            </tr>
            <tr>
              <th>历史纪年与帝王年号</th>
              <td>${fmtYearZh(info.year)} · <strong>${escHtml(info.era)}</strong>（${escHtml(info.dynasty.title)}，都城：${escHtml(info.dynasty.seat)}）</td>
            </tr>
            <tr>
              <th>当时所属政权与州郡政区</th>
              <td><strong>${escHtml(adminCombined)}</strong></td>
            </tr>
            <tr>
              <th>现代行政区划与经纬度</th>
              <td>${escHtml(info.modernProvince)} · 今${escHtml(info.modern || '')}（${info.coord[0].toFixed(2)}°E, ${info.coord[1].toFixed(2)}°N）</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="section-card">
      <h2>二、「${escHtml(resolvedDisplayTitle)}」两千四百年历代政区沿革表（点地溯源）</h2>
      <p>同一地理坐标（${info.coord[0].toFixed(2)}°E, ${info.coord[1].toFixed(2)}°N）从战国（前403年）至现代共 18 个历史时期的政权归属与州道郡县沿革：</p>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>历史时期</th>
              <th>代表纪年与年号</th>
              <th>所属政权</th>
              <th>州 / 道 / 路 / 省政区</th>
              <th>邻近治所 / 古城</th>
              <th>地图跳转</th>
            </tr>
          </thead>
          <tbody>
${genRows}
          </tbody>
        </table>
      </div>
    </section>`;
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: pageTitle,
        description: pageDesc,
        url: canonicalUrl,
        datePublished: LASTMOD,
        dateModified: LASTMOD,
        inLanguage: ['zh-CN', 'en'],
        author: {
          '@type': 'Organization',
          name: '江山时序 (Jiangshan Historical Atlas)',
          url: `${BASE_URL}/`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '江山时序首页', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: '专题图志总览', item: `${BASE_URL}/topics/index.html` },
          { '@type': 'ListItem', position: 3, name: topic.shortZh, item: canonicalUrl },
        ],
      },
    ],
  };

  const html = `${renderSharedHead({
    title: pageTitle,
    description: pageDesc,
    keywords: topic.keywords,
    canonicalUrl,
    jsonLdObj: jsonLd,
  })}
<body>
${renderTopHeader()}
  <main>
    <nav class="breadcrumb" aria-label="面包屑导航">
      <a href="${BASE_URL}/">江山时序首页</a> &rsaquo;
      <a href="${BASE_URL}/topics/index.html">专题图志总目录</a> &rsaquo;
      <span>${escHtml(topic.shortZh)}</span>
    </nav>

    <article class="hero-card">
      <span class="kicker">${escHtml(topic.categoryZh)} · ${escHtml(topic.categoryEn)}</span>
      <h1>${escHtml(topic.titleZh)}</h1>
      <p class="en-sub">${escHtml(topic.titleEn)}</p>
      <blockquote class="poem-box">
        ${escHtml(topic.poemQuote)}
        <cite>—— ${escHtml(topic.poemAuthor)}</cite>
      </blockquote>
      <p>${escHtml(topic.summaryZh)}</p>
      <p class="en-sub">${escHtml(topic.summaryEn)}</p>
      <div class="cta-row">
        <a class="cta-btn" href="${escHtml(topic.mapHref)}">立即在交互式历史地图中打开此路线/位置 &rarr;</a>
        <a class="cta-btn secondary" href="${escHtml(topic.mapHref)}&amp;lang=en">Open in Interactive Atlas (English) &rarr;</a>
        <a class="cta-btn secondary" href="${BASE_URL}/topics/index.html">返回专题图志总览</a>
      </div>
    </article>

${renderEmbedMapSection({
  iframeSrc: `../?embed=1&${topic.mapHref.split('?')[1] || ''}`,
  titleZh: `${topic.shortZh}交互式历史舆图预览`,
  hintZh: '点击地图激活交互 · 右上角可全屏打开主地图',
})}

${detailSectionHtml}

${renderFooter(allDynasties)}
  </main>
</body>
</html>
`;

  fs.writeFileSync(path.join(TOPICS_DIR, `${topic.slug}.html`), html, 'utf8');
  return {
    slug: topic.slug,
    url: canonicalUrl,
    titleZh: topic.shortZh,
    titleEn: topic.titleEn,
    descZh: topic.summaryZh.slice(0, 95) + '…',
    descEn: topic.summaryEn.slice(0, 120) + '...',
  };
}

function buildTopicsIndexPage(dynMeta, storyMeta, journeyMeta, featuredMeta, allDynasties) {
  const canonicalUrl = `${BASE_URL}/topics/index.html`;
  const pageTitle = '江山时序 · 中国历史地图专题图志总览（18朝代疆域 · 重大事件始末沙盘 · 人物行迹 · 古诗词路线）';
  const pageDesc =
    '江山时序（Jiangshan Historical Atlas）静态历史地理专题图志索引：涵盖战国、秦、汉、三国、晋、南北朝、隋、唐、五代、宋、元、明、清、民国与现代18个时期版图政区，秦灭六国、楚汉之争、安史之乱、靖康之变、红军长征5大双阵营始末沙盘，张骞、诸葛亮、玄奘、李白、苏轼、王阳明人物行迹，以及古诗词路线与长平、赤壁、淝水大战地图。';

  const storyListHtml = storyMeta
    .map(
      (s) => `          <tr>
            <td><a href="${BASE_URL}/topics/${s.slug}.html"><strong>${escHtml(s.titleZh)}</strong></a><br/><small>${escHtml(s.titleEn)}</small></td>
            <td>${escHtml(s.descZh)}</td>
            <td><a href="${BASE_URL}/topics/${s.slug}.html">查阅沙盘图志 &rarr;</a></td>
          </tr>`
    )
    .join('\n');

  const featListHtml = featuredMeta
    .map(
      (f) => `          <tr>
            <td><a href="${BASE_URL}/topics/${f.slug}.html"><strong>${escHtml(f.titleZh)}</strong></a><br/><small>${escHtml(f.titleEn)}</small></td>
            <td>${escHtml(f.descZh)}</td>
            <td><a href="${BASE_URL}/topics/${f.slug}.html">查阅专题 &rarr;</a></td>
          </tr>`
    )
    .join('\n');

  const dynListHtml = dynMeta
    .map(
      (d) => `          <tr>
            <td><a href="${BASE_URL}/topics/${d.slug}.html"><strong>${escHtml(d.titleZh)}</strong></a><br/><small>${escHtml(d.titleEn)}</small></td>
            <td>${escHtml(d.descZh)}</td>
            <td><a href="${BASE_URL}/topics/${d.slug}.html">查阅图志 &rarr;</a></td>
          </tr>`
    )
    .join('\n');

  const jListHtml = journeyMeta
    .map(
      (j) => `          <tr>
            <td><a href="${BASE_URL}/topics/${j.slug}.html"><strong>${escHtml(j.titleZh)}</strong></a><br/><small>${escHtml(j.titleEn)}</small></td>
            <td>${escHtml(j.descZh)}</td>
            <td><a href="${BASE_URL}/topics/${j.slug}.html">查阅路线 &rarr;</a></td>
          </tr>`
    )
    .join('\n');

  const totalCount = dynMeta.length + storyMeta.length + journeyMeta.length + featuredMeta.length;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: pageTitle,
    description: pageDesc,
    url: canonicalUrl,
    inLanguage: ['zh-CN', 'en'],
    isPartOf: {
      '@type': 'WebSite',
      name: '江山时序 · 中国历史地图',
      url: `${BASE_URL}/`,
    },
  };

  const html = `${renderSharedHead({
    title: pageTitle,
    description: pageDesc,
    keywords: [
      '中国历史地图专题',
      '历代疆域图志',
      '历史事件始末沙盘',
      '古诗词地理路线图',
      '古今地名对照表',
      '点人溯事生平行迹',
      '江山时序',
    ],
    canonicalUrl,
    jsonLdObj: jsonLd,
  })}
<body>
${renderTopHeader()}
  <main>
    <nav class="breadcrumb" aria-label="面包屑导航">
      <a href="${BASE_URL}/">江山时序首页</a> &rsaquo;
      <span>专题图志总目录</span>
    </nav>

    <article class="hero-card">
      <span class="kicker">江山时序 · 历史地理百科与专题索引（共 ${totalCount} 篇静态图志）</span>
      <h1>中国历代疆域、事件始末沙盘、点人溯事与诗词战役专题图志总览</h1>
      <p class="en-sub">Complete Directory of Chinese Historical Territory Maps, Two-Camp Event Sandtables, Person Chronicles &amp; Classical Poetry Routes (403 BCE – Present)</p>
      <p>本目录汇总「江山时序」全部静态专题图志，每篇均提供完整古今地名对照表、帝王年号编年、一手正史出处、两千四百年政区沿革及一键进入交互式古舆图的直达链接。</p>
      <div class="cta-row">
        <a class="cta-btn" href="${BASE_URL}/">进入「江山时序」交互式主地图（前403年—现代）&rarr;</a>
      </div>
    </article>

    <section class="section-card">
      <h2>一、重大历史事件始末 · 双阵营对抗沙盘图志（${storyMeta.length} 篇）</h2>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>事件始末沙盘（中英对照）</th>
              <th>时代跨度与全线推演节点</th>
              <th>专题链接</th>
            </tr>
          </thead>
          <tbody>
${storyListHtml}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section-card">
      <h2>二、古诗词地理名篇路线与著名历史战役专题（${featuredMeta.length} 篇）</h2>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>专题名称（中英对照）</th>
              <th>地理考据与历史内容提要</th>
              <th>专题链接</th>
            </tr>
          </thead>
          <tbody>
${featListHtml}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section-card">
      <h2>三、中国十八历史时期疆域、政区与古今地名图志（${dynMeta.length} 篇）</h2>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>朝代 / 历史时期</th>
              <th>都城、版图快照数与古城大事统计</th>
              <th>专题链接</th>
            </tr>
          </thead>
          <tbody>
${dynListHtml}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section-card">
      <h2>四、点人溯事：历史人物生平行迹图志（${journeyMeta.length} 篇）</h2>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>人物行迹专题</th>
              <th>途经站点路线</th>
              <th>专题链接</th>
            </tr>
          </thead>
          <tbody>
${jListHtml}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section-card">
      <h2>五、历史舆图制图原则与山川地理考据说明</h2>
      <div class="carto-note-grid">
        <div class="carto-note-item">
          <strong>1. 自然山川与分水岭原则（去现代省界化）</strong>
          <p>历代政权边界严格遵循山脉分水岭、大川水道与关隘锁钥（如战国巴蜀循涪江—嘉陵江分水岭、宋元川滇循大渡河、北魏北界越六镇抵阴山漠南、河西与吐谷浑循祁连山及日月山分界），摒弃将现代省界机械套用于古代政区的做法。</p>
        </div>
        <div class="carto-note-item">
          <strong>2. 古海岸线与河口三角洲演进复原</strong>
          <p>分阶段还原先秦至唐宋古渤海湾西岸、苏北范公堤以东成陆前岸线、长江口崇明沙洲发育过程、珠江三角洲古海湾，以及明郑至清道光三年（1823）曾文溪改道淤积前的台湾台南“台江内海”古地理形态。</p>
        </div>
        <div class="carto-note-item">
          <strong>3. 一手正史与《资治通鉴》卷次出处核验</strong>
          <p>编年大事、城邑地标与人物行迹逐条核对《二十四史》（《史记》《汉书》《三国志》《晋书》《隋书》《旧唐书》《新唐书》《宋史》等）及《资治通鉴》具体卷次，并在各朝代与事件专题页内展示史料出处。</p>
        </div>
        <div class="carto-note-item">
          <strong>4. 古今同名异地消歧与细粒度时间切片</strong>
          <p>严格区分历代“同名异地”（如秦汉巴郡江州今重庆 vs 东晋隋唐宋江州今江西九江；三国蒲圻赤壁 vs 黄州东坡赤壁），并在政权交替关键节点（如秦末前209/前207、西汉前111—前108四连拍、盛唐安西四镇三度得失、元末1335/1367、民国1926北伐与1928省名改制）提供高密度时间切片。</p>
        </div>
      </div>
    </section>

${renderFooter(allDynasties)}
  </main>
</body>
</html>
`;

  fs.writeFileSync(path.join(TOPICS_DIR, 'index.html'), html, 'utf8');
}

function updateSitemapXml(dynMeta, storyMeta, journeyMeta, featuredMeta) {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  const existingXml = fs.readFileSync(sitemapPath, 'utf8');

  // Remove any previously injected /topics/ URLs so this script is idempotent
  const cleanedXml = existingXml.replace(
    /\s*<url>\s*<loc>https:\/\/deanchen\.me\/jiangshan-map\/topics\/[^<]*<\/loc>[\s\S]*?<\/url>/g,
    ''
  );

  const topicUrls = [
    { loc: `${BASE_URL}/topics/index.html`, priority: '0.95' },
    ...storyMeta.map((s) => ({ loc: s.url, priority: '0.92' })),
    ...featuredMeta.map((f) => ({ loc: f.url, priority: '0.9' })),
    ...dynMeta.map((d) => ({ loc: d.url, priority: '0.9' })),
    ...journeyMeta.map((j) => ({ loc: j.url, priority: '0.9' })),
  ];

  const topicBlocks = topicUrls
    .map(
      (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n');

  const updatedXml = cleanedXml.replace('</urlset>', `${topicBlocks}\n</urlset>`);
  fs.writeFileSync(sitemapPath, updatedXml, 'utf8');
  return topicUrls.length;
}

function computeCalligraphySubsetText(dynasties, enLocale) {
  const sources = [
    '江山时序',
    ...dynasties.map((d) => d.title || ''),
    ...dynasties.map((d) => (enLocale.dynasties[d.key] && enLocale.dynasties[d.key].name) || ''),
  ];
  return Array.from(new Set(sources.join(''))).sort().join('');
}

function updateIndexHtmlSeoDirectory(dynMeta, storyMeta, journeyMeta, featuredMeta, dynasties, snapshots, loreData, enLocale) {
  const indexPath = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  // 1. Subset Ma Shan Zheng calligraphy webfont to the exact characters rendered in #txt-seal and #dynasty-title
  //    (a few KB). Both font stylesheets load without blocking rendering; the fallback faces show until they arrive.
  const calligraphyChars = computeCalligraphySubsetText(dynasties, enLocale);
  const encodedCalligraphy = encodeURIComponent(calligraphyChars).replace(/'/g, '%27');
  // media="print" + onload keeps the webfont stylesheets from blocking first paint.
  const NON_BLOCKING = ` rel="stylesheet" media="print" onload="this.media='all'" />`;
  const fontLinksBlock = `  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@400;500&display=swap"${NON_BLOCKING}\n  <link href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&text=${encodedCalligraphy}&display=swap"${NON_BLOCKING}`;
  const fontRegex = /  <link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Noto\+Serif\+SC[^"]*" rel="stylesheet"[^>]*\/>(?:\r?\n  <link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Ma\+Shan\+Zheng[^"]*" rel="stylesheet"[^>]*\/>)?/;
  if (!fontRegex.test(html)) {
    throw new Error('Could not find Google Fonts stylesheet link block in index.html');
  }
  html = html.replace(fontRegex, fontLinksBlock);

  // 2. Synchronize pre-rendered Warring States opening summary & milestone list in #chronicle-pane
  const openingDyn = dynasties[0];
  html = html.replace(
    /<p id="dynasty-summary" class="dynasty-desc">[\s\S]*?<\/p>/,
    `<p id="dynasty-summary" class="dynasty-desc">${escHtml(openingDyn.summary)}</p>`
  );
  const milestoneItemsHtml = (openingDyn.milestones || [])
    .map(
      (m) =>
        `            <li><span class="ev-yr">${escHtml(fmtYearShortZh(m.year))} 年</span><span>${escHtml(m.headline)}</span></li>`
    )
    .join('\n');
  html = html.replace(
    /<ul id="milestone-list">[\s\S]*?<\/ul>/,
    `<ul id="milestone-list">\n${milestoneItemsHtml}\n          </ul>`
  );

  // 3. Synchronize live dataset counts in FAQ JSON-LD and llms.txt
  const histSnapCount = Object.keys(snapshots).filter((k) => k !== 'neighbors').length;
  const totalMilestones = dynasties.reduce((sum, d) => sum + (d.milestones || []).length, 0);
  const totalLandmarks = (loreData.PLACE_LANDMARK_EVENTS || []).length;
  html = html.replace(
    /共\d+个历史时期、\d+幅多阶段疆域与州郡政区快照、\d+条编年大事、\d+处城池地标/,
    `共${dynasties.length}个历史时期、${histSnapCount}幅多阶段疆域与州郡政区快照、${totalMilestones}条编年大事、${totalLandmarks}处城池地标`
  );

  const llmsPath = path.join(ROOT, 'llms.txt');
  if (fs.existsSync(llmsPath)) {
    const llmsSrc = fs.readFileSync(llmsPath, 'utf8');
    const updatedLlms = llmsSrc.replace(
      /共 \d+ 个历史时期、\d+ 幅多阶段疆域与州郡政区快照、\d+ 条编年大事、\d+ 处城池地标/,
      `共 ${dynasties.length} 个历史时期、${histSnapCount} 幅多阶段疆域与州郡政区快照、${totalMilestones} 条编年大事、${totalLandmarks} 处城池地标`
    );
    if (updatedLlms !== llmsSrc) {
      fs.writeFileSync(llmsPath, updatedLlms, 'utf8');
    }
  }

  // 4. Synchronize Sections 一, 二, and 五 of #seo-atlas-directory idempotently
  const sectionOneItems = dynasties
    .map((d) => {
      const enName = (enLocale.dynasties[d.key] && enLocale.dynasties[d.key].name) || d.key;
      const sampleEvs = (d.milestones || [])
        .slice(0, 4)
        .map((m) => `${fmtYearShortZh(m.year)}年${m.headline}`)
        .join('；');
      const focusYr = d.focusYear !== undefined ? d.focusYear : d.fromYear;
      return `          <li><a href="${BASE_URL}/?year=${focusYr}"><strong>${escHtml(d.title)}历史地图（${escHtml(fmtDynSpanZh(d))} · ${escHtml(enName)}）</strong></a> — 都城：${escHtml(d.seat)}。代表事件：${escHtml(sampleEvs)}。</li>`;
    })
    .join('\n');
  html = html.replace(
    /(<h3>一、历代疆域与州郡政区时间轴目录（Dynasties &amp; Historical Territories）<\/h3>\s*<ul>)[\s\S]*?(<\/ul>)/,
    `$1\n${sectionOneItems}\n        $2`
  );

  const sectionTwoItems = (loreData.HISTORICAL_JOURNEYS || [])
    .map((j) => {
      const stopsChain = (j.stops || [])
        .map((s) => `${s.ancientZh}（今${s.modernZh}）`)
        .join(' → ');
      return `          <li><a href="${BASE_URL}/?person=${escHtml(j.key)}"><strong>${escHtml(j.titleZh)}（${escHtml(j.titleEn)} · ${escHtml(j.spanZh)}）</strong></a> — ${escHtml(stopsChain)}。</li>`;
    })
    .join('\n');
  html = html.replace(
    /(<h3>二、点人溯事：历史人物生平行迹图（Person Chronicles）<\/h3>\s*<ul>)[\s\S]*?(<\/ul>)/,
    `$1\n${sectionTwoItems}\n        $2`
  );

  // Remove any previous Section 五 if re-running idempotently
  html = html.replace(
    /\s*<section id="seo-static-topics-section">[\s\S]*?<\/section>/g,
    ''
  );

  const totalCount = dynMeta.length + storyMeta.length + journeyMeta.length + featuredMeta.length;
  const allItems = [
    `          <li><a href="${BASE_URL}/topics/index.html"><strong>江山时序专题图志总览（${totalCount}篇静态历史地理百科目录）</strong></a></li>`,
    ...storyMeta.map(
      (s) => `          <li><a href="${s.url}"><strong>${escHtml(s.titleZh)}双阵营始末沙盘图志（静态专题页）</strong></a></li>`
    ),
    ...featuredMeta.map(
      (f) => `          <li><a href="${f.url}"><strong>${escHtml(f.titleZh)}（静态图文考据专题）</strong></a></li>`
    ),
    ...dynMeta.map(
      (d) => `          <li><a href="${d.url}"><strong>${escHtml(d.titleZh)}疆域政区与古今地名表（静态专题页）</strong></a></li>`
    ),
    ...journeyMeta.map(
      (j) => `          <li><a href="${j.url}"><strong>${escHtml(j.titleZh)}生平行迹与诗词路线图志（静态专题页）</strong></a></li>`
    ),
  ].join('\n');

  const sectionFive = `      <section id="seo-static-topics-section">
        <h3>五、静态历史地理专题图志索引（Static Historical Geography Topic Pages）</h3>
        <ul>
${allItems}
        </ul>
      </section>
    </nav>`;

  const target = '      </section>\n    </nav>';
  if (!html.includes(target)) {
    throw new Error('Could not find closing </section>\\n    </nav> in index.html');
  }
  html = html.replace(target, `      </section>\n${sectionFive}`);
  fs.writeFileSync(indexPath, html, 'utf8');
}

function main() {
  fs.mkdirSync(TOPICS_DIR, { recursive: true });
  const { ctrl, dynasties, snapshots, loreData, enLocale, provinces } = loadAtlasRuntime();
  const sourcesBundle = loadSourcesBundle();
  const stories = (loreData.PERSON_PROFILES || []).filter((p) => p && p.isStory);

  const dynMeta = dynasties.map((d, idx) =>
    buildDynastyPage(d, idx, dynasties, snapshots, enLocale, ctrl, provinces, sourcesBundle)
  );
  const storyMeta = stories.map((s, idx) =>
    buildStorylinePage(s, idx, stories, dynasties, sourcesBundle)
  );
  const journeyMeta = loreData.HISTORICAL_JOURNEYS.map((j, idx) =>
    buildJourneyPage(j, idx, loreData.HISTORICAL_JOURNEYS, dynasties, sourcesBundle)
  );
  const featuredMeta = FEATURED_TOPICS.map((t) =>
    buildFeaturedTopicPage(t, dynasties, ctrl)
  );

  buildTopicsIndexPage(dynMeta, storyMeta, journeyMeta, featuredMeta, dynasties);
  const addedSitemapCount = updateSitemapXml(dynMeta, storyMeta, journeyMeta, featuredMeta);
  updateIndexHtmlSeoDirectory(
    dynMeta,
    storyMeta,
    journeyMeta,
    featuredMeta,
    dynasties,
    snapshots,
    loreData,
    enLocale
  );

  console.log(
    `✓ Generated ${dynMeta.length} dynasty pages, ${storyMeta.length} storyline pages, ${journeyMeta.length} journey pages, ${featuredMeta.length} featured poetry/battle pages, and topics/index.html (${addedSitemapCount} static URLs added to sitemap.xml)`
  );
}

main();
