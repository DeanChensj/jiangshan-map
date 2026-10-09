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
        const key = `${d.key}:${m.year}`;
        const hit = this.enLocale.milestones && this.enLocale.milestones[key];
        if (hit) return Array.isArray(hit) ? hit[0] : hit;
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

    applyLocale() {
      document.documentElement.lang = this.locale === 'en' ? 'en' : 'zh-CN';
      document.title = this.uiStr('title', '江山时序 · 中国历史地图时间轴');

      this._id('txt-seal').textContent = this.uiStr('brand_seal', '江山时序');
      this._id('txt-subtitle').textContent = this.uiStr('brand_sub', '中国历史地图 · 秦 → 今');
      this._id('lbl-provinces').textContent = this.uiStr('toggle_modern', '现代省界');
      this._id('lbl-prov-names').textContent = this.uiStr('toggle_modern_labels', '现代省名');
      this._id('lbl-polities').textContent = this.uiStr('toggle_realms', '历史疆域');
      this._id('lbl-prefectures').textContent =
        this.locale === 'en' ? 'Admin Divisions' : '州道政区';
      this._id('lbl-settlements').textContent = this.uiStr('toggle_cities', '古地名');
      this._id('lbl-corridors').textContent = this.uiStr('toggle_routes', '长城 · 运河 · 丝路');
      this._id('lbl-milestones').textContent = this.uiStr('toggle_events', '事件');
      const lblReset = this._id('lbl-reset-camera') || this._id('act-reset-camera');
      lblReset.textContent = this.uiStr('btn_reset', '复位视图');
      const lblGen = this._id('lbl-genealogy') || this._id('act-genealogy');
      lblGen.textContent = this.genealogyMode
        ? this.uiStr('btn_trace_active', '点地溯源 · 点击地图')
        : this.uiStr('btn_trace', '点地溯源');
      const lblChal = this._id('lbl-challenge') || this._id('act-challenge');
      lblChal.textContent = this.challenge
        ? this.uiStr('btn_quiz_active', '挑战中…')
        : this.uiStr('btn_quiz', '开始挑战');
      const lblLoc = this._id('lbl-locale') || this._id('act-locale');
      lblLoc.textContent = this.locale === 'en' ? '中文' : 'EN';
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

      this.grpProvNames.querySelectorAll('.province-caption').forEach((node) => {
        if (node.dataset.rawName) node.textContent = this.trTerm(node.dataset.rawName);
      });
      this.grpNeighbors.querySelectorAll('.neighbor-caption').forEach((node) => {
        if (node.dataset.rawName) node.textContent = this.trTerm(node.dataset.rawName);
      });

      this._refreshBandLabels();
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
      this.grpPolities.innerHTML = '';
      this.grpPrefectures.innerHTML = '';

      const polGroup = this._svgNode('g', { class: 'fade-enter' }, this.grpPolities);
      const zOrder = { neighbor: 0, main: 1, rival: 2, protectorate: 3 };
      const sorted = (snap.polities || [])
        .slice()
        .sort((a, b) => (zOrder[a.role] || 0) - (zOrder[b.role] || 0));

      const polityObstacles = [];
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
          polityObstacles.push({ x: cx, y: cy, w: isN ? 36 : 56, h: isN ? 16 : 23 });
          const lbl = this._svgNode(
            'text',
            {
              class: `polity-caption ${pol.role}`,
              'data-x': cx.toFixed(1),
              'data-y': cy.toFixed(1),
            },
            polGroup
          );
          lbl.textContent = this.trTerm(pol.title);
        }
      }

      const cityObstacles = [];
      for (const item of dynasty.settlements || []) {
        if (item.appear !== undefined && this.year < item.appear) continue;
        if (item.vanish !== undefined && this.year > item.vanish) continue;
        const [sx, sy] = this.projector.toScreen(item.coord[0], item.coord[1]);
        cityObstacles.push({ x: sx + (item.align === 'l' ? -14 : 14), y: sy, w: 26, h: 12 });
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

      const placedRegions = [];
      const candidateOffsets = [
        [0, 0],
        [0, 24],
        [0, -24],
        [-34, 20],
        [34, 20],
        [-34, -20],
        [34, -20],
        [0, 34],
        [0, -34],
        [-45, 0],
        [45, 0],
      ];
      const collides = (x, y) => {
        for (const p of polityObstacles) {
          if (Math.abs(x - p.x) < p.w && Math.abs(y - p.y) < p.h) return true;
        }
        for (const c of cityObstacles) {
          if (Math.abs(x - c.x) < c.w && Math.abs(y - c.y) < c.h) return true;
        }
        for (const r of placedRegions) {
          if (Math.abs(x - r.x) < 32 && Math.abs(y - r.y) < 12) return true;
        }
        return false;
      };

      for (const reg of snap.regions || []) {
        this._svgNode(
          'path',
          { d: this.projector.shapeToSvgPath(reg.shape), class: 'region-shape' },
          prefGroup
        );
        if (reg.anchor && reg.title) {
          const [baseX, baseY] = this.projector.toScreen(reg.anchor[0], reg.anchor[1]);
          let rx = baseX;
          let ry = baseY;
          for (const [dx, dy] of candidateOffsets) {
            const tx = baseX + dx;
            const ty = baseY + dy;
            if (!collides(tx, ty)) {
              const [lng, lat] = this.projector.toGeo(tx, ty);
              if (
                (dx === 0 && dy === 0) ||
                !reg.shape ||
                MercatorProjector.pointInShape(lng, lat, reg.shape)
              ) {
                rx = tx;
                ry = ty;
                break;
              }
            }
          }
          placedRegions.push({ x: rx, y: ry });
          const rLbl = this._svgNode(
            'text',
            {
              class: 'region-caption',
              'data-x': rx.toFixed(1),
              'data-y': ry.toFixed(1),
            },
            prefGroup
          );
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
      for (const item of dynasty.settlements || []) {
        if (item.appear !== undefined && this.year < item.appear) continue;
        if (item.vanish !== undefined && this.year > item.vanish) continue;
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
          this.jumpToYear(Math.max(dynasty.fromYear, Math.min(dynasty.toYear - 1, m.year)));
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
      let activeIdx = -1;
      (dynasty.milestones || []).forEach((m, idx) => {
        if (m.year <= this.year) activeIdx = idx;
      });
      return activeIdx;
    }

    _updateMilestoneStates(dynasty) {
      const activeIdx = this._activeMilestoneIndex(dynasty);
      let currentPin = null;
      this.grpMilestones.querySelectorAll('.milestone-pin').forEach((pin) => {
        const idx = Number(pin.dataset.idx);
        const yr = Number(pin.dataset.year);
        pin.classList.toggle('is-future', yr > this.year);
        pin.classList.toggle('is-past', yr <= this.year && idx !== activeIdx);
        pin.classList.toggle('is-current', idx === activeIdx);
        if (idx === activeIdx) currentPin = pin;
      });
      if (currentPin && currentPin.parentNode) {
        currentPin.parentNode.appendChild(currentPin);
      }
    }

    openMilestoneBalloon(dynasty, m) {
      this.activeMilestone = { dynastyKey: dynasty.key, milestone: m, year: this.year };
      this.grpMilestones.querySelectorAll('.milestone-pin').forEach((n) => {
        n.classList.toggle('is-active', Number(n.dataset.year) === m.year);
      });
      if (!m.coord) {
        this.closeMilestoneBalloon();
        return;
      }
      const yrText = this.formatYear(m.year);
      const siteStr = this.milestoneSite(dynasty, m);
      const placeHtml = siteStr ? `<span class="ep-place">${SVG_ICONS.pin} ${siteStr}</span>` : '';
      this.milestoneBalloon.innerHTML =
        `<div><span class="ep-year">${yrText} · ${this.dynastyName(dynasty)}</span>${placeHtml}</div>` +
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

    _renderLegendBox(snap) {
      this.mapKey.innerHTML = '';
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
        entry.className = 'key-entry';
        const sw = document.createElement('i');
        sw.className = 'swatch';
        sw.style.color = p.tint;
        sw.style.background = `${p.tint}55`;
        if (p.role === 'protectorate') sw.style.borderStyle = 'dashed';
        entry.appendChild(sw);
        entry.appendChild(document.createTextNode(this.trTerm(p.title)));
        grid.appendChild(entry);
      }
      if (hasNeighbors) {
        const entry = document.createElement('span');
        entry.className = 'key-entry';
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
        grid.appendChild(entry);
      }
      if (grid.firstChild) this.mapKey.appendChild(grid);

      if (snap.note) {
        const n = document.createElement('div');
        n.className = 'key-note';
        n.innerHTML = `${SVG_ICONS.note} <span>${this.trTerm(snap.note)}</span>`;
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
          const meta = [
            ['wall', '#5a3826', '5 2', this.uiStr('leg_wall', '长城')],
            ['canal', '#1f6f8b', '6 2', this.uiStr('leg_canal', '大运河')],
            ['road', '#9c6317', '2 3', this.uiStr('leg_road', '陆上丝路 / 古道')],
            ['sea', '#2c5d8f', '2 3', this.uiStr('leg_sea', '郑和航线')],
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
        const targetY = Math.max(dynasty.fromYear, Math.min(dynasty.toYear - 1, m.year));
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
    }

    // ---------------- Place Genealogy (Trace Place) ----------------
    toggleGenealogyMode(force) {
      this.genealogyMode = force !== undefined ? force : !this.genealogyMode;
      this._id('act-genealogy').classList.toggle('is-active', this.genealogyMode);
      const lblEl = this._id('lbl-genealogy') || this._id('act-genealogy');
      lblEl.textContent = this.genealogyMode
        ? this.uiStr('btn_trace_active', '点地溯源 · 点击地图')
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
        const snapKey = this._resolveSnapKey(d, d.focusYear);
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
      window.addEventListener('resize', () => this._fitBandLabels());
    }

    _refreshBandLabels() {
      const cells = this._id('dynasty-bands').children;
      const tickNodes = this._id('scrubber-ticks').children;
      this.dynasties.forEach((d, idx) => {
        const cell = cells[idx];
        if (cell) {
          cell.textContent = this.dynastyBadge(d);
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
        cell.classList.toggle('is-narrow', cell.scrollWidth > cell.clientWidth + 1);
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
      this._id('scrubber-handle').style.left = `${pct}%`;
      this._id('scrubber-Bubble').style.left = `${Math.max(4, Math.min(96, pct))}%`;
      const d = this.dynasties[this.dynastyIdx];
      this._id('bubble-text').textContent = `${this.formatYear(this.year)} · ${this.dynastyName(d)}`;
      this._id('scrubber-track').setAttribute('aria-valuenow', String(this.year));
      this._id('inp-year').value = this.year === 0 ? 1 : this.year;
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
          this.activeSnapKey = nextSnapKey;
          this._fetchSnapshot(nextSnapKey).then((snap) => {
            if (
              this.dynasties[this.dynastyIdx] !== cur ||
              this._resolveSnapKey(cur, this.year) !== nextSnapKey
            ) {
              return;
            }
            this._renderPolitiesAndPrefectures(cur, snap);
          });
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
      if (this.activeMilestone) this._positionMilestoneBalloon();
    }

    _rescaleSvgTypography() {
      const z = 1000 / this.camera.w;
      const invScale = (1 / Math.sqrt(z)).toFixed(3);
      this.svg.classList.toggle('is-zoomed-cities', z >= 1.75);
      this.svg
        .querySelectorAll(
          '.settlement-node, .region-caption, .neighbor-caption, .corridor-caption, .milestone-pin, #grp-challenge g[data-x], #grp-genealogy g[data-x]'
        )
        .forEach((node) => {
          const x = node.getAttribute('data-x');
          const y = node.getAttribute('data-y');
          if (x !== null) {
            node.setAttribute('transform', `translate(${x},${y}) scale(${invScale})`);
          }
        });
      this.grpPolities.querySelectorAll('.polity-caption').forEach((node) => {
        const x = node.getAttribute('data-x');
        const y = node.getAttribute('data-y');
        if (x !== null) {
          node.setAttribute('transform', `translate(${x},${y}) scale(${invScale})`);
        }
        const base = node.classList.contains('neighbor')
          ? 9
          : node.classList.contains('protectorate')
            ? 10
            : node.classList.contains('rival')
              ? 12
              : 14;
        node.setAttribute('font-size', (base + (base > 10 ? 10 : 3) / z).toFixed(1));
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
      this.grpSettlements.classList.toggle('is-hidden', this.challengeVariant === 'locate');
      this._id('act-next-round').onclick = null;
      this.presentChallengeRound();
    }

    stopChallenge() {
      this.challenge = null;
      this.grpChallenge.innerHTML = '';
      this._id('challenge-card').classList.add('is-hidden');
      this._id('challenge-options').classList.add('is-hidden');
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

    // ---------------- Event Listeners ----------------
    _attachListeners() {
      // Layer checkboxes
      const bindToggle = (chkId, grpEl, inv = false) => {
        this._id(chkId).addEventListener('change', (e) => {
          grpEl.classList.toggle('is-hidden', inv ? e.target.checked : !e.target.checked);
        });
      };
      bindToggle('chk-provinces', this.grpProvinces);
      bindToggle('chk-prov-names', this.grpProvNames);
      bindToggle('chk-polities', this.grpPolities);
      bindToggle('chk-prefectures', this.grpPrefectures);
      bindToggle('chk-settlements', this.grpSettlements);
      bindToggle('chk-corridors', this.grpCorridors);
      this._id('chk-milestones').addEventListener('change', (e) => {
        this.grpMilestones.classList.toggle('is-hidden', !e.target.checked);
        if (!e.target.checked) this.closeMilestoneBalloon();
      });

      this._id('act-reset-camera').addEventListener('click', () => this.resetCamera());
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
          this.closeMilestoneBalloon();
          if (this.genealogyMode) this.toggleGenealogyMode(false);
        }
      });

      // SVG Zoom & Pan
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

      this.svg.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        this.didPan = false;
        this.dragState = {
          startX: e.clientX,
          startY: e.clientY,
          camX: this.camera.x,
          camY: this.camera.y,
        };
        this.svg.setPointerCapture(e.pointerId);
      });

      this.svg.addEventListener('pointermove', (e) => {
        if (!this.dragState) return;
        const dx = e.clientX - this.dragState.startX;
        const dy = e.clientY - this.dragState.startY;
        if (Math.hypot(dx, dy) > 4) {
          this.didPan = true;
          this.svg.classList.add('is-panning');
        }
        if (this.didPan) {
          const rect = this.svg.getBoundingClientRect();
          const scale = Math.min(rect.width / this.camera.w, rect.height / this.camera.h);
          this.camera.x = this.dragState.camX - dx / scale;
          this.camera.y = this.dragState.camY - dy / scale;
          this._applyCamera();
        }
      });

      const endPointer = (e) => {
        if (!this.dragState) return;
        const wasPan = this.didPan;
        this.dragState = null;
        this.svg.classList.remove('is-panning');
        if (!wasPan && this.challenge && !this.challenge.answered && this.challenge.variant === 'locate') {
          const [sx, sy] = this._clientToSvgPoint(e.clientX, e.clientY);
          this._evaluateLocateClick(sx, sy);
        } else if (!wasPan && this.genealogyMode) {
          const [sx, sy] = this._clientToSvgPoint(e.clientX, e.clientY);
          const [lng, lat] = this.projector.toGeo(sx, sy);
          this.openGenealogyAt(lng, lat);
        }
      };
      this.svg.addEventListener('pointerup', endPointer);
      this.svg.addEventListener('pointercancel', endPointer);

      // Hover tooltips
      const frame = this._id('viewport-frame');
      frame.addEventListener('pointermove', (e) => {
        const settlementEl = e.target.closest && e.target.closest('.settlement-node');
        const corridorEl = e.target.closest && e.target.closest('.corridor-line');
        const milestoneEl = e.target.closest && e.target.closest('.milestone-pin');

        if (settlementEl) {
          const anc = this.trTerm(settlementEl.dataset.ancient);
          const mod = this.trTerm(settlementEl.dataset.modern);
          const rem = this.trTerm(settlementEl.dataset.remark);
          const sub =
            this.locale === 'en'
              ? `${mod && mod !== anc ? 'Now ' + mod : 'Same modern name'}${rem ? ' · ' + rem : ''}`
              : `${mod && mod !== anc ? '今 ' + mod : '古今同名'}${rem ? ' · ' + rem : ''}`;
          this._showHoverTip(e, `<b>${anc}</b><div class="tt-sub">${sub}</div>`);
        } else if (corridorEl) {
          this._showHoverTip(
            e,
            `<b>${corridorEl.dataset.corrTitle}</b><div class="tt-sub">${corridorEl.dataset.corrSummary || ''}</div>`
          );
        } else if (milestoneEl) {
          const cur = this.dynasties[this.dynastyIdx];
          const m = (cur.milestones || []).find(
            (item) => item.year === Number(milestoneEl.dataset.year)
          );
          if (m) {
            this._showHoverTip(
              e,
              `<b>${this.formatYear(m.year)} · ${this.milestoneHeadline(cur, m)}</b><div class="tt-sub">${
                m.site ? SVG_ICONS.pin + ' ' + this.trTerm(m.site) + ' · ' : ''
              }${this.uiStr('click_for_detail', '点击查看详情')}</div>`
            );
          }
        } else if (
          e.target.dataset &&
          (e.target.dataset.prefTitle ||
            e.target.dataset.polityTitle ||
            e.target.dataset.provTitle ||
            e.target.dataset.countryTitle)
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
      });

      frame.addEventListener('pointerleave', () => this.hoverTip.classList.add('is-hidden'));
    }

    _showHoverTip(e, html) {
      const rect = this._id('viewport-frame').getBoundingClientRect();
      this.hoverTip.innerHTML = html;
      this.hoverTip.classList.remove('is-hidden');
      this.hoverTip.style.left = `${Math.min(rect.width - 220, e.clientX - rect.left + 14)}px`;
      this.hoverTip.style.top = `${Math.max(10, e.clientY - rect.top - 10)}px`;
    }

    _restoreFromQuery() {
      const q = new URLSearchParams(location.search);
      if (q.has('year')) {
        const y = Number(q.get('year'));
        if (!Number.isNaN(y)) this.jumpToYear(y);
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
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.atlasApp = new HistoricalAtlasController();
  });
})();
