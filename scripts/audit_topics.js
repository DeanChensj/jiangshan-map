#!/usr/bin/env node
/**
 * Static Topic Monograph Integrity & Historical Invariant Auditor (Jiangshan Atlas)
 *
 * Verifies:
 *   1. Structured topic data JSON schemas (`data/topics/*.json`).
 *   2. Shared asset hashes (`topics/assets/topics.css`, `topics.js`, `js/zh_hant.js`) and zero inline `<style>`.
 *   3. Zero broken relative/canonical/in-page-anchor links and valid `?year=/person=/event=/stop=/from=/to=` deep-links.
 *   4. Zero rendering artifacts (`undefined`, `NaN`, `[object Object]`, empty `<tbody>`) or leaked editorial `r.note`.
 *   5. Historical & geographical invariants (wudai era boundaries, Changping/Chibi/Jingkou/Huizhou/Lingdingyang accuracy).
 *
 * Usage:
 *   node scripts/audit_topics.js [--check]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  ROOT,
  TOPICS_DIR,
  TOPICS_ASSETS_DIR,
  BASE_URL,
  computeTopicAssetHashes,
  isStandalonePersonMonograph,
} = require('./topics/config');
const { loadAtlasRuntime, loadSourcesBundle, loadTopicsData } = require('./topics/runtime');

function auditAllTopics() {
  const errors = [];
  const fail = (ctx, msg) => errors.push(`[${ctx}] ${msg}`);

  const { ctrl, dynasties, loreData } = loadAtlasRuntime();
  const sourcesBundle = loadSourcesBundle();
  const { dynastyNotes, featuredTopics, geoOverrides, placesCatalog } = loadTopicsData();
  const assetHashes = computeTopicAssetHashes();

  // 1. Validate structured data schemas
  for (const d of dynasties) {
    const notes = dynastyNotes[d.key];
    if (!Array.isArray(notes) || notes.length === 0) {
      fail('data/topics/dynasty_notes.json', `Missing cartographic notes for dynasty "${d.key}"`);
    } else {
      for (const n of notes) {
        if (!n || !n.title || !n.detail) {
          fail('data/topics/dynasty_notes.json', `Empty title/detail note in "${d.key}"`);
        }
      }
    }
  }

  const dynKeySet = new Set(dynasties.map((d) => d.key));
  const seenSlugs = new Set();
  for (const t of featuredTopics) {
    if (!t.slug || seenSlugs.has(t.slug)) {
      fail('data/topics/featured_topics.json', `Duplicate or empty slug "${t.slug}"`);
    }
    seenSlugs.add(t.slug);
    if (!t.inspectQuery || !t.inspectQuery.year || !t.inspectQuery.place) {
      fail('data/topics/featured_topics.json', `Invalid inspectQuery on "${t.slug}"`);
    }
    if (!Array.isArray(t.dynastyKeys) || t.dynastyKeys.length === 0) {
      fail('data/topics/featured_topics.json', `Missing dynastyKeys on "${t.slug}"`);
    } else {
      for (const dk of t.dynastyKeys) {
        if (!dynKeySet.has(dk)) {
          fail('data/topics/featured_topics.json', `Unknown dynastyKey "${dk}" on "${t.slug}"`);
        }
      }
    }
  }
  if (!geoOverrides || !geoOverrides.nearestCity || !geoOverrides.placeDynastyAdminOverrides) {
    fail('data/topics/geo_overrides.json', 'Missing required sections in geo_overrides.json');
  }

  const cityLoreList = loreData.CITY_LORE || [];
  const cityLoreModerns = new Set(cityLoreList.map((c) => c.modern));
  const strategicPasses = loreData.STRATEGIC_PASSES || [];
  const seenPlaceSlugs = new Set();
  for (const pl of placesCatalog || []) {
    if (!pl.slug || seenPlaceSlugs.has(pl.slug)) {
      fail('data/topics/places.json', `Duplicate or empty slug "${pl.slug}"`);
    }
    seenPlaceSlugs.add(pl.slug);
    if (!cityLoreModerns.has(pl.modern)) {
      fail('data/topics/places.json', `Unknown CITY_LORE.modern "${pl.modern}" on "${pl.slug}"`);
    }
    if (!Number.isInteger(pl.focusYear) || pl.focusYear < dynasties[0].fromYear || pl.focusYear > 2026) {
      fail('data/topics/places.json', `Invalid focusYear "${pl.focusYear}" on "${pl.slug}"`);
    }
  }

  // 2. Check shared assets exist and guard against scroll-hijack regressions
  for (const rel of ['topics.css', 'topics.js']) {
    const assetPath = path.join(TOPICS_ASSETS_DIR, rel);
    if (!fs.existsSync(assetPath)) {
      fail('topics/assets', `Missing shared asset topics/assets/${rel}`);
    } else if (rel === 'topics.js') {
      const jsSrc = fs.readFileSync(assetPath, 'utf8');
      if (jsSrc.includes('.scrollIntoView(')) {
        fail('topics/assets/topics.js', 'Must not call .scrollIntoView() inside TOC scroll-spy (breaks mobile page scrolling)');
      }
    }
  }

  // Build valid entity maps for deep-link checking
  const persons = loreData.PERSON_PROFILES || [];
  const journeys = loreData.HISTORICAL_JOURNEYS || [];
  const personKeys = new Set(persons.map((p) => p.key));
  const personByKey = new Map(persons.map((p) => [p.key, p]));
  const journeyByKey = new Map(journeys.map((j) => [j.key, j]));
  const storyByKey = new Map(persons.filter((p) => p && p.isStory).map((s) => [s.key, s]));
  const standalonePersons = persons.filter(isStandalonePersonMonograph);
  const standalonePersonBySlug = new Map(standalonePersons.map((p) => [`person-${p.key}.html`, p]));
  const nonStoryPersons = persons.filter((p) => p && !p.isStory);
  const personEventCountCache = new Map();
  const getPersonEventCount = (pk) => {
    if (personEventCountCache.has(pk)) return personEventCountCache.get(pk);
    const prof = personByKey.get(pk);
    const n = prof ? ctrl._collectPersonEvents(prof).length : 0;
    personEventCountCache.set(pk, n);
    return n;
  };

  // Collect all editorial r.note strings from data/sources/ (>= 8 chars to avoid trivial word collisions)
  const rawNotes = new Set();
  for (const list of sourcesBundle.refs.values()) {
    for (const r of list) {
      const note = (r.note || '').trim();
      if (note.length >= 8) rawNotes.add(note);
    }
  }

  const htmlFiles = fs
    .readdirSync(TOPICS_DIR)
    .filter((f) => f.endsWith('.html'))
    .sort();
  const htmlFileSet = new Set(htmlFiles);

  const placeSlugSet = new Set((placesCatalog || []).map((pl) => `place-${pl.slug}.html`));

  const expectedPageTotal =
    dynasties.length +
    storyByKey.size +
    journeys.length +
    featuredTopics.length +
    standalonePersons.length +
    (placesCatalog || []).length +
    3;
  if (htmlFiles.length !== expectedPageTotal) {
    fail('topics/', `Unexpected HTML file count: ${htmlFiles.length} (expected ${expectedPageTotal})`);
  }

  const minY = dynasties[0].fromYear;
  const maxY = 2026;
  const expectedCssRef = `assets/topics.css?v=${assetHashes.cssHash}`;
  const expectedJsRef = `assets/topics.js?v=${assetHashes.jsHash}`;
  const expectedHantAttr = `data-v-hant="${assetHashes.hantHash}"`;

  const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const parseTableRows = (tableHtml) => {
    const bodyMatch = tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/);
    if (!bodyMatch) return [];
    return [...bodyMatch[1].matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/g)].map((m) =>
      [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((td) => td[1])
    );
  };

  for (const f of htmlFiles) {
    const html = fs.readFileSync(path.join(TOPICS_DIR, f), 'utf8');

    // Shell & shared asset checks
    if (/<style\b/i.test(html)) fail(f, 'Inline <style> tag found; must use shared topics/assets/topics.css');
    if (!html.includes(expectedCssRef)) fail(f, `Missing or stale CSS reference (expected ${expectedCssRef})`);
    if (!html.includes(expectedJsRef)) fail(f, `Missing or stale JS reference (expected ${expectedJsRef})`);
    if (!html.includes(expectedHantAttr)) fail(f, `Missing or stale data-v-hant hash (${expectedHantAttr})`);
    if (!html.includes(`rel="canonical" href="${BASE_URL}/topics/${f}"`)) fail(f, 'Missing or mismatched canonical link');
    if (!html.includes('application/ld+json')) fail(f, 'Missing JSON-LD structured data');
    if (f !== 'index.html' && f !== 'persons.html' && f !== 'places.html' && !html.includes('../?embed=1&')) {
      fail(f, 'Missing ?embed=1 preview iframe');
    }

    // Placeholder / broken render tokens
    if (html.includes('undefined')) fail(f, 'Contains literal "undefined"');
    if (/\bNaN\b/.test(html)) fail(f, 'Contains literal "NaN"');
    if (html.includes('[object Object]')) fail(f, 'Contains "[object Object]"');
    if (html.toLowerCase().includes('deanchensj.github.io')) fail(f, 'Contains legacy github.io URL');

    // Empty tbody check & duplicate first/last column URL check
    const extractFirstHref = (cellHtml) => {
      const m = String(cellHtml || '').match(/<a\b[^>]*\bhref="([^"]+)"/);
      return m ? m[1].replace(/&amp;/g, '&') : '';
    };
    const tbodies = [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)];
    for (const tb of tbodies) {
      if (!tb[1].includes('<tr')) fail(f, 'Contains empty <tbody> without table rows');
      for (const trMatch of tb[1].matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/g)) {
        const tds = [...trMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
        if (tds.length >= 2) {
          const firstHref = extractFirstHref(tds[0]);
          const lastHref = extractFirstHref(tds[tds.length - 1]);
          if (firstHref && lastHref && firstHref === lastHref) {
            fail(f, `Duplicate first/last column URL "${firstHref}" in table row`);
          }
        }
      }
    }

    // Simplified Chinese body hygiene (keep English in meta/JSON-LD/data-search, never in visible body)
    if (
      /class="[^"]*\b(?:en-sub|stop-sub-en)\b/.test(html) ||
      html.includes('Open in English') ||
      html.includes('Play in English') ||
      html.includes('（中英对照）') ||
      html.includes('函数古道')
    ) {
      fail(f, 'Contains banned inline bilingual clutter or typo (en-sub/Open in English/中英对照/函数古道)');
    }

    if (!dynKeySet.has(f.replace('.html', '')) && html.includes('footer-nav-card')) {
      fail(f, 'Unexpected footer-nav-card dynasty chips on non-dynasty page');
    }

    if (
      /class="[^"]*\b(?:kicker|stop-badge)\b/.test(html) ||
      html.includes('href="../sitemap.xml"') ||
      html.includes('href="../llms.txt"')
    ) {
      fail(f, 'Contains pruned UI clutter (.kicker/.stop-badge or crawler footer links)');
    }

    const tocMatch = html.match(/<aside class="topic-toc"[\s\S]*?<\/aside>/);
    if (tocMatch) {
      const tocLinks = tocMatch[0].match(/class="toc-link/g) || [];
      if (tocLinks.length < 3) {
        fail(f, `Short page must omit .topic-toc when TOC links < 3 (found ${tocLinks.length})`);
      }
    }

    const relStripMatch = html.match(/<div class="related-strip">([\s\S]*?)<\/div>/);
    const secPersonsMatch = html.match(/<section id="sec-persons"[\s\S]*?<\/section>/);
    if (relStripMatch && secPersonsMatch) {
      const relJourneys = new Set(
        [...relStripMatch[1].matchAll(/href="(journey-[^"]+\.html)"/g)].map((m) => m[1])
      );
      for (const m of secPersonsMatch[0].matchAll(/href="(journey-[^"]+\.html)"/g)) {
        if (relJourneys.has(m[1])) {
          fail(f, `Duplicate journey link "${m[1]}" in both .related-strip and #sec-persons`);
        }
      }
    }

    if (f === 'index.html' && (html.includes('，在…') || html.includes('，赵…'))) {
      fail(f, 'Truncated mid-clause summary artifact leaked in topics/index.html');
    }

    // Editorial r.note leakage check inside .source-cite
    for (const sc of html.matchAll(/<div class="source-cite">([\s\S]*?)<\/div>/g)) {
      const scText = stripTags(sc[1]);
      for (const note of rawNotes) {
        if (scText.includes(note)) {
          fail(f, `Leaked raw editorial note in source citation: "${note}"`);
        }
      }
    }

    // ID set for in-page anchor checks
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

    // Validate all href / src attributes
    for (const attrMatch of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const rawUrl = attrMatch[1].replace(/&amp;/g, '&');
      if (rawUrl.startsWith('mailto:') || rawUrl.startsWith('data:')) continue;

      if (rawUrl.startsWith('#')) {
        const targetId = rawUrl.slice(1);
        if (!ids.has(targetId)) fail(f, `Broken in-page anchor #${targetId}`);
        continue;
      }

      if (rawUrl.startsWith('https://') || rawUrl.startsWith('http://')) {
        if (rawUrl.startsWith(`${BASE_URL}/topics/`)) {
          const targetFile = rawUrl.slice(`${BASE_URL}/topics/`.length).split(/[?#]/)[0];
          if (!htmlFileSet.has(targetFile)) {
            fail(f, `Broken canonical/self topic link: ${rawUrl}`);
          }
        }
        continue;
      }

      // Relative links inside topics/*.html
      const [relPath, queryPart = ''] = rawUrl.split('?');
      if (relPath === '../' || relPath === '..' || relPath === '') {
        // Main-map deep link: validate query params if present
        if (queryPart) {
          const params = new URLSearchParams(queryPart);
          if (params.has('year')) {
            const ys = params.get('year').split(',').map((v) => v.trim()).filter(Boolean);
            for (const yStr of ys) {
              const yNum = Number(yStr);
              if (!Number.isInteger(yNum) || yNum < minY || yNum > maxY) {
                fail(f, `Out-of-range year param "${yStr}" in ${rawUrl}`);
              }
            }
          }
          if (params.has('from') && params.has('to')) {
            const fromN = Number(params.get('from'));
            const toN = Number(params.get('to'));
            if (!Number.isInteger(fromN) || !Number.isInteger(toN) || fromN > toN) {
              fail(f, `Invalid from/to span in ${rawUrl}`);
            }
          }
          if (params.has('person')) {
            const pkList = params.get('person').split(',').map((s) => s.trim()).filter(Boolean);
            for (const pk of pkList) {
              if (!personKeys.has(pk) && !journeyByKey.has(pk)) {
                fail(f, `Unknown person key "${pk}" in ${rawUrl}`);
              }
              if (params.has('stop')) {
                const jObj = journeyByKey.get(pk);
                const stopIdx = Number(params.get('stop'));
                const maxStops = jObj ? (jObj.stops || []).length : getPersonEventCount(pk);
                if (!Number.isInteger(stopIdx) || stopIdx < 0 || stopIdx >= maxStops) {
                  fail(f, `Invalid person/journey stop index "${params.get('stop')}" for "${pk}" in ${rawUrl}`);
                }
              }
            }
          }
          if (params.has('event')) {
            const ek = params.get('event');
            const stObj = storyByKey.get(ek);
            if (!stObj) {
              fail(f, `Unknown story event key "${ek}" in ${rawUrl}`);
            } else if (params.has('stop')) {
              const stopIdx = Number(params.get('stop'));
              const len = (stObj.stops || []).length;
              if (!Number.isInteger(stopIdx) || stopIdx < 0 || stopIdx >= len) {
                fail(f, `Invalid story stop index "${params.get('stop')}" for "${ek}" in ${rawUrl}`);
              }
            }
          }
          if (params.has('lng') && params.has('lat')) {
            const lngNum = Number(params.get('lng'));
            const latNum = Number(params.get('lat'));
            if (!Number.isFinite(lngNum) || !Number.isFinite(latNum) || lngNum < 66 || lngNum > 142 || latNum < 14 || latNum > 55) {
              fail(f, `Out-of-bounds lng/lat (${params.get('lng')},${params.get('lat')}) in ${rawUrl}`);
            }
          }
        }
        continue;
      }

      // Other relative file links (e.g., tang.html, assets/topics.css, ../assets/favicon.svg, ../sitemap.xml)
      const resolved = path.resolve(TOPICS_DIR, relPath.split('#')[0]);
      if (!fs.existsSync(resolved)) {
        fail(f, `Broken relative target "${rawUrl}" (resolved ${path.relative(ROOT, resolved)})`);
      }
    }

    // 5. Historical & geographical invariants by page category
    if (dynKeySet.has(f.replace('.html', ''))) {
      if (!html.includes('footer-nav-card')) {
        fail(f, 'Missing footer-nav-card dynasty chips on dynasty page');
      }
      const phaseTableMatch = html.match(/<table id="tbl-phases"[\s\S]*?<\/table>/);
      if (!phaseTableMatch) {
        fail(f, 'Missing #tbl-phases table');
      } else {
        const rows = parseTableRows(phaseTableMatch[0]);
        for (const cells of rows) {
          const smalls = [...(cells[0] || '').matchAll(/<small[^>]*>([\s\S]*?)<\/small>/g)].map((m) =>
            stripTags(m[1])
          );
          if (smalls[1] && /^(前\s*)?\d+\s*[—\-–至]/.test(smalls[1])) {
            fail(f, `Duplicate leading year-range prefix in phase overview: "${smalls[1]}"`);
          }
          if (f === 'wudai.html' && smalls[0] && smalls[0].includes('北宋')) {
            fail(f, `Cross-dynasty era leakage in wudai phase row: "${smalls[0]}"`);
          }
        }
      }
    }

    if (f === 'battle-changping.html') {
      const genTbl = (html.match(/<table id="tbl-genealogy"[\s\S]*?<\/table>/) || [''])[0];
      const genBody = (genTbl.match(/<tbody>([\s\S]*?)<\/tbody>/) || ['', ''])[1];
      for (const bad of ['荥阳', '东都洛阳', '开封府', '韩国上党郡']) {
        if (genBody.includes(bad)) fail(f, `Forbidden cross-mountain or anachronistic label "${bad}" in genealogy table`);
      }
    }

    if (f === 'battle-chibi.html') {
      const rows = parseTableRows((html.match(/<table id="tbl-genealogy"[\s\S]*?<\/table>/) || [''])[0]);
      for (const dkLabel of ['东汉', '三国', '东晋十六国']) {
        const row = rows.find((r) => stripTags(r[0]).startsWith(dkLabel));
        if (!row) {
          fail(f, `Missing ${dkLabel} row`);
        } else {
          const adminTxt = stripTags(row[2]);
          if (!adminTxt.includes('江夏郡') || adminTxt.includes('长沙郡')) {
            fail(f, `${dkLabel} row must attribute Chibi to 江夏郡 (not 长沙郡), got "${adminTxt}"`);
          }
          if (stripTags(row[3]).includes('东汉荆州南郡')) {
            fail(f, `Anachronistic "东汉荆州南郡" in nearest-city column on ${dkLabel} row`);
          }
        }
      }
    }

    if (f === 'xinqiji-jingkou.html') {
      const rows = parseTableRows((html.match(/<table id="tbl-genealogy"[\s\S]*?<\/table>/) || [''])[0]);
      const qinRow = rows.find((r) => stripTags(r[0]).startsWith('秦'));
      if (!qinRow) {
        fail(f, 'Missing Qin row');
      } else {
        const adminTxt = stripTags(qinRow[2]);
        if (!adminTxt.includes('会稽郡') || adminTxt.includes('东海郡')) {
          fail(f, `Qin Jingkou row must use 会稽郡 (not 东海郡), got "${adminTxt}"`);
        }
      }
      if (rows.some((r) => stripTags(r[3]).includes('三国东吴铁瓮城'))) {
        fail(f, 'Anachronistic "三国东吴铁瓮城" leaked into genealogy column 4');
      }
    }

    if (f === 'sushi-exile.html') {
      const rows = parseTableRows((html.match(/<table id="tbl-route"[\s\S]*?<\/table>/) || [''])[0]);
      const hzRow = rows.find((r) => stripTags(r[0]).includes('1094年'));
      if (!hzRow || !stripTags(hzRow[3]).includes('惠州') || stripTags(hzRow[3]).includes('祯州')) {
        fail(f, '1094 Huizhou stop must show taboo-renamed 惠州 rather than 祯州');
      }
    }

    if (f === 'wentianxiang-lingdingyang.html') {
      const rows = parseTableRows((html.match(/<table id="tbl-route"[\s\S]*?<\/table>/) || [''])[0]);
      const row1277 = rows.find((r) => stripTags(r[0]).includes('1277年'));
      const row1279 = rows.find((r) => stripTags(r[0]).includes('1279年'));
      if (!row1277 || !stripTags(row1277[0]).includes('景炎')) fail(f, '1277 stop missing Southern Song era 景炎');
      if (!row1279 || !stripTags(row1279[0]).includes('祥兴')) fail(f, '1279 stop missing Southern Song era 祥兴');
    }

    if (f === 'persons.html') {
      for (const j of journeys) {
        if (!html.includes(`journey-${j.key}.html`)) {
          fail(f, `Missing journey link journey-${j.key}.html in persons.html`);
        }
      }
      for (const p of standalonePersons) {
        if (!html.includes(`person-${p.key}.html`)) {
          fail(f, `Missing standalone person link person-${p.key}.html in persons.html`);
        }
      }
      for (const p of nonStoryPersons) {
        const hasLink =
          html.includes(`person-${p.key}.html`) ||
          (p.journeyKey && html.includes(`journey-${p.journeyKey}.html`)) ||
          html.includes(`?person=${p.key}"`) ||
          html.includes(`?person=${encodeURIComponent(p.key)}"`);
        if (!hasLink) {
          fail(f, `Missing directory entry for person "${p.key}" in persons.html`);
        }
      }
    }

    if (standalonePersonBySlug.has(f)) {
      const prof = standalonePersonBySlug.get(f);
      if (!html.includes(`../?embed=1&amp;person=${prof.key}`) && !html.includes(`../?embed=1&person=${prof.key}`)) {
        fail(f, `Missing embedded map iframe for ?person=${prof.key}`);
      }
      const stopCardsCount = (html.match(/<div class="stop-card">/g) || []).length;
      const expectedEvCount = getPersonEventCount(prof.key);
      if (stopCardsCount !== expectedEvCount) {
        fail(f, `Stop card count mismatch (${stopCardsCount} rendered vs ${expectedEvCount} collected)`);
      }
      if (!/<h1>[\s\S]*?<\/h1>/.test(html)) {
        fail(f, 'Missing <h1> heading on person monograph');
      }
    }

    if (f === 'places.html') {
      for (const pl of placesCatalog || []) {
        if (!html.includes(`place-${pl.slug}.html`)) {
          fail(f, `Missing core place link place-${pl.slug}.html in places.html`);
        }
      }
      for (const c of cityLoreList) {
        if (!html.includes(c.modern)) {
          fail(f, `Missing CITY_LORE city "${c.modern}" in places.html`);
        }
      }
      for (const p of strategicPasses) {
        if (!html.includes(p.ancientZh)) {
          fail(f, `Missing strategic pass "${p.ancientZh}" in places.html`);
        }
      }
    }

    if (placeSlugSet.has(f)) {
      const genTbl = (html.match(/<table id="tbl-genealogy"[\s\S]*?<\/table>/) || [''])[0];
      const genRows = parseTableRows(genTbl);
      if (genRows.length !== dynasties.length) {
        fail(f, `Expected ${dynasties.length} dynasty rows in #tbl-genealogy, found ${genRows.length}`);
      }
      const genBodyText = stripTags(genTbl);
      if (genBodyText.includes('泰人诸部')) {
        fail(f, 'Erroneous neighbor polygon "泰人诸部" leaked into #tbl-genealogy');
      }
      for (const r of genRows) {
        const kmMatch = stripTags(r[3]).match(/距\s*(\d+)\s*km/);
        if (kmMatch && Number(kmMatch[1]) > 55) {
          fail(f, `Nearest city exceeded 55km threshold in #tbl-genealogy: "${stripTags(r[3])}"`);
        }
      }
      const findRow = (prefix) => genRows.find((r) => stripTags(r[0]).startsWith(prefix));
      if (f === 'place-xian.html') {
        const rDh = findRow('东汉');
        if (!rDh || !stripTags(rDh[2]).includes('京兆尹')) fail(f, 'place-xian 东汉 row must include 京兆尹');
      }
      if (f === 'place-luoyang.html') {
        const rDh = findRow('东汉');
        if (!rDh || !stripTags(rDh[2]).includes('河南尹')) fail(f, 'place-luoyang 东汉 row must include 河南尹');
      }
      if (f === 'place-beijing.html') {
        const rQ = findRow('秦');
        if (!rQ || !stripTags(rQ[2]).includes('广阳郡') || stripTags(rQ[2]).includes('渔阳郡')) {
          fail(f, 'place-beijing 秦 row must use 广阳郡 (not 渔阳郡)');
        }
      }
      if (f === 'place-kaifeng.html') {
        const rQ = findRow('秦');
        const rDh = findRow('东汉');
        if (!rQ || !stripTags(rQ[2]).includes('砀郡')) fail(f, 'place-kaifeng 秦 row must use 砀郡');
        if (!rDh || !stripTags(rDh[2]).includes('陈留郡')) fail(f, 'place-kaifeng 东汉 row must use 陈留郡');
      }
      if (f === 'place-yangzhou.html') {
        const rQ = findRow('秦');
        const rDh = findRow('东汉');
        if (!rQ || !stripTags(rQ[2]).includes('九江郡')) fail(f, 'place-yangzhou 秦 row must use 九江郡');
        if (!rDh || !stripTags(rDh[2]).includes('广陵郡') || stripTags(rDh[3]).includes('寿春')) {
          fail(f, 'place-yangzhou 东汉 row must use 广陵郡 and not 寿春');
        }
      }
      if (f === 'place-hangzhou.html' || f === 'place-suzhou.html') {
        const rDj = findRow('东晋十六国');
        if (!rDj || !stripTags(rDj[2]).includes('扬州') || !stripTags(rDj[2]).includes('吴郡')) {
          fail(f, `${f} 东晋十六国 row must show 扬州 · 吴郡`);
        }
      }
      if (f === 'place-dali.html') {
        const rXh = findRow('西汉');
        if (!rXh || !stripTags(rXh[2]).includes('益州郡')) fail(f, 'place-dali 西汉 row must show 益州郡');
      }
    }
  }

  return errors;
}

if (require.main === module) {
  const errors = auditAllTopics();
  if (errors.length) {
    console.error(`✗ Topic audit failed with ${errors.length} error(s):`);
    for (const e of errors.slice(0, 30)) console.error(`  - ${e}`);
    if (errors.length > 30) console.error(`  ... and ${errors.length - 30} more`);
    process.exitCode = 1;
  } else {
    const pageCount = fs.readdirSync(TOPICS_DIR).filter((f) => f.endsWith('.html')).length;
    console.log(`✓ All ${pageCount} topic monographs passed link, asset, schema & historical invariant checks`);
    process.exitCode = 0;
  }
}

module.exports = { auditAllTopics };
