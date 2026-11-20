'use strict';

const { BASE_URL, LASTMOD } = require('../config');
const {
  escHtml,
  fmtYearShortZh,
  fmtDynSpanZh,
  firstSentenceZh,
  buildMapHref,
  buildEmbedHref,
} = require('../runtime');
const {
  renderSharedHead,
  renderTopHeader,
  hasTocSidebar,
  renderTocSidebar,
  renderEmbedMapSection,
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
  lang = 'zh',
  mapBase = '../',
}) {
  const canonicalUrl = `${BASE_URL}/topics/${topic.slug}.html`;
  const info = ctrl.inspect(topic.inspectQuery);
  const isRoute = Array.isArray(info.route) && info.route.length > 1;
  const routeOverrides = (geoOverrides && geoOverrides.routeStopOverrides && geoOverrides.routeStopOverrides[topic.slug]) || {};
  const adminOverrides =
    (geoOverrides && geoOverrides.placeDynastyAdminOverrides && geoOverrides.placeDynastyAdminOverrides[topic.slug]) || {};
  const nearestCfg = (geoOverrides && geoOverrides.nearestCity) || {};

  const pageTitle = `${topic.titleZh} · 古今地名政区沿革 | 江山时序`;
  const pageDesc = `${topic.titleZh}：${topic.summaryZh.slice(0, 140)}… 交互式历史地图定位、帝王年号与当时政区。`;

  let detailSectionHtml = '';
  let tocItems = [];

  if (isRoute) {
    const tabooRules = Array.isArray(routeOverrides._tabooRules) ? routeOverrides._tabooRules : [];
    const routeRows = info.route
      .map((st, idx) => {
        const stopHref = buildMapHref(`?year=${st.year}&place=${encodeURIComponent(st.place)}`, {
          lang,
          base: mapBase,
        });
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
              <td><a href="${escHtml(stopHref)}"><strong>${idx + 1}. ${fmtYearShortZh(st.year)}年</strong></a><br/><small>${escHtml(eraStr)}</small></td>
              <td><strong>${escHtml(placeDisplay)}</strong></td>
              <td>${escHtml(modernLoc)}${modProv ? `（${escHtml(modProv)}）` : ''}</td>
              <td>${escHtml(adminCombined)}</td>
            </tr>`;
      })
      .join('\n');

    tocItems = [
      { id: 'sec-map', label: '交互舆图预览' },
      { id: 'sec-route', label: '一、路线政区' },
    ];

    detailSectionHtml = `      <section id="sec-route" class="section-card">
        <h2>一、路线各站历史政区（里程约 ${info.routeDistanceKm} 公里）</h2>
        <div class="table-wrap">
          <table id="tbl-route" class="data-table is-wide-table">
            <thead>
              <tr>
                <th>年份与年号</th>
                <th>古地名</th>
                <th>现代位置</th>
                <th>所属政权与政区</th>
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

    // One row, for the year the topic is about. A row per dynasty sampled at that dynasty's
    // focus year described the place at eighteen dates unrelated to the battle or poem.
    const topicYear = Number(String(topic.inspectQuery.year).split(',')[0]);
    const genRows = allDynasties
      .filter((d) => (topic.dynastyKeys || []).includes(d.key))
      .slice(0, 1)
      .map((d) => {
        const sampleY = topicYear;
        const dInfo = info;
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
        const rowHref = buildMapHref(`?year=${sampleY}&place=${encodeURIComponent(targetPlace)}`, {
          lang,
          base: mapBase,
        });
        return `            <tr>
              <td><a href="${escHtml(rowHref)}"><strong>${escHtml(d.title)}</strong></a>（${fmtDynSpanZh(d)}）<br/><small>${escHtml(dInfo.era)}</small></td>
              <td>${escHtml(dInfo.polity || d.title)}</td>
              <td>${escHtml(adminStr)}</td>
              <td>${escHtml(nearStr)}</td>
            </tr>`;
      })
      .join('\n');

    tocItems = [
      { id: 'sec-map', label: '交互舆图预览' },
      { id: 'sec-genealogy', label: '一、当时政区' },
    ];

    detailSectionHtml = `      <section id="sec-genealogy" class="section-card">
        <h2>一、「${escHtml(resolvedDisplayTitle)}」${fmtYearShortZh(topicYear)}年所属政区</h2>
        <div class="table-wrap">
          <table id="tbl-genealogy" class="data-table is-wide-table">
            <thead>
              <tr>
                <th>历史时期与年号</th>
                <th>所属政权</th>
                <th>州道省郡政区</th>
                <th>邻近治所 / 古城</th>
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
    lang,
  })}
<body>
${renderTopHeader({ lang, mapBase })}
  <div class="page-shell${hasTocSidebar(tocItems) ? ' has-toc' : ''}">
${renderTocSidebar(tocItems)}
    <main class="main-col">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="${escHtml(buildMapHref('', { lang, base: mapBase }))}">江山时序首页</a> &rsaquo;
        <a href="index.html">专题图志总览</a> &rsaquo;
        <span>${escHtml(topic.shortZh)}</span>
      </nav>

      <article class="hero-card">
        <h1>${escHtml(topic.shortZh)}</h1>
        <blockquote class="poem-box">
          ${escHtml(topic.poemQuote)}
          <cite>—— ${escHtml(topic.poemAuthor)}</cite>
        </blockquote>
        <p>${escHtml(topic.summaryZh)}</p>
${renderRelatedStrip(relatedLinks)}
      </article>

${renderEmbedMapSection({
  id: 'sec-map',
  iframeSrc: buildEmbedHref(embedQuery, { lang, base: mapBase }),
  fullHref: buildMapHref(mapQuery, { lang, base: mapBase }),
  titleZh: `${topic.shortZh}交互式舆图预览`,
})}

${detailSectionHtml}

${renderFooter(allDynasties, { showDynastyChips: false, lang, mapBase })}
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
      descZh: firstSentenceZh(topic.summaryZh),
      descEn: topic.summaryEn.slice(0, 120) + '...',
    },
  };
}

module.exports = { buildFeaturedTopicPage };
