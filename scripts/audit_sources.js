#!/usr/bin/env node
/**
 * Source (reference) audit for Jiangshan Atlas.
 *
 * Historical facts can carry references in data/sources/*.json, keyed by a stable record key.
 * Settlements are out of scope: their key facts are location and seat rank, which a citation
 * rarely proves.
 * These files live in the repository only; the site never loads them.
 *
 *   milestone:<dynasty>:<year>       DYNASTY_DATA[].milestones (year is unique per dynasty)
 *   event:<id>                       ATLAS_LORE_DATA.PLACE_LANDMARK_EVENTS[].id
 *   journey:<key>:<year>             ATLAS_LORE_DATA.HISTORICAL_JOURNEYS[].stops (-2, -3 for repeated years)
 *   person:<key>                     ATLAS_LORE_DATA.PERSON_PROFILES
 *
 * A reference is { w, loc?, note?, url? }, where w is a work id from data/sources/works.json.
 *
 * Checks (errors fail CI):
 *   1. every landmark event has a unique, well-formed `id`;
 *   2. every reference names a known work and uses only known fields;
 *   3. every key points at an existing record (catches records that were renamed or re-dated);
 *   4. ratchet: records listed in data/sources/baseline.json may stay unsourced; every record added
 *      after the baseline must come with at least one reference;
 *   5. files are in canonical form (sorted, one key per line) so parallel PRs rarely conflict.
 *
 * Usage:
 *   node scripts/audit_sources.js                # coverage report
 *   node scripts/audit_sources.js --by-dynasty   # coverage per dynasty
 *   node scripts/audit_sources.js --check        # CI
 *   node scripts/audit_sources.js --fix          # rewrite files in canonical form
 *   node scripts/audit_sources.js --update       # shrink the baseline after adding references
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data/sources');
const REF_FIELDS = new Set(['w', 'loc', 'note', 'url']);
const WORK_KINDS = new Set(['primary', 'secondary', 'dataset', 'web']);
const EVENT_ID = /^[a-z0-9]+:-?\d+[a-z]?$/;
const errors = [];
const warnings = [];

// ---- records ---------------------------------------------------------------------------------
function loadRecords() {
  const ctx = { window: {} };
  for (const f of ['js/map_data.js', 'js/lore_core.js', 'js/lore_detail.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx);
  }
  const D = ctx.window.DYNASTY_DATA;
  const L = ctx.window.ATLAS_LORE_DATA;
  const recs = new Map(); // key → { kind, dynasty, label }
  const add = (key, r) => {
    if (recs.has(key)) errors.push(`duplicate record key ${key}`);
    else recs.set(key, r);
  };
  const numbered = () => {
    const seen = new Map();
    return (base) => {
      const n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      return n > 1 ? `${base}-${n}` : `${base}`;
    };
  };

  for (const d of D) {
    for (const m of d.milestones || []) {
      add(`milestone:${d.key}:${m.year}`, { kind: 'milestone', dynasty: d.key, label: m.headline });
    }
  }
  for (const e of L.PLACE_LANDMARK_EVENTS) {
    if (typeof e.id !== 'string' || !EVENT_ID.test(e.id)) {
      errors.push(
        `js/lore_detail.js: landmark event "${e.zh}" needs an "id" like "${e.dynastyKey}:${e.year}" ` +
          '(add a letter b, c, … if that id is taken; never change an existing id)'
      );
      continue;
    }
    add(`event:${e.id}`, { kind: 'event', dynasty: e.dynastyKey, label: `${e.site} · ${e.zh}` });
  }
  for (const j of L.HISTORICAL_JOURNEYS) {
    const stop = numbered();
    for (const s of j.stops) {
      add(`journey:${j.key}:${stop(s.year)}`, {
        kind: 'journey',
        dynasty: j.dynastyKey,
        label: `${j.shortZh} · ${s.ancientZh}`,
      });
    }
  }
  for (const p of Object.values(L.PERSON_PROFILES)) {
    add(`person:${p.key}`, { kind: 'person', dynasty: p.dynastyKey, label: p.zh });
  }
  return recs;
}

// ---- sources ---------------------------------------------------------------------------------
const inline = (v) =>
  JSON.stringify(v)
    .replace(/":/g, '": ')
    .replace(/,"/g, ', "')
    .replace(/},{/g, '}, {')
    .replace(/{"/g, '{ "')
    .replace(/"}/g, '" }');

function canonical(obj) {
  const keys = Object.keys(obj).sort();
  if (!keys.length) return '{}\n';
  return `{\n${keys.map((k) => `  ${JSON.stringify(k)}: ${inline(obj[k])}`).join(',\n')}\n}\n`;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`✗ ${path.relative(ROOT, file)}: ${err.message}`);
    process.exit(1);
  }
}

function loadSources() {
  const works = readJson(path.join(SRC, 'works.json'));
  const refs = new Map();
  const files = {};
  const names = fs.readdirSync(SRC).filter((f) => f.endsWith('.json') && f !== 'works.json' && f !== 'baseline.json');
  for (const f of names.sort()) {
    const text = fs.readFileSync(path.join(SRC, f), 'utf8');
    const obj = readJson(path.join(SRC, f));
    files[f] = { text, obj };
    for (const [k, v] of Object.entries(obj)) {
      if (refs.has(k)) errors.push(`${k} appears in both ${refs.get(k).file} and ${f}`);
      else refs.set(k, { file: f, list: v });
    }
  }
  return { works, refs, files };
}

// A nearby key for a reference whose record was renamed or re-dated.
function nearest(key, recs) {
  const parts = key.split(':');
  const prefix = `${parts[0]}:${parts[1]}:`;
  const year = parseInt(parts[2], 10);
  const near = [...recs.keys()].filter((k) => k.startsWith(prefix));
  if (!near.length) return null;
  if (!Number.isFinite(year)) return near[0];
  const dist = (k) => Math.abs(parseInt(k.split(':')[2], 10) - year);
  return near.filter((k) => Number.isFinite(dist(k))).sort((a, b) => dist(a) - dist(b))[0] || null;
}

// ---- audit -----------------------------------------------------------------------------------
const recs = loadRecords();
const { works, refs, files } = loadSources();
const baselinePath = path.join(SRC, 'baseline.json');
const baseline = fs.existsSync(baselinePath) ? new Set(readJson(baselinePath).unsourced) : null;

for (const [id, w] of Object.entries(works)) {
  if (!w || typeof w.zh !== 'string' || !WORK_KINDS.has(w.kind)) {
    errors.push(`works.json: ${id} needs "zh" and "kind" (${[...WORK_KINDS].join(' | ')})`);
  }
}
for (const [key, { file, list }] of refs) {
  if (!recs.has(key)) {
    const guess = nearest(key, recs);
    errors.push(`${file}: ${key} matches no record${guess ? ` (nearest: ${guess})` : ''}`);
  }
  if (!Array.isArray(list) || !list.length) {
    errors.push(`${file}: ${key} must be a non-empty list of references`);
    continue;
  }
  for (const r of list) {
    if (!works[r.w]) errors.push(`${file}: ${key} cites unknown work "${r.w}" (add it to works.json)`);
    for (const f of Object.keys(r)) if (!REF_FIELDS.has(f)) errors.push(`${file}: ${key} has unknown field "${f}"`);
    if (!r.loc && !r.url) warnings.push(`${file}: ${key} cites ${r.w} without loc or url`);
  }
}
if (!flag('--fix')) {
  for (const [f, { text, obj }] of Object.entries(files)) {
    if (text !== canonical(obj)) errors.push(`data/sources/${f} is not in canonical form (run: node scripts/audit_sources.js --fix)`);
  }
}
const cited = new Set([...refs.values()].flatMap(({ list }) => (Array.isArray(list) ? list.map((r) => r.w) : [])));
for (const w of Object.keys(works)) if (!cited.has(w)) warnings.push(`works.json: ${w} is not cited yet`);

const unsourced = [...recs.keys()].filter((k) => !refs.has(k));
if (baseline) {
  for (const k of unsourced) {
    if (!baseline.has(k)) {
      const r = recs.get(k);
      const file = r.kind === 'journey' ? 'journeys.json' : r.kind === 'person' ? 'persons.json' : `${r.dynasty}.json`;
      errors.push(`${k} is new and has no reference (${r.label}); add it to data/sources/${file}`);
    }
  }
}

// ---- report / actions ------------------------------------------------------------------------
const row = (name, keys) => {
  const n = keys.length;
  const s = keys.filter((k) => refs.has(k)).length;
  const pct = n ? ((100 * s) / n).toFixed(1) : '0.0';
  return `${name.padEnd(11)} ${String(s).padStart(5)} / ${String(n).padEnd(5)} ${pct.padStart(5)}%`;
};
console.log('Source coverage');
for (const kind of ['milestone', 'event', 'journey', 'person']) {
  console.log(`  ${row(kind, [...recs.keys()].filter((k) => recs.get(k).kind === kind))}`);
}
console.log(`  ${row('total', [...recs.keys()])}`);
if (flag('--by-dynasty')) {
  const byDyn = new Map();
  for (const [k, r] of recs) {
    if (!byDyn.has(r.dynasty)) byDyn.set(r.dynasty, []);
    byDyn.get(r.dynasty).push(k);
  }
  for (const [d, keys] of byDyn) console.log(`    ${row(d, keys)}`);
}

if (flag('--fix')) {
  for (const [f, { obj }] of Object.entries(files)) fs.writeFileSync(path.join(SRC, f), canonical(obj));
  console.log('✓ rewrote data/sources in canonical form');
}
if (flag('--update')) {
  if (errors.length) {
    for (const e of errors) console.error(`✗ ${e}`);
    process.exit(1);
  }
  fs.writeFileSync(
    baselinePath,
    `{\n  "unsourced": [\n${unsourced.sort().map((k) => `    ${JSON.stringify(k)}`).join(',\n')}\n  ]\n}\n`
  );
  console.log(`✓ wrote baseline (${unsourced.length} records may stay unsourced)`);
}
for (const w of warnings) console.log(`  ⚠ ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  if (flag('--check')) process.exit(1);
} else if (flag('--check')) {
  console.log(`✓ Sources OK (${refs.size} records referenced, ${unsourced.length} grandfathered)`);
}
