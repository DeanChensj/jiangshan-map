'use strict';

const { BASE_URL } = require('../config');
const { escHtml, fmtYearShortZh, fmtYearEn } = require('../runtime');
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
}) {
  const canonicalUrl = `${BASE_URL}/topics/persons.html`;
  const dynTitleMap = new Map(allDynasties.map((d) => [d.key, d.title]));

  const curatedItems = [
    ...journeys.map((j) => {
      const stops = j.stops || [];
      const cleanSpanZh = j.spanZh.replace(/[（）()]/g, ' ').trim();
      const sitesPreview = stops
        .slice(0, 5)
        .map((s) => s.ancientZh)
        .join(' → ');
      return {
        badge: '精修行迹',
        badgeClass: 'is-curated',
        zh: j.titleZh,
        en: j.titleEn,
        subZh: `${cleanSpanZh} · 全线 ${stops.length} 站`,
        routeZh: `${sitesPreview}${stops.length > 5 ? ' …' : ''}`,
        topicHref: `journey-${j.key}.html`,
        mapHref: `../?person=${encodeURIComponent(j.key)}`,
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
          subZh: `${meta.spanZh} · ${profile.courtesyZh || ''}`,
          routeZh: `历 13 站千年传序（战国和氏璧 → 秦制传国玺 → 936年洛阳失传）`,
          topicHref: `${meta.slug}.html`,
          mapHref: `../?person=${encodeURIComponent(profile.key)}`,
        };
      }),
  ];

  const standardMonographs = personMonographItems.filter((x) => !x.profile.isRelic);
  const totalDirectoryCount =
    journeys.length + personMonographItems.length + directoryOnlyPersons.length;

  const curatedRowsHtml = curatedItems
    .map(
      (item) => `            <tr>
              <td><a href="${escHtml(item.topicHref)}"><strong>${escHtml(item.zh)}</strong></a><span class="person-type-badge ${item.badgeClass}">${escHtml(item.badge)}</span><br/><small>${escHtml(item.en)}</small></td>
              <td>${escHtml(item.subZh)}</td>
              <td>${escHtml(item.routeZh)}</td>
              <td><a href="${escHtml(item.topicHref)}">查阅图志 →</a><br/><small><a href="${escHtml(item.mapHref)}">主图动画</a></small></td>
            </tr>`
    )
    .join('\n');

  const monographRowsHtml = standardMonographs
    .map(({ profile, meta }) => {
      const mapHref = `../?person=${encodeURIComponent(profile.key)}`;
      return `            <tr>
              <td><a href="${escHtml(meta.slug)}.html"><strong>${escHtml(profile.zh)}</strong></a><br/><small>${escHtml(profile.en)}${profile.courtesyZh ? ` · ${escHtml(profile.courtesyZh)}` : ''}</small></td>
              <td><strong>${escHtml(meta.dynastyTitle)}</strong><br/><small>${escHtml(meta.spanZh)}</small></td>
              <td>收录 <strong>${meta.eventCount}</strong> 处节点 · 主要足迹：${escHtml(meta.descZh.replace(/^[^：]+：/, ''))}</td>
              <td><a href="${escHtml(meta.slug)}.html">查阅人物志 →</a><br/><small><a href="${escHtml(mapHref)}">主图定位</a></small></td>
            </tr>`;
    })
    .join('\n');

  const directoryRowsHtml = directoryOnlyPersons
    .map(({ profile, eventCount }) => {
      const dynTitle = dynTitleMap.get(profile.dynastyKey) || profile.dynastyKey;
      const span = Array.isArray(profile.span) ? profile.span : [0, 0];
      const spanZh = `${fmtYearShortZh(span[0])}—${fmtYearShortZh(span[1])}`;
      const mapHref = `../?person=${encodeURIComponent(profile.key)}`;
      const aliasList = Array.isArray(profile.aliases) && profile.aliases.length
        ? ` · 别名：${profile.aliases.slice(0, 3).join('、')}`
        : '';
      return `            <tr>
              <td><a href="${escHtml(mapHref)}"><strong>${escHtml(profile.zh)}</strong></a><br/><small>${escHtml(profile.en)}${profile.courtesyZh ? ` · ${escHtml(profile.courtesyZh)}` : ''}</small></td>
              <td><strong>${escHtml(dynTitle)}</strong><br/><small>${escHtml(spanZh)}（${escHtml(fmtYearEn(span[0]))} – ${escHtml(fmtYearEn(span[1]))}）</small></td>
              <td>关联 <strong>${eventCount}</strong> 处编年地标事件${escHtml(aliasList)}</td>
              <td><a href="${escHtml(mapHref)}">打开人物轨迹 →</a></td>
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
    { id: 'sec-curated', label: `一、精修行迹与国器（${curatedItems.length}）` },
    { id: 'sec-monographs', label: `二、核心人物独立志（${standardMonographs.length}）` },
    { id: 'sec-directory', label: `三、其余编年人物（${directoryOnlyPersons.length}）` },
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
  })}
<body>
${renderTopHeader({ activeNav: 'persons' })}
  <div class="page-shell has-toc">
${renderTocSidebar(tocItems)}
    <main class="main-col">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="../">江山时序首页</a> &rsaquo;
        <a href="index.html">专题图志总览</a> &rsaquo;
        <span>历代人物志</span>
      </nav>

      <article class="hero-card">
        <span class="kicker">点人溯事 · 历代人物志总录（共收录 ${totalDirectoryCount} 位历史人物与国器）</span>
        <h1>中国历代历史人物生平轨迹与国器流转图志</h1>
        <p class="en-sub">Biographical Chronicles, Curated Journeys &amp; Temporal Spatial Profiles (403 BCE – Present · ${totalDirectoryCount} Figures)</p>
        <div class="meta-pills">
          <span class="meta-pill"><strong>精修行迹与国器：</strong>${curatedItems.length} 篇</span>
          <span class="meta-pill"><strong>核心人物独立志：</strong>${standardMonographs.length} 篇</span>
          <span class="meta-pill"><strong>全库人物索引：</strong>${totalDirectoryCount} 位</span>
        </div>
        <p>收录「江山时序」人物传记体系全部历史人物：高密度核心人物与传国玉玺均建有独立时空图志，附带逐事正史出处、同代人物交汇与主图双人同看链接；其余编年人物亦可一键定位至交互历史舆图。</p>
        <div class="cta-row">
          <a class="cta-btn" href="../">进入主地图体验「点人溯事」与双人同看 →</a>
          <a class="cta-btn secondary" href="index.html">返回专题图志总览</a>
        </div>
      </article>

      <section id="sec-curated" class="section-card">
        <h2>一、精修行迹路线与国器流转专题（${curatedItems.length} 篇）</h2>
        <p>涵盖 6 篇带山川途经点与经典诗文引注的历史人物远行长卷，以及跨越千年的《传国玉玺》流转图志：</p>
        <div class="table-wrap">
          <table id="tbl-curated-persons" class="data-table">
            <thead>
              <tr>
                <th>专题名称（中英对照）</th>
                <th>时代跨度与简介</th>
                <th>代表站点路线</th>
                <th>图志与主图</th>
              </tr>
            </thead>
            <tbody>
${curatedRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-monographs" class="section-card">
        <h2>二、核心人物独立时空图志（${standardMonographs.length} 篇）</h2>
        <p>由主图编年引擎聚合 ≥ 5 处代表历史节点与地标事件的历代帝王、将相、文豪、史家与改革家：</p>
${renderFilterPresetChips('tbl-person-monographs', presetOptions)}
${renderTableFilterBar('tbl-person-monographs', `按姓名、字号、朝代、足迹或英文名检索 ${standardMonographs.length} 篇独立人物志…`, standardMonographs.length, { force: true })}
        <div class="table-wrap">
          <table id="tbl-person-monographs" class="data-table">
            <thead>
              <tr>
                <th>人物（中英与头衔字号）</th>
                <th>所属朝代与生卒年</th>
                <th>代表节点与活动足迹</th>
                <th>专题入口</th>
              </tr>
            </thead>
            <tbody>
${monographRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-directory" class="section-card">
        <h2>三、其余编年历史人物轨迹速查名录（${directoryOnlyPersons.length} 位）</h2>
        <p>收录 3–4 处核心编年节点的人物传记档案，点击姓名即可直接打开主地图交互轨迹视图：</p>
${renderTableFilterBar('tbl-person-directory', `按姓名、字号、朝代或英文名检索其余 ${directoryOnlyPersons.length} 位历史人物…`, directoryOnlyPersons.length, { force: true })}
        <div class="table-wrap">
          <table id="tbl-person-directory" class="data-table">
            <thead>
              <tr>
                <th>人物（中英与头衔字号）</th>
                <th>所属朝代与生卒年</th>
                <th>节点统计与别名索引</th>
                <th>交互地图</th>
              </tr>
            </thead>
            <tbody>
${directoryRowsHtml}
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
    filename: 'persons.html',
    html,
  };
}

module.exports = { buildPersonsIndexPage };
