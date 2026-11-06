#!/usr/bin/env node
/**
 * Prefecture Layer Audit for Jiangshan Atlas (江山时序)
 * Zero external dependencies. For every snapshot with a prefecture layer (郡 / 州 / 府, its own
 * or inherited through prefRef), rasterizes the layer on a 0.05° grid (one cell is ~25 km²) and
 * counts:
 *
 *   overlap  cells claimed by two or more prefectures
 *   outside  cells inside a prefecture but outside every core polity (main, rival, protectorate)
 *            of the snapshot, e.g. a prefecture drawn on a different coastline or reused after
 *            the territory was lost
 *
 * The counts are a ratchet, like scripts/audit_topology.js:
 * data/atlas/prefecture_baseline.json records the accepted count for every snapshot, and --check
 * fails when any snapshot gets worse or the baseline is stale.
 *
 * Usage:
 *   node scripts/audit_prefectures.js                    # Print the worst snapshots
 *   node scripts/audit_prefectures.js --details <key>    # Print the overlapping pairs and the prefectures outside
 *   node scripts/audit_prefectures.js --check            # Compare against the baseline (CI)
 *   node scripts/audit_prefectures.js --update           # Lower the baseline after fixing prefectures
 *   node scripts/audit_prefectures.js --update --allow-increase   # Accept a regression on purpose
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadSources } = require('./build_atlas');
const { makeGrid, rasterize } = require('./topology_raster');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = 'data/atlas/prefecture_baseline.json';
const CORE_ROLES = new Set(['main', 'rival', 'protectorate']);
const RES = 0.05;

const polygonsOf = (shape) => (shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates);

function bboxOf(shape) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const rings of polygonsOf(shape)) {
    for (const [x, y] of rings[0]) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return [x0, y0, x1, y1];
}

/**
 * Rasterizes a shape on the global RES lattice. Returns { i0, j0, w, h, mask } where (i0, j0) is
 * the offset of the shape's own small grid in global cell units (column from 0°E, row from 90°N).
 */
function rasterShape(shape) {
  const [bx0, by0, bx1, by1] = bboxOf(shape);
  const i0 = Math.floor(bx0 / RES);
  const j0 = Math.floor((90 - by1) / RES);
  const x0 = i0 * RES;
  const yTop = 90 - j0 * RES;
  const grid = makeGrid([x0, by0, Math.max(bx1, x0 + RES), yTop], RES);
  grid.y1 = yTop;
  grid.h = Math.max(1, Math.ceil((yTop - by0) / RES));
  return { i0, j0, w: grid.w, h: grid.h, mask: rasterize(grid, polygonsOf(shape)) };
}

/** Audits every snapshot. Returns [{ key, overlap, outside, pairs, outsideBy }] in index order. */
function auditPrefectures(rootDir = ROOT) {
  const { index, doc } = loadSources(rootDir);
  const rasters = new Map();
  const rasterOf = (idx) => {
    if (!rasters.has(idx)) rasters.set(idx, rasterShape(doc.features[idx].shape));
    return rasters.get(idx);
  };
  const layerCache = new Map();
  const report = [];
  for (const key of index.order) {
    const snap = doc.snapshots[key];
    if (!snap || Array.isArray(snap)) continue;
    let prefs = Array.isArray(snap.prefectures) && snap.prefectures.length ? snap.prefectures : null;
    if (!prefs && snap.prefRef && doc.snapshots[snap.prefRef]) prefs = doc.snapshots[snap.prefRef].prefectures || null;
    prefs = (prefs || []).filter((idx) => doc.features[idx].shape);
    if (!prefs.length) continue;

    // Prefecture coverage: cell → list of prefecture indices (shared by snapshots with the same layer).
    const layerKey = prefs.join(',');
    if (!layerCache.has(layerKey)) {
      const cover = new Map();
      for (const idx of prefs) {
        const r = rasterOf(idx);
        for (let j = 0; j < r.h; j++) {
          for (let i = 0; i < r.w; i++) {
            if (!r.mask[j * r.w + i]) continue;
            const cell = (r.j0 + j) * 7200 + (r.i0 + i);
            const list = cover.get(cell);
            if (list) list.push(idx);
            else cover.set(cell, [idx]);
          }
        }
      }
      const pairs = new Map();
      let overlap = 0;
      for (const list of cover.values()) {
        if (list.length < 2) continue;
        overlap++;
        for (let a = 0; a < list.length; a++) {
          for (let b = a + 1; b < list.length; b++) {
            const names = [doc.features[list[a]].title, doc.features[list[b]].title].sort().join(' / ');
            pairs.set(names, (pairs.get(names) || 0) + 1);
          }
        }
      }
      layerCache.set(layerKey, { cover, overlap, pairs });
    }
    const { cover, overlap, pairs } = layerCache.get(layerKey);

    const core = new Set();
    const polities = Array.isArray(snap.polities) ? snap.polities : [];
    for (const idx of polities) {
      if (!CORE_ROLES.has(doc.features[idx].role) || !doc.features[idx].shape) continue;
      const r = rasterOf(idx);
      for (let j = 0; j < r.h; j++) {
        for (let i = 0; i < r.w; i++) if (r.mask[j * r.w + i]) core.add((r.j0 + j) * 7200 + (r.i0 + i));
      }
    }
    let outside = 0;
    const outsideBy = new Map();
    for (const [cell, list] of cover) {
      if (core.has(cell)) continue;
      outside++;
      for (const idx of list) outsideBy.set(doc.features[idx].title, (outsideBy.get(doc.features[idx].title) || 0) + 1);
    }
    report.push({ key, overlap, outside, pairs, outsideBy });
  }
  return report;
}

function toBaseline(report) {
  const out = {};
  for (const { key, overlap, outside } of report) if (overlap || outside) out[key] = { overlap, outside };
  return out;
}

/** One snapshot per line, in index order, so baseline diffs stay readable. */
function formatBaseline(baseline) {
  const lines = Object.entries(baseline).map(([key, v]) => `  ${JSON.stringify(key)}: { "overlap": ${v.overlap}, "outside": ${v.outside} }`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

function readBaseline(rootDir = ROOT) {
  const full = path.join(rootDir, BASELINE_PATH);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, 'utf8')) : {};
}

/** Compares a report with the baseline. Returns { worse: [...], better: [...] } message lists. */
function compareWithBaseline(report, baseline) {
  const worse = [];
  const better = [];
  const current = toBaseline(report);
  const keys = new Set(report.map((e) => e.key));
  for (const key of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
    if (!keys.has(key)) {
      better.push(`${key}: snapshot no longer has a prefecture layer`);
      continue;
    }
    const was = baseline[key] || { overlap: 0, outside: 0 };
    const now = current[key] || { overlap: 0, outside: 0 };
    for (const metric of ['overlap', 'outside']) {
      if (now[metric] > was[metric]) worse.push(`${key}: ${metric} ${was[metric]} → ${now[metric]}`);
      else if (now[metric] < was[metric]) better.push(`${key}: ${metric} ${was[metric]} → ${now[metric]}`);
    }
  }
  return { worse, better };
}

const top = (map, n) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n);

function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(fs.readFileSync(__filename, 'utf8').match(/Usage:\n([\s\S]*?)\n \*\//)[1].replace(/^ \* ?/gm, ''));
    return 0;
  }
  const report = auditPrefectures();
  const affected = report.filter((e) => e.overlap || e.outside);
  const totals = affected.reduce((t, e) => ({ overlap: t.overlap + e.overlap, outside: t.outside + e.outside }), { overlap: 0, outside: 0 });
  const summary = `${affected.length}/${report.length} snapshots, overlap=${totals.overlap} outside=${totals.outside} (0.05° cells)`;

  const detailsAt = args.indexOf('--details');
  if (detailsAt !== -1) {
    const entry = report.find((e) => e.key === args[detailsAt + 1]);
    if (!entry) throw new Error(`Unknown snapshot key or no prefecture layer: ${args[detailsAt + 1]}`);
    console.log(`${entry.key}: overlap=${entry.overlap} outside=${entry.outside}`);
    for (const [names, n] of top(entry.pairs, 20)) console.log(`  overlap  ${names}: ${n}`);
    for (const [name, n] of top(entry.outsideBy, 20)) console.log(`  outside  ${name}: ${n}`);
    return 0;
  }

  if (args.includes('--check') || args.includes('--update')) {
    const baseline = readBaseline();
    const { worse, better } = compareWithBaseline(report, baseline);
    if (args.includes('--update')) {
      const firstRun = !fs.existsSync(path.join(ROOT, BASELINE_PATH));
      if (worse.length && !firstRun && !args.includes('--allow-increase')) {
        for (const w of worse) console.error(`✗ ${w}`);
        console.error('Refusing to raise the baseline; fix the prefectures or pass --allow-increase.');
        return 1;
      }
      fs.writeFileSync(path.join(ROOT, BASELINE_PATH), formatBaseline(toBaseline(report)));
      console.log(`✓ Wrote ${BASELINE_PATH} (${summary})`);
      return 0;
    }
    for (const w of worse) console.error(`✗ worse: ${w}`);
    for (const b of better) console.error(`✗ better (baseline is stale): ${b}`);
    if (worse.length) {
      console.error('Prefecture layer regressed; see `node scripts/audit_prefectures.js --details <key>`.');
      return 1;
    }
    if (better.length) {
      console.error('Run `node scripts/audit_prefectures.js --update` and commit the baseline.');
      return 1;
    }
    console.log(`✓ Prefecture layer matches ${BASELINE_PATH} (${summary})`);
    return 0;
  }

  for (const e of [...affected].sort((a, b) => b.overlap + b.outside - (a.overlap + a.outside)).slice(0, 25)) {
    console.log(`${e.key}: overlap=${e.overlap} outside=${e.outside}`);
  }
  console.log(summary);
  return 0;
}

if (require.main === module) process.exit(main(process.argv));

module.exports = { auditPrefectures, compareWithBaseline, readBaseline };
