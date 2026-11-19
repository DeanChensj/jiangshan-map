'use strict';

const { BASE_URL, LASTMOD } = require('../config');
const {
  escHtml,
  fmtYearShortZh,
  fmtYearEn,
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

function buildStorylinePage({
  s,
  idx,
  allStories,
  allDynasties,
  sourcesBundle,
  relatedLinks,
  assetHashes,
}) {
  const slug = `story-${s.key}`;
  const canonicalUrl = `${BASE_URL}/topics/${slug}.html`;
  const mapQuery = `?event=${encodeURIComponent(s.key)}`;
  const stops = s.stops || [];
  const camps = s.camps || [];
  const spanZh =
    Array.isArray(s.span) && s.span.length === 2
      ? `${fmtYearShortZh(s.span[0])}—${fmtYearShortZh(s.span[1])}年`
      : '';
  const spanEn =
    Array.isArray(s.span) && s.span.length === 2
      ? `${fmtYearEn(s.span[0])} – ${fmtYearEn(s.span[1])}`
      : '';

  const stopsChainZh = stops.map((st) => `${st.ancientZh}（今${st.modernZh}）`).join(' → ');

  const pageTitle = `${s.zh}历史地图（${spanZh} · ${s.en}）· 双阵营对抗沙盘、${stops.length}站全过程与史料出处 | 江山时序`;
  const pageDesc = `${s.zh}（${s.en}，${s.courtesyZh}）：${s.descZh} 全程共 ${stops.length} 个关键时空节点（${stopsChainZh}），提供双阵营对抗沙盘、古今地名对照与一手史籍出处。`;

  const campMap = new Map(camps.map((c) => [c.key, c]));
  const campPillsHtml = camps
    .map(
      (c) =>
        `<span class="meta-pill"><span class="camp-badge" style="background:${escHtml(c.color || '#9e2a22')};">${escHtml(
          c.zh
        )}</span><small>${escHtml(c.en)}</small></span>`
    )
    .join('\n          ');

  const personSourceHtml = formatSourceCitationsHtml(`person:${s.key}`, sourcesBundle);

  let lastActZh = '';
  const actTocItems = [];
  const stopCardsHtml = stops
    .map((st, sIdx) => {
      let actHeaderHtml = '';
      if (st.actZh && st.actZh !== lastActZh) {
        lastActZh = st.actZh;
        const actId = `sec-act-${actTocItems.length + 1}`;
        actTocItems.push({ id: actId, label: st.actZh });
        actHeaderHtml = `        <div id="${actId}" class="act-heading">${escHtml(st.actZh)}${
          st.actEn ? ` <small>${escHtml(st.actEn)}</small>` : ''
        }</div>\n`;
      }
      const campObj = campMap.get(st.camp);
      const campBadgeHtml = campObj
        ? `<span class="camp-badge" style="background:${escHtml(campObj.color || '#9e2a22')};">${escHtml(campObj.zh)}</span>`
        : '';
      const stopMapHref = `../?event=${encodeURIComponent(s.key)}&stop=${sIdx}`;
      const actorsList =
        Array.isArray(st.actors) && st.actors.length
          ? `<div class="stop-meta-line"><strong>核心人物：</strong>${st.actors
              .map((a) => `${escHtml(a.zh)}（${escHtml(a.en)}）`)
              .join('、')}</div>`
          : '';
      const vectorParts = [];
      if (st.fromLabelZh) vectorParts.push(st.fromLabelZh);
      if (Array.isArray(st.prongs)) {
        for (const pr of st.prongs) {
          if (pr.fromLabelZh) vectorParts.push(pr.fromLabelZh);
        }
      }
      const vectorHtml = vectorParts.length
        ? `<div class="stop-meta-line"><strong>进军方向：</strong>自 ${escHtml(
            vectorParts.join(' / ')
          )} 推进至 ${escHtml(st.ancientZh)}</div>`
        : '';
      const timeLabelZh = `${fmtYearShortZh(st.year)}年${st.subEraZh ? ` · ${st.subEraZh}` : ''}`;

      return `${actHeaderHtml}        <div class="stop-card">
          <div class="stop-header">
            <div>
              <span class="stop-badge">第 ${sIdx + 1} 幕</span>${campBadgeHtml}
              <strong>${escHtml(st.ancientZh)}（今${escHtml(st.modernZh)}）· ${escHtml(st.titleZh)}</strong>
              <small class="stop-sub-en">${escHtml(st.ancientEn)} (${escHtml(st.modernEn)}) — ${escHtml(st.titleEn)}</small>
            </div>
            <div>
              <strong>${escHtml(timeLabelZh)}</strong> ·
              <a class="stop-map-link" href="${escHtml(stopMapHref)}">沙盘推演此站 →</a>
            </div>
          </div>
          ${actorsList}${vectorHtml}
          <p class="stop-desc-zh">${escHtml(st.descZh)}</p>
          <p class="en-sub stop-desc-en">${escHtml(st.descEn)}</p>
          ${
            st.quoteZh
              ? `<blockquote class="poem-box">${escHtml(st.quoteZh)}<cite>${escHtml(st.quoteEn || '')}</cite></blockquote>`
              : ''
          }
        </div>`;
    })
    .join('\n');

  const tocItems = [
    { id: 'sec-map', label: '沙盘地图预览' },
    { id: 'sec-stops', label: `全程节点（${stops.length} 幕）` },
    ...actTocItems,
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
          { '@type': 'ListItem', position: 3, name: `${s.zh}历史地图`, item: canonicalUrl },
        ],
      },
    ],
  };

  const keywords = [
    `${s.zh}历史地图`,
    `${s.zh}路线图`,
    `${s.zh}全过程地图`,
    ...(s.aliases || []),
    ...stops.map((st) => st.ancientZh),
    '事件始末沙盘',
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
        <span>${escHtml(s.zh)}（${escHtml(spanZh)}）</span>
      </nav>

      <article class="hero-card">
        <span class="kicker">事件始末 · 双阵营对抗历史沙盘图志（第 ${idx + 1} / ${allStories.length} 篇）</span>
        <h1>${escHtml(s.zh)}（${escHtml(spanZh)}）</h1>
        <p class="en-sub">${escHtml(s.en)} (${escHtml(s.courtesyEn)})</p>
        <div class="meta-pills">
          <span class="meta-pill"><strong>格局提要：</strong>${escHtml(s.courtesyZh)}</span>
          <span class="meta-pill"><strong>推演节点：</strong>共 ${stops.length} 站</span>
          ${campPillsHtml}
        </div>
        <p>${escHtml(s.descZh)}</p>
        <p class="en-sub">${escHtml(s.descEn)}</p>
        <p><strong>全线关键节点：</strong>${escHtml(stopsChainZh)}。</p>
        ${personSourceHtml}
        <div class="cta-row">
          <a class="cta-btn" href="../${escHtml(mapQuery)}">在交互地图中推演「${escHtml(s.zh)}」沙盘 →</a>
          <a class="cta-btn secondary" href="../${escHtml(mapQuery)}&amp;lang=en">Open in English →</a>
          <a class="cta-btn secondary" href="index.html">返回图志总览</a>
        </div>
${renderRelatedStrip(relatedLinks)}
      </article>

${renderEmbedMapSection({
  id: 'sec-map',
  iframeSrc: `../?embed=1&event=${encodeURIComponent(s.key)}`,
  titleZh: `${s.zh}双阵营对抗历史沙盘实时预览（${spanZh}）`,
  hintZh: '点击地图即可交互推演 · 右上角可全屏打开沙盘',
})}

      <section id="sec-stops" class="section-card">
        <h2>${escHtml(s.zh)} · 全程 ${stops.length} 幕时空推演、古今地名与史料引文详解</h2>
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
      key: s.key,
      url: canonicalUrl,
      titleZh: `${s.zh}历史地图（${spanZh}）`,
      titleEn: `${s.en} (${spanEn})`,
      descZh: `${s.courtesyZh} · 双阵营${stops.length}站沙盘：${stops.map((st) => st.ancientZh).join(' → ')}`,
      descEn: `${s.courtesyEn} · ${stops.length}-stop sandtable: ${stops.map((st) => st.ancientEn).join(' → ')}`,
    },
  };
}

module.exports = { buildStorylinePage };
