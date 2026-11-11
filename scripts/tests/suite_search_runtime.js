'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function runSearchRuntimeSuite(ctx) {
  ctx.ensureHydrated();
  const {
    ROOT,
    JS_DIR,
    FAST_MODE,
    sandbox,
    ControllerClass,
    ctrl,
    provinces,
    snapshots,
    snapKeys,
    bootSnapshots,
    dynasties,
    corridors,
    loreData,
    enLocale,
    indexHtml,
    cssSrc,
    appCode,
    zgDyn,
    qinDyn,
    xihanDyn,
    tangDyn,
    bsDyn,
    qingDyn,
    rocDyn,
    pointInShape,
    getCachedPersonEvents,
  } = ctx;
  const zgSnap = snapshots[ctrl._resolveSnapKey(zgDyn, -231)];
  const bsKey = ctrl._resolveSnapKey(bsDyn, 1100);

    // CUJ 38: Compositor Stage Wrapper, Deferred Typography Coalescing, Anti-Flicker Zoom & Zero Layout Thrashing Invariants (Issue #158)
    assert(
      indexHtml.includes('<div id="svg-stage-wrap">') &&
        cssSrc.includes('#svg-stage-wrap') &&
        cssSrc.includes('transform-origin: 0 0;') &&
        cssSrc.includes('contain: layout style;') &&
        cssSrc.includes('text-rendering: geometricPrecision;') &&
        cssSrc.includes('#atlas-svg.is-camera-moving *') &&
        !cssSrc.includes('#atlas-svg.is-camera-moving text') &&
        /\.neighbor-caption\.is-crowded-hidden[\s\S]*?display:\s*none;/m.test(cssSrc) &&
        appCode.includes('_commitStageTransform') &&
        appCode.includes('_runWithDeferredTypography') &&
        appCode.includes('if (this._camRaf !== null) return;') &&
        appCode.includes('_lastLegendKey') &&
        appCode.includes('this.isScrubbing') &&
        appCode.includes('this._zoomScaleNodes') &&
        appCode.includes('node.dataset.appliedDir') &&
        !appCode.includes("class: 'fade-enter'") &&
        !appCode.includes("disc.getBoundingClientRect()") &&
        !appCode.includes("label.getBoundingClientRect()"),
      'Expected #svg-stage-wrap compositor wrapper, geometricPrecision text rendering, deferred typography coalescing, no is-camera-moving text stroke stripping, _camRaf settle guard, _lastLegendKey cache, display:none on crowded captions, scrubbing flicker guards, and zero .jn-disc/.jn-label getBoundingClientRect calls'
    );
    {
      let typoExecCount = 0;
      const prevInstanceRescale = ctrl._rescaleSvgTypography;
      ctrl._deferTypographyDepth = 0;
      ctrl._typoDirty = false;
      ctrl._rescaleSvgTypography = function () {
        if (this._deferTypographyDepth > 0) {
          this._typoDirty = true;
          return;
        }
        this._typoDirty = false;
        typoExecCount++;
      };
      ctrl._runWithDeferredTypography(() => {
        ctrl._rescaleSvgTypography();
        ctrl._runWithDeferredTypography(() => {
          ctrl._rescaleSvgTypography();
          ctrl._rescaleSvgTypography();
        });
        ctrl._rescaleSvgTypography();
      });
      ctrl._rescaleSvgTypography = prevInstanceRescale;
      assert.strictEqual(
        typoExecCount,
        1,
        `Nested _runWithDeferredTypography blocks must coalesce multiple _rescaleSvgTypography calls into 1 pass, got ${typoExecCount}`
      );
      assert(
        appCode.includes('const zoomOnly = Boolean(') &&
          appCode.includes('if (zoomOnly && node.dataset.chosenDir)') &&
          appCode.includes("if (zoomOnly && node.dataset.placed === '1')"),
        'Expected zoomOnly direction/position lock in _rescaleSvgTypography to prevent label flipping during zoom'
      );
    }

    // CUJ 39: Quick Search Anti-Fake-Person, City-vs-Era Ranking, Quiz Clue Integrity & Person Chronicle Site Disentangling
    {
      for (const nonPersonQ of [
        '黄巾起义',
        '八王之乱',
        '鸦片战争',
        '科举',
        '丝绸之路',
        '都护府',
        '突厥',
        '吐蕃',
        '契丹',
        '女真',
        '红巾军',
      ]) {
        assert.strictEqual(
          ctrl._resolvePersonProfile(nonPersonQ),
          null,
          `_resolvePersonProfile("${nonPersonQ}") must not fabricate a fake person profile`
        );
        const qHits = ctrl._queryQuickSearch(nonPersonQ);
        assert(
          qHits.length > 0 && !qHits.some((h) => h.kind === 'person'),
          `Quick search for "${nonPersonQ}" must return historical events/regions/eras without fabricating a person hit`
        );
      }

      for (const cityQ of [
        '长安',
        '建康',
        '绍兴',
        '大同',
        '永嘉',
        '建安',
        '保定',
        '咸宁',
        '永昌',
        '建宁',
        '永安',
        '兴元',
        '大庆',
      ]) {
        const cHits = ctrl._queryQuickSearch(cityQ);
        assert(
          cHits.length > 0 && cHits[0].kind === 'city',
          `Famous city "${cityQ}" must rank #1 as kind="city" above same-named era, got ${JSON.stringify(cHits[0])}`
        );
      }
      for (const explicitEraQ of ['长安元年', '建康元年', '绍兴元年', '大同元年', '建安元年']) {
        const eHits = ctrl._queryQuickSearch(explicitEraQ);
        assert(
          eHits.length > 0 && eHits[0].kind === 'era',
          `Explicit era query "${explicitEraQ}" must rank #1 as kind="era", got ${JSON.stringify(eHits[0])}`
        );
      }

      // First-principles ontological bucket ranking & core regime recall (齐/宋/汉/唐)
      const qiHits = ctrl._queryQuickSearch('齐');
      assert(
        qiHits.length >= 6 &&
          qiHits[0].bucket === 'regime' &&
          qiHits[0].titleZh.includes('齐国') &&
          qiHits.slice(0, 5).some((h) => h.titleZh === '南齐') &&
          qiHits.slice(0, 5).some((h) => h.titleZh === '北齐'),
        `"齐" search must prioritize regime hits (齐国/南齐/北齐) in top 5, got ${JSON.stringify(qiHits.slice(0, 5).map((h) => h.titleZh))}`
      );
      assert(
        !qiHits.some((h) => h.kind === 'era'),
        `"齐" 1-char search must not return false-positive monarch/era substring hits like 魏齐王·正始元年`
      );
      assert.strictEqual(
        qiHits.filter((h) => h.titleZh === '齐郡').length,
        1,
        `"齐" search must consolidate cross-dynasty 齐郡 rows into 1 entry`
      );
      const qiJunHit = qiHits.find((h) => h.titleZh === '齐郡');
      assert(
        qiJunHit && qiJunHit.subZh && qiJunHit.subZh.startsWith('历'),
        `Consolidated 齐郡 entry must display multi-dynasty subtitle ("历..."), got "${qiJunHit && qiJunHit.subZh}"`
      );
      assert(
        qiHits.some((h) => h.bucket === 'person_era') &&
          qiHits.some((h) => h.bucket === 'geo') &&
          qiHits.some((h) => h.bucket === 'event'),
        `"齐" search must surface diverse ontological buckets (regime, person_era, geo, event)`
      );

      for (const [regQ, expectedTitles] of [
        ['宋', ['北宋', '南宋', '宋国', '刘宋']],
        ['汉', ['西汉', '东汉', '蜀汉']],
        ['唐', ['唐', '南唐', '后唐']],
      ]) {
        const rHits = ctrl._queryQuickSearch(regQ);
        assert(
          rHits.length > 0 && rHits[0].bucket === 'regime',
          `"${regQ}" search must rank regime bucket #1, got ${JSON.stringify(rHits[0])}`
        );
        for (const expT of expectedTitles) {
          assert(
            rHits.some((h) => h.titleZh.includes(expT)),
            `"${regQ}" search must recall core regime "${expT}", got ${JSON.stringify(rHits.map((h) => h.titleZh))}`
          );
        }
      }

      const clueChecks = [
        [{ ancient: '宛（南阳）', modern: '南阳' }, '宛', '秦置南阳郡治', '秦置南阳郡治'],
        [{ ancient: '晋阳', modern: '太原' }, '晋阳', '秦置太原郡治', '秦置太原郡治'],
        [{ ancient: '南郑（汉中）', modern: '汉中' }, '南郑', '汉中王刘邦都此 / 东汉汉中郡治', '汉中王刘邦都此 / 东汉汉中郡治'],
        [{ ancient: '临湘（长沙）', modern: '长沙' }, '临湘', '西汉长沙国都 / 东汉长沙郡治', '西汉长沙国都 / 东汉长沙郡治'],
        [{ ancient: '穰', modern: '南阳·邓州' }, '穰', '南阳穰县', '南阳穰县'],
        [{ ancient: '乐浪', modern: '平壤（朝鲜）' }, '乐浪', '朝鲜四郡之一', '朝鲜四郡之一'],
        [{ ancient: '徐闻', modern: '湛江·雷州' }, '徐闻', '雷州半岛极南重镇，汉代海丝远航始发港', '雷州半岛极南重镇，汉代海丝远航始发港'],
        [{ ancient: '彭城（徐州）', modern: '徐州' }, '彭城', '徐州治所', '徐州治所'],
        [{ ancient: '番禺', modern: '广州' }, '番禺', '南海郡治所 / 广州治所', '南海郡治所 / 广州治所'],
      ];
      for (const [sMock, disp, rawText, expected] of clueChecks) {
        assert.strictEqual(
          ctrl._sanitizeChallengeClue(rawText, sMock, disp),
          expected,
          `Quiz clue sanitization for "${disp}" must preserve historical geography "${expected}"`
        );
      }

      for (const j of loreData.HISTORICAL_JOURNEYS) {
        for (const st of j.stops) {
          assert(
            !/[·→]/.test(ctrl._stripPromptParenthetical(st.ancientZh)),
            `Journey "${j.key}" stop "${st.ancientZh}" must not stitch multiple cities onto one coordinate`
          );
        }
      }
      const sushiJ = loreData.HISTORICAL_JOURNEYS.find((j) => j.key === 'sushi');
      assert(
        sushiJ.stops.some((s) => s.ancientZh === '徐州' && s.year === 1077) &&
          sushiJ.stops.some((s) => s.ancientZh === '湖州' && s.year === 1079),
        'Su Shi journey must separate Xuzhou (1077) and Huzhou (1079) into distinct geocoded stops'
      );

      for (const p of loreData.PERSON_PROFILES) {
        const pEvs = getCachedPersonEvents(p);
        for (const ev of pEvs) {
          assert(
            !/[·→]/.test(ctrl._stripPromptParenthetical(ev.siteZh)),
            `Person "${p.zh}" event (${ev.year}) must resolve to a single site rather than compound "${ev.siteZh}"`
          );
        }
      }
      const lijingEvs = ctrl._collectPersonEvents(ctrl._resolvePersonProfile('李靖'));
      assert.strictEqual(lijingEvs[0].siteZh, '江陵', 'Li Jing 621 CE event must locate at 江陵 (not 虎牢 · 江陵)');
      const sunbinEvs = ctrl._collectPersonEvents(ctrl._resolvePersonProfile('孙膑'));
      assert(
        sunbinEvs.some((e) => e.year === -341 && e.siteZh === '马陵'),
        'Sun Bin -341 BCE event must locate at 马陵 (not 马陵 · 安邑)'
      );
      const shangyangEvs = ctrl._collectPersonEvents(ctrl._resolvePersonProfile('商鞅'));
      assert(
        shangyangEvs.some((e) => e.year === -341 && e.siteZh === '安邑') &&
          shangyangEvs.some((e) => e.year === -338 && e.siteZh === '商邑'),
        'Shang Yang -341 and -338 BCE events must locate at 安邑 and 商邑'
      );
      const jiangweiEvs = ctrl._collectPersonEvents(ctrl._resolvePersonProfile('姜维'));
      assert(
        jiangweiEvs.some((e) => e.year === 255 && e.siteZh === '狄道' && Math.abs(e.coord[0] - 104.62) < 1),
        'Jiang Wei 255 CE event must locate at 狄道 in Longxi (not 寿春)'
      );
      const yuxiProfile = ctrl._resolvePersonProfile('传国玉玺');
      assert(
        yuxiProfile && yuxiProfile.isRelic && ctrl._resolvePersonProfile('玉玺') === yuxiProfile && ctrl._resolvePersonProfile('和氏璧') === yuxiProfile,
        'Heirloom Seal of the Realm (传国玉玺) must resolve by canonical name and aliases (玉玺, 和氏璧)'
      );
      const yuxiEvs = ctrl._collectPersonEvents(yuxiProfile);
      assert.strictEqual(yuxiEvs.length, 13, '传国玉玺 must have 13 curated Zizhi Tongjian stops (-283 to 936)');
      assert.strictEqual(yuxiEvs[0].year, -283);
      assert.strictEqual(yuxiEvs[12].year, 936);
      assert(
        yuxiEvs.every((e) => e.quoteZh && e.quoteZh.includes('《资治通鉴')),
        'Every 传国玉玺 stop must cite Zizhi Tongjian (《资治通鉴》)'
      );
      const qinDynForSeal = dynasties.find((d) => d.key === 'qin');
      const m221 = qinDynForSeal.milestones.find((m) => m.year === -221);
      assert.strictEqual(ctrl._findRelicStopForMilestone(qinDynForSeal, m221), 1);

      // Multi-person unified chronicle & era-synchronized map rendering (no cross-era Tang+Song stitching)
      delete ctrl.selectPersonEvent;
      assert(
        ctrl.openPersonChronicle(['libai', 'sushi'], -1) === true,
        'openPersonChronicle(["libai","sushi"]) must succeed'
      );
      assert.strictEqual(ctrl.year, 701, 'Opening libai,sushi at overview must jump to 701 CE (Tang)');
      assert.strictEqual(
        ctrl.grpGhostDiff.innerHTML,
        '',
        'Person chronicle must clear #grp-ghost-diff so previous dynasty dashed borders never stitch onto the map'
      );
      const tangVisTracks = ctrl._getVisiblePersonTracks();
      assert.strictEqual(
        tangVisTracks.length,
        1,
        'At 701 CE (Tang), _getVisiblePersonTracks for libai,sushi must return only Li Bai (1 track)'
      );
      assert.strictEqual(tangVisTracks[0].profile.key, 'libai');
      const sushiFirstIdx = ctrl.activePerson.events.findIndex((e) => e.personKey === 'sushi');
      assert(sushiFirstIdx >= 0, 'Combined libai,sushi events must contain Su Shi stops');
      ctrl.selectPersonEvent(sushiFirstIdx, true);
      assert.strictEqual(
        ctrl.year,
        ctrl.activePerson.events[sushiFirstIdx].year,
        'Selecting Su Shi event must advance map year to Northern Song'
      );
      const songVisTracks = ctrl._getVisiblePersonTracks();
      assert.strictEqual(
        songVisTracks.length,
        1,
        'At Northern Song year, _getVisiblePersonTracks for libai,sushi must return only Su Shi (1 track)'
      );
      assert.strictEqual(songVisTracks[0].profile.key, 'sushi');
      assert(
        ctrl.openPersonChronicle(['libai', 'dufu'], -1) === true &&
          ctrl._getVisiblePersonTracks().length === 2,
        'Contemporaries (libai,dufu) must show both tracks together on the Tang map'
      );
      assert(
        ctrl.openPersonChronicle(['liqingzhao', 'yuefei'], -1) === true &&
          ctrl._getVisiblePersonTracks().length === 2,
        'Contemporaries (liqingzhao,yuefei) must show both tracks together on the Song map'
      );
      ctrl.closeGenealogyCard();

      // URL address bar preservation & ?lang=en sync on language toggle
      const origHistory = sandbox.window.history;
      const origSearch = sandbox.location.search;
      const origHash = sandbox.location.hash;
      const origLocale = ctrl.locale;
      const replacedUrls = [];
      sandbox.window.history = {
        state: { page: 1 },
        replaceState(st, _title, url) {
          replacedUrls.push(url);
          const qIdx = url.indexOf('?');
          const hIdx = url.indexOf('#');
          sandbox.location.search =
            qIdx >= 0 ? url.slice(qIdx, hIdx >= 0 ? hIdx : undefined) : '';
        },
      };
      try {
        // 1. User specifies ?year=317&place=建康: toggling to EN appends lang=en without touching year/place
        sandbox.location.search = '?year=317&place=%E5%BB%BA%E5%BA%B7';
        sandbox.location.hash = '';
        ctrl.locale = 'en';
        ctrl._syncUrlLangParam();
        assert.strictEqual(
          sandbox.location.search,
          '?year=317&place=%E5%BB%BA%E5%BA%B7&lang=en',
          'Switching to EN must update address bar with lang=en while preserving user-specified URL params'
        );

        // 2. Switching to zh-tw updates lang=zh-tw while preserving user-specified URL params
        ctrl.locale = 'zh-tw';
        ctrl._syncUrlLangParam();
        assert.strictEqual(
          sandbox.location.search,
          '?year=317&place=%E5%BB%BA%E5%BA%B7&lang=zh-tw',
          'Switching to zh-tw must update address bar with lang=zh-tw while preserving user-specified URL params'
        );

        // 3. Switching back to zh removes lang param while keeping user-specified URL params intact
        ctrl.locale = 'zh';
        ctrl._syncUrlLangParam();
        assert.strictEqual(
          sandbox.location.search,
          '?year=317&place=%E5%BB%BA%E5%BA%B7',
          'Switching to zh must remove lang param while preserving user-specified URL params'
        );

        // 4. Bare homepage: switching to EN sets ?lang=en; switching back to zh restores clean pathname
        sandbox.location.search = '';
        ctrl.locale = 'en';
        ctrl._syncUrlLangParam();
        assert.strictEqual(sandbox.location.search, '?lang=en', 'Bare URL + EN must set ?lang=en');
        ctrl.locale = 'zh';
        ctrl._syncUrlLangParam();
        assert.strictEqual(sandbox.location.search, '', 'Bare URL + zh must clear query string');

        // 4b. Once armed, the URL mirrors restorable state (refresh/share land on the same view)
        // and one-shot params (place, q, quiz) are dropped because they no longer describe the screen.
        const urlSaved = {
          armed: ctrl._urlSyncArmed,
          year: ctrl.year,
          polity: ctrl.activePolity,
          trace: ctrl.activeTrace,
          person: ctrl.activePerson,
          personIdx: ctrl.activePersonEventIdx,
        };
        try {
          ctrl._urlSyncArmed = false;
          ctrl._scheduleUrlSync();
          assert(!ctrl._urlSyncTimer, 'A clean home load must not write the URL before the user interacts');

          ctrl._urlSyncArmed = true;
          Object.assign(ctrl, { activePerson: null, activePolity: null, activeTrace: null, year: 741 });
          sandbox.location.search = '?year=317&place=%E5%BB%BA%E5%BA%B7&q=x&quiz=1&terrain=0';
          ctrl.locale = 'en';
          ctrl._writeUrlState();
          assert.strictEqual(sandbox.location.search, '?year=741&terrain=0&lang=en', 'URL must carry the current year, keep terrain/lang and drop one-shot params');

          ctrl.locale = 'zh';
          Object.assign(ctrl, { year: 450, activePolity: { key: 'beiwei', curated: true } });
          ctrl._writeUrlState();
          assert.strictEqual(sandbox.location.search, '?year=450&polity=beiwei&terrain=0', 'An open curated profile must be shareable via ?polity=');

          ctrl.activePolity = { key: 'fallback_x', curated: false };
          ctrl._writeUrlState();
          assert.strictEqual(sandbox.location.search, '?year=450&terrain=0', 'Uncurated fallback profiles are not restorable and must not be written');

          Object.assign(ctrl, { activePolity: null, activeTrace: [108.94, 34.26] });
          ctrl._writeUrlState();
          assert.strictEqual(sandbox.location.search, '?year=450&trace=108.940,34.260&terrain=0', 'An open place card must round-trip via ?trace=lng,lat');

          ctrl.activePolity = { key: 'beiwei', curated: true };
          ctrl._writeUrlState();
          assert.strictEqual(sandbox.location.search, '?year=450&polity=beiwei&trace=108.940,34.260&terrain=0', 'A place card opened on top of a profile must be kept alongside ?polity=');
          ctrl.activePolity = null;

          const indexHtml = require('fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
          assert(/data-cf-beacon='[^']*"spa":\s*false/.test(indexHtml), 'Cloudflare beacon must keep "spa": false, or every URL state write is counted as a pageview');

          Object.assign(ctrl, { activePerson: { profiles: [{ key: 'libai' }, { key: 'dufu' }] }, activePersonEventIdx: 3 });
          ctrl._writeUrlState();
          assert.strictEqual(sandbox.location.search, '?year=450&person=libai,dufu&stop=3&terrain=0', 'Person trajectories (incl. pairs and the current stop) must be shareable');

          Object.assign(ctrl, { activePerson: { profiles: [{ key: 'adhoc_1' }] }, activeTrace: null });
          ctrl._writeUrlState();
          assert.strictEqual(sandbox.location.search, '?year=450&terrain=0', 'Ad-hoc people cannot be restored by key and must not be written');

          ctrl.activePerson = null;
          ctrl.locale = 'en';
          ctrl._syncUrlLangParam();
          assert.strictEqual(sandbox.location.search, '?year=450&terrain=0&lang=en', 'Language toggles go through the same state writer once armed');
          ctrl.locale = 'zh';
        } finally {
          ctrl._urlSyncArmed = urlSaved.armed;
          ctrl.year = urlSaved.year;
          ctrl.activePolity = urlSaved.polity;
          ctrl.activeTrace = urlSaved.trace;
          ctrl.activePerson = urlSaved.person;
          ctrl.activePersonEventIdx = urlSaved.personIdx;
          if (ctrl._urlSyncTimer) clearTimeout(ctrl._urlSyncTimer);
          ctrl._urlSyncTimer = null;
          sandbox.location.search = '';
        }

        // 4c. Embed mode (?embed=1): README-only feature, so the main site must stay untouched.
        const embedSaved = {
          embed: ctrl.embed,
          minYear: ctrl.minYear,
          maxYear: ctrl.maxYear,
          bandClip: ctrl._bandClip,
          armed: ctrl._urlSyncArmed,
          year: ctrl.year,
          trace: ctrl.activeTrace,
          polity: ctrl.activePolity,
          person: ctrl.activePerson,
        };
        try {
          assert.strictEqual(ctrl._parseEmbedParams(new URLSearchParams('year=1104')), null, 'Without embed=1 the site must not enter embed mode');
          // Compare as JSON: the object comes from the vm sandbox, whose Object.prototype differs.
          assert.strictEqual(
            JSON.stringify(ctrl._parseEmbedParams(new URLSearchParams('embed=1&year=1104&from=1072&to=1126&autoplay=1'))),
            JSON.stringify({ from: 1072, to: 1126, lock: false, autoplay: true, year: 1104 }),
            'Embed params must parse from/to/lock/autoplay/year'
          );

          const fullLo = ctrl.dynasties[0].fromYear;
          const fullHi = ctrl.dynasties[ctrl.dynasties.length - 1].toYear;
          const applyRange = (qs) => {
            Object.assign(ctrl, { minYear: fullLo, maxYear: fullHi, _bandClip: undefined });
            ctrl.embed = ctrl._parseEmbedParams(new URLSearchParams(qs));
            ctrl._applyEmbedYearRange();
          };
          applyRange('embed=1&from=1126&to=1072');
          assert(ctrl.minYear === 1072 && ctrl.maxYear === 1126, 'A reversed from/to must be swapped into a valid range');
          applyRange('embed=1&from=-9999&to=99999');
          assert(ctrl.minYear === fullLo && ctrl.maxYear === fullHi && !ctrl._bandClip, 'from/to beyond the atlas must clamp and leave the timeline unzoomed');
          applyRange('embed=1&year=1104&lock=1');
          assert(ctrl.minYear === 1104 && ctrl.maxYear === 1104, 'lock=1 must freeze the year bounds at year');

          applyRange('embed=1&from=1072&to=1126');
          ctrl._initTimelineBands();
          assert(Math.abs(ctrl._yearToProgress(1072)) < 1e-9, 'A zoomed embed timeline must start at from');
          assert(Math.abs(ctrl._yearToProgress(1099) - 0.5) < 0.02, 'A zoomed embed timeline must be linear over [from, to]');
          assert(Math.abs(ctrl._progressToYear(0.5) - 1099) <= 1, 'Scrubbing a zoomed embed timeline must map back to years inside [from, to]');
          assert(ctrl.bandWeights.filter((w) => w > 0).length === 1, 'Only dynasties overlapping [from, to] may take room on the zoomed timeline');

          ctrl._urlSyncArmed = true;
          Object.assign(ctrl, { year: 1104, activeTrace: [101.778, 36.617], activePolity: null, activePerson: null });
          sandbox.location.search = '?embed=1&year=1104&trace=101.778,36.617&from=1072&to=1126';
          ctrl._writeUrlState();
          ctrl._syncUrlLangParam();
          assert.strictEqual(sandbox.location.search, '?embed=1&year=1104&trace=101.778,36.617&from=1072&to=1126', 'An embed must never rewrite the URL (the host page owns its address bar)');
          const openUrl = ctrl._embedOpenUrl();
          assert(openUrl.endsWith('?year=1104&trace=101.778,36.617'), `The "open in atlas" link must carry the view without embed params, got ${openUrl}`);

          for (const readme of ['README.md', 'README_ZH.md']) {
            const text = require('fs').readFileSync(path.join(ROOT, readme), 'utf8');
            assert(text.includes('embed=1') && text.includes('from=1072&to=1126'), `${readme} must document embed mode`);
          }
        } finally {
          Object.assign(ctrl, {
            embed: embedSaved.embed,
            minYear: embedSaved.minYear,
            maxYear: embedSaved.maxYear,
            _bandClip: embedSaved.bandClip,
            _urlSyncArmed: embedSaved.armed,
            year: embedSaved.year,
            activeTrace: embedSaved.trace,
            activePolity: embedSaved.polity,
            activePerson: embedSaved.person,
          });
          ctrl._initTimelineBands();
          sandbox.location.search = '';
        }

        // 5. _effectiveRenderedLocale distinguishes pending English dict from loaded English dict
        const savedEnLocale = ctrl.enLocale;
        ctrl.locale = 'en';
        ctrl._setEnglishLocale({ dict: {} });
        assert.strictEqual(
          ctrl._effectiveRenderedLocale(),
          'en-pending',
          '_effectiveRenderedLocale must return en-pending when i18n_dict.js has not loaded yet'
        );
        ctrl._setEnglishLocale(savedEnLocale);
        assert.strictEqual(
          ctrl._effectiveRenderedLocale(),
          'en',
          '_effectiveRenderedLocale must return en once i18n_dict.js is loaded'
        );

        // 5b. Lazy lore detail loading (_isLoreDetailLoaded / _ensureLoreDetail) & zero-jump cold-boot search
        {
          for (const p of loreData.PERSON_PROFILES) {
            const actualEvCount = ctrl._collectPersonEvents(p).length;
            assert.strictEqual(
              p.evCount,
              actualEvCount,
              `PERSON_PROFILES[${p.key}].evCount (${p.evCount}) in js/lore_core.js must match _collectPersonEvents (${actualEvCount})`
            );
          }
          const fullShowcaseSig = ctrl
            ._getSearchShowcasePool()
            .map((x) => `${x.titleZh}|${x.subZh}|${x.titleEn}|${x.subEn}`)
            .join('\n');
          const fullSushiSubZh = ctrl._queryQuickSearch('苏轼')[0].subZh;
          const savedLoreSentinel = sandbox.window.ATLAS_LORE_DETAIL_LOADED;
          const savedLandmarks = sandbox.window.ATLAS_LORE_DATA.PLACE_LANDMARK_EVENTS;
          const savedJourneys = sandbox.window.ATLAS_LORE_DATA.HISTORICAL_JOURNEYS;
          const savedLoreLoaded = ctrl._loreDetailLoaded;
          const savedLorePromise = ctrl._loreDetailPromise;
          const savedLoadScriptOnce = ctrl._loadScriptOnce;
          let requestedSrc = null;
          try {
            sandbox.window.ATLAS_LORE_DETAIL_LOADED = false;
            delete sandbox.window.ATLAS_LORE_DATA.PLACE_LANDMARK_EVENTS;
            delete sandbox.window.ATLAS_LORE_DATA.HISTORICAL_JOURNEYS;
            ctrl._loreDetailLoaded = false;
            ctrl._loreDetailPromise = null;
            ctrl.searchIndex = null;
            ctrl._loadScriptOnce = () => ({ then() { return this; } });
            assert.strictEqual(
              ctrl._isLoreDetailLoaded(),
              false,
              '_isLoreDetailLoaded() must return false when lore_detail.js has not loaded yet'
            );
            const coldShowcaseSig = ctrl
              ._getSearchShowcasePool()
              .map((x) => `${x.titleZh}|${x.subZh}|${x.titleEn}|${x.subEn}`)
              .join('\n');
            assert.strictEqual(
              coldShowcaseSig,
              fullShowcaseSig,
              'Cold-boot search showcase pool before lore_detail.js loads must match post-load showcase pool with zero count jump'
            );
            const coldSushi = ctrl._queryQuickSearch('苏轼')[0];
            assert.strictEqual(
              coldSushi && coldSushi.subZh,
              fullSushiSubZh,
              `Cold-boot search for 苏轼 must match post-load subtitle (${fullSushiSubZh}), got ${coldSushi && coldSushi.subZh}`
            );
            const coldShuhan = ctrl._queryQuickSearch('蜀汉')[0];
            assert(
              coldShuhan && coldShuhan.kind === 'polity' && coldShuhan.polityKey === 'shuhan',
              'Cold-boot search for 蜀汉 must resolve polity shuhan from lore_core.js before lore_detail.js loads'
            );
            ctrl._loreDetailPromise = null;
            ctrl.searchIndex = [{ dummy: true }];
            ctrl._loadScriptOnce = (src) => {
              requestedSrc = src;
              sandbox.window.ATLAS_LORE_DATA.PLACE_LANDMARK_EVENTS = savedLandmarks;
              sandbox.window.ATLAS_LORE_DATA.HISTORICAL_JOURNEYS = savedJourneys;
              sandbox.window.ATLAS_LORE_DETAIL_LOADED = true;
              return {
                then(cb) {
                  return Promise.resolve(cb());
                },
              };
            };
            ctrl._ensureLoreDetail();
            assert(
              requestedSrc && requestedSrc.startsWith('js/lore_detail.js'),
              `_ensureLoreDetail() must request js/lore_detail.js, got ${requestedSrc}`
            );
            assert.strictEqual(
              ctrl._isLoreDetailLoaded(),
              true,
              '_isLoreDetailLoaded() must return true after _ensureLoreDetail() resolves'
            );
            assert.strictEqual(
              ctrl.searchIndex,
              null,
              '_ensureLoreDetail() must invalidate searchIndex so newly loaded landmarks/polities are indexed'
            );
          } finally {
            sandbox.window.ATLAS_LORE_DETAIL_LOADED = savedLoreSentinel;
            sandbox.window.ATLAS_LORE_DATA.PLACE_LANDMARK_EVENTS = savedLandmarks;
            sandbox.window.ATLAS_LORE_DATA.HISTORICAL_JOURNEYS = savedJourneys;
            ctrl._loreDetailLoaded = savedLoreLoaded;
            ctrl._loreDetailPromise = savedLorePromise;
            ctrl._loadScriptOnce = savedLoadScriptOnce;
            ctrl.searchIndex = null;
          }
        }
        // 6. WebMCP (navigator.modelContext) registration & Stdio MCP server (scripts/mcp_server.js)
        const registeredWebMcpTools = [];
        const origNav = sandbox.navigator;
        sandbox.navigator = {
          modelContext: {
            registerTool(t) {
              registeredWebMcpTools.push(t);
            },
          },
        };
        const returnedTools = ctrl._registerWebMcpTools();
        assert.strictEqual(
          registeredWebMcpTools.length,
          3,
          'WebMCP must register 3 tools (jiangshan_locate, jiangshan_inspect, jiangshan_open_person)'
        );
        assert.strictEqual(
          returnedTools.map((t) => t.name).join(','),
          'jiangshan_locate,jiangshan_inspect,jiangshan_open_person',
          'WebMCP tool names must match expected list'
        );
        sandbox.navigator = origNav;

        const { spawnSync } = require('child_process');
        const mcpServerPath = path.join(ROOT, 'scripts', 'mcp_server.js');
        assert(fs.existsSync(mcpServerPath), 'scripts/mcp_server.js must exist');
        new vm.Script(fs.readFileSync(mcpServerPath, 'utf8'), { filename: 'mcp_server.js' });
        if (!FAST_MODE) {
          const mcpPinyinCases = [
            { query: 'nanjingtiaoyue', year: 1842, title: '南京条约' },
            { query: 'nán jīng tiáo yuē', year: 1842, title: '南京条约' },
            { query: 'nibuchutiaoyue', year: 1689, title: '尼布楚条约' },
          ];
          const mcpRequests = [
            { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } },
            { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
            {
              jsonrpc: '2.0',
              id: 3,
              method: 'tools/call',
              params: { name: 'inspect_place', arguments: { year: 755, place: '范阳' } },
            },
            {
              jsonrpc: '2.0',
              id: 4,
              method: 'tools/call',
              params: { name: 'inspect_person', arguments: { person: '苏轼', stop: 6 } },
            },
            {
              jsonrpc: '2.0',
              id: 5,
              method: 'tools/call',
              params: { name: 'search_atlas', arguments: { query: '长安', limit: 3 } },
            },
            ...mcpPinyinCases.map(({ query }, index) => ({
              jsonrpc: '2.0',
              id: 6 + index,
              method: 'tools/call',
              params: { name: 'search_atlas', arguments: { query } },
            })),
          ]
            .map((r) => JSON.stringify(r))
            .join('\n') + '\n';
          const mcpProc = spawnSync(process.execPath, [mcpServerPath], {
            input: mcpRequests,
            encoding: 'utf8',
            timeout: 15000,
          });
          assert.strictEqual(mcpProc.status, 0, `mcp_server.js exited with ${mcpProc.status}: ${mcpProc.stderr}`);
          const mcpLines = mcpProc.stdout
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line));
          assert.strictEqual(
            mcpLines.length,
            5 + mcpPinyinCases.length,
            'mcp_server.js must return a JSON-RPC response for every request'
          );
          assert.strictEqual(mcpLines[0].result.serverInfo.name, 'jiangshan-atlas-mcp');
          assert.deepStrictEqual(
            mcpLines[1].result.tools.map((t) => t.name),
            ['inspect_place', 'inspect_person', 'search_atlas']
          );
          const fanyangRes = JSON.parse(mcpLines[2].result.content[0].text);
          assert.strictEqual(fanyangRes.year, 755);
          assert.strictEqual(fanyangRes.resolvedName, '幽州');
          assert.strictEqual(fanyangRes.polity, '大燕（安禄山）');
          assert(fanyangRes.regions.includes('河北道'), 'inspect_place(755, 范阳) must return 河北道');
          const sushiRes = JSON.parse(mcpLines[3].result.content[0].text);
          assert.strictEqual(
            sushiRes.resolvedName,
            '徐州',
            'inspect_person(苏轼, stop=6) must return resolvedName="徐州"'
          );
          assert.strictEqual(
            sushiRes.person.events[7].site,
            '湖州',
            'inspect_person(苏轼, stop=6) event[7].site must be "湖州"'
          );
          const searchRes = JSON.parse(mcpLines[4].result.content[0].text);
          assert.strictEqual(searchRes.results[0].kind, 'city', 'search_atlas(长安) must rank city #1');
          for (const [index, { query, year, title }] of mcpPinyinCases.entries()) {
            const pinyinRes = JSON.parse(mcpLines[5 + index].result.content[0].text);
            assert(
              pinyinRes.results.some(item => item.kind === 'event' &&
                item.year === year && item.titleZh.includes(title)),
              `MCP search_atlas(${query}) must find the ${year} ${title} event`
            );
          }
        }

        // CUJ 40: English Mode Zero-CJK Leak & Clue Integrity Guard
        ctrl.locale = 'en';
        ctrl.searchIndex = null;
        const enIdx = ctrl._ensureSearchIndex();
        const cjkIdxLeaks = enIdx.filter(
          (e) => /[\u4e00-\u9fff]/.test(e.titleEn || '') || /[\u4e00-\u9fff]/.test(e.subEn || '')
        );
        assert.strictEqual(
          cjkIdxLeaks.length,
          0,
          `English searchIndex must have 0 CJK leaks in titleEn/subEn, found ${cjkIdxLeaks.length}: ${JSON.stringify(cjkIdxLeaks[0])}`
        );
        for (const qStr of ['741', '208 BCE', 'Taizong', 'Yongle', '贞观', '开元二十九年']) {
          const eraHits = ctrl._matchEraResults(qStr);
          assert(eraHits.length > 0, `_matchEraResults("${qStr}") must return hits`);
          for (const h of eraHits) {
            assert(
              !/[\u4e00-\u9fff]/.test(h.titleEn || '') && !/[\u4e00-\u9fff]/.test(h.subEn || ''),
              `Era hit for "${qStr}" leaked CJK in English fields: ${JSON.stringify({ titleEn: h.titleEn, subEn: h.subEn })}`
            );
          }
        }
        assert.strictEqual(ctrl.trTerm('函谷关'), 'Hangu Pass');
        {
          const savedLocDeck = ctrl.locale;
          ctrl.locale = 'zh-tw';
          ctrl._buildChallengeDeck();
          const twPass = ctrl._challengeBaseTiers[0].find((x) => x.settlement.passKey === 'hanguguan');
          assert(twPass && twPass.settlement.ancient === '函谷關', 'Expected zh-tw challenge base tier to localize Hangu Pass as 函谷關');
          ctrl.locale = 'zh';
          ctrl._buildChallengeDeck();
          const hansPass = ctrl._challengeBaseTiers[0].find((x) => x.settlement.passKey === 'hanguguan');
          assert(hansPass && hansPass.settlement.ancient === '函谷关', 'Expected zh challenge base tier to invalidate zh-tw cache and restore 函谷关');
          ctrl.locale = savedLocDeck;
        }
        {
          const makeQuizEl = (tag = 'div') => {
            const attrs = new Map();
            const classes = new Set();
            const children = [];
            let html = '';
            return {
              tagName: tag.toUpperCase(),
              textContent: '',
              disabled: false,
              checked: true,
              onclick: null,
              style: {},
              dataset: {},
              children,
              childNodes: [],
              get innerHTML() { return html; },
              set innerHTML(v) { html = String(v); if (v === '') children.length = 0; },
              classList: {
                add: (...cs) => cs.forEach((c) => classes.add(c)),
                remove: (...cs) => cs.forEach((c) => classes.delete(c)),
                toggle: (c, force) => {
                  const on = force === undefined ? !classes.has(c) : Boolean(force);
                  if (on) classes.add(c); else classes.delete(c);
                  return on;
                },
                contains: (c) => classes.has(c),
              },
              setAttribute: (k, v) => {
                attrs.set(k, String(v));
                if (k === 'class') {
                  classes.clear();
                  String(v).split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
                }
              },
              getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
              appendChild: (ch) => { children.push(ch); return ch; },
              getBoundingClientRect: () => ({ left: 10, top: 10, right: 90, bottom: 30, width: 800, height: 600 }),
              getComputedTextLength: () => 44,
              querySelector: function (sel) {
                for (const ch of children) {
                  const match = sel.startsWith('text.')
                    ? ch.tagName === 'TEXT' && ch.classList.contains(sel.slice(5))
                    : sel.startsWith('.')
                      ? ch.classList.contains(sel.slice(1))
                      : ch.tagName === sel.toUpperCase();
                  if (match) return ch;
                  const sub = ch.querySelector && ch.querySelector(sel);
                  if (sub) return sub;
                }
                return null;
              },
            };
          };
          const quizEls = new Map();
          const getQuizEl = (id) => {
            if (!quizEls.has(id)) quizEls.set(id, makeQuizEl('div'));
            return quizEls.get(id);
          };
          const qCtrl = Object.create(ControllerClass.prototype);
          Object.assign(qCtrl, {
            projector: new sandbox.window.MercatorProjector(1000, 700, {
              west: 66,
              east: 142,
              south: 14,
              north: 55,
            }),
            dynasties,
            snapshots,
            enLocale,
            minYear: ctrl.minYear,
            maxYear: ctrl.maxYear,
            locale: 'zh',
            year: -221,
            dynastyIdx: 1,
            camera: { x: 0, y: 0, w: 1000, h: 700, zoom: 1 },
            svg: makeQuizEl('svg'),
            grpChallenge: makeQuizEl('g'),
            grpSettlements: makeQuizEl('g'),
            grpMilestones: makeQuizEl('g'),
            hoverTip: makeQuizEl('div'),
            _id: getQuizEl,
            _svgNode: (tag, attrs = {}, parent = null) => {
              const n = makeQuizEl(tag);
              for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
              if (parent) parent.appendChild(n);
              return n;
            },
            _applyZhHantDom: () => {},
            _recordGestureClick: () => {},
            stopAutoplay: () => {},
            clearCustomRoute: () => {},
            closeMilestoneBalloon: () => {},
            closeGenealogyCard: () => {},
            _syncImmersivePaneState: () => {},
            _scheduleUrlSync: () => {},
            _syncDocumentSeoMeta: () => {},
            _animateCameraTo: (cam) => { qCtrl.camera = { ...cam }; },
            _getDefaultCamera: () => ({ x: 0, y: 0, w: 1000, h: 700, zoom: 1 }),
            resetCamera: () => {},
            jumpToYear: (y) => { qCtrl.year = y; },
            _rescaleSvgTypography: () => { qCtrl._rescaleQuizChip(1000, 1); },
          });
          qCtrl._initTimelineBands();
          for (const loc of ['zh', 'zh-tw', 'en']) {
            qCtrl.locale = loc;
            qCtrl.startChallenge({ preferCurrentDynasty: true });
            assert(qCtrl.challenge && qCtrl.challenge.deck.length === 10, `Quiz deck failed for ${loc}`);
            qCtrl._previewLocatePin(500, 350);
            assert(Array.isArray(qCtrl.challenge.pendingGuess), `pendingGuess not set for ${loc}`);
            assert.strictEqual(qCtrl._quizChipAt(50, 20), true, `_quizChipAt hit failed for ${loc}`);
            assert.strictEqual(qCtrl._quizChipAt(500, 500), false, `_quizChipAt miss failed for ${loc}`);
            const [tx, ty] = qCtrl.projector.toScreen(...qCtrl.challenge.deck[0].settlement.coord);
            qCtrl._evaluateLocateClick(tx, ty);
            assert.strictEqual(qCtrl.challenge.answered, true);
            assert.strictEqual(qCtrl.challenge.lastPts, 100);
            qCtrl._finishChallenge();
            assert.strictEqual(qCtrl.challenge.finished, true);
            qCtrl.stopChallenge();
            assert.strictEqual(qCtrl.challenge, null);
          }
        }
        assert.strictEqual(ctrl.trTerm('南郑'), 'Nanzheng');
        assert.strictEqual(ctrl.trTerm('刺史部'), 'Inspectorate Region');
        const donghanDyn = dynasties.find((d) => d.key === 'donghan');
        const nanzhengSettle = donghanDyn.settlements.find((s) => s.ancient.startsWith('南郑'));
        const clueEn = ctrl._sanitizeChallengeClue(
          ctrl.trTerm(nanzhengSettle.remark),
          nanzhengSettle,
          'Nanzheng'
        );
        assert(
          clueEn.includes('Hanzhong Commandery') && !clueEn.includes('this site'),
          `English quiz clue for Nanzheng must preserve "Hanzhong Commandery", got "${clueEn}"`
        );

        // Verify #map-key legend box re-renders cleanly after async i18n_dict.js load (en-pending -> en) with 0 CJK leaks
        const checkedEnTerms = new Set();
        const assertEnTermNoCjk = (rawTerm, ctxLabel) => {
          if (!rawTerm || checkedEnTerms.has(rawTerm)) return;
          checkedEnTerms.add(rawTerm);
          const enVal = ctrl.trTerm(rawTerm);
          assert(!/[\u4e00-\u9fff]/.test(enVal), `${ctxLabel}: "${enVal}"`);
        };
        for (const [sid, snap] of Object.entries(snapshots)) {
          if (snap.caption) {
            assertEnTermNoCjk(snap.caption, `Snapshot ${sid} caption leaked CJK in English mode`);
          }
          if (snap.note) {
            assertEnTermNoCjk(snap.note, `Snapshot ${sid} note leaked CJK in English mode`);
          }
          for (const pol of snap.polities || []) {
            if (pol.title) {
              assertEnTermNoCjk(pol.title, `Snapshot ${sid} polity "${pol.title}" leaked CJK in English mode`);
            }
          }
        }
        {
          const savedEn = ctrl.enLocale;
          const savedDoc = sandbox.document;
          const savedMapKey = ctrl.mapKey;
          const makeNode = (tag = 'div', text = '') => {
            let htmlVal = '';
            const n = {
              tag,
              className: '',
              textContent: text,
              style: {},
              children: [],
              get innerHTML() {
                return htmlVal;
              },
              set innerHTML(v) {
                htmlVal = String(v);
                if (v === '') this.children.length = 0;
              },
              get firstChild() {
                return this.children[0] || null;
              },
              appendChild(c) {
                this.children.push(c);
                return c;
              },
              addEventListener() {},
              setAttribute() {},
              classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
            };
            return n;
          };
          sandbox.document = {
            createElement: (tag) => makeNode(tag),
            createTextNode: (txt) => makeNode('#text', String(txt)),
          };
          ctrl.mapKey = makeNode('div');
          const zgSnap0 = snapshots.s_zhanguo_a;
          ctrl.dynastyIdx = 0;
          ctrl.year = -403;
          ctrl.locale = 'en';
          ctrl._setEnglishLocale({ strings: {}, dynasties: {}, milestones: {}, corridors: {}, dict: {} });
          ctrl._lastLegendSnap = null;
          ctrl._lastLegendKey = null;
          ControllerClass.prototype._renderLegendBox.call(ctrl, zgSnap0);
          assert(
            String(ctrl._lastLegendKey).includes(':en-pending:'),
            `Cold-boot _renderLegendBox before i18n_dict.js loads must tag _lastLegendKey with en-pending, got "${ctrl._lastLegendKey}"`
          );
          ctrl._setEnglishLocale(savedEn);
          ControllerClass.prototype._renderLegendBox.call(ctrl, zgSnap0);
          assert(
            String(ctrl._lastLegendKey).includes(':en:') &&
              !String(ctrl._lastLegendKey).includes('en-pending'),
            `Post-i18n _renderLegendBox must update _lastLegendKey to :en:, got "${ctrl._lastLegendKey}"`
          );
          const collectText = (n) => {
            if (!n) return '';
            let s = (n.textContent || '') + ' ' + (n.innerHTML || '');
            for (const c of n.children || []) s += ' ' + collectText(c);
            return s;
          };
          const legendRenderedText = collectText(ctrl.mapKey);
          sandbox.document = savedDoc;
          ctrl.mapKey = savedMapKey;
          assert(
            legendRenderedText.includes('Warring States') &&
              !legendRenderedText.includes('战国') &&
              !/[\u4e00-\u9fff]/.test(legendRenderedText),
            `#map-key after en-pending -> en transition must contain zero CJK characters, got "${legendRenderedText}"`
          );
        }

        // CUJ 41: Curated Atlas Enrichment (11 Textbook Events, 9 Household Figures & Dual Intersections, 7 Frontier Cities)
        ctrl.locale = 'zh';
        for (const [qText, expectedYear] of [
          ['五铢钱', -118],
          ['犯强汉者虽远必诛', -36],
          ['汉委奴国王', 57],
          ['至道十五路', 997],
          ['武经总要', 1044],
          ['葡萄牙', 1553],
          ['皇舆全览图', 1718],
          ['轮船招商局', 1872],
          ['保路', 1911],
        ]) {
          const evHits = ctrl._queryQuickSearch(qText);
          assert(
            evHits.some((h) => h.kind === 'event' && h.year === expectedYear),
            `Expected quick search "${qText}" to return event at year ${expectedYear}, got ${JSON.stringify(evHits.slice(0, 3))}`
          );
        }
        for (const [pKey, minStops] of [
          ['yanghu', 4],
          ['duyu', 6],
          ['zuti', 5],
          ['liukun', 5],
          ['zuchongzhi', 4],
          ['lidaoyuan', 4],
          ['shenkuo', 5],
          ['yeluchucai', 4],
          ['marcopolo', 5],
        ]) {
          const prof = loreData.PERSON_PROFILES.find((p) => p.key === pKey);
          assert(prof, `Missing curated PERSON_PROFILE "${pKey}"`);
          const stops = ctrl._collectPersonEvents(prof);
          assert(
            stops.length >= minStops,
            `Expected "${pKey}" to collect >=${minStops} stops, got ${stops.length}`
          );
        }
        ctrl.openPersonChronicle('羊祜,杜预', -1);
        assert(
          ctrl.activePerson &&
            ctrl.activePerson.isMulti &&
            ctrl.activePerson.sameTimeCount >= 2 &&
            ctrl.activePerson.events.filter((e) => e.isSharedEncounter).length >= 2,
          'openPersonChronicle("羊祜,杜预") must resolve >=2 shared Luoyang/Xiangyang stops'
        );
        ctrl.openPersonChronicle('祖逖,刘琨', -1);
        assert(
          ctrl.activePerson &&
            ctrl.activePerson.isMulti &&
            ctrl.activePerson.events.some((e) => e.isSharedEncounter && e.year === 298),
          'openPersonChronicle("祖逖,刘琨") must resolve their shared 298 CE Luoyang rooster-crow stop'
        );
        ctrl.closeGenealogyCard();
        for (const [dKey, ancName] of [
          ['tang', '姚州'],
          ['yuan', '澎湖巡检司'],
          ['ming', '乌思藏都司'],
          ['ming', '奴儿干都司'],
          ['ming', '大员'],
          ['qing', '乌里雅苏台'],
          ['qing', '科布多'],
        ]) {
          const dynObj = dynasties.find((d) => d.key === dKey);
          assert(
            dynObj && dynObj.settlements.some((s) => s.ancient === ancName),
            `Expected ${dKey} settlements to contain frontier anchor "${ancName}"`
          );
        }
        const qufuZg = dynasties[0].settlements.find((s) => s.ancient === '曲阜');
        assert(
          qufuZg && Array.isArray(qufuZg.capitalPeriods) && qufuZg.capitalPeriods[0][1] === -249,
          'Warring States Qufu must cap capitalPeriods at -249 BCE when Chu annexed Lu'
        );

        // Canonical place-name hygiene: zero parentheticals in s.ancient, STRATEGIC_PASSES.ancientZh, PLACE_GAZETTEER.name, and HISTORICAL_JOURNEYS.ancientZh
        for (const d of dynasties) {
          for (const s of d.settlements || []) {
            assert(
              !/[（()）]/.test(s.ancient),
              `Settlement ${d.key}:${s.ancient} must not contain parenthetical disambiguators in canonical ancient name`
            );
          }
        }
        for (const p of sandbox.window.ATLAS_LORE_DATA.STRATEGIC_PASSES || []) {
          assert(
            !/[（()）]/.test(p.ancientZh) && !/[（()）]/.test(p.ancientEn),
            `Strategic pass ${p.key} (${p.ancientZh} / ${p.ancientEn}) must not contain parentheticals`
          );
        }
        for (const g of sandbox.window.ATLAS_LORE_DATA.PLACE_GAZETTEER || []) {
          assert(
            !/[（()）]/.test(g.name),
            `Gazetteer entry ${g.name} must not contain parentheticals in canonical name`
          );
        }
        for (const j of sandbox.window.ATLAS_LORE_DATA.HISTORICAL_JOURNEYS || []) {
          for (const st of j.stops || []) {
            assert(
              !/[（()）]/.test(st.ancientZh) && !/[（()）]/.test(st.ancientEn),
              `Journey stop ${j.key}:${st.ancientZh} (${st.ancientEn}) must not contain parentheticals`
            );
          }
        }

        // Era-specific pass names (_passName) and settlement alias resolution
        const niangzi = sandbox.window.ATLAS_LORE_DATA.STRATEGIC_PASSES.find((p) => p.key === 'niangziguan');
        const wusheng = sandbox.window.ATLAS_LORE_DATA.STRATEGIC_PASSES.find((p) => p.key === 'wushengguan');
        const shanhai = sandbox.window.ATLAS_LORE_DATA.STRATEGIC_PASSES.find((p) => p.key === 'shanhaiguan');
        const meiguan = sandbox.window.ATLAS_LORE_DATA.STRATEGIC_PASSES.find((p) => p.key === 'meiguan');
        assert.strictEqual(ctrl._passName(niangzi, -403, 'zh'), '井陉关');
        assert.strictEqual(ctrl._passName(niangzi, -403, 'en'), 'Jingxing Pass');
        assert.strictEqual(ctrl._passName(niangzi, 741, 'zh'), '娘子关');
        assert.strictEqual(ctrl._passName(wusheng, -403, 'zh'), '冥阨');
        assert.strictEqual(ctrl._passName(wusheng, 1140, 'zh'), '武阳关');
        assert.strictEqual(ctrl._passName(wusheng, 1500, 'zh'), '武胜关');
        assert.strictEqual(ctrl._passName(shanhai, 755, 'zh'), '临渝关');
        assert.strictEqual(ctrl._passName(shanhai, 1644, 'zh'), '山海关');
        assert.strictEqual(ctrl._passName(meiguan, -210, 'zh'), '横浦关');
        assert.strictEqual(ctrl._passName(meiguan, 800, 'zh'), '梅关');

        for (const [aliasQ, yr, expAnc] of [
          ['鲁都', -403, '曲阜'],
          ['曾国', -403, '随'],
          ['东莱', -403, '之罘'],
          ['平江府', 1080, '苏州'],
          ['辑安（国内城）', 1800, '辑安'],
        ]) {
          const r = ctrl.resolvePlace(aliasQ, yr);
          assert(r && r.name === expAnc, `Expected alias "${aliasQ}" at ${yr} to resolve to "${expAnc}", got ${JSON.stringify(r)}`);
          const qHits = ctrl._queryQuickSearch(aliasQ);
          assert(qHits.some((h) => h.titleZh === expAnc), `Expected quick search "${aliasQ}" to hit "${expAnc}"`);
        }

        // CUJ 42: Search Empty-State Solo Preservation + Multi-Person (2–3 Person) Discovery
        ctrl.locale = 'zh';
        const scPool = ctrl._getSearchShowcasePool();
        assert(
          scPool.length === 16 && scPool[0].kind === 'person' && scPool[0].personKey === 'sushi',
          `Showcase pool must default to solo Su Shi at index 0 and contain 16 entries, got ${scPool.length}`
        );
        for (const soloKey of [
          'sushi',
          'zhugeliang',
          'huoqubing',
          'libai',
          'caocao',
          'xinqiji',
          'xuanzang',
          'wangyangming',
          'zhangqian',
          'dufu',
        ]) {
          assert(
            scPool.some((item) => item.kind === 'person' && item.personKey === soloKey),
            `Showcase pool must preserve solo figure "${soloKey}"`
          );
        }
        for (const pairKey of [
          'libai,dufu',
          'libai,dufu,gaoshi',
          'caocao,liubei,sunquan',
          'yanghu,duyu',
          'zuti,liukun',
          'zhugeliang,simayi',
        ]) {
          const hit = scPool.find(
            (item) => item.kind === 'multi_person' && item.personKeys.join(',') === pairKey
          );
          assert(hit, `Showcase pool must include multi-person encounter "${pairKey}"`);
          assert(
            !/[\u4e00-\u9fff]/.test(hit.titleEn) && !/[\u4e00-\u9fff]/.test(hit.subEn),
            `Multi-person showcase "${pairKey}" must have CJK-free English strings: ${hit.titleEn} / ${hit.subEn}`
          );
        }
        const zhChips = Array.from(ctrl._getSearchSampleQueries());
        assert.deepStrictEqual(zhChips, ['长安', '赤壁', '霍去病', '李白 杜甫 高适']);
        assert.strictEqual(ctrl._queryQuickSearch('霍去病')[0].kind, 'person');
        assert.strictEqual(ctrl._queryQuickSearch('李白 杜甫 高适')[0].kind, 'multi_person');
        assert(
          ctrl._searchPlaceholder(false).length <= 22 &&
            ctrl._searchPlaceholder(true).includes('李白 杜甫 高适'),
          'Chinese compact placeholder must fit 248px pill while expanded placeholder hints 2–3 person syntax'
        );

        ctrl.locale = 'en';
        const enChips = Array.from(ctrl._getSearchSampleQueries());
        assert.deepStrictEqual(enChips, ["Chang'an", 'Chibi', 'Cao Cao', 'Li Bai, Du Fu, Gao Shi']);
        assert.strictEqual(ctrl._queryQuickSearch('Cao Cao')[0].kind, 'person');
        const enPairHit = ctrl._queryQuickSearch('Li Bai, Du Fu, Gao Shi')[0];
        assert(
          enPairHit &&
            enPairHit.kind === 'multi_person' &&
            enPairHit.titleEn === 'Li Bai × Du Fu × Gao Shi',
          `English multi-person chip "Li Bai, Du Fu, Gao Shi" must resolve cleanly to Li Bai × Du Fu × Gao Shi, got ${JSON.stringify(enPairHit)}`
        );
        assert(
          !/[\u4e00-\u9fff]/.test(ctrl._searchPlaceholder(false)) &&
            !/[\u4e00-\u9fff]/.test(ctrl._searchPlaceholder(true)),
          'English search placeholders must contain zero CJK characters'
        );
        ctrl.locale = 'zh';

        // CUJ 43: Polity focus — per-regime profile (割据/并立政权) inside the chronicle pane
        const polProfiles = loreData.POLITY_PROFILES || [];
        assert(polProfiles.length >= 105, `Expected >= 105 curated polity profiles, got ${polProfiles.length}`);
        const polKeySet = new Set();
        for (const p of polProfiles) {
          assert(!polKeySet.has(p.key), `Duplicate polity key ${p.key}`);
          polKeySet.add(p.key);
          assert(
            p.zh && p.en && p.seatZh && p.seatEn && p.summaryZh && p.summaryEn && p.from <= p.to,
            `Polity ${p.key} must define bilingual name, seat, summary and a valid span`
          );
          assert(
            !/[\u4e00-\u9fff]/.test(`${p.en}${p.seatEn}${p.summaryEn}${p.rulersEn || ''}`),
            `Polity ${p.key} English fields must be CJK-free`
          );
          const pDesc = { ...p, curated: true };
          assert(
            Boolean(ctrl._polityRulers(pDesc)),
            `Polity ${p.key} must expose non-empty ruler lineage via rulersZh/rulersEn or monarchPrefix`
          );
          const pEvents = ctrl._polityEvents(pDesc);
          assert(
            pEvents.length >= 3,
            `Curated polity ${p.key} (${p.zh}) must surface >= 3 historical events, got ${pEvents.length}`
          );
          if (!FAST_MODE) {
            assert(
              ctrl._polityStages({ ...p, curated: true }).length > 0,
              `Polity ${p.key} titles ${JSON.stringify(p.titles)} must be drawn on at least one snapshot within its window`
            );
          } else {
            const [mf, mt] = ctrl._polityWindow(p);
            const hasSnapPol = ctrl
              ._polityPhaseRuns()
              .some((r) => r.to >= mf && r.from <= mt && ctrl._polityPolsInSnap(p, snapshots[r.snapKey]).length > 0);
            assert(
              hasSnapPol,
              `Polity ${p.key} titles ${JSON.stringify(p.titles)} must be drawn on at least one snapshot within its window`
            );
          }
          for (const q of polProfiles) {
            if (q === p) continue;
            const shared = p.titles.filter((t) => q.titles.includes(t));
            if (!shared.length) continue;
            const [pf, pt] = ctrl._polityWindow(p);
            const [qf, qt] = ctrl._polityWindow(q);
            assert(pt < qf || qt < pf, `Polities ${p.key}/${q.key} share title ${shared} with overlapping year windows`);
          }
        }
        for (const [title, yr, expKey] of [
          ['宋', 450, 'liusong'],
          ['齐', -300, 'qi_state'],
          ['齐', 490, 'nanqi'],
          ['吴', 250, 'sunwu'],
          ['吴', 920, 'yangwu'],
          ['魏', -350, 'wei_state'],
          ['魏', 240, 'caowei'],
          ['晋（河东）', 910, 'houtang'],
        ]) {
          const r = ctrl._resolvePolity(title, yr);
          assert(r.curated && r.key === expKey, `Title "${title}" at ${yr} must resolve to ${expKey}, got ${r.key}`);
        }
        const bwDesc = ctrl._resolvePolity('北魏', 450);
        const bwEvents = ctrl._polityEvents(bwDesc);
        assert(ctrl._polityStages(bwDesc).length >= 5, 'Northern Wei must expose >= 5 distinct territorial stages');
        assert(
          bwEvents.length >= 10 && bwEvents.every((e) => e.year >= 386 && e.year <= 534) && bwEvents.some((e) => e.year === 439),
          `Northern Wei events must stay within 386–534 and include the 439 unification, got ${bwEvents.map((e) => e.year)}`
        );
        assert(ctrl._polityRulers(bwDesc).startsWith('道武帝 → 明元帝'), `Northern Wei rulers must derive from era tracks, got ${ctrl._polityRulers(bwDesc)}`);
        assert.strictEqual(ctrl._polityRulers(ctrl._resolvePolity('后周', 955)), '太祖郭威 → 世宗柴荣 → 恭帝柴宗训');
        assert(
          ctrl._polityRulers(ctrl._resolvePolity('宋', 450)).startsWith('武帝 → 少帝 → 文帝'),
          `Liu Song rulers must derive from monarchPrefix era spans, got ${ctrl._polityRulers(ctrl._resolvePolity('宋', 450))}`
        );
        const ccDesc = ctrl._resolvePolity('曹操(北方)', 205);
        assert(
          !ccDesc.curated && ccDesc.from === 200 && ccDesc.to === 219 && ccDesc.keywords.includes('曹操'),
          `Uncurated warlord must derive its on-map span 200–219 and name keyword, got ${JSON.stringify(ccDesc)}`
        );
        assert(ctrl._polityEvents(ccDesc).length >= 5, 'Uncurated warlord must still surface related events');
        const dynByKey = (k) => ctrl.dynasties.find((d) => d.key === k);
        for (const [title, dk, expMain] of [
          ['唐', 'tang', true],
          ['宋', 'beisong', true],
          ['汉（郡国并行）', 'xihan', true],
          ['东晋', 'dongjin', true],
          ['南宋（闽广行朝）', 'nansong', true],
          ['中华民国', 'roc', true],
          ['唐（李渊）', 'sui', false],
          ['汉（刘邦）', 'qin', false],
          ['更始（汉）', 'xihan', false],
          ['南汉', 'beisong', false],
          ['魏', 'sanguo', false],
        ]) {
          assert.strictEqual(
            ctrl._isEraMainPolity(title, dynByKey(dk)),
            expMain,
            `"${title}" in ${dk} must ${expMain ? '' : 'not '}be the era's own regime`
          );
        }
        ctrl.locale = 'en';
        const xxRulersEn = ctrl._polityRulers(ctrl._resolvePolity('西夏', 1100));
        assert(
          xxRulersEn.startsWith('Emp. Jingzong → ') && !xxRulersEn.includes(' of W. Xia'),
          `English rulers must drop the repeated regime suffix, got ${xxRulersEn}`
        );
        ctrl.locale = 'zh';

        const polSaved = {};
        for (const k of ['_id', 'jumpToYear', '_zoomToPolity', '_renderLegendBox', 'toggleMobileChronicle', 'toggleChroniclePane', '_isMobileViewport', '_syncDocumentSeoMeta', 'year', 'dynastyIdx', 'grpPolities', 'lastRenderedSnap', 'paneCollapsed', 'eraFocus', '_closeLayersPopover', 'activeMilestone', 'playing', 'personTimer', 'mobileChronicleOpen', 'activePerson', 'activeTrace', 'activeCustomRoute', 'challenge']) {
          polSaved[k] = ctrl[k];
        }
        const polDocSaved = sandbox.document;
        const polMockEl = () => {
          let html = '';
          const el = {
            textContent: '', dataset: {}, scrollTop: 0, children: [],
            style: { setProperty() {}, removeProperty() {} },
            get innerHTML() { return html; },
            set innerHTML(v) { html = String(v); if (v === '') el.children.length = 0; },
            appendChild(c) { el.children.push(c); return c; },
            addEventListener() {}, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [],
            classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
          };
          return el;
        };
        const polEls = new Map();
        try {
          ctrl._id = (id) => {
            if (!polEls.has(id)) polEls.set(id, polMockEl());
            return polEls.get(id);
          };
          sandbox.document = { createElement: () => polMockEl(), title: '' };
          ctrl.grpPolities = polMockEl();
          ctrl._zoomToPolity = () => {};
          ctrl._renderLegendBox = () => {};
          ctrl.toggleMobileChronicle = () => {};
          ctrl.toggleChroniclePane = () => {};
          ctrl._isMobileViewport = () => false;
          ctrl._syncDocumentSeoMeta = () => {};
          ctrl.paneCollapsed = false;
          ctrl._fullSnapshotsLoaded = true;
          // Mirror jumpToYear's pane contract: full re-render on dynasty change, highlight otherwise.
          // Call prototype methods directly; earlier CUJs leave instance-level stubs behind.
          const ctrlProto = Object.getPrototypeOf(ctrl);
          ctrl.jumpToYear = (y) => {
            const prev = ctrl.dynastyIdx;
            ctrl.year = y;
            ctrl.dynastyIdx = ctrl._findDynastyIndex(y);
            const cur = ctrl.dynasties[ctrl.dynastyIdx];
            ctrl.lastRenderedSnap = ctrl.snapshots[ctrl._resolveSnapKey(cur, y)];
            if (prev !== ctrl.dynastyIdx) ctrlProto._renderChroniclePane.call(ctrl, cur);
            else ctrlProto._highlightCurrentMilestone.call(ctrl, cur);
          };
          ctrl.activePolity = null;
          ctrl.jumpToYear(100);
          const ntDesc = ctrl.openPolityByKey('nantang');
          assert(ntDesc && ctrl.activePolity && ctrl.activePolity.key === 'nantang', 'openPolityByKey(nantang) must activate Southern Tang');
          assert(ctrl.year >= 937 && ctrl.year <= 975, `openPolityByKey must jump into Southern Tang's reign, got ${ctrl.year}`);
          assert.strictEqual(polEls.get('dynasty-title').textContent, '南唐');
          assert(polEls.get('dynasty-summary').textContent.includes('李煜'), 'Pane summary must show the curated Southern Tang history');
          assert(polEls.get('polity-extra').innerHTML.includes('烈祖李昪'), 'Pane must list Southern Tang rulers');
          assert(polEls.get('milestone-list').children.length >= 5, 'Pane must list Southern Tang related events');
          assert.strictEqual(polEls.get('txt-milestones-heading').textContent, '相关大事');
          ctrl.jumpToYear(970);
          assert(ctrl.activePolity && ctrl.activePolity.key === 'nantang', 'Polity focus must persist across a dynasty boundary inside its reign (五代 -> 北宋)');
          ctrl.jumpToYear(990);
          assert(!ctrl.activePolity, 'Polity focus must auto-exit once the timeline leaves its reign');
          assert.strictEqual(polEls.get('txt-milestones-heading').textContent, '重大事件');
          ctrl.jumpToYear(1100);
          ctrl.openPolity('西夏');
          assert(ctrl.activePolity.key === 'xixia', 'Legend click on 西夏 must open the Western Xia profile');
          ctrl.closePolity();
          assert(!ctrl.activePolity && polEls.get('dynasty-title').textContent === ctrl.dynastyName(ctrl.dynasties[ctrl.dynastyIdx]), 'closePolity must restore the era overview');
          ctrl.openPolity('西夏');
          const mainRes = ctrl.openPolity('宋');
          assert(
            mainRes === null && !ctrl.activePolity && polEls.get('dynasty-title').textContent === ctrl.dynastyName(ctrl.dynasties[ctrl.dynastyIdx]),
            'Clicking the era\'s own regime (宋 in 北宋) must return to the era overview, not open a fabricated rival profile'
          );
          ctrl.lastRenderedSnap = ctrl.snapshots[ctrl._resolveSnapKey(ctrl.dynasties[ctrl.dynastyIdx], ctrl.year)];
          assert.strictEqual(ctrl._eraFocusTitle(), '宋', 'Clicking the era regime must focus its realm on the map');
          ctrl.openPolity('西夏');
          assert(!ctrl.eraFocus && ctrl.activePolity.key === 'xixia', 'Opening a rival profile must drop the era-regime focus');
          ctrl.openPolity('宋');
          ctrl.clearEraFocus();
          assert(!ctrl.eraFocus && ctrl._eraFocusTitle() === null, 'Second click on the focused era chip must clear the focus');
          ctrl.openPolity('宋');
          ctrl.jumpToYear(1300);
          assert(!ctrl.eraFocus, 'Era-regime focus must not survive leaving its dynasty');
          ctrl.jumpToYear(1100);
          ctrl._closeLayersPopover = () => false;
          Object.assign(ctrl, { activeMilestone: null, playing: false, personTimer: null, mobileChronicleOpen: false, activePerson: null, activeTrace: null, activeCustomRoute: null, challenge: null });
          polEls.set('genealogy-card', { ...polMockEl(), classList: { add() {}, remove() {}, toggle() {}, contains: (c) => c === 'is-hidden' } });
          ctrl.openPolity('西夏');
          assert(ctrl._dismissTopOverlay() === true && !ctrl.activePolity, 'Escape must exit a regime profile');
          ctrl.openPolity('宋');
          assert(ctrl._dismissTopOverlay() === true && !ctrl.eraFocus, 'Escape must clear the era-regime focus');
        } finally {
          for (const [k, v] of Object.entries(polSaved)) ctrl[k] = v;
          sandbox.document = polDocSaved;
          ctrl.activePolity = null;
        }

        const ntHit = ctrl._queryQuickSearch('南唐')[0];
        assert(ntHit && ntHit.kind === 'polity' && ntHit.polityKey === 'nantang', `Search 南唐 must rank the regime first, got ${JSON.stringify(ntHit && ntHit.titleZh)}`);
        const tbHit = ctrl._queryQuickSearch('拓跋魏').find((h) => h.kind === 'polity');
        assert(tbHit && tbHit.polityKey === 'beiwei', 'Alias 拓跋魏 must resolve to Northern Wei');
        ctrl.locale = 'en';
        const enPolHit = ctrl._queryQuickSearch('Southern Tang')[0];
        assert(enPolHit && enPolHit.polityKey === 'nantang', 'English search "Southern Tang" must resolve to the regime');
        ctrl.locale = 'zh';
      } finally {
        sandbox.window.history = origHistory;
        sandbox.location.search = origSearch;
        sandbox.location.hash = origHash;
        ctrl.locale = origLocale;
      }

      // CUJ 41: Polity Base Anchor & _rescaleSvgTypography Polygon Containment Invariant
      if (!FAST_MODE) {
        for (const [sid, snap] of Object.entries(snapshots)) {
          for (const pol of snap.polities || []) {
            if (pol.anchor && pol.shape) {
              const pName = pol.title || pol.name;
              assert(
                sandbox.window.MercatorProjector.pointInShape(pol.anchor[0], pol.anchor[1], pol.shape),
                `Polity "${pName}" in snapshot "${sid}" has base anchor ${JSON.stringify(pol.anchor)} outside its own polygon`
              );
            }
          }
        }
      }
      {
        const proto = ControllerClass.prototype;
        const realProj = new sandbox.window.MercatorProjector(1000, 700, {
          west: 66,
          east: 142,
          south: 14,
          north: 55,
        });
        const makeCls = (initial = []) => {
          const s = new Set(initial);
          return {
            add: (...items) => items.forEach((x) => s.add(x)),
            remove: (...items) => items.forEach((x) => s.delete(x)),
            toggle: (x, f) => {
              const on = f === undefined ? !s.has(x) : Boolean(f);
              if (on) s.add(x);
              else s.delete(x);
              return on;
            },
            contains: (x) => s.has(x),
          };
        };
        const zgSnap = snapshots.s_zhanguo_a;
        const zgDyn = dynasties.find((d) => d.key === 'zhanguo');
        for (const camW of [740, 340]) {
          const sNodes = (zgDyn.settlements || []).map((st) => {
            const [sx, sy] = realProj.toScreen(st.coord[0], st.coord[1]);
            const isCap = st.tier === 1 || st.capital;
            const isPass = st.tier === 'pass' || st.pass;
            const isT2 = st.tier === 2;
            const cls = ['settlement-node'];
            if (isCap) cls.push('is-capital');
            if (isPass) cls.push('is-pass');
            if (isT2) cls.push('is-tier2');
            const attrs = { 'data-x': String(sx), 'data-y': String(sy) };
            const nameAttrs = {};
            const nameEl = {
              textContent: st.ancient,
              getAttribute: (k) => nameAttrs[k] || null,
              setAttribute: (k, v) => { nameAttrs[k] = String(v); },
            };
            return {
              classList: makeCls(cls),
              dataset: {
                align: st.align || 'r',
                explicitAlign: st.align ? '1' : '0',
                lng: String(st.coord[0]),
                lat: String(st.coord[1]),
              },
              getAttribute: (k) => attrs[k] || null,
              setAttribute: (k, v) => { attrs[k] = String(v); },
              querySelector: (sel) => (sel === '.city-name' ? nameEl : null),
            };
          });
          const pNodes = (zgSnap.polities || []).map((pol) => {
            const [px, py] = realProj.toScreen(pol.anchor[0], pol.anchor[1]);
            const cls = ['polity-caption'];
            if (pol.role === 'neighbor') cls.push('neighbor');
            else if (pol.role === 'vassal' || pol.role === 'protectorate') cls.push('vassal');
            const attrs = {
              'data-x': String(px),
              'data-y': String(py),
              'data-base-x': String(px),
              'data-base-y': String(py),
            };
            return {
              classList: makeCls(cls),
              textContent: pol.title || pol.name,
              dataset: { polityTitle: pol.title || pol.name, polityRole: pol.role || 'primary' },
              _polShape: pol.shape,
              getAttribute: (k) => attrs[k] || null,
              setAttribute: (k, v) => { attrs[k] = String(v); },
            };
          });
          const mockCtrl = {
            camera: { x: 395, y: 310, w: camW, h: camW * 0.7, zoom: 1000 / camW },
            projector: realProj,
            _estimateLocalTextWidth: proto._estimateLocalTextWidth,
            svg: {
              classList: makeCls(),
              querySelectorAll: (sel) => (sel === '.settlement-node' ? sNodes : []),
            },
            grpSettlements: { classList: makeCls(), querySelectorAll: () => [] },
            grpPrefectures: { classList: makeCls(), querySelectorAll: () => [] },
            grpCorridors: { classList: makeCls(), querySelectorAll: () => [] },
            grpMilestones: { classList: makeCls(), querySelectorAll: () => [] },
            grpPolities: {
              classList: makeCls(),
              querySelectorAll: (sel) => (sel === '.polity-caption' ? pNodes : []),
            },
            grpNeighbors: { querySelectorAll: () => [] },
            grpProvNames: { querySelectorAll: () => [] },
          };
          proto._rescaleSvgTypography.call(mockCtrl);
          assert(pNodes.length >= 15, `Expected >= 15 polity captions at -403 BCE, got ${pNodes.length}`);
          for (const pNode of pNodes) {
            if (pNode._polShape) {
              const px = parseFloat(pNode.getAttribute('data-x'));
              const py = parseFloat(pNode.getAttribute('data-y'));
              const [lngP, latP] = realProj.toGeo(px, py);
              assert(
                sandbox.window.MercatorProjector.pointInShape(lngP, latP, pNode._polShape),
                `Polity caption "${pNode.textContent}" at -403 BCE (camW=${camW}) jumped outside its territory polygon to [${lngP.toFixed(2)}, ${latP.toFixed(2)}]`
              );
            }
          }
        }
      }

      // CUJ 42: Mobile Layout, Single-Row Collapsed Chronicle Bar & iOS Search Input Auto-Zoom Prevention
      assert(
        !cssSrc.includes('grid-template-rows: 1fr 40px') &&
          cssSrc.includes('grid-template-rows: 1fr auto') &&
          cssSrc.includes('#workspace-body:not(.is-mobile-chronicle-open) #chronicle-pane .seat-row') &&
          cssSrc.includes('#workspace-body.is-mobile-chronicle-open #chronicle-pane #dynasty-seat') &&
          cssSrc.includes('#viewport-frame:has(#milestone-balloon:not(.is-hidden)) .settlement-node .cap-hint-tag') &&
          cssSrc.includes('#inp-map-search,\n  #inp-year {\n    font-size: 16px;') &&
          appCode.includes('if (!this._isMobileViewport()) searchInp.focus();'),
        'css/style.css & js/app.js must use single-row collapsed mobile chronicle bar, prevent iOS Safari auto-zoom (#inp-map-search font-size: 16px), and avoid synchronous searchInp.focus() on mobile chip clicks'
      );

      // CUJ 43: Wu Zhou (武周, 690–705) Interregnum Snapshots, Shendu Luoyang Capital & Polity Profile
      {
        const tangDyn = dynasties.find((d) => d.key === 'tang');
        assert.strictEqual(
          tangDyn.focusYear,
          741,
          'tang.focusYear must sit in Li-Tang High Tang (741) rather than inside Wu Zhou (690–704)'
        );
        assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 669), 's_tang_a4');
        assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 670), 's_tang_a4b');
        assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 676), 's_tang_a6');
        assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 679), 's_tang_a');
        assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 685), 's_tang_a');
        assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 689), 's_tang_a7');
        assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 690), 's_tang_wz0');
        assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 692), 's_tang_wz1');
        assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 697), 's_tang_wz1');
        assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 700), 's_tang_wz1b');
        assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 702), 's_tang_wz2');
        assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 704), 's_tang_wz2');
        assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 705), 's_tang_a5z');
        assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 713), 's_tang_a5y');
        assert.strictEqual(ctrl._resolveSnapKey(tangDyn, 738), 's_tang_a5');

        for (const sk of ['s_tang_wz0', 's_tang_wz1', 's_tang_wz2']) {
          const wzMain = snapshots[sk].polities.find((p) => p.role === 'main');
          assert(
            wzMain && wzMain.title === '武周' && wzMain.tint === '#9b3b4a',
            `${sk} main polity must be 武周 (#9b3b4a), got ${JSON.stringify(wzMain && { title: wzMain.title, tint: wzMain.tint })}`
          );
          for (const prot of snapshots[sk].polities.filter((p) => p.role === 'protectorate')) {
            assert.strictEqual(
              prot.tint,
              '#9b3b4a',
              `${sk} protectorate "${prot.title}" must use Wu Zhou tint #9b3b4a`
            );
          }
        }
        assert(
          snapshots.s_tang_wz2.polities.some((p) => p.title === '北庭都护府'),
          's_tang_wz2 (702–705) must include 北庭都护府 established by Wu Zetian in 702 CE'
        );

        const changAnItem = tangDyn.settlements.find((s) => s.ancient === '长安');
        const luoyangItem = tangDyn.settlements.find((s) => s.modern === '洛阳');
        assert.strictEqual(ctrl._isSettlementCapital(changAnItem, 689), true);
        assert.strictEqual(ctrl._isSettlementCapital(changAnItem, 695), false);
        assert.strictEqual(ctrl._isSettlementCapital(changAnItem, 705), true);
        assert.strictEqual(ctrl._isSettlementCapital(luoyangItem, 689), false);
        assert.strictEqual(ctrl._isSettlementCapital(luoyangItem, 690), true);
        assert.strictEqual(ctrl._isSettlementCapital(luoyangItem, 704), true);
        assert.strictEqual(ctrl._isSettlementCapital(luoyangItem, 705), false);
        assert.strictEqual(ctrl._settlementAncient(luoyangItem, 689), '东都洛阳');
        assert.strictEqual(ctrl._settlementAncient(luoyangItem, 695), '神都洛阳');
        assert.strictEqual(ctrl._settlementAncient(luoyangItem, 705), '东都洛阳');
        // 龟兹 is not the Anxi seat while the Four Garrisons are lost (670–679, 686–692); the seat is
        // labelled at 西州 only for 670–679 (whether it moved there again in 686 is disputed).
        const anxiSeat = tangDyn.settlements.find((s) => s.ancient === '安西都护府');
        const xizhouItem = tangDyn.settlements.find((s) => s.ancient === '西州');
        for (const [yr, kucha, xizhou] of [[669, '安西都护府', '西州'], [673, '龟兹', '西州（安西都护府）'], [681, '安西都护府', '西州'], [688, '龟兹', '西州'], [692, '安西都护府', '西州']]) {
          assert.strictEqual(ctrl._settlementAncient(anxiSeat, yr), kucha);
          assert.strictEqual(ctrl._settlementAncient(xizhouItem, yr), xizhou);
        }

        ctrl.locale = 'zh';
        const wzInspZh = ctrl.inspect({ year: 695, place: '洛阳' });
        assert.strictEqual(wzInspZh.polity, '武周');
        assert.strictEqual(wzInspZh.resolvedName, '神都洛阳');
        assert.strictEqual(wzInspZh.nearestCity && wzInspZh.nearestCity.ancient, '神都洛阳');
        assert.strictEqual(Boolean(wzInspZh.nearestCity && wzInspZh.nearestCity.isCapital), true);
        const revInspZh = ctrl.inspect({ year: 705, place: '洛阳' });
        assert.strictEqual(revInspZh.polity, '唐');
        assert.strictEqual(revInspZh.resolvedName, '东都洛阳');

        ctrl.locale = 'en';
        assert.strictEqual(ctrl.formatEraLabel(695, tangDyn), 'Wu Zhou · Wu Zetian');
        assert.strictEqual(ctrl.formatEraLabel(705, tangDyn), 'Tang · Emp. Zhongzong');
        assert.strictEqual(
          ctrl.formatEraLabel(15, dynasties.find((d) => d.key === 'xihan')),
          'Xin · Wang Mang'
        );
        const wzInspEn = ctrl.inspect({ year: 695, place: 'Shendu Luoyang' });
        assert.strictEqual(wzInspEn.polity, 'Wu Zhou');
        assert.strictEqual(wzInspEn.resolvedName, 'Shendu Luoyang');
        assert(
          !/[\u4e00-\u9fff]/.test(JSON.stringify(wzInspEn)),
          `English inspect(695, Shendu Luoyang) leaked CJK: ${JSON.stringify(wzInspEn)}`
        );

        const wzHitsZh = ctrl._queryQuickSearch('武周');
        assert(
          wzHitsZh.length > 0 && wzHitsZh[0].kind === 'polity' && wzHitsZh[0].polityKey === 'wuzhou',
          `Quick search for "武周" must rank curated polity wuzhou #1, got ${JSON.stringify(wzHitsZh[0])}`
        );
        const wzHitsEn = ctrl._queryQuickSearch('Wu Zhou');
        assert(
          wzHitsEn.length > 0 && wzHitsEn[0].kind === 'polity' && wzHitsEn[0].polityKey === 'wuzhou',
          `Quick search for "Wu Zhou" must rank curated polity wuzhou #1, got ${JSON.stringify(wzHitsEn[0])}`
        );
        const wzResolved = ctrl._resolvePolity('武周', 695);
        assert(
          wzResolved && wzResolved.curated && wzResolved.key === 'wuzhou' && wzResolved.from === 690 && wzResolved.matchTo === 704,
          `_resolvePolity("武周", 695) must resolve curated wuzhou profile (690–704), got ${JSON.stringify(wzResolved)}`
        );
        const wzStages = ctrl._polityStages(wzResolved);
        assert(
          wzStages.length === 2 && wzStages[0].from === 690 && wzStages[0].to === 701 && wzStages[1].from === 702 && wzStages[1].to === 704,
          `Wu Zhou polity stages must be [690–701, 702–704], got ${JSON.stringify(wzStages)}`
        );
        ctrl.locale = 'zh';
      }

      // CUJ 45: High-resolution terrain tiles — reset view stays on the base relief, Data Saver is
      // respected, every indexed tile exists, and the base relief shares the tiles' projection.
      {
        assert(
          indexHtml.includes('<g id="terrain-relief-layer">') &&
            indexHtml.includes('<g id="grp-terrain-tiles"></g>') &&
            indexHtml.includes('<g id="grp-paleo-sea"></g>') &&
            cssSrc.includes('#terrain-relief-layer {\n  opacity: 0.48;') &&
            cssSrc.includes('.paleo-sea {\n  fill: #e6dfd1;'),
          'index.html must wrap #terrain-relief-img, #grp-terrain-tiles, and #grp-paleo-sea in #terrain-relief-layer so .paleo-sea (#e6dfd1) composites seamlessly with open water'
        );
        const terrainIdx = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'terrain', 'index.json'), 'utf8'));
        assert(
          terrainIdx.tileSize === 512 && Object.keys(terrainIdx.levels).length > 0,
          'assets/terrain/index.json must declare 512 px tiles and at least one level'
        );
        for (const [z, list] of Object.entries(terrainIdx.levels)) {
          for (const xy of list) {
            const [x, y] = xy.split('_');
            assert(
              fs.existsSync(path.join(ROOT, 'assets', 'terrain', z, x, `${y}.webp`)),
              `assets/terrain/index.json lists ${z}/${x}/${y}.webp but the file is missing`
            );
          }
        }
        const buildPy = fs.readFileSync(path.join(ROOT, 'scripts', 'build_terrain_tiles.py'), 'utf8');
        assert(
          buildPy.includes('PROJ_W, PROJ_H, WEST, EAST, SOUTH, NORTH = 1000, 700, 66, 142, 14, 55') &&
            buildPy.includes('BASE_RECT = (-80, -40, 1160, 780)') &&
            indexHtml.includes('x="-80" y="-40" width="1160" height="780"') &&
            appCode.includes('new MercatorProjector(1000, 700, {\n        west: 66,\n        east: 142,\n        south: 14,\n        north: 55,'),
          'scripts/build_terrain_tiles.py base-relief constants must mirror the app projector and the #terrain-relief-img rect'
        );
        const proto = ControllerClass.prototype;
        const tCtrl = {
          projector: new sandbox.window.MercatorProjector(1000, 700, { west: 66, east: 142, south: 14, north: 55 }),
          _terrainTileSize: terrainIdx.tileSize,
          _terrainIndex: new Map(Object.entries(terrainIdx.levels).map(([z, l]) => [Number(z), new Set(l)])),
          _getDefaultCamera: () => ({ x: 350, y: 215, w: 500, h: 420, zoom: 2 }),
          _isMobileViewport: () => false,
        };
        // Camera width in SVG units on a ~1400 CSS px wide map.
        const level = (w) => proto._terrainTileLevel.call(tCtrl, { w }, 1400 / w, 'free');
        assert.strictEqual(level(500), null, 'The default (reset) camera must stay on the base relief without loading tiles');
        const zDeep = level(125);
        assert(zDeep !== null && tCtrl._terrainIndex.has(zDeep), `Max zoom must select an indexed tile level, got ${zDeep}`);
        assert(level(300) !== null && level(300) <= zDeep, 'Zooming in must never select a coarser tile level');
        const origNav = sandbox.navigator;
        sandbox.navigator = { connection: { saveData: true } };
        assert.strictEqual(level(125), null, 'Data Saver must skip terrain tiles');
        sandbox.navigator = { connection: { effectiveType: 'slow-2g' } };
        assert.strictEqual(level(125), null, 'Slow 2G links must skip terrain tiles');
        sandbox.navigator = origNav;
      }

      // CUJ 44: Strict Zero-Side-Effect Pan/Scrub/Hover Performance Invariants (Issue #196)
      assert(
        cssSrc.includes('mix-blend-mode: multiply') &&
          cssSrc.includes('backdrop-filter:') &&
          cssSrc.includes('#atlas-svg.is-scrubbing *') &&
          cssSrc.includes('#atlas-svg.is-scrubbing .cap-breath-ring'),
        'css/style.css must preserve all resting visual styles (multiply blend + backdrop-filter) while suppressing infinite SVG animations/transitions during is-scrubbing'
      );
      {
        const proto = ControllerClass.prototype;
        const testProj = new sandbox.window.MercatorProjector(1000, 700, {
          west: 66,
          east: 142,
          south: 14,
          north: 55,
        });
        const makeCls = () => {
          const s = new Set();
          return {
            add: (...c) => c.forEach((x) => s.add(x)),
            remove: (...c) => c.forEach((x) => s.delete(x)),
            contains: (c) => s.has(c),
            toggle: (c, f) => {
              const on = f === undefined ? !s.has(c) : Boolean(f);
              if (on) s.add(c);
              else s.delete(c);
              return on;
            },
          };
        };

        // Hover cards are measured, centred above the pointer with one 16 px gap
        // for every pointer type, flip 56 px below near the top edge, and stay
        // inside the map. Placement must not read computed styles on hover.
        const frameRect = { left: 100, top: 50, width: 800, height: 600 };
        let tipSize = { width: 240, height: 70 };
        const priorComputedStyle = sandbox.window.getComputedStyle;
        sandbox.window.getComputedStyle = () => {
          throw new Error('Hover placement must not read computed styles');
        };
        const hoverCtrl = Object.assign(Object.create(proto), {
          locale: 'zh',
          _id: () => ({ getBoundingClientRect: () => frameRect }),
          hoverTip: {
            innerHTML: '', style: {}, classList: makeCls(),
            querySelector: () => null,
            getBoundingClientRect: () => tipSize,
          },
        });
        for (const pointerType of ['mouse', 'touch']) for (const [x, y, width, height] of [
          [400, 300, 240, 70], [400, 12, 240, 70], [400, 100, 240, 70],
          [12, 12, 240, 70], [788, 12, 240, 70],
          [12, 588, 240, 70], [788, 588, 240, 70], [700, 300, 300, 160],
        ]) {
          tipSize = { width, height };
          hoverCtrl._showHoverTip({
            clientX: x + frameRect.left, clientY: y + frameRect.top, pointerType, target: {},
          }, '<b>开封府</b>');
          const left = parseFloat(hoverCtrl.hoverTip.style.left);
          const top = parseFloat(hoverCtrl.hoverTip.style.top);
          assert(left >= 8 && top >= 8 && left + width <= 792 && top + height <= 592,
            'Wrapped hover cards must fit inside the map');
          if (x - width * 0.5 >= 8 && x + width * 0.5 <= 792) {
            assert(Math.abs(left + width * 0.5 - x) < 1e-7,
              'Hover cards must center over their hovered point when there is room');
          }
          if (y - 16 - height >= 8) {
            assert(Math.abs(top + height - (y - 16)) < 1e-7,
              `${pointerType} hover cards must sit 16 px above the pointer`);
          } else {
            assert.strictEqual(top, y + 56, `${pointerType} hover cards must flip 56 px below the pointer near the top edge`);
          }
        }
        // City labels can move above, beside or below the dot as zoom changes.
        // A high label must remain readable; near the top, keep the fallback.
        tipSize = { width: 240, height: 70 };
        for (const [placement, y, labelTop] of [
          ['above', 300, 260], ['beside', 300, 294], ['below', 300, 320],
          ['near the top edge', 100, 12],
        ]) {
          const nameEl = { getBoundingClientRect: () => ({ top: frameRect.top + labelTop }) };
          hoverCtrl._showHoverTip({ clientX: 400 + frameRect.left, clientY: y + frameRect.top }, '<b>开封府</b>', nameEl);
          const top = parseFloat(hoverCtrl.hoverTip.style.top);
          const anchorTop = Math.min(y, labelTop);
          if (anchorTop - 16 - tipSize.height >= 8) {
            assert(top + tipSize.height <= labelTop - 16,
              `Tooltip must stay at least 16 px above a city name ${placement}`);
            assert(Math.abs(top + tipSize.height - (anchorTop - 16)) < 1e-7,
              `City name ${placement} must use the higher anchor`);
          } else {
            assert.strictEqual(top, y + 56, 'High city names must fall back 56 px below the pointer');
          }
        }
        if (priorComputedStyle === undefined) delete sandbox.window.getComputedStyle;
        else sandbox.window.getComputedStyle = priorComputedStyle;

        // 44a. Pure camera pan commits exact viewBox (no stage CSS transform checkerboarding) and suppresses infinite pulse animations via is-camera-moving
        let viewBoxWrites = 0;
        let committedVb = '';
        const hoveredMockPref = { classList: makeCls() };
        hoveredMockPref.classList.add('is-hovered');
        const panCtrl = Object.assign(Object.create(proto), {
          camera: { x: 100, y: 80, w: 600, h: 420, zoom: 1000 / 600 },
          projector: testProj,
          svg: {
            classList: makeCls(),
            setAttribute: (k, v) => {
              if (k === 'viewBox') {
                viewBoxWrites++;
                committedVb = v;
              }
            },
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 840 }),
            querySelectorAll: () => [],
          },
          _stageWrap: { style: { transform: '' } },
          hoverTip: { classList: makeCls() },
          grpSettlements: { classList: makeCls(), querySelectorAll: () => [] },
          grpPrefectures: { classList: makeCls(), querySelectorAll: () => [] },
          grpPolities: { classList: makeCls(), querySelectorAll: () => [] },
          grpCorridors: { classList: makeCls(), querySelectorAll: () => [] },
          grpMilestones: { classList: makeCls(), querySelectorAll: () => [] },
          grpRivers: { classList: makeCls(), querySelectorAll: () => [] },
          grpProvNames: { classList: makeCls(), querySelectorAll: () => [] },
          grpNeighbors: { classList: makeCls(), querySelectorAll: () => [] },
          grpJourney: { querySelectorAll: () => [] },
          _id: () => null,
          _camRaf: null,
          _cameraSettleTimer: null,
          _cameraViewportRect: null,
          _lastCameraViewBox: null,
          _baseViewBoxCam: null,
          _hoveredPrefEl: hoveredMockPref,
          _hoverRaf: null,
          _pendingHoverEvent: null,
          _typoDirty: true,
          _lastTypographyWidth: undefined,
        });
        panCtrl._applyCamera(true);
        assert(viewBoxWrites === 1 && panCtrl._stageWrap.style.transform === '', 'Initial _applyCamera(true) must commit baseline viewBox directly');
        panCtrl.dragState = { rect: { left: 0, top: 0, width: 1200, height: 840 } };
        for (let step = 1; step <= 5; step++) {
          panCtrl.camera.x = 100 + step * 3;
          panCtrl.camera.y = 80 + step * 2;
          panCtrl._applyCamera(false);
        }
        assert(
          viewBoxWrites === 6 &&
            committedVb === '115.0 90.0 600.0 420.0' &&
            panCtrl._stageWrap.style.transform === '' &&
            panCtrl.svg.classList.contains('is-camera-moving') &&
            panCtrl._cameraSettleTimer !== null &&
            !hoveredMockPref.classList.contains('is-hovered'),
          `Expected pure pan frames to update exact viewBox without CSS translate3d while adding is-camera-moving and clearing hovered prefecture (writes=${viewBoxWrites}, vb="${committedVb}", transform="${panCtrl._stageWrap.style.transform}")`
        );
        clearTimeout(panCtrl._cameraSettleTimer);
        panCtrl.dragState = null;
        panCtrl._finishCameraMotion();
        assert(
          !panCtrl.svg.classList.contains('is-camera-moving'),
          'Expected _finishCameraMotion to remove is-camera-moving after pan settles'
        );

        // 44b. Lazy secondary prefecture deferral when hidden + DOM reuse across intra-dynasty phases when visible
        let prefPathCreates = 0;
        const makeEl = (tag) => {
          const el = {
            tagName: tag,
            attrs: {},
            dataset: {},
            style: {},
            children: [],
            parentNode: null,
            classList: makeCls(),
            textContent: '',
            get firstChild() {
              return this.children[0] || null;
            },
            setAttribute(k, v) {
              this.attrs[k] = String(v);
              if (k === 'class') {
                const parts = String(v).split(/\s+/).filter(Boolean);
                parts.forEach((c) => this.classList.add(c));
                if (parts.includes('prefecture-shape')) prefPathCreates++;
              }
            },
            getAttribute(k) {
              return this.attrs[k];
            },
            appendChild(ch) {
              if (ch.parentNode && Array.isArray(ch.parentNode.children)) {
                const idx = ch.parentNode.children.indexOf(ch);
                if (idx >= 0) ch.parentNode.children.splice(idx, 1);
              }
              ch.parentNode = this;
              this.children.push(ch);
              return ch;
            },
            querySelectorAll(sel) {
              const out = [];
              const want = sel.replace(/^\./, '');
              const walk = (n) => {
                for (const c of n.children || []) {
                  if (c.classList && c.classList.contains(want)) out.push(c);
                  walk(c);
                }
              };
              walk(this);
              return out;
            },
          };
          Object.defineProperty(el, 'innerHTML', {
            get: () => '',
            set: () => {
              for (const c of el.children) c.parentNode = null;
              el.children = [];
            },
          });
          return el;
        };
        const grpPol = makeEl('g');
        const grpPref = makeEl('g');
        grpPref.classList.add('is-hidden');
        const lazyCtrl = Object.assign(Object.create(proto), {
          locale: 'zh',
          enLocale: { terms: {}, dynasties: {} },
          projector: testProj,
          grpPolities: grpPol,
          grpPrefectures: grpPref,
          _svgNode(tag, attrs, parent) {
            const n = makeEl(tag);
            for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
            if (parent) parent.appendChild(n);
            return n;
          },
          _setPolityFocus: () => {},
          _renderLegendBox: () => {},
          _syncTracedPrefecture: () => {},
          _rescaleSvgTypography: () => {},
        });
        const tangDyn = dynasties.find((d) => d.key === 'tang') || dynasties[0];
        const tangPhases = (tangDyn.phases || []).map((ph) => snapshots[ph.snap]).filter(Boolean);
        const tangSnap0 = tangPhases[0] || snapshots[tangDyn.snapshot] || snapshots[snapKeys[0]];
        const tangSnap1 =
          tangPhases.find((s) => s !== tangSnap0 && s.prefectures === tangSnap0.prefectures) || tangSnap0;
        lazyCtrl._renderPolitiesAndPrefectures(tangDyn, tangSnap0);
        assert(
          grpPref.children.length === 0 && lazyCtrl._deferredPrefectureSnap === tangSnap0 && prefPathCreates === 0,
          'Hidden #grp-prefectures must defer prefecture SVG DOM creation during _renderPolitiesAndPrefectures'
        );
        grpPref.classList.remove('is-hidden');
        const expectedPrefCount = (tangSnap0.prefectures || []).length;
        assert(
          lazyCtrl._materializeDeferredPrefectures() === true &&
            lazyCtrl._deferredPrefectureSnap === null &&
            grpPref.querySelectorAll('.prefecture-boundary-mesh').length === 1 &&
            grpPref.querySelectorAll('.prefecture-shape').length === expectedPrefCount &&
            prefPathCreates === expectedPrefCount,
          '_materializeDeferredPrefectures must materialize 1 deduplicated .prefecture-boundary-mesh plus all prefecture hit-target paths on demand when layer becomes visible'
        );
        const prevShapesGroup = lazyCtrl._prefShapesGroup;
        lazyCtrl._renderPolitiesAndPrefectures(tangDyn, tangSnap1);
        assert(
          lazyCtrl._prefShapesGroup === prevShapesGroup &&
            prefPathCreates === expectedPrefCount &&
            grpPref.querySelectorAll('.prefecture-boundary-mesh').length === 1 &&
            grpPref.querySelectorAll('.prefecture-shape').length === expectedPrefCount,
          `Scrubbing between intra-dynasty phases sharing snap.prefectures must reuse .prefecture-boundary-mesh + .prefecture-shape DOM without recreating ${expectedPrefCount} SVG paths (got prefPathCreates=${prefPathCreates})`
        );

        // 44c. Solution 1 (Issue #196): single smoothed boundary mesh deduplication, idle fill:none/stroke:none hit targets, toggleTerrainMode hides #grp-rivers, and viewportFrame camera-motion class
        const meshEls = grpPref.querySelectorAll('.prefecture-boundary-mesh');
        const meshD = meshEls[0].getAttribute('d') || '';
        const rawCombinedCmds = (tangSnap0.prefectures || []).reduce((acc, p) => {
          const pd = testProj.shapeToSvgPath(p.shape);
          const m = pd.match(/[LQ]/g);
          return acc + (m ? m.length : 0);
        }, 0);
        const meshCmds = (meshD.match(/[LQ]/g) || []).length;
        assert(
          meshCmds > 0 && meshCmds < rawCombinedCmds,
          `Deduplicated .prefecture-boundary-mesh must shrink prefecture stroke commands without gaps (got meshCmds=${meshCmds} vs rawCombinedCmds=${rawCombinedCmds})`
        );
        assert(
          lazyCtrl._buildPrefectureBoundaryPath(tangSnap0.prefectures) === meshD,
          '_buildPrefectureBoundaryPath must return cached WeakMap string identically on repeat calls'
        );

        const idlePrefRule = cssSrc.match(/(?:^|\n)\.prefecture-shape\s*\{([^}]+)\}/);
        assert(
          idlePrefRule &&
            /fill:\s*none\s*;/.test(idlePrefRule[1]) &&
            /stroke:\s*none\s*;/.test(idlePrefRule[1]) &&
            /pointer-events:\s*fill\s*;/.test(idlePrefRule[1]),
          '.prefecture-shape base CSS must use fill:none, stroke:none, and pointer-events:fill to avoid 300+ GPU fill/stroke draw calls per frame'
        );
        assert(
          !cssSrc.includes('.prefecture-shape:not(:hover):not(.is-hovered)') &&
            cssSrc.includes('#atlas-svg:not(.is-mobile-zoomed-detail) .prefecture-boundary-mesh') &&
            cssSrc.includes('#viewport-frame.is-camera-moving #map-key'),
          'css/style.css must target .prefecture-boundary-mesh on mobile and suspend backdrop-filter under #viewport-frame.is-camera-moving'
        );

        let typoRescales = 0;
        const terrainCtrl = Object.assign(Object.create(proto), {
          terrainMode: true,
          svg: { classList: makeCls() },
          camera: { x: 0, y: 0, w: 500, h: 420, zoom: 2 },
          grpTerrain: { classList: makeCls() },
          grpRivers: { classList: makeCls() },
          grpCorridors: { classList: makeCls() },
          grpSettlements: { classList: makeCls() },
          _typoDirty: false,
          _id: () => null,
          _rescaleSvgTypography() {
            typoRescales++;
          },
        });
        terrainCtrl.svg.classList.add('terrain-active');
        terrainCtrl.toggleTerrainMode(false);
        assert(
          terrainCtrl.grpTerrain.classList.contains('is-hidden') &&
            terrainCtrl.grpRivers.classList.contains('is-hidden') &&
            !terrainCtrl.svg.classList.contains('terrain-active') &&
            typoRescales === 1,
          'toggleTerrainMode(false) must hide both #grp-terrain and #grp-rivers and refresh typography collision boxes'
        );
        terrainCtrl.toggleTerrainMode(true);
        assert(
          !terrainCtrl.grpTerrain.classList.contains('is-hidden') &&
            !terrainCtrl.grpRivers.classList.contains('is-hidden') &&
            terrainCtrl.svg.classList.contains('terrain-active') &&
            typoRescales === 2,
          'toggleTerrainMode(true) must unhide both #grp-terrain and #grp-rivers'
        );

        const vpCls = makeCls();
        panCtrl.viewportFrame = { classList: vpCls };
        panCtrl.dragState = { rect: { left: 0, top: 0, width: 1200, height: 840 } };
        panCtrl.camera.x += 5;
        panCtrl._applyCamera(false);
        assert(
          vpCls.contains('is-camera-moving'),
          '_applyCamera motion frames must add is-camera-moving to #viewport-frame'
        );
        clearTimeout(panCtrl._cameraSettleTimer);
        panCtrl.dragState = null;
        panCtrl._finishCameraMotion();
        assert(
          !vpCls.contains('is-camera-moving'),
          '_finishCameraMotion must remove is-camera-moving from #viewport-frame'
        );

        // 44d. Issue #196 follow-up: modern province boundary topology simplification, regional tiling, terrain fill:none hit targets, and butt/bevel caps
        const grpProv = makeEl('g');
        const grpProvNames = makeEl('g');
        const provCtrl = Object.assign(Object.create(proto), {
          locale: 'zh',
          enLocale: { terms: {}, dynasties: {} },
          projector: testProj,
          provinces,
          grpProvinces: grpProv,
          grpProvNames,
          _svgNode(tag, attrs, parent) {
            const n = makeEl(tag);
            for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
            if (parent) parent.appendChild(n);
            return n;
          },
        });
        provCtrl._buildModernProvinces();
        const pb = provCtrl._buildProvinceBoundaryPaths();
        let rawFillCmds = 0;
        let simpFillCmds = 0;
        const nonDashProvs = provinces.filter((p) => !String(p.code).includes('_JD'));
        for (const p of nonDashProvs) {
          const rawD = testProj.multiRingsToSvgPath(p.rings);
          const simpD = pb.provPaths.get(p) || '';
          assert(
            simpD.startsWith('M') && simpD.endsWith('Z'),
            `Expected topology-simplified polygon path for ${p.title} to be a valid closed SVG path`
          );
          rawFillCmds += (rawD.match(/L/g) || []).length;
          simpFillCmds += (simpD.match(/L/g) || []).length;
        }
        assert(
          pb.provPaths.size === nonDashProvs.length && simpFillCmds < rawFillCmds * 0.5,
          `Expected province polygon RDP simplification to cover all ${nonDashProvs.length} provinces and shrink vertices by >50% (got simpFillCmds=${simpFillCmds} vs rawFillCmds=${rawFillCmds})`
        );
        const boundCmds = (pb.combined.match(/L/g) || []).length;
        const boundMoves = (pb.combined.match(/M/g) || []).length;
        assert(
          boundCmds > 800 && boundCmds < rawFillCmds * 0.35,
          `Expected deduplicated+simplified province boundary commands to shrink >65% vs raw rings (got boundCmds=${boundCmds} vs rawFillCmds=${rawFillCmds})`
        );
        console.log(
          `  [perf #196] modern provinces: fillL ${rawFillCmds} -> ${simpFillCmds} (-${((1 - simpFillCmds / rawFillCmds) * 100).toFixed(1)}%), boundaryL=${boundCmds} (M=${boundMoves}, intBytes=${pb.interior.length}, outBytes=${pb.outer.length}, tiles=${pb.tiles.length})`
        );
        const casingEls = grpProv.querySelectorAll('.province-boundary-casing');
        const intEls = grpProv.querySelectorAll('.province-boundary-interior');
        const outEls = grpProv.querySelectorAll('.province-boundary-outer');
        const dashEls = grpProv.querySelectorAll('.maritime-dash');
        assert(
          casingEls.length >= 4 &&
            intEls.length >= 4 &&
            outEls.length >= 4 &&
            dashEls.length >= 1 &&
            grpProvNames.children.length === nonDashProvs.length,
          `Expected _buildModernProvinces to emit regional tiled boundary paths plus ${nonDashProvs.length} labels (casing=${casingEls.length}, interior=${intEls.length}, outer=${outEls.length}, dash=${dashEls.length})`
        );
        const lastCasingIdx = grpProv.children.indexOf(casingEls[casingEls.length - 1]);
        const firstIntIdx = grpProv.children.indexOf(intEls[0]);
        const lastOutIdx = grpProv.children.indexOf(outEls[outEls.length - 1]);
        const firstDashIdx = grpProv.children.indexOf(dashEls[0]);
        assert(
          lastCasingIdx < firstIntIdx && firstIntIdx < lastOutIdx && lastOutIdx < firstDashIdx,
          'Province z-order must stack casing tiles below interior/outer tiles and maritime-dash on top'
        );
        const terrainProvRule = cssSrc.match(
          /#atlas-svg\.terrain-active\s+\.province-shape:not\(\.maritime-dash\)\s*\{([^}]+)\}/
        );
        assert(
          terrainProvRule &&
            /fill:\s*none\s*;/.test(terrainProvRule[1]) &&
            /pointer-events:\s*fill\s*;/.test(terrainProvRule[1]) &&
            cssSrc.includes('#atlas-svg.is-camera-moving .province-boundary-casing') &&
            cssSrc.includes('stroke-linecap: butt;') &&
            cssSrc.includes('stroke-linejoin: bevel;'),
          'css/style.css must eliminate terrain-mode .province-shape fills, switch boundary caps/joins to butt/bevel, and hide .province-boundary-casing during camera motion'
        );
      }

      // CUJ 45: Issue #205 — Historically accurate Taiwan naming across all 185 snapshots & locales
      {
        const conv = sandbox.window.ZH_HANT_CONV;
        assert.strictEqual(conv.toHant('台湾（荷占）'), '臺灣（荷佔）');
        assert.strictEqual(conv.toHant('臺灣（荷佔）'), '臺灣（荷佔）');
        assert.strictEqual(conv.toHans('臺灣（荷佔）'), '台湾（荷占）');
        assert.strictEqual(conv.toHant('承天府（东宁）'), '承天府（東寧）');
        assert.strictEqual(conv.toHant('瑠求'), '瑠求');

        for (const [sk, snap] of Object.entries(snapshots)) {
          if (!snap || Array.isArray(snap)) continue;
          for (const grp of ['polities', 'regions', 'prefectures']) {
            for (const f of snap[grp] || []) {
              assert(
                f.title !== '台湾原住民' && f.title !== '台湾（日本占领）',
                `Stale anachronistic Taiwan label "${f.title}" found in ${sk}.${grp}`
              );
            }
          }
        }
        for (const bsKey of ['s_zhanguo_a', 's_qin_a']) {
          for (const f of bootSnapshots[bsKey].polities || []) {
            assert(f.title !== '台湾原住民', `atlas_boot.js ${bsKey} still contains 台湾原住民`);
          }
        }

        const earlyMingSet = new Set([
          's_ming_0a', 's_ming_0b', 's_ming_0c', 's_ming_0d',
          's_ming_a0', 's_ming_a', 's_ming_a2', 's_ming_b0',
        ]);
        const lateMingDutchSet = new Set(['s_ming_c0', 's_ming_c', 's_ming_c2']);
        const qingDutchSet = new Set(['s_qing_a00', 's_qing_a0']);
        const qingMingZhengSet = new Set(['s_qing_a0b', 's_qing_a1', 's_qing_a', 's_qing_a2']);
        const qingRuleSet = new Set([
          's_qing_b1', 's_qing_b', 's_qing_c', 's_qing_d',
          's_qing_e', 's_qing_e2', 's_qing_e3', 's_qing_e4',
          's_qing_f0', 's_qing_f',
        ]);
        const jpOccSet = new Set([
          's_qing_g0', 's_qing_g',
          's_roc_a0', 's_roc_w1', 's_roc_w2', 's_roc_w3', 's_roc_w4',
          's_roc_a', 's_roc_b0', 's_roc',
        ]);
        const rocPost45Set = new Set(['s_roc_c', 's_roc_d']);
        const ptInShape = sandbox.window.MercatorProjector.pointInShape;

        for (const [sk, snap] of Object.entries(snapshots)) {
          if (!snap || Array.isArray(snap) || sk === 's_prc') continue;
          for (const [tx, ty] of [[120.21, 23.0], [120.95, 23.75]]) {
            const pHits = (snap.polities || []).filter((p) => ptInShape(tx, ty, p.shape)).map((p) => p.title);
            const rHits = (snap.regions || []).filter((r) => ptInShape(tx, ty, r.shape)).map((r) => r.title);
            const fHits = (snap.prefectures || []).filter((f) => ptInShape(tx, ty, f.shape)).map((f) => f.title);
            assert.strictEqual(pHits.length, 1, `${sk} at [${tx},${ty}] must match exactly 1 polity, got [${pHits.join(',')}]`);

            let expPol = null;
            let expReg = [];
            let expPref = [];
            if (/^s_(zhanguo|qin|xihan|donghan)(_|$)/.test(sk)) expPol = '岛夷诸部';
            else if (/^s_(sanguo|xijin|dongjin|nanbei)(_|$)/.test(sk)) expPol = '夷洲';
            else if (/^s_(sui|tang|wudai|beisong|nansong)(_|$)/.test(sk)) expPol = '流求';
            else if (/^s_yuan(_|$)/.test(sk)) expPol = '瑠求';
            else if (earlyMingSet.has(sk)) expPol = '小琉球';
            else if (sk === 's_ming_b') expPol = '东番';
            else if (lateMingDutchSet.has(sk) || qingDutchSet.has(sk)) expPol = '台湾（荷占）';
            else if (qingMingZhengSet.has(sk)) {
              expPol = '南明（明郑）';
              expPref = ['承天府（东宁）'];
            } else if (qingRuleSet.has(sk)) {
              expPol = '清';
              expReg = ['台湾'];
              expPref = ['台湾府'];
            } else if (jpOccSet.has(sk)) {
              expPol = '台湾（日占）';
            } else if (rocPost45Set.has(sk)) {
              expPol = '中华民国';
              expReg = ['台湾'];
            }
            assert.strictEqual(pHits[0], expPol, `${sk} Taiwan polity expected "${expPol}", got "${pHits[0]}"`);
            assert.deepStrictEqual(Array.from(rHits), expReg, `${sk} Taiwan regions expected ${JSON.stringify(expReg)}, got ${JSON.stringify(rHits)}`);
            assert.deepStrictEqual(Array.from(fHits), expPref, `${sk} Taiwan prefectures expected ${JSON.stringify(expPref)}, got ${JSON.stringify(fHits)}`);
          }
        }

        const dutchPol1630 = ctrl._resolvePolity('台湾（荷占）', 1630);
        const dutchPol1650 = ctrl._resolvePolity('台湾（荷占）', 1650);
        const mzPol1670 = ctrl._resolvePolity('南明（明郑）', 1670);
        assert(
          dutchPol1630 && dutchPol1630.key === 'taiwan_dutch' &&
          dutchPol1650 && dutchPol1650.key === 'taiwan_dutch' &&
          mzPol1670 && mzPol1670.key === 'mingzheng',
          'Expected polity encyclopedia profiles to resolve 台湾（荷占） (1630/1650) and 南明（明郑） (1670)'
        );

        ctrl._searchIndex = null;
        for (const q of ['夷洲', '流求', '瑠求', '小琉球', '东番', '东宁', '赤嵌', 'tayouan']) {
          if (!['tayouan'].includes(q)) {
            const rp = ctrl.resolvePlace(q, 1650);
            assert(
              rp && Math.abs(rp.lng - 120.21) < 0.2 && Math.abs(rp.lat - 23.0) < 0.2,
              `resolvePlace("${q}") failed: ${JSON.stringify(rp)}`
            );
          }
          const sh = ctrl._queryQuickSearch(q);
          assert(sh.length > 0, `_queryQuickSearch("${q}") returned empty`);
        }

        const twEraSamples = [
          [-300, '岛夷诸部', null, 'Island Yi Tribes', '島夷諸部'],
          [100, '岛夷诸部', null, 'Island Yi Tribes', '島夷諸部'],
          [230, '夷洲', null, 'Yizhou', '夷洲'],
          [700, '流求', null, 'Liuqiu', '流求'],
          [1300, '瑠求', null, 'Liuqiu', '瑠求'],
          [1410, '小琉球', null, 'Xiaoliuqiu', '小琉球'],
          [1603, '东番', null, 'Dongfan', '東番'],
          [1630, '台湾（荷占）', null, 'Taiwan (Dutch-ruled)', '臺灣（荷佔）'],
          [1650, '台湾（荷占）', null, 'Taiwan (Dutch-ruled)', '臺灣（荷佔）'],
          [1670, '南明（明郑）', '承天府（东宁）(府)', 'Southern Ming (Koxinga / Tungning)', '南明（明鄭）'],
          [1750, '清', '台湾府', 'Qing', '清'],
          [1900, '台湾（日占）', null, 'Taiwan (Japanese-occupied)', '臺灣（日佔）'],
          [1920, '台湾（日占）', null, 'Taiwan (Japanese-occupied)', '臺灣（日佔）'],
          [1947, '中华民国', null, 'Republic of China', '中華民國'],
          [2026, '中华人民共和国', '台南', "People's Republic of China", '中華人民共和國'],
        ];
        const savedLoc = ctrl.locale;
        for (const [yr, zhPol, zhPref, enPol, twPol] of twEraSamples) {
          ctrl.locale = 'zh';
          const izh = ctrl.inspect({ year: yr, lng: 120.21, lat: 23.0 });
          assert.strictEqual(izh.polity, zhPol, `inspect(${yr}, zh) polity expected "${zhPol}", got "${izh.polity}"`);
          if (zhPref) {
            assert(izh.prefectures.includes(zhPref), `inspect(${yr}, zh) expected prefecture "${zhPref}", got ${JSON.stringify(izh.prefectures)}`);
          } else {
            assert.strictEqual(izh.prefectures.length, 0, `inspect(${yr}, zh) expected 0 prefectures, got ${JSON.stringify(izh.prefectures)}`);
          }
          ctrl.locale = 'en';
          const ien = ctrl.inspect({ year: yr, lng: 120.21, lat: 23.0 });
          assert.strictEqual(ien.polity, enPol, `inspect(${yr}, en) polity expected "${enPol}", got "${ien.polity}"`);
          assert(!/[\u4e00-\u9fff]/.test(JSON.stringify(ien)), `CJK leak in inspect(${yr}, en): ${JSON.stringify(ien)}`);
          ctrl.locale = 'zh-tw';
          const itw = ctrl.inspect({ year: yr, lng: 120.21, lat: 23.0 });
          assert.strictEqual(itw.polity, twPol, `inspect(${yr}, zh-tw) polity expected "${twPol}", got "${itw.polity}"`);
        }
        ctrl.locale = savedLoc;
      }
    }

  // Verify 1901 Boxer Protocol milestone, Gengshi/Liu Xiu dissolved seams, and Five Dynasties Jiaozhou/Liaoxi/Hetao fixes
  {
    const qingDyn = dynasties.find((d) => d.key === 'qing');
    const m1901 = qingDyn && qingDyn.milestones.find((m) => m.year === 1901);
    assert(m1901 && m1901.headline.includes('辛丑条约'), 'qing:1901 Boxer Protocol milestone must exist');
    const rocDyn = dynasties.find((d) => d.key === 'roc');
    const m1912 = rocDyn && rocDyn.milestones.find((m) => m.year === 1912);
    assert(m1912 && m1912.headline.includes('清帝溥仪退位'), 'roc:1912 milestone must include Qing abdication');

    const gs23 = snapshots.s_xihan_e.polities.find((p) => p.title === '更始（汉）');
    const lx23 = snapshots.s_xihan_e.polities.find((p) => p.title === '刘秀（河北）');
    assert(gs23.shape.coordinates.length <= 6, 's_xihan_e 更始（汉） must keep its mainland dissolved (no extra seam pieces)');
    assert.strictEqual(lx23.shape.type, 'Polygon', 's_xihan_e 刘秀（河北） must be a single dissolved Polygon');

    for (const sid of ['s_tang_d2', 's_wudai_a', 's_wudai_b1', 's_wudai_b', 's_wudai_b2', 's_wudai_c0']) {
      assert(
        snapshots[sid].polities.some((p) => p.title === '静海军（交州）'),
        `${sid} must include 静海军（交州）`
      );
    }
    for (const sid of ['s_wudai_c', 's_wudai_c2', 's_wudai_d', 's_wudai_e', 's_wudai_e1', 's_wudai_e2']) {
      assert(
        snapshots[sid].polities.some((p) => p.title === '安南'),
        `${sid} must include 安南`
      );
    }
    const chuA = snapshots.s_wudai_a.polities.find((p) => p.title === '楚 · 荆南');
    assert.strictEqual(chuA.shape.type, 'Polygon', 's_wudai_a 楚 · 荆南 must be a single dissolved Polygon');

    for (const [sid, title, maxPieces] of [
      ['s_yuan_b', '元', 3],
      ['s_yuan_b', '天完 · 陈友谅', 1],
      ['s_yuan_c', '元', 4],
      ['s_yuan_c', '吴（朱元璋）', 1],
      ['s_ming_0a', '北元', 1],
      ['s_ming_0a', '明', 4],
      ['s_ming_0b', '明', 4],
      ['s_sui_d', '魏（李密）', 1],
      ['s_tang_0', '梁（萧铣）', 2],
      ['s_tang_0', '吴（杜伏威）', 2],
      ['s_tang_d1', '大齐（黄巢）', 2],
    ]) {
      const pol = snapshots[sid].polities.find((p) => p.title === title);
      assert(pol && pol.shape, `${sid} ${title} must exist`);
      const pieces = pol.shape.type === 'MultiPolygon' ? pol.shape.coordinates.length : 1;
      assert(pieces <= maxPieces, `${sid} ${title} must be dissolved to <= ${maxPieces} pieces (got ${pieces})`);
    }
    assert.strictEqual(ctrl._resolveSnapKey(qinDyn, -210), 's_qin', 'Qin at -210 BCE must resolve to s_qin');
    assert.strictEqual(ctrl._resolveSnapKey(qinDyn, -209), 's_qin_c', 'Qin at -209 BCE must resolve to s_qin_c');
    assert.strictEqual(ctrl._resolveSnapKey(qinDyn, -207), 's_qin_d', 'Qin at -207 BCE must resolve to s_qin_d');
    assert.strictEqual(ctrl._resolveSnapKey(qinDyn, -206), 's_qin_chuhan', 'Qin at -206 BCE must resolve to s_qin_chuhan');
    assert(
      snapshots.s_qin_c.polities.some((p) => p.title === '秦') &&
        snapshots.s_qin_c.polities.some((p) => p.title === '楚（张楚 · 怀王）') &&
        !snapshots.s_qin_c.polities.some((p) => p.title === '南越（赵佗）'),
      's_qin_c (-209..-208 BCE) must show Qin (holding Lingnan) and restored Chu/Six Kingdoms before Zhao Tuo secedes'
    );
    assert(
      snapshots.s_qin_d.polities.some((p) => p.title === '秦') &&
        snapshots.s_qin_d.polities.some((p) => p.title === '楚（怀王 · 项羽）') &&
        snapshots.s_qin_d.polities.some((p) => p.title === '南越（赵佗）'),
      's_qin_d (-207 BCE) must show Qin, Chu (King Huai & Xiang Yu), and Zhao Tuo Nanyue in Lingnan'
    );

    // Southern Dynasties, Ten Kingdoms, Late Tang & Western Han curated milestone/landmark split
    for (const [dk, yr, kw] of [
      ['nanbei', 551, '陈霸先'],
      ['nanbei', 578, '吕梁之战'],
      ['tang', 783, '泾原兵变'],
      ['wudai', 910, '钱镠'],
      ['wudai', 927, '马殷'],
    ]) {
      const d = dynasties.find((x) => x.key === dk);
      const m = d && d.milestones.find((x) => x.year === yr);
      assert(m && m.headline.includes(kw), `Expected timeline milestone ${dk}:${yr} containing "${kw}"`);
      assert.strictEqual(ctrl._getMilestoneAnchors(d, m).length, 2, `Expected 2 spatial anchors on ${dk}:${yr}`);
    }
    const xihanDyn = dynasties.find((x) => x.key === 'xihan');
    const changanXihanEvs = ctrl._collectPlaceEventsForDynasty(xihanDyn, 108.941, 34.341, null);
    assert(
      changanXihanEvs.some((e) => e.year === -81 && e.text.includes('苏武')) &&
        changanXihanEvs.some((e) => e.year === -81 && e.text.includes('盐铁会议')) &&
        changanXihanEvs.some((e) => e.year === -2 && e.text.includes('浮屠经')),
      'Western Han Chang\'an place events must preserve both 81 BCE landmarks (Su Wu & Salt-and-Iron Debate) and 2 BCE Buddhist transmission'
    );

    // Issue #222: Zero-widening compact timeline band fallback (_fitBandLabels)
    const makeBandCell = (clientWidth, regularWidth, compactWidth) => {
      const classes = new Set();
      const clsList = {
        add: (...names) => names.forEach((n) => classes.add(n)),
        remove: (...names) => names.forEach((n) => classes.delete(n)),
        toggle: (n, force) => (force === undefined ? (classes.has(n) ? classes.delete(n) : classes.add(n)) : force ? classes.add(n) : classes.delete(n)),
        contains: (n) => classes.has(n),
      };
      const lbl = {
        get scrollWidth() {
          return classes.has('is-compact') ? compactWidth : regularWidth;
        },
      };
      return {
        clientWidth,
        scrollWidth: regularWidth,
        classList: clsList,
        querySelector: (sel) => (sel === '.band-label' ? lbl : null),
      };
    };
    const cell1440 = makeBandCell(27, 25, 21); // 1440px laptop: fits at full 12px
    const cell1280 = makeBandCell(23, 25, 21); // 1280px laptop: fits via .is-compact
    const cellMob = makeBandCell(9, 25, 21);   // 390px mobile: cleanly hides via .is-narrow
    const prevIdFn = ctrl._id;
    ctrl._id = (id) => {
      if (id === 'dynasty-bands') return { children: [cell1440, cell1280, cellMob] };
      if (id === 'scrubber-ticks') return { children: [] };
      return null;
    };
    ctrl._fitBandLabels();
    ctrl._id = prevIdFn;
    assert(
      !cell1440.classList.contains('is-compact') && !cell1440.classList.contains('is-narrow'),
      '1440px short dynasty cell (27px vs 25px text) must render at full 12px without hiding'
    );
    assert(
      cell1280.classList.contains('is-compact') && !cell1280.classList.contains('is-narrow'),
      '1280px short dynasty cell (23px) must step into .is-compact (21px) without hiding'
    );
    assert(
      !cellMob.classList.contains('is-compact') && cellMob.classList.contains('is-narrow'),
      'Mobile ultra-narrow dynasty cell (9px) must hide cleanly via .is-narrow'
    );

    // 6-era boundary & gap regression checks (195 Donghan, 322 Dongjin, 676 Tang, 1410 Ming, 1650 Qing, 1918 ROC)
    const ptIn = sandbox.window.MercatorProjector.pointInShape;
    const dz195 = snapshots.s_donghan_d1.polities.find((p) => p.title === '董卓(长安)');
    const mt195 = snapshots.s_donghan_d1.polities.find((p) => p.title === '马腾(凉州)');
    assert(
      !ptIn(106.5, 38.0, dz195.shape) && ptIn(106.5, 38.0, mt195.shape),
      's_donghan_d1 (195 CE): Northern Ningxia [106.5, 38.0] must belong to 马腾(凉州), not a Dong Zhuo horn'
    );
    for (const [sk, mainTitle] of [['s_tang_a', '唐'], ['s_tang_wz1', '武周']]) {
      const mPol = snapshots[sk].polities.find((p) => p.title === mainTitle);
      assert(ptIn(120.5, 41.2, mPol.shape), `${sk}: Yingzhou / Liaoxi Corridor [120.5, 41.2] must be inside ${mainTitle}`);
    }
    for (const [sk, fengTitle] of [
      ['s_roc_w1', '奉系（张作霖）'],
      ['s_roc_w2', '奉系（张作霖）'],
      ['s_roc_w3', '北洋政府 · 奉系（张作霖）'],
      ['s_roc_w4', '安国军政府 · 奉系（张作霖）'],
    ]) {
      const fPol = snapshots[sk].polities.find((p) => p.title === fengTitle);
      assert(
        fPol && ptIn(120.0, 49.2, fPol.shape) && ptIn(121.5, 46.0, fPol.shape),
        `${sk}: Hulunbuir [120.0, 49.2] and Hinggan [121.5, 46.0] must be covered by ${fengTitle} (no hollow gap)`
      );
    }

    // Dynasty transition & usurpation causality chain checks
    for (const [dk, yr, kw, expAnchors] of [
      ['zhanguo', -272, '义渠', 2],
      ['qin', -221, '王贲受齐王建降', 1],
      ['xihan', 6, '假皇帝', 1],
      ['donghan', 216, '魏王', 2],
      ['dongjin', 350, '石虎', 1],
      ['dongjin', 414, '南凉', 2],
      ['nanbei', 474, '新亭', 2],
      ['nanbei', 479, '萧道成', 1],
      ['nanbei', 500, '东昏侯', 2],
      ['nanbei', 502, '萧衍', 1],
      ['nanbei', 528, '尔朱荣', 1],
      ['nanbei', 530, '孝庄帝', 2],
      ['nanbei', 532, '韩陵之战', 2],
      ['nanbei', 534, '宇文泰', 3],
      ['nanbei', 550, '八柱国', 2],
      ['nanbei', 557, '王僧辩', 2],
      ['tang', 684, '徐敬业', 2],
      ['tang', 904, '朱温劫唐昭宗', 2],
      ['wudai', 923, '魏州', 1],
      ['wudai', 942, '称孙不称臣', 1],
      ['wudai', 947, '石重贵', 2],
      ['wudai', 951, '后汉隐帝', 3],
      ['nansong', 1141, '岳武穆', 1],
      ['nansong', 1271, '阿里不哥', 1],
      ['nansong', 1279, '陆秀夫', 1],
    ]) {
      const d = dynasties.find((x) => x.key === dk);
      const m = d && d.milestones.find((x) => x.year === yr);
      assert(m && m.headline.includes(kw), `Expected transition milestone ${dk}:${yr} containing "${kw}"`);
      assert.strictEqual(ctrl._getMilestoneAnchors(d, m).length, expAnchors, `Expected ${expAnchors} anchors on ${dk}:${yr}`);
    }

    // Issue #299 regression check: #milestone-list hover style must be distinct from .is-current,
    // and clicking a visible milestone item must not force-scroll #chronicle-pane to 42% height.
    {
      const cssSrc = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
      assert(
        !cssSrc.includes('#milestone-list li:hover,\n#milestone-list li.is-current'),
        'css/style.css must not share identical styles between #milestone-list li:hover and #milestone-list li.is-current (#299)'
      );
      assert(
        cssSrc.includes('#milestone-list li:not(.polity-empty):not(.is-current):hover') &&
          cssSrc.includes('box-shadow: inset 3px 0 0 var(--vermilion)'),
        'css/style.css must differentiate #milestone-list li hover from .is-current (#299)'
      );
      const appSrc = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
      assert(
        appSrc.includes('this._suppressChronicleAutoScroll = true') &&
          appSrc.includes('const suppressCenterScroll = Boolean(this._suppressChronicleAutoScroll)'),
        'js/app.js must suppress forced center-scrolling when clicking a visible item in #milestone-list (#299)'
      );
    }

    // Discussion #297 regression check: Event Storyline Mod (点事溯局 · ?event=anshi)
    {
      const anshiProf = ctrl._resolvePersonProfile('anshi');
      assert(
        anshiProf && anshiProf.isStory === true && Array.isArray(anshiProf.stops) && anshiProf.stops.length === 10,
        'anshi must resolve as an Event Storyline (isStory: true) with 10 chronological stops (#297)'
      );
      assert.strictEqual(
        ctrl._resolvePersonProfile('安史之乱')?.key,
        'anshi',
        '_resolvePersonProfile("安史之乱") must resolve to the anshi storyline profile'
      );
      for (const sq of ['安史之乱', '安史', 'An Lushan Rebellion', 'anshizhiluan']) {
        const sqHits = ctrl._queryQuickSearch(sq);
        assert(
          sqHits.length > 0 && sqHits[0].kind === 'story' && sqHits[0].storyKey === 'anshi',
          `Quick search for "${sq}" must surface the An-Shi storyline (kind="story") at index 0`
        );
      }
      const anshiEvs = ctrl._collectPersonEvents(anshiProf);
      assert.strictEqual(anshiEvs.length, 10, 'anshi storyline must collect all 10 stops');
      assert(
        Array.isArray(anshiProf.camps) &&
          anshiProf.camps.length === 2 &&
          anshiEvs.filter((e) => Boolean(e.actZh)).length === 3,
        'anshi storyline must define 2 opposing camps and 3 act section dividers'
      );
      assert(
        anshiEvs[6].siteZh === '睢阳' && !anshiEvs[6].fromCoord && Array.isArray(anshiEvs[7].fromCoord),
        'Stop 7 (Suiyang siege) must be stationary while Stop 8 (Lingwu -> Chang’an) has fromCoord (#297)'
      );
      assert(
        Array.isArray(anshiEvs[2].prongs) &&
          anshiEvs[2].fromStopIdx === 1 &&
          Array.isArray(anshiEvs[7].prongs) &&
          anshiEvs[7].fromStopIdx === 5 &&
          Array.isArray(anshiEvs[8].prongs) &&
          anshiEvs[8].fromStopIdx === -1,
        'Two-camp battle stops (Tongguan, Chang’an, Yecheng) must distinguish explicit predecessor stops from unnumbered camp beads'
      );
      const tangDyn = dynasties.find((d) => d.key === 'tang');
      const m755 = tangDyn.milestones.find((m) => m.year === 755);
      const m756 = tangDyn.milestones.find((m) => m.year === 756);
      const st755 = ctrl._findStoryForMilestone(tangDyn, m755);
      assert(
        st755 && st755.key === 'anshi' && st755.stopIdx === -1,
        'Only the 755 outbreak milestone should expose the canonical [始末] storyline entry (#297)'
      );
      assert.strictEqual(
        ctrl._findStoryForMilestone(tangDyn, m756),
        null,
        'Subsequent An-Shi milestones (e.g., 756) must not repeat the [始末] badge (#297)'
      );
      ctrl.openPersonChronicle('anshi', 2);
      const stParams = ctrl._urlStateParams();
      assert.strictEqual(stParams.get('event'), 'anshi', 'Storyline deep-link must use ?event=anshi (#297)');
      assert.strictEqual(stParams.get('stop'), '2', 'Storyline active stop must serialize 0-based ?stop=2 (#297)');
      assert.strictEqual(stParams.has('person'), false, 'Storyline deep-link must not emit ?person=anshi (#297)');
      ctrl.closeGenealogyCard();

      const jingkangProf = ctrl._resolvePersonProfile('jingkang');
      assert(
        jingkangProf && jingkangProf.isStory === true && Array.isArray(jingkangProf.stops) && jingkangProf.stops.length === 10,
        'jingkang must resolve as an Event Storyline (isStory: true) with 10 chronological stops'
      );
      for (const sq of ['靖康之变', '靖康', '建炎南渡', 'jingkang', 'jingkangzhibian']) {
        const sqHits = ctrl._queryQuickSearch(sq);
        assert(
          sqHits.length > 0 && sqHits[0].kind === 'story' && sqHits[0].storyKey === 'jingkang',
          `Quick search for "${sq}" must surface the Jingkang storyline (kind="story") at index 0`
        );
      }
      const beisongDyn = dynasties.find((d) => d.key === 'beisong');
      const nansongDyn = dynasties.find((d) => d.key === 'nansong');
      const mBs1127 = beisongDyn.milestones.find((m) => m.year === 1127);
      const mNs1127 = nansongDyn.milestones.find((m) => m.year === 1127);
      assert(
        ctrl._findStoryForMilestone(beisongDyn, mBs1127)?.key === 'jingkang' &&
          ctrl._findStoryForMilestone(nansongDyn, mNs1127) === null,
        'Only the single canonical Northern Song 1127 (靖康之变) milestone must expose the [始末] storyline entry'
      );

      // Universal Event Storyline (`isStory: true`) invariants:
      // 1) Must declare `dynastyKey` and a 2-char Chinese stem alias searchable as `kind: "story"`.
      // 2) Must map to EXACTLY ONE `[始末]` milestone across all dynasties in `_findStoryForMilestone`.
      const allStoryProfiles = (loreData.PERSON_PROFILES || []).filter((p) => p && p.isStory);
      assert(allStoryProfiles.length >= 2, 'Expected at least 2 Event Storylines (anshi, jingkang)');
      for (const sp of allStoryProfiles) {
        assert(
          typeof sp.dynastyKey === 'string' && dynasties.some((d) => d.key === sp.dynastyKey),
          `Storyline "${sp.key}" must specify a valid dynastyKey in PERSON_PROFILES`
        );
        const twoCharStem = (sp.aliases || []).find((a) => /^[\u4e00-\u9fa5]{2}$/.test(a));
        assert(
          twoCharStem,
          `Storyline "${sp.key}" (${sp.zh}) must include a 2-character Chinese stem alias in PERSON_PROFILES.aliases`
        );
        const stemHits = ctrl._queryQuickSearch(twoCharStem);
        assert(
          stemHits.length > 0 && stemHits[0].kind === 'story' && stemHits[0].storyKey === sp.key,
          `2-char stem alias "${twoCharStem}" must rank storyline "${sp.key}" (kind="story") first in quick search`
        );
        let badgeCount = 0;
        for (const d of dynasties) {
          for (const m of d.milestones || []) {
            if (ctrl._findStoryForMilestone(d, m)?.key === sp.key) badgeCount++;
          }
        }
        assert.strictEqual(
          badgeCount,
          1,
          `Storyline "${sp.key}" (${sp.zh}) must have EXACTLY 1 [始末] milestone badge in _findStoryForMilestone (found ${badgeCount})`
        );
      }

      ctrl.openPersonChronicle('sushi', 5);
      const sushiEvs = ctrl.activePerson.events;
      assert.strictEqual(
        ctrl._getSoloStepOriginCoord(ctrl.activePerson, sushiEvs, 1, sushiEvs[1]),
        null,
        'Co-located consecutive stops (Meizhou #1 -> Meizhou #2) must not draw a redundant movement vector'
      );
      const mizhouOrigin = ctrl._getSoloStepOriginCoord(ctrl.activePerson, sushiEvs, 5, sushiEvs[5]);
      assert(
        Array.isArray(mizhouOrigin) && mizhouOrigin[0] === sushiEvs[4].coord[0] && mizhouOrigin[1] === sushiEvs[4].coord[1],
        'Solo person step 6 (Mizhou) must resolve step 5 (Hangzhou) as its single-step movement origin'
      );
      ctrl.closeGenealogyCard();

      ctrl.openPersonChronicle(['libai', 'dufu', 'gaoshi'], 9);
      const ldgEvs = ctrl.activePerson.events;
      const luoyangLegs = ctrl._getMultiStepLegs(ctrl.activePerson, 9, ldgEvs[9]);
      assert.strictEqual(
        luoyangLegs.length,
        2,
        '744 Luoyang shared encounter (Li Bai x Du Fu) must resolve 2 converging single-step legs'
      );
      assert(
        luoyangLegs[0].originIdx >= 0 &&
          !ldgEvs[luoyangLegs[0].originIdx].isSharedEncounter &&
          ldgEvs[luoyangLegs[0].originIdx].personKey === 'libai',
        'Li Bai leg into 744 Luoyang must anchor to his solo 742 Chang’an pin rather than the later 752 Du Fu x Gao Shi shared pin'
      );
      const suiyangLegs = ctrl._getMultiStepLegs(ctrl.activePerson, 10, ldgEvs[10]);
      assert.strictEqual(
        suiyangLegs.length,
        3,
        '744 Suiyang 3-way encounter (Li Bai x Du Fu x Gao Shi) must resolve 3 converging legs'
      );
      assert(
        suiyangLegs[0].bias < 0 && suiyangLegs[1].bias > 0 && suiyangLegs[2].bias === 0,
        'Co-origin legs (Li Bai & Du Fu from Luoyang -> Suiyang) must have opposite curve bias while Gao Shi (from Jizhou) has 0 bias'
      );
      assert.strictEqual(
        ctrl._getNavigablePersonEventIdxs().length,
        ldgEvs.length,
        'By default _getNavigablePersonEventIdxs must include all multi-person events'
      );
      ctrl.personSharedOnly = true;
      assert.strictEqual(
        ctrl._getNavigablePersonEventIdxs().length,
        ctrl.activePerson.sameTimeCount,
        'When personSharedOnly is active, _getNavigablePersonEventIdxs must step strictly across shared encounters'
      );
      ctrl.closeGenealogyCard();
    }
  }

  {
    // js/atlas_track.js: anonymous click & feature counter. It is run here against a fake
    // controller in the real load order: the deferred script executes first, then app.js's
    // window listener (registered earlier, while parsing) creates the controller.
    const trackSrc = fs.readFileSync(path.join(JS_DIR, 'atlas_track.js'), 'utf8');
    assert(
      /<script defer src="js\/atlas_track\.js\?v=/.test(indexHtml),
      'atlas_track.js must load with defer so it stays out of the first-paint budget'
    );

    const bootTracker = ({ hostname = 'deanchen.me', search = '', doNotTrack = null } = {}) => {
      const listeners = { window: {}, document: {} };
      const on = (bag) => (type, fn) => (bag[type] = bag[type] || []).push(fn);
      const fire = (bag, type, ev) => (bag[type] || []).forEach((fn) => fn(ev));
      const timers = [];
      const beacons = [];
      class FakeApp {
        constructor() {
          this.locale = 'en';
          this.activeTrace = null;
          this.activePerson = null;
        }
        openGenealogyAt(lng, lat) {
          this.activeTrace = [lng, lat];
        }
        openPersonChronicle(profiles) {
          this.activePerson = { profiles };
          return true;
        }
      }
      const win = { innerWidth: 1280, addEventListener: on(listeners.window) };
      const box = {
        window: win,
        document: { readyState: 'interactive', visibilityState: 'visible', addEventListener: on(listeners.document) },
        location: { hostname, search },
        navigator: {
          doNotTrack,
          sendBeacon: (url, blob) => beacons.push({ url, body: JSON.parse(blob.parts[0]) }),
        },
        Blob: class {
          constructor(parts) {
            this.parts = parts;
          }
        },
        URLSearchParams,
        setTimeout: (fn) => timers.push(fn),
        setInterval: () => 0,
      };
      vm.createContext(box);
      win.addEventListener('DOMContentLoaded', () => {
        win.atlasApp = new FakeApp();
      });
      vm.runInContext(trackSrc, box, { filename: 'atlas_track.js' });
      fire(listeners.document, 'DOMContentLoaded');
      fire(listeners.window, 'DOMContentLoaded');
      return {
        win,
        app: win.atlasApp,
        FakeApp,
        beacons,
        runTimers: () => timers.splice(0).forEach((fn) => fn()),
        click: (props) =>
          fire(listeners.document, 'click', {
            target: { dataset: {}, classList: [], tagName: 'BUTTON', parentElement: null, closest() { return this; }, ...props },
          }),
        flush: () => {
          beacons.length = 0;
          fire(listeners.window, 'pagehide');
          const out = {};
          for (const b of beacons) for (const [kind, name, n] of b.body.ev) out[`${kind}/${name}`] = n;
          return out;
        },
      };
    };

    const t = bootTracker({ search: '?person=sushi&lang=en' });
    const hooks = t.win.__ATLAS_TRACK_HOOKS;
    assert(Array.isArray(hooks) && hooks.length >= 5, 'atlas_track.js must expose its feature hooks');
    for (const method of hooks) {
      assert.strictEqual(
        typeof ControllerClass.prototype[method],
        'function',
        `atlas_track.js hooks a controller method that no longer exists: ${method}`
      );
    }
    const ctrlSrc = ['app.js', 'atlas_trace.js', 'atlas_quiz.js']
      .map((f) => fs.readFileSync(path.join(JS_DIR, f), 'utf8'))
      .join('\n');
    for (const needle of [
      'this.activeTrace = ',
      'this.activePerson = ',
      'this.activePolity = ',
      'this.eraFocus = ',
      'this._scrubberView = ',
      '.finished = true',
      'act-return-person',
      'act-return-story',
    ]) {
      assert(ctrlSrc.includes(needle), `atlas_track.js relies on controller code that no longer exists: ${needle}`);
    }
    assert(
      indexHtml.includes('id="milestone-list"') && indexHtml.includes('id="genealogy-timeline"'),
      'atlas_track.js counts clicks on rows inside #milestone-list and #genealogy-timeline'
    );

    const { app } = t;
    // One user action is many calls: the app re-invokes openGenealogyAt after each lazy bundle
    // loads and on every year change while the card stays open.
    app.openGenealogyAt(108.94, 34.26);
    app.openGenealogyAt(108.94, 34.26);
    app.openGenealogyAt(108.94, 34.26);
    app.activeTrace = null;
    app.openGenealogyAt(108.94, 34.26);
    app.openGenealogyAt(112.45, 34.62);

    // The quiz bundle is lazy: its methods reach the prototype long after the hooks are set up,
    // and until then the app relies on `typeof this.startChallenge` being 'undefined'.
    assert.strictEqual(typeof app.startChallenge, 'undefined', 'A hook must not make an unloaded lazy method look present');
    t.FakeApp.prototype.startChallenge = function () {
      this.challenge = { finished: false };
    };
    t.FakeApp.prototype._finishChallenge = function () {
      this.challenge.finished = true;
    };
    app.startChallenge();
    app._finishChallenge();
    app._finishChallenge();

    app.openPersonChronicle([{ key: 'sushi' }]);
    // Opening a place card from a chronicle clears it; the return button brings it back.
    app.activePerson = null;
    t.click({ id: 'act-return-person' });
    app.openPersonChronicle([{ key: 'sushi' }]);
    t.runTimers();
    app.openPersonChronicle([{ key: 'libai' }, { key: 'dufu' }]);
    app.openPersonChronicle([{ key: 'anshi', isStory: true }]);

    t.click({ id: 'act-step-next' });
    t.click({ id: 'act-step-next' });
    t.click({ tagName: 'DIV', classList: ['is-active', 'band-cell'] });
    t.click({ tagName: 'LI', parentElement: { closest: () => ({ id: 'milestone-list' }) } });

    assert.deepStrictEqual(
      t.flush(),
      {
        'entry/person': 1,
        'feat/place_card': 3,
        'feat/quiz_start': 1,
        'feat/quiz_finish': 1,
        'feat/person:sushi': 1,
        'feat/multi:dufu.libai': 1,
        'feat/story:anshi': 1,
        'btn/act-return-person': 1,
        'btn/act-step-next': 2,
        'btn/c.band-cell': 1,
        'btn/li.milestone-list': 1,
      },
      'atlas_track.js must count each feature once per open and each named control once per click'
    );
    assert.strictEqual(t.beacons.length, 1, 'One page view sends one beacon per flush');
    assert.strictEqual(t.beacons[0].url, 'https://stats.deanchen.me/e');
    assert.deepStrictEqual(
      { v: t.beacons[0].body.v, l: t.beacons[0].body.l, w: t.beacons[0].body.w },
      { v: 1, l: 'en', w: 'd' }
    );
    assert.deepStrictEqual(t.flush(), {}, 'Nothing is sent when nothing happened since the last flush');

    for (const opts of [{ hostname: 'localhost' }, { hostname: '' }, { doNotTrack: '1' }]) {
      const off = bootTracker(opts);
      off.click({ id: 'act-music' });
      off.app.openGenealogyAt(108.94, 34.26);
      assert.deepStrictEqual(off.flush(), {}, `Tracker must stay off for ${JSON.stringify(opts)}`);
      assert.strictEqual(
        Object.getOwnPropertyDescriptor(off.app, 'openGenealogyAt'),
        undefined,
        'A disabled tracker must not touch the controller'
      );
    }
  }
}

module.exports = { runSearchRuntimeSuite };
