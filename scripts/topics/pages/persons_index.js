'use strict';

const { BASE_URL } = require('../config');
const { escHtml, fmtYearShortZh, dedupeConsecutive, buildMapHref } = require('../runtime');
const {
  renderSharedHead,
  renderTopHeader,
  renderTocSidebar,
  renderTableFilterBar,
  renderFilterPresetChips,
  renderFooter,
} = require('../layout');

function buildPersonsIndexPage({
  journeys,
  personMonographItems,
  directoryOnlyPersons,
  allDynasties,
  assetHashes,
  lang = 'zh',
  mapBase = '../',
}) {
  const canonicalUrl = `${BASE_URL}/topics/persons.html`;
  const dynTitleMap = new Map(allDynasties.map((d) => [d.key, d.title]));

  const curatedItems = [
    ...journeys.map((j) => {
      const stops = j.stops || [];
      const cleanSpanZh = j.spanZh.replace(/[（）()]/g, ' ').trim();
      const uniqueStops = dedupeConsecutive(stops.map((s) => s.ancientZh));
      const sitesPreview = uniqueStops.slice(0, 5).join(' → ');
      return {
        badge: '精修行迹',
        badgeClass: 'is-curated',
        zh: j.titleZh,
        en: j.titleEn,
        spanZh: cleanSpanZh,
        routeZh: `${sitesPreview}${uniqueStops.length > 5 ? ' …' : ''}`,
        topicHref: `journey-${j.key}.html`,
      };
    }),
    ...personMonographItems
      .filter((x) => x.profile.isRelic)
      .map((x) => {
        const { profile, meta } = x;
        return {
          badge: '国器流转',
          badgeClass: 'is-relic',
          zh: profile.zh,
          en: profile.en,
          spanZh: meta.spanZh,
          routeZh: '和氏璧 → 秦制传国玺 → 后唐洛阳失传',
          topicHref: `${meta.slug}.html`,
        };
      }),
  ];

  const standardMonographs = personMonographItems.filter((x) => !x.profile.isRelic);
  const totalDirectoryCount =
    journeys.length + personMonographItems.length + directoryOnlyPersons.length;

  const curatedRowsHtml = curatedItems
    .map(
      (item) => `            <tr data-search="${escHtml(item.en)}">
              <td><a href="${escHtml(item.topicHref)}"><strong>${escHtml(item.zh)}</strong></a><span class="person-type-badge ${item.badgeClass}">${escHtml(item.badge)}</span><br/><small>${escHtml(item.spanZh)}</small></td>
              <td>${escHtml(item.routeZh)}</td>
            </tr>`
    )
    .join('\n');

  const monographRowsHtml = standardMonographs
    .map(({ profile, meta }) => {
      const searchExtras = [profile.en, ...(profile.aliases || [])].filter(Boolean).join(' ');
      return `            <tr data-search="${escHtml(searchExtras)}">
              <td><a href="${escHtml(meta.slug)}.html"><strong>${escHtml(profile.zh)}</strong></a><br/><small>${escHtml(meta.dynastyTitle)}（${escHtml(meta.spanZh)}）${profile.courtesyZh ? ` · ${escHtml(profile.courtesyZh)}` : ''}</small></td>
              <td>${escHtml(meta.descZh.replace(/^[^：]+：/, ''))}</td>
            </tr>`;
    })
    .join('\n');

  const directoryRowsHtml = directoryOnlyPersons
    .map(({ profile }) => {
      const dynTitle = dynTitleMap.get(profile.dynastyKey) || profile.dynastyKey;
      const span = Array.isArray(profile.span) ? profile.span : [0, 0];
      const spanZh = `${fmtYearShortZh(span[0])}—${fmtYearShortZh(span[1])}`;
      const mapHref = buildMapHref(`?person=${encodeURIComponent(profile.key)}`, { lang, base: mapBase });
      const aliasList = Array.isArray(profile.aliases) && profile.aliases.length
        ? ` · 别名：${profile.aliases.slice(0, 3).join('、')}`
        : '';
      const searchExtras = [profile.en, ...(profile.aliases || [])].filter(Boolean).join(' ');
      return `            <tr data-search="${escHtml(searchExtras)}">
              <td><a href="${escHtml(mapHref)}"><strong>${escHtml(profile.zh)}</strong></a>${profile.courtesyZh ? `<br/><small>${escHtml(profile.courtesyZh)}</small>` : ''}</td>
              <td><strong>${escHtml(dynTitle)}</strong>（${escHtml(spanZh)}）${escHtml(aliasList)}</td>
            </tr>`;
    })
    .join('\n');

  const presetOptions = [
    { label: '全部', value: '' },
    { label: '战国', value: '战国' },
    { label: '秦', value: '秦' },
    { label: '西汉', value: '西汉' },
    { label: '东汉', value: '东汉' },
    { label: '三国', value: '三国' },
    { label: '晋', value: '晋' },
    { label: '南北朝', value: '南北朝' },
    { label: '隋', value: '隋' },
    { label: '唐', value: '唐' },
    { label: '五代', value: '五代十国' },
    { label: '宋', value: '宋' },
    { label: '元', value: '元' },
    { label: '明', value: '明' },
    { label: '清', value: '清' },
    { label: '民国/现代', value: '中华' },
  ];

  const tocItems = [
    { id: 'sec-curated', label: '一、精修行迹与国器' },
    { id: 'sec-monographs', label: '二、核心人物独立志' },
    { id: 'sec-directory', label: '三、其余编年人物' },
  ];

  const pageTitle = `历代人物志与国器流转总录（收录 ${totalDirectoryCount} 位历史人物） | 江山时序`;
  const pageDesc = `江山时序点人溯事历史人物志总录：汇总 ${curatedItems.length} 篇精修行迹与国器流转、${standardMonographs.length} 篇核心历史人物独立时空图志，以及其余 ${directoryOnlyPersons.length} 位编年历史人物轨迹直达索引（共 ${totalDirectoryCount} 位）。`;

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
      '中国历史人物地图',
      '历代人物志',
      '点人溯事',
      '历史人物生平轨迹',
      '双人同看',
      '传国玉玺流转',
      '江山时序',
    ],
    canonicalUrl,
    jsonLdObj: jsonLd,
    assetHashes,
    lang,
  })}
<body>
${renderTopHeader({ activeNav: 'persons', lang, mapBase })}
  <div class="page-shell has-toc">
${renderTocSidebar(tocItems)}
    <main class="main-col">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="${escHtml(buildMapHref('', { lang, base: mapBase }))}">江山时序首页</a> &rsaquo;
        <a href="index.html">专题图志总览</a> &rsaquo;
        <span>历代人物志</span>
      </nav>

      <article class="hero-card">
        <span class="kicker">点人溯事 · 历代人物志</span>
        <h1>历代人物生平轨迹与国器流转志</h1>
        <p>收录历代精修行迹、传世国器与编年历史人物轨迹，点击人物可进入图文图志或定位交互舆图。</p>
        <div class="cta-row">
          <a class="cta-btn" href="${escHtml(buildMapHref('', { lang, base: mapBase }))}">进入主地图体验「点人溯事」→</a>
        </div>
      </article>

      <section id="sec-curated" class="section-card">
        <h2>一、精修行迹与国器流转</h2>
        <div class="table-wrap">
          <table id="tbl-curated-persons" class="data-table">
            <thead>
              <tr>
                <th>专题</th>
                <th>代表站点</th>
              </tr>
            </thead>
            <tbody>
${curatedRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-monographs" class="section-card">
        <h2>二、核心人物独立志</h2>
${renderFilterPresetChips('tbl-person-monographs', presetOptions)}
${renderTableFilterBar('tbl-person-monographs', '按姓名、字号、朝代或足迹检索…', standardMonographs.length, { force: true })}
        <div class="table-wrap">
          <table id="tbl-person-monographs" class="data-table">
            <thead>
              <tr>
                <th>人物</th>
                <th>主要足迹</th>
              </tr>
            </thead>
            <tbody>
${monographRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-directory" class="section-card">
        <h2>三、其余编年人物</h2>
${renderTableFilterBar('tbl-person-directory', '按姓名、字号或朝代检索…', directoryOnlyPersons.length, { force: true })}
        <div class="table-wrap">
          <table id="tbl-person-directory" class="data-table">
            <thead>
              <tr>
                <th>人物</th>
                <th>所属朝代与别称</th>
              </tr>
            </thead>
            <tbody>
${directoryRowsHtml}
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
    filename: 'persons.html',
    html,
  };
}

module.exports = { buildPersonsIndexPage };
