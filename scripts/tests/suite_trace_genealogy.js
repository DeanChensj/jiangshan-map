'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function runTraceGenealogySuite(ctx) {
  ctx.ensureHydrated();
  const {
    ROOT,
    FAST_MODE,
    sandbox,
    ctrl,
    provinces,
    snapshots,
    bootSnaps,
    dynasties,
    loreData,
    enLocale,
    hydro,
    indexHtml,
    styleCss,
    appCode,
    readmeSrc,
    readmeZhSrc,
    mingPol,
    pointInShape,
  } = ctx;

  // ── 23. CUJ 23: Regional Milestone, Landmark & Settlement Coverage ──
  const requiredMilestones = [
    ['xihan', -110],
    ['xihan', -61],
    ['donghan', 215],
    ['dongjin', 397],
    ['tang', 670],
    ['tang', 698],
    ['ming', 1413],
    ['qing', 1885],
    ['donghan', 89],
    ['donghan', 91],
    ['donghan', 107],
    ['donghan', 177],
    ['nanbei', 552],
    ['nanbei', 580],
    ['yuan', 1313],
    ['yuan', 1354],
    ['yuan', 1358],
    ['qing', 1645],
    ['qing', 1729],
    ['qing', 1757],
    ['qing', 1826],
    ['qing', 1842],
    ['qing', 1865],
    ['qing', 1887],
    ['qing', 1905],
  ];
  for (const [dk, yr] of requiredMilestones) {
    const dynObj = dynasties.find((x) => x.key === dk);
    assert(dynObj && dynObj.milestones.some((m) => m.year === yr), `Missing required milestone ${dk}:${yr}`);
  }
  const donghanMs = dynasties.find((x) => x.key === 'donghan').milestones;
  assert(
    donghanMs.find((m) => m.year === 89).headline.includes('燕然') &&
      donghanMs.find((m) => m.year === 91).headline.includes('金微山'),
    'donghan: 燕然勒石 must be dated 89 CE and 91 CE must be the Battle of Mt. Jinwei'
  );
  const jintianEv = dynasties.find((x) => x.key === 'qing').milestones.find((m) => m.year === 1851);
  assert(jintianEv && Math.abs(jintianEv.coord[0] - 110.08) < 0.5 && Math.abs(jintianEv.coord[1] - 23.53) < 0.5, 'qing:1851 Jintian Uprising must be located at Guiping, Guangxi');
  const requiredLandmarks = [
    ['zhanguo', -375],
    ['zhanguo', -249],
    ['qin', -219],
    ['qin', -210],
    ['xihan', -195],
    ['xihan', -106],
    ['xihan', 4],
    ['xihan', 18],
    ['sanguo', 260],
    ['xijin', 307],
    ['nanbei', 540],
    ['wudai', 927],
    ['wudai', 952],
    ['beisong', 1004],
    ['beisong', 1008],
    ['beisong', 1032],
    ['beisong', 1053],
    ['nansong', 1276],
    ['ming', 1402],
    ['ming', 1600],
    ['qing', 1658],
    ['qing', 1662],
    ['qing', 1678],
    ['qing', 1684],
    ['donghan', 166],
    ['donghan', 207],
    ['nanbei', 460],
    ['nanbei', 523],
    ['nanbei', 546],
    ['yuan', 1281],
    ['yuan', 1346],
    ['yuan', 1352],
    ['qing', 1776],
    ['qing', 1793],
    ['qing', 1842],
    ['qing', 1884],
    ['qing', 1895],
  ];
  for (const [dk, yr] of requiredLandmarks) {
    assert(
      loreData.PLACE_LANDMARK_EVENTS.some((ev) => ev.dynastyKey === dk && ev.year === yr),
      `Missing required PLACE_LANDMARK_EVENTS entry ${dk}:${yr}`
    );
  }
  for (const sk of ['s_ming_b']) {
    const mingPol = snapshots[sk].polities.find((p) => p.title === '明');
    assert(
      mingPol &&
        mingPol.shape.type === 'MultiPolygon' &&
        mingPol.shape.coordinates.length === 4 &&
        mingPol.shape.coordinates.filter((p) => p[0].length > 200).length === 1,
      `${sk} Ming polity must have 4 disjoint sub-polygons (Mainland, Hainan, Yuzhou & Chongming islands; no duplicate overlapping mainland polygon)`
    );
    const jurchenPol = snapshots[sk].polities.find((p) => p.title === '女真诸部');
    assert(jurchenPol && jurchenPol.role === 'neighbor', `${sk} must include 女真诸部 neighbor polity in the Northeast`);
  }

  // Verify Western Regions Great Lakes (Lop Nur vanish 1972, labels, and gazetteer resolution)
  const lopNurLake = (sandbox.window.HYDRO_DATA.lakes || []).find((l) => l.name === 'Lop Nur');
  assert(
    lopNurLake && lopNurLake.rank === 2 && lopNurLake.vanish === 1972,
    `Lop Nur lake must have rank 2 and vanish 1972, got ${JSON.stringify(lopNurLake)}`
  );
  const lopNurLabel = (sandbox.window.HYDRO_DATA.labels || []).find((lb) => lb.zh === '蒲昌海·罗布泊');
  assert(
    lopNurLabel && lopNurLabel.vanish === 1972,
    `蒲昌海·罗布泊 hydro label must have vanish 1972, got ${JSON.stringify(lopNurLabel)}`
  );
  for (const westernLake of ['蒲昌海', '博斯腾湖', '热海', '夷播海', '居延海']) {
    const hit = ctrl.resolvePlace(westernLake, 741);
    assert(
      hit && hit.kind === 'gazetteer',
      `Expected Western Regions lake "${westernLake}" to resolve via PLACE_GAZETTEER, got ${JSON.stringify(hit)}`
    );
  }
  const culturalPlacesList = [
    '曲阜', '孔庙', '琅琊', '琅琊台', '景德镇', '昌南镇', '宁古塔',
    '潍坊', '密州', '广元', '利州', '忻州', '代州', '吴忠', '灵州', '阿克苏', '龟兹', '和田', '于阗',
    '牡丹江', '上京龙泉府', '通化', '国内城', '崇左', '太平府', '锡林郭勒', '元上都', '阿拉善', '黑水城',
    '眉山', '眉州', '上饶', '信州', '陇南', '武都',
    '淮安', '楚州', '温州', '永嘉', '嘉兴', '秀州', '金华', '婺州', '衢州', '丽水', '处州',
    '亳州', '谯郡', '黄山', '徽州', '阜阳', '颍州', '连云港', '海州', '南通', '盐城', '无锡',
    '南充', '阆中', '宜宾', '叙州', '乐山', '嘉州', '泸州', '达州', '凉山', '西昌',
    '抚州', '临川', '宜春', '袁州', '莆田', '兴化军', '荆门', '当阳', '随州', '十堰', '武当山',
    '邵阳', '宝庆府', '郴州', '怀化', '芷江', '韶关', '韶州', '肇庆', '端州', '湛江', '雷州',
    '茂名', '高州', '梧州', '北海', '合浦', '三亚', '崖州', '平凉', '庆阳', '保山', '永昌',
    '红河', '建水', '山南', '桑耶寺', '阿里', '古格', '烟台', '登州', '芝罘', '龙岩', '汀州', '三明', '宁化', '武川镇', '怀朔镇',
  ];
  for (let cIdx = 0; cIdx < culturalPlacesList.length; cIdx++) {
    if (FAST_MODE && cIdx % 5 !== 0) continue;
    const culturalPlace = culturalPlacesList[cIdx];
    const hit = ctrl.resolvePlace(culturalPlace, 1076);
    assert(
      hit && Array.isArray(hit.coord) && hit.coord.length === 2,
      `Expected cultural/historical place "${culturalPlace}" to resolve with valid coordinates, got ${JSON.stringify(hit)}`
    );
  }
  const controlStripMatch = indexHtml.match(/<div class="control-strip"[\s\S]*?<\/div>\s*<div id="layers-popover"/);
  assert(
    controlStripMatch &&
      !controlStripMatch[0].includes('id="act-challenge"') &&
      !controlStripMatch[0].includes('id="act-journey-menu"') &&
      !indexHtml.includes('id="journey-popover"') &&
      appCode.includes('sr-quiz-link'),
    '.control-strip must stay minimal without #act-journey-menu or #act-challenge, and Quiz must mount cleanly in the search box dropdown'
  );
  assert(
    indexHtml.includes('id="scale-label-text">500 km</div>') &&
      !appCode.includes('_formatChineseLi'),
    'Expected #scale-label-text to use clean metric km format without _formatChineseLi'
  );

  // ── 24. CUJ 24: Place Genealogy (点地溯源) Full 18-Era Coverage to Present (PRC) & ROC/PRC City Resolution ──
  const yueyang2026 = ctrl.inspect({ year: 2026, place: '岳阳' });
  assert.strictEqual(yueyang2026.polity, '中华人民共和国', 'inspect(2026, 岳阳) must return polity 中华人民共和国');
  assert(
    Array.isArray(yueyang2026.regions) &&
      yueyang2026.regions.length === 1 &&
      yueyang2026.regions[0] === '湖南省' &&
      Array.isArray(yueyang2026.prefectures) &&
      yueyang2026.prefectures.includes('岳阳') &&
      yueyang2026.nearestCity &&
      yueyang2026.nearestCity.ancient === '岳阳' &&
      yueyang2026.nearestCity.distanceKm <= 10,
    `inspect(2026, 岳阳) must resolve 湖南省 · 岳阳 within <=10 km, got ${JSON.stringify(yueyang2026)}`
  );
  const yueyang1936 = ctrl.inspect({ year: 1936, place: '岳阳' });
  assert(
    yueyang1936.nearestCity &&
      yueyang1936.nearestCity.ancient === '岳阳' &&
      yueyang1936.nearestCity.distanceKm <= 10,
    `inspect(1936, 岳阳) in ROC must resolve local city 岳阳 (<=10 km) rather than Changsha (127 km), got ${JSON.stringify(yueyang1936.nearestCity)}`
  );
  assert(
    !String(ctrl.openGenealogyAt).includes("if (d.key === 'prc') continue;"),
    'openGenealogyAt must not skip d.key === "prc" so Place Genealogy covers all 18 eras up to the present day'
  );
  const mockTimelineItems = [];
  const mockHeadingEl = { textContent: '' };
  const mockSubEl = { innerHTML: '', textContent: '', querySelector: () => null };
  const mockLoreEl = {
    innerHTML: '',
    isHidden: true,
    classList: {
      remove(c) {
        if (c === 'is-hidden') mockLoreEl.isHidden = false;
      },
      add(c) {
        if (c === 'is-hidden') mockLoreEl.isHidden = true;
      },
      contains(c) {
        return c === 'is-hidden' ? mockLoreEl.isHidden : false;
      },
    },
  };
  const mockCardEl = { classList: { remove() {}, add() {}, contains: () => false } };
  const mockListEl = {
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 500,
    offsetTop: 0,
    get children() {
      return mockTimelineItems;
    },
    set innerHTML(_v) {
      mockTimelineItems.length = 0;
    },
    appendChild(li) {
      mockTimelineItems.push(li);
    },
    querySelector: () => null,
  };
  const prevDoc = sandbox.document;
  sandbox.document = {
    createElement(tag) {
      return {
        tag,
        className: '',
        innerHTML: '',
        offsetTop: 0,
        offsetHeight: 28,
        classList: { add() {}, remove() {}, contains: () => false },
        querySelectorAll: () => [],
        addEventListener() {},
      };
    },
  };
  const prevIdForGen = ctrl._id;
  ctrl._id = (id) => {
    if (id === 'genealogy-heading') return mockHeadingEl;
    if (id === 'genealogy-sub') return mockSubEl;
    if (id === 'genealogy-lore') return mockLoreEl;
    if (id === 'genealogy-card') return mockCardEl;
    if (id === 'genealogy-timeline') return mockListEl;
    return null;
  };
  ctrl.grpGenealogy = { innerHTML: '' };
  ctrl._dismissTraceOnboarding = () => {};
  ctrl._rescaleSvgTypography = () => {};
  ctrl._syncTracedPrefecture = () => {};
  ctrl._fullSnapshotsLoaded = true;
  ctrl.year = 2026;
  ctrl.dynastyIdx = 17;
  ctrl.openGenealogyAt(113.13, 29.36, null, { fromYearSync: true });
  assert.strictEqual(
    mockTimelineItems.length,
    18,
    `Expected openGenealogyAt to render all 18 dynasty rows including PRC, got ${mockTimelineItems.length}`
  );
  assert(
    !mockLoreEl.isHidden &&
      mockLoreEl.innerHTML.includes('名城形胜') &&
      mockLoreEl.innerHTML.includes('洞庭湖口 · 江湖锁钥'),
    `Expected #genealogy-lore at Yueyang to render curated city lore banner, got ${mockLoreEl.innerHTML}`
  );
  const tangRowHtml = mockTimelineItems[9].innerHTML;
  const rocRowHtml = mockTimelineItems[16].innerHTML;
  const prcRowHtml = mockTimelineItems[17].innerHTML;
  assert(
    tangRowHtml.includes('邻近古城：岳州（即此地）') &&
      tangRowHtml.includes('开元四年张说谪守岳州，始建岳阳楼'),
    `Expected Tang row at Yueyang to surface per-dynasty settlement remark 开元四年张说谪守岳州，始建岳阳楼, got ${tangRowHtml}`
  );
  assert(
    rocRowHtml.includes('中华民国') && rocRowHtml.includes('邻近古城：岳阳（即此地）'),
    `Expected ROC row at Yueyang to resolve 邻近古城：岳阳（即此地）, got ${rocRowHtml}`
  );
  assert(
    prcRowHtml.includes('中华人民共和国') &&
      prcRowHtml.includes('湖南省 · 岳阳') &&
      prcRowHtml.includes('现代城市：岳阳（即此地）'),
    `Expected PRC row at Yueyang to display 湖南省 · 岳阳 and 现代城市：岳阳（即此地）, got ${prcRowHtml}`
  );
  ctrl.openGenealogyAt(112.24, 30.33, null, { fromYearSync: true });
  assert.strictEqual(mockTimelineItems.length, 18, 'Expected 18 rows at Jingzhou (江陵)');
  assert(
    !mockLoreEl.isHidden &&
      mockLoreEl.innerHTML.includes('名城形胜') &&
      mockLoreEl.innerHTML.includes('荆楚雄都 · 江汉锁钥'),
    `Expected #genealogy-lore at Jingzhou to render curated city lore banner, got ${mockLoreEl.innerHTML}`
  );
  const jzQingHtml = mockTimelineItems[15].innerHTML;
  const jzRocHtml = mockTimelineItems[16].innerHTML;
  const jzPrcHtml = mockTimelineItems[17].innerHTML;
  assert(
    jzQingHtml.includes('荆州府') && !jzQingHtml.includes('宜昌府'),
    `Expected Qing row at Jingzhou not to show misleading 100 km neighbor 宜昌府, got ${jzQingHtml}`
  );
  assert(
    jzRocHtml.includes('邻近古城：荆州（即此地）') &&
      jzPrcHtml.includes('湖北省 · 荆州') &&
      jzPrcHtml.includes('现代城市：荆州（即此地）'),
    `Expected ROC and PRC rows at Jingzhou to resolve 荆州（即此地）, got ROC=${jzRocHtml} PRC=${jzPrcHtml}`
  );
  ctrl.openGenealogyAt(113.38, 31.69, null, { fromYearSync: true });
  assert(
    !mockLoreEl.isHidden &&
      mockLoreEl.innerHTML.includes('城池形胜') &&
      mockLoreEl.innerHTML.includes('曾侯乙墓'),
    `Expected #genealogy-lore at non-curated city Suizhou to render synthesized City Profile banner, got ${mockLoreEl.innerHTML}`
  );
  ctrl.openGenealogyAt(110.9, 34.64, null, { fromYearSync: true });
  assert(
    !mockLoreEl.isHidden &&
      mockLoreEl.innerHTML.includes('雄关形胜'),
    `Expected #genealogy-lore at Hangu Pass to render Strategic Pass banner, got ${mockLoreEl.innerHTML}`
  );
  const prevLocaleGen = ctrl.locale;
  ctrl.locale = 'en';
  const genSampleSettlements = FAST_MODE
    ? [dynasties[0].settlements[0], dynasties[9].settlements[0]]
    : dynasties[0].settlements.concat(dynasties[9].settlements, dynasties[17].settlements);
  for (const s of genSampleSettlements) {
    ctrl.openGenealogyAt(s.coord[0], s.coord[1], s.ancient, { fromYearSync: true });
    assert(
      mockHeadingEl.textContent && !/[\u4e00-\u9fa5]/.test(mockHeadingEl.textContent),
      `English genealogy-heading for ${s.ancient} contains CJK: "${mockHeadingEl.textContent}"`
    );
    assert(
      mockLoreEl.innerHTML && !/[\u4e00-\u9fa5]/.test(mockLoreEl.innerHTML),
      `English genealogy-lore for ${s.ancient} contains CJK: "${mockLoreEl.innerHTML}"`
    );
  }
  ctrl.locale = prevLocaleGen;
  ctrl._id = prevIdForGen;
  sandbox.document = prevDoc;

  // 23b. Verify ROC & PRC modern settlement coverage, zero compound/duplicate city names, and traced Tier-2 city visibility
  const rocDyn = dynasties.find((d) => d.key === 'roc');
  const prcDyn = dynasties.find((d) => d.key === 'prc');
  assert(
    rocDyn && rocDyn.settlements.length >= 180 && prcDyn && prcDyn.settlements.length >= 185,
    `Expected ROC (>=180) and PRC (>=185) to include deduplicated modern cities, got ROC=${rocDyn && rocDyn.settlements.length}, PRC=${prcDyn && prcDyn.settlements.length}`
  );
  for (const modCity of ['淮安', '温州', '嘉兴', '金华', '衢州', '丽水', '亳州', '阜阳', '连云港', '南通', '盐城', '无锡', '宜宾', '乐山', '泸州', '达州', '抚州', '宜春', '莆田', '随州', '邵阳', '郴州', '韶关', '肇庆', '梧州', '崇左', '三亚', '平凉', '庆阳', '保山', '山南', '阿里', '潍坊', '黄山', '南充', '西昌', '马鞍山', '运城', '绵阳', '酒泉', '抚顺', '牡丹江', '济宁', '怀化', '北海', '锡林郭勒', '忻州', '吴忠', '通化', '湛江', '茂名', '红河', '张家口', '葫芦岛', '日喀则', '江门', '赤峰', '定西', '海东', '淮南', '驻马店', '南平', '宝鸡', '周口', '烟台', '龙岩', '三明']) {
    assert(
      prcDyn.settlements.some((s) => s.modern === modCity && s.ancient === modCity) &&
        rocDyn.settlements.some((s) => s.modern === modCity),
      `Expected clean city "${modCity}" to be present on both ROC and PRC maps`
    );
  }
  const bannedUnseparated = new Set([
    '南平建瓯', '南阳邓州', '周口淮阳', '呼和浩特托克托', '宝鸡凤翔', '张家口蔚县',
    '抚顺新宾', '济宁曲阜', '牡丹江海林', '石家庄平山', '绵阳三台', '葫芦岛兴城',
    '运城夏县', '运城永济', '邢台平乡', '邯郸临漳', '郑州荥阳', '酒泉瓜州',
    '青岛平度东南', '青岛黄岛', '马鞍山当涂',
  ]);
  for (const d of dynasties) {
    for (const s of d.settlements || []) {
      assert(
        !bannedUnseparated.has(s.modern) && !bannedUnseparated.has(s.ancient),
        `Dynasty ${d.key} settlement "${s.ancient}" (modern="${s.modern}") must not use unseparated city+county compound name`
      );
    }
  }
  for (const modDyn of [rocDyn, prcDyn]) {
    const seenAnc = new Set();
    const seenMod = new Set();
    for (const s of modDyn.settlements) {
      assert(
        !s.ancient.includes('·') && !s.modern.includes('·'),
        `${modDyn.key} settlement "${s.ancient}" (modern="${s.modern}") must use a clean single city name without "·" compound`
      );
      assert(
        !seenAnc.has(s.ancient) && !seenMod.has(s.modern),
        `${modDyn.key} must not contain duplicate city "${s.ancient}" / "${s.modern}"`
      );
      seenAnc.add(s.ancient);
      seenMod.add(s.modern);
    }
  }
  assert(
    styleCss.includes('.settlement-node.is-tier2.is-trace-city') &&
      appCode.includes("node.classList.toggle('is-trace-city', isTraced)"),
    'style.css and app.js must keep traced Tier-2 cities visible (.is-trace-city)'
  );
  ctrl.dynastyIdx = 17;
  ctrl.year = 2026;
  const wfHits = ctrl._queryQuickSearch('潍坊');
  assert(
    wfHits.length > 0 && wfHits[0].kind === 'city' && wfHits[0].dynasty.key === 'prc',
    `Expected searching "潍坊" in PRC era to rank PRC city entry first, got ${JSON.stringify(wfHits[0] && { kind: wfHits[0].kind, dyn: wfHits[0].dynasty && wfHits[0].dynasty.key, title: wfHits[0].titleZh })}`
  );

  // 23c. Verify deduplicated modern province boundary paths & PRC boundary styling
  if (!FAST_MODE) {
    const provBounds = ctrl._buildProvinceBoundaryPaths();
    assert(
      provBounds &&
        typeof provBounds.interior === 'string' &&
        provBounds.interior.length > 6000 &&
        provBounds.interior.length < 75000 &&
        typeof provBounds.outer === 'string' &&
        provBounds.outer.length > 6000 &&
        provBounds.outer.length < 75000 &&
        provBounds.combined === `${provBounds.interior}${provBounds.outer}` &&
        Array.isArray(provBounds.tiles) &&
        provBounds.tiles.length >= 4 &&
        provBounds.tiles.length <= 12,
      `Expected _buildProvinceBoundaryPaths to return topology-simplified tiled interior/outer SVG paths, got interior=${provBounds && provBounds.interior && provBounds.interior.length} outer=${provBounds && provBounds.outer && provBounds.outer.length} tiles=${provBounds && provBounds.tiles && provBounds.tiles.length}`
    );
    assert.strictEqual(
      ctrl._buildProvinceBoundaryPaths(),
      provBounds,
      '_buildProvinceBoundaryPaths must return cached boundary object on subsequent calls'
    );
  }
  assert(
    styleCss.includes('.province-boundary-casing') &&
      styleCss.includes('.province-boundary-interior') &&
      styleCss.includes('.province-boundary-outer') &&
      styleCss.includes('#atlas-svg[data-dynasty="prc"] .province-boundary-interior') &&
      styleCss.includes('#atlas-svg[data-dynasty="prc"] .province-boundary-outer') &&
      styleCss.includes('#grp-provinces.is-hidden .province-boundary-interior') &&
      appCode.includes('this.svg.dataset.dynasty = dynasty.key'),
    'style.css and app.js must style cased modern province boundaries across historical and PRC eras and hide them when #grp-provinces.is-hidden is active'
  );

  // 23d. Verify hovering in regions without secondary prefectures (e.g. Western Sichuan / 剑南道 in Tang) does not highlight the entire polity, non-PRC eras do not hover-highlight modern provinces, and canonical place registry unifies openGenealogyAt & _inspectCoord
  assert(
    !/\.polity-shape:hover\b/.test(styleCss) &&
      !/^\.province-shape:not\(\.maritime-dash\):hover\b/m.test(styleCss) &&
      styleCss.includes('#atlas-svg[data-dynasty="prc"] .province-shape:not(.maritime-dash):hover') &&
      styleCss.includes('#grp-polities.has-polity-focus .polity-shape.is-focused') &&
      appCode.includes('this.lastRenderedSnap.regions.find') &&
      appCode.includes('_getCanonicalPlaces()') &&
      appCode.includes('_resolveEraPlaceAt('),
    'style.css and app.js must scope province hover to PRC only, prevent whole-polity hover highlight, resolve macro-regions in inspectPointTooltip, and unify spatial resolution via _getCanonicalPlaces and _resolveEraPlaceAt'
  );
  const canonPlaces = ctrl._getCanonicalPlaces();
  assert(
    Array.isArray(canonPlaces) && canonPlaces.length >= 220 && ctrl._getCanonicalPlaces() === canonPlaces,
    `Expected cached _getCanonicalPlaces() to return >=220 canonical places, got ${canonPlaces && canonPlaces.length}`
  );

  // 23e. Verify autoplay aria-pressed state, timeline band button accessibility, SEO directory locale sync, and quick search cleanup
  assert(
    indexHtml.includes('aria-pressed="false"') &&
      indexHtml.includes('id="seo-atlas-directory" class="sr-only-seo" aria-hidden="true"') &&
      styleCss.includes('pointer-events: none !important;') &&
      appCode.includes('_updateAutoplayUi()') &&
      appCode.includes('_syncSeoDirectoryLocale()') &&
      appCode.includes('_clearQuickSearchInput()') &&
      appCode.includes("cell.setAttribute('role', 'button')"),
    'index.html, style.css, and app.js must include autoplay aria-pressed state, accessible timeline band buttons, SEO directory locale sync, and quick search cleanup'
  );
  const mockSeoNav = {
    innerHTML: '<h2>江山时序</h2>',
    dataset: {},
    setAttribute(k, v) {
      this[k] = v;
    },
  };
  const mockSearchInp = {
    value: "Chang'an",
    blurred: false,
    blur() {
      this.blurred = true;
    },
  };
  const origId23e = ctrl._id;
  ctrl._id = (id) => {
    if (id === 'seo-atlas-directory') return mockSeoNav;
    if (id === 'inp-map-search') return mockSearchInp;
    return origId23e ? origId23e.call(ctrl, id) : null;
  };
  ctrl.locale = 'en';
  ctrl._syncSeoDirectoryLocale();
  assert(
    mockSeoNav.dataset.locale === 'en' &&
      mockSeoNav.innerHTML.includes('Warring States Historical Map') &&
      mockSeoNav.innerHTML.includes("People's Republic of China Historical Map") &&
      !/[\u4e00-\u9fff]/.test(mockSeoNav.innerHTML),
    'In English mode, _syncSeoDirectoryLocale() must translate all 18 dynasty entries with zero remaining CJK characters'
  );
  ctrl.locale = 'zh';
  ctrl._syncSeoDirectoryLocale();
  assert.strictEqual(mockSeoNav.innerHTML, '<h2>江山时序</h2>', '_syncSeoDirectoryLocale() must restore Chinese HTML when switching back to zh');
  ctrl._clearQuickSearchInput();
  assert.strictEqual(mockSearchInp.value, '', '_clearQuickSearchInput() must clear #inp-map-search value');
  ctrl._id = origId23e;

  // 23f. Verify Dali (大理, 937–1253 CE), Nanzhao (南诏, 649–936 CE), and unified Tubo (吐蕃, 618–877 CE) vs fragmented Tibetan polities (吐蕃诸部, 880–1246 CE)
  if (!FAST_MODE) {
  const daliSnapKeys = [
    's_wudai_c0',
    's_wudai_c',
    's_wudai_c2',
    's_wudai_d',
    's_wudai_e',
    's_wudai_e1',
    's_wudai_e2',
    's_beisong_a0',
    's_beisong_a',
    's_beisong_a2',
    's_beisong_a3',
    's_beisong_a4',
    's_beisong_a5',
    's_beisong_b0',
    's_beisong_b',
    's_beisong_b1',
    's_beisong_b2',
    's_beisong_c',
    's_beisong_d',
    's_nansong_a0',
    's_nansong_a',
    's_nansong_b0',
    's_nansong_c',
    's_nansong_d',
    's_nansong_e',
  ];
  for (const sk of daliSnapKeys) {
    const daliPol = (snapshots[sk].polities || []).find((p) => p.title === '大理');
    assert(
      daliPol && daliPol.role === 'rival' && daliPol.tint === '#7a5c91',
      `${sk} must model 大理 as role="rival" with tint="#7a5c91"`
    );
    assert(
      pointInShape(100.271, 25.611, daliPol.shape),
      `${sk}: 大理 polygon must contain Dali capital ([100.271, 25.611])`
    );
  }
  for (const dk of ['wudai', 'beisong', 'nansong']) {
    const dynObj = dynasties.find((d) => d.key === dk);
    const daliSet = (dynObj.settlements || []).find((s) => s.ancient === '大理');
    assert(
      daliSet && (!daliSet.tier || daliSet.tier === 1),
      `${dk} must define 大理 capital as a Tier-1 settlement visible at default zoom`
    );
  }
  const tangSnapKeys = Object.keys(snapshots).filter((k) => k.startsWith('s_tang'));
  assert(tangSnapKeys.length === 28, `Expected 28 s_tang* snapshots, found ${tangSnapKeys.length}`);
  // Issue #267. Tang northeast: 平壤 is 安东's seat until 676, never 新罗's before 702;
  // 震国 (698–713) is renamed 渤海 only from 713; 安西 / 北庭 hold oases, not the desert, in 764–790;
  // the Four Garrisons fall to 吐蕃 in 670–679 and 686–692, when 安西 falls back to 西州.
  {
    const pol = (sk, title) => (snapshots[sk].polities || []).find((p) => p.title === title);
    const pyongyang = [125.75, 39.02];
    const dunhua = [128.2, 43.37];
    assert(pointInShape(...pyongyang, pol('s_tang_a4', '安东都护府').shape), 's_tang_a4: 平壤 must be inside 安东都护府');
    assert(pointInShape(...pyongyang, pol('s_tang_a4b', '安东都护府').shape), 's_tang_a4b: 平壤 must be inside 安东都护府');
    for (const sk of ['s_tang_a4', 's_tang_a4b', 's_tang_a6', 's_tang_a', 's_tang_a7', 's_tang_wz0', 's_tang_wz1', 's_tang_wz1b']) {
      assert(!pointInShape(...pyongyang, pol(sk, '新罗').shape), `${sk}: 平壤 must not be inside 新罗`);
    }
    for (const sk of ['s_tang_a6', 's_tang_a', 's_tang_a7', 's_tang_wz0', 's_tang_wz1', 's_tang_wz1b']) {
      assert(!pointInShape(...pyongyang, pol(sk, '安东都护府').shape), `${sk}: 安东都护府 must have left 平壤 (676)`);
    }
    for (const sk of ['s_tang_wz1b', 's_tang_wz2', 's_tang_a5z']) {
      const zhen = pol(sk, '震国');
      assert(zhen && !pol(sk, '渤海') && pointInShape(...dunhua, zhen.shape), `${sk}: 敦化 must be inside 震国, not 渤海`);
    }
    assert(!pointInShape(...dunhua, pol('s_tang_wz1b', '安东都护府').shape), 's_tang_wz1b: 敦化 must not be inside 安东都护府');
    assert(pol('s_tang_a5', '渤海') && !pol('s_tang_a5', '震国'), 's_tang_a5 (713–755) must show 渤海');
    const kucha = [82.96, 41.72];
    const xizhou = [89.18, 42.95];
    for (const sk of ['s_tang_a4', 's_tang_a', 's_tang_wz1']) {
      assert(pointInShape(...kucha, pol(sk, '安西都护府').shape), `${sk}: 龟兹 must be inside 安西都护府`);
    }
    for (const [sk, title] of [['s_tang_a4b', '安西都护府（西州）'], ['s_tang_a6', '安西都护府（西州）'], ['s_tang_a7', '安西都护府'], ['s_tang_wz0', '安西都护府']]) {
      const lostAnxi = pol(sk, title);
      assert(lostAnxi && pointInShape(...xizhou, lostAnxi.shape), `${sk}: 西州 must be inside ${title}`);
      assert(pointInShape(88.17, 39.02, lostAnxi.shape), `${sk}: 石城镇 (under 沙州 from 675) must stay inside ${title}`);
      assert(!pointInShape(...kucha, lostAnxi.shape), `${sk}: 龟兹 must not be inside 安西都护府 (lost to 吐蕃)`);
      for (const pt of [kucha, [79.93, 37.11], [75.99, 39.47], [86.57, 42.06]]) {
        assert(pointInShape(...pt, pol(sk, '吐蕃').shape), `${sk}: ${pt} (a Four Garrisons town) must be inside 吐蕃`);
      }
    }
    const anxi = pol('s_tang_b1', '安西都护府（孤悬坚守）').shape;
    const beiting = pol('s_tang_b1', '北庭都护府（孤悬坚守）').shape;
    for (const [name, pt] of [['龟兹', [82.96, 41.72]], ['于阗', [79.93, 37.11]], ['疏勒', [75.99, 39.47]], ['西州', [89.18, 42.95]]]) {
      assert(pointInShape(...pt, anxi), `s_tang_b1: ${name} must be inside 安西都护府`);
    }
    assert(pointInShape(89.18, 44.0, beiting), 's_tang_b1: 北庭 must be inside 北庭都护府');
    assert(!pointInShape(81.3, 43.9, beiting), 's_tang_b1: 伊犁 (lost to the Karluks in 766) must not be inside 北庭都护府');
    assert(pointInShape(79.4, 35.6, pol('s_tang_b1', '吐蕃').shape), 's_tang_b1: the Kunlun strip must belong to 吐蕃');
  }
  // Southwest frontier 25–1644: 蜀 / 宋 stop at the 岷山–大渡河 line (雅州 inside, 康定 outside),
  // 建昌 (西昌) belongs to 大长和 / 大理, and 腾冲 is inside 大理, 元 and 明.
  {
    const ownerAt = (sk, pt) => {
      const p = (snapshots[sk].polities || []).find((q) => q.role && pointInShape(...pt, q.shape));
      return p ? p.title : null;
    };
    const YAAN = [103.0, 29.98], KANGDING = [101.96, 30.05], XICHANG = [102.26, 27.9], TENGCHONG = [98.49, 25.02];
    for (const [sk, shu, dali] of [['s_wudai_c', '后蜀', '大理'], ['s_beisong_a0', '后蜀', '大理'], ['s_beisong_b0', '宋', '大理'], ['s_nansong_a', '南宋', '大理']]) {
      assert.strictEqual(ownerAt(sk, YAAN), shu, `${sk}: 雅州 (雅安) must belong to ${shu}`);
      const k = ownerAt(sk, KANGDING);
      assert(k && k !== shu, `${sk}: 康定 (west of the 大渡河) must belong to the Tibetan side, got ${k}`);
      assert.strictEqual(ownerAt(sk, XICHANG), dali, `${sk}: 建昌 (西昌) must belong to ${dali}`);
      assert.strictEqual(ownerAt(sk, TENGCHONG), dali, `${sk}: 腾冲 must belong to ${dali}`);
    }
    // 唐 621–738: no 南诏 yet (六诏 + 唐 羁縻 in 滇东); 南诏 from 738.
    for (const sk of ['s_tang_a0', 's_tang_a', 's_tang_wz1', 's_tang_a5y']) {
      assert(!(snapshots[sk].polities || []).some((p) => p.title === '南诏'), `${sk}: 南诏 must not exist before 738`);
      assert.strictEqual(ownerAt(sk, [100.23, 25.6]), '六诏', `${sk}: 洱海 must belong to 六诏 before 738`);
      assert(['唐', '武周'].includes(ownerAt(sk, [102.71, 25.04])), `${sk}: 昆州 (昆明) must belong to 唐 / 武周 before 738`);
    }
    assert.strictEqual(ownerAt('s_tang_a5', [100.23, 25.6]), '南诏', 's_tang_a5 (738–755): 大理 must belong to 南诏');
    // 唐 764–907: 南诏 stops at the 南盘江 (贵阳 / 安顺 are 唐); 雅州 stays 唐 / 西川; 嶲州 follows
    // 吐蕃 (764–790) → 唐 (790–880) → 南诏 (880–907).
    for (const sk of ['s_tang_b1', 's_tang_b', 's_tang_c', 's_tang_d1']) {
      for (const pt of [[106.71, 26.58], [105.95, 26.25]]) assert.strictEqual(ownerAt(sk, pt), '唐', `${sk}: ${pt} (黔中) must belong to 唐, not 南诏`);
      assert.strictEqual(ownerAt(sk, [103.0, 29.98]), '唐', `${sk}: 雅州 (雅安) must belong to 唐`);
    }
    assert.strictEqual(ownerAt('s_tang_d2', [103.0, 29.98]), '西川（王建）', 's_tang_d2: 雅州 must belong to 西川（王建）');
    for (const [sk, who] of [['s_tang_b1', '吐蕃'], ['s_tang_b', '唐'], ['s_tang_c', '唐'], ['s_tang_d1', '南诏'], ['s_tang_d2', '南诏']]) {
      assert.strictEqual(ownerAt(sk, [102.26, 27.9]), who, `${sk}: 嶲州 (西昌) must belong to ${who}`);
    }
    // 1351–1388: northern 越南 is 大越 / 安南, not blank.
    for (const sk of ['s_yuan_b', 's_yuan_c', 's_ming_0a', 's_ming_0c', 's_ming_0d']) {
      assert(ownerAt(sk, [104.5, 22.1]) || (snapshots[sk].polities || []).some((q) => q.role === 'neighbor' && pointInShape(104.5, 22.1, q.shape)), `${sk}: 104.5,22.1 must not be blank`);
    }
    // 东汉–隋: 叶榆 (大理) and 不韦 (保山) are Han counties; 永昌郡 (69 CE) adds 腾冲 for 73–347;
    // 隋 keeps 昆明 (南宁州) in 589–614.
    const DALI = [100.23, 25.6], BAOSHAN = [99.16, 25.11], KUNMING = [102.71, 25.04];
    for (const [sk, main] of [['s_donghan_b2', '东汉'], ['s_donghan', '东汉'], ['s_sanguo', '蜀汉'], ['s_dongjin_a', '成汉'], ['s_dongjin_b', '东晋'], ['s_nanbei_c', '梁'], ['s_sui_a', '隋'], ['s_sui', '隋']]) {
      assert.strictEqual(ownerAt(sk, DALI), main, `${sk}: 叶榆 (大理) must belong to ${main}`);
      assert.strictEqual(ownerAt(sk, BAOSHAN), main, `${sk}: 不韦 (保山) must belong to ${main}`);
    }
    for (const [sk, main] of [['s_donghan', '东汉'], ['s_sanguo', '蜀汉'], ['s_dongjin_a', '成汉']]) {
      assert.strictEqual(ownerAt(sk, TENGCHONG), main, `${sk}: 腾冲 (永昌郡) must belong to ${main}`);
    }
    for (const sk of ['s_sui', 's_sui_c']) assert.strictEqual(ownerAt(sk, KUNMING), '隋', `${sk}: 昆明 must belong to 隋, not 泰人诸邦`);
    // No hole between 益州 / 蜀 and 交州 south of 蒙自 and 文山 (兴古郡), 189–413.
    for (const sk of ['s_donghan_d2', 's_sanguo', 's_sanguo_c', 's_dongjin_a', 's_dongjin_b', 's_dongjin_d']) {
      for (const pt of [[104.3, 22.75], [103.3, 22.3], [104.62, 24.5]]) assert(ownerAt(sk, pt), `${sk}: ${pt} must not be a hole between 益州 and 交州`);
    }
    for (const [sk, main] of [['s_yuan', '元'], ['s_ming_a0', '明'], ['s_ming_b', '明']]) {
      assert.strictEqual(ownerAt(sk, TENGCHONG), main, `${sk}: 腾冲 must belong to ${main}`);
    }
  }
  const unifiedTuboSnapKeys = tangSnapKeys.filter((k) => k !== 's_tang_d1' && k !== 's_tang_d2');
  for (const sk of unifiedTuboSnapKeys) {
    const tuboPol = (snapshots[sk].polities || []).find((p) => p.title === '吐蕃');
    assert(
      tuboPol && tuboPol.role === 'rival' && tuboPol.tint === '#a8583b',
      `${sk} must model unified 吐蕃 (618–877 CE) as role="rival" with tint="#a8583b"`
    );
    assert(
      pointInShape(91.111, 29.651, tuboPol.shape),
      `${sk}: 吐蕃 polygon must contain Luoxie/Lhasa capital ([91.111, 29.651])`
    );
  }
  const fragmentedTuboSnapKeys = [
    's_tang_d1',
    's_tang_d2',
    's_wudai_a',
    's_wudai_b1',
    's_wudai_b',
    's_wudai_b2',
    ...daliSnapKeys.filter((k) => k !== 's_nansong_e'),
  ];
  for (const sk of fragmentedTuboSnapKeys) {
    const fragPol = (snapshots[sk].polities || []).find((p) => p.title === '吐蕃诸部');
    assert(
      fragPol && fragPol.role === 'neighbor' && !fragPol.tint,
      `${sk} must model post-877 fragmented Tibet as uncolored 吐蕃诸部 (role="neighbor", tint=null)`
    );
  }
  // 南诏 exists from 738 (before that: 六诏 plus 唐 羁縻 in 滇东; 618–621 爨 · 六诏).
  const preNanzhao = new Set(['s_tang_0', 's_tang_a0', 's_tang_a1', 's_tang_a1b', 's_tang_a2', 's_tang_a2b', 's_tang_a3', 's_tang_a3b', 's_tang_a4', 's_tang_a4b',
    's_tang_a6', 's_tang_a', 's_tang_a7', 's_tang_wz0', 's_tang_wz1', 's_tang_wz1b', 's_tang_wz2', 's_tang_a5z', 's_tang_a5y']);
  const nzSnapKeys = tangSnapKeys.filter((k) => !preNanzhao.has(k));
  assert.strictEqual(nzSnapKeys.length, tangSnapKeys.length - preNanzhao.size, 'every pre-738 Tang snapshot key must exist');
  for (const sk of nzSnapKeys) {
    const nzPol = (snapshots[sk].polities || []).find((p) => p.title === '南诏');
    assert(
      nzPol && nzPol.role === 'rival' && nzPol.tint === '#7a5c91',
      `${sk} must model 南诏 as role="rival" with tint="#7a5c91"`
    );
    assert(
      pointInShape(100.161, 25.691, nzPol.shape),
      `${sk}: 南诏 polygon must contain Taihecheng/Dali capital ([100.161, 25.691])`
    );
    assert(
      pointInShape(102.68, 24.82, nzPol.shape),
      `${sk}: 南诏 polygon must contain Dianchi/Kunming ([102.68, 24.82])`
    );
  }
  const dchSnapKeys = ['s_wudai_a', 's_wudai_b1', 's_wudai_b', 's_wudai_b2'];
  for (const sk of dchSnapKeys) {
    const dchPol = (snapshots[sk].polities || []).find((p) => p.title === '大长和');
    assert(
      dchPol && dchPol.role === 'rival' && dchPol.tint === '#7a5c91',
      `${sk} must model post-902 Yunnan regime as 大长和 (role="rival", tint="#7a5c91")`
    );
    assert(
      pointInShape(100.161, 25.691, dchPol.shape),
      `${sk}: 大长和 polygon must contain Taihecheng/Dali capital ([100.161, 25.691])`
    );
    assert(
      pointInShape(102.68, 24.82, dchPol.shape),
      `${sk}: 大长和 polygon must contain Dianchi/Kunming ([102.68, 24.82])`
    );
  }
  // Verify Wudai (907-960 CE) territorial invariants against Old History of the Five Dynasties (《旧五代史》):
  // 1) Yang Wu (吴) holds Yangzhou ([119.42, 32.39]) and Shouzhou ([116.78, 32.58]) north to the Huai River in 907-936
  for (const sk of ['s_wudai_a', 's_wudai_b1', 's_wudai_b', 's_wudai_b2', 's_wudai_c0']) {
    const wuPol = (snapshots[sk].polities || []).find((p) => p.title === '吴');
    assert(
      wuPol && pointInShape(119.42, 32.39, wuPol.shape) && pointInShape(116.78, 32.58, wuPol.shape),
      `${sk}: 吴 polygon must contain Yangzhou ([119.42, 32.39]) and Shouzhou ([116.78, 32.58]) up to the Huai River`
    );
  }
  // 2) Sixteen Prefectures of Yanyun (Yingzhou [116.09, 38.44], Mozhou [116.10, 38.71], Shuozhou [112.43, 39.32]) in Khitan/Liao (936-958),
  //    then Yingzhou, Mozhou, Yizhou ([115.49, 39.35]), and Waqiao Pass ([116.08, 39.00]) recovered by Later Zhou in 959 (s_wudai_e2)
  for (const sk of ['s_wudai_c0', 's_wudai_c', 's_wudai_c2', 's_wudai_d', 's_wudai_e', 's_wudai_e1']) {
    const liaoPol = (snapshots[sk].polities || []).find((p) => p.title === '契丹' || p.title === '辽');
    assert(
      liaoPol &&
        pointInShape(116.09, 38.44, liaoPol.shape) &&
        pointInShape(116.1, 38.71, liaoPol.shape) &&
        pointInShape(112.43, 39.32, liaoPol.shape),
      `${sk}: ${liaoPol ? liaoPol.title : '契丹/辽'} must contain Yanyun prefectures Yingzhou, Mozhou, and Shuozhou`
    );
  }
  {
    const zhouE2 = (snapshots.s_wudai_e2.polities || []).find((p) => p.title === '后周');
    const liaoE2 = (snapshots.s_wudai_e2.polities || []).find((p) => p.title === '辽');
    assert(
      zhouE2 &&
        pointInShape(116.09, 38.44, zhouE2.shape) &&
        pointInShape(116.1, 38.71, zhouE2.shape) &&
        pointInShape(115.49, 39.35, zhouE2.shape) &&
        pointInShape(116.08, 39.0, zhouE2.shape) &&
        liaoE2 &&
        pointInShape(116.4, 39.9, liaoE2.shape),
      's_wudai_e2 (959 CE): 后周 must contain recovered Yingzhou, Mozhou, Yizhou, and Waqiao Pass while Youzhou remains in 辽'
    );
  }
  // 3) Datong Basin (Yunzhou [113.30, 40.08], Yingzhou [113.19, 39.55], Huanzhou [112.43, 39.57], Shuozhou [112.43, 39.32]) in Liao,
  //    while Daizhou ([112.95, 39.06]) and Taiyuan ([112.55, 37.87]) belong to Northern Han (北汉) in 951-960
  for (const sk of ['s_wudai_e', 's_wudai_e1', 's_wudai_e2']) {
    const liaoPol = (snapshots[sk].polities || []).find((p) => p.title === '辽');
    const bhPol = (snapshots[sk].polities || []).find((p) => p.title === '北汉');
    assert(
      liaoPol &&
        pointInShape(113.3, 40.08, liaoPol.shape) &&
        pointInShape(113.19, 39.55, liaoPol.shape) &&
        pointInShape(112.43, 39.57, liaoPol.shape) &&
        pointInShape(112.43, 39.32, liaoPol.shape) &&
        bhPol &&
        pointInShape(112.95, 39.06, bhPol.shape) &&
        pointInShape(112.55, 37.87, bhPol.shape),
      `${sk}: 辽 must hold Yun, Ying, Huan, Shuo north of Yanmen Pass while 北汉 holds Daizhou and Taiyuan`
    );
  }
  // 4) Fuzhou ([119.30, 26.08]) in Wuyue (吴越) vs Jianzhou ([118.32, 27.02]) in Southern Tang (南唐) after Fall of Min (945-960)
  for (const sk of ['s_wudai_c2', 's_wudai_d', 's_wudai_e', 's_wudai_e1', 's_wudai_e2']) {
    const wyPol = (snapshots[sk].polities || []).find((p) => p.title === '吴越');
    const ntPol = (snapshots[sk].polities || []).find((p) => p.title === '南唐');
    assert(
      wyPol &&
        pointInShape(119.3, 26.08, wyPol.shape) &&
        ntPol &&
        pointInShape(118.32, 27.02, ntPol.shape),
      `${sk}: 吴越 must contain Fuzhou ([119.30, 26.08]) while 南唐 contains Jianzhou ([118.32, 27.02])`
    );
  }
  const tangDynObj = dynasties.find((d) => d.key === 'tang');
  for (const capName of ['逻些', '太和城']) {
    const capSet = (tangDynObj.settlements || []).find((s) => s.ancient === capName);
    assert(
      capSet && (!capSet.tier || capSet.tier === 1),
      `tang must define ${capName} capital as a Tier-1 settlement visible at default zoom`
    );
  }
  function collectVertices(shape) {
    const s = new Set();
    const polys = shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        for (const [x, y] of ring) s.add(`${x.toFixed(2)},${y.toFixed(2)}`);
      }
    }
    return s;
  }
  for (const sk of [...nzSnapKeys, ...dchSnapKeys, ...daliSnapKeys]) {
    const pols = snapshots[sk].polities || [];
    const swPol = pols.find((p) => p.title === '南诏' || p.title === '大长和' || p.title === '大理');
    assert(swPol && swPol.shape, `${sk} must contain 南诏, 大长和, or 大理`);
    const swVerts = collectVertices(swPol.shape);
    const otherVerts = new Set();
    for (const p of pols) {
      if (p === swPol || !p.shape) continue;
      for (const v of collectVertices(p.shape)) otherVerts.add(v);
    }
    let sharedCount = 0;
    for (const v of swVerts) {
      if (otherVerts.has(v)) sharedCount++;
    }
    assert(
      sharedCount >= 5,
      `${sk}: ${swPol.title} must share contiguous boundary vertices with adjacent polities (found ${sharedCount})`
    );
  }

  // 23g. National Map Compliance Guard (Zangnan, Aksai Chin, Taiwan, Ten-Dash Line & ROC Tibet Unification)
  assert(
    !snapshots.neighbors.some((n) => n.title === '台湾地区') &&
      !bootSnaps.neighbors.some((n) => n.title === '台湾地区'),
    'snapshots.neighbors and bootSnaps.neighbors must not list 台湾地区 as a foreign neighbor'
  );
  assert(
    /\.province-shape\.maritime-dash\s*\{[\s\S]*?stroke:\s*rgba\(/m.test(styleCss) &&
      /\.province-shape\.maritime-dash\s*\{[\s\S]*?vector-effect:\s*non-scaling-stroke;/m.test(styleCss),
    'css/style.css .province-shape.maritime-dash must reinforce Ten-Dash Line (100000_JD) with explicit non-scaling stroke'
  );
  const complianceCheckPts = [
    ['达旺', 91.86, 27.58],
    ['山南南端', 92.5, 27.15],
    ['下苏班西里', 93.8, 27.6],
    ['墨脱南端', 95.33, 28.2],
    ['下察隅', 96.5, 28.1],
    ['阿克赛钦中', 79.8, 35.1],
    ['阿克赛钦西', 78.9, 34.7],
    ['阿克赛钦北', 79.4, 35.6],
  ];
  for (const [label, cx, cy] of [...complianceCheckPts, ['台湾', 120.99, 23.98]]) {
    for (const nb of snapshots.neighbors) {
      assert(
        !pointInShape(cx, cy, nb.shape),
        `Modern neighbor "${nb.title}" must not encroach on ${label} ([${cx}, ${cy}])`
      );
    }
  }
  const foreignSouthWest = new Set([
    '英属印度',
    '印度',
    '不丹',
    '尼泊尔',
    '克什米尔·拉达克',
    '莫卧儿帝国',
    '锡克（拉合尔）',
    '阿富汗',
    '浩罕汗国',
    '德里苏丹国',
    '缅甸',
  ]);
  for (const [sk, snap] of Object.entries(snapshots)) {
    if (!snap || Array.isArray(snap) || sk === 's_prc') continue;
    assert(
      !(snap.polities || []).some((p) => p.title === '西藏（噶厦）'),
      `${sk} must unify Tibet into 中华民国(main) rather than splitting 西藏（噶厦）`
    );
    for (const [label, cx, cy] of complianceCheckPts) {
      const polHits = (snap.polities || []).filter((p) => pointInShape(cx, cy, p.shape));
      const badForeign = polHits.filter((p) => foreignSouthWest.has(p.title));
      assert(
        polHits.length > 0 && badForeign.length === 0,
        `${sk}: ${label} ([${cx}, ${cy}]) must belong to a historical Chinese/Tibetan/Western Regions polity and zero foreign neighbors, got [${polHits.map((p) => `${p.title}(${p.role})`).join(', ')}]`
      );
    }
  }

  // 23h. Verify Western Liang (西梁, 554–587 CE) at Jiangling ([112.241, 30.331])
  const xiliangSnapKeys = ['s_nanbei_d3', 's_nanbei_e', 's_nanbei_e2', 's_nanbei_f', 's_sui_a'];
  for (const sk of xiliangSnapKeys) {
    const xlPol = (snapshots[sk].polities || []).find((p) => p.title === '西梁');
    assert(
      xlPol && xlPol.role === 'rival' && pointInShape(112.241, 30.331, xlPol.shape),
      `${sk} must model 西梁 (554–587 CE) as role="rival" containing Jiangling ([112.241, 30.331])`
    );
  }
  const liang553 = (snapshots.s_nanbei_d2.polities || []).find((p) => p.title === '梁');
  assert(
    liang553 && pointInShape(112.241, 30.331, liang553.shape),
    's_nanbei_d2 (553 CE) must keep Jiangling ([112.241, 30.331]) inside 梁 (Emperor Yuan of Liang) prior to 554 CE'
  );
  const sui587 = (snapshots.s_sui_a2.polities || []).find((p) => p.title === '隋');
  assert(
    sui587 &&
      pointInShape(112.241, 30.331, sui587.shape) &&
      !(snapshots.s_sui_a2.polities || []).some((p) => p.title === '西梁'),
    's_sui_a2 (587–589 CE) must merge Jiangling ([112.241, 30.331]) into 隋 after Emperor Wen abolishes Western Liang'
  );

  // 23i. Verify Ming Hexi Corridor (Jiayuguan & Xining) and contiguous Seven Guards West of Jiayuguan (哈密卫（关西七卫）)
  for (const sk of ['s_ming_a0', 's_ming_a', 's_ming_a2', 's_ming_b', 's_ming_c']) {
    const mingPol = (snapshots[sk].polities || []).find((p) => p.title === '明');
    assert(
      mingPol && pointInShape(98.291, 39.771, mingPol.shape) && pointInShape(101.78, 36.62, mingPol.shape),
      `${sk}: 明 polygon must contain Jiayuguan ([98.291, 39.771]) and Xining ([101.78, 36.62])`
    );
    const shanxiReg = (snapshots[sk].regions || []).find((r) => r.title === '陕西');
    assert(
      shanxiReg &&
        shanxiReg.shape.type === 'Polygon' &&
        pointInShape(98.291, 39.771, shanxiReg.shape) &&
        pointInShape(101.78, 36.62, shanxiReg.shape),
      `${sk}: 陕西 macro-region must be a single contiguous Polygon containing Jiayuguan ([98.291, 39.771]) and Xining ([101.78, 36.62])`
    );
  }
  for (const sk of ['s_ming_a', 's_ming_a2']) {
    const mingPol = (snapshots[sk].polities || []).find((p) => p.title === '明');
    const hamiPol = (snapshots[sk].polities || []).find((p) => p.title === '哈密卫（关西七卫）');
    const mongolPol = (snapshots[sk].polities || []).find((p) => p.title === '蒙古诸部 · 东察合台');
    assert(
      hamiPol &&
        hamiPol.role === 'protectorate' &&
        pointInShape(93.511, 42.821, hamiPol.shape) &&
        pointInShape(93.86, 40.35, hamiPol.shape) &&
        pointInShape(94.06, 39.93, hamiPol.shape) &&
        pointInShape(95.45, 40.0, hamiPol.shape),
      `${sk}: 哈密卫（关西七卫） must contain Hami ([93.511, 42.821]), Yumen Pass ([93.86, 40.35]), Yangguan ([94.06, 39.93]), and Handong ([95.45, 40.0])`
    );
    const mingVertSet = new Set(
      mingPol.shape.coordinates[0][0].map((pt) => `${pt[0].toFixed(2)},${pt[1].toFixed(2)}`)
    );
    const sharedWithMing = hamiPol.shape.coordinates[0].filter((pt) =>
      mingVertSet.has(`${pt[0].toFixed(2)},${pt[1].toFixed(2)}`)
    );
    assert(
      sharedWithMing.length >= 8,
      `${sk}: 哈密卫（关西七卫） must share at least 8 contiguous boundary vertices with 明 at Jiayuguan, found ${sharedWithMing.length}`
    );
    assert(
      mongolPol && !pointInShape(93.511, 42.821, mongolPol.shape),
      `${sk}: 蒙古诸部 · 东察合台 must not overlap Hami ([93.511, 42.821])`
    );
  }

  // 23j. Verify Warring States (zhanguo) phase transitions align with -323, -316, -306, -300, -296, -286, -278 milestones
  const zgDynRef = dynasties.find((d) => d.key === 'zhanguo');
  assert.strictEqual(ctrl._resolveSnapKey(zgDynRef, -323), 's_zhanguo_a2', 'zhanguo at -323 BCE must resolve to s_zhanguo_a2');
  assert(
    snapshots.s_zhanguo_a.polities.some((p) => p.title === '蜀') &&
      snapshots.s_zhanguo_a.polities.some((p) => p.title === '巴') &&
      snapshots.s_zhanguo_a.polities.some((p) => p.title === '宋') &&
      snapshots.s_zhanguo_a2.polities.some((p) => p.title === '蜀') &&
      snapshots.s_zhanguo_a2.polities.some((p) => p.title === '巴') &&
      snapshots.s_zhanguo_a2.polities.some((p) => p.title === '宋') &&
      snapshots.s_zhanguo_a2.polities.some((p) => p.title === '越') &&
      snapshots.s_zhanguo_a2.polities.some((p) => p.title === '中山') &&
      snapshots.s_zhanguo_a2.polities.some((p) => p.title === '义渠'),
    's_zhanguo_a & s_zhanguo_a2 (-403..-317 BCE, including -323 Five-State Accord) must keep 蜀, 巴, 宋, 越, 中山, and 义渠 independent'
  );
  assert.strictEqual(ctrl._resolveSnapKey(zgDynRef, -316), 's_zhanguo_b0', 'zhanguo at -316 BCE must resolve to s_zhanguo_b0');
  assert(
    !snapshots.s_zhanguo_b0.polities.some((p) => p.title === '蜀') &&
      !snapshots.s_zhanguo_b0.polities.some((p) => p.title === '巴') &&
      snapshots.s_zhanguo_b0.polities.some((p) => p.title === '宋') &&
      snapshots.s_zhanguo_b0.polities.some((p) => p.title === '越') &&
      snapshots.s_zhanguo_b0.polities.some((p) => p.title === '中山'),
    's_zhanguo_b0 (-316..-307 BCE) must annex 巴 & 蜀 into 秦 while keeping 宋, 越, and 中山 independent'
  );
  assert.strictEqual(ctrl._resolveSnapKey(zgDynRef, -306), 's_zhanguo_b1', 'zhanguo at -306 BCE must resolve to s_zhanguo_b1');
  assert(
    !snapshots.s_zhanguo_b1.polities.some((p) => p.title === '越') &&
      snapshots.s_zhanguo_b1.polities.some((p) => p.title === '宋') &&
      snapshots.s_zhanguo_b1.polities.some((p) => p.title === '中山'),
    's_zhanguo_b1 (-306..-301 BCE) must annex 越 into 楚 while keeping 宋 and 中山 independent'
  );
  assert.strictEqual(ctrl._resolveSnapKey(zgDynRef, -296), 's_zhanguo_b2', 'zhanguo at -296 BCE must resolve to s_zhanguo_b2');
  assert(
    !snapshots.s_zhanguo_b2.polities.some((p) => p.title === '中山') &&
      !snapshots.s_zhanguo_b2.polities.some((p) => p.title === '宋') &&
      pointInShape(112.201, 30.351, snapshots.s_zhanguo_b2.polities.find((p) => p.title === '楚').shape),
    's_zhanguo_b2 (-296..-279 BCE) must annex 中山 into 赵 and partition 宋 while keeping Yingdu ([112.201, 30.351]) inside 楚 prior to -278 BCE'
  );
  }

  // 23k. Verify 100% pre-modern settlement remark coverage and curated CITY_LORE bilingual integrity
  for (const [k, v] of Object.entries(enLocale.dict || {})) {
    assert(
      !/[\u4e00-\u9fa5]/.test(String(v)),
      `English dictionary value for "${k}" contains untranslated CJK characters: "${v}"`
    );
  }
  for (const d of dynasties) {
    if (d.key === 'roc' || d.key === 'prc') continue;
    for (const s of d.settlements || []) {
      assert(
        typeof s.remark === 'string' && s.remark.trim().length > 0,
        `Pre-modern settlement ${d.key}:${s.ancient} (${s.modern}) must have a non-empty historical remark`
      );
    }
  }
  assert(
    Array.isArray(loreData.CITY_LORE) && loreData.CITY_LORE.length >= 87,
    `Expected >= 87 curated CITY_LORE entries in lore_data.js, got ${loreData.CITY_LORE && loreData.CITY_LORE.length}`
  );
  for (const cl of loreData.CITY_LORE) {
    assert(
      cl.modern &&
        Array.isArray(cl.coord) &&
        cl.coord.length === 2 &&
        typeof cl.tagZh === 'string' &&
        cl.tagZh.length >= 4 &&
        typeof cl.tagEn === 'string' &&
        cl.tagEn.length >= 6 &&
        !/[\u4e00-\u9fa5]/.test(cl.tagEn) &&
        typeof cl.descZh === 'string' &&
        cl.descZh.length >= 25 &&
        typeof cl.descEn === 'string' &&
        cl.descEn.length >= 40 &&
        !/[\u4e00-\u9fa5]/.test(cl.descEn),
      `Invalid or incomplete bilingual CITY_LORE entry for ${cl && cl.modern}`
    );
  }

  // 23l. Verify Sui & Tang frontier borders (Anxi/Beiting Tianshan, Anxi/Tubo Kunlun-Altun, Tang/Tubo Qilian-Hengduan, Tang/Nanzhao) are naturally curved & vertex-locked
  if (!FAST_MODE) {
    for (const sk of ['s_tang_a5', 's_tang_b0a', 's_tang_b0']) {
      const pols = snapshots[sk].polities;
      const findPol = (t) => pols.find((p) => p.title === t);
      const anxi = findPol('安西都护府');
      const beiting = findPol('北庭都护府');
      const tubo = findPol('吐蕃');
      const nanzhao = findPol('南诏');
      const tang = findPol('唐');
      assert(
        anxi && beiting && tubo && nanzhao && tang,
        `${sk} must contain 安西都护府, 北庭都护府, 吐蕃, 南诏, and 唐`
      );
      const ringOf = (p) =>
        p.shape.type === 'Polygon'
          ? p.shape.coordinates[0]
          : p.shape.coordinates.reduce((best, cur) => (cur[0].length > best.length ? cur[0] : best), []);
      const keySetOf = (p) => new Set(ringOf(p).map((pt) => `${pt[0].toFixed(2)},${pt[1].toFixed(2)}`));
      const anxiKeys = keySetOf(anxi);
      const beitingKeys = keySetOf(beiting);
      const tuboKeys = keySetOf(tubo);
      const nanzhaoKeys = keySetOf(nanzhao);
      const tangKeys = keySetOf(tang);

      const countShared = (setA, setB) => {
        let c = 0;
        for (const k of setA) if (setB.has(k)) c++;
        return c;
      };
      assert(
        countShared(anxiKeys, beitingKeys) >= 40,
        `${sk}: 安西都护府 and 北庭都护府 must share >= 40 curved Tianshan frontier vertices`
      );
      assert(
        countShared(anxiKeys, tuboKeys) >= 50,
        `${sk}: 安西都护府 and 吐蕃 must share >= 50 curved Kunlun-Altun frontier vertices`
      );
      assert(
        countShared(tangKeys, tuboKeys) >= 50,
        `${sk}: 唐 and 吐蕃 must share >= 50 curved Qilian-Minshan-Hengduan frontier vertices`
      );
      assert(
        countShared(tangKeys, nanzhaoKeys) >= 40,
        `${sk}: 唐 and 南诏 must share >= 40 curved Yunnan-Guangxi-Annan frontier vertices`
      );
      for (const p of [anxi, beiting, tubo, nanzhao, tang]) {
        const r = ringOf(p);
        assert(
          r.length >= 120,
          `${sk}: ${p.title} ring must have >= 120 curved vertices (got ${r.length})`
        );
      }
    }
  }

  // 23m. Verify bilingual (ZH / EN / Pinyin) resolvePlace and inspect() city lore
  const changanRes = ctrl.resolvePlace("Chang'an", 741);
  assert(
    changanRes && changanRes.name.includes('长安'),
    `Expected resolvePlace("Chang'an", 741) to match 长安, got ${changanRes && changanRes.name}`
  );
  const changanUnspaced = ctrl.resolvePlace('Changan', 741);
  assert(
    changanUnspaced && changanUnspaced.name.includes('长安'),
    `Expected resolvePlace("Changan", 741) to match 长安, got ${changanUnspaced && changanUnspaced.name}`
  );
  const jinanFujian = ctrl.resolvePlace("Jin'an", 589);
  const jinanShandong = ctrl.resolvePlace('Jinan', 589);
  assert(
    jinanFujian && jinanFujian.name.includes('晋安') && jinanShandong && !jinanShandong.name.includes('晋安'),
    `Expected apostrophe-aware disambiguation between Jin'an (${jinanFujian && jinanFujian.name}) and Jinan (${jinanShandong && jinanShandong.name})`
  );
  const lantianRes = ctrl.resolvePlace('Lantian Pass', 819);
  assert(
    lantianRes && lantianRes.name === '蓝田关',
    `Expected resolvePlace("Lantian Pass", 819) to match 蓝田关, got ${lantianRes && lantianRes.name}`
  );
  const inspectChangan = ctrl.inspect({ year: 741, place: "Chang'an" });
  assert(
    inspectChangan &&
      inspectChangan.resolvedName === '长安' &&
      inspectChangan.lore &&
      inspectChangan.lore.tagEn &&
      inspectChangan.nearestCity &&
      inspectChangan.nearestCity.remark,
    'Expected inspect({ year: 741, place: "Chang\'an" }) to include resolvedName, lore, and nearestCity.remark'
  );

  // 23n. Verify Tang Fujian 5 prefectures (福、建、泉、漳、汀) and Song/Yuan/Ming/Qing clean prefecture names without stitched county labels
  const tangSettlementNames = new Set(
    (dynasties.find((d) => d.key === 'tang').settlements || []).map((s) => s.ancient)
  );
  for (const fjPref of ['福州', '建州', '泉州', '漳州', '汀州']) {
    assert(
      tangSettlementNames.has(fjPref),
      `Tang settlements must include Fujian prefecture "${fjPref}"`
    );
  }
  assert(
    !tangSettlementNames.has('沙县（宁化）') && !tangSettlementNames.has('龙岩（汀州）'),
    'Tang settlements must not contain stitched county labels "沙县（宁化）" or "龙岩（汀州）"'
  );
  for (const [dKey, expectedPrefs, bannedLabels] of [
    ['beisong', ['汀州', '南剑州'], ['汀州（龙岩）', '南剑州（尤溪）']],
    ['nansong', ['汀州', '南剑州'], ['汀州（龙岩）', '南剑州（尤溪）']],
    ['yuan', ['汀州路', '延平路'], ['汀州路（龙岩）']],
    ['ming', ['汀州府', '延平府'], ['汀州府（龙岩）', '沙县（永安）']],
    ['qing', ['延平府', '龙岩州'], ['永安（沙县）']],
  ]) {
    const names = new Set((dynasties.find((d) => d.key === dKey).settlements || []).map((s) => s.ancient));
    for (const ep of expectedPrefs) {
      assert(names.has(ep), `${dKey} settlements must include prefecture "${ep}"`);
    }
    for (const bl of bannedLabels) {
      assert(!names.has(bl), `${dKey} settlements must not include stitched/redundant label "${bl}"`);
    }
  }

  // 23o. Verify Ming Dynasty (s_ming*) natural curved polity borders & bilingual README preview asset parity
  if (!FAST_MODE) {
    for (const mingKey of ['s_ming_a0', 's_ming_a', 's_ming_a2', 's_ming_b', 's_ming_c']) {
      const mingSnap = snapshots[mingKey];
      assert(mingSnap, `Missing Ming snapshot ${mingKey}`);
      for (const pol of mingSnap.polities || []) {
        const polys = pol.shape.type === 'Polygon' ? [pol.shape.coordinates] : pol.shape.coordinates;
        for (const poly of polys) {
          const ring = poly[0] || [];
          for (let i = 0; i < ring.length - 1; i++) {
            const [x1, y1] = ring[i];
            const [x2, y2] = ring[i + 1];
            // Check all segments inside the Ming China frontier box [95.5°E..122°E, 26°N..46.5°N]
            if (x1 >= 95.5 && x1 <= 122 && x2 >= 95.5 && x2 <= 122 && y1 >= 26 && y1 <= 46.5 && y2 >= 26 && y2 <= 46.5) {
              const segDeg = Math.hypot(x2 - x1, y2 - y1);
              assert(
                segDeg <= 1.5,
                `${mingKey} polity "${pol.title}" contains artificial ruler-straight interior border segment [${x1},${y1}] -> [${x2},${y2}] (${segDeg.toFixed(2)}°)`
              );
            }
          }
        }
      }
    }
  }
  for (const [enAsset, zhAsset] of [
    ['assets/preview_741_tang_trace_en.webp', 'assets/preview_741_tang_trace.webp'],
    ['assets/preview_1415_ming_yingtian_en.webp', 'assets/preview_1415_ming_yingtian.webp'],
    ['assets/preview_journey_sushi_en.webp', 'assets/preview_journey_sushi.webp'],
    ['assets/preview_quiz_challenge_en.webp', 'assets/preview_quiz_challenge.webp'],
  ]) {
    assert(readmeSrc.includes(enAsset), `README.md must reference English preview ${enAsset}`);
    assert(readmeZhSrc.includes(zhAsset), `README_ZH.md must reference Chinese preview ${zhAsset}`);
    assert(fs.existsSync(path.join(ROOT, enAsset)), `Missing preview asset file ${enAsset}`);
    assert(fs.existsSync(path.join(ROOT, zhAsset)), `Missing preview asset file ${zhAsset}`);
  }

  // 23p. Verify Republic of China Warlord Era (1916–1928) multi-faction snapshots (s_roc_a0, s_roc_w1..w4, s_roc_a)
  for (const [rk, expectedTitles] of [
    ['s_roc_a0', ['中华民国', '外蒙古（自治/苏控）']],
    ['s_roc_w1', ['北洋政府 · 皖系（段祺瑞）', '直系（冯国璋 · 曹锟）', '奉系（张作霖）', '护法军政府 · 西南各系', '晋系（阎锡山）', '西北诸马（甘宁青）', '新疆（杨增新）']],
    ['s_roc_w2', ['北洋政府 · 直系（曹锟 · 吴佩孚）', '奉系（张作霖）', '皖系（卢永祥 · 浙江）', '广州政府（孙中山）', '西南川滇黔桂各系', '晋系（阎锡山）', '西北诸马（甘宁青）', '新疆（杨增新）']],
    ['s_roc_w3', ['北洋政府 · 奉系（张作霖）', '五省联军（孙传芳）', '直系（吴佩孚）', '西北国民军（冯玉祥）', '广州国民政府（两广统一）', '川滇黔军阀（刘湘 · 唐继尧）', '晋系（阎锡山）', '新疆（杨增新）']],
    ['s_roc_w4', ['国民政府（北伐军与冯阎集团）', '安国军政府 · 奉系（张作霖）', '新疆（杨增新）']],
  ]) {
    const rs = snapshots[rk];
    assert(rs, `Missing ROC warlord snapshot ${rk}`);
    const titles = new Set((rs.polities || []).map((p) => p.title));
    for (const et of expectedTitles) {
      assert(titles.has(et), `${rk} must include warlord polity "${et}"`);
    }
  }

  // 23q. Mobile viewport UX & geometry guards (iPhone 13 Pro 390x664 portrait Person Chronicle + Cartographic Hairlines + Custom Route)
  assert(
    indexHtml.includes('id="genealogy-body" class="genealogy-body"') &&
      indexHtml.includes('id="act-expand-genealogy"') &&
      styleCss.includes('.genealogy-body {') &&
      styleCss.includes('.genealogy-body .genealogy-list {') &&
      styleCss.includes('.journey-track-thread {') &&
      styleCss.includes('.journey-track-focus {') &&
      styleCss.includes('.journey-chevron {') &&
      styleCss.includes('.person-ev-quote {') &&
      !styleCss.includes('journeyDashFlow') &&
      !styleCss.includes('max-height: 4.1em;') &&
      styleCss.includes('#workspace-body.is-pane-collapsed:not(.is-mobile-chronicle-open)'),
    'index.html and style.css must unify #genealogy-body scrolling, use non-invasive cartographic hairlines + chevrons without animated dashes, and preserve .person-ev-quote'
  );
  {
    const prevWinW = sandbox.window.innerWidth;
    const prevWinH = sandbox.window.innerHeight;
    const prevAnimCam = ctrl._animateCameraTo;
    const prevSvg = ctrl.svg;
    let capturedCam = null;
    sandbox.window.innerWidth = 390;
    sandbox.window.innerHeight = 664;
    ctrl.svg = {
      getBoundingClientRect: () => ({ top: 45, bottom: 584, left: 0, right: 390, width: 390, height: 539 }),
      querySelectorAll: () => [],
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      dataset: {},
    };
    const mockVfMobile = {
      getBoundingClientRect: () => ({ top: 45, bottom: 584, left: 0, right: 390, width: 390, height: 539 }),
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    };
    let sheetExpandedMock = false;
    const mockGenCardMobile = {
      getBoundingClientRect: () =>
        sheetExpandedMock
          ? { top: 260, bottom: 578, left: 8, right: 382, width: 374, height: 318 }
          : { top: 356, bottom: 578, left: 8, right: 382, width: 374, height: 222 },
      classList: {
        add() {},
        remove() {},
        toggle(cls, force) {
          if (cls === 'is-sheet-expanded') sheetExpandedMock = Boolean(force);
        },
        contains: (cls) => (cls === 'is-sheet-expanded' ? sheetExpandedMock : false),
      },
    };
    const origIdMobile = ctrl._id;
    ctrl._id = (id) => {
      if (id === 'viewport-frame') return mockVfMobile;
      if (id === 'genealogy-card') return mockGenCardMobile;
      return origIdMobile ? origIdMobile.call(ctrl, id) : null;
    };
    ctrl._animateCameraTo = (target) => {
      capturedCam = target;
      ctrl.camera = { ...target, zoom: 1000 / target.w };
    };
    for (const j of loreData.HISTORICAL_JOURNEYS) {
      assert(
        ctrl.openJourneyAsPerson(j.key, -1) && ctrl.activePerson && ctrl.activePerson.profile.key === j.key,
        `Expected openJourneyAsPerson("${j.key}", -1) to open unified Person Chronicle`
      );
      assert(
        ctrl.activePerson.events.some((ev) => Boolean(ev.quoteZh && ev.quoteEn)),
        `Expected Person Chronicle "${j.key}" to preserve bilingual quotes from HISTORICAL_JOURNEYS`
      );
      const missingStops = j.stops
        .map((st, sIdx) => (ctrl.activePerson.events.some((ev) => ev.journeyStopIdx === sIdx) ? null : `${st.year} ${st.ancientZh}`))
        .filter(Boolean);
      assert(
        !missingStops.length,
        `Expected Person Chronicle "${j.key}" to keep every curated journey stop, missing: ${missingStops.join('; ')}`
      );
      const visFrac = ctrl._getPersonVisibleTopFrac();
      assert(
        visFrac >= 0.5 && visFrac <= 0.65,
        `Expected mobile _getPersonVisibleTopFrac() in [0.5, 0.65], got ${visFrac}`
      );
      ctrl._framePersonOverview();
      assert(capturedCam, `Expected _framePersonOverview(${j.key}) to set camera`);
      const overviewCam = { ...capturedCam };
      for (const ev of ctrl.activePerson.events) {
        const [, sy] = ctrl.projector.toScreen(ev.coord[0], ev.coord[1]);
        const screenY = 45 + ((sy - overviewCam.y) / overviewCam.h) * 539;
        assert(
          screenY >= 52 && screenY <= 364,
          `Mobile overview of person "${j.key}" site "${ev.siteZh}" landed outside unobscured map window [52..364]: screenY=${screenY.toFixed(1)}`
        );
        ctrl._flyToPersonEvent(ev);
        const flyScreenY = 45 + ((sy - capturedCam.y) / capturedCam.h) * 539;
        assert(
          flyScreenY >= 140 && flyScreenY <= 260,
          `Mobile _flyToPersonEvent for "${j.key}" site "${ev.siteZh}" occluded or off-center: screenY=${flyScreenY.toFixed(1)}`
        );
      }
      assert(
        ctrl.openJourneyAsPerson(j.key, 2) &&
          ctrl.activePersonEventIdx >= 0 &&
          ctrl.activePerson.events[ctrl.activePersonEventIdx].journeyStopIdx === 2,
        `Expected openJourneyAsPerson("${j.key}", 2) to select curated stop #2 accurately`
      );
    }
    ctrl.closeGenealogyCard();
    ctrl._id = origIdMobile;
    ctrl._animateCameraTo = prevAnimCam;
    ctrl.svg = prevSvg;
    sandbox.window.innerWidth = prevWinW;
    sandbox.window.innerHeight = prevWinH;
    assert.strictEqual(
      typeof ctrl._journeyKeyForMilestone,
      'undefined',
      'Legacy _journeyKeyForMilestone helper must remain removed'
    );
    assert(
      !/展阅行迹|View Route/.test(appCode),
      'Legacy 展阅行迹 / View Route buttons must not exist in js/app.js'
    );
  }

  // 23r. Person Chronicle Search (点人溯事) Dataset, Bilingual Parity, Dedup & Round-Trip Guard
  const personEventsCache = new Map();
  const getCachedPersonEvents = (p) => {
    if (!personEventsCache.has(p.key)) {
      personEventsCache.set(p.key, ctrl._collectPersonEvents(p));
    }
    return personEventsCache.get(p.key);
  };
  {
    assert(
      Array.isArray(loreData.PERSON_PROFILES) && loreData.PERSON_PROFILES.length >= 100,
      `Expected >=100 PERSON_PROFILES in lore_data.js, got ${loreData.PERSON_PROFILES && loreData.PERSON_PROFILES.length}`
    );
    const sparseProfiles = [];
    for (const p of loreData.PERSON_PROFILES) {
      const evs = getCachedPersonEvents(p);
      if (evs.length < 3) {
        sparseProfiles.push(`${p.key} (${p.zh}): ${evs.length} -> ${evs.map((e) => e.year + '@' + e.siteZh).join(' | ')}`);
      }
    }
    assert(
      sparseProfiles.length === 0,
      `Person profiles with <3 geo-dated events:\n${sparseProfiles.join('\n')}`
    );
    for (const p of loreData.PERSON_PROFILES) {
      const evs = getCachedPersonEvents(p);
      assert(
        p.en && !/[\u4e00-\u9fff]/.test(p.en) && p.courtesyEn && !/[\u4e00-\u9fff]/.test(p.courtesyEn),
        `Person profile "${p.zh}" (${p.key}) must have clean English name & courtesyEn without CJK characters`
      );
      ctrl.locale = 'en';
      const spanEn = ctrl._formatPersonSpan(p.span, false);
      assert(
        !/BCE CE/.test(spanEn) && !/[\u4e00-\u9fff（—）]/.test(spanEn),
        `Broken English lifespan formatting for "${p.zh}": "${spanEn}"`
      );
      ctrl.locale = 'zh';
      for (let i = 0; i < evs.length; i++) {
        if (i > 0) {
          assert(
            evs[i].year >= evs[i - 1].year,
            `Events for "${p.zh}" must be sorted chronologically (${evs[i - 1].year} -> ${evs[i].year})`
          );
        }
        assert(
          evs[i].siteEn && !/[\u4e00-\u9fff]/.test(evs[i].siteEn),
          `Person "${p.zh}" event [${i}] (${evs[i].year}) has untranslated siteEn: "${evs[i].siteEn}" (zh="${evs[i].siteZh}")`
        );
        assert(
          evs[i].textEn && !/[\u4e00-\u9fff]/.test(evs[i].textEn) && !/^[a-z]/.test(evs[i].textEn.trim()),
          `Person "${p.zh}" event [${i}] (${evs[i].year}) has untranslated or lowercase-leading textEn: "${evs[i].textEn}"`
        );
      }
    }
    const aliasChecks = [
      ['刘彻', 'hanwudi'],
      ['汉武帝', 'hanwudi'],
      ['曹操', 'caocao'],
      ['Cao Cao', 'caocao'],
      ['孟德', 'caocao'],
      ['孔明', 'zhugeliang'],
      ['Kongming', 'zhugeliang'],
      ['杜甫', 'dufu'],
      ['子美', 'dufu'],
      ['东坡', 'sushi'],
      ['Su Shi', 'sushi'],
      ['Su Dongpo', 'sushi'],
      ['Mencius', 'mengzi'],
      ['Meng Ke', 'mengzi'],
      ['Zhao Kuangyin', 'zhaokuangyin'],
      ['Li Longji', 'tangxuanzong'],
      ['Koxinga', 'zhengchenggong'],
      ['Sun Yat-sen', 'sunzhongshan'],
      ['稼轩', 'xinqiji'],
      ['王守仁', 'wangyangming'],
    ];
    for (const [query, expectedKey] of aliasChecks) {
      const hits = ctrl._queryQuickSearch(query);
      assert(
        hits.length > 0 && hits[0].kind === 'person' && hits[0].personKey === expectedKey,
        `Expected top quick-search hit for "${query}" to be person "${expectedKey}", got ${JSON.stringify(hits[0])}`
      );
    }
    // Verify Deng Ai keeps both Yinping & Chengdu in 263 CE in causal order, and Zhao Kuangyin keeps both 960 & 961 without duplicate 960
    const dengEvs = ctrl._collectPersonEvents(loreData.PERSON_PROFILES.find((p) => p.key === 'dengai'));
    const deng263 = dengEvs.filter((e) => e.year === 263);
    assert(
      deng263.length === 2 && deng263[0].siteZh.includes('阴平') && deng263[1].siteZh.includes('成都'),
      `Expected Deng Ai to have 2 distinct 263 CE campaign events ordered (Yinping -> Chengdu), got ${JSON.stringify(deng263.map((e) => e.siteZh))}`
    );
    const guan219 = ctrl
      ._collectPersonEvents(loreData.PERSON_PROFILES.find((p) => p.key === 'guanyu'))
      .filter((e) => e.year === 219);
    assert(
      guan219.length === 3 &&
        guan219[0].siteZh.includes('襄阳') &&
        guan219[1].siteZh.includes('陆口') &&
        guan219[2].siteZh.includes('麦城'),
      `Expected Guan Yu 219 CE events ordered (Xiangyang -> Lukou -> Maicheng), got ${JSON.stringify(guan219.map((e) => e.siteZh))}`
    );
    const sun200 = ctrl
      ._collectPersonEvents(loreData.PERSON_PROFILES.find((p) => p.key === 'sunquan'))
      .filter((e) => e.year === 200);
    assert(
      sun200.length === 1 && sun200[0].siteZh.includes('京口'),
      `Expected Sun Quan 200 CE succession at Jingkou without Guandu duplicate, got ${JSON.stringify(sun200.map((e) => e.siteZh))}`
    );
    const sima91 = ctrl
      ._collectPersonEvents(loreData.PERSON_PROFILES.find((p) => p.key === 'simaqian'))
      .filter((e) => e.year === -91);
    assert(
      sima91.length === 1 && sima91[0].siteZh.includes('长安'),
      `Expected Sima Qian -91 BCE Shiji completion at Chang'an without Huxian duplicate, got ${JSON.stringify(sima91.map((e) => e.siteZh))}`
    );
    const liu208 = ctrl
      ._collectPersonEvents(loreData.PERSON_PROFILES.find((p) => p.key === 'liubei'))
      .filter((e) => e.year === 208);
    assert(
      liu208.length === 2 && liu208[0].siteZh.includes('长坂') && liu208[1].siteZh.includes('赤壁'),
      `Expected Liu Bei 208 CE events ordered (Changban -> Red Cliffs), got ${JSON.stringify(liu208.map((e) => e.siteZh))}`
    );
    const zhaoEvs = ctrl._collectPersonEvents(
      loreData.PERSON_PROFILES.find((p) => p.key === 'zhaokuangyin')
    );
    assert(
      zhaoEvs.filter((e) => e.year === 960).length === 1 &&
        zhaoEvs.filter((e) => e.year === 961).length === 1,
      `Expected Zhao Kuangyin to have 1 event in 960 (Chenqiao) and 1 in 961 (Cup of Wine), got ${JSON.stringify(zhaoEvs.map((e) => e.year))}`
    );
  }

  // CUJ 24: Eastern Jin & Southern-Northern Dynasties Phased Zhou / Qiaozhou & Commandery Evolution
  {
    assert(
      snapshots.s_dongjin_c.regions.length >= 30 &&
        snapshots.s_dongjin_c.regions.length < snapshots.s_nanbei_b.regions.length &&
        snapshots.s_nanbei_b.regions.length >= 55 &&
        snapshots.s_nanbei_b.regions.length < snapshots.s_nanbei_c.regions.length &&
        snapshots.s_nanbei_c.regions.length < snapshots.s_nanbei_d.regions.length &&
        snapshots.s_nanbei_d.regions.length < snapshots.s_nanbei_e.regions.length,
      `Expected strictly increasing 5-stage Zhou subdivision across Eastern Jin -> Nanbeichao`
    );
    assert(
      snapshots.s_dongjin_c.prefectures.length >= 100 &&
        snapshots.s_dongjin_c.prefectures.length <= 115 &&
        snapshots.s_nanbei_b.prefectures.length >= 130 &&
        snapshots.s_nanbei_b.prefectures.length <= 150 &&
        !snapshots.s_dongjin_c.prefectures.some((p) => p.title === '毗陵典农校尉'),
      'Expected deduplicated North+South commanderies without Three Kingdoms anachronisms'
    );

    const spotCases = [
      [{ lng: 119.451, lat: 32.18, year: 383 }, '南徐州(侨州)', '南东海郡(侨郡)'],
      [{ lng: 119.451, lat: 32.18, year: 494 }, '南徐州(侨州)', '南东海郡(侨郡)'],
      [{ lng: 119.43, lat: 32.42, year: 494 }, '南兖州(侨州)', '广陵郡'],
      [{ lng: 119.43, lat: 32.42, year: 560 }, '吴州', '广陵郡'],
      [{ lng: 119.02, lat: 34.55, year: 494 }, '青冀二州(侨州)', '东海郡'],
      [{ lng: 119.02, lat: 34.55, year: 560 }, '海州', '东海郡'],
      [{ lng: 114.07, lat: 32.12, year: 494 }, '司州(侨州)', '义阳郡'],
      [{ lng: 114.07, lat: 32.12, year: 560 }, '申州', '义阳郡'],
      [{ lng: 112.121, lat: 32.011, year: 383 }, '雍州(侨州)', '襄阳郡'],
      [{ lng: 112.121, lat: 32.011, year: 494 }, '雍州(侨州)', '襄阳郡'],
      [{ lng: 112.121, lat: 32.011, year: 560 }, '襄州', '襄阳郡'],
      [{ lng: 114.311, lat: 30.591, year: 494 }, '郢州', '江夏郡'],
      [{ lng: 112.451, lat: 34.621, year: 494 }, '司州', '河南尹(郡)'],
      [{ lng: 112.451, lat: 34.621, year: 560 }, '洛州', '河南郡'],
      [{ lng: 114.391, lat: 36.101, year: 494 }, '相州', '魏郡'],
      [{ lng: 114.391, lat: 36.101, year: 560 }, '司州', '魏郡'],
      [{ lng: 113.301, lat: 40.081, year: 494 }, '恒州', '代郡'],
      [{ lng: 117.001, lat: 36.651, year: 494 }, '齐州', '济南郡'],
      [{ lng: 108.871, lat: 37.991, year: 383 }, '夏州', '朔方郡'],
      [{ lng: 108.871, lat: 37.991, year: 494 }, '夏州', '化政郡'],
      [{ lng: 110.29, lat: 25.27, year: 520 }, '桂州', '始安郡'],
      [{ lng: 109.5, lat: 31.02, year: 520 }, '信州', '巴东郡'],
      [{ lng: 119.3, lat: 26.08, year: 560 }, '闽州', '晋安郡'],
    ];
    for (const [opts, expReg, expPref] of spotCases) {
      const info = ctrl.inspect(opts);
      assert(
        info && info.regions.includes(expReg),
        `inspect(${JSON.stringify(opts)}) expected region "${expReg}", got ${JSON.stringify(info && info.regions)}`
      );
      assert(
        info && info.prefectures.includes(expPref),
        `inspect(${JSON.stringify(opts)}) expected commandery "${expPref}", got ${JSON.stringify(info && info.prefectures)}`
      );
    }

    const capturedNodes = [];
    ctrl._svgNode = (tag, attrs) => {
      const n = {
        tag,
        attrs,
        dataset: {},
        textContent: '',
        classList: { add() {}, remove() {}, contains: () => false },
        setAttribute() {},
        getAttribute: () => null,
        appendChild() {},
      };
      capturedNodes.push({ tag, attrs, n });
      return n;
    };
    const makeMockDomEl = () => {
      let htmlVal = '';
      const el = {
        textContent: '',
        dataset: {},
        style: {},
        scrollTop: 0,
        scrollHeight: 0,
        clientHeight: 400,
        offsetTop: 0,
        offsetHeight: 40,
        children: [],
        get innerHTML() {
          return htmlVal;
        },
        set innerHTML(v) {
          htmlVal = String(v);
          if (v === '') el.children.length = 0;
        },
        appendChild(c) {
          el.children.push(c);
          return c;
        },
        addEventListener() {},
        setAttribute() {},
        getAttribute: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      };
      return el;
    };
    const mockIds = new Map();
    const origId = ctrl._id.bind(ctrl);
    ctrl._id = (id) => {
      if (!mockIds.has(id)) mockIds.set(id, origId(id) || makeMockDomEl());
      return mockIds.get(id);
    };
    const origDoc = sandbox.document;
    sandbox.document = { createElement: () => makeMockDomEl() };
    ctrl.grpPolities = makeMockDomEl();
    ctrl.grpPrefectures = makeMockDomEl();
    ctrl.grpProvNames = makeMockDomEl();
    ctrl.mapKey = makeMockDomEl();
    ctrl.svg = makeMockDomEl();
    ctrl._renderLegendBox = () => {};
    ctrl._rescaleSvgTypography = () => {};
    ctrl.projector.shapeToSvgPath = (sh) => (sh ? 'M0 0' : '');
    if (FAST_MODE) ctrl._buildRegionBoundaryPath = () => '';

    const nbDynObj = dynasties.find((d) => d.key === 'nanbei');
    ctrl.locale = 'zh';
    capturedNodes.length = 0;
    ctrl.jumpToYear(494);
    ctrl._renderPolitiesAndPrefectures(nbDynObj, snapshots.s_nanbei_b);
    const zhQiaoCaps = capturedNodes
      .filter((x) => x.attrs && String(x.attrs.class || '').includes('is-qiaozhou'))
      .map((x) => x.n.textContent);
    assert(
      zhQiaoCaps.includes('南徐州·侨') && zhQiaoCaps.includes('雍州·侨') && zhQiaoCaps.includes('青冀二州·侨'),
      `Expected on-map ·侨 badges in ZH at 494 CE, got ${JSON.stringify(zhQiaoCaps)}`
    );
    ctrl.openGenealogyAt(112.121, 32.011, '襄阳');
    const zhGenHtml = ctrl._id('genealogy-timeline').children.map((c) => c.innerHTML).join('\n');
    assert(
      zhGenHtml.includes('雍州（侨州）'),
      `Expected 雍州（侨州） in ZH place genealogy at Xiangyang, got ${zhGenHtml.slice(0, 200)}`
    );

    ctrl.locale = 'en';
    capturedNodes.length = 0;
    ctrl.jumpToYear(494);
    ctrl._renderPolitiesAndPrefectures(nbDynObj, snapshots.s_nanbei_b);
    const enQiaoCaps = capturedNodes
      .filter((x) => x.attrs && String(x.attrs.class || '').includes('is-qiaozhou'))
      .map((x) => x.n.textContent);
    assert(
      enQiaoCaps.includes('Nanxu Zhou (Emigre)') && enQiaoCaps.includes('Yong Zhou (Emigre)'),
      `Expected on-map (Emigre) badges in EN at 494 CE, got ${JSON.stringify(enQiaoCaps)}`
    );
    ctrl.openGenealogyAt(112.121, 32.011, 'Xiangyang');
    const enGenHtml = ctrl._id('genealogy-timeline').children.map((c) => c.innerHTML).join('\n');
    assert(
      enGenHtml.includes('Yong Zhou (Emigre)'),
      `Expected Yong Zhou (Emigre) in EN place genealogy at Xiangyang, got ${enGenHtml.slice(0, 200)}`
    );
    delete ctrl.projector.shapeToSvgPath;
    delete ctrl._buildRegionBoundaryPath;
    sandbox.document = origDoc;
    ctrl._id = origId;
    ctrl.locale = 'zh';
  }

  // CUJ 25: Curated Popular Historical Milestones, City Cultural/Battle Landmarks & Strengthened Hero Trajectories (Ancient/Imperial Eras)
  {
    const expectedPopularMilestones = [
      ['zhanguo', -279, '火牛阵'],
      ['zhanguo', -257, '窃符救赵'],
      ['zhanguo', -246, '郑国渠'],
      ['qin', -214, '灵渠'],
      ['qin', -213, '焚书令'],
      ['qin', -203, '鸿沟'],
      ['xihan', -202, '垓下'],
      ['xihan', -134, '独尊儒术'],
      ['xihan', -127, '推恩令'],
      ['xihan', -91, '史记'],
      ['donghan', 207, '三顾茅庐'],
      ['donghan', 211, '潼关之战'],
      ['donghan', 215, '逍遥津'],
      ['sanguo', 223, '白帝城'],
      ['sanguo', 234, '司马懿'],
      ['dongjin', 353, '兰亭集序'],
      ['nanbei', 529, '陈庆之'],
      ['nanbei', 546, '玉壁之战'],
      ['nanbei', 548, '梁武帝'],
      ['sui', 605, '科举制'],
      ['tang', 645, '玄奘'],
      ['tang', 663, '白江口'],
      ['beisong', 1041, '好水川'],
      ['beisong', 1121, '方腊'],
      ['nansong', 1207, '开禧北伐'],
      ['nansong', 1247, '凉州会盟'],
      ['yuan', 1368, '大都'],
      ['ming', 1393, '蓝玉案'],
      ['ming', 1402, '靖难'],
      ['ming', 1626, '宁远大捷'],
      ['qing', 1669, '鳌拜'],
      ['qing', 1793, '马戛尔尼'],
      ['qing', 1799, '和珅'],
      ['qing', 1856, '天京事变'],
      ['qing', 1860, '圆明园'],
      ['qing', 1894, '邓世昌'],
    ];
    for (const [dynKey, yr, kw] of expectedPopularMilestones) {
      const d = dynasties.find((x) => x.key === dynKey);
      const m = d && d.milestones.find((x) => x.year === yr);
      assert(m && m.headline.includes(kw), `Missing expected milestone ${dynKey}:${yr} containing "${kw}"`);
      const enEntry = enLocale.milestones[`${dynKey}:${yr}`];
      assert(
        Array.isArray(enEntry) && enEntry[0].length >= 24 && !/[\u4e00-\u9fa5]/.test(enEntry[0]),
        `Missing or invalid English milestone translation for ${dynKey}:${yr}`
      );
      const qHits = ctrl._queryQuickSearch(kw);
      assert(
        qHits.some((h) => h.year === yr || (h.dynasty && h.dynasty.key === dynKey)),
        `Expected Quick Search "${kw}" to match ${dynKey}:${yr}`
      );
    }

    const expectedCityGems = [
      ['邯郸', 'zhanguo', [114.48, 36.61], '负荆请罪', 'Lian Po'],
      ['易水', 'zhanguo', [115.50, 39.35], '易水寒', 'Jing Ke'],
      ['北海', 'xihan', [107.30, 53.30], '苏武', 'Su Wu'],
      ['洛阳(汉书)', 'donghan', [112.46, 34.63], '汉书', 'Ban Gu'],
      ['汝南(说文)', 'donghan', [114.12, 33.57], '说文解字', 'Xu Shen'],
      ['南阳(伤寒)', 'donghan', [112.53, 33.00], '伤寒杂病论', 'Zhang Zhongjing'],
      ['合肥', 'donghan', [117.28, 31.86], '逍遥津', 'Xiaoyao Ford'],
      ['洛阳(金谷)', 'xijin', [112.42, 34.66], '石崇', 'Golden Valley'],
      ['上海(华亭)', 'xijin', [121.23, 31.03], '华亭鹤唳', 'Lu Ji'],
      ['建康(祖冲之)', 'nanbei', [118.80, 32.05], '祖冲之', 'Zu Chongzhi'],
      ['建康(梁武帝)', 'nanbei', [118.80, 32.06], '梁武帝', 'Emperor Wu'],
      ['青州', 'nanbei', [118.48, 36.69], '齐民要术', 'Qimin Yaoshu'],
      ['洛阳(邙山)', 'nanbei', [112.60, 34.72], '兰陵王', 'Prince of Lanling'],
      ['荥阳', 'sui', [113.38, 34.80], '瓦岗军', 'Wagang'],
      ['天山', 'tang', [88.13, 47.85], '三箭定天山', 'Xue Rengui'],
      ['南昌', 'tang', [115.88, 28.68], '滕王阁序', 'Pavilion of Prince Teng'],
      ['金陵(夜宴)', 'wudai', [118.79, 32.04], '韩熙载夜宴图', 'Gu Hongzhong'],
      ['成都(花蕊)', 'beisong', [104.07, 30.67], '花蕊夫人', 'Consort Huarui'],
      ['开封(活字)', 'beisong', [114.35, 34.79], '毕昇', 'Bi Sheng'],
      ['开封(包拯)', 'beisong', [114.35, 34.79], '包拯', 'Bao Zheng'],
      ['镇江', 'beisong', [119.46, 32.20], '梦溪笔谈', 'Shen Kuo'],
      ['梁山', 'beisong', [116.12, 35.76], '宋江', 'Song Jiang'],
      ['庐山(白鹿洞)', 'nansong', [116.04, 29.52], '白鹿洞书院', 'White Deer Grotto'],
      ['潭州(飞虎军)', 'nansong', [112.98, 28.20], '飞虎军', 'Flying Tiger'],
      ['潭州(洗冤录)', 'nansong', [112.97, 28.20], '洗冤集录', 'Song Ci'],
      ['元大都(窦娥)', 'yuan', [116.39, 39.92], '窦娥冤', 'Guan Hanqing'],
      ['松江(黄道婆)', 'yuan', [121.44, 31.12], '黄道婆', 'Huang Daopo'],
      ['富阳(富春)', 'yuan', [119.95, 30.05], '富春山居图', 'Huang Gongwang'],
      ['蕲州', 'ming', [115.43, 30.22], '本草纲目', 'Li Shizhen'],
      ['北京(1629)', 'ming', [116.37, 39.90], '广渠门', 'Yuan Chonghuan'],
      ['北京(1630)', 'ming', [116.37, 39.90], '西市', 'Yuan Chonghuan'],
      ['北京(1763)', 'qing', [116.20, 39.99], '红楼梦', 'Cao Xueqin'],
      ['大渡河', 'qing', [102.35, 29.26], '石达开', 'Shi Dakai'],
      ['喀什', 'qing', [75.99, 39.47], '喀什噶尔', 'Kashgar'],
      ['敦煌', 'qing', [94.81, 40.04], '藏经洞', 'Mogao'],
      ['八达岭', 'qing', [116.02, 40.35], '詹天佑', 'Zhan Tianyou'],
      ['福州(1884)', 'qing', [119.30, 26.08], '马江海战', 'Mawei'],
      ['福州(1885)', 'qing', [119.30, 26.08], '左宗棠', 'Zuo Zongtang'],
      ['广州', 'qing', [113.30, 23.14], '黄花岗', 'Huanghuagang'],
    ];
    for (const [label, dynKey, coord, zhKw, enKw] of expectedCityGems) {
      const d = dynasties.find((x) => x.key === dynKey);
      ctrl.locale = 'zh';
      const zhEvs = ctrl._collectPlaceEventsForDynasty(d, coord[0], coord[1], null);
      assert(
        zhEvs.some((e) => e.text.includes(zhKw)),
        `Expected ZH city event "${zhKw}" at ${label} (${dynKey}), got ${JSON.stringify(zhEvs.map((e) => e.text))}`
      );
      ctrl.locale = 'en';
      const enEvs = ctrl._collectPlaceEventsForDynasty(d, coord[0], coord[1], null);
      assert(
        enEvs.some((e) => e.text.includes(enKw) && !/[\u4e00-\u9fa5]/.test(e.text)),
        `Expected EN city event "${enKw}" at ${label} (${dynKey}), got ${JSON.stringify(enEvs.map((e) => e.text))}`
      );
    }
    ctrl.locale = 'zh';

    const heroSpecs = [
      ['huoqubing', [-123, -121, -121, -119, -117], 'Huo Qubing'],
      ['simayi', [208, 228, 234, 238, 241, 249], 'Sima Yi'],
      ['yuefei', [1122, 1130, 1133, 1134, 1134, 1136, 1140, 1142], 'Yue'],
      ['xinqiji', [1161, 1162, 1180, 1188, 1196, 1205], 'Xin Qiji'],
      ['wentianxiang', [1256, 1275, 1276, 1276, 1279, 1283], 'Wen Tianxiang'],
      ['zuozongtang', [1852, 1864, 1866, 1873, 1876, 1878, 1880, 1885], 'Zuo Zongtang'],
    ];
    for (const [pKey, expYears, enName] of heroSpecs) {
      const prof = loreData.PERSON_PROFILES.find((p) => p.key === pKey);
      const stops = ctrl._collectPersonEvents(prof);
      assert.strictEqual(
        JSON.stringify(stops.map((s) => s.year)),
        JSON.stringify(expYears),
        `Unexpected stop years for ${pKey}: got ${JSON.stringify(stops.map((s) => s.year))}`
      );
      for (const st of stops) {
        assert(
          st.textEn.includes(enName) && !/[\u4e00-\u9fa5]/.test(st.textEn) && !/[\u4e00-\u9fa5]/.test(st.siteEn),
          `Expected clean English text & site mentioning "${enName}" on ${pKey}:${st.year}, got "${st.siteEn} -> ${st.textEn}"`
        );
      }
    }
  }

}

module.exports = { runTraceGenealogySuite };
