/**
 * Historical Atlas Controller (ES6 Class Architecture)
 */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const RAD_TO_DEG = 180 / Math.PI;
  const DEG_TO_RAD = Math.PI / 180;
  const APP_SCRIPT_EL =
    typeof document !== 'undefined' && document
      ? document.currentScript ||
        (typeof document.getElementById === 'function'
          ? document.getElementById('atlas-app-script')
          : null)
      : null;
  const RING_BBOX_WEAK = new WeakMap();
  const SHAPE_BBOX_WEAK = new WeakMap();
  const SHAPE_SIG_WEAK = new WeakMap();
  const PREF_BOUNDARY_MESH_CACHE = new WeakMap();
  const setSvgAttribute = (node, name, value) => {
    const text = String(value);
    if (node.getAttribute(name) !== text) node.setAttribute(name, text);
  };
  // Regime prefixes carried by era-span names, e.g. '北魏正光' = '北魏' + era '正光'.
  const ERA_DYNASTY_PREFIXES = [
    '南朝宋', '南朝齐', '南朝梁', '南朝陈', '西汉', '东汉', '新莽', '西晋', '东晋',
    '北魏', '东魏', '西魏', '北齐', '北周', '西梁', '武周', '后梁', '后唐', '后晋', '后汉', '后周',
    '北宋', '南宋', '蜀汉', '西夏', '周', '秦', '汉', '魏', '吴', '晋', '宋', '齐', '梁', '陈', '隋', '唐', '辽', '金', '元', '明', '清',
  ];
  const ERA_CHAR_PINYIN = {
    威: 'wei', 烈: 'lie', 王: 'wang', 安: 'an', 显: 'xian', 慎: 'shen', 靓: 'jing', 赧: 'nan', 昭: 'zhao', 襄: 'xiang',
    孝: 'xiao', 文: 'wen', 庄: 'zhuang', 政: 'zheng', 始: 'shi', 皇: 'huang', 二: 'er', 世: 'shi', 高: 'gao', 帝: 'di',
    惠: 'hui', 后: 'hou', 前: 'qian', 元: 'yuan', 景: 'jing', 中: 'zhong', 建: 'jian', 光: 'guang', 朔: 'shuo', 狩: 'shou',
    鼎: 'ding', 封: 'feng', 太: 'tai', 初: 'chu', 天: 'tian', 汉: 'han', 征: 'zheng', 和: 'he', 凤: 'feng', 平: 'ping',
    本: 'ben', 地: 'di', 节: 'jie', 康: 'kang', 神: 'shen', 爵: 'jue', 五: 'wu', 甘: 'gan', 露: 'lu', 黄: 'huang',
    龙: 'long', 永: 'yong', 竟: 'jing', 宁: 'ning', 河: 'he', 阳: 'yang', 鸿: 'hong', 嘉: 'jia', 延: 'yan', 绥: 'sui',
    寿: 'shou', 居: 'ju', 摄: 'she', 新: 'xin', 莽: 'mang', 国: 'guo', 更: 'geng', 武: 'wu', 章: 'zhang', 兴: 'xing',
    憙: 'xi', 熹: 'xi', 青: 'qing', 正: 'zheng', 咸: 'xian', 熙: 'xi', 泰: 'tai', 昌: 'chang', 升: 'sheng', 隆: 'long',
    义: 'yi', 南: 'nan', 朝: 'chao', 宋: 'song', 大: 'da', 明: 'ming', 豫: 'yu', 徽: 'hui', 昇: 'sheng', 齐: 'qi',
    梁: 'liang', 监: 'jian', 普: 'pu', 通: 'tong', 同: 'tong', 清: 'qing', 宝: 'bao', 承: 'cheng', 圣: 'sheng', 绍: 'shao',
    陈: 'chen', 定: 'ding', 开: 'kai', 仁: 'ren', 业: 'ye', 德: 'de', 贞: 'zhen', 观: 'guan', 庆: 'qing', 麟: 'lin',
    乾: 'qian', 总: 'zong', 亨: 'heng', 上: 'shang', 仪: 'yi', 调: 'tiao', 耀: 'yao', 淳: 'chun', 弘: 'hong', 道: 'dao',
    嗣: 'si', 垂: 'chui', 拱: 'gong', 授: 'shou', 长: 'chang', 载: 'zai', 册: 'ce', 万: 'wan', 岁: 'sui', 功: 'gong',
    历: 'li', 久: 'jiu', 视: 'shi', 云: 'yun', 极: 'ji', 至: 'zhi', 应: 'ying', 广: 'guang', 成: 'cheng', 会: 'hui',
    符: 'fu', 启: 'qi', 纪: 'ji', 顺: 'shun', 福: 'fu', 化: 'hua', 复: 'fu', 祐: 'you', 运: 'yun', 雍: 'yong',
    端: 'duan', 祥: 'xiang', 禧: 'xi', 治: 'zhi', 丰: 'feng', 靖: 'jing', 崇: 'chong', 重: 'chong', 宣: 'xuan', 炎: 'yan',
    统: 'tong', 洪: 'hong', 乐: 'le', 祯: 'zhen', 绪: 'xu', 民: 'min', 禾: 'he', 赤: 'chi', 乌: 'wu', 衡: 'heng',
    凰: 'huang', 玺: 'xi', 登: 'deng', 赐: 'ci', 瑞: 'rui', 常: 'chang', 䴥: 'lu', 真: 'zhen', 君: 'jun', 龟: 'gui',
    象: 'xiang', 废: 'fei', 恭: 'gong', 保: 'bao', 闵: 'min', 西: 'xi', 赞: 'zan', 禄: 'lu', 收: 'shou', 辅: 'fu',
    眷: 'juan', 礼: 'li', 法: 'fa', 祚: 'zuo', 奲: 'da', 都: 'du', 盛: 'sheng', 人: 'ren',
  };
  const ADMIN_CATEGORY_EN = {
    刺史部: 'Inspectorate Region',
    布政使司: 'Provincial Administration Commission',
    行省: 'Branch Secretariat (Province)',
    宣政院: 'Bureau of Buddhist and Tibetan Affairs',
    中书省: 'Central Secretariat',
    省: 'Province',
    '道/省': 'Circuit / Province',
    将军辖区: 'Generalship Jurisdiction',
    办事大臣: 'Imperial Resident Jurisdiction',
    驻藏大臣: 'Imperial Resident in Tibet',
    地方: 'Region',
    都督区: 'Area Command',
    郡区: 'Commandery Zone',
    政区: 'Administrative Region',
    城: 'City',
    属国: 'Dependent State',
    部: 'Tribal Division',
    侨州: 'Emigre Prefecture',
  };
  // Timeline autoplay is event-driven: the playhead jumps from one node to the next (every
  // milestone year plus every territory-snapshot boundary) instead of crawling through the
  // ~1,950 calendar years where nothing changes. An ordinary event stays up long enough to
  // read its headline; a node that redraws the map (isMapChange, dynasty opening, snapshot
  // switch) holds longer so the border diff can be seen. Playback speed scales the tick.
  const AUTOPLAY_TICK_MS = 280;
  const AUTOPLAY_EVENT_TICKS = 4;
  const AUTOPLAY_MAP_CHANGE_TICKS = 10;
  const PERSON_AUTOPLAY_STEP_MS = 2600;
  const PLAY_SPEED_STEPS = [1, 2, 4, 0.5];

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
      if (!ring || ring.length < 3) return false;
      let bbox = RING_BBOX_WEAK.get(ring);
      if (!bbox) {
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
        bbox = [minX, minY, maxX, maxY];
        RING_BBOX_WEAK.set(ring, bbox);
      }
      if (lng < bbox[0] || lng > bbox[2] || lat < bbox[1] || lat > bbox[3]) {
        return false;
      }
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
        const polys = shapeObj.coordinates;
        if (!polys || !polys.length) return false;
        if (polys.length === 1) {
          return MercatorProjector.pointInPolygonRings(lng, lat, polys[0]);
        }
        let bbox = SHAPE_BBOX_WEAK.get(shapeObj);
        if (!bbox) {
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (let pIdx = 0; pIdx < polys.length; pIdx++) {
            const ring = polys[pIdx] && polys[pIdx][0];
            if (!ring || ring.length < 3) continue;
            let rb = RING_BBOX_WEAK.get(ring);
            if (!rb) {
              let rMinX = Infinity;
              let rMinY = Infinity;
              let rMaxX = -Infinity;
              let rMaxY = -Infinity;
              for (let i = 0; i < ring.length; i++) {
                const x = ring[i][0];
                const y = ring[i][1];
                if (x < rMinX) rMinX = x;
                if (x > rMaxX) rMaxX = x;
                if (y < rMinY) rMinY = y;
                if (y > rMaxY) rMaxY = y;
              }
              rb = [rMinX, rMinY, rMaxX, rMaxY];
              RING_BBOX_WEAK.set(ring, rb);
            }
            if (rb[0] < minX) minX = rb[0];
            if (rb[1] < minY) minY = rb[1];
            if (rb[2] > maxX) maxX = rb[2];
            if (rb[3] > maxY) maxY = rb[3];
          }
          bbox = [minX, minY, maxX, maxY];
          SHAPE_BBOX_WEAK.set(shapeObj, bbox);
        }
        if (lng < bbox[0] || lng > bbox[2] || lat < bbox[1] || lat > bbox[3]) {
          return false;
        }
        for (let pIdx = 0; pIdx < polys.length; pIdx++) {
          if (MercatorProjector.pointInPolygonRings(lng, lat, polys[pIdx])) return true;
        }
        return false;
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
      this._loreDetailLoaded = Boolean(
        window.ATLAS_LORE_DETAIL_LOADED ||
          (window.ATLAS_LORE_DATA &&
            Array.isArray(window.ATLAS_LORE_DATA.PLACE_LANDMARK_EVENTS) &&
            window.ATLAS_LORE_DATA.PLACE_LANDMARK_EVENTS.length > 0)
      );
      this._loreDetailPromise = null;
      this._hydrateSnapshots();

      this._setEnglishLocale(window.EN_LOCALE || {
        strings: {},
        dynasties: {},
        milestones: {},
        corridors: {},
        dict: {},
      });

      this.projector = new MercatorProjector(1000, 700, {
        west: 66,
        east: 142,
        south: 14,
        north: 55,
      });

      this.minYear = this.dynasties[0].fromYear;
      this.maxYear = this.dynasties[this.dynasties.length - 1].toYear;
      this.embed = this._parseEmbedParams(
        typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
      );
      if (this.embed) this._applyEmbedYearRange();
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
      this.playHoldTicks = 0;
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
      this._cameraSettleTimer = null;
      this._cameraViewportRect = null;
      this._lastCameraViewBox = null;
      this._baseViewBoxCam = null;
      this._hoveredPrefEl = null;
      this._hoverRaf = null;
      this._pendingHoverEvent = null;
      this._deferredPrefectureSnap = null;
      this._prefShapesGroup = null;
      this._regOverlayGroup = null;
      this._renderedPrefecturesRef = null;
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
      this._runWithDeferredTypography(() => {
        this._applyCamera(true);
        this._buildTerrainRivers();
        this._buildModernProvinces();
        this._buildNeighborCountries();
        this._buildScrubberBands();
        this._attachListeners();
        this.applyLocale();

        this.jumpToYear(this.dynasties[0].focusYear);
        this._bootDone = true;
        this._restoreFromQuery();
        if (this.embed) this._initEmbedChrome();
      });
      if (!this.embed) this._maybeShowStartGuide();

      if (typeof window !== 'undefined' && !this._fullSnapshotsLoaded) {
        setTimeout(() => this._ensureFullSnapshots(), 50);
      }
      if (typeof window !== 'undefined' && !this._isLoreDetailLoaded()) {
        const scheduleIdle =
          typeof window.requestIdleCallback === 'function'
            ? (fn) => window.requestIdleCallback(fn, { timeout: 200 })
            : (fn) => setTimeout(fn, 80);
        scheduleIdle(() => this._ensureLoreDetail());
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

    _lazyAssetUrl(relPath, datasetKey) {
      const scriptEl =
        APP_SCRIPT_EL ||
        (typeof document !== 'undefined' &&
        document &&
        typeof document.getElementById === 'function'
          ? document.getElementById('atlas-app-script')
          : null);
      const v =
        (scriptEl && scriptEl.dataset && scriptEl.dataset[datasetKey]) ||
        (typeof window !== 'undefined' &&
          window.ATLAS_ASSET_VERSIONS &&
          window.ATLAS_ASSET_VERSIONS[datasetKey]) ||
        '';
      return v ? `${relPath}?v=${encodeURIComponent(v)}` : relPath;
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
        this._fullSnapshotsPromise = this._loadScriptOnce(
          this._lazyAssetUrl('js/atlas_snapshots.js', 'vSnapshots')
        ).then(
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
        this._setEnglishLocale(window.EN_LOCALE);
        return Promise.resolve(this.enLocale);
      }
      if (!this._enLocalePromise) {
        this._enLocalePromise = this._loadScriptOnce(
          this._lazyAssetUrl('js/i18n_dict.js', 'vI18n')
        ).then(() => {
          if (window.EN_LOCALE) {
            this._setEnglishLocale(window.EN_LOCALE);
            this.searchIndex = null;
          }
          return this.enLocale;
        });
      }
      return this._enLocalePromise;
    }

    _ensureEventPinyin() {
      if (window.ATLAS_EVENT_PINYIN) return Promise.resolve(true);
      if (!this._eventPinyinPromise) {
        this._eventPinyinPromise = this._loadScriptOnce(
          this._lazyAssetUrl('js/event_pinyin.js', 'vPinyin')
        ).then(() => {
          if (window.ATLAS_EVENT_PINYIN) {
            this.searchIndex = null;
            return true;
          }
          this._eventPinyinPromise = null;
          return false;
        });
      }
      return this._eventPinyinPromise;
    }

    _hasZhHant() {
      return Boolean(
        typeof window !== 'undefined' &&
          window.ZH_HANT_CONV &&
          typeof window.ZH_HANT_CONV.toHant === 'function' &&
          typeof window.ZH_HANT_CONV.toHans === 'function'
      );
    }

    _ensureZhHant() {
      if (this._hasZhHant()) {
        return Promise.resolve(window.ZH_HANT_CONV);
      }
      if (!this._zhHantPromise) {
        this._zhHantPromise = this._loadScriptOnce(
          this._lazyAssetUrl('js/zh_hant.js', 'vHant')
        ).then(() => {
          if (this._hasZhHant()) {
            this.searchIndex = null;
            return window.ZH_HANT_CONV;
          }
          this._zhHantPromise = null;
          return null;
        });
      }
      return this._zhHantPromise;
    }

    _isQuizLoaded() {
      return typeof this._buildChallengeDeck === 'function';
    }

    _ensureQuiz() {
      if (this._isQuizLoaded()) return Promise.resolve(true);
      if (!this._quizPromise) {
        this._quizPromise = this._loadScriptOnce(
          this._lazyAssetUrl('js/atlas_quiz.js', 'vQuiz')
        ).then(() => {
          if (this._isQuizLoaded()) return true;
          this._quizPromise = null;
          return false;
        });
      }
      return this._quizPromise;
    }

    _openChallenge(opts = {}) {
      if (this._isQuizLoaded()) {
        this.startChallenge(opts);
        return Promise.resolve(true);
      }
      return this._ensureQuiz().then((ok) => {
        if (ok && typeof this.startChallenge === 'function') {
          this.startChallenge(opts);
        }
        return ok;
      });
    }

    _isLoreDetailLoaded() {
      if (this._loreDetailLoaded) return true;
      if (
        typeof window !== 'undefined' &&
        (window.ATLAS_LORE_DETAIL_LOADED ||
          (window.ATLAS_LORE_DATA &&
            Array.isArray(window.ATLAS_LORE_DATA.PLACE_LANDMARK_EVENTS) &&
            window.ATLAS_LORE_DATA.PLACE_LANDMARK_EVENTS.length > 0))
      ) {
        this._loreDetailLoaded = true;
        return true;
      }
      return false;
    }

    _ensureLoreDetail() {
      if (this._isLoreDetailLoaded()) {
        return Promise.resolve((typeof window !== 'undefined' && window.ATLAS_LORE_DATA) || {});
      }
      if (!this._loreDetailPromise) {
        this._loreDetailPromise = this._loadScriptOnce(
          this._lazyAssetUrl('js/lore_detail.js', 'vLore')
        ).then(() => {
          this._loreDetailLoaded = true;
          this.searchIndex = null;
          this._soloPersonEventsCache = null;
          this._extraEnTermMap = null;
          this._challengeBaseTiers = null;
          if (this.grpSettlements && typeof this.grpSettlements.querySelectorAll === 'function') {
            for (const el of this.grpSettlements.querySelectorAll('.settlement-node.is-pass')) {
              const pk = el.dataset && el.dataset.passKey;
              const pObj =
                pk &&
                (HistoricalAtlasController.STRATEGIC_PASSES || []).find((p) => p.key === pk);
              if (pObj) {
                el.dataset.chokepoint =
                  (this.locale === 'en' ? pObj.chokepointEn : this._zh(pObj.chokepointZh || '')) ||
                  '';
              }
            }
          }
          return (typeof window !== 'undefined' && window.ATLAS_LORE_DATA) || {};
        });
      }
      return this._loreDetailPromise;
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
        this._dismissStartGuide();
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

    // First-visit guide: three ways in, shown once on a bare homepage visit.
    // Deep links (?year=, ?person=, topic pages) already carry intent, so skip.
    _maybeShowStartGuide() {
      if (typeof location === 'undefined' || !this._id('start-guide')) return;
      const q = new URLSearchParams(location.search);
      q.delete('lang');
      if (Array.from(q.keys()).length) return;
      try {
        if (localStorage.getItem('jiangshan_seen_start_guide') === '1') return;
      } catch (_) {}
      this._startGuideOpen = true;
      this._renderStartGuide();
    }

    _renderStartGuide() {
      const el = this._id('start-guide');
      if (!el || !this._startGuideOpen) return;
      const en = this.locale === 'en';
      const items = en
        ? [
            ['journey', 'Follow Xuanzang west'],
            ['search', 'Find a place'],
            ['quiz', 'Map quiz'],
          ]
        : [
            ['journey', '随玄奘西行'],
            ['search', '寻一处故地'],
            ['quiz', '古地名小试'],
          ];
      const closeLabel = en ? 'Close' : '关闭';
      el.innerHTML =
        `<span class="sg-head">${en ? 'New here?' : '初来乍到'}</span>` +
        items
          .map(([act, title]) => `<button type="button" class="sg-item" data-act="${act}">${title}</button>`)
          .join('<span class="sg-sep">·</span>') +
        `<button type="button" class="sg-close" aria-label="${closeLabel}" title="${closeLabel}">×</button>`;
      if (this.locale === 'zh-tw') this._applyZhHantDom(el);
      el.classList.remove('is-hidden');
      const frame = this._id('viewport-frame');
      if (frame) frame.classList.add('has-start-guide');
      el.querySelector('.sg-close').addEventListener('click', () => this._dismissStartGuide());
      el.querySelectorAll('.sg-item').forEach((btn) => {
        btn.addEventListener('click', () => this._runStartGuideAction(btn.dataset.act));
      });
    }

    _runStartGuideAction(act) {
      this._dismissStartGuide();
      if (act === 'journey') {
        this.openJourneyAsPerson('xuanzang', -1);
      } else if (act === 'quiz') {
        this._openChallenge();
      } else if (act === 'search') {
        const box = this._id('map-search-box');
        const inp = this._id('inp-map-search');
        if (box) box.classList.add('is-expanded');
        if (inp) {
          setTimeout(() => {
            inp.focus();
            inp.dispatchEvent(new Event('input'));
          }, 20);
        }
      }
    }

    _dismissStartGuide() {
      if (!this._startGuideOpen) return;
      this._startGuideOpen = false;
      try {
        localStorage.setItem('jiangshan_seen_start_guide', '1');
      } catch (_) {}
      const el = this._id('start-guide');
      if (el) {
        el.classList.add('is-hidden');
        el.innerHTML = '';
      }
      const frame = this._id('viewport-frame');
      if (frame) frame.classList.remove('has-start-guide');
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
        this._invalidateTypographyLayout();
      }
    }

    _getViewportAspect() {
      if (this.svg && typeof this.svg.getBoundingClientRect === 'function') {
        const r = this._cameraViewportRect || this._getUnscaledSvgRect();
        if (r && r.width > 40 && r.height > 40) {
          this._cameraViewportRect = r;
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
      this.viewportFrame = this._id('viewport-frame');
      this._stageWrap = this._id('svg-stage-wrap');
      this.svg = this._id('atlas-svg');
      this.grpTerrain = this._id('grp-terrain');
      this.terrainTileLayer = this._id('grp-terrain-tiles');
      this.grpPaleoSea = this._id('grp-paleo-sea');
      this.grpRivers = this._id('grp-rivers');
      this.grpNeighbors = this._id('grp-neighbors');
      this.grpProvinces = this._id('grp-provinces');
      this.grpProvNames = this._id('grp-prov-names');
      this.grpPolities = this._id('grp-polities');
      this.grpPrefectures = this._id('grp-prefectures');
      this.prefClipPath = this._id('prefecture-clip-path');
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

    _setEnglishLocale(locale) {
      this.enLocale = locale;
      this._enDictReady = Boolean(locale && locale.dict && Object.keys(locale.dict).length);
    }

    _hasEnDict() {
      return this._enDictReady === true;
    }

    _getExtraEnTermMap() {
      const dictRef = (this.enLocale && this.enLocale.dict) || null;
      const hasKeys = this._hasEnDict();
      const loreLoaded = this._isLoreDetailLoaded();
      if (
        this._extraEnTermMap &&
        this._extraEnTermMapDictRef === dictRef &&
        this._extraEnTermMapHasKeys === hasKeys &&
        this._extraEnTermMapLoreLoaded === loreLoaded
      ) {
        return this._extraEnTermMap;
      }
      const dict = dictRef || {};
      const map = { ...ADMIN_CATEGORY_EN };
      // 1. Stripped parenthetical keys from enLocale.dict (e.g. '南郑（汉中）' -> '南郑': 'Nanzheng')
      for (const [k, v] of Object.entries(dict)) {
        if (!v) continue;
        const strippedK = k.replace(/（[^）]+）|\([^)]+\)/g, '').trim();
        if (strippedK && strippedK !== k && !dict[strippedK] && !map[strippedK]) {
          const strippedV = String(v).replace(/（[^）]+）|\([^)]+\)/g, '').trim();
          if (strippedV) map[strippedK] = strippedV;
        }
      }
      // 2. Strategic passes
      for (const p of HistoricalAtlasController.STRATEGIC_PASSES || []) {
        if (!p) continue;
        if (p.ancientZh && p.ancientEn) {
          map[p.ancientZh] = p.ancientEn;
          const strippedZh = p.ancientZh.replace(/（[^）]+）|\([^)]+\)/g, '').trim();
          const strippedEn = p.ancientEn.replace(/（[^）]+）|\([^)]+\)/g, '').trim();
          if (strippedZh && strippedEn && !map[strippedZh]) map[strippedZh] = strippedEn;
        }
        for (const en of p.eraNames || []) {
          if (en && en.zh && en.en) map[en.zh] = en.en;
        }
        if (p.modernZh && p.modernEn) map[p.modernZh] = p.modernEn;
        if (p.rangeZh && p.rangeEn) map[p.rangeZh] = p.rangeEn;
        if (p.chokepointZh && p.chokepointEn) map[p.chokepointZh] = p.chokepointEn;
      }
      // 2b. Settlement era-dependent names
      for (const d of this.dynasties || []) {
        for (const s of (d && d.settlements) || []) {
          for (const en of (s && s.eraNames) || []) {
            if (en && en.zh && en.en) map[en.zh] = en.en;
          }
        }
      }
      // 3. Historical journeys stops
      for (const j of Object.values(HistoricalAtlasController.HISTORICAL_JOURNEYS || {})) {
        if (j && j.titleZh && j.titleEn) map[j.titleZh] = j.titleEn;
        for (const st of (j && j.stops) || []) {
          if (st && st.name && st.nameEn) {
            map[st.name] = st.nameEn;
            const strippedZh = st.name.replace(/（[^）]+）|\([^)]+\)/g, '').trim();
            const strippedEn = st.nameEn.replace(/（[^）]+）|\([^)]+\)/g, '').trim();
            if (strippedZh && strippedEn && !map[strippedZh]) map[strippedZh] = strippedEn;
          }
          if (st && st.modern && st.modernEn) map[st.modern] = st.modernEn;
        }
      }
      // 4. Landmark events & milestone sites
      for (const lm of HistoricalAtlasController.PLACE_LANDMARK_EVENTS || []) {
        if (lm && lm.site && lm.siteEn) map[lm.site] = lm.siteEn;
        if (lm && lm.zh && lm.en) map[lm.zh] = lm.en;
      }
      const msDict = (this.enLocale && this.enLocale.milestones) || {};
      for (const d of this.dynasties || []) {
        for (const m of (d && d.milestones) || []) {
          if (!m || !m.site) continue;
          const hit = msDict[`${d.key}:${m.year}`];
          const sEn = m.siteEn || (Array.isArray(hit) && hit[1]);
          if (sEn && !map[m.site]) map[m.site] = sEn;
        }
      }
      // 5. Corridors
      const corrDict = (this.enLocale && this.enLocale.corridors) || {};
      for (const c of this.corridors || []) {
        if (!c || !c.title) continue;
        const hit = corrDict[c.key];
        const cEn = (Array.isArray(hit) ? hit[0] : hit && hit.name) || '';
        if (cEn && !map[c.title]) map[c.title] = cEn;
      }
      this._extraEnTermMap = map;
      this._extraEnTermMapDictRef = dictRef;
      this._extraEnTermMapHasKeys = hasKeys;
      this._extraEnTermMapLoreLoaded = loreLoaded;
      return map;
    }

    _enDict(text) {
      if (!text) return '';
      if (text === '中华人民共和国') return "People's Republic of China";
      const dict = this.enLocale && this.enLocale.dict;
      if (!dict) return text;
      if (dict[text]) return dict[text];
      const extra = this._getExtraEnTermMap();
      if (extra[text]) return extra[text];
      const provMatch = String(text).match(
        /^(黑龙江|内蒙古|新疆|广西|宁夏|西藏|北京|天津|上海|重庆|河北|山西|辽宁|吉林|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾)(.+)$/
      );
      if (provMatch) {
        const p1 = dict[provMatch[1]] || extra[provMatch[1]];
        const p2 = dict[provMatch[2]] || extra[provMatch[2]];
        if (p1 && p2) return `${p2}, ${p1}`;
      }
      const str = String(text);
      if (str.includes(' · ')) {
        const parts = str.split(' · ').map((p) => this._enDict(p.trim()));
        if (parts.some((p, i) => p !== str.split(' · ')[i].trim())) {
          return parts.join(' · ');
        }
      }
      const parenMatch = str.match(/^([^（(]+)[（(]([^）)]+)[）)]$/);
      if (parenMatch) {
        const baseZh = parenMatch[1].trim();
        const innerZh = parenMatch[2].trim();
        const baseEn = dict[baseZh] || extra[baseZh];
        const innerEn = dict[innerZh] || extra[innerZh];
        if (baseEn && innerEn) return `${baseEn} (${innerEn})`;
        if (baseEn) return baseEn;
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

    _enMilestoneSite(d, m) {
      if (!m || !m.site) return '';
      if (m.siteEn) return m.siteEn;
      const key = `${d.key}:${m.year}`;
      const hit = this.enLocale.milestones && this.enLocale.milestones[key];
      if (Array.isArray(hit) && hit[1]) return hit[1];
      return d && (d.key === 'roc' || d.key === 'prc')
        ? this._enModernCity(m.site)
        : this._enDict(m.site);
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
        return this._enMilestoneSite(d, m);
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

    _eraNamePinyin(eraOnly) {
      if (!eraOnly) return '';
      const syls = Array.from(String(eraOnly)).map((ch) => ERA_CHAR_PINYIN[ch] || ch);
      let joined = '';
      for (let i = 0; i < syls.length; i++) {
        const s = syls[i];
        if (i > 0 && /^[aoe]/i.test(s)) joined += "'";
        joined += s;
      }
      return joined ? joined.charAt(0).toUpperCase() + joined.slice(1) : '';
    }

    _formatSpanEraEn(sp, targetNum) {
      const [startY, prefix, , monarchZh = '', monarchEn = ''] = sp;
      if (prefix === '民国') {
        return `Republic of China · Year ${targetNum}`;
      }
      if (startY < -140) {
        if (monarchZh && prefix.startsWith(monarchZh) && prefix.length > monarchZh.length) {
          const sub = prefix.slice(monarchZh.length);
          const subEn =
            sub === '前元'
              ? 'Early Reign'
              : sub === '中元'
                ? 'Middle Reign'
                : sub === '后元'
                  ? 'Late Reign'
                  : this._eraNamePinyin(sub);
          return `${monarchEn || monarchZh} · ${subEn} Year ${targetNum}`;
        }
        return `${monarchEn || monarchZh || prefix} · Year ${targetNum}`;
      }
      const dynPfx = ERA_DYNASTY_PREFIXES.find((dp) => prefix.startsWith(dp)) || '';
      const eraOnly = dynPfx ? prefix.slice(dynPfx.length) : prefix;
      const eraPinyin = this._eraNamePinyin(eraOnly);
      return `${eraPinyin} Year ${targetNum}${monarchEn ? ' · ' + monarchEn : ''}`;
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
        let dynName = dynasty ? this.dynastyName(dynasty) : '';
        if (yr >= 1912) return dynName;
        const match = regional || this._resolveEraSpan(yr, dynasty);
        const prefix = (match && match[1]) || '';
        if (!regional && prefix.startsWith('武周')) dynName = 'Wu Zhou';
        else if (!regional && prefix.startsWith('新莽')) dynName = 'Xin';
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

    _effectiveRenderedLocale() {
      if (this.locale === 'en' && !this._hasEnDict()) {
        return 'en-pending';
      }
      return this.locale;
    }

    _syncUrlLangParam() {
      if (this.embed) return;
      if (this._urlSyncArmed) {
        this._writeUrlState();
        return;
      }
      if (
        typeof window === 'undefined' ||
        typeof location === 'undefined' ||
        !window.history ||
        typeof window.history.replaceState !== 'function'
      ) {
        return;
      }
      try {
        const params = new URLSearchParams(location.search);
        if (this.locale === 'en') {
          params.set('lang', 'en');
        } else if (this.locale === 'zh-tw') {
          params.set('lang', 'zh-tw');
        } else {
          params.delete('lang');
        }
        const qs = params.toString();
        const nextSearch = qs ? `?${qs}` : '';
        const nextUrl = `${location.pathname || '/'}${nextSearch}${location.hash || ''}`;
        const curUrl = `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`;
        if (nextUrl !== curUrl) {
          window.history.replaceState(window.history.state || null, '', nextUrl);
        }
      } catch (_) {}
    }

    // The URL mirrors what the user is looking at, so refresh and share land on the same view.
    // Only restorable state is written; one-shot params (q, place, hover, quiz, ...) are dropped
    // once the user moves on, because they no longer describe the screen.
    _urlStateParams() {
      const prev =
        typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
      const p = new URLSearchParams();
      p.set('year', String(this.year));
      const person = this.activePerson;
      const personKeys = person && Array.isArray(person.profiles) ? person.profiles.map((pr) => String(pr.key || '')) : [];
      if (person && person.profile && person.profile.isStory && person.profile.key) {
        p.set('event', String(person.profile.key));
        if (this.activePersonEventIdx >= 0) p.set('stop', String(this.activePersonEventIdx));
      } else if (personKeys.length && personKeys.every((k) => k && !k.startsWith('adhoc_'))) {
        p.set('person', personKeys.join(','));
        if (this.activePersonEventIdx >= 0) p.set('stop', String(this.activePersonEventIdx));
      } else {
        // A place card can stay open on top of a regime profile, so both are restorable together.
        if (this.activePolity && this.activePolity.curated && this.activePolity.key) {
          p.set('polity', this.activePolity.key);
        }
        if (Array.isArray(this.activeTrace) && this.activeTrace.length === 2) {
          p.set('trace', this.activeTrace.map((v) => Number(v).toFixed(3)).join(','));
        }
      }
      if (prev.has('terrain')) p.set('terrain', prev.get('terrain'));
      if (this.locale === 'en') p.set('lang', 'en');
      else if (this.locale === 'zh-tw') p.set('lang', 'zh-tw');
      return p;
    }

    _writeUrlState() {
      if (
        this.embed ||
        typeof window === 'undefined' ||
        typeof location === 'undefined' ||
        !window.history ||
        typeof window.history.replaceState !== 'function'
      ) {
        return;
      }
      try {
        // Commas are legal in a query string; keep person=a,b / trace=lng,lat readable.
        const qs = this._urlStateParams().toString().replace(/%2C/gi, ',');
        const nextUrl = `${location.pathname || '/'}${qs ? `?${qs}` : ''}${location.hash || ''}`;
        const curUrl = `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`;
        // replaceState, not pushState: scrubbing the timeline must not flood the Back button.
        if (nextUrl !== curUrl) window.history.replaceState(window.history.state || null, '', nextUrl);
      } catch (_) {}
    }

    _scheduleUrlSync() {
      if (!this._urlSyncArmed || typeof setTimeout !== 'function') return;
      if (this._urlSyncTimer) clearTimeout(this._urlSyncTimer);
      this._urlSyncTimer = setTimeout(() => {
        this._urlSyncTimer = null;
        // Quiz rounds are not restorable; stopChallenge() writes the post-quiz view instead.
        if (this.challenge) return;
        // Wait for playback / drag to settle instead of rewriting the URL every frame.
        if (this.playing || this.isScrubbing) this._scheduleUrlSync();
        else this._writeUrlState();
      }, 400);
    }

    // A clean home load must stay clean even if the intro animates the timeline, so syncing
    // starts only once the URL already carried state or the user has actually interacted.
    _armUrlSync(hasDeepLinkState) {
      if (this.embed || this._urlSyncArmed || typeof window === 'undefined') return;
      const arm = () => {
        if (this._urlSyncArmed) return;
        this._urlSyncArmed = true;
        for (const t of ['pointerdown', 'keydown', 'wheel']) window.removeEventListener(t, arm, true);
      };
      if (hasDeepLinkState) {
        arm();
        return;
      }
      for (const t of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(t, arm, true);
    }

    // ---------------- Embed mode (?embed=1) ----------------
    // Other sites iframe the atlas with the same state params as share links. The main site gets
    // no UI for this (it is documented in the README); everything below only runs inside an embed.
    _parseEmbedParams(q) {
      if (!q || q.get('embed') !== '1') return null;
      const num = (k) => {
        if (!q.has(k) || q.get(k) === '') return null;
        const n = Math.round(Number(String(q.get(k)).split(',')[0]));
        return Number.isFinite(n) ? n : null;
      };
      return {
        from: num('from'),
        to: num('to'),
        lock: q.get('lock') === '1',
        autoplay: q.get('autoplay') === '1',
        year: num('year'),
      };
    }

    // Narrow the global year bounds; every scrub, step, autoplay and deep link already clamps to them.
    _applyEmbedYearRange() {
      const lo = this.minYear;
      const hi = this.maxYear;
      const clamp = (y) => Math.max(lo, Math.min(hi, y));
      let { from, to } = this.embed;
      if (this.embed.lock && this.embed.year !== null) {
        from = this.embed.year;
        to = this.embed.year;
      }
      if (from === null && to === null) return;
      from = clamp(from === null ? lo : from);
      to = clamp(to === null ? hi : to);
      if (from > to) [from, to] = [to, from];
      this.minYear = from;
      this.maxYear = to;
      if (from > lo || to < hi) this._bandClip = [from, to];
    }

    // The host page's address bar is not ours, and the link out must drop the embed params.
    _embedOpenUrl() {
      const qs = this._urlStateParams().toString().replace(/%2C/gi, ',');
      const base = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '';
      return `${base}${qs ? `?${qs}` : ''}`;
    }

    _syncEmbedBadge() {
      if (!this.embed) return;
      const titleEl = this._id('embed-badge-title');
      if (!titleEl) return;
      const en = this.locale === 'en';
      const person = this.activePerson;
      let title;
      if (person && Array.isArray(person.profiles) && person.profiles.length) {
        title = person.profiles.map((p) => (en ? p.en : this._zh(p.zh))).join(en ? ' & ' : ' × ');
      } else if (this.activePolity && this.activePolity.curated) {
        const name = en ? this.activePolity.en : this._zh(this.activePolity.zh);
        title = `${this.formatYear(this.year)} · ${name}`;
      } else {
        title = `${this.formatYear(this.year)} · ${this.formatEraLabel(this.year, this.dynasties[this.dynastyIdx])}`;
      }
      titleEl.textContent = title;
    }

    _initEmbedChrome() {
      if (typeof document === 'undefined') return;
      const root = document.documentElement;
      root.classList.add('is-embed');
      if (this.embed.lock) {
        root.classList.add('is-embed-locked');
        if (this.embed.year === null) {
          this.minYear = this.year;
          this.maxYear = this.year;
        }
      }
      const frame = this._id('viewport-frame');
      if (!frame) return;
      const en = this.locale === 'en';
      const make = (tag, id, cls, text) => {
        const el = document.createElement(tag);
        el.id = id;
        if (cls) el.className = cls;
        if (text) el.textContent = text;
        return el;
      };

      // Until clicked, the shield keeps map gestures away from the atlas but leaves default
      // scrolling alone, so a reader scrolling the host article never gets stuck zooming the map.
      const shield = make('div', 'embed-shield', '');
      shield.setAttribute('role', 'button');
      shield.tabIndex = 0;
      shield.appendChild(
        make('span', '', 'embed-shield-hint', en ? 'Click to interact with the map' : this._zh('点击以操作地图'))
      );
      const swallow = (e) => e.stopPropagation();
      for (const t of ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'touchstart', 'touchmove', 'wheel', 'dblclick']) {
        shield.addEventListener(t, swallow);
      }
      const activate = () => {
        this._embedActive = true;
        shield.classList.add('is-hidden');
      };
      shield.addEventListener('click', (e) => {
        e.stopPropagation();
        activate();
      });
      shield.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        activate();
      });
      root.addEventListener('mouseleave', () => {
        this._embedActive = false;
        shield.classList.remove('is-hidden');
      });
      frame.appendChild(shield);

      const badge = make('div', 'embed-badge', 'embed-chip');
      badge.appendChild(make('span', '', 'embed-seal', this.uiStr('brand_seal', '江山时序')));
      badge.appendChild(make('span', '', 'embed-sep'));
      badge.appendChild(make('span', 'embed-badge-title', 'embed-title'));
      frame.appendChild(badge);

      const open = make('a', 'embed-open', 'embed-chip', en ? 'Open in Jiangshan Atlas ↗' : this._zh('在江山时序中打开 ↗'));
      open.target = '_blank';
      open.rel = 'noopener';
      const refreshHref = () => {
        open.href = this._embedOpenUrl();
      };
      for (const t of ['pointerenter', 'focus', 'click']) open.addEventListener(t, refreshHref);
      refreshHref();
      frame.appendChild(open);

      frame.appendChild(
        make('div', 'embed-disclaimer', '', en ? 'Historical borders are approximate' : this._zh('历史疆域为示意性近似'))
      );

      this._syncEmbedBadge();

      if (this.embed.autoplay && !this.embed.lock) {
        const q = new URLSearchParams(location.search);
        if (q.has('person') || q.has('event') || q.has('journey')) {
          // The trajectory opens asynchronously after the full snapshots load.
          let tries = 0;
          const timer = setInterval(() => {
            if (this.activePerson) {
              clearInterval(timer);
              if (!this.personTimer) this.togglePersonAutoplay();
            } else if (++tries > 60) {
              clearInterval(timer);
            }
          }, 150);
        } else {
          setTimeout(() => {
            if (!this.playing) this.startAutoplay();
          }, 600);
        }
      }
    }

    applyLocale() {
      if (this.locale === 'en' && !this._hasEnDict()) {
        this._ensureEnglishLocale().then(() => this.applyLocale());
        return;
      }
      if (this.locale === 'zh-tw' && !this._hasZhHant()) {
        this._ensureZhHant().then(() => this.applyLocale());
        return;
      }
      document.documentElement.lang =
        this.locale === 'en' ? 'en' : this.locale === 'zh-tw' ? 'zh-Hant' : 'zh-CN';
      this._syncDocumentSeoMeta();
      this._syncSeoDirectoryLocale();

      this._id('txt-seal').textContent = this.uiStr('brand_seal', '江山时序');
      const homeLink = this._id('act-home');
      if (homeLink) {
        // Home = a clean URL in the current language; this is the "reset" entry point.
        homeLink.href = this.locale === 'en' ? './?lang=en' : this.locale === 'zh-tw' ? './?lang=zh-tw' : './';
        homeLink.title = this.locale === 'en' ? 'Back to home' : this._zh('回到首页');
      }
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
            : this._zh('在 GitHub 上为「江山时序」点亮 Star');
      }
      const moreBtn = this._id('act-more-menu');
      if (moreBtn) {
        const moreLbl =
          this.locale === 'en' ? 'Story & author links' : this._zh('创作手记与更多链接');
        moreBtn.title = moreLbl;
        if (typeof moreBtn.setAttribute === 'function') {
          moreBtn.setAttribute('aria-label', moreLbl);
        }
      }
      const setMoreCopy = (id, enTxt, zhTxt) => {
        const el = this._id(id);
        if (el) el.textContent = this.locale === 'en' ? enTxt : this._zh(zhTxt);
      };
      setMoreCopy('lbl-more-story', 'Making-Of Essay (ZH)', '创作手记 · 幕后故事');
      setMoreCopy('sub-more-story', 'From textbook maps to Jiangshan', '从课本插图到开源历史地图');
      setMoreCopy('lbl-more-about', 'About & More Projects', '作者博客 · 更多作品');
      setMoreCopy('sub-more-about', 'deanchen.me', 'deanchen.me');
      this._updateMusicUi();
      this._updateAutoplayUi();
      this._updatePlaySpeedUi();
      this._renderStartGuide();
      this._id('gesture-guide').textContent = this.uiStr(
        'hint',
        '滚轮缩放 · 拖拽平移 · 点击城名或双击任意处查沿革 · ← → 逐事件跳转（Shift+← → ±10年） · 空格播放'
      );
      this._id('txt-seat-label').textContent = this.uiStr('capital_k', '都城');
      this._id('txt-milestones-heading').textContent = this.uiStr('events_h', '重大事件');
      this._id('txt-disclaimer').textContent = this.uiStr(
        'caveat',
        '历史疆域与政区为示意性近似，非精确测绘边界。地形晕渲据 SRTM、GMTED2010 公开高程数据。'
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
      this._syncScrubberNavigator();
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
        ? this.activePerson.profile && this.activePerson.profile.isRelic
          ? this.locale === 'en'
            ? 'Relic Provenance · Across Dynasties'
            : '点物溯史 · 传世国器流转'
          : this.activePerson.profile && this.activePerson.profile.isStory
            ? this.locale === 'en'
              ? 'Event Storyline · Multi-Act Chronicle'
              : '点事溯局 · 历史大事件全脉络'
            : this.locale === 'en'
              ? 'Person Chronicle · Key Life Milestones'
              : '点人溯事 · 生平大事记'
        : this.uiStr('trace_kicker', '点地溯源 · 古今政区沿革');
      const chalKicker = this._id('txt-challenge-kicker');
      if (chalKicker) {
        chalKicker.textContent = this.locale === 'en' ? 'Map Pinpoint' : '舆图寻址';
      }
      const searchInp = this._id('inp-map-search');
      if (searchInp) {
        const isExpanded =
          typeof document !== 'undefined' && document.activeElement === searchInp;
        const searchPh = this._searchPlaceholder(isExpanded);
        const searchAria =
          this.locale === 'en'
            ? 'Search historical figures (single or pair, e.g. Li Bai, Du Fu), ancient/modern cities, prefectures, or eras'
            : this._zh('搜历史人物（支持双人同框如：李白 杜甫）、古今地名、州府或帝王年号');
        searchInp.placeholder = searchPh;
        searchInp.setAttribute('aria-label', searchAria);
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
      const closeChalBtn = this._id('act-close-challenge');
      if (closeChalBtn) {
        const lbl = this.locale === 'en' ? 'Exit quiz' : '退出挑战';
        closeChalBtn.title = lbl;
        if (typeof closeChalBtn.setAttribute === 'function') {
          closeChalBtn.setAttribute('aria-label', lbl);
        }
      }
      const expandGenBtn = this._id('act-expand-genealogy');
      if (expandGenBtn) {
        const lbl = this.locale === 'en' ? 'Expand / collapse genealogy panel' : '展开/收起沿革面板';
        expandGenBtn.title = lbl;
        if (typeof expandGenBtn.setAttribute === 'function') {
          expandGenBtn.setAttribute('aria-label', lbl);
        }
      }
      const closeGenBtn = this._id('act-close-genealogy');
      if (closeGenBtn) {
        const lbl = this.locale === 'en' ? 'Close' : '关闭';
        closeGenBtn.title = lbl;
        if (typeof closeGenBtn.setAttribute === 'function') {
          closeGenBtn.setAttribute('aria-label', lbl);
        }
      }
      const ariaMap = [
        ['layers-popover', 'Map layers', '地图图层开关'],
        ['more-popover', 'Story & author links', '创作手记与更多链接'],
        ['challenge-card', 'Ancient Place Quiz', '古地名小试挑战'],
        ['genealogy-card', 'Place administrative genealogy', '古今地点沿革卡片'],
        ['journey-card', 'Historical route overlay', '行迹叠图卡片'],
        ['start-guide', 'Quick start guide', '功能导览'],
      ];
      for (const [id, enLbl, zhLbl] of ariaMap) {
        const el = this._id(id);
        if (el && typeof el.setAttribute === 'function') {
          el.setAttribute('aria-label', this.locale === 'en' ? enLbl : zhLbl);
        }
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
      this._lastLegendKey = null;
      this._lastPersonCardKey = null;
      this._invalidateTypographyLayout();

      const cur = this.dynasties[this.dynastyIdx];
      this._runWithDeferredTypography(() => {
        if (cur) {
          this._renderChroniclePane(cur);
          this._renderSettlements(cur);
          this._renderCorridors();
          this._renderMilestones(cur);
          this._withSnapshot(this.activeSnapKey || this._resolveSnapKey(cur, this.year), (snap) =>
            this._renderPolitiesAndPrefectures(cur, snap)
          );
          if (!this.activePerson) {
            this._syncAutoMilestoneBalloon(cur);
          }
          this._syncScrubberUi();
        }
        if (this.activeTrace) {
          this.openGenealogyAt(this.activeTrace[0], this.activeTrace[1], null, {
            fromYearSync: true,
            preserveScroll: true,
          });
        } else if (this.activePerson) {
          const rebuilt = this._buildPersonTracksAndEvents(
            this.activePerson.profiles || [this.activePerson.profile]
          );
          if (rebuilt) {
            rebuilt.intersectOnly = Boolean(this.activePerson.intersectOnly);
            this.activePerson = rebuilt;
          }
          this._renderPersonPinsOverlay();
          this._renderPersonChronicleCard(true);
        }
        if (this.activeCustomRoute) {
          this._renderCustomRoute(this.activeCustomRoute, this.camera.zoom);
        }
      });
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

    _hydroLabelPair(lb, year = this.year) {
      if (!lb) return { zh: '', en: '' };
      if (Array.isArray(lb.eraNames)) {
        const y = year !== undefined ? year : this.year;
        for (const en of lb.eraNames) {
          if (
            (en.from === undefined || y >= en.from) &&
            (en.until === undefined || y < en.until)
          ) {
            return { zh: en.zh || lb.zh || '', en: en.en || lb.en || '' };
          }
        }
      }
      return { zh: lb.zh || '', en: lb.en || '' };
    }

    _hydroCourseMask(year) {
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
        .filter((t) => (t.appear !== undefined || t.vanish !== undefined) && !t.tier)
        .map((t) => (this._isHydroVisible(t, y) ? '1' : '0'))
        .join('');
      const pMask = (this.hydroData.paleoSea || [])
        .filter((p) => p.appear !== undefined || p.vanish !== undefined)
        .map((p) => (this._isHydroVisible(p, y) ? '1' : '0'))
        .join('');
      return `${rMask}:${lMask}:${tMask}:${pMask}`;
    }

    _hydroMask(year) {
      if (!this.hydroData) return '';
      const y = year !== undefined ? year : this.year;
      const base = this._hydroCourseMask(y);
      const eMask = (this.hydroData.labels || [])
        .filter((t) => t.eraNames || (t.tier && (t.appear !== undefined || t.vanish !== undefined)))
        .map((t) => (this._isHydroVisible(t, y) ? this._hydroLabelPair(t, y).zh : '0'))
        .join('|');
      return `${base}:${eMask}`;
    }

    _buildTerrainRivers() {
      if (!this.hydroData) return;
      this.activeHydroMask = this._hydroMask(this.year);
      if (this.grpPaleoSea) {
        this.grpPaleoSea.innerHTML = '';
        for (const ps of this.hydroData.paleoSea || []) {
          if (!this._isHydroVisible(ps, this.year)) continue;
          const d = this.projector.multiRingsToSvgPath(ps.polys || []);
          if (!d) continue;
          this._svgNode(
            'path',
            { d, class: 'paleo-sea', 'fill-rule': 'evenodd' },
            this.grpPaleoSea
          );
        }
      }
      if (!this.grpRivers) return;
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

      // 4. Render classical & bilingual water and mountain-range captions
      for (const lb of this.hydroData.labels || []) {
        if (!lb.coord || !this._isHydroVisible(lb, this.year)) continue;
        const [lx, ly] = this.projector.toScreen(lb.coord[0], lb.coord[1]);
        const tier = lb.tier || (lb.kind === 'range' || lb.kind === 'desert' ? 1 : 0);
        const kindCls =
          lb.kind === 'trunk'
            ? 'is-trunk'
            : lb.kind === 'lake'
              ? 'is-lake'
              : lb.kind === 'range'
                ? 'is-range is-crowded-hidden'
                : lb.kind === 'desert'
                  ? 'is-range is-desert is-crowded-hidden'
                  : tier > 0
                    ? 'is-river is-detail-hydro is-crowded-hidden'
                    : 'is-river';
        const rot = lb.rot || 0;
        const { zh, en } = this._hydroLabelPair(lb, this.year);
        const lxStr = lx.toFixed(1);
        const lyStr = ly.toFixed(1);
        const tNode = this._svgNode(
          'text',
          {
            class: `hydro-label ${kindCls}`,
            'data-x': lxStr,
            'data-y': lyStr,
            'data-base-x': lxStr,
            'data-base-y': lyStr,
            'data-rot': String(rot),
            'data-tier': String(tier),
            'data-zh': zh,
            'data-en': en,
            transform: `translate(${lxStr},${lyStr}) rotate(${rot})`,
          },
          this.grpRivers
        );
        tNode.textContent = this.locale === 'en' ? en : this._zh(zh);
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
      if (this.grpRivers && this.grpRivers.classList) {
        this.grpRivers.classList.toggle('is-hidden', !this.terrainMode);
      }
      const chk = this._id('chk-terrain');
      if (chk) {
        chk.checked = this.terrainMode;
      }
      if (this.terrainMode) this._scheduleTerrainTiles();
      this._invalidateTypographyLayout();
      if (this.svg && this.camera && this.grpCorridors && this.grpSettlements) {
        this._rescaleSvgTypography();
      }
    }

    _simplifyPolylineRdp(pts, eps) {
      if (!pts || pts.length <= 2) return pts;
      const n = pts.length;
      const keep = new Uint8Array(n);
      keep[0] = 1;
      keep[n - 1] = 1;
      const epsSq = eps * eps;
      const stack = [0, n - 1];
      while (stack.length) {
        const e = stack.pop();
        const s = stack.pop();
        if (e - s <= 1) continue;
        const ax = pts[s][0];
        const ay = pts[s][1];
        const bx = pts[e][0];
        const by = pts[e][1];
        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        let maxSq = -1;
        let maxIdx = -1;
        for (let i = s + 1; i < e; i++) {
          const px = pts[i][0];
          const py = pts[i][1];
          let dSq;
          if (lenSq > 1e-12) {
            let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
            if (t < 0) t = 0;
            else if (t > 1) t = 1;
            const qx = ax + dx * t;
            const qy = ay + dy * t;
            dSq = (px - qx) * (px - qx) + (py - qy) * (py - qy);
          } else {
            dSq = (px - ax) * (px - ax) + (py - ay) * (py - ay);
          }
          if (dSq > maxSq) {
            maxSq = dSq;
            maxIdx = i;
          }
        }
        if (maxSq > epsSq && maxIdx > s) {
          keep[maxIdx] = 1;
          stack.push(maxIdx, e, s, maxIdx);
        }
      }
      const out = [];
      for (let i = 0; i < n; i++) {
        if (keep[i]) out.push(pts[i]);
      }
      return out;
    }

    _weldBoundaryChains(chains) {
      const valid = chains.filter((pts) => pts && pts.length >= 2);
      const count = valid.length;
      if (!count) return '';
      const keyOf = (pt) => `${pt[0].toFixed(1)},${pt[1].toFixed(1)}`;
      const startMap = new Map();
      const endMap = new Map();
      const addIdx = (map, k, idx) => {
        let arr = map.get(k);
        if (!arr) {
          arr = [];
          map.set(k, arr);
        }
        arr.push(idx);
      };
      for (let i = 0; i < count; i++) {
        const pts = valid[i];
        addIdx(startMap, keyOf(pts[0]), i);
        addIdx(endMap, keyOf(pts[pts.length - 1]), i);
      }
      const used = new Uint8Array(count);
      const takeMatch = (k) => {
        const sArr = startMap.get(k);
        if (sArr) {
          while (sArr.length) {
            const idx = sArr.pop();
            if (!used[idx]) return { idx, rev: false };
          }
        }
        const eArr = endMap.get(k);
        if (eArr) {
          while (eArr.length) {
            const idx = eArr.pop();
            if (!used[idx]) return { idx, rev: true };
          }
        }
        return null;
      };
      let out = '';
      for (let i = 0; i < count; i++) {
        if (used[i]) continue;
        used[i] = 1;
        const headChunks = [];
        let headKey = keyOf(valid[i][0]);
        for (;;) {
          const hit = takeMatch(headKey);
          if (!hit) break;
          used[hit.idx] = 1;
          const pts = valid[hit.idx];
          const aligned = hit.rev ? pts : pts.slice().reverse();
          headChunks.push(aligned);
          headKey = keyOf(aligned[0]);
        }
        const merged = [];
        for (let h = headChunks.length - 1; h >= 0; h--) {
          const c = headChunks[h];
          for (let j = merged.length ? 1 : 0; j < c.length; j++) merged.push(c[j]);
        }
        const base = valid[i];
        for (let j = merged.length ? 1 : 0; j < base.length; j++) merged.push(base[j]);
        let tailKey = keyOf(merged[merged.length - 1]);
        for (;;) {
          const hit = takeMatch(tailKey);
          if (!hit) break;
          used[hit.idx] = 1;
          const pts = valid[hit.idx];
          if (hit.rev) {
            for (let j = pts.length - 2; j >= 0; j--) merged.push(pts[j]);
          } else {
            for (let j = 1; j < pts.length; j++) merged.push(pts[j]);
          }
          tailKey = keyOf(merged[merged.length - 1]);
        }
        out += `M${merged[0][0].toFixed(1)} ${merged[0][1].toFixed(1)}`;
        for (let j = 1; j < merged.length; j++) {
          out += `L${merged[j][0].toFixed(1)} ${merged[j][1].toFixed(1)}`;
        }
      }
      return out;
    }

    _buildProvinceBoundaryPaths() {
      if (this._cachedProvinceBoundaryPaths) {
        return this._cachedProvinceBoundaryPaths;
      }
      const ptKey = (pt) => Math.round(pt[0] * 100) * 10000 + Math.round(pt[1] * 100);
      const edgeKey = (k1, k2) => (k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`);

      const coordByKey = new Map();
      const edgeCounts = new Map();
      const rawRings = [];

      for (const prov of this.provinces || []) {
        if (!prov || String(prov.code).includes('_JD') || !Array.isArray(prov.rings)) continue;
        for (let polyIdx = 0; polyIdx < prov.rings.length; polyIdx++) {
          const poly = prov.rings[polyIdx];
          if (!Array.isArray(poly)) continue;
          for (let ringIdx = 0; ringIdx < poly.length; ringIdx++) {
            const rawRing = poly[ringIdx];
            if (!Array.isArray(rawRing) || rawRing.length < 3) continue;
            const oriented = this.projector._orientRing(rawRing, ringIdx > 0);
            const keys = [];
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            for (let i = 0; i < oriented.length; i++) {
              const pt = oriented[i];
              const k = ptKey(pt);
              if (keys.length && keys[keys.length - 1] === k) continue;
              keys.push(k);
              let sc = coordByKey.get(k);
              if (!sc) {
                sc = this.projector.toScreen(pt[0], pt[1]);
                coordByKey.set(k, sc);
              }
              if (sc[0] < minX) minX = sc[0];
              if (sc[0] > maxX) maxX = sc[0];
              if (sc[1] < minY) minY = sc[1];
              if (sc[1] > maxY) maxY = sc[1];
            }
            while (keys.length > 1 && keys[keys.length - 1] === keys[0]) keys.pop();
            if (keys.length < 3) continue;
            for (let i = 0; i < keys.length; i++) {
              const ek = edgeKey(keys[i], keys[(i + 1) % keys.length]);
              edgeCounts.set(ek, (edgeCounts.get(ek) || 0) + 1);
            }
            rawRings.push({
              prov,
              polyIdx,
              keys,
              maxSpan: Math.max(maxX - minX, maxY - minY),
            });
          }
        }
      }

      // Skip secondary sub-pixel offshore reef specks (<0.6 SVG px) while keeping every
      // primary territory ring, significant island, and shared boundary intact.
      const activeRings = rawRings.filter((rec) => {
        if (rec.polyIdx === 0 || rec.maxSpan >= 0.6) return true;
        const keys = rec.keys;
        for (let i = 0; i < keys.length; i++) {
          if ((edgeCounts.get(edgeKey(keys[i], keys[(i + 1) % keys.length])) || 0) >= 2) {
            return true;
          }
        }
        return false;
      });

      const neighborSets = new Map();
      const addNeighbor = (a, b) => {
        let s = neighborSets.get(a);
        if (!s) {
          s = new Set();
          neighborSets.set(a, s);
        }
        s.add(b);
      };
      const pinnedKeys = new Set();
      for (const rec of activeRings) {
        const keys = rec.keys;
        const m = keys.length;
        pinnedKeys.add(keys[0]);
        pinnedKeys.add(keys[Math.floor(m / 3)]);
        pinnedKeys.add(keys[Math.floor((2 * m) / 3)]);
        for (let i = 0; i < m; i++) {
          const kp = keys[(i + m - 1) % m];
          const kc = keys[i];
          const kn = keys[(i + 1) % m];
          addNeighbor(kc, kn);
          addNeighbor(kn, kc);
          const prevInt = (edgeCounts.get(edgeKey(kp, kc)) || 0) >= 2;
          const nextInt = (edgeCounts.get(edgeKey(kc, kn)) || 0) >= 2;
          if (prevInt !== nextInt) pinnedKeys.add(kc);
        }
      }
      for (const [k, nbrs] of neighborSets) {
        if (nbrs.size !== 2) pinnedKeys.add(k);
      }

      // Simplify each topological chain once so shared borders stay bit-identical across
      // neighbor fills and deduplicated boundary tiles.
      const RDP_EPS = 0.38;
      const chainCache = new Map();
      const getSimplifiedChain = (subKeys) => {
        const len = subKeys.length;
        let canonKey;
        let reversed = false;
        if (len === 2) {
          const a = subKeys[0];
          const b = subKeys[1];
          reversed = a > b;
          canonKey = reversed ? `${b}|${a}` : `${a}|${b}`;
        } else {
          const fwdTag = `${subKeys[0]}>${subKeys[1]}`;
          const revTag = `${subKeys[len - 1]}>${subKeys[len - 2]}`;
          reversed = fwdTag > revTag;
          canonKey = reversed ? `${revTag}|${fwdTag}|${len}` : `${fwdTag}|${revTag}|${len}`;
        }
        let canonPts = chainCache.get(canonKey);
        if (!canonPts) {
          const rawPts = new Array(len);
          if (reversed) {
            for (let i = 0; i < len; i++) rawPts[i] = coordByKey.get(subKeys[len - 1 - i]);
          } else {
            for (let i = 0; i < len; i++) rawPts[i] = coordByKey.get(subKeys[i]);
          }
          canonPts = this._simplifyPolylineRdp(rawPts, RDP_EPS);
          chainCache.set(canonKey, canonPts);
        }
        return { canonKey, canonPts, reversed };
      };

      const seenBoundaryChains = new Set();
      const tileBuckets = Array.from({ length: 12 }, () => ({ interior: [], outer: [] }));
      const provPaths = new Map();

      for (const rec of activeRings) {
        const keys = rec.keys;
        const m = keys.length;
        const pinIdx = [];
        for (let i = 0; i < m; i++) {
          if (pinnedKeys.has(keys[i])) pinIdx.push(i);
        }
        const ringPts = [];
        for (let p = 0; p < pinIdx.length; p++) {
          const start = pinIdx[p];
          const end = pinIdx[(p + 1) % pinIdx.length];
          const subKeys = [keys[start]];
          let cursor = start;
          do {
            cursor = (cursor + 1) % m;
            subKeys.push(keys[cursor]);
          } while (cursor !== end);

          const { canonKey, canonPts, reversed } = getSimplifiedChain(subKeys);
          if (reversed) {
            for (let j = canonPts.length - 1; j >= (ringPts.length ? 1 : 0); j--) {
              ringPts.push(canonPts[j]);
            }
          } else {
            for (let j = ringPts.length ? 1 : 0; j < canonPts.length; j++) {
              ringPts.push(canonPts[j]);
            }
          }

          if (!seenBoundaryChains.has(canonKey)) {
            seenBoundaryChains.add(canonKey);
            const midPt = canonPts[canonPts.length >> 1];
            const tx = Math.max(0, Math.min(3, Math.floor(midPt[0] / 250)));
            const ty = Math.max(0, Math.min(2, Math.floor(midPt[1] / 234)));
            const bucket = tileBuckets[ty * 4 + tx];
            const isInterior = (edgeCounts.get(edgeKey(subKeys[0], subKeys[1])) || 0) >= 2;
            (isInterior ? bucket.interior : bucket.outer).push(canonPts);
          }
        }

        if (ringPts.length >= 3) {
          let ringD = `M${ringPts[0][0].toFixed(1)} ${ringPts[0][1].toFixed(1)}`;
          const limit =
            ringPts[ringPts.length - 1][0] === ringPts[0][0] &&
            ringPts[ringPts.length - 1][1] === ringPts[0][1]
              ? ringPts.length - 1
              : ringPts.length;
          if (limit >= 3) {
            for (let i = 1; i < limit; i++) {
              ringD += `L${ringPts[i][0].toFixed(1)} ${ringPts[i][1].toFixed(1)}`;
            }
            ringD += 'Z';
            provPaths.set(rec.prov, (provPaths.get(rec.prov) || '') + ringD);
          }
        }
      }

      const tiles = [];
      let interior = '';
      let outer = '';
      for (const b of tileBuckets) {
        const tInt = this._weldBoundaryChains(b.interior);
        const tOut = this._weldBoundaryChains(b.outer);
        if (!tInt && !tOut) continue;
        tiles.push({ interior: tInt, outer: tOut, combined: `${tInt}${tOut}` });
        interior += tInt;
        outer += tOut;
      }

      this._cachedProvinceBoundaryPaths = {
        interior,
        outer,
        combined: `${interior}${outer}`,
        tiles,
        provPaths,
      };
      return this._cachedProvinceBoundaryPaths;
    }

    _buildModernProvinces() {
      const bounds = this._buildProvinceBoundaryPaths();
      const dashPaths = [];
      for (const prov of this.provinces) {
        const isDash = String(prov.code).includes('_JD');
        const pathD = isDash
          ? this.projector.multiRingsToSvgPath(prov.rings)
          : (bounds.provPaths && bounds.provPaths.get(prov)) ||
            this.projector.multiRingsToSvgPath(prov.rings);
        const path = this._svgNode(
          'path',
          {
            d: pathD,
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
      const tiles = bounds.tiles && bounds.tiles.length ? bounds.tiles : [bounds];
      for (const tile of tiles) {
        if (tile.combined) {
          this._svgNode(
            'path',
            { d: tile.combined, class: 'province-boundary-casing' },
            this.grpProvinces
          );
        }
      }
      for (const tile of tiles) {
        if (tile.interior) {
          this._svgNode(
            'path',
            { d: tile.interior, class: 'province-boundary-interior' },
            this.grpProvinces
          );
        }
      }
      for (const tile of tiles) {
        if (tile.outer) {
          this._svgNode(
            'path',
            { d: tile.outer, class: 'province-boundary-outer' },
            this.grpProvinces
          );
        }
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

    _withSnapshot(snapKey, cb) {
      if (this.snapshots && this.snapshots[snapKey]) {
        const snap = this.snapshots[snapKey];
        if (!this.snapshotCache[snapKey]) {
          this.snapshotCache[snapKey] = Promise.resolve(snap);
        }
        cb(snap);
        return;
      }
      this._fetchSnapshot(snapKey).then(cb);
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
      this._withSnapshot(snapKey, (snap) => {
        if (this.dynasties[this.dynastyIdx] !== dynasty || this._resolveSnapKey(dynasty, this.year) !== snapKey) {
          return;
        }
        this._renderPolitiesAndPrefectures(dynasty, snap);
        if (!this.playing && !this.isScrubbing && !this.activePerson && prevSnap && prevSnap !== snap) {
          this._renderGhostDiff(prevSnap, 'fade');
        }
      });
    }

    _setHoveredPrefecture(el) {
      if (this._hoveredPrefEl === el) return;
      if (this._hoveredPrefEl && this._hoveredPrefEl.classList) {
        this._hoveredPrefEl.classList.remove('is-hovered');
      }
      this._hoveredPrefEl = el || null;
      if (this._hoveredPrefEl && this._hoveredPrefEl.classList) {
        this._hoveredPrefEl.classList.add('is-hovered');
      }
    }

    _clearHoveredPrefecture() {
      if (this._hoveredPrefEl && this._hoveredPrefEl.classList) {
        this._hoveredPrefEl.classList.remove('is-hovered');
      }
      this._hoveredPrefEl = null;
    }

    // Single deduplicated mesh reproducing smoothRingToSvgPath geometry so
    // idle .prefecture-shape elements need no GPU fill or stroke passes.
    _buildPrefectureBoundaryPath(prefs) {
      if (!Array.isArray(prefs) || !prefs.length) return '';
      const cached = PREF_BOUNDARY_MESH_CACHE.get(prefs);
      if (cached !== undefined) return cached;
      const ptKey = (pt) =>
        (Math.round(pt[0] * 100) + 20000) * 65536 + (Math.round(pt[1] * 100) + 10000);
      const seen = new Set();
      let d = '';
      let penX = '';
      let penY = '';
      const emitLine = (x1, y1, x2, y2) => {
        const x1s = x1.toFixed(1);
        const y1s = y1.toFixed(1);
        const x2s = x2.toFixed(1);
        const y2s = y2.toFixed(1);
        if (x1s === x2s && y1s === y2s) return;
        if (x1s !== penX || y1s !== penY) {
          d += `M${x1s} ${y1s}`;
        }
        d += `L${x2s} ${y2s}`;
        penX = x2s;
        penY = y2s;
      };
      for (const pref of prefs) {
        if (!pref || !pref.shape) continue;
        const coords = pref.shape.coordinates;
        const polys = pref.shape.type === 'Polygon' ? [coords] : coords || [];
        for (const poly of polys) {
          if (!poly) continue;
          for (let rIdx = 0; rIdx < poly.length; rIdx++) {
            const rawRing = poly[rIdx];
            if (!rawRing || rawRing.length < 3) continue;
            const ring = this.projector._orientRing(rawRing, rIdx > 0);
            let n = ring.length;
            if (
              n > 3 &&
              Math.abs(ring[0][0] - ring[n - 1][0]) < 1e-6 &&
              Math.abs(ring[0][1] - ring[n - 1][1]) < 1e-6
            ) {
              n--;
            }
            if (n < 3) {
              for (let i = 0; i < ring.length - 1; i++) {
                const k1 = ptKey(ring[i]);
                const k2 = ptKey(ring[i + 1]);
                if (k1 === k2) continue;
                const ek = k1 < k2 ? `E${k1}|${k2}` : `E${k2}|${k1}`;
                if (seen.has(ek)) continue;
                seen.add(ek);
                const [x1, y1] = this.projector.toScreen(ring[i][0], ring[i][1]);
                const [x2, y2] = this.projector.toScreen(ring[i + 1][0], ring[i + 1][1]);
                emitLine(x1, y1, x2, y2);
              }
              continue;
            }
            const pts = new Array(n);
            const keys = new Float64Array(n);
            for (let i = 0; i < n; i++) {
              pts[i] = this.projector.toScreen(ring[i][0], ring[i][1]);
              keys[i] = ptKey(ring[i]);
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
            for (let i = 0; i < n; i++) {
              const next = (i + 1) % n;
              const k0 = keys[i];
              const k1 = keys[next];
              if (curved[i] && k0 !== k1) {
                const ek = k0 < k1 ? `E${k0}|${k1}` : `E${k1}|${k0}`;
                if (!seen.has(ek)) {
                  seen.add(ek);
                  emitLine(sx[i], sy[i], ex[i], ey[i]);
                }
              }
              if (curved[i] && curved[next]) {
                const k2 = keys[(next + 1) % n];
                const qa = k0 < k2 ? `${k0}|${k2}` : `${k2}|${k0}`;
                const qk = `Q${k1}|${qa}`;
                if (!seen.has(qk)) {
                  seen.add(qk);
                  const x1s = ex[i].toFixed(1);
                  const y1s = ey[i].toFixed(1);
                  const x2s = sx[next].toFixed(1);
                  const y2s = sy[next].toFixed(1);
                  if (x1s !== penX || y1s !== penY) {
                    d += `M${x1s} ${y1s}`;
                  }
                  d += `Q${pts[next][0].toFixed(1)} ${pts[next][1].toFixed(1)} ${x2s} ${y2s}`;
                  penX = x2s;
                  penY = y2s;
                }
              } else if (!curved[i] && !curved[next]) {
                if (k0 !== k1) {
                  const ek = k0 < k1 ? `E${k0}|${k1}` : `E${k1}|${k0}`;
                  if (!seen.has(ek)) {
                    seen.add(ek);
                    emitLine(sx[i], sy[i], sx[next], sy[next]);
                  }
                }
              } else {
                const cx0 = curved[i] ? ex[i] : sx[i];
                const cy0 = curved[i] ? ey[i] : sy[i];
                const aTag = `${cx0.toFixed(1)},${cy0.toFixed(1)}`;
                const bTag = `${sx[next].toFixed(1)},${sy[next].toFixed(1)}`;
                if (aTag !== bTag) {
                  const sk = aTag < bTag ? `S${aTag}|${bTag}` : `S${bTag}|${aTag}`;
                  if (!seen.has(sk)) {
                    seen.add(sk);
                    emitLine(cx0, cy0, sx[next], sy[next]);
                  }
                }
              }
            }
          }
        }
      }
      PREF_BOUNDARY_MESH_CACHE.set(prefs, d);
      return d;
    }

    _renderPrefecturesLayer(snap) {
      if (!this.grpPrefectures || !snap) return;
      const prefs = snap.prefectures || null;
      const canReusePrefs = Boolean(
        this._prefShapesGroup &&
          this._prefShapesGroup.parentNode === this.grpPrefectures &&
          this._renderedPrefecturesRef === prefs
      );
      if (!canReusePrefs) {
        this.grpPrefectures.innerHTML = '';
        const prefGroup = this._svgNode('g', {}, this.grpPrefectures);
        const meshD = this._buildPrefectureBoundaryPath(prefs);
        if (meshD) {
          this._svgNode('path', { d: meshD, class: 'prefecture-boundary-mesh' }, prefGroup);
        }
        for (const pref of prefs || []) {
          const path = this._svgNode(
            'path',
            { d: this.projector.shapeToSvgPath(pref.shape), class: 'prefecture-shape' },
            prefGroup
          );
          path.dataset.prefTitle = pref.title;
          path.dataset.prefCategory = pref.category;
        }
        this._prefShapesGroup = prefGroup;
        this._renderedPrefecturesRef = prefs;
        this._regOverlayGroup = this._svgNode('g', {}, this.grpPrefectures);
      } else if (this._regOverlayGroup && this._regOverlayGroup.parentNode === this.grpPrefectures) {
        this._regOverlayGroup.innerHTML = '';
      } else {
        this._regOverlayGroup = this._svgNode('g', {}, this.grpPrefectures);
      }

      const regGroup = this._regOverlayGroup;
      // Captions stay unclipped; only the lines and hover shapes are cut to the polities.
      const clipAttr = this._prefClipActive ? { 'clip-path': 'url(#prefecture-clip)' } : {};
      const shapesGroup = this._prefShapesGroup;
      if (shapesGroup && typeof shapesGroup.setAttribute === 'function') {
        if (this._prefClipActive) shapesGroup.setAttribute('clip-path', 'url(#prefecture-clip)');
        else if (typeof shapesGroup.removeAttribute === 'function') shapesGroup.removeAttribute('clip-path');
      }
      const regBoundaryPath = this._buildRegionBoundaryPath(snap);
      if (regBoundaryPath) {
        this._svgNode(
          'path',
          { d: regBoundaryPath, class: 'region-shape-casing', ...clipAttr },
          regGroup
        );
        this._svgNode(
          'path',
          { d: regBoundaryPath, class: 'region-shape', ...clipAttr },
          regGroup
        );
      }

      for (const reg of snap.regions || []) {
        if (reg.anchor && reg.title) {
          const isQiao = reg.category === '侨州';
          if (
            !isQiao &&
            snap._allowRegionAnchor &&
            !snap._allowRegionAnchor(reg.anchor[0], reg.anchor[1])
          ) {
            continue;
          }
          const [baseX, baseY] = this.projector.toScreen(reg.anchor[0], reg.anchor[1]);
          const rLbl = this._svgNode(
            'text',
            {
              class: isQiao ? 'region-caption is-qiaozhou' : 'region-caption',
              'data-x': baseX.toFixed(1),
              'data-y': baseY.toFixed(1),
              'data-base-x': baseX.toFixed(1),
              'data-base-y': baseY.toFixed(1),
            },
            regGroup
          );
          rLbl._regShape = reg.shape;
          rLbl.textContent = isQiao
            ? this.locale === 'en'
              ? `${this.trTerm(reg.title)} (Emigre)`
              : this._zh(`${reg.title}·侨`)
            : this.trTerm(reg.title);
        }
      }
    }

    _materializeDeferredPrefectures() {
      if (!this._deferredPrefectureSnap || !this.grpPrefectures) return false;
      const snap = this._deferredPrefectureSnap;
      this._deferredPrefectureSnap = null;
      this._renderPrefecturesLayer(snap);
      this._syncTracedPrefecture();
      this._typoDirty = true;
      return true;
    }

    _renderPolitiesAndPrefectures(dynasty, snap) {
      this._setPolityFocus(null);
      this._clearHoveredPrefecture();
      this.grpPolities.innerHTML = '';

      const polGroup = this._svgNode('g', {}, this.grpPolities);
      const zOrder = { neighbor: 0, main: 1, rival: 2, protectorate: 3 };
      const sorted = (snap.polities || [])
        .slice()
        .sort((a, b) => (zOrder[a.role] || 0) - (zOrder[b.role] || 0));
      const ownPaths = [];

      for (const pol of sorted) {
        const isN = pol.role === 'neighbor';
        const attrs = {
          d: this.projector.shapeToSvgPath(pol.shape),
          class: `polity-shape ${pol.role}`,
        };
        if (!isN) {
          attrs.fill = pol.tint;
          attrs.stroke = pol.tint;
          ownPaths.push(attrs.d);
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
      // Prefectures and first-level regions come from a different base map than the polity
      // outlines, so their coastlines and outer edges disagree with the polity borders. Their
      // lines are clipped to the snapshot's own (non-neighbor) polities, which leaves the polity
      // outline as the only border and coastline drawn.
      this._prefClipActive = ownPaths.length > 0;
      const clipPath = this.prefClipPath;
      if (clipPath && typeof clipPath.setAttribute === 'function') clipPath.setAttribute('d', ownPaths.join(''));

      const prefHidden = Boolean(
        this.grpPrefectures &&
          this.grpPrefectures.classList &&
          this.grpPrefectures.classList.contains('is-hidden')
      );
      if (prefHidden) {
        if (this._prefShapesGroup || this._regOverlayGroup || this.grpPrefectures.firstChild) {
          this.grpPrefectures.innerHTML = '';
          this._prefShapesGroup = null;
          this._regOverlayGroup = null;
          this._renderedPrefecturesRef = null;
        }
        this._deferredPrefectureSnap = snap;
      } else {
        this._deferredPrefectureSnap = null;
        this._renderPrefecturesLayer(snap);
      }

      this.lastRenderedSnap = snap;
      if (this.activePolity || this.eraFocus) this._setPolityFocus(null);
      this._renderLegendBox(snap);
      if (!prefHidden) this._syncTracedPrefecture();
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
      const polList = snap.polities || [];
      const polAreas = polList.map(() => 0);
      for (let pIdx = 0; pIdx < polList.length; pIdx++) {
        const pol = polList[pIdx];
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
          let area2 = 0;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const x = ring[i][0],
              y = ring[i][1];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            area2 += ring[j][0] * y - x * ring[j][1];
          }
          polAreas[pIdx] += Math.abs(area2) * 0.5;
          polRings.push({ pIdx, minX, maxX, minY, maxY, ring });
        }
      }
      const allCommanderyRegions = snap.regions.every(
        (r) => r && r.title && (r.title.endsWith('郡') || r.title.includes('内史'))
      );
      const hasLargePolity = !allCommanderyRegions && polAreas.some((a) => a >= 35);
      const isMultiRegime = !allCommanderyRegions && polList.filter((p) => p && p.role !== 'neighbor').length >= 4;
      // The boundary build queries many points against the same long rings.
      // Index candidate edges by latitude; all geometric predicates below stay
      // exact. The margin also covers nearPolityBorder's distance test.
      const ringEdgeBins = new Map();
      // The bins must cover the widest upstream distance query, including
      // multi-regime midpoint (0.55) and endpoint (0.38) exclusions.
      const borderMargin = isMultiRegime ? 0.55 : 0.16, binCount = 64;
      const candidateEdges = (b, y) => {
        if (b.ring.length < 128 || b.maxY <= b.minY) return null;
        let index = ringEdgeBins.get(b);
        if (!index) {
          const bins = Array.from({ length: binCount }, () => []);
          const scale = binCount / (b.maxY - b.minY);
          for (let i = 0, j = b.ring.length - 1; i < b.ring.length; j = i++) {
            const y1 = b.ring[i][1], y2 = b.ring[j][1];
            // Extra neighboring bins make the filter conservative at floating
            // point bucket boundaries. They never change the final predicates.
            const lo = Math.max(0, Math.floor((Math.min(y1, y2) - borderMargin - b.minY) * scale) - 1);
            const hi = Math.min(binCount - 1, Math.floor((Math.max(y1, y2) + borderMargin - b.minY) * scale) + 1);
            for (let k = lo; k <= hi; k++) bins[k].push(i);
          }
          index = { bins, scale }; ringEdgeBins.set(b, index);
        }
        return index.bins[Math.max(0, Math.min(binCount - 1, Math.floor((y - b.minY) * index.scale)))];
      };
      const findPolIdx = (x, y, cache) => {
        const key = cache ? `${x},${y}` : null;
        if (cache) {
          const hit = cache.get(key);
          if (hit !== undefined) return hit;
        }
        for (let rIdx = 0; rIdx < polRings.length; rIdx++) {
          const b = polRings[rIdx];
          if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
          const ring = b.ring;
          const edges = cache ? candidateEdges(b, y) : null;
          let inside = false;
          for (let k = 0, count = edges ? edges.length : ring.length; k < count; k++) {
            const i = edges ? edges[k] : k, j = i === 0 ? ring.length - 1 : i - 1;
            const xi = ring[i][0],
              yi = ring[i][1];
            const xj = ring[j][0],
              yj = ring[j][1];
            if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
              inside = !inside;
            }
          }
          if (inside) {
            if (cache) cache.set(key, b.pIdx);
            return b.pIdx;
          }
        }
        if (cache) cache.set(key, -1);
        return -1;
      };
      const allowPolIdx = (pIdx) => {
        if (pIdx < 0) return false;
        const pol = polList[pIdx];
        if (!pol) return false;
        if (hasLargePolity && pol.role === 'rival' && polAreas[pIdx] < 35) return false;
        return true;
      };
      const nearPolityBorder = (x, y, margin) => {
        const m2 = margin * margin;
        for (let rIdx = 0; rIdx < polRings.length; rIdx++) {
          const b = polRings[rIdx];
          if (
            x < b.minX - margin ||
            x > b.maxX + margin ||
            y < b.minY - margin ||
            y > b.maxY + margin
          ) {
            continue;
          }
          const ring = b.ring;
          const edges = candidateEdges(b, y);
          for (let k = 0, count = edges ? edges.length : ring.length; k < count; k++) {
            // Ray edge 0 closes the ring implicitly; the original distance
            // test only considers explicitly consecutive coordinate pairs.
            const end = edges ? edges[k] : k;
            if (end === 0) continue;
            const i = end - 1;
            const x1 = ring[i][0],
              y1 = ring[i][1];
            const x2 = ring[i + 1][0],
              y2 = ring[i + 1][1];
            if (x < Math.min(x1, x2) - margin || x > Math.max(x1, x2) + margin) continue;
            const dx = x2 - x1,
              dy = y2 - y1;
            const len2 = dx * dx + dy * dy;
            let t = len2 > 1e-12 ? ((x - x1) * dx + (y - y1) * dy) / len2 : 0;
            if (t < 0) t = 0;
            else if (t > 1) t = 1;
            const px = x1 + t * dx - x,
              py = y1 + t * dy - y;
            if (px * px + py * py < m2) return true;
          }
        }
        return false;
      };
      Object.defineProperty(snap, '_allowRegionAnchor', {
        value: (x, y) => !polRings.length || allowPolIdx(findPolIdx(x, y)),
        writable: true,
        enumerable: false,
        configurable: true,
      });
      const ptKey = (pt) => `${pt[0].toFixed(2)},${pt[1].toFixed(2)}`;
      const edgeKey = (p1, p2) => {
        const k1 = ptKey(p1);
        const k2 = ptKey(p2);
        return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      };

      // Adjacent phases frequently share the same administrative regions.
      // Keep only the latest topology, so visiting history does not accumulate
      // edge maps. Polity-dependent filtering still runs for every snapshot.
      let topology = this._regionBoundaryTopology;
      if (!topology || topology.regions !== snap.regions) {
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
        const rings = [];
        for (const ring of allRings) {
          const edges = [];
          for (let i = 0; i < ring.length - 1; i++) {
            const p1 = ring[i], p2 = ring[i + 1], key = edgeKey(p1, p2);
            if ((regEdgeCounts.get(key) || 0) >= 2) edges.push({ p1, p2, key });
            else if (edges.length && edges[edges.length - 1] !== null) edges.push(null);
          }
          if (edges.length) rings.push(edges);
        }
        topology = this._regionBoundaryTopology = { regions: snap.regions, rings };
      }

      const seenEdges = new Set();
      const pointPolities = new Map();
      let d = '';
      for (const edges of topology.rings) {
        let penX = NaN;
        let penY = NaN;
        for (const edge of edges) {
          if (!edge || seenEdges.has(edge.key)) {
            penX = NaN;
            penY = NaN;
            continue;
          }
          const { p1, p2, key: ek } = edge;
          const mx = (p1[0] + p2[0]) * 0.5;
          const my = (p1[1] + p2[1]) * 0.5;
          const pIdxM = polRings.length ? findPolIdx(mx, my, pointPolities) : 0;
          if (
            polRings.length &&
            (!allowPolIdx(pIdxM) ||
              findPolIdx(p1[0], p1[1], pointPolities) !== pIdxM ||
              findPolIdx(p2[0], p2[1], pointPolities) !== pIdxM ||
              (hasLargePolity &&
                (nearPolityBorder(mx, my, borderMargin) ||
                  (isMultiRegime &&
                    (nearPolityBorder(p1[0], p1[1], 0.38) || nearPolityBorder(p2[0], p2[1], 0.38))))))
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

      // The label-anchor predicate outlives this build; retain no point cache.
      pointPolities.clear();
      ringEdgeBins.clear();
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

    _passName(p, year = this.year, locale = this.locale) {
      if (!p) return '';
      if (Array.isArray(p.eraNames)) {
        for (const en of p.eraNames) {
          if (
            (en.from === undefined || year >= en.from) &&
            (en.until === undefined || year < en.until)
          ) {
            return locale === 'en' ? en.en || p.ancientEn : this._zh(en.zh || p.ancientZh);
          }
        }
      }
      return locale === 'en' ? p.ancientEn : this._zh(p.ancientZh);
    }

    _settlementAncient(item, year = this.year) {
      if (!item) return '';
      if (Array.isArray(item.eraNames)) {
        for (const en of item.eraNames) {
          if (
            (en.from === undefined || year >= en.from) &&
            (en.until === undefined || year < en.until)
          ) {
            return en.zh || item.ancient || '';
          }
        }
      }
      return item.ancient || '';
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
          const base = this._isSettlementCapital(item, year) ? '2' : '1';
          return item.eraNames ? `${base}${this._settlementAncient(item, year)}` : base;
        })
        .join('');
      const pMask = HistoricalAtlasController.STRATEGIC_PASSES.map((p) =>
        (p.appear !== undefined && year < p.appear) ||
        (p.vanish !== undefined && year >= p.vanish)
          ? '0'
          : this._passName(p, year, 'zh')
      ).join('|');
      return `${sMask}:${pMask}`;
    }

    _renderSettlements(dynasty) {
      this.activeSettlementMask = this._settlementMask(dynasty, this.year);
      this.grpSettlements.innerHTML = '';
      const group = this._svgNode('g', {}, this.grpSettlements);
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
              dynasty.seat.includes(this._settlementAncient(s, this.year).split(/[（(]/)[0])
          ) || activeList.find((s) => this._isSettlementCapital(s, this.year))
        : null;

      for (const item of activeList) {
        const [x, y] = this.projector.toScreen(item.coord[0], item.coord[1]);
        const isCapNow = this._isSettlementCapital(item, this.year);
        const ancientZh = this._settlementAncient(item, this.year);
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
        node.dataset.ancient = ancientZh;
        node.dataset.modern = item.modern || '';
        node.dataset.remark = item.remark || '';
        node.dataset.lng = String(item.coord[0]);
        node.dataset.lat = String(item.coord[1]);
        node.dataset.prefAlign = item.align || 'r';
        if (item.align) node.dataset.explicitAlign = '1';
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
        const anchor = align === 'l' ? 'end' : align === 'b' || align === 't' ? 'middle' : 'start';
        const dx = align === 'l' ? -5.5 : align === 'b' || align === 't' ? 0 : 5.5;
        const dy1 = align === 'b' ? 10.2 : align === 't' ? -4.8 : 3.0;
        node.dataset.appliedDir = align;

        const nameEl = this._svgNode(
          'text',
          { class: 'name', x: dx, y: dy1, 'text-anchor': anchor },
          node
        );
        nameEl.textContent =
          dynasty.key === 'roc' || dynasty.key === 'prc'
            ? this.trModernCity(ancientZh)
            : this.trTerm(ancientZh);

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
              Math.abs(m.year - this.year) <= 8 &&
              this._milestoneCoords(m).some((mc) => this.projector.greatCircleKm(p.coord, mc) <= 42)
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
          const passDisplay = this._passName(p, this.year, this.locale);
          pNode.dataset.ancient = passDisplay;
          pNode.dataset.modern = this.locale === 'en' ? p.modernEn : this._zh(p.modernZh);
          pNode.dataset.remark = this.locale === 'en' ? p.rangeEn : this._zh(p.rangeZh);
          pNode.dataset.chokepoint =
            (this.locale === 'en' ? p.chokepointEn : this._zh(p.chokepointZh || '')) || '';
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
          nameEl.textContent = passDisplay;
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
      const group = this._svgNode('g', {}, this.grpCorridors);
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
      const group = this._svgNode('g', {}, this.grpMilestones);
      (dynasty.milestones || []).forEach((m, idx) => {
        const anchors = this._getMilestoneAnchors(dynasty, m);
        if (!anchors.length) return;
        const primarySiteIdx = this._defaultAnchorIndex(m, anchors, true);
        anchors.forEach((anc, siteIdx) => {
          if (!anc.coord) return;
          const [x, y] = this.projector.toScreen(anc.coord[0], anc.coord[1]);
          const isPrimary = siteIdx === primarySiteIdx;
          const pin = this._svgNode(
            'g',
            {
              class: isPrimary ? 'milestone-pin' : 'milestone-pin is-secondary-pin',
              'data-x': x.toFixed(1),
              'data-y': y.toFixed(1),
              'data-lng': anc.coord[0].toFixed(3),
              'data-lat': anc.coord[1].toFixed(3),
              'data-year': m.year,
              'data-idx': idx,
              'data-site-idx': siteIdx,
            },
            group
          );
          this._svgNode('circle', { class: 'ev-hit', r: 7 }, pin);
          this._svgNode('circle', { class: 'ev-ring', r: 7 }, pin);
          this._svgNode('polygon', { class: 'ev-core', points: '0,-3.9 3.9,0 0,3.9 -3.9,0' }, pin);
        });
      });
      this._updateMilestoneStates(dynasty);
      this._rescaleSvgTypography();
      if (!this._deferTypographyDepth) {
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

    _splitOutsideParens(str, sepRegex) {
      if (!str) return [];
      const parts = [];
      let depth = 0;
      let cur = '';
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === '（' || ch === '(') {
          depth++;
          cur += ch;
          continue;
        }
        if (ch === '）' || ch === ')') {
          depth = Math.max(0, depth - 1);
          cur += ch;
          continue;
        }
        if (depth === 0) {
          const rest = str.slice(i);
          const match = rest.match(sepRegex);
          if (match && match.index === 0) {
            if (cur.trim()) parts.push(cur.trim());
            cur = '';
            i += match[0].length - 1;
            continue;
          }
        }
        cur += ch;
      }
      if (cur.trim()) parts.push(cur.trim());
      return parts;
    }

    _milestoneCoords(m) {
      if (!m) return [];
      if (Array.isArray(m.siteCoords) && m.siteCoords.length) return m.siteCoords;
      return m.coord ? [m.coord] : [];
    }

    _getMilestoneAnchors(dynasty, m) {
      if (!m) return [];
      const cleanShort = (s) =>
        String(s || '')
          .replace(/\s*（[^）]*）|\s*\([^)]*\)/g, '')
          .trim() || String(s || '').trim();
      const zhParts = m.site ? this._splitOutsideParens(m.site, /\s*·\s*/) : [];
      if (
        Array.isArray(m.siteCoords) &&
        m.siteCoords.length >= 2 &&
        m.siteCoords.length === zhParts.length
      ) {
        const isModDyn = Boolean(dynasty && (dynasty.key === 'roc' || dynasty.key === 'prc'));
        let locParts;
        if (this.locale === 'en') {
          const enRaw = this._enMilestoneSite(dynasty, m);
          const enSplit = this._splitOutsideParens(enRaw, /\s*(?:·|&|\/|,)\s*/);
          locParts =
            enSplit.length === zhParts.length
              ? enSplit
              : zhParts.map((p) => (isModDyn ? this.trModernCity(p) : this.trTerm(p)));
        } else {
          locParts = zhParts.map((p) => (isModDyn ? this.trModernCity(p) : this.trTerm(p)));
        }
        const merged = [];
        for (let i = 0; i < m.siteCoords.length; i++) {
          const coord = m.siteCoords[i];
          const fullLabel = locParts[i] || '';
          const shortLabel = cleanShort(fullLabel);
          const nearIdx =
            this.projector && typeof this.projector.greatCircleKm === 'function'
              ? merged.findIndex((a) => this.projector.greatCircleKm(a.coord, coord) <= 32)
              : -1;
          if (nearIdx >= 0) {
            if (shortLabel && !merged[nearIdx].shortLabel.includes(shortLabel)) {
              merged[nearIdx].shortLabel += ` · ${shortLabel}`;
              merged[nearIdx].fullLabel += ` · ${fullLabel}`;
            }
          } else {
            merged.push({ shortLabel, fullLabel, coord });
          }
        }
        return merged;
      }
      if (!m.coord) return [];
      const rawSiteStr = m.site ? this.milestoneSite(dynasty, m) : '';
      const shortLabel = cleanShort(rawSiteStr).replace(/\s*·\s*/g, ' · ');
      return [{ shortLabel, fullLabel: rawSiteStr, coord: m.coord }];
    }

    _defaultAnchorIndex(m, anchors, ignoreActiveTrace = false) {
      if (!anchors || anchors.length <= 1) return 0;
      const canDist = Boolean(this.projector && typeof this.projector.greatCircleKm === 'function');
      if (!ignoreActiveTrace && Array.isArray(this.activeTrace) && canDist) {
        const tIdx = anchors.findIndex(
          (a) => a.coord && this.projector.greatCircleKm(this.activeTrace, a.coord) <= 30
        );
        if (tIdx >= 0) return tIdx;
      }
      if (m && m.coord && canDist) {
        let bestIdx = 0;
        let bestKm = Infinity;
        anchors.forEach((a, i) => {
          if (!a.coord) return;
          const km = this.projector.greatCircleKm(m.coord, a.coord);
          if (km < bestKm) {
            bestKm = km;
            bestIdx = i;
          }
        });
        if (bestKm <= 60) return bestIdx;
      }
      return 0;
    }

    _milestoneSpanBounds(anchors, defCam) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let maxKm = 0;
      const canDist = Boolean(this.projector && typeof this.projector.greatCircleKm === 'function');
      for (let i = 0; i < anchors.length; i++) {
        const a = anchors[i];
        const [sx, sy] = this.projector.toScreen(a.coord[0], a.coord[1]);
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;
        if (canDist) {
          for (let j = i + 1; j < anchors.length; j++) {
            const km = this.projector.greatCircleKm(a.coord, anchors[j].coord);
            if (km > maxKm) maxKm = km;
          }
        }
      }
      const ar = defCam.h / defCam.w;
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;
      const padX = isMobile ? 74 : 112;
      const padY = isMobile ? 76 : 96;
      const reqW = Math.max(maxX - minX + padX * 2, (maxY - minY + padY * 2) / ar);
      const isContinental = maxKm > 1350 || reqW > defCam.w * 1.04;
      return { minX, maxX, minY, maxY, ar, isMobile, reqW, maxKm, isContinental };
    }

    _frameMilestoneAnchors(dynasty, m, opts = {}) {
      const isMapChange = Boolean(opts && opts.isMapChange);
      const anchors = this._getMilestoneAnchors(dynasty, m).filter((a) => a.coord);
      if (!anchors.length || !this.projector || typeof this._animateCameraTo !== 'function') {
        if (isMapChange && this.camera.w < this._getDefaultCamera().w * 0.85) {
          this.resetCamera();
        }
        return false;
      }
      const defCam = this._getDefaultCamera();
      const frameSingleCoord = (coord) => {
        if (!coord) return false;
        if (isMapChange) {
          const [sx, sy] = this.projector.toScreen(coord[0], coord[1]);
          const outX = sx < defCam.x + defCam.w * 0.14 || sx > defCam.x + defCam.w * 0.86;
          const outY = sy < defCam.y + defCam.h * 0.16 || sy > defCam.y + defCam.h * 0.84;
          if (outX || outY) {
            this._animateCameraTo({
              x: Math.max(-180, Math.min(1000 - defCam.w + 140, sx - defCam.w * 0.5)),
              y: Math.max(-150, Math.min(700 - defCam.h + 120, sy - defCam.h * 0.42)),
              w: defCam.w,
              h: defCam.h,
            });
            return true;
          }
          if (this.camera.w < defCam.w * 0.85) {
            this.resetCamera();
            return true;
          }
          return false;
        }
        this._panToward(coord[0], coord[1]);
        return true;
      };
      if (anchors.length === 1) return frameSingleCoord(anchors[0].coord);
      const { minX, maxX, minY, maxY, ar, isMobile, reqW, isContinental } =
        this._milestoneSpanBounds(anchors, defCam);
      if (isContinental) {
        const primaryCoord =
          (this.activeMilestone &&
            this.activeMilestone.milestone === m &&
            this.activeMilestone.anchorCoord) ||
          (anchors[this._defaultAnchorIndex(m, anchors)] || anchors[0]).coord;
        return frameSingleCoord(primaryCoord);
      }
      const minW = isMapChange ? defCam.w : Math.min(defCam.w, isMobile ? 310 : 410);
      const w = Math.max(minW, Math.min(defCam.w * 1.04, reqW));
      const h = w * ar;
      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5;
      if (
        isMapChange &&
        w <= defCam.w * 1.02 &&
        minX >= defCam.x + defCam.w * 0.12 &&
        maxX <= defCam.x + defCam.w * 0.88 &&
        minY >= defCam.y + defCam.h * 0.14 &&
        maxY <= defCam.y + defCam.h * 0.86
      ) {
        if (this.camera.w < defCam.w * 0.85) {
          this.resetCamera();
          return true;
        }
        return false;
      }
      this._animateCameraTo({
        x: Math.max(-180, Math.min(1000 - w + 140, cx - w * 0.5)),
        y: Math.max(-150, Math.min(700 - h + 120, cy - h * 0.45)),
        w,
        h,
      });
      return true;
    }

    _ensureMilestoneInView(dynasty, m) {
      if (!m || !this.projector || typeof this._animateCameraTo !== 'function') return false;
      const anchors = this._getMilestoneAnchors(dynasty, m).filter((a) => a.coord);
      if (anchors.length <= 1) {
        return this._ensureCoordInView(anchors[0] ? anchors[0].coord : m.coord);
      }
      const defCam = this._getDefaultCamera();
      const { isContinental } = this._milestoneSpanBounds(anchors, defCam);
      if (isContinental) {
        const primaryCoord =
          (this.activeMilestone &&
            this.activeMilestone.milestone === m &&
            this.activeMilestone.anchorCoord) ||
          (anchors[this._defaultAnchorIndex(m, anchors)] || anchors[0]).coord;
        return this._ensureCoordInView(primaryCoord);
      }
      const cam = this._cameraTarget || this.camera;
      const anyOut = anchors.some((a) => {
        const [sx, sy] = this.projector.toScreen(a.coord[0], a.coord[1]);
        return (
          sx < cam.x + cam.w * 0.12 ||
          sx > cam.x + cam.w * 0.88 ||
          sy < cam.y + cam.h * 0.14 ||
          sy > cam.y + cam.h * 0.86
        );
      });
      if (!anyOut) return false;
      return this._frameMilestoneAnchors(dynasty, m, { isMapChange: true });
    }

    _updateMilestoneStates(dynasty) {
      const activeIdx = this._activeMilestoneIndex(dynasty);
      const currentPins = [];
      const canDist = Boolean(this.projector && typeof this.projector.greatCircleKm === 'function');
      const settlementsHidden = Boolean(
        this.grpSettlements &&
          this.grpSettlements.classList &&
          this.grpSettlements.classList.contains('is-hidden')
      );
      const visibleCities =
        canDist && !settlementsHidden && dynasty && Array.isArray(dynasty.settlements)
          ? dynasty.settlements.filter(
              (s) =>
                Array.isArray(s.coord) &&
                (s.appear === undefined || this.year >= s.appear) &&
                (s.vanish === undefined || this.year < s.vanish) &&
                (s.tier !== 2 ||
                  (typeof this._isSettlementCapital === 'function'
                    ? this._isSettlementCapital(s, this.year)
                    : Boolean(s.isCapital)))
            )
          : [];
      const seenPastCoords = [];
      this.grpMilestones.querySelectorAll('.milestone-pin').forEach((pin) => {
        const idx = Number(pin.dataset.idx);
        const m = (dynasty.milestones || [])[idx];
        const effY = m ? this._clampYearToDynasty(dynasty, m.year) : Number(pin.dataset.year);
        const nextFuture = effY > this.year && idx !== activeIdx;
        const isCurrent = idx === activeIdx;
        const isPast = effY <= this.year && !isCurrent;
        let isPastOccluded = false;
        if (isPast && canDist && !pin.classList.contains('is-secondary-pin')) {
          const pinCoord =
            pin.dataset.lng !== undefined && pin.dataset.lat !== undefined
              ? [Number(pin.dataset.lng), Number(pin.dataset.lat)]
              : m && m.coord;
          if (pinCoord) {
            const onCity = visibleCities.some(
              (s) => this.projector.greatCircleKm(pinCoord, s.coord) <= 8
            );
            const dupPast =
              !onCity &&
              seenPastCoords.some((c) => this.projector.greatCircleKm(pinCoord, c) <= 6);
            isPastOccluded = onCity || dupPast;
            if (!isPastOccluded) seenPastCoords.push(pinCoord);
          }
        }
        pin.classList.toggle('is-future', nextFuture);
        pin.classList.toggle('is-past', isPast);
        pin.classList.toggle('is-past-occluded', isPastOccluded);
        pin.classList.toggle('is-current', isCurrent);
        if (isCurrent) currentPins.push(pin);
      });
      for (const pin of currentPins) {
        if (pin && pin.parentNode) pin.parentNode.appendChild(pin);
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
      const renderedLocale = this._effectiveRenderedLocale();
      if (
        this.activeMilestone &&
        !this.activeMilestone.isAuto &&
        this.activeMilestone.dynastyKey === dynasty.key &&
        this.activeMilestone.year === this.year &&
        !this.milestoneBalloon.classList.contains('is-hidden')
      ) {
        if (this.activeMilestone.locale !== renderedLocale) {
          this.openMilestoneBalloon(dynasty, this.activeMilestone.milestone, {
            isAuto: false,
            siteIdx: this.activeMilestone.siteIdx,
          });
        } else {
          this._positionMilestoneBalloon();
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
      // Keep an auto callout that already shows this milestone instead of rebuilding it on
      // every year step, so a tap that lands mid-playback still reaches its buttons.
      const am = this.activeMilestone;
      if (
        am &&
        am.isAuto &&
        am.milestone === m &&
        am.locale === renderedLocale &&
        !this.milestoneBalloon.classList.contains('is-hidden')
      ) {
        this.grpMilestones.querySelectorAll('.milestone-pin').forEach((n) => {
          const sameM = Number(n.dataset.idx) === am.idx;
          n.classList.toggle('is-active', sameM);
          n.classList.toggle('is-anchor-pin', sameM && Number(n.dataset.siteIdx) === am.siteIdx);
        });
        this._positionMilestoneBalloon();
        return;
      }
      this.openMilestoneBalloon(dynasty, m, { isAuto: true });
      if (this.playing && !this.dragState && !this.pinchState) {
        if (this._ensureMilestoneInView(dynasty, m)) {
          this.playHoldTicks = Math.max(this.playHoldTicks, 3);
        }
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
      if (
        milestoneEl.classList &&
        (milestoneEl.classList.contains('is-current') || milestoneEl.classList.contains('is-active'))
      ) {
        return m0;
      }
      const pinCoord =
        milestoneEl.dataset.lng !== undefined && milestoneEl.dataset.lat !== undefined
          ? [Number(milestoneEl.dataset.lng), Number(milestoneEl.dataset.lat)]
          : m0.coord;
      const colocated = list.filter(
        (item) => item.coord && this.projector.greatCircleKm(pinCoord, item.coord) <= 18
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

    _findRelicStopForMilestone(dynasty, m) {
      if (!dynasty || !m) return null;
      const map = {
        'zhanguo:-228': 0,
        'qin:-221': 1,
        'qin:-206': 2,
        'xihan:8': 3,
        'donghan:25': 4,
        'donghan:189': 5,
        'donghan:196': 6,
        'sanguo:220': 7,
        'xijin:311': 8,
        'dongjin:352': 9,
        'sui:589': 10,
        'sui:618': 10,
        'tang:630': 11,
        'wudai:936': 12,
      };
      const idx = map[`${dynasty.key}:${m.year}`];
      return idx !== undefined ? idx : null;
    }

    _findStoryForMilestone(dynasty, m) {
      if (!dynasty || !m) return null;
      const map = {
        'tang:755': { key: 'anshi', stopIdx: -1 },
      };
      return map[`${dynasty.key}:${m.year}`] || null;
    }

    _measureMilestoneBalloonSize(estW = 0, estH = 0) {
      if (this.milestoneBalloon && this.milestoneBalloon.style) {
        const prevLeft = this.milestoneBalloon.style.left;
        const prevTop = this.milestoneBalloon.style.top;
        this.milestoneBalloon.style.left = '0px';
        this.milestoneBalloon.style.top = '0px';
        const realW = this.milestoneBalloon.offsetWidth;
        const realH = this.milestoneBalloon.offsetHeight;
        this.milestoneBalloon.style.left = prevLeft;
        this.milestoneBalloon.style.top = prevTop;
        if (realW > 0 && realH > 0) {
          this._milestoneBalloonSize = { w: realW, h: realH };
          return;
        }
      }
      this._milestoneBalloonSize = {
        w: estW || (this._milestoneBalloonSize && this._milestoneBalloonSize.w) || 260,
        h: estH || (this._milestoneBalloonSize && this._milestoneBalloonSize.h) || 62,
      };
    }

    _selectMilestoneAnchor(siteIdx, anchorsOpt = null) {
      const am = this.activeMilestone;
      if (!am || !this.milestoneBalloon) return;
      const amDyn = this.dynasties.find((d) => d.key === am.dynastyKey);
      const anchors = anchorsOpt || am.anchors || this._getMilestoneAnchors(amDyn, am.milestone);
      const anc = anchors[siteIdx];
      if (!anc || !anc.coord) return;
      am.siteIdx = siteIdx;
      am.anchorCoord = anc.coord;
      am.anchors = anchors;
      this.grpMilestones.querySelectorAll('.milestone-pin').forEach((n) => {
        const sameM = Number(n.dataset.idx) === am.idx;
        n.classList.toggle('is-anchor-pin', sameM && Number(n.dataset.siteIdx) === siteIdx);
      });
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
      const anchors = this._getMilestoneAnchors(dynasty, m);
      const siteIdx =
        opts && Number.isInteger(opts.siteIdx) && anchors[opts.siteIdx]
          ? opts.siteIdx
          : this._defaultAnchorIndex(m, anchors);
      const anchorCoord = (anchors[siteIdx] && anchors[siteIdx].coord) || m.coord;
      this.activeMilestone = {
        dynastyKey: dynasty.key,
        milestone: m,
        idx: mIdx,
        siteIdx,
        anchorCoord,
        anchors,
        year: this.year,
        isAuto,
        locale: this._effectiveRenderedLocale(),
      };
      this.grpMilestones.querySelectorAll('.milestone-pin').forEach((n) => {
        const sameM = Number(n.dataset.idx) === mIdx;
        n.classList.toggle('is-active', sameM);
        n.classList.toggle('is-anchor-pin', sameM && Number(n.dataset.siteIdx) === siteIdx);
      });
      if (!isAuto) {
        this._highlightCurrentMilestone(dynasty);
        this._updateMilestoneStates(dynasty);
      }
      if (!anchorCoord || (opts && opts.fromStep && this.grpMilestones && this.grpMilestones.classList.contains('is-hidden'))) {
        this.milestoneBalloon.classList.add('is-hidden');
        const vf = this._id('viewport-frame');
        if (vf) vf.classList.remove('has-open-milestone-balloon');
        return;
      }
      const yrText = this.formatYear(m.year);
      const eraLabel = this._eventEraLabel(dynasty, m);
      const headlineText = this.milestoneHeadline(dynasty, m);
      const traceTitle =
        this.locale === 'en' ? 'Click to trace place history' : '点击查看此地历代沿革（点地溯源）';
      const isMultiAnchor = anchors.length >= 2;
      const pillsInner = anchors
        .map((anc, k) => {
          if (!anc || !anc.shortLabel) return '';
          const tip = `${anc.fullLabel || anc.shortLabel} · ${traceTitle}`;
          return `<button type="button" class="ep-place" data-site-idx="${k}" title="${escHtml(tip)}">${SVG_ICONS.pin} ${anc.shortLabel} ›</button>`;
        })
        .join('');
      const placeHtml = pillsInner
        ? isMultiAnchor
          ? `<span class="ep-places">${pillsInner}</span>`
          : pillsInner
        : '';
      const placeEstText = anchors
        .map((a) => (a && a.shortLabel ? `${a.shortLabel} ›` : ''))
        .filter(Boolean)
        .join('  ');
      const relicStopIdx = this._findRelicStopForMilestone(dynasty, m);
      const relicTitle =
        this.locale === 'en'
          ? 'Trace the Heirloom Seal of the Realm across dynasties'
          : '点击溯源「传国玉玺」历代流转行迹（和氏璧 → 秦始皇 → 后唐玄武楼）';
      const relicLabel = this.locale === 'en' ? 'Seal ›' : '传国玺 ›';
      const relicHtml =
        relicStopIdx !== null
          ? `<button type="button" class="ep-relic-seal" title="${relicTitle}"><span class="seal-stamp">玺</span><span>${relicLabel}</span></button>`
          : '';
      const storyHit = this._findStoryForMilestone(dynasty, m);
      const storyTitle =
        this.locale === 'en'
          ? 'Open the full multi-act historical storyline on the map'
          : '点击展开「安史之乱」八年全脉络时空推演';
      const storyLabel = this.locale === 'en' ? 'Story ›' : '始末 ›';
      const storyHtml = storyHit
        ? `<button type="button" class="ep-relic-seal ep-story-seal" title="${storyTitle}"><span class="seal-stamp">事</span><span>${storyLabel}</span></button>`
        : '';
      const closeTitle = this.locale === 'en' ? 'Dismiss event callout' : '关闭此事件浮签';
      this.milestoneBalloon.innerHTML =
        `<div class="ep-head"><span class="ep-year">${yrText} · ${eraLabel}</span>${placeHtml}${relicHtml}${storyHtml}<button type="button" class="ep-close" title="${closeTitle}" aria-label="${closeTitle}">×</button></div>` +
        `<div class="ep-text">${headlineText}</div>`;
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;
      const maxW = isMobile ? Math.min(268, (window.innerWidth || 390) - 20) : 348;
      const headW =
        this._estimateLocalTextWidth(
          `${yrText} · ${eraLabel}${placeEstText ? ` ${placeEstText}` : ''}${relicStopIdx !== null ? ` 玺 ${relicLabel}` : ''}${storyHit ? ` 事 ${storyLabel}` : ''}`,
          11.5,
          0
        ) + (isMultiAnchor ? 40 + anchors.length * 22 : 52);
      const textW = this._estimateLocalTextWidth(headlineText, isMobile ? 11.5 : 12.2, 0);
      const estW = Math.round(
        Math.max(isMobile ? 190 : 220, Math.min(maxW, Math.max(headW, textW + 24)))
      );
      const headLines = Math.max(1, Math.ceil(headW / Math.max(120, estW - 28)));
      const textLines = Math.max(1, Math.ceil(textW / Math.max(120, estW - 22)));
      const estH = Math.round(16 + headLines * (isMobile ? 22 : 20) + textLines * 17.5);
      this._milestoneBalloonSize = { w: estW, h: estH };
      const placeBtns =
        typeof this.milestoneBalloon.querySelectorAll === 'function'
          ? Array.from(this.milestoneBalloon.querySelectorAll('.ep-place'))
          : [this.milestoneBalloon.querySelector('.ep-place')].filter(Boolean);
      placeBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const k = Number(btn.dataset.siteIdx || 0);
          const anc = anchors[k] || anchors[0];
          const baseCoord = (anc && anc.coord) || m.coord;
          if (!baseCoord) return;
          const coCity = this._findCoLocatedSettlement(dynasty, baseCoord[0], baseCoord[1], 28);
          const targetCoord = coCity ? coCity.coord : baseCoord;
          if (this.activeMilestone && this.activeMilestone.milestone === m) {
            this.activeMilestone.isAuto = false;
            this._selectMilestoneAnchor(k, anchors);
          }
          this.openGenealogyAt(
            targetCoord[0],
            targetCoord[1],
            coCity ? null : anc && anc.shortLabel ? anc.shortLabel : null
          );
          this._panToward(targetCoord[0], targetCoord[1]);
        });
      });
      const relicBtn = this.milestoneBalloon.querySelector('.ep-relic-seal:not(.ep-story-seal)');
      if (relicBtn && relicStopIdx !== null) {
        relicBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openPersonChronicle('yuxi', relicStopIdx);
        });
      }
      const storyBtn = this.milestoneBalloon.querySelector('.ep-story-seal');
      if (storyBtn && storyHit) {
        storyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openPersonChronicle(storyHit.key, storyHit.stopIdx);
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
      this._measureMilestoneBalloonSize(estW, estH);
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.add('has-open-milestone-balloon');
      this._positionMilestoneBalloon();
    }

    // Box of the event city's name, in the same coordinates as the balloon. The event
    // city is the nearest settlement within 10 CSS px of the pin (event and city
    // coordinates often differ by a few hundredths of a degree). The name's offset from
    // the pin is measured only while the camera is still (on open and after each move
    // settles), so pan and zoom frames reuse it without layout reads.
    _milestoneAnchorLabel(am, sx, sy, scale, rect, px, py) {
      if (!am || !this.svg) return null;
      const moving = Boolean(this.svg.classList && this.svg.classList.contains('is-camera-moving'));
      const key = `${sx.toFixed(1)},${sy.toFixed(1)}:${this.camera.w.toFixed(1)}`;
      if (!moving && am._labelKey !== key && typeof this.svg.querySelectorAll === 'function') {
        am._labelKey = key;
        am._labelOffset = null;
        let city = null;
        let best = 10 / scale;
        for (const node of this.svg.querySelectorAll('.settlement-node')) {
          const d = Math.hypot(Number(node.dataset.x) - sx, Number(node.dataset.y) - sy);
          if (d <= best) {
            best = d;
            city = node;
          }
        }
        const name = city && !city.classList.contains('is-crowded-hidden') ? city.querySelector('.name') : null;
        const b = name && name.getBoundingClientRect();
        const x0 = (rect.left || 0) + px, y0 = (rect.top || 0) + py;
        // A name far from its dot has not been laid out yet; measure again after layout.
        if (b && b.width && Math.hypot((b.left + b.right) / 2 - x0, (b.top + b.bottom) / 2 - y0) > 80) {
          am._labelKey = null;
        } else if (b && b.width) {
          // Text boxes include some leading; a balloon that only touches the glyphs is fine.
          const pad = -2;
          am._labelOffset = {
            left: b.left - x0 - pad,
            right: b.right - x0 + pad,
            top: b.top - y0 - pad,
            bottom: b.bottom - y0 + pad,
          };
        }
      }
      const o = am._labelOffset;
      return o ? { left: px + o.left, right: px + o.right, top: py + o.top, bottom: py + o.bottom } : null;
    }

    _positionMilestoneBalloon(viewportRect = null) {
      const am = this.activeMilestone;
      const anchorCoord = am && (am.anchorCoord || am.milestone.coord);
      if (!anchorCoord) return;
      const [sx, sy] = this.projector.toScreen(anchorCoord[0], anchorCoord[1]);
      const rect =
        viewportRect ||
        (this.dragState && this.dragState.rect) ||
        (this.pinchState && this.pinchState.rect) ||
        this._cameraViewportRect ||
        this.svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this._cameraViewportRect = rect;
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
      const bW =
        (this._milestoneBalloonSize && this._milestoneBalloonSize.w) ||
        this.milestoneBalloon.offsetWidth ||
        (isMobile ? 228 : 260);
      const bH =
        (this._milestoneBalloonSize && this._milestoneBalloonSize.h) ||
        this.milestoneBalloon.offsetHeight ||
        (isMobile ? 54 : 62);
      const minLeft = isMobile ? 8 : 12;
      const rightLimit = Math.max(
        minLeft,
        genOpen ? rect.width - 356 - bW : rect.width - bW - (isMobile ? 8 : 12)
      );
      const minTop = isMobile ? 48 : 12;
      const maxTop = Math.max(minTop, rect.height - bH - (isMobile ? 56 : 16));
      const safeBelowMaxTop = isMobile ? Math.max(minTop, rect.height - bH - 116) : maxTop;
      const pinGap = isMobile ? 10 : 12;

      const sideTop = Math.max(minTop, Math.min(maxTop, py - bH * 0.42));
      const midLeft = Math.max(minLeft, Math.min(rightLimit, px - bW * 0.5));
      let candidates = [];
      if (px + pinGap <= rightLimit) {
        candidates.push({ left: px + pinGap, top: sideTop, caretDir: 'left' });
      }
      if (px - bW - pinGap >= minLeft) {
        candidates.push({ left: px - bW - pinGap, top: sideTop, caretDir: 'right' });
      }
      if (py - bH - pinGap >= minTop) {
        candidates.push({ left: midLeft, top: py - bH - pinGap, caretDir: 'bottom' });
      }
      if (py + pinGap + 4 <= safeBelowMaxTop) {
        candidates.push({ left: midLeft, top: py + pinGap + 4, caretDir: 'top' });
      }
      if (!candidates.length) {
        candidates.push({
          left: midLeft,
          top: Math.min(maxTop, py + pinGap + 4),
          caretDir: 'top',
        });
      }
      // Keep the event city's own name readable: drop placements that cover it.
      const label = this._milestoneAnchorLabel(am, sx, sy, scale, rect, px, py);
      if (label) {
        const clear = candidates.filter(
          (c) =>
            c.left >= label.right || c.left + bW <= label.left || c.top >= label.bottom || c.top + bH <= label.top
        );
        if (clear.length) candidates = clear;
      }

      let chosen = candidates[0];
      if (candidates.length > 1 && am && Array.isArray(am.anchors) && am.anchors.length >= 2) {
        const siblingPts = [];
        for (let i = 0; i < am.anchors.length; i++) {
          if (i === am.siteIdx || !am.anchors[i].coord) continue;
          const [asx, asy] = this.projector.toScreen(
            am.anchors[i].coord[0],
            am.anchors[i].coord[1]
          );
          const spx = padX + (asx - this.camera.x) * scale;
          const spy = padY + (asy - this.camera.y) * scale;
          if (spx >= 0 && spx <= rect.width && spy >= 0 && spy <= rect.height) {
            siblingPts.push([spx, spy]);
          }
        }
        if (siblingPts.length) {
          let bestHits = Infinity;
          for (const c of candidates) {
            let hits = 0;
            for (const [spx, spy] of siblingPts) {
              if (
                spx >= c.left - 8 &&
                spx <= c.left + bW + 8 &&
                spy >= c.top - 8 &&
                spy <= c.top + bH + 8
              ) {
                hits += 1;
              }
            }
            if (hits < bestHits) {
              bestHits = hits;
              chosen = c;
              if (hits === 0) break;
            }
          }
        }
      }
      const { left, top, caretDir } = chosen;
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
      if (!targetTitle && this.activePolity) {
        const pol = this._polityPolsInSnap(this.activePolity, this.lastRenderedSnap)[0];
        if (pol) targetTitle = pol.title;
      } else if (!targetTitle && this.eraFocus) {
        targetTitle = this._eraFocusTitle();
      }
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

    _zoomToPolity(polityTitle, snap = this.lastRenderedSnap) {
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
      if (typeof window !== 'undefined' && window.innerWidth <= 900) {
        this._fitMobileBox(minX, minY, maxX, maxY);
        return;
      }

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

    // Phones: a portrait map is taller than wide, so framing with the desktop 0.7 aspect left
    // wide realms (唐, 元) as a thin strip. Use the real map aspect and keep the box inside the
    // band not covered by the floating search button (top) and legend (bottom).
    _fitMobileBox(minX, minY, maxX, maxY) {
      const fit = (attempt = 0) => {
        this._cameraViewportRect = null;
        const r = this._getUnscaledSvgRect();
        if (!r || r.width < 40) return;
        // Mid-transition the map can still be a sliver; retry instead of framing against it.
        if (r.height < 120) {
          if (attempt < 6 && typeof setTimeout === 'function') setTimeout(() => fit(attempt + 1), 150);
          return;
        }
        const aspect = r.height / r.width;
        const [top, bottom] = this._mobileMapVisibleBand(r);
        const band = bottom - top;
        const spanW = Math.max(maxX - minX, (maxY - minY) / (aspect * band)) * 1.16;
        const w = Math.max(170, Math.min(1300, spanW));
        const h = w * aspect;
        const cx = (minX + maxX) * 0.5;
        const cy = (minY + maxY) * 0.5;
        this._animateCameraTo({ x: cx - w * 0.5, y: cy - h * (top + band * 0.5), w, h });
      };
      // Measure only after a just-toggled bottom sheet has finished resizing the map.
      const wait = 260 - (Date.now() - (this._mobileSheetToggledAt || 0));
      if (wait > 0 && typeof setTimeout === 'function') setTimeout(fit, wait);
      else fit();
    }

    // [top, bottom] fractions of the map height left visible by the mobile floating chrome.
    _mobileMapVisibleBand(svgRect) {
      // Leave ~56px for the floating search button, but never more than 12% of a short map.
      const top = Math.min(0.12, 56 / svgRect.height);
      let bottom = 0.98;
      const legend = this.mapKey;
      if (legend && typeof legend.getBoundingClientRect === 'function') {
        const lr = legend.getBoundingClientRect();
        if (lr.height > 0 && lr.top > svgRect.top + svgRect.height * 0.35 && lr.top < svgRect.bottom) {
          bottom = Math.min(bottom, (lr.top - svgRect.top - 8) / svgRect.height);
        }
      }
      return [top, Math.max(top + 0.3, bottom)];
    }

    // ---------------- Polity Focus (regional / rival regimes) ----------------
    // A macro-era (e.g. 南北朝) contains several co-existing regimes. Polity focus re-targets the
    // chronicle pane at one regime's own lifeline. Identity is (snapshot title, year window): the same
    // title (宋, 齐, 吴, 魏) denotes different regimes in different eras.
    static get POLITY_PROFILES() {
      return (window.ATLAS_LORE_DATA && window.ATLAS_LORE_DATA.POLITY_PROFILES) || [];
    }

    _polityWindow(desc) {
      return [
        desc.matchFrom !== undefined ? desc.matchFrom : desc.from,
        desc.matchTo !== undefined ? desc.matchTo : desc.to,
      ];
    }

    _polityInRange(desc, year) {
      if (!desc) return false;
      const [mf, mt] = this._polityWindow(desc);
      return year >= mf && year <= mt;
    }

    _polityPhaseRuns() {
      if (this._polityRunsCache) return this._polityRunsCache;
      const runs = [];
      for (const d of this.dynasties || []) {
        const phases =
          Array.isArray(d.phases) && d.phases.length
            ? d.phases
            : [{ snap: `s_${d.key}`, until: d.toYear + 1 }];
        let start = d.fromYear;
        for (const ph of phases) {
          runs.push({ dynasty: d, from: start, to: ph.until - 1, snapKey: ph.snap });
          start = ph.until;
        }
      }
      this._polityRunsCache = runs;
      return runs;
    }

    _polityProfileFor(title, year) {
      if (!title) return null;
      for (const p of HistoricalAtlasController.POLITY_PROFILES) {
        if ((p.titles || []).includes(title) && this._polityInRange(p, year)) return p;
      }
      return null;
    }

    _polityPolsInSnap(desc, snap) {
      if (!desc || !snap) return [];
      return (snap.polities || []).filter(
        (p) => p.role !== 'neighbor' && desc.titles.includes(p.title)
      );
    }

    _resolvePolity(title, year) {
      const prof = this._polityProfileFor(title, year);
      if (prof) return { ...prof, curated: true };
      // Uncurated regimes (warlords, short-lived rivals) get the contiguous span in which the
      // title is drawn on the map around `year`.
      const runs = this._polityPhaseRuns().filter((r) => {
        const snap = this.snapshots && this.snapshots[r.snapKey];
        return snap && (snap.polities || []).some((p) => p.role !== 'neighbor' && p.title === title);
      });
      let from = year;
      let to = year;
      const hit = runs.find((r) => year >= r.from && year <= r.to);
      if (hit) {
        from = hit.from;
        to = hit.to;
        let grew = true;
        while (grew) {
          grew = false;
          for (const r of runs) {
            if (r.from < from && r.to >= from - 1) {
              from = r.from;
              grew = true;
            }
            if (r.to > to && r.from <= to + 1) {
              to = r.to;
              grew = true;
            }
          }
        }
      }
      const bare = title.replace(/[（(][^）)]*[）)]/g, '').trim();
      const inner = (title.match(/[（(]([^）)]*)[）)]/) || [])[1] || '';
      const stopKws = new Set([
        '北方', '河北', '江东', '荆州', '益州', '荆益', '荆扬', '交州', '兖豫', '幽州', '冀州', '凉州',
        '关陇', '汉中', '辽东', '西州', '湖南', '云南', '关中', '浙江', '河东', '内附', '日占', '荷占',
        '德租', '英租', '俄租', '日军侵占', '沙俄侵占', '孤悬坚守', '总制院辖', '驻藏大臣', '两广统一',
        '自治', '苏控', '北洋政府', '西南各系', '甘宁青',
      ]);
      const oneCharKws = {
        周: ['周威烈王', '周安王', '周室', '东周', '洛邑'],
        宋: ['宋国', '灭宋', '商丘'],
        鲁: ['鲁国', '曲阜', '邹邑'],
        越: ['越王', '越国', '灭越'],
        蜀: ['灭蜀', '蜀郡', '巴、蜀'],
        巴: ['灭巴', '巴、蜀', '巴郡'],
        代: ['代王', '奔代'],
        赵: ['赵王', '灭赵', '井陉'],
        齐: ['齐王', '田横', '韩信'],
        燕: ['燕王', '臧荼', '灭赵'],
        晋: ['司马炎', '代魏建晋', '三国归晋', '王濬'],
        元: ['大元', '元大都', '元军', '伯颜', '崖山'],
        清: ['大清', '皇太极', '松锦', '入关'],
      };
      const uncuratedExtraKws = {
        闽越: ['无诸', '百越', '鸿沟', '垓下'],
        赤眉军: ['赤眉', '昆阳', '更始', '刘秀'],
        '隗嚣 · 窦融': ['隗嚣', '窦融', '昆阳', '更始', '刘秀'],
        '马腾(凉州)': ['董卓', '长安', '凉州'],
        '刘表(荆州)': ['荆州', '隆中对', '赤壁', '三顾茅庐'],
        '刘焉(益州)': ['益州', '董卓'],
        '刘繇·孙氏(江东)': ['孙策', '江东'],
        '士燮(交州)': ['交州', '赤壁', '荆州'],
        '吴（杜伏威）': ['杜伏威', '江都', '瓦岗'],
        '秦（薛举）': ['薛举', '李渊', '大兴'],
        '凉（李轨）': ['李轨', '河西', '李渊'],
        '唐 · 岐（关中）': ['李茂贞', '关中', '藩镇'],
        大长和: ['南诏', '大理', '段思平'],
        清源军: ['留从效', '陈洪进', '南唐', '纳土归宋'],
        '武平（湖南）': ['湖南', '假道灭虢'],
        方国珍: ['方国珍', '张士诚', '集庆'],
        陈友定: ['陈友定', '北伐', '统一江南'],
        '威海卫（英租）': ['强租', '胶州湾', '戊戌'],
        '九龙新界（英租）': ['新界', '强租'],
        '晋系（阎锡山）': ['南北军阀', '直皖战争', '直奉战争'],
        '西北诸马（甘宁青）': ['南北军阀', '直皖战争'],
        '新疆（杨增新）': ['南北军阀', '北伐'],
        西南川滇黔桂各系: ['护法', '直皖战争', '广州', '孙中山'],
        '川滇黔军阀（刘湘 · 唐继尧）': ['南北军阀', '北伐'],
      };
      const bareTokens = bare.split(/[·/、\s]+/);
      const parts = [
        bare,
        ...bareTokens,
        ...bareTokens.flatMap((t) => oneCharKws[t] || []),
        ...inner.split(/[·/、\s]+/),
        ...(oneCharKws[bare] || []),
        ...(uncuratedExtraKws[title] || []),
      ];
      const keywords = [
        ...new Set(
          [title, ...parts]
            .map((s) => s.trim())
            .filter((s) => s.length >= 2 && !stopKws.has(s) && !/^\d/.test(s))
        ),
      ];
      return { key: `t:${title}@${from}`, zh: title, en: '', titles: [title], from, to, keywords, curated: false };
    }

    _polityStages(desc) {
      const [mf, mt] = this._polityWindow(desc);
      const stages = [];
      let lastPols = null;
      let lastSig = null;
      const sigOf = (list) =>
        list
          .map((p) => {
            const sh = p && p.shape;
            if (!sh || typeof sh !== 'object') return String(sh);
            let s = SHAPE_SIG_WEAK.get(sh);
            if (s === undefined) {
              s = JSON.stringify(sh);
              SHAPE_SIG_WEAK.set(sh, s);
            }
            return s;
          })
          .join('\x1f');
      for (const r of this._polityPhaseRuns()) {
        if (r.to < mf || r.from > mt) continue;
        const snap = this.snapshots && this.snapshots[r.snapKey];
        const pols = this._polityPolsInSnap(desc, snap);
        if (!pols.length) {
          lastPols = null;
          lastSig = null;
          continue;
        }
        const from = Math.max(r.from, mf);
        const to = Math.min(r.to, mt);
        if (lastPols && stages.length) {
          const sameShapeRef =
            pols.length === lastPols.length &&
            pols.every((p, i) => p && lastPols[i] && p.shape === lastPols[i].shape);
          if (sameShapeRef) {
            stages[stages.length - 1].to = to;
            continue;
          }
          const prevSig = lastSig !== null ? lastSig : (lastSig = sigOf(lastPols));
          const curSig = sigOf(pols);
          if (curSig === prevSig) {
            stages[stages.length - 1].to = to;
            lastPols = pols;
            continue;
          }
          lastPols = pols;
          lastSig = curSig;
        } else {
          lastPols = pols;
          lastSig = null;
        }
        stages.push({ from, to, snapKey: r.snapKey, title: pols[0].title, caption: snap.caption || '' });
      }
      return stages;
    }

    _polityEvents(desc) {
      const [rawMf, rawMt] = this._polityWindow(desc);
      const mf = desc.curated ? rawMf : rawMf - 1;
      const mt = desc.curated ? rawMt : rawMt + 1;
      const kws = (desc.keywords || []).filter(Boolean);
      if (!kws.length) return [];
      const matches = (text) => kws.some((k) => String(text || '').includes(k));
      const out = [];
      const seen = new Set();
      for (const d of this.dynasties || []) {
        for (const m of d.milestones || []) {
          if (m.year < mf || m.year > mt || !matches(m.headline)) continue;
          const sig = `${m.year}:${m.headline.slice(0, 12)}`;
          if (seen.has(sig)) continue;
          seen.add(sig);
          out.push({ year: m.year, dynasty: d, milestone: m, coord: m.coord || null });
        }
      }
      for (const e of HistoricalAtlasController.PLACE_LANDMARK_EVENTS) {
        if (e.year < mf || e.year > mt || !matches(e.zh)) continue;
        const sig = `${e.year}:${e.site || ''}`;
        if (seen.has(sig)) continue;
        if (
          out.some(
            (x) =>
              x.year === e.year &&
              x.coord &&
              e.coord &&
              Math.hypot(x.coord[0] - e.coord[0], x.coord[1] - e.coord[1]) < 0.6
          )
        ) {
          continue;
        }
        seen.add(sig);
        const d = (this.dynasties || []).find((x) => x.key === e.dynastyKey) || null;
        out.push({ year: e.year, dynasty: d, landmark: e, coord: e.coord || null });
      }
      out.sort((a, b) => a.year - b.year);
      return out;
    }

    _polityRulers(desc) {
      const en = this.locale === 'en';
      if (desc.rulersZh) return en ? desc.rulersEn || desc.rulersZh : this._zh(desc.rulersZh);
      const names = [];
      const prefixes = [desc.zh, ...(desc.titles || []), ...(desc.monarchPrefix || [])]
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);
      const push = (zh, enName) => {
        if (!zh) return;
        let v = en ? enName || zh : zh;
        if (!en) {
          const px = prefixes.find((p) => v.startsWith(p) && v.length > p.length);
          if (px) v = v.slice(px.length);
          v = this._zh(v);
        }
        if (v && !names.includes(v)) names.push(v);
      };
      const track = (HistoricalAtlasController.REGIONAL_ERA_TRACKS || []).find(
        (t) =>
          (t.polities || []).some((p) => desc.titles.includes(p)) &&
          t.spans.length &&
          t.spans[0][0] <= desc.to &&
          t.until >= desc.from
      );
      if (track) {
        prefixes.unshift(track.regime);
        for (const s of track.spans) if (s[0] >= desc.from && s[0] <= desc.to) push(s[3], s[4]);
      } else if (Array.isArray(desc.monarchPrefix)) {
        for (const s of HistoricalAtlasController.CHINESE_ERA_SPANS) {
          if (s[0] < desc.from || s[0] > desc.to) continue;
          if (desc.monarchPrefix.some((px) => String(s[3]).startsWith(px))) push(s[3], s[4]);
        }
      }
      // English era tracks repeat the regime on every ruler ("Emp. Jingzong of W. Xia"); show it once.
      if (en && names.length > 1) {
        const suffix = (names[0].match(/ of [^→]+$/) || [])[0];
        if (suffix && names.every((n) => n.endsWith(suffix))) {
          return names.map((n) => n.slice(0, -suffix.length)).join(' → ');
        }
      }
      return names.join(' → ');
    }

    // The era's own regime (唐 in 唐, 宋 in 北宋, 汉 in 东汉) is what the era overview already
    // describes; it is not a "rival regime" and must not get a fabricated fallback profile.
    _isEraMainPolity(title, dynasty) {
      if (!dynasty || !title) return false;
      const t = String(title).replace(/[（(].*$/, '').trim();
      const eraTitle = String(dynasty.title || '');
      return (
        !!t &&
        (t === eraTitle ||
          (t.length === 1 && eraTitle.length === 2 && eraTitle.endsWith(t)) ||
          (t.length >= 2 && eraTitle.startsWith(t)))
      );
    }

    openPolity(title, opts = {}) {
      this._scheduleUrlSync();
      const desc = this._resolvePolity(title, this.year);
      const cur = this.dynasties[this.dynastyIdx];
      const snap = this.snapshots[this._resolveSnapKey(cur, this.year)] || this.lastRenderedSnap;
      if (this.paneCollapsed) this.toggleChroniclePane(false);
      // The open event balloon would sit on top of the realm being focused.
      if (this.activeMilestone && this.milestoneBalloon) this.closeMilestoneBalloon();
      if (!desc.curated && this._isEraMainPolity(title, cur)) {
        // The era's own regime: its "profile" is the era overview, so focus the map instead.
        if (this.activePolity) this.closePolity();
        // On phones the bottom sheet would hide the very realm being focused.
        if (this._isMobileViewport() && this.mobileChronicleOpen) this.toggleMobileChronicle(false);
        this.eraFocus = { dynastyKey: cur.key };
        if (opts.zoom !== false) this._zoomToPolity(title, snap);
        this._pinChroniclePaneTop(() => !this.activePolity);
        this._setPolityFocus(null);
        this._lastLegendKey = null;
        if (this.lastRenderedSnap) this._renderLegendBox(this.lastRenderedSnap);
        if (!this._isLoreDetailLoaded()) {
          this._ensureLoreDetail().then(() => {
            if (this.eraFocus && cur && this.eraFocus.dynastyKey === cur.key && !this.activePolity) {
              this.openPolity(title, { ...opts, zoom: false });
            }
          });
        }
        return null;
      }
      this.eraFocus = null;
      // An embed has no chronicle pane, so never open the mobile bottom sheet over the map.
      if (!this.embed && this._isMobileViewport() && !this.mobileChronicleOpen) this.toggleMobileChronicle(true);
      const pol = this._polityPolsInSnap(desc, snap)[0];
      desc.tint = (pol && pol.tint) || '';
      this.activePolity = desc;
      if (this.embed) this._syncEmbedBadge();
      if (pol && opts.zoom !== false) this._zoomToPolity(pol.title, snap);
      if (cur) this._renderChroniclePane(cur);
      this._pinChroniclePaneTop(() => this.activePolity === desc);
      this._setPolityFocus(null);
      this._lastLegendKey = null;
      if (this.lastRenderedSnap) this._renderLegendBox(this.lastRenderedSnap);
      if (!this._fullSnapshotsLoaded) {
        this._ensureFullSnapshots().then(() => {
          const c = this.dynasties[this.dynastyIdx];
          if (this.activePolity === desc && c) this._renderChroniclePane(c);
        });
      }
      if (!this._isLoreDetailLoaded()) {
        this._ensureLoreDetail().then(() => {
          if (this.activePolity === desc) {
            this.openPolity(title, { ...opts, zoom: false });
          }
        });
      }
      return desc;
    }

    _pinChroniclePaneTop(stillValid) {
      const paneEl = this._id('chronicle-pane');
      if (this._chronicleScrollRaf && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this._chronicleScrollRaf);
        this._chronicleScrollRaf = null;
      }
      if (!paneEl) return;
      // An era-mode smooth scroll may still be in flight; only an explicit instant scroll cancels it.
      if (typeof paneEl.scrollTo !== 'function') {
        paneEl.scrollTop = 0;
        return;
      }
      paneEl.scrollTo({ top: 0, behavior: 'instant' });
      // Compositor-driven smooth scrolls can still land one frame later; re-pin for two frames.
      if (typeof requestAnimationFrame !== 'function') return;
      const repin = (left) =>
        requestAnimationFrame(() => {
          if (!stillValid()) return;
          if (paneEl.scrollTop > 0) paneEl.scrollTo({ top: 0, behavior: 'instant' });
          if (left > 1) repin(left - 1);
        });
      repin(2);
    }

    // Title of the era's own regime on the current map while it is focused, else null.
    _eraFocusTitle() {
      const cur = this.dynasties[this.dynastyIdx];
      if (!this.eraFocus || !cur || this.eraFocus.dynastyKey !== cur.key) return null;
      const snap = this.lastRenderedSnap;
      const pol = ((snap && snap.polities) || []).find(
        (p) => p.role !== 'neighbor' && this._isEraMainPolity(p.title, cur)
      );
      return pol ? pol.title : null;
    }

    clearEraFocus() {
      if (!this.eraFocus) return;
      this.eraFocus = null;
      this._setPolityFocus(null);
      this._lastLegendKey = null;
      if (this.lastRenderedSnap) this._renderLegendBox(this.lastRenderedSnap);
    }

    openPolityByKey(key) {
      const k = String(key || '').trim().toLowerCase();
      const prof = HistoricalAtlasController.POLITY_PROFILES.find(
        (p) => p.key === k || p.zh === key || String(p.en).toLowerCase() === k
      );
      if (!prof) {
        if (!this._isLoreDetailLoaded()) {
          return this._ensureLoreDetail().then(() => this.openPolityByKey(key));
        }
        return null;
      }
      const go = () => {
        const desc = { ...prof, curated: true };
        let y = this.year;
        const curSnap = this.snapshots[this._resolveSnapKey(this.dynasties[this.dynastyIdx], y)];
        if (!this._polityInRange(desc, y) || !this._polityPolsInSnap(desc, curSnap).length) {
          const stages = this._polityStages(desc);
          const st = stages.find((s) => s.to >= desc.from) || stages[0];
          y = st ? Math.max(st.from, Math.min(desc.from, st.to)) : desc.from;
          this.jumpToYear(y);
        }
        const snap = this.snapshots[this._resolveSnapKey(this.dynasties[this.dynastyIdx], this.year)];
        const pol = this._polityPolsInSnap(desc, snap)[0];
        return this.openPolity(pol ? pol.title : prof.titles[0]);
      };
      if (this._fullSnapshotsLoaded) return go();
      return this._ensureFullSnapshots().then(go);
    }

    closePolity() {
      if (!this.activePolity) return;
      this.activePolity = null;
      this._scheduleUrlSync();
      if (this.embed) this._syncEmbedBadge();
      this._resetPolityPaneChrome();
      const cur = this.dynasties[this.dynastyIdx];
      if (cur) this._renderChroniclePane(cur);
      this._setPolityFocus(null);
      this._lastLegendKey = null;
      if (this.lastRenderedSnap) this._renderLegendBox(this.lastRenderedSnap);
    }

    _resetPolityPaneChrome() {
      const pane = this._id('chronicle-pane');
      if (pane) {
        if (pane.classList) pane.classList.remove('is-polity-mode');
        if (pane.style && pane.style.removeProperty) pane.style.removeProperty('--dynasty-accent');
      }
      const back = this._id('polity-backbar');
      if (back && back.classList) back.classList.add('is-hidden');
      const extra = this._id('polity-extra');
      if (extra) {
        extra.innerHTML = '';
        if (extra.classList) extra.classList.add('is-hidden');
      }
      const heading = this._id('txt-milestones-heading');
      if (heading) heading.textContent = this.uiStr('events_h', '重大事件');
      const seatLabel = this._id('txt-seat-label');
      if (seatLabel) seatLabel.textContent = this.uiStr('capital_k', '都城');
      const titleEl = this._id('dynasty-title');
      if (titleEl && titleEl.classList) titleEl.classList.remove('is-long');
    }

    _renderPolityPane(dynasty) {
      const desc = this.activePolity;
      const en = this.locale === 'en';
      const setText = (id, text) => {
        const el = this._id(id);
        if (el) el.textContent = text;
      };
      const pane = this._id('chronicle-pane');
      if (pane) {
        if (pane.classList) pane.classList.add('is-polity-mode');
        if (pane.style && pane.style.setProperty && desc.tint) {
          pane.style.setProperty('--dynasty-accent', desc.tint);
        }
      }
      const name = en ? desc.en || this.trTerm(desc.zh) : this._zh(desc.zh);
      const eraName = this.dynastyName(dynasty);
      const span = `${this.formatYear(desc.from, true)} — ${this.formatYear(desc.to, true)}`;
      setText('dynasty-title', name);
      const titleEl = this._id('dynasty-title');
      if (titleEl && titleEl.classList) titleEl.classList.toggle('is-long', name.length > (en ? 18 : 4));
      setText('dynasty-span', desc.curated ? span : `${span}${en ? ' (on map)' : '（图中所见）'}`);
      // Uncurated regimes have no verified capital; label the row as the era instead.
      setText('txt-seat-label', desc.curated ? this.uiStr('capital_k', '都城') : en ? 'Era' : this._zh('时代'));
      setText(
        'dynasty-seat',
        desc.curated
          ? en
            ? desc.seatEn || desc.seatZh
            : this._zh(desc.seatZh)
          : en
            ? `Regime within ${eraName}`
            : this._zh(`${eraName} · 并立政权`)
      );
      setText(
        'dynasty-summary',
        desc.curated
          ? en
            ? desc.summaryEn
            : this._zh(desc.summaryZh)
          : en
            ? `${name} is one of the regimes drawn on the map during ${eraName} (${span}). Its territorial stages and related events are listed below.`
            : this._zh(`「${desc.zh}」为${eraName}时期并立的政权之一，地图上可见于 ${span}。下方列出其疆域变迁与相关史事。`)
      );
      setText(
        'txt-milestones-heading',
        en ? 'Related Events' : this._zh('相关大事')
      );

      const back = this._id('polity-backbar');
      if (back) {
        back.textContent = en ? `← ${eraName} overview` : this._zh(`← 返回${eraName}全景`);
        if (back.classList) back.classList.remove('is-hidden');
        if (!back._polityBound && back.addEventListener) {
          back._polityBound = true;
          back.addEventListener('click', () => this.closePolity());
        }
      }

      const stages = this._polityStages(desc);
      const rulers = this._polityRulers(desc);
      const extra = this._id('polity-extra');
      if (extra) {
        const esc = (s) =>
          String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
        let html = '';
        if (rulers) {
          html += `<div class="polity-row"><span class="seat-tag">${en ? 'Rulers' : this._zh('帝系')}</span><span class="polity-rulers">${esc(rulers)}</span></div>`;
        }
        if (stages.length) {
          const chips = stages
            .map(
              (s, i) =>
                `<button type="button" class="polity-stage-chip" data-idx="${i}" title="${esc(this.trTerm(s.caption))}">${esc(this.formatYear(s.from, true))}${s.to > s.from ? `–${esc(this.formatYear(s.to, true))}` : ''}</button>`
            )
            .join('');
          html += `<div class="polity-row polity-stages-row"><span class="seat-tag">${en ? 'Territory' : this._zh('疆域')}</span><span class="polity-stages">${chips}</span></div>`;
        }
        extra.innerHTML = html;
        if (extra.classList) extra.classList.toggle('is-hidden', !html);
        if (extra.querySelectorAll) {
          extra.querySelectorAll('.polity-stage-chip').forEach((btn) => {
            const st = stages[Number(btn.dataset.idx)];
            if (!st) return;
            btn.addEventListener('pointerenter', (e) => {
              if (e.pointerType !== 'touch') this._previewStageGhost(st.snapKey);
            });
            btn.addEventListener('pointerleave', (e) => {
              if (e.pointerType !== 'touch') this._clearPreviewGhost();
            });
            btn.addEventListener('click', () => {
              this.stopAutoplay();
              // Stages may begin before the formal founding (matchFrom); land on the founding year when possible.
              this.jumpToYear(desc.from <= st.to ? Math.max(st.from, desc.from) : st.from);
              const s = this.snapshots[st.snapKey];
              if (s) this._zoomToPolity(st.title, s);
            });
          });
        }
      }
      this._polityStagesCache = stages;

      const ul = this._id('milestone-list');
      if (ul) {
        ul.innerHTML = '';
        this._lastHighlightedMilestoneKey = null;
        const events = this._polityEvents(desc);
        this._polityEventsCache = events;
        for (const ev of events) {
          const li = document.createElement('li');
          const yrLabel = en ? this.formatYear(ev.year) : `${ev.year <= 0 ? '前' + -ev.year : ev.year} 年`;
          const text = ev.milestone
            ? this.milestoneHeadline(ev.dynasty, ev.milestone)
            : en
              ? ev.landmark.en || ev.landmark.zh
              : this._zh(ev.landmark.zh);
          li.innerHTML = `<span class="ev-yr">${yrLabel}</span><span>${text}</span>`;
          li.addEventListener('click', () => {
            this.stopAutoplay();
            if (window.innerWidth <= 900 && this.mobileChronicleOpen) this.toggleMobileChronicle(false);
            this.jumpToYear(ev.year);
            if (ev.milestone && ev.dynasty) this.openMilestoneBalloon(ev.dynasty, ev.milestone);
            if (ev.coord) this._panToward(ev.coord[0], ev.coord[1]);
          });
          ul.appendChild(li);
        }
        if (!events.length) {
          const li = document.createElement('li');
          li.className = 'polity-empty';
          li.innerHTML = `<span class="ev-yr">—</span><span>${
            en
              ? 'No dedicated chronicle entries yet; drag the timeline to watch its territory change.'
              : this._zh('暂无专属编年条目，可拖动时间轴查看其疆域演变。')
          }</span>`;
          ul.appendChild(li);
        }
      }
      this._highlightPolityEvent();
      if (this.locale === 'zh-tw' && pane) this._applyZhHantDom(pane);
    }

    _highlightPolityEvent() {
      const ul = this._id('milestone-list');
      const events = this._polityEventsCache || [];
      if (ul && ul.children) {
        let idx = -1;
        events.forEach((ev, i) => {
          if (ev.year <= this.year) idx = i;
        });
        Array.from(ul.children).forEach((el, i) => el.classList && el.classList.toggle('is-current', i === idx));
      }
      const extra = this._id('polity-extra');
      if (extra && extra.querySelectorAll) {
        const stages = this._polityStagesCache || [];
        extra.querySelectorAll('.polity-stage-chip').forEach((btn) => {
          const st = stages[Number(btn.dataset.idx)];
          btn.classList.toggle('is-current', Boolean(st && this.year >= st.from && this.year <= st.to));
        });
      }
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
      const curDyn = this.dynasties[this.dynastyIdx];
      let pIdx = -1;
      if (curDyn && Array.isArray(curDyn.phases) && curDyn.phases.length > 1) {
        pIdx = curDyn.phases.findIndex((ph) => this.year < ph.until);
        if (pIdx === -1) pIdx = curDyn.phases.length - 1;
      }
      const chkCorr = Boolean(this._id('chk-corridors') && this._id('chk-corridors').checked);
      const zhengHeWindow = this.year >= 1405 && this.year <= 1433 ? 1 : 0;
      const legendKey = `${this.dynastyIdx}:${pIdx}:${this._effectiveRenderedLocale()}:${
        chkCorr ? 1 : 0
      }:${this.activeCorridorMask || ''}:${zhengHeWindow}:${
        this.activePolity ? this.activePolity.key : ''
      }:${this._eraFocusTitle() || ''}`;
      if (
        this._lastLegendSnap === snap &&
        this._lastLegendKey === legendKey &&
        this.mapKey.firstChild
      ) {
        return;
      }
      this._lastLegendSnap = snap;
      this._lastLegendKey = legendKey;
      this.mapKey.innerHTML = '';
      this.mobileLegendOpen = Boolean(this.mobileLegendOpen);
      this.mapKey.classList.toggle('is-mobile-expanded', this.mobileLegendOpen);

      const bar = document.createElement('div');
      bar.className = 'key-phase-bar';

      if (curDyn && Array.isArray(curDyn.phases) && curDyn.phases.length > 1) {
        const phases = curDyn.phases;
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
      const eraFocusTitle = this.activePolity ? null : this._eraFocusTitle();
      const curDynForKey = this.dynasties[this.dynastyIdx];
      for (const p of core) {
        const entry = document.createElement('span');
        const isEraMain = this._isEraMainPolity(p.title, curDynForKey);
        const isEraFocused = eraFocusTitle === p.title;
        const isActive =
          isEraFocused || Boolean(this.activePolity && this.activePolity.titles.includes(p.title));
        entry.className = `key-entry is-interactive${isActive ? ' is-active' : ''}`;
        const en = this.locale === 'en';
        entry.title = isEraFocused
          ? en
            ? 'Click to clear the focus'
            : '点击取消聚焦'
          : isActive
            ? en
              ? 'Click to return to the era overview'
              : '点击返回时代全景'
            : isEraMain
              ? en
                ? 'Hover to highlight · Click to focus this era\'s realm'
                : '悬停高亮疆域 · 点击聚焦本朝疆域'
              : en
                ? 'Hover to highlight · Click for this regime\'s profile'
                : '悬停高亮疆域 · 点击查看该政权档案';
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
        entry.addEventListener('click', () => {
          if (isEraFocused) this.clearEraFocus();
          else if (isActive) this.closePolity();
          else this.openPolity(p.title);
        });
        entry.setAttribute('role', 'button');
        entry.setAttribute('tabindex', '0');
        entry.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        entry.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          entry.click();
        });
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
        ? 'Explore 2,400+ years of Chinese history from the Warring States (403 BCE) to the present across 18 eras, 185 multi-stage territory snapshots, 471 milestones, 571 city landmarks, 20 strategic passes, and 113+ person chronicles.'
        : '交互式中国历史地图时间轴（公元前403年战国三家分晋至现代）：浏览18个朝代、185幅多阶段历史疆域与州道政区快照、471条编年大事、571处城池地标、20座天下名关与百余位青史人物行迹。';
      let canonicalUrl = baseSiteUrl;

      if (this.activePerson) {
        const p = this.activePerson.profile;
        const pName = isEn ? p.en : p.zh;
        const isStory = Boolean(p && p.isStory);
        const paramKey = isStory ? 'event' : 'person';
        pageTitle = isEn
          ? `${pName} — ${isStory ? 'Event Storyline' : 'Historical Events'} Map · Jiangshan Atlas of China`
          : `${pName}${isStory ? '历史大事件全脉络' : '生平纪事地图'} · 江山时序中国历史地图`;
        pageDesc = isEn
          ? `Interactive spatio-temporal chronicle of ${pName} across ${this.activePerson.events.length} historical sites in the Jiangshan Atlas of China.`
          : `${pName}${isStory ? '' : '生平'} ${this.activePerson.events.length} 处历史事件时空落点、历代疆域与古今地名对照。`;
        canonicalUrl = `${baseSiteUrl}?${paramKey}=${encodeURIComponent(p.key)}${isEn ? '&lang=en' : ''}`;
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
      if (this.eraFocus && (!dynasty || this.eraFocus.dynastyKey !== dynasty.key)) this.eraFocus = null;
      if (this.activePolity) {
        if (this._polityInRange(this.activePolity, this.year)) {
          this._renderPolityPane(dynasty);
          return;
        }
        this.activePolity = null;
        this._resetPolityPaneChrome();
        this._lastLegendKey = null;
      }
      this._id('dynasty-title').textContent = this.dynastyName(dynasty);
      this._id('dynasty-span').textContent = this.formatSpan(dynasty);
      this._id('dynasty-seat').textContent = this.dynastySeat(dynasty);
      this._id('dynasty-summary').textContent = this.dynastySummary(dynasty);
      this._syncDocumentSeoMeta();

      const ul = this._id('milestone-list');
      ul.innerHTML = '';
      this._lastHighlightedMilestoneKey = null;
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
        const hydroShift = this._hydroCourseMask(targetY) !== this._hydroCourseMask(prevY);
        const isMapChange = Boolean(m.isMapChange) || snapShift || cityShift || corrShift || hydroShift;
        const yrLabel =
          this.locale === 'en'
            ? this.formatYear(m.year)
            : `${m.year <= 0 ? '前' + -m.year : m.year} 年`;
        const badge = isMapChange
          ? `<span class="ev-map-tag" title="${this.locale === 'en' ? 'Map territory, city, or river course changes at this year' : '此节点触发版图、城池或河道水系变化'}">${SVG_ICONS.mapChange}</span>`
          : '';
        const relicStopIdx = this._findRelicStopForMilestone(dynasty, m);
        const sealBadge =
          relicStopIdx !== null
            ? `<button type="button" class="ev-seal-tag" title="${this.locale === 'en' ? 'Heirloom Seal of the Realm — click to trace across dynasties' : '传国玉玺流转节点 · 点击查看历代流转轨迹'}">${this.locale === 'en' ? 'Seal' : '玺'}</button>`
            : '';
        const storyHit = this._findStoryForMilestone(dynasty, m);
        const storyBadge = storyHit
          ? `<button type="button" class="ev-seal-tag ev-story-tag" title="${this.locale === 'en' ? 'Event Storyline — click to trace the full multi-act campaign' : '大事件全脉络 · 点击展开安史之乱八年兴亡推演'}">${this.locale === 'en' ? 'Story' : '始末'}</button>`
          : '';
        li.innerHTML = `<span class="ev-yr">${yrLabel}</span><span>${this.milestoneHeadline(dynasty, m)}${badge}${sealBadge}${storyBadge}</span>`;
        const sealBtn = li.querySelector('.ev-seal-tag:not(.ev-story-tag)');
        if (sealBtn && relicStopIdx !== null) {
          sealBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 900 && this.mobileChronicleOpen) {
              this.toggleMobileChronicle(false);
            }
            this.openPersonChronicle('yuxi', relicStopIdx);
          });
        }
        const storyBtn = li.querySelector('.ev-story-tag');
        if (storyBtn && storyHit) {
          storyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 900 && this.mobileChronicleOpen) {
              this.toggleMobileChronicle(false);
            }
            this.openPersonChronicle(storyHit.key, storyHit.stopIdx);
          });
        }
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
          this._suppressChronicleAutoScroll = true;
          try {
            this.jumpToYear(targetY);
            this.openMilestoneBalloon(dynasty, m);
          } finally {
            this._suppressChronicleAutoScroll = false;
          }
          this._frameMilestoneAnchors(dynasty, m, {
            isMapChange: Boolean(snapShift || m.isMapChange),
          });
        });
        ul.appendChild(li);
      }
      this._updateMobileChronicleBtn(dynasty);
      this._highlightCurrentMilestone(dynasty);
      if (this.locale === 'zh-tw') this._applyZhHantDom(this._id('chronicle-pane'));
    }

    _highlightCurrentMilestone(dynasty) {
      if (this.activePolity) {
        if (this._polityInRange(this.activePolity, this.year)) this._highlightPolityEvent();
        else this.closePolity();
        return;
      }
      const listEl = this._id('milestone-list');
      if (!listEl) return;
      const items = listEl.children;
      if (!items.length) return;
      const activeIdx = this._activeMilestoneIndex(dynasty);
      const hlKey = `${dynasty ? dynasty.key : ''}:${activeIdx}`;
      if (this._lastHighlightedMilestoneKey === hlKey) return;
      this._lastHighlightedMilestoneKey = hlKey;
      Array.from(items).forEach((el, idx) =>
        el.classList.toggle('is-current', idx === activeIdx)
      );
      const pane = this._id('chronicle-pane');
      if (!pane || this.paneCollapsed) return;
      if (this._isMobileViewport() && !this.mobileChronicleOpen) {
        return;
      }
      const suppressCenterScroll = Boolean(this._suppressChronicleAutoScroll);
      if (this._chronicleScrollRaf) {
        cancelAnimationFrame(this._chronicleScrollRaf);
        this._chronicleScrollRaf = null;
      }
      if (typeof requestAnimationFrame === 'function') {
        this._chronicleScrollRaf = requestAnimationFrame(() => {
          this._chronicleScrollRaf = null;
          if (suppressCenterScroll) {
            if (items[activeIdx] && pane.scrollHeight > pane.clientHeight) {
              const el = items[activeIdx];
              const elTop = el.offsetTop - pane.offsetTop;
              const elBottom = elTop + el.offsetHeight;
              const viewTop = pane.scrollTop;
              const viewBottom = viewTop + pane.clientHeight;
              if (elTop < viewTop) {
                pane.scrollTo({ top: Math.max(0, elTop - 8), behavior: 'smooth' });
              } else if (elBottom > viewBottom) {
                pane.scrollTo({
                  top: Math.max(0, elBottom - pane.clientHeight + 8),
                  behavior: 'smooth',
                });
              }
            }
            return;
          }
          if (activeIdx <= 0) {
            if (pane.scrollTop > 0) {
              pane.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
          }
          if (items[activeIdx] && pane.scrollHeight > pane.clientHeight) {
            const el = items[activeIdx];
            const elTop = el.offsetTop - pane.offsetTop;
            const targetTop = Math.max(0, elTop - pane.clientHeight * 0.42);
            pane.scrollTo({ top: targetTop, behavior: 'smooth' });
          }
        });
      }
    }

    // Place Genealogy & Person Chronicles methods are attached by js/atlas_trace.js.

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
      // An embed restricted to [from, to] shows only that window, linearly, so a 50-year range is
      // as easy to scrub as the full 2,400 years; otherwise short dynasties get a minimum width.
      const clip = this._bandClip;
      this.bandWeights = this.dynasties.map((d) =>
        clip
          ? Math.max(0, Math.min(clip[1], d.toYear) - Math.max(clip[0], d.fromYear))
          : Math.max(d.toYear - d.fromYear, minSpan)
      );
      this.totalBandWeight = this.bandWeights.reduce((acc, w) => acc + w, 0) || 1;
      this.bandOffsets = [];
      this.bandWeights.reduce((acc, w, i) => {
        this.bandOffsets[i] = acc / this.totalBandWeight;
        return acc + w;
      }, 0);
    }

    // [lo, hi] years of a dynasty's band, clipped to the embed window when there is one.
    _bandYearSpan(d) {
      const clip = this._bandClip;
      return clip ? [Math.max(clip[0], d.fromYear), Math.min(clip[1], d.toYear)] : [d.fromYear, d.toYear];
    }

    _yearToProgress(y) {
      const idx = this._findDynastyIndex(y);
      const d = this.dynasties[idx];
      const [lo, hi] = this._bandYearSpan(d);
      const span = Math.max(1, hi - lo);
      const local = Math.max(0, Math.min(1, (y - lo) / span));
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
      const [lo, hi] = this._bandYearSpan(d);
      const weightFrac = this.bandWeights[idx] / this.totalBandWeight;
      if (!weightFrac) return lo;
      const local = (clamped - this.bandOffsets[idx]) / weightFrac;
      return Math.round(lo + local * (hi - lo));
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
        if (!this.isScrubbing) {
          this.isScrubbing = true;
          if (this.svg && this.svg.classList) this.svg.classList.add('is-scrubbing');
          if (this.grpGhostDiff) this.grpGhostDiff.innerHTML = '';
        }
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
        const wasDragging = Boolean(this.isScrubbing);
        cancelRaf();
        scrubbing = false;
        trackRect = null;
        if (x !== null) scrubAt(x);
        this.isScrubbing = false;
        if (this.svg && this.svg.classList) this.svg.classList.remove('is-scrubbing');
        this._revealScrubberYear();
        if (wasDragging && !this.activePerson && this.dynasties && this.dynasties[this.dynastyIdx]) {
          this._syncAutoMilestoneBalloon(this.dynasties[this.dynastyIdx]);
        }
      });
      track.addEventListener('pointercancel', () => {
        const wasDragging = Boolean(this.isScrubbing);
        cancelRaf();
        scrubbing = false;
        this.isScrubbing = false;
        if (this.svg && this.svg.classList) this.svg.classList.remove('is-scrubbing');
        trackRect = null;
        if (wasDragging && !this.activePerson && this.dynasties && this.dynasties[this.dynastyIdx]) {
          this._syncAutoMilestoneBalloon(this.dynasties[this.dynastyIdx]);
        }
      });
    }

    _bindScrubberNavigator() {
      if (this.embed) return;
      const railWrap = this._id('scrubber-rail-wrap');
      const viewport = this._id('scrubber-viewport');
      const content = this._id('scrubber-content');
      const startEl = this._id('timeline-start');
      const endEl = this._id('timeline-end');
      const maskLeft = this._id('timeline-crop-mask-left');
      const maskRight = this._id('timeline-crop-mask-right');
      if (!railWrap || !viewport || !content || !startEl || !endEl) return;
      const minSpan = 1 / 16;
      let drag = null;
      this._scrubberView = { start: 0, end: 1 };
      this._syncScrubberNavigator();

      const resetCropVisuals = () => {
        railWrap.classList.remove('is-cropping');
        startEl.classList.remove('is-active');
        endEl.classList.remove('is-active');
        startEl.style.transform = '';
        endEl.style.transform = '';
        if (maskLeft) maskLeft.style.width = '0px';
        if (maskRight) maskRight.style.width = '0px';
      };

      const startDrag = (part, handleEl, e) => {
        if ((e.button !== undefined && e.button !== 0) || this.challenge || drag) return;
        const rect = viewport.getBoundingClientRect();
        if (!rect.width) return;
        e.preventDefault();
        e.stopPropagation();
        this.stopAutoplay();
        handleEl.focus({ preventScroll: true });
        drag = {
          ...this._scrubberView,
          nextStart: this._scrubberView.start,
          nextEnd: this._scrubberView.end,
          part,
          handleEl,
          x: e.clientX,
          width: rect.width,
          pointerId: e.pointerId,
        };
        handleEl.setPointerCapture(e.pointerId);
        handleEl.classList.add('is-active');
        railWrap.classList.add('is-cropping');
      };

      const moveDrag = (e) => {
        if (!drag || e.pointerId !== drag.pointerId) return;
        const span = drag.end - drag.start;
        const fracDelta = (e.clientX - drag.x) / drag.width;
        const progressDelta = fracDelta * span;
        const bubbleText = this._id('bubble-text');
        const en = this.locale === 'en';
        if (drag.part === 'start') {
          if (fracDelta >= 0) {
            const nextStart = Math.max(drag.start, Math.min(drag.end - minSpan, drag.start + progressDelta));
            drag.nextStart = nextStart;
            drag.nextEnd = drag.end;
            const px = ((nextStart - drag.start) / span) * drag.width;
            startEl.style.transform = `translateX(${px.toFixed(1)}px)`;
            if (maskLeft) maskLeft.style.width = `${Math.max(0, px).toFixed(1)}px`;
          } else {
            // Pulling the left handle outward expands the visible window left in real time
            const nextStart = Math.max(0, drag.start + progressDelta);
            drag.nextStart = nextStart;
            drag.nextEnd = drag.end;
            startEl.style.transform = '';
            if (maskLeft) maskLeft.style.width = '0px';
            this._setScrubberView(nextStart, drag.end);
          }
          const y = this._progressToYear(drag.nextStart);
          if (bubbleText) {
            bubbleText.textContent = en
              ? `Trim start: ${this.formatYear(y)} (release to zoom)`
              : `${this._zh('裁切起点：')}${this.formatYear(y)}${this._zh('（松手自动放大）')}`;
          }
          this._positionScrubberBubble(drag.nextStart);
        } else {
          if (fracDelta <= 0) {
            const nextEnd = Math.max(drag.start + minSpan, Math.min(drag.end, drag.end + progressDelta));
            drag.nextStart = drag.start;
            drag.nextEnd = nextEnd;
            const px = ((drag.end - nextEnd) / span) * drag.width;
            endEl.style.transform = `translateX(${-px.toFixed(1)}px)`;
            if (maskRight) maskRight.style.width = `${Math.max(0, px).toFixed(1)}px`;
          } else {
            // Pulling the right handle outward expands the visible window right in real time
            const nextEnd = Math.min(1, drag.end + progressDelta);
            drag.nextStart = drag.start;
            drag.nextEnd = nextEnd;
            endEl.style.transform = '';
            if (maskRight) maskRight.style.width = '0px';
            this._setScrubberView(drag.start, nextEnd);
          }
          const y = drag.nextEnd >= 1 ? this.maxYear : this._progressToYear(drag.nextEnd);
          if (bubbleText) {
            bubbleText.textContent = en
              ? `Trim end: ${this.formatYear(y)} (release to zoom)`
              : `${this._zh('裁切终点：')}${this.formatYear(y)}${this._zh('（松手自动放大）')}`;
          }
          this._positionScrubberBubble(drag.nextEnd);
        }
      };

      const finishDrag = (e, commit = false) => {
        if (e && drag && e.pointerId !== drag.pointerId) return;
        const activeDrag = drag;
        drag = null;
        resetCropVisuals();
        if (commit && activeDrag) {
          const curProg = this._yearToProgress(this.year);
          if (curProg < activeDrag.nextStart) {
            const minY = this._progressToYear(activeDrag.nextStart);
            this._suppressScrubberReveal = true;
            this.jumpToYear(minY);
            this._suppressScrubberReveal = false;
          } else if (curProg > activeDrag.nextEnd) {
            const maxY = activeDrag.nextEnd >= 1 ? this.maxYear : this._progressToYear(activeDrag.nextEnd);
            this._suppressScrubberReveal = true;
            this.jumpToYear(maxY);
            this._suppressScrubberReveal = false;
          }
          const clampedProg = this._yearToProgress(this.year);
          const finalStart = Math.min(activeDrag.nextStart, clampedProg);
          const finalEnd = Math.max(activeDrag.nextEnd, clampedProg);
          this._setScrubberView(finalStart, finalEnd);
        }
        this._syncScrubberUi();
      };

      let lastTapTime = 0;
      let lastTapX = 0;
      const checkDoubleTapReset = (e) => {
        if (this.challenge) return false;
        const now = Date.now();
        const isDbl = now - lastTapTime < 300 && Math.abs(e.clientX - lastTapX) < 14;
        lastTapTime = now;
        lastTapX = e.clientX;
        if (isDbl && this._scrubberView && this._scrubberView.end - this._scrubberView.start < 0.999) {
          this._setScrubberView(0, 1);
          return true;
        }
        return false;
      };

      for (const [part, el] of [
        ['start', startEl],
        ['end', endEl],
      ]) {
        el.addEventListener('pointerdown', (e) => {
          if (checkDoubleTapReset(e)) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          startDrag(part, el, e);
        });
        el.addEventListener('pointermove', moveDrag);
        el.addEventListener('pointerup', (e) => {
          moveDrag(e);
          finishDrag(e, true);
        });
        el.addEventListener('pointercancel', (e) => finishDrag(e, false));
        el.addEventListener('lostpointercapture', (e) => finishDrag(e, false));
        el.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          if (!this.challenge) this._setScrubberView(0, 1);
        });
        el.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.isComposing || this.challenge) return;
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(e.key)) return;
          e.preventDefault();
          this.stopAutoplay();
          const { start, end } = this._scrubberView;
          const span = end - start;
          const delta = span * (e.shiftKey ? 0.2 : 0.04) * (e.key === 'ArrowLeft' ? -1 : 1);
          if (e.key === 'Enter') {
            this._setScrubberView(0, 1);
          } else if (part === 'start') {
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? end - minSpan : start + delta;
            this._setScrubberView(Math.max(0, Math.min(end - minSpan, next)), end);
          } else {
            const next = e.key === 'Home' ? start + minSpan : e.key === 'End' ? 1 : end + delta;
            this._setScrubberView(start, Math.max(start + minSpan, Math.min(1, next)));
          }
        });
      }

      railWrap.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.timeline-edge')) return;
        checkDoubleTapReset(e);
      }, true);
      railWrap.addEventListener('dblclick', () => {
        if (!this.challenge) this._setScrubberView(0, 1);
      });

      viewport.addEventListener('scroll', () => {
        const span = this._scrubberView.end - this._scrubberView.start;
        const start = Math.max(0, Math.min(1 - span, viewport.scrollLeft / content.clientWidth));
        this._scrubberView = { start, end: start + span };
        this._syncScrubberNavigator();
        this._positionScrubberBubble(this._yearToProgress(this.year));
      });
      viewport.addEventListener('wheel', (e) => {
        if (!viewport.classList.contains('is-zoomed') || !e.shiftKey || !e.deltaY || e.deltaX) return;
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewport.clientWidth : 1;
        viewport.scrollLeft += e.deltaY * unit;
      }, { passive: false });
    }

    _setScrubberView(start, end) {
      // Use the existing dynasty-weighted progress scale for both the rail and edge handles.
      const span = Math.max(1 / 16, Math.min(1, end - start));
      start = Math.max(0, Math.min(1 - span, start));
      const oldSpan = this._scrubberView ? this._scrubberView.end - this._scrubberView.start : 1;
      this._scrubberView = { start, end: start + span };
      const viewport = this._id('scrubber-viewport');
      const content = this._id('scrubber-content');
      if (!viewport || !content) return;
      viewport.classList.toggle('is-zoomed', span < 1);
      content.style.width = span < 1 ? `${100 / span}%` : '';
      viewport.scrollLeft = start * content.clientWidth;
      if (Math.abs(span - oldSpan) > 0.000001) this._fitBandLabels();
      this._syncScrubberNavigator();
      this._positionScrubberBubble(this._yearToProgress(this.year));
    }

    _syncScrubberNavigator() {
      if (!this._scrubberView) return;
      const { start, end } = this._scrubberView;
      const span = end - start;
      const en = this.locale === 'en';
      const from = this.formatYear(this._progressToYear(start));
      const to = this.formatYear(end >= 1 ? this.maxYear : this._progressToYear(end));
      const zoomFactor = `${Math.round(10 / span) / 10}×`;
      for (const [part, min, max, value, label, valueText] of [
        [
          'start',
          0,
          end - 1 / 16,
          start,
          en ? 'Drag left edge inward to trim & zoom timeline (double-click to reset)' : this._zh('向内拖动左缘裁切放大时间轴；双击恢复全览'),
          `${from} (${zoomFactor})`,
        ],
        [
          'end',
          start + 1 / 16,
          1,
          end,
          en ? 'Drag right edge inward to trim & zoom timeline (double-click to reset)' : this._zh('向内拖动右缘裁切放大时间轴；双击恢复全览'),
          `${to} (${zoomFactor})`,
        ],
      ]) {
        const el = this._id(`timeline-${part}`);
        if (!el) continue;
        el.setAttribute('aria-label', label);
        el.title = `${label} · ${from} — ${to}`;
        el.setAttribute('aria-valuemin', String(Math.round(min * 1000)));
        el.setAttribute('aria-valuemax', String(Math.round(max * 1000)));
        el.setAttribute('aria-valuenow', String(Math.round(value * 1000)));
        el.setAttribute('aria-valuetext', valueText);
      }
    }

    _revealScrubberYear() {
      if (!this._scrubberView || this.isScrubbing || this._suppressScrubberReveal) return;
      const { start, end } = this._scrubberView;
      const progress = this._yearToProgress(this.year);
      if (progress < start || progress > end) {
        const span = end - start;
        this._setScrubberView(progress - span / 2, progress + span / 2);
      }
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
        // Dynasties outside an embed's [from, to] window take no room on its timeline.
        if (!this.bandWeights[idx]) cell.style.display = 'none';
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

        const [bandLo, bandHi] = this._bandYearSpan(d);
        const span = Math.max(1, bandHi - bandLo);
        if (Array.isArray(d.phases) && d.phases.length > 1) {
          for (let i = 0; i < d.phases.length - 1; i++) {
            const u = d.phases[i].until;
            if (u > bandLo && u < bandHi) {
              const pt = document.createElement('i');
              pt.className = 'band-phase-tick';
              pt.style.left = `${(((u - bandLo) / span) * 100).toFixed(2)}%`;
              cell.appendChild(pt);
            }
          }
        }
        const seenEvPct = new Set();
        for (const m of d.milestones || []) {
          const my = this._clampYearToDynasty(d, m.year);
          if (my < bandLo || my > bandHi) continue;
          const pct = Math.max(3, Math.min(97, Math.round(((my - bandLo) / span) * 100)));
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
        if (!this.bandWeights[idx]) tick.style.display = 'none';
        ticks.appendChild(tick);
      });
      const endTick = document.createElement('span');
      endTick.id = 'tick-present';
      endTick.style.left = '100%';
      endTick.textContent = this.uiStr('tick_now', '今');
      ticks.appendChild(endTick);
      this._lastActiveBandIdx = -1;
      this._scrubberRailWidth = 0;
      this._refreshBandLabels();
      window.addEventListener('resize', () => {
        this._scrubberRailWidth = 0;
        if (this._scrubberView) this._setScrubberView(this._scrubberView.start, this._scrubberView.end);
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
          const fullLabel =
            this.locale === 'en'
              ? `${this.dynastyName(d)} (${this.formatSpan(d)})`
              : `${this.dynastyName(d)}（${this.formatSpan(d)}）`;
          cell.title = fullLabel;
          cell.setAttribute('aria-label', fullLabel);
        }
        const tk = tickNodes[idx];
        if (tk) {
          const y = this._bandYearSpan(d)[0];
          tk.textContent = y <= 0 ? (this.locale === 'en' ? `${-y} BCE` : `前${-y}`) : `${y}`;
        }
      });
      const endTick = this._id('tick-present');
      if (endTick) {
        // A clipped embed timeline ends at its `to` year, not at the present day.
        const end = this._bandClip ? this._bandClip[1] : null;
        endTick.textContent =
          end === null
            ? this.uiStr('tick_now', '今')
            : end <= 0
              ? this.locale === 'en'
                ? `${-end} BCE`
                : `前${-end}`
              : `${end}`;
      }
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
        cell.classList.remove('is-narrow', 'is-compact');
        const lbl = cell.querySelector('.band-label');
        if (lbl) {
          if (lbl.scrollWidth > cell.clientWidth - 2) {
            cell.classList.add('is-compact');
            if (lbl.scrollWidth > cell.clientWidth - 2) {
              cell.classList.remove('is-compact');
              cell.classList.add('is-narrow');
            }
          }
        } else if (cell.scrollWidth > cell.clientWidth + 1) {
          cell.classList.add('is-narrow');
        }
        const tk = tickNodes[i];
        if (tk) {
          const rect = tk.getBoundingClientRect();
          const hide = rect.left < lastRight + 6 || rect.right > maxRight;
          tk.classList.toggle('is-hidden-tick', hide);
          if (!hide) lastRight = rect.right;
        }
      }
    }

    _positionScrubberBubble(progress) {
      const viewport = this._id('scrubber-viewport');
      const bubble = this._id('scrubber-Bubble');
      const bubbleText = this._id('bubble-text');
      if (!viewport || !bubble || !bubbleText) return;
      const railW = viewport.clientWidth || this._scrubberRailWidth || 300;
      this._scrubberRailWidth = railW;
      const view = this._scrubberView || { start: 0, end: 1 };
      const span = Math.max(1e-6, view.end - view.start);
      const handleX = ((progress - view.start) / span) * railW;
      bubble.style.visibility = '';
      const bW = bubble.offsetWidth || Math.max(84, Math.round(this._estimateLocalTextWidth(bubbleText.textContent, 12, 0) + 20));
      const maxLeft = Math.max(0, railW - bW);
      const leftPx = Math.max(0, Math.min(maxLeft, handleX - bW * 0.5));
      bubble.style.left = '0px';
      bubble.style.transform = `translateX(${leftPx.toFixed(1)}px)`;
      const arrowX = Math.max(8, Math.min(bW - 8, handleX - leftPx));
      bubble.style.setProperty('--arrow-left', `${arrowX.toFixed(1)}px`);
    }

    _syncScrubberUi() {
      const pct = this._yearToProgress(this.year) * 100;
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
        this._positionScrubberBubble(pct / 100);
      }

      const motion = this._id('scrubber-motion');
      if (motion) {
        // The wrapper spans the rail, so percentage transforms use the same
        // reference width as the previous absolute-positioned thumb.
        motion.style.transform = `translateX(${pct}%)`;
      } else {
        const handle = this._id('scrubber-handle');
        if (handle) handle.style.left = `${pct}%`;
      }

      const track = this._id('scrubber-track');
      if (track) track.setAttribute('aria-valuenow', String(this.year));
      const inpYear = this._id('inp-year');
      if (inpYear) inpYear.value = this.year === 0 ? 1 : this.year;
      this._syncScrubberNavigator();
      if (this.embed) this._syncEmbedBadge();
      if (this._lastActiveBandIdx !== this.dynastyIdx) {
        const bandsEl = this._id('dynasty-bands');
        if (bandsEl) {
          Array.from(bandsEl.children).forEach((el, idx) =>
            el.classList.toggle('is-active', idx === this.dynastyIdx)
          );
          this._lastActiveBandIdx = this.dynastyIdx;
        }
      }
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
      this._scheduleUrlSync();
      this.dynastyIdx = this._findDynastyIndex(y);
      const cur = this.dynasties[this.dynastyIdx];
      const nextSnapKey = this._resolveSnapKey(cur, y);

      this._runWithDeferredTypography(() => {
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
            this._withSnapshot(nextSnapKey, (snap) => {
              if (
                this.dynasties[this.dynastyIdx] !== cur ||
                this._resolveSnapKey(cur, this.year) !== nextSnapKey
              ) {
                return;
              }
              this._renderPolitiesAndPrefectures(cur, snap);
              if (!this.playing && !this.isScrubbing && !this.activePerson && prevSnap) {
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
        }
        this._renderCorridors();
        if (this.activePerson && !this._inPersonSync && prevIdx !== this.dynastyIdx) {
          this._renderPersonPinsOverlay();
        }
      });

      // Auto callouts are kept or replaced by _syncAutoMilestoneBalloon below.
      const am = this.activeMilestone;
      if (am && (am.isAuto ? (this.activePerson || this.isScrubbing) : am.year !== y)) {
        this.closeMilestoneBalloon();
      }
      if (!this.activePerson && !this.isScrubbing) {
        this._syncAutoMilestoneBalloon(cur);
      }
      this._revealScrubberYear();
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

    _ensureCoordInView(coord) {
      if (!coord || !this.projector || typeof this._animateCameraTo !== 'function') return false;
      const cam = this._cameraTarget || this.camera;
      const [sx, sy] = this.projector.toScreen(coord[0], coord[1]);
      const outX = sx < cam.x + cam.w * 0.14 || sx > cam.x + cam.w * 0.86;
      const outY = sy < cam.y + cam.h * 0.16 || sy > cam.y + cam.h * 0.84;
      if (outX || outY) {
        this._animateCameraTo({
          x: Math.max(-180, Math.min(1000 - cam.w + 140, sx - cam.w * 0.5)),
          y: Math.max(-150, Math.min(700 - cam.h + 120, sy - cam.h * 0.45)),
          w: cam.w,
          h: cam.h,
        });
        return true;
      }
      return false;
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
            this._ensureMilestoneInView(curDyn, targetM);
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
          this._ensureMilestoneInView(nextDyn, activeM);
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
        ? `Playback speed ${labelText} (click to cycle 0.5× / 1× / 2× / 4×)`
        : `播放倍速 ${labelText}（点击切换 0.5× / 1× / 2× / 4×）`;
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
      const dock = this._id('scrubber-dock');
      if (dock && dock.classList) dock.classList.toggle('is-autoplaying', Boolean(this.playing));
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
      // Leave the starting frame on screen for one event beat before the first jump.
      this.playHoldTicks = AUTOPLAY_EVENT_TICKS;
      this._syncAutoMilestoneBalloon(this.dynasties[this.dynastyIdx]);
      this.playInterval = setInterval(() => this._autoplayTick(), this._autoplayIntervalMs());
    }

    // Sorted years the autoplay lands on: every milestone year plus every territory-snapshot
    // boundary. `hold` marks the nodes that redraw the map (border change, dynasty opening,
    // snapshot switch) so the border diff gets the longer dwell.
    _autoplayStops() {
      if (!this._autoplayStopList) {
        const holdByYear = new Map();
        const mark = (year, hold) => holdByYear.set(year, Boolean(holdByYear.get(year) || hold));
        for (const d of this.dynasties) {
          mark(d.fromYear, true);
          if (Array.isArray(d.phases)) {
            for (const ph of d.phases) {
              if (ph.until > d.fromYear && ph.until < d.toYear) mark(ph.until, true);
            }
          }
          for (const m of d.milestones || []) {
            mark(this._clampYearToDynasty(d, m.year), m.isMapChange);
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
      const stop = this._autoplayStops().find((s) => s.year > this.year);
      const next = stop ? Math.min(stop.year, this.maxYear) : this.maxYear;
      // This tick already counts as the first beat on the new node; a camera pan inside
      // jumpToYear may raise playHoldTicks further (see _syncAutoMilestoneBalloon).
      this.playHoldTicks = (stop && stop.hold ? AUTOPLAY_MAP_CHANGE_TICKS : AUTOPLAY_EVENT_TICKS) - 1;
      this.jumpToYear(next === 0 ? 1 : next);
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
      this._scheduleUrlSync();
    }

    // ---------------- Classical Guqin Music Player ----------------
    static get GUQIN_TRACKS() {
      return (window.ATLAS_LORE_DATA && window.ATLAS_LORE_DATA.GUQIN_TRACKS) || [];
    }

    _ensureMusicAudio() {
      if (this.musicAudio) return this.musicAudio;
      const audio = new Audio();
      audio.preload = 'auto';
      audio.playsInline = true;
      audio.volume = 0.48;
      audio.addEventListener('ended', () => {
        if (this.musicPlaying) this.nextMusicTrack();
      });
      audio.addEventListener('error', () => {
        this._handleMusicLoadError(this._musicPlaySeq);
      });
      this.musicAudio = audio;
      return audio;
    }

    _handleMusicLoadError(seq) {
      if (!this.musicPlaying || seq !== this._musicPlaySeq) return;
      const tracks = HistoricalAtlasController.GUQIN_TRACKS;
      const t = tracks[this.musicTrackIdx % tracks.length];
      const audio = this.musicAudio;
      if (audio && t && t.ogg && !audio._triedFallback) {
        audio._triedFallback = true;
        audio.src = t.ogg;
        audio.play().catch((err) => {
          if (err && err.name === 'AbortError') return;
          if (seq !== this._musicPlaySeq) return;
          this.musicPlaying = false;
          this._updateMusicUi();
        });
      } else {
        this.musicPlaying = false;
        this._updateMusicUi();
      }
    }

    _playCurrentMusicTrack() {
      const tracks = HistoricalAtlasController.GUQIN_TRACKS;
      const t = tracks[this.musicTrackIdx % tracks.length];
      if (!t) return;
      const seq = (this._musicPlaySeq = (this._musicPlaySeq || 0) + 1);
      const audio = this._ensureMusicAudio();
      audio._triedFallback = false;
      audio.src = t.mp3;
      this.musicPlaying = true;
      this._updateMusicUi();
      audio.play().catch((err) => {
        if (err && err.name === 'AbortError') return;
        this._handleMusicLoadError(seq);
      });
    }

    toggleMusic() {
      if (this.musicPlaying) {
        this._musicPlaySeq = (this._musicPlaySeq || 0) + 1;
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

    _runWithDeferredTypography(fn) {
      this._deferTypographyDepth = (this._deferTypographyDepth || 0) + 1;
      try {
        fn();
      } finally {
        this._deferTypographyDepth--;
        if (this._deferTypographyDepth === 0 && this._typoDirty) {
          this._rescaleSvgTypography();
        }
      }
    }

    _scheduleCameraUpdate() {
      if (this._camRaf !== null) return;
      this._camRaf = requestAnimationFrame(() => {
        this._camRaf = null;
        this._applyCamera();
      });
    }

    _cancelPendingHover() {
      if (this._hoverRaf != null) {
        cancelAnimationFrame(this._hoverRaf);
        this._hoverRaf = null;
      }
      this._pendingHoverEvent = null;
    }

    _commitStageTransform() {
      if (this._stageWrap && this._stageWrap.style && this._stageWrap.style.transform) {
        this._stageWrap.style.transform = '';
      }
      if (this.svg && typeof this.svg.setAttribute === 'function') {
        const vb = `${this.camera.x.toFixed(1)} ${this.camera.y.toFixed(1)} ${this.camera.w.toFixed(1)} ${this.camera.h.toFixed(1)}`;
        if (vb !== this._lastCameraViewBox) {
          this.svg.setAttribute('viewBox', vb);
          this._lastCameraViewBox = vb;
        }
      }
      this._baseViewBoxCam = {
        x: this.camera.x,
        y: this.camera.y,
        w: this.camera.w,
        h: this.camera.h,
      };
    }

    _getUnscaledSvgRect() {
      if (this._stageWrap && this._stageWrap.style && this._stageWrap.style.transform) {
        this._commitStageTransform();
      }
      return this.svg.getBoundingClientRect();
    }

    _finishCameraMotion() {
      if (this._camRaf !== null) return;
      clearTimeout(this._cameraSettleTimer);
      this._cameraSettleTimer = null;
      this._commitStageTransform();
      this._cameraViewportRect = null;
      const rect = this.svg.getBoundingClientRect();
      this._cameraViewportRect = rect;
      this.svg.classList.remove('is-camera-moving');
      if (this.viewportFrame && this.viewportFrame.classList) {
        this.viewportFrame.classList.remove('is-camera-moving');
      }
      if (
        this._typoDirty ||
        this._lastTypographyWidth === undefined ||
        Math.abs(this.camera.w - this._lastTypographyWidth) > 0.05
      ) {
        const zoomOnly = !this._typoDirty && this._lastTypographyWidth !== undefined;
        this._rescaleSvgTypography({ zoomOnly });
      }
      this._updateScaleBar(rect);
      if (this.activeMilestone) this._positionMilestoneBalloon(rect);
      this._scheduleTerrainTiles();
    }

    _applyCamera(forceTypography = false) {
      // Direct camera changes (reset, deep links, pointerup) supersede a queued
      // input frame. Read the viewport before invalidating SVG layout.
      if (this._camRaf !== null) {
        cancelAnimationFrame(this._camRaf);
        this._camRaf = null;
      }
      this._cancelPendingHover();
      if (forceTypography) this._cameraViewportRect = null;
      const cachedRect =
        (this.dragState && this.dragState.rect) ||
        (this.pinchState && this.pinchState.rect) ||
        this._cameraViewportRect;
      const rect = cachedRect || this._getUnscaledSvgRect();
      const viewBox = `${this.camera.x.toFixed(1)} ${this.camera.y.toFixed(1)} ${this.camera.w.toFixed(1)} ${this.camera.h.toFixed(1)}`;
      const zoomChanged =
        this._lastTypographyWidth !== undefined &&
        Math.abs(this.camera.w - this._lastTypographyWidth) > 0.05;
      if (forceTypography) {
        clearTimeout(this._cameraSettleTimer);
        this._cameraSettleTimer = null;
        this.svg.classList.remove('is-camera-moving');
        if (this.viewportFrame && this.viewportFrame.classList) {
          this.viewportFrame.classList.remove('is-camera-moving');
        }
      } else if (this._lastCameraViewBox !== null && viewBox !== this._lastCameraViewBox) {
        this._cameraViewportRect = rect;
        this.hoverTip.classList.add('is-hidden');
        this._clearHoveredPrefecture();
        this.svg.classList.add('is-camera-moving');
        if (this.viewportFrame && this.viewportFrame.classList) {
          this.viewportFrame.classList.add('is-camera-moving');
        }
        if (!this.flyRaf) {
          clearTimeout(this._cameraSettleTimer);
          this._cameraSettleTimer = setTimeout(() => this._finishCameraMotion(), 120);
        }
      }
      this._commitStageTransform();
      // Keep typography scale(invScale) synchronized on every zoom frame via the
      // _zoomScaleNodes fast-path so font sizes scale smoothly without stepping.
      const needsTypography =
        forceTypography ||
        this._typoDirty ||
        this._lastTypographyWidth === undefined ||
        zoomChanged;
      if (needsTypography) {
        const zoomOnly = !this._typoDirty && this._lastTypographyWidth !== undefined;
        this._rescaleSvgTypography({ zoomOnly });
      }
      this._updateScaleBar(rect);
      if (this.activeMilestone) this._positionMilestoneBalloon(rect);
      if (forceTypography) this._scheduleTerrainTiles();
    }

    // ---------------- High-Resolution Terrain Tiles ----------------
    // The base relief (assets/terrain_relief.webp, 2 px per SVG unit) covers the
    // default view. Once the camera magnifies it past ~1 CSS px per image px,
    // Web Mercator hillshade tiles from assets/terrain/ fade in on top; the
    // base stays underneath so a slow tile never leaves a hole.
    _scheduleTerrainTiles() {
      if (!this.terrainTileLayer) return;
      clearTimeout(this._terrainTileTimer);
      this._terrainTileTimer = setTimeout(() => this._updateTerrainTiles(), 40);
    }

    _terrainReady() {
      return Boolean(
        this.terrainTileLayer &&
          this.svg &&
          typeof document !== 'undefined' &&
          typeof document.createElementNS === 'function' &&
          typeof fetch === 'function'
      );
    }

    _loadTerrainIndex() {
      if (!this._terrainIndexPromise) {
        this._terrainIndexPromise = fetch('assets/terrain/index.json')
          .then((r) => (r.ok ? r.json() : null))
          .then((idx) => {
            if (!idx || !idx.levels) return null;
            const levels = new Map();
            for (const [z, list] of Object.entries(idx.levels)) levels.set(Number(z), new Set(list));
            this._terrainTileSize = idx.tileSize || 256;
            this._terrainIndex = levels.size ? levels : null;
            return this._terrainIndex;
          })
          .catch(() => null);
      }
      return this._terrainIndexPromise;
    }

    // mode: 'commit' applies and stores level hysteresis (the rendered view), 'peek' applies it
    // without storing (predicting a flight's destination), 'free' ignores it (idle prefetch).
    _terrainTileLevel(cam, pxPerUnit, mode) {
      // Keep the default (reset) view on the base image; detail starts once the user zooms in.
      if (cam.w > this._getDefaultCamera().w * 0.8) return null;
      // Data Saver or a 2G/slow-3G link: the base relief is enough.
      const conn = typeof navigator !== 'undefined' ? navigator.connection : null;
      if (conn && (conn.saveData || /(^|-)2g$|^3g$/.test(conn.effectiveType || ''))) return null;
      // Sized for CSS pixels, not device pixels: the relief is a 48%-opacity backdrop, and
      // matching retina density would quadruple the tiles per screen.
      const need = pxPerUnit * this.projector.scale;
      // Base image: 2 px per SVG unit; no gain while it is not being upscaled.
      if (need <= 2 * this.projector.scale * 0.85) return null;
      const ppd = (lz) => (this._terrainTileSize * 2 ** lz) / 360;
      const levels = [...this._terrainIndex.keys()].sort((a, b) => a - b);
      const maxPpd = this._isMobileViewport() ? 190 : Infinity;
      let z = levels[0];
      for (const lz of levels) {
        if (ppd(lz) > maxPpd) break;
        z = lz;
        if (ppd(lz) >= need * 0.8) break;
      }
      if (mode !== 'free') {
        // Hysteresis: small zoom steps keep the current level instead of refetching a screenful.
        const cur = this._terrainTileZ;
        if (cur !== undefined && levels.includes(cur) && ppd(cur) <= maxPpd) {
          if (ppd(cur) >= need * 0.65 && ppd(cur) <= need * 2.4) z = cur;
        }
        if (mode === 'commit') this._terrainTileZ = z;
      }
      return z;
    }

    // Tiles covering what `cam` shows, nearest to the viewport centre first.
    _terrainTilesFor(cam, mode) {
      const rect = this._cameraViewportRect || this.svg.getBoundingClientRect();
      // The SVG letterboxes the camera box (xMidYMid meet), so the visible area can exceed it.
      const pxPerUnit = rect.width && rect.height ? Math.min(rect.width / cam.w, rect.height / cam.h) : 0;
      const z = this.terrainMode && pxPerUnit ? this._terrainTileLevel(cam, pxPerUnit, mode) : null;
      if (z === null) return [];
      const visW = rect.width / pxPerUnit;
      const visH = rect.height / pxPerUnit;
      const cx = cam.x + cam.w / 2;
      const cy = cam.y + cam.h / 2;
      const [west, north] = this.projector.toGeo(cx - visW / 2, cy - visH / 2);
      const [east, south] = this.projector.toGeo(cx + visW / 2, cy + visH / 2);
      const [lonC, latC] = this.projector.toGeo(cx, cy);
      const n = 2 ** z;
      const tileX = (lon) => ((lon + 180) / 360) * n;
      const tileY = (lat) => {
        const r = Math.max(-85, Math.min(85, lat)) * DEG_TO_RAD;
        return ((1 - Math.log(Math.tan(Math.PI / 4 + r / 2)) / Math.PI) / 2) * n;
      };
      const x0 = Math.max(0, Math.floor(tileX(west)));
      const x1 = Math.min(n - 1, Math.floor(tileX(east)));
      const y0 = Math.max(0, Math.floor(tileY(north)));
      const y1 = Math.min(n - 1, Math.floor(tileY(south)));
      const fx = tileX(lonC);
      const fy = tileY(latC);
      const minZ = Math.min(...this._terrainIndex.keys());
      const out = new Map();
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          const dist = Math.hypot(x + 0.5 - fx, y + 0.5 - fy);
          // Fall back to the nearest coarser level where the finest one was not built.
          for (let lz = z; lz >= minZ; lz--) {
            const d = z - lz;
            const t = { z: lz, x: x >> d, y: y >> d, dist, top: lz === z };
            if (this._terrainIndex.get(lz).has(`${t.x}_${t.y}`)) {
              const key = `${t.z}/${t.x}/${t.y}`;
              const prev = out.get(key);
              if (!prev || prev.dist > dist) out.set(key, t);
              break;
            }
          }
        }
      }
      return [...out].sort((a, b) => a[1].dist - b[1].dist);
    }

    // Warm the HTTP cache without touching the DOM.
    _prefetchTerrainTiles(tiles, limit) {
      if (typeof Image !== 'function') return;
      if (!this._terrainPrefetched) this._terrainPrefetched = new Set();
      let sent = 0;
      for (const [key, t] of tiles) {
        if (sent >= limit) break;
        if (this._terrainPrefetched.has(key) || (this._terrainTiles && this._terrainTiles.has(key))) continue;
        this._terrainPrefetched.add(key);
        const img = new Image();
        img.decoding = 'async';
        if ('fetchPriority' in img) img.fetchPriority = 'low';
        img.src = `assets/terrain/${t.z}/${t.x}/${t.y}.webp`;
        sent++;
      }
    }

    // A camera flight is starting: fetch the destination's tiles while it is in the air.
    _prefetchTerrainForTarget(targetCam, zoomInput) {
      if (!this._terrainReady() || !this._terrainIndex) return;
      clearTimeout(this._terrainTargetTimer);
      const run = () => this._prefetchTerrainTiles(this._terrainTilesFor(targetCam, 'peek'), 48);
      // Wheel ticks retarget every few ms; wait for the target to stop moving.
      if (zoomInput) this._terrainTargetTimer = setTimeout(run, 60);
      else run();
    }

    // The screen is complete: quietly fetch the centre of the next zoom-in and zoom-out views.
    _prefetchTerrainNeighbours() {
      const cam = this.camera;
      const cx = cam.x + cam.w / 2;
      const cy = cam.y + cam.h / 2;
      const zin = { x: cx - cam.w / 4, y: cy - cam.h / 4, w: cam.w / 2, h: cam.h / 2 };
      const zout = { x: cx - cam.w, y: cy - cam.h, w: cam.w * 2, h: cam.h * 2 };
      this._prefetchTerrainTiles(
        [...this._terrainTilesFor(zin, 'free').slice(0, 6), ...this._terrainTilesFor(zout, 'free').slice(0, 9)],
        15
      );
    }

    _updateTerrainTiles() {
      const layer = this.terrainTileLayer;
      if (!this._terrainReady()) return;
      if (!this._terrainIndex) {
        this._loadTerrainIndex().then((idx) => {
          if (idx) this._updateTerrainTiles();
        });
        return;
      }
      if (!this._terrainTiles) this._terrainTiles = new Map();
      const want = new Map(this._terrainTilesFor(this.camera, 'commit'));

      const stale = [...this._terrainTiles.keys()].filter((k) => !want.has(k));
      const dropStale = () => {
        for (const k of stale) {
          if (want.has(k)) continue;
          const el = this._terrainTiles.get(k);
          if (el && el.parentNode) el.parentNode.removeChild(el);
          this._terrainTiles.delete(k);
        }
      };
      const fresh = [...want].filter(([k]) => !this._terrainTiles.has(k));
      if (!fresh.length) {
        dropStale();
        return;
      }
      let pending = fresh.length;
      const gen = (this._terrainTileGen = (this._terrainTileGen || 0) + 1);
      const settle = () => {
        if (--pending > 0 || gen !== this._terrainTileGen) return;
        dropStale();
        const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback : (fn) => setTimeout(fn, 200);
        idle(() => {
          if (gen === this._terrainTileGen) this._prefetchTerrainNeighbours();
        });
      };
      clearTimeout(this._terrainStaleTimer);
      this._terrainStaleTimer = setTimeout(() => {
        if (gen === this._terrainTileGen) dropStale();
      }, 2500);
      const NS = 'http://www.w3.org/2000/svg';
      // `fresh` is centre-out, so the tiles the user is looking at are requested first.
      for (const [key, t] of fresh) {
        const n = 2 ** t.z;
        const lonW = (t.x / n) * 360 - 180;
        const lonE = ((t.x + 1) / n) * 360 - 180;
        const latN = Math.atan(Math.sinh(Math.PI * (1 - (2 * t.y) / n))) * RAD_TO_DEG;
        const latS = Math.atan(Math.sinh(Math.PI * (1 - (2 * (t.y + 1)) / n))) * RAD_TO_DEG;
        const [px0, py0] = this.projector.toScreen(lonW, latN);
        const [px1, py1] = this.projector.toScreen(lonE, latS);
        const img = document.createElementNS(NS, 'image');
        img.setAttribute('class', 'terrain-tile');
        // A hair of overlap hides anti-aliased seams between neighbours.
        img.setAttribute('x', (px0 - 0.02).toFixed(3));
        img.setAttribute('y', (py0 - 0.02).toFixed(3));
        img.setAttribute('width', (px1 - px0 + 0.04).toFixed(3));
        img.setAttribute('height', (py1 - py0 + 0.04).toFixed(3));
        img.setAttribute('preserveAspectRatio', 'none');
        img.addEventListener('load', () => {
          img.classList.add('is-loaded');
          settle();
        });
        img.addEventListener('error', settle);
        img.setAttribute('href', `assets/terrain/${t.z}/${t.x}/${t.y}.webp`);
        // Coarser fallback tiles sit beneath finer neighbours they overlap.
        if (t.top) layer.appendChild(img);
        else layer.insertBefore(img, layer.firstChild);
        this._terrainTiles.set(key, img);
      }
    }

    _updateScaleBar(viewportRect = null) {
      const lblEl = this._id('scale-label-text');
      const barEl = this._id('scale-ruler-bar');
      if (!lblEl || !barEl || !this.svg) return;
      const rect = viewportRect || (this.dragState && this.dragState.rect) || this.svg.getBoundingClientRect();
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
      const width = `${barPx}px`;
      const label = `${bestKm} km`;
      if (barEl.style.width !== width) barEl.style.width = width;
      if (lblEl.textContent !== label) lblEl.textContent = label;
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
      if (typeof btn.setAttribute === 'function') {
        btn.setAttribute('aria-label', btn.title);
      }
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
      const wasOpen = Boolean(this.mobileChronicleOpen);
      this.mobileChronicleOpen =
        force !== undefined ? force : !this.mobileChronicleOpen;
      // The sheet is a grid row, so toggling it resizes the map over a 0.22s transition.
      if (wasOpen !== this.mobileChronicleOpen) this._mobileSheetToggledAt = Date.now();
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

    _rescaleSvgTypography(opts = null) {
      if (this._deferTypographyDepth > 0) {
        this._typoDirty = true;
        return;
      }
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const zoomOnly = Boolean(
        opts &&
          typeof opts === 'object' &&
          opts.zoomOnly &&
          !this._typoDirty &&
          this._lastTypographyWidth !== undefined &&
          this._lastViewportWidth === vw
      );
      if (!zoomOnly && this._stageWrap && this._stageWrap.style && this._stageWrap.style.transform) {
        this._commitStageTransform();
      }
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
      const showPolities = !this.grpPolities.classList.contains('is-hidden');
      const showMilestones = !this.grpMilestones.classList.contains('is-hidden');
      const showRivers = Boolean(
        this.grpRivers && (!this.grpRivers.classList || !this.grpRivers.classList.contains('is-hidden'))
      );
      const showProvNames = Boolean(
        this.grpProvNames &&
          (!this.grpProvNames.classList || !this.grpProvNames.classList.contains('is-hidden'))
      );
      const narrowMobileCull = isNarrowMobile && z < 3.4;
      const zoomStateKey = `${showTier2 ? 1 : 0}|${showPasses ? 1 : 0}|${showMobilePrefDetail ? 1 : 0}|${narrowMobileCull ? 1 : 0}|${showCorridors ? 1 : 0}|${showSettlements ? 1 : 0}|${showPrefectures ? 1 : 0}|${showPolities ? 1 : 0}|${showMilestones ? 1 : 0}|${showRivers ? 1 : 0}|${showProvNames ? 1 : 0}`;

      // Fast path for pure zoom frames when no visibility tier threshold crossed:
      // only update scale(invScale) on visible nodes without re-querying DOM or flipping labels.
      if (
        zoomOnly &&
        this._zoomScaleNodes &&
        this._lastZoomStateKey === zoomStateKey
      ) {
        if (this._lastInvScale !== invScale) {
          this._lastInvScale = invScale;
          const items = this._zoomScaleNodes;
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            item.node.setAttribute('transform', item.prefix + invScale + item.suffix);
          }
          if (showProvNames) {
            const fontSize = (9.5 * s).toFixed(1);
            this.grpProvNames.querySelectorAll('.province-caption').forEach((node) => {
              setSvgAttribute(node, 'font-size', fontSize);
            });
          }
          if (this.activePerson && this.grpJourney) {
            this._rescaleActivePersonPins(vw, s, true);
          }
          if (this.challenge && this.grpChallenge) {
            this._rescaleQuizChip(vw, s);
          }
        }
        return;
      }

      const scaleNodes = [];
      const applyNodeScale = (node, xStr, yStr, rotStr = null) => {
        const prefix = `translate(${xStr},${yStr}) scale(`;
        const suffix = rotStr !== null ? `) rotate(${rotStr})` : ')';
        setSvgAttribute(node, 'transform', prefix + invScale + suffix);
        scaleNodes.push({ node, prefix, suffix });
      };

      // Scale static markers (milestones, journey waypoints, directional chevrons, challenge pins, genealogy overlays)
      this.svg
        .querySelectorAll(
          '.milestone-pin, #grp-journey g[data-x], #grp-challenge g[data-x], #grp-genealogy g[data-x]'
        )
        .forEach((node) => {
          if (this.activePerson && node.classList && node.classList.contains('journey-node')) {
            return;
          }
          const x = node.getAttribute('data-x');
          const y = node.getAttribute('data-y');
          const rot = node.getAttribute('data-rot');
          if (x !== null) {
            applyNodeScale(node, x, y, rot);
          }
        });

      // Keep active person numbered pins crisp & non-overlapping in real screen pixels at every zoom level
      if (this.activePerson && this.grpJourney) {
        this._rescaleActivePersonPins(vw, s, zoomOnly);
      }
      if (this.challenge && this.grpChallenge) {
        this._rescaleQuizChip(vw, s);
      }
      if (this.grpRivers) {
        this.grpRivers.querySelectorAll('.hydro-label').forEach((node) => {
          if (node.classList.contains('is-range') || node.classList.contains('is-detail-hydro')) {
            return;
          }
          const x = node.getAttribute('data-x');
          const y = node.getAttribute('data-y');
          const rot = node.getAttribute('data-rot') || '0';
          if (x !== null) {
            applyNodeScale(node, x, y, rot);
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
        if (!zoomOnly && node.classList.contains('is-tier2')) {
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
        const isT2 = node.classList.contains('is-tier2');
        if (isT2) continue;
        if (isPass) {
          if (!showCorridors || (!showPasses && !node.classList.contains('is-pass-trace'))) continue;
        } else if (!showSettlements) {
          continue;
        }
        const cx = parseFloat(node.getAttribute('data-x'));
        const cy = parseFloat(node.getAttribute('data-y'));
        const r = (node.classList.contains('is-capital') ? 5.2 : 3.8) * s;
        occupied.push({ x1: cx - r, y1: cy - r, x2: cx + r, y2: cy + r });
      }
      if (showMilestones) {
        this.svg.querySelectorAll('.milestone-pin').forEach((pin) => {
          if (
            pin.classList.contains('is-future') ||
            (pin.classList.contains('is-past-occluded') && !pin.classList.contains('is-active')) ||
            (pin.classList.contains('is-secondary-pin') &&
              !pin.classList.contains('is-current') &&
              !pin.classList.contains('is-active'))
          ) {
            return;
          }
          const mx = parseFloat(pin.getAttribute('data-x'));
          const my = parseFloat(pin.getAttribute('data-y'));
          if (!isNaN(mx)) {
            const pr =
              (pin.classList.contains('is-current') || pin.classList.contains('is-active')
                ? 3.9
                : 3.0) * s;
            occupied.push({
              x1: mx - pr,
              y1: my - pr,
              x2: mx + pr,
              y2: my + pr,
            });
          }
        });
      }
      const rotatedHydroBoxes = (cx, cy, hw, hh, ux, uy) => {
        if (Math.abs(uy) <= 0.25) {
          const ex = Math.abs(ux) * hw + Math.abs(uy) * hh;
          const ey = Math.abs(uy) * hw + Math.abs(ux) * hh;
          return [{ x1: cx - ex, y1: cy - ey, x2: cx + ex, y2: cy + ey }];
        }
        const segHw = hw * 0.36;
        const ex = Math.abs(ux) * segHw + Math.abs(uy) * hh;
        const ey = Math.abs(uy) * segHw + Math.abs(ux) * hh;
        const step = hw * 0.62;
        return [-step, 0, step].map((t) => {
          const sx = cx + t * ux;
          const sy = cy + t * uy;
          return { x1: sx - ex, y1: sy - ey, x2: sx + ex, y2: sy + ey };
        });
      };
      if (showRivers) {
        this.grpRivers.querySelectorAll('.hydro-label').forEach((hl) => {
          // Mountain-range and zoom-gated boundary-river names are background context:
          // city, polity, pass, and region labels must never yield to them.
          if (hl.classList.contains('is-range') || hl.classList.contains('is-detail-hydro')) return;
          const hx = parseFloat(hl.getAttribute('data-x'));
          const hy = parseFloat(hl.getAttribute('data-y'));
          if (!isNaN(hx) && !isNaN(hy)) {
            const isLake = hl.classList.contains('is-lake');
            const fPx = isLake ? 8.2 : hl.classList.contains('is-trunk') ? 8.6 : 7.4;
            const hw = (this._estimateLocalTextWidth(hl.textContent, fPx, 1.5) * 0.5 + (isLake ? 8 : 4)) * s;
            const hh = (isLake ? 8.5 : 5.5) * s;
            const rad = (parseFloat(hl.getAttribute('data-rot') || '0') || 0) * (Math.PI / 180);
            const boxes = rotatedHydroBoxes(hx, hy, hw, hh, Math.cos(rad), Math.sin(rad));
            for (let k = 0; k < boxes.length; k++) occupied.push(boxes[k]);
          }
        });
      }
      const regionCaptionNodes = Array.from(this.svg.querySelectorAll('.region-caption'));
      if (zoomOnly && showPrefectures) {
        for (const node of regionCaptionNodes) {
          if (node.dataset.placed === '1' && !node.classList.contains('is-crowded-hidden')) {
            const cx = parseFloat(node.getAttribute('data-x'));
            const cy = parseFloat(node.getAttribute('data-y'));
            if (!isNaN(cx) && !isNaN(cy)) {
              const hw = (this._estimateLocalTextWidth(node.textContent, 8.8, 1.8) * 0.5 + 3) * s;
              const hh = 6.2 * s;
              occupied.push({ x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh });
            }
          }
        }
      }

      const pinnedCoords = [];
      if (this.grpJourney && this.grpJourney.firstChild) {
        const pScale = this._lastPersonPinScale || s;
        this.grpJourney.querySelectorAll('.journey-node').forEach((jn) => {
          const jx = parseFloat(jn.getAttribute('data-x'));
          const jy = parseFloat(jn.getAttribute('data-y'));
          const ox = parseFloat(jn.getAttribute('data-ox') || '0');
          const oy = parseFloat(jn.getAttribute('data-oy') || '0');
          if (!isNaN(jx) && !isNaN(jy)) {
            const isBead = jn.classList.contains('is-multi-bead');
            const px = jx + ox * pScale;
            const py = jy + oy * pScale;
            pinnedCoords.push([jx, jy]);
            const padR = (isBead ? 4.2 : 10.5) * pScale;
            occupied.push({ x1: px - padR, y1: py - padR, x2: px + padR, y2: py + padR });
            const lbl = jn.querySelector('.jn-label');
            if (
              lbl &&
              lbl.textContent &&
              !lbl.classList.contains('is-hover-only-label') &&
              lbl.style.display !== 'none'
            ) {
              const lx = parseFloat(lbl.getAttribute('x') || '0');
              const ly = parseFloat(lbl.getAttribute('y') || '-11.5');
              const anchor = lbl.getAttribute('text-anchor') || 'middle';
              const w = (this._estimateLocalTextWidth(lbl.textContent, 11.5, 0.5) + 14) * pScale;
              const bx = px + lx * pScale;
              const x1 = anchor === 'start' ? bx : anchor === 'end' ? bx - w : bx - w * 0.5;
              occupied.push({
                x1,
                y1: py + (ly - 10) * pScale,
                x2: x1 + w,
                y2: py + (ly + 5) * pScale,
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
        applyNodeScale(node, cx.toFixed(1), cy.toFixed(1));
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
            x1: cx - 40 * s,
            y1: cy + 6 * s,
            x2: cx + 40 * s,
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

        if (zoomOnly && node.dataset.chosenDir) {
          const bestDir = node.dataset.chosenDir;
          const best = dirSpec(bestDir);
          if (allowCull && node.classList.contains('is-label-crowded')) {
            return;
          }
          if (overlapArea(best.box) <= 4.0 * s * s) {
            node.classList.remove('is-label-crowded');
            if (node.dataset.appliedDir !== bestDir) {
              node.dataset.appliedDir = bestDir;
              setSvgAttribute(nameEl, 'x', String(best.dx));
              setSvgAttribute(nameEl, 'y', String(best.dy1));
              setSvgAttribute(nameEl, 'text-anchor', best.anchor);
            }
            occupied.push(best.box);
            return;
          }
        }

        let best = null;
        let bestDir = null;
        let bestScore = Infinity;
        let bestOverlap = Infinity;
        for (let i = 0; i < dirs.length; i++) {
          const spec = dirSpec(dirs[i]);
          const rawOv = overlapArea(spec.box);
          const score = rawOv + (node.dataset.explicitAlign === '1' ? 24.0 : 0.01) * i * s * s;
          if (score < bestScore) {
            bestScore = score;
            bestOverlap = rawOv;
            best = spec;
            bestDir = dirs[i];
            if (score < 0.05 * s * s) break;
          }
        }
        if (bestDir) node.dataset.chosenDir = bestDir;

        const boxArea = Math.max(1e-4, (best.box.x2 - best.box.x1) * (best.box.y2 - best.box.y1));
        if (allowCull && bestOverlap > boxArea * maxOverlapRatio) {
          node.classList.add('is-label-crowded');
          return;
        }
        node.classList.remove('is-label-crowded');
        if (node.dataset.appliedDir !== bestDir) {
          node.dataset.appliedDir = bestDir;
          setSvgAttribute(nameEl, 'x', String(best.dx));
          setSvgAttribute(nameEl, 'y', String(best.dy1));
          setSvgAttribute(nameEl, 'text-anchor', best.anchor);
        }
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
          layoutSettlementLabel(node, narrowMobileCull, 0.26);
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

        if (zoomOnly && node.dataset.placed === '1' && this._lastPolityTier2State === showTier2) {
          const lockedX = parseFloat(node.getAttribute('data-x'));
          const lockedY = parseFloat(node.getAttribute('data-y'));
          applyNodeScale(node, lockedX.toFixed(1), lockedY.toFixed(1));
          occupied.push({
            x1: lockedX - hw,
            y1: lockedY - hh,
            x2: lockedX + hw,
            y2: lockedY + hh,
          });
          continue;
        }

        let bestX = baseX;
        let bestY = baseY;
        let bestBox = { x1: baseX - hw, y1: baseY - hh, x2: baseX + hw, y2: baseY + hh };
        let bestScore = Infinity;

        for (let i = 0; i < polOffsets.length; i++) {
          const [ox, oy] = polOffsets[i];
          const cx = baseX + ox * s;
          const cy = baseY + oy * s;
          const candBox = { x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh };
          const ov = overlapArea(candBox) + (ox * ox + oy * oy) * 0.0005 * s * s;
          if (ov >= bestScore) continue;
          if ((ox !== 0 || oy !== 0) && node._polShape) {
            const [lngC, latC] = this.projector.toGeo(cx, cy);
            if (!MercatorProjector.pointInShape(lngC, latC, node._polShape)) continue;
            const [lngL, latL] = this.projector.toGeo(cx - hw * 0.42, cy);
            const [lngR, latR] = this.projector.toGeo(cx + hw * 0.42, cy);
            const [lngT, latT] = this.projector.toGeo(cx, cy - hh * 0.42);
            const [lngB, latB] = this.projector.toGeo(cx, cy + hh * 0.42);
            if (
              !MercatorProjector.pointInShape(lngL, latL, node._polShape) ||
              !MercatorProjector.pointInShape(lngR, latR, node._polShape) ||
              !MercatorProjector.pointInShape(lngT, latT, node._polShape) ||
              !MercatorProjector.pointInShape(lngB, latB, node._polShape)
            ) {
              continue;
            }
          }
          bestScore = ov;
          bestX = cx;
          bestY = cy;
          bestBox = candBox;
          if (ov < 0.05 * s * s) break;
        }

        // Fallback for very small or narrow polities (e.g., 周, 韩, 中山) where 4-edge padding
        // was too tight: relax to center-point containment, but NEVER allow jumping outside _polShape.
        if (bestScore > 1.0 * s * s) {
          const fineFallbackOffsets = [
            [0, 0],
            [0, -4],
            [0, 4],
            [-5, 0],
            [5, 0],
            [-5, -4],
            [5, -4],
            [-5, 4],
            [5, 4],
            [0, -8],
            [0, 8],
            [-8, 0],
            [8, 0],
            [-7, -6],
            [7, -6],
            [-7, 6],
            [7, 6],
            ...polOffsets.slice(1, 28),
          ];
          for (let i = 0; i < fineFallbackOffsets.length; i++) {
            const [ox, oy] = fineFallbackOffsets[i];
            const cx = baseX + ox * s;
            const cy = baseY + oy * s;
            const candBox = { x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh };
            const ov = overlapArea(candBox) + (ox * ox + oy * oy) * 0.002 * s * s;
            if (ov >= bestScore) continue;
            if (node._polShape) {
              const [lngC, latC] = this.projector.toGeo(cx, cy);
              if (!MercatorProjector.pointInShape(lngC, latC, node._polShape)) continue;
            }
            bestScore = ov;
            bestX = cx;
            bestY = cy;
            bestBox = candBox;
            if (ov < 0.1 * s * s) break;
          }
        }

        node.dataset.placed = '1';
        const bestXStr = bestX.toFixed(1);
        const bestYStr = bestY.toFixed(1);
        setSvgAttribute(node, 'data-x', bestXStr);
        setSvgAttribute(node, 'data-y', bestYStr);
        applyNodeScale(node, bestXStr, bestYStr);
        occupied.push(bestBox);
      }
      this._lastPolityTier2State = showTier2;

      // Reserve Tier-2 city dots now so pass/Tier-2 labels avoid them while primary cities and polities are not displaced by minor dots
      for (const node of settlementNodes) {
        if (!node.classList.contains('is-tier2')) continue;
        if (!showSettlements || (!showTier2 && !node.classList.contains('is-trace-city'))) {
          continue;
        }
        const cx = parseFloat(node.getAttribute('data-x'));
        const cy = parseFloat(node.getAttribute('data-y'));
        const r = 3.0 * s;
        occupied.push({ x1: cx - r, y1: cy - r, x2: cx + r, y2: cy + r });
      }

      // Tier 2b: Modern neighboring country watermarks (dodge ancient polities/cities or hide when same-named historical polity is active)
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
          if (zoomOnly && node.dataset.placed === '1') {
            const lockedX = parseFloat(node.getAttribute('data-x'));
            const lockedY = parseFloat(node.getAttribute('data-y'));
            node.classList.remove('is-crowded-hidden');
            applyNodeScale(node, lockedX.toFixed(1), lockedY.toFixed(1));
            occupied.push({
              x1: lockedX - hw,
              y1: lockedY - hh,
              x2: lockedX + hw,
              y2: lockedY + hh,
            });
            return;
          }
          let bestX = baseX;
          let bestY = baseY;
          let bestBox = { x1: baseX - hw, y1: baseY - hh, x2: baseX + hw, y2: baseY + hh };
          let bestOv = Infinity;
          for (let i = 0; i < neighOffsets.length; i++) {
            const [ox, oy] = neighOffsets[i];
            const cx = baseX + ox * s;
            const cy = baseY + oy * s;
            const candBox = { x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh };
            const ov = overlapArea(candBox) + (ox * ox + oy * oy) * 0.0004 * s * s;
            if (ov < bestOv) {
              bestOv = ov;
              bestX = cx;
              bestY = cy;
              bestBox = candBox;
              if (ov < 0.05 * s * s) break;
            }
          }
          node.dataset.placed = '1';
          node.classList.remove('is-crowded-hidden');
          const bestXStr = bestX.toFixed(1);
          const bestYStr = bestY.toFixed(1);
          setSvgAttribute(node, 'data-x', bestXStr);
          setSvgAttribute(node, 'data-y', bestYStr);
          applyNodeScale(node, bestXStr, bestYStr);
          occupied.push(bestBox);
        });
      }

      // Tier 2c: Strategic mountain/river passes (controlled by 关河丝路 layer; only visible when zoomed >= passMinZoom or traced)
      for (const node of settlementNodes) {
        if (node.classList.contains('is-pass')) {
          if (showCorridors && (showPasses || node.classList.contains('is-pass-trace'))) {
            layoutSettlementLabel(node, !node.classList.contains('is-pass-trace'), 0.14);
          } else if (!zoomOnly) {
            delete node.dataset.chosenDir;
          }
        }
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
        if (!showCorridors) return;
        const hw = (this._estimateLocalTextWidth(node.textContent, 8.2, 1.4) * 0.5 + 3) * s;
        const hh = 5.2 * s;
        if (zoomOnly && node.dataset.placed === '1') {
          const cx = parseFloat(node.getAttribute('data-x'));
          const cy = parseFloat(node.getAttribute('data-y'));
          if (!node.classList.contains('is-crowded-hidden')) {
            applyNodeScale(node, cx.toFixed(1), cy.toFixed(1));
            occupied.push({ x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh });
          }
          return;
        }
        let placed = false;
        for (let i = 0; i < corrOffsets.length; i++) {
          const [ox, oy] = corrOffsets[i];
          const cx = baseX + ox * s;
          const cy = baseY + oy * s;
          const candBox = { x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh };
          if (overlapArea(candBox) <= (candBox.x2 - candBox.x1) * (candBox.y2 - candBox.y1) * 0.08) {
            node.dataset.placed = '1';
            const cxStr = cx.toFixed(1);
            const cyStr = cy.toFixed(1);
            setSvgAttribute(node, 'data-x', cxStr);
            setSvgAttribute(node, 'data-y', cyStr);
            applyNodeScale(node, cxStr, cyStr);
            node.classList.remove('is-crowded-hidden');
            occupied.push(candBox);
            placed = true;
            break;
          }
        }
        if (!placed) {
          node.dataset.placed = '1';
          const bxStr = baseX.toFixed(1);
          const byStr = baseY.toFixed(1);
          setSvgAttribute(node, 'data-x', bxStr);
          setSvgAttribute(node, 'data-y', byStr);
          node.classList.add('is-crowded-hidden');
        }
      });

      // Tier 4: Tier-2 secondary cities (visible when z >= tier2MinZoom or traced; auto-flip or cull text if crowded)
      for (const node of settlementNodes) {
        if (node.classList.contains('is-tier2')) {
          if (showTier2 || node.classList.contains('is-trace-city')) {
            layoutSettlementLabel(node, !node.classList.contains('is-trace-city'));
          } else if (!zoomOnly) {
            delete node.dataset.chosenDir;
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
      for (const node of regionCaptionNodes) {
        const baseX = parseFloat(node.getAttribute('data-base-x') || node.getAttribute('data-x'));
        const baseY = parseFloat(node.getAttribute('data-base-y') || node.getAttribute('data-y'));
        if (!showPrefectures) continue;
        const hw = (this._estimateLocalTextWidth(node.textContent, 8.8, 1.8) * 0.5 + 3) * s;
        const hh = 6.2 * s;
        if (zoomOnly && node.dataset.placed === '1') {
          if (!node.classList.contains('is-crowded-hidden')) {
            const cx = parseFloat(node.getAttribute('data-x'));
            const cy = parseFloat(node.getAttribute('data-y'));
            applyNodeScale(node, cx.toFixed(1), cy.toFixed(1));
          }
          continue;
        }
        let placed = false;
        for (let i = 0; i < regOffsets.length; i++) {
          const [ox, oy] = regOffsets[i];
          const cx = baseX + ox;
          const cy = baseY + oy;
          const candBox = { x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh };
          if (overlapArea(candBox) > (candBox.x2 - candBox.x1) * (candBox.y2 - candBox.y1) * 0.05) {
            continue;
          }
          if ((ox !== 0 || oy !== 0) && node._regShape) {
            const [lng, lat] = this.projector.toGeo(cx, cy);
            if (!MercatorProjector.pointInShape(lng, lat, node._regShape)) continue;
          }
          node.dataset.placed = '1';
          const cxStr = cx.toFixed(1);
          const cyStr = cy.toFixed(1);
          setSvgAttribute(node, 'data-x', cxStr);
          setSvgAttribute(node, 'data-y', cyStr);
          applyNodeScale(node, cxStr, cyStr);
          node.classList.remove('is-crowded-hidden');
          occupied.push(candBox);
          placed = true;
          break;
        }
        if (!placed) {
          node.dataset.placed = '1';
          const bxStr = baseX.toFixed(1);
          const byStr = baseY.toFixed(1);
          setSvgAttribute(node, 'data-x', bxStr);
          setSvgAttribute(node, 'data-y', byStr);
          node.classList.add('is-crowded-hidden');
        }
      }

      // Tier 6: Mountain-range and boundary-river names share the pass/tier-2 zoom gate and
      // are lowest priority: slide along the ridge/channel tangent to dodge other labels, else hide.
      if (showRivers) {
        const hydroOffsets = [
          [0, 0],
          [14, 0],
          [-14, 0],
          [26, 0],
          [-26, 0],
          [0, -7],
          [0, 7],
          [16, -6],
          [-16, 6],
          [38, 0],
          [-38, 0],
        ];
        const detailHydroNodes = this.grpRivers.querySelectorAll(
          '.hydro-label.is-range, .hydro-label.is-detail-hydro'
        );

        for (const node of detailHydroNodes) {
          if (!showPasses) {
            // Below the gate nothing is "placed": dropping the lock lets the label re-seat
            // itself the moment the user zooms back in, instead of staying hidden.
            node.classList.add('is-crowded-hidden');
            delete node.dataset.placed;
            continue;
          }
          const baseX = parseFloat(node.getAttribute('data-base-x') || node.getAttribute('data-x'));
          const baseY = parseFloat(node.getAttribute('data-base-y') || node.getAttribute('data-y'));
          if (isNaN(baseX) || isNaN(baseY)) continue;
          const rotStr = node.getAttribute('data-rot') || '0';
          const rad = (parseFloat(rotStr) || 0) * (Math.PI / 180);
          const isRange = node.classList.contains('is-range');
          const isDesert = node.classList.contains('is-desert');
          const hw =
            (this._estimateLocalTextWidth(
              node.textContent,
              isDesert ? 9.0 : isRange ? 7.4 : 6.6,
              isDesert ? 5.5 : isRange ? 2.6 : 1.1
            ) *
              0.5 +
              2.2) *
            s;
          const hh = (isDesert ? 5.6 : isRange ? 4.6 : 4.3) * s;
          const ux = Math.cos(rad);
          const uy = Math.sin(rad);
          const nx = -uy;
          const ny = ux;
          const maxOvArea = 4 * hw * hh * 0.045;

          // Only a visible placement is worth locking across zoom frames; a label that was
          // crowded out keeps retrying, since shrinking text frees room as the user zooms in.
          if (zoomOnly && node.dataset.placed === '1' && !node.classList.contains('is-crowded-hidden')) {
            const cx = parseFloat(node.getAttribute('data-x'));
            const cy = parseFloat(node.getAttribute('data-y'));
            applyNodeScale(node, cx.toFixed(1), cy.toFixed(1), rotStr);
            const boxes = rotatedHydroBoxes(cx, cy, hw, hh, ux, uy);
            for (let k = 0; k < boxes.length; k++) occupied.push(boxes[k]);
            continue;
          }

          let placed = false;
          for (let i = 0; i < hydroOffsets.length; i++) {
            const [along, perp] = hydroOffsets[i];
            const cx = baseX + (along * ux + perp * nx) * s;
            const cy = baseY + (along * uy + perp * ny) * s;
            const boxes = rotatedHydroBoxes(cx, cy, hw, hh, ux, uy);
            let totalOv = 0;
            for (let k = 0; k < boxes.length; k++) {
              totalOv += overlapArea(boxes[k]);
              if (totalOv > maxOvArea) break;
            }
            if (totalOv <= maxOvArea) {
              node.dataset.placed = '1';
              const cxStr = cx.toFixed(1);
              const cyStr = cy.toFixed(1);
              setSvgAttribute(node, 'data-x', cxStr);
              setSvgAttribute(node, 'data-y', cyStr);
              applyNodeScale(node, cxStr, cyStr, rotStr);
              node.classList.remove('is-crowded-hidden');
              for (let k = 0; k < boxes.length; k++) occupied.push(boxes[k]);
              placed = true;
              break;
            }
          }
          if (!placed) {
            delete node.dataset.placed;
            node.classList.add('is-crowded-hidden');
          }
        }
      }

      this.grpProvNames.querySelectorAll('.province-caption').forEach((node) => {
        setSvgAttribute(node, 'font-size', (9.5 * s).toFixed(1));
      });
      this._zoomScaleNodes = scaleNodes;
      this._lastZoomStateKey = zoomStateKey;
      this._lastInvScale = invScale;
      // City names may have moved or appeared: let an open event balloon re-check them.
      if (this.activeMilestone && this.milestoneBalloon && !this.milestoneBalloon.classList.contains('is-hidden')) {
        this.activeMilestone._labelKey = null;
        this._positionMilestoneBalloon();
      }
    }

    _rescaleActivePersonPins(vw, s, zoomOnly = false) {
      if (!this.activePerson || !this.grpJourney) return;
      const svgRect =
        (this.dragState && this.dragState.rect) ||
        (this.pinchState && this.pinchState.rect) ||
        this._cameraViewportRect ||
        (typeof this.svg.getBoundingClientRect === 'function'
          ? this.svg.getBoundingClientRect()
          : null);
      if (svgRect && svgRect.width) this._cameraViewportRect = svgRect;
      const rw = (svgRect && svgRect.width) || vw || 1000;
      const rh = (svgRect && svgRect.height) || rw * 0.7;
      const screenScale = Math.min(rw / this.camera.w, rh / this.camera.h);
      const pinScale = Math.max(s, 0.92 / Math.max(0.12, screenScale));
      this._lastPersonPinScale = pinScale;
      const pinScaleStr = pinScale.toFixed(3);
      const pxPerLocal = pinScale * screenScale;
      const nodes = Array.from(this.grpJourney.querySelectorAll('.journey-node')).sort(
        (a, b) => Number(a.dataset.stopIdx) - Number(b.dataset.stopIdx)
      );
      const pts = nodes.map((n) => ({
        n,
        x: Number(n.getAttribute('data-x')),
        y: Number(n.getAttribute('data-y')),
        ox: Number(n.getAttribute('data-base-ox') || 0),
        oy: Number(n.getAttribute('data-base-oy') || 0),
        isPill: n.classList.contains('is-intersect'),
        isBead: n.classList.contains('is-multi-bead'),
      }));
      for (let iter = 0; iter < 12; iter++) {
        for (let i = 0; i < pts.length; i++) {
          if (pts[i].isBead) continue;
          for (let j = i + 1; j < pts.length; j++) {
            if (pts[j].isBead) continue;
            const minSepPx = pts[i].isPill || pts[j].isPill ? 18.5 : 15.8;
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
                ux = 1;
                uy = 0;
              } else {
                ux = dx / dist;
                uy = dy / dist;
              }
              const push = ((minSepPx - dist) * 0.52) / Math.max(0.2, pxPerLocal);
              pts[i].ox -= ux * push;
              pts[i].oy -= uy * push;
              pts[j].ox += ux * push;
              pts[j].oy += uy * push;
            }
          }
        }
      }
      for (const p of pts) {
        setSvgAttribute(p.n, 'transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${pinScaleStr})`);
        setSvgAttribute(p.n, 'data-ox', p.ox.toFixed(2));
        setSvgAttribute(p.n, 'data-oy', p.oy.toFixed(2));
        const shiftEl = p.n.querySelector('.jn-pin-shift');
        if (shiftEl) {
          setSvgAttribute(shiftEl, 'transform', `translate(${p.ox.toFixed(2)},${p.oy.toFixed(2)})`);
        }
      }
      const placedRects = pts.map((p) => {
        const isCur = p.n.classList.contains('is-current');
        const rPxY = p.isBead
          ? 3.8 * pxPerLocal
          : p.isPill
            ? (isCur ? 6.5 : 5.6) * pxPerLocal
            : (isCur ? 8.5 : 6.6) * pxPerLocal;
        const rPxX = p.isBead
          ? 3.8 * pxPerLocal
          : p.isPill
            ? (isCur ? 10.6 : 9.4) * pxPerLocal
            : rPxY;
        const cx = p.x * screenScale + p.ox * pxPerLocal;
        const cy = p.y * screenScale + p.oy * pxPerLocal;
        return {
          left: cx - rPxX,
          right: cx + rPxX,
          top: cy - rPxY,
          bottom: cy + rPxY,
        };
      });
      const defaultSlots = [
        { idx: 0, anchor: 'middle', lx: '0', ly: '-12.2', nx: 0, ny: -12.2 },
        { idx: 1, anchor: 'middle', lx: '0', ly: '19.8', nx: 0, ny: 19.8 },
        { idx: 2, anchor: 'start', lx: '11.2', ly: '3.8', nx: 11.2, ny: 3.8 },
        { idx: 3, anchor: 'end', lx: '-11.2', ly: '3.8', nx: -11.2, ny: 3.8 },
      ];
      const pillSlots = [
        { idx: 0, anchor: 'middle', lx: '0', ly: '-9.8', nx: 0, ny: -9.8 },
        { idx: 1, anchor: 'middle', lx: '0', ly: '17.2', nx: 0, ny: 17.2 },
        { idx: 2, anchor: 'start', lx: '11.8', ly: '3.5', nx: 11.8, ny: 3.5 },
        { idx: 3, anchor: 'end', lx: '-11.8', ly: '3.5', nx: -11.8, ny: 3.5 },
      ];
      const labelOrder = pts
        .slice()
        .sort((a, b) => {
          const rank = (item) =>
            item.n.classList.contains('is-current') ? 0 : item.isPill ? 1 : 2;
          return rank(a) - rank(b);
        });
      for (const p of labelOrder) {
        const lbl = p.n.querySelector('.jn-label');
        if (!lbl || lbl.classList.contains('is-hover-only-label')) continue;
        const isCur = p.n.classList.contains('is-current');
        const candSlots = p.isPill ? pillSlots : defaultSlots;
        const fontPx = isCur || p.isPill ? 11.2 : 10.2;
        const textW = (this._estimateLocalTextWidth(lbl.textContent, fontPx, 0) + 3.6) * pxPerLocal;
        const textH = (fontPx * 1.18 + 2.4) * pxPerLocal;
        const cx = p.x * screenScale + p.ox * pxPerLocal;
        const cy = p.y * screenScale + p.oy * pxPerLocal;
        const prevIdx =
          zoomOnly && lbl.dataset.slotIdx !== undefined ? Number(lbl.dataset.slotIdx) : -1;
        const orderedSlots =
          prevIdx >= 0 && candSlots[prevIdx]
            ? [candSlots[prevIdx], ...candSlots.filter((s0) => s0.idx !== prevIdx)]
            : candSlots;
        let chosenSlot = null;
        let chosenRect = null;
        let leastOverlap = Infinity;
        let fallbackSlot = null;
        let fallbackRect = null;
        for (const sl of orderedSlots) {
          const bx = cx + sl.nx * pxPerLocal;
          const by = cy + sl.ny * pxPerLocal;
          const left =
            sl.anchor === 'start' ? bx : sl.anchor === 'end' ? bx - textW : bx - textW * 0.5;
          const r = {
            left,
            right: left + textW,
            top: by - textH * 0.82,
            bottom: by + textH * 0.18,
          };
          let ovArea = 0;
          for (const o of placedRects) {
            const ox = Math.min(r.right, o.right) - Math.max(r.left, o.left);
            const oy = Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top);
            if (ox > 0 && oy > 0) ovArea += ox * oy;
          }
          if (ovArea === 0) {
            chosenSlot = sl;
            chosenRect = r;
            break;
          }
          if (ovArea < leastOverlap) {
            leastOverlap = ovArea;
            fallbackSlot = sl;
            fallbackRect = r;
          }
        }
        if (!chosenSlot && (isCur || p.isPill)) {
          chosenSlot = fallbackSlot || orderedSlots[0];
          chosenRect = fallbackRect;
        }
        if (chosenSlot) {
          lbl.style.display = '';
          lbl.style.textAnchor = chosenSlot.anchor;
          lbl.dataset.slotIdx = String(chosenSlot.idx);
          setSvgAttribute(lbl, 'text-anchor', chosenSlot.anchor);
          setSvgAttribute(lbl, 'x', chosenSlot.lx);
          setSvgAttribute(lbl, 'y', chosenSlot.ly);
          placedRects.push(chosenRect);
        } else {
          lbl.style.display = 'none';
        }
      }
    }

    _cancelCameraAnimation() {
      this._cameraTarget = null;
      this._cameraTargetIsZoom = false;
      if (this.flyRaf == null) return;
      cancelAnimationFrame(this.flyRaf);
      this.flyRaf = null;
      // Cancellation skips the flight's final frame, including its cleanup.
      if (this.activePerson) this._invalidateTypographyLayout();
      clearTimeout(this._cameraSettleTimer);
      this._cameraSettleTimer = setTimeout(() => this._finishCameraMotion(), 120);
    }

    _animateCameraTo(targetCam, { duration = 650, zoomInput = false } = {}) {
      this._cameraTarget = targetCam;
      this._cameraTargetIsZoom = zoomInput;
      if (
        !this._cameraViewportRect &&
        this.svg &&
        typeof this.svg.getBoundingClientRect === 'function'
      ) {
        this._cameraViewportRect = this._getUnscaledSvgRect();
      }
      const from = { ...this.camera };
      const t0 = performance.now();
      if (this.flyRaf) cancelAnimationFrame(this.flyRaf);
      this._prefetchTerrainForTarget(targetCam, zoomInput);
      const step = (now) => {
        const k = Math.max(0, Math.min(1, (now - t0) / duration));
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
        if (k < 1) {
          this.flyRaf = requestAnimationFrame(step);
          this._applyCamera(false);
        } else {
          this.flyRaf = null;
          this._cameraTarget = null;
          this._cameraTargetIsZoom = false;
          if (this.activePerson) this._invalidateTypographyLayout();
          this._applyCamera(true);
        }
      };
      this.flyRaf = requestAnimationFrame(step);
    }

    // Custom Route & AI-Native Public API methods are attached by js/atlas_api.js.

    resetCamera() {
      this.clearCustomRoute();
      this._animateCameraTo(this._getDefaultCamera());
    }

    zoomBy(factor, clientX, clientY, animate = true) {
      if (!Number.isFinite(factor) || factor <= 0) return;
      this._recordGestureMove();
      // Repeated key presses accumulate against the pending zoom destination.
      // A navigation flight is interrupted from its current visible camera.
      const cam = (animate && this._cameraTargetIsZoom && this._cameraTarget) || this.camera;
      const [mx, my] =
        clientX !== undefined && clientY !== undefined
          ? this._clientToSvgPoint(clientX, clientY, cam)
          : [cam.x + cam.w * 0.5, cam.y + cam.h * 0.5];
      const nextW = Math.max(100, Math.min(1300, cam.w / factor));
      const k = nextW / cam.w;
      const targetCam = {
        x: mx - (mx - cam.x) * k,
        y: my - (my - cam.y) * k,
        w: nextW,
        h: cam.h * k,
        zoom: 1000 / nextW,
      };
      if (animate && typeof this._animateCameraTo === 'function') {
        this._animateCameraTo(targetCam, { duration: 120, zoomInput: true });
      } else {
        this._cancelCameraAnimation();
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

    _clientToSvgPoint(clientX, clientY, cam = this.camera) {
      const rect =
        (this.dragState && this.dragState.rect) ||
        (this.pinchState && this.pinchState.rect) ||
        this._cameraViewportRect ||
        this._getUnscaledSvgRect();
      if (rect && rect.width) this._cameraViewportRect = rect;
      const scale = Math.min(rect.width / cam.w, rect.height / cam.h);
      const padX = (rect.width - cam.w * scale) * 0.5;
      const padY = (rect.height - cam.h * scale) * 0.5;
      return [
        cam.x + (clientX - rect.left - padX) / scale,
        cam.y + (clientY - rect.top - padY) / scale,
      ];
    }

    // ---------------- Dual-Mode Challenge ----------------
    _stripPromptParenthetical(name) {
      return String(name || '')
        .replace(/（[^）]+）|\([^)]+\)/g, '')
        .trim();
    }

    // Quiz / Dual-Mode Challenge methods are attached by js/atlas_quiz.js.

    // Historical Journeys (青史行迹) methods are attached by js/atlas_trace.js.

    // Global Quick Search methods are attached by js/atlas_search.js.

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

    _closeMorePopover() {
      const morePopover = this._id('more-popover');
      const moreBtn = this._id('act-more-menu');
      if (
        !morePopover ||
        morePopover.classList.contains('is-hidden') ||
        !moreBtn ||
        !moreBtn.classList.contains('is-active')
      ) {
        return false;
      }
      morePopover.classList.add('is-hidden');
      moreBtn.classList.remove('is-active');
      moreBtn.setAttribute('aria-expanded', 'false');
      return true;
    }

    // Dismiss the topmost active popover, sheet, or mode one layer at a time.
    _dismissTopOverlay() {
      if (this._closeMorePopover && this._closeMorePopover()) return true;
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
      if (this.activePolity) {
        this.closePolity();
        return true;
      }
      if (this.eraFocus) {
        this.clearEraFocus();
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
          multi_person: this.locale === 'en' ? 'Intersect' : '交汇',
          person: this.locale === 'en' ? 'Figure' : '人物',
          story: this.locale === 'en' ? 'Storyline' : '始末',
          quiz: this.locale === 'en' ? 'Quiz' : '雅集',
          dynasty: this.locale === 'en' ? 'Dynasty' : '朝代',
          polity: this.locale === 'en' ? 'Regime' : '政权',
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
          const showcasePool = this._getSearchShowcasePool();
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
            const cycleTitle =
              this.locale === 'en'
                ? 'Cycle solo / dual figure examples'
                : '切换单人 / 双人行迹示例';
            const tagKind = kindLabel[sampleItem.kind] || kindLabel.person;
            const tagText = `${this.dynastyBadge(sampleItem.dynasty)} · ${tagKind}`;
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
                if (!this._isMobileViewport()) searchInp.focus();
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
          const sampleQueries = this._getSearchSampleQueries();
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
              const sb = this._id('map-search-box');
              if (sb) sb.classList.add('is-expanded');
              searchInp.value = kw;
              renderSearchDropdown();
              if (!this._isMobileViewport()) searchInp.focus();
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
          if (!this._isLoreDetailLoaded()) {
            this._ensureLoreDetail();
          }
          if (!this._hasZhHant()) {
            this._ensureZhHant();
          }
          return;
        }
        const pinyinQuery = this._eventPinyinQuery(q);
        if (/[a-z]/i.test(q) && !this._hasEnDict()) {
          if (this._canMatchEventPinyin(pinyinQuery)) this._ensureEventPinyin();
          this._ensureEnglishLocale().then(renderSearchDropdown);
          return;
        }
        currentResults = this._queryQuickSearch(q);
        const pendingSearchData = [];
        if (!this._isLoreDetailLoaded()) pendingSearchData.push(this._ensureLoreDetail());
        if (/[\u4e00-\u9fff]/.test(q) && !this._hasZhHant()) {
          pendingSearchData.push(this._ensureZhHant());
        }
        if (!window.ATLAS_EVENT_PINYIN && this._canMatchEventPinyin(pinyinQuery, currentResults.length)) {
          pendingSearchData.push(this._ensureEventPinyin());
        }
        if (pendingSearchData.length) {
          const prevSig = currentResults.map((r) => `${r.kind}:${r.titleZh}:${r.subZh}`).join('|');
          Promise.all(pendingSearchData).then(() => {
            if (searchList.classList.contains('is-hidden') || searchInp.value.trim() !== q) return;
            const nextResults = this._queryQuickSearch(q);
            const nextSig = nextResults.map((r) => `${r.kind}:${r.titleZh}:${r.subZh}`).join('|');
            if (nextSig !== prevSig) renderSearchDropdown();
          });
        }
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
          const prevBucket = idx > 0 ? currentResults[idx - 1].bucket : null;
          if (idx > 0 && item.bucket && prevBucket && item.bucket !== prevBucket) {
            li.classList.add('is-group-start');
          }
          const mainText = this.locale === 'en' ? item.titleEn : this._zh(item.titleZh);
          const subText = this.locale === 'en' ? item.subEn : this._zh(item.subZh);
          const tagText =
            item.personProfile && item.personProfile.isRelic
              ? this.locale === 'en'
                ? 'Warring–5 Dyn · Relic'
                : this._zh('战国—五代 · 国器')
              : `${this.dynastyBadge(item.dynasty)} · ${this._zh(kindLabel[item.kind] || '')}`;
          const bucketAttr = item.bucket ? ` data-bucket="${escHtml(item.bucket)}"` : '';
          li.innerHTML =
            `<div><span class="sr-main">${escHtml(mainText)}</span>${subText ? `<span class="sr-sub">${escHtml(subText)}</span>` : ''}</div>` +
            `<span class="sr-tag"${bucketAttr}>${escHtml(tagText)}</span>`;
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
        searchInp.addEventListener('focus', () => {
          searchInp.placeholder = this._searchPlaceholder(true);
          renderSearchDropdown();
        });
        searchInp.addEventListener('blur', () => {
          searchInp.placeholder = this._searchPlaceholder(false);
          setTimeout(() => {
            if (
              searchBox &&
              !searchInp.value.trim() &&
              searchList.classList.contains('is-hidden')
            ) {
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
          this._closeMorePopover();
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

      const moreBtn = this._id('act-more-menu');
      const morePopover = this._id('more-popover');
      if (moreBtn && morePopover) {
        moreBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._closeLayersPopover();
          const willOpen = morePopover.classList.contains('is-hidden');
          if (willOpen) {
            morePopover.classList.remove('is-hidden');
            moreBtn.classList.add('is-active');
            moreBtn.setAttribute('aria-expanded', 'true');
          } else {
            this._closeMorePopover();
          }
        });
        morePopover.addEventListener('click', () => {
          this._closeMorePopover();
        });
        document.addEventListener('pointerdown', (e) => {
          if (
            !morePopover.classList.contains('is-hidden') &&
            !morePopover.contains(e.target) &&
            !moreBtn.contains(e.target)
          ) {
            this._closeMorePopover();
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
      this._id('chk-prefectures').addEventListener('change', (e) => {
        this.grpPrefectures.classList.toggle('is-hidden', !e.target.checked);
        if (e.target.checked) this._materializeDeferredPrefectures();
        else this._clearHoveredPrefecture();
        this._rescaleSvgTypography();
      });
      this._id('chk-settlements').addEventListener('change', (e) => {
        if (this.challenge) return;
        this.grpSettlements.classList.toggle('is-hidden', !e.target.checked);
        const cur = this.dynasties[this.dynastyIdx];
        if (cur) this._updateMilestoneStates(cur);
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
          this._syncUrlLangParam();
          this.applyLocale();
        });
      }
      this._id('act-locale').addEventListener('click', () => {
        const btn = this._id('act-locale');
        const target = btn && btn.dataset && btn.dataset.targetLocale;
        this.locale = target || (this.locale === 'en' ? 'zh' : 'en');
        this._syncUrlLangParam();
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
      this._bindScrubberNavigator();
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
          const rawDelta =
            e.deltaMode === 1 ? e.deltaY * 18 : e.deltaMode === 2 ? e.deltaY * 240 : e.deltaY;
          if (!Number.isFinite(rawDelta) || rawDelta === 0) return;
          this._cancelCameraAnimation();
          this._recordGestureMove();
          const [mx, my] = this._clientToSvgPoint(e.clientX, e.clientY);
          // Trackpad pinch is encoded as ctrl+wheel with deltaY = -100*log(scale).
          // Decode pinch directly; ordinary wheel/two-finger scrolling retains
          // its existing sensitivity and per-event limit.
          const delta = e.ctrlKey ? rawDelta : Math.max(-220, Math.min(220, rawDelta));
          const factor = Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.002));
          const nextW = Math.max(100, Math.min(1300, this.camera.w / factor));
          const k = nextW / this.camera.w;
          this.camera = {
            x: mx - (mx - this.camera.x) * k,
            y: my - (my - this.camera.y) * k,
            w: nextW,
            h: this.camera.h * k,
            zoom: 1000 / nextW,
          };
          this._scheduleCameraUpdate();
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
        this._cancelCameraAnimation();
        this._cancelPendingHover();
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
            rect: this._cameraViewportRect || this._getUnscaledSvgRect(),
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
            rect: this._cameraViewportRect || this._getUnscaledSvgRect(),
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
          this._scheduleCameraUpdate();
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
          this._scheduleCameraUpdate();
        }
      });

      const inspectPointTooltip = (e) => {
        if (this.challenge && !this.challenge.answered) {
          this.hoverTip.classList.add('is-hidden');
          this.hoverTip.classList.remove('is-interactive');
          return;
        }
        const target = document.elementFromPoint(e.clientX, e.clientY) || e.target;
        if (
          !target ||
          (this.svg && typeof this.svg.contains === 'function' && !this.svg.contains(target)) ||
          target === this.svg ||
          target.id === 'ocean-bg' ||
          target.id === 'terrain-relief-img'
        ) {
          this.hoverTip.classList.add('is-hidden');
          this.hoverTip.classList.remove('is-interactive');
          return;
        }
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
        const mHitCoord =
          milestoneEl && milestoneEl.dataset.lng !== undefined && milestoneEl.dataset.lat !== undefined
            ? [Number(milestoneEl.dataset.lng), Number(milestoneEl.dataset.lat)]
            : mHit && mHit.coord;
        const coCity =
          !settlementEl && mHitCoord
            ? this._findCoLocatedSettlement(cur, mHitCoord[0], mHitCoord[1], 28)
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
            const whoPrefix =
              this.activePerson.isMulti && ev.personZh
                ? `[${isEn ? ev.personEn : ev.personZh} #${ev.personStepNum}] `
                : `${sIdx + 1}. `;
            const intNote =
              this.activePerson.isMulti && ev.intersection
                ? `<div class="tt-sub" style="color:#b5452f;font-weight:700">${
                    ev.intersection.kind === 'same_time'
                      ? isEn
                        ? '✦ Contemporaneous Spacetime Intersection'
                        : '✦ 同代相逢交汇点'
                      : isEn
                        ? '◈ Cross-Era Spacetime Co-location'
                        : '◈ 异代同地交汇点'
                  }</div>`
                : '';
            this._showHoverTip(
              e,
              `<b>${whoPrefix}${yr} · ${place}</b>${intNote}<div class="tt-sub">${
                isEn ? ev.textEn : ev.textZh
              }</div>`
            );
            return;
          }
        } else if (milestoneEl && !settlementNameEl && mHit) {
          const eraPart = this.locale === 'en' ? '' : ` · ${this._eventEraLabel(cur, mHit)}`;
          const pinSiteIdx =
            milestoneEl.dataset.siteIdx !== undefined ? Number(milestoneEl.dataset.siteIdx) : -1;
          const alreadyOpen =
            this.activeMilestone &&
            this.activeMilestone.dynastyKey === cur.key &&
            this.activeMilestone.milestone === mHit &&
            (pinSiteIdx < 0 || this.activeMilestone.siteIdx === pinSiteIdx) &&
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
          const passObj =
            settlementEl.dataset.passKey &&
            (HistoricalAtlasController.STRATEGIC_PASSES || []).find(
              (p) => p.key === settlementEl.dataset.passKey
            );
          const pChoke =
            settlementEl.dataset.chokepoint ||
            (passObj
              ? this.locale === 'en'
                ? passObj.chokepointEn
                : this._zh(passObj.chokepointZh || '')
              : '') ||
            '';
          const badge = this.locale === 'en' ? '[Strategic Pass]' : '【天下名关】';
          const traceHint =
            this.locale === 'en' ? 'Click to view pass history & battles ›' : '点击查看关隘形胜与历代战史 ›';
          const locStr = this.locale === 'en' ? ` (Now ${pMod})` : `（今${pMod}）`;
          this._showHoverTip(
            e,
            `<b>${badge} ${pName}${locStr}</b><div class="tt-sub">${pRange}${pChoke ? ' · ' + pChoke : ''}</div><div class="tt-sub">${traceHint}</div>`
          );
        } else if (settlementEl || coCity) {
          const isModernDyn = Boolean(cur && (cur.key === 'roc' || cur.key === 'prc'));
          const rawAnc = settlementEl
            ? settlementEl.dataset.ancient
            : this._settlementAncient(coCity, this.year);
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
          this._showHoverTip(
            e,
            `<b>${anc}</b><div class="tt-sub">${sub}</div>`,
            settlementEl ? settlementEl.querySelector('.name') : null
          );
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
        // Preserve the last move even when pointerup/cancel arrives before rAF.
        if (this._camRaf !== null) this._applyCamera();
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
            rect: this._cameraViewportRect || this._getUnscaledSvgRect(),
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
        if (!wasPan && this.challenge && this._quizChipAt(e.clientX, e.clientY)) {
          const nextBtn = this._id('act-next-round');
          if (nextBtn) nextBtn.click();
        } else if (!wasPan && this.challenge && !this.challenge.answered) {
          if (this.lastPinchTime && Date.now() - this.lastPinchTime < 350) {
            return;
          }
          this._recordGestureClick();
          const [sx, sy] = this._clientToSvgPoint(e.clientX, e.clientY);
          const pend = this.challenge.pendingGuess;
          const svgPerPx = this.camera.w / Math.max(1, this.svg.getBoundingClientRect().width);
          if (pend && Math.hypot(sx - pend[0], sy - pend[1]) <= 14 * svgPerPx) {
            // Clicking the pending mark again confirms it.
            this._evaluateLocateClick(pend[0], pend[1]);
          } else {
            this._previewLocatePin(sx, sy);
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

          // Clicking the city name text (e.g. "长安"), the onboarding whisper tag, or a city dot without an overlapping unopened event pin -> trace place history
          const milestoneAlreadyAnchored =
            Boolean(milestoneEl && cur) &&
            (() => {
              const pm = this._resolvePinMilestone(cur, milestoneEl);
              const pmIdx = pm ? (cur.milestones || []).indexOf(pm) : -1;
              const pmSite =
                milestoneEl.dataset.siteIdx !== undefined
                  ? Number(milestoneEl.dataset.siteIdx)
                  : undefined;
              return Boolean(
                this.activeMilestone &&
                  this.activeMilestone.dynastyKey === cur.key &&
                  this.activeMilestone.idx === pmIdx &&
                  (pmSite === undefined || this.activeMilestone.siteIdx === pmSite) &&
                  !this.milestoneBalloon.classList.contains('is-hidden')
              );
            })();
          if (
            settlementEl &&
            settlementEl.dataset.lng &&
            settlementEl.dataset.lat &&
            (settlementNameEl ||
              !milestoneEl ||
              (settlementEl.classList.contains('has-trace-hint') && milestoneAlreadyAnchored))
          ) {
            this.openGenealogyAt(Number(settlementEl.dataset.lng), Number(settlementEl.dataset.lat));
            return;
          }

          // Clicking an event diamond pin (◆) -> open event balloon (or trace place history if balloon is already open)
          if (milestoneEl && cur) {
            const m = this._resolvePinMilestone(cur, milestoneEl);
            const mIdx = m ? (cur.milestones || []).indexOf(m) : -1;
            if (m && m.coord) {
              const pinSiteIdx =
                milestoneEl.dataset.siteIdx !== undefined ? Number(milestoneEl.dataset.siteIdx) : undefined;
              const pinCoord =
                milestoneEl.dataset.lng !== undefined && milestoneEl.dataset.lat !== undefined
                  ? [Number(milestoneEl.dataset.lng), Number(milestoneEl.dataset.lat)]
                  : m.coord;
              const coCity = settlementEl
                ? { coord: [Number(settlementEl.dataset.lng), Number(settlementEl.dataset.lat)] }
                : this._findCoLocatedSettlement(cur, pinCoord[0], pinCoord[1], 28);
              const targetCoord = coCity ? coCity.coord : pinCoord;
              const alreadyOpen =
                this.activeMilestone &&
                this.activeMilestone.dynastyKey === cur.key &&
                this.activeMilestone.idx === mIdx &&
                (pinSiteIdx === undefined || this.activeMilestone.siteIdx === pinSiteIdx) &&
                !this.milestoneBalloon.classList.contains('is-hidden');
              if (alreadyOpen) {
                this.openGenealogyAt(targetCoord[0], targetCoord[1]);
                return;
              }
              this.stopAutoplay();
              this.jumpToYear(this._clampYearToDynasty(cur, m.year));
              this.openMilestoneBalloon(cur, m, { isAuto: false, siteIdx: pinSiteIdx });
              this._panToward(pinCoord[0], pinCoord[1]);
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

      // Hover tooltips (Desktop pointermove — coalesced to once per animation frame)
      const frame = this._id('viewport-frame');
      frame.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        if (this.dragState || this.pinchState || this._camRaf != null || this._cameraSettleTimer != null) return;
        this._clearHoveredPrefecture();
        this._pendingHoverEvent = {
          clientX: e.clientX,
          clientY: e.clientY,
          pointerType: e.pointerType,
          target: e.target,
        };
        if (this._hoverRaf != null) return;
        this._hoverRaf = requestAnimationFrame(() => {
          this._hoverRaf = null;
          const ev = this._pendingHoverEvent;
          this._pendingHoverEvent = null;
          if (!ev || this.dragState || this.pinchState || this._camRaf != null || this._cameraSettleTimer != null) {
            return;
          }
          inspectPointTooltip(ev);
        });
      });

      frame.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'touch') return;
        this._cancelPendingHover();
        this._clearHoveredPrefecture();
        this.hoverTip.classList.add('is-hidden');
      });

      window.addEventListener('resize', () => {
        this._cameraViewportRect = null;
        const vw = window.innerWidth;
        if (this._lastViewportWidth === undefined || Math.abs(vw - this._lastViewportWidth) > 8) {
          this._rescaleSvgTypography();
          this._syncTogglePaneButton();
        }
        this._updateScaleBar();
      });
      // The chronicle pane can resize the map without a window resize.
      if (typeof ResizeObserver !== 'undefined') {
        this._cameraResizeObserver = new ResizeObserver(() => {
          if (this._stageWrap && this._stageWrap.style && this._stageWrap.style.transform) {
            this._commitStageTransform();
          }
          this._cameraViewportRect = null;
          this._scrubberRailWidth = 0;
        });
        this._cameraResizeObserver.observe(this.svg);
      }
    }

    _showHoverTip(e, html, avoidEl = null) {
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
      // Measure at a stable origin so the previous position cannot squeeze a
      // newly longer card before its final placement is chosen.
      this.hoverTip.style.left = '8px';
      const { width, height } = this.hoverTip.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // One spacing for every pointer: 16 px clears the top of a default-size
      // grab hand (its palm sits on the hotspot) without leaving the card
      // detached, and the pointing hand only extends below its fingertip.
      const gap = 16;
      const belowGap = 56;
      const padding = 8;
      // Center above the hovered point; the measured size lets wrapped cards
      // shift or flip at the map edges.
      const preferredLeft = x - width * 0.5;
      // City names can sit above the dot; leave the name readable too.
      const anchorTop = avoidEl ? Math.min(y, avoidEl.getBoundingClientRect().top - rect.top) : y;
      const preferredTop = anchorTop - gap - height >= padding
        ? anchorTop - gap - height : y + belowGap;
      const left = Math.max(padding, Math.min(rect.width - width - padding, preferredLeft));
      const top = Math.max(padding, Math.min(rect.height - height - padding, preferredTop));
      this.hoverTip.style.left = `${left}px`;
      this.hoverTip.style.top = `${top}px`;
    }

    // AI-Native Public API (resolvePlace / inspect / locate / _restoreFromQuery) methods are attached by js/atlas_api.js.
  }

  HistoricalAtlasController._extendPrototype = function (mixin) {
    const src = typeof mixin === 'function' ? mixin.prototype : mixin;
    for (const name of Object.getOwnPropertyNames(src)) {
      if (name === 'constructor') continue;
      const desc = Object.getOwnPropertyDescriptor(src, name);
      if (desc) {
        Object.defineProperty(HistoricalAtlasController.prototype, name, {
          ...desc,
          enumerable: false,
        });
      }
    }
    if (typeof mixin === 'function') {
      for (const sName of Object.getOwnPropertyNames(mixin)) {
        if (sName === 'length' || sName === 'name' || sName === 'prototype') continue;
        const sDesc = Object.getOwnPropertyDescriptor(mixin, sName);
        if (sDesc) {
          Object.defineProperty(HistoricalAtlasController, sName, sDesc);
        }
      }
    }
  };
  HistoricalAtlasController._escHtml = escHtml;
  HistoricalAtlasController._svgIcons = SVG_ICONS;
  HistoricalAtlasController._projectorClass = MercatorProjector;
  HistoricalAtlasController._eraDynastyPrefixes = ERA_DYNASTY_PREFIXES;

  window.MercatorProjector = MercatorProjector;
  window.HistoricalAtlasController = HistoricalAtlasController;
  // Modules such as js/atlas_quiz.js that loaded before this file queue an installer.
  if (Array.isArray(window.__ATLAS_MIXINS)) {
    for (const install of window.__ATLAS_MIXINS.splice(0)) install(HistoricalAtlasController);
  }
  window.addEventListener('DOMContentLoaded', () => {
    const app = new HistoricalAtlasController();
    window.atlasApp = app;
    window.atlasAPI = {
      locate: (opts) => app.locate(opts),
      resolvePlace: (place, year) => app.resolvePlace(place, year),
      inspect: (opts) => app.inspect(opts),
      openPerson: (who, idx = -1) => app.openPersonChronicle(who, idx),
      search: (q) => app._queryQuickSearch(q),
    };
    app._registerWebMcpTools();
  });
})();
