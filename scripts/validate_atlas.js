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
    projector: {
      greatCircleKm(coordA, coordB) {
        const dLat = (coordB[1] - coordA[1]) * DEG_TO_RAD;
        const dLng = (coordB[0] - coordA[0]) * DEG_TO_RAD;
        const a =
          Math.sin(dLat * 0.5) ** 2 +
          Math.cos(coordA[1] * DEG_TO_RAD) *
            Math.cos(coordB[1] * DEG_TO_RAD) *
            Math.sin(dLng * 0.5) ** 2;
        return 12742 * Math.asin(Math.sqrt(a));
      },
    },
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

  // Verify index.html metadata sync and removal of unused diag-hatch pattern
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(!htmlSrc.includes('id="diag-hatch"'), 'index.html must not contain unused #diag-hatch pattern');
  assert(
    htmlSrc.includes('156幅') && htmlSrc.includes('788座') && htmlSrc.includes('363项'),
    'index.html SEO metadata must reflect 156 snapshots, 788 ancient cities, and 363 historical events'
  );

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
      cssSrc.includes('#journey-card.is-custom-route'),
    'app.js & style.css must implement persistent trace onboarding (#2), traced prefecture highlight (#5), custom route control card (#3), and challenge scrubber lock (#6)'
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

  const elapsed = (performance.now() - t0).toFixed(1);
  console.log(`✓ Jiangshan Atlas validation passed in ${elapsed} ms:`);
  console.log(`  - ${dynasties.length} dynasties, ${snapKeys.length} snapshots (${referencedSnaps.size} phase-linked), ${sweptYears} timeline years swept`);
  console.log(`  - ${decodedPolygons} historical polygons (${totalVertices.toLocaleString()} vertices) verified lossless & collision-free`);
  console.log(`  - ${provinces.length} modern provinces (${provRingCount} rings)`);
  console.log(`  - ${totalSettlements} ancient settlements & ${totalMilestones} historical milestones`);
  console.log(`  - ${loreData.HISTORICAL_JOURNEYS.length} journeys (${totalJourneyStops} bilingual stops), ${loreData.CHINESE_ERA_SPANS.length} era spans, ${loreData.PLACE_LANDMARK_EVENTS.length} landmark events & ${loreData.PLACE_GAZETTEER.length} gazetteer landmarks verified across 16 E2E CUJs`);
}

main();
