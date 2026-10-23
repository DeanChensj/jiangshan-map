#!/usr/bin/env node
/**
 * Export the atlas vector data as standard RFC 7946 GeoJSON (WGS84 lon/lat),
 * ready to load directly in Leaflet, MapLibre, OpenLayers, QGIS, etc.
 *
 * The output is generated, not committed (see .gitignore): run this after
 * cloning or after changing data in js/.
 *
 * Coverage ends in 1948: years from 1949 on (the PRC period, s_prc) and the
 * modern province layer are not exported.
 *
 * Usage:
 *   node scripts/export_geojson.js [outDir]   # default: geojson/
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'geojson');

const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['map_data.js', 'china_geo_data.js', 'atlas_snapshots.js', 'i18n_dict.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
}
const W = ctx.window;
const SNAPSHOTS = W.ATLAS_SNAPSHOTS;
const EN = W.EN_LOCALE || {};
const DICT = EN.dict || {};

// First year left out of the export; 1949 belongs to the PRC under the
// boundary-year rule of _findDynastyIndex.
const CUTOFF = 1949;

const LICENSE =
  'GPL-3.0 · jiangshan-map (Chronicles of the Realm). Historical borders are schematic approximations, not survey-grade boundaries.';

// ---------- geometry helpers ----------

const round = (n) => Math.round(n * 1e4) / 1e4;
const pt = (c) => [round(c[0]), round(c[1])];

function signedArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    a += (q[0] - p[0]) * (q[1] + p[1]);
  }
  return a; // > 0 clockwise, < 0 counter-clockwise
}

// RFC 7946 §3.1.6: closed rings, exterior counter-clockwise, holes clockwise.
function fixRing(ring, exterior) {
  const r = ring.map(pt);
  if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0].slice());
  if (r.length < 4) return null;
  const cw = signedArea(r) > 0;
  if (exterior === cw) r.reverse();
  return r;
}

function fixPolygon(rings) {
  const out = [];
  rings.forEach((ring, i) => {
    const r = fixRing(ring, i === 0);
    if (r) out.push(r);
    else if (i === 0) out.length = 0;
  });
  return out.length ? out : null;
}

function polygonal(shape) {
  if (!shape) return null;
  const polys = (shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates).map(fixPolygon).filter(Boolean);
  if (!polys.length) return null;
  return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
}

function lines(list) {
  const ls = list.map((l) => l.map(pt)).filter((l) => l.length >= 2);
  if (!ls.length) return null;
  return ls.length === 1 ? { type: 'LineString', coordinates: ls[0] } : { type: 'MultiLineString', coordinates: ls };
}

const point = (c) => ({ type: 'Point', coordinates: pt(c) });

function bbox(features) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < b[0]) b[0] = c[0];
      if (c[1] < b[1]) b[1] = c[1];
      if (c[0] > b[2]) b[2] = c[0];
      if (c[1] > b[3]) b[3] = c[1];
    } else c.forEach(walk);
  };
  features.forEach((f) => f.geometry && walk(f.geometry.coordinates));
  return b[0] === Infinity ? undefined : b.map(round);
}

function clean(obj) {
  const o = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') o[k] = v;
  return o;
}

function feature(geometry, props) {
  if (!geometry) return null;
  const f = { type: 'Feature', properties: clean(props), geometry };
  if (geometry.type !== 'Point') f.bbox = bbox([f]);
  return f;
}

function collection(name, features, meta = {}) {
  const fs_ = features.filter(Boolean);
  return { type: 'FeatureCollection', name, ...clean(meta), license: LICENSE, bbox: bbox(fs_), features: fs_ };
}

const en = (zh) => (zh && DICT[zh]) || undefined;
const anchor = (a) => (Array.isArray(a) ? pt(a) : undefined);

// ---------- year ranges per snapshot (mirrors phase lookup in js/app.js) ----------

const dynastyName = (d) => (EN.dynasties && EN.dynasties[d.key] && EN.dynasties[d.key].name) || undefined;
const snapUse = {};
// A boundary year belongs to the later dynasty, as in _findDynastyIndex.
const dynasties = W.DYNASTY_DATA.map((d, di, all) => {
  const phases = d.phases && d.phases.length ? d.phases : [{ until: d.toYear, snap: `s_${d.key}` }];
  const end = Math.min(di < all.length - 1 ? all[di + 1].fromYear - 1 : d.toYear, CUTOFF - 1);
  const out = phases.map((ph, i) => {
    const from = i === 0 ? d.fromYear : phases[i - 1].until;
    const to = Math.min(i === phases.length - 1 ? end : ph.until - 1, end);
    if (from > to) return null;
    const p = { snapshot: ph.snap, from, to, file: `snapshots/${ph.snap}.geojson` };
    if (ph.overview) p.overview = ph.overview;
    (snapUse[ph.snap] = snapUse[ph.snap] || []).push({ dynasty: d.key, from, to });
    return p;
  }).filter(Boolean);
  return out.length ? clean({ key: d.key, title: d.title, title_en: dynastyName(d), from: d.fromYear, to: end, tint: d.tint, phases: out }) : null;
}).filter(Boolean);

// ---------- build ----------

const files = {};

function snapshotLayer(list, layer) {
  return (list || []).map((f) =>
    feature(polygonal(f.shape), {
      layer,
      title: f.title,
      title_en: en(f.title),
      category: f.category,
      kind: f.kind,
      role: f.role,
      tint: f.tint,
      anchor: anchor(f.anchor)
    })
  );
}

// Resolve prefRef / regionRef exactly as HistoricalAtlasController._hydrateSnapshots
// does: in snapshot key order, so chained references resolve the same way.
const lists = {};
for (const [key, s] of Object.entries(SNAPSHOTS)) {
  if (key !== 'neighbors') lists[key] = { polities: s.polities, prefectures: s.prefectures, regions: s.regions };
}
for (const [key, s] of Object.entries(SNAPSHOTS)) {
  if (key === 'neighbors') continue;
  const l = lists[key];
  if (s.prefRef && (!l.prefectures || !l.prefectures.length) && lists[s.prefRef]) l.prefectures = lists[s.prefRef].prefectures || [];
  if (s.regionRef && (!l.regions || !l.regions.length) && lists[s.regionRef]) l.regions = lists[s.regionRef].regions || [];
}

for (const [key, s] of Object.entries(SNAPSHOTS)) {
  if (key === 'neighbors' || !snapUse[key]) continue; // not shown before CUTOFF
  const { polities, prefectures: prefs, regions } = lists[key];
  const use = snapUse[key];
  files[`snapshots/${key}.geojson`] = collection(
    key,
    [...snapshotLayer(regions, 'region'), ...snapshotLayer(prefs, 'prefecture'), ...snapshotLayer(polities, 'polity')],
    {
      caption: s.caption,
      note: s.note,
      from: Math.min(...use.map((u) => u.from)),
      to: Math.max(...use.map((u) => u.to))
    }
  );
}

files['neighbors.geojson'] = collection(
  'neighbors',
  SNAPSHOTS.neighbors.map((f) => feature(polygonal(f.shape), { title: f.title, title_en: en(f.title), anchor: anchor(f.anchor) })),
  { note: 'Modern neighbouring countries (context layer)' }
);

const H = W.HYDRO_DATA;
files['modern/rivers.geojson'] = collection(
  'rivers',
  H.rivers.map((r) => feature(lines(r.lines), { name: r.name, rank: r.rank, appear: r.appear, vanish: r.vanish })),
  { note: 'appear / vanish: first year shown and first year hidden (historical river courses)' }
);
files['modern/lakes.geojson'] = collection(
  'lakes',
  H.lakes.map((l) =>
    feature(polygonal({ type: 'Polygon', coordinates: l.rings }), { name: l.name, rank: l.rank, appear: l.appear, vanish: l.vanish })
  ),
  { note: 'appear / vanish: first year shown and first year hidden (historical lakes)' }
);
files['modern/hydro_labels.geojson'] = collection(
  'hydro_labels',
  H.labels.map((l) =>
    feature(point(l.coord), { title: l.zh, title_en: l.en, kind: l.kind, rotate: l.rot, appear: l.appear, vanish: l.vanish })
  )
);

files['corridors.geojson'] = collection(
  'corridors',
  W.CORRIDOR_DATA.filter((c) => !c.span || c.span[0] < CUTOFF).map((c) => {
    const e = (EN.corridors && EN.corridors[c.key]) || [];
    return feature(lines(c.segments), {
      key: c.key,
      kind: c.kind,
      title: c.title,
      title_en: e[0],
      from: c.span && c.span[0],
      to: c.span && Math.min(c.span[1], CUTOFF - 1),
      summary: c.summary,
      summary_en: e[1],
      label_at: anchor(c.labelAt)
    });
  }),
  { note: 'Great Walls, canals, roads and sea routes; from/to give the years each corridor is shown' }
);

const settlements = [];
const milestones = [];
for (const d of W.DYNASTY_DATA.filter((d) => d.fromYear < CUTOFF)) {
  for (const s of d.settlements || []) {
    if (!Array.isArray(s.coord)) continue;
    settlements.push(
      feature(point(s.coord), {
        dynasty: d.key,
        from: d.fromYear,
        to: Math.min(d.toYear, CUTOFF - 1),
        ancient: s.ancient,
        ancient_en: en(s.ancient),
        modern: s.modern,
        modern_en: en(s.modern),
        capital: s.isCapital || undefined,
        tier: s.tier,
        remark: s.remark
      })
    );
  }
  for (const m of d.milestones || []) {
    if (!Array.isArray(m.coord) || m.year >= CUTOFF) continue;
    const e = (EN.milestones && EN.milestones[`${d.key}:${m.year}`]) || [];
    milestones.push(
      feature(point(m.coord), { dynasty: d.key, year: m.year, headline: m.headline, headline_en: e[0], site: m.site, site_en: e[1] })
    );
  }
}
files['settlements.geojson'] = collection('settlements', settlements, {
  note: 'Settlements listed per period; the same city can appear once per period with that period\'s name'
});
files['milestones.geojson'] = collection('milestones', milestones);

files['index.json'] = {
  name: 'jiangshan-map GeoJSON export',
  license: LICENSE,
  crs: 'EPSG:4326 (lon, lat), RFC 7946 winding',
  years: 'Integer years; negative = BCE. There is no year 0 (-1 is 1 BCE, 1 is 1 CE).',
  coverage: `${W.DYNASTY_DATA[0].fromYear} to ${CUTOFF - 1}; later years and modern provinces are not exported`,
  layers: {
    corridors: 'corridors.geojson',
    settlements: 'settlements.geojson',
    milestones: 'milestones.geojson',
    neighbors: 'neighbors.geojson',
    rivers: 'modern/rivers.geojson',
    lakes: 'modern/lakes.geojson',
    hydro_labels: 'modern/hydro_labels.geojson'
  },
  dynasties
};

// ---------- write ----------

for (const [rel, obj] of Object.entries(files)) {
  const target = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, rel === 'index.json' ? JSON.stringify(obj, null, 2) + '\n' : JSON.stringify(obj) + '\n');
}
console.log(`Wrote ${Object.keys(files).length} files to ${path.relative(ROOT, OUT) || '.'}/`);
