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

  class AtlasQuizMixin {
    _sanitizeChallengeClue(text, settlement, displayAncient) {
      if (!text) return '';
      let out = String(text).replace(/（今[^）]+）|\(Now [^)]+\)/gi, '');
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

    // A round climbs from household names to deep cuts: 4 entry questions
    // (capitals, passes, cities with a city chronicle), 4 places with recorded
    // events, then 2 prefectures known only by a remark. A short tier is topped
    // up from the next one so the round always has 10 questions.
    _buildChallengeDeck(preferCurrentDynasty = false) {
      const ROUND = [4, 4, 2];
      const hasEn = this._hasEnDict();
      if (
        !this._challengeBaseTiers ||
        this._challengeBaseTiersDynRef !== this.dynasties ||
        this._challengeBaseTiersHasEn !== hasEn ||
        this._challengeBaseTiersLocale !== this.locale
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
      // Remember where the player was so a deliberate exit can return there;
      // a replay ("再来一局") keeps the original spot.
      if (!this.challenge) {
        this._preChallengeView = { year: this.year, camera: { ...this.camera } };
      }
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
      this._scheduleUrlSync();
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
        const sep = this.locale === 'en' ? ': ' : '：';
        if (chosenEv) {
          extraEventStr = ` · ${chosenEv.yrLbl}${sep}${chosenEv.cleanEv}`;
        } else if (
          firstClean &&
          !baseClue.includes('；') &&
          firstClean.cleanEv.length > baseClue.length
        ) {
          baseClue = `${firstClean.yrLbl}${sep}${firstClean.cleanEv}`;
        }
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
      this._id('act-next-round').classList.add('is-hidden');
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
      text.textContent = this.locale === 'en' ? label : this._zh(label);
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
      return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
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
      // Rings mark the scoring tiers, so the reveal doubles as the rules. Radii
      // come from the projection on both axes so ring edges match the km scoring.
      const [lng0, lat0] = cur.settlement.coord;
      for (const [ringKm, ringPts] of [
        [380, 55],
        [200, 80],
        [80, 100],
      ]) {
        const [ex] = this.projector.toScreen(lng0 + ringKm / (111 * Math.cos(lat0 * DEG_TO_RAD)), lat0);
        const [, ny] = this.projector.toScreen(lng0, lat0 + ringKm / 111);
        const rx = Math.abs(ex - ax);
        const ry = Math.abs(ay - ny);
        this._svgNode(
          'ellipse',
          {
            class: `score-ring${ringPts === pts ? ' is-hit' : ''}`,
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
      aLabel.textContent =
        this.locale === 'en'
          ? `${ansAncEn} (${ansModEn})`
          : `${cur.settlement.ancient}（今${cur.settlement.modern}）`;

      this._drawQuizMark(svgX, svgY, true);
      this._rescaleSvgTypography();
      this._renderChallengeAnsweredVerdict();
    }

    _finishChallenge() {
      const q = this.challenge;
      q.finished = true;
      this.grpChallenge.innerHTML = '';
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
      nextBtn.classList.remove('is-hidden');
      nextBtn.textContent = this.uiStr('quiz_again', '再来一局');
      nextBtn.onclick = () => {
        nextBtn.onclick = null;
        this.startChallenge();
      };
      if (this.locale === 'zh-tw') this._applyZhHantDom(this._id('challenge-banner'));
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
