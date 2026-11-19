'use strict';

const { BASE_URL, LASTMOD } = require('../config');
const { escHtml, fmtYearShortZh, formatSourceCitationsHtml } = require('../runtime');
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
  idx,
  allJourneys,
  allDynasties,
  sourcesBundle,
  relatedLinks,
  assetHashes,
}) {
  const slug = `journey-${j.key}`;
  const canonicalUrl = `${BASE_URL}/topics/${slug}.html`;
  const mapQuery = `?person=${encodeURIComponent(j.key)}`;
  const stops = j.stops || [];
  const stopsChainZh = stops.map((s) => `${s.ancientZh}（今${s.modernZh}）`).join(' → ');
  const stopsChainEn = stops.map((s) => `${s.ancientEn} (${s.modernEn})`).join(' → ');

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
      const stopMapHref = `../?person=${encodeURIComponent(j.key)}&stop=${sIdx}`;
      return `        <div class="stop-card">
          <div class="stop-header">
            <div>
              <span class="stop-badge">第 ${sIdx + 1} 站</span>
              <strong>${escHtml(s.ancientZh)}（今${escHtml(s.modernZh)}）· ${escHtml(s.titleZh)}</strong>
              <small class="stop-sub-en">${escHtml(s.ancientEn)} (${escHtml(s.modernEn)}) — ${escHtml(s.titleEn)}</small>
            </div>
            <div>
              <strong>${fmtYearShortZh(s.year)}年（${escHtml(s.eraZh)}）</strong> ·
              <a class="stop-map-link" href="${escHtml(stopMapHref)}">在地图定位此站 →</a>
            </div>
          </div>
          <p class="stop-desc-zh">${escHtml(s.descZh)}</p>
          <p class="en-sub stop-desc-en">${escHtml(s.descEn)}</p>
          ${
            s.quoteZh
              ? `<blockquote class="poem-box">${escHtml(s.quoteZh)}<cite>${escHtml(s.quoteEn || '')}</cite></blockquote>`
              : ''
          }${stopCiteHtml}
        </div>`;
    })
    .join('\n');

  const personSourceHtml = formatSourceCitationsHtml(`person:${j.key}`, sourcesBundle);

  const tocItems = [
    { id: 'sec-map', label: '行迹路线预览' },
    { id: 'sec-stops', label: `逐站详解（${stops.length} 站）` },
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
  })}
<body>
${renderTopHeader()}
  <div class="page-shell has-toc">
${renderTocSidebar(tocItems)}
    <main class="main-col">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="../">江山时序首页</a> &rsaquo;
        <a href="index.html">专题图志总览</a> &rsaquo;
        <span>${escHtml(j.titleZh)}</span>
      </nav>

      <article class="hero-card">
        <span class="kicker">点人溯事 · 历史人物生平行迹图志（第 ${idx + 1} / ${allJourneys.length} 篇）</span>
        <h1>${escHtml(j.titleZh)}（${escHtml(cleanSpanZh)}）</h1>
        <p class="en-sub">${escHtml(j.titleEn)} (${escHtml(cleanSpanEn)})</p>
        <div class="meta-pills">
          <span class="meta-pill"><strong>时代跨度：</strong>${escHtml(cleanSpanZh)}</span>
          <span class="meta-pill"><strong>途经站点：</strong>共 ${stops.length} 站</span>
          <span class="meta-pill"><strong>起点 → 终点：</strong>${escHtml(stops[0].ancientZh)} → ${escHtml(stops[stops.length - 1].ancientZh)}</span>
        </div>
        <p><strong>全线途经古今地名：</strong>${escHtml(stopsChainZh)}。</p>
        <p class="en-sub"><strong>Route Stops:</strong> ${escHtml(stopsChainEn)}.</p>
        ${personSourceHtml}
        <div class="cta-row">
          <a class="cta-btn" href="../${escHtml(mapQuery)}">播放「${escHtml(j.titleZh)}」全线交互动画 →</a>
          <a class="cta-btn secondary" href="../${escHtml(mapQuery)}&amp;lang=en">Play in English →</a>
          <a class="cta-btn secondary" href="index.html">返回图志总览</a>
        </div>
${renderRelatedStrip(relatedLinks)}
      </article>

${renderEmbedMapSection({
  id: 'sec-map',
  iframeSrc: `../?embed=1&person=${encodeURIComponent(j.key)}`,
  titleZh: `${j.titleZh}交互式历史舆图路线预览（${cleanSpanZh}）`,
  hintZh: '点击地图即可缩放查看各站 · 右上角可全屏播放动画',
})}

      <section id="sec-stops" class="section-card">
        <h2>${escHtml(j.titleZh)} · 逐站时空坐标、古今地名与史料诗词详解（${stops.length} 站）</h2>
${stopCardsHtml}
      </section>

${renderFooter(allDynasties)}
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
      descZh: `共${stops.length}站：${stops.map((s) => s.ancientZh).join(' → ')}`,
      descEn: `${stops.length} stops: ${stops.map((s) => s.ancientEn).join(' → ')}`,
    },
  };
}

module.exports = { buildJourneyPage };
