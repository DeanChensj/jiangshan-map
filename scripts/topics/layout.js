'use strict';

const { BASE_URL } = require('./config');
const { escHtml, fmtDynSpanZh } = require('./runtime');

function renderSharedHead({
  title,
  description,
  keywords,
  canonicalUrl,
  jsonLdObj,
  assetHashes,
}) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(description)}" />
  <meta name="keywords" content="${escHtml(keywords.join(', '))}" />
  <meta name="author" content="Jiangshan Atlas (江山时序)" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <meta name="applicable-device" content="pc,mobile" />
  <meta name="mobile-agent" content="format=html5;url=${escHtml(canonicalUrl)}" />
  <meta http-equiv="Cache-Control" content="no-transform" />
  <meta http-equiv="Cache-Control" content="no-siteapp" />
  <meta name="theme-color" content="#f3eee4" />
  <link rel="canonical" href="${escHtml(canonicalUrl)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="江山时序 · Jiangshan Historical Atlas" />
  <meta property="og:locale" content="zh_CN" />
  <meta property="og:locale:alternate" content="en_US" />
  <meta property="og:title" content="${escHtml(title)}" />
  <meta property="og:description" content="${escHtml(description)}" />
  <meta property="og:url" content="${escHtml(canonicalUrl)}" />
  <meta property="og:image" content="${BASE_URL}/assets/og_preview.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escHtml(title)}" />
  <meta name="twitter:description" content="${escHtml(description)}" />
  <meta name="twitter:image" content="${BASE_URL}/assets/og_preview.png" />
  <link rel="icon" type="image/svg+xml" href="../assets/favicon.svg" />
  <link rel="stylesheet" href="assets/topics.css?v=${escHtml(assetHashes.cssHash)}" />
  <script type="application/ld+json">
${JSON.stringify(jsonLdObj, null, 2)}
  </script>
  <script defer src="assets/topics.js?v=${escHtml(assetHashes.jsHash)}" data-v-hant="${escHtml(assetHashes.hantHash)}"></script>
  <script defer src="https://events.vercount.one/js"></script>
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "dc645937f75341b2a7416bd1fb81b635"}'></script>
</head>`;
}

function renderTopHeader({ activeNav = '' } = {}) {
  return `  <header class="top-bar">
    <div class="top-bar-inner">
      <a class="brand-link" href="../">
        <span class="seal-badge">江山时序</span>
        <span>历史舆图图志</span>
      </a>
      <nav class="top-nav" aria-label="专题图志导航">
        <a href="../">交互舆图</a>
        <a href="index.html"${activeNav === 'index' ? ' class="is-current"' : ''}>图志总览</a>
        <a href="persons.html"${activeNav === 'persons' ? ' class="is-current"' : ''}>人物志</a>
        <a href="https://github.com/DeanChensj/jiangshan-map" target="_blank" rel="noopener noreferrer">GitHub</a>
        <button id="act-topic-hant" class="hant-toggle-btn no-hant" type="button" aria-pressed="false" title="切換為繁體中文">繁</button>
      </nav>
    </div>
  </header>`;
}

function renderTocSidebar(tocItems, navFooterHtml = '') {
  if (!Array.isArray(tocItems) || !tocItems.length) return '';
  const itemsHtml = tocItems
    .map(
      (item, idx) =>
        `        <li><a class="toc-link${idx === 0 ? ' is-active' : ''}" href="#${escHtml(item.id)}">${escHtml(item.label)}</a></li>`
    )
    .join('\n');
  return `    <aside class="topic-toc" aria-label="本页目录">
      <div class="toc-heading">本页目录</div>
      <ul class="toc-list">
${itemsHtml}
      </ul>${navFooterHtml ? `\n      <div class="toc-prevnext">${navFooterHtml}</div>` : ''}
    </aside>`;
}

function renderEmbedMapSection({ id = 'sec-map', iframeSrc, titleZh, hintZh }) {
  return `      <section id="${escHtml(id)}" class="embed-card" aria-label="交互式历史地图预览">
        <div class="embed-header">
          <h2>${escHtml(titleZh)}</h2>
          <span class="embed-hint">${escHtml(hintZh || '点击地图即可缩放、拖拽或拨动底部时间轴')}</span>
        </div>
        <div class="embed-frame-wrap">
          <iframe class="embed-iframe" src="${escHtml(iframeSrc)}" title="${escHtml(titleZh)}" loading="lazy" allowfullscreen></iframe>
        </div>
      </section>`;
}

function renderTableFilterBar(tableId, placeholderZh, totalCount, { force = false } = {}) {
  if (!force && totalCount < 12) return '';
  return `        <div class="table-filter-bar">
          <input class="table-filter-input" type="search" data-filter-table="${escHtml(tableId)}" placeholder="${escHtml(placeholderZh)}" aria-label="${escHtml(placeholderZh)}" />
          <button class="table-filter-clear is-hidden" type="button" data-filter-clear="${escHtml(tableId)}">清除</button>
          <span class="table-filter-count" data-filter-count="${escHtml(tableId)}">共 ${totalCount} 项</span>
        </div>`;
}

function renderFilterPresetChips(tableId, presets) {
  if (!Array.isArray(presets) || !presets.length) return '';
  const btns = presets
    .map(
      (pr, idx) =>
        `<button type="button" class="filter-preset-btn${idx === 0 ? ' is-active' : ''}" data-filter-preset-table="${escHtml(tableId)}" data-filter-preset-val="${escHtml(pr.value)}">${escHtml(pr.label)}</button>`
    )
    .join('\n          ');
  return `        <div class="filter-preset-row">
          ${btns}
        </div>`;
}

function renderRelatedStrip(links) {
  if (!Array.isArray(links) || !links.length) return '';
  const chipsHtml = links
    .map(
      (lnk) =>
        `<a class="related-chip" href="${escHtml(lnk.href)}">${escHtml(lnk.label)}</a>`
    )
    .join('\n          ');
  return `        <div class="related-strip">
          <span>关联图志：</span>
          ${chipsHtml}
        </div>`;
}

function renderFooter(allDynasties) {
  const dynLinks = allDynasties
    .map(
      (d) =>
        `<a class="chip-link" href="${escHtml(d.key)}.html">${escHtml(d.title)}（${fmtDynSpanZh(d)}）</a>`
    )
    .join('\n          ');
  return `      <section class="section-card footer-nav-card">
        <h2>中国十八历史时期疆域图志速查（前403年—今）</h2>
        <div class="chip-grid">
          ${dynLinks}
        </div>
      </section>
      <footer class="page-footer">
        <div>© 江山时序（Jiangshan Historical Atlas）· <a href="../">deanchen.me/jiangshan-map</a> · 历史疆域与政区为示意性近似</div>
        <div><a href="index.html">专题图志总览</a> · <a href="../sitemap.xml">Sitemap</a> · <a href="../llms.txt">LLMs.txt</a> · <a href="mailto:deancsj@gmail.com">勘误反馈</a></div>
      </footer>`;
}

module.exports = {
  renderSharedHead,
  renderTopHeader,
  renderTocSidebar,
  renderEmbedMapSection,
  renderTableFilterBar,
  renderFilterPresetChips,
  renderRelatedStrip,
  renderFooter,
};
