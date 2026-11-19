#!/usr/bin/env node
/**
 * Programmatic Static Topic Monograph Generator for Jiangshan Historical Atlas (江山时序)
 *
 * Modular architecture under `scripts/topics/` + `data/topics/` + `topics/assets/`.
 * Generates all 39 static HTML pages (`topics/*.html`) and synchronizes `sitemap.xml`,
 * `index.html`, and `llms.txt`.
 *
 * Usage:
 *   node scripts/build_seo_topics.js          # Build & sync all topic pages in place
 *   node scripts/build_seo_topics.js --check  # Verify disk matches generated output byte-for-byte (CI)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { TOPICS_DIR, computeTopicAssetHashes } = require('./topics/config');
const { loadAtlasRuntime, loadSourcesBundle, loadTopicsData } = require('./topics/runtime');
const { buildDynastyPage } = require('./topics/pages/dynasty');
const { buildStorylinePage } = require('./topics/pages/story');
const { buildJourneyPage } = require('./topics/pages/journey');
const { buildFeaturedTopicPage } = require('./topics/pages/featured');
const { buildTopicsIndexPage } = require('./topics/pages/index_page');
const { computeSitemapXml, computeLlmsTxt, computeIndexHtml } = require('./topics/sync_site');

function generateAllOutputs() {
  const { ctrl, dynasties, snapshots, loreData, enLocale, provinces } = loadAtlasRuntime();
  const sourcesBundle = loadSourcesBundle();
  const { dynastyNotes, featuredTopics, geoOverrides } = loadTopicsData();
  const assetHashes = computeTopicAssetHashes();

  const stories = (loreData.PERSON_PROFILES || []).filter((p) => p && p.isStory);
  const journeys = loreData.HISTORICAL_JOURNEYS || [];
  const dynTitleByKey = new Map(dynasties.map((d) => [d.key, `${d.title}疆域政区图志`]));

  const linksByDynasty = new Map(dynasties.map((d) => [d.key, []]));
  const addDynRel = (dynKey, lnk) => {
    const arr = linksByDynasty.get(dynKey);
    if (arr && !arr.some((x) => x.href === lnk.href)) arr.push(lnk);
  };

  for (const s of stories) {
    const matchedKeys = new Set();
    if (s.dynastyKey) matchedKeys.add(s.dynastyKey);
    for (const st of s.stops || []) {
      if (st.dynastyKey) matchedKeys.add(st.dynastyKey);
    }
    for (const dk of matchedKeys) {
      addDynRel(dk, { href: `story-${s.key}.html`, label: `沙盘：${s.zh}` });
    }
  }

  for (const j of journeys) {
    const years = (j.stops || []).map((s) => s.year).filter((y) => typeof y === 'number');
    for (const d of dynasties) {
      if (years.some((y) => y >= d.fromYear && y <= d.toYear)) {
        addDynRel(d.key, { href: `journey-${j.key}.html`, label: `行迹：${j.shortZh}` });
      }
    }
  }

  for (const t of featuredTopics) {
    for (const dk of t.dynastyKeys || []) {
      addDynRel(dk, { href: `${t.slug}.html`, label: `专题：${t.shortZh.split('（')[0]}` });
    }
  }

  const dynPages = dynasties.map((d, idx) =>
    buildDynastyPage({
      d,
      idx,
      allDynasties: dynasties,
      snapshots,
      enLocale,
      ctrl,
      provinces,
      sourcesBundle,
      dynastyNotes,
      relatedLinks: linksByDynasty.get(d.key) || [],
      assetHashes,
    })
  );

  const storyPages = stories.map((s, idx) => {
    const relDynKeys = Array.from(
      new Set([s.dynastyKey, ...(s.stops || []).map((st) => st.dynastyKey)].filter(Boolean))
    );
    const relatedLinks = relDynKeys
      .filter((k) => dynTitleByKey.has(k))
      .map((k) => ({ href: `${k}.html`, label: dynTitleByKey.get(k) }));
    for (const ft of featuredTopics) {
      if ((ft.relatedSlugs || []).includes(`story-${s.key}`)) {
        relatedLinks.push({ href: `${ft.slug}.html`, label: `专题：${ft.shortZh.split('（')[0]}` });
      }
    }
    return buildStorylinePage({
      s,
      idx,
      allStories: stories,
      allDynasties: dynasties,
      sourcesBundle,
      relatedLinks,
      assetHashes,
    });
  });

  const journeyPages = journeys.map((j, idx) => {
    const years = (j.stops || []).map((s) => s.year).filter((y) => typeof y === 'number');
    const relatedLinks = dynasties
      .filter((d) => years.some((y) => y >= d.fromYear && y <= d.toYear))
      .map((d) => ({ href: `${d.key}.html`, label: dynTitleByKey.get(d.key) }));
    for (const ft of featuredTopics) {
      if ((ft.relatedSlugs || []).includes(`journey-${j.key}`)) {
        relatedLinks.push({ href: `${ft.slug}.html`, label: `专题：${ft.shortZh.split('（')[0]}` });
      }
    }
    return buildJourneyPage({
      j,
      idx,
      allJourneys: journeys,
      allDynasties: dynasties,
      sourcesBundle,
      relatedLinks,
      assetHashes,
    });
  });

  const featuredPages = featuredTopics.map((topic) => {
    const relatedLinks = [];
    for (const dk of topic.dynastyKeys || []) {
      if (dynTitleByKey.has(dk)) {
        relatedLinks.push({ href: `${dk}.html`, label: dynTitleByKey.get(dk) });
      }
    }
    for (const rs of topic.relatedSlugs || []) {
      const sHit = stories.find((x) => `story-${x.key}` === rs);
      if (sHit) relatedLinks.push({ href: `${rs}.html`, label: `沙盘：${sHit.zh}` });
      const jHit = journeys.find((x) => `journey-${x.key}` === rs);
      if (jHit) relatedLinks.push({ href: `${rs}.html`, label: `行迹：${jHit.titleZh}` });
    }
    return buildFeaturedTopicPage({
      topic,
      allDynasties: dynasties,
      ctrl,
      geoOverrides,
      relatedLinks,
      assetHashes,
    });
  });

  const dynMeta = dynPages.map((p) => p.meta);
  const storyMeta = storyPages.map((p) => p.meta);
  const journeyMeta = journeyPages.map((p) => p.meta);
  const featuredMeta = featuredPages.map((p) => p.meta);

  const indexPage = buildTopicsIndexPage({
    dynMeta,
    storyMeta,
    journeyMeta,
    featuredMeta,
    allDynasties: dynasties,
    assetHashes,
  });

  const allTopicPages = [...dynPages, ...storyPages, ...journeyPages, ...featuredPages, indexPage];
  const sitemapRes = computeSitemapXml(dynMeta, storyMeta, journeyMeta, featuredMeta);
  const llmsRes = computeLlmsTxt(dynasties, snapshots, loreData);
  const indexHtmlRes = computeIndexHtml(
    dynMeta,
    storyMeta,
    journeyMeta,
    featuredMeta,
    dynasties,
    snapshots,
    loreData,
    enLocale
  );

  return {
    allTopicPages,
    counts: {
      dyn: dynPages.length,
      story: storyPages.length,
      journey: journeyPages.length,
      featured: featuredPages.length,
      sitemapUrls: sitemapRes.addedCount,
    },
    extraFiles: [sitemapRes, llmsRes, indexHtmlRes].filter(Boolean),
  };
}

function runCheck(outputs) {
  const drift = [];
  const expectedNames = new Set(outputs.allTopicPages.map((p) => p.filename));

  if (!fs.existsSync(TOPICS_DIR)) {
    console.error('✗ Missing topics/ directory');
    return 1;
  }

  for (const name of fs.readdirSync(TOPICS_DIR)) {
    if (name.endsWith('.html') && !expectedNames.has(name)) {
      drift.push(`orphan topics/${name}`);
    }
  }

  for (const page of outputs.allTopicPages) {
    const full = path.join(TOPICS_DIR, page.filename);
    if (!fs.existsSync(full)) {
      drift.push(`missing topics/${page.filename}`);
      continue;
    }
    const disk = fs.readFileSync(full, 'utf8');
    if (disk !== page.html) {
      drift.push(`stale topics/${page.filename}`);
    }
  }

  for (const f of outputs.extraFiles) {
    if (!fs.existsSync(f.path) || fs.readFileSync(f.path, 'utf8') !== f.content) {
      drift.push(`stale ${path.relative(path.resolve(__dirname, '..'), f.path)}`);
    }
  }

  if (drift.length) {
    console.error(`✗ Topic pages are out of sync (${drift.length} issue${drift.length > 1 ? 's' : ''}):`);
    for (const d of drift.slice(0, 20)) console.error(`  - ${d}`);
    if (drift.length > 20) console.error(`  ... and ${drift.length - 20} more`);
    console.error('Run `node scripts/build_seo_topics.js` to synchronize.');
    return 1;
  }

  const { counts } = outputs;
  console.log(
    `✓ All ${counts.dyn + counts.story + counts.journey + counts.featured + 1} topic pages, sitemap.xml, index.html, and llms.txt are up to date`
  );
  return 0;
}

function runWrite(outputs) {
  fs.mkdirSync(TOPICS_DIR, { recursive: true });
  for (const page of outputs.allTopicPages) {
    const full = path.join(TOPICS_DIR, page.filename);
    if (!fs.existsSync(full) || fs.readFileSync(full, 'utf8') !== page.html) {
      fs.writeFileSync(full, page.html, 'utf8');
    }
  }
  for (const f of outputs.extraFiles) {
    if (!fs.existsSync(f.path) || fs.readFileSync(f.path, 'utf8') !== f.content) {
      fs.writeFileSync(f.path, f.content, 'utf8');
    }
  }
  const { counts } = outputs;
  console.log(
    `✓ Generated ${counts.dyn} dynasty pages, ${counts.story} storyline pages, ${counts.journey} journey pages, ${counts.featured} featured poetry/battle pages, and topics/index.html (${counts.sitemapUrls} static URLs added to sitemap.xml)`
  );
  return 0;
}

if (require.main === module) {
  const isCheck = process.argv.includes('--check');
  const outputs = generateAllOutputs();
  process.exitCode = isCheck ? runCheck(outputs) : runWrite(outputs);
}

module.exports = { generateAllOutputs };
