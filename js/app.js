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

    multiRingsToSvgPath(polygons) {
      return polygons.map((poly) => poly.map((r) => this.ringToSvgPath(r)).join('')).join('');
    }

    shapeToSvgPath(shapeObj) {
      if (!shapeObj) return '';
      if (shapeObj._svgPath !== undefined) return shapeObj._svgPath;
      let d = '';
      if (shapeObj.type === 'Polygon') {
        d = shapeObj.coordinates.map((r) => this.ringToSvgPath(r)).join('');
      } else if (shapeObj.type === 'MultiPolygon') {
        d = shapeObj.coordinates
          .map((poly) => poly.map((r) => this.ringToSvgPath(r)).join(''))
          .join('');
      }
      Object.defineProperty(shapeObj, '_svgPath', {
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
      for (const k of Object.keys(this.snapshots)) {
        const s = this.snapshots[k];
        if (s && s.prefRef && !s.prefectures && this.snapshots[s.prefRef]) {
          s.prefectures = this.snapshots[s.prefRef].prefectures || [];
        }
        if (s && s.regionRef && !s.regions && this.snapshots[s.regionRef]) {
          s.regions = this.snapshots[s.regionRef].regions || [];
        }
      }
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
      this.ghostTimer = null;

      this.camera = this._getDefaultCamera();
      this.flyRaf = null;
      this.dragState = null;
      this.didPan = false;
      this.snapshotCache = {};

      this._bindDom();
      this._applyCamera();
      this._buildTerrainRivers();
      this._buildModernProvinces();
      this._buildNeighborCountries();
      this._buildScrubberBands();
      this._attachListeners();
      this.applyLocale();

      this.jumpToYear(this.dynasties[0].focusYear);
      this._restoreFromQuery();
    }

    _getDefaultCamera() {
      if (typeof window !== 'undefined' && window.innerWidth <= 900) {
        return { x: 420, y: 220, w: 360, h: 435, zoom: 1000 / 360 };
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

    _enDict(text) {
      if (!text) return '';
      return (this.enLocale.dict && this.enLocale.dict[text]) || text;
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
      return this.trTerm(m.site);
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
      return [
        [-221, '秦始皇', 26], [-209, '秦二世'], [-206, '汉高帝'], [-194, '西汉惠帝'], [-187, '西汉高后'],
        [-179, '西汉文帝前元'], [-163, '西汉文帝后元'], [-156, '西汉景帝前元'], [-149, '西汉景帝中元'], [-143, '西汉景帝后元'],
        [-140, '西汉建元'], [-134, '西汉元光'], [-128, '西汉元朔'], [-122, '西汉元狩'], [-116, '西汉元鼎'], [-110, '西汉元封'],
        [-104, '西汉太初'], [-100, '西汉天汉'], [-96, '西汉太始'], [-92, '西汉征和'], [-88, '西汉后元'],
        [-86, '西汉始元'], [-80, '西汉元凤'], [-74, '西汉元平'], [-73, '西汉本始'], [-69, '西汉地节'], [-65, '西汉元康'],
        [-61, '西汉神爵'], [-57, '西汉五凤'], [-53, '西汉甘露'], [-49, '西汉黄龙'], [-48, '西汉初元'], [-43, '西汉永光'],
        [-38, '西汉建昭'], [-33, '西汉竟宁'], [-32, '西汉建始'], [-28, '西汉河平'], [-24, '西汉阳朔'], [-20, '西汉鸿嘉'],
        [-16, '西汉永始'], [-12, '西汉元延'], [-8, '西汉绥和'], [-6, '西汉建平'], [-2, '西汉元寿'],
        [1, '西汉元始'], [6, '西汉居摄'], [8, '西汉初始'], [9, '新莽始建国'], [14, '新莽天凤'], [20, '新莽地皇'], [23, '汉更始'],
        [25, '东汉建武'], [56, '东汉建武中元'], [58, '东汉永平'], [76, '东汉建初'], [84, '东汉元和'], [87, '东汉章和'],
        [89, '东汉永元'], [105, '东汉元兴'], [106, '东汉延平'], [107, '东汉永初'], [114, '东汉元初'], [120, '东汉永宁'],
        [121, '东汉建光'], [122, '东汉延光'], [126, '东汉永建'], [132, '东汉阳嘉'], [136, '东汉永和'], [142, '东汉汉安'],
        [144, '东汉建康'], [145, '东汉永憙'], [146, '东汉本初'], [147, '东汉建和'], [150, '东汉和平'], [151, '东汉元嘉'],
        [153, '东汉永兴'], [155, '东汉永寿'], [158, '东汉延熹'], [167, '东汉永康'], [168, '东汉建宁'], [172, '东汉熹平'],
        [178, '东汉光和'], [184, '东汉中平'], [190, '东汉初平'], [194, '东汉兴平'], [196, '东汉建安'],
        [220, '魏黄初'], [227, '魏太和'], [233, '魏青龙'], [237, '魏景初'], [240, '魏正始'], [249, '魏嘉平'],
        [254, '魏正元'], [256, '魏甘露'], [260, '魏景元'], [264, '魏咸熙'],
        [265, '西晋泰始'], [275, '西晋咸宁'], [280, '西晋太康'], [290, '西晋永熙'], [291, '西晋元康'], [300, '西晋永康'],
        [301, '西晋永宁'], [302, '西晋太安'], [304, '西晋永兴'], [306, '西晋光熙'], [307, '西晋永嘉'], [313, '西晋建兴'],
        [317, '东晋建武'], [318, '东晋太兴'], [322, '东晋永昌'], [323, '东晋太宁'], [326, '东晋咸和'], [335, '东晋咸康'],
        [343, '东晋建元'], [345, '东晋永和'], [357, '东晋升平'], [362, '东晋隆和'], [363, '东晋兴宁'], [366, '东晋太和'],
        [371, '东晋咸安'], [373, '东晋宁康'], [376, '东晋太元'], [397, '东晋隆安'], [402, '东晋元兴'], [405, '东晋义熙'], [419, '东晋元熙'],
        [420, '南朝宋永初'], [423, '南朝宋景平'], [424, '南朝宋元嘉'], [454, '南朝宋孝建'], [457, '南朝宋大明'],
        [465, '南朝宋泰始'], [472, '南朝宋泰豫'], [473, '南朝宋元徽'], [477, '北魏太和'], [500, '北魏景明'],
        [502, '南朝梁天监'], [520, '南朝梁普通'], [527, '南朝梁大通'], [529, '南朝梁中大通'], [535, '南朝梁大同'],
        [546, '南朝梁中大同'], [547, '南朝梁太清'], [550, '北齐天保'], [557, '南朝陈永定'], [560, '南朝陈天嘉'],
        [566, '北周天和'], [569, '南朝陈太建'], [572, '北周建德'], [579, '北周大象'],
        [581, '隋开皇'], [601, '隋仁寿'], [605, '隋大业'], [617, '隋义宁'],
        [618, '唐武德'], [627, '唐贞观'], [650, '唐永徽'], [656, '唐显庆'], [661, '唐龙朔'], [664, '唐麟德'],
        [666, '唐乾封'], [668, '唐总章'], [670, '唐咸亨'], [674, '唐上元'], [676, '唐仪凤'], [679, '唐调露'],
        [680, '唐永隆'], [681, '唐开耀'], [682, '唐永淳'], [683, '唐弘道'], [684, '唐嗣圣'], [685, '唐垂拱'],
        [689, '唐永昌'], [690, '武周天授'], [692, '武周长寿'], [694, '武周延载'], [695, '武周天册万岁'],
        [696, '武周万岁通天'], [697, '武周神功'], [698, '武周圣历'], [700, '武周久视'], [701, '武周长安'],
        [705, '唐神龙'], [707, '唐景龙'], [710, '唐景云'], [712, '唐太极'], [713, '唐开元'], [742, '唐天宝'],
        [756, '唐至德'], [758, '唐乾元'], [760, '唐上元'], [762, '唐宝应'], [763, '唐广德'], [765, '唐永泰'],
        [766, '唐大历'], [780, '唐建中'], [784, '唐兴元'], [785, '唐贞元'], [805, '唐永贞'], [806, '唐元和'],
        [821, '唐长庆'], [825, '唐宝历'], [827, '唐大和'], [836, '唐开成'], [841, '唐会昌'], [847, '唐大中'],
        [860, '唐咸通'], [874, '唐乾符'], [880, '唐广明'], [881, '唐中和'], [885, '唐光启'], [888, '唐文德'],
        [889, '唐龙纪'], [890, '唐大顺'], [892, '唐景福'], [894, '唐乾宁'], [898, '唐光化'], [901, '唐天复'], [904, '唐天祐'],
        [907, '后梁开平'], [911, '后梁乾化'], [915, '后梁贞明'], [921, '后梁龙德'],
        [923, '后唐同光'], [926, '后唐天成'], [930, '后唐长兴'], [934, '后唐清泰'],
        [936, '后晋天福'], [944, '后晋开运'], [947, '后汉天福', 12], [948, '后汉乾祐'],
        [951, '后周广顺'], [954, '后周显德'],
        [960, '北宋建隆'], [963, '北宋乾德'], [968, '北宋开宝'], [976, '北宋太平兴国'], [984, '北宋雍熙'],
        [988, '北宋端拱'], [990, '北宋淳化'], [995, '北宋至道'], [998, '北宋咸平'], [1004, '北宋景德'],
        [1008, '北宋大中祥符'], [1017, '北宋天禧'], [1022, '北宋乾兴'], [1023, '北宋天圣'], [1032, '北宋明道'],
        [1034, '北宋景祐'], [1038, '北宋宝元'], [1040, '北宋康定'], [1041, '北宋庆历'], [1049, '北宋皇祐'],
        [1054, '北宋至和'], [1056, '北宋嘉祐'], [1064, '北宋治平'], [1068, '北宋熙宁'], [1078, '北宋元丰'],
        [1086, '北宋元祐'], [1094, '北宋绍圣'], [1098, '北宋元符'], [1101, '北宋建中靖国'], [1102, '北宋崇宁'],
        [1107, '北宋大观'], [1111, '北宋政和'], [1118, '北宋重和'], [1119, '北宋宣和'], [1126, '北宋靖康'],
        [1127, '南宋建炎'], [1131, '南宋绍兴'], [1163, '南宋隆兴'], [1165, '南宋乾道'], [1174, '南宋淳熙'],
        [1190, '南宋绍熙'], [1195, '南宋庆元'], [1201, '南宋嘉泰'], [1205, '南宋开禧'], [1208, '南宋嘉定'],
        [1225, '南宋宝庆'], [1228, '南宋绍定'], [1234, '南宋端平'], [1237, '南宋嘉熙'], [1241, '南宋淳祐'],
        [1253, '南宋宝祐'], [1259, '南宋开庆'], [1260, '南宋景定'], [1265, '南宋咸淳'], [1275, '南宋德祐'],
        [1276, '南宋景炎'], [1278, '南宋祥兴'],
        [1279, '元至元', 16], [1295, '元元贞'], [1297, '元大德'], [1308, '元至大'], [1312, '元皇庆'],
        [1314, '元延祐'], [1321, '元至治'], [1324, '元泰定'], [1328, '元天历'], [1330, '元至顺'],
        [1333, '元元统'], [1335, '元至元'], [1341, '元至正'],
        [1368, '明洪武'], [1399, '明建文'], [1403, '明永乐'], [1425, '明洪熙'], [1426, '明宣德'],
        [1436, '明正统'], [1450, '明景泰'], [1457, '明天顺'], [1465, '明成化'], [1488, '明弘治'],
        [1506, '明正德'], [1522, '明嘉靖'], [1567, '明隆庆'], [1573, '明万历'], [1620, '明泰昌'],
        [1621, '明天启'], [1628, '明崇祯'],
        [1644, '清顺治'], [1662, '清康熙'], [1723, '清雍正'], [1736, '清乾隆'], [1796, '清嘉庆'],
        [1821, '清道光'], [1851, '清咸丰'], [1862, '清同治'], [1875, '清光绪'], [1909, '清宣统'],
        [1912, '民国']
      ];
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
      document.documentElement.lang = this.locale === 'en' ? 'en' : 'zh-CN';
      document.title = this.uiStr('title', '江山时序 · 中国历史地图时间轴');

      this._id('txt-seal').textContent = this.uiStr('brand_seal', '江山时序');
      this._id('txt-subtitle').textContent = this.uiStr('brand_sub', '中国历史地图 · 秦 → 今');
      const lblLayersBtn = this._id('lbl-layers-btn');
      if (lblLayersBtn) {
        lblLayersBtn.textContent = this.uiStr('btn_layers', '图层');
      }
      const actLayersBtn = this._id('act-layers-menu');
      if (actLayersBtn) {
        actLayersBtn.title =
          this.locale === 'en' ? 'Toggle map layers' : '展开或收起地图图层开关';
      }
      const lblTerrain = this._id('lbl-terrain');
      if (lblTerrain) {
        lblTerrain.textContent = this.uiStr('btn_terrain', '山川地形');
      }
      const actTerrain = this._id('act-terrain');
      if (actTerrain) {
        actTerrain.title =
          this.locale === 'en'
            ? 'Toggle shaded relief terrain & rivers'
            : '切换山川地形与江河水系底图';
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
      const grpJrn = this._id('txt-layer-grp-journey');
      if (grpJrn) {
        grpJrn.textContent =
          this.locale === 'en' ? 'Historical Journeys' : '青史行迹 · 时空巡礼';
      }
      const btnZq = this._id('btn-j-zhangqian');
      if (btnZq) {
        btnZq.textContent = this.locale === 'en' ? "Zhang Qian's Envoy" : '张骞通西域';
      }
      const btnXz = this._id('btn-j-xuanzang');
      if (btnXz) {
        btnXz.textContent = this.locale === 'en' ? "Xuanzang's Pilgrimage" : '玄奘西行';
      }
      const btnSs = this._id('btn-j-sushi');
      if (btnSs) {
        btnSs.textContent = this.locale === 'en' ? "Su Shi's Exile" : '苏轼贬谪路线';
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
      const lblGen = this._id('lbl-genealogy') || this._id('act-genealogy');
      if (lblGen) {
        lblGen.textContent = this.genealogyMode
          ? this.uiStr('btn_trace_active', '退出溯源')
          : this.uiStr('btn_trace', '点地溯源');
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
        '滚轮缩放 · 拖拽平移 · 点击城名或双击任意处查沿革 · ← → 调整年份 · 空格播放'
      );
      this._id('txt-seat-label').textContent = this.uiStr('capital_k', '都城');
      this._id('txt-milestones-heading').textContent = this.uiStr('events_h', '重大事件');
      this._id('txt-disclaimer').textContent = this.uiStr(
        'caveat',
        '疆域轮廓与州郡政区为示意性近似，用于直观对比各时期大致范围，非精确历史测绘边界。'
      );
      this._id('txt-year-suffix').textContent = this.uiStr('year_unit', '年');
      this._id('txt-genealogy-kicker').textContent = this.uiStr(
        'trace_kicker',
        '点地溯源 · 古今政区沿革'
      );
      this._id('tab-locate').textContent = this.uiStr('mode_locate', '地图寻址');
      this._id('tab-match').textContent = this.uiStr('mode_match', '古今对号');
      const searchInp = this._id('inp-map-search');
      if (searchInp) {
        searchInp.placeholder =
          this.locale === 'en'
            ? 'Search city / prefecture / era / journey ( / )'
            : '搜古今地名 / 州府 / 年号 / 青史行迹 ( / )';
      }
      const togglePaneBtn = this._id('act-toggle-pane');
      if (togglePaneBtn) {
        togglePaneBtn.title = this.paneCollapsed
          ? this.locale === 'en'
            ? 'Expand chronicle pane'
            : '展开编年侧栏'
          : this.locale === 'en'
            ? 'Collapse chronicle pane (Full-map view)'
            : '收起编年侧栏（全屏看图）';
      }

      this.grpProvNames.querySelectorAll('.province-caption').forEach((node) => {
        if (node.dataset.rawName) node.textContent = this.trTerm(node.dataset.rawName);
      });
      this.grpNeighbors.querySelectorAll('.neighbor-caption').forEach((node) => {
        if (node.dataset.rawName) node.textContent = this.trTerm(node.dataset.rawName);
      });

      this._refreshBandLabels();
      this._updateScaleBar();
      this.activeSettlementMask = null;
      this.activeCorridorMask = null;

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
    _buildTerrainRivers() {
      if (!this.grpRivers || !this.hydroData) return;
      this.grpRivers.innerHTML = '';
      for (const riv of this.hydroData.rivers || []) {
        let d = '';
        for (const line of riv.lines || []) {
          for (let i = 0; i < line.length; i++) {
            const [px, py] = this.projector.toScreen(line[i][0], line[i][1]);
            d += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1);
          }
        }
        if (!d) continue;
        const rankCls =
          riv.rank <= 3 ? 'rank-major' : riv.rank <= 5 ? 'rank-med' : 'rank-minor';
        this._svgNode(
          'path',
          { d, class: `hydro-river ${rankCls}` },
          this.grpRivers
        );
      }
      for (const lk of this.hydroData.lakes || []) {
        const d = (lk.rings || []).map((r) => this.projector.ringToSvgPath(r)).join('');
        if (!d) continue;
        this._svgNode('path', { d, class: 'hydro-lake' }, this.grpRivers);
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
          { d: this.projector.shapeToSvgPath(item.shape), class: 'neighbor-shape' },
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
      if (!this.snapshotCache[snapKey]) {
        const embedded = this.snapshots && this.snapshots[snapKey];
        this.snapshotCache[snapKey] = Promise.resolve(
          embedded || { polities: [], prefectures: [], regions: [], note: '', caption: '' }
        );
      }
      return this.snapshotCache[snapKey];
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
      return (dynasty.settlements || [])
        .map((item) =>
          (item.appear !== undefined && year < item.appear) ||
          (item.vanish !== undefined && year > item.vanish)
            ? '0'
            : '1'
        )
        .join('');
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
            (item.vanish === undefined || this.year <= item.vanish)
        )
        .sort((a, b) => {
          const rank = (s) => (s.isCapital ? 2 : s.tier === 2 ? 0 : 1);
          return rank(a) - rank(b);
        });

      for (const item of activeList) {
        const [x, y] = this.projector.toScreen(item.coord[0], item.coord[1]);
        const isTier2 = item.tier === 2 && !item.isCapital;
        const cls = item.isCapital
          ? 'settlement-node is-capital'
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
        nameEl.textContent = this.trTerm(item.ancient);
      }
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
          (s.vanish !== undefined && this.year > s.vanish)
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
      if (this.activeMilestone && this.activeMilestone.dynastyKey === dynasty.key) {
        this._positionMilestoneBalloon();
      } else {
        this.closeMilestoneBalloon();
      }
    }

    _activeMilestoneIndex(dynasty) {
      if (
        this.activeMilestone &&
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
        pin.classList.toggle('is-future', effY > this.year && idx !== activeIdx);
        pin.classList.toggle('is-past', effY <= this.year && idx !== activeIdx);
        pin.classList.toggle('is-current', idx === activeIdx);
        if (idx === activeIdx) currentPin = pin;
      });
      if (currentPin && currentPin.parentNode) {
        currentPin.parentNode.appendChild(currentPin);
      }
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

    openMilestoneBalloon(dynasty, m) {
      if (this.hoverTip) {
        this.hoverTip.classList.add('is-hidden');
        this.hoverTip.classList.remove('is-interactive');
      }
      if (
        typeof window !== 'undefined' &&
        window.innerWidth <= 900 &&
        !this._id('genealogy-card').classList.contains('is-hidden')
      ) {
        this.closeGenealogyCard();
      }
      const mIdx = (dynasty.milestones || []).indexOf(m);
      this.activeMilestone = {
        dynastyKey: dynasty.key,
        milestone: m,
        idx: mIdx,
        year: this.year,
      };
      this.grpMilestones.querySelectorAll('.milestone-pin').forEach((n) => {
        n.classList.toggle('is-active', Number(n.dataset.idx) === mIdx);
      });
      this._highlightCurrentMilestone(dynasty);
      this._updateMilestoneStates(dynasty);
      if (!m.coord) {
        this.milestoneBalloon.classList.add('is-hidden');
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
      const jKey = this._journeyKeyForMilestone(dynasty, m);
      const jBtnHtml = jKey
        ? `<button type="button" class="ev-journey-btn" data-journey="${jKey}">${this.locale === 'en' ? 'View Route' : '展阅行迹'}</button>`
        : '';
      this.milestoneBalloon.innerHTML =
        `<div><span class="ep-year">${yrText} · ${this.formatEraLabel(m.year, dynasty)}</span>${placeHtml}</div>` +
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
      const jBtn = this.milestoneBalloon.querySelector('.ev-journey-btn');
      if (jBtn) {
        jBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.startJourney(jBtn.dataset.journey);
        });
      }
      this.milestoneBalloon.classList.remove('is-hidden');
      this._positionMilestoneBalloon();
    }

    _journeyKeyForMilestone(dynasty, m) {
      if (!dynasty || !m) return null;
      if (dynasty.key === 'xihan' && m.year === -138) return 'zhangqian';
      if (dynasty.key === 'tang' && m.year === 629) return 'xuanzang';
      if (dynasty.key === 'beisong' && m.year === 1080) return 'sushi';
      return null;
    }

    _positionMilestoneBalloon() {
      if (!this.activeMilestone || !this.activeMilestone.milestone.coord) return;
      const [sx, sy] = this.projector.toScreen(
        this.activeMilestone.milestone.coord[0],
        this.activeMilestone.milestone.coord[1]
      );
      const rect = this.svg.getBoundingClientRect();
      const scale = Math.min(rect.width / this.camera.w, rect.height / this.camera.h);
      const padX = (rect.width - this.camera.w * scale) * 0.5;
      const padY = (rect.height - this.camera.h * scale) * 0.5;
      const px = padX + (sx - this.camera.x) * scale;
      const py = padY + (sy - this.camera.y) * scale;
      const genCard = this._id('genealogy-card');
      const genOpen =
        genCard &&
        !genCard.classList.contains('is-hidden') &&
        typeof window !== 'undefined' &&
        window.innerWidth > 900;
      const bW = this.milestoneBalloon.offsetWidth || 260;
      const bH = this.milestoneBalloon.offsetHeight || 62;
      const rightLimit = genOpen ? rect.width - 360 - bW : rect.width - bW - 12;
      let left = px + 12;
      let top = py - 24;
      if (left > rightLimit) {
        left = Math.max(12, Math.min(rightLimit, px - bW * 0.5));
        top = py - bH - 16 >= 12 ? py - bH - 16 : Math.min(rect.height - 90, py + 18);
      } else {
        left = Math.max(12, Math.min(rightLimit, left));
        top = Math.max(12, Math.min(rect.height - 90, top));
      }
      this.milestoneBalloon.style.left = `${left}px`;
      this.milestoneBalloon.style.top = `${top}px`;
    }

    closeMilestoneBalloon() {
      this.activeMilestone = null;
      this.milestoneBalloon.classList.add('is-hidden');
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

        const btns = document.createElement('div');
        btns.className = 'key-phase-btns';
        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'phase-nav-btn';
        prevBtn.textContent = '‹';
        prevBtn.disabled = pIdx <= 0;
        prevBtn.title = this.locale === 'en' ? 'Previous Stage' : '上一版图阶段';
        prevBtn.addEventListener('pointerenter', (e) => {
          if (e.pointerType !== 'touch' && pIdx > 0) this._previewStageGhost(phases[pIdx - 1].snap);
        });
        prevBtn.addEventListener('pointerleave', (e) => {
          if (e.pointerType !== 'touch' && this.grpGhostDiff) this.grpGhostDiff.innerHTML = '';
        });
        prevBtn.addEventListener('click', () => {
          if (pIdx > 0) {
            this.stopAutoplay();
            this.jumpToYear(phaseStart(pIdx - 1));
          }
        });
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'phase-nav-btn';
        nextBtn.textContent = '›';
        nextBtn.disabled = pIdx >= phases.length - 1;
        nextBtn.title = this.locale === 'en' ? 'Next Stage' : '下一版图阶段';
        nextBtn.addEventListener('pointerenter', (e) => {
          if (e.pointerType !== 'touch' && pIdx < phases.length - 1) {
            this._previewStageGhost(phases[pIdx + 1].snap);
          }
        });
        nextBtn.addEventListener('pointerleave', (e) => {
          if (e.pointerType !== 'touch' && this.grpGhostDiff) this.grpGhostDiff.innerHTML = '';
        });
        nextBtn.addEventListener('click', () => {
          if (pIdx < phases.length - 1) {
            this.stopAutoplay();
            this.jumpToYear(phaseStart(pIdx + 1));
          }
        });
        btns.appendChild(prevBtn);
        btns.appendChild(nextBtn);
        bar.appendChild(btns);
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
        sw.style.background =
          'repeating-linear-gradient(125deg, rgba(43,38,34,0.28) 0 2px, transparent 2px 5px)';
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
        if (activeKinds.size) {
          const row = document.createElement('div');
          row.className = 'key-grid key-corridors-grid';
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
    _renderChroniclePane(dynasty) {
      this._id('dynasty-title').textContent = this.dynastyName(dynasty);
      this._id('dynasty-span').textContent = this.formatSpan(dynasty);
      this._id('dynasty-seat').textContent = this.dynastySeat(dynasty);
      this._id('dynasty-summary').textContent = this.dynastySummary(dynasty);

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
        const isMapChange = snapShift || cityShift || corrShift;
        const yrLabel =
          this.locale === 'en'
            ? this.formatYear(m.year)
            : `${m.year <= 0 ? '前' + -m.year : m.year} 年`;
        const badge = isMapChange
          ? `<span class="ev-map-tag" title="${this.locale === 'en' ? 'Map territory / layer changes at this year' : '此节点触发版图或城池/路线变化'}">${SVG_ICONS.mapChange}</span>`
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
      if (this.genealogyMode && this.challenge) {
        this.stopChallenge();
      }
      if (this.genealogyMode && this.activeJourney) {
        this.stopJourney();
      }
      const actGen = this._id('act-genealogy');
      if (actGen) {
        actGen.classList.toggle('is-active', this.genealogyMode);
      }
      const lblEl = this._id('lbl-genealogy') || actGen;
      if (lblEl) {
        lblEl.textContent = this.genealogyMode
          ? this.uiStr('btn_trace_active', '退出溯源')
          : this.uiStr('btn_trace', '点地溯源');
      }
      this.svg.classList.toggle('is-crosshair', this.genealogyMode || Boolean(this.challenge));
      if (!this.genealogyMode && !this._id('genealogy-card').classList.contains('is-hidden')) {
        this.closeGenealogyCard();
      }
    }

    closeGenealogyCard() {
      this.activeTrace = null;
      this._id('genealogy-card').classList.add('is-hidden');
      this.grpGenealogy.innerHTML = '';
      if (this.activeMilestone) this._positionMilestoneBalloon();
    }

    static get PLACE_LANDMARK_EVENTS() {
      return [
        // 长安 / 咸阳 / 西安
        { dynastyKey: 'qin', year: -221, coord: [108.71, 34.33], site: '咸阳', siteEn: 'Xianyang', zh: '秦始皇统一六国定都咸阳，收天下兵器铸十二金人', en: 'Qin Shi Huang unifies China with Xianyang as imperial capital' },
        { dynastyKey: 'qin', year: -206, coord: [109.21, 34.37], site: '咸阳·鸿门', siteEn: 'Xianyang / Hongmen', zh: '刘邦入关破咸阳约法三章；项羽于鸿门设宴', en: 'Liu Bang enters Xianyang; Xiang Yu hosts the Feast at Hongmen' },
        { dynastyKey: 'xihan', year: -200, coord: [108.94, 34.26], site: '长安', siteEn: "Chang'an", zh: '萧何营建未央宫成，汉高祖自栎阳正式定都长安', en: "Xiao He completes Weiyang Palace; Chang'an becomes Western Han capital" },
        { dynastyKey: 'xihan', year: 8, coord: [108.94, 34.26], site: '长安', siteEn: "Chang'an", zh: '王莽于长安篡汉建立新朝，推行王田私属改制', en: "Wang Mang usurps the Han throne in Chang'an and founds the Xin Dynasty" },
        { dynastyKey: 'donghan', year: 190, coord: [108.94, 34.26], site: '长安', siteEn: "Chang'an", zh: '董卓焚洛阳挟汉献帝西迁长安', en: "Dong Zhuo forcibly relocates Emperor Xian to Chang'an" },
        { dynastyKey: 'sanguo', year: 228, coord: [108.94, 34.26], site: '长安', siteEn: "Chang'an", zh: '诸葛亮北伐出祁山震动关中，魏明帝亲镇长安督师', en: "Zhuge Liang launches his First Northern Expedition; Emperor Ming of Wei commands defense from Chang'an" },
        { dynastyKey: 'xijin', year: 316, coord: [108.94, 34.26], site: '长安', siteEn: "Chang'an", zh: '刘曜攻陷长安，晋愍帝出降，西晋灭亡', en: "Liu Yao captures Chang'an; Emperor Min surrenders, ending the Western Jin" },
        { dynastyKey: 'nanbeichao', year: 351, coord: [108.94, 34.26], site: '长安', siteEn: "Chang'an", zh: '前秦定都长安，苻坚、王猛励精图治统一北方', en: "Former Qin governs from Chang'an and unifies northern China under Fu Jian and Wang Meng" },
        { dynastyKey: 'nanbeichao', year: 534, coord: [108.94, 34.26], site: '长安', siteEn: "Chang'an", zh: '宇文泰于长安立西魏，开创关陇集团与北周基业', en: "Yuwen Tai establishes Western Wei at Chang'an, laying the foundation for Sui and Tang" },
        { dynastyKey: 'sui', year: 582, coord: [108.94, 34.26], site: '大兴（长安）', siteEn: "Daxing (Chang'an)", zh: '隋文帝诏宇文恺于龙首原南营建大兴城（唐长安前身）', en: "Emperor Wen of Sui commissions Yuwen Kai to build Daxing City (Tang Chang'an)" },
        { dynastyKey: 'tang', year: 618, coord: [108.94, 34.26], site: '长安', siteEn: "Chang'an", zh: '李渊于长安太极殿称帝建唐，改大兴为长安', en: "Li Yuan proclaims the Tang Dynasty at Taiji Palace in Chang'an" },
        { dynastyKey: 'tang', year: 626, coord: [108.94, 34.26], site: '长安', siteEn: "Chang'an", zh: '玄武门之变，李世民即位为唐太宗，次年改元贞观', en: "Xuanwu Gate Incident in Chang'an; Li Shimin ascends as Emperor Taizong" },
        { dynastyKey: 'tang', year: 756, coord: [108.94, 34.26], site: '长安', siteEn: "Chang'an", zh: '安史叛军破潼关陷长安；次年郭子仪率唐军收复西京', en: "An Lushan rebels capture Chang'an; Guo Ziyi recaptures the capital in 757" },
        { dynastyKey: 'tang', year: 881, coord: [108.94, 34.26], site: '长安', siteEn: "Chang'an", zh: '黄巢起义军攻占长安称齐帝，唐僖宗奔蜀', en: "Huang Chao captures Chang'an and proclaims the Qi regime" },
        { dynastyKey: 'ming', year: 1369, coord: [108.94, 34.26], site: '西安府', siteEn: "Xi'an", zh: '徐达克奉元路，明廷改置西安府，始定“西安”之名', en: "Ming general Xu Da captures Fengyuan and renames the prefecture Xi'an" },
        { dynastyKey: 'ming', year: 1643, coord: [108.94, 34.26], site: '西安', siteEn: "Xi'an", zh: '李自成攻克西安，次年正月于西安建国号大顺', en: "Li Zicheng captures Xi'an and proclaims the Dashun Dynasty" },
        { dynastyKey: 'roc', year: 1936, coord: [108.94, 34.26], site: '西安', siteEn: "Xi'an", zh: '张学良、杨虎城发动西安事变，促成抗日民族统一战线', en: "Xi'an Incident sparks the Second United Front against Japanese aggression" },

        // 洛阳
        { dynastyKey: 'donghan', year: 25, coord: [112.45, 34.62], site: '洛阳', siteEn: 'Luoyang', zh: '刘秀建立东汉定都洛阳，开启光武中兴', en: 'Liu Xiu establishes the Eastern Han with Luoyang as imperial capital' },
        { dynastyKey: 'donghan', year: 68, coord: [112.45, 34.62], site: '洛阳', siteEn: 'Luoyang', zh: '汉明帝于洛阳创建白马寺，为中国第一古刹', en: 'Emperor Ming of Han establishes White Horse Temple in Luoyang' },
        { dynastyKey: 'sanguo', year: 220, coord: [112.45, 34.62], site: '洛阳', siteEn: 'Luoyang', zh: '曹丕代汉称帝建立曹魏，定都洛阳', en: 'Cao Pi founds Cao Wei with Luoyang as capital' },
        { dynastyKey: 'xijin', year: 265, coord: [112.45, 34.62], site: '洛阳', siteEn: 'Luoyang', zh: '司马炎代魏建立西晋定都洛阳，280年灭吴一统', en: 'Sima Yan founds the Western Jin in Luoyang and reunifies China in 280' },
        { dynastyKey: 'xijin', year: 311, coord: [112.45, 34.62], site: '洛阳', siteEn: 'Luoyang', zh: '永嘉之乱：汉赵攻陷洛阳掳晋怀帝，衣冠南渡', en: 'Disaster of Yongjia: sack of Luoyang triggers the southward migration' },
        { dynastyKey: 'nanbeichao', year: 493, coord: [112.45, 34.62], site: '洛阳', siteEn: 'Luoyang', zh: '北魏孝文帝自平城迁都洛阳，推行汉化并开凿龙门石窟', en: 'Emperor Xiaowen of Northern Wei moves the capital to Luoyang and initiates Longmen Grottoes' },
        { dynastyKey: 'sui', year: 605, coord: [112.45, 34.62], site: '东都洛阳', siteEn: 'Luoyang', zh: '隋炀帝营建东都洛阳，以洛阳为中心开凿通济渠与永济渠', en: 'Emperor Yang of Sui builds the Eastern Capital Luoyang and launches the Grand Canal' },
        { dynastyKey: 'tang', year: 690, coord: [112.45, 34.62], site: '神都洛阳', siteEn: 'Luoyang', zh: '武则天改唐为周，定都神都洛阳', en: 'Wu Zetian proclaims the Zhou Dynasty with Luoyang as the Divine Capital' },
        { dynastyKey: 'wudai', year: 923, coord: [112.45, 34.62], site: '洛阳', siteEn: 'Luoyang', zh: '李存勖灭后梁建立后唐，定都洛阳', en: 'Li Cunxu founds Later Tang with Luoyang as imperial capital' },

        // 建康 / 金陵 / 南京
        { dynastyKey: 'sanguo', year: 229, coord: [118.78, 32.06], site: '建业', siteEn: 'Jianye (Nanjing)', zh: '孙权自武昌迁都建业（今南京），正式称帝建立东吴', en: 'Sun Quan moves his capital to Jianye (Nanjing) and proclaims the Eastern Wu Empire' },
        { dynastyKey: 'xijin', year: 280, coord: [118.78, 32.06], site: '建业', siteEn: 'Jianye (Nanjing)', zh: '晋将王濬楼船下益州直抵建业，孙皓出降，三国归晋', en: 'Jin naval forces under Wang Jun capture Jianye, ending the Three Kingdoms' },
        { dynastyKey: 'dongjin', year: 317, coord: [118.78, 32.06], site: '建康', siteEn: 'Jiankang (Nanjing)', zh: '司马睿渡江于建康建立东晋，开启六朝古都繁华', en: 'Sima Rui establishes the Eastern Jin in Jiankang (Nanjing)' },
        { dynastyKey: 'nanbeichao', year: 420, coord: [118.78, 32.06], site: '建康', siteEn: 'Jiankang (Nanjing)', zh: '刘裕代晋建宋，南朝宋齐梁陈四代皆都建康', en: 'Liu Yu founds Liu Song; Jiankang serves as capital of all four Southern Dynasties' },
        { dynastyKey: 'sui', year: 589, coord: [118.78, 32.06], site: '建康', siteEn: 'Jiankang (Nanjing)', zh: '隋军韩擒虎渡江克建康灭陈，结束近三百年南北分裂', en: 'Sui forces cross the Yangtze and capture Jiankang, reunifying China' },
        { dynastyKey: 'wudai', year: 937, coord: [118.78, 32.06], site: '金陵', siteEn: 'Jinling (Nanjing)', zh: '李昪于金陵建立南唐，词章书画冠绝十国', en: 'Li Bian founds Southern Tang in Jinling, cultural heart of the Ten Kingdoms' },
        { dynastyKey: 'nansong', year: 1129, coord: [118.78, 32.06], site: '建康府', siteEn: 'Jiankang (Nanjing)', zh: '南宋改江宁为建康府，为留都与长江防线核心枢要', en: 'Jiankang serves as auxiliary capital and Yangtze defense hub of Southern Song' },
        { dynastyKey: 'ming', year: 1368, coord: [118.78, 32.06], site: '应天府', siteEn: 'Yingtian (Nanjing)', zh: '朱元璋于应天府（南京）称帝建立明朝', en: 'Zhu Yuanzhang proclaims the Ming Dynasty in Yingtian (Nanjing)' },
        { dynastyKey: 'ming', year: 1402, coord: [118.78, 32.06], site: '应天府', siteEn: 'Nanjing', zh: '靖难之役：燕王朱棣攻克南京，即位为明成祖', en: 'Jingnan Campaign: Zhu Di captures Nanjing and ascends as the Yongle Emperor' },
        { dynastyKey: 'qing', year: 1842, coord: [118.78, 32.06], site: '江宁（南京）', siteEn: 'Nanjing', zh: '第一次鸦片战争清廷战败，于南京下关江面签署《南京条约》', en: 'Treaty of Nanjing signed after the First Opium War' },
        { dynastyKey: 'qing', year: 1853, coord: [118.78, 32.06], site: '江宁（天京）', siteEn: 'Nanjing', zh: '太平天国攻占江宁，改名天京并定都十一年', en: 'Taiping Heavenly Kingdom captures Jiangning and makes it its capital Tianjing' },
        { dynastyKey: 'roc', year: 1912, coord: [118.78, 32.06], site: '南京', siteEn: 'Nanjing', zh: '孙中山于南京就任中华民国临时大总统，宣告共和', en: 'Sun Yat-sen inaugurated in Nanjing as Provisional President of the Republic of China' },

        // 蓟 / 幽州 / 燕京 / 大都 / 北京
        { dynastyKey: 'qin', year: -226, coord: [116.40, 39.90], site: '蓟城', siteEn: 'Ji (Beijing)', zh: '秦将王翦攻拔燕都蓟城，置广阳郡', en: 'Qin general Wang Jian captures the Yan capital Ji and establishes Guangyang Commandery' },
        { dynastyKey: 'tang', year: 755, coord: [116.40, 39.90], site: '范阳（幽州）', siteEn: 'Fanyang (Beijing)', zh: '安禄山于范阳（幽州）起兵反唐，安史之乱爆发', en: 'An Lushan launches his rebellion from Fanyang (Youzhou / Beijing)' },
        { dynastyKey: 'wudai', year: 938, coord: [116.40, 39.90], site: '幽州（辽南京）', siteEn: 'Youzhou (Beijing)', zh: '后晋割燕云十六州，辽升幽州为南京析津府（陪都）', en: 'Liao elevates Youzhou to its Southern Capital, Nanjing Xijin Fu' },
        { dynastyKey: 'nansong', year: 1153, coord: [116.40, 39.90], site: '金中都', siteEn: 'Zhongdu (Beijing)', zh: '金海陵王完颜亮迁都燕京，定名金中都大兴府，首开北京帝都史', en: 'Jin ruler Wanyan Liang moves the imperial capital to Yanjing, renaming it Zhongdu' },
        { dynastyKey: 'nansong', year: 1215, coord: [116.40, 39.90], site: '金中都', siteEn: 'Zhongdu (Beijing)', zh: '成吉思汗蒙古大军攻占金中都', en: "Genghis Khan's Mongol forces capture Jin Zhongdu" },
        { dynastyKey: 'yuan', year: 1272, coord: [116.40, 39.90], site: '大都', siteEn: 'Dadu (Beijing)', zh: '忽必烈营建元大都成，定为元朝国都，积水潭万艘漕船云集', en: 'Kublai Khan establishes Dadu (Khanbaliq) as capital of the Yuan Dynasty' },
        { dynastyKey: 'ming', year: 1421, coord: [116.40, 39.90], site: '京师（北京）', siteEn: 'Beijing', zh: '明成祖朱棣建北京紫禁城成，正式自南京迁都北京', en: 'Yongle Emperor completes the Forbidden City and moves the Ming capital to Beijing' },
        { dynastyKey: 'ming', year: 1449, coord: [116.40, 39.90], site: '北京', siteEn: 'Beijing', zh: '土木堡之变后瓦剌逼近京师，于谦指挥北京保卫战获胜', en: 'Yu Qian leads the successful Defense of Beijing after the Tumu Crisis' },
        { dynastyKey: 'ming', year: 1644, coord: [116.40, 39.90], site: '北京', siteEn: 'Beijing', zh: '李自成破北京崇祯自缢；旋即清军入关定都北京', en: 'Li Zicheng captures Beijing; Qing forces soon enter and make Beijing their capital' },
        { dynastyKey: 'qing', year: 1860, coord: [116.40, 39.90], site: '北京', siteEn: 'Beijing', zh: '第二次鸦片战争英法联军攻入北京，劫掠并焚毁圆明园', en: 'Anglo-French forces enter Beijing and burn the Old Summer Palace (Yuanmingyuan)' },
        { dynastyKey: 'roc', year: 1919, coord: [116.40, 39.90], site: '北京', siteEn: 'Beijing', zh: '北京爆发五四爱国运动，揭开新民主主义革命序幕', en: 'May Fourth Movement erupts in Beijing' },
        { dynastyKey: 'roc', year: 1949, coord: [116.40, 39.90], site: '北平（北京）', siteEn: 'Beijing', zh: '北平和平解放，同年10月1日于北京天安门宣告新中国成立', en: 'Peaceful liberation of Beiping; founding of the PRC proclaimed at Tiananmen' },

        // 大梁 / 汴州 / 汴京 / 开封
        { dynastyKey: 'qin', year: -225, coord: [114.35, 34.79], site: '大梁', siteEn: 'Daliang (Kaifeng)', zh: '秦将王贲引黄河鸿沟水灌大梁城，魏王假降，魏亡', en: 'Qin general Wang Ben floods Daliang to conquer the state of Wei' },
        { dynastyKey: 'sui', year: 605, coord: [114.35, 34.79], site: '汴州', siteEn: 'Bianzhou (Kaifeng)', zh: '通济渠贯通洛阳经汴州入淮，汴州跃升为天下漕运咽喉', en: 'Grand Canal makes Bianzhou (Kaifeng) the premier north-south waterway hub' },
        { dynastyKey: 'wudai', year: 907, coord: [114.35, 34.79], site: '东都开封府', siteEn: 'Kaifeng', zh: '朱温篡唐建后梁定都开封；后晋、后汉、后周皆都于此', en: 'Zhu Wen founds Later Liang in Kaifeng; four of the Five Dynasties make it their capital' },
        { dynastyKey: 'beisong', year: 960, coord: [114.35, 34.79], site: '东京开封府', siteEn: 'Dongjing (Kaifeng)', zh: '赵匡胤陈桥兵变，于东京开封府建立北宋', en: 'Zhao Kuangyin founds the Northern Song Dynasty with Dongjing (Kaifeng) as capital' },
        { dynastyKey: 'beisong', year: 1127, coord: [114.35, 34.79], site: '东京汴梁', siteEn: 'Bianjing (Kaifeng)', zh: '靖康之变：金军攻陷汴京，掳徽钦二帝北去，北宋灭亡', en: 'Jingkang Incident: Jurchen Jin forces capture Kaifeng, ending the Northern Song' },
        { dynastyKey: 'nansong', year: 1214, coord: [114.35, 34.79], site: '金南京（汴京）', siteEn: 'Bianjing (Kaifeng)', zh: '金宣宗避蒙古兵锋，自中都南迁都城至汴京', en: 'Emperor Xuanzong of Jin relocates the Jurchen capital south to Bianjing' },
        { dynastyKey: 'ming', year: 1642, coord: [114.35, 34.79], site: '开封府', siteEn: 'Kaifeng', zh: '李自成三围开封，黄河决口灌城，古城尽没于泥沙', en: 'Yellow River dike breach during the 1642 Siege of Kaifeng submerges the city' },

        // 杭州 / 临安
        { dynastyKey: 'sui', year: 610, coord: [120.15, 30.28], site: '余杭（杭州）', siteEn: 'Hangzhou', zh: '隋炀帝开江南河自京口达杭州，贯通大运河最南端', en: 'Sui completes the Jiangnan Canal terminating at Hangzhou' },
        { dynastyKey: 'wudai', year: 907, coord: [120.15, 30.28], site: '杭州（西府）', siteEn: 'Hangzhou', zh: '钱镠建立吴越国定都杭州，筑捍海塘、浚西湖，保境安民', en: 'Qian Liu establishes the Wuyue Kingdom in Hangzhou and builds the Qiantang seawall' },
        { dynastyKey: 'nansong', year: 1138, coord: [120.15, 30.28], site: '临安府', siteEn: "Lin'an (Hangzhou)", zh: '宋高宗正式定临安府（杭州）为南宋行在（都城）', en: "Emperor Gaozong establishes Lin'an (Hangzhou) as capital of the Southern Song" },
        { dynastyKey: 'nansong', year: 1142, coord: [120.15, 30.28], site: '临安府', siteEn: "Lin'an (Hangzhou)", zh: '绍兴和议达成，岳飞于临安风波亭遇害', en: "General Yue Fei is executed at Fengbo Pavilion in Lin'an" },
        { dynastyKey: 'nansong', year: 1276, coord: [120.15, 30.28], site: '临安府', siteEn: "Lin'an (Hangzhou)", zh: '元军伯颜兵临临安，谢太后携宋恭帝奉玺出降', en: "Yuan forces under Bayan reach Lin'an; the Southern Song court surrenders" },

        // 成都
        { dynastyKey: 'sanguo', year: 221, coord: [104.06, 30.67], site: '成都', siteEn: 'Chengdu', zh: '刘备于成都称帝建立蜀汉，拜诸葛亮为丞相', en: 'Liu Bei proclaims the Shu Han Empire in Chengdu with Zhuge Liang as Chancellor' },
        { dynastyKey: 'sanguo', year: 263, coord: [104.06, 30.67], site: '成都', siteEn: 'Chengdu', zh: '魏将邓艾偷渡阴平直抵成都，刘禅出降，蜀汉灭亡', en: 'Wei general Deng Ai marches through Yinping to Chengdu; Liu Shan surrenders' },
        { dynastyKey: 'tang', year: 756, coord: [104.06, 30.67], site: '成都府（南京）', siteEn: 'Chengdu', zh: '安史之乱唐玄宗幸蜀驻跸成都，后升益州为成都府', en: 'Emperor Xuanzong takes refuge in Chengdu during the An Lushan Rebellion' },
        { dynastyKey: 'wudai', year: 907, coord: [104.06, 30.67], site: '成都', siteEn: 'Chengdu', zh: '王建于成都建前蜀，后孟知祥复于成都建后蜀', en: 'Former Shu and Later Shu kingdoms successively govern from Chengdu' },
        { dynastyKey: 'beisong', year: 1023, coord: [104.06, 30.67], site: '益州（成都）', siteEn: 'Chengdu', zh: '北宋于成都设益州交子务，发行世界最早官方纸币“交子”', en: "Northern Song establishes the Jiaozi Bureau in Chengdu, issuing the world's first state paper money" },

        // 江夏 / 武昌 / 鄂州 / 武汉 & 襄阳
        { dynastyKey: 'donghan', year: 208, coord: [113.95, 29.95], site: '赤壁·江夏', siteEn: 'Red Cliffs / Jiangxia', zh: '孙刘联军于赤壁火攻大破曹操，奠定三国鼎立之局', en: 'Battle of Red Cliffs: Sun Quan and Liu Bei defeat Cao Cao by fire attack' },
        { dynastyKey: 'sanguo', year: 221, coord: [114.88, 30.40], site: '武昌（今鄂州）', siteEn: 'Wuchang', zh: '孙权自公安徙治鄂县，取“以武而昌”改名武昌', en: 'Sun Quan establishes Wuchang as his military and political capital on the Yangtze' },
        { dynastyKey: 'nansong', year: 1134, coord: [114.30, 30.55], site: '鄂州（武昌）', siteEn: 'Ezhou (Wuhan)', zh: '岳飞以鄂州为大本营，挥师北伐收复襄阳六郡', en: 'Yue Fei bases his Northern Expedition forces at Ezhou (Wuchang)' },
        { dynastyKey: 'qing', year: 1911, coord: [114.30, 30.55], site: '武昌', siteEn: 'Wuchang (Wuhan)', zh: '武昌起义爆发，打响辛亥革命第一枪，终结两千年帝制', en: 'Wuchang Uprising sparks the 1911 Xinhai Revolution, ending imperial rule in China' },
        { dynastyKey: 'donghan', year: 207, coord: [112.14, 32.01], site: '襄阳·隆中', siteEn: 'Xiangyang', zh: '刘备三顾茅庐请诸葛亮于襄阳隆中出山，定《隆中对》', en: 'Liu Bei visits Zhuge Liang three times at Longzhong near Xiangyang' },
        { dynastyKey: 'sanguo', year: 219, coord: [112.14, 32.01], site: '襄阳·樊城', siteEn: 'Xiangyang', zh: '关羽北伐水淹七军，围曹仁于樊城、襄阳，威震华夏', en: 'Guan Yu floods the Seven Armies and besieges Xiangyang and Fancheng' },
        { dynastyKey: 'nansong', year: 1273, coord: [112.14, 32.01], site: '襄阳', siteEn: 'Xiangyang', zh: '襄樊之战：宋军孤城苦守襄阳六年，元军回回炮破樊城后降元', en: 'Six-year Siege of Xiangyang ends after Yuan forces deploy counterweight trebuchets' },

        // 沙州 / 敦煌 & 平城 / 大同 & 广陵 / 扬州 & 番禺 / 广州
        { dynastyKey: 'xihan', year: -111, coord: [94.66, 40.14], site: '敦煌', siteEn: 'Dunhuang', zh: '汉武帝分酒泉置敦煌郡，筑玉门关、阳关扼丝路咽喉', en: 'Emperor Wu of Han establishes Dunhuang Commandery and the Yumen and Yangguan passes' },
        { dynastyKey: 'nanbeichao', year: 366, coord: [94.66, 40.14], site: '敦煌', siteEn: 'Dunhuang', zh: '沙门乐僔于敦煌鸣沙山东麓开凿莫高窟第一窟', en: 'Monk Yuezun carves the first cave at the Mogao Grottoes in Dunhuang' },
        { dynastyKey: 'tang', year: 848, coord: [94.66, 40.14], site: '沙州（敦煌）', siteEn: 'Shazhou (Dunhuang)', zh: '张议潮于沙州起义驱逐吐蕃，遣使奉表归唐，置归义军', en: 'Zhang Yichao leads the Dunhuang uprising and restores Tang rule as the Guiyi Circuit' },
        { dynastyKey: 'xihan', year: -200, coord: [113.30, 40.08], site: '平城（大同）', siteEn: 'Pingcheng (Datong)', zh: '白登之围：汉高祖刘邦于平城白登山被冒顿单于围困七日', en: 'Siege of Baideng: Emperor Gaozu of Han is besieged by Modu Chanyu at Pingcheng' },
        { dynastyKey: 'nanbeichao', year: 398, coord: [113.30, 40.08], site: '平城（大同）', siteEn: 'Pingcheng (Datong)', zh: '拓跋珪迁都平城称帝建北魏，开凿云冈石窟', en: 'Tuoba Gui moves the Northern Wei capital to Pingcheng and initiates the Yungang Grottoes' },
        { dynastyKey: 'sui', year: 618, coord: [119.41, 32.39], site: '江都（扬州）', siteEn: 'Jiangdu (Yangzhou)', zh: '宇文化及于江都发动兵变弑隋炀帝，隋朝覆亡', en: 'Yuwen Huaji assassinates Emperor Yang of Sui in Jiangdu (Yangzhou)' },
        { dynastyKey: 'tang', year: 753, coord: [119.41, 32.39], site: '扬州', siteEn: 'Yangzhou', zh: '鉴真和尚自扬州启航第六次东渡日本成功', en: 'Monk Jianzhen sets sail from Yangzhou on his successful sixth voyage to Japan' },
        { dynastyKey: 'qing', year: 1645, coord: [119.41, 32.39], site: '扬州', siteEn: 'Yangzhou', zh: '史可法率孤军死守扬州抗击清军，城破殉国', en: 'Ming loyalist Shi Kefa defends Yangzhou to the death against Qing forces' },
        { dynastyKey: 'xihan', year: -204, coord: [113.26, 23.13], site: '番禺（广州）', siteEn: 'Panyu (Guangzhou)', zh: '赵佗于番禺自立为南越武王；前111年汉武帝平南越置南海郡', en: 'Zhao Tuo founds the Nanyue Kingdom at Panyu (Guangzhou); reconquered by Han in 111 BCE' },
        { dynastyKey: 'tang', year: 714, coord: [113.26, 23.13], site: '广州', siteEn: 'Guangzhou', zh: '唐廷于广州首设市舶使，总管南海番舶贸易', en: 'Tang establishes the first Maritime Trade Commissioner (Shibosi) in Guangzhou' },
        { dynastyKey: 'qing', year: 1839, coord: [113.26, 23.13], site: '广州·虎门', siteEn: 'Guangzhou / Humen', zh: '林则徐抵广州查禁鸦片，于虎门海滩当众销烟', en: 'Imperial Commissioner Lin Zexu destroys opium stocks at Humen near Guangzhou' },
      ];
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

      // 2. Historical journeys (Zhang Qian, Xuanzang, Su Shi)
      for (const j of HistoricalAtlasController.HISTORICAL_JOURNEYS) {
        if (j.dynastyKey !== d.key) continue;
        j.stops.forEach((st, sIdx) => {
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
          const dPx = Math.hypot(Number(pin.dataset.x) - sx, Number(pin.dataset.y) - sy) * scale;
          if (dPx <= bestMilePx) {
            bestMilePx = dPx;
            bestMile = pin;
          }
        });
      }
      return { settlementEl: bestSettle, milestoneEl: bestMile };
    }

    openGenealogyAt(lng, lat) {
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
      const isSamePlace =
        this.activeTrace &&
        Math.hypot(this.activeTrace[0] - lng, this.activeTrace[1] - lat) < 0.01;
      if (!isSamePlace) {
        this.genealogyEventsOnly = false;
      }
      this.activeTrace = [lng, lat];
      this.grpGenealogy.innerHTML = '';
      const [sx, sy] = this.projector.toScreen(lng, lat);
      const g = this._svgNode(
        'g',
        { 'data-x': sx.toFixed(1), 'data-y': sy.toFixed(1) },
        this.grpGenealogy
      );
      this._svgNode('circle', { class: 'trace-pin', r: 10 }, g);
      this._svgNode('circle', { class: 'trace-dot', r: 3.5 }, g);
      if (window.innerWidth <= 900 && sy > this.camera.y + this.camera.h * 0.44) {
        this.camera.y = sy - this.camera.h * 0.28;
        this._applyCamera();
      } else {
        this._rescaleSvgTypography();
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

      const titleMain = modernTitle
        ? this.trTerm(modernTitle)
        : this.uiStr('outside_modern', '现代省界外 / 海域');
      const titleSuffix =
        closestOverall && closestOverall.s.modern
          ? ` · ${this.trTerm(closestOverall.s.modern)}`
          : '';
      this._id('genealogy-heading').textContent = titleMain + titleSuffix;

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
            subParts.push(
              this.locale === 'en'
                ? `${this.uiStr('near_city', '邻近古城：')}${this.trTerm(near.s.ancient)} (${distStr})`
                : `${this.uiStr('near_city', '邻近古城：')}${this.trTerm(near.s.ancient)}（${distStr}）`
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
          const hide = rect.left < lastRight + 6;
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
      if (this.activeMilestone && this.activeMilestone.year !== y) {
        this.closeMilestoneBalloon();
      }
      this._renderCorridors();
      this._syncScrubberUi();
      if (this.activeTrace && !this._id('genealogy-card').classList.contains('is-hidden')) {
        this.openGenealogyAt(this.activeTrace[0], this.activeTrace[1]);
      }
    }

    // ---------------- Autoplay ----------------
    startAutoplay() {
      if (this.challenge) return;
      this.playing = true;
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
    }

    // ---------------- Classical Guqin Music Player ----------------
    static get GUQIN_TRACKS() {
      return [
        {
          zh: '流水',
          en: 'Flowing Water',
          mp3: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e0/Liu_Shui.ogg/Liu_Shui.ogg.mp3',
          ogg: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Liu_Shui.ogg',
        },
        {
          zh: '平沙落雁',
          en: 'Wild Geese on the Sandbank',
          mp3: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/5/5a/Pingsha_Luoyan.ogg/Pingsha_Luoyan.ogg.mp3',
          ogg: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Pingsha_Luoyan.ogg',
        },
        {
          zh: '阳关三叠',
          en: 'Parting at Yangguan',
          mp3: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/6/60/Guqin-Yangguan_Sandie.ogg/Guqin-Yangguan_Sandie.ogg.mp3',
          ogg: 'https://upload.wikimedia.org/wikipedia/commons/6/60/Guqin-Yangguan_Sandie.ogg',
        },
        {
          zh: '醉渔唱晚',
          en: 'Drunken Fisherman',
          mp3: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/5/52/Guqin-Zuiyu_Changwan.ogg/Guqin-Zuiyu_Changwan.ogg.mp3',
          ogg: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Guqin-Zuiyu_Changwan.ogg',
        },
        {
          zh: '酒狂',
          en: 'Wine Madness',
          mp3: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/8/8f/Jiu_Kuang.ogg/Jiu_Kuang.ogg.mp3',
          ogg: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/Jiu_Kuang.ogg',
        },
      ];
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
    _applyCamera() {
      this.svg.setAttribute(
        'viewBox',
        `${this.camera.x.toFixed(1)} ${this.camera.y.toFixed(1)} ${this.camera.w.toFixed(1)} ${this.camera.h.toFixed(1)}`
      );
      this._rescaleSvgTypography();
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
      const rect = this.svg.getBoundingClientRect();
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

    toggleChroniclePane(force) {
      this.paneCollapsed = force !== undefined ? force : !this.paneCollapsed;
      const body = this._id('workspace-body');
      if (body) body.classList.toggle('is-pane-collapsed', this.paneCollapsed);
      const btn = this._id('act-toggle-pane');
      if (btn) {
        btn.textContent = this.paneCollapsed ? '‹' : '›';
        btn.title = this.paneCollapsed
          ? this.locale === 'en'
            ? 'Expand chronicle pane'
            : '展开编年侧栏'
          : this.locale === 'en'
            ? 'Collapse chronicle pane (Full-map view)'
            : '收起编年侧栏（全屏看图）';
      }
      setTimeout(() => {
        this._updateScaleBar();
        if (this.activeMilestone) this._positionMilestoneBalloon();
      }, 240);
    }

    toggleMobileChronicle(force) {
      this.mobileChronicleOpen =
        force !== undefined ? force : !this.mobileChronicleOpen;
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
      const z = 1000 / this.camera.w;
      const s = 1 / Math.sqrt(z);
      const invScale = s.toFixed(3);
      const tier2MinZoom =
        typeof window !== 'undefined' && window.innerWidth <= 900 ? 3.35 : 2.55;
      const showTier2 = z >= tier2MinZoom;
      this.svg.classList.toggle('is-zoomed-cities', showTier2);

      const showSettlements = !this.grpSettlements.classList.contains('is-hidden');
      const showPrefectures = !this.grpPrefectures.classList.contains('is-hidden');
      const showCorridors = !this.grpCorridors.classList.contains('is-hidden');
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
      if (showSettlements) {
        for (const node of settlementNodes) {
          const isT2 = node.classList.contains('is-tier2');
          if (isT2 && !showTier2) continue;
          const cx = parseFloat(node.getAttribute('data-x'));
          const cy = parseFloat(node.getAttribute('data-y'));
          const r = (node.classList.contains('is-capital') ? 5.2 : isT2 ? 3.0 : 3.8) * s;
          occupied.push({ x1: cx - r, y1: cy - r, x2: cx + r, y2: cy + r });
        }
      }
      if (showMilestones) {
        this.svg.querySelectorAll('.milestone-pin').forEach((pin) => {
          const mx = parseFloat(pin.getAttribute('data-x'));
          const my = parseFloat(pin.getAttribute('data-y'));
          if (!isNaN(mx)) {
            occupied.push({
              x1: mx - 18 * s,
              y1: my - 10 * s,
              x2: mx + 18 * s,
              y2: my + 10 * s,
            });
          }
        });
      }

      const layoutSettlementLabel = (node, allowCull) => {
        const cx = parseFloat(node.getAttribute('data-x'));
        const cy = parseFloat(node.getAttribute('data-y'));
        node.setAttribute('transform', `translate(${cx.toFixed(1)},${cy.toFixed(1)}) scale(${invScale})`);
        if (!showSettlements) return;

        const nameEl = node.querySelector('.name');
        if (!nameEl) return;
        const tier = node.dataset.tier || '1';
        const f1 = tier === '0' ? 9.6 : tier === '2' ? 7.3 : 8.2;
        const wLocal = this._estimateLocalTextWidth(nameEl.textContent, f1, 0.45) + 7;

        const pref = node.dataset.prefAlign || 'r';
        const dirs = [pref];
        for (const d of ['r', 'l', 'b', 't']) {
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
        if (allowCull && bestOverlap > boxArea * 0.1) {
          node.classList.add('is-label-crowded');
          return;
        }
        node.classList.remove('is-label-crowded');
        nameEl.setAttribute('x', String(best.dx));
        nameEl.setAttribute('y', String(best.dy1));
        nameEl.setAttribute('text-anchor', best.anchor);
        occupied.push(best.box);
      };

      // Tier 1: Capitals first, then Tier-1 primary cities (never culled, always protected)
      for (const node of settlementNodes) {
        if (node.classList.contains('is-capital')) layoutSettlementLabel(node, false);
      }
      for (const node of settlementNodes) {
        if (!node.classList.contains('is-capital') && !node.classList.contains('is-tier2')) {
          layoutSettlementLabel(node, false);
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
        [-24, -18],
        [0, -24],
        [-30, 0],
        [30, 0],
        [24, -18],
        [-24, 18],
        [24, 18],
        [0, 24],
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
        const base = node.classList.contains('neighbor')
          ? 9
          : node.classList.contains('protectorate')
            ? 10
            : node.classList.contains('rival')
              ? 12
              : 14;
        const fSize = base + (base > 10 ? 10 : 3) / z;
        node.setAttribute('font-size', fSize.toFixed(1));

        const baseX = parseFloat(node.getAttribute('data-base-x') || node.getAttribute('data-x'));
        const baseY = parseFloat(node.getAttribute('data-base-y') || node.getAttribute('data-y'));
        const ls = node.classList.contains('neighbor')
          ? 1.6
          : node.classList.contains('protectorate')
            ? 2.0
            : 3.0;
        const hw = (this._estimateLocalTextWidth(node.textContent, fSize, ls) * 0.5 + 4) * s;
        const hh = (fSize * 0.58 + 3) * s;

        let bestX = baseX;
        let bestY = baseY;
        let bestBox = { x1: baseX - hw, y1: baseY - hh, x2: baseX + hw, y2: baseY + hh };
        let bestScore = Infinity;

        for (let i = 0; i < polOffsets.length; i++) {
          const [ox, oy] = polOffsets[i];
          const cx = baseX + ox;
          const cy = baseY + oy;
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
        node.setAttribute('font-size', (9.5 / Math.sqrt(z)).toFixed(1));
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

    startChallenge(variant) {
      this.stopAutoplay();
      if (this.activeJourney) this.stopJourney();
      this.closeMilestoneBalloon();
      this.closeGenealogyCard();
      if (this.genealogyMode) this.toggleGenealogyMode(false);
      const sb = this._id('map-search-box');
      if (sb) sb.classList.add('is-hidden');
      if (variant) this.challengeVariant = variant;
      this.challenge = {
        variant: this.challengeVariant,
        deck: this._buildChallengeDeck(),
        index: 0,
        score: 0,
        answered: false,
      };
      this._id('tab-locate').classList.toggle('is-active', this.challengeVariant === 'locate');
      this._id('tab-match').classList.toggle('is-active', this.challengeVariant === 'match');
      this._id('challenge-card').classList.remove('is-hidden');
      const lblChal = this._id('lbl-challenge') || this._id('act-challenge');
      lblChal.textContent = this.uiStr('btn_quiz_active', '挑战中…');
      this.svg.classList.toggle('is-crosshair', this.challengeVariant === 'locate');
      this.grpSettlements.classList.add('is-hidden');
      this._id('act-next-round').onclick = null;
      this.presentChallengeRound();
    }

    stopChallenge() {
      this.challenge = null;
      this.grpChallenge.innerHTML = '';
      this._id('challenge-card').classList.add('is-hidden');
      this._id('challenge-options').classList.add('is-hidden');
      const sb = this._id('map-search-box');
      if (sb) sb.classList.remove('is-hidden');
      const lblChal = this._id('lbl-challenge') || this._id('act-challenge');
      lblChal.textContent = this.uiStr('btn_quiz', '开始挑战');
      this.svg.classList.toggle('is-crosshair', this.genealogyMode);
      this.grpSettlements.classList.toggle('is-hidden', !this._id('chk-settlements').checked);
    }

    presentChallengeRound() {
      const q = this.challenge;
      this.grpChallenge.innerHTML = '';
      q.answered = false;
      const cur = q.deck[q.index];
      this.jumpToYear(cur.dynasty.focusYear);

      this._id('challenge-step').textContent =
        this.locale === 'en'
          ? `Q ${q.index + 1} / ${q.deck.length}`
          : `第 ${q.index + 1} / ${q.deck.length} 题`;
      this._id('challenge-points').textContent = `${this.uiStr('quiz_score', '得分')} ${q.score}`;
      this._id('challenge-result').classList.add('is-hidden');

      const hint = cur.settlement.remark
        ? this.locale === 'en'
          ? ` (${this.trTerm(cur.settlement.remark)})`
          : `（${this.trTerm(cur.settlement.remark)}）`
        : cur.settlement.isCapital
          ? this.uiStr('cap_hint', '（都城）')
          : '';

      if (q.variant === 'match') {
        this.grpSettlements.classList.add('is-hidden');
        const [sx, sy] = this.projector.toScreen(
          cur.settlement.coord[0],
          cur.settlement.coord[1]
        );
        const marker = this._svgNode(
          'g',
          { 'data-x': sx.toFixed(1), 'data-y': sy.toFixed(1) },
          this.grpChallenge
        );
        this._svgNode('circle', { class: 'target-ring', r: 14 }, marker);
        this._svgNode('circle', { class: 'answer-pin', r: 5 }, marker);
        this._rescaleSvgTypography();

        this._id('challenge-question').innerHTML =
          this.locale === 'en'
            ? `<b>${this.dynastyName(cur.dynasty)}</b> · The ancient city <b>“${this.trTerm(cur.settlement.ancient)}”</b>${hint} corresponds to which modern city?`
            : `【${this.dynastyName(cur.dynasty)}】古地名 <b>「${cur.settlement.ancient}」</b>${hint} 对应今天的哪座城市？`;

        const pool = Array.from(
          new Set(
            this.dynasties
              .flatMap((d) => d.settlements.map((s) => s.modern))
              .filter((m) => m && m !== cur.settlement.modern)
          )
        );
        const distractors = [];
        while (distractors.length < 3 && pool.length) {
          distractors.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        }
        const choices = [cur.settlement.modern, ...distractors].sort(() => Math.random() - 0.5);
        const box = this._id('challenge-options');
        box.innerHTML = '';
        box.classList.remove('is-hidden');
        for (const opt of choices) {
          const btn = document.createElement('button');
          btn.className = 'option-choice';
          btn.dataset.optValue = opt;
          btn.textContent = this.trTerm(opt);
          btn.addEventListener('click', () => this._evaluateMatchChoice(opt, btn));
          box.appendChild(btn);
        }
      } else {
        this._id('challenge-options').classList.add('is-hidden');
        this._id('challenge-question').innerHTML =
          this.locale === 'en'
            ? `Click on the map to locate <b>${this.dynastyName(cur.dynasty)}</b>’s <b>“${this.trTerm(cur.settlement.ancient)}”</b>${hint}`
            : `请在地图上点击 <b>${this.dynastyName(cur.dynasty)}</b> 时期的 <b>「${cur.settlement.ancient}」</b>${hint}`;
      }
    }

    _evaluateMatchChoice(choice, clickedBtn) {
      const q = this.challenge;
      if (!q || q.answered) return;
      q.answered = true;
      const cur = q.deck[q.index];
      const isRight = choice === cur.settlement.modern;
      if (isRight) q.score += 100;

      Array.from(this._id('challenge-options').children).forEach((b) => {
        b.disabled = true;
        if (b.dataset.optValue === cur.settlement.modern) b.classList.add('is-correct');
        else if (b === clickedBtn) b.classList.add('is-wrong');
      });

      this._id('challenge-points').textContent = `${this.uiStr('quiz_score', '得分')} ${q.score}`;
      this._id('challenge-verdict').innerHTML = isRight
        ? this.locale === 'en'
          ? `Correct! <b>${this.trTerm(cur.settlement.ancient)}</b> is modern <b>${this.trTerm(cur.settlement.modern)}</b> (+100 pts)`
          : `回答正确！<b>${cur.settlement.ancient}</b> 即今 <b>${cur.settlement.modern}</b>（+100 分）`
        : this.locale === 'en'
          ? `Not quite — <b>${this.trTerm(cur.settlement.ancient)}</b> is modern <b>${this.trTerm(cur.settlement.modern)}</b> (+0 pts)`
          : `答错了，<b>${cur.settlement.ancient}</b> 对应今 <b>${cur.settlement.modern}</b>（+0 分）`;

      this._id('act-next-round').innerHTML =
        q.index + 1 >= q.deck.length
          ? this.uiStr('quiz_see_result', '查看成绩')
          : `${this.locale === 'en' ? 'Next' : '下一题'} ${SVG_ICONS.arrowRight}`;
      this._id('challenge-result').classList.remove('is-hidden');
    }

    _evaluateLocateClick(svgX, svgY) {
      const q = this.challenge;
      if (!q || q.answered || q.variant !== 'locate') return;
      q.answered = true;

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
      aLabel.textContent =
        this.locale === 'en'
          ? `${this.trTerm(cur.settlement.ancient)} (${this.trTerm(cur.settlement.modern)})`
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
          ? `${comment} Off by <b>${km} km</b> (+${pts} pts) · Answer: ${this.trTerm(cur.settlement.ancient)} (${this.trTerm(cur.settlement.modern)})`
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

      this._id('challenge-options').classList.add('is-hidden');
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
        this.startChallenge(this.challengeVariant);
      };
    }

    // ---------------- Historical Journeys (青史行迹) ----------------
    static get HISTORICAL_JOURNEYS() {
      return [
        {
          key: 'zhangqian',
          dynastyKey: 'xihan',
          color: '#a83b24',
          shortZh: '张骞通西域',
          shortEn: "Zhang Qian's Envoy",
          titleZh: '张骞凿空西域行迹',
          titleEn: "Zhang Qian's Envoy to the Western Regions",
          spanZh: '前138年 — 前126年（西汉建元三年至元朔三年）',
          spanEn: '138 BCE – 126 BCE (Western Han)',
          stops: [
            {
              year: -138,
              eraZh: '建元三年',
              coord: [108.94, 34.26],
              labelPos: 'top',
              ancientZh: '长安',
              modernZh: '陕西西安',
              ancientEn: "Chang'an",
              modernEn: "Xi'an, Shaanxi",
              titleZh: '奉诏募使·发自长安',
              titleEn: "Imperial Commission at Chang'an",
              descZh:
                '汉武帝欲联合大月氏共击匈奴，张骞以郎应募，与堂邑氏胡奴甘父率百余人自长安出发西行。',
              descEn:
                "Emperor Wu of Han sought an alliance with the Great Yuezhi against the Xiongnu; Zhang Qian volunteered and departed Chang'an with over a hundred men.",
              quoteZh: '《史记·大宛列传》：“骞以郎应募，使月氏，与堂邑氏胡奴甘父俱出陇西。”',
              quoteEn:
                'Records of the Grand Historian: "Zhang Qian volunteered as a palace attendant to go as envoy to the Yuezhi, departing Longxi with Ganfu."',
            },
            {
              year: -138,
              eraZh: '建元三年',
              coord: [103.86, 35.38],
              labelPos: 'bottom',
              ancientZh: '陇西',
              modernZh: '甘肃临洮',
              ancientEn: 'Longxi',
              modernEn: 'Lintao, Gansu',
              titleZh: '出陇西塞·踏入绝域',
              titleEn: 'Crossing the Longxi Frontier',
              descZh:
                '自陇西郡出塞西渡黄河，踏入匈奴右贤王与浑邪王控扼的河西之地，由此西去万里皆属未知绝域。',
              descEn:
                'Crossing the Han frontier at Longxi Commandery into the Xiongnu-held Hexi Corridor toward the uncharted Western Regions.',
              quoteZh: '《汉书·张骞传》：“出陇西，径匈奴，匈奴得之。”',
              quoteEn:
                'Book of Han: "Departing Longxi, he passed through Xiongnu territory and was captured."',
            },
            {
              year: -138,
              eraZh: '建元三年',
              coord: [102.64, 37.93],
              labelPos: 'top',
              ancientZh: '姑臧·河西',
              modernZh: '甘肃武威',
              ancientEn: 'Guzang (Hexi)',
              modernEn: 'Wuwei, Gansu',
              titleZh: '羁留匈奴·持节十载',
              titleEn: 'Detained by the Xiongnu for a Decade',
              descZh:
                '途经河西走廊为匈奴骑兵截获，押送单于王庭。单于予妻生子，然张骞始终“持汉节不失”，羁留十余载待机西奔。',
              descEn:
                'Captured in the Hexi Corridor and held for over ten years by the Xiongnu Chanyu, yet Zhang Qian never relinquished his Han imperial tally.',
              quoteZh: '《史记·大宛列传》：“留骞十余岁，予妻，有子，然骞持汉节不失。”',
              quoteEn:
                'Records of the Grand Historian: "Detained over ten years and given a wife and son, yet Zhang Qian kept his Han imperial staff unblemished."',
            },
            {
              year: -129,
              eraZh: '元光六年',
              coord: [86.57, 42.06],
               via: [[95.2, 40.6]],
              labelPos: 'top',
              ancientZh: '焉耆·北道',
              modernZh: '新疆焉耆',
              ancientEn: 'Yanqi (Karasahr)',
              modernEn: 'Yanqi, Xinjiang',
              titleZh: '乘隙脱走·疾驰西域北道',
              titleEn: 'Escape Along the Northern Tarim Oasis Route',
              descZh:
                '匈奴监管渐宽，张骞与甘父乘隙逃脱，循天山南麓绿洲昼夜西驰数十日，穿越车师、焉耆、龟兹诸国。',
              descEn:
                'Seizing a moment of lax guard, Zhang Qian and Ganfu escaped westward for dozens of days along the northern Tarim oases at the foot of the Tian Shan.',
              quoteZh: '《史记·大宛列传》：“居匈奴中，益宽，骞因与其属亡乡月氏，西走数十日。”',
              quoteEn:
                'Records of the Grand Historian: "When surveillance eased, Zhang Qian fled with his men toward the Yuezhi, riding west for dozens of days."',
            },
            {
              year: -129,
              eraZh: '元光六年',
              coord: [71.78, 40.38],
              via: [[78.5, 40.9]],
              labelPos: 'bottom',
              ancientZh: '大宛·贰师城',
              modernZh: '费尔干纳盆地',
              ancientEn: 'Dayuan (Fergana)',
              modernEn: 'Fergana Valley',
              titleZh: '越葱岭抵大宛·得发导译',
              titleEn: 'Crossing the Pamirs to Dayuan (Fergana)',
              descZh:
                '翻越帕米尔高原（葱岭）抵达盛产汗血宝马的大宛国。大宛王久闻汉朝饶财欲通而不得，见张骞大喜，特派向导译员护送赴康居。',
              descEn:
                'Crossing the Pamir Mountains into Fergana (Dayuan), whose king welcomed Zhang Qian warmly and provided guides and interpreters.',
              quoteZh: '《史记·大宛列传》：“大宛闻汉之饶财，欲通不得，见骞，喜……为发导驿抵康居。”',
              quoteEn:
                'Records of the Grand Historian: "Dayuan had heard of Han wealth and rejoiced at meeting Zhang Qian, dispatching post-guides to escort him to Kangju."',
            },
            {
              year: -129,
              eraZh: '元光六年',
              coord: [68.78, 40.85],
              labelPos: 'top',
              ancientZh: '康居',
              modernZh: '锡尔河中游',
              ancientEn: 'Kangju (Sogdiana)',
              modernEn: 'Tashkent / Samarkand region',
              titleZh: '经康居传致大月氏',
              titleEn: 'Relay Through Kangju to the Oxus',
              descZh:
                '由大宛导驿护送至康居国，再由康居王庭遣骑护送南下妫水（阿姆河）流域的大月氏王庭。',
              descEn:
                'Escorted through Kangju between the Syr Darya and Zeravshan rivers, and relayed southward toward the Amu Darya (Oxus).',
              quoteZh: '《史记·大宛列传》：“抵康居，康居传致大月氏。”',
              quoteEn:
                'Records of the Grand Historian: "Reaching Kangju, he was relayed onward to the Great Yuezhi."',
            },
            {
              year: -128,
              eraZh: '元朔元年',
              coord: [66.9, 36.76],
              labelPos: 'bottom',
              ancientZh: '大月氏·蓝氏城',
              modernZh: '阿富汗巴尔赫',
              ancientEn: 'Great Yuezhi & Daxia',
              modernEn: 'Balkh, Afghanistan',
              titleZh: '驻节大月氏与大夏·考索诸国',
              titleEn: 'Court of the Great Yuezhi & Bactria',
              descZh:
                '抵阿姆河流域，大月氏已臣服大夏（巴克特里亚），土地肥美安乐，无意东还复仇。张骞驻留岁余，详考大夏、安息、身毒及蜀布竹杖商路。',
              descEn:
                'In fertile Bactria, the Yuezhi no longer wished to return east against the Xiongnu. Staying over a year, Zhang Qian documented Parthia, India, and Sichuan trade goods.',
              quoteZh: '《史记·大宛列传》：“留岁余，还，并南山，欲从羌中归。”',
              quoteEn:
                'Records of the Grand Historian: "After staying over a year, he headed back along the Southern Mountains to return through Qiang lands."',
            },
            {
              year: -127,
              eraZh: '元朔二年',
              coord: [79.92, 37.11],
              via: [[73.5, 36.8]],
              labelPos: 'bottom',
              ancientZh: '于阗·南道',
              modernZh: '新疆和田',
              ancientEn: 'Khotan (Yutian)',
              modernEn: 'Hotan, Xinjiang',
              titleZh: '循昆仑南道东归·复陷匈奴',
              titleEn: 'Return via the Southern Tarim Route',
              descZh:
                '为避匈奴控制的天山北道，返程改循昆仑山北麓西域南道，经莎车、于阗、楼兰，欲从羌中归汉，不意复为匈奴游骑所得。',
              descEn:
                'To avoid Xiongnu patrols on the northern route, Zhang Qian returned along the Kunlun foothills via Yarkand and Khotan, but was captured again by Xiongnu horsemen.',
              quoteZh: '《史记·大宛列传》：“并南山，欲从羌中归，复为匈奴所得。”',
              quoteEn:
                'Records of the Grand Historian: "Skirting the Southern Mountains to return via Qiang territory, he was captured once more by the Xiongnu."',
            },
            {
              year: -126,
              eraZh: '元朔三年',
              coord: [109.35, 34.05],
              via: [[90.5, 37.2], [100.8, 36.1]],
              labelPos: 'bottom',
              ancientZh: '长安（归汉）',
              modernZh: '陕西西安',
              ancientEn: "Chang'an (Return)",
              modernEn: "Xi'an, Shaanxi",
              titleZh: '持节归朝·丝路凿空',
              titleEn: "Return to Chang'an — Opening the Silk Road",
              descZh:
                '元朔三年军臣单于死、匈奴内乱，张骞与胡妻及甘父逃归长安。出使十三载，百余人唯二人得还，封博望侯，史称“凿空”。',
              descEn:
                "Amid Xiongnu succession turmoil in 126 BCE, Zhang Qian escaped back to Chang'an with Ganfu—only two survivors of the original hundred—opening the Silk Road.",
              quoteZh: '《史记·大宛列传》：“初行时百余人，去十三岁，唯二人得还。”',
              quoteEn:
                'Records of the Grand Historian: "Of over a hundred men who set out, after thirteen years only two returned."',
            },
          ],
        },
        {
          key: 'xuanzang',
          dynastyKey: 'tang',
          color: '#9c6317',
          shortZh: '玄奘西行',
          shortEn: "Xuanzang's Pilgrimage",
          titleZh: '玄奘西行求法行迹',
          titleEn: "Xuanzang's Pilgrimage to the Western Regions",
          spanZh: '627年 — 645年（唐贞观元年至贞观十九年）',
          spanEn: '627 CE – 645 CE (Tang Dynasty, Zhenguan Era)',
          stops: [
            {
              year: 627,
              eraZh: '贞观元年',
              coord: [108.94, 34.26],
              labelPos: 'top',
              ancientZh: '长安',
              modernZh: '陕西西安',
              ancientEn: "Chang'an",
              modernEn: "Xi'an, Shaanxi",
              titleZh: '发足长安·孤身西迈',
              titleEn: "Departing Chang'an for the West",
              descZh:
                '为求《瑜伽师地论》梵本真义以释诸家纷歧，年二十八的玄奘大师自长安混迹灾民西出秦陇，立誓“不至天竺，终不东归一步”。',
              descEn:
                "Seeking original Sanskrit texts of the Yogacara-bhumi-sastra, Master Xuanzang departed Chang'an alone, vowing never to take a step back eastward before reaching India.",
              quoteZh: '《大慈恩寺三藏法师传》：“遂发足西行，自尔孑然孤游。”',
              quoteEn:
                'Biography of the Tripitaka Master: "Thus he set foot westward, traveling onward in solitary resolve."',
            },
            {
              year: 627,
              eraZh: '贞观元年',
              coord: [102.64, 37.93],
              labelPos: 'top',
              ancientZh: '凉州',
              modernZh: '甘肃武威',
              ancientEn: 'Liangzhou',
              modernEn: 'Wuwei, Gansu',
              titleZh: '凉州开讲·昼伏夜行',
              titleEn: 'Preaching in Liangzhou & Night Crossing',
              descZh:
                '抵河西都会凉州，受众僧礼请开讲《涅槃》《摄大乘论》月余，名震葱岭以东；因朝廷严禁私度边关，由慧威法师遣徒护送昼伏夜行西赴瓜州。',
              descEn:
                'In Liangzhou, Xuanzang lectured for over a month to great acclaim; evading border bans, he traveled by night and hid by day toward Guazhou.',
              quoteZh: '《大慈恩寺三藏法师传》：“凉州为河西都会，僧徒既多，请留开讲。”',
              quoteEn:
                'Biography of the Tripitaka Master: "Liangzhou was the metropolis of Hexi; its many monks entreated him to stay and lecture."',
            },
            {
              year: 627,
              eraZh: '贞观元年',
              coord: [95.78, 40.52],
              labelPos: 'bottom',
              ancientZh: '瓜州·玉门关',
              modernZh: '甘肃瓜州',
              ancientEn: 'Guazhou & Jade Gate',
              modernEn: 'Guazhou, Gansu',
              titleZh: '夜渡葫芦河·闯莫贺延碛',
              titleEn: 'Crossing the Gobi of Moheyan',
              descZh:
                '州吏李昌感其诚而暗撕通缉谍文。玄奘夜渡葫芦河、独闯五烽，于八百里莫贺延碛失手覆水，四夜五日滴水未进，绝处逢生终抵伊吾。',
              descEn:
                'Crossing the Hulu River by night past five watchtowers, Xuanzang survived five days and four nights without water in the 800-li Moheyan Desert.',
              quoteZh: '《大慈恩寺三藏法师传》：“莫贺延碛长八百余里，古曰沙河，上无飞鸟，下无走兽。”',
              quoteEn:
                'Biography of the Tripitaka Master: "The Moheyan Desert stretches over 800 li—no birds above, no beasts below."',
            },
            {
              year: 628,
              eraZh: '贞观二年',
              coord: [89.53, 42.85],
              labelPos: 'top',
              ancientZh: '高昌王城',
              modernZh: '新疆吐鲁番',
              ancientEn: 'Gaochang (Qocho)',
              modernEn: 'Turpan, Xinjiang',
              titleZh: '高昌结义·修书通西域',
              titleEn: 'Sworn Brotherhood with the King of Gaochang',
              descZh:
                '高昌王麴文泰虔礼挽留，玄奘水浆不涉三日以明西求大法之志；麴文泰感泣结为兄弟，修二十四封国书、备黄金百两与三十匹马护送西行。',
              descEn:
                'Moved by Xuanzang’s three-day fast, King Qu Wentai became his sworn brother and provided 24 diplomatic letters and provisions for the Western Regions.',
              quoteZh: '《大慈恩寺三藏法师传》：“任师西迈，乞垂早食……遂共结为兄弟。”',
              quoteEn:
                'Biography of the Tripitaka Master: "The King pledged to support his westward journey and swore brotherhood with him."',
            },
            {
              year: 628,
              eraZh: '贞观二年',
              coord: [82.96, 41.72],
              labelPos: 'bottom',
              ancientZh: '屈支（龟兹）',
              modernZh: '新疆库车',
              ancientEn: 'Kucha (Quzhi)',
              modernEn: 'Kuqa, Xinjiang',
              titleZh: '驻锡龟兹·翻越凌山雪岭',
              titleEn: 'Kucha Oasis & Crossing the Icy Tian Shan',
              descZh:
                '在龟兹与高僧木叉毱多论辩经义，因大雪封山逗留六十余日；开春后翻越积雪千尺的凌山（天山木扎尔特达坂），历经雪崩严寒出天山北麓。',
              descEn:
                'Delayed two months in Kucha by winter snows, Xuanzang then scaled the glacial Muzart Pass of the Tian Shan.',
              quoteZh: '《大唐西域记》：“山谷积雪，春夏合冻，虽时消泮，寻复结冰。”',
              quoteEn:
                'Great Tang Records on the Western Regions: "The mountain valleys are piled with snow, frozen through spring and summer."',
            },
            {
              year: 628,
              eraZh: '贞观二年',
              coord: [75.29, 42.83],
              labelPos: 'top',
              ancientZh: '碎叶城',
              modernZh: '吉尔吉斯斯坦托克马克',
              ancientEn: 'Suyab (Suiye)',
              modernEn: 'Tokmok, Kyrgyzstan',
              titleZh: '过大清池·会西突厥叶护可汗',
              titleEn: 'Audience with the Western Turkic Khagan at Suyab',
              descZh:
                '循大清池（伊塞克湖）西北行至碎叶城，恰逢西突厥统叶护可汗游猎。可汗设宴礼敬，命通解汉言及诸国语的摩咄达官率骑护送至迦毕试国境。',
              descEn:
                'Passing Lake Issyk-Kul to Suyab, Xuanzang met Tong Yabghu Khagan of the Western Turks, who assigned a multilingual envoy to escort him south.',
              quoteZh: '《大唐西域记》：“清池西北行五百余里至素叶水城，逢突厥叶护可汗方事畋游。”',
              quoteEn:
                'Great Tang Records: "Traveling 500 li northwest from the Clear Lake to Suyab, he met the Turkic Yabghu Khagan on a hunt."',
            },
            {
              year: 628,
              eraZh: '贞观二年',
              coord: [66.9, 36.76],
              via: [[69.6, 39.6]],
              labelPos: 'top',
              ancientZh: '缚喝（大夏）',
              modernZh: '阿富汗巴尔赫',
              ancientEn: 'Balkh (Fohe)',
              modernEn: 'Balkh, Afghanistan',
              titleZh: '过铁门关·参礼小王舍城',
              titleEn: 'Through the Iron Gate to Balkh',
              descZh:
                '经赭时（塔什干）、飒秣建（撒马尔罕），穿险峻铁门关，渡缚刍河（阿姆河）抵号称“小王舍城”的缚喝国，与般若羯罗法师切磋毗婆沙论。',
              descEn:
                'Passing Samarkand and the Iron Gate Pass across the Oxus to Balkh ("Little Rajagrha"), studying Abhidharma texts at Nava Vihara.',
              quoteZh: '《大唐西域记》：“缚喝国，伽蓝百有余所，僧徒三千余人。”',
              quoteEn:
                'Great Tang Records: "The Kingdom of Balkh has over a hundred monasteries and more than three thousand monks."',
            },
            {
              year: 629,
              eraZh: '贞观三年',
              coord: [71.52, 34.01],
              labelPos: 'bottom',
              ancientZh: '健驮逻',
              modernZh: '巴基斯坦白沙瓦',
              ancientEn: 'Gandhara (Purushapura)',
              modernEn: 'Peshawar, Pakistan',
              titleZh: '越雪山礼大佛·入天竺求法',
              titleEn: 'Crossing the Hindu Kush into Gandhara & India',
              descZh:
                '翻越大雪山（兴都库什山）、瞻礼梵衍那（巴米扬）石佛，入北天竺健驮逻故地；由此深游五印十余载，于那烂陀寺师从戒贤论师，并在曲女城十八国王大会立“真唯识量”。',
              descEn:
                'Crossing the Hindu Kush past Bamiyan into Gandhara, beginning over a decade across India culminating at Nalanda Monastery and the Grand Assembly of Kanauj.',
              quoteZh: '《大唐西域记》：“自古大圣贤，多生此国，作论诸师，亦多出此。”',
              quoteEn:
                'Great Tang Records: "Since antiquity, great sages and treatise-masters have arisen in this land of Gandhara."',
            },
            {
              year: 644,
              eraZh: '贞观十八年',
              coord: [79.92, 37.11],
              via: [[74.8, 36.9]],
              labelPos: 'bottom',
              ancientZh: '于阗（瞿萨旦那）',
              modernZh: '新疆和田',
              ancientEn: 'Khotan (Kustana)',
              modernEn: 'Hotan, Xinjiang',
              titleZh: '越葱岭载经东归·奉表唐廷',
              titleEn: 'Return via Khotan & Memorial to Emperor Taizong',
              descZh:
                '载梵本经论越帕米尔高原东归至于阗，遣使向唐太宗奉表陈情；此时大唐已平定高昌、设安西都护府，太宗降敕欣慰迎归，命沿途州县护送。',
              descEn:
                'Returning across the Pamirs to Khotan with Sanskrit scriptures, Xuanzang sent a memorial to Emperor Taizong, who issued an imperial edict welcoming him home.',
              quoteZh: '《进西域记表》：“冒越宪章，私往天竺……历览周游，一十七载。”',
              quoteEn:
                'Memorial to the Throne: "Having ventured beyond the border laws to India, I traveled and observed for seventeen years."',
            },
            {
              year: 645,
              eraZh: '贞观十九年',
              coord: [109.35, 34.05],
              via: [[91.0, 38.2], [101.5, 36.2]],
              labelPos: 'bottom',
              ancientZh: '长安（归唐）',
              modernZh: '陕西西安',
              ancientEn: "Chang'an (Return)",
              modernEn: "Xi'an, Shaanxi",
              titleZh: '归至京师·开场译经撰记',
              titleEn: "Triumphal Return to Chang'an & Translation Bureau",
              descZh:
                '贞观十九年正月返抵长安，朱雀街数十万人瞻礼迎奉六百五十七部梵经；后于弘福寺、大慈恩寺主持译场十九载，译经七十五部，撰成《大唐西域记》十二卷。',
              descEn:
                "Returning to Chang'an in 645 CE with 657 Sanskrit texts, Xuanzang led the imperial translation bureau for 19 years and compiled the Great Tang Records on the Western Regions.",
              quoteZh: '《旧唐书·玄奘传》：“贞观十九年，归至京师，太宗见之大悦，与之谈论。”',
              quoteEn:
                'Old Book of Tang: "In the 19th year of Zhenguan he returned to the capital; Emperor Taizong met him with great joy."',
            },
          ],
        },
        {
          key: 'sushi',
          dynastyKey: 'beisong',
          color: '#1f6f8b',
          shortZh: '苏轼贬谪路线',
          shortEn: "Su Shi's Exile",
          titleZh: '苏轼宦海贬谪行迹',
          titleEn: "Su Shi's Literary Exile Across Song China",
          spanZh: '1056年 — 1101年（北宋嘉祐元年至建中靖国元年）',
          spanEn: '1056 CE – 1101 CE (Northern Song Dynasty)',
          stops: [
            {
              year: 1056,
              eraZh: '嘉祐元年',
              coord: [103.85, 30.05],
              labelPos: 'bottom',
              ancientZh: '眉州',
              modernZh: '四川眉山',
              ancientEn: 'Meizhou',
              modernEn: 'Meishan, Sichuan',
              titleZh: '弱冠出蜀·仗剑远游',
              titleEn: 'Leaving Meizhou for the Imperial Capital',
              descZh:
                '年二十一的苏轼与弟苏辙随父苏洵自蜀中眉州启程，乘舟循岷江入长江，复由褒斜道越秦岭赴东京汴梁应试。',
              descEn:
                'At age twenty-one, Su Shi set out from Meizhou in Sichuan with his father Su Xun and brother Su Zhe to take the imperial examinations in Kaifeng.',
              quoteZh: '苏轼《初发嘉州》：“朝发鼓阗阗，西风猎画旃。故乡飘已远，往意浩无边。”',
              quoteEn:
                'Su Shi, Departing Jiazhou: "Morning drums thunder as the west wind snaps our painted banner; home drifts far behind, our aspirations boundless."',
            },
            {
              year: 1057,
              eraZh: '嘉祐二年',
              coord: [114.35, 34.79],
              via: [[108.5, 33.6]],
              labelPos: 'top',
              ancientZh: '东京开封府',
              modernZh: '河南开封',
              ancientEn: 'Dongjing Kaifeng',
              modernEn: 'Kaifeng, Henan',
              titleZh: '金榜题名·名动京师',
              titleEn: 'Triumph at the Kaifeng Imperial Court',
              descZh:
                '嘉祐二年春闱，主考官欧阳修读苏轼《刑赏忠厚之至论》惊喜击节，苏氏兄弟同科进士及第，文名震动汴京。',
              descEn:
                'Chief examiner Ouyang Xiu marveled at Su Shi’s essay in the 1057 examination, proclaiming that the older generation must make way for this rising genius.',
              quoteZh: '欧阳修《与梅圣俞书》：“读轼书，不觉汗出，快哉快哉！老夫当避路，放他出一头地也。”',
              quoteEn:
                'Ouyang Xiu: "Reading Su Shi’s essay brought beads of sweat in sheer delight—this old man must step aside and let him stand a head above!"',
            },
            {
              year: 1061,
              eraZh: '嘉祐六年',
              coord: [107.39, 34.52],
              labelPos: 'top',
              ancientZh: '凤翔府',
              modernZh: '陕西凤翔',
              ancientEn: 'Fengxiang',
              modernEn: 'Fengxiang, Shaanxi',
              titleZh: '初仕关中·签判凤翔',
              titleEn: 'First Official Post in Fengxiang',
              descZh:
                '制科入第三等，授大理评事、签书凤翔府判官。初历地方吏治，兴修东湖、革除衙前弊政，作《喜雨亭记》《石鼓歌》。',
              descEn:
                'Appointed magistrate-assessor in Fengxiang in Guanzhong, where he reformed corvée transport and composed Pavilion of Joyful Rain.',
              quoteZh: '苏轼《喜雨亭记》：“使天而雨珠，寒者不得以为襦；使天而雨玉，饥者不得以为粟。”',
              quoteEn:
                'Su Shi, Pavilion of Joyful Rain: "Were Heaven to rain pearls, the cold could not wear them as coats; were it to rain jade, the hungry could not eat it as grain."',
            },
            {
              year: 1071,
              eraZh: '熙宁四年',
              coord: [120.15, 30.28],
              via: [[114.6, 32.8]],
              labelPos: 'bottom',
              ancientZh: '杭州',
              modernZh: '浙江杭州',
              ancientEn: 'Hangzhou',
              modernEn: 'Hangzhou, Zhejiang',
              titleZh: '外放通判·寄情西湖',
              titleEn: 'Vice-Prefect of Hangzhou & West Lake',
              descZh:
                '因上书直陈王安石新法之弊，自请外放任杭州通判（后于元祐四年再知杭州浚湖筑苏堤），巡行属县、赈济灾荒，留下无数西湖诗篇。',
              descEn:
                'Opposing Wang Anshi’s New Policies, Su Shi requested provincial assignment as Vice-Prefect of Hangzhou, immortalizing West Lake in verse.',
              quoteZh: '苏轼《饮湖上初晴后雨》：“欲把西湖比西子，淡妆浓抹总相宜。”',
              quoteEn:
                'Su Shi: "If I may compare West Lake to Lady Xishi, in light makeup or rich adornment she is equally peerless."',
            },
            {
              year: 1075,
              eraZh: '熙宁八年',
              coord: [119.4, 35.99],
              labelPos: 'top',
              ancientZh: '密州',
              modernZh: '山东诸城',
              ancientEn: 'Mizhou',
              modernEn: 'Zhucheng, Shandong',
              titleZh: '知密州·超然豪放',
              titleEn: 'Governor of Mizhou — Birth of the Heroic Style',
              descZh:
                '主动求调密州知州，抗旱捕蝗、收养弃婴；于超然台思念胞弟苏辙，写就《水调歌头·明月几时有》与《江城子·密州出猎》，开宋词豪放一派。',
              descEn:
                'As Governor of Mizhou in Shandong, Su Shi pioneered the heroic ci-poetry style with "When Will the Bright Moon Be" and "Hunting at Mizhou."',
              quoteZh: '苏轼《水调歌头》：“人有悲欢离合，月有阴晴圆缺，此事古难全。但愿人长久，千里共婵娟。”',
              quoteEn:
                'Su Shi, Prelude to Water Melody: "Men have sorrow and joy, parting and reunion; the moon has clouds and clear skies, waxing and waning."',
            },
            {
              year: 1077,
              eraZh: '熙宁十年',
              coord: [117.18, 34.26],
              labelPos: 'top',
              ancientZh: '徐州·湖州',
              modernZh: '江苏徐州',
              ancientEn: 'Xuzhou & Huzhou',
              modernEn: 'Xuzhou, Jiangsu',
              titleZh: '徐州抗洪·乌台诗案',
              titleEn: 'Flood Defense at Xuzhou & the Crow Terrace Case',
              descZh:
                '知徐州时黄河决口迫城，苏轼布衣草履率禁军筑堤死守保住全城；元丰二年调知湖州，旋因诗文遭御史台弹劾逮赴汴京诏狱，史称“乌台诗案”。',
              descEn:
                'After saving Xuzhou from Yellow River floods, Su Shi was arrested in 1079 over alleged satire in his poems and imprisoned in the Imperial Censorate ("Crow Terrace Case").',
              quoteZh: '苏轼《狱中寄子由》：“是处青山可埋骨，他年夜雨独伤神。与君世世为兄弟，更结来生未了因。”',
              quoteEn:
                'Su Shi, From Prison to Ziyou: "Anywhere the green hills may bury my bones; in future years you will grieve alone in the night rain."',
            },
            {
              year: 1080,
              eraZh: '元丰三年',
              coord: [114.87, 30.45],
              labelPos: 'bottom',
              ancientZh: '黄州',
              modernZh: '湖北黄冈',
              ancientEn: 'Huangzhou',
              modernEn: 'Huanggang, Hubei',
              titleZh: '贬谪黄州·东坡赤壁',
              titleEn: 'Exile in Huangzhou — Dongpo & the Red Cliffs',
              descZh:
                '出狱后责授检校水部员外郎、黄州团练副使。躬耕城东荒坡自号“东坡居士”，于困顿中完成了精神蜕变，写出《定风波》《念奴娇·赤壁怀古》、前后《赤壁赋》与《寒食帖》。',
              descEn:
                'Banished to Huangzhou on the Yangtze, he farmed the "Eastern Slope" (taking the name Dongpo) and composed his greatest masterpieces at the Red Cliffs.',
              quoteZh: '苏轼《定风波》：“竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。”',
              quoteEn:
                'Su Shi, Calming the Waves: "Bamboo staff and straw sandals lighter than a steed—who fears? One straw cloak in misty rain for a lifetime."',
            },
            {
              year: 1094,
              eraZh: '绍圣元年',
              coord: [114.41, 23.11],
              via: [[115.2, 26.8]],
              labelPos: 'bottom',
              ancientZh: '惠州',
              modernZh: '广东惠州',
              ancientEn: 'Huizhou',
              modernEn: 'Huizhou, Guangdong',
              titleZh: '再贬岭南·寓居惠州',
              titleEn: 'Banished South of the Nanling to Huizhou',
              descZh:
                '元祐更化曾召还翰林学士、知杭州颖州扬州定州；绍圣元年哲宗亲政后新党复起，年近六旬的苏轼远贬岭南惠州安置，捐犀带助修东新桥、西新桥。',
              descEn:
                'Following political reversals in 1094, the nearly sixty-year-old Su Shi was banished across the Nanling Mountains to Huizhou in Guangdong.',
              quoteZh: '苏轼《食荔枝》：“日啖荔枝三百颗，不辞长作岭南人。”',
              quoteEn:
                'Su Shi, Eating Lychees: "Feasting on three hundred lychees a day, I would gladly remain a man of Lingnan forever."',
            },
            {
              year: 1097,
              eraZh: '绍圣四年',
              coord: [109.58, 19.52],
              via: [[110.3, 21.1]],
              labelPos: 'bottom',
              ancientZh: '儋州',
              modernZh: '海南儋州',
              ancientEn: 'Danzhou',
              modernEn: 'Danzhou, Hainan',
              titleZh: '渡海琼州·敷文儋耳',
              titleEn: 'Across the Sea to Danzhou (Hainan Island)',
              descZh:
                '六十二岁再贬琼州别驾、昌化军（儋州）安置。跨海抵天涯绝岛，居桄榔庵、食芋饮水、讲学授徒，开启琼州文教之风，培养出海南首位举人姜唐佐。',
              descEn:
                'At sixty-two, banished across the Qiongzhou Strait to Hainan Island, where he lived in a palm-thatched hut and mentored Hainan’s first provincial graduate.',
              quoteZh: '苏轼《六月二十日夜渡海》：“九死南荒吾不恨，兹游奇绝冠平生。”',
              quoteEn:
                'Su Shi, Crossing the Sea at Night: "Nine deaths in the southern wilds leave me no regret—this wondrous journey crowns my entire life."',
            },
            {
              year: 1101,
              eraZh: '建中靖国元年',
              coord: [119.97, 31.81],
              via: [[114.9, 25.8], [117.2, 29.8]],
              labelPos: 'top',
              ancientZh: '常州',
              modernZh: '江苏常州',
              ancientEn: 'Changzhou',
              modernEn: 'Changzhou, Jiangsu',
              titleZh: '遇赦北归·终老毗陵',
              titleEn: 'Pardoned Return North & Final Rest in Changzhou',
              descZh:
                '元符三年徽宗即位大赦北归，渡海经廉州、永州沿赣江北上；建中靖国元年七月廿八日病逝于常州顾塘桥孙氏馆，享年六十六岁。',
              descEn:
                'Pardoned in 1100, Su Shi traveled north by boat and passed away in Changzhou in July 1101 at age sixty-six, summing up his life in a final self-portrait poem.',
              quoteZh: '苏轼《自题金山画像》：“心似已灰之木，身如不系之舟。问汝平生功业，黄州惠州儋州。”',
              quoteEn:
                'Su Shi, Inscription on My Portrait at Jinshan: "My heart like ashen wood, my body an unmoored boat. Ask of my life’s achievements: Huangzhou, Huizhou, Danzhou."',
            },
          ],
        },
      ];
    }

    startJourney(journeyKey, stopIdx = 0) {
      const journeys = HistoricalAtlasController.HISTORICAL_JOURNEYS;
      const found = journeys.find((j) => j.key === journeyKey) || journeys[0];
      if (!found) return;

      this.stopAutoplay();
      if (this.journeyTimer) {
        clearInterval(this.journeyTimer);
        this.journeyTimer = null;
      }
      if (this.challenge) this.stopChallenge();
      if (this.genealogyMode) this.toggleGenealogyMode(false);
      this.closeGenealogyCard();
      this.closeMilestoneBalloon();

      this.activeJourney = found;
      this.journeyStopIdx = Math.max(0, Math.min(found.stops.length - 1, stopIdx));

      const vf = this._id('viewport-frame');
      if (vf) vf.classList.add('has-active-journey');
      if (this.journeyCard) this.journeyCard.classList.remove('is-hidden');

      document.querySelectorAll('.journey-chip-btn').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.journey === found.key);
      });

      const stop = found.stops[this.journeyStopIdx];
      if (stop) this.jumpToYear(stop.year);

      this._renderJourneyOverlay();
      this._renderJourneyCard();

      if (stopIdx === 0) {
        this._frameJourneyOverview(found);
      } else if (stop) {
        this._flyToJourneyStop(stop);
      }
    }

    stopJourney() {
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
      document.querySelectorAll('.journey-chip-btn').forEach((btn) => {
        btn.classList.remove('is-active');
      });
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
      const spanW = Math.max(maxX - minX + 110, (maxY - minY + 120) / 0.7) * 1.18;
      const w = Math.max(320, Math.min(960, spanW));
      const h = w * 0.7;
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
      const w = Math.max(360, Math.min(this.camera.w, 540));
      const h = w * 0.7;
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
            stops[i].coord,
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

      const jDyn = this.dynasties.find((d) => d.key === j.dynastyKey);
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
          keywords: `${j.shortZh} ${j.titleZh} ${j.shortEn} ${j.titleEn} 行迹 路线 丝绸之路 贬谪 西行 东坡 ${stopNames}`.toLowerCase(),
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
        if (d.key === 'prc') continue;
        for (const s of d.settlements || []) {
          const yr = s.appear !== undefined ? Math.max(d.fromYear, s.appear) : d.focusYear;
          const ancEn = this._enDict(s.ancient);
          const modEn = this._enDict(s.modern || '');
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
            keywords: `${s.ancient} ${s.modern || ''} ${s.remark || ''} ${ancEn} ${modEn} ${remEn}`.toLowerCase(),
          });
        }
      }

      // 2. Prefectures & Macro Regions across snapshots
      const seenAdmin = new Set();
      for (const d of this.dynasties) {
        if (d.key === 'prc') continue;
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

      if (item.kind === 'journey' && item.journeyKey) {
        this.startJourney(item.journeyKey, 0);
        return;
      }

      this.jumpToYear(item.year);

      if (item.kind === 'city' && item.coord) {
        if (!this._id('chk-settlements').checked) {
          this._id('chk-settlements').checked = true;
          this.grpSettlements.classList.remove('is-hidden');
        }
        const targetZoom = item.tier === 2 ? 2.2 : 1.85;
        const [tx, ty] = this.projector.toScreen(item.coord[0], item.coord[1]);
        const w = Math.min(this.camera.w, 1000 / targetZoom);
        const h = w * 0.7;
        this._animateCameraTo({ x: tx - w * 0.5, y: ty - h * 0.45, w, h });
        this.openGenealogyAt(item.coord[0], item.coord[1]);
      } else if ((item.kind === 'prefecture' || item.kind === 'region') && item.coord) {
        if (!this._id('chk-prefectures').checked) {
          this._id('chk-prefectures').checked = true;
          this.grpPrefectures.classList.remove('is-hidden');
        }
        const [tx, ty] = this.projector.toScreen(item.coord[0], item.coord[1]);
        const w = Math.min(this.camera.w, 1000 / 1.95);
        const h = w * 0.7;
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
        searchInp.addEventListener('input', renderSearchDropdown);
        searchInp.addEventListener('focus', renderSearchDropdown);
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
            searchInp.blur();
          }
        });
        document.addEventListener('pointerdown', (e) => {
          const box = this._id('map-search-box');
          if (box && !box.contains(e.target)) {
            searchList.classList.add('is-hidden');
          }
        });
      }

      // Layer popover menu & checkboxes
      const layerIds = [
        'chk-polities',
        'chk-prefectures',
        'chk-settlements',
        'chk-corridors',
        'chk-milestones',
        'chk-terrain',
        'chk-provinces',
        'chk-prov-names',
      ];
      const updateLayerBadge = () => {
        const badge = this._id('layers-count-badge');
        if (!badge) return;
        const onCount = layerIds.filter((id) => {
          const el = this._id(id);
          return el && el.checked;
        }).length;
        badge.textContent = `${onCount}/${layerIds.length}`;
      };
      updateLayerBadge();

      const layersBtn = this._id('act-layers-menu');
      const layersPopover = this._id('layers-popover');
      const closeLayersPopover = () => {
        if (!layersPopover || !layersBtn) return;
        layersPopover.classList.add('is-hidden');
        layersBtn.classList.remove('is-active');
        layersBtn.setAttribute('aria-expanded', 'false');
      };
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
        layersPopover.querySelectorAll('.journey-chip-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            closeLayersPopover();
            if (this.activeJourney && this.activeJourney.key === btn.dataset.journey) {
              this.stopJourney();
            } else {
              this.startJourney(btn.dataset.journey, 0);
            }
          });
        });
      }

      const bindToggle = (chkId, grpEl, inv = false) => {
        this._id(chkId).addEventListener('change', (e) => {
          grpEl.classList.toggle('is-hidden', inv ? e.target.checked : !e.target.checked);
          updateLayerBadge();
          this._rescaleSvgTypography();
        });
      };
      const chkTerrain = this._id('chk-terrain');
      if (chkTerrain) {
        chkTerrain.addEventListener('change', (e) => {
          this.toggleTerrainMode(e.target.checked);
          updateLayerBadge();
        });
      }
      const actTerrain = this._id('act-terrain');
      if (actTerrain) {
        actTerrain.addEventListener('click', () => {
          this.toggleTerrainMode();
          updateLayerBadge();
        });
      }
      bindToggle('chk-provinces', this.grpProvinces);
      bindToggle('chk-prov-names', this.grpProvNames);
      this._id('chk-polities').addEventListener('change', (e) => {
        this.grpPolities.classList.toggle('is-hidden', !e.target.checked);
        if (this.grpGhostDiff) {
          this.grpGhostDiff.classList.toggle('is-hidden', !e.target.checked);
        }
        updateLayerBadge();
        this._rescaleSvgTypography();
      });
      bindToggle('chk-prefectures', this.grpPrefectures);
      this._id('chk-settlements').addEventListener('change', (e) => {
        if (this.challenge) return;
        this.grpSettlements.classList.toggle('is-hidden', !e.target.checked);
        updateLayerBadge();
        this._rescaleSvgTypography();
      });
      bindToggle('chk-corridors', this.grpCorridors);
      this._id('chk-milestones').addEventListener('change', (e) => {
        this.grpMilestones.classList.toggle('is-hidden', !e.target.checked);
        if (!e.target.checked) this.closeMilestoneBalloon();
        updateLayerBadge();
        this._rescaleSvgTypography();
      });

      this._id('act-reset-camera').addEventListener('click', () => this.resetCamera());
      const togglePaneBtn = this._id('act-toggle-pane');
      if (togglePaneBtn) {
        togglePaneBtn.addEventListener('click', () => this.toggleChroniclePane());
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
      const actGenBtn = this._id('act-genealogy');
      if (actGenBtn) {
        actGenBtn.addEventListener('click', () => this.toggleGenealogyMode());
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
      this._id('tab-locate').addEventListener('click', () => this.startChallenge('locate'));
      this._id('tab-match').addEventListener('click', () => this.startChallenge('match'));
      this._id('act-next-round').addEventListener('click', () => {
        if (!this.challenge || this._id('act-next-round').onclick) return;
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

      // Scrubber dragging (smooth continuous scrubbing anywhere on the bar)
      const track = this._id('scrubber-track');
      let scrubbing = false;
      const scrubAt = (clientX) => {
        const r = track.getBoundingClientRect();
        this.jumpToYear(this._progressToYear((clientX - r.left) / r.width));
      };
      track.addEventListener('pointerdown', (e) => {
        if (this.challenge) return;
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
        } else if (e.key === ' ') {
          e.preventDefault();
          if (this.activeJourney) {
            this.toggleJourneyAutoplay();
            return;
          }
          if (this.playing) this.stopAutoplay();
          else this.startAutoplay();
        } else if (e.key === 'Escape') {
          closeLayersPopover();
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
          };
        }
      });

      this.svg.addEventListener('pointermove', (e) => {
        if (this.activePointers.has(e.pointerId)) {
          this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        if (this.activePointers.size === 2 && this.pinchState) {
          const pts = Array.from(this.activePointers.values());
          const dist = Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
          const factor = dist / this.pinchState.startDist;
          const nextW = Math.max(100, Math.min(1300, this.pinchState.camW / factor));
          const k = nextW / this.pinchState.camW;
          const midX = (pts[0].x + pts[1].x) * 0.5;
          const midY = (pts[0].y + pts[1].y) * 0.5;
          const rect = this.svg.getBoundingClientRect();
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
          this.svg.classList.add('is-panning');
          if (e.pointerType === 'touch') {
            this.hoverTip.classList.add('is-hidden');
          }
        }
        if (this.didPan) {
          const rect = this.svg.getBoundingClientRect();
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
        const settlementNameEl = findClosest('.settlement-node .name');
        const settlementEl = findClosest('.settlement-node');
        const corridorEl = findClosest('.corridor-line');
        const milestoneEl = findClosest('.milestone-pin');
        const cur = this.dynasties[this.dynastyIdx];
        const mHit = milestoneEl && cur ? this._resolvePinMilestone(cur, milestoneEl) : null;
        const coCity =
          !settlementEl && mHit && mHit.coord
            ? this._findCoLocatedSettlement(cur, mHit.coord[0], mHit.coord[1], 28)
            : null;

        if (journeyNodeEl && this.activeJourney) {
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
              mHit.site ? SVG_ICONS.pin + ' ' + this.trTerm(mHit.site) + ' · ' : ''
            }${actionHint}</div>`
          );
        } else if (settlementEl || coCity) {
          const rawAnc = settlementEl ? settlementEl.dataset.ancient : coCity.ancient;
          const rawMod = settlementEl ? settlementEl.dataset.modern : coCity.modern || '';
          const rawRem = settlementEl ? settlementEl.dataset.remark : coCity.remark || '';
          const anc = this.trTerm(rawAnc);
          const mod = this.trTerm(rawMod);
          const rem = this.trTerm(rawRem);
          const traceHint = this.locale === 'en' ? ' · Click to trace history' : ' · 点击查看历代沿革';
          const sub =
            this.locale === 'en'
              ? `${mod && mod !== anc ? 'Now ' + mod : 'Same modern name'}${rem ? ' · ' + rem : ''}${traceHint}`
              : `${mod && mod !== anc ? '今 ' + mod : '古今同名'}${rem ? ' · ' + rem : ''}${traceHint}`;
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
        if (!wasPan && this.challenge && !this.challenge.answered && this.challenge.variant === 'locate') {
          const [sx, sy] = this._clientToSvgPoint(e.clientX, e.clientY);
          this._evaluateLocateClick(sx, sy);
        } else if (!wasPan && !this.challenge) {
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
            if (this.journeyTimer) {
              clearInterval(this.journeyTimer);
              this.journeyTimer = null;
            }
            this.goToJourneyStop(Number(journeyNodeEl.dataset.stopIdx), true);
            return;
          }
          const settlementNameEl = findClosest('.settlement-node .name');
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

          // Clicking the city name text (e.g. "长安") or a city dot without an overlapping event pin -> trace place history
          if (
            settlementEl &&
            settlementEl.dataset.lng &&
            settlementEl.dataset.lat &&
            (settlementNameEl || !milestoneEl)
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

    _restoreFromQuery() {
      const q = new URLSearchParams(location.search);
      if (q.has('terrain')) {
        const tv = q.get('terrain');
        this.toggleTerrainMode(tv !== '0' && tv !== 'false');
      }
      if (q.has('year')) {
        const y = Number(q.get('year'));
        if (!Number.isNaN(y)) this.jumpToYear(y);
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
      if (q.has('trace')) {
        const [lng, lat] = q.get('trace').split(',').map(Number);
        if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
          this.toggleGenealogyMode(true);
          setTimeout(() => this.openGenealogyAt(lng, lat), 400);
        }
      }
      if (q.has('quiz')) {
        const mode = q.get('quiz') === 'match' ? 'match' : 'locate';
        setTimeout(() => this.startChallenge(mode), 350);
      }
      if (q.has('journey')) {
        const jKey = q.get('journey');
        const stopIdx = q.has('stop') ? Number(q.get('stop')) : 0;
        setTimeout(() => this.startJourney(jKey, Number.isNaN(stopIdx) ? 0 : stopIdx), 200);
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

  window.addEventListener('DOMContentLoaded', () => {
    window.atlasApp = new HistoricalAtlasController();
  });
})();
