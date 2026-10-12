/**
 * Historical Atlas Controller (ES6 Class Architecture)
 */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const RAD_TO_DEG = 180 / Math.PI;
  const DEG_TO_RAD = Math.PI / 180;

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

    multiRingsToSvgPath(polygons) {
      return polygons.map((poly) => poly.map((r) => this.ringToSvgPath(r)).join('')).join('');
    }

    shapeToSvgPath(shapeObj, smooth = true) {
      if (!shapeObj) return '';
      const cacheKey = smooth ? '_svgPathSmooth' : '_svgPath';
      if (shapeObj[cacheKey] !== undefined) return shapeObj[cacheKey];
      const fn = (r) => (smooth ? this.smoothRingToSvgPath(r) : this.ringToSvgPath(r));
      let d = '';
      if (shapeObj.type === 'Polygon') {
        d = shapeObj.coordinates.map(fn).join('');
      } else if (shapeObj.type === 'MultiPolygon') {
        d = shapeObj.coordinates.map((poly) => poly.map(fn).join('')).join('');
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

      this.locale =
        new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh';
      this.year = this.dynasties[0].focusYear;
      this.dynastyIdx = 0;
      this.activeSnapKey = null;
      this.activeSettlementMask = null;
      this.activeCorridorMask = null;
      this.lastRenderedSnap = null;
      this.playing = false;
      this.playInterval = null;
      this.musicPlaying = false;
      this.musicTrackIdx = 0;
      this.musicAudio = null;
      this.synthCtx = null;
      this.synthTimer = null;
      this.genealogyMode = false;
      this.terrainMode = true;
      this.hydroData = window.HYDRO_DATA || { rivers: [], lakes: [] };
      this.activeTrace = null;
      this.activeMilestone = null;
      this.activeJourney = null;
      this.journeyStopIdx = 0;
      this.journeyTimer = null;
      this.challenge = null;
      this.challengeVariant = 'locate';
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
      this.showEventCallouts = this._loadEventCalloutsPref();
      this.dismissedCalloutIds = new Set();
      try {
        this.hasSeenTraceHint = localStorage.getItem('jiangshan_seen_trace_hint') === '1';
        this.hasSeenJourneyHint = localStorage.getItem('jiangshan_seen_journey_hint') === '1';
      } catch (_) {
        this.hasSeenTraceHint = false;
        this.hasSeenJourneyHint = false;
      }

      this.camera = this._getDefaultCamera();
      this.flyRaf = null;
      this.dragState = null;
      this.didPan = false;
      this.snapshotCache = {};

      this._bindDom();
      if (this.hasSeenJourneyHint) {
        const dot = this._id('journey-onboarding-dot');
        if (dot) dot.classList.add('is-hidden');
      }
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

    _loadEventCalloutsPref() {
      try {
        const v = localStorage.getItem('jiangshan_event_callouts');
        if (v === '0' || v === 'false') return false;
      } catch (_) {}
      return true;
    }

    _saveEventCalloutsPref(enabled) {
      try {
        localStorage.setItem('jiangshan_event_callouts', enabled ? '1' : '0');
      } catch (_) {}
    }

    toggleEventCallouts(enabled) {
      this.showEventCallouts = Boolean(enabled);
      this._saveEventCalloutsPref(this.showEventCallouts);
      const chk = this._id('chk-event-callouts');
      if (chk && chk.checked !== this.showEventCallouts) {
        chk.checked = this.showEventCallouts;
      }
      if (!this.showEventCallouts) {
        this.closeMilestoneBalloon();
      } else {
        if (this.dismissedCalloutIds) this.dismissedCalloutIds.clear();
        const cur = this.dynasties[this.dynastyIdx];
        if (cur) this._syncAutoMilestoneBalloon(cur);
      }
    }

    _hydrateSnapshots() {
      if (!this.snapshots) return;
      for (const k of Object.keys(this.snapshots)) {
        const s = this.snapshots[k];
        if (s && s.prefRef && !s.prefectures && this.snapshots[s.prefRef]) {
          s.prefectures = this.snapshots[s.prefRef].prefectures || [];
        }
        if (s && s.regionRef && !s.regions && this.snapshots[s.regionRef]) {
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
        this._fullSnapshotsPromise = this._loadScriptOnce('js/atlas_snapshots.js?v=20261012g').then(
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
        this._enLocalePromise = this._loadScriptOnce('js/i18n_dict.js?v=20261012g').then(() => {
          if (window.EN_LOCALE) {
            this.enLocale = window.EN_LOCALE;
            this.searchIndex = null;
          }
          return this.enLocale;
        });
      }
      return this._enLocalePromise;
    }

    _syncImmersivePaneState() {
      const immersiveActive = Boolean(this.activeJourney || this.challenge);
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

    _dismissJourneyOnboarding() {
      if (this.hasSeenJourneyHint) return;
      this.hasSeenJourneyHint = true;
      try {
        localStorage.setItem('jiangshan_seen_journey_hint', '1');
      } catch (_) {}
      const dot = this._id('journey-onboarding-dot');
      if (dot) dot.classList.add('is-hidden');
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
    uiStr(key, fallback) {
      if (this.locale === 'en' && this.enLocale.strings && this.enLocale.strings[key] !== undefined) {
        return this.enLocale.strings[key];
      }
      return fallback;
    }

    trTerm(text) {
      if (!text || this.locale !== 'en') return text;
      return (this.enLocale.dict && this.enLocale.dict[text]) || text;
    }

    trModernCity(text) {
      const res = this.trTerm(text);
      return typeof res === 'string' ? res.replace(/\b([A-Z][a-z]+)\s+Zhou\b/g, '$1zhou') : res;
    }

    _enDict(text) {
      if (!text) return '';
      return (this.enLocale.dict && this.enLocale.dict[text]) || text;
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
        : d.title;
    }

    dynastyBadge(d) {
      return this.locale === 'en' && this.enLocale.dynasties[d.key]
        ? this.enLocale.dynasties[d.key].short
        : d.badge || d.title;
    }

    dynastySeat(d) {
      return this.locale === 'en' && this.enLocale.dynasties[d.key]
        ? this.enLocale.dynasties[d.key].capital
        : d.seat;
    }

    dynastySummary(d) {
      return this.locale === 'en' && this.enLocale.dynasties[d.key]
        ? this.enLocale.dynasties[d.key].desc
        : d.summary;
    }

    milestoneHeadline(d, m) {
      if (this.locale === 'en') {
        return this._enMilestoneHeadline(d, m);
      }
      return m.headline;
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
      return c.title;
    }

    corridorSummary(c) {
      if (this.locale === 'en' && this.enLocale.corridors && this.enLocale.corridors[c.key]) {
        const hit = this.enLocale.corridors[c.key];
        return (Array.isArray(hit) ? hit[1] : hit.note) || '';
      }
      return c.summary;
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
      return `${this.formatYear(d.fromYear, true)} — ${this.formatYear(d.toYear, true)}`;
    }

    static get CHINESE_ERA_SPANS() {
      return (window.ATLAS_LORE_DATA && window.ATLAS_LORE_DATA.CHINESE_ERA_SPANS) || [[-403, '周威烈王', 23]];
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

    formatEraLabel(y, dynasty) {
      if (this.locale === 'en') {
        return dynasty ? this.dynastyName(dynasty) : '';
      }
      const yr = Math.round(y);
      if (yr >= 1949) {
        if (dynasty && dynasty.key === 'roc' && yr === 1949) {
          return '民国三十八年';
        }
        return dynasty ? this.dynastyName(dynasty) : '现代';
      }
      if (dynasty && dynasty.key === 'yuan' && yr >= 1264 && yr < 1279) {
        return `元至元${this._toChineseEraNum(yr - 1264 + 1)}年`;
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
      const [startY, prefix, baseNum = 1] = match;
      const num = yr - startY + baseNum;
      return `${prefix}${this._toChineseEraNum(num)}年`;
    }

    applyLocale() {
      if (
        this.locale === 'en' &&
        (!this.enLocale || !this.enLocale.dict || !Object.keys(this.enLocale.dict).length)
      ) {
        this._ensureEnglishLocale().then(() => this.applyLocale());
        return;
      }
      document.documentElement.lang = this.locale === 'en' ? 'en' : 'zh-CN';
      this._syncDocumentSeoMeta();

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
      const lblJourneyBtn = this._id('lbl-journey-btn');
      if (lblJourneyBtn) {
        lblJourneyBtn.textContent = this.locale === 'en' ? 'Journeys' : '青史行迹';
      }
      const actJourneyBtn = this._id('act-journey-menu');
      if (actJourneyBtn) {
        actJourneyBtn.title =
          this.locale === 'en'
            ? 'Historical Journeys · Qin Shi Huang / Zhang Qian / Zhuge Liang / Xuanzang / Li Bai / Su Shi / Wang Yangming'
            : '青史行迹 · 人物时空巡礼（秦始皇 / 张骞 / 诸葛亮 / 玄奘 / 李白 / 苏轼 / 王阳明）';
      }
      const jPopHead = this._id('txt-journey-pop-heading');
      if (jPopHead) {
        jPopHead.textContent =
          this.locale === 'en' ? 'Historical Journeys · Interactive Tours' : '青史行迹 · 人物时空巡礼';
      }
      const jPopSub = this._id('txt-journey-pop-sub');
      if (jPopSub) {
        jPopSub.textContent =
          this.locale === 'en'
            ? 'Follow iconic figures across eras, prefectures & classical verse'
            : '跟随历史人物足迹，跨越年代、州郡与诗词纪事';
      }
      const setTxt = (id, zh, en) => {
        const el = this._id(id);
        if (el) el.textContent = this.locale === 'en' ? en : zh;
      };
      setTxt('lbl-jm-badge-qinshihuang', '战国·秦', 'Qin');
      setTxt('lbl-jm-title-qinshihuang', '秦始皇一统六国行迹', "Qin Shi Huang's Unification Campaigns");
      setTxt(
        'lbl-jm-meta-qinshihuang',
        '咸阳 → 灭韩 → 灭赵 → 灭魏 → 灭楚 → 灭燕 → 灭齐 · 9站',
        'Xianyang → Han → Zhao → Wei → Chu → Yan → Qi · 9 stops'
      );
      setTxt('lbl-jm-badge-sushi', '北宋', 'N. Song');
      setTxt('lbl-jm-title-sushi', '苏轼宦海贬谪行迹', "Su Shi's Literary Exile Across Song China");
      setTxt(
        'lbl-jm-meta-sushi',
        '眉州 → 汴京 → 黄州 → 惠州 → 儋州 · 10站',
        'Meizhou → Kaifeng → Huangzhou → Danzhou · 10 stops'
      );
      setTxt('lbl-jm-badge-wangyangming', '明', 'Ming');
      setTxt(
        'lbl-jm-title-wangyangming',
        '王阳明知行悟道行迹',
        "Wang Yangming's Unity of Knowledge & Action"
      );
      setTxt(
        'lbl-jm-meta-wangyangming',
        '余姚 → 京师 → 龙场悟道 → 赣州 → 平宁王 → 绍兴 → 南安 · 10站',
        'Yuyao → Beijing → Longchang → Nanchang → Shaoxing · 10 stops'
      );
      setTxt('lbl-jm-badge-libai', '唐', 'Tang');
      setTxt('lbl-jm-title-libai', '李白仗剑壮游行迹', "Li Bai's Grand Travels Across Tang China");
      setTxt(
        'lbl-jm-meta-libai',
        '碎叶 → 蜀中 → 扬州 → 长安 → 白帝城 · 10站',
        "Suyab → Shu → Yangzhou → Chang'an → Baidicheng · 10 stops"
      );
      setTxt('lbl-jm-badge-xuanzang', '唐', 'Tang');
      setTxt('lbl-jm-title-xuanzang', '玄奘西行求法行迹', "Xuanzang's Pilgrimage to the Western Regions");
      setTxt(
        'lbl-jm-meta-xuanzang',
        '长安 → 敦煌 → 高昌 → 碎叶 → 天竺 · 10站',
        "Chang'an → Dunhuang → Suyab → India · 10 stops"
      );
      setTxt('lbl-jm-badge-zhugeliang', '三国', '3 Kingdoms');
      setTxt('lbl-jm-title-zhugeliang', '诸葛亮出山北伐行迹', "Zhuge Liang's Southern & Northern Campaigns");
      setTxt(
        'lbl-jm-meta-zhugeliang',
        '隆中 → 赤壁 → 成都 → 汉中 → 五丈原 · 10站',
        'Longzhong → Red Cliffs → Chengdu → Wuzhang Plains · 10 stops'
      );
      setTxt('lbl-jm-badge-zhangqian', '西汉', 'W. Han');
      setTxt('lbl-jm-title-zhangqian', '张骞凿空西域行迹', "Zhang Qian's Mission to the Western Regions");
      setTxt(
        'lbl-jm-meta-zhangqian',
        '长安 → 河西 → 大宛 → 大月氏 · 9站',
        "Chang'an → Hexi → Fergana → Bactria · 9 stops"
      );
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
      const lblEventCallouts = this._id('lbl-event-callouts');
      if (lblEventCallouts) {
        lblEventCallouts.textContent = this.uiStr('toggle_event_callouts', '史事浮签');
        if (lblEventCallouts.parentElement) {
          lblEventCallouts.parentElement.title = this.uiStr(
            'toggle_event_callouts_tip',
            '在地图事件坐标旁浮显当前节点史事小笺'
          );
        }
      }
      const lblReset = this._id('lbl-reset-camera') || this._id('act-reset-camera');
      lblReset.textContent = this.uiStr('btn_reset', '复位视图');
      const actReset = this._id('act-reset-camera');
      if (actReset) {
        actReset.title = this.locale === 'en' ? 'Reset camera view' : '复位视图';
      }
      const lblChal = this._id('lbl-challenge') || this._id('act-challenge');
      lblChal.textContent = this.challenge
        ? this.uiStr('btn_quiz_active', '挑战中…')
        : this.uiStr('btn_quiz', '开始挑战');
      const lblLoc = this._id('lbl-locale') || this._id('act-locale');
      lblLoc.textContent = this.locale === 'en' ? '中文' : 'EN';
      const ghBtn = this._id('act-github-star');
      if (ghBtn) {
        ghBtn.title =
          this.locale === 'en'
            ? 'Star DeanChensj/jiangshan-map on GitHub'
            : '在 GitHub 上为「江山时序」点亮 Star';
      }
      this._updateMusicUi();
      this._id('gesture-guide').textContent = this.uiStr(
        'hint',
        '滚轮缩放 · 拖拽平移 · 点击城名或双击地图查历代沿革 · ← → 调整年份 · 空格播放'
      );
      this._id('txt-seat-label').textContent = this.uiStr('capital_k', '都城');
      this._id('txt-milestones-heading').textContent = this.uiStr('events_h', '重大事件');
      this._id('txt-disclaimer').textContent = this.uiStr(
        'caveat',
        '疆域轮廓与州郡政区为示意性近似，用于直观对比各时期大致范围，非精确历史测绘边界。'
      );
      this._id('txt-year-suffix').textContent = this.uiStr('year_unit', '年');
      const stepPrevBtn = this._id('act-step-prev');
      if (stepPrevBtn) {
        stepPrevBtn.title =
          this.locale === 'en' ? 'Previous historical milestone' : '上一历史节点 / 事件';
      }
      const stepNextBtn = this._id('act-step-next');
      if (stepNextBtn) {
        stepNextBtn.title =
          this.locale === 'en' ? 'Next historical milestone' : '下一历史节点 / 事件';
      }
      this._id('txt-genealogy-kicker').textContent = this.uiStr(
        'trace_kicker',
        '点地溯源 · 古今政区沿革'
      );
      const chalKicker = this._id('txt-challenge-kicker');
      if (chalKicker) {
        chalKicker.textContent = this.locale === 'en' ? 'Map Pinpoint' : '舆图寻址';
      }
      const searchInp = this._id('inp-map-search');
      if (searchInp) {
        searchInp.placeholder =
          this.locale === 'en'
            ? 'Search city / prefecture / era / journey'
            : '搜古今地名 / 州府 / 年号 / 青史行迹';
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
            this.locale === 'en' ? node.dataset.en || '' : node.dataset.zh || '';
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
        this.openGenealogyAt(this.activeTrace[0], this.activeTrace[1]);
      }
      if (this.activeJourney) {
        this._renderJourneyOverlay();
        this._renderJourneyCard();
      }
      if (this.challenge) {
        this.grpSettlements.classList.add('is-hidden');
        if (!this.challenge.answered && this.challenge.index < this.challenge.deck.length) {
          this.presentChallengeRound();
        }
      }
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
        tNode.textContent = this.locale === 'en' ? lb.en || '' : lb.zh || '';
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
      const btn = this._id('act-terrain');
      if (btn) {
        btn.classList.toggle('is-active', this.terrainMode);
        btn.setAttribute('aria-pressed', String(this.terrainMode));
      }
      const chk = this._id('chk-terrain');
      if (chk) {
        chk.checked = this.terrainMode;
      }
    }

    _buildModernProvinces() {
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
        if (!isDash) {
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

    _renderDynasty(dynasty) {
      document.documentElement.style.setProperty('--dynasty-accent', dynasty.tint);
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

      for (const reg of snap.regions || []) {
        this._svgNode(
          'path',
          { d: this.projector.shapeToSvgPath(reg.shape), class: 'region-shape' },
          prefGroup
        );
        if (reg.anchor && reg.title) {
          const [baseX, baseY] = this.projector.toScreen(reg.anchor[0], reg.anchor[1]);
          const rLbl = this._svgNode(
            'text',
            {
              class: 'region-caption',
              'data-x': baseX.toFixed(1),
              'data-y': baseY.toFixed(1),
              'data-base-x': baseX.toFixed(1),
              'data-base-y': baseY.toFixed(1),
            },
            prefGroup
          );
          rLbl._regShape = reg.shape;
          rLbl.textContent = this.trTerm(reg.title);
        }
      }

      this.lastRenderedSnap = snap;
      this._renderLegendBox(snap);
      this._rescaleSvgTypography();
    }

    _settlementMask(dynasty, year) {
      const sMask = (dynasty.settlements || [])
        .map((item) =>
          (item.appear !== undefined && year < item.appear) ||
          (item.vanish !== undefined && year >= item.vanish)
            ? '0'
            : '1'
        )
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
          const rank = (s) => (s.isCapital ? 2 : s.tier === 2 ? 0 : 1);
          return rank(a) - rank(b);
        });

      const showOnboardingTraceHint =
        !this.hasSeenTraceHint && !this.activeJourney && !this.challenge;
      const hintCapital = showOnboardingTraceHint
        ? activeList.find(
            (s) => s.isCapital && dynasty.seat && dynasty.seat.includes(s.ancient.split(/[（(]/)[0])
          ) || activeList.find((s) => s.isCapital)
        : null;

      for (const item of activeList) {
        const [x, y] = this.projector.toScreen(item.coord[0], item.coord[1]);
        const isTier2 = item.tier === 2 && !item.isCapital;
        const isHintCap = item === hintCapital;
        const cls = item.isCapital
          ? isHintCap
            ? 'settlement-node is-capital has-trace-hint'
            : 'settlement-node is-capital'
          : isTier2
            ? 'settlement-node is-tier2'
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
        node.dataset.tier = item.isCapital ? '0' : isTier2 ? '2' : '1';

        if (item.isCapital) {
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
          try {
            localStorage.setItem('jiangshan_seen_trace_hint', '1');
          } catch (_) {}
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
            : '◆ 点按城池 · 阅两千年身世 ›';
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
          pNode.dataset.ancient = this.locale === 'en' ? p.ancientEn : p.ancientZh;
          pNode.dataset.modern = this.locale === 'en' ? p.modernEn : p.modernZh;
          pNode.dataset.remark = this.locale === 'en' ? p.rangeEn : p.rangeZh;
          pNode.dataset.chokepoint = this.locale === 'en' ? p.chokepointEn : p.chokepointZh;
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
          nameEl.textContent = this.locale === 'en' ? p.ancientEn : p.ancientZh;
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
        typeof window !== 'undefined' && window.innerWidth <= 900 ? 3.35 : 2.55;
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
      let activeIdx = -1;
      (dynasty.milestones || []).forEach((m, idx) => {
        if (this._clampYearToDynasty(dynasty, m.year) <= this.year) activeIdx = idx;
      });
      return activeIdx;
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
        this.showEventCallouts === false ||
        milestonesHidden ||
        this.playing ||
        this.challenge ||
        this.activeJourney ||
        mobileOverlayBusy
      ) {
        if (this.activeMilestone && this.activeMilestone.isAuto) {
          this.closeMilestoneBalloon();
        }
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
      };
      this.grpMilestones.querySelectorAll('.milestone-pin').forEach((n) => {
        n.classList.toggle('is-active', Number(n.dataset.idx) === mIdx);
      });
      this._highlightCurrentMilestone(dynasty);
      this._updateMilestoneStates(dynasty);
      if (!m.coord) {
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
      const jKey = this._journeyKeyForMilestone(dynasty, m);
      const jBtnHtml = jKey
        ? `<button type="button" class="ev-journey-btn" data-journey="${jKey}">${this.locale === 'en' ? 'View Route' : '展阅行迹'}</button>`
        : '';
      this.milestoneBalloon.innerHTML =
        `<div class="ep-head"><span class="ep-year">${yrText} · ${this.formatEraLabel(m.year, dynasty)}</span>${placeHtml}<button type="button" class="ep-close" title="${closeTitle}" aria-label="${closeTitle}">×</button></div>` +
        `<div class="ep-text">${this.milestoneHeadline(dynasty, m)}${jBtnHtml}</div>`;
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
      const jBtn = this.milestoneBalloon.querySelector('.ev-journey-btn');
      if (jBtn) {
        jBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.startJourney(jBtn.dataset.journey);
        });
      }
      this.milestoneBalloon.classList.remove('is-hidden', 'is-offscreen');
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.add('has-open-milestone-balloon');
      this._positionMilestoneBalloon();
    }

    _journeyKeyForMilestone(dynasty, m) {
      if (!dynasty || !m) return null;
      if (
        dynasty.key === 'zhanguo' &&
        [-238, -236, -230, -228, -227, -226, -225, -223, -222].includes(m.year)
      ) {
        return 'qinshihuang';
      }
      if (dynasty.key === 'qin' && m.year === -221) return 'qinshihuang';
      if (dynasty.key === 'xihan' && m.year === -138) return 'zhangqian';
      if (dynasty.key === 'donghan' && m.year === 208) return 'zhugeliang';
      if (dynasty.key === 'sanguo' && (m.year === 225 || m.year === 228 || m.year === 234)) {
        return 'zhugeliang';
      }
      if (dynasty.key === 'tang' && m.year === 629) return 'xuanzang';
      if (dynasty.key === 'beisong' && m.year === 1080) return 'sushi';
      if (dynasty.key === 'ming' && m.year === 1519) return 'wangyangming';
      return null;
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
      const curPaths = new Set(
        ((curSnap && curSnap.polities) || [])
          .filter((p) => p.role !== 'neighbor')
          .map((p) => `${p.title}:${this.projector.shapeToSvgPath(p.shape)}`)
      );

      const hasMain = refSnap.polities.some((p) => p.role === 'main');
      const candidates = refSnap.polities.filter((p) =>
        hasMain ? p.role === 'main' : p.role === 'rival'
      );

      let count = 0;
      for (const pol of candidates) {
        const dStr = this.projector.shapeToSvgPath(pol.shape);
        if (!dStr) continue;
        if (mode === 'fade' && curPaths.has(`${pol.title}:${dStr}`)) continue;
        this._svgNode(
          'path',
          {
            d: dStr,
            class: `polity-ghost-path ${mode === 'preview' ? 'is-preview' : 'is-fade'}`,
            stroke: pol.tint || '#b5452f',
          },
          this.grpGhostDiff
        );
        count++;
      }
      if (count > 0 && mode === 'fade') {
        this.ghostTimer = setTimeout(() => {
          if (this.grpGhostDiff) this.grpGhostDiff.innerHTML = '';
          this.ghostTimer = null;
        }, 1650);
      }
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
            if (e.pointerType !== 'touch' && this.grpGhostDiff) this.grpGhostDiff.innerHTML = '';
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
        sw.style.color = '#6e6256';
        sw.style.borderStyle = 'dashed';
        sw.style.background = 'rgba(138, 124, 107, 0.22)';
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
      this.mapKey.style.display = this.mapKey.firstChild ? 'flex' : 'none';
    }

    // ---------------- Chronicle Sidebar ----------------
    _syncDocumentSeoMeta() {
      if (typeof document === 'undefined') return;
      const baseSiteUrl = 'https://deanchensj.github.io/jiangshan-map/';
      const isEn = this.locale === 'en';
      const cur = this.dynasties && this.dynasties[this.dynastyIdx];
      let pageTitle = isEn
        ? this.uiStr('title', 'Jiangshan Atlas · Interactive Historical Atlas of China (403 BCE – Present)')
        : '江山时序 · 中国历史地图时间轴（战国至现代历代疆域、州郡政区与古今地名沿革）';
      let pageDesc = isEn
        ? 'Explore 2,400+ years of Chinese history from the Warring States (403 BCE) to the present across 18 eras, 146 territory snapshots, 470 ancient cities, 20 strategic passes, and 7 historical journeys.'
        : '交互式中国历史地图时间轴（公元前403年战国三家分晋至现代）：浏览18个朝代146幅历史疆域、州郡道省政区、黄河改道水系、470座古城古今地名对照（点地溯源）、20座天下名关与7条青史人物行迹。';
      let canonicalUrl = baseSiteUrl;

      if (this.activeJourney) {
        const j = this.activeJourney;
        const jTitle = isEn ? j.titleEn : j.titleZh;
        const jSpan = isEn ? j.spanEn : j.spanZh;
        pageTitle = isEn
          ? `${jTitle} (${jSpan}) · Jiangshan Historical Atlas of China`
          : `${jTitle}（${jSpan}）路线图 · 江山时序中国历史地图`;
        pageDesc = isEn
          ? `Interactive route map of ${jTitle} (${jSpan}) across ${j.stops.length} historical stops in the Jiangshan Atlas of China.`
          : `${jTitle}（${jSpan}）交互式历史行迹路线图，共 ${j.stops.length} 站古今地名、州郡疆域与诗词纪事对照。`;
        canonicalUrl = `${baseSiteUrl}?journey=${encodeURIComponent(j.key)}${isEn ? '&lang=en' : ''}`;
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
        const snapShift =
          m.year === dynasty.fromYear ||
          this._resolveSnapKey(dynasty, targetY) !== this._resolveSnapKey(dynasty, prevY);
        const cityShift =
          this._settlementMask(dynasty, targetY) !== this._settlementMask(dynasty, prevY);
        const corrShift = this.corridors.some((c) => c.span && c.span[0] === m.year);
        const hydroShift = this._hydroMask(targetY) !== this._hydroMask(prevY);
        const isMapChange = snapShift || cityShift || corrShift || hydroShift;
        const yrLabel =
          this.locale === 'en'
            ? this.formatYear(m.year)
            : `${m.year <= 0 ? '前' + -m.year : m.year} 年`;
        const badge = isMapChange
          ? `<span class="ev-map-tag" title="${this.locale === 'en' ? 'Map territory, city, or river course changes at this year' : '此节点触发版图、城池或河道水系变化'}">${SVG_ICONS.mapChange}</span>`
          : '';
        const jKey = this._journeyKeyForMilestone(dynasty, m);
        const jBtnHtml = jKey
          ? `<button type="button" class="ev-journey-btn" data-journey="${jKey}">${this.locale === 'en' ? 'View Route' : '展阅行迹'}</button>`
          : '';
        li.innerHTML = `<span class="ev-yr">${yrLabel}</span><span>${this.milestoneHeadline(dynasty, m)}${badge}${jBtnHtml}</span>`;
        const jBtn = li.querySelector('.ev-journey-btn');
        if (jBtn) {
          jBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 900 && this.mobileChronicleOpen) {
              this.toggleMobileChronicle(false);
            }
            this.startJourney(jBtn.dataset.journey);
          });
        }
        li.addEventListener('click', () => {
          this.stopAutoplay();
          if (window.innerWidth <= 900 && this.mobileChronicleOpen) {
            this.toggleMobileChronicle(false);
          }
          this.jumpToYear(targetY);
          this.openMilestoneBalloon(dynasty, m);
          if (snapShift) {
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
    }

    _highlightCurrentMilestone(dynasty) {
      const items = this._id('milestone-list').children;
      if (!items.length) return;
      const activeIdx = this._activeMilestoneIndex(dynasty);
      Array.from(items).forEach((el, idx) =>
        el.classList.toggle('is-current', idx === activeIdx)
      );
      if (activeIdx >= 0 && items[activeIdx]) {
        const el = items[activeIdx];
        const pane = this._id('chronicle-pane');
        if (pane && pane.scrollHeight > pane.clientHeight) {
          const elTop = el.offsetTop - pane.offsetTop;
          const targetTop = Math.max(0, elTop - pane.clientHeight * 0.42);
          pane.scrollTo({ top: targetTop, behavior: 'smooth' });
        }
      }
    }

    // ---------------- Place Genealogy (Trace Place) ----------------
    toggleGenealogyMode(force) {
      this.genealogyMode = force !== undefined ? force : !this.genealogyMode;
      if (this.genealogyMode) {
        this._dismissTraceOnboarding();
      }
      if (this.genealogyMode && this.challenge) {
        this.stopChallenge();
      }
      if (this.genealogyMode && this.activeJourney) {
        this.stopJourney();
      }
      this.svg.classList.toggle('is-crosshair', this.genealogyMode || Boolean(this.challenge));
      if (!this.genealogyMode && !this._id('genealogy-card').classList.contains('is-hidden')) {
        this.closeGenealogyCard();
      }
    }

    closeGenealogyCard() {
      this.activeTrace = null;
      this.activeTraceLabel = '';
      this._id('genealogy-card').classList.add('is-hidden');
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.remove('has-active-genealogy');
      this.grpGenealogy.innerHTML = '';
      if (this.activeMilestone) this._positionMilestoneBalloon();
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
            journeyKey: this._journeyKeyForMilestone(d, m),
            journeyStopIdx: 0,
          });
        }
      }

      // 2. Historical journeys (Qin Shi Huang, Zhang Qian, Zhuge Liang, Xuanzang, Li Bai, Su Shi)
      for (const j of HistoricalAtlasController.HISTORICAL_JOURNEYS) {
        j.stops.forEach((st, sIdx) => {
          const inDynSpan = st.year >= d.fromYear && st.year <= d.toYear;
          if (!inDynSpan && j.dynastyKey !== d.key) return;
          if ((j.key === 'zhugeliang' || j.key === 'qinshihuang') && !inDynSpan) return;
          if (isCloseCoord(st.coord, 45)) {
            const existing = results.find(
              (r) =>
                (sIdx === 0 && r.journeyKey === j.key) ||
                (r.year === st.year && r.journeyKey === j.key)
            );
            if (existing) {
              existing.journeyKey = j.key;
              existing.journeyStopIdx = sIdx;
            } else {
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
                journeyKey: j.key,
                journeyStopIdx: sIdx,
              });
            }
          }
        });
      }

      // 3. Curated landmark events
      for (const lm of HistoricalAtlasController.PLACE_LANDMARK_EVENTS) {
        if (lm.dynastyKey !== d.key) continue;
        if (isCloseCoord(lm.coord, 45)) {
          const dup = results.some((r) => Math.abs(r.year - lm.year) <= 3);
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
              journeyKey: null,
              journeyStopIdx: 0,
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
          if (!showTier2 && node.classList.contains('is-tier2')) return;
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

    openGenealogyAt(lng, lat, customLabel = null) {
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
            this.openGenealogyAt(lng, lat, this.activeTraceLabel);
          }
        });
      }
      this._dismissTraceOnboarding();
      if (this.activeJourney) this.stopJourney();
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
          lbl.textContent = this.activeTraceLabel;
        }
      }
      if (window.innerWidth <= 900 && sy > this.camera.y + this.camera.h * 0.44) {
        this.camera.y = sy - this.camera.h * 0.28;
        this._applyCamera(true);
      } else {
        this._rescaleSvgTypography(true);
      }

      let modernTitle = '';
      for (const prov of this.provinces) {
        if (String(prov.code).includes('_JD')) continue;
        if (prov.rings.some((poly) => MercatorProjector.pointInPolygonRings(lng, lat, poly))) {
          modernTitle = prov.title;
          break;
        }
      }
      if (!modernTitle) {
        const neighbors = Array.isArray(this.snapshots.neighbors) ? this.snapshots.neighbors : [];
        for (const nb of neighbors) {
          if (MercatorProjector.pointInShape(lng, lat, nb.shape)) {
            modernTitle = nb.title;
            break;
          }
        }
      }

      const nearestSettlement = (dynasty, maxKm) => {
        let best = null;
        let bestKm = maxKm;
        for (const s of dynasty.settlements || []) {
          const km = this.projector.greatCircleKm([lng, lat], s.coord);
          if (km < bestKm) {
            bestKm = km;
            best = { s, km };
          }
        }
        return best;
      };

      let closestOverall = null;
      for (const d of this.dynasties) {
        const hit = nearestSettlement(d, 160);
        if (hit && (!closestOverall || hit.km < closestOverall.km)) closestOverall = hit;
      }

      const matchedPassHit = this._findNearbyPass(lng, lat, 30);
      const matchedPass = matchedPassHit ? matchedPassHit.pass : null;
      const titleMain = matchedPass
        ? (this.locale === 'en' ? matchedPass.ancientEn : matchedPass.ancientZh)
        : modernTitle
          ? this.trTerm(modernTitle)
          : this.uiStr('outside_modern', '现代省界外 / 海域');
      const titleSuffix = matchedPass
        ? ` · ${this.locale === 'en' ? matchedPass.modernEn : '今' + matchedPass.modernZh}`
        : closestOverall && closestOverall.s.modern
          ? ` · ${this.trModernCity(closestOverall.s.modern)}`
          : '';
      if (this.activeTraceLabel && this.activeTraceLabel !== titleMain) {
        const extraParts = [];
        if (matchedPass) {
          extraParts.push(this.locale === 'en' ? matchedPass.modernEn : '今' + matchedPass.modernZh);
        } else {
          if (modernTitle && modernTitle !== this.activeTraceLabel) {
            extraParts.push(this.trTerm(modernTitle));
          }
          if (
            closestOverall &&
            closestOverall.s.modern &&
            closestOverall.s.modern !== this.activeTraceLabel &&
            closestOverall.s.modern !== modernTitle
          ) {
            extraParts.push(
              this.locale === 'en'
                ? this.trModernCity(closestOverall.s.modern)
                : `今${closestOverall.s.modern}`
            );
          }
        }
        this._id('genealogy-heading').textContent =
          this.activeTraceLabel + (extraParts.length ? ` · ${extraParts.join(' · ')}` : '');
      } else {
        this._id('genealogy-heading').textContent = titleMain + titleSuffix;
      }

      const rowsData = [];
      let totalEvents = 0;
      let capDynasties = 0;

      for (const d of this.dynasties) {
        if (d.key === 'prc') continue;
        const isCurDyn = d === this.dynasties[this.dynastyIdx];
        const targetYear = isCurDyn ? this.year : d.focusYear;
        const snapKey = this._resolveSnapKey(d, targetYear);
        const snap = this.snapshots[snapKey] || { polities: [], regions: [], prefectures: [] };

        let polityHit = null;
        for (const p of snap.polities || []) {
          if (p.role !== 'neighbor' && MercatorProjector.pointInShape(lng, lat, p.shape)) {
            polityHit = p.title;
            break;
          }
        }
        if (!polityHit) {
          for (const p of snap.polities || []) {
            if (p.role === 'neighbor' && MercatorProjector.pointInShape(lng, lat, p.shape)) {
              polityHit = p.title;
              break;
            }
          }
        }

        const adminHits = [];
        for (const reg of snap.regions || []) {
          if (MercatorProjector.pointInShape(lng, lat, reg.shape)) {
            const label =
              this.locale === 'en'
                ? this.trTerm(reg.title)
                : reg.title + (reg.category && !reg.title.endsWith(reg.category) ? `（${reg.category}）` : '');
            if (!adminHits.includes(label)) adminHits.push(label);
          }
        }
        for (const pref of snap.prefectures || []) {
          if (MercatorProjector.pointInShape(lng, lat, pref.shape)) {
            const label =
              this.locale === 'en'
                ? this.trTerm(pref.title)
                : pref.title + (pref.category && !pref.title.endsWith(pref.category) ? `（${pref.category}）` : '');
            if (!adminHits.includes(label)) adminHits.push(label);
          }
        }

        const near = nearestSettlement(d, 170);
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

        if (totalEvents > 0) {
          const btnLabel = this.genealogyEventsOnly
            ? this.locale === 'en'
              ? 'All Dynasties'
              : '历代全览'
            : this.locale === 'en'
              ? `Chronicles · ${totalEvents}`
              : `史事纪要 · ${totalEvents}`;
          subEl.innerHTML =
            `<span>${coordText}</span>` +
            `<button type="button" class="gen-filter-pill ${
              this.genealogyEventsOnly ? 'is-active' : ''
            }">${btnLabel}</button>`;
          const filterBtn = subEl.querySelector('.gen-filter-pill');
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

        const listEl = this._id('genealogy-timeline');
        listEl.innerHTML = '';

        if (matchedPass) {
          const passBanner = document.createElement('li');
          passBanner.className = 'pass-lore-banner';
          const rangeText = this.locale === 'en' ? matchedPass.rangeEn : matchedPass.rangeZh;
          const chokeText =
            this.locale === 'en' ? matchedPass.chokepointEn : matchedPass.chokepointZh;
          const badgeLbl = this.locale === 'en' ? 'Strategic Pass' : '雄关形胜';
          passBanner.innerHTML =
            `<div class="pass-lore-head"><span class="pass-lore-badge">${badgeLbl}</span><span class="pass-lore-range">${rangeText}</span></div>` +
            `<div class="pass-lore-desc">${chokeText}</div>`;
          listEl.appendChild(passBanner);
        }

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

          const capBadgeHtml = isCapHere
            ? `<span class="t-cap-badge">${
                this.locale === 'en'
                  ? 'Capital'
                  : (near.s.remark && near.s.remark.length <= 5 ? near.s.remark : '王朝都城')
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
                ? this.trModernCity(near.s.ancient)
                : this.trTerm(near.s.ancient);
            subParts.push(
              this.locale === 'en'
                ? `${this.uiStr('near_city', '邻近古城：')}${nearCityName} (${distStr})`
                : `${this.uiStr('near_city', '邻近古城：')}${nearCityName}（${distStr}）`
            );
          }

          let eventsHtml = '';
          if (placeEvents.length) {
            const evItems = placeEvents
              .map((ev, evIdx) => {
                const yrLabel =
                  this.locale === 'en'
                    ? this.formatYear(ev.year)
                    : `${ev.year <= 0 ? '前' + -ev.year : ev.year}年`;
                const jBtn = ev.journeyKey
                  ? `<button type="button" class="ev-journey-btn" data-journey="${
                      ev.journeyKey
                    }" data-stop="${ev.journeyStopIdx || 0}">${
                      this.locale === 'en' ? 'View Route' : '展阅行迹'
                    }</button>`
                  : '';
                return `<div class="t-ev-row" data-ev-idx="${evIdx}"><span class="t-ev-yr">▸ ${yrLabel}</span><span class="t-ev-txt">${ev.text}${jBtn}</span></div>`;
              })
              .join('');
            eventsHtml = `<div class="t-events">${evItems}</div>`;
          }

          li.innerHTML =
            `<span class="t-era">${this.dynastyName(d)}</span>` +
            `<span class="t-val">${mainStr}${capBadgeHtml}${
              subParts.length ? `<span class="t-sub">${subParts.join(' · ')}</span>` : ''
            }${eventsHtml}</span>`;

          li.querySelectorAll('.ev-journey-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.startJourney(btn.dataset.journey, Number(btn.dataset.stop || 0));
            });
          });

          li.querySelectorAll('.t-ev-row').forEach((rowEl) => {
            rowEl.addEventListener('click', (e) => {
              e.stopPropagation();
              const ev = placeEvents[Number(rowEl.dataset.evIdx)];
              if (!ev) return;
              this.stopAutoplay();
              const targetY = this._clampYearToDynasty(d, ev.year);
              this.jumpToYear(targetY);
              if (ev.milestone) {
                this.openMilestoneBalloon(d, ev.milestone);
              }
            });
          });

          li.addEventListener('click', () => {
            this.stopAutoplay();
            this.jumpToYear(d.focusYear);
          });
          listEl.appendChild(li);
        }

        const curLi = listEl.querySelector('li.is-current');
        if (curLi && listEl.scrollHeight > listEl.clientHeight) {
          const top = Math.max(0, curLi.offsetTop - listEl.offsetTop - listEl.clientHeight * 0.35);
          listEl.scrollTop = top;
        }
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
          cell.title = `${this.dynastyName(d)}（${this.formatSpan(d)}）`;
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
        bubbleText.textContent = `${this.formatYear(this.year)} · ${this.formatEraLabel(this.year, d)}`;
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

    jumpToYear(targetYear) {
      if (this._bootDone) this._dismissTraceOnboarding();
      let y = Math.max(this.minYear, Math.min(this.maxYear, Math.round(targetYear)));
      if (y === 0) y = this.year < 0 ? 1 : -1;
      const prevIdx = this.dynastyIdx;
      this.year = y;
      this.dynastyIdx = this._findDynastyIndex(y);
      const cur = this.dynasties[this.dynastyIdx];
      const nextSnapKey = this._resolveSnapKey(cur, y);

      if (prevIdx !== this.dynastyIdx || !this.grpSettlements.firstChild) {
        this._renderDynasty(cur);
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
      if (this.activeMilestone && (this.activeMilestone.year !== y || this.activeMilestone.isAuto)) {
        this.closeMilestoneBalloon();
      }
      this._syncAutoMilestoneBalloon(cur);
      this._renderCorridors();
      this._syncScrubberUi();
      if (this.activeTrace && !this._id('genealogy-card').classList.contains('is-hidden')) {
        this.openGenealogyAt(this.activeTrace[0], this.activeTrace[1]);
      }
    }

    stepTimelineNode(dir) {
      if (this.challenge) return;
      this._recordGestureClick();
      this.stopAutoplay();
      if (this.activeJourney) {
        if (this.journeyTimer) {
          clearInterval(this.journeyTimer);
          this.journeyTimer = null;
        }
        this.stepJourney(dir > 0 ? 1 : -1);
        return;
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
      if (dir > 0) {
        const nextY = list.find((y) => y > this.year);
        this.jumpToYear(nextY !== undefined ? nextY : this.maxYear);
      } else {
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i] < this.year) {
            this.jumpToYear(list[i]);
            return;
          }
        }
        this.jumpToYear(this.minYear);
      }
    }

    // ---------------- Autoplay ----------------
    startAutoplay() {
      if (this.challenge) return;
      this.playing = true;
      this.closeMilestoneBalloon();
      this._id('act-autoplay').innerHTML = SVG_ICONS.pause;
      if (this.year >= this.maxYear) this.jumpToYear(this.minYear);
      this.playInterval = setInterval(() => {
        const cur = this.dynasties[this.dynastyIdx];
        const delta = Math.max(1, Math.round((cur.toYear - cur.fromYear) / 140));
        if (this.year >= this.maxYear) {
          this.stopAutoplay();
          return;
        }
        this.jumpToYear(this.year + delta);
      }, 180);
    }

    stopAutoplay() {
      this.playing = false;
      this._id('act-autoplay').innerHTML = SVG_ICONS.play;
      if (this.playInterval) {
        clearInterval(this.playInterval);
        this.playInterval = null;
      }
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
          audio.play().catch(() => this._startGuqinSynthFallback());
        } else {
          this._startGuqinSynthFallback();
        }
      });
      this.musicAudio = audio;
      return audio;
    }

    _playCurrentMusicTrack() {
      this._stopGuqinSynthFallback();
      const tracks = HistoricalAtlasController.GUQIN_TRACKS;
      const t = tracks[this.musicTrackIdx % tracks.length];
      const audio = this._ensureMusicAudio();
      audio.src = t.mp3;
      this.musicPlaying = true;
      this._updateMusicUi();
      audio.play().catch(() => {
        if (!this.musicPlaying) return;
        audio.src = t.ogg;
        audio.play().catch(() => this._startGuqinSynthFallback());
      });
    }

    toggleMusic() {
      if (this.musicPlaying) {
        this.musicPlaying = false;
        if (this.musicAudio) this.musicAudio.pause();
        this._stopGuqinSynthFallback();
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

    _startGuqinSynthFallback() {
      if (!this.musicPlaying || this.synthTimer) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.synthCtx) this.synthCtx = new AudioCtx();
      if (this.synthCtx.state === 'suspended') this.synthCtx.resume();
      // Gong-Shang-Jue-Zhi-Yu pentatonic frequencies in D (Hz)
      const scale = [146.83, 164.81, 185.0, 220.0, 246.94, 293.66, 329.63, 369.99, 440.0];
      let step = 0;
      const pattern = [0, 3, 4, 5, 3, 2, 1, 0, 4, 6, 5, 3, 4, 2, 0];
      const pluck = () => {
        if (!this.musicPlaying || !this.synthCtx) return;
        const now = this.synthCtx.currentTime;
        const freq = scale[pattern[step % pattern.length]];
        step++;
        const osc = this.synthCtx.createOscillator();
        const overtone = this.synthCtx.createOscillator();
        const gain = this.synthCtx.createGain();
        const filter = this.synthCtx.createBiquadFilter();
        osc.type = 'triangle';
        overtone.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.996, now + 2.8);
        overtone.frequency.setValueAtTime(freq * 2, now);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(920, now);
        filter.frequency.exponentialRampToValueAtTime(240, now + 3.2);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.11, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 3.5);
        osc.connect(filter);
        overtone.connect(filter);
        filter.connect(gain);
        gain.connect(this.synthCtx.destination);
        osc.start(now);
        overtone.start(now);
        osc.stop(now + 3.6);
        overtone.stop(now + 3.6);
      };
      pluck();
      this.synthTimer = setInterval(pluck, 2200);
    }

    _stopGuqinSynthFallback() {
      if (this.synthTimer) {
        clearInterval(this.synthTimer);
        this.synthTimer = null;
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

    _formatChineseLi(li) {
      const map = {
        40: '四十',
        100: '一百',
        200: '二百',
        400: '四百',
        1000: '一千',
        2000: '二千',
        3000: '三千',
      };
      return map[li] || String(li);
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
      const li = bestKm * 2;
      barEl.style.width = `${barPx}px`;
      lblEl.textContent =
        this.locale === 'en'
          ? `${bestKm} km · ${li} li`
          : `${bestKm} km · 约${this._formatChineseLi(li)}里`;
    }

    _syncTogglePaneButton() {
      const btn = this._id('act-toggle-pane');
      if (!btn) return;
      const arrow = this.paneCollapsed ? '‹' : '›';
      const label = this.paneCollapsed
        ? this.locale === 'en'
          ? 'Info'
          : '史志'
        : this.locale === 'en'
          ? 'Full'
          : '全图';
      btn.innerHTML = `<span class="tp-arrow" aria-hidden="true">${arrow}</span><span class="tp-label" id="lbl-toggle-pane">${label}</span>`;
      btn.classList.toggle('is-collapsed', Boolean(this.paneCollapsed));
      btn.title = this.paneCollapsed
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
        this.closeMilestoneBalloon();
        this.closeGenealogyCard();
        if (this.activeJourney && window.innerWidth <= 900) {
          this.stopJourney(true);
        }
      }
      const body = this._id('workspace-body');
      if (body) {
        body.classList.toggle('is-mobile-chronicle-open', this.mobileChronicleOpen);
      }
      this._updateMobileChronicleBtn(this.dynasties[this.dynastyIdx]);
      setTimeout(() => {
        this._updateScaleBar();
        if (this.activeMilestone) this._positionMilestoneBalloon();
        if (this.mobileChronicleOpen) {
          const cur = this.dynasties[this.dynastyIdx];
          if (cur) this._highlightCurrentMilestone(cur);
        }
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
      const tier2MinZoom = isMobile ? 3.45 : 2.55;
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

      // Scale static markers (milestones, journey waypoints, challenge pins, genealogy overlays)
      this.svg
        .querySelectorAll(
          '.neighbor-caption, .milestone-pin, #grp-journey g[data-x], #grp-challenge g[data-x], #grp-genealogy g[data-x]'
        )
        .forEach((node) => {
          const x = node.getAttribute('data-x');
          const y = node.getAttribute('data-y');
          if (x !== null) {
            node.setAttribute('transform', `translate(${x},${y}) scale(${invScale})`);
          }
        });
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
      if (this.grpJourney && this.grpJourney.firstChild) {
        this.grpJourney.querySelectorAll('path[data-base-sw]').forEach((p) => {
          const baseSw = parseFloat(p.getAttribute('data-base-sw') || '3');
          p.style.strokeWidth = `${(baseSw * s).toFixed(2)}px`;
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

      // Step 0: Reserve all visible city dots and milestone pins so labels never cover dots
      for (const node of settlementNodes) {
        const isPass = node.classList.contains('is-pass');
        if (isPass) {
          if (!showCorridors || (!showPasses && !node.classList.contains('is-pass-trace'))) continue;
        } else if (!showSettlements) {
          continue;
        }
        const isT2 = node.classList.contains('is-tier2');
        if (isT2 && !showTier2) continue;
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
          ? 11.5
          : node.classList.contains('protectorate')
            ? 12
            : node.classList.contains('rival')
              ? 15
              : 19;

        const baseX = parseFloat(node.getAttribute('data-base-x') || node.getAttribute('data-x'));
        const baseY = parseFloat(node.getAttribute('data-base-y') || node.getAttribute('data-y'));
        const ls = node.classList.contains('neighbor')
          ? 1.2
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

      // Tier 4: Tier-2 secondary cities (visible when z >= 1.75; auto-flip or cull text if crowded)
      for (const node of settlementNodes) {
        if (node.classList.contains('is-tier2')) {
          if (showTier2) {
            layoutSettlementLabel(node, true);
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

      this.grpProvNames.querySelectorAll('.province-caption').forEach((node) => {
        node.setAttribute('font-size', (9.5 * s).toFixed(1));
      });
    }

    _animateCameraTo(targetCam) {
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
        if (k < 1) this.flyRaf = requestAnimationFrame(step);
      };
      this.flyRaf = requestAnimationFrame(step);
    }

    resetCamera() {
      this._animateCameraTo(this._getDefaultCamera());
    }

    _panToward(lng, lat) {
      const [tx, ty] = this.projector.toScreen(lng, lat);
      const maxW =
        typeof window !== 'undefined' && window.innerWidth <= 900 ? 290 : 380;
      const w = Math.min(this.camera.w, maxW);
      const h = w * (this.camera.h / this.camera.w);
      this._animateCameraTo({
        x: tx - w * 0.5,
        y: ty - h * 0.45,
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
    _buildChallengeDeck() {
      const deck = [];
      for (const d of this.dynasties) {
        if (d.key === 'prc') continue;
        for (const s of d.settlements || []) {
          if (!s.modern) continue;
          const weight = s.ancient !== s.modern ? 3 : 1;
          for (let k = 0; k < weight; k++) {
            deck.push({ dynasty: d, settlement: s });
          }
        }
      }
      const chosen = [];
      const seen = new Set();
      while (chosen.length < 10 && deck.length) {
        const idx = Math.floor(Math.random() * deck.length);
        const pick = deck.splice(idx, 1)[0];
        const uid = `${pick.dynasty.key}:${pick.settlement.ancient}`;
        if (!seen.has(uid)) {
          seen.add(uid);
          chosen.push(pick);
        }
      }
      return chosen;
    }

    startChallenge() {
      this._recordGestureClick();
      this.stopAutoplay();
      if (this.activeJourney) this.stopJourney(true);
      this.closeMilestoneBalloon();
      this.closeGenealogyCard();
      if (this.genealogyMode) this.toggleGenealogyMode(false);
      const sb = this._id('map-search-box');
      if (sb) sb.classList.add('is-hidden');
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.add('has-active-challenge');
      this.challengeVariant = 'locate';
      this.challenge = {
        variant: 'locate',
        deck: this._buildChallengeDeck(),
        index: 0,
        score: 0,
        answered: false,
      };
      this._syncImmersivePaneState();
      this._id('challenge-card').classList.remove('is-hidden');
      const actChal = this._id('act-challenge');
      if (actChal) actChal.classList.add('is-active');
      const lblChal = this._id('lbl-challenge') || actChal;
      if (lblChal) lblChal.textContent = this.uiStr('btn_quiz_active', '挑战中…');
      this.svg.classList.add('is-crosshair');
      this.grpSettlements.classList.add('is-hidden');
      this._id('act-next-round').onclick = null;
      this.presentChallengeRound();
    }

    stopChallenge(keepPaneState = false) {
      this.challenge = null;
      this.grpChallenge.innerHTML = '';
      this._id('challenge-card').classList.add('is-hidden');
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.remove('has-active-challenge');
      const sb = this._id('map-search-box');
      if (sb) sb.classList.remove('is-hidden');
      const actChal = this._id('act-challenge');
      if (actChal) actChal.classList.remove('is-active');
      const lblChal = this._id('lbl-challenge') || actChal;
      if (lblChal) lblChal.textContent = this.uiStr('btn_quiz', '开始挑战');
      this.svg.classList.toggle('is-crosshair', this.genealogyMode);
      this.grpSettlements.classList.toggle('is-hidden', !this._id('chk-settlements').checked);
      if (!keepPaneState) {
        this._syncImmersivePaneState();
      }
      this._syncDocumentSeoMeta();
    }

    presentChallengeRound() {
      const q = this.challenge;
      this.grpChallenge.innerHTML = '';
      q.answered = false;
      q.pendingGuess = null;
      const cur = q.deck[q.index];
      let roundYear = cur.dynasty.focusYear;
      if (cur.settlement.appear !== undefined && roundYear < cur.settlement.appear) {
        roundYear = cur.settlement.appear;
      }
      if (cur.settlement.vanish !== undefined && roundYear > cur.settlement.vanish) {
        roundYear = cur.settlement.vanish;
      }
      this.jumpToYear(this._clampYearToDynasty(cur.dynasty, roundYear));
      this.grpSettlements.classList.add('is-hidden');

      this._id('challenge-step').textContent =
        this.locale === 'en'
          ? `Q ${q.index + 1} / ${q.deck.length}`
          : `第 ${q.index + 1} / ${q.deck.length} 题`;
      this._id('challenge-points').textContent = `${this.uiStr('quiz_score', '得分')} ${q.score}`;
      this._id('challenge-result').classList.add('is-hidden');

      const baseClue = cur.settlement.remark
        ? this.trTerm(cur.settlement.remark)
        : cur.settlement.isCapital
          ? this.locale === 'en'
            ? 'Imperial / Dynastic Capital'
            : '当朝都城'
          : this.locale === 'en'
            ? 'Strategic Prefecture & Hub'
            : '当朝重镇州府';

      const placeEvents = this._collectPlaceEventsForDynasty(
        cur.dynasty,
        cur.settlement.coord[0],
        cur.settlement.coord[1],
        { s: cur.settlement, km: 0 }
      );
      let extraEventStr = '';
      if (placeEvents.length) {
        const ev = placeEvents[0];
        const yrLbl =
          this.locale === 'en'
            ? this.formatYear(ev.year)
            : `${ev.year <= 0 ? '前' + -ev.year : ev.year}年`;
        let cleanEv = ev.text.replace(/（今[^）]+）|\(Now [^)]+\)/gi, '');
        if (cur.settlement.modern && cur.settlement.modern !== cur.settlement.ancient) {
          for (const modPart of cur.settlement.modern.split(/[·/、]/)) {
            if (modPart && modPart.length >= 2 && modPart !== cur.settlement.ancient) {
              cleanEv = cleanEv.replaceAll(modPart, cur.settlement.ancient);
            }
          }
        }
        extraEventStr = ` · ${yrLbl}：${cleanEv}`;
      }

      const clueTag = this.locale === 'en' ? 'Historical Clue' : '当朝掌故';
      const targetCityEn =
        cur.dynasty.key === 'roc' || cur.dynasty.key === 'prc'
          ? this.trModernCity(cur.settlement.ancient)
          : this.trTerm(cur.settlement.ancient);
      const promptHtml =
        this.locale === 'en'
          ? `Click on the map to pinpoint <b>${this.dynastyName(cur.dynasty)}</b>’s <b>“${targetCityEn}”</b>`
          : `请在舆图上标定 <b>【${this.dynastyName(cur.dynasty)}】</b> 时期的 <b>「${cur.settlement.ancient}」</b>`;

      this._id('challenge-question').innerHTML =
        `<div>${promptHtml}</div>` +
        `<div class="challenge-clue-box"><span class="clue-tag">${clueTag}</span><span>${baseClue}${extraEventStr}</span></div>`;
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
    }

    _evaluateLocateClick(svgX, svgY) {
      const q = this.challenge;
      if (!q || q.answered) return;
      q.answered = true;
      q.pendingGuess = null;
      this.grpChallenge.innerHTML = '';

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
      const ansAncEn =
        cur.dynasty.key === 'roc' || cur.dynasty.key === 'prc'
          ? this.trModernCity(cur.settlement.ancient)
          : this.trTerm(cur.settlement.ancient);
      const ansModEn = this.trModernCity(cur.settlement.modern);
      aLabel.textContent =
        this.locale === 'en'
          ? `${ansAncEn} (${ansModEn})`
          : `${cur.settlement.ancient}（今${cur.settlement.modern}）`;
      this._rescaleSvgTypography();

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
          ? `${comment} Off by <b>${km} km</b> (+${pts} pts) · Answer: ${ansAncEn} (${ansModEn})`
          : `${comment} 偏差 <b>${km} 公里</b>（+${pts} 分）· 答案：${cur.settlement.ancient}（今${cur.settlement.modern}）`;

      this._id('act-next-round').innerHTML =
        q.index + 1 >= q.deck.length
          ? this.uiStr('quiz_see_result', '查看成绩')
          : `${this.locale === 'en' ? 'Next' : '下一题'} ${SVG_ICONS.arrowRight}`;
      this._id('challenge-result').classList.remove('is-hidden');
    }

    _finishChallenge() {
      const q = this.challenge;
      const total = q.deck.length * 100;
      const rank =
        q.score >= 850
          ? this.uiStr('title_850', '太史令 · 舆图大家')
          : q.score >= 650
            ? this.uiStr('title_650', '職方郎中 · 熟稔疆理')
            : q.score >= 400
              ? this.uiStr('title_400', '州郡从事 · 略通古今')
              : this.uiStr('title_0', '江湖行客 · 不妨多逛逛时间轴');

      this._id('challenge-question').innerHTML =
        this.locale === 'en'
          ? `Challenge complete! Total score <b>${q.score} / ${total}</b> — Rank: <b>${rank}</b>`
          : `挑战结束！总分 <b>${q.score} / ${total}</b> —— 封号：<b>「${rank}」</b>`;
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
    }

    // ---------------- Historical Journeys (青史行迹) ----------------
    static get HISTORICAL_JOURNEYS() {
      return (window.ATLAS_LORE_DATA && window.ATLAS_LORE_DATA.HISTORICAL_JOURNEYS) || [];
    }

    startJourney(journeyKey, stopIdx = 0) {
      const journeys = HistoricalAtlasController.HISTORICAL_JOURNEYS;
      const found = journeys.find((j) => j.key === journeyKey) || journeys[0];
      if (!found) return;

      this._recordGestureClick();
      this._dismissJourneyOnboarding();
      this._dismissTraceOnboarding();
      this.stopAutoplay();
      if (this.journeyTimer) {
        clearInterval(this.journeyTimer);
        this.journeyTimer = null;
      }
      if (this.challenge) this.stopChallenge(true);
      if (this.genealogyMode) this.toggleGenealogyMode(false);
      this.closeGenealogyCard();
      this.closeMilestoneBalloon();

      this.activeJourney = found;
      this.journeyStopIdx = Math.max(0, Math.min(found.stops.length - 1, stopIdx));
      this._syncImmersivePaneState();

      const vf = this._id('viewport-frame');
      if (vf) vf.classList.add('has-active-journey');
      if (this.journeyCard) this.journeyCard.classList.remove('is-hidden');

      document.querySelectorAll('.journey-chip-btn, .journey-menu-item').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.journey === found.key);
      });
      const jMenuBtn = this._id('act-journey-menu');
      if (jMenuBtn) jMenuBtn.classList.add('is-active');

      const stop = found.stops[this.journeyStopIdx];
      if (stop) this.jumpToYear(stop.year);

      this._renderJourneyOverlay();
      this._renderJourneyCard();
      this._syncDocumentSeoMeta();

      if (stopIdx === 0) {
        this._frameJourneyOverview(found);
      } else if (stop) {
        this._flyToJourneyStop(stop);
      }
    }

    stopJourney(keepPaneState = false) {
      if (this.journeyTimer) {
        clearInterval(this.journeyTimer);
        this.journeyTimer = null;
      }
      this.activeJourney = null;
      this.journeyStopIdx = 0;
      if (this.grpJourney) this.grpJourney.innerHTML = '';
      if (this.journeyCard) {
        this.journeyCard.classList.add('is-hidden');
        this.journeyCard.innerHTML = '';
      }
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.remove('has-active-journey');
      document.querySelectorAll('.journey-chip-btn, .journey-menu-item').forEach((btn) => {
        btn.classList.remove('is-active');
      });
      const jMenuBtn = this._id('act-journey-menu');
      if (jMenuBtn) jMenuBtn.classList.remove('is-active');
      if (!keepPaneState) {
        this._syncImmersivePaneState();
      }
    }

    goToJourneyStop(idx, panCamera = true) {
      if (!this.activeJourney) return;
      const stops = this.activeJourney.stops;
      this.journeyStopIdx = Math.max(0, Math.min(stops.length - 1, idx));
      const stop = stops[this.journeyStopIdx];
      if (stop) {
        this.jumpToYear(stop.year);
        if (panCamera) this._flyToJourneyStop(stop);
      }
      this._renderJourneyOverlay();
      this._renderJourneyCard();
    }

    stepJourney(delta) {
      if (!this.activeJourney) return;
      const nextIdx =
        (this.journeyStopIdx + delta + this.activeJourney.stops.length) %
        this.activeJourney.stops.length;
      this.goToJourneyStop(nextIdx, true);
    }

    toggleJourneyAutoplay() {
      if (!this.activeJourney) return;
      if (this.journeyTimer) {
        clearInterval(this.journeyTimer);
        this.journeyTimer = null;
        this._renderJourneyCard();
        return;
      }
      this.journeyTimer = setInterval(() => {
        if (!this.activeJourney) {
          clearInterval(this.journeyTimer);
          this.journeyTimer = null;
          return;
        }
        if (this.journeyStopIdx + 1 >= this.activeJourney.stops.length) {
          clearInterval(this.journeyTimer);
          this.journeyTimer = null;
          this._renderJourneyCard();
          return;
        }
        this.goToJourneyStop(this.journeyStopIdx + 1, true);
      }, 2800);
      this._renderJourneyCard();
    }

    _frameJourneyOverview(journey) {
      if (!journey || !journey.stops.length) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const st of journey.stops) {
        const [sx, sy] = this.projector.toScreen(st.coord[0], st.coord[1]);
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;
      }
      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5;
      const aspect = this._getViewportAspect();
      const spanW = Math.max(maxX - minX + 110, (maxY - minY + 120) / aspect) * 1.18;
      const w = Math.max(320, Math.min(960, spanW));
      const h = w * aspect;
      // Offset camera slightly down/left so the bottom-left journey card never occludes western/southern stops
      const offsetX = window.innerWidth > 900 ? -w * 0.06 : 0;
      const offsetY = window.innerWidth > 900 ? h * 0.06 : h * 0.1;
      this._animateCameraTo({
        x: Math.max(-140, Math.min(1000 - w + 140, cx - w * 0.5 + offsetX)),
        y: Math.max(-100, Math.min(700 - h + 120, cy - h * 0.5 + offsetY)),
        w,
        h,
      });
    }

    _flyToJourneyStop(stop) {
      if (!stop || !stop.coord) return;
      const [tx, ty] = this.projector.toScreen(stop.coord[0], stop.coord[1]);
      const aspect = this._getViewportAspect();
      const w = Math.max(360, Math.min(this.camera.w, 540));
      const h = w * aspect;
      const offsetX = window.innerWidth > 900 ? -w * 0.08 : 0;
      const offsetY = window.innerWidth > 900 ? h * 0.06 : h * 0.12;
      this._animateCameraTo({
        x: tx - w * 0.5 + offsetX,
        y: ty - h * 0.48 + offsetY,
        w,
        h,
      });
    }

    _buildJourneySegmentSvgPath(c1, c2, viaCoords) {
      const geoPts = [c1, ...(viaCoords || []), c2];
      const pts = geoPts.map((pt) => this.projector.toScreen(pt[0], pt[1]));
      if (pts.length === 2) {
        const [x1, y1] = pts[0];
        const [x2, y2] = pts[1];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const bend = Math.min(18, len * 0.12);
        const mx = (x1 + x2) * 0.5 - (dy / len) * bend;
        const my = (y1 + y2) * 0.5 + (dx / len) * bend;
        return `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      }
      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
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
      }
      return d;
    }

    _renderJourneyOverlay() {
      if (!this.grpJourney) return;
      this.grpJourney.innerHTML = '';
      if (!this.activeJourney) return;

      const j = this.activeJourney;
      const stops = j.stops;
      const curIdx = this.journeyStopIdx;

      const segPaths = [];
      for (let i = 0; i < stops.length - 1; i++) {
        segPaths.push(
          this._buildJourneySegmentSvgPath(
            stops[i + 1].fromCoord || stops[i].coord,
            stops[i + 1].coord,
            stops[i + 1].via
          )
        );
      }

      const fullPathD = segPaths.join(' ');
      const activeEndSeg = curIdx === 0 ? segPaths.length : curIdx;
      const passedPathD = segPaths.slice(0, activeEndSeg).join(' ');

      // 1. Parchment casing halo along full route
      this._svgNode(
        'path',
        {
          d: fullPathD,
          class: 'journey-track-bg',
          'data-base-sw': '6.2',
        },
        this.grpJourney
      );

      // 2. Full route baseline so the entire historical route is always visible
      this._svgNode(
        'path',
        {
          d: fullPathD,
          class: 'journey-track-upcoming',
          stroke: j.color,
          'data-base-sw': '2.4',
        },
        this.grpJourney
      );

      // 3. Passed / active route segment + flowing animated overlay
      if (passedPathD) {
        this._svgNode(
          'path',
          {
            d: passedPathD,
            class: 'journey-track-passed',
            stroke: j.color,
            'data-base-sw': '3.5',
          },
          this.grpJourney
        );
        this._svgNode(
          'path',
          {
            d: passedPathD,
            class: 'journey-track-flow',
            'data-base-sw': '1.8',
          },
          this.grpJourney
        );
      }

      // 4. Numbered waypoint pins (render non-current first, current stop on top)
      const order = stops.map((_, idx) => idx).sort((a, b) => (a === curIdx ? 1 : b === curIdx ? -1 : a - b));
      for (const idx of order) {
        const st = stops[idx];
        const [sx, sy] = this.projector.toScreen(st.coord[0], st.coord[1]);
        const stateCls =
          idx === curIdx ? 'is-current' : idx < curIdx ? 'is-passed' : 'is-upcoming';
        const g = this._svgNode(
          'g',
          {
            class: `journey-node ${stateCls}`,
            'data-x': sx.toFixed(1),
            'data-y': sy.toFixed(1),
            'data-stop-idx': String(idx),
          },
          this.grpJourney
        );
        g.style.color = j.color;

        if (idx === curIdx) {
          this._svgNode('circle', { class: 'jn-pulse', r: 12 }, g);
        }
        this._svgNode('circle', { class: 'jn-disc', r: idx === curIdx ? 8.5 : 7.2 }, g);
        const numTxt = this._svgNode('text', { class: 'jn-num', y: '0.5' }, g);
        numTxt.textContent = String(idx + 1);

        const lblY = st.labelPos === 'bottom' ? '18' : '-11.5';
        const lblTxt = this._svgNode('text', { class: 'jn-label', x: '0', y: lblY }, g);
        lblTxt.textContent = this.locale === 'en' ? st.ancientEn : st.ancientZh;
      }

      this._rescaleSvgTypography();
    }

    _renderJourneyCard() {
      if (!this.journeyCard || !this.activeJourney) return;
      const j = this.activeJourney;
      const stops = j.stops;
      const idx = this.journeyStopIdx;
      const st = stops[idx];
      const isEn = this.locale === 'en';
      const allJourneys = HistoricalAtlasController.HISTORICAL_JOURNEYS;

      const tabsHtml = allJourneys
        .map(
          (item) =>
            `<button type="button" class="jc-tab-btn${item.key === j.key ? ' is-active' : ''}" data-jkey="${item.key}">${
              isEn ? item.shortEn : item.shortZh
            }</button>`
        )
        .join('');

      const dotsHtml = stops
        .map((s, i) => {
          const cls =
            i === idx ? 'jc-dot is-current' : i < idx ? 'jc-dot is-passed' : 'jc-dot';
          const tip = `${i + 1}. ${isEn ? s.ancientEn : s.ancientZh} (${this.formatYear(s.year)})`;
          return `<button type="button" class="${cls}" data-sidx="${i}" title="${tip}">${i + 1}</button>`;
        })
        .join('');

      const jDyn =
        this.dynasties[this._findDynastyIndex(st.year)] ||
        this.dynasties.find((d) => d.key === j.dynastyKey);
      const yrStr = isEn
        ? `${this.formatYear(st.year)}${jDyn ? ' · ' + this.dynastyName(jDyn) : ''}`
        : `${st.year <= 0 ? '公元前' + -st.year + '年' : '公元' + st.year + '年'} · ${st.eraZh}`;
      const placeStr = isEn
        ? `${st.ancientEn} (Now ${st.modernEn})`
        : `${st.ancientZh}（今${st.modernZh}）`;

      const autoLabel = this.journeyTimer
        ? isEn
          ? `${SVG_ICONS.pause} Pause`
          : `${SVG_ICONS.pause} 暂停巡礼`
        : isEn
          ? `${SVG_ICONS.play} Auto Tour`
          : `${SVG_ICONS.play} 自动巡礼`;

      this.journeyCard.innerHTML =
        `<div class="jc-top-bar">` +
        `<span class="jc-mobile-person">${isEn ? j.shortEn : j.shortZh}</span>` +
        `<div class="jc-tabs">${tabsHtml}</div>` +
        `<button type="button" class="jc-close-btn" id="act-journey-overview" title="${isEn ? 'Fit entire route on map' : '全线总览视图'}">${isEn ? 'Full Route' : '全线视图'}</button>` +
        `<button type="button" class="jc-close-btn" id="act-close-journey" title="${isEn ? 'Exit Historical Journey (Esc)' : '退出行迹巡礼 (Esc)'}">${isEn ? 'Exit' : '退出'} ×</button>` +
        `</div>` +
        `<div class="jc-stop-head">` +
        `<span class="jc-step-badge" style="background:${j.color}">${
          isEn ? `Stop ${idx + 1} / ${stops.length}` : `第 ${idx + 1} / ${stops.length} 站`
        }</span>` +
        `<span class="jc-stop-title">${isEn ? st.titleEn : st.titleZh}</span>` +
        `<span class="jc-stop-year">${yrStr}</span>` +
        `</div>` +
        `<div class="jc-stop-place">${SVG_ICONS.pin} <span>${placeStr}</span></div>` +
        `<p class="jc-stop-desc">${isEn ? st.descEn : st.descZh}</p>` +
        `<div class="jc-stop-quote">${isEn ? st.quoteEn : st.quoteZh}</div>` +
        `<div class="jc-footer">` +
        `<div class="jc-dots">${dotsHtml}</div>` +
        `<div class="jc-controls">` +
        `<button type="button" class="jc-nav-btn" id="act-journey-prev">${SVG_ICONS.arrowLeft} ${isEn ? 'Prev' : '上一站'}</button>` +
        `<button type="button" class="jc-nav-btn is-primary" id="act-journey-auto">${autoLabel}</button>` +
        `<button type="button" class="jc-nav-btn" id="act-journey-next">${isEn ? 'Next' : '下一站'} ${SVG_ICONS.arrowRight}</button>` +
        `</div>` +
        `</div>`;

      this.journeyCard.querySelectorAll('.jc-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.startJourney(btn.dataset.jkey, 0);
        });
      });
      this.journeyCard.querySelectorAll('.jc-dot').forEach((dot) => {
        dot.addEventListener('click', () => {
          if (this.journeyTimer) {
            clearInterval(this.journeyTimer);
            this.journeyTimer = null;
          }
          this.goToJourneyStop(Number(dot.dataset.sidx), true);
        });
      });
      const prevBtn = this._id('act-journey-prev');
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          if (this.journeyTimer) {
            clearInterval(this.journeyTimer);
            this.journeyTimer = null;
          }
          this.stepJourney(-1);
        });
      }
      const nextBtn = this._id('act-journey-next');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          if (this.journeyTimer) {
            clearInterval(this.journeyTimer);
            this.journeyTimer = null;
          }
          this.stepJourney(1);
        });
      }
      const autoBtn = this._id('act-journey-auto');
      if (autoBtn) {
        autoBtn.addEventListener('click', () => this.toggleJourneyAutoplay());
      }
      const ovBtn = this._id('act-journey-overview');
      if (ovBtn) {
        ovBtn.addEventListener('click', () => this._frameJourneyOverview(j));
      }
      const closeBtn = this._id('act-close-journey');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.stopJourney());
      }
    }

    // ---------------- Global Quick Search ----------------
    _ensureSearchIndex() {
      if (this.searchIndex) return this.searchIndex;
      const entries = [];

      // 0a. Curated Historical Journeys (青史行迹)
      for (const j of HistoricalAtlasController.HISTORICAL_JOURNEYS) {
        const d = this.dynasties.find((item) => item.key === j.dynastyKey) || this.dynasties[0];
        const stopNames = j.stops.map((s) => `${s.ancientZh} ${s.modernZh} ${s.titleZh}`).join(' ');
        entries.push({
          kind: 'journey',
          journeyKey: j.key,
          dynasty: d,
          year: j.stops[0].year,
          titleZh: j.titleZh,
          subZh: `${j.spanZh} · 共 ${j.stops.length} 站`,
          titleEn: j.titleEn,
          subEn: `${j.spanEn} · ${j.stops.length} stops`,
          keywords: `${j.shortZh} ${j.titleZh} ${j.shortEn} ${j.titleEn} 青史行迹 行迹 路线 秦始皇 嬴政 秦王 扫六合 一统六国 统一六国 灭六国 王翦 王贲 李信 蒙恬 荆轲 丝绸之路 贬谪 西行 东坡 诸葛亮 孔明 卧龙 出师表 北伐 隆中 李白 太白 青莲 谪仙 壮游 王阳明 王守仁 阳明心学 知行合一 致良知 龙场悟道 ${stopNames}`.toLowerCase(),
        });
      }

      // 0. Dynasties / Historical Periods
      for (const d of this.dynasties) {
        const enDyn = (this.enLocale.dynasties && this.enLocale.dynasties[d.key]) || {};
        const nameEn = enDyn.name || d.title;
        const shortEn = enDyn.short || d.badge || d.title;
        const spanZh = `${d.fromYear <= 0 ? '前' + -d.fromYear : d.fromYear}—${d.toYear <= 0 ? '前' + -d.toYear : d.toYear}`;
        const spanEn = `${d.fromYear <= 0 ? -d.fromYear + ' BCE' : d.fromYear + ' CE'} – ${d.toYear <= 0 ? -d.toYear + ' BCE' : d.toYear + ' CE'}`;
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
            titleZh: s.ancient,
            subZh: s.modern && s.modern !== s.ancient ? `今${s.modern}` : s.remark || '',
            titleEn: ancEn,
            subEn: s.modern && s.modern !== s.ancient ? `Now ${modEn}` : remEn,
            keywords: `${s.ancient} ${s.modern || ''} ${s.remark || ''} ${rawAncEn} ${ancEn} ${modEn} ${remEn}`.toLowerCase(),
          });
        }
      }

      // 1b. Strategic Historical Passes (名关雄隘 · 天下锁钥)
      for (const p of HistoricalAtlasController.STRATEGIC_PASSES) {
        const dIdx = this._findDynastyIndex(p.focusYear || -200);
        const d = this.dynasties[dIdx] || this.dynasties[0];
        entries.push({
          kind: 'pass',
          passKey: p.key,
          dynasty: d,
          year: p.focusYear || d.focusYear,
          coord: p.coord,
          titleZh: p.ancientZh,
          subZh: `今${p.modernZh} · ${p.rangeZh}`,
          titleEn: p.ancientEn,
          subEn: `${p.modernEn} · ${p.rangeEn}`,
          keywords: `${p.ancientZh} ${p.modernZh} ${p.rangeZh} ${p.ancientEn} ${p.modernEn} ${p.rangeEn} 名关 雄关 关隘 险关 pass`.toLowerCase(),
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
      const trimmed = rawQuery.trim();
      if (!trimmed) return [];
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
      const prefixQ = numMatch ? numMatch[1] : q;
      const yearNum = numMatch ? this._parseChineseNumber(numMatch[2]) : null;

      spans.forEach((sp, idx) => {
        const [startY, prefix, baseNum = 1] = sp;
        const endY = idx + 1 < spans.length ? spans[idx + 1][0] - 1 : 1948;
        if (prefixQ && prefix.includes(prefixQ)) {
          const targetNum = yearNum !== null ? yearNum : baseNum;
          const targetY = startY + (targetNum - baseNum);
          if (targetY >= startY && targetY <= endY + 5) {
            const dIdx = this._findDynastyIndex(targetY);
            const d = this.dynasties[dIdx];
            const label = `${prefix}${this._toChineseEraNum(targetNum)}年`;
            const yrZh = targetY <= 0 ? `公元前${-targetY}年` : `公元 ${targetY} 年`;
            const yrEn = targetY <= 0 ? `${-targetY} BCE` : `${targetY} CE`;
            hits.push({
              kind: 'era',
              dynasty: d,
              year: targetY,
              titleZh: label,
              subZh: yrZh,
              titleEn: `${label} (${yrEn})`,
              subEn: (this.enLocale.dynasties[d.key] && this.enLocale.dynasties[d.key].name) || d.title,
              score: prefix.endsWith(prefixQ) ? 120 : 95,
            });
          }
        }
      });
      return hits;
    }

    _queryQuickSearch(rawQuery) {
      const q = rawQuery.trim().toLowerCase();
      if (!q) return [];
      const index = this._ensureSearchIndex();
      const results = [...this._matchEraResults(rawQuery)];

      for (const item of index) {
        let score = 0;
        const tZh = item.titleZh.toLowerCase();
        const tEn = item.titleEn.toLowerCase();
        if (tZh === q || tEn === q) score = 100;
        else if (tZh.startsWith(q) || tEn.startsWith(q)) score = 80;
        else if (item.keywords.includes(q)) score = 55;

        if (score > 0) {
          if (item.dynasty === this.dynasties[this.dynastyIdx]) score += 8;
          results.push({ ...item, score });
        }
      }

      results.sort((a, b) => b.score - a.score);
      return results.slice(0, 12);
    }

    _selectSearchResult(item) {
      this.stopAutoplay();
      const listEl = this._id('map-search-results');
      if (listEl) listEl.classList.add('is-hidden');
      const boxEl = this._id('map-search-box');
      if (boxEl) boxEl.classList.remove('is-expanded');

      if (item.kind === 'journey' && item.journeyKey) {
        this.startJourney(item.journeyKey, 0);
        return;
      }

      this.jumpToYear(item.year);

      if ((item.kind === 'city' || item.kind === 'pass') && item.coord) {
        if (!this._id('chk-settlements').checked) {
          this._id('chk-settlements').checked = true;
          this.grpSettlements.classList.remove('is-hidden');
        }
        const targetZoom = item.kind === 'pass' ? 2.35 : item.tier === 2 ? 2.2 : 1.85;
        const [tx, ty] = this.projector.toScreen(item.coord[0], item.coord[1]);
        const w = Math.min(this.camera.w, 1000 / targetZoom);
        const h = w * this._getViewportAspect();
        this._animateCameraTo({ x: tx - w * 0.5, y: ty - h * 0.45, w, h });
        this.openGenealogyAt(item.coord[0], item.coord[1]);
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

    // ---------------- Event Listeners ----------------
    _attachListeners() {
      // Quick Search box
      const searchInp = this._id('inp-map-search');
      const searchList = this._id('map-search-results');
      let activeSearchIdx = -1;
      let currentResults = [];

      const renderSearchDropdown = () => {
        if (!searchInp || !searchList) return;
        const q = searchInp.value.trim();
        const kindLabel = {
          journey: this.locale === 'en' ? 'Journey' : '行迹',
          dynasty: this.locale === 'en' ? 'Dynasty' : '朝代',
          era: this.locale === 'en' ? 'Era' : '纪年',
          city: this.locale === 'en' ? 'City' : '古城',
          pass: this.locale === 'en' ? 'Pass' : '雄关',
          prefecture: this.locale === 'en' ? 'Prefecture' : '州府',
          region: this.locale === 'en' ? 'Circuit/Prov' : '大区',
          event: this.locale === 'en' ? 'Event' : '史事',
        };
        if (!q) {
          const index = this._ensureSearchIndex();
          currentResults = index.filter((item) => item.kind === 'journey');
          activeSearchIdx = -1;
          searchList.innerHTML = '';
          const head = document.createElement('li');
          head.className = 'sr-section-head';
          head.textContent =
            this.locale === 'en'
              ? 'Historical Journeys · Quick Launch'
              : '青史行迹 · 人物时空巡礼';
          searchList.appendChild(head);
          currentResults.forEach((item) => {
            const li = document.createElement('li');
            const mainText = this.locale === 'en' ? item.titleEn : item.titleZh;
            const subText = this.locale === 'en' ? item.subEn : item.subZh;
            const tagText = `${this.dynastyBadge(item.dynasty)} · ${kindLabel.journey}`;
            li.innerHTML =
              `<div><span class="sr-main">${mainText}</span>${subText ? `<span class="sr-sub">${subText}</span>` : ''}</div>` +
              `<span class="sr-tag">${tagText}</span>`;
            li.addEventListener('mousedown', (e) => {
              e.preventDefault();
              this._selectSearchResult(item);
              searchInp.blur();
            });
            searchList.appendChild(li);
          });
          searchList.classList.remove('is-hidden');
          return;
        }
        currentResults = this._queryQuickSearch(q);
        activeSearchIdx = currentResults.length ? 0 : -1;
        searchList.innerHTML = '';
        if (!currentResults.length) {
          const empty = document.createElement('li');
          empty.innerHTML = `<span class="sr-sub">${this.locale === 'en' ? 'No matching place, era, or event' : '未找到匹配的古今地名、州府、年号或事件'}</span>`;
          searchList.appendChild(empty);
          searchList.classList.remove('is-hidden');
          return;
        }
        currentResults.forEach((item, idx) => {
          const li = document.createElement('li');
          if (idx === activeSearchIdx) li.classList.add('is-active');
          const mainText = this.locale === 'en' ? item.titleEn : item.titleZh;
          const subText = this.locale === 'en' ? item.subEn : item.subZh;
          const tagText = `${this.dynastyBadge(item.dynasty)} · ${kindLabel[item.kind] || ''}`;
          li.innerHTML =
            `<div><span class="sr-main">${mainText}</span>${subText ? `<span class="sr-sub">${subText}</span>` : ''}</div>` +
            `<span class="sr-tag">${tagText}</span>`;
          li.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this._selectSearchResult(item);
            searchInp.blur();
          });
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
          if (e.key === 'ArrowDown' && currentResults.length) {
            e.preventDefault();
            activeSearchIdx = (activeSearchIdx + 1) % currentResults.length;
            Array.from(searchList.querySelectorAll('li:not(.sr-section-head)')).forEach((el, i) =>
              el.classList.toggle('is-active', i === activeSearchIdx)
            );
          } else if (e.key === 'ArrowUp' && currentResults.length) {
            e.preventDefault();
            activeSearchIdx = (activeSearchIdx - 1 + currentResults.length) % currentResults.length;
            Array.from(searchList.querySelectorAll('li:not(.sr-section-head)')).forEach((el, i) =>
              el.classList.toggle('is-active', i === activeSearchIdx)
            );
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
      const journeyBtn = this._id('act-journey-menu');
      const journeyPopover = this._id('journey-popover');
      const closeLayersPopover = () => {
        if (!layersPopover || !layersBtn) return;
        layersPopover.classList.add('is-hidden');
        layersBtn.classList.remove('is-active');
        layersBtn.setAttribute('aria-expanded', 'false');
      };
      const closeJourneyPopover = () => {
        if (!journeyPopover || !journeyBtn) return;
        journeyPopover.classList.add('is-hidden');
        if (!this.activeJourney) {
          journeyBtn.classList.remove('is-active');
        }
        journeyBtn.setAttribute('aria-expanded', 'false');
      };
      if (journeyBtn && journeyPopover) {
        journeyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._dismissJourneyOnboarding();
          closeLayersPopover();
          const willOpen = journeyPopover.classList.contains('is-hidden');
          if (willOpen) {
            if (window.innerWidth > 640) {
              const btnRect = journeyBtn.getBoundingClientRect();
              const navRect = this._id('nav-bar').getBoundingClientRect();
              const leftPx = Math.max(
                12,
                Math.min(window.innerWidth - 310, btnRect.left - navRect.left)
              );
              journeyPopover.style.left = `${leftPx}px`;
              journeyPopover.style.right = 'auto';
            } else {
              journeyPopover.style.left = '';
              journeyPopover.style.right = '';
            }
            journeyPopover.classList.remove('is-hidden');
            journeyBtn.classList.add('is-active');
            journeyBtn.setAttribute('aria-expanded', 'true');
          } else {
            closeJourneyPopover();
          }
        });
        document.addEventListener('pointerdown', (e) => {
          if (
            !journeyPopover.classList.contains('is-hidden') &&
            !journeyPopover.contains(e.target) &&
            !journeyBtn.contains(e.target)
          ) {
            closeJourneyPopover();
          }
        });
        journeyPopover.querySelectorAll('.journey-menu-item').forEach((btn) => {
          btn.addEventListener('click', () => {
            closeJourneyPopover();
            if (this.activeJourney && this.activeJourney.key === btn.dataset.journey) {
              this.stopJourney();
            } else {
              this.startJourney(btn.dataset.journey, 0);
            }
          });
        });
      }
      if (layersBtn && layersPopover) {
        layersBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeJourneyPopover();
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
            closeLayersPopover();
          }
        });
        document.addEventListener('pointerdown', (e) => {
          if (
            !layersPopover.classList.contains('is-hidden') &&
            !layersPopover.contains(e.target) &&
            !layersBtn.contains(e.target)
          ) {
            closeLayersPopover();
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
          const cur = this.dynasties[this.dynastyIdx];
          if (cur) this._syncAutoMilestoneBalloon(cur);
        }
        this._rescaleSvgTypography();
      });
      const chkEventCallouts = this._id('chk-event-callouts');
      if (chkEventCallouts) {
        chkEventCallouts.checked = this.showEventCallouts;
        chkEventCallouts.addEventListener('change', (e) => {
          this.toggleEventCallouts(e.target.checked);
        });
      }

      this._id('act-reset-camera').addEventListener('click', () => this.resetCamera());
      const togglePaneBtn = this._id('act-toggle-pane');
      if (togglePaneBtn) {
        togglePaneBtn.addEventListener('click', () => {
          this._paneAutoCollapsed = false;
          this.toggleChroniclePane();
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
      this._id('act-close-genealogy').addEventListener('click', () => {
        if (this.genealogyMode) this.toggleGenealogyMode(false);
        else this.closeGenealogyCard();
      });

      this._id('act-challenge').addEventListener('click', () => {
        if (this.challenge) this.stopChallenge();
        else this.startChallenge();
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

      this._id('act-locale').addEventListener('click', () => {
        this.locale = this.locale === 'en' ? 'zh' : 'en';
        this.applyLocale();
      });

      this._id('act-autoplay').addEventListener('click', () => {
        if (this.playing) this.stopAutoplay();
        else this.startAutoplay();
      });

      this._id('inp-year').addEventListener('change', (e) => {
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
      let scrubbing = false;
      const scrubAt = (clientX) => {
        const r = track.getBoundingClientRect();
        this.jumpToYear(this._progressToYear((clientX - r.left) / r.width));
      };
      track.addEventListener('pointerdown', (e) => {
        if (this.challenge) return;
        this._recordGestureClick();
        this.stopAutoplay();
        scrubbing = true;
        track.setPointerCapture(e.pointerId);
        scrubAt(e.clientX);
      });
      track.addEventListener('pointermove', (e) => {
        if (scrubbing) scrubAt(e.clientX);
      });
      const stopScrub = () => {
        scrubbing = false;
      };
      track.addEventListener('pointerup', stopScrub);
      track.addEventListener('pointercancel', stopScrub);

      // Keyboard navigation
      window.addEventListener('keydown', (e) => {
        if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) && e.target.tagName !== 'INPUT') {
          if (!this.challenge && searchInp) {
            e.preventDefault();
            searchInp.focus();
            searchInp.select();
            return;
          }
        }
        if (e.target.tagName === 'INPUT') return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          if (this.challenge) return;
          e.preventDefault();
          this.stopAutoplay();
          if (this.activeJourney) {
            if (this.journeyTimer) {
              clearInterval(this.journeyTimer);
              this.journeyTimer = null;
            }
            this.stepJourney(e.key === 'ArrowRight' ? 1 : -1);
            return;
          }
          const step = e.shiftKey ? 50 : 10;
          this.jumpToYear(this.year + (e.key === 'ArrowRight' ? step : -step));
        } else if (e.key === 'Home' && !this.challenge) {
          this.jumpToYear(this.minYear);
        } else if (e.key === 'End' && !this.challenge) {
          this.jumpToYear(this.maxYear);
        } else if (e.key === ' ' && !this.challenge) {
          e.preventDefault();
          if (this.activeJourney) {
            this.toggleJourneyAutoplay();
          } else if (this.playing) {
            this.stopAutoplay();
          } else {
            this.startAutoplay();
          }
        } else if (e.key === 'Escape') {
          closeLayersPopover();
          closeJourneyPopover();
          this.closeMilestoneBalloon();
          if (this.mobileChronicleOpen) this.toggleMobileChronicle(false);
          else if (this.activeJourney) this.stopJourney();
          else if (this.genealogyMode) this.toggleGenealogyMode(false);
          else if (!this._id('genealogy-card').classList.contains('is-hidden')) {
            this.closeGenealogyCard();
          }
        }
      });

      // SVG Zoom & Pan (Mouse Wheel + Single-Finger Pan + Two-Finger Pinch Zoom)
      this.svg.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          this._recordGestureMove();
          const [mx, my] = this._clientToSvgPoint(e.clientX, e.clientY);
          const factor = Math.exp(-e.deltaY * 0.0015);
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
            const label = stop.query || stop.name;
            const mod =
              stop.modern && stop.modern !== label ? `（今${stop.modern}）` : '';
            const yr = this.formatYear(stop.year !== undefined ? stop.year : this.year);
            this._showHoverTip(
              e,
              `<b>${sIdx + 1}. ${label}${mod}</b><div class="tt-sub">${yr} · ${
                this.locale === 'en'
                  ? 'Click to jump to this year & trace history'
                  : '点击切换至该年份并查看历代沿革'
              }</div>`
            );
            return;
          }
        } else if (journeyNodeEl && this.activeJourney) {
          const sIdx = Number(journeyNodeEl.dataset.stopIdx);
          const stop = this.activeJourney.stops[sIdx];
          if (stop) {
            const title = this.locale === 'en' ? stop.titleEn : stop.titleZh;
            const place =
              this.locale === 'en'
                ? `${stop.ancientEn} (${stop.modernEn})`
                : `${stop.ancientZh}（今${stop.modernZh}）`;
            const yr = this.formatYear(stop.year);
            this._showHoverTip(
              e,
              `<b>${sIdx + 1}. ${place} · ${title}</b><div class="tt-sub">${yr} · ${
                this.locale === 'en' ? 'Click to jump to this stop' : '点击切换至此行迹节点'
              }</div>`
            );
            return;
          }
        } else if (milestoneEl && !settlementNameEl && mHit) {
          const eraPart = this.locale === 'en' ? '' : ` · ${this.formatEraLabel(mHit.year, cur)}`;
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

          const lines = [];
          if (pref) {
            const pName = this.trTerm(pref.prefTitle);
            const pCat = pref.prefCategory;
            lines.push(
              `<b>${
                this.locale === 'en'
                  ? pName
                  : pName + (pCat && !pName.endsWith(pCat) ? '（' + pCat + '）' : '')
              }</b>`
            );
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
          const journeyNodeEl = findClosest('.journey-node');
          if (journeyNodeEl && journeyNodeEl.dataset.stopIdx !== undefined) {
            if (this.activeCustomRoute) {
              const idx = Number(journeyNodeEl.dataset.stopIdx);
              const st = this.activeCustomRoute[idx];
              if (st) {
                if (st.year !== undefined && st.year !== this.year) {
                  this.jumpToYear(st.year);
                }
                this.openGenealogyAt(st.lng, st.lat, st.query || st.name);
              }
              return;
            }
            if (this.journeyTimer) {
              clearInterval(this.journeyTimer);
              this.journeyTimer = null;
            }
            this.goToJourneyStop(Number(journeyNodeEl.dataset.stopIdx), true);
            return;
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

          if (this.genealogyMode) {
            if (settlementEl && settlementEl.dataset.lng && settlementEl.dataset.lat) {
              this.openGenealogyAt(Number(settlementEl.dataset.lng), Number(settlementEl.dataset.lat));
              return;
            }
            if (milestoneEl && cur) {
              const m = this._resolvePinMilestone(cur, milestoneEl);
              if (m && m.coord) {
                const coCity = this._findCoLocatedSettlement(cur, m.coord[0], m.coord[1], 28);
                const targetCoord = coCity ? coCity.coord : m.coord;
                this.openGenealogyAt(targetCoord[0], targetCoord[1]);
                return;
              }
            }
            const [sx, sy] = this._clientToSvgPoint(e.clientX, e.clientY);
            const [lng, lat] = this.projector.toGeo(sx, sy);
            this.openGenealogyAt(lng, lat);
            return;
          }

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
        }
        this._updateScaleBar();
      });
    }

    _showHoverTip(e, html) {
      const rect = this._id('viewport-frame').getBoundingClientRect();
      this.hoverTip.innerHTML = html;
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
      const raw = place.trim();
      if (!raw) return null;

      // Support fallback syntax like "古名(今名)" or "古名/今名" if passed
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

      const q = raw.toLowerCase();
      const stripped = raw
        .replace(/(?:省|市|州|郡|府|道|路|县|国|关|城|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区)$/, '')
        .trim();
      const qStripped = stripped.length >= 2 ? stripped.toLowerCase() : q;

      const yr = Number.isFinite(Number(year)) ? Number(year) : this.year;
      const targetDynIdx = this._findDynastyIndex(yr);
      const targetDyn = this.dynasties[targetDynIdx] || this.dynasties[0];
      const orderedDynasties = [
        targetDyn,
        ...this.dynasties.filter((d) => d !== targetDyn),
      ];

      // Pass 1 (Exact Match) before Pass 2 (Substring Match) so exact city names (e.g. 西安, 洛阳) never collide with gazetteer substrings
      for (const exact of [true, false]) {
        // 1. Strategic passes (名关雄隘)
        for (const p of HistoricalAtlasController.STRATEGIC_PASSES) {
          const names = [
            p.ancientZh,
            (p.ancientZh || '').replace(/（.*?）|\(.*?\)/g, '').trim(),
            p.modernZh,
            p.ancientEn,
            p.modernEn,
            p.key,
          ]
            .filter(Boolean)
            .map((s) => s.toLowerCase());
          const matched = exact
            ? names.some((n) => n === q || n === qStripped)
            : names.some((n) => n.includes(q) || (q.length >= 2 && q.includes(n)));
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

        // 2. Settlements (preferring target dynasty)
        for (const d of orderedDynasties) {
          for (const s of d.settlements || []) {
            const anc = (s.ancient || '').toLowerCase();
            const mod = (s.modern || '').toLowerCase();
            const cleanAnc = anc.replace(/（.*?）|\(.*?\)/g, '').trim();
            if (exact) {
              if (anc === q || cleanAnc === q || mod === q || cleanAnc === qStripped || mod === qStripped) {
                return {
                  kind: 'city',
                  name: s.ancient,
                  modern: s.modern || '',
                  lng: s.coord[0],
                  lat: s.coord[1],
                  coord: s.coord,
                  zoom: s.tier === 2 ? 2.6 : 2.3,
                };
              }
            } else if (
              anc.includes(q) ||
              mod.includes(q) ||
              (qStripped.length >= 2 && (anc.includes(qStripped) || mod.includes(qStripped)))
            ) {
              return {
                kind: 'city',
                name: s.ancient,
                modern: s.modern || '',
                lng: s.coord[0],
                lat: s.coord[1],
                coord: s.coord,
                zoom: s.tier === 2 ? 2.6 : 2.3,
              };
            }
          }
        }

        // 3. Poetic & Historical Gazetteer (诗词名胜 · 古战场 · 关隘渡口 · 州县别名)
        for (const g of HistoricalAtlasController.PLACE_GAZETTEER) {
          const allNames = [g.name, ...(g.aliases || [])]
            .filter(Boolean)
            .map((s) => s.toLowerCase());
          const matched = exact
            ? allNames.some((n) => n === q || n === qStripped)
            : allNames.some((n) => n.includes(q) || (qStripped.length >= 2 && n.includes(qStripped)));
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
      }

      // 3. Curated Historical Journey stops
      for (const j of HistoricalAtlasController.HISTORICAL_JOURNEYS) {
        for (const st of j.stops || []) {
          const anc = (st.ancientZh || '').toLowerCase();
          const mod = (st.modernZh || '').toLowerCase();
          if (anc === q || mod === q || anc.includes(q) || mod.includes(q)) {
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
          if ((site && (site.includes(q) || q.includes(site))) || head.includes(q)) {
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
        if ((site && (site.includes(q) || q.includes(site))) || zh.includes(q)) {
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
            const isPref = (snap.prefectures || []).includes(item);
            if (exact ? t === q || t === qStripped : t.includes(q) || t.includes(qStripped)) {
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
        if (pt === q || pt.includes(q) || pt.includes(qStripped)) {
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

      return null;
    }

    _inspectCoord(cLng, cLat, d, snap) {
      let polity = null;
      const regions = [];
      const prefectures = [];
      let modernProvince = null;
      let nearestCity = null;

      for (const p of snap.polities || []) {
        if (p.role !== 'neighbor' && MercatorProjector.pointInShape(cLng, cLat, p.shape)) {
          polity = p.title;
          break;
        }
      }
      if (!polity) {
        for (const p of snap.polities || []) {
          if (p.role === 'neighbor' && MercatorProjector.pointInShape(cLng, cLat, p.shape)) {
            polity = p.title;
            break;
          }
        }
      }
      for (const reg of snap.regions || []) {
        if (MercatorProjector.pointInShape(cLng, cLat, reg.shape)) {
          const label =
            reg.title +
            (reg.category && !reg.title.endsWith(reg.category) ? `(${reg.category})` : '');
          if (!regions.includes(label)) regions.push(label);
        }
      }
      for (const pref of snap.prefectures || []) {
        if (MercatorProjector.pointInShape(cLng, cLat, pref.shape)) {
          const label =
            pref.title +
            (pref.category && !pref.title.endsWith(pref.category) ? `(${pref.category})` : '');
          if (!prefectures.includes(label)) prefectures.push(label);
        }
      }
      for (const prov of this.provinces || []) {
        if (String(prov.code).includes('_JD')) continue;
        if (prov.rings.some((poly) => MercatorProjector.pointInPolygonRings(cLng, cLat, poly))) {
          modernProvince = prov.title;
          break;
        }
      }
      let bestKm = 180;
      for (const s of d.settlements || []) {
        const km = this.projector.greatCircleKm([cLng, cLat], s.coord);
        if (km < bestKm) {
          bestKm = km;
          nearestCity = {
            ancient: s.ancient,
            modern: s.modern || '',
            distanceKm: Math.round(km),
          };
        }
      }
      return { polity, regions, prefectures, modernProvince, nearestCity };
    }

    _renderCustomRoute(stops, explicitZoom) {
      if (!this.grpJourney || !Array.isArray(stops) || stops.length < 2) return;
      if (this.activeJourney) this.stopJourney(true);
      this.closeMilestoneBalloon();
      this.closeGenealogyCard();
      this.activeCustomRoute = stops;
      this.grpJourney.innerHTML = '';

      const routeColor = '#9e2a2b';
      const segPaths = [];
      for (let i = 0; i < stops.length - 1; i++) {
        segPaths.push(
          this._buildJourneySegmentSvgPath(stops[i].coord, stops[i + 1].coord)
        );
      }
      const fullPathD = segPaths.join(' ');

      this._svgNode(
        'path',
        { d: fullPathD, class: 'journey-track-bg', 'data-base-sw': '6.2' },
        this.grpJourney
      );
      this._svgNode(
        'path',
        {
          d: fullPathD,
          class: 'journey-track-passed',
          stroke: routeColor,
          'data-base-sw': '3.5',
        },
        this.grpJourney
      );
      this._svgNode(
        'path',
        { d: fullPathD, class: 'journey-track-flow', 'data-base-sw': '1.8' },
        this.grpJourney
      );

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

        const isEndpoint = idx === 0 || idx === stops.length - 1;
        const g = this._svgNode(
          'g',
          {
            class: `journey-node ${isEndpoint ? 'is-current' : 'is-passed'}`,
            'data-x': sx.toFixed(1),
            'data-y': sy.toFixed(1),
            'data-stop-idx': String(idx),
          },
          this.grpJourney
        );
        g.style.color = routeColor;

        if (isEndpoint) {
          this._svgNode('circle', { class: 'jn-pulse', r: 12 }, g);
        }
        this._svgNode('circle', { class: 'jn-disc', r: isEndpoint ? 8.5 : 7.5 }, g);
        const numTxt = this._svgNode('text', { class: 'jn-num', y: '0.5' }, g);
        numTxt.textContent = String(idx + 1);

        let below = false;
        if (prevSx !== null && Math.hypot(sx - prevSx, sy - prevSy) < 90) {
          below = !prevBelow;
        }
        prevSx = sx;
        prevSy = sy;
        prevBelow = below;

        const lblY = below ? '18.5' : '-11.5';
        const lblTxt = this._svgNode('text', { class: 'jn-label', x: '0', y: lblY }, g);
        const baseLbl = st.query || st.name;
        const yrTag = st.year < 0 ? `前${-st.year}` : `${st.year}`;
        lblTxt.textContent = isMultiYear && st.year !== undefined ? `${baseLbl} (${yrTag})` : baseLbl;
      });

      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5;
      const aspect = this._getViewportAspect();
      const hasZoom =
        explicitZoom !== undefined &&
        explicitZoom !== null &&
        explicitZoom !== '' &&
        !Number.isNaN(Number(explicitZoom));
      const spanW = Math.max(maxX - minX + 140, (maxY - minY + 130) / aspect) * 1.25;
      const w = hasZoom
        ? 1000 / Math.max(1, Math.min(8, Number(explicitZoom)))
        : Math.max(260, Math.min(920, spanW));
      const h = w * aspect;
      this.camera = {
        x: Math.max(-140, Math.min(1000 - w + 140, cx - w * 0.5)),
        y: Math.max(-100, Math.min(700 - h + 120, cy - h * 0.5)),
        w,
        h,
        zoom: 1000 / w,
      };
      this._applyCamera(true);
    }

    inspect({ year, place, lng, lat, zoom } = {}) {
      const yearList = this._parseYearList(year);
      const yr = yearList.length ? yearList[0] : this.year;
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
          route.push({
            step: route.length + 1,
            year: tok.year,
            era: this.formatEraLabel(tok.year, sd),
            dynasty: sd.title,
            place: tok.place,
            resolvedName: r.name,
            modern: r.modern || '',
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
          const basePath =
            typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '';
          return {
            year: first.year,
            years: route.map((s) => s.year),
            era: this.formatEraLabel(first.year, d),
            dynasty: {
              key: d.key,
              title: d.title,
              seat: d.seat,
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
      const cLng = hasExplicitCoord ? Number(lng) : resolved ? resolved.lng : null;
      const cLat = hasExplicitCoord ? Number(lat) : resolved ? resolved.lat : null;
      const hasCoord = cLng !== null && cLat !== null;

      const info = hasCoord
        ? this._inspectCoord(cLng, cLat, d, snap)
        : {
            polity: null,
            regions: [],
            prefectures: [],
            modernProvince: null,
            nearestCity: null,
          };

      const targetZoom = Math.max(
        1,
        Math.min(8, Number(zoom) || (resolved && resolved.zoom) || (hasCoord ? 2.5 : this.camera.zoom))
      );
      const placeLabel = singlePlace ? String(singlePlace).trim() : resolved ? resolved.name : '';
      const params = new URLSearchParams();
      params.set('year', String(singleYear));
      if (placeLabel) params.set('place', placeLabel);
      if (hasExplicitCoord) {
        params.set('lng', Number(cLng).toFixed(2));
        params.set('lat', Number(cLat).toFixed(2));
      }
      if (zoom !== undefined) {
        params.set('zoom', Number(targetZoom.toFixed(2)));
      }
      const basePath =
        typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '';

      return {
        year: singleYear,
        era: this.formatEraLabel(singleYear, d),
        dynasty: {
          key: d.key,
          title: d.title,
          seat: d.seat,
          span: [d.fromYear, d.toYear],
        },
        place: placeLabel || null,
        coord: hasCoord ? [Number(cLng.toFixed(4)), Number(cLat.toFixed(4))] : null,
        zoom: Number(targetZoom.toFixed(2)),
        ...info,
        url: `${basePath}?${params.toString()}`,
      };
    }

    locate(opts = {}) {
      const { year, place, lng, lat, zoom } = opts || {};
      if (!this._fullSnapshotsLoaded) {
        this._ensureFullSnapshots().then(() => {
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
            return r ? { query: tok.place, year: tok.year, ...r } : null;
          })
          .filter(Boolean);
        if (stops.length >= 2) {
          this._renderCustomRoute(stops, zoom);
          return this.inspect({ year, place, zoom });
        }
      }

      if (this.activeCustomRoute) {
        this.activeCustomRoute = null;
        if (this.grpJourney && !this.activeJourney) {
          this.grpJourney.innerHTML = '';
        }
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
        const yFrac = isDesktop ? 0.48 : 0.38;
        this.camera = { x: tx - w * xFrac, y: ty - h * yFrac, w, h, zoom: z };
        this._applyCamera();
        this.closeMilestoneBalloon();
        const pinLabel = singlePlace ? String(singlePlace).trim() : resolved ? resolved.name : '';
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
      if (q.has('q')) {
        const rawQ = (q.get('q') || '').trim();
        if (rawQ) {
          const inp = this._id('inp-map-search');
          if (inp) inp.value = rawQ;
          setTimeout(() => {
            const hits = this._queryQuickSearch(rawQ);
            if (hits && hits.length) this._selectSearchResult(hits[0]);
          }, 180);
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
      if (q.has('hover')) {
        const targetPref = q.get('hover');
        setTimeout(() => {
          const el = this.grpPrefectures.querySelector(
            `.prefecture-shape[data-pref-title="${CSS.escape(targetPref)}"]`
          );
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
            const provEl = stack.find((node) => node.dataset && node.dataset.provTitle);
            if (provEl) provName = provEl.dataset.provTitle;
            const pName = this.trTerm(el.dataset.prefTitle);
            const pCat = el.dataset.prefCategory;
            const lines = [
              `<b>${
                this.locale === 'en'
                  ? pName
                  : pName + (pCat && !pName.endsWith(pCat) ? '（' + pCat + '）' : '')
              }</b>`,
            ];
            if (mainPol) {
              lines.push(
                `<div class="tt-sub">${this.uiStr('belongs_to', '属 ')}${this.trTerm(mainPol.title)}</div>`
              );
            }
            if (provName) {
              lines.push(
                `<div class="tt-sub">${this.uiStr('now_prov', '今：')}${this.trTerm(provName)}</div>`
              );
            }
            this._showHoverTip({ clientX: cx, clientY: cy }, lines.join(''));
          }
        }, 250);
      }
      if (q.has('event')) {
        const ey = Number(q.get('event'));
        const cur = this.dynasties[this.dynastyIdx];
        const m = (cur.milestones || []).find((item) => item.year === ey) || (cur.milestones || [])[0];
        if (m) {
          if (m.coord) {
            this.camera.zoom = Math.max(this.camera.zoom, 1.8);
            this.camera.w = 1000 / this.camera.zoom;
            this.camera.h = 700 / this.camera.zoom;
            this._panToward(m.coord[0], m.coord[1]);
          }
          setTimeout(() => this.openMilestoneBalloon(cur, m), 350);
        }
      }
      if (q.has('quiz')) {
        this._paneAutoCollapsed = true;
        this.toggleChroniclePane(true);
        const mode = q.get('quiz') === 'match' ? 'match' : 'locate';
        setTimeout(() => this.startChallenge(mode), 120);
      }
      if (q.has('journey')) {
        this._paneAutoCollapsed = true;
        this.toggleChroniclePane(true);
        const jKey = q.get('journey');
        const stopIdx = q.has('stop') ? Number(q.get('stop')) : 0;
        setTimeout(() => this.startJourney(jKey, Number.isNaN(stopIdx) ? 0 : stopIdx), 120);
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

  window.HistoricalAtlasController = HistoricalAtlasController;
  window.addEventListener('DOMContentLoaded', () => {
    const app = new HistoricalAtlasController();
    window.atlasApp = app;
    window.atlasAPI = {
      locate: (opts) => app.locate(opts),
      resolvePlace: (place, year) => app.resolvePlace(place, year),
      inspect: (opts) => app.inspect(opts),
    };
  });
})();
