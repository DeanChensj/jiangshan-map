'use strict';

const { BASE_URL } = require('../config');
const { escHtml } = require('../runtime');
const {
  renderSharedHead,
  renderTopHeader,
  hasTocSidebar,
  renderTocSidebar,
  renderTableFilterBar,
  renderFooter,
} = require('../layout');

function buildTopicsIndexPage({
  dynMeta,
  storyMeta,
  journeyMeta,
  featuredMeta,
  allDynasties,
  assetHashes,
  lang = 'zh',
  mapBase = '../',
}) {
  const canonicalUrl = `${BASE_URL}/topics/index.html`;
  const pageTitle = '江山时序 · 中国历史地图专题图志总览（18朝代疆域 · 重大事件始末沙盘 · 人物行迹 · 古诗词路线）';
  const pageDesc =
    '江山时序（Jiangshan Historical Atlas）静态历史地理百科与专题图志总览：涵盖战国至现代18个时期版图政区，秦灭六国、楚汉之争、安史之乱、靖康之变、红军长征5大双阵营始末沙盘，张骞、诸葛亮、玄奘、李白、苏轼、王阳明人物行迹，以及古诗词路线与长平、赤壁、淝水大战地图。';

  const storyListHtml = storyMeta
    .map(
      (s) => `            <tr data-search="${escHtml(s.titleEn)}">
              <td><a href="${escHtml(s.slug)}.html"><strong>${escHtml(s.titleZh)}</strong></a></td>
              <td>${escHtml(s.descZh)}</td>
            </tr>`
    )
    .join('\n');

  const featListHtml = featuredMeta
    .map(
      (f) => `            <tr data-search="${escHtml(f.titleEn)}">
              <td><a href="${escHtml(f.slug)}.html"><strong>${escHtml(f.titleZh)}</strong></a></td>
              <td>${escHtml(f.descZh)}</td>
            </tr>`
    )
    .join('\n');

  const dynListHtml = dynMeta
    .map(
      (d) => `            <tr data-search="${escHtml(d.titleEn)}">
              <td><a href="${escHtml(d.slug)}.html"><strong>${escHtml(d.titleZh)}</strong></a></td>
              <td><strong>都城：</strong>${escHtml(d.seatZh || '')} · ${escHtml(d.summaryZh || d.descZh)}</td>
            </tr>`
    )
    .join('\n');

  const jListHtml = journeyMeta
    .map(
      (j) => `            <tr data-search="${escHtml(j.titleEn)}">
              <td><a href="${escHtml(j.slug)}.html"><strong>${escHtml(j.titleZh)}</strong></a></td>
              <td>${escHtml(j.descZh)}</td>
            </tr>`
    )
    .join('\n');

  const tocItems = [
    { id: 'sec-stories', label: '一、事件始末' },
    { id: 'sec-featured', label: '二、诗词与战役' },
    { id: 'sec-dynasties', label: '三、十八朝疆域' },
    { id: 'sec-journeys', label: '四、精修行迹' },
  ];
  const shellClass = hasTocSidebar(tocItems) ? 'page-shell has-toc' : 'page-shell';

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
      '中国历史地图专题',
      '历代疆域图志',
      '历史事件始末沙盘',
      '古诗词地理路线图',
      '古今地名对照表',
      '点人溯事生平行迹',
      '江山时序',
    ],
    canonicalUrl,
    jsonLdObj: jsonLd,
    assetHashes,
    lang,
  })}
<body>
${renderTopHeader({ activeNav: 'index', lang, mapBase })}
  <div class="${shellClass}">
${renderTocSidebar(tocItems)}
    <main class="main-col">
      <article class="hero-card">
        <h1>中国历代疆域、事件沙盘、人物行迹与古诗词图志</h1>
        <p>汇集「江山时序」全部静态历史地理专题，提供古今地名对照、帝王年号编年与交互式古舆图实时预览，部分史事附史料出处。</p>
      </article>

      <section id="sec-stories" class="section-card">
        <h2>一、重大历史事件始末 · 双阵营沙盘</h2>
        <div class="table-wrap">
          <table id="tbl-stories" class="data-table">
            <thead>
              <tr>
                <th>事件始末</th>
                <th>时代跨度与脉络</th>
              </tr>
            </thead>
            <tbody>
${storyListHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-featured" class="section-card">
        <h2>二、古诗词路线与著名战役</h2>
        <div class="table-wrap">
          <table id="tbl-featured" class="data-table">
            <thead>
              <tr>
                <th>专题名称</th>
                <th>考据提要</th>
              </tr>
            </thead>
            <tbody>
${featListHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-dynasties" class="section-card">
        <h2>三、十八历史时期疆域与政区</h2>
${renderTableFilterBar('tbl-dynasties', '按朝代或都城检索…', dynMeta.length)}
        <div class="table-wrap">
          <table id="tbl-dynasties" class="data-table">
            <thead>
              <tr>
                <th>朝代 / 历史时期</th>
                <th>都城与概要</th>
              </tr>
            </thead>
            <tbody>
${dynListHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-journeys" class="section-card">
        <h2>四、点人溯事：历史人物精修行迹</h2>
        <div class="table-wrap">
          <table id="tbl-journeys" class="data-table">
            <thead>
              <tr>
                <th>人物行迹</th>
                <th>主要途经站点</th>
              </tr>
            </thead>
            <tbody>
${jListHtml}
            </tbody>
          </table>
        </div>
      </section>

      <p class="index-editorial-note">制图与考据说明：历代疆域依自然山川、分水岭与关隘划定（非现代省界），分期复原古海岸线与河口演变，史事出处以《资治通鉴》与历代正史为主，逐条核对仍在进行。</p>

${renderFooter(allDynasties, { showDynastyChips: false, lang, mapBase })}
    </main>
  </div>
</body>
</html>
`;

  return {
    filename: 'index.html',
    html,
  };
}

module.exports = { buildTopicsIndexPage };
