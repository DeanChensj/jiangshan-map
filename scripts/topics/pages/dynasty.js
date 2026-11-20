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
  hasTocSidebar,
  renderTocSidebar,
  renderEmbedMapSection,
  renderTableFilterBar,
  renderRelatedStrip,
  renderFooter,
} = require('../layout');

function renderCartographicNotesSection(d, notes) {
  if (!Array.isArray(notes) || notes.length === 0) return '';
  const itemsHtml = notes
    .map(
      (n) => `          <div class="carto-note-item">
            <strong>${escHtml(n.title)}</strong>
            <p>${escHtml(n.detail)}</p>
          </div>`
    )
    .join('\n');
  return `      <section id="sec-notes" class="section-card carto-notes-card">
        <details class="carto-details">
          <summary>${escHtml(d.title)}舆图边界与政区考据（${notes.length} 条）</summary>
          <div class="carto-note-grid">
${itemsHtml}
          </div>
        </details>
      </section>\n\n`;
}

function renderDynastyPersonsSection(d, personLinks, num) {
  if (!Array.isArray(personLinks) || personLinks.length === 0) return '';
  const chipsHtml = personLinks
    .map(
      (lnk) =>
        `<a class="chip-link" href="${escHtml(lnk.href)}">${escHtml(lnk.label)}</a>`
    )
    .join('\n          ');
  return `      <section id="sec-persons" class="section-card">
        <h2>${num}、${escHtml(d.title)}人物志与行迹</h2>
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

  const pageTitle = `${d.title}历史地图（${spanZh} · ${titleEn}）· 疆域演变与编年大事 | 江山时序`;
  const spanFullZh =
    d.key === 'prc'
      ? `${fmtYearZh(d.fromYear)}至今`
      : `${fmtYearZh(d.fromYear)}至${fmtYearZh(d.toYear)}`;
  // A table of "ancient name → modern name" says nothing where the names are the same, so once
  // most rows are identical (20th century) only the renamed places are listed.
  const allSettlements = d.settlements || [];
  const renamedSettlements = allSettlements.filter((s) => s.modern && s.modern !== s.ancient);
  const settlements =
    renamedSettlements.length * 2 < allSettlements.length ? renamedSettlements : allSettlements;
  const pageDesc = `${d.title}历史地图（${spanFullZh}，都城：${d.seat}）：${d.summary} 收录${(d.phases || []).length || 1}幅多阶段版图快照、${settlements.length ? `${settlements.length}处古今地名对照与` : ''}${(d.milestones || []).length}项编年重大历史事件。`;

  const phases = d.phases && d.phases.length > 0 ? d.phases : [{ until: d.toYear, snap: d.snapKey }];
  const usePrefectureDivs = d.key === 'zhanguo' || d.key === 'qin';
  let prevPrefs = [];
  const phaseRowsHtml = phases
    .map((ph, pIdx) => {
      const sy = pIdx === 0 ? d.fromYear : phases[pIdx - 1].until;
      const ey = ph.until === undefined || pIdx === phases.length - 1 ? d.toYear : ph.until - 1;
      const midYear = sy === 0 ? 1 : Math.floor((sy + ey) / 2);
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
          snapCaption = String(snap.caption);
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
      // Captions open with their own year range ("1388—1407 年 · …"); the row already shows it.
      const overviewRaw = String(ph.overview || snapCaption || '')
        .replace(/^\s*前?\d[^·]{0,24}·\s*/, '')
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
        // Region names only: the polity column already lists who is on the map, and a name
        // diff cannot tell a renamed regime from a fallen one.
        const diffLines = [];
        if (addedPrefs.length) {
          diffLines.push(
            `<span class="diff-add">＋新见政区名：</span>${escHtml(addedPrefs.slice(0, 10).join('、'))}${
              addedPrefs.length > 10 ? ` 等 ${addedPrefs.length} 处` : ''
            }`
          );
        }
        if (removedPrefs.length) {
          diffLines.push(
            `<span class="diff-rem">－不再列出：</span>${escHtml(removedPrefs.slice(0, 10).join('、'))}${
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
      if (prefs.length > 0) prevPrefs = prefs;

      const phaseHref = buildMapHref(`?year=${midYear}`, { lang, base: mapBase });
      return `            <tr>
              <td><a href="${escHtml(phaseHref)}"><strong>${phaseSpanStr}</strong></a>${overviewText}</td>
              <td>${escHtml(polities.join('、') || d.title)}</td>
              <td>${prefCellHtml}</td>
            </tr>`;
    })
    .join('\n');

  const settlementRowsHtml = settlements
    .map((s) => {
      const placeHref = buildMapHref(`?year=${focusY}&place=${encodeURIComponent(s.ancient)}`, {
        lang,
        base: mapBase,
      });
      return `            <tr>
              <td><a href="${escHtml(placeHref)}"><strong>${escHtml(s.ancient)}</strong></a>${s.isCapital ? " ★" : ""}</td>
              <td>${escHtml(s.modern || s.ancient)}</td>
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
              <td><strong>${escHtml(m.headline)}</strong>${storyBadgeHtml}${m.note ? `<div class="event-note">${escHtml(m.note)}</div>` : ''}${citeHtml}</td>
            </tr>`;
    })
    .join('\n');

  const prevDyn = dIdx > 0 ? allDynasties[dIdx - 1] : null;
  const nextDyn = dIdx < allDynasties.length - 1 ? allDynasties[dIdx + 1] : null;
  const notesList = (dynastyNotes && dynastyNotes[d.key]) || [];

  const hasCitiesSec = settlements.length > 0;
  const hasCitations = milestoneRowsHtml.includes('source-cite');
  const numerals = ['一', '二', '三', '四'];
  const numCities = hasCitiesSec ? numerals[1] : '';
  const numEvents = numerals[hasCitiesSec ? 2 : 1];
  const numPersons = numerals[hasCitiesSec ? 3 : 2];
  const tocItems = [
    { id: 'sec-map', label: '交互舆图预览' },
    { id: 'sec-phases', label: '一、疆域阶段' },
  ];
  if (hasCitiesSec) {
    tocItems.push({ id: 'sec-cities', label: `${numCities}、古今名城` });
  }
  tocItems.push({ id: 'sec-events', label: `${numEvents}、编年大事` });
  const hasPersonsSec = Array.isArray(personLinks) && personLinks.length > 0;
  if (hasPersonsSec) {
    tocItems.push({ id: 'sec-persons', label: `${numPersons}、人物与行迹` });
  }
  const citiesSectionHtml = hasCitiesSec
    ? `      <section id="sec-cities" class="section-card">
        <h2>${numCities}、${escHtml(d.title)}古今地名对照</h2>
${renderTableFilterBar('tbl-cities', '输入古地名或今省市快速检索城池…', settlements.length)}
        <div class="table-wrap">
          <table id="tbl-cities" class="data-table">
            <thead>
              <tr>
                <th>古地名（★ 都城）</th>
                <th>现代对应地</th>
              </tr>
            </thead>
            <tbody>
${settlementRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

`
    : '';
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
  <div class="page-shell${hasTocSidebar(tocItems) ? ' has-toc' : ''}">
${renderTocSidebar(tocItems, tocFooterLinks)}
    <main class="main-col">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="${escHtml(buildMapHref('', { lang, base: mapBase }))}">江山时序首页</a> &rsaquo;
        <a href="index.html">专题图志总览</a> &rsaquo;
        <span>${escHtml(d.title)}（${escHtml(spanZh)}）</span>
      </nav>

      <article class="hero-card">
        <h1>${escHtml(d.title)}（${escHtml(spanZh)}）</h1>
        ${d.seat ? `<div class="meta-pills"><span class="meta-pill"><strong>都城：</strong>${escHtml(d.seat)}</span></div>` : ''}
        <p>${escHtml(d.summary)}</p>
${renderRelatedStrip(relatedLinks)}
      </article>

${renderEmbedMapSection({
  id: 'sec-map',
  iframeSrc: buildEmbedHref(`year=${focusY}&from=${d.fromYear}&to=${d.key === 'prc' ? 2026 : d.toYear}`, {
    lang,
    base: mapBase,
  }),
  fullHref: buildMapHref(mapQuery, { lang, base: mapBase }),
  titleZh: `${d.title}交互式舆图预览（${spanZh}）`,
})}

      <section id="sec-phases" class="section-card">
        <h2>一、${escHtml(d.title)}疆域演变阶段</h2>
${renderTableFilterBar('tbl-phases', '筛选阶段、政权或新增/改置政区…', phases.length)}
        <div class="table-wrap">
          <table id="tbl-phases" class="data-table">
            <thead>
              <tr>
                <th>年代</th>
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

${citiesSectionHtml}      <section id="sec-events" class="section-card">
        <h2>${numEvents}、${escHtml(d.title)}编年大事${hasCitations ? '与出处' : ''}</h2>
${renderTableFilterBar('tbl-events', '输入年份、人物或事件检索大事…', milestones.length)}
        <div class="table-wrap">
          <table id="tbl-events" class="data-table">
            <thead>
              <tr>
                <th>年份与年号</th>
                <th>历史事件${hasCitations ? '与出处' : ''}</th>
              </tr>
            </thead>
            <tbody>
${milestoneRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

${renderDynastyPersonsSection(d, personLinks, numPersons)}${renderCartographicNotesSection(d, notesList)}${renderFooter(allDynasties, { showDynastyChips: true, lang, mapBase })}
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
