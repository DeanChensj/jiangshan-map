#!/usr/bin/env node
'use strict';

// Build tool only. The browser receives strings, never the conversion library.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {pinyin, customPinyin} = require('pinyin-pro');
const {version} = require('pinyin-pro/package.json');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = 'js/event_pinyin.js';
// Historical place reading missed by the converter's default dictionary:
// https://www.ezhejiang.gov.cn/2020-06/03/c_497595.htm
// 大宛 / 高句丽: https://ling.ccnu.edu.cn/info/1047/1762.htm and
// https://www.gojilin.gov.cn/2020/05/29/c_1140.htm; 㚟: Unihan U+369F kMandarin
// in https://www.unicode.org/Public/UNIDATA/Unihan.zip.
customPinyin({
  会稽: 'kuài jī',
  大宛: 'dà yuān',
  高句丽: 'gāo gōu lí',
  㚟: 'chuò',
  // Historical names follow the readings in the atlas's English event data.
  郢都: 'yǐng dū',
  尉迟迥: 'yù chí jiǒng',
  金兀术: 'jīn wù zhú',
  刘禅: 'liú shàn',
  冒顿单于: 'mò dú chán yú',
  乐毅: 'yuè yì',
  呼韩邪: 'hū hán yé',
  子婴降刘邦: 'zǐ yīng xiáng liú bāng',
  长乐府: 'cháng lè fǔ',
  上都南坡: 'shàng dū nán pō',
  上都天顺帝: 'shàng dū tiān shùn dì',
  攻破上都: 'gōng pò shàng dū',
  北走上都: 'běi zǒu shàng dū',
  元上都: 'yuán shàng dū',
  开平府为上都: 'kāi píng fǔ wéi shàng dū',
  滦河上都: 'luán hé shàng dū',
  两都之战: 'liǎng dū zhī zhàn',
  秦桧: 'qín huì',
  赵率教: 'zhào shuài jiào',
  红军长征: 'hóng jūn cháng zhēng',
  元朝国都: 'yuán cháo guó dū',
  国都国内城: 'guó dū guó nèi chéng',
  后燕国都中山: 'hòu yān guó dū zhōng shān',
  江都兵变: 'jiāng dū bīng biàn',
  江都遇弑: 'jiāng dū yù shì',
  江都宫: 'jiāng dū gōng',
  进取武都: 'jìn qǔ wǔ dū',
  据乐都: 'jù lè dū',
  袭破乐都: 'xí pò lè dū',
  都城乐都: 'dū chéng lè dū',
  克丸都: 'kè wán dū',
  丸都山: 'wán dū shān',
  丸都城: 'wán dū chéng',
  召陵: 'shào líng',
  解缙: 'xiè jìn',
  仇士良: 'qiú shì liáng',
  曾国: 'zēng guó',
  曾侯乙: 'zēng hóu yǐ',
  曾国藩: 'zēng guó fān',
  曾巩: 'zēng gǒng',
  曾公亮: 'zēng gōng liàng',
  曾纪泽: 'zēng jì zé',
  李重俊: 'lǐ chóng jùn',
  石重贵: 'shí chóng guì',
  隗嚣: 'wěi xiāo',
  栎阳: 'yuè yáng',
  阿史那都支: 'ā shǐ nà dū zhī',
  浑邪王: 'hún yé wáng',
  鸠摩罗什: 'jiū mó luó shí',
  什翼犍: 'shí yì jiān',
  单超等五宦官: 'shàn chāo děng wǔ huàn guān',
  梁山泊: 'liáng shān bó',
  罗布泊: 'luó bù bó',
  喀什: 'kā shí',
  喀什噶尔: 'kā shí gá ěr',
  洛阳伽蓝记: 'luò yáng qié lán jì',
  异牟寻: 'yì móu xún',
  急行军: 'jí xíng jūn',
  行军大总管: 'xíng jūn dà zǒng guǎn',
  行军司马: 'xíng jūn sī mǎ',
  定十三行省: 'dìng shí sān xíng shěng',
  旅行家: 'lǚ xíng jiā',
  张角: 'zhāng jué',
  东牟山: 'dōng móu shān',
  李愬: 'lǐ sù',
  重熙: 'chóng xī',
  乐僔: 'yuè zǔn',
  歙州: 'shè zhōu',
  歙县: 'shè xiàn',
  越嶲: 'yuè xī',
  曹参: 'cáo shēn',
  楚大将龙且: 'chǔ dà jiàng lóng jū',
  岑参: 'cén shēn',
  杨侗: 'yáng tóng',
  赤嵌: 'chì kǎn',
  浚县: 'xùn xiàn',
  枹罕: 'fú hǎn',
  碙洲: 'gāng zhōu',
  涡阳: 'guō yáng',
  五千乘之: 'wǔ qiān shèng zhī',
  增产率: 'zēng chǎn lǜ',
  增长率: 'zēng zhǎng lǜ',
  空置率: 'kòng zhì lǜ',
  // These ritual and abdication phrases use shàn. Buddhist chán keeps its reading.
  封禅泰山: 'fēng shàn tài shān',
  孺子婴禅让: 'rú zǐ yīng shàn ràng',
  汉献帝禅让: 'hàn xiàn dì shàn ràng',
  魏元帝禅让: 'wèi yuán dì shàn ràng',
  东魏禅让: 'dōng wèi shàn ràng',
  杨侑禅让: 'yáng yòu shàn ràng',
  退位禅让: 'tuì wèi shàn ràng',
  恭帝禅位: 'gōng dì shàn wèi',
  宋顺帝禅位: 'sòng shùn dì shàn wèi',
  齐和帝禅位: 'qí hé dì shàn wèi',
  顺宗禅位: 'shùn zōng shàn wèi',
  唐哀帝禅位: 'táng āi dì shàn wèi',
  高宗禅位: 'gāo zōng shàn wèi',
  光宗禅位: 'guāng zōng shàn wèi',
  乾隆禅位: 'qián lóng shàn wèi',
  武则天禅位: 'wǔ zé tiān shàn wèi',
  诸帝多禅位: 'zhū dì duō shàn wèi',
  受禅建陈: 'shòu shàn jiàn chén',
  受禅建宋: 'shòu shàn jiàn sòng',
  受禅代汉: 'shòu shàn dài hàn',
  永贞内禅: 'yǒng zhēn nèi shàn',
  绍熙内禅: 'shào xī nèi shàn',
  // Use xiáng in surrender phrases, including those ending at a clause boundary.
  面缚出降: 'miàn fù chū xiáng',
  恭帝出降: 'gōng dì chū xiáng',
  郑克塽出降: 'zhèng kè shuǎng chū xiáng',
  愍帝出降: 'mǐn dì chū xiáng',
  孙皓出降: 'sūn hào chū xiáng',
  奉玺出降: 'fèng xǐ chū xiáng',
  刘禅出降: 'liú shàn chū xiáng',
  随即出降: 'suí jí chū xiáng',
  大諲譔出降: 'dà yīn zhuàn chū xiáng',
  不战出降: 'bù zhàn chū xiáng',
  开城出降: 'kāi chéng chū xiáng',
  李煜出降: 'lǐ yù chū xiáng',
  受降浑邪王: 'shòu xiáng hún yé wáng',
  芷江受降堂: 'zhǐ jiāng shòu xiáng táng',
  卫律劝降: 'wèi lǜ quàn xiáng',
  魏王假降: 'wèi wáng jiǎ xiáng',
  诸部降附: 'zhū bù xiáng fù',
  滇王降汉: 'diān wáng xiáng hàn',
  降汉中张鲁: 'xiáng hàn zhōng zhāng lǔ',
  伏允可汗降唐: 'fú yǔn kè hán xiáng táng',
  萧铣降唐: 'xiāo xiǎn xiáng táng',
  吕文焕力竭降元: 'lǚ wén huàn lì jié xiáng yuán',
  襄阳降元: 'xiāng yáng xiáng yuán',
  吴三桂降清: 'wú sān guì xiáng qīng',
  郑芝龙降清: 'zhèng zhī lóng xiáng qīng',
  降于后秦: 'xiáng yú hòu qín',
  降王世充: 'xiáng wáng shì chōng',
  降纳哈出: 'xiáng nà hā chū',
  降秦王子婴: 'xiáng qín wáng zǐ yīng',
  降匈奴: 'xiáng xiōng nú',
  降服于: 'xiáng fú yú',
  迫降刘璋: 'pò xiáng liú zhāng',
  迫降晋愍帝: 'pò xiáng jìn mǐn dì',
  齐王建降: 'qí wáng jiàn xiáng',
  受子婴降: 'shòu zǐ yīng xiáng',
  孟昶降: 'mèng chǎng xiáng',
  刘鋹降: 'liú chǎng xiáng',
  李煜降: 'lǐ yù xiáng',
  今井武夫洽降: 'jīn jǐng wǔ fū qià xiáng',
  四万众降: 'sì wàn zhòng xiáng',
  // Tibetan names and titles use zàng. Storage words like 藏书 retain cáng.
  公主入藏: 'gōng zhǔ rù zàng',
  达赖入藏: 'dá lài rù zàng',
  藏西阿里: 'zàng xī ā lǐ',
  藏传佛教: 'zàng chuán fó jiào',
  统一卫藏: 'tǒng yī wèi zàng',
  乌思藏: 'wū sī zàng',
  维系藏地: 'wéi xì zàng dì',
  罗卜藏丹津: 'luó bǔ zàng dān jīn',
  驻藏大臣: 'zhù zàng dà chén',
  督办藏务: 'dū bàn zàng wù',
  钦定藏内善后章程: 'qīn dìng zàng nèi shàn hòu zhāng chéng',
  青藏铁路: 'qīng zàng tiě lù',
  // Use dū in capital names, titles, and phrases about establishing a capital.
  楚都郢: 'chǔ dū yǐng',
  燕都蓟城: 'yān dū jì chéng',
  南燕都广固: 'nán yān dū guǎng gù',
  赵都邯郸: 'zhào dū hán dān',
  魏都大梁: 'wèi dū dà liáng',
  神都洛阳: 'shén dū luò yáng',
  卒于神都: 'zú yú shén dū',
  邺都: 'yè dū',
  迁许都: 'qiān xǔ dū',
  青州益都: 'qīng zhōu yì dū',
  邛都: 'qióng dū',
  陪都: 'péi dū',
  为留都: 'wéi liú dū',
  新都大兴城: 'xīn dū dà xīng chéng',
  六朝古都: 'liù cháo gǔ dū',
  王都: 'wáng dū',
  五都: 'wǔ dū',
  入都长安: 'rù dū cháng ān',
  北徙都琅琊: 'běi xǐ dū láng yá',
  皆都建康: 'jiē dū jiàn kāng',
  都广陵: 'dū guǎng líng',
  都羊苴咩城: 'dū yáng jū miē chéng',
  都江陵: 'dū jiāng líng',
  都东冶: 'dū dōng yě',
  后周皆都于此: 'hòu zhōu jiē dū yú cǐ',
  最南端都会: 'zuì nán duān dū huì',
  攀登天都: 'pān dēng tiān dū',
  都点检: 'dū diǎn jiǎn',
  都司: 'dū sī',
  行都司: 'xíng dū sī',
  都御史: 'dū yù shǐ',
  副都统: 'fù dū tǒng',
  // Keep the capital's reading local to historical place phrases.
  元大都: 'yuán dà dū',
  大都柴市口: 'dà dū chái shì kǒu',
  冬都大都: 'dōng dū dà dū',
  攻克大都: 'gōng kè dà dū',
  北伐克大都: 'běi fá kè dà dū',
  于大都创作: 'yú dà dū chuàng zuò',
  于大都崇仁门: 'yú dà dū chóng rén mén',
  转输大都: 'zhuǎn shū dà dū',
  大都城制: 'dà dū chéng zhì',
  // These return, official title, and frugality senses differ from the defaults.
  唐僖宗还京: 'táng xī zōng huán jīng',
  还京后升: 'huán jīng hòu shēng',
  自淮南还过鲁: 'zì huái nán huán guò lǔ',
  去珠复还: 'qù zhū fù huán',
  召还洛阳: 'zhào huán luò yáng',
  班师南还: 'bān shī nán huán',
  斩首而还: 'zhǎn shǒu ér huán',
  赐金放还: 'cì jīn fàng huán',
  唱和往还: 'chàng hè wǎng huán',
  大败而还: 'dà bài ér huán',
  晋惠帝还洛阳: 'jìn huì dì huán luò yáng',
  三长制: 'sān zhǎng zhì',
  亭长刘邦: 'tíng zhǎng liú bāng',
  轻徭薄赋: 'qīng yáo bó fù',
  省役薄赋: 'shěng yì bó fù',
  遗令薄葬: 'yí lìng bó zàng',
  馆阁编校: 'guǎn gé biān jiào',
  古城尽没于泥沙: 'gǔ chéng jìn mò yú ní shā',
  纱縠行: 'shā hú háng',
  重开丝路: 'chóng kāi sī lù',
  重聚旧部: 'chóng jù jiù bù',
  重兴庐山: 'chóng xīng lú shān',
  重开庆元: 'chóng kāi qìng yuán',
  重访荒废: 'chóng fǎng huāng fèi',
  重造铜机: 'chóng zào tóng jī',
  租庸调: 'zū yōng diào',
  敕调军民: 'chì diào jūn mín',
  调鄂军入川: 'diào è jūn rù chuān',
});

// These readings apply only to a complete phrase, not to adjacent words.
const COMPLETE_READINGS = new Map([
  ['国都', ['guo', 'du']], ['徙都', ['xi', 'du']], ['江都', ['jiang', 'du']],
  ['武都', ['wu', 'du']], ['乐都', ['le', 'du']],
  ['上都', ['shang', 'du']], ['神都', ['shen', 'du']], ['许都', ['xu', 'du']],
  ['益都', ['yi', 'du']], ['留都', ['liu', 'du']], ['丸都', ['wan', 'du']],
  ['单超', ['shan', 'chao']], ['都建康', ['du', 'jian', 'kang']],
  ['长征', ['chang', 'zheng']], ['出降', ['chu', 'xiang']], ['受降', ['shou', 'xiang']],
  ['劝降', ['quan', 'xiang']], ['假降', ['jia', 'xiang']], ['降附', ['xiang', 'fu']],
  ['洽降', ['qia', 'xiang']],
  ['行军', ['xing', 'jun']],
]);
// These readings are specific to the standalone names in the site field.
const SITE_READINGS = new Map([
  ['大都', ['dadu']],
  ['千乘', ['qiansheng']],
  ['六合', ['liuhe', 'luhe']],
]);
// Documented variants for names and titles, keyed by phrase and syllable offset.
// For the place names, see Taiwan MOE dictionary entries 65023, 66390 and 75936.
const ALTERNATE_SYLLABLES = new Map([
  ['梁山泊', [2, 'po']],
  ['罗布泊', [2, 'po']],
  ['喀什噶尔', [2, 'ge']],
  ['遣译长率', [2, 'zhang']],
  ['李贲称帝', [1, 'bi']],
  ['车师前国', [0, 'ju']],
]);
const VARIANT_PHRASES = new RegExp([...ALTERNATE_SYLLABLES.keys()].join('|'), 'gu');
// These source phrases use 率 as "lead". The subject or clause start separates
// them from a rate followed by an unrelated group, such as 伤亡率大军撤离后降低.
const LEADING_CONTEXTS = new RegExp([
  '赵充国率军', '张角率太平道', '曹髦率宿卫', '钟会率魏军', '李特率关陇',
  '苻健率部自', '谢玄率八万北府兵', '萧衍率军', '陈庆之率七千白袍军', '高仙芝率军',
  '潘美率宋军', '曹彬率宋军', '童贯率北伐军', '忽必烈率蒙军', '伯颜率元军',
  '^率水师东攻', '沐英率军', '郑和率宝船', '^率骑破古北口', '戚继光率戚家军',
  '多尔衮率清军', '渥巴锡率土尔扈特', '福康安率军', '长龄率军', '冯子材率军',
  '史可法率孤军', '刘邦率楚军', '老上单于率十四万骑', '李世民率精骑', '杨业率骑',
  '徐福率童男女', '阿史那社尔率军', '张辅率大军', '朱元璋亲率大军', '刘锜率八字军',
  '自成都率水师', '戚继光率军', '冼夫人率百越', '柳貌率五十余万口', '商鞅率秦军',
  '^率八千江东子弟', '项羽率三万精骑', '卫青率汉军', '霍去病率八百轻骑', '刘秀率敢死队',
  '^率三十六吏士', '曹操率大军', '司马懿率四万军', '谢玄率北府兵', '刘裕率晋军',
  '夜率羽林军', '李隆基率百官', '李光弼率五万精兵', '^率刘攽$', '辛弃疾率五十骑',
  '忽必烈率蒙古', '朱元璋率二十万水军', '郑和率巨型宝船', '陈胜率起义军', '邓艾率精兵',
  '曾国荃率湘军', '张辽率八百勇士', '司马懿亲率轻骑', '高长恭率五百骑', '左宗棠率楚军',
  '黄兴率同盟会', '张飞将率万人', '周瑜率兵', '祖逖率亲党', '冉闵率冉魏',
  '慕容宝率部北', '乞伏炽盘率军', '秋水泛涨率舟师', '王世充率东都精兵', '窦建德率军',
  '张议潮率军', '段思平率滇东', '明玉珍率军', '张献忠率军', '孙中山率驻沪海军',
  '台湾赤嵌率垦民', '陈霸先率军', '遣译长率使团', '完颜阿骨打率女真军', '张亮率舟师',
  '叶旺率水师', '马暨率部苦战', '冯胜率明军', '尤世威率全城将士',
].join('|'), 'gu');

function loadSources(root = ROOT) {
  const context = vm.createContext({window: {}});
  for (const file of ['js/map_data.js', 'js/lore_detail.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
  }
  const lore = context.window.ATLAS_LORE_DATA;
  return {dynasties: context.window.DYNASTY_DATA, landmarks: lore.PLACE_LANDMARK_EVENTS};
}

function buildIndex(dynasties, landmarks) {
  const cache = new Map();
  const syllables = phrase => {
    if (!cache.has(phrase)) {
      const reading = COMPLETE_READINGS.get(phrase) ??
        pinyin(phrase, {toneType: 'none', type: 'array', v: true});
      if (phrase.includes('率')) {
        for (const match of phrase.matchAll(LEADING_CONTEXTS)) {
          const offset = match.index + match[0].indexOf('率');
          reading[[...phrase.slice(0, offset)].length] = 'shuai';
        }
      }
      if (reading.some(key => !/^[a-z]+$/.test(key))) throw new Error('Unconverted reading: ' + phrase);
      cache.set(phrase, reading);
    }
    return cache.get(phrase);
  };
  const phrases = text => text?.match(/\p{Script=Han}+/gu) || [];
  const readingVariants = phrase => {
    const reading = syllables(phrase);
    const variants = [...phrase.matchAll(VARIANT_PHRASES)];
    if (!variants.length) return [reading];
    const alternate = reading.slice();
    for (const match of variants) {
      const [syllableOffset, syllable] = ALTERNATE_SYLLABLES.get(match[0]);
      const offset = [...phrase.slice(0, match.index)].length;
      alternate[offset + syllableOffset] = syllable;
    }
    return [reading, alternate];
  };
  const fullKeys = (group, isSite) => {
    const readings = group.map(phrase => {
      const site = isSite && SITE_READINGS.get(phrase);
      return site || readingVariants(phrase).map(reading => reading.join(''));
    });
    const primary = readings.map(([key]) => key).join('');
    if (readings.every(keys => keys.length === 1)) return [primary];
    return [primary, readings.map(([key, alternate]) => alternate ?? key).join('')];
  };
  const keys = (text, isSite) => {
    const parts = phrases(text).flatMap(phrase => fullKeys([phrase], isSite));
    if (!isSite) {
      // Retain the reading of each phrase while allowing a search to cross punctuation.
      for (const title of text?.match(/\p{Script=Han}+(?:[\p{Punctuation}\s]+\p{Script=Han}+)+/gu) || []) {
        parts.push(...fullKeys(phrases(title), false));
      }
    }
    return parts;
  };
  const eventKeys = (title, site) => [...new Set([...keys(title, false), ...keys(site, true)])];
  // Rows follow source event order. CI's --check rejects edits/reordering without regeneration.
  return {
    milestones: Object.fromEntries(dynasties.map(d => [d.key,
      (d.milestones || []).map(e => eventKeys(e.headline, e.site))])),
    landmarks: landmarks.map(e => eventKeys(e.zh, e.site)),
  };
}

function renderBundle(index) {
  const milestones = Object.entries(index.milestones).map(([key, rows]) =>
    '    ' + JSON.stringify(key) + ': [\n' +
    rows.map(row => '      ' + JSON.stringify(row)).join(',\n') + '\n    ]'
  ).join(',\n');
  const landmarks = index.landmarks.map(row => '    ' + JSON.stringify(row)).join(',\n');
  return '/** Generated by scripts/search-pinyin/build.cjs using pinyin-pro ' + version + '. Do not edit. */\n' +
    '// Rows match DYNASTY_DATA milestones and PLACE_LANDMARK_EVENTS; regenerate after editing either.\n' +
    'window.ATLAS_EVENT_PINYIN = {\n  milestones: {\n' + milestones + '\n  },\n' +
    '  landmarks: [\n' + landmarks + '\n  ]\n};\n';
}

if (require.main === module) {
  const {dynasties, landmarks} = loadSources();
  const index = buildIndex(dynasties, landmarks), output = renderBundle(index);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(path.join(ROOT, OUTPUT)) || fs.readFileSync(path.join(ROOT, OUTPUT), 'utf8') !== output) {
      console.error(OUTPUT + ' is stale. Run: npm run build --prefix scripts/search-pinyin');
      process.exitCode = 1;
    } else console.log('✓ Event title/location pinyin index verified');
  } else {
    fs.writeFileSync(path.join(ROOT, OUTPUT), output);
    require('../sync_version').syncIndexHtmlAssetHashes(ROOT);
    console.log('✓ Built ' + OUTPUT + ': ' +
      (Object.values(index.milestones).reduce((n, rows) => n + rows.length, 0) + index.landmarks.length) + ' events');
  }
}

module.exports = {buildIndex, loadSources, renderBundle};
