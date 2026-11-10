/**
 * Web Speech API Timeline & Chronicle Narrator Module (历史语音讲解)
 * Strictly coupled to timeline autoplay with speed-adaptive LOD:
 *   - 0.5× / 1× : Year + Imperial Era + (non-redundant Site) + Milestone headline
 *   - 2×        : Territory-changing / major milestones only (first clause, natural 1.16 rate)
 *   - 4×        : Dynasty title announcements only ("战国", "秦", "西汉"...)
 * Includes proactive voice-list probing and a runtime circuit breaker that automatically
 * hides #act-narrator if the browser/WebView cannot synthesize speech.
 */
(function () {
  'use strict';

  // Clear any wedged Chromium speechSynthesis queue from prior page loads and warm up voices.
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.getVoices();
      window.addEventListener('pagehide', () => {
        try {
          window.speechSynthesis.cancel();
        } catch (_) {}
      });
    } catch (_) {}
  }

  class AtlasNarratorMixin {
    _hasSpeechSynthesis() {
      return (
        !this._ttsUnsupported &&
        typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        typeof window.SpeechSynthesisUtterance === 'function'
      );
    }

    _markNarratorUnsupported() {
      this._ttsUnsupported = true;
      if (this.narrating) {
        this.narrating = false;
        this.silenceNarrator();
      }
      const btn = this._id && this._id('act-narrator');
      if (btn && btn.classList) {
        btn.classList.add('is-hidden');
        btn.disabled = true;
      }
    }

    _probeNarratorSupport() {
      const btn = this._id && this._id('act-narrator');
      if (!this._hasSpeechSynthesis()) {
        this._markNarratorUnsupported();
        return false;
      }
      const synth = window.speechSynthesis;
      const checkVoices = () => {
        let voices = [];
        try {
          voices = synth.getVoices() || [];
        } catch (_) {
          voices = [];
        }
        const hasUsable = voices.some((v) => /^(?:zh|cmn|en)\b/i.test(String((v && v.lang) || '')));
        if (hasUsable) {
          if (btn && btn.classList) btn.classList.remove('is-hidden');
          return true;
        }
        return false;
      };

      if (checkVoices()) return true;

      if (typeof synth.addEventListener === 'function') {
        const onVoices = () => {
          if (checkVoices()) {
            try {
              synth.removeEventListener('voiceschanged', onVoices);
            } catch (_) {}
          }
        };
        try {
          synth.addEventListener('voiceschanged', onVoices);
        } catch (_) {}
        setTimeout(() => {
          try {
            synth.removeEventListener('voiceschanged', onVoices);
          } catch (_) {}
          if (!checkVoices()) {
            this._markNarratorUnsupported();
          }
        }, 1600);
      } else {
        this._markNarratorUnsupported();
      }
      return false;
    }

    _spokenYear(year) {
      const y = Number(year);
      if (!Number.isFinite(y)) return '';
      if (this.locale === 'en') {
        return y < 0 ? `${Math.abs(y)} B C E` : `${y} C E`;
      }
      if (this.locale === 'zh-tw') {
        return y < 0 ? `西元前${Math.abs(y)}年` : `西元${y}年`;
      }
      return y < 0 ? `公元前${Math.abs(y)}年` : `公元${y}年`;
    }

    _spokenEra(dynasty, ev) {
      if (!dynasty || !ev || Number(ev.year) >= 1949) return '';
      if (typeof this._eventEraLabel !== 'function') return '';
      const raw = this._eventEraLabel(dynasty, ev);
      if (!raw) return '';
      if (this.locale === 'en') {
        const parts = String(raw)
          .split('·')
          .map((s) => s.trim())
          .filter(Boolean);
        return parts.length > 1 ? parts.slice(1).join(', ') : '';
      }
      // Turn "唐玄宗·天宝十四年" into smooth spoken "唐玄宗天宝十四年"
      return String(raw).replace(/\s*[·•]\s*/g, '').trim();
    }

    _spokenSiteIfAbsent(rawSite, headlineText) {
      if (!rawSite) return '';
      const raw = String(rawSite)
        .replace(/（[^）]*）|\([^)]*\)/g, '')
        .trim();
      if (!raw || /^(?:全国|全國|All China)$/i.test(raw)) return '';
      const tokens = raw
        .split(/[·•/、，,→]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!tokens.length) return '';
      const head = String(headlineText || '');
      const isEn = this.locale === 'en';
      const translated = tokens
        .map((t) => (isEn ? this.trTerm(t) : this._zh(t)))
        .filter((t) => t && !head.includes(t));
      if (!translated.length) return '';
      return translated.join(isEn ? ' & ' : '、');
    }

    _cleanSpokenText(raw, firstClauseOnly = false) {
      if (!raw) return '';
      let out = String(raw)
        .replace(/（[^）]*）|\([^)]*\)/g, '')
        .replace(/[《》「」『』“”"']/g, '');
      if (firstClauseOnly) {
        out = out.split(/[；;。]/)[0] || out;
      }
      out = out
        .replace(/\s+/g, ' ')
        .replace(/[·•：:]/g, '，')
        .replace(/—+/g, '至')
        .replace(/→/g, '，至')
        .replace(/，+/g, '，')
        .replace(/^，|，$/g, '')
        .trim();
      if (this.locale !== 'en') {
        out = out.replace(/(^|[^公元西])前(\d{1,4})\s*年/g, '$1公元前$2年');
        if (this.locale === 'zh-tw') {
          out = out.replace(/公元/g, '西元');
        }
      }
      return out;
    }

    _candidateSpeechVoices() {
      if (!this._hasSpeechSynthesis()) return [];
      let voices = [];
      try {
        voices = window.speechSynthesis.getVoices() || [];
      } catch (_) {
        return [];
      }
      if (!voices.length) return [];

      const isEn = this.locale === 'en';
      const isTw = this.locale === 'zh-tw';
      const langRe = isEn
        ? /^en\b/i
        : isTw
          ? /^(?:zh[-_](?:TW|HK|Hant)|cmn[-_](?:TW|Hant))/i
          : /^(?:zh|cmn)\b/i;
      const fallbackZhRe = /^(?:zh|cmn)\b/i;

      let pool = voices.filter((v) => langRe.test(String(v.lang || '')));
      if (!pool.length && isTw) {
        pool = voices.filter((v) => fallbackZhRe.test(String(v.lang || '')));
      }
      if (!pool.length) return [];

      const scored = pool.map((v) => {
        const name = String(v.name || '');
        const lang = String(v.lang || '');
        let score = 0;

        const isEdgeNatural =
          /Natural|Online.*Microsoft/i.test(name) ||
          /Xiaoxiao|Yunxi|Xiaoyi|Yunjian|HsiaoChen|HsiaoYu|WanLung|Aria|Jenny|Guy/i.test(name);
        const isGoogleRemote = /Google/i.test(name) && !v.localService;
        const isPreferredSystemVoice =
          /婷婷|Tingting|美佳|Meijia|善怡|Sin-?ji|慧慧|Huihui|瑶瑶|Yaoyao|康康|Kangkang|Siri|Enhanced|Premium|Samantha|Alex|Daniel/i.test(
            name
          );
        const isNoveltyVoice =
          /\b(?:Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Bahh|Albert|Bells|Boing|Bubbles|Cellos|Organ|Trinoids|Whisper|Zarvox)\b/i.test(
            name
          );

        if (isEdgeNatural) {
          score += 130;
          if (/Yunxi|Xiaoxiao|HsiaoChen|Guy|Aria/i.test(name)) score += 20;
        } else if (v.localService) {
          score += 85;
        } else if (isGoogleRemote) {
          score += 55;
        } else {
          score += 40;
        }

        if (isPreferredSystemVoice) score += 35;
        if (isNoveltyVoice) score -= 60;

        if (!isEn && !isTw && /zh[-_]?CN/i.test(lang)) score += 18;
        if (isTw && /zh[-_]?TW/i.test(lang)) score += 18;
        if (isEn && /en[-_]?US|en[-_]?GB/i.test(lang)) score += 15;
        if (v.default) score += 8;

        return { voice: v, score, isLocal: Boolean(v.localService) };
      });

      scored.sort((a, b) => b.score - a.score);

      const bestPrimary = scored[0] ? scored[0].voice : null;
      const bestAlt = scored.find(
        (s) => bestPrimary && s.isLocal !== Boolean(bestPrimary.localService)
      );
      const list = [];
      if (bestPrimary) list.push(bestPrimary);
      if (bestAlt && bestAlt.voice !== bestPrimary) list.push(bestAlt.voice);
      list.push(null);
      return list;
    }

    _selectSpeechVoice() {
      const candidates = this._candidateSpeechVoices();
      return candidates.length ? candidates[0] : null;
    }

    _duckMusicForNarration(duck) {
      if (!this.musicAudio) return;
      try {
        this.musicAudio.volume = duck ? 0.14 : 0.48;
      } catch (_) {}
    }

    _updateNarratorUi() {
      const btn = this._id('act-narrator');
      if (!btn) return;
      if (this._ttsUnsupported) {
        btn.classList.add('is-hidden');
        return;
      }
      const active = Boolean(this.narrating);
      const isEn = this.locale === 'en';
      btn.classList.toggle('is-custom-speed', active);
      btn.classList.toggle('is-narrating', active);
      btn.setAttribute('aria-pressed', String(active));
      const label = active
        ? isEn
          ? 'Mute autoplay voice narration'
          : this._zh('关闭自动播放语音讲解')
        : isEn
          ? 'Autoplay with voice narration'
          : this._zh('语音讲解（随自动播放朗读时间轴事件）');
      btn.setAttribute('aria-label', label);
      btn.title = label;
      if (
        active &&
        (this.playing || this.personTimer) &&
        this._lastNarratedLocale &&
        this._lastNarratedLocale !== this.locale
      ) {
        this._lastNarratedLocale = this.locale;
        this.speakCurrentState({ forceIntro: true });
      }
    }

    _isMajorStopYear(year) {
      if (typeof this._autoplayStops !== 'function') return true;
      const stops = this._autoplayStops() || [];
      const hit = stops.find((s) => s.year === year);
      return Boolean(hit && hit.hold);
    }

    _buildNarrationText(opts = {}) {
      const isEn = this.locale === 'en';
      const speed = Number(this.playSpeed) > 0 ? Number(this.playSpeed) : 1;

      // 1. Person Chronicle / Historical Journey mode
      if (this.activePerson && Array.isArray(this.activePerson.events)) {
        const profiles = this.activePerson.profiles || [this.activePerson.profile];
        const personKey = profiles.map((p) => (p && p.key) || '').join('+');
        const isNewPerson = opts.forceIntro || this._lastNarratedPersonKey !== personKey;
        const names = profiles
          .map((p) => (p ? (isEn ? p.en : this._zh(p.zh)) : ''))
          .filter(Boolean)
          .join(isEn ? ' & ' : '、');

        if (speed >= 4) {
          if (!isNewPerson) return '';
          this._lastNarratedPersonKey = personKey;
          return this._cleanSpokenText(names, true);
        }

        const parts = [];
        if (isNewPerson) {
          this._lastNarratedPersonKey = personKey;
          if (names) parts.push(names);
        }
        const evIdx = Number(this.activePersonEventIdx);
        const ev = evIdx >= 0 ? this.activePerson.events[evIdx] : null;
        if (ev) {
          const evKey = `person:${personKey}:${evIdx}`;
          if (opts.forceIntro || this._lastNarratedEventKey !== evKey) {
            this._lastNarratedEventKey = evKey;
            const yrStr = this._spokenYear(ev.year);
            const eraStr = speed < 2 ? this._spokenEra(ev.dynasty, ev) : '';
            const rawBody = isEn
              ? ev.titleEn || ev.noteEn || ev.title || ev.note || ''
              : this._zh(ev.title || ev.note || '');
            const cleanBody = this._cleanSpokenText(rawBody, speed >= 2);
            const placeStr = speed < 2 ? this._spokenSiteIfAbsent(ev.ancient, cleanBody) : '';
            if (cleanBody) {
              const segs = [yrStr, eraStr, placeStr, cleanBody].filter(Boolean);
              parts.push(segs.join(isEn ? ', ' : '，'));
            }
          }
        }
        return parts.join(isEn ? '. ' : '。');
      }

      // 2. Standard Dynasty & Milestone Timeline mode
      const cur = this.dynasties && this.dynasties[this.dynastyIdx];
      if (!cur) return '';

      const isNewDynasty = opts.forceIntro || this._lastNarratedDynastyKey !== cur.key;
      const dName = this._cleanSpokenText(this.dynastyName(cur), true);

      // 4× Speed LOD: announce only the dynasty title when entering a new era.
      if (speed >= 4) {
        if (!isNewDynasty) return '';
        this._lastNarratedDynastyKey = cur.key;
        return dName;
      }

      const mIdx = typeof this._activeMilestoneIndex === 'function' ? this._activeMilestoneIndex(cur) : -1;
      const m = mIdx >= 0 && Array.isArray(cur.milestones) ? cur.milestones[mIdx] : null;
      const mKey = m ? `${cur.key}:${mIdx}` : '';
      const isNewMilestone = Boolean(m && (opts.forceIntro || this._lastNarratedEventKey !== mKey));

      // 2× Speed LOD: speak only on dynasty switch or territory-changing stops.
      if (speed >= 2 && !isNewDynasty) {
        const isMajor = Boolean(
          (m && m.isMapChange) || this._isMajorStopYear(this.year) || (m && this._isMajorStopYear(m.year))
        );
        if (!isMajor) return '';
      }

      const parts = [];
      if (isNewDynasty) {
        this._lastNarratedDynastyKey = cur.key;
        if (dName) parts.push(dName);
      }

      if (m && isNewMilestone) {
        this._lastNarratedEventKey = mKey;
        const yrStr = this._spokenYear(m.year);
        const eraStr = speed < 2 ? this._spokenEra(cur, m) : '';
        const headStr = this._cleanSpokenText(this.milestoneHeadline(cur, m), speed >= 2);
        const siteStr = speed < 2 ? this._spokenSiteIfAbsent(m.site, headStr) : '';
        if (headStr) {
          const segs = [yrStr, eraStr, siteStr, headStr].filter(Boolean);
          parts.push(segs.join(isEn ? ', ' : '，'));
        }
      }

      return parts.join(isEn ? '. ' : '。');
    }

    _clearNarratorTimers() {
      if (this._narratorCancelTimer) {
        clearTimeout(this._narratorCancelTimer);
        this._narratorCancelTimer = null;
      }
      if (this._narratorWatchdog) {
        clearTimeout(this._narratorWatchdog);
        this._narratorWatchdog = null;
      }
      if (this._narratorMaxTimer) {
        clearTimeout(this._narratorMaxTimer);
        this._narratorMaxTimer = null;
      }
    }

    speakCurrentState(opts = {}) {
      if (!this.narrating || (!this.playing && !this.personTimer) || !this._hasSpeechSynthesis()) {
        this._narratorSpeaking = false;
        return false;
      }
      this._lastNarratedLocale = this.locale;
      const text = this._buildNarrationText(opts);
      if (!text) {
        this._narratorSpeaking = false;
        return false;
      }
      return this._dispatchUtterance(text, 0);
    }

    _dispatchUtterance(text, candidateIdx = 0) {
      if (!this._hasSpeechSynthesis()) return false;
      this._clearNarratorTimers();
      const seq = (this._narratorSeq = (this._narratorSeq || 0) + 1);
      const synth = window.speechSynthesis;
      const speed = Number(this.playSpeed) > 0 ? Number(this.playSpeed) : 1;
      // Lock the autoplay tick gate immediately (even during the 55ms cancel cooldown).
      this._narratorSpeaking = speed < 4;

      const speakNow = () => {
        if (seq !== this._narratorSeq || !this.narrating || (!this.playing && !this.personTimer)) {
          this._narratorSpeaking = false;
          return;
        }
        try {
          if (synth.paused) synth.resume();
        } catch (_) {}

        const candidates = this._candidateSpeechVoices();
        const voice = candidateIdx < candidates.length ? candidates[candidateIdx] : null;

        const utter = new window.SpeechSynthesisUtterance(text);
        this._activeUtterance = utter;

        const isEn = this.locale === 'en';
        const isTw = this.locale === 'zh-tw';
        utter.lang = isEn ? 'en-US' : isTw ? 'zh-TW' : 'zh-CN';

        if (voice) {
          utter.voice = voice;
          if (voice.lang) utter.lang = voice.lang;
        }

        // Keep speech rate within natural human bounds so voice timbre never turns robotic.
        utter.rate = speed <= 0.5 ? 0.95 : speed >= 4 ? 1.08 : speed >= 2 ? 1.16 : 1.05;
        utter.pitch = 1.0;
        utter.volume = 1.0;

        // At 4× timelapse speed, dynasty announcements should not block the timeline playhead.
        this._narratorSpeaking = speed < 4;
        this._duckMusicForNarration(true);
        let started = false;

        const finish = () => {
          if (seq !== this._narratorSeq) return;
          this._clearNarratorTimers();
          this._narratorSpeaking = false;
          this._activeUtterance = null;
          if (!this.narrating || (!this.playing && !this.personTimer)) {
            this._duckMusicForNarration(false);
            return;
          }
          if (this.musicPlaying) {
            this._duckMusicForNarration(false);
          }
          if (this.playing && speed < 4) {
            this.playHoldTicks = Math.max(this.playHoldTicks || 0, speed <= 0.5 ? 2 : 1);
          }
        };

        const tryNextVoiceOrFinish = () => {
          if (candidateIdx + 1 < candidates.length) {
            this._dispatchUtterance(text, candidateIdx + 1);
          } else {
            finish();
            // Runtime circuit breaker: if no voice in the entire browser session has ever
            // succeeded in starting speech, hide the narrator button automatically.
            if (!this._ttsEverSucceeded) {
              this._markNarratorUnsupported();
            }
          }
        };

        utter.onstart = () => {
          if (seq !== this._narratorSeq) return;
          started = true;
          this._ttsEverSucceeded = true;
          if (this._narratorWatchdog) {
            clearTimeout(this._narratorWatchdog);
            this._narratorWatchdog = null;
          }
        };
        utter.onend = finish;
        utter.onerror = (ev) => {
          if (seq !== this._narratorSeq) return;
          const errCode = ev && ev.error ? String(ev.error) : 'unknown';
          if (errCode === 'canceled' || errCode === 'interrupted') return;
          if (!started) {
            tryNextVoiceOrFinish();
            return;
          }
          finish();
        };

        this._narratorWatchdog = setTimeout(() => {
          if (seq !== this._narratorSeq || started) return;
          tryNextVoiceOrFinish();
        }, 1100);

        const maxMs = Math.min(20000, Math.max(5000, text.length * 380));
        this._narratorMaxTimer = setTimeout(() => {
          if (seq !== this._narratorSeq) return;
          finish();
        }, maxMs);

        try {
          synth.speak(utter);
          if (synth.paused) synth.resume();
        } catch (_) {
          tryNextVoiceOrFinish();
        }
      };

      let wasBusy = false;
      try {
        wasBusy = Boolean(synth.speaking || synth.pending || candidateIdx > 0);
        if (wasBusy) synth.cancel();
      } catch (_) {}

      let voicesReady = false;
      try {
        voicesReady = (synth.getVoices() || []).length > 0;
      } catch (_) {}

      if (!voicesReady && typeof synth.addEventListener === 'function') {
        let fired = false;
        const onVoices = () => {
          if (fired) return;
          fired = true;
          try {
            synth.removeEventListener('voiceschanged', onVoices);
          } catch (_) {}
          speakNow();
        };
        try {
          synth.addEventListener('voiceschanged', onVoices);
        } catch (_) {}
        this._narratorCancelTimer = setTimeout(onVoices, 180);
      } else if (wasBusy) {
        this._narratorCancelTimer = setTimeout(speakNow, 55);
      } else {
        speakNow();
      }
      return true;
    }

    silenceNarrator() {
      this._narratorSpeaking = false;
      this._activeUtterance = null;
      this._narratorSeq = (this._narratorSeq || 0) + 1;
      this._clearNarratorTimers();
      if (this._hasSpeechSynthesis()) {
        try {
          window.speechSynthesis.cancel();
        } catch (_) {}
      }
      this._duckMusicForNarration(false);
    }

    onNarratorSpeedChange() {
      if (!this.narrating || (!this.playing && !this.personTimer)) return;
      const speed = Number(this.playSpeed) > 0 ? Number(this.playSpeed) : 1;
      if (speed >= 4 && this._narratorSpeaking) {
        this.silenceNarrator();
      }
    }

    startNarrator() {
      if (this.challenge || !this._hasSpeechSynthesis()) return false;
      this.narrating = true;
      this._lastNarratedDynastyKey = null;
      this._lastNarratedEventKey = null;
      this._lastNarratedPersonKey = null;
      this._updateNarratorUi();
      // Narrator is strictly an autoplay companion: turning it on starts autoplay if paused.
      if (!this.playing && !this.personTimer) {
        if (this.activePerson && typeof this.togglePersonAutoplay === 'function') {
          this.togglePersonAutoplay();
        } else if (typeof this.startAutoplay === 'function') {
          this.startAutoplay();
        }
      } else {
        this.speakCurrentState({ forceIntro: true });
      }
      return true;
    }

    stopNarrator() {
      this.narrating = false;
      this.silenceNarrator();
      this._updateNarratorUi();
      return false;
    }

    toggleNarrator() {
      // If narrator was armed but autoplay is currently paused, clicking #act-narrator
      // should resume narrated autoplay rather than requiring two clicks.
      if (this.narrating && (this.playing || this.personTimer)) {
        return this.stopNarrator();
      }
      return this.startNarrator();
    }
  }

  function install(Ctrl) {
    Ctrl._extendPrototype(AtlasNarratorMixin);
    if (typeof window !== 'undefined' && window.atlasApp && typeof window.atlasApp._probeNarratorSupport === 'function') {
      window.atlasApp._probeNarratorSupport();
    }
  }

  if (typeof window === 'undefined') return;
  const readyCtrl = window.HistoricalAtlasController;
  if (readyCtrl && typeof readyCtrl._extendPrototype === 'function') {
    install(readyCtrl);
  } else {
    (window.__ATLAS_MIXINS = window.__ATLAS_MIXINS || []).push(install);
  }
})();
