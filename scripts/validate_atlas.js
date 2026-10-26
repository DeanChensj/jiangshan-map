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
    'zh_hant.js',
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
      bootSnaps.s_qin_a &&
      JSON.stringify(bootSnaps.s_zhanguo_a) === JSON.stringify(snapshots.s_zhanguo_a) &&
      JSON.stringify(bootSnaps.s_qin_a) === JSON.stringify(snapshots.s_qin_a),
    'atlas_boot.js must provide neighbors, s_zhanguo_a, and s_qin_a identical to atlas_snapshots.js for instant first paint'
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
  const sitemapXml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const robotsTxt = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  assert(
    indexHtml.includes('href="https://deanchen.me/jiangshan-map/"') &&
      indexHtml.includes('"@type": "FAQPage"') &&
      sitemapXml.includes('<loc>https://deanchen.me/jiangshan-map/</loc>') &&
      robotsTxt.includes('User-agent: Baiduspider') &&
      robotsTxt.includes('User-agent: Bytespider') &&
      robotsTxt.includes('Sitemap: https://deanchen.me/jiangshan-map/sitemap.xml') &&
      !indexHtml.toLowerCase().includes('deanchensj.github.io') &&
      !sitemapXml.toLowerCase().includes('deanchensj.github.io') &&
      !robotsTxt.toLowerCase().includes('deanchensj.github.io') &&
      !appCode.toLowerCase().includes('deanchensj.github.io'),
    'SEO/GEO files (index.html, sitemap.xml, robots.txt, app.js) must canonicalize to https://deanchen.me/jiangshan-map/ and allow Baiduspider/Bytespider'
  );
  const topicsDir = path.join(ROOT, 'topics');
  assert(
    fs.existsSync(path.join(topicsDir, 'index.html')),
    'Missing topics/index.html static SEO directory page'
  );
  const expectedTopicFiles = [
    'index.html',
    ...dynasties.map((d) => `${d.key}.html`),
    ...loreData.HISTORICAL_JOURNEYS.map((j) => `journey-${j.key}.html`),
    'dufu-763.html',
    'sushi-exile.html',
    'wentianxiang-lingdingyang.html',
    'hanyu-languan.html',
    'shuihu-jiangzhou.html',
    'xinqiji-jingkou.html',
    'battle-changping.html',
    'battle-chibi.html',
    'battle-feishui.html',
  ];
  for (const tf of expectedTopicFiles) {
    const tfPath = path.join(topicsDir, tf);
    assert(fs.existsSync(tfPath), `Missing static SEO topic page: topics/${tf}`);
    const tfHtml = fs.readFileSync(tfPath, 'utf8');
    const expectedCanon = `https://deanchen.me/jiangshan-map/topics/${tf}`;
    assert(
      tfHtml.includes(`rel="canonical" href="${expectedCanon}"`) &&
        tfHtml.includes('application/ld+json') &&
        !tfHtml.toLowerCase().includes('deanchensj.github.io') &&
        !tfHtml.includes('undefined') &&
        !tfHtml.includes('NaN') &&
        !/\b(zhanguo|xihan|donghan|sanguo|xijin|dongjin|nanbei|wudai|beisong|nansong|roc|prc)\s+Historical/i.test(tfHtml) &&
        sitemapXml.includes(`<loc>${expectedCanon}</loc>`) &&
        indexHtml.includes(expectedCanon),
      `Static topic page topics/${tf} must have canonical ${expectedCanon}, JSON-LD, zero undefined/NaN, clean English naming, and be linked in sitemap.xml and index.html`
    );
  }
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
    origin: 'https://deanchen.me',
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
  ctrl._initTimelineBands();

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
    if (g.asciiAliases) {
      assert(
        g.asciiAliases.every((a) => /^[a-z]+$/.test(a)),
        `PLACE_GAZETTEER asciiAliases of ${g.name} must be lowercase ASCII: ${JSON.stringify(g.asciiAliases)}`
      );
      const searchHits = ctrl._queryQuickSearch(g.asciiAliases[0]);
      assert(
        searchHits.some((r) => r.kind === 'gazetteer' && r.titleZh === g.name),
        `Quick search must find ${g.name} via ASCII alias "${g.asciiAliases[0]}" (same alias source as resolvePlace)`
      );
    }
  }
  assert(
    !appCode.includes('gazetteerPinyin'),
    'ASCII gazetteer aliases must live only in PLACE_GAZETTEER[].asciiAliases, not in an inline app.js table'
  );

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
  const prcDynObj = dynasties.find((d) => d.key === 'prc');
  assert.strictEqual(ctrl.formatSpan(prcDynObj), '1949 —', 'PRC dynasty span must be open-ended (1949 —)');
  const prcSearchHit = ctrl._queryQuickSearch('中华人民共和国').find((h) => h.kind === 'dynasty' && h.dynasty.key === 'prc');
  assert(
    prcSearchHit && prcSearchHit.subZh.startsWith('1949—') && prcSearchHit.subEn.startsWith('1949 CE –'),
    `Expected PRC quick search subtitle to use open-ended 1949— / 1949 CE –, got ${JSON.stringify(prcSearchHit)}`
  );

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
  const personJourneySearch = ctrl._queryQuickSearch('苏轼');
  assert(
    personJourneySearch.some((item) => item.kind === 'person' && item.personKey === 'sushi') &&
      !personJourneySearch.some((item) => item.kind === 'journey'),
    'Quick search for "苏轼" must return unified person chronicle without duplicate journey entries'
  );
  const quizSearch = ctrl._queryQuickSearch('舆图寻址');
  assert(
    quizSearch.some((item) => item.kind === 'quiz'),
    'Quick search for "舆图寻址" must return the Map Pinpoint Quiz entry'
  );
  assert(
    appCode.includes('sr-showcase-row') &&
      appCode.includes('sr-cycle-btn') &&
      appCode.includes('sr-search-guide') &&
      appCode.includes('sr-chip-btn') &&
      !appCode.includes("head.className = 'sr-section-head'"),
    'Empty quick-search dropdown must render a single rotatable showcase row + search guide chips without bulky .sr-section-head banners'
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
    decodedCliOut.includes('URL: https://deanchen.me/jiangshan-map/?year=1079,1080,1094,1097&place=湖州,黄州,惠州,儋州'),
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
    { dyn: 'nanbei', year: 554, keyword: '西梁' },
    { dyn: 'sui', year: 587, keyword: '西梁' },
    { dyn: 'tang', year: 635, keyword: '吐谷浑' },
    { dyn: 'tang', year: 648, keyword: '王玄策' },
    { dyn: 'nansong', year: 1234, keyword: '端平入洛' },
    { dyn: 'yuan', year: 1288, keyword: '宣政院' },
    { dyn: 'qing', year: 1881, keyword: '伊犁' },
    { dyn: 'qing', year: 1898, keyword: '胶州湾' },
    { dyn: 'roc', year: 1916, keyword: '袁世凯' },
    { dyn: 'roc', year: 1920, keyword: '直皖战争' },
    { dyn: 'roc', year: 1924, keyword: '黄埔军校' },
    { dyn: 'roc', year: 1926, keyword: '北伐' },
    { dyn: 'roc', year: 1928, keyword: '北伐完成' },
    { dyn: 'roc', year: 1931, keyword: '九一八' },
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
        (lm.zh.match(/“/g) || []).length === (lm.zh.match(/”/g) || []).length &&
        (lm.zh.match(/《/g) || []).length === (lm.zh.match(/》/g) || []).length &&
        typeof lm.en === 'string' &&
        lm.en.trim().length >= 24 &&
        lm.en.trim().length <= 108 &&
        (lm.en.match(/“/g) || []).length === (lm.en.match(/”/g) || []).length &&
        !/[\u4e00-\u9fa5]/.test(lm.en) &&
        !/(?:^|\s)(a|an|the|and|or|to|of|in|on|at|by|for|with|from|as|into|is|was|are|were|where|whom|who|which|that|his|her|its|their|over|under|after|before|while)$/i.test(
          lm.en.trim()
        ),
      `Invalid, truncated, or out-of-bounds bilingual text in landmark event: ${JSON.stringify(lm)}`
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
    's_qin_b',
    's_qin',
    's_xihan_a',
    's_xihan_b1',
    's_xihan_b2',
    's_xihan_b3',
    's_xihan_b',
    's_donghan',
    's_sanguo',
    's_dongjin_a',
    's_dongjin_c',
    's_nanbei_b',
    's_nanbei_c',
    's_nanbei_d',
    's_nanbei_e',
    's_sui',
    's_tang_a5',
    's_wudai_a',
    's_beisong_b',
    's_nansong_a',
    's_yuan',
    's_ming_a',
    's_qing_d',
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
    changanHits.some((h) => h.kind === 'event' || h.kind === 'person'),
    'Expected deduplicated "长安" search dropdown to surface related events or figures'
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
  const readmeZhSrc = fs.readFileSync(path.join(ROOT, 'README_ZH.md'), 'utf8');
  const contributingSrc = fs.readFileSync(path.join(ROOT, 'CONTRIBUTING.md'), 'utf8');
  const contributingZhSrc = fs.readFileSync(path.join(ROOT, 'CONTRIBUTING_ZH.md'), 'utf8');
  assert(
    !readmeZhSrc.includes('点右上角的 **「开始挑战」**') &&
      !readmeZhSrc.includes('青史行迹 ▾') &&
      readmeZhSrc.includes('点人溯事') &&
      readmeZhSrc.includes('舆图寻址 · 古地名小试') &&
      readmeZhSrc.includes('href="README.md"') &&
      !readmeSrc.includes('Journeys ▾') &&
      readmeSrc.includes('Person Chronicles') &&
      readmeSrc.includes('Map Pinpoint · Ancient Place Quiz') &&
      readmeSrc.includes('href="README_ZH.md"') &&
      contributingSrc.includes('href="CONTRIBUTING_ZH.md"') &&
      contributingSrc.includes('lore_data.js') &&
      contributingZhSrc.includes('href="CONTRIBUTING.md"') &&
      contributingZhSrc.includes('lore_data.js') &&
      !readmeSrc.includes('&event=') &&
      !readmeZhSrc.includes('&event=') &&
      !appCode.includes("q.has('event')") &&
      !/\b\d{3}\s*(幅|座|处|条|桩|段)/.test(readmeZhSrc),
    'README.md, README_ZH.md, CONTRIBUTING.md, CONTRIBUTING_ZH.md, and app.js must cross-link between English and Chinese docs, reference lore_data.js, document unified Person Chronicles & search-box Quiz entry point, avoid redundant &event= query params, and avoid hardcoded 3-digit entity counts'
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
  for (let run = 0; run < 45; run++) {
    const deck = ctrl._buildChallengeDeck();
    assert.strictEqual(deck.length, 10, `Expected 10 questions in challenge deck, got ${deck.length}`);
    assert(
      deck.every((q, i) => i === 0 || deck[i - 1].tier <= q.tier) && deck[0].tier === 0,
      `Expected challenge deck to climb from entry to hard tiers, got ${deck.map((q) => q.tier).join(',')}`
    );
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
  assert(sawPassInDeck, 'Expected STRATEGIC_PASSES to appear in challenge decks across 45 runs');

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
  {
    let pannedCam = null;
    const prevAnim = ctrl._animateCameraTo;
    const prevCam = ctrl.camera;
    ctrl.camera = { x: 430, y: 225, w: 340, h: 422, zoom: 1000 / 340 };
    ctrl._animateCameraTo = (c) => {
      pannedCam = c;
    };
    assert.strictEqual(
      ctrl._ensureCoordInView([108.94, 34.26]),
      false,
      'Expected Chang’an to already lie inside default mobile camera'
    );
    assert.strictEqual(
      ctrl._ensureCoordInView([71.8, 40.7]),
      true,
      'Expected frontier milestone (Dayuan / Fergana) to trigger camera pan on mobile'
    );
    assert(pannedCam && pannedCam.x < 100, 'Expected mobile camera to pan west for frontier milestone');
    ctrl._animateCameraTo = prevAnim;
    ctrl.camera = prevCam;
  }

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
      indexHtml.includes(dynasties[0].summary) &&
      indexHtml.includes(dynasties[0].milestones[0].headline) &&
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
    ctrl.activePerson = null;
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
    const epPlaceMatch = ctrl.milestoneBalloon.innerHTML.match(/class="ep-place"[^>]*>([\s\S]*?)<\/button>/);
    assert(
      !epPlaceMatch || (!epPlaceMatch[1].includes('（') && !epPlaceMatch[1].includes('(')),
      `Milestone balloon .ep-place button in ${dynKey} must strip parenthetical clutter: ${epPlaceMatch && epPlaceMatch[1]}`
    );
    for (const m of ms) {
      assert(
        !/得胜堡互市|使节出海|天祚帝被俘|未央宫|玄武门|太极宫|大明宫|万岁殿|礼部贡院|紫禁城|南宫·奉天殿|贵州布政司|宣政院辖地|安东都护府|西域都护府|郑国渠|中山堂/.test(m.site || ''),
        `Milestone ${dynKey}:${m.year} site "${m.site}" must be a clean geographic place name, not an event/palace/office note`
      );
    }
  }

  // CUJ 19: Complete Region/Prefecture Hydration & Transition Era Snapshots (Chu-Han, Gengshi/Chimei, Huang Chao & Late Tang Warlords)
  for (const [sk, snap] of Object.entries(snapshots)) {
    if (!snap || Array.isArray(snap) || sk === 's_prc') continue;
    assert(
      Array.isArray(snap.regions) && snap.regions.length > 0,
      `Snapshot ${sk} must have non-empty regions after _hydrateSnapshots(), got ${(snap.regions || []).length}`
    );
    const minPref =
      sk === 's_zhanguo_a' || sk === 's_zhanguo_a2' || sk === 's_zhanguo_b0' || sk === 's_zhanguo_b1' ? 11 : 16;
    assert(
      Array.isArray(snap.prefectures) && snap.prefectures.length >= minPref,
      `Snapshot ${sk} must have >= ${minPref} prefectures after _hydrateSnapshots(), got ${(snap.prefectures || []).length}`
    );
  }
  assert(
    snapshots.s_zhanguo_a.prefectures.length === 11 &&
      snapshots.s_zhanguo_b0.prefectures.length === 13 &&
      snapshots.s_zhanguo_b.prefectures.length === 18 &&
      snapshots.s_zhanguo_c.prefectures.length === 21 &&
      snapshots.s_zhanguo_c2.prefectures.length === 22 &&
      snapshots.s_zhanguo_d.prefectures.length === 23 &&
      snapshots.s_zhanguo_e1.prefectures.length === 24 &&
      snapshots.s_zhanguo_e2.prefectures.length === 26 &&
      snapshots.s_zhanguo_e4.prefectures.length === 27 &&
      snapshots.s_zhanguo_e5.prefectures.length === 34 &&
      snapshots.s_qin_a.prefectures.length === 36 &&
      snapshots.s_qin_b.prefectures.length === 37 &&
      snapshots.s_qin.prefectures.length === 41 &&
      snapshots.s_xihan_b.prefectures.length >= 50 &&
      snapshots.s_donghan.prefectures.length >= 48,
    'Warring States, Qin, and Han snapshots must reflect chronological commandery (郡) progression including 薛郡'
  );
  // Regression guard: State of Lu (鲁) survives until -250 BCE, annexed by Chu in -249 BCE, becomes Qin 薛郡 in -223 BCE
  assert(
    snapshots.s_zhanguo_a.polities.some((p) => p.title === '鲁') &&
      snapshots.s_zhanguo_c.polities.some((p) => p.title === '鲁') &&
      !snapshots.s_zhanguo_c2.polities.some((p) => p.title === '鲁') &&
      pointInShape(116.99, 35.6, snapshots.s_zhanguo_c.polities.find((p) => p.title === '鲁').shape) &&
      pointInShape(116.99, 35.6, snapshots.s_zhanguo_c2.polities.find((p) => p.title === '楚').shape) &&
      pointInShape(116.99, 35.6, snapshots.s_zhanguo_e5.polities.find((p) => p.title === '秦').shape) &&
      snapshots.s_qin_a.prefectures.some((p) => p.title === '薛郡') &&
      loreData.PLACE_LANDMARK_EVENTS.some((ev) => ev.zh.includes('薛仁杲')) &&
      !loreData.PLACE_LANDMARK_EVENTS.some((ev) => ev.zh.includes('薛仁果')),
    'State of Lu (鲁) chronology (-403..-250 -> Chu -249 -> Qin 薛郡 -223) and 薛仁杲 spelling must hold'
  );
  for (const anachronistic of ['会稽郡', '鄣郡', '东海郡', '泗水郡']) {
    assert(
      !snapshots.s_zhanguo_a.prefectures.some((p) => p.title === anachronistic) &&
        !snapshots.s_zhanguo_a.regions.some((r) => r.title === anachronistic),
      `s_zhanguo_a (-403 BCE) must not split State of Yue with post-222 BCE Qin commandery ${anachronistic}`
    );
  }
  for (const qinSnapKey of ['s_zhanguo_e5', 's_qin_a', 's_qin_b', 's_qin', 's_qin_chuhan']) {
    const qSnap = snapshots[qinSnapKey];
    for (const cmdTitle of ['泗水郡', '东海郡', '鄣郡', '会稽郡']) {
      assert(
        qSnap.prefectures.some((p) => p.title === cmdTitle) &&
          qSnap.regions.some((r) => r.title === cmdTitle),
        `${qinSnapKey} must include ${cmdTitle} in both prefectures and regions`
      );
    }
    for (const southTitle of ['鄣郡', '会稽郡']) {
      const feat = qSnap.prefectures.find((p) => p.title === southTitle);
      const maxLat = Math.max(...feat.shape.coordinates[0].map((pt) => pt[1]));
      assert(
        maxLat <= 32.3,
        `${qinSnapKey} ${southTitle} must stay south of the Yangtze (maxLat <= 32.3°N), got ${maxLat}`
      );
    }
  }
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

  // CUJ 20: Ming-Qing Transition (1616-1636 Later Jin -> 1636-1643 Qing -> 1643-1644 Dashun & Daxi -> 1644-1645 Qing/Southern Ming/Dashun/Daxi -> 1645-1661 Southern Ming -> 1661-1662 Final Mainland Southern Ming & Ming-Zheng Taiwan -> 1662-1673 Ming-Zheng Taiwan)
  const mingDyn = dynasties.find((d) => d.key === 'ming');
  assert.strictEqual(ctrl._resolveSnapKey(mingDyn, 1620), 's_ming_c0', 'Ming at 1620 CE must resolve to s_ming_c0');
  assert(
    snapshots.s_ming_c0.polities.some((p) => p.title === '后金') &&
      !snapshots.s_ming_c0.polities.some((p) => p.title.includes('1636')),
    's_ming_c0 (1616-1636) must name the Northeast rival polity 后金'
  );
  assert.strictEqual(ctrl._resolveSnapKey(mingDyn, 1640), 's_ming_c', 'Ming at 1640 CE must resolve to s_ming_c');
  assert(
    snapshots.s_ming_c.polities.some((p) => p.title === '清') &&
      !snapshots.s_ming_c.polities.some((p) => p.title.includes('后金')),
    's_ming_c (1636-1643) must name the Northeast rival polity 清 after Hong Taiji proclaimed the Qing Empire in 1636'
  );
  assert.strictEqual(ctrl._resolveSnapKey(mingDyn, 1643), 's_ming_c2', 'Ming at 1643 CE must resolve to s_ming_c2');
  {
    const ming1643 = snapshots.s_ming_c2.polities.find((p) => p.title === '明');
    const dashun1643 = snapshots.s_ming_c2.polities.find((p) => p.title === '大顺（李自成）');
    const daxi1643 = snapshots.s_ming_c2.polities.find((p) => p.title === '大西（张献忠）');
    assert(
      ming1643 && pointInShape(116.401, 39.901, ming1643.shape) && pointInShape(104.071, 30.571, ming1643.shape),
      'In 1643 Beijing ([116.401, 39.901]) and Chengdu ([104.071, 30.571]) must still be inside 明'
    );
    assert(
      dashun1643 &&
        pointInShape(108.941, 34.341, dashun1643.shape) &&
        pointInShape(114.311, 34.801, dashun1643.shape) &&
        !pointInShape(108.941, 34.341, ming1643.shape),
      'In 1643 s_ming_c2 must map Li Zicheng (大顺（李自成）) in Shaanxi (Xi\'an) and Henan (Kaifeng)'
    );
    assert(
      daxi1643 &&
        pointInShape(114.311, 30.591, daxi1643.shape) &&
        pointInShape(112.941, 28.231, daxi1643.shape) &&
        !pointInShape(114.311, 30.591, ming1643.shape),
      'In 1643 s_ming_c2 must map Zhang Xianzhong (大西（张献忠）) in Wuchang and Changsha'
    );
  }
  assert.strictEqual(ctrl._resolveSnapKey(qingDyn, 1644), 's_qing_a00', 'Qing at 1644 CE must resolve to s_qing_a00');
  {
    const q1644 = snapshots.s_qing_a00.polities.find((p) => p.title === '清');
    const nm1644 = snapshots.s_qing_a00.polities.find((p) => p.title === '南明');
    const ds1644 = snapshots.s_qing_a00.polities.find((p) => p.title === '大顺（李自成）');
    const dx1644 = snapshots.s_qing_a00.polities.find((p) => p.title === '大西（张献忠）');
    assert(
      q1644 &&
        nm1644 &&
        ds1644 &&
        dx1644 &&
        pointInShape(116.401, 39.901, q1644.shape) &&
        !pointInShape(118.801, 32.061, q1644.shape) &&
        !pointInShape(113.261, 23.131, q1644.shape) &&
        pointInShape(118.801, 32.061, nm1644.shape) &&
        pointInShape(113.261, 23.131, nm1644.shape) &&
        pointInShape(108.941, 34.341, ds1644.shape) &&
        pointInShape(104.071, 30.571, dx1644.shape),
      'In 1644 s_qing_a00 must confine 清 to North/Northeast while 南明 holds Nanjing & Guangdong, 大顺 holds Xi\'an, and 大西 holds Chengdu'
    );
  }
  assert.strictEqual(ctrl._resolveSnapKey(qingDyn, 1650), 's_qing_a0', 'Qing at 1650 CE must resolve to s_qing_a0');
  assert.strictEqual(ctrl._resolveSnapKey(qingDyn, 1661), 's_qing_a0b', 'Qing at 1661 CE must resolve to s_qing_a0b');
  assert(
    snapshots.s_qing_a0b.polities.some((p) => p.title === '南明') &&
      snapshots.s_qing_a0b.polities.some((p) => p.title === '南明（明郑）'),
    'In 1661 s_qing_a0b must show both mainland 南明 (Yongli/Li Dingguo in western Yunnan) and 南明（明郑） in Taiwan'
  );
  assert.strictEqual(ctrl._resolveSnapKey(qingDyn, 1665), 's_qing_a1', 'Qing at 1665 CE must resolve to s_qing_a1');
  assert(
    snapshots.s_qing_a1.polities.some((p) => p.title === '清') &&
      snapshots.s_qing_a1.polities.some((p) => p.title === '南明（明郑）') &&
      !snapshots.s_qing_a1.polities.some((p) => p.title.includes('三藩')),
    's_qing_a1 (1662-1673) must map unified mainland Qing and Southern Ming Tungning Taiwan prior to the Revolt of the Three Feudatories'
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
  delete ctrl.closeMilestoneBalloon;
  delete ctrl.closeGenealogyCard;
  delete ctrl._updateScaleBar;

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
  // Verify non-anachronistic historical state translations
  assert.strictEqual(enDict['魏'], 'Wei', 'dict["魏"] must be "Wei", not anachronistic "Cao Wei"');
  assert.strictEqual(enDict['齐'], 'Qi', 'dict["齐"] must be "Qi", not anachronistic "Southern Qi"');
  assert.strictEqual(enDict['吴'], 'Wu', 'dict["吴"] must be "Wu", not anachronistic "Eastern Wu"');
  assert.strictEqual(enDict['韩'], 'Han', 'dict["韩"] must be "Han", not "Han (Warring States)"');
  assert.strictEqual(enDict['曹魏'], 'Cao Wei', 'dict["曹魏"] must be "Cao Wei"');
  assert.strictEqual(enDict['孙吴'], 'Eastern Wu', 'dict["孙吴"] must be "Eastern Wu"');
  assert.strictEqual(enDict['东吴'], 'Eastern Wu', 'dict["东吴"] must be "Eastern Wu"');
  assert.strictEqual(enDict['杨吴'], 'Yang Wu', 'dict["杨吴"] must be "Yang Wu"');
  assert.strictEqual(enDict['南齐'], 'Southern Qi', 'dict["南齐"] must be "Southern Qi"');
  assert.strictEqual(enDict['刘宋'], 'Liu Song', 'dict["刘宋"] must be "Liu Song"');
  assert.strictEqual(enDict['南梁'], 'Southern Liang', 'dict["南梁"] must be "Southern Liang"');
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
    ['donghan', 89],
    ['donghan', 91],
    ['donghan', 107],
    ['donghan', 177],
    ['nanbei', 552],
    ['nanbei', 580],
    ['yuan', 1313],
    ['yuan', 1354],
    ['yuan', 1358],
    ['qing', 1645],
    ['qing', 1729],
    ['qing', 1757],
    ['qing', 1826],
    ['qing', 1842],
    ['qing', 1865],
    ['qing', 1887],
    ['qing', 1905],
  ];
  for (const [dk, yr] of requiredMilestones) {
    const dynObj = dynasties.find((x) => x.key === dk);
    assert(dynObj && dynObj.milestones.some((m) => m.year === yr), `Missing required milestone ${dk}:${yr}`);
  }
  const donghanMs = dynasties.find((x) => x.key === 'donghan').milestones;
  assert(
    donghanMs.find((m) => m.year === 89).headline.includes('燕然') &&
      donghanMs.find((m) => m.year === 91).headline.includes('金微山'),
    'donghan: 燕然勒石 must be dated 89 CE and 91 CE must be the Battle of Mt. Jinwei'
  );
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
    ['donghan', 166],
    ['donghan', 207],
    ['nanbei', 460],
    ['nanbei', 523],
    ['nanbei', 546],
    ['yuan', 1281],
    ['yuan', 1346],
    ['yuan', 1352],
    ['qing', 1776],
    ['qing', 1793],
    ['qing', 1842],
    ['qing', 1884],
    ['qing', 1895],
  ];
  for (const [dk, yr] of requiredLandmarks) {
    assert(
      loreData.PLACE_LANDMARK_EVENTS.some((ev) => ev.dynastyKey === dk && ev.year === yr),
      `Missing required PLACE_LANDMARK_EVENTS entry ${dk}:${yr}`
    );
  }
  for (const sk of ['s_ming_b']) {
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
    '红河', '建水', '山南', '桑耶寺', '阿里', '古格', '烟台', '登州', '芝罘', '龙岩', '汀州', '三明', '宁化', '武川镇', '怀朔镇',
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
      !controlStripMatch[0].includes('id="act-journey-menu"') &&
      !indexHtml.includes('id="journey-popover"') &&
      appCode.includes('sr-quiz-link'),
    '.control-strip must stay minimal without #act-journey-menu or #act-challenge, and Quiz must mount cleanly in the search box dropdown'
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
  const mockLoreEl = {
    innerHTML: '',
    isHidden: true,
    classList: {
      remove(c) {
        if (c === 'is-hidden') mockLoreEl.isHidden = false;
      },
      add(c) {
        if (c === 'is-hidden') mockLoreEl.isHidden = true;
      },
      contains(c) {
        return c === 'is-hidden' ? mockLoreEl.isHidden : false;
      },
    },
  };
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
    if (id === 'genealogy-lore') return mockLoreEl;
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
  assert(
    !mockLoreEl.isHidden &&
      mockLoreEl.innerHTML.includes('名城形胜') &&
      mockLoreEl.innerHTML.includes('洞庭湖口 · 江湖锁钥'),
    `Expected #genealogy-lore at Yueyang to render curated city lore banner, got ${mockLoreEl.innerHTML}`
  );
  const tangRowHtml = mockTimelineItems[9].innerHTML;
  const rocRowHtml = mockTimelineItems[16].innerHTML;
  const prcRowHtml = mockTimelineItems[17].innerHTML;
  assert(
    tangRowHtml.includes('邻近古城：岳州（即此地）') &&
      tangRowHtml.includes('开元四年张说谪守岳州，始建岳阳楼'),
    `Expected Tang row at Yueyang to surface per-dynasty settlement remark 开元四年张说谪守岳州，始建岳阳楼, got ${tangRowHtml}`
  );
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
  assert(
    !mockLoreEl.isHidden &&
      mockLoreEl.innerHTML.includes('名城形胜') &&
      mockLoreEl.innerHTML.includes('荆楚雄都 · 江汉锁钥'),
    `Expected #genealogy-lore at Jingzhou to render curated city lore banner, got ${mockLoreEl.innerHTML}`
  );
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
  ctrl.openGenealogyAt(113.38, 31.69, null, { fromYearSync: true });
  assert(
    !mockLoreEl.isHidden &&
      mockLoreEl.innerHTML.includes('城池形胜') &&
      mockLoreEl.innerHTML.includes('曾侯乙墓'),
    `Expected #genealogy-lore at non-curated city Suizhou to render synthesized City Profile banner, got ${mockLoreEl.innerHTML}`
  );
  ctrl.openGenealogyAt(110.9, 34.64, null, { fromYearSync: true });
  assert(
    !mockLoreEl.isHidden &&
      mockLoreEl.innerHTML.includes('雄关形胜'),
    `Expected #genealogy-lore at Hangu Pass to render Strategic Pass banner, got ${mockLoreEl.innerHTML}`
  );
  const prevLocaleGen = ctrl.locale;
  ctrl.locale = 'en';
  for (const s of dynasties[0].settlements.concat(dynasties[9].settlements, dynasties[17].settlements)) {
    ctrl.openGenealogyAt(s.coord[0], s.coord[1], s.ancient, { fromYearSync: true });
    assert(
      mockHeadingEl.textContent && !/[\u4e00-\u9fa5]/.test(mockHeadingEl.textContent),
      `English genealogy-heading for ${s.ancient} contains CJK: "${mockHeadingEl.textContent}"`
    );
    assert(
      mockLoreEl.innerHTML && !/[\u4e00-\u9fa5]/.test(mockLoreEl.innerHTML),
      `English genealogy-lore for ${s.ancient} contains CJK: "${mockLoreEl.innerHTML}"`
    );
  }
  ctrl.locale = prevLocaleGen;
  ctrl._id = prevIdForGen;
  sandbox.document = prevDoc;

  // 23b. Verify ROC & PRC modern settlement coverage, zero compound/duplicate city names, and traced Tier-2 city visibility
  const rocDyn = dynasties.find((d) => d.key === 'roc');
  const prcDyn = dynasties.find((d) => d.key === 'prc');
  assert(
    rocDyn && rocDyn.settlements.length >= 180 && prcDyn && prcDyn.settlements.length >= 185,
    `Expected ROC (>=180) and PRC (>=185) to include deduplicated modern cities, got ROC=${rocDyn && rocDyn.settlements.length}, PRC=${prcDyn && prcDyn.settlements.length}`
  );
  for (const modCity of ['淮安', '温州', '嘉兴', '金华', '衢州', '丽水', '亳州', '阜阳', '连云港', '南通', '盐城', '无锡', '宜宾', '乐山', '泸州', '达州', '抚州', '宜春', '莆田', '随州', '邵阳', '郴州', '韶关', '肇庆', '梧州', '崇左', '三亚', '平凉', '庆阳', '保山', '山南', '阿里', '潍坊', '黄山', '南充', '西昌', '马鞍山', '运城', '绵阳', '酒泉', '抚顺', '牡丹江', '济宁', '怀化', '北海', '锡林郭勒', '忻州', '吴忠', '通化', '湛江', '茂名', '红河', '张家口', '葫芦岛', '日喀则', '江门', '赤峰', '定西', '海东', '淮南', '驻马店', '南平', '宝鸡', '周口', '烟台', '龙岩', '三明']) {
    assert(
      prcDyn.settlements.some((s) => s.modern === modCity && s.ancient === modCity) &&
        rocDyn.settlements.some((s) => s.modern === modCity),
      `Expected clean city "${modCity}" to be present on both ROC and PRC maps`
    );
  }
  const bannedUnseparated = new Set([
    '南平建瓯', '南阳邓州', '周口淮阳', '呼和浩特托克托', '宝鸡凤翔', '张家口蔚县',
    '抚顺新宾', '济宁曲阜', '牡丹江海林', '石家庄平山', '绵阳三台', '葫芦岛兴城',
    '运城夏县', '运城永济', '邢台平乡', '邯郸临漳', '郑州荥阳', '酒泉瓜州',
    '青岛平度东南', '青岛黄岛', '马鞍山当涂',
  ]);
  for (const d of dynasties) {
    for (const s of d.settlements || []) {
      assert(
        !bannedUnseparated.has(s.modern) && !bannedUnseparated.has(s.ancient),
        `Dynasty ${d.key} settlement "${s.ancient}" (modern="${s.modern}") must not use unseparated city+county compound name`
      );
    }
  }
  for (const modDyn of [rocDyn, prcDyn]) {
    const seenAnc = new Set();
    const seenMod = new Set();
    for (const s of modDyn.settlements) {
      assert(
        !s.ancient.includes('·') && !s.modern.includes('·'),
        `${modDyn.key} settlement "${s.ancient}" (modern="${s.modern}") must use a clean single city name without "·" compound`
      );
      assert(
        !seenAnc.has(s.ancient) && !seenMod.has(s.modern),
        `${modDyn.key} must not contain duplicate city "${s.ancient}" / "${s.modern}"`
      );
      seenAnc.add(s.ancient);
      seenMod.add(s.modern);
    }
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

  // 23d. Verify hovering in regions without secondary prefectures (e.g. Western Sichuan / 剑南道 in Tang) does not highlight the entire polity, non-PRC eras do not hover-highlight modern provinces, and canonical place registry unifies openGenealogyAt & _inspectCoord
  assert(
    !/\.polity-shape:hover\b/.test(styleCss) &&
      !/^\.province-shape:not\(\.maritime-dash\):hover\b/m.test(styleCss) &&
      styleCss.includes('#atlas-svg[data-dynasty="prc"] .province-shape:not(.maritime-dash):hover') &&
      styleCss.includes('#grp-polities.has-polity-focus .polity-shape.is-focused') &&
      appCode.includes('this.lastRenderedSnap.regions.find') &&
      appCode.includes('_getCanonicalPlaces()') &&
      appCode.includes('_resolveEraPlaceAt('),
    'style.css and app.js must scope province hover to PRC only, prevent whole-polity hover highlight, resolve macro-regions in inspectPointTooltip, and unify spatial resolution via _getCanonicalPlaces and _resolveEraPlaceAt'
  );
  const canonPlaces = ctrl._getCanonicalPlaces();
  assert(
    Array.isArray(canonPlaces) && canonPlaces.length >= 220 && ctrl._getCanonicalPlaces() === canonPlaces,
    `Expected cached _getCanonicalPlaces() to return >=220 canonical places, got ${canonPlaces && canonPlaces.length}`
  );

  // 23e. Verify autoplay aria-pressed state, timeline band button accessibility, SEO directory locale sync, and quick search cleanup
  assert(
    indexHtml.includes('aria-pressed="false"') &&
      indexHtml.includes('id="seo-atlas-directory" class="sr-only-seo" aria-hidden="true"') &&
      styleCss.includes('pointer-events: none !important;') &&
      appCode.includes('_updateAutoplayUi()') &&
      appCode.includes('_syncSeoDirectoryLocale()') &&
      appCode.includes('_clearQuickSearchInput()') &&
      appCode.includes("cell.setAttribute('role', 'button')"),
    'index.html, style.css, and app.js must include autoplay aria-pressed state, accessible timeline band buttons, SEO directory locale sync, and quick search cleanup'
  );
  const mockSeoNav = {
    innerHTML: '<h2>江山时序</h2>',
    dataset: {},
    setAttribute(k, v) {
      this[k] = v;
    },
  };
  const mockSearchInp = {
    value: "Chang'an",
    blurred: false,
    blur() {
      this.blurred = true;
    },
  };
  const origId23e = ctrl._id;
  ctrl._id = (id) => {
    if (id === 'seo-atlas-directory') return mockSeoNav;
    if (id === 'inp-map-search') return mockSearchInp;
    return origId23e ? origId23e.call(ctrl, id) : null;
  };
  ctrl.locale = 'en';
  ctrl._syncSeoDirectoryLocale();
  assert(
    mockSeoNav.dataset.locale === 'en' &&
      mockSeoNav.innerHTML.includes('Warring States Historical Map') &&
      mockSeoNav.innerHTML.includes("People's Republic of China Historical Map") &&
      !/[\u4e00-\u9fff]/.test(mockSeoNav.innerHTML),
    'In English mode, _syncSeoDirectoryLocale() must translate all 18 dynasty entries with zero remaining CJK characters'
  );
  ctrl.locale = 'zh';
  ctrl._syncSeoDirectoryLocale();
  assert.strictEqual(mockSeoNav.innerHTML, '<h2>江山时序</h2>', '_syncSeoDirectoryLocale() must restore Chinese HTML when switching back to zh');
  ctrl._clearQuickSearchInput();
  assert.strictEqual(mockSearchInp.value, '', '_clearQuickSearchInput() must clear #inp-map-search value');
  ctrl._id = origId23e;

  // 23f. Verify Dali (大理, 937–1253 CE), Nanzhao (南诏, 649–936 CE), and unified Tubo (吐蕃, 618–877 CE) vs fragmented Tibetan polities (吐蕃诸部, 880–1246 CE)
  const daliSnapKeys = [
    's_wudai_c0',
    's_wudai_c',
    's_wudai_c2',
    's_wudai_d',
    's_wudai_e',
    's_wudai_e1',
    's_wudai_e2',
    's_beisong_a0',
    's_beisong_a',
    's_beisong_a2',
    's_beisong_a3',
    's_beisong_a4',
    's_beisong_a5',
    's_beisong_b0',
    's_beisong_b',
    's_beisong_b1',
    's_beisong_b2',
    's_beisong_c',
    's_beisong_d',
    's_nansong_a0',
    's_nansong_a',
    's_nansong_b0',
    's_nansong_c',
    's_nansong_d',
    's_nansong_e',
  ];
  for (const sk of daliSnapKeys) {
    const daliPol = (snapshots[sk].polities || []).find((p) => p.title === '大理');
    assert(
      daliPol && daliPol.role === 'rival' && daliPol.tint === '#7a5c91',
      `${sk} must model 大理 as role="rival" with tint="#7a5c91"`
    );
    assert(
      pointInShape(100.271, 25.611, daliPol.shape),
      `${sk}: 大理 polygon must contain Dali capital ([100.271, 25.611])`
    );
  }
  for (const dk of ['wudai', 'beisong', 'nansong']) {
    const dynObj = dynasties.find((d) => d.key === dk);
    const daliSet = (dynObj.settlements || []).find((s) => s.ancient === '大理');
    assert(
      daliSet && (!daliSet.tier || daliSet.tier === 1),
      `${dk} must define 大理 capital as a Tier-1 settlement visible at default zoom`
    );
  }
  const tangSnapKeys = Object.keys(snapshots).filter((k) => k.startsWith('s_tang'));
  assert(tangSnapKeys.length === 18, `Expected 18 s_tang* snapshots, found ${tangSnapKeys.length}`);
  const unifiedTuboSnapKeys = tangSnapKeys.filter((k) => k !== 's_tang_d1' && k !== 's_tang_d2');
  for (const sk of unifiedTuboSnapKeys) {
    const tuboPol = (snapshots[sk].polities || []).find((p) => p.title === '吐蕃');
    assert(
      tuboPol && tuboPol.role === 'rival' && tuboPol.tint === '#a8583b',
      `${sk} must model unified 吐蕃 (618–877 CE) as role="rival" with tint="#a8583b"`
    );
    assert(
      pointInShape(91.111, 29.651, tuboPol.shape),
      `${sk}: 吐蕃 polygon must contain Luoxie/Lhasa capital ([91.111, 29.651])`
    );
  }
  const fragmentedTuboSnapKeys = [
    's_tang_d1',
    's_tang_d2',
    's_wudai_a',
    's_wudai_b1',
    's_wudai_b',
    's_wudai_b2',
    ...daliSnapKeys.filter((k) => k !== 's_nansong_e'),
  ];
  for (const sk of fragmentedTuboSnapKeys) {
    const fragPol = (snapshots[sk].polities || []).find((p) => p.title === '吐蕃诸部');
    assert(
      fragPol && fragPol.role === 'neighbor' && !fragPol.tint,
      `${sk} must model post-877 fragmented Tibet as uncolored 吐蕃诸部 (role="neighbor", tint=null)`
    );
  }
  const nzSnapKeys = [...tangSnapKeys];
  for (const sk of nzSnapKeys) {
    const nzPol = (snapshots[sk].polities || []).find((p) => p.title === '南诏');
    assert(
      nzPol && nzPol.role === 'rival' && nzPol.tint === '#7a5c91',
      `${sk} must model 南诏 as role="rival" with tint="#7a5c91"`
    );
    assert(
      pointInShape(100.161, 25.691, nzPol.shape),
      `${sk}: 南诏 polygon must contain Taihecheng/Dali capital ([100.161, 25.691])`
    );
    assert(
      pointInShape(102.68, 24.82, nzPol.shape),
      `${sk}: 南诏 polygon must contain Dianchi/Kunming ([102.68, 24.82])`
    );
  }
  const dchSnapKeys = ['s_wudai_a', 's_wudai_b1', 's_wudai_b', 's_wudai_b2'];
  for (const sk of dchSnapKeys) {
    const dchPol = (snapshots[sk].polities || []).find((p) => p.title === '大长和');
    assert(
      dchPol && dchPol.role === 'rival' && dchPol.tint === '#7a5c91',
      `${sk} must model post-902 Yunnan regime as 大长和 (role="rival", tint="#7a5c91")`
    );
    assert(
      pointInShape(100.161, 25.691, dchPol.shape),
      `${sk}: 大长和 polygon must contain Taihecheng/Dali capital ([100.161, 25.691])`
    );
    assert(
      pointInShape(102.68, 24.82, dchPol.shape),
      `${sk}: 大长和 polygon must contain Dianchi/Kunming ([102.68, 24.82])`
    );
  }
  // Verify Wudai (907-960 CE) territorial invariants against Old History of the Five Dynasties (《旧五代史》):
  // 1) Yang Wu (吴) holds Yangzhou ([119.42, 32.39]) and Shouzhou ([116.78, 32.58]) north to the Huai River in 907-936
  for (const sk of ['s_wudai_a', 's_wudai_b1', 's_wudai_b', 's_wudai_b2', 's_wudai_c0']) {
    const wuPol = (snapshots[sk].polities || []).find((p) => p.title === '吴');
    assert(
      wuPol && pointInShape(119.42, 32.39, wuPol.shape) && pointInShape(116.78, 32.58, wuPol.shape),
      `${sk}: 吴 polygon must contain Yangzhou ([119.42, 32.39]) and Shouzhou ([116.78, 32.58]) up to the Huai River`
    );
  }
  // 2) Sixteen Prefectures of Yanyun (Yingzhou [116.09, 38.44], Mozhou [116.10, 38.71], Shuozhou [112.43, 39.32]) in Khitan/Liao (936-958),
  //    then Yingzhou, Mozhou, Yizhou ([115.49, 39.35]), and Waqiao Pass ([116.08, 39.00]) recovered by Later Zhou in 959 (s_wudai_e2)
  for (const sk of ['s_wudai_c0', 's_wudai_c', 's_wudai_c2', 's_wudai_d', 's_wudai_e', 's_wudai_e1']) {
    const liaoPol = (snapshots[sk].polities || []).find((p) => p.title === '契丹' || p.title === '辽');
    assert(
      liaoPol &&
        pointInShape(116.09, 38.44, liaoPol.shape) &&
        pointInShape(116.1, 38.71, liaoPol.shape) &&
        pointInShape(112.43, 39.32, liaoPol.shape),
      `${sk}: ${liaoPol ? liaoPol.title : '契丹/辽'} must contain Yanyun prefectures Yingzhou, Mozhou, and Shuozhou`
    );
  }
  {
    const zhouE2 = (snapshots.s_wudai_e2.polities || []).find((p) => p.title === '后周');
    const liaoE2 = (snapshots.s_wudai_e2.polities || []).find((p) => p.title === '辽');
    assert(
      zhouE2 &&
        pointInShape(116.09, 38.44, zhouE2.shape) &&
        pointInShape(116.1, 38.71, zhouE2.shape) &&
        pointInShape(115.49, 39.35, zhouE2.shape) &&
        pointInShape(116.08, 39.0, zhouE2.shape) &&
        liaoE2 &&
        pointInShape(116.4, 39.9, liaoE2.shape),
      's_wudai_e2 (959 CE): 后周 must contain recovered Yingzhou, Mozhou, Yizhou, and Waqiao Pass while Youzhou remains in 辽'
    );
  }
  // 3) Datong Basin (Yunzhou [113.30, 40.08], Yingzhou [113.19, 39.55], Huanzhou [112.43, 39.57], Shuozhou [112.43, 39.32]) in Liao,
  //    while Daizhou ([112.95, 39.06]) and Taiyuan ([112.55, 37.87]) belong to Northern Han (北汉) in 951-960
  for (const sk of ['s_wudai_e', 's_wudai_e1', 's_wudai_e2']) {
    const liaoPol = (snapshots[sk].polities || []).find((p) => p.title === '辽');
    const bhPol = (snapshots[sk].polities || []).find((p) => p.title === '北汉');
    assert(
      liaoPol &&
        pointInShape(113.3, 40.08, liaoPol.shape) &&
        pointInShape(113.19, 39.55, liaoPol.shape) &&
        pointInShape(112.43, 39.57, liaoPol.shape) &&
        pointInShape(112.43, 39.32, liaoPol.shape) &&
        bhPol &&
        pointInShape(112.95, 39.06, bhPol.shape) &&
        pointInShape(112.55, 37.87, bhPol.shape),
      `${sk}: 辽 must hold Yun, Ying, Huan, Shuo north of Yanmen Pass while 北汉 holds Daizhou and Taiyuan`
    );
  }
  // 4) Fuzhou ([119.30, 26.08]) in Wuyue (吴越) vs Jianzhou ([118.32, 27.02]) in Southern Tang (南唐) after Fall of Min (945-960)
  for (const sk of ['s_wudai_c2', 's_wudai_d', 's_wudai_e', 's_wudai_e1', 's_wudai_e2']) {
    const wyPol = (snapshots[sk].polities || []).find((p) => p.title === '吴越');
    const ntPol = (snapshots[sk].polities || []).find((p) => p.title === '南唐');
    assert(
      wyPol &&
        pointInShape(119.3, 26.08, wyPol.shape) &&
        ntPol &&
        pointInShape(118.32, 27.02, ntPol.shape),
      `${sk}: 吴越 must contain Fuzhou ([119.30, 26.08]) while 南唐 contains Jianzhou ([118.32, 27.02])`
    );
  }
  const tangDynObj = dynasties.find((d) => d.key === 'tang');
  for (const capName of ['逻些', '太和城']) {
    const capSet = (tangDynObj.settlements || []).find((s) => s.ancient === capName);
    assert(
      capSet && (!capSet.tier || capSet.tier === 1),
      `tang must define ${capName} capital as a Tier-1 settlement visible at default zoom`
    );
  }
  function collectVertices(shape) {
    const s = new Set();
    const polys = shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        for (const [x, y] of ring) s.add(`${x.toFixed(2)},${y.toFixed(2)}`);
      }
    }
    return s;
  }
  for (const sk of [...nzSnapKeys, ...dchSnapKeys, ...daliSnapKeys]) {
    const pols = snapshots[sk].polities || [];
    const swPol = pols.find((p) => p.title === '南诏' || p.title === '大长和' || p.title === '大理');
    assert(swPol && swPol.shape, `${sk} must contain 南诏, 大长和, or 大理`);
    const swVerts = collectVertices(swPol.shape);
    const otherVerts = new Set();
    for (const p of pols) {
      if (p === swPol || !p.shape) continue;
      for (const v of collectVertices(p.shape)) otherVerts.add(v);
    }
    let sharedCount = 0;
    for (const v of swVerts) {
      if (otherVerts.has(v)) sharedCount++;
    }
    assert(
      sharedCount >= 5,
      `${sk}: ${swPol.title} must share contiguous boundary vertices with adjacent polities (found ${sharedCount})`
    );
  }

  // 23g. National Map Compliance Guard (Zangnan, Aksai Chin, Taiwan, Ten-Dash Line & ROC Tibet Unification)
  assert(
    !snapshots.neighbors.some((n) => n.title === '台湾地区') &&
      !bootSnaps.neighbors.some((n) => n.title === '台湾地区'),
    'snapshots.neighbors and bootSnaps.neighbors must not list 台湾地区 as a foreign neighbor'
  );
  assert(
    /\.province-shape\.maritime-dash\s*\{[\s\S]*?stroke:\s*rgba\(/m.test(styleCss) &&
      /\.province-shape\.maritime-dash\s*\{[\s\S]*?vector-effect:\s*non-scaling-stroke;/m.test(styleCss),
    'css/style.css .province-shape.maritime-dash must reinforce Ten-Dash Line (100000_JD) with explicit non-scaling stroke'
  );
  const complianceCheckPts = [
    ['达旺', 91.86, 27.58],
    ['山南南端', 92.5, 27.15],
    ['下苏班西里', 93.8, 27.6],
    ['墨脱南端', 95.33, 28.2],
    ['下察隅', 96.5, 28.1],
    ['阿克赛钦中', 79.8, 35.1],
    ['阿克赛钦西', 78.9, 34.7],
    ['阿克赛钦北', 79.4, 35.6],
  ];
  for (const [label, cx, cy] of [...complianceCheckPts, ['台湾', 120.99, 23.98]]) {
    for (const nb of snapshots.neighbors) {
      assert(
        !pointInShape(cx, cy, nb.shape),
        `Modern neighbor "${nb.title}" must not encroach on ${label} ([${cx}, ${cy}])`
      );
    }
  }
  const foreignSouthWest = new Set([
    '英属印度',
    '印度',
    '不丹',
    '尼泊尔',
    '克什米尔·拉达克',
    '莫卧儿帝国',
    '锡克（拉合尔）',
    '阿富汗',
    '浩罕汗国',
    '德里苏丹国',
    '缅甸',
  ]);
  for (const [sk, snap] of Object.entries(snapshots)) {
    if (!snap || Array.isArray(snap) || sk === 's_prc') continue;
    assert(
      !(snap.polities || []).some((p) => p.title === '西藏（噶厦）'),
      `${sk} must unify Tibet into 中华民国(main) rather than splitting 西藏（噶厦）`
    );
    for (const [label, cx, cy] of complianceCheckPts) {
      const polHits = (snap.polities || []).filter((p) => pointInShape(cx, cy, p.shape));
      const badForeign = polHits.filter((p) => foreignSouthWest.has(p.title));
      assert(
        polHits.length > 0 && badForeign.length === 0,
        `${sk}: ${label} ([${cx}, ${cy}]) must belong to a historical Chinese/Tibetan/Western Regions polity and zero foreign neighbors, got [${polHits.map((p) => `${p.title}(${p.role})`).join(', ')}]`
      );
    }
  }

  // 23h. Verify Western Liang (西梁, 554–587 CE) at Jiangling ([112.241, 30.331])
  const xiliangSnapKeys = ['s_nanbei_d3', 's_nanbei_e', 's_nanbei_e2', 's_nanbei_f', 's_sui_a'];
  for (const sk of xiliangSnapKeys) {
    const xlPol = (snapshots[sk].polities || []).find((p) => p.title === '西梁');
    assert(
      xlPol && xlPol.role === 'rival' && pointInShape(112.241, 30.331, xlPol.shape),
      `${sk} must model 西梁 (554–587 CE) as role="rival" containing Jiangling ([112.241, 30.331])`
    );
  }
  const liang553 = (snapshots.s_nanbei_d2.polities || []).find((p) => p.title === '梁');
  assert(
    liang553 && pointInShape(112.241, 30.331, liang553.shape),
    's_nanbei_d2 (553 CE) must keep Jiangling ([112.241, 30.331]) inside 梁 (Emperor Yuan of Liang) prior to 554 CE'
  );
  const sui587 = (snapshots.s_sui_a2.polities || []).find((p) => p.title === '隋');
  assert(
    sui587 &&
      pointInShape(112.241, 30.331, sui587.shape) &&
      !(snapshots.s_sui_a2.polities || []).some((p) => p.title === '西梁'),
    's_sui_a2 (587–589 CE) must merge Jiangling ([112.241, 30.331]) into 隋 after Emperor Wen abolishes Western Liang'
  );

  // 23i. Verify Ming Hexi Corridor (Jiayuguan & Xining) and contiguous Seven Guards West of Jiayuguan (哈密卫（关西七卫）)
  for (const sk of ['s_ming_a0', 's_ming_a', 's_ming_a2', 's_ming_b', 's_ming_c']) {
    const mingPol = (snapshots[sk].polities || []).find((p) => p.title === '明');
    assert(
      mingPol && pointInShape(98.291, 39.771, mingPol.shape) && pointInShape(101.78, 36.62, mingPol.shape),
      `${sk}: 明 polygon must contain Jiayuguan ([98.291, 39.771]) and Xining ([101.78, 36.62])`
    );
    const shanxiReg = (snapshots[sk].regions || []).find((r) => r.title === '陕西');
    assert(
      shanxiReg &&
        shanxiReg.shape.type === 'Polygon' &&
        pointInShape(98.291, 39.771, shanxiReg.shape) &&
        pointInShape(101.78, 36.62, shanxiReg.shape),
      `${sk}: 陕西 macro-region must be a single contiguous Polygon containing Jiayuguan ([98.291, 39.771]) and Xining ([101.78, 36.62])`
    );
  }
  for (const sk of ['s_ming_a', 's_ming_a2']) {
    const mingPol = (snapshots[sk].polities || []).find((p) => p.title === '明');
    const hamiPol = (snapshots[sk].polities || []).find((p) => p.title === '哈密卫（关西七卫）');
    const mongolPol = (snapshots[sk].polities || []).find((p) => p.title === '蒙古诸部 · 东察合台');
    assert(
      hamiPol &&
        hamiPol.role === 'protectorate' &&
        pointInShape(93.511, 42.821, hamiPol.shape) &&
        pointInShape(93.86, 40.35, hamiPol.shape) &&
        pointInShape(94.06, 39.93, hamiPol.shape) &&
        pointInShape(95.45, 40.0, hamiPol.shape),
      `${sk}: 哈密卫（关西七卫） must contain Hami ([93.511, 42.821]), Yumen Pass ([93.86, 40.35]), Yangguan ([94.06, 39.93]), and Handong ([95.45, 40.0])`
    );
    const mingVertSet = new Set(
      mingPol.shape.coordinates[0][0].map((pt) => `${pt[0].toFixed(2)},${pt[1].toFixed(2)}`)
    );
    const sharedWithMing = hamiPol.shape.coordinates[0].filter((pt) =>
      mingVertSet.has(`${pt[0].toFixed(2)},${pt[1].toFixed(2)}`)
    );
    assert(
      sharedWithMing.length >= 8,
      `${sk}: 哈密卫（关西七卫） must share at least 8 contiguous boundary vertices with 明 at Jiayuguan, found ${sharedWithMing.length}`
    );
    assert(
      mongolPol && !pointInShape(93.511, 42.821, mongolPol.shape),
      `${sk}: 蒙古诸部 · 东察合台 must not overlap Hami ([93.511, 42.821])`
    );
  }

  // 23j. Verify Warring States (zhanguo) phase transitions align with -323, -316, -306, -300, -296, -286, -278 milestones
  const zgDynRef = dynasties.find((d) => d.key === 'zhanguo');
  assert.strictEqual(ctrl._resolveSnapKey(zgDynRef, -323), 's_zhanguo_a2', 'zhanguo at -323 BCE must resolve to s_zhanguo_a2');
  assert(
    snapshots.s_zhanguo_a.polities.some((p) => p.title === '蜀') &&
      snapshots.s_zhanguo_a.polities.some((p) => p.title === '巴') &&
      snapshots.s_zhanguo_a.polities.some((p) => p.title === '宋') &&
      snapshots.s_zhanguo_a2.polities.some((p) => p.title === '蜀') &&
      snapshots.s_zhanguo_a2.polities.some((p) => p.title === '巴') &&
      snapshots.s_zhanguo_a2.polities.some((p) => p.title === '宋') &&
      snapshots.s_zhanguo_a2.polities.some((p) => p.title === '越') &&
      snapshots.s_zhanguo_a2.polities.some((p) => p.title === '中山') &&
      snapshots.s_zhanguo_a2.polities.some((p) => p.title === '义渠'),
    's_zhanguo_a & s_zhanguo_a2 (-403..-317 BCE, including -323 Five-State Accord) must keep 蜀, 巴, 宋, 越, 中山, and 义渠 independent'
  );
  assert.strictEqual(ctrl._resolveSnapKey(zgDynRef, -316), 's_zhanguo_b0', 'zhanguo at -316 BCE must resolve to s_zhanguo_b0');
  assert(
    !snapshots.s_zhanguo_b0.polities.some((p) => p.title === '蜀') &&
      !snapshots.s_zhanguo_b0.polities.some((p) => p.title === '巴') &&
      snapshots.s_zhanguo_b0.polities.some((p) => p.title === '宋') &&
      snapshots.s_zhanguo_b0.polities.some((p) => p.title === '越') &&
      snapshots.s_zhanguo_b0.polities.some((p) => p.title === '中山'),
    's_zhanguo_b0 (-316..-307 BCE) must annex 巴 & 蜀 into 秦 while keeping 宋, 越, and 中山 independent'
  );
  assert.strictEqual(ctrl._resolveSnapKey(zgDynRef, -306), 's_zhanguo_b1', 'zhanguo at -306 BCE must resolve to s_zhanguo_b1');
  assert(
    !snapshots.s_zhanguo_b1.polities.some((p) => p.title === '越') &&
      snapshots.s_zhanguo_b1.polities.some((p) => p.title === '宋') &&
      snapshots.s_zhanguo_b1.polities.some((p) => p.title === '中山'),
    's_zhanguo_b1 (-306..-301 BCE) must annex 越 into 楚 while keeping 宋 and 中山 independent'
  );
  assert.strictEqual(ctrl._resolveSnapKey(zgDynRef, -296), 's_zhanguo_b2', 'zhanguo at -296 BCE must resolve to s_zhanguo_b2');
  assert(
    !snapshots.s_zhanguo_b2.polities.some((p) => p.title === '中山') &&
      !snapshots.s_zhanguo_b2.polities.some((p) => p.title === '宋') &&
      pointInShape(112.201, 30.351, snapshots.s_zhanguo_b2.polities.find((p) => p.title === '楚').shape),
    's_zhanguo_b2 (-296..-279 BCE) must annex 中山 into 赵 and partition 宋 while keeping Yingdu ([112.201, 30.351]) inside 楚 prior to -278 BCE'
  );

  // 23k. Verify 100% pre-modern settlement remark coverage and curated CITY_LORE bilingual integrity
  for (const [k, v] of Object.entries(enLocale.dict || {})) {
    assert(
      !/[\u4e00-\u9fa5]/.test(String(v)),
      `English dictionary value for "${k}" contains untranslated CJK characters: "${v}"`
    );
  }
  for (const d of dynasties) {
    if (d.key === 'roc' || d.key === 'prc') continue;
    for (const s of d.settlements || []) {
      assert(
        typeof s.remark === 'string' && s.remark.trim().length > 0,
        `Pre-modern settlement ${d.key}:${s.ancient} (${s.modern}) must have a non-empty historical remark`
      );
    }
  }
  assert(
    Array.isArray(loreData.CITY_LORE) && loreData.CITY_LORE.length >= 87,
    `Expected >= 87 curated CITY_LORE entries in lore_data.js, got ${loreData.CITY_LORE && loreData.CITY_LORE.length}`
  );
  for (const cl of loreData.CITY_LORE) {
    assert(
      cl.modern &&
        Array.isArray(cl.coord) &&
        cl.coord.length === 2 &&
        typeof cl.tagZh === 'string' &&
        cl.tagZh.length >= 4 &&
        typeof cl.tagEn === 'string' &&
        cl.tagEn.length >= 6 &&
        !/[\u4e00-\u9fa5]/.test(cl.tagEn) &&
        typeof cl.descZh === 'string' &&
        cl.descZh.length >= 25 &&
        typeof cl.descEn === 'string' &&
        cl.descEn.length >= 40 &&
        !/[\u4e00-\u9fa5]/.test(cl.descEn),
      `Invalid or incomplete bilingual CITY_LORE entry for ${cl && cl.modern}`
    );
  }

  // 23l. Verify Sui & Tang frontier borders (Anxi/Beiting Tianshan, Anxi/Tubo Kunlun-Altun, Tang/Tubo Qilian-Hengduan, Tang/Nanzhao) are naturally curved & vertex-locked
  for (const sk of ['s_tang_a5', 's_tang_b0a', 's_tang_b0']) {
    const pols = snapshots[sk].polities;
    const findPol = (t) => pols.find((p) => p.title === t);
    const anxi = findPol('安西都护府');
    const beiting = findPol('北庭都护府');
    const tubo = findPol('吐蕃');
    const nanzhao = findPol('南诏');
    const tang = findPol('唐');
    assert(
      anxi && beiting && tubo && nanzhao && tang,
      `${sk} must contain 安西都护府, 北庭都护府, 吐蕃, 南诏, and 唐`
    );
    const ringOf = (p) =>
      p.shape.type === 'Polygon'
        ? p.shape.coordinates[0]
        : p.shape.coordinates.reduce((best, cur) => (cur[0].length > best.length ? cur[0] : best), []);
    const keySetOf = (p) => new Set(ringOf(p).map((pt) => `${pt[0].toFixed(2)},${pt[1].toFixed(2)}`));
    const anxiKeys = keySetOf(anxi);
    const beitingKeys = keySetOf(beiting);
    const tuboKeys = keySetOf(tubo);
    const nanzhaoKeys = keySetOf(nanzhao);
    const tangKeys = keySetOf(tang);

    const countShared = (setA, setB) => {
      let c = 0;
      for (const k of setA) if (setB.has(k)) c++;
      return c;
    };
    assert(
      countShared(anxiKeys, beitingKeys) >= 40,
      `${sk}: 安西都护府 and 北庭都护府 must share >= 40 curved Tianshan frontier vertices`
    );
    assert(
      countShared(anxiKeys, tuboKeys) >= 50,
      `${sk}: 安西都护府 and 吐蕃 must share >= 50 curved Kunlun-Altun frontier vertices`
    );
    assert(
      countShared(tangKeys, tuboKeys) >= 50,
      `${sk}: 唐 and 吐蕃 must share >= 50 curved Qilian-Minshan-Hengduan frontier vertices`
    );
    assert(
      countShared(tangKeys, nanzhaoKeys) >= 40,
      `${sk}: 唐 and 南诏 must share >= 40 curved Yunnan-Guangxi-Annan frontier vertices`
    );
    for (const p of [anxi, beiting, tubo, nanzhao, tang]) {
      const r = ringOf(p);
      assert(
        r.length >= 120,
        `${sk}: ${p.title} ring must have >= 120 curved vertices (got ${r.length})`
      );
    }
  }

  // 23m. Verify bilingual (ZH / EN / Pinyin) resolvePlace and inspect() city lore
  const changanRes = ctrl.resolvePlace("Chang'an", 741);
  assert(
    changanRes && changanRes.name.includes('长安'),
    `Expected resolvePlace("Chang'an", 741) to match 长安, got ${changanRes && changanRes.name}`
  );
  const changanUnspaced = ctrl.resolvePlace('Changan', 741);
  assert(
    changanUnspaced && changanUnspaced.name.includes('长安'),
    `Expected resolvePlace("Changan", 741) to match 长安, got ${changanUnspaced && changanUnspaced.name}`
  );
  const jinanFujian = ctrl.resolvePlace("Jin'an", 589);
  const jinanShandong = ctrl.resolvePlace('Jinan', 589);
  assert(
    jinanFujian && jinanFujian.name.includes('晋安') && jinanShandong && !jinanShandong.name.includes('晋安'),
    `Expected apostrophe-aware disambiguation between Jin'an (${jinanFujian && jinanFujian.name}) and Jinan (${jinanShandong && jinanShandong.name})`
  );
  const lantianRes = ctrl.resolvePlace('Lantian Pass', 819);
  assert(
    lantianRes && lantianRes.name === '蓝田关',
    `Expected resolvePlace("Lantian Pass", 819) to match 蓝田关, got ${lantianRes && lantianRes.name}`
  );
  const inspectChangan = ctrl.inspect({ year: 741, place: "Chang'an" });
  assert(
    inspectChangan &&
      inspectChangan.resolvedName === '长安' &&
      inspectChangan.lore &&
      inspectChangan.lore.tagEn &&
      inspectChangan.nearestCity &&
      inspectChangan.nearestCity.remark,
    'Expected inspect({ year: 741, place: "Chang\'an" }) to include resolvedName, lore, and nearestCity.remark'
  );

  // 23n. Verify Tang Fujian 5 prefectures (福、建、泉、漳、汀) and Song/Yuan/Ming/Qing clean prefecture names without stitched county labels
  const tangSettlementNames = new Set(
    (dynasties.find((d) => d.key === 'tang').settlements || []).map((s) => s.ancient)
  );
  for (const fjPref of ['福州', '建州', '泉州', '漳州', '汀州']) {
    assert(
      tangSettlementNames.has(fjPref),
      `Tang settlements must include Fujian prefecture "${fjPref}"`
    );
  }
  assert(
    !tangSettlementNames.has('沙县（宁化）') && !tangSettlementNames.has('龙岩（汀州）'),
    'Tang settlements must not contain stitched county labels "沙县（宁化）" or "龙岩（汀州）"'
  );
  for (const [dKey, expectedPrefs, bannedLabels] of [
    ['beisong', ['汀州', '南剑州'], ['汀州（龙岩）', '南剑州（尤溪）']],
    ['nansong', ['汀州', '南剑州'], ['汀州（龙岩）', '南剑州（尤溪）']],
    ['yuan', ['汀州路', '延平路'], ['汀州路（龙岩）']],
    ['ming', ['汀州府', '延平府'], ['汀州府（龙岩）', '沙县（永安）']],
    ['qing', ['延平府', '龙岩州'], ['永安（沙县）']],
  ]) {
    const names = new Set((dynasties.find((d) => d.key === dKey).settlements || []).map((s) => s.ancient));
    for (const ep of expectedPrefs) {
      assert(names.has(ep), `${dKey} settlements must include prefecture "${ep}"`);
    }
    for (const bl of bannedLabels) {
      assert(!names.has(bl), `${dKey} settlements must not include stitched/redundant label "${bl}"`);
    }
  }

  // 23o. Verify Ming Dynasty (s_ming*) natural curved polity borders & bilingual README preview asset parity
  for (const mingKey of ['s_ming_a0', 's_ming_a', 's_ming_a2', 's_ming_b', 's_ming_c']) {
    const mingSnap = snapshots[mingKey];
    assert(mingSnap, `Missing Ming snapshot ${mingKey}`);
    for (const pol of mingSnap.polities || []) {
      const polys = pol.shape.type === 'Polygon' ? [pol.shape.coordinates] : pol.shape.coordinates;
      for (const poly of polys) {
        const ring = poly[0] || [];
        for (let i = 0; i < ring.length - 1; i++) {
          const [x1, y1] = ring[i];
          const [x2, y2] = ring[i + 1];
          // Check all segments inside the Ming China frontier box [95.5°E..122°E, 26°N..46.5°N]
          if (x1 >= 95.5 && x1 <= 122 && x2 >= 95.5 && x2 <= 122 && y1 >= 26 && y1 <= 46.5 && y2 >= 26 && y2 <= 46.5) {
            const segDeg = Math.hypot(x2 - x1, y2 - y1);
            assert(
              segDeg <= 1.5,
              `${mingKey} polity "${pol.title}" contains artificial ruler-straight interior border segment [${x1},${y1}] -> [${x2},${y2}] (${segDeg.toFixed(2)}°)`
            );
          }
        }
      }
    }
  }
  for (const [enAsset, zhAsset] of [
    ['assets/preview_741_tang_trace_en.webp', 'assets/preview_741_tang_trace.webp'],
    ['assets/preview_1415_ming_yingtian_en.webp', 'assets/preview_1415_ming_yingtian.webp'],
    ['assets/preview_journey_sushi_en.webp', 'assets/preview_journey_sushi.webp'],
    ['assets/preview_quiz_challenge_en.webp', 'assets/preview_quiz_challenge.webp'],
  ]) {
    assert(readmeSrc.includes(enAsset), `README.md must reference English preview ${enAsset}`);
    assert(readmeZhSrc.includes(zhAsset), `README_ZH.md must reference Chinese preview ${zhAsset}`);
    assert(fs.existsSync(path.join(ROOT, enAsset)), `Missing preview asset file ${enAsset}`);
    assert(fs.existsSync(path.join(ROOT, zhAsset)), `Missing preview asset file ${zhAsset}`);
  }

  // 23p. Verify Republic of China Warlord Era (1916–1928) multi-faction snapshots (s_roc_a0, s_roc_w1..w4, s_roc_a)
  for (const [rk, expectedTitles] of [
    ['s_roc_a0', ['中华民国', '外蒙古（自治/苏控）']],
    ['s_roc_w1', ['北洋政府 · 皖系（段祺瑞）', '直系（冯国璋 · 曹锟）', '奉系（张作霖）', '护法军政府 · 西南各系', '晋系（阎锡山）', '西北诸马（甘宁青）', '新疆（杨增新）']],
    ['s_roc_w2', ['北洋政府 · 直系（曹锟 · 吴佩孚）', '奉系（张作霖）', '皖系（卢永祥 · 浙江）', '广州政府（孙中山）', '西南川滇黔桂各系', '晋系（阎锡山）', '西北诸马（甘宁青）', '新疆（杨增新）']],
    ['s_roc_w3', ['北洋政府 · 奉系（张作霖）', '五省联军（孙传芳）', '直系（吴佩孚）', '西北国民军（冯玉祥）', '广州国民政府（两广统一）', '川滇黔军阀（刘湘 · 唐继尧）', '晋系（阎锡山）', '新疆（杨增新）']],
    ['s_roc_w4', ['国民政府（北伐军与冯阎集团）', '安国军政府 · 奉系（张作霖）', '新疆（杨增新）']],
  ]) {
    const rs = snapshots[rk];
    assert(rs, `Missing ROC warlord snapshot ${rk}`);
    const titles = new Set((rs.polities || []).map((p) => p.title));
    for (const et of expectedTitles) {
      assert(titles.has(et), `${rk} must include warlord polity "${et}"`);
    }
  }

  // 23q. Mobile viewport UX & geometry guards (iPhone 13 Pro 390x664 portrait Person Chronicle + Cartographic Hairlines + Custom Route)
  assert(
    indexHtml.includes('id="genealogy-body" class="genealogy-body"') &&
      indexHtml.includes('id="act-expand-genealogy"') &&
      styleCss.includes('.genealogy-body {') &&
      styleCss.includes('.genealogy-body .genealogy-list {') &&
      styleCss.includes('.journey-track-thread {') &&
      styleCss.includes('.journey-track-focus {') &&
      styleCss.includes('.journey-chevron {') &&
      styleCss.includes('.person-ev-quote {') &&
      !styleCss.includes('journeyDashFlow') &&
      !styleCss.includes('max-height: 4.1em;') &&
      styleCss.includes('#workspace-body.is-pane-collapsed:not(.is-mobile-chronicle-open)'),
    'index.html and style.css must unify #genealogy-body scrolling, use non-invasive cartographic hairlines + chevrons without animated dashes, and preserve .person-ev-quote'
  );
  {
    const prevWinW = sandbox.window.innerWidth;
    const prevWinH = sandbox.window.innerHeight;
    const prevAnimCam = ctrl._animateCameraTo;
    const prevSvg = ctrl.svg;
    let capturedCam = null;
    sandbox.window.innerWidth = 390;
    sandbox.window.innerHeight = 664;
    ctrl.svg = {
      getBoundingClientRect: () => ({ top: 45, bottom: 584, left: 0, right: 390, width: 390, height: 539 }),
      querySelectorAll: () => [],
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      dataset: {},
    };
    const mockVfMobile = {
      getBoundingClientRect: () => ({ top: 45, bottom: 584, left: 0, right: 390, width: 390, height: 539 }),
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    };
    let sheetExpandedMock = false;
    const mockGenCardMobile = {
      getBoundingClientRect: () =>
        sheetExpandedMock
          ? { top: 260, bottom: 578, left: 8, right: 382, width: 374, height: 318 }
          : { top: 356, bottom: 578, left: 8, right: 382, width: 374, height: 222 },
      classList: {
        add() {},
        remove() {},
        toggle(cls, force) {
          if (cls === 'is-sheet-expanded') sheetExpandedMock = Boolean(force);
        },
        contains: (cls) => (cls === 'is-sheet-expanded' ? sheetExpandedMock : false),
      },
    };
    const origIdMobile = ctrl._id;
    ctrl._id = (id) => {
      if (id === 'viewport-frame') return mockVfMobile;
      if (id === 'genealogy-card') return mockGenCardMobile;
      return origIdMobile ? origIdMobile.call(ctrl, id) : null;
    };
    ctrl._animateCameraTo = (target) => {
      capturedCam = target;
      ctrl.camera = { ...target, zoom: 1000 / target.w };
    };
    for (const j of loreData.HISTORICAL_JOURNEYS) {
      assert(
        ctrl.openJourneyAsPerson(j.key, -1) && ctrl.activePerson && ctrl.activePerson.profile.key === j.key,
        `Expected openJourneyAsPerson("${j.key}", -1) to open unified Person Chronicle`
      );
      assert(
        ctrl.activePerson.events.some((ev) => Boolean(ev.quoteZh && ev.quoteEn)),
        `Expected Person Chronicle "${j.key}" to preserve bilingual quotes from HISTORICAL_JOURNEYS`
      );
      const missingStops = j.stops
        .map((st, sIdx) => (ctrl.activePerson.events.some((ev) => ev.journeyStopIdx === sIdx) ? null : `${st.year} ${st.ancientZh}`))
        .filter(Boolean);
      assert(
        !missingStops.length,
        `Expected Person Chronicle "${j.key}" to keep every curated journey stop, missing: ${missingStops.join('; ')}`
      );
      const visFrac = ctrl._getPersonVisibleTopFrac();
      assert(
        visFrac >= 0.5 && visFrac <= 0.65,
        `Expected mobile _getPersonVisibleTopFrac() in [0.5, 0.65], got ${visFrac}`
      );
      ctrl._framePersonOverview();
      assert(capturedCam, `Expected _framePersonOverview(${j.key}) to set camera`);
      const overviewCam = { ...capturedCam };
      for (const ev of ctrl.activePerson.events) {
        const [, sy] = ctrl.projector.toScreen(ev.coord[0], ev.coord[1]);
        const screenY = 45 + ((sy - overviewCam.y) / overviewCam.h) * 539;
        assert(
          screenY >= 52 && screenY <= 364,
          `Mobile overview of person "${j.key}" site "${ev.siteZh}" landed outside unobscured map window [52..364]: screenY=${screenY.toFixed(1)}`
        );
        ctrl._flyToPersonEvent(ev);
        const flyScreenY = 45 + ((sy - capturedCam.y) / capturedCam.h) * 539;
        assert(
          flyScreenY >= 140 && flyScreenY <= 260,
          `Mobile _flyToPersonEvent for "${j.key}" site "${ev.siteZh}" occluded or off-center: screenY=${flyScreenY.toFixed(1)}`
        );
      }
      assert(
        ctrl.openJourneyAsPerson(j.key, 2) &&
          ctrl.activePersonEventIdx >= 0 &&
          ctrl.activePerson.events[ctrl.activePersonEventIdx].journeyStopIdx === 2,
        `Expected openJourneyAsPerson("${j.key}", 2) to select curated stop #2 accurately`
      );
    }
    ctrl.closeGenealogyCard();
    ctrl._id = origIdMobile;
    ctrl._animateCameraTo = prevAnimCam;
    ctrl.svg = prevSvg;
    sandbox.window.innerWidth = prevWinW;
    sandbox.window.innerHeight = prevWinH;
    assert.strictEqual(
      typeof ctrl._journeyKeyForMilestone,
      'undefined',
      'Legacy _journeyKeyForMilestone helper must remain removed'
    );
    assert(
      !/展阅行迹|View Route/.test(fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8')),
      'Legacy 展阅行迹 / View Route buttons must not exist in js/app.js'
    );
  }

  // 23r. Person Chronicle Search (点人溯事) Dataset, Bilingual Parity, Dedup & Round-Trip Guard
  {
    assert(
      Array.isArray(loreData.PERSON_PROFILES) && loreData.PERSON_PROFILES.length >= 100,
      `Expected >=100 PERSON_PROFILES in lore_data.js, got ${loreData.PERSON_PROFILES && loreData.PERSON_PROFILES.length}`
    );
    ctrl.searchIndex = null;
    const sparseProfiles = [];
    for (const p of loreData.PERSON_PROFILES) {
      const evs = ctrl._collectPersonEvents(p);
      if (evs.length < 3) {
        sparseProfiles.push(`${p.key} (${p.zh}): ${evs.length} -> ${evs.map((e) => e.year + '@' + e.siteZh).join(' | ')}`);
      }
    }
    assert(
      sparseProfiles.length === 0,
      `Person profiles with <3 geo-dated events:\n${sparseProfiles.join('\n')}`
    );
    for (const p of loreData.PERSON_PROFILES) {
      const evs = ctrl._collectPersonEvents(p);
      assert(
        p.en && !/[\u4e00-\u9fff]/.test(p.en) && p.courtesyEn && !/[\u4e00-\u9fff]/.test(p.courtesyEn),
        `Person profile "${p.zh}" (${p.key}) must have clean English name & courtesyEn without CJK characters`
      );
      ctrl.locale = 'en';
      const spanEn = ctrl._formatPersonSpan(p.span, false);
      assert(
        !/BCE CE/.test(spanEn) && !/[\u4e00-\u9fff（—）]/.test(spanEn),
        `Broken English lifespan formatting for "${p.zh}": "${spanEn}"`
      );
      ctrl.locale = 'zh';
      for (let i = 0; i < evs.length; i++) {
        if (i > 0) {
          assert(
            evs[i].year >= evs[i - 1].year,
            `Events for "${p.zh}" must be sorted chronologically (${evs[i - 1].year} -> ${evs[i].year})`
          );
        }
        assert(
          evs[i].siteEn && !/[\u4e00-\u9fff]/.test(evs[i].siteEn),
          `Person "${p.zh}" event [${i}] (${evs[i].year}) has untranslated siteEn: "${evs[i].siteEn}" (zh="${evs[i].siteZh}")`
        );
        assert(
          evs[i].textEn && !/[\u4e00-\u9fff]/.test(evs[i].textEn),
          `Person "${p.zh}" event [${i}] (${evs[i].year}) has untranslated textEn: "${evs[i].textEn}"`
        );
      }
    }
    const aliasChecks = [
      ['刘彻', 'hanwudi'],
      ['汉武帝', 'hanwudi'],
      ['曹操', 'caocao'],
      ['Cao Cao', 'caocao'],
      ['孟德', 'caocao'],
      ['孔明', 'zhugeliang'],
      ['Kongming', 'zhugeliang'],
      ['杜甫', 'dufu'],
      ['子美', 'dufu'],
      ['东坡', 'sushi'],
      ['Su Shi', 'sushi'],
      ['Su Dongpo', 'sushi'],
      ['Mencius', 'mengzi'],
      ['Meng Ke', 'mengzi'],
      ['Zhao Kuangyin', 'zhaokuangyin'],
      ['Li Longji', 'tangxuanzong'],
      ['Koxinga', 'zhengchenggong'],
      ['Sun Yat-sen', 'sunzhongshan'],
      ['稼轩', 'xinqiji'],
      ['王守仁', 'wangyangming'],
    ];
    for (const [query, expectedKey] of aliasChecks) {
      const hits = ctrl._queryQuickSearch(query);
      assert(
        hits.length > 0 && hits[0].kind === 'person' && hits[0].personKey === expectedKey,
        `Expected top quick-search hit for "${query}" to be person "${expectedKey}", got ${JSON.stringify(hits[0])}`
      );
    }
    // Verify Deng Ai keeps both Yinping & Chengdu in 263 CE, and Zhao Kuangyin keeps both 960 & 961 without duplicate 960
    const dengEvs = ctrl._collectPersonEvents(loreData.PERSON_PROFILES.find((p) => p.key === 'dengai'));
    assert(
      dengEvs.filter((e) => e.year === 263).length === 2,
      `Expected Deng Ai to have 2 distinct 263 CE campaign events (Yinping -> Chengdu), got ${dengEvs.length}`
    );
    const zhaoEvs = ctrl._collectPersonEvents(
      loreData.PERSON_PROFILES.find((p) => p.key === 'zhaokuangyin')
    );
    assert(
      zhaoEvs.filter((e) => e.year === 960).length === 1 &&
        zhaoEvs.filter((e) => e.year === 961).length === 1,
      `Expected Zhao Kuangyin to have 1 event in 960 (Chenqiao) and 1 in 961 (Cup of Wine), got ${JSON.stringify(zhaoEvs.map((e) => e.year))}`
    );
  }

  // CUJ 24: Eastern Jin & Southern-Northern Dynasties Phased Zhou / Qiaozhou & Commandery Evolution
  {
    assert(
      snapshots.s_dongjin_c.regions.length >= 30 &&
        snapshots.s_dongjin_c.regions.length < snapshots.s_nanbei_b.regions.length &&
        snapshots.s_nanbei_b.regions.length >= 55 &&
        snapshots.s_nanbei_b.regions.length < snapshots.s_nanbei_c.regions.length &&
        snapshots.s_nanbei_c.regions.length < snapshots.s_nanbei_d.regions.length &&
        snapshots.s_nanbei_d.regions.length < snapshots.s_nanbei_e.regions.length,
      `Expected strictly increasing 5-stage Zhou subdivision across Eastern Jin -> Nanbeichao`
    );
    assert(
      snapshots.s_dongjin_c.prefectures.length >= 100 &&
        snapshots.s_dongjin_c.prefectures.length <= 115 &&
        snapshots.s_nanbei_b.prefectures.length >= 130 &&
        snapshots.s_nanbei_b.prefectures.length <= 150 &&
        !snapshots.s_dongjin_c.prefectures.some((p) => p.title === '毗陵典农校尉'),
      'Expected deduplicated North+South commanderies without Three Kingdoms anachronisms'
    );

    const spotCases = [
      [{ lng: 119.451, lat: 32.18, year: 383 }, '南徐州(侨州)', '南东海郡(侨郡)'],
      [{ lng: 119.451, lat: 32.18, year: 494 }, '南徐州(侨州)', '南东海郡(侨郡)'],
      [{ lng: 119.43, lat: 32.42, year: 494 }, '南兖州(侨州)', '广陵郡'],
      [{ lng: 119.43, lat: 32.42, year: 560 }, '吴州', '广陵郡'],
      [{ lng: 119.02, lat: 34.55, year: 494 }, '青冀二州(侨州)', '东海郡'],
      [{ lng: 119.02, lat: 34.55, year: 560 }, '海州', '东海郡'],
      [{ lng: 114.07, lat: 32.12, year: 494 }, '司州(侨州)', '义阳郡'],
      [{ lng: 114.07, lat: 32.12, year: 560 }, '申州', '义阳郡'],
      [{ lng: 112.121, lat: 32.011, year: 383 }, '雍州(侨州)', '襄阳郡'],
      [{ lng: 112.121, lat: 32.011, year: 494 }, '雍州(侨州)', '襄阳郡'],
      [{ lng: 112.121, lat: 32.011, year: 560 }, '襄州', '襄阳郡'],
      [{ lng: 114.311, lat: 30.591, year: 494 }, '郢州', '江夏郡'],
      [{ lng: 112.451, lat: 34.621, year: 494 }, '司州', '河南尹(郡)'],
      [{ lng: 112.451, lat: 34.621, year: 560 }, '洛州', '河南郡'],
      [{ lng: 114.391, lat: 36.101, year: 494 }, '相州', '魏郡'],
      [{ lng: 114.391, lat: 36.101, year: 560 }, '司州', '魏郡'],
      [{ lng: 113.301, lat: 40.081, year: 494 }, '恒州', '代郡'],
      [{ lng: 117.001, lat: 36.651, year: 494 }, '齐州', '济南郡'],
      [{ lng: 108.871, lat: 37.991, year: 383 }, '夏州', '朔方郡'],
      [{ lng: 108.871, lat: 37.991, year: 494 }, '夏州', '化政郡'],
      [{ lng: 110.29, lat: 25.27, year: 520 }, '桂州', '始安郡'],
      [{ lng: 109.5, lat: 31.02, year: 520 }, '信州', '巴东郡'],
      [{ lng: 119.3, lat: 26.08, year: 560 }, '闽州', '晋安郡'],
    ];
    for (const [opts, expReg, expPref] of spotCases) {
      const info = ctrl.inspect(opts);
      assert(
        info && info.regions.includes(expReg),
        `inspect(${JSON.stringify(opts)}) expected region "${expReg}", got ${JSON.stringify(info && info.regions)}`
      );
      assert(
        info && info.prefectures.includes(expPref),
        `inspect(${JSON.stringify(opts)}) expected commandery "${expPref}", got ${JSON.stringify(info && info.prefectures)}`
      );
    }

    const capturedNodes = [];
    ctrl._svgNode = (tag, attrs) => {
      const n = {
        tag,
        attrs,
        dataset: {},
        textContent: '',
        classList: { add() {}, remove() {}, contains: () => false },
        setAttribute() {},
        getAttribute: () => null,
        appendChild() {},
      };
      capturedNodes.push({ tag, attrs, n });
      return n;
    };
    const makeMockDomEl = () => {
      let htmlVal = '';
      const el = {
        textContent: '',
        dataset: {},
        style: {},
        scrollTop: 0,
        scrollHeight: 0,
        clientHeight: 400,
        offsetTop: 0,
        offsetHeight: 40,
        children: [],
        get innerHTML() {
          return htmlVal;
        },
        set innerHTML(v) {
          htmlVal = String(v);
          if (v === '') el.children.length = 0;
        },
        appendChild(c) {
          el.children.push(c);
          return c;
        },
        addEventListener() {},
        setAttribute() {},
        getAttribute: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      };
      return el;
    };
    const mockIds = new Map();
    const origId = ctrl._id.bind(ctrl);
    ctrl._id = (id) => {
      if (!mockIds.has(id)) mockIds.set(id, origId(id) || makeMockDomEl());
      return mockIds.get(id);
    };
    const origDoc = sandbox.document;
    sandbox.document = { createElement: () => makeMockDomEl() };
    ctrl.grpPolities = makeMockDomEl();
    ctrl.grpPrefectures = makeMockDomEl();
    ctrl.grpProvNames = makeMockDomEl();
    ctrl.mapKey = makeMockDomEl();
    ctrl.svg = makeMockDomEl();
    ctrl._renderLegendBox = () => {};
    ctrl._rescaleSvgTypography = () => {};

    const nbDynObj = dynasties.find((d) => d.key === 'nanbei');
    ctrl.locale = 'zh';
    capturedNodes.length = 0;
    ctrl.jumpToYear(494);
    ctrl._renderPolitiesAndPrefectures(nbDynObj, snapshots.s_nanbei_b);
    const zhQiaoCaps = capturedNodes
      .filter((x) => x.attrs && String(x.attrs.class || '').includes('is-qiaozhou'))
      .map((x) => x.n.textContent);
    assert(
      zhQiaoCaps.includes('南徐州·侨') && zhQiaoCaps.includes('雍州·侨') && zhQiaoCaps.includes('青冀二州·侨'),
      `Expected on-map ·侨 badges in ZH at 494 CE, got ${JSON.stringify(zhQiaoCaps)}`
    );
    ctrl.openGenealogyAt(112.121, 32.011, '襄阳');
    const zhGenHtml = ctrl._id('genealogy-timeline').children.map((c) => c.innerHTML).join('\n');
    assert(
      zhGenHtml.includes('雍州（侨州）'),
      `Expected 雍州（侨州） in ZH place genealogy at Xiangyang, got ${zhGenHtml.slice(0, 200)}`
    );

    ctrl.locale = 'en';
    capturedNodes.length = 0;
    ctrl.jumpToYear(494);
    ctrl._renderPolitiesAndPrefectures(nbDynObj, snapshots.s_nanbei_b);
    const enQiaoCaps = capturedNodes
      .filter((x) => x.attrs && String(x.attrs.class || '').includes('is-qiaozhou'))
      .map((x) => x.n.textContent);
    assert(
      enQiaoCaps.includes('Nanxu Zhou (Emigre)') && enQiaoCaps.includes('Yong Zhou (Emigre)'),
      `Expected on-map (Emigre) badges in EN at 494 CE, got ${JSON.stringify(enQiaoCaps)}`
    );
    ctrl.openGenealogyAt(112.121, 32.011, 'Xiangyang');
    const enGenHtml = ctrl._id('genealogy-timeline').children.map((c) => c.innerHTML).join('\n');
    assert(
      enGenHtml.includes('Yong Zhou (Emigre)'),
      `Expected Yong Zhou (Emigre) in EN place genealogy at Xiangyang, got ${enGenHtml.slice(0, 200)}`
    );
    sandbox.document = origDoc;
    ctrl._id = origId;
    ctrl.locale = 'zh';
  }

  // CUJ 25: Curated Popular Historical Milestones, City Cultural/Battle Landmarks & Strengthened Hero Trajectories (Ancient/Imperial Eras)
  {
    const expectedPopularMilestones = [
      ['zhanguo', -279, '火牛阵'],
      ['zhanguo', -257, '窃符救赵'],
      ['zhanguo', -246, '郑国渠'],
      ['qin', -214, '灵渠'],
      ['qin', -213, '焚书令'],
      ['qin', -203, '鸿沟'],
      ['xihan', -202, '垓下'],
      ['xihan', -134, '独尊儒术'],
      ['xihan', -127, '推恩令'],
      ['xihan', -91, '史记'],
      ['donghan', 207, '三顾茅庐'],
      ['donghan', 211, '潼关之战'],
      ['donghan', 215, '逍遥津'],
      ['sanguo', 223, '白帝城'],
      ['sanguo', 234, '司马懿'],
      ['dongjin', 353, '兰亭集序'],
      ['nanbei', 529, '陈庆之'],
      ['nanbei', 546, '玉壁之战'],
      ['nanbei', 548, '梁武帝'],
      ['sui', 605, '科举制'],
      ['tang', 645, '玄奘'],
      ['tang', 663, '白江口'],
      ['beisong', 1041, '好水川'],
      ['beisong', 1121, '方腊'],
      ['nansong', 1207, '开禧北伐'],
      ['nansong', 1247, '凉州会盟'],
      ['yuan', 1368, '大都'],
      ['ming', 1393, '蓝玉案'],
      ['ming', 1402, '靖难'],
      ['ming', 1626, '宁远大捷'],
      ['qing', 1669, '鳌拜'],
      ['qing', 1793, '马戛尔尼'],
      ['qing', 1799, '和珅'],
      ['qing', 1856, '天京事变'],
      ['qing', 1860, '圆明园'],
      ['qing', 1894, '邓世昌'],
    ];
    for (const [dynKey, yr, kw] of expectedPopularMilestones) {
      const d = dynasties.find((x) => x.key === dynKey);
      const m = d && d.milestones.find((x) => x.year === yr);
      assert(m && m.headline.includes(kw), `Missing expected milestone ${dynKey}:${yr} containing "${kw}"`);
      const enEntry = enLocale.milestones[`${dynKey}:${yr}`];
      assert(
        Array.isArray(enEntry) && enEntry[0].length >= 24 && !/[\u4e00-\u9fa5]/.test(enEntry[0]),
        `Missing or invalid English milestone translation for ${dynKey}:${yr}`
      );
      const qHits = ctrl._queryQuickSearch(kw);
      assert(
        qHits.some((h) => h.year === yr || (h.dynasty && h.dynasty.key === dynKey)),
        `Expected Quick Search "${kw}" to match ${dynKey}:${yr}`
      );
    }

    const expectedCityGems = [
      ['邯郸', 'zhanguo', [114.48, 36.61], '负荆请罪', 'Lian Po'],
      ['易水', 'zhanguo', [115.50, 39.35], '易水寒', 'Jing Ke'],
      ['北海', 'xihan', [107.30, 53.30], '苏武', 'Su Wu'],
      ['洛阳(汉书)', 'donghan', [112.46, 34.63], '汉书', 'Ban Gu'],
      ['汝南(说文)', 'donghan', [114.12, 33.57], '说文解字', 'Xu Shen'],
      ['南阳(伤寒)', 'donghan', [112.53, 33.00], '伤寒杂病论', 'Zhang Zhongjing'],
      ['合肥', 'donghan', [117.28, 31.86], '逍遥津', 'Xiaoyao Ford'],
      ['洛阳(金谷)', 'xijin', [112.42, 34.66], '石崇', 'Golden Valley'],
      ['上海(华亭)', 'xijin', [121.23, 31.03], '华亭鹤唳', 'Lu Ji'],
      ['建康(祖冲之)', 'nanbei', [118.80, 32.05], '祖冲之', 'Zu Chongzhi'],
      ['建康(梁武帝)', 'nanbei', [118.80, 32.06], '梁武帝', 'Emperor Wu'],
      ['青州', 'nanbei', [118.48, 36.69], '齐民要术', 'Qimin Yaoshu'],
      ['洛阳(邙山)', 'nanbei', [112.60, 34.72], '兰陵王', 'Prince of Lanling'],
      ['荥阳', 'sui', [113.38, 34.80], '瓦岗军', 'Wagang'],
      ['天山', 'tang', [88.13, 47.85], '三箭定天山', 'Xue Rengui'],
      ['南昌', 'tang', [115.88, 28.68], '滕王阁序', 'Pavilion of Prince Teng'],
      ['金陵(夜宴)', 'wudai', [118.79, 32.04], '韩熙载夜宴图', 'Gu Hongzhong'],
      ['成都(花蕊)', 'beisong', [104.07, 30.67], '花蕊夫人', 'Consort Huarui'],
      ['开封(活字)', 'beisong', [114.35, 34.79], '毕昇', 'Bi Sheng'],
      ['开封(包拯)', 'beisong', [114.35, 34.79], '包拯', 'Bao Zheng'],
      ['镇江', 'beisong', [119.46, 32.20], '梦溪笔谈', 'Shen Kuo'],
      ['梁山', 'beisong', [116.12, 35.76], '宋江', 'Song Jiang'],
      ['庐山(白鹿洞)', 'nansong', [116.04, 29.52], '白鹿洞书院', 'White Deer Grotto'],
      ['潭州(飞虎军)', 'nansong', [112.98, 28.20], '飞虎军', 'Flying Tiger'],
      ['潭州(洗冤录)', 'nansong', [112.97, 28.20], '洗冤集录', 'Song Ci'],
      ['元大都(窦娥)', 'yuan', [116.39, 39.92], '窦娥冤', 'Guan Hanqing'],
      ['松江(黄道婆)', 'yuan', [121.44, 31.12], '黄道婆', 'Huang Daopo'],
      ['富阳(富春)', 'yuan', [119.95, 30.05], '富春山居图', 'Huang Gongwang'],
      ['蕲州', 'ming', [115.43, 30.22], '本草纲目', 'Li Shizhen'],
      ['北京(1629)', 'ming', [116.37, 39.90], '广渠门', 'Yuan Chonghuan'],
      ['北京(1630)', 'ming', [116.37, 39.90], '西市', 'Yuan Chonghuan'],
      ['北京(1763)', 'qing', [116.20, 39.99], '红楼梦', 'Cao Xueqin'],
      ['大渡河', 'qing', [102.35, 29.26], '石达开', 'Shi Dakai'],
      ['喀什', 'qing', [75.99, 39.47], '喀什噶尔', 'Kashgar'],
      ['敦煌', 'qing', [94.81, 40.04], '藏经洞', 'Mogao'],
      ['八达岭', 'qing', [116.02, 40.35], '詹天佑', 'Zhan Tianyou'],
      ['福州(1884)', 'qing', [119.30, 26.08], '马江海战', 'Mawei'],
      ['福州(1885)', 'qing', [119.30, 26.08], '左宗棠', 'Zuo Zongtang'],
      ['广州', 'qing', [113.30, 23.14], '黄花岗', 'Huanghuagang'],
    ];
    for (const [label, dynKey, coord, zhKw, enKw] of expectedCityGems) {
      const d = dynasties.find((x) => x.key === dynKey);
      ctrl.locale = 'zh';
      const zhEvs = ctrl._collectPlaceEventsForDynasty(d, coord[0], coord[1], null);
      assert(
        zhEvs.some((e) => e.text.includes(zhKw)),
        `Expected ZH city event "${zhKw}" at ${label} (${dynKey}), got ${JSON.stringify(zhEvs.map((e) => e.text))}`
      );
      ctrl.locale = 'en';
      const enEvs = ctrl._collectPlaceEventsForDynasty(d, coord[0], coord[1], null);
      assert(
        enEvs.some((e) => e.text.includes(enKw) && !/[\u4e00-\u9fa5]/.test(e.text)),
        `Expected EN city event "${enKw}" at ${label} (${dynKey}), got ${JSON.stringify(enEvs.map((e) => e.text))}`
      );
    }
    ctrl.locale = 'zh';

    const heroSpecs = [
      ['huoqubing', [-123, -121, -121, -119, -117], 'Huo Qubing'],
      ['simayi', [208, 228, 234, 238, 241, 249], 'Sima Yi'],
      ['yuefei', [1122, 1130, 1133, 1134, 1134, 1136, 1140, 1142], 'Yue'],
      ['xinqiji', [1161, 1162, 1180, 1188, 1196, 1205], 'Xin Qiji'],
      ['wentianxiang', [1256, 1275, 1276, 1276, 1279, 1283], 'Wen Tianxiang'],
      ['zuozongtang', [1852, 1864, 1866, 1873, 1876, 1878, 1880, 1885], 'Zuo Zongtang'],
    ];
    for (const [pKey, expYears, enName] of heroSpecs) {
      const prof = loreData.PERSON_PROFILES.find((p) => p.key === pKey);
      const stops = ctrl._collectPersonEvents(prof);
      assert.strictEqual(
        JSON.stringify(stops.map((s) => s.year)),
        JSON.stringify(expYears),
        `Unexpected stop years for ${pKey}: got ${JSON.stringify(stops.map((s) => s.year))}`
      );
      for (const st of stops) {
        assert(
          st.textEn.includes(enName) && !/[\u4e00-\u9fa5]/.test(st.textEn) && !/[\u4e00-\u9fa5]/.test(st.siteEn),
          `Expected clean English text & site mentioning "${enName}" on ${pKey}:${st.year}, got "${st.siteEn} -> ${st.textEn}"`
        );
      }
    }
  }

  // 23w. Hygiene & anti-drift guards: zero unreachable snapshots, zero legacy ?journey= links, zero unreferenced assets, and index.html SSR parity
  {
    const liveSnapSet = new Set(['neighbors']);
    for (const d of dynasties) {
      for (let y = d.fromYear; y <= d.toYear; y++) {
        if (y === 0) continue;
        liveSnapSet.add(ctrl._resolveSnapKey(d, y));
      }
      for (const p of d.phases || []) {
        if (p.snap) liveSnapSet.add(p.snap);
      }
    }
    const snapsRawCheck = fs.readFileSync(path.join(JS_DIR, 'atlas_snapshots.js'), 'utf8');
    const mRawD = snapsRawCheck.match(/^(\s*const D = )(\{[\s\S]*?\})(;\s*\n\s*const rc =)/m);
    assert(mRawD, 'Expected compact D block in atlas_snapshots.js');
    const parsedRawD = JSON.parse(mRawD[2]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const k of [...liveSnapSet]) {
        const s = parsedRawD.d[k];
        if (!s) continue;
        for (const refField of ['prefRef', 'regionRef']) {
          const target = s[refField];
          assert(!target || parsedRawD.d[target], `Dangling ${refField}="${target}" on snapshot ${k}`);
          if (target && !liveSnapSet.has(target)) {
            liveSnapSet.add(target);
            grew = true;
          }
        }
      }
    }
    const unreachableSnaps = Object.keys(parsedRawD.d).filter((k) => !liveSnapSet.has(k));
    assert.strictEqual(
      unreachableSnaps.length,
      0,
      `Found unreachable legacy snapshots in atlas_snapshots.js: ${unreachableSnaps.join(', ')}`
    );

    const sitemapRaw = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    assert(
      !indexHtml.includes('?journey=') && !sitemapRaw.includes('?journey='),
      'index.html and sitemap.xml must use canonical ?person= URLs rather than legacy ?journey='
    );
    assert(
      !indexHtml.includes('秦灭东周王室') && !indexHtml.includes('（今江西南安府（今大余））'),
      'index.html must not contain stale Warring States factual error or nested Nan’an double parentheses'
    );
    const ssrMilestoneLis = indexHtml.match(/<ul id="milestone-list">([\s\S]*?)<\/ul>/);
    const ssrCount = ssrMilestoneLis ? (ssrMilestoneLis[1].match(/<li>/g) || []).length : 0;
    assert.strictEqual(
      ssrCount,
      dynasties[0].milestones.length,
      `index.html #milestone-list count (${ssrCount}) must match Warring States milestones (${dynasties[0].milestones.length})`
    );

    const refCorpus = [indexHtml, styleCss, appCode, readmeSrc, readmeZhSrc].join('\n');
    for (const assetFile of fs.readdirSync(path.join(ROOT, 'assets'))) {
      assert(refCorpus.includes(assetFile), `Unreferenced file in assets/: ${assetFile}`);
    }

    const maShanLinkMatch = indexHtml.match(
      /<link href="(https:\/\/fonts\.googleapis\.com\/css2\?family=Ma\+Shan\+Zheng&text=([^"&]+)&display=swap)" rel="stylesheet" \/>/
    );
    assert(maShanLinkMatch, 'Expected synchronous subsetted Ma Shan Zheng stylesheet <link> in index.html');
    const subsetChars = new Set(decodeURIComponent(maShanLinkMatch[2]));
    const requiredCalligraphyChars = [
      '江山时序',
      ...dynasties.map((d) => d.title || ''),
      ...dynasties.map((d) => (enLocale.dynasties[d.key] && enLocale.dynasties[d.key].name) || ''),
    ].join('');
    for (const ch of requiredCalligraphyChars) {
      assert(subsetChars.has(ch), `Ma Shan Zheng subset missing glyph "${ch}"`);
    }

    const pyHelperSrc = fs.readFileSync(
      path.join(ROOT, 'skills', 'jiangshan-atlas', 'scripts', 'jiangshan.py'),
      'utf8'
    );
    assert(
      pyHelperSrc.includes('public_url = f"{PUBLIC_BASE_URL.rstrip(\'/\')}/?{query}"'),
      'jiangshan.py must derive public_url from PUBLIC_BASE_URL'
    );
  }

  // 23x. Western Jin and Eastern Jin & Sixteen Kingdoms (Book of Jin / 《晋书》 & Tan Qixiang Vol 4)
  {
    const jiankang = [118.801, 32.061];
    const jingkou = [119.451, 32.201];
    const dongjinSnaps = [
      's_dongjin_317',
      's_dongjin_a0',
      's_dongjin_a',
      's_dongjin_a2',
      's_dongjin_b',
      's_dongjin_b2',
      's_dongjin_c',
      's_dongjin_d0',
      's_dongjin_d1',
      's_dongjin_d',
      's_dongjin_e',
      's_dongjin_f',
    ];
    for (const sk of dongjinSnaps) {
      const snap = snapshots[sk];
      assert(snap, `Missing snapshot: ${sk}`);
      const djPol = snap.polities.find((p) => p.title === '东晋');
      assert(djPol && djPol.shape, `${sk} must have 东晋 polity with valid shape`);
      assert(
        pointInShape(jiankang[0], jiankang[1], djPol.shape),
        `${sk}: Jiankang ([118.801, 32.061]) must be inside Eastern Jin (东晋)`
      );
      assert(
        pointInShape(jingkou[0], jingkou[1], djPol.shape),
        `${sk}: Jingkou ([119.451, 32.201]) must be inside Eastern Jin (东晋)`
      );
    }

    // 317-318 CE (s_dongjin_317) must keep unified 汉赵 before the 319 CE split into 前赵 and 后赵 (s_dongjin_a0)
    assert(
      snapshots.s_dongjin_317.polities.some((p) => p.title === '汉赵') &&
        !snapshots.s_dongjin_317.polities.some((p) => p.title === '前赵') &&
        !snapshots.s_dongjin_317.polities.some((p) => p.title === '后赵'),
      's_dongjin_317 (317-318 CE) must show unified 汉赵 before the 319 CE split into 前赵 and 后赵'
    );
    assert(
      snapshots.s_dongjin_a0.polities.some((p) => p.title === '前赵') &&
        snapshots.s_dongjin_a0.polities.some((p) => p.title === '后赵') &&
        !snapshots.s_dongjin_a0.polities.some((p) => p.title === '汉赵'),
      's_dongjin_a0 (319-328 CE) must split 汉赵 into 前赵 and 后赵'
    );

    // Shengle ([111.821, 40.381]) inside Dai (代) across 317-376 CE (s_dongjin_317..s_dongjin_b2)
    const shengle = [111.821, 40.381];
    for (const sk of ['s_dongjin_317', 's_dongjin_a0', 's_dongjin_a', 's_dongjin_a2', 's_dongjin_350', 's_dongjin_351', 's_dongjin_b', 's_dongjin_b2']) {
      const daiPol = snapshots[sk].polities.find((p) => p.title === '代');
      assert(daiPol && daiPol.shape, `${sk} must include 代 polity`);
      assert(
        pointInShape(shengle[0], shengle[1], daiPol.shape),
        `${sk}: Shengle ([111.821, 40.381]) must be inside 代`
      );
    }

    // 350 CE (s_dongjin_350) & 351 CE (s_dongjin_351) must show 冉魏, while 351 CE adds 前秦 in Guanzhong and keeps 前燕 in Liaodong
    assert(
      snapshots.s_dongjin_350.polities.some((p) => p.title === '冉魏') &&
        !snapshots.s_dongjin_350.polities.some((p) => p.title === '后赵'),
      's_dongjin_350 (350-351 CE) must replace 后赵 with 冉魏'
    );
    assert(
      snapshots.s_dongjin_351.polities.some((p) => p.title === '前秦') &&
        snapshots.s_dongjin_351.polities.some((p) => p.title === '冉魏') &&
        pointInShape(114.391, 36.101, snapshots.s_dongjin_351.polities.find((p) => p.title === '冉魏').shape),
      's_dongjin_351 (351-352 CE) must show both 前秦 and 冉魏 (covering Ye)'
    );

    // 385-417 CE must split 后秦 and 西秦 into two separate polities (never merged as "后秦 · 西秦")
    const fuhan = [103.211, 35.601];
    const changan = [108.941, 34.341];
    for (const sk of ['s_dongjin_385', 's_dongjin_d0', 's_dongjin_397', 's_dongjin_d1', 's_dongjin_399', 's_dongjin_404', 's_dongjin_d', 's_dongjin_410', 's_dongjin_e']) {
      const hq = snapshots[sk].polities.find((p) => p.title === '后秦');
      const xq = snapshots[sk].polities.find((p) => p.title === '西秦');
      assert(hq && xq, `${sk} must have separate 后秦 and 西秦 polities`);
      assert(pointInShape(changan[0], changan[1], hq.shape), `${sk}: Chang'an must be inside 后秦`);
      assert(pointInShape(fuhan[0], fuhan[1], xq.shape), `${sk}: Fuhan must be inside 西秦`);
    }

    // 397-413 CE must include 南凉 (covering Ledu [102.4, 36.48]) alongside 北凉
    const ledu = [102.4, 36.48];
    for (const sk of ['s_dongjin_397', 's_dongjin_d1', 's_dongjin_399', 's_dongjin_404', 's_dongjin_d', 's_dongjin_410']) {
      const nl = snapshots[sk].polities.find((p) => p.title === '南凉');
      const bl = snapshots[sk].polities.find((p) => p.title === '北凉');
      assert(nl && bl, `${sk} must include both 南凉 and 北凉 polities`);
      assert(pointInShape(ledu[0], ledu[1], nl.shape), `${sk}: Ledu ([102.4, 36.48]) must be inside 南凉`);
    }

    // 404-413 CE (s_dongjin_404, s_dongjin_d, s_dongjin_410) must include 谯蜀 in Ba-Shu (covering Chengdu [104.071, 30.571])
    for (const sk of ['s_dongjin_404', 's_dongjin_d', 's_dongjin_410']) {
      const qs = snapshots[sk].polities.find((p) => p.title === '谯蜀');
      assert(qs && qs.shape, `${sk} must include 谯蜀 polity`);
      assert(pointInShape(104.071, 30.571, qs.shape), `${sk}: Chengdu ([104.071, 30.571]) must be inside 谯蜀`);
    }
    assert(
      !snapshots.s_dongjin_e.polities.some((p) => p.title === '谯蜀') &&
        pointInShape(104.071, 30.571, snapshots.s_dongjin_e.polities.find((p) => p.title === '东晋').shape),
      's_dongjin_e (413-417 CE) must show 谯蜀 recovered by 东晋'
    );

    // Guzang ([102.641, 37.931]) inside Liangzhou polities (Former/Later/Northern Liang or unified Former Qin)
    const guzang = [102.641, 37.931];
    const guzangCases = [
      ['s_dongjin_317', '前凉'],
      ['s_dongjin_a0', '前凉'],
      ['s_dongjin_a', '前凉'],
      ['s_dongjin_a2', '前凉'],
      ['s_dongjin_350', '前凉'],
      ['s_dongjin_351', '前凉'],
      ['s_dongjin_b', '前凉'],
      ['s_dongjin_b2', '前凉'],
      ['s_dongjin_c', '前秦'],
      ['s_dongjin_385', '后凉'],
      ['s_dongjin_d0', '后凉'],
      ['s_dongjin_397', '北凉'],
      ['s_dongjin_d1', '北凉'],
      ['s_dongjin_399', '北凉'],
      ['s_dongjin_404', '北凉'],
      ['s_dongjin_d', '北凉'],
      ['s_dongjin_410', '北凉'],
      ['s_dongjin_e', '北凉'],
      ['s_dongjin_f', '北凉'],
    ];
    for (const [sk, expectedTitle] of guzangCases) {
      const snap = snapshots[sk];
      const pol = snap.polities.find((p) => p.title === expectedTitle);
      assert(pol && pol.shape, `${sk} must contain polity "${expectedTitle}"`);
      assert(
        pointInShape(guzang[0], guzang[1], pol.shape),
        `${sk}: Guzang ([102.641, 37.931]) must be inside ${expectedTitle}`
      );
    }

    // Western Jin 304-305 CE (s_xijin) must include 晋, 汉赵, and 成汉; Chengdu inside 成汉
    const chengdu = [104.071, 30.571];
    const xijinSnap = snapshots.s_xijin;
    assert(xijinSnap, 'Missing s_xijin snapshot');
    const chPol = xijinSnap.polities.find((p) => p.title === '成汉');
    assert(chPol && chPol.shape, 's_xijin must include 成汉 polity');
    assert(
      pointInShape(chengdu[0], chengdu[1], chPol.shape),
      's_xijin: Chengdu ([104.071, 30.571]) must be inside 成汉'
    );
    assert(
      xijinSnap.polities.some((p) => p.title === '晋') &&
        xijinSnap.polities.some((p) => p.title === '汉赵'),
      's_xijin must include both 晋 and 汉赵 polities'
    );

    // Capital periods verification for xijin and dongjin
    const xjDyn = dynasties.find((d) => d.key === 'xijin');
    const djDyn = dynasties.find((d) => d.key === 'dongjin');
    const findSt = (d, ancient) => (d.settlements || []).find((s) => s.ancient === ancient);

    const luoyangXJ = findSt(xjDyn, '洛阳');
    assert(luoyangXJ && Array.isArray(luoyangXJ.capitalPeriods), 'xijin: 洛阳 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(luoyangXJ.capitalPeriods), JSON.stringify([[280, 311]]), 'xijin: 洛阳 capitalPeriods must be [[280, 311]]');

    const changanXJ = findSt(xjDyn, '长安');
    assert(changanXJ && Array.isArray(changanXJ.capitalPeriods), 'xijin: 长安 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(changanXJ.capitalPeriods), JSON.stringify([[313, 316]]), 'xijin: 长安 capitalPeriods must be [[313, 316]]');

    const chengduXJ = findSt(xjDyn, '成都');
    assert(chengduXJ && Array.isArray(chengduXJ.capitalPeriods), 'xijin: 成都 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(chengduXJ.capitalPeriods), JSON.stringify([[306, 316]]), 'xijin: 成都 capitalPeriods must be [[306, 316]]');

    const yeDJ = findSt(djDyn, '邺');
    assert(yeDJ && Array.isArray(yeDJ.capitalPeriods), 'dongjin: 邺 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(yeDJ.capitalPeriods), JSON.stringify([[335, 370]]), 'dongjin: 邺 capitalPeriods must be [[335, 370]]');

    const pingchengDJ = findSt(djDyn, '平城');
    assert(pingchengDJ && Array.isArray(pingchengDJ.capitalPeriods), 'dongjin: 平城 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(pingchengDJ.capitalPeriods), JSON.stringify([[398, 420]]), 'dongjin: 平城 capitalPeriods must be [[398, 420]]');

    const guzangDJ = findSt(djDyn, '姑臧（凉州）');
    assert(guzangDJ && Array.isArray(guzangDJ.capitalPeriods), 'dongjin: 姑臧 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(guzangDJ.capitalPeriods), JSON.stringify([[320, 376], [386, 403], [412, 420]]), 'dongjin: 姑臧 capitalPeriods must match');
  }

  // 23y. Southern and Northern Dynasties (Nanbei / Zizhi Tongjian, Nan Shi, Bei Shi & Tan Qixiang Vol 4)
  {
    const jiankang = [118.801, 32.061];
    const jingkou = [119.451, 32.201];
    const nanbeiSnaps = [
      ['s_nanbei_0', '宋', '魏'],
      ['s_nanbei_427', '宋', '魏'],
      ['s_nanbei_0b', '宋', '魏'],
      ['s_nanbei_0c', '宋', '魏'],
      ['s_nanbei_a', '宋', '魏'],
      ['s_nanbei_a2', '宋', '魏'],
      ['s_nanbei_b', '齐', '魏'],
      ['s_nanbei_c', '梁', '魏'],
      ['s_nanbei_d', '梁', '东魏'],
      ['s_nanbei_d1', '梁', '北齐'],
      ['s_nanbei_d2', '梁', '北齐'],
      ['s_nanbei_d3', '梁', '北齐'],
      ['s_nanbei_e', '陈', '北齐'],
      ['s_nanbei_e2', '陈', '北齐'],
      ['s_nanbei_f', '陈', '北周'],
    ];

    // Seamless 420 CE transition between s_dongjin_f (417-420) and s_nanbei_0 (420-426):
    // 东晋 and 宋 must have identical shapes, and 北魏, 西秦, 胡夏, 北燕, 北凉 must match 1-to-1
    assert.strictEqual(
      JSON.stringify(snapshots.s_dongjin_f.polities.find((p) => p.title === '东晋').shape),
      JSON.stringify(snapshots.s_nanbei_0.polities.find((p) => p.title === '宋').shape),
      's_dongjin_f (东晋) and s_nanbei_0 (宋) must share identical polygon geometry at 420 CE'
    );
    for (const sharedTitle of ['北魏', '西秦', '胡夏', '北燕', '北凉']) {
      const pDj = snapshots.s_dongjin_f.polities.find((p) => p.title === sharedTitle);
      const pNb = snapshots.s_nanbei_0.polities.find((p) => p.title === sharedTitle);
      assert(pDj && pNb, `Both s_dongjin_f and s_nanbei_0 must include ${sharedTitle} at 420 CE`);
      assert.strictEqual(
        JSON.stringify(pDj.shape),
        JSON.stringify(pNb.shape),
        `s_dongjin_f and s_nanbei_0 must share identical polygon geometry for ${sharedTitle} at 420 CE`
      );
    }
    // 427-430 CE (s_nanbei_427) must place Tongwancheng ([108.871, 37.991]) inside 北魏 while keeping 胡夏 and 西秦 until 431 CE
    assert(
      pointInShape(108.871, 37.991, snapshots.s_nanbei_427.polities.find((p) => p.title === '北魏').shape) &&
        snapshots.s_nanbei_427.polities.some((p) => p.title === '胡夏') &&
        snapshots.s_nanbei_427.polities.some((p) => p.title === '西秦'),
      's_nanbei_427 (427-430 CE) must place Tongwancheng inside 北魏 while keeping 胡夏 (in Longdong) and 西秦 until 431 CE'
    );

    for (const [sk, southTitle, northTitle] of nanbeiSnaps) {
      const snap = snapshots[sk];
      assert(snap, `Missing snapshot: ${sk}`);
      const sPol = snap.polities.find((p) => p.title === southTitle);
      assert(sPol && sPol.shape, `${sk} must have Southern Dynasty polity ${southTitle} with valid shape`);
      assert(
        pointInShape(jiankang[0], jiankang[1], sPol.shape),
        `${sk}: Jiankang ([118.801, 32.061]) must be inside Southern Dynasty (${southTitle})`
      );
      assert(
        pointInShape(jingkou[0], jingkou[1], sPol.shape),
        `${sk}: Jingkou ([119.451, 32.201]) must be inside Southern Dynasty (${southTitle})`
      );
      const nPol = snap.polities.find((p) => p.title === northTitle);
      if (nPol && nPol.shape) {
        assert(
          !pointInShape(jiankang[0], jiankang[1], nPol.shape),
          `${sk}: Jiankang must NOT be swallowed by Northern Dynasty (${northTitle})`
        );
        assert(
          !pointInShape(jingkou[0], jingkou[1], nPol.shape),
          `${sk}: Jingkou must NOT be swallowed by Northern Dynasty (${northTitle})`
        );
      }
    }

    // Capital periods & settlement verification for nanbei
    const nbDyn = dynasties.find((d) => d.key === 'nanbei');
    assert(nbDyn, 'Missing nanbei dynasty');
    const findSt = (ancient) => (nbDyn.settlements || []).find((s) => s.ancient === ancient);

    const jiankangNB = findSt('建康');
    assert(jiankangNB && Array.isArray(jiankangNB.capitalPeriods), 'nanbei: 建康 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(jiankangNB.capitalPeriods),
      JSON.stringify([[420, 552], [555, 589]]),
      'nanbei: 建康 capitalPeriods must be [[420, 552], [555, 589]]'
    );

    const pingchengNB = findSt('平城');
    assert(pingchengNB && Array.isArray(pingchengNB.capitalPeriods), 'nanbei: 平城 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(pingchengNB.capitalPeriods),
      JSON.stringify([[420, 494]]),
      'nanbei: 平城 capitalPeriods must be [[420, 494]]'
    );

    const luoyangNB = findSt('洛阳');
    assert(luoyangNB && Array.isArray(luoyangNB.capitalPeriods), 'nanbei: 洛阳 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(luoyangNB.capitalPeriods),
      JSON.stringify([[494, 534]]),
      'nanbei: 洛阳 capitalPeriods must be [[494, 534]]'
    );

    const yeNB = findSt('邺');
    assert(yeNB && Array.isArray(yeNB.capitalPeriods), 'nanbei: 邺 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(yeNB.capitalPeriods),
      JSON.stringify([[534, 577]]),
      'nanbei: 邺 capitalPeriods must be [[534, 577]]'
    );

    const changanNB = findSt('长安');
    assert(changanNB && Array.isArray(changanNB.capitalPeriods), 'nanbei: 长安 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(changanNB.capitalPeriods),
      JSON.stringify([[535, 581]]),
      'nanbei: 长安 capitalPeriods must be [[535, 581]]'
    );

    const jianglingNB = findSt('江陵');
    assert(jianglingNB && Array.isArray(jianglingNB.capitalPeriods), 'nanbei: 江陵 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(jianglingNB.capitalPeriods),
      JSON.stringify([[552, 587]]),
      'nanbei: 江陵 capitalPeriods must be [[552, 587]]'
    );

    const jinyangNB = findSt('晋阳');
    assert(jinyangNB && Array.isArray(jinyangNB.capitalPeriods), 'nanbei: 晋阳 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(jinyangNB.capitalPeriods),
      JSON.stringify([[534, 577]]),
      'nanbei: 晋阳 capitalPeriods must be [[534, 577]]'
    );

    const tongwanNB = findSt('统万城');
    assert(tongwanNB && Array.isArray(tongwanNB.capitalPeriods), 'nanbei: 统万城 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(tongwanNB.capitalPeriods),
      JSON.stringify([[420, 427]]),
      'nanbei: 统万城 capitalPeriods must be [[420, 427]]'
    );

    const guzangNB = findSt('姑臧（凉州）');
    assert(guzangNB && Array.isArray(guzangNB.capitalPeriods), 'nanbei: 姑臧 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(guzangNB.capitalPeriods),
      JSON.stringify([[420, 439]]),
      'nanbei: 姑臧 capitalPeriods must be [[420, 439]]'
    );

    const longchengNB = findSt('龙城');
    assert(longchengNB && Array.isArray(longchengNB.capitalPeriods), 'nanbei: 龙城 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(longchengNB.capitalPeriods),
      JSON.stringify([[420, 436]]),
      'nanbei: 龙城 capitalPeriods must be [[420, 436]]'
    );

    // Verify settlements added
    assert(findSt('东阳（青州）'), 'nanbei: must include 东阳（青州）');
    assert(findSt('钟离（凤阳）'), 'nanbei: must include 钟离（凤阳）');

    // Verify 16 map change milestones
    const expectedMapChanges = [420, 427, 431, 436, 439, 469, 479, 494, 502, 534, 550, 553, 554, 557, 573, 577];
    const actualMapChanges = (nbDyn.milestones || []).filter((m) => m.isMapChange).map((m) => m.year);
    assert.strictEqual(
      JSON.stringify(actualMapChanges),
      JSON.stringify(expectedMapChanges),
      'nanbei: 16 map change milestone years must match'
    );
  }

  // 23z. Sui Dynasty & Tang Dynasty (Zizhi Tongjian, Old/New Book of Tang & Tan Qixiang Vol 5)
  {
    const findDyn = (k) => dynasties.find((d) => d.key === k);
    const suiDyn = findDyn('sui');
    const tangDyn = findDyn('tang');
    assert(suiDyn, 'Missing sui dynasty');
    assert(tangDyn, 'Missing tang dynasty');

    const findSt = (dyn, ancient) => (dyn.settlements || []).find((s) => s.ancient === ancient);

    // Sui capitals & periods
    const daxingSui = findSt(suiDyn, '大兴');
    assert(daxingSui && Array.isArray(daxingSui.capitalPeriods), 'sui: 大兴 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(daxingSui.capitalPeriods), JSON.stringify([[581, 618]]), 'sui: 大兴 capitalPeriods must be [[581, 618]]');

    const luoyangSui = findSt(suiDyn, '东都洛阳');
    assert(luoyangSui && Array.isArray(luoyangSui.capitalPeriods), 'sui: 东都洛阳 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(luoyangSui.capitalPeriods), JSON.stringify([[605, 618]]), 'sui: 东都洛阳 capitalPeriods must be [[605, 618]]');

    const jianglingSui = findSt(suiDyn, '江陵');
    assert(jianglingSui && Array.isArray(jianglingSui.capitalPeriods), 'sui: 江陵 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(jianglingSui.capitalPeriods), JSON.stringify([[581, 587]]), 'sui: 江陵 capitalPeriods must be [[581, 587]]');

    // Sui warlord settlements
    for (const w of ['历阳（和县）', '金城（秦都）', '马邑（朔州）']) {
      assert(findSt(suiDyn, w), `sui: must include late Sui warlord center ${w}`);
    }

    // Sui 5 map change milestones
    const expectedSuiMapChanges = [581, 587, 589, 609, 618];
    const actualSuiMapChanges = (suiDyn.milestones || []).filter((m) => m.isMapChange).map((m) => m.year);
    assert.strictEqual(
      JSON.stringify(actualSuiMapChanges),
      JSON.stringify(expectedSuiMapChanges),
      'sui: 5 map change milestone years must match'
    );

    // Tang capitals & periods
    const changanTang = findSt(tangDyn, '长安');
    assert(changanTang && Array.isArray(changanTang.capitalPeriods), 'tang: 长安 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(changanTang.capitalPeriods), JSON.stringify([[618, 904]]), 'tang: 长安 capitalPeriods must be [[618, 904]]');

    const luoyangTang = findSt(tangDyn, '东都洛阳');
    assert(luoyangTang && Array.isArray(luoyangTang.capitalPeriods), 'tang: 东都洛阳 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(luoyangTang.capitalPeriods),
      JSON.stringify([[690, 705], [904, 907]]),
      'tang: 东都洛阳 capitalPeriods must be [[690, 705], [904, 907]]'
    );

    const taiyuanTang = findSt(tangDyn, '北都太原');
    assert(taiyuanTang && Array.isArray(taiyuanTang.capitalPeriods), 'tang: 北都太原 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(taiyuanTang.capitalPeriods), JSON.stringify([[723, 907]]), 'tang: 北都太原 capitalPeriods must be [[723, 907]]');

    // Tang Six Great Protectorates (六大都护府)
    const sixProtectorates = [
      '安西都护府（龟兹）',
      '北庭都护府',
      '安东都护府',
      '安南都护府（交州）',
      '单于大都护府（和林格尔）',
      '安北都护府',
    ];
    for (const prot of sixProtectorates) {
      assert(findSt(tangDyn, prot), `tang: must include Six Great Protectorate ${prot}`);
    }

    // Tang warlord settlements
    for (const w of ['洺州（夏都）', '历阳（吴都）', '金城（兰州）']) {
      assert(findSt(tangDyn, w), `tang: must include warlord settlement ${w}`);
    }

    // Tang 19 map change milestones
    const expectedTangMapChanges = [618, 621, 630, 635, 640, 648, 657, 668, 676, 690, 702, 755, 757, 763, 764, 790, 848, 881, 907];
    const actualTangMapChanges = (tangDyn.milestones || []).filter((m) => m.isMapChange).map((m) => m.year);
    assert.strictEqual(
      JSON.stringify(actualTangMapChanges),
      JSON.stringify(expectedTangMapChanges),
      'tang: 19 map change milestone years must match'
    );

    // Spatial checks: s_sui_d and s_tang_0 warlords
    const suiD = snapshots.s_sui_d;
    assert(suiD, 'Missing s_sui_d');
    const findPol = (snap, title) => (snap.polities || []).find((p) => p.title === title);

    const tangInSuiD = findPol(suiD, '唐（李渊）');
    assert(tangInSuiD && pointInShape(108.941, 34.341, tangInSuiD.shape), 's_sui_d: Chang\'an must be inside 唐（李渊）');
    assert(tangInSuiD && pointInShape(112.551, 37.871, tangInSuiD.shape), 's_sui_d: Taiyuan must be inside 唐（李渊）');

    const weiInSuiD = findPol(suiD, '魏（李密）');
    assert(weiInSuiD && pointInShape(112.451, 34.621, weiInSuiD.shape), 's_sui_d: Luoyang must be inside 魏（李密）');

    const liangInSuiD = findPol(suiD, '梁（萧铣）');
    assert(liangInSuiD && pointInShape(112.241, 30.331, liangInSuiD.shape), 's_sui_d: Jiangling must be inside 梁（萧铣）');

    const tang0 = snapshots.s_tang_0;
    assert(tang0, 'Missing s_tang_0');
    const tangPol0 = findPol(tang0, '唐');
    assert(tangPol0 && pointInShape(108.941, 34.341, tangPol0.shape), 's_tang_0: Chang\'an must be inside 唐');

    const zhengInTang0 = findPol(tang0, '郑（王世充）');
    assert(zhengInTang0 && pointInShape(112.451, 34.621, zhengInTang0.shape), 's_tang_0: Luoyang must be inside 郑（王世充）');

    const xiaInTang0 = findPol(tang0, '夏（窦建德）');
    assert(xiaInTang0 && pointInShape(116.12, 38.18, xiaInTang0.shape), 's_tang_0: Letou must be inside 夏（窦建德）');

    const wuInTang0 = findPol(tang0, '吴（杜伏威）');
    assert(wuInTang0 && pointInShape(119.411, 32.391, wuInTang0.shape), 's_tang_0: Jiangdu must be inside 吴（杜伏威）');

    // High Tang s_tang_a5 core cities inside 唐
    const tangA5 = snapshots.s_tang_a5;
    assert(tangA5, 'Missing s_tang_a5');
    const tangPolA5 = findPol(tangA5, '唐');
    assert(tangPolA5, 's_tang_a5 must have 唐 polity');
    for (const [cName, lng, lat] of [
      ['长安', 108.941, 34.341],
      ['洛阳', 112.451, 34.621],
      ['太原', 112.551, 37.871],
      ['成都', 104.071, 30.571],
      ['广州', 113.261, 23.131],
      ['扬州', 119.411, 32.391],
    ]) {
      assert(pointInShape(lng, lat, tangPolA5.shape), `s_tang_a5: ${cName} must be inside 唐`);
    }
  }

  // 23aa. Mountain-range name labels (山川形胜): the twelve ranges that frame China's historical frontiers
  {
    const ranges = (sandbox.window.HYDRO_DATA.labels || []).filter((lb) => lb.kind === 'range');
    const expectedRanges = ['秦岭', '大巴山', '太行山', '燕山', '阴山', '贺兰山', '祁连山', '天山', '昆仑山', '南岭', '武夷山', '大兴安岭'];
    assert.strictEqual(
      JSON.stringify(ranges.map((r) => r.zh).sort()),
      JSON.stringify([...expectedRanges].sort()),
      'HYDRO_DATA.labels must contain exactly the 12 curated mountain-range labels'
    );
    for (const r of ranges) {
      assert(
        typeof r.en === 'string' && r.en.length > 0 && !/[\u4e00-\u9fa5]/.test(r.en),
        `Mountain range ${r.zh} must have a clean English name, got ${JSON.stringify(r.en)}`
      );
      assert(
        Array.isArray(r.coord) && r.coord[0] > 73 && r.coord[0] < 135 && r.coord[1] > 18 && r.coord[1] < 54,
        `Mountain range ${r.zh} label coord must sit inside China, got ${JSON.stringify(r.coord)}`
      );
      assert(Math.abs(r.rot || 0) <= 90, `Mountain range ${r.zh} rotation must stay readable (|rot| <= 90)`);
    }
  }

  // 23ab. Ming capitals, Later Jin capitals, and map-change milestones (History of Ming / Ming Shilu)
  {
    const mingD = dynasties.find((d) => d.key === 'ming');
    const mingSt = (name) => (mingD.settlements || []).find((s) => s.ancient === name);
    const capCases = [
      ['应天府', [[1368, 1420]]],
      ['顺天府', [[1421, 1644]]],
      ['赫图阿拉', [[1616, 1621]]],
      ['辽阳', [[1621, 1625]]],
      ['沈阳（盛京）', [[1625, 1644]]],
    ];
    for (const [name, periods] of capCases) {
      const st = mingSt(name);
      assert(st && st.isCapital, `ming: ${name} must be marked as a capital`);
      assert.strictEqual(JSON.stringify(st.capitalPeriods), JSON.stringify(periods), `ming: ${name} capitalPeriods must be ${JSON.stringify(periods)}`);
    }
    assert(mingSt('辽阳').vanish === undefined, 'ming: 辽阳 must not vanish in 1621 (it became the Later Jin Eastern Capital)');
    assert.strictEqual(ctrl._isSettlementCapital(mingSt('应天府'), 1400), true, 'Nanjing must be the Ming capital in 1400');
    assert.strictEqual(ctrl._isSettlementCapital(mingSt('顺天府'), 1400), false, 'Beijing must not be the Ming capital before 1421');

    const mcYears = (mingD.milestones || []).filter((m) => m.isMapChange).map((m) => m.year);
    assert.strictEqual(
      JSON.stringify(mcYears),
      JSON.stringify([1368, 1369, 1371, 1382, 1388, 1407, 1427, 1449, 1513, 1616, 1636, 1643]),
      'ming: map-change milestones must match the phase transitions'
    );

    // Liaodong was Ming from 1371 (Dingliao Garrison at Liaoyang); Naghachu held only Jinshan to the north.
    for (const sk of ['s_ming_0c', 's_ming_0d']) {
      const ming = snapshots[sk].polities.find((p) => p.title === '明');
      const yuan = snapshots[sk].polities.find((p) => p.title === '北元');
      for (const [name, x, y] of [['辽阳', 123.171, 41.271], ['沈阳', 123.431, 41.801], ['广宁', 121.8, 41.6]]) {
        assert(pointInShape(x, y, ming.shape) && !pointInShape(x, y, yuan.shape), `${sk}: ${name} must be inside 明, not 北元`);
      }
      assert(pointInShape(124.03, 42.55, yuan.shape), `${sk}: Kaiyuan ([124.03, 42.55]) north of Ming Liaodong must stay 北元`);
    }
    // Hami Guard survives until Turpan takes it in 1513.
    const hamiAt = (year) => {
      const sk = ctrl._resolveSnapKey(mingD, year);
      return snapshots[sk].polities.filter((p) => pointInShape(93.511, 42.821, p.shape) && p.role !== 'neighbor').map((p) => p.title);
    };
    assert.strictEqual(ctrl._resolveSnapKey(mingD, 1480), 's_ming_b0', 'Ming at 1480 CE must resolve to s_ming_b0');
    assert.strictEqual(JSON.stringify(hamiAt(1480)), JSON.stringify(['哈密卫（关西七卫）']), 'Hami must be under 哈密卫 in 1480');
    assert.strictEqual(JSON.stringify(hamiAt(1550)), '[]', 'Hami must no longer be a Ming guard in 1550');
    assert(
      !(mingD.milestones || []).find((m) => m.year === 1388).headline.includes('收辽东'),
      'ming 1388: Liaodong was already Ming from 1371; 1387 was the surrender of Naghachu at Jinshan'
    );
    assert(
      !(mingD.milestones || []).find((m) => m.year === 1627).headline.includes('李自成'),
      'ming 1627: Li Zicheng only joined the rebels in 1629-1630'
    );
  }

  // 23ac. Qing snapshots, milestones, and settlements (Draft History of Qing)
  {
    const qingD = dynasties.find((d) => d.key === 'qing');
    assert(qingD, 'qing dynasty definition must exist');

    // s_qing_a1 must have valid caption and note (never undefined)
    assert(
      snapshots.s_qing_a1 && snapshots.s_qing_a1.caption && snapshots.s_qing_a1.note,
      's_qing_a1 must have defined caption and note'
    );
    assert(
      snapshots.s_qing_a1.caption.startsWith('1662'),
      's_qing_a1 caption must start at 1662 (after execution of Yongli Emperor)'
    );
    assert(
      snapshots.s_qing_a && snapshots.s_qing_a.caption.startsWith('1673'),
      's_qing_a caption must start at 1673 (Revolt of Three Feudatories), not 1661'
    );
    assert(
      snapshots.s_qing_f0 && snapshots.s_qing_f0.caption.includes('1864 — 1881'),
      's_qing_f0 caption must cover 1864 — 1881'
    );
    assert(
      snapshots.s_qing_g0 && snapshots.s_qing_g0.caption.includes('1895 — 1898'),
      's_qing_g0 caption must cover 1895 — 1898'
    );

    // All phase transition milestones must have isMapChange === true
    const expectedMapChangeYears = [
      1644, 1645, 1661, 1662, 1673, 1681, 1683, 1691, 1720, 1759, 1796, 1851, 1858, 1860, 1864, 1881, 1895, 1898,
    ];
    const actualMapChangeYears = (qingD.milestones || [])
      .filter((m) => m.isMapChange)
      .map((m) => m.year);
    assert.strictEqual(
      JSON.stringify(actualMapChangeYears),
      JSON.stringify(expectedMapChangeYears),
      'qing: all 18 phase transition milestones must have isMapChange === true'
    );

    // Yanping Fu must be centered at Nanping (not Sanming)
    const qingSt = (name) => (qingD.settlements || []).find((s) => s.ancient === name);
    const yanping = qingSt('延平府');
    assert(yanping && yanping.modern.includes('南平'), 'qing: 延平府 must be centered at Nanping');
    assert(Math.abs(yanping.coord[0] - 118.18) < 0.1 && Math.abs(yanping.coord[1] - 26.64) < 0.1, 'qing: 延平府 coords near Nanping');

    // Key seats and treaty ports
    const kashgar = qingSt('喀什噶尔');
    assert(kashgar && kashgar.appear === 1759, 'qing: 喀什噶尔 must exist from 1759');
    assert.strictEqual(ctrl.inspect({ year: 1800, place: '喀什噶尔' }).polity, '清', 'qing: 喀什噶尔 must resolve to polity 清 in 1800');
    assert.strictEqual(ctrl.inspect({ year: 1885, place: '霍尔果斯' }).polity, '清', 'qing: 霍尔果斯 must resolve to polity 清 in 1885');
    assert.strictEqual(ctrl.inspect({ year: 1870, place: '瑷珲' }).polity, '清', 'qing: 瑷珲 must resolve to polity 清 in 1870');
    assert.strictEqual(ctrl.inspect({ year: 1800, place: '雷州府' }).polity, '清', 'qing: 雷州府 must resolve to polity 清 in 1800');
    assert.strictEqual(ctrl.inspect({ year: 1800, place: '辑安（国内城）' }).polity, '清', 'qing: 辑安（国内城） must resolve to polity 清 in 1800');

    for (const [name, expAppear] of [
      ['吐鲁番', 1759],
      ['安西州', 1759],
      ['阿克苏（温宿）', 1759],
      ['和阗（于阗）', 1759],
      ['库车（龟兹）', 1759],
      ['黑城（额济纳）', 1759],
      ['山南（泽当）', 1720],
      ['噶尔（阿里）', 1720],
    ]) {
      const st = qingSt(name);
      assert(st && st.appear === expAppear, `qing: ${name} must have appear === ${expAppear}`);
    }

    const taipei = qingSt('台北府');
    assert(taipei && taipei.appear === 1875 && taipei.vanish === 1895, 'qing: 台北府 must exist 1875-1895');

    const qiqi = qingSt('齐齐哈尔');
    assert(qiqi && qiqi.appear === 1699, 'qing: 齐齐哈尔 must exist from 1699');

    const shanghai = qingSt('上海');
    assert(shanghai && shanghai.appear === 1843, 'qing: 上海 must exist from 1843');

    const tianjin = qingSt('天津府');
    assert(tianjin && tianjin.appear === 1725, 'qing: 天津府 must exist from 1725');
  }

  // CUJ 26: Security (Reflected XSS Sanitization), EN inspect(), Person inspect(), Autoplay Mutual Exclusion & IME Guards
  {
    ctrl.locale = 'en';
    const enInsp = ctrl.inspect({ year: 819, place: 'Lantian Pass' });
    assert.strictEqual(enInsp.dynasty.title, 'Tang');
    assert.strictEqual(enInsp.polity, 'Tang');
    assert(enInsp.regions.includes('Guannei Circuit'));
    assert.strictEqual(enInsp.modernProvince, 'Shaanxi');
    assert(enInsp.url.includes('lang=en'));

    const personInsp = ctrl.inspect({ person: 'sushi', stop: 2 });
    assert(
      personInsp.person &&
        personInsp.person.key === 'sushi' &&
        personInsp.person.totalEvents >= 10 &&
        personInsp.person.events[2].site === 'Dongjing Kaifeng' &&
        personInsp.url.includes('person=sushi') &&
        personInsp.url.includes('stop=2'),
      `Expected English inspect({ person: 'sushi', stop: 2 }) to return localized person events, got ${JSON.stringify(personInsp.person)}`
    );
    ctrl.locale = 'zh';

    const xssInspect = ctrl.inspect({
      year: 741,
      place: '长安<img src=x onerror=alert(1)>,洛阳',
    });
    assert(
      xssInspect.route &&
        xssInspect.route.length === 2 &&
        !xssInspect.place.includes('<') &&
        !xssInspect.route[0].place.includes('<'),
      `Expected XSS angle brackets to be stripped from route place tokens, got ${JSON.stringify(xssInspect.place)}`
    );

    // Late Eastern Han & Three Kingdoms (Sanguozhi) territorial & capitalPeriods regression guards
    const sanguoSpotChecks = [
      [{ lng: 118.801, lat: 32.061, year: 229 }, '吴'], // Jianye
      [{ lng: 119.451, lat: 32.201, year: 229 }, '吴'], // Jingkou
      [{ lng: 112.121, lat: 32.011, year: 208 }, '曹操(北方)'], // Xiangyang post-208
      [{ lng: 112.121, lat: 32.011, year: 229 }, '魏'], // Xiangyang in Three Kingdoms
      [{ lng: 123.171, lat: 41.271, year: 196 }, '公孙氏(辽东)'], // Xiangping (Liaodong)
      [{ lng: 113.261, lat: 23.131, year: 200 }, '士燮(交州)'], // Panyu (Jiaozhou) 189-210
      [{ lng: 113.261, lat: 23.131, year: 211 }, '孙权(江东)'], // Panyu submits to Sun Quan 211
      [{ lng: 103.82, lat: 36.06, year: 208 }, '马腾·韩遂(关陇)'], // Guanlong before Tong Pass
      [{ lng: 103.82, lat: 36.06, year: 211 }, '曹操(北方)'], // Guanlong after Tong Pass (211)
      [{ lng: 107.021, lat: 33.071, year: 200 }, '张鲁(汉中)'], // Nanzheng (Hanzhong) 196-214
      [{ lng: 107.021, lat: 33.071, year: 215 }, '曹操(北方)'], // Hanzhong taken by Cao Cao (215)
      [{ lng: 107.021, lat: 33.071, year: 219 }, '刘备(益州)'], // Hanzhong taken by Liu Bei (219)
      [{ lng: 111.698, lat: 29.032, year: 215 }, '刘备(荆益)'], // Wuling west of Xiang River (215)
      [{ lng: 112.941, lat: 28.231, year: 215 }, '孙权(江东)'], // Changsha east of Xiang River (215)
    ];
    for (const [opts, expPol] of sanguoSpotChecks) {
      const info = ctrl.inspect(opts);
      assert(
        info && info.polity === expPol,
        `Sanguozhi guard: inspect(${JSON.stringify(opts)}) expected polity "${expPol}", got ${JSON.stringify(info && info.polity)}`
      );
    }
    const dhDyn = dynasties.find((d) => d.key === 'donghan');
    const sgDyn = dynasties.find((d) => d.key === 'sanguo');
    const dhLuoyang = dhDyn.settlements.find((s) => s.ancient === '洛阳');
    const dhChangan = dhDyn.settlements.find((s) => s.ancient === '长安');
    const dhXu = dhDyn.settlements.find((s) => s.ancient === '许');
    assert(
      ctrl._isSettlementCapital(dhLuoyang, 100) &&
        !ctrl._isSettlementCapital(dhLuoyang, 196) &&
        ctrl._isSettlementCapital(dhChangan, 192) &&
        ctrl._isSettlementCapital(dhXu, 200),
      'Expected donghan capitalPeriods to switch Luoyang (25-189) -> Chang\'an (190-195) -> Xu (196-220)'
    );
    const sgChengdu = sgDyn.settlements.find((s) => s.ancient === '成都');
    const sgWuchang = sgDyn.settlements.find((s) => s.ancient === '武昌（鄂县）');
    const sgJianye = sgDyn.settlements.find((s) => s.ancient === '建业');
    assert(
      ctrl._isSettlementCapital(sgChengdu, 234) &&
        !ctrl._isSettlementCapital(sgChengdu, 265) &&
        ctrl._isSettlementCapital(sgWuchang, 225) &&
        !ctrl._isSettlementCapital(sgWuchang, 234) &&
        ctrl._isSettlementCapital(sgJianye, 234),
      'Expected sanguo capitalPeriods to reflect Chengdu (221-263), Wuchang (221-228, 265-266), and Jianye (229-280)'
    );

    sandbox.setInterval = setInterval;
    sandbox.clearInterval = clearInterval;
    delete ctrl.stopAutoplay;
    ctrl.activePerson = {
      profile: ctrl._resolvePersonProfile('sushi'),
      events: ctrl._collectPersonEvents(ctrl._resolvePersonProfile('sushi')),
    };
    ctrl.activePersonEventIdx = 0;
    ctrl.selectPersonEvent = () => {};
    ctrl.jumpToYear = () => {};
    ctrl.closeMilestoneBalloon = () => {};
    ctrl._syncAutoMilestoneBalloon = () => {};
    ctrl.togglePersonAutoplay();
    assert(ctrl.personTimer !== null && !ctrl.playing, 'Expected personTimer to start without timeline playing');
    ctrl.startAutoplay();
    assert(
      ctrl.playing && ctrl.personTimer === null,
      'Expected startAutoplay() to clear personTimer so both timers never run simultaneously'
    );
    ctrl.stopAutoplay();
    assert(!ctrl.playing && ctrl.personTimer === null, 'Expected stopAutoplay() to clear both timers');
    ctrl.activePerson = null;

    assert(
      !fs.existsSync(path.join(ROOT, '.github', 'workflows', 'validate.yml')),
      'Duplicate validate.yml workflow must not exist'
    );
    assert(
      appCode.includes('e.isComposing || e.keyCode === 229'),
      'js/app.js keydown handlers must guard against IME composition events'
    );
  }

  // CUJ 27: Era labels in periods of co-existing regimes — Zizhi Tongjian reference track + regional tracks by location
  {
    ctrl.locale = 'zh';
    const dynByKey = (k) => dynasties.find((d) => d.key === k);
    const dynOf = (y) => dynasties[ctrl._findDynastyIndex(y)];
    const milestoneOf = (k, y, kw) => {
      const m = dynByKey(k).milestones.find((x) => x.year === y && x.headline.includes(kw));
      assert(m, `Missing ${k} milestone ${y} "${kw}"`);
      return m;
    };
    const nanbei = dynByKey('nanbei');

    for (let y = nanbei.fromYear; y < nanbei.toYear; y++) {
      const sp = ctrl._resolveEraSpan(y, nanbei);
      assert(sp[1].startsWith('南朝'), `Reference era for ${y} must follow the Southern Dynasties, got ${sp[1]}`);
    }
    assert.strictEqual(ctrl.formatEraLabel(479, nanbei), '南朝齐高帝·建元元年');
    assert.strictEqual(ctrl.formatEraLabel(523, nanbei), '南朝梁武帝·普通四年');

    const snapPolityTitles = new Set();
    for (const s of Object.values(snapshots)) for (const p of (s && s.polities) || []) snapPolityTitles.add(p.title);
    const regimes = new Set();
    for (const t of loreData.REGIONAL_ERA_TRACKS) {
      regimes.add(t.regime);
      assert(t.polities.length && t.spans.length && t.until >= t.spans[0][0], `Malformed era track ${t.regime}`);
      for (const title of t.polities) {
        assert(snapPolityTitles.has(title), `Era track ${t.regime} polity "${title}" matches no snapshot polity`);
      }
      t.spans.forEach((sp, i) => {
        assert(i === 0 || sp[0] >= t.spans[i - 1][0], `Era track ${t.regime} must be sorted at ${sp[1]}`);
        assert(sp[0] <= t.until && typeof sp[4] === 'string' && sp[4].length >= 3, `Bad span ${JSON.stringify(sp)}`);
      });
      for (let y = t.spans[0][0]; y <= t.until; y++) {
        const lbl = ctrl.formatEraLabel(y, dynOf(y), null, t.regime);
        assert(/年$/.test(lbl) && !/undefined|NaN|·年/.test(lbl), `Bad ${t.regime} era label for ${y}: ${lbl}`);
      }
    }

    for (const d of dynasties) {
      for (const m of d.milestones || []) {
        if (m.eraRegime !== undefined) {
          assert(m.eraRegime === 'reference' || regimes.has(m.eraRegime), `Unknown eraRegime "${m.eraRegime}" on ${d.key} ${m.year}`);
        }
      }
    }

    for (const [k, y, kw, expected] of [
      ['nanbei', 523, '六镇之乱', '北魏孝明帝·正光四年'],
      ['sanguo', 221, '刘备在成都称帝', '蜀汉昭烈帝·章武元年'],
      ['sanguo', 222, '夷陵之战', '吴大帝·黄武元年'],
      ['nanbei', 479, '萧道成', '南朝齐高帝·建元元年'],
      ['nanbei', 553, '尉迟迥', '西魏废帝二年'],
      ['nanbei', 546, '玉壁之战', '西魏文帝·大统十二年'],
      ['wudai', 916, '耶律阿保机', '辽太祖·神册元年'],
      ['beisong', 1038, '元昊', '西夏景宗·天授礼法延祚元年'],
      ['beisong', 1115, '完颜阿骨打', '金太祖·收国元年'],
      ['beisong', 1104, '河湟开边', '北宋徽宗·崇宁三年'],
      ['nansong', 1127, '赵构即位', '南宋高宗·建炎元年'],
      ['nansong', 1141, '绍兴和议', '南宋高宗·绍兴十一年'],
      ['nansong', 1275, '马可·波罗', '元世祖·至元十二年'],
    ]) {
      assert.strictEqual(ctrl._eventEraLabel(dynByKey(k), milestoneOf(k, y, kw)), expected, `${k} ${y} ${kw}`);
    }

    // Quick search reaches regional-track eras; a bare regime name lists no era rows.
    for (const [q, year, titleKw] of [
      ['太和十八年', 494, '北魏孝文帝'],
      ['正光四年', 523, '北魏孝明帝'],
      ['章武元年', 221, '蜀汉昭烈帝'],
      ['统和二十五年', 1007, '辽圣宗'],
      ['天授礼法延祚元年', 1038, '西夏景宗'],
      ['西魏废帝二年', 553, '西魏废帝'],
      ['普通四年', 523, '南朝梁武帝'],
    ]) {
      const hit = ctrl._queryQuickSearch(q).find((h) => h.kind === 'era');
      assert(hit && hit.year === year && hit.titleZh.includes(titleKw), `Era search "${q}" got ${hit && hit.titleZh}`);
    }
    assert.strictEqual(
      ctrl._queryQuickSearch('太建五年').filter((h) => h.kind === 'era').length,
      1,
      'An era shared by the reference and a regional track must be listed once'
    );
    for (const q of ['北魏', '金', '南宋', 'liao']) {
      assert(!ctrl._queryQuickSearch(q).some((h) => h.kind === 'era'), `Bare regime "${q}" must not list era rows`);
    }

    const frontier = loreData.PLACE_LANDMARK_EVENTS.find((lm) => lm.year === 523 && (lm.zh || '').includes('六镇乱起'));
    assert(frontier, 'Missing 523 Six Garrisons landmark event');
    assert.strictEqual(ctrl.formatEraLabel(523, nanbei, frontier.coord), '北魏孝明帝·正光四年');
    assert.strictEqual(ctrl.inspect({ year: 523, lng: 109.5, lat: 40.95 }).era, '北魏孝明帝·正光四年');

    ctrl.locale = 'en';
    assert(
      ctrl.formatEraLabel(523, nanbei, [109.5, 40.95]).endsWith('Emp. Xiaoming of N. Wei'),
      'English era label must name the regime ruling the location'
    );
    ctrl.locale = 'zh';
  }

  // CUJ 28: Timeline autoplay — constant playhead speed along the scrubber bar, lands on every
  // milestone year, holds on dynasty openings and isMapChange milestones, and keeps the event
  // callout while playing.
  {
    const proto = ControllerClass.prototype;
    let tick = null;
    sandbox.setInterval = (fn) => {
      tick = fn;
      return 1;
    };
    sandbox.clearInterval = () => {};
    delete ctrl.stopAutoplay;
    Object.assign(ctrl, { activePerson: null, challenge: null, personTimer: null });
    ctrl.closeMilestoneBalloon = () => {};
    ctrl._syncAutoMilestoneBalloon = () => {};
    const visited = new Set();
    ctrl.jumpToYear = function (y) {
      this.year = y;
      this.dynastyIdx = this._findDynastyIndex(y);
      visited.add(y);
    };
    ctrl.year = ctrl.minYear;
    ctrl.startAutoplay();
    const stops = proto._autoplayStops.call(ctrl).filter((s) => s.year > ctrl.minYear);
    const stopYears = new Set(stops.map((s) => s.year));
    const yearTicks = new Map();
    const movingTicks = dynasties.map(() => 0);
    const landings = [];
    let totalTicks = 0;
    while (ctrl.playing && totalTicks < 20000) {
      const [p0, y0] = [ctrl.playProgress, ctrl.year];
      tick();
      totalTicks++;
      yearTicks.set(ctrl.year, (yearTicks.get(ctrl.year) || 0) + 1);
      if (ctrl.playProgress > p0) movingTicks[ctrl._findDynastyIndex(ctrl.year)]++;
      if (ctrl.year !== y0 && stopYears.has(ctrl.year)) landings.push(totalTicks);
    }
    assert(!ctrl.playing && ctrl.year === ctrl.maxYear, `Autoplay must stop at ${ctrl.maxYear}, got ${ctrl.year}`);

    const missed = stops.filter((s) => !visited.has(s.year)).map((s) => s.year);
    assert.strictEqual(missed.length, 0, `Autoplay skipped milestone years ${missed.slice(0, 8).join(', ')}`);
    const shortest = Math.min(...landings.slice(1).map((t, i) => t - landings[i]));
    assert(shortest >= 4, `Each autoplay callout must stay at least ~1 s, shortest was ${shortest} ticks`);
    for (const s of stops.filter((x) => x.hold)) {
      assert(yearTicks.get(s.year) >= 9, `Autoplay must hold ~2.5 s on map-change milestone ${s.year}`);
    }
    for (const y of [-221, 755, 1127]) {
      assert(stops.some((s) => s.year === y && s.hold), `Autoplay must hold on the border change in ${y}`);
    }

    const moving = movingTicks.reduce((a, b) => a + b, 0);
    assert(Math.abs(moving - (9 * 60 * 1000) / 280) < 40, `Autoplay full run should take ~9 min of ticks, got ${moving}`);
    dynasties.forEach((d, i) => {
      const expected = ctrl.bandWeights[i] / ctrl.totalBandWeight;
      const share = movingTicks[i] / moving;
      assert(
        Math.abs(share - expected) / expected < 0.15,
        `Autoplay time for ${d.key} must match its scrubber band (${(expected * 100).toFixed(1)}%), got ${(share * 100).toFixed(1)}%`
      );
    });

    const tang = dynasties.find((d) => d.key === 'tang');
    Object.assign(ctrl, {
      playing: true,
      year: 755,
      dynastyIdx: dynasties.indexOf(tang),
      activeMilestone: null,
      dismissedCalloutIds: new Set(),
      milestoneBalloon: {
        innerHTML: '',
        classList: { remove() {}, add() {}, contains: () => false },
        querySelector: () => null,
      },
      grpMilestones: { querySelectorAll: () => [], classList: { contains: () => false } },
      _positionMilestoneBalloon: () => {},
      _highlightCurrentMilestone: () => {},
    });
    proto._syncAutoMilestoneBalloon.call(ctrl, tang);
    assert(
      ctrl.activeMilestone && ctrl.activeMilestone.isAuto && ctrl.activeMilestone.milestone.year === 755,
      'The event callout must follow the current milestone while autoplay runs'
    );
    ctrl.milestoneBalloon.innerHTML = 'unchanged';
    proto._syncAutoMilestoneBalloon.call(ctrl, tang);
    assert.strictEqual(ctrl.milestoneBalloon.innerHTML, 'unchanged', 'An auto callout already showing the milestone must not be rebuilt');
    ctrl.locale = 'en';
    proto._syncAutoMilestoneBalloon.call(ctrl, tang);
    assert.notStrictEqual(ctrl.milestoneBalloon.innerHTML, 'unchanged', 'A locale switch must rebuild the auto callout');
    Object.assign(ctrl, { locale: 'zh', playing: false, activeMilestone: null });
  }

  // CUJ 29: Scrubber drag — pointermove bursts coalesce via requestAnimationFrame, unchanged
  // years are skipped, pointerup flushes a pending frame, and pointercancel drops it.
  {
    const proto = ControllerClass.prototype;
    let rafFn = null;
    let rafSeq = 0;
    const cancelled = new Set();
    sandbox.requestAnimationFrame = (fn) => {
      rafFn = fn;
      return ++rafSeq;
    };
    sandbox.cancelAnimationFrame = (id) => {
      cancelled.add(id);
      rafFn = null;
    };
    const flushRaf = () => {
      const fn = rafFn;
      rafFn = null;
      if (fn) fn();
    };
    const handlers = {};
    let rectReads = 0;
    const track = {
      addEventListener(type, fn) {
        handlers[type] = fn;
      },
      setPointerCapture() {},
      getBoundingClientRect() {
        rectReads++;
        return { left: 0, width: 1000 };
      },
    };
    const jumps = [];
    Object.assign(ctrl, {
      challenge: null,
      year: ctrl.minYear,
      _recordGestureClick: () => {},
      stopAutoplay: () => {},
      _clearQuickSearchInput: () => {},
      jumpToYear(y) {
        this.year = y;
        jumps.push(y);
      },
    });
    proto._bindScrubberDrag.call(ctrl, track);

    // 1. pointerdown always jumps (even if already on that year); same year on pointermove is skipped.
    handlers.pointerdown({ pointerId: 1, clientX: 500 });
    assert.strictEqual(jumps.length, 1, 'pointerdown must jump immediately');
    handlers.pointerdown({ pointerId: 1, clientX: 500 });
    assert.strictEqual(jumps.length, 2, 'pointerdown on the current year must still run jumpToYear');
    const y500 = ctrl.year;
    handlers.pointermove({ clientX: 500 });
    flushRaf();
    assert.strictEqual(jumps.length, 2, 'Unchanged year on pointermove must not re-run jumpToYear');

    // 2. Burst of 8 pointermoves within one animation frame produces at most 1 jumpToYear.
    for (const x of [510, 520, 530, 540, 550, 560, 570, 600]) {
      handlers.pointermove({ clientX: x });
    }
    assert.strictEqual(jumps.length, 2, 'pointermove must defer to requestAnimationFrame');
    flushRaf();
    assert.strictEqual(jumps.length, 3, 'A burst of pointermoves in one frame must run jumpToYear once');
    assert.strictEqual(ctrl.year, ctrl._progressToYear(0.6), 'Coalesced frame must land on the latest pointer X');
    assert.strictEqual(rectReads, 2, 'Track bounding rect must be cached across each drag gesture');

    // 3. pointerup flushes an un-rendered pointermove synchronously and cancels its rAF.
    handlers.pointermove({ clientX: 800 });
    const pendingId = rafSeq;
    handlers.pointerup({});
    assert(cancelled.has(pendingId) && rafFn === null, 'pointerup must cancel the pending rAF');
    assert.strictEqual(ctrl.year, ctrl._progressToYear(0.8), 'pointerup must flush the final pointer position');
    assert.notStrictEqual(y500, ctrl.year);

    // 4. pointercancel drops a pending move without jumping.
    handlers.pointerdown({ pointerId: 2, clientX: 200 });
    const y200 = ctrl.year;
    handlers.pointermove({ clientX: 900 });
    handlers.pointercancel({});
    flushRaf();
    assert.strictEqual(ctrl.year, y200, 'pointercancel must discard any un-flushed move');
  }

  // CUJ 30: Layered top-down overlay dismissal (_dismissTopOverlay) & custom-route + stop-genealogy teardown.
  {
    const proto = ControllerClass.prototype;
    const makeCls = (initial = []) => ({
      _s: new Set(initial),
      add(...cs) {
        cs.forEach((c) => this._s.add(c));
      },
      remove(...cs) {
        cs.forEach((c) => this._s.delete(c));
      },
      toggle(c, f) {
        if (f === undefined ? !this._s.has(c) : f) this._s.add(c);
        else this._s.delete(c);
      },
      contains(c) {
        return this._s.has(c);
      },
    });
    const layersPopover = { classList: makeCls() };
    const layersBtn = { classList: makeCls(['is-active']), setAttribute() {} };
    const genCard = { classList: makeCls() };
    const vf = { classList: makeCls(['has-active-genealogy', 'has-active-journey']) };
    const domMap = {
      'layers-popover': layersPopover,
      'act-layers-menu': layersBtn,
      'genealogy-card': genCard,
      'viewport-frame': vf,
    };
    let routeRedraws = 0;
    let routeCleared = 0;
    let challengeStopped = 0;
    let balloonClosed = 0;
    Object.assign(ctrl, {
      _id: (id) => domMap[id] || null,
      playing: true,
      personTimer: null,
      mobileChronicleOpen: true,
      activePerson: null,
      activeTrace: [108.94, 34.26],
      activeTraceLabel: '长安',
      activeReturnPerson: null,
      activeCustomRoute: [
        { lng: 108.94, lat: 34.26, coord: [108.94, 34.26], year: 755, name: '长安' },
        { lng: 112.45, lat: 34.62, coord: [112.45, 34.62], year: 755, name: '洛阳' },
      ],
      customRouteStopIdx: 0,
      challenge: { variant: 'locate', deck: [], index: 0, score: 0, answered: false },
      activeMilestone: { dynastyKey: 'tang', milestone: { year: 755, coord: [108.94, 34.26] }, isAuto: true },
      milestoneBalloon: { classList: makeCls() },
      grpGenealogy: { innerHTML: '<g/>' },
      grpSettlements: { querySelectorAll: () => [] },
      grpPrefectures: { querySelectorAll: () => [] },
      closeGenealogyCard: proto.closeGenealogyCard,
      _clearActiveTrace: proto._clearActiveTrace,
      _clearActivePerson: proto._clearActivePerson,
      _closeLayersPopover: proto._closeLayersPopover,
      _syncTracedPrefecture: () => {},
      _syncDocumentSeoMeta: () => {},
      _updateAutoplayUi: () => {},
      stopAutoplay() {
        this.playing = false;
      },
      toggleMobileChronicle(f) {
        this.mobileChronicleOpen = Boolean(f);
      },
      _drawCustomRouteOverlay() {
        routeRedraws++;
      },
      _renderCustomRouteCard() {},
      clearCustomRoute() {
        this.activeCustomRoute = null;
        this.customRouteStopIdx = -1;
        routeCleared++;
      },
      stopChallenge() {
        this.challenge = null;
        challengeStopped++;
      },
      closeMilestoneBalloon() {
        this.activeMilestone = null;
        this.milestoneBalloon.classList.add('is-hidden');
        balloonClosed++;
      },
    });

    // 1. Layers popover dismisses first.
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), true);
    assert(layersPopover.classList.contains('is-hidden'), 'Step 1 must close #layers-popover');
    assert.strictEqual(ctrl.playing, true, 'Closing #layers-popover must not stop autoplay');

    // 2. Active autoplay stops next.
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), true);
    assert.strictEqual(ctrl.playing, false, 'Step 2 must stop autoplay');
    assert.strictEqual(ctrl.mobileChronicleOpen, true, 'Stopping autoplay must not close mobile drawer');

    // 3. Mobile chronicle drawer closes next.
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), true);
    assert.strictEqual(ctrl.mobileChronicleOpen, false, 'Step 3 must close mobile chronicle drawer');
    assert(ctrl.activeTrace !== null, 'Closing mobile drawer must leave genealogy card intact');

    // 4. Genealogy card on a custom-route stop closes first and resets customRouteStopIdx to -1
    //    WITHOUT wiping the custom route itself.
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), true);
    assert.strictEqual(ctrl.activeTrace, null, 'Step 4 must close stop genealogy card');
    assert(genCard.classList.contains('is-hidden'), '#genealogy-card must be hidden');
    assert(Array.isArray(ctrl.activeCustomRoute), 'Custom route must remain active when stop genealogy closes');
    assert.strictEqual(ctrl.customRouteStopIdx, -1, 'Closing stop genealogy must reset customRouteStopIdx to overview (-1)');
    assert.strictEqual(routeRedraws, 1, 'Custom route overlay must redraw in overview state');

    // 5. Next dismissal clears the custom route.
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), true);
    assert.strictEqual(ctrl.activeCustomRoute, null, 'Step 5 must clear custom route');
    assert.strictEqual(routeCleared, 1);

    // 6. Next dismissal exits challenge mode.
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), true);
    assert.strictEqual(ctrl.challenge, null, 'Step 6 must stop challenge');
    assert.strictEqual(challengeStopped, 1);

    // 7. Next dismissal closes the milestone callout; subsequent call is a no-op (false).
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), true);
    assert.strictEqual(balloonClosed, 1, 'Step 7 must close milestone callout');
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), false, 'When all overlays are closed, _dismissTopOverlay must return false');
  }

  // CUJ 31: Historical neighboring polities (.polity-caption.neighbor) vs. modern country watermarks (.neighbor-caption)
  //         must maintain distinct typography/color hierarchy and dodge collisions or deduplicate identical names
  {
    const proto = ControllerClass.prototype;
    assert(
      /\.polity-caption\.neighbor\s*\{[\s\S]*?font-size:\s*14px;[\s\S]*?font-weight:\s*700;[\s\S]*?fill:\s*#5a2d18;/m.test(
        styleCss
      ),
      'css/style.css .polity-caption.neighbor must use 14px bold (#5a2d18) to distinguish ancient kingdoms from modern country watermarks'
    );
    assert(
      /\.neighbor-caption\s*\{[\s\S]*?font-size:\s*8px;[\s\S]*?font-weight:\s*400;[\s\S]*?fill:\s*#686e73;/m.test(
        styleCss
      ),
      'css/style.css .neighbor-caption must use 8px regular (#686e73) as a subtle background country watermark'
    );

    const makeCls = (initial = []) => {
      const s = new Set(initial);
      return {
        add: (...items) => items.forEach((x) => s.add(x)),
        remove: (...items) => items.forEach((x) => s.delete(x)),
        toggle: (x, f) => {
          const on = f === undefined ? !s.has(x) : Boolean(f);
          if (on) s.add(x);
          else s.delete(x);
          return on;
        },
        contains: (x) => s.has(x),
      };
    };
    const makeCaptionNode = (clsList, text, x, y, dataset = {}) => {
      const attrs = {
        'data-x': String(x),
        'data-y': String(y),
        'data-base-x': String(x),
        'data-base-y': String(y),
      };
      return {
        classList: makeCls(clsList),
        textContent: text,
        dataset,
        getAttribute: (k) => (k in attrs ? attrs[k] : null),
        setAttribute: (k, v) => {
          attrs[k] = String(v);
        },
      };
    };

    const [fx, fy] = ctrl.projector.toScreen(104.84, 12.38);
    const [kx, ky] = ctrl.projector.toScreen(105.0, 12.87);
    const [cx, cy] = ctrl.projector.toScreen(126.85, 40.38);
    const funanNode = makeCaptionNode(['polity-caption', 'neighbor'], '扶南', fx, fy, {
      polityTitle: '扶南',
      polityRole: 'neighbor',
    });
    const joseonPolNode = makeCaptionNode(['polity-caption', 'neighbor'], '朝鲜', cx, cy, {
      polityTitle: '朝鲜',
      polityRole: 'neighbor',
    });
    const cambodiaWatermark = makeCaptionNode(['neighbor-caption'], '柬埔寨', kx, ky, {
      rawName: '柬埔寨',
    });
    const joseonWatermark = makeCaptionNode(['neighbor-caption'], '朝鲜', cx, cy, {
      rawName: '朝鲜',
    });

    const mockCtrl = {
      camera: { x: 200, y: 200, w: 444, h: 311, zoom: 2.25 },
      projector: ctrl.projector,
      _estimateLocalTextWidth: proto._estimateLocalTextWidth,
      svg: {
        classList: makeCls(),
        querySelectorAll: () => [],
      },
      grpSettlements: { classList: makeCls(), querySelectorAll: () => [] },
      grpPrefectures: { classList: makeCls(), querySelectorAll: () => [] },
      grpCorridors: { classList: makeCls(), querySelectorAll: () => [] },
      grpMilestones: { classList: makeCls(), querySelectorAll: () => [] },
      grpPolities: {
        classList: makeCls(),
        querySelectorAll: (sel) =>
          sel === '.polity-caption' ? [funanNode, joseonPolNode] : [],
      },
      grpNeighbors: {
        querySelectorAll: (sel) =>
          sel === '.neighbor-caption' ? [cambodiaWatermark, joseonWatermark] : [],
      },
      grpProvNames: { querySelectorAll: () => [] },
    };

    proto._rescaleSvgTypography.call(mockCtrl);

    // 扶南 stays anchored while 柬埔寨 dodges vertically/horizontally away from 扶南
    const finalFunanY = parseFloat(funanNode.getAttribute('data-y'));
    const finalCambodiaY = parseFloat(cambodiaWatermark.getAttribute('data-y'));
    assert(
      Math.abs(finalFunanY - fy) < 0.2,
      'Ancient neighbor polity 扶南 must remain anchored at its historical territory center'
    );
    assert(
      !cambodiaWatermark.classList.contains('is-crowded-hidden') &&
        Math.hypot(
          parseFloat(cambodiaWatermark.getAttribute('data-x')) - finalFunanY * 0 - fx,
          finalCambodiaY - finalFunanY
        ) >= 9.0,
      `Modern watermark 柬埔寨 must dodge co-located ancient polity 扶南 (got dy=${(finalCambodiaY - finalFunanY).toFixed(1)})`
    );
    // Same-named modern watermark 朝鲜 hides when historical polity 朝鲜 is active
    assert(
      joseonWatermark.classList.contains('is-crowded-hidden'),
      'Modern watermark 朝鲜 must hide when an active historical polity with the identical name (朝鲜) is displayed'
    );
  }

  // CUJ 32: Timeline & Person Chronicle Playback Speed Control (1x -> 2x -> 0.25x -> 0.5x -> 1x)
  {
    const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const styleCss = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
    assert(
      indexHtml.includes('class="playback-controls-group"') &&
        indexHtml.includes('id="act-play-speed"') &&
        indexHtml.includes('id="lbl-play-speed"'),
      'index.html must include #act-play-speed and #lbl-play-speed inside .playback-controls-group in #scrubber-dock'
    );
    assert(
      styleCss.includes('grid-template-rows: 28px auto;') &&
        styleCss.includes('grid-column: 1 / -1;'),
      'style.css must define 2-row mobile timeline layout with full-width #scrubber-rail-wrap under @media (max-width: 640px)'
    );

    const proto = ControllerClass.prototype;
    let scheduledMs = [];
    let clearedIds = [];
    let nextTimerId = 100;
    sandbox.setInterval = (fn, ms) => {
      scheduledMs.push(ms);
      return ++nextTimerId;
    };
    sandbox.clearInterval = (id) => {
      clearedIds.push(id);
    };

    const speedBtn = {
      disabled: false,
      title: '',
      _attrs: {},
      setAttribute(k, v) {
        this._attrs[k] = String(v);
      },
      getAttribute(k) {
        return this._attrs[k] || null;
      },
      classList: {
        _s: new Set(),
        toggle(c, f) {
          if (f === undefined ? !this._s.has(c) : f) this._s.add(c);
          else this._s.delete(c);
        },
        contains(c) {
          return this._s.has(c);
        },
      },
    };
    const speedLbl = { textContent: '1×' };
    const domMap = {
      'act-play-speed': speedBtn,
      'lbl-play-speed': speedLbl,
    };
    ctrl._id = (id) => domMap[id] || null;

    ctrl.locale = 'zh';
    ctrl.challenge = null;
    ctrl.playing = true;
    ctrl.playInterval = 99;
    ctrl.playProgress = 0.42;
    ctrl.playHoldTicks = 3;
    ctrl.playShownTicks = 2;
    ctrl.playSpeed = 1;
    proto._updatePlaySpeedUi.call(ctrl);
    assert.strictEqual(speedLbl.textContent, '1×', 'Initial speed label must be 1×');
    assert(
      !speedBtn.classList.contains('is-custom-speed'),
      '1× default speed must not have is-custom-speed active highlight'
    );

    // Cycle 1 -> 2 -> 0.25 -> 0.5 -> 1 while timeline autoplay is running
    assert.strictEqual(proto.cyclePlaySpeed.call(ctrl), 2, 'First click must switch speed to 2×');
    assert.strictEqual(speedLbl.textContent, '2×', 'Label must update to 2×');
    assert(
      speedBtn.classList.contains('is-custom-speed'),
      'Non-1× speed must highlight #act-play-speed with .is-custom-speed'
    );
    assert.strictEqual(scheduledMs[scheduledMs.length - 1], 140, '2× speed must reschedule tick interval to 140ms');
    assert.strictEqual(ctrl.playProgress, 0.42, 'Changing speed live must preserve playProgress');
    assert.strictEqual(ctrl.playHoldTicks, 3, 'Changing speed live must preserve playHoldTicks');

    assert.strictEqual(proto.cyclePlaySpeed.call(ctrl), 0.25, 'Second click must switch speed to 0.25×');
    assert.strictEqual(speedLbl.textContent, '0.25×', 'Label must update to 0.25×');
    assert.strictEqual(scheduledMs[scheduledMs.length - 1], 1120, '0.25× speed must reschedule tick interval to 1120ms');

    assert.strictEqual(proto.cyclePlaySpeed.call(ctrl), 0.5, 'Third click must switch speed to 0.5×');
    assert.strictEqual(scheduledMs[scheduledMs.length - 1], 560, '0.5× speed must reschedule tick interval to 560ms');

    ctrl.locale = 'en';
    proto._updatePlaySpeedUi.call(ctrl);
    assert(
      speedBtn.getAttribute('aria-label') === 'Playback speed 0.5×' &&
        speedBtn.title.includes('Playback speed 0.5×'),
      'English locale must localize #act-play-speed aria-label and title'
    );

    ctrl.locale = 'zh';
    assert.strictEqual(proto.cyclePlaySpeed.call(ctrl), 1, 'Fourth click must return speed to 1×');
    assert.strictEqual(scheduledMs[scheduledMs.length - 1], 280, '1× speed must restore 280ms tick interval');
    assert(
      !speedBtn.classList.contains('is-custom-speed'),
      'Returning to 1× must remove .is-custom-speed'
    );

    // Verify Person Chronicle autoplay also respects playSpeed and live rescheduling
    ctrl.playing = false;
    ctrl.playInterval = null;
    ctrl.activePerson = { name: '苏轼', events: [{ year: 1037 }, { year: 1082 }] };
    ctrl.activePersonEventIdx = 0;
    ctrl.personTimer = 77;
    proto.setPlaySpeed.call(ctrl, 2);
    assert.strictEqual(
      scheduledMs[scheduledMs.length - 1],
      1300,
      '2× speed during Person Chronicle autoplay must reschedule personTimer to 1300ms'
    );
    proto.setPlaySpeed.call(ctrl, 1);
    ctrl.activePerson = null;
    ctrl.personTimer = null;

    // Verify Quiz Mode lock disables #act-play-speed and blocks cyclePlaySpeed
    proto._syncChallengeScrubberState.call(ctrl, true);
    assert.strictEqual(speedBtn.disabled, true, 'Quiz mode lock must disable #act-play-speed');
    ctrl.challenge = { active: true };
    assert.strictEqual(
      proto.cyclePlaySpeed.call(ctrl),
      1,
      'cyclePlaySpeed() must be a no-op while Quiz Mode challenge is active'
    );
    ctrl.challenge = null;
    proto._syncChallengeScrubberState.call(ctrl, false);
    assert.strictEqual(speedBtn.disabled, false, 'Unlocking Quiz mode must re-enable #act-play-speed');
  }

  // CUJ 33: Qin & Western Han Historical Accuracy against 《史记》 and 《汉书》
  {
    const hasPt = (snapKey, polTitle, lng, lat) => {
      const pol = snapshots[snapKey].polities.find((p) => p.title === polTitle);
      return Boolean(pol && pointInShape(lng, lat, pol.shape));
    };

    // 1. 秦初三十六郡 (-221..-215 BCE): 南海郡 not yet founded; 番禺 & 桂林 in 南越; 肤施 & 陇西 in 秦; 九原 in 匈奴
    assert(
      !snapshots.s_qin_a.prefectures.some((p) => p.title === '南海郡') &&
        !snapshots.s_qin_b.prefectures.some((p) => p.title === '南海郡') &&
        snapshots.s_qin.prefectures.some((p) => p.title === '南海郡'),
      '南海郡 must only appear in s_qin (-214 BCE) after Qin conquers Lingnan, restoring 36 commanderies in s_qin_a'
    );
    assert(
      hasPt('s_qin_a', '南越', 113.261, 23.131) &&
        hasPt('s_qin_a', '南越', 110.291, 25.271) &&
        !hasPt('s_qin_a', '秦', 113.261, 23.131) &&
        hasPt('s_qin_b', '南越', 113.261, 23.131) &&
        hasPt('s_qin', '秦', 113.261, 23.131) &&
        hasPt('s_qin', '秦', 110.291, 25.271),
      'Lingnan (Panyu & Guilin) must belong to Nanyue in s_qin_a/s_qin_b (-221..-214 BCE) and Qin in s_qin (-214..-206 BCE)'
    );
    assert(
      hasPt('s_qin_a', '秦', 110.261, 37.501) &&
        hasPt('s_qin_a', '秦', 111.19, 40.27) &&
        hasPt('s_qin_a', '秦', 103.861, 35.381) &&
        hasPt('s_qin_a', '匈奴', 109.841, 40.661) &&
        hasPt('s_qin_b', '秦', 109.841, 40.661),
      's_qin_a must keep Fushi (Shangjun), Yunzhong, and Longxi inside Qin while Jiuyuan (Hetao) stays in Xiongnu until Meng Tian (-215 BCE, s_qin_b)'
    );

    // 2. 楚汉之争 (s_qin_chuhan, -206..-202 BCE): 三川郡、颍川郡、东郡、上郡、陇西 in 汉（刘邦）; 云中 in 赵 · 代; 九原 in 匈奴
    assert(
      hasPt('s_qin_chuhan', '汉（刘邦）', 112.451, 34.621) &&
        hasPt('s_qin_chuhan', '汉（刘邦）', 113.38, 34.79) &&
        hasPt('s_qin_chuhan', '汉（刘邦）', 113.471, 34.151) &&
        hasPt('s_qin_chuhan', '汉（刘邦）', 114.311, 34.801) &&
        hasPt('s_qin_chuhan', '汉（刘邦）', 115.03, 35.76) &&
        hasPt('s_qin_chuhan', '汉（刘邦）', 110.261, 37.501) &&
        hasPt('s_qin_chuhan', '汉（刘邦）', 103.861, 35.381) &&
        hasPt('s_qin_chuhan', '赵 · 代', 111.19, 40.27) &&
        hasPt('s_qin_chuhan', '匈奴', 109.841, 40.661) &&
        hasPt('s_qin_chuhan', '闽越', 120.66, 28.01) &&
        hasPt('s_qin_chuhan', '南越（赵佗）', 105.851, 21.031),
      's_qin_chuhan must cover Sanchuan (Luoyang, Xingyang), Yingchuan (Yangzhai), Dongjun (Daliang, Puyang), Shangjun (Fushi), Longxi, Yunzhong, Jiuyuan, Dongou, and Jiaozhi'
    );

    // 3. 西汉初 (s_xihan_a, -202..-128 BCE) & 汉武帝北伐南征: 河南地 (朔方) in 匈奴 until -127 BCE; 五岭之南 in 南越 until -111 BCE
    assert(
      hasPt('s_xihan_a', '汉（郡国并行）', 110.261, 37.501) &&
        hasPt('s_xihan_a', '汉（郡国并行）', 111.19, 40.27) &&
        hasPt('s_xihan_a', '汉（郡国并行）', 103.861, 35.381) &&
        hasPt('s_xihan_a', '匈奴', 107.401, 40.751) &&
        hasPt('s_xihan_b1', '汉', 107.401, 40.751),
      's_xihan_a must keep Fushi, Yunzhong, and Longxi in Han while Shuofang (Hetao) stays in Xiongnu until Wei Qing (-127 BCE, s_xihan_b1)'
    );
    assert(
      hasPt('s_xihan_a', '南越', 113.261, 23.131) &&
        hasPt('s_xihan_a', '南越', 111.28, 23.48) &&
        hasPt('s_xihan_a', '南越', 109.416, 24.326) &&
        hasPt('s_xihan_b2', '南越', 113.261, 23.131) &&
        hasPt('s_xihan_b3', '汉', 113.261, 23.131) &&
        hasPt('s_xihan_b3', '汉', 111.28, 23.48),
      'Panyu, Guangxin (Cangwu), and Tanzhong (Yulin) must stay in Nanyue until -111 BCE (s_xihan_b3)'
    );

    // 4. 西域都护府 (-60 BCE, s_xihan_c) vs 西域诸国 (-111..-61 BCE, s_xihan_b3/s_xihan_b); 乐浪郡 (-108 BCE); 敦煌 & 居延
    assert(
      !snapshots.s_xihan_b3.polities.some((p) => p.title === '西域都护府') &&
        !snapshots.s_xihan_b.polities.some((p) => p.title === '西域都护府') &&
        snapshots.s_xihan_b3.polities.some((p) => p.title === '西域诸国' && p.role === 'neighbor') &&
        snapshots.s_xihan_b.polities.some((p) => p.title === '西域诸国' && p.role === 'neighbor') &&
        snapshots.s_xihan_c.polities.some((p) => p.title === '西域都护府' && p.role === 'protectorate'),
      'Protectorate of the Western Regions (西域都护府) must not appear before -60 BCE (s_xihan_c)'
    );
    assert(
      !hasPt('s_xihan_b3', '汉', 125.751, 39.031) &&
        hasPt('s_xihan_b', '汉', 125.751, 39.031) &&
        hasPt('s_xihan_c', '汉', 125.751, 39.031) &&
        hasPt('s_xihan_d', '新（王莽）', 125.751, 39.031) &&
        hasPt('s_xihan_b2', '汉', 94.661, 40.141) &&
        hasPt('s_xihan_b', '汉', 94.661, 40.141) &&
        hasPt('s_xihan_b', '汉', 101.06, 41.95) &&
        hasPt('s_xihan_c', '汉', 101.06, 41.95),
      'Lelang Commandery (-108 BCE), Dunhuang, and Juyan must lie inside Han/Xin polygons'
    );
  }

  // CUJ 34: Traditional Chinese (zh-tw) Runtime Conversion, Historical Polysemy Protection & Bidirectional Search
  {
    const conv = sandbox.window.ZH_HANT_CONV;
    assert(conv && typeof conv.toHant === 'function' && typeof conv.toHans === 'function', 'window.ZH_HANT_CONV must be loaded');
    const polysemyPairs = [
      ['咸阳', '咸陽'],
      ['并州刺史', '并州刺史'],
      ['九州合并', '九州合併'],
      ['台州与天台山', '台州與天台山'],
      ['台湾台北', '臺灣臺北'],
      ['余姚与余杭', '餘姚與餘杭'],
      ['范仲淹在范阳郡', '范仲淹在范陽郡'],
      ['钟山与钟繇', '鍾山與鍾繇'],
      ['吕后、韦后与皇太后', '呂后、韋后與皇太后'],
      ['后汉与后周', '後漢與後周'],
      ['诸葛亮北伐与远征', '諸葛亮北伐與遠征'],
      ['魏征进谏', '魏徵進諫'],
      ['庆历新政与万历', '慶曆新政與萬曆'],
      ['中国历史历代', '中國歷史歷代'],
      ['匈奴单于与于阗、于谦', '匈奴單于與于闐、于謙'],
      ['陆游与游牧民族', '陸游與游牧民族'],
      ['岳飞与五岳', '岳飛與五嶽'],
      ['秃发乌孤与剃发易服', '禿髮烏孤與剃髮易服'],
      ['韩侂胄与甲胄', '韓侂冑與甲冑'],
      ['党项羌', '党項羌'],
    ];
    for (const [hans, expectedHant] of polysemyPairs) {
      const actual = conv.toHant(hans);
      assert.strictEqual(
        actual,
        expectedHant,
        `ZH_HANT_CONV.toHant("${hans}") expected "${expectedHant}", got "${actual}"`
      );
      assert.strictEqual(
        conv.toHant(actual),
        expectedHant,
        `ZH_HANT_CONV.toHant must be idempotent on "${actual}"`
      );
    }

    const prevLocale = ctrl.locale;
    ctrl.locale = 'zh-tw';
    const tangInsp = ctrl.inspect({ year: 741, place: '長安' });
    assert(
      tangInsp &&
        tangInsp.era === '唐玄宗·開元二十九年' &&
        tangInsp.dynasty.title === '唐' &&
        tangInsp.resolvedName === '長安' &&
        tangInsp.polity === '唐' &&
        tangInsp.regions.includes('關內道') &&
        tangInsp.modernProvince === '陝西省' &&
        tangInsp.nearestCity &&
        tangInsp.nearestCity.remark === '唐都，百萬人口國際都會' &&
        tangInsp.url.includes('lang=zh-tw'),
      `Expected Traditional Chinese inspect payload for 741 長安, got ${JSON.stringify(tangInsp)}`
    );

    // Traditional Chinese search & resolvePlace must work in any UI locale
    for (const loc of ['zh', 'zh-tw', 'en']) {
      ctrl.locale = loc;
      const rChangAn = ctrl.resolvePlace('長安', 741);
      const rXianYang = ctrl.resolvePlace('咸陽', -221);
      const rTongGuan = ctrl.resolvePlace('潼關', 756);
      assert(
        rChangAn && rChangAn.name === '长安' && rXianYang && rXianYang.name === '咸阳' && rTongGuan && rTongGuan.name === '潼关',
        `Expected Traditional place resolution to succeed in locale=${loc}`
      );
      const qSuShi = ctrl._queryQuickSearch('蘇軾');
      const qQingLi = ctrl._queryQuickSearch('慶曆四年');
      assert(
        qSuShi.length > 0 && qSuShi[0].personKey === 'sushi' && qQingLi.length > 0 && qQingLi[0].year === 1044,
        `Expected Traditional quick search for 蘇軾 and 慶曆四年 to succeed in locale=${loc}`
      );
    }
    ctrl.locale = prevLocale;
  }

  // CUJ 35: Yuan Dynasty Historical Accuracy against 《元史》 (History of Yuan)
  {
    const hasPolPt = (snapKey, polTitle, lng, lat) => {
      const pol = snapshots[snapKey].polities.find((p) => p.title === polTitle);
      return Boolean(pol && pointInShape(lng, lat, pol.shape));
    };
    const hasRegPt = (snapKey, regTitle, lng, lat) => {
      const reg = (snapshots[snapKey].regions || []).find((r) => r.title === regTitle);
      return Boolean(reg && pointInShape(lng, lat, reg.shape));
    };
    const hasPrefPt = (snapKey, prefTitle, lng, lat) => {
      const pref = (snapshots[snapKey].prefectures || []).find((p) => p.title === prefTitle);
      return Boolean(pref && pointInShape(lng, lat, pref.shape));
    };

    // 1. Northwest frontier: Beshbalik ([89.181, 44.001]) & Qocho ([89.53, 42.85]) inside Yuan (not Chagatai)
    for (const sk of ['s_yuan_a', 's_yuan', 's_yuan_b', 's_yuan_c']) {
      assert(
        hasPolPt(sk, '元', 89.181, 44.001) &&
          hasPolPt(sk, '元', 89.53, 42.85) &&
          !hasPolPt(sk, '察合台汗国', 89.181, 44.001) &&
          !hasPolPt(sk, '察合台汗国', 89.53, 42.85) &&
          hasRegPt(sk, '北庭都护府', 89.181, 44.001) &&
          hasRegPt(sk, '北庭都护府', 89.53, 42.85) &&
          hasRegPt(sk, '征东行省', 126.55, 37.97),
        `${sk} must place Beshbalik and Qocho inside Yuan / Beiting Protectorate and Kaesong inside Zhengdong Province`
      );
    }

    // 2. 《元史·地理志》 provincial boundaries: Jiqing & Hangzhou in 江浙行省, Kaizhou in 中书省（腹里）, Shanzhou in 河南江北行省, Xiningzhou in 甘肃行省, Hainan in 湖广行省
    for (const sk of ['s_yuan_a', 's_yuan', 's_yuan_b', 's_yuan_c']) {
      assert(
        hasRegPt(sk, '江浙行省', 118.801, 32.061) &&
          !hasRegPt(sk, '河南江北行省', 118.801, 32.061) &&
          hasRegPt(sk, '河南江北行省', 118.317, 32.301) &&
          hasRegPt(sk, '江浙行省', 120.151, 30.271) &&
          hasRegPt(sk, '中书省（腹里）', 115.03, 35.76) &&
          !hasRegPt(sk, '河南江北行省', 115.03, 35.76) &&
          hasRegPt(sk, '河南江北行省', 111.17, 34.78) &&
          !hasRegPt(sk, '中书省（腹里）', 111.17, 34.78) &&
          hasRegPt(sk, '甘肃行省', 101.78, 36.62) &&
          hasRegPt(sk, '湖广行省', 109.577, 19.521) &&
          hasRegPt(sk, '湖广行省', 109.18, 18.36),
        `${sk} regions must align Jiqing, Hangzhou, Kaizhou, Shanzhou, Xiningzhou, and Hainan with History of Yuan Geography Treatise`
      );
    }

    // 3. Circuit (路) chronology between s_yuan_a (1279–1288) and s_yuan (1288–1351) + restored frontier circuits
    assert(
      hasPrefPt('s_yuan_a', '安西路', 108.941, 34.341) &&
        hasPrefPt('s_yuan_a', '鄂州路', 114.311, 30.551) &&
        hasPrefPt('s_yuan_a', '太原路', 112.551, 37.871) &&
        hasPrefPt('s_yuan_a', '建康路', 118.801, 32.061) &&
        hasPrefPt('s_yuan_a', '潭州路', 112.971, 28.201) &&
        hasPrefPt('s_yuan_a', '南剑路', 118.18, 26.64) &&
        hasPrefPt('s_yuan', '奉元路', 108.941, 34.341) &&
        hasPrefPt('s_yuan', '武昌路', 114.311, 30.551) &&
        hasPrefPt('s_yuan', '冀宁路', 112.551, 37.871) &&
        hasPrefPt('s_yuan', '集庆路', 118.801, 32.061) &&
        hasPrefPt('s_yuan', '天临路', 112.971, 28.201) &&
        hasPrefPt('s_yuan', '延平路', 118.18, 26.64) &&
        hasPrefPt('s_yuan', '辽阳路', 123.241, 41.271) &&
        hasPrefPt('s_yuan', '大宁路', 121.13, 41.1) &&
        hasPrefPt('s_yuan', '和林路', 102.851, 47.201) &&
        hasPrefPt('s_yuan', '亦集乃路', 101.14, 41.76) &&
        hasPrefPt('s_yuan', '播州宣慰司', 106.93, 27.72) &&
        hasPrefPt('s_yuan', '泉州路', 118.681, 24.871) &&
        hasPrefPt('s_yuan', '汀州路', 117.02, 25.08),
      's_yuan_a and s_yuan prefectures must reflect pre-1301 vs post-1301 circuit renamings and cover frontier circuits'
    );

    // 4. Late Yuan Red Turban & warlord territories in s_yuan_b (1351–1363) and s_yuan_c (1363–1368)
    assert(
      hasPolPt('s_yuan_b', '宋（韩林儿）', 115.78, 33.87) &&
        hasPolPt('s_yuan_b', '宋（韩林儿）', 115.801, 32.901) &&
        hasPolPt('s_yuan_b', '宋（韩林儿）', 116.964, 33.647) &&
        hasPolPt('s_yuan_b', '宋（韩林儿）', 116.78, 32.58) &&
        hasPolPt('s_yuan_b', '宋（韩林儿）', 114.311, 34.801) &&
        hasPolPt('s_yuan_b', '周（张士诚）', 120.62, 31.3) &&
        hasPolPt('s_yuan_b', '周（张士诚）', 119.45, 32.78) &&
        hasPolPt('s_yuan_b', '周（张士诚）', 120.087, 30.894) &&
        hasPolPt('s_yuan_b', '周（张士诚）', 120.151, 30.271) &&
        hasPolPt('s_yuan_b', '吴（朱元璋）', 118.801, 32.061) &&
        hasPolPt('s_yuan_b', '吴（朱元璋）', 118.317, 32.301) &&
        hasPolPt('s_yuan_b', '吴（朱元璋）', 118.497, 31.571) &&
        hasPolPt('s_yuan_b', '吴（朱元璋）', 119.92, 28.45) &&
        hasPolPt('s_yuan_b', '方国珍', 121.55, 29.87) &&
        hasPolPt('s_yuan_b', '方国珍', 120.66, 28.01) &&
        hasPolPt('s_yuan_b', '天完 · 陈友谅', 114.311, 30.551) &&
        hasPolPt('s_yuan_b', '天完 · 陈友谅', 115.891, 28.681),
      's_yuan_b must accurately partition Song (Han Lin\'er), Zhou (Zhang Shicheng), Wu (Zhu Yuanzhang), Fang Guozhen, and Tianwan/Chen Youliang'
    );
    assert(
      hasPolPt('s_yuan_c', '吴（朱元璋）', 118.801, 32.061) &&
        hasPolPt('s_yuan_c', '吴（朱元璋）', 114.311, 30.551) &&
        hasPolPt('s_yuan_c', '吴（朱元璋）', 115.891, 28.681) &&
        hasPolPt('s_yuan_c', '吴（朱元璋）', 116.78, 32.58) &&
        hasPolPt('s_yuan_c', '周（张士诚）', 120.62, 31.3) &&
        hasPolPt('s_yuan_c', '方国珍', 121.55, 29.87) &&
        hasPolPt('s_yuan_c', '陈友定', 119.3, 26.08) &&
        hasPolPt('s_yuan_c', '陈友定', 118.681, 24.871) &&
        !hasPolPt('s_yuan_c', '陈友定', 113.261, 23.131) &&
        !hasPolPt('s_yuan_c', '陈友定', 110.291, 25.271) &&
        hasPolPt('s_yuan_c', '元', 113.261, 23.131) &&
        hasPolPt('s_yuan_c', '元', 110.291, 25.271) &&
        hasPolPt('s_yuan_c', '元', 109.577, 19.521),
      's_yuan_c must keep Zhou (Zhang Shicheng) and Fang Guozhen until 1367 and restrict Chen Youding strictly to Fujian while Guangdong/Guangxi/Hainan stay in Yuan'
    );

    // 5. Mongol Empire & Western Liao / Yuan interior continuity (zero Lop Nor / Qilian hollow cavities or vertical keyhole cuts)
    assert(
      hasPolPt('s_nansong_a0', '西辽', 90.5, 40.2) &&
        hasPolPt('s_nansong_a', '西辽', 90.5, 40.2) &&
        hasPolPt('s_nansong_b0', '西辽', 90.5, 40.2) &&
        hasPolPt('s_nansong_c', '大蒙古国', 90.5, 40.2) &&
        hasPolPt('s_nansong_c', '大蒙古国', 86.0, 40.0) &&
        hasPolPt('s_nansong_d', '大蒙古国', 90.5, 40.2) &&
        hasPolPt('s_nansong_d', '大蒙古国', 86.0, 40.0) &&
        hasPolPt('s_nansong_e', '大蒙古国', 90.5, 40.2) &&
        hasPolPt('s_nansong_e', '大蒙古国', 86.0, 40.0) &&
        hasPolPt('s_nansong_e', '大蒙古国', 100.0, 38.0) &&
        hasPolPt('s_nansong_b', '大蒙古国', 90.5, 40.2) &&
        hasPolPt('s_nansong_b', '大蒙古国', 100.16, 25.69) &&
        snapshots.s_nansong_b.polities.find((p) => p.title === '大蒙古国').shape.coordinates.length === 1 &&
        hasPolPt('s_nansong_g', '元', 100.0, 28.0) &&
        hasPolPt('s_yuan_b', '元', 90.5, 40.2) &&
        hasPolPt('s_yuan_c', '元', 90.5, 40.2),
      'Mongol Empire, Western Liao, and Yuan snapshots must have zero hollow interior cavities at Lop Nor [90.5, 40.2], Eastern Tarim [86, 40], Qilian [100, 38], or Hengduan [100, 28]'
    );
  }

  // CUJ 36: Northern & Southern Song Historical Accuracy against 《宋史》《辽史》《金史》
  {
    const hasPolPt = (snapKey, polTitle, lng, lat) => {
      const pol = snapshots[snapKey].polities.find((p) => p.title === polTitle);
      return Boolean(pol && pointInShape(lng, lat, pol.shape));
    };
    const hasRegPt = (snapKey, regTitle, lng, lat) => {
      const reg = (snapshots[snapKey].regions || []).find((r) => r.title === regTitle);
      return Boolean(reg && pointInShape(lng, lat, reg.shape));
    };
    const hasPrefPt = (snapKey, prefTitle, lng, lat) => {
      const pref = (snapshots[snapKey].prefectures || []).find((p) => p.title === prefTitle);
      return Boolean(pref && pointInShape(lng, lat, pref.shape));
    };

    // 1. Ten Kingdoms unification chronology (960–979): Jingnan vs Wuping (960–963), Southern Tang vs Wuyue vs Qingyuanjun in Fujian (960–978)
    assert(
      !snapshots.s_beisong_a0.polities.some((p) => p.title === '湖南') &&
        hasPolPt('s_beisong_a0', '荆南（南平）', 112.241, 30.331) &&
        hasPolPt('s_beisong_a0', '武平（湖南）', 112.941, 28.231) &&
        hasPolPt('s_beisong_a0', '武平（湖南）', 111.698, 29.032) &&
        hasPolPt('s_beisong_a', '宋', 112.241, 30.331) &&
        hasPolPt('s_beisong_a', '宋', 112.941, 28.231),
      's_beisong_a0 (960–963) must distinguish Jingnan (Jiangling) and Wuping (Tanzhou/Langzhou) before the 963 Jinghu campaign'
    );
    for (const sk of ['s_beisong_a0', 's_beisong_a', 's_beisong_a2', 's_beisong_a3']) {
      assert(
        hasPolPt(sk, '南唐', 118.32, 27.04) &&
          hasPolPt(sk, '南唐', 116.35, 25.84) &&
          !hasPolPt(sk, '吴越', 118.32, 27.04) &&
          hasPolPt(sk, '吴越', 119.301, 26.081) &&
          hasPolPt(sk, '吴越', 120.151, 30.271) &&
          hasPolPt(sk, '清源军', 118.681, 24.871) &&
          hasPolPt(sk, '清源军', 117.65, 24.51),
        `${sk} (960–975) must place Jianzhou & Tingzhou in Southern Tang, Fuzhou & Hangzhou in Wuyue, and Quanzhou & Zhangzhou in Qingyuanjun`
      );
    }
    assert(
      hasPolPt('s_beisong_a4', '宋', 118.32, 27.04) &&
        hasPolPt('s_beisong_a4', '宋', 116.35, 25.84) &&
        hasPolPt('s_beisong_a4', '吴越', 119.301, 26.081) &&
        hasPolPt('s_beisong_a4', '清源军', 118.681, 24.871) &&
        hasPolPt('s_beisong_a5', '宋', 119.301, 26.081) &&
        hasPolPt('s_beisong_a5', '宋', 120.151, 30.271) &&
        hasPolPt('s_beisong_a5', '宋', 118.681, 24.871),
      's_beisong_a4 (975–978) must keep Qingyuanjun and Wuyue independent after Southern Tang falls, and s_beisong_a5 (978–979) must annex both into Song'
    );

    // 2. Song–Liao & Northern Han border (Sixteen Prefectures of Yanyun: Shuozhou, Yingzhou, Daizhou, Yizhou, Bazhou)
    for (const sk of ['s_beisong_a0', 's_beisong_a', 's_beisong_a2', 's_beisong_a3', 's_beisong_a4', 's_beisong_a5']) {
      assert(
        hasPolPt(sk, '北汉', 112.96, 39.07) &&
          hasPolPt(sk, '北汉', 112.551, 37.871) &&
          hasPolPt(sk, '辽', 112.43, 39.33) &&
          hasPolPt(sk, '辽', 113.19, 39.55) &&
          hasPolPt(sk, '宋', 115.49, 39.35) &&
          hasPolPt(sk, '宋', 116.39, 39.12),
        `${sk} (960–979) must place Daizhou & Taiyuan in Northern Han, Shuozhou & Yingzhou in Liao, and Yizhou & Bazhou in Song`
      );
    }
    for (const sk of ['s_beisong_b0', 's_beisong_b', 's_beisong_b1', 's_beisong_b2', 's_beisong_c']) {
      assert(
        hasPolPt(sk, '宋', 112.96, 39.07) &&
          hasPolPt(sk, '宋', 116.39, 39.12) &&
          hasPolPt(sk, '辽', 112.43, 39.33) &&
          hasPolPt(sk, '辽', 113.19, 39.55) &&
          hasPolPt(sk, '辽', 115.49, 39.35),
        `${sk} (979–1125) must place Daizhou & Bazhou in Song and Shuozhou, Yingzhou, & Yizhou in Liao`
      );
    }

    // 3. Dingnan Jiedushi / Lingzhou (1002) & Xihe (1072) / Hehuang (1104) expansions + Qilian Mountain seam
    for (const sk of ['s_beisong_a0', 's_beisong_a', 's_beisong_a2', 's_beisong_a3', 's_beisong_a4', 's_beisong_a5']) {
      assert(
        hasPolPt(sk, '宋', 106.28, 38.09) &&
          hasPolPt(sk, '党项（定难军）', 108.78, 37.98) &&
          !hasPolPt(sk, '党项（定难军）', 106.28, 38.09),
        `${sk} (960–979) must keep Lingzhou inside Song and Xiazhou inside Dingnan Jiedushi`
      );
    }
    assert(
      hasPolPt('s_beisong_b0', '党项（定难军）', 106.28, 38.09) &&
        hasPolPt('s_beisong_b0', '党项（定难军）', 106.231, 38.491) &&
        hasPolPt('s_beisong_b', '吐蕃诸部', 103.861, 35.381) &&
        hasPolPt('s_beisong_b', '吐蕃诸部', 101.778, 36.617) &&
        hasPolPt('s_beisong_b1', '宋', 103.861, 35.381) &&
        hasPolPt('s_beisong_b1', '宋', 103.21, 35.6) &&
        hasPolPt('s_beisong_b1', '宋', 104.04, 34.43) &&
        hasPolPt('s_beisong_b1', '宋', 103.83, 36.06) &&
        !hasPolPt('s_beisong_b1', '吐蕃诸部', 103.861, 35.381) &&
        hasPolPt('s_beisong_b1', '吐蕃诸部', 101.778, 36.617),
      's_beisong_b0..b1 must reflect Li Jiqian capturing Lingzhou (1002) and Wang Shao recovering Xihe (Xizhou/Hezhou/Minzhou/Lanzhou) in 1072'
    );
    for (const sk of ['s_beisong_b2', 's_beisong_c', 's_beisong_d']) {
      assert(
        hasPolPt(sk, '宋', 101.778, 36.617) &&
          !hasPolPt(sk, '吐蕃诸部', 101.778, 36.617) &&
          hasRegPt(sk, '熙河路', 101.778, 36.617),
        `${sk} (1104–1127) must place Xiningzhou (Qingtang) inside Song and Xihe Circuit after the 1104 Hehuang Expansion`
      );
    }

    // 4. Late Northern Song (s_beisong_d), Hainan Island circuit (广南西路), and full-phase simplified prefectures
    assert(
      hasPolPt('s_beisong_d', '西辽', 81.28, 43.92) &&
        snapshots.s_beisong_d.regions.some((r) => r.title === '上京路') &&
        snapshots.s_beisong_d.regions.some((r) => r.title === '燕京路') &&
        !snapshots.s_beisong_d.regions.some((r) => r.title.endsWith('道')),
      's_beisong_d (1125–1127) must include Western Liao and rename former Liao circuits from 道 to Jin 路'
    );
    for (const sk of ['s_beisong_a3', 's_beisong_a4', 's_beisong_a5', 's_beisong_b0', 's_beisong_b', 's_beisong_b1', 's_beisong_b2', 's_beisong_c', 's_beisong_d', 's_nansong_a0', 's_nansong_a', 's_nansong_b0', 's_nansong_c', 's_nansong_d', 's_nansong_e', 's_nansong_b', 's_nansong_g']) {
      assert(
        hasRegPt(sk, '广南西路', 109.577, 19.521),
        `${sk} must include Hainan Island ([109.577, 19.521]) inside 广南西路`
      );
    }
    for (const sk of ['s_beisong_a0', 's_beisong_a', 's_beisong_a2', 's_beisong_a3', 's_beisong_a4', 's_beisong_a5', 's_beisong_b0', 's_beisong_b', 's_beisong_b1', 's_beisong_b2', 's_beisong_c', 's_beisong_d', 's_nansong_a0', 's_nansong_a', 's_nansong_b0', 's_nansong_c', 's_nansong_d', 's_nansong_e', 's_nansong_b', 's_nansong_g']) {
      const prefs = snapshots[sk].prefectures || [];
      assert(
        prefs.length >= 130 &&
          !prefs.some((p) => p.title.endsWith('道') || p.title === '倒塌岭节度使司' || p.title === '西北路') &&
          hasPrefPt(sk, '开封府', 114.351, 34.791) &&
          hasPrefPt(sk, '成都府', 104.061, 30.671),
        `${sk} prefectures must be populated (>=130), free of macro-circuits, and include Kaifengfu & Chengdufu`
      );
    }

    // 5. Southern Song (1127–1279): Treaty of Shaoxing border (Qinzhou, Fengzhou, Chengzhou, Jiezhou, Junzhou), Lintao exclusivity, and Jin capital chronology
    assert(
      snapshots.s_nansong_c.polities.find((p) => p.title === '大蒙古国').shape.coordinates.length === 1 &&
        hasPolPt('s_nansong_c', '金（迁都汴京）', 103.861, 35.381) &&
        hasPolPt('s_nansong_c', '金（迁都汴京）', 103.83, 36.06),
      's_nansong_c (1215–1227) must keep Lintao Circuit (Lintaofu & Lanzhou) inside Jin rather than a disconnected Mongol exclave'
    );
    for (const sk of ['s_nansong_a0', 's_nansong_a', 's_nansong_b0', 's_nansong_c', 's_nansong_d']) {
      assert(
        !hasPolPt(sk, '吐蕃诸部', 103.861, 35.381) && !hasPolPt(sk, '吐蕃诸部', 103.83, 36.06),
        `${sk} must not overlap 吐蕃诸部 onto Lintaofu or Lanzhou`
      );
    }
    assert(
      hasPolPt('s_nansong_a0', '南宋', 105.721, 34.581) &&
        hasRegPt('s_nansong_a0', '利州路', 105.721, 34.581) &&
        snapshots.s_nansong_a0.regions.some((r) => r.title === '燕京路') &&
        !snapshots.s_nansong_a0.regions.some((r) => r.title === '中都路') &&
        hasPrefPt('s_nansong_a0', '析津府', 116.401, 39.901),
      's_nansong_a0 (1127–1141, pre-Shaoxing Treaty & pre-1153 Zhongdu) must keep Qinzhou in Southern Song / Lizhou Circuit and name Beijing as Yanjing Circuit / Xijinfu'
    );
    for (const [sk, northPol] of [
      ['s_nansong_a', '金'],
      ['s_nansong_b0', '金'],
      ['s_nansong_c', '金（迁都汴京）'],
      ['s_nansong_d', '大蒙古国'],
      ['s_nansong_e', '大蒙古国'],
      ['s_nansong_b', '大蒙古国'],
    ]) {
      assert(
        hasPolPt(sk, northPol, 105.721, 34.581) &&
          hasPolPt(sk, northPol, 106.96, 34.28) &&
          !hasPolPt(sk, '南宋', 105.721, 34.581) &&
          hasPolPt(sk, '南宋', 106.52, 33.91) &&
          hasPolPt(sk, '南宋', 105.73, 33.74) &&
          hasPolPt(sk, '南宋', 104.92, 33.4) &&
          hasPolPt(sk, '南宋', 104.04, 34.43) &&
          hasPolPt(sk, '南宋', 111.51, 32.65) &&
          hasRegPt(sk, '凤翔路', 105.721, 34.581) &&
          hasRegPt(sk, '利州路', 106.52, 33.91) &&
          hasRegPt(sk, '利州路', 105.73, 33.74) &&
          hasRegPt(sk, '利州路', 104.92, 33.4),
        `${sk} (post-1142 Treaty of Shaoxing) must place Qinzhou & Dasanguan in ${northPol} / Fengxiang Circuit and Fengzhou, Chengzhou, Jiezhou, Minzhou, & Junzhou in Southern Song / Lizhou Circuit`
      );
    }
    for (const sk of ['s_nansong_e', 's_nansong_b']) {
      assert(
        snapshots[sk].regions.some((r) => r.title === '辽东路') &&
          snapshots[sk].regions.some((r) => r.title === '燕京路') &&
          snapshots[sk].regions.some((r) => r.title === '河南路') &&
          !snapshots[sk].regions.some((r) => r.title === '上京路' || r.title === '中都路' || r.title === '南京（河南）路'),
        `${sk} (post-1234 fall of Jin) must replace Jin imperial circuits with Mongol circuits (辽东路, 燕京路, 河南路)`
      );
    }

    // 6. Liao & Jin northeastern and western frontiers beyond modern borders (Issue #167)
    for (const [sk, polName] of [
      ['s_wudai_b', '契丹'],
      ['s_wudai_b2', '契丹'],
      ['s_wudai_c', '契丹'],
      ['s_wudai_c0', '契丹'],
      ['s_wudai_c2', '契丹'],
      ['s_wudai_d', '辽'],
      ['s_wudai_e', '辽'],
      ['s_wudai_e1', '辽'],
      ['s_wudai_e2', '辽'],
    ]) {
      assert(
        hasPolPt(sk, polName, 133.5, 44.5) &&
          hasPolPt(sk, polName, 138.0, 49.5) &&
          hasPolPt(sk, polName, 110.0, 46.5),
        `${sk} must extend ${polName} east to the Sea of Japan / Lower Amur and west across the Mongolian steppe for a seamless transition into Northern Song`
      );
    }
    for (const [sk, polName, eastReg, northReg] of [
      ['s_beisong_a0', '辽', '东京道', '上京道'],
      ['s_beisong_a', '辽', '东京道', '上京道'],
      ['s_beisong_a2', '辽', '东京道', '上京道'],
      ['s_beisong_a3', '辽', '东京道', '上京道'],
      ['s_beisong_a4', '辽', '东京道', '上京道'],
      ['s_beisong_a5', '辽', '东京道', '上京道'],
      ['s_beisong_b0', '辽', '东京道', '上京道'],
      ['s_beisong_b', '辽', '东京道', '上京道'],
      ['s_beisong_b1', '辽', '东京道', '上京道'],
      ['s_beisong_b2', '辽', '东京道', '上京道'],
      ['s_beisong_c', '金', '东京道', '上京道'],
      ['s_beisong_d', '金', '东京路', '上京路'],
    ]) {
      assert(
        hasPolPt(sk, polName, 134.5, 44.8) &&
          hasPolPt(sk, polName, 135.5, 48.5) &&
          hasPolPt(sk, polName, 138.0, 49.5) &&
          !hasPolPt(sk, '蒙古诸部', 134.5, 44.8) &&
          !hasPolPt(sk, '蒙古诸部', 135.5, 48.5) &&
          hasRegPt(sk, eastReg, 134.5, 44.8) &&
          hasRegPt(sk, northReg, 135.5, 48.5),
        `${sk} must extend ${polName} (${eastReg} / ${northReg}) beyond the modern Heilongjiang–Ussuri border to the Sea of Japan and Lower Amur without overlapping 蒙古诸部`
      );
    }
    for (const sk of ['s_nansong_a0', 's_nansong_a', 's_nansong_b0']) {
      assert(
        hasPolPt(sk, '金', 133.5, 44.8) &&
          hasPolPt(sk, '金', 136.0, 48.8) &&
          hasPolPt(sk, '金', 139.0, 51.0) &&
          hasPolPt(sk, '金', 126.5, 54.0) &&
          hasPolPt(sk, '金', 132.0, 53.5) &&
          hasPolPt(sk, '金', 122.0, 50.5) &&
          !hasPolPt(sk, '金', 112.5, 44.5) &&
          !hasPolPt(sk, '蒙古诸部', 136.0, 48.8) &&
          !hasPolPt(sk, '大蒙古国', 136.0, 48.8) &&
          hasRegPt(sk, '上京路', 136.0, 48.8) &&
          hasRegPt(sk, '上京路', 126.5, 54.0) &&
          hasRegPt(sk, '上京路', 122.0, 50.5) &&
          hasPrefPt(sk, '蒲与路', 126.5, 54.0) &&
          hasPrefPt(sk, '胡里改路', 136.0, 48.8) &&
          hasPrefPt(sk, '恤品路', 133.5, 44.8),
        `${sk} must extend Jin (上京路, 蒲与路, 胡里改路, 恤品路) across the Amur and Ussuri rivers and follow the historical Jin Frontier Trench in the west rather than modern borders`
      );
    }

    // CUJ 37: Warring States (Zizhi Tongjian) territorial & settlement alignment across all 14 snapshots
    for (const sk of ['s_zhanguo_a', 's_zhanguo_a2']) {
      assert(
        hasPolPt(sk, '蜀', 104.071, 30.571) &&
          hasPolPt(sk, '蜀', 105.84, 32.44) &&
          hasPolPt(sk, '巴', 106.551, 29.561) &&
          hasPolPt(sk, '巴', 105.97, 31.58) &&
          hasPolPt(sk, '楚', 107.021, 33.071) &&
          !hasPolPt(sk, '楚', 105.84, 32.44),
        `${sk} must split 蜀 (Chengdu, Jiameng) and 巴 (Jiangzhou, Langzhong) and keep Hanzhong in 楚 without overlapping Jiameng`
      );
    }
    assert(
      hasPolPt('s_zhanguo_a', '魏', 110.44, 35.48) &&
        hasPolPt('s_zhanguo_a', '韩', 110.92, 34.63) &&
        hasPolPt('s_zhanguo_a2', '秦', 110.44, 35.48) &&
        hasPolPt('s_zhanguo_a2', '秦', 110.92, 34.63),
      'Shaoliang (Hexi Commandery) must belong to 魏 in s_zhanguo_a (-403..-341 BCE) and transfer with Hangu Pass to 秦 in s_zhanguo_a2 (-340 BCE)'
    );
    for (const sk of ['s_zhanguo_a', 's_zhanguo_a2', 's_zhanguo_b0', 's_zhanguo_b1', 's_zhanguo_b']) {
      assert(
        hasPolPt(sk, '宋', 115.65, 34.42) &&
          hasPolPt(sk, '宋', 115.57, 35.07) &&
          hasPolPt(sk, '宋', 117.18, 34.26),
        `${sk} (-403..-286 BCE) must include State of Song (宋) covering Shangqiu, Dingtao, and Pengcheng`
      );
    }
    for (const sk of ['s_zhanguo_b2', 's_zhanguo_c', 's_zhanguo_c2', 's_zhanguo_d', 's_zhanguo_e1', 's_zhanguo_e2', 's_zhanguo_e3']) {
      assert(
        hasPolPt(sk, '魏', 114.351, 34.791) &&
          hasPolPt(sk, '魏', 115.65, 34.42) &&
          hasPolPt(sk, '楚', 117.18, 34.26) &&
          hasPolPt(sk, '楚', 114.881, 33.781) &&
          !hasPolPt(sk, '秦', 114.881, 33.781),
        `${sk} (post-286 BCE Song partition) must place Daliang & Shangqiu in 魏 and Pengcheng & Chenying in 楚`
      );
    }
    assert(
      hasPolPt('s_zhanguo_e4', '秦', 114.351, 34.791) &&
        hasPolPt('s_zhanguo_e4', '秦', 115.65, 34.42) &&
        hasPolPt('s_zhanguo_e4', '楚', 114.881, 33.781) &&
        hasPolPt('s_zhanguo_e4', '楚', 117.18, 34.26) &&
        !hasPolPt('s_zhanguo_e4', '秦', 114.881, 33.781),
      's_zhanguo_e4 (-225 BCE fall of Wei) must transfer Daliang & Shangqiu to 秦 while keeping Chenying & Pengcheng in 楚'
    );
    for (const sk of ['s_zhanguo_a', 's_zhanguo_a2', 's_zhanguo_b0']) {
      assert(hasPolPt(sk, '越', 119.98, 35.65), `${sk} must include Langya ([119.98, 35.65]) inside 越`);
    }
    for (const sk of ['s_zhanguo_b1', 's_zhanguo_b', 's_zhanguo_b2', 's_zhanguo_c', 's_zhanguo_c2', 's_zhanguo_d', 's_zhanguo_e1', 's_zhanguo_e2', 's_zhanguo_e3', 's_zhanguo_e4']) {
      assert(hasPolPt(sk, '楚', 119.98, 35.65), `${sk} must include Langya ([119.98, 35.65]) inside 楚`);
    }
    assert(hasPolPt('s_zhanguo_e5', '秦', 119.98, 35.65), 's_zhanguo_e5 must include Langya ([119.98, 35.65]) inside 秦');
    for (const sk of ['s_zhanguo_b', 's_zhanguo_b2', 's_zhanguo_c', 's_zhanguo_c2', 's_zhanguo_d', 's_zhanguo_e1']) {
      assert(
        hasPolPt(sk, '赵', 111.201, 40.251) && hasPolPt(sk, '赵', 114.551, 40.151),
        `${sk} (-300..-229 BCE) must include both Yunzhong and Dai inside 赵`
      );
    }
    for (const sk of ['s_zhanguo_e2', 's_zhanguo_e3', 's_zhanguo_e4']) {
      assert(
        hasPolPt(sk, '秦', 111.201, 40.251) &&
          hasPolPt(sk, '代', 114.551, 40.151) &&
          !hasPolPt(sk, '代', 111.201, 40.251),
        `${sk} (-228..-223 BCE) must place Yunzhong in 秦 and Dai ([114.551, 40.151]) in 代`
      );
    }
    for (const sk of ['s_qin_a', 's_qin_b', 's_qin', 's_xihan_a', 's_xihan_b1', 's_xihan_b2', 's_xihan_b3', 's_xihan_b', 's_xihan_c', 's_xihan_d']) {
      const mainPol = snapshots[sk].polities[0];
      const mainRing = mainPol.shape.type === 'Polygon' ? mainPol.shape.coordinates[0] : mainPol.shape.coordinates[0][0];
      assert(
        mainRing.length >= 1200,
        `${sk} main polity (${mainPol.title}) must use high-resolution outer border aligned with commanderies/provinces (>=1200 vertices, got ${mainRing.length})`
      );
    }

    // CUJ 38: Compositor Stage Wrapper, Deferred Typography Coalescing, Anti-Flicker Zoom & Zero Layout Thrashing Invariants (Issue #158)
    assert(
      indexHtml.includes('<div id="svg-stage-wrap">') &&
        cssSrc.includes('#svg-stage-wrap') &&
        cssSrc.includes('transform-origin: 0 0;') &&
        cssSrc.includes('contain: layout style;') &&
        cssSrc.includes('text-rendering: geometricPrecision;') &&
        cssSrc.includes('#atlas-svg.is-camera-moving *') &&
        !cssSrc.includes('#atlas-svg.is-camera-moving text') &&
        /\.neighbor-caption\.is-crowded-hidden[\s\S]*?display:\s*none;/m.test(cssSrc) &&
        appCode.includes('_commitStageTransform') &&
        appCode.includes('_runWithDeferredTypography') &&
        appCode.includes('if (this._camRaf !== null) return;') &&
        appCode.includes('_lastLegendKey') &&
        appCode.includes('this.isScrubbing') &&
        appCode.includes('this._zoomScaleNodes') &&
        appCode.includes('node.dataset.appliedDir') &&
        !appCode.includes("class: 'fade-enter'") &&
        !appCode.includes("disc.getBoundingClientRect()") &&
        !appCode.includes("label.getBoundingClientRect()"),
      'Expected #svg-stage-wrap compositor wrapper, geometricPrecision text rendering, deferred typography coalescing, no is-camera-moving text stroke stripping, _camRaf settle guard, _lastLegendKey cache, display:none on crowded captions, scrubbing flicker guards, and zero .jn-disc/.jn-label getBoundingClientRect calls'
    );
    {
      let typoExecCount = 0;
      const prevInstanceRescale = ctrl._rescaleSvgTypography;
      ctrl._deferTypographyDepth = 0;
      ctrl._typoDirty = false;
      ctrl._rescaleSvgTypography = function () {
        if (this._deferTypographyDepth > 0) {
          this._typoDirty = true;
          return;
        }
        this._typoDirty = false;
        typoExecCount++;
      };
      ctrl._runWithDeferredTypography(() => {
        ctrl._rescaleSvgTypography();
        ctrl._runWithDeferredTypography(() => {
          ctrl._rescaleSvgTypography();
          ctrl._rescaleSvgTypography();
        });
        ctrl._rescaleSvgTypography();
      });
      ctrl._rescaleSvgTypography = prevInstanceRescale;
      assert.strictEqual(
        typoExecCount,
        1,
        `Nested _runWithDeferredTypography blocks must coalesce multiple _rescaleSvgTypography calls into 1 pass, got ${typoExecCount}`
      );
      assert(
        appCode.includes('const zoomOnly = Boolean(') &&
          appCode.includes('if (zoomOnly && node.dataset.chosenDir)') &&
          appCode.includes("if (zoomOnly && node.dataset.placed === '1')"),
        'Expected zoomOnly direction/position lock in _rescaleSvgTypography to prevent label flipping during zoom'
      );
    }

    // CUJ 39: Quick Search Anti-Fake-Person, City-vs-Era Ranking, Quiz Clue Integrity & Person Chronicle Site Disentangling
    {
      for (const nonPersonQ of [
        '安史之乱',
        '靖康',
        '黄巾起义',
        '八王之乱',
        '鸦片战争',
        '科举',
        '丝绸之路',
        '都护府',
        '突厥',
        '吐蕃',
        '契丹',
        '女真',
        '红巾军',
      ]) {
        assert.strictEqual(
          ctrl._resolvePersonProfile(nonPersonQ),
          null,
          `_resolvePersonProfile("${nonPersonQ}") must not fabricate a fake person profile`
        );
        const qHits = ctrl._queryQuickSearch(nonPersonQ);
        assert(
          qHits.length > 0 && !qHits.some((h) => h.kind === 'person'),
          `Quick search for "${nonPersonQ}" must return historical events/regions/eras without fabricating a person hit`
        );
      }

      for (const cityQ of [
        '长安',
        '建康',
        '绍兴',
        '大同',
        '永嘉',
        '建安',
        '保定',
        '咸宁',
        '永昌',
        '建宁',
        '永安',
        '兴元',
        '大庆',
      ]) {
        const cHits = ctrl._queryQuickSearch(cityQ);
        assert(
          cHits.length > 0 && cHits[0].kind === 'city',
          `Famous city "${cityQ}" must rank #1 as kind="city" above same-named era, got ${JSON.stringify(cHits[0])}`
        );
      }
      for (const explicitEraQ of ['长安元年', '建康元年', '绍兴元年', '大同元年', '建安元年']) {
        const eHits = ctrl._queryQuickSearch(explicitEraQ);
        assert(
          eHits.length > 0 && eHits[0].kind === 'era',
          `Explicit era query "${explicitEraQ}" must rank #1 as kind="era", got ${JSON.stringify(eHits[0])}`
        );
      }

      const clueChecks = [
        [{ ancient: '宛（南阳）', modern: '南阳' }, '宛', '秦置南阳郡治', '秦置南阳郡治'],
        [{ ancient: '晋阳', modern: '太原' }, '晋阳', '秦置太原郡治', '秦置太原郡治'],
        [{ ancient: '南郑（汉中）', modern: '汉中' }, '南郑', '汉中王刘邦都此 / 东汉汉中郡治', '汉中王刘邦都此 / 东汉汉中郡治'],
        [{ ancient: '临湘（长沙）', modern: '长沙' }, '临湘', '西汉长沙国都 / 东汉长沙郡治', '西汉长沙国都 / 东汉长沙郡治'],
        [{ ancient: '穰', modern: '南阳·邓州' }, '穰', '南阳穰县', '南阳穰县'],
        [{ ancient: '乐浪', modern: '平壤（朝鲜）' }, '乐浪', '朝鲜四郡之一', '朝鲜四郡之一'],
        [{ ancient: '徐闻', modern: '湛江·雷州' }, '徐闻', '雷州半岛极南重镇，汉代海丝远航始发港', '雷州半岛极南重镇，汉代海丝远航始发港'],
        [{ ancient: '彭城（徐州）', modern: '徐州' }, '彭城', '徐州治所', '徐州治所'],
        [{ ancient: '番禺', modern: '广州' }, '番禺', '南海郡治所 / 广州治所', '南海郡治所 / 广州治所'],
      ];
      for (const [sMock, disp, rawText, expected] of clueChecks) {
        assert.strictEqual(
          ctrl._sanitizeChallengeClue(rawText, sMock, disp),
          expected,
          `Quiz clue sanitization for "${disp}" must preserve historical geography "${expected}"`
        );
      }

      for (const j of loreData.HISTORICAL_JOURNEYS) {
        for (const st of j.stops) {
          assert(
            !/[·→]/.test(ctrl._stripPromptParenthetical(st.ancientZh)),
            `Journey "${j.key}" stop "${st.ancientZh}" must not stitch multiple cities onto one coordinate`
          );
        }
      }
      const sushiJ = loreData.HISTORICAL_JOURNEYS.find((j) => j.key === 'sushi');
      assert(
        sushiJ.stops.some((s) => s.ancientZh === '徐州' && s.year === 1077) &&
          sushiJ.stops.some((s) => s.ancientZh === '湖州' && s.year === 1079),
        'Su Shi journey must separate Xuzhou (1077) and Huzhou (1079) into distinct geocoded stops'
      );

      for (const p of loreData.PERSON_PROFILES) {
        const pEvs = ctrl._collectPersonEvents(p);
        for (const ev of pEvs) {
          assert(
            !/[·→]/.test(ctrl._stripPromptParenthetical(ev.siteZh)),
            `Person "${p.zh}" event (${ev.year}) must resolve to a single site rather than compound "${ev.siteZh}"`
          );
        }
      }
      const lijingEvs = ctrl._collectPersonEvents(ctrl._resolvePersonProfile('李靖'));
      assert.strictEqual(lijingEvs[0].siteZh, '江陵', 'Li Jing 621 CE event must locate at 江陵 (not 虎牢 · 江陵)');
      const sunbinEvs = ctrl._collectPersonEvents(ctrl._resolvePersonProfile('孙膑'));
      assert(
        sunbinEvs.some((e) => e.year === -341 && e.siteZh === '马陵'),
        'Sun Bin -341 BCE event must locate at 马陵 (not 马陵 · 安邑)'
      );
      const shangyangEvs = ctrl._collectPersonEvents(ctrl._resolvePersonProfile('商鞅'));
      assert(
        shangyangEvs.some((e) => e.year === -341 && e.siteZh === '安邑') &&
          shangyangEvs.some((e) => e.year === -338 && e.siteZh === '商邑'),
        'Shang Yang -341 and -338 BCE events must locate at 安邑 and 商邑'
      );
      const jiangweiEvs = ctrl._collectPersonEvents(ctrl._resolvePersonProfile('姜维'));
      assert(
        jiangweiEvs.some((e) => e.year === 255 && e.siteZh === '狄道' && Math.abs(e.coord[0] - 104.62) < 1),
        'Jiang Wei 255 CE event must locate at 狄道 in Longxi (not 寿春)'
      );

      // URL address bar preservation & ?lang=en sync on language toggle
      const origHistory = sandbox.window.history;
      const origSearch = sandbox.location.search;
      const origHash = sandbox.location.hash;
      const origLocale = ctrl.locale;
      const replacedUrls = [];
      sandbox.window.history = {
        state: { page: 1 },
        replaceState(st, _title, url) {
          replacedUrls.push(url);
          const qIdx = url.indexOf('?');
          const hIdx = url.indexOf('#');
          sandbox.location.search =
            qIdx >= 0 ? url.slice(qIdx, hIdx >= 0 ? hIdx : undefined) : '';
        },
      };
      try {
        // 1. User specifies ?year=317&place=建康: toggling to EN appends lang=en without touching year/place
        sandbox.location.search = '?year=317&place=%E5%BB%BA%E5%BA%B7';
        sandbox.location.hash = '';
        ctrl.locale = 'en';
        ctrl._syncUrlLangParam();
        assert.strictEqual(
          sandbox.location.search,
          '?year=317&place=%E5%BB%BA%E5%BA%B7&lang=en',
          'Switching to EN must update address bar with lang=en while preserving user-specified URL params'
        );

        // 2. Switching to zh-tw updates lang=zh-tw while preserving user-specified URL params
        ctrl.locale = 'zh-tw';
        ctrl._syncUrlLangParam();
        assert.strictEqual(
          sandbox.location.search,
          '?year=317&place=%E5%BB%BA%E5%BA%B7&lang=zh-tw',
          'Switching to zh-tw must update address bar with lang=zh-tw while preserving user-specified URL params'
        );

        // 3. Switching back to zh removes lang param while keeping user-specified URL params intact
        ctrl.locale = 'zh';
        ctrl._syncUrlLangParam();
        assert.strictEqual(
          sandbox.location.search,
          '?year=317&place=%E5%BB%BA%E5%BA%B7',
          'Switching to zh must remove lang param while preserving user-specified URL params'
        );

        // 4. Bare homepage: switching to EN sets ?lang=en; switching back to zh restores clean pathname
        sandbox.location.search = '';
        ctrl.locale = 'en';
        ctrl._syncUrlLangParam();
        assert.strictEqual(sandbox.location.search, '?lang=en', 'Bare URL + EN must set ?lang=en');
        ctrl.locale = 'zh';
        ctrl._syncUrlLangParam();
        assert.strictEqual(sandbox.location.search, '', 'Bare URL + zh must clear query string');

        // 5. _effectiveRenderedLocale distinguishes pending English dict from loaded English dict
        const savedEnLocale = ctrl.enLocale;
        ctrl.locale = 'en';
        ctrl.enLocale = { dict: {} };
        assert.strictEqual(
          ctrl._effectiveRenderedLocale(),
          'en-pending',
          '_effectiveRenderedLocale must return en-pending when i18n_dict.js has not loaded yet'
        );
        ctrl.enLocale = savedEnLocale;
        assert.strictEqual(
          ctrl._effectiveRenderedLocale(),
          'en',
          '_effectiveRenderedLocale must return en once i18n_dict.js is loaded'
        );
        // 6. WebMCP (navigator.modelContext) registration & Stdio MCP server (scripts/mcp_server.js)
        const registeredWebMcpTools = [];
        const origNav = sandbox.navigator;
        sandbox.navigator = {
          modelContext: {
            registerTool(t) {
              registeredWebMcpTools.push(t);
            },
          },
        };
        const returnedTools = ctrl._registerWebMcpTools();
        assert.strictEqual(
          registeredWebMcpTools.length,
          3,
          'WebMCP must register 3 tools (jiangshan_locate, jiangshan_inspect, jiangshan_open_person)'
        );
        assert.strictEqual(
          returnedTools.map((t) => t.name).join(','),
          'jiangshan_locate,jiangshan_inspect,jiangshan_open_person',
          'WebMCP tool names must match expected list'
        );
        sandbox.navigator = origNav;

        const { spawnSync } = require('child_process');
        const mcpServerPath = path.join(__dirname, 'mcp_server.js');
        assert(fs.existsSync(mcpServerPath), 'scripts/mcp_server.js must exist');
        const mcpRequests = [
          { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } },
          { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
          {
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: { name: 'inspect_place', arguments: { year: 755, place: '范阳' } },
          },
          {
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: { name: 'inspect_person', arguments: { person: '苏轼', stop: 6 } },
          },
          {
            jsonrpc: '2.0',
            id: 5,
            method: 'tools/call',
            params: { name: 'search_atlas', arguments: { query: '长安', limit: 3 } },
          },
        ]
          .map((r) => JSON.stringify(r))
          .join('\n') + '\n';
        const mcpProc = spawnSync(process.execPath, [mcpServerPath], {
          input: mcpRequests,
          encoding: 'utf8',
          timeout: 15000,
        });
        assert.strictEqual(mcpProc.status, 0, `mcp_server.js exited with ${mcpProc.status}: ${mcpProc.stderr}`);
        const mcpLines = mcpProc.stdout
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line));
        assert.strictEqual(mcpLines.length, 5, 'mcp_server.js must return 5 JSON-RPC responses');
        assert.strictEqual(mcpLines[0].result.serverInfo.name, 'jiangshan-atlas-mcp');
        assert.deepStrictEqual(
          mcpLines[1].result.tools.map((t) => t.name),
          ['inspect_place', 'inspect_person', 'search_atlas']
        );
        const fanyangRes = JSON.parse(mcpLines[2].result.content[0].text);
        assert.strictEqual(fanyangRes.year, 755);
        assert.strictEqual(fanyangRes.resolvedName, '幽州');
        assert.strictEqual(fanyangRes.polity, '大燕（安禄山）');
        assert(fanyangRes.regions.includes('河北道'), 'inspect_place(755, 范阳) must return 河北道');
        const sushiRes = JSON.parse(mcpLines[3].result.content[0].text);
        assert.strictEqual(
          sushiRes.resolvedName,
          '徐州',
          'inspect_person(苏轼, stop=6) must return resolvedName="徐州"'
        );
        assert.strictEqual(
          sushiRes.person.events[7].site,
          '湖州',
          'inspect_person(苏轼, stop=6) event[7].site must be "湖州"'
        );
        const searchRes = JSON.parse(mcpLines[4].result.content[0].text);
        assert.strictEqual(searchRes.results[0].kind, 'city', 'search_atlas(长安) must rank city #1');

        // CUJ 40: English Mode Zero-CJK Leak & Clue Integrity Guard
        ctrl.locale = 'en';
        ctrl.searchIndex = null;
        const enIdx = ctrl._ensureSearchIndex();
        const cjkIdxLeaks = enIdx.filter(
          (e) => /[\u4e00-\u9fff]/.test(e.titleEn || '') || /[\u4e00-\u9fff]/.test(e.subEn || '')
        );
        assert.strictEqual(
          cjkIdxLeaks.length,
          0,
          `English searchIndex must have 0 CJK leaks in titleEn/subEn, found ${cjkIdxLeaks.length}: ${JSON.stringify(cjkIdxLeaks[0])}`
        );
        for (const qStr of ['741', '208 BCE', 'Taizong', 'Yongle', '贞观', '开元二十九年']) {
          const eraHits = ctrl._matchEraResults(qStr);
          assert(eraHits.length > 0, `_matchEraResults("${qStr}") must return hits`);
          for (const h of eraHits) {
            assert(
              !/[\u4e00-\u9fff]/.test(h.titleEn || '') && !/[\u4e00-\u9fff]/.test(h.subEn || ''),
              `Era hit for "${qStr}" leaked CJK in English fields: ${JSON.stringify({ titleEn: h.titleEn, subEn: h.subEn })}`
            );
          }
        }
        assert.strictEqual(ctrl.trTerm('函谷关'), 'Hangu Pass');
        assert.strictEqual(ctrl.trTerm('南郑'), 'Nanzheng');
        assert.strictEqual(ctrl.trTerm('刺史部'), 'Inspectorate Region');
        const donghanDyn = dynasties.find((d) => d.key === 'donghan');
        const nanzhengSettle = donghanDyn.settlements.find((s) => s.ancient.startsWith('南郑'));
        const clueEn = ctrl._sanitizeChallengeClue(
          ctrl.trTerm(nanzhengSettle.remark),
          nanzhengSettle,
          'Nanzheng'
        );
        assert(
          clueEn.includes('Hanzhong Commandery') && !clueEn.includes('this site'),
          `English quiz clue for Nanzheng must preserve "Hanzhong Commandery", got "${clueEn}"`
        );
      } finally {
        sandbox.window.history = origHistory;
        sandbox.location.search = origSearch;
        sandbox.location.hash = origHash;
        ctrl.locale = origLocale;
      }
    }
  }

  const elapsed = (performance.now() - t0).toFixed(1);
  console.log(`✓ Jiangshan Atlas validation passed in ${elapsed} ms:`);
  console.log(`  - ${dynasties.length} dynasties, ${snapKeys.length} snapshots (${referencedSnaps.size} phase-linked), ${sweptYears} timeline years swept`);
  console.log(`  - ${decodedPolygons} historical polygons (${totalVertices.toLocaleString()} vertices) verified lossless & collision-free`);
  console.log(`  - ${provinces.length} modern provinces (${provRingCount} rings)`);
  console.log(`  - ${totalSettlements} ancient settlements & ${totalMilestones} historical milestones`);
  console.log(`  - ${loreData.HISTORICAL_JOURNEYS.length} journeys (${totalJourneyStops} bilingual stops), ${loreData.CHINESE_ERA_SPANS.length} era spans, ${loreData.PLACE_LANDMARK_EVENTS.length} landmark events & ${loreData.PLACE_GAZETTEER.length} gazetteer landmarks verified across 39 E2E CUJs`);
}

main();
