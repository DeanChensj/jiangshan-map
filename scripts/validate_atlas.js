#!/usr/bin/env node
/**
 * Automated Integrity & Topology Validation Suite for Jiangshan Atlas (江山时序)
 * Zero external dependencies — runs in standard Node.js.
 *
 * Modular test suites live in scripts/tests/:
 *   - core        (suite_core_data.js)       : Bundles, schemas, hydrography, topology, SEO & mixin isolation
 *   - api         (suite_api_search.js)      : window.atlasAPI, gazetteer, CLI, boundary equivalence & EN dict
 *   - trace       (suite_trace_genealogy.js) : Place genealogy (点地溯源), person chronicle (点人溯事) & landmarks
 *   - cartography (suite_cartography_ui.js)  : Dynastic border accuracy (Zizhi Tongjian / 24 Histories) & timeline UI
 *   - ui          (suite_search_runtime.js)  : Compositor, quick search ranking, i18n, WebMCP, terrain & perf guards
 */
'use strict';

const { createValidationContext } = require('./tests/harness');
const { startBoundarySweepPool } = require('./tests/boundary_worker');
const { runCoreDataSuite } = require('./tests/suite_core_data');
const { runApiSearchSuite } = require('./tests/suite_api_search');
const { runTraceGenealogySuite } = require('./tests/suite_trace_genealogy');
const { runCartographyUiSuite } = require('./tests/suite_cartography_ui');
const { runSearchRuntimeSuite } = require('./tests/suite_search_runtime');

const SUITES = [
  { key: 'core', fn: runCoreDataSuite },
  { key: 'api', fn: runApiSearchSuite },
  { key: 'trace', fn: runTraceGenealogySuite },
  { key: 'cartography', fn: runCartographyUiSuite },
  { key: 'ui', fn: runSearchRuntimeSuite },
];

const rawArgs = process.argv.slice(2);
const CLI_ARGS = new Set(rawArgs);
if (CLI_ARGS.has('--help') || CLI_ARGS.has('-h')) {
  console.log(
    'Usage: node scripts/validate_atlas.js [--fast | --full] [--suite=<core,api,trace,cartography,ui>]\n' +
      '  --fast, -f        Fast iteration check (~4s): syntax, asset hashes, schemas, i18n, search & UI CUJs\n' +
      '  --full            Full validation (default): includes all 20k+ polygon topology, overlap grids & CLI/MCP subprocesses\n' +
      '  --suite=<names>   Run only specific suite(s): core, api, trace, cartography, ui (comma-separated)'
  );
  process.exit(0);
}

const FAST_MODE = CLI_ARGS.has('--fast') || CLI_ARGS.has('-f');

function parseSelectedSuites(args) {
  let rawSuite = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--suite=')) {
      rawSuite = args[i].slice('--suite='.length);
    } else if (args[i] === '--suite' && args[i + 1]) {
      rawSuite = args[i + 1];
    }
  }
  if (!rawSuite) return SUITES;
  const requested = new Set(
    rawSuite
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  const matched = SUITES.filter((s) => requested.has(s.key));
  if (matched.length === 0) {
    throw new Error(
      `Unknown --suite="${rawSuite}". Valid suites: ${SUITES.map((s) => s.key).join(', ')}`
    );
  }
  return matched;
}

async function main() {
  const t0 = performance.now();
  const selectedSuites = parseSelectedSuites(rawArgs);
  const isAllSuites = selectedSuites.length === SUITES.length;
  const ctx = createValidationContext({ fastMode: FAST_MODE });

  if (!FAST_MODE && selectedSuites.some((s) => s.key === 'api')) {
    ctx.boundarySweepPromise = startBoundarySweepPool(ctx.snapshots, FAST_MODE);
  }

  for (const suite of selectedSuites) {
    await suite.fn(ctx);
  }

  const elapsed = (performance.now() - t0).toFixed(1);
  if (!isAllSuites) {
    console.log(
      `✓ Jiangshan Atlas suite [${selectedSuites.map((s) => s.key).join(', ')}] (${FAST_MODE ? 'fast' : 'full'}) passed in ${elapsed} ms`
    );
    return;
  }

  const { dynasties, snapKeys, provinces, loreData, stats } = ctx;
  console.log(`✓ Jiangshan Atlas validation (${FAST_MODE ? 'fast' : 'full'}) passed in ${elapsed} ms:`);
  console.log(
    `  - ${dynasties.length} dynasties, ${snapKeys.length} snapshots (${stats.referencedSnaps.size} phase-linked), ${stats.sweptYears} timeline years swept`
  );
  if (FAST_MODE) {
    console.log(
      '  - polygon topology & CLI/MCP subprocess sweeps skipped in --fast mode (run `node scripts/validate_atlas.js` before PR)'
    );
  } else {
    console.log(
      `  - ${stats.decodedPolygons} historical polygons (${stats.totalVertices.toLocaleString()} vertices) verified lossless & collision-free`
    );
  }
  console.log(`  - ${provinces.length} modern provinces (${stats.provRingCount} rings)`);
  console.log(`  - ${stats.totalSettlements} ancient settlements & ${stats.totalMilestones} historical milestones`);
  console.log(
    `  - ${loreData.HISTORICAL_JOURNEYS.length} journeys (${stats.totalJourneyStops} bilingual stops), ${loreData.CHINESE_ERA_SPANS.length} era spans, ${loreData.PLACE_LANDMARK_EVENTS.length} landmark events & ${loreData.PLACE_GAZETTEER.length} gazetteer landmarks verified across 40 E2E CUJs`
  );
  console.log(`  - ${(loreData.POLITY_PROFILES || []).length} curated regional/rival regime profiles verified`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
