/**
 * Place Genealogy Module (点地溯源)
 * Attaches spatial-temporal place genealogy, era-matched settlement/prefecture lookup,
 * and city/pass lore banner resolution methods onto HistoricalAtlasController.
 */
(function () {
  'use strict';

  // Bound at install time so this file may load before or after js/app.js.
  let HistoricalAtlasController = null;
  let MercatorProjector = null;
  let escHtml = null;
  let SVG_ICONS = null;

  const PLACE_TOPIC_SLUGS = {
    西安: 'xian',
    洛阳: 'luoyang',
    北京: 'beijing',
    南京: 'nanjing',
    开封: 'kaifeng',
    成都: 'chengdu',
    杭州: 'hangzhou',
    荆州: 'jingzhou',
    扬州: 'yangzhou',
    襄阳: 'xiangyang',
    广州: 'guangzhou',
    太原: 'taiyuan',
    大同: 'datong',
    武威: 'wuwei',
    敦煌: 'dunhuang',
    长沙: 'changsha',
    福州: 'fuzhou',
    汉中: 'hanzhong',
    苏州: 'suzhou',
    桂林: 'guilin',
    大理: 'dali',
    拉萨: 'lhasa',
  };

  class AtlasGenealogyMixin {
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
        btnEl.innerHTML = next ? SVG_ICONS.collapse : SVG_ICONS.expand;
        btnEl.setAttribute('aria-expanded', String(next));
        if (btnEl.classList) btnEl.classList.toggle('is-active', next);
      }
    }

    _clearActiveTrace() {
      if (this.activeTrace) this._scheduleUrlSync();
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

    _resolvePlaceLoreBanner(lng, lat, matchedPass, identityModern, rowsData) {
      if (matchedPass) {
        return {
          badge: this.locale === 'en' ? 'Strategic Pass' : '雄关形胜',
          tag: (this.locale === 'en' ? matchedPass.rangeEn : matchedPass.rangeZh) || '',
          desc: (this.locale === 'en' ? matchedPass.chokepointEn : matchedPass.chokepointZh) || '',
          tagEn: matchedPass.rangeEn || '',
          descEn: matchedPass.chokepointEn || '',
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
          topicSlug: PLACE_TOPIC_SLUGS[bestCity.modern] || '',
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

      if (!roleGroupsZh.length) {
        const keyEraSet = new Set(['qin', 'xihan', 'tang', 'beisong', 'yuan', 'ming', 'qing']);
        const eraRows = rowsData
          ? rowsData.filter((r) => r.d && keyEraSet.has(r.d.key))
          : (this.dynasties || [])
              .filter((dyn) => keyEraSet.has(dyn.key))
              .map((dyn) => {
                const sk = this._resolveSnapKey(dyn, dyn.focusYear);
                const sn = (this.snapshots && this.snapshots[sk]) || {
                  polities: [],
                  regions: [],
                  prefectures: [],
                };
                const eh = this._resolveEraPlaceAt(lng, lat, dyn, sn);
                return {
                  d: dyn,
                  polityHit: eh.polity,
                  regionObjs: eh.regionObjs,
                  prefObjs: eh.prefObjs,
                };
              });
        for (const r of eraRows) {
          const regs = r.regionObjs || [];
          const prefs = r.prefObjs || [];
          for (const p of prefs) addAncName(p.title);
          const items = [...regs, ...prefs];
          if (!items.length && !r.polityHit) continue;
          const remZh = items.length ? `属${items.map((x) => x.title).join('·')}` : `属${r.polityHit}`;
          const dynZh = r.d.title;
          const exZh = roleGroupsZh.find((g) => g.rem === remZh);
          if (exZh) {
            if (!exZh.dyns.includes(dynZh) && exZh.dyns.length < 2) exZh.dyns.push(dynZh);
          } else if (roleGroupsZh.length < 4) {
            roleGroupsZh.push({ dyns: [dynZh], rem: remZh });
          }

          const enParts = items
            .map((x) => this._enDict(x.title))
            .filter((s) => s && !/[\u4e00-\u9fa5]/.test(s));
          const polEn = r.polityHit ? this._enDict(r.polityHit) : '';
          const remEn = enParts.length
            ? `Administered under ${enParts.join(' · ')}`
            : polEn && !/[\u4e00-\u9fa5]/.test(polEn)
              ? `Within ${polEn}`
              : '';
          const enDynObj =
            (this.enLocale && this.enLocale.dynasties && this.enLocale.dynasties[r.d.key]) || {};
          const dynEn = enDynObj.name || r.d.title;
          if (remEn) {
            const exEn = roleGroupsEn.find((g) => g.rem === remEn);
            if (exEn) {
              if (!exEn.dyns.includes(dynEn) && exEn.dyns.length < 2) exEn.dyns.push(dynEn);
            } else if (roleGroupsEn.length < 4) {
              roleGroupsEn.push({ dyns: [dynEn], rem: remEn });
            }
          }
        }
        if (!roleGroupsZh.length && identityModern) {
          roleGroupsZh.push({ dyns: ['现代'], rem: `${identityModern}及南海诸岛海域重镇` });
          roleGroupsEn.push({
            dyns: ['Modern'],
            rem: `Strategic municipality of ${modCompareEn || 'China'}`,
          });
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
        if (Array.isArray(nearCity.aliases)) {
          for (const al of nearCity.aliases) {
            const cleanAl = String(al || '').replace(/（.*?）|\(.*?\)/g, '').trim();
            if (cleanAl.length >= 2 && siteStr.includes(cleanAl)) return true;
          }
        }
        if (nearCity.modern) {
          const parts = nearCity.modern.split(/[·/、]/).map((s) => s.trim()).filter((s) => s.length >= 2);
          if (parts.some((p) => siteStr.includes(p))) return true;
        }
        return false;
      };

      // Two seats can lie within one radius (Yangzhou and Zhenjiang are 21 km apart across the
      // Yangtze). An event pinned on another known city, and at least twice as far from here,
      // is that city's. Successive sites of one city (范阳, 大都, 北平) are not "another", nor
      // are the posts and camps around it (陈桥驿), which are not settlements of any period.
      this._everySettlement = this._everySettlement || this.dynasties.flatMap((dy) => dy.settlements || []);
      const onAnotherCity = (c) => {
        const other = this._findNearestSettlement(this._everySettlement, c[0], c[1], 12);
        if (!other) return false;
        const km = (p) => this.projector.greatCircleKm(p, other.s.coord);
        if (km([lng, lat]) <= 15 || (nearCity && km(nearCity.coord) <= 15)) return false;
        return other.km * 2 < this.projector.greatCircleKm([lng, lat], c);
      };
      const isNearby = (c, maxKm) => isCloseCoord(c, maxKm) && !onAnotherCity(c);

      // 1. Dynasty milestones
      for (const m of d.milestones || []) {
        const mCoords = this._milestoneCoords(m);
        const veryClose = mCoords.some((mc) => isNearby(mc, 28));
        // Guard site-name matching by coordinate proximity so historical homonyms
        // (e.g. Northern Song 南京应天府 at Shangqiu vs. Jiangsu Nanjing) do not leak across regions.
        const siteMatch =
          matchesSiteName(m.site) && (!mCoords.length || mCoords.some((mc) => isCloseCoord(mc, 100)));
        if (siteMatch || veryClose || (!nearCity && mCoords.some((mc) => isCloseCoord(mc, 48)))) {
          results.push({
            year: m.year,
            text: this.milestoneHeadline(d, m),
            milestone: m,
          });
        }
      }

      // 2. Historical journeys. Stop titles are headings ("外放通判·寄情西湖"), so
      // they are shown as "苏轼：外放通判，寄情西湖" to read like the other events;
      // the place is already the panel's subject.
      for (const j of HistoricalAtlasController.HISTORICAL_JOURNEYS) {
        const person = HistoricalAtlasController.PERSON_PROFILES.find(
          (p) => p.journeyKey === j.key || p.key === j.key
        );
        const nameZh = person ? person.zh : j.shortZh;
        const nameEn = person ? person.en : j.shortEn;
        j.stops.forEach((st) => {
          const inDynSpan = st.year >= d.fromYear && st.year <= d.toYear;
          if (!inDynSpan && j.dynastyKey !== d.key) return;
          if (j.key === 'zhugeliang' && !inDynSpan) return;
          if (isNearby(st.coord, 45) && !results.some((r) => r.year === st.year)) {
            // Descriptions that already name the person ("黄河决口逼城，苏轼……") need no prefix.
            const descZh = st.descZh.split(/[；。]/)[0];
            const descEn = `${st.descEn.split('.')[0]}.`;
            results.push({
              year: st.year,
              text:
                this.locale === 'en'
                  ? `${nameEn}: ${st.titleEn}`
                  : `${nameZh}：${st.titleZh.replace(/\s*·\s*/g, '，')}`,
              milestone: {
                year: st.year,
                headline: descZh.includes(nameZh) ? descZh : `${nameZh}：${descZh}`,
                headlineEn: descEn.includes(nameEn) ? descEn : `${nameEn}: ${descEn}`,
                site: `${st.ancientZh}（今${st.modernZh}）`,
                siteEn: `${st.ancientEn} (${st.modernEn})`,
                coord: st.coord,
              },
            });
          }
        });
      }

      // 3. Curated landmark events
      const sharesCjkBigram = (a, b) => {
        const s1 = String(a || '');
        const s2 = String(b || '');
        for (let i = 0; i < s1.length - 1; i++) {
          const bg = s1.slice(i, i + 2);
          if (/^[\u4e00-\u9fa5]{2}$/.test(bg) && s2.includes(bg)) return true;
        }
        return false;
      };
      for (const lm of HistoricalAtlasController.PLACE_LANDMARK_EVENTS) {
        const dynMatch = lm.dynastyKey
          ? (lm.dynastyKey === d.key || (lm.dynastyKey === 'nanbeichao' && d.key === 'nanbei'))
          : (lm.year >= d.fromYear && lm.year <= d.toYear);
        if (!dynMatch) continue;
        if (isNearby(lm.coord, 45)) {
          const dup = results.some((r) =>
            r.fromLandmark
              ? r.year === lm.year && sharesCjkBigram(r.milestone && r.milestone.headline, lm.zh)
              : Math.abs(r.year - lm.year) <= 3 && (r.year === lm.year || sharesCjkBigram(r.milestone && r.milestone.headline, lm.zh))
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
      if (lng >= 109.5 && lng <= 118.5 && lat >= 3.5 && lat <= 18.2) {
        return { modernTitle: '海南省', inModernChina: true };
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
          list.push({
            ancient: s.ancient,
            aliases: s.aliases || [],
            modern: s.modern,
            coord: s.coord,
            isCapital: false,
          });
        }
      }
      for (const g of HistoricalAtlasController.PLACE_GAZETTEER) {
        if (!g.modern || !Array.isArray(g.coord)) continue;
        if (list.some((p) => this.projector.greatCircleKm(p.coord, g.coord) <= 15)) continue;
        list.push({
          ancient: g.name,
          aliases: g.aliases || [],
          modern: g.modern,
          coord: g.coord,
          isCapital: false,
        });
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

    _shapeAnchorOrCentroid(item) {
      if (item && Array.isArray(item.anchor) && item.anchor.length === 2) return item.anchor;
      const shape = item && item.shape;
      if (!shape || !shape.coordinates) return [0, 0];
      const ring = shape.type === 'Polygon' ? shape.coordinates[0] : (shape.coordinates[0] && shape.coordinates[0][0]);
      if (!ring || !ring.length) return [0, 0];
      let sx = 0, sy = 0;
      for (const pt of ring) {
        sx += pt[0];
        sy += pt[1];
      }
      return [sx / ring.length, sy / ring.length];
    }

    _minVertexDistSq(lng, lat, shape) {
      if (!shape || !shape.coordinates) return Infinity;
      const polys = shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates;
      let best = Infinity;
      for (const poly of polys) {
        const ring = poly && poly[0];
        if (!ring) continue;
        for (const pt of ring) {
          const d2 = (pt[0] - lng) * (pt[0] - lng) + (pt[1] - lat) * (pt[1] - lat);
          if (d2 < best) best = d2;
        }
      }
      return best;
    }

    _resolveEraPlaceAt(lng, lat, d, snap, modernLoc, closestOverall, year) {
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
          if (
            MercatorProjector.pointInShape(lng, lat, reg.shape) &&
            !regionObjs.some((r) => r.title === reg.title)
          ) {
            regionObjs.push(reg);
          }
        }
        if (!d || d.key !== 'roc') {
          for (const pref of snap.prefectures || []) {
            if (
              MercatorProjector.pointInShape(lng, lat, pref.shape) &&
              !prefObjs.some((p) => p.title === pref.title)
            ) {
              prefObjs.push(pref);
            }
          }
        }
      }
      let near = this._findNearestSettlement(d && d.settlements, lng, lat, 175);
      // One site can carry an entry per name (江宁 → 天京 → 江宁): take the one on the map that year.
      const offMap = (s) =>
        (s.appear !== undefined && year < s.appear) || (s.vanish !== undefined && year >= s.vanish);
      if (near && year !== undefined && offMap(near.s)) {
        const [x, y] = near.s.coord;
        const twin = d.settlements.find((s) => s.coord[0] === x && s.coord[1] === y && !offMap(s));
        if (twin) near = { s: twin, km: near.km };
      }
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

      // Prevent cross-Yangtze false-positive settlement matches between Zhenjiang/Nanjing (south) and Yangzhou/Pukou (north)
      if (
        near &&
        near.km <= 25 &&
        near.s &&
        Array.isArray(near.s.coord) &&
        lng >= 118.5 &&
        lng <= 120.2 &&
        ((lat <= 32.24 && near.s.coord[1] >= 32.28) || (lat >= 32.28 && near.s.coord[1] <= 32.24))
      ) {
        near = null;
      }

      // Prevent north-of-Yangtze Guangling/Jiangdu prefectures from bleeding south into Zhenjiang (lat <= 32.24)
      if (
        lat <= 32.24 &&
        lng >= 118.8 &&
        lng <= 120.2 &&
        prefObjs.some((p) => p.title === '广陵郡' || p.title === '广陵国' || p.title === '江都郡')
      ) {
        const filtered = prefObjs.filter(
          (p) => p.title !== '广陵郡' && p.title !== '广陵国' && p.title !== '江都郡'
        );
        prefObjs.length = 0;
        if (filtered.length > 0) {
          prefObjs.push(...filtered);
        } else if (snap && Array.isArray(snap.prefectures)) {
          const southPref =
            snap.prefectures.find((p) => p.title === '吴郡' || p.title === '毗陵郡') ||
            snap.prefectures.find((p) => p.title === '丹阳郡' || p.title === '会稽郡');
          if (southPref) prefObjs.push(southPref);
        }
      }

      // Disambiguate overlapping secondary prefectures at border buffers
      if (prefObjs.length > 1) {
        const titles = prefObjs.map((p) => p.title);
        let picked = null;
        if (titles.includes('丹阳郡') && titles.includes('九江郡')) {
          picked = prefObjs.find((p) => p.title === (lat < 31.85 ? '丹阳郡' : '九江郡'));
        } else if (titles.includes('豫章郡') && titles.includes('九江郡')) {
          picked = prefObjs.find((p) => p.title === (lat < 30.0 ? '豫章郡' : '九江郡'));
        } else if (titles.includes('太平府') && titles.includes('和州')) {
          picked = prefObjs.find((p) => p.title === (lng > 118.35 || lat < 31.45 ? '太平府' : '和州'));
        } else if (titles.includes('解州') && titles.includes('陕州')) {
          picked = prefObjs.find((p) => p.title === (lat < 34.85 ? '陕州' : '解州'));
        } else if (titles.includes('南郡') && (titles.includes('巴陵郡') || titles.includes('长沙郡'))) {
          picked =
            lat < 29.55
              ? prefObjs.find((p) => p.title === '巴陵郡' || p.title === '长沙郡')
              : prefObjs.find((p) => p.title === '南郡');
        }
        if (!picked && near && near.km <= 25 && near.s) {
          const anc = String(near.s.ancient || '');
          const rem = String(near.s.remark || '');
          picked = prefObjs.find((p) => {
            const stem = String(p.title || '').replace(/(?:郡|府|州|国|军|路|厅|安抚司|行都司)$/, '');
            return stem.length >= 1 && (anc.includes(stem) || rem.includes(p.title));
          });
        }
        if (!picked) {
          picked = prefObjs.slice().sort((a, b) => {
            const ca = this._shapeAnchorOrCentroid(a);
            const cb = this._shapeAnchorOrCentroid(b);
            return (
              Math.hypot(ca[0] - lng, ca[1] - lat) - Math.hypot(cb[0] - lng, cb[1] - lat)
            );
          })[0];
        }
        if (picked) {
          prefObjs.length = 0;
          prefObjs.push(picked);
        }
      }

      // Enforce Region <-> Prefecture & Yangtze/Yellow River consistency and fill coastal/frontier gaps
      if (snap && Array.isArray(snap.regions) && snap.regions.length > 0 && (!d || d.key !== 'prc')) {
        const setReg = (...names) => {
          for (const n of names) {
            const found = snap.regions.find((r) => r.title === n);
            if (found) {
              regionObjs.length = 0;
              regionObjs.push(found);
              return true;
            }
          }
          return false;
        };
        const prefTitle = prefObjs[0] ? prefObjs[0].title : '';
        const nearAnc = near && near.km <= 25 && near.s ? near.s.ancient : '';
        const dynKey = d ? d.key : '';

        if (dynKey === 'sui') {
          if (
            [
              '蒋州', '润州', '丹阳郡', '毗陵郡', '吴郡', '吴州', '苏州', '余杭郡', '杭州',
              '会稽郡', '越州', '宣城郡', '宣州', '新安郡', '歙州', '东阳郡', '婺州',
              '遂安郡', '睦州', '永嘉郡', '温州', '临海郡', '台州', '豫章郡', '洪州',
              '九江郡', '江州', '鄱阳郡', '饶州', '临川郡', '抚州', '庐陵郡', '吉州',
            ].includes(prefTitle) ||
            (loc.modernTitle === '江苏省' && lat <= 32.24 && lng >= 118.6)
          ) {
            setReg('江表诸郡');
          } else if (
            [
              '江都郡', '扬州', '钟离郡', '濠州', '淮南郡', '寿州', '庐江郡', '庐州',
              '同安郡', '舒州', '历阳郡', '和州', '下邳郡', '东海郡', '海州', '山阳郡',
              '楚州', '弋阳郡', '光州', '蕲春郡', '蕲州',
            ].includes(prefTitle)
          ) {
            setReg('淮海诸郡');
          }
        } else if (dynKey === 'tang') {
          if (
            [
              '润州', '常州', '苏州', '宣州', '杭州', '越州', '湖州', '睦州',
              '婺州', '衢州', '处州', '温州', '台州', '明州', '池州', '歙州',
            ].includes(prefTitle) ||
            (loc.modernTitle === '江苏省' && lat <= 32.24 && lng >= 118.6)
          ) {
            setReg('江南东道', '江南道');
          } else if (
            [
              '舒州', '庐州', '和州', '濠州', '寿州', '扬州', '楚州', '滁州',
              '光州', '蕲州', '安州', '申州',
            ].includes(prefTitle)
          ) {
            setReg('淮南道');
          } else if (['振州', '儋州', '琼州', '崖州', '万安州'].includes(prefTitle)) {
            setReg('岭南道');
          }
        } else if (dynKey === 'wudai') {
          if (
            polity === '吴越' ||
            [
              '常州', '苏州', '秀州', '杭州', '湖州', '越州', '明州', '温州',
              '台州', '婺州', '衢州', '处州', '睦州',
            ].includes(prefTitle)
          ) {
            setReg('两浙');
          } else if (
            ['金陵府', '江宁府', '润州', '宣州', '池州', '歙州'].includes(prefTitle) ||
            nearAnc.includes('金陵') ||
            nearAnc === '润州' ||
            (loc.modernTitle === '江苏省' && lat <= 32.24 && lng >= 118.6)
          ) {
            setReg('江东', '江南');
          } else if (
            ['舒州', '庐州', '和州', '濠州', '寿州', '扬州', '楚州', '滁州', '泰州', '通州'].includes(
              prefTitle
            )
          ) {
            setReg('淮南');
          }
        } else if (dynKey === 'beisong' || dynKey === 'nansong') {
          if (
            [
              '江宁府', '建康府', '太平州', '宣州', '宁国府', '池州', '徽州',
              '歙州', '饶州', '信州', '南康军', '广德军',
            ].includes(prefTitle)
          ) {
            setReg('江南东路');
          } else if (
            [
              '润州', '镇江府', '常州', '苏州', '平江府', '秀州', '嘉兴府',
              '湖州', '安吉州', '杭州', '临安府', '越州', '绍兴府', '明州',
              '庆元府', '温州', '瑞安府', '台州', '婺州', '衢州', '处州',
              '严州', '睦州', '建德府',
            ].includes(prefTitle)
          ) {
            setReg('两浙路', '两浙西路', '两浙东路');
          } else if (
            [
              '舒州', '安庆府', '庐州', '和州', '无为军', '濠州', '寿州',
              '扬州', '真州', '泰州', '通州', '楚州', '海州', '泗州', '宿州',
              '亳州', '光州', '蕲州', '黄州', '安州', '高邮军',
            ].includes(prefTitle)
          ) {
            setReg('淮南路', '淮南东路', '淮南西路');
          } else if (
            dynKey === 'beisong' &&
            ['徐州', '单州', '济州', '兖州', '曹州', '郓州', '东平府', '应天府'].includes(
              prefTitle
            )
          ) {
            setReg('京东西路', '京东路');
          } else if (prefTitle === '岳州' || nearAnc === '岳州') {
            setReg('荆湖北路', '荆湖路');
          } else if (dynKey === 'beisong' && (prefTitle === '陕州' || nearAnc === '陕州')) {
            setReg('永兴军路', '陕西路');
          }
        }

        if (
          regionObjs.length === 0 &&
          polity &&
          snap.polities &&
          ((snap.polities[0] && polity === snap.polities[0].title) ||
            ['魏', '蜀', '吴', '南唐', '吴越', '前蜀', '后蜀', '南汉', '楚', '闽', '荆南', '北汉'].includes(
              polity
            ))
        ) {
          let bestReg = null;
          let bestD2 = Infinity;
          for (const reg of snap.regions) {
            const d2 = this._minVertexDistSq(lng, lat, reg.shape);
            if (d2 < bestD2) {
              bestD2 = d2;
              bestReg = reg;
            }
          }
          if (bestReg) regionObjs.push(bestReg);
        } else if (regionObjs.length > 1) {
          const pickedReg = regionObjs.slice().sort((a, b) => {
            const ca = this._shapeAnchorOrCentroid(a);
            const cb = this._shapeAnchorOrCentroid(b);
            return Math.hypot(ca[0] - lng, ca[1] - lat) - Math.hypot(cb[0] - lng, cb[1] - lat);
          })[0];
          regionObjs.length = 0;
          regionObjs.push(pickedReg);
        }
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
          (Array.isArray(closestOverall.s.aliases) &&
            closestOverall.s.aliases.some((a) => String(a).toLowerCase() === labelLower)) ||
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

    _formatAdminHits(regionObjs, prefObjs) {
      const adminHits = [];
      for (const item of [...(regionObjs || []), ...(prefObjs || [])]) {
        const isEmigre = item.category === '侨州' || item.category === '侨郡';
        const label =
          this.locale === 'en'
            ? this.trTerm(item.title) + (isEmigre ? ' (Emigre)' : '')
            : item.title +
              (item.category && !item.title.endsWith(item.category) ? `（${item.category}）` : '');
        if (!adminHits.includes(label)) adminHits.push(label);
      }
      return adminHits;
    }

    _resolveAncientCoastalFallback(lng, lat, d, snap, modernLoc, targetYear) {
      if (
        !d ||
        d.key === 'prc' ||
        d.key === 'roc' ||
        !modernLoc ||
        !modernLoc.inModernChina ||
        modernLoc.modernTitle === '台湾省' ||
        modernLoc.modernTitle === '海南省' ||
        !snap ||
        !Array.isArray(snap.polities)
      ) {
        return null;
      }

      const seaProbes = [
        [lng + 0.35, lat],
        [lng + 0.25, lat - 0.25],
        [lng, lat - 0.35],
        [lng + 0.25, lat + 0.25],
      ];
      const hasOpenSea = seaProbes.some(
        ([px, py]) => !this._resolveModernLocationAt(px, py).modernTitle
      );
      if (!hasOpenSea) return null;

      let bestD2 = Infinity;
      let bestPt = null;
      let bestPol = null;
      for (const pol of snap.polities) {
        if (
          !pol ||
          !['main', 'rival', 'protectorate'].includes(pol.role) ||
          !pol.shape ||
          !pol.shape.coordinates
        ) {
          continue;
        }
        const polys = pol.shape.type === 'Polygon' ? [pol.shape.coordinates] : pol.shape.coordinates;
        for (const poly of polys) {
          const ring = poly && poly[0];
          if (!ring) continue;
          for (const pt of ring) {
            const d2 = (pt[0] - lng) * (pt[0] - lng) + (pt[1] - lat) * (pt[1] - lat);
            if (d2 < bestD2) {
              bestD2 = d2;
              bestPt = pt;
              bestPol = pol;
            }
          }
        }
      }
      if (!bestPt || this.projector.greatCircleKm([lng, lat], bestPt) > 35) {
        return null;
      }

      const dx = bestPt[0] - lng;
      const dy = bestPt[1] - lat;
      const len = Math.hypot(dx, dy);
      const ux = len > 1e-6 ? dx / len : -1;
      const uy = len > 1e-6 ? dy / len : 0;
      const candidates = [
        [bestPt[0] + ux * 0.04, bestPt[1] + uy * 0.04],
        [bestPt[0] + ux * 0.1, bestPt[1] + uy * 0.1],
        [bestPt[0] + ux * 0.18, bestPt[1] + uy * 0.18],
      ];
      const anchor = this._shapeAnchorOrCentroid(bestPol);
      const adx = anchor[0] - bestPt[0];
      const ady = anchor[1] - bestPt[1];
      const alen = Math.hypot(adx, ady);
      if (alen > 1e-6) {
        candidates.push([bestPt[0] + (adx / alen) * 0.06, bestPt[1] + (ady / alen) * 0.06]);
      }

      let shoreHit = null;
      for (const [ix, iy] of candidates) {
        const polHit = this._polityAt(ix, iy, snap);
        if (polHit && ['main', 'rival', 'protectorate'].includes(polHit.role)) {
          shoreHit = this._resolveEraPlaceAt(ix, iy, d, snap, modernLoc, null, targetYear);
          break;
        }
      }
      const shorePolity = (shoreHit && shoreHit.polity) || (bestPol && bestPol.title) || '';
      const shoreAdmins = shoreHit
        ? this._formatAdminHits(shoreHit.regionObjs, shoreHit.prefObjs)
        : [];
      return {
        isCoastalUnaccreted: true,
        shorePolity,
        shoreAdmins,
      };
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
      if (!this._isLoreDetailLoaded()) {
        this._ensureLoreDetail().then(() => {
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
      if (typeof this._clearActivePerson === 'function') this._clearActivePerson();
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
      this._scheduleUrlSync();
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
          lbl.textContent = this._mapText(this.trTerm(this.activeTraceLabel));
        }
      }
      this._invalidateTypographyLayout();
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
          this._rescaleSvgTypography();
        }
      } else {
        this._rescaleSvgTypography();
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
        ? this._passName(matchedPass, this.year, this.locale)
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
        const eraHit = this._resolveEraPlaceAt(lng, lat, d, snap, modernLoc, closestOverall, targetYear);
        const polityHit = eraHit.polity;
        const near = eraHit.near;
        const adminHits =
          d.key === 'prc'
            ? []
            : this._formatAdminHits(eraHit.regionObjs, eraHit.prefObjs);
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
        }
        const coastalFallback =
          !polityHit && !adminHits.length
            ? this._resolveAncientCoastalFallback(lng, lat, d, snap, modernLoc, targetYear)
            : null;
        const isCapHere = Boolean(near && near.km <= 38 && near.s.isCapital);
        if (isCapHere) capDynasties++;

        const placeEvents = this._collectPlaceEventsForDynasty(d, lng, lat, near);
        totalEvents += placeEvents.length;

        rowsData.push({
          d,
          isCurDyn,
          targetYear,
          polityHit,
          regionObjs: eraHit.regionObjs,
          prefObjs: eraHit.prefObjs,
          adminHits,
          coastalFallback,
          near,
          isCapHere,
          placeEvents,
        });
      }

      this._id('genealogy-card').classList.remove('is-hidden');
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.add('has-active-genealogy');
      this._syncTracedPrefecture();
      if (
        this.activeMilestone &&
        this.milestoneBalloon &&
        !this.milestoneBalloon.classList.contains('is-hidden') &&
        this.projector &&
        typeof this.projector.greatCircleKm === 'function'
      ) {
        const amDyn = this.dynasties.find((d) => d.key === this.activeMilestone.dynastyKey);
        const amAnchors = this._getMilestoneAnchors(amDyn, this.activeMilestone.milestone);
        const matchIdx = amAnchors.findIndex(
          (a) => a.coord && this.projector.greatCircleKm([lng, lat], a.coord) <= 30
        );
        if (matchIdx >= 0 && matchIdx !== this.activeMilestone.siteIdx) {
          this._selectMilestoneAnchor(matchIdx, amAnchors);
        }
        this._positionMilestoneBalloon();
      }

      const renderSubAndList = () => {
        const subEl = this._id('genealogy-sub');
        const loreBanner = this._resolvePlaceLoreBanner(
          lng,
          lat,
          matchedPass,
          identityModern,
          rowsData
        );
        const capInfo =
          capDynasties > 0
            ? this.locale === 'en'
              ? ` · Capital in ${capDynasties} mapped era${capDynasties > 1 ? 's' : ''}`
              : ` · 图中 ${capDynasties} 朝建都`
            : '';
        const coordText = `${lng.toFixed(2)}°E, ${lat.toFixed(2)}°N${capInfo}${
          totalEvents === 0
            ? ' · ' + this.uiStr('trace_click_hint', '点击任一朝代可切换地图')
            : ''
        }`;

        const retP = this.activeReturnPerson;
        const retBtnHtml = retP
          ? `<button type="button" class="gen-filter-pill" id="act-return-person">‹ ${escHtml(
              this.locale === 'en'
                ? retP.labelEn || (retP.profile && retP.profile.en) || ''
                : retP.labelZh || (retP.profile && retP.profile.zh) || ''
            )}</button>`
          : '';
        const placeSlug =
          !matchedPass && loreBanner && loreBanner.topicSlug
            ? loreBanner.topicSlug
            : '';
        const isEnGen = this.locale === 'en';
        const placeTopicHtml = placeSlug
          ? `<a class="topic-inline-link" href="topics/place-${escHtml(placeSlug)}.html" data-track="lnk-place-topic" target="_blank" rel="noopener" title="${
              isEnGen ? 'Place guide' : '查阅地区图志'
            }">${isEnGen ? 'Guide' : '图志'}</a>`
          : '';
        if (totalEvents > 0 || retBtnHtml || placeTopicHtml) {
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
            `<span class="person-sub-actions">${retBtnHtml}${placeTopicHtml}${filterHtml}</span>`;
          const retBtn = this._id('act-return-person');
          if (retBtn && retP) {
            retBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this._openPerson(retP.profile, retP.eventIdx);
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
          const {
            d,
            isCurDyn,
            polityHit,
            adminHits,
            coastalFallback,
            near,
            isCapHere,
            placeEvents,
          } = r;
          const li = document.createElement('li');
          if (isCurDyn) li.classList.add('is-current');
          const mainStr = adminHits.length
            ? adminHits.join(' · ')
            : polityHit
              ? this.trTerm(polityHit)
              : coastalFallback
                ? this.uiStr('coastal_unaccreted', '（古海岸线外 / 滨海）')
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
          } else if (coastalFallback) {
            const shoreParts = [];
            if (coastalFallback.shorePolity) {
              shoreParts.push(this.trTerm(coastalFallback.shorePolity));
            }
            for (const a of coastalFallback.shoreAdmins || []) {
              if (a && !shoreParts.includes(a)) shoreParts.push(a);
            }
            if (shoreParts.length) {
              subParts.push(
                `${this.uiStr('nearest_shore', '近岸政区：')}${shoreParts.join(' · ')}`
              );
            }
          }
          if (near) {
            const distStr =
              near.km < 25
                ? this.uiStr('at_here', '即此地')
                : `${Math.round(near.km)} km`;
            const rawNearAnc = this._settlementAncient(near.s, r.targetYear);
            const nearCityName =
              d.key === 'roc' || d.key === 'prc'
                ? this.locale === 'en' &&
                  near.s.rawModern &&
                  !(this.enLocale.dict && this.enLocale.dict[rawNearAnc])
                  ? this.trModernCity(near.s.rawModern)
                  : this.trModernCity(rawNearAnc)
                : this.trTerm(rawNearAnc);
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
  }

  function install(Ctrl) {
    HistoricalAtlasController = Ctrl;
    MercatorProjector = Ctrl._projectorClass || (typeof window !== 'undefined' ? window.MercatorProjector : null);
    escHtml = Ctrl._escHtml;
    SVG_ICONS = Ctrl._svgIcons;
    Ctrl._extendPrototype(AtlasGenealogyMixin);
  }

  if (typeof window === 'undefined') return;
  const readyCtrl = window.HistoricalAtlasController;
  if (readyCtrl && typeof readyCtrl._extendPrototype === 'function') {
    install(readyCtrl);
  } else {
    (window.__ATLAS_MIXINS = window.__ATLAS_MIXINS || []).push(install);
  }
})();
