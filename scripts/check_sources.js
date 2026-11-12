#!/usr/bin/env node
/**
 * Reference spot-check for data/sources/ (local tool; needs network, so it is not part of CI).
 *
 * For every reference that has a `url`, downloads the page (cached) and checks that
 *   1. the page loads;
 *   2. the chapter number (卷) in `loc` is the one in the URL;
 *   3. the chapter title in `loc` (e.g. 项羽本纪, 晋纪二十八) occurs in the page;
 *   4. each regnal date in `loc` (e.g. 太元十年, 汉元年) occurs in the page, with the era or
 *      ruler name close to the year (二世皇帝下二年 and 汉之二年 count).
 *
 * This only shows that the cited chapter is the right one and covers the cited date. Whether the
 * passage is about the atlas record still has to be read by a person.
 *
 *   ✓  everything checkable in `loc` is in the page
 *   ~  partly found (title not found, or a year without its era nearby): read it
 *   ✗  page missing, chapter number mismatch, or a year that is nowhere in the page
 *   –  nothing to check (no url, or `loc` has neither a title nor a date)
 *
 * Usage:
 *   node scripts/check_sources.js qin dongjin       # data/sources/qin.json, dongjin.json
 *   node scripts/check_sources.js --changed         # references added or changed since origin/main
 *   node scripts/check_sources.js --changed <ref>   # ... since another git ref
 *   node scripts/check_sources.js qin --refresh     # ignore the download cache
 *
 * Exits 1 if any reference is ✗.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data/sources');
const CACHE = path.join(os.tmpdir(), 'jiangshan-sources-cache');
const USER_AGENT = 'jiangshan-map-check-sources/1.0 (+https://github.com/DeanChensj/jiangshan-map)';
const REQUEST_GAP_MS = 1500; // Wikisource throttles bursts.
const NON_RECORD_FILES = new Set(['works.json', 'baseline.json']);

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const changedAt = args.indexOf('--changed');
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

function usage() {
  console.error('Usage: node scripts/check_sources.js <dynasty|file>... | --changed [git-ref]   [--refresh]');
  process.exit(2);
}

// ---- which references ------------------------------------------------------------------------
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function recordFiles() {
  return fs.readdirSync(SRC).filter((f) => f.endsWith('.json') && !NON_RECORD_FILES.has(f)).sort();
}

function selectRecords() {
  if (changedAt >= 0) {
    const next = args[changedAt + 1];
    const base = next && !next.startsWith('--') ? next : 'origin/main';
    const out = [];
    for (const f of recordFiles()) {
      let before = {};
      try {
        before = JSON.parse(execFileSync('git', ['show', `${base}:data/sources/${f}`], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }));
      } catch (_) {
        // New file, or the base ref does not have it.
      }
      for (const [key, refs] of Object.entries(readJson(path.join(SRC, f)))) {
        if (JSON.stringify(before[key]) !== JSON.stringify(refs)) out.push({ file: f, key, refs });
      }
    }
    return out;
  }
  const names = args.filter((a) => !a.startsWith('--'));
  if (!names.length) usage();
  const out = [];
  for (const name of names) {
    const f = name.endsWith('.json') ? path.basename(name) : `${name}.json`;
    if (NON_RECORD_FILES.has(f) || !fs.existsSync(path.join(SRC, f))) {
      console.error(`✗ data/sources/${f} is not a reference file`);
      process.exit(2);
    }
    for (const [key, refs] of Object.entries(readJson(path.join(SRC, f)))) out.push({ file: f, key, refs });
  }
  return out;
}

// ---- pages -----------------------------------------------------------------------------------
const pages = new Map(); // url → { text } | { error }
let lastRequest = 0;

function pageText(html) {
  return hans(
    html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&#?\w+;/g, '')
      .replace(/\s+/g, '')
  );
}

async function download(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const wait = lastRequest + REQUEST_GAP_MS * attempt - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
      const html = await res.text();
      if (res.status === 404) return { error: 'HTTP 404' };
      // Throttled requests come back as a short "Wikimedia Error" page, sometimes with status 200.
      if (res.ok && !/<title>Wikimedia Error<\/title>/.test(html)) return { html };
    } catch (_) {
      // Network error: retry.
    }
  }
  return { error: 'could not download (throttled or offline); try again later' };
}

async function loadPage(url) {
  if (pages.has(url)) return pages.get(url);
  const file = path.join(CACHE, `${crypto.createHash('sha1').update(url).digest('hex')}.html`);
  let page;
  if (!refresh && fs.existsSync(file)) {
    page = { text: pageText(fs.readFileSync(file, 'utf8')) };
  } else {
    const got = await download(url);
    if (got.html) {
      fs.mkdirSync(CACHE, { recursive: true });
      fs.writeFileSync(file, got.html);
      page = { text: pageText(got.html) };
    } else {
      page = { error: got.error };
    }
  }
  pages.set(url, page);
  return page;
}

// ---- checks ----------------------------------------------------------------------------------
// Everything is compared in simplified characters: Wikisource mixes variants (咸/鹹, 升/昇).
const hans = (() => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/zh_hant.js'), 'utf8'), ctx);
  return (s) => ctx.window.ZH_HANT_CONV.toHans(s);
})();

// "卷8", "卷028上", "卷三" → comparable form; null when the string names no chapter.
function chapter(s) {
  const m = /卷(\d+|[一二三四五六七八九十百]+)([上中下]?)/.exec(s);
  if (!m) return null;
  return { numeric: /^\d+$/.test(m[1]), value: /^\d+$/.test(m[1]) ? String(Number(m[1])) : m[1], part: m[2] };
}

// Years such as 十年, 元年, with the era or ruler name written before them (太元, 二世, 汉).
const YEAR = /(?:元|[一二三四五六七八九十]{1,3})年/;
const CONNECTORS = /[及与至于在和后前并而自]/;

// Dates in brackets are the contributor's gloss (太建十四年（开皇二年）), not the text's own dating.
function datesIn(loc) {
  const out = [];
  for (const segment of loc.replace(/[（(][^）)]*[）)]/g, ' ').split(/[\s、；，,;]+/)) {
    for (const m of segment.matchAll(new RegExp(YEAR, 'g'))) {
      const before = segment.slice(Math.max(0, m.index - 3), m.index).split(CONNECTORS).pop();
      out.push({ era: /^[\u4e00-\u9fa5]*$/.test(before) ? before : '', year: m[0] });
    }
  }
  return out;
}

// The chapter title is the first word after 卷N (项羽本纪, 秦纪三); skip 列传第三十二-style counters.
// Biographies are headed by the name alone, so 刘琨传 and 张轨传附张骏 are looked up as 刘琨, 张轨.
function titleIn(loc) {
  const words = loc.split(/\s+/).filter((w) => !/^卷/.test(w));
  const title = words.find((w) => /^[\u4e00-\u9fa5]+$/.test(w) && !/^(列传|载记|帝纪|志)第/.test(w) && !YEAR.test(w)) || '';
  return title.replace(/传(附.*)?$/, '');
}

const isSubsequence = (needle, hay) => {
  let i = 0;
  for (const ch of hay) if (ch === needle[i]) i++;
  return i === needle.length;
};

// Is `era` written within a few characters before some occurrence of `year`?
function eraNearYear(text, era, year) {
  for (let i = text.indexOf(year); i >= 0; i = text.indexOf(year, i + 1)) {
    if (isSubsequence(era, text.slice(Math.max(0, i - 12), i))) return true;
  }
  return false;
}

async function checkRef(ref) {
  if (!ref.url) return { mark: '–', detail: 'no url' };
  const page = await loadPage(ref.url);
  if (page.error) return { mark: '✗', detail: page.error };

  const loc = hans(ref.loc);
  const want = chapter(loc);
  const have = chapter(decodeURIComponent(ref.url.split('/').pop()));
  if (want && have && want.numeric === have.numeric && (want.value !== have.value || want.part !== have.part)) {
    return { mark: '✗', detail: `loc says 卷${want.value}${want.part}, url is 卷${have.value}${have.part}` };
  }

  const title = titleIn(loc);
  const dates = datesIn(loc);
  if (!title && !dates.length) return { mark: '–', detail: 'no title or date in loc' };

  const missing = dates.filter((d) => !page.text.includes(d.year));
  if (missing.length) return { mark: '✗', detail: `not in page: ${missing.map((d) => d.era + d.year).join(', ')}` };

  const weak = [];
  if (title && !page.text.includes(title)) weak.push(`title ${title} not found`);
  for (const d of dates) {
    // A ruler's own annals (秦始皇本纪) write bare years, so the title can stand in for the era.
    if (!d.era || isSubsequence(d.era, title)) continue;
    if (!eraNearYear(page.text, d.era, d.year)) weak.push(`${d.year} found, but not with ${d.era} nearby`);
  }
  return weak.length ? { mark: '~', detail: weak.join('; ') } : { mark: '✓', detail: '' };
}

// ---- run -------------------------------------------------------------------------------------
(async () => {
  const records = selectRecords();
  if (!records.length) {
    console.log('No references to check.');
    return;
  }
  const count = { '✓': 0, '~': 0, '✗': 0, '–': 0 };
  let file = null;
  for (const rec of records) {
    if (rec.file !== file) {
      file = rec.file;
      console.log(`\ndata/sources/${file}`);
    }
    for (const ref of rec.refs) {
      const { mark, detail } = await checkRef(ref);
      count[mark]++;
      console.log(`  ${mark} ${rec.key}  ${ref.w} ${ref.loc}${detail ? `\n      ${detail}` : ''}`);
    }
  }
  const total = Object.values(count).reduce((a, b) => a + b, 0);
  console.log(`\n${total} references: ✓ ${count['✓']}  ~ ${count['~']}  ✗ ${count['✗']}  – ${count['–']}`);
  console.log('✓ means the chapter is the right one and covers the date; a person still reads the passage.');
  if (count['✗']) process.exit(1);
})();
