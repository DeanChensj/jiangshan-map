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
      if (shapeObj.type === 'Polygon') {
        return shapeObj.coordinates.map((r) => this.ringToSvgPath(r)).join('');
      }
      if (shapeObj.type === 'MultiPolygon') {
        return shapeObj.coordinates
          .map((poly) => poly.map((r) => this.ringToSvgPath(r)).join(''))
          .join('');
      }
      return '';
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
      this.activeTrace = null;
      this.activeMilestone = null;
      this.challenge = null;
      this.challengeVariant = 'locate';
      this.paneCollapsed = false;
      this.ghostTimer = null;

      this.camera = { x: 0, y: 0, w: 1000, h: 700, zoom: 1 };
      this.flyRaf = null;
      this.dragState = null;
      this.didPan = false;
      this.snapshotCache = {};

      this._bindDom();
      this._applyCamera();
      this._buildModernProvinces();
      this._buildNeighborCountries();
      this._buildScrubberBands();
      this._attachListeners();
      this.applyLocale();

      this.jumpToYear(this.dynasties[0].focusYear);
      this._restoreFromQuery();
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
      this.grpNeighbors = this._id('grp-neighbors');
      this.grpProvinces = this._id('grp-provinces');
      this.grpProvNames = this._id('grp-prov-names');
      this.grpPolities = this._id('grp-polities');
      this.grpPrefectures = this._id('grp-prefectures');
      this.grpGhostDiff = this._id('grp-ghost-diff');
      this.grpCorridors = this._id('grp-corridors');
      this.grpSettlements = this._id('grp-settlements');
      this.grpMilestones = this._id('grp-milestones');
      this.grpChallenge = this._id('grp-challenge');
      this.grpGenealogy = this._id('grp-genealogy');
      this.hoverTip = this._id('hover-tip');
      this.mapKey = this._id('map-key');
      this.milestoneBalloon = this._id('milestone-balloon');
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
        const key = `${d.key}:${m.year}`;
        const hit = this.enLocale.milestones && this.enLocale.milestones[key];
        if (Array.isArray(hit) && hit[1]) return hit[1];
      }
      return this.trTerm(m.site);
    }

    corridorTitle(c) {
      return this.locale === 'en' && this.enLocale.corridors[c.key]
        ? this.enLocale.corridors[c.key].name
        : c.title;
    }

    corridorSummary(c) {
      return this.locale === 'en' && this.enLocale.corridors[c.key]
        ? this.enLocale.corridors[c.key].note
        : c.summary;
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
      const grpHist = this._id('txt-layer-grp-hist');
      if (grpHist) {
        grpHist.textContent = this.uiStr('layer_grp_hist', '历史舆图要素');
      }
      const grpMod = this._id('txt-layer-grp-mod');
      if (grpMod) {
        grpMod.textContent = this.uiStr('layer_grp_mod', '现代地理参照');
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
      lblGen.textContent = this.genealogyMode
        ? this.uiStr('btn_trace_active', '退出溯源')
        : this.uiStr('btn_trace', '点地溯源');
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
        '滚轮缩放 · 拖拽平移 · ← → 调整年份 · 空格播放 · Esc 关闭弹窗'
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
            ? 'Search city / prefecture / era / event ( / )'
            : '搜古今地名 / 州府 / 年号 / 事件 ( / )';
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
      if (this.challenge) {
        this.grpSettlements.classList.add('is-hidden');
        if (!this.challenge.answered && this.challenge.index < this.challenge.deck.length) {
          this.presentChallengeRound();
        }
      }
    }

    // ---------------- Base Layers ----------------
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
        const dy1 = align === 'b' ? 9.5 : -0.5;
        const dy2 = align === 'b' ? 17.5 : 7.8;

        const nameEl = this._svgNode(
          'text',
          { class: 'name', x: dx, y: dy1, 'text-anchor': anchor },
          node
        );
        nameEl.textContent = this.trTerm(item.ancient);

        if (item.modern && item.modern !== item.ancient) {
          const modEl = this._svgNode(
            'text',
            { class: 'modern', x: dx, y: dy2, 'text-anchor': anchor },
            node
          );
          modEl.textContent =
            this.locale === 'en'
              ? `${this.uiStr('now_prefix', 'now ')}${this.trTerm(item.modern)}`
              : `今${item.modern}`;
        }
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
        pin.addEventListener('click', (e) => {
          e.stopPropagation();
          this.stopAutoplay();
          this.jumpToYear(this._clampYearToDynasty(dynasty, m.year));
          this.openMilestoneBalloon(dynasty, m);
          if (m.coord) this._panToward(m.coord[0], m.coord[1]);
        });
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

    openMilestoneBalloon(dynasty, m) {
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
      const placeHtml = siteStr ? `<span class="ep-place">${SVG_ICONS.pin} ${siteStr}</span>` : '';
      this.milestoneBalloon.innerHTML =
        `<div><span class="ep-year">${yrText} · ${this.formatEraLabel(m.year, dynasty)}</span>${placeHtml}</div>` +
        `<div class="ep-text">${this.milestoneHeadline(dynasty, m)}</div>`;
      this.milestoneBalloon.classList.remove('is-hidden');
      this._positionMilestoneBalloon();
    }

    _positionMilestoneBalloon() {
      if (!this.activeMilestone || !this.activeMilestone.milestone.coord) return;
      const [sx, sy] = this.projector.toScreen(
        this.activeMilestone.milestone.coord[0],
        this.activeMilestone.milestone.coord[1]
      );
      const rect = this.svg.getBoundingClientRect();
      const px = ((sx - this.camera.x) / this.camera.w) * rect.width;
      const py = ((sy - this.camera.y) / this.camera.h) * rect.height;
      const left = Math.max(12, Math.min(rect.width - 290, px + 12));
      const top = Math.max(12, Math.min(rect.height - 90, py - 24));
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
      const curDyn = this.dynasties[this.dynastyIdx];
      if (curDyn && Array.isArray(curDyn.phases) && curDyn.phases.length > 1) {
        const phases = curDyn.phases;
        let pIdx = phases.findIndex((ph) => this.year < ph.until);
        if (pIdx === -1) pIdx = phases.length - 1;
        const phaseStart = (idx) => (idx <= 0 ? curDyn.fromYear : phases[idx - 1].until);
        const curSy = phaseStart(pIdx);
        const curEy = phases[pIdx].until - 1;
        const spanText = `${this.formatYear(curSy, true)}—${this.formatYear(curEy, true)}`;

        const bar = document.createElement('div');
        bar.className = 'key-phase-bar';

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

        this.mapKey.appendChild(bar);
      }

      if (snap.caption) {
        const h = document.createElement('div');
        h.className = 'key-heading';
        h.textContent = this.trTerm(snap.caption);
        this.mapKey.appendChild(h);
      }
      const grid = document.createElement('div');
      grid.className = 'key-grid';
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
        entry.className = 'key-entry is-interactive';
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
          row.className = 'key-grid';
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
        li.innerHTML = `<span class="ev-yr">${yrLabel}</span><span>${this.milestoneHeadline(dynasty, m)}${badge}</span>`;
        li.addEventListener('click', () => {
          this.stopAutoplay();
          this.jumpToYear(targetY);
          this.openMilestoneBalloon(dynasty, m);
          if (snapShift) {
            if (this.camera.w < 780) this.resetCamera();
          } else if (m.coord) {
            this._panToward(m.coord[0], m.coord[1]);
          }
        });
        ul.appendChild(li);
      }
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
      this._id('act-genealogy').classList.toggle('is-active', this.genealogyMode);
      const lblEl = this._id('lbl-genealogy') || this._id('act-genealogy');
      lblEl.textContent = this.genealogyMode
        ? this.uiStr('btn_trace_active', '退出溯源')
        : this.uiStr('btn_trace', '点地溯源');
      this.svg.classList.toggle('is-crosshair', this.genealogyMode || Boolean(this.challenge));
      if (!this.genealogyMode && !this._id('genealogy-card').classList.contains('is-hidden')) {
        this.closeGenealogyCard();
      }
    }

    closeGenealogyCard() {
      this.activeTrace = null;
      this._id('genealogy-card').classList.add('is-hidden');
      this.grpGenealogy.innerHTML = '';
    }

    openGenealogyAt(lng, lat) {
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
      this._rescaleSvgTypography();

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
      this._id('genealogy-sub').textContent =
        `${lng.toFixed(2)}°E, ${lat.toFixed(2)}°N · ` +
        this.uiStr('trace_click_hint', '点击任一朝代可切换地图');

      const listEl = this._id('genealogy-timeline');
      listEl.innerHTML = '';

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
        const li = document.createElement('li');
        if (isCurDyn) li.classList.add('is-current');
        const mainStr = adminHits.length
          ? adminHits.join(' · ')
          : polityHit
            ? this.trTerm(polityHit)
            : this.uiStr('beyond_recorded', '（域外 / 未设郡县）');

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
            `${this.uiStr('near_city', '邻近古城：')}${this.trTerm(near.s.ancient)}（${distStr}）`
          );
        }

        li.innerHTML =
          `<span class="t-era">${this.dynastyName(d)}</span>` +
          `<span class="t-val">${mainStr}${
            subParts.length ? `<span class="t-sub">${subParts.join(' · ')}</span>` : ''
          }</span>`;
        li.addEventListener('click', () => this.jumpToYear(d.focusYear));
        listEl.appendChild(li);
      }

      this._id('genealogy-card').classList.remove('is-hidden');
      const curLi = listEl.querySelector('li.is-current');
      if (curLi && listEl.scrollHeight > listEl.clientHeight) {
        const top = Math.max(0, curLi.offsetTop - listEl.offsetTop - listEl.clientHeight * 0.38);
        listEl.scrollTop = top;
      }
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
      const showTier2 = z >= 1.75;
      this.svg.classList.toggle('is-zoomed-cities', showTier2);

      const showSettlements = !this.grpSettlements.classList.contains('is-hidden');
      const showPrefectures = !this.grpPrefectures.classList.contains('is-hidden');
      const showCorridors = !this.grpCorridors.classList.contains('is-hidden');
      const showMilestones = !this.grpMilestones.classList.contains('is-hidden');

      // Scale static markers (milestones, challenge pins, genealogy overlays)
      this.svg
        .querySelectorAll(
          '.neighbor-caption, .milestone-pin, #grp-challenge g[data-x], #grp-genealogy g[data-x]'
        )
        .forEach((node) => {
          const x = node.getAttribute('data-x');
          const y = node.getAttribute('data-y');
          if (x !== null) {
            node.setAttribute('transform', `translate(${x},${y}) scale(${invScale})`);
          }
        });

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
        const modEl = node.querySelector('.modern');
        const tier = node.dataset.tier || '1';
        const f1 = tier === '0' ? 9.6 : tier === '2' ? 7.3 : 8.2;
        const f2 = tier === '2' ? 6.0 : 6.6;
        const wLocal =
          Math.max(
            this._estimateLocalTextWidth(nameEl.textContent, f1, 0.45),
            modEl ? this._estimateLocalTextWidth(modEl.textContent, f2, 0.2) : 0
          ) + 7;

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
              dy1: -0.5,
              dy2: 7.8,
              box: {
                x1: cx - (5.5 + wLocal) * s,
                y1: cy - 10.5 * s,
                x2: cx - 3.5 * s,
                y2: cy + (modEl ? 10.8 : 2.8) * s,
              },
            };
          }
          if (dir === 'b') {
            return {
              anchor: 'middle',
              dx: 0,
              dy1: 9.5,
              dy2: 17.5,
              box: {
                x1: cx - wLocal * 0.52 * s,
                y1: cy + 2.0 * s,
                x2: cx + wLocal * 0.52 * s,
                y2: cy + (modEl ? 20.5 : 12.8) * s,
              },
            };
          }
          if (dir === 't') {
            return {
              anchor: 'middle',
              dx: 0,
              dy1: modEl ? -10.5 : -4.5,
              dy2: -2.8,
              box: {
                x1: cx - wLocal * 0.52 * s,
                y1: cy - (modEl ? 20.2 : 13.5) * s,
                x2: cx + wLocal * 0.52 * s,
                y2: cy - 1.8 * s,
              },
            };
          }
          return {
            anchor: 'start',
            dx: 5.5,
            dy1: -0.5,
            dy2: 7.8,
            box: {
              x1: cx + 3.5 * s,
              y1: cy - 10.5 * s,
              x2: cx + (5.5 + wLocal) * s,
              y2: cy + (modEl ? 10.8 : 2.8) * s,
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
        if (modEl) {
          modEl.setAttribute('x', String(best.dx));
          modEl.setAttribute('y', String(best.dy2));
          modEl.setAttribute('text-anchor', best.anchor);
        }
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

      // Tier 3: Corridor captions
      this.svg.querySelectorAll('.corridor-caption').forEach((node) => {
        const cx = parseFloat(node.getAttribute('data-x'));
        const cy = parseFloat(node.getAttribute('data-y'));
        if (!isNaN(cx)) {
          node.setAttribute('transform', `translate(${cx.toFixed(1)},${cy.toFixed(1)}) scale(${invScale})`);
          if (showCorridors) {
            const hw = (this._estimateLocalTextWidth(node.textContent, 8.2, 1.4) * 0.5 + 3) * s;
            const hh = 5.5 * s;
            occupied.push({ x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh });
          }
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
      this._animateCameraTo({ x: 0, y: 0, w: 1000, h: 700 });
    }

    _panToward(lng, lat) {
      const [tx, ty] = this.projector.toScreen(lng, lat);
      const w = Math.min(this.camera.w, 1000 / 2.4);
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
        ? `（${this.trTerm(cur.settlement.remark)}）`
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
      aLabel.textContent = `${this.trTerm(cur.settlement.ancient)}（${
        this.locale === 'en' ? this.trTerm(cur.settlement.modern) : '今' + cur.settlement.modern
      }）`;
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

    // ---------------- Global Quick Search ----------------
    _ensureSearchIndex() {
      if (this.searchIndex) return this.searchIndex;
      const entries = [];

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
        if (!q) {
          searchList.classList.add('is-hidden');
          currentResults = [];
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
        const kindLabel = {
          dynasty: this.locale === 'en' ? 'Dynasty' : '朝代',
          era: this.locale === 'en' ? 'Era' : '纪年',
          city: this.locale === 'en' ? 'City' : '古城',
          prefecture: this.locale === 'en' ? 'Prefecture' : '州府',
          region: this.locale === 'en' ? 'Circuit/Prov' : '大区',
          event: this.locale === 'en' ? 'Event' : '史事',
        };
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
            Array.from(searchList.children).forEach((el, i) =>
              el.classList.toggle('is-active', i === activeSearchIdx)
            );
          } else if (e.key === 'ArrowUp' && currentResults.length) {
            e.preventDefault();
            activeSearchIdx = (activeSearchIdx - 1 + currentResults.length) % currentResults.length;
            Array.from(searchList.children).forEach((el, i) =>
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
      }

      const bindToggle = (chkId, grpEl, inv = false) => {
        this._id(chkId).addEventListener('change', (e) => {
          grpEl.classList.toggle('is-hidden', inv ? e.target.checked : !e.target.checked);
          updateLayerBadge();
          this._rescaleSvgTypography();
        });
      };
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
      this._id('act-genealogy').addEventListener('click', () => this.toggleGenealogyMode());
      this._id('act-close-genealogy').addEventListener('click', () => this.toggleGenealogyMode(false));

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
          const step = e.shiftKey ? 50 : 10;
          this.jumpToYear(this.year + (e.key === 'ArrowRight' ? step : -step));
        } else if (e.key === 'Home' && !this.challenge) {
          this.jumpToYear(this.minYear);
        } else if (e.key === 'End' && !this.challenge) {
          this.jumpToYear(this.maxYear);
        } else if (e.key === ' ') {
          e.preventDefault();
          if (this.playing) this.stopAutoplay();
          else this.startAutoplay();
        } else if (e.key === 'Escape') {
          closeLayersPopover();
          this.closeMilestoneBalloon();
          if (this.genealogyMode) this.toggleGenealogyMode(false);
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

      this.svg.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.svg.setPointerCapture(e.pointerId);

        if (this.activePointers.size === 1) {
          this.didPan = false;
          this.pinchState = null;
          this.dragState = {
            startX: e.clientX,
            startY: e.clientY,
            camX: this.camera.x,
            camY: this.camera.y,
          };
        } else if (this.activePointers.size === 2) {
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
        const settlementEl = target && target.closest && target.closest('.settlement-node');
        const corridorEl = target && target.closest && target.closest('.corridor-line');
        const milestoneEl = target && target.closest && target.closest('.milestone-pin');

        if (settlementEl) {
          const anc = this.trTerm(settlementEl.dataset.ancient);
          const mod = this.trTerm(settlementEl.dataset.modern);
          const rem = this.trTerm(settlementEl.dataset.remark);
          const traceHint = this.locale === 'en' ? ' · Click to trace' : ' · 点击查看沿革';
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
        } else if (milestoneEl) {
          const cur = this.dynasties[this.dynastyIdx];
          const m =
            (milestoneEl.dataset.idx !== undefined &&
              (cur.milestones || [])[Number(milestoneEl.dataset.idx)]) ||
            (cur.milestones || []).find((item) => item.year === Number(milestoneEl.dataset.year));
          if (m) {
            const eraPart = this.locale === 'en' ? '' : ` · ${this.formatEraLabel(m.year, cur)}`;
            this._showHoverTip(
              e,
              `<b>${this.formatYear(m.year)}${eraPart} · ${this.milestoneHeadline(cur, m)}</b><div class="tt-sub">${
                m.site ? SVG_ICONS.pin + ' ' + this.trTerm(m.site) + ' · ' : ''
              }${this.uiStr('click_for_detail', '点击查看详情')}</div>`
            );
          }
        } else if (
          target &&
          target.dataset &&
          (target.dataset.prefTitle ||
            target.dataset.polityTitle ||
            target.dataset.provTitle ||
            target.dataset.countryTitle)
        ) {
          const stack = document.elementsFromPoint(e.clientX, e.clientY);
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
          this._showHoverTip(e, lines.join(''));
        } else {
          this.hoverTip.classList.add('is-hidden');
        }
      };

      const endPointer = (e) => {
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
        const wasPan = this.didPan;
        this.dragState = null;
        this.svg.classList.remove('is-panning');
        if (!wasPan && this.challenge && !this.challenge.answered && this.challenge.variant === 'locate') {
          const [sx, sy] = this._clientToSvgPoint(e.clientX, e.clientY);
          this._evaluateLocateClick(sx, sy);
        } else if (!wasPan && !this.challenge) {
          const hitTarget = document.elementFromPoint(e.clientX, e.clientY) || e.target;
          const milestoneEl = hitTarget && hitTarget.closest && hitTarget.closest('.milestone-pin');
          if (milestoneEl && milestoneEl.dataset.idx !== undefined) {
            const cur = this.dynasties[this.dynastyIdx];
            const m = (cur.milestones || [])[Number(milestoneEl.dataset.idx)];
            if (m) {
              this.stopAutoplay();
              this.jumpToYear(this._clampYearToDynasty(cur, m.year));
              this.openMilestoneBalloon(cur, m);
              if (m.coord) this._panToward(m.coord[0], m.coord[1]);
              return;
            }
          }
          if (this.genealogyMode) {
            const [sx, sy] = this._clientToSvgPoint(e.clientX, e.clientY);
            const [lng, lat] = this.projector.toGeo(sx, sy);
            this.openGenealogyAt(lng, lat);
            return;
          }
          const settlementEl = hitTarget && hitTarget.closest && hitTarget.closest('.settlement-node');
          if (settlementEl && settlementEl.dataset.lng && settlementEl.dataset.lat) {
            this.openGenealogyAt(Number(settlementEl.dataset.lng), Number(settlementEl.dataset.lat));
            return;
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
      this.hoverTip.classList.remove('is-hidden');
      const left = Math.max(8, Math.min(rect.width - 190, e.clientX - rect.left + 12));
      const top = Math.max(8, Math.min(rect.height - 70, e.clientY - rect.top - 12));
      this.hoverTip.style.left = `${left}px`;
      this.hoverTip.style.top = `${top}px`;
    }

    _restoreFromQuery() {
      const q = new URLSearchParams(location.search);
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
      if (q.has('layers')) {
        setTimeout(() => {
          const btn = this._id('act-layers-menu');
          if (btn) btn.click();
        }, 120);
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.atlasApp = new HistoricalAtlasController();
  });
})();
