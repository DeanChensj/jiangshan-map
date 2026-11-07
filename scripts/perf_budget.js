#!/usr/bin/env node
/**
 * First-Paint Synchronous Script Performance Budget for Jiangshan Atlas (江山时序)
 * Zero external dependencies. Parses index.html for synchronous <script src="..."> tags,
 * computes their gzip sizes (zlib level 9), and enforces a ratchet ceiling against
 * data/atlas/perf_baseline.json so large data payloads stay lazy-loaded.
 *
 * Usage:
 *   node scripts/perf_budget.js                            # Print synchronous & lazy bundle sizes
 *   node scripts/perf_budget.js --check                    # Fail if sync script gzip sum exceeds baseline (CI)
 *   node scripts/perf_budget.js --update                   # Ratchet down / refresh data/atlas/perf_baseline.json
 *   node scripts/perf_budget.js --update --allow-increase  # Intentionally raise the budget ceiling
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { LAZY_ATTR_ASSETS } = require('./sync_version');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = 'data/atlas/perf_baseline.json';
const HEADROOM_BYTES = 10 * 1024; // ~10 KB headroom for routine code/data edits before ratcheting

function extractSyncScriptPaths(indexHtml) {
  const paths = [];
  const tagRe = /<script\b([^>]*)><\/script>/gi;
  let m;
  while ((m = tagRe.exec(indexHtml)) !== null) {
    const attrs = m[1];
    if (/\b(?:async|defer)\b/i.test(attrs)) continue;
    const typeMatch = attrs.match(/\btype=["']([^"']+)["']/i);
    if (typeMatch && !/^(?:text\/javascript|application\/javascript)$/i.test(typeMatch[1])) {
      continue;
    }
    const srcMatch = attrs.match(/\bsrc=["']([^"'?]+)(?:\?[^"']*)?["']/i);
    if (srcMatch) {
      paths.push(srcMatch[1]);
    }
  }
  return paths;
}

function measureBundle(relPath, rootDir = ROOT) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing bundle referenced in index.html: ${relPath}`);
  }
  const buf = fs.readFileSync(fullPath);
  const gz = zlib.gzipSync(buf, { level: 9 });
  return {
    relPath,
    rawBytes: buf.length,
    gzipBytes: gz.length,
  };
}

function measurePerfBudget(rootDir = ROOT) {
  const indexHtmlPath = path.join(rootDir, 'index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const syncRelPaths = extractSyncScriptPaths(indexHtml);
  const syncScripts = syncRelPaths.map((rel) => measureBundle(rel, rootDir));
  const lazyScripts = LAZY_ATTR_ASSETS.map(({ relPath }) => measureBundle(relPath, rootDir));

  const syncScriptsRawBytes = syncScripts.reduce((sum, s) => sum + s.rawBytes, 0);
  const syncScriptsGzipBytes = syncScripts.reduce((sum, s) => sum + s.gzipBytes, 0);
  const lazyScriptsRawBytes = lazyScripts.reduce((sum, s) => sum + s.rawBytes, 0);
  const lazyScriptsGzipBytes = lazyScripts.reduce((sum, s) => sum + s.gzipBytes, 0);

  return {
    syncScripts,
    lazyScripts,
    syncScriptsRawBytes,
    syncScriptsGzipBytes,
    lazyScriptsRawBytes,
    lazyScriptsGzipBytes,
  };
}

function readBaseline(rootDir = ROOT) {
  const full = path.join(rootDir, BASELINE_PATH);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function writeBaseline(report, maxSyncScriptsGzipBytes, rootDir = ROOT) {
  const scripts = {};
  for (const s of report.syncScripts) {
    scripts[s.relPath] = s.gzipBytes;
  }
  const lazy = {};
  for (const s of report.lazyScripts) {
    lazy[s.relPath] = s.gzipBytes;
  }
  const payload = {
    maxSyncScriptsGzipBytes,
    syncScriptsGzipBytes: report.syncScriptsGzipBytes,
    scripts,
    lazy,
  };
  fs.writeFileSync(
    path.join(rootDir, BASELINE_PATH),
    JSON.stringify(payload, null, 2) + '\n',
    'utf8'
  );
  return payload;
}

function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(
      fs
        .readFileSync(__filename, 'utf8')
        .match(/Usage:\n([\s\S]*?)\n \*\//)[1]
        .replace(/^ \* ?/gm, '')
    );
    return 0;
  }

  const report = measurePerfBudget();
  const baseline = readBaseline();

  if (args.includes('--update')) {
    const proposedMax = report.syncScriptsGzipBytes + HEADROOM_BYTES;
    if (
      baseline &&
      typeof baseline.maxSyncScriptsGzipBytes === 'number' &&
      report.syncScriptsGzipBytes > baseline.maxSyncScriptsGzipBytes &&
      !args.includes('--allow-increase')
    ) {
      console.error(
        `✗ Sync script gzip total ${formatKb(report.syncScriptsGzipBytes)} (${report.syncScriptsGzipBytes} B) exceeds baseline ceiling ${formatKb(baseline.maxSyncScriptsGzipBytes)} (${baseline.maxSyncScriptsGzipBytes} B).`
      );
      console.error('Refusing to raise the budget; move data to a lazy bundle or pass --allow-increase.');
      return 1;
    }
    const nextMax =
      baseline &&
      typeof baseline.maxSyncScriptsGzipBytes === 'number' &&
      !args.includes('--allow-increase')
        ? Math.min(baseline.maxSyncScriptsGzipBytes, proposedMax)
        : proposedMax;
    writeBaseline(report, nextMax);
    console.log(
      `✓ Wrote ${BASELINE_PATH} (sync gzip=${formatKb(report.syncScriptsGzipBytes)} / ceiling=${formatKb(nextMax)}, lazy gzip=${formatKb(report.lazyScriptsGzipBytes)})`
    );
    return 0;
  }

  if (args.includes('--check')) {
    if (!baseline || typeof baseline.maxSyncScriptsGzipBytes !== 'number') {
      console.error(`✗ Missing or invalid ${BASELINE_PATH}; run \`node scripts/perf_budget.js --update\`.`);
      return 1;
    }
    const errors = [];
    if (report.syncScriptsGzipBytes > baseline.maxSyncScriptsGzipBytes) {
      errors.push(
        `Sync scripts gzip sum ${formatKb(report.syncScriptsGzipBytes)} (${report.syncScriptsGzipBytes} B) exceeds budget ceiling ${formatKb(baseline.maxSyncScriptsGzipBytes)} (${baseline.maxSyncScriptsGzipBytes} B)`
      );
    }
    if (baseline.scripts) {
      for (const s of report.syncScripts) {
        if (!(s.relPath in baseline.scripts)) {
          errors.push(
            `New synchronous script "${s.relPath}" (${formatKb(s.gzipBytes)} gzip) added to index.html without updating ${BASELINE_PATH}`
          );
        }
      }
    }
    if (errors.length) {
      for (const e of errors) console.error(`✗ ${e}`);
      return 1;
    }
    console.log(
      `✓ First-paint sync script gzip budget OK: ${formatKb(report.syncScriptsGzipBytes)} / ${formatKb(baseline.maxSyncScriptsGzipBytes)} (${report.syncScripts.length} sync scripts; ${formatKb(report.lazyScriptsGzipBytes)} deferred in ${report.lazyScripts.length} lazy bundles)`
    );
    return 0;
  }

  console.log('Synchronous first-paint scripts in index.html:');
  for (const s of report.syncScripts) {
    console.log(
      `  ${s.relPath.padEnd(24)} raw: ${formatKb(s.rawBytes).padStart(9)}   gzip: ${formatKb(s.gzipBytes).padStart(8)} (${s.gzipBytes} B)`
    );
  }
  console.log(
    `  ${'TOTAL SYNC'.padEnd(24)} raw: ${formatKb(report.syncScriptsRawBytes).padStart(9)}   gzip: ${formatKb(report.syncScriptsGzipBytes).padStart(8)} (${report.syncScriptsGzipBytes} B)`
  );
  if (baseline && typeof baseline.maxSyncScriptsGzipBytes === 'number') {
    console.log(
      `  ${'BUDGET CEILING'.padEnd(24)}                   gzip: ${formatKb(baseline.maxSyncScriptsGzipBytes).padStart(8)} (${baseline.maxSyncScriptsGzipBytes} B)`
    );
  }
  console.log('\nDeferred lazy-loaded bundles (#atlas-app-script data-v-*):');
  for (const s of report.lazyScripts) {
    console.log(
      `  ${s.relPath.padEnd(24)} raw: ${formatKb(s.rawBytes).padStart(9)}   gzip: ${formatKb(s.gzipBytes).padStart(8)} (${s.gzipBytes} B)`
    );
  }
  console.log(
    `  ${'TOTAL LAZY'.padEnd(24)} raw: ${formatKb(report.lazyScriptsRawBytes).padStart(9)}   gzip: ${formatKb(report.lazyScriptsGzipBytes).padStart(8)} (${report.lazyScriptsGzipBytes} B)`
  );
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

module.exports = {
  BASELINE_PATH,
  extractSyncScriptPaths,
  measureBundle,
  measurePerfBudget,
  readBaseline,
  writeBaseline,
};
