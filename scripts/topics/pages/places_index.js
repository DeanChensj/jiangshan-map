'use strict';

const { BASE_URL } = require('../config');
const { escHtml, buildMapHref } = require('../runtime');
const {
  renderSharedHead,
  renderTopHeader,
  renderTableFilterBar,
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
  const cityLoreByModern = new Map((cityLoreList || []).map((c) => [c.modern, c]));
  const catalogByModern = new Map(placeMonographItems.map((x) => [x.meta.modern, x.meta]));
  const remainingCities = (cityLoreList || []).filter((c) => c && !catalogByModern.has(c.modern));

  const monographRowsHtml = placeMonographItems
    .map(({ meta }) => {
      const cityLore = cityLoreByModern.get(meta.modern) || {};
      const searchExtras = [meta.en, meta.regionGroup, cityLore.tagEn || ''].filter(Boolean).join(' ');
      return `            <tr data-search="${escHtml(searchExtras)}">
              <td><a href="${escHtml(meta.slug)}.html"><strong>${escHtml(meta.displayTitleZh)}</strong></a><span class="person-type-badge is-monograph">沿革志</span><br/><small>${escHtml(cityLore.tagZh || meta.tagZh)}</small></td>
              <td>${escHtml(cityLore.descZh || meta.descZh)}</td>
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
      return `            <tr${p.ancientEn ? ` data-search="${escHtml(p.ancientEn)}"` : ''}>
              <td><a href="${escHtml(mapHref)}"><strong>${escHtml(p.ancientZh)}</strong></a></td>
              <td><strong>${escHtml(p.modernZh)}</strong><br/><small>${escHtml(p.rangeZh)}</small></td>
              <td>${escHtml(p.chokepointZh)}</td>
            </tr>`;
    })
    .join('\n');

  const totalCitiesCount = (cityLoreList || []).length;
  const totalPassesCount = (strategicPasses || []).length;

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
  <div class="page-shell">
    <main class="main-col">
      <article class="hero-card">
        <h1>历代名城政区沿革与天下雄关志</h1>
        <p>涵盖战国至现代的历代名城沿革档案与天下雄关地理考据；标有「沿革志」的核心名城可查阅十八朝沿革图志，其余名城与雄关直达主图定位。</p>
      </article>

      <section id="sec-cities" class="section-card">
        <h2>一、历代历史名城</h2>
${renderTableFilterBar('tbl-places', '按城名、古称、形胜或关键词检索…', totalCitiesCount)}
        <div class="table-wrap">
          <table id="tbl-places" class="data-table">
            <thead>
              <tr>
                <th>名城与形胜</th>
                <th>历史地理提要</th>
              </tr>
            </thead>
            <tbody>
${monographRowsHtml}
${directoryRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-passes" class="section-card">
        <h2>二、天下名关雄隘</h2>
        <p>收录历代军事地理要冲关隘，点击关名即可在主地图定位至代表年份。</p>
${renderTableFilterBar('tbl-passes', '按关隘、山川或今地检索…', totalPassesCount)}
        <div class="table-wrap">
          <table id="tbl-passes" class="data-table">
            <thead>
              <tr>
                <th>雄关</th>
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
