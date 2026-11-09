'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { CONTROLLER_SCRIPTS } = require('../sync_version');

const ROOT = path.resolve(__dirname, '..', '..');
const JS_DIR = path.join(ROOT, 'js');

// Frozen copy of _buildRegionBoundaryPath before #255 added edge bins and point
// caches. The equivalence check proves the optimized version draws the same
// paths and anchors. If you change the boundary rules on purpose, delete this
// function and that check rather than editing both.
function buildRegionBoundaryReference(snap) {
  if (!snap || snap._skipRegionBoundaryStroke || !Array.isArray(snap.regions) || !snap.regions.length) {
    return '';
  }
  if (snap._cachedRegionBoundaryPath !== undefined) {
    return snap._cachedRegionBoundaryPath;
  }

  const polRings = [];
  const polList = snap.polities || [];
  const polAreas = polList.map(() => 0);
  for (let pIdx = 0; pIdx < polList.length; pIdx++) {
    const pol = polList[pIdx];
    if (!pol || pol.role === 'neighbor' || !pol.shape) continue;
    const coords = pol.shape.coordinates;
    const polys = pol.shape.type === 'Polygon' ? [coords] : coords || [];
    for (const poly of polys) {
      const ring = poly && poly[0];
      if (!ring || ring.length < 3) continue;
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      let area2 = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const x = ring[i][0],
          y = ring[i][1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        area2 += ring[j][0] * y - x * ring[j][1];
      }
      polAreas[pIdx] += Math.abs(area2) * 0.5;
      polRings.push({ pIdx, minX, maxX, minY, maxY, ring });
    }
  }
  const allCommanderyRegions = snap.regions.every(
    (r) => r && r.title && (r.title.endsWith('郡') || r.title.includes('内史'))
  );
  const hasLargePolity = !allCommanderyRegions && polAreas.some((a) => a >= 35);
  const isMultiRegime = !allCommanderyRegions && polList.filter((p) => p && p.role !== 'neighbor').length >= 4;
  const findPolIdx = (x, y) => {
    for (let rIdx = 0; rIdx < polRings.length; rIdx++) {
      const b = polRings[rIdx];
      if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
      const ring = b.ring;
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0],
          yi = ring[i][1];
        const xj = ring[j][0],
          yj = ring[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      if (inside) return b.pIdx;
    }
    return -1;
  };
  const allowPolIdx = (pIdx) => {
    if (pIdx < 0) return false;
    const pol = polList[pIdx];
    if (!pol) return false;
    if (hasLargePolity && pol.role === 'rival' && polAreas[pIdx] < 35) return false;
    return true;
  };
  const nearPolityBorder = (x, y, margin) => {
    const m2 = margin * margin;
    for (let rIdx = 0; rIdx < polRings.length; rIdx++) {
      const b = polRings[rIdx];
      if (
        x < b.minX - margin ||
        x > b.maxX + margin ||
        y < b.minY - margin ||
        y > b.maxY + margin
      ) {
        continue;
      }
      const ring = b.ring;
      for (let i = 0; i < ring.length - 1; i++) {
        const x1 = ring[i][0],
          y1 = ring[i][1];
        const x2 = ring[i + 1][0],
          y2 = ring[i + 1][1];
        const dx = x2 - x1,
          dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        let t = len2 > 1e-12 ? ((x - x1) * dx + (y - y1) * dy) / len2 : 0;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const px = x1 + t * dx - x,
          py = y1 + t * dy - y;
        if (px * px + py * py < m2) return true;
      }
    }
    return false;
  };
  Object.defineProperty(snap, '_allowRegionAnchor', {
    value: (x, y) => !polRings.length || allowPolIdx(findPolIdx(x, y)),
    writable: true,
    enumerable: false,
    configurable: true,
  });
  const ptKey = (pt) => `${pt[0].toFixed(2)},${pt[1].toFixed(2)}`;
  const edgeKey = (p1, p2) => {
    const k1 = ptKey(p1);
    const k2 = ptKey(p2);
    return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
  };

  const allRings = [];
  const regEdgeCounts = new Map();
  for (const reg of snap.regions) {
    if (!reg || !reg.shape) continue;
    const coords = reg.shape.coordinates;
    const polys = reg.shape.type === 'Polygon' ? [coords] : coords || [];
    for (const poly of polys) {
      for (const ring of poly || []) {
        if (!ring || ring.length < 2) continue;
        allRings.push(ring);
        for (let i = 0; i < ring.length - 1; i++) {
          const ek = edgeKey(ring[i], ring[i + 1]);
          regEdgeCounts.set(ek, (regEdgeCounts.get(ek) || 0) + 1);
        }
      }
    }
  }

  const seenEdges = new Set();
  let d = '';
  for (const ring of allRings) {
    let penX = NaN;
    let penY = NaN;
    for (let i = 0; i < ring.length - 1; i++) {
      const p1 = ring[i];
      const p2 = ring[i + 1];
      const ek = edgeKey(p1, p2);
      if ((regEdgeCounts.get(ek) || 0) < 2 || seenEdges.has(ek)) {
        penX = NaN;
        penY = NaN;
        continue;
      }
      const mx = (p1[0] + p2[0]) * 0.5;
      const my = (p1[1] + p2[1]) * 0.5;
      const pIdxM = polRings.length ? findPolIdx(mx, my) : 0;
      const borderMargin = isMultiRegime ? 0.55 : 0.16;
      if (
        polRings.length &&
        (!allowPolIdx(pIdxM) ||
          findPolIdx(p1[0], p1[1]) !== pIdxM ||
          findPolIdx(p2[0], p2[1]) !== pIdxM ||
          (hasLargePolity &&
            (nearPolityBorder(mx, my, borderMargin) ||
              (isMultiRegime &&
                (nearPolityBorder(p1[0], p1[1], 0.38) || nearPolityBorder(p2[0], p2[1], 0.38))))))
      ) {
        penX = NaN;
        penY = NaN;
        continue;
      }
      seenEdges.add(ek);
      const [x1, y1] = this.projector.toScreen(p1[0], p1[1]);
      const [x2, y2] = this.projector.toScreen(p2[0], p2[1]);
      if (Math.hypot(x2 - x1, y2 - y1) < 0.05) continue;
      if (x1 !== penX || y1 !== penY) {
        d += `M${x1.toFixed(1)} ${y1.toFixed(1)}`;
      }
      d += `L${x2.toFixed(1)} ${y2.toFixed(1)}`;
      penX = x2;
      penY = y2;
    }
  }

  Object.defineProperty(snap, '_cachedRegionBoundaryPath', {
    value: d,
    writable: true,
    enumerable: false,
    configurable: true,
  });
  return d;
}

if (!isMainThread && workerData && workerData.kind === 'boundary_slice') {
  const wSandbox = {
    window: { addEventListener: () => {} },
    document: { addEventListener: () => {}, getElementById: () => null, querySelectorAll: () => [] },
    addEventListener: () => {},
    URLSearchParams,
  };
  wSandbox.window = wSandbox;
  vm.createContext(wSandbox);
  for (const file of [
    'china_geo_data.js',
    'atlas_snapshots.js',
    'map_data.js',
    ...CONTROLLER_SCRIPTS.map((p) => path.basename(p)),
  ]) {
    vm.runInContext(fs.readFileSync(path.join(JS_DIR, file), 'utf8'), wSandbox, { filename: file });
  }
  const CtrlClass = vm.runInContext('HistoricalAtlasController', wSandbox);
  const wCtrl = Object.create(CtrlClass.prototype);
  wCtrl.provinces = wSandbox.window.PROVINCE_OUTLINES || [];
  wCtrl.dynasties = wSandbox.window.DYNASTY_DATA;
  wCtrl.snapshots = wSandbox.window.ATLAS_SNAPSHOTS;
  wCtrl.projector = { toScreen: (lng, lat) => [(lng - 66) * 13.15, (55 - lat) * 17.07] };
  wCtrl._hydrateSnapshots();
  let snapshotsChecked = 0;
  let anchorsChecked = 0;
  for (const key of workerData.keys) {
    const snapshot = wCtrl.snapshots[key];
    if (!snapshot || Array.isArray(snapshot)) continue;
    const before = { ...snapshot };
    const after = { ...snapshot };
    const expected = buildRegionBoundaryReference.call(wCtrl, before);
    const actual = wCtrl._buildRegionBoundaryPath(after);
    assert.strictEqual(actual, expected, `Region boundary geometry changed: ${key}`);
    assert.strictEqual(wCtrl._buildRegionBoundaryPath(after), actual, `Boundary cache changed: ${key}`);
    assert.strictEqual(typeof after._allowRegionAnchor, typeof before._allowRegionAnchor);
    if (before._allowRegionAnchor) {
      const points = [];
      for (let lng = 66; lng <= 142; lng += 9.5) {
        for (let lat = 14; lat <= 55; lat += 6.8) points.push([lng, lat]);
      }
      for (const region of snapshot.regions || []) if (region.anchor) points.push(region.anchor);
      for (const point of points) {
        assert.strictEqual(
          after._allowRegionAnchor(...point),
          before._allowRegionAnchor(...point),
          `Region label-anchor classification changed: ${key}`
        );
        anchorsChecked++;
      }
    }
    snapshotsChecked++;
  }
  parentPort.postMessage({ snapshotsChecked, anchorsChecked });
  process.exit(0);
}

function startBoundarySweepPool(snapshots, fastMode) {
  if (fastMode) return null;
  const allSnapKeys = Object.keys(snapshots).filter((k) => !Array.isArray(snapshots[k]));
  const workerCount = Math.min(
    8,
    Math.max(2, (os.availableParallelism ? os.availableParallelism() : os.cpus().length) - 1)
  );
  const slices = Array.from({ length: workerCount }, () => []);
  allSnapKeys.forEach((k, idx) => slices[idx % workerCount].push(k));
  return Promise.all(
    slices
      .filter((s) => s.length > 0)
      .map(
        (keys) =>
          new Promise((resolve, reject) => {
            const w = new Worker(__filename, { workerData: { kind: 'boundary_slice', keys } });
            w.on('message', resolve);
            w.on('error', reject);
            w.on('exit', (code) => {
              if (code !== 0) reject(new Error(`Boundary worker exited with code ${code}`));
            });
          })
      )
  );
}

module.exports = {
  buildRegionBoundaryReference,
  startBoundarySweepPool,
};
