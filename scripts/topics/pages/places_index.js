'use strict';

const { BASE_URL } = require('../config');
const { escHtml, fmtYearShortZh, buildMapHref } = require('../runtime');
const {
  renderSharedHead,
  renderTopHeader,
  renderTocSidebar,
  renderTableFilterBar,
  renderFilterPresetChips,
  renderFooter,
} = require('../layout');

function resolveDirectoryBestYear(coord, loreData, dynasties, ctrl) {
  const [lng, lat] = coord || [0, 0];
  const minY = (dynasties && dynasties[0] && dynasties[0].fromYear) || -403;
  const maxY = 2026;
  const landmarks = (loreData && loreData.PLACE_LANDMARK_EVENTS) || [];
  let bestLm = null;
  let bestKm = Infinity;
  for (const lm of landmarks) {
    if (!lm.coord || lm.year < minY || lm.year > maxY) continue;
    const km = ctrl.projector.greatCircleKm([lng, lat], lm.coord);
    if (km <= 30 && km < bestKm) {
      bestKm = km;
      bestLm = lm;
    }
  }
  if (bestLm) return bestLm.year;

  for (const d of dynasties) {
    const near = ctrl._findNearestSettlement(d.settlements, lng, lat);
    if (near && near.km <= 30 && near.s && near.s.isCapital) {
      const y = d.focusYear !== undefined ? d.focusYear : d.fromYear;
      return Math.max(minY, Math.min(maxY, y));
    }
  }
  for (const d of dynasties) {
    const near = ctrl._findNearestSettlement(d.settlements, lng, lat);
    if (near && near.km <= 28) {
      const y = d.focusYear !== undefined ? d.focusYear : d.fromYear;
      return Math.max(minY, Math.min(maxY, y));
    }
  }
  return 741;
}

function buildPlacesIndexPage({
  placeMonographItems,
  cityLoreList,
  strategicPasses,
  allDynasties,
  loreData,
  ctrl,
  assetHashes,
  lang = 'zh',
  mapBase = '../',
}) {
  const canonicalUrl = `${BASE_URL}/topics/places.html`;
  const catalogByModern = new Map(placeMonographItems.map((x) => [x.meta.modern, x.meta]));
  const remainingCities = (cityLoreList || []).filter((c) => c && !catalogByModern.has(c.modern));

  const monographRowsHtml = placeMonographItems
    .map(({ meta }) => {
      const lngFixed = meta.coord[0].toFixed(2);
      const latFixed = meta.coord[1].toFixed(2);
      const mapHref = buildMapHref(`?year=${meta.focusYear}&lng=${lngFixed}&lat=${latFixed}`, {
        lang,
        base: mapBase,
      });
      return `            <tr data-search="${escHtml(meta.en)}">
              <td><a href="${escHtml(meta.slug)}.html"><strong>${escHtml(meta.displayTitleZh)}</strong></a><br/><small>${escHtml(meta.regionGroup)}</small></td>
              <td>${escHtml(meta.tagZh)}</td>
              <td class="col-action"><a href="${escHtml(mapHref)}">主图 →</a></td>
            </tr>`;
    })
    .join('\n');

  const directoryRowsHtml = remainingCities
    .map((c) => {
      const lngFixed = c.coord[0].toFixed(2);
      const latFixed = c.coord[1].toFixed(2);
      const bestYear = resolveDirectoryBestYear(c.coord, loreData, allDynasties, ctrl);
      const mapHref = buildMapHref(`?year=${bestYear}&lng=${lngFixed}&lat=${latFixed}`, {
        lang,
        base: mapBase,
      });
      return `            <tr${c.tagEn ? ` data-search="${escHtml(c.tagEn)}"` : ''}>
              <td><a href="${escHtml(mapHref)}"><strong>${escHtml(c.modern)}</strong></a><br/><small>${escHtml(c.tagZh)}</small></td>
              <td>${escHtml(c.descZh)}</td>
            </tr>`;
    })
    .join('\n');

  const minY = (allDynasties && allDynasties[0] && allDynasties[0].fromYear) || -403;
  const passRowsHtml = (strategicPasses || [])
    .map((p) => {
      const lngFixed = p.coord[0].toFixed(2);
      const latFixed = p.coord[1].toFixed(2);
      const rawFy = Number.isInteger(p.focusYear) ? p.focusYear : p.appear || 741;
      const fy = Math.max(minY, Math.min(2026, rawFy));
      const mapHref = buildMapHref(`?year=${fy}&lng=${lngFixed}&lat=${latFixed}`, {
        lang,
        base: mapBase,
      });
      const spanZh = p.vanish
        ? `${fmtYearShortZh(p.appear)}—${fmtYearShortZh(p.vanish)}`
        : `${fmtYearShortZh(p.appear)}—今`;
      return `            <tr${p.ancientEn ? ` data-search="${escHtml(p.ancientEn)}"` : ''}>
              <td><a href="${escHtml(mapHref)}"><strong>${escHtml(p.ancientZh)}</strong></a><br/><small>${escHtml(spanZh)}</small></td>
              <td><strong>${escHtml(p.modernZh)}</strong><br/><small>${escHtml(p.rangeZh)}</small></td>
              <td>${escHtml(p.chokepointZh)}</td>
            </tr>`;
    })
    .join('\n');

  const regionPresets = [
    { label: '全部', value: '' },
    { label: '关中与西北', value: '关中与西北' },
    { label: '中原与华北', value: '中原与华北' },
    { label: '江南与江淮', value: '江南与江淮' },
    { label: '荆楚与湖湘', value: '荆楚与湖湘' },
    { label: '岭南与东南', value: '岭南与东南' },
    { label: '巴蜀与西南', value: '巴蜀与西南' },
    { label: '青藏高原', value: '青藏高原' },
  ];

  const totalCitiesCount = (cityLoreList || []).length;
  const totalPassesCount = (strategicPasses || []).length;

  const tocItems = [
    { id: 'sec-monographs', label: '一、核心名城独立志' },
    { id: 'sec-cities-directory', label: '二、其余历史名城' },
    { id: 'sec-passes', label: '三、天下名关雄隘' },
  ];

  const pageTitle = `历代地区志与天下雄关总录（${placeMonographItems.length}座核心名城独立志 · ${totalCitiesCount}名城 · ${totalPassesCount}雄关） | 江山时序`;
  const pageDesc = `江山时序点地溯源地区志总录：收录 ${placeMonographItems.length} 座历代古都与区域中心独立沿革图志、全库 ${totalCitiesCount} 座名城形胜简介与 ${totalPassesCount} 座天下名关雄隘地理考据。`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: pageTitle,
    description: pageDesc,
    url: canonicalUrl,
    inLanguage: ['zh-CN', 'en'],
    isPartOf: {
      '@type': 'WebSite',
      name: '江山时序 · 中国历史地图',
      url: `${BASE_URL}/`,
    },
  };

  const html = `${renderSharedHead({
    title: pageTitle,
    description: pageDesc,
    keywords: [
      '中国历史名城沿革',
      '古今地名对照',
      '历代地区志',
      '点地溯源',
      '二十座天下雄关',
      '中国古都地图',
      '江山时序',
    ],
    canonicalUrl,
    jsonLdObj: jsonLd,
    assetHashes,
    lang,
  })}
<body>
${renderTopHeader({ activeNav: 'places', lang, mapBase })}
  <div class="page-shell has-toc">
${renderTocSidebar(tocItems)}
    <main class="main-col">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="${escHtml(buildMapHref('', { lang, base: mapBase }))}">江山时序首页</a> &rsaquo;
        <a href="index.html">专题图志总览</a> &rsaquo;
        <span>历代地区志</span>
      </nav>

      <article class="hero-card">
        <span class="kicker">点地溯源 · 历代地区志与雄关</span>
        <h1>历代名城政区沿革与天下雄关志</h1>
        <p>涵盖战国至现代的历代名城沿革档案与天下雄关地理考据；核心城市建有独立沿革志，其余名城与雄关可直达主图定位。</p>
        <div class="cta-row">
          <a class="cta-btn" href="${escHtml(buildMapHref('', { lang, base: mapBase }))}">进入主地图体验「点地溯源」→</a>
        </div>
      </article>

      <section id="sec-monographs" class="section-card">
        <h2>一、核心名城独立志</h2>
${renderFilterPresetChips('tbl-place-monographs', regionPresets)}
${renderTableFilterBar('tbl-place-monographs', '按城名、古称或片区检索…', placeMonographItems.length, { force: true })}
        <div class="table-wrap">
          <table id="tbl-place-monographs" class="data-table">
            <thead>
              <tr>
                <th>历史名城</th>
                <th>形胜定位</th>
                <th class="col-action">主图</th>
              </tr>
            </thead>
            <tbody>
${monographRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-cities-directory" class="section-card">
        <h2>二、其余历史名城</h2>
${renderTableFilterBar('tbl-place-directory', '按城名、形胜或关键词检索…', remainingCities.length, { force: true })}
        <div class="table-wrap">
          <table id="tbl-place-directory" class="data-table">
            <thead>
              <tr>
                <th>名城与形胜</th>
                <th>历史地理提要</th>
              </tr>
            </thead>
            <tbody>
${directoryRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-passes" class="section-card">
        <h2>三、天下名关雄隘</h2>
        <p>收录历代军事地理要冲关隘，点击关名即可在主地图定位至代表年份。</p>
${renderTableFilterBar('tbl-passes', '按关隘、山川或今地检索…', totalPassesCount, { force: true })}
        <div class="table-wrap">
          <table id="tbl-passes" class="data-table">
            <thead>
              <tr>
                <th>雄关与存续</th>
                <th>今地与山川</th>
                <th>战略扼守</th>
              </tr>
            </thead>
            <tbody>
${passRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

${renderFooter(allDynasties, { showDynastyChips: false, lang, mapBase })}
    </main>
  </div>
</body>
</html>
`;

  return {
    filename: 'places.html',
    html,
  };
}

module.exports = { buildPlacesIndexPage };
