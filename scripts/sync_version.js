#!/usr/bin/env node
/**
 * Deterministic Per-Asset Content Hash Synchronizer for Jiangshan Atlas (江山时序)
 * Zero external dependencies — computes 8-char SHA-256 digests for all CSS/JS bundles
 * and stamps/verifies index.html cache-busting query strings + lazy-bundle data attributes.
 *
 * Usage:
 *   node scripts/sync_version.js          # Update index.html in place
 *   node scripts/sync_version.js --check  # Verify index.html & js/app.js without writing
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const CONTROLLER_SCRIPTS = [
  'js/app.js',
  'js/atlas_quiz.js',
];

const STATIC_TAG_ASSETS = [
  'css/style.css',
  'js/china_geo_data.js',
  'js/atlas_boot.js',
  'js/map_data.js',
  'js/lore_data.js',
  'js/zh_hant.js',
  ...CONTROLLER_SCRIPTS,
];

const LAZY_ATTR_ASSETS = [
  { attr: 'data-v-snapshots', datasetKey: 'vSnapshots', relPath: 'js/atlas_snapshots.js' },
  { attr: 'data-v-i18n', datasetKey: 'vI18n', relPath: 'js/i18n_dict.js' },
];

function shortSha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
}

function computeAssetHashes(rootDir = ROOT) {
  const hashes = {};
  for (const relPath of STATIC_TAG_ASSETS) {
    const full = path.join(rootDir, relPath);
    assert(fs.existsSync(full), `Missing asset for version hashing: ${relPath}`);
    hashes[relPath] = shortSha256(full);
  }
  for (const { relPath } of LAZY_ATTR_ASSETS) {
    const full = path.join(rootDir, relPath);
    assert(fs.existsSync(full), `Missing lazy asset for version hashing: ${relPath}`);
    hashes[relPath] = shortSha256(full);
  }
  return hashes;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyHashesToIndexHtml(indexHtml, hashes) {
  let out = indexHtml;
  for (const relPath of STATIC_TAG_ASSETS) {
    const attrName = relPath.endsWith('.css') ? 'href' : 'src';
    const re = new RegExp(`(${attrName}="${escapeRegExp(relPath)}\\?v=)[0-9a-zA-Z_.-]+(")`, 'g');
    const matches = out.match(re);
    assert(
      matches && matches.length === 1,
      `Expected exactly 1 ${attrName}="${relPath}?v=..." reference in index.html, found ${matches ? matches.length : 0}`
    );
    out = out.replace(re, `$1${hashes[relPath]}$2`);
  }

  const appTagRe = /<script\b[^>]*\bsrc="js\/app\.js\?v=[0-9a-zA-Z_.-]+"[^>]*><\/script>/;
  const appTagMatch = out.match(appTagRe);
  assert(appTagMatch, 'Expected <script ... src="js/app.js?v=..."> tag in index.html');
  const expectedAppTag =
    `<script id="atlas-app-script" src="js/app.js?v=${hashes['js/app.js']}"` +
    ` data-v-snapshots="${hashes['js/atlas_snapshots.js']}"` +
    ` data-v-i18n="${hashes['js/i18n_dict.js']}"></script>`;
  out = out.replace(appTagRe, expectedAppTag);
  return out;
}

function verifyIndexHtmlAssetHashes(rootDir = ROOT, indexHtmlInput = null, appCodeInput = null) {
  const indexHtml =
    indexHtmlInput !== null ? indexHtmlInput : fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const controllerSrc =
    appCodeInput !== null
      ? appCodeInput
      : CONTROLLER_SCRIPTS.map((rel) => fs.readFileSync(path.join(rootDir, rel), 'utf8')).join('\n');

  const hardcodedAppVersions = controllerSrc.match(/\?v=[0-9a-zA-Z_.-]+/g) || [];
  assert.strictEqual(
    hardcodedAppVersions.length,
    0,
    `Controller scripts (${CONTROLLER_SCRIPTS.join(', ')}) must not hardcode ?v= query strings (${hardcodedAppVersions.join(', ')}); read hashes from #atlas-app-script data-v-* attributes instead`
  );

  const hashes = computeAssetHashes(rootDir);
  const mismatches = [];

  for (const relPath of STATIC_TAG_ASSETS) {
    const attrName = relPath.endsWith('.css') ? 'href' : 'src';
    const re = new RegExp(`${attrName}="${escapeRegExp(relPath)}\\?v=([0-9a-zA-Z_.-]+)"`);
    const m = indexHtml.match(re);
    if (!m) {
      mismatches.push(`missing ${attrName}="${relPath}?v=..." in index.html`);
    } else if (m[1] !== hashes[relPath]) {
      mismatches.push(`${relPath}: index.html has ?v=${m[1]}, expected ?v=${hashes[relPath]}`);
    }
  }

  const appTagMatch = indexHtml.match(/<script\b[^>]*\bid="atlas-app-script"[^>]*><\/script>/);
  if (!appTagMatch) {
    mismatches.push('missing id="atlas-app-script" on js/app.js <script> tag in index.html');
  } else {
    const appTag = appTagMatch[0];
    for (const { attr, relPath } of LAZY_ATTR_ASSETS) {
      const m = appTag.match(new RegExp(`\\b${escapeRegExp(attr)}="([0-9a-zA-Z_.-]+)"`));
      if (!m) {
        mismatches.push(`missing ${attr}="..." on #atlas-app-script in index.html`);
      } else if (m[1] !== hashes[relPath]) {
        mismatches.push(`${relPath} (${attr}): index.html has "${m[1]}", expected "${hashes[relPath]}"`);
      }
    }
  }

  let prevCtrlPos = -1;
  let prevCtrlRel = null;
  for (const relPath of CONTROLLER_SCRIPTS) {
    const pos = indexHtml.indexOf(`src="${relPath}?v=`);
    if (pos !== -1) {
      if (pos <= prevCtrlPos) {
        mismatches.push(
          `controller load-order violation in index.html: ${relPath} must appear after ${prevCtrlRel}`
        );
      }
      prevCtrlPos = pos;
      prevCtrlRel = relPath;
    }
  }

  assert.strictEqual(
    mismatches.length,
    0,
    `Stale or missing asset content hashes in index.html:\n  - ${mismatches.join('\n  - ')}\nFix: run "node scripts/sync_version.js"`
  );

  return hashes;
}

function syncIndexHtmlAssetHashes(rootDir = ROOT) {
  const indexPath = path.join(rootDir, 'index.html');
  const before = fs.readFileSync(indexPath, 'utf8');
  const hashes = computeAssetHashes(rootDir);
  const after = applyHashesToIndexHtml(before, hashes);
  const changed = after !== before;
  if (changed) {
    fs.writeFileSync(indexPath, after, 'utf8');
  }
  return { changed, hashes };
}

if (require.main === module) {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help') || args.has('-h')) {
    console.log(
      'Usage: node scripts/sync_version.js [--check]\n' +
        '  (default)  Compute SHA-256 short hashes for CSS/JS assets and update index.html\n' +
        '  --check    Verify index.html & js/app.js asset hashes without modifying files'
    );
    process.exit(0);
  }
  if (args.has('--check')) {
    const hashes = verifyIndexHtmlAssetHashes(ROOT);
    console.log(
      `✓ Asset content hashes verified across ${Object.keys(hashes).length} bundles in index.html & js/app.js`
    );
  } else {
    const { changed, hashes } = syncIndexHtmlAssetHashes(ROOT);
    verifyIndexHtmlAssetHashes(ROOT);
    console.log(
      `✓ ${changed ? 'Updated' : 'Already up-to-date:'} index.html per-asset content hashes:`
    );
    for (const [relPath, h] of Object.entries(hashes)) {
      console.log(`  - ${relPath.padEnd(24)} ?v=${h}`);
    }
  }
}

module.exports = {
  CONTROLLER_SCRIPTS,
  STATIC_TAG_ASSETS,
  LAZY_ATTR_ASSETS,
  computeAssetHashes,
  applyHashesToIndexHtml,
  verifyIndexHtmlAssetHashes,
  syncIndexHtmlAssetHashes,
};
