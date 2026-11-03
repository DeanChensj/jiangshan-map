// Pure historical queries shared by the native client. No DOM or map rendering.
(function () {
  let lastQuizDeck=[];
  const w = window, a = Object.create(w.HistoricalAtlasController.prototype);
  Object.assign(a, {dynasties:w.DYNASTY_DATA, snapshots:w.ATLAS_SNAPSHOTS,
    provinces:w.PROVINCE_OUTLINES,enLocale:w.EN_LOCALE,year:1415,locale:'zh',
    minYear:-403,maxYear:2026,_fullSnapshotsLoaded:true,dynastyIdx:14,
    projector:new w.MercatorProjector(1000,700,{west:66,east:142,south:14,north:55}),
    camera:{x:0,y:0,w:1000,h:700,zoom:1}});
  a._hydrateSnapshots();
  const tr = (zh,en) => a.locale === 'en' ? en || a.trTerm(zh || '') : a._zh(zh || '');
  const stop = (e,i,color) => ({id:String(i),year:e.year,navigationYear:e.dynasty?a._clampYearToDynasty(e.dynasty,e.year):e.year,coord:e.coord,
    site:tr(e.siteZh,e.siteEn),modern:tr(e.modernZh,e.modernEn),text:tr(e.textZh,e.textEn),
    quote:tr(e.quoteZh,e.quoteEn),color:e.personColor || color || '#bd2d22',number:e.isSharedEncounter?(e.participants||[]).map(p=>p.stepNum||p.stepIdx+1).join('·'):String(e.personStepNum||i+1),journeyStopIndex:e.journeyStopIdx??null,
    person:e.isSharedEncounter?(e.participants||[]).map(p=>tr(p.personZh,p.personEn)).join(" × "):tr(e.personZh,e.personEn),encounter:!!e.isSharedEncounter,
    dynastyID:e.dynasty?.key||'',major:!!e.isMapChange,notes:Array.isArray(e.distinctNotes)?e.distinctNotes.map(n=>({person:tr(n.personZh,n.personEn),text:tr(n.textZh,n.textEn),color:n.color||'#b5452f'})):[],fromCoord:e.fromCoord||null,via:(e.via||[]).filter(c=>Array.isArray(c)&&c.length===2)});
  function people(query) {
    const ps=a._resolvePersonProfiles(query);
    if (!ps.length) throw Error(tr('未找到人物。','No matching person.'));
    const multi=ps.length>1?a._buildPersonTracksAndEvents(ps):null;
    const es=multi?multi.events:a._collectPersonEvents(ps[0]);
    if(!es.length) throw Error(tr('此人物暂无可定位的史事。','No mapped events for this person.'));
    return {id:ps.map(p=>p.key).join(','),kind:'person',title:ps.map(p=>tr(p.zh,p.en)).join(' × '),
      subtitle:ps.map(p=>tr(p.courtesyZh,p.courtesyEn)).filter(Boolean).join(' · '),
      stops:es.map((e,i)=>stop(e,i)),tracks:multi?multi.tracks.map(t=>({id:t.profile.key,title:tr(t.profile.zh,t.profile.en),color:t.color,stops:t.events.map((e,i)=>stop(e,e.globalIdx??multi.events.findIndex(m=>m.isSharedEncounter&&(m.participants||[]).some(p=>p.personKey===e.personKey&&p.stepIdx===e.personStepIdx)),t.color))})):
      [{id:ps[0].key,title:tr(ps[0].zh,ps[0].en),color:'#bd2d22',stops:es.map((e,i)=>stop(e,i))}],
      profiles:ps.map(p=>({id:p.key,title:tr(p.zh,p.en),span:p.span||[],relic:!!p.isRelic})),eraCount:new Set(es.map(e=>e.dynasty?.key)).size,query,encounters:es.map((e,i)=>e.isSharedEncounter?i:-1).filter(i=>i>=0),distance:0};
  }
  function genealogy(lng,lat) {
    const modern=a._resolveModernLocationAt(lng,lat),closest=a._findNearestSettlement(a._getCanonicalPlaces(),lng,lat,160);
    return a.dynasties.map(d=>{
      const year=d===a.dynasties[a.dynastyIdx]?a.year:d.focusYear;
      const snap=a.snapshots[a._resolveSnapKey(d,year)] || {polities:[],regions:[],prefectures:[]};
      const hit=a._resolveEraPlaceAt(lng,lat,d,snap,modern,closest);
      const near=hit.near;
      return {id:d.key,title:a.dynastyName(d),year,polity:tr(hit.polity),
        admins:[...new Set((d.key==='prc'?[tr(modern.modernTitle||''),near?tr(near.s.ancient,near.s.ancientEn):'']:[...hit.regionObjs,...hit.prefObjs].map(p=>tr(p.title)+(p.category?(a.locale==='en'?(/侨/.test(p.category)?' (Emigre)':''):(p.title.endsWith(p.category)?'':'（'+p.category+'）')):''))).filter(Boolean))].join(' · '),
        place:near?tr(a._settlementAncient(near.s,year)):'',
        capital:!!(near&&near.km<=38&&near.s.isCapital),
        events:a._collectPlaceEventsForDynasty(d,lng,lat,near).map((e,i)=>({
          id:d.key+'-'+i,year:e.year,title:tr(e.text||e.zh||e.headline||e.textZh,e.en||e.headlineEn||e.textEn),
          coord:e.coord||e.milestone?.coord||[lng,lat]}))};
    });
  }
  function eventID(hit) {
    if(!hit.milestone||!hit.dynasty)return null;
    const index=hit.dynasty.milestones.indexOf(hit.milestone);
    if(index>=0)return `${hit.dynasty.key}-event-${index}`;
    const landmark=w.ATLAS_LORE_DATA.PLACE_LANDMARK_EVENTS.findIndex(e=>e.year===hit.milestone.year&&e.zh===hit.milestone.headline);
    return landmark>=0?`landmark-${landmark}`:null;
  }
  window.AtlasNative = function(op,p) {
    a.year=Number(p.year)||a.year;a.locale=p.lang||'zh';a.dynastyIdx=a._findDynastyIndex(a.year);
    if(op==='locate') {
      const tokens=a._parsePlaceTokens(p.place,p.years||a.year);
      if(tokens.length>1)return {tokenCount:tokens.length};
      return {...a.inspect({year:p.years||a.year,place:p.place}),tokenCount:tokens.length};
    }
    if(op==='era') return a.formatEraLabel(a.year,a.dynasties[a.dynastyIdx],p.coord||null);
    if(op==='people')return people(p.query);
    if(op==='search')return a._queryQuickSearch(p.query).slice(0,65).map((h,i)=>({
      id:String(i),kind:h.kind,title:tr(h.titleZh,h.titleEn),subtitle:tr(h.subZh,h.subEn),
      year:h.year||h.dynasty?.focusYear||a.year,coord:h.coord||null,
      person:h.personProfiles?.map(p=>p.zh).join(',')||h.personProfile?.zh||h.personKey||'',polity:h.polityKey||'',eventID:eventID(h),prefTitle:h.prefTitle||null,badge:tr(a._quickSearchKindLabel?a._quickSearchKindLabel(h.kind):'',h.kind)}));
    if(op==='detail') {
      const d=a.dynasties[a.dynastyIdx],snap=a.snapshots[a._resolveSnapKey(d,a.year)],hit=a._resolveEraPlaceAt(...p.coord,d,snap);
      const info=a.inspect({year:a.year,lng:p.coord[0],lat:p.coord[1]});
      const selectedAdmin=p.adminTitle&&[...(snap.prefectures||[]),...(snap.regions||[])].some(f=>f.title===p.adminTitle);
      return {info,rows:genealogy(...p.coord),adminTitles:selectedAdmin?[p.adminTitle]:hit.prefObjs.concat(hit.regionObjs).map(p=>p.title),heading:(p.label&&a.resolvePlace(p.label,a.year))?tr(a.resolvePlace(p.label,a.year).name):[info.modernProvince,info.nearestCity?.modern].filter(Boolean).join(' · ')};
    }
    if(op==='route') {
      const tokens=a._parsePlaceTokens(p.place,p.years||a.year);
      const missing=tokens.filter(t=>!a.resolvePlace(t.place,t.year)).map(t=>t.place);
      if(missing.length)throw Error(tr('无法定位：','Could not locate: ')+missing.join('、'));
      const r=a.inspect({place:p.place,year:p.years||a.year});
      if(!r.route||r.route.length<2)throw Error(tr('请至少输入两处地点，以逗号分隔。','Enter at least two places, separated by commas.'));
      const palette=w.HistoricalAtlasController.PERSON_TRACK_PALETTE,trackIDs=[...new Set(r.route.map(s=>s.trackIdx||0))];
      const stops=r.route.map((s,i)=>({id:String(i),year:s.year,coord:s.coord,site:s.resolvedName,
        modern:s.modern,text:[s.era,s.polity,...s.regions,...s.prefectures].filter(Boolean).join(' · '),
        quote:'',person:'',encounter:false,via:[],number:String(s.trackStepNum||r.route.slice(0,i+1).filter(t=>(t.trackIdx||0)===(s.trackIdx||0)).length),color:trackIDs.length>1?palette[trackIDs.indexOf(s.trackIdx||0)%palette.length]:'#9e2a2b'}));
      for(let i=0;i<stops.length;i++)for(let j=i+1;j<stops.length;j++){if((r.route[i].trackIdx||0)!==(r.route[j].trackIdx||0)&&a.projector.greatCircleKm(stops[i].coord,stops[j].coord)<=45){stops[i].convergencePeer=j;stops[j].convergencePeer=i;}}
      return {id:p.place,kind:'route',title:tr('自定义路线','Custom route'),subtitle:p.place,
        stops,tracks:[...new Set(r.route.map(s=>s.trackIdx||0))].map(k=>({id:String(k),title:String(k+1),
          color:trackIDs.length>1?palette[trackIDs.indexOf(k)%palette.length]:'#9e2a2b',stops:stops.filter((s,i)=>(r.route[i].trackIdx||0)===k)})),encounters:[],distance:r.routeDistanceKm,place:p.place,years:p.years||String(a.year)};
    }
    if(op==='quiz')return (p.reuse&&lastQuizDeck.length?lastQuizDeck:(lastQuizDeck=a._buildChallengeDeck())).map((q,i)=>{
      const s=q.settlement,d=q.dynasty;
      let y=s.focusYear??d.focusYear;if(s.appear!==undefined)y=Math.max(y,s.appear);if(s.vanish!==undefined)y=Math.min(y,s.vanish);y=a._clampYearToDynasty(d,y);
      const name=a._stripPromptParenthetical(tr(s.ancient,s.ancientEn||a.trTerm(s.ancient)));
      const nodes={},oldId=a._id,oldChallenge=a.challenge,oldHant=a._applyZhHantDom;
      let clue='';
      try {
        a._id=id=>nodes[id]||(nodes[id]={});a._applyZhHantDom=()=>{};a.challenge={deck:[q],index:0,score:0};a._renderChallengeQuestionText();
        const html=nodes['challenge-question'].innerHTML;
        clue=(html.match(/class="challenge-clue-box">([\s\S]*?)<\/div>/)||[])[1]||'';
        clue=clue.replace(/<\/span><span>/g,': ').replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
        if(a.locale==='zh-tw')clue=a._zh(clue);
      } finally { a._id=oldId;a.challenge=oldChallenge;a._applyZhHantDom=oldHant; }
      return {id:String(i),year:y,dynasty:a.dynastyName(d),title:name,modern:tr(s.modern,s.modernEn||a.trModernCity(s.modern)),clue,coord:s.coord,tier:q.tier};
    });
    if(op==='polity') {
      const profile=w.ATLAS_LORE_DATA.POLITY_PROFILES.find(x=>x.key===p.key||x.zh===p.key);
      const p2=profile?{...profile,curated:true}:a._resolvePolity(p.key,a.year);
      return p2?{key:p2.key,title:tr(p2.zh,p2.en),summary:tr(p2.summaryZh||'',p2.summaryEn||''),seat:tr(p2.seatZh||'',p2.seatEn||''),rulers:a._polityRulers(p2),from:p2.from,to:p2.to,titles:p2.titles,
        stages:a._polityStages(p2).map((st,i)=>({id:String(i),from:st.from,to:st.to,title:tr(st.title),caption:tr(st.caption),rawTitle:st.title,snapKey:st.snapKey})),
        events:a._polityEvents(p2).map((e,i)=>({id:String(i),year:e.year,title:e.milestone?a.milestoneHeadline(e.dynasty,e.milestone):tr(e.landmark.zh,e.landmark.en),coord:e.coord||null}))}:null;
    }
    throw Error('Unknown atlas query: '+op);
  };
})();
