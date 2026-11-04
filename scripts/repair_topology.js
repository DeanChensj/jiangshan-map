#!/usr/bin/env node
/**
 * Polity Border Repair for Jiangshan Atlas (江山时序)
 * Zero external dependencies. Closes sliver gaps and shallow overlaps between core polities
 * (role main, rival or protectorate) in the given snapshots by rewriting data/atlas sources.
 *
 * Within a snapshot, polities are ranked main > rival > protectorate, then by area. Each polity
 * keeps the borders of the higher-ranked polities processed before it:
 *   1. Every vertex within the tolerance of a higher-ranked border moves onto it (onto the nearest
 *      vertex when one is close, otherwise onto the segment, rounded to 0.01°).
 *   2. Between two such vertices on the same border, the polity follows that border's vertices.
 *   3. A rounded point that lands on a segment is also inserted into that segment of every
 *      polity sharing it, and border vertices lying on the polity's segments are inserted into
 *      the polity, so both sides of a shared border end up with the same vertex chain.
 * Neighbor polities (role "neighbor") are never moved and never used as a reference.
 *
 * Features are shared across snapshots. After repairing a snapshot, every snapshot that uses a
 * changed feature is re-audited; a change that makes any of them worse is reverted and reported
 * as a shared-feature conflict. Overlaps deeper than the tolerance are left alone and listed.
 *
 * Usage:
 *   node scripts/repair_topology.js <snapshotKey|group>...          # Dry run: report what would change
 *   node scripts/repair_topology.js <snapshotKey|group>... --write  # Rewrite data/atlas, rebuild bundles, lower the baseline
 *   node scripts/repair_topology.js beisong --tolerance 0.02        # Snap distance in degrees (default 0.03, ~3 km)
 *
 * A group is a directory under data/atlas (e.g. "wudai").
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { loadSources, formatSource, writeOutputs } = require('./build_atlas');
const { auditDoc, readBaseline, writeBaseline, compareWithBaseline, CORE_ROLES } = require('./audit_topology');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TOLERANCE = 0.03;
const PRIORITY = { main: 0, rival: 1, protectorate: 2 };
const VERTEX_SNAP_DEG = 0.015; // prefer an existing border vertex this close to the projection
const MAX_CHAIN_VERTICES = 60;
const MAX_AREA_CHANGE = 0.03; // reject a polity whose area would change by more than 3%
const CELL_DEG = 0.25;

const round2 = (v) => Math.round(v * 100) / 100;
const samePoint = (a, b) => a[0] === b[0] && a[1] === b[1];
const pointKey = (p) => `${p[0]},${p[1]}`;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cellOf = (v) => Math.floor(v / CELL_DEG);

function nearestOnSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  const q = [a[0] + t * dx, a[1] + t * dy];
  return { t, q, d: distance(p, q) };
}

const polygonsOf = (coordinates, type) => (type === 'Polygon' ? [coordinates] : coordinates);
const openRing = (ring) => (ring.length > 1 && samePoint(ring[0], ring[ring.length - 1]) ? ring.slice(0, -1) : ring.slice());
const closeRing = (pts) => [...pts.map((p) => [p[0], p[1]]), [pts[0][0], pts[0][1]]];

function ringArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
  return Math.abs(a / 2);
}
const polygonArea = (rings) => rings.reduce((sum, r, i) => sum + (i === 0 ? 1 : -1) * ringArea(r), 0);

function bboxOf(pts) {
  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of pts) {
    if (x < bb[0]) bb[0] = x;
    if (y < bb[1]) bb[1] = y;
    if (x > bb[2]) bb[2] = x;
    if (y > bb[3]) bb[3] = y;
  }
  return bb;
}

/** Grid of reference segments ({ ref, i } = segment i of ref) for nearest-border queries. */
function segmentGrid(refs) {
  const grid = new Map();
  for (const ref of refs) {
    const n = ref.pts.length;
    for (let i = 0; i < n; i++) {
      const a = ref.pts[i];
      const b = ref.pts[(i + 1) % n];
      for (let cy = cellOf(Math.min(a[1], b[1])); cy <= cellOf(Math.max(a[1], b[1])); cy++) {
        for (let cx = cellOf(Math.min(a[0], b[0])); cx <= cellOf(Math.max(a[0], b[0])); cx++) {
          const k = `${cx},${cy}`;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push({ ref, i });
        }
      }
    }
  }
  return grid;
}

function nearestBorder(p, grid, tol) {
  let best = null;
  for (let cy = cellOf(p[1] - tol); cy <= cellOf(p[1] + tol); cy++) {
    for (let cx = cellOf(p[0] - tol); cx <= cellOf(p[0] + tol); cx++) {
      for (const { ref, i } of grid.get(`${cx},${cy}`) || []) {
        const s = nearestOnSegment(p, ref.pts[i], ref.pts[(i + 1) % ref.pts.length]);
        if (s.d <= tol && (!best || s.d < best.d)) best = { ...s, ref, i };
      }
    }
  }
  return best;
}

/** Reference vertices strictly between posA and posB (positions are segment index + t), walking the shorter way. */
function chainBetween(ref, posA, posB, maxLength) {
  const n = ref.pts.length;
  const fwd = (x, y) => (((y - x) % n) + n) % n;
  const walk = (forward) => {
    const span = forward ? fwd(posA, posB) : fwd(posB, posA);
    const out = [];
    for (let j = 1; j <= MAX_CHAIN_VERTICES + 1; j++) {
      const idx = forward ? (Math.floor(posA) + j) % n : (((Math.ceil(posA) - j) % n) + n) % n;
      if ((forward ? fwd(posA, idx) : fwd(idx, posA)) >= span) return out;
      out.push(ref.pts[idx]);
    }
    return null;
  };
  let best = null;
  for (const forward of [true, false]) {
    const pts = walk(forward);
    if (!pts || !pts.length) continue;
    let length = 0;
    let prev = null;
    for (const q of pts) {
      if (prev) length += distance(prev, q);
      prev = q;
    }
    if (length <= maxLength && (!best || length < best.length)) best = { pts, length };
  }
  return best ? best.pts : [];
}

/** Snaps one open ring onto the reference borders. Records segment insertions in `pending`. */
function snapRing(pts, grid, tol, pending) {
  const out = [];
  for (const p of pts) {
    const hit = nearestBorder(p, grid, tol);
    if (!hit) {
      out.push({ p });
      continue;
    }
    const { ref, i, t, q } = hit;
    const n = ref.pts.length;
    const a = ref.pts[i];
    const b = ref.pts[(i + 1) % n];
    let v;
    let pos;
    if (distance(q, a) <= VERTEX_SNAP_DEG && distance(q, a) <= distance(q, b)) [v, pos] = [a, i];
    else if (distance(q, b) <= VERTEX_SNAP_DEG) [v, pos] = [b, (i + 1) % n];
    else {
      v = [round2(q[0]), round2(q[1])];
      if (samePoint(v, a)) pos = i;
      else if (samePoint(v, b)) pos = (i + 1) % n;
      else {
        pos = i + t;
        if (!ref.frozen) addPending(pending, ref, i, t, v);
      }
    }
    out.push({ p: [v[0], v[1]], ref, pos });
  }
  const result = [];
  for (let k = 0; k < out.length; k++) {
    const cur = out[k];
    const next = out[(k + 1) % out.length];
    result.push(cur.p);
    if (cur.ref && cur.ref === next.ref) {
      const maxLength = 3 * distance(pts[k], pts[(k + 1) % pts.length]) + 2 * tol;
      for (const q of chainBetween(cur.ref, cur.pos, next.pos, maxLength)) result.push([q[0], q[1]]);
    }
  }
  return dedupe(result);
}

function addPending(pending, ref, i, t, q) {
  if (!pending.has(ref)) pending.set(ref, new Map());
  const segs = pending.get(ref);
  if (!segs.has(i)) segs.set(i, []);
  segs.get(i).push({ t, q });
}

/** Inserts pending points into their segments and into the same segment of every other reference ring. */
function applyPending(pending, refs) {
  const bySegment = new Map();
  for (const ref of refs) {
    const n = ref.pts.length;
    for (let i = 0; i < n; i++) {
      const k = `${pointKey(ref.pts[i])}|${pointKey(ref.pts[(i + 1) % n])}`;
      if (!bySegment.has(k)) bySegment.set(k, []);
      bySegment.get(k).push({ ref, i });
    }
  }
  for (const [ref, segs] of [...pending]) {
    for (const [i, items] of [...segs]) {
      const a = ref.pts[i];
      const b = ref.pts[(i + 1) % ref.pts.length];
      for (const other of bySegment.get(`${pointKey(b)}|${pointKey(a)}`) || []) {
        if (other.ref.frozen) continue;
        for (const { t, q } of items) addPending(pending, other.ref, other.i, 1 - t, q);
      }
      for (const other of bySegment.get(`${pointKey(a)}|${pointKey(b)}`) || []) {
        if (other.ref.frozen || (other.ref === ref && other.i === i)) continue;
        for (const { t, q } of items) addPending(pending, other.ref, other.i, t, q);
      }
    }
  }
  for (const [ref, segs] of pending) {
    const n = ref.pts.length;
    const next = [];
    for (let i = 0; i < n; i++) {
      next.push(ref.pts[i]);
      const items = segs.get(i);
      if (!items) continue;
      const a = ref.pts[i];
      const b = ref.pts[(i + 1) % n];
      const seen = new Set([pointKey(a), pointKey(b)]);
      for (const { q } of items.sort((x, y) => x.t - y.t)) {
        if (seen.has(pointKey(q))) continue;
        seen.add(pointKey(q));
        next.push(q);
      }
    }
    ref.pts = next;
    ref.bb = bboxOf(next);
  }
  pending.clear();
}

/** Inserts reference vertices lying within tol of a ring's segments, so shared chains coincide. */
function insertReferenceVertices(pts, refs, tol) {
  const grid = new Map();
  for (const ref of refs) {
    for (const q of ref.pts) {
      const k = `${cellOf(q[0])},${cellOf(q[1])}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(q);
    }
  }
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    out.push(a);
    const hits = new Map();
    for (let cy = cellOf(Math.min(a[1], b[1]) - tol); cy <= cellOf(Math.max(a[1], b[1]) + tol); cy++) {
      for (let cx = cellOf(Math.min(a[0], b[0]) - tol); cx <= cellOf(Math.max(a[0], b[0]) + tol); cx++) {
        for (const q of grid.get(`${cx},${cy}`) || []) {
          if (samePoint(q, a) || samePoint(q, b)) continue;
          const s = nearestOnSegment(q, a, b);
          if (s.d <= tol && s.t > 1e-9 && s.t < 1 - 1e-9) hits.set(pointKey(q), { t: s.t, q });
        }
      }
    }
    for (const { q } of [...hits.values()].sort((x, y) => x.t - y.t)) out.push([q[0], q[1]]);
  }
  return dedupe(out);
}

function dedupe(pts) {
  const out = pts.filter((p, i) => i === 0 || !samePoint(p, pts[i - 1]));
  while (out.length > 1 && samePoint(out[0], out[out.length - 1])) out.pop();
  return out;
}

/**
 * Repairs the core polities of one snapshot against each other. Features in `frozen` are used as
 * fixed references and never changed. Returns { changes: Map(featureIndex → coordinates),
 * rejected: [title] } without touching doc.
 */
function repairSnapshot(doc, key, tol, frozen = new Set()) {
  const snap = doc.snapshots[key];
  const polities = Array.isArray(snap) || !Array.isArray(snap.polities) ? [] : snap.polities;
  const core = [...new Set(polities)].filter((idx) => CORE_ROLES.has(doc.features[idx].role) && doc.features[idx].shape);
  const shapeArea = (idx) => polygonsOf(doc.features[idx].shape.coordinates, doc.features[idx].shape.type).reduce((s, rings) => s + polygonArea(rings), 0);
  const area = new Map(core.map((idx) => [idx, shapeArea(idx)]));
  core.sort(
    (x, y) =>
      frozen.has(y) - frozen.has(x) ||
      PRIORITY[doc.features[x].role] - PRIORITY[doc.features[y].role] ||
      area.get(y) - area.get(x)
  );

  const refs = [];
  const owned = new Map(); // featureIndex → polygons → rings as { owner, pts, bb, frozen }
  const rejected = [];
  for (const idx of core) {
    const { type, coordinates } = doc.features[idx].shape;
    const original = polygonsOf(coordinates, type).map((rings) => rings.map(openRing));
    let snapped = original;
    if (refs.length && !frozen.has(idx)) {
      const grid = segmentGrid(refs);
      const pending = new Map();
      snapped = original.map((rings) => rings.map((pts) => snapRing(pts, grid, tol, pending)));
      const newArea = snapped.reduce((s, rings) => s + polygonArea(rings), 0);
      const tooSmall = snapped.some((rings) => rings.some((pts) => pts.length < 3));
      if (tooSmall || Math.abs(newArea - area.get(idx)) > MAX_AREA_CHANGE * area.get(idx)) {
        rejected.push(doc.features[idx].title);
        snapped = original;
      } else {
        applyPending(pending, refs);
        snapped = snapped.map((rings) => rings.map((pts) => insertReferenceVertices(pts, refs, tol)));
      }
    }
    const polys = snapped.map((rings) => rings.map((pts) => ({ owner: idx, pts, bb: bboxOf(pts), frozen: frozen.has(idx) })));
    for (const rings of polys) refs.push(...rings);
    owned.set(idx, polys);
  }

  const changes = new Map();
  for (const [idx, polys] of owned) {
    if (frozen.has(idx)) continue;
    const { type, coordinates } = doc.features[idx].shape;
    const rebuilt = polys.map((rings) => rings.map((r) => closeRing(r.pts)));
    const next = type === 'Polygon' ? rebuilt[0] : rebuilt;
    if (JSON.stringify(next) !== JSON.stringify(coordinates)) changes.set(idx, next);
  }
  return { changes, rejected };
}

function resolveTargets(names, index, files) {
  const keys = new Set();
  for (const name of names) {
    if (index.order.includes(name)) {
      keys.add(name);
      continue;
    }
    const inGroup = files.filter((f) => f.rel.startsWith(`data/atlas/${name}/`)).map((f) => path.basename(f.rel, '.geojson'));
    if (!inGroup.length) throw new Error(`Unknown snapshot or group: ${name}`);
    inGroup.forEach((k) => keys.add(k));
  }
  return index.order.filter((k) => keys.has(k));
}

/** Repairs the targets in index order. Mutates doc geometries; returns per-snapshot results. */
function repairTargets(doc, order, targets, tol) {
  const usedBy = new Map(); // featureIndex → snapshot keys where it is a core polity
  for (const key of order) {
    const snap = doc.snapshots[key];
    if (Array.isArray(snap) || !Array.isArray(snap.polities)) continue;
    for (const idx of snap.polities) {
      if (!CORE_ROLES.has(doc.features[idx].role)) continue;
      if (!usedBy.has(idx)) usedBy.set(idx, new Set());
      usedBy.get(idx).add(key);
    }
  }
  const current = new Map(auditDoc(doc, order).map((e) => [e.key, e]));
  const initial = new Map(current);
  const results = [];
  const changed = new Set();
  for (const key of targets) {
    const before = current.get(key);
    const frozen = new Set();
    const conflicts = [];
    let outcome = { applied: new Set(), after: [], rejected: [] };
    for (;;) {
      const { changes, rejected } = repairSnapshot(doc, key, tol, frozen);
      const originals = new Map([...changes.keys()].map((idx) => [idx, doc.features[idx].shape.coordinates]));
      for (const [idx, coords] of changes) doc.features[idx].shape.coordinates = coords;
      const affected = new Set([key]);
      for (const idx of changes.keys()) for (const k of usedBy.get(idx)) affected.add(k);
      const after = auditDoc(doc, order.filter((k) => affected.has(k)));
      const worse = after.filter((e) => e.overlap > current.get(e.key).overlap || e.gap > current.get(e.key).gap);
      if (!worse.length) {
        const score = (e) => e.overlap + e.gap;
        const gain = after.reduce((s, e) => s + score(current.get(e.key)) - score(e), 0);
        if (gain > 0) outcome = { applied: new Set(changes.keys()), after, rejected };
        else for (const [idx, coords] of originals) doc.features[idx].shape.coordinates = coords; // no gain: avoid churn
        break;
      }
      // Undo, freeze the shared features that made another snapshot worse, and try again.
      for (const [idx, coords] of originals) doc.features[idx].shape.coordinates = coords;
      const blamed = new Set();
      for (const w of worse) {
        if (w.key === key) continue;
        const was = current.get(w.key);
        for (const idx of changes.keys()) {
          if (!usedBy.get(idx).has(w.key) || blamed.has(idx)) continue;
          blamed.add(idx);
          conflicts.push(`${doc.features[idx].title} (${w.key}: overlap ${was.overlap} → ${w.overlap}, gap ${was.gap} → ${w.gap})`);
        }
      }
      if (!blamed.size) break; // the repair would make this snapshot itself worse: leave it alone
      blamed.forEach((idx) => frozen.add(idx));
    }
    for (const e of outcome.after) current.set(e.key, e);
    outcome.applied.forEach((idx) => changed.add(idx));
    results.push({ key, before, after: current.get(key), changed: outcome.applied.size, conflicts, rejected: outcome.rejected });
  }
  return { results, changed, current, initial };
}

function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h') || !args.filter((a) => !a.startsWith('--')).length) {
    console.log(fs.readFileSync(__filename, 'utf8').match(/Usage:\n([\s\S]*?)\n \*\//)[1].replace(/^ \* ?/gm, ''));
    return args.includes('--help') || args.includes('-h') ? 0 : 1;
  }
  const tolAt = args.indexOf('--tolerance');
  const tol = tolAt === -1 ? DEFAULT_TOLERANCE : Number(args[tolAt + 1]);
  if (!(tol > 0 && tol < 0.2)) throw new Error('--tolerance must be between 0 and 0.2 degrees');
  const names = args.filter((a, i) => !a.startsWith('--') && !(tolAt !== -1 && i === tolAt + 1));

  const { index, files, doc, featureFiles } = loadSources(ROOT);
  const targets = resolveTargets(names, index, files);
  const { results, changed, current, initial } = repairTargets(doc, index.order, targets, tol);

  for (const r of results) {
    console.log(
      `${r.key}: overlap ${r.before.overlap} → ${r.after.overlap}, gap ${r.before.gap} → ${r.after.gap}` +
        (r.changed ? ` (${r.changed} polities changed)` : '')
    );
    for (const c of r.conflicts) console.log(`  kept shared: ${c}`);
    for (const t of r.rejected) console.log(`  skipped (area would change > ${MAX_AREA_CHANGE * 100}%): ${t}`);
    const residual = [...r.after.pairs].sort((x, y) => y.overlap + y.gap - (x.overlap + x.gap)).slice(0, 5);
    for (const p of residual) console.log(`  left for manual fix: ${p.a} → ${p.b} overlap=${p.overlap} gap=${p.gap}`);
  }
  const sum = (m) => [...m.values()].reduce((t, e) => ({ overlap: t.overlap + e.overlap, gap: t.gap + e.gap }), { overlap: 0, gap: 0 });
  const [was, now] = [sum(initial), sum(current)];
  console.log(
    `\n${targets.length} snapshots repaired, ${changed.size} features changed. ` +
      `All snapshots: overlap ${was.overlap} → ${now.overlap}, gap ${was.gap} → ${now.gap}`
  );

  if (!args.includes('--write')) {
    console.log('Dry run; pass --write to update data/atlas, the bundles and the baseline.');
    return 0;
  }
  const report = index.order.map((k) => current.get(k));
  const { worse } = compareWithBaseline(report, readBaseline(ROOT));
  if (worse.length) throw new Error(`Refusing to write: ${worse.join('; ')}`);
  const dirty = new Set([...changed].map((idx) => featureFiles[idx]));
  for (const file of dirty) fs.writeFileSync(path.join(ROOT, file.rel), formatSource(file.json));
  writeOutputs(ROOT, () => {});
  writeBaseline(report, ROOT);
  console.log(`✓ Rewrote ${dirty.size} source file(s), rebuilt bundles and lowered data/atlas/topology_baseline.json`);
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

module.exports = { repairSnapshot, repairTargets };
