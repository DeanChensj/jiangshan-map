#!/usr/bin/env node
/**
 * Deterministic Per-Asset Content Hash Synchronizer for Jiangshan Atlas (江山时序)
 * Zero external dependencies — computes 8-char SHA-256 digests for all CSS/JS bundles
 * and stamps/verifies index.html cache-busting query strings + lazy-bundle data attributes.
 *
 * Usage:
 *   node scripts/sync_version.js                            # Update index.html in place & configure git merge driver
 *   node scripts/sync_version.js --check                    # Verify index.html & controller scripts without writing
 *   node scripts/sync_version.js --merge-driver %O %A %B    # Git custom merge driver for index.html ?v= conflicts
 */
'use strict';

const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const CONTROLLER_SCRIPTS = [
  'js/app.js',
  'js/atlas_trace.js',
  'js/atlas_search.js',
  'js/atlas_api.js',
  'js/atlas_quiz.js',
];

const SYNC_CONTROLLER_SCRIPTS = [
  'js/app.js',
  'js/atlas_trace.js',
  'js/atlas_search.js',
  'js/atlas_api.js',
];

const STATIC_TAG_ASSETS = [
  'css/style.css',
  'js/china_geo_data.js',
  'js/atlas_boot.js',
  'js/map_data.js',
  'js/lore_core.js',
  ...SYNC_CONTROLLER_SCRIPTS,
];

const LAZY_ATTR_ASSETS = [
  { attr: 'data-v-snapshots', datasetKey: 'vSnapshots', relPath: 'js/atlas_snapshots.js' },
  { attr: 'data-v-i18n', datasetKey: 'vI18n', relPath: 'js/i18n_dict.js' },
  { attr: 'data-v-lore', datasetKey: 'vLore', relPath: 'js/lore_detail.js' },
  { attr: 'data-v-pinyin', datasetKey: 'vPinyin', relPath: 'js/event_pinyin.js' },
  { attr: 'data-v-hant', datasetKey: 'vHant', relPath: 'js/zh_hant.js' },
  { attr: 'data-v-quiz', datasetKey: 'vQuiz', relPath: 'js/atlas_quiz.js' },
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
    LAZY_ATTR_ASSETS.map(({ attr, relPath }) => ` ${attr}="${hashes[relPath]}"`).join('') +
    '></script>';
  out = out.replace(appTagRe, expectedAppTag);
  return out;
}

function normalizeIndexHtmlHashes(indexHtml) {
  const zeroHashes = {};
  for (const relPath of STATIC_TAG_ASSETS) zeroHashes[relPath] = '00000000';
  for (const { relPath } of LAZY_ATTR_ASSETS) zeroHashes[relPath] = '00000000';
  return applyHashesToIndexHtml(indexHtml, zeroHashes);
}

function runIndexHtmlMergeDriver(ancestorPath, currentPath, otherPath, rootDir = ROOT) {
  for (const p of [ancestorPath, currentPath, otherPath]) {
    const raw = fs.readFileSync(p, 'utf8');
    fs.writeFileSync(p, normalizeIndexHtmlHashes(raw), 'utf8');
  }
  const mergeRes = spawnSync('git', ['merge-file', '-q', currentPath, ancestorPath, otherPath], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  const merged = fs.readFileSync(currentPath, 'utf8');
  const hashes = computeAssetHashes(rootDir);
  if (mergeRes.status === 0) {
    fs.writeFileSync(currentPath, applyHashesToIndexHtml(merged, hashes), 'utf8');
  }
  return mergeRes.status || 0;
}

function ensureGitMergeDriverConfig(rootDir = ROOT) {
  try {
    const driverCmd = 'node scripts/sync_version.js --merge-driver %O %A %B';
    const cur = execFileSync('git', ['config', '--get', 'merge.sync-version.driver'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (cur === driverCmd) return true;
  } catch (_) {}
  try {
    execFileSync(
      'git',
      ['config', 'merge.sync-version.name', 'Jiangshan index.html asset hash auto-merge driver'],
      { cwd: rootDir, stdio: 'ignore' }
    );
    execFileSync(
      'git',
      ['config', 'merge.sync-version.driver', 'node scripts/sync_version.js --merge-driver %O %A %B'],
      { cwd: rootDir, stdio: 'ignore' }
    );
    return true;
  } catch (_) {
    return false;
  }
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
  ensureGitMergeDriverConfig(rootDir);
  return { changed, hashes };
}

if (require.main === module) {
  const rawArgs = process.argv.slice(2);
  const args = new Set(rawArgs);
  if (args.has('--help') || args.has('-h')) {
    console.log(
      'Usage: node scripts/sync_version.js [--check | --merge-driver %O %A %B]\n' +
        '  (default)                   Compute SHA-256 short hashes for CSS/JS assets and update index.html\n' +
        '  --check                     Verify index.html & controller asset hashes without modifying files\n' +
        '  --merge-driver %O %A %B     Git merge driver to auto-resolve index.html ?v= hash conflicts'
    );
    process.exit(0);
  }
  const mdIdx = rawArgs.indexOf('--merge-driver');
  if (mdIdx !== -1) {
    const [anc, cur, oth] = rawArgs.slice(mdIdx + 1, mdIdx + 4);
    assert(anc && cur && oth, 'Expected 3 file paths (%O %A %B) after --merge-driver');
    process.exit(runIndexHtmlMergeDriver(anc, cur, oth, ROOT));
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
  normalizeIndexHtmlHashes,
  runIndexHtmlMergeDriver,
  verifyIndexHtmlAssetHashes,
  syncIndexHtmlAssetHashes,
};
