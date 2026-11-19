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
} = require('./topics/config');
const { loadAtlasRuntime, loadSourcesBundle, loadTopicsData } = require('./topics/runtime');

function auditAllTopics() {
  const errors = [];
  const fail = (ctx, msg) => errors.push(`[${ctx}] ${msg}`);

  const { dynasties, loreData } = loadAtlasRuntime();
  const sourcesBundle = loadSourcesBundle();
  const { dynastyNotes, featuredTopics, geoOverrides } = loadTopicsData();
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

  // 2. Check shared assets exist
  for (const rel of ['topics.css', 'topics.js']) {
    if (!fs.existsSync(path.join(TOPICS_ASSETS_DIR, rel))) {
      fail('topics/assets', `Missing shared asset topics/assets/${rel}`);
    }
  }

  // Build valid entity maps for deep-link checking
  const persons = loreData.PERSON_PROFILES || [];
  const journeys = loreData.HISTORICAL_JOURNEYS || [];
  const personKeys = new Set(persons.map((p) => p.key));
  const journeyByKey = new Map(journeys.map((j) => [j.key, j]));
  const storyByKey = new Map(persons.filter((p) => p && p.isStory).map((s) => [s.key, s]));

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

  if (htmlFiles.length !== dynasties.length + storyByKey.size + journeys.length + featuredTopics.length + 1) {
    fail('topics/', `Unexpected HTML file count: ${htmlFiles.length}`);
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
    return [...bodyMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) =>
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
    if (f !== 'index.html' && !html.includes('../?embed=1&')) fail(f, 'Missing ?embed=1 preview iframe');

    // Placeholder / broken render tokens
    if (html.includes('undefined')) fail(f, 'Contains literal "undefined"');
    if (/\bNaN\b/.test(html)) fail(f, 'Contains literal "NaN"');
    if (html.includes('[object Object]')) fail(f, 'Contains "[object Object]"');
    if (html.toLowerCase().includes('deanchensj.github.io')) fail(f, 'Contains legacy github.io URL');

    // Empty tbody check
    const tbodies = [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)];
    for (const tb of tbodies) {
      if (!tb[1].includes('<tr')) fail(f, 'Contains empty <tbody> without table rows');
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
                if (!jObj || !Number.isInteger(stopIdx) || stopIdx < 0 || stopIdx >= (jObj.stops || []).length) {
                  fail(f, `Invalid journey stop index "${params.get('stop')}" for "${pk}" in ${rawUrl}`);
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
      const phaseTableMatch = html.match(/<table id="tbl-phases"[\s\S]*?<\/table>/);
      if (!phaseTableMatch) {
        fail(f, 'Missing #tbl-phases table');
      } else {
        const rows = parseTableRows(phaseTableMatch[0]);
        for (const cells of rows) {
          const smalls = [...(cells[1] || '').matchAll(/<small[^>]*>([\s\S]*?)<\/small>/g)].map((m) =>
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
          const adminTxt = stripTags(row[3]);
          if (!adminTxt.includes('江夏郡') || adminTxt.includes('长沙郡')) {
            fail(f, `${dkLabel} row must attribute Chibi to 江夏郡 (not 长沙郡), got "${adminTxt}"`);
          }
          if (stripTags(row[4]).includes('东汉荆州南郡')) {
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
        const adminTxt = stripTags(qinRow[3]);
        if (!adminTxt.includes('会稽郡') || adminTxt.includes('东海郡')) {
          fail(f, `Qin Jingkou row must use 会稽郡 (not 东海郡), got "${adminTxt}"`);
        }
      }
      if (rows.some((r) => stripTags(r[4]).includes('三国东吴铁瓮城'))) {
        fail(f, 'Anachronistic "三国东吴铁瓮城" leaked into genealogy column 5');
      }
    }

    if (f === 'sushi-exile.html') {
      const rows = parseTableRows((html.match(/<table id="tbl-route"[\s\S]*?<\/table>/) || [''])[0]);
      const hzRow = rows.find((r) => stripTags(r[1]).includes('1094年'));
      if (!hzRow || !stripTags(hzRow[4]).includes('惠州') || stripTags(hzRow[4]).includes('祯州')) {
        fail(f, '1094 Huizhou stop must show taboo-renamed 惠州 rather than 祯州');
      }
    }

    if (f === 'wentianxiang-lingdingyang.html') {
      const rows = parseTableRows((html.match(/<table id="tbl-route"[\s\S]*?<\/table>/) || [''])[0]);
      const row1277 = rows.find((r) => stripTags(r[1]).includes('1277年'));
      const row1279 = rows.find((r) => stripTags(r[1]).includes('1279年'));
      if (!row1277 || !stripTags(row1277[1]).includes('景炎')) fail(f, '1277 stop missing Southern Song era 景炎');
      if (!row1279 || !stripTags(row1279[1]).includes('祥兴')) fail(f, '1279 stop missing Southern Song era 祥兴');
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
    console.log('✓ All 39 topic monographs passed link, asset, schema & historical invariant checks');
    process.exitCode = 0;
  }
}

module.exports = { auditAllTopics };
