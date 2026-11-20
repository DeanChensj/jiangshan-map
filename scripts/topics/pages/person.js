'use strict';

const { BASE_URL, LASTMOD, isStandalonePersonMonograph } = require('../config');
const {
  escHtml,
  fmtYearShortZh,
  fmtPersonSpanZh,
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

function resolveEventSourceHtml(profile, ev, yearSeen, loreData, sourcesBundle) {
  if (!sourcesBundle || !sourcesBundle.refs) return '';
  if (profile.isRelic) {
    const cnt = (yearSeen.get(ev.year) || 0) + 1;
    yearSeen.set(ev.year, cnt);
    const suf = cnt > 1 ? `${ev.year}-${cnt}` : `${ev.year}`;
    return formatSourceCitationsHtml(`journey:${profile.key}:${suf}`, sourcesBundle);
  }
  if (ev.src === 'M' && ev.dynasty) {
    return formatSourceCitationsHtml(`milestone:${ev.dynasty.key}:${ev.year}`, sourcesBundle);
  }
  if (ev.src === 'L') {
    const landmarks = (loreData && loreData.PLACE_LANDMARK_EVENTS) || [];
    const hit = landmarks.find(
      (lm) =>
        lm.year === ev.year &&
        (!ev.dynasty || lm.dynastyKey === ev.dynasty.key) &&
        (lm.zh === ev.textZh ||
          (ev.coord &&
            lm.coord &&
            Math.hypot(lm.coord[0] - ev.coord[0], lm.coord[1] - ev.coord[1]) < 0.08))
    );
    if (hit) {
      return formatSourceCitationsHtml(`event:${hit.id}`, sourcesBundle);
    }
  }
  return '';
}

function formatPersonSpan(profile) {
  const span = Array.isArray(profile.span) ? profile.span : [0, 0];
  const u = profile.spanUnknown || '';
  return {
    spanZh: fmtPersonSpanZh(profile),
    spanEn: `${u === 'birth' || u === 'both' ? '?' : fmtYearEn(span[0])} – ${u === 'death' || u === 'both' ? '?' : fmtYearEn(span[1])}`,
  };
}

function buildPersonPage({
  profile,
  events,
  allDynasties,
  ctrl,
  enLocale,
  loreData,
  sourcesBundle,
  peers,
  relatedLinks,
  assetHashes,
  lang = 'zh',
  mapBase = '../',
}) {
  const slug = `person-${profile.key}`;
  const canonicalUrl = `${BASE_URL}/topics/${slug}.html`;
  const mapQuery = `?person=${encodeURIComponent(profile.key)}`;
  const { spanZh, spanEn } = formatPersonSpan(profile);

  const primaryDyn = allDynasties.find((d) => d.key === profile.dynastyKey) || allDynasties[0];
  const primaryDynEn =
    (enLocale && enLocale.dynasties && enLocale.dynasties[primaryDyn.key] && enLocale.dynasties[primaryDyn.key].name) ||
    primaryDyn.title;

  const isRelic = Boolean(profile.isRelic);
  const nodeWordZh = isRelic ? '站' : '处';

  const uniqueSites = [];
  for (const ev of events) {
    if (ev.siteZh && !uniqueSites.includes(ev.siteZh)) uniqueSites.push(ev.siteZh);
  }
  const sampleSitesZh = uniqueSites.slice(0, 6).join('、') || primaryDyn.seat;

  const pageTitle = isRelic
    ? `${profile.zh}流传图志（${spanZh}）· ${events.length}站时空流转与史料考据 | 江山时序`
    : `${profile.zh}历史人物地图（${spanZh}）· ${events.length}处生平节点与古今地名对照 | 江山时序`;
  const introTextZh = profile.descZh || profile.courtesyZh || `${primaryDyn.title}代表历史人物`;
  const pageDesc = `${profile.zh}（${profile.en}，${spanZh} · ${introTextZh.replace(/[。！？…；.!?;]+$/, '')}）。收录 ${events.length} 处关联时空节点（${sampleSitesZh}等），提供交互式轨迹地图、逐条历史纪年、古今地名与正史出处。`;

  const yearSeen = new Map();
  const stopCardsHtml = events
    .map((ev, eIdx) => {
      const dynTitle = (ev.dynasty && ev.dynasty.title) || primaryDyn.title;
      const eraZh =
        ev.subEraZh ||
        (ev.dynasty ? ctrl.formatEraLabel(ev.year, ev.dynasty, ev.coord) : dynTitle);
      const siteDisplayZh = ev.modernZh ? `${ev.siteZh}（今${ev.modernZh}）` : ev.siteZh;
      const evMapHref = buildMapHref(`?person=${encodeURIComponent(profile.key)}&stop=${eIdx}`, {
        lang,
        base: mapBase,
      });
      const srcCiteHtml = resolveEventSourceHtml(profile, ev, yearSeen, loreData, sourcesBundle);
      const quoteBlock = ev.quoteZh
        ? `\n          <blockquote class="poem-box">${escHtml(ev.quoteZh)}</blockquote>`
        : '';

      return `        <div class="stop-card">
          <div class="stop-header">
            <div>
              <strong>${escHtml(siteDisplayZh)}</strong>
            </div>
            <div>
              <a class="stop-map-link" href="${escHtml(evMapHref)}" title="在交互地图中定位此节点">${fmtYearShortZh(ev.year)}年 · ${escHtml(eraZh)} ↗</a>
            </div>
          </div>
          <p class="stop-desc-zh">${escHtml(ev.textZh)}</p>${quoteBlock}${
            srcCiteHtml ? `\n          ${srcCiteHtml}` : ''
          }
        </div>`;
    })
    .join('\n');

  const peerList = Array.isArray(peers) ? peers : [];
  const peersSectionHtml = peerList.length
    ? `\n      <section id="sec-peers" class="section-card">
        <h2>二、同代人物交汇</h2>
        <div class="person-peer-grid">
${peerList
  .map((peer) => {
    const peerPageHref = peer.journeyKey
      ? `journey-${peer.journeyKey}.html`
      : isStandalonePersonMonograph(peer)
        ? `person-${peer.key}.html`
        : buildMapHref(`?person=${encodeURIComponent(peer.key)}`, { lang, base: mapBase });
    const peerPageLabel = peer.journeyKey
      ? '行迹图志 →'
      : isStandalonePersonMonograph(peer)
        ? '人物图志 →'
        : '单人轨迹 →';
    const dualHref = buildMapHref(
      `?person=${encodeURIComponent(profile.key)},${encodeURIComponent(peer.key)}`,
      { lang, base: mapBase }
    );
    const peerSpan = Array.isArray(peer.span) ? fmtPersonSpanZh(peer) : '';
    return `          <div class="person-peer-card">
            <div>
              <div class="person-peer-head">
                <span class="person-peer-name">${escHtml(peer.zh)}</span>
                <span class="person-peer-shared">交汇 ${peer.sharedCount} 处</span>
              </div>
              <div class="person-peer-sub">${escHtml(peerSpan)}${peer.courtesyZh ? ` · ${escHtml(peer.courtesyZh)}` : ''}</div>
            </div>
            <div class="person-peer-actions">
              <a href="${escHtml(dualHref)}">双人同看 →</a>
              <a href="${escHtml(peerPageHref)}">${peerPageLabel}</a>
            </div>
          </div>`;
  })
  .join('\n')}
        </div>
      </section>`
    : '';

  const tocItems = [
    { id: 'sec-map', label: isRelic ? '流转舆图预览' : '轨迹舆图预览' },
    { id: 'sec-events', label: `一、${isRelic ? '流转节点' : '生平节点'}` },
  ];
  if (peerList.length) {
    tocItems.push({ id: 'sec-peers', label: '二、同代人物交汇' });
  }

  const personSourceHtml = formatSourceCitationsHtml(`person:${profile.key}`, sourcesBundle);

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
          { '@type': 'ListItem', position: 3, name: '历代人物志', item: `${BASE_URL}/topics/persons.html` },
          { '@type': 'ListItem', position: 4, name: profile.zh, item: canonicalUrl },
        ],
      },
    ],
  };

  const keywords = [
    profile.zh,
    `${profile.zh}生平地图`,
    `${profile.zh}活动地点`,
    profile.en,
    ...(profile.aliases || []).slice(0, 4),
    ...uniqueSites.slice(0, 5),
    primaryDyn.title,
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
${renderTopHeader({ activeNav: 'persons', lang, mapBase })}
  <div class="page-shell${hasTocSidebar(tocItems) ? ' has-toc' : ''}">
${renderTocSidebar(tocItems)}
    <main class="main-col">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="${escHtml(buildMapHref('', { lang, base: mapBase }))}">江山时序首页</a> &rsaquo;
        <a href="index.html">专题图志总览</a> &rsaquo;
        <a href="persons.html">历代人物志</a> &rsaquo;
        <span>${escHtml(profile.zh)}</span>
      </nav>

      <article class="hero-card">
        <h1>${escHtml(profile.zh)}（${escHtml(spanZh)}）</h1>
        <p class="hero-subtitle"><strong>${escHtml(primaryDyn.title)}</strong>${profile.courtesyZh ? ` · ${escHtml(profile.courtesyZh)}` : ''}</p>${
          profile.descZh ? `\n        <p>${escHtml(profile.descZh)}</p>` : ''
        }${
          personSourceHtml ? `\n        ${personSourceHtml}` : ''
        }
${renderRelatedStrip(relatedLinks)}
      </article>

${renderEmbedMapSection({
  id: 'sec-map',
  iframeSrc: buildEmbedHref(`person=${encodeURIComponent(profile.key)}`, { lang, base: mapBase }),
  fullHref: buildMapHref(mapQuery, { lang, base: mapBase }),
  titleZh: `${profile.zh}交互式轨迹预览（${spanZh}）`,
  labelZh: isRelic ? '流转舆图' : '轨迹舆图',
})}

      <section id="sec-events" class="section-card">
        <h2>一、「${escHtml(profile.zh)}」${isRelic ? '历代流转节点' : '生平代表史事'}</h2>
${stopCardsHtml}
      </section>${peersSectionHtml}

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
      key: profile.key,
      zh: profile.zh,
      en: profile.en,
      dynastyKey: primaryDyn.key,
      dynastyTitle: primaryDyn.title,
      spanZh,
      spanEn,
      courtesyZh: profile.courtesyZh || '',
      eventCount: events.length,
      isRelic,
      url: canonicalUrl,
      titleZh: `${profile.zh}（${spanZh}）`,
      titleEn: `${profile.en} (${spanEn})`,
      descZh: `${primaryDyn.title} · 共${events.length}${nodeWordZh}节点：${uniqueSites.slice(0, 5).join('、')}`,
      descEn: `${primaryDynEn} · ${events.length} events across ${uniqueSites.slice(0, 4).join(', ')}`,
    },
  };
}

module.exports = { buildPersonPage };
