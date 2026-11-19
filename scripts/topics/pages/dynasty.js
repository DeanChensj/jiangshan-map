'use strict';

const { BASE_URL, LASTMOD } = require('../config');
const {
  escHtml,
  fmtYearZh,
  fmtYearShortZh,
  fmtDynSpanZh,
  fmtDynSpanEn,
  firstSentenceZh,
  buildMapHref,
  buildEmbedHref,
  formatSourceCitationsHtml,
} = require('../runtime');
const {
  renderSharedHead,
  renderTopHeader,
  renderTocSidebar,
  renderEmbedMapSection,
  renderTableFilterBar,
  renderRelatedStrip,
  renderFooter,
} = require('../layout');

function renderCartographicNotesSection(d, notes, sectionNumZh = '四') {
  if (!Array.isArray(notes) || notes.length === 0) return '';
  const itemsHtml = notes
    .map(
      (n) => `          <div class="carto-note-item">
            <strong>${escHtml(n.title)}</strong>
            <p>${escHtml(n.detail)}</p>
          </div>`
    )
    .join('\n');
  return `      <section id="sec-notes" class="section-card">
        <h2>${escHtml(sectionNumZh)}、${escHtml(d.title)}舆图边界与政区考据</h2>
        <div class="carto-note-grid">
${itemsHtml}
        </div>
      </section>\n\n`;
}

function renderDynastyPersonsSection(d, personLinks) {
  if (!Array.isArray(personLinks) || personLinks.length === 0) return '';
  const chipsHtml = personLinks
    .map(
      (lnk) =>
        `<a class="chip-link" href="${escHtml(lnk.href)}">${escHtml(lnk.label)}</a>`
    )
    .join('\n          ');
  return `      <section id="sec-persons" class="section-card">
        <h2>四、${escHtml(d.title)}人物志与行迹</h2>
        <div class="chip-grid">
          ${chipsHtml}
          <a class="chip-link" href="persons.html">浏览历代人物志 →</a>
        </div>
      </section>\n\n`;
}

function buildDynastyPage({
  d,
  allDynasties,
  snapshots,
  enLocale,
  ctrl,
  provinces,
  sourcesBundle,
  dynastyNotes,
  relatedLinks,
  personLinks = [],
  assetHashes,
  lang = 'zh',
  mapBase = '../',
}) {
  const dIdx = allDynasties.indexOf(d);
  ctrl.locale = 'en';
  const titleEn = ctrl.dynastyName(d);
  const seatEn = ctrl.dynastySeat(d);
  ctrl.locale = 'zh';

  const focusY = d.focusYear !== undefined ? d.focusYear : d.fromYear;
  const spanZh = fmtDynSpanZh(d);
  const spanEn = fmtDynSpanEn(d);
  const canonicalUrl = `${BASE_URL}/topics/${d.key}.html`;
  const mapQuery = `?year=${focusY}`;

  const pageTitle = `${d.title}历史地图（${spanZh} · ${titleEn}）· 疆域演变、州郡政区、古今地名对照与重大事件 | 江山时序`;
  const spanFullZh =
    d.key === 'prc'
      ? `${fmtYearZh(d.fromYear)}至今`
      : `${fmtYearZh(d.fromYear)}至${fmtYearZh(d.toYear)}`;
  const pageDesc = `${d.title}历史地图（${spanFullZh}，都城：${d.seat}）：${d.summary} 收录${(d.phases || []).length || 1}幅多阶段版图快照、${(d.settlements || []).length}座城池古今地名对照与${(d.milestones || []).length}项编年重大历史事件。`;

  const phases = d.phases && d.phases.length > 0 ? d.phases : [{ until: d.toYear, snap: d.snapKey }];
  const usePrefectureDivs = d.key === 'zhanguo' || d.key === 'qin';
  let prevPolities = [];
  let prevPrefs = [];
  const phaseRowsHtml = phases
    .map((ph, pIdx) => {
      const sy = pIdx === 0 ? d.fromYear : phases[pIdx - 1].until;
      const ey = ph.until === undefined || pIdx === phases.length - 1 ? d.toYear : ph.until - 1;
      const midYear = sy === 0 ? 1 : Math.floor((sy + ey) / 2);
      const eraStr = ctrl.formatEraLabel(midYear, d);
      const sk = ph.snap || ph.snapKey || d.snapKey;

      let polities = [];
      let prefs = [];
      let snapCaption = '';
      if (d.key === 'prc') {
        polities = ['中华人民共和国'];
        prefs = (provinces || []).map((p) => p.title).filter(Boolean);
      } else if (sk && snapshots[sk]) {
        const snap = snapshots[sk];
        if (snap.caption) {
          snapCaption = String(snap.caption).replace(/^[^·]+·\s*/, '').trim();
        }
        polities = Array.from(
          new Set(
            (snap.polities || [])
              .filter((p) => p.role === 'main' || p.role === 'rival' || p.role === 'protectorate')
              .map((p) => p.title)
              .filter(Boolean)
          )
        );
        const primaryDivs = usePrefectureDivs
          ? snap.prefectures || snap.regions || []
          : snap.regions || [];
        prefs = Array.from(new Set(primaryDivs.map((r) => r.title).filter(Boolean)));
      }
      const overviewRaw = String(ph.overview || snapCaption || '')
        .replace(/^[^·]{1,28}·\s*/, '')
        .trim();
      const overviewText = overviewRaw
        ? `<br/><small class="muted-note">${escHtml(overviewRaw)}</small>`
        : '';
      const phaseSpanStr =
        d.key === 'prc' && pIdx === phases.length - 1
          ? `${fmtYearShortZh(sy)} —`
          : `${fmtYearShortZh(sy)} — ${fmtYearShortZh(ey)}`;

      let prefCellHtml = '';
      if (pIdx === 0) {
        const baseList = escHtml(prefs.slice(0, 14).join('、') || '全境省区');
        const moreSuffix = prefs.length > 14 ? ` 等共 ${prefs.length} 个政区` : '';
        prefCellHtml = `${baseList}${moreSuffix}`;
      } else {
        const comparePrefs = prefs.length > 0 && prevPrefs.length > 0;
        const addedPrefs = comparePrefs ? prefs.filter((x) => !prevPrefs.includes(x)) : [];
        const removedPrefs = comparePrefs ? prevPrefs.filter((x) => !prefs.includes(x)) : [];
        const addedPols = polities.filter((x) => !prevPolities.includes(x));
        const removedPols = prevPolities.filter((x) => !polities.includes(x));
        const diffLines = [];
        if (addedPols.length) {
          diffLines.push(`<span class="diff-add">＋新增/建置：</span>${escHtml(addedPols.join('、'))}`);
        }
        if (removedPols.length) {
          diffLines.push(`<span class="diff-rem">－更替/罢撤：</span>${escHtml(removedPols.join('、'))}`);
        }
        if (addedPrefs.length) {
          diffLines.push(
            `<span class="diff-add">＋新增政区：</span>${escHtml(addedPrefs.slice(0, 10).join('、'))}${
              addedPrefs.length > 10 ? ` 等 ${addedPrefs.length} 处` : ''
            }`
          );
        }
        if (removedPrefs.length) {
          diffLines.push(
            `<span class="diff-rem">－失守/省并政区：</span>${escHtml(removedPrefs.slice(0, 10).join('、'))}${
              removedPrefs.length > 10 ? ` 等 ${removedPrefs.length} 处` : ''
            }`
          );
        }
        if (diffLines.length > 0) {
          prefCellHtml = diffLines.join('<br/>');
        } else {
          prefCellHtml = '<span class="diff-same">州道/省区建制与前阶段相承</span>';
        }
      }
      prevPolities = polities;
      if (prefs.length > 0) prevPrefs = prefs;

      const phaseHref = buildMapHref(`?year=${midYear}`, { lang, base: mapBase });
      return `            <tr>
              <td><a href="${escHtml(phaseHref)}"><strong>${phaseSpanStr}</strong></a><br/><small>${escHtml(eraStr)}</small>${overviewText}</td>
              <td>${escHtml(polities.join('、') || d.title)}</td>
              <td>${prefCellHtml}</td>
            </tr>`;
    })
    .join('\n');

  const settlements = d.settlements || [];
  const settlementRowsHtml = settlements
    .map((s) => {
      const roleStr = s.isCapital ? '★ 都城/首府' : s.tier === 1 ? '核心重镇' : '州郡治所/名城';
      const placeHref = buildMapHref(`?year=${focusY}&place=${encodeURIComponent(s.ancient)}`, {
        lang,
        base: mapBase,
      });
      return `            <tr>
              <td><a href="${escHtml(placeHref)}"><strong>${escHtml(s.ancient)}</strong></a></td>
              <td>${escHtml(s.modern || s.ancient)}</td>
              <td>${roleStr}</td>
            </tr>`;
    })
    .join('\n');

  const milestones = d.milestones || [];
  const milestoneRowsHtml = milestones
    .map((m) => {
      const mk = `${d.key}:${m.year}`;
      const enPair = (enLocale.milestones && enLocale.milestones[mk]) || [];
      const eraLabel = ctrl._eventEraLabel(d, m);
      const mUrl = buildMapHref(`?year=${m.year}`, { lang, base: mapBase });
      const storyMatch =
        typeof ctrl._findStoryForMilestone === 'function'
          ? ctrl._findStoryForMilestone(d.key, m)
          : null;
      const storyBadgeHtml = storyMatch
        ? `<a class="story-link-pill" href="story-${escHtml(storyMatch.key)}.html">始末沙盘 →</a>`
        : '';
      const citeHtml = formatSourceCitationsHtml(`milestone:${mk}`, sourcesBundle);
      return `            <tr${enPair[0] ? ` data-search="${escHtml(enPair[0])}"` : ''}>
              <td><a href="${escHtml(mUrl)}"><strong>${fmtYearShortZh(m.year)}年</strong></a><br/><small>${escHtml(eraLabel)}</small></td>
              <td><strong>${escHtml(m.headline)}</strong>${storyBadgeHtml}</td>
              <td>${escHtml(m.note || '')}${citeHtml}</td>
            </tr>`;
    })
    .join('\n');

  const prevDyn = dIdx > 0 ? allDynasties[dIdx - 1] : null;
  const nextDyn = dIdx < allDynasties.length - 1 ? allDynasties[dIdx + 1] : null;
  const notesList = (dynastyNotes && dynastyNotes[d.key]) || [];

  const tocItems = [
    { id: 'sec-map', label: '交互舆图预览' },
    { id: 'sec-phases', label: '一、疆域阶段' },
    { id: 'sec-cities', label: '二、古今名城' },
    { id: 'sec-events', label: '三、编年大事' },
  ];
  const hasPersonsSec = Array.isArray(personLinks) && personLinks.length > 0;
  if (hasPersonsSec) {
    tocItems.push({ id: 'sec-persons', label: '四、人物与行迹' });
  }
  const notesNumZh = hasPersonsSec ? '五' : '四';
  if (notesList.length > 0) {
    tocItems.push({ id: 'sec-notes', label: `${notesNumZh}、舆图考据札记` });
  }
  const tocFooterLinks = [
    prevDyn ? `<a href="${escHtml(prevDyn.key)}.html">← ${escHtml(prevDyn.title)}</a>` : '',
    nextDyn ? `<a href="${escHtml(nextDyn.key)}.html">${escHtml(nextDyn.title)} →</a>` : '',
  ]
    .filter(Boolean)
    .join('\n        ');

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
        isPartOf: {
          '@type': 'WebSite',
          name: '江山时序 · 中国历史地图',
          url: `${BASE_URL}/`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '江山时序首页', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: '专题图志总览', item: `${BASE_URL}/topics/index.html` },
          { '@type': 'ListItem', position: 3, name: `${d.title}历史地图（${spanZh}）`, item: canonicalUrl },
        ],
      },
    ],
  };

  const keywords = [
    `${d.title}历史地图`,
    `${d.title}版图疆域`,
    `${d.title}行政区划州郡`,
    `${d.title}古今地名对照表`,
    `${d.title}都城${d.seat}`,
    `${titleEn} historical map`,
    '中国历史地图时间轴',
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
  <div class="page-shell has-toc">
${renderTocSidebar(tocItems, tocFooterLinks)}
    <main class="main-col">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="${escHtml(buildMapHref('', { lang, base: mapBase }))}">江山时序首页</a> &rsaquo;
        <a href="index.html">专题图志总览</a> &rsaquo;
        <span>${escHtml(d.title)}（${escHtml(spanZh)}）</span>
      </nav>

      <article class="hero-card">
        <span class="kicker">中国历代疆域与政区图志</span>
        <h1>${escHtml(d.title)}（${escHtml(spanZh)}）</h1>
        ${d.seat ? `<div class="meta-pills"><span class="meta-pill"><strong>都城：</strong>${escHtml(d.seat)}</span></div>` : ''}
        <p>${escHtml(d.summary)}</p>
        <div class="cta-row">
          <a class="cta-btn" href="${escHtml(buildMapHref(mapQuery, { lang, base: mapBase }))}">在交互地图中查看「${escHtml(d.title)}」→</a>
        </div>
${renderRelatedStrip(relatedLinks)}
      </article>

${renderEmbedMapSection({
  id: 'sec-map',
  iframeSrc: buildEmbedHref(`year=${focusY}&from=${d.fromYear}&to=${d.key === 'prc' ? 2026 : d.toYear}`, {
    lang,
    base: mapBase,
  }),
  titleZh: `${d.title}交互式舆图预览（${spanZh}）`,
  hintZh: '点击地图激活交互 · 右上角可全屏打开主地图',
})}

      <section id="sec-phases" class="section-card">
        <h2>一、${escHtml(d.title)}疆域演变阶段</h2>
${renderTableFilterBar('tbl-phases', '筛选阶段、政权或新增/改置政区…', phases.length)}
        <div class="table-wrap">
          <table id="tbl-phases" class="data-table">
            <thead>
              <tr>
                <th>年代与年号</th>
                <th>并立政权</th>
                <th>政区与疆域变化</th>
              </tr>
            </thead>
            <tbody>
${phaseRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-cities" class="section-card">
        <h2>二、${escHtml(d.title)}古今地名对照</h2>
${renderTableFilterBar('tbl-cities', '输入古地名或今省市快速检索城池…', settlements.length)}
        <div class="table-wrap">
          <table id="tbl-cities" class="data-table">
            <thead>
              <tr>
                <th>古地名</th>
                <th>现代对应地</th>
                <th>层级</th>
              </tr>
            </thead>
            <tbody>
${settlementRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-events" class="section-card">
        <h2>三、${escHtml(d.title)}编年大事与出处</h2>
${renderTableFilterBar('tbl-events', '输入年份、人物、事件或正史典籍检索大事…', milestones.length)}
        <div class="table-wrap">
          <table id="tbl-events" class="data-table">
            <thead>
              <tr>
                <th>年份与年号</th>
                <th>历史事件</th>
                <th>史事与出处</th>
              </tr>
            </thead>
            <tbody>
${milestoneRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

${renderDynastyPersonsSection(d, personLinks)}${renderCartographicNotesSection(d, notesList, notesNumZh)}${renderFooter(allDynasties, { showDynastyChips: true, lang, mapBase })}
    </main>
  </div>
</body>
</html>
`;

  const summaryShortZh = firstSentenceZh(d.summary);
  return {
    filename: `${d.key}.html`,
    html,
    meta: {
      slug: d.key,
      url: canonicalUrl,
      titleZh: `${d.title}历史地图（${spanZh}）`,
      titleEn: `${titleEn} Historical Map (${spanEn})`,
      seatZh: d.seat,
      summaryZh: summaryShortZh,
      descZh: `都城：${d.seat} · ${summaryShortZh}`,
      descEn: `Capital: ${seatEn} · ${phases.length} territory phases, ${settlements.length} cities & ${milestones.length} events`,
    },
  };
}

module.exports = { buildDynastyPage };
