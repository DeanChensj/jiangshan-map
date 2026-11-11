'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function runCartographyUiSuite(ctx) {
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
    dynasties,
    loreData,
    enLocale,
    hydro,
    indexHtml,
    styleCss,
    appCode,
    readmeSrc,
    readmeZhSrc,
    tangDyn,
    pointInShape,
  } = ctx;

  // 23w. Hygiene & anti-drift guards: zero unreachable snapshots, zero legacy ?journey= links, zero unreferenced assets, and index.html SSR parity
  {
    if (!FAST_MODE) {
      const liveSnapSet = new Set(['neighbors']);
      for (const d of dynasties) {
        for (let y = d.fromYear; y <= d.toYear; y++) {
          if (y === 0) continue;
          liveSnapSet.add(ctrl._resolveSnapKey(d, y));
        }
        for (const p of d.phases || []) {
          if (p.snap) liveSnapSet.add(p.snap);
        }
      }
      const snapsRawCheck = fs.readFileSync(path.join(JS_DIR, 'atlas_snapshots.js'), 'utf8');
      const mRawD = snapsRawCheck.match(/^(\s*const D = )(\{[\s\S]*?\})(;\s*\n\s*const rc =)/m);
      assert(mRawD, 'Expected compact D block in atlas_snapshots.js');
      const parsedRawD = JSON.parse(mRawD[2]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const k of [...liveSnapSet]) {
          const s = parsedRawD.d[k];
          if (!s) continue;
          for (const refField of ['prefRef', 'regionRef']) {
            const target = s[refField];
            assert(!target || parsedRawD.d[target], `Dangling ${refField}="${target}" on snapshot ${k}`);
            if (target && !liveSnapSet.has(target)) {
              liveSnapSet.add(target);
              grew = true;
            }
          }
        }
      }
      const unreachableSnaps = Object.keys(parsedRawD.d).filter((k) => !liveSnapSet.has(k));
      assert.strictEqual(
        unreachableSnaps.length,
        0,
        `Found unreachable legacy snapshots in atlas_snapshots.js: ${unreachableSnaps.join(', ')}`
      );
    }

    const sitemapRaw = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    assert(
      !indexHtml.includes('?journey=') && !sitemapRaw.includes('?journey='),
      'index.html and sitemap.xml must use canonical ?person= URLs rather than legacy ?journey='
    );
    assert(
      !indexHtml.includes('秦灭东周王室') && !indexHtml.includes('（今江西南安府（今大余））'),
      'index.html must not contain stale Warring States factual error or nested Nan’an double parentheses'
    );
    const ssrMilestoneLis = indexHtml.match(/<ul id="milestone-list">([\s\S]*?)<\/ul>/);
    const ssrCount = ssrMilestoneLis ? (ssrMilestoneLis[1].match(/<li>/g) || []).length : 0;
    assert.strictEqual(
      ssrCount,
      dynasties[0].milestones.length,
      `index.html #milestone-list count (${ssrCount}) must match Warring States milestones (${dynasties[0].milestones.length})`
    );

    const refCorpus = [indexHtml, styleCss, appCode, readmeSrc, readmeZhSrc].join('\n');
    for (const assetFile of fs.readdirSync(path.join(ROOT, 'assets'))) {
      assert(refCorpus.includes(assetFile), `Unreferenced file in assets/: ${assetFile}`);
    }

    const maShanLinkMatch = indexHtml.match(
      /<link href="(https:\/\/fonts\.googleapis\.com\/css2\?family=Ma\+Shan\+Zheng&text=([^"&]+)&display=swap)" rel="stylesheet" \/>/
    );
    assert(maShanLinkMatch, 'Expected synchronous subsetted Ma Shan Zheng stylesheet <link> in index.html');
    const subsetChars = new Set(decodeURIComponent(maShanLinkMatch[2]));
    const requiredCalligraphyChars = [
      '江山时序',
      ...dynasties.map((d) => d.title || ''),
      ...dynasties.map((d) => (enLocale.dynasties[d.key] && enLocale.dynasties[d.key].name) || ''),
    ].join('');
    for (const ch of requiredCalligraphyChars) {
      assert(subsetChars.has(ch), `Ma Shan Zheng subset missing glyph "${ch}"`);
    }

    const pyHelperSrc = fs.readFileSync(
      path.join(ROOT, 'skills', 'jiangshan-atlas', 'scripts', 'jiangshan.py'),
      'utf8'
    );
    assert(
      pyHelperSrc.includes('public_url = f"{PUBLIC_BASE_URL.rstrip(\'/\')}/?{query}"'),
      'jiangshan.py must derive public_url from PUBLIC_BASE_URL'
    );
  }

  // 23x. Western Jin and Eastern Jin & Sixteen Kingdoms (Book of Jin / 《晋书》 & Tan Qixiang Vol 4)
  if (!FAST_MODE) {
    const jiankang = [118.801, 32.061];
    const jingkou = [119.451, 32.201];
    const dongjinSnaps = [
      's_dongjin_317',
      's_dongjin_a0',
      's_dongjin_a',
      's_dongjin_a2',
      's_dongjin_b',
      's_dongjin_b2',
      's_dongjin_373',
      's_dongjin_c',
      's_dongjin_d0',
      's_dongjin_d1',
      's_dongjin_d',
      's_dongjin_e',
      's_dongjin_f',
    ];
    for (const sk of dongjinSnaps) {
      const snap = snapshots[sk];
      assert(snap, `Missing snapshot: ${sk}`);
      const djPol = snap.polities.find((p) => p.title === '东晋');
      assert(djPol && djPol.shape, `${sk} must have 东晋 polity with valid shape`);
      assert(
        pointInShape(jiankang[0], jiankang[1], djPol.shape),
        `${sk}: Jiankang ([118.801, 32.061]) must be inside Eastern Jin (东晋)`
      );
      assert(
        pointInShape(jingkou[0], jingkou[1], djPol.shape),
        `${sk}: Jingkou ([119.451, 32.201]) must be inside Eastern Jin (东晋)`
      );
    }

    // 317-318 CE (s_dongjin_317) must keep unified 汉赵 before the 319 CE split into 前赵 and 后赵 (s_dongjin_a0)
    assert(
      snapshots.s_dongjin_317.polities.some((p) => p.title === '汉赵') &&
        !snapshots.s_dongjin_317.polities.some((p) => p.title === '前赵') &&
        !snapshots.s_dongjin_317.polities.some((p) => p.title === '后赵'),
      's_dongjin_317 (317-318 CE) must show unified 汉赵 before the 319 CE split into 前赵 and 后赵'
    );
    assert(
      snapshots.s_dongjin_a0.polities.some((p) => p.title === '前赵') &&
        snapshots.s_dongjin_a0.polities.some((p) => p.title === '后赵') &&
        !snapshots.s_dongjin_a0.polities.some((p) => p.title === '汉赵'),
      's_dongjin_a0 (319-328 CE) must split 汉赵 into 前赵 and 后赵'
    );

    // Shengle ([111.821, 40.381]) inside Dai (代) across 317-376 CE (s_dongjin_317..s_dongjin_b2)
    const shengle = [111.821, 40.381];
    for (const sk of ['s_dongjin_317', 's_dongjin_a0', 's_dongjin_a', 's_dongjin_a2', 's_dongjin_350', 's_dongjin_351', 's_dongjin_b', 's_dongjin_b2']) {
      const daiPol = snapshots[sk].polities.find((p) => p.title === '代');
      assert(daiPol && daiPol.shape, `${sk} must include 代 polity`);
      assert(
        pointInShape(shengle[0], shengle[1], daiPol.shape),
        `${sk}: Shengle ([111.821, 40.381]) must be inside 代`
      );
    }

    // 沙州 (issue #267): Gaochang Commandery (327 CE) and the 西域长史 at Haitou (Loulan) belong
    // to 前凉 from 329 CE until 376 CE, and no other polity of those snapshots covers them.
    for (const sk of ['s_dongjin_a', 's_dongjin_a2', 's_dongjin_350', 's_dongjin_351', 's_dongjin_b', 's_dongjin_b2']) {
      for (const [name, x, y] of [['高昌', 89.53, 42.85], ['楼兰', 89.84, 40.52]]) {
        const holders = snapshots[sk].polities.filter((p) => p.shape && pointInShape(x, y, p.shape)).map((p) => p.title);
        assert(holders.length === 1 && holders[0] === '前凉', `${sk}: ${name} must be inside 前凉 only, found ${holders.join('+')}`);
      }
    }

    // 350 CE (s_dongjin_350) & 351 CE (s_dongjin_351) must show 冉魏, while 351 CE adds 前秦 in Guanzhong and keeps 前燕 in Liaodong
    assert(
      snapshots.s_dongjin_350.polities.some((p) => p.title === '冉魏') &&
        !snapshots.s_dongjin_350.polities.some((p) => p.title === '后赵'),
      's_dongjin_350 (350-351 CE) must replace 后赵 with 冉魏'
    );
    assert(
      snapshots.s_dongjin_351.polities.some((p) => p.title === '前秦') &&
        snapshots.s_dongjin_351.polities.some((p) => p.title === '冉魏') &&
        pointInShape(114.391, 36.101, snapshots.s_dongjin_351.polities.find((p) => p.title === '冉魏').shape),
      's_dongjin_351 (351-352 CE) must show both 前秦 and 冉魏 (covering Ye)'
    );

    // 385-417 CE must split 后秦 and 西秦 into two separate polities (never merged as "后秦 · 西秦")
    const fuhan = [103.211, 35.601];
    const changan = [108.941, 34.341];
    for (const sk of ['s_dongjin_385', 's_dongjin_d0', 's_dongjin_397', 's_dongjin_d1', 's_dongjin_399', 's_dongjin_404', 's_dongjin_d', 's_dongjin_410', 's_dongjin_e']) {
      const hq = snapshots[sk].polities.find((p) => p.title === '后秦');
      const xq = snapshots[sk].polities.find((p) => p.title === '西秦');
      assert(hq && xq, `${sk} must have separate 后秦 and 西秦 polities`);
      assert(pointInShape(changan[0], changan[1], hq.shape), `${sk}: Chang'an must be inside 后秦`);
      assert(pointInShape(fuhan[0], fuhan[1], xq.shape), `${sk}: Fuhan must be inside 西秦`);
    }

    // 397-413 CE must include 南凉 (covering Ledu [102.4, 36.48]) alongside 北凉
    const ledu = [102.4, 36.48];
    for (const sk of ['s_dongjin_397', 's_dongjin_d1', 's_dongjin_399', 's_dongjin_404', 's_dongjin_d', 's_dongjin_410']) {
      const nl = snapshots[sk].polities.find((p) => p.title === '南凉');
      const bl = snapshots[sk].polities.find((p) => p.title === '北凉');
      assert(nl && bl, `${sk} must include both 南凉 and 北凉 polities`);
      assert(pointInShape(ledu[0], ledu[1], nl.shape), `${sk}: Ledu ([102.4, 36.48]) must be inside 南凉`);
    }

    // 404-413 CE (s_dongjin_404, s_dongjin_d, s_dongjin_410) must include 谯蜀 in Ba-Shu (covering Chengdu [104.071, 30.571])
    for (const sk of ['s_dongjin_404', 's_dongjin_d', 's_dongjin_410']) {
      const qs = snapshots[sk].polities.find((p) => p.title === '谯蜀');
      assert(qs && qs.shape, `${sk} must include 谯蜀 polity`);
      assert(pointInShape(104.071, 30.571, qs.shape), `${sk}: Chengdu ([104.071, 30.571]) must be inside 谯蜀`);
    }
    assert(
      !snapshots.s_dongjin_e.polities.some((p) => p.title === '谯蜀') &&
        pointInShape(104.071, 30.571, snapshots.s_dongjin_e.polities.find((p) => p.title === '东晋').shape),
      's_dongjin_e (413-417 CE) must show 谯蜀 recovered by 东晋'
    );

    // Guzang ([102.641, 37.931]) inside Liangzhou polities (Former/Later/Northern Liang or unified Former Qin)
    const guzang = [102.641, 37.931];
    const guzangCases = [
      ['s_dongjin_317', '前凉'],
      ['s_dongjin_a0', '前凉'],
      ['s_dongjin_a', '前凉'],
      ['s_dongjin_a2', '前凉'],
      ['s_dongjin_350', '前凉'],
      ['s_dongjin_351', '前凉'],
      ['s_dongjin_b', '前凉'],
      ['s_dongjin_b2', '前凉'],
      ['s_dongjin_c', '前秦'],
      ['s_dongjin_385', '后凉'],
      ['s_dongjin_d0', '后凉'],
      ['s_dongjin_397', '北凉'],
      ['s_dongjin_d1', '北凉'],
      ['s_dongjin_399', '北凉'],
      ['s_dongjin_404', '北凉'],
      ['s_dongjin_d', '北凉'],
      ['s_dongjin_410', '北凉'],
      ['s_dongjin_e', '北凉'],
      ['s_dongjin_f', '北凉'],
    ];
    for (const [sk, expectedTitle] of guzangCases) {
      const snap = snapshots[sk];
      const pol = snap.polities.find((p) => p.title === expectedTitle);
      assert(pol && pol.shape, `${sk} must contain polity "${expectedTitle}"`);
      assert(
        pointInShape(guzang[0], guzang[1], pol.shape),
        `${sk}: Guzang ([102.641, 37.931]) must be inside ${expectedTitle}`
      );
    }

    // Western Jin 304-305 CE (s_xijin) must include 晋, 汉赵, and 成汉; Chengdu inside 成汉
    const chengdu = [104.071, 30.571];
    const xijinSnap = snapshots.s_xijin;
    assert(xijinSnap, 'Missing s_xijin snapshot');
    const chPol = xijinSnap.polities.find((p) => p.title === '成汉');
    assert(chPol && chPol.shape, 's_xijin must include 成汉 polity');
    assert(
      pointInShape(chengdu[0], chengdu[1], chPol.shape),
      's_xijin: Chengdu ([104.071, 30.571]) must be inside 成汉'
    );
    assert(
      xijinSnap.polities.some((p) => p.title === '晋') &&
        xijinSnap.polities.some((p) => p.title === '汉赵'),
      's_xijin must include both 晋 and 汉赵 polities'
    );

    // Capital periods verification for xijin and dongjin
    const xjDyn = dynasties.find((d) => d.key === 'xijin');
    const djDyn = dynasties.find((d) => d.key === 'dongjin');
    const findSt = (d, ancient) => (d.settlements || []).find((s) => s.ancient === ancient);

    const luoyangXJ = findSt(xjDyn, '洛阳');
    assert(luoyangXJ && Array.isArray(luoyangXJ.capitalPeriods), 'xijin: 洛阳 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(luoyangXJ.capitalPeriods), JSON.stringify([[280, 311]]), 'xijin: 洛阳 capitalPeriods must be [[280, 311]]');

    const changanXJ = findSt(xjDyn, '长安');
    assert(changanXJ && Array.isArray(changanXJ.capitalPeriods), 'xijin: 长安 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(changanXJ.capitalPeriods), JSON.stringify([[313, 316]]), 'xijin: 长安 capitalPeriods must be [[313, 316]]');

    const chengduXJ = findSt(xjDyn, '成都');
    assert(chengduXJ && Array.isArray(chengduXJ.capitalPeriods), 'xijin: 成都 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(chengduXJ.capitalPeriods), JSON.stringify([[306, 316]]), 'xijin: 成都 capitalPeriods must be [[306, 316]]');

    const yeDJ = findSt(djDyn, '邺');
    assert(yeDJ && Array.isArray(yeDJ.capitalPeriods), 'dongjin: 邺 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(yeDJ.capitalPeriods), JSON.stringify([[335, 370]]), 'dongjin: 邺 capitalPeriods must be [[335, 370]]');

    const pingchengDJ = findSt(djDyn, '平城');
    assert(pingchengDJ && Array.isArray(pingchengDJ.capitalPeriods), 'dongjin: 平城 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(pingchengDJ.capitalPeriods), JSON.stringify([[398, 420]]), 'dongjin: 平城 capitalPeriods must be [[398, 420]]');

    const guzangDJ = findSt(djDyn, '姑臧');
    assert(guzangDJ && Array.isArray(guzangDJ.capitalPeriods), 'dongjin: 姑臧 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(guzangDJ.capitalPeriods), JSON.stringify([[320, 376], [386, 403], [412, 420]]), 'dongjin: 姑臧 capitalPeriods must match');
  }

  // 23y. Southern and Northern Dynasties (Nanbei / Zizhi Tongjian, Nan Shi, Bei Shi & Tan Qixiang Vol 4)
  if (!FAST_MODE) {
    const jiankang = [118.801, 32.061];
    const jingkou = [119.451, 32.201];
    const nanbeiSnaps = [
      ['s_nanbei_0', '宋', '魏'],
      ['s_nanbei_427', '宋', '魏'],
      ['s_nanbei_0b', '宋', '魏'],
      ['s_nanbei_0c', '宋', '魏'],
      ['s_nanbei_a', '宋', '魏'],
      ['s_nanbei_a2', '宋', '魏'],
      ['s_nanbei_b', '齐', '魏'],
      ['s_nanbei_c', '梁', '魏'],
      ['s_nanbei_d', '梁', '东魏'],
      ['s_nanbei_d1', '梁', '北齐'],
      ['s_nanbei_d2', '梁', '北齐'],
      ['s_nanbei_d3', '梁', '北齐'],
      ['s_nanbei_e', '陈', '北齐'],
      ['s_nanbei_e2', '陈', '北齐'],
      ['s_nanbei_f', '陈', '北周'],
    ];

    // Seamless 420 CE transition between s_dongjin_f (417-420) and s_nanbei_0 (420-426):
    // 东晋 and 宋 must have identical shapes, 北魏, 西秦, 胡夏, 北燕, 吐谷浑 match 1-to-1,
    // and s_dongjin_f (西凉 + 北凉) merges into unified 北凉 in s_nanbei_0 (420-421 conquest of Western Liang).
    assert.strictEqual(
      JSON.stringify(snapshots.s_dongjin_f.polities.find((p) => p.title === '东晋').shape),
      JSON.stringify(snapshots.s_nanbei_0.polities.find((p) => p.title === '宋').shape),
      's_dongjin_f (东晋) and s_nanbei_0 (宋) must share identical polygon geometry at 420 CE'
    );
    for (const sharedTitle of ['北魏', '西秦', '胡夏', '北燕', '吐谷浑']) {
      const pDj = snapshots.s_dongjin_f.polities.find((p) => p.title === sharedTitle);
      const pNb = snapshots.s_nanbei_0.polities.find((p) => p.title === sharedTitle);
      assert(pDj && pNb, `Both s_dongjin_f and s_nanbei_0 must include ${sharedTitle} at 420 CE`);
      assert.strictEqual(
        JSON.stringify(pDj.shape),
        JSON.stringify(pNb.shape),
        `s_dongjin_f and s_nanbei_0 must share identical polygon geometry for ${sharedTitle} at 420 CE`
      );
    }
    {
      const xl417 = snapshots.s_dongjin_f.polities.find((p) => p.title === '西凉');
      const bl417 = snapshots.s_dongjin_f.polities.find((p) => p.title === '北凉');
      const bl420 = snapshots.s_nanbei_0.polities.find((p) => p.title === '北凉');
      assert(
        xl417 &&
          bl417 &&
          bl420 &&
          !snapshots.s_nanbei_0.polities.some((p) => p.title === '西凉') &&
          pointInShape(94.66, 40.14, xl417.shape) &&
          pointInShape(94.66, 40.14, bl420.shape) &&
          pointInShape(102.64, 37.93, bl417.shape) &&
          pointInShape(102.64, 37.93, bl420.shape),
        's_dongjin_f must split Western Liang (Dunhuang) and Northern Liang (Guzang), merging into Northern Liang in s_nanbei_0'
      );
    }

    // P0 Northwest Frontier (Hexi Corridor, Longyou/Hehuang, Hetao/Ordos) historical invariants (189-960 CE)
    {
      const hasPolAt = (sk, title, x, y) => {
        const p = (snapshots[sk].polities || []).find((it) => it.title === title);
        return Boolean(p && p.shape && pointInShape(x, y, p.shape));
      };
      // 1) Dunhuang ([94.66, 40.14]) & Yangguan ([94.13, 39.93]) inside Hexi / regular prefectures (25-880 CE)
      for (const [sk, title] of [
        ['s_donghan_a', '东汉'],
        ['s_donghan_d1', '马腾(凉州)'],
        ['s_donghan_f', '曹操(北方)'],
        ['s_sanguo', '魏'],
        ['s_xijin_a', '晋'],
        ['s_dongjin_a', '前凉'],
        ['s_dongjin_c', '前秦'],
        ['s_dongjin_385', '后凉'],
        ['s_dongjin_399', '西凉'],
        ['s_nanbei_0', '北凉'],
        ['s_nanbei_a', '北魏'],
        ['s_nanbei_d', '西魏'],
        ['s_nanbei_e', '北周'],
        ['s_sui', '隋'],
        ['s_sui_d', '凉（李轨）'],
        ['s_tang_a1', '唐'],
        ['s_tang_a5y', '唐'],
        ['s_tang_a5', '唐'],
        ['s_tang_c', '归义军（张议潮）'],
      ]) {
        assert(
          hasPolAt(sk, title, 94.66, 40.14) && hasPolAt(sk, title, 94.13, 39.93),
          `${sk}: Dunhuang ([94.66, 40.14]) and Yangguan ([94.13, 39.93]) must belong to ${title}`
        );
      }
      // 2) Post-215 CE Hetao & Alashan contraction (Jian'an 20): Jiuyuan/Wuyuan ([108.27, 41.10]), Shengle ([111.82, 40.48]), Alashan ([105.60, 39.50]), & Gobi north of Yinshan ([108.50, 42.00]) in Xianbei; Zhongwei ([105.19, 37.51]) & Xinzhou ([112.73, 38.42]) kept
      for (const [sk, coreTitle] of [
        ['s_donghan_e', '曹操(北方)'],
        ['s_sanguo', '魏'],
        ['s_xijin_a', '晋'],
      ]) {
        assert(
          hasPolAt(sk, '鲜卑', 108.27, 41.1) &&
            hasPolAt(sk, '鲜卑', 111.82, 40.48) &&
            hasPolAt(sk, '鲜卑', 105.6, 39.5) &&
            hasPolAt(sk, '鲜卑', 108.5, 42.0) &&
            !hasPolAt(sk, coreTitle, 108.27, 41.1) &&
            !hasPolAt(sk, coreTitle, 105.6, 39.5) &&
            !hasPolAt(sk, coreTitle, 108.5, 42.0) &&
            hasPolAt(sk, coreTitle, 105.19, 37.51) &&
            hasPolAt(sk, coreTitle, 112.73, 38.42),
          `${sk}: Wuyuan, Shengle, Alashan, & Yinshan-north must belong to 鲜卑 after 215 CE while Zhongwei & Xinzhou remain in ${coreTitle}`
        );
      }
      // 3) 311-316 CE Yongjia (s_xijin_b): Luoyang & Chang'an in Han-Zhao; 350 CE (s_dongjin_350): Chang'an in 前秦（苻氏）, Ye in 冉魏
      assert(
        hasPolAt('s_xijin_b', '汉赵', 112.45, 34.62) && hasPolAt('s_xijin_b', '汉赵', 108.94, 34.34),
        's_xijin_b (311-316 CE): Luoyang and Chang\'an must belong to 汉赵'
      );
      assert(
        hasPolAt('s_dongjin_350', '前秦（苻氏）', 108.94, 34.34) &&
          hasPolAt('s_dongjin_350', '冉魏', 114.35, 36.6) &&
          !hasPolAt('s_dongjin_350', '冉魏', 108.94, 34.34),
        's_dongjin_350 (350 CE): Chang\'an must belong to 前秦（苻氏） while Ye belongs to 冉魏'
      );
      // 4) Tuyuhun (吐谷浑) present across Eastern Jin, Northern & Southern Dynasties, Sui, and Early Tang (317-634 CE)
      for (const sk of ['s_dongjin_317', 's_dongjin_c', 's_nanbei_0', 's_nanbei_a', 's_nanbei_e', 's_sui_a', 's_sui', 's_sui_d', 's_tang_0']) {
        assert(
          hasPolAt(sk, '吐谷浑', 99.82, 36.85) &&
            !hasPolAt(sk, '吐谷浑', 96.6, 33.0) &&
            !hasPolAt(sk, '吐谷浑', 91.0, 34.5),
          `${sk}: Qinghai Lake / Fusicheng ([99.82, 36.85]) must belong to 吐谷浑 while Yushu ([96.6, 33.0]) and Hoh Xil ([91.0, 34.5]) stay outside`
        );
      }
      assert(
        hasPolAt('s_sui_c', '隋', 93.51, 42.82) &&
          hasPolAt('s_sui_c', '西海·鄯善等四郡', 99.82, 36.85) &&
          hasPolAt('s_sui_c', '吐谷浑', 99.2, 34.1) &&
          !hasPolAt('s_sui_c', '吐谷浑', 92.0, 34.0),
        's_sui_c (609-618 CE): Hami must belong to 隋, Qinghai Lake to 西海·鄯善等四郡, and Fuyun remnant to southeastern Bayan Har / Hequ ([99.2, 34.1])'
      );
      assert(
        hasPolAt('s_tang_a1b', '吐谷浑（唐册封诺曷钵）', 99.82, 36.85) &&
          hasPolAt('s_tang_a1b', '吐蕃', 97.5, 34.8) &&
          hasPolAt('s_tang_a3b', '吐蕃', 99.82, 36.85) &&
          !hasPolAt('s_tang_a3b', '吐谷浑（唐册封诺曷钵）', 99.82, 36.85),
        's_tang_a1b..a3 (635-662 CE) must contract 吐谷浑（唐册封诺曷钵） north of Bayan Har, and s_tang_a3b (663-668 CE) must transfer Qinghai Lake to 吐蕃'
      );
      // 5) Post-763 Eastern Longyou (Qinzhou [105.72, 34.58], Weizhou [104.63, 35.00], Yuanzhou [106.28, 36.01]) in Tubo, Longzhou ([106.86, 34.89]) & Lingzhou in Tang
      for (const sk of ['s_tang_b1', 's_tang_b']) {
        assert(
          hasPolAt(sk, '吐蕃', 105.72, 34.58) &&
            hasPolAt(sk, '吐蕃', 104.63, 35.0) &&
            hasPolAt(sk, '吐蕃', 106.28, 36.01) &&
            hasPolAt(sk, '唐', 106.86, 34.89) &&
            hasPolAt(sk, '唐', 106.28, 38.09),
          `${sk}: Qinzhou, Weizhou, and Yuanzhou must belong to 吐蕃 while Longzhou and Lingzhou stay in 唐`
        );
      }
      // 6) Five Dynasties (907-960 CE): 3 Hexi polities + Dingnan (Xiazhou) vs Shuofang (Lingzhou in Central Plains) + Lanzhou in 吐蕃诸部
      for (const [sk, cpTitle] of [
        ['s_wudai_a', '后梁'],
        ['s_wudai_b1', '后唐'],
        ['s_wudai_b', '后唐'],
        ['s_wudai_c0', '后晋'],
        ['s_wudai_d', '后汉'],
        ['s_wudai_e', '后周'],
        ['s_wudai_e2', '后周'],
      ]) {
        assert(
          hasPolAt(sk, '沙州归义军', 94.66, 40.14) &&
            hasPolAt(sk, '甘州回鹘', 100.45, 38.93) &&
            hasPolAt(sk, '凉州（六谷部）', 102.64, 37.93) &&
            hasPolAt(sk, '吐蕃诸部', 103.83, 36.06) &&
            hasPolAt(sk, '党项（定难军）', 108.78, 37.98) &&
            !hasPolAt(sk, '党项（定难军）', 106.28, 38.09) &&
            hasPolAt(sk, cpTitle, 106.28, 38.09) &&
            hasPolAt(sk, cpTitle, 104.63, 35.0),
          `${sk}: Five Dynasties NW must map Shazhou, Ganzhou Uyghurs, Liangzhou Liugu, Tibetan Lanzhou, Dingnan Xiazhou, and ${cpTitle} Lingzhou/Weizhou`
        );
      }
    }

    // P1 Northwest Frontier (Eastern Han Juyan & Southern Xiongnu, Riyue Mountain Divide, Wang Mang Xihai, Ming NW) invariants
    {
      const hasPolAt = (sk, title, x, y) => {
        const p = (snapshots[sk].polities || []).find((it) => it.title === title);
        return Boolean(p && p.shape && pointInShape(x, y, p.shape));
      };
      // 1) Eastern Han (25-214 CE): Juyan Oasis ([101.05, 41.95]) & Lingzhou ([106.28, 38.09]) in Han/Liangzhou; Badain Jaran ([102.20, 40.50]) & Yinshan-north ([108.50, 41.80]) in steppe
      for (const [sk, hexiPol, steppePol] of [
        ['s_donghan_a', '东汉', '匈奴'],
        ['s_donghan_b2', '东汉', '北匈奴'],
        ['s_donghan_c', '东汉', '北匈奴'],
        ['s_donghan', '东汉', '鲜卑'],
        ['s_donghan_d1', '马腾(凉州)', '鲜卑'],
        ['s_donghan_d2', '马腾·韩遂(关陇)', '鲜卑'],
        ['s_donghan_e1', '曹操(北方)', '鲜卑'],
      ]) {
        assert(
          hasPolAt(sk, hexiPol, 101.05, 41.95) &&
            hasPolAt(sk, hexiPol, 98.90, 39.98) &&
            hasPolAt(sk, hexiPol, 106.28, 38.09) &&
            !hasPolAt(sk, hexiPol, 102.20, 40.50) &&
            hasPolAt(sk, steppePol, 102.20, 40.50) &&
            hasPolAt(sk, steppePol, 108.50, 41.80),
          `${sk}: Juyan, Jinta, & Lingzhou must belong to ${hexiPol} while Badain Jaran & Yinshan-north belong to ${steppePol}`
        );
      }
      // 2) Southern Xiongnu Tributary (南匈奴（内附）, 48-214 CE) in Meiji ([111.05, 39.85]) & Wuyuan ([108.27, 41.10]), excluding Lingzhou ([106.28, 38.09])
      for (const sk of ['s_donghan_b2', 's_donghan_c', 's_donghan', 's_donghan_d1', 's_donghan_d2', 's_donghan_d', 's_donghan_e0', 's_donghan_e1']) {
        assert(
          hasPolAt(sk, '南匈奴（内附）', 111.05, 39.85) &&
            hasPolAt(sk, '南匈奴（内附）', 108.27, 41.10) &&
            !hasPolAt(sk, '南匈奴（内附）', 106.28, 38.09),
          `${sk}: Meiji & Wuyuan must belong to 南匈奴（内附） while Lingzhou stays in Central/Hexi administration`
        );
      }
      // 3) Riyue Mountain — Linqiang divide & Wang Mang Xihai Commandery (西海郡, 8-23 CE)
      assert(
        hasPolAt('s_xihan_d', '新（王莽）', 100.99, 36.90) && hasPolAt('s_xihan_d', '新（王莽）', 99.85, 36.85),
        's_xihan_d (8-23 CE): Wang Mang Xihai Commandery must encompass Haiyan and Qinghai Lake'
      );
      for (const [sk, corePol] of [
        ['s_xihan_b3a', '汉'],
        ['s_xihan_b', '汉'],
        ['s_donghan_a', '东汉'],
        ['s_donghan', '东汉'],
        ['s_sanguo', '魏'],
        ['s_xijin_a', '晋'],
      ]) {
        assert(
          hasPolAt(sk, corePol, 101.78, 36.62) &&
            hasPolAt(sk, corePol, 101.26, 36.68) &&
            !hasPolAt(sk, corePol, 100.99, 36.90) &&
            hasPolAt(sk, '西羌', 100.99, 36.90) &&
            hasPolAt(sk, '西羌', 99.85, 36.85),
          `${sk}: Xining & Linqiang must belong to ${corePol} while Haiyan & Qinghai Lake belong to 西羌`
        );
      }
      // 4) Ming Dynasty (1368-1644 CE): 1369-1371 pre-Hexi, 1371-1403 Dongsheng Guard, zero Hami/Dunhuang/Xining ∅ holes, 1513-1644 青海蒙古
      assert(
        hasPolAt('s_ming_0b', '明', 103.83, 36.06) &&
          hasPolAt('s_ming_0b', '北元', 102.64, 37.93) &&
          hasPolAt('s_ming_0b', '北元', 98.51, 39.74),
        's_ming_0b (1369-1371): Lanzhou in 明 while Hexi stays in 北元 before 1372 Feng Sheng campaign'
      );
      for (const sk of ['s_ming_0c', 's_ming_0d', 's_ming_a0']) {
        assert(
          hasPolAt(sk, '明', 101.78, 36.62) && hasPolAt(sk, '明', 111.19, 40.28),
          `${sk}: Xining Guard and front-Hetao Dongsheng Guard ([111.19, 40.28]) must belong to 明`
        );
      }
      for (const sk of Object.keys(snapshots).filter((k) => k.startsWith('s_ming'))) {
        assert(
          snapshots[sk].polities.some((p) => p.shape && pointInShape(93.51, 42.82, p.shape)) &&
            snapshots[sk].polities.some((p) => p.shape && pointInShape(94.66, 40.14, p.shape)) &&
            snapshots[sk].polities.some((p) => p.shape && pointInShape(101.78, 36.62, p.shape)) &&
            !hasPolAt(sk, '明', 100.99, 36.90),
          `${sk}: Hami, Dunhuang, and Xining must have polity coverage and Haiyan must lie west of Ming Riyue border`
        );
      }
      for (const sk of ['s_ming_b', 's_ming_c0', 's_ming_c', 's_ming_c2']) {
        assert(
          hasPolAt(sk, '青海蒙古', 98.85, 36.85) && hasPolAt(sk, '青海蒙古', 100.99, 36.90),
          `${sk}: Qinghai Lake & Qaidam must belong to 青海蒙古 in 1513-1644`
        );
      }

      // P2 Northwest Frontier & Northern Hexi De-Provincialization invariants
      for (const sk of Object.keys(snapshots).filter((k) => /^(s_xihan|s_donghan|s_sanguo|s_xijin|s_dongjin)/.test(k))) {
        const lintanOwners = (snapshots[sk].polities || []).filter((p) => p.shape && pointInShape(103.35, 34.69, p.shape));
        assert.strictEqual(
          lintanOwners.length,
          1,
          `${sk}: Lintan/Zhuoni ([103.35, 34.69], ancient Lintao west) must belong to exactly 1 polity`
        );
      }
      for (const sk of ['s_xihan_b1', 's_xihan_b2', 's_xihan_b3a', 's_xihan_b3b', 's_xihan_b3']) {
        assert(
          hasPolAt(sk, '匈奴', 101.05, 41.95) && !hasPolAt(sk, '汉', 101.05, 41.95),
          `${sk}: pre-102 BCE Juyan ([101.05, 41.95]) must belong to 匈奴 prior to Lu Bode's 102 BCE fortification`
        );
      }
      for (const [sk, hexiPol] of [
        ['s_xihan_b', '汉'],
        ['s_xihan_c', '汉'],
        ['s_xihan_d', '新（王莽）'],
        ['s_xihan_e', '隗嚣 · 窦融'],
        ['s_donghan_a', '东汉'],
        ['s_donghan', '东汉'],
        ['s_tang_a5y', '唐'],
        ['s_tang_a5', '唐'],
        ['s_tang_a', '唐'],
        ['s_tang_a6', '唐'],
        ['s_tang_a7', '唐'],
      ]) {
        assert(
          hasPolAt(sk, hexiPol, 101.05, 41.95) &&
            hasPolAt(sk, hexiPol, 101.25, 42.27) &&
            !hasPolAt(sk, hexiPol, 101.05, 42.80) &&
            !hasPolAt(sk, hexiPol, 99.80, 42.10) &&
            !hasPolAt(sk, hexiPol, 102.20, 40.50),
          `${sk}: narrow Ruoshui-Juyan corridor ([101.05, 41.95] & Juyan Hai [101.25, 42.27]) must belong to ${hexiPol} while Mongolia border ([101.05, 42.80]), west Ejina ([99.80, 42.10]), and Badain Jaran ([102.20, 40.50]) stay outside`
        );
      }
      // De-provincialize modern Gansu Mazongshan ([96.80, 41.80]) & modern Minqin-Tengger spike ([103.90, 39.30]) across Han–Five Dynasties + Ming
      const deProvCoreSet = new Set([
        '汉（郡国并行）', '汉', '新（王莽）', '隗嚣 · 窦融', '东汉', '马腾(凉州)', '马腾·韩遂(关陇)', '曹操(北方)',
        '魏', '晋', '汉赵', '前赵', '后赵', '前凉', '前秦（苻氏）', '前秦', '后凉', '西凉', '北凉',
        '北魏', '西魏', '北周', '隋', '凉（李轨）', '唐', '武周', '吐蕃', '归义军（张议潮）',
        '沙州归义军', '甘州回鹘', '凉州（六谷部）', '明', '哈密卫（关西七卫）', '大顺（李自成）',
      ]);
      for (const sk of Object.keys(snapshots).filter((k) => /^s_(xihan|donghan|sanguo|xijin|dongjin|nanbei|sui|tang|wudai|ming)(_|$)/.test(k))) {
        const leak = (snapshots[sk].polities || []).find(
          (p) =>
            p.shape &&
            deProvCoreSet.has(p.title) &&
            (pointInShape(96.80, 41.80, p.shape) ||
              pointInShape(103.90, 39.30, p.shape) ||
              pointInShape(102.10, 39.12, p.shape) ||
              pointInShape(105.00, 39.80, p.shape))
        );
        assert(!leak, `${sk}: ${leak ? leak.title : ''} must not inherit modern Gansu Mazongshan ([96.80, 41.80]), Jinchang ([102.10, 39.12]), Minqin-Tengger spike ([103.90, 39.30]), or Helan-west 90-degree desert box ([105.00, 39.80])`);
      }
      for (const sk of ['s_ming_0c', 's_ming_0d', 's_ming_a0', 's_ming_a', 's_ming_a2', 's_ming_b0', 's_ming_b', 's_ming_c0', 's_ming_c']) {
        assert(
          hasPolAt(sk, '明', 103.09, 38.62) && !hasPolAt(sk, '明', 102.00, 38.90),
          `${sk}: Ming must retain Zhenfan Guard ([103.09, 38.62]) while retracting south of [102.00, 38.90] along Yongchang Guard & Ming Great Wall`
        );
      }
      assert(
        hasPolAt('s_xihan_b1', '匈奴', 98.51, 39.74) &&
          hasPolAt('s_xihan_b2', '汉', 98.51, 39.74) &&
          !hasPolAt('s_xihan_b2', '月氏', 98.51, 39.74) &&
          !hasPolAt('s_xihan_e', '刘秀（河北）', 108.50, 40.80) &&
          hasPolAt('s_xihan_e', '匈奴', 108.50, 40.80) &&
          hasPolAt('s_xihan_e', '更始（汉）', 112.55, 37.87) &&
          !hasPolAt('s_sui_c', '吐蕃', 99.82, 36.85) &&
          !hasPolAt('s_sui_c', '吐谷浑', 99.82, 36.85) &&
          hasPolAt('s_tang_a4', '安北都护府', 101.05, 41.95) &&
          !hasPolAt('s_tang_a4', '唐', 101.05, 41.95),
        'P2: pre-121 BCE Xiongnu Hexi, zero s_xihan_b2 Han+Yuezhi overlap, 23-25 CE Liu Xiu out of Hetao, zero s_sui_c Xihai+Tubo/Tuyuhun overlap, and 679-689 Anbei Protectorate at Juyan'
      );
    }
    // 427-430 CE (s_nanbei_427) must place Tongwancheng ([108.871, 37.991]) inside 北魏 while keeping 胡夏 and 西秦 until 431 CE
    assert(
      pointInShape(108.871, 37.991, snapshots.s_nanbei_427.polities.find((p) => p.title === '北魏').shape) &&
        snapshots.s_nanbei_427.polities.some((p) => p.title === '胡夏') &&
        snapshots.s_nanbei_427.polities.some((p) => p.title === '西秦'),
      's_nanbei_427 (427-430 CE) must place Tongwancheng inside 北魏 while keeping 胡夏 (in Longdong) and 西秦 until 431 CE'
    );

    for (const [sk, southTitle, northTitle] of nanbeiSnaps) {
      const snap = snapshots[sk];
      assert(snap, `Missing snapshot: ${sk}`);
      const sPol = snap.polities.find((p) => p.title === southTitle);
      assert(sPol && sPol.shape, `${sk} must have Southern Dynasty polity ${southTitle} with valid shape`);
      assert(
        pointInShape(jiankang[0], jiankang[1], sPol.shape),
        `${sk}: Jiankang ([118.801, 32.061]) must be inside Southern Dynasty (${southTitle})`
      );
      assert(
        pointInShape(jingkou[0], jingkou[1], sPol.shape),
        `${sk}: Jingkou ([119.451, 32.201]) must be inside Southern Dynasty (${southTitle})`
      );
      const nPol = snap.polities.find((p) => p.title === northTitle);
      if (nPol && nPol.shape) {
        assert(
          !pointInShape(jiankang[0], jiankang[1], nPol.shape),
          `${sk}: Jiankang must NOT be swallowed by Northern Dynasty (${northTitle})`
        );
        assert(
          !pointInShape(jingkou[0], jingkou[1], nPol.shape),
          `${sk}: Jingkou must NOT be swallowed by Northern Dynasty (${northTitle})`
        );
      }
    }

    // Capital periods & settlement verification for nanbei
    const nbDyn = dynasties.find((d) => d.key === 'nanbei');
    assert(nbDyn, 'Missing nanbei dynasty');
    const findSt = (ancient) => (nbDyn.settlements || []).find((s) => s.ancient === ancient);

    const jiankangNB = findSt('建康');
    assert(jiankangNB && Array.isArray(jiankangNB.capitalPeriods), 'nanbei: 建康 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(jiankangNB.capitalPeriods),
      JSON.stringify([[420, 552], [555, 589]]),
      'nanbei: 建康 capitalPeriods must be [[420, 552], [555, 589]]'
    );

    const pingchengNB = findSt('平城');
    assert(pingchengNB && Array.isArray(pingchengNB.capitalPeriods), 'nanbei: 平城 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(pingchengNB.capitalPeriods),
      JSON.stringify([[420, 494]]),
      'nanbei: 平城 capitalPeriods must be [[420, 494]]'
    );

    const luoyangNB = findSt('洛阳');
    assert(luoyangNB && Array.isArray(luoyangNB.capitalPeriods), 'nanbei: 洛阳 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(luoyangNB.capitalPeriods),
      JSON.stringify([[494, 534]]),
      'nanbei: 洛阳 capitalPeriods must be [[494, 534]]'
    );

    const yeNB = findSt('邺');
    assert(yeNB && Array.isArray(yeNB.capitalPeriods), 'nanbei: 邺 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(yeNB.capitalPeriods),
      JSON.stringify([[534, 577]]),
      'nanbei: 邺 capitalPeriods must be [[534, 577]]'
    );

    const changanNB = findSt('长安');
    assert(changanNB && Array.isArray(changanNB.capitalPeriods), 'nanbei: 长安 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(changanNB.capitalPeriods),
      JSON.stringify([[535, 581]]),
      'nanbei: 长安 capitalPeriods must be [[535, 581]]'
    );

    const jianglingNB = findSt('江陵');
    assert(jianglingNB && Array.isArray(jianglingNB.capitalPeriods), 'nanbei: 江陵 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(jianglingNB.capitalPeriods),
      JSON.stringify([[552, 587]]),
      'nanbei: 江陵 capitalPeriods must be [[552, 587]]'
    );

    const jinyangNB = findSt('晋阳');
    assert(jinyangNB && Array.isArray(jinyangNB.capitalPeriods), 'nanbei: 晋阳 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(jinyangNB.capitalPeriods),
      JSON.stringify([[534, 577]]),
      'nanbei: 晋阳 capitalPeriods must be [[534, 577]]'
    );

    const tongwanNB = findSt('统万城');
    assert(tongwanNB && Array.isArray(tongwanNB.capitalPeriods), 'nanbei: 统万城 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(tongwanNB.capitalPeriods),
      JSON.stringify([[420, 427]]),
      'nanbei: 统万城 capitalPeriods must be [[420, 427]]'
    );

    const guzangNB = findSt('姑臧');
    assert(guzangNB && Array.isArray(guzangNB.capitalPeriods), 'nanbei: 姑臧 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(guzangNB.capitalPeriods),
      JSON.stringify([[420, 439]]),
      'nanbei: 姑臧 capitalPeriods must be [[420, 439]]'
    );

    const longchengNB = findSt('龙城');
    assert(longchengNB && Array.isArray(longchengNB.capitalPeriods), 'nanbei: 龙城 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(longchengNB.capitalPeriods),
      JSON.stringify([[420, 436]]),
      'nanbei: 龙城 capitalPeriods must be [[420, 436]]'
    );

    // Verify settlements added
    assert(findSt('东阳城'), 'nanbei: must include 东阳城 (Shandong Qingzhou seat)');
    assert(findSt('东阳'), 'nanbei: must include 东阳 (Zhejiang Jinhua seat)');
    assert(findSt('钟离'), 'nanbei: must include 钟离');

    // Verify 16 map change milestones
    const expectedMapChanges = [420, 427, 431, 436, 439, 469, 479, 494, 502, 534, 550, 553, 554, 557, 573, 577];
    const actualMapChanges = (nbDyn.milestones || []).filter((m) => m.isMapChange).map((m) => m.year);
    assert.strictEqual(
      JSON.stringify(actualMapChanges),
      JSON.stringify(expectedMapChanges),
      'nanbei: 16 map change milestone years must match'
    );
  }

  // 23z. Sui Dynasty & Tang Dynasty (Zizhi Tongjian, Old/New Book of Tang & Tan Qixiang Vol 5)
  if (!FAST_MODE) {
    const findDyn = (k) => dynasties.find((d) => d.key === k);
    const suiDyn = findDyn('sui');
    const tangDyn = findDyn('tang');
    assert(suiDyn, 'Missing sui dynasty');
    assert(tangDyn, 'Missing tang dynasty');

    const findSt = (dyn, ancient) => (dyn.settlements || []).find((s) => s.ancient === ancient);

    // Sui capitals & periods
    const daxingSui = findSt(suiDyn, '大兴');
    assert(daxingSui && Array.isArray(daxingSui.capitalPeriods), 'sui: 大兴 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(daxingSui.capitalPeriods), JSON.stringify([[581, 618]]), 'sui: 大兴 capitalPeriods must be [[581, 618]]');

    const luoyangSui = findSt(suiDyn, '东都洛阳');
    assert(luoyangSui && Array.isArray(luoyangSui.capitalPeriods), 'sui: 东都洛阳 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(luoyangSui.capitalPeriods), JSON.stringify([[605, 618]]), 'sui: 东都洛阳 capitalPeriods must be [[605, 618]]');

    const jianglingSui = findSt(suiDyn, '江陵');
    assert(jianglingSui && Array.isArray(jianglingSui.capitalPeriods), 'sui: 江陵 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(jianglingSui.capitalPeriods), JSON.stringify([[581, 587]]), 'sui: 江陵 capitalPeriods must be [[581, 587]]');

    // Sui warlord settlements
    for (const w of ['历阳', '金城', '马邑']) {
      assert(findSt(suiDyn, w), `sui: must include late Sui warlord center ${w}`);
    }

    // Sui 5 map change milestones
    const expectedSuiMapChanges = [581, 587, 589, 609, 618];
    const actualSuiMapChanges = (suiDyn.milestones || []).filter((m) => m.isMapChange).map((m) => m.year);
    assert.strictEqual(
      JSON.stringify(actualSuiMapChanges),
      JSON.stringify(expectedSuiMapChanges),
      'sui: 5 map change milestone years must match'
    );

    // Tang capitals & periods
    const changanTang = findSt(tangDyn, '长安');
    assert(changanTang && Array.isArray(changanTang.capitalPeriods), 'tang: 长安 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(changanTang.capitalPeriods),
      JSON.stringify([[618, 689], [705, 904]]),
      'tang: 长安 capitalPeriods must be [[618, 689], [705, 904]]'
    );

    const luoyangTang = findSt(tangDyn, '东都洛阳');
    assert(luoyangTang && Array.isArray(luoyangTang.capitalPeriods), 'tang: 东都洛阳 must define capitalPeriods');
    assert.strictEqual(
      JSON.stringify(luoyangTang.capitalPeriods),
      JSON.stringify([[690, 704], [904, 907]]),
      'tang: 东都洛阳 capitalPeriods must be [[690, 704], [904, 907]]'
    );

    const taiyuanTang = findSt(tangDyn, '北都太原');
    assert(taiyuanTang && Array.isArray(taiyuanTang.capitalPeriods), 'tang: 北都太原 must define capitalPeriods');
    assert.strictEqual(JSON.stringify(taiyuanTang.capitalPeriods), JSON.stringify([[723, 907]]), 'tang: 北都太原 capitalPeriods must be [[723, 907]]');

    // Tang Six Great Protectorates (六大都护府)
    const sixProtectorates = [
      '安西都护府',
      '北庭都护府',
      '安东都护府',
      '安南都护府',
      '单于大都护府',
      '安北都护府',
    ];
    for (const prot of sixProtectorates) {
      assert(findSt(tangDyn, prot), `tang: must include Six Great Protectorate ${prot}`);
    }

    // Tang warlord settlements
    for (const w of ['洺州', '历阳', '金城']) {
      assert(findSt(tangDyn, w), `tang: must include warlord settlement ${w}`);
    }

    // Tang 29 map change milestones
    const expectedTangMapChanges = [618, 621, 630, 635, 640, 648, 657, 663, 668, 670, 676, 679, 686, 690, 692, 698, 702, 705, 713, 738, 755, 757, 763, 764, 790, 848, 881, 885, 907];
    const actualTangMapChanges = (tangDyn.milestones || []).filter((m) => m.isMapChange).map((m) => m.year);
    assert.strictEqual(
      JSON.stringify(actualTangMapChanges),
      JSON.stringify(expectedTangMapChanges),
      'tang: 29 map change milestone years must match'
    );

    // Spatial checks: s_sui_d and s_tang_0 warlords
    const suiD = snapshots.s_sui_d;
    assert(suiD, 'Missing s_sui_d');
    const findPol = (snap, title) => (snap.polities || []).find((p) => p.title === title);

    const tangInSuiD = findPol(suiD, '唐（李渊）');
    assert(tangInSuiD && pointInShape(108.941, 34.341, tangInSuiD.shape), 's_sui_d: Chang\'an must be inside 唐（李渊）');
    assert(tangInSuiD && pointInShape(112.551, 37.871, tangInSuiD.shape), 's_sui_d: Taiyuan must be inside 唐（李渊）');

    const weiInSuiD = findPol(suiD, '魏（李密）');
    assert(weiInSuiD && pointInShape(112.451, 34.621, weiInSuiD.shape), 's_sui_d: Luoyang must be inside 魏（李密）');

    const liangInSuiD = findPol(suiD, '梁（萧铣）');
    assert(liangInSuiD && pointInShape(112.241, 30.331, liangInSuiD.shape), 's_sui_d: Jiangling must be inside 梁（萧铣）');

    const tang0 = snapshots.s_tang_0;
    assert(tang0, 'Missing s_tang_0');
    const tangPol0 = findPol(tang0, '唐');
    assert(tangPol0 && pointInShape(108.941, 34.341, tangPol0.shape), 's_tang_0: Chang\'an must be inside 唐');

    const zhengInTang0 = findPol(tang0, '郑（王世充）');
    assert(zhengInTang0 && pointInShape(112.451, 34.621, zhengInTang0.shape), 's_tang_0: Luoyang must be inside 郑（王世充）');

    const xiaInTang0 = findPol(tang0, '夏（窦建德）');
    assert(xiaInTang0 && pointInShape(116.12, 38.18, xiaInTang0.shape), 's_tang_0: Letou must be inside 夏（窦建德）');

    const wuInTang0 = findPol(tang0, '吴（杜伏威）');
    assert(wuInTang0 && pointInShape(119.411, 32.391, wuInTang0.shape), 's_tang_0: Jiangdu must be inside 吴（杜伏威）');

    // High Tang s_tang_a5 core cities inside 唐
    const tangA5 = snapshots.s_tang_a5;
    assert(tangA5, 'Missing s_tang_a5');
    const tangPolA5 = findPol(tangA5, '唐');
    assert(tangPolA5, 's_tang_a5 must have 唐 polity');
    for (const [cName, lng, lat] of [
      ['长安', 108.941, 34.341],
      ['洛阳', 112.451, 34.621],
      ['太原', 112.551, 37.871],
      ['成都', 104.071, 30.571],
      ['广州', 113.261, 23.131],
      ['扬州', 119.411, 32.391],
    ]) {
      assert(pointInShape(lng, lat, tangPolA5.shape), `s_tang_a5: ${cName} must be inside 唐`);
    }
  }

  // 23aa. Mountain-range and boundary-river labels (山川形胜): a deliberately small, household-name set
  {
    const ranges = (sandbox.window.HYDRO_DATA.labels || []).filter((lb) => lb.kind === 'range');
    const expectedRanges = [
      '秦岭', '大巴山', '太行山', '燕山', '阴山', '贺兰山', '祁连山', '天山', '昆仑山', '南岭', '武夷山', '大兴安岭',
      '长白山', '岷山', '大别山', '陇山', '巫山', '葱岭', '燕然山',
    ];
    assert.strictEqual(
      JSON.stringify(ranges.map((r) => r.zh).sort()),
      JSON.stringify([...expectedRanges].sort()),
      'HYDRO_DATA.labels must contain exactly the 19 curated mountain-range labels'
    );
    const deserts = (sandbox.window.HYDRO_DATA.labels || []).filter((lb) => lb.kind === 'desert');
    assert.strictEqual(JSON.stringify(deserts.map((d) => d.zh)), JSON.stringify(['大 漠']), 'Exactly one Gobi watermark label');
    const pamirs = ranges.find((r) => r.zh === '葱岭');
    assert.strictEqual(ctrl._hydroLabelPair(pamirs, 640).zh, '葱岭', 'Pamirs in 640 CE must read 葱岭');
    assert.strictEqual(ctrl._hydroLabelPair(pamirs, 1800).zh, '帕米尔', 'Pamirs in 1800 CE must read 帕米尔');
    for (const r of ranges) {
      assert(
        typeof r.en === 'string' && r.en.length > 0 && !/[\u4e00-\u9fa5]/.test(r.en),
        `Mountain range ${r.zh} must have a clean English name, got ${JSON.stringify(r.en)}`
      );
      assert(
        Array.isArray(r.coord) && r.coord[0] > 73 && r.coord[0] < 135 && r.coord[1] > 18 && r.coord[1] < 54,
        `Mountain range ${r.zh} label coord must sit inside China, got ${JSON.stringify(r.coord)}`
      );
      assert(Math.abs(r.rot || 0) <= 90, `Mountain range ${r.zh} rotation must stay readable (|rot| <= 90)`);
    }
    const detailRivers = (sandbox.window.HYDRO_DATA.labels || []).filter((lb) => lb.kind === 'river' && lb.tier >= 1);
    assert.strictEqual(
      JSON.stringify(detailRivers.map((lb) => lb.zh).sort()),
      JSON.stringify(['鸭绿江', '大同江', '大渡河', '金沙江', '澜沧江', '怒江'].sort()),
      'Zoom-gated boundary rivers must stay limited to the 6 classic frontier rivers'
    );
    for (const lb of detailRivers) {
      for (const en of lb.eraNames || []) {
        assert(!/[（(]/.test(en.zh), `Boundary river era name must be a single short name, got ${en.zh}`);
      }
    }
    const yaluLabel = detailRivers.find((lb) => lb.zh === '鸭绿江');
    assert.strictEqual(ctrl._hydroLabelPair(yaluLabel, -100).zh, '马訾水', 'Yalu in 100 BCE must resolve to 马訾水');
    assert.strictEqual(ctrl._hydroLabelPair(yaluLabel, 668).zh, '鸭绿水', 'Yalu in 668 CE must resolve to 鸭绿水');
    assert.strictEqual(ctrl._hydroLabelPair(yaluLabel, 1400).zh, '鸭绿江', 'Yalu in 1400 CE must resolve to 鸭绿江');
  }

  // 23ab. Ming capitals, Later Jin capitals, and map-change milestones (History of Ming / Ming Shilu)
  {
    const mingD = dynasties.find((d) => d.key === 'ming');
    const mingSt = (name) => (mingD.settlements || []).find((s) => s.ancient === name);
    const capCases = [
      ['应天府', [[1368, 1420]]],
      ['顺天府', [[1421, 1644]]],
      ['赫图阿拉', [[1616, 1621]]],
      ['辽阳', [[1621, 1625]]],
      ['沈阳', [[1625, 1644]]],
    ];
    for (const [name, periods] of capCases) {
      const st = mingSt(name);
      assert(st && st.isCapital, `ming: ${name} must be marked as a capital`);
      assert.strictEqual(JSON.stringify(st.capitalPeriods), JSON.stringify(periods), `ming: ${name} capitalPeriods must be ${JSON.stringify(periods)}`);
    }
    assert(mingSt('辽阳').vanish === undefined, 'ming: 辽阳 must not vanish in 1621 (it became the Later Jin Eastern Capital)');
    assert.strictEqual(ctrl._isSettlementCapital(mingSt('应天府'), 1400), true, 'Nanjing must be the Ming capital in 1400');
    assert.strictEqual(ctrl._isSettlementCapital(mingSt('顺天府'), 1400), false, 'Beijing must not be the Ming capital before 1421');

    const mcYears = (mingD.milestones || []).filter((m) => m.isMapChange).map((m) => m.year);
    assert.strictEqual(
      JSON.stringify(mcYears),
      JSON.stringify([1368, 1369, 1371, 1382, 1388, 1407, 1427, 1449, 1513, 1616, 1636, 1643]),
      'ming: map-change milestones must match the phase transitions'
    );

    assert.strictEqual(ctrl._resolveSnapKey(mingD, 1480), 's_ming_b0', 'Ming at 1480 CE must resolve to s_ming_b0');
    if (!FAST_MODE) {
      // Liaodong was Ming from 1371 (Dingliao Garrison at Liaoyang); Naghachu held only Jinshan to the north.
      for (const sk of ['s_ming_0c', 's_ming_0d']) {
        const ming = snapshots[sk].polities.find((p) => p.title === '明');
        const yuan = snapshots[sk].polities.find((p) => p.title === '北元');
        for (const [name, x, y] of [['辽阳', 123.171, 41.271], ['沈阳', 123.431, 41.801], ['广宁', 121.8, 41.6]]) {
          assert(pointInShape(x, y, ming.shape) && !pointInShape(x, y, yuan.shape), `${sk}: ${name} must be inside 明, not 北元`);
        }
        assert(pointInShape(124.03, 42.55, yuan.shape), `${sk}: Kaiyuan ([124.03, 42.55]) north of Ming Liaodong must stay 北元`);
      }
      // Hami Guard survives until Turpan takes it in 1513.
      const hamiAt = (year) => {
        const sk = ctrl._resolveSnapKey(mingD, year);
        return snapshots[sk].polities.filter((p) => pointInShape(93.511, 42.821, p.shape) && p.role !== 'neighbor').map((p) => p.title);
      };
      assert.strictEqual(JSON.stringify(hamiAt(1480)), JSON.stringify(['哈密卫（关西七卫）']), 'Hami must be under 哈密卫 in 1480');
      assert.strictEqual(JSON.stringify(hamiAt(1550)), '[]', 'Hami must no longer be a Ming guard in 1550');
    }
    assert(
      !(mingD.milestones || []).find((m) => m.year === 1388).headline.includes('收辽东'),
      'ming 1388: Liaodong was already Ming from 1371; 1387 was the surrender of Naghachu at Jinshan'
    );
    assert(
      !(mingD.milestones || []).find((m) => m.year === 1627).headline.includes('李自成'),
      'ming 1627: Li Zicheng only joined the rebels in 1629-1630'
    );
  }

  // 23ac. Qing snapshots, milestones, and settlements (Draft History of Qing)
  {
    const qingD = dynasties.find((d) => d.key === 'qing');
    assert(qingD, 'qing dynasty definition must exist');

    // s_qing_a1 must have valid caption and note (never undefined)
    assert(
      snapshots.s_qing_a1 && snapshots.s_qing_a1.caption && snapshots.s_qing_a1.note,
      's_qing_a1 must have defined caption and note'
    );
    assert(
      snapshots.s_qing_a1.caption.startsWith('1662'),
      's_qing_a1 caption must start at 1662 (after execution of Yongli Emperor)'
    );
    assert(
      snapshots.s_qing_a && snapshots.s_qing_a.caption.startsWith('1673'),
      's_qing_a caption must start at 1673 (Revolt of Three Feudatories), not 1661'
    );
    assert(
      snapshots.s_qing_f0 && snapshots.s_qing_f0.caption.includes('1864 — 1881'),
      's_qing_f0 caption must cover 1864 — 1881'
    );
    assert(
      snapshots.s_qing_g0 && snapshots.s_qing_g0.caption.includes('1895 — 1898'),
      's_qing_g0 caption must cover 1895 — 1898'
    );

    // All phase transition milestones must have isMapChange === true
    const expectedMapChangeYears = [
      1644, 1645, 1661, 1662, 1673, 1681, 1683, 1691, 1720, 1759, 1796, 1851, 1858, 1860, 1864, 1881, 1895, 1898,
    ];
    const actualMapChangeYears = (qingD.milestones || [])
      .filter((m) => m.isMapChange)
      .map((m) => m.year);
    assert.strictEqual(
      JSON.stringify(actualMapChangeYears),
      JSON.stringify(expectedMapChangeYears),
      'qing: all 18 phase transition milestones must have isMapChange === true'
    );

    // Yanping Fu must be centered at Nanping (not Sanming)
    const qingSt = (name) => (qingD.settlements || []).find((s) => s.ancient === name);
    const yanping = qingSt('延平府');
    assert(yanping && yanping.modern.includes('南平'), 'qing: 延平府 must be centered at Nanping');
    assert(Math.abs(yanping.coord[0] - 118.18) < 0.1 && Math.abs(yanping.coord[1] - 26.64) < 0.1, 'qing: 延平府 coords near Nanping');

    // Key seats and treaty ports
    const kashgar = qingSt('喀什噶尔');
    assert(kashgar && kashgar.appear === 1759, 'qing: 喀什噶尔 must exist from 1759');
    assert.strictEqual(ctrl.inspect({ year: 1800, place: '喀什噶尔' }).polity, '清', 'qing: 喀什噶尔 must resolve to polity 清 in 1800');
    assert.strictEqual(ctrl.inspect({ year: 1885, place: '霍尔果斯' }).polity, '清', 'qing: 霍尔果斯 must resolve to polity 清 in 1885');
    assert.strictEqual(ctrl.inspect({ year: 1870, place: '瑷珲' }).polity, '清', 'qing: 瑷珲 must resolve to polity 清 in 1870');
    assert.strictEqual(ctrl.inspect({ year: 1800, place: '雷州府' }).polity, '清', 'qing: 雷州府 must resolve to polity 清 in 1800');
    assert.strictEqual(ctrl.inspect({ year: 1800, place: '辑安（国内城）' }).polity, '清', 'qing: 辑安（国内城） must resolve to polity 清 in 1800');

    for (const [name, expAppear] of [
      ['吐鲁番', 1759],
      ['安西州', 1759],
      ['阿克苏', 1759],
      ['和阗', 1759],
      ['库车', 1759],
      ['黑城', 1759],
      ['山南', 1720],
      ['噶尔', 1720],
    ]) {
      const st = qingSt(name);
      assert(st && st.appear === expAppear, `qing: ${name} must have appear === ${expAppear}`);
    }

    const taipei = qingSt('台北府');
    assert(taipei && taipei.appear === 1875 && taipei.vanish === 1895, 'qing: 台北府 must exist 1875-1895');

    const qiqi = qingSt('齐齐哈尔');
    assert(qiqi && qiqi.appear === 1699, 'qing: 齐齐哈尔 must exist from 1699');

    const shanghai = qingSt('上海');
    assert(shanghai && shanghai.appear === 1843, 'qing: 上海 must exist from 1843');

    const tianjin = qingSt('天津府');
    assert(tianjin && tianjin.appear === 1725, 'qing: 天津府 must exist from 1725');
  }

  // CUJ 26: Security (Reflected XSS Sanitization), EN inspect(), Person inspect(), Autoplay Mutual Exclusion & IME Guards
  {
    ctrl.locale = 'en';
    const enInsp = ctrl.inspect({ year: 819, place: 'Lantian Pass' });
    assert.strictEqual(enInsp.dynasty.title, 'Tang');
    assert.strictEqual(enInsp.polity, 'Tang');
    assert(enInsp.regions.includes('Guannei Circuit'));
    assert.strictEqual(enInsp.modernProvince, 'Shaanxi');
    assert(enInsp.url.includes('lang=en'));

    const personInsp = ctrl.inspect({ person: 'sushi', stop: 2 });
    assert(
      personInsp.person &&
        personInsp.person.key === 'sushi' &&
        personInsp.person.totalEvents >= 10 &&
        personInsp.person.events[2].site === 'Dongjing Kaifeng' &&
        personInsp.url.includes('person=sushi') &&
        personInsp.url.includes('stop=2'),
      `Expected English inspect({ person: 'sushi', stop: 2 }) to return localized person events, got ${JSON.stringify(personInsp.person)}`
    );
    ctrl.locale = 'zh';

    const xssInspect = ctrl.inspect({
      year: 741,
      place: '长安<img src=x onerror=alert(1)>,洛阳',
    });
    assert(
      xssInspect.route &&
        xssInspect.route.length === 2 &&
        !xssInspect.place.includes('<') &&
        !xssInspect.route[0].place.includes('<'),
      `Expected XSS angle brackets to be stripped from route place tokens, got ${JSON.stringify(xssInspect.place)}`
    );

    // Late Eastern Han & Three Kingdoms (Sanguozhi) territorial & capitalPeriods regression guards
    const sanguoSpotChecks = [
      [{ lng: 118.801, lat: 32.061, year: 229 }, '吴'], // Jianye
      [{ lng: 119.451, lat: 32.201, year: 229 }, '吴'], // Jingkou
      [{ lng: 112.121, lat: 32.011, year: 208 }, '曹操(北方)'], // Xiangyang post-208
      [{ lng: 112.121, lat: 32.011, year: 229 }, '魏'], // Xiangyang in Three Kingdoms
      [{ lng: 123.171, lat: 41.271, year: 196 }, '公孙氏(辽东)'], // Xiangping (Liaodong)
      [{ lng: 113.261, lat: 23.131, year: 200 }, '士燮(交州)'], // Panyu (Jiaozhou) 189-210
      [{ lng: 113.261, lat: 23.131, year: 211 }, '孙权(江东)'], // Panyu submits to Sun Quan 211
      [{ lng: 103.82, lat: 36.06, year: 208 }, '马腾·韩遂(关陇)'], // Guanlong before Tong Pass
      [{ lng: 103.82, lat: 36.06, year: 211 }, '曹操(北方)'], // Guanlong after Tong Pass (211)
      [{ lng: 107.021, lat: 33.071, year: 200 }, '张鲁(汉中)'], // Nanzheng (Hanzhong) 196-214
      [{ lng: 107.021, lat: 33.071, year: 215 }, '曹操(北方)'], // Hanzhong taken by Cao Cao (215)
      [{ lng: 107.021, lat: 33.071, year: 219 }, '刘备(益州)'], // Hanzhong taken by Liu Bei (219)
      [{ lng: 111.698, lat: 29.032, year: 215 }, '刘备(荆益)'], // Wuling west of Xiang River (215)
      [{ lng: 112.941, lat: 28.231, year: 215 }, '孙权(江东)'], // Changsha east of Xiang River (215)
    ];
    for (const [opts, expPol] of sanguoSpotChecks) {
      const info = ctrl.inspect(opts);
      assert(
        info && info.polity === expPol,
        `Sanguozhi guard: inspect(${JSON.stringify(opts)}) expected polity "${expPol}", got ${JSON.stringify(info && info.polity)}`
      );
    }
    const dhDyn = dynasties.find((d) => d.key === 'donghan');
    const sgDyn = dynasties.find((d) => d.key === 'sanguo');
    const dhLuoyang = dhDyn.settlements.find((s) => s.ancient === '洛阳');
    const dhChangan = dhDyn.settlements.find((s) => s.ancient === '长安');
    const dhXu = dhDyn.settlements.find((s) => s.ancient === '许');
    assert(
      ctrl._isSettlementCapital(dhLuoyang, 100) &&
        !ctrl._isSettlementCapital(dhLuoyang, 196) &&
        ctrl._isSettlementCapital(dhChangan, 192) &&
        ctrl._isSettlementCapital(dhXu, 200),
      'Expected donghan capitalPeriods to switch Luoyang (25-189) -> Chang\'an (190-195) -> Xu (196-220)'
    );
    const sgChengdu = sgDyn.settlements.find((s) => s.ancient === '成都');
    const sgWuchang = sgDyn.settlements.find((s) => s.ancient === '武昌');
    const sgJianye = sgDyn.settlements.find((s) => s.ancient === '建业');
    assert(
      ctrl._isSettlementCapital(sgChengdu, 234) &&
        !ctrl._isSettlementCapital(sgChengdu, 265) &&
        ctrl._isSettlementCapital(sgWuchang, 225) &&
        !ctrl._isSettlementCapital(sgWuchang, 234) &&
        ctrl._isSettlementCapital(sgJianye, 234),
      'Expected sanguo capitalPeriods to reflect Chengdu (221-263), Wuchang (221-228, 265-266), and Jianye (229-280)'
    );

    sandbox.setInterval = setInterval;
    sandbox.clearInterval = clearInterval;
    delete ctrl.stopAutoplay;
    ctrl.activePerson = {
      profile: ctrl._resolvePersonProfile('sushi'),
      events: ctrl._collectPersonEvents(ctrl._resolvePersonProfile('sushi')),
    };
    ctrl.activePersonEventIdx = 0;
    ctrl.selectPersonEvent = () => {};
    ctrl.jumpToYear = () => {};
    ctrl.closeMilestoneBalloon = () => {};
    ctrl._syncAutoMilestoneBalloon = () => {};
    ctrl.togglePersonAutoplay();
    assert(ctrl.personTimer !== null && !ctrl.playing, 'Expected personTimer to start without timeline playing');
    ctrl.startAutoplay();
    assert(
      ctrl.playing && ctrl.personTimer === null,
      'Expected startAutoplay() to clear personTimer so both timers never run simultaneously'
    );
    ctrl.stopAutoplay();
    assert(!ctrl.playing && ctrl.personTimer === null, 'Expected stopAutoplay() to clear both timers');
    ctrl.activePerson = null;

    assert(
      !fs.existsSync(path.join(ROOT, '.github', 'workflows', 'validate.yml')),
      'Duplicate validate.yml workflow must not exist'
    );
    assert(
      appCode.includes('e.isComposing || e.keyCode === 229'),
      'js/app.js keydown handlers must guard against IME composition events'
    );
  }

  // CUJ 27: Era labels in periods of co-existing regimes — Zizhi Tongjian reference track + regional tracks by location
  {
    ctrl.locale = 'zh';
    const dynByKey = (k) => dynasties.find((d) => d.key === k);
    const dynOf = (y) => dynasties[ctrl._findDynastyIndex(y)];
    const milestoneOf = (k, y, kw) => {
      const m = dynByKey(k).milestones.find((x) => x.year === y && x.headline.includes(kw));
      assert(m, `Missing ${k} milestone ${y} "${kw}"`);
      return m;
    };
    const nanbei = dynByKey('nanbei');

    for (let y = nanbei.fromYear; y < nanbei.toYear; y++) {
      const sp = ctrl._resolveEraSpan(y, nanbei);
      assert(sp[1].startsWith('南朝'), `Reference era for ${y} must follow the Southern Dynasties, got ${sp[1]}`);
    }
    assert.strictEqual(ctrl.formatEraLabel(479, nanbei), '南朝齐高帝·建元元年');
    assert.strictEqual(ctrl.formatEraLabel(523, nanbei), '南朝梁武帝·普通四年');

    const snapPolityTitles = new Set();
    for (const s of Object.values(snapshots)) for (const p of (s && s.polities) || []) snapPolityTitles.add(p.title);
    const regimes = new Set();
    for (const t of loreData.REGIONAL_ERA_TRACKS) {
      regimes.add(t.regime);
      assert(t.polities.length && t.spans.length && t.until >= t.spans[0][0], `Malformed era track ${t.regime}`);
      for (const title of t.polities) {
        assert(snapPolityTitles.has(title), `Era track ${t.regime} polity "${title}" matches no snapshot polity`);
      }
      t.spans.forEach((sp, i) => {
        assert(i === 0 || sp[0] >= t.spans[i - 1][0], `Era track ${t.regime} must be sorted at ${sp[1]}`);
        assert(sp[0] <= t.until && typeof sp[4] === 'string' && sp[4].length >= 3, `Bad span ${JSON.stringify(sp)}`);
      });
      for (let y = t.spans[0][0]; y <= t.until; y++) {
        const lbl = ctrl.formatEraLabel(y, dynOf(y), null, t.regime);
        assert(/年$/.test(lbl) && !/undefined|NaN|·年/.test(lbl), `Bad ${t.regime} era label for ${y}: ${lbl}`);
      }
    }

    for (const d of dynasties) {
      for (const m of d.milestones || []) {
        if (m.eraRegime !== undefined) {
          assert(m.eraRegime === 'reference' || regimes.has(m.eraRegime), `Unknown eraRegime "${m.eraRegime}" on ${d.key} ${m.year}`);
        }
      }
    }

    for (const [k, y, kw, expected] of [
      ['nanbei', 523, '六镇之乱', '北魏孝明帝·正光四年'],
      ['sanguo', 221, '刘备在成都称帝', '蜀汉昭烈帝·章武元年'],
      ['sanguo', 222, '夷陵之战', '吴大帝·黄武元年'],
      ['nanbei', 479, '萧道成', '南朝齐高帝·建元元年'],
      ['nanbei', 553, '尉迟迥', '西魏废帝二年'],
      ['nanbei', 546, '玉壁之战', '西魏文帝·大统十二年'],
      ['wudai', 916, '耶律阿保机', '辽太祖·神册元年'],
      ['beisong', 1038, '元昊', '西夏景宗·天授礼法延祚元年'],
      ['beisong', 1115, '完颜阿骨打', '金太祖·收国元年'],
      ['beisong', 1104, '河湟开边', '北宋徽宗·崇宁三年'],
      ['nansong', 1127, '赵构即位', '南宋高宗·建炎元年'],
      ['nansong', 1141, '绍兴和议', '南宋高宗·绍兴十一年'],
      ['nansong', 1275, '马可·波罗', '元世祖·至元十二年'],
    ]) {
      assert.strictEqual(ctrl._eventEraLabel(dynByKey(k), milestoneOf(k, y, kw)), expected, `${k} ${y} ${kw}`);
    }

    // Quick search reaches regional-track eras; a bare regime name lists no era rows.
    for (const [q, year, titleKw] of [
      ['太和十八年', 494, '北魏孝文帝'],
      ['正光四年', 523, '北魏孝明帝'],
      ['章武元年', 221, '蜀汉昭烈帝'],
      ['统和二十五年', 1007, '辽圣宗'],
      ['天授礼法延祚元年', 1038, '西夏景宗'],
      ['西魏废帝二年', 553, '西魏废帝'],
      ['普通四年', 523, '南朝梁武帝'],
    ]) {
      const hit = ctrl._queryQuickSearch(q).find((h) => h.kind === 'era');
      assert(hit && hit.year === year && hit.titleZh.includes(titleKw), `Era search "${q}" got ${hit && hit.titleZh}`);
    }
    assert.strictEqual(
      ctrl._queryQuickSearch('太建五年').filter((h) => h.kind === 'era').length,
      1,
      'An era shared by the reference and a regional track must be listed once'
    );
    for (const q of ['北魏', '金', '南宋', 'liao']) {
      assert(!ctrl._queryQuickSearch(q).some((h) => h.kind === 'era'), `Bare regime "${q}" must not list era rows`);
    }

    const frontier = loreData.PLACE_LANDMARK_EVENTS.find((lm) => lm.year === 523 && (lm.zh || '').includes('六镇乱起'));
    assert(frontier, 'Missing 523 Six Garrisons landmark event');
    assert.strictEqual(ctrl.formatEraLabel(523, nanbei, frontier.coord), '北魏孝明帝·正光四年');
    assert.strictEqual(ctrl.inspect({ year: 523, lng: 109.5, lat: 40.95 }).era, '北魏孝明帝·正光四年');

    ctrl.locale = 'en';
    assert(
      ctrl.formatEraLabel(523, nanbei, [109.5, 40.95]).endsWith('Emp. Xiaoming of N. Wei'),
      'English era label must name the regime ruling the location'
    );
    ctrl.locale = 'zh';
  }

  // CUJ 28: Timeline autoplay is event-driven — the playhead lands only on event nodes
  // (milestone years + territory-snapshot boundaries), never on empty calendar years, dwells
  // one beat on ordinary events and longer on map-changing nodes, and keeps the event callout.
  {
    const proto = ControllerClass.prototype;
    let tick = null;
    sandbox.setInterval = (fn) => {
      tick = fn;
      return 1;
    };
    sandbox.clearInterval = () => {};
    delete ctrl.stopAutoplay;
    Object.assign(ctrl, { activePerson: null, challenge: null, personTimer: null });
    ctrl.closeMilestoneBalloon = () => {};
    ctrl._syncAutoMilestoneBalloon = () => {};
    const visited = [];
    ctrl.jumpToYear = function (y) {
      this.year = y;
      this.dynastyIdx = this._findDynastyIndex(y);
      visited.push(y);
    };
    ctrl.year = ctrl.minYear;
    ctrl.startAutoplay();
    const stops = proto._autoplayStops.call(ctrl).filter((s) => s.year > ctrl.minYear);
    const stopYears = new Set(stops.map((s) => s.year));
    const yearTicks = new Map();
    let totalTicks = 0;
    while (ctrl.playing && totalTicks < 20000) {
      tick();
      totalTicks++;
      yearTicks.set(ctrl.year, (yearTicks.get(ctrl.year) || 0) + 1);
    }
    assert(!ctrl.playing && ctrl.year === ctrl.maxYear, `Autoplay must stop at ${ctrl.maxYear}, got ${ctrl.year}`);

    const missed = stops.filter((s) => !visited.includes(s.year)).map((s) => s.year);
    assert.strictEqual(missed.length, 0, `Autoplay skipped event nodes ${missed.slice(0, 8).join(', ')}`);
    const strays = visited.filter((y) => !stopYears.has(y) && y !== ctrl.maxYear);
    assert.strictEqual(strays.length, 0, `Autoplay must jump node-to-node, but landed on empty years ${strays.slice(0, 8).join(', ')}`);
    for (const s of stops) {
      const dwell = yearTicks.get(s.year) || 0;
      if (s.hold) assert(dwell >= 10, `Autoplay must hold ~2.8 s on map-changing node ${s.year}, got ${dwell} ticks`);
      else assert(dwell >= 4, `Autoplay must show ordinary event ${s.year} for ~1.1 s, got ${dwell} ticks`);
    }
    for (const y of [-221, 755, 1127]) {
      assert(stops.some((s) => s.year === y && s.hold), `Autoplay must hold on the border change in ${y}`);
    }
    // Snapshot boundaries without a same-year milestone are still nodes (Shang Yang's Hexi, Sui collapse, Huang Chao).
    for (const y of [-340, 614, 880]) {
      assert(stops.some((s) => s.year === y && s.hold), `Autoplay must land and hold on the territory-snapshot boundary ${y}`);
    }
    const holdCount = stops.filter((s) => s.hold).length;
    assert(holdCount >= 180 && holdCount < stops.length, `Expected ~180+ map-changing nodes among ${stops.length}, got ${holdCount}`);
    const runMin = (totalTicks * 280) / 60000;
    assert(runMin > 12 && runMin < 16, `A 1× full run should take ~14 min (≈190 map nodes × 2.8 s + ≈290 events × 1.1 s), got ${runMin.toFixed(1)} min`);

    const tang = dynasties.find((d) => d.key === 'tang');
    Object.assign(ctrl, {
      playing: true,
      year: 755,
      dynastyIdx: dynasties.indexOf(tang),
      activeMilestone: null,
      dismissedCalloutIds: new Set(),
      milestoneBalloon: {
        innerHTML: '',
        classList: { remove() {}, add() {}, contains: () => false },
        querySelector: () => null,
      },
      grpMilestones: { querySelectorAll: () => [], classList: { contains: () => false } },
      _positionMilestoneBalloon: () => {},
      _highlightCurrentMilestone: () => {},
    });
    proto._syncAutoMilestoneBalloon.call(ctrl, tang);
    assert(
      ctrl.activeMilestone && ctrl.activeMilestone.isAuto && ctrl.activeMilestone.milestone.year === 755,
      'The event callout must follow the current milestone while autoplay runs'
    );
    ctrl.milestoneBalloon.innerHTML = 'unchanged';
    proto._syncAutoMilestoneBalloon.call(ctrl, tang);
    assert.strictEqual(ctrl.milestoneBalloon.innerHTML, 'unchanged', 'An auto callout already showing the milestone must not be rebuilt');
    ctrl.locale = 'en';
    proto._syncAutoMilestoneBalloon.call(ctrl, tang);
    assert.notStrictEqual(ctrl.milestoneBalloon.innerHTML, 'unchanged', 'A locale switch must rebuild the auto callout');
    Object.assign(ctrl, { locale: 'zh', playing: false, activeMilestone: null });
  }

  // CUJ 29: Scrubber drag — pointermove bursts coalesce via requestAnimationFrame, unchanged
  // years are skipped, pointerup flushes a pending frame, and pointercancel drops it.
  {
    const proto = ControllerClass.prototype;
    let rafFn = null;
    let rafSeq = 0;
    const cancelled = new Set();
    sandbox.requestAnimationFrame = (fn) => {
      rafFn = fn;
      return ++rafSeq;
    };
    sandbox.cancelAnimationFrame = (id) => {
      cancelled.add(id);
      rafFn = null;
    };
    const flushRaf = () => {
      const fn = rafFn;
      rafFn = null;
      if (fn) fn();
    };
    const handlers = {};
    let rectReads = 0;
    const track = {
      addEventListener(type, fn) {
        handlers[type] = fn;
      },
      setPointerCapture() {},
      getBoundingClientRect() {
        rectReads++;
        return { left: 0, width: 1000 };
      },
    };
    const jumps = [];
    Object.assign(ctrl, {
      challenge: null,
      year: ctrl.minYear,
      _recordGestureClick: () => {},
      stopAutoplay: () => {},
      _clearQuickSearchInput: () => {},
      jumpToYear(y) {
        this.year = y;
        jumps.push(y);
      },
    });
    proto._bindScrubberDrag.call(ctrl, track);

    // 1. pointerdown always jumps (even if already on that year); same year on pointermove is skipped.
    handlers.pointerdown({ pointerId: 1, clientX: 500 });
    assert.strictEqual(jumps.length, 1, 'pointerdown must jump immediately');
    handlers.pointerdown({ pointerId: 1, clientX: 500 });
    assert.strictEqual(jumps.length, 2, 'pointerdown on the current year must still run jumpToYear');
    const y500 = ctrl.year;
    handlers.pointermove({ clientX: 500 });
    flushRaf();
    assert.strictEqual(jumps.length, 2, 'Unchanged year on pointermove must not re-run jumpToYear');

    // 2. Burst of 8 pointermoves within one animation frame produces at most 1 jumpToYear.
    for (const x of [510, 520, 530, 540, 550, 560, 570, 600]) {
      handlers.pointermove({ clientX: x });
    }
    assert.strictEqual(jumps.length, 2, 'pointermove must defer to requestAnimationFrame');
    flushRaf();
    assert.strictEqual(jumps.length, 3, 'A burst of pointermoves in one frame must run jumpToYear once');
    assert.strictEqual(ctrl.year, ctrl._progressToYear(0.6), 'Coalesced frame must land on the latest pointer X');
    assert.strictEqual(rectReads, 2, 'Track bounding rect must be cached across each drag gesture');

    // 3. pointerup flushes an un-rendered pointermove synchronously and cancels its rAF.
    handlers.pointermove({ clientX: 800 });
    const pendingId = rafSeq;
    handlers.pointerup({});
    assert(cancelled.has(pendingId) && rafFn === null, 'pointerup must cancel the pending rAF');
    assert.strictEqual(ctrl.year, ctrl._progressToYear(0.8), 'pointerup must flush the final pointer position');
    assert.notStrictEqual(y500, ctrl.year);

    // 4. pointercancel drops a pending move without jumping.
    handlers.pointerdown({ pointerId: 2, clientX: 200 });
    const y200 = ctrl.year;
    handlers.pointermove({ clientX: 900 });
    handlers.pointercancel({});
    flushRaf();
    assert.strictEqual(ctrl.year, y200, 'pointercancel must discard any un-flushed move');
  }

  // CUJ 29b: Timeline edge crop-zoom — iPhone Photos style edge trim, year clamping, double-tap/double-click reset, and year-jump follow.
  {
    const makeNode = () => {
      const classes = new Set();
      return {
        style: { setProperty() {} }, attributes: {}, handlers: {}, textContent: '',
        classList: {
          add: (name) => classes.add(name),
          remove: (name) => classes.delete(name),
          contains: (name) => classes.has(name),
          toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
        },
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(type, fn) { this.handlers[type] = fn; },
        getBoundingClientRect: () => ({ left: 0, width: 1000 }),
        setPointerCapture() {}, focus() {},
        closest: () => null,
      };
    };
    const nodes = Object.fromEntries([
      'scrubber-rail-wrap', 'timeline-start', 'timeline-end',
      'timeline-crop-mask-left', 'timeline-crop-mask-right',
      'scrubber-viewport', 'scrubber-content',
      'scrubber-Bubble', 'bubble-text', 'scrubber-motion', 'scrubber-track',
      'inp-year', 'dynasty-bands',
    ].map((id) => [id, makeNode()]));
    for (const part of ['start', 'end']) {
      const node = nodes[`timeline-${part}`];
      node.dataset = { timelinePart: part };
      node.closest = () => node;
    }
    const viewport = nodes['scrubber-viewport'];
    viewport.clientWidth = 1000;
    viewport.scrollLeft = 0;
    const content = nodes['scrubber-content'];
    Object.defineProperty(content, 'clientWidth', {
      get: () => viewport.clientWidth * (parseFloat(content.style.width) || 100) / 100,
    });
    nodes['dynasty-bands'].children = ctrl.dynasties.map(makeNode);
    const navCtrl = Object.assign(Object.create(ControllerClass.prototype), {
      dynasties: ctrl.dynasties, minYear: ctrl.minYear, maxYear: ctrl.maxYear,
      year: 755, locale: 'zh',
      _id: (id) => nodes[id] || null,
      _zh: (text) => text,
      _fitBandLabels() {},
      _estimateLocalTextWidth: () => 100,
      formatEraLabel: () => '测试年号',
      stopAutoplay() {},
      _scheduleUrlSync() {},
      _runWithDeferredTypography() {},
      _syncAutoMilestoneBalloon() {},
    });
    navCtrl.dynastyIdx = navCtrl._findDynastyIndex(755);
    navCtrl._initTimelineBands();
    navCtrl._bindScrubberNavigator();
    navCtrl._syncScrubberUi();

    const emit = (type, part, x, pointerId = 1) => {
      const el = nodes[`timeline-${part}`];
      el.handlers[type]({
        button: 0, pointerId, clientX: x, target: el,
        preventDefault() {}, stopPropagation() {},
      });
    };
    const drag = (part, from, to) => {
      emit('pointerdown', part, from);
      emit('pointermove', part, to);
      emit('pointerup', part, to);
    };
    const checkView = (start, end, message) => {
      assert(Math.abs(navCtrl._scrubberView.start - start) < 1e-4, `${message}: start (${navCtrl._scrubberView.start} vs ${start})`);
      assert(Math.abs(navCtrl._scrubberView.end - end) < 1e-4, `${message}: end (${navCtrl._scrubberView.end} vs ${end})`);
    };
    const key = (part, value) => {
      let stopped = false;
      nodes[`timeline-${part}`].handlers.keydown({
        target: nodes[`timeline-${part}`], key: value, preventDefault() {},
        stopPropagation() { stopped = true; },
      });
      assert(stopped, 'Edge handle keys must not reach global year/camera shortcuts');
    };

    // 1. Progressive inward edge crop-and-zoom (iPhone Photos style)
    drag('end', 1000, 800);
    checkView(0, 0.8, 'Right edge inward crop zooms to [0, 0.8]');
    // Second drag on left edge trims relative to current [0, 0.8] span (25% of 0.8 = 0.2)
    drag('start', 0, 250);
    checkView(0.2, 0.8, 'Left edge inward crop zooms to [0.2, 0.8]');
    assert(parseFloat(content.style.width) > 160, 'Zoom must expand the main rail');

    // 2. Cropping past current year clamps playhead to cropped edge without centering jump
    navCtrl._setScrubberView(0, 1);
    navCtrl.jumpToYear(150);
    drag('start', 0, 600);
    assert(navCtrl.year >= navCtrl._progressToYear(0.6) - 1, 'Left crop past current year must advance playhead to left boundary');
    assert(Math.abs(navCtrl._yearToProgress(navCtrl.year) - navCtrl._scrubberView.start) < 0.005, 'Playhead must stay at left edge after left crop');

    navCtrl._setScrubberView(0, 1);
    navCtrl.jumpToYear(1900);
    drag('end', 1000, 500);
    assert(navCtrl.year <= navCtrl._progressToYear(0.5) + 1, 'Right crop past current year must clamp playhead to right boundary');
    assert(Math.abs(navCtrl._yearToProgress(navCtrl.year) - navCtrl._scrubberView.end) < 0.005, 'Playhead must stay at right edge after right crop');

    // 3. Double-click resets full 1× timeline
    nodes['scrubber-rail-wrap'].handlers.dblclick();
    checkView(0, 1, 'Double-click on timeline restores full 1× overview');
    assert.strictEqual(content.style.width, '', 'Overview restores original rail width');
    assert.strictEqual(viewport.scrollLeft, 0, 'Overview resets horizontal scroll');

    // 4. Keyboard resize & Enter reset
    key('end', 'ArrowLeft');
    checkView(0, 0.96, 'Keyboard edge resize');
    key('end', 'Enter');
    checkView(0, 1, 'Keyboard Enter restores overview');

    // 5. Year jump reveals target year and keeps bubble visible at all times
    navCtrl._setScrubberView(0, 0.25);
    assert.strictEqual(nodes['scrubber-Bubble'].style.visibility, '', 'Year bubble remains visible even when playhead is outside view');
    navCtrl.jumpToYear(1415);
    const p1415 = navCtrl._yearToProgress(1415);
    checkView(p1415 - 0.125, p1415 + 0.125, 'A year jump brings the target into view without changing scale');

    // 6. Native horizontal scroll & challenge lock
    viewport.scrollLeft = content.clientWidth * 0.1;
    viewport.handlers.scroll();
    checkView(0.1, 0.35, 'Native horizontal scrolling updates visible window');
    navCtrl.challenge = {};
    nodes['scrubber-rail-wrap'].handlers.dblclick();
    checkView(0.1, 0.35, 'Challenge mode locks timeline zoom reset');
    navCtrl.challenge = null;

    const embedCtrl = Object.assign(Object.create(ControllerClass.prototype), { embed: true });
    embedCtrl._bindScrubberNavigator();
    assert.strictEqual(embedCtrl._scrubberView, undefined, 'Embeds do not bind timeline edge zoom');
    console.log('  [timeline edge zoom] iPhone Photos style crop-to-zoom, playhead boundary clamp, double-tap/dblclick reset, keyboard & scroll verified');
  }

  // CUJ 30: Layered top-down overlay dismissal (_dismissTopOverlay) & custom-route + stop-genealogy teardown.
  {
    const proto = ControllerClass.prototype;
    const makeCls = (initial = []) => ({
      _s: new Set(initial),
      add(...cs) {
        cs.forEach((c) => this._s.add(c));
      },
      remove(...cs) {
        cs.forEach((c) => this._s.delete(c));
      },
      toggle(c, f) {
        if (f === undefined ? !this._s.has(c) : f) this._s.add(c);
        else this._s.delete(c);
      },
      contains(c) {
        return this._s.has(c);
      },
    });
    const layersPopover = { classList: makeCls() };
    const layersBtn = { classList: makeCls(['is-active']), setAttribute() {} };
    const genCard = { classList: makeCls() };
    const vf = { classList: makeCls(['has-active-genealogy', 'has-active-journey']) };
    const domMap = {
      'layers-popover': layersPopover,
      'act-layers-menu': layersBtn,
      'genealogy-card': genCard,
      'viewport-frame': vf,
    };
    let routeRedraws = 0;
    let routeCleared = 0;
    let challengeStopped = 0;
    let balloonClosed = 0;
    Object.assign(ctrl, {
      _id: (id) => domMap[id] || null,
      playing: true,
      personTimer: null,
      mobileChronicleOpen: true,
      activePerson: null,
      activeTrace: [108.94, 34.26],
      activeTraceLabel: '长安',
      activeReturnPerson: null,
      activeCustomRoute: [
        { lng: 108.94, lat: 34.26, coord: [108.94, 34.26], year: 755, name: '长安' },
        { lng: 112.45, lat: 34.62, coord: [112.45, 34.62], year: 755, name: '洛阳' },
      ],
      customRouteStopIdx: 0,
      challenge: { variant: 'locate', deck: [], index: 0, score: 0, answered: false },
      activeMilestone: { dynastyKey: 'tang', milestone: { year: 755, coord: [108.94, 34.26] }, isAuto: true },
      milestoneBalloon: { classList: makeCls() },
      grpGenealogy: { innerHTML: '<g/>' },
      grpSettlements: { querySelectorAll: () => [] },
      grpPrefectures: { querySelectorAll: () => [] },
      closeGenealogyCard: proto.closeGenealogyCard,
      _clearActiveTrace: proto._clearActiveTrace,
      _clearActivePerson: proto._clearActivePerson,
      _closeLayersPopover: proto._closeLayersPopover,
      _syncTracedPrefecture: () => {},
      _syncDocumentSeoMeta: () => {},
      _updateAutoplayUi: () => {},
      stopAutoplay() {
        this.playing = false;
      },
      toggleMobileChronicle(f) {
        this.mobileChronicleOpen = Boolean(f);
      },
      _drawCustomRouteOverlay() {
        routeRedraws++;
      },
      _renderCustomRouteCard() {},
      clearCustomRoute() {
        this.activeCustomRoute = null;
        this.customRouteStopIdx = -1;
        routeCleared++;
      },
      stopChallenge() {
        this.challenge = null;
        challengeStopped++;
      },
      closeMilestoneBalloon() {
        this.activeMilestone = null;
        this.milestoneBalloon.classList.add('is-hidden');
        balloonClosed++;
      },
    });

    // 1. Layers popover dismisses first.
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), true);
    assert(layersPopover.classList.contains('is-hidden'), 'Step 1 must close #layers-popover');
    assert.strictEqual(ctrl.playing, true, 'Closing #layers-popover must not stop autoplay');

    // 2. Active autoplay stops next.
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), true);
    assert.strictEqual(ctrl.playing, false, 'Step 2 must stop autoplay');
    assert.strictEqual(ctrl.mobileChronicleOpen, true, 'Stopping autoplay must not close mobile drawer');

    // 3. Mobile chronicle drawer closes next.
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), true);
    assert.strictEqual(ctrl.mobileChronicleOpen, false, 'Step 3 must close mobile chronicle drawer');
    assert(ctrl.activeTrace !== null, 'Closing mobile drawer must leave genealogy card intact');

    // 4. Genealogy card on a custom-route stop closes first and resets customRouteStopIdx to -1
    //    WITHOUT wiping the custom route itself.
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), true);
    assert.strictEqual(ctrl.activeTrace, null, 'Step 4 must close stop genealogy card');
    assert(genCard.classList.contains('is-hidden'), '#genealogy-card must be hidden');
    assert(Array.isArray(ctrl.activeCustomRoute), 'Custom route must remain active when stop genealogy closes');
    assert.strictEqual(ctrl.customRouteStopIdx, -1, 'Closing stop genealogy must reset customRouteStopIdx to overview (-1)');
    assert.strictEqual(routeRedraws, 1, 'Custom route overlay must redraw in overview state');

    // 5. Next dismissal clears the custom route.
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), true);
    assert.strictEqual(ctrl.activeCustomRoute, null, 'Step 5 must clear custom route');
    assert.strictEqual(routeCleared, 1);

    // 6. Next dismissal exits challenge mode.
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), true);
    assert.strictEqual(ctrl.challenge, null, 'Step 6 must stop challenge');
    assert.strictEqual(challengeStopped, 1);

    // 7. Next dismissal closes the milestone callout; subsequent call is a no-op (false).
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), true);
    assert.strictEqual(balloonClosed, 1, 'Step 7 must close milestone callout');
    assert.strictEqual(proto._dismissTopOverlay.call(ctrl), false, 'When all overlays are closed, _dismissTopOverlay must return false');
  }

  // CUJ 31: Historical neighboring polities (.polity-caption.neighbor) vs. modern country watermarks (.neighbor-caption)
  //         must maintain distinct typography/color hierarchy and dodge collisions or deduplicate identical names
  {
    const proto = ControllerClass.prototype;
    assert(
      /\.polity-caption\.neighbor\s*\{[\s\S]*?font-size:\s*14px;[\s\S]*?font-weight:\s*700;[\s\S]*?fill:\s*#5a2d18;/m.test(
        styleCss
      ),
      'css/style.css .polity-caption.neighbor must use 14px bold (#5a2d18) to distinguish ancient kingdoms from modern country watermarks'
    );
    assert(
      /\.neighbor-caption\s*\{[\s\S]*?font-size:\s*8px;[\s\S]*?font-weight:\s*400;[\s\S]*?fill:\s*#686e73;/m.test(
        styleCss
      ),
      'css/style.css .neighbor-caption must use 8px regular (#686e73) as a subtle background country watermark'
    );

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
    const makeCaptionNode = (clsList, text, x, y, dataset = {}) => {
      const attrs = {
        'data-x': String(x),
        'data-y': String(y),
        'data-base-x': String(x),
        'data-base-y': String(y),
      };
      return {
        classList: makeCls(clsList),
        textContent: text,
        dataset,
        getAttribute: (k) => (k in attrs ? attrs[k] : null),
        setAttribute: (k, v) => {
          attrs[k] = String(v);
        },
      };
    };

    const [fx, fy] = ctrl.projector.toScreen(104.84, 12.38);
    const [kx, ky] = ctrl.projector.toScreen(105.0, 12.87);
    const [cx, cy] = ctrl.projector.toScreen(126.85, 40.38);
    const funanNode = makeCaptionNode(['polity-caption', 'neighbor'], '扶南', fx, fy, {
      polityTitle: '扶南',
      polityRole: 'neighbor',
    });
    const joseonPolNode = makeCaptionNode(['polity-caption', 'neighbor'], '朝鲜', cx, cy, {
      polityTitle: '朝鲜',
      polityRole: 'neighbor',
    });
    const cambodiaWatermark = makeCaptionNode(['neighbor-caption'], '柬埔寨', kx, ky, {
      rawName: '柬埔寨',
    });
    const joseonWatermark = makeCaptionNode(['neighbor-caption'], '朝鲜', cx, cy, {
      rawName: '朝鲜',
    });

    const mockCtrl = {
      camera: { x: 200, y: 200, w: 444, h: 311, zoom: 2.25 },
      projector: ctrl.projector,
      _estimateLocalTextWidth: proto._estimateLocalTextWidth,
      svg: {
        classList: makeCls(),
        querySelectorAll: () => [],
      },
      grpSettlements: { classList: makeCls(), querySelectorAll: () => [] },
      grpPrefectures: { classList: makeCls(), querySelectorAll: () => [] },
      grpCorridors: { classList: makeCls(), querySelectorAll: () => [] },
      grpMilestones: { classList: makeCls(), querySelectorAll: () => [] },
      grpPolities: {
        classList: makeCls(),
        querySelectorAll: (sel) =>
          sel === '.polity-caption' ? [funanNode, joseonPolNode] : [],
      },
      grpNeighbors: {
        querySelectorAll: (sel) =>
          sel === '.neighbor-caption' ? [cambodiaWatermark, joseonWatermark] : [],
      },
      grpProvNames: { querySelectorAll: () => [] },
    };

    proto._rescaleSvgTypography.call(mockCtrl);

    // 扶南 stays anchored while 柬埔寨 dodges vertically/horizontally away from 扶南
    const finalFunanY = parseFloat(funanNode.getAttribute('data-y'));
    const finalCambodiaY = parseFloat(cambodiaWatermark.getAttribute('data-y'));
    assert(
      Math.abs(finalFunanY - fy) < 0.2,
      'Ancient neighbor polity 扶南 must remain anchored at its historical territory center'
    );
    assert(
      !cambodiaWatermark.classList.contains('is-crowded-hidden') &&
        Math.hypot(
          parseFloat(cambodiaWatermark.getAttribute('data-x')) - finalFunanY * 0 - fx,
          finalCambodiaY - finalFunanY
        ) >= 9.0,
      `Modern watermark 柬埔寨 must dodge co-located ancient polity 扶南 (got dy=${(finalCambodiaY - finalFunanY).toFixed(1)})`
    );
    // Same-named modern watermark 朝鲜 hides when historical polity 朝鲜 is active
    assert(
      joseonWatermark.classList.contains('is-crowded-hidden'),
      'Modern watermark 朝鲜 must hide when an active historical polity with the identical name (朝鲜) is displayed'
    );

    // CUJ 31b: a zoom-gated range label must reappear after zooming out past the gate and back in
    //          (regression: the hidden state used to stay locked across zoomOnly frames).
    const [qx, qy] = ctrl.projector.toScreen(107.4, 33.62);
    const qinlingNode = makeCaptionNode(['hydro-label', 'is-range', 'is-crowded-hidden'], '秦岭', qx, qy, {});
    const rangeAttrs = { 'data-rot': '-2' };
    const baseGet = qinlingNode.getAttribute;
    qinlingNode.getAttribute = (k) => (k in rangeAttrs ? rangeAttrs[k] : baseGet(k));
    const hydroCtrl = {
      ...mockCtrl,
      camera: { x: 300, y: 200, w: 400, h: 280, zoom: 2.5 },
      grpPolities: { classList: makeCls(), querySelectorAll: () => [] },
      grpNeighbors: { querySelectorAll: () => [] },
      grpRivers: { classList: makeCls(), querySelectorAll: () => [qinlingNode] },
    };
    proto._rescaleSvgTypography.call(hydroCtrl);
    assert(!qinlingNode.classList.contains('is-crowded-hidden'), '秦岭 must be visible on first landing at zoom 2.5');
    hydroCtrl.camera = { x: 0, y: 0, w: 1000, h: 700, zoom: 1 };
    proto._rescaleSvgTypography.call(hydroCtrl, { zoomOnly: true });
    assert(qinlingNode.classList.contains('is-crowded-hidden'), '秦岭 must hide below the pass gate');
    hydroCtrl.camera = { x: 300, y: 200, w: 400, h: 280, zoom: 2.5 };
    proto._rescaleSvgTypography.call(hydroCtrl, { zoomOnly: true });
    assert(
      !qinlingNode.classList.contains('is-crowded-hidden'),
      '秦岭 must reappear after zooming back in past the pass gate (zoomOnly frame)'
    );
  }

  // CUJ 32: Timeline & Person Chronicle Playback Speed Control (1x -> 2x -> 0.25x -> 0.5x -> 1x)
  {
    const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const styleCss = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
    assert(
      indexHtml.includes('class="playback-controls-group"') &&
        indexHtml.includes('id="act-play-speed"') &&
        indexHtml.includes('id="lbl-play-speed"'),
      'index.html must include #act-play-speed and #lbl-play-speed inside .playback-controls-group in #scrubber-dock'
    );
    assert(
      styleCss.includes('grid-template-rows: 28px auto;') &&
        styleCss.includes('grid-column: 1 / -1;'),
      'style.css must define 2-row mobile timeline layout with full-width #scrubber-rail-wrap under @media (max-width: 640px)'
    );

    const proto = ControllerClass.prototype;
    let scheduledMs = [];
    let clearedIds = [];
    let nextTimerId = 100;
    sandbox.setInterval = (fn, ms) => {
      scheduledMs.push(ms);
      return ++nextTimerId;
    };
    sandbox.clearInterval = (id) => {
      clearedIds.push(id);
    };

    const speedBtn = {
      disabled: false,
      title: '',
      _attrs: {},
      setAttribute(k, v) {
        this._attrs[k] = String(v);
      },
      getAttribute(k) {
        return this._attrs[k] || null;
      },
      classList: {
        _s: new Set(),
        toggle(c, f) {
          if (f === undefined ? !this._s.has(c) : f) this._s.add(c);
          else this._s.delete(c);
        },
        contains(c) {
          return this._s.has(c);
        },
      },
    };
    const speedLbl = { textContent: '1×' };
    const domMap = {
      'act-play-speed': speedBtn,
      'lbl-play-speed': speedLbl,
    };
    ctrl._id = (id) => domMap[id] || null;

    ctrl.locale = 'zh';
    ctrl.challenge = null;
    ctrl.playing = true;
    ctrl.playInterval = 99;
    ctrl.playHoldTicks = 3;
    ctrl.playSpeed = 1;
    proto._updatePlaySpeedUi.call(ctrl);
    assert.strictEqual(speedLbl.textContent, '1×', 'Initial speed label must be 1×');
    assert(
      !speedBtn.classList.contains('is-custom-speed'),
      '1× default speed must not have is-custom-speed active highlight'
    );

    // Cycle 1 -> 2 -> 4 -> 0.5 -> 1 while timeline autoplay is running
    assert.strictEqual(proto.cyclePlaySpeed.call(ctrl), 2, 'First click must switch speed to 2×');
    assert.strictEqual(speedLbl.textContent, '2×', 'Label must update to 2×');
    assert(
      speedBtn.classList.contains('is-custom-speed'),
      'Non-1× speed must highlight #act-play-speed with .is-custom-speed'
    );
    assert.strictEqual(scheduledMs[scheduledMs.length - 1], 140, '2× speed must reschedule tick interval to 140ms');
    assert.strictEqual(ctrl.playHoldTicks, 3, 'Changing speed live must preserve the current dwell (playHoldTicks)');

    assert.strictEqual(proto.cyclePlaySpeed.call(ctrl), 4, 'Second click must switch speed to 4×');
    assert.strictEqual(speedLbl.textContent, '4×', 'Label must update to 4×');
    assert.strictEqual(scheduledMs[scheduledMs.length - 1], 70, '4× speed must reschedule tick interval to 70ms');

    assert.strictEqual(proto.cyclePlaySpeed.call(ctrl), 0.5, 'Third click must switch speed to 0.5×');
    assert.strictEqual(scheduledMs[scheduledMs.length - 1], 560, '0.5× speed must reschedule tick interval to 560ms');

    ctrl.locale = 'en';
    proto._updatePlaySpeedUi.call(ctrl);
    assert(
      speedBtn.getAttribute('aria-label') === 'Playback speed 0.5×' &&
        speedBtn.title.includes('Playback speed 0.5×'),
      'English locale must localize #act-play-speed aria-label and title'
    );

    ctrl.locale = 'zh';
    assert.strictEqual(proto.cyclePlaySpeed.call(ctrl), 1, 'Fourth click must return speed to 1×');
    assert.strictEqual(scheduledMs[scheduledMs.length - 1], 280, '1× speed must restore 280ms tick interval');
    assert(
      !speedBtn.classList.contains('is-custom-speed'),
      'Returning to 1× must remove .is-custom-speed'
    );

    // Verify Person Chronicle autoplay also respects playSpeed and live rescheduling
    ctrl.playing = false;
    ctrl.playInterval = null;
    ctrl.activePerson = { name: '苏轼', events: [{ year: 1037 }, { year: 1082 }] };
    ctrl.activePersonEventIdx = 0;
    ctrl.personTimer = 77;
    proto.setPlaySpeed.call(ctrl, 2);
    assert.strictEqual(
      scheduledMs[scheduledMs.length - 1],
      1300,
      '2× speed during Person Chronicle autoplay must reschedule personTimer to 1300ms'
    );
    proto.setPlaySpeed.call(ctrl, 1);
    ctrl.activePerson = null;
    ctrl.personTimer = null;

    // Verify Quiz Mode lock disables #act-play-speed and blocks cyclePlaySpeed
    proto._syncChallengeScrubberState.call(ctrl, true);
    assert.strictEqual(speedBtn.disabled, true, 'Quiz mode lock must disable #act-play-speed');
    ctrl.challenge = { active: true };
    assert.strictEqual(
      proto.cyclePlaySpeed.call(ctrl),
      1,
      'cyclePlaySpeed() must be a no-op while Quiz Mode challenge is active'
    );
    ctrl.challenge = null;
    proto._syncChallengeScrubberState.call(ctrl, false);
    assert.strictEqual(speedBtn.disabled, false, 'Unlocking Quiz mode must re-enable #act-play-speed');
  }

  // CUJ 33: Qin & Western Han Historical Accuracy against 《史记》 and 《汉书》
  if (!FAST_MODE) {
    const hasPt = (snapKey, polTitle, lng, lat) => {
      const pol = snapshots[snapKey].polities.find((p) => p.title === polTitle);
      return Boolean(pol && pointInShape(lng, lat, pol.shape));
    };

    // 1. 秦初三十六郡 (-221..-215 BCE): 南海郡 not yet founded; 番禺 & 桂林 in 南越; 肤施 & 陇西 in 秦; 九原 in 匈奴
    assert(
      !snapshots.s_qin_a.prefectures.some((p) => p.title === '南海郡') &&
        !snapshots.s_qin_b.prefectures.some((p) => p.title === '南海郡') &&
        snapshots.s_qin.prefectures.some((p) => p.title === '南海郡'),
      '南海郡 must only appear in s_qin (-214 BCE) after Qin conquers Lingnan, restoring 36 commanderies in s_qin_a'
    );
    assert(
      hasPt('s_qin_a', '南越', 113.261, 23.131) &&
        hasPt('s_qin_a', '南越', 110.291, 25.271) &&
        !hasPt('s_qin_a', '秦', 113.261, 23.131) &&
        hasPt('s_qin_b', '南越', 113.261, 23.131) &&
        hasPt('s_qin', '秦', 113.261, 23.131) &&
        hasPt('s_qin', '秦', 110.291, 25.271),
      'Lingnan (Panyu & Guilin) must belong to Nanyue in s_qin_a/s_qin_b (-221..-214 BCE) and Qin in s_qin (-214..-206 BCE)'
    );
    assert(
      hasPt('s_qin_a', '秦', 110.261, 37.501) &&
        hasPt('s_qin_a', '秦', 111.19, 40.27) &&
        hasPt('s_qin_a', '秦', 103.861, 35.381) &&
        hasPt('s_qin_a', '匈奴', 109.841, 40.661) &&
        hasPt('s_qin_b', '秦', 109.841, 40.661),
      's_qin_a must keep Fushi (Shangjun), Yunzhong, and Longxi inside Qin while Jiuyuan (Hetao) stays in Xiongnu until Meng Tian (-215 BCE, s_qin_b)'
    );

    // 2. 楚汉之争 (s_qin_chuhan, -206..-202 BCE): 三川郡、颍川郡、东郡、上郡、陇西 in 汉（刘邦）; 云中 in 赵 · 代; 九原 in 匈奴
    assert(
      hasPt('s_qin_chuhan', '汉（刘邦）', 112.451, 34.621) &&
        hasPt('s_qin_chuhan', '汉（刘邦）', 113.38, 34.79) &&
        hasPt('s_qin_chuhan', '汉（刘邦）', 113.471, 34.151) &&
        hasPt('s_qin_chuhan', '汉（刘邦）', 114.311, 34.801) &&
        hasPt('s_qin_chuhan', '汉（刘邦）', 115.03, 35.76) &&
        hasPt('s_qin_chuhan', '汉（刘邦）', 110.261, 37.501) &&
        hasPt('s_qin_chuhan', '汉（刘邦）', 103.861, 35.381) &&
        hasPt('s_qin_chuhan', '赵 · 代', 111.19, 40.27) &&
        hasPt('s_qin_chuhan', '匈奴', 109.841, 40.661) &&
        hasPt('s_qin_chuhan', '闽越', 120.66, 28.01) &&
        hasPt('s_qin_chuhan', '南越（赵佗）', 105.851, 21.031),
      's_qin_chuhan must cover Sanchuan (Luoyang, Xingyang), Yingchuan (Yangzhai), Dongjun (Daliang, Puyang), Shangjun (Fushi), Longxi, Yunzhong, Jiuyuan, Dongou, and Jiaozhi'
    );

    // 3. 西汉初 (s_xihan_a, -202..-128 BCE) & 汉武帝北伐南征: 河南地 (朔方) in 匈奴 until -127 BCE; 五岭之南 in 南越 until -111 BCE
    assert(
      hasPt('s_xihan_a', '汉（郡国并行）', 110.261, 37.501) &&
        hasPt('s_xihan_a', '汉（郡国并行）', 111.19, 40.27) &&
        hasPt('s_xihan_a', '汉（郡国并行）', 103.861, 35.381) &&
        hasPt('s_xihan_a', '匈奴', 107.401, 40.751) &&
        hasPt('s_xihan_b1', '汉', 107.401, 40.751),
      's_xihan_a must keep Fushi, Yunzhong, and Longxi in Han while Shuofang (Hetao) stays in Xiongnu until Wei Qing (-127 BCE, s_xihan_b1)'
    );
    assert(
      hasPt('s_xihan_a', '南越', 113.261, 23.131) &&
        hasPt('s_xihan_a', '南越', 111.28, 23.48) &&
        hasPt('s_xihan_a', '南越', 109.416, 24.326) &&
        hasPt('s_xihan_b2', '南越', 113.261, 23.131) &&
        hasPt('s_xihan_b3a', '汉', 113.261, 23.131) &&
        hasPt('s_xihan_b3a', '汉', 111.28, 23.48) &&
        hasPt('s_xihan_b3a', '闽越', 119.3, 26.08) &&
        !hasPt('s_xihan_b3a', '汉', 109.577, 19.521) &&
        hasPt('s_xihan_b3a', '西南夷（滇 · 夜郎）', 102.751, 24.671) &&
        hasPt('s_xihan_b3b', '汉', 119.3, 26.08) &&
        hasPt('s_xihan_b3b', '汉', 109.577, 19.521) &&
        hasPt('s_xihan_b3b', '西南夷（滇 · 夜郎）', 102.751, 24.671) &&
        hasPt('s_xihan_b3', '汉', 102.751, 24.671) &&
        hasPt('s_xihan_b3', '汉', 102.26, 27.89),
      '4-stage Western Han expansion (-111 Nanyue -> -110 Minyue & Hainan -> -109 Southwest Yi/Yizhou -> -108 Wiman Joseon) must match milestones'
    );
    assert(
      hasPt('s_qin_a', '秦', 115.5, 27.5) &&
        hasPt('s_qin_b', '秦', 115.5, 27.5) &&
        hasPt('s_qin', '秦', 115.5, 27.5) &&
        hasPt('s_qin_c', '楚（张楚 · 怀王）', 115.5, 27.5) &&
        hasPt('s_qin_d', '楚（怀王 · 项羽）', 115.5, 27.5) &&
        hasPt('s_qin_chuhan', '西楚（项羽）', 115.5, 27.5) &&
        hasPt('s_xihan_a', '汉（郡国并行）', 115.0, 25.8) &&
        hasPt('s_xihan_b1', '汉', 115.0, 25.8) &&
        hasPt('s_xihan_b2', '汉', 115.0, 25.8) &&
        hasPt('s_xihan_b3a', '汉', 115.0, 25.8),
      'Central and southern Jiangxi (Gan River basin) must not leave a hollow gap between Qin/Chu/Han and Nanyue/Minyue'
    );
    for (const sk of ['s_qin_d', 's_qin_chuhan', 's_xihan_a', 's_xihan_b1', 's_xihan_b2']) {
      const ny = snapshots[sk].polities.find((p) => p.title === '南越' || p.title === '南越（赵佗）');
      const my = snapshots[sk].polities.find((p) => p.title === '闽越');
      assert(
        ny && ny.role === 'rival' && ny.tint === '#7d5a38' && my && my.role === 'rival' && my.tint === '#9b7653',
        `${sk} must keep Nanyue and Minyue as rival polities with unified tints (#7d5a38 / #9b7653)`
      );
    }
    {
      const myB3a = snapshots.s_xihan_b3a.polities.find((p) => p.title === '闽越');
      assert(
        myB3a && myB3a.role === 'rival' && myB3a.tint === '#9b7653' &&
          !snapshots.s_xihan_b3b.polities.some((p) => p.title === '闽越'),
        's_xihan_b3a (-111 BCE) must keep Minyue as a rival polity until its -110 BCE annexation in s_xihan_b3b'
      );
    }

    // 4. 西域都护府 (-60 BCE, s_xihan_c) vs 西域诸国 (-111..-61 BCE, s_xihan_b3a..s_xihan_b); 乐浪郡 (-108 BCE); 敦煌 & 居延
    assert(
      !snapshots.s_xihan_b3a.polities.some((p) => p.title === '西域都护府') &&
        !snapshots.s_xihan_b3b.polities.some((p) => p.title === '西域都护府') &&
        !snapshots.s_xihan_b3.polities.some((p) => p.title === '西域都护府') &&
        !snapshots.s_xihan_b.polities.some((p) => p.title === '西域都护府') &&
        snapshots.s_xihan_b3a.polities.some((p) => p.title === '西域诸国' && p.role === 'neighbor') &&
        snapshots.s_xihan_b3b.polities.some((p) => p.title === '西域诸国' && p.role === 'neighbor') &&
        snapshots.s_xihan_b3.polities.some((p) => p.title === '西域诸国' && p.role === 'neighbor') &&
        snapshots.s_xihan_b.polities.some((p) => p.title === '西域诸国' && p.role === 'neighbor') &&
        snapshots.s_xihan_c.polities.some((p) => p.title === '西域都护府' && p.role === 'protectorate'),
      'Protectorate of the Western Regions (西域都护府) must not appear before -60 BCE (s_xihan_c)'
    );
    assert(
      !hasPt('s_xihan_b3', '汉', 125.751, 39.031) &&
        hasPt('s_xihan_b', '汉', 125.751, 39.031) &&
        hasPt('s_xihan_c', '汉', 125.751, 39.031) &&
        hasPt('s_xihan_d', '新（王莽）', 125.751, 39.031) &&
        hasPt('s_xihan_b2', '汉', 94.661, 40.141) &&
        hasPt('s_xihan_b', '汉', 94.661, 40.141) &&
        hasPt('s_xihan_b', '汉', 100.45, 38.93) &&
        hasPt('s_xihan_c', '汉', 100.45, 38.93) &&
        !hasPt('s_xihan_b3', '汉', 101.05, 41.95) &&
        hasPt('s_xihan_b', '汉', 101.05, 41.95) &&
        hasPt('s_xihan_c', '汉', 101.05, 41.95) &&
        hasPt('s_xihan_d', '新（王莽）', 101.05, 41.95) &&
        !hasPt('s_xihan_b', '汉', 102.20, 40.50),
      'Lelang Commandery (-108 BCE), Dunhuang, Zhangye, and post-102 BCE CHGIS Juyan oasis must lie inside Han/Xin while Badain Jaran desert stays outside'
    );
  }

  // CUJ 34: Traditional Chinese (zh-tw) Runtime Conversion, Historical Polysemy Protection & Bidirectional Search
  {
    const conv = sandbox.window.ZH_HANT_CONV;
    assert(conv && typeof conv.toHant === 'function' && typeof conv.toHans === 'function', 'window.ZH_HANT_CONV must be loaded');
    const polysemyPairs = [
      ['咸阳', '咸陽'],
      ['并州刺史', '并州刺史'],
      ['九州合并', '九州合併'],
      ['台州与天台山', '台州與天台山'],
      ['台湾台北', '臺灣臺北'],
      ['余姚与余杭', '餘姚與餘杭'],
      ['范仲淹在范阳郡', '范仲淹在范陽郡'],
      ['钟山与钟繇', '鍾山與鍾繇'],
      ['吕后、韦后与皇太后', '呂后、韋后與皇太后'],
      ['后汉与后周', '後漢與後周'],
      ['诸葛亮北伐与远征', '諸葛亮北伐與遠征'],
      ['魏征进谏', '魏徵進諫'],
      ['庆历新政与万历', '慶曆新政與萬曆'],
      ['中国历史历代', '中國歷史歷代'],
      ['匈奴单于与于阗、于谦', '匈奴單于與于闐、于謙'],
      ['陆游与游牧民族', '陸游與游牧民族'],
      ['岳飞与五岳', '岳飛與五嶽'],
      ['秃发乌孤与剃发易服', '禿髮烏孤與剃髮易服'],
      ['韩侂胄与甲胄', '韓侂冑與甲冑'],
      ['党项羌', '党項羌'],
      // 繁體化稽核（docs/zh-hant-worklog.md）：全語料一簡多繁逐條校對的回歸用例
      ['西汉文帝后元与西汉高后', '西漢文帝後元與西漢高后'],
      ['乾隆与干隆、干封、干道', '乾隆與乾隆、乾封、乾道'],
      ['湖南岳阳与南岳衡山', '湖南岳陽與南嶽衡山'],
      ['重大历史事件与唐大历', '重大歷史事件與唐大曆'],
      ['武周圣历与辽应历', '武周聖曆與遼應曆'],
      ['秦灭两周置三川郡', '秦滅兩周置三川郡'],
      ['萨布素发起雅克萨之战', '薩布素發起雅克薩之戰'],
      ['西域南道交汇总枢纽', '西域南道交匯總樞紐'],
      ['唐廷于于阗置毗沙都督府', '唐廷於于闐置毗沙都督府'],
      ['于少保与于忠肃', '于少保與于忠肅'],
      ['桓温西征收复', '桓溫西征收復'],
      ['乌孙赤谷城', '烏孫赤谷城'],
      ['婺州改宁越府', '婺州改寧越府'],
      ['曲氏高昌与交州曲氏', '麴氏高昌與交州曲氏'],
      ['秦始皇并六国，幽、并四州并起', '秦始皇併六國，幽、并四州並起'],
      ['高渐离击筑', '高漸離擊筑'],
      ['东晋升平', '東晉升平'],
      ['冉闵复姓冉', '冉閔復姓冉'],
      ['云台山与天台山', '雲臺山與天台山'],
      ['祁山卤城', '祁山鹵城'],
    ];
    for (const [hans, expectedHant] of polysemyPairs) {
      const actual = conv.toHant(hans);
      assert.strictEqual(
        actual,
        expectedHant,
        `ZH_HANT_CONV.toHant("${hans}") expected "${expectedHant}", got "${actual}"`
      );
      assert.strictEqual(
        conv.toHant(actual),
        expectedHant,
        `ZH_HANT_CONV.toHant must be idempotent on "${actual}"`
      );
    }

    const prevLocale = ctrl.locale;
    ctrl.locale = 'zh-tw';
    const tangInsp = ctrl.inspect({ year: 741, place: '長安' });
    assert(
      tangInsp &&
        tangInsp.era === '唐玄宗·開元二十九年' &&
        tangInsp.dynasty.title === '唐' &&
        tangInsp.resolvedName === '長安' &&
        tangInsp.polity === '唐' &&
        tangInsp.regions.includes('關內道') &&
        tangInsp.modernProvince === '陝西省' &&
        tangInsp.nearestCity &&
        tangInsp.nearestCity.remark === '唐都，百萬人口國際都會' &&
        tangInsp.url.includes('lang=zh-tw'),
      `Expected Traditional Chinese inspect payload for 741 長安, got ${JSON.stringify(tangInsp)}`
    );

    // Traditional Chinese search & resolvePlace must work in any UI locale (including newly audited variants & Taiwan terms)
    const hantToHansPairs = [
      ['餘姚與餘杭', '余姚与余杭'],
      ['龍巖與七星巖', '龙岩与七星岩'],
      ['祁山鹵城', '祁山卤城'],
      ['龐勛、高繼沖與祖沖之', '庞勋、高继冲与祖冲之'],
      ['鎌倉幕府與甯越郡', '镰仓幕府与宁越郡'],
      ['西元前214年與寮國、汶萊', '公元前214年与老挝、文莱'],
    ];
    for (const [hant, expectedHans] of hantToHansPairs) {
      assert.strictEqual(
        conv.toHans(hant),
        expectedHans,
        `ZH_HANT_CONV.toHans("${hant}") expected "${expectedHans}", got "${conv.toHans(hant)}"`
      );
    }

    for (const loc of ['zh', 'zh-tw', 'en']) {
      ctrl.locale = loc;
      const rChangAn = ctrl.resolvePlace('長安', 741);
      const rXianYang = ctrl.resolvePlace('咸陽', -221);
      const rTongGuan = ctrl.resolvePlace('潼關', 756);
      const rLongYan = ctrl.resolvePlace('龍巖', 1734);
      const rLuCheng = ctrl.resolvePlace('鹵城', 231);
      assert(
        rChangAn && rChangAn.name === '长安' &&
          rXianYang && rXianYang.name === '咸阳' &&
          rTongGuan && rTongGuan.name === '潼关' &&
          rLongYan && rLongYan.name.includes('龙岩') &&
          rLuCheng && rLuCheng.name === '木门道',
        `Expected Traditional place resolution to succeed in locale=${loc}`
      );
      const qSuShi = ctrl._queryQuickSearch('蘇軾');
      const qQingLi = ctrl._queryQuickSearch('慶曆四年');
      const qPangXun = ctrl._queryQuickSearch('龐勛');
      const qGaoJiChong = ctrl._queryQuickSearch('高繼沖');
      const qBce214 = ctrl._queryQuickSearch('西元前214年');
      const qQiXingYan = ctrl._queryQuickSearch('七星巖');
      assert(
        qSuShi.length > 0 && qSuShi[0].personKey === 'sushi' &&
          qQingLi.length > 0 && qQingLi[0].year === 1044 &&
          qPangXun.length > 0 && qPangXun[0].year === 868 &&
          qGaoJiChong.length > 0 &&
          qBce214.length > 0 && qBce214[0].year === -214 &&
          qQiXingYan.length > 0,
        `Expected Traditional quick search for 蘇軾, 慶曆四年, 龐勛, 高繼沖, 西元前214年, 七星巖 to succeed in locale=${loc}`
      );
    }
    ctrl.locale = prevLocale;
  }

  // CUJ 35: Yuan Dynasty Historical Accuracy against 《元史》 (History of Yuan)
  if (!FAST_MODE) {
    const hasPolPt = (snapKey, polTitle, lng, lat) => {
      const pol = snapshots[snapKey].polities.find((p) => p.title === polTitle);
      return Boolean(pol && pointInShape(lng, lat, pol.shape));
    };
    const hasRegPt = (snapKey, regTitle, lng, lat) => {
      const reg = (snapshots[snapKey].regions || []).find((r) => r.title === regTitle);
      return Boolean(reg && pointInShape(lng, lat, reg.shape));
    };
    const hasPrefPt = (snapKey, prefTitle, lng, lat) => {
      const pref = (snapshots[snapKey].prefectures || []).find((p) => p.title === prefTitle);
      return Boolean(pref && pointInShape(lng, lat, pref.shape));
    };

    // 1. Northwest frontier: Beshbalik ([89.181, 44.001]) & Qocho ([89.53, 42.85]) inside Yuan (not Chagatai)
    for (const sk of ['s_yuan_a', 's_yuan', 's_yuan_b', 's_yuan_c']) {
      assert(
        hasPolPt(sk, '元', 89.181, 44.001) &&
          hasPolPt(sk, '元', 89.53, 42.85) &&
          !hasPolPt(sk, '察合台汗国', 89.181, 44.001) &&
          !hasPolPt(sk, '察合台汗国', 89.53, 42.85) &&
          hasRegPt(sk, '北庭都护府', 89.181, 44.001) &&
          hasRegPt(sk, '北庭都护府', 89.53, 42.85) &&
          hasRegPt(sk, '征东行省', 126.55, 37.97),
        `${sk} must place Beshbalik and Qocho inside Yuan / Beiting Protectorate and Kaesong inside Zhengdong Province`
      );
    }

    // 2. 《元史·地理志》 provincial boundaries: Jiqing & Hangzhou in 江浙行省, Kaizhou in 中书省（腹里）, Shanzhou in 河南江北行省, Xiningzhou in 甘肃行省, Hainan in 湖广行省
    for (const sk of ['s_yuan_a', 's_yuan', 's_yuan_b', 's_yuan_c']) {
      assert(
        hasRegPt(sk, '江浙行省', 118.801, 32.061) &&
          !hasRegPt(sk, '河南江北行省', 118.801, 32.061) &&
          hasRegPt(sk, '河南江北行省', 118.317, 32.301) &&
          hasRegPt(sk, '江浙行省', 120.151, 30.271) &&
          hasRegPt(sk, '中书省（腹里）', 115.03, 35.76) &&
          !hasRegPt(sk, '河南江北行省', 115.03, 35.76) &&
          hasRegPt(sk, '河南江北行省', 111.17, 34.78) &&
          !hasRegPt(sk, '中书省（腹里）', 111.17, 34.78) &&
          hasRegPt(sk, '甘肃行省', 101.78, 36.62) &&
          hasRegPt(sk, '湖广行省', 109.577, 19.521) &&
          hasRegPt(sk, '湖广行省', 109.18, 18.36),
        `${sk} regions must align Jiqing, Hangzhou, Kaizhou, Shanzhou, Xiningzhou, and Hainan with History of Yuan Geography Treatise`
      );
    }

    // 3. Circuit (路) chronology between s_yuan_a (1279–1288) and s_yuan (1288–1351) + restored frontier circuits
    assert(
      hasPrefPt('s_yuan_a', '安西路', 108.941, 34.341) &&
        hasPrefPt('s_yuan_a', '鄂州路', 114.311, 30.551) &&
        hasPrefPt('s_yuan_a', '太原路', 112.551, 37.871) &&
        hasPrefPt('s_yuan_a', '建康路', 118.801, 32.061) &&
        hasPrefPt('s_yuan_a', '潭州路', 112.971, 28.201) &&
        hasPrefPt('s_yuan_a', '南剑路', 118.18, 26.64) &&
        hasPrefPt('s_yuan', '奉元路', 108.941, 34.341) &&
        hasPrefPt('s_yuan', '武昌路', 114.311, 30.551) &&
        hasPrefPt('s_yuan', '冀宁路', 112.551, 37.871) &&
        hasPrefPt('s_yuan', '集庆路', 118.801, 32.061) &&
        hasPrefPt('s_yuan', '天临路', 112.971, 28.201) &&
        hasPrefPt('s_yuan', '延平路', 118.18, 26.64) &&
        hasPrefPt('s_yuan', '辽阳路', 123.241, 41.271) &&
        hasPrefPt('s_yuan', '大宁路', 121.13, 41.1) &&
        hasPrefPt('s_yuan', '和林路', 102.851, 47.201) &&
        hasPrefPt('s_yuan', '亦集乃路', 101.14, 41.76) &&
        hasPrefPt('s_yuan', '播州宣慰司', 106.93, 27.72) &&
        hasPrefPt('s_yuan', '泉州路', 118.681, 24.871) &&
        hasPrefPt('s_yuan', '汀州路', 117.02, 25.08),
      's_yuan_a and s_yuan prefectures must reflect pre-1301 vs post-1301 circuit renamings and cover frontier circuits'
    );

    // 4. Late Yuan Red Turban & warlord territories in s_yuan_b (1351–1363) and s_yuan_c (1363–1368)
    assert(
      hasPolPt('s_yuan_b', '宋（韩林儿）', 115.78, 33.87) &&
        hasPolPt('s_yuan_b', '宋（韩林儿）', 115.801, 32.901) &&
        hasPolPt('s_yuan_b', '宋（韩林儿）', 116.964, 33.647) &&
        hasPolPt('s_yuan_b', '宋（韩林儿）', 116.78, 32.58) &&
        hasPolPt('s_yuan_b', '宋（韩林儿）', 114.311, 34.801) &&
        hasPolPt('s_yuan_b', '周（张士诚）', 120.62, 31.3) &&
        hasPolPt('s_yuan_b', '周（张士诚）', 119.45, 32.78) &&
        hasPolPt('s_yuan_b', '周（张士诚）', 120.087, 30.894) &&
        hasPolPt('s_yuan_b', '周（张士诚）', 120.151, 30.271) &&
        hasPolPt('s_yuan_b', '吴（朱元璋）', 118.801, 32.061) &&
        hasPolPt('s_yuan_b', '吴（朱元璋）', 118.317, 32.301) &&
        hasPolPt('s_yuan_b', '吴（朱元璋）', 118.497, 31.571) &&
        hasPolPt('s_yuan_b', '吴（朱元璋）', 119.92, 28.45) &&
        hasPolPt('s_yuan_b', '方国珍', 121.55, 29.87) &&
        hasPolPt('s_yuan_b', '方国珍', 120.66, 28.01) &&
        hasPolPt('s_yuan_b', '天完 · 陈友谅', 114.311, 30.551) &&
        hasPolPt('s_yuan_b', '天完 · 陈友谅', 115.891, 28.681),
      's_yuan_b must accurately partition Song (Han Lin\'er), Zhou (Zhang Shicheng), Wu (Zhu Yuanzhang), Fang Guozhen, and Tianwan/Chen Youliang'
    );
    assert(
      hasPolPt('s_yuan_c', '吴（朱元璋）', 118.801, 32.061) &&
        hasPolPt('s_yuan_c', '吴（朱元璋）', 114.311, 30.551) &&
        hasPolPt('s_yuan_c', '吴（朱元璋）', 115.891, 28.681) &&
        hasPolPt('s_yuan_c', '吴（朱元璋）', 116.78, 32.58) &&
        hasPolPt('s_yuan_c', '周（张士诚）', 120.62, 31.3) &&
        hasPolPt('s_yuan_c', '方国珍', 121.55, 29.87) &&
        hasPolPt('s_yuan_c', '陈友定', 119.3, 26.08) &&
        hasPolPt('s_yuan_c', '陈友定', 118.681, 24.871) &&
        !hasPolPt('s_yuan_c', '陈友定', 113.261, 23.131) &&
        !hasPolPt('s_yuan_c', '陈友定', 110.291, 25.271) &&
        hasPolPt('s_yuan_c', '元', 113.261, 23.131) &&
        hasPolPt('s_yuan_c', '元', 110.291, 25.271) &&
        hasPolPt('s_yuan_c', '元', 109.577, 19.521),
      's_yuan_c must keep Zhou (Zhang Shicheng) and Fang Guozhen until 1367 and restrict Chen Youding strictly to Fujian while Guangdong/Guangxi/Hainan stay in Yuan'
    );

    // 5. Mongol Empire & Western Liao / Yuan interior continuity (zero Lop Nor / Qilian hollow cavities or vertical keyhole cuts)
    assert(
      hasPolPt('s_nansong_a0', '西辽', 90.5, 40.2) &&
        hasPolPt('s_nansong_a', '西辽', 90.5, 40.2) &&
        hasPolPt('s_nansong_b0', '西辽', 90.5, 40.2) &&
        hasPolPt('s_nansong_c', '大蒙古国', 90.5, 40.2) &&
        hasPolPt('s_nansong_c', '大蒙古国', 86.0, 40.0) &&
        hasPolPt('s_nansong_d', '大蒙古国', 90.5, 40.2) &&
        hasPolPt('s_nansong_d', '大蒙古国', 86.0, 40.0) &&
        hasPolPt('s_nansong_e', '大蒙古国', 90.5, 40.2) &&
        hasPolPt('s_nansong_e', '大蒙古国', 86.0, 40.0) &&
        hasPolPt('s_nansong_e', '大蒙古国', 100.0, 38.0) &&
        hasPolPt('s_nansong_b', '大蒙古国', 90.5, 40.2) &&
        hasPolPt('s_nansong_b', '大蒙古国', 100.16, 25.69) &&
        snapshots.s_nansong_b.polities.find((p) => p.title === '大蒙古国').shape.coordinates.length === 2 &&
        hasPolPt('s_nansong_g', '元', 100.0, 28.0) &&
        hasPolPt('s_yuan_b', '元', 90.5, 40.2) &&
        hasPolPt('s_yuan_c', '元', 90.5, 40.2),
      'Mongol Empire, Western Liao, and Yuan snapshots must have zero hollow interior cavities at Lop Nor [90.5, 40.2], Eastern Tarim [86, 40], Qilian [100, 38], or Hengduan [100, 28]'
    );
  }

  // CUJ 36: Northern & Southern Song Historical Accuracy against 《宋史》《辽史》《金史》
  {
    if (!FAST_MODE) {
    const hasPolPt = (snapKey, polTitle, lng, lat) => {
      const pol = snapshots[snapKey].polities.find((p) => p.title === polTitle);
      return Boolean(pol && pointInShape(lng, lat, pol.shape));
    };
    const hasRegPt = (snapKey, regTitle, lng, lat) => {
      const reg = (snapshots[snapKey].regions || []).find((r) => r.title === regTitle);
      return Boolean(reg && pointInShape(lng, lat, reg.shape));
    };
    const hasPrefPt = (snapKey, prefTitle, lng, lat) => {
      const pref = (snapshots[snapKey].prefectures || []).find((p) => p.title === prefTitle);
      return Boolean(pref && pointInShape(lng, lat, pref.shape));
    };

    // 1. Ten Kingdoms unification chronology (960–979): Jingnan vs Wuping (960–963), Southern Tang vs Wuyue vs Qingyuanjun in Fujian (960–978)
    assert(
      !snapshots.s_beisong_a0.polities.some((p) => p.title === '湖南') &&
        hasPolPt('s_beisong_a0', '荆南（南平）', 112.241, 30.331) &&
        hasPolPt('s_beisong_a0', '武平（湖南）', 112.941, 28.231) &&
        hasPolPt('s_beisong_a0', '武平（湖南）', 111.698, 29.032) &&
        hasPolPt('s_beisong_a', '宋', 112.241, 30.331) &&
        hasPolPt('s_beisong_a', '宋', 112.941, 28.231),
      's_beisong_a0 (960–963) must distinguish Jingnan (Jiangling) and Wuping (Tanzhou/Langzhou) before the 963 Jinghu campaign'
    );
    for (const sk of ['s_beisong_a0', 's_beisong_a', 's_beisong_a2', 's_beisong_a3']) {
      assert(
        hasPolPt(sk, '南唐', 118.32, 27.04) &&
          hasPolPt(sk, '南唐', 116.35, 25.84) &&
          !hasPolPt(sk, '吴越', 118.32, 27.04) &&
          hasPolPt(sk, '吴越', 119.301, 26.081) &&
          hasPolPt(sk, '吴越', 120.151, 30.271) &&
          hasPolPt(sk, '清源军', 118.681, 24.871) &&
          hasPolPt(sk, '清源军', 117.65, 24.51),
        `${sk} (960–975) must place Jianzhou & Tingzhou in Southern Tang, Fuzhou & Hangzhou in Wuyue, and Quanzhou & Zhangzhou in Qingyuanjun`
      );
    }
    assert(
      hasPolPt('s_beisong_a4', '宋', 118.32, 27.04) &&
        hasPolPt('s_beisong_a4', '宋', 116.35, 25.84) &&
        hasPolPt('s_beisong_a4', '吴越', 119.301, 26.081) &&
        hasPolPt('s_beisong_a4', '清源军', 118.681, 24.871) &&
        hasPolPt('s_beisong_a5', '宋', 119.301, 26.081) &&
        hasPolPt('s_beisong_a5', '宋', 120.151, 30.271) &&
        hasPolPt('s_beisong_a5', '宋', 118.681, 24.871),
      's_beisong_a4 (975–978) must keep Qingyuanjun and Wuyue independent after Southern Tang falls, and s_beisong_a5 (978–979) must annex both into Song'
    );

    // 2. Song–Liao & Northern Han border (Sixteen Prefectures of Yanyun: Shuozhou, Yingzhou, Daizhou, Yizhou, Bazhou)
    for (const sk of ['s_beisong_a0', 's_beisong_a', 's_beisong_a2', 's_beisong_a3', 's_beisong_a4', 's_beisong_a5']) {
      assert(
        hasPolPt(sk, '北汉', 112.96, 39.07) &&
          hasPolPt(sk, '北汉', 112.551, 37.871) &&
          hasPolPt(sk, '辽', 112.43, 39.33) &&
          hasPolPt(sk, '辽', 113.19, 39.55) &&
          hasPolPt(sk, '宋', 115.49, 39.35) &&
          hasPolPt(sk, '宋', 116.39, 39.12),
        `${sk} (960–979) must place Daizhou & Taiyuan in Northern Han, Shuozhou & Yingzhou in Liao, and Yizhou & Bazhou in Song`
      );
    }
    for (const sk of ['s_beisong_b0', 's_beisong_b', 's_beisong_b1', 's_beisong_b2', 's_beisong_c']) {
      assert(
        hasPolPt(sk, '宋', 112.96, 39.07) &&
          hasPolPt(sk, '宋', 116.39, 39.12) &&
          hasPolPt(sk, '辽', 112.43, 39.33) &&
          hasPolPt(sk, '辽', 113.19, 39.55) &&
          hasPolPt(sk, '辽', 115.49, 39.35),
        `${sk} (979–1125) must place Daizhou & Bazhou in Song and Shuozhou, Yingzhou, & Yizhou in Liao`
      );
    }

    // 3. Dingnan Jiedushi / Lingzhou (1002) & Xihe (1072) / Hehuang (1104) expansions + Qilian Mountain seam
    for (const sk of ['s_beisong_a0', 's_beisong_a', 's_beisong_a2', 's_beisong_a3', 's_beisong_a4', 's_beisong_a5']) {
      assert(
        hasPolPt(sk, '宋', 106.28, 38.09) &&
          hasPolPt(sk, '党项（定难军）', 108.78, 37.98) &&
          !hasPolPt(sk, '党项（定难军）', 106.28, 38.09),
        `${sk} (960–979) must keep Lingzhou inside Song and Xiazhou inside Dingnan Jiedushi`
      );
    }
    assert(
      hasPolPt('s_beisong_b0', '党项（定难军）', 106.28, 38.09) &&
        hasPolPt('s_beisong_b0', '党项（定难军）', 106.231, 38.491) &&
        hasPolPt('s_beisong_b', '吐蕃诸部', 103.861, 35.381) &&
        hasPolPt('s_beisong_b', '吐蕃诸部', 101.778, 36.617) &&
        hasPolPt('s_beisong_b1', '宋', 103.861, 35.381) &&
        hasPolPt('s_beisong_b1', '宋', 103.21, 35.6) &&
        hasPolPt('s_beisong_b1', '宋', 104.04, 34.43) &&
        hasPolPt('s_beisong_b1', '宋', 103.83, 36.06) &&
        !hasPolPt('s_beisong_b1', '吐蕃诸部', 103.861, 35.381) &&
        hasPolPt('s_beisong_b1', '吐蕃诸部', 101.778, 36.617),
      's_beisong_b0..b1 must reflect Li Jiqian capturing Lingzhou (1002) and Wang Shao recovering Xihe (Xizhou/Hezhou/Minzhou/Lanzhou) in 1072'
    );
    for (const sk of ['s_beisong_b2', 's_beisong_c', 's_beisong_d']) {
      assert(
        hasPolPt(sk, '宋', 101.778, 36.617) &&
          !hasPolPt(sk, '吐蕃诸部', 101.778, 36.617) &&
          hasRegPt(sk, '熙河路', 101.778, 36.617),
        `${sk} (1104–1127) must place Xiningzhou (Qingtang) inside Song and Xihe Circuit after the 1104 Hehuang Expansion`
      );
    }

    // 4. Late Northern Song (s_beisong_d), Hainan Island circuit (广南西路), and full-phase simplified prefectures
    assert(
      hasPolPt('s_beisong_d', '西辽', 81.28, 43.92) &&
        snapshots.s_beisong_d.regions.some((r) => r.title === '上京路') &&
        snapshots.s_beisong_d.regions.some((r) => r.title === '燕京路') &&
        !snapshots.s_beisong_d.regions.some((r) => r.title.endsWith('道')),
      's_beisong_d (1125–1127) must include Western Liao and rename former Liao circuits from 道 to Jin 路'
    );
    for (const sk of ['s_beisong_a3', 's_beisong_a4', 's_beisong_a5', 's_beisong_b0', 's_beisong_b', 's_beisong_b1', 's_beisong_b2', 's_beisong_c', 's_beisong_d', 's_nansong_a0', 's_nansong_a', 's_nansong_b0', 's_nansong_c', 's_nansong_d', 's_nansong_e', 's_nansong_b', 's_nansong_g']) {
      assert(
        hasRegPt(sk, '广南西路', 109.577, 19.521),
        `${sk} must include Hainan Island ([109.577, 19.521]) inside 广南西路`
      );
    }
    for (const sk of ['s_beisong_a0', 's_beisong_a', 's_beisong_a2', 's_beisong_a3', 's_beisong_a4', 's_beisong_a5', 's_beisong_b0', 's_beisong_b', 's_beisong_b1', 's_beisong_b2', 's_beisong_c', 's_beisong_d', 's_nansong_a0', 's_nansong_a', 's_nansong_b0', 's_nansong_c', 's_nansong_d', 's_nansong_e', 's_nansong_b', 's_nansong_g']) {
      const prefs = snapshots[sk].prefectures || [];
      assert(
        prefs.length >= 130 &&
          !prefs.some((p) => p.title.endsWith('道') || p.title === '倒塌岭节度使司' || p.title === '西北路') &&
          hasPrefPt(sk, '开封府', 114.351, 34.791) &&
          hasPrefPt(sk, '成都府', 104.061, 30.671),
        `${sk} prefectures must be populated (>=130), free of macro-circuits, and include Kaifengfu & Chengdufu`
      );
    }

    // 5. Southern Song (1127–1279): Treaty of Shaoxing border (Qinzhou, Fengzhou, Chengzhou, Jiezhou, Junzhou), Lintao exclusivity, and Jin capital chronology
    const mcPol = snapshots.s_nansong_c.polities.find((p) => p.title === '大蒙古国');
    assert(
      mcPol &&
        (mcPol.shape.type === 'Polygon' || mcPol.shape.coordinates.length === 1) &&
        hasPolPt('s_nansong_c', '金（迁都汴京）', 103.861, 35.381) &&
        hasPolPt('s_nansong_c', '金（迁都汴京）', 103.83, 36.06),
      's_nansong_c (1215–1227) must keep Lintao Circuit (Lintaofu & Lanzhou) inside Jin rather than a disconnected Mongol exclave'
    );
    for (const sk of ['s_nansong_a0', 's_nansong_a', 's_nansong_b0', 's_nansong_c', 's_nansong_d']) {
      assert(
        !hasPolPt(sk, '吐蕃诸部', 103.861, 35.381) && !hasPolPt(sk, '吐蕃诸部', 103.83, 36.06),
        `${sk} must not overlap 吐蕃诸部 onto Lintaofu or Lanzhou`
      );
    }
    assert(
      hasPolPt('s_nansong_a0', '南宋', 105.721, 34.581) &&
        hasRegPt('s_nansong_a0', '利州路', 105.721, 34.581) &&
        snapshots.s_nansong_a0.regions.some((r) => r.title === '燕京路') &&
        !snapshots.s_nansong_a0.regions.some((r) => r.title === '中都路') &&
        hasPrefPt('s_nansong_a0', '析津府', 116.401, 39.901),
      's_nansong_a0 (1127–1141, pre-Shaoxing Treaty & pre-1153 Zhongdu) must keep Qinzhou in Southern Song / Lizhou Circuit and name Beijing as Yanjing Circuit / Xijinfu'
    );
    for (const [sk, northPol] of [
      ['s_nansong_a', '金'],
      ['s_nansong_b0', '金'],
      ['s_nansong_c', '金（迁都汴京）'],
      ['s_nansong_d', '大蒙古国'],
      ['s_nansong_e', '大蒙古国'],
      ['s_nansong_b', '大蒙古国'],
    ]) {
      assert(
        hasPolPt(sk, northPol, 105.721, 34.581) &&
          hasPolPt(sk, northPol, 106.96, 34.28) &&
          !hasPolPt(sk, '南宋', 105.721, 34.581) &&
          hasPolPt(sk, '南宋', 106.52, 33.91) &&
          hasPolPt(sk, '南宋', 105.73, 33.74) &&
          hasPolPt(sk, '南宋', 104.92, 33.4) &&
          hasPolPt(sk, '南宋', 104.04, 34.43) &&
          hasPolPt(sk, '南宋', 111.51, 32.65) &&
          hasRegPt(sk, '凤翔路', 105.721, 34.581) &&
          hasRegPt(sk, '利州路', 106.52, 33.91) &&
          hasRegPt(sk, '利州路', 105.73, 33.74) &&
          hasRegPt(sk, '利州路', 104.92, 33.4),
        `${sk} (post-1142 Treaty of Shaoxing) must place Qinzhou & Dasanguan in ${northPol} / Fengxiang Circuit and Fengzhou, Chengzhou, Jiezhou, Minzhou, & Junzhou in Southern Song / Lizhou Circuit`
      );
    }
    for (const sk of ['s_nansong_e', 's_nansong_b']) {
      assert(
        snapshots[sk].regions.some((r) => r.title === '辽东路') &&
          snapshots[sk].regions.some((r) => r.title === '燕京路') &&
          snapshots[sk].regions.some((r) => r.title === '河南路') &&
          !snapshots[sk].regions.some((r) => r.title === '上京路' || r.title === '中都路' || r.title === '南京（河南）路'),
        `${sk} (post-1234 fall of Jin) must replace Jin imperial circuits with Mongol circuits (辽东路, 燕京路, 河南路)`
      );
    }

    // 6. Liao & Jin northeastern and western frontiers beyond modern borders (Issue #167)
    for (const [sk, polName] of [
      ['s_wudai_b', '契丹'],
      ['s_wudai_b2', '契丹'],
      ['s_wudai_c', '契丹'],
      ['s_wudai_c0', '契丹'],
      ['s_wudai_c2', '契丹'],
      ['s_wudai_d', '辽'],
      ['s_wudai_e', '辽'],
      ['s_wudai_e1', '辽'],
      ['s_wudai_e2', '辽'],
    ]) {
      assert(
        hasPolPt(sk, polName, 133.5, 44.5) &&
          hasPolPt(sk, polName, 138.0, 49.5) &&
          hasPolPt(sk, polName, 110.0, 46.5),
        `${sk} must extend ${polName} east to the Sea of Japan / Lower Amur and west across the Mongolian steppe for a seamless transition into Northern Song`
      );
    }
    for (const [sk, polName, eastReg, northReg] of [
      ['s_beisong_a0', '辽', '东京道', '上京道'],
      ['s_beisong_a', '辽', '东京道', '上京道'],
      ['s_beisong_a2', '辽', '东京道', '上京道'],
      ['s_beisong_a3', '辽', '东京道', '上京道'],
      ['s_beisong_a4', '辽', '东京道', '上京道'],
      ['s_beisong_a5', '辽', '东京道', '上京道'],
      ['s_beisong_b0', '辽', '东京道', '上京道'],
      ['s_beisong_b', '辽', '东京道', '上京道'],
      ['s_beisong_b1', '辽', '东京道', '上京道'],
      ['s_beisong_b2', '辽', '东京道', '上京道'],
      ['s_beisong_c', '金', '东京道', '上京道'],
      ['s_beisong_d', '金', '东京路', '上京路'],
    ]) {
      assert(
        hasPolPt(sk, polName, 134.5, 44.8) &&
          hasPolPt(sk, polName, 135.5, 48.5) &&
          hasPolPt(sk, polName, 138.0, 49.5) &&
          !hasPolPt(sk, '蒙古诸部', 134.5, 44.8) &&
          !hasPolPt(sk, '蒙古诸部', 135.5, 48.5) &&
          hasRegPt(sk, eastReg, 134.5, 44.8) &&
          hasRegPt(sk, northReg, 135.5, 48.5),
        `${sk} must extend ${polName} (${eastReg} / ${northReg}) beyond the modern Heilongjiang–Ussuri border to the Sea of Japan and Lower Amur without overlapping 蒙古诸部`
      );
    }
    for (const sk of ['s_nansong_a0', 's_nansong_a', 's_nansong_b0']) {
      assert(
        hasPolPt(sk, '金', 133.5, 44.8) &&
          hasPolPt(sk, '金', 136.0, 48.8) &&
          hasPolPt(sk, '金', 139.0, 51.0) &&
          hasPolPt(sk, '金', 126.5, 54.0) &&
          hasPolPt(sk, '金', 132.0, 53.5) &&
          hasPolPt(sk, '金', 122.0, 50.5) &&
          !hasPolPt(sk, '金', 112.5, 44.5) &&
          !hasPolPt(sk, '蒙古诸部', 136.0, 48.8) &&
          !hasPolPt(sk, '大蒙古国', 136.0, 48.8) &&
          hasRegPt(sk, '上京路', 136.0, 48.8) &&
          hasRegPt(sk, '上京路', 126.5, 54.0) &&
          hasRegPt(sk, '上京路', 122.0, 50.5) &&
          hasPrefPt(sk, '蒲与路', 126.5, 54.0) &&
          hasPrefPt(sk, '胡里改路', 136.0, 48.8) &&
          hasPrefPt(sk, '恤品路', 133.5, 44.8),
        `${sk} must extend Jin (上京路, 蒲与路, 胡里改路, 恤品路) across the Amur and Ussuri rivers and follow the historical Jin Frontier Trench in the west rather than modern borders`
      );
    }

    // CUJ 37: Warring States (Zizhi Tongjian) territorial & settlement alignment across all 14 snapshots
    for (const sk of ['s_zhanguo_a', 's_zhanguo_a2']) {
      assert(
        hasPolPt(sk, '蜀', 104.071, 30.571) &&
          hasPolPt(sk, '蜀', 105.84, 32.44) &&
          hasPolPt(sk, '巴', 106.551, 29.561) &&
          hasPolPt(sk, '巴', 105.97, 31.58) &&
          hasPolPt(sk, '楚', 107.021, 33.071) &&
          !hasPolPt(sk, '楚', 105.84, 32.44),
        `${sk} must split 蜀 (Chengdu, Jiameng) and 巴 (Jiangzhou, Langzhong) and keep Hanzhong in 楚 without overlapping Jiameng`
      );
    }
    assert(
      hasPolPt('s_zhanguo_a', '魏', 110.44, 35.48) &&
        hasPolPt('s_zhanguo_a', '韩', 110.92, 34.63) &&
        hasPolPt('s_zhanguo_a2', '秦', 110.44, 35.48) &&
        hasPolPt('s_zhanguo_a2', '秦', 110.92, 34.63),
      'Shaoliang (Hexi Commandery) must belong to 魏 in s_zhanguo_a (-403..-341 BCE) and transfer with Hangu Pass to 秦 in s_zhanguo_a2 (-340 BCE)'
    );
    for (const sk of ['s_zhanguo_a', 's_zhanguo_a2', 's_zhanguo_b0', 's_zhanguo_b1', 's_zhanguo_b']) {
      assert(
        hasPolPt(sk, '宋', 115.65, 34.42) &&
          hasPolPt(sk, '宋', 115.57, 35.07) &&
          hasPolPt(sk, '宋', 117.18, 34.26),
        `${sk} (-403..-286 BCE) must include State of Song (宋) covering Shangqiu, Dingtao, and Pengcheng`
      );
    }
    for (const sk of ['s_zhanguo_b2', 's_zhanguo_c', 's_zhanguo_c2', 's_zhanguo_d', 's_zhanguo_e1', 's_zhanguo_e2', 's_zhanguo_e3']) {
      assert(
        hasPolPt(sk, '魏', 114.351, 34.791) &&
          hasPolPt(sk, '魏', 115.65, 34.42) &&
          hasPolPt(sk, '楚', 117.18, 34.26) &&
          hasPolPt(sk, '楚', 114.881, 33.781) &&
          !hasPolPt(sk, '秦', 114.881, 33.781),
        `${sk} (post-286 BCE Song partition) must place Daliang & Shangqiu in 魏 and Pengcheng & Chenying in 楚`
      );
    }
    assert(
      hasPolPt('s_zhanguo_e4', '秦', 114.351, 34.791) &&
        hasPolPt('s_zhanguo_e4', '秦', 115.65, 34.42) &&
        hasPolPt('s_zhanguo_e4', '楚', 114.881, 33.781) &&
        hasPolPt('s_zhanguo_e4', '楚', 117.18, 34.26) &&
        !hasPolPt('s_zhanguo_e4', '秦', 114.881, 33.781),
      's_zhanguo_e4 (-225 BCE fall of Wei) must transfer Daliang & Shangqiu to 秦 while keeping Chenying & Pengcheng in 楚'
    );
    for (const sk of ['s_zhanguo_a', 's_zhanguo_a2', 's_zhanguo_b0']) {
      assert(hasPolPt(sk, '越', 119.98, 35.65), `${sk} must include Langya ([119.98, 35.65]) inside 越`);
    }
    for (const sk of ['s_zhanguo_b1', 's_zhanguo_b', 's_zhanguo_b2', 's_zhanguo_c', 's_zhanguo_c2', 's_zhanguo_d', 's_zhanguo_e1', 's_zhanguo_e2', 's_zhanguo_e3', 's_zhanguo_e4']) {
      assert(hasPolPt(sk, '楚', 119.98, 35.65), `${sk} must include Langya ([119.98, 35.65]) inside 楚`);
    }
    assert(hasPolPt('s_zhanguo_e5', '秦', 119.98, 35.65), 's_zhanguo_e5 must include Langya ([119.98, 35.65]) inside 秦');
    for (const sk of ['s_zhanguo_b', 's_zhanguo_b2', 's_zhanguo_c', 's_zhanguo_c2', 's_zhanguo_d', 's_zhanguo_e1']) {
      assert(
        hasPolPt(sk, '赵', 111.201, 40.251) && hasPolPt(sk, '赵', 114.551, 40.151),
        `${sk} (-300..-229 BCE) must include both Yunzhong and Dai inside 赵`
      );
    }
    for (const sk of ['s_zhanguo_e2', 's_zhanguo_e3', 's_zhanguo_e4']) {
      assert(
        hasPolPt(sk, '秦', 111.201, 40.251) &&
          hasPolPt(sk, '代', 114.551, 40.151) &&
          !hasPolPt(sk, '代', 111.201, 40.251),
        `${sk} (-228..-223 BCE) must place Yunzhong in 秦 and Dai ([114.551, 40.151]) in 代`
      );
    }
    for (const sk of ['s_qin_a', 's_qin_b', 's_qin', 's_xihan_a', 's_xihan_b1', 's_xihan_b2', 's_xihan_b3a', 's_xihan_b3b', 's_xihan_b3', 's_xihan_b', 's_xihan_c', 's_xihan_d']) {
      const mainPol = snapshots[sk].polities[0];
      const mainRing = mainPol.shape.type === 'Polygon' ? mainPol.shape.coordinates[0] : mainPol.shape.coordinates[0][0];
      assert(
        mainRing.length >= 1200,
        `${sk} main polity (${mainPol.title}) must use high-resolution outer border aligned with commanderies/provinces (>=1200 vertices, got ${mainRing.length})`
      );
    }
    }
  }
}

module.exports = { runCartographyUiSuite };
