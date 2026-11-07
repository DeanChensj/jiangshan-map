'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {buildIndex, loadSources, renderBundle} = require('./build.cjs');
const ROOT = path.resolve(__dirname, '../..');
const context = vm.createContext({window: {addEventListener() {}}, clearTimeout, URLSearchParams});
context.location = {search: '', origin: 'https://deanchen.me', pathname: '/jiangshan-map/'};
context.window.location = context.location;
for (const name of ['china_geo_data.js', 'atlas_snapshots.js', 'map_data.js', 'lore_data.js',
  'i18n_dict.js', 'zh_hant.js', 'event_pinyin.js', 'app.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', name), 'utf8'), context, {filename: name});
}
const w = context.window, generated = w.ATLAS_EVENT_PINYIN;
function controller(withPinyin = true, withInitials = true) {
  w.ATLAS_EVENT_PINYIN = withPinyin ? (withInitials ? generated :
    {milestones: generated.milestones, landmarks: generated.landmarks}) : undefined;
  const ctrl = Object.assign(Object.create(w.HistoricalAtlasController.prototype), {
    dynasties: w.DYNASTY_DATA, provinces: w.PROVINCE_OUTLINES, corridors: w.CORRIDOR_DATA,
    snapshots: w.ATLAS_SNAPSHOTS, enLocale: w.EN_LOCALE, locale: 'zh', year: 1842, dynastyIdx: 15,
    minYear: -403, maxYear: 2027, _fullSnapshotsLoaded: true,
    camera: {x: 350, y: 215, w: 500, h: 420, zoom: 2},
    projector: new w.MercatorProjector(1000, 700, {west: 66, east: 142, south: 14, north: 55}),
  });
  ctrl._setEnglishLocale(w.EN_LOCALE);ctrl._initTimelineBands();ctrl._ensureSearchIndex();
  return ctrl;
}
const copy = value => JSON.parse(JSON.stringify(value));
const identity = hit => [hit.kind, hit.titleZh, hit.rawYear ?? hit.year, hit.score];

test('the checked-in index is reproducible and covers every event title and location', () => {
  const {dynasties, landmarks, names} = loadSources();
  const index = buildIndex(dynasties, landmarks, names);
  assert.equal(fs.readFileSync(path.join(ROOT, 'js/event_pinyin.js'), 'utf8'), renderBundle(index));
  for (const dynasty of dynasties) assert.equal(index.milestones[dynasty.key].length, (dynasty.milestones || []).length);
  assert.equal(index.landmarks.length, landmarks.length);
  for (const keys of [...Object.values(index.milestones).flat(), ...index.landmarks]) {
    assert(keys.length, 'event has no title/location keys');
    assert(keys.every(key => /^[a-z]+$/.test(key)), 'unconverted text in ' + keys);
  }
  for (const dynasty of dynasties) assert.equal(index.initials.milestones[dynasty.key].length, (dynasty.milestones || []).length);
  assert.equal(index.initials.landmarks.length, landmarks.length);
  for (const keys of [...Object.values(index.initials.milestones).flat(), ...index.initials.landmarks]) {
    assert(keys.every(key => /^[a-z]{4,}$/.test(key)), 'invalid initial key: ' + keys);
    assert.equal(new Set(keys).size, keys.length, 'duplicate initial keys');
  }
});
test('generation handles new events, duplicate text and phrase-aware place readings', () => {
  const milestones = [{headline: '南京条约', site: '尼布楚'}, {headline: '长安会盟', site: '会稽（六安）'}];
  const landmarks = [{zh: '南京条约', site: '旅顺'}, {zh: '王君㚟', site: '高句丽 · 大宛'},
    {zh: '南京条约', site: '南京条约'}];
  const index = buildIndex([{key: 'fixture', milestones}], landmarks);
  assert.deepEqual(index.milestones.fixture, [['nanjingtiaoyue', 'nibuchu'], ['changanhuimeng', 'kuaiji', 'luan']]);
  assert.deepEqual(index.landmarks, [['nanjingtiaoyue', 'lvshun'], ['wangjunchuo', 'gaogouli', 'dayuan'], ['nanjingtiaoyue']]);
  assert.deepEqual(index.initials.milestones.fixture, [['njty'], ['cahm']]);
  assert.deepEqual(index.initials.landmarks, [['njty'], [], ['njty']]);
  const reordered = buildIndex([{key: 'fixture', milestones: [...milestones].reverse()}], landmarks);
  assert.deepEqual(reordered.milestones.fixture, [...index.milestones.fixture].reverse());
  assert.deepEqual(reordered.initials.milestones.fixture, [...index.initials.milestones.fixture].reverse());
  assert.notEqual(renderBundle(index), renderBundle(reordered));
});
test('initial generation uses complete phrases and curated names, not prose substrings', () => {
  const index = buildIndex([{key: 'fixture', milestones: [
    {headline: '《南京条约》签订', site: '呼和浩特'},
    {headline: '安史之乱爆发', site: '范阳'},
  ]}], [], ['安史之乱']);
  assert.deepEqual(index.initials.milestones.fixture, [['njty', 'hhht'], ['aszlbf', 'aszl']]);
  assert(!index.initials.milestones.fixture[0].includes('njt'));
  assert(!index.initials.milestones.fixture[1].includes('szlb'));
});
test('configured names use the same middle-dot normalization as event titles', () => {
  const landmark = loadSources().landmarks.find(item => item.zh.includes('伊本·白图泰'));
  for (const name of ['伊本·白图泰', '伊本白图泰']) {
    const index = buildIndex([], [landmark], [name]);
    assert(index.initials.landmarks[0].includes('ybbtt'), name);
    assert.deepEqual(index.curatedInitials.landmarks[0], ['ybbtt'], name);
  }
});
for (const [name, year, queries] of [
  ['尼布楚条约', 1689, ['nibuchutiaoyue', 'ni bu chu tiao yue', 'NI-BU-CHU-TIAO-YUE', 'ní bù chǔ tiáo yuē']],
  ['南京条约', 1842, ['nanjingtiaoyue', 'nan jing tiao yue', "nan'jing'tiao'yue", 'nán jīng tiáo yuē']],
]) {
  test(name + ' is found by full, spaced, punctuated and tone-marked pinyin', () => {
    const ctrl = controller();
    for (const query of queries) {
      const hit = ctrl._queryQuickSearch(query).find(h => h.kind === 'event' && h.rawYear === year && h.titleZh.includes(name));
      assert(hit, query);assert(hit.coord, 'result retains its map action');assert(hit.milestone, 'result retains event context');
    }
  });
}
test('event locations, standalone landmarks and merged landmark titles are searchable', () => {
  const ctrl = controller();
  assert(ctrl._queryQuickSearch('nibuchu').some(h => h.kind === 'event' && h.rawYear === 1689));
  const entries = ctrl._ensureSearchIndex();
  const merged = entries.find(e => e.kind === 'event' && e.rawYear === 1842 && e.titleZh.includes('南京条约') && e.altTitlesZh?.length);
  assert(ctrl._queryQuickSearch('diyiciyapianzhanzheng').some(hit =>
    hit.rawYear === merged.rawYear && hit.titleZh.includes('第一次鸦片战争')));
  const separate = entries.find(e => e.kind === 'event' && e.rawYear === 1842 && e.titleZh.includes('维多利亚'));
  assert(ctrl._queryQuickSearch('weiduoliya').some(h => h.titleZh === separate.titleZh));
  const locationOnly = buildIndex([], [{zh: '南京条约', site: '尼布楚'}]);
  assert(locationOnly.landmarks[0].includes('nibuchu'));
});
test('merged pinyin hits open the displayed landmark and keep the existing year and pan', () => {
  const ctrl = controller();
  const calls = [];
  ctrl.stopAutoplay = ctrl.clearCustomRoute = ctrl._clearQuickSearchInput = () => {};
  ctrl.jumpToYear = year => calls.push(['year', year]);
  ctrl.openMilestoneBalloon = (_dynasty, event) => calls.push(['card', event.headline]);
  ctrl._panToward = (lon, lat) => calls.push(['pan', lon, lat]);
  for (const [chinese, year, queries] of [
    ['汉水之战', 219, ['hanshuizhizhan', 'hszz']],
    ['包拯权知开封府', 1057, ['baozhengquanzhikaifengfu']],
  ]) {
    const expected = ctrl._queryQuickSearch(chinese).find(hit =>
      hit.kind === 'event' && hit.rawYear === year && hit.titleZh.startsWith(chinese));
    assert(expected, chinese);
    for (const query of queries) {
      const hit = ctrl._queryQuickSearch(query).find(result =>
        result.rawYear === year && result.titleZh.startsWith(chinese));
      assert.equal(hit?.titleZh, expected.titleZh, query);
      assert.deepEqual(hit.coord, expected.coord);
      ctrl._selectSearchResult(hit);
      assert.deepEqual(calls.splice(0), [
        ['year', expected.year],
        ['card', expected.titleZh],
        ['pan', ...expected.coord],
      ], query);
    }
  }
});
test('historical names use the readings in their event context', () => {
  const ctrl = controller();
  for (const [query, year, title] of [
    ['daduchaishikou', 1283, '文天祥囚元大都'],
    ['yuchijiongfashu', 553, '西魏尉迟迥'],
    ['jinwuzhu', 1130, '韩世忠黄天荡'],
    ['liú shàn', 263, '刘禅出降'],
    ['mò dú chán yú', -200, '白登之围'],
    ['yanzhaowangbaiyueyi', -284, '燕昭王拜乐毅'],
    ['huhanyechanyu', -51, '呼韩邪单于'],
    ['ziyingxiangliubang', -206, '子婴降刘邦'],
    ['changlefu', 909, '后梁册封王审知'],
    ['liangduzhizhan', 1328, '两都之战'],
    ['shangdu', 1358, '关先生攻破上都'],
    ['shuai tai ping dao', 184, '张角率太平道'],
    ['zjstpdfqhjqy', 184, '张角率太平道'],
    ['liushanchuxiang', 263, '刘禅出降'],
    ['changzheng', 1935, '红军长征'],
    ['dingweiyuanchaoguodu', 1272, '定为元朝国都'],
    ['qin hui gou xian', 1141, '秦桧构陷'],
    ['gao gou li ke wan du', 244, '高句丽克丸都'],
    ['deng wan du shan', 244, '登丸都山'],
    ['ru nan shao ling', 100, '《说文解字》'],
    ['xie jin yao guang xiao', 1408, '解缙、姚广孝'],
    ['xi hai dao xing jun da zong guan', 635, '西海道行军大总管'],
    ['zeng hou yi mu', -400, '曾侯乙墓'],
    ['zeng guo fan yu hu nan heng zhou', 1854, '曾国藩于湖南衡州'],
    ['shangyangziyueyangqiandu', -350, '商鞅自栎阳迁都'],
    ['ding shi san xing sheng', 1413, '定十三行省'],
    ['lv xing jia yi ben bai tu tai', 1346, '旅行家伊本·白图泰'],
    ['ashinaduzhi', 679, '阿史那都支'],
    ['shouxianghunyewang', -121, '受降浑邪王'],
    ['tangwenzongyulixunmouzhuqiushiliangshibai', 835, '仇士良'],
    ['twzylxmzqslsb', 835, '仇士良'],
    ['jiumoluoshi', 384, '鸠摩罗什'],
    ['dai wang shi yi jian zhi sun', 386, '代王什翼犍之孙'],
    ['han huan di yu shan chao', 159, '汉桓帝与单超'],
    ['luoyangqielanji', 547, '《洛阳伽蓝记》'],
    ['nanzhaowangyimouxun', 794, '南诏王异牟寻'],
    ['li chong jun fa yu lin bing', 707, '李重俊发羽林兵'],
    ['shi chong gui ji wei', 942, '石重贵即位'],
    ['su zhe zeng gong zhu xian', 1057, '苏辙曾巩诸贤'],
    ['zeng gong liang deng bian cheng', 1044, '曾公亮等编成'],
    ['zeng ji ze shi e ding li', 1881, '曾纪泽使俄订立'],
    ['he wei wei xiao', 32, '合围隗嚣'],
  ]) {
    assert(ctrl._queryQuickSearch(query).some(hit =>
      hit.kind === 'event' && hit.rawYear === year && hit.titleZh.includes(title)), query);
  }
  const fixture = buildIndex([], [{zh: '人们大都同意', site: '大都（北京）'}, {zh: '两城都会改名'}]);
  assert.deepEqual(fixture.landmarks, [
    ['renmendadoutongyi', 'dadu', 'beijing'],
    ['liangchengdouhuigaiming'],
  ]);
  const rates = buildIndex([], [{zh: '计算圆周率'}, {zh: '人口增长率上升'}]);
  assert.deepEqual(rates.landmarks, [['jisuanyuanzhoulv'], ['renkouzengzhanglvshangsheng']]);
});
test('event searches distinguish return, official title, and frugality readings', () => {
  const ctrl = controller();
  for (const [query, year, title] of [
    ['tangxizonghuanjing', 885, '唐僖宗还京'],
    ['huanjinghousheng', 756, '还京后升'],
    ['huanguolu', -195, '还过鲁'],
    ['quzhufuhuan', 103, '去珠复还'],
    ['zhaohuanluoyang', 102, '召还洛阳'],
    ['banshinanhuan', 207, '班师南还'],
    ['zhanshouerhuan', 200, '斩首而还'],
    ['cijinfanghuan', 744, '赐金放还'],
    ['changhewanghuan', 760, '唱和往还'],
    ['dabaierhuan', 369, '大败而还'],
    ['jin huidi huan luoyang', 306, '晋惠帝还洛阳'],
    ['sanzhangzhi', 485, '三长制'],
    ['tingzhangliubang', -209, '亭长刘邦'],
    ['qingyaobofu', -167, '轻徭薄赋'],
    ['shengyibofu', 409, '省役薄赋'],
    ['yilingbozang', 220, '遗令薄葬'],
    ['biān jiào zhāo wén', 1063, '馆阁编校昭文'],
    ['gu cheng jin mo yu ni sha', 1642, '古城尽没于泥沙'],
    ['shahuhang', 1037, '苏轼生于眉州眉山纱縠行'],
    ['chongkaisilu', 73, '重开丝路'],
    ['cksl', 73, '重开丝路'],
    ['chongjujiubu', 386, '重聚旧部'],
    ['chongxinglushan', 1179, '重兴庐山'],
    ['chongkaiqingyuan', 1324, '重开庆元'],
    ['chongfanghuangfei', 547, '重访荒废'],
    ['chongzaotongji', 494, '重造铜机'],
    ['zhongyongwangmeng', 357, '重用王猛'],
    ['zu yong diao zhi', 624, '租庸调制'],
    ['chidiaojunmin', 1412, '敕调军民'],
    ['diaoejunruchuan', 1911, '调鄂军入川'],
    ['sengnihuansu', 845, '僧尼还俗'],
  ]) {
    assert(ctrl._queryQuickSearch(query).some(hit =>
      hit.kind === 'event' && hit.rawYear === year && hit.titleZh.includes(title)), query);
  }
  const otherSenses = buildIndex([], [
    {zh: '还在路上'}, {zh: '长达三年'}, {zh: '纸很薄'}, {zh: '改编校歌'}, {zh: '六合之内'}, {zh: '没有洪水'},
    {zh: '调整曲调'}, {zh: '调和诸味'},
  ]);
  assert.deepEqual(otherSenses.landmarks, [
    ['haizailushang'], ['changdasannian'], ['zhihenbao'], ['gaibianxiaoge'], ['liuhezhinei'], ['meiyouhongshui'],
    ['tiaozhengqudiao'], ['tiaohezhuwei'],
  ]);
});
test('phrase readings keep other senses when adjacent characters form different words', () => {
  const clauses = [
    ['韩赵魏都参加会盟', 'hanzhaoweidoucanjiahuimeng'],
    ['调降唐山地价', 'tiaojiangtangshandijia'],
    ['齐楚都遭秦军进攻', 'qichudouzaoqinjunjingong'],
    ['魏赵都遭秦军进攻', 'weizhaodouzaoqinjunjingong'],
    ['清廷降汉中府同知为知县', 'qingtingjianghanzhongfutongzhiweizhixian'],
    ['曾经到过广州十三行', 'cengjingdaoguoguangzhoushisanhang'],
    ['此地自古都繁华', 'cidizigudoufanhua'],
    ['他们收入都增加', 'tamenshourudouzengjia'],
    ['坐禅让心安', 'zuochanrangxinan'],
    ['海通禅师', 'haitongchanshi'],
    ['粮食增产率领先全国', 'liangshizengchanlvlingxianquanguo'],
    ['空置率部分地区回落', 'kongzhilvbufendiquhuiluo'],
    ['由庞勋率领起义北攻', 'youpangxunshuailingqiyibeigong'],
    ['三千乘客疏散', 'sanqianchengkeshusan'],
    ['两国都派使者', 'liangguodoupaishizhe'],
    ['他们在战国都有封地', 'tamenzaizhanguodouyoufengdi'],
    ['人口迁徙都很困难', 'renkouqianxidouhenkunnan'],
    ['长江都结冰了', 'changjiangdoujiebingle'],
    ['文武都随驾', 'wenwudousuijia'],
    ['礼乐都废弛', 'liyuedoufeichi'],
    ['城墙上都有箭孔', 'chengqiangshangdouyoujiankong'],
    ['清单超出了范围', 'qingdanchaochulefanwei'],
    ['他们都建康复中心', 'tamendoujiankangfuzhongxin'],
    ['也许都忘了', 'yexudouwangle'],
    ['双方去留都已决定', 'shuangfangquliudouyijueding'],
    ['诸神都沉默了', 'zhushendouchenmole'],
    ['市民利益都受损', 'shiminliyidoushousun'],
    ['这些药丸都过期了', 'zhexieyaowandouguoqile'],
    ['搜救队在日出降落', 'soujiuduizairichujiangluo'],
    ['校长征集意见', 'xiaozhangzhengjiyijian'],
    ['调降附加税', 'tiaojiangfujiashui'],
    ['由于大都采用新法', 'youyudadoucaiyongxinfa'],
    ['多家银行军工贷款增加', 'duojiayinhangjungongdaikuanzengjia'],
    ['节假降价', 'jiejiajiangjia'],
    ['双方洽降价事宜', 'shuangfangqiajiangjiashiyi'],
    ['就业率军事改革后上升', 'jiuyelvjunshigaigehoushangsheng'],
    ['伤亡率大军撤离后降低', 'shangwanglvdajunchelihoujiangdi'],
    ['回收率兵工厂周边最高', 'huishoulvbinggongchangzhoubianzuigao'],
    ['张辽率八百勇士冲阵', 'zhangliaoshuaibabaiyongshichongzhen'],
    ['停泊后单独漂泊', 'tingbohoudandupiaobo'],
    ['国都', 'guodu'],
    ['徙都', 'xidu'],
    ['江都', 'jiangdu'],
    ['武都', 'wudu'],
    ['乐都', 'ledu'],
    ['上都', 'shangdu'],
    ['单超', 'shanchao'],
    ['长征', 'changzheng'],
    ['出降', 'chuxiang'],
  ];
  const index = buildIndex([], clauses.map(([zh]) => ({zh})));
  assert.deepEqual(index.landmarks, clauses.map(([, key]) => [key]));
  assert.deepEqual(index.initials.landmarks[clauses.findIndex(([zh]) => zh === '搜救队在日出降落')], ['sjdzrcjl']);
});
test('both documented lake readings match event sites, full titles and title initials', () => {
  const ctrl = controller();
  for (const query of ['liáng shān pō', 'liangshanpo', 'liangshanbo']) {
    assert(ctrl._queryQuickSearch(query).some(hit =>
      hit.kind === 'event' && hit.rawYear === 1119 && hit.subZh.includes('梁山泊')), query);
  }
  for (const query of ['luó bù pō', 'luobubo', 'zgdykyzdzlbpcgbz', 'zgdykyzdzlbbcgbz',
    'zhongguodiyikeyuanzidanzailuobupochenggongbaozha',
    'zhongguodiyikeyuanzidanzailuobubochenggongbaozha']) {
    assert(ctrl._queryQuickSearch(query).some(hit =>
      hit.kind === 'event' && hit.rawYear === 1964 && hit.titleZh.includes('罗布泊')), query);
  }
});
test('Tibetan events use zang and storage terms keep cang', () => {
  const ctrl = controller();
  for (const [query, year, title] of [
    ['wenchenggongzhuruzang', 641, '文成公主入藏'],
    ['zangxiali', 644, '藏西阿里'],
    ['zangchuanfojiao', 1042, '藏传佛教'],
    ['hecangshu', 1071, '合藏书'],
    ['weizang', 1354, '统一卫藏'],
    ['wusizang', 1373, '设乌思藏'],
    ['weixizangdi', 1373, '维系藏地'],
    ['dalairuzang', 1720, '达赖入藏'],
    ['luobuzangdanjin', 1724, '罗卜藏丹津'],
    ['zhuzangdachen', 1727, '驻藏大臣'],
    ['dubanzangwu', 1727, '督办藏务'],
    ['qindingzangnei', 1792, '钦定藏内善后章程'],
    ['qingzangtielu', 2001, '青藏铁路'],
  ]) {
    assert(ctrl._queryQuickSearch(query).some(hit =>
      hit.kind === 'event' && hit.rawYear === year && hit.titleZh.includes(title)), query);
  }
});
test('Kashgar events match short and regional long pinyin names', () => {
  const ctrl = controller();
  for (const [query, years] of [
    ['kā shí', [97, 1826, 1878]],
    ['kashigaer', [1826, 1878]],
    ['kashigeer', [1826, 1878]],
    ['gongxiankashigaer', [1826]],
    ['kefukashigeer', [1878]],
  ]) {
    const results = ctrl._queryQuickSearch(query);
    for (const year of years) {
      assert(results.some(hit =>
        hit.kind === 'event' && hit.rawYear === year && hit.subZh.includes('喀什')), query + ' ' + year);
    }
  }
});
test('historical names and titles retain alternate contextual readings', () => {
  const ctrl = controller();
  for (const [query, year, title] of [
    ['han wu di qian yi zhang shuai shi tuan', -104, '遣译长率使团'],
    ['han wu di qian yi chang shuai shi tuan', -104, '遣译长率使团'],
    ['hwdqyzsstzxw', -104, '遣译长率使团'],
    ['hwdqycsstzxw', -104, '遣译长率使团'],
    ['jiaozhoulibichengdi', 545, '交州李贲称帝'],
    ['jiaozhoulibenchengdi', 545, '交州李贲称帝'],
    ['jushiqianguo', -60, '车师前国'],
    ['jsqg', -60, '车师前国'],
    ['cheshiqianguo', -60, '车师前国'],
    ['csqg', -60, '车师前国'],
    ['lù hé', 450, '北魏太武帝南征饮马长江'],
    ['liu he', 450, '北魏太武帝南征饮马长江'],
  ]) {
    assert(ctrl._queryQuickSearch(query).some(hit =>
      hit.kind === 'event' && hit.rawYear === year && hit.titleZh.includes(title)), query);
  }
});
test('historical names and locations match the atlas romanizations in context', () => {
  const ctrl = controller();
  for (const [query, year, title] of [
    ['zhang jue shuai tai ping dao', 184, '张角率太平道'],
    ['dong mou shan', 698, '东牟山'],
    ['li su xue ye ru cai zhou', 817, '李愬雪夜入蔡州'],
    ['song liao da cheng chong xi zeng bi', 1042, '重熙增币'],
    ['yue zun yu dun huang', 366, '乐僔于敦煌'],
    ['zhao gai she zhou', 1121, '诏改歙州'],
    ['zhi yue xi jun', -111, '越嶲郡'],
    ['xiao he cao shen fan kuai', -209, '萧何曹参樊哙'],
    ['zhan sha chu da jiang long ju', -204, '楚大将龙且'],
    ['du fu cen shen xue ju', 752, '杜甫、岑参、薛据'],
    ['fei sui yue wang yang tong', 619, '隋越王杨侗'],
    ['tai wan chi kan shuai ken min', 1652, '台湾赤嵌'],
    ['xùn xiàn', 369, '桓温'],
    ['fú hǎn', 385, '乞伏'],
    ['gāng zhōu', 1277, '碙洲'],
    ['shè xiàn', 1121, '诏改歙州'],
    ['guō yáng', -208, '陈胜'],
    ['qiān shèng', 69, '王景'],
    ['wuqianshengzhijinsong', -318, '五千乘之劲宋'],
  ]) {
    assert(ctrl._queryQuickSearch(query).some(hit =>
      hit.kind === 'event' && hit.rawYear === year && hit.titleZh.includes(title)), query);
  }
});
test('imperial abdication and ritual readings are searchable', () => {
  const ctrl = controller();
  for (const [query, year, title] of [
    ['hanwudidongxunfengshantaishan', -110, '封禅泰山'],
    ['wangmangporuziyingshanrang', 8, '孺子婴禅让'],
    ['caopishoushandaihan', 220, '曹丕受禅代汉'],
    ['qianlongshanweijiaqingdi', 1796, '乾隆禅位嘉庆帝'],
    ['yongzhenneishan', 805, '永贞内禅'],
    ['yzns', 805, '永贞内禅'],
  ]) {
    assert(ctrl._queryQuickSearch(query).some(hit =>
      hit.kind === 'event' && hit.rawYear === year && hit.titleZh.includes(title)), query);
  }
});
test('surrender readings are searchable in full pinyin and initials', () => {
  const ctrl = controller();
  for (const [query, year, title] of [
    ['wu san gui xiang qing', 1644, '吴三桂降清'],
    ['lv wen huan li jie xiang yuan', 1273, '吕文焕力竭降元'],
    ['lwhljxy', 1273, '吕文焕力竭降元'],
    ['xiao xian xiang tang', 621, '萧铣降唐'],
    ['li yu xiang', 975, '李煜降'],
  ]) {
    assert(ctrl._queryQuickSearch(query).some(hit =>
      hit.kind === 'event' && hit.rawYear === year && hit.titleZh.includes(title)), query);
  }
  const otherReadings = buildIndex([], [{zh: '山中降雨'}, {zh: '客机迫降'}]);
  assert.deepEqual(otherReadings.landmarks, [['shanzhongjiangyu'], ['kejipojiang']]);
});
test('pinyin can cross headline punctuation and curated names with middle dots have initials', () => {
  const ctrl = controller();
  for (const [query, title] of [
    ['nan jing tiao yue qian ding', '《南京条约》签订'],
    ['《nan jing tiao yue》qian ding', '《南京条约》签订'],
    ['ma ke bo luo', '马可·波罗'],
    ['ma ke · bo luo', '马可·波罗'],
    ['mkbl', '马可·波罗'],
    ['yibenbaitutai', '伊本·白图泰'],
    ['ybbtt', '伊本·白图泰'],
    ['yongyulejingkoubeigutinghuaigu', '永遇乐·京口北固亭怀古'],
    ['yyljkbgthg', '永遇乐·京口北固亭怀古'],
    ['lù—zhōu—xiàn', '路—州—县'],
    ['huai he — da san guan', '淮河—大散关'],
  ]) {
    assert(ctrl._queryQuickSearch(query).some(hit =>
      hit.kind === 'event' && hit.titleZh.includes(title)), query);
  }
});
test('existing Chinese, Traditional Chinese and English treaty results keep their scores and order', () => {
  const old = controller(false), current = controller();
  for (const query of ['尼布楚条约', '南京条约', '南京條約', 'Treaty of Nerchinsk', 'Treaty of Nanjing',
    '苏轼', '函谷关', '贞观元年', '公元前214年', '舆图寻址']) {
    assert.deepEqual(copy(current._queryQuickSearch(query).map(identity)), copy(old._queryQuickSearch(query).map(identity)), query);
  }
});
test('existing pinyin people, places and reigns remain ahead of additional event matches', () => {
  const old = controller(false), current = controller();
  for (const query of ['libai', 'Li Bai', 'changan', "Chang'an", 'zhenguan', 'zhen guan',
    'nj', 'nanjing', 'Nerchinsk', 'nankang', 'zhongyan', 'sizhou']) {
    const before = old._queryQuickSearch(query), after = current._queryQuickSearch(query);
    assert(before.length, query);
    assert.deepEqual(copy(after.slice(0, before.length).map(identity)), copy(before.map(identity)), query);
    assert(after.length <= 12, query);
  }
});
test('an exact pinyin location survives a reign collision at lower priority', () => {
  const ctrl = controller();
  const plain = ctrl._queryQuickSearch('longde');
  assert.equal(plain[0].kind, 'era');
  assert(plain[0].titleZh.includes('龙德'));
  for (const hits of [plain, ctrl._queryQuickSearch('lóng dé')]) {
    assert(hits.some(hit => hit.kind === 'event' && hit.rawYear === 1041 &&
      hit.titleZh.startsWith('好水川之战')));
  }
});
test('a reign match excludes partial-only event pinyin', () => {
  const ctrl = controller();
  const isLiuZhangEvent = hit => hit.kind === 'event' && hit.rawYear === 214 && hit.titleZh.includes('刘璋开城出降');
  const reignHits = ctrl._queryQuickSearch('kaicheng');
  assert(reignHits.some(hit => hit.kind === 'era' && hit.titleZh.includes('开成')));
  assert(!reignHits.some(isLiuZhangEvent));
  assert(ctrl._queryQuickSearch('liuzhangkaicheng').some(isLiuZhangEvent));
});
test('exact event pinyin beats partial pinyin before result limits and event deduplication', () => {
  const ctrl = controller();
  assert(ctrl._queryQuickSearch('yecheng').some(hit =>
    hit.rawYear === 580 && hit.titleZh.includes('焚毁邺城')));
  assert(ctrl._queryQuickSearch('jianlibeisong')[0].titleZh.startsWith('殿前都点检赵匡胤'));
});
test('short ASCII and unrelated queries do not acquire noisy pinyin-only matches', () => {
  const old = controller(false), current = controller();
  for (const query of ['', 'j', 'ni', 'nan', 'qin', '1689', 'not-a-real-event']) {
    assert.deepEqual(copy(current._queryQuickSearch(query).map(identity)), copy(old._queryQuickSearch(query).map(identity)), query);
  }
});
for (const [alias, name, year, full] of [
  ['njty', '南京条约', 1842, 'nanjingtiaoyue'],
  ['nbcty', '尼布楚条约', 1689, 'nibuchutiaoyue'],
  ['aszl', '安史之乱', 755, 'anshizhiluan'],
]) {
  test(alias + ' finds ' + name + ' below its full-pinyin match', () => {
    const ctrl = controller();
    for (const query of [alias, alias.toUpperCase(), alias.split('').join(' ')]) {
      const hit = ctrl._queryQuickSearch(query).find(h => h.kind === 'event' && h.rawYear === year && h.titleZh.includes(name));
      assert(hit, query);assert(hit.coord);assert(hit.milestone);
      const spelled = ctrl._queryQuickSearch(full).find(h => h.titleZh === hit.titleZh && h.rawYear === hit.rawYear);
      assert(spelled);assert(hit.score < spelled.score, 'full pinyin must retain priority');
    }
  });
}
const additionalAliases = [
  ['jybsb', '九一八事变', '九一八事变', [1931]],
  ['wsyd', '五四运动', '五四运动', [1919]],
  ['nmzz', '农民战争', '农民战争', [1627]],
  ['krzz', '抗日战争', '抗日战争', [1945]],
  ['xmzzygm', '新民主主义革命', '新民主主义革命', [1919]],
  ['flqy', '方腊起义', '方腊起义', [1121]],
  ['wcqy', '武昌起义', '武昌起义', [1911]],
  ['jwzz', '甲午战争', '甲午战争', [1894]],
  ['qsqy', '秋收起义', '秋收起义', [1927]],
  ['dycypzz', '第一次鸦片战争', '第一次鸦片战争', [1840, 1842]],
  ['xhgm', '辛亥革命', '辛亥革命', [1911]],
  ['jtqy', '金田起义', '金田起义', [1851]],
  ['ypzz', '鸦片战争', '鸦片战争', [1840, 1842, 1858, 1860]],
  ['hcqy', '黄巢起义', '黄巢起义', [881]],
  ['hjqy', '黄巾起义', '黄巾起义', [184]],
  ['tmzb', '土木之变', '土木堡之变', [1449]],
];
for (const [alias, name, canonical, years] of additionalAliases) {
  test(alias + ' finds ' + name + ' and retains its existing event context', () => {
    const ctrl = controller();
    const expected = ctrl._queryQuickSearch(canonical).filter(hit => hit.kind === 'event');
    const actionKey = hit => JSON.stringify([hit.rawYear, hit.coord]);
    const sourcesByAction = new Map(expected.map(hit => [actionKey(hit), hit]));
    assert(expected.length, canonical + ': expected source event is missing');
    for (const query of [alias, alias.toUpperCase(), alias.split('').join(' ')]) {
      const hits = ctrl._queryQuickSearch(query).filter(hit => hit.kind === 'event' &&
        sourcesByAction.has(actionKey(hit)));
      for (const year of years) assert(hits.some(hit => hit.rawYear === year), query + ': missing year ' + year);
      for (const hit of hits) {
        const source = sourcesByAction.get(actionKey(hit));
        assert.deepEqual(copy(hit.coord), copy(source.coord));
        assert.equal(hit.year, source.year);assert(hit.score < source.score, 'Chinese name must retain priority');
      }
    }
    const mistyped = alias + 'x';
    assert(!ctrl._queryQuickSearch(mistyped).some(hit => hit.kind === 'event' &&
      sourcesByAction.has(actionKey(hit))), mistyped);
  });
}
test('both 土木之变 and 土木堡之变 initials resolve to the same canonical event', () => {
  const ctrl = controller();
  const shorter = ctrl._queryQuickSearch('tmzb').find(hit => hit.kind === 'event' && hit.rawYear === 1449);
  const existing = ctrl._queryQuickSearch('tmbzb').find(hit => hit.kind === 'event' && hit.rawYear === 1449);
  assert(shorter);assert(existing);assert.equal(shorter.milestone, existing.milestone);
});
test('broad war initials keep first- and second-war candidates while specific initials stay specific', () => {
  const ctrl = controller();
  const broad = ctrl._queryQuickSearch('ypzz').filter(hit => hit.kind === 'event');
  assert(broad.some(hit => hit.rawYear === 1840));assert(broad.some(hit => hit.rawYear === 1860));
  const first = ctrl._queryQuickSearch('dycypzz').filter(hit => hit.kind === 'event');
  assert(first.length);assert(first.every(hit => hit.rawYear === 1840 || hit.rawYear === 1842));
});
test('initial collisions retain multiple event candidates', () => {
  const ctrl = controller();
  const treaty = ctrl._queryQuickSearch('njty').filter(h => h.kind === 'event' && h.rawYear === 1842 && h.titleZh.includes('南京条约'));
  assert.equal(treaty.length, 2, 'Nanjing and Hong Kong remain distinct treaty results');
  const rebellion = ctrl._queryQuickSearch('aszl').filter(h => h.kind === 'event' && h.titleZh.includes('安史之乱'));
  assert(rebellion.some(h => h.rawYear === 755));assert(rebellion.some(h => h.rawYear === 763));
});
test('initials allow a prefix of two letters and reject fragments and typos', () => {
  const ctrl = controller();
  for (const query of ['jty', 'bcty', 'nnjty', 'njtyx', 'aszlx']) {
    assert(!ctrl._queryQuickSearch(query).some(h => h.kind === 'event' &&
      /南京条约|尼布楚条约|安史之乱/.test(h.titleZh)), query);
  }
  for (const [query, year, name] of [
    ['jw', 1894, '甲午战争'],
    ['Jw', 1894, '甲午战争'],
    ['JWZ', 1894, '甲午战争'],
    ['j w z', 1894, '甲午战争'],
    ['njt', 1842, '南京条约'],
    ['nbct', 1689, '尼布楚条约'],
  ]) {
    const hits = ctrl._queryQuickSearch(query);
    assert(hits.length <= 4, query);
    assert(hits.some(hit => hit.kind === 'event' && hit.rawYear === year && hit.titleZh.includes(name)), query);
  }
});
test('initial prefix suggestions appear only when there are no stronger results', () => {
  const ctrl = controller();
  const event = ctrl._ensureSearchIndex().find(hit => hit.kind === 'event');
  const prefix = {...event, titleZh: '前缀用例', titleEn: '', keywords: '', pinyinKeys: [], initialKeys: ['jwzz'], rawYear: 101};
  const existing = {...prefix, titleZh: '原有匹配', titleEn: 'jw', initialKeys: [], rawYear: 102};
  ctrl.searchIndex = [prefix, existing];
  assert.deepEqual(copy(ctrl._queryQuickSearch('jw').map(hit => hit.titleZh)), ['原有匹配']);
  ctrl.searchIndex = [prefix, {...existing, titleZh: '完整缩写', titleEn: '', initialKeys: ['jwzz']}];
  prefix.initialKeys = ['jwzzx'];
  assert.deepEqual(copy(ctrl._queryQuickSearch('jwzz').map(hit => hit.titleZh)), ['完整缩写']);
});
test('curated event names win equal-length prefix ties at the default year', () => {
  const ctrl = controller();
  ctrl.year = ctrl.minYear;
  ctrl.dynastyIdx = 0;
  const index = ctrl._ensureSearchIndex();
  const event = index.find(item => item.kind === 'event' && item.rawYear === 621);
  ctrl.searchIndex = [{
    ...event,
    titleZh: '晋王守城',
    initialKeys: ['jwsc'],
    curatedInitialKeys: [],
    altPinyin: [],
  }, ...index];
  const [first] = ctrl._queryQuickSearch('jw');
  assert.equal(first.rawYear, 1894);
  assert(first.titleZh.includes('甲午战争'));
});
test('Chinese, English and full-pinyin search results are unchanged when initials are enabled', () => {
  const old = controller(true, false), current = controller();
  for (const query of ['尼布楚条约', '南京條約', 'Treaty of Nanjing', 'Treaty of Nerchinsk',
    'nibuchutiaoyue', 'ni bu chu tiao yue', 'nibuchu', 'nanjingtiaoyue', 'nan jing tiao yue', 'anshizhiluan',
    'libai', "Chang'an", 'zhenguan', 'zhen guan']) {
    assert.deepEqual(copy(current._queryQuickSearch(query).map(identity)), copy(old._queryQuickSearch(query).map(identity)), query);
  }
});
test('initial matches stay below text, aliases, keywords and full pinyin', () => {
  const ctrl = controller(), base = ctrl._ensureSearchIndex().find(h => h.kind === 'event');
  ctrl.searchIndex = [
    {titleEn: 'other', pinyinKeys: [], initialKeys: ['shijian']},
    {titleEn: 'other', pinyinKeys: ['shijian'], initialKeys: []},
    {titleEn: 'other', keywords: 'shijian'},
    {titleEn: 'other', aliases: ['shijian']},
    {titleEn: 'shijian'},
  ].map((fields, i) => ({...base, titleZh: '排序用例' + i, titleEn: '', keywords: '', pinyinKeys: [],
    initialKeys: [], rawYear: 100 + i, ...fields}));
  assert.deepEqual(copy(ctrl._queryQuickSearch('shijian').map(h => h.titleZh)),
    ['排序用例4', '排序用例3', '排序用例2', '排序用例1', '排序用例0']);
});
test('event location searches accept ü, v and combining tone marks', () => {
  const ctrl = controller();
  for (const query of ['lvshun', 'lüshun', 'lǚ shùn', 'lu\u0308\u030c shu\u0300n']) {
    assert(ctrl._queryQuickSearch(query).some(hit => hit.kind === 'event' &&
      /旅顺/.test(hit.milestone.site)), query);
  }
});
test('pinyin keys stay in event entries and the existing index is reused across searches', () => {
  const sourceBefore = JSON.stringify(generated);
  const ctrl = controller(), index = ctrl._ensureSearchIndex();
  assert(index.filter(e => e.kind !== 'event').every(e => !e.pinyinKeys && !e.initialKeys));
  ctrl._queryQuickSearch('nibuchutiaoyue');ctrl._queryQuickSearch('nanjingtiaoyue');
  assert.equal(ctrl._ensureSearchIndex(), index);
  controller();
  assert.equal(JSON.stringify(generated), sourceBefore, 'landmark merging must not mutate generated source rows');
});
