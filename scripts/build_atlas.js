#!/usr/bin/env node
/**
 * Polygon Bundle Builder for Jiangshan Atlas (江山时序)
 * Zero external dependencies. Builds the VLQ delta-encoded polygon bundles js/atlas_snapshots.js
 * (full, lazy-loaded) and js/atlas_boot.js (first-paint seed) from the sources in data/atlas/.
 *
 * Source layout:
 *   data/atlas/index.json  { "boot": [snapshot keys], "order": [every snapshot key, in bundle order] }
 *   data/atlas/<group>/<snapshotKey>.geojson
 *     A GeoJSON FeatureCollection. Its "snapshot" member holds the snapshot fields; the
 *     polities / prefectures / regions lists name features by id. A bare id is a feature in the
 *     same file; "<snapshotKey>/<id>" is a feature defined in another snapshot file (ids never
 *     contain "/"). Each feature is
 *     stored once, so editing it changes every snapshot that references it. Coordinates are
 *     [longitude, latitude] with at most two decimals. The build closes every ring and drops
 *     repeated consecutive points. Directories are only for grouping. The build
 *     stamps a "license" member into every file; see data/atlas/README.md for data provenance.
 *
 * Encoding is canonical: features and rings are numbered in first-seen order while walking the
 * snapshots in index order, and identical rings are stored once.
 *
 * Usage:
 *   node scripts/build_atlas.js          # Normalize source formatting, rebuild both bundles, refresh index.html hashes
 *   node scripts/build_atlas.js --check  # Verify formatting and that both bundles are up to date (no writes)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = 'data/atlas';
const INDEX_PATH = `${DATA_DIR}/index.json`;
const FULL_PATH = 'js/atlas_snapshots.js';
const BOOT_PATH = 'js/atlas_boot.js';

const FEATURE_LISTS = new Set(['polities', 'prefectures', 'regions']);
// Stamped into every snapshot file so the terms travel with files copied out of the repo.
const LICENSE_NOTICE =
  'Approximate historical boundaries for illustration, not surveyed borders. When reusing, credit Jiangshan Atlas ' +
  '(https://github.com/DeanChensj/jiangshan-map) and the sources in data/atlas/README.md. Prefecture-level ' +
  '(郡/州/府) boundaries derive from CHGIS V6 and the Hartwell China Historical GIS: academic, non-commercial use ' +
  'only; do not redistribute; not licensed under GPL-3.0.';
const SCALE = 100;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-';

const DATA_START = '  const D = ';
const DATA_END = ';\n  const rc = new Array(D.r.length);';

function bundlePrefix(title) {
  return (
    '/**\n' +
    ` * ${title} (Lossless Topology-Deduplicated & Lazy VLQ-Decoded)\n` +
    ' */\n' +
    '(function () {\n' +
    "  'use strict';\n" +
    `  const A = '${ALPHABET}';\n` +
    '  const R = new Uint8Array(128);\n' +
    '  for (let i = 0; i < 64; i++) R[A.charCodeAt(i)] = i;\n' +
    DATA_START
  );
}

// Runtime decoder shipped in both bundles. `isBoot` keeps snapshots already installed by the
// full bundle and leaves the full-load sentinel unset.
function bundleSuffix(isBoot) {
  return (
    DATA_END + '\n' +
    '  function ring(idx) {\n' +
    '    let r = rc[idx];\n' +
    '    if (r) return r;\n' +
    '    const s = D.r[idx];\n' +
    '    r = [];\n' +
    '    let i = 0, n = s.length, x = 0, y = 0;\n' +
    '    while (i < n) {\n' +
    '      let b, sh = 0, v = 0;\n' +
    '      do { b = R[s.charCodeAt(i++)]; v |= (b & 31) << sh; sh += 5; } while (b >= 32);\n' +
    '      x += (v & 1) ? ~(v >>> 1) : (v >>> 1);\n' +
    '      sh = 0; v = 0;\n' +
    '      do { b = R[s.charCodeAt(i++)]; v |= (b & 31) << sh; sh += 5; } while (b >= 32);\n' +
    '      y += (v & 1) ? ~(v >>> 1) : (v >>> 1);\n' +
    '      r.push([x / 100, y / 100]);\n' +
    '    }\n' +
    '    return (rc[idx] = r);\n' +
    '  }\n' +
    '  const fc = new Array(D.f.length);\n' +
    '  function feat(idx) {\n' +
    '    let f = fc[idx];\n' +
    '    if (f) return f;\n' +
    '    const raw = D.f[idx];\n' +
    '    const sh = raw.shape;\n' +
    '    if (sh) {\n' +
    '      if (sh._p) {\n' +
    '        const ids = sh._p;\n' +
    "        raw.shape = { type: 'Polygon' };\n" +
    "        Object.defineProperty(raw.shape, 'coordinates', {\n" +
    '          enumerable: true,\n' +
    '          configurable: true,\n' +
    '          get() {\n' +
    '            const v = ids.map(ring);\n' +
    "            Object.defineProperty(this, 'coordinates', { value: v, writable: true, enumerable: true, configurable: true });\n" +
    '            return v;\n' +
    '          }\n' +
    '        });\n' +
    '      } else if (sh._m) {\n' +
    '        const ids = sh._m;\n' +
    "        raw.shape = { type: 'MultiPolygon' };\n" +
    "        Object.defineProperty(raw.shape, 'coordinates', {\n" +
    '          enumerable: true,\n' +
    '          configurable: true,\n' +
    '          get() {\n' +
    '            const v = ids.map((p) => p.map(ring));\n' +
    "            Object.defineProperty(this, 'coordinates', { value: v, writable: true, enumerable: true, configurable: true });\n" +
    '            return v;\n' +
    '          }\n' +
    '        });\n' +
    '      }\n' +
    '    }\n' +
    '    return (fc[idx] = raw);\n' +
    '  }\n' +
    (isBoot ? '  const out = window.ATLAS_SNAPSHOTS || {};\n' : '  const out = {};\n') +
    '  for (const [k, s] of Object.entries(D.d)) {\n' +
    (isBoot ? '    if (out[k]) continue;\n' : '') +
    '    if (Array.isArray(s)) {\n' +
    '      out[k] = s.map(feat);\n' +
    "    } else if (s && typeof s === 'object') {\n" +
    '      const sc = {};\n' +
    '      for (const [sk, sv] of Object.entries(s)) {\n' +
    "        sc[sk] = (sk === 'polities' || sk === 'prefectures' || sk === 'regions') && Array.isArray(sv) ? sv.map(feat) : sv;\n" +
    '      }\n' +
    '      out[k] = sc;\n' +
    '    }\n' +
    '  }\n' +
    '  window.ATLAS_SNAPSHOTS = out;\n' +
    (isBoot ? '' : '  window.ATLAS_FULL_SNAPSHOTS_LOADED = true;\n') +
    '})();\n'
  );
}

function encodeVarint(delta) {
  let v = delta < 0 ? (~delta << 1) | 1 : delta << 1;
  let out = '';
  while (v >= 32) {
    out += ALPHABET[(v & 31) | 32];
    v >>>= 5;
  }
  return out + ALPHABET[v];
}

function toFixedPoint(value, where) {
  const scaled = Math.round(value * SCALE);
  if (!Number.isFinite(value) || scaled / SCALE !== value) {
    throw new Error(`${where}: coordinate ${value} must be a finite number with at most two decimals`);
  }
  return scaled;
}

function encodeRing(ring, where) {
  let out = '';
  let px = 0;
  let py = 0;
  for (const pt of ring) {
    const x = toFixedPoint(pt[0], where);
    const y = toFixedPoint(pt[1], where);
    out += encodeVarint(x - px) + encodeVarint(y - py);
    px = x;
    py = y;
  }
  return out;
}

/** Encodes the given snapshot keys of a { features, snapshots } document into bundle source text. */
function encodeBundle(doc, { keys = Object.keys(doc.snapshots), isBoot = false } = {}) {
  const rings = [];
  const ringIds = new Map();
  const feats = [];
  const featIds = new Map();
  const featByDocIndex = new Map();

  const ringId = (ring, where) => {
    const str = encodeRing(ring, where);
    let id = ringIds.get(str);
    if (id === undefined) {
      id = rings.length;
      rings.push(str);
      ringIds.set(str, id);
    }
    return id;
  };

  const featureId = (docIndex, where) => {
    if (featByDocIndex.has(docIndex)) return featByDocIndex.get(docIndex);
    const feature = doc.features[docIndex];
    if (!feature) throw new Error(`${where}: unknown feature index ${docIndex}`);
    const label = `${where} → ${feature.title || `#${docIndex}`}`;
    const raw = {};
    for (const [key, value] of Object.entries(feature)) {
      if (key !== 'shape' || !value) {
        raw[key] = value;
      } else if (value.type === 'Polygon') {
        raw.shape = { _p: value.coordinates.map((r) => ringId(r, label)) };
      } else if (value.type === 'MultiPolygon') {
        raw.shape = { _m: value.coordinates.map((p) => p.map((r) => ringId(r, label))) };
      } else {
        throw new Error(`${label}: unsupported shape type ${value.type}`);
      }
    }
    const json = JSON.stringify(raw);
    let id = featIds.get(json);
    if (id === undefined) {
      id = feats.length;
      feats.push(raw);
      featIds.set(json, id);
    }
    featByDocIndex.set(docIndex, id);
    return id;
  };

  const d = {};
  for (const key of keys) {
    const snap = doc.snapshots[key];
    if (snap === undefined) throw new Error(`Unknown snapshot key: ${key}`);
    if (Array.isArray(snap)) {
      d[key] = snap.map((idx) => featureId(idx, key));
    } else {
      const out = {};
      for (const [sk, sv] of Object.entries(snap)) {
        out[sk] = FEATURE_LISTS.has(sk) && Array.isArray(sv) ? sv.map((idx) => featureId(idx, `${key}.${sk}`)) : sv;
      }
      d[key] = out;
    }
  }

  const title = isBoot ? 'Historical Atlas Boot Seed' : 'Historical Atlas Snapshots';
  return bundlePrefix(title) + JSON.stringify({ r: rings, f: feats, d }) + bundleSuffix(isBoot);
}

/** Canonical source formatting: two-space JSON with each [lng, lat] pair on its own line. */
function formatSource(value) {
  return JSON.stringify(value, null, 2).replace(/\[\s+(-?[\d.e+-]+),\s+(-?[\d.e+-]+)\s+\]/g, '[$1, $2]') + '\n';
}

/**
 * Normalizes a GeoJSON geometry in place: drops repeated consecutive points, closes every ring
 * (first point == last point) and drops rings that collapse to fewer than three distinct points
 * (a collapsed outer ring drops its whole MultiPolygon part). Returns an error message for
 * geometries it cannot normalize.
 */
function normalizeGeometry(geometry) {
  const multi = geometry.type === 'MultiPolygon';
  if (!multi && geometry.type !== 'Polygon') return `unsupported geometry type ${geometry.type}`;
  const polygons = multi ? geometry.coordinates : [geometry.coordinates];
  if (!Array.isArray(polygons)) return 'coordinates must be a list';
  const kept = [];
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length) return 'polygon must be a non-empty list of rings';
    const rings = [];
    for (const ring of polygon) {
      if (!Array.isArray(ring) || !ring.every((pt) => Array.isArray(pt) && pt.length === 2)) return 'ring must be a list of [lng, lat] pairs';
      const out = ring.filter((pt, j) => j === 0 || pt[0] !== ring[j - 1][0] || pt[1] !== ring[j - 1][1]);
      const first = out[0];
      const last = out[out.length - 1];
      if (out.length && (first[0] !== last[0] || first[1] !== last[1])) out.push([first[0], first[1]]);
      if (out.length >= 4) rings.push(out);
      else if (!rings.length) break; // collapsed outer ring: drop the part with its holes
    }
    if (rings.length) kept.push(rings);
  }
  if (!kept.length) return 'geometry has no ring with at least three distinct points';
  geometry.coordinates = multi ? kept : kept[0];
  return null;
}

function listSourceFiles(dir, rootDir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(rootDir, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listSourceFiles(rel, rootDir));
    else if (entry.name.endsWith('.geojson')) out.push(rel);
  }
  return out.sort();
}

/** Reads data/atlas into { index, files, doc }, where doc is the encoder's { features, snapshots } input. */
function loadSources(rootDir = ROOT) {
  const errors = [];
  const readJson = (rel) => {
    const text = fs.readFileSync(path.join(rootDir, rel), 'utf8');
    try {
      return { rel, text, json: JSON.parse(text) };
    } catch (err) {
      throw new Error(`${rel}: invalid JSON (${err.message})`);
    }
  };
  const indexFile = readJson(INDEX_PATH);
  const index = indexFile.json;
  const files = [indexFile];

  const byKey = new Map();
  for (const rel of listSourceFiles(DATA_DIR, rootDir)) {
    const key = path.basename(rel, '.geojson');
    if (byKey.has(key)) errors.push(`${rel}: snapshot "${key}" is also defined in ${byKey.get(key).rel}`);
    else byKey.set(key, readJson(rel));
  }
  const order = Array.isArray(index.order) ? index.order : [];
  const boot = Array.isArray(index.boot) ? index.boot : [];
  const seen = new Set();
  for (const key of order) {
    if (seen.has(key)) errors.push(`${INDEX_PATH}: "${key}" appears more than once in "order"`);
    seen.add(key);
    if (!byKey.has(key)) errors.push(`${INDEX_PATH}: no ${DATA_DIR}/**/${key}.geojson for "${key}"`);
  }
  for (const key of byKey.keys()) if (!seen.has(key)) errors.push(`${byKey.get(key).rel}: add "${key}" to "order" in ${INDEX_PATH}`);
  for (const key of boot) if (!seen.has(key)) errors.push(`${INDEX_PATH}: boot snapshot "${key}" is not in "order"`);
  if (errors.length) throw new Error(errors.join('\n'));

  // Pass 1: register every feature under "<snapshotKey>/<id>".
  const features = [];
  const featureFiles = [];
  const featureIndex = new Map();
  const referenced = new Set();
  for (const key of order) {
    const file = byKey.get(key);
    files.push(file);
    const { json, rel } = file;
    if (json.type !== 'FeatureCollection' || !Array.isArray(json.features) || json.snapshot === undefined) {
      errors.push(`${rel}: expected a FeatureCollection with "snapshot" and "features"`);
      continue;
    }
    json.features.forEach((f, i) => {
      const ref = `${key}/${f && f.id}`;
      if (!f || f.type !== 'Feature' || typeof f.id !== 'string' || !f.properties || typeof f.properties !== 'object') {
        errors.push(`${rel}: features[${i}] needs "type": "Feature", a string "id" and "properties"`);
      } else if (!f.id || f.id.includes('/')) {
        errors.push(`${rel}: feature id "${f.id}" must be non-empty and must not contain "/"`);
      } else if (featureIndex.has(ref)) {
        errors.push(`${rel}: duplicate feature id "${f.id}"`);
      } else {
        const problem = f.geometry ? normalizeGeometry(f.geometry) : null;
        if (problem) errors.push(`${rel}: feature "${f.id}": ${problem}`);
        featureIndex.set(ref, features.length);
        featureFiles.push(file);
        features.push(f.geometry ? { ...f.properties, shape: f.geometry } : { ...f.properties });
      }
    });
  }

  // Pass 2: resolve snapshot feature lists to indices.
  const resolve = (ref, key, rel) => {
    const qualified = typeof ref === 'string' && ref.includes('/') ? ref : `${key}/${ref}`;
    const idx = featureIndex.get(qualified);
    if (idx === undefined) {
      errors.push(`${rel}: unknown feature "${ref}"`);
      return -1;
    }
    referenced.add(qualified);
    return idx;
  };
  const snapshots = {};
  for (const key of order) {
    const { json, rel } = byKey.get(key);
    const snap = json.snapshot;
    if (Array.isArray(snap)) {
      snapshots[key] = snap.map((ref) => resolve(ref, key, rel));
    } else if (snap && typeof snap === 'object') {
      snapshots[key] = Object.fromEntries(
        Object.entries(snap).map(([k, v]) => [k, FEATURE_LISTS.has(k) && Array.isArray(v) ? v.map((ref) => resolve(ref, key, rel)) : v])
      );
    } else {
      errors.push(`${rel}: "snapshot" must be an object or a list of feature ids`);
    }
  }
  for (const ref of featureIndex.keys()) {
    if (!referenced.has(ref)) errors.push(`${byKey.get(ref.slice(0, ref.indexOf('/'))).rel}: feature "${ref.slice(ref.indexOf('/') + 1)}" is not referenced by any snapshot`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  // featureFiles[i] is the source file entry ({ rel, json }) that defines doc.features[i]; the
  // feature's shape is the same object as that file's geometry, so edits to it can be written back.
  return { index: { order, boot }, files, doc: { features, snapshots }, featureFiles };
}

/** Returns the expected contents of every generated or normalized file, keyed by repo-relative path. */
function buildOutputs(rootDir = ROOT) {
  const { index, files, doc } = loadSources(rootDir);
  const outputs = {};
  for (const { rel, json } of files) {
    const normalized = rel === INDEX_PATH ? json : (({ type, license, ...rest }) => ({ type, license: LICENSE_NOTICE, ...rest }))(json);
    outputs[rel] = formatSource(normalized);
  }
  outputs[FULL_PATH] = encodeBundle(doc, { keys: index.order });
  outputs[BOOT_PATH] = encodeBundle(doc, { keys: index.boot, isBoot: true });
  return outputs;
}

/** Returns a list of human-readable problems; empty when sources are formatted and bundles are up to date. */
function checkOutputs(rootDir = ROOT) {
  const problems = [];
  for (const [rel, want] of Object.entries(buildOutputs(rootDir))) {
    if (fs.readFileSync(path.join(rootDir, rel), 'utf8') !== want) {
      problems.push(rel.startsWith(DATA_DIR) ? `${rel} is not canonically formatted` : `${rel} is out of date with ${DATA_DIR}/`);
    }
  }
  return problems;
}

function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(
      'Usage: node scripts/build_atlas.js [--check]\n' +
        `  (default)  Normalize ${DATA_DIR}/ formatting, rebuild ${FULL_PATH} and ${BOOT_PATH}, refresh index.html hashes\n` +
        '  --check    Verify formatting and bundles without writing'
    );
    return 0;
  }
  if (args.includes('--check')) {
    const problems = checkOutputs();
    if (problems.length) {
      for (const p of problems) console.error(`✗ ${p}`);
      console.error('Run `node scripts/build_atlas.js` and commit the result.');
      return 1;
    }
    console.log(`✓ ${DATA_DIR}/ is formatted and ${FULL_PATH} / ${BOOT_PATH} are up to date`);
    return 0;
  }
  const { written, hashesChanged } = writeOutputs();
  console.log(`✓ ${written ? `${written} file(s) updated` : 'Bundles already up to date'}; index.html hashes ${hashesChanged ? 'updated' : 'unchanged'}`);
  return 0;
}

/** Writes every generated or normalized file that differs, then refreshes index.html hashes. */
function writeOutputs(rootDir = ROOT, log = console.log) {
  let written = 0;
  for (const [rel, text] of Object.entries(buildOutputs(rootDir))) {
    const full = path.join(rootDir, rel);
    if (fs.readFileSync(full, 'utf8') !== text) {
      fs.writeFileSync(full, text);
      log(`✓ Wrote ${rel}`);
      written++;
    }
  }
  const { syncIndexHtmlAssetHashes } = require('./sync_version');
  const { changed } = syncIndexHtmlAssetHashes(rootDir);
  return { written, hashesChanged: changed };
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  formatSource,
  loadSources,
  encodeBundle,
  buildOutputs,
  checkOutputs,
  writeOutputs,
};
