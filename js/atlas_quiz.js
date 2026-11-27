/**
 * Ancient Place Pinpoint Quiz Module (古地名寻址挑战)
 * Attaches quiz deck construction, clue sanitization, SVG ring/chip rendering,
 * and scoring methods onto HistoricalAtlasController.prototype.
 */
(function () {
  'use strict';

  // Bound at install time so this file may load before or after js/app.js.
  let HistoricalAtlasController = null;
  let escHtml = null;
  const DEG_TO_RAD = Math.PI / 180;
  const QUIZ_ROUND_MAX = 20;
  const QUIZ_SCORE_RINGS = [
    [400, 10],
    [200, 16],
    [80, 20],
  ];

  function scoreLocateKm(km) {
    if (km <= 80) return 20;
    if (km <= 200) return Math.round(20 - ((km - 80) / 120) * 4);
    if (km <= 400) return Math.round(16 - ((km - 200) / 200) * 6);
    if (km < 700) return Math.round(10 * (1 - (km - 400) / 300));
    return 0;
  }

  function syncShareControls(ctrl, showShare) {
    const shareBtn = ctrl._id('act-share-quiz');
    const nextBtn = ctrl._id('act-next-round');
    if (shareBtn && shareBtn.classList) {
      shareBtn.classList.toggle('is-hidden', !showShare);
      if (!showShare) shareBtn.onclick = null;
    }
    if (nextBtn && nextBtn.classList) {
      nextBtn.classList.toggle('accent', !showShare);
      nextBtn.classList.toggle('subtle', showShare);
    }
  }

  class AtlasQuizMixin {
    _sanitizeChallengeClue(text, settlement, displayAncient) {
      if (!text) return '';
      let out = String(text).replace(/（(?:今|治今|故址在今)[^）]+）|\(Now [^)]+\)/gi, '');
      if (settlement && settlement.modern) {
        const modTokens = String(settlement.modern)
          .split(/[·/、，,\s（）()]+/)
          .map((s) =>
            s
              .replace(/^今/, '')
              .replace(
                /^(?:黑龙江|内蒙古|新疆|广西|宁夏|西藏|河北|山西|辽宁|吉林|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾)/,
                ''
              )
              .replace(/(?:东北|西北|东南|西南|东|西|南|北|境内|一带|附近|市|县|区)$/, '')
              .trim()
          )
          .filter((s) => s.length >= 2);
        for (const mt of modTokens) {
          const esc = mt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          out = out.replace(new RegExp(`（(?:治)?${esc}）`, 'g'), '');
        }
      }
      if (this.locale === 'en') {
        return out
          .replace(
            /\bmodern\s+(?:Beijing|Nanjing|Shanghai|Tianjin|Chongqing|Hangzhou|Guangzhou|Wuhan|Changsha|Chengdu|Xi'an)\b/gi,
            'this city'
          )
          .replace(
            /\burban foundation of\s+(?:Nanjing|Beijing|Shanghai|Tianjin|Chongqing|Hangzhou|Guangzhou|Wuhan|Changsha|Chengdu|Xi'an)\b/gi,
            'urban foundation of this city'
          );
      }

      const ancCore = String(displayAncient || '').trim();
      // Only mask explicit modern-leak phrases ("今XX城", "为XX建城") or explicit
      // multi-tier modern province+prefecture strings (e.g. "山东淄博临淄"), without
      // clobbering authentic historical commandery, prefecture, county, or landmark names
      // (such as 南阳郡治, 太原郡治, 汉中郡治, 长沙国都, 徐州治所, 雷州半岛, 朝鲜四郡, 《岳阳楼记》).
      out = out
        .replace(/今[\u4e00-\u9fa5]{2,4}城/g, '此城')
        .replace(/为(?:南京|北京|上海|天津|重庆|杭州|广州|武汉|长沙|成都|西安)建城/g, '为此城建城');
      const provRe =
        /^(?:黑龙江|内蒙古|新疆|广西|宁夏|西藏|河北|山西|辽宁|吉林|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾)/;
      const dirRe = /(?:东北|西北|东南|西南|东|西|南|北|境内|一带|附近)$/;
      for (const rawPart of String(settlement.modern || '').split(/[·/、，,\s（）()]+/)) {
        const p0 = rawPart.replace(/^今/, '').replace(dirRe, '').trim();
        if (!p0) continue;
        const provMatch = p0.match(provRe);
        if (provMatch) {
          const rest = p0.slice(provMatch[0].length).trim();
          if (rest.length >= 4 && ancCore && rest.endsWith(ancCore)) {
            const midPref = rest.slice(0, rest.length - ancCore.length);
            if (midPref.length >= 2) {
              out = out.replaceAll(midPref, ancCore);
            }
          }
        }
      }
      return out;
    }

    // A round climbs from household names to deep cuts: 2 entry questions
    // (capitals, passes, cities with a city chronicle), 2 places with recorded
    // events, then 1 prefecture known only by a remark. A short tier is topped
    // up from the next one so the round always has 5 questions.
    _buildChallengeDeck(preferCurrentDynasty = false) {
      const ROUND = [2, 2, 1];
      const hasEn = this._hasEnDict();
      const loreLoaded =
        typeof this._isLoreDetailLoaded === 'function' ? this._isLoreDetailLoaded() : true;
      if (
        !this._challengeBaseTiers ||
        this._challengeBaseTiersDynRef !== this.dynasties ||
        this._challengeBaseTiersHasEn !== hasEn ||
        this._challengeBaseTiersLocale !== this.locale ||
        this._challengeBaseTiersLoreLoaded !== loreLoaded
      ) {
        const famousCity = (coord) =>
          HistoricalAtlasController.CITY_LORE.some(
            (c) => Array.isArray(c.coord) && this.projector.greatCircleKm(c.coord, coord) < 20
          );
        const baseTiers = [[], [], []];
        for (const d of this.dynasties) {
          if (d.key === 'prc') continue;
          for (const s of d.settlements || []) {
            if (!s.modern || !Array.isArray(s.coord)) continue;
            if (d.key === 'roc' && !s.isCapital && !s.remark) continue;
            const hasEvents =
              this._collectPlaceEventsForDynasty(d, s.coord[0], s.coord[1], { s, km: 0 }).length > 0;
            if (!s.isCapital && !s.remark && !hasEvents) continue;
            const tier = s.isCapital || famousCity(s.coord) ? 0 : hasEvents ? 1 : 2;
            baseTiers[tier].push({ dynasty: d, settlement: s, tier });
          }
        }
        for (const p of HistoricalAtlasController.STRATEGIC_PASSES) {
          if (!p || !Array.isArray(p.coord)) continue;
          const focusY = p.focusYear !== undefined ? p.focusYear : p.appear || -221;
          const dIdx = this._findDynastyIndex(focusY);
          const d = this.dynasties[dIdx] || this.dynasties[0];
          if (!d || d.key === 'prc') continue;
          baseTiers[0].push({
            dynasty: d,
            tier: 0,
            settlement: {
              ancient: this._passName(p, focusY, 'zh'),
              ancientEn: this._passName(p, focusY, 'en'),
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
            },
          });
        }
        this._challengeBaseTiers = baseTiers;
        this._challengeBaseTiersDynRef = this.dynasties;
        this._challengeBaseTiersHasEn = hasEn;
        this._challengeBaseTiersLocale = this.locale;
        this._challengeBaseTiersLoreLoaded = loreLoaded;
      }
      const tiers = this._challengeBaseTiers.map((arr) => arr.slice());
      const chosen = [];
      const seen = new Set();
      const tryAdd = (pick) => {
        const uid = `${pick.dynasty.key}:${pick.settlement.ancient}`;
        if (seen.has(uid)) return false;
        const tooClose = chosen.some(
          (c) => this.projector.greatCircleKm(c.settlement.coord, pick.settlement.coord) < 35
        );
        if (tooClose) return false;
        seen.add(uid);
        chosen.push(pick);
        return true;
      };
      if (preferCurrentDynasty) {
        const curDyn = this.dynasties[this.dynastyIdx];
        if (curDyn && curDyn.key !== 'prc') {
          const all = tiers.flat();
          const firstPick =
            all.find(
              (c) =>
                c.dynasty.key === curDyn.key &&
                (c.settlement.ancient.startsWith('武威') || c.settlement.ancient.startsWith('姑臧'))
            ) || all.find((c) => c.dynasty.key === curDyn.key);
          if (firstPick) tryAdd(firstPick);
        }
      }
      let quota = 0;
      ROUND.forEach((size, t) => {
        quota += size;
        for (let k = t; k < tiers.length && chosen.length < quota; k++) {
          const src = tiers[k];
          while (chosen.length < quota && src.length) {
            tryAdd(src.splice(Math.floor(Math.random() * src.length), 1)[0]);
          }
        }
      });
      return chosen;
    }

    _syncChallengeScrubberState(locked) {
      const dock = this._id('scrubber-dock');
      if (dock) dock.classList.toggle('is-challenge-locked', Boolean(locked));
      for (const id of [
        'act-autoplay',
        'act-play-speed',
        'act-narrator',
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
      if (typeof this.stopNarrator === 'function') this.stopNarrator();
      this.clearCustomRoute();
      this.closeMilestoneBalloon();
      this.closeGenealogyCard();
      const sb = this._id('map-search-box');
      if (sb) sb.classList.add('is-hidden');
      const vf = this._id('viewport-frame');
      if (vf) {
        vf.classList.add('has-active-challenge');
        vf.classList.remove('is-challenge-answered', 'is-challenge-finished');
      }
      this._syncChallengeScrubberState(true);
      // Remember where the player was so a deliberate exit can return there;
      // a replay ("再来一局") keeps the original spot.
      if (!this.challenge) {
        this._preChallengeView = { year: this.year, camera: { ...this.camera } };
      }
      this.challenge = {
        variant: 'locate',
        deck: this._buildChallengeDeck(Boolean(opts && opts.preferCurrentDynasty)),
        history: [],
        index: 0,
        score: 0,
        answered: false,
      };
      this._syncImmersivePaneState();
      this._id('challenge-card').classList.remove('is-hidden');
      if (typeof this._syncChallengeTriggerUi === 'function') {
        this._syncChallengeTriggerUi();
      }
      this.svg.classList.add('is-crosshair');
      this.grpSettlements.classList.add('is-hidden');
      if (this.grpMilestones) this.grpMilestones.classList.add('is-hidden');
      this._id('act-next-round').onclick = null;
      this._syncChallengeMobileDock();
      this.presentChallengeRound();
      if (typeof this._isLoreDetailLoaded === 'function' && !this._isLoreDetailLoaded()) {
        this._ensureLoreDetail().then(() => {
          if (this.challenge && !this.challenge.answered) {
            this._renderChallengeQuestionText();
          }
        });
      }
    }

    stopChallenge(keepPaneState = false) {
      this.challenge = null;
      syncShareControls(this, false);
      this._syncChallengeMobileDock();
      if (
        typeof window !== 'undefined' &&
        window.JiangshanQuizPoster &&
        typeof window.JiangshanQuizPoster.close === 'function'
      ) {
        window.JiangshanQuizPoster.close();
      }
      this._scheduleUrlSync();
      this.grpChallenge.innerHTML = '';
      this._id('challenge-card').classList.add('is-hidden');
      const vf = this._id('viewport-frame');
      if (vf) {
        vf.classList.remove('has-active-challenge', 'is-challenge-answered', 'is-challenge-finished');
      }
      this._syncChallengeScrubberState(false);
      const sb = this._id('map-search-box');
      if (sb) sb.classList.remove('is-hidden');
      if (typeof this._syncChallengeTriggerUi === 'function') {
        this._syncChallengeTriggerUi();
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
      // keepPaneState marks a hand-off to another view (person, place, route);
      // only a plain exit returns the player to the pre-quiz year and camera.
      const back = this._preChallengeView;
      this._preChallengeView = null;
      if (back && !keepPaneState) {
        this.jumpToYear(back.year);
        this._animateCameraTo(back.camera);
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
          ? this.trModernCity(cur.settlement.ancient)
          : this.trTerm(cur.settlement.ancient);
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
      let baseClue = this._sanitizeChallengeClue(rawBaseClue, cur.settlement, displayTarget);

      const placeEvents = this._collectPlaceEventsForDynasty(
        cur.dynasty,
        cur.settlement.coord[0],
        cur.settlement.coord[1],
        { s: cur.settlement, km: 0 }
      );
      const hasClueOverlap = (a, b) => {
        const na = String(a || '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase();
        const nb = String(b || '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase();
        if (!na || !nb) return false;
        if (na.includes(nb) || nb.includes(na)) return true;
        const win = this.locale === 'en' ? 18 : 5;
        if (na.length < win || nb.length < win) return false;
        for (let i = 0; i <= na.length - win; i++) {
          if (nb.includes(na.slice(i, i + win))) return true;
        }
        return false;
      };
      let extraEventStr = '';
      if (placeEvents.length && !cur.settlement.isPass) {
        let chosenEv = null;
        let firstClean = null;
        for (const ev of placeEvents) {
          const yrLbl =
            this.locale === 'en'
              ? this.formatYear(ev.year)
              : `${ev.year <= 0 ? '前' + -ev.year : ev.year}年`;
          const cleanEv = this._sanitizeChallengeClue(ev.text, cur.settlement, displayTarget);
          if (!firstClean) firstClean = { yrLbl, cleanEv };
          if (!hasClueOverlap(baseClue, cleanEv)) {
            chosenEv = { yrLbl, cleanEv };
            break;
          }
        }
        // "523年：六镇之乱：…" / "1077年：苏轼：…" read badly; fall back to " · " when the
        // event text already has its own colon.
        const sepFor = (txt) => {
          const colon = this.locale === 'en' ? ': ' : '：';
          return txt.includes(colon.trim()) ? ' · ' : colon;
        };
        if (chosenEv) {
          extraEventStr = ` · ${chosenEv.yrLbl}${sepFor(chosenEv.cleanEv)}${chosenEv.cleanEv}`;
        } else if (
          firstClean &&
          !baseClue.includes('；') &&
          firstClean.cleanEv.length > baseClue.length
        ) {
          baseClue = `${firstClean.yrLbl}${sepFor(firstClean.cleanEv)}${firstClean.cleanEv}`;
        }
      }

      const clueTag = cur.settlement.isPass
        ? this.locale === 'en'
          ? 'Strategic Pass'
          : '雄关形胜'
        : this.locale === 'en'
          ? 'Historical Clue'
          : '当朝掌故';
      const useTapVerb =
        typeof this._isMobileViewport === 'function' && this._isMobileViewport();
      const actionVerb = useTapVerb ? 'Tap on the map to pinpoint' : 'Click on the map to pinpoint';
      const promptHtml = cur.settlement.isPass
        ? this.locale === 'en'
          ? `${actionVerb} <b>${this.dynastyName(cur.dynasty)}</b>’s strategic pass <b>“${escHtml(displayAncientEn)}”</b>`
          : `请在舆图上标定 <b>【${this.dynastyName(cur.dynasty)}】</b> 时期的天下名关 <b>「${escHtml(displayAncientZh)}」</b>`
        : this.locale === 'en'
          ? `${actionVerb} <b>${this.dynastyName(cur.dynasty)}</b>’s <b>“${escHtml(displayAncientEn)}”</b>`
          : `请在舆图上标定 <b>【${this.dynastyName(cur.dynasty)}】</b> 时期的 <b>「${escHtml(displayAncientZh)}」</b>`;

      this._id('challenge-question').innerHTML =
        `<div>${promptHtml}</div>` +
        `<div class="challenge-clue-box"><span class="clue-tag">${clueTag}</span><span>${escHtml(baseClue + extraEventStr)}</span></div>`;
      if (this.locale === 'zh-tw') this._applyZhHantDom(this._id('challenge-card'));
      this._syncChallengeMobileDock();
    }

    _syncChallengeMobileDock() {
      const dock = this._id('challenge-mobile-dock');
      const hint = this._id('challenge-mobile-hint');
      const cta = this._id('act-quiz-mobile-cta');
      const finishRow = this._id('challenge-mobile-finish-actions');
      if (!dock) return;
      const q = this.challenge;
      if (!q) {
        dock.classList.add('is-hidden');
        if (hint) hint.classList.add('is-hidden');
        if (cta) cta.classList.add('is-hidden');
        if (finishRow) finishRow.classList.add('is-hidden');
        return;
      }
      dock.classList.remove('is-hidden');
      if (q.finished) {
        if (hint) hint.classList.add('is-hidden');
        if (cta) cta.classList.add('is-hidden');
        if (finishRow) {
          finishRow.classList.remove('is-hidden');
          const againBtn = this._id('act-quiz-mobile-again');
          const shareMobBtn = this._id('act-quiz-mobile-share');
          if (againBtn) againBtn.textContent = this.uiStr('quiz_again', '再来一局');
          if (shareMobBtn) {
            shareMobBtn.textContent = this._quizPosterLoading
              ? this.uiStr('quiz_poster_loading', '绘图中…')
              : this.uiStr('quiz_share_btn', '分享战绩图');
          }
          if (this.locale === 'zh-tw') this._applyZhHantDom(dock);
        }
        return;
      }
      if (finishRow) finishRow.classList.add('is-hidden');
      const isEn = this.locale === 'en';
      if (!q.answered && !q.pendingGuess) {
        if (hint) {
          hint.textContent = isEn
            ? 'Tap map to drop pin · Pinch to zoom'
            : this._zh('轻点地图标定位置 · 可双指缩放');
          hint.classList.remove('is-hidden', 'is-subtle');
        }
        if (cta) cta.classList.add('is-hidden');
        return;
      }
      if (!q.answered && q.pendingGuess) {
        if (hint) {
          hint.textContent = isEn ? 'Tap map again to adjust' : this._zh('可再点地图微调落点');
          hint.classList.remove('is-hidden');
          hint.classList.add('is-subtle');
        }
        if (cta) {
          cta.textContent = isEn ? 'Confirm Pin' : this._zh('确认标点');
          cta.classList.remove('is-hidden');
        }
        return;
      }
      if (hint) hint.classList.add('is-hidden');
      if (cta) {
        cta.textContent =
          q.index + 1 >= q.deck.length
            ? `${this.uiStr('quiz_see_result', '查看成绩')} ›`
            : isEn
              ? 'Next Question ›'
              : this._zh('下一题 ›');
        cta.classList.remove('is-hidden');
      }
    }

    presentChallengeRound() {
      const q = this.challenge;
      this.grpChallenge.innerHTML = '';
      q.answered = false;
      q.finished = false;
      q.pendingGuess = null;
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.remove('is-challenge-answered', 'is-challenge-finished');
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
      // A place is off the map from its `vanish` year on; stay on its last year.
      if (cur.settlement.vanish !== undefined && roundYear >= cur.settlement.vanish) {
        roundYear = cur.settlement.vanish - 1;
      }
      this.jumpToYear(this._clampYearToDynasty(cur.dynasty, roundYear));
      this.grpSettlements.classList.add('is-hidden');
      if (this.grpMilestones) this.grpMilestones.classList.add('is-hidden');
      this._id('challenge-result').classList.add('is-hidden');
      this._id('act-next-round').classList.add('is-hidden');
      syncShareControls(this, false);
      this._renderChallengeQuestionText();
    }

    // The guess is a vermilion mark against the answer's ink circle, like a
    // teacher's red annotation beside the key. The anchor point stays visible.
    _drawQuizMark(svgX, svgY, confirmed) {
      const g = this._svgNode(
        'g',
        {
          class: `quiz-mark${confirmed ? ' is-confirmed' : ''}`,
          'data-x': svgX.toFixed(1),
          'data-y': svgY.toFixed(1),
        },
        this.grpChallenge
      );
      this._svgNode('circle', { class: 'quiz-dot', r: confirmed ? 4.2 : 5 }, g);
      return g;
    }

    // The action chip sits beside the guess where the eye and pointer already
    // are; the banner holds only the question and post-reveal verdict.
    _setQuizChip(label) {
      if (!this.grpChallenge || typeof this.grpChallenge.querySelector !== 'function') return;
      const mark = this.grpChallenge.querySelector('.quiz-mark');
      if (!mark) return;
      let chip = mark.querySelector('.quiz-chip');
      if (!chip) {
        chip = this._svgNode('g', { class: 'quiz-chip' }, mark);
        this._svgNode('rect', { class: 'quiz-chip-bg', y: -9.5, height: 19, rx: 9.5 }, chip);
        this._svgNode('text', { class: 'quiz-chip-text', y: 3.8 }, chip);
      }
      const text = chip.querySelector('text');
      text.textContent = this._mapText(this.locale === 'en' ? label : this._zh(label));
      const w =
        (typeof text.getComputedTextLength === 'function'
          ? text.getComputedTextLength()
          : text.textContent.length * 11) + 18;
      const q = this.challenge;
      const gx = Number(mark.getAttribute('data-x'));
      const gy = Number(mark.getAttribute('data-y'));
      const edgeSvg =
        this.camera && this.camera.w
          ? 68 * (this.camera.w / Math.max(320, (typeof window !== 'undefined' && window.innerWidth) || 1000))
          : 50;
      let toLeft = Boolean(this.camera && gx > this.camera.x + this.camera.w - edgeSvg);
      if (!toLeft && q && q.answered && q.deck[q.index]) {
        const [ax, ay] = this.projector.toScreen(...q.deck[q.index].settlement.coord);
        toLeft = Math.abs(ay - gy) < 18 && ax > gx - 12 && ax - gx < w + 20;
      }
      const x0 = toLeft ? -(w + 8) : 8;
      chip.querySelector('rect').setAttribute('x', x0.toFixed(1));
      chip.querySelector('rect').setAttribute('width', w.toFixed(1));
      text.setAttribute('x', (x0 + 9).toFixed(1));
    }

    _rescaleQuizChip(vw, s) {
      if (!this.grpChallenge || typeof this.grpChallenge.querySelector !== 'function') return;
      const chip = this.grpChallenge.querySelector('.quiz-chip');
      if (!chip) return;
      const r =
        (this.dragState && this.dragState.rect) ||
        (this.pinchState && this.pinchState.rect) ||
        this._cameraViewportRect ||
        (typeof this.svg.getBoundingClientRect === 'function' ? this.svg.getBoundingClientRect() : null);
      const rw = (r && r.width) || vw || 1000;
      const rh = (r && r.height) || rw * 0.7;
      const screenScale = Math.min(rw / this.camera.w, rh / this.camera.h);
      const k = 1 / Math.max(0.25, s * screenScale);
      chip.setAttribute('transform', `scale(${k.toFixed(3)})`);
    }

    _quizChipAt(clientX, clientY) {
      if (!this.grpChallenge || typeof this.grpChallenge.querySelector !== 'function') return false;
      const bg = this.grpChallenge.querySelector('.quiz-chip-bg');
      if (!bg || typeof bg.getBoundingClientRect !== 'function') return false;
      const r = bg.getBoundingClientRect();
      if (!r || r.width <= 0 || r.height <= 0) return false;
      const pad =
        typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth <= 900 ? 10 : 4;
      return (
        clientX >= r.left - pad &&
        clientX <= r.right + pad &&
        clientY >= r.top - pad &&
        clientY <= r.bottom + pad
      );
    }

    _previewLocatePin(svgX, svgY) {
      const q = this.challenge;
      if (!q || q.answered) return;
      q.pendingGuess = [svgX, svgY];
      this.grpChallenge.innerHTML = '';
      this._drawQuizMark(svgX, svgY, false);
      this._setQuizChip(this.locale === 'en' ? 'Confirm ↵' : '确认 ↵');
      this._rescaleSvgTypography();
      if (this.locale === 'zh-tw') this._applyZhHantDom(this.grpChallenge);
      this._syncChallengeMobileDock();
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
        const textNode = this.grpChallenge.querySelector('text.answer-label');
        if (textNode) textNode.textContent = this._mapText(aLabelText);
      }
      this._id('challenge-points').textContent = `${this.uiStr('quiz_score', '得分')} ${q.score}`;
      const comment =
        pts === 20
          ? this.uiStr('verdict_100', '正中靶心！')
          : pts >= 16
            ? this.uiStr('verdict_80', '非常接近！')
            : pts >= 10
              ? this.uiStr('verdict_55', '方位基本正确。')
              : pts > 0
                ? this.uiStr('verdict_25', '稍有点远。')
                : this.uiStr('verdict_0', '偏离较远。');

      this._id('challenge-verdict').innerHTML =
        this.locale === 'en'
          ? `${comment} Off by <b>${km} km</b> (+${pts} pts) · Answer: ${escHtml(ansAncEn)} (${escHtml(ansModEn)})`
          : `${comment} 偏差 <b>${km} 公里</b>（+${pts} 分）· 答案：${escHtml(cur.settlement.ancient)}（今${escHtml(cur.settlement.modern)}）`;

      this._id('act-next-round').classList.add('is-hidden');
      this._setQuizChip(
        q.index + 1 >= q.deck.length
          ? `${this.uiStr('quiz_see_result', '查看成绩')} ›`
          : this.locale === 'en'
            ? 'Next ›'
            : '下一题 ›'
      );
      this._rescaleSvgTypography();
      this._id('challenge-result').classList.remove('is-hidden');
      if (this.locale === 'zh-tw') {
        this._applyZhHantDom(this._id('challenge-card'));
        this._applyZhHantDom(this.grpChallenge);
      }
      this._syncChallengeMobileDock();
    }

    _frameChallengeReveal(svgX, svgY, ax, ay) {
      const vf = this._id('viewport-frame');
      if (
        !vf ||
        typeof vf.getBoundingClientRect !== 'function' ||
        !this.svg ||
        typeof this.svg.getBoundingClientRect !== 'function' ||
        typeof this._animateCameraTo !== 'function'
      ) {
        return false;
      }
      const vfRect = vf.getBoundingClientRect();
      const svgRect =
        typeof this._getUnscaledSvgRect === 'function'
          ? this._getUnscaledSvgRect()
          : this.svg.getBoundingClientRect();
      if (!vfRect || !svgRect || vfRect.width < 120 || vfRect.height < 120 || svgRect.width < 80) {
        return false;
      }
      const cam = this._cameraTarget || this.camera;
      if (!cam || !cam.w || !cam.h) return false;
      const scale = Math.min(svgRect.width / cam.w, svgRect.height / cam.h);
      const padX = (svgRect.width - cam.w * scale) * 0.5;
      const padY = (svgRect.height - cam.h * scale) * 0.5;
      const toVf = (sx, sy) => [
        svgRect.left - vfRect.left + padX + (sx - cam.x) * scale,
        svgRect.top - vfRect.top + padY + (sy - cam.y) * scale,
      ];
      const [axSc, aySc] = toVf(ax, ay);
      const [gxSc, gySc] = toVf(svgX, svgY);

      const card = this._id('challenge-card');
      const cardVisible = Boolean(card && !card.classList.contains('is-hidden'));
      const cr = cardVisible && typeof card.getBoundingClientRect === 'function' ? card.getBoundingClientRect() : null;
      const isNarrow = typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth <= 640;
      const dock = this._id('challenge-mobile-dock');
      const dr =
        dock && !dock.classList.contains('is-hidden') && typeof dock.getBoundingClientRect === 'function'
          ? dock.getBoundingClientRect()
          : null;
      const safeTop = isNarrow && cr ? Math.max(26, cr.bottom - vfRect.top + 28) : 26;
      const safeBottom = dr && dr.height > 0 ? Math.min(vfRect.height - 24, dr.top - vfRect.top - 22) : vfRect.height - 26;
      const safeLeft = 22;
      const safeRight = vfRect.width - 22;

      const hitsCard = (px, py) =>
        Boolean(
          cr &&
            px >= cr.left - vfRect.left - 18 &&
            px <= cr.right - vfRect.left + 24 &&
            py >= cr.top - vfRect.top - 14 &&
            py <= cr.bottom - vfRect.top + 22
        );
      const outOfSafeBox = (px, py) =>
        px < safeLeft || px > safeRight || py < safeTop || py > safeBottom || hitsCard(px, py);

      if (!outOfSafeBox(axSc, aySc) && !outOfSafeBox(gxSc, gySc)) return false;

      const minX = Math.min(svgX, ax) - 42;
      const maxX = Math.max(svgX, ax) + 64;
      const minY = Math.min(svgY, ay) - 34;
      const maxY = Math.max(svgY, ay) + 34;
      const defCam = this._getDefaultCamera();
      const ar = cam.h / cam.w;
      const availFracY = Math.max(0.35, (safeBottom - safeTop) / vfRect.height);
      const reqW = Math.max((maxX - minX) / 0.84, (maxY - minY) / (ar * availFracY * 0.86));
      const w = Math.max(Math.min(defCam.w, 260), Math.min(defCam.w * 1.15, reqW));
      const h = w * ar;
      const midFracY = Math.max(0.32, Math.min(0.66, ((safeTop + safeBottom) * 0.5) / vfRect.height));
      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5;
      this._animateCameraTo({
        x: Math.max(-180, Math.min(1000 - w + 140, cx - w * 0.5)),
        y: Math.max(-150, Math.min(700 - h + 120, cy - h * midFracY)),
        w,
        h,
      });
      return true;
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
      const pts = scoreLocateKm(km);
      const hitRingKm = km <= 80 ? 80 : km <= 200 ? 200 : km <= 400 ? 400 : 0;
      q.score += pts;
      q.lastKm = km;
      q.lastPts = pts;
      if (!Array.isArray(q.history)) q.history = [];
      q.history[q.index] = {
        dynasty: cur.dynasty,
        settlement: cur.settlement,
        guess: guessGeo,
        km,
        pts,
      };

      const [ax, ay] = this.projector.toScreen(
        cur.settlement.coord[0],
        cur.settlement.coord[1]
      );
      // Rings mark the scoring tiers, so the reveal doubles as the rules. Radii
      // come from the projection on both axes so ring edges match the km scoring.
      const [lng0, lat0] = cur.settlement.coord;
      for (const [ringKm, ringPts] of QUIZ_SCORE_RINGS) {
        const [ex] = this.projector.toScreen(lng0 + ringKm / (111 * Math.cos(lat0 * DEG_TO_RAD)), lat0);
        const [, ny] = this.projector.toScreen(lng0, lat0 + ringKm / 111);
        const rx = Math.abs(ex - ax);
        const ry = Math.abs(ay - ny);
        this._svgNode(
          'ellipse',
          {
            class: `score-ring${ringKm === hitRingKm ? ' is-hit' : ''}`,
            cx: ax.toFixed(1),
            cy: ay.toFixed(1),
            rx: rx.toFixed(1),
            ry: ry.toFixed(1),
          },
          this.grpChallenge
        );
        // Labels sit on the upper-left of each ring, away from the answer label
        // on the right and the place names usually centred above the answer.
        const tag = this._svgNode(
          'g',
          {
            'data-x': (ax - rx * Math.SQRT1_2).toFixed(1),
            'data-y': (ay - ry * Math.SQRT1_2).toFixed(1),
          },
          this.grpChallenge
        );
        const tagText = this._svgNode('text', { class: 'score-ring-label', x: -2, y: -2 }, tag);
        tagText.textContent = `${ringKm} km · +${ringPts}`;
      }
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

      const aPin = this._svgNode(
        'g',
        { 'data-x': ax.toFixed(1), 'data-y': ay.toFixed(1) },
        this.grpChallenge
      );
      this._svgNode('circle', { class: 'answer-ink', r: 7.5, transform: 'rotate(-35)' }, aPin);
      this._svgNode('circle', { class: 'answer-dot', r: 1.8 }, aPin);
      const aLabel = this._svgNode(
        'text',
        {
          class: 'answer-label',
          x: 11,
          y: 4,
          style: 'font-size:12px;font-weight:700;fill:#2b2118;filter:url(#label-halo)',
        },
        aPin
      );
      const ansAncEn = cur.settlement.ancientEn
        ? cur.settlement.ancientEn
        : cur.dynasty.key === 'roc' || cur.dynasty.key === 'prc'
          ? this.trModernCity(cur.settlement.ancient)
          : this.trTerm(cur.settlement.ancient);
      const ansModEn = cur.settlement.modernEn || this.trModernCity(cur.settlement.modern);
      aLabel.textContent = this._mapText(
        this.locale === 'en'
          ? `${ansAncEn} (${ansModEn})`
          : `${cur.settlement.ancient}（今${cur.settlement.modern}）`
      );

      this._drawQuizMark(svgX, svgY, true);
      this._rescaleSvgTypography();
      this._renderChallengeAnsweredVerdict();
      this._frameChallengeReveal(svgX, svgY, ax, ay);
    }

    _finishChallenge() {
      const q = this.challenge;
      q.finished = true;
      const vf = this._id('viewport-frame');
      if (vf) vf.classList.add('is-challenge-finished');
      this.grpChallenge.innerHTML = '';
      const total = q.deck.length * QUIZ_ROUND_MAX;
      const rank =
        q.score >= 85
          ? this.uiStr('title_850', '太史令 · 舆图大家')
          : q.score >= 65
            ? this.uiStr('title_650', '职方郎中 · 熟稔疆理')
            : q.score >= 40
              ? this.uiStr('title_400', '州郡从事 · 略通古今')
              : this.uiStr('title_0', '江湖行客 · 不妨多逛逛时间轴');

      this._id('challenge-points').textContent = `${this.uiStr('quiz_score', '得分')} ${q.score}`;
      this._id('challenge-question').innerHTML =
        this.locale === 'en'
          ? `Challenge complete! Total score <b>${q.score} / ${total}</b> — Rank: <b>${escHtml(rank)}</b>`
          : `挑战结束！总分 <b>${q.score} / ${total}</b> —— 封号：<b>「${escHtml(rank)}」</b>`;
      const againMsg = escHtml(
        this.uiStr('quiz_again_msg', '可再战一局，或关闭回到自由浏览。')
      );
      const starCta = escHtml(
        this.uiStr('quiz_star_cta', '喜欢这个小挑战？去 GitHub 点颗 ★ Star')
      );
      this._id('challenge-verdict').innerHTML =
        `<span class="challenge-finish-verdict"><span>${againMsg}</span>` +
        `<a class="challenge-star-link" href="https://github.com/DeanChensj/jiangshan-map" target="_blank" rel="noopener noreferrer">${starCta}</a></span>`;
      const shareBtn = this._id('act-share-quiz');
      if (shareBtn) {
        shareBtn.textContent = this.uiStr('quiz_share_btn', '分享战绩图');
        shareBtn.onclick = () => this._openQuizPoster();
      }
      const nextBtn = this._id('act-next-round');
      nextBtn.classList.remove('is-hidden');
      nextBtn.textContent = this.uiStr('quiz_again', '再来一局');
      syncShareControls(this, true);
      this._syncChallengeMobileDock();
      nextBtn.onclick = () => {
        nextBtn.onclick = null;
        this.startChallenge();
      };
      if (this.locale === 'zh-tw') this._applyZhHantDom(this._id('challenge-card'));
      if (
        typeof window !== 'undefined' &&
        window.JiangshanQuizPoster &&
        typeof window.JiangshanQuizPoster.refreshIfOpen === 'function'
      ) {
        window.JiangshanQuizPoster.refreshIfOpen(this);
      }
    }

    _openQuizPoster() {
      if (this._quizPosterLoading) return Promise.resolve(null);
      this._quizPosterLoading = true;
      const shareBtn = this._id('act-share-quiz');
      const shareMobBtn = this._id('act-quiz-mobile-share');
      const setShareLabel = () => {
        const label = this._quizPosterLoading
          ? this.uiStr('quiz_poster_loading', '绘图中…')
          : this.uiStr('quiz_share_btn', '分享战绩图');
        if (shareBtn) shareBtn.textContent = label;
        if (shareMobBtn) shareMobBtn.textContent = label;
      };
      setShareLabel();

      let readyPromise;
      if (typeof window !== 'undefined' && window.JiangshanQuizPoster) {
        readyPromise = Promise.resolve(true);
      } else {
        if (!this._quizPosterPromise && typeof this._loadScriptOnce === 'function') {
          this._quizPosterPromise = this._loadScriptOnce(
            this._lazyAssetUrl('js/quiz_poster.js', 'vQuizPoster')
          ).then(() => {
            if (typeof window !== 'undefined' && window.JiangshanQuizPoster) return true;
            this._quizPosterPromise = null;
            return false;
          });
        }
        readyPromise = this._quizPosterPromise || Promise.resolve(false);
      }

      return readyPromise
        .then((ok) => {
          if (!ok || typeof window === 'undefined' || !window.JiangshanQuizPoster) return null;
          return window.JiangshanQuizPoster.open(this);
        })
        .catch(() => null)
        .finally(() => {
          this._quizPosterLoading = false;
          if (this.challenge && this.challenge.finished) setShareLabel();
        });
    }
  }

  function install(Ctrl) {
    HistoricalAtlasController = Ctrl;
    escHtml = Ctrl._escHtml;
    Ctrl._extendPrototype(AtlasQuizMixin);
  }

  if (typeof window === 'undefined') return;
  const readyCtrl = window.HistoricalAtlasController;
  if (readyCtrl && typeof readyCtrl._extendPrototype === 'function') {
    install(readyCtrl);
  } else {
    (window.__ATLAS_MIXINS = window.__ATLAS_MIXINS || []).push(install);
  }
})();
