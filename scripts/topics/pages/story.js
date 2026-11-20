'use strict';

const { BASE_URL, LASTMOD } = require('../config');
const {
  escHtml,
  fmtYearShortZh,
  fmtYearEn,
  buildMapHref,
  buildEmbedHref,
  formatSourceCitationsHtml,
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

function buildStorylinePage({
  s,
  allDynasties,
  sourcesBundle,
  relatedLinks,
  assetHashes,
  lang = 'zh',
  mapBase = '../',
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
        `<span class="camp-badge" style="background:${escHtml(c.color || '#9e2a22')};">${escHtml(
          c.zh
        )}</span>`
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
        actHeaderHtml = `        <div id="${actId}" class="act-heading">${escHtml(st.actZh)}</div>\n`;
      }
      const campObj = campMap.get(st.camp);
      const campBadgeHtml = campObj
        ? `<span class="camp-badge" style="background:${escHtml(campObj.color || '#9e2a22')};">${escHtml(campObj.zh)}</span>`
        : '';
      const stopMapHref = buildMapHref(`?event=${encodeURIComponent(s.key)}&stop=${sIdx}`, {
        lang,
        base: mapBase,
      });
      const actorsList =
        Array.isArray(st.actors) && st.actors.length
          ? `<div class="stop-meta-line"><strong>核心人物：</strong>${st.actors
              .map((a) => escHtml(a.zh))
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
              ${campBadgeHtml}
              <strong>${escHtml(st.ancientZh)}（今${escHtml(st.modernZh)}）· ${escHtml(st.titleZh)}</strong>
            </div>
            <div>
              <a class="stop-map-link" href="${escHtml(stopMapHref)}" title="在交互沙盘中定位此节点">${escHtml(timeLabelZh)} ↗</a>
            </div>
          </div>
          ${actorsList}${vectorHtml}
          <p class="stop-desc-zh">${escHtml(st.descZh)}</p>
          ${
            st.quoteZh
              ? `<blockquote class="poem-box">${escHtml(st.quoteZh)}</blockquote>`
              : ''
          }
        </div>`;
    })
    .join('\n');

  const tocItems = [
    { id: 'sec-map', label: '沙盘地图预览' },
    { id: 'sec-stops', label: '全程节点' },
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
        <span>${escHtml(s.zh)}（${escHtml(spanZh)}）</span>
      </nav>

      <article class="hero-card">
        <h1>${escHtml(s.zh)}（${escHtml(spanZh)}）</h1>
        <div class="meta-pills">
          ${campPillsHtml}
        </div>
        <p>${escHtml(s.descZh)}</p>
        ${personSourceHtml}
${renderRelatedStrip(relatedLinks)}
      </article>

${renderEmbedMapSection({
  id: 'sec-map',
  iframeSrc: buildEmbedHref(`event=${encodeURIComponent(s.key)}`, { lang, base: mapBase }),
  fullHref: buildMapHref(mapQuery, { lang, base: mapBase }),
  titleZh: `${s.zh}沙盘实时预览（${spanZh}）`,
  labelZh: '对抗沙盘',
})}

      <section id="sec-stops" class="section-card">
        <h2>${escHtml(s.zh)} · 始末节点详解</h2>
${stopCardsHtml}
      </section>

${renderFooter(allDynasties, { showDynastyChips: false, lang, mapBase })}
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
      descZh: `${s.courtesyZh} · ${stops.map((st) => st.ancientZh).join(' → ')}`,
      descEn: `${s.courtesyEn} · ${stops.length}-stop sandtable: ${stops.map((st) => st.ancientEn).join(' → ')}`,
    },
  };
}

module.exports = { buildStorylinePage };
