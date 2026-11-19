'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const JS_DIR = path.join(ROOT, 'js');
const TOPICS_DIR = path.join(ROOT, 'topics');
const TOPICS_ASSETS_DIR = path.join(TOPICS_DIR, 'assets');
const DATA_TOPICS_DIR = path.join(ROOT, 'data', 'topics');
const SOURCES_DIR = path.join(ROOT, 'data', 'sources');
const BASE_URL = 'https://deanchen.me/jiangshan-map';
const LASTMOD = '2026-11-18';
const PERSON_MONOG_MIN_EVENTS = 5;

function isStandalonePersonMonograph(p) {
  return Boolean(
    p && !p.isStory && !p.journeyKey && (p.isRelic || (p.evCount || 0) >= PERSON_MONOG_MIN_EVENTS)
  );
}

function shortSha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
}

function computeTopicAssetHashes() {
  const cssPath = path.join(TOPICS_ASSETS_DIR, 'topics.css');
  const jsPath = path.join(TOPICS_ASSETS_DIR, 'topics.js');
  const hantPath = path.join(JS_DIR, 'zh_hant.js');
  return {
    cssHash: shortSha256(cssPath),
    jsHash: shortSha256(jsPath),
    hantHash: shortSha256(hantPath),
  };
}

module.exports = {
  ROOT,
  JS_DIR,
  TOPICS_DIR,
  TOPICS_ASSETS_DIR,
  DATA_TOPICS_DIR,
  SOURCES_DIR,
  BASE_URL,
  LASTMOD,
  PERSON_MONOG_MIN_EVENTS,
  isStandalonePersonMonograph,
  shortSha256,
  computeTopicAssetHashes,
};
