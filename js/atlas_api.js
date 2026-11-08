/**
 * AI-Native Public API, Custom Route & Deep-Link Restore Module (AI 原生接口 · 自定义多站路线 · 深链状态恢复)
 * Attaches resolvePlace, inspect, locate, multi-stop custom route visualization,
 * URL query-state restoration, and WebMCP tool registration onto HistoricalAtlasController.
 */
(function () {
  'use strict';

  // Bound at install time so this file may load before or after js/app.js.
  let HistoricalAtlasController = null;
  let escHtml = null;
  let SVG_ICONS = null;

  class AtlasApiMixin {
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
        // Embeds keep the place/person card at the top right like desktop, not as a bottom sheet.
        const isDesktop = typeof window === 'undefined' || window.innerWidth > 900 || Boolean(this.embed);
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
      const trackIds = Array.from(new Set(stops.map((s) => s.trackIdx || 0)));
      const isMultiTrack = trackIds.length > 1;

      let totalKm = 0;
      for (let i = 0; i < stops.length - 1; i++) {
        if ((stops[i].trackIdx || 0) === (stops[i + 1].trackIdx || 0)) {
          totalKm += this.projector.greatCircleKm(stops[i].coord, stops[i + 1].coord);
        }
      }
      const distStr =
        totalKm > 0
          ? isEn
            ? `~${Math.round(totalKm)} km`
            : `全程约 ${Math.round(totalKm)} km`
          : '';

      let stopsBodyHtml = '';
      if (!isMultiTrack) {
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
        stopsBodyHtml = `<div class="cr-stops-list">${pillsHtml}</div>`;
      } else {
        const palette = HistoricalAtlasController.PERSON_TRACK_PALETTE;
        const rowsHtml = trackIds
          .map((tId, tPos) => {
            const color = palette[tPos % palette.length];
            const tStops = stops
              .map((st, globalIdx) => ({ st, globalIdx }))
              .filter((item) => (item.st.trackIdx || 0) === tId);
            const pills = tStops
              .map(({ st, globalIdx }, sPos) => {
                const rawLbl = st.query || st.name;
                const baseLbl = isEn ? this.trTerm(rawLbl) : this._zh(rawLbl);
                const yrTag =
                  st.year < 0 ? (isEn ? `${-st.year} BCE` : `前${-st.year}`) : `${st.year}`;
                const lbl = isMultiYear && st.year !== undefined ? `${baseLbl} (${yrTag})` : baseLbl;
                const isCur = globalIdx === curIdx;
                const convCls = st.convergence ? ' is-converge' : '';
                const cls = `cr-stop-pill${isCur ? ' is-current' : ''}${convCls}`;
                return `<button type="button" class="${cls}" style="--track-color:${color}" data-cidx="${globalIdx}"><span class="cr-stop-num">${sPos + 1}</span><span>${escHtml(lbl)}</span></button>`;
              })
              .join('<span class="cr-stop-arrow">→</span>');
            return (
              `<div class="cr-track-row">` +
              `<span class="cr-track-dot" style="background:${color}"></span>` +
              `<div class="cr-stops-list">${pills}</div>` +
              `</div>`
            );
          })
          .join('');
        stopsBodyHtml = `<div class="cr-multitrack-wrap">${rowsHtml}</div>`;
      }

      this.journeyCard.classList.remove('is-hidden', 'is-collapsed');
      this.journeyCard.classList.add('is-custom-route');
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.add('has-active-journey');
      this._syncMobileOverlayState();

      this.journeyCard.innerHTML =
        `<div class="jc-top-bar">` +
        `<span class="jc-step-badge" style="background:${isMultiTrack ? '#bd2d22' : '#9e2a2b'}">${
          isMultiTrack
            ? isEn
              ? `${trackIds.length} Routes · ${stops.length} Stops`
              : `${trackIds.length} 路行迹 · 共 ${stops.length} 站`
            : isEn
              ? `Route · ${stops.length} Stops`
              : `行迹路线 · 共 ${stops.length} 站`
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
        `${stopsBodyHtml}` +
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
      if (!place || typeof place !== 'string') return [];
      const rawTracks = place
        .split(/\s*[;；]\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!rawTracks.length) return [];
      const yearList = this._parseYearList(year);
      const defaultYear = yearList.length ? yearList[0] : this.year;
      const isPerTrackYear =
        rawTracks.length > 1 && yearList.length === rawTracks.length;
      const out = [];
      let globalIdx = 0;
      rawTracks.forEach((trackStr, tIdx) => {
        const rawTokens = this._parsePlaceList(trackStr);
        rawTokens.forEach((tok, sIdx) => {
          let stopYear = isPerTrackYear
            ? yearList[tIdx]
            : yearList.length
              ? yearList[Math.min(globalIdx, yearList.length - 1)]
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
          out.push({
            place: stopPlace,
            year: stopYear,
            trackIdx: tIdx,
            trackStepIdx: sIdx,
            trackStepNum: sIdx + 1,
          });
          globalIdx++;
        });
      });
      return out;
    }

    resolvePlace(place, year = this.year) {
      if (!place || typeof place !== 'string') return null;
      const rawInput = place.trim();
      if (!rawInput) return null;
      const yr =
        year !== null && year !== '' && Number.isFinite(Number(year)) ? Number(year) : this.year;
      const targetDynIdx = this._findDynastyIndex(yr);
      const targetDyn = this.dynasties[targetDynIdx] || this.dynasties[0];
      const targetSnapKey = this._resolveSnapKey(targetDyn, yr);
      if (!this._resolvePlaceCache || this._resolvePlaceCacheSnapRef !== this.snapshots) {
        this._resolvePlaceCache = new Map();
        this._resolvePlaceCacheSnapRef = this.snapshots;
      }
      const snapFull = this.snapshots && this.snapshots.s_prc ? 1 : 0;
      const hasEn = this._hasEnDict() ? 1 : 0;
      const hasHant = this._hasZhHant() ? 1 : 0;
      const cacheKey = `${rawInput}\0${targetDyn ? targetDyn.key : ''}\0${targetSnapKey}\0${snapFull}\0${hasEn}\0${hasHant}`;
      if (this._resolvePlaceCache.has(cacheKey)) {
        const cached = this._resolvePlaceCache.get(cacheKey);
        return cached ? { ...cached } : null;
      }
      const res = this._resolvePlaceUncached(rawInput, yr, targetDyn, targetSnapKey);
      if (this._resolvePlaceCache.size > 4096) this._resolvePlaceCache.clear();
      this._resolvePlaceCache.set(cacheKey, res ? { ...res } : null);
      return res ? { ...res } : null;
    }

    _resolvePlaceUncached(rawInput, yr, targetDyn, targetSnapKey) {
      const rawHans = /[\u4e00-\u9fff]/.test(rawInput) ? this._toHans(rawInput) : rawInput;
      const raw = rawHans === '海南藏族自治州' ? '海南州' : rawHans;

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
          /(?:省|市|州|郡|府|道|路|县|国|关|城|盟|地区|(?:[一-龥]{1,6}族)*自治州|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区)$/,
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
              ...((p.eraNames || []).flatMap((en) => [en.zh, en.en])),
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
          const zhAliases = allowStrip
            ? (s.aliases || []).map((a) => String(a || '').toLowerCase()).filter(Boolean)
            : [];
          let hit = false;
          if (!isAsciiQuery) {
            hit = !allowStrip
              ? anc === q || mod === q
              : isExact
                ? anc === q ||
                  (!hasQueryParens && cleanAnc === q) ||
                  mod === q ||
                  (!hasQueryParens && cleanAnc === qStripped) ||
                  mod === qStripped ||
                  zhAliases.some(
                    (a) =>
                      a === q ||
                      (!hasQueryParens && stripParens(a) === q) ||
                      (!hasQueryParens && stripParens(a) === qStripped)
                  )
                : anc.includes(q) ||
                  mod.includes(q) ||
                  zhAliases.some((a) => a.includes(q)) ||
                  (!hasQueryParens &&
                    qStripped.length >= 2 &&
                    (anc.includes(qStripped) ||
                      mod.includes(qStripped) ||
                      zhAliases.some((a) => a.includes(qStripped))));
          } else {
            const ancEnRaw = this._enDict(s.ancient || '').toLowerCase();
            const cleanAncEn = stripParens(ancEnRaw);
            const ancParens = extractParens(ancEnRaw);
            const aliasEnCands = allowStrip
              ? (s.aliases || []).flatMap((a) => {
                  const tr = this._enDict(a || '').toLowerCase();
                  if (!tr || /[\u4e00-\u9fa5]/.test(tr)) return [];
                  return [
                    tr,
                    !hasQueryParens ? stripParens(tr) : '',
                    ...(!hasQueryParens && mode !== 'strict' ? extractParens(tr) : []),
                  ];
                })
              : [];
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
                    ...aliasEnCands,
                    cleanModEn,
                    !hasQueryParens ? modCityPart : '',
                  ].filter(Boolean)
                : [
                    ancEnRaw,
                    !hasQueryParens ? cleanAncEn : '',
                    ...(!hasQueryParens ? ancParens : []),
                    ...aliasEnCands,
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
            name: this._settlementAncient(s, yr),
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
          const stAliases = (st.aliases || []).map((a) => String(a || '').toLowerCase());
          const ancEn = (st.ancientEn || '').toLowerCase();
          const modEn = (st.modernEn || '').toLowerCase();
          const zhHit =
            anc === q ||
            mod === q ||
            stAliases.includes(q) ||
            anc.includes(q) ||
            mod.includes(q) ||
            stAliases.some((a) => a.includes(q));
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

      // 4. Milestones & Landmark Events (exact site match first so compound sites do not hijack single sites)
      for (const exactSite of [true, false]) {
        for (const d of orderedDynasties) {
          for (const m of d.milestones || []) {
            if (!m.coord) continue;
            const site = (m.site || '').toLowerCase();
            const head = (m.headline || '').toLowerCase();
            const enPair =
              this.enLocale &&
              this.enLocale.milestones &&
              this.enLocale.milestones[`${d.key}:${m.year}`];
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
            const zhHit = exactSite
              ? Boolean(site && (site === q || stripParens(site) === q))
              : (site && (site.includes(q) || q.includes(site))) || head.includes(q);
            const enHit =
              isAsciiQuery &&
              (exactSite
                ? Boolean(siteEn && (siteEn === q || foldAscii(siteEn) === qFold))
                : (siteEn &&
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
          const zhHit = exactSite
            ? Boolean(site && (site === q || stripParens(site) === q))
            : (site && (site.includes(q) || q.includes(site))) || zh.includes(q);
          const enHit =
            isAsciiQuery &&
            (exactSite
              ? Boolean(siteEn && (siteEn === q || foldAscii(siteEn) === qFold))
              : (siteEn &&
                  (siteEn.includes(q) ||
                    (qFold.length >= 4 && foldAscii(siteEn).includes(qFold)))) ||
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
      }

      // 5. Prefectures & Macro Regions across snapshots (preferring target dynasty snapshot)
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
            const hit = this.resolvePlace(sp, yr);
            if (hit) return hit;
          }
        }
      }

      return null;
    }

    _inspectCoord(cLng, cLat, d, snap, year = this.year) {
      const isEn = this.locale === 'en';
      const eraHit = this._resolveEraPlaceAt(cLng, cLat, d, snap);
      const modernProvince = eraHit.modernLoc.inModernChina
        ? isEn
          ? this.trTerm(eraHit.modernLoc.modernTitle)
          : this._zh(eraHit.modernLoc.modernTitle)
        : null;
      const rawNearAncient =
        eraHit.near && eraHit.near.s ? this._settlementAncient(eraHit.near.s, year) : '';
      const isCapAtYear =
        eraHit.near && eraHit.near.s ? this._isSettlementCapital(eraHit.near.s, year) : false;
      const nearestCity = eraHit.near
        ? {
            ancient: isEn ? this.trTerm(rawNearAncient) : this._zh(rawNearAncient),
            modern: isEn
              ? this.trModernCity(eraHit.near.s.modern || '')
              : this._zh(eraHit.near.s.modern || ''),
            distanceKm: Math.round(eraHit.near.km),
            ...(isCapAtYear ? { isCapital: true } : {}),
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
      const palette = HistoricalAtlasController.PERSON_TRACK_PALETTE;
      const trackIds = Array.from(new Set(stops.map((s) => s.trackIdx || 0)));
      const isMultiTrack = trackIds.length > 1;

      if (isMultiTrack) {
        for (let i = 0; i < stops.length; i++) {
          delete stops[i].convergence;
        }
        for (let i = 0; i < stops.length; i++) {
          for (let j = i + 1; j < stops.length; j++) {
            if ((stops[i].trackIdx || 0) === (stops[j].trackIdx || 0)) continue;
            const km = this.projector.greatCircleKm(stops[i].coord, stops[j].coord);
            if (km <= 45) {
              const colorI = palette[(stops[i].trackIdx || 0) % palette.length];
              const colorJ = palette[(stops[j].trackIdx || 0) % palette.length];
              stops[i].convergence = { peerIdx: j, peerColor: colorJ, km };
              stops[j].convergence = { peerIdx: i, peerColor: colorI, km };
            }
          }
        }
      }

      for (let tPos = 0; tPos < trackIds.length; tPos++) {
        const tId = trackIds[tPos];
        const routeColor = isMultiTrack ? palette[tPos % palette.length] : '#9e2a2b';
        const segments = [];
        for (let i = 0; i < stops.length - 1; i++) {
          if ((stops[i].trackIdx || 0) !== tId || (stops[i + 1].trackIdx || 0) !== tId) continue;
          const segInfo = this._buildJourneySegmentInfo(stops[i].coord, stops[i + 1].coord);
          if (segInfo) segments.push({ ...segInfo, toIdx: i + 1 });
        }
        const curStop = this.customRouteStopIdx >= 0 ? stops[this.customRouteStopIdx] : null;
        const trCurIdx =
          curStop && (curStop.trackIdx || 0) === tId ? this.customRouteStopIdx : -1;
        this._renderCartographicTrajectory(segments, trCurIdx, routeColor);
      }

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let prevSx = null;
      let prevSy = null;
      let prevBelow = false;

      const isMultiYear = new Set(stops.map((s) => s.year)).size > 1;
      const screenCoords = stops.map((st) => this.projector.toScreen(st.lng, st.lat));
      stops.forEach((st, idx) => {
        const [sx, sy] = screenCoords[idx];
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;

        const peerIdx = st.convergence ? st.convergence.peerIdx : undefined;
        const isCoLocatedPeer =
          isMultiTrack &&
          peerIdx !== undefined &&
          screenCoords[peerIdx] &&
          Math.hypot(sx - screenCoords[peerIdx][0], sy - screenCoords[peerIdx][1]) < 18;
        if (isCoLocatedPeer && idx > peerIdx) return;

        const tPos = trackIds.indexOf(st.trackIdx || 0);
        const routeColor = isMultiTrack ? palette[tPos % palette.length] : '#9e2a2b';
        const isTrackEnd =
          idx === 0 ||
          idx === stops.length - 1 ||
          (stops[idx - 1] && (stops[idx - 1].trackIdx || 0) !== (st.trackIdx || 0)) ||
          (stops[idx + 1] && (stops[idx + 1].trackIdx || 0) !== (st.trackIdx || 0));
        const isHighlighted =
          this.customRouteStopIdx >= 0
            ? idx === this.customRouteStopIdx || (isCoLocatedPeer && peerIdx === this.customRouteStopIdx)
            : isTrackEnd || Boolean(st.convergence);
        const convCls = isCoLocatedPeer ? ' is-intersect' : '';
        const g = this._svgNode(
          'g',
          {
            class: `journey-node ${isHighlighted ? 'is-current' : 'is-passed'}${convCls}`,
            'data-x': sx.toFixed(1),
            'data-y': sy.toFixed(1),
            'data-stop-idx': String(idx),
          },
          this.grpJourney
        );
        g.style.color = routeColor;

        if (isCoLocatedPeer) {
          const peerStop = stops[peerIdx];
          const c0 = routeColor;
          const c1 = st.convergence.peerColor || '#1d5a7b';
          const n0 = String(st.trackStepNum || idx + 1);
          const n1 = String((peerStop && peerStop.trackStepNum) || peerIdx + 1);
          if (isHighlighted) {
            this._svgNode(
              'rect',
              {
                class: 'jn-pulse jn-pulse-pill',
                x: '-15.5',
                y: '-10.5',
                width: '31',
                height: '21',
                rx: '10.5',
              },
              g
            );
          }
          this._svgNode(
            'rect',
            {
              class: 'jn-meet-pill',
              x: '-12.5',
              y: '-7.6',
              width: '25',
              height: '15.2',
              rx: '7.6',
            },
            g
          );
          this._svgNode('circle', { class: 'jn-meet-dot', cx: '-5.2', cy: '0', r: '5.5', fill: c0 }, g);
          const t0 = this._svgNode('text', { class: 'jn-num', x: '-5.2', y: '0.5' }, g);
          t0.textContent = n0;
          this._svgNode('circle', { class: 'jn-meet-dot', cx: '5.2', cy: '0', r: '5.5', fill: c1 }, g);
          const t1 = this._svgNode('text', { class: 'jn-num', x: '5.2', y: '0.5' }, g);
          t1.textContent = n1;
        } else {
          if (isHighlighted) {
            this._svgNode('circle', { class: 'jn-pulse', r: 11.2 }, g);
          }
          this._svgNode('circle', { class: 'jn-disc', r: isHighlighted ? 7.8 : 6.6 }, g);
          const numTxt = this._svgNode('text', { class: 'jn-num', y: '0.5' }, g);
          numTxt.textContent = String(isMultiTrack && st.trackStepNum ? st.trackStepNum : idx + 1);
        }

        let below = false;
        let nearestDist = Infinity;
        let nearestDy = 0;
        for (let k = 0; k < stops.length; k++) {
          if (k === idx || (isCoLocatedPeer && k === peerIdx)) continue;
          const [ksx, ksy] = screenCoords[k];
          const d = Math.hypot(sx - ksx, sy - ksy);
          if (d < nearestDist) {
            nearestDist = d;
            nearestDy = sy - ksy;
          }
        }
        if (nearestDist < 65) {
          below = nearestDy >= 0;
        } else if (prevSx !== null && Math.hypot(sx - prevSx, sy - prevSy) < 90) {
          below = !prevBelow;
        }
        prevSx = sx;
        prevSy = sy;
        prevBelow = below;

        const lblY = below ? '19.5' : isCoLocatedPeer ? '-11.8' : '-11';
        const lblTxt = this._svgNode(
          'text',
          { class: `jn-label${isCoLocatedPeer ? ' is-intersect-label' : ''}`, x: '0', y: lblY },
          g
        );
        const rawLbl = st.query || st.name;
        const isEn = this.locale === 'en';
        const baseLbl = isEn ? this.trTerm(rawLbl) : this._zh(rawLbl);
        const yrTag =
          st.year < 0 ? (isEn ? `${-st.year} BCE` : `前${-st.year}`) : `${st.year}`;
        lblTxt.textContent =
          isMultiYear && st.year !== undefined ? `${baseLbl} (${yrTag})` : baseLbl;
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
      // Embeds keep the place/person card at the top right like desktop, not as a bottom sheet.
      const isDesktop = typeof window === 'undefined' || window.innerWidth > 900 || Boolean(this.embed);
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
      const personProfiles = person ? this._resolvePersonProfiles(person) : [];
      const personProfile = personProfiles[0] || null;
      const multiState =
        personProfiles.length >= 2 ? this._buildPersonTracksAndEvents(personProfiles) : null;
      const personEvents = multiState
        ? multiState.events
        : personProfile
          ? this._collectPersonEvents(personProfile)
          : [];
      const stopIdx =
        stop !== undefined && stop !== null && stop !== '' && !Number.isNaN(Number(stop))
          ? Number(stop)
          : -1;
      const activePersonEv =
        personEvents.length > 0
          ? stopIdx >= 0 && stopIdx < personEvents.length
            ? personEvents[stopIdx]
            : (multiState && personEvents.find((e) => e.isSharedEncounter)) || personEvents[0]
          : null;
      const personPayload =
        multiState && personEvents.length > 0
          ? {
              key: multiState.profiles.map((p) => p.key).join(','),
              zh: multiState.profiles.map((p) => this._zh(p.zh)).join(' × '),
              en: multiState.profiles.map((p) => p.en).join(' × '),
              isMulti: true,
              profiles: multiState.profiles.map((p) => ({
                key: p.key,
                zh: this._zh(p.zh),
                en: p.en,
                span: p.span,
              })),
              stop: stopIdx,
              totalEvents: personEvents.length,
              sameTimeCount: multiState.sameTimeCount,
              encounters: multiState.intersectPlaces.map((ev) => ({
                index: ev.globalIdx,
                year: ev.year,
                dynasty: isEn ? this.dynastyName(ev.dynasty) : this._zh(ev.dynasty.title),
                site: isEn ? ev.siteEn || this.trTerm(ev.siteZh) : this._zh(ev.siteZh),
                modern: isEn
                  ? ev.modernEn || this.trModernCity(ev.modernZh || '')
                  : this._zh(ev.modernZh || ''),
                coord: ev.coord,
                participants: (ev.participants || []).map((pt) =>
                  isEn ? pt.personEn : this._zh(pt.personZh)
                ),
                text:
                  Array.isArray(ev.distinctNotes) && ev.distinctNotes.length > 1
                    ? ev.distinctNotes.map((pt) => ({
                        person: isEn ? pt.personEn : this._zh(pt.personZh),
                        text: isEn ? pt.textEn : this._zh(pt.textZh),
                      }))
                    : isEn
                      ? ev.textEn
                      : this._zh(ev.textZh),
              })),
              events: personEvents.map((ev, i) => ({
                index: i,
                year: ev.year,
                dynasty: isEn ? this.dynastyName(ev.dynasty) : this._zh(ev.dynasty.title),
                site: isEn ? ev.siteEn || this.trTerm(ev.siteZh) : this._zh(ev.siteZh),
                modern: isEn
                  ? ev.modernEn || this.trModernCity(ev.modernZh || '')
                  : this._zh(ev.modernZh || ''),
                coord: ev.coord,
                isSharedEncounter: Boolean(ev.isSharedEncounter),
                person: ev.isSharedEncounter
                  ? (ev.participants || [])
                      .map((pt) => (isEn ? pt.personEn : this._zh(pt.personZh)))
                      .join(' × ')
                  : isEn
                    ? ev.personEn
                    : this._zh(ev.personZh),
                text: isEn ? ev.textEn : this._zh(ev.textZh),
                ...(ev.quoteZh || ev.quoteEn
                  ? { quote: isEn ? ev.quoteEn || ev.quoteZh : this._zh(ev.quoteZh || ev.quoteEn) }
                  : {}),
              })),
            }
          : personProfile && personEvents.length > 0
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
        const isMultiTrack = placeTokens.some((t) => (t.trackIdx || 0) > 0);
        const trackCounters = {};
        for (let i = 0; i < placeTokens.length; i++) {
          const tok = placeTokens[i];
          const r = this.resolvePlace(tok.place, tok.year);
          if (!r) continue;
          const sdIdx = this._findDynastyIndex(tok.year);
          const sd = this.dynasties[sdIdx] || d;
          const sSnapKey = this._resolveSnapKey(sd, tok.year);
          const sSnap = this.snapshots[sSnapKey] || snap;
          const info = this._inspectCoord(r.lng, r.lat, sd, sSnap, tok.year);
          const prev = route.length ? route[route.length - 1] : null;
          const tId = tok.trackIdx || 0;
          const prevTrackId = prev && prev.trackIdx !== undefined ? prev.trackIdx : 0;
          const segKm =
            prev && prevTrackId === tId
              ? Math.round(this.projector.greatCircleKm(prev.coord, [r.lng, r.lat]))
              : 0;
          totalKm += segKm;
          trackCounters[tId] = (trackCounters[tId] || 0) + 1;
          const cleanPlace = /[<>]/.test(String(tok.place || '')) ? r.name : tok.place;
          route.push({
            step: route.length + 1,
            ...(isMultiTrack ? { trackIdx: tId, trackStep: trackCounters[tId] } : {}),
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
          const formattedPlace = isMultiTrack
            ? Object.values(
                route.reduce((acc, s) => {
                  const k = s.trackIdx || 0;
                  if (!acc[k]) acc[k] = [];
                  acc[k].push(s.place);
                  return acc;
                }, {})
              )
                .map((arr) => arr.join(','))
                .join(';')
            : route.map((s) => s.place).join(',');
          const params = new URLSearchParams();
          params.set('year', isMultiYear ? route.map((s) => s.year).join(',') : String(first.year));
          params.set('place', formattedPlace);
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
            place: formattedPlace,
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
        ? this._inspectCoord(cLng, cLat, d, snap, singleYear)
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
        const isStoryParam = Boolean(personProfile && personProfile.isStory && !multiState);
        params.set(isStoryParam ? 'event' : 'person', personPayload.key);
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
      const hasEnDict = this._hasEnDict();
      const needsEnDict =
        !hasEnDict && (this.locale === 'en' || (place && /[a-z]/i.test(String(place))));
      const needsZhHant =
        !this._hasZhHant() &&
        (this.locale === 'zh-tw' ||
          (place && /[\u4e00-\u9fff]/.test(String(place))) ||
          (year && /[\u4e00-\u9fff]/.test(String(year))));
      const needsLoreDetail = !this._isLoreDetailLoaded();
      if (!this._fullSnapshotsLoaded || needsEnDict || needsZhHant || needsLoreDetail) {
        Promise.all([
          this._fullSnapshotsLoaded ? Promise.resolve() : this._ensureFullSnapshots(),
          needsEnDict ? this._ensureEnglishLocale() : Promise.resolve(),
          needsZhHant ? this._ensureZhHant() : Promise.resolve(),
          needsLoreDetail ? this._ensureLoreDetail() : Promise.resolve(),
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
            return {
              query: cleanQuery,
              year: tok.year,
              trackIdx: tok.trackIdx || 0,
              trackStepIdx: tok.trackStepIdx || 0,
              trackStepNum: tok.trackStepNum || 1,
              ...r,
            };
          })
          .filter(Boolean);
        if (stops.length >= 2) {
          const trackCounters = {};
          stops.forEach((st) => {
            const tId = st.trackIdx || 0;
            const n = (trackCounters[tId] || 0) + 1;
            trackCounters[tId] = n;
            st.trackStepIdx = n - 1;
            st.trackStepNum = n;
          });
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
        // Embeds keep the place/person card at the top right like desktop, not as a bottom sheet.
        const isDesktop = typeof window === 'undefined' || window.innerWidth > 900 || Boolean(this.embed);
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
      if (
        q.has('year') ||
        q.has('place') ||
        (q.has('lng') && q.has('lat')) ||
        q.has('person') ||
        q.has('event') ||
        q.has('journey')
      ) {
        this.lastRenderedSnap = null;
        if (this.grpGhostDiff) this.grpGhostDiff.innerHTML = '';
      }
      const queryBag = `${q.get('place') || ''} ${q.get('hover') || ''} ${q.get('q') || ''} ${q.get('person') || ''} ${q.get('event') || ''} ${q.get('journey') || ''} ${q.get('year') || ''}`;
      const needsEn = this.locale === 'en' || /[a-z]/i.test(queryBag);
      const needsHant = this.locale === 'zh-tw' || /[\u4e00-\u9fff]/.test(queryBag);
      const afterFullSnapshots = (fn, delayMs = 80) => {
        const run = () => setTimeout(fn, delayMs);
        const tasks = [];
        if (!this._fullSnapshotsLoaded && typeof window !== 'undefined') {
          tasks.push(this._ensureFullSnapshots());
        }
        if (!this._isLoreDetailLoaded() && typeof window !== 'undefined') {
          tasks.push(this._ensureLoreDetail());
        }
        if (needsEn && typeof window !== 'undefined' && !this._hasEnDict()) {
          tasks.push(this._ensureEnglishLocale());
        }
        if (needsHant && typeof window !== 'undefined' && !this._hasZhHant()) {
          tasks.push(this._ensureZhHant());
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
          const pinyinReady = this._canMatchEventPinyin(this._eventPinyinQuery(rawQ))
            ? this._ensureEventPinyin()
            : Promise.resolve();
          afterFullSnapshots(() => {
            pinyinReady.then(() => {
              if (inp && inp.value.trim() !== rawQ) return;
              const hits = this._queryQuickSearch(rawQ);
              if (hits && hits.length) this._selectSearchResult(hits[0]);
            });
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
        let traceParts = null;
        if (q.has('trace')) {
          const parts = (q.get('trace') || '').split(',').map(Number);
          if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
            traceParts = parts;
            this.activeTrace = [parts[0], parts[1]];
          }
        }
        if (q.has('year')) {
          const rawYr = q.get('year') || '';
          const yList = this._parseYearList(rawYr);
          if (yList.length) {
            this.jumpToYear(yList[0]);
          } else if (/[\u4e00-\u9fff]/.test(rawYr) && !this._hasZhHant()) {
            this._ensureZhHant().then(() => {
              const retryList = this._parseYearList(rawYr);
              if (retryList.length) this.jumpToYear(retryList[0]);
            });
          }
        }
        if (traceParts) {
          afterFullSnapshots(() => {
            this.openGenealogyAt(traceParts[0], traceParts[1]);
          }, 80);
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
        q.has('event') ||
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
              person: q.get('person') || q.get('event') || q.get('journey') || undefined,
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
          if (this._deferredPrefectureSnap) {
            const prefChk = this._id('chk-prefectures');
            if (prefChk) prefChk.checked = true;
            if (this.grpPrefectures && this.grpPrefectures.classList) {
              this.grpPrefectures.classList.remove('is-hidden');
            }
            this._materializeDeferredPrefectures();
            this._rescaleSvgTypography();
          }
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
            this._setHoveredPrefecture(el);
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
        setTimeout(() => this._openChallenge({ preferCurrentDynasty: q.has('year') }), 120);
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
      if (q.has('event')) {
        const rawEv = (q.get('event') || '').trim();
        const evIdx = q.has('stop') ? Number(q.get('stop')) : -1;
        if (rawEv) {
          afterFullSnapshots(() => {
            this.openPersonChronicle(rawEv, Number.isNaN(evIdx) ? -1 : evIdx);
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
      if (q.has('polity')) {
        const pKey = (q.get('polity') || '').trim();
        if (pKey) afterFullSnapshots(() => this.openPolityByKey(pKey), 80);
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
      this._armUrlSync(
        ['year', 'polity', 'person', 'event', 'journey', 'trace', 'place', 'lng', 'q'].some((k) => q.has(k))
      );
    }

    _registerWebMcpTools() {
      if (typeof navigator === 'undefined' || !navigator.modelContext) return [];
      const mc = navigator.modelContext;
      const applyOptionalLang = (lang) => {
        if (!lang) return;
        const norm = String(lang).toLowerCase();
        const nextLoc =
          norm === 'en' ? 'en' : /^(zh-tw|zh_tw|tw|hk|zh-hk|zh-hant|hant)$/.test(norm) ? 'zh-tw' : 'zh';
        if (nextLoc !== this.locale) {
          this.locale = nextLoc;
          this._syncUrlLangParam();
          this.applyLocale();
        }
      };
      const tools = [
        {
          name: 'jiangshan_locate',
          description:
            'Locate a historical Chinese place, poem site, battle, or multi-stop route on the Jiangshan Historical Atlas (403 BCE – 2026 CE), move the map camera, open the 2,400-year administrative genealogy card, and return structured historical context.',
          inputSchema: {
            type: 'object',
            properties: {
              year: {
                type: ['integer', 'string'],
                description:
                  'Historical year (-403 to 2026, negative for BCE, no year 0) or comma-separated years for multi-year routes.',
              },
              place: {
                type: 'string',
                description:
                  'Single canonical ancient/modern place name, comma-separated route stops, or semicolon-separated converging routes (e.g. "许昌,江陵,赤壁;柴桑,樊口,赤壁") in Chinese, English, or Pinyin.',
              },
              zoom: {
                type: 'number',
                description: 'Optional zoom level override (1.0 to 8.0).',
              },
              lang: {
                type: 'string',
                enum: ['zh', 'zh-tw', 'en'],
                description: 'Optional UI and response language.',
              },
            },
            required: ['year', 'place'],
          },
          execute: async (args = {}) => {
            applyOptionalLang(args.lang);
            await this._ensureFullSnapshots();
            await this._ensureLoreDetail();
            if (this.locale === 'en') await this._ensureEnglishLocale();
            if (this.locale === 'zh-tw' || !this._hasZhHant()) await this._ensureZhHant();
            return this.locate({
              year: args.year,
              place: args.place,
              zoom: args.zoom,
            });
          },
        },
        {
          name: 'jiangshan_inspect',
          description:
            'Read-only historical geography query returning reigning monarch/era, controlling regime (polity), macro-region (dao/lu/province), prefecture (jun/zhou/fu), modern province/city, 2,400-year city/pass lore, or person chronicle events without moving the camera.',
          inputSchema: {
            type: 'object',
            properties: {
              year: {
                type: ['integer', 'string'],
                description: 'Historical year (-403 to 2026) or comma-separated years.',
              },
              place: {
                type: 'string',
                description:
                  'Optional ancient/modern place name, comma-separated route stops, or semicolon-separated converging routes (e.g. "许昌,江陵,赤壁;柴桑,樊口,赤壁").',
              },
              person: {
                type: 'string',
                description:
                  'Optional single historical figure or comma-separated 2–4 figures (e.g. "libai,dufu,gaoshi" or "caocao,liubei,sunquan").',
              },
              stop: {
                type: 'integer',
                description: 'Optional 0-based event stop index for person chronicle.',
              },
              lang: {
                type: 'string',
                enum: ['zh', 'zh-tw', 'en'],
                description: 'Optional response language.',
              },
            },
          },
          execute: async (args = {}) => {
            applyOptionalLang(args.lang);
            await this._ensureFullSnapshots();
            await this._ensureLoreDetail();
            if (this.locale === 'en') await this._ensureEnglishLocale();
            if (this.locale === 'zh-tw' || !this._hasZhHant()) await this._ensureZhHant();
            return this.inspect({
              year: args.year,
              place: args.place,
              person: args.person,
              stop: args.stop,
            });
          },
        },
        {
          name: 'jiangshan_open_person',
          description:
            'Open the spatio-temporal life & poetry chronicle (点人溯事) on the map for 1–4 Chinese historical figures or monarchs and return their geocoded life stops and shared historical encounters.',
          inputSchema: {
            type: 'object',
            properties: {
              person: {
                type: 'string',
                description:
                  'Single historical figure or comma-separated 2–4 figures (e.g. "libai,dufu,gaoshi" or "李白,杜甫,高适") in Chinese, English, or Pinyin.',
              },
              stop: {
                type: 'integer',
                description: 'Optional 0-based stop index (-1 for full route overview).',
              },
              lang: {
                type: 'string',
                enum: ['zh', 'zh-tw', 'en'],
                description: 'Optional UI and response language.',
              },
            },
            required: ['person'],
          },
          execute: async (args = {}) => {
            applyOptionalLang(args.lang);
            await this._ensureFullSnapshots();
            await this._ensureLoreDetail();
            if (this.locale === 'en') await this._ensureEnglishLocale();
            if (this.locale === 'zh-tw' || !this._hasZhHant()) await this._ensureZhHant();
            const stopIdx = typeof args.stop === 'number' ? args.stop : -1;
            this.openPersonChronicle(args.person, stopIdx);
            return this.inspect({
              person: args.person,
              stop: stopIdx >= 0 ? stopIdx : undefined,
            });
          },
        },
      ];
      try {
        if (typeof mc.registerTool === 'function') {
          for (const t of tools) mc.registerTool(t);
        } else if (typeof mc.provideContext === 'function') {
          mc.provideContext({ tools });
        }
      } catch (_) {}
      return tools;
    }
  }

  function install(Ctrl) {
    HistoricalAtlasController = Ctrl;
    escHtml = Ctrl._escHtml;
    SVG_ICONS = Ctrl._svgIcons;
    Ctrl._extendPrototype(AtlasApiMixin);
  }

  if (typeof window === 'undefined') return;
  const readyCtrl = window.HistoricalAtlasController;
  if (readyCtrl && typeof readyCtrl._extendPrototype === 'function') {
    install(readyCtrl);
  } else {
    (window.__ATLAS_MIXINS = window.__ATLAS_MIXINS || []).push(install);
  }
})();
