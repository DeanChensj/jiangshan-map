'use strict';

const { BASE_URL } = require('../config');
const { escHtml, fmtYearShortZh } = require('../runtime');
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
}) {
  const canonicalUrl = `${BASE_URL}/topics/places.html`;
  const catalogByModern = new Map(placeMonographItems.map((x) => [x.meta.modern, x.meta]));
  const remainingCities = (cityLoreList || []).filter((c) => c && !catalogByModern.has(c.modern));

  const monographRowsHtml = placeMonographItems
    .map(({ meta }) => {
      const lngFixed = meta.coord[0].toFixed(2);
      const latFixed = meta.coord[1].toFixed(2);
      const mapHref = `../?year=${meta.focusYear}&lng=${lngFixed}&lat=${latFixed}`;
      return `            <tr>
              <td><a href="${escHtml(meta.slug)}.html"><strong>${escHtml(meta.displayTitleZh)}</strong></a><br/><small>${escHtml(meta.en)}</small></td>
              <td><strong>${escHtml(meta.regionGroup)}</strong><br/><small>${escHtml(meta.tagZh)}</small></td>
              <td>${
                meta.capDynCount > 0 ? `图中 <strong>${meta.capDynCount}</strong> 朝建都 · ` : ''
              }收录 <strong>${meta.eventCount}</strong> 项历代史事</td>
              <td><a href="${escHtml(meta.slug)}.html">查阅地区志 →</a><br/><small><a href="${escHtml(mapHref)}">主图溯源</a></small></td>
            </tr>`;
    })
    .join('\n');

  const directoryRowsHtml = remainingCities
    .map((c) => {
      const lngFixed = c.coord[0].toFixed(2);
      const latFixed = c.coord[1].toFixed(2);
      const bestYear = resolveDirectoryBestYear(c.coord, loreData, allDynasties, ctrl);
      const mapHref = `../?year=${bestYear}&lng=${lngFixed}&lat=${latFixed}`;
      return `            <tr>
              <td><a href="${escHtml(mapHref)}"><strong>${escHtml(c.modern)}</strong></a><br/><small>${lngFixed}°E, ${latFixed}°N</small></td>
              <td><strong>${escHtml(c.tagZh)}</strong><br/><small>${escHtml(c.tagEn)}</small></td>
              <td>${escHtml(c.descZh)}</td>
              <td><a href="${escHtml(mapHref)}">点地溯源（${fmtYearShortZh(bestYear)}年）→</a></td>
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
      const mapHref = `../?year=${fy}&lng=${lngFixed}&lat=${latFixed}`;
      const spanZh = p.vanish
        ? `${fmtYearShortZh(p.appear)}—${fmtYearShortZh(p.vanish)}`
        : `${fmtYearShortZh(p.appear)}—今`;
      return `            <tr>
              <td><a href="${escHtml(mapHref)}"><strong>${escHtml(p.ancientZh)}</strong></a><br/><small>${escHtml(p.ancientEn)} · ${escHtml(spanZh)}</small></td>
              <td><strong>${escHtml(p.modernZh)}</strong><br/><small>${escHtml(p.rangeZh)}</small></td>
              <td>${escHtml(p.chokepointZh)}</td>
              <td><a href="${escHtml(mapHref)}">地图定位（${fmtYearShortZh(fy)}年）→</a></td>
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
    { id: 'sec-monographs', label: `一、核心古都地区志（${placeMonographItems.length}）` },
    { id: 'sec-cities-directory', label: `二、其余历史名城（${remainingCities.length}）` },
    { id: 'sec-passes', label: `三、二十座天下雄关（${totalPassesCount}）` },
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
  })}
<body>
${renderTopHeader({ activeNav: 'places' })}
  <div class="page-shell has-toc">
${renderTocSidebar(tocItems)}
    <main class="main-col">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="../">江山时序首页</a> &rsaquo;
        <a href="index.html">专题图志总览</a> &rsaquo;
        <span>历代地区志</span>
      </nav>

      <article class="hero-card">
        <span class="kicker">点地溯源 · 历代地区志与雄关总录（收录 ${totalCitiesCount} 座名城 · ${totalPassesCount} 座雄关）</span>
        <h1>中国历代名城古今政区沿革与天下雄关地理志</h1>
        <p class="en-sub">Historical City Genealogies, Regional Administrative Evolution &amp; Strategic Mountain Passes (403 BCE – Present)</p>
        <div class="meta-pills">
          <span class="meta-pill"><strong>核心名城独立志：</strong>${placeMonographItems.length} 篇</span>
          <span class="meta-pill"><strong>全库历史名城：</strong>${totalCitiesCount} 座</span>
          <span class="meta-pill"><strong>天下名关雄隘：</strong>${totalPassesCount} 座</span>
        </div>
        <p>覆盖战国至现代 18 个历史时期的城市沿革档案：22 座核心古都与区域重镇均建有独立地区志，详列十八朝政权归属、州道行省郡县、历代史事编年与正史出处；其余名城与 20 座天下雄关均可一键定位至主图点地溯源视图。</p>
        <div class="cta-row">
          <a class="cta-btn" href="../">进入主地图点击任意城池体验「点地溯源」→</a>
          <a class="cta-btn secondary" href="index.html">返回专题图志总览</a>
        </div>
      </article>

      <section id="sec-monographs" class="section-card">
        <h2>一、核心古都与区域中心独立地区志（${placeMonographItems.length} 篇）</h2>
        <p>可按地理片区筛选或输入古今地名检索，每篇含 18 朝固定坐标政区沿革表、历代大事与交互地图切片：</p>
${renderFilterPresetChips('tbl-place-monographs', regionPresets)}
${renderTableFilterBar('tbl-place-monographs', '按城名、古称或片区检索 22 篇地区志…', placeMonographItems.length, { force: true })}
        <div class="table-wrap">
          <table id="tbl-place-monographs" class="data-table">
            <thead>
              <tr>
                <th>历史名城（中英对照）</th>
                <th>地理片区与形胜提要</th>
                <th>建都与史事统计</th>
                <th>专题入口</th>
              </tr>
            </thead>
            <tbody>
${monographRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-cities-directory" class="section-card">
        <h2>二、全库其余历史名城形胜速查（${remainingCities.length} 座）</h2>
        <p>覆盖燕云、江南、江淮、巴蜀、岭南、关陇、西域、东北及港澳台等其余历代名城，点击即可直达主图点地溯源卡片：</p>
${renderTableFilterBar('tbl-place-directory', `按城市名、山川形胜或史事关键词检索其余 ${remainingCities.length} 座名城…`, remainingCities.length, { force: true })}
        <div class="table-wrap">
          <table id="tbl-place-directory" class="data-table">
            <thead>
              <tr>
                <th>现代城市与坐标</th>
                <th>形胜定位</th>
                <th>历史地理提要</th>
                <th>交互地图</th>
              </tr>
            </thead>
            <tbody>
${directoryRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-passes" class="section-card">
        <h2>三、二十座天下名关雄隘形胜录（${totalPassesCount} 座）</h2>
        <p>精选中国历史军事地理中最具枢纽意义的山川关隘（函数古道、秦汉唐宋边防锁钥），支持直接定位至关键守御年份：</p>
${renderTableFilterBar('tbl-passes', '按关隘名称、山脉河川或现代所在地检索 20 座雄关…', totalPassesCount, { force: true })}
        <div class="table-wrap">
          <table id="tbl-passes" class="data-table">
            <thead>
              <tr>
                <th>雄关名与存续时期</th>
                <th>今地与山川地形</th>
                <th>战略扼守考据</th>
                <th>交互地图</th>
              </tr>
            </thead>
            <tbody>
${passRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

${renderFooter(allDynasties)}
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
