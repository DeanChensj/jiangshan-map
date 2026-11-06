'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const context = {window:{addEventListener(){}}, console, URL, URLSearchParams,
  setTimeout(){ return 0; }, clearTimeout(){}};
vm.createContext(context);
for (const file of ['map_data','china_geo_data','atlas_snapshots','lore_data','i18n_dict','zh_hant','app','atlas_quiz']) {
  vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),context,{filename:file});
}
vm.runInContext(fs.readFileSync(path.join(root,'scripts/ios_engine.js'),'utf8'),context,{filename:'ios_engine'});
// JSON crosses the same serialization boundary as JavaScriptCore -> Swift.
const query = (op,args={}) => JSON.parse(JSON.stringify(context.window.AtlasNative(op,{year:750,lang:'zh',...args})));
const validCoordinate = coord => Array.isArray(coord) && coord.length===2 && coord.every(Number.isFinite);

test('native administrative clipping preserves holes, islands and boundary fragments', {skip:process.platform !== 'darwin'},()=> {
  assert.match(execFileSync('/usr/bin/swift',[path.join(root,'scripts/clip_ios_geometry.swift'),'--test'],{encoding:'utf8'}),/fixtures passed/);
});

for (const [lang,term] of [['zh','苏轼'],['zh-tw','蘇軾'],['en','Su Shi']]) {
  test(`search resolves Su Shi in ${lang}`,()=> {
    const hits=query('search',{lang,query:term});
    assert.ok(hits.some(hit=>hit.person));
    assert.ok(hits.every(hit=>typeof hit.id==='string' && typeof hit.year==='number'));
  });
}
test('era and polity searches retain actionable results',()=> {
  assert.ok(query('search',{query:'开元'}).some(hit=>hit.year>=713 && hit.year<=741));
  assert.ok(query('search',{query:'南诏'}).some(hit=>hit.polity));
});
test('landmark search IDs identify exported landmark records',()=> {
  const records=context.window.ATLAS_LORE_DATA.PLACE_LANDMARK_EVENTS;
  const index=records.findIndex(event=>event.zh.startsWith('萧何营建未央宫成'));
  const hit=query('search',{query:'萧何营建未央宫成'}).find(hit=>hit.kind==='event');
  assert.equal(hit.eventID,`landmark-${index}`);
});
test('administrative search preserves the chosen region when its label anchor is outside',()=> {
  const hit=query('search',{year:-218,query:'云中郡'})[0];
  const detail=query('detail',{year:hit.year,coord:hit.coord,label:hit.title,adminTitle:hit.prefTitle});
  assert.deepEqual(detail.adminTitles,['云中郡']);
});
test('selected-place links restore the trace separately from the camera center on the web',()=> {
  const a=Object.create(context.window.HistoricalAtlasController.prototype);
  const calls=[];
  Object.assign(a,{locale:'zh',_fullSnapshotsLoaded:true,camera:{x:0,y:0,w:1000,h:700,zoom:1},
    projector:new context.window.MercatorProjector(1000,700,{west:66,east:142,south:14,north:55}),
    _armUrlSync(){},jumpToYear(){},_applyCamera(){},openGenealogyAt(...coord){calls.push(coord)}});
  const oldTimer=context.setTimeout;
  context.setTimeout=fn=>{fn();return 0};
  context.location={search:'?year=750&trace=108.94,34.27&center=112.45,34.62&zoom=3'};
  try {
    a._restoreFromQuery();
    assert.deepEqual(calls,[[108.94,34.27]]);
    const center=a.projector.toGeo(a.camera.x+a.camera.w/2,a.camera.y+a.camera.h/2);
    assert.ok(Math.abs(center[0]-112.45)<1e-8 && Math.abs(center[1]-34.62)<1e-8);
  } finally {context.setTimeout=oldTimer;delete context.location;}
});
test('person comparisons retain tracks and mapped encounters',()=> {
  const result=query('people',{query:'李白,杜甫'});
  assert.equal(result.tracks.length,2);
  assert.ok(result.encounters.length>0);
  assert.ok(result.encounters.every(i=>result.stops[i].encounter));
  assert.ok(result.tracks.every(track=>track.stops.every(stop=>validCoordinate(stop.coord))));
});
test('the Imperial Seal is a navigable thirteen-stop relic journey',()=> {
  const result=query('people',{query:'yuxi'});
  assert.equal(result.stops.length,13);
  assert.ok(result.profiles.some(person=>person.relic));
});
test('all curated journeys resolve through the native bridge',()=> {
  for (const journey of context.window.ATLAS_LORE_DATA.HISTORICAL_JOURNEYS) {
    const result=query('people',{query:journey.key});
    assert.ok(result.stops.length>0,journey.key);
    assert.ok(result.stops.every(stop=>validCoordinate(stop.coord)),journey.key);
  }
});
test('parallel routes preserve track membership and convergence',()=> {
  const result=query('route',{place:'长安,洛阳;金陵,洛阳',years:'744,745;744,745'});
  assert.equal(result.tracks.length,2);
  assert.equal(result.stops.length,4);
  assert.deepEqual(result.tracks.map(track=>track.stops.length),[2,2]);
  assert.ok(result.stops.some(stop=>stop.convergencePeer!==undefined));
});
test('route years stay attached to their stops',()=> {
  const result=query('route',{place:'长安,洛阳,金陵',years:'744,745,746'});
  assert.deepEqual(result.stops.map(stop=>stop.year),[744,745,746]);
  assert.ok(result.distance>0);
});
test('unresolved route stops fail rather than drawing a partial route',()=> {
  assert.throws(()=>query('route',{place:'长安,unresolvable_atlas_test_location',years:'750'}),/无法定位/);
});
for (const lang of ['zh','zh-tw','en']) {
  test(`genealogy includes all eighteen periods in ${lang}`,()=> {
    const result=query('detail',{lang,coord:[108.94,34.27]});
    assert.equal(result.rows.length,18);
    assert.equal(new Set(result.rows.map(row=>row.id)).size,18);
    assert.ok(result.adminTitles.length>0);
  });
}
test('polity dossiers expose dated stages and event navigation',()=> {
  const result=query('polity',{key:'唐'});
  assert.ok(result.stages.length>0);
  assert.ok(Array.isArray(result.events));
  assert.ok(result.stages.every(stage=>stage.from<=stage.to && stage.snapKey));
  assert.ok(query('polity',{key:'南诏'}).events.length>0);
});
test('quiz translation preserves the deck and answer coordinates',()=> {
  const original=query('quiz');
  assert.equal(original.length,10);
  assert.ok(original.every(question=>question.clue.trim() && validCoordinate(question.coord)));
  const translated=query('quiz',{lang:'en',reuse:true});
  assert.deepEqual(translated.map(question=>[question.id,question.year,question.coord]),
    original.map(question=>[question.id,question.year,question.coord]));
});
test('dated site names do not overlap and closure years stay hidden',()=> {
  const sites=JSON.parse(fs.readFileSync(path.join(root,'assets/tang_focus.json'),'utf8')).sites;
  assert.equal(new Set(sites.map(site=>site.id)).size,sites.length);
  for (const site of sites) {
    assert.ok(validCoordinate(site.coord),site.id);
    assert.ok(site.from<=site.until,site.id);
    assert.ok(new URL(site.sourceURL).protocol==='https:',site.id);
    const names=site.names||[site];
    names.forEach((name,i)=> {
      assert.ok(site.from<=name.from && name.from<=name.until && name.until<=site.until,site.id);
      if (i) assert.ok(names[i-1].until<name.from,site.id);
    });
  }
  const temple=sites.find(site=>site.id==='tang-qinglong');
  const at=year=>temple.names.find(name=>name.from<=year && year<=name.until)?.title;
  assert.equal(at(620),'灵感寺');assert.equal(at(621),undefined);
  assert.equal(at(661),undefined);assert.equal(at(662),'观音寺');
  assert.equal(at(710),'观音寺');assert.equal(at(711),'青龙寺');
  assert.equal(at(845),undefined);assert.equal(at(846),'护国寺');assert.equal(at(855),'青龙寺');
});


test('native place classification uses every web route delimiter and inline dates',()=> {
  for (const place of ['长安->洛阳','长安；洛阳']) {
    assert.equal(query('locate',{place,years:'750'}).tokenCount,2);
    assert.equal(query('route',{place,years:'750'}).stops.length,2);
  }
  const place=query('locate',{year:1415,place:'750:长安'});
  assert.equal(place.tokenCount,1);assert.equal(place.year,750);
});
test('person stop navigation dates stay in their recorded dynasty',()=> {
  for (const person of context.window.ATLAS_LORE_DATA.PERSON_PROFILES) {
    const result=query('people',{query:person.key});
    for (const stop of result.stops) {
      const dynasty=context.window.DYNASTY_DATA.find(d=>d.key===stop.dynastyID);
      assert.ok(stop.navigationYear>=dynasty.fromYear && stop.navigationYear<=dynasty.toYear,person.key);
    }
  }
  const terminal=query('people',{query:'caocao'}).stops.findLast(stop=>stop.year===220);
  assert.ok(terminal,'Cao Cao retains the recorded terminal event');
  assert.equal(terminal.year,220);assert.equal(terminal.navigationYear,219);
});


test('administrative meshes preserve the web boundary curves and short subpaths',()=> {
  const {svgPathLines}=require('../scripts/ios_geometry.cjs');
  const w=context.window,a=Object.create(w.HistoricalAtlasController.prototype);
  Object.assign(a,{dynasties:w.DYNASTY_DATA,snapshots:w.ATLAS_SNAPSHOTS,provinces:w.PROVINCE_OUTLINES,
    projector:new w.MercatorProjector(1000,700,{west:66,east:142,south:14,north:55})});
  const svg=a._buildPrefectureBoundaryPath(a.snapshots.s_ming_b.prefectures);
  const lines=svgPathLines(svg),points=new Set(lines.flat().map(p=>p.join(',')));
  const curves=[...svg.matchAll(/Q(-?[\d.]+)[ ,]+(-?[\d.]+)[ ,]+(-?[\d.]+)[ ,]+(-?[\d.]+)/g)];
  assert.ok(curves.length>3000);
  for(const q of curves)assert.ok(points.has([Number(q[3]),Number(q[4])].join(',')),'Missing curve endpoint '+q[0]);
  const short=svg.split(/(?=M)/).filter(p=>p.includes('Q')&&!p.includes('L'));
  assert.ok(short.length>0);
  for(const path of short)assert.ok(svgPathLines(path)[0].length>2,'Dropped short boundary '+path);
});
test('every curated polity search navigates within its mapped lifespan',()=> {
  for(const profile of context.window.ATLAS_LORE_DATA.POLITY_PROFILES) {
    const hit=query('search',{query:profile.zh}).find(hit=>hit.polity===profile.key);
    assert.ok(hit,profile.key);
    assert.ok(profile.from<=hit.year && hit.year<=profile.to,profile.zh+' year '+hit.year);
    const detail=query('polity',{key:profile.key,year:hit.year});
    assert.ok(detail.stages.some(stage=>stage.from<=hit.year&&hit.year<=stage.to),profile.zh);
  }
});
test('uncurated polity identifiers survive translation and a later query year',()=> {
  for(const [name,year] of [['秦',-214],['秦（薛举）',617],['明',1415]]) {
    const first=query('polity',{key:name,year});
    assert.ok(first.key.startsWith('t:'));assert.ok(first.stages.length>0);
    for(const lang of ['zh','en','zh-tw']) {
      const reopened=query('polity',{key:first.key,year:2026,lang});
      assert.equal(reopened.key,first.key);assert.equal(reopened.from,first.from);assert.equal(reopened.to,first.to);
      assert.equal(reopened.stages.length,first.stages.length);
      assert.ok(!reopened.title.startsWith('t:'));
    }
  }
});


test('comparison tracks discard campaign legs whose preceding stop changed',()=> {
  const result=query('people',{query:'qinshihuang,wangjian'});
  const track=result.tracks.find(track=>track.id==='qinshihuang');
  const index=track.stops.findIndex(stop=>stop.year===-228&&stop.site==='邯郸');
  assert.ok(index>0);
  assert.equal(track.stops[index-1].year,-229);
  assert.deepEqual(track.stops[index].fromCoord,track.stops[index-1].coord);
  assert.deepEqual(track.stops[index].via,[]);
  assert.equal(track.stops[index].hasLeg,false);
  assert.ok(track.stops.some(stop=>stop.hasLeg&&stop.via.length),'Keep applicable curated legs');
  for(const track of result.tracks)assert.equal(track.stops[0].hasLeg,false);
});

test('genealogy retains owner periods, navigation dates and catalog event identities',()=> {
  for(const lang of ['zh','en','zh-tw']) {
    const detail=query('detail',{lang,coord:[118.35,36.82]});
    const row=detail.rows.find(row=>row.id==='zhanguo');
    const terminal=row.events.find(event=>event.year===-221);
    assert.ok(terminal);assert.equal(terminal.dynastyID,row.id);assert.equal(terminal.navigationYear,-222);
    assert.equal(terminal.eventID,null);
    for(const row of detail.rows)for(const event of row.events) {
      const owner=context.window.DYNASTY_DATA.find(d=>d.key===row.id);
      assert.equal(event.dynastyID,row.id);
      assert.ok(event.navigationYear>=owner.fromYear && event.navigationYear<owner.toYear);
    }
    const changan=query('detail',{lang,coord:[108.94,34.27]});
    assert.ok(changan.rows.some(row=>row.events.some(event=>event.eventID?.includes('-event-'))));
  }
});
