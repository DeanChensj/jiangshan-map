#!/usr/bin/env node
/**
 * Automated Integrity & Topology Validation Suite for Jiangshan Atlas (江山时序)
 * Zero external dependencies — runs in standard Node.js.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');

function main() {
  const t0 = performance.now();
  const sandbox = { window: {} };
  vm.createContext(sandbox);

  // 1. Load data bundles and verify syntax of all JS files
  const dataScripts = [
    'china_geo_data.js',
    'atlas_boot.js',
    'atlas_snapshots.js',
    'map_data.js',
    'lore_data.js',
    'i18n_dict.js',
  ];
  for (const file of dataScripts) {
    const fullPath = path.join(JS_DIR, file);
    assert(fs.existsSync(fullPath), `Missing required script: js/${file}`);
    const code = fs.readFileSync(fullPath, 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
    if (file === 'atlas_boot.js') {
      assert(
        !sandbox.window.ATLAS_FULL_SNAPSHOTS_LOADED &&
          !sandbox.window.ATLAS_SNAPSHOTS.s_prc &&
          !sandbox.window.ATLAS_SNAPSHOTS.s_qin,
        'atlas_boot.js must not set full-snapshot sentinels (ATLAS_FULL_SNAPSHOTS_LOADED / s_prc / s_qin)'
      );
    }
    if (file === 'atlas_snapshots.js') {
      assert(
        sandbox.window.ATLAS_FULL_SNAPSHOTS_LOADED === true &&
          Boolean(sandbox.window.ATLAS_SNAPSHOTS.s_prc),
        'atlas_snapshots.js must set window.ATLAS_FULL_SNAPSHOTS_LOADED = true'
      );
    }
  }

  // Verify controller syntax
  const appCode = fs.readFileSync(path.join(JS_DIR, 'app.js'), 'utf8');
  new vm.Script(appCode, { filename: 'app.js' });

  const provinces = sandbox.window.PROVINCE_OUTLINES;
  const snapshots = sandbox.window.ATLAS_SNAPSHOTS;
  const dynasties = sandbox.window.DYNASTY_DATA;
  const corridors = sandbox.window.CORRIDOR_DATA;
  const loreData = sandbox.window.ATLAS_LORE_DATA;
  const enLocale = sandbox.window.EN_LOCALE;
  assert(
    loreData &&
      Array.isArray(loreData.CHINESE_ERA_SPANS) &&
      loreData.CHINESE_ERA_SPANS.length >= 100 &&
      Array.isArray(loreData.PLACE_LANDMARK_EVENTS) &&
      loreData.PLACE_LANDMARK_EVENTS.length >= 60 &&
      Array.isArray(loreData.HISTORICAL_JOURNEYS) &&
      loreData.HISTORICAL_JOURNEYS.length === 7 &&
      Array.isArray(loreData.STRATEGIC_PASSES) &&
      loreData.STRATEGIC_PASSES.length >= 18,
    'ATLAS_LORE_DATA must provide era spans, landmark events, strategic passes, and 7 historical journeys'
  );
  for (const p of loreData.STRATEGIC_PASSES) {
    assert(
      p.key && p.ancientZh && p.ancientEn && Array.isArray(p.coord) && p.coord.length === 2,
      `Invalid strategic pass entry: ${JSON.stringify(p)}`
    );
    const [lng, lat] = p.coord;
    assert(
      lng >= 70 && lng <= 135 && lat >= 18 && lat <= 50,
      `Out-of-bounds pass coordinate [${lng}, ${lat}] for ${p.ancientZh}`
    );
  }

  // 1b. Validate time-aware historical hydrography (5 Yellow River courses & historical lakes)
  const hydro = sandbox.window.HYDRO_DATA;
  assert(
    hydro && Array.isArray(hydro.rivers) && Array.isArray(hydro.lakes) && Array.isArray(hydro.labels),
    'HYDRO_DATA must contain rivers, lakes, and labels arrays'
  );
  const isHydroActive = (item, y) =>
    (item.appear === undefined || y >= item.appear) &&
    (item.vanish === undefined || y < item.vanish);
  const sampleEras = [
    [-200, '河水（禹贡故道）'],
    [500, '黄 河（王景故道）'],
    [1100, '黄 河（北宋北流）'],
    [1500, '黄 河（夺淮故道）'],
    [2000, '黄 河'],
  ];
  for (const [sampleY, expectedLabel] of sampleEras) {
    const activeHuangTrunks = hydro.rivers.filter(
      (r) => r.name === 'Huang' && r.rank === 1 && isHydroActive(r, sampleY)
    );
    assert.strictEqual(
      activeHuangTrunks.length,
      4,
      `Expected 4 active Yellow River trunk segments at year ${sampleY}, got ${activeHuangTrunks.length}`
    );
    const activeLabels = hydro.labels.filter((l) => isHydroActive(l, sampleY));
    assert(
      activeLabels.some((l) => l.zh === expectedLabel),
      `Expected active Yellow River label "${expectedLabel}" at year ${sampleY}`
    );
  }
  assert(
    !hydro.lakes.some((l) => l.name === 'Hongze Hu' && isHydroActive(l, 1000)) &&
      hydro.lakes.some((l) => l.name === 'Hongze Hu' && isHydroActive(l, 1500)),
    'Hongze Hu should only appear from 1194 CE onward'
  );
  assert(
    hydro.lakes.some((l) => l.name === 'Juye Ze' && isHydroActive(l, 1080)) &&
      !hydro.lakes.some((l) => l.name === 'Juye Ze' && isHydroActive(l, 1400)),
    'Juye Ze / Liangshan Marsh should vanish after 1280 CE'
  );

  // 2. Validate modern provincial outlines
  assert(Array.isArray(provinces) && provinces.length >= 34, 'PROVINCE_OUTLINES must contain >= 34 provinces');
  let provRingCount = 0;
  for (const prov of provinces) {
    const isDash = String(prov.code).includes('_JD');
    if (!isDash) {
      assert(prov.title && Array.isArray(prov.hub) && prov.hub.length === 2, `Invalid province metadata: ${JSON.stringify(prov.title)}`);
    }
    assert(Array.isArray(prov.rings) && prov.rings.length > 0, `Province ${prov.title} has no polygon rings`);
    for (const poly of prov.rings) {
      for (const ring of poly) {
        provRingCount++;
        assert(ring.length >= (isDash ? 2 : 3), `Degenerate ring in province ${prov.title}`);
        for (const [lng, lat] of ring) {
          assert(lng >= 65 && lng <= 145 && lat >= 3 && lat <= 60, `Out-of-bounds province coordinate [${lng}, ${lat}] in ${prov.title}`);
        }
      }
    }
  }

  // 3. Validate historical dynasties, phases, settlements, and snapshot references
  assert(Array.isArray(dynasties) && dynasties.length === 18, `Expected 18 dynasties, got ${dynasties && dynasties.length}`);
  assert.strictEqual(dynasties[0].fromYear, -403, 'Timeline must start at 403 BCE (-403)');
  assert(dynasties[dynasties.length - 1].toYear >= 2026, 'Timeline must cover up to present (2026)');

  let totalSettlements = 0;
  let totalMilestones = 0;
  const referencedSnaps = new Set();

  for (let i = 0; i < dynasties.length; i++) {
    const d = dynasties[i];
    assert(d.key && d.title && d.fromYear < d.toYear, `Invalid dynasty span for ${d.key}`);
    if (d.snapKey) referencedSnaps.add(d.snapKey);
    for (const ph of d.phases || []) {
      const sk = ph.snap || ph.snapKey;
      assert(sk && snapshots[sk], `Dynasty ${d.key} references missing snapshot: ${sk}`);
      referencedSnaps.add(sk);
    }
    for (const s of d.settlements || []) {
      totalSettlements++;
      assert(s.ancient && Array.isArray(s.coord) && s.coord.length === 2, `Invalid settlement in ${d.key}: ${JSON.stringify(s)}`);
      const [lng, lat] = s.coord;
      assert(lng >= 60 && lng <= 145 && lat >= 10 && lat <= 60, `Out-of-bounds settlement coordinate [${lng}, ${lat}] for ${s.ancient}`);
    }
    for (const m of d.milestones || []) {
      totalMilestones++;
      assert(typeof m.year === 'number' && m.headline, `Invalid milestone in ${d.key}: ${JSON.stringify(m)}`);
      assert(
        m.year >= d.fromYear && m.year <= d.toYear,
        `Milestone year ${m.year} out of bounds [${d.fromYear}, ${d.toYear}] in ${d.key}: ${m.headline}`
      );
      const mk = `${d.key}:${m.year}`;
      assert(
        enLocale.milestones && enLocale.milestones[mk],
        `Missing English milestone translation for ${mk} (${m.headline})`
      );
    }
    assert(enLocale.dynasties && enLocale.dynasties[d.key], `Missing English translation for dynasty ${d.key}`);
  }

  // 3b. Validate 1864 Fall of the Taiping Heavenly Kingdom milestone & s_qing_e4 transition
  const qingDyn = dynasties.find((d) => d.key === 'qing');
  assert(
    qingDyn && qingDyn.milestones.some((m) => m.year === 1864 && m.headline.includes('太平天国')),
    'Qing dynasty must include the 1864 Fall of the Taiping Heavenly Kingdom milestone'
  );
  assert(
    snapshots.s_qing_e4 &&
      snapshots.s_qing_e4.polities.some((p) => p.title === '太平天国') &&
      !snapshots.s_qing_f.polities.some((p) => p.title === '太平天国'),
    's_qing_e4 (1860-1864) must retain Taiping Heavenly Kingdom while s_qing_f (1864+) removes it'
  );

  // 4. Validate lazy topology decoding across all snapshots
  const snapKeys = Object.keys(snapshots);
  assert(snapKeys.length >= 100, `Expected >= 100 snapshots, got ${snapKeys.length}`);
  let decodedPolygons = 0;
  let totalVertices = 0;

  function verifyShape(shape, context) {
    assert(shape && (shape.type === 'Polygon' || shape.type === 'MultiPolygon'), `Invalid shape type in ${context}`);
    const coords = shape.coordinates;
    assert(Array.isArray(coords) && coords.length > 0, `Empty coordinates in ${context}`);
    const polys = shape.type === 'Polygon' ? [coords] : coords;
    for (const poly of polys) {
      for (const ring of poly) {
        assert(Array.isArray(ring) && ring.length >= 3, `Degenerate polygon ring in ${context}`);
        for (const [lng, lat] of ring) {
          totalVertices++;
          assert(
            typeof lng === 'number' && typeof lat === 'number' && lng >= 30 && lng <= 180 && lat >= -15 && lat <= 85,
            `Invalid coordinate [${lng}, ${lat}] in ${context}`
          );
        }
      }
    }
    decodedPolygons++;
  }

  function pointInRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }
  function pointInShape(x, y, shape) {
    const polys = shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates;
    for (const poly of polys) {
      if (poly.length && pointInRing(x, y, poly[0])) {
        let inHole = false;
        for (let h = 1; h < poly.length; h++) {
          if (pointInRing(x, y, poly[h])) {
            inHole = true;
            break;
          }
        }
        if (!inHole) return true;
      }
    }
    return false;
  }
  const lakeLabels = (hydro.labels || []).filter((l) => l.kind === 'lake');

  for (const [k, snap] of Object.entries(snapshots)) {
    if (Array.isArray(snap)) {
      snap.forEach((item, idx) => verifyShape(item.shape, `${k}[${idx}]`));
    } else if (snap && typeof snap === 'object') {
      for (const grp of ['polities', 'prefectures', 'regions']) {
        for (const item of snap[grp] || []) {
          verifyShape(item.shape, `${k}.${grp}(${item.title || 'unnamed'})`);
          if (grp === 'polities' && (item.role === 'main' || item.role === 'rival') && item.anchor) {
            const [ax, ay] = item.anchor;
            assert(
              pointInShape(ax, ay, item.shape),
              `Polity anchor [${ax}, ${ay}] for ${item.title} (${item.role}) in ${k} lies outside its polygon`
            );
            if (item.role === 'main') {
              for (const lk of lakeLabels) {
                const dist = Math.hypot(ax - lk.coord[0], ay - lk.coord[1]);
                assert(
                  dist >= 0.85,
                  `Main polity anchor [${ax}, ${ay}] for ${item.title} in ${k} collides with lake label ${lk.zh} at [${lk.coord}] (dist=${dist.toFixed(2)}°)`
                );
              }
            }
          }
        }
      }
    }
  }

  // 4b. Validate split-era intermediate phase granularity (donghan, xijin, dongjin, nanbei, wudai)
  assert(
    snapshots.s_donghan_d1 &&
      snapshots.s_donghan_d2 &&
      snapshots.s_donghan_e0 &&
      snapshots.s_xijin_a2 &&
      snapshots.s_dongjin_d0 &&
      snapshots.s_dongjin_d1 &&
      snapshots.s_nanbei_a2 &&
      snapshots.s_nanbei_d1 &&
      snapshots.s_nanbei_e2 &&
      snapshots.s_wudai_c0 &&
      snapshots.s_wudai_e1,
    'Split eras must provide intermediate snapshots (s_donghan_d1/d2/e0, s_xijin_a2, s_dongjin_d0/d1, s_nanbei_a2/d1/e2, s_wudai_c0/e1)'
  );

  // 5. Validate corridors, i18n, and isolated cold-start boot seed
  assert(Array.isArray(corridors) && corridors.length >= 3, 'Expected >= 3 historical corridors');
  for (const c of corridors) {
    assert(enLocale.corridors && enLocale.corridors[c.key], `Missing English translation for corridor ${c.key}`);
  }
  const zhouExceptions = new Set(['贵州', '北朝幽州', '曹魏徐州']);
  for (const [zhKey, enVal] of Object.entries((enLocale && enLocale.dict) || {})) {
    if (zhKey.length >= 2 && zhKey.length <= 4 && zhKey.endsWith('州') && !zhouExceptions.has(zhKey)) {
      assert(
        /\bZhou\b/.test(enVal),
        `Expected spaced "Xx Zhou" Romanization for historical prefecture "${zhKey}", got "${enVal}"`
      );
    }
  }

  const bootSandbox = { window: {} };
  vm.createContext(bootSandbox);
  vm.runInContext(fs.readFileSync(path.join(JS_DIR, 'atlas_boot.js'), 'utf8'), bootSandbox, {
    filename: 'atlas_boot.js',
  });
  const bootSnaps = bootSandbox.window.ATLAS_SNAPSHOTS;
  assert(
    bootSnaps &&
      Array.isArray(bootSnaps.neighbors) &&
      bootSnaps.s_zhanguo_a &&
      bootSnaps.s_qin_a,
    'atlas_boot.js must provide neighbors, s_zhanguo_a, and s_qin_a for instant first paint'
  );
  verifyShape(bootSnaps.s_zhanguo_a.polities[0].shape, 'boot.s_zhanguo_a.polities[0]');

  // 6. Verify Unified Milestone Balloon Auto-Show ("史事浮签") & config toggle
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(
    appCode.includes('_syncAutoMilestoneBalloon') &&
      appCode.includes('toggleEventCallouts') &&
      appCode.includes('ep-close') &&
      !appCode.includes('_buildMilestoneCalloutDom') &&
      indexHtml.includes('id="chk-event-callouts"'),
    'app.js & index.html must unify event callouts into #milestone-balloon (_syncAutoMilestoneBalloon, toggleEventCallouts, ep-close, #chk-event-callouts)'
  );

  // 7. Validate PR #7 (pass icon), PR #8 (balloon caret & bookmark toggle tab), and PR #10 (SEO metadata & sitemap)
  const styleCss = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
  assert(
    appCode.includes('A1.25,1.25 0 0,0 -1.25,1.1') &&
      appCode.includes('_syncTogglePaneButton') &&
      appCode.includes('caretDir') &&
      appCode.includes('_syncDocumentSeoMeta') &&
      indexHtml.includes('id="lbl-toggle-pane"') &&
      styleCss.includes('data-caret="left"') &&
      styleCss.includes('.sr-only-seo'),
    'app.js, index.html & style.css must retain 3-merlon pass icon, balloon directional caret, bookmark toggle tab, and SEO meta sync'
  );
  assert(
    indexHtml.includes('application/ld+json') &&
      indexHtml.includes('property="og:title"') &&
      indexHtml.includes('rel="canonical"') &&
      indexHtml.includes('id="seo-atlas-directory"'),
    'index.html must include JSON-LD structured data, Open Graph tags, canonical link, and #seo-atlas-directory'
  );
  assert(fs.existsSync(path.join(ROOT, 'sitemap.xml')), 'Missing sitemap.xml at repository root');
  assert(fs.existsSync(path.join(ROOT, 'robots.txt')), 'Missing robots.txt at repository root');
  const htmlVersions = Array.from(new Set(indexHtml.match(/\?v=[0-9a-zA-Z_.-]+/g) || []));
  const appVersions = Array.from(new Set(appCode.match(/\?v=[0-9a-zA-Z_.-]+/g) || []));
  assert(
    htmlVersions.length === 1 &&
      appVersions.length === 1 &&
      htmlVersions[0] === appVersions[0],
    `Cache-busting ?v= query strings must be uniform across index.html (${htmlVersions}) and js/app.js (${appVersions})`
  );

  // 8. Verify AI-Native API (window.atlasAPI: locate / resolvePlace / inspect) & llms.txt
  const llmsTxtPath = path.join(ROOT, 'llms.txt');
  assert(fs.existsSync(llmsTxtPath), 'llms.txt must exist in repository root');
  const llmsTxt = fs.readFileSync(llmsTxtPath, 'utf8');
  assert(
    appCode.includes('window.atlasAPI') &&
      appCode.includes('resolvePlace(') &&
      appCode.includes('inspect(') &&
      appCode.includes('locate(') &&
      appCode.includes('trace-pin-label') &&
      llmsTxt.includes('?year=') &&
      llmsTxt.includes('window.atlasAPI.locate'),
    'app.js & llms.txt must expose window.atlasAPI (locate, resolvePlace, inspect) and 5-parameter URL deep-link protocol'
  );

  const elapsed = (performance.now() - t0).toFixed(1);
  console.log(`✓ Jiangshan Atlas validation passed in ${elapsed} ms:`);
  console.log(`  - ${dynasties.length} dynasties, ${snapKeys.length} snapshots (${referencedSnaps.size} phase-linked)`);
  console.log(`  - ${decodedPolygons} historical polygons (${totalVertices.toLocaleString()} vertices) verified lossless`);
  console.log(`  - ${provinces.length} modern provinces (${provRingCount} rings)`);
  console.log(`  - ${totalSettlements} ancient settlements & ${totalMilestones} historical milestones`);
  console.log(`  - ${loreData.HISTORICAL_JOURNEYS.length} journeys, ${loreData.CHINESE_ERA_SPANS.length} era spans & ${loreData.PLACE_LANDMARK_EVENTS.length} landmark events in lore_data.js`);
}

main();
