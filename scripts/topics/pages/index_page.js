'use strict';

const { BASE_URL } = require('../config');
const { escHtml, buildMapHref } = require('../runtime');
const {
  renderSharedHead,
  renderTopHeader,
  renderTocSidebar,
  renderTableFilterBar,
  renderFooter,
} = require('../layout');

function pickShowcaseItems(items, limit) {
  if (!Array.isArray(items) || items.length <= limit) return items || [];
  const relics = items.filter((x) => x && x.isRelic);
  const std = items.filter((x) => x && !x.isRelic);
  const restLimit = Math.max(0, limit - relics.length);
  if (std.length <= restLimit) return [...relics, ...std];
  const picked = [...relics];
  for (let i = 0; i < restLimit; i++) {
    const idx =
      restLimit === 1
        ? 0
        : Math.round((i * (std.length - 1)) / (restLimit - 1));
    const candidate = std[idx];
    if (candidate && !picked.includes(candidate)) picked.push(candidate);
  }
  return picked;
}

function buildTopicsIndexPage({
  dynMeta,
  storyMeta,
  journeyMeta,
  featuredMeta,
  personMeta = [],
  placeMeta = [],
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

  const personShowcaseChips = pickShowcaseItems(personMeta, 16)
    .map(
      (p) =>
        `<a class="chip-link" href="${escHtml(p.slug)}.html">${escHtml(p.zh || p.titleZh)}</a>`
    )
    .join('\n          ');

  const placeShowcaseChips = (placeMeta || [])
    .slice(0, 15)
    .map((pl) => {
      const shortName = String(pl.displayTitleZh || pl.titleZh || '').split('（')[0];
      return `<a class="chip-link" href="${escHtml(pl.slug)}.html">${escHtml(shortName)}</a>`;
    })
    .join('\n          ');

  const tocItems = [
    { id: 'sec-stories', label: '一、事件始末' },
    { id: 'sec-featured', label: '二、诗词与战役' },
    { id: 'sec-dynasties', label: '三、十八朝疆域' },
    { id: 'sec-journeys', label: '四、精修行迹' },
    { id: 'sec-persons', label: '五、历代人物志' },
    { id: 'sec-places', label: '六、历代地区志' },
    { id: 'sec-methodology', label: '七、制图考据原则' },
  ];

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
  <div class="page-shell has-toc">
${renderTocSidebar(tocItems)}
    <main class="main-col">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="${escHtml(buildMapHref('', { lang, base: mapBase }))}">江山时序首页</a> &rsaquo;
        <span>专题图志总览</span>
      </nav>

      <article class="hero-card">
        <span class="kicker">江山时序 · 历史地理图志</span>
        <h1>中国历代疆域、事件沙盘、人物行迹与古诗词图志</h1>
        <p>汇集「江山时序」全部静态历史地理专题，提供古今地名对照、帝王年号编年、正史出处与交互式古舆图实时预览。</p>
        <div class="cta-row">
          <a class="cta-btn" href="${escHtml(buildMapHref('', { lang, base: mapBase }))}">进入交互式主地图 →</a>
        </div>
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

      <section id="sec-persons" class="section-card">
        <div class="channel-head">
          <h2>五、历代人物志</h2>
          <a class="channel-more-link" href="persons.html">查看全部人物志 →</a>
        </div>
        <p>收录历代帝王、将相、文豪、史家及传世国器独立图志，附带逐事正史出处与同代人物交汇：</p>
        <div class="chip-grid">
          ${personShowcaseChips}
        </div>
      </section>

      <section id="sec-places" class="section-card">
        <div class="channel-head">
          <h2>六、历代地区志与雄关</h2>
          <a class="channel-more-link" href="places.html">查看全部地区志与雄关 →</a>
        </div>
        <p>收录历代古都与区域中心十八朝政区沿革表，以及天下名关雄隘地理考据：</p>
        <div class="chip-grid">
          ${placeShowcaseChips}
        </div>
      </section>

      <section id="sec-methodology" class="section-card">
        <h2>七、制图考据原则</h2>
        <div class="carto-note-grid">
          <div class="carto-note-item">
            <strong>1. 自然山川与分水岭原则（去现代省界化）</strong>
            <p>历代政权边界严格遵循山脉分水岭、大川水道与关隘锁钥（如战国巴蜀循涪江—嘉陵江分水岭、宋元川滇循大渡河、北魏北界越六镇抵阴山漠南、河西与吐谷浑循祁连山及日月山分界），摒弃将现代省界机械套用于古代政区的做法。</p>
          </div>
          <div class="carto-note-item">
            <strong>2. 古海岸线与河口三角洲演进复原</strong>
            <p>分阶段还原先秦至唐宋古渤海湾西岸、苏北范公堤以东成陆前岸线、长江口崇明沙洲发育过程、珠江三角洲古海湾，以及清道光三年（1823）曾文溪改道淤积前的台湾台南“台江内海”古地理形态。</p>
          </div>
          <div class="carto-note-item">
            <strong>3. 一手正史与《资治通鉴》卷次出处核验</strong>
            <p>编年大事、城邑地标与人物行迹逐条核对《二十四史》（《史记》《汉书》《三国志》《晋书》《隋书》《旧唐书》《新唐书》《宋史》等）及《资治通鉴》具体卷次，并在各专题页内展示史料出处。</p>
          </div>
          <div class="carto-note-item">
            <strong>4. 古今同名异地消歧与细粒度时间切片</strong>
            <p>严格区分历代“同名异地”（如秦汉巴郡江州今重庆 vs 东晋隋唐宋江州今江西九江；三国蒲圻赤壁 vs 黄州东坡赤壁），并在政权兴替与边疆更易的关键年份提供高精度时间切片。</p>
          </div>
        </div>
      </section>

${renderFooter(allDynasties, { showDynastyChips: true, lang, mapBase })}
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
