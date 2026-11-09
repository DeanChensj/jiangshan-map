'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { CONTROLLER_SCRIPTS } = require('../sync_version');

const ROOT = path.resolve(__dirname, '..', '..');
const JS_DIR = path.join(ROOT, 'js');

function createValidationContext({ fastMode = false } = {}) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);

  const dataScripts = [
    'china_geo_data.js',
    'atlas_boot.js',
    'atlas_snapshots.js',
    'map_data.js',
    'lore_core.js',
    'lore_detail.js',
    'event_pinyin.js',
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
    if (file === 'lore_core.js') {
      assert(
        !sandbox.window.ATLAS_LORE_DETAIL_LOADED &&
          !sandbox.window.ATLAS_LORE_DATA.PLACE_LANDMARK_EVENTS &&
          !sandbox.window.ATLAS_LORE_DATA.CITY_LORE &&
          Array.isArray(sandbox.window.ATLAS_LORE_DATA.CHINESE_ERA_SPANS) &&
          Array.isArray(sandbox.window.ATLAS_LORE_DATA.PLACE_GAZETTEER) &&
          Array.isArray(sandbox.window.ATLAS_LORE_DATA.PERSON_PROFILES) &&
          Array.isArray(sandbox.window.ATLAS_LORE_DATA.POLITY_PROFILES) &&
          Array.isArray(sandbox.window.ATLAS_LORE_DATA.STRATEGIC_PASSES) &&
          sandbox.window.ATLAS_LORE_DATA.POLITY_PROFILES.every(
            (p) => !p.summaryZh && !p.summaryEn && !p.rulersZh && !p.rulersEn && !p.keywords
          ) &&
          sandbox.window.ATLAS_LORE_DATA.PERSON_PROFILES.every(
            (p) => !p.stops && !p.tokens && !p.descZh && !p.descEn
          ) &&
          sandbox.window.ATLAS_LORE_DATA.STRATEGIC_PASSES.every(
            (p) => !p.chokepointZh && !p.chokepointEn
          ),
        'lore_core.js must provide lightweight first-paint & search lore (deferring polity/person/pass detail prose to lore_detail.js) and must not set ATLAS_LORE_DETAIL_LOADED'
      );
    }
    if (file === 'lore_detail.js') {
      assert(
        sandbox.window.ATLAS_LORE_DETAIL_LOADED === true &&
          Array.isArray(sandbox.window.ATLAS_LORE_DATA.PLACE_LANDMARK_EVENTS) &&
          Array.isArray(sandbox.window.ATLAS_LORE_DATA.CITY_LORE) &&
          Array.isArray(sandbox.window.ATLAS_LORE_DATA.HISTORICAL_JOURNEYS) &&
          Array.isArray(sandbox.window.ATLAS_LORE_DATA.POLITY_PROFILES) &&
          sandbox.window.ATLAS_LORE_DATA.POLITY_PROFILES.every((p) => p.summaryZh && p.summaryEn) &&
          sandbox.window.ATLAS_LORE_DATA.STRATEGIC_PASSES.every(
            (p) => p.chokepointZh && p.chokepointEn
          ) &&
          Boolean(
            (sandbox.window.ATLAS_LORE_DATA.PERSON_PROFILES.find((p) => p.key === 'yuxi') || {})
              .stops
          ),
        'lore_detail.js must set window.ATLAS_LORE_DETAIL_LOADED = true, merge detail arrays, and hydrate POLITY_SUMMARIES, PERSON_DETAILS, and PASS_DETAILS'
      );
    }
  }

  const controllerBundles = CONTROLLER_SCRIPTS.map((relPath) => {
    const full = path.join(ROOT, relPath);
    assert(fs.existsSync(full), `Missing controller module: ${relPath}`);
    const code = fs.readFileSync(full, 'utf8');
    return {
      relPath,
      code,
      script: new vm.Script(code, { filename: path.basename(relPath) }),
    };
  });
  const appCode = controllerBundles.map((b) => b.code).join('\n');

  const provinces = sandbox.window.PROVINCE_OUTLINES;
  const snapshots = sandbox.window.ATLAS_SNAPSHOTS;
  const snapKeys = Object.keys(snapshots);
  const dynasties = sandbox.window.DYNASTY_DATA;
  const corridors = sandbox.window.CORRIDOR_DATA;
  const loreData = sandbox.window.ATLAS_LORE_DATA;
  const enLocale = sandbox.window.EN_LOCALE;
  const hydro = sandbox.window.HYDRO_DATA;

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
  for (const b of controllerBundles) {
    b.script.runInContext(sandbox);
  }
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
  ctrl._setEnglishLocale(enLocale);
  ctrl._initTimelineBands();

  const RING_BBOX_CACHE = new WeakMap();
  const SHAPE_BBOX_CACHE = new WeakMap();
  function ringBbox(ring) {
    let b = RING_BBOX_CACHE.get(ring);
    if (!b) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < ring.length; i++) {
        const x = ring[i][0];
        const y = ring[i][1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      b = { minX, minY, maxX, maxY };
      RING_BBOX_CACHE.set(ring, b);
    }
    return b;
  }
  function shapeBbox(shape) {
    let b = SHAPE_BBOX_CACHE.get(shape);
    if (!b) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const polys = shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates;
      for (const poly of polys) {
        for (const ring of poly) {
          const rb = ringBbox(ring);
          if (rb.minX < minX) minX = rb.minX;
          if (rb.maxX > maxX) maxX = rb.maxX;
          if (rb.minY < minY) minY = rb.minY;
          if (rb.maxY > maxY) maxY = rb.maxY;
        }
      }
      b = { minX, minY, maxX, maxY };
      SHAPE_BBOX_CACHE.set(shape, b);
    }
    return b;
  }
  function pointInRing(x, y, ring) {
    const rb = ringBbox(ring);
    if (x < rb.minX || x > rb.maxX || y < rb.minY || y > rb.maxY) return false;
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
    const sb = shapeBbox(shape);
    if (x < sb.minX || x > sb.maxX || y < sb.minY || y > sb.maxY) return false;
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
  function collectVertices(shape) {
    const out = [];
    if (!shape || !shape.coordinates) return out;
    const polys = shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        for (const pt of ring) out.push(pt);
      }
    }
    return out;
  }

  const personEventsCache = new Map();
  const getCachedPersonEvents = (p) => {
    if (!personEventsCache.has(p.key)) {
      personEventsCache.set(p.key, ctrl._collectPersonEvents(p));
    }
    return personEventsCache.get(p.key);
  };

  let hydrated = false;
  function ensureHydrated() {
    if (!hydrated) {
      ctrl.projector.toScreen = (lng, lat) => [(lng - 66) * 13.15, (55 - lat) * 17.07];
      ctrl._hydrateSnapshots();
      hydrated = true;
    }
    if (!Object.prototype.hasOwnProperty.call(ctrl, '_svgNode')) {
      ctrl._svgNode = (tag, attrs) => ({ tag, attrs, dataset: {}, appendChild() {}, setAttribute() {} });
    }
    if (!Object.prototype.hasOwnProperty.call(ctrl, '_id')) {
      ctrl._id = () => null;
    }
    if (!ctrl.grpGhostDiff) ctrl.grpGhostDiff = { innerHTML: '' };
    if (!ctrl.grpPrefectures) ctrl.grpPrefectures = { querySelectorAll: () => [] };
    if (!ctrl.grpMilestones) ctrl.grpMilestones = { querySelectorAll: () => [], classList: { contains: () => false } };
    if (!ctrl.milestoneBalloon) {
      ctrl.milestoneBalloon = { innerHTML: '', classList: { add() {}, remove() {}, contains: () => true } };
    }
    if (!Object.prototype.hasOwnProperty.call(ctrl, '_animateCameraTo')) ctrl._animateCameraTo = () => {};
    if (!Object.prototype.hasOwnProperty.call(ctrl, '_positionMilestoneBalloon')) ctrl._positionMilestoneBalloon = () => {};
    if (!Object.prototype.hasOwnProperty.call(ctrl, '_syncMilestoneSelection')) ctrl._syncMilestoneSelection = () => {};
    if (!Object.prototype.hasOwnProperty.call(ctrl, '_highlightCurrentMilestone')) ctrl._highlightCurrentMilestone = () => {};
    if (!Object.prototype.hasOwnProperty.call(ctrl, 'stopAutoplay')) ctrl.stopAutoplay = () => {};
    if (!Object.prototype.hasOwnProperty.call(ctrl, 'closeMilestoneBalloon')) ctrl.closeMilestoneBalloon = () => {};
    if (!Object.prototype.hasOwnProperty.call(ctrl, '_updateScaleBar')) ctrl._updateScaleBar = () => {};
    if (!Object.prototype.hasOwnProperty.call(ctrl, '_renderLegendBox')) ctrl._renderLegendBox = () => {};
    if (!Object.prototype.hasOwnProperty.call(ctrl, '_dismissTraceOnboarding')) ctrl._dismissTraceOnboarding = () => {};
    if (!Object.prototype.hasOwnProperty.call(ctrl, 'jumpToYear')) {
      ctrl.jumpToYear = function (y) {
        this.year = y;
        this.dynastyIdx = this._findDynastyIndex(y);
        const cur = this.dynasties[this.dynastyIdx];
        const sk = this._resolveSnapKey(cur, y);
        this.activeSnapKey = sk;
        this.lastRenderedSnap = this.snapshots[sk];
      };
    }
  }

  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const cssSrc = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
  const sitemapXml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const robotsTxt = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  const llmsTxtPath = path.join(ROOT, 'llms.txt');
  const skillMdPath = path.join(ROOT, 'skills', 'jiangshan-atlas', 'SKILL.md');
  const skillPyPath = path.join(ROOT, 'skills', 'jiangshan-atlas', 'scripts', 'jiangshan.py');
  const llmsTxt = fs.readFileSync(llmsTxtPath, 'utf8');
  const readmeSrc = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const readmeZhSrc = fs.readFileSync(path.join(ROOT, 'README_ZH.md'), 'utf8');
  const contributingSrc = fs.readFileSync(path.join(ROOT, 'CONTRIBUTING.md'), 'utf8');
  const contributingZhSrc = fs.readFileSync(path.join(ROOT, 'CONTRIBUTING_ZH.md'), 'utf8');

  const zgDyn = dynasties.find((d) => d.key === 'zhanguo');
  const qinDyn = dynasties.find((d) => d.key === 'qin');
  const xihanDyn = dynasties.find((d) => d.key === 'xihan');
  const tangDyn = dynasties.find((d) => d.key === 'tang');
  const bsDyn = dynasties.find((d) => d.key === 'beisong');
  const nsDyn = dynasties.find((d) => d.key === 'nansong');
  const mingDyn = dynasties.find((d) => d.key === 'ming');
  const qingDyn = dynasties.find((d) => d.key === 'qing');
  const rocDyn = dynasties.find((d) => d.key === 'roc');
  const prcDyn = dynasties.find((d) => d.key === 'prc');
  const mingPol = snapshots.s_ming_a.polities.find((p) => p.title === '明');

  const stats = {
    provRingCount: 0,
    totalSettlements: 0,
    totalMilestones: 0,
    referencedSnaps: new Set(),
    decodedPolygons: 0,
    totalVertices: 0,
    sweptYears: 0,
    totalJourneyStops: 0,
  };

  return {
    ROOT,
    JS_DIR,
    FAST_MODE: Boolean(fastMode),
    sandbox,
    ControllerClass,
    controllerBundles,
    ctrl,
    DEG_TO_RAD,
    provinces,
    snapshots,
    snapKeys,
    bootSnapshots,
    bootSnaps: bootSnapshots,
    dynasties,
    corridors,
    loreData,
    enLocale,
    hydro,
    indexHtml,
    htmlSrc: indexHtml,
    cssSrc,
    styleCss: cssSrc,
    appCode,
    sitemapXml,
    robotsTxt,
    llmsTxtPath,
    skillMdPath,
    skillPyPath,
    llmsTxt,
    llmsSrc: llmsTxt,
    readmeSrc,
    readmeZhSrc,
    contributingSrc,
    contributingZhSrc,
    zgDyn,
    qinDyn,
    xihanDyn,
    tangDyn,
    bsDyn,
    nsDyn,
    mingDyn,
    qingDyn,
    rocDyn,
    prcDyn,
    mingPol,
    ringBbox,
    shapeBbox,
    pointInRing,
    pointInShape,
    collectVertices,
    getCachedPersonEvents,
    ensureHydrated,
    stats,
  };
}

module.exports = {
  ROOT,
  JS_DIR,
  createValidationContext,
};
