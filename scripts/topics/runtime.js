'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { CONTROLLER_SCRIPTS } = require('../sync_version');
const { JS_DIR, DATA_TOPICS_DIR, SOURCES_DIR } = require('./config');

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

// "前332—前257", with "？" for a birth or death year the sources do not record.
function fmtPersonSpanZh(profile) {
  const span = Array.isArray(profile.span) ? profile.span : [0, 0];
  const u = profile.spanUnknown || '';
  const birth = u === 'birth' || u === 'both' ? '？' : fmtYearShortZh(span[0]);
  const death = u === 'death' || u === 'both' ? '？' : fmtYearShortZh(span[1]);
  return `${birth}—${death}`;
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

function firstSentenceZh(text, maxLen = 90) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentMatch = clean.match(/^.+?[。！？]/);
  const first = sentMatch ? sentMatch[0] : clean;
  if (first.length <= maxLen) return first;
  const head = first.slice(0, maxLen);
  const semiIdx = head.lastIndexOf('；');
  const commaIdx = head.lastIndexOf('，');
  const cutIdx = semiIdx >= 24 ? semiIdx : commaIdx;
  const rawSlice = cutIdx >= 16 ? head.slice(0, cutIdx) : head.slice(0, Math.max(16, maxLen - 1));
  const stripped = rawSlice.replace(/[，；、：:\s]+$/, '');
  const prevSep = Math.max(stripped.lastIndexOf('；'), stripped.lastIndexOf('，'));
  const body =
    prevSep >= 12 && stripped.length - prevSep - 1 <= 2
      ? stripped.slice(0, prevSep).replace(/[，；、：:\s]+$/, '')
      : stripped;
  return `${body}…`;
}

function dedupeConsecutive(items) {
  const out = [];
  for (const x of items || []) {
    if (out.length === 0 || out[out.length - 1] !== x) out.push(x);
  }
  return out;
}

function buildMapHref(query = '', { lang = 'zh', base = '../' } = {}) {
  const clean = String(query || '').replace(/^\?/, '');
  if (lang !== 'en') {
    return clean ? `${base}?${clean}` : base;
  }
  if (!clean) return `${base}?lang=en`;
  return /(?:^|&)lang=/.test(clean) ? `${base}?${clean}` : `${base}?${clean}&lang=en`;
}

function buildEmbedHref(embedQuery = '', { lang = 'zh', base = '../' } = {}) {
  const clean = String(embedQuery || '').replace(/^\?/, '').replace(/^embed=1&?/, '');
  const baseEmbed = clean ? `${base}?embed=1&${clean}` : `${base}?embed=1`;
  if (lang !== 'en') return baseEmbed;
  return /(?:^|&)lang=/.test(baseEmbed) ? baseEmbed : `${baseEmbed}&lang=en`;
}

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

function loadTopicsData() {
  const readJson = (name) => JSON.parse(fs.readFileSync(path.join(DATA_TOPICS_DIR, name), 'utf8'));
  return {
    dynastyNotes: readJson('dynasty_notes.json'),
    featuredTopics: readJson('featured_topics.json'),
    geoOverrides: readJson('geo_overrides.json'),
    placesCatalog: readJson('places.json'),
  };
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

module.exports = {
  escHtml,
  fmtYearZh,
  fmtYearShortZh,
  fmtPersonSpanZh,
  fmtYearEn,
  fmtDynSpanZh,
  fmtDynSpanEn,
  firstSentenceZh,
  dedupeConsecutive,
  buildMapHref,
  buildEmbedHref,
  loadSourcesBundle,
  loadTopicsData,
  formatSourceCitationsHtml,
  loadAtlasRuntime,
};
