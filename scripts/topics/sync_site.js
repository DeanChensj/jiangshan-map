'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, BASE_URL, LASTMOD } = require('./config');
const { escHtml, fmtYearShortZh, fmtDynSpanZh } = require('./runtime');

function computeSitemapXml(
  dynMeta,
  storyMeta,
  journeyMeta,
  featuredMeta,
  personMeta = [],
  placeMeta = []
) {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  const existingXml = fs.readFileSync(sitemapPath, 'utf8');

  // Remove any previously injected /topics/ URLs so this helper is idempotent
  const cleanedXml = existingXml.replace(
    /\s*<url>\s*<loc>https:\/\/deanchen\.me\/jiangshan-map\/topics\/[^<]*<\/loc>[\s\S]*?<\/url>/g,
    ''
  );

  const topicUrls = [
    { loc: `${BASE_URL}/topics/index.html`, priority: '0.95' },
    { loc: `${BASE_URL}/topics/persons.html`, priority: '0.94' },
    { loc: `${BASE_URL}/topics/places.html`, priority: '0.94' },
    ...storyMeta.map((s) => ({ loc: s.url, priority: '0.92' })),
    ...featuredMeta.map((f) => ({ loc: f.url, priority: '0.9' })),
    ...dynMeta.map((d) => ({ loc: d.url, priority: '0.9' })),
    ...journeyMeta.map((j) => ({ loc: j.url, priority: '0.9' })),
    ...placeMeta.map((pl) => ({ loc: pl.url, priority: '0.89' })),
    ...personMeta.map((p) => ({ loc: p.url, priority: '0.88' })),
  ];

  const topicBlocks = topicUrls
    .map(
      (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n');

  return {
    path: sitemapPath,
    content: cleanedXml.replace('</urlset>', `${topicBlocks}\n</urlset>`),
    addedCount: topicUrls.length,
  };
}

function computeCalligraphySubsetText(dynasties, enLocale) {
  const sources = [
    '江山时序',
    ...dynasties.map((d) => d.title || ''),
    ...dynasties.map((d) => (enLocale.dynasties[d.key] && enLocale.dynasties[d.key].name) || ''),
  ];
  return Array.from(new Set(sources.join(''))).sort().join('');
}

function computeLlmsTxt(dynasties, snapshots, loreData) {
  const llmsPath = path.join(ROOT, 'llms.txt');
  if (!fs.existsSync(llmsPath)) return null;
  const histSnapCount = Object.keys(snapshots).filter((k) => k !== 'neighbors').length;
  const totalMilestones = dynasties.reduce((sum, d) => sum + (d.milestones || []).length, 0);
  const totalLandmarks = (loreData.PLACE_LANDMARK_EVENTS || []).length;
  const llmsSrc = fs.readFileSync(llmsPath, 'utf8');
  const updatedLlms = llmsSrc.replace(
    /共 \d+ 个历史时期、\d+ 幅多阶段疆域与州郡政区快照、\d+ 条编年大事、\d+ 处城池地标/,
    `共 ${dynasties.length} 个历史时期、${histSnapCount} 幅多阶段疆域与州郡政区快照、${totalMilestones} 条编年大事、${totalLandmarks} 处城池地标`
  );
  return { path: llmsPath, content: updatedLlms };
}

function computeIndexHtml(
  dynMeta,
  storyMeta,
  journeyMeta,
  featuredMeta,
  dynasties,
  snapshots,
  loreData,
  enLocale,
  personMeta = [],
  placeMeta = []
) {
  const indexPath = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  // 1. Subset Ma Shan Zheng calligraphy webfont
  const calligraphyChars = computeCalligraphySubsetText(dynasties, enLocale);
  const encodedCalligraphy = encodeURIComponent(calligraphyChars).replace(/'/g, '%27');
  const NON_BLOCKING = ` rel="stylesheet" media="print" onload="this.media='all'" />`;
  const fontLinksBlock = `  <link data-font-href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@400;500&display=swap"${NON_BLOCKING}\n  <link data-font-href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&text=${encodedCalligraphy}&display=swap"${NON_BLOCKING}`;
  const fontRegex =
    /  <link (?:data-font-)?href="https:\/\/fonts\.googleapis\.com\/css2\?family=Noto\+Serif\+SC[^"]*" rel="stylesheet"[^>]*\/>(?:\r?\n  <link (?:data-font-)?href="https:\/\/fonts\.googleapis\.com\/css2\?family=Ma\+Shan\+Zheng[^"]*" rel="stylesheet"[^>]*\/>)?/;
  if (!fontRegex.test(html)) {
    throw new Error('Could not find Google Fonts stylesheet link block in index.html');
  }
  html = html.replace(fontRegex, fontLinksBlock);

  // 2. Synchronize pre-rendered Warring States opening summary & milestone list in #chronicle-pane
  const openingDyn = dynasties[0];
  html = html.replace(
    /<p id="dynasty-summary" class="dynasty-desc">[\s\S]*?<\/p>/,
    `<p id="dynasty-summary" class="dynasty-desc">${escHtml(openingDyn.summary)}</p>`
  );
  const milestoneItemsHtml = (openingDyn.milestones || [])
    .map(
      (m) =>
        `            <li><span class="ev-yr">${escHtml(fmtYearShortZh(m.year))} 年</span><span>${escHtml(m.headline)}</span></li>`
    )
    .join('\n');
  html = html.replace(
    /<ul id="milestone-list">[\s\S]*?<\/ul>/,
    `<ul id="milestone-list">\n${milestoneItemsHtml}\n          </ul>`
  );

  // 3. Synchronize live dataset counts in FAQ JSON-LD & ItemList directory in JSON-LD
  const histSnapCount = Object.keys(snapshots).filter((k) => k !== 'neighbors').length;
  const totalMilestones = dynasties.reduce((sum, d) => sum + (d.milestones || []).length, 0);
  const totalLandmarks = (loreData.PLACE_LANDMARK_EVENTS || []).length;
  html = html.replace(
    /共\d+个历史时期、\d+幅多阶段疆域与州郡政区快照、\d+条编年大事、\d+处城池地标/,
    `共${dynasties.length}个历史时期、${histSnapCount}幅多阶段疆域与州郡政区快照、${totalMilestones}条编年大事、${totalLandmarks}处城池地标`
  );
  const ldMatch = html.match(/(<script type="application\/ld\+json">\r?\n)([\s\S]*?)(\r?\n\s*<\/script>)/);
  if (ldMatch) {
    const ldObj = JSON.parse(ldMatch[2]);
    const graph = Array.isArray(ldObj['@graph']) ? ldObj['@graph'] : [];
    const itemList = graph.find((n) => n && n['@type'] === 'ItemList');
    if (itemList) {
      const listItems = [];
      let pos = 1;
      for (const d of dynasties) {
        const enName = (enLocale.dynasties[d.key] && enLocale.dynasties[d.key].name) || d.key;
        const focusYr = d.focusYear !== undefined ? d.focusYear : d.fromYear;
        listItems.push({
          '@type': 'ListItem',
          position: pos++,
          name: `${d.title}（${fmtDynSpanZh(d)}）· ${enName}`,
          description: `都城：${d.seat}。${d.summary}`,
          url: `${BASE_URL}/?year=${focusYr}`,
        });
      }
      for (const s of (loreData.PERSON_PROFILES || []).filter((p) => p && p.isStory)) {
        const chain = (s.stops || [])
          .map((st) => `${st.ancientZh}（今${st.modernZh}）`)
          .join(' → ');
        listItems.push({
          '@type': 'ListItem',
          position: pos++,
          name: `${s.zh} (${s.en}) · ${s.courtesyZh || ''}`,
          description: `事件全脉络：${chain}`,
          url: `${BASE_URL}/?event=${s.key}`,
        });
      }
      for (const j of loreData.HISTORICAL_JOURNEYS || []) {
        const chain = (j.stops || [])
          .map((st) => `${st.ancientZh}（今${st.modernZh}）`)
          .join(' → ');
        listItems.push({
          '@type': 'ListItem',
          position: pos++,
          name: `${j.titleZh} (${j.titleEn}) · ${j.spanZh}`,
          description: `途经节点：${chain}`,
          url: `${BASE_URL}/?person=${j.key}`,
        });
      }
      itemList.itemListElement = listItems;
      html = html.replace(
        ldMatch[0],
        `${ldMatch[1]}${JSON.stringify(ldObj, null, 2)}${ldMatch[3]}`
      );
    }
  }

  // 4. Synchronize Sections 一, 二, and 五 of #seo-atlas-directory idempotently
  const sectionOneItems = dynasties
    .map((d) => {
      const enName = (enLocale.dynasties[d.key] && enLocale.dynasties[d.key].name) || d.key;
      const sampleEvs = (d.milestones || [])
        .slice(0, 4)
        .map((m) => `${fmtYearShortZh(m.year)}年${m.headline}`)
        .join('；');
      const focusYr = d.focusYear !== undefined ? d.focusYear : d.fromYear;
      return `          <li><a href="${BASE_URL}/?year=${focusYr}"><strong>${escHtml(d.title)}历史地图（${escHtml(fmtDynSpanZh(d))} · ${escHtml(enName)}）</strong></a> — 都城：${escHtml(d.seat)}。代表事件：${escHtml(sampleEvs)}。</li>`;
    })
    .join('\n');
  html = html.replace(
    /(<h3>一、历代疆域与州郡政区时间轴目录（Dynasties &amp; Historical Territories）<\/h3>\s*<ul>)[\s\S]*?(<\/ul>)/,
    `$1\n${sectionOneItems}\n        $2`
  );

  const sectionTwoItems = (loreData.HISTORICAL_JOURNEYS || [])
    .map((j) => {
      const stopsChain = (j.stops || [])
        .map((s) => `${s.ancientZh}（今${s.modernZh}）`)
        .join(' → ');
      return `          <li><a href="${BASE_URL}/?person=${escHtml(j.key)}"><strong>${escHtml(j.titleZh)}（${escHtml(j.titleEn)} · ${escHtml(j.spanZh)}）</strong></a> — ${escHtml(stopsChain)}。</li>`;
    })
    .join('\n');
  html = html.replace(
    /(<h3>二、点人溯事：历史人物生平行迹图（Person Chronicles）<\/h3>\s*<ul>)[\s\S]*?(<\/ul>)/,
    `$1\n${sectionTwoItems}\n        $2`
  );

  html = html.replace(/\s*<section id="seo-static-topics-section">[\s\S]*?<\/section>/g, '');

  const totalCount =
    dynMeta.length +
    storyMeta.length +
    journeyMeta.length +
    featuredMeta.length +
    personMeta.length +
    placeMeta.length;
  const allItems = [
    `          <li><a href="${BASE_URL}/topics/index.html"><strong>江山时序专题图志总览（${totalCount}篇静态历史地理百科目录）</strong></a></li>`,
    `          <li><a href="${BASE_URL}/topics/persons.html"><strong>江山时序历代人物志与国器流转总录（${personMeta.length}篇独立人物图志）</strong></a></li>`,
    `          <li><a href="${BASE_URL}/topics/places.html"><strong>江山时序历代地区志与雄关总录（${placeMeta.length}篇核心名城沿革图志）</strong></a></li>`,
    ...storyMeta.map(
      (s) =>
        `          <li><a href="${s.url}"><strong>${escHtml(s.titleZh)}双阵营始末沙盘图志（静态专题页）</strong></a></li>`
    ),
    ...featuredMeta.map(
      (f) => `          <li><a href="${f.url}"><strong>${escHtml(f.titleZh)}（静态图文考据专题）</strong></a></li>`
    ),
    ...dynMeta.map(
      (d) =>
        `          <li><a href="${d.url}"><strong>${escHtml(d.titleZh)}疆域政区与古今地名表（静态专题页）</strong></a></li>`
    ),
    ...journeyMeta.map(
      (j) =>
        `          <li><a href="${j.url}"><strong>${escHtml(j.titleZh)}生平行迹与诗词路线图志（静态专题页）</strong></a></li>`
    ),
    ...placeMeta.map(
      (pl) =>
        `          <li><a href="${pl.url}"><strong>${escHtml(pl.titleZh)}十八朝政区沿革与历代史事地区志（静态专题页）</strong></a></li>`
    ),
    ...personMeta.map(
      (p) =>
        `          <li><a href="${p.url}"><strong>${escHtml(p.titleZh)}时空轨迹与生平史事图志（静态专题页）</strong></a></li>`
    ),
  ].join('\n');

  const sectionFive = `      <section id="seo-static-topics-section">
        <h3>五、静态历史地理专题图志索引（Static Historical Geography Topic Pages）</h3>
        <ul>
${allItems}
        </ul>
      </section>
    </nav>`;

  const target = '      </section>\n    </nav>';
  if (!html.includes(target)) {
    throw new Error('Could not find closing </section>\\n    </nav> in index.html');
  }
  html = html.replace(target, `      </section>\n${sectionFive}`);
  return { path: indexPath, content: html };
}

module.exports = {
  computeSitemapXml,
  computeLlmsTxt,
  computeIndexHtml,
};
