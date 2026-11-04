#!/usr/bin/env node
/**
 * Polity Border Topology Audit for Jiangshan Atlas (江山时序)
 * Zero external dependencies. Counts, per snapshot, the places where two core polities
 * (role main, rival or protectorate) fail to share a border cleanly. Each vertex and each edge
 * midpoint of one polity is a sample point:
 *
 *   overlap  a sample point of one polity lies strictly inside another polity
 *   gap      a sample point of one polity lies outside another polity but within GAP_DEG of its
 *            border without sitting on it (sliver gaps and 0.01° rounding drift)
 *
 * Neighbor polities (role "neighbor") are drawn as fuzzy context and are not audited.
 *
 * The counts are a ratchet: data/atlas/topology_baseline.json records the accepted count for
 * every snapshot, and --check fails when any snapshot gets worse or the baseline is stale.
 *
 * Usage:
 *   node scripts/audit_topology.js                    # Print the worst snapshots
 *   node scripts/audit_topology.js --details <key>    # Print every mismatched pair in one snapshot
 *   node scripts/audit_topology.js --check            # Compare against the baseline (CI)
 *   node scripts/audit_topology.js --update           # Lower the baseline after fixing borders
 *   node scripts/audit_topology.js --update --allow-increase   # Accept a regression on purpose
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadSources } = require('./build_atlas');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = 'data/atlas/topology_baseline.json';
const CORE_ROLES = new Set(['main', 'rival', 'protectorate']);
const GAP_DEG = 0.04; // ~4 km
const ON_BORDER_DEG = 1e-9;
const CELL_DEG = 0.25;

const cellOf = (v) => Math.floor(v / CELL_DEG);
const pointKey = (x, y) => `${Math.round(x * 100)},${Math.round(y * 100)}`;

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Precomputes the rings, bbox, vertex set and segment indexes of one feature geometry. */
function indexShape(shape) {
  const rings = shape.type === 'Polygon' ? shape.coordinates : shape.coordinates.flat();
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  const vertices = new Set();
  const segs = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = ring[i];
      vertices.add(pointKey(x, y));
      if (x < bbox[0]) bbox[0] = x;
      if (y < bbox[1]) bbox[1] = y;
      if (x > bbox[2]) bbox[2] = x;
      if (y > bbox[3]) bbox[3] = y;
      const [bx, by] = ring[(i + 1) % ring.length];
      if (bx !== x || by !== y) segs.push([x, y, bx, by]);
    }
  }
  // grid: segments by the cells their bbox touches (distance queries).
  // bands: segments by the rows their y-range touches (point-in-polygon ray casting).
  const grid = new Map();
  const bands = new Map();
  segs.forEach((s, i) => {
    const [x0, x1] = s[0] < s[2] ? [s[0], s[2]] : [s[2], s[0]];
    const [y0, y1] = s[1] < s[3] ? [s[1], s[3]] : [s[3], s[1]];
    for (let cy = cellOf(y0); cy <= cellOf(y1); cy++) {
      if (!bands.has(cy)) bands.set(cy, []);
      bands.get(cy).push(i);
      for (let cx = cellOf(x0); cx <= cellOf(x1); cx++) {
        const k = `${cx},${cy}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      }
    }
  });
  return { rings, bbox, vertices, segs, grid, bands };
}

/** Even-odd point-in-polygon over every ring (holes and multipolygon parts included). */
function contains(shape, px, py) {
  let inside = false;
  for (const i of shape.bands.get(cellOf(py)) || []) {
    const [xa, ya, xb, yb] = shape.segs[i];
    if (ya > py !== yb > py && px < ((xb - xa) * (py - ya)) / (yb - ya) + xa) inside = !inside;
  }
  return inside;
}

/** Distance from a point to the shape's border, or Infinity when farther than GAP_DEG. */
function borderDistance(shape, px, py) {
  let best = Infinity;
  const seen = new Set();
  for (let cy = cellOf(py - GAP_DEG); cy <= cellOf(py + GAP_DEG); cy++) {
    for (let cx = cellOf(px - GAP_DEG); cx <= cellOf(px + GAP_DEG); cx++) {
      for (const i of shape.grid.get(`${cx},${cy}`) || []) {
        if (seen.has(i)) continue;
        seen.add(i);
        const d = distanceToSegment(px, py, ...shape.segs[i]);
        if (d < best) best = d;
      }
    }
  }
  return best <= GAP_DEG ? best : Infinity;
}

/** Counts overlap and gap vertices of shape a against shape b. */
/**
 * Counts overlap and gap sample points of shape a against shape b. Samples are a's vertices and
 * the midpoints of a's edges: a sliver whose corners all sit on b's border still has an edge
 * running through b or beside it.
 */
function compareShapes(a, b) {
  const result = { overlap: 0, gap: 0 };
  const [bx0, by0, bx1, by1] = b.bbox;
  const sample = (x, y, isVertex) => {
    if (x < bx0 - GAP_DEG || x > bx1 + GAP_DEG || y < by0 - GAP_DEG || y > by1 + GAP_DEG) return;
    if (isVertex && b.vertices.has(pointKey(x, y))) return;
    const d = borderDistance(b, x, y);
    if (d <= ON_BORDER_DEG) return;
    if (contains(b, x, y)) result.overlap++;
    else if (d !== Infinity) result.gap++;
  };
  for (const ring of a.rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x, y] = ring[i];
      const [nx, ny] = ring[i + 1];
      sample(x, y, true);
      sample((x + nx) / 2, (y + ny) / 2, false);
    }
  }
  return result;
}

const bboxesTouch = (a, b) =>
  a[0] - GAP_DEG <= b[2] && b[0] - GAP_DEG <= a[2] && a[1] - GAP_DEG <= b[3] && b[1] - GAP_DEG <= a[3];

/** Audits every snapshot. Returns [{ key, overlap, gap, pairs: [{ a, b, overlap, gap }] }] in index order. */
function auditTopology(rootDir = ROOT) {
  const { index, doc } = loadSources(rootDir);
  return auditDoc(doc, index.order);
}

/** Audits the given snapshot keys of a loaded { features, snapshots } document. */
function auditDoc(doc, keys) {
  const shapes = new Map();
  const shapeOf = (idx) => {
    if (!shapes.has(idx)) shapes.set(idx, indexShape(doc.features[idx].shape));
    return shapes.get(idx);
  };
  const pairCache = new Map();
  const report = [];
  for (const key of keys) {
    const snap = doc.snapshots[key];
    const polities = Array.isArray(snap) || !Array.isArray(snap.polities) ? [] : snap.polities;
    const core = [...new Set(polities)].filter((idx) => CORE_ROLES.has(doc.features[idx].role) && doc.features[idx].shape);
    const entry = { key, overlap: 0, gap: 0, pairs: [] };
    for (const ia of core) {
      for (const ib of core) {
        if (ia === ib || !bboxesTouch(shapeOf(ia).bbox, shapeOf(ib).bbox)) continue;
        const ck = `${ia}|${ib}`;
        if (!pairCache.has(ck)) pairCache.set(ck, compareShapes(shapeOf(ia), shapeOf(ib)));
        const { overlap, gap } = pairCache.get(ck);
        if (!overlap && !gap) continue;
        entry.overlap += overlap;
        entry.gap += gap;
        entry.pairs.push({ a: doc.features[ia].title, b: doc.features[ib].title, overlap, gap });
      }
    }
    report.push(entry);
  }
  return report;
}

function toBaseline(report) {
  const out = {};
  for (const { key, overlap, gap } of report) if (overlap || gap) out[key] = { overlap, gap };
  return out;
}

/** One snapshot per line, in index order, so baseline diffs stay readable. */
function formatBaseline(baseline) {
  const lines = Object.entries(baseline).map(([key, v]) => `  ${JSON.stringify(key)}: { "overlap": ${v.overlap}, "gap": ${v.gap} }`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

function writeBaseline(report, rootDir = ROOT) {
  fs.writeFileSync(path.join(rootDir, BASELINE_PATH), formatBaseline(toBaseline(report)));
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
      better.push(`${key}: snapshot no longer exists`);
      continue;
    }
    const was = baseline[key] || { overlap: 0, gap: 0 };
    const now = current[key] || { overlap: 0, gap: 0 };
    for (const metric of ['overlap', 'gap']) {
      if (now[metric] > was[metric]) worse.push(`${key}: ${metric} ${was[metric]} → ${now[metric]}`);
      else if (now[metric] < was[metric]) better.push(`${key}: ${metric} ${was[metric]} → ${now[metric]}`);
    }
  }
  return { worse, better };
}

const formatEntry = (e) => `${e.key}: overlap=${e.overlap} gap=${e.gap} (${e.pairs.length} pairs)`;

function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(fs.readFileSync(__filename, 'utf8').match(/Usage:\n([\s\S]*?)\n \*\//)[1].replace(/^ \* ?/gm, ''));
    return 0;
  }
  const report = auditTopology();
  const affected = report.filter((e) => e.overlap || e.gap);
  const totals = affected.reduce((t, e) => ({ overlap: t.overlap + e.overlap, gap: t.gap + e.gap }), { overlap: 0, gap: 0 });
  const summary = `${affected.length}/${report.length} snapshots, overlap=${totals.overlap} gap=${totals.gap}`;

  const detailsAt = args.indexOf('--details');
  if (detailsAt !== -1) {
    const entry = report.find((e) => e.key === args[detailsAt + 1]);
    if (!entry) throw new Error(`Unknown snapshot key: ${args[detailsAt + 1]}`);
    console.log(formatEntry(entry));
    for (const p of [...entry.pairs].sort((x, y) => y.overlap + y.gap - (x.overlap + x.gap))) {
      console.log(`  ${p.a} → ${p.b}: overlap=${p.overlap} gap=${p.gap}`);
    }
    return 0;
  }

  if (args.includes('--check') || args.includes('--update')) {
    const baseline = readBaseline();
    const { worse, better } = compareWithBaseline(report, baseline);
    if (args.includes('--update')) {
      const firstRun = !fs.existsSync(path.join(ROOT, BASELINE_PATH));
      if (worse.length && !firstRun && !args.includes('--allow-increase')) {
        for (const w of worse) console.error(`✗ ${w}`);
        console.error('Refusing to raise the baseline; fix the borders or pass --allow-increase.');
        return 1;
      }
      writeBaseline(report);
      console.log(`✓ Wrote ${BASELINE_PATH} (${summary})`);
      return 0;
    }
    for (const w of worse) console.error(`✗ worse: ${w}`);
    for (const b of better) console.error(`✗ better (baseline is stale): ${b}`);
    if (worse.length || better.length) {
      if (worse.length) console.error('Polity borders regressed; see `node scripts/audit_topology.js --details <key>`.');
      if (better.length) console.error('Run `node scripts/audit_topology.js --update` and commit the baseline.');
      return 1;
    }
    console.log(`✓ Topology matches ${BASELINE_PATH} (${summary})`);
    return 0;
  }

  console.log(`Core polity border mismatches: ${summary}\n\nWorst snapshots:`);
  for (const e of [...affected].sort((x, y) => y.overlap + y.gap - (x.overlap + x.gap)).slice(0, 15)) console.log(`  ${formatEntry(e)}`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { auditTopology, auditDoc, compareWithBaseline, toBaseline, readBaseline, writeBaseline, CORE_ROLES };
