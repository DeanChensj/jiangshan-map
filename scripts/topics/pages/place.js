'use strict';

const { BASE_URL, LASTMOD } = require('../config');
const {
  escHtml,
  fmtYearShortZh,
  fmtDynSpanZh,
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

function resolvePlaceNearestCityDisplay(dInfo, fallbackLabel, nearestCfg) {
  const maxDist = (nearestCfg && nearestCfg.maxDistanceKm) || 55;
  const distAbove = (nearestCfg && nearestCfg.showDistanceAboveKm) || 25;
  const nc = dInfo.nearestCity;
  if (!nc || nc.distanceKm > maxDist) {
    return fallbackLabel;
  }
  return nc.distanceKm <= distAbove
    ? `${nc.ancient}（今${nc.modern}）`
    : `${nc.ancient}（今${nc.modern}，距 ${nc.distanceKm} km）`;
}

function buildPlacePage({
  place,
  allPlaces,
  cityLore,
  allDynasties,
  ctrl,
  loreData,
  sourcesBundle,
  geoOverrides,
  linkedPersons = [],
  relatedLinks = [],
  assetHashes,
  lang = 'zh',
  mapBase = '../',
}) {
  const idx = allPlaces.indexOf(place);
  const slug = `place-${place.slug}`;
  const canonicalUrl = `${BASE_URL}/topics/${slug}.html`;
  const [lng, lat] = cityLore.coord;
  const lngFixed = lng.toFixed(2);
  const latFixed = lat.toFixed(2);
  const focusY = Number.isInteger(place.focusYear) ? place.focusYear : 741;
  const mapQuery = `?year=${focusY}&lng=${lngFixed}&lat=${latFixed}`;

  const infoNow = ctrl.inspect({ year: focusY, lng, lat });
  const modernProv = infoNow.modernProvince || '';
  const nearestCfg = (geoOverrides && geoOverrides.nearestCity) || {};
  const adminOverrides =
    (geoOverrides && geoOverrides.placeDynastyAdminOverrides && geoOverrides.placeDynastyAdminOverrides[slug]) ||
    {};

  let capDynCount = 0;
  const capDynNames = [];
  const rawEvents = [];
  const seenEvKey = new Set();
  const landmarks = (loreData && loreData.PLACE_LANDMARK_EVENTS) || [];

  const genRows = allDynasties
    .map((d) => {
      const sampleY = d.focusYear !== undefined ? d.focusYear : d.fromYear;
      const dInfo = ctrl.inspect({ year: sampleY, lng, lat });
      const near = ctrl._findNearestSettlement(d.settlements, lng, lat);
      if (near && near.km <= 38 && near.s && near.s.isCapital) {
        capDynCount++;
        capDynNames.push(d.title);
      }

      const pevs = ctrl._collectPlaceEventsForDynasty(d, lng, lat, near);
      for (const ev of pevs) {
        const dk = `${ev.year}|${ev.text}`;
        if (seenEvKey.has(dk)) continue;
        seenEvKey.add(dk);

        let citeHtml = '';
        if (ev.fromLandmark) {
          const lmHit = landmarks.find(
            (lm) => lm.year === ev.year && lm.dynastyKey === d.key && lm.zh === ev.text
          );
          if (lmHit) citeHtml = formatSourceCitationsHtml(`event:${lmHit.id}`, sourcesBundle);
        } else {
          citeHtml = formatSourceCitationsHtml(`milestone:${d.key}:${ev.year}`, sourcesBundle);
        }
        const enRaw =
          ev.milestone && ev.milestone.headlineEn
            ? ev.milestone.headlineEn
            : ev.milestone && typeof ctrl._enMilestoneHeadline === 'function'
              ? ctrl._enMilestoneHeadline(d, ev.milestone)
              : '';
        const enText = enRaw && enRaw !== ev.text ? enRaw : '';

        rawEvents.push({
          year: ev.year,
          dynasty: d,
          eraZh: ctrl.formatEraLabel(ev.year, d, [lng, lat]),
          siteZh: (ev.milestone && ev.milestone.site) || (near && near.km <= 38 ? near.s.name : place.modern),
          textZh: ev.text,
          textEn: enText,
          citeHtml,
        });
      }

      const rawAdminList =
        d.key === 'zhanguo'
          ? dInfo.polity === '秦'
            ? [...(dInfo.regions || []), ...(dInfo.prefectures || [])]
            : dInfo.prefectures || []
          : [...(dInfo.regions || []), ...(dInfo.prefectures || [])];
      const adminParts = Array.from(
        new Set(rawAdminList.map((p) => String(p).replace(/\(([^)]+)\)/g, '（$1）')))
      ).filter(Boolean);

      const ov = adminOverrides[d.key] || null;
      const polityStr = (ov && ov.polity) || dInfo.polity || d.title;
      let adminStr =
        (ov && ov.admin) ||
        adminParts.join(' · ') ||
        (d.key === 'zhanguo' ? `${polityStr}直辖（未设郡）` : `${polityStr}直辖`);
      const nearStr = resolvePlaceNearestCityDisplay(dInfo, '—', nearestCfg);
      const rowHref = buildMapHref(`?year=${sampleY}&lng=${lngFixed}&lat=${latFixed}`, {
        lang,
        base: mapBase,
      });

      return `            <tr>
              <td><a href="${escHtml(rowHref)}"><strong>${escHtml(d.title)}</strong></a>（${fmtDynSpanZh(d)}）<br/><small>${escHtml(dInfo.era)}</small></td>
              <td>${escHtml(polityStr)}</td>
              <td>${escHtml(adminStr)}</td>
              <td>${escHtml(nearStr)}</td>
            </tr>`;
    })
    .join('\n');

  rawEvents.sort((a, b) => a.year - b.year);
  const evRowsHtml = rawEvents
    .map((ev) => {
      const rowHref = buildMapHref(`?year=${ev.year}&lng=${lngFixed}&lat=${latFixed}`, {
        lang,
        base: mapBase,
      });
      return `            <tr${ev.textEn ? ` data-search="${escHtml(ev.textEn)}"` : ''}>
              <td><a href="${escHtml(rowHref)}"><strong>${fmtYearShortZh(ev.year)}年</strong></a><br/><small>${escHtml(ev.eraZh)}</small></td>
              <td><strong>${escHtml(ev.siteZh)}</strong><br/><small>${escHtml(ev.dynasty.title)}</small></td>
              <td>${escHtml(ev.textZh)}${ev.citeHtml ? `\n                ${ev.citeHtml}` : ''}</td>
            </tr>`;
    })
    .join('\n');

  const eventsSectionHtml = rawEvents.length
    ? `\n      <section id="sec-events" class="section-card">
        <h2>二、「${escHtml(place.displayTitleZh)}」历代编年大事</h2>
${renderTableFilterBar('tbl-place-events', `检索${place.modern}历代事件、年份或正史典籍…`, rawEvents.length)}
        <div class="table-wrap">
          <table id="tbl-place-events" class="data-table">
            <thead>
              <tr>
                <th>年份与年号</th>
                <th>城名 / 朝代</th>
                <th>史事与出处</th>
              </tr>
            </thead>
            <tbody>
${evRowsHtml}
            </tbody>
          </table>
        </div>
      </section>`
    : '';

  const personChipsHtml = linkedPersons.length
    ? `\n      <section id="sec-persons" class="section-card">
        <h2>${rawEvents.length ? '三' : '二'}、与「${escHtml(place.displayTitleZh)}」关联的历史人物</h2>
        <div class="chip-grid">
${linkedPersons
  .map((lp) => {
    const rawHref = lp.href || `?person=${encodeURIComponent(lp.key)}`;
    const href = rawHref.startsWith('../?')
      ? buildMapHref(rawHref.slice(3), { lang, base: mapBase })
      : rawHref.startsWith('?')
        ? buildMapHref(rawHref, { lang, base: mapBase })
        : rawHref;
    return `          <a class="chip-link" href="${escHtml(href)}">${escHtml(lp.zh)}</a>`;
  })
  .join('\n')}
          <a class="chip-link" href="persons.html">浏览历代人物志 →</a>
        </div>
      </section>`
    : '';

  const tocItems = [
    { id: 'sec-map', label: '交互舆图预览' },
    { id: 'sec-genealogy', label: '一、十八朝沿革' },
  ];
  if (rawEvents.length) {
    tocItems.push({ id: 'sec-events', label: '二、历代编年史事' });
  }
  if (linkedPersons.length) {
    const pNumZh = rawEvents.length ? '三' : '二';
    tocItems.push({ id: 'sec-persons', label: `${pNumZh}、关联人物` });
  }

  const prevPlace = idx > 0 ? allPlaces[idx - 1] : null;
  const nextPlace = idx < allPlaces.length - 1 ? allPlaces[idx + 1] : null;
  const navFooterParts = [];
  if (prevPlace) {
    navFooterParts.push(`<a href="place-${escHtml(prevPlace.slug)}.html">← ${escHtml(prevPlace.modern)}</a>`);
  }
  if (nextPlace) {
    navFooterParts.push(`<a href="place-${escHtml(nextPlace.slug)}.html">${escHtml(nextPlace.modern)} →</a>`);
  }

  const pageTitle = `${place.displayTitleZh}历史地图与两千四百年历代政区沿革 | 江山时序`;
  const pageDesc = `${place.displayTitleZh}（${place.en} · ${cityLore.tagZh}）：${cityLore.descZh.slice(0, 125)}… 覆盖18朝州郡行省沿革、${rawEvents.length}项历史大事与交互舆图溯源。`;

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
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '江山时序首页', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: '专题图志总览', item: `${BASE_URL}/topics/index.html` },
          { '@type': 'ListItem', position: 3, name: '历代地区志', item: `${BASE_URL}/topics/places.html` },
          { '@type': 'ListItem', position: 4, name: place.displayTitleZh, item: canonicalUrl },
        ],
      },
    ],
  };

  const keywords = [
    place.modern,
    place.displayTitleZh,
    `${place.modern}历史沿革`,
    `${place.modern}历代属地郡县`,
    `${place.en} historical map`,
    place.regionGroup,
    '点地溯源',
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
${renderTopHeader({ activeNav: 'places', lang, mapBase })}
  <div class="page-shell has-toc">
${renderTocSidebar(tocItems, navFooterParts.join('\n        '))}
    <main class="main-col">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="${escHtml(buildMapHref('', { lang, base: mapBase }))}">江山时序首页</a> &rsaquo;
        <a href="index.html">专题图志总览</a> &rsaquo;
        <a href="places.html">历代地区志</a> &rsaquo;
        <span>${escHtml(place.displayTitleZh)}</span>
      </nav>

      <article class="hero-card">
        <span class="kicker">点地溯源 · 历代名城地区志 · ${escHtml(cityLore.tagZh)}</span>
        <h1>${escHtml(place.displayTitleZh)}</h1>
        <div class="meta-pills">
          <span class="meta-pill"><strong>地理片区：</strong>${escHtml(place.regionGroup)}</span>
          ${modernProv ? `<span class="meta-pill"><strong>今属政区：</strong>${escHtml(modernProv)} · ${escHtml(place.modern)}</span>` : ''}
          ${capDynCount > 0 ? `<span class="meta-pill"><strong>图中建都：</strong>${capDynCount} 朝（${escHtml(capDynNames.slice(0, 4).join('·'))}${capDynNames.length > 4 ? '等' : ''}）</span>` : ''}
        </div>
        <p>${escHtml(cityLore.descZh)}</p>
        <div class="cta-row">
          <a class="cta-btn" href="${escHtml(buildMapHref(mapQuery, { lang, base: mapBase }))}">在交互地图查看「${escHtml(place.modern)}」沿革 →</a>
        </div>
${renderRelatedStrip(relatedLinks)}
      </article>

${renderEmbedMapSection({
  id: 'sec-map',
  iframeSrc: buildEmbedHref(`year=${focusY}&lng=${lngFixed}&lat=${latFixed}`, { lang, base: mapBase }),
  titleZh: `${place.displayTitleZh}交互式历史地图预览（${fmtYearShortZh(focusY)}年切片）`,
  hintZh: '点击地图激活交互 · 右上角可全屏对比历代变迁',
})}

      <section id="sec-genealogy" class="section-card">
        <h2>一、「${escHtml(place.displayTitleZh)}」十八朝政区沿革表</h2>
${renderTableFilterBar('tbl-genealogy', '筛选朝代、年号、政权或郡县州府…', allDynasties.length)}
        <div class="table-wrap">
          <table id="tbl-genealogy" class="data-table is-wide-table">
            <thead>
              <tr>
                <th>历史时期与年号</th>
                <th>所属政权</th>
                <th>州道省郡与郡县</th>
                <th>当期治所 / 邻近城邑</th>
              </tr>
            </thead>
            <tbody>
${genRows}
            </tbody>
          </table>
        </div>
      </section>${eventsSectionHtml}${personChipsHtml}

${renderFooter(allDynasties, { showDynastyChips: false, lang, mapBase })}
    </main>
  </div>
</body>
</html>
`;

  return {
    filename: `${slug}.html`,
    html,
    meta: {
      slug,
      modern: place.modern,
      displayTitleZh: place.displayTitleZh,
      en: place.en,
      regionGroup: place.regionGroup,
      tagZh: cityLore.tagZh,
      focusYear: focusY,
      coord: [lng, lat],
      capDynCount,
      eventCount: rawEvents.length,
      url: canonicalUrl,
      titleZh: `${place.displayTitleZh}`,
      titleEn: `${place.en} (${cityLore.tagEn})`,
      descZh: `${cityLore.tagZh} · ${capDynCount > 0 ? `图中${capDynCount}朝建都 · ` : ''}收录${rawEvents.length}项历史大事与18朝政区沿革`,
      descEn: `${cityLore.tagEn} · ${rawEvents.length} historical events & 18-era administrative genealogy`,
    },
  };
}

module.exports = { buildPlacePage };
