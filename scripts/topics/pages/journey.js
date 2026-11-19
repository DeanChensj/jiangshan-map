'use strict';

const { BASE_URL, LASTMOD } = require('../config');
const {
  escHtml,
  fmtYearShortZh,
  dedupeConsecutive,
  buildMapHref,
  buildEmbedHref,
  formatSourceCitationsHtml,
} = require('../runtime');
const {
  renderSharedHead,
  renderTopHeader,
  renderTocSidebar,
  renderEmbedMapSection,
  renderRelatedStrip,
  renderFooter,
} = require('../layout');

function buildJourneyPage({
  j,
  allDynasties,
  sourcesBundle,
  relatedLinks,
  assetHashes,
  lang = 'zh',
  mapBase = '../',
}) {
  const slug = `journey-${j.key}`;
  const canonicalUrl = `${BASE_URL}/topics/${slug}.html`;
  const mapQuery = `?person=${encodeURIComponent(j.key)}`;
  const stops = j.stops || [];
  const stopsChainZh = stops.map((s) => `${s.ancientZh}（今${s.modernZh}）`).join(' → ');

  const cleanSpanZh = j.spanZh.replace(/[（）()]/g, ' · ').replace(/\s*·\s*$/, '');
  const cleanSpanEn = j.spanEn.replace(/[（）()]/g, ' · ').replace(/\s*·\s*$/, '');

  const pageTitle = `${j.titleZh}路线图（${cleanSpanZh}）· ${stops.length}站古今地名对照与诗词纪事 | 江山时序`;
  const pageDesc = `${j.titleZh}（${j.titleEn}，${cleanSpanZh}）历史地图时空轨迹，全线共 ${stops.length} 站：${stopsChainZh}。提供逐站帝王年号、古今政区对照、经典史料诗词与交互式路线回放。`;

  const yearSeen = new Map();
  const stopCardsHtml = stops
    .map((s, sIdx) => {
      const cnt = (yearSeen.get(s.year) || 0) + 1;
      yearSeen.set(s.year, cnt);
      const stopKeySuffix = cnt > 1 ? `${s.year}-${cnt}` : `${s.year}`;
      const stopCiteHtml = formatSourceCitationsHtml(`journey:${j.key}:${stopKeySuffix}`, sourcesBundle);
      const stopMapHref = buildMapHref(`?person=${encodeURIComponent(j.key)}&stop=${sIdx}`, {
        lang,
        base: mapBase,
      });
      return `        <div class="stop-card">
          <div class="stop-header">
            <div>
              <span class="stop-badge">第 ${sIdx + 1} 站</span>
              <strong>${escHtml(s.ancientZh)}（今${escHtml(s.modernZh)}）· ${escHtml(s.titleZh)}</strong>
            </div>
            <div>
              <strong>${fmtYearShortZh(s.year)}年（${escHtml(s.eraZh)}）</strong> ·
              <a class="stop-map-link" href="${escHtml(stopMapHref)}">地图定位 →</a>
            </div>
          </div>
          <p class="stop-desc-zh">${escHtml(s.descZh)}</p>
          ${
            s.quoteZh
              ? `<blockquote class="poem-box">${escHtml(s.quoteZh)}</blockquote>`
              : ''
          }${stopCiteHtml}
        </div>`;
    })
    .join('\n');

  const personSourceHtml = formatSourceCitationsHtml(`person:${j.key}`, sourcesBundle);

  const tocItems = [
    { id: 'sec-map', label: '行迹路线预览' },
    { id: 'sec-stops', label: '逐站详解' },
  ];

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
          { '@type': 'ListItem', position: 3, name: j.titleZh, item: canonicalUrl },
        ],
      },
    ],
  };

  const keywords = [
    `${j.titleZh}`,
    `${j.shortZh}路线图`,
    `${j.shortZh}古今地名对照`,
    `${j.titleEn} map`,
    ...stops.map((s) => s.ancientZh),
    '点人溯事',
    '江山时序',
  ];

  const html = `${renderSharedHead({
    title: pageTitle,
    description: pageDesc,
    keywords,
    canonicalUrl,
    jsonLdObj: jsonLd,
    assetHashes,
    lang,
  })}
<body>
${renderTopHeader({ lang, mapBase })}
  <div class="page-shell has-toc">
${renderTocSidebar(tocItems)}
    <main class="main-col">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="${escHtml(buildMapHref('', { lang, base: mapBase }))}">江山时序首页</a> &rsaquo;
        <a href="index.html">专题图志总览</a> &rsaquo;
        <span>${escHtml(j.titleZh)}</span>
      </nav>

      <article class="hero-card">
        <span class="kicker">点人溯事 · 历史人物精修行迹</span>
        <h1>${escHtml(j.titleZh)}（${escHtml(cleanSpanZh)}）</h1>
        <div class="meta-pills">
          <span class="meta-pill"><strong>起讫：</strong>${escHtml(stops[0].ancientZh)} → ${escHtml(stops[stops.length - 1].ancientZh)}</span>
        </div>
        ${personSourceHtml}
        <div class="cta-row">
          <a class="cta-btn" href="${escHtml(buildMapHref(mapQuery, { lang, base: mapBase }))}">在交互地图播放「${escHtml(j.titleZh)}」→</a>
        </div>
${renderRelatedStrip(relatedLinks)}
      </article>

${renderEmbedMapSection({
  id: 'sec-map',
  iframeSrc: buildEmbedHref(`person=${encodeURIComponent(j.key)}`, { lang, base: mapBase }),
  titleZh: `${j.titleZh}交互式路线预览（${cleanSpanZh}）`,
  hintZh: '点击地图即可缩放查看各站 · 右上角可全屏播放动画',
})}

      <section id="sec-stops" class="section-card">
        <h2>逐站史事与古今地名录</h2>
${stopCardsHtml}
      </section>

${renderFooter(allDynasties, { showDynastyChips: true, lang, mapBase })}
    </main>
  </div>
</body>
</html>
`;

  return {
    filename: `${slug}.html`,
    html,
    meta: {
      slug,
      url: canonicalUrl,
      titleZh: `${j.titleZh}（${cleanSpanZh}）`,
      titleEn: `${j.titleEn} (${cleanSpanEn})`,
      descZh: dedupeConsecutive(stops.map((s) => s.ancientZh)).join(' → '),
      descEn: `${stops.length} stops: ${stops.map((s) => s.ancientEn).join(' → ')}`,
    },
  };
}

module.exports = { buildJourneyPage };
