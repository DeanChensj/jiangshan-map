#!/usr/bin/env node
// Original generalized metric reconstructions; see assets/historical-cities/README.md.
// No modern road geometry, map-image tracing, network access or GIS dependencies.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'assets/historical-cities');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/zh_hant.js'), 'utf8'), ctx);
const hant = s => ctx.window.ZH_HANT_CONV.toHant(s);
const sources = JSON.parse(fs.readFileSync(path.join(out, 'sources.json')));
const controlPoints = JSON.parse(fs.readFileSync(path.join(out, 'control-points.json'))).points;
const site = id => controlPoints.find(s => s.id === id).coord;
const rad = Math.PI / 180, mLat = 111320;
const round = n => +n.toFixed(5);
const features = [], labels = [], cities = [];
const rect = (w, s, e, n) => [[w,s],[e,s],[e,n],[w,n],[w,s]];
function frame(anchor, localAnchor, bearing, scale = 1) {
  const c = Math.cos(bearing), s = Math.sin(bearing), mLon = mLat * Math.cos(anchor[1] * rad);
  return ([x,y]) => {
    x = (x - localAnchor[0]) * scale; y = (y - localAnchor[1]) * scale;
    return [round(anchor[0] + (x*c + y*s)/mLon), round(anchor[1] + (y*c - x*s)/mLat)];
  };
}
function city(id, title, titleEn, project, frameInfo, extent) {
  const data = { id, title, titleEn, titleHant:hant(title), from:742, until:755, referenceYear:750,
    uncertaintyM:id === 'changan' ? 400 : 350, frame:frameInfo,
    note:'约750年的考古格局示意；742–755为浏览范围。虚线为概略位置，非精确测绘。',
    noteEn:'Generalized archaeological plan, c. 750. Viewing range: 742–755. Dashed boundaries are approximate, not surveyed outlines.' };
  const corners = rect(...extent).map(project);
  data.bounds = [Math.min(...corners.map(p=>p[0])), Math.min(...corners.map(p=>p[1])), Math.max(...corners.map(p=>p[0])), Math.max(...corners.map(p=>p[1]))];
  cities.push(data);
  function add(key, kind, name, nameEn, coords, options = {}) {
    const type = options.type || (['gate','bridge','caption','monument','temple','site'].includes(kind) ? 'Point' : ['street','wall','waterway','canal'].includes(kind) ? 'LineString' : 'Polygon');
    const properties = { id:id+'-'+key, city:id, kind, title:name, titleEn:nameEn, titleHant:hant(name),
      from:742, until:755, referenceYear:750, evidence:'schematic', uncertaintyM:data.uncertaintyM,
      sourceIDs:(options.sources || (id === 'changan' ? ['su-1978','yau-1986'] : ['luoyang-2014'])).join('|'),
      detail:options.detail || ({ward:'仅示考古复原格局中的里坊范围；未绘内部宅院、坊门或逐年的改建。',street:'唐代街道轴线的概略复原。线宽为制图符号，不表示实测路幅，也不是现代道路。',waterway:'古代河道的大致通道，非精确岸线；线宽不代表河宽。',market:'市场区域的概位。内部街道仅在有证据时绘示，不表示店铺轮廓。',granary:'考古复原格局中的含嘉仓城范围；未绘仓窖单体。'}[kind] || '依据考古复原格局绘制的概略位置；不表示现存建筑或精确遗址边界。'),
      detailEn:options.detailEn || ({ward:'A ward in the archaeological reconstruction. Internal houses, ward gates and year-by-year alterations are omitted.',street:'Generalized Tang street alignment. Line widths are cartographic symbols, not surveyed road widths or modern streets.',waterway:'Schematic ancient river corridor, not precise banks. The line width does not represent the river width.',market:'Generalized market precinct. Internal streets are included only where supported; shop footprints are omitted.',granary:'Generalized Hanjia granary precinct. Individual storage pits are omitted.'}[kind] || 'Generalized placement from the archaeological reconstruction; not a surviving building or a precise archaeological boundary.'),
      rank:options.rank ?? 2, ...(options.locator ? {sourceLocator:options.locator} : {}), ...options.properties };
    const projectPoint = options.geographic ? p => p.map(round) : project;
    const geometry = { type, coordinates:type === 'Point' ? projectPoint(coords) : type === 'Polygon' ? [coords.map(projectPoint)] : coords.map(projectPoint) };
    features.push({ type:'Feature', id:properties.id, properties, geometry });
    if (name && options.label !== false && !['panel','wall'].includes(kind)) {
      const at = options.at || (type === 'Point' ? coords : type === 'Polygon' ? [(Math.min(...coords.map(p=>p[0]))+Math.max(...coords.map(p=>p[0])))/2,(Math.min(...coords.map(p=>p[1]))+Math.max(...coords.map(p=>p[1])))/2] : coords[Math.floor(coords.length/2)]);
      labels.push({type:'Feature', id:properties.id+'-label',properties:{...properties,id:properties.id+'-label',featureID:properties.id},geometry:{type:'Point',coordinates:projectPoint(at)}});
    }
  }
  return add;
}

// CHANG'AN: source dimensions in meters; unequal column widths, nine southern rows.
const caAnchor = site('tang-taiji');
const ca = frame(caAnchor,[0,8030],2*rad);
const A = city('changan','长安','Chang’an',ca,{anchor:caAnchor,anchorID:'Q10038732',localAnchorM:[0,8030],bearingDegrees:2,method:'Metric reconstruction anchored to approximate Taiji site; no survey fit'},[-5500,-650,5500,11700]);
A('outer','wall','外郭城','Outer enclosure',rect(-4860.5,0,4860.5,8651.7),{label:false});
A('taiji','palace','太极宫城','Taiji palace city',rect(-1410,7160,1410,8651.7),{rank:0,sources:['su-1978','yau-1986']});
A('imperial','imperial','皇城','Imperial precinct',rect(-1410,5316,1410,7159),{at:[-700,6250],rank:0,sources:['su-1978','yau-1986']});
A('daming','palace','大明宫','Daming Palace',[[1450,8652],[3124,8652],[3124,9702],[2824,9702],[2585,10908],[1450,10908],[1450,8652]],{rank:0,at:[2200,9600],sources:['su-1978','yau-1986'],locator:'Su Bai 1978 p. 414; Yau PDF p. 26. Generalized closure using 1674 m southern width, 1135 m northern width and 2256 m western depth.'});
A('xingqing','palace','兴庆宫','Xingqing Palace',rect(3700,4900,4850,6550),{rank:1,locator:'Su Bai 1978 pp. 415–416: the enclosure discussion includes a 753 phase. Composite palace-area envelope, not a claim that this surveyed wall existed in 750.',detail:'兴庆宫区域的概略合成范围。史料所论围垣包括753年的营建阶段，不表示所绘城墙在750年已建成。',detailEn:'Generalized composite palace area. The source enclosure includes a 753 construction phase; this does not assert that the drawn wall already existed in 750.'});
A('taiye','water-area','太液池（概略）','Taiye Pool (schematic)',[[1720,10000],[1900,10160],[2250,10190],[2480,10100],[2500,9900],[2250,9770],[1950,9800],[1720,10000]],{at:[2180,10040],sources:['yau-1986'],properties:{uncertaintyM:250}});
const xs=[-4860.5,-3700,-2550,-1410,-700,0,700,1410,2550,3700,4860.5];
const ys=[0,590,1180,1770,2360,2950,3540,4130,4720,5316];
// Selected legible names in Su Bai fig. 3. Unreadable/phase-uncertain names stay unnamed.
const caWardNames={'8-3':['太平坊','Taiping Ward'],'8-4':['光禄坊','Guanglu Ward'],'8-5':['兴道坊','Xingdao Ward'],'8-7':['平康坊','Pingkang Ward'],'7-7':['宣阳坊','Xuanyang Ward'],
  '6-0':['崇化坊','Chonghua Ward'],'6-1':['怀远坊','Huaiyuan Ward'],'6-2':['延康坊','Yankang Ward'],'6-3':['兴化坊','Xinghua Ward'],'6-5':['安仁坊','Anren Ward'],
  '6-6':['长兴坊','Changxing Ward'],'6-7':['亲仁坊','Qinren Ward'],'6-8':['安邑坊','Anyi Ward'],'6-9':['靖恭坊','Jinggong Ward'],
  '5-8':['宣平坊','Xuanping Ward'],'7-9':['常乐坊','Changle Ward'],
  '0-3':['安乐坊','Anle Ward'],'0-4':['延祚坊','Yanzuo Ward'],'0-5':['安义坊','Anyi Ward'],'0-6':['安德坊','Ande Ward'],'0-7':['通济坊','Tongji Ward']};
for(let row=0;row<9;row++) for(let col=0;col<10;col++) {
  if ((row>=7 && (col===1 || col===8)) || (row<2 && col>=8) || (row===8 && col===9)) continue;
  const name=caWardNames[`${row}-${col}`] || ['',''];
  A(`ward-s-${row}-${col}`,'ward',...name,rect(xs[col]+45,ys[row]+35,xs[col+1]-45,ys[row+1]-35),{properties:{title:name[0]||'里坊（示意）',titleEn:name[1]||'Ward (schematic)',titleHant:hant(name[0]||'里坊（示意）')},label:!!name[0],locator:'Su Bai 1978 fig. 3, reproduced in Yau PDF p. 25; rounded ward envelope, plan name rather than a year-by-year name history.'});
}
for(let row=0;row<4;row++) for(let side of [-1,1]) for(let col=0;col<3;col++) {
  // Eastern palace expansion/split wards are left blank rather than guessed.
  if(side===1 && (col===2 && row<2 || col===0 && row===3)) continue;
  const w=side===-1?xs[col]:xs[col+7], e=side===-1?xs[col+1]:xs[col+8];
  const name=side===1 && row===0 && col===0 ? ['崇仁坊','Chongren Ward'] : ['',''];
  A(`ward-n-${side}-${row}-${col}`,'ward',...name,rect(w+45,5316+row*834+40,e-45,5316+(row+1)*834-40),{label:!!name[0],locator:name[0]?'Su Bai 1978 fig. 3, reproduced in Yau PDF p. 25; Chongren lies north of Chunming–Jinguang Avenue.':undefined,properties:{title:name[0]||'里坊（示意）',titleEn:name[1]||'Ward (schematic)',titleHant:hant(name[0]||'里坊（示意）')}});
}
for(let i=1;i<xs.length-1;i++) {
  if(xs[i]===0) continue;
  const major=Math.abs(xs[i])===1410;
  A('street-ns-'+i,'street',major?(xs[i]<0?'安化门大街':'启夏门大街'):'',major?(xs[i]<0?'Anhua Gate Avenue':'Qixia Gate Avenue'):'',[[xs[i],80],[xs[i],Math.abs(xs[i])<=1410?5316:8600]],{rank:major?1:3,label:major,at:[xs[i],2200]});
}
for(let i=1;i<ys.length;i++) {
  const marketBand=i===8;
  const ranges=marketBand?[[-4800,-3700],[-2550,2550],[3700,4800]]:[[-4800,4800]];
  ranges.forEach(([w,e],part)=>A(`street-ew-${i}-${part}`,'street',i===9?'春明门—金光门大街':i===5?'延兴门—延平门大街':'',i===9?'Chunming–Jinguang Avenue':i===5?'Yanxing–Yanping Avenue':'',[[w,ys[i]],[e,ys[i]]],{rank:i===9||i===5?1:3,label:part===0 && (i===9||i===5),at:[-3200,ys[i]]}));
}
for(let y of [6150,6984,7818]) for(let side of [-1,1]) A(`street-north-${y}-${side}`,'street',y===6984?'开远门—通化门大街':'',y===6984?'Kaiyuan–Tonghua Avenue':'',side<0?[[-4800,y],[-1450,y]]:[[1450,y],[y===6150?3650:4800,y]],{rank:y===6984?1:3,label:y===6984,at:[side*3200,y]});
A('zhuque','street','朱雀大街','Zhuque Avenue',[[0,90],[0,5316]],{rank:0,at:[0,2700]});
A('chengtian','street','承天门街','Chengtian Avenue',[[0,5316],[0,7160]],{rank:1,at:[0,6100]});
A('danfeng-avenue','street','丹凤门街','Danfeng Avenue',[[1900,6984],[1900,8652]],{rank:1,at:[1900,7750]});
for(let [key,name,en,w] of [['west-market','西市','West Market',-3625],['east-market','东市','East Market',2655]]) {
  const s=4200,e=w+927,n=s+1031;
  A(key,'market',name,en,rect(w,s,e,n),{rank:0,at:[w+463,s+515],sources:['su-1978','yau-1986']});
  for(let t of [1/3,2/3]) {
    A(`${key}-ns-${t}`,'street','','',[[w+927*t,s+20],[w+927*t,n-20]],{rank:4,label:false});
    A(`${key}-ew-${t}`,'street','','',[[w+20,s+1031*t],[e-20,s+1031*t]],{rank:4,label:false});
  }
}
for(const [key,name,en,p] of [
  ['mingde','明德门','Mingde Gate',[0,0]],['anhua','安化门','Anhua Gate',[-1410,0]],['qixia','启夏门','Qixia Gate',[1410,0]],
  ['kaiyuan','开远门','Kaiyuan Gate',[-4860.5,6984]],['jinguang','金光门','Jinguang Gate',[-4860.5,5316]],['yanping','延平门','Yanping Gate',[-4860.5,2950]],
  ['tonghua','通化门','Tonghua Gate',[4860.5,6984]],['chunming','春明门','Chunming Gate',[4860.5,5316]],['yanxing','延兴门','Yanxing Gate',[4860.5,2950]],
  ['guanghua','光化门','Guanghua Gate',[-3700,8652]],['jingyao','景曜门','Jingyao Gate',[-2700,8652]],['fanglin','芳林门','Fanglin Gate',[-1700,8652]],
  ['zhuque-gate','朱雀门','Zhuque Gate',[0,5316]],['chengtian-gate','承天门','Chengtian Gate',[0,7160]],['danfeng-gate','丹凤门','Danfeng Gate',[1900,8652]]
]) A(key,'gate',name,en,p,{rank:key==='mingde'?0:1});

// Evidence-backed additions. Small sites remain points; no invented palace/hall footprints.
const caPlan='Su Bai 1978 fig. 3 (reproduction in Yau PDF p. 25)';
A('east-palace','precinct','东宫','Eastern Palace',rect(700,7200,1380,8610),{rank:1,locator:caPlan});
A('yeting','precinct','掖庭宫','Yeting Palace',rect(-1380,7200,-700,8150),{rank:1,locator:caPlan});
A('taicang','precinct','太仓','Taicang granary',rect(-1380,8150,-700,8610),{rank:1,locator:caPlan});
A('xineiyuan','garden','西内苑（概略）','West Inner Garden (schematic)',rect(-1410,8700,1400,9450),{rank:1,locator:caPlan,properties:{uncertaintyM:500}});
for(const [id,title,en,p,locator] of [
  ['hanyuan','含元殿遗址','Hanyuan Hall site',[1900,9262],'Su Bai 1978 p. 414: site 610 m north of Danfeng Gate; hall platform 75.9 × 41.3 m. Point only.'],
  ['linde','麟德殿遗址','Linde Hall site',[1540,10200],'Su Bai 1978 pp. 414–415: west of Taiye Pool, 90 m east of the western palace wall; Yau PDF p. 26 for relative northing. Point only.'],
  ['xuanzheng','宣政殿遗址','Xuanzheng Hall site',[1900,9530],'Yau PDF p. 26, Daming archaeological survey plan. Approximate alignment, point only.'],
  ['taimiao','太庙（概位）','Ancestral Temple (approx.)',[1000,5570],caPlan],
  ['sheji','社稷坛（概位）','Altars of Soil & Grain (approx.)',[-1000,5570],caPlan],
  ['furong','芙蓉园（概位）','Furong Garden area',[4300,1200],'Su Bai 1978 pp. 415–416 and fig. 3. Garden-area point; the later surveyed 827–840 shore is not projected back to 750.'],
  ['qujiang','曲江池（岸线未复原）','Qujiang Pool (banks omitted)',[4550,150],'Su Bai 1978 pp. 415–416 and fig. 3. Pool-area point only; no reconstructed shoreline.']
]) A(id,id==='furong'||id==='qujiang'?'site':'monument',title,en,p,{rank:2,locator,properties:{uncertaintyM:500}});
for(const [id,title,en,p] of [
  ['ci-en','大慈恩寺 · 大雁塔','Ci’en Temple · Giant Wild Goose Pagoda',[108.959335,34.219769]],
  ['jianfu','荐福寺 · 小雁塔','Jianfu Temple · Small Wild Goose Pagoda',[108.937358,34.240803]],
  ['qinglong','青龙寺','Qinglong Temple',[108.98461,34.23385]]
]) A(id,'temple',title,en,p,{geographic:true,rank:1,sources:['su-1978','wikidata-cc0'],locator:caPlan+'; rounded CC0 Wikidata P625 site point, not temple boundaries.',properties:{evidence:'approximate-site',uncertaintyM:150}});
A('daxingshan','temple','大兴善寺（概位）','Daxingshan Temple (approx.)',[1050,2650],{rank:2,locator:'Su Bai 1978 p. 413 and fig. 3, temple in Jingshan Ward; generalized location, no footprint.',properties:{uncertaintyM:500}});
const canalNote='宿白仅确认部分渠段，其他城内走向尚不清楚。此线只表示已知局部的大致通道，不连接成完整渠网，也不表示渠宽。';
const canalNoteEn='Su Bai identifies only some channel sections; much of the intramural course remains unknown. This short line marks a generalized known section, not a complete network or a surveyed channel width.';
for(const [id,title,en,points,locator] of [
  ['yongan-section','永安渠（已知局部）','Yong’an Canal (known section)',[[-2780,4000],[-2800,4700],[-2800,5400]],'Su Bai 1978 p. 410: section near the West Market, northward past Huaiyuan Ward.'],
  ['qingming-section','清明渠（已知局部）','Qingming Canal (known section)',[[-1360,3600],[-1360,4080]],'Su Bai 1978 p. 410: surveyed segment just inside the western wall of Xinghua Ward.'],
  ['longshou-section','龙首渠南支（已知局部）','Longshou Canal south branch (section)',[[4860,7450],[4350,7450],[4250,7000],[4250,6550]],'Su Bai 1978 p. 410: enters Xingning north of Tonghua Gate, turns south through Yongjia toward Xingqing. Rounded route relationships only.']
]) A(id,'canal',title,en,points,{rank:2,detail:canalNote,detailEn:canalNoteEn,locator,properties:{uncertaintyM:500}});
for(const [id,title,en,p] of [
  ['ca-xuanwu','玄武门（太极宫）','Xuanwu Gate · Taiji',[0,8652]],
  ['anfumen','安福门','Anfu Gate',[-1000,7160]],['yanximen','延喜门','Yanxi Gate',[1000,7160]],
  ['hanguang','含光门','Hanguang Gate',[-1000,5316]],['anshang','安上门','Anshang Gate',[1000,5316]],
  ['shunyi','顺义门','Shunyi Gate',[-1410,6150]],['jingfeng','景风门','Jingfeng Gate',[1410,6150]],
  ['daming-xuanwu','玄武门（大明宫）','Xuanwu Gate · Daming',[1900,10908]]
]) A(id,'gate',title,en,p,{rank:2,locator:caPlan});

// LUOYANG: align two approximate gate anchors, retaining their documented uncertainty.
const dd=site('tang-dingding'),yt=site('tang-yingtian');
const east=(yt[0]-dd[0])*mLat*Math.cos(dd[1]*rad), north=(yt[1]-dd[1])*mLat;
const bearing=Math.atan2(east,north), scale=Math.hypot(east,north)/4900;
const ly=frame(dd,[0,0],bearing,scale);
const L=city('luoyang','洛阳','Luoyang',ly,{anchor:dd,anchorID:'Q10948766',localAnchorM:[0,0],secondAnchor:yt,secondAnchorID:'Q11491257',secondLocalAnchorM:[0,4900],bearingDegrees:+(bearing/rad).toFixed(3),scale:+scale.toFixed(5),method:'Two approximate site points establish direction and scale; schematic precinct/ward layout'},[-2400,-650,5700,8050]);
L('wall-south','wall','南城墙','Southern enclosure',[[-2050,0],[5100,0]],{label:false});
L('wall-east','wall','东城墙','Eastern enclosure',[[5100,0],[5100,7300]],{label:false});
L('wall-north','wall','北城墙','Northern enclosure',[[-1100,6850],[5100,7300]],{label:false});
L('palace','palace','宫城','Palace city',rect(-1100,4900,1100,6850),{rank:0});
L('imperial','imperial','皇城','Imperial precinct',rect(-1100,4250,1100,4900),{rank:0,at:[-650,4600]});
L('east-city','imperial','东城','East city',rect(1100,4900,1700,6100),{rank:1});
L('hanjia','granary','含嘉仓城','Hanjia granary',rect(1100,6100,1700,7000),{rank:1});
L('north-enclosure','precinct','北部重城（概位）','Northern palace enclosure (approx.)',rect(-1060,6300,1060,6800),{rank:2,sources:['su-1978','luoyang-2014'],locator:'Su Bai 1978 fig. 6 (PDF p. 11), northern palace enclosure marked 圆璧城; generalized within the overall palace envelope, not a precise sub-wall survey.',properties:{uncertaintyM:500}});
const named = { '0-3':['宁人坊','Ningren Ward'],'0-4':['明教坊','Mingjiao Ward'],'0-5':['乐和坊','Lehe Ward'],
  '1-4':['宜人坊','Yiren Ward'],'1-5':['正平坊','Zhengping Ward'],'1-6':['敦行坊','Dunxing Ward'],
  '1-11':['履道坊','Lüdao Ward'],'3-6':['宣范坊','Xuanfan Ward'],'3-7':['道化坊','Daohua Ward'],
  '4-6':['恭安坊','Gong’an Ward'],'4-7':['温柔坊','Wenrou Ward'],'4-8':['思顺坊','Sishun Ward'],
  '5-2':['雒滨坊','Luobin Ward'],'5-3':['积善坊','Jishan Ward'],'5-4':['尚善坊','Shangshan Ward'],
  '5-5':['旌善坊','Jingshan Ward'],'5-6':['劝善坊','Quanshan Ward'],'5-7':['择善坊','Zeshan Ward'],'5-8':['福善坊','Fushan Ward'] };
const lyXs=[-2200,-1650,-1100,-550,0,550,1100,1650,2200,2750,3300,3850,4400,5050];
for(let row=0;row<6;row++) for(let col=0;col<13;col++) {
  if(col<2 && row>1) continue; // irregular western limit is not reconstructed
  if(col===9 && row>=4) continue; // South Market occupies two ward modules.
  const name=named[`${row}-${col}`] || ['',''];
  L(`ward-${row}-${col}`,'ward',...name,rect(lyXs[col]+35,70+row*550,lyXs[col+1]-35,550+row*550),{label:!!name[0],sources:name[0]==='正平坊'?['luoyang-2014','zhengping-2024']:['luoyang-2014'],properties:{title:name[0]||'里坊（示意）',titleEn:name[1]||'Ward (schematic)',titleHant:hant(name[0]||'里坊（示意）')}});
}
for(let x of lyXs.slice(1,-1)) if(x!==0) L('street-ns-'+x,'street','','',[[x,80],[x,x<-1100?1120:3340]],{label:false,rank:3});
for(let y of [590,1140,1690,2240,2790,3340]) {
  const ranges=y===2790?[[-1050,2750],[3300,5050]]:[[y<1500?-2050:-1050,5050]];
  ranges.forEach(([w,e],part)=>L(`street-ew-${y}-${part}`,'street','','',[[w,y],[e,y]],{label:false,rank:3}));
}
L('south-market','market','南市','South Market',rect(2785,2275,3265,3305),{rank:0,sources:['su-1978','luoyang-2014'],locator:'Su Bai 1978 p. 422: Sui Fengdu/South Market location retained; CASS 2014 plan reproduced in Palace Museum PDF p. 12 for ward relationship.',detail:'南市为隋丰都市延续而来。范围依据考古复原图概括；未复原市场内部街道与店铺。',detailEn:'The South Market continued the Sui Fengdu Market. Generalized precinct from the archaeological plan; its internal streets and shops are omitted.'});
// Reconstruct selected northern wards, leaving the Chan corridor and unresolved edge cells blank.
const neRows=[['承福坊','玉鸡坊','铜驼坊','上林坊','温雅坊'],['立德坊','归义坊','景行坊','时邕坊','积德坊'],['清化坊','思恭坊','北市','立行坊','教业坊'],['道光坊','履顺坊','敦厚坊','殖业坊','兴艺坊'],['道政坊','进德坊','修义坊','丰财坊','通远坊']];
const neRoman=[['Chengfu','Yuji','Tongtuo','Shanglin','Wenya'],['Lide','Guiyi','Jingxing','Shiyong','Jide'],['Qinghua','Sigong','North Market','Lixing','Jiaoye'],['Daoguang','Lüshun','Dunhou','Zhiye','Xingyi'],['Daozheng','Jinde','Xiuyi','Fengcai','Tongyuan']];
const neCols=[[1700,2250],[2250,2800],[2800,3350],[3750,4300],[4500,5050]];
for(let row=0;row<5;row++)for(let col=0;col<neCols.length;col++) {
  const [w,e]=neCols[col],s=4550+row*500,n=s+500,isMarket=row===2&&col===2;
  L(`northeast-${row}-${col}`,isMarket?'market':'ward',neRows[row][col],isMarket?'North Market':neRoman[row][col]+' Ward',rect(w+35,s+35,e-35,n-35),{rank:isMarket?0:2,sources:isMarket?['su-1978','luoyang-2014']:['luoyang-2014'],locator:'CASS 2014 vol. 1 p. 71, reproduced in Palace Museum Journal 2021 PDF p. 12, fig. 9; selected plan names and rounded envelopes. North Market also attested by Su Bai 1978 p. 422.'});
}
for(const [id,title,en,p] of [
  ['xuanwu','玄武门（宫城北部）','Xuanwu Gate · palace',[0,6300]],
  ['youye','右掖门','Right Ye Gate',[-550,4250]],['zuoye','左掖门','Left Ye Gate',[550,4250]]
])L(id,'gate',title,en,p,{rank:2,sources:['su-1978','luoyang-2014'],locator:'Su Bai 1978 fig. 6 (PDF p. 11); gate locations generalized against the overall palace/imperial precinct.'});
L('dingding-avenue','street','定鼎门大街（天街）','Dingding Avenue (Tianjie)',[[0,60],[0,3500]],{rank:0,at:[0,1850]});
L('duanmen-avenue','street','端门街','Duanmen Avenue',[[0,4050],[0,4900]],{rank:1,at:[0,4550]});
L('luo','waterway','洛水（河道示意）','Luo River (schematic corridor)',[[-2250,3630],[-1300,3820],[-500,3720],[0,3900],[650,3950],[1400,4300],[2200,4450],[3200,4350],[4100,4450],[5400,4450]],{rank:0,at:[2700,4380],properties:{uncertaintyM:500}});
L('chan','waterway','瀍水（河道示意）','Chan River (schematic corridor)',[[3500,7400],[3450,6500],[3400,5800],[3550,5150],[3500,4500]],{rank:1,at:[3470,5750],properties:{uncertaintyM:500}});
L('tianjin','bridge','天津桥（概位）','Tianjin Bridge (approx.)',[0,3900],{rank:1});
for(const [key,name,en,p] of [
  ['dingding','定鼎门','Dingding Gate',[0,0]],['yingtian','应天门','Yingtian Gate',[0,4900]],['duanmen','端门','Duanmen Gate',[0,4250]],
  ['houzai','厚载门','Houzai Gate',[-1100,0]],['changxia','长夏门','Changxia Gate',[2200,0]],
  ['jianchun','建春门','Jianchun Gate',[5100,2240]],['yongtong','永通门','Yongtong Gate',[5100,1140]],['shangdong','上东门','Shangdong Gate',[5100,5450]],
  ['anxi','安喜门','Anxi Gate',[3500,7190]],['longguang','龙光门','Longguang Gate',[0,6930]]
]) L(key.replace(/[^a-z-]/g,''),'gate',name,en,p,{rank:key==='dingding'?0:1,properties:key==='dingding'||key==='yingtian'?{evidence:'approximate-site',uncertaintyM:100,sourceIDs:'luoyang-2014|wikidata-cc0'}:{}});

// Focused build-time checks, not an application test suite.
const ids=new Set(), sourceIDs=new Set(sources.sources.map(s=>s.id));
for(const f of [...features,...labels]) {
  if(ids.has(f.id)) throw Error('Duplicate historical feature: '+f.id); ids.add(f.id);
  for(const s of f.properties.sourceIDs.split('|').filter(Boolean)) if(!sourceIDs.has(s)) throw Error('Missing source '+s);
  if(f.properties.from!==742 || f.properties.until!==755) throw Error('Unexpected coverage');
  function check(c){if(typeof c[0]==='number'){if(c.length!==2||!c.every(Number.isFinite)||c[0]<-180||c[0]>180||c[1]<-90||c[1]>90)throw Error('Invalid coordinates');}else c.forEach(check);}
  check(f.geometry.coordinates);
  if(f.geometry.type==='Polygon') for(const ring of f.geometry.coordinates) if(ring.length<4||JSON.stringify(ring[0])!==JSON.stringify(ring.at(-1)))throw Error('Unclosed ring '+f.id);
}
for(const c of cities) c.featureCounts=Object.fromEntries([...new Set(features.filter(f=>f.properties.city===c.id).map(f=>f.properties.kind))].filter(k=>k!=='panel'&&k!=='caption').map(k=>[k,features.filter(f=>f.properties.city===c.id&&f.properties.kind===k).length]));
const write=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value)+'\n');
write('cities.geojson',{type:'FeatureCollection',features});
write('labels.geojson',{type:'FeatureCollection',features:labels});
write('catalog.json',{schemaVersion:1,license:'CC0-1.0',cities,sources:sources.sources});
console.log(JSON.stringify({features:features.length,labels:labels.length,bytes:fs.statSync(path.join(out,'cities.geojson')).size,cities:cities.map(c=>({id:c.id,counts:c.featureCounts}))},null,2));
