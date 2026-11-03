#!/usr/bin/env node
/**
 * Snapshot Bundle Codec for Jiangshan Atlas (江山时序)
 * Zero external dependencies. Decodes and re-encodes the VLQ delta-encoded polygon bundles
 * js/atlas_snapshots.js (full, lazy-loaded) and js/atlas_boot.js (first-paint seed).
 *
 * Decoded format (JSON):
 *   {
 *     "features":  [ { "title": ..., "shape": { "type": "Polygon"|"MultiPolygon", "coordinates": [...] } }, ... ],
 *     "snapshots": { "<key>": { "caption": ..., "polities": [<featureIndex>, ...], ... } | [<featureIndex>, ...] }
 *   }
 * A feature referenced by several snapshots is stored once, so editing it changes every
 * snapshot that shares it. Coordinates are degrees with at most two decimals.
 *
 * Encoding is canonical: features and rings are numbered in first-seen order while walking
 * snapshots in key order, and identical rings are stored once. The boot seed is the BOOT_KEYS
 * subset of the full bundle.
 *
 * Usage:
 *   node scripts/build_atlas.js decode [--out FILE]  # Bundle -> JSON (default build/atlas/snapshots.json)
 *   node scripts/build_atlas.js encode [--in FILE]   # JSON -> both bundles, then refresh index.html hashes
 *   node scripts/build_atlas.js --check              # Verify committed bundles are canonical encodings
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FULL_PATH = 'js/atlas_snapshots.js';
const BOOT_PATH = 'js/atlas_boot.js';
const DEFAULT_JSON = 'build/atlas/snapshots.json';

// Snapshots needed for first paint; validate_atlas.js asserts they match the full bundle.
const BOOT_KEYS = ['neighbors', 's_zhanguo_a', 's_qin_a'];
const FEATURE_LISTS = new Set(['polities', 'prefectures', 'regions']);
const SCALE = 100;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-';
const LOOKUP = new Uint8Array(128);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

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

function decodeRing(str) {
  const ring = [];
  let i = 0;
  let x = 0;
  let y = 0;
  while (i < str.length) {
    let b;
    let sh = 0;
    let v = 0;
    do { b = LOOKUP[str.charCodeAt(i++)]; v |= (b & 31) << sh; sh += 5; } while (b >= 32);
    x += (v & 1) ? ~(v >>> 1) : (v >>> 1);
    sh = 0;
    v = 0;
    do { b = LOOKUP[str.charCodeAt(i++)]; v |= (b & 31) << sh; sh += 5; } while (b >= 32);
    y += (v & 1) ? ~(v >>> 1) : (v >>> 1);
    ring.push([x / SCALE, y / SCALE]);
  }
  return ring;
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

function extractData(source, label) {
  const start = source.indexOf(DATA_START);
  const end = source.indexOf(DATA_END, start);
  if (start < 0 || end < 0) throw new Error(`${label}: could not locate the encoded D block`);
  return JSON.parse(source.slice(start + DATA_START.length, end));
}

/** Decodes a bundle's source text into the { features, snapshots } JSON format. */
function decodeBundle(source, label = 'bundle') {
  const D = extractData(source, label);
  const features = D.f.map((raw) => {
    const feature = {};
    for (const [key, value] of Object.entries(raw)) {
      if (key !== 'shape' || !value) {
        feature[key] = value;
      } else if (value._p) {
        feature.shape = { type: 'Polygon', coordinates: value._p.map((r) => decodeRing(D.r[r])) };
      } else if (value._m) {
        feature.shape = { type: 'MultiPolygon', coordinates: value._m.map((p) => p.map((r) => decodeRing(D.r[r]))) };
      } else {
        throw new Error(`${label}: feature "${raw.title}" has an unrecognized shape encoding`);
      }
    }
    return feature;
  });
  return { features, snapshots: D.d };
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

function encodeAll(doc) {
  return {
    [FULL_PATH]: encodeBundle(doc),
    [BOOT_PATH]: encodeBundle(doc, { keys: BOOT_KEYS, isBoot: true }),
  };
}

function readText(relPath, rootDir = ROOT) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

function firstDifference(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

/** Returns a list of human-readable problems; empty when both bundles are canonical. */
function checkBundles(rootDir = ROOT) {
  const doc = decodeBundle(readText(FULL_PATH, rootDir), FULL_PATH);
  const expected = encodeAll(doc);
  const problems = [];
  for (const [relPath, want] of Object.entries(expected)) {
    const have = readText(relPath, rootDir);
    const at = firstDifference(have, want);
    if (at >= 0) {
      problems.push(
        `${relPath} is not the canonical encoding of ${FULL_PATH} (first difference at byte ${at}). ` +
          'Edit the decoded JSON and run `node scripts/build_atlas.js encode` instead of editing bundles by hand.'
      );
    }
  }
  return problems;
}

/** Pretty-prints the document with one feature per block and coordinates kept on one line. */
function formatDocument(doc) {
  const lines = ['{', '  "features": ['];
  doc.features.forEach((feature, i) => {
    const fields = Object.entries(feature).map(([key, value]) => {
      if (key === 'shape' && value) {
        return `      "shape": {\n        "type": ${JSON.stringify(value.type)},\n        "coordinates": ${JSON.stringify(value.coordinates)}\n      }`;
      }
      return `      ${JSON.stringify(key)}: ${JSON.stringify(value)}`;
    });
    lines.push(`    {\n${fields.join(',\n')}\n    }${i < doc.features.length - 1 ? ',' : ''}`);
  });
  lines.push('  ],', '  "snapshots": {');
  const keys = Object.keys(doc.snapshots);
  keys.forEach((key, i) => {
    lines.push(`    ${JSON.stringify(key)}: ${JSON.stringify(doc.snapshots[key])}${i < keys.length - 1 ? ',' : ''}`);
  });
  lines.push('  }', '}', '');
  return lines.join('\n');
}

function optionValue(args, flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

function main(argv) {
  const args = argv.slice(2);
  const command = args[0];
  if (!command || command === '--help' || command === '-h') {
    console.log(
      'Usage: node scripts/build_atlas.js <decode|encode|--check>\n' +
        `  decode [--out FILE]  Write ${FULL_PATH} as editable JSON (default ${DEFAULT_JSON})\n` +
        `  encode [--in FILE]   Rebuild ${FULL_PATH} and ${BOOT_PATH}, then refresh index.html hashes\n` +
        '  --check              Verify both bundles are canonical encodings without writing'
    );
    return 0;
  }
  if (command === '--check') {
    const problems = checkBundles();
    if (problems.length) {
      for (const p of problems) console.error(`✗ ${p}`);
      return 1;
    }
    console.log(`✓ ${FULL_PATH} and ${BOOT_PATH} are canonical encodings`);
    return 0;
  }
  if (command === 'decode') {
    const out = path.resolve(ROOT, optionValue(args, '--out', DEFAULT_JSON));
    const doc = decodeBundle(readText(FULL_PATH), FULL_PATH);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, formatDocument(doc));
    console.log(`✓ Decoded ${doc.features.length} features across ${Object.keys(doc.snapshots).length} snapshots → ${path.relative(ROOT, out)}`);
    return 0;
  }
  if (command === 'encode') {
    const input = path.resolve(ROOT, optionValue(args, '--in', DEFAULT_JSON));
    const doc = JSON.parse(fs.readFileSync(input, 'utf8'));
    for (const [relPath, text] of Object.entries(encodeAll(doc))) {
      fs.writeFileSync(path.join(ROOT, relPath), text);
      console.log(`✓ Wrote ${relPath} (${text.length} bytes)`);
    }
    const { syncIndexHtmlAssetHashes } = require('./sync_version');
    const { changed } = syncIndexHtmlAssetHashes(ROOT);
    console.log(`✓ ${changed ? 'Updated' : 'Already up-to-date:'} index.html asset hashes`);
    return 0;
  }
  console.error(`Unknown command: ${command} (see --help)`);
  return 2;
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}

module.exports = {
  BOOT_KEYS,
  decodeBundle,
  encodeBundle,
  encodeAll,
  checkBundles,
  formatDocument,
};
