#!/usr/bin/env node
/**
 * Automated Integrity & Topology Validation Suite for Jiangshan Atlas (江山时序)
 * Zero external dependencies — runs in standard Node.js.
 */
'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
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
  let bootSnapshots = null;
  for (const file of dataScripts) {
    const fullPath = path.join(JS_DIR, file);
    assert(fs.existsSync(fullPath), `Missing required script: js/${file}`);
    const code = fs.readFileSync(fullPath, 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
    if (file === 'atlas_boot.js') {
      bootSnapshots = sandbox.window.ATLAS_SNAPSHOTS;
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
      assert(
        m.headline.length >= 8 && m.headline.length <= 32,
        `Milestone ${mk} zh headline length ${m.headline.length} outside [8, 32]: ${m.headline}`
      );
      const enHeadline = enLocale.milestones[mk][0] || '';
      assert(
        enHeadline.length >= 24 && enHeadline.length <= 96,
        `Milestone ${mk} en headline length ${enHeadline.length} outside [24, 96]: ${enHeadline}`
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
  const zhouExceptions = new Set(['贵州', '北朝幽州', '曹魏徐州', '南阳邓州', '酒泉瓜州']);
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

  // 6. Verify Unified Milestone Balloon Auto-Show ("史事浮签") follows #chk-milestones directly & dead code pruned
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(
    appCode.includes('_syncAutoMilestoneBalloon') &&
      appCode.includes('ep-close') &&
      !appCode.includes('_buildMilestoneCalloutDom') &&
      !appCode.includes('toggleEventCallouts') &&
      !appCode.includes('toggleGenealogyMode') &&
      !appCode.includes('_startGuqinSynthFallback') &&
      !indexHtml.includes('id="chk-event-callouts"'),
    'app.js & index.html must unify event callouts under #chk-milestones (_syncAutoMilestoneBalloon, ep-close) and remove dead code (chk-event-callouts, toggleEventCallouts, toggleGenealogyMode, _startGuqinSynthFallback)'
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

  // 8. Verify AI-Native API (window.atlasAPI: locate / resolvePlace / inspect), PLACE_GAZETTEER, llms.txt & skill
  for (const strayFile of [
    'app.js',
    'lore_data.js',
    'map_data.js',
    'china_geo_data.js',
    'atlas_boot.js',
    'atlas_snapshots.js',
    'i18n_dict.js',
    'style.css',
  ]) {
    assert(
      !fs.existsSync(path.join(ROOT, strayFile)),
      `Stray duplicate file "${strayFile}" found at repository root; all runtime scripts and styles must live exclusively under js/ or css/`
    );
  }
  const llmsTxtPath = path.join(ROOT, 'llms.txt');
  const skillMdPath = path.join(ROOT, 'skills', 'jiangshan-atlas', 'SKILL.md');
  const skillPyPath = path.join(ROOT, 'skills', 'jiangshan-atlas', 'scripts', 'jiangshan.py');
  assert(fs.existsSync(llmsTxtPath), 'llms.txt must exist in repository root');
  assert(fs.existsSync(skillMdPath), 'skills/jiangshan-atlas/SKILL.md must exist');
  assert(fs.existsSync(skillPyPath), 'skills/jiangshan-atlas/scripts/jiangshan.py must exist');
  assert(
    Array.isArray(loreData.PLACE_GAZETTEER) && loreData.PLACE_GAZETTEER.length >= 100,
    'lore_data.js must provide >= 100 PLACE_GAZETTEER entries with poetic/historical landmarks and city aliases'
  );
  const llmsTxt = fs.readFileSync(llmsTxtPath, 'utf8');
  assert(
    appCode.includes('window.atlasAPI') &&
      appCode.includes('resolvePlace(') &&
      appCode.includes('inspect(') &&
      appCode.includes('locate(') &&
      appCode.includes('_parsePlaceTokens(') &&
      appCode.includes('_renderCustomRoute(') &&
      appCode.includes('PLACE_GAZETTEER') &&
      appCode.includes('trace-pin-label') &&
      llmsTxt.includes('?year=') &&
      llmsTxt.includes('window.atlasAPI.locate'),
    'app.js & llms.txt must expose window.atlasAPI (locate, resolvePlace, inspect), multi-stop route rendering, PLACE_GAZETTEER, and URL deep-link protocol'
  );

  // 9. End-to-End CUJ Verification Suite (Headless Controller Harness)
  sandbox.window.addEventListener = () => {};
  sandbox.window.URLSearchParams = URLSearchParams;
  sandbox.URLSearchParams = URLSearchParams;
  sandbox.setTimeout = setTimeout;
  sandbox.clearTimeout = clearTimeout;
  sandbox.location = {
    search: '',
    origin: 'https://deanchensj.github.io',
    pathname: '/jiangshan-map/',
  };
  sandbox.window.location = sandbox.location;
  vm.runInContext(appCode, sandbox, { filename: 'app.js' });
  const ControllerClass = sandbox.window.HistoricalAtlasController;
  assert(typeof ControllerClass === 'function', 'HistoricalAtlasController must be exposed on window');

  const DEG_TO_RAD = Math.PI / 180;
  const ctrl = Object.create(ControllerClass.prototype);
  Object.assign(ctrl, {
    dynasties,
    provinces,
    corridors,
    snapshots,
    enLocale,
    locale: 'zh',
    year: -403,
    minYear: dynasties[0].fromYear,
    maxYear: dynasties[dynasties.length - 1].toYear,
    camera: { x: 350, y: 215, w: 500, h: 420, zoom: 2 },
    projector: new sandbox.window.MercatorProjector(1000, 700, {
      west: 66,
      east: 142,
      south: 14,
      north: 55,
    }),
  });

  // CUJ 9a: 0D Single-Place Resolution & Exact-First Disambiguation (Poems, Passes, Battles, Cities)
  const languan819 = ctrl.inspect({ year: 819, place: '蓝关' });
  assert.strictEqual(languan819.year, 819);
  assert.strictEqual(languan819.polity, '唐');
  assert(languan819.era.includes('元和十四年'), `Expected 元和十四年 for 819 CE, got ${languan819.era}`);
  assert(
    Math.hypot(languan819.coord[0] - 109.52, languan819.coord[1] - 34.03) < 0.2,
    `Expected 蓝关 near [109.52, 34.03], got ${JSON.stringify(languan819.coord)}`
  );

  const jingkou1205 = ctrl.inspect({ year: 1205, place: '京口' });
  assert.strictEqual(jingkou1205.year, 1205);
  assert.strictEqual(jingkou1205.polity, '南宋');
  assert(jingkou1205.modernProvince.includes('江苏'), `Expected 江苏 for 京口, got ${jingkou1205.modernProvince}`);

  // Exact-First check: '西安' and '洛阳' must resolve to the capital settlements, not substring-match a pass's modern description
  const xianHit = ctrl.resolvePlace('西安', 741);
  const luoyangHit = ctrl.resolvePlace('洛阳', 741);
  assert(xianHit && xianHit.kind === 'city', `Expected '西安' to resolve to city, got ${JSON.stringify(xianHit)}`);
  assert(luoyangHit && luoyangHit.kind === 'city', `Expected '洛阳' to resolve to city, got ${JSON.stringify(luoyangHit)}`);

  // CUJ 9b: 1D Same-Year Multi-Stop Poetic Route (?year=763&place=剑外,巴峡,巫峡,襄阳,洛阳)
  const dufu763 = ctrl.inspect({ year: 763, place: '剑外,巴峡,巫峡,襄阳,洛阳' });
  assert(Array.isArray(dufu763.route) && dufu763.route.length === 5, 'Du Fu 763 route must resolve all 5 stops');
  assert(dufu763.route.every((st) => st.year === 763), 'All stops in Du Fu 763 route must share year 763');
  assert(dufu763.routeDistanceKm >= 700 && dufu763.routeDistanceKm <= 1400, `Unexpected Du Fu route distance: ${dufu763.routeDistanceKm} km`);
  assert(
    dufu763.url.includes('year=763') && decodeURIComponent(dufu763.url).includes('place=剑外,巴峡,巫峡,襄阳,洛阳'),
    `Unexpected Du Fu 1D route URL: ${decodeURIComponent(dufu763.url)}`
  );

  // CUJ 9c: 4D Multi-Year Trajectory (?year=1079,1080,1094,1097&place=湖州,黄州,惠州,儋州) + Inline Year Fallback
  const sushiRoute = ctrl.inspect({ year: '1079,1080,1094,1097', place: '湖州,黄州,惠州,儋州' });
  assert(Array.isArray(sushiRoute.route) && sushiRoute.route.length === 4, 'Su Shi route must resolve all 4 stops');
  assert.strictEqual(
    sushiRoute.route.map((s) => s.year).join(','),
    '1079,1080,1094,1097',
    'Su Shi route stops must preserve per-stop years [1079, 1080, 1094, 1097]'
  );
  assert(
    decodeURIComponent(sushiRoute.url).includes('year=1079,1080,1094,1097'),
    `Multi-year route URL must preserve comma-separated years, got ${decodeURIComponent(sushiRoute.url)}`
  );
  const sushiInline = ctrl.inspect({ place: '1079:湖州,1080:黄州,1094:惠州,1097:儋州' });
  assert.strictEqual(
    JSON.stringify(sushiInline.route.map((s) => [s.year, s.place])),
    JSON.stringify(sushiRoute.route.map((s) => [s.year, s.place])),
    'Inline year:place syntax must resolve identically to parallel year= & place= lists'
  );

  // CUJ 9d: Timeline Clamping & No-Year-Zero Contract
  const mingtiaoClamped = ctrl.inspect({ year: -1600, place: '鸣条' });
  assert.strictEqual(mingtiaoClamped.year, -403, 'Years before -403 must clamp to -403 (Warring States start)');
  assert(mingtiaoClamped.modernProvince.includes('山西'), `Expected 鸣条 in 山西, got ${mingtiaoClamped.modernProvince}`);
  const yearZeroNorm = ctrl.inspect({ year: 0, place: '长安' });
  assert.strictEqual(yearZeroNorm.year, 1, 'Year 0 must normalize to 1 CE');

  // CUJ 9e: 100% Gazetteer & Alias Resolution Coverage
  for (const g of loreData.PLACE_GAZETTEER) {
    assert(
      g.name && Array.isArray(g.coord) && g.coord.length === 2,
      `Invalid PLACE_GAZETTEER entry: ${JSON.stringify(g)}`
    );
    const [gx, gy] = g.coord;
    assert(
      gx >= 70 && gx <= 135 && gy >= 15 && gy <= 52,
      `Out-of-bounds PLACE_GAZETTEER coordinate [${gx}, ${gy}] for ${g.name}`
    );
    const hitMain = ctrl.resolvePlace(g.name, 750);
    assert(hitMain, `resolvePlace failed for PLACE_GAZETTEER primary name: ${g.name}`);
    for (const alias of g.aliases || []) {
      const hitAlias = ctrl.resolvePlace(alias, 750);
      assert(hitAlias, `resolvePlace failed for PLACE_GAZETTEER alias "${alias}" of ${g.name}`);
    }
  }

  // CUJ 9f: Root Mirror Byte-Level Synchronization Check (if any root mirror files exist)
  const mirrorPairs = [
    ['js/app.js', 'app.js'],
    ['js/lore_data.js', 'lore_data.js'],
    ['css/style.css', 'style.css'],
  ];
  for (const [srcRel, dstRel] of mirrorPairs) {
    const srcPath = path.join(ROOT, srcRel);
    const dstPath = path.join(ROOT, dstRel);
    if (fs.existsSync(dstPath)) {
      const srcBuf = fs.readFileSync(srcPath);
      const dstBuf = fs.readFileSync(dstPath);
      assert(
        srcBuf.equals(dstBuf),
        `Mirror file out of sync: ${dstRel} differs from ${srcRel} (run: cp ${srcRel} ${dstRel})`
      );
    }
  }

  // CUJ 9g: Full Timeline Sweep (-403 to 2026) — Dynasty, Snapshot & Imperial Era Continuity
  let sweptYears = 0;
  for (let y = ctrl.minYear; y <= ctrl.maxYear; y++) {
    if (y === 0) continue;
    sweptYears++;
    const dIdx = ctrl._findDynastyIndex(y);
    assert(dIdx >= 0 && dIdx < dynasties.length, `Invalid dynasty index ${dIdx} at year ${y}`);
    const d = dynasties[dIdx];
    const sk = ctrl._resolveSnapKey(d, y);
    assert(sk && snapshots[sk], `Missing snapshot "${sk}" resolved at year ${y} (${d.key})`);
    const eraLbl = ctrl.formatEraLabel(y, d);
    assert(
      typeof eraLbl === 'string' &&
        eraLbl.length > 0 &&
        !eraLbl.includes('undefined') &&
        !eraLbl.includes('NaN'),
      `Invalid era label "${eraLbl}" at year ${y} (${d.key})`
    );
  }
  for (const sp of loreData.CHINESE_ERA_SPANS) {
    if (sp[0] < 1912) {
      assert(
        typeof sp[3] === 'string' &&
          sp[3].length >= 2 &&
          typeof sp[4] === 'string' &&
          sp[4].length >= 3,
        `Imperial era span at year ${sp[0]} (${sp[1]}) must include [monarchZh, monarchEn], got ${JSON.stringify(sp)}`
      );
    }
  }
  assert.strictEqual(ctrl.formatEraLabel(-214, dynasties[1]), '秦始皇三十三年');
  assert.strictEqual(ctrl.formatEraLabel(-119, dynasties[2]), '西汉武帝·元狩四年');
  assert.strictEqual(ctrl.formatEraLabel(627, dynasties[9]), '唐太宗·贞观元年');
  assert.strictEqual(ctrl.formatEraLabel(819, dynasties[9]), '唐宪宗·元和十四年');
  assert.strictEqual(ctrl.formatEraLabel(1082, dynasties[11]), '北宋神宗·元丰五年');
  assert.strictEqual(ctrl.formatEraLabel(1587, dynasties[14]), '明万历十五年');
  assert.strictEqual(ctrl.formatEraLabel(1683, dynasties[15]), '清康熙二十二年');

  // CUJ 9h: Adjacent / Overlapping Polity Color Collision Guard across all snapshots
  function shapeBbox(shape) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const polys = shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        for (const [x, y] of ring) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return { minX, minY, maxX, maxY };
  }
  function bboxOverlapOrTouch(a, b, pad = 0.6) {
    return !(
      a.maxX + pad < b.minX ||
      b.maxX + pad < a.minX ||
      a.maxY + pad < b.minY ||
      b.maxY + pad < a.minY
    );
  }
  for (const [sk, snap] of Object.entries(snapshots)) {
    if (!snap || Array.isArray(snap)) continue;
    const activePols = (snap.polities || []).filter(
      (p) => (p.role === 'main' || p.role === 'rival') && p.tint && p.title
    );
    for (let i = 0; i < activePols.length; i++) {
      for (let j = i + 1; j < activePols.length; j++) {
        const pA = activePols[i];
        const pB = activePols[j];
        if (pA.title === pB.title) continue;
        if (pA.tint.toLowerCase() === pB.tint.toLowerCase()) {
          const boxA = shapeBbox(pA.shape);
          const boxB = shapeBbox(pB.shape);
          assert(
            !bboxOverlapOrTouch(boxA, boxB),
            `Polity color collision in ${sk}: "${pA.title}" and "${pB.title}" share identical tint ${pA.tint} with overlapping/adjacent bounds`
          );
        }
      }
    }
  }

  // CUJ 9h2: Territorial Exclusivity Guard — no two main/rival/protectorate polities in one snapshot may overlap.
  // Overlap area is estimated by grid sampling inside the shared bounding box (0.2° step ≈ 0.04 deg² per cell);
  // anything above 0.3 deg² (~3,000 km²) is a real overlap rather than shared-border sampling noise.
  const OVERLAP_STEP = 0.2;
  const OVERLAP_MAX_DEG2 = 0.3;
  function sampledOverlapDeg2(shapeA, shapeB) {
    const a = shapeBbox(shapeA);
    const b = shapeBbox(shapeB);
    const x0 = Math.max(a.minX, b.minX);
    const y0 = Math.max(a.minY, b.minY);
    const x1 = Math.min(a.maxX, b.maxX);
    const y1 = Math.min(a.maxY, b.maxY);
    if (x0 >= x1 || y0 >= y1) return 0;
    const limitCells = Math.ceil(OVERLAP_MAX_DEG2 / (OVERLAP_STEP * OVERLAP_STEP) + 1);
    let hits = 0;
    for (let x = x0 + OVERLAP_STEP / 2; x < x1; x += OVERLAP_STEP) {
      for (let y = y0 + OVERLAP_STEP / 2; y < y1; y += OVERLAP_STEP) {
        if (pointInShape(x, y, shapeA) && pointInShape(x, y, shapeB)) {
          hits++;
          if (hits > limitCells) return hits * OVERLAP_STEP * OVERLAP_STEP;
        }
      }
    }
    return hits * OVERLAP_STEP * OVERLAP_STEP;
  }
  let overlapPairsChecked = 0;
  for (const [sk, snap] of Object.entries(snapshots)) {
    if (!snap || Array.isArray(snap)) continue;
    const pols = (snap.polities || []).filter(
      (p) => (p.role === 'main' || p.role === 'rival' || p.role === 'protectorate') && p.shape
    );
    for (let i = 0; i < pols.length; i++) {
      for (let j = i + 1; j < pols.length; j++) {
        overlapPairsChecked++;
        const area = sampledOverlapDeg2(pols[i].shape, pols[j].shape);
        assert(
          area <= OVERLAP_MAX_DEG2,
          `Territorial overlap in ${sk}: "${pols[i].title}" [${pols[i].role}] and "${pols[j].title}" [${pols[j].role}] share ≈${area.toFixed(2)} deg² — carve the larger polity by the smaller one`
        );
      }
    }
  }
  assert(
    overlapPairsChecked > 300,
    `Expected to check hundreds of polity pairs, checked ${overlapPairsChecked}`
  );
  // Regression anchors for overlaps fixed in this guard's first run
  const tangA1 = snapshots.s_tang_a1;
  const tangMainA1 = tangA1.polities.find((p) => p.role === 'main');
  assert(
    !pointInShape(99.5, 36.6, tangMainA1.shape),
    's_tang_a1: Tang main polygon must not cover the Tuyuhun basin (Qinghai Lake area)'
  );
  const yuanA = snapshots.s_yuan_a;
  const yuanMain = yuanA.polities.find((p) => p.role === 'main');
  assert(
    !pointInShape(91.1, 29.7, yuanMain.shape),
    's_yuan_a: Yuan main polygon must leave Lhasa to the 吐蕃（总制院辖） protectorate'
  );
  const xihanE = snapshots.s_xihan_e;
  const gengshiMain = xihanE.polities.find((p) => p.role === 'main');
  const weixiaoRival = xihanE.polities.find((p) => p.title.includes('隗嚣'));
  assert(
    pointInShape(108.9, 34.3, gengshiMain.shape) && !pointInShape(108.9, 34.3, weixiaoRival.shape),
    's_xihan_e: Chang\'an (108.9, 34.3) must belong exclusively to 更始（汉） rather than 隗嚣 · 窦融'
  );

  // CUJ 9i: Quick Search (_queryQuickSearch) End-to-End Verification (Era Chinese Numerals, Emperors, Cities, Passes, Events, Journeys)
  const eraHit1 = ctrl._queryQuickSearch('元狩二年');
  assert(
    eraHit1.length > 0 && eraHit1[0].kind === 'era' && eraHit1[0].year === -121,
    `Expected '元狩二年' to resolve to -121 BCE era, got ${JSON.stringify(eraHit1[0])}`
  );
  const eraHit2 = ctrl._queryQuickSearch('贞观元年');
  assert(
    eraHit2.length > 0 && eraHit2[0].kind === 'era' && eraHit2[0].year === 627,
    `Expected '贞观元年' to resolve to 627 CE era, got ${JSON.stringify(eraHit2[0])}`
  );
  const eraHit3 = ctrl._queryQuickSearch('公元前214年');
  assert(
    eraHit3.length > 0 && eraHit3[0].kind === 'era' && eraHit3[0].year === -214,
    `Expected '公元前214年' to resolve to -214 BCE, got ${JSON.stringify(eraHit3[0])}`
  );
  const empHit1 = ctrl._queryQuickSearch('汉武帝');
  assert(
    empHit1.some((item) => item.kind === 'era' && item.year === -140),
    `Expected '汉武帝' quick search to include -140 BCE accession era, got ${JSON.stringify(empHit1)}`
  );
  const empHit2 = ctrl._queryQuickSearch('宋神宗');
  assert(
    empHit2.some((item) => item.kind === 'era' && item.year === 1068),
    `Expected '宋神宗' quick search to include 1068 CE accession era, got ${JSON.stringify(empHit2)}`
  );
  const empHit3 = ctrl._queryQuickSearch('明神宗');
  assert(
    empHit3.some((item) => item.kind === 'era' && item.year === 1573),
    `Expected '明神宗' quick search to include 1573 CE Wanli accession era, got ${JSON.stringify(empHit3)}`
  );
  const passSearch = ctrl._queryQuickSearch('函谷关');
  assert(
    passSearch.some((item) => item.kind === 'pass' && item.passKey === 'hanguguan'),
    'Quick search for "函谷关" must return strategic pass entry'
  );
  const eventSearch = ctrl._queryQuickSearch('淝水之战');
  assert(
    eventSearch.some((item) => item.kind === 'event' && item.year === 383),
    'Quick search for "淝水之战" must return 383 CE milestone event'
  );
  const journeySearch = ctrl._queryQuickSearch('苏轼');
  assert(
    journeySearch.some((item) => item.kind === 'journey' && item.journeyKey === 'sushi'),
    'Quick search for "苏轼" must return Su Shi historical journey'
  );

  // CUJ 9j: 7 Historical Journeys Full Stop & Bilingual Completeness Verification
  let totalJourneyStops = 0;
  for (const j of loreData.HISTORICAL_JOURNEYS) {
    assert(
      j.key && j.titleZh && j.titleEn && Array.isArray(j.stops) && j.stops.length >= 8,
      `Invalid journey metadata for ${j && j.key}`
    );
    for (const st of j.stops) {
      totalJourneyStops++;
      assert(
        typeof st.year === 'number' && st.year >= -403 && st.year <= 2026 && st.year !== 0,
        `Invalid stop year ${st.year} in journey ${j.key}`
      );
      assert(
        Array.isArray(st.coord) &&
          st.coord.length === 2 &&
          st.coord[0] >= 60 &&
          st.coord[0] <= 135 &&
          st.coord[1] >= 15 &&
          st.coord[1] <= 55,
        `Out-of-bounds stop coord ${JSON.stringify(st.coord)} in journey ${j.key}`
      );
      for (const viaPt of st.via || []) {
        assert(
          Array.isArray(viaPt) &&
            viaPt.length === 2 &&
            viaPt[0] >= 60 &&
            viaPt[0] <= 135 &&
            viaPt[1] >= 15 &&
            viaPt[1] <= 55,
          `Out-of-bounds via point ${JSON.stringify(viaPt)} in journey ${j.key}`
        );
      }
      for (const reqField of [
        'eraZh',
        'ancientZh',
        'modernZh',
        'ancientEn',
        'modernEn',
        'titleZh',
        'titleEn',
        'descZh',
        'descEn',
        'quoteZh',
        'quoteEn',
      ]) {
        assert(
          typeof st[reqField] === 'string' && st[reqField].trim().length > 0,
          `Missing bilingual field "${reqField}" at stop ${st.ancientZh || st.year} in journey ${j.key}`
        );
      }
    }
  }

  // CUJ 9k: Python CLI (skills/jiangshan-atlas/scripts/jiangshan.py) Execution Smoke Test
  const cliOut = execFileSync(
    'python3',
    [skillPyPath, '--year', '1079, 1080, 1094, 1097', '--place', '湖州 → 黄州 → 惠州 → 儋州'],
    { encoding: 'utf8' }
  ).trim();
  const decodedCliOut = decodeURIComponent(cliOut);
  assert(
    decodedCliOut.includes('URL: https://deanchensj.github.io/jiangshan-map/?year=1079,1080,1094,1097&place=湖州,黄州,惠州,儋州'),
    `Unexpected jiangshan.py CLI output: ${decodedCliOut}`
  );

  // CUJ 9l: Neighbor Polity Clean Fill & Stray Full-China Ring Guard
  const cssSrc = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
  assert(
    !cssSrc.includes('fill: url(#diag-hatch)'),
    'css/style.css must not apply diagonal hatch pattern (url(#diag-hatch)) to .polity-shape.neighbor'
  );
  for (const [bundleLabel, snapBundle] of [
    ['atlas_boot.js', bootSnapshots],
    ['atlas_snapshots.js', snapshots],
  ]) {
    for (const [sk, snap] of Object.entries(snapBundle)) {
      if (!snap || Array.isArray(snap)) continue;
      for (const pol of snap.polities || []) {
        if (pol.role === 'main') continue;
        const polys = pol.shape.type === 'Polygon' ? [pol.shape.coordinates] : pol.shape.coordinates;
        for (const poly of polys) {
          const ring = poly[0] || [];
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (const [x, y] of ring) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
          assert(
            !(minX < 98 && maxX > 122 && minY < 20 && maxY > 41),
            `[${bundleLabel}:${sk}] Non-main polity "${pol.title}" (${pol.role}) contains stray full-China outline ring [${minX.toFixed(1)},${minY.toFixed(1)},${maxX.toFixed(1)},${maxY.toFixed(1)}]`
          );
        }
      }
    }
  }

  // CUJ 9m: Major Territorial Change Milestones & Map Linkage Verification
  const territorialMilestoneChecks = [
    { dyn: 'zhanguo', year: -300, keyword: '秦开' },
    { dyn: 'donghan', year: 43, keyword: '马援' },
    { dyn: 'sanguo', year: 238, keyword: '公孙渊' },
    { dyn: 'tang', year: 635, keyword: '吐谷浑' },
    { dyn: 'tang', year: 648, keyword: '王玄策' },
    { dyn: 'nansong', year: 1234, keyword: '端平入洛' },
    { dyn: 'yuan', year: 1288, keyword: '宣政院' },
    { dyn: 'qing', year: 1881, keyword: '伊犁' },
    { dyn: 'qing', year: 1898, keyword: '胶州湾' },
    { dyn: 'roc', year: 1932, keyword: '满洲国' },
    { dyn: 'roc', year: 1945, keyword: '台湾' },
    { dyn: 'roc', year: 1946, keyword: '外蒙古' },
  ];
  for (const tmc of territorialMilestoneChecks) {
    const d = dynasties.find((item) => item.key === tmc.dyn);
    assert(d, `Missing dynasty ${tmc.dyn} in DYNASTY_DATA`);
    const m = (d.milestones || []).find((item) => item.year === tmc.year);
    assert(m, `Missing milestone for year ${tmc.year} in dynasty ${tmc.dyn}`);
    assert(
      m.headline.includes(tmc.keyword),
      `Milestone ${tmc.dyn}:${tmc.year} headline does not contain "${tmc.keyword}": ${m.headline}`
    );
    assert(Array.isArray(m.coord) && m.coord.length === 2, `Milestone ${tmc.dyn}:${tmc.year} missing coordinate`);
    const snapAtYear = ctrl._resolveSnapKey(d, tmc.year);
    const snapPrevYear = ctrl._resolveSnapKey(d, tmc.year - 1);
    assert(
      snapAtYear !== snapPrevYear,
      `Territorial milestone ${tmc.dyn}:${tmc.year} (${tmc.keyword}) must trigger a real polygon snapshot transition, but both ${tmc.year - 1} and ${tmc.year} resolved to "${snapAtYear}"`
    );
  }

  // CUJ 9n: Historical Landmark Events Full Integrity, Bilingual Precision & Quick Search Coverage
  const dynKeySet = new Set(dynasties.map((d) => d.key));
  for (const lm of loreData.PLACE_LANDMARK_EVENTS) {
    assert(
      dynKeySet.has(lm.dynastyKey),
      `Invalid dynastyKey "${lm.dynastyKey}" in landmark event: ${lm.zh}`
    );
    const d = dynasties.find((dyn) => dyn.key === lm.dynastyKey);
    assert(
      lm.year >= d.fromYear && lm.year <= d.toYear,
      `Landmark event year ${lm.year} out of bounds [${d.fromYear}, ${d.toYear}] for ${d.key}: ${lm.zh}`
    );
    assert(
      Array.isArray(lm.coord) &&
        lm.coord.length === 2 &&
        lm.coord[0] >= 60 &&
        lm.coord[0] <= 135 &&
        lm.coord[1] >= 15 &&
        lm.coord[1] <= 55,
      `Out-of-bounds landmark coord ${JSON.stringify(lm.coord)} in ${lm.zh}`
    );
    assert(
      typeof lm.zh === 'string' &&
        lm.zh.trim().length >= 10 &&
        lm.zh.trim().length <= 34 &&
        typeof lm.en === 'string' &&
        lm.en.trim().length >= 24 &&
        lm.en.trim().length <= 96 &&
        !/[\u4e00-\u9fa5]/.test(lm.en),
      `Invalid or out-of-bounds bilingual text length in landmark event: ${JSON.stringify(lm)}`
    );
    assert(
      typeof lm.site === 'string' &&
        lm.site.trim().length > 0 &&
        typeof lm.siteEn === 'string' &&
        lm.siteEn.trim().length > 0 &&
        !/[\u4e00-\u9fa5]/.test(lm.siteEn),
      `Invalid bilingual site in landmark event: ${JSON.stringify(lm)}`
    );
  }

  // Quick search coverage verification for landmark events and newly indexed places
  const sampleSearchQueries = [
    ['迁都咸阳', 'event'],
    ['水淹七军', 'event'],
    ['风波亭', 'event'],
    ['积水潭', 'event'],
    ['井陉之战', 'event'],
    ['洛邑', 'gazetteer'],
    ['东京汴梁', 'gazetteer'],
    ['井陉关', 'pass'],
  ];
  for (const [query, expectedKind] of sampleSearchQueries) {
    const hits = ctrl._queryQuickSearch(query);
    assert(
      hits.length > 0 && hits.some((h) => h.kind === expectedKind),
      `Expected quick search query "${query}" to return at least one result of kind "${expectedKind}", got: ${JSON.stringify(hits.map((h) => ({ title: h.titleZh, kind: h.kind })))}`
    );
  }

  // CUJ 9o: First-Level Administrative Boundary Deduplication, Search Deduplication & Bilingual Polish
  assert(
    cssSrc.includes('.region-shape-casing') && cssSrc.includes('.region-shape'),
    'css/style.css must define both .region-shape-casing and .region-shape'
  );
  ctrl.projector.toScreen = (lng, lat) => [(lng - 66) * 13.15, (55 - lat) * 17.07];
  ctrl._hydrateSnapshots();
  const tangDyn = dynasties.find((d) => d.key === 'tang');
  const tang780Key = ctrl._resolveSnapKey(tangDyn, 780);
  const tang780Snap = snapshots[tang780Key];
  assert(
    tang780Snap && Array.isArray(tang780Snap.regions) && tang780Snap.regions.length >= 10,
    `Missing ${tang780Key} circuits (regions)`
  );
  const tang780RegPath = ctrl._buildRegionBoundaryPath(tang780Snap);
  assert(
    typeof tang780RegPath === 'string' && tang780RegPath.length > 500,
    `Expected non-empty deduplicated region boundary SVG path for s_tang_780, got length ${tang780RegPath ? tang780RegPath.length : 0}`
  );
  assert.strictEqual(
    ctrl._buildRegionBoundaryPath(tang780Snap),
    tang780RegPath,
    '_buildRegionBoundaryPath must return cached SVG path on subsequent calls'
  );
  assert.strictEqual(
    ctrl._buildRegionBoundaryPath(snapshots.s_prc),
    '',
    's_prc must skip duplicate region boundary stroke over modern grpProvinces'
  );
  for (const checkSnapKey of [
    's_zhanguo_a',
    's_qin_a',
    's_qin',
    's_donghan',
    's_sanguo',
    's_dongjin_a',
    's_nanbei',
    's_sui',
    's_tang',
    's_wudai',
    's_beisong',
    's_nansong',
    's_yuan',
    's_ming',
    's_qing',
    's_roc',
  ]) {
    const checkSnap = snapshots[checkSnapKey];
    assert(checkSnap && Array.isArray(checkSnap.regions) && checkSnap.regions.length > 0, `Missing regions on ${checkSnapKey}`);
    const regPath = ctrl._buildRegionBoundaryPath(checkSnap);
    assert(regPath.length > 500, `Expected non-empty region boundary path on ${checkSnapKey}`);
    const segRe = /([ML])(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g;
    let m;
    let prevX = NaN;
    let prevY = NaN;
    let straightRulerSegs = 0;
    while ((m = segRe.exec(regPath)) !== null) {
      const cmd = m[1];
      const x = parseFloat(m[2]);
      const y = parseFloat(m[3]);
      if (cmd === 'L' && !Number.isNaN(prevX)) {
        const dx = Math.abs(x - prevX);
        const dy = Math.abs(y - prevY);
        const len = Math.hypot(dx, dy);
        if ((len > 4.5 && (dx < 0.35 || dy < 0.35)) || len > 7.5) {
          straightRulerSegs++;
        }
      }
      prevX = x;
      prevY = y;
    }
    assert.strictEqual(
      straightRulerSegs,
      0,
      `Expected 0 artificial straight ruler segments in ${checkSnapKey} region boundary path, found ${straightRulerSegs}`
    );
  }

  // Verify cross-dynasty city search deduplication (e.g. "长安" returns 1 city entry + events/journeys)
  const changanHits = ctrl._queryQuickSearch('长安');
  const changanCityHits = changanHits.filter((h) => h.kind === 'city' && h.titleZh === '长安');
  assert.strictEqual(
    changanCityHits.length,
    1,
    `Expected cross-dynasty city "长安" to be deduplicated to 1 city row, got ${changanCityHits.length}`
  );
  assert(
    changanHits.some((h) => h.kind === 'event' || h.kind === 'journey'),
    'Expected deduplicated "长安" search dropdown to surface related events or journeys'
  );

  // Verify English monarch name search in _matchEraResults
  const enEmpWu = ctrl._queryQuickSearch('Emperor Wu of Han');
  assert(
    enEmpWu.some((h) => h.kind === 'era' && h.year === -140),
    `Expected English monarch search "Emperor Wu of Han" to resolve to -140 BCE, got ${JSON.stringify(enEmpWu[0])}`
  );
  const enTaizong = ctrl._queryQuickSearch('Taizong of Tang');
  assert(
    enTaizong.some((h) => h.kind === 'era' && h.year === 627),
    `Expected English monarch search "Taizong of Tang" to resolve to 627 CE, got ${JSON.stringify(enTaizong[0])}`
  );

  // Verify index.html, README.md, and llms.txt metadata sync and removal of unused diag-hatch pattern
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(!htmlSrc.includes('id="diag-hatch"'), 'index.html must not contain unused #diag-hatch pattern');
  const readmeSrc = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert(
    !readmeSrc.includes('点右上角的 **「开始挑战」**') &&
      readmeSrc.includes('青史行迹 ▾') &&
      readmeSrc.includes('Journeys ▾') &&
      !/\b\d{3}\s*(幅|座|处|条|桩|段)/.test(readmeSrc),
    'README.md must document the Journeys dropdown challenge entry point and avoid hardcoded 3-digit entity counts'
  );
  const llmsSrc = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');
  for (const d of dynasties) {
    assert(
      llmsSrc.includes(`| \`${d.key}\` |`) && llmsSrc.includes(`\`${d.fromYear}\` to \`${d.toYear}\``),
      `llms.txt must list exact dynasty key ${d.key} and year span ${d.fromYear} to ${d.toYear}`
    );
  }

  // CUJ 9p: Territorial Ghost Diff (#grp-ghost-diff) Across Main, Protectorate, Rival & Cross-Dynasty Transitions
  const ghostNodes = [];
  ctrl.grpGhostDiff = {
    get innerHTML() {
      return '';
    },
    set innerHTML(_v) {
      ghostNodes.length = 0;
    },
  };
  ctrl._id = () => null;
  ctrl.projector.shapeToSvgPath = (shape) =>
    shape && shape.coordinates ? `M${JSON.stringify(shape.coordinates).length}` : '';
  ctrl._svgNode = (tag, attrs, parent) => {
    const node = { tag, attrs, dataset: {} };
    if (parent === ctrl.grpGhostDiff) ghostNodes.push(node);
    return node;
  };

  // 1) Tang peak (669 CE, with 安西都护府/北庭都护府 protectorate) -> Late Tang contraction (820 CE)
  const tangPeakSnap = snapshots[ctrl._resolveSnapKey(tangDyn, 669)];
  const tangLateSnap = snapshots[ctrl._resolveSnapKey(tangDyn, 820)];
  ctrl.lastRenderedSnap = tangLateSnap;
  ctrl._renderGhostDiff(tangPeakSnap, 'fade');
  assert(
    ghostNodes.length > 0 &&
      ghostNodes.some((n) => n.dataset.polityRole === 'protectorate' || n.dataset.polityRole === 'main'),
    `Expected _renderGhostDiff from Tang peak to Late Tang to emit ghost paths for changed main/protectorate polities, got ${JSON.stringify(ghostNodes)}`
  );
  if (ctrl.ghostTimer) {
    clearTimeout(ctrl.ghostTimer);
    ctrl.ghostTimer = null;
  }

  // 2) Cross-dynasty transition: Warring States (-231 BCE, with rival Six States) -> Qin unification (-221 BCE)
  const zgDyn = dynasties.find((d) => d.key === 'zhanguo');
  const qinDyn = dynasties.find((d) => d.key === 'qin');
  const zgSnap = snapshots[ctrl._resolveSnapKey(zgDyn, -231)];
  const qinSnap = snapshots[ctrl._resolveSnapKey(qinDyn, -221)];
  ctrl.lastRenderedSnap = qinSnap;
  ctrl._renderGhostDiff(zgSnap, 'fade');
  assert(
    ghostNodes.length >= 2 && ghostNodes.some((n) => n.dataset.polityRole === 'rival'),
    `Expected _renderGhostDiff from Warring States to Qin unification to include annexed rival states, got ${JSON.stringify(ghostNodes.map((n) => n.dataset))}`
  );
  if (ctrl.ghostTimer) {
    clearTimeout(ctrl.ghostTimer);
    ctrl.ghostTimer = null;
  }

  // 3) Preview mode + _clearPreviewGhost preserves active fade timer but clears preview
  const bsDyn = dynasties.find((d) => d.key === 'beisong');
  const nsDyn = dynasties.find((d) => d.key === 'nansong');
  const bsKey = ctrl._resolveSnapKey(bsDyn, 1100);
  const nsKey = ctrl._resolveSnapKey(nsDyn, 1142);
  ctrl.activeSnapKey = bsKey;
  ctrl.lastRenderedSnap = snapshots[bsKey];
  ctrl._previewStageGhost(nsKey);
  assert(
    ghostNodes.length > 0 && ghostNodes.every((n) => n.attrs.class.includes('is-preview')),
    'Expected _previewStageGhost to render .is-preview ghost paths'
  );
  ctrl._clearPreviewGhost();
  assert.strictEqual(ghostNodes.length, 0, 'Expected _clearPreviewGhost to clear preview paths when no fade timer is active');

  // 4) Era-aware resolvePlace disambiguation for 江州 (Tang/Song Jiujiang vs Warring States/Han Chongqing) & literary landmarks
  const jzSong = ctrl.resolvePlace('江州', 1102);
  assert(
    jzSong && Math.abs(jzSong.lng - 115.98) < 0.2 && Math.abs(jzSong.lat - 29.71) < 0.2,
    `Expected resolvePlace("江州", 1102) in Northern Song to resolve to Jiujiang (~115.98, 29.71), got ${JSON.stringify(jzSong)}`
  );
  const jzZg = ctrl.resolvePlace('江州', -300);
  assert(
    jzZg && Math.abs(jzZg.lng - 106.55) < 0.2 && Math.abs(jzZg.lat - 29.56) < 0.2,
    `Expected resolvePlace("江州", -300) in Warring States to resolve to Chongqing (~106.55, 29.56), got ${JSON.stringify(jzZg)}`
  );
  for (const [placeName, yr, expLng, expLat] of [
    ['浔阳楼', 1102, 115.98, 29.71],
    ['梁山泊', 1119, 116.09, 35.80],
    ['景阳冈', 1102, 115.92, 36.11],
    ['大名府', 1115, 115.15, 36.28],
    ['风波亭', 1142, 120.14, 30.25],
  ]) {
    const hit = ctrl.resolvePlace(placeName, yr);
    assert(
      hit && Math.abs(hit.lng - expLng) < 0.2 && Math.abs(hit.lat - expLat) < 0.2,
      `Expected resolvePlace("${placeName}", ${yr}) to resolve near [${expLng}, ${expLat}], got ${JSON.stringify(hit)}`
    );
  }

  // 5) Challenge Deck Quality, Strategic Passes & Spoiler Sanitization
  assert.strictEqual(ctrl._stripPromptParenthetical('襄平（辽阳）'), '襄平');
  assert.strictEqual(ctrl._stripPromptParenthetical('山海关（渝关）'), '山海关');
  const scrubbedZibo = ctrl._sanitizeChallengeClue(
    '齐国都城（今山东淄博临淄），姜太公封地，淄博重镇',
    { ancient: '临淄', modern: '山东淄博临淄' },
    '临淄'
  );
  assert(
    !scrubbedZibo.includes('淄博') && !scrubbedZibo.includes('山东'),
    `Expected modern spoilers "山东/淄博" to be scrubbed from clue, got: ${scrubbedZibo}`
  );
  let sawPassInDeck = false;
  for (let run = 0; run < 15; run++) {
    const deck = ctrl._buildChallengeDeck();
    assert.strictEqual(deck.length, 10, `Expected 10 questions in challenge deck, got ${deck.length}`);
    for (let i = 0; i < deck.length; i++) {
      const q = deck[i];
      if (q.settlement.isPass) sawPassInDeck = true;
      const evs = ctrl._collectPlaceEventsForDynasty(
        q.dynasty,
        q.settlement.coord[0],
        q.settlement.coord[1],
        { s: q.settlement, km: 0 }
      );
      assert(
        q.settlement.isCapital || q.settlement.remark || q.settlement.isPass || evs.length > 0,
        `Challenge deck item ${q.dynasty.key}:${q.settlement.ancient} lacks capital/remark/events`
      );
      for (let j = i + 1; j < deck.length; j++) {
        const distKm = ctrl.projector.greatCircleKm(
          q.settlement.coord,
          deck[j].settlement.coord
        );
        assert(
          distKm >= 35,
          `Challenge deck items ${q.settlement.ancient} and ${deck[j].settlement.ancient} are too close (${distKm.toFixed(1)} km)`
        );
      }
    }
  }
  assert(sawPassInDeck, 'Expected STRATEGIC_PASSES to appear in challenge decks across 15 runs');

  // CUJ 9q: Onboarding Persistence (#2), Traced Prefecture Highlight (#5), Custom Route Dock (#3) & Mobile/Challenge UX (#6)
  assert(
    !appCode.includes("if (this._bootDone) this._dismissTraceOnboarding()") &&
      appCode.includes('_syncTracedPrefecture') &&
      appCode.includes('_renderCustomRouteCard') &&
      appCode.includes('selectCustomRouteStop') &&
      appCode.includes('_syncChallengeScrubberState') &&
      cssSrc.includes('.prefecture-shape.is-traced') &&
      cssSrc.includes('#scrubber-dock.is-challenge-locked') &&
      cssSrc.includes('#journey-card.is-custom-route') &&
      cssSrc.includes('#act-github-star .star-mark') &&
      cssSrc.includes('#lbl-github-star') &&
      !cssSrc.includes('#lbl-music,\n  #act-github-star {'),
    'app.js & style.css must implement persistent trace onboarding (#2), traced prefecture highlight (#5), custom route control card (#3), challenge scrubber lock (#6), and icon-only mobile GitHub link'
  );
  const mockPrefNodes = [
    { dataset: { prefTitle: '黄州' }, classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } } },
    { dataset: { prefTitle: '江州' }, classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } } },
  ];
  ctrl.grpPrefectures = {
    querySelectorAll: () => mockPrefNodes,
  };
  const song1082Snap = snapshots[ctrl._resolveSnapKey(bsDyn, 1082)];
  ctrl.lastRenderedSnap = song1082Snap;
  ctrl.activeTrace = [114.88, 30.45]; // Huangzhou
  ctrl._syncTracedPrefecture();
  assert(
    mockPrefNodes[0].classList.contains('is-traced') && !mockPrefNodes[1].classList.contains('is-traced'),
    'Expected _syncTracedPrefecture to mark containing prefecture (黄州) with .is-traced'
  );
  ctrl.activeTrace = null;
  ctrl._syncTracedPrefecture();
  assert(
    !mockPrefNodes[0].classList.contains('is-traced'),
    'Expected _syncTracedPrefecture to clear .is-traced when activeTrace is null'
  );

  // 6) Genealogy heading "今 X" must assert identity, never a far-away neighbour (regression: 岳阳楼 -> "今赤壁")
  const nearestAcrossDynasties = (coord) => {
    let best = null;
    for (const d of dynasties) {
      for (const s of d.settlements || []) {
        const kmv = ctrl.projector.greatCircleKm(coord, s.coord);
        if (kmv < 160 && (!best || kmv < best.km)) best = { s, km: kmv };
      }
    }
    return best;
  };
  const yueyang = loreData.PLACE_GAZETTEER.find((g) => g.name === '岳阳楼');
  const yueyangNear = nearestAcrossDynasties(yueyang.coord);
  assert.strictEqual(
    ctrl._resolveModernIdentity(yueyang.coord[0], yueyang.coord[1], '岳阳楼', '湖南省', { s: { modern: '赤壁' }, km: 87 }),
    '岳阳',
    'Gazetteer landmark must use its own modern field (province prefix stripped), not a far neighbour'
  );
  assert.strictEqual(
    ctrl._resolveModernIdentity(yueyang.coord[0], yueyang.coord[1], '岳阳楼', '湖南省', yueyangNear),
    '岳阳',
    'Gazetteer landmark identity must be stable regardless of the nearest settlement'
  );
  assert.strictEqual(
    ctrl._resolveModernIdentity(yueyang.coord[0] + 1.2, yueyang.coord[1] + 0.9, '', '湖北省', { s: { modern: '赤壁' }, km: 87 }),
    '',
    'A settlement 87 km away must not be asserted as "今赤壁"'
  );
  assert.strictEqual(
    ctrl._resolveModernIdentity(0, 0, '', '陕西省', { s: { modern: '西安' }, km: 4 }),
    '西安',
    'A settlement within 25 km is a valid identity'
  );
  for (const g of loreData.PLACE_GAZETTEER) {
    const near = nearestAcrossDynasties(g.coord);
    const identity = ctrl._resolveModernIdentity(g.coord[0], g.coord[1], g.name, '', near);
    const gm = String(g.modern || '');
    assert(
      !identity || gm.includes(identity) || identity.includes(gm.slice(-2)),
      `Heading identity for ${g.name} must derive from its gazetteer modern "${gm}", got "${identity}"`
    );
  }

  // CUJ 17: Historical coups & political turning points across dynasties discoverable via Quick Search
  const expectedCoups = [
    ['沙丘政变', 'qin', -210],
    ['巫蛊之祸', 'xihan', -91],
    ['霍光', 'xihan', -74],
    ['永元之隆', 'donghan', 92],
    ['甘露之变', 'sanguo', 260],
    ['曹髦', 'sanguo', 260],
    ['王敦之乱', 'dongjin', 322],
    ['桓玄', 'dongjin', 404],
    ['景龙政变', 'tang', 707],
    ['唐隆政变', 'tang', 710],
    ['先天政变', 'tang', 713],
    ['马嵬驿兵变', 'tang', 756],
    ['永贞内禅', 'tang', 805],
    ['甘露之变', 'tang', 835],
    ['兴教门之变', 'wudai', 926],
    ['斧声烛影', 'beisong', 976],
    ['苗刘兵变', 'nansong', 1129],
    ['绍熙内禅', 'nansong', 1194],
    ['南坡之变', 'yuan', 1323],
    ['夺门之变', 'ming', 1457],
    ['壬寅宫变', 'ming', 1542],
    ['辛酉政变', 'qing', 1861],
    ['戊戌政变', 'qing', 1898],
  ];
  for (const [kw, dynKey, yr] of expectedCoups) {
    const hits = ctrl._queryQuickSearch(kw);
    assert(
      hits.some((h) => h.dynasty && h.dynasty.key === dynKey && h.year === yr),
      `Expected quick search "${kw}" to match ${dynKey}:${yr}, got ${JSON.stringify(hits[0])}`
    );
  }

  // CUJ 18: UX Friction Polish — same-effective-year milestone stepping, balloon nav, genealogy camera preservation, and pre-rendered HTML sync
  assert(
    indexHtml.includes('value="-403"') &&
      indexHtml.includes('公元前403年 · 周威烈王二十三年') &&
      indexHtml.includes('周威烈王命韩、赵、魏为诸侯，三家分晋') &&
      appCode.includes('fromYearSync: true') &&
      appCode.includes('preserveGenealogyScroll'),
    'Expected index.html pre-rendered initial state to match -403 Warring States opening milestone and app.js to preserve genealogy camera/scroll'
  );
  ctrl.milestoneBalloon = {
    innerHTML: '',
    classList: { remove() {}, add() {}, contains() { return false; } },
    querySelector: () => null,
  };
  ctrl.grpMilestones = { querySelectorAll: () => [], classList: { contains: () => false } };
  ctrl._positionMilestoneBalloon = () => {};
  ctrl._syncMilestoneSelection = () => {};
  ctrl._highlightCurrentMilestone = () => {};
  ctrl.stopAutoplay = () => {};
  ctrl._animateCameraTo = () => {};
  ctrl.jumpToYear = function (y) {
    this.year = Math.max(this.minYear, Math.min(this.maxYear, Math.round(y)));
    this.dynastyIdx = this._findDynastyIndex(this.year);
    this._syncAutoMilestoneBalloon(this.dynasties[this.dynastyIdx]);
  };
  for (const dynKey of ['sanguo', 'sui', 'wudai', 'roc']) {
    const dynObj = dynasties.find((d) => d.key === dynKey);
    const ms = dynObj.milestones;
    const mPrev = ms[ms.length - 3];
    const mPenult = ms[ms.length - 2];
    const mFinal = ms[ms.length - 1];
    ctrl.activeJourney = null;
    ctrl.activeCustomRoute = null;
    ctrl.jumpToYear(mPrev.year);
    ctrl.openMilestoneBalloon(dynObj, mPrev);
    ctrl.stepTimelineNode(1);
    assert(
      ctrl.activeMilestone && ctrl.activeMilestone.milestone === mPenult,
      `Expected stepTimelineNode(1) from ${dynKey}:${mPrev.year} to reach penultimate milestone ${mPenult.year}, got ${ctrl.activeMilestone && ctrl.activeMilestone.milestone && ctrl.activeMilestone.milestone.year}`
    );
    ctrl.stepTimelineNode(1);
    assert(
      ctrl.activeMilestone && ctrl.activeMilestone.milestone === mFinal,
      `Expected stepTimelineNode(1) from ${dynKey}:${mPenult.year} to reach final milestone ${mFinal.year}, got ${ctrl.activeMilestone && ctrl.activeMilestone.milestone && ctrl.activeMilestone.milestone.year}`
    );
    assert(
      !ctrl.milestoneBalloon.innerHTML.includes('ep-prev') &&
        !ctrl.milestoneBalloon.innerHTML.includes('ep-next') &&
        ctrl.milestoneBalloon.innerHTML.includes('ep-close'),
      'Expected #milestone-balloon header to stay clean without moving-target .ep-prev / .ep-next stepper buttons'
    );
  }

  // CUJ 19: Complete Region/Prefecture Hydration & Transition Era Snapshots (Chu-Han, Gengshi/Chimei, Huang Chao & Late Tang Warlords)
  for (const [sk, snap] of Object.entries(snapshots)) {
    if (!snap || Array.isArray(snap) || sk === 's_prc') continue;
    assert(
      Array.isArray(snap.regions) && snap.regions.length > 0,
      `Snapshot ${sk} must have non-empty regions after _hydrateSnapshots(), got ${(snap.regions || []).length}`
    );
    assert(
      Array.isArray(snap.prefectures) && snap.prefectures.length >= 16,
      `Snapshot ${sk} must have >= 16 prefectures after _hydrateSnapshots(), got ${(snap.prefectures || []).length}`
    );
  }
  assert(
    snapshots.s_zhanguo_a.prefectures.length >= 28 &&
      snapshots.s_zhanguo_b.prefectures.length >= 33 &&
      snapshots.s_qin.prefectures.length >= 40 &&
      snapshots.s_xihan.prefectures.length >= 50 &&
      snapshots.s_donghan.prefectures.length >= 48,
    'Warring States, Qin, and Han snapshots must provide full nationwide commandery (郡) coverage in prefectures'
  );
  const xihanDyn = dynasties.find((d) => d.key === 'xihan');
  assert.strictEqual(ctrl._resolveSnapKey(qinDyn, -204), 's_qin_chuhan', 'Qin at -204 BCE must resolve to s_qin_chuhan');
  assert(
    snapshots.s_qin_chuhan.polities.some((p) => p.title === '汉（刘邦）') &&
      snapshots.s_qin_chuhan.polities.some((p) => p.title === '西楚（项羽）'),
    's_qin_chuhan must map both Han (Liu Bang) and Western Chu (Xiang Yu)'
  );
  assert.strictEqual(ctrl._resolveSnapKey(xihanDyn, 24), 's_xihan_e', 'Western Han at 24 CE must resolve to s_xihan_e');
  assert(
    snapshots.s_xihan_e.polities.some((p) => p.title === '更始（汉）') &&
      snapshots.s_xihan_e.polities.some((p) => p.title === '刘秀（河北）') &&
      snapshots.s_xihan_e.polities.some((p) => p.title === '赤眉军'),
    's_xihan_e must map Gengshi, Liu Xiu (Hebei), and Chimei Army'
  );
  assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 881), 's_tang_d1', 'Tang at 881 CE must resolve to s_tang_d1');
  assert(
    snapshots.s_tang_d1.polities.some((p) => p.title === '大齐（黄巢）'),
    's_tang_d1 must map Huang Chao Great Qi rival polity'
  );
  assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 895), 's_tang_d2', 'Tang at 895 CE must resolve to s_tang_d2');
  assert(
    snapshots.s_tang_d2.polities.some((p) => p.title === '宣武（朱温）') &&
      snapshots.s_tang_d2.polities.some((p) => p.title === '河东（李克用）') &&
      snapshots.s_tang_d2.polities.some((p) => p.title === '西川（王建）') &&
      snapshots.s_tang_d2.polities.some((p) => p.title === '淮南（杨行密）'),
    's_tang_d2 must map Late Tang regional warlords (Zhu Wen, Li Keyong, Wang Jian, Yang Xingmi)'
  );

  // CUJ 20: Ming-Qing Transition (1643-1644 Dashun & Daxi) & Early Qing Split (1661-1673 Koxinga Taiwan vs. 1673-1681 Three Feudatories)
  const mingDyn = dynasties.find((d) => d.key === 'ming');
  assert.strictEqual(ctrl._resolveSnapKey(mingDyn, 1642), 's_ming_c', 'Ming at 1642 CE must resolve to s_ming_c');
  assert.strictEqual(ctrl._resolveSnapKey(mingDyn, 1643), 's_ming_d', 'Ming at 1643 CE must resolve to s_ming_d');
  assert(
    snapshots.s_ming_d.polities.some((p) => p.title === '大顺（李自成）') &&
      snapshots.s_ming_d.polities.some((p) => p.title === '大西（张献忠）') &&
      snapshots.s_ming_d.polities.some((p) => p.title === '后金（1636 年起称清）'),
    's_ming_d must map Li Zicheng Dashun, Zhang Xianzhong Daxi, and Qing alongside Ming'
  );
  assert.strictEqual(ctrl._resolveSnapKey(qingDyn, 1650), 's_qing_a0', 'Qing at 1650 CE must resolve to s_qing_a0');
  assert.strictEqual(ctrl._resolveSnapKey(qingDyn, 1665), 's_qing_a1', 'Qing at 1665 CE must resolve to s_qing_a1');
  assert(
    snapshots.s_qing_a1.polities.some((p) => p.title === '清') &&
      snapshots.s_qing_a1.polities.some((p) => p.title === '郑氏台湾') &&
      !snapshots.s_qing_a1.polities.some((p) => p.title.includes('三藩')),
    's_qing_a1 (1661-1673) must map unified mainland Qing and Koxinga Taiwan prior to the Revolt of the Three Feudatories'
  );
  assert.strictEqual(ctrl._resolveSnapKey(qingDyn, 1675), 's_qing_a', 'Qing at 1675 CE must resolve to s_qing_a');
  const sanfanPolity = snapshots.s_qing_a.polities.find((p) => p.title === '吴周 · 三藩');
  const qingSanfanMain = snapshots.s_qing_a.polities.find((p) => p.title === '清');
  assert(
    sanfanPolity &&
      pointInShape(102.7, 25.0, sanfanPolity.shape) &&
      pointInShape(112.97, 28.2, sanfanPolity.shape) &&
      pointInShape(104.07, 30.67, sanfanPolity.shape) &&
      pointInShape(119.3, 26.08, sanfanPolity.shape) &&
      pointInShape(113.26, 23.13, sanfanPolity.shape) &&
      !pointInShape(102.7, 25.0, qingSanfanMain.shape) &&
      !pointInShape(112.97, 28.2, qingSanfanMain.shape) &&
      !pointInShape(104.07, 30.67, qingSanfanMain.shape) &&
      !pointInShape(119.3, 26.08, qingSanfanMain.shape),
    's_qing_a (1673-1681) must map Wu Zhou & Three Feudatories across Yunnan, Guizhou, Sichuan, Hunan, Guangxi, Guangdong, and Fujian with zero overlap against Qing'
  );

  // CUJ 21: Mobile vs. Desktop Chronicle Toggle Synchronization (#act-toggle-pane & #act-mobile-chronicle)
  const mockToggleBtn = {
    innerHTML: '',
    title: '',
    isCollapsed: false,
    classList: {
      toggle(cls, val) {
        if (cls === 'is-collapsed') mockToggleBtn.isCollapsed = Boolean(val);
      }
    }
  };
  const mockMobBtn = {
    textContent: '',
    ariaExpanded: 'false',
    setAttribute(k, v) {
      if (k === 'aria-expanded') mockMobBtn.ariaExpanded = v;
    }
  };
  const mockBodyClasses = new Set(['is-pane-collapsed']);
  const mockWorkspaceBody = {
    classList: {
      remove(cls) {
        mockBodyClasses.delete(cls);
      },
      toggle(cls, val) {
        if (val) mockBodyClasses.add(cls);
        else mockBodyClasses.delete(cls);
      }
    }
  };
  const prevIdFn = ctrl._id;
  ctrl._id = (id) => {
    if (id === 'act-toggle-pane') return mockToggleBtn;
    if (id === 'act-mobile-chronicle') return mockMobBtn;
    if (id === 'workspace-body') return mockWorkspaceBody;
    return prevIdFn ? prevIdFn.call(ctrl, id) : null;
  };
  ctrl.closeMilestoneBalloon = () => {};
  ctrl.closeGenealogyCard = () => {};
  ctrl._updateScaleBar = () => {};
  ctrl.paneCollapsed = true;
  ctrl.mobileChronicleOpen = false;
  ctrl._isMobileViewport = () => true;
  ctrl._syncTogglePaneButton();
  assert(
    mockToggleBtn.isCollapsed === true && mockToggleBtn.innerHTML.includes('史志'),
    `Mobile #act-toggle-pane must show 史志 (collapsed) when mobileChronicleOpen is false, got ${mockToggleBtn.innerHTML}`
  );
  ctrl.toggleMobileChronicle(true);
  assert(
    ctrl.mobileChronicleOpen === true &&
      ctrl.paneCollapsed === false &&
      mockBodyClasses.has('is-mobile-chronicle-open') &&
      !mockBodyClasses.has('is-pane-collapsed') &&
      mockToggleBtn.isCollapsed === false &&
      mockToggleBtn.innerHTML.includes('全图') &&
      mockMobBtn.ariaExpanded === 'true',
    'Opening mobile chronicle must clear is-pane-collapsed, add is-mobile-chronicle-open, and flip #act-toggle-pane to 全图'
  );
  ctrl.toggleMobileChronicle(false);
  assert(
    ctrl.mobileChronicleOpen === false &&
      !mockBodyClasses.has('is-mobile-chronicle-open') &&
      mockToggleBtn.isCollapsed === true &&
      mockToggleBtn.innerHTML.includes('史志') &&
      mockMobBtn.ariaExpanded === 'false',
    'Closing mobile chronicle must remove is-mobile-chronicle-open and flip #act-toggle-pane back to 史志'
  );
  ctrl._id = prevIdFn;

  // CUJ 22: Complete English Dictionary Coverage, Boot Seed Parity & Non-Zero Oriented Fill Rule Guard
  assert(
    cssSrc.includes('.polity-shape') && /\.polity-shape\s*\{[\s\S]*?fill-rule:\s*nonzero;/m.test(cssSrc),
    'style.css .polity-shape must explicitly set fill-rule: nonzero with opposite outer/hole ring winding so overlapping MultiPolygon sub-polygons never cancel out'
  );
  const sampleRing = [[100, 30], [110, 30], [110, 40], [100, 40], [100, 30]];
  const outerOriented = ctrl.projector._orientRing(sampleRing, false);
  const holeOriented = ctrl.projector._orientRing(sampleRing, true);
  assert(
    outerOriented[1][0] !== holeOriented[1][0] || outerOriented[1][1] !== holeOriented[1][1],
    '_orientRing must orient outer rings and interior hole rings in opposite winding directions'
  );
  const enDict = (enLocale && enLocale.dict) || {};
  for (const [k, snap] of Object.entries(snapshots)) {
    if (!snap || Array.isArray(snap)) continue;
    for (const p of snap.polities || []) {
      assert(
        enDict[p.title],
        `Snapshot ${k} polity "${p.title}" is missing an English translation in EN_LOCALE.dict`
      );
    }
    for (const r of snap.regions || []) {
      assert(
        enDict[r.title],
        `Snapshot ${k} macro-region "${r.title}" is missing an English translation in EN_LOCALE.dict`
      );
    }
    for (const pref of snap.prefectures || []) {
      assert(
        enDict[pref.title],
        `Snapshot ${k} prefecture "${pref.title}" is missing an English translation in EN_LOCALE.dict`
      );
    }
  }
  for (const d of dynasties) {
    for (const st of d.settlements || []) {
      assert(
        enDict[st.ancient],
        `Dynasty ${d.key} settlement "${st.ancient}" ancient name is missing in EN_LOCALE.dict`
      );
      if (st.modern) {
        assert(
          enDict[st.modern],
          `Dynasty ${d.key} settlement "${st.ancient}" modern location "${st.modern}" is missing in EN_LOCALE.dict`
        );
      }
      if (st.remark) {
        assert(
          enDict[st.remark],
          `Dynasty ${d.key} settlement "${st.ancient}" remark "${st.remark}" is missing in EN_LOCALE.dict`
        );
      }
    }
  }
  assert.strictEqual(
    bootSnaps.s_qin_a.prefectures.length,
    snapshots.s_qin_a.prefectures.length,
    `atlas_boot.js s_qin_a prefecture count (${bootSnaps.s_qin_a.prefectures.length}) must match atlas_snapshots.js (${snapshots.s_qin_a.prefectures.length})`
  );

  // ── 23. CUJ 23: Regional Milestone, Landmark & Settlement Coverage ──
  const requiredMilestones = [
    ['xihan', -110],
    ['xihan', -61],
    ['donghan', 215],
    ['dongjin', 397],
    ['tang', 670],
    ['tang', 698],
    ['ming', 1413],
    ['qing', 1885],
  ];
  for (const [dk, yr] of requiredMilestones) {
    const dynObj = dynasties.find((x) => x.key === dk);
    assert(dynObj && dynObj.milestones.some((m) => m.year === yr), `Missing required milestone ${dk}:${yr}`);
  }
  const jintianEv = dynasties.find((x) => x.key === 'qing').milestones.find((m) => m.year === 1851);
  assert(jintianEv && Math.abs(jintianEv.coord[0] - 110.08) < 0.5 && Math.abs(jintianEv.coord[1] - 23.53) < 0.5, 'qing:1851 Jintian Uprising must be located at Guiping, Guangxi');
  const requiredLandmarks = [
    ['zhanguo', -375],
    ['zhanguo', -249],
    ['qin', -219],
    ['qin', -210],
    ['xihan', -195],
    ['xihan', -106],
    ['xihan', 4],
    ['xihan', 18],
    ['sanguo', 260],
    ['xijin', 307],
    ['nanbei', 540],
    ['wudai', 927],
    ['wudai', 952],
    ['beisong', 1004],
    ['beisong', 1008],
    ['beisong', 1032],
    ['beisong', 1053],
    ['nansong', 1276],
    ['ming', 1402],
    ['ming', 1600],
    ['qing', 1658],
    ['qing', 1662],
    ['qing', 1678],
    ['qing', 1684],
  ];
  for (const [dk, yr] of requiredLandmarks) {
    assert(
      loreData.PLACE_LANDMARK_EVENTS.some((ev) => ev.dynastyKey === dk && ev.year === yr),
      `Missing required PLACE_LANDMARK_EVENTS entry ${dk}:${yr}`
    );
  }
  for (const sk of ['s_ming', 's_ming_b']) {
    const mingPol = snapshots[sk].polities.find((p) => p.title === '明');
    assert(
      mingPol && mingPol.shape.type === 'MultiPolygon' && mingPol.shape.coordinates.length === 4,
      `${sk} Ming polity must have 4 disjoint sub-polygons (no duplicate overlapping mainland polygon)`
    );
    const jurchenPol = snapshots[sk].polities.find((p) => p.title === '女真诸部');
    assert(jurchenPol && jurchenPol.role === 'neighbor', `${sk} must include 女真诸部 neighbor polity in the Northeast`);
  }

  // Verify Western Regions Great Lakes (Lop Nur vanish 1972, labels, and gazetteer resolution)
  const lopNurLake = (sandbox.window.HYDRO_DATA.lakes || []).find((l) => l.name === 'Lop Nur');
  assert(
    lopNurLake && lopNurLake.rank === 2 && lopNurLake.vanish === 1972,
    `Lop Nur lake must have rank 2 and vanish 1972, got ${JSON.stringify(lopNurLake)}`
  );
  const lopNurLabel = (sandbox.window.HYDRO_DATA.labels || []).find((lb) => lb.zh === '蒲昌海·罗布泊');
  assert(
    lopNurLabel && lopNurLabel.vanish === 1972,
    `蒲昌海·罗布泊 hydro label must have vanish 1972, got ${JSON.stringify(lopNurLabel)}`
  );
  for (const westernLake of ['蒲昌海', '博斯腾湖', '热海', '夷播海', '居延海']) {
    const hit = ctrl.resolvePlace(westernLake, 741);
    assert(
      hit && hit.kind === 'gazetteer',
      `Expected Western Regions lake "${westernLake}" to resolve via PLACE_GAZETTEER, got ${JSON.stringify(hit)}`
    );
  }
  for (const culturalPlace of [
    '曲阜', '孔庙', '琅琊', '琅琊台', '景德镇', '昌南镇', '宁古塔',
    '潍坊', '密州', '广元', '利州', '忻州', '代州', '吴忠', '灵州', '阿克苏', '龟兹', '和田', '于阗',
    '牡丹江', '上京龙泉府', '通化', '国内城', '崇左', '太平府', '锡林郭勒', '元上都', '阿拉善', '黑水城',
    '眉山', '眉州', '上饶', '信州', '陇南', '武都',
    '淮安', '楚州', '温州', '永嘉', '嘉兴', '秀州', '金华', '婺州', '衢州', '丽水', '处州',
    '亳州', '谯郡', '黄山', '徽州', '阜阳', '颍州', '连云港', '海州', '南通', '盐城', '无锡',
    '南充', '阆中', '宜宾', '叙州', '乐山', '嘉州', '泸州', '达州', '凉山', '西昌',
    '抚州', '临川', '宜春', '袁州', '莆田', '兴化军', '荆门', '当阳', '随州', '十堰', '武当山',
    '邵阳', '宝庆府', '郴州', '怀化', '芷江', '韶关', '韶州', '肇庆', '端州', '湛江', '雷州',
    '茂名', '高州', '梧州', '北海', '合浦', '三亚', '崖州', '平凉', '庆阳', '保山', '永昌',
    '红河', '建水', '山南', '桑耶寺', '阿里', '古格',
  ]) {
    const hit = ctrl.resolvePlace(culturalPlace, 1076);
    assert(
      hit && Array.isArray(hit.coord) && hit.coord.length === 2,
      `Expected cultural/historical place "${culturalPlace}" to resolve with valid coordinates, got ${JSON.stringify(hit)}`
    );
  }
  const controlStripMatch = indexHtml.match(/<div class="control-strip"[\s\S]*?<\/div>\s*<div id="layers-popover"/);
  assert(
    controlStripMatch &&
      !controlStripMatch[0].includes('id="act-challenge"') &&
      indexHtml.includes('class="journey-quiz-section"') &&
      indexHtml.includes('id="lbl-jm-badge-quiz"'),
    '#act-challenge must be tucked inside #journey-popover (.journey-quiz-section), not in the top .control-strip'
  );
  assert(
    indexHtml.includes('id="scale-label-text">500 km</div>') &&
      !appCode.includes('_formatChineseLi'),
    'Expected #scale-label-text to use clean metric km format without _formatChineseLi'
  );

  // ── 24. CUJ 24: Place Genealogy (点地溯源) Full 18-Era Coverage to Present (PRC) & ROC/PRC City Resolution ──
  const yueyang2026 = ctrl.inspect({ year: 2026, place: '岳阳' });
  assert.strictEqual(yueyang2026.polity, '中华人民共和国', 'inspect(2026, 岳阳) must return polity 中华人民共和国');
  assert(
    Array.isArray(yueyang2026.regions) &&
      yueyang2026.regions.length === 1 &&
      yueyang2026.regions[0] === '湖南省' &&
      Array.isArray(yueyang2026.prefectures) &&
      yueyang2026.prefectures.includes('岳阳') &&
      yueyang2026.nearestCity &&
      yueyang2026.nearestCity.ancient === '岳阳' &&
      yueyang2026.nearestCity.distanceKm <= 10,
    `inspect(2026, 岳阳) must resolve 湖南省 · 岳阳 within <=10 km, got ${JSON.stringify(yueyang2026)}`
  );
  const yueyang1936 = ctrl.inspect({ year: 1936, place: '岳阳' });
  assert(
    yueyang1936.nearestCity &&
      yueyang1936.nearestCity.ancient === '岳阳' &&
      yueyang1936.nearestCity.distanceKm <= 10,
    `inspect(1936, 岳阳) in ROC must resolve local city 岳阳 (<=10 km) rather than Changsha (127 km), got ${JSON.stringify(yueyang1936.nearestCity)}`
  );
  assert(
    !String(ctrl.openGenealogyAt).includes("if (d.key === 'prc') continue;"),
    'openGenealogyAt must not skip d.key === "prc" so Place Genealogy covers all 18 eras up to the present day'
  );
  const mockTimelineItems = [];
  const mockHeadingEl = { textContent: '' };
  const mockSubEl = { innerHTML: '', textContent: '', querySelector: () => null };
  const mockCardEl = { classList: { remove() {}, add() {}, contains: () => false } };
  const mockListEl = {
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 500,
    offsetTop: 0,
    get children() {
      return mockTimelineItems;
    },
    set innerHTML(_v) {
      mockTimelineItems.length = 0;
    },
    appendChild(li) {
      mockTimelineItems.push(li);
    },
    querySelector: () => null,
  };
  const prevDoc = sandbox.document;
  sandbox.document = {
    createElement(tag) {
      return {
        tag,
        className: '',
        innerHTML: '',
        offsetTop: 0,
        offsetHeight: 28,
        classList: { add() {}, remove() {}, contains: () => false },
        querySelectorAll: () => [],
        addEventListener() {},
      };
    },
  };
  const prevIdForGen = ctrl._id;
  ctrl._id = (id) => {
    if (id === 'genealogy-heading') return mockHeadingEl;
    if (id === 'genealogy-sub') return mockSubEl;
    if (id === 'genealogy-card') return mockCardEl;
    if (id === 'genealogy-timeline') return mockListEl;
    return null;
  };
  ctrl.grpGenealogy = { innerHTML: '' };
  ctrl._dismissTraceOnboarding = () => {};
  ctrl._rescaleSvgTypography = () => {};
  ctrl._syncTracedPrefecture = () => {};
  ctrl._fullSnapshotsLoaded = true;
  ctrl.year = 2026;
  ctrl.dynastyIdx = 17;
  ctrl.openGenealogyAt(113.13, 29.36, null, { fromYearSync: true });
  assert.strictEqual(
    mockTimelineItems.length,
    18,
    `Expected openGenealogyAt to render all 18 dynasty rows including PRC, got ${mockTimelineItems.length}`
  );
  const rocRowHtml = mockTimelineItems[16].innerHTML;
  const prcRowHtml = mockTimelineItems[17].innerHTML;
  assert(
    rocRowHtml.includes('中华民国') && rocRowHtml.includes('邻近古城：岳阳（即此地）'),
    `Expected ROC row at Yueyang to resolve 邻近古城：岳阳（即此地）, got ${rocRowHtml}`
  );
  assert(
    prcRowHtml.includes('中华人民共和国') &&
      prcRowHtml.includes('湖南省 · 岳阳') &&
      prcRowHtml.includes('现代城市：岳阳（即此地）'),
    `Expected PRC row at Yueyang to display 湖南省 · 岳阳 and 现代城市：岳阳（即此地）, got ${prcRowHtml}`
  );
  ctrl.openGenealogyAt(112.24, 30.33, null, { fromYearSync: true });
  assert.strictEqual(mockTimelineItems.length, 18, 'Expected 18 rows at Jingzhou (江陵)');
  const jzQingHtml = mockTimelineItems[15].innerHTML;
  const jzRocHtml = mockTimelineItems[16].innerHTML;
  const jzPrcHtml = mockTimelineItems[17].innerHTML;
  assert(
    jzQingHtml.includes('荆州府') && !jzQingHtml.includes('宜昌府'),
    `Expected Qing row at Jingzhou not to show misleading 100 km neighbor 宜昌府, got ${jzQingHtml}`
  );
  assert(
    jzRocHtml.includes('邻近古城：荆州（即此地）') &&
      jzPrcHtml.includes('湖北省 · 荆州') &&
      jzPrcHtml.includes('现代城市：荆州（即此地）'),
    `Expected ROC and PRC rows at Jingzhou to resolve 荆州（即此地）, got ROC=${jzRocHtml} PRC=${jzPrcHtml}`
  );
  ctrl._id = prevIdForGen;
  sandbox.document = prevDoc;

  // 23b. Verify ROC & PRC modern settlement coverage and traced Tier-2 city visibility
  const rocDyn = dynasties.find((d) => d.key === 'roc');
  const prcDyn = dynasties.find((d) => d.key === 'prc');
  assert(
    rocDyn && rocDyn.settlements.length >= 205 && prcDyn && prcDyn.settlements.length >= 210,
    `Expected ROC (>=205) and PRC (>=210) to include propagated domestic historical cities, got ROC=${rocDyn && rocDyn.settlements.length}, PRC=${prcDyn && prcDyn.settlements.length}`
  );
  for (const modCity of ['淮安', '温州', '嘉兴', '金华', '衢州', '丽水', '亳州', '阜阳', '连云港', '南通', '盐城', '无锡', '宜宾', '乐山', '泸州', '达州', '抚州', '宜春', '莆田', '随州', '邵阳', '郴州', '韶关', '肇庆', '梧州', '崇左', '三亚', '平凉', '庆阳', '保山', '山南', '阿里', '潍坊·青州', '黄山·歙县', '南充·阆中', '凉山·西昌']) {
    assert(
      prcDyn.settlements.some((s) => s.modern === modCity) &&
        rocDyn.settlements.some((s) => s.modern === modCity),
      `Expected ${modCity} to be present on both ROC and PRC maps`
    );
  }
  assert(
    styleCss.includes('.settlement-node.is-tier2.is-trace-city') &&
      appCode.includes("node.classList.toggle('is-trace-city', isTraced)"),
    'style.css and app.js must keep traced Tier-2 cities visible (.is-trace-city)'
  );
  ctrl.dynastyIdx = 17;
  ctrl.year = 2026;
  ctrl.searchIndex = null;
  const wfHits = ctrl._queryQuickSearch('潍坊');
  assert(
    wfHits.length > 0 && wfHits[0].kind === 'city' && wfHits[0].dynasty.key === 'prc',
    `Expected searching "潍坊" in PRC era to rank PRC city entry first, got ${JSON.stringify(wfHits[0] && { kind: wfHits[0].kind, dyn: wfHits[0].dynasty && wfHits[0].dynasty.key, title: wfHits[0].titleZh })}`
  );

  // 23c. Verify deduplicated modern province boundary paths & PRC boundary styling
  const provBounds = ctrl._buildProvinceBoundaryPaths();
  assert(
    provBounds &&
      typeof provBounds.interior === 'string' &&
      provBounds.interior.length > 50000 &&
      typeof provBounds.outer === 'string' &&
      provBounds.outer.length > 35000 &&
      provBounds.combined === `${provBounds.interior}${provBounds.outer}`,
    `Expected _buildProvinceBoundaryPaths to return non-empty deduplicated interior and outer SVG paths, got interior=${provBounds && provBounds.interior && provBounds.interior.length} outer=${provBounds && provBounds.outer && provBounds.outer.length}`
  );
  assert.strictEqual(
    ctrl._buildProvinceBoundaryPaths(),
    provBounds,
    '_buildProvinceBoundaryPaths must return cached boundary object on subsequent calls'
  );
  assert(
    styleCss.includes('.province-boundary-casing') &&
      styleCss.includes('.province-boundary-interior') &&
      styleCss.includes('.province-boundary-outer') &&
      styleCss.includes('#atlas-svg[data-dynasty="prc"] .province-boundary-interior') &&
      styleCss.includes('#atlas-svg[data-dynasty="prc"] .province-boundary-outer') &&
      styleCss.includes('#grp-provinces.is-hidden .province-boundary-interior') &&
      appCode.includes('this.svg.dataset.dynasty = dynasty.key'),
    'style.css and app.js must style cased modern province boundaries across historical and PRC eras and hide them when #grp-provinces.is-hidden is active'
  );

  const elapsed = (performance.now() - t0).toFixed(1);
  console.log(`✓ Jiangshan Atlas validation passed in ${elapsed} ms:`);
  console.log(`  - ${dynasties.length} dynasties, ${snapKeys.length} snapshots (${referencedSnaps.size} phase-linked), ${sweptYears} timeline years swept`);
  console.log(`  - ${decodedPolygons} historical polygons (${totalVertices.toLocaleString()} vertices) verified lossless & collision-free`);
  console.log(`  - ${provinces.length} modern provinces (${provRingCount} rings)`);
  console.log(`  - ${totalSettlements} ancient settlements & ${totalMilestones} historical milestones`);
  console.log(`  - ${loreData.HISTORICAL_JOURNEYS.length} journeys (${totalJourneyStops} bilingual stops), ${loreData.CHINESE_ERA_SPANS.length} era spans, ${loreData.PLACE_LANDMARK_EVENTS.length} landmark events & ${loreData.PLACE_GAZETTEER.length} gazetteer landmarks verified across 23 E2E CUJs`);
}

main();
