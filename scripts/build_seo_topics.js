#!/usr/bin/env node
/**
 * Programmatic Static Topic Monograph Generator for Jiangshan Historical Atlas (江山时序)
 *
 * Modular architecture under `scripts/topics/` + `data/topics/` + `topics/assets/`.
 * Generates all static HTML pages (`topics/*.html`, including dynasty, story, journey,
 * featured, person/relic monographs, `index.html`, and `persons.html`) and synchronizes
 * `sitemap.xml`, `index.html`, and `llms.txt`.
 *
 * Usage:
 *   node scripts/build_seo_topics.js          # Build & sync all topic pages in place
 *   node scripts/build_seo_topics.js --check  # Verify disk matches generated output byte-for-byte (CI)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { TOPICS_DIR, computeTopicAssetHashes, isStandalonePersonMonograph } = require('./topics/config');
const { loadAtlasRuntime, loadSourcesBundle, loadTopicsData, fmtYearShortZh } = require('./topics/runtime');
const { buildDynastyPage } = require('./topics/pages/dynasty');
const { buildStorylinePage } = require('./topics/pages/story');
const { buildJourneyPage } = require('./topics/pages/journey');
const { buildFeaturedTopicPage } = require('./topics/pages/featured');
const { buildPersonPage } = require('./topics/pages/person');
const { buildPersonsIndexPage } = require('./topics/pages/persons_index');
const { buildPlacePage } = require('./topics/pages/place');
const { buildPlacesIndexPage } = require('./topics/pages/places_index');
const { buildTopicsIndexPage } = require('./topics/pages/index_page');
const { computeSitemapXml, computeLlmsTxt, computeIndexHtml } = require('./topics/sync_site');

function buildPeerCooccurrenceMap(stdPersons, dynasties, loreData, eventsByKey, ctrl) {
  const stdByKey = new Map(stdPersons.map((p) => [p.key, p]));
  const pairTokens = new Map();

  const addEncounter = (kA, kB, year, coord) => {
    if (!kA || !kB || kA === kB || !stdByKey.has(kA) || !stdByKey.has(kB)) return;
    const pA = stdByKey.get(kA);
    const pB = stdByKey.get(kB);
    if (!pA.span || !pB.span || pA.span[0] > pB.span[1] || pB.span[0] > pA.span[1]) return;
    const pairKey = kA < kB ? `${kA}|${kB}` : `${kB}|${kA}`;
    let set = pairTokens.get(pairKey);
    if (!set) {
      set = new Set();
      pairTokens.set(pairKey, set);
    }
    const lonQ = coord ? Math.round(coord[0] * 4) : 0;
    const latQ = coord ? Math.round(coord[1] * 4) : 0;
    set.add(`${year}:${lonQ},${latQ}`);
  };

  for (const d of dynasties) {
    for (const m of d.milestones || []) {
      const pList = Array.isArray(m.persons) ? m.persons.filter((k) => stdByKey.has(k)) : [];
      for (let i = 0; i < pList.length; i++) {
        for (let j = i + 1; j < pList.length; j++) {
          addEncounter(pList[i], pList[j], m.year, m.coord);
        }
      }
    }
  }

  for (const lm of loreData.PLACE_LANDMARK_EVENTS || []) {
    const pList = Array.isArray(lm.persons) ? lm.persons.filter((k) => stdByKey.has(k)) : [];
    for (let i = 0; i < pList.length; i++) {
      for (let j = i + 1; j < pList.length; j++) {
        addEncounter(pList[i], pList[j], lm.year, lm.coord);
      }
    }
  }

  for (let i = 0; i < stdPersons.length; i++) {
    const a = stdPersons[i];
    const evsA = eventsByKey.get(a.key) || [];
    for (let j = i + 1; j < stdPersons.length; j++) {
      const b = stdPersons[j];
      if (!a.span || !b.span || a.span[0] > b.span[1] || b.span[0] > a.span[1]) continue;
      const evsB = eventsByKey.get(b.key) || [];
      for (const evA of evsA) {
        if (!evA.coord) continue;
        for (const evB of evsB) {
          if (evA.year !== evB.year || !evB.coord) continue;
          if (ctrl.projector.greatCircleKm(evA.coord, evB.coord) <= 35) {
            const avgCoord = [(evA.coord[0] + evB.coord[0]) / 2, (evA.coord[1] + evB.coord[1]) / 2];
            addEncounter(a.key, b.key, evA.year, avgCoord);
          }
        }
      }
    }
  }

  const peersByKey = new Map(stdPersons.map((p) => [p.key, []]));
  for (const [pairKey, tokens] of pairTokens.entries()) {
    const [kA, kB] = pairKey.split('|');
    const sharedCount = tokens.size;
    if (sharedCount < 1) continue;
    const pA = stdByKey.get(kA);
    const pB = stdByKey.get(kB);
    peersByKey.get(kA).push({ ...pB, sharedCount });
    peersByKey.get(kB).push({ ...pA, sharedCount });
  }

  for (const [k, list] of peersByKey.entries()) {
    list.sort(
      (a, b) =>
        b.sharedCount - a.sharedCount ||
        (b.evCount || 0) - (a.evCount || 0) ||
        a.key.localeCompare(b.key)
    );
    peersByKey.set(k, list.slice(0, 8));
  }
  return peersByKey;
}

function generateAllOutputs() {
  const { ctrl, dynasties, snapshots, loreData, enLocale, provinces } = loadAtlasRuntime();
  const sourcesBundle = loadSourcesBundle();
  const { dynastyNotes, featuredTopics, geoOverrides, placesCatalog } = loadTopicsData();
  const assetHashes = computeTopicAssetHashes();

  const allProfiles = loreData.PERSON_PROFILES || [];
  const stories = allProfiles.filter((p) => p && p.isStory);
  const journeys = loreData.HISTORICAL_JOURNEYS || [];
  const dynTitleByKey = new Map(dynasties.map((d) => [d.key, `${d.title}疆域政区图志`]));

  const standalonePersons = allProfiles
    .filter(isStandalonePersonMonograph)
    .sort((a, b) => {
      const aY = Array.isArray(a.span) ? a.span[0] : 0;
      const bY = Array.isArray(b.span) ? b.span[0] : 0;
      return aY - bY || a.key.localeCompare(b.key);
    });

  const allNonStoryPersons = allProfiles.filter((p) => p && !p.isStory);
  const eventsByKey = new Map();
  for (const p of allNonStoryPersons) {
    eventsByKey.set(p.key, ctrl._collectPersonEvents(p));
  }

  const stdPersonsForPeers = allNonStoryPersons.filter((p) => !p.isRelic);
  const peersByKey = buildPeerCooccurrenceMap(
    stdPersonsForPeers,
    dynasties,
    loreData,
    eventsByKey,
    ctrl
  );

  const linksByDynasty = new Map(dynasties.map((d) => [d.key, []]));
  const addDynRel = (dynKey, lnk) => {
    const arr = linksByDynasty.get(dynKey);
    if (arr && !arr.some((x) => x.href === lnk.href)) arr.push(lnk);
  };

  const personLinksByDynasty = new Map(dynasties.map((d) => [d.key, []]));
  const addDynPersonLink = (dynKey, lnk) => {
    const arr = personLinksByDynasty.get(dynKey);
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
        addDynPersonLink(d.key, {
          href: `journey-${j.key}.html`,
          label: `行迹：${j.titleZh}`,
        });
      }
    }
  }

  for (const p of standalonePersons) {
    if (p.dynastyKey) {
      const span = Array.isArray(p.span) ? p.span : [0, 0];
      const lbl = p.isRelic
        ? `国器：${p.zh}`
        : `${p.zh}（${fmtYearShortZh(span[0])}—${fmtYearShortZh(span[1])}）`;
      addDynPersonLink(p.dynastyKey, {
        href: `person-${p.key}.html`,
        label: lbl,
      });
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
      personLinks: personLinksByDynasty.get(d.key) || [],
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

  const standaloneForNav = standalonePersons;
  const personBuildItems = standaloneForNav.map((profile, idx) => {
    const evs = eventsByKey.get(profile.key) || [];
    const relLinks = [];
    const seenHref = new Set();
    const addLink = (href, label) => {
      if (href && !seenHref.has(href)) {
        seenHref.add(href);
        relLinks.push({ href, label });
      }
    };

    const dynKeys = [];
    if (profile.dynastyKey && dynTitleByKey.has(profile.dynastyKey)) {
      dynKeys.push(profile.dynastyKey);
    }
    for (const ev of evs) {
      const dk = ev.dynasty && ev.dynasty.key;
      if (dk && dynTitleByKey.has(dk) && !dynKeys.includes(dk)) dynKeys.push(dk);
    }
    for (const dk of dynKeys.slice(0, 3)) {
      addLink(`${dk}.html`, dynTitleByKey.get(dk));
    }

    for (const s of stories) {
      const mentions = (s.stops || []).some(
        (st) =>
          (st.descZh || '').includes(profile.zh) ||
          (st.titleZh || '').includes(profile.zh) ||
          (Array.isArray(st.actors) &&
            st.actors.some((ac) => ac.personKey === profile.key || (ac.zh || '').includes(profile.zh)))
      );
      if (mentions || (s.descZh || '').includes(profile.zh) || (s.zh || '').includes(profile.zh)) {
        addLink(`story-${s.key}.html`, `沙盘：${s.zh}`);
      }
    }

    for (const ft of featuredTopics) {
      if (
        (ft.titleZh || '').includes(profile.zh) ||
        (ft.summaryZh || '').includes(profile.zh)
      ) {
        addLink(`${ft.slug}.html`, `专题：${ft.shortZh.split('（')[0]}`);
      }
    }

    const built = buildPersonPage({
      profile,
      idx,
      allStandalonePersons: standaloneForNav,
      events: evs,
      allDynasties: dynasties,
      ctrl,
      enLocale,
      loreData,
      sourcesBundle,
      peers: profile.isRelic ? [] : peersByKey.get(profile.key) || [],
      relatedLinks: relLinks,
      assetHashes,
    });
    return { profile, ...built };
  });

  const personPages = personBuildItems.map(({ filename, html, meta }) => ({ filename, html, meta }));

  const directoryOnlyPersons = allNonStoryPersons
    .filter((p) => !p.journeyKey && !isStandalonePersonMonograph(p))
    .sort((a, b) => {
      const aY = Array.isArray(a.span) ? a.span[0] : 0;
      const bY = Array.isArray(b.span) ? b.span[0] : 0;
      return aY - bY || a.key.localeCompare(b.key);
    })
    .map((profile) => ({
      profile,
      eventCount: (eventsByKey.get(profile.key) || []).length,
    }));

  const personsIndexPage = buildPersonsIndexPage({
    journeys,
    personMonographItems: personBuildItems,
    directoryOnlyPersons,
    allDynasties: dynasties,
    assetHashes,
  });

  const cityLoreList = loreData.CITY_LORE || [];
  const cityLoreByModern = new Map(cityLoreList.map((c) => [c.modern, c]));
  const strategicPasses = loreData.STRATEGIC_PASSES || [];

  const placeBuildItems = placesCatalog.map((place, idx) => {
    const cityLore = cityLoreByModern.get(place.modern);
    if (!cityLore) {
      throw new Error(`Missing CITY_LORE entry for place "${place.modern}" (${place.slug})`);
    }

    const personHits = [];
    for (const p of allNonStoryPersons) {
      const evs = eventsByKey.get(p.key) || [];
      let hits = 0;
      for (const ev of evs) {
        if (ev.coord && ctrl.projector.greatCircleKm(cityLore.coord, ev.coord) <= 35) {
          hits++;
        }
      }
      if (hits > 0) {
        personHits.push({
          key: p.key,
          zh: p.zh,
          hits,
          evCount: p.evCount || 0,
          href: p.journeyKey
            ? `journey-${p.journeyKey}.html`
            : isStandalonePersonMonograph(p)
              ? `person-${p.key}.html`
              : `../?person=${encodeURIComponent(p.key)}`,
        });
      }
    }
    personHits.sort(
      (a, b) => b.hits - a.hits || b.evCount - a.evCount || a.key.localeCompare(b.key)
    );
    const linkedPersons = personHits.slice(0, 12);

    const placeRelLinks = [];
    const seenRelHref = new Set();
    const addPlaceRel = (href, label) => {
      if (href && !seenRelHref.has(href)) {
        seenRelHref.add(href);
        placeRelLinks.push({ href, label });
      }
    };
    const baseTitleZh = String(place.displayTitleZh || '').split('（')[0];

    for (const j of journeys) {
      const hitStop = (j.stops || []).some(
        (st) => st.coord && ctrl.projector.greatCircleKm(cityLore.coord, st.coord) <= 35
      );
      if (hitStop) {
        addPlaceRel(`journey-${j.key}.html`, `行迹：${j.shortZh}`);
      }
    }
    for (const s of stories) {
      const hitStop = (s.stops || []).some(
        (st) => st.coord && ctrl.projector.greatCircleKm(cityLore.coord, st.coord) <= 35
      );
      if (hitStop) {
        addPlaceRel(`story-${s.key}.html`, `沙盘：${s.zh}`);
      }
    }
    for (const ft of featuredTopics) {
      const txt = `${ft.titleZh || ''} ${ft.summaryZh || ''}`;
      if (
        (place.modern && txt.includes(place.modern)) ||
        (baseTitleZh.length >= 2 && txt.includes(baseTitleZh))
      ) {
        addPlaceRel(`${ft.slug}.html`, `专题：${ft.shortZh.split('（')[0]}`);
      }
    }

    const built = buildPlacePage({
      place,
      idx,
      allPlaces: placesCatalog,
      cityLore,
      allDynasties: dynasties,
      ctrl,
      loreData,
      sourcesBundle,
      geoOverrides,
      linkedPersons,
      relatedLinks: placeRelLinks.slice(0, 6),
      assetHashes,
    });
    return { place, ...built };
  });

  const placePages = placeBuildItems.map(({ filename, html, meta }) => ({ filename, html, meta }));

  const placesIndexPage = buildPlacesIndexPage({
    placeMonographItems: placeBuildItems,
    cityLoreList,
    strategicPasses,
    allDynasties: dynasties,
    loreData,
    ctrl,
    assetHashes,
  });

  const dynMeta = dynPages.map((p) => p.meta);
  const storyMeta = storyPages.map((p) => p.meta);
  const journeyMeta = journeyPages.map((p) => p.meta);
  const featuredMeta = featuredPages.map((p) => p.meta);
  const personMeta = personPages.map((p) => p.meta);
  const placeMeta = placePages.map((p) => p.meta);

  const indexPage = buildTopicsIndexPage({
    dynMeta,
    storyMeta,
    journeyMeta,
    featuredMeta,
    personMeta,
    placeMeta,
    totalPersonDirectoryCount: allNonStoryPersons.length,
    totalCitiesCount: cityLoreList.length,
    totalPassesCount: strategicPasses.length,
    allDynasties: dynasties,
    assetHashes,
  });

  const allTopicPages = [
    ...dynPages,
    ...storyPages,
    ...journeyPages,
    ...featuredPages,
    ...personPages,
    ...placePages,
    personsIndexPage,
    placesIndexPage,
    indexPage,
  ];
  const sitemapRes = computeSitemapXml(
    dynMeta,
    storyMeta,
    journeyMeta,
    featuredMeta,
    personMeta,
    placeMeta
  );
  const llmsRes = computeLlmsTxt(dynasties, snapshots, loreData);
  const indexHtmlRes = computeIndexHtml(
    dynMeta,
    storyMeta,
    journeyMeta,
    featuredMeta,
    dynasties,
    snapshots,
    loreData,
    enLocale,
    personMeta,
    placeMeta
  );

  return {
    allTopicPages,
    counts: {
      dyn: dynPages.length,
      story: storyPages.length,
      journey: journeyPages.length,
      featured: featuredPages.length,
      person: personPages.length,
      place: placePages.length,
      directoryOnly: directoryOnlyPersons.length,
      totalNonStoryPersons: allNonStoryPersons.length,
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
  const totalPages =
    counts.dyn + counts.story + counts.journey + counts.featured + counts.person + counts.place + 3;
  console.log(
    `✓ All ${totalPages} topic pages, sitemap.xml, index.html, and llms.txt are up to date`
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
    `✓ Generated ${counts.dyn} dynasty pages, ${counts.story} storyline pages, ${counts.journey} journey pages, ${counts.featured} featured pages, ${counts.person} person/relic pages, ${counts.place} place pages, persons.html, places.html, and index.html (${counts.sitemapUrls} static URLs added to sitemap.xml)`
  );
  return 0;
}

if (require.main === module) {
  const isCheck = process.argv.includes('--check');
  const outputs = generateAllOutputs();
  process.exitCode = isCheck ? runCheck(outputs) : runWrite(outputs);
}

module.exports = { generateAllOutputs };
