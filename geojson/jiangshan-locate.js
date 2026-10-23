/**
 * jiangshan-locate — find the historical polity / region / prefecture at a
 * (lon, lat, year), loading only index.json plus the one snapshot that covers
 * that year (a few hundred KB) instead of the whole export.
 *
 * Browser:  <script src=".../geojson/jiangshan-locate.js"></script>
 *           const atlas = JiangshanLocate.create();            // base = this script's folder
 *           const hit = await atlas.locate(108.94, 34.26, 741);
 *           hit.prefecture.properties.title                     // "京兆府"
 * Node/ESM: const { create } = require('./jiangshan-locate.js');
 *           create({ base, fetchJSON: (url) => ... })
 *
 * Years are integers, negative = BCE, no year 0.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JiangshanLocate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LAYERS = ['polity', 'region', 'prefecture'];
  const scriptBase =
    typeof document !== 'undefined' && document.currentScript ? new URL('.', document.currentScript.src).href : undefined;

  function inRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function inPolygon(x, y, rings) {
    if (!inRing(x, y, rings[0])) return false;
    for (let i = 1; i < rings.length; i++) if (inRing(x, y, rings[i])) return false;
    return true;
  }

  function contains(feature, x, y) {
    const b = feature.bbox;
    if (b && (x < b[0] || y < b[1] || x > b[2] || y > b[3])) return false;
    const g = feature.geometry;
    if (g.type === 'Polygon') return inPolygon(x, y, g.coordinates);
    if (g.type === 'MultiPolygon') return g.coordinates.some((p) => inPolygon(x, y, p));
    return false;
  }

  function create(opts = {}) {
    const base = opts.base || scriptBase || './';
    const fetchJSON =
      opts.fetchJSON ||
      ((url) =>
        fetch(url).then((r) => {
          if (!r.ok) throw new Error(`${r.status} ${url}`);
          return r.json();
        }));
    const cache = new Map();
    const load = (rel) => {
      const url = new URL(rel, base).href;
      if (!cache.has(url)) cache.set(url, fetchJSON(url).catch((e) => (cache.delete(url), Promise.reject(e))));
      return cache.get(url);
    };

    const index = () => load('index.json');

    /** Dynasty and phase covering a year, or null outside the atlas range. */
    async function phaseFor(year) {
      const y = Math.round(Number(year));
      for (const d of (await index()).dynasties)
        for (const p of d.phases) if (y >= p.from && y <= p.to) return { dynasty: d, phase: p };
      return null;
    }

    /** The full snapshot FeatureCollection for a year. */
    async function loadYear(year) {
      const hit = await phaseFor(year);
      if (!hit) throw new RangeError(`year ${year} is outside the atlas range`);
      return { ...hit, collection: await load(hit.phase.file) };
    }

    /**
     * Features containing (lon, lat) in the snapshot for `year`.
     * Returns { dynasty, phase, collection, polity, region, prefecture, matches }:
     * polity / region / prefecture are the first match of each layer (or null),
     * and matches lists every containing feature.
     */
    async function locate(lon, lat, year) {
      const { dynasty, phase, collection } = await loadYear(year);
      const matches = collection.features.filter((f) => contains(f, lon, lat));
      const out = { dynasty, phase, collection, matches };
      for (const l of LAYERS) {
        const hits = matches.filter((f) => f.properties.layer === l);
        // Prefer the period's main polity when overlapping claims exist.
        out[l] = hits.find((f) => f.properties.role === 'main') || hits[0] || null;
      }
      return out;
    }

    /** Find features by Chinese or English title (exact match first, then substring). */
    async function find(title, year) {
      const { collection } = await loadYear(year);
      const t = String(title).toLowerCase();
      const names = (f) => [f.properties.title || '', (f.properties.title_en || '').toLowerCase()];
      const exact = collection.features.filter((f) => names(f).includes(t) || f.properties.title === title);
      return exact.length ? exact : collection.features.filter((f) => names(f).some((n) => n && n.includes(t)));
    }

    return { index, phaseFor, loadYear, locate, find, layer: (name) => load(name) };
  }

  return { create, contains };
});
