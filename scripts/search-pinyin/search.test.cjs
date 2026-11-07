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
  const index = buildIndex([{key: 'fixture', milestones: [{headline: '南京条约', site: '尼布楚'},
    {headline: '长安会盟', site: '会稽（六安）'}]}], [{zh: '南京条约', site: '旅顺'},
    {zh: '王君㚟', site: '高句丽 · 大宛'}, {zh: '南京条约', site: '南京条约'}]);
  assert.deepEqual(index.milestones.fixture, [['nanjingtiaoyue', 'nibuchu'], ['changanhuimeng', 'kuaiji', 'luan']]);
  assert.deepEqual(index.landmarks, [['nanjingtiaoyue', 'lvshun'], ['wangjunchuo', 'gaogouli', 'dayuan'], ['nanjingtiaoyue']]);
  assert.deepEqual(index.initials.milestones.fixture, [['njty'], ['cahm']]);
  assert.deepEqual(index.initials.landmarks, [['njty'], [], ['njty']]);
  const reordered = buildIndex([{key: 'fixture', milestones: [{headline: '长安会盟', site: '会稽（六安）'},
    {headline: '南京条约', site: '尼布楚'}]}], []);
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
    hit.milestone === merged.milestone && hit.titleZh.includes('第一次鸦片战争')));
  const separate = entries.find(e => e.kind === 'event' && e.rawYear === 1842 && e.titleZh.includes('维多利亚'));
  assert(ctrl._queryQuickSearch('weiduoliya').some(h => h.titleZh === separate.titleZh));
  const locationOnly = buildIndex([], [{zh: '南京条约', site: '尼布楚'}]);
  assert(locationOnly.landmarks[0].includes('nibuchu'));
});
test('merged event matches display the landmark headline and keep the Chinese result action', () => {
  const ctrl = controller();
  for (const [chinese, year, queries] of [
    ['汉水之战', 219, ['hanshuizhizhan', 'hszz']],
    ['包拯权知开封府', 1057, ['baozhengquanzhikaifengfu']],
  ]) {
    const expected = ctrl._queryQuickSearch(chinese).find(hit =>
      hit.kind === 'event' && hit.rawYear === year && hit.titleZh.startsWith(chinese));
    assert(expected, chinese);
    for (const query of queries) {
      const hit = ctrl._queryQuickSearch(query).find(result => result.milestone === expected.milestone);
      assert.equal(hit?.titleZh, expected.titleZh, query);
      assert.deepEqual(hit.coord, expected.coord);
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
  ]) {
    assert(ctrl._queryQuickSearch(query).some(hit =>
      hit.kind === 'event' && hit.rawYear === year && hit.titleZh.includes(title)), query);
  }
  const fixture = buildIndex([], [{zh: '人们大都同意', site: '大都（北京）'}]);
  assert.deepEqual(fixture.landmarks[0], ['renmendadoutongyi', 'dadu', 'beijing']);
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
    assert(expected.length, canonical + ': expected source event is missing');
    for (const query of [alias, alias.toUpperCase(), alias.split('').join(' ')]) {
      const hits = ctrl._queryQuickSearch(query).filter(hit => hit.kind === 'event' &&
        expected.some(source => source.milestone === hit.milestone));
      for (const year of years) assert(hits.some(hit => hit.rawYear === year), query + ': missing year ' + year);
      for (const hit of hits) {
        const source = expected.find(source => source.milestone === hit.milestone);
        assert.deepEqual(copy(hit.coord), copy(source.coord));
        assert.equal(hit.year, source.year);assert(hit.score < source.score, 'Chinese name must retain priority');
      }
    }
    const mistyped = alias + 'x';
    assert(!ctrl._queryQuickSearch(mistyped).some(hit => hit.kind === 'event' &&
      expected.some(source => source.milestone === hit.milestone)), mistyped);
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
