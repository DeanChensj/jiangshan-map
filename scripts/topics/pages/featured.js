'use strict';

const { BASE_URL, LASTMOD } = require('../config');
const { escHtml, fmtYearZh, fmtYearShortZh, fmtDynSpanZh } = require('../runtime');
const {
  renderSharedHead,
  renderTopHeader,
  renderTocSidebar,
  renderEmbedMapSection,
  renderTableFilterBar,
  renderRelatedStrip,
  renderFooter,
} = require('../layout');

function resolveNearestCityDisplay(slug, dInfo, fallbackLabel, nearestCfg) {
  const maxDist = (nearestCfg && nearestCfg.maxDistanceKm) || 55;
  const distAbove = (nearestCfg && nearestCfg.showDistanceAboveKm) || 25;
  const exclAncient = (nearestCfg && nearestCfg.excludeAncientContainsBySlug && nearestCfg.excludeAncientContainsBySlug[slug]) || [];
  const exclModern = (nearestCfg && nearestCfg.excludeModernContainsBySlug && nearestCfg.excludeModernContainsBySlug[slug]) || [];
  const nc = dInfo.nearestCity;

  const blocked =
    !nc ||
    nc.distanceKm > maxDist ||
    exclAncient.some((tok) => (nc.ancient || '').includes(tok)) ||
    exclModern.some((tok) => (nc.modern || '').includes(tok));

  if (!blocked) {
    return nc.distanceKm <= distAbove
      ? `${nc.ancient}（今${nc.modern}）`
      : `${nc.ancient}（今${nc.modern}，距 ${nc.distanceKm} km）`;
  }
  return (nearestCfg && nearestCfg.fallbackLabelBySlug && nearestCfg.fallbackLabelBySlug[slug]) || fallbackLabel;
}

function buildFeaturedTopicPage({
  topic,
  allDynasties,
  ctrl,
  geoOverrides,
  relatedLinks,
  assetHashes,
}) {
  const canonicalUrl = `${BASE_URL}/topics/${topic.slug}.html`;
  const info = ctrl.inspect(topic.inspectQuery);
  const isRoute = Array.isArray(info.route) && info.route.length > 1;
  const routeOverrides = (geoOverrides && geoOverrides.routeStopOverrides && geoOverrides.routeStopOverrides[topic.slug]) || {};
  const adminOverrides =
    (geoOverrides && geoOverrides.placeDynastyAdminOverrides && geoOverrides.placeDynastyAdminOverrides[topic.slug]) || {};
  const nowOverride =
    (geoOverrides && geoOverrides.targetNowOverrides && geoOverrides.targetNowOverrides[topic.slug]) || null;
  const nearestCfg = (geoOverrides && geoOverrides.nearestCity) || {};

  const pageTitle = `${topic.titleZh} · 古今地名政区沿革 | 江山时序`;
  const pageDesc = `${topic.titleZh}：${topic.summaryZh.slice(0, 140)}… 交互式历史地图定位、帝王年号与两千四百年古今政区沿革。`;

  let detailSectionHtml = '';
  let tocItems = [];

  if (isRoute) {
    const tabooRules = Array.isArray(routeOverrides._tabooRules) ? routeOverrides._tabooRules : [];
    const routeRows = info.route
      .map((st, idx) => {
        const stopHref = `../?year=${st.year}&place=${encodeURIComponent(st.place)}`;
        const stopOv = routeOverrides[st.place] || null;
        let placeDisplay = st.place;
        if (stopOv && stopOv.placeDisplay) {
          placeDisplay = stopOv.placeDisplay;
        } else if (st.resolvedName && st.resolvedName !== st.place && !st.resolvedName.includes('亭')) {
          placeDisplay = `${st.place}（${st.resolvedName}）`;
        }
        const modernLoc = (stopOv && stopOv.modernLoc) || st.modern || '';
        const modProv = (stopOv && stopOv.modernProv) || st.modernProvince || '';

        let adminStr =
          stopOv && stopOv.admin !== undefined
            ? stopOv.admin
            : Array.from(new Set([...(st.regions || []), ...(st.prefectures || [])]))
                .map((p) => p.replace(/\(([^)]+)\)/g, '（$1）'))
                .join(' · ');

        for (const rule of tabooRules) {
          if (st.year >= rule.fromYear && adminStr.includes(rule.replace)) {
            adminStr = adminStr.split(rule.replace).join(rule.with);
          }
        }
        const polityStr = stopOv && stopOv.polity !== undefined ? stopOv.polity : st.polity || '';
        const eraStr = stopOv && stopOv.era !== undefined ? stopOv.era : st.era;
        const adminCombined = [polityStr, adminStr].filter(Boolean).join(' · ');

        return `            <tr>
              <td>第 ${idx + 1} 站</td>
              <td><strong>${fmtYearShortZh(st.year)}年</strong><br/><small>${escHtml(eraStr)}</small></td>
              <td><strong>${escHtml(placeDisplay)}</strong></td>
              <td>${escHtml(modernLoc)}${modProv ? `（${escHtml(modProv)}）` : ''}</td>
              <td>${escHtml(adminCombined)}</td>
              <td>${st.coord[0].toFixed(2)}°E, ${st.coord[1].toFixed(2)}°N</td>
              <td><a href="${escHtml(stopHref)}">单站定位 →</a></td>
            </tr>`;
      })
      .join('\n');

    tocItems = [
      { id: 'sec-map', label: '交互舆图预览' },
      { id: 'sec-route', label: `一、路线政区（${info.route.length} 站）` },
    ];

    detailSectionHtml = `      <section id="sec-route" class="section-card">
        <h2>一、路线各站时空坐标与历史政区解析（总航程/里程约 ${info.routeDistanceKm} 公里）</h2>
        <p>以下数据由「江山时序」历史地理引擎（<code>window.atlasAPI.inspect</code>）按各站对应历史年份自动解算：</p>
        <div class="table-wrap">
          <table id="tbl-route" class="data-table">
            <thead>
              <tr>
                <th>站序</th>
                <th>历史年份与年号</th>
                <th>诗文/史籍古地名</th>
                <th>现代地理位置</th>
                <th>当时所属政权与州道政区</th>
                <th>经纬度</th>
                <th>交互地图</th>
              </tr>
            </thead>
            <tbody>
${routeRows}
            </tbody>
          </table>
        </div>
      </section>`;
  } else {
    const targetPlace = topic.inspectQuery.place;
    const resolvedDisplayTitle = topic.targetDisplayTitle || info.resolvedName || targetPlace;
    const cleanFallbackSeat = `${targetPlace}（今${info.modern || ''}）`;

    const genRows = allDynasties
      .map((d) => {
        const sampleY = d.focusYear !== undefined ? d.focusYear : d.fromYear;
        const dInfo = ctrl.inspect({ year: sampleY, place: targetPlace });
        const rawAdminList =
          d.key === 'zhanguo'
            ? dInfo.polity === '秦'
              ? [...(dInfo.regions || []), ...(dInfo.prefectures || [])]
              : dInfo.prefectures || []
            : [...(dInfo.regions || []), ...(dInfo.prefectures || [])];
        const adminParts = Array.from(
          new Set(rawAdminList.map((p) => String(p).replace(/\(([^)]+)\)/g, '（$1）')))
        ).filter(Boolean);
        let adminStr =
          adminParts.join(' · ') ||
          (d.key === 'zhanguo'
            ? `${dInfo.polity || d.title}直辖（未设郡）`
            : `${dInfo.polity || d.title}直辖`);
        if (adminOverrides[d.key] && adminOverrides[d.key].admin) {
          adminStr = adminOverrides[d.key].admin;
        }
        const nearStr = resolveNearestCityDisplay(topic.slug, dInfo, cleanFallbackSeat, nearestCfg);
        const rowHref = `../?year=${sampleY}&place=${encodeURIComponent(targetPlace)}`;
        return `            <tr>
              <td><strong>${escHtml(d.title)}</strong>（${fmtDynSpanZh(d)}）</td>
              <td>${escHtml(dInfo.era)}</td>
              <td>${escHtml(dInfo.polity || d.title)}</td>
              <td>${escHtml(adminStr)}</td>
              <td>${escHtml(nearStr)}</td>
              <td><a href="${escHtml(rowHref)}">查看该朝版图 →</a></td>
            </tr>`;
      })
      .join('\n');

    const adminNow =
      (nowOverride && nowOverride.adminNow) ||
      Array.from(new Set([...(info.regions || []), ...(info.prefectures || [])]))
        .map((p) => String(p).replace(/\(([^)]+)\)/g, '（$1）'))
        .join(' · ');
    const polityNow = (nowOverride && nowOverride.polityNow) || info.polity || '';
    const adminCombined = [polityNow, adminNow].filter(Boolean).join(' · ');

    tocItems = [
      { id: 'sec-map', label: '交互舆图预览' },
      { id: 'sec-detail', label: '一、目标节点考据' },
      { id: 'sec-genealogy', label: `二、历代沿革（${allDynasties.length} 朝）` },
    ];

    detailSectionHtml = `      <section id="sec-detail" class="section-card">
        <h2>一、目标时空节点精准考据（${fmtYearZh(info.year)} · ${escHtml(info.era)}）</h2>
        <div class="table-wrap">
          <table class="data-table">
            <tbody>
              <tr>
                <th style="width:24%">查询古地名 / 典故地标</th>
                <td><strong>${escHtml(resolvedDisplayTitle)}</strong></td>
              </tr>
              <tr>
                <th>历史纪年与帝王年号</th>
                <td>${fmtYearZh(info.year)} · <strong>${escHtml(info.era)}</strong>（${escHtml(info.dynasty.title)}，都城：${escHtml(info.dynasty.seat)}）</td>
              </tr>
              <tr>
                <th>当时所属政权与州郡政区</th>
                <td><strong>${escHtml(adminCombined)}</strong></td>
              </tr>
              <tr>
                <th>现代行政区划与经纬度</th>
                <td>${escHtml(info.modernProvince)} · 今${escHtml(info.modern || '')}（${info.coord[0].toFixed(2)}°E, ${info.coord[1].toFixed(2)}°N）</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-genealogy" class="section-card">
        <h2>二、「${escHtml(resolvedDisplayTitle)}」两千四百年历代政区沿革表（点地溯源）</h2>
        <p>同一地理坐标（${info.coord[0].toFixed(2)}°E, ${info.coord[1].toFixed(2)}°N）从战国（前403年）至现代共 18 个历史时期的政权归属与州道郡县沿革：</p>
${renderTableFilterBar('tbl-genealogy', '筛选朝代、年号、政权或郡县政区…', allDynasties.length)}
        <div class="table-wrap">
          <table id="tbl-genealogy" class="data-table">
            <thead>
              <tr>
                <th>历史时期</th>
                <th>代表纪年与年号</th>
                <th>所属政权</th>
                <th>州 / 道 / 路 / 省政区</th>
                <th>邻近治所 / 古城</th>
                <th>地图跳转</th>
              </tr>
            </thead>
            <tbody>
${genRows}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  const mapQuery = topic.mapQuery || '';
  const embedQuery = mapQuery.startsWith('?') ? mapQuery.slice(1) : mapQuery;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: pageTitle,
        description: pageDesc,
        url: canonicalUrl,
        datePublished: LASTMOD,
        dateModified: LASTMOD,
        inLanguage: ['zh-CN', 'en'],
        author: {
          '@type': 'Organization',
          name: '江山时序 (Jiangshan Historical Atlas)',
          url: `${BASE_URL}/`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '江山时序首页', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: '专题图志总览', item: `${BASE_URL}/topics/index.html` },
          { '@type': 'ListItem', position: 3, name: topic.shortZh, item: canonicalUrl },
        ],
      },
    ],
  };

  const html = `${renderSharedHead({
    title: pageTitle,
    description: pageDesc,
    keywords: topic.keywords,
    canonicalUrl,
    jsonLdObj: jsonLd,
    assetHashes,
  })}
<body>
${renderTopHeader()}
  <div class="page-shell has-toc">
${renderTocSidebar(tocItems)}
    <main class="main-col">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="../">江山时序首页</a> &rsaquo;
        <a href="index.html">专题图志总览</a> &rsaquo;
        <span>${escHtml(topic.shortZh)}</span>
      </nav>

      <article class="hero-card">
        <span class="kicker">${escHtml(topic.categoryZh)} · ${escHtml(topic.categoryEn)}</span>
        <h1>${escHtml(topic.shortZh)}</h1>
        <p class="en-sub">${escHtml(topic.titleEn)}</p>
        <blockquote class="poem-box">
          ${escHtml(topic.poemQuote)}
          <cite>—— ${escHtml(topic.poemAuthor)}</cite>
        </blockquote>
        <p>${escHtml(topic.summaryZh)}</p>
        <p class="en-sub">${escHtml(topic.summaryEn)}</p>
        <div class="cta-row">
          <a class="cta-btn" href="../${escHtml(mapQuery)}">在交互地图中打开此专题 →</a>
          <a class="cta-btn secondary" href="../${escHtml(mapQuery)}&amp;lang=en">Open in English →</a>
          <a class="cta-btn secondary" href="index.html">返回图志总览</a>
        </div>
${renderRelatedStrip(relatedLinks)}
      </article>

${renderEmbedMapSection({
  id: 'sec-map',
  iframeSrc: `../?embed=1&${embedQuery}`,
  titleZh: `${topic.shortZh}交互式历史舆图预览`,
  hintZh: '点击地图激活交互 · 右上角可全屏打开主地图',
})}

${detailSectionHtml}

${renderFooter(allDynasties)}
    </main>
  </div>
</body>
</html>
`;

  return {
    filename: `${topic.slug}.html`,
    html,
    meta: {
      slug: topic.slug,
      url: canonicalUrl,
      titleZh: topic.shortZh,
      titleEn: topic.titleEn,
      descZh: topic.summaryZh.slice(0, 95) + '…',
      descEn: topic.summaryEn.slice(0, 120) + '...',
    },
  };
}

module.exports = { buildFeaturedTopicPage };
