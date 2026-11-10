'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { verifyIndexHtmlAssetHashes } = require('../sync_version');

async function runCoreDataSuite(ctx) {
  const {
    ROOT,
    JS_DIR,
    FAST_MODE,
    sandbox,
    ControllerClass,
    controllerBundles,
    ctrl,
    provinces,
    snapshots,
    snapKeys,
    bootSnaps,
    dynasties,
    corridors,
    loreData,
    enLocale,
    hydro,
    indexHtml,
    styleCss,
    appCode,
    sitemapXml,
    robotsTxt,
    llmsTxtPath,
    skillMdPath,
    skillPyPath,
    llmsTxt,
    qingDyn,
    pointInShape,
  } = ctx;

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
  assert(
    Array.isArray(hydro.paleoSea) && hydro.paleoSea.length >= 9,
    'HYDRO_DATA.paleoSea must contain P0 (Bohai), P1 (East China), and P2 (Pearl River Delta & Taijiang Inner Sea) historical paleo-sea shoreline masks'
  );
  assert(
    hydro.paleoSea.filter((p) => isHydroActive(p, -210)).length >= 4 &&
      hydro.paleoSea.filter((p) => isHydroActive(p, 741)).length >= 4 &&
      hydro.paleoSea.filter((p) => isHydroActive(p, 1500)).length >= 4 &&
      hydro.paleoSea.filter((p) => isHydroActive(p, 1900)).length === 0,
    'All paleo-sea masks must cover their historical epochs (<220, 220–1128, 1128–1823/1855) and vanish in the modern era'
  );
  assert(
    hydro.paleoSea[3].polys[0].length === 2 &&
      hydro.paleoSea[4].polys[0].length === 3 &&
      hydro.paleoSea[5].polys[0].length === 3 &&
      hydro.paleoSea[6].polys[0].length === 2 &&
      hydro.paleoSea[8].vanish === 1823,
    'Paleo-sea masks must include inner holes for Yuzhou Island (PS[3..5]), Dongsha / Chongming Island (PS[4..5]), and Xiangshan Island (PS[6]), plus the pre-1823 Taijiang Inner Sea (PS[8])'
  );
  const wangJing = hydro.rivers.find((r) => r.name === 'Huang' && r.appear === 11 && r.vanish === 1048);
  assert(
    wangJing &&
      JSON.stringify(wangJing.lines[0][wangJing.lines[0].length - 1]) === JSON.stringify([118.09, 37.56]),
    'Wang Jing Yellow River course (11–1048 CE) must terminate at the Qiancheng/Lijin estuary [118.09, 37.56]'
  );
  const jiEarly = hydro.rivers.find((r) => r.name === 'Ji' && r.vanish === 1128);
  const jiLate = hydro.rivers.find((r) => r.name === 'Ji' && r.appear === 1128 && r.vanish === 1855);
  assert(
    jiEarly &&
      JSON.stringify(jiEarly.lines[0][jiEarly.lines[0].length - 1]) === JSON.stringify([118.14, 37.5]) &&
      jiLate &&
      JSON.stringify(jiLate.lines[0][jiLate.lines[0].length - 1]) === JSON.stringify([118.46, 37.68]),
    'Ji / Daqing River must be split into <1128 ([118.14, 37.5]) and 1128–1855 ([118.46, 37.68]) estuaries'
  );
  const huaiEarly = hydro.rivers.find((r) => r.name === 'Huai' && r.vanish === 1194);
  const huangDuohuai = hydro.rivers.find((r) => r.name === 'Huang' && r.appear === 1194 && r.vanish === 1855 && r.lines[0][r.lines[0].length - 1][0] > 119);
  const cjEstuary = hydro.rivers.find((r) => r.name === 'Yangtze Estuary');
  assert(
    huaiEarly &&
      JSON.stringify(huaiEarly.lines[0][huaiEarly.lines[0].length - 1]) === JSON.stringify([119.49, 34.08]) &&
      huangDuohuai &&
      JSON.stringify(huangDuohuai.lines[0][huangDuohuai.lines[0].length - 1]) === JSON.stringify([119.95, 34.14]) &&
      cjEstuary &&
      JSON.stringify(cjEstuary.lines[0][cjEstuary.lines[0].length - 1]) === JSON.stringify([121.15, 31.75]),
    'Huai (<1194), Yellow-Huai (1194–1855), and Yangtze Estuary ([121.15, 31.75]) river mouths must terminate on their respective paleo-coastlines'
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
        if (!FAST_MODE) {
          for (const [lng, lat] of ring) {
            assert(lng >= 65 && lng <= 145 && lat >= 3 && lat <= 60, `Out-of-bounds province coordinate [${lng}, ${lat}] in ${prov.title}`);
          }
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

  const lakeLabels = (hydro.labels || []).filter((l) => l.kind === 'lake');

  if (!FAST_MODE) {
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
  }

  // 4a. Validate P0-B Bohai Bay & Yellow River Delta shoreline calibration & Dengzhou coastal seat
  const qinPol = snapshots.s_qin_a.polities.find((p) => p.title === '秦');
  const tangPol = snapshots.s_tang_b.polities.find((p) => p.title === '唐');
  const mingPol = snapshots.s_ming_a.polities.find((p) => p.title === '明');
  const qingEarlyPol = snapshots.s_qing_d.polities.find((p) => p.title === '清');
  const qingLatePol = snapshots.s_qing_e2.polities.find((p) => p.title === '清');
  assert(
    qinPol &&
      tangPol &&
      mingPol &&
      qingEarlyPol &&
      qingLatePol &&
      !pointInShape(118.95, 37.8, qinPol.shape) &&
      !pointInShape(118.95, 37.8, tangPol.shape) &&
      !pointInShape(118.95, 37.8, mingPol.shape) &&
      !pointInShape(118.95, 37.8, qingEarlyPol.shape) &&
      pointInShape(118.95, 37.8, qingLatePol.shape),
    'Pre-1855 polities must not wrap the post-1855 Dongying Yellow River delta lobe ([118.95, 37.8]), whereas post-1855 polities must cover it'
  );
  assert(
    !pointInShape(117.3, 38.8, qinPol.shape) && pointInShape(117.3, 38.8, tangPol.shape),
    'Pre-220 CE polities must reflect the western Bohai Bay marine transgression ([117.3, 38.8]), whereas post-220 CE polities cover the prograded shore'
  );
  const tangDynForDengzhou = dynasties.find((d) => d.key === 'tang');
  const dengzhouSettle = tangDynForDengzhou && tangDynForDengzhou.settlements.find((s) => s.ancient === '登州');
  assert(
    dengzhouSettle &&
      JSON.stringify(dengzhouSettle.coord) === JSON.stringify([120.76, 37.8]) &&
      pointInShape(120.76, 37.8, tangPol.shape),
    'Dengzhou (Penglai) settlement must sit at [120.76, 37.8] on the northern Jiaodong coast inside the calibrated Tang polygon'
  );
  // Validate P1 East China Coast & Yangtze Estuary progradation (Northern Jiangsu, Yuzhou Island, Dongsha/Chongming, Shanghai)
  assert(
    !pointInShape(120.45, 33.2, qinPol.shape) &&
      !pointInShape(120.45, 33.2, tangPol.shape) &&
      pointInShape(120.45, 33.2, mingPol.shape) &&
      pointInShape(120.45, 33.2, qingEarlyPol.shape),
    'Pre-1128 polities must follow the Fan Gong Dike shoreline in Northern Jiangsu (excluding [120.45, 33.2]), whereas post-1128 polities cover the prograded Yellow-Huai plain'
  );
  assert(
    !pointInShape(121.7, 31.1, qinPol.shape) &&
      !pointInShape(121.7, 31.1, tangPol.shape) &&
      pointInShape(121.7, 31.1, mingPol.shape) &&
      !pointInShape(121.88, 31.0, mingPol.shape) &&
      pointInShape(121.88, 31.0, qingLatePol.shape),
    'Shanghai coast must prograde from Gu Gangshen / Hanhaitang (<1128) to Qingongtang (1128–1855) to modern Nanhui (>=1855)'
  );
  assert(
    pointInShape(119.42, 34.73, qinPol.shape) &&
      pointInShape(119.42, 34.73, tangPol.shape) &&
      pointInShape(119.42, 34.73, mingPol.shape) &&
      !pointInShape(119.28, 34.72, tangPol.shape) &&
      pointInShape(119.28, 34.72, qingLatePol.shape),
    'Yuzhou Island ([119.42, 34.73]) must remain an offshore island separated by the Haizhou Bay strait ([119.28, 34.72]) prior to 1855 CE'
  );
  assert(
    !pointInShape(121.5, 31.62, qinPol.shape) &&
      pointInShape(121.5, 31.62, tangPol.shape) &&
      pointInShape(121.55, 31.62, mingPol.shape) &&
      pointInShape(121.55, 31.62, qingLatePol.shape),
    'Yangtze Estuary must transition from open funnel (<220) to Dongsha shoal (220–1128) to Chongming Island (>=1128)'
  );
  // Validate P2 Southeast & South China Coast (Pearl River Delta / Xiangshan Island, Tainan Taijiang Inner Sea, and coastal settlements)
  const qinFullPol = snapshots.s_qin.polities.find((p) => p.title === '秦');
  assert(
    qinFullPol &&
      !pointInShape(113.42, 22.58, qinFullPol.shape) &&
      !pointInShape(113.42, 22.58, tangPol.shape) &&
      pointInShape(113.48, 22.32, qinFullPol.shape) &&
      pointInShape(113.48, 22.32, tangPol.shape) &&
      pointInShape(113.42, 22.58, mingPol.shape) &&
      pointInShape(113.42, 22.58, qingEarlyPol.shape) &&
      !pointInShape(113.62, 22.55, mingPol.shape) &&
      !pointInShape(113.62, 22.55, qingEarlyPol.shape) &&
      pointInShape(113.62, 22.55, qingLatePol.shape),
    'Pearl River Delta must transition from open inner estuarine bay with offshore Xiangshan Island (<1128) to reclaimed Shatian plain (1128–1855) to modern Nansha/Wanqingsha shoreline (>=1855)'
  );
  const qingEarlyTw = snapshots.s_qing_d.regions.find((r) => r.title === '台湾');
  const qingLateTw = snapshots.s_qing_e2.regions.find((r) => r.title === '台湾');
  assert(
    qingEarlyTw &&
      qingLateTw &&
      !pointInShape(120.12, 23.08, qingEarlyPol.shape) &&
      !pointInShape(120.12, 23.08, qingEarlyTw.shape) &&
      pointInShape(120.12, 23.08, qingLatePol.shape) &&
      pointInShape(120.12, 23.08, qingLateTw.shape),
    'Tainan Taijiang Inner Sea ([120.12, 23.08]) must remain an open coastal lagoon prior to 1823 CE and silt into land in s_qing_e2 (>=1823)'
  );
  for (const d of dynasties) {
    const snap = snapshots[d.snapKey];
    if (!snap || !Array.isArray(snap.polities)) continue;
    for (const s of d.settlements || []) {
      const [sx, sy] = s.coord;
      const insideAny = snap.polities.some((p) => pointInShape(sx, sy, p.shape));
      assert(
        insideAny,
        `Settlement ${s.ancient} (${s.modern}) at [${sx}, ${sy}] in dynasty ${d.key} (${d.snapKey}) lies in the sea / outside all polities`
      );
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

  assert(
    bootSnaps &&
      Array.isArray(bootSnaps.neighbors) &&
      bootSnaps.s_zhanguo_a &&
      bootSnaps.s_qin_a &&
      (FAST_MODE
        ? bootSnaps.s_zhanguo_a.polities.length === snapshots.s_zhanguo_a.polities.length &&
          bootSnaps.s_qin_a.prefectures.length === snapshots.s_qin_a.prefectures.length
        : JSON.stringify(bootSnaps.s_zhanguo_a) === JSON.stringify(snapshots.s_zhanguo_a) &&
          JSON.stringify(bootSnaps.s_qin_a) === JSON.stringify(snapshots.s_qin_a)),
    'atlas_boot.js must provide neighbors, s_zhanguo_a, and s_qin_a identical to atlas_snapshots.js for instant first paint'
  );
  if (!FAST_MODE) {
    verifyShape(bootSnaps.s_zhanguo_a.polities[0].shape, 'boot.s_zhanguo_a.polities[0]');
  }

  // 6. Verify Unified Milestone Balloon Auto-Show ("史事浮签") follows #chk-milestones directly & dead code pruned
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

  // 6b. Verify Guqin audio tracks are self-hosted same-origin MP3s in assets/audio/ (reachable on mainland China Wi-Fi without upload.wikimedia.org DNS blocking)
  const guqinTracks = (sandbox.window.ATLAS_LORE_DATA && sandbox.window.ATLAS_LORE_DATA.GUQIN_TRACKS) || [];
  assert(guqinTracks.length >= 5, `Expected at least 5 GUQIN_TRACKS, got ${guqinTracks.length}`);
  for (const gt of guqinTracks) {
    assert(
      typeof gt.mp3 === 'string' && gt.mp3.startsWith('assets/audio/') && gt.mp3.endsWith('.mp3'),
      `GUQIN_TRACKS (${gt.zh}) primary mp3 must be a same-origin assets/audio/*.mp3 path, got ${gt.mp3}`
    );
    const audioPath = path.join(ROOT, gt.mp3);
    assert(fs.existsSync(audioPath), `Missing self-hosted Guqin audio file: ${gt.mp3}`);
    const audioSize = fs.statSync(audioPath).size;
    assert(audioSize > 100000, `Self-hosted Guqin audio file ${gt.mp3} is unexpectedly small (${audioSize} bytes)`);
  }

  // 6c. Prefecture and first-level region lines are clipped to the snapshot's own polities (#234),
  // so a second coastline or a commandery drawn in lost territory never shows.
  assert(
    indexHtml.includes('<clipPath id="prefecture-clip" clipPathUnits="userSpaceOnUse"><path id="prefecture-clip-path" /></clipPath>') &&
      appCode.includes("shapesGroup.setAttribute('clip-path', 'url(#prefecture-clip)')") &&
      appCode.includes("{ 'clip-path': 'url(#prefecture-clip)' }") &&
      appCode.includes("clipPath.setAttribute('d', ownPaths.join(''))"),
    'index.html & app.js must clip the prefecture layer and region lines to #prefecture-clip (the non-neighbor polities)'
  );

  // 7. Validate PR #7 (pass icon), PR #8 (balloon caret & bookmark toggle tab), and PR #10 (SEO metadata & sitemap)
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
  verifyIndexHtmlAssetHashes(ROOT, indexHtml, appCode);

  // 8. Verify AI-Native API (window.atlasAPI: locate / resolvePlace / inspect), PLACE_GAZETTEER, llms.txt & skill
  for (const strayFile of [
    'app.js',
    'atlas_trace.js',
    'atlas_search.js',
    'atlas_api.js',
    'atlas_quiz.js',
    'lore_data.js',
    'lore_core.js',
    'lore_detail.js',
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
  assert(
    !fs.existsSync(path.join(JS_DIR, 'lore_data.js')),
    'Legacy monolithic js/lore_data.js must not exist; lore data is split into js/lore_core.js and js/lore_detail.js'
  );
  assert(fs.existsSync(llmsTxtPath), 'llms.txt must exist in repository root');
  assert(fs.existsSync(skillMdPath), 'skills/jiangshan-atlas/SKILL.md must exist');
  assert(fs.existsSync(skillPyPath), 'skills/jiangshan-atlas/scripts/jiangshan.py must exist');
  assert(
    Array.isArray(loreData.PLACE_GAZETTEER) && loreData.PLACE_GAZETTEER.length >= 100,
    'lore_data.js must provide >= 100 PLACE_GAZETTEER entries with poetic/historical landmarks and city aliases'
  );
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

  const TRACE_METHODS = [
    'toggleGenealogySheetExpand',
    '_clearActiveTrace',
    '_clearActivePerson',
    'closeGenealogyCard',
    '_personSearchAliases',
    '_resolvePersonProfile',
    '_formatPersonSpan',
    '_tailorPersonEvent',
    '_collectPersonEvents',
    '_resolvePersonProfiles',
    '_eventsSharePlace',
    '_buildPersonTracksAndEvents',
    'openPersonChronicle',
    'openJourneyAsPerson',
    '_personAutoplayTick',
    'togglePersonAutoplay',
    'selectPersonEvent',
    '_getSoloStepOriginCoord',
    '_getMultiStepLegs',
    '_getNavigablePersonEventIdxs',
    'stepPersonEvent',
    '_getPersonVisibleTopFrac',
    '_getVisiblePersonTracks',
    '_framePersonOverview',
    '_flyToPersonEvent',
    '_findNearestPersonPin',
    '_renderPersonPinsOverlay',
    '_setHoveredPersonPin',
    '_renderPersonChronicleCard',
    '_renderPersonFooter',
    '_hidePersonFooter',
    '_syncTracedPrefecture',
    '_resolvePlaceLoreBanner',
    '_findNearbyPass',
    '_collectPlaceEventsForDynasty',
    '_findNearestTouchNode',
    '_stripModernProvincePrefix',
    '_resolveModernLocationAt',
    '_getCanonicalPlaces',
    '_findNearestSettlement',
    '_polityAt',
    '_shapeAnchorOrCentroid',
    '_minVertexDistSq',
    '_resolveEraPlaceAt',
    '_resolveModernIdentity',
    'openGenealogyAt',
    '_getCustomRouteVisibleTopFrac',
    '_buildJourneySegmentInfo',
    '_renderCartographicTrajectory',
  ];
  const TRACE_STATIC_PROPS = [
    'PERSON_PROFILES',
    'PERSON_TRACK_PALETTE',
    'PLACE_LANDMARK_EVENTS',
    'STRATEGIC_PASSES',
    'PLACE_GAZETTEER',
    'CITY_LORE',
    'HISTORICAL_JOURNEYS',
  ];
  const SEARCH_METHODS = [
    '_searchPlaceholder',
    '_getSearchSampleQueries',
    '_getSearchShowcasePool',
    '_ensureSearchIndex',
    '_parseChineseNumber',
    '_getCompiledEraSpans',
    '_matchEraResults',
    '_searchBucket',
    '_eventPinyinQuery',
    '_canMatchEventPinyin',
    '_queryQuickSearch',
    '_isDuplicateSearchEvent',
    '_appendEventPinyinResults',
    '_rankQuickSearchResults',
    '_selectSearchResult',
  ];
  const API_METHODS = [
    'clearCustomRoute',
    'selectCustomRouteStop',
    'stepCustomRoute',
    '_renderCustomRouteCard',
    '_parsePlaceList',
    '_parseYearList',
    '_parsePlaceTokens',
    'resolvePlace',
    '_resolvePlaceUncached',
    '_inspectCoord',
    '_drawCustomRouteOverlay',
    '_renderCustomRoute',
    'inspect',
    'locate',
    '_restoreFromQuery',
    '_registerWebMcpTools',
  ];
  const QUIZ_METHODS = [
    '_sanitizeChallengeClue',
    '_buildChallengeDeck',
    '_syncChallengeScrubberState',
    'startChallenge',
    'stopChallenge',
    '_renderChallengeQuestionText',
    'presentChallengeRound',
    '_drawQuizMark',
    '_setQuizChip',
    '_rescaleQuizChip',
    '_quizChipAt',
    '_previewLocatePin',
    '_renderChallengeAnsweredVerdict',
    '_evaluateLocateClick',
    '_finishChallenge',
  ];
  const NARRATOR_METHODS = [
    '_hasSpeechSynthesis',
    '_markNarratorUnsupported',
    '_probeNarratorSupport',
    '_spokenYear',
    '_spokenEra',
    '_spokenSiteIfAbsent',
    '_cleanSpokenText',
    '_candidateSpeechVoices',
    '_selectSpeechVoice',
    '_duckMusicForNarration',
    '_updateNarratorUi',
    '_isMajorStopYear',
    '_buildNarrationText',
    '_clearNarratorTimers',
    'speakCurrentState',
    '_dispatchUtterance',
    'silenceNarrator',
    'onNarratorSpeedChange',
    'startNarrator',
    'stopNarrator',
    'toggleNarrator',
  ];
  for (const traceMethod of TRACE_METHODS) {
    const desc = Object.getOwnPropertyDescriptor(ControllerClass.prototype, traceMethod);
    assert(
      desc && typeof desc.value === 'function' && desc.enumerable === false,
      `atlas_trace.js must attach ${traceMethod} as a non-enumerable method on HistoricalAtlasController.prototype`
    );
  }
  for (const traceStaticProp of TRACE_STATIC_PROPS) {
    const sDesc = Object.getOwnPropertyDescriptor(ControllerClass, traceStaticProp);
    assert(
      sDesc && (typeof sDesc.get === 'function' || Array.isArray(sDesc.value)),
      `atlas_trace.js must attach static property ${traceStaticProp} onto HistoricalAtlasController`
    );
  }
  for (const searchMethod of SEARCH_METHODS) {
    const desc = Object.getOwnPropertyDescriptor(ControllerClass.prototype, searchMethod);
    assert(
      desc && typeof desc.value === 'function' && desc.enumerable === false,
      `atlas_search.js must attach ${searchMethod} as a non-enumerable method on HistoricalAtlasController.prototype`
    );
  }
  for (const apiMethod of API_METHODS) {
    const desc = Object.getOwnPropertyDescriptor(ControllerClass.prototype, apiMethod);
    assert(
      desc && typeof desc.value === 'function' && desc.enumerable === false,
      `atlas_api.js must attach ${apiMethod} as a non-enumerable method on HistoricalAtlasController.prototype`
    );
  }
  for (const quizMethod of QUIZ_METHODS) {
    const desc = Object.getOwnPropertyDescriptor(ControllerClass.prototype, quizMethod);
    assert(
      desc && typeof desc.value === 'function' && desc.enumerable === false,
      `atlas_quiz.js must attach ${quizMethod} as a non-enumerable method on HistoricalAtlasController.prototype`
    );
  }
  for (const narratorMethod of NARRATOR_METHODS) {
    const desc = Object.getOwnPropertyDescriptor(ControllerClass.prototype, narratorMethod);
    assert(
      desc && typeof desc.value === 'function' && desc.enumerable === false,
      `atlas_narrator.js must attach ${narratorMethod} as a non-enumerable method on HistoricalAtlasController.prototype`
    );
  }
  {
    // Verify clean separation: app.js alone must not define any trace, search, api, quiz, or narrator mixin methods.
    const appOnlySandbox = { console, addEventListener: () => {} };
    appOnlySandbox.window = appOnlySandbox;
    vm.createContext(appOnlySandbox);
    controllerBundles[0].script.runInContext(appOnlySandbox);
    const BaseClass = appOnlySandbox.window.HistoricalAtlasController;
    for (const m of [
      ...TRACE_METHODS,
      ...SEARCH_METHODS,
      ...API_METHODS,
      ...QUIZ_METHODS,
      ...NARRATOR_METHODS,
    ]) {
      assert.strictEqual(
        Object.prototype.hasOwnProperty.call(BaseClass.prototype, m),
        false,
        `Method ${m} must live in its dedicated mixin module, not in js/app.js`
      );
    }

    // Controller modules must install correctly in either load order.
    const orderSandbox = { console, addEventListener: () => {} };
    orderSandbox.window = orderSandbox;
    vm.createContext(orderSandbox);
    for (const b of [...controllerBundles].reverse()) b.script.runInContext(orderSandbox);
    const ReorderedClass = orderSandbox.window.HistoricalAtlasController;
    assert(
      typeof ReorderedClass === 'function' &&
        TRACE_METHODS.every((m) => typeof ReorderedClass.prototype[m] === 'function') &&
        SEARCH_METHODS.every((m) => typeof ReorderedClass.prototype[m] === 'function') &&
        API_METHODS.every((m) => typeof ReorderedClass.prototype[m] === 'function') &&
        QUIZ_METHODS.every((m) => typeof ReorderedClass.prototype[m] === 'function') &&
        NARRATOR_METHODS.every((m) => typeof ReorderedClass.prototype[m] === 'function') &&
        Array.isArray(ReorderedClass.PERSON_TRACK_PALETTE) &&
        ReorderedClass.PERSON_TRACK_PALETTE.length >= 3,
      'atlas_trace.js, atlas_search.js, atlas_api.js, atlas_quiz.js, and atlas_narrator.js loaded before app.js must attach all mixin methods via window.__ATLAS_MIXINS'
    );
    assert.strictEqual(
      orderSandbox.window.__ATLAS_MIXINS.length,
      0,
      'app.js must drain window.__ATLAS_MIXINS after defining HistoricalAtlasController'
    );
    const reorderedInst = Object.create(ReorderedClass.prototype);
    reorderedInst.locale = 'zh';
    assert.strictEqual(
      reorderedInst._sanitizeChallengeClue('今淄博城（今山东淄博）', { modern: '' }, '临淄'),
      '此城',
      'Quiz methods installed through the mixin queue must run against the late-bound controller'
    );
    const hitPolity = reorderedInst._polityAt(108.9, 34.2, {
      polities: [
        {
          name: '秦',
          role: 'empire',
          shape: {
            type: 'Polygon',
            coordinates: [[[105, 30], [112, 30], [112, 38], [105, 38], [105, 30]]],
          },
        },
      ],
    });
    assert(
      hitPolity && hitPolity.name === '秦',
      'Trace methods installed through the mixin queue must bind MercatorProjector from the late-bound controller'
    );
    assert(
      reorderedInst
        ._personSearchAliases({ zh: '苏轼', en: 'Su Shi', aliases: ['苏东坡'] })
        .includes('苏东坡'),
      'Trace methods installed through the mixin queue must execute person alias resolution cleanly'
    );
    assert.strictEqual(
      reorderedInst._parseChineseNumber('二十三'),
      23,
      'Search methods installed through the mixin queue must parse Chinese numerals cleanly'
    );
    assert.strictEqual(
      reorderedInst._parsePlaceList('长安, 洛阳 -> 敦煌').join('|'),
      '长安|洛阳|敦煌',
      'API methods installed through the mixin queue must parse multi-stop place lists cleanly'
    );
  }
  {
    const probe = Object.create(ControllerClass.prototype);
    let enumerations = 0;
    const dict = new Proxy({ sample: 'translation' }, {
      ownKeys(target) { enumerations++; return Reflect.ownKeys(target); },
    });
    probe._setEnglishLocale({ dict });
    assert.strictEqual(probe._hasEnDict(), true, 'A loaded dictionary must be available');
    for (let i = 0; i < 20; i++) assert.strictEqual(probe._hasEnDict(), true);
    assert.strictEqual(enumerations, 1, 'Dictionary availability must not rescan on the hot path');
    probe._setEnglishLocale({ dict: {} });
    assert.strictEqual(probe._hasEnDict(), false, 'Replacing with an empty dictionary resets the flag');
    probe._setEnglishLocale(null);
    assert.strictEqual(probe._hasEnDict(), false, 'A missing locale remains supported');
  }
  assert.strictEqual(
    typeof ctrl._lazyAssetUrl,
    'function',
    'HistoricalAtlasController must define _lazyAssetUrl(relPath, datasetKey)'
  );
  {
    const savedDocLazy = sandbox.document;
    const savedWinVers = sandbox.window.ATLAS_ASSET_VERSIONS;
    sandbox.document = {
      getElementById: (id) =>
        id === 'atlas-app-script'
          ? {
              dataset: {
                vSnapshots: 'a1b2c3d4',
                vI18n: 'e5f60718',
                vLore: '11223344',
                vHant: '55667788',
                vQuiz: '99aabbcc',
                vNarrator: 'ddeeff00',
              },
            }
          : null,
    };
    assert.strictEqual(
      ctrl._lazyAssetUrl('js/atlas_snapshots.js', 'vSnapshots'),
      'js/atlas_snapshots.js?v=a1b2c3d4',
      '_lazyAssetUrl must read data-v-snapshots from #atlas-app-script'
    );
    assert.strictEqual(
      ctrl._lazyAssetUrl('js/i18n_dict.js', 'vI18n'),
      'js/i18n_dict.js?v=e5f60718',
      '_lazyAssetUrl must read data-v-i18n from #atlas-app-script'
    );
    assert.strictEqual(
      ctrl._lazyAssetUrl('js/lore_detail.js', 'vLore'),
      'js/lore_detail.js?v=11223344',
      '_lazyAssetUrl must read data-v-lore from #atlas-app-script'
    );
    assert.strictEqual(
      ctrl._lazyAssetUrl('js/zh_hant.js', 'vHant'),
      'js/zh_hant.js?v=55667788',
      '_lazyAssetUrl must read data-v-hant from #atlas-app-script'
    );
    assert.strictEqual(
      ctrl._lazyAssetUrl('js/atlas_quiz.js', 'vQuiz'),
      'js/atlas_quiz.js?v=99aabbcc',
      '_lazyAssetUrl must read data-v-quiz from #atlas-app-script'
    );
    assert.strictEqual(
      ctrl._lazyAssetUrl('js/atlas_narrator.js', 'vNarrator'),
      'js/atlas_narrator.js?v=ddeeff00',
      '_lazyAssetUrl must read data-v-narrator from #atlas-app-script'
    );
    assert.strictEqual(ctrl._hasZhHant(), true, '_hasZhHant must detect loaded ZH_HANT_CONV');
    assert.strictEqual(ctrl._isQuizLoaded(), true, '_isQuizLoaded must detect installed AtlasQuizMixin');
    assert.strictEqual(
      ctrl._isNarratorLoaded(),
      true,
      '_isNarratorLoaded must detect installed AtlasNarratorMixin'
    );
    sandbox.document = undefined;
    sandbox.window.ATLAS_ASSET_VERSIONS = { vSnapshots: 'deadbeef' };
    assert.strictEqual(
      ctrl._lazyAssetUrl('js/atlas_snapshots.js', 'vSnapshots'),
      'js/atlas_snapshots.js?v=deadbeef',
      '_lazyAssetUrl must support window.ATLAS_ASSET_VERSIONS fallback'
    );
    sandbox.window.ATLAS_ASSET_VERSIONS = null;
    assert.strictEqual(
      ctrl._lazyAssetUrl('js/atlas_snapshots.js', 'vSnapshots'),
      'js/atlas_snapshots.js',
      '_lazyAssetUrl must fall back cleanly to bare path when no hash metadata is present'
    );
    sandbox.document = savedDocLazy;
    sandbox.window.ATLAS_ASSET_VERSIONS = savedWinVers;
    {
      // Verify narrator speed-adaptive LOD, imperial era formatting, and site deduplication
      const savedLocale = ctrl.locale;
      const savedSpeed = ctrl.playSpeed;
      const savedDynIdx = ctrl.dynastyIdx;
      const savedYear = ctrl.year;
      ctrl.locale = 'zh';
      ctrl.dynastyIdx = dynasties.findIndex((d) => d.key === 'tang');
      ctrl.year = 755;
      ctrl.playSpeed = 1;
      const text1x = ctrl._buildNarrationText({ forceIntro: true });
      assert(
        text1x.includes('公元755年') &&
          text1x.includes('唐玄宗天宝十四年') &&
          text1x.includes('范阳'),
        `1x narration at 755 CE must include year, imperial era, and milestone text, got: ${text1x}`
      );
      ctrl.playSpeed = 4;
      const text4xNew = ctrl._buildNarrationText({ forceIntro: true });
      const text4xSame = ctrl._buildNarrationText({ forceIntro: false });
      assert.strictEqual(text4xNew, '唐', '4x narration on dynasty switch must speak only dynasty title');
      assert.strictEqual(text4xSame, '', '4x narration within same dynasty must remain silent');
      ctrl.locale = savedLocale;
      ctrl.playSpeed = savedSpeed;
      ctrl.dynastyIdx = savedDynIdx;
      ctrl.year = savedYear;
    }

    // Verify perf_budget.js first-paint synchronous script gzip budget
    const { measurePerfBudget, readBaseline: readPerfBaseline } = require('../perf_budget');
    const perfReport = measurePerfBudget(ROOT);
    const perfBaseline = readPerfBaseline(ROOT);
    assert(
      perfBaseline && typeof perfBaseline.maxSyncScriptsGzipBytes === 'number',
      'data/atlas/perf_baseline.json must exist and define maxSyncScriptsGzipBytes'
    );
    assert(
      perfReport.syncScriptsGzipBytes <= perfBaseline.maxSyncScriptsGzipBytes,
      `Synchronous first-paint script gzip sum (${perfReport.syncScriptsGzipBytes} B) exceeds budget ceiling (${perfBaseline.maxSyncScriptsGzipBytes} B)`
    );
    assert(
      perfReport.syncScripts.some((s) => s.relPath === 'js/lore_core.js') &&
        !perfReport.syncScripts.some((s) => s.relPath === 'js/lore_detail.js') &&
        !perfReport.syncScripts.some((s) => s.relPath === 'js/zh_hant.js') &&
        !perfReport.syncScripts.some((s) => s.relPath === 'js/atlas_quiz.js') &&
        !perfReport.syncScripts.some((s) => s.relPath === 'js/atlas_narrator.js') &&
        perfReport.lazyScripts.some((s) => s.relPath === 'js/lore_detail.js') &&
        perfReport.lazyScripts.some((s) => s.relPath === 'js/zh_hant.js') &&
        perfReport.lazyScripts.some((s) => s.relPath === 'js/atlas_quiz.js') &&
        perfReport.lazyScripts.some((s) => s.relPath === 'js/atlas_narrator.js'),
      'index.html must load js/lore_core.js synchronously and defer js/lore_detail.js, js/zh_hant.js, js/atlas_quiz.js, and js/atlas_narrator.js as lazy bundles'
    );
  }


  ctx.stats.provRingCount = provRingCount;
  ctx.stats.totalSettlements = totalSettlements;
  ctx.stats.totalMilestones = totalMilestones;
  ctx.stats.referencedSnaps = referencedSnaps;
  ctx.stats.decodedPolygons = decodedPolygons;
  ctx.stats.totalVertices = totalVertices;
}

module.exports = { runCoreDataSuite };
