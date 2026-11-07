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
function controller(withPinyin = true) {
  w.ATLAS_EVENT_PINYIN = withPinyin ? generated : undefined;
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
  const {dynasties, landmarks} = loadSources();
  const index = buildIndex(dynasties, landmarks);
  assert.equal(fs.readFileSync(path.join(ROOT, 'js/event_pinyin.js'), 'utf8'), renderBundle(index));
  for (const dynasty of dynasties) assert.equal(index.milestones[dynasty.key].length, (dynasty.milestones || []).length);
  assert.equal(index.landmarks.length, landmarks.length);
  for (const keys of [...Object.values(index.milestones).flat(), ...index.landmarks]) {
    assert(keys.length, 'event has no title/location keys');
    assert(keys.every(key => /^[a-z]+$/.test(key)), 'unconverted text in ' + keys);
  }
});
test('generation handles new events, duplicate text and phrase-aware place readings', () => {
  const index = buildIndex([{key: 'fixture', milestones: [{headline: '南京条约', site: '尼布楚'},
    {headline: '长安会盟', site: '会稽（六安）'}]}], [{zh: '南京条约', site: '旅顺'},
    {zh: '王君㚟', site: '高句丽 · 大宛'}, {zh: '南京条约', site: '南京条约'}]);
  assert.deepEqual(index.milestones.fixture, [['nanjingtiaoyue', 'nibuchu'], ['changanhuimeng', 'kuaiji', 'luan']]);
  assert.deepEqual(index.landmarks, [['nanjingtiaoyue', 'lvshun'], ['wangjunchuo', 'gaogouli', 'dayuan'], ['nanjingtiaoyue']]);
  const reordered = buildIndex([{key: 'fixture', milestones: [{headline: '长安会盟', site: '会稽（六安）'},
    {headline: '南京条约', site: '尼布楚'}]}], []);
  assert.notEqual(renderBundle(index), renderBundle(reordered));
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
  assert(merged.pinyinKeys.some(key => key.includes('diyiciyapianzhanzheng')));
  const separate = entries.find(e => e.kind === 'event' && e.rawYear === 1842 && e.titleZh.includes('维多利亚'));
  assert(ctrl._queryQuickSearch('weiduoliya').some(h => h.titleZh === separate.titleZh));
  const locationOnly = buildIndex([], [{zh: '南京条约', site: '尼布楚'}]);
  assert(locationOnly.landmarks[0].includes('nibuchu'));
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
  for (const query of ['libai', 'Li Bai', 'changan', "Chang'an", 'zhenguan', 'zhen guan']) {
    assert.deepEqual(copy(identity(current._queryQuickSearch(query)[0])), copy(identity(old._queryQuickSearch(query)[0])), query);
  }
  for (const query of ['nanjing', 'Nerchinsk']) {
    const before = old._queryQuickSearch(query), after = current._queryQuickSearch(query);
    assert.deepEqual(copy(identity(after[0])), copy(identity(before[0])), query);
    for (const hit of after) {
      const previous = before.find(p => p.kind === hit.kind && p.titleZh === hit.titleZh && p.year === hit.year);
      if (previous) assert.equal(hit.score, previous.score, query + ': existing score changed');
    }
  }
});
test('short ASCII and unrelated queries do not acquire noisy pinyin-only matches', () => {
  const old = controller(false), current = controller();
  for (const query of ['', 'ni', 'nan', 'qin', '1689', 'not-a-real-event', 'njty']) {
    assert.deepEqual(copy(current._queryQuickSearch(query).map(identity)), copy(old._queryQuickSearch(query).map(identity)), query);
  }
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
  assert(index.filter(e => e.kind !== 'event').every(e => !e.pinyinKeys));
  ctrl._queryQuickSearch('nibuchutiaoyue');ctrl._queryQuickSearch('nanjingtiaoyue');
  assert.equal(ctrl._ensureSearchIndex(), index);
  controller();
  assert.equal(JSON.stringify(generated), sourceBefore, 'landmark merging must not mutate generated source rows');
});
