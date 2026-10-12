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

  // CUJ 9i: Quick Search (_queryQuickSearch) End-to-End Verification (Era Chinese Numerals, Cities, Passes, Events, Journeys)
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

  const elapsed = (performance.now() - t0).toFixed(1);
  console.log(`✓ Jiangshan Atlas validation passed in ${elapsed} ms:`);
  console.log(`  - ${dynasties.length} dynasties, ${snapKeys.length} snapshots (${referencedSnaps.size} phase-linked), ${sweptYears} timeline years swept`);
  console.log(`  - ${decodedPolygons} historical polygons (${totalVertices.toLocaleString()} vertices) verified lossless & collision-free`);
  console.log(`  - ${provinces.length} modern provinces (${provRingCount} rings)`);
  console.log(`  - ${totalSettlements} ancient settlements & ${totalMilestones} historical milestones`);
  console.log(`  - ${loreData.HISTORICAL_JOURNEYS.length} journeys (${totalJourneyStops} bilingual stops), ${loreData.CHINESE_ERA_SPANS.length} era spans, ${loreData.PLACE_LANDMARK_EVENTS.length} landmark events & ${loreData.PLACE_GAZETTEER.length} gazetteer landmarks verified across 11 E2E CUJs`);
}

main();
