/**
 * Person Chronicles & Historical Journeys Module (点人溯事 · 青史行迹)
 * Attaches multi-person trajectory comparison, custom route trajectory drawing,
 * and historical journey chronicle playback methods onto HistoricalAtlasController.
 */
(function () {
  'use strict';

  // Bound at install time so this file may load before or after js/app.js.
  let HistoricalAtlasController = null;
  let MercatorProjector = null;
  let escHtml = null;
  let SVG_ICONS = null;

  class AtlasPersonMixin {
    _clearActivePerson() {
      const hadTimer = Boolean(this.personTimer);
      if (this.personTimer) {
        clearInterval(this.personTimer);
        this.personTimer = null;
      }
      if (hadTimer) {
        if (typeof this.silenceNarrator === 'function') this.silenceNarrator();
        this._updateAutoplayUi();
      }
      if (!this.activePerson) return;
      this.activePerson = null;
      this.activePersonEventIdx = -1;
      this.personSharedOnly = false;
      this._scheduleUrlSync();
      if (this.embed) this._syncEmbedBadge();
      this._hidePersonFooter();
      this._lastPersonPinZoom = 0;
      this._lastPersonCardKey = null;
      if (this.grpJourney && !this.activeCustomRoute) {
        this.grpJourney.innerHTML = '';
      }
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.remove('has-active-person', 'has-person-overview-lines');
      const kickerEl = this._id('txt-genealogy-kicker');
      if (kickerEl) {
        kickerEl.textContent = this.uiStr('trace_kicker', '点地溯源 · 古今政区沿革');
      }
      this._syncImmersivePaneState();
      this._syncDocumentSeoMeta();
    }

    // `unknown` ('birth' | 'death' | 'both') marks years the sources do not record: the number
    // stays in the data to place the person on the timeline, but is shown as a question mark.
    _formatPersonSpan(span, isAdhoc = false, unknown = '') {
      if (!span || isAdhoc || span.length < 2) return '';
      const [y0, y1] = span;
      if (y0 === undefined || y1 === undefined) return '';
      const noBirth = unknown === 'birth' || unknown === 'both';
      const noDeath = unknown === 'death' || unknown === 'both';
      if (this.locale === 'en') {
        const b = noBirth ? '?' : Math.abs(y0);
        const d = noDeath ? '?' : Math.abs(y1);
        if (y0 <= 0 && y1 <= 0) return ` (${b}–${d} BCE)`;
        if (y0 <= 0 && y1 > 0) return ` (${b}${noBirth ? '' : ' BCE'} – ${d}${noDeath ? '' : ' CE'})`;
        return ` (${b}–${d})`;
      }
      const fZh = (y) => (y <= 0 ? `前${-y}` : `${y}`);
      return `（${noBirth ? '？' : fZh(y0)}—${noDeath ? '？' : fZh(y1)}）`;
    }

    _tailorPersonEvent(profile, tokens, d, year, rawSite, rawSiteEn, rawCoord, textZh, textEn, src) {
      let clausesZh = String(textZh || '').split(/；/);
      let clausesEn = String(textEn || '').split(/;\s*/);
      let matchedIdxs = [];
      if (clausesZh.length > 1) {
        matchedIdxs = clausesZh
          .map((c, i) => (tokens.some((t) => c.includes(t)) ? i : -1))
          .filter((i) => i >= 0);
      } else if (src === 'M' && rawSite.includes('·') && textZh.includes('，')) {
        const commaParts = textZh.split(/，/);
        const mComma = commaParts
          .map((c, i) => (tokens.some((t) => c.includes(t)) ? i : -1))
          .filter((i) => i >= 0);
        const siteParts = rawSite.split(/\s*·\s*/);
        const otherMentionsOtherPersonOrSite = commaParts.some(
          (c, idx) =>
            !mComma.includes(idx) &&
            /^(?:汉高祖刘邦|楚汉两军|常遇春|徐达|北元|张献忠)/.test(c.trim()) &&
            siteParts.some((sp) =>
              sp
                .split(/[（）()]/)
                .filter((part) => part.length >= 2)
                .some((part) => c.includes(part))
            )
        );
        if (mComma.length > 0 && mComma.length < commaParts.length && otherMentionsOtherPersonOrSite) {
          clausesZh = commaParts;
          clausesEn = String(textEn || '').split(/;\s*|,\s*(?=[A-Z])/);
          matchedIdxs = mComma;
        }
      }
      // Keep full milestone text if all clauses belong to this monarch (e.g. Yongle 1407/1409)
      // or if slicing would leave a headless relative-year fragment ("次年…", "同年…").
      const candZh =
        matchedIdxs.length > 0 && matchedIdxs.length < clausesZh.length
          ? matchedIdxs.map((i) => clausesZh[i].trim()).join('；')
          : '';
      if (
        candZh &&
        !/^(?:次年|同年|旋即)/.test(candZh) &&
        !(profile.key === 'zhudi' && year === 1407)
      ) {
        textZh = candZh;
        if (clausesEn.length === clausesZh.length) {
          const candEn = matchedIdxs.map((i) => clausesEn[i].trim()).join('; ');
          const enTokens = String(profile.en || '')
            .split(/\s+/)
            .filter((w) => w.length >= 3 && !/^(?:Emperor|of|the)$/i.test(w));
          if (!enTokens.length || enTokens.some((w) => candEn.includes(w))) {
            textEn = candEn.charAt(0).toUpperCase() + candEn.slice(1);
          }
        }
      }

      let chosenSite = String(rawSite || '').trim();
      let chosenCoord = rawCoord;
      if (/[·→]/.test(chosenSite)) {
        const cleanRawSite = chosenSite.replace(/（[^）]*[·/][^）]*）$/, '');
        const siteParts = cleanRawSite
          .split(/\s*[·→]\s*/)
          .map((s) => s.trim())
          .filter((s) => Boolean(s) && s !== '全国各省');
        if (siteParts.length === 1) {
          chosenSite = siteParts[0];
        } else if (siteParts.length > 1) {
          const toCorePlace = (sp) => {
            const b = this._stripPromptParenthetical(sp);
            const stripped = b.replace(/(?:郡|州|府|城|关)$/, '');
            return stripped.length >= 2 ? stripped : b;
          };
          const subClauses = textZh.split(/[；，]/);
          const personSubClause = subClauses
            .filter((c) => tokens.some((t) => c.includes(t)))
            .join('，');
          let hitPart = personSubClause
            ? siteParts.find((sp) => {
                const bare = toCorePlace(sp);
                return (
                  (bare.length >= 2 && personSubClause.includes(bare)) ||
                  (bare.length === 1 && personSubClause.includes(bare + '城')) ||
                  (sp.length >= 4 && personSubClause.includes(sp.slice(-3)))
                );
              })
            : null;
          if (!hitPart) {
            hitPart = siteParts.find((sp) => {
              const bare = toCorePlace(sp);
              return bare.length >= 2 && textZh.includes(bare);
            });
          }
          if (!hitPart && matchedIdxs.length > 0 && matchedIdxs.length < clausesZh.length) {
            const unmatchedText = clausesZh.filter((_, i) => !matchedIdxs.includes(i)).join('；');
            const remaining = siteParts.filter((sp) => {
              const subTokens = sp
                .split(/[（）()]/)
                .map((p) => toCorePlace(p.trim()))
                .filter((p) => p.length >= 2);
              return !subTokens.some((st) => unmatchedText.includes(st));
            });
            if (remaining.length === 1) hitPart = remaining[0];
          }
          if (!hitPart && clausesZh.length === siteParts.length && matchedIdxs.length === 1) {
            hitPart = siteParts[matchedIdxs[0]];
          }
          if (!hitPart) {
            let bestDist = Infinity;
            for (const sp of siteParts) {
              const r = this.resolvePlace(this._stripPromptParenthetical(sp), year, d);
              if (r && r.kind !== 'event_site') {
                const dist = this.projector.greatCircleKm(rawCoord, [r.lng, r.lat]);
                if (dist < bestDist) {
                  bestDist = dist;
                  hitPart = sp;
                }
              }
            }
            if (!hitPart) hitPart = siteParts[0];
          }
          chosenSite = hitPart;
          const bareChosen = this._stripPromptParenthetical(chosenSite);
          const fallbackCoords = {
            狄道: [104.62, 35.58],
            湖县: [110.68, 34.52],
            马陵: [115.42, 36.12],
            珠崖: [110.33, 20.03],
            喜峰口: [118.33, 40.42],
            京师广渠门: [116.43, 39.89],
            虎门: [113.67, 22.82],
            六盘山: [106.2, 35.65],
          };
          if (fallbackCoords[bareChosen]) {
            chosenCoord = fallbackCoords[bareChosen];
          } else {
            const resolved = this.resolvePlace(bareChosen, year, d);
            if (resolved && resolved.kind !== 'event' && resolved.kind !== 'event_site') {
              chosenCoord = [resolved.lng, resolved.lat];
            }
          }
        }
      }
      let splitEnCandidate = '';
      if (chosenSite !== rawSite && rawSiteEn && !/[\u4e00-\u9fff]/.test(rawSiteEn)) {
        const cleanRawSite = String(rawSite || '')
          .trim()
          .replace(/（[^）]*[·/][^）]*）$/, '');
        const zhParts = cleanRawSite
          .split(/\s*[·→]\s*/)
          .map((s) => s.trim())
          .filter(Boolean);
        const enParts = String(rawSiteEn)
          .replace(/\([^)]*[·/][^)]*\)$/, '')
          .split(/\s*(?:·|&|→)\s*/)
          .map((s) => s.trim())
          .filter(Boolean);
        const idx = zhParts.indexOf(chosenSite);
        if (idx >= 0 && enParts.length === zhParts.length) {
          splitEnCandidate = enParts[idx];
        }
      }
      const bareChosenSite = this._stripPromptParenthetical(chosenSite);
      const candList = [
        chosenSite === rawSite ? rawSiteEn : '',
        this._enDict(chosenSite),
        this._enDict(bareChosenSite),
        d && (d.key === 'roc' || d.key === 'prc') ? this._enModernCity(bareChosenSite) : '',
        splitEnCandidate,
      ];
      const chosenSiteEn =
        candList.find((c) => c && !/[\u4e00-\u9fff]/.test(c)) || this._enDict(bareChosenSite);
      return {
        siteZh: chosenSite,
        siteEn: chosenSiteEn,
        coord: chosenCoord,
        textZh,
        textEn,
      };
    }

    _collectPersonEvents(profile, opts = {}) {
      if (!profile) return [];
      const isMulti = Boolean(opts && opts.isMulti);
      const peerKeys = Array.isArray(opts && opts.peerKeys) ? opts.peerKeys : [];
      const canCacheSolo = !isMulti && !peerKeys.length && typeof profile === 'object';
      const snapRef = canCacheSolo ? this.snapshots : null;
      const snapFull = Boolean(snapRef && snapRef.s_prc);
      const hasEn = canCacheSolo ? this._hasEnDict() : false;
      const enRef = canCacheSolo ? this.enLocale : null;
      const loreLoaded = canCacheSolo ? this._isLoreDetailLoaded() : false;
      if (canCacheSolo) {
        if (!this._soloPersonEventsCache) this._soloPersonEventsCache = new WeakMap();
        const hit = this._soloPersonEventsCache.get(profile);
        if (
          hit &&
          hit.snapRef === snapRef &&
          hit.snapFull === snapFull &&
          hit.hasEn === hasEn &&
          hit.enRef === enRef &&
          hit.loreLoaded === loreLoaded
        ) {
          return hit.events.map((ev) => ({ ...ev }));
        }
      }
      const matchesPersonsTag = (item) =>
        isMulti &&
        !profile.isRelic &&
        !profile.isStory &&
        Array.isArray(item && item.persons) &&
        item.persons.includes(profile.key) &&
        item.persons.some((pk) => pk !== profile.key && peerKeys.includes(pk));
      if ((profile.isRelic || profile.isStory) && Array.isArray(profile.stops)) {
        const campMap = new Map(
          Array.isArray(profile.camps) ? profile.camps.map((c) => [c.key, c]) : []
        );
        const out = profile.stops.map((st, sIdx) => {
          const dyn =
            (st.dynastyKey && this.dynasties.find((d) => d.key === st.dynastyKey)) ||
            this.dynasties[this._findDynastyIndex(st.year)] ||
            this.dynasties[0];
          const campInfo = st.camp ? campMap.get(st.camp) : null;
          const vecCampInfo = st.campVector ? campMap.get(st.campVector) : campInfo;
          const prongs = Array.isArray(st.prongs)
            ? st.prongs.map((pr) => {
                const pCamp = pr.camp ? campMap.get(pr.camp) : campInfo;
                return {
                  ...pr,
                  color: pr.color || (pCamp && pCamp.color) || '#b53826',
                };
              })
            : null;
          return {
            src: 'J',
            year: st.year,
            month: st.month || 6 + sIdx * 0.01,
            subEraZh: st.subEraZh || '',
            subEraEn: st.subEraEn || '',
            actZh: st.actZh || '',
            actEn: st.actEn || '',
            camp: st.camp || '',
            campColor: (campInfo && campInfo.color) || '',
            campCalmColor: (campInfo && campInfo.calmColor) || '',
            vectorColor: (vecCampInfo && vecCampInfo.color) || '',
            fromStopIdx: typeof st.fromStopIdx === 'number' ? st.fromStopIdx : -1,
            fromLabelZh: st.fromLabelZh || '',
            fromLabelEn: st.fromLabelEn || '',
            prongs,
            actors: Array.isArray(st.actors)
              ? st.actors.map((ac) => {
                  const aCamp = ac.camp ? campMap.get(ac.camp) : null;
                  return {
                    ...ac,
                    color: ac.color || (aCamp && aCamp.color) || '',
                  };
                })
              : [],
            coord: st.coord,
            fromCoord: st.fromCoord || null,
            via: st.via || null,
            prevStopCoord: sIdx > 0 ? profile.stops[sIdx - 1].coord : null,
            quoteZh: st.quoteZh || '',
            quoteEn: st.quoteEn || '',
            dynasty: dyn,
            siteZh: st.ancientZh,
            siteEn: st.ancientEn || this._enDict(st.ancientZh),
            modernZh: st.modernZh || '',
            modernEn: st.modernEn || '',
            textZh: `${st.titleZh}：${st.descZh}`,
            textEn: `${st.titleEn}: ${st.descEn}`,
            isMapChange: Boolean(st.isMapChange),
            byPersonsTag: false,
            journeyStopIdx: sIdx,
            prio: 3,
          };
        });
        if (canCacheSolo && this._soloPersonEventsCache) {
          this._soloPersonEventsCache.set(profile, {
            snapRef,
            snapFull,
            hasEn,
            enRef,
            loreLoaded,
            events: out.map((ev) => ({ ...ev })),
          });
        }
        return out;
      }
      const tokens =
        profile.isRelic || profile.isStory
          ? []
          : Array.from(new Set([profile.zh, ...(profile.tokens || [])].filter(Boolean)));
      const [minY, maxY] = profile.span || [-403, 2026];
      const raw = [];

      const journeyStops = Array.isArray(profile.stops)
        ? profile.stops
        : profile.journeyKey
          ? (
              HistoricalAtlasController.HISTORICAL_JOURNEYS.find(
                (item) => item.key === profile.journeyKey
              ) || {}
            ).stops
          : null;
      const hasJourneyStops = Array.isArray(journeyStops) && journeyStops.length > 0;
      const jMinY = hasJourneyStops ? Math.min(...journeyStops.map((s) => s.year)) : Infinity;
      const jMaxY = hasJourneyStops ? Math.max(...journeyStops.map((s) => s.year)) : -Infinity;
      if (hasJourneyStops) {
        journeyStops.forEach((st, sIdx) => {
          const dyn =
            (st.dynastyKey && this.dynasties.find((d) => d.key === st.dynastyKey)) ||
            this.dynasties[this._findDynastyIndex(st.year)] ||
            this.dynasties[0];
          raw.push({
            src: 'J',
            year: st.year,
            month: st.month || 6 + sIdx * 0.01,
            coord: st.coord,
            fromCoord: st.fromCoord || null,
            via: st.via || null,
            prevStopCoord: sIdx > 0 ? journeyStops[sIdx - 1].coord : null,
            quoteZh: st.quoteZh || '',
            quoteEn: st.quoteEn || '',
            dynasty: dyn,
            siteZh: st.ancientZh,
            siteEn: st.ancientEn || this._enDict(st.ancientZh),
            modernZh: st.modernZh || '',
            modernEn: st.modernEn || '',
            textZh: `${st.titleZh}：${st.descZh}`,
            textEn: `${st.titleEn}: ${st.descEn}`,
            isMapChange: Boolean(st.isMapChange),
            byPersonsTag: matchesPersonsTag(st),
            journeyStopIdx: sIdx,
            prio: 3,
          });
        });
      }
      if (isMulti && !profile.isRelic) {
        for (const j of HistoricalAtlasController.HISTORICAL_JOURNEYS) {
          if (j.key === profile.key || j.key === profile.journeyKey) continue;
          (j.stops || []).forEach((st, sIdx) => {
            if (!st.coord || st.year < minY - 2 || st.year > maxY + 3) return;
            if (!matchesPersonsTag(st)) return;
            const dyn =
              this.dynasties[this._findDynastyIndex(st.year)] || this.dynasties[0];
            raw.push({
              src: 'J_CO',
              year: st.year,
              month: st.month || 6 + sIdx * 0.01,
              coord: st.coord,
              quoteZh: st.quoteZh || '',
              quoteEn: st.quoteEn || '',
              dynasty: dyn,
              siteZh: st.ancientZh,
              siteEn: st.ancientEn || this._enDict(st.ancientZh),
              modernZh: st.modernZh || '',
              modernEn: st.modernEn || '',
              textZh: `${st.titleZh}：${st.descZh}`,
              textEn: `${st.titleEn}: ${st.descEn}`,
              isMapChange: Boolean(st.isMapChange),
              byPersonsTag: true,
              prio: 2.5,
            });
          });
        }
      }

      const isBackdropOnlyMention = (txt) => {
        if (!tokens.length) return false;
        const backdropRe = /(?:崩后|卒后|死后|遇弑后|没后|代晋建宋后)/;
        if (!backdropRe.test(txt)) return false;
        const cleaned = tokens.reduce((acc, tok) => {
          if (!acc.includes(tok)) return acc;
          const escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return acc.replace(
            new RegExp(escaped + '[^，；。]{0,4}(?:崩后|卒后|死后|遇弑后|没后|代晋建宋后)', 'g'),
            ''
          );
        }, String(txt || ''));
        return !tokens.some((tok) => cleaned.includes(tok));
      };

      for (const d of this.dynasties) {
        for (const m of d.milestones || []) {
          if (!m.coord) continue;
          const byTag = matchesPersonsTag(m);
          if (!byTag && (m.year < minY || m.year > maxY)) continue;
          if (byTag && (m.year < minY - 2 || m.year > maxY + 3)) continue;
          const byToken =
            tokens.some((tok) => m.headline.includes(tok)) && !isBackdropOnlyMention(m.headline);
          if (!byToken && !byTag) continue;
          if (hasJourneyStops && m.year >= jMinY && m.year <= jMaxY && !byTag) {
            const jHit = raw.find((r) => r.src === 'J' && r.year === m.year);
            if (jHit) {
              if (this._isPhaseChangeYear(d, m.year)) jHit.isMapChange = true;
              if (!jHit.milestone) jHit.milestone = m;
            }
            continue;
          }
          const rawSite = m.site || d.seat || '';
          if (profile.key === 'liubang' && m.year === -207 && rawSite.startsWith('巨鹿')) continue;
          if (profile.key === 'sunquan' && m.year === 230 && rawSite.startsWith('夷洲')) continue;
          const mKey = `${d.key}:${m.year}`;
          const mHit = this.enLocale.milestones && this.enLocale.milestones[mKey];
          const rawSiteEn =
            m.siteEn ||
            (Array.isArray(mHit) && mHit[1]) ||
            (d.key === 'roc' || d.key === 'prc'
              ? this._enModernCity(rawSite)
              : this._enDict(rawSite));
          const tailored = this._tailorPersonEvent(
            profile,
            byTag && !/[·→]/.test(rawSite) ? [] : tokens,
            d,
            m.year,
            rawSite,
            rawSiteEn,
            m.coord,
            m.headline,
            this._enMilestoneHeadline(d, m),
            'M'
          );
          raw.push({
            src: 'M',
            year: m.year,
            month:
              m.month ||
              (m.year === 208 && rawSite.includes('赤壁')
                ? 11.0
                : m.year === 219 && tailored.siteZh.includes('麦城')
                  ? 11.5
                  : (isMulti && m.year === 645 && rawSite.includes('辽东')) ||
                      (m.year === 219 && tailored.siteZh.includes('汉中'))
                    ? 7.5
                    : 6.5),
            coord: tailored.coord,
            dynasty: d,
            siteZh: tailored.siteZh,
            siteEn: tailored.siteEn,
            modernZh: '',
            modernEn: '',
            textZh: tailored.textZh,
            textEn: tailored.textEn,
            isMapChange: this._isPhaseChangeYear(d, m.year),
            byPersonsTag: byTag,
            milestone: m,
            prio: 2,
          });
        }
      }

      for (const lm of HistoricalAtlasController.PLACE_LANDMARK_EVENTS) {
        if (!lm.coord || !lm.zh) continue;
        const byTag = matchesPersonsTag(lm);
        if (!byTag && (lm.year < minY || lm.year > maxY)) continue;
        if (byTag && (lm.year < minY - 2 || lm.year > maxY + 3)) continue;
        const byToken = tokens.some((tok) => lm.zh.includes(tok)) && !isBackdropOnlyMention(lm.zh);
        if (!byToken && !byTag) continue;
        if (hasJourneyStops && lm.year >= jMinY && lm.year <= jMaxY && !byTag) continue;
        const d =
          this.dynasties.find((dyn) => dyn.key === lm.dynastyKey) ||
          this.dynasties[this._findDynastyIndex(lm.year)] ||
          this.dynasties[0];
        const rawSite = lm.site || '';
        const rawSiteEn = lm.siteEn || this._enDict(rawSite);
        const tailored = this._tailorPersonEvent(
          profile,
          byTag ? [] : tokens,
          d,
          lm.year,
          rawSite,
          rawSiteEn,
          lm.coord,
          lm.zh,
          lm.en || lm.zh,
          'L'
        );
        raw.push({
          src: 'L',
          year: lm.year,
          month:
            lm.month ||
            (isMulti && lm.year === 208 && rawSite.includes('赤壁') ? 11.0 : 6.5),
          coord: tailored.coord,
          dynasty: d,
          siteZh: tailored.siteZh,
          siteEn: tailored.siteEn,
          modernZh: '',
          modernEn: '',
          textZh: tailored.textZh,
          textEn: tailored.textEn,
          isMapChange: false,
          byPersonsTag: byTag,
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
          if (dy > 0 && (ev.byPersonsTag || prev.byPersonsTag)) return false;
          const km = this.projector.greatCircleKm(prev.coord, ev.coord);
          if (prev.src === ev.src) {
            if (ev.src === 'J' || ev.src === 'J_CO') return false;
            if (ev.src === 'M') return prev.year === ev.year && km < 45;
            return prev.year === ev.year && km < 35;
          }
          const bPrev = this._stripPromptParenthetical(prev.siteZh);
          const bCur = this._stripPromptParenthetical(ev.siteZh);
          const sameCoreSite =
            prev.year === ev.year &&
            bPrev.length >= 2 &&
            bCur.length >= 2 &&
            (bPrev.includes(bCur) || bCur.includes(bPrev));
          return sameCoreSite || (prev.year === ev.year && km < 65) || (dy <= 1 && km < 25);
        });
        if (dup) {
          // A curated journey stop outranks a nearby milestone or landmark that
          // merely mentions the person, and a full landmark sentence upgrades a
          // short multi-clause milestone fragment (e.g. "李靖平萧铣").
          const upgradeStubToLandmark =
            dup.src === 'M' &&
            ev.src === 'L' &&
            (!dup.byPersonsTag || ev.byPersonsTag) &&
            dup.textZh.length <= 9 &&
            ev.textZh.length >= dup.textZh.length + 6;
          const keep =
            ev.src === 'J' || (ev.src === 'J_CO' && dup.src !== 'J') || upgradeStubToLandmark
              ? ev
              : dup;
          const drop = keep === ev ? dup : ev;
          if (drop.isMapChange) keep.isMapChange = true;
          if (drop.byPersonsTag) keep.byPersonsTag = true;
          if (drop.milestone && !keep.milestone) keep.milestone = drop.milestone;
          if (keep === ev) deduped[deduped.indexOf(dup)] = ev;
          continue;
        }
        deduped.push(ev);
      }
      if (canCacheSolo && this._soloPersonEventsCache) {
        this._soloPersonEventsCache.set(profile, {
          snapRef,
          snapFull,
          hasEn,
          enRef,
          loreLoaded,
          events: deduped.map((ev) => ({ ...ev })),
        });
      }
      return deduped;
    }

    _eventsSharePlace(evA, evB) {
      if (!evA || !evB || !evA.coord || !evB.coord) return { hit: false, km: Infinity };
      const km = this.projector.greatCircleKm(evA.coord, evB.coord);
      if (km <= 45) return { hit: true, km };
      const bareA = this._stripPromptParenthetical(evA.siteZh || '').replace(/(?:郡|州|府|县|城|关)$/, '');
      const bareB = this._stripPromptParenthetical(evB.siteZh || '').replace(/(?:郡|州|府|县|城|关)$/, '');
      if (bareA.length >= 2 && bareA === bareB && km < 85) {
        return { hit: true, km };
      }
      return { hit: false, km };
    }

    _buildPersonTracksAndEvents(profiles) {
      const palette = HistoricalAtlasController.PERSON_TRACK_PALETTE;
      const isMultiReq = profiles.length >= 2;
      const peerKeys = profiles.map((p) => p.key);
      const tracks = [];
      for (let pIdx = 0; pIdx < profiles.length; pIdx++) {
        const p = profiles[pIdx];
        const color = palette[pIdx % palette.length];
        const rawEvs = this._collectPersonEvents(p, { isMulti: isMultiReq, peerKeys });
        const pEvents = rawEvs.map((ev, sIdx) => ({
          ...ev,
          personIdx: pIdx,
          personKey: p.key,
          personZh: p.zh,
          personEn: p.en,
          personColor: color,
          personStepIdx: sIdx,
          personStepNum: sIdx + 1,
        }));
        for (let i = 0; i < pEvents.length; i++) {
          pEvents[i].prevPersonEv = i > 0 ? pEvents[i - 1] : null;
        }
        if (pEvents.length) {
          tracks.push({ profile: p, color, personIdx: pIdx, events: pEvents });
        }
      }
      if (!tracks.length) return null;

      if (tracks.length === 1) {
        const singleEvents = tracks[0].events.map((ev, idx) => ({ ...ev, globalIdx: idx }));
        return {
          profile: tracks[0].profile,
          profiles: [tracks[0].profile],
          isMulti: false,
          tracks,
          events: singleEvents,
          sameTimeCount: 0,
          crossTimeCount: 0,
          intersectPlaces: [],
          intersectOnly: false,
        };
      }

      // Only merge & highlight true contemporaneous encounters (same place <= 45km AND |Δyear| <= 3).
      // Pair closest year/distance matches symmetrically across all track pairs (tA, tB) so 2-person and 3-person
      // chronicles match with identical precision regardless of which subset of tracks is compared.
      for (let tA = 0; tA < tracks.length; tA++) {
        for (let tB = tA + 1; tB < tracks.length; tB++) {
          const candPairs = [];
          for (const evA of tracks[tA].events) {
            for (const evB of tracks[tB].events) {
              const dy = Math.abs(evA.year - evB.year);
              if (dy > 3) continue;
              const { hit, km } = this._eventsSharePlace(evA, evB);
              if (!hit) continue;
              candPairs.push({ evA, evB, dy, km });
            }
          }
          candPairs.sort((a, b) => a.dy - b.dy || a.km - b.km);
          const usedA = new Set();
          const usedB = new Set();
          for (const { evA, evB } of candPairs) {
            if (usedA.has(evA) || usedB.has(evB)) continue;
            if (!evA._peerLinks) evA._peerLinks = {};
            if (!evB._peerLinks) evB._peerLinks = {};
            evA._peerLinks[tB] = evB;
            evB._peerLinks[tA] = evA;
            usedA.add(evA);
            usedB.add(evB);
          }
        }
      }

      const allRaw = tracks
        .flatMap((t) => t.events)
        .sort(
          (a, b) =>
            a.year - b.year ||
            (a.month || 6.5) - (b.month || 6.5) ||
            a.personIdx - b.personIdx
        );

      const merged = [];
      let sameTimeCount = 0;
      for (const evA of allRaw) {
        if (evA._mergedIntoShared) continue;
        const group = [evA];
        const usedTracks = new Set([evA.personIdx]);
        const queue = [evA];
        while (queue.length > 0) {
          const cur = queue.shift();
          if (!cur._peerLinks) continue;
          const peerIdxList = Object.keys(cur._peerLinks)
            .map(Number)
            .sort((a, b) => a - b);
          for (const tIdx of peerIdxList) {
            if (usedTracks.has(tIdx)) continue;
            const cand = cur._peerLinks[tIdx];
            if (!cand || cand._mergedIntoShared) continue;
            if (
              Math.abs(evA.year - cand.year) <= 3 &&
              this._eventsSharePlace(evA, cand).hit
            ) {
              usedTracks.add(tIdx);
              cand._mergedIntoShared = true;
              group.push(cand);
              queue.push(cand);
            }
          }
        }
        if (group.length >= 2) {
          evA._mergedIntoShared = true;
          group.sort((a, b) => a.personIdx - b.personIdx);
          const primary = group[0];
          for (let gIdx = 1; gIdx < group.length; gIdx++) {
            group[gIdx].coord = [primary.coord[0], primary.coord[1]];
          }
          const textSource =
            group.find((gEv) => gEv.src === 'J') ||
            group.find((gEv) => gEv.src === 'M') ||
            primary;
          const participants = group.map((gEv) => ({
            profile: tracks[gEv.personIdx].profile,
            personIdx: gEv.personIdx,
            personKey: gEv.personKey,
            personZh: gEv.personZh,
            personEn: gEv.personEn,
            color: gEv.personColor,
            stepIdx: gEv.personStepIdx,
            stepNum: gEv.personStepNum,
            year: gEv.year,
            src: gEv.src,
            byPersonsTag: Boolean(gEv.byPersonsTag),
            textZh: gEv.textZh,
            textEn: gEv.textEn,
            quoteZh: gEv.quoteZh,
            quoteEn: gEv.quoteEn,
          }));
          const uniqueNotes = [];
          for (const pt of participants) {
            const norm = String(pt.textZh || '').trim();
            if (!norm) continue;
            const dup = uniqueNotes.find(
              (u) => u.textZh === norm || u.textZh.includes(norm) || norm.includes(u.textZh)
            );
            if (!dup) uniqueNotes.push(pt);
          }
          const isSameYearSharedEvent =
            group.every((gEv) => gEv.year === primary.year) &&
            (group.some((gEv) => gEv.byPersonsTag) ||
              group.every((gEv) => gEv.src !== 'J'));
          const qSource = participants.find((pt) => pt.quoteZh || pt.quoteEn) || textSource;
          const sharedEv = {
            ...primary,
            textZh: textSource.textZh,
            textEn: textSource.textEn,
            isSharedEncounter: true,
            isMapChange: group.some((gEv) => gEv.isMapChange),
            participants,
            distinctNotes:
              !isSameYearSharedEvent && uniqueNotes.length > 1 ? uniqueNotes : null,
            quoteZh: qSource.quoteZh || '',
            quoteEn: qSource.quoteEn || '',
            intersection: {
              kind: 'same_time',
              peers: participants.slice(1),
            },
          };
          merged.push(sharedEv);
          sameTimeCount++;
        } else {
          merged.push(evA);
        }
      }

      merged.forEach((ev, idx) => {
        ev.globalIdx = idx;
      });

      return {
        profile: tracks[0].profile,
        profiles: tracks.map((t) => t.profile),
        isMulti: true,
        tracks,
        events: merged,
        sameTimeCount,
        crossTimeCount: 0,
        intersectPlaces: merged.filter((e) => e.isSharedEncounter),
      };
    }

    openPersonChronicle(personOrQuery, initialIdx = -1) {
      const profiles = this._resolvePersonProfiles(personOrQuery);
      if (!profiles.length) return false;
      const state = this._buildPersonTracksAndEvents(profiles);
      if (!state || !state.events.length) {
        if (!this._isLoreDetailLoaded()) {
          this._ensureLoreDetail().then(() => {
            this.openPersonChronicle(personOrQuery, initialIdx);
          });
          return true;
        }
        return false;
      }
      const { events } = state;
      const stateKey = state.profiles.map((p) => p.key).join(',');

      if (!this._fullSnapshotsLoaded) {
        this._ensureFullSnapshots().then(() => {
          if (
            this.activePerson &&
            this.activePerson.profiles.map((p) => p.key).join(',') === stateKey
          ) {
            this._renderPersonChronicleCard(true);
          }
        });
      }
      if (!this._isLoreDetailLoaded()) {
        this._ensureLoreDetail().then(() => {
          if (
            this.activePerson &&
            this.activePerson.profiles.map((p) => p.key).join(',') === stateKey
          ) {
            const rebuilt = this._buildPersonTracksAndEvents(profiles);
            if (rebuilt && rebuilt.events.length) {
              this.activePerson = rebuilt;
              if (initialIdx >= 0 && initialIdx < rebuilt.events.length) {
                this.activePersonEventIdx = initialIdx;
              }
            }
            this._renderPersonPinsOverlay();
            this._renderPersonChronicleCard(true);
          }
        });
      }
      if (
        this.locale === 'en' &&
        (!this.enLocale || !this.enLocale.dict || !Object.keys(this.enLocale.dict).length)
      ) {
        this._ensureEnglishLocale().then(() => {
          if (
            this.activePerson &&
            this.activePerson.profiles.map((p) => p.key).join(',') === stateKey
          ) {
            const rebuilt = this._buildPersonTracksAndEvents(profiles);
            if (rebuilt) {
              this.activePerson = rebuilt;
            }
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
      if (typeof this._clearActiveTrace === 'function') this._clearActiveTrace();
      if (this.ghostTimer) {
        clearTimeout(this.ghostTimer);
        this.ghostTimer = null;
      }
      if (this.grpGhostDiff) this.grpGhostDiff.innerHTML = '';
      if (this.hoverTip) {
        this.hoverTip.classList.add('is-hidden');
        this.hoverTip.classList.remove('is-interactive');
      }

      this.activePerson = state;
      this.personSharedOnly = false;
      if (state.profile && state.profile.isStory) {
        this._returnStoryState = null;
      }
      this.activePersonEventIdx =
        initialIdx >= 0 && initialIdx < events.length ? initialIdx : -1;
      this._scheduleUrlSync();

      const cardEl = this._id('genealogy-card');
      if (cardEl) cardEl.classList.remove('is-hidden');
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.add('has-active-genealogy', 'has-active-person');
      this._syncImmersivePaneState();

      const defaultAnchorEv =
        this.activePersonEventIdx >= 0
          ? events[this.activePersonEventIdx]
          : events.find((e) => e.isSharedEncounter) || events[0];
      this._inPersonSync = true;
      this._runWithDeferredTypography(() => {
        if (defaultAnchorEv) {
          this.jumpToYear(this._clampYearToDynasty(defaultAnchorEv.dynasty, defaultAnchorEv.year));
        }
        this._renderPersonPinsOverlay();
      });
      this._inPersonSync = false;
      this._renderPersonChronicleCard();
      this._syncDocumentSeoMeta();

      if (this.activePersonEventIdx >= 0) {
        const initEv = events[this.activePersonEventIdx];
        if (state.isMulti) {
          const multiLegs = this._getMultiStepLegs(state, this.activePersonEventIdx, initEv);
          if (multiLegs.length) {
            this._framePersonOverview([
              ...multiLegs.map((l) => ({ coord: l.fromCoord })),
              initEv,
            ]);
          } else {
            this._flyToPersonEvent(initEv);
          }
        } else {
          const legOrigin = this._getSoloStepOriginCoord(
            state,
            events,
            this.activePersonEventIdx,
            initEv
          );
          const prongPts = Array.isArray(initEv.prongs)
            ? initEv.prongs
                .filter((p) => p && Array.isArray(p.fromCoord))
                .map((p) => ({ coord: p.fromCoord }))
            : [];
          if (legOrigin || prongPts.length) {
            this._framePersonOverview([
              ...(legOrigin ? [{ coord: legOrigin }] : []),
              ...prongPts,
              initEv,
            ]);
          } else {
            this._flyToPersonEvent(initEv);
          }
        }
      } else {
        this._framePersonOverview();
      }
      return true;
    }

    openJourneyAsPerson(journeyKey, stopIdx = -1) {
      const needDetail = !this._isLoreDetailLoaded();
      if (!this.openPersonChronicle(journeyKey, -1)) {
        if (needDetail) {
          this._ensureLoreDetail().then(() => {
            this.openJourneyAsPerson(journeyKey, stopIdx);
          });
          return true;
        }
        return false;
      }
      const applyStop = () => {
        if (
          stopIdx >= 0 &&
          this.activePerson &&
          this.activePerson.profile &&
          this.activePerson.profile.key === journeyKey &&
          this.activePerson.events.length
        ) {
          const matchIdx = this.activePerson.events.findIndex((ev) => ev.journeyStopIdx === stopIdx);
          const targetIdx =
            matchIdx >= 0 ? matchIdx : Math.min(this.activePerson.events.length - 1, stopIdx);
          this.selectPersonEvent(targetIdx, true);
        }
      };
      if (stopIdx >= 0) {
        if (needDetail) {
          this._ensureLoreDetail().then(applyStop);
        } else {
          applyStop();
        }
      }
      return true;
    }

    _personAutoplayTick() {
      if (this.narrating && this._narratorSpeaking) return;
      if (!this.activePerson || this.activePersonEventIdx + 1 >= this.activePerson.events.length) {
        if (this.personTimer) {
          clearInterval(this.personTimer);
          this.personTimer = null;
        }
        if (typeof this.silenceNarrator === 'function') this.silenceNarrator();
        this._updateAutoplayUi();
        return;
      }
      this.stepPersonEvent(1);
    }

    togglePersonAutoplay() {
      if (!this.activePerson || !this.activePerson.events.length) return;
      if (this.personTimer) {
        clearInterval(this.personTimer);
        this.personTimer = null;
        if (typeof this.silenceNarrator === 'function') this.silenceNarrator();
        this._updateAutoplayUi();
        return;
      }
      if (this.playing) {
        this.stopAutoplay();
      }
      if (
        this.activePersonEventIdx < 0 ||
        this.activePersonEventIdx >= this.activePerson.events.length - 1
      ) {
        this.selectPersonEvent(0, true);
      }
      this.personTimer = setInterval(
        () => this._personAutoplayTick(),
        this._personAutoplayIntervalMs()
      );
      this._updateAutoplayUi();
      if (this.narrating && typeof this.speakCurrentState === 'function') {
        this.speakCurrentState({ forceIntro: true });
      }
    }

    selectPersonEvent(idx, panCamera = true) {
      if (!this.activePerson || !this.activePerson.events.length) return;
      this._scheduleUrlSync();
      const events = this.activePerson.events;
      if (idx < 0) {
        this.activePersonEventIdx = -1;
        this._renderPersonPinsOverlay();
        this._renderPersonChronicleCard(true);
        if (panCamera) {
          const ovEvents =
            this.activePerson.isMulti &&
            this.personSharedOnly &&
            this.activePerson.sameTimeCount > 0
              ? events.filter((e) => e.isSharedEncounter)
              : null;
          this._framePersonOverview(ovEvents);
        }
        return;
      }
      const clamped = Math.max(0, Math.min(events.length - 1, idx));
      this.activePersonEventIdx = clamped;
      const ev = events[clamped];
      this.closeMilestoneBalloon();
      this._inPersonSync = true;
      this._runWithDeferredTypography(() => {
        this.jumpToYear(this._clampYearToDynasty(ev.dynasty, ev.year));
        this._renderPersonPinsOverlay();
      });
      this._inPersonSync = false;
      this._renderPersonChronicleCard(true);
      if (panCamera) {
        if (this.activePerson.isMulti) {
          const multiLegs = this._getMultiStepLegs(this.activePerson, clamped, ev);
          const nearPeers = this._getSimultaneousPeerAnchors(this.activePerson, clamped, ev).filter(
            (anc) =>
              anc &&
              anc.ev &&
              Array.isArray(anc.ev.coord) &&
              this.projector.greatCircleKm(ev.coord, anc.ev.coord) <= 880
          );
          if (multiLegs.length || nearPeers.length) {
            this._framePersonOverview([
              ...multiLegs.map((l) => ({ coord: l.fromCoord })),
              ...nearPeers.map((anc) => ({ coord: anc.ev.coord })),
              ev,
            ]);
          } else {
            this._flyToPersonEvent(ev);
          }
        } else {
          const legOrigin = this._getSoloStepOriginCoord(
            this.activePerson,
            events,
            clamped,
            ev
          );
          const prongPts = Array.isArray(ev.prongs)
            ? ev.prongs
                .filter((p) => p && Array.isArray(p.fromCoord))
                .map((p) => ({ coord: p.fromCoord }))
            : [];
          if (legOrigin || prongPts.length) {
            this._framePersonOverview([
              ...(legOrigin ? [{ coord: legOrigin }] : []),
              ...prongPts,
              ev,
            ]);
          } else {
            this._flyToPersonEvent(ev);
          }
        }
      }
    }

    _getSoloStepOriginCoord(activePerson, events, curIdx, curEv) {
      if (!activePerson || activePerson.isMulti || curIdx < 0 || !curEv) return null;
      const profile = activePerson.profile || {};
      const isStory = Boolean(profile.isStory);
      if (isStory) {
        return Array.isArray(curEv.fromCoord) ? curEv.fromCoord : null;
      }
      if (curIdx > 0) {
        const prevEv = events[curIdx - 1];
        const isScrapedBio = !profile.journeyKey && !profile.isRelic;
        const yearGap = prevEv ? Math.abs((curEv.year || 0) - (prevEv.year || 0)) : 0;
        if (isScrapedBio && !curEv.fromCoord && yearGap > 6) {
          return null;
        }
        if (
          prevEv &&
          Array.isArray(prevEv.coord) &&
          Math.hypot(prevEv.coord[0] - curEv.coord[0], prevEv.coord[1] - curEv.coord[1]) > 0.08
        ) {
          const keepsCuratedLeg =
            Boolean(curEv.via || curEv.fromCoord) &&
            curEv.prevStopCoord &&
            Math.hypot(
              prevEv.coord[0] - curEv.prevStopCoord[0],
              prevEv.coord[1] - curEv.prevStopCoord[1]
            ) < 1.2;
          return keepsCuratedLeg && Array.isArray(curEv.fromCoord) ? curEv.fromCoord : prevEv.coord;
        }
      }
      return null;
    }

    _getSimultaneousPeerAnchors(activePerson, curIdx, curEv) {
      if (!activePerson || !activePerson.isMulti || curIdx < 0 || !curEv) return [];
      const allTracks = Array.isArray(activePerson.tracks) ? activePerson.tracks : [];
      const events = Array.isArray(activePerson.events) ? activePerson.events : [];
      const presentPersonIdxs = new Set(
        curEv.isSharedEncounter && Array.isArray(curEv.participants)
          ? curEv.participants.map((p) => p.personIdx)
          : [curEv.personIdx]
      );
      const anchors = [];
      for (const tr of allTracks) {
        if (!tr || presentPersonIdxs.has(tr.personIdx)) continue;
        const span = tr.profile && Array.isArray(tr.profile.span) ? tr.profile.span : null;
        if (span && (curEv.year < span[0] - 2 || curEv.year > span[1] + 2)) continue;
        let bestPriorIdx = -1;
        let bestPriorScore = Infinity;
        let bestNearFutureIdx = -1;
        events.forEach((ev, idx) => {
          if (idx === curIdx) return;
          const involves =
            ev.personIdx === tr.personIdx ||
            (ev.isSharedEncounter &&
              Array.isArray(ev.participants) &&
              ev.participants.some((p) => p.personIdx === tr.personIdx));
          if (!involves) return;
          const diff = curEv.year - ev.year;
          if (idx < curIdx && diff >= 0 && diff <= 22) {
            const score = diff - idx * 0.001;
            if (score < bestPriorScore) {
              bestPriorScore = score;
              bestPriorIdx = idx;
            }
          } else if (
            idx > curIdx &&
            ev.year - curEv.year >= 0 &&
            ev.year - curEv.year <= 2 &&
            bestNearFutureIdx < 0
          ) {
            bestNearFutureIdx = idx;
          }
        });
        const bestIdx = bestPriorIdx >= 0 ? bestPriorIdx : bestNearFutureIdx;
        if (bestIdx >= 0) {
          anchors.push({
            personIdx: tr.personIdx,
            eventIdx: bestIdx,
            ev: events[bestIdx],
            profile: tr.profile,
            color: tr.color || '#355470',
          });
        }
      }
      return anchors;
    }

    _getMultiStepLegs(activePerson, curIdx, curEv) {
      if (!activePerson || !activePerson.isMulti || curIdx < 0 || !curEv) return [];
      const allTracks = Array.isArray(activePerson.tracks) ? activePerson.tracks : [];
      const parts =
        curEv.isSharedEncounter && Array.isArray(curEv.participants)
          ? curEv.participants
          : [
              {
                personIdx: curEv.personIdx,
                stepIdx: curEv.personStepIdx,
                color: curEv.personColor || '#bd2d22',
              },
            ];
      const rawLegs = [];
      for (const pt of parts) {
        if (pt.stepIdx === undefined || pt.stepIdx <= 0) continue;
        const tr = allTracks.find((t) => t.personIdx === pt.personIdx);
        if (!tr || !Array.isArray(tr.events)) continue;
        const prevTrackEv = tr.events[pt.stepIdx - 1];
        const curTrackEv = tr.events[pt.stepIdx] || curEv;
        if (
          !prevTrackEv ||
          !Array.isArray(prevTrackEv.coord) ||
          Math.hypot(
            prevTrackEv.coord[0] - curEv.coord[0],
            prevTrackEv.coord[1] - curEv.coord[1]
          ) <= 0.08
        ) {
          continue;
        }
        const keepsCuratedLeg =
          Boolean(curTrackEv.via || curTrackEv.fromCoord) &&
          curTrackEv.prevStopCoord &&
          Math.hypot(
            prevTrackEv.coord[0] - curTrackEv.prevStopCoord[0],
            prevTrackEv.coord[1] - curTrackEv.prevStopCoord[1]
          ) < 1.2;
        const fromCoord =
          keepsCuratedLeg && Array.isArray(curTrackEv.fromCoord)
            ? curTrackEv.fromCoord
            : prevTrackEv.coord;
        const evList = Array.isArray(activePerson.events) ? activePerson.events : [];
        let originIdx = evList.indexOf(prevTrackEv);
        if (originIdx < 0) {
          originIdx = evList.findIndex(
            (e, idx) =>
              idx !== curIdx &&
              e.isSharedEncounter &&
              Array.isArray(e.participants) &&
              e.participants.some(
                (p) => p.personIdx === pt.personIdx && p.stepIdx === pt.stepIdx - 1
              )
          );
        }
        if (originIdx < 0) {
          originIdx = evList.findIndex(
            (e, idx) =>
              idx !== curIdx &&
              e.personIdx === pt.personIdx &&
              Math.hypot(e.coord[0] - fromCoord[0], e.coord[1] - fromCoord[1]) < 0.35
          );
        }
        rawLegs.push({
          personIdx: pt.personIdx,
          originIdx,
          color: pt.color || tr.color || '#bd2d22',
          fromCoord,
          toCoord: curEv.coord,
          via: keepsCuratedLeg ? curTrackEv.via || null : null,
        });
      }
      for (let i = 0; i < rawLegs.length; i++) {
        const leg = rawLegs[i];
        const sameOriginPeers = rawLegs.filter(
          (other) =>
            Math.hypot(
              other.fromCoord[0] - leg.fromCoord[0],
              other.fromCoord[1] - leg.fromCoord[1]
            ) < 0.35
        );
        const peerPos = sameOriginPeers.indexOf(leg);
        leg.bias =
          sameOriginPeers.length > 1
            ? (peerPos - (sameOriginPeers.length - 1) * 0.5) * 9.5
            : 0;
      }
      return rawLegs;
    }

    _getNavigablePersonEventIdxs() {
      if (!this.activePerson || !Array.isArray(this.activePerson.events)) return [];
      const { events, isMulti, sameTimeCount } = this.activePerson;
      if (isMulti && this.personSharedOnly && sameTimeCount > 0) {
        const sharedIdxs = [];
        events.forEach((ev, idx) => {
          if (ev.isSharedEncounter) sharedIdxs.push(idx);
        });
        if (sharedIdxs.length) return sharedIdxs;
      }
      return events.map((_, idx) => idx);
    }

    stepPersonEvent(delta) {
      const navIdxs = this._getNavigablePersonEventIdxs();
      if (!navIdxs.length) return;
      const len = navIdxs.length;
      const pos = navIdxs.indexOf(this.activePersonEventIdx);
      const next =
        pos < 0
          ? delta >= 0
            ? navIdxs[0]
            : navIdxs[len - 1]
          : navIdxs[(pos + delta + len) % len];
      this.selectPersonEvent(next, true);
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

    _getVisiblePersonTracks() {
      if (!this.activePerson) return [];
      const { tracks, isMulti, events } = this.activePerson;
      if (!Array.isArray(tracks) || !tracks.length) {
        return [{ color: '#bd2d22', personIdx: 0, events: events || [] }];
      }
      if (!isMulti || tracks.length <= 1) return tracks;

      const curIdx = this.activePersonEventIdx;
      const curEv = curIdx >= 0 ? events[curIdx] : null;
      const curDynKey =
        (curEv && curEv.dynasty && curEv.dynasty.key) ||
        (this.dynasties[this.dynastyIdx] && this.dynasties[this.dynastyIdx].key) ||
        '';
      const spans = tracks.map((tr) => {
        const yrs = (tr.events || []).map((e) => e.year);
        return yrs.length ? [Math.min(...yrs), Math.max(...yrs)] : [this.year, this.year];
      });

      const primaryIdxs = new Set();
      if (curEv) {
        if (curEv.isSharedEncounter && Array.isArray(curEv.participants)) {
          curEv.participants.forEach((pt) => primaryIdxs.add(pt.personIdx));
        } else if (curEv.personIdx !== undefined) {
          primaryIdxs.add(curEv.personIdx);
        }
      }
      if (!primaryIdxs.size && curDynKey) {
        tracks.forEach((tr, idx) => {
          if ((tr.events || []).some((e) => e.dynasty && e.dynasty.key === curDynKey)) {
            primaryIdxs.add(idx);
          }
        });
      }
      if (!primaryIdxs.size) {
        let bestIdx = 0;
        let bestDist = Infinity;
        spans.forEach(([y0, y1], idx) => {
          const d = this.year < y0 ? y0 - this.year : this.year > y1 ? this.year - y1 : 0;
          if (d < bestDist) {
            bestDist = d;
            bestIdx = idx;
          }
        });
        primaryIdxs.add(bestIdx);
      }

      return tracks.filter((tr, idx) => {
        if (primaryIdxs.has(idx)) return true;
        if (
          curDynKey &&
          (tr.events || []).some((e) => e.dynasty && e.dynasty.key === curDynKey)
        ) {
          return true;
        }
        const [b0, b1] = spans[idx];
        for (const pIdx of primaryIdxs) {
          const [a0, a1] = spans[pIdx];
          if (a1 + 30 >= b0 && b1 + 30 >= a0) return true;
        }
        return false;
      });
    }

    _framePersonOverview(subsetEvents = null) {
      if (!this.activePerson || !this.activePerson.events.length) return;
      const evList =
        Array.isArray(subsetEvents) && subsetEvents.length
          ? subsetEvents
          : this.activePerson.events;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const ev of evList) {
        const [sx, sy] = this.projector.toScreen(ev.coord[0], ev.coord[1]);
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;
      }
      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5;
      const aspect = this._getViewportAspect();
      // Embeds keep the place/person card at the top right like desktop, not as a bottom sheet.
      const isDesktop = typeof window === 'undefined' || window.innerWidth > 900 || Boolean(this.embed);
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
      const isStory = Boolean(
        this.activePerson && this.activePerson.profile && this.activePerson.profile.isStory
      );
      const pts = [this.projector.toScreen(ev.coord[0], ev.coord[1])];
      if (isStory && Array.isArray(ev.fromCoord)) {
        pts.push(this.projector.toScreen(ev.fromCoord[0], ev.fromCoord[1]));
      }
      let minX = pts[0][0];
      let maxX = pts[0][0];
      let minY = pts[0][1];
      let maxY = pts[0][1];
      for (const [px, py] of pts) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      const tx = (minX + maxX) * 0.5;
      const ty = (minY + maxY) * 0.5;
      const spanX = maxX - minX;
      const spanY = maxY - minY;
      const aspect = this._getViewportAspect();
      // Embeds keep the place/person card at the top right like desktop, not as a bottom sheet.
      const isDesktop = typeof window === 'undefined' || window.innerWidth > 900 || Boolean(this.embed);
      if (!isDesktop) {
        const visTopFrac = this._getPersonVisibleTopFrac();
        const fitW =
          pts.length > 1
            ? Math.max((spanX + 96) * 1.15, (spanY + 76) / Math.max(0.32, aspect * visTopFrac * 0.78))
            : 0;
        const w = Math.max(320, Math.min(620, Math.max(Math.min(this.camera.w, 460), fitW)));
        const h = w * aspect;
        this._animateCameraTo({ x: tx - w * 0.5, y: ty - h * (visTopFrac * 0.5), w, h });
        return;
      }
      const fitW =
        pts.length > 1
          ? Math.max((spanX + 115) / 0.48, (spanY + 95) / (aspect * 0.78))
          : 0;
      const w = Math.max(340, Math.min(640, Math.max(Math.min(this.camera.w, 480), fitW)));
      const h = w * aspect;
      this._animateCameraTo({ x: tx - w * 0.39, y: ty - h * 0.48, w, h });
    }

    _findNearestPersonPin(clientX, clientY, maxPx = 26) {
      if (!this.activePerson || !this.grpJourney || !this.svg) return null;
      const rect = this._cameraViewportRect || this.svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      this._cameraViewportRect = rect;
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
      const vf = this._id('viewport-frame');
      if (!this.activePerson) {
        if (vf) vf.classList.remove('has-person-overview-lines');
        return;
      }

      const { events, tracks, isMulti, profile } = this.activePerson;
      const isStory = Boolean(profile && profile.isStory);
      const curIdx = this.activePersonEventIdx;
      const curEv = curIdx >= 0 ? events[curIdx] : null;
      const soloOriginCoord = this._getSoloStepOriginCoord(
        this.activePerson,
        events,
        curIdx,
        curEv
      );
      let stepOriginIdx = -1;
      if (!isMulti && curIdx >= 0 && curEv && soloOriginCoord) {
        if (isStory) {
          stepOriginIdx =
            typeof curEv.fromStopIdx === 'number' && curEv.fromStopIdx >= 0
              ? curEv.fromStopIdx
              : -1;
        } else if (curIdx > 0) {
          stepOriginIdx = curIdx - 1;
        } else {
          stepOriginIdx = events.findIndex(
            (e, i) =>
              i !== curIdx &&
              Math.hypot(e.coord[0] - soloOriginCoord[0], e.coord[1] - soloOriginCoord[1]) < 0.35
          );
        }
      }
      const multiLegs = isMulti ? this._getMultiStepLegs(this.activePerson, curIdx, curEv) : [];
      const peerSyncAnchors = isMulti
        ? this._getSimultaneousPeerAnchors(this.activePerson, curIdx, curEv)
        : [];
      const peerSyncByIdx = new Map();
      for (const anc of peerSyncAnchors) {
        if (!anc || anc.eventIdx < 0) continue;
        if (!peerSyncByIdx.has(anc.eventIdx)) peerSyncByIdx.set(anc.eventIdx, []);
        peerSyncByIdx.get(anc.eventIdx).push(anc);
      }
      const prongOriginIdxs =
        !isMulti && isStory && curEv && Array.isArray(curEv.prongs)
          ? curEv.prongs
              .map((p) => (p && typeof p.fromStopIdx === 'number' ? p.fromStopIdx : -1))
              .filter((idx) => idx >= 0)
          : [];
      const stepOriginIdxSet = new Set(
        isMulti
          ? multiLegs.map((l) => l.originIdx).filter((idx) => idx >= 0)
          : [...(stepOriginIdx >= 0 ? [stepOriginIdx] : []), ...prongOriginIdxs]
      );
      const isOriginIdx = (i) => stepOriginIdxSet.has(i);
      const activeEraTracks = this._getVisiblePersonTracks();
      const activeEraPersonIdxs = new Set(activeEraTracks.map((t) => t.personIdx));
      const isTrackDimmed = (pIdx) =>
        Boolean(isMulti && curIdx >= 0 && !activeEraPersonIdxs.has(pIdx));
      const rawPts = events.map((ev) => this.projector.toScreen(ev.coord[0], ev.coord[1]));

      // Compute zoom-invariant screen-space cluster offsets so co-located pins (e.g. Chang'an ① ②)
      // never overlap at ANY zoom level on Desktop or Mobile while preserving exact data-x/data-y
      // for _rescaleSvgTypography's automatic city label culling.
      const clusters = rawPts.map(([sx, sy], i) => {
        const peers = [];
        rawPts.forEach(([ox, oy], j) => {
          if (Math.hypot(ox - sx, oy - sy) < 6.5) peers.push(j);
        });
        if (isMulti) {
          const sharedPeer = peers.find((pIdx) => events[pIdx] && events[pIdx].isSharedEncounter);
          if (peers.includes(curIdx)) {
            return {
              ox: 0,
              oy: 0,
              ringR: 0,
              isPrimary: i === curIdx,
              isMultiCanonical: i === curIdx,
              isCrossEraShared: false,
              stackCount: peers.length,
              stackPeers: peers,
              peers,
            };
          }
          const syncPeer =
            curIdx >= 0 ? peers.find((pIdx) => peerSyncByIdx.has(pIdx)) : undefined;
          if (syncPeer !== undefined) {
            return {
              ox: 0,
              oy: 0,
              ringR: 0,
              isPrimary: i === syncPeer,
              isMultiCanonical: i === syncPeer,
              isCrossEraShared: false,
              stackCount: peers.length,
              stackPeers: peers,
              peers,
            };
          }
          const originPeer =
            curIdx >= 0 ? peers.find((pIdx) => stepOriginIdxSet.has(pIdx)) : undefined;
          if (originPeer !== undefined) {
            return {
              ox: 0,
              oy: 0,
              ringR: 0,
              isPrimary: i === originPeer,
              isMultiCanonical: i === originPeer,
              isCrossEraShared: false,
              stackCount: peers.length,
              stackPeers: peers,
              peers,
            };
          }
          if (sharedPeer !== undefined) {
            return {
              ox: 0,
              oy: 0,
              ringR: 0,
              isPrimary: i === sharedPeer,
              isMultiCanonical: i === sharedPeer,
              isCrossEraShared: false,
              stackCount: peers.length,
              stackPeers: peers,
              peers,
            };
          }
          const myPersonIdx = events[i]?.personIdx;
          const samePersonPeers = peers.filter((pIdx) => events[pIdx]?.personIdx === myPersonIdx);
          const firstForPerson = samePersonPeers[0];
          const distinctPersons = Array.from(
            new Set(peers.map((pIdx) => events[pIdx]?.personIdx))
          ).sort((a, b) => a - b);
          const pPos = distinctPersons.indexOf(myPersonIdx);
          const ox =
            distinctPersons.length > 1 ? (pPos - (distinctPersons.length - 1) * 0.5) * 8.2 : 0;
          return {
            ox,
            oy: 0,
            ringR: 0,
            isPrimary: i === peers[0],
            isMultiCanonical: i === firstForPerson,
            isCrossEraShared: distinctPersons.length > 1,
            stackCount: samePersonPeers.length,
            stackPeers: samePersonPeers,
            peers,
          };
        }
        if (peers.length <= 1) {
          return {
            ox: 0,
            oy: 0,
            ringR: 0,
            canonicalIdx: i,
            isPrimary: true,
            isMultiCanonical: true,
            isSoloCanonical: true,
            stackCount: 1,
            stackPeers: peers,
            peers,
          };
        }
        if (!isStory) {
          const canonicalSolo = peers.includes(curIdx)
            ? curIdx
            : stepOriginIdx >= 0 && peers.includes(stepOriginIdx)
              ? stepOriginIdx
              : peers[0];
          return {
            ox: 0,
            oy: 0,
            ringR: 0,
            canonicalIdx: canonicalSolo,
            isPrimary: i === canonicalSolo,
            isMultiCanonical: true,
            isSoloCanonical: i === canonicalSolo,
            stackCount: peers.length,
            stackPeers: peers,
            peers,
          };
        }
        const pos = peers.indexOf(i);
        if (peers.length === 2) {
          return {
            ox: pos === 0 ? -8.6 : 8.6,
            oy: 0,
            ringR: 2,
            isPrimary: pos === 0,
            isMultiCanonical: true,
            isSoloCanonical: true,
            stackCount: 1,
            stackPeers: [i],
            peers,
          };
        }
        const ringR = Math.max(9.6, 8.3 / Math.sin(Math.PI / peers.length));
        const angle = -Math.PI * 0.75 + (pos / peers.length) * Math.PI * 2;
        return {
          ox: Math.cos(angle) * ringR,
          oy: Math.sin(angle) * ringR,
          ringR,
          isPrimary: pos === 0,
          isMultiCanonical: true,
          isSoloCanonical: true,
          stackCount: 1,
          stackPeers: [i],
          peers,
        };
      });

      // 1. Render understated cartographic trajectory arcs + directional chevrons below pins
      // - Overview (curIdx < 0): render pins only (no crisscrossing full-life cobweb)
      // - Single step (curIdx >= 0): render ONLY that step's movement vector(s) (prevStop ──► curStop)
      const unnumberedOriginCoords = [];
      const renderOriginBead = (coord, labelZh, labelEn, color) => {
        unnumberedOriginCoords.push(coord);
        const [ox, oy] = this.projector.toScreen(coord[0], coord[1]);
        const og = this._svgNode(
          'g',
          {
            class: 'journey-node is-passed is-multi-bead',
            'data-x': ox.toFixed(1),
            'data-y': oy.toFixed(1),
            'data-ox': '0',
            'data-oy': '0',
            'data-base-ox': '0',
            'data-base-oy': '0',
          },
          this.grpJourney
        );
        og.style.color = color || '#7d4b36';
        const oInner = this._svgNode('g', { class: 'jn-pin-shift' }, og);
        this._svgNode(
          'circle',
          { class: 'jn-disc is-waypoint-bead', r: 4.6 },
          oInner
        );
        const oLbl = this._svgNode(
          'text',
          { class: 'jn-label', x: '0', y: '-8.2' },
          oInner
        );
        oLbl.textContent = this._mapText(
          this.locale === 'en' ? labelEn || this.trTerm(labelZh) : this._zh(labelZh)
        );
      };
      const getSoloPinCoord = (idx) => {
        const cl = clusters[idx];
        return cl && typeof cl.canonicalIdx === 'number' && events[cl.canonicalIdx]
          ? events[cl.canonicalIdx].coord
          : events[idx].coord;
      };
      const isCuratedJourney = Boolean(profile && (profile.journeyKey || profile.isRelic));
      let hasOverviewLines = false;
      if (curIdx < 0 && !isMulti && !isStory && isCuratedJourney) {
        const segments = [];
        let prevIdx = -1;
        let legCount = 0;
        for (let i = 0; i < events.length; i++) {
          const nextEv = events[i];
          if (!nextEv || !Array.isArray(nextEv.coord)) continue;
          if (prevIdx < 0) {
            prevIdx = i;
            continue;
          }
          const prevEv = events[prevIdx];
          const fromPinCoord = getSoloPinCoord(prevIdx);
          const toPinCoord = getSoloPinCoord(i);
          if (
            Math.hypot(fromPinCoord[0] - toPinCoord[0], fromPinCoord[1] - toPinCoord[1]) <= 0.08
          ) {
            prevIdx = i;
            continue;
          }
          const keepsCuratedLeg =
            Boolean(nextEv.via || nextEv.fromCoord) &&
            nextEv.prevStopCoord &&
            Math.hypot(
              prevEv.coord[0] - nextEv.prevStopCoord[0],
              prevEv.coord[1] - nextEv.prevStopCoord[1]
            ) < 1.2;
          let viaPts = keepsCuratedLeg && Array.isArray(nextEv.via) ? nextEv.via.slice() : null;
          if (
            keepsCuratedLeg &&
            Array.isArray(nextEv.fromCoord) &&
            Math.hypot(nextEv.fromCoord[0] - fromPinCoord[0], nextEv.fromCoord[1] - fromPinCoord[1]) >
              0.45
          ) {
            viaPts = [nextEv.fromCoord, ...(viaPts || [])];
          }
          const segBias = legCount % 2 === 0 ? 1.8 : -1.8;
          const segInfo = this._buildJourneySegmentInfo(
            fromPinCoord,
            toPinCoord,
            viaPts && viaPts.length ? viaPts : null,
            segBias
          );
          if (segInfo) {
            segments.push({ ...segInfo, toIdx: i });
            legCount++;
          }
          prevIdx = i;
        }
        if (segments.length) {
          hasOverviewLines = true;
          this._renderCartographicTrajectory(segments, -1, '#ad3422', false);
        }
      } else if (!isMulti) {
        if (curIdx >= 0 && curEv) {
          if (soloOriginCoord) {
            const prevEv = !isStory && curIdx > 0 ? events[curIdx - 1] : null;
            const keepsCuratedVia =
              Boolean(curEv.via) &&
              (isStory ||
                (prevEv &&
                  curEv.prevStopCoord &&
                  Math.hypot(
                    prevEv.coord[0] - curEv.prevStopCoord[0],
                    prevEv.coord[1] - curEv.prevStopCoord[1]
                  ) < 1.2));
            const segInfo = this._buildJourneySegmentInfo(
              soloOriginCoord,
              curEv.coord,
              keepsCuratedVia ? curEv.via || null : null,
              0
            );
            const mainVecColor = isStory
              ? curEv.vectorColor || curEv.campColor || '#b53826'
              : '#b53826';
            if (segInfo) {
              this._renderCartographicTrajectory(
                [{ ...segInfo, toIdx: curIdx }],
                curIdx,
                mainVecColor,
                false
              );
              if (isStory && stepOriginIdx < 0 && (curEv.fromLabelZh || curEv.fromLabelEn)) {
                renderOriginBead(
                  soloOriginCoord,
                  curEv.fromLabelZh,
                  curEv.fromLabelEn,
                  mainVecColor
                );
              }
            }
          }
          if (isStory && Array.isArray(curEv.prongs)) {
            for (const pr of curEv.prongs) {
              if (!pr || !Array.isArray(pr.fromCoord)) continue;
              const pSeg = this._buildJourneySegmentInfo(
                pr.fromCoord,
                curEv.coord,
                pr.via || null,
                pr.bias || 0
              );
              const pColor = pr.color || curEv.campColor || '#b53826';
              if (pSeg) {
                this._renderCartographicTrajectory(
                  [{ ...pSeg, toIdx: curIdx }],
                  curIdx,
                  pColor,
                  false
                );
                if (
                  (typeof pr.fromStopIdx !== 'number' || pr.fromStopIdx < 0) &&
                  (pr.fromLabelZh || pr.fromLabelEn)
                ) {
                  renderOriginBead(pr.fromCoord, pr.fromLabelZh, pr.fromLabelEn, pColor);
                }
              }
            }
          }
        }
      } else if (curIdx >= 0 && multiLegs.length > 0) {
        for (const leg of multiLegs) {
          const segInfo = this._buildJourneySegmentInfo(
            leg.fromCoord,
            leg.toCoord,
            leg.via,
            leg.bias
          );
          if (segInfo) {
            this._renderCartographicTrajectory(
              [{ ...segInfo, toIdx: curIdx }],
              curIdx,
              leg.color,
              false
            );
          }
        }
      }
      if (vf) vf.classList.toggle('has-person-overview-lines', hasOverviewLines);

      // Deduplicate city labels so repeated visits to the same city only print its name once
      const labelOwnerByIdx = new Set();
      const placedCityLabels = [];
      const labelPriorityOrder = events
        .map((_, idx) => idx)
        .sort((a, b) => {
          if (a === curIdx) return -1;
          if (b === curIdx) return 1;
          const oa = isOriginIdx(a) ? 1 : 0;
          const ob = isOriginIdx(b) ? 1 : 0;
          if (oa !== ob) return ob - oa;
          const sa = events[a].isSharedEncounter ? 1 : 0;
          const sb = events[b].isSharedEncounter ? 1 : 0;
          if (sa !== sb) return sb - sa;
          return a - b;
        });
      for (const idx of labelPriorityOrder) {
        const ev = events[idx];
        const [sx, sy] = rawPts[idx];
        const fullLbl =
          this.locale === 'en' ? ev.siteEn || this.trTerm(ev.siteZh) : this._zh(ev.siteZh);
        const baseCity = fullLbl.replace(/\s*[（(][^）)]*[）)]\s*/g, '').trim() || fullLbl;
        const dup = placedCityLabels.some(
          (item) =>
            Math.hypot(item.sx - sx, item.sy - sy) < 3.5 ||
            (item.baseCity === baseCity && Math.hypot(item.sx - sx, item.sy - sy) < 28)
        );
        if (!dup) {
          labelOwnerByIdx.add(idx);
          placedCityLabels.push({ sx, sy, baseCity });
        }
      }

      const order = events
        .map((_, idx) => idx)
        .sort((a, b) => {
          if (a === curIdx) return 1;
          if (b === curIdx) return -1;
          const psa = peerSyncByIdx.has(a) ? 1 : 0;
          const psb = peerSyncByIdx.has(b) ? 1 : 0;
          if (psa !== psb) return psa - psb;
          const oa = isOriginIdx(a) ? 1 : 0;
          const ob = isOriginIdx(b) ? 1 : 0;
          if (oa !== ob) return oa - ob;
          if (isMulti) {
            const da = isTrackDimmed(events[a].personIdx) ? 1 : 0;
            const db = isTrackDimmed(events[b].personIdx) ? 1 : 0;
            if (da !== db) return db - da;
            const sa = events[a].isSharedEncounter ? 1 : 0;
            const sb = events[b].isSharedEncounter ? 1 : 0;
            if (sa !== sb) return sa - sb;
          }
          return a - b;
        });

      for (const idx of order) {
        const cl = clusters[idx];
        if (isMulti && !cl.isMultiCanonical) continue;
        if (!isMulti && !isStory && cl.isSoloCanonical === false) continue;
        const ev = events[idx];
        const [sx, sy] = rawPts[idx];
        const isCur = idx === curIdx;
        const isShared = Boolean(
          ev.isSharedEncounter && Array.isArray(ev.participants) && ev.participants.length >= 2
        );
        const syncPeersAtIdx = peerSyncByIdx.get(idx) || null;
        const isPeerSync = Boolean(syncPeersAtIdx && syncPeersAtIdx.length && !isCur);
        const isStepOrigin = Boolean(curIdx >= 0 && isOriginIdx(idx));
        const isOtherStep = Boolean(curIdx >= 0 && !isCur && !isStepOrigin && !isPeerSync);
        if (
          isOtherStep &&
          unnumberedOriginCoords.some(
            (oc) => Math.hypot(ev.coord[0] - oc[0], ev.coord[1] - oc[1]) < 0.25
          )
        ) {
          continue;
        }
        const isFilteredOutInOverview = Boolean(
          isMulti &&
            curIdx < 0 &&
            this.personSharedOnly &&
            this.activePerson.sameTimeCount > 0 &&
            !isShared
        );
        const dimmed =
          (!isShared && !isCur && !isPeerSync && isTrackDimmed(ev.personIdx)) ||
          isOtherStep ||
          isFilteredOutInOverview;
        const isPeerPassed =
          curIdx < 0 || dimmed || isStepOrigin || isPeerSync
            ? true
            : isMulti && curEv
              ? ev.year <= curEv.year
              : idx < curIdx;
        const stateCls =
          curIdx < 0 ? 'is-passed' : isCur ? 'is-current' : isPeerPassed ? 'is-passed' : 'is-upcoming';
        const intersectCls = isShared ? ' is-intersect' : isPeerSync ? ' is-peer-sync' : '';
        const dimCls = dimmed ? ' is-other-era' : '';
        const pinColor = !isMulti
          ? isStory
            ? isCur || isStepOrigin
              ? ev.campColor || '#9e3a26'
              : ev.campCalmColor || '#7a4b38'
            : isCur
              ? '#9e3a26'
              : '#7a4b38'
          : isPeerSync
            ? syncPeersAtIdx[0].color || ev.personColor || '#355470'
            : ev.personColor || '#9e3a26';

        const cyclePeers = cl.stackPeers || cl.peers;
        const g = this._svgNode(
          'g',
          {
            class: `journey-node ${stateCls}${intersectCls}${dimCls}`,
            'data-x': sx.toFixed(1),
            'data-y': sy.toFixed(1),
            'data-ox': cl.ox.toFixed(2),
            'data-oy': cl.oy.toFixed(2),
            'data-base-ox': cl.ox.toFixed(2),
            'data-base-oy': cl.oy.toFixed(2),
            'data-stop-idx': String(idx),
            ...(cyclePeers && cyclePeers.length > 1
              ? { 'data-peer-idxs': `,${cyclePeers.join(',')},` }
              : {}),
          },
          this.grpJourney
        );
        g.style.color = pinColor;
        if (dimmed) g.style.opacity = isOtherStep || isFilteredOutInOverview ? '0.24' : '0.36';

        const inner = this._svgNode(
          'g',
          {
            class: 'jn-pin-shift',
            transform: `translate(${cl.ox.toFixed(2)},${cl.oy.toFixed(2)})`,
          },
          g
        );

        this._svgNode(
          'circle',
          { class: 'jn-hit', r: isShared ? 15 : 13, fill: 'transparent' },
          inner
        );
        if (isShared) {
          const parts = ev.participants;
          const rDot = isCur ? 4.3 : 3.8;
          const sep = isCur ? 9.2 : 8.2;
          const pad = isCur ? 3.2 : 2.8;
          const pillW = (parts.length - 1) * sep + rDot * 2 + pad;
          const pillH = rDot * 2 + pad;
          if (isCur) {
            this._svgNode(
              'rect',
              {
                class: 'jn-pulse-pill',
                x: (-pillW * 0.5 - 2.2).toFixed(1),
                y: (-pillH * 0.5 - 2.2).toFixed(1),
                width: (pillW + 4.4).toFixed(1),
                height: (pillH + 4.4).toFixed(1),
                rx: (pillH * 0.5 + 2.2).toFixed(1),
              },
              inner
            );
          }
          this._svgNode(
            'rect',
            {
              class: 'jn-meet-pill',
              x: (-pillW * 0.5).toFixed(1),
              y: (-pillH * 0.5).toFixed(1),
              width: pillW.toFixed(1),
              height: pillH.toFixed(1),
              rx: (pillH * 0.5).toFixed(1),
            },
            inner
          );
          parts.forEach((pt, k) => {
            const dx = (k - (parts.length - 1) * 0.5) * sep;
            const dot = this._svgNode(
              'circle',
              {
                class: 'jn-disc is-meet-dot',
                cx: dx.toFixed(1),
                cy: '0',
                r: rDot,
              },
              inner
            );
            dot.style.color = pt.color;
          });
        } else if (isPeerSync) {
          this._svgNode('circle', { class: 'jn-peer-halo', r: 8.2 }, inner);
          this._svgNode('circle', { class: 'jn-disc is-peer-sync-disc', r: 5.8 }, inner);
          const numTxt = this._svgNode('text', { class: 'jn-num is-peer-sync-num', y: '0.5' }, inner);
          numTxt.textContent = String(idx + 1);
        } else {
          const rDisc = isCur ? 7.4 : isMulti ? 5.4 : 5.6;
          if (isCur) {
            this._svgNode('circle', { class: 'jn-pulse', r: 11.4 }, inner);
          } else if (!isStory && cl.stackCount > 1 && !dimmed) {
            this._svgNode('circle', { class: 'jn-stack-ring', r: (rDisc + 2.1).toFixed(1) }, inner);
          }
          this._svgNode('circle', { class: 'jn-disc', r: rDisc }, inner);
          const numTxt = this._svgNode('text', { class: 'jn-num', y: '0.5' }, inner);
          numTxt.textContent = String(isMulti ? idx + 1 : ev.personStepNum || idx + 1);
        }

        const showStartLbl = isMulti && (ev.personStepIdx === 0 || isStepOrigin) && !dimmed;
        if (
          !isOtherStep &&
          !isFilteredOutInOverview &&
          (isPeerSync || labelOwnerByIdx.has(idx) || (isMulti && (isShared || isCur || showStartLbl)))
        ) {
          const fullLbl =
            this.locale === 'en' ? ev.siteEn || this.trTerm(ev.siteZh) : this._zh(ev.siteZh);
          const baseSite = fullLbl.replace(/\s*[（(][^）)]*[）)]\s*/g, '').trim() || fullLbl;
          let compactLbl = isCur ? fullLbl : baseSite;
          if (isStory && isStepOrigin && curEv) {
            if (idx === stepOriginIdx && (curEv.fromLabelZh || curEv.fromLabelEn)) {
              compactLbl =
                this.locale === 'en'
                  ? curEv.fromLabelEn || fullLbl
                  : this._zh(curEv.fromLabelZh || fullLbl);
            } else if (Array.isArray(curEv.prongs)) {
              const matchPr = curEv.prongs.find(
                (p) => p && p.fromStopIdx === idx && (p.fromLabelZh || p.fromLabelEn)
              );
              if (matchPr) {
                compactLbl =
                  this.locale === 'en'
                    ? matchPr.fromLabelEn || fullLbl
                    : this._zh(matchPr.fromLabelZh || fullLbl);
              }
            }
          }
          if (isPeerSync && syncPeersAtIdx) {
            const peerNames = syncPeersAtIdx
              .map((a) => (this.locale === 'en' ? a.profile.en : this._zh(a.profile.zh)))
              .join('/');
            compactLbl = `${baseSite} · ${peerNames}`;
          }
          const lblTxt = this._svgNode(
            'text',
            {
              class: `jn-label${isShared ? ' is-intersect-label' : ''}${
                isPeerSync ? ' is-peer-sync-label' : ''
              }`,
              x: '0',
              y: isShared ? '-9.8' : !isCur && cl.stackCount > 1 ? '-11.8' : '-10.8',
            },
            inner
          );
          lblTxt.textContent = this._mapText(compactLbl);
        }
      }

      this._invalidateTypographyLayout();
      this._rescaleSvgTypography();
    }

    _setHoveredPersonPin(idx) {
      if (!this.grpJourney) return;
      this.grpJourney.querySelectorAll('.journey-node').forEach((jn) => {
        const directHit = Number(jn.dataset.stopIdx) === idx;
        const peerHit =
          idx >= 0 &&
          jn.dataset.peerIdxs !== undefined &&
          jn.dataset.peerIdxs.includes(`,${idx},`);
        jn.classList.toggle('is-hover-pin', directHit || peerHit);
      });
    }

    _renderPersonChronicleCard(preserveScroll = false) {
      if (!this.activePerson) return;
      const {
        profile,
        profiles,
        isMulti,
        tracks,
        events,
        sameTimeCount,
      } = this.activePerson;
      const curIdx = this.activePersonEventIdx;
      const isEn = this.locale === 'en';
      const isAdhoc = String(profile.key || '').startsWith('adhoc_');
      const listEl = this._id('genealogy-timeline');
      const stateKey = (profiles || [profile]).map((p) => p.key).join(',');
      const personCardKey = `${stateKey}:${this._effectiveRenderedLocale()}:${events.length}:${Boolean(
        this.personSharedOnly
      )}`;
      if (
        preserveScroll &&
        this._lastPersonCardKey === personCardKey &&
        listEl &&
        listEl.children &&
        listEl.children.length > 0
      ) {
        const ovBtn = this._id('act-person-overview');
        if (ovBtn) ovBtn.classList.toggle('is-active', curIdx < 0);
        const shBtn = this._id('act-person-shared-only');
        if (shBtn) shBtn.classList.toggle('is-active', Boolean(this.personSharedOnly));
        this._renderPersonFooter(events, curIdx, isEn);
        if (this.locale === 'zh-tw') this._applyZhHantDom(this._id('genealogy-foot'));
        let activeLi = null;
        Array.from(listEl.children).forEach((li) => {
          if (!li.dataset || li.dataset.evIdx === undefined) return;
          const rowIdx = Number(li.dataset.evIdx);
          const isCur = rowIdx === curIdx;
          li.classList.toggle('is-current', isCur);
          if (isCur) activeLi = li;
        });
        if (activeLi && typeof activeLi.scrollIntoView === 'function') {
          if (this._personScrollRaf) cancelAnimationFrame(this._personScrollRaf);
          if (typeof requestAnimationFrame === 'function') {
            this._personScrollRaf = requestAnimationFrame(() => {
              this._personScrollRaf = null;
              if (activeLi) activeLi.scrollIntoView({ block: 'nearest' });
            });
          } else {
            activeLi.scrollIntoView({ block: 'nearest' });
          }
        }
        return;
      }
      this._lastPersonCardKey = personCardKey;

      const kickerEl = this._id('txt-genealogy-kicker');
      if (kickerEl) {
        kickerEl.textContent = profile.isStory
          ? isEn
            ? 'Event Storyline · Multi-Act Chronicle'
            : '点事溯局 · 历史大事件全脉络'
          : profile.isRelic
            ? isEn
              ? 'Relic Provenance · Across Dynasties'
              : '点物溯史 · 传世国器流转'
            : isEn
              ? 'Person Chronicle · Key Life Milestones'
              : '点人溯事 · 生平大事记';
      }

      const headingEl = this._id('genealogy-heading');
      if (headingEl) {
        if (isMulti) {
          headingEl.innerHTML = tracks
            .map((tr) => {
              const name = escHtml(isEn ? tr.profile.en : tr.profile.zh);
              return (
                `<span class="mp-title-person" style="--track-color:${tr.color}">` +
                `<button type="button" class="mp-title-solo" data-solo-key="${escHtml(tr.profile.key)}" title="${
                  isEn ? 'View solo chronicle' : '单独查看此人行迹'
                }">` +
                `<span class="mp-title-dot" style="background:${tr.color}"></span>` +
                `<span>${name}</span>` +
                `</button>` +
                `<button type="button" class="mp-title-remove" data-remove-key="${escHtml(tr.profile.key)}" title="${
                  isEn ? 'Remove' : '移除'
                }">×</button>` +
                `</span>`
              );
            })
            .join('<span class="mp-title-sep">×</span>');
          headingEl.querySelectorAll('.mp-title-solo').forEach((btn) => {
            btn.addEventListener('click', () => {
              const soloKey = btn.dataset.soloKey;
              const visTracks = this._getVisiblePersonTracks();
              const isAlreadySoleOnMap =
                visTracks.length === 1 && visTracks[0].profile && visTracks[0].profile.key === soloKey;
              if (!isAlreadySoleOnMap && visTracks.every((t) => !t.profile || t.profile.key !== soloKey)) {
                const firstIdx = events.findIndex((e) => e.personKey === soloKey);
                if (firstIdx >= 0) {
                  this.selectPersonEvent(firstIdx, true);
                  return;
                }
              }
              this.openPersonChronicle(soloKey, -1);
            });
          });
          headingEl.querySelectorAll('.mp-title-remove').forEach((btn) => {
            btn.addEventListener('click', () => {
              const rem = profiles.filter((p) => p.key !== btn.dataset.removeKey);
              if (rem.length) this.openPersonChronicle(rem, -1);
            });
          });
        } else {
          const spanStr = this._formatPersonSpan(profile.span, isAdhoc, profile.spanUnknown);
          headingEl.textContent = `${isEn ? profile.en : profile.zh}${spanStr}`;
        }
      }

      const fmtYrShort = (y) =>
        isEn ? this.formatYear(y) : y <= 0 ? `前${-y}` : `${y}`;

      const loreEl = this._id('genealogy-lore');
      if (loreEl) {
        if (isMulti) {
          const validSpans = tracks
            .map((tr) => ({
              tr,
              span: Array.isArray(tr.profile.span) ? tr.profile.span : null,
            }))
            .filter((item) => item.span);
          let minSpan = Infinity;
          let maxSpan = -Infinity;
          let ovStart = -Infinity;
          let ovEnd = Infinity;
          for (const { span } of validSpans) {
            if (span[0] < minSpan) minSpan = span[0];
            if (span[1] > maxSpan) maxSpan = span[1];
            if (span[0] > ovStart) ovStart = span[0];
            if (span[1] < ovEnd) ovEnd = span[1];
          }
          const hasCommonOverlap = validSpans.length >= 2 && ovEnd >= ovStart;
          const ovYears = hasCommonOverlap ? Math.max(1, ovEnd - ovStart + 1) : 0;
          const badgeLabel = isEn ? 'Co-Lifespan' : '同世交集';
          const rangeLabel = hasCommonOverlap
            ? isEn
              ? `${ovYears} yrs (${fmtYrShort(ovStart)}–${fmtYrShort(ovEnd)})`
              : `共处 ${ovYears} 载（${fmtYrShort(ovStart)}—${fmtYrShort(ovEnd)}）`
            : isEn
              ? 'Cross-era comparison'
              : `隔代并观 · 跨 ${Math.max(1, maxSpan - minSpan)} 载`;

          let ganttHtml = '';
          if (validSpans.length >= 2 && maxSpan > minSpan) {
            const totalW = Math.max(1, maxSpan - minSpan);
            const ovLeft = hasCommonOverlap ? ((ovStart - minSpan) / totalW) * 100 : 0;
            const ovWidth = hasCommonOverlap ? Math.max(1.5, ((ovEnd - ovStart) / totalW) * 100) : 0;
            const rowsHtml = validSpans
              .map(({ tr, span }) => {
                const leftPct = Math.max(0, Math.min(98, ((span[0] - minSpan) / totalW) * 100));
                const widthPct = Math.max(
                  3,
                  Math.min(100 - leftPct, ((span[1] - span[0]) / totalW) * 100)
                );
                const pName = escHtml(isEn ? tr.profile.en : tr.profile.zh);
                const u = tr.profile.spanUnknown || '';
                const sLbl = `${u === 'birth' || u === 'both' ? '?' : fmtYrShort(span[0])}—${u === 'death' || u === 'both' ? '?' : fmtYrShort(span[1])}`;
                return (
                  `<div class="mp-span-row">` +
                  `<span class="mp-span-name" style="color:${tr.color}">${pName}</span>` +
                  `<span class="mp-span-track">` +
                  (hasCommonOverlap
                    ? `<i class="mp-span-overlap" style="left:${ovLeft.toFixed(1)}%;width:${ovWidth.toFixed(1)}%"></i>`
                    : '') +
                  `<i class="mp-span-bar" style="left:${leftPct.toFixed(1)}%;width:${widthPct.toFixed(1)}%;background:${tr.color}"></i>` +
                  `</span>` +
                  `<span class="mp-span-yrs">${sLbl}</span>` +
                  `</div>`
                );
              })
              .join('');
            ganttHtml = `<div class="mp-span-chart">${rowsHtml}</div>`;
          }

          const sharedStops = [];
          events.forEach((ev, idx) => {
            if (!ev.isSharedEncounter) return;
            const rawS = isEn ? ev.siteEn || this.trTerm(ev.siteZh) : ev.siteZh;
            const cleanS = rawS.replace(/\s*[（(][^）)]*[）)]\s*/g, '').trim() || rawS;
            sharedStops.push({ idx, label: cleanS });
          });
          const sharedLineHtml = sharedStops.length
            ? `<div class="mp-meet-line">` +
              `<span class="mp-lore-lbl">${isEn ? 'Encounters:' : '际会：'}</span>` +
              sharedStops
                .slice(0, 6)
                .map(
                  (st) =>
                    `<button type="button" class="mp-inline-link is-shared-jump" data-jump-idx="${st.idx}">${escHtml(
                      st.label
                    )}</button>`
                )
                .join('<span class="mp-dot-sep">·</span>') +
              `</div>`
            : '';

          loreEl.innerHTML =
            `<div class="pass-lore-head"><span class="pass-lore-badge">${badgeLabel}</span><span class="pass-lore-range">${rangeLabel}</span></div>` +
            ganttHtml +
            sharedLineHtml;
          loreEl.classList.remove('is-hidden');
          loreEl.querySelectorAll('.is-shared-jump').forEach((btn) => {
            btn.addEventListener('click', () => {
              const jIdx = Number(btn.dataset.jumpIdx);
              if (!Number.isNaN(jIdx)) this.selectPersonEvent(jIdx, true);
            });
          });
        } else {
          const subTitle = isEn ? profile.courtesyEn || '' : profile.courtesyZh || '';
          const badgeLabel = profile.isStory
            ? isEn
              ? 'Storyline'
              : '史事本末'
            : profile.isRelic
              ? isEn
                ? 'Imperial Relic'
                : '国器本纪'
              : isEn
                ? 'Biography'
                : '人物小传';
          const descText =
            profile.isRelic || profile.isStory
              ? (isEn ? profile.descEn : profile.descZh) || ''
              : '';

          if (subTitle || descText) {
            let campLegendHtml = '';
            if (profile.isStory && Array.isArray(profile.camps) && profile.camps.length >= 2) {
              const cItems = profile.camps
                .map(
                  (c) =>
                    `<span class="story-camp-chip" style="--camp-color:${c.color}"><i class="story-camp-dot"></i><span>${escHtml(
                      isEn ? c.en : c.zh
                    )}</span></span>`
                )
                .join('<span class="story-camp-vs">⚔</span>');
              campLegendHtml = `<div class="story-camp-legend">${cItems}</div>`;
            }
            loreEl.innerHTML =
              `<div class="pass-lore-head"><span class="pass-lore-badge">${badgeLabel}</span><span class="pass-lore-range">${subTitle}</span></div>` +
              (descText ? `<div class="pass-lore-desc">${descText}</div>` : '') +
              campLegendHtml;
            loreEl.classList.remove('is-hidden');
          } else {
            loreEl.innerHTML = '';
            loreEl.classList.add('is-hidden');
          }
        }
      }

      const dynCount = new Set(events.map((e) => e.dynasty.key)).size;
      const subEl = this._id('genealogy-sub');
      if (subEl) {
        let summaryTxt;
        if (profile.isStory) {
          const spanYears = Array.isArray(profile.span)
            ? Math.max(1, profile.span[1] - profile.span[0] + 1)
            : 1;
          summaryTxt = isEn
            ? `${events.length} key scenes · ${spanYears} yrs`
            : `精选 ${events.length} 处关键节点 · 历 ${spanYears} 年`;
        } else {
          summaryTxt = isEn
            ? `${events.length} key events · ${dynCount} era${dynCount > 1 ? 's' : ''}`
            : `${isMulti ? '共' : '精选'} ${events.length} 处${isMulti ? '史事' : '代表史事'} · 历 ${dynCount} 朝`;
        }
        const returnStoryBtn =
          !profile.isStory && this._returnStoryState
            ? `<button type="button" class="gen-filter-pill" id="act-return-story">← ${escHtml(
                isEn
                  ? `Back to ${this._returnStoryState.en}`
                  : `返回${this._returnStoryState.zh}`
              )}</button>`
            : '';
        const sharedFilterBtn =
          isMulti && sameTimeCount > 0
            ? `<button type="button" class="gen-filter-pill${
                this.personSharedOnly ? ' is-active' : ''
              }" id="act-person-shared-only" title="${
                isEn ? 'Filter to shared encounters only' : '仅看多人同途交汇节点'
              }">${isEn ? `Shared ${sameTimeCount}` : `同途 ${sameTimeCount}`}</button>`
            : '';
        const tSlug = !isMulti
          ? profile.isStory
            ? `story-${profile.key}`
            : profile.journeyKey
              ? `journey-${profile.journeyKey}`
              : profile.isRelic || (profile.evCount || 0) >= 5
                ? `person-${profile.key}`
                : ''
          : '';
        const topicLinkBtn = tSlug
          ? `<a class="topic-inline-link" href="topics/${escHtml(tSlug)}.html" target="_blank" rel="noopener" title="${isEn ? 'Topic guide' : '查阅专题图志'}">${isEn ? 'Guide' : '图志'}</a>`
          : '';
        subEl.innerHTML =
          `<span>${summaryTxt}</span>` +
          `<span class="person-sub-actions">` +
          `${returnStoryBtn}` +
          `${sharedFilterBtn}` +
          `${topicLinkBtn}` +
          `<button type="button" class="gen-filter-pill${
            curIdx < 0 ? ' is-active' : ''
          }" id="act-person-overview">${isEn ? 'Overview' : '全图总览'}</button>` +
          `</span>`;

        const retBtn = this._id('act-return-story');
        if (retBtn && this._returnStoryState) {
          retBtn.addEventListener('click', () => {
            const ret = this._returnStoryState;
            this._returnStoryState = null;
            this.openPersonChronicle(ret.key, ret.stopIdx);
          });
        }
        const shBtn = this._id('act-person-shared-only');
        if (shBtn) {
          shBtn.addEventListener('click', () => {
            this.personSharedOnly = !this.personSharedOnly;
            if (
              this.personSharedOnly &&
              this.activePersonEventIdx >= 0 &&
              !events[this.activePersonEventIdx]?.isSharedEncounter
            ) {
              this.activePersonEventIdx = -1;
              this._scheduleUrlSync();
            }
            this._renderPersonPinsOverlay();
            this._renderPersonChronicleCard(false);
            if (this.activePersonEventIdx < 0) {
              this._framePersonOverview(
                this.personSharedOnly ? events.filter((e) => e.isSharedEncounter) : null
              );
            }
          });
        }
        const ovBtn = this._id('act-person-overview');
        if (ovBtn) {
          ovBtn.addEventListener('click', () => {
            this.selectPersonEvent(-1, true);
          });
        }
      }
      this._renderPersonFooter(events, curIdx, isEn);

      const scrollEl = this._id('genealogy-body') || listEl;
      const prevScroll = scrollEl && preserveScroll ? scrollEl.scrollTop : 0;
      if (!listEl) return;
      listEl.innerHTML = '';

      let activeLi = null;
      events.forEach((ev, idx) => {
        const isShared = Boolean(ev.isSharedEncounter);
        const li = document.createElement('li');
        const intersectRowCls = isShared ? ' is-intersect-row' : '';
        const hiddenCls =
          this.personSharedOnly && isMulti && sameTimeCount > 0 && !isShared ? ' is-hidden' : '';
        const actTitle = profile.isStory ? (isEn ? ev.actEn : ev.actZh) || '' : '';
        if (actTitle) {
          const actLi = document.createElement('li');
          actLi.className = 'story-act-row';
          actLi.innerHTML = `<span class="story-act-head">${escHtml(actTitle)}</span>`;
          listEl.appendChild(actLi);
        }
        li.className = `person-ev-row${idx === curIdx ? ' is-current' : ''}${intersectRowCls}${hiddenCls}`;
        if (profile.isStory && ev.campColor) {
          li.style.setProperty('--camp-color', ev.campColor);
        }
        li.dataset.evIdx = String(idx);
        if (idx === curIdx) activeLi = li;

        const yrStr = isEn
          ? this.formatYear(ev.year)
          : `${ev.year <= 0 ? '前' + -ev.year : ev.year}年`;
        const rawSite = isEn ? ev.siteEn || this.trTerm(ev.siteZh) : ev.siteZh;
        const siteLabel = rawSite.replace(/\s*[（(][^）)]*[）)]\s*/g, '').trim() || rawSite;
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

        let leftBadgeHtml;
        if (isMulti) {
          const tagItems = isShared && Array.isArray(ev.participants)
            ? ev.participants
            : [{ personEn: ev.personEn, personZh: ev.personZh, color: ev.personColor }];
          const primaryColor = (tagItems[0] && tagItems[0].color) || ev.personColor || '#9e3a26';
          const tagsHtml = tagItems
            .map(
              (pt) =>
                `<span class="person-track-tag" style="--track-color:${pt.color}">` +
                `<span class="pt-name">${escHtml(isEn ? pt.personEn : pt.personZh)}</span>` +
                `</span>`
            )
            .join('');
          leftBadgeHtml =
            `<span class="mp-era-top"><span class="cr-stop-num mp-row-num" style="--track-color:${primaryColor}">${idx + 1}</span>` +
            `<span class="person-track-tags-group">${tagsHtml}</span></span>` +
            `<span class="person-yr-sub">${yrStr} · ${this.dynastyName(ev.dynasty)}</span>`;
        } else {
          const subTimeLbl =
            (isEn ? ev.subEraEn : ev.subEraZh) || this.dynastyName(ev.dynasty);
          leftBadgeHtml =
            `<span class="person-idx-line"><span class="cr-stop-num">${idx + 1}</span><span>${yrStr}</span></span>` +
            `<span class="t-sub">${escHtml(subTimeLbl)}</span>`;
        }

        let storyLinkedCopy = isEn ? ev.textEn : ev.textZh;
        if (profile.isStory && Array.isArray(ev.actors) && ev.actors.length) {
          for (const ac of ev.actors) {
            const targetKey = ac.key || ac.zh;
            const cands = isEn
              ? [ac.en].filter(Boolean)
              : [ac.zh, ac.zh && ac.zh.replace(/^唐/, '')].filter(Boolean);
            const actorStyle = ac.color ? ` style="--actor-color:${ac.color}"` : '';
            // Actors without a person profile (王贲, 荆轲, …) stay coloured but are not buttons.
            const linkable = Boolean(this._resolvePersonProfile(targetKey));
            for (const term of cands) {
              if (term && storyLinkedCopy.includes(term)) {
                storyLinkedCopy = storyLinkedCopy.replace(
                  term,
                  linkable
                    ? `<button type="button" class="story-inline-person"${actorStyle} data-actor-key="${escHtml(
                        targetKey
                      )}" title="${isEn ? 'Open person chronicle' : '点击查看此人生平大事记'}">${term}</button>`
                    : `<span class="story-inline-person"${actorStyle}>${term}</span>`
                );
                break;
              }
            }
          }
        }

        const copyHtml =
          isShared && Array.isArray(ev.distinctNotes) && ev.distinctNotes.length > 1
            ? ev.distinctNotes
                .map(
                  (pt) =>
                    `<span class="t-sub person-ev-copy person-ev-subnote">` +
                    `<i class="person-ev-dot" style="background:${pt.color}"></i>` +
                    `${isEn ? pt.textEn : pt.textZh}` +
                    `</span>`
                )
                .join('')
            : `<span class="t-sub person-ev-copy">${storyLinkedCopy}</span>`;

        li.innerHTML =
          `<span class="t-era person-era-col">${leftBadgeHtml}</span>` +
          `<span class="t-val">` +
          `<span class="person-site-line"><span>${siteLabel}${mapBadge}</span>${traceBtn}</span>` +
          `${copyHtml}` +
          `${quoteHtml}` +
          `</span>`;

        li.querySelectorAll('.story-inline-person').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const aKey = btn.dataset.actorKey;
            if (aKey) {
              this._returnStoryState = {
                key: profile.key,
                zh: profile.zh,
                en: profile.en,
                stopIdx: curIdx >= 0 ? curIdx : idx,
              };
              this.openPersonChronicle(aKey, -1);
            }
          });
        });

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
            const savedReturn = {
              profile: isMulti ? profiles.map((p) => p.key).join(',') : profile,
              labelZh: isMulti ? profiles.map((p) => p.zh).join('×') : profile.zh,
              labelEn: isMulti ? profiles.map((p) => p.en).join(' × ') : profile.en,
              eventIdx: idx,
            };
            this.jumpToYear(this._clampYearToDynasty(ev.dynasty, ev.year));
            this._openGenealogy(ev.coord[0], ev.coord[1], ev.siteZh, {
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

    // Stop navigation lives at the bottom of the card, where the reader finishes
    // the current entry; naming the next stop gives a reason to keep going.
    _renderPersonFooter(events, curIdx, isEn) {
      const footEl = this._id('genealogy-foot');
      if (!footEl) return;
      const isMulti = Boolean(this.activePerson && this.activePerson.isMulti);
      const navIdxs = this._getNavigablePersonEventIdxs();
      const navPos = navIdxs.indexOf(curIdx);
      const nextIdx =
        curIdx < 0
          ? navIdxs.length
            ? navIdxs[0]
            : -1
          : navPos >= 0 && navPos + 1 < navIdxs.length
            ? navIdxs[navPos + 1]
            : curIdx + 1 < events.length && !this.personSharedOnly
              ? curIdx + 1
              : -1;
      const prevIdx =
        navPos > 0 ? navIdxs[navPos - 1] : !this.personSharedOnly && curIdx > 0 ? curIdx - 1 : -1;
      const next = nextIdx >= 0 ? events[nextIdx] : null;
      let nextLabel;
      if (next) {
        const rawNextSite = isEn ? next.siteEn || this.trTerm(next.siteZh) : next.siteZh;
        const site = escHtml(
          rawNextSite.replace(/\s*[（(][^）)]*[）)]\s*/g, '').trim() || rawNextSite
        );
        const whoPrefix = isMulti
          ? next.isSharedEncounter && Array.isArray(next.participants)
            ? `${next.participants.map((p) => escHtml(isEn ? p.personEn : p.personZh)).join('×')} · `
            : `${escHtml(isEn ? next.personEn : next.personZh)} · `
          : '';
        const yr = isEn
          ? ` · ${this.formatYear(next.year)}`
          : ` · ${next.year <= 0 ? '前' + -next.year : next.year}年`;
        const lead = curIdx < 0 ? (isEn ? 'Start' : '出发') : isEn ? 'Next' : '下一站';
        nextLabel = `${lead} · ${whoPrefix}${site}${yr}`;
      } else {
        nextLabel = isEn ? 'Back to overview' : '回到全图总览';
      }
      const prevTitle = isEn ? 'Prev' : '上一站';
      footEl.innerHTML =
        `<button type="button" class="gen-foot-prev" id="act-person-prev" title="${prevTitle}"${
          curIdx < 0 ? ' disabled' : ''
        }>${SVG_ICONS.arrowLeft}<span>${prevTitle}</span></button>` +
        `<button type="button" class="gen-foot-next" id="act-person-next"><span>${nextLabel}</span>${SVG_ICONS.arrowRight}</button>`;
      footEl.classList.remove('is-hidden');
      const prevBtn = footEl.querySelector('#act-person-prev');
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          this.selectPersonEvent(prevIdx, true);
        });
      }
      const nextBtn = footEl.querySelector('#act-person-next');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => this.selectPersonEvent(next ? nextIdx : -1, true));
      }
    }

    _hidePersonFooter() {
      const footEl = this._id('genealogy-foot');
      if (!footEl) return;
      footEl.classList.add('is-hidden');
      footEl.innerHTML = '';
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

    _buildJourneySegmentInfo(c1, c2, viaCoords, curveBiasOffset = 0) {
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
        const bend = Math.max(9, Math.min(34, chord * 0.165)) + curveBiasOffset;
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

    _renderCartographicTrajectory(segments, curIdx, accentColor = '#bd2d22', dimmed = false) {
      if (!this.grpJourney || !Array.isArray(segments) || !segments.length) return;
      const applyDim = (el) => {
        if (dimmed && el && el.style) el.style.opacity = '0.32';
        return el;
      };
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
        applyDim(g);
        this._svgNode(
          'path',
          { d: 'M-4.5 -3.15L3.55 0L-4.5 3.15L-2.3 0Z', class: 'journey-chevron' },
          g
        );
      };

      if (curIdx < 0) {
        const fullD = segments.map((s) => s.d).join(' ');
        applyDim(
          this._svgNode(
            'path',
            { d: fullD, class: 'journey-track-halo is-overview' },
            this.grpJourney
          )
        );
        applyDim(
          this._svgNode(
            'path',
            { d: fullD, class: 'journey-track-thread is-overview', stroke: accentColor },
            this.grpJourney
          )
        );
        const placedMarks = [];
        for (const seg of segments) {
          if (seg.chord < 28) continue;
          if (placedMarks.some(([px, py]) => Math.hypot(px - seg.mx, py - seg.my) < 22)) continue;
          placedMarks.push([seg.mx, seg.my]);
          appendChevron(seg, 'is-muted');
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
        this._svgNode(
          'path',
          { d: upcomingD, class: 'journey-track-upcoming', stroke: accentColor },
          this.grpJourney
        );
      }
      if (passedD) {
        this._svgNode(
          'path',
          { d: passedD, class: 'journey-track-passed', stroke: accentColor },
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
          { d: focusSeg.d, class: 'journey-track-focus', stroke: accentColor },
          this.grpJourney
        );
        appendChevron(focusSeg, 'is-focus');
      }
    }
  }

  function install(Ctrl) {
    HistoricalAtlasController = Ctrl;
    MercatorProjector = Ctrl._projectorClass || (typeof window !== 'undefined' ? window.MercatorProjector : null);
    escHtml = Ctrl._escHtml;
    SVG_ICONS = Ctrl._svgIcons;
    Ctrl._extendPrototype(AtlasPersonMixin);
  }

  if (typeof window === 'undefined') return;
  const readyCtrl = window.HistoricalAtlasController;
  if (readyCtrl && typeof readyCtrl._extendPrototype === 'function') {
    install(readyCtrl);
  } else {
    (window.__ATLAS_MIXINS = window.__ATLAS_MIXINS || []).push(install);
  }
})();
