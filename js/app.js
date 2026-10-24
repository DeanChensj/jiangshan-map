/**
 * Historical Atlas Controller (ES6 Class Architecture)
 */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const RAD_TO_DEG = 180 / Math.PI;
  const DEG_TO_RAD = Math.PI / 180;
  // Regime prefixes carried by era-span names, e.g. '北魏正光' = '北魏' + era '正光'.
  const ERA_DYNASTY_PREFIXES = [
    '南朝宋', '南朝齐', '南朝梁', '南朝陈', '西汉', '东汉', '新莽', '西晋', '东晋',
    '北魏', '东魏', '西魏', '北齐', '北周', '西梁', '武周', '后梁', '后唐', '后晋', '后汉', '后周',
    '北宋', '南宋', '蜀汉', '西夏', '汉', '魏', '吴', '隋', '唐', '辽', '金', '元', '明', '清',
  ];
  // Timeline autoplay: the playhead crosses the scrubber bar at a constant speed (each
  // dynasty gets time in proportion to its band width), lands on every milestone year,
  // shows each callout for at least ~1 s, and holds on milestones that open a dynasty or
  // are flagged isMapChange.
  const AUTOPLAY_TICK_MS = 280;
  const AUTOPLAY_FULL_RUN_MS = 9 * 60 * 1000;
  const AUTOPLAY_MIN_SHOW_TICKS = 4;
  const AUTOPLAY_HOLD_TICKS = Math.round(2500 / AUTOPLAY_TICK_MS);
  const PERSON_AUTOPLAY_STEP_MS = 2600;
  const PLAY_SPEED_STEPS = [1, 2, 0.25, 0.5];

  function escHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  class MercatorProjector {
    constructor(width, height, bounds) {
      this.width = width;
      this.height = height;
      this.bounds = bounds;
      const spanLng = bounds.east - bounds.west;
      const spanLat = (this._latToMerc(bounds.north) - this._latToMerc(bounds.south)) * RAD_TO_DEG;
      this.scale = Math.min(width / spanLng, height / spanLat);
      this.padX = (width - spanLng * this.scale) * 0.5;
      this.padY = (height - spanLat * this.scale) * 0.5;
      this.northMerc = this._latToMerc(bounds.north);
    }

    _latToMerc(lat) {
      return Math.log(Math.tan(Math.PI * 0.25 + (lat * DEG_TO_RAD) * 0.5));
    }

    toScreen(lng, lat) {
      const x = (lng - this.bounds.west) * this.scale + this.padX;
      const y = (this.northMerc - this._latToMerc(lat)) * RAD_TO_DEG * this.scale + this.padY;
      return [x, y];
    }

    toGeo(x, y) {
      const lng = (x - this.padX) / this.scale + this.bounds.west;
      const merc = this.northMerc - (y - this.padY) / (this.scale * RAD_TO_DEG);
      const lat = (2 * Math.atan(Math.exp(merc)) - Math.PI * 0.5) * RAD_TO_DEG;
      return [lng, lat];
    }

    greatCircleKm(coordA, coordB) {
      const dLat = (coordB[1] - coordA[1]) * DEG_TO_RAD;
      const dLng = (coordB[0] - coordA[0]) * DEG_TO_RAD;
      const a =
        Math.sin(dLat * 0.5) ** 2 +
        Math.cos(coordA[1] * DEG_TO_RAD) *
          Math.cos(coordB[1] * DEG_TO_RAD) *
          Math.sin(dLng * 0.5) ** 2;
      return 12742 * Math.asin(Math.sqrt(a));
    }

    ringToSvgPath(ring) {
      let out = '';
      for (let i = 0; i < ring.length; i++) {
        const [px, py] = this.toScreen(ring[i][0], ring[i][1]);
        out += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1);
      }
      return out ? out + 'Z' : '';
    }

    smoothRingToSvgPath(ring) {
      if (!ring || ring.length < 3) return '';
      let n = ring.length;
      if (
        n > 3 &&
        Math.abs(ring[0][0] - ring[n - 1][0]) < 1e-6 &&
        Math.abs(ring[0][1] - ring[n - 1][1]) < 1e-6
      ) {
        n--;
      }
      if (n < 3) return this.ringToSvgPath(ring);

      const pts = new Array(n);
      for (let i = 0; i < n; i++) {
        pts[i] = this.toScreen(ring[i][0], ring[i][1]);
      }

      const sx = new Float64Array(n);
      const sy = new Float64Array(n);
      const ex = new Float64Array(n);
      const ey = new Float64Array(n);
      const curved = new Uint8Array(n);

      for (let i = 0; i < n; i++) {
        const p0 = pts[i];
        const p1 = pts[(i + 1) % n];
        const dx = p1[0] - p0[0];
        const dy = p1[1] - p0[1];
        const len = Math.hypot(dx, dy);
        if (len >= 1.6) {
          const t = Math.min(0.28, 4.2 / len);
          sx[i] = p0[0] + dx * t;
          sy[i] = p0[1] + dy * t;
          ex[i] = p1[0] - dx * t;
          ey[i] = p1[1] - dy * t;
          curved[i] = 1;
        } else {
          sx[i] = p0[0];
          sy[i] = p0[1];
          ex[i] = p1[0];
          ey[i] = p1[1];
        }
      }

      let out = `M${sx[0].toFixed(1)} ${sy[0].toFixed(1)}`;
      for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        if (curved[i]) {
          out += `L${ex[i].toFixed(1)} ${ey[i].toFixed(1)}`;
        }
        const vx = pts[next][0];
        const vy = pts[next][1];
        if (curved[i] && curved[next]) {
          out += `Q${vx.toFixed(1)} ${vy.toFixed(1)} ${sx[next].toFixed(1)} ${sy[next].toFixed(1)}`;
        } else {
          out += `L${sx[next].toFixed(1)} ${sy[next].toFixed(1)}`;
        }
      }
      return out + 'Z';
    }

    _orientRing(ring, isHole = false) {
      if (!ring || ring.length < 3) return ring;
      let area2 = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        area2 += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      }
      if (area2 === 0) return ring;
      const wantPositive = !isHole;
      if ((area2 > 0) !== wantPositive) {
        return ring.slice().reverse();
      }
      return ring;
    }

    multiRingsToSvgPath(polygons) {
      return polygons
        .map((poly) =>
          poly.map((r, idx) => this.ringToSvgPath(this._orientRing(r, idx > 0))).join('')
        )
        .join('');
    }

    shapeToSvgPath(shapeObj, smooth = true) {
      if (!shapeObj) return '';
      const cacheKey = smooth ? '_svgPathSmooth' : '_svgPath';
      if (shapeObj[cacheKey] !== undefined) return shapeObj[cacheKey];
      const fn = (r, idx) => {
        const oriented = this._orientRing(r, idx > 0);
        return smooth ? this.smoothRingToSvgPath(oriented) : this.ringToSvgPath(oriented);
      };
      let d = '';
      if (shapeObj.type === 'Polygon') {
        d = shapeObj.coordinates.map((r, idx) => fn(r, idx)).join('');
      } else if (shapeObj.type === 'MultiPolygon') {
        d = shapeObj.coordinates.map((poly) => poly.map((r, idx) => fn(r, idx)).join('')).join('');
      }
      Object.defineProperty(shapeObj, cacheKey, {
        value: d,
        writable: true,
        enumerable: false,
        configurable: true,
      });
      return d;
    }

    static pointInRing(lng, lat, ring) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi) {
          inside = !inside;
        }
      }
      return inside;
    }

    static pointInPolygonRings(lng, lat, rings) {
      if (!rings || !rings.length || !MercatorProjector.pointInRing(lng, lat, rings[0])) {
        return false;
      }
      for (let k = 1; k < rings.length; k++) {
        if (MercatorProjector.pointInRing(lng, lat, rings[k])) return false;
      }
      return true;
    }

    static pointInShape(lng, lat, shapeObj) {
      if (!shapeObj) return false;
      if (shapeObj.type === 'Polygon') {
        return MercatorProjector.pointInPolygonRings(lng, lat, shapeObj.coordinates);
      }
      if (shapeObj.type === 'MultiPolygon') {
        return shapeObj.coordinates.some((p) =>
          MercatorProjector.pointInPolygonRings(lng, lat, p)
        );
      }
      return false;
    }
  }

  const SVG_ICONS = {
    pin: '<svg class="ico-svg" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M8 1.5a4.4 4.4 0 0 0-4.4 4.4c0 3.2 4.4 8.6 4.4 8.6s4.4-5.4 4.4-8.6A4.4 4.4 0 0 0 8 1.5zm0 6a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2z" fill="currentColor"/></svg>',
    mapChange:
      '<svg class="ico-svg ev-map-svg" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M1.8 3.6L5.8 2l4.4 1.8L14.2 2v10.4l-4 1.6-4.4-1.8-4 1.6V3.6zm4 .2v8.6m4.4-6.8v8.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    dashedBox:
      '<svg class="ico-svg" viewBox="0 0 14 14" width="11" height="11" aria-hidden="true"><rect x="1.5" y="1.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2.5 1.5"/></svg>',
    play: '<svg class="ico-svg" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><polygon points="4.5,2.8 13.2,8 4.5,13.2" fill="currentColor"/></svg>',
    pause:
      '<svg class="ico-svg" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3.8" y="3" width="3" height="10" rx="0.8" fill="currentColor"/><rect x="9.2" y="3" width="3" height="10" rx="0.8" fill="currentColor"/></svg>',
    arrowLeft:
      '<svg class="ico-svg" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M13 8H3.5M7.5 4l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrowRight:
      '<svg class="ico-svg" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  class HistoricalAtlasController {
    constructor() {
      this.dynasties = window.DYNASTY_DATA || [];
      this.provinces = window.PROVINCE_OUTLINES || [];
      this.corridors = window.CORRIDOR_DATA || [];
      this.snapshots = window.ATLAS_SNAPSHOTS || {};
      this._fullSnapshotsLoaded = Boolean(
        window.ATLAS_FULL_SNAPSHOTS_LOADED || (this.snapshots && this.snapshots.s_prc)
      );
      this._fullSnapshotsPromise = null;
      this._enLocalePromise = null;
      this._hydrateSnapshots();

      this.enLocale = window.EN_LOCALE || {
        strings: {},
        dynasties: {},
        milestones: {},
        corridors: {},
        dict: {},
      };

      this.projector = new MercatorProjector(1000, 700, {
        west: 66,
        east: 142,
        south: 14,
        north: 55,
      });

      this.minYear = this.dynasties[0].fromYear;
      this.maxYear = this.dynasties[this.dynasties.length - 1].toYear;
      this._initTimelineBands();

      const rawLang = (new URLSearchParams(location.search).get('lang') || '').toLowerCase();
      this.locale =
        rawLang === 'en'
          ? 'en'
          : /^(zh-tw|zh_tw|tw|hk|zh-hk|zh_hk|zh-hant|zh_hant|hant)$/.test(rawLang)
            ? 'zh-tw'
            : 'zh';
      this.year = this.dynasties[0].focusYear;
      this.dynastyIdx = 0;
      this.activeSnapKey = null;
      this.activeSettlementMask = null;
      this.activeCorridorMask = null;
      this.lastRenderedSnap = null;
      this.playing = false;
      this.playSpeed = 1;
      this.playInterval = null;
      this.playProgress = 0;
      this.playHoldTicks = 0;
      this.playShownTicks = 0;
      this.musicPlaying = false;
      this.musicTrackIdx = 0;
      this.musicAudio = null;
      this.terrainMode = true;
      this.hydroData = window.HYDRO_DATA || { rivers: [], lakes: [] };
      this.activeTrace = null;
      this.activePerson = null;
      this.activePersonEventIdx = -1;
      this.activeReturnPerson = null;
      this.personTimer = null;
      this._lastPersonPinZoom = 0;
      this.activeMilestone = null;
      this.activeCustomRoute = null;
      this.customRouteStopIdx = -1;
      this.challenge = null;
      this.paneCollapsed = false;
      this._paneAutoCollapsed = false;
      this._gestureMoved = false;
      this._gestureClicked = false;
      this._gestureGuideTimer = null;
      this.hasDismissedGestureGuide = false;
      this.ghostTimer = null;
      this._typoDirty = true;
      this._lastTypographyWidth = undefined;
      this._camRaf = null;
      this.dismissedCalloutIds = new Set();
      try {
        this.hasSeenTraceHint = localStorage.getItem('jiangshan_seen_trace_hint') === '1';
      } catch (_) {
        this.hasSeenTraceHint = false;
      }

      this.camera = this._getDefaultCamera();
      this.flyRaf = null;
      this.dragState = null;
      this.didPan = false;
      this.snapshotCache = {};

      this._bindDom();
      this._applyCamera(true);
      this._buildTerrainRivers();
      this._buildModernProvinces();
      this._buildNeighborCountries();
      this._buildScrubberBands();
      this._attachListeners();
      this.applyLocale();

      this.jumpToYear(this.dynasties[0].focusYear);
      this._restoreFromQuery();
      this._bootDone = true;

      if (typeof window !== 'undefined' && !this._fullSnapshotsLoaded) {
        setTimeout(() => this._ensureFullSnapshots(), 50);
      }
    }

    _hydrateSnapshots() {
      if (!this.snapshots) return;
      for (const k of Object.keys(this.snapshots)) {
        const s = this.snapshots[k];
        if (s && s.prefRef && (!s.prefectures || !s.prefectures.length) && this.snapshots[s.prefRef]) {
          s.prefectures = this.snapshots[s.prefRef].prefectures || [];
        }
        if (s && s.regionRef && (!s.regions || !s.regions.length) && this.snapshots[s.regionRef]) {
          s.regions = this.snapshots[s.regionRef].regions || [];
        }
      }
      if (
        this.snapshots.s_prc &&
        (!this.snapshots.s_prc.regions || !this.snapshots.s_prc.regions.length) &&
        this.provinces.length
      ) {
        const cityProvSet = new Set([
          '北京市',
          '天津市',
          '上海市',
          '重庆市',
          '香港特别行政区',
          '澳门特别行政区',
        ]);
        const provAnchors = {
          河北省: [115.55, 38.65],
          山西省: [112.15, 36.65],
          内蒙古自治区: [114.08, 44.33],
          辽宁省: [122.45, 41.15],
          吉林省: [126.55, 43.45],
          黑龙江省: [128.1, 47.65],
          江苏省: [119.55, 33.15],
          浙江省: [120.05, 29.05],
          安徽省: [117.15, 32.95],
          福建省: [117.95, 26.05],
          江西省: [115.65, 27.35],
          山东省: [118.45, 36.25],
          河南省: [113.55, 33.65],
          湖北省: [112.15, 31.15],
          湖南省: [111.55, 27.45],
          广东省: [114.55, 23.95],
          广西壮族自治区: [108.85, 24.05],
          海南省: [109.7, 19.15],
          四川省: [102.35, 30.75],
          贵州省: [107.55, 27.25],
          云南省: [101.25, 24.75],
          西藏自治区: [88.39, 31.56],
          陕西省: [108.95, 35.65],
          甘肃省: [100.45, 38.95],
          青海省: [96.15, 35.55],
          宁夏回族自治区: [106.05, 37.25],
          新疆维吾尔自治区: [85.15, 41.35],
          台湾省: [120.95, 23.65],
        };
        this.snapshots.s_prc.regions = this.provinces
          .filter((prov) => !String(prov.code).includes('_JD'))
          .map((prov) => {
            const shortTitle = prov.title.replace(
              /(省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区)$/,
              ''
            );
            return {
              title: shortTitle,
              fullTitle: prov.title,
              category: '',
              anchor: cityProvSet.has(prov.title) ? null : provAnchors[prov.title] || prov.hub,
              shape: { type: 'MultiPolygon', coordinates: prov.rings },
            };
          });
        Object.defineProperty(this.snapshots.s_prc, '_skipRegionBoundaryStroke', {
          value: true,
          writable: true,
          enumerable: false,
          configurable: true,
        });
      }
    }

    _loadScriptOnce(src) {
      if (typeof document === 'undefined' || !document.head) return Promise.resolve();
      return new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => resolve();
        document.head.appendChild(s);
      });
    }

    _ensureFullSnapshots() {
      if (this._fullSnapshotsLoaded) return Promise.resolve(this.snapshots);
      if (
        window.ATLAS_FULL_SNAPSHOTS_LOADED ||
        (window.ATLAS_SNAPSHOTS && window.ATLAS_SNAPSHOTS.s_prc)
      ) {
        this.snapshots = window.ATLAS_SNAPSHOTS;
        this._hydrateSnapshots();
        this._fullSnapshotsLoaded = true;
        return Promise.resolve(this.snapshots);
      }
      if (!this._fullSnapshotsPromise) {
        this._fullSnapshotsPromise = this._loadScriptOnce('js/atlas_snapshots.js?v=20261024a').then(
          () => {
            this.snapshots = window.ATLAS_SNAPSHOTS || this.snapshots;
            this._hydrateSnapshots();
            this._fullSnapshotsLoaded = true;
            this.snapshotCache = {};
            this.searchIndex = null;
            return this.snapshots;
          }
        );
      }
      return this._fullSnapshotsPromise;
    }

    _ensureEnglishLocale() {
      if (
        window.EN_LOCALE &&
        window.EN_LOCALE.dict &&
        Object.keys(window.EN_LOCALE.dict).length > 0
      ) {
        this.enLocale = window.EN_LOCALE;
        return Promise.resolve(this.enLocale);
      }
      if (!this._enLocalePromise) {
        this._enLocalePromise = this._loadScriptOnce('js/i18n_dict.js?v=20261024a').then(() => {
          if (window.EN_LOCALE) {
            this.enLocale = window.EN_LOCALE;
            this.searchIndex = null;
          }
          return this.enLocale;
        });
      }
      return this._enLocalePromise;
    }

    _syncMobileOverlayState() {
      const wb = this._id('workspace-body');
      if (wb && wb.classList) {
        wb.classList.toggle(
          'has-mobile-overlay',
          Boolean(
            this.activeCustomRoute || this.activeTrace || this.activePerson || this.challenge
          )
        );
      }
    }

    _syncImmersivePaneState() {
      const immersiveActive = Boolean(this.activePerson || this.challenge);
      if (immersiveActive) {
        if (!this.paneCollapsed) {
          this._paneAutoCollapsed = true;
          this.toggleChroniclePane(true);
        }
        if (this.mobileChronicleOpen) {
          this.toggleMobileChronicle(false);
        }
      } else if (this._paneAutoCollapsed) {
        this._paneAutoCollapsed = false;
        this.toggleChroniclePane(false);
      }
      this._syncMobileOverlayState();
    }

    _recordGestureMove() {
      if (!this._bootDone || this.hasDismissedGestureGuide) return;
      this._gestureMoved = true;
      this._checkDismissGestureGuide();
    }

    _recordGestureClick() {
      if (!this._bootDone || this.hasDismissedGestureGuide) return;
      this._gestureClicked = true;
      this._checkDismissGestureGuide();
    }

    _checkDismissGestureGuide() {
      if (this.hasDismissedGestureGuide || this._gestureGuideTimer) return;
      if (this._gestureMoved && this._gestureClicked) {
        this._gestureGuideTimer = setTimeout(() => {
          this.hasDismissedGestureGuide = true;
          const gg = this._id('gesture-guide');
          if (gg) gg.classList.add('is-dismissed');
        }, 2000);
      }
    }

    _dismissTraceOnboarding() {
      if (this.hasSeenTraceHint) return;
      this.hasSeenTraceHint = true;
      try {
        localStorage.setItem('jiangshan_seen_trace_hint', '1');
      } catch (_) {}
      if (this.svg) {
        this.svg.querySelectorAll('.cap-breath-ring, .cap-hint-tag').forEach((el) => el.remove());
        this.svg
          .querySelectorAll('.has-trace-hint')
          .forEach((el) => el.classList.remove('has-trace-hint'));
      }
    }

    _getViewportAspect() {
      if (this.svg) {
        const r = this.svg.getBoundingClientRect();
        if (r.width > 40 && r.height > 40) {
          return Math.max(0.65, Math.min(1.45, r.height / r.width));
        }
      }
      if (typeof window !== 'undefined' && window.innerWidth < window.innerHeight) {
        return 1.24;
      }
      return 0.7;
    }

    _getDefaultCamera() {
      if (typeof window !== 'undefined') {
        if (window.innerWidth <= 900 && window.innerWidth < window.innerHeight) {
          const w = 340;
          const h = Math.round(w * this._getViewportAspect());
          return { x: 430, y: 225, w, h, zoom: 1000 / w };
        }
        if (window.innerWidth <= 900) {
          return { x: 410, y: 220, w: 380, h: 420, zoom: 1000 / 380 };
        }
      }
      return { x: 350, y: 215, w: 500, h: 420, zoom: 2 };
    }

    _id(id) {
      return document.getElementById(id);
    }

    _svgNode(tag, attrs = {}, parent = null) {
      const node = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) {
        node.setAttribute(k, v);
      }
      if (parent) parent.appendChild(node);
      return node;
    }

    _bindDom() {
      this.svg = this._id('atlas-svg');
      this.grpTerrain = this._id('grp-terrain');
      this.grpRivers = this._id('grp-rivers');
      this.grpNeighbors = this._id('grp-neighbors');
      this.grpProvinces = this._id('grp-provinces');
      this.grpProvNames = this._id('grp-prov-names');
      this.grpPolities = this._id('grp-polities');
      this.grpPrefectures = this._id('grp-prefectures');
      this.grpGhostDiff = this._id('grp-ghost-diff');
      this.grpCorridors = this._id('grp-corridors');
      this.grpJourney = this._id('grp-journey');
      this.grpSettlements = this._id('grp-settlements');
      this.grpMilestones = this._id('grp-milestones');
      this.grpChallenge = this._id('grp-challenge');
      this.grpGenealogy = this._id('grp-genealogy');
      this.hoverTip = this._id('hover-tip');
      this.mapKey = this._id('map-key');
      this.milestoneBalloon = this._id('milestone-balloon');
      this.journeyCard = this._id('journey-card');
    }

    // ---------------- Localization helpers ----------------
    _zh(text) {
      if (!text || typeof text !== 'string') return text;
      if (this.locale === 'zh-tw' && typeof window !== 'undefined' && window.ZH_HANT_CONV) {
        return window.ZH_HANT_CONV.toHant(text);
      }
      return text;
    }

    _toHans(text) {
      if (!text || typeof text !== 'string') return text;
      if (typeof window !== 'undefined' && window.ZH_HANT_CONV) {
        return window.ZH_HANT_CONV.toHans(text);
      }
      return text;
    }

    _applyZhHantDom(root) {
      if (typeof document === 'undefined') return;
      const targetRoot = root || this._id('app-shell') || document.body;
      if (!targetRoot) return;
      const isHant = this.locale === 'zh-tw';
      const isHans = this.locale === 'zh';
      if (!isHant && !isHans) return;
      const conv = typeof window !== 'undefined' && window.ZH_HANT_CONV;
      if (!conv) return;

      const walk = (node) => {
        if (!node) return;
        if (node.nodeType === 1) {
          const tag = node.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE') return;
          if (node.classList && node.classList.contains('locale-pill-group')) return;
          for (const attr of ['title', 'placeholder', 'aria-label']) {
            if (node.hasAttribute && node.hasAttribute(attr)) {
              const curVal = node.getAttribute(attr);
              const backupKey = `_hansAttr_${attr}`;
              if (isHant && curVal && /[\u4e00-\u9fff]/.test(curVal)) {
                if (node[backupKey] === undefined) node[backupKey] = curVal;
                const nextVal = conv.toHant(node[backupKey]);
                if (nextVal !== curVal) node.setAttribute(attr, nextVal);
              } else if (isHans && node[backupKey] !== undefined) {
                node.setAttribute(attr, node[backupKey]);
              }
            }
          }
          const children = node.childNodes;
          if (children && children.length) {
            for (let i = 0; i < children.length; i++) {
              walk(children[i]);
            }
          }
        } else if (node.nodeType === 3) {
          const val = node.nodeValue;
          if (isHant && val && /[\u4e00-\u9fff]/.test(val)) {
            if (node._hansText === undefined) node._hansText = val;
            const nextVal = conv.toHant(node._hansText);
            if (nextVal !== val) node.nodeValue = nextVal;
          } else if (isHans && node._hansText !== undefined) {
            node.nodeValue = node._hansText;
          }
        }
      };
      walk(targetRoot);
    }

    uiStr(key, fallback) {
      if (this.locale === 'en' && this.enLocale.strings && this.enLocale.strings[key] !== undefined) {
        return this.enLocale.strings[key];
      }
      return this._zh(fallback);
    }

    trTerm(text) {
      if (!text) return text;
      if (this.locale !== 'en') return this._zh(text);
      return this._enDict(text);
    }

    trModernCity(text) {
      const res = this.trTerm(text);
      return typeof res === 'string' ? res.replace(/\b([A-Z][a-z]+)\s+Zhou\b/g, '$1zhou') : res;
    }

    _enDict(text) {
      if (!text) return '';
      if (text === '中华人民共和国') return "People's Republic of China";
      const dict = this.enLocale && this.enLocale.dict;
      if (!dict) return text;
      if (dict[text]) return dict[text];
      const provMatch = String(text).match(
        /^(黑龙江|内蒙古|新疆|广西|宁夏|西藏|北京|天津|上海|重庆|河北|山西|辽宁|吉林|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾)(.+)$/
      );
      if (provMatch && dict[provMatch[1]] && dict[provMatch[2]]) {
        return `${dict[provMatch[2]]}, ${dict[provMatch[1]]}`;
      }
      return text;
    }

    _enModernCity(text) {
      const res = this._enDict(text);
      return typeof res === 'string' ? res.replace(/\b([A-Z][a-z]+)\s+Zhou\b/g, '$1zhou') : res;
    }

    _enMilestoneHeadline(d, m) {
      if (m.headlineEn) return m.headlineEn;
      const key = `${d.key}:${m.year}`;
      const hit = this.enLocale.milestones && this.enLocale.milestones[key];
      if (hit) return Array.isArray(hit) ? hit[0] : hit;
      return m.headline;
    }

    _clampYearToDynasty(dynasty, y) {
      if (!dynasty) return y;
      const idx = this.dynasties.indexOf(dynasty);
      const nextFrom =
        idx >= 0 && idx + 1 < this.dynasties.length
          ? this.dynasties[idx + 1].fromYear
          : dynasty.toYear + 1;
      const maxY = Math.min(dynasty.toYear, nextFrom - 1);
      return Math.max(dynasty.fromYear, Math.min(maxY, y));
    }

    dynastyName(d) {
      return this.locale === 'en' && this.enLocale.dynasties[d.key]
        ? this.enLocale.dynasties[d.key].name
        : this._zh(d.title);
    }

    dynastyBadge(d) {
      if (!d) return this.locale === 'en' ? 'All Eras' : this._zh('历代');
      return this.locale === 'en' && this.enLocale.dynasties[d.key]
        ? this.enLocale.dynasties[d.key].short
        : this._zh(d.badge || d.title);
    }

    dynastySeat(d) {
      return this.locale === 'en' && this.enLocale.dynasties[d.key]
        ? this.enLocale.dynasties[d.key].capital
        : this._zh(d.seat);
    }

    dynastySummary(d) {
      return this.locale === 'en' && this.enLocale.dynasties[d.key]
        ? this.enLocale.dynasties[d.key].desc
        : this._zh(d.summary);
    }

    milestoneHeadline(d, m) {
      if (this.locale === 'en') {
        return this._enMilestoneHeadline(d, m);
      }
      return this._zh(m.headline);
    }

    milestoneSite(d, m) {
      if (!m.site) return '';
      if (this.locale === 'en') {
        if (m.siteEn) return m.siteEn;
        const key = `${d.key}:${m.year}`;
        const hit = this.enLocale.milestones && this.enLocale.milestones[key];
        if (Array.isArray(hit) && hit[1]) return hit[1];
      }
      return d && (d.key === 'roc' || d.key === 'prc')
        ? this.trModernCity(m.site)
        : this.trTerm(m.site);
    }

    corridorTitle(c) {
      if (this.locale === 'en' && this.enLocale.corridors && this.enLocale.corridors[c.key]) {
        const hit = this.enLocale.corridors[c.key];
        return (Array.isArray(hit) ? hit[0] : hit.name) || c.title;
      }
      return this._zh(c.title);
    }

    corridorSummary(c) {
      if (this.locale === 'en' && this.enLocale.corridors && this.enLocale.corridors[c.key]) {
        const hit = this.enLocale.corridors[c.key];
        return (Array.isArray(hit) ? hit[1] : hit.note) || '';
      }
      return this._zh(c.summary);
    }

    formatYear(y, compact = false) {
      const n = Math.round(y);
      if (this.locale === 'en') {
        if (n <= 0) return `${-n || 1} BCE`;
        return compact ? `${n}` : `${n} CE`;
      }
      if (n <= 0) return `${compact ? '前' : '公元前'}${-n || 1}${compact ? '' : '年'}`;
      return compact ? `${n}` : `公元 ${n} 年`;
    }

    formatSpan(d) {
      if (d && d.key === 'prc') {
        return `${this.formatYear(d.fromYear, true)} —`;
      }
      return `${this.formatYear(d.fromYear, true)} — ${this.formatYear(d.toYear, true)}`;
    }

    static get CHINESE_ERA_SPANS() {
      return (window.ATLAS_LORE_DATA && window.ATLAS_LORE_DATA.CHINESE_ERA_SPANS) || [[-403, '周威烈王', 23]];
    }

    static get REGIONAL_ERA_TRACKS() {
      return (window.ATLAS_LORE_DATA && window.ATLAS_LORE_DATA.REGIONAL_ERA_TRACKS) || [];
    }

    _toChineseEraNum(n) {
      if (n <= 1) return '元';
      const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
      if (n <= 10) return digits[n];
      if (n < 20) return '十' + digits[n - 10];
      const tens = Math.floor(n / 10);
      const rem = n % 10;
      return digits[tens] + '十' + (rem ? digits[rem] : '');
    }

    _resolveEraSpan(y, dynasty) {
      const yr = Math.round(y);
      if (dynasty && dynasty.key === 'yuan' && yr >= 1264 && yr < 1279) {
        return [1264, '元至元', 1, '元世祖', 'Kublai Khan (Shizu)'];
      }
      const spans = HistoricalAtlasController.CHINESE_ERA_SPANS;
      let match = spans[0];
      for (let i = spans.length - 1; i >= 0; i--) {
        if (yr >= spans[i][0]) {
          if (
            dynasty &&
            yr === dynasty.toYear &&
            spans[i][0] === yr &&
            i > 0 &&
            dynasty.key !== 'sanguo' &&
            dynasty.key !== 'wudai'
          ) {
            match = spans[i - 1];
          } else {
            match = spans[i];
          }
          break;
        }
      }
      return match;
    }

    /**
     * Era span of the regime ruling `coord` in year `y` (or of the named `regime`) when
     * that regime kept its own chronology, e.g. Northern Wei while CHINESE_ERA_SPANS
     * follows the Southern Dynasties; null means the reference track applies.
     */
    _resolveRegionalEraSpan(y, dynasty, coord, regime = null) {
      const yr = Math.round(y);
      const tracks = HistoricalAtlasController.REGIONAL_ERA_TRACKS;
      let track = null;
      if (regime) {
        track = tracks.find((t) => t.regime === regime);
      } else {
        if (!dynasty || !Array.isArray(coord) || !this.snapshots) return null;
        const snap = this.snapshots[this._resolveSnapKey(dynasty, yr)];
        if (!snap) return null;
        let polity = this._polityAt(coord[0], coord[1], snap);
        if (!polity || polity.role === 'neighbor') {
          polity = this._nearestMainPolity(coord, snap) || polity;
        }
        track = polity && tracks.find((t) => t.polities.includes(polity.title) && yr >= t.spans[0][0] && yr <= t.until);
      }
      if (!track || yr < track.spans[0][0] || yr > track.until) return null;
      let match = null;
      for (const sp of track.spans) {
        if (sp[0] <= yr) match = sp;
      }
      return match;
    }

    /**
     * Schematic borders can leave frontier events (e.g. the Six Garrisons of 523) inside
     * a neighboring steppe polity; take the snapshot's main regime if it lies on the
     * nearest of four rings (25–100 km) around the point.
     */
    _nearestMainPolity([lng, lat], snap) {
      const kmPerDegLng = 111.32 * Math.cos(lat * DEG_TO_RAD);
      for (const km of [25, 50, 75, 100]) {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * 2 * Math.PI;
          const p = this._polityAt(lng + (km * Math.cos(a)) / kmPerDegLng, lat + (km * Math.sin(a)) / 110.57, snap);
          if (p && p.role === 'main') return p;
        }
      }
      return null;
    }

    /**
     * Era label for a dated event (milestone): an explicit `eraRegime` ("reference" or a
     * REGIONAL_ERA_TRACKS regime) wins over the regime ruling the event's location. The
     * override covers events whose subject is not the regime holding that spot, e.g. a
     * Song–Jin treaty pinned on the Jin side of the border.
     */
    _eventEraLabel(dynasty, ev) {
      if (ev.eraRegime === 'reference') return this.formatEraLabel(ev.year, dynasty);
      if (ev.eraRegime) return this.formatEraLabel(ev.year, dynasty, null, ev.eraRegime);
      return this.formatEraLabel(ev.year, dynasty, ev.coord);
    }

    _formatSpanEraZh(sp, targetNum) {
      const [startY, prefix, , monarchZh = ''] = sp;
      const numStr = this._toChineseEraNum(targetNum);
      if (startY >= -140 && startY < 1368 && monarchZh) {
        const dynPfx = ERA_DYNASTY_PREFIXES.find((dp) => prefix.startsWith(dp)) || '';
        const eraName = dynPfx ? prefix.slice(dynPfx.length) : prefix;
        return `${monarchZh}·${eraName}${numStr}年`;
      }
      return `${prefix}${numStr}年`;
    }

    /**
     * Era label for year `y`. Without `coord` it follows the reference chronology
     * (Zizhi Tongjian convention); with `coord` (or an explicit `regime`) it uses the
     * era of the regime that ruled that place, when it has a REGIONAL_ERA_TRACKS entry.
     */
    formatEraLabel(y, dynasty, coord = null, regime = null) {
      const yr = Math.round(y);
      const regional = coord || regime ? this._resolveRegionalEraSpan(yr, dynasty, coord, regime) : null;
      if (this.locale === 'en') {
        const dynName = dynasty ? this.dynastyName(dynasty) : '';
        if (yr >= 1912) return dynName;
        const match = regional || this._resolveEraSpan(yr, dynasty);
        const monarchEn = match && match[4];
        return monarchEn ? `${dynName} · ${monarchEn}` : dynName;
      }
      if (yr >= 1949) {
        if (dynasty && dynasty.key === 'roc' && yr === 1949) {
          return this._zh('民国三十八年');
        }
        return dynasty ? this.dynastyName(dynasty) : this._zh('现代');
      }
      const match = regional || this._resolveEraSpan(yr, dynasty);
      const [startY, , baseNum = 1] = match;
      const num = yr - startY + baseNum;
      return this._zh(this._formatSpanEraZh(match, num));
    }

    applyLocale() {
      if (
        this.locale === 'en' &&
        (!this.enLocale || !this.enLocale.dict || !Object.keys(this.enLocale.dict).length)
      ) {
        this._ensureEnglishLocale().then(() => this.applyLocale());
        return;
      }
      document.documentElement.lang =
        this.locale === 'en' ? 'en' : this.locale === 'zh-tw' ? 'zh-Hant' : 'zh-CN';
      this._syncDocumentSeoMeta();
      this._syncSeoDirectoryLocale();

      this._id('txt-seal').textContent = this.uiStr('brand_seal', '江山时序');
      this._id('txt-subtitle').textContent = this.uiStr('brand_sub', '中国历史地图 · 战国 → 今');
      const lblLayersBtn = this._id('lbl-layers-btn');
      if (lblLayersBtn) {
        lblLayersBtn.textContent = this.uiStr('btn_layers', '图层');
      }
      const actLayersBtn = this._id('act-layers-menu');
      if (actLayersBtn) {
        actLayersBtn.title =
          this.locale === 'en' ? 'Toggle map layers' : '展开或收起地图图层开关';
      }
      const lblTerrainChk = this._id('lbl-terrain-chk');
      if (lblTerrainChk) {
        lblTerrainChk.textContent = this.uiStr('toggle_terrain', '山川水系');
      }
      const grpHist = this._id('txt-layer-grp-hist');
      if (grpHist) {
        grpHist.textContent = this.uiStr('layer_grp_hist', '历史舆图要素');
      }
      const grpMod = this._id('txt-layer-grp-mod');
      if (grpMod) {
        grpMod.textContent = this.uiStr('layer_grp_mod', '山川与现代参照');
      }
      this._id('lbl-provinces').textContent = this.uiStr('toggle_modern', '现代省界');
      this._id('lbl-prov-names').textContent = this.uiStr('toggle_modern_labels', '现代省名');
      this._id('lbl-polities').textContent = this.uiStr('toggle_realms', '历史疆域');
      this._id('lbl-prefectures').textContent =
        this.locale === 'en' ? 'Admin Divisions' : '州道政区';
      this._id('lbl-settlements').textContent = this.uiStr('toggle_cities', '古地名');
      const lblCorridors = this._id('lbl-corridors');
      lblCorridors.textContent = this.uiStr('toggle_routes', '关河丝路');
      if (lblCorridors.parentElement) {
        lblCorridors.parentElement.title =
          this.locale === 'en'
            ? 'Great Wall · Grand Canal · Silk Road'
            : '长城 · 大运河 · 丝绸之路';
      }
      this._id('lbl-milestones').textContent = this.uiStr('toggle_events', '重大事件');
      const lblReset = this._id('lbl-reset-camera') || this._id('act-reset-camera');
      lblReset.textContent = this.uiStr('btn_reset', '复位视图');
      const actReset = this._id('act-reset-camera');
      if (actReset) {
        actReset.title = this.locale === 'en' ? 'Reset camera view' : '复位视图';
      }
      const lblChal = this._id('lbl-challenge') || this._id('act-challenge');
      if (lblChal) {
        lblChal.textContent = this.challenge
          ? this.locale === 'en'
            ? 'Quiz Active · Click to Exit'
            : '挑战进行中 · 点击退出'
          : this.locale === 'en'
            ? 'Map Pinpoint · Ancient Place Quiz'
            : '舆图寻址 · 古地名小试';
      }
      const actLocHant = this._id('act-locale-hant');
      const lblLocHant = this._id('lbl-locale-hant') || actLocHant;
      const actLoc = this._id('act-locale');
      const lblLoc = this._id('lbl-locale') || actLoc;
      if (this.locale === 'zh') {
        if (lblLocHant) lblLocHant.textContent = '繁';
        if (actLocHant) {
          actLocHant.dataset.targetLocale = 'zh-tw';
          actLocHant.title = '切換至繁體中文';
        }
        if (lblLoc) lblLoc.textContent = 'EN';
        if (actLoc) {
          actLoc.dataset.targetLocale = 'en';
          actLoc.title = 'Switch to English';
        }
      } else if (this.locale === 'zh-tw') {
        if (lblLocHant) lblLocHant.textContent = '简';
        if (actLocHant) {
          actLocHant.dataset.targetLocale = 'zh';
          actLocHant.title = '切换至简体中文';
        }
        if (lblLoc) lblLoc.textContent = 'EN';
        if (actLoc) {
          actLoc.dataset.targetLocale = 'en';
          actLoc.title = 'Switch to English';
        }
      } else {
        if (lblLocHant) lblLocHant.textContent = '简';
        if (actLocHant) {
          actLocHant.dataset.targetLocale = 'zh';
          actLocHant.title = '切换至简体中文 / Switch to Simplified Chinese';
        }
        if (lblLoc) lblLoc.textContent = '繁';
        if (actLoc) {
          actLoc.dataset.targetLocale = 'zh-tw';
          actLoc.title = '切換至繁體中文 / Switch to Traditional Chinese';
        }
      }
      const ghBtn = this._id('act-github-star');
      if (ghBtn) {
        ghBtn.title =
          this.locale === 'en'
            ? 'Star DeanChensj/jiangshan-map on GitHub'
            : '在 GitHub 上为「江山时序」点亮 Star';
      }
      this._updateMusicUi();
      this._updateAutoplayUi();
      this._updatePlaySpeedUi();
      this._id('gesture-guide').textContent = this.uiStr(
        'hint',
        '滚轮缩放 · 拖拽平移 · 点击城名或双击任意处查沿革 · ← → 逐事件跳转（Shift+← → ±10年） · 空格播放'
      );
      this._id('txt-seat-label').textContent = this.uiStr('capital_k', '都城');
      this._id('txt-milestones-heading').textContent = this.uiStr('events_h', '重大事件');
      this._id('txt-disclaimer').textContent = this.uiStr(
        'caveat',
        '历史疆域与政区为示意性近似，非精确测绘边界。'
      );
      this._id('txt-year-suffix').textContent = this.uiStr('year_unit', '年');
      const stepPrevBtn = this._id('act-step-prev');
      if (stepPrevBtn) {
        stepPrevBtn.title =
          this.locale === 'en'
            ? 'Previous historical stage / event node (←) · Shift+← -10 yrs'
            : '上一历史阶段 / 事件节点（←）· Shift+← 退十年';
        stepPrevBtn.setAttribute(
          'aria-label',
          this.locale === 'en' ? 'Previous historical node' : '上一历史节点'
        );
      }
      const stepNextBtn = this._id('act-step-next');
      if (stepNextBtn) {
        stepNextBtn.title =
          this.locale === 'en'
            ? 'Next historical stage / event node (→) · Shift+→ +10 yrs'
            : '下一历史阶段 / 事件节点（→）· Shift+→ 进十年';
        stepNextBtn.setAttribute(
          'aria-label',
          this.locale === 'en' ? 'Next historical node' : '下一历史节点'
        );
      }
      const inpYear = this._id('inp-year');
      if (inpYear) {
        inpYear.setAttribute(
          'aria-label',
          this.locale === 'en' ? 'Enter year (negative for BCE)' : '输入年份（负数为公元前）'
        );
      }
      const scrubberDock = this._id('scrubber-dock');
      if (scrubberDock) {
        scrubberDock.setAttribute(
          'aria-label',
          this.locale === 'en' ? 'Historical timeline' : '历史年份时间轴'
        );
      }
      const scrubberTrack = this._id('scrubber-track');
      if (scrubberTrack) {
        scrubberTrack.setAttribute(
          'aria-label',
          this.locale === 'en' ? 'Year slider' : '年份滑块'
        );
      }
      const chroniclePane = this._id('chronicle-pane');
      if (chroniclePane) {
        chroniclePane.setAttribute(
          'aria-label',
          this.locale === 'en' ? 'Historical era details' : '历史时期详情'
        );
      }
      const atlasSvg = this._id('atlas-svg');
      if (atlasSvg) {
        atlasSvg.setAttribute(
          'aria-label',
          this.locale === 'en' ? 'Historical Atlas of China' : '中国历史地图'
        );
      }
      this._id('txt-genealogy-kicker').textContent = this.activePerson
        ? this.locale === 'en'
          ? 'Person Chronicle · Life Across Time & Space'
          : '点人溯事 · 人物生平纪事'
        : this.uiStr('trace_kicker', '点地溯源 · 古今政区沿革');
      const chalKicker = this._id('txt-challenge-kicker');
      if (chalKicker) {
        chalKicker.textContent = this.locale === 'en' ? 'Map Pinpoint' : '舆图寻址';
      }
      const searchInp = this._id('inp-map-search');
      if (searchInp) {
        const searchPh =
          this.locale === 'en'
            ? 'Search figure / city / prefecture / era'
            : '搜人物 / 古今地名 / 州府 / 年号';
        searchInp.placeholder = searchPh;
        searchInp.setAttribute('aria-label', searchPh);
      }
      const searchBox = this._id('map-search-box');
      if (searchBox) {
        searchBox.setAttribute(
          'aria-label',
          this.locale === 'en'
            ? 'Quick search for historical figures, places, prefectures, eras, and place quiz'
            : '快速检索历史人物、古今地名、州府、帝王年号与古地名寻址'
        );
      }
      this._syncTogglePaneButton();

      this.grpProvNames.querySelectorAll('.province-caption').forEach((node) => {
        if (node.dataset.rawName) node.textContent = this.trTerm(node.dataset.rawName);
      });
      this.grpNeighbors.querySelectorAll('.neighbor-caption').forEach((node) => {
        if (node.dataset.rawName) node.textContent = this.trTerm(node.dataset.rawName);
      });
      if (this.grpRivers) {
        this.grpRivers.querySelectorAll('.hydro-label').forEach((node) => {
          node.textContent =
            this.locale === 'en' ? node.dataset.en || '' : this._zh(node.dataset.zh || '');
        });
      }

      this._refreshBandLabels();
      this._updateScaleBar();
      this.activeSettlementMask = null;
      this.activeCorridorMask = null;
      this._invalidateTypographyLayout();

      const cur = this.dynasties[this.dynastyIdx];
      if (cur) {
        this._renderChroniclePane(cur);
        this._renderSettlements(cur);
        this._renderCorridors();
        this._renderMilestones(cur);
        this._fetchSnapshot(this.activeSnapKey || this._resolveSnapKey(cur, this.year)).then(
          (snap) => this._renderPolitiesAndPrefectures(cur, snap)
        );
        this._syncScrubberUi();
      }
      if (this.activeTrace) {
        this.openGenealogyAt(this.activeTrace[0], this.activeTrace[1], null, {
          fromYearSync: true,
          preserveScroll: true,
        });
      } else if (this.activePerson) {
        this.activePerson.events = this._collectPersonEvents(this.activePerson.profile);
        this._renderPersonPinsOverlay();
        this._renderPersonChronicleCard(true);
      }
      if (this.activeCustomRoute) {
        this._renderCustomRoute(this.activeCustomRoute, this.camera.zoom);
      }
      if (this.challenge) {
        this.grpSettlements.classList.add('is-hidden');
        const chkM = this._id('chk-milestones');
        this.grpMilestones.classList.toggle(
          'is-hidden',
          !this.challenge.answered || Boolean(chkM && !chkM.checked)
        );
        if (this.challenge.finished || this.challenge.index >= this.challenge.deck.length) {
          this._finishChallenge();
        } else if (this.challenge.answered) {
          this._renderChallengeQuestionText();
          this._renderChallengeAnsweredVerdict();
        } else if (this.challenge.pendingGuess) {
          const savedPin = this.challenge.pendingGuess;
          this._renderChallengeQuestionText();
          this._previewLocatePin(savedPin[0], savedPin[1]);
        } else {
          this.presentChallengeRound();
        }
      }
      this._applyZhHantDom();
    }

    // ---------------- Base Layers ----------------
    _isHydroVisible(item, year) {
      if (!item) return false;
      const y = year !== undefined ? year : this.year;
      if (item.appear !== undefined && y < item.appear) return false;
      if (item.vanish !== undefined && y >= item.vanish) return false;
      return true;
    }

    _hydroMask(year) {
      if (!this.hydroData) return '';
      const y = year !== undefined ? year : this.year;
      const rMask = (this.hydroData.rivers || [])
        .filter((r) => r.appear !== undefined || r.vanish !== undefined)
        .map((r) => (this._isHydroVisible(r, y) ? '1' : '0'))
        .join('');
      const lMask = (this.hydroData.lakes || [])
        .filter((l) => l.appear !== undefined || l.vanish !== undefined)
        .map((l) => (this._isHydroVisible(l, y) ? '1' : '0'))
        .join('');
      const tMask = (this.hydroData.labels || [])
        .filter((t) => t.appear !== undefined || t.vanish !== undefined)
        .map((t) => (this._isHydroVisible(t, y) ? '1' : '0'))
        .join('');
      return `${rMask}:${lMask}:${tMask}`;
    }

    _buildTerrainRivers() {
      if (!this.grpRivers || !this.hydroData) return;
      this.activeHydroMask = this._hydroMask(this.year);
      this.grpRivers.innerHTML = '';

      // 1. Render lakes first (underneath river inflows/outflows)
      for (const lk of this.hydroData.lakes || []) {
        if (!this._isHydroVisible(lk, this.year)) continue;
        const d = (lk.rings || []).map((r) => this.projector.ringToSvgPath(r)).join('');
        if (!d) continue;
        const lkCls = lk.rank <= 2 ? 'hydro-lake rank-major' : 'hydro-lake';
        this._svgNode('path', { d, class: lkCls }, this.grpRivers);
      }

      // 2. Render subtle parchment casing under trunk rivers (Yangtze, Yellow, Huai)
      for (const riv of this.hydroData.rivers || []) {
        if (riv.rank !== 1 || !this._isHydroVisible(riv, this.year)) continue;
        let d = '';
        for (const line of riv.lines || []) {
          for (let i = 0; i < line.length; i++) {
            const [px, py] = this.projector.toScreen(line[i][0], line[i][1]);
            d += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1);
          }
        }
        if (!d) continue;
        this._svgNode('path', { d, class: 'hydro-river-casing' }, this.grpRivers);
      }

      // 3. Render river strokes by rank hierarchy
      for (const riv of this.hydroData.rivers || []) {
        if (!this._isHydroVisible(riv, this.year)) continue;
        let d = '';
        for (const line of riv.lines || []) {
          for (let i = 0; i < line.length; i++) {
            const [px, py] = this.projector.toScreen(line[i][0], line[i][1]);
            d += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1);
          }
        }
        if (!d) continue;
        const rankCls =
          riv.rank === 1
            ? 'rank-trunk'
            : riv.rank === 2
              ? 'rank-major'
              : riv.rank <= 4
                ? 'rank-med'
                : 'rank-minor';
        this._svgNode(
          'path',
          { d, class: `hydro-river ${rankCls}` },
          this.grpRivers
        );
      }

      // 4. Render classical & bilingual water captions
      for (const lb of this.hydroData.labels || []) {
        if (!lb.coord || !this._isHydroVisible(lb, this.year)) continue;
        const [lx, ly] = this.projector.toScreen(lb.coord[0], lb.coord[1]);
        const kindCls =
          lb.kind === 'trunk'
            ? 'is-trunk'
            : lb.kind === 'lake'
              ? 'is-lake'
              : lb.kind === 'range'
                ? 'is-range is-crowded-hidden'
                : 'is-river';
        const rot = lb.rot || 0;
        const tNode = this._svgNode(
          'text',
          {
            class: `hydro-label ${kindCls}`,
            'data-x': lx.toFixed(1),
            'data-y': ly.toFixed(1),
            'data-rot': String(rot),
            'data-zh': lb.zh || '',
            'data-en': lb.en || '',
            transform: `translate(${lx.toFixed(1)},${ly.toFixed(1)}) rotate(${rot})`,
          },
          this.grpRivers
        );
        tNode.textContent = this.locale === 'en' ? lb.en || '' : this._zh(lb.zh || '');
      }
    }

    toggleTerrainMode(forceState) {
      this.terrainMode =
        forceState !== undefined ? Boolean(forceState) : !this.terrainMode;
      if (this.svg) {
        this.svg.classList.toggle('terrain-active', this.terrainMode);
      }
      if (this.grpTerrain) {
        this.grpTerrain.classList.toggle('is-hidden', !this.terrainMode);
      }
      const chk = this._id('chk-terrain');
      if (chk) {
        chk.checked = this.terrainMode;
      }
    }

    _buildProvinceBoundaryPaths() {
      if (this._cachedProvinceBoundaryPaths) {
        return this._cachedProvinceBoundaryPaths;
      }
      const ptKey = (pt) => Math.round(pt[0] * 100) * 10000 + Math.round(pt[1] * 100);
      const edgeKey = (p1, p2) => {
        const k1 = ptKey(p1);
        const k2 = ptKey(p2);
        return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      };
      const allRings = [];
      const edgeCounts = new Map();
      for (const prov of this.provinces || []) {
        if (!prov || String(prov.code).includes('_JD') || !Array.isArray(prov.rings)) continue;
        for (const poly of prov.rings) {
          for (const ring of poly || []) {
            if (!ring || ring.length < 2) continue;
            allRings.push(ring);
            for (let i = 0; i < ring.length - 1; i++) {
              const ek = edgeKey(ring[i], ring[i + 1]);
              edgeCounts.set(ek, (edgeCounts.get(ek) || 0) + 1);
            }
          }
        }
      }

      const seenInterior = new Set();
      const seenOuter = new Set();
      let interior = '';
      let outer = '';

      for (const ring of allRings) {
        let intPenX = NaN;
        let intPenY = NaN;
        let outPenX = NaN;
        let outPenY = NaN;
        for (let i = 0; i < ring.length - 1; i++) {
          const p1 = ring[i];
          const p2 = ring[i + 1];
          const ek = edgeKey(p1, p2);
          const count = edgeCounts.get(ek) || 0;
          if (count >= 2) {
            outPenX = NaN;
            outPenY = NaN;
            if (seenInterior.has(ek)) {
              intPenX = NaN;
              intPenY = NaN;
              continue;
            }
            seenInterior.add(ek);
            const [x1, y1] = this.projector.toScreen(p1[0], p1[1]);
            const [x2, y2] = this.projector.toScreen(p2[0], p2[1]);
            if (Math.hypot(x2 - x1, y2 - y1) < 0.05) continue;
            if (x1 !== intPenX || y1 !== intPenY) {
              interior += `M${x1.toFixed(1)} ${y1.toFixed(1)}`;
            }
            interior += `L${x2.toFixed(1)} ${y2.toFixed(1)}`;
            intPenX = x2;
            intPenY = y2;
          } else {
            intPenX = NaN;
            intPenY = NaN;
            if (seenOuter.has(ek)) {
              outPenX = NaN;
              outPenY = NaN;
              continue;
            }
            seenOuter.add(ek);
            const [x1, y1] = this.projector.toScreen(p1[0], p1[1]);
            const [x2, y2] = this.projector.toScreen(p2[0], p2[1]);
            if (Math.hypot(x2 - x1, y2 - y1) < 0.05) continue;
            if (x1 !== outPenX || y1 !== outPenY) {
              outer += `M${x1.toFixed(1)} ${y1.toFixed(1)}`;
            }
            outer += `L${x2.toFixed(1)} ${y2.toFixed(1)}`;
            outPenX = x2;
            outPenY = y2;
          }
        }
      }

      this._cachedProvinceBoundaryPaths = {
        interior,
        outer,
        combined: `${interior}${outer}`,
      };
      return this._cachedProvinceBoundaryPaths;
    }

    _buildModernProvinces() {
      const dashPaths = [];
      for (const prov of this.provinces) {
        const isDash = String(prov.code).includes('_JD');
        const path = this._svgNode(
          'path',
          {
            d: this.projector.multiRingsToSvgPath(prov.rings),
            class: isDash ? 'province-shape maritime-dash' : 'province-shape',
          },
          this.grpProvinces
        );
        if (isDash) {
          dashPaths.push(path);
        } else {
          path.dataset.provTitle = prov.title;
          const [cx, cy] = this.projector.toScreen(prov.hub[0], prov.hub[1]);
          const lbl = this._svgNode(
            'text',
            { x: cx.toFixed(1), y: cy.toFixed(1), class: 'province-caption' },
            this.grpProvNames
          );
          const rawShort = prov.title.replace(/(省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区)$/, '');
          lbl.dataset.rawName = rawShort;
          lbl.textContent = this.trTerm(rawShort);
        }
      }
      const bounds = this._buildProvinceBoundaryPaths();
      if (bounds.combined) {
        this._svgNode(
          'path',
          { d: bounds.combined, class: 'province-boundary-casing' },
          this.grpProvinces
        );
      }
      if (bounds.interior) {
        this._svgNode(
          'path',
          { d: bounds.interior, class: 'province-boundary-interior' },
          this.grpProvinces
        );
      }
      if (bounds.outer) {
        this._svgNode(
          'path',
          { d: bounds.outer, class: 'province-boundary-outer' },
          this.grpProvinces
        );
      }
      for (const dp of dashPaths) {
        if (this.grpProvinces && this.grpProvinces.appendChild) {
          this.grpProvinces.appendChild(dp);
        }
      }
    }

    _buildNeighborCountries() {
      const list = Array.isArray(this.snapshots.neighbors) ? this.snapshots.neighbors : [];
      for (const item of list) {
        const path = this._svgNode(
          'path',
          { d: this.projector.shapeToSvgPath(item.shape, false), class: 'neighbor-shape' },
          this.grpNeighbors
        );
        path.dataset.countryTitle = item.title;
        if (item.anchor) {
          const [cx, cy] = this.projector.toScreen(item.anchor[0], item.anchor[1]);
          const lbl = this._svgNode(
            'text',
            {
              'data-x': cx.toFixed(1),
              'data-y': cy.toFixed(1),
              'data-base-x': cx.toFixed(1),
              'data-base-y': cy.toFixed(1),
              class: 'neighbor-caption',
            },
            this.grpNeighbors
          );
          lbl.dataset.rawName = item.title;
          lbl.textContent = this.trTerm(item.title);
        }
      }
      this._invalidateTypographyLayout();
      this._rescaleSvgTypography();
    }

    // ---------------- Historical Layers ----------------
    _resolvePhase(dynasty, year) {
      if (!dynasty.phases) return null;
      return (
        dynasty.phases.find((ph) => year < ph.until) ||
        dynasty.phases[dynasty.phases.length - 1]
      );
    }

    _resolveSnapKey(dynasty, year) {
      const ph = this._resolvePhase(dynasty, year);
      return ph ? ph.snap : `s_${dynasty.key}`;
    }

    _fetchSnapshot(snapKey) {
      if (this.snapshotCache[snapKey]) return this.snapshotCache[snapKey];
      if (this.snapshots && this.snapshots[snapKey]) {
        this.snapshotCache[snapKey] = Promise.resolve(this.snapshots[snapKey]);
        return this.snapshotCache[snapKey];
      }
      return this._ensureFullSnapshots().then(() => {
        const embedded = this.snapshots && this.snapshots[snapKey];
        const res = embedded || { polities: [], prefectures: [], regions: [], note: '', caption: '' };
        this.snapshotCache[snapKey] = Promise.resolve(res);
        return res;
      });
    }

    _renderDynasty(dynasty, prevSnap = null) {
      document.documentElement.style.setProperty('--dynasty-accent', dynasty.tint);
      if (this.svg && dynasty && dynasty.key) {
        if (this.svg.dataset) {
          this.svg.dataset.dynasty = dynasty.key;
        }
        if (typeof this.svg.setAttribute === 'function') {
          this.svg.setAttribute('data-dynasty', dynasty.key);
        }
      }
      if (this.grpGhostDiff) this.grpGhostDiff.innerHTML = '';
      this._renderSettlements(dynasty);
      this._renderCorridors();
      this._renderMilestones(dynasty);
      const snapKey = this._resolveSnapKey(dynasty, this.year);
      this.activeSnapKey = snapKey;
      this._fetchSnapshot(snapKey).then((snap) => {
        if (this.dynasties[this.dynastyIdx] !== dynasty || this._resolveSnapKey(dynasty, this.year) !== snapKey) {
          return;
        }
        this._renderPolitiesAndPrefectures(dynasty, snap);
        if (!this.playing && prevSnap && prevSnap !== snap) {
          this._renderGhostDiff(prevSnap, 'fade');
        }
      });
    }

    _renderPolitiesAndPrefectures(dynasty, snap) {
      this._setPolityFocus(null);
      this.grpPolities.innerHTML = '';
      this.grpPrefectures.innerHTML = '';

      const polGroup = this._svgNode('g', { class: 'fade-enter' }, this.grpPolities);
      const zOrder = { neighbor: 0, main: 1, rival: 2, protectorate: 3 };
      const sorted = (snap.polities || [])
        .slice()
        .sort((a, b) => (zOrder[a.role] || 0) - (zOrder[b.role] || 0));

      for (const pol of sorted) {
        const isN = pol.role === 'neighbor';
        const attrs = {
          d: this.projector.shapeToSvgPath(pol.shape),
          class: `polity-shape ${pol.role}`,
        };
        if (!isN) {
          attrs.fill = pol.tint;
          attrs.stroke = pol.tint;
        }
        const path = this._svgNode('path', attrs, polGroup);
        path.dataset.polityTitle = pol.title;
        path.dataset.polityRole = pol.role;

        if (pol.anchor) {
          const [cx, cy] = this.projector.toScreen(pol.anchor[0], pol.anchor[1]);
          const lbl = this._svgNode(
            'text',
            {
              class: `polity-caption ${pol.role}`,
              'data-x': cx.toFixed(1),
              'data-y': cy.toFixed(1),
              'data-base-x': cx.toFixed(1),
              'data-base-y': cy.toFixed(1),
            },
            polGroup
          );
          lbl._polShape = pol.shape;
          lbl.dataset.polityTitle = pol.title;
          lbl.dataset.polityRole = pol.role;
          lbl.textContent = this.trTerm(pol.title);
        }
      }

      const prefGroup = this._svgNode('g', { class: 'fade-enter' }, this.grpPrefectures);
      for (const pref of snap.prefectures || []) {
        const path = this._svgNode(
          'path',
          { d: this.projector.shapeToSvgPath(pref.shape), class: 'prefecture-shape' },
          prefGroup
        );
        path.dataset.prefTitle = pref.title;
        path.dataset.prefCategory = pref.category;
      }

      const regBoundaryPath = this._buildRegionBoundaryPath(snap);
      if (regBoundaryPath) {
        this._svgNode(
          'path',
          { d: regBoundaryPath, class: 'region-shape-casing' },
          prefGroup
        );
        this._svgNode(
          'path',
          { d: regBoundaryPath, class: 'region-shape' },
          prefGroup
        );
      }

      for (const reg of snap.regions || []) {
        if (reg.anchor && reg.title) {
          const [baseX, baseY] = this.projector.toScreen(reg.anchor[0], reg.anchor[1]);
          const isQiao = reg.category === '侨州';
          const rLbl = this._svgNode(
            'text',
            {
              class: isQiao ? 'region-caption is-qiaozhou' : 'region-caption',
              'data-x': baseX.toFixed(1),
              'data-y': baseY.toFixed(1),
              'data-base-x': baseX.toFixed(1),
              'data-base-y': baseY.toFixed(1),
            },
            prefGroup
          );
          rLbl._regShape = reg.shape;
          rLbl.textContent = isQiao
            ? this.locale === 'en'
              ? `${this.trTerm(reg.title)} (Emigre)`
              : this._zh(`${reg.title}·侨`)
            : this.trTerm(reg.title);
        }
      }

      this.lastRenderedSnap = snap;
      this._renderLegendBox(snap);
      this._syncTracedPrefecture();
      this._rescaleSvgTypography();
    }

    _buildRegionBoundaryPath(snap) {
      if (!snap || snap._skipRegionBoundaryStroke || !Array.isArray(snap.regions) || !snap.regions.length) {
        return '';
      }
      if (snap._cachedRegionBoundaryPath !== undefined) {
        return snap._cachedRegionBoundaryPath;
      }

      const polRings = [];
      for (const pol of snap.polities || []) {
        if (!pol || pol.role === 'neighbor' || !pol.shape) continue;
        const coords = pol.shape.coordinates;
        const polys = pol.shape.type === 'Polygon' ? [coords] : coords || [];
        for (const poly of polys) {
          const ring = poly && poly[0];
          if (!ring || ring.length < 3) continue;
          let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
          for (let i = 0; i < ring.length; i++) {
            const x = ring[i][0],
              y = ring[i][1];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
          polRings.push({ minX, maxX, minY, maxY, ring });
        }
      }
      const inPolity = (x, y) => {
        if (!polRings.length) return true;
        for (let rIdx = 0; rIdx < polRings.length; rIdx++) {
          const b = polRings[rIdx];
          if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
          const ring = b.ring;
          let inside = false;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0],
              yi = ring[i][1];
            const xj = ring[j][0],
              yj = ring[j][1];
            if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
              inside = !inside;
            }
          }
          if (inside) return true;
        }
        return false;
      };
      const ptKey = (pt) => `${pt[0].toFixed(2)},${pt[1].toFixed(2)}`;
      const edgeKey = (p1, p2) => {
        const k1 = ptKey(p1);
        const k2 = ptKey(p2);
        return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      };

      const allRings = [];
      const regEdgeCounts = new Map();
      for (const reg of snap.regions) {
        if (!reg || !reg.shape) continue;
        const coords = reg.shape.coordinates;
        const polys = reg.shape.type === 'Polygon' ? [coords] : coords || [];
        for (const poly of polys) {
          for (const ring of poly || []) {
            if (!ring || ring.length < 2) continue;
            allRings.push(ring);
            for (let i = 0; i < ring.length - 1; i++) {
              const ek = edgeKey(ring[i], ring[i + 1]);
              regEdgeCounts.set(ek, (regEdgeCounts.get(ek) || 0) + 1);
            }
          }
        }
      }

      const seenEdges = new Set();
      let d = '';
      for (const ring of allRings) {
        let penX = NaN;
        let penY = NaN;
        for (let i = 0; i < ring.length - 1; i++) {
          const p1 = ring[i];
          const p2 = ring[i + 1];
          const ek = edgeKey(p1, p2);
          if (
            (regEdgeCounts.get(ek) || 0) < 2 ||
            seenEdges.has(ek) ||
            !inPolity((p1[0] + p2[0]) * 0.5, (p1[1] + p2[1]) * 0.5)
          ) {
            penX = NaN;
            penY = NaN;
            continue;
          }
          seenEdges.add(ek);
          const [x1, y1] = this.projector.toScreen(p1[0], p1[1]);
          const [x2, y2] = this.projector.toScreen(p2[0], p2[1]);
          if (Math.hypot(x2 - x1, y2 - y1) < 0.05) continue;
          if (x1 !== penX || y1 !== penY) {
            d += `M${x1.toFixed(1)} ${y1.toFixed(1)}`;
          }
          d += `L${x2.toFixed(1)} ${y2.toFixed(1)}`;
          penX = x2;
          penY = y2;
        }
      }

      Object.defineProperty(snap, '_cachedRegionBoundaryPath', {
        value: d,
        writable: true,
        enumerable: false,
        configurable: true,
      });
      return d;
    }

    _isSettlementCapital(item, year) {
      if (!item || !item.isCapital) return false;
      if (!Array.isArray(item.capitalPeriods) || !item.capitalPeriods.length) return true;
      return item.capitalPeriods.some(([y0, y1]) => year >= y0 && year <= y1);
    }

    _settlementMask(dynasty, year) {
      const sMask = (dynasty.settlements || [])
        .map((item) => {
          if (
            (item.appear !== undefined && year < item.appear) ||
            (item.vanish !== undefined && year >= item.vanish)
          ) {
            return '0';
          }
          return this._isSettlementCapital(item, year) ? '2' : '1';
        })
        .join('');
      const pMask = HistoricalAtlasController.STRATEGIC_PASSES.map((p) =>
        (p.appear !== undefined && year < p.appear) ||
        (p.vanish !== undefined && year >= p.vanish)
          ? '0'
          : '1'
      ).join('');
      return `${sMask}:${pMask}`;
    }

    _renderSettlements(dynasty) {
      this.activeSettlementMask = this._settlementMask(dynasty, this.year);
      this.grpSettlements.innerHTML = '';
      const group = this._svgNode('g', { class: 'fade-enter' }, this.grpSettlements);
      // Paint order: Tier-2 secondary cities first (bottom), Tier-1 cities second, Capitals last (top)
      const activeList = (dynasty.settlements || [])
        .filter(
          (item) =>
            (item.appear === undefined || this.year >= item.appear) &&
            (item.vanish === undefined || this.year < item.vanish)
        )
        .sort((a, b) => {
          const rank = (s) => (this._isSettlementCapital(s, this.year) ? 2 : s.tier === 2 ? 0 : 1);
          return rank(a) - rank(b);
        });

      const showOnboardingTraceHint =
        !this.hasSeenTraceHint &&
        !this.activePerson &&
        !this.activeCustomRoute &&
        !this.challenge;
      const hintCapital = showOnboardingTraceHint
        ? activeList.find(
            (s) =>
              this._isSettlementCapital(s, this.year) &&
              dynasty.seat &&
              dynasty.seat.includes(s.ancient.split(/[（(]/)[0])
          ) || activeList.find((s) => this._isSettlementCapital(s, this.year))
        : null;

      for (const item of activeList) {
        const [x, y] = this.projector.toScreen(item.coord[0], item.coord[1]);
        const isCapNow = this._isSettlementCapital(item, this.year);
        const isTier2 = item.tier === 2 && !isCapNow;
        const isHintCap = item === hintCapital;
        const isTracedCity =
          isTier2 &&
          Boolean(this.activeTrace) &&
          this.projector.greatCircleKm(this.activeTrace, item.coord) <= 28;
        const cls = isCapNow
          ? isHintCap
            ? 'settlement-node is-capital has-trace-hint'
            : 'settlement-node is-capital'
          : isTier2
            ? isTracedCity
              ? 'settlement-node is-tier2 is-trace-city'
              : 'settlement-node is-tier2'
            : 'settlement-node';
        const node = this._svgNode(
          'g',
          {
            class: cls,
            'data-x': x.toFixed(1),
            'data-y': y.toFixed(1),
          },
          group
        );
        node.dataset.ancient = item.ancient;
        node.dataset.modern = item.modern || '';
        node.dataset.remark = item.remark || '';
        node.dataset.lng = String(item.coord[0]);
        node.dataset.lat = String(item.coord[1]);
        node.dataset.prefAlign = item.align || 'r';
        node.dataset.tier = isCapNow ? '0' : isTier2 ? '2' : '1';

        if (isCapNow) {
          if (isHintCap) {
            this._svgNode('circle', { class: 'cap-breath-ring', r: 6.5 }, node);
            this._svgNode('circle', { class: 'cap-breath-ring is-delayed', r: 6.5 }, node);
          }
          this._svgNode('circle', { class: 'cap-ring', r: 4.5 }, node);
          this._svgNode('polygon', { class: 'dot', points: '0,-3.2 3.2,0 0,3.2 -3.2,0' }, node);
        } else if (isTier2) {
          this._svgNode('circle', { class: 'dot', r: 1.7 }, node);
        } else {
          this._svgNode('circle', { class: 'dot', r: 2.2 }, node);
        }

        const align = item.align || 'r';
        const anchor = align === 'l' ? 'end' : align === 'b' ? 'middle' : 'start';
        const dx = align === 'l' ? -5.5 : align === 'b' ? 0 : 5.5;
        const dy1 = align === 'b' ? 10.2 : align === 't' ? -4.8 : 3.0;

        const nameEl = this._svgNode(
          'text',
          { class: 'name', x: dx, y: dy1, 'text-anchor': anchor },
          node
        );
        nameEl.textContent =
          dynasty.key === 'roc' || dynasty.key === 'prc'
            ? this.trModernCity(item.ancient)
            : this.trTerm(item.ancient);

        if (isHintCap) {
          const tagG = this._svgNode(
            'g',
            { class: 'cap-hint-tag', transform: 'translate(0, 15.2)' },
            node
          );
          const innerG = this._svgNode('g', { class: 'cap-hint-inner' }, tagG);
          this._svgNode(
            'line',
            { class: 'cap-hint-stem', x1: '0', y1: '-9.8', x2: '0', y2: '-6.8' },
            innerG
          );
          const isEn = this.locale === 'en';
          const pillW = isEn ? 132 : 112;
          this._svgNode(
            'rect',
            {
              class: 'cap-hint-bg',
              x: String(-pillW * 0.5),
              y: '-6.8',
              width: String(pillW),
              height: '13.6',
              rx: '6.8',
            },
            innerG
          );
          const hintTxt = this._svgNode(
            'text',
            { class: 'cap-hint-text', x: '0', y: '0.3' },
            innerG
          );
          hintTxt.textContent = isEn
            ? '◆ Click city · 2,000 yrs of history ›'
            : this._zh('◆ 点按城池 · 阅两千年身世 ›');
        }
      }

      // Render Strategic Passes (名关雄隘 · 天下锁钥): subtle crenellated pass markers
      if (dynasty.key !== 'prc') {
        const activePasses = HistoricalAtlasController.STRATEGIC_PASSES.filter(
          (p) =>
            (p.appear === undefined || this.year >= p.appear) &&
            (p.vanish === undefined || this.year < p.vanish)
        );
        for (const p of activePasses) {
          const [px, py] = this.projector.toScreen(p.coord[0], p.coord[1]);
          const hasNearMilestone = (dynasty.milestones || []).some(
            (m) =>
              m.coord &&
              Math.abs(m.year - this.year) <= 8 &&
              this.projector.greatCircleKm(p.coord, m.coord) <= 42
          );
          const hasNearTrace =
            this.activeTrace && this.projector.greatCircleKm(p.coord, this.activeTrace) <= 32;
          const cls = [
            'settlement-node',
            'is-pass',
            hasNearMilestone || hasNearTrace ? 'is-pass-highlighted' : '',
            hasNearTrace ? 'is-pass-trace' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const pNode = this._svgNode(
            'g',
            {
              class: cls,
              'data-x': px.toFixed(1),
              'data-y': py.toFixed(1),
            },
            group
          );
          pNode.dataset.passKey = p.key;
          pNode.dataset.ancient = this.locale === 'en' ? p.ancientEn : this._zh(p.ancientZh);
          pNode.dataset.modern = this.locale === 'en' ? p.modernEn : this._zh(p.modernZh);
          pNode.dataset.remark = this.locale === 'en' ? p.rangeEn : this._zh(p.rangeZh);
          pNode.dataset.chokepoint = this.locale === 'en' ? p.chokepointEn : this._zh(p.chokepointZh);
          pNode.dataset.lng = String(p.coord[0]);
          pNode.dataset.lat = String(p.coord[1]);
          pNode.dataset.prefAlign = p.align || 'r';
          pNode.dataset.tier = 'pass';

          this._svgNode(
            'path',
            {
              class: 'pass-gate-icon',
              d: 'M-3.8,2.6 L-3.3,-0.9 L-3.3,-2.5 L-1.75,-2.5 L-1.75,-0.9 L-0.85,-0.9 L-0.85,-2.5 L0.85,-2.5 L0.85,-0.9 L1.75,-0.9 L1.75,-2.5 L3.3,-2.5 L3.3,-0.9 L3.8,2.6 L1.25,2.6 L1.25,1.1 A1.25,1.25 0 0,0 -1.25,1.1 L-1.25,2.6 Z',
            },
            pNode
          );
          const align = p.align || 'r';
          const anchor = align === 'l' ? 'end' : align === 'b' ? 'middle' : 'start';
          const dx = align === 'l' ? -5.6 : align === 'b' ? 0 : 5.6;
          const dy1 = align === 'b' ? 9.8 : align === 't' ? -4.5 : 2.8;
          const nameEl = this._svgNode(
            'text',
            { class: 'name pass-name', x: dx, y: dy1, 'text-anchor': anchor },
            pNode
          );
          nameEl.textContent = this.locale === 'en' ? p.ancientEn : this._zh(p.ancientZh);
        }
      }
      group.querySelectorAll('.settlement-node.is-capital').forEach((capNode) => {
        group.appendChild(capNode);
      });
      this._rescaleSvgTypography();
    }

    _renderCorridors() {
      const y = this.year;
      const mask =
        this.locale +
        ':' +
        this.corridors
          .map((c) => (!c.span || (y >= c.span[0] && y <= c.span[1]) ? '1' : '0'))
          .join('');
      if (mask === this.activeCorridorMask) return;
      this.activeCorridorMask = mask;

      this.grpCorridors.innerHTML = '';
      const group = this._svgNode('g', { class: 'fade-enter' }, this.grpCorridors);
      for (const corr of this.corridors) {
        if (corr.span && (y < corr.span[0] || y > corr.span[1])) continue;

        let pathStr = '';
        for (const seg of corr.segments) {
          for (let i = 0; i < seg.length; i++) {
            const [px, py] = this.projector.toScreen(seg[i][0], seg[i][1]);
            pathStr += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1);
          }
        }
        const p = this._svgNode(
          'path',
          { d: pathStr, class: `corridor-line ${corr.kind}` },
          group
        );
        p.dataset.corrTitle = this.corridorTitle(corr);
        p.dataset.corrSummary = this.corridorSummary(corr);

        if (corr.labelAt) {
          const [lx, ly] = this.projector.toScreen(corr.labelAt[0], corr.labelAt[1]);
          const lbl = this._svgNode(
            'text',
            {
              class: `corridor-caption ${corr.kind}`,
              'data-base-x': lx.toFixed(1),
              'data-base-y': ly.toFixed(1),
              'data-x': lx.toFixed(1),
              'data-y': ly.toFixed(1),
            },
            group
          );
          lbl.textContent = this.corridorTitle(corr);
        }
      }
      this._rescaleSvgTypography();
      if (this.lastRenderedSnap) this._renderLegendBox(this.lastRenderedSnap);
    }

    _findCoLocatedSettlement(dynasty, lng, lat, maxKm = 28) {
      if (!dynasty || !Array.isArray(dynasty.settlements)) return null;
      const z = 1000 / this.camera.w;
      const tier2MinZoom =
        typeof window !== 'undefined' && window.innerWidth <= 900 ? 3.15 : 2.18;
      const showTier2 = z >= tier2MinZoom;
      let best = null;
      let bestKm = maxKm;
      for (const s of dynasty.settlements) {
        if (
          (s.appear !== undefined && this.year < s.appear) ||
          (s.vanish !== undefined && this.year >= s.vanish)
        ) {
          continue;
        }
        if (s.tier === 2 && !s.isCapital && !showTier2) continue;
        const km = this.projector.greatCircleKm([lng, lat], s.coord);
        if (km <= bestKm) {
          bestKm = km;
          best = s;
        }
      }
      return best;
    }

    _renderMilestones(dynasty) {
      this.grpMilestones.innerHTML = '';
      const group = this._svgNode('g', { class: 'fade-enter' }, this.grpMilestones);
      (dynasty.milestones || []).forEach((m, idx) => {
        if (!m.coord) return;
        const [x, y] = this.projector.toScreen(m.coord[0], m.coord[1]);
        const pin = this._svgNode(
          'g',
          {
            class: 'milestone-pin',
            'data-x': x.toFixed(1),
            'data-y': y.toFixed(1),
            'data-year': m.year,
            'data-idx': idx,
          },
          group
        );
        this._svgNode('circle', { class: 'ev-ring', r: 9 }, pin);
        this._svgNode('polygon', { class: 'ev-core', points: '0,-5.5 5.5,0 0,5.5 -5.5,0' }, pin);
      });
      this._updateMilestoneStates(dynasty);
      this._rescaleSvgTypography();
      if (
        this.activeMilestone &&
        this.activeMilestone.dynastyKey === dynasty.key &&
        !this.activeMilestone.isAuto
      ) {
        this._positionMilestoneBalloon();
      } else {
        this._syncAutoMilestoneBalloon(dynasty);
      }
    }

    _activeMilestoneIndex(dynasty) {
      if (
        this.activeMilestone &&
        !this.activeMilestone.isAuto &&
        this.activeMilestone.dynastyKey === dynasty.key &&
        this.activeMilestone.year === this.year &&
        this.activeMilestone.idx >= 0
      ) {
        return this.activeMilestone.idx;
      }
      let exactIdx = -1;
      let activeIdx = -1;
      (dynasty.milestones || []).forEach((m, idx) => {
        if (m.year === this.year) exactIdx = idx;
        if (this._clampYearToDynasty(dynasty, m.year) <= this.year) activeIdx = idx;
      });
      return exactIdx >= 0 ? exactIdx : activeIdx;
    }

    _updateMilestoneStates(dynasty) {
      const activeIdx = this._activeMilestoneIndex(dynasty);
      let currentPin = null;
      this.grpMilestones.querySelectorAll('.milestone-pin').forEach((pin) => {
        const idx = Number(pin.dataset.idx);
        const m = (dynasty.milestones || [])[idx];
        const effY = m ? this._clampYearToDynasty(dynasty, m.year) : Number(pin.dataset.year);
        const nextFuture = effY > this.year && idx !== activeIdx;
        const isCurrent = idx === activeIdx;
        pin.classList.toggle('is-future', nextFuture);
        pin.classList.toggle('is-past', effY <= this.year && !isCurrent);
        pin.classList.toggle('is-current', isCurrent);
        if (isCurrent) currentPin = pin;
      });
      if (currentPin && currentPin.parentNode) {
        currentPin.parentNode.appendChild(currentPin);
      }
    }

    _syncAutoMilestoneBalloon(dynasty) {
      if (!dynasty || !this.milestoneBalloon) return;
      const milestonesHidden =
        this.grpMilestones && this.grpMilestones.classList.contains('is-hidden');
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;
      const genCard = this._id('genealogy-card');
      const mobileOverlayBusy =
        isMobile &&
        (this.mobileChronicleOpen || (genCard && !genCard.classList.contains('is-hidden')));
      if (
        milestonesHidden ||
        this.challenge ||
        this.activePerson ||
        mobileOverlayBusy
      ) {
        if (this.activeMilestone && this.activeMilestone.isAuto) {
          this.closeMilestoneBalloon();
        }
        return;
      }
      if (
        this.activeMilestone &&
        !this.activeMilestone.isAuto &&
        this.activeMilestone.dynastyKey === dynasty.key &&
        this.activeMilestone.year === this.year &&
        !this.milestoneBalloon.classList.contains('is-hidden')
      ) {
        this._positionMilestoneBalloon();
        return;
      }
      const activeIdx = this._activeMilestoneIndex(dynasty);
      const m = activeIdx >= 0 ? (dynasty.milestones || [])[activeIdx] : null;
      if (
        !m ||
        !m.coord ||
        (this.dismissedCalloutIds && this.dismissedCalloutIds.has(`${dynasty.key}:${activeIdx}`))
      ) {
        this.closeMilestoneBalloon();
        return;
      }
      // Keep an auto callout that already shows this milestone instead of rebuilding it on
      // every year step, so a tap that lands mid-playback still reaches its buttons.
      const am = this.activeMilestone;
      if (
        am &&
        am.isAuto &&
        am.milestone === m &&
        am.locale === this.locale &&
        !this.milestoneBalloon.classList.contains('is-hidden')
      ) {
        this.grpMilestones.querySelectorAll('.milestone-pin').forEach((n) => {
          n.classList.toggle('is-active', Number(n.dataset.idx) === am.idx);
        });
        this._positionMilestoneBalloon();
        return;
      }
      this.openMilestoneBalloon(dynasty, m, { isAuto: true });
    }

    _resolvePinMilestone(dynasty, milestoneEl) {
      if (!milestoneEl || !dynasty) return null;
      const list = dynasty.milestones || [];
      const m0 =
        (milestoneEl.dataset.idx !== undefined && list[Number(milestoneEl.dataset.idx)]) ||
        list.find((item) => item.year === Number(milestoneEl.dataset.year)) ||
        null;
      if (!m0 || !m0.coord) return m0;
      const colocated = list.filter(
        (item) => item.coord && this.projector.greatCircleKm(m0.coord, item.coord) <= 18
      );
      if (colocated.length <= 1) return m0;
      if (
        this.activeMilestone &&
        this.activeMilestone.dynastyKey === dynasty.key &&
        !this.milestoneBalloon.classList.contains('is-hidden') &&
        colocated.includes(this.activeMilestone.milestone)
      ) {
        return this.activeMilestone.milestone;
      }
      const pastOrNow = colocated.filter(
        (item) => this._clampYearToDynasty(dynasty, item.year) <= this.year
      );
      return pastOrNow.length > 0 ? pastOrNow[pastOrNow.length - 1] : colocated[0];
    }

    openMilestoneBalloon(dynasty, m, opts = {}) {
      const isAuto = Boolean(opts && opts.isAuto);
      if (!isAuto && this.hoverTip) {
        this.hoverTip.classList.add('is-hidden');
        this.hoverTip.classList.remove('is-interactive');
      }
      if (
        !isAuto &&
        typeof window !== 'undefined' &&
        window.innerWidth <= 900 &&
        !this._id('genealogy-card').classList.contains('is-hidden')
      ) {
        this.closeGenealogyCard();
      }
      const mIdx = (dynasty.milestones || []).indexOf(m);
      if (!isAuto && this.dismissedCalloutIds && mIdx >= 0) {
        this.dismissedCalloutIds.delete(`${dynasty.key}:${mIdx}`);
      }
      this.activeMilestone = {
        dynastyKey: dynasty.key,
        milestone: m,
        idx: mIdx,
        year: this.year,
        isAuto,
        locale: this.locale,
      };
      this.grpMilestones.querySelectorAll('.milestone-pin').forEach((n) => {
        n.classList.toggle('is-active', Number(n.dataset.idx) === mIdx);
      });
      this._highlightCurrentMilestone(dynasty);
      this._updateMilestoneStates(dynasty);
      if (!m.coord || (opts && opts.fromStep && this.grpMilestones && this.grpMilestones.classList.contains('is-hidden'))) {
        this.milestoneBalloon.classList.add('is-hidden');
        const vf = this._id('viewport-frame');
        if (vf) vf.classList.remove('has-open-milestone-balloon');
        return;
      }
      const yrText = this.formatYear(m.year);
      const siteStr = this.milestoneSite(dynasty, m);
      const traceTitle =
        this.locale === 'en' ? 'Click to trace place history' : '点击查看此地历代沿革（点地溯源）';
      const traceSuffix = this.locale === 'en' ? 'History ›' : '沿革 ›';
      const placeHtml = siteStr
        ? `<button type="button" class="ep-place" title="${traceTitle}">${SVG_ICONS.pin} ${siteStr} · ${traceSuffix}</button>`
        : '';
      const closeTitle = this.locale === 'en' ? 'Dismiss event callout' : '关闭此事件浮签';
      this.milestoneBalloon.innerHTML =
        `<div class="ep-head"><span class="ep-year">${yrText} · ${this._eventEraLabel(dynasty, m)}</span>${placeHtml}<button type="button" class="ep-close" title="${closeTitle}" aria-label="${closeTitle}">×</button></div>` +
        `<div class="ep-text">${this.milestoneHeadline(dynasty, m)}</div>`;
      const placeBtn = this.milestoneBalloon.querySelector('.ep-place');
      if (placeBtn && m.coord) {
        placeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const coCity = this._findCoLocatedSettlement(dynasty, m.coord[0], m.coord[1], 28);
          const targetCoord = coCity ? coCity.coord : m.coord;
          this.openGenealogyAt(targetCoord[0], targetCoord[1]);
        });
      }
      const closeBtn = this.milestoneBalloon.querySelector('.ep-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.dismissedCalloutIds && mIdx >= 0) {
            this.dismissedCalloutIds.add(`${dynasty.key}:${mIdx}`);
          }
          this.closeMilestoneBalloon();
        });
      }
      this.milestoneBalloon.classList.remove('is-hidden', 'is-offscreen');
      if (this.locale === 'zh-tw') this._applyZhHantDom(this.milestoneBalloon);
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.add('has-open-milestone-balloon');
      this._positionMilestoneBalloon();
    }

    _positionMilestoneBalloon() {
      if (!this.activeMilestone || !this.activeMilestone.milestone.coord) return;
      const [sx, sy] = this.projector.toScreen(
        this.activeMilestone.milestone.coord[0],
        this.activeMilestone.milestone.coord[1]
      );
      const rect = this.svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scale = Math.min(rect.width / this.camera.w, rect.height / this.camera.h);
      const padX = (rect.width - this.camera.w * scale) * 0.5;
      const padY = (rect.height - this.camera.h * scale) * 0.5;
      const px = padX + (sx - this.camera.x) * scale;
      const py = padY + (sy - this.camera.y) * scale;
      if (px < -16 || px > rect.width + 16 || py < -16 || py > rect.height + 16) {
        this.milestoneBalloon.classList.add('is-offscreen');
        return;
      }
      this.milestoneBalloon.classList.remove('is-offscreen');
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;
      const genCard = this._id('genealogy-card');
      const genOpen =
        genCard && !genCard.classList.contains('is-hidden') && !isMobile;
      const bW = this.milestoneBalloon.offsetWidth || (isMobile ? 228 : 260);
      const bH = this.milestoneBalloon.offsetHeight || (isMobile ? 54 : 62);
      const minLeft = isMobile ? 8 : 12;
      const rightLimit = Math.max(
        minLeft,
        genOpen ? rect.width - 356 - bW : rect.width - bW - (isMobile ? 8 : 12)
      );
      const minTop = isMobile ? 48 : 12;
      const maxTop = Math.max(minTop, rect.height - bH - (isMobile ? 56 : 16));
      const pinGap = isMobile ? 10 : 12;

      let left;
      let top = Math.max(minTop, Math.min(maxTop, py - bH * 0.42));
      let caretDir = 'left';
      if (px + pinGap <= rightLimit) {
        left = px + pinGap;
        caretDir = 'left';
      } else if (px - bW - pinGap >= minLeft) {
        left = px - bW - pinGap;
        caretDir = 'right';
      } else {
        left = Math.max(minLeft, Math.min(rightLimit, px - bW * 0.5));
        if (py - bH - pinGap >= minTop) {
          top = py - bH - pinGap;
          caretDir = 'bottom';
        } else {
          top = Math.min(maxTop, py + pinGap + 4);
          caretDir = 'top';
        }
      }
      const caretX = Math.max(14, Math.min(bW - 14, Math.round(px - left)));
      const caretY = Math.max(12, Math.min(bH - 12, Math.round(py - top)));
      this.milestoneBalloon.dataset.caret = caretDir;
      this.milestoneBalloon.style.setProperty('--caret-x', `${caretX}px`);
      this.milestoneBalloon.style.setProperty('--caret-y', `${caretY}px`);
      this.milestoneBalloon.style.left = `${Math.round(left)}px`;
      this.milestoneBalloon.style.top = `${Math.round(top)}px`;
    }

    closeMilestoneBalloon() {
      this.activeMilestone = null;
      this.milestoneBalloon.classList.add('is-hidden');
      this.milestoneBalloon.classList.remove('is-offscreen');
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.remove('has-open-milestone-balloon');
      this.grpMilestones
        .querySelectorAll('.milestone-pin.is-active')
        .forEach((n) => n.classList.remove('is-active'));
    }

    _setPolityFocus(targetTitle) {
      if (!this.grpPolities) return;
      if (!targetTitle) {
        this.grpPolities.classList.remove('has-polity-focus');
        this.grpPolities
          .querySelectorAll('.is-focused')
          .forEach((el) => el.classList.remove('is-focused'));
        return;
      }
      this.grpPolities.classList.add('has-polity-focus');
      this.grpPolities
        .querySelectorAll('.polity-shape, .polity-caption')
        .forEach((el) => {
          const match =
            targetTitle === '__neighbors__'
              ? el.dataset.polityRole === 'neighbor'
              : el.dataset.polityTitle === targetTitle;
          el.classList.toggle('is-focused', match);
        });
    }

    _zoomToPolity(polityTitle) {
      const snap = this.lastRenderedSnap;
      if (!snap || !Array.isArray(snap.polities)) return;
      const matches = snap.polities.filter((p) => p.title === polityTitle && p.shape);
      if (!matches.length) return;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const visitRing = (ring) => {
        for (const pt of ring || []) {
          const [sx, sy] = this.projector.toScreen(pt[0], pt[1]);
          if (sx < minX) minX = sx;
          if (sx > maxX) maxX = sx;
          if (sy < minY) minY = sy;
          if (sy > maxY) maxY = sy;
        }
      };
      for (const pol of matches) {
        if (pol.shape.type === 'Polygon') {
          (pol.shape.coordinates || []).forEach(visitRing);
        } else if (pol.shape.type === 'MultiPolygon') {
          (pol.shape.coordinates || []).forEach((poly) => (poly || []).forEach(visitRing));
        }
      }
      if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;

      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5;
      const spanW = Math.max(maxX - minX, (maxY - minY) / 0.7) * 1.38;
      const w = Math.max(170, Math.min(1000, spanW));
      const h = w * 0.7;
      this._animateCameraTo({
        x: Math.max(-180, Math.min(1000 - w + 180, cx - w * 0.5)),
        y: Math.max(-120, Math.min(700 - h + 120, cy - h * 0.5)),
        w,
        h,
      });
    }

    _renderGhostDiff(refSnap, mode = 'fade') {
      if (!this.grpGhostDiff) return;
      if (this.ghostTimer) {
        clearTimeout(this.ghostTimer);
        this.ghostTimer = null;
      }
      this.grpGhostDiff.innerHTML = '';
      if (!refSnap || !Array.isArray(refSnap.polities)) return;
      const chkPol = this._id('chk-polities');
      if (chkPol && !chkPol.checked) return;

      const curSnap = this.lastRenderedSnap;
      const curNonNeighbors = ((curSnap && curSnap.polities) || []).filter(
        (p) => p.role !== 'neighbor'
      );
      const curPaths = new Set(
        curNonNeighbors.map((p) => `${p.title}:${this.projector.shapeToSvgPath(p.shape)}`)
      );
      const curShapes = new Set(
        curNonNeighbors.map((p) => this.projector.shapeToSvgPath(p.shape))
      );

      const candidates = refSnap.polities.filter((p) => p.role !== 'neighbor');
      const diffCandidates = candidates.filter((pol) => {
        const dStr = this.projector.shapeToSvgPath(pol.shape);
        return dStr && !curPaths.has(`${pol.title}:${dStr}`) && !curShapes.has(dStr);
      });
      const listToRender =
        diffCandidates.length > 0
          ? diffCandidates
          : mode === 'preview'
            ? candidates
            : [];

      let count = 0;
      for (const pol of listToRender) {
        const dStr = this.projector.shapeToSvgPath(pol.shape);
        if (!dStr) continue;
        const ghostPath = this._svgNode(
          'path',
          {
            d: dStr,
            class: `polity-ghost-path is-${pol.role || 'main'} ${mode === 'preview' ? 'is-preview' : 'is-fade'}`,
            stroke: pol.tint || '#b5452f',
          },
          this.grpGhostDiff
        );
        if (ghostPath && ghostPath.dataset) {
          ghostPath.dataset.polityTitle = pol.title || '';
          ghostPath.dataset.polityRole = pol.role || '';
        }
        count++;
      }
      if (count > 0 && mode === 'fade') {
        this.ghostTimer = setTimeout(() => {
          if (this.grpGhostDiff) this.grpGhostDiff.innerHTML = '';
          this.ghostTimer = null;
        }, 2850);
      }
    }

    _clearPreviewGhost() {
      if (!this.grpGhostDiff || this.ghostTimer) return;
      this.grpGhostDiff.innerHTML = '';
    }

    _previewStageGhost(snapKey) {
      if (!snapKey || snapKey === this.activeSnapKey) return;
      const snap = this.snapshots && this.snapshots[snapKey];
      if (snap) {
        this._renderGhostDiff(snap, 'preview');
      } else if (!this._fullSnapshotsLoaded) {
        this._ensureFullSnapshots().then(() => {
          const loaded = this.snapshots && this.snapshots[snapKey];
          if (loaded) this._renderGhostDiff(loaded, 'preview');
        });
      }
    }

    _renderLegendBox(snap) {
      this.mapKey.innerHTML = '';
      this.mobileLegendOpen = Boolean(this.mobileLegendOpen);
      this.mapKey.classList.toggle('is-mobile-expanded', this.mobileLegendOpen);

      const curDyn = this.dynasties[this.dynastyIdx];
      const bar = document.createElement('div');
      bar.className = 'key-phase-bar';

      if (curDyn && Array.isArray(curDyn.phases) && curDyn.phases.length > 1) {
        const phases = curDyn.phases;
        let pIdx = phases.findIndex((ph) => this.year < ph.until);
        if (pIdx === -1) pIdx = phases.length - 1;
        const phaseStart = (idx) => (idx <= 0 ? curDyn.fromYear : phases[idx - 1].until);
        const curSy = phaseStart(pIdx);
        const curEy = phases[pIdx].until - 1;
        const spanText = `${this.formatYear(curSy, true)}—${this.formatYear(curEy, true)}`;

        const badge = document.createElement('span');
        badge.className = 'key-phase-badge';
        badge.textContent =
          this.locale === 'en'
            ? `${this.dynastyBadge(curDyn)} · Stage ${pIdx + 1}/${phases.length} (${spanText})`
            : `${this.dynastyBadge(curDyn)} · 阶段 ${pIdx + 1}/${phases.length} (${spanText})`;
        bar.appendChild(badge);

        const dots = document.createElement('div');
        dots.className = 'key-phase-dots';
        phases.forEach((ph, idx) => {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = `phase-dot${idx === pIdx ? ' is-active' : ''}`;
          const sy = phaseStart(idx);
          const ey = ph.until - 1;
          dot.title = `${this.formatYear(sy, true)} — ${this.formatYear(ey, true)}`;
          dot.addEventListener('pointerenter', (e) => {
            if (e.pointerType !== 'touch' && idx !== pIdx) this._previewStageGhost(ph.snap);
          });
          dot.addEventListener('pointerleave', (e) => {
            if (e.pointerType !== 'touch') this._clearPreviewGhost();
          });
          dot.addEventListener('click', () => {
            this.stopAutoplay();
            this.jumpToYear(sy);
          });
          dots.appendChild(dot);
        });
        bar.appendChild(dots);
      } else {
        bar.classList.add('is-single-phase');
        const badge = document.createElement('span');
        badge.className = 'key-phase-badge';
        badge.textContent = curDyn ? this.dynastyName(curDyn) : '';
        bar.appendChild(badge);
      }

      const mobToggle = document.createElement('button');
      mobToggle.type = 'button';
      mobToggle.className = 'key-mobile-toggle';
      const syncMobToggleLabel = () => {
        mobToggle.textContent = this.mobileLegendOpen
          ? this.locale === 'en'
            ? 'Less ▾'
            : '收起 ▾'
          : this.locale === 'en'
            ? 'Legend ▴'
            : '图例 ▴';
        mobToggle.setAttribute('aria-expanded', this.mobileLegendOpen ? 'true' : 'false');
      };
      syncMobToggleLabel();
      mobToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.mobileLegendOpen = !this.mobileLegendOpen;
        this.mapKey.classList.toggle('is-mobile-expanded', this.mobileLegendOpen);
        syncMobToggleLabel();
      });
      bar.appendChild(mobToggle);
      this.mapKey.appendChild(bar);

      if (snap.caption) {
        const h = document.createElement('div');
        h.className = 'key-heading';
        h.textContent = this.trTerm(snap.caption);
        this.mapKey.appendChild(h);
      }
      const grid = document.createElement('div');
      grid.className = 'key-grid key-polities-grid';
      const core = (snap.polities || []).filter((p) => p.role !== 'neighbor');
      const hasNeighbors = (snap.polities || []).some((p) => p.role === 'neighbor');
      for (const p of core) {
        const entry = document.createElement('span');
        entry.className = 'key-entry is-interactive';
        entry.title =
          this.locale === 'en'
            ? 'Hover to highlight · Click to zoom'
            : '悬停高亮疆域 · 点击聚焦版图';
        const sw = document.createElement('i');
        sw.className = 'swatch';
        sw.style.color = p.tint;
        sw.style.background = `${p.tint}55`;
        if (p.role === 'protectorate') sw.style.borderStyle = 'dashed';
        entry.appendChild(sw);
        entry.appendChild(document.createTextNode(this.trTerm(p.title)));
        entry.addEventListener('pointerenter', (e) => {
          if (e.pointerType !== 'touch') this._setPolityFocus(p.title);
        });
        entry.addEventListener('pointerleave', (e) => {
          if (e.pointerType !== 'touch') this._setPolityFocus(null);
        });
        entry.addEventListener('click', () => this._zoomToPolity(p.title));
        grid.appendChild(entry);
      }
      if (hasNeighbors) {
        const entry = document.createElement('span');
        entry.className = 'key-entry is-interactive key-neighbor-entry';
        entry.title =
          this.locale === 'en'
            ? 'Hover to highlight surrounding polities · Click to reset view'
            : '悬停高亮周边政权 · 点击复位全图';
        const sw = document.createElement('i');
        sw.className = 'swatch';
        sw.style.color = '#7a4b2a';
        sw.style.borderStyle = 'dashed';
        sw.style.background = 'rgba(168, 122, 76, 0.24)';
        entry.appendChild(sw);
        entry.appendChild(
          document.createTextNode(this.uiStr('leg_neighbor', '同期周边政权'))
        );
        entry.addEventListener('pointerenter', (e) => {
          if (e.pointerType !== 'touch') this._setPolityFocus('__neighbors__');
        });
        entry.addEventListener('pointerleave', (e) => {
          if (e.pointerType !== 'touch') this._setPolityFocus(null);
        });
        entry.addEventListener('click', () => this.resetCamera());
        grid.appendChild(entry);
      }
      if (grid.firstChild) this.mapKey.appendChild(grid);

      if (snap.note) {
        const n = document.createElement('div');
        n.className = 'key-note';
        n.innerHTML = `${SVG_ICONS.dashedBox} <span>${this.trTerm(snap.note)}</span>`;
        this.mapKey.appendChild(n);
      }

      if (this._id('chk-corridors') && this._id('chk-corridors').checked) {
        const activeKinds = new Set();
        for (const c of this.corridors) {
          if (c.span && this.year >= c.span[0] && this.year <= c.span[1]) {
            activeKinds.add(c.kind);
          }
        }
        const hasActivePasses = curDyn && curDyn.key !== 'prc';
        if (activeKinds.size || hasActivePasses) {
          const row = document.createElement('div');
          row.className = 'key-grid key-corridors-grid';
          if (hasActivePasses) {
            const passChip = document.createElement('span');
            passChip.className = 'key-entry';
            const passLabel = this.locale === 'en' ? 'Strategic Passes' : '名关雄隘';
            passChip.innerHTML = `<svg width="13" height="10" viewBox="-4.6 -3.3 9.2 6.7"><path d="M-3.8,2.6 L-3.3,-0.9 L-3.3,-2.5 L-1.75,-2.5 L-1.75,-0.9 L-0.85,-0.9 L-0.85,-2.5 L0.85,-2.5 L0.85,-0.9 L1.75,-0.9 L1.75,-2.5 L3.3,-2.5 L3.3,-0.9 L3.8,2.6 L1.25,2.6 L1.25,1.1 A1.25,1.25 0 0,0 -1.25,1.1 L-1.25,2.6 Z" fill="#fdf6ea" stroke="#8c3b22" stroke-width="0.95" stroke-linejoin="round"/></svg>${passLabel}`;
            row.appendChild(passChip);
          }
          const seaLabel =
            this.year >= 1405 && this.year <= 1433
              ? this.uiStr('leg_sea', '海上丝路 / 郑和航线')
              : this.locale === 'en'
                ? 'Maritime Silk Road'
                : '海上丝绸之路';
          const meta = [
            ['wall', '#5a3826', '5 2', this.uiStr('leg_wall', '长城')],
            ['canal', '#1f6f8b', '6 2', this.uiStr('leg_canal', '大运河')],
            ['road', '#9c6317', '2 3', this.uiStr('leg_road', '陆上丝路 / 古道')],
            ['sea', '#2c5d8f', '2 3', seaLabel],
          ];
          for (const [k, col, dash, label] of meta) {
            if (!activeKinds.has(k)) continue;
            const s = document.createElement('span');
            s.className = 'key-entry';
            s.innerHTML = `<svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke="${col}" stroke-width="2.2" stroke-dasharray="${dash}"/></svg>${label}`;
            row.appendChild(s);
          }
          this.mapKey.appendChild(row);
        }
      }
      if (this.locale === 'zh-tw') this._applyZhHantDom(this.mapKey);
      this.mapKey.style.display = this.mapKey.firstChild ? 'flex' : 'none';
    }

    // ---------------- Chronicle Sidebar ----------------
    _syncDocumentSeoMeta() {
      if (typeof document === 'undefined') return;
      const baseSiteUrl = 'https://deanchen.me/jiangshan-map/';
      const isEn = this.locale === 'en';
      const cur = this.dynasties && this.dynasties[this.dynastyIdx];
      let pageTitle = isEn
        ? this.uiStr('title', 'Jiangshan Atlas · Interactive Historical Atlas of China (403 BCE – Present)')
        : '江山时序 · 中国历史地图时间轴（战国至现代历代疆域、州郡政区与古今地名沿革）';
      let pageDesc = isEn
        ? 'Explore 2,400+ years of Chinese history from the Warring States (403 BCE) to the present across 18 eras, 166 multi-stage territory snapshots, 442 milestones, 571 city landmarks, 20 strategic passes, and 100+ person chronicles.'
        : '交互式中国历史地图时间轴（公元前403年战国三家分晋至现代）：浏览18个朝代、166幅多阶段历史疆域与州道政区快照、442条编年大事、571处城池地标、20座天下名关与百余位青史人物行迹。';
      let canonicalUrl = baseSiteUrl;

      if (this.activePerson) {
        const p = this.activePerson.profile;
        const pName = isEn ? p.en : p.zh;
        pageTitle = isEn
          ? `${pName} — Historical Events Map · Jiangshan Atlas of China`
          : `${pName}生平纪事地图 · 江山时序中国历史地图`;
        pageDesc = isEn
          ? `Interactive spatio-temporal chronicle of ${pName} across ${this.activePerson.events.length} historical sites in the Jiangshan Atlas of China.`
          : `${pName}生平 ${this.activePerson.events.length} 处历史事件时空落点、历代疆域与古今地名对照。`;
        canonicalUrl = `${baseSiteUrl}?person=${encodeURIComponent(p.key)}${isEn ? '&lang=en' : ''}`;
      } else if (cur && this._bootDone) {
        const dName = this.dynastyName(cur);
        const dSpan = this.formatSpan(cur);
        const dSeat = this.dynastySeat(cur);
        const dSum = this.dynastySummary(cur);
        pageTitle = isEn
          ? `${dName} (${dSpan}) Map · Jiangshan Historical Atlas of China`
          : `${dName}历史地图（${dSpan}）疆域政区与古今地名 · 江山时序`;
        pageDesc = isEn
          ? `${dName} (${dSpan}) historical territory, administrative divisions & cities. Capital: ${dSeat}. ${dSum}`
          : `${dName}（${dSpan}）历史疆域与州郡政区地图。都城：${dSeat}。${dSum}`;
        const qParams = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
        if (qParams && qParams.has('year')) {
          canonicalUrl = `${baseSiteUrl}?year=${this.year}${isEn ? '&lang=en' : ''}`;
        } else if (isEn) {
          canonicalUrl = `${baseSiteUrl}?lang=en`;
        }
      }

      document.title = pageTitle;
      const setMeta = (id, attr, val) => {
        const el = this._id(id);
        if (el && val) el.setAttribute(attr, val);
      };
      setMeta('meta-description', 'content', pageDesc);
      setMeta('og-title', 'content', pageTitle);
      setMeta('og-description', 'content', pageDesc);
      setMeta('og-url', 'content', canonicalUrl);
      setMeta('tw-title', 'content', pageTitle);
      setMeta('tw-description', 'content', pageDesc);
      setMeta('lnk-canonical', 'href', canonicalUrl);
    }

    _syncSeoDirectoryLocale() {
      const nav = this._id('seo-atlas-directory');
      if (!nav) return;
      if (!this._seoDirZhHtml) {
        this._seoDirZhHtml = nav.innerHTML;
      }
      if (this.locale !== 'en') {
        nav.setAttribute('aria-label', '中国历代疆域、点人溯事与天下名关索引');
        if (nav.dataset.locale === 'en') {
          nav.innerHTML = this._seoDirZhHtml;
          nav.dataset.locale = 'zh';
        }
        return;
      }
      if (nav.dataset.locale === 'en') return;
      nav.setAttribute(
        'aria-label',
        'Historical Dynasties, Person Chronicles & Strategic Passes Directory'
      );
      const baseSiteUrl = 'https://deanchen.me/jiangshan-map/';
      const dynItems = (this.dynasties || [])
        .map((d) => {
          const dName = this.dynastyName(d);
          const dSpan = this.formatSpan(d);
          const dSeat = this.dynastySeat(d);
          const dSum = this.dynastySummary(d);
          const focusY = d.focusYear !== undefined ? d.focusYear : d.fromYear;
          const isMod = d.key === 'roc' || d.key === 'prc';
          const cities = (d.settlements || [])
            .filter((s) => s.isCapital || s.tier === 1)
            .slice(0, 8)
            .map((s) => {
              const anc = isMod ? this.trModernCity(s.ancient) : this.trTerm(s.ancient);
              const mod = s.modern ? this.trModernCity(s.modern) : '';
              return mod && mod !== anc ? `${anc} (now ${mod})` : anc;
            })
            .join(', ');
          const events = (d.milestones || [])
            .slice(0, 6)
            .map((m) => `${this.formatYear(m.year)}: ${this.milestoneHeadline(d, m)}`)
            .join('; ');
          return `<li><a href="${baseSiteUrl}?year=${focusY}&amp;lang=en"><strong>${dName} Historical Map (${dSpan})</strong></a> — Capital: ${dSeat}. ${dSum}${cities ? ` Key cities: ${cities}.` : ''}${events ? ` Major events: ${events}.` : ''}</li>`;
        })
        .join('');
      const journeyItems = (HistoricalAtlasController.HISTORICAL_JOURNEYS || [])
        .map((j) => {
          const stopsStr = (j.stops || [])
            .map((s) => `${s.ancientEn} (${s.modernEn})`)
            .join(' → ');
          return `<li><a href="${baseSiteUrl}?person=${encodeURIComponent(j.key)}&amp;lang=en"><strong>${j.titleEn} (${j.spanEn})</strong></a> — Route stops: ${stopsStr}.</li>`;
        })
        .join('');
      const passItems = (HistoricalAtlasController.STRATEGIC_PASSES || [])
        .map((p) => {
          const y = p.focusYear !== undefined ? p.focusYear : p.appear || -200;
          const c0 = p.coord ? p.coord[0] : 110;
          const c1 = p.coord ? p.coord[1] : 34;
          return `<li><a href="${baseSiteUrl}?year=${y}&amp;trace=${c0},${c1}&amp;lang=en"><strong>${p.ancientEn} (now ${p.modernEn})</strong></a> — ${p.rangeEn}: ${p.chokepointEn}</li>`;
        })
        .join('');
      nav.innerHTML =
        `<h2>Jiangshan Atlas: Historical Maps of China, Prefectures, Ancient &amp; Modern Place Names, and Major Events (403 BCE – Present)</h2>` +
        `<p>Interactive timeline atlas of Chinese history across 18 major eras—Warring States, Qin, Western Han, Eastern Han, Three Kingdoms, Western Jin, Eastern Jin &amp; Sixteen Kingdoms, Northern &amp; Southern Dynasties, Sui, Tang, Five Dynasties &amp; Ten Kingdoms, Northern Song (Liao &amp; Western Xia), Southern Song (Jin &amp; Mongol), Yuan, Ming, Qing, Republic of China, and People's Republic of China.</p>` +
        `<section><h3>1. Historical Dynasties &amp; Territories Directory</h3><ul>${dynItems}</ul></section>` +
        `<section><h3>2. Person Chronicles &amp; Life Routes</h3><ul>${journeyItems}</ul></section>` +
        `<section><h3>3. 20 Strategic Mountain &amp; River Passes</h3><ul>${passItems}</ul></section>`;
      nav.dataset.locale = 'en';
    }

    _renderChroniclePane(dynasty) {
      this._id('dynasty-title').textContent = this.dynastyName(dynasty);
      this._id('dynasty-span').textContent = this.formatSpan(dynasty);
      this._id('dynasty-seat').textContent = this.dynastySeat(dynasty);
      this._id('dynasty-summary').textContent = this.dynastySummary(dynasty);
      this._syncDocumentSeoMeta();

      const ul = this._id('milestone-list');
      ul.innerHTML = '';
      for (const m of dynasty.milestones || []) {
        const li = document.createElement('li');
        const targetY = this._clampYearToDynasty(dynasty, m.year);
        const prevY = Math.max(dynasty.fromYear, targetY - 1);
        const targetSnapKey = this._resolveSnapKey(dynasty, targetY);
        const prevDyn = this.dynastyIdx > 0 ? this.dynasties[this.dynastyIdx - 1] : null;
        const prevSnapKey =
          m.year === dynasty.fromYear && prevDyn
            ? this._resolveSnapKey(prevDyn, prevDyn.toYear)
            : this._resolveSnapKey(dynasty, prevY);
        const snapShift =
          m.year === dynasty.fromYear ||
          targetSnapKey !== this._resolveSnapKey(dynasty, prevY);
        const cityShift =
          this._settlementMask(dynasty, targetY) !== this._settlementMask(dynasty, prevY);
        const corrShift = this.corridors.some((c) => c.span && c.span[0] === m.year);
        const hydroShift = this._hydroMask(targetY) !== this._hydroMask(prevY);
        const isMapChange = Boolean(m.isMapChange) || snapShift || cityShift || corrShift || hydroShift;
        const yrLabel =
          this.locale === 'en'
            ? this.formatYear(m.year)
            : `${m.year <= 0 ? '前' + -m.year : m.year} 年`;
        const badge = isMapChange
          ? `<span class="ev-map-tag" title="${this.locale === 'en' ? 'Map territory, city, or river course changes at this year' : '此节点触发版图、城池或河道水系变化'}">${SVG_ICONS.mapChange}</span>`
          : '';
        li.innerHTML = `<span class="ev-yr">${yrLabel}</span><span>${this.milestoneHeadline(dynasty, m)}${badge}</span>`;
        li.addEventListener('pointerenter', (e) => {
          if (e.pointerType === 'touch') return;
          if (targetSnapKey && targetSnapKey !== this.activeSnapKey) {
            this._previewStageGhost(targetSnapKey);
          } else if (snapShift && prevSnapKey && prevSnapKey !== this.activeSnapKey) {
            this._previewStageGhost(prevSnapKey);
          }
        });
        li.addEventListener('pointerleave', (e) => {
          if (e.pointerType !== 'touch') this._clearPreviewGhost();
        });
        li.addEventListener('click', () => {
          this.stopAutoplay();
          if (window.innerWidth <= 900 && this.mobileChronicleOpen) {
            this.toggleMobileChronicle(false);
          }
          this.jumpToYear(targetY);
          this.openMilestoneBalloon(dynasty, m);
          if (snapShift || m.isMapChange) {
            const defCam = this._getDefaultCamera();
            if (m.coord) {
              const [sx, sy] = this.projector.toScreen(m.coord[0], m.coord[1]);
              const outX = sx < defCam.x + defCam.w * 0.14 || sx > defCam.x + defCam.w * 0.86;
              const outY = sy < defCam.y + defCam.h * 0.16 || sy > defCam.y + defCam.h * 0.84;
              if (outX || outY) {
                this._animateCameraTo({
                  x: Math.max(40, Math.min(960 - defCam.w, sx - defCam.w * 0.5)),
                  y: Math.max(15, Math.min(685 - defCam.h, sy - defCam.h * 0.42)),
                  w: defCam.w,
                  h: defCam.h,
                });
              } else if (this.camera.w < defCam.w * 0.85) {
                this.resetCamera();
              }
            } else if (this.camera.w < defCam.w * 0.85) {
              this.resetCamera();
            }
          } else if (m.coord) {
            this._panToward(m.coord[0], m.coord[1]);
          }
        });
        ul.appendChild(li);
      }
      this._updateMobileChronicleBtn(dynasty);
      this._highlightCurrentMilestone(dynasty);
      if (this.locale === 'zh-tw') this._applyZhHantDom(this._id('chronicle-pane'));
    }

    _highlightCurrentMilestone(dynasty) {
      const listEl = this._id('milestone-list');
      if (!listEl) return;
      const items = listEl.children;
      if (!items.length) return;
      const activeIdx = this._activeMilestoneIndex(dynasty);
      Array.from(items).forEach((el, idx) =>
        el.classList.toggle('is-current', idx === activeIdx)
      );
      const pane = this._id('chronicle-pane');
      if (!pane) return;
      if (this._isMobileViewport() && !this.mobileChronicleOpen) {
        pane.scrollTop = 0;
        return;
      }
      if (activeIdx <= 0) {
        if (pane.scrollTop > 0) {
          pane.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
      if (activeIdx > 0 && items[activeIdx] && pane.scrollHeight > pane.clientHeight) {
        const el = items[activeIdx];
        const elTop = el.offsetTop - pane.offsetTop;
        const targetTop = Math.max(0, elTop - pane.clientHeight * 0.42);
        pane.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    }

    // ---------------- Place Genealogy (Trace Place) ----------------
    toggleGenealogySheetExpand(force) {
      const cardEl = this._id('genealogy-card');
      const btnEl = this._id('act-expand-genealogy');
      const next =
        typeof force === 'boolean'
          ? force
          : Boolean(cardEl && !cardEl.classList.contains('is-sheet-expanded'));
      this.genealogySheetExpanded = next;
      if (cardEl && cardEl.classList) {
        cardEl.classList.toggle('is-sheet-expanded', next);
      }
      if (btnEl) {
        btnEl.textContent = next ? '⤡' : '⤢';
        btnEl.setAttribute('aria-expanded', String(next));
        if (btnEl.classList) btnEl.classList.toggle('is-active', next);
      }
    }

    _clearActiveTrace() {
      this.activeTrace = null;
      this.activeTraceLabel = '';
      this.activeReturnPerson = null;
      if (this.grpGenealogy) this.grpGenealogy.innerHTML = '';
      if (this.grpSettlements && typeof this.grpSettlements.querySelectorAll === 'function') {
        this.grpSettlements
          .querySelectorAll('.settlement-node.is-trace-city')
          .forEach((el) => el.classList.remove('is-trace-city'));
      }
      this._syncTracedPrefecture();
    }

    _clearActivePerson() {
      const hadTimer = Boolean(this.personTimer);
      if (this.personTimer) {
        clearInterval(this.personTimer);
        this.personTimer = null;
      }
      if (hadTimer) this._updateAutoplayUi();
      if (!this.activePerson) return;
      this.activePerson = null;
      this.activePersonEventIdx = -1;
      this._lastPersonPinZoom = 0;
      if (this.grpJourney && !this.activeCustomRoute) {
        this.grpJourney.innerHTML = '';
      }
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.remove('has-active-person');
      const kickerEl = this._id('txt-genealogy-kicker');
      if (kickerEl) {
        kickerEl.textContent = this.uiStr('trace_kicker', '点地溯源 · 古今政区沿革');
      }
      this._syncImmersivePaneState();
      this._syncDocumentSeoMeta();
    }

    closeGenealogyCard() {
      this._clearActiveTrace();
      this._clearActivePerson();
      this.toggleGenealogySheetExpand(false);
      const cardEl = this._id('genealogy-card');
      if (cardEl) cardEl.classList.add('is-hidden');
      const loreEl = this._id('genealogy-lore');
      if (loreEl) {
        loreEl.innerHTML = '';
        loreEl.classList.add('is-hidden');
      }
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.remove('has-active-genealogy');
      this._syncMobileOverlayState();
      if (Array.isArray(this.activeCustomRoute) && this.customRouteStopIdx >= 0) {
        this.customRouteStopIdx = -1;
        this._drawCustomRouteOverlay(this.activeCustomRoute);
        this._renderCustomRouteCard();
      }
      if (this.activeMilestone) this._positionMilestoneBalloon();
    }

    static get PERSON_PROFILES() {
      return (window.ATLAS_LORE_DATA && window.ATLAS_LORE_DATA.PERSON_PROFILES) || [];
    }

    _personSearchAliases(p) {
      const out = [p.key, ...(p.aliases || [])].filter(Boolean);
      if (p.courtesyEn) {
        const roleRe =
          /\b(general|marshal|minister|chancellor|historian|statesman|poet|master|author|founder|leader|commander|protector|adviser|strategist|admiral|commissioner|architect|governor|reformer|king|prince|lord|marquis|duke|instigator|recoverer|conqueror|empress\s+regnant)\b/i;
        for (const seg of p.courtesyEn.split(/[,·/()]+/)) {
          const clean = seg.trim();
          if (clean.length >= 4 && !roleRe.test(clean)) out.push(clean);
        }
      }
      return out.map((a) => String(a).toLowerCase());
    }

    _resolvePersonProfile(personOrQuery) {
      if (!personOrQuery) return null;
      if (typeof personOrQuery === 'object' && personOrQuery.zh) return personOrQuery;
      const rawInput = String(personOrQuery).trim();
      if (!rawInput) return null;
      const raw = /[\u4e00-\u9fff]/.test(rawInput) ? this._toHans(rawInput) : rawInput;
      const qLow = raw.toLowerCase();
      const fold = (s) =>
        String(s || '')
          .toLowerCase()
          .replace(/['’‘`\-_.\s]+/g, '');
      const qFold = fold(qLow);
      const profiles = HistoricalAtlasController.PERSON_PROFILES;
      const exact = profiles.find((p) => {
        const aliases = this._personSearchAliases(p);
        return (
          p.key === qLow ||
          p.zh.toLowerCase() === qLow ||
          (p.en && (p.en.toLowerCase() === qLow || (qFold.length >= 3 && fold(p.en) === qFold))) ||
          aliases.some((a) => a === qLow || (qFold.length >= 3 && fold(a) === qFold))
        );
      });
      if (exact) return exact;
      const partial = profiles.find((p) => {
        const aliases = this._personSearchAliases(p);
        return (
          p.zh.includes(raw) ||
          (p.en && p.en.toLowerCase().includes(qLow)) ||
          aliases.some((a) => a.includes(qLow))
        );
      });
      if (partial) return partial;
      // Dynamic zero-config fallback for any historical name in milestones / landmarks / era spans
      let spanMin = -403;
      let spanMax = 2026;
      let courtesyZh = '';
      let courtesyEn = '';
      const matchingSpans = HistoricalAtlasController.CHINESE_ERA_SPANS.filter(
        (sp) => sp[3] && (sp[3] === raw || sp[3].includes(raw))
      );
      if (matchingSpans.length) {
        spanMin = matchingSpans[0][0] - 40;
        const lastIdx = HistoricalAtlasController.CHINESE_ERA_SPANS.indexOf(
          matchingSpans[matchingSpans.length - 1]
        );
        spanMax =
          lastIdx + 1 < HistoricalAtlasController.CHINESE_ERA_SPANS.length
            ? HistoricalAtlasController.CHINESE_ERA_SPANS[lastIdx + 1][0] + 2
            : 1949;
        courtesyZh = matchingSpans[0][3];
        courtesyEn = matchingSpans[0][4] || '';
      }
      const adhoc = {
        key: `adhoc_${raw}`,
        zh: raw,
        en: courtesyEn || this.trTerm(raw),
        courtesyZh: courtesyZh && courtesyZh !== raw ? courtesyZh : '历史人物纪事',
        courtesyEn: courtesyEn || 'Historical Figure',
        dynastyKey: null,
        span: [spanMin, spanMax],
        aliases: [],
        tokens: [raw],
      };
      return this._collectPersonEvents(adhoc).length ? adhoc : null;
    }

    _formatPersonSpan(span, isAdhoc = false) {
      if (!span || isAdhoc || span.length < 2) return '';
      const [y0, y1] = span;
      if (y0 === undefined || y1 === undefined) return '';
      if (this.locale === 'en') {
        if (y0 <= 0 && y1 <= 0) return ` (${-y0}–${-y1} BCE)`;
        if (y0 <= 0 && y1 > 0) return ` (${-y0} BCE – ${y1} CE)`;
        return ` (${y0}–${y1})`;
      }
      const fZh = (y) => (y <= 0 ? `前${-y}` : `${y}`);
      return `（${fZh(y0)}—${fZh(y1)}）`;
    }

    _collectPersonEvents(profile) {
      if (!profile) return [];
      const tokens = Array.from(new Set([profile.zh, ...(profile.tokens || [])].filter(Boolean)));
      const [minY, maxY] = profile.span || [-403, 2026];
      const raw = [];

      if (profile.journeyKey) {
        const j = HistoricalAtlasController.HISTORICAL_JOURNEYS.find(
          (item) => item.key === profile.journeyKey
        );
        if (j) {
          j.stops.forEach((st, sIdx) => {
            const dyn =
              this.dynasties[this._findDynastyIndex(st.year)] || this.dynasties[0];
            raw.push({
              src: 'J',
              year: st.year,
              month: st.month || 6 + sIdx * 0.05,
              coord: st.coord,
              fromCoord: st.fromCoord || null,
              via: st.via || null,
              prevStopCoord: sIdx > 0 ? j.stops[sIdx - 1].coord : null,
              quoteZh: st.quoteZh || '',
              quoteEn: st.quoteEn || '',
              dynasty: dyn,
              siteZh: st.ancientZh,
              siteEn: st.ancientEn || this._enDict(st.ancientZh),
              modernZh: st.modernZh || '',
              modernEn: st.modernEn || '',
              textZh: `${st.titleZh}：${st.descZh}`,
              textEn: `${st.titleEn}: ${st.descEn}`,
              isMapChange: false,
              journeyStopIdx: sIdx,
              prio: 3,
            });
          });
        }
      }

      for (const d of this.dynasties) {
        for (const m of d.milestones || []) {
          if (!m.coord || m.year < minY - 2 || m.year > maxY + 3) continue;
          if (!tokens.some((tok) => m.headline.includes(tok))) continue;
          const rawSite = m.site || d.seat || '';
          const mKey = `${d.key}:${m.year}`;
          const mHit = this.enLocale.milestones && this.enLocale.milestones[mKey];
          const siteEn =
            m.siteEn ||
            (Array.isArray(mHit) && mHit[1]) ||
            (d.key === 'roc' || d.key === 'prc'
              ? this._enModernCity(rawSite)
              : this._enDict(rawSite));
          raw.push({
            src: 'M',
            year: m.year,
            month: m.month || 6.5,
            coord: m.coord,
            dynasty: d,
            siteZh: rawSite,
            siteEn,
            modernZh: '',
            modernEn: '',
            textZh: m.headline,
            textEn: this._enMilestoneHeadline(d, m),
            isMapChange: Boolean(m.isMapChange),
            milestone: m,
            prio: 2,
          });
        }
      }

      for (const lm of HistoricalAtlasController.PLACE_LANDMARK_EVENTS) {
        if (!lm.coord || !lm.zh || lm.year < minY - 2 || lm.year > maxY + 3) continue;
        if (!tokens.some((tok) => lm.zh.includes(tok))) continue;
        const d =
          this.dynasties.find((dyn) => dyn.key === lm.dynastyKey) ||
          this.dynasties[this._findDynastyIndex(lm.year)] ||
          this.dynasties[0];
        raw.push({
          src: 'L',
          year: lm.year,
          month: lm.month || 6.5,
          coord: lm.coord,
          dynasty: d,
          siteZh: lm.site || '',
          siteEn: lm.siteEn || this._enDict(lm.site || ''),
          modernZh: '',
          modernEn: '',
          textZh: lm.zh,
          textEn: lm.en || lm.zh,
          isMapChange: false,
          prio: 1,
        });
      }

      raw.sort(
        (a, b) =>
          a.year - b.year || (a.month || 6.5) - (b.month || 6.5) || b.prio - a.prio
      );
      const deduped = [];
      for (const ev of raw) {
        const dup = deduped.find((prev) => {
          const dy = Math.abs(prev.year - ev.year);
          if (dy > 1) return false;
          const km = this.projector.greatCircleKm(prev.coord, ev.coord);
          if (prev.src === ev.src) {
            if (ev.src === 'J') return false;
            if (ev.src === 'M') return prev.year === ev.year && km < 45;
            return prev.year === ev.year && km < 35;
          }
          return (prev.year === ev.year && km < 65) || (dy <= 1 && km < 25);
        });
        if (dup) {
          if (ev.isMapChange) dup.isMapChange = true;
          if (ev.milestone && !dup.milestone) dup.milestone = ev.milestone;
          continue;
        }
        deduped.push(ev);
      }
      return deduped;
    }

    openPersonChronicle(personOrQuery, initialIdx = -1) {
      const profile = this._resolvePersonProfile(personOrQuery);
      if (!profile) return false;
      const events = this._collectPersonEvents(profile);
      if (!events.length) return false;

      if (!this._fullSnapshotsLoaded) {
        this._ensureFullSnapshots().then(() => {
          if (this.activePerson && this.activePerson.profile.key === profile.key) {
            this._renderPersonChronicleCard(true);
          }
        });
      }
      if (
        this.locale === 'en' &&
        (!this.enLocale || !this.enLocale.dict || !Object.keys(this.enLocale.dict).length)
      ) {
        this._ensureEnglishLocale().then(() => {
          if (this.activePerson && this.activePerson.profile.key === profile.key) {
            this.activePerson.events = this._collectPersonEvents(profile);
            this._renderPersonPinsOverlay();
            this._renderPersonChronicleCard(true);
          }
        });
      }

      this._recordGestureClick();
      this._dismissTraceOnboarding();
      this.stopAutoplay();
      if (this.challenge) this.stopChallenge(true);
      this.clearCustomRoute();
      this.closeMilestoneBalloon();
      this._clearActiveTrace();
      if (this.hoverTip) {
        this.hoverTip.classList.add('is-hidden');
        this.hoverTip.classList.remove('is-interactive');
      }

      this.activePerson = { profile, events };
      this.activePersonEventIdx =
        initialIdx >= 0 && initialIdx < events.length ? initialIdx : -1;

      const cardEl = this._id('genealogy-card');
      if (cardEl) cardEl.classList.remove('is-hidden');
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.add('has-active-genealogy', 'has-active-person');
      this._syncImmersivePaneState();

      const anchorEv =
        this.activePersonEventIdx >= 0 ? events[this.activePersonEventIdx] : events[0];
      if (anchorEv) {
        this.jumpToYear(this._clampYearToDynasty(anchorEv.dynasty, anchorEv.year));
      }

      this._renderPersonPinsOverlay();
      this._renderPersonChronicleCard();
      this._syncDocumentSeoMeta();

      if (this.activePersonEventIdx >= 0) {
        this._flyToPersonEvent(events[this.activePersonEventIdx]);
      } else {
        this._framePersonOverview();
      }
      return true;
    }

    openJourneyAsPerson(journeyKey, stopIdx = -1) {
      if (!this.openPersonChronicle(journeyKey, -1)) return false;
      if (stopIdx >= 0 && this.activePerson && this.activePerson.events.length) {
        const matchIdx = this.activePerson.events.findIndex((ev) => ev.journeyStopIdx === stopIdx);
        const targetIdx =
          matchIdx >= 0 ? matchIdx : Math.min(this.activePerson.events.length - 1, stopIdx);
        this.selectPersonEvent(targetIdx, true);
      }
      return true;
    }

    _personAutoplayTick() {
      if (!this.activePerson || this.activePersonEventIdx + 1 >= this.activePerson.events.length) {
        if (this.personTimer) {
          clearInterval(this.personTimer);
          this.personTimer = null;
        }
        this._updateAutoplayUi();
        return;
      }
      this.selectPersonEvent(this.activePersonEventIdx + 1, true);
    }

    togglePersonAutoplay() {
      if (!this.activePerson || !this.activePerson.events.length) return;
      if (this.personTimer) {
        clearInterval(this.personTimer);
        this.personTimer = null;
        this._updateAutoplayUi();
        return;
      }
      if (this.playing) {
        this.stopAutoplay();
      }
      if (this.activePersonEventIdx < 0) {
        this.selectPersonEvent(0, true);
      }
      this.personTimer = setInterval(
        () => this._personAutoplayTick(),
        this._personAutoplayIntervalMs()
      );
      this._updateAutoplayUi();
    }

    selectPersonEvent(idx, panCamera = true) {
      if (!this.activePerson || !this.activePerson.events.length) return;
      const events = this.activePerson.events;
      if (idx < 0) {
        this.activePersonEventIdx = -1;
        this._renderPersonPinsOverlay();
        this._renderPersonChronicleCard(true);
        if (panCamera) this._framePersonOverview();
        return;
      }
      const clamped = Math.max(0, Math.min(events.length - 1, idx));
      this.activePersonEventIdx = clamped;
      const ev = events[clamped];
      this.closeMilestoneBalloon();
      this.jumpToYear(this._clampYearToDynasty(ev.dynasty, ev.year));
      this._renderPersonPinsOverlay();
      this._renderPersonChronicleCard(true);
      if (panCamera) this._flyToPersonEvent(ev);
    }

    stepPersonEvent(delta) {
      if (!this.activePerson || !this.activePerson.events.length) return;
      const len = this.activePerson.events.length;
      const nextIdx =
        this.activePersonEventIdx < 0
          ? delta >= 0
            ? 0
            : len - 1
          : (this.activePersonEventIdx + delta + len) % len;
      this.selectPersonEvent(nextIdx, true);
    }

    _getPersonVisibleTopFrac() {
      if (typeof window === 'undefined' || window.innerWidth > 900) return 1;
      const vf = this._id('viewport-frame');
      const cardEl = this._id('genealogy-card');
      if (
        vf &&
        cardEl &&
        typeof vf.getBoundingClientRect === 'function' &&
        typeof cardEl.getBoundingClientRect === 'function' &&
        !cardEl.classList.contains('is-hidden')
      ) {
        const vfRect = vf.getBoundingClientRect();
        const cRect = cardEl.getBoundingClientRect();
        if (vfRect.height > 80 && cRect.height > 20 && cRect.top > vfRect.top + vfRect.height * 0.2) {
          return Math.max(0.38, Math.min(0.9, (cRect.top - vfRect.top - 10) / vfRect.height));
        }
      }
      return this.genealogySheetExpanded ? 0.38 : 0.56;
    }

    _framePersonOverview() {
      if (!this.activePerson || !this.activePerson.events.length) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const ev of this.activePerson.events) {
        const [sx, sy] = this.projector.toScreen(ev.coord[0], ev.coord[1]);
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;
      }
      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5;
      const aspect = this._getViewportAspect();
      const isDesktop = typeof window === 'undefined' || window.innerWidth > 900;
      if (!isDesktop) {
        const visTopFrac = this._getPersonVisibleTopFrac();
        const availFrac = Math.max(0.32, visTopFrac - 0.1);
        const midFrac = 0.055 + availFrac * 0.5;
        const effAspect = Math.max(0.34, aspect * availFrac);
        const spanW = Math.max(maxX - minX + 125, (maxY - minY + 86) / effAspect) * 1.12;
        const w = Math.max(300, Math.min(1380, spanW));
        const h = w * aspect;
        this._animateCameraTo({ x: cx - w * 0.5, y: cy - h * midFrac, w, h });
        return;
      }
      const spanW =
        Math.max((maxX - minX + 115) / 0.45, (maxY - minY + 115) / (aspect * 0.84)) * 1.06;
      const w = Math.max(340, Math.min(1060, spanW));
      const h = w * aspect;
      this._animateCameraTo({
        x: Math.max(-160, Math.min(1000 - w * 0.55, cx - w * 0.475)),
        y: Math.max(-110, Math.min(700 - h + 130, cy - h * 0.46)),
        w,
        h,
      });
    }

    _flyToPersonEvent(ev) {
      if (!ev || !ev.coord) return;
      const [tx, ty] = this.projector.toScreen(ev.coord[0], ev.coord[1]);
      const aspect = this._getViewportAspect();
      const isDesktop = typeof window === 'undefined' || window.innerWidth > 900;
      if (!isDesktop) {
        const visTopFrac = this._getPersonVisibleTopFrac();
        const w = Math.max(320, Math.min(this.camera.w, 460));
        const h = w * aspect;
        this._animateCameraTo({ x: tx - w * 0.5, y: ty - h * (visTopFrac * 0.5), w, h });
        return;
      }
      const w = Math.max(340, Math.min(this.camera.w, 500));
      const h = w * aspect;
      this._animateCameraTo({ x: tx - w * 0.38, y: ty - h * 0.48, w, h });
    }

    _findNearestPersonPin(clientX, clientY, maxPx = 26) {
      if (!this.activePerson || !this.grpJourney || !this.svg) return null;
      const rect = this.svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const screenScale = Math.min(rect.width / this.camera.w, rect.height / this.camera.h);
      const padX = (rect.width - this.camera.w * screenScale) * 0.5;
      const padY = (rect.height - this.camera.h * screenScale) * 0.5;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const z = 1000 / this.camera.w;
      const boost = vw <= 640 ? 1.46 : vw <= 900 ? 1.22 : 1.0;
      const localToPx = Math.max((1 / Math.sqrt(z)) * boost, 0.92 / Math.max(0.12, screenScale)) * screenScale;

      let bestNode = null;
      let bestDist = maxPx;
      this.grpJourney.querySelectorAll('.journey-node').forEach((jn) => {
        const sx = parseFloat(jn.getAttribute('data-x'));
        const sy = parseFloat(jn.getAttribute('data-y'));
        const ox = parseFloat(jn.getAttribute('data-ox') || '0');
        const oy = parseFloat(jn.getAttribute('data-oy') || '0');
        if (Number.isNaN(sx) || Number.isNaN(sy)) return;
        const px = rect.left + padX + (sx - this.camera.x) * screenScale + ox * localToPx;
        const py = rect.top + padY + (sy - this.camera.y) * screenScale + oy * localToPx;
        const d = Math.hypot(clientX - px, clientY - py);
        if (d <= bestDist) {
          bestDist = d;
          bestNode = jn;
        }
      });
      return bestNode;
    }

    _renderPersonPinsOverlay() {
      if (!this.grpJourney) return;
      this.grpJourney.innerHTML = '';
      if (!this.activePerson) return;

      const { events } = this.activePerson;
      const curIdx = this.activePersonEventIdx;
      const rawPts = events.map((ev) => this.projector.toScreen(ev.coord[0], ev.coord[1]));

      // Compute zoom-invariant screen-space cluster offsets so co-located pins (e.g. Chang'an ① ②)
      // never overlap at ANY zoom level on Desktop or Mobile while preserving exact data-x/data-y
      // for _rescaleSvgTypography's automatic city label culling.
      const clusters = rawPts.map(([sx, sy], i) => {
        const peers = [];
        rawPts.forEach(([ox, oy], j) => {
          if (Math.hypot(ox - sx, oy - sy) < 6.5) peers.push(j);
        });
        if (peers.length <= 1) {
          return { ox: 0, oy: 0, ringR: 0, isPrimary: true, peers };
        }
        const pos = peers.indexOf(i);
        if (peers.length === 2) {
          return { ox: pos === 0 ? -8.6 : 8.6, oy: 0, ringR: 2, isPrimary: pos === 0, peers };
        }
        const ringR = Math.max(9.6, 8.3 / Math.sin(Math.PI / peers.length));
        const angle = -Math.PI * 0.75 + (pos / peers.length) * Math.PI * 2;
        return {
          ox: Math.cos(angle) * ringR,
          oy: Math.sin(angle) * ringR,
          ringR,
          isPrimary: pos === 0,
          peers,
        };
      });

      // 1. Render understated cartographic trajectory arcs + directional chevrons below pins
      const accentColor = '#bd2d22';
      const segments = [];
      for (let i = 0; i < events.length - 1; i++) {
        const prevEv = events[i];
        const nextEv = events[i + 1];
        const keepsCuratedLeg =
          Boolean(nextEv.via || nextEv.fromCoord) &&
          nextEv.prevStopCoord &&
          Math.hypot(
            prevEv.coord[0] - nextEv.prevStopCoord[0],
            prevEv.coord[1] - nextEv.prevStopCoord[1]
          ) < 1.2;
        const segInfo = this._buildJourneySegmentInfo(
          keepsCuratedLeg && nextEv.fromCoord ? nextEv.fromCoord : prevEv.coord,
          nextEv.coord,
          keepsCuratedLeg ? nextEv.via : null
        );
        if (segInfo) {
          segments.push({ ...segInfo, toIdx: i + 1 });
        }
      }
      this._renderCartographicTrajectory(segments, curIdx, accentColor);

      const order = events
        .map((_, idx) => idx)
        .sort((a, b) => (a === curIdx ? 1 : b === curIdx ? -1 : a - b));

      for (const idx of order) {
        const ev = events[idx];
        const [sx, sy] = rawPts[idx];
        const cl = clusters[idx];
        const isCur = idx === curIdx;
        const stateCls =
          curIdx < 0 ? 'is-passed' : isCur ? 'is-current' : idx < curIdx ? 'is-passed' : 'is-upcoming';
        const g = this._svgNode(
          'g',
          {
            class: `journey-node ${stateCls}`,
            'data-x': sx.toFixed(1),
            'data-y': sy.toFixed(1),
            'data-ox': cl.ox.toFixed(2),
            'data-oy': cl.oy.toFixed(2),
            'data-stop-idx': String(idx),
          },
          this.grpJourney
        );
        g.style.color = accentColor;

        const inner = this._svgNode(
          'g',
          {
            class: 'jn-pin-shift',
            transform: `translate(${cl.ox.toFixed(2)},${cl.oy.toFixed(2)})`,
          },
          g
        );

        this._svgNode('circle', { class: 'jn-hit', r: 14, fill: 'transparent' }, inner);
        if (isCur) {
          this._svgNode('circle', { class: 'jn-pulse', r: 11.2 }, inner);
        }
        this._svgNode('circle', { class: 'jn-disc', r: isCur ? 7.6 : 5.8 }, inner);
        const numTxt = this._svgNode('text', { class: 'jn-num', y: '0.5' }, inner);
        numTxt.textContent = String(idx + 1);

        const clusterHasCur = curIdx >= 0 && cl.peers.includes(curIdx);
        const ownsClusterLabel = isCur || (!clusterHasCur && cl.isPrimary);
        if (ownsClusterLabel) {
          const fullLbl =
            this.locale === 'en' ? ev.siteEn || this.trTerm(ev.siteZh) : this._zh(ev.siteZh);
          const compactLbl = isCur
            ? fullLbl
            : fullLbl.replace(/\s*[（(][^）)]*[）)]\s*/g, '').trim() || fullLbl;
          const lblTxt = this._svgNode(
            'text',
            { class: 'jn-label', x: '0', y: '-11.5' },
            inner
          );
          lblTxt.textContent = compactLbl;
        }
      }

      this._rescaleSvgTypography();
    }

    _setHoveredPersonPin(idx) {
      if (!this.grpJourney) return;
      this.grpJourney.querySelectorAll('.journey-node').forEach((jn) => {
        jn.classList.toggle('is-hover-pin', Number(jn.dataset.stopIdx) === idx);
      });
    }

    _renderPersonChronicleCard(preserveScroll = false) {
      if (!this.activePerson) return;
      const { profile, events } = this.activePerson;
      const curIdx = this.activePersonEventIdx;
      const isEn = this.locale === 'en';
      const isAdhoc = String(profile.key || '').startsWith('adhoc_');

      const kickerEl = this._id('txt-genealogy-kicker');
      if (kickerEl) {
        kickerEl.textContent = isEn
          ? 'Person Chronicle · Life Across Time & Space'
          : '点人溯事 · 人物生平纪事';
      }

      const spanStr = this._formatPersonSpan(profile.span, isAdhoc);
      const headingEl = this._id('genealogy-heading');
      if (headingEl) {
        headingEl.textContent = `${isEn ? profile.en : profile.zh}${spanStr}`;
      }

      const loreEl = this._id('genealogy-lore');
      if (loreEl) {
        const subTitle = isEn ? profile.courtesyEn || '' : profile.courtesyZh || '';
        const enAliases = (profile.aliases || []).filter((a) => !/[\u4e00-\u9fff]/.test(a));
        const aliasHint = isEn
          ? enAliases.length
            ? `Also searched as: ${enAliases.slice(0, 4).join(' · ')}`
            : ''
          : profile.aliases && profile.aliases.length
            ? `字号 / 检索词：${profile.aliases.slice(0, 4).join(' · ')}`
            : '';
        if (subTitle || aliasHint) {
          loreEl.innerHTML =
            `<div class="pass-lore-head"><span class="pass-lore-badge">${
              isEn ? 'Biography' : '人物小传'
            }</span><span class="pass-lore-range">${subTitle}</span></div>` +
            (aliasHint ? `<div class="pass-lore-desc">${aliasHint}</div>` : '');
          loreEl.classList.remove('is-hidden');
        } else {
          loreEl.innerHTML = '';
          loreEl.classList.add('is-hidden');
        }
      }

      const dynCount = new Set(events.map((e) => e.dynasty.key)).size;
      const subEl = this._id('genealogy-sub');
      if (subEl) {
        const summaryTxt = isEn
          ? `${events.length} events · ${dynCount} era${dynCount > 1 ? 's' : ''}`
          : `共 ${events.length} 处史事 · 历 ${dynCount} 朝`;
        subEl.innerHTML =
          `<span>${summaryTxt}</span>` +
          `<span class="person-sub-actions">` +
          `<button type="button" class="gen-filter-pill" id="act-person-prev" aria-label="${
            isEn ? 'Previous event' : '上一处史事'
          }" title="${isEn ? 'Previous event' : '上一处史事'}">${SVG_ICONS.arrowLeft}</button>` +
          `<button type="button" class="gen-filter-pill${
            curIdx < 0 ? ' is-active' : ''
          }" id="act-person-overview">${isEn ? 'Overview' : '全图总览'}</button>` +
          `<button type="button" class="gen-filter-pill" id="act-person-next" aria-label="${
            isEn ? 'Next event' : '下一处史事'
          }" title="${isEn ? 'Next event' : '下一处史事'}">${SVG_ICONS.arrowRight}</button>` +
          `</span>`;

        const prevBtn = this._id('act-person-prev');
        if (prevBtn) prevBtn.addEventListener('click', () => this.stepPersonEvent(-1));
        const nextBtn = this._id('act-person-next');
        if (nextBtn) nextBtn.addEventListener('click', () => this.stepPersonEvent(1));
        const ovBtn = this._id('act-person-overview');
        if (ovBtn) ovBtn.addEventListener('click', () => this.selectPersonEvent(-1, true));
      }

      const listEl = this._id('genealogy-timeline');
      const scrollEl = this._id('genealogy-body') || listEl;
      const prevScroll = scrollEl ? scrollEl.scrollTop : 0;
      if (!listEl) return;
      listEl.innerHTML = '';

      let activeLi = null;
      events.forEach((ev, idx) => {
        const li = document.createElement('li');
        li.className = 'person-ev-row' + (idx === curIdx ? ' is-current' : '');
        if (idx === curIdx) activeLi = li;

        const yrStr = isEn
          ? this.formatYear(ev.year)
          : `${ev.year <= 0 ? '前' + -ev.year : ev.year}年`;
        const siteLabel = isEn
          ? ev.siteEn || this.trTerm(ev.siteZh)
          : ev.siteZh + (ev.modernZh && !ev.siteZh.includes(ev.modernZh) ? `（今${ev.modernZh}）` : '');
        const mapBadge = ev.isMapChange
          ? `<span class="ev-map-tag" title="${
              isEn ? 'Territory shift at this year' : '此节点触发版图演变'
            }">${SVG_ICONS.mapChange}</span>`
          : '';
        const traceBtn = `<button type="button" class="ev-journey-btn person-place-btn" data-idx="${idx}">${
          isEn ? 'Place ›' : '沿革 ›'
        }</button>`;

        const quoteTxt = isEn ? ev.quoteEn || '' : ev.quoteZh || '';
        const quoteHtml = quoteTxt ? `<span class="person-ev-quote">${quoteTxt}</span>` : '';

        li.innerHTML =
          `<span class="t-era person-era-col">` +
          `<span class="person-idx-line"><span class="cr-stop-num">${idx + 1}</span><span>${yrStr}</span></span>` +
          `<span class="t-sub">${this.dynastyName(ev.dynasty)}</span>` +
          `</span>` +
          `<span class="t-val">` +
          `<span class="person-site-line"><span>${siteLabel}${mapBadge}</span>${traceBtn}</span>` +
          `<span class="t-sub person-ev-copy">${isEn ? ev.textEn : ev.textZh}</span>` +
          `${quoteHtml}` +
          `</span>`;

        li.addEventListener('pointerenter', (e) => {
          if (e.pointerType !== 'touch') this._setHoveredPersonPin(idx);
        });
        li.addEventListener('pointerleave', (e) => {
          if (e.pointerType !== 'touch') this._setHoveredPersonPin(-1);
        });
        li.addEventListener('click', () => {
          this.selectPersonEvent(idx, true);
        });
        const traceBtnEl = li.querySelector('.person-place-btn');
        if (traceBtnEl) {
          traceBtnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const savedReturn = { profile, eventIdx: idx };
            this.jumpToYear(this._clampYearToDynasty(ev.dynasty, ev.year));
            this.openGenealogyAt(ev.coord[0], ev.coord[1], ev.siteZh, {
              returnPerson: savedReturn,
            });
          });
        }
        listEl.appendChild(li);
      });

      if (scrollEl) {
        if (activeLi && typeof activeLi.scrollIntoView === 'function') {
          activeLi.scrollIntoView({ block: 'nearest' });
        } else if (preserveScroll) {
          scrollEl.scrollTop = prevScroll;
        } else {
          scrollEl.scrollTop = 0;
        }
      }
      if (this.locale === 'zh-tw') this._applyZhHantDom(this._id('genealogy-card'));
    }

    _syncTracedPrefecture() {
      if (!this.grpPrefectures || typeof this.grpPrefectures.querySelectorAll !== 'function') {
        return;
      }
      this.grpPrefectures
        .querySelectorAll('.prefecture-shape.is-traced')
        .forEach((el) => el.classList.remove('is-traced'));
      const cardEl = this._id('genealogy-card');
      if (!this.activeTrace || (cardEl && cardEl.classList.contains('is-hidden'))) {
        return;
      }
      const [lng, lat] = this.activeTrace;
      const snap = this.lastRenderedSnap;
      if (!snap || !Array.isArray(snap.prefectures)) return;
      let matchedPrefTitle = '';
      for (const pref of snap.prefectures) {
        if (pref && pref.title && MercatorProjector.pointInShape(lng, lat, pref.shape)) {
          matchedPrefTitle = pref.title;
          break;
        }
      }
      if (!matchedPrefTitle) return;
      this.grpPrefectures.querySelectorAll('.prefecture-shape').forEach((el) => {
        if (el.dataset && el.dataset.prefTitle === matchedPrefTitle) {
          el.classList.add('is-traced');
          if (el.parentNode && typeof el.parentNode.insertBefore === 'function') {
            const regCasing = el.parentNode.querySelector('.region-shape-casing, .region-caption');
            if (regCasing) {
              el.parentNode.insertBefore(el, regCasing);
            } else if (typeof el.parentNode.appendChild === 'function') {
              el.parentNode.appendChild(el);
            }
          }
        }
      });
    }

    static get PLACE_LANDMARK_EVENTS() {
      return (window.ATLAS_LORE_DATA && window.ATLAS_LORE_DATA.PLACE_LANDMARK_EVENTS) || [];
    }

    static get STRATEGIC_PASSES() {
      return (window.ATLAS_LORE_DATA && window.ATLAS_LORE_DATA.STRATEGIC_PASSES) || [];
    }

    static get PLACE_GAZETTEER() {
      return (window.ATLAS_LORE_DATA && window.ATLAS_LORE_DATA.PLACE_GAZETTEER) || [];
    }

    static get CITY_LORE() {
      return (window.ATLAS_LORE_DATA && window.ATLAS_LORE_DATA.CITY_LORE) || [];
    }

    _resolvePlaceLoreBanner(lng, lat, matchedPass, identityModern, rowsData) {
      if (matchedPass) {
        return {
          badge: this.locale === 'en' ? 'Strategic Pass' : '雄关形胜',
          tag: this.locale === 'en' ? matchedPass.rangeEn : matchedPass.rangeZh,
          desc: this.locale === 'en' ? matchedPass.chokepointEn : matchedPass.chokepointZh,
          tagEn: matchedPass.rangeEn,
          descEn: matchedPass.chokepointEn,
        };
      }
      let bestCity = null;
      let bestKm = 28;
      for (const c of HistoricalAtlasController.CITY_LORE) {
        if (!Array.isArray(c.coord)) continue;
        const km = this.projector.greatCircleKm([lng, lat], c.coord);
        const modMatch =
          identityModern &&
          c.modern &&
          (c.modern === identityModern ||
            identityModern.startsWith(c.modern) ||
            c.modern.startsWith(identityModern)) &&
          km <= 42;
        if (km <= bestKm || (modMatch && km < bestKm + 15)) {
          bestKm = Math.min(bestKm, km);
          bestCity = c;
        }
      }
      if (bestCity) {
        return {
          badge: this.locale === 'en' ? 'Historic City' : '名城形胜',
          tag: this.locale === 'en' ? bestCity.tagEn : bestCity.tagZh,
          desc: this.locale === 'en' ? bestCity.descEn : bestCity.descZh,
          tagEn: bestCity.tagEn,
          descEn: bestCity.descEn,
        };
      }

      const preModRows = rowsData
        ? rowsData.filter(
            (r) => r.d && r.d.key !== 'roc' && r.d.key !== 'prc' && r.near && r.near.km < 25
          )
        : (this.dynasties || [])
            .filter((dyn) => dyn.key !== 'roc' && dyn.key !== 'prc')
            .map((dyn) => ({
              d: dyn,
              near: this._findNearestSettlement(dyn.settlements, lng, lat, 25),
            }))
            .filter((r) => r.near && r.near.km < 25);
      if (!preModRows.length) return null;
      const gazHit =
        HistoricalAtlasController.PLACE_GAZETTEER.find(
          (g) => Array.isArray(g.coord) && this.projector.greatCircleKm([lng, lat], g.coord) <= 22
        ) || null;

      const isEn = this.locale === 'en';
      const modCompareEn = identityModern
        ? String(this._enModernCity(identityModern) || '').trim()
        : '';
      const ancNamesZh = [];
      const ancNamesEn = [];
      const addAncName = (raw) => {
        if (!raw) return;
        const rawTrim = String(raw).trim();
        const cleanZh = rawTrim.replace(/（.*?）|\(.*?\)/g, '').trim();
        if (cleanZh && cleanZh !== identityModern && !ancNamesZh.includes(cleanZh)) {
          ancNamesZh.push(cleanZh);
        }
        const enRaw = this._enDict(rawTrim);
        const cleanEn = String(enRaw || '').replace(/（.*?）|\(.*?\)/g, '').trim();
        if (
          cleanEn &&
          !/[\u4e00-\u9fa5]/.test(cleanEn) &&
          cleanEn !== identityModern &&
          cleanEn !== modCompareEn &&
          !ancNamesEn.includes(cleanEn)
        ) {
          ancNamesEn.push(cleanEn);
        }
      };
      for (const r of preModRows) {
        addAncName(r.near.s.ancient);
      }
      if (gazHit) {
        addAncName(gazHit.name);
        for (const al of gazHit.aliases || []) {
          if (ancNamesZh.length >= 4 && ancNamesEn.length >= 4) break;
          addAncName(al);
        }
      }

      const roleGroupsZh = [];
      const roleGroupsEn = [];
      for (const r of preModRows) {
        if (!r.near.s.remark) continue;
        const remZh = r.near.s.remark;
        const dynZh = r.d.title;
        const exZh = roleGroupsZh.find((g) => g.rem === remZh);
        if (exZh) {
          if (!exZh.dyns.includes(dynZh) && exZh.dyns.length < 2) {
            exZh.dyns.push(dynZh);
          }
        } else if (roleGroupsZh.length < 4) {
          roleGroupsZh.push({ dyns: [dynZh], rem: remZh });
        }

        const remEn = this._enDict(remZh);
        const enDynObj =
          (this.enLocale && this.enLocale.dynasties && this.enLocale.dynasties[r.d.key]) || {};
        const dynEn = enDynObj.name || r.d.title;
        if (remEn && !/[\u4e00-\u9fa5]/.test(remEn)) {
          const exEn = roleGroupsEn.find((g) => g.rem === remEn);
          if (exEn) {
            if (!exEn.dyns.includes(dynEn) && exEn.dyns.length < 2) {
              exEn.dyns.push(dynEn);
            }
          } else if (roleGroupsEn.length < 4) {
            roleGroupsEn.push({ dyns: [dynEn], rem: remEn });
          }
        }
      }

      if (!roleGroupsZh.length) return null;
      const tagZh = ancNamesZh.length
        ? `古称${ancNamesZh.slice(0, 4).join('、')}`
        : '历代建置要览';
      const descZh = `${roleGroupsZh.map((g) => `${g.dyns.join('·')}：${g.rem}`).join('；')}。`;
      const tagEn = ancNamesEn.length
        ? `Historic ${ancNamesEn.slice(0, 3).join(' / ')}`
        : 'Historical Evolution';
      const descEn = roleGroupsEn.length
        ? `${roleGroupsEn.map((g) => `${g.dyns.join('/')}: ${g.rem}`).join('; ')}.`
        : descZh;

      return {
        badge: isEn ? 'City Profile' : '城池形胜',
        tag: isEn ? (roleGroupsEn.length ? tagEn : tagZh) : tagZh,
        desc: isEn ? descEn : descZh,
        tagEn: roleGroupsEn.length ? tagEn : tagZh,
        descEn,
      };
    }

    _findNearbyPass(lng, lat, maxKm = 32) {
      let best = null;
      let bestKm = maxKm;
      for (const p of HistoricalAtlasController.STRATEGIC_PASSES) {
        const km = this.projector.greatCircleKm([lng, lat], p.coord);
        if (km <= bestKm) {
          bestKm = km;
          best = { pass: p, km };
        }
      }
      return best;
    }

    _collectPlaceEventsForDynasty(d, lng, lat, near) {
      const results = [];
      const nearCity = near && near.km <= 42 ? near.s : null;
      const isCloseCoord = (c, maxKm = 58) => {
        if (!c) return false;
        if (this.projector.greatCircleKm([lng, lat], c) <= maxKm) return true;
        if (nearCity && this.projector.greatCircleKm(nearCity.coord, c) <= maxKm * 0.88) return true;
        return false;
      };
      const matchesSiteName = (siteStr) => {
        if (!nearCity || !siteStr) return false;
        const cleanAnc = nearCity.ancient.replace(/（.*?）|\(.*?\)/g, '').trim();
        if (cleanAnc.length >= 2 && siteStr.includes(cleanAnc)) return true;
        if (nearCity.modern) {
          const parts = nearCity.modern.split(/[·/、]/).map((s) => s.trim()).filter((s) => s.length >= 2);
          if (parts.some((p) => siteStr.includes(p))) return true;
        }
        return false;
      };

      // 1. Dynasty milestones
      for (const m of d.milestones || []) {
        const veryClose = isCloseCoord(m.coord, 28);
        const siteMatch = matchesSiteName(m.site);
        if (siteMatch || veryClose || (!nearCity && isCloseCoord(m.coord, 48))) {
          results.push({
            year: m.year,
            text: this.milestoneHeadline(d, m),
            milestone: m,
          });
        }
      }

      // 2. Historical journeys
      for (const j of HistoricalAtlasController.HISTORICAL_JOURNEYS) {
        j.stops.forEach((st) => {
          const inDynSpan = st.year >= d.fromYear && st.year <= d.toYear;
          if (!inDynSpan && j.dynastyKey !== d.key) return;
          if ((j.key === 'zhugeliang' || j.key === 'qinshihuang') && !inDynSpan) return;
          if (isCloseCoord(st.coord, 45) && !results.some((r) => r.year === st.year)) {
            results.push({
              year: st.year,
              text:
                this.locale === 'en'
                  ? `${st.ancientEn} — ${st.titleEn}`
                  : `${st.ancientZh} · ${st.titleZh}`,
              milestone: {
                year: st.year,
                headline: `${st.ancientZh} · ${st.titleZh}：${st.descZh.split(/[；。]/)[0]}`,
                headlineEn: `${st.ancientEn} — ${st.titleEn}: ${st.descEn.split('.')[0]}.`,
                site: `${st.ancientZh}（今${st.modernZh}）`,
                siteEn: `${st.ancientEn} (${st.modernEn})`,
                coord: st.coord,
              },
            });
          }
        });
      }

      // 3. Curated landmark events
      for (const lm of HistoricalAtlasController.PLACE_LANDMARK_EVENTS) {
        const dynMatch = lm.dynastyKey
          ? (lm.dynastyKey === d.key || (lm.dynastyKey === 'nanbeichao' && d.key === 'nanbei'))
          : (lm.year >= d.fromYear && lm.year <= d.toYear);
        if (!dynMatch) continue;
        if (isCloseCoord(lm.coord, 45)) {
          const dup = results.some((r) =>
            r.fromLandmark ? r.year === lm.year : Math.abs(r.year - lm.year) <= 3
          );
          if (!dup) {
            results.push({
              year: lm.year,
              text: this.locale === 'en' ? lm.en : lm.zh,
              milestone: {
                year: lm.year,
                headline: lm.zh,
                headlineEn: lm.en,
                site: lm.site,
                siteEn: lm.siteEn,
                coord: lm.coord,
              },
              fromLandmark: true,
            });
          }
        }
      }

      results.sort((a, b) => a.year - b.year);
      return results;
    }

    _findNearestTouchNode(clientX, clientY, maxPx = 22) {
      const rect = this.svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return { settlementEl: null, milestoneEl: null };
      const [sx, sy] = this._clientToSvgPoint(clientX, clientY);
      const scale = Math.min(rect.width / this.camera.w, rect.height / this.camera.h);
      let bestSettle = null;
      let bestSettlePx = maxPx;
      if (this.grpSettlements && !this.grpSettlements.classList.contains('is-hidden')) {
        const showTier2 = this.svg.classList.contains('is-zoomed-cities');
        this.grpSettlements.querySelectorAll('.settlement-node').forEach((node) => {
          if (
            !showTier2 &&
            node.classList.contains('is-tier2') &&
            !node.classList.contains('is-trace-city')
          ) {
            return;
          }
          const dPx = Math.hypot(Number(node.dataset.x) - sx, Number(node.dataset.y) - sy) * scale;
          if (dPx <= bestSettlePx) {
            bestSettlePx = dPx;
            bestSettle = node;
          }
        });
      }
      let bestMile = null;
      let bestMilePx = maxPx;
      if (this.grpMilestones && !this.grpMilestones.classList.contains('is-hidden')) {
        this.grpMilestones.querySelectorAll('.milestone-pin').forEach((pin) => {
          if (pin.classList.contains('is-future')) return;
          const dPx = Math.hypot(Number(pin.dataset.x) - sx, Number(pin.dataset.y) - sy) * scale;
          if (dPx <= bestMilePx) {
            bestMilePx = dPx;
            bestMile = pin;
          }
        });
      }
      return { settlementEl: bestSettle, milestoneEl: bestMile };
    }

    _stripModernProvincePrefix(raw, modernTitle) {
      if (!raw) return '';
      const provStem = modernTitle
        ? String(modernTitle).replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔|藏族)+$/g, '')
        : '';
      const provPrefix = [provStem, provStem.slice(0, 2)].find(
        (p) => p && p.length >= 2 && raw.startsWith(p) && raw.length > p.length + 1
      );
      return (provPrefix ? raw.slice(provPrefix.length) : raw).replace(/^[·/、\s]+/, '');
    }

    _resolveModernLocationAt(lng, lat) {
      for (const prov of this.provinces || []) {
        if (String(prov.code).includes('_JD')) continue;
        if (prov.rings.some((poly) => MercatorProjector.pointInPolygonRings(lng, lat, poly))) {
          return { modernTitle: prov.title, inModernChina: true };
        }
      }
      for (const nb of (this.snapshots && this.snapshots.neighbors) || []) {
        if (MercatorProjector.pointInShape(lng, lat, nb.shape)) {
          return { modernTitle: nb.title, inModernChina: false };
        }
      }
      return { modernTitle: '', inModernChina: false };
    }

    _getCanonicalPlaces() {
      if (this._canonicalPlaces) return this._canonicalPlaces;
      const seen = new Set();
      const list = [];
      for (const d of this.dynasties || []) {
        for (const s of d.settlements || []) {
          if (!s.modern || !Array.isArray(s.coord)) continue;
          const key = `${s.modern}:${Math.round(s.coord[0] * 100)},${Math.round(s.coord[1] * 100)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          list.push({ ancient: s.ancient, modern: s.modern, coord: s.coord, isCapital: false });
        }
      }
      for (const g of HistoricalAtlasController.PLACE_GAZETTEER) {
        if (!g.modern || !Array.isArray(g.coord)) continue;
        if (list.some((p) => this.projector.greatCircleKm(p.coord, g.coord) <= 15)) continue;
        list.push({ ancient: g.name, modern: g.modern, coord: g.coord, isCapital: false });
      }
      this._canonicalPlaces = list;
      return list;
    }

    _findNearestSettlement(items, lng, lat, maxKm = 170) {
      let best = null;
      let bestKm = maxKm;
      for (const s of items || []) {
        const km = this.projector.greatCircleKm([lng, lat], s.coord);
        if (km < bestKm) {
          bestKm = km;
          best = { s, km };
        }
      }
      return best;
    }

    /** Polity containing the point, preferring Chinese regimes over peripheral neighbors. */
    _polityAt(lng, lat, snap) {
      const polities = (snap && snap.polities) || [];
      return (
        polities.find((p) => p.role !== 'neighbor' && MercatorProjector.pointInShape(lng, lat, p.shape)) ||
        polities.find((p) => p.role === 'neighbor' && MercatorProjector.pointInShape(lng, lat, p.shape)) ||
        null
      );
    }

    _resolveEraPlaceAt(lng, lat, d, snap, modernLoc, closestOverall) {
      const loc = modernLoc || this._resolveModernLocationAt(lng, lat);
      const closest =
        closestOverall !== undefined
          ? closestOverall
          : this._findNearestSettlement(this._getCanonicalPlaces(), lng, lat, 160);
      let polity = null;
      const regionObjs = [];
      const prefObjs = [];
      if (d && d.key === 'prc') {
        polity = loc.inModernChina ? '中华人民共和国' : loc.modernTitle || null;
      } else if (snap) {
        const hit = this._polityAt(lng, lat, snap);
        polity = hit ? hit.title : null;
        for (const reg of snap.regions || []) {
          if (MercatorProjector.pointInShape(lng, lat, reg.shape)) regionObjs.push(reg);
        }
        for (const pref of snap.prefectures || []) {
          if (MercatorProjector.pointInShape(lng, lat, pref.shape)) prefObjs.push(pref);
        }
      }
      let near = this._findNearestSettlement(d && d.settlements, lng, lat, 175);
      if (
        d &&
        (d.key === 'roc' || d.key === 'prc') &&
        closest &&
        closest.s &&
        closest.s.modern &&
        (!near || (near.km > 25 && closest.km + 5 < near.km))
      ) {
        const rawMod = String(closest.s.modern).replace(/（.*?）|\(.*?\)/g, '').trim();
        const cleanMod = this._stripModernProvincePrefix(rawMod, loc.modernTitle) || rawMod;
        near = {
          s: {
            ancient: cleanMod,
            rawModern: closest.s.modern,
            modern: closest.s.modern,
            coord: closest.s.coord,
            isCapital: false,
          },
          km: closest.km,
        };
      } else if (
        d &&
        d.key !== 'roc' &&
        d.key !== 'prc' &&
        prefObjs.length > 0 &&
        closest &&
        closest.km < 25 &&
        near &&
        near.km >= 25
      ) {
        near = null;
      }
      return { polity, regionObjs, prefObjs, near, modernLoc: loc };
    }

    /**
     * Resolve the modern place name a genealogy heading may assert as "今 X".
     * "今" claims identity, not proximity: only a gazetteer landmark's own `modern` field, or the
     * nearest settlement within the same 25 km "即此地" radius used by the per-dynasty rows, qualifies.
     * A leading province already shown as the modern title is dropped ("湖南岳阳" -> "岳阳").
     */
    _resolveModernIdentity(lng, lat, traceLabel, modernTitle, closestOverall) {
      const IDENTITY_KM = 25;
      const labelLower = String(traceLabel || '').toLowerCase();
      const gazHit =
        HistoricalAtlasController.PLACE_GAZETTEER.find(
          (g) =>
            Array.isArray(g.coord) &&
            this.projector.greatCircleKm([lng, lat], g.coord) <= IDENTITY_KM &&
            (this.projector.greatCircleKm([lng, lat], g.coord) <= 3 ||
              (labelLower &&
                [g.name, ...(g.aliases || [])].some((n) => String(n).toLowerCase() === labelLower)))
        ) || null;
      const isDirectSettlementHit =
        closestOverall &&
        closestOverall.km <= 3 &&
        closestOverall.s &&
        closestOverall.s.modern &&
        (!gazHit ||
          !labelLower ||
          String(closestOverall.s.ancient || '').toLowerCase() === labelLower ||
          String(closestOverall.s.modern || '').toLowerCase() === labelLower ||
          (String(gazHit.name || '').toLowerCase() !== labelLower &&
            !(gazHit.aliases || []).some((a) => String(a).toLowerCase() === labelLower)));
      const raw = isDirectSettlementHit
        ? closestOverall.s.modern
        : gazHit && gazHit.modern
          ? gazHit.modern
          : closestOverall && closestOverall.km <= IDENTITY_KM && closestOverall.s.modern
            ? closestOverall.s.modern
            : '';
      return this._stripModernProvincePrefix(raw, modernTitle);
    }

    openGenealogyAt(lng, lat, customLabel = null, opts = {}) {
      const fromYearSync = Boolean(opts && opts.fromYearSync);
      const preserveScroll = Boolean(opts && opts.preserveScroll);
      const isSamePlace =
        this.activeTrace &&
        Math.hypot(this.activeTrace[0] - lng, this.activeTrace[1] - lat) < 0.01;
      if (customLabel !== null) {
        this.activeTraceLabel = String(customLabel).trim();
      } else if (!isSamePlace) {
        this.activeTraceLabel = '';
      }
      if (!this._fullSnapshotsLoaded) {
        this._ensureFullSnapshots().then(() => {
          if (this.activeTrace && Math.hypot(this.activeTrace[0] - lng, this.activeTrace[1] - lat) < 0.01) {
            this.openGenealogyAt(lng, lat, this.activeTraceLabel, opts);
          }
        });
      }
      if (opts && opts.returnPerson) {
        this.activeReturnPerson = opts.returnPerson;
      } else if (!fromYearSync && !isSamePlace) {
        this.activeReturnPerson = null;
      }
      this._dismissTraceOnboarding();
      if (!fromYearSync && this.challenge) {
        this.stopChallenge(true);
      }
      this._clearActivePerson();
      if (this.hoverTip) {
        this.hoverTip.classList.add('is-hidden');
        this.hoverTip.classList.remove('is-interactive');
      }
      if (typeof window !== 'undefined' && window.innerWidth <= 900) {
        this.closeMilestoneBalloon();
        if (this.mobileChronicleOpen) {
          this.toggleMobileChronicle(false);
        }
      }
      if (!isSamePlace) {
        this.genealogyEventsOnly = false;
      }
      this.activeTrace = [lng, lat];
      this._syncMobileOverlayState();
      this.grpGenealogy.innerHTML = '';
      const [sx, sy] = this.projector.toScreen(lng, lat);
      const onCustomRouteStop =
        Array.isArray(this.activeCustomRoute) &&
        this.activeCustomRoute.some((st) => Math.hypot(st.lng - lng, st.lat - lat) < 0.02);
      if (!onCustomRouteStop) {
        const g = this._svgNode(
          'g',
          { 'data-x': sx.toFixed(1), 'data-y': sy.toFixed(1) },
          this.grpGenealogy
        );
        this._svgNode('circle', { class: 'trace-pin', r: 10 }, g);
        this._svgNode('circle', { class: 'trace-dot', r: 3.5 }, g);
        if (this.activeTraceLabel) {
          const lbl = this._svgNode(
            'text',
            { class: 'trace-pin-label', x: '0', y: '22', 'text-anchor': 'middle' },
            g
          );
          lbl.textContent = this.trTerm(this.activeTraceLabel);
        }
      }
      if (!fromYearSync && !onCustomRouteStop) {
        if (
          typeof window !== 'undefined' &&
          window.innerWidth <= 900 &&
          (sy > this.camera.y + this.camera.h * 0.34 || sy < this.camera.y + this.camera.h * 0.08)
        ) {
          this.camera.y = sy - this.camera.h * 0.2;
          this._applyCamera(true);
        } else if (
          typeof window !== 'undefined' &&
          window.innerWidth > 900 &&
          sx > this.camera.x + this.camera.w * 0.62
        ) {
          this.camera.x = sx - this.camera.w * 0.38;
          this._applyCamera(true);
        } else {
          this._rescaleSvgTypography(true);
        }
      } else {
        this._rescaleSvgTypography(true);
      }

      const modernLoc = this._resolveModernLocationAt(lng, lat);
      const { modernTitle, inModernChina } = modernLoc;
      const closestOverall = this._findNearestSettlement(this._getCanonicalPlaces(), lng, lat, 160);
      const identityModern = this._resolveModernIdentity(
        lng,
        lat,
        this.activeTraceLabel,
        modernTitle,
        closestOverall
      );

      // A pass may own the heading only when it is nearer than the nearest settlement; otherwise a
      // seat such as 陕州 (27 km from 函谷关) or 上洛 (9 km from 武关) would be titled as the pass.
      const matchedPassHit = this._findNearbyPass(lng, lat, 30);
      const matchedPass =
        matchedPassHit && !(closestOverall && closestOverall.km < matchedPassHit.km)
          ? matchedPassHit.pass
          : null;
      const titleMain = matchedPass
        ? (this.locale === 'en' ? matchedPass.ancientEn : matchedPass.ancientZh)
        : modernTitle
          ? this.trTerm(modernTitle)
          : this.uiStr('outside_modern', '现代省界外 / 海域');
      const titleSuffix = matchedPass
        ? ` · ${this.locale === 'en' ? matchedPass.modernEn : '今' + matchedPass.modernZh}`
        : identityModern
          ? ` · ${this.trModernCity(identityModern)}`
          : '';
      const traceLblText = this.activeTraceLabel
        ? this.locale === 'en'
          ? this.trTerm(this.activeTraceLabel)
          : this.activeTraceLabel
        : '';
      if (traceLblText && traceLblText !== titleMain) {
        const extraParts = [];
        if (matchedPass) {
          extraParts.push(this.locale === 'en' ? matchedPass.modernEn : '今' + matchedPass.modernZh);
        } else {
          if (modernTitle && modernTitle !== this.activeTraceLabel) {
            const modTitleStr = this.trTerm(modernTitle);
            if (modTitleStr !== traceLblText) extraParts.push(modTitleStr);
          }
          if (
            identityModern &&
            identityModern !== this.activeTraceLabel &&
            identityModern !== modernTitle
          ) {
            const modCityStr =
              this.locale === 'en'
                ? this.trModernCity(identityModern)
                : `今${identityModern}`;
            if (modCityStr !== traceLblText && !extraParts.includes(modCityStr)) {
              extraParts.push(modCityStr);
            }
          }
        }
        this._id('genealogy-heading').textContent =
          traceLblText + (extraParts.length ? ` · ${extraParts.join(' · ')}` : '');
      } else {
        this._id('genealogy-heading').textContent = titleMain + titleSuffix;
      }

      const rowsData = [];
      let totalEvents = 0;
      let capDynasties = 0;

      for (const d of this.dynasties) {
        const isCurDyn = d === this.dynasties[this.dynastyIdx];
        const targetYear = isCurDyn ? this.year : d.focusYear;
        const snapKey = this._resolveSnapKey(d, targetYear);
        const snap = this.snapshots[snapKey] || { polities: [], regions: [], prefectures: [] };
        const eraHit = this._resolveEraPlaceAt(lng, lat, d, snap, modernLoc, closestOverall);
        const polityHit = eraHit.polity;
        const near = eraHit.near;
        const adminHits = [];
        if (d.key === 'prc') {
          if (inModernChina) {
            const provLabel = this.locale === 'en' ? this.trTerm(modernTitle) : modernTitle;
            if (provLabel) adminHits.push(provLabel);
            if (identityModern && !modernTitle.startsWith(identityModern)) {
              const cityLabel =
                this.locale === 'en' ? this.trModernCity(identityModern) : identityModern;
              if (cityLabel && !adminHits.includes(cityLabel)) adminHits.push(cityLabel);
            }
          }
        } else {
          for (const item of [...eraHit.regionObjs, ...eraHit.prefObjs]) {
            const isEmigre = item.category === '侨州' || item.category === '侨郡';
            const label =
              this.locale === 'en'
                ? this.trTerm(item.title) + (isEmigre ? ' (Emigre)' : '')
                : item.title +
                  (item.category && !item.title.endsWith(item.category) ? `（${item.category}）` : '');
            if (!adminHits.includes(label)) adminHits.push(label);
          }
        }
        const isCapHere = Boolean(near && near.km <= 38 && near.s.isCapital);
        if (isCapHere) capDynasties++;

        const placeEvents = this._collectPlaceEventsForDynasty(d, lng, lat, near);
        totalEvents += placeEvents.length;

        rowsData.push({
          d,
          isCurDyn,
          polityHit,
          adminHits,
          near,
          isCapHere,
          placeEvents,
        });
      }

      this._id('genealogy-card').classList.remove('is-hidden');
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.add('has-active-genealogy');
      this._syncTracedPrefecture();

      const renderSubAndList = () => {
        const subEl = this._id('genealogy-sub');
        const capInfo =
          capDynasties > 0
            ? this.locale === 'en'
              ? ` · Capital in ${capDynasties} dynasties`
              : ` · ${capDynasties} 朝都城`
            : '';
        const coordText = `${lng.toFixed(2)}°E, ${lat.toFixed(2)}°N${capInfo}${
          totalEvents === 0
            ? ' · ' + this.uiStr('trace_click_hint', '点击任一朝代可切换地图')
            : ''
        }`;

        const retP = this.activeReturnPerson;
        const retBtnHtml = retP
          ? `<button type="button" class="gen-filter-pill" id="act-return-person">‹ ${escHtml(
              this.locale === 'en' ? retP.profile.en : retP.profile.zh
            )}</button>`
          : '';
        if (totalEvents > 0 || retBtnHtml) {
          const btnLabel = this.genealogyEventsOnly
            ? this.locale === 'en'
              ? 'All Dynasties'
              : '历代全览'
            : this.locale === 'en'
              ? `Chronicles · ${totalEvents}`
              : `史事纪要 · ${totalEvents}`;
          const filterHtml =
            totalEvents > 0
              ? `<button type="button" class="gen-filter-pill gen-ev-toggle ${
                  this.genealogyEventsOnly ? 'is-active' : ''
                }">${btnLabel}</button>`
              : '';
          subEl.innerHTML =
            `<span>${coordText}</span>` +
            `<span class="person-sub-actions">${retBtnHtml}${filterHtml}</span>`;
          const retBtn = this._id('act-return-person');
          if (retBtn && retP) {
            retBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.openPersonChronicle(retP.profile, retP.eventIdx);
            });
          }
          const filterBtn = subEl.querySelector('.gen-ev-toggle');
          if (filterBtn) {
            filterBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.genealogyEventsOnly = !this.genealogyEventsOnly;
              renderSubAndList();
            });
          }
        } else {
          subEl.textContent = coordText;
        }

        const loreEl = this._id('genealogy-lore');
        const loreBanner = this._resolvePlaceLoreBanner(
          lng,
          lat,
          matchedPass,
          identityModern,
          rowsData
        );
        if (loreEl) {
          if (loreBanner && !this.genealogyEventsOnly) {
            loreEl.innerHTML =
              `<div class="pass-lore-head"><span class="pass-lore-badge">${loreBanner.badge}</span><span class="pass-lore-range">${loreBanner.tag}</span></div>` +
              `<div class="pass-lore-desc">${loreBanner.desc}</div>`;
            loreEl.classList.remove('is-hidden');
          } else {
            loreEl.innerHTML = '';
            loreEl.classList.add('is-hidden');
          }
        }

        const listEl = this._id('genealogy-timeline');
        const scrollEl = this._id('genealogy-body') || listEl;
        const prevScrollTop = scrollEl.scrollTop;
        const hadItems = listEl.children.length > 0;
        listEl.innerHTML = '';

        const visibleRows = this.genealogyEventsOnly
          ? rowsData.filter((r) => r.placeEvents.length > 0 || r.isCapHere)
          : rowsData;

        for (const r of visibleRows) {
          const { d, isCurDyn, polityHit, adminHits, near, isCapHere, placeEvents } = r;
          const li = document.createElement('li');
          if (isCurDyn) li.classList.add('is-current');
          const mainStr = adminHits.length
            ? adminHits.join(' · ')
            : polityHit
              ? this.trTerm(polityHit)
              : this.uiStr('beyond_recorded', '（域外 / 未设郡县）');

          const defaultCapLabel = d.key === 'roc' || d.key === 'prc' ? '首都' : '王朝都城';
          const capBadgeHtml = isCapHere
            ? `<span class="t-cap-badge">${
                this.locale === 'en'
                  ? 'Capital'
                  : (near.s.remark && near.s.remark.length <= 6 ? near.s.remark : defaultCapLabel)
              }</span>`
            : '';

          const subParts = [];
          if (adminHits.length && polityHit) {
            subParts.push(`${this.uiStr('belongs_to', '属 ')}${this.trTerm(polityHit)}`);
          }
          if (near) {
            const distStr =
              near.km < 25
                ? this.uiStr('at_here', '即此地')
                : `${Math.round(near.km)} km`;
            const nearCityName =
              d.key === 'roc' || d.key === 'prc'
                ? this.locale === 'en' &&
                  near.s.rawModern &&
                  !(this.enLocale.dict && this.enLocale.dict[near.s.ancient])
                  ? this.trModernCity(near.s.rawModern)
                  : this.trModernCity(near.s.ancient)
                : this.trTerm(near.s.ancient);
            const nearPrefix =
              d.key === 'prc'
                ? near.km < 25
                  ? this.locale === 'en'
                    ? 'Modern city: '
                    : '现代城市：'
                  : this.locale === 'en'
                    ? 'Nearby city: '
                    : '邻近城市：'
                : this.uiStr('near_city', '邻近古城：');
            subParts.push(
              this.locale === 'en'
                ? `${nearPrefix}${nearCityName} (${distStr})`
                : `${nearPrefix}${nearCityName}（${distStr}）`
            );
            const capUsedRemark =
              isCapHere && this.locale !== 'en' && near.s.remark && near.s.remark.length <= 6;
            if (near.km < 25 && near.s.remark && !capUsedRemark) {
              const remStr = this.locale === 'en' ? this.trTerm(near.s.remark) : near.s.remark;
              if (remStr && !subParts.includes(remStr)) {
                subParts.push(remStr);
              }
            }
          }

          let eventsHtml = '';
          if (placeEvents.length) {
            const evItems = placeEvents
              .map((ev, evIdx) => {
                const yrLabel =
                  this.locale === 'en'
                    ? this.formatYear(ev.year)
                    : `${ev.year <= 0 ? '前' + -ev.year : ev.year}年`;
                return `<div class="t-ev-row" data-ev-idx="${evIdx}"><span class="t-ev-yr">▸ ${yrLabel}</span><span class="t-ev-txt">${ev.text}</span></div>`;
              })
              .join('');
            eventsHtml = `<div class="t-events">${evItems}</div>`;
          }

          li.innerHTML =
            `<span class="t-era">${this.dynastyName(d)}</span>` +
            `<span class="t-val">${mainStr}${capBadgeHtml}${
              subParts.length ? `<span class="t-sub">${subParts.join(' · ')}</span>` : ''
            }${eventsHtml}</span>`;

          li.querySelectorAll('.t-ev-row').forEach((rowEl) => {
            rowEl.addEventListener('click', (e) => {
              e.stopPropagation();
              const ev = placeEvents[Number(rowEl.dataset.evIdx)];
              if (!ev) return;
              this.stopAutoplay();
              this._preserveGenealogyScrollOnce = true;
              const targetY = this._clampYearToDynasty(d, ev.year);
              this.jumpToYear(targetY);
              if (ev.milestone) {
                this.openMilestoneBalloon(d, ev.milestone);
              }
            });
          });

          li.addEventListener('click', () => {
            this.stopAutoplay();
            this._preserveGenealogyScrollOnce = true;
            this.jumpToYear(d.focusYear);
          });
          listEl.appendChild(li);
        }

        const curLi = listEl.querySelector('li.is-current');
        if (curLi && scrollEl.scrollHeight > scrollEl.clientHeight) {
          const liTop = curLi.offsetTop - (scrollEl === listEl ? listEl.offsetTop : 0);
          const liBottom = liTop + curLi.offsetHeight;
          const alreadyVisible =
            hadItems &&
            isSamePlace &&
            liTop >= prevScrollTop + 8 &&
            liBottom <= prevScrollTop + scrollEl.clientHeight - 8;
          if (preserveScroll || (fromYearSync && alreadyVisible)) {
            scrollEl.scrollTop = prevScrollTop;
          } else if (liTop + Math.min(curLi.offsetHeight, 84) <= scrollEl.clientHeight) {
            scrollEl.scrollTop = 0;
          } else {
            const lead =
              typeof window !== 'undefined' && window.innerWidth <= 900
                ? 4
                : scrollEl.clientHeight * 0.35;
            scrollEl.scrollTop = Math.max(0, liTop - lead);
          }
        } else if (scrollEl) {
          scrollEl.scrollTop = 0;
        }
        if (this.locale === 'zh-tw') this._applyZhHantDom(this._id('genealogy-card'));
      };

      renderSubAndList();
      if (this.activeMilestone) this._positionMilestoneBalloon();
    }

    // ---------------- Scrubber / Timeline ----------------
    _findDynastyIndex(y) {
      for (let i = this.dynasties.length - 1; i >= 0; i--) {
        if (y >= this.dynasties[i].fromYear) return i;
      }
      return 0;
    }

    // Each dynasty gets a scrubber band proportional to its span, floored at 60 years.
    _initTimelineBands() {
      const minSpan = 60;
      this.bandWeights = this.dynasties.map((d) =>
        Math.max(d.toYear - d.fromYear, minSpan)
      );
      this.totalBandWeight = this.bandWeights.reduce((acc, w) => acc + w, 0);
      this.bandOffsets = [];
      this.bandWeights.reduce((acc, w, i) => {
        this.bandOffsets[i] = acc / this.totalBandWeight;
        return acc + w;
      }, 0);
    }

    _yearToProgress(y) {
      const idx = this._findDynastyIndex(y);
      const d = this.dynasties[idx];
      const span = Math.max(1, d.toYear - d.fromYear);
      const local = Math.max(0, Math.min(1, (y - d.fromYear) / span));
      return (
        this.bandOffsets[idx] +
        local * (this.bandWeights[idx] / this.totalBandWeight)
      );
    }

    _progressToYear(frac) {
      const clamped = Math.max(0, Math.min(0.999999, frac));
      let idx = this.dynasties.length - 1;
      while (idx > 0 && this.bandOffsets[idx] > clamped) idx--;
      const d = this.dynasties[idx];
      const weightFrac = this.bandWeights[idx] / this.totalBandWeight;
      const local = (clamped - this.bandOffsets[idx]) / weightFrac;
      return Math.round(d.fromYear + local * (d.toYear - d.fromYear));
    }

    // Coalesce pointermove into one jumpToYear per animation frame and skip unchanged years.
    _bindScrubberDrag(track) {
      let scrubbing = false;
      let trackRect = null;
      let pendingX = null;
      let rafId = null;
      const cancelRaf = () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        pendingX = null;
      };
      const scrubAt = (clientX, skipSameYear = true) => {
        const r = trackRect && trackRect.width ? trackRect : track.getBoundingClientRect();
        let y = Math.max(
          this.minYear,
          Math.min(this.maxYear, this._progressToYear((clientX - r.left) / r.width))
        );
        if (y === 0) y = this.year < 0 ? 1 : -1;
        if (!skipSameYear || y !== this.year) this.jumpToYear(y);
      };
      track.addEventListener('pointerdown', (e) => {
        if (this.challenge) return;
        this._recordGestureClick();
        this.stopAutoplay();
        this._clearQuickSearchInput();
        cancelRaf();
        scrubbing = true;
        trackRect = track.getBoundingClientRect();
        track.setPointerCapture(e.pointerId);
        scrubAt(e.clientX, false);
      });
      track.addEventListener('pointermove', (e) => {
        if (!scrubbing) return;
        pendingX = e.clientX;
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            rafId = null;
            if (!scrubbing || pendingX === null) return;
            const x = pendingX;
            pendingX = null;
            scrubAt(x);
          });
        }
      });
      track.addEventListener('pointerup', () => {
        if (!scrubbing) return;
        const x = pendingX;
        cancelRaf();
        scrubbing = false;
        trackRect = null;
        if (x !== null) scrubAt(x);
      });
      track.addEventListener('pointercancel', () => {
        cancelRaf();
        scrubbing = false;
        trackRect = null;
      });
    }

    _buildScrubberBands() {
      const bands = this._id('dynasty-bands');
      const ticks = this._id('scrubber-ticks');
      bands.innerHTML = '';
      ticks.innerHTML = '';
      this.dynasties.forEach((d, idx) => {
        const cell = document.createElement('div');
        cell.className = 'band-cell';
        cell.style.flex = `${this.bandWeights[idx]} 1 0`;
        cell.style.background = d.tint;
        cell.dataset.dynastyIdx = idx;
        cell.setAttribute('role', 'button');
        cell.tabIndex = 0;
        cell.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            if (this.challenge) return;
            this.stopAutoplay();
            this.jumpToYear(d.focusYear !== undefined ? d.focusYear : d.fromYear);
          }
        });

        const lbl = document.createElement('span');
        lbl.className = 'band-label';
        cell.appendChild(lbl);

        const span = Math.max(1, d.toYear - d.fromYear);
        if (Array.isArray(d.phases) && d.phases.length > 1) {
          for (let i = 0; i < d.phases.length - 1; i++) {
            const u = d.phases[i].until;
            if (u > d.fromYear && u < d.toYear) {
              const pt = document.createElement('i');
              pt.className = 'band-phase-tick';
              pt.style.left = `${(((u - d.fromYear) / span) * 100).toFixed(2)}%`;
              cell.appendChild(pt);
            }
          }
        }
        const seenEvPct = new Set();
        for (const m of d.milestones || []) {
          const my = this._clampYearToDynasty(d, m.year);
          const pct = Math.max(3, Math.min(97, Math.round(((my - d.fromYear) / span) * 100)));
          if (seenEvPct.has(pct)) continue;
          seenEvPct.add(pct);
          const dot = document.createElement('i');
          dot.className = 'band-ev-dot';
          dot.style.left = `${pct}%`;
          cell.appendChild(dot);
        }

        bands.appendChild(cell);

        const tick = document.createElement('span');
        tick.style.left = `${(this.bandOffsets[idx] * 100).toFixed(3)}%`;
        ticks.appendChild(tick);
      });
      const endTick = document.createElement('span');
      endTick.id = 'tick-present';
      endTick.style.left = '100%';
      endTick.textContent = this.uiStr('tick_now', '今');
      ticks.appendChild(endTick);
      this._refreshBandLabels();
      window.addEventListener('resize', () => {
        this._fitBandLabels();
        this._updateScaleBar();
        this._syncScrubberUi();
      });
    }

    _refreshBandLabels() {
      const cells = this._id('dynasty-bands').children;
      const tickNodes = this._id('scrubber-ticks').children;
      this.dynasties.forEach((d, idx) => {
        const cell = cells[idx];
        if (cell) {
          const lbl = cell.querySelector('.band-label') || cell;
          lbl.textContent = this.dynastyBadge(d);
          const fullLabel = `${this.dynastyName(d)}（${this.formatSpan(d)}）`;
          cell.title = fullLabel;
          cell.setAttribute('aria-label', fullLabel);
        }
        const tk = tickNodes[idx];
        if (tk) {
          tk.textContent =
            d.fromYear <= 0
              ? this.locale === 'en'
                ? `${-d.fromYear} BCE`
                : `前${-d.fromYear}`
              : `${d.fromYear}`;
        }
      });
      const endTick = this._id('tick-present');
      if (endTick) endTick.textContent = this.uiStr('tick_now', '今');
      this._fitBandLabels();
    }

    _fitBandLabels() {
      const cells = this._id('dynasty-bands').children;
      const tickNodes = this._id('scrubber-ticks').children;
      const endTick = this._id('tick-present');
      const maxRight = endTick ? endTick.getBoundingClientRect().left - 4 : Infinity;
      let lastRight = -Infinity;
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        cell.classList.remove('is-narrow');
        const lbl = cell.querySelector('.band-label');
        const narrow = lbl
          ? lbl.scrollWidth > cell.clientWidth - 4
          : cell.scrollWidth > cell.clientWidth + 1;
        cell.classList.toggle('is-narrow', narrow);
        const tk = tickNodes[i];
        if (tk) {
          const rect = tk.getBoundingClientRect();
          const hide = rect.left < lastRight + 6 || rect.right > maxRight;
          tk.classList.toggle('is-hidden-tick', hide);
          if (!hide) lastRight = rect.right;
        }
      }
    }

    _syncScrubberUi() {
      const pct = this._yearToProgress(this.year) * 100;
      const handle = this._id('scrubber-handle');
      if (handle) handle.style.left = `${pct}%`;

      const d = this.dynasties[this.dynastyIdx];
      const bubble = this._id('scrubber-Bubble');
      const bubbleText = this._id('bubble-text');
      if (bubble && bubbleText) {
        const eraText = `${this.formatYear(this.year)} · ${this.formatEraLabel(this.year, d)}`;
        bubbleText.textContent = eraText;
        if (this.year >= 1368 && this.year < 1912) {
          const sp = this._resolveEraSpan(this.year, d);
          const templeZh = sp && sp[3];
          bubble.title =
            this.locale === 'en' || !templeZh ? eraText : `${eraText}（${this._zh(templeZh)}）`;
        } else {
          bubble.title = eraText;
        }
        const wrap = this._id('scrubber-rail-wrap');
        const railW = wrap ? wrap.clientWidth : 300;
        const bW = bubble.offsetWidth || 180;
        const handleX = (pct / 100) * railW;
        // Clamp bubble strictly inside [0, railW - bW] so text never clips off-screen
        const maxLeft = Math.max(0, railW - bW);
        const leftPx = Math.max(0, Math.min(maxLeft, handleX - bW * 0.5));
        bubble.style.left = `${leftPx.toFixed(1)}px`;
        bubble.style.transform = 'none';

        // Direct caret arrow to point straight at the timeline thumb
        const arrowX = Math.max(8, Math.min(bW - 8, handleX - leftPx));
        bubble.style.setProperty('--arrow-left', `${arrowX.toFixed(1)}px`);
      }

      const track = this._id('scrubber-track');
      if (track) track.setAttribute('aria-valuenow', String(this.year));
      const inpYear = this._id('inp-year');
      if (inpYear) inpYear.value = this.year === 0 ? 1 : this.year;
      Array.from(this._id('dynasty-bands').children).forEach((el, idx) =>
        el.classList.toggle('is-active', idx === this.dynastyIdx)
      );
    }

    _clearQuickSearchInput() {
      const searchInp = this._id('inp-map-search');
      if (searchInp) {
        if (searchInp.value) searchInp.value = '';
        if (typeof document !== 'undefined' && document.activeElement === searchInp) {
          searchInp.blur();
        }
      }
      const listEl = this._id('map-search-results');
      if (listEl) listEl.classList.add('is-hidden');
      const boxEl = this._id('map-search-box');
      if (boxEl) boxEl.classList.remove('is-expanded');
    }

    jumpToYear(targetYear) {
      let y = Math.max(this.minYear, Math.min(this.maxYear, Math.round(targetYear)));
      if (y === 0) y = this.year < 0 ? 1 : -1;
      const prevIdx = this.dynastyIdx;
      this.year = y;
      this.dynastyIdx = this._findDynastyIndex(y);
      const cur = this.dynasties[this.dynastyIdx];
      const nextSnapKey = this._resolveSnapKey(cur, y);

      if (prevIdx !== this.dynastyIdx || !this.grpSettlements.firstChild) {
        if (prevIdx !== this.dynastyIdx) {
          this._clearQuickSearchInput();
        }
        const prevSnap = this.lastRenderedSnap;
        this._renderDynasty(cur, prevSnap);
        this._renderChroniclePane(cur);
      } else {
        if (nextSnapKey !== this.activeSnapKey) {
          const prevSnap = this.lastRenderedSnap;
          this.activeSnapKey = nextSnapKey;
          this._fetchSnapshot(nextSnapKey).then((snap) => {
            if (
              this.dynasties[this.dynastyIdx] !== cur ||
              this._resolveSnapKey(cur, this.year) !== nextSnapKey
            ) {
              return;
            }
            this._renderPolitiesAndPrefectures(cur, snap);
            if (!this.playing && prevSnap) {
              this._renderGhostDiff(prevSnap, 'fade');
            }
          });
        } else if (this.lastRenderedSnap) {
          this._renderLegendBox(this.lastRenderedSnap);
        }
        if (this._settlementMask(cur, y) !== this.activeSettlementMask) {
          this._renderSettlements(cur);
        }
        this._highlightCurrentMilestone(cur);
        this._updateMilestoneStates(cur);
      }
      if (this._hydroMask(y) !== this.activeHydroMask) {
        this._buildTerrainRivers();
        this._rescaleSvgTypography();
      }
      // Auto callouts are kept or replaced by _syncAutoMilestoneBalloon below.
      const am = this.activeMilestone;
      if (am && (am.isAuto ? this.activePerson : am.year !== y)) {
        this.closeMilestoneBalloon();
      }
      if (!this.activePerson) {
        this._syncAutoMilestoneBalloon(cur);
      }
      this._renderCorridors();
      this._syncScrubberUi();
      const preserveScroll = Boolean(this._preserveGenealogyScrollOnce);
      this._preserveGenealogyScrollOnce = false;
      const genCard = this._id('genealogy-card');
      if (this.activeTrace && genCard && !genCard.classList.contains('is-hidden')) {
        this.openGenealogyAt(this.activeTrace[0], this.activeTrace[1], null, {
          fromYearSync: true,
          preserveScroll,
        });
      }
    }

    stepTimelineNode(dir) {
      if (this.challenge) return;
      this._recordGestureClick();
      this.stopAutoplay();
      if (this.activeCustomRoute) {
        this.stepCustomRoute(dir > 0 ? 1 : -1);
        return;
      }
      if (this.activePerson) {
        if (this.personTimer) {
          clearInterval(this.personTimer);
          this.personTimer = null;
        }
        this.stepPersonEvent(dir > 0 ? 1 : -1);
        return;
      }
      const ensureCoordInView = (coord) => {
        if (!coord || !this.projector || typeof this._animateCameraTo !== 'function') return;
        const [sx, sy] = this.projector.toScreen(coord[0], coord[1]);
        const outX =
          sx < this.camera.x + this.camera.w * 0.14 ||
          sx > this.camera.x + this.camera.w * 0.86;
        const outY =
          sy < this.camera.y + this.camera.h * 0.16 ||
          sy > this.camera.y + this.camera.h * 0.84;
        if (outX || outY) {
          this._animateCameraTo({
            x: Math.max(-140, Math.min(1000 - this.camera.w + 140, sx - this.camera.w * 0.5)),
            y: Math.max(-100, Math.min(700 - this.camera.h + 120, sy - this.camera.h * 0.45)),
            w: this.camera.w,
            h: this.camera.h,
          });
        }
      };
      const curDyn = this.dynasties[this.dynastyIdx];
      if (curDyn && Array.isArray(curDyn.milestones)) {
        const sameYrIdxs = [];
        curDyn.milestones.forEach((m, idx) => {
          if (this._clampYearToDynasty(curDyn, m.year) === this.year) {
            sameYrIdxs.push(idx);
          }
        });
        if (sameYrIdxs.length > 1) {
          const curMIdx = this._activeMilestoneIndex(curDyn);
          const pos = sameYrIdxs.indexOf(curMIdx);
          const nextPos = pos + (dir > 0 ? 1 : -1);
          if (pos !== -1 && nextPos >= 0 && nextPos < sameYrIdxs.length) {
            const targetM = curDyn.milestones[sameYrIdxs[nextPos]];
            this.openMilestoneBalloon(curDyn, targetM, { fromStep: true });
            ensureCoordInView(targetM.coord);
            return;
          }
        }
      }
      if (!this._timelineStepYears) {
        const yrs = new Set();
        for (const d of this.dynasties) {
          yrs.add(d.fromYear);
          yrs.add(d.focusYear);
          if (Array.isArray(d.phases)) {
            for (const ph of d.phases) {
              if (ph.until > d.fromYear && ph.until <= d.toYear) {
                yrs.add(ph.until);
              }
            }
          }
          for (const m of d.milestones || []) {
            yrs.add(this._clampYearToDynasty(d, m.year));
          }
        }
        this._timelineStepYears = Array.from(yrs).sort((a, b) => a - b);
      }
      const list = this._timelineStepYears;
      let targetY = this.year;
      if (dir > 0) {
        const nextY = list.find((y) => y > this.year);
        targetY = nextY !== undefined ? nextY : this.maxYear;
      } else {
        targetY = this.minYear;
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i] < this.year) {
            targetY = list[i];
            break;
          }
        }
      }
      this.jumpToYear(targetY);
      const nextDyn = this.dynasties[this.dynastyIdx];
      if (nextDyn && Array.isArray(nextDyn.milestones)) {
        const matched = nextDyn.milestones.filter(
          (m) => this._clampYearToDynasty(nextDyn, m.year) === this.year
        );
        if (matched.length > 1 && dir > 0) {
          this.openMilestoneBalloon(nextDyn, matched[0], { fromStep: true });
        }
        const activeM =
          this.activeMilestone && this.activeMilestone.dynastyKey === nextDyn.key
            ? this.activeMilestone.milestone
            : matched[matched.length - 1];
        if (activeM && activeM.coord) {
          ensureCoordInView(activeM.coord);
        }
      }
    }

    // ---------------- Autoplay ----------------
    _autoplayIntervalMs() {
      const speed = Number(this.playSpeed) > 0 ? Number(this.playSpeed) : 1;
      return Math.max(20, Math.round(AUTOPLAY_TICK_MS / speed));
    }

    _personAutoplayIntervalMs() {
      const speed = Number(this.playSpeed) > 0 ? Number(this.playSpeed) : 1;
      return Math.max(150, Math.round(PERSON_AUTOPLAY_STEP_MS / speed));
    }

    _updatePlaySpeedUi() {
      const speed = Number(this.playSpeed) > 0 ? Number(this.playSpeed) : 1;
      const labelText = `${speed}×`;
      const lbl = this._id('lbl-play-speed');
      if (lbl) lbl.textContent = labelText;
      const btn = this._id('act-play-speed');
      if (!btn) return;
      if (!lbl) btn.textContent = labelText;
      btn.classList.toggle('is-custom-speed', speed !== 1);
      const isEn = this.locale === 'en';
      btn.setAttribute('aria-label', isEn ? `Playback speed ${labelText}` : `播放倍速 ${labelText}`);
      btn.title = isEn
        ? `Playback speed ${labelText} (click to cycle 0.25× / 0.5× / 1× / 2×)`
        : `播放倍速 ${labelText}（点击切换 0.25× / 0.5× / 1× / 2×）`;
    }

    setPlaySpeed(speed) {
      const numeric = Number(speed);
      if (!PLAY_SPEED_STEPS.includes(numeric)) return this.playSpeed;
      this.playSpeed = numeric;
      this._updatePlaySpeedUi();
      if (this.playing && this.playInterval) {
        clearInterval(this.playInterval);
        this.playInterval = setInterval(() => this._autoplayTick(), this._autoplayIntervalMs());
      }
      if (this.personTimer && this.activePerson) {
        clearInterval(this.personTimer);
        this.personTimer = setInterval(
          () => this._personAutoplayTick(),
          this._personAutoplayIntervalMs()
        );
      }
      return this.playSpeed;
    }

    cyclePlaySpeed() {
      if (this.challenge) return this.playSpeed;
      const curIdx = PLAY_SPEED_STEPS.indexOf(Number(this.playSpeed));
      const nextSpeed = PLAY_SPEED_STEPS[(curIdx >= 0 ? curIdx + 1 : 1) % PLAY_SPEED_STEPS.length];
      return this.setPlaySpeed(nextSpeed);
    }

    _updateAutoplayUi() {
      const btn = this._id('act-autoplay');
      if (!btn) return;
      const isPlaying = Boolean(this.playing || this.personTimer);
      btn.innerHTML = isPlaying ? SVG_ICONS.pause : SVG_ICONS.play;
      btn.classList.toggle('is-playing', isPlaying);
      btn.setAttribute('aria-pressed', String(isPlaying));
      const actionLbl = isPlaying
        ? this.locale === 'en'
          ? 'Pause'
          : '暂停'
        : this.locale === 'en'
          ? 'Play'
          : '播放';
      btn.setAttribute('aria-label', actionLbl);
      btn.title = isPlaying
        ? this.locale === 'en'
          ? 'Pause timeline autoplay (Space)'
          : '暂停时间轴播放（空格）'
        : this.uiStr('play_title', '自动播放 / 暂停（空格）');
    }

    startAutoplay() {
      if (this.challenge) return;
      if (this.personTimer) {
        clearInterval(this.personTimer);
        this.personTimer = null;
      }
      this.playing = true;
      this.closeMilestoneBalloon();
      this._updateAutoplayUi();
      if (this.year >= this.maxYear) this.jumpToYear(this.minYear);
      this._syncAutoMilestoneBalloon(this.dynasties[this.dynastyIdx]);
      this.playProgress = this._yearToProgress(this.year);
      this.playHoldTicks = 0;
      this.playShownTicks = AUTOPLAY_MIN_SHOW_TICKS;
      this.playInterval = setInterval(() => this._autoplayTick(), this._autoplayIntervalMs());
    }

    // Sorted milestone years the autoplay must land on, with the ones it holds on.
    _autoplayStops() {
      if (!this._autoplayStopList) {
        const holdByYear = new Map();
        for (const d of this.dynasties) {
          for (const m of d.milestones || []) {
            const y = this._clampYearToDynasty(d, m.year);
            const opensDynasty = m.year === d.fromYear;
            holdByYear.set(y, Boolean(holdByYear.get(y) || m.isMapChange || opensDynasty));
          }
        }
        this._autoplayStopList = [...holdByYear]
          .map(([year, hold]) => ({ year, hold }))
          .sort((a, b) => a.year - b.year);
      }
      return this._autoplayStopList;
    }

    _autoplayTick() {
      if (this.playHoldTicks > 0) {
        this.playHoldTicks--;
        return;
      }
      if (this.year >= this.maxYear) {
        this.stopAutoplay();
        return;
      }
      const step = AUTOPLAY_TICK_MS / AUTOPLAY_FULL_RUN_MS;
      this.playShownTicks++;
      this.playProgress += step;
      let next = this.playProgress >= 1 ? this.maxYear : this._progressToYear(this.playProgress);
      if (next === 0) next = 1;
      if (next <= this.year) return;
      const stop = this._autoplayStops().find((s) => s.year > this.year && s.year <= next);
      if (stop) {
        // Let the current callout stay readable before the next milestone replaces it.
        if (this.playShownTicks < AUTOPLAY_MIN_SHOW_TICKS) {
          this.playProgress -= step;
          return;
        }
        next = stop.year;
        this.playShownTicks = stop.hold ? AUTOPLAY_MIN_SHOW_TICKS : 0;
        if (stop.hold) this.playHoldTicks = AUTOPLAY_HOLD_TICKS;
      }
      this.jumpToYear(next);
    }

    stopAutoplay() {
      this.playing = false;
      if (this.playInterval) {
        clearInterval(this.playInterval);
        this.playInterval = null;
      }
      if (this.personTimer) {
        clearInterval(this.personTimer);
        this.personTimer = null;
      }
      this._updateAutoplayUi();
      const cur = this.dynasties[this.dynastyIdx];
      if (cur) this._syncAutoMilestoneBalloon(cur);
    }

    // ---------------- Classical Guqin Music Player ----------------
    static get GUQIN_TRACKS() {
      return (window.ATLAS_LORE_DATA && window.ATLAS_LORE_DATA.GUQIN_TRACKS) || [];
    }

    _ensureMusicAudio() {
      if (this.musicAudio) return this.musicAudio;
      const audio = new Audio();
      audio.preload = 'auto';
      audio.volume = 0.48;
      audio.addEventListener('ended', () => {
        if (this.musicPlaying) this.nextMusicTrack();
      });
      audio.addEventListener('error', () => {
        if (!this.musicPlaying) return;
        const t = HistoricalAtlasController.GUQIN_TRACKS[this.musicTrackIdx];
        if (audio.src !== t.ogg) {
          audio.src = t.ogg;
          audio.play().catch(() => {});
        }
      });
      this.musicAudio = audio;
      return audio;
    }

    _playCurrentMusicTrack() {
      const tracks = HistoricalAtlasController.GUQIN_TRACKS;
      const t = tracks[this.musicTrackIdx % tracks.length];
      const audio = this._ensureMusicAudio();
      audio.src = t.mp3;
      this.musicPlaying = true;
      this._updateMusicUi();
      audio.play().catch(() => {
        if (!this.musicPlaying) return;
        audio.src = t.ogg;
        audio.play().catch(() => {});
      });
    }

    toggleMusic() {
      if (this.musicPlaying) {
        this.musicPlaying = false;
        if (this.musicAudio) this.musicAudio.pause();
        this._updateMusicUi();
      } else {
        this._playCurrentMusicTrack();
      }
    }

    nextMusicTrack() {
      const tracks = HistoricalAtlasController.GUQIN_TRACKS;
      this.musicTrackIdx = (this.musicTrackIdx + 1) % tracks.length;
      if (this.musicPlaying) {
        this._playCurrentMusicTrack();
      } else {
        this._updateMusicUi();
      }
    }

    _updateMusicUi() {
      const btn = this._id('act-music');
      const lbl = this._id('lbl-music');
      const nextBtn = this._id('act-music-next');
      if (!btn || !lbl) return;
      const tracks = HistoricalAtlasController.GUQIN_TRACKS;
      const cur = tracks[this.musicTrackIdx % tracks.length];
      if (!cur) return;
      const trackName = this.locale === 'en' ? cur.en : cur.zh;
      btn.classList.toggle('is-active', this.musicPlaying);
      if (this.musicPlaying) {
        lbl.textContent = this.locale === 'en' ? `Guqin · ${trackName}` : `雅乐 · ${trackName}`;
      } else {
        lbl.textContent = this.locale === 'en' ? 'Guqin' : '雅乐';
      }
      btn.title =
        this.locale === 'en'
          ? `Classical Guqin Music (${cur.en})`
          : `古琴雅乐（当前曲目：《${cur.zh}》）`;
      if (nextBtn) {
        nextBtn.classList.toggle('is-hidden', !this.musicPlaying);
        nextBtn.title =
          this.locale === 'en' ? 'Switch Guqin Track' : '切换下一首古琴曲';
      }
    }

    // ---------------- Camera Pan & Zoom ----------------
    _invalidateTypographyLayout() {
      this._typoDirty = true;
    }

    _applyCamera(forceTypography = false) {
      this.svg.setAttribute(
        'viewBox',
        `${this.camera.x.toFixed(1)} ${this.camera.y.toFixed(1)} ${this.camera.w.toFixed(1)} ${this.camera.h.toFixed(1)}`
      );
      const zoomChanged =
        forceTypography ||
        this._typoDirty ||
        this._lastTypographyWidth === undefined ||
        Math.abs(this.camera.w - this._lastTypographyWidth) > 0.05;
      if (zoomChanged) {
        this._rescaleSvgTypography();
      }
      this._updateScaleBar();
      if (this.activeMilestone) this._positionMilestoneBalloon();
    }

    _updateScaleBar() {
      const lblEl = this._id('scale-label-text');
      const barEl = this._id('scale-ruler-bar');
      if (!lblEl || !barEl || !this.svg) return;
      const rect = (this.dragState && this.dragState.rect) || this.svg.getBoundingClientRect();
      const rw = rect.width || 1000;
      const rh = rect.height || 700;
      const screenScale = Math.min(rw / this.camera.w, rh / this.camera.h);
      const [, centerLat] = this.projector.toGeo(
        this.camera.x + this.camera.w * 0.5,
        this.camera.y + this.camera.h * 0.5
      );
      const clampedLat = Math.max(-70, Math.min(70, centerLat || 34));
      const kmPerSvgUnit =
        (111.32 * Math.cos(clampedLat * DEG_TO_RAD)) / this.projector.scale;
      const kmPerCssPx = kmPerSvgUnit / Math.max(0.05, screenScale);

      const candidates = [20, 50, 100, 200, 500, 1000, 1500];
      let bestKm = 500;
      let bestDiff = Infinity;
      for (const km of candidates) {
        const px = km / kmPerCssPx;
        const diff = Math.abs(px - 86);
        if (px >= 48 && px <= 145 && diff < bestDiff) {
          bestDiff = diff;
          bestKm = km;
        }
      }
      const barPx = Math.max(44, Math.min(150, Math.round(bestKm / kmPerCssPx)));
      barEl.style.width = `${barPx}px`;
      lblEl.textContent = `${bestKm} km`;
    }

    _isMobileViewport() {
      return (
        typeof window !== 'undefined' &&
        typeof window.innerWidth === 'number' &&
        window.innerWidth > 0 &&
        window.innerWidth <= 900
      );
    }

    _syncTogglePaneButton() {
      const btn = this._id('act-toggle-pane');
      if (!btn) return;
      const isCollapsed = this._isMobileViewport()
        ? !this.mobileChronicleOpen
        : Boolean(this.paneCollapsed);
      const arrow = isCollapsed ? '‹' : '›';
      const label = isCollapsed
        ? this.locale === 'en'
          ? 'Info'
          : '史志'
        : this.locale === 'en'
          ? 'Full'
          : '全图';
      btn.innerHTML = `<span class="tp-arrow" aria-hidden="true">${arrow}</span><span class="tp-label" id="lbl-toggle-pane">${label}</span>`;
      btn.classList.toggle('is-collapsed', isCollapsed);
      btn.title = isCollapsed
        ? this.locale === 'en'
          ? 'Expand chronicle pane'
          : '展开编年侧栏'
        : this.locale === 'en'
          ? 'Collapse chronicle pane (Full-map view)'
          : '收起编年侧栏（全屏看图）';
    }

    toggleChroniclePane(force) {
      this.paneCollapsed = force !== undefined ? force : !this.paneCollapsed;
      const body = this._id('workspace-body');
      if (body) body.classList.toggle('is-pane-collapsed', this.paneCollapsed);
      this._syncTogglePaneButton();
      setTimeout(() => {
        this._updateScaleBar();
        if (this.activeMilestone) this._positionMilestoneBalloon();
      }, 240);
    }

    toggleMobileChronicle(force) {
      this.mobileChronicleOpen =
        force !== undefined ? force : !this.mobileChronicleOpen;
      if (this.mobileChronicleOpen) {
        if (this.paneCollapsed) {
          this.paneCollapsed = false;
          const bodyEl = this._id('workspace-body');
          if (bodyEl) bodyEl.classList.remove('is-pane-collapsed');
        }
        this.closeMilestoneBalloon();
        this.closeGenealogyCard();
        if (this.challenge && this._isMobileViewport()) {
          this.stopChallenge(true);
        }
      }
      const pane = this._id('chronicle-pane');
      if (pane) {
        pane.scrollTop = 0;
      }
      const body = this._id('workspace-body');
      if (body) {
        body.classList.toggle('is-mobile-chronicle-open', this.mobileChronicleOpen);
      }
      this._updateMobileChronicleBtn(this.dynasties[this.dynastyIdx]);
      this._syncTogglePaneButton();
      setTimeout(() => {
        if (pane && !this.mobileChronicleOpen) {
          pane.scrollTop = 0;
        }
        this._updateScaleBar();
        if (this.activeMilestone) this._positionMilestoneBalloon();
      }, 230);
    }

    _updateMobileChronicleBtn(dynasty) {
      const btn = this._id('act-mobile-chronicle');
      if (!btn) return;
      const cur = dynasty || this.dynasties[this.dynastyIdx];
      const count = (cur && cur.milestones && cur.milestones.length) || 0;
      btn.setAttribute('aria-expanded', this.mobileChronicleOpen ? 'true' : 'false');
      if (this.mobileChronicleOpen) {
        btn.textContent = this.locale === 'en' ? 'Collapse ▾' : '收起史志 ▾';
      } else {
        btn.textContent =
          this.locale === 'en'
            ? `Chronicle (${count}) ▲`
            : `史志 · 事件 (${count}) ▲`;
      }
    }

    _estimateLocalTextWidth(str, fontPx, letterSpacing = 0) {
      if (!str) return 0;
      let w = 0;
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        const isWide =
          (code >= 0x2e80 && code <= 0x9fff) ||
          (code >= 0xf900 && code <= 0xfaff) ||
          (code >= 0xff00 && code <= 0xffef);
        w += (isWide ? fontPx : fontPx * 0.56) + letterSpacing;
      }
      return w;
    }

    _rescaleSvgTypography() {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
      this._lastTypographyWidth = this.camera.w;
      this._lastViewportWidth = vw;
      this._typoDirty = false;
      const z = 1000 / this.camera.w;
      const isNarrowMobile = vw <= 640;
      const isMobile = vw <= 900;
      const mobileTypoBoost = isNarrowMobile ? 1.46 : isMobile ? 1.22 : 1.0;
      const s = (1 / Math.sqrt(z)) * mobileTypoBoost;
      const invScale = s.toFixed(3);
      const tier2MinZoom = isMobile ? 3.15 : 2.18;
      const showTier2 = z >= tier2MinZoom;
      const passMinZoom = isMobile ? 3.25 : 2.28;
      const showPasses = z >= passMinZoom;
      const showMobilePrefDetail = !isMobile || z >= 3.55;
      const showCorridors = !this.grpCorridors.classList.contains('is-hidden');
      this.svg.classList.toggle('is-zoomed-cities', showTier2);
      this.svg.classList.toggle('is-zoomed-passes', showPasses);
      this.svg.classList.toggle('is-mobile-zoomed-detail', showMobilePrefDetail);
      this.svg.classList.toggle('is-corridors-hidden', !showCorridors);

      const showSettlements = !this.grpSettlements.classList.contains('is-hidden');
      const showPrefectures = !this.grpPrefectures.classList.contains('is-hidden');
      const showMilestones = !this.grpMilestones.classList.contains('is-hidden');

      // Scale static markers (milestones, journey waypoints, directional chevrons, challenge pins, genealogy overlays)
      this.svg
        .querySelectorAll(
          '.neighbor-caption, .milestone-pin, #grp-journey g[data-x], #grp-challenge g[data-x], #grp-genealogy g[data-x]'
        )
        .forEach((node) => {
          const x = node.getAttribute('data-x');
          const y = node.getAttribute('data-y');
          const rot = node.getAttribute('data-rot');
          if (x !== null) {
            node.setAttribute(
              'transform',
              rot !== null
                ? `translate(${x},${y}) scale(${invScale}) rotate(${rot})`
                : `translate(${x},${y}) scale(${invScale})`
            );
          }
        });

      // Keep active person numbered pins crisp & non-overlapping in real screen pixels at every zoom level
      if (this.activePerson && this.grpJourney) {
        const svgRect =
          (this.dragState && this.dragState.rect) ||
          (typeof this.svg.getBoundingClientRect === 'function'
            ? this.svg.getBoundingClientRect()
            : null);
        const rw = (svgRect && svgRect.width) || vw || 1000;
        const rh = (svgRect && svgRect.height) || rw * 0.7;
        const screenScale = Math.min(rw / this.camera.w, rh / this.camera.h);
        const pinScale = Math.max(s, 0.92 / Math.max(0.12, screenScale));
        const pinScaleStr = pinScale.toFixed(3);
        const pxPerLocal = pinScale * screenScale;
        const nodes = Array.from(this.grpJourney.querySelectorAll('.journey-node')).sort(
          (a, b) => Number(a.dataset.stopIdx) - Number(b.dataset.stopIdx)
        );
        const pts = nodes.map((n) => ({
          n,
          x: Number(n.getAttribute('data-x')),
          y: Number(n.getAttribute('data-y')),
          ox: 0,
          oy: 0,
        }));
        const minSepPx = 15.8;
        for (let iter = 0; iter < 12; iter++) {
          for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
              const pxI = pts[i].x * screenScale + pts[i].ox * pxPerLocal;
              const pyI = pts[i].y * screenScale + pts[i].oy * pxPerLocal;
              const pxJ = pts[j].x * screenScale + pts[j].ox * pxPerLocal;
              const pyJ = pts[j].y * screenScale + pts[j].oy * pxPerLocal;
              const dx = pxJ - pxI;
              const dy = pyJ - pyI;
              const dist = Math.hypot(dx, dy);
              if (dist < minSepPx) {
                let ux;
                let uy;
                if (dist < 0.05) {
                  const ang = (j - i - 1) * 1.05;
                  ux = Math.cos(ang);
                  uy = Math.sin(ang);
                } else {
                  ux = dx / dist;
                  uy = dy / dist;
                }
                const push = (minSepPx - dist) * 0.52 / Math.max(0.2, pxPerLocal);
                pts[i].ox -= ux * push;
                pts[i].oy -= uy * push;
                pts[j].ox += ux * push;
                pts[j].oy += uy * push;
              }
            }
          }
        }
        for (const p of pts) {
          p.n.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${pinScaleStr})`);
          p.n.setAttribute('data-ox', p.ox.toFixed(2));
          p.n.setAttribute('data-oy', p.oy.toFixed(2));
          const shiftEl = p.n.querySelector('.jn-pin-shift');
          if (shiftEl) {
            shiftEl.setAttribute('transform', `translate(${p.ox.toFixed(2)},${p.oy.toFixed(2)})`);
          }
        }
        const placedRects = pts
          .map((p) => p.n.querySelector('.jn-disc'))
          .filter((el) => el && typeof el.getBoundingClientRect === 'function')
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0);
        const candSlots = [
          { anchor: 'middle', lx: '0', ly: '-12.2' },
          { anchor: 'middle', lx: '0', ly: '19.8' },
          { anchor: 'start', lx: '11.2', ly: '3.8' },
          { anchor: 'end', lx: '-11.2', ly: '3.8' },
        ];
        const labelOrder = pts
          .slice()
          .sort((a, b) => (a.n.classList.contains('is-current') ? -1 : b.n.classList.contains('is-current') ? 1 : 0));
        for (const p of labelOrder) {
          const lbl = p.n.querySelector('.jn-label');
          if (!lbl || typeof lbl.getBoundingClientRect !== 'function') continue;
          const isCur = p.n.classList.contains('is-current');
          lbl.style.display = '';
          let chosenRect = null;
          for (const sl of candSlots) {
            lbl.setAttribute('text-anchor', sl.anchor);
            lbl.setAttribute('x', sl.lx);
            lbl.setAttribute('y', sl.ly);
            const r = lbl.getBoundingClientRect();
            if (!r.width) {
              chosenRect = r;
              break;
            }
            const hit = placedRects.some(
              (o) => r.right > o.left && r.left < o.right && r.bottom > o.top && r.top < o.bottom
            );
            if (!hit) {
              chosenRect = r;
              break;
            }
          }
          if (chosenRect) {
            placedRects.push(chosenRect);
          } else if (isCur) {
            lbl.setAttribute('text-anchor', 'middle');
            lbl.setAttribute('x', '0');
            lbl.setAttribute('y', '-12.2');
            placedRects.push(lbl.getBoundingClientRect());
          } else {
            lbl.style.display = 'none';
          }
        }
      }
      if (this.grpRivers) {
        this.grpRivers.querySelectorAll('.hydro-label').forEach((node) => {
          const x = node.getAttribute('data-x');
          const y = node.getAttribute('data-y');
          const rot = node.getAttribute('data-rot') || '0';
          if (x !== null) {
            node.setAttribute(
              'transform',
              `translate(${x},${y}) scale(${invScale}) rotate(${rot})`
            );
          }
        });
      }

      const occupied = [];
      const overlapArea = (box) => {
        let total = 0;
        for (let i = 0; i < occupied.length; i++) {
          const b = occupied[i];
          const ox = Math.min(box.x2, b.x2) - Math.max(box.x1, b.x1);
          if (ox <= 0) continue;
          const oy = Math.min(box.y2, b.y2) - Math.max(box.y1, b.y1);
          if (oy > 0) total += ox * oy;
        }
        return total;
      };

      const settlementNodes = Array.from(this.svg.querySelectorAll('.settlement-node'));

      // Sync traced Tier-2 city visibility state and reserve all visible city dots and milestone pins
      for (const node of settlementNodes) {
        if (node.classList.contains('is-tier2')) {
          const nLng = parseFloat(node.dataset.lng);
          const nLat = parseFloat(node.dataset.lat);
          const isTraced =
            Boolean(this.activeTrace) &&
            !isNaN(nLng) &&
            !isNaN(nLat) &&
            this.projector.greatCircleKm(this.activeTrace, [nLng, nLat]) <= 28;
          node.classList.toggle('is-trace-city', isTraced);
        }
        const isPass = node.classList.contains('is-pass');
        if (isPass) {
          if (!showCorridors || (!showPasses && !node.classList.contains('is-pass-trace'))) continue;
        } else if (!showSettlements) {
          continue;
        }
        const isT2 = node.classList.contains('is-tier2');
        if (isT2 && !showTier2 && !node.classList.contains('is-trace-city')) continue;
        const cx = parseFloat(node.getAttribute('data-x'));
        const cy = parseFloat(node.getAttribute('data-y'));
        const r = (node.classList.contains('is-capital') ? 5.2 : isPass ? 3.4 : isT2 ? 3.0 : 3.8) * s;
        occupied.push({ x1: cx - r, y1: cy - r, x2: cx + r, y2: cy + r });
      }
      if (showMilestones) {
        this.svg.querySelectorAll('.milestone-pin').forEach((pin) => {
          if (pin.classList.contains('is-future')) return;
          const mx = parseFloat(pin.getAttribute('data-x'));
          const my = parseFloat(pin.getAttribute('data-y'));
          if (!isNaN(mx)) {
            occupied.push({
              x1: mx - 6.2 * s,
              y1: my - 6.2 * s,
              x2: mx + 6.2 * s,
              y2: my + 6.2 * s,
            });
          }
        });
      }
      if (this.grpRivers && !this.grpRivers.classList.contains('is-hidden')) {
        this.grpRivers.querySelectorAll('.hydro-label').forEach((hl) => {
          // Mountain-range names are background context: city labels must never yield to them.
          if (hl.classList.contains('is-range')) return;
          const hx = parseFloat(hl.getAttribute('data-x'));
          const hy = parseFloat(hl.getAttribute('data-y'));
          if (!isNaN(hx) && !isNaN(hy)) {
            const isLake = hl.classList.contains('is-lake');
            const fPx = isLake ? 8.2 : hl.classList.contains('is-trunk') ? 8.6 : 7.4;
            const hw = (this._estimateLocalTextWidth(hl.textContent, fPx, 1.5) * 0.5 + (isLake ? 8 : 4)) * s;
            const hh = (isLake ? 8.5 : 5.5) * s;
            occupied.push({ x1: hx - hw, y1: hy - hh, x2: hx + hw, y2: hy + hh });
          }
        });
      }

      const pinnedCoords = [];
      if (this.grpJourney && this.grpJourney.firstChild) {
        this.grpJourney.querySelectorAll('.journey-node').forEach((jn) => {
          const jx = parseFloat(jn.getAttribute('data-x'));
          const jy = parseFloat(jn.getAttribute('data-y'));
          if (!isNaN(jx) && !isNaN(jy)) {
            pinnedCoords.push([jx, jy]);
            occupied.push({ x1: jx - 10 * s, y1: jy - 10 * s, x2: jx + 10 * s, y2: jy + 10 * s });
            const lbl = jn.querySelector('.jn-label');
            if (lbl && lbl.textContent) {
              const ly = parseFloat(lbl.getAttribute('y') || '-11.5');
              const hw = (this._estimateLocalTextWidth(lbl.textContent, 11.5, 0.5) * 0.5 + 8) * s;
              occupied.push({
                x1: jx - hw,
                y1: jy + (ly - 8) * s,
                x2: jx + hw,
                y2: jy + (ly + 5) * s,
              });
            }
          }
        });
      }
      if (this.grpGenealogy && this.grpGenealogy.firstChild) {
        this.grpGenealogy.querySelectorAll('g[data-x]').forEach((gn) => {
          const gx = parseFloat(gn.getAttribute('data-x'));
          const gy = parseFloat(gn.getAttribute('data-y'));
          if (!isNaN(gx) && !isNaN(gy)) {
            const lbl = gn.querySelector('.trace-pin-label');
            if (lbl && lbl.textContent) {
              pinnedCoords.push([gx, gy]);
              const hw = (this._estimateLocalTextWidth(lbl.textContent, 11, 0.5) * 0.5 + 8) * s;
              occupied.push({
                x1: gx - hw,
                y1: gy + 10 * s,
                x2: gx + hw,
                y2: gy + 26 * s,
              });
            }
          }
        });
      }

      const layoutSettlementLabel = (node, allowCull, maxOverlapRatio = 0.14) => {
        const cx = parseFloat(node.getAttribute('data-x'));
        const cy = parseFloat(node.getAttribute('data-y'));
        node.setAttribute('transform', `translate(${cx.toFixed(1)},${cy.toFixed(1)}) scale(${invScale})`);
        const isPass = node.classList.contains('is-pass');
        if (isPass ? !showCorridors : !showSettlements) return;

        const nameEl = node.querySelector('.name');
        if (!nameEl) return;
        if (pinnedCoords.some(([px, py]) => Math.hypot(cx - px, cy - py) < 4.5)) {
          node.classList.add('is-label-crowded');
          return;
        }
        const tier = node.dataset.tier || '1';
        const f1 = tier === '0' ? 9.6 : tier === '2' || tier === 'pass' ? 7.4 : 8.2;
        const wLocal = this._estimateLocalTextWidth(nameEl.textContent, f1, 0.45) + 7;

        const hasHintTag = node.classList.contains('has-trace-hint');
        if (hasHintTag) {
          occupied.push({
            x1: cx - 64 * s,
            y1: cy + 6 * s,
            x2: cx + 64 * s,
            y2: cy + 28 * s,
          });
        }
        const pref = node.dataset.prefAlign || 'r';
        const dirs = [hasHintTag && pref === 'b' ? 't' : pref];
        for (const d of hasHintTag ? ['r', 'l', 't'] : ['r', 'l', 'b', 't']) {
          if (!dirs.includes(d)) dirs.push(d);
        }

        const dirSpec = (dir) => {
          if (dir === 'l') {
            return {
              anchor: 'end',
              dx: -5.5,
              dy1: 3.0,
              box: {
                x1: cx - (5.5 + wLocal) * s,
                y1: cy - 5.5 * s,
                x2: cx - 3.5 * s,
                y2: cy + 5.5 * s,
              },
            };
          }
          if (dir === 'b') {
            return {
              anchor: 'middle',
              dx: 0,
              dy1: 10.2,
              box: {
                x1: cx - wLocal * 0.52 * s,
                y1: cy + 2.2 * s,
                x2: cx + wLocal * 0.52 * s,
                y2: cy + 12.5 * s,
              },
            };
          }
          if (dir === 't') {
            return {
              anchor: 'middle',
              dx: 0,
              dy1: -4.8,
              box: {
                x1: cx - wLocal * 0.52 * s,
                y1: cy - 13.5 * s,
                x2: cx + wLocal * 0.52 * s,
                y2: cy - 2.2 * s,
              },
            };
          }
          return {
            anchor: 'start',
            dx: 5.5,
            dy1: 3.0,
            box: {
              x1: cx + 3.5 * s,
              y1: cy - 5.5 * s,
              x2: cx + (5.5 + wLocal) * s,
              y2: cy + 5.5 * s,
            },
          };
        };

        let best = null;
        let bestOverlap = Infinity;
        for (let i = 0; i < dirs.length; i++) {
          const spec = dirSpec(dirs[i]);
          const ov = overlapArea(spec.box) + i * 0.01;
          if (ov < bestOverlap) {
            bestOverlap = ov;
            best = spec;
            if (ov < 0.05) break;
          }
        }

        const boxArea = Math.max(1, (best.box.x2 - best.box.x1) * (best.box.y2 - best.box.y1));
        if (allowCull && bestOverlap > boxArea * maxOverlapRatio) {
          node.classList.add('is-label-crowded');
          return;
        }
        node.classList.remove('is-label-crowded');
        nameEl.setAttribute('x', String(best.dx));
        nameEl.setAttribute('y', String(best.dy1));
        nameEl.setAttribute('text-anchor', best.anchor);
        occupied.push(best.box);
      };

      // Tier 1: Capitals first (never culled), then Tier-1 primary cities (gently culled on narrow mobile overview if unavoidable)
      for (const node of settlementNodes) {
        if (node.classList.contains('is-capital')) layoutSettlementLabel(node, false);
      }
      for (const node of settlementNodes) {
        if (
          !node.classList.contains('is-capital') &&
          !node.classList.contains('is-tier2') &&
          !node.classList.contains('is-pass')
        ) {
          layoutSettlementLabel(node, isNarrowMobile && z < 3.4, 0.26);
        }
      }

      // Tier 1b: Strategic mountain/river passes (controlled by 关河丝路 layer; only visible when zoomed >= passMinZoom or traced)
      for (const node of settlementNodes) {
        if (node.classList.contains('is-pass')) {
          if (showCorridors && (showPasses || node.classList.contains('is-pass-trace'))) {
            layoutSettlementLabel(node, !node.classList.contains('is-pass-trace'), 0.14);
          } else {
            const cx = parseFloat(node.getAttribute('data-x'));
            const cy = parseFloat(node.getAttribute('data-y'));
            node.setAttribute('transform', `translate(${cx.toFixed(1)},${cy.toFixed(1)}) scale(${invScale})`);
          }
        }
      }

      // Tier 2: Polity captions (main & rival first, then protectorate & neighbor)
      const polNodes = Array.from(this.grpPolities.querySelectorAll('.polity-caption')).sort(
        (a, b) => {
          const rank = (el) =>
            el.classList.contains('main')
              ? 0
              : el.classList.contains('rival')
                ? 1
                : el.classList.contains('protectorate')
                  ? 2
                  : 3;
          return rank(a) - rank(b);
        }
      );
      const polOffsets = [
        [0, 0],
        [0, 12],
        [0, -12],
        [-14, 0],
        [14, 0],
        [-12, 10],
        [12, 10],
        [-12, -10],
        [12, -10],
        [0, -16],
        [0, 16],
        [-22, 0],
        [22, 0],
        [-20, -15],
        [20, -15],
        [-20, 15],
        [20, 15],
        [-28, -20],
        [0, -26],
        [-34, 0],
        [34, 0],
        [28, -20],
        [-28, 20],
        [28, 20],
        [0, 26],
        [-44, -28],
        [-48, 0],
        [0, -42],
        [44, -28],
        [-44, 28],
        [44, 28],
        [48, 0],
        [0, 42],
        [-64, -22],
        [-64, 22],
        [64, -22],
        [64, 22],
        [0, -60],
        [0, 60],
      ];

      for (const node of polNodes) {
        const cssFontPx = node.classList.contains('neighbor')
          ? 14
          : node.classList.contains('protectorate')
            ? 12
            : node.classList.contains('rival')
              ? 15
              : 19;

        const baseX = parseFloat(node.getAttribute('data-base-x') || node.getAttribute('data-x'));
        const baseY = parseFloat(node.getAttribute('data-base-y') || node.getAttribute('data-y'));
        const ls = node.classList.contains('neighbor')
          ? 2.0
          : node.classList.contains('protectorate')
            ? 1.4
            : 3.2;
        const hw = (this._estimateLocalTextWidth(node.textContent, cssFontPx, ls) * 0.5 + 5) * s;
        const hh = (cssFontPx * 0.56 + 3.5) * s;

        let bestX = baseX;
        let bestY = baseY;
        let bestBox = { x1: baseX - hw, y1: baseY - hh, x2: baseX + hw, y2: baseY + hh };
        let bestScore = Infinity;

        for (let i = 0; i < polOffsets.length; i++) {
          const [ox, oy] = polOffsets[i];
          const cx = baseX + ox * s;
          const cy = baseY + oy * s;
          if ((ox !== 0 || oy !== 0) && node._polShape) {
            const [lngC, latC] = this.projector.toGeo(cx, cy);
            if (!MercatorProjector.pointInShape(lngC, latC, node._polShape)) continue;
            const [lngL, latL] = this.projector.toGeo(cx - hw * 0.5, cy);
            const [lngR, latR] = this.projector.toGeo(cx + hw * 0.5, cy);
            if (
              !MercatorProjector.pointInShape(lngL, latL, node._polShape) ||
              !MercatorProjector.pointInShape(lngR, latR, node._polShape)
            ) {
              continue;
            }
          }
          const candBox = { x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh };
          const ov = overlapArea(candBox) + (ox * ox + oy * oy) * 0.0005;
          if (ov < bestScore) {
            bestScore = ov;
            bestX = cx;
            bestY = cy;
            bestBox = candBox;
            if (ov < 0.05) break;
          }
        }

        // Fallback for very small or narrow polities (e.g., 周, 韩) where strict interior bounds
        // prevented dodging a co-located capital city label
        if (bestScore > 1.0) {
          for (let i = 1; i < Math.min(18, polOffsets.length); i++) {
            const [ox, oy] = polOffsets[i];
            const cx = baseX + ox * s;
            const cy = baseY + oy * s;
            const candBox = { x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh };
            const ov = overlapArea(candBox) + (ox * ox + oy * oy) * 0.002;
            if (ov < bestScore) {
              bestScore = ov;
              bestX = cx;
              bestY = cy;
              bestBox = candBox;
              if (ov < 0.1) break;
            }
          }
        }

        node.setAttribute('data-x', bestX.toFixed(1));
        node.setAttribute('data-y', bestY.toFixed(1));
        node.setAttribute('transform', `translate(${bestX.toFixed(1)},${bestY.toFixed(1)}) scale(${invScale})`);
        occupied.push(bestBox);
      }

      // Tier 2b: Modern neighboring country watermarks (dodge ancient polities/cities or hide when same-named historical polity is active)
      const showPolities = !this.grpPolities.classList.contains('is-hidden');
      const activePolityNames = new Set();
      if (showPolities) {
        for (const pNode of polNodes) {
          if (pNode.dataset && pNode.dataset.polityTitle) {
            activePolityNames.add(pNode.dataset.polityTitle);
          }
        }
      }
      const neighOffsets = [
        [0, 0],
        [0, 15],
        [0, -15],
        [18, 0],
        [-18, 0],
        [15, 13],
        [-15, 13],
        [15, -13],
        [-15, -13],
        [0, 24],
        [0, -24],
        [26, 0],
        [-26, 0],
      ];
      if (this.grpNeighbors && typeof this.grpNeighbors.querySelectorAll === 'function') {
        this.grpNeighbors.querySelectorAll('.neighbor-caption').forEach((node) => {
          const baseX = parseFloat(node.getAttribute('data-base-x') || node.getAttribute('data-x'));
          const baseY = parseFloat(node.getAttribute('data-base-y') || node.getAttribute('data-y'));
          if (isNaN(baseX) || isNaN(baseY)) return;
          if (showPolities && node.dataset && node.dataset.rawName && activePolityNames.has(node.dataset.rawName)) {
            node.classList.add('is-crowded-hidden');
            return;
          }
          const hw = (this._estimateLocalTextWidth(node.textContent, 8.0, 0.8) * 0.5 + 4) * s;
          const hh = 5.8 * s;
          let bestX = baseX;
          let bestY = baseY;
          let bestBox = { x1: baseX - hw, y1: baseY - hh, x2: baseX + hw, y2: baseY + hh };
          let bestOv = Infinity;
          for (let i = 0; i < neighOffsets.length; i++) {
            const [ox, oy] = neighOffsets[i];
            const cx = baseX + ox * s;
            const cy = baseY + oy * s;
            const candBox = { x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh };
            const ov = overlapArea(candBox) + (ox * ox + oy * oy) * 0.0004;
            if (ov < bestOv) {
              bestOv = ov;
              bestX = cx;
              bestY = cy;
              bestBox = candBox;
              if (ov < 0.05) break;
            }
          }
          node.classList.remove('is-crowded-hidden');
          node.setAttribute('data-x', bestX.toFixed(1));
          node.setAttribute('data-y', bestY.toFixed(1));
          node.setAttribute('transform', `translate(${bestX.toFixed(1)},${bestY.toFixed(1)}) scale(${invScale})`);
          occupied.push(bestBox);
        });
      }

      // Tier 3: Corridor captions (dodge or hide if colliding with city/polity labels)
      const corrOffsets = [
        [0, 0],
        [0, -10],
        [0, 10],
        [-14, 0],
        [14, 0],
        [-12, -9],
        [12, -9],
        [-12, 9],
        [12, 9],
      ];
      this.svg.querySelectorAll('.corridor-caption').forEach((node) => {
        const baseX = parseFloat(node.getAttribute('data-base-x') || node.getAttribute('data-x'));
        const baseY = parseFloat(node.getAttribute('data-base-y') || node.getAttribute('data-y'));
        if (isNaN(baseX)) return;
        if (!showCorridors) {
          node.setAttribute('transform', `translate(${baseX.toFixed(1)},${baseY.toFixed(1)}) scale(${invScale})`);
          return;
        }
        const hw = (this._estimateLocalTextWidth(node.textContent, 8.2, 1.4) * 0.5 + 3) * s;
        const hh = 5.2 * s;
        let placed = false;
        for (let i = 0; i < corrOffsets.length; i++) {
          const [ox, oy] = corrOffsets[i];
          const cx = baseX + ox * s;
          const cy = baseY + oy * s;
          const candBox = { x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh };
          if (overlapArea(candBox) <= (candBox.x2 - candBox.x1) * (candBox.y2 - candBox.y1) * 0.08) {
            node.setAttribute('data-x', cx.toFixed(1));
            node.setAttribute('data-y', cy.toFixed(1));
            node.setAttribute('transform', `translate(${cx.toFixed(1)},${cy.toFixed(1)}) scale(${invScale})`);
            node.classList.remove('is-crowded-hidden');
            occupied.push(candBox);
            placed = true;
            break;
          }
        }
        if (!placed) {
          node.setAttribute('transform', `translate(${baseX.toFixed(1)},${baseY.toFixed(1)}) scale(${invScale})`);
          node.classList.add('is-crowded-hidden');
        }
      });

      // Tier 4: Tier-2 secondary cities (visible when z >= tier2MinZoom or traced; auto-flip or cull text if crowded)
      for (const node of settlementNodes) {
        if (node.classList.contains('is-tier2')) {
          if (showTier2 || node.classList.contains('is-trace-city')) {
            layoutSettlementLabel(node, !node.classList.contains('is-trace-city'));
          } else {
            const cx = parseFloat(node.getAttribute('data-x'));
            const cy = parseFloat(node.getAttribute('data-y'));
            node.setAttribute('transform', `translate(${cx.toFixed(1)},${cy.toFixed(1)}) scale(${invScale})`);
          }
        }
      }

      // Tier 5: Region / prefecture watermarks (dodge or hide when crowded)
      const regOffsets = [
        [0, 0],
        [0, -14],
        [0, 14],
        [-18, 0],
        [18, 0],
        [-16, -12],
        [16, -12],
        [-16, 12],
        [16, 12],
        [0, -24],
        [0, 24],
        [-28, 0],
        [28, 0],
        [-24, -18],
        [24, -18],
        [-24, 18],
        [24, 18],
      ];
      this.svg.querySelectorAll('.region-caption').forEach((node) => {
        const baseX = parseFloat(node.getAttribute('data-base-x') || node.getAttribute('data-x'));
        const baseY = parseFloat(node.getAttribute('data-base-y') || node.getAttribute('data-y'));
        if (!showPrefectures) {
          node.setAttribute('transform', `translate(${baseX.toFixed(1)},${baseY.toFixed(1)}) scale(${invScale})`);
          return;
        }
        const hw = (this._estimateLocalTextWidth(node.textContent, 8.8, 1.8) * 0.5 + 3) * s;
        const hh = 6.2 * s;
        let placed = false;
        for (let i = 0; i < regOffsets.length; i++) {
          const [ox, oy] = regOffsets[i];
          const cx = baseX + ox;
          const cy = baseY + oy;
          if ((ox !== 0 || oy !== 0) && node._regShape) {
            const [lng, lat] = this.projector.toGeo(cx, cy);
            if (!MercatorProjector.pointInShape(lng, lat, node._regShape)) continue;
          }
          const candBox = { x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh };
          if (overlapArea(candBox) <= (candBox.x2 - candBox.x1) * (candBox.y2 - candBox.y1) * 0.05) {
            node.setAttribute('data-x', cx.toFixed(1));
            node.setAttribute('data-y', cy.toFixed(1));
            node.setAttribute('transform', `translate(${cx.toFixed(1)},${cy.toFixed(1)}) scale(${invScale})`);
            node.classList.remove('is-crowded-hidden');
            occupied.push(candBox);
            placed = true;
            break;
          }
        }
        if (!placed) {
          node.setAttribute('transform', `translate(${baseX.toFixed(1)},${baseY.toFixed(1)}) scale(${invScale})`);
          node.classList.add('is-crowded-hidden');
        }
      });

      // Tier 6: Mountain-range names are the lowest priority; hide rather than cover any label above.
      // They share the pass zoom threshold so the overview keeps its current density.
      if (this.grpRivers && !this.grpRivers.classList.contains('is-hidden')) {
        this.grpRivers.querySelectorAll('.hydro-label.is-range').forEach((node) => {
          if (!showPasses) {
            node.classList.add('is-crowded-hidden');
            return;
          }
          const rx = parseFloat(node.getAttribute('data-x'));
          const ry = parseFloat(node.getAttribute('data-y'));
          if (isNaN(rx) || isNaN(ry)) return;
          const rad = (parseFloat(node.getAttribute('data-rot')) || 0) * (Math.PI / 180);
          const hw = (this._estimateLocalTextWidth(node.textContent, 7.2, 3.6) * 0.5 + 2) * s;
          const hh = 4.6 * s;
          const ex = Math.abs(Math.cos(rad)) * hw + Math.abs(Math.sin(rad)) * hh;
          const ey = Math.abs(Math.sin(rad)) * hw + Math.abs(Math.cos(rad)) * hh;
          const box = { x1: rx - ex, y1: ry - ey, x2: rx + ex, y2: ry + ey };
          const crowded = overlapArea(box) > (box.x2 - box.x1) * (box.y2 - box.y1) * 0.03;
          node.classList.toggle('is-crowded-hidden', crowded);
          if (!crowded) occupied.push(box);
        });
      }

      this.grpProvNames.querySelectorAll('.province-caption').forEach((node) => {
        node.setAttribute('font-size', (9.5 * s).toFixed(1));
      });
    }

    _animateCameraTo(targetCam) {
      this._cameraTarget = targetCam;
      const from = { ...this.camera };
      const t0 = performance.now();
      const duration = 650;
      if (this.flyRaf) cancelAnimationFrame(this.flyRaf);
      const step = (now) => {
        const k = Math.min(1, (now - t0) / duration);
        const ease = 1 - Math.pow(1 - k, 3);
        const w = from.w + (targetCam.w - from.w) * ease;
        const h = from.h + (targetCam.h - from.h) * ease;
        this.camera = {
          x: from.x + (targetCam.x - from.x) * ease,
          y: from.y + (targetCam.y - from.y) * ease,
          w,
          h,
          zoom: 1000 / w,
        };
        this._applyCamera();
        if (k < 1) {
          this.flyRaf = requestAnimationFrame(step);
        } else {
          this.flyRaf = null;
          this._cameraTarget = null;
        }
      };
      this.flyRaf = requestAnimationFrame(step);
    }

    clearCustomRoute() {
      if (!this.activeCustomRoute) return;
      this.activeCustomRoute = null;
      this.customRouteStopIdx = -1;
      if (this.grpJourney && !this.activePerson) {
        this.grpJourney.innerHTML = '';
      }
      if (this.journeyCard) {
        this.journeyCard.classList.add('is-hidden');
        this.journeyCard.classList.remove('is-custom-route');
        this.journeyCard.innerHTML = '';
      }
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.remove('has-active-journey');
      this._syncMobileOverlayState();
    }

    selectCustomRouteStop(idx, panCamera = true) {
      if (!Array.isArray(this.activeCustomRoute) || !this.activeCustomRoute.length) return;
      const stops = this.activeCustomRoute;
      const clampedIdx = Math.max(0, Math.min(stops.length - 1, idx));
      this.customRouteStopIdx = clampedIdx;
      const st = stops[clampedIdx];
      if (!st) return;
      if (st.year !== undefined && st.year !== this.year) {
        this.jumpToYear(st.year);
      }
      this._drawCustomRouteOverlay(stops);
      if (panCamera && st.lng !== undefined && st.lat !== undefined) {
        const [tx, ty] = this.projector.toScreen(st.lng, st.lat);
        const aspect = this._getViewportAspect();
        const w = Math.max(320, Math.min(this.camera.w, 480));
        const h = w * aspect;
        const isDesktop = typeof window === 'undefined' || window.innerWidth > 900;
        const xFrac = isDesktop ? 0.38 : 0.5;
        const yFrac = isDesktop ? 0.44 : 0.3;
        this._animateCameraTo({ x: tx - w * xFrac, y: ty - h * yFrac, w, h });
      }
      this.openGenealogyAt(st.lng, st.lat, st.query || st.name);
      this._renderCustomRouteCard();
    }

    stepCustomRoute(delta) {
      if (!Array.isArray(this.activeCustomRoute) || !this.activeCustomRoute.length) return;
      const len = this.activeCustomRoute.length;
      const base = this.customRouteStopIdx < 0 ? (delta > 0 ? -1 : 0) : this.customRouteStopIdx;
      const nextIdx = (base + delta + len) % len;
      this.selectCustomRouteStop(nextIdx, true);
    }

    _renderCustomRouteCard() {
      if (!this.journeyCard || !Array.isArray(this.activeCustomRoute) || this.activeCustomRoute.length < 2) {
        return;
      }
      const stops = this.activeCustomRoute;
      const curIdx = this.customRouteStopIdx;
      const isEn = this.locale === 'en';
      const isMultiYear = new Set(stops.map((s) => s.year)).size > 1;
      let totalKm = 0;
      for (let i = 0; i < stops.length - 1; i++) {
        totalKm += this.projector.greatCircleKm(stops[i].coord, stops[i + 1].coord);
      }
      const distStr =
        totalKm > 0
          ? isEn
            ? `~${Math.round(totalKm)} km`
            : `全程约 ${Math.round(totalKm)} km`
          : '';

      const pillsHtml = stops
        .map((st, i) => {
          const rawLbl = st.query || st.name;
          const baseLbl = isEn ? this.trTerm(rawLbl) : this._zh(rawLbl);
          const yrTag =
            st.year < 0 ? (isEn ? `${-st.year} BCE` : `前${-st.year}`) : `${st.year}`;
          const lbl = isMultiYear && st.year !== undefined ? `${baseLbl} (${yrTag})` : baseLbl;
          const cls = i === curIdx ? 'cr-stop-pill is-current' : 'cr-stop-pill';
          return `<button type="button" class="${cls}" data-cidx="${i}"><span class="cr-stop-num">${i + 1}</span><span>${escHtml(lbl)}</span></button>`;
        })
        .join('<span class="cr-stop-arrow">→</span>');

      this.journeyCard.classList.remove('is-hidden', 'is-collapsed');
      this.journeyCard.classList.add('is-custom-route');
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.add('has-active-journey');
      this._syncMobileOverlayState();

      this.journeyCard.innerHTML =
        `<div class="jc-top-bar">` +
        `<span class="jc-step-badge" style="background:#9e2a2b">${
          isEn ? `Route · ${stops.length} Stops` : `行迹路线 · 共 ${stops.length} 站`
        }</span>` +
        (distStr ? `<span class="cr-dist-label">${distStr}</span>` : '') +
        `<div class="cr-top-actions">` +
        `<button type="button" class="jc-close-btn" id="act-custom-overview" title="${
          isEn ? 'Fit entire route on map' : '全线总览视图'
        }">${isEn ? 'Full Route' : '全线视图'}</button>` +
        `<button type="button" class="jc-close-btn" id="act-close-custom-route" title="${
          isEn ? 'Clear Route (Esc)' : '清除自定义路线 (Esc)'
        }">${isEn ? 'Clear ×' : '清除路线 ×'}</button>` +
        `</div>` +
        `</div>` +
        `<div class="cr-stops-bar">` +
        `<div class="cr-stops-list">${pillsHtml}</div>` +
        `<div class="jc-controls">` +
        `<button type="button" class="jc-nav-btn" id="act-custom-prev">${SVG_ICONS.arrowLeft} ${
          isEn ? 'Prev' : '上一站'
        }</button>` +
        `<button type="button" class="jc-nav-btn is-primary" id="act-custom-next">${
          isEn ? 'Next' : '下一站'
        } ${SVG_ICONS.arrowRight}</button>` +
        `</div>` +
        `</div>`;

      this.journeyCard.querySelectorAll('.cr-stop-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.selectCustomRouteStop(Number(btn.dataset.cidx), true);
        });
      });
      const prevBtn = this._id('act-custom-prev');
      if (prevBtn) {
        prevBtn.addEventListener('click', () => this.stepCustomRoute(-1));
      }
      const nextBtn = this._id('act-custom-next');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => this.stepCustomRoute(1));
      }
      const ovBtn = this._id('act-custom-overview');
      if (ovBtn) {
        ovBtn.addEventListener('click', () => {
          this.closeGenealogyCard();
          this.customRouteStopIdx = -1;
          this._renderCustomRoute(stops);
        });
      }
      const closeBtn = this._id('act-close-custom-route');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.clearCustomRoute();
          this.closeGenealogyCard();
        });
      }
      if (this.locale === 'zh-tw') this._applyZhHantDom(this.journeyCard);
    }

    resetCamera() {
      this.clearCustomRoute();
      this._animateCameraTo(this._getDefaultCamera());
    }

    zoomBy(factor, clientX, clientY, animate = true) {
      this._recordGestureMove();
      const [mx, my] =
        clientX !== undefined && clientY !== undefined
          ? this._clientToSvgPoint(clientX, clientY)
          : [this.camera.x + this.camera.w * 0.5, this.camera.y + this.camera.h * 0.5];
      const nextW = Math.max(100, Math.min(1300, this.camera.w / factor));
      const k = nextW / this.camera.w;
      const targetCam = {
        x: mx - (mx - this.camera.x) * k,
        y: my - (my - this.camera.y) * k,
        w: nextW,
        h: this.camera.h * k,
        zoom: 1000 / nextW,
      };
      if (animate && typeof this._animateCameraTo === 'function') {
        this._animateCameraTo(targetCam);
      } else {
        this.camera = targetCam;
        this._applyCamera();
      }
    }

    _panToward(lng, lat) {
      const [tx, ty] = this.projector.toScreen(lng, lat);
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;
      const maxW = isMobile ? 290 : 380;
      const w = Math.min(this.camera.w, maxW);
      const h = w * (this.camera.h / this.camera.w);
      const genCard = this._id('genealogy-card');
      const genOpen = Boolean(genCard && !genCard.classList.contains('is-hidden'));
      const xFrac = !isMobile && genOpen ? 0.38 : 0.5;
      const yFrac = isMobile && genOpen ? 0.21 : 0.45;
      this._animateCameraTo({
        x: tx - w * xFrac,
        y: ty - h * yFrac,
        w,
        h,
      });
    }

    _clientToSvgPoint(clientX, clientY) {
      const rect = this.svg.getBoundingClientRect();
      const scale = Math.min(rect.width / this.camera.w, rect.height / this.camera.h);
      const padX = (rect.width - this.camera.w * scale) * 0.5;
      const padY = (rect.height - this.camera.h * scale) * 0.5;
      return [
        this.camera.x + (clientX - rect.left - padX) / scale,
        this.camera.y + (clientY - rect.top - padY) / scale,
      ];
    }

    // ---------------- Dual-Mode Challenge ----------------
    _stripPromptParenthetical(name) {
      return String(name || '')
        .replace(/（[^）]+）|\([^)]+\)/g, '')
        .trim();
    }

    _sanitizeChallengeClue(text, settlement, displayAncient) {
      if (!text) return '';
      let out = String(text).replace(/（今[^）]+）|\(Now [^)]+\)/gi, '');
      if (this.locale === 'en') {
        const modEn = settlement.modernEn || this.trModernCity(settlement.modern || '');
        const cleanAncEn = String(displayAncient || '').toLowerCase();
        for (const rawPart of String(modEn).split(/[,/·]/)) {
          const part = rawPart.replace(/\b(NW|NE|SW|SE|N|S|E|W)\b/g, '').trim();
          if (part.length >= 3 && !cleanAncEn.includes(part.toLowerCase())) {
            const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), 'this site');
          }
        }
        return out;
      }

      const ancCore = String(displayAncient || '').trim();
      const tokens = new Set();
      const provRe =
        /^(?:黑龙江|内蒙古|新疆|广西|宁夏|西藏|北京|天津|上海|重庆|河北|山西|辽宁|吉林|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾)/;
      const dirRe = /(?:东北|西北|东南|西南|东|西|南|北|境内|一带|附近)$/;
      for (const rawPart of String(settlement.modern || '').split(/[·/、，,\s（）()]+/)) {
        const p0 = rawPart.replace(/^今/, '').trim();
        if (!p0) continue;
        tokens.add(p0);
        const pNoDir = p0.replace(dirRe, '').trim();
        if (pNoDir.length >= 2) tokens.add(pNoDir);
        const pNoProv = pNoDir.replace(provRe, '').trim();
        if (pNoProv.length >= 2) {
          tokens.add(pNoProv);
          if (pNoProv.length === 4) {
            tokens.add(pNoProv.slice(0, 2));
            tokens.add(pNoProv.slice(2, 4));
          }
        }
      }
      const sortedTokens = Array.from(tokens)
        .filter(
          (tok) =>
            tok.length >= 2 &&
            tok !== ancCore &&
            !ancCore.includes(tok) &&
            !tok.includes(ancCore)
        )
        .sort((a, b) => b.length - a.length);
      for (const tok of sortedTokens) {
        out = out.replaceAll(tok, ancCore || '此地');
      }
      return out;
    }

    _buildChallengeDeck(preferCurrentDynasty = false) {
      const deck = [];
      for (const d of this.dynasties) {
        if (d.key === 'prc') continue;
        for (const s of d.settlements || []) {
          if (!s.modern || !Array.isArray(s.coord)) continue;
          if (d.key === 'roc' && !s.isCapital && !s.remark) continue;
          const hasEvents =
            this._collectPlaceEventsForDynasty(d, s.coord[0], s.coord[1], { s, km: 0 }).length > 0;
          if (!s.isCapital && !s.remark && !hasEvents) continue;
          const weight = (s.ancient !== s.modern ? 3 : 1) + (hasEvents ? 1 : 0);
          for (let k = 0; k < weight; k++) {
            deck.push({ dynasty: d, settlement: s });
          }
        }
      }
      for (const p of HistoricalAtlasController.STRATEGIC_PASSES) {
        if (!p || !Array.isArray(p.coord)) continue;
        const focusY = p.focusYear !== undefined ? p.focusYear : p.appear || -221;
        const dIdx = this._findDynastyIndex(focusY);
        const d = this.dynasties[dIdx] || this.dynasties[0];
        if (!d || d.key === 'prc') continue;
        const passSettlement = {
          ancient: p.ancientZh,
          ancientEn: p.ancientEn,
          modern: p.modernZh,
          modernEn: p.modernEn,
          coord: p.coord,
          appear: p.appear,
          vanish: p.vanish,
          focusYear: focusY,
          isPass: true,
          passKey: p.key,
          remark: `${p.rangeZh} · ${p.chokepointZh}`,
          remarkEn: `${p.rangeEn} — ${p.chokepointEn}`,
        };
        for (let k = 0; k < 5; k++) {
          deck.push({ dynasty: d, settlement: passSettlement });
        }
      }
      const chosen = [];
      const seen = new Set();
      if (preferCurrentDynasty) {
        const curDyn = this.dynasties[this.dynastyIdx];
        if (curDyn && curDyn.key !== 'prc') {
          const firstPick =
            deck.find((c) => c.dynasty.key === curDyn.key && c.settlement.ancient === '武威') ||
            deck.find((c) => c.dynasty.key === curDyn.key);
          if (firstPick) {
            seen.add(`${firstPick.dynasty.key}:${firstPick.settlement.ancient}`);
            chosen.push(firstPick);
          }
        }
      }
      while (chosen.length < 10 && deck.length) {
        const idx = Math.floor(Math.random() * deck.length);
        const pick = deck.splice(idx, 1)[0];
        const uid = `${pick.dynasty.key}:${pick.settlement.ancient}`;
        if (seen.has(uid)) continue;
        const tooClose = chosen.some(
          (c) => this.projector.greatCircleKm(c.settlement.coord, pick.settlement.coord) < 35
        );
        if (!tooClose) {
          seen.add(uid);
          chosen.push(pick);
        }
      }
      return chosen;
    }

    _syncChallengeScrubberState(locked) {
      const dock = this._id('scrubber-dock');
      if (dock) dock.classList.toggle('is-challenge-locked', Boolean(locked));
      for (const id of [
        'act-autoplay',
        'act-play-speed',
        'act-step-prev',
        'act-step-next',
        'inp-year',
      ]) {
        const el = this._id(id);
        if (el) el.disabled = Boolean(locked);
      }
    }

    startChallenge(opts = {}) {
      this._recordGestureClick();
      this.stopAutoplay();
      this.clearCustomRoute();
      this.closeMilestoneBalloon();
      this.closeGenealogyCard();
      const sb = this._id('map-search-box');
      if (sb) sb.classList.add('is-hidden');
      const vf = this._id('viewport-frame');
      if (vf) {
        vf.classList.add('has-active-challenge');
        vf.classList.remove('is-challenge-answered');
      }
      this._syncChallengeScrubberState(true);
      this.challenge = {
        variant: 'locate',
        deck: this._buildChallengeDeck(Boolean(opts && opts.preferCurrentDynasty)),
        index: 0,
        score: 0,
        answered: false,
      };
      this._syncImmersivePaneState();
      this._id('challenge-card').classList.remove('is-hidden');
      const actChal = this._id('act-challenge');
      if (actChal) actChal.classList.add('is-active');
      const lblChal = this._id('lbl-challenge') || actChal;
      if (lblChal) {
        lblChal.textContent =
          this.locale === 'en' ? 'Quiz Active · Click to Exit' : '挑战进行中 · 点击退出';
      }
      this.svg.classList.add('is-crosshair');
      this.grpSettlements.classList.add('is-hidden');
      if (this.grpMilestones) this.grpMilestones.classList.add('is-hidden');
      this._id('act-next-round').onclick = null;
      this.presentChallengeRound();
    }

    stopChallenge(keepPaneState = false) {
      this.challenge = null;
      this.grpChallenge.innerHTML = '';
      this._id('challenge-card').classList.add('is-hidden');
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.remove('has-active-challenge', 'is-challenge-answered');
      this._syncChallengeScrubberState(false);
      const sb = this._id('map-search-box');
      if (sb) sb.classList.remove('is-hidden');
      const actChal = this._id('act-challenge');
      if (actChal) actChal.classList.remove('is-active');
      const lblChal = this._id('lbl-challenge') || actChal;
      if (lblChal) {
        lblChal.textContent =
          this.locale === 'en' ? 'Map Pinpoint · Ancient Place Quiz' : '舆图寻址 · 古地名小试';
      }
      this.svg.classList.remove('is-crosshair');
      const chkSettle = this._id('chk-settlements');
      this.grpSettlements.classList.toggle('is-hidden', Boolean(chkSettle && !chkSettle.checked));
      const chkMilestones = this._id('chk-milestones');
      if (this.grpMilestones) {
        this.grpMilestones.classList.toggle(
          'is-hidden',
          Boolean(chkMilestones && !chkMilestones.checked)
        );
      }
      if (!keepPaneState) {
        this._syncImmersivePaneState();
      }
      this._syncDocumentSeoMeta();
    }

    _renderChallengeQuestionText() {
      const q = this.challenge;
      if (!q || q.index >= q.deck.length) return;
      const cur = q.deck[q.index];
      this._id('challenge-step').textContent =
        this.locale === 'en'
          ? `Q ${q.index + 1} / ${q.deck.length}`
          : `第 ${q.index + 1} / ${q.deck.length} 题`;
      this._id('challenge-points').textContent = `${this.uiStr('quiz_score', '得分')} ${q.score}`;

      const displayAncientZh = this._stripPromptParenthetical(cur.settlement.ancient);
      const rawAncientEn = cur.settlement.ancientEn
        ? cur.settlement.ancientEn
        : cur.dynasty.key === 'roc' || cur.dynasty.key === 'prc'
          ? this.trModernCity(displayAncientZh)
          : this.trTerm(displayAncientZh);
      const displayAncientEn = this._stripPromptParenthetical(rawAncientEn);
      const displayTarget = this.locale === 'en' ? displayAncientEn : displayAncientZh;

      const rawBaseClue = cur.settlement.isPass
        ? this.locale === 'en'
          ? cur.settlement.remarkEn || cur.settlement.remark
          : cur.settlement.remark
        : cur.settlement.remark
          ? this.trTerm(cur.settlement.remark)
          : cur.settlement.isCapital
            ? this.locale === 'en'
              ? 'Imperial / Dynastic Capital'
              : '当朝都城'
            : this.locale === 'en'
              ? 'Strategic Prefecture & Hub'
              : '当朝重镇州府';
      const baseClue = this._sanitizeChallengeClue(rawBaseClue, cur.settlement, displayTarget);

      const placeEvents = this._collectPlaceEventsForDynasty(
        cur.dynasty,
        cur.settlement.coord[0],
        cur.settlement.coord[1],
        { s: cur.settlement, km: 0 }
      );
      let extraEventStr = '';
      if (placeEvents.length && !cur.settlement.isPass) {
        const ev = placeEvents[0];
        const yrLbl =
          this.locale === 'en'
            ? this.formatYear(ev.year)
            : `${ev.year <= 0 ? '前' + -ev.year : ev.year}年`;
        const cleanEv = this._sanitizeChallengeClue(ev.text, cur.settlement, displayTarget);
        extraEventStr = ` · ${yrLbl}：${cleanEv}`;
      }

      const clueTag = cur.settlement.isPass
        ? this.locale === 'en'
          ? 'Strategic Pass'
          : '雄关形胜'
        : this.locale === 'en'
          ? 'Historical Clue'
          : '当朝掌故';
      const promptHtml = cur.settlement.isPass
        ? this.locale === 'en'
          ? `Click on the map to pinpoint <b>${this.dynastyName(cur.dynasty)}</b>’s strategic pass <b>“${escHtml(displayAncientEn)}”</b>`
          : `请在舆图上标定 <b>【${this.dynastyName(cur.dynasty)}】</b> 时期的天下名关 <b>「${escHtml(displayAncientZh)}」</b>`
        : this.locale === 'en'
          ? `Click on the map to pinpoint <b>${this.dynastyName(cur.dynasty)}</b>’s <b>“${escHtml(displayAncientEn)}”</b>`
          : `请在舆图上标定 <b>【${this.dynastyName(cur.dynasty)}】</b> 时期的 <b>「${escHtml(displayAncientZh)}」</b>`;

      this._id('challenge-question').innerHTML =
        `<div>${promptHtml}</div>` +
        `<div class="challenge-clue-box"><span class="clue-tag">${clueTag}</span><span>${escHtml(baseClue + extraEventStr)}</span></div>`;
      if (this.locale === 'zh-tw') this._applyZhHantDom(this._id('challenge-banner'));
    }

    presentChallengeRound() {
      const q = this.challenge;
      this.grpChallenge.innerHTML = '';
      q.answered = false;
      q.finished = false;
      q.pendingGuess = null;
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.remove('is-challenge-answered');
      if (this.hoverTip) {
        this.hoverTip.classList.add('is-hidden');
        this.hoverTip.classList.remove('is-interactive');
      }
      const defCam = this._getDefaultCamera();
      if (
        this.camera.w < defCam.w * 0.92 ||
        Math.hypot(this.camera.x - defCam.x, this.camera.y - defCam.y) > 40
      ) {
        this.resetCamera();
      }
      const cur = q.deck[q.index];
      let roundYear =
        cur.settlement.focusYear !== undefined ? cur.settlement.focusYear : cur.dynasty.focusYear;
      if (cur.settlement.appear !== undefined && roundYear < cur.settlement.appear) {
        roundYear = cur.settlement.appear;
      }
      if (cur.settlement.vanish !== undefined && roundYear > cur.settlement.vanish) {
        roundYear = cur.settlement.vanish;
      }
      this.jumpToYear(this._clampYearToDynasty(cur.dynasty, roundYear));
      this.grpSettlements.classList.add('is-hidden');
      if (this.grpMilestones) this.grpMilestones.classList.add('is-hidden');
      this._id('challenge-result').classList.add('is-hidden');
      this._renderChallengeQuestionText();
    }

    _previewLocatePin(svgX, svgY) {
      const q = this.challenge;
      if (!q || q.answered) return;
      q.pendingGuess = [svgX, svgY];
      this.grpChallenge.innerHTML = '';

      const gPin = this._svgNode(
        'g',
        { 'data-x': svgX.toFixed(1), 'data-y': svgY.toFixed(1) },
        this.grpChallenge
      );
      this._svgNode('circle', { class: 'guess-preview-ring', r: 10 }, gPin);
      this._svgNode('circle', { class: 'guess-pin', r: 4.5 }, gPin);
      this._rescaleSvgTypography();

      this._id('challenge-verdict').textContent =
        this.locale === 'en'
          ? 'Pin placed. Tap elsewhere to adjust, or confirm below.'
          : '已落针，可点击他处微调位置，或点击下方确认作答。';
      this._id('act-next-round').innerHTML =
        this.locale === 'en'
          ? `Confirm Pin ${SVG_ICONS.arrowRight}`
          : `确认落针 ${SVG_ICONS.arrowRight}`;
      this._id('challenge-result').classList.remove('is-hidden');
      if (this.locale === 'zh-tw') this._applyZhHantDom(this._id('challenge-banner'));
    }

    _renderChallengeAnsweredVerdict() {
      const q = this.challenge;
      if (!q || !q.answered || q.index >= q.deck.length) return;
      const cur = q.deck[q.index];
      const km = q.lastKm || 0;
      const pts = q.lastPts || 0;
      const ansAncEn = cur.settlement.ancientEn
        ? cur.settlement.ancientEn
        : cur.dynasty.key === 'roc' || cur.dynasty.key === 'prc'
          ? this.trModernCity(cur.settlement.ancient)
          : this.trTerm(cur.settlement.ancient);
      const ansModEn = cur.settlement.modernEn || this.trModernCity(cur.settlement.modern);
      const aLabelText =
        this.locale === 'en'
          ? `${ansAncEn} (${ansModEn})`
          : `${cur.settlement.ancient}（今${cur.settlement.modern}）`;
      if (this.grpChallenge) {
        const textNode = this.grpChallenge.querySelector('text');
        if (textNode) textNode.textContent = aLabelText;
      }
      this._id('challenge-points').textContent = `${this.uiStr('quiz_score', '得分')} ${q.score}`;
      const comment =
        pts === 100
          ? this.uiStr('verdict_100', '正中靶心！')
          : pts >= 80
            ? this.uiStr('verdict_80', '非常接近！')
            : pts >= 55
              ? this.uiStr('verdict_55', '方位基本正确。')
              : pts > 0
                ? this.uiStr('verdict_25', '稍有点远。')
                : this.uiStr('verdict_0', '偏离较远。');

      this._id('challenge-verdict').innerHTML =
        this.locale === 'en'
          ? `${comment} Off by <b>${km} km</b> (+${pts} pts) · Answer: ${escHtml(ansAncEn)} (${escHtml(ansModEn)})`
          : `${comment} 偏差 <b>${km} 公里</b>（+${pts} 分）· 答案：${escHtml(cur.settlement.ancient)}（今${escHtml(cur.settlement.modern)}）`;

      this._id('act-next-round').innerHTML =
        q.index + 1 >= q.deck.length
          ? this.uiStr('quiz_see_result', '查看成绩')
          : `${this.locale === 'en' ? 'Next' : '下一题'} ${SVG_ICONS.arrowRight}`;
      this._id('challenge-result').classList.remove('is-hidden');
      if (this.locale === 'zh-tw') {
        this._applyZhHantDom(this._id('challenge-banner'));
        this._applyZhHantDom(this.grpChallenge);
      }
    }

    _evaluateLocateClick(svgX, svgY) {
      const q = this.challenge;
      if (!q || q.answered) return;
      q.answered = true;
      q.pendingGuess = null;
      this.grpChallenge.innerHTML = '';
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.add('is-challenge-answered');
      const chkMilestones = this._id('chk-milestones');
      if (this.grpMilestones) {
        this.grpMilestones.classList.toggle(
          'is-hidden',
          Boolean(chkMilestones && !chkMilestones.checked)
        );
      }

      const cur = q.deck[q.index];
      const guessGeo = this.projector.toGeo(svgX, svgY);
      const km = Math.round(this.projector.greatCircleKm(guessGeo, cur.settlement.coord));
      const pts =
        km <= 80
          ? 100
          : km <= 200
            ? 80
            : km <= 380
              ? 55
              : km <= 600
                ? 25
                : 0;
      q.score += pts;
      q.lastKm = km;
      q.lastPts = pts;

      const [ax, ay] = this.projector.toScreen(
        cur.settlement.coord[0],
        cur.settlement.coord[1]
      );
      const radPx =
        (200 / (111 * Math.cos(cur.settlement.coord[1] * DEG_TO_RAD))) * this.projector.scale;

      this._svgNode(
        'circle',
        { class: 'target-ring', cx: ax.toFixed(1), cy: ay.toFixed(1), r: radPx.toFixed(1) },
        this.grpChallenge
      );
      this._svgNode(
        'line',
        {
          class: 'error-line',
          x1: svgX.toFixed(1),
          y1: svgY.toFixed(1),
          x2: ax.toFixed(1),
          y2: ay.toFixed(1),
        },
        this.grpChallenge
      );

      const gPin = this._svgNode(
        'g',
        { 'data-x': svgX.toFixed(1), 'data-y': svgY.toFixed(1) },
        this.grpChallenge
      );
      this._svgNode('circle', { class: 'guess-pin', r: 4.5 }, gPin);

      const aPin = this._svgNode(
        'g',
        { 'data-x': ax.toFixed(1), 'data-y': ay.toFixed(1) },
        this.grpChallenge
      );
      this._svgNode('circle', { class: 'answer-pin', r: 5 }, aPin);
      const aLabel = this._svgNode(
        'text',
        {
          x: 8,
          y: 4,
          style: 'font-size:12px;font-weight:700;fill:#1f5f3e;filter:url(#label-halo)',
        },
        aPin
      );
      const ansAncEn = cur.settlement.ancientEn
        ? cur.settlement.ancientEn
        : cur.dynasty.key === 'roc' || cur.dynasty.key === 'prc'
          ? this.trModernCity(cur.settlement.ancient)
          : this.trTerm(cur.settlement.ancient);
      const ansModEn = cur.settlement.modernEn || this.trModernCity(cur.settlement.modern);
      aLabel.textContent =
        this.locale === 'en'
          ? `${ansAncEn} (${ansModEn})`
          : `${cur.settlement.ancient}（今${cur.settlement.modern}）`;
      this._rescaleSvgTypography();
      this._renderChallengeAnsweredVerdict();
    }

    _finishChallenge() {
      const q = this.challenge;
      q.finished = true;
      const total = q.deck.length * 100;
      const rank =
        q.score >= 850
          ? this.uiStr('title_850', '太史令 · 舆图大家')
          : q.score >= 650
            ? this.uiStr('title_650', '职方郎中 · 熟稔疆理')
            : q.score >= 400
              ? this.uiStr('title_400', '州郡从事 · 略通古今')
              : this.uiStr('title_0', '江湖行客 · 不妨多逛逛时间轴');

      this._id('challenge-points').textContent = `${this.uiStr('quiz_score', '得分')} ${q.score}`;
      this._id('challenge-question').innerHTML =
        this.locale === 'en'
          ? `Challenge complete! Total score <b>${q.score} / ${total}</b> — Rank: <b>${escHtml(rank)}</b>`
          : `挑战结束！总分 <b>${q.score} / ${total}</b> —— 封号：<b>「${escHtml(rank)}」</b>`;
      this._id('challenge-verdict').textContent = this.uiStr(
        'quiz_again_msg',
        '可再战一局，或关闭回到自由浏览。'
      );
      const nextBtn = this._id('act-next-round');
      nextBtn.textContent = this.uiStr('quiz_again', '再来一局');
      nextBtn.onclick = () => {
        nextBtn.onclick = null;
        this.startChallenge();
      };
      if (this.locale === 'zh-tw') this._applyZhHantDom(this._id('challenge-banner'));
    }

    // ---------------- Historical Journeys (青史行迹) ----------------
    static get HISTORICAL_JOURNEYS() {
      return (window.ATLAS_LORE_DATA && window.ATLAS_LORE_DATA.HISTORICAL_JOURNEYS) || [];
    }

    _getCustomRouteVisibleTopFrac() {
      if (typeof window === 'undefined' || window.innerWidth > 900) return 1;
      const vf = this._id('viewport-frame');
      if (
        vf &&
        this.journeyCard &&
        typeof vf.getBoundingClientRect === 'function' &&
        typeof this.journeyCard.getBoundingClientRect === 'function' &&
        !this.journeyCard.classList.contains('is-hidden')
      ) {
        const vfRect = vf.getBoundingClientRect();
        const jcRect = this.journeyCard.getBoundingClientRect();
        if (
          vfRect.height > 80 &&
          jcRect.height > 20 &&
          jcRect.top > vfRect.top + vfRect.height * 0.25
        ) {
          return Math.max(0.42, Math.min(0.92, (jcRect.top - vfRect.top - 10) / vfRect.height));
        }
      }
      return 0.72;
    }

    _buildJourneySegmentInfo(c1, c2, viaCoords) {
      if (!c1 || !c2) return null;
      const geoPts = [c1, ...(viaCoords || []), c2];
      const pts = geoPts.map((pt) => this.projector.toScreen(pt[0], pt[1]));
      const first = pts[0];
      const last = pts[pts.length - 1];
      const chord = Math.hypot(last[0] - first[0], last[1] - first[1]);
      if (chord < 8) return null;

      if (pts.length === 2) {
        const [x1, y1] = first;
        const [x2, y2] = last;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const bend = Math.max(9, Math.min(34, chord * 0.165));
        const cx = (x1 + x2) * 0.5 - (dy / chord) * bend;
        const cy = (y1 + y2) * 0.5 + (dx / chord) * bend;
        const t = 0.53;
        const mt = 1 - t;
        const mx = mt * mt * x1 + 2 * mt * t * cx + t * t * x2;
        const my = mt * mt * y1 + 2 * mt * t * cy + t * t * y2;
        const tx = 2 * mt * (cx - x1) + 2 * t * (x2 - cx);
        const ty = 2 * mt * (cy - y1) + 2 * t * (y2 - cy);
        return {
          d: `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
          mx,
          my,
          angleDeg: (Math.atan2(ty, tx) * 180) / Math.PI,
          chord,
        };
      }

      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      const midSeg = Math.floor((pts.length - 1) * 0.5);
      let mx = (first[0] + last[0]) * 0.5;
      let my = (first[1] + last[1]) * 0.5;
      let angleDeg = (Math.atan2(last[1] - first[1], last[0] - first[0]) * 180) / Math.PI;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
        const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
        const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
        const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += `C${cp1x.toFixed(1)} ${cp1y.toFixed(1)},${cp2x.toFixed(1)} ${cp2y.toFixed(1)},${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
        if (i === midSeg) {
          mx = 0.125 * p1[0] + 0.375 * cp1x + 0.375 * cp2x + 0.125 * p2[0];
          my = 0.125 * p1[1] + 0.375 * cp1y + 0.375 * cp2y + 0.125 * p2[1];
          const tx = 0.75 * (cp1x - p1[0]) + 1.5 * (cp2x - cp1x) + 0.75 * (p2[0] - cp2x);
          const ty = 0.75 * (cp1y - p1[1]) + 1.5 * (cp2y - cp1y) + 0.75 * (p2[1] - cp2y);
          angleDeg = (Math.atan2(ty, tx) * 180) / Math.PI;
        }
      }
      return { d, mx, my, angleDeg, chord };
    }

    _renderCartographicTrajectory(segments, curIdx, accentColor = '#bd2d22') {
      if (!this.grpJourney || !Array.isArray(segments) || !segments.length) return;
      const appendChevron = (seg, cls) => {
        const g = this._svgNode(
          'g',
          {
            class: `journey-dir-mark${cls ? ' ' + cls : ''}`,
            'data-x': seg.mx.toFixed(1),
            'data-y': seg.my.toFixed(1),
            'data-rot': seg.angleDeg.toFixed(1),
          },
          this.grpJourney
        );
        g.style.color = accentColor;
        this._svgNode(
          'path',
          { d: 'M-3.5 -2.45L2.75 0L-3.5 2.45L-1.85 0Z', class: 'journey-chevron' },
          g
        );
      };

      if (curIdx < 0) {
        const fullD = segments.map((s) => s.d).join(' ');
        this._svgNode('path', { d: fullD, class: 'journey-track-halo' }, this.grpJourney);
        this._svgNode(
          'path',
          { d: fullD, class: 'journey-track-thread', stroke: accentColor },
          this.grpJourney
        );
        const placedMarks = [];
        for (const seg of segments) {
          if (seg.chord < 20) continue;
          if (placedMarks.some(([px, py]) => Math.hypot(px - seg.mx, py - seg.my) < 15)) continue;
          placedMarks.push([seg.mx, seg.my]);
          appendChevron(seg, '');
        }
        return;
      }

      const passedSegs = segments.filter((s) => s.toIdx < curIdx);
      const passedD = passedSegs.map((s) => s.d).join(' ');
      const focusSeg = segments.find((s) => s.toIdx === curIdx) || null;
      const upcomingD = segments.filter((s) => s.toIdx > curIdx).map((s) => s.d).join(' ');
      const bgD = [passedD, upcomingD].filter(Boolean).join(' ');
      if (bgD) {
        this._svgNode('path', { d: bgD, class: 'journey-track-halo' }, this.grpJourney);
      }
      if (upcomingD) {
        this._svgNode('path', { d: upcomingD, class: 'journey-track-upcoming' }, this.grpJourney);
      }
      if (passedD) {
        this._svgNode(
          'path',
          { d: passedD, class: 'journey-track-passed', stroke: '#b83327' },
          this.grpJourney
        );
        const placedMuted = [];
        for (const seg of passedSegs) {
          if (seg.chord < 26) continue;
          if (placedMuted.some(([px, py]) => Math.hypot(px - seg.mx, py - seg.my) < 18)) continue;
          placedMuted.push([seg.mx, seg.my]);
          appendChevron(seg, 'is-muted');
        }
      }
      if (focusSeg) {
        this._svgNode(
          'path',
          { d: focusSeg.d, class: 'journey-track-halo is-focus' },
          this.grpJourney
        );
        this._svgNode(
          'path',
          { d: focusSeg.d, class: 'journey-track-focus', stroke: '#c6281c' },
          this.grpJourney
        );
        appendChevron(focusSeg, 'is-focus');
      }
    }

    // ---------------- Global Quick Search ----------------
    _ensureSearchIndex() {
      if (!this._fullSnapshotsLoaded && typeof window !== 'undefined') {
        this._ensureFullSnapshots();
      }
      if (this.searchIndex) return this.searchIndex;
      const entries = [];

      // 0a. Historical Figures Chronicle Index (点人溯事)
      for (const p of HistoricalAtlasController.PERSON_PROFILES) {
        const d =
          this.dynasties.find((item) => item.key === p.dynastyKey) ||
          this.dynasties[this._findDynastyIndex(p.span ? p.span[0] : 0)] ||
          this.dynasties[0];
        const evCount = this._collectPersonEvents(p).length;
        const aliases = this._personSearchAliases(p);
        const briefCourtesyZh = (p.courtesyZh || d.title).split(/\s*·\s*/)[0];
        const rawFirstEn = (p.courtesyEn || d.title).split(/\s*(?:·|,)\s*/)[0];
        const briefCourtesyEn = rawFirstEn.length <= 14 ? rawFirstEn : '';
        entries.push({
          kind: 'person',
          personKey: p.key,
          personProfile: p,
          dynasty: d,
          year: null,
          aliases,
          titleZh: p.zh,
          subZh: `${briefCourtesyZh} · 共 ${evCount} 处史事`,
          titleEn: p.en,
          subEn: briefCourtesyEn ? `${briefCourtesyEn} · ${evCount} events` : `${evCount} chronicle events`,
          keywords: `${p.zh} ${p.en} ${p.courtesyZh || ''} ${p.courtesyEn || ''} ${aliases.join(' ')} 人物 生平 事迹 行迹`.toLowerCase(),
        });
      }

      // 0b. Map Pinpoint Quiz Mode (舆图寻址 · 古地名小试)
      entries.push({
        kind: 'quiz',
        dynasty: this.dynasties[2] || this.dynasties[0],
        year: null,
        titleZh: '舆图寻址 · 古地名小试',
        subZh: '盲图落针标定历代名城与雄关 · 10题计分',
        titleEn: 'Map Pinpoint · Ancient Place Quiz',
        subEn: 'Pinpoint 10 ancient cities & strategic passes on the map',
        keywords: '舆图寻址 古地名小试 挑战 猜地名 雅集 quiz pinpoint challenge game'.toLowerCase(),
      });

      // 0. Dynasties / Historical Periods
      for (const d of this.dynasties) {
        const enDyn = (this.enLocale.dynasties && this.enLocale.dynasties[d.key]) || {};
        const nameEn = enDyn.name || d.title;
        const shortEn = enDyn.short || d.badge || d.title;
        const spanZh =
          d.key === 'prc'
            ? `${d.fromYear}—`
            : `${d.fromYear <= 0 ? '前' + -d.fromYear : d.fromYear}—${d.toYear <= 0 ? '前' + -d.toYear : d.toYear}`;
        const spanEn =
          d.key === 'prc'
            ? `${d.fromYear} CE –`
            : `${d.fromYear <= 0 ? -d.fromYear + ' BCE' : d.fromYear + ' CE'} – ${d.toYear <= 0 ? -d.toYear + ' BCE' : d.toYear + ' CE'}`;
        entries.push({
          kind: 'dynasty',
          dynasty: d,
          year: d.focusYear,
          titleZh: d.title,
          subZh: `${spanZh} · 都城：${d.seat}`,
          titleEn: nameEn,
          subEn: `${spanEn} · ${enDyn.capital || d.seat}`,
          keywords: `${d.title} ${d.badge || ''} ${d.seat || ''} ${nameEn} ${shortEn}`.toLowerCase(),
        });
      }

      // 1. Historical Settlements (Ancient & Modern Cities)
      for (const d of this.dynasties) {
        const isModernDyn = d.key === 'roc' || d.key === 'prc';
        const enDyn = (this.enLocale.dynasties && this.enLocale.dynasties[d.key]) || {};
        const dynNameEn = enDyn.name || d.title;
        for (const s of d.settlements || []) {
          const yr = s.appear !== undefined ? Math.max(d.fromYear, s.appear) : d.focusYear;
          const rawAncEn = this._enDict(s.ancient);
          const ancEn = isModernDyn ? this._enModernCity(s.ancient) : rawAncEn;
          const modEn = this._enModernCity(s.modern || '');
          const remEn = this._enDict(s.remark || '');
          entries.push({
            kind: 'city',
            dynasty: d,
            year: yr,
            coord: s.coord,
            tier: s.tier || 1,
            isCapital: Boolean(s.isCapital),
            titleZh: s.ancient,
            modernZh: s.modern || '',
            subZh: s.modern && s.modern !== s.ancient ? `今${s.modern}` : s.remark || '',
            titleEn: ancEn,
            modernEn: modEn,
            subEn: s.modern && s.modern !== s.ancient ? `Now ${modEn}` : remEn,
            keywords: `${s.ancient} ${s.modern || ''} ${s.remark || ''} ${d.title} ${dynNameEn} ${rawAncEn} ${ancEn} ${modEn} ${remEn}`.toLowerCase(),
          });
        }
      }

      // 1b. Strategic Historical Passes (名关雄隘 · 天下锁钥)
      for (const p of HistoricalAtlasController.STRATEGIC_PASSES) {
        const dIdx = this._findDynastyIndex(p.focusYear || -200);
        const d = this.dynasties[dIdx] || this.dynasties[0];
        const aliases = (p.aliases || []).map((a) => a.toLowerCase());
        const aliasStr = aliases.join(' ');
        entries.push({
          kind: 'pass',
          passKey: p.key,
          dynasty: d,
          year: p.focusYear || d.focusYear,
          coord: p.coord,
          aliases,
          titleZh: p.ancientZh,
          subZh: `今${p.modernZh} · ${p.rangeZh}`,
          titleEn: p.ancientEn,
          subEn: `${p.modernEn} · ${p.rangeEn}`,
          keywords: `${p.ancientZh} ${aliasStr} ${p.modernZh} ${p.rangeZh} ${p.ancientEn} ${p.modernEn} ${p.rangeEn} 名关 雄关 关隘 险关 pass`.toLowerCase(),
        });
      }

      // 1c. Poetic & Historical Gazetteer (诗词名胜 · 古战场 · 关隘渡口)
      for (const g of HistoricalAtlasController.PLACE_GAZETTEER) {
        const aliases = (g.aliases || []).map((a) => a.toLowerCase());
        const aliasSub = (g.aliases || []).slice(0, 3).join(' · ');
        const asciiKeys = (g.asciiAliases || []).join(' ');
        const nameEn = this._enDict(g.name);
        const modEn = this._enModernCity(g.modern || '');
        entries.push({
          kind: 'gazetteer',
          dynasty: null,
          year: null,
          coord: g.coord,
          zoom: g.zoom || 2.5,
          aliases,
          titleZh: g.name,
          subZh: `今${g.modern}${aliasSub ? ' · ' + aliasSub : ''}`,
          titleEn: nameEn,
          subEn: modEn ? `Now ${modEn}` : '',
          keywords: `${g.name} ${aliases.join(' ')} ${asciiKeys} ${g.modern || ''} ${nameEn} ${modEn} 名胜 古迹 古战场`.toLowerCase(),
        });
      }

      // 2. Prefectures & Macro Regions across snapshots
      const seenAdmin = new Set();
      for (const d of this.dynasties) {
        const phaseList = d.phases && d.phases.length ? d.phases : [{ until: d.toYear, snap: `s_${d.key}` }];
        phaseList.forEach((ph, idx) => {
          const sy = idx === 0 ? d.fromYear : phaseList[idx - 1].until;
          const midY = Math.round((sy + ph.until - 1) * 0.5);
          const snap = this.snapshots[ph.snap];
          if (!snap) return;
          for (const item of [...(snap.regions || []), ...(snap.prefectures || [])]) {
            if (!item.title || !item.anchor) continue;
            const uid = `${d.key}:${item.title}`;
            if (seenAdmin.has(uid)) continue;
            seenAdmin.add(uid);
            const isPref = (snap.prefectures || []).includes(item);
            const itemEn = this._enDict(item.title);
            entries.push({
              kind: isPref ? 'prefecture' : 'region',
              dynasty: d,
              year: midY,
              coord: item.anchor,
              prefTitle: isPref ? item.title : null,
              titleZh: item.title,
              subZh: item.category && !item.title.endsWith(item.category) ? item.category : '',
              titleEn: itemEn,
              subEn: '',
              keywords: `${item.title} ${itemEn} ${d.title}`.toLowerCase(),
            });
          }
        });
      }

      // 3. Historical Milestones / Events
      for (const d of this.dynasties) {
        for (const m of d.milestones || []) {
          const enHead = this._enMilestoneHeadline(d, m);
          const siteEn = m.site ? this._enDict(m.site) : '';
          const yrEn = m.year <= 0 ? `${-m.year || 1} BCE` : `${m.year} CE`;
          entries.push({
            kind: 'event',
            dynasty: d,
            year: this._clampYearToDynasty(d, m.year),
            milestone: m,
            coord: m.coord,
            titleZh: m.headline,
            subZh: `${m.year <= 0 ? '前' + -m.year : m.year}年${m.site ? ' · ' + m.site : ''}`,
            titleEn: enHead,
            subEn: `${yrEn}${siteEn ? ' · ' + siteEn : ''}`,
            keywords: `${m.headline} ${m.site || ''} ${enHead} ${siteEn} ${m.year}`.toLowerCase(),
          });
        }
      }

      // 3b. Curated Place Landmark Events (名胜史事 · 战役古迹)
      const seenLm = new Set();
      for (const lm of HistoricalAtlasController.PLACE_LANDMARK_EVENTS) {
        if (!lm.zh) continue;
        const uid = `${lm.year}:${lm.zh.slice(0, 16)}`;
        if (seenLm.has(uid)) continue;
        seenLm.add(uid);
        const d =
          this.dynasties.find((dyn) => dyn.key === lm.dynastyKey) ||
          this.dynasties[this._findDynastyIndex(lm.year)] ||
          this.dynasties[0];
        const yrEn = lm.year <= 0 ? `${-lm.year || 1} BCE` : `${lm.year} CE`;
        const milestoneObj = {
          year: lm.year,
          headline: lm.zh,
          headlineEn: lm.en,
          site: lm.site,
          siteEn: lm.siteEn,
          coord: lm.coord,
        };
        entries.push({
          kind: 'event',
          dynasty: d,
          year: this._clampYearToDynasty(d, lm.year),
          milestone: milestoneObj,
          coord: lm.coord,
          titleZh: lm.zh,
          subZh: `${lm.year <= 0 ? '前' + -lm.year : lm.year}年${lm.site ? ' · ' + lm.site : ''}`,
          titleEn: lm.en || lm.zh,
          subEn: `${yrEn}${lm.siteEn ? ' · ' + lm.siteEn : ''}`,
          keywords: `${lm.zh} ${lm.site || ''} ${lm.en || ''} ${lm.siteEn || ''} ${lm.year} 史事 事件 战役 名胜`.toLowerCase(),
        });
      }

      this.searchIndex = entries;
      return entries;
    }

    _parseChineseNumber(str) {
      if (!str) return null;
      if (/^\d+$/.test(str)) return Number(str);
      if (str === '元') return 1;
      const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
      if (str.length === 1) return map[str] || null;
      if (str.startsWith('十')) return 10 + (map[str.slice(1)] || 0);
      if (str.endsWith('十')) return (map[str[0]] || 0) * 10;
      const parts = str.split('十');
      if (parts.length === 2) {
        return (map[parts[0]] || 0) * 10 + (map[parts[1]] || 0);
      }
      return null;
    }

    _matchEraResults(rawQuery) {
      const rawTrim = rawQuery.trim();
      if (!rawTrim) return [];
      const trimmed = /[\u4e00-\u9fff]/.test(rawTrim) ? this._toHans(rawTrim) : rawTrim;
      const hits = [];

      // Direct Gregorian year match (e.g. "1083", "公元1083年", "前214年", "-214", "221 BCE", "741 CE")
      const directYrMatch = trimmed.match(/^(?:公元)?(前|-)?\s*(\d{1,4})\s*(?:年|bce|bc|ce|ad)?$/i);
      if (directYrMatch) {
        const isBce = Boolean(directYrMatch[1]) || /bce|bc/i.test(trimmed);
        let yr = Number(directYrMatch[2]) * (isBce ? -1 : 1);
        if (yr === 0) yr = 1;
        if (yr >= this.minYear && yr <= this.maxYear) {
          const dIdx = this._findDynastyIndex(yr);
          const d = this.dynasties[dIdx];
          const prevLoc = this.locale;
          this.locale = 'zh';
          const eraZh = this.formatEraLabel(yr, d);
          const yrZh = this.formatYear(yr);
          this.locale = 'en';
          const yrEn = this.formatYear(yr);
          this.locale = prevLoc;
          hits.push({
            kind: 'era',
            dynasty: d,
            year: yr,
            titleZh: `${yrZh} · ${eraZh}`,
            subZh: d.title,
            titleEn: `${yrEn} (${eraZh})`,
            subEn: (this.enLocale.dynasties[d.key] && this.enLocale.dynasties[d.key].name) || d.title,
            score: 135,
          });
        }
      }

      const isYuanNian = /[元][年载]$/.test(trimmed);
      const q = trimmed.replace(/[年载]$/, '');
      if (!q) return hits;
      const spans = HistoricalAtlasController.CHINESE_ERA_SPANS;
      const numMatch = isYuanNian
        ? [q, q.slice(0, -1), '元']
        : q.match(/^(.*?)([一二三四五六七八九十]+|\d+)$/);
      const prefixQ = (numMatch ? numMatch[1] : q).replace(/[·\s]/g, '');
      const qLower = trimmed.toLowerCase();
      const isLatinQuery = qLower.length >= 3 && /[a-z]/i.test(qLower);
      const yearNum = numMatch ? this._parseChineseNumber(numMatch[2]) : null;
      const seenMonarchOnly = new Set();
      const seenEraHit = new Set();
      // [span, lastYear] for the reference track and every regional track, so regimes
      // like Northern Wei (太和十八年) are searchable alongside the reference eras.
      const eraSpans = [
        ...spans.map((sp, idx) => [sp, idx + 1 < spans.length ? spans[idx + 1][0] - 1 : 1948]),
        ...HistoricalAtlasController.REGIONAL_ERA_TRACKS.flatMap((t) =>
          t.spans.map((sp, idx) => [sp, idx + 1 < t.spans.length ? t.spans[idx + 1][0] - 1 : t.until])
        ),
      ];

      eraSpans.forEach(([sp, endY]) => {
        const [startY, prefix, baseNum = 1, monarchZh = '', monarchEn = ''] = sp;
        if (!prefixQ) return;
        const shortMonarch = monarchZh
          .replace(/^(?:西|东|北|南|南朝|武周)/, '')
          .replace(/^汉高帝$/, '汉高祖');
        const dynPfx = ERA_DYNASTY_PREFIXES.find((dp) => prefix.startsWith(dp)) || '';
        const eraOnly = dynPfx ? prefix.slice(dynPfx.length) : prefix;
        const fullCombo = monarchZh ? `${monarchZh}${eraOnly}` : prefix;
        const shortCombo = shortMonarch ? `${shortMonarch}${eraOnly}` : prefix;
        const monarchEnLower = (monarchEn || '').toLowerCase();
        const monarchEnExpanded = monarchEnLower.replace(/\bemp\./g, 'emperor');
        const monarchBare = monarchEnExpanded.replace(/^emperor\s+/, '');
        const dForSpan = this.dynasties[this._findDynastyIndex(startY)] || this.dynasties[0];
        const enDynObj = (this.enLocale.dynasties && this.enLocale.dynasties[dForSpan.key]) || {};
        const enDynShort = (enDynObj.short || enDynObj.name || dForSpan.key || '').toLowerCase();
        const enDynBase = enDynShort.replace(/^[wens]\.\s*/, '');
        const enSearchTarget = `${monarchEnLower} ${monarchEnExpanded} ${monarchEnExpanded} of ${enDynShort} ${monarchEnExpanded} of ${enDynBase} ${monarchBare} of ${enDynBase}`;

        // A hit must reach past the regime name into the era or monarch title, so a bare
        // regime ('北魏', '金', 'liao') does not list every era or emperor of that regime.
        const reachesTail = (s, tailLen) => {
          const at = s.lastIndexOf(prefixQ);
          return at >= 0 && at + prefixQ.length > s.length - tailLen;
        };
        const monarchTitleLen =
          dynPfx && monarchZh.startsWith(dynPfx) ? monarchZh.length - dynPfx.length : monarchZh.length;
        const [enName, enOwnRegime = ''] = monarchEnExpanded.split(' of ');
        const enRegimeOnly =
          !enName.includes(qLower) && `${enOwnRegime} | ${enDynShort} | ${enDynBase}`.includes(qLower);
        const matchEra = [prefix, fullCombo, shortCombo].some((s) => reachesTail(s, eraOnly.length));
        const matchMonarchOnly =
          !matchEra &&
          yearNum === null &&
          ((monarchZh &&
            (reachesTail(monarchZh, monarchTitleLen) ||
              reachesTail(shortMonarch, monarchTitleLen) ||
              (prefixQ === '汉高祖' && prefix === '汉高帝'))) ||
            (isLatinQuery && !enRegimeOnly && enSearchTarget.includes(qLower)));

        if (matchEra || matchMonarchOnly) {
          const monarchDedupKey = monarchZh || monarchEnLower;
          if (matchMonarchOnly) {
            if (seenMonarchOnly.has(monarchDedupKey)) return;
            seenMonarchOnly.add(monarchDedupKey);
          } else if (
            yearNum === null &&
            monarchZh &&
            (prefixQ === monarchZh || prefixQ === shortMonarch)
          ) {
            if (seenMonarchOnly.has(monarchDedupKey)) return;
            seenMonarchOnly.add(monarchDedupKey);
          }
          const targetNum = yearNum !== null ? yearNum : baseNum;
          const targetY = startY + (targetNum - baseNum);
          if (targetY >= startY && targetY <= endY + 5) {
            const dIdx = this._findDynastyIndex(targetY);
            const d = this.dynasties[dIdx];
            const label = this._formatSpanEraZh(sp, targetNum);
            // Regional tracks repeat some reference spans (e.g. Chen); list each era-year once.
            if (seenEraHit.has(`${targetY}|${label}`)) return;
            seenEraHit.add(`${targetY}|${label}`);
            const titleZh =
              startY >= 1368 && startY < 1912 && monarchZh
                ? `${label} · ${monarchZh}`
                : label;
            const yrZh = targetY <= 0 ? `公元前${-targetY}年` : `公元 ${targetY} 年`;
            const yrEn = targetY <= 0 ? `${-targetY} BCE` : `${targetY} CE`;
            const enMonarchPart = monarchEn ? ` · ${monarchEn}` : '';
            const isExactOrSuffix =
              prefix.endsWith(prefixQ) ||
              fullCombo.endsWith(prefixQ) ||
              shortCombo.endsWith(prefixQ) ||
              monarchZh === prefixQ ||
              shortMonarch === prefixQ ||
              (isLatinQuery &&
                (monarchEnLower.startsWith(qLower) || monarchEnExpanded.startsWith(qLower)));
            hits.push({
              kind: 'era',
              dynasty: d,
              year: targetY,
              titleZh,
              subZh: yrZh,
              titleEn: `${label}${enMonarchPart} (${yrEn})`,
              subEn: (this.enLocale.dynasties[d.key] && this.enLocale.dynasties[d.key].name) || d.title,
              score: isExactOrSuffix ? 120 : 95,
            });
          }
        }
      });
      return hits;
    }

    _queryQuickSearch(rawQuery) {
      const rawTrim = rawQuery.trim();
      if (!rawTrim) return [];
      const normQ = /[\u4e00-\u9fff]/.test(rawTrim) ? this._toHans(rawTrim) : rawTrim;
      const q = normQ.toLowerCase();
      if (!q) return [];
      const fold = (s) =>
        String(s || '')
          .toLowerCase()
          .replace(/['’‘`\-_.\s]+/g, '');
      const isAscii = /[a-z]/i.test(q) && !/[\u4e00-\u9fa5]/.test(q);
      const qFold = isAscii ? fold(q) : '';
      const index = this._ensureSearchIndex();
      const results = [...this._matchEraResults(normQ)];

      for (const item of index) {
        let score = 0;
        const tZh = item.titleZh.toLowerCase();
        const tEn = item.titleEn.toLowerCase();
        const mZh = (item.modernZh || '').toLowerCase();
        const mEn = (item.modernEn || '').toLowerCase();
        const tEnFold = isAscii ? fold(tEn) : '';
        const mEnFold = isAscii ? fold(mEn) : '';
        if (tZh === q || tEn === q) score = 100;
        else if (isAscii && qFold.length >= 3 && tEnFold === qFold) score = 98;
        else if (mZh && (mZh === q || mZh.split(/[·/、]/).includes(q) || mEn === q)) score = 96;
        else if (isAscii && qFold.length >= 3 && mEnFold === qFold) score = 94;
        else if (
          item.aliases &&
          item.aliases.some((a) => a === q || (isAscii && qFold.length >= 3 && fold(a) === qFold))
        ) {
          score = 92;
        } else if (
          tZh.startsWith(q) ||
          tEn.startsWith(q) ||
          (isAscii && qFold.length >= 3 && tEnFold.startsWith(qFold))
        ) {
          score = 80;
        } else if (
          mZh &&
          (mZh.startsWith(q) ||
            mEn.startsWith(q) ||
            (isAscii && qFold.length >= 3 && mEnFold.startsWith(qFold)))
        ) {
          score = 78;
        } else if (
          item.keywords.includes(q) ||
          (isAscii && qFold.length >= 4 && fold(item.keywords).includes(qFold))
        ) {
          score = 55;
        }

        if (score > 0) {
          if (item.kind === 'person') {
            if (score >= 92) score = 148;
            else if (score >= 80) score = 114;
            else score = 72;
          } else {
            if (item.dynasty === this.dynasties[this.dynastyIdx]) score += 12;
            if (item.isCapital) score += 2;
          }
          results.push({ ...item, score });
        }
      }

      // Dynamic zero-config fallback if query matches >=2 historical events for an unlisted figure
      if (
        !results.some((r) => r.kind === 'person') &&
        !results.some(
          (r) =>
            (r.kind === 'city' || r.kind === 'pass' || r.kind === 'gazetteer' || r.kind === 'dynasty') &&
            r.score >= 92
        ) &&
        /^[\u4e00-\u9fa5]{2,4}$/.test(normQ)
      ) {
        const adhoc = this._resolvePersonProfile(normQ);
        if (adhoc) {
          const evs = this._collectPersonEvents(adhoc);
          if (evs.length >= 2) {
            const d = evs[0].dynasty || this.dynasties[0];
            results.push({
              kind: 'person',
              personProfile: adhoc,
              dynasty: d,
              year: null,
              titleZh: adhoc.zh,
              subZh: `${adhoc.courtesyZh} · 共 ${evs.length} 处史事`,
              titleEn: adhoc.en,
              subEn: `${evs.length} events`,
              score: 126,
            });
          }
        }
      }

      results.sort((a, b) => b.score - a.score);
      const deduped = [];
      const seenPlaceKey = new Set();
      for (const item of results) {
        if (
          (item.kind === 'city' || item.kind === 'prefecture' || item.kind === 'region') &&
          item.coord
        ) {
          const pk = `${item.kind}:${item.titleZh}:${Math.round(item.coord[0])},${Math.round(item.coord[1])}`;
          if (seenPlaceKey.has(pk)) continue;
          seenPlaceKey.add(pk);
        }
        deduped.push(item);
        if (deduped.length >= 12) break;
      }
      return deduped;
    }

    _selectSearchResult(item) {
      this.stopAutoplay();
      this.clearCustomRoute();
      this._clearQuickSearchInput();

      if (item.kind === 'quiz') {
        if (this.challenge) this.stopChallenge();
        else this.startChallenge();
        return;
      }

      if (item.kind === 'person') {
        this.openPersonChronicle(item.personProfile || item.personKey || item.titleZh, -1);
        return;
      }

      if (item.year !== null && item.year !== undefined) {
        this.jumpToYear(item.year);
      }

      if ((item.kind === 'city' || item.kind === 'pass' || item.kind === 'gazetteer') && item.coord) {
        if (!this._id('chk-settlements').checked) {
          this._id('chk-settlements').checked = true;
          this.grpSettlements.classList.remove('is-hidden');
        }
        const isDesktop = typeof window === 'undefined' || window.innerWidth > 900;
        const minCityZoom = isDesktop ? 2.4 : 3.25;
        const rawZoom = item.zoom || (item.kind === 'pass' ? 2.35 : item.tier === 2 ? 2.4 : 1.85);
        const targetZoom =
          item.kind === 'gazetteer' || item.tier === 2 ? Math.max(rawZoom, minCityZoom) : rawZoom;
        const [tx, ty] = this.projector.toScreen(item.coord[0], item.coord[1]);
        const w = Math.min(this.camera.w, 1000 / targetZoom);
        const h = w * this._getViewportAspect();
        const xFrac = isDesktop ? 0.38 : 0.5;
        const yFrac = isDesktop ? 0.45 : 0.32;
        this._animateCameraTo({ x: tx - w * xFrac, y: ty - h * yFrac, w, h });
        this.openGenealogyAt(
          item.coord[0],
          item.coord[1],
          item.kind === 'gazetteer' ? item.titleZh : undefined
        );
      } else if ((item.kind === 'prefecture' || item.kind === 'region') && item.coord) {
        if (!this._id('chk-prefectures').checked) {
          this._id('chk-prefectures').checked = true;
          this.grpPrefectures.classList.remove('is-hidden');
        }
        const [tx, ty] = this.projector.toScreen(item.coord[0], item.coord[1]);
        const w = Math.min(this.camera.w, 1000 / 1.95);
        const h = w * this._getViewportAspect();
        this._animateCameraTo({ x: tx - w * 0.5, y: ty - h * 0.48, w, h });
        if (item.prefTitle) {
          setTimeout(() => {
            this.grpPrefectures
              .querySelectorAll('.prefecture-shape.is-hovered')
              .forEach((el) => el.classList.remove('is-hovered'));
            const el = this.grpPrefectures.querySelector(
              `.prefecture-shape[data-pref-title="${CSS.escape(item.prefTitle)}"]`
            );
            if (el) el.classList.add('is-hovered');
          }, 80);
        }
      } else if (item.kind === 'event' && item.milestone) {
        this.openMilestoneBalloon(item.dynasty, item.milestone);
        if (item.coord) this._panToward(item.coord[0], item.coord[1]);
      }
    }

    _closeLayersPopover() {
      const layersPopover = this._id('layers-popover');
      const layersBtn = this._id('act-layers-menu');
      if (!layersPopover || layersPopover.classList.contains('is-hidden')) return false;
      layersPopover.classList.add('is-hidden');
      if (layersBtn) {
        layersBtn.classList.remove('is-active');
        layersBtn.setAttribute('aria-expanded', 'false');
      }
      return true;
    }

    // Dismiss the topmost active popover, sheet, or mode one layer at a time.
    _dismissTopOverlay() {
      if (this._closeLayersPopover()) return true;
      if (this.playing || this.personTimer) {
        this.stopAutoplay();
        return true;
      }
      if (this.mobileChronicleOpen) {
        this.toggleMobileChronicle(false);
        return true;
      }
      const genCard = this._id('genealogy-card');
      const genOpen =
        Boolean(this.activePerson || this.activeTrace) ||
        Boolean(genCard && !genCard.classList.contains('is-hidden'));
      if (genOpen) {
        this.closeGenealogyCard();
        return true;
      }
      if (this.activeCustomRoute) {
        this.clearCustomRoute();
        return true;
      }
      if (this.challenge) {
        this.stopChallenge();
        return true;
      }
      if (
        this.activeMilestone &&
        this.milestoneBalloon &&
        !this.milestoneBalloon.classList.contains('is-hidden')
      ) {
        this.closeMilestoneBalloon();
        return true;
      }
      return false;
    }

    // ---------------- Event Listeners ----------------
    _attachListeners() {
      // Quick Search box
      const searchInp = this._id('inp-map-search');
      const searchList = this._id('map-search-results');
      let activeSearchIdx = -1;
      let currentResults = [];
      let showcaseIdx = 0;

      const renderSearchDropdown = () => {
        if (!searchInp || !searchList) return;
        const q = searchInp.value.trim();
        const kindLabel = {
          person: this.locale === 'en' ? 'Figure' : '人物',
          quiz: this.locale === 'en' ? 'Quiz' : '雅集',
          dynasty: this.locale === 'en' ? 'Dynasty' : '朝代',
          era: this.locale === 'en' ? 'Era' : '纪年',
          city: this.locale === 'en' ? 'City' : '古城',
          pass: this.locale === 'en' ? 'Pass' : '雄关',
          gazetteer: this.locale === 'en' ? 'Landmark' : '名胜',
          prefecture: this.locale === 'en' ? 'Prefecture' : '州府',
          region: this.locale === 'en' ? 'Circuit/Prov' : '大区',
          event: this.locale === 'en' ? 'Event' : '史事',
        };
        if (!q) {
          const index = this._ensureSearchIndex();
          const showcaseOrder = [
            'sushi',
            'zhugeliang',
            'huoqubing',
            'libai',
            'caocao',
            'xinqiji',
            'xuanzang',
            'wangyangming',
            'zhangqian',
            'dufu',
          ];
          const showcasePool = showcaseOrder
            .map((key) => index.find((item) => item.kind === 'person' && item.personKey === key))
            .filter(Boolean);
          const sampleItem = showcasePool.length
            ? showcasePool[showcaseIdx % showcasePool.length]
            : null;
          const quizItem = index.find((item) => item.kind === 'quiz');
          currentResults = sampleItem ? [sampleItem] : [];
          activeSearchIdx = -1;
          searchList.innerHTML = '';

          if (sampleItem) {
            const li = document.createElement('li');
            li.className = 'sr-showcase-row';
            const mainText = this.locale === 'en' ? sampleItem.titleEn : sampleItem.titleZh;
            const subText = this.locale === 'en' ? sampleItem.subEn : sampleItem.subZh;
            const egLabel = this.locale === 'en' ? 'e.g.' : '示例';
            const cycleTitle = this.locale === 'en' ? 'Try another figure' : '换一位人物示例';
            const tagText = `${this.dynastyBadge(sampleItem.dynasty)} · ${kindLabel.person}`;
            li.innerHTML =
              `<div><span class="sr-eg-pill">${egLabel}</span><span class="sr-main">${escHtml(mainText)}</span>${subText ? `<span class="sr-sub">${escHtml(subText)}</span>` : ''}</div>` +
              `<span class="sr-right-meta"><span class="sr-tag">${escHtml(tagText)}</span><button type="button" class="sr-cycle-btn" title="${cycleTitle}" aria-label="${cycleTitle}">↻</button></span>`;
            const cycleBtn = li.querySelector('.sr-cycle-btn');
            if (cycleBtn) {
              cycleBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
              });
              cycleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showcaseIdx = (showcaseIdx + 1) % showcasePool.length;
                renderSearchDropdown();
                searchInp.focus();
              });
            }
            let samplePicked = false;
            const pickSample = (e) => {
              e.preventDefault();
              if (samplePicked) return;
              samplePicked = true;
              setTimeout(() => {
                samplePicked = false;
              }, 250);
              searchList.classList.add('is-hidden');
              this._selectSearchResult(sampleItem);
              searchInp.blur();
            };
            li.addEventListener('mousedown', pickSample);
            li.addEventListener('click', pickSample);
            searchList.appendChild(li);
          }

          const guideLi = document.createElement('li');
          guideLi.className = 'sr-search-guide';
          guideLi.setAttribute('role', 'presentation');
          const tryLabel = this.locale === 'en' ? 'Try' : '试试搜';
          const sampleQueries =
            this.locale === 'en'
              ? ["Chang'an", 'Chibi', '627', 'Cao Cao']
              : ['长安', '赤壁', '贞观', '霍去病'].map((s) => this._zh(s));
          const chipsWrap = document.createElement('div');
          chipsWrap.className = 'sr-guide-chips';
          const guideLbl = document.createElement('span');
          guideLbl.className = 'sr-guide-label';
          guideLbl.textContent = tryLabel;
          chipsWrap.appendChild(guideLbl);
          for (const kw of sampleQueries) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sr-chip-btn';
            btn.textContent = kw;
            btn.addEventListener('mousedown', (e) => {
              e.preventDefault();
              e.stopPropagation();
            });
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              searchInp.value = kw;
              renderSearchDropdown();
              searchInp.focus();
            });
            chipsWrap.appendChild(btn);
          }
          guideLi.appendChild(chipsWrap);

          if (quizItem) {
            const quizBtn = document.createElement('button');
            quizBtn.type = 'button';
            quizBtn.id = 'act-challenge';
            quizBtn.className = 'sr-quiz-link';
            const quizText = this.challenge
              ? this.locale === 'en'
                ? 'Exit Quiz ×'
                : '退出小试 ×'
              : this.locale === 'en'
                ? 'Quiz ›'
                : '古地名小试 ›';
            quizBtn.innerHTML = `<span id="lbl-challenge">${quizText}</span>`;
            let quizPicked = false;
            const pickQuiz = (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (quizPicked) return;
              quizPicked = true;
              setTimeout(() => {
                quizPicked = false;
              }, 250);
              searchList.classList.add('is-hidden');
              this._selectSearchResult(quizItem);
              searchInp.blur();
            };
            quizBtn.addEventListener('mousedown', pickQuiz);
            quizBtn.addEventListener('click', pickQuiz);
            guideLi.appendChild(quizBtn);
          }

          searchList.appendChild(guideLi);
          searchList.classList.remove('is-hidden');
          if (this.locale === 'zh-tw') this._applyZhHantDom(searchList);
          return;
        }
        if (
          /[a-z]/i.test(q) &&
          (!this.enLocale || !this.enLocale.dict || !Object.keys(this.enLocale.dict).length)
        ) {
          this._ensureEnglishLocale().then(renderSearchDropdown);
          return;
        }
        currentResults = this._queryQuickSearch(q);
        activeSearchIdx = currentResults.length ? 0 : -1;
        searchList.innerHTML = '';
        if (!currentResults.length) {
          const empty = document.createElement('li');
          empty.innerHTML = `<span class="sr-sub">${this.locale === 'en' ? 'No matching place, era, or event' : this._zh('未找到匹配的古今地名、州府、年号或事件')}</span>`;
          searchList.appendChild(empty);
          searchList.classList.remove('is-hidden');
          return;
        }
        currentResults.forEach((item, idx) => {
          const li = document.createElement('li');
          if (idx === activeSearchIdx) li.classList.add('is-active');
          const mainText = this.locale === 'en' ? item.titleEn : this._zh(item.titleZh);
          const subText = this.locale === 'en' ? item.subEn : this._zh(item.subZh);
          const tagText = `${this.dynastyBadge(item.dynasty)} · ${this._zh(kindLabel[item.kind] || '')}`;
          li.innerHTML =
            `<div><span class="sr-main">${escHtml(mainText)}</span>${subText ? `<span class="sr-sub">${escHtml(subText)}</span>` : ''}</div>` +
            `<span class="sr-tag">${escHtml(tagText)}</span>`;
          let itemPicked = false;
          const pickItem = (e) => {
            e.preventDefault();
            if (itemPicked) return;
            itemPicked = true;
            setTimeout(() => {
              itemPicked = false;
            }, 250);
            searchList.classList.add('is-hidden');
            this._selectSearchResult(item);
            searchInp.blur();
          };
          li.addEventListener('mousedown', pickItem);
          li.addEventListener('click', pickItem);
          searchList.appendChild(li);
        });
        searchList.classList.remove('is-hidden');
      };

      if (searchInp && searchList) {
        const searchBox = this._id('map-search-box');
        if (searchBox) {
          searchBox.addEventListener('click', () => {
            if (window.innerWidth <= 640 && !searchBox.classList.contains('is-expanded')) {
              searchBox.classList.add('is-expanded');
              setTimeout(() => searchInp.focus(), 20);
            }
          });
        }
        searchInp.addEventListener('input', renderSearchDropdown);
        searchInp.addEventListener('focus', renderSearchDropdown);
        searchInp.addEventListener('blur', () => {
          setTimeout(() => {
            if (searchBox && !searchInp.value.trim()) {
              searchBox.classList.remove('is-expanded');
            }
          }, 180);
        });
        searchInp.addEventListener('keydown', (e) => {
          if (e.isComposing || e.keyCode === 229) return;
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && currentResults.length) {
            e.preventDefault();
            const step = e.key === 'ArrowDown' ? 1 : -1;
            activeSearchIdx = (activeSearchIdx + step + currentResults.length) % currentResults.length;
            Array.from(
              searchList.querySelectorAll('li:not(.sr-section-head):not(.sr-search-guide)')
            ).forEach((el, i) => {
              const active = i === activeSearchIdx;
              el.classList.toggle('is-active', active);
              if (active && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ block: 'nearest' });
              }
            });
          } else if (e.key === 'Enter' && currentResults.length) {
            e.preventDefault();
            const pick = currentResults[Math.max(0, activeSearchIdx)];
            if (pick) {
              this._selectSearchResult(pick);
              searchInp.blur();
            }
          } else if (e.key === 'Escape') {
            searchList.classList.add('is-hidden');
            if (searchBox) searchBox.classList.remove('is-expanded');
            searchInp.blur();
          }
        });
        document.addEventListener('pointerdown', (e) => {
          const box = this._id('map-search-box');
          if (box && !box.contains(e.target)) {
            searchList.classList.add('is-hidden');
            box.classList.remove('is-expanded');
          }
        });
      }

      // Layer popover menu & checkboxes
      const layersBtn = this._id('act-layers-menu');
      const layersPopover = this._id('layers-popover');
      if (layersBtn && layersPopover) {
        layersBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const willOpen = layersPopover.classList.contains('is-hidden');
          if (willOpen) {
            if (window.innerWidth > 640) {
              const btnRect = layersBtn.getBoundingClientRect();
              const navRect = this._id('nav-bar').getBoundingClientRect();
              const leftPx = Math.max(
                12,
                Math.min(window.innerWidth - 300, btnRect.left - navRect.left)
              );
              layersPopover.style.left = `${leftPx}px`;
              layersPopover.style.right = 'auto';
            } else {
              layersPopover.style.left = '';
              layersPopover.style.right = '';
            }
            layersPopover.classList.remove('is-hidden');
            layersBtn.classList.add('is-active');
            layersBtn.setAttribute('aria-expanded', 'true');
          } else {
            this._closeLayersPopover();
          }
        });
        document.addEventListener('pointerdown', (e) => {
          if (
            !layersPopover.classList.contains('is-hidden') &&
            !layersPopover.contains(e.target) &&
            !layersBtn.contains(e.target)
          ) {
            this._closeLayersPopover();
          }
        });
      }

      const bindToggle = (chkId, grpEl, inv = false) => {
        this._id(chkId).addEventListener('change', (e) => {
          grpEl.classList.toggle('is-hidden', inv ? e.target.checked : !e.target.checked);
          this._rescaleSvgTypography();
        });
      };
      const chkTerrain = this._id('chk-terrain');
      if (chkTerrain) {
        chkTerrain.addEventListener('change', (e) => {
          this.toggleTerrainMode(e.target.checked);
        });
      }
      bindToggle('chk-provinces', this.grpProvinces);
      bindToggle('chk-prov-names', this.grpProvNames);
      this._id('chk-polities').addEventListener('change', (e) => {
        this.grpPolities.classList.toggle('is-hidden', !e.target.checked);
        if (this.grpGhostDiff) {
          this.grpGhostDiff.classList.toggle('is-hidden', !e.target.checked);
        }
        this._rescaleSvgTypography();
      });
      bindToggle('chk-prefectures', this.grpPrefectures);
      this._id('chk-settlements').addEventListener('change', (e) => {
        if (this.challenge) return;
        this.grpSettlements.classList.toggle('is-hidden', !e.target.checked);
        this._rescaleSvgTypography();
      });
      this._id('chk-corridors').addEventListener('change', (e) => {
        this.grpCorridors.classList.toggle('is-hidden', !e.target.checked);
        this.svg.classList.toggle('is-corridors-hidden', !e.target.checked);
        this._rescaleSvgTypography();
        if (this.lastRenderedSnap) this._renderLegendBox(this.lastRenderedSnap);
      });
      this._id('chk-milestones').addEventListener('change', (e) => {
        this.grpMilestones.classList.toggle('is-hidden', !e.target.checked);
        if (!e.target.checked) {
          this.closeMilestoneBalloon();
        } else {
          if (this.dismissedCalloutIds) this.dismissedCalloutIds.clear();
          const cur = this.dynasties[this.dynastyIdx];
          if (cur) this._syncAutoMilestoneBalloon(cur);
        }
        this._rescaleSvgTypography();
      });

      this._id('act-reset-camera').addEventListener('click', () => this.resetCamera());
      const togglePaneBtn = this._id('act-toggle-pane');
      if (togglePaneBtn) {
        togglePaneBtn.addEventListener('click', () => {
          this._paneAutoCollapsed = false;
          if (this._isMobileViewport()) {
            if (this.paneCollapsed) {
              this.paneCollapsed = false;
              const body = this._id('workspace-body');
              if (body) body.classList.remove('is-pane-collapsed');
            }
            this.toggleMobileChronicle();
          } else {
            this.toggleChroniclePane();
          }
        });
      }
      const mobChronBtn = this._id('act-mobile-chronicle');
      if (mobChronBtn) {
        mobChronBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleMobileChronicle();
        });
      }
      const dynBannerBar = this._id('dynasty-banner-bar');
      if (dynBannerBar) {
        dynBannerBar.addEventListener('click', () => {
          if (window.innerWidth <= 900) {
            this.toggleMobileChronicle();
          }
        });
      }
      const expandGenBtn = this._id('act-expand-genealogy');
      if (expandGenBtn) {
        expandGenBtn.addEventListener('click', () => {
          this.toggleGenealogySheetExpand();
        });
      }
      this._id('act-close-genealogy').addEventListener('click', () => {
        this.closeGenealogyCard();
      });

      this._id('act-close-challenge').addEventListener('click', () => this.stopChallenge());
      this._id('act-next-round').addEventListener('click', () => {
        if (!this.challenge || this._id('act-next-round').onclick) return;
        if (this.challenge.pendingGuess && !this.challenge.answered) {
          this._evaluateLocateClick(
            this.challenge.pendingGuess[0],
            this.challenge.pendingGuess[1]
          );
          return;
        }
        this.challenge.index++;
        if (this.challenge.index >= this.challenge.deck.length) {
          this._finishChallenge();
        } else {
          this.presentChallengeRound();
        }
      });

      const musicBtn = this._id('act-music');
      if (musicBtn) {
        musicBtn.addEventListener('click', () => this.toggleMusic());
      }
      const musicNextBtn = this._id('act-music-next');
      if (musicNextBtn) {
        musicNextBtn.addEventListener('click', () => this.nextMusicTrack());
      }

      const actLocHant = this._id('act-locale-hant');
      if (actLocHant) {
        actLocHant.addEventListener('click', () => {
          const target = actLocHant.dataset.targetLocale;
          this.locale = target || (this.locale === 'zh' ? 'zh-tw' : 'zh');
          this.applyLocale();
        });
      }
      this._id('act-locale').addEventListener('click', () => {
        const btn = this._id('act-locale');
        const target = btn && btn.dataset && btn.dataset.targetLocale;
        this.locale = target || (this.locale === 'en' ? 'zh' : 'en');
        this.applyLocale();
      });

      this._id('act-autoplay').addEventListener('click', () => {
        if (this.challenge) return;
        if (this.activePerson) {
          this.togglePersonAutoplay();
        } else if (this.playing) {
          this.stopAutoplay();
        } else {
          this.startAutoplay();
        }
      });
      const playSpeedBtn = this._id('act-play-speed');
      if (playSpeedBtn) {
        playSpeedBtn.addEventListener('click', () => this.cyclePlaySpeed());
      }

      this._id('inp-year').addEventListener('change', (e) => {
        if (this.challenge) return;
        this.stopAutoplay();
        this.jumpToYear(Number(e.target.value));
      });
      const stepPrevBtn = this._id('act-step-prev');
      if (stepPrevBtn) {
        stepPrevBtn.addEventListener('click', () => this.stepTimelineNode(-1));
      }
      const stepNextBtn = this._id('act-step-next');
      if (stepNextBtn) {
        stepNextBtn.addEventListener('click', () => this.stepTimelineNode(1));
      }

      // Scrubber dragging (smooth continuous scrubbing anywhere on the bar)
      const track = this._id('scrubber-track');
      this._bindScrubberDrag(track);
      // Touching the event callout ends autoplay, like any other input.
      this.milestoneBalloon.addEventListener('pointerdown', () => {
        if (this.playing) this.stopAutoplay();
      });
      track.addEventListener('click', (e) => {
        if (this.challenge) return;
        this._clearQuickSearchInput();
        const bandCell = e.target && e.target.closest && e.target.closest('.band-cell');
        if (bandCell && e.detail === 0 && bandCell.dataset.dynastyIdx !== undefined) {
          const d = this.dynasties[Number(bandCell.dataset.dynastyIdx)];
          if (d) {
            this.stopAutoplay();
            this.jumpToYear(d.focusYear !== undefined ? d.focusYear : d.fromYear);
          }
        }
      });

      const seoDirNav = this._id('seo-atlas-directory');
      if (seoDirNav) {
        seoDirNav.addEventListener('click', (e) => {
          const a = e.target && e.target.closest && e.target.closest('a[href]');
          if (!a) return;
          try {
            const u = new URL(a.href, window.location.href);
            const hasSpaParams =
              u.searchParams.has('journey') ||
              u.searchParams.has('person') ||
              u.searchParams.has('year') ||
              u.searchParams.has('trace') ||
              u.searchParams.has('place');
            if (!hasSpaParams) return;
            e.preventDefault();
            this._clearQuickSearchInput();
            if (u.searchParams.has('person')) {
              const st = u.searchParams.has('stop') ? Number(u.searchParams.get('stop')) : -1;
              this.openPersonChronicle(
                u.searchParams.get('person'),
                Number.isNaN(st) ? -1 : st
              );
              return;
            }
            if (u.searchParams.has('journey')) {
              const st = u.searchParams.has('stop') ? Number(u.searchParams.get('stop')) : -1;
              this.openJourneyAsPerson(
                u.searchParams.get('journey'),
                Number.isNaN(st) ? -1 : st
              );
              return;
            }
            if (u.searchParams.has('place')) {
              this.locate({
                year: u.searchParams.has('year') ? u.searchParams.get('year') : undefined,
                place: u.searchParams.get('place') || '',
              });
              return;
            }
            if (u.searchParams.has('year')) {
              this.stopAutoplay();
              this.jumpToYear(Number(u.searchParams.get('year')));
            }
            if (u.searchParams.has('trace')) {
              const parts = u.searchParams.get('trace').split(',').map(Number);
              if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
                this.openGenealogyAt(parts[0], parts[1]);
              }
            }
          } catch (_) {}
        });
      }

      // Keyboard navigation
      window.addEventListener('keydown', (e) => {
        if (e.isComposing || e.keyCode === 229) return;
        if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) && e.target.tagName !== 'INPUT') {
          if (!this.challenge && searchInp) {
            e.preventDefault();
            searchInp.focus();
            searchInp.select();
            return;
          }
        }
        if (e.target && e.target.id === 'inp-year') {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (!this.challenge) {
              this.stopAutoplay();
              this.jumpToYear(Number(e.target.value));
            }
            e.target.blur();
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.target.blur();
            return;
          }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            if (this.challenge) return;
            e.preventDefault();
            e.target.blur();
            const dir = e.key === 'ArrowRight' ? 1 : -1;
            if (e.shiftKey && !this.activePerson && !this.activeCustomRoute) {
              this.stopAutoplay();
              this.jumpToYear(this.year + dir * 10);
              return;
            }
            this.stepTimelineNode(dir);
            return;
          }
          return;
        }
        if (e.target.tagName === 'INPUT') return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          if (this.challenge) return;
          e.preventDefault();
          const dir = e.key === 'ArrowRight' ? 1 : -1;
          if (e.shiftKey && !this.activePerson && !this.activeCustomRoute) {
            this.stopAutoplay();
            this.jumpToYear(this.year + dir * 10);
            return;
          }
          this.stepTimelineNode(dir);
        } else if ((e.key === '+' || e.key === '=') && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          this.zoomBy(1.35);
        } else if ((e.key === '-' || e.key === '_') && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          this.zoomBy(1 / 1.35);
        } else if (e.key === 'Home' && !this.challenge) {
          this.jumpToYear(this.minYear);
        } else if (e.key === 'End' && !this.challenge) {
          this.jumpToYear(this.maxYear);
        } else if (
          (e.key === ' ' || e.key === 'Enter') &&
          this.challenge &&
          (this.challenge.pendingGuess ||
            this.challenge.answered ||
            Boolean(this._id('act-next-round') && this._id('act-next-round').onclick))
        ) {
          e.preventDefault();
          const nextBtn = this._id('act-next-round');
          if (nextBtn) nextBtn.click();
        } else if (e.key === ' ' && !this.challenge) {
          e.preventDefault();
          if (this.activePerson) {
            this.togglePersonAutoplay();
          } else if (this.playing) {
            this.stopAutoplay();
          } else {
            this.startAutoplay();
          }
        } else if (e.key === 'Escape') {
          this._dismissTopOverlay();
        }
      });

      // SVG Zoom & Pan (Mouse Wheel + Single-Finger Pan + Two-Finger Pinch Zoom)
      const viewportFrame = this._id('viewport-frame') || this.svg;
      viewportFrame.addEventListener(
        'wheel',
        (e) => {
          if (
            e.target &&
            e.target.closest &&
            e.target.closest(
              '#genealogy-card, #journey-card, #milestone-balloon, #map-search-results, #challenge-card'
            )
          ) {
            return;
          }
          e.preventDefault();
          this._recordGestureMove();
          const [mx, my] = this._clientToSvgPoint(e.clientX, e.clientY);
          const rawDelta =
            e.deltaMode === 1 ? e.deltaY * 18 : e.deltaMode === 2 ? e.deltaY * 240 : e.deltaY;
          const clampedDelta = Math.max(-220, Math.min(220, rawDelta || 0));
          const factor = Math.exp(-clampedDelta * 0.002);
          const nextW = Math.max(100, Math.min(1300, this.camera.w / factor));
          const k = nextW / this.camera.w;
          this.camera = {
            x: mx - (mx - this.camera.x) * k,
            y: my - (my - this.camera.y) * k,
            w: nextW,
            h: this.camera.h * k,
            zoom: 1000 / nextW,
          };
          this._applyCamera();
        },
        { passive: false }
      );

      this.activePointers = new Map();
      this.pinchState = null;
      this.longPressTimer = null;
      this.longPressTriggered = false;
      this.lastTouchTap = null;
      const clearLongPress = () => {
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
      };

      this.svg.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.svg.setPointerCapture(e.pointerId);

        if (this.activePointers.size === 1) {
          clearLongPress();
          this.longPressTriggered = false;
          this.didPan = false;
          this.pinchState = null;
          this.dragState = {
            startX: e.clientX,
            startY: e.clientY,
            camX: this.camera.x,
            camY: this.camera.y,
            rect: this.svg.getBoundingClientRect(),
          };
          if (e.pointerType === 'touch' && !this.challenge) {
            const downX = e.clientX;
            const downY = e.clientY;
            this.longPressTimer = setTimeout(() => {
              this.longPressTimer = null;
              if (!this.didPan && this.activePointers.size === 1 && !this.challenge) {
                this.longPressTriggered = true;
                const near = this._findNearestTouchNode(downX, downY, 24);
                if (
                  near.settlementEl &&
                  near.settlementEl.dataset.lng &&
                  near.settlementEl.dataset.lat
                ) {
                  this.openGenealogyAt(
                    Number(near.settlementEl.dataset.lng),
                    Number(near.settlementEl.dataset.lat)
                  );
                  return;
                }
                const [sx, sy] = this._clientToSvgPoint(downX, downY);
                const [lng, lat] = this.projector.toGeo(sx, sy);
                this.openGenealogyAt(lng, lat);
              }
            }, 460);
          }
        } else if (this.activePointers.size === 2) {
          clearLongPress();
          this.didPan = true;
          this.dragState = null;
          this.hoverTip.classList.add('is-hidden');
          const pts = Array.from(this.activePointers.values());
          const midX = (pts[0].x + pts[1].x) * 0.5;
          const midY = (pts[0].y + pts[1].y) * 0.5;
          const [svgMidX, svgMidY] = this._clientToSvgPoint(midX, midY);
          this.pinchState = {
            startDist: Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)),
            svgMidX,
            svgMidY,
            camX: this.camera.x,
            camY: this.camera.y,
            camW: this.camera.w,
            camH: this.camera.h,
            rect: this.svg.getBoundingClientRect(),
          };
        }
      });

      this.svg.addEventListener('pointermove', (e) => {
        if (this.activePointers.has(e.pointerId)) {
          this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        if (this.activePointers.size === 2 && this.pinchState) {
          this._recordGestureMove();
          this.lastPinchTime = Date.now();
          const pts = Array.from(this.activePointers.values());
          const dist = Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
          const factor = dist / this.pinchState.startDist;
          const nextW = Math.max(100, Math.min(1300, this.pinchState.camW / factor));
          const k = nextW / this.pinchState.camW;
          const midX = (pts[0].x + pts[1].x) * 0.5;
          const midY = (pts[0].y + pts[1].y) * 0.5;
          const rect = this.pinchState.rect || this.svg.getBoundingClientRect();
          const scale = Math.min(rect.width / nextW, rect.height / (this.pinchState.camH * k));
          const padX = (rect.width - nextW * scale) * 0.5;
          const padY = (rect.height - this.pinchState.camH * k * scale) * 0.5;
          this.camera = {
            x: this.pinchState.svgMidX - (midX - rect.left - padX) / scale,
            y: this.pinchState.svgMidY - (midY - rect.top - padY) / scale,
            w: nextW,
            h: this.pinchState.camH * k,
            zoom: 1000 / nextW,
          };
          this._applyCamera();
          return;
        }

        if (!this.dragState) return;
        const dx = e.clientX - this.dragState.startX;
        const dy = e.clientY - this.dragState.startY;
        if (Math.hypot(dx, dy) > 4) {
          clearLongPress();
          this.didPan = true;
          this._recordGestureMove();
          this.svg.classList.add('is-panning');
          if (e.pointerType === 'touch') {
            this.hoverTip.classList.add('is-hidden');
          }
        }
        if (this.didPan) {
          const rect = this.dragState.rect || this.svg.getBoundingClientRect();
          const scale = Math.min(rect.width / this.camera.w, rect.height / this.camera.h);
          this.camera.x = this.dragState.camX - dx / scale;
          this.camera.y = this.dragState.camY - dy / scale;
          this._applyCamera();
        }
      });

      const inspectPointTooltip = (e) => {
        if (this.challenge && !this.challenge.answered) {
          this.hoverTip.classList.add('is-hidden');
          this.hoverTip.classList.remove('is-interactive');
          return;
        }
        const target = document.elementFromPoint(e.clientX, e.clientY) || e.target;
        const rawStack = document.elementsFromPoint
          ? document.elementsFromPoint(e.clientX, e.clientY)
          : [];
        const stack = rawStack.length ? rawStack : target ? [target] : [];
        const findClosest = (sel) => {
          for (const el of stack) {
            const hit = el && el.closest && el.closest(sel);
            if (hit) return hit;
          }
          return null;
        };
        const journeyNodeEl = findClosest('.journey-node');
        const settlementNameEl = findClosest('.settlement-node .name, .cap-hint-tag');
        const settlementEl = findClosest('.settlement-node');
        const corridorEl = findClosest('.corridor-line');
        const milestoneEl = findClosest('.milestone-pin');
        const cur = this.dynasties[this.dynastyIdx];
        const mHit = milestoneEl && cur ? this._resolvePinMilestone(cur, milestoneEl) : null;
        const coCity =
          !settlementEl && mHit && mHit.coord
            ? this._findCoLocatedSettlement(cur, mHit.coord[0], mHit.coord[1], 28)
            : null;

        if (journeyNodeEl && this.activeCustomRoute) {
          const sIdx = Number(journeyNodeEl.dataset.stopIdx);
          const stop = this.activeCustomRoute[sIdx];
          if (stop) {
            const rawLabel = stop.query || stop.name;
            const isEn = this.locale === 'en';
            const label = isEn ? this.trTerm(rawLabel) : rawLabel;
            const mod =
              stop.modern && stop.modern !== rawLabel
                ? isEn
                  ? ` (Now ${this.trModernCity(stop.modern)})`
                  : `（今${stop.modern}）`
                : '';
            const yr = this.formatYear(stop.year !== undefined ? stop.year : this.year);
            this._showHoverTip(
              e,
              `<b>${sIdx + 1}. ${label}${mod}</b><div class="tt-sub">${yr} · ${
                isEn
                  ? 'Click to jump to this year & trace history'
                  : '点击切换至该年份并查看历代沿革'
              }</div>`
            );
            return;
          }
        } else if (journeyNodeEl && this.activePerson) {
          const sIdx = Number(journeyNodeEl.dataset.stopIdx);
          const ev = this.activePerson.events[sIdx];
          if (ev) {
            const isEn = this.locale === 'en';
            const place = isEn ? ev.siteEn || this.trTerm(ev.siteZh) : ev.siteZh;
            const yr = this.formatYear(ev.year);
            this._showHoverTip(
              e,
              `<b>${sIdx + 1}. ${yr} · ${place}</b><div class="tt-sub">${
                isEn ? ev.textEn : ev.textZh
              }</div>`
            );
            return;
          }
        } else if (milestoneEl && !settlementNameEl && mHit) {
          const eraPart = this.locale === 'en' ? '' : ` · ${this._eventEraLabel(cur, mHit)}`;
          const alreadyOpen =
            this.activeMilestone &&
            this.activeMilestone.dynastyKey === cur.key &&
            this.activeMilestone.milestone === mHit &&
            !this.milestoneBalloon.classList.contains('is-hidden');
          const hasCity = Boolean(settlementEl || coCity);
          const actionHint = alreadyOpen
            ? this.locale === 'en'
              ? 'Click again to trace place history'
              : '再次点击查看此地历代沿革'
            : hasCity
              ? this.locale === 'en'
                ? 'Click for event · Click city name to trace history'
                : '点击查看事件 · 点击城名查历代沿革'
              : this.uiStr('click_for_detail', '点击查看详情');
          this._showHoverTip(
            e,
            `<b>◆ ${this.formatYear(mHit.year)}${eraPart} · ${this.milestoneHeadline(cur, mHit)}</b><div class="tt-sub">${
              mHit.site ? SVG_ICONS.pin + ' ' + this.milestoneSite(cur, mHit) + ' · ' : ''
            }${actionHint}</div>`
          );
        } else if (settlementEl && settlementEl.classList.contains('is-pass')) {
          const pName = settlementEl.dataset.ancient;
          const pMod = settlementEl.dataset.modern;
          const pRange = settlementEl.dataset.remark;
          const pChoke = settlementEl.dataset.chokepoint || '';
          const badge = this.locale === 'en' ? '[Strategic Pass]' : '【天下名关】';
          const traceHint =
            this.locale === 'en' ? 'Click to view pass history & battles ›' : '点击查看关隘形胜与历代战史 ›';
          const locStr = this.locale === 'en' ? `Now ${pMod}` : `今${pMod}`;
          this._showHoverTip(
            e,
            `<b>${badge} ${pName}（${locStr}）</b><div class="tt-sub">${pRange} · ${pChoke}</div><div class="tt-sub">${traceHint}</div>`
          );
        } else if (settlementEl || coCity) {
          const isModernDyn = Boolean(cur && (cur.key === 'roc' || cur.key === 'prc'));
          const rawAnc = settlementEl ? settlementEl.dataset.ancient : coCity.ancient;
          const rawMod = settlementEl ? settlementEl.dataset.modern : coCity.modern || '';
          const rawRem = settlementEl ? settlementEl.dataset.remark : coCity.remark || '';
          const anc = isModernDyn ? this.trModernCity(rawAnc) : this.trTerm(rawAnc);
          const mod = this.trModernCity(rawMod);
          const rem = this.trTerm(rawRem);
          const hasDiffMod = Boolean(rawMod && rawMod !== rawAnc);
          const traceHint = this.locale === 'en' ? ' · Click to trace history' : ' · 点击查看历代沿革';
          const sub =
            this.locale === 'en'
              ? `${hasDiffMod ? 'Now ' + mod : 'Same modern name'}${rem ? ' · ' + rem : ''}${traceHint}`
              : `${hasDiffMod ? '今 ' + mod : '古今同名'}${rem ? ' · ' + rem : ''}${traceHint}`;
          this._showHoverTip(e, `<b>${anc}</b><div class="tt-sub">${sub}</div>`);
        } else if (corridorEl) {
          this._showHoverTip(
            e,
            `<b>${corridorEl.dataset.corrTitle}</b><div class="tt-sub">${corridorEl.dataset.corrSummary || ''}</div>`
          );
        } else if (
          target &&
          target.dataset &&
          (target.dataset.prefTitle ||
            target.dataset.polityTitle ||
            target.dataset.provTitle ||
            target.dataset.countryTitle)
        ) {
          const findData = (key) => {
            const hit = stack.find((el) => el.dataset && el.dataset[key]);
            return hit ? hit.dataset : null;
          };
          const pref = findData('prefTitle');
          const pol = findData('polityTitle');
          const prov = findData('provTitle');
          const country = findData('countryTitle');

          let reg = null;
          if (
            pol &&
            pol.polityRole !== 'neighbor' &&
            this.grpPrefectures &&
            !this.grpPrefectures.classList.contains('is-hidden') &&
            this.lastRenderedSnap &&
            Array.isArray(this.lastRenderedSnap.regions) &&
            this.lastRenderedSnap.regions.length
          ) {
            const [sx, sy] = this._clientToSvgPoint(e.clientX, e.clientY);
            const [lng, lat] = this.projector.toGeo(sx, sy);
            reg =
              this.lastRenderedSnap.regions.find(
                (r) => r && r.title && r.shape && MercatorProjector.pointInShape(lng, lat, r.shape)
              ) || null;
          }
          const formatAdminLabel = (rawTitle, rawCat) => {
            const name = this.trTerm(rawTitle);
            const isEmigre = rawCat === '侨州' || rawCat === '侨郡';
            return this.locale === 'en'
              ? name + (isEmigre ? ' (Emigre)' : '')
              : name + (rawCat && !name.endsWith(rawCat) ? '（' + rawCat + '）' : '');
          };

          const lines = [];
          if (pref) {
            lines.push(`<b>${formatAdminLabel(pref.prefTitle, pref.prefCategory)}</b>`);
            if (pol) {
              const regSuffix =
                reg && reg.title !== pref.prefTitle
                  ? ` · ${formatAdminLabel(reg.title, reg.category)}`
                  : '';
              lines.push(
                `<div class="tt-sub">${this.uiStr('belongs_to', '属 ')}${this.trTerm(pol.polityTitle)}${regSuffix}</div>`
              );
            }
          } else if (reg) {
            lines.push(`<b>${formatAdminLabel(reg.title, reg.category)}</b>`);
            if (pol) {
              lines.push(
                `<div class="tt-sub">${this.uiStr('belongs_to', '属 ')}${this.trTerm(pol.polityTitle)}</div>`
              );
            }
          } else if (pol) {
            const tag =
              pol.polityRole === 'neighbor'
                ? this.uiStr('tag_neighbor', '（同期周边政权）')
                : pol.polityRole === 'protectorate'
                  ? this.uiStr('tag_prot', '（都护府 / 羁縻）')
                  : this.uiStr('tag_hist', '（历史疆域）');
            lines.push(`<b>${this.trTerm(pol.polityTitle)}</b> <span class="tt-sub">${tag}</span>`);
          }
          if (prov) {
            lines.push(
              `<div class="tt-sub">${this.uiStr('now_prov', '今：')}${this.trTerm(prov.provTitle)}</div>`
            );
          } else if (country) {
            lines.push(
              `<div class="tt-sub">${this.uiStr('now_prov', '今：')}${this.trTerm(country.countryTitle)}</div>`
            );
          }
          if (e.pointerType === 'touch') {
            const [sx, sy] = this._clientToSvgPoint(e.clientX, e.clientY);
            const [lng, lat] = this.projector.toGeo(sx, sy);
            const btnLbl = this.locale === 'en' ? 'Trace Place History ›' : '查看此地历代沿革 ›';
            lines.push(
              `<div><button type="button" class="tt-trace-btn" data-lng="${lng.toFixed(3)}" data-lat="${lat.toFixed(3)}">${SVG_ICONS.pin} ${btnLbl}</button></div>`
            );
          }
          this._showHoverTip(e, lines.join(''));
        } else {
          this.hoverTip.classList.add('is-hidden');
          this.hoverTip.classList.remove('is-interactive');
        }
      };

      const endPointer = (e) => {
        clearLongPress();
        this.activePointers.delete(e.pointerId);
        if (this.activePointers.size < 2) {
          this.pinchState = null;
        }
        if (this.activePointers.size === 1) {
          const rem = Array.from(this.activePointers.values())[0];
          this.dragState = {
            startX: rem.x,
            startY: rem.y,
            camX: this.camera.x,
            camY: this.camera.y,
          };
          return;
        }
        if (this.longPressTriggered) {
          this.longPressTriggered = false;
          this.dragState = null;
          this.svg.classList.remove('is-panning');
          return;
        }
        const wasPan = this.didPan;
        this.dragState = null;
        this.svg.classList.remove('is-panning');
        if (!wasPan && this.challenge && !this.challenge.answered) {
          if (this.lastPinchTime && Date.now() - this.lastPinchTime < 350) {
            return;
          }
          this._recordGestureClick();
          const [sx, sy] = this._clientToSvgPoint(e.clientX, e.clientY);
          if (e.pointerType === 'touch') {
            this._previewLocatePin(sx, sy);
          } else {
            this._evaluateLocateClick(sx, sy);
          }
        } else if (!wasPan && !this.challenge) {
          this._recordGestureClick();
          if (e.pointerType === 'touch') {
            const now = Date.now();
            if (
              this.lastTouchTap &&
              now - this.lastTouchTap.time <= 340 &&
              Math.hypot(e.clientX - this.lastTouchTap.x, e.clientY - this.lastTouchTap.y) <= 28
            ) {
              this.lastTouchTap = null;
              const near = this._findNearestTouchNode(e.clientX, e.clientY, 24);
              if (
                near.settlementEl &&
                near.settlementEl.dataset.lng &&
                near.settlementEl.dataset.lat
              ) {
                this.openGenealogyAt(
                  Number(near.settlementEl.dataset.lng),
                  Number(near.settlementEl.dataset.lat)
                );
                return;
              }
              const [sx, sy] = this._clientToSvgPoint(e.clientX, e.clientY);
              const [lng, lat] = this.projector.toGeo(sx, sy);
              this.openGenealogyAt(lng, lat);
              return;
            }
            this.lastTouchTap = { time: now, x: e.clientX, y: e.clientY };
          }

          const hitTarget = document.elementFromPoint(e.clientX, e.clientY) || e.target;
          const rawStack = document.elementsFromPoint
            ? document.elementsFromPoint(e.clientX, e.clientY)
            : [];
          const stack = rawStack.length ? rawStack : hitTarget ? [hitTarget] : [];
          const findClosest = (sel) => {
            for (const el of stack) {
              const hit = el && el.closest && el.closest(sel);
              if (hit) return hit;
            }
            return null;
          };
          let journeyNodeEl = findClosest('.journey-node');
          if (!journeyNodeEl && e.pointerType === 'touch' && this.activePerson) {
            journeyNodeEl = this._findNearestPersonPin(e.clientX, e.clientY, 26);
          }
          if (journeyNodeEl && journeyNodeEl.dataset.stopIdx !== undefined) {
            if (this.activeCustomRoute) {
              this.selectCustomRouteStop(Number(journeyNodeEl.dataset.stopIdx), true);
              return;
            }
            if (this.activePerson) {
              if (this.personTimer) {
                clearInterval(this.personTimer);
                this.personTimer = null;
                this._updateAutoplayUi();
              }
              this.selectPersonEvent(Number(journeyNodeEl.dataset.stopIdx), true);
              return;
            }
          }
          const settlementNameEl = findClosest('.settlement-node .name, .cap-hint-tag');
          let settlementEl = findClosest('.settlement-node');
          let milestoneEl = findClosest('.milestone-pin');
          if (e.pointerType === 'touch' && !settlementEl && !milestoneEl) {
            const near = this._findNearestTouchNode(e.clientX, e.clientY, 22);
            settlementEl = near.settlementEl;
            milestoneEl = near.milestoneEl;
          }
          const cur = this.dynasties[this.dynastyIdx];

          // Clicking the city name text (e.g. "长安"), the onboarding whisper tag, or a city dot without an overlapping event pin -> trace place history
          if (
            settlementEl &&
            settlementEl.dataset.lng &&
            settlementEl.dataset.lat &&
            (settlementNameEl || !milestoneEl || settlementEl.classList.contains('has-trace-hint'))
          ) {
            this.openGenealogyAt(Number(settlementEl.dataset.lng), Number(settlementEl.dataset.lat));
            return;
          }

          // Clicking an event diamond pin (◆) -> open event balloon (or trace place history if balloon is already open)
          if (milestoneEl && cur) {
            const m = this._resolvePinMilestone(cur, milestoneEl);
            const mIdx = m ? (cur.milestones || []).indexOf(m) : -1;
            if (m && m.coord) {
              const coCity = settlementEl
                ? { coord: [Number(settlementEl.dataset.lng), Number(settlementEl.dataset.lat)] }
                : this._findCoLocatedSettlement(cur, m.coord[0], m.coord[1], 28);
              const targetCoord = coCity ? coCity.coord : m.coord;
              const alreadyOpen =
                this.activeMilestone &&
                this.activeMilestone.dynastyKey === cur.key &&
                this.activeMilestone.idx === mIdx &&
                !this.milestoneBalloon.classList.contains('is-hidden');
              if (alreadyOpen) {
                this.openGenealogyAt(targetCoord[0], targetCoord[1]);
                return;
              }
              this.stopAutoplay();
              this.jumpToYear(this._clampYearToDynasty(cur, m.year));
              this.openMilestoneBalloon(cur, m);
              this._panToward(m.coord[0], m.coord[1]);
              if (
                window.innerWidth > 900 &&
                !this._id('genealogy-card').classList.contains('is-hidden')
              ) {
                this.openGenealogyAt(targetCoord[0], targetCoord[1]);
              }
              return;
            }
          }

          if (e.pointerType === 'touch') {
            inspectPointTooltip(e);
          }
        }
      };
      this.svg.addEventListener('pointerup', endPointer);
      this.svg.addEventListener('pointercancel', endPointer);
      this.svg.addEventListener('dblclick', (e) => {
        if (this.challenge) return;
        this._recordGestureClick();
        const [sx, sy] = this._clientToSvgPoint(e.clientX, e.clientY);
        const [lng, lat] = this.projector.toGeo(sx, sy);
        this.openGenealogyAt(lng, lat);
      });

      // Hover tooltips (Desktop pointermove)
      const frame = this._id('viewport-frame');
      frame.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        this.grpPrefectures
          .querySelectorAll('.prefecture-shape.is-hovered')
          .forEach((el) => el.classList.remove('is-hovered'));
        inspectPointTooltip(e);
      });

      frame.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'touch') return;
        this.hoverTip.classList.add('is-hidden');
      });

      window.addEventListener('resize', () => {
        const vw = window.innerWidth;
        if (this._lastViewportWidth === undefined || Math.abs(vw - this._lastViewportWidth) > 8) {
          this._rescaleSvgTypography();
          this._syncTogglePaneButton();
        }
        this._updateScaleBar();
      });
    }

    _showHoverTip(e, html) {
      const rect = this._id('viewport-frame').getBoundingClientRect();
      this.hoverTip.innerHTML = html;
      if (this.locale === 'zh-tw') this._applyZhHantDom(this.hoverTip);
      const traceBtn = this.hoverTip.querySelector('.tt-trace-btn');
      this.hoverTip.classList.toggle('is-interactive', Boolean(traceBtn));
      if (traceBtn) {
        traceBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.openGenealogyAt(Number(traceBtn.dataset.lng), Number(traceBtn.dataset.lat));
        });
      }
      this.hoverTip.classList.remove('is-hidden');
      const left = Math.max(8, Math.min(rect.width - 190, e.clientX - rect.left + 12));
      const top = Math.max(8, Math.min(rect.height - 90, e.clientY - rect.top - 12));
      this.hoverTip.style.left = `${left}px`;
      this.hoverTip.style.top = `${top}px`;
    }

    // ---------------- AI-Native Public API (resolvePlace / inspect / locate) ----------------
    _parsePlaceList(place) {
      if (!place || typeof place !== 'string') return [];
      return place
        .split(/\s*(?:,|，|、|→|->)\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    _parseYearList(year) {
      if (year === undefined || year === null || year === '') return [];
      const raw = Array.isArray(year) ? year.join(',') : String(year);
      return raw
        .split(/[,，、;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => !Number.isNaN(n))
        .map((n) => {
          const clamped = Math.max(this.minYear, Math.min(this.maxYear, Math.round(n)));
          return clamped === 0 ? 1 : clamped;
        });
    }

    _parsePlaceTokens(place, year) {
      const rawTokens = this._parsePlaceList(place);
      const yearList = this._parseYearList(year);
      const defaultYear = yearList.length ? yearList[0] : this.year;
      return rawTokens.map((tok, idx) => {
        let stopYear = yearList.length
          ? yearList[Math.min(idx, yearList.length - 1)]
          : defaultYear;
        let stopPlace = tok;
        const m1 = tok.match(/^(-?\d{1,4})\s*[:：]\s*(.+)$/);
        const m2 = !m1 ? tok.match(/^(.+?)\s*[:：]\s*(-?\d{1,4})$/) : null;
        if (m1) {
          const y = Math.max(this.minYear, Math.min(this.maxYear, Math.round(Number(m1[1]))));
          stopYear = y === 0 ? 1 : y;
          stopPlace = m1[2].trim();
        } else if (m2) {
          const y = Math.max(this.minYear, Math.min(this.maxYear, Math.round(Number(m2[2]))));
          stopYear = y === 0 ? 1 : y;
          stopPlace = m2[1].trim();
        }
        return { place: stopPlace, year: stopYear };
      });
    }

    resolvePlace(place, year = this.year) {
      if (!place || typeof place !== 'string') return null;
      const rawInput = place.trim();
      if (!rawInput) return null;
      const raw = /[\u4e00-\u9fff]/.test(rawInput) ? this._toHans(rawInput) : rawInput;

      const normApos = (s) =>
        String(s || '')
          .toLowerCase()
          .replace(/[’‘`]/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
      const normSpace = (s) =>
        String(s || '')
          .toLowerCase()
          .replace(/['’‘`\-_.]+/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      const foldAscii = (s) =>
        String(s || '')
          .toLowerCase()
          .replace(/['’‘`\-_.\s]+/g, '');
      const stripParens = (s) =>
        String(s || '')
          .replace(/（.*?）|\(.*?\)/g, '')
          .trim();
      const extractParens = (s) => {
        const out = [];
        const re = /[（(]([^）)]+)[）)]/g;
        let m;
        while ((m = re.exec(String(s || ''))) !== null) {
          if (m[1] && m[1].trim()) out.push(m[1].trim().toLowerCase());
        }
        return out;
      };

      const q = raw.toLowerCase();
      const qApos = normApos(q);
      const hasQueryParens = /[（(]/.test(raw);
      const isAsciiQuery = /[a-z]/i.test(raw) && !/[\u4e00-\u9fa5]/.test(raw);
      const isPassSuffix = /(?:关|\s+(?:pass|guan))$/i.test(raw);
      const stripped = raw
        .replace(
          /(?:省|市|州|郡|府|道|路|县|国|关|城|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区)$/,
          ''
        )
        .replace(
          /\s+(?:province|prefecture|commandery|circuit|pass|city|county|region|autonomous\s+region|municipality|sar|fu|zhou|jun|lu|dao|xian|guan)$/i,
          ''
        )
        .trim();
      const qStripped = stripped.length >= 2 ? stripped.toLowerCase() : q;
      const qNorm = isAsciiQuery ? normSpace(q) : q;
      const qStrippedNorm = isAsciiQuery ? normSpace(qStripped) : qStripped;
      const qFold = isAsciiQuery ? foldAscii(q) : '';
      const qStrippedFold = isAsciiQuery ? foldAscii(qStripped) : '';

      const yr = Number.isFinite(Number(year)) ? Number(year) : this.year;
      const targetDynIdx = this._findDynastyIndex(yr);
      const targetDyn = this.dynasties[targetDynIdx] || this.dynasties[0];
      const orderedDynasties = [
        targetDyn,
        ...this.dynasties.filter((d) => d !== targetDyn),
      ];

      const passModes = isAsciiQuery
        ? ['strict', 'folded', 'substring']
        : ['strict', 'substring'];

      // Pass 1A ('strict': apostrophe-preserving) -> Pass 1B ('folded': space/apostrophe-insensitive) -> Pass 2 ('substring')
      for (const mode of passModes) {
        const isExact = mode !== 'substring';
        const isFolded = mode === 'folded';

        // 1. Strategic passes (名关雄隘)
        for (const allowStrip of isExact ? [false, true] : [true]) {
          for (const p of HistoricalAtlasController.STRATEGIC_PASSES) {
            const cleanZh = stripParens(p.ancientZh || '');
            const cleanEn = stripParens(p.ancientEn || '');
            const bareZh = cleanZh.replace(/关$/, '').trim();
            const bareKey = (p.key || '').replace(/guan$/, '').trim();
            const names = [
              p.ancientZh,
              allowStrip && !hasQueryParens ? cleanZh : '',
              allowStrip && bareZh.length >= 2 ? bareZh : '',
              ...(allowStrip ? extractParens(p.ancientZh) : []),
              ...(p.aliases || []),
              p.ancientEn,
              allowStrip && !hasQueryParens ? cleanEn : '',
              ...(allowStrip ? extractParens(p.ancientEn) : []),
              p.key,
              bareKey.length >= 3 ? `${bareKey} pass` : '',
            ]
              .filter(Boolean)
              .map((s) => s.toLowerCase());

            const matched =
              mode === 'strict'
                ? names.some(
                    (n) =>
                      n === q ||
                      (allowStrip && isPassSuffix && n === qStripped) ||
                      (isAsciiQuery &&
                        (normApos(n) === qApos ||
                          (allowStrip &&
                            isPassSuffix &&
                            normApos(n) === normApos(qStripped))))
                  )
                : isFolded
                  ? names.some(
                      (n) =>
                        qFold.length >= 3 &&
                        (foldAscii(n) === qFold ||
                          (allowStrip &&
                            isPassSuffix &&
                            qStrippedFold.length >= 3 &&
                            foldAscii(n) === qStrippedFold))
                    )
                  : names.some(
                      (n) =>
                        n.includes(q) ||
                        (q.length >= 2 && q.includes(n)) ||
                        (isAsciiQuery &&
                          qFold.length >= 4 &&
                          (foldAscii(n).includes(qFold) ||
                            (foldAscii(n).length >= 4 && qFold.includes(foldAscii(n)))))
                    );
            if (matched) {
              return {
                kind: 'pass',
                name: p.ancientZh,
                modern: p.modernZh || '',
                lng: p.coord[0],
                lat: p.coord[1],
                coord: p.coord,
                zoom: 2.6,
              };
            }
          }
        }

        const matchSettlement = (s, allowStrip = true) => {
          const anc = (s.ancient || '').toLowerCase();
          const mod = (s.modern || '').toLowerCase();
          const cleanAnc = stripParens(anc);
          let hit = false;
          if (!isAsciiQuery) {
            hit = !allowStrip
              ? anc === q || mod === q
              : isExact
                ? anc === q ||
                  (!hasQueryParens && cleanAnc === q) ||
                  mod === q ||
                  (!hasQueryParens && cleanAnc === qStripped) ||
                  mod === qStripped
                : anc.includes(q) ||
                  mod.includes(q) ||
                  (!hasQueryParens &&
                    qStripped.length >= 2 &&
                    (anc.includes(qStripped) || mod.includes(qStripped)));
          } else {
            const ancEnRaw = this._enDict(s.ancient || '').toLowerCase();
            const cleanAncEn = stripParens(ancEnRaw);
            const ancParens = extractParens(ancEnRaw);
            const modEnRaw = this._enModernCity(s.modern || '').toLowerCase();
            const cleanModEn = stripParens(modEnRaw);
            const modCityPart = cleanModEn.split(',')[0].trim();
            const candidates = !allowStrip
              ? [
                  ancEnRaw,
                  cleanModEn,
                  !hasQueryParens ? modCityPart : '',
                ].filter(Boolean)
              : mode === 'strict'
                ? [
                    ancEnRaw,
                    !hasQueryParens ? cleanAncEn : '',
                    cleanModEn,
                    !hasQueryParens ? modCityPart : '',
                  ].filter(Boolean)
                : [
                    ancEnRaw,
                    !hasQueryParens ? cleanAncEn : '',
                    ...(!hasQueryParens ? ancParens : []),
                    cleanModEn,
                    !hasQueryParens ? modCityPart : '',
                  ].filter(Boolean);
            if (mode === 'strict') {
              const qStrippedApos = normApos(qStripped);
              hit = candidates.some(
                (c) =>
                  normApos(c) === qApos ||
                  (allowStrip &&
                    !hasQueryParens &&
                    qStrippedApos.length >= 2 &&
                    normApos(c) === qStrippedApos)
              );
            } else if (isFolded) {
              hit =
                qFold.length >= 2 &&
                candidates.some(
                  (c) =>
                    normSpace(c) === qNorm ||
                    foldAscii(c) === qFold ||
                    (allowStrip &&
                      !hasQueryParens &&
                      qStrippedFold.length >= 2 &&
                      (normSpace(c) === qStrippedNorm || foldAscii(c) === qStrippedFold))
                );
            } else {
              hit = candidates.some(
                (c) =>
                  c.includes(q) ||
                  (!hasQueryParens && qStripped.length >= 3 && c.includes(qStripped)) ||
                  (qFold.length >= 4 && foldAscii(c).includes(qFold))
              );
            }
          }
          if (!hit) return null;
          return {
            kind: 'city',
            name: s.ancient,
            modern: s.modern || '',
            lng: s.coord[0],
            lat: s.coord[1],
            coord: s.coord,
            zoom: s.tier === 2 ? 2.6 : 2.3,
          };
        };

        // 2a. Target dynasty settlements first (preserves era-specific homonyms like 战国/西汉 江州=重庆)
        for (const allowStrip of isExact ? [false, true] : [true]) {
          for (const s of targetDyn.settlements || []) {
            const res = matchSettlement(s, allowStrip);
            if (res) return res;
          }
        }

        // 2b. On exact pass, check Poetic & Historical Gazetteer before out-of-era settlements
        // so Tang/Song 江州 (江西九江) is not hijacked by Warring States 江州（巴）(重庆)
        const matchGazetteer = () => {
          for (const g of HistoricalAtlasController.PLACE_GAZETTEER) {
            const rawList = [g.name, ...(g.aliases || [])].filter(Boolean);
            const zhNames = rawList.map((s) => s.toLowerCase());
            let matched = false;
            if (!isAsciiQuery) {
              matched = isExact
                ? zhNames.some(
                    (n) =>
                      n === q ||
                      (!hasQueryParens && stripParens(n) === q) ||
                      (!hasQueryParens && stripParens(n) === qStripped)
                  )
                : zhNames.some(
                    (n) =>
                      n.includes(q) ||
                      (!hasQueryParens && qStripped.length >= 2 && n.includes(qStripped))
                  );
            } else {
              const enNames = [];
              for (const rawItem of rawList) {
                const tr = this._enDict(rawItem).toLowerCase();
                if (tr && !/[\u4e00-\u9fa5]/.test(tr)) {
                  enNames.push(
                    tr,
                    !hasQueryParens ? stripParens(tr) : '',
                    ...(!hasQueryParens && mode !== 'strict' ? extractParens(tr) : [])
                  );
                }
              }
              const allEn = [...enNames, ...(g.asciiAliases || [])].filter(Boolean);
              if (mode === 'strict') {
                const qStrippedApos = normApos(qStripped);
                matched = allEn.some(
                  (n) =>
                    normApos(n) === qApos ||
                    (!hasQueryParens && qStrippedApos.length >= 3 && normApos(n) === qStrippedApos)
                );
              } else if (isFolded) {
                matched =
                  qFold.length >= 3 &&
                  allEn.some(
                    (n) =>
                      normSpace(n) === qNorm ||
                      foldAscii(n) === qFold ||
                      (!hasQueryParens &&
                        qStrippedFold.length >= 3 &&
                        (normSpace(n) === qStrippedNorm || foldAscii(n) === qStrippedFold))
                  );
              } else {
                matched = allEn.some(
                  (n) =>
                    n.includes(q) ||
                    (!hasQueryParens && qStripped.length >= 3 && n.includes(qStripped)) ||
                    (qFold.length >= 4 && foldAscii(n).includes(qFold))
                );
              }
            }
            if (matched) {
              return {
                kind: 'gazetteer',
                name: g.name,
                modern: g.modern || '',
                lng: g.coord[0],
                lat: g.coord[1],
                coord: g.coord,
                zoom: g.zoom || 2.6,
              };
            }
          }
          return null;
        };

        if (isExact) {
          const gazHit = matchGazetteer();
          if (gazHit) return gazHit;
        }

        // 2c. Remaining dynasties' settlements
        for (const allowStrip of isExact ? [false, true] : [true]) {
          for (const d of orderedDynasties.slice(1)) {
            for (const s of d.settlements || []) {
              const res = matchSettlement(s, allowStrip);
              if (res) return res;
            }
          }
        }

        // 3. Poetic & Historical Gazetteer (substring pass)
        if (!isExact) {
          const gazHit = matchGazetteer();
          if (gazHit) return gazHit;
        }
      }

      // 3. Curated Historical Journey stops
      for (const j of HistoricalAtlasController.HISTORICAL_JOURNEYS) {
        for (const st of j.stops || []) {
          const anc = (st.ancientZh || '').toLowerCase();
          const mod = (st.modernZh || '').toLowerCase();
          const ancEn = (st.ancientEn || '').toLowerCase();
          const modEn = (st.modernEn || '').toLowerCase();
          const zhHit = anc === q || mod === q || anc.includes(q) || mod.includes(q);
          const enHit =
            isAsciiQuery &&
            (ancEn === q ||
              modEn === q ||
              foldAscii(ancEn) === qFold ||
              foldAscii(stripParens(ancEn)) === qFold ||
              ancEn.includes(q) ||
              modEn.includes(q));
          if (zhHit || enHit) {
            return {
              kind: 'journey_stop',
              name: st.ancientZh,
              modern: st.modernZh || '',
              lng: st.coord[0],
              lat: st.coord[1],
              coord: st.coord,
              zoom: 2.5,
            };
          }
        }
      }

      // 4. Milestones & Landmark Events
      for (const d of orderedDynasties) {
        for (const m of d.milestones || []) {
          if (!m.coord) continue;
          const site = (m.site || '').toLowerCase();
          const head = (m.headline || '').toLowerCase();
          const enPair =
            this.enLocale && this.enLocale.milestones && this.enLocale.milestones[`${d.key}:${m.year}`];
          const headEn = (
            m.headlineEn ||
            (Array.isArray(enPair) ? enPair[0] : enPair) ||
            ''
          ).toLowerCase();
          const siteEn = (
            m.siteEn ||
            (Array.isArray(enPair) ? enPair[1] : '') ||
            (m.site ? this._enDict(m.site) : '')
          ).toLowerCase();
          const zhHit = (site && (site.includes(q) || q.includes(site))) || head.includes(q);
          const enHit =
            isAsciiQuery &&
            ((siteEn &&
              (siteEn.includes(q) ||
                (qFold.length >= 4 && foldAscii(siteEn).includes(qFold)))) ||
              (headEn && headEn.includes(q)));
          if (zhHit || enHit) {
            return {
              kind: 'event_site',
              name: m.site || raw,
              modern: '',
              lng: m.coord[0],
              lat: m.coord[1],
              coord: m.coord,
              zoom: 2.5,
            };
          }
        }
      }
      for (const lm of HistoricalAtlasController.PLACE_LANDMARK_EVENTS) {
        if (!lm.coord) continue;
        const site = (lm.site || '').toLowerCase();
        const zh = (lm.zh || '').toLowerCase();
        const siteEn = (lm.siteEn || '').toLowerCase();
        const en = (lm.en || '').toLowerCase();
        const zhHit = (site && (site.includes(q) || q.includes(site))) || zh.includes(q);
        const enHit =
          isAsciiQuery &&
          ((siteEn &&
            (siteEn.includes(q) || (qFold.length >= 4 && foldAscii(siteEn).includes(qFold)))) ||
            (en && en.includes(q)));
        if (zhHit || enHit) {
          return {
            kind: 'event_site',
            name: lm.site || raw,
            modern: '',
            lng: lm.coord[0],
            lat: lm.coord[1],
            coord: lm.coord,
            zoom: 2.5,
          };
        }
      }

      // 5. Prefectures & Macro Regions across snapshots (preferring target dynasty snapshot)
      const targetSnapKey = this._resolveSnapKey(targetDyn, yr);
      const allSnapKeys = [
        targetSnapKey,
        ...Object.keys(this.snapshots).filter((k) => k !== 'neighbors' && k !== targetSnapKey),
      ];
      for (const exact of [true, false]) {
        for (const sk of allSnapKeys) {
          const snap = this.snapshots[sk];
          if (!snap) continue;
          for (const item of [...(snap.prefectures || []), ...(snap.regions || [])]) {
            if (!item.title || !item.anchor) continue;
            const t = item.title.toLowerCase();
            const tEn = isAsciiQuery ? this._enDict(item.title).toLowerCase() : '';
            const tEnStripped = tEn
              .replace(
                /\s+(?:province|prefecture|commandery|circuit|region|protectorate|fu|zhou|jun|dao|lu)$/i,
                ''
              )
              .trim();
            const isPref = (snap.prefectures || []).includes(item);
            const zhMatch = exact
              ? t === q || t === qStripped
              : t.includes(q) || t.includes(qStripped);
            const enMatch =
              isAsciiQuery &&
              tEn &&
              (exact
                ? tEn === q ||
                  tEnStripped === qStripped ||
                  foldAscii(tEn) === qFold ||
                  (qStrippedFold.length >= 3 && foldAscii(tEnStripped) === qStrippedFold)
                : tEn.includes(q) ||
                  (qFold.length >= 4 && foldAscii(tEn).includes(qFold)));
            if (zhMatch || enMatch) {
              return {
                kind: isPref ? 'prefecture' : 'region',
                name: item.title,
                modern: '',
                lng: item.anchor[0],
                lat: item.anchor[1],
                coord: item.anchor,
                zoom: isPref ? 2.4 : 2.0,
              };
            }
          }
        }
      }

      // 6. Modern Provinces
      for (const prov of this.provinces || []) {
        if (!prov.hub || String(prov.code).includes('_JD')) continue;
        const pt = prov.title.toLowerCase();
        const ptShort = prov.title
          .replace(/(?:省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区)$/, '')
          .toLowerCase();
        const ptEn = isAsciiQuery
          ? (this._enDict(prov.title) || this._enDict(ptShort) || '').toLowerCase()
          : '';
        const zhMatch = pt === q || pt.includes(q) || pt.includes(qStripped);
        const enMatch =
          isAsciiQuery &&
          ptEn &&
          (ptEn === q ||
            ptEn === qStripped ||
            foldAscii(ptEn) === qFold ||
            foldAscii(ptEn) === qStrippedFold ||
            ptEn.includes(qStripped));
        if (zhMatch || enMatch) {
          return {
            kind: 'province',
            name: prov.title,
            modern: prov.title,
            lng: prov.hub[0],
            lat: prov.hub[1],
            coord: prov.hub,
            zoom: 2.0,
          };
        }
      }

      // Fallback syntax like "古名(今名)" or "古名/今名" if full string did not match
      if (/[（()/]/.test(raw)) {
        const subParts = raw
          .split(/[（()/）]/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (subParts.length > 1) {
          for (const sp of subParts) {
            const hit = this.resolvePlace(sp, year);
            if (hit) return hit;
          }
        }
      }

      return null;
    }

    _inspectCoord(cLng, cLat, d, snap) {
      const isEn = this.locale === 'en';
      const eraHit = this._resolveEraPlaceAt(cLng, cLat, d, snap);
      const modernProvince = eraHit.modernLoc.inModernChina
        ? isEn
          ? this.trTerm(eraHit.modernLoc.modernTitle)
          : this._zh(eraHit.modernLoc.modernTitle)
        : null;
      const nearestCity = eraHit.near
        ? {
            ancient: isEn ? this.trTerm(eraHit.near.s.ancient) : this._zh(eraHit.near.s.ancient),
            modern: isEn
              ? this.trModernCity(eraHit.near.s.modern || '')
              : this._zh(eraHit.near.s.modern || ''),
            distanceKm: Math.round(eraHit.near.km),
            ...(eraHit.near.s.isCapital ? { isCapital: true } : {}),
            ...(eraHit.near.s.remark
              ? { remark: isEn ? this.trTerm(eraHit.near.s.remark) : this._zh(eraHit.near.s.remark) }
              : {}),
          }
        : null;
      const fmt = (item) => {
        if (isEn) {
          const isEmigre = item.category === '侨州' || item.category === '侨郡';
          return this.trTerm(item.title) + (isEmigre ? ' (Emigre)' : '');
        }
        return this._zh(
          item.title +
            (item.category && !item.title.endsWith(item.category) ? `(${item.category})` : '')
        );
      };
      const regions =
        d && d.key === 'prc'
          ? modernProvince
            ? [modernProvince]
            : []
          : Array.from(new Set(eraHit.regionObjs.map(fmt)));
      const rawProvTitle = eraHit.modernLoc.inModernChina ? eraHit.modernLoc.modernTitle : null;
      const rawNearAncient = eraHit.near && eraHit.near.s ? eraHit.near.s.ancient : '';
      const prefectures =
        d && d.key === 'prc'
          ? rawProvTitle &&
            nearestCity &&
            nearestCity.distanceKm <= 25 &&
            rawNearAncient &&
            !rawProvTitle.startsWith(rawNearAncient)
            ? [nearestCity.ancient]
            : []
          : Array.from(new Set(eraHit.prefObjs.map(fmt)));
      const closestOverall = this._findNearestSettlement(
        this._getCanonicalPlaces(),
        cLng,
        cLat,
        160
      );
      const matchedPassHit = this._findNearbyPass(cLng, cLat, 30);
      const matchedPass =
        matchedPassHit && !(closestOverall && closestOverall.km < matchedPassHit.km)
          ? matchedPassHit.pass
          : null;
      const identityModern = this._resolveModernIdentity(
        cLng,
        cLat,
        '',
        eraHit.modernLoc.modernTitle,
        closestOverall
      );
      const rawLore = this._resolvePlaceLoreBanner(cLng, cLat, matchedPass, identityModern, null);
      const lore =
        rawLore && this.locale === 'zh-tw'
          ? {
              ...rawLore,
              badge: this._zh(rawLore.badge),
              tag: this._zh(rawLore.tag),
              desc: this._zh(rawLore.desc),
            }
          : rawLore;
      return {
        polity: eraHit.polity ? (isEn ? this.trTerm(eraHit.polity) : this._zh(eraHit.polity)) : null,
        regions,
        prefectures,
        modernProvince,
        nearestCity,
        ...(lore ? { lore } : {}),
      };
    }

    _drawCustomRouteOverlay(stops) {
      if (!this.grpJourney || !Array.isArray(stops) || stops.length < 2) return null;
      this.grpJourney.innerHTML = '';
      const routeColor = '#9e2a2b';
      const segments = [];
      for (let i = 0; i < stops.length - 1; i++) {
        const segInfo = this._buildJourneySegmentInfo(stops[i].coord, stops[i + 1].coord);
        if (segInfo) segments.push({ ...segInfo, toIdx: i + 1 });
      }
      this._renderCartographicTrajectory(segments, this.customRouteStopIdx, routeColor);

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let prevSx = null;
      let prevSy = null;
      let prevBelow = false;

      const isMultiYear = new Set(stops.map((s) => s.year)).size > 1;
      stops.forEach((st, idx) => {
        const [sx, sy] = this.projector.toScreen(st.lng, st.lat);
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;

        const isHighlighted =
          this.customRouteStopIdx >= 0
            ? idx === this.customRouteStopIdx
            : idx === 0 || idx === stops.length - 1;
        const g = this._svgNode(
          'g',
          {
            class: `journey-node ${isHighlighted ? 'is-current' : 'is-passed'}`,
            'data-x': sx.toFixed(1),
            'data-y': sy.toFixed(1),
            'data-stop-idx': String(idx),
          },
          this.grpJourney
        );
        g.style.color = routeColor;

        if (isHighlighted) {
          this._svgNode('circle', { class: 'jn-pulse', r: 11.2 }, g);
        }
        this._svgNode('circle', { class: 'jn-disc', r: isHighlighted ? 7.8 : 6.6 }, g);
        const numTxt = this._svgNode('text', { class: 'jn-num', y: '0.5' }, g);
        numTxt.textContent = String(idx + 1);

        let below = false;
        if (prevSx !== null && Math.hypot(sx - prevSx, sy - prevSy) < 90) {
          below = !prevBelow;
        }
        prevSx = sx;
        prevSy = sy;
        prevBelow = below;

        const lblY = below ? '17.5' : '-11';
        const lblTxt = this._svgNode('text', { class: 'jn-label', x: '0', y: lblY }, g);
        const rawLbl = st.query || st.name;
        const isEn = this.locale === 'en';
        const baseLbl = isEn ? this.trTerm(rawLbl) : this._zh(rawLbl);
        const yrTag =
          st.year < 0 ? (isEn ? `${-st.year} BCE` : `前${-st.year}`) : `${st.year}`;
        lblTxt.textContent = isMultiYear && st.year !== undefined ? `${baseLbl} (${yrTag})` : baseLbl;
      });
      this._rescaleSvgTypography();
      return { minX, minY, maxX, maxY };
    }

    _renderCustomRoute(stops, explicitZoom) {
      if (!this.grpJourney || !Array.isArray(stops) || stops.length < 2) return;
      if (this.challenge) this.stopChallenge(true);
      if (this.mobileChronicleOpen && this._isMobileViewport()) {
        this.toggleMobileChronicle(false);
      }
      this.closeMilestoneBalloon();
      if (this.activeCustomRoute !== stops) {
        this.closeGenealogyCard();
        this.customRouteStopIdx = -1;
      }
      this.activeCustomRoute = stops;
      if (this.svg && typeof this.svg.querySelectorAll === 'function') {
        this.svg.querySelectorAll('.cap-breath-ring, .cap-hint-tag').forEach((el) => el.remove());
      }

      const bounds = this._drawCustomRouteOverlay(stops);
      if (!bounds) return;
      const { minX, minY, maxX, maxY } = bounds;

      this._renderCustomRouteCard();
      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5;
      const aspect = this._getViewportAspect();
      const isDesktop = typeof window === 'undefined' || window.innerWidth > 900;
      const hasZoom =
        explicitZoom !== undefined &&
        explicitZoom !== null &&
        explicitZoom !== '' &&
        !Number.isNaN(Number(explicitZoom));
      if (!isDesktop) {
        const visTopFrac = this._getCustomRouteVisibleTopFrac();
        const topPadFrac = 0.06;
        const botPadFrac = 0.05;
        const availFrac = Math.max(0.32, visTopFrac - topPadFrac - botPadFrac);
        const midFrac = topPadFrac + availFrac * 0.5;
        const effAspect = Math.max(0.36, aspect * availFrac);
        const spanW = Math.max(maxX - minX + 140, (maxY - minY + 96) / effAspect) * 1.14;
        const w = hasZoom
          ? 1000 / Math.max(1, Math.min(8, Number(explicitZoom)))
          : Math.max(260, Math.min(1380, spanW));
        const h = w * aspect;
        this.camera = {
          x: cx - w * 0.5,
          y: cy - h * midFrac,
          w,
          h,
          zoom: 1000 / w,
        };
        this._applyCamera(true);
        return;
      }
      const spanW = Math.max(maxX - minX + 140, (maxY - minY + 130) / aspect) * 1.25;
      const w = hasZoom
        ? 1000 / Math.max(1, Math.min(8, Number(explicitZoom)))
        : Math.max(260, Math.min(920, spanW));
      const h = w * aspect;
      const offsetY = h * 0.05;
      this.camera = {
        x: Math.max(-140, Math.min(1000 - w + 140, cx - w * 0.5)),
        y: Math.max(-100, Math.min(700 - h + 120, cy - h * 0.5 + offsetY)),
        w,
        h,
        zoom: 1000 / w,
      };
      this._applyCamera(true);
    }

    inspect({ year, place, lng, lat, zoom, person, stop } = {}) {
      const isEn = this.locale === 'en';
      const personProfile = person ? this._resolvePersonProfile(person) : null;
      const personEvents = personProfile ? this._collectPersonEvents(personProfile) : [];
      const stopIdx =
        stop !== undefined && stop !== null && stop !== '' && !Number.isNaN(Number(stop))
          ? Number(stop)
          : -1;
      const activePersonEv =
        personEvents.length > 0
          ? personEvents[stopIdx >= 0 && stopIdx < personEvents.length ? stopIdx : 0]
          : null;
      const personPayload =
        personProfile && personEvents.length > 0
          ? {
              key: personProfile.key,
              zh: this._zh(personProfile.zh),
              en: personProfile.en,
              courtesyZh: this._zh(personProfile.courtesyZh || ''),
              courtesyEn: personProfile.courtesyEn || '',
              span: personProfile.span,
              stop: stopIdx,
              totalEvents: personEvents.length,
              events: personEvents.map((ev, i) => ({
                index: i,
                year: ev.year,
                dynasty: isEn ? this.dynastyName(ev.dynasty) : this._zh(ev.dynasty.title),
                site: isEn ? ev.siteEn || this.trTerm(ev.siteZh) : this._zh(ev.siteZh),
                modern: isEn
                  ? ev.modernEn || this.trModernCity(ev.modernZh || '')
                  : this._zh(ev.modernZh || ''),
                coord: ev.coord,
                text: isEn ? ev.textEn : this._zh(ev.textZh),
                ...(ev.quoteZh || ev.quoteEn
                  ? { quote: isEn ? ev.quoteEn || ev.quoteZh : this._zh(ev.quoteZh || ev.quoteEn) }
                  : {}),
              })),
            }
          : null;

      const yearList = this._parseYearList(year);
      const yr = yearList.length
        ? yearList[0]
        : activePersonEv
          ? this._clampYearToDynasty(activePersonEv.dynasty, activePersonEv.year)
          : this.year;
      const dIdx = this._findDynastyIndex(yr);
      const d = this.dynasties[dIdx] || this.dynasties[0];
      const snapKey = this._resolveSnapKey(d, yr);
      const snap = this.snapshots[snapKey] || { polities: [], regions: [], prefectures: [] };

      const placeTokens = this._parsePlaceTokens(place, year);
      if (placeTokens.length >= 2) {
        const route = [];
        let totalKm = 0;
        for (let i = 0; i < placeTokens.length; i++) {
          const tok = placeTokens[i];
          const r = this.resolvePlace(tok.place, tok.year);
          if (!r) continue;
          const sdIdx = this._findDynastyIndex(tok.year);
          const sd = this.dynasties[sdIdx] || d;
          const sSnapKey = this._resolveSnapKey(sd, tok.year);
          const sSnap = this.snapshots[sSnapKey] || snap;
          const info = this._inspectCoord(r.lng, r.lat, sd, sSnap);
          const prev = route.length ? route[route.length - 1] : null;
          const segKm = prev
            ? Math.round(this.projector.greatCircleKm(prev.coord, [r.lng, r.lat]))
            : 0;
          totalKm += segKm;
          const cleanPlace = /[<>]/.test(String(tok.place || '')) ? r.name : tok.place;
          route.push({
            step: route.length + 1,
            year: tok.year,
            era: this.formatEraLabel(tok.year, sd, [r.lng, r.lat]),
            dynasty: isEn ? this.dynastyName(sd) : this._zh(sd.title),
            place: cleanPlace,
            resolvedName: isEn ? this.trTerm(r.name) : this._zh(r.name),
            modern: isEn ? this.trModernCity(r.modern || '') : this._zh(r.modern || ''),
            coord: [Number(r.lng.toFixed(4)), Number(r.lat.toFixed(4))],
            distanceFromPrevKm: segKm,
            ...info,
          });
        }
        if (route.length >= 2) {
          const first = route[0];
          const isMultiYear = new Set(route.map((s) => s.year)).size > 1;
          const params = new URLSearchParams();
          params.set('year', isMultiYear ? route.map((s) => s.year).join(',') : String(first.year));
          params.set('place', route.map((s) => s.place).join(','));
          if (isEn) params.set('lang', 'en');
          else if (this.locale === 'zh-tw') params.set('lang', 'zh-tw');
          const basePath =
            typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '';
          return {
            year: first.year,
            years: route.map((s) => s.year),
            era: this.formatEraLabel(first.year, d, first.coord),
            dynasty: {
              key: d.key,
              title: isEn ? this.dynastyName(d) : this._zh(d.title),
              seat: isEn ? this.dynastySeat(d) : this._zh(d.seat),
              span: [d.fromYear, d.toYear],
            },
            place: route.map((s) => s.place).join(','),
            coord: first.coord,
            zoom: Number(this.camera.zoom.toFixed(2)),
            polity: first.polity,
            regions: first.regions,
            prefectures: first.prefectures,
            modernProvince: first.modernProvince,
            nearestCity: first.nearestCity,
            lore: first.lore,
            route,
            routeDistanceKm: totalKm,
            url: `${basePath}?${params.toString()}`,
          };
        }
      }

      const singlePlace = placeTokens.length === 1 ? placeTokens[0].place : place;
      const singleYear = placeTokens.length === 1 ? placeTokens[0].year : yr;
      const hasExplicitCoord =
        lng !== undefined &&
        lat !== undefined &&
        lng !== '' &&
        lat !== '' &&
        !Number.isNaN(Number(lng)) &&
        !Number.isNaN(Number(lat));
      const resolved = !hasExplicitCoord && singlePlace ? this.resolvePlace(singlePlace, singleYear) : null;
      const cLng = hasExplicitCoord
        ? Number(lng)
        : resolved
          ? resolved.lng
          : activePersonEv && activePersonEv.coord
            ? activePersonEv.coord[0]
            : null;
      const cLat = hasExplicitCoord
        ? Number(lat)
        : resolved
          ? resolved.lat
          : activePersonEv && activePersonEv.coord
            ? activePersonEv.coord[1]
            : null;
      const hasCoord = cLng !== null && cLat !== null;

      const info = hasCoord
        ? this._inspectCoord(cLng, cLat, d, snap)
        : {
            polity: null,
            regions: [],
            prefectures: [],
            modernProvince: null,
            nearestCity: null,
            lore: null,
          };

      const targetZoom = Math.max(
        1,
        Math.min(8, Number(zoom) || (resolved && resolved.zoom) || (hasCoord ? 2.5 : this.camera.zoom))
      );
      const rawPlaceStr = singlePlace ? String(singlePlace).trim() : '';
      const placeLabel =
        rawPlaceStr && !/[<>]/.test(rawPlaceStr)
          ? rawPlaceStr
          : resolved
            ? resolved.name
            : rawPlaceStr.replace(/[<>]/g, '').trim();
      const params = new URLSearchParams();
      if (year !== undefined && year !== null && year !== '') {
        params.set('year', String(singleYear));
      } else if (!personPayload) {
        params.set('year', String(singleYear));
      }
      if (personPayload) {
        params.set('person', personPayload.key);
        if (stopIdx >= 0) params.set('stop', String(stopIdx));
      }
      if (placeLabel) params.set('place', placeLabel);
      if (hasExplicitCoord) {
        params.set('lng', Number(cLng).toFixed(2));
        params.set('lat', Number(cLat).toFixed(2));
      }
      if (zoom !== undefined) {
        params.set('zoom', Number(targetZoom.toFixed(2)));
      }
      if (isEn) params.set('lang', 'en');
      else if (this.locale === 'zh-tw') params.set('lang', 'zh-tw');
      const basePath =
        typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '';

      return {
        year: singleYear,
        era: this.formatEraLabel(singleYear, d, hasCoord ? [cLng, cLat] : null),
        dynasty: {
          key: d.key,
          title: isEn ? this.dynastyName(d) : this._zh(d.title),
          seat: isEn ? this.dynastySeat(d) : this._zh(d.seat),
          span: [d.fromYear, d.toYear],
        },
        place: placeLabel || null,
        resolvedName: resolved
          ? isEn
            ? this.trTerm(resolved.name)
            : this._zh(resolved.name)
          : activePersonEv
            ? isEn
              ? activePersonEv.siteEn || this.trTerm(activePersonEv.siteZh)
              : this._zh(activePersonEv.siteZh)
            : null,
        modern: resolved
          ? isEn
            ? this.trModernCity(resolved.modern || '')
            : this._zh(resolved.modern || '')
          : activePersonEv
            ? isEn
              ? activePersonEv.modernEn || this.trModernCity(activePersonEv.modernZh || '')
              : this._zh(activePersonEv.modernZh || '')
            : null,
        coord: hasCoord ? [Number(cLng.toFixed(4)), Number(cLat.toFixed(4))] : null,
        zoom: Number(targetZoom.toFixed(2)),
        ...info,
        ...(personPayload ? { person: personPayload } : {}),
        url: `${basePath}?${params.toString()}`,
      };
    }

    locate(opts = {}) {
      const { year, place, lng, lat, zoom } = opts || {};
      const hasEnDict = Boolean(
        this.enLocale && this.enLocale.dict && Object.keys(this.enLocale.dict).length > 0
      );
      const needsEnDict =
        !hasEnDict && (this.locale === 'en' || (place && /[a-z]/i.test(String(place))));
      if (!this._fullSnapshotsLoaded || needsEnDict) {
        Promise.all([
          this._fullSnapshotsLoaded ? Promise.resolve() : this._ensureFullSnapshots(),
          needsEnDict ? this._ensureEnglishLocale() : Promise.resolve(),
        ]).then(() => {
          this.locate(opts);
        });
      }
      this.stopAutoplay();
      const placeTokens = this._parsePlaceTokens(place, year);
      const yearList = this._parseYearList(year);
      const initialYear = placeTokens.length
        ? placeTokens[0].year
        : yearList.length
          ? yearList[0]
          : undefined;
      if (initialYear !== undefined) {
        this.jumpToYear(initialYear);
      }

      if (placeTokens.length >= 2) {
        const stops = placeTokens
          .map((tok) => {
            const r = this.resolvePlace(tok.place, tok.year);
            if (!r) return null;
            const cleanQuery = /[<>]/.test(String(tok.place || '')) ? r.name : tok.place;
            return { query: cleanQuery, year: tok.year, ...r };
          })
          .filter(Boolean);
        if (stops.length >= 2) {
          this._renderCustomRoute(stops, zoom);
          return this.inspect({ year, place, zoom });
        }
      }

      if (this.activeCustomRoute) {
        this.clearCustomRoute();
      }

      const singlePlace = placeTokens.length === 1 ? placeTokens[0].place : place;
      const hasExplicitCoord =
        lng !== undefined &&
        lat !== undefined &&
        lng !== '' &&
        lat !== '' &&
        !Number.isNaN(Number(lng)) &&
        !Number.isNaN(Number(lat));
      const resolved = !hasExplicitCoord && singlePlace ? this.resolvePlace(singlePlace, this.year) : null;
      const targetLng = hasExplicitCoord ? Number(lng) : resolved ? resolved.lng : null;
      const targetLat = hasExplicitCoord ? Number(lat) : resolved ? resolved.lat : null;

      if (targetLng !== null && targetLat !== null) {
        const z = Math.max(
          1,
          Math.min(8, Number(zoom) || (resolved && resolved.zoom) || 2.5)
        );
        const w = 1000 / z;
        const h = w * this._getViewportAspect();
        const [tx, ty] = this.projector.toScreen(targetLng, targetLat);
        const isDesktop = typeof window === 'undefined' || window.innerWidth > 900;
        const xFrac = isDesktop ? 0.36 : 0.5;
        const yFrac = isDesktop ? 0.48 : 0.21;
        this.camera = { x: tx - w * xFrac, y: ty - h * yFrac, w, h, zoom: z };
        this._applyCamera();
        this.closeMilestoneBalloon();
        const rawTrim = singlePlace
          ? String(singlePlace).replace(/[<>]/g, '').trim()
          : '';
        const useResolvedZh =
          this.locale !== 'en' &&
          resolved &&
          resolved.name &&
          (rawTrim !== String(singlePlace || '').trim() ||
            (/^[a-z0-9'’‘`\-_.\s()]+$/i.test(rawTrim) &&
              (resolved.kind !== 'gazetteer' ||
                String(this._enDict(resolved.name) || '')
                  .toLowerCase()
                  .replace(/['’‘`\-_.\s]+/g, '') ===
                  rawTrim.toLowerCase().replace(/['’‘`\-_.\s]+/g, ''))));
        const pinLabel = useResolvedZh
          ? resolved.name
          : rawTrim || (resolved ? resolved.name : '');
        this.openGenealogyAt(targetLng, targetLat, pinLabel);
      } else if (zoom !== undefined && zoom !== null && zoom !== '' && !Number.isNaN(Number(zoom))) {
        const z = Math.max(1, Math.min(8, Number(zoom)));
        const w = 1000 / z;
        const h = 700 / z;
        this.camera = { ...this.camera, w, h, zoom: z };
        this._applyCamera();
      }

      return this.inspect({
        year: this.year,
        place: singlePlace,
        lng: targetLng !== null ? targetLng : undefined,
        lat: targetLat !== null ? targetLat : undefined,
        zoom,
      });
    }

    _restoreFromQuery() {
      const q = new URLSearchParams(location.search);
      const needsEn =
        this.locale === 'en' ||
        /[a-z]/i.test(
          `${q.get('place') || ''} ${q.get('hover') || ''} ${q.get('q') || ''} ${q.get('person') || ''} ${q.get('journey') || ''}`
        );
      const afterFullSnapshots = (fn, delayMs = 80) => {
        const run = () => setTimeout(fn, delayMs);
        const tasks = [];
        if (!this._fullSnapshotsLoaded && typeof window !== 'undefined') {
          tasks.push(this._ensureFullSnapshots());
        }
        if (
          needsEn &&
          typeof window !== 'undefined' &&
          (!this.enLocale || !this.enLocale.dict || !Object.keys(this.enLocale.dict).length)
        ) {
          tasks.push(this._ensureEnglishLocale());
        }
        if (!tasks.length) {
          run();
        } else {
          Promise.all(tasks).then(run);
        }
      };
      if (q.has('q')) {
        const rawQ = (q.get('q') || '').trim();
        if (rawQ) {
          const inp = this._id('inp-map-search');
          if (inp) inp.value = rawQ;
          afterFullSnapshots(() => {
            const hits = this._queryQuickSearch(rawQ);
            if (hits && hits.length) this._selectSearchResult(hits[0]);
          }, 80);
        }
      }
      if (q.has('terrain')) {
        const tv = q.get('terrain');
        this.toggleTerrainMode(tv !== '0' && tv !== 'false');
      }
      if (q.has('place') || (q.has('lng') && q.has('lat'))) {
        this.locate({
          year: q.has('year') ? q.get('year') : undefined,
          place: q.get('place') || '',
          lng: q.has('lng') ? Number(q.get('lng')) : undefined,
          lat: q.has('lat') ? Number(q.get('lat')) : undefined,
          zoom: q.has('zoom') ? Number(q.get('zoom')) : undefined,
        });
      } else {
        if (q.has('year')) {
          const yList = this._parseYearList(q.get('year'));
          if (yList.length) this.jumpToYear(yList[0]);
        }
        if (q.has('zoom') || q.has('center')) {
          const z = Math.max(1, Math.min(8, Number(q.get('zoom')) || this.camera.zoom));
          const w = 1000 / z;
          const h = 700 / z;
          let x = this.camera.x;
          let y = this.camera.y;
          if (q.has('center')) {
            const [lng, lat] = q.get('center').split(',').map(Number);
            if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
              const [tx, ty] = this.projector.toScreen(lng, lat);
              x = tx - w * 0.5;
              y = ty - h * 0.5;
            }
          }
          this.camera = { x, y, w, h, zoom: z };
          this._applyCamera();
        }
      }
      if (
        q.has('year') ||
        q.has('place') ||
        (q.has('lng') && q.has('lat')) ||
        q.has('person') ||
        q.has('journey')
      ) {
        afterFullSnapshots(() => {
          if (typeof document === 'undefined' || !document.body || !document.createElement) return;
          let node = this._id('atlas-inspect-json');
          if (!node) {
            node = document.createElement('script');
            node.id = 'atlas-inspect-json';
            node.type = 'application/json';
            document.body.appendChild(node);
          }
          node.textContent = JSON.stringify(
            this.inspect({
              year: q.has('year') ? q.get('year') : undefined,
              place: q.get('place') || '',
              lng: q.has('lng') ? Number(q.get('lng')) : undefined,
              lat: q.has('lat') ? Number(q.get('lat')) : undefined,
              zoom: q.has('zoom') ? Number(q.get('zoom')) : undefined,
              person: q.get('person') || q.get('journey') || undefined,
              stop: q.has('stop') ? Number(q.get('stop')) : undefined,
            })
          );
        }, 40);
      }
      if (q.has('hover')) {
        const targetPref = q.get('hover');
        this.closeMilestoneBalloon();
        afterFullSnapshots(() => {
          this.closeMilestoneBalloon();
          let el = this.grpPrefectures.querySelector(
            `.prefecture-shape[data-pref-title="${CSS.escape(targetPref)}"]`
          );
          if (!el && targetPref) {
            const fold = (s) =>
              String(s || '')
                .toLowerCase()
                .replace(/\s+(?:prefecture|commandery|circuit|province|fu|zhou|jun)$/i, '')
                .replace(/['’‘`\-_.\s]+/g, '');
            const qFold = fold(targetPref);
            const shapes = Array.from(this.grpPrefectures.querySelectorAll('.prefecture-shape'));
            el =
              shapes.find((node) => {
                const zh = node.dataset && node.dataset.prefTitle;
                if (!zh) return false;
                const en = this._enDict(zh);
                return (
                  en.toLowerCase() === targetPref.trim().toLowerCase() ||
                  (qFold.length >= 2 && fold(en) === qFold) ||
                  zh.replace(/(?:州|府|郡|道|路)$/, '') ===
                    targetPref.trim().replace(/(?:州|府|郡|道|路)$/, '')
                );
              }) || null;
          }
          if (el) {
            el.classList.add('is-hovered');
            const box = el.getBoundingClientRect();
            const cx = box.left + box.width * 0.55;
            const cy = box.top + box.height * 0.45;
            const cur = this.dynasties[this.dynastyIdx];
            const snapKey = this._resolveSnapKey(cur, this.year);
            const snap = this.snapshots[snapKey] || {};
            const mainPol = (snap.polities || []).find((p) => p.role === 'main') || (snap.polities || [])[0];
            let provName = '';
            const stack = document.elementsFromPoint(cx, cy);
            const polEl = stack.find(
              (node) => node.dataset && node.dataset.polityTitle && node.dataset.polityRole !== 'neighbor'
            );
            const resolvedPolTitle = (polEl && polEl.dataset.polityTitle) || (mainPol && mainPol.title) || '';
            const provEl = stack.find((node) => node.dataset && node.dataset.provTitle);
            if (provEl) provName = provEl.dataset.provTitle;
            const pName = this.trTerm(el.dataset.prefTitle);
            const pCat = el.dataset.prefCategory;
            const pEmigre = pCat === '侨州' || pCat === '侨郡';
            const lines = [
              `<b>${
                this.locale === 'en'
                  ? pName + (pEmigre ? ' (Emigre)' : '')
                  : pName + (pCat && !pName.endsWith(pCat) ? '（' + pCat + '）' : '')
              }</b>`,
            ];
            if (resolvedPolTitle) {
              lines.push(
                `<div class="tt-sub">${this.uiStr('belongs_to', '属 ')}${this.trTerm(resolvedPolTitle)}</div>`
              );
            }
            if (provName) {
              lines.push(
                `<div class="tt-sub">${this.uiStr('now_prov', '今：')}${this.trTerm(provName)}</div>`
              );
            }
            this._showHoverTip({ clientX: cx, clientY: cy }, lines.join(''));
          }
        }, 120);
      }
      if (q.has('quiz')) {
        this._paneAutoCollapsed = true;
        this.toggleChroniclePane(true);
        setTimeout(() => this.startChallenge({ preferCurrentDynasty: q.has('year') }), 120);
      }
      if (q.has('person')) {
        const rawP = (q.get('person') || '').trim();
        const evIdx = q.has('stop') ? Number(q.get('stop')) : -1;
        if (rawP) {
          afterFullSnapshots(() => {
            this.openPersonChronicle(rawP, Number.isNaN(evIdx) ? -1 : evIdx);
          }, 80);
        }
      }
      if (q.has('journey')) {
        const jKey = (q.get('journey') || '').trim();
        const stopIdx = q.has('stop') ? Number(q.get('stop')) : -1;
        if (jKey) {
          afterFullSnapshots(() => {
            this.openJourneyAsPerson(jKey, Number.isNaN(stopIdx) ? -1 : stopIdx);
          }, 80);
        }
      }
      if (q.has('layers')) {
        setTimeout(() => {
          const btn = this._id('act-layers-menu');
          if (btn) btn.click();
        }, 120);
      }
      if (q.has('mob_chron')) {
        setTimeout(() => this.toggleMobileChronicle(true), 120);
      }
      if (q.has('mob_leg')) {
        setTimeout(() => {
          const btn = this.mapKey && this.mapKey.querySelector('.key-mobile-toggle');
          if (btn) btn.click();
        }, 120);
      }
    }
  }

  window.MercatorProjector = MercatorProjector;
  window.HistoricalAtlasController = HistoricalAtlasController;
  window.addEventListener('DOMContentLoaded', () => {
    const app = new HistoricalAtlasController();
    window.atlasApp = app;
    window.atlasAPI = {
      locate: (opts) => app.locate(opts),
      resolvePlace: (place, year) => app.resolvePlace(place, year),
      inspect: (opts) => app.inspect(opts),
      openPerson: (who, idx = -1) => app.openPersonChronicle(who, idx),
    };
  });
})();
