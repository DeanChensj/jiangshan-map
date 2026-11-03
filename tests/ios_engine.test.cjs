'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
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
