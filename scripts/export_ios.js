#!/usr/bin/env node
// Native app resources, generated from the same sources as the web atlas.
// Includes every period, including the modern provincial reference layer.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'ios/JiangshanAtlas/Resources/Atlas');
const sources = ['map_data.js', 'china_geo_data.js', 'atlas_snapshots.js', 'lore_data.js', 'i18n_dict.js', 'zh_hant.js', 'app.js', 'atlas_quiz.js'];
const hash = crypto.createHash('sha256').update(fs.readFileSync(__filename));
for (const file of sources) hash.update(fs.readFileSync(path.join(root, 'js', file)));
hash.update(fs.readFileSync(path.join(__dirname, 'ios_engine.js')));
hash.update(fs.readFileSync(path.join(__dirname, 'prepare_ios_terrain.swift')));
hash.update(fs.readFileSync(path.join(root, 'assets/terrain_relief.webp')));
hash.update(fs.readFileSync(path.join(root, 'css/style.css')));
hash.update(fs.readFileSync(path.join(root, 'assets/tang_focus.json')));
const version = hash.digest('hex').slice(0, 16);
if (fs.existsSync(path.join(out, 'version.txt')) && fs.readFileSync(path.join(out, 'version.txt'), 'utf8') === version) {
  console.log('iOS atlas data is current.');
  process.exit(0);
}
const ctx = { window: {addEventListener() {}}, URLSearchParams, URL, console, setTimeout, clearTimeout };
vm.createContext(ctx);
for (const file of sources) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), ctx, { filename: file });
const w = ctx.window, lore = w.ATLAS_LORE_DATA, en = w.EN_LOCALE;
const english = text => en.dict[text] || text || '';
const write = (name, object) => {
  const file = path.join(out, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof object === 'string' ? object : JSON.stringify(object));
};
const collection = features => ({ type: 'FeatureCollection', features });
const point = (coord, properties) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: coord }, properties });
const focus = JSON.parse(fs.readFileSync(path.join(root, 'assets/tang_focus.json'), 'utf8'));
write('focus-sites.json', focus.sites);
write('focus-sites.geojson', collection(focus.sites.flatMap(site => (site.names || [site]).map(period => {
  const properties = {...site, title:period.title, titleEn:period.titleEn, from:period.from, until:period.until,
    titleHant:w.ZH_HANT_CONV.toHant(period.title), sort:site.kind === 'palace' ? 0 : site.kind === 'gate' ? 1 : 2};
  delete properties.names;
  return point(site.coord, properties);
}))));
function geometry(shape) {
  if (!shape) return null;
  const ring = r => {
    const result = r.map(p => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4]);
    if (result.length && (result[0][0] !== result.at(-1)[0] || result[0][1] !== result.at(-1)[1])) result.push(result[0]);
    return result;
  };
  return { type: shape.type, coordinates: shape.type === 'Polygon' ? shape.coordinates.map(ring) : shape.coordinates.map(p => p.map(ring)) };
}
// Flatten the web renderer's quadratic corner rounding into native render geometry.
// Historical query geometry remains the original data inside the shared engine.
function renderGeometry(shape) {
  function ring(points) {
    const path=atlas.projector.smoothRingToSvgPath(points),out=[];let pen=null;
    for(const part of path.matchAll(/([MLQZ])([^MLQZ]*)/g)) {
      const values=(part[2].match(/-?[\d.]+/g)||[]).map(Number);
      if(part[1]==='M'||part[1]==='L'){pen=values.slice(0,2);out.push(atlas.projector.toGeo(...pen));}
      if(part[1]==='Q'&&pen){const start=pen;for(let step=1;step<=8;step++){const t=step/8,u=1-t;const x=u*u*start[0]+2*u*t*values[0]+t*t*values[2],y=u*u*start[1]+2*u*t*values[1]+t*t*values[3];out.push(atlas.projector.toGeo(x,y));}pen=values.slice(2,4);}
    }
    const result=out.map(p=>p.map(v=>Math.round(v*1e4)/1e4));if(result.length)result.push(result[0]);return result;
  }
  return {type:shape.type,coordinates:shape.type==='Polygon'?shape.coordinates.map(ring):shape.coordinates.map(p=>p.map(ring))};
}
const feature = (shape, properties) => ({ type: 'Feature', geometry: geometry(shape), properties });
const catalog = { version, dynasties: [], places: [], events: [], journeys: [], cameraBounds: {}, cityLore: lore.CITY_LORE, eras: lore.CHINESE_ERA_SPANS };
const snapshots = w.ATLAS_SNAPSHOTS;
const atlas = Object.create(w.HistoricalAtlasController.prototype);
Object.assign(atlas,{dynasties:w.DYNASTY_DATA,snapshots,provinces:w.PROVINCE_OUTLINES,hydroData:w.HYDRO_DATA,corridors:w.CORRIDOR_DATA,enLocale:en,year:1415,locale:'zh',minYear:-403,maxYear:2026,dynastyIdx:14,_fullSnapshotsLoaded:true,projector:new w.MercatorProjector(1000,700,{west:66,east:142,south:14,north:55}),camera:{x:0,y:0,w:500,h:420,zoom:2}});
atlas._hydrateSnapshots();
catalog.playbackStops = atlas._autoplayStops();
function pathLines(svg, properties) {
  const lines=[]; let line=[];
  for (const m of svg.matchAll(/([ML])(-?[\d.]+)[ ,]+(-?[\d.]+)/g)) {
    if(m[1]==='M'){ if(line.length>1)lines.push(line);line=[]; }
    line.push(atlas.projector.toGeo(Number(m[2]),Number(m[3])).map(v=>Math.round(v*1e4)/1e4));
  }
  if(line.length>1)lines.push(line);
  return {type:'Feature',geometry:{type:'MultiLineString',coordinates:lines},properties};
}
function boundsOf(shape) {
  const b=[Infinity,Infinity,-Infinity,-Infinity];
  function add(c){if(typeof c[0]==='number'){b[0]=Math.min(b[0],c[0]);b[1]=Math.min(b[1],c[1]);b[2]=Math.max(b[2],c[0]);b[3]=Math.max(b[3],c[1]);}else c.forEach(add);}
  add(shape.coordinates);return b;
}
const css=fs.readFileSync(path.join(root,'css/style.css'),'utf8');
write('theme.json',Object.fromEntries([...css.slice(css.indexOf(':root'),css.indexOf('}')).matchAll(/--([a-z-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()])));
for (const [key, snap] of Object.entries(snapshots)) {
  if (snap.prefRef && !snap.prefectures?.length) snap.prefectures = snapshots[snap.prefRef]?.prefectures || [];
  if (snap.regionRef && !snap.regions?.length) snap.regions = snapshots[snap.regionRef]?.regions || [];
}
const usedSnapshots = new Set();
for (const [index, d] of w.DYNASTY_DATA.entries()) {
  const next = w.DYNASTY_DATA[index + 1];
  const lastYear = next ? next.fromYear - 1 : d.toYear - 1;
  const phases = (d.phases || [{ until: d.toYear, snap: `s_${d.key}` }]).map((p, i, all) => {
    usedSnapshots.add(p.snap);
    return { id: p.snap, from: i === 0 ? d.fromYear : all[i - 1].until, to: Math.min(p.until - 1, lastYear), overview: p.overview || '' };
  });
  catalog.dynasties.push({ id: d.key, title: d.title, titleEn: en.dynasties?.[d.key]?.name || d.title, from: d.fromYear, to: lastYear, focus: d.focusYear, tint: d.tint, summary: d.summary, seat: d.seat || '', seatEn: en.dynasties?.[d.key]?.capital || d.seat || '', summaryEn: en.dynasties?.[d.key]?.desc || d.summary, phases });
  for (const [i, s] of (d.settlements || []).entries()) {
    catalog.places.push({ id: `${d.key}-place-${i}`, dynasty: d.key, title: s.ancient, titleEn: english(s.ancient), modern: s.modern || '', modernEn: english(s.modern), coord: s.coord, from: Math.max(d.fromYear, s.appear ?? d.fromYear), to: Math.min(lastYear, (s.vanish ?? lastYear + 1) - 1), capital: !!s.isCapital, capitalPeriods: s.capitalPeriods || [], tier: s.tier || 1, remark: s.remark || '', remarkEn: english(s.remark), align: s.align || 'r', aliases: s.aliases || [], eraNames: s.eraNames || [] });
  }
  for (const [i, e] of (d.milestones || []).entries()) {
    
    const localized = en.milestones?.[`${d.key}:${e.year}`];
    atlas.locale='zh';const zhAnchors=atlas._getMilestoneAnchors(d,e);atlas.locale='en';const enAnchors=atlas._getMilestoneAnchors(d,e);atlas.locale='zh';
    const anchors=zhAnchors.map((a,i)=>({title:a.fullLabel||a.shortLabel,titleEn:enAnchors[i]?.fullLabel||enAnchors[i]?.shortLabel||a.fullLabel,coord:a.coord}));
    catalog.events.push({ id: `${d.key}-event-${i}`, dynasty: d.key, year: e.year, navigationYear: atlas._clampYearToDynasty(d,e.year), title: e.headline, titleEn: e.headlineEn || (Array.isArray(localized) ? localized[0] : localized) || english(e.headline), site: e.site || '', siteEn: e.siteEn || (Array.isArray(localized) ? localized[1] : '') || english(e.site), coord: e.coord || [], coords: e.siteCoords || [], source: 'milestone', anchors, sealStop: atlas._findRelicStopForMilestone(d,e), major: !!e.isMapChange || e.year === d.fromYear || atlas._resolveSnapKey(d,e.year)!==atlas._resolveSnapKey(d,Math.max(d.fromYear,e.year-1)) || atlas._settlementMask(d,e.year)!==atlas._settlementMask(d,Math.max(d.fromYear,e.year-1)) || atlas._hydroCourseMask(e.year)!==atlas._hydroCourseMask(e.year-1) });
  }
}
for (const [i, e] of lore.PLACE_LANDMARK_EVENTS.entries()) {
  catalog.events.push({ id: `landmark-${i}`, dynasty: e.dynastyKey, year: e.year, title: e.zh, titleEn: e.en || e.zh, site: e.site || '', siteEn: e.siteEn || english(e.site), coord: e.coord, source: 'landmark', major: false });
}
catalog.journeys = lore.HISTORICAL_JOURNEYS.map(j => ({ id: j.key, title: j.titleZh, titleEn: j.titleEn, short: j.shortZh, shortEn: j.shortEn, color: j.color, stops: j.stops.map((s, i) => ({ id: `${j.key}-${i}`, year: s.year, title: s.titleZh, titleEn: s.titleEn, site: s.ancientZh, siteEn: s.ancientEn, detail: s.descZh, detailEn: s.descEn, quote: s.quoteZh || '', quoteEn: s.quoteEn || '', via: [s.fromCoord,...(s.via||[])].filter(c=>Array.isArray(c)&&c.length===2), coord: s.coord })) }));
for (const key of usedSnapshots) {
  const s = snapshots[key];
  if (!s) throw new Error(`Missing native atlas snapshot: ${key}`);
  const shapes = [], labels = [];
  atlas._buildRegionBoundaryPath(s);
  for (const [layer, list] of [['polity', s.polities], ['region', s.regions], ['prefecture', s.prefectures]]) {
    for (const [i, f] of (list || []).entries()) {
      if (!f.shape) continue;
      const properties = { signature: crypto.createHash('sha1').update(JSON.stringify(f.shape)).digest('hex'), titleHant: w.ZH_HANT_CONV.toHant(f.title || ''), id: `${key}-${layer}-${i}`, layer, title: f.title || '', titleEn: english(f.title), tint: f.tint || '#c8b48f', role: f.role || '', category:f.category || '', bounds:boundsOf(f.shape), sort: f.role==='main'?0:f.role==='rival'?1:f.role==='protectorate'?2:3 };
      shapes.push(layer === "polity" ? {type:"Feature",geometry:renderGeometry(f.shape),properties} : feature(f.shape,properties));
      if (f.anchor && (layer!=='region' || !s._allowRegionAnchor || f.category==='侨州' || s._allowRegionAnchor(...f.anchor))) labels.push(point(f.anchor,f.category === "侨州" ? {...properties,title:properties.title+"·侨",titleEn:properties.titleEn+" (Emigre)",titleHant:properties.titleHant+"·僑"} : properties));
    }
  }
  const meshes=[pathLines(atlas._buildPrefectureBoundaryPath(s.prefectures),{layer:'prefecture'}),pathLines(atlas._buildRegionBoundaryPath(s),{layer:'region'})];
  write(`meshes/${key}.geojson`,collection(meshes));
  // Overview framing uses the actual territorial stage, independent of device size.
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  function includeCoordinates(coords) {
    if (typeof coords[0] === 'number') {
      bounds[0] = Math.min(bounds[0], coords[0]); bounds[1] = Math.min(bounds[1], coords[1]);
      bounds[2] = Math.max(bounds[2], coords[0]); bounds[3] = Math.max(bounds[3], coords[1]);
    } else coords.forEach(includeCoordinates);
  }
  for (const f of shapes) {
    if ((f.properties.layer === 'polity' && f.properties.role !== 'neighbor') || key==='s_prc') includeCoordinates(f.geometry.coordinates);
  }
  if (bounds.every(Number.isFinite)) catalog.cameraBounds[key] = bounds;
  write(`snapshots/${key}.geojson`, collection(shapes));
  write(`labels/${key}.geojson`, collection(labels));
}
write('neighbor-labels.geojson',collection(snapshots.neighbors.filter(f=>f.anchor).map(f=>point(f.anchor,{title:f.title,titleEn:english(f.title),titleHant:w.ZH_HANT_CONV.toHant(f.title)}))));
const provinceMesh=atlas._buildProvinceBoundaryPaths();
write('province-mesh.geojson',collection([pathLines(provinceMesh.interior,{layer:'interior'}),pathLines(provinceMesh.outer,{layer:'outer'}),...w.PROVINCE_OUTLINES.filter(p=>String(p.code).includes('_JD')).map(p=>feature({type:'MultiPolygon',coordinates:p.rings},{layer:'maritime'}))]));
write('neighbors.geojson', collection(snapshots.neighbors.map(f => feature(f.shape, { title: f.title, titleEn: english(f.title) }))));
write('provinces.geojson', collection(w.PROVINCE_OUTLINES.filter(p => !String(p.code).includes('_JD')).map(p => feature({ type: 'MultiPolygon', coordinates: p.rings }, { title: p.title }))));
const water = [];
for (const r of w.HYDRO_DATA.rivers) water.push({ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: r.lines }, properties: { layer: 'river', rank: r.rank, from: r.appear ?? -9999, until: r.vanish ?? 9999 } });
for (const l of w.HYDRO_DATA.lakes) water.push(feature({ type: 'Polygon', coordinates: l.rings }, { layer: 'lake', rank:l.rank || 3, from: l.appear ?? -9999, until: l.vanish ?? 9999 }));
write('water.geojson', collection(water));

catalog.people = lore.PERSON_PROFILES;
catalog.polities = lore.POLITY_PROFILES;
catalog.music = lore.GUQIN_TRACKS;
catalog.passes = lore.STRATEGIC_PASSES;
catalog.corridors = w.CORRIDOR_DATA.map(c=>({...c,titleEn:en.corridors?.[c.key]?.[0]||c.title,summaryEn:en.corridors?.[c.key]?.[1]||c.summary}));
write('hant.json', {chars:w.ZH_HANT_CONV.CHAR_S2T, phrases:w.ZH_HANT_CONV.PHRASES_S2T});
write('hydro-labels.json', w.HYDRO_DATA.labels);
const corridorFeatures = w.CORRIDOR_DATA.map(c=>({type:'Feature',geometry:{type:'MultiLineString',coordinates:c.segments},properties:{id:c.key,title:c.title,titleEn:en.corridors?.[c.key]?.[0]||c.title,titleHant:w.ZH_HANT_CONV.toHant(c.title),kind:c.kind,from:c.span[0],until:c.span[1]}}));
write('corridors.geojson',collection(corridorFeatures));
write('corridor-labels.geojson',collection(w.CORRIDOR_DATA.map(c=>point(c.labelAt,{id:c.key,title:c.title,titleEn:en.corridors?.[c.key]?.[0]||c.title,titleHant:w.ZH_HANT_CONV.toHant(c.title),from:c.span[0],until:c.span[1],rotation:0}))));
write('modern-labels.geojson',collection(snapshots.s_prc.regions.filter(p=>p.anchor).map(p=>point(p.anchor,{title:p.title,titleEn:english(p.title),titleHant:w.ZH_HANT_CONV.toHant(p.title)}))));
require('node:child_process').execFileSync('/usr/bin/swift',[path.join(__dirname,'prepare_ios_terrain.swift'),path.join(root,'assets/terrain_relief.webp'),path.join(out,'terrain.png')]);
for(const file of sources) write('Engine/'+file,fs.readFileSync(path.join(root,'js',file),'utf8'));
write('Engine/native.js',fs.readFileSync(path.join(__dirname,'ios_engine.js'),'utf8'));
write('catalog.json', catalog);
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(out, 'LICENSE.txt'));
write('NOTICE.txt', '江山时序 · Chronicles of the Realm\nSource: https://github.com/DeanChensj/jiangshan-map\nGPL-3.0; see LICENSE.txt. CHGIS V6 / Hartwell-derived boundaries retain their original academic, non-commercial terms as documented in the source README. Historical borders are schematic approximations.\n');
write('version.txt', version);
console.log(`iOS atlas: ${catalog.dynasties.length} periods, ${usedSnapshots.size} stages, ${catalog.places.length} places, ${catalog.events.length} events, ${catalog.journeys.length} journeys.`);
