'use strict';

const { BASE_URL } = require('../config');
const { escHtml, fmtPersonSpanZh, dedupeConsecutive, buildMapHref } = require('../runtime');
const {
  renderSharedHead,
  renderTopHeader,
  renderTableFilterBar,
  renderFilterPresetChips,
  renderFooter,
} = require('../layout');

function buildPersonsIndexPage({
  journeys,
  personProfileByKey = new Map(),
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
      const prof = personProfileByKey.get(j.key);
      const dynTitle = prof && prof.dynastyKey ? dynTitleMap.get(prof.dynastyKey) || '' : '';
      const searchExtras = [
        j.titleEn,
        dynTitle,
        (prof && prof.en) || '',
        ...((prof && prof.aliases) || []),
      ]
        .filter(Boolean)
        .join(' ');
      return {
        badge: '精修行迹',
        badgeClass: 'is-curated',
        zh: j.titleZh,
        searchExtras,
        spanZh: cleanSpanZh,
        routeZh: `${sitesPreview}${uniqueStops.length > 5 ? ' …' : ''}`,
        topicHref: `journey-${j.key}.html`,
      };
    }),
    ...personMonographItems
      .filter((x) => x.profile.isRelic)
      .map((x) => {
        const { profile, meta } = x;
        const searchExtras = [profile.en, ...(profile.aliases || []), meta.dynastyTitle]
          .filter(Boolean)
          .join(' ');
        return {
          badge: '国器流转',
          badgeClass: 'is-relic',
          zh: profile.zh,
          searchExtras,
          spanZh: `${meta.dynastyTitle}（${meta.spanZh}）`,
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
      (item) => `            <tr data-search="${escHtml(item.searchExtras)}">
              <td><a href="${escHtml(item.topicHref)}"><strong>${escHtml(item.zh)}</strong></a><span class="person-type-badge ${item.badgeClass}">${escHtml(item.badge)}</span><br/><small>${escHtml(item.spanZh)}</small></td>
              <td>${escHtml(item.routeZh)}</td>
            </tr>`
    )
    .join('\n');

  const monographRowsHtml = standardMonographs
    .map(({ profile, meta }) => {
      const searchExtras = [profile.en, ...(profile.aliases || [])].filter(Boolean).join(' ');
      return `            <tr data-search="${escHtml(searchExtras)}">
              <td><a href="${escHtml(meta.slug)}.html"><strong>${escHtml(profile.zh)}</strong></a><span class="person-type-badge is-monograph">人物志</span><br/><small>${escHtml(meta.dynastyTitle)}（${escHtml(meta.spanZh)}）${profile.courtesyZh ? ` · ${escHtml(profile.courtesyZh)}` : ''}</small></td>
              <td>${escHtml(meta.descZh.replace(/^[^：]+：/, ''))}</td>
            </tr>`;
    })
    .join('\n');

  const directoryRowsHtml = directoryOnlyPersons
    .map(({ profile, sampleSitesZh }) => {
      const dynTitle = dynTitleMap.get(profile.dynastyKey) || profile.dynastyKey;
      const spanZh = fmtPersonSpanZh(profile);
      const mapHref = buildMapHref(`?person=${encodeURIComponent(profile.key)}`, { lang, base: mapBase });
      const aliasList = Array.isArray(profile.aliases) && profile.aliases.length
        ? profile.aliases.slice(0, 3).join('、')
        : '';
      const sitesText = sampleSitesZh || aliasList || '';
      const searchExtras = [profile.en, ...(profile.aliases || [])].filter(Boolean).join(' ');
      return `            <tr data-search="${escHtml(searchExtras)}">
              <td><a href="${escHtml(mapHref)}"><strong>${escHtml(profile.zh)}</strong></a><br/><small>${escHtml(dynTitle)}（${escHtml(spanZh)}）${profile.courtesyZh ? ` · ${escHtml(profile.courtesyZh)}` : ''}</small></td>
              <td>${escHtml(sitesText)}</td>
            </tr>`;
    })
    .join('\n');

  const presetOptions = [
    { label: '全部', value: '' },
    { label: '精修行迹', value: '精修行迹' },
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
  <div class="page-shell">
    <main class="main-col">
      <article class="hero-card">
        <h1>历代人物生平轨迹与国器流转志</h1>
        <p>收录历代精修行迹、传世国器与编年历史人物轨迹；标有「精修行迹」「人物志」的可查阅图文图志，其余人物直达交互舆图定位。</p>
      </article>

      <section id="sec-persons" class="section-card">
        <h2>历代人物与行迹目录</h2>
${renderFilterPresetChips('tbl-persons', presetOptions)}
${renderTableFilterBar('tbl-persons', '按姓名、字号、朝代或足迹检索…', totalDirectoryCount)}
        <div class="table-wrap">
          <table id="tbl-persons" class="data-table">
            <thead>
              <tr>
                <th>人物</th>
                <th>代表足迹</th>
              </tr>
            </thead>
            <tbody>
${curatedRowsHtml}
${monographRowsHtml}
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
