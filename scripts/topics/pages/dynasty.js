'use strict';

const { BASE_URL, LASTMOD } = require('../config');
const {
  escHtml,
  fmtYearZh,
  fmtYearShortZh,
  fmtDynSpanZh,
  fmtDynSpanEn,
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
        <h2>${escHtml(sectionNumZh)}、${escHtml(d.title)}舆图边界、山川形胜与政区考据札记</h2>
        <p>以下记录「江山时序」在绘制${escHtml(d.title)}（${fmtDynSpanZh(d)}）疆域多边形、古海岸线与州郡政区时所依据的历史地理考据准则：</p>
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
        <h2>四、${escHtml(d.title)}人物志与生平行迹（${personLinks.length} 篇）</h2>
        <p>收录${escHtml(d.title)}时期具备完整生平编年节点与正史出处的精修行迹与核心历史人物独立图志：</p>
        <div class="chip-grid">
          ${chipsHtml}
          <a class="chip-link" href="persons.html">浏览历代人物志总录 →</a>
        </div>
      </section>\n\n`;
}

function buildDynastyPage({
  d,
  idx,
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
}) {
  ctrl.locale = 'en';
  const titleEn = ctrl.dynastyName(d);
  const seatEn = ctrl.dynastySeat(d);
  const summaryEn = ctrl.dynastySummary(d);
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
          const divCount = prefs.length || prevPrefs.length;
          prefCellHtml = `<span class="diff-same">州道/省区建制同上阶段${divCount ? `（共 ${divCount} 政区）` : ''}，详见左侧阶段提要</span>`;
        }
      }
      prevPolities = polities;
      if (prefs.length > 0) prevPrefs = prefs;

      return `            <tr>
              <td>第 ${pIdx + 1} 阶段</td>
              <td><strong>${phaseSpanStr}</strong><br/><small>${escHtml(eraStr)}</small>${overviewText}</td>
              <td>${escHtml(polities.join('、') || d.title)}</td>
              <td>${prefCellHtml}</td>
              <td><a href="../?year=${midYear}">查看 ${fmtYearShortZh(midYear)}年 舆图 →</a></td>
            </tr>`;
    })
    .join('\n');

  const settlements = d.settlements || [];
  const settlementRowsHtml = settlements
    .map((s) => {
      const roleStr = s.isCapital ? '★ 都城/首府' : s.tier === 1 ? '核心重镇' : '州郡治所/名城';
      const placeHref = `../?year=${focusY}&place=${encodeURIComponent(s.ancient)}`;
      return `            <tr>
              <td><strong>${escHtml(s.ancient)}</strong></td>
              <td>${escHtml(s.modern || s.ancient)}</td>
              <td>${roleStr}</td>
              <td>${s.coord[0].toFixed(2)}°E, ${s.coord[1].toFixed(2)}°N</td>
              <td><a href="${escHtml(placeHref)}">地图定位与沿革 →</a></td>
            </tr>`;
    })
    .join('\n');

  const milestones = d.milestones || [];
  const milestoneRowsHtml = milestones
    .map((m) => {
      const mk = `${d.key}:${m.year}`;
      const enPair = (enLocale.milestones && enLocale.milestones[mk]) || [];
      const eraLabel = ctrl._eventEraLabel(d, m);
      const mUrl = `../?year=${m.year}`;
      const storyMatch =
        typeof ctrl._findStoryForMilestone === 'function'
          ? ctrl._findStoryForMilestone(d.key, m)
          : null;
      const storyBadgeHtml = storyMatch
        ? `<a class="story-link-pill" href="story-${escHtml(storyMatch.key)}.html">始末沙盘图志 →</a>`
        : '';
      const citeHtml = formatSourceCitationsHtml(`milestone:${mk}`, sourcesBundle);
      return `            <tr>
              <td><strong>${fmtYearShortZh(m.year)}年</strong><br/><small>${escHtml(eraLabel)}</small></td>
              <td><strong>${escHtml(m.headline)}</strong>${storyBadgeHtml}${enPair[0] ? `<br/><small>${escHtml(enPair[0])}</small>` : ''}</td>
              <td>${escHtml(m.note || '')}${citeHtml}</td>
              <td><a href="${escHtml(mUrl)}">定格此年 →</a></td>
            </tr>`;
    })
    .join('\n');

  const prevDyn = idx > 0 ? allDynasties[idx - 1] : null;
  const nextDyn = idx < allDynasties.length - 1 ? allDynasties[idx + 1] : null;
  const notesList = (dynastyNotes && dynastyNotes[d.key]) || [];

  const tocItems = [
    { id: 'sec-map', label: '交互舆图预览' },
    { id: 'sec-phases', label: `一、疆域阶段（${phases.length}）` },
    { id: 'sec-cities', label: `二、古今名城（${settlements.length}）` },
    { id: 'sec-events', label: `三、编年大事（${milestones.length}）` },
  ];
  const hasPersonsSec = Array.isArray(personLinks) && personLinks.length > 0;
  if (hasPersonsSec) {
    tocItems.push({ id: 'sec-persons', label: `四、人物与行迹（${personLinks.length}）` });
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
  })}
<body>
${renderTopHeader()}
  <div class="page-shell has-toc">
${renderTocSidebar(tocItems, tocFooterLinks)}
    <main class="main-col">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="../">江山时序首页</a> &rsaquo;
        <a href="index.html">专题图志总览</a> &rsaquo;
        <span>${escHtml(d.title)}（${escHtml(spanZh)}）</span>
      </nav>

      <article class="hero-card">
        <span class="kicker">中国历代疆域与政区图志 · 第 ${idx + 1} / ${allDynasties.length} 篇</span>
        <h1>${escHtml(d.title)}（${escHtml(spanZh)}）· 疆域政区图志</h1>
        <p class="en-sub">${escHtml(titleEn)} Historical Atlas (${escHtml(spanEn)}) · Capital: ${escHtml(seatEn)}</p>
        <div class="meta-pills">
          <span class="meta-pill"><strong>起止年代：</strong>${d.key === 'prc' ? `${fmtYearZh(d.fromYear)} —` : `${fmtYearZh(d.fromYear)} — ${fmtYearZh(d.toYear)}`}</span>
          <span class="meta-pill"><strong>历代都城：</strong>${escHtml(d.seat)}</span>
          <span class="meta-pill"><strong>版图阶段：</strong>${phases.length} 期</span>
          <span class="meta-pill"><strong>收录名城：</strong>${settlements.length} 座</span>
          <span class="meta-pill"><strong>编年大事：</strong>${milestones.length} 项</span>
        </div>
        <p>${escHtml(d.summary)}</p>
        ${summaryEn ? `<p class="en-sub">${escHtml(summaryEn)}</p>` : ''}
        <div class="cta-row">
          <a class="cta-btn" href="../${escHtml(mapQuery)}">打开「${escHtml(d.title)}」交互地图（${fmtYearShortZh(focusY)}年）→</a>
          <a class="cta-btn secondary" href="../${escHtml(mapQuery)}&amp;lang=en">Open in English →</a>
          ${prevDyn ? `<a class="cta-btn secondary" href="${escHtml(prevDyn.key)}.html">← ${escHtml(prevDyn.title)}</a>` : ''}
          ${nextDyn ? `<a class="cta-btn secondary" href="${escHtml(nextDyn.key)}.html">${escHtml(nextDyn.title)} →</a>` : ''}
        </div>
${renderRelatedStrip(relatedLinks)}
      </article>

${renderEmbedMapSection({
  id: 'sec-map',
  iframeSrc: `../?embed=1&year=${focusY}&from=${d.fromYear}&to=${d.key === 'prc' ? 2026 : d.toYear}`,
  titleZh: `${d.title}交互式历史舆图预览（${spanZh} · 可拨动底部时间轴切换阶段）`,
  hintZh: '点击地图激活交互 · 右上角可全屏打开主地图',
})}

      <section id="sec-phases" class="section-card">
        <h2>一、${escHtml(d.title)}版图演变阶段与政权州郡格局（${phases.length} 阶段快照）</h2>
        <p>在「江山时序」交互式舆图中拖动底部时间轴滑块，或点击下方各阶段链接，即可查看${escHtml(d.title)}不同年份的政权疆域消长、州道郡县边界及黄河改道水系：</p>
${renderTableFilterBar('tbl-phases', '筛选阶段、政权或新增/改置政区…', phases.length)}
        <div class="table-wrap">
          <table id="tbl-phases" class="data-table">
            <thead>
              <tr>
                <th>阶段</th>
                <th>年代范围与代表年号</th>
                <th>并立政权 / 核心版图</th>
                <th>政区格局与阶段疆域变化</th>
                <th>交互地图</th>
              </tr>
            </thead>
            <tbody>
${phaseRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-cities" class="section-card">
        <h2>二、${escHtml(d.title)}古今地名对照表与点地溯源（共收录 ${settlements.length} 座城池）</h2>
        <p>点击任一城池右侧的「地图定位与沿革」，即可在地图上自动飞跃至该城坐标并展开「点地溯源 · 两千四百年政区沿革」卡片：</p>
${renderTableFilterBar('tbl-cities', '输入古地名或今省市快速检索城池…', settlements.length)}
        <div class="table-wrap">
          <table id="tbl-cities" class="data-table">
            <thead>
              <tr>
                <th>历史古地名</th>
                <th>现代对应省市 / 地点</th>
                <th>层级</th>
                <th>经纬度坐标</th>
                <th>点地溯源</th>
              </tr>
            </thead>
            <tbody>
${settlementRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-events" class="section-card">
        <h2>三、${escHtml(d.title)}重大历史事件编年表与正史出处（${milestones.length} 项）</h2>
${renderTableFilterBar('tbl-events', '输入年份、人物、事件或正史典籍检索大事…', milestones.length)}
        <div class="table-wrap">
          <table id="tbl-events" class="data-table">
            <thead>
              <tr>
                <th>年份与帝王年号</th>
                <th>历史事件（中英对照）</th>
                <th>史事背景、地理空间影响与史料出处</th>
                <th>地图定格</th>
              </tr>
            </thead>
            <tbody>
${milestoneRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

${renderDynastyPersonsSection(d, personLinks)}${renderCartographicNotesSection(d, notesList, notesNumZh)}${renderFooter(allDynasties)}
    </main>
  </div>
</body>
</html>
`;

  return {
    filename: `${d.key}.html`,
    html,
    meta: {
      slug: d.key,
      url: canonicalUrl,
      titleZh: `${d.title}历史地图（${spanZh}）`,
      titleEn: `${titleEn} Historical Map (${spanEn})`,
      descZh: `${d.seat} · ${phases.length}阶段版图 · ${settlements.length}座古城与${milestones.length}项大事`,
      descEn: `Capital: ${seatEn} · ${phases.length} territory phases, ${settlements.length} cities & ${milestones.length} events`,
    },
  };
}

module.exports = { buildDynastyPage };
