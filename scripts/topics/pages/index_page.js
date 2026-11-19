'use strict';

const { BASE_URL } = require('../config');
const { escHtml } = require('../runtime');
const {
  renderSharedHead,
  renderTopHeader,
  renderTocSidebar,
  renderTableFilterBar,
  renderFooter,
} = require('../layout');

function buildTopicsIndexPage({
  dynMeta,
  storyMeta,
  journeyMeta,
  featuredMeta,
  personMeta = [],
  placeMeta = [],
  totalPersonDirectoryCount = 139,
  totalCitiesCount = 87,
  totalPassesCount = 20,
  allDynasties,
  assetHashes,
}) {
  const canonicalUrl = `${BASE_URL}/topics/index.html`;
  const pageTitle = '江山时序 · 中国历史地图专题图志总览（18朝代疆域 · 重大事件始末沙盘 · 人物行迹 · 古诗词路线）';
  const pageDesc =
    '江山时序（Jiangshan Historical Atlas）静态历史地理百科与专题图志总览：涵盖战国至现代18个时期版图政区，秦灭六国、楚汉之争、安史之乱、靖康之变、红军长征5大双阵营始末沙盘，张骞、诸葛亮、玄奘、李白、苏轼、王阳明人物行迹，以及古诗词路线与长平、赤壁、淝水大战地图。';

  const storyListHtml = storyMeta
    .map(
      (s) => `            <tr>
              <td><a href="${escHtml(s.slug)}.html"><strong>${escHtml(s.titleZh)}</strong></a><br/><small>${escHtml(s.titleEn)}</small></td>
              <td>${escHtml(s.descZh)}</td>
              <td><a href="${escHtml(s.slug)}.html">查阅沙盘图志 →</a></td>
            </tr>`
    )
    .join('\n');

  const featListHtml = featuredMeta
    .map(
      (f) => `            <tr>
              <td><a href="${escHtml(f.slug)}.html"><strong>${escHtml(f.titleZh)}</strong></a><br/><small>${escHtml(f.titleEn)}</small></td>
              <td>${escHtml(f.descZh)}</td>
              <td><a href="${escHtml(f.slug)}.html">查阅专题 →</a></td>
            </tr>`
    )
    .join('\n');

  const dynListHtml = dynMeta
    .map(
      (d) => `            <tr>
              <td><a href="${escHtml(d.slug)}.html"><strong>${escHtml(d.titleZh)}</strong></a><br/><small>${escHtml(d.titleEn)}</small></td>
              <td>${escHtml(d.descZh)}</td>
              <td><a href="${escHtml(d.slug)}.html">查阅图志 →</a></td>
            </tr>`
    )
    .join('\n');

  const jListHtml = journeyMeta
    .map(
      (j) => `            <tr>
              <td><a href="${escHtml(j.slug)}.html"><strong>${escHtml(j.titleZh)}</strong></a><br/><small>${escHtml(j.titleEn)}</small></td>
              <td>${escHtml(j.descZh)}</td>
              <td><a href="${escHtml(j.slug)}.html">查阅路线 →</a></td>
            </tr>`
    )
    .join('\n');

  const personListHtml = personMeta
    .map(
      (p) => `            <tr>
              <td><a href="${escHtml(p.slug)}.html"><strong>${escHtml(p.titleZh)}</strong></a><br/><small>${escHtml(p.titleEn)}</small></td>
              <td>${escHtml(p.descZh)}</td>
              <td><a href="${escHtml(p.slug)}.html">查阅人物志 →</a></td>
            </tr>`
    )
    .join('\n');

  const placeListHtml = placeMeta
    .map(
      (pl) => `            <tr>
              <td><a href="${escHtml(pl.slug)}.html"><strong>${escHtml(pl.titleZh)}</strong></a><br/><small>${escHtml(pl.titleEn)}</small></td>
              <td>${escHtml(pl.descZh)}</td>
              <td><a href="${escHtml(pl.slug)}.html">查阅地区志 →</a></td>
            </tr>`
    )
    .join('\n');

  const totalCount =
    dynMeta.length +
    storyMeta.length +
    journeyMeta.length +
    featuredMeta.length +
    personMeta.length +
    placeMeta.length;

  const tocItems = [
    { id: 'sec-stories', label: `一、事件始末（${storyMeta.length}）` },
    { id: 'sec-featured', label: `二、诗词与战役（${featuredMeta.length}）` },
    { id: 'sec-dynasties', label: `三、十八朝疆域（${dynMeta.length}）` },
    { id: 'sec-journeys', label: `四、精修行迹（${journeyMeta.length}）` },
    { id: 'sec-persons', label: `五、历代人物志（${personMeta.length}）` },
    { id: 'sec-places', label: `六、历代地区志（${placeMeta.length}）` },
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
  })}
<body>
${renderTopHeader({ activeNav: 'index' })}
  <div class="page-shell has-toc">
${renderTocSidebar(tocItems)}
    <main class="main-col">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="../">江山时序首页</a> &rsaquo;
        <span>专题图志总览</span>
      </nav>

      <article class="hero-card">
        <span class="kicker">江山时序 · 历史地理图志总览（共收录 ${totalCount} 篇专题）</span>
        <h1>中国历代疆域、事件沙盘、人物行迹与古诗词地图志</h1>
        <p class="en-sub">Chinese Historical Territory Monographs, Event Sandtables, Person Chronicles &amp; Classical Poetry Routes (403 BCE – Present)</p>
        <p>汇集「江山时序」全部专题图志，每篇提供古今地名对照、帝王年号编年、一手正史出处与交互式古舆图实时预览。</p>
        <div class="cta-row">
          <a class="cta-btn" href="../">进入「江山时序」交互式主地图（前403年—今）→</a>
          <a class="cta-btn secondary" href="persons.html">浏览历代人物志总录（${totalPersonDirectoryCount} 位）→</a>
          <a class="cta-btn secondary" href="places.html">浏览历代地区志与雄关总录（${totalCitiesCount} 城 · ${totalPassesCount} 关）→</a>
        </div>
      </article>

      <section id="sec-stories" class="section-card">
        <h2>一、重大历史事件始末 · 双阵营对抗沙盘图志（${storyMeta.length} 篇）</h2>
        <div class="table-wrap">
          <table id="tbl-stories" class="data-table">
            <thead>
              <tr>
                <th>事件始末沙盘（中英对照）</th>
                <th>时代跨度与全线推演节点</th>
                <th>专题链接</th>
              </tr>
            </thead>
            <tbody>
${storyListHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-featured" class="section-card">
        <h2>二、古诗词地理名篇路线与著名历史战役专题（${featuredMeta.length} 篇）</h2>
        <div class="table-wrap">
          <table id="tbl-featured" class="data-table">
            <thead>
              <tr>
                <th>专题名称（中英对照）</th>
                <th>地理考据与历史内容提要</th>
                <th>专题链接</th>
              </tr>
            </thead>
            <tbody>
${featListHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-dynasties" class="section-card">
        <h2>三、中国十八历史时期疆域、政区与古今地名图志（${dynMeta.length} 篇）</h2>
${renderTableFilterBar('tbl-dynasties', '按朝代、都城或英文名检索历史时期…', dynMeta.length)}
        <div class="table-wrap">
          <table id="tbl-dynasties" class="data-table">
            <thead>
              <tr>
                <th>朝代 / 历史时期</th>
                <th>都城、版图快照数与古城大事统计</th>
                <th>专题链接</th>
              </tr>
            </thead>
            <tbody>
${dynListHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-journeys" class="section-card">
        <h2>四、点人溯事：历史人物精修行迹图志（${journeyMeta.length} 篇）</h2>
        <div class="table-wrap">
          <table id="tbl-journeys" class="data-table">
            <thead>
              <tr>
                <th>人物行迹专题</th>
                <th>途经站点路线</th>
                <th>专题链接</th>
              </tr>
            </thead>
            <tbody>
${jListHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-persons" class="section-card">
        <h2>五、历代核心人物与国器流转独立图志（${personMeta.length} 篇 · 全库收录 ${totalPersonDirectoryCount} 位）</h2>
        <p>汇总全库高密度历史人物（≥ 5 处代表节点）与《传国玉玺》独立图志；完整 139 位人物总录请见 <a href="persons.html"><strong>历代人物志总录</strong></a>：</p>
${renderTableFilterBar('tbl-persons', '输入人物姓名、朝代、地点或英文名检索 65 篇人物与国器图志…', personMeta.length)}
        <div class="table-wrap">
          <table id="tbl-persons" class="data-table">
            <thead>
              <tr>
                <th>人物 / 国器（中英对照）</th>
                <th>朝代与主要足迹节点</th>
                <th>专题链接</th>
              </tr>
            </thead>
            <tbody>
${personListHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-places" class="section-card">
        <h2>六、历代核心名城地区志（${placeMeta.length} 篇 · 全库收录 ${totalCitiesCount} 名城与 ${totalPassesCount} 雄关）</h2>
        <p>收录历代古都与区域中心十八朝政区沿革表与编年史事；全库 87 座名城与 20 座天下雄关名录请见 <a href="places.html"><strong>历代地区志与雄关总录</strong></a>：</p>
${renderTableFilterBar('tbl-places', `输入城市名、古称、形胜或英文名检索 ${placeMeta.length} 篇地区志…`, placeMeta.length)}
        <div class="table-wrap">
          <table id="tbl-places" class="data-table">
            <thead>
              <tr>
                <th>历史名城（中英对照）</th>
                <th>形胜定位与沿革史事统计</th>
                <th>专题链接</th>
              </tr>
            </thead>
            <tbody>
${placeListHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-methodology" class="section-card">
        <h2>七、历史舆图制图原则与山川地理考据说明</h2>
        <div class="carto-note-grid">
          <div class="carto-note-item">
            <strong>1. 自然山川与分水岭原则（去现代省界化）</strong>
            <p>历代政权边界严格遵循山脉分水岭、大川水道与关隘锁钥（如战国巴蜀循涪江—嘉陵江分水岭、宋元川滇循大渡河、北魏北界越六镇抵阴山漠南、河西与吐谷浑循祁连山及日月山分界），摒弃将现代省界机械套用于古代政区的做法。</p>
          </div>
          <div class="carto-note-item">
            <strong>2. 古海岸线与河口三角洲演进复原</strong>
            <p>分阶段还原先秦至唐宋古渤海湾西岸、苏北范公堤以东成陆前岸线、长江口崇明沙洲发育过程、珠江三角洲古海湾，以及明郑至清道光三年（1823）曾文溪改道淤积前的台湾台南“台江内海”古地理形态。</p>
          </div>
          <div class="carto-note-item">
            <strong>3. 一手正史与《资治通鉴》卷次出处核验</strong>
            <p>编年大事、城邑地标与人物行迹逐条核对《二十四史》（《史记》《汉书》《三国志》《晋书》《隋书》《旧唐书》《新唐书》《宋史》等）及《资治通鉴》具体卷次，并在各朝代与事件专题页内展示史料出处。</p>
          </div>
          <div class="carto-note-item">
            <strong>4. 古今同名异地消歧与细粒度时间切片</strong>
            <p>严格区分历代“同名异地”（如秦汉巴郡江州今重庆 vs 东晋隋唐宋江州今江西九江；三国蒲圻赤壁 vs 黄州东坡赤壁），并在政权交替关键节点（如秦末前209/前207、西汉前111—前108四连拍、盛唐安西四镇三度得失、元末1335/1367、民国1926北伐与1928省名改制）提供高密度时间切片。</p>
          </div>
        </div>
      </section>

${renderFooter(allDynasties)}
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
