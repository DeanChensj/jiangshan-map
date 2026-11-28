// The original controller owns time, geography and the SVG camera. Only the
// WebGL camera belongs to this view, so rendering a year cannot reframe it.
(() => {
  'use strict';

  const vendor = 'assets/vendor/maplibre-gl-5.24.0/';
  const dem = {
    type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 15,
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    attribution: '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">© Mapzen &amp; contributors</a>',
  };
  const elevationColors = [
    [0, '#fff4d4'], [500, '#d7dfa8'], [1000, '#b9cb88'], [1500, '#77985e'], [2000, '#345c44'],
    [3500, '#324e45'], [5000, '#203238'], [6500, '#15212a'], [8900, '#090e15'],
  ];
  // A low camera would sit inside the adjacent ridge at 100× relief.
  function localCamera(scale) {
    const blend = Math.max(0, Math.log(scale / 2) / Math.log(50));
    return {zoom: 11.75 - 4.25 * blend, pitch: 76 - 31 * blend, bearing: 32};
  }
  const collection = features => ({type: 'FeatureCollection', features});
  const feature = (geometry, properties) => ({type: 'Feature', geometry, properties});
  const point = coordinates => ({type: 'Point', coordinates});
  const lines = coordinates => ({type: 'MultiLineString', coordinates});
  const isKind = kind => ['==', ['get', 'kind'], kind];

  // Some atlas rings use implicit SVG closure. Close them without altering the
  // shared snapshot, including interior rings and detached islands.
  function closed(ring) {
    const first = ring[0], last = ring[ring.length - 1];
    if (!first || (first[0] === last[0] && first[1] === last[1])) return ring;
    return [...ring, first];
  }

  function area(shape) {
    const {type, coordinates} = shape;
    return {type, coordinates: type === 'Polygon'
      ? coordinates.map(closed) : coordinates.map(poly => poly.map(closed))};
  }

  function historyData(app, dynasty, snapshot, year) {
    const features = [];
    const visible = item => app._isHydroVisible(item, year);
    const add = (geometry, kind, props) => features.push(feature(geometry, {kind, ...props}));
    const now = app.locale === 'en' ? 'Now ' : '今·';
    const addPlace = (coord, name, priority, props) => {
      const modern = app.trModernCity(props.modern);
      const paired = modern && modern !== name ? name + '\n' + now + modern : name;
      add(point(coord), 'place', {...props, modern, name, paired, priority});
    };
    for (const prov of app.provinces) {
      if (prov.hub && !String(prov.code).includes('_JD')) {
        add(point(prov.hub), 'modern-province', {name: app.trTerm(prov.title)});
      }
    }
    if (dynasty.key !== 'prc') {
      const present = app.dynasties.find(d => d.key === 'prc');
      for (const city of present.settlements) {
        add(point(city.coord), 'modern-city', {name: now + app.trModernCity(city.modern || city.ancient), tier: city.tier || 1});
      }
    }
    const order = {neighbor: 0, main: 1, rival: 2, protectorate: 3};
    const polities = [...snapshot.polities].sort((a, b) => order[a.role] - order[b.role]);
    for (const pol of polities) {
      add(area(pol.shape), 'polity', {name: app.trTerm(pol.title), color: pol.tint || '#988e76', role: pol.role});
      if (pol.anchor && pol.role !== 'neighbor') add(point(pol.anchor), 'realm', {name: app.trTerm(pol.title)});
    }
    // The original contemporary snapshot derives its coverage from provinces.
    if (dynasty.key === 'prc') {
      for (const region of snapshot.regions) {
        add(area(region.shape), 'polity', {name: app.trTerm(region.title), color: dynasty.tint, role: 'main'});
      }
    }
    const hydro = app.hydroData;
    for (const r of hydro.rivers.filter(visible)) add(lines(r.lines), 'river', {rank: r.rank, name: r.name});
    for (const l of hydro.lakes.filter(visible)) add(area({type: 'Polygon', coordinates: l.rings}), 'water');
    for (const sea of hydro.paleoSea.filter(visible)) add(area({type: 'MultiPolygon', coordinates: sea.polys}), 'water');
    for (const label of hydro.labels.filter(visible)) {
      const names = app._hydroLabelPair(label, year);
      add(point(label.coord), 'geography', {name: app.locale === 'en' ? names.en : app._zh(names.zh)});
    }
    for (const road of app.corridors) {
      if (road.span && (year < road.span[0] || year > road.span[1])) continue;
      add(lines(road.segments), 'corridor', {name: app.corridorTitle(road), note: app.corridorSummary(road), route: road.kind});
    }
    for (const city of dynasty.settlements.filter(visible)) {
      const name = app._settlementAncient(city, year);
      const priority = app._isSettlementCapital(city, year) ? 0 : (city.tier === 2 ? 3 : 1);
      addPlace(city.coord, app.trTerm(name), priority, {modern: city.modern, note: app.locale === 'en' ? city.remarkEn : app._zh(city.remark)});
    }
    if (dynasty.key !== 'prc') {
      for (const pass of app.constructor.STRATEGIC_PASSES.filter(visible)) {
        addPlace(pass.coord, app._passName(pass, year), 2, {
          modern: app.locale === 'en' ? pass.modernEn : app._zh(pass.modernZh),
          note: app.locale === 'en' ? pass.rangeEn : app._zh(pass.rangeZh),
        });
      }
    }
    return collection(features);
  }

  const placeFilter = ['step', ['zoom'], ['<=', ['get', 'priority'], 0],
    4, ['<=', ['get', 'priority'], 1], 5.5, ['<=', ['get', 'priority'], 2], 7, true];
  const placeColor = ['match', ['get', 'priority'], 0, '#8f3229', 2, '#824923', '#3e4136'];
  const labelPaint = {'text-color': '#302e26', 'text-halo-color': '#faf5e4', 'text-halo-width': 1.6};
  const labelLayout = {'text-field': ['get', 'name'], 'text-font': ['serif'], 'text-size': 13};
  const historyLayers = [
    {id: 'realms', type: 'fill', filter: isKind('polity'), paint: {
      'fill-color': ['get', 'color'], 'fill-opacity': ['interpolate', ['linear'], ['zoom'],
        4, ['case', ['==', ['get', 'role'], 'neighbor'], 0.1, 0.34], 9, 0.06]}},
    {id: 'borders', type: 'line', filter: isKind('polity'), paint: {'line-color': ['get', 'color'], 'line-width': 1.1, 'line-opacity': 0.85}},
    {id: 'lakes-and-shores', type: 'fill', filter: isKind('water'), paint: {'fill-color': '#91bbbf', 'fill-opacity': 0.88}},
    {id: 'rivers', type: 'line', filter: isKind('river'), paint: {
      'line-color': '#437e92', 'line-opacity': 0.85, 'line-width': ['match', ['get', 'rank'], 1, 2, 2, 1.45, 0.85]}},
    {id: 'roads', type: 'line', filter: isKind('corridor'), paint: {
      'line-color': ['match', ['get', 'route'], 'canal', '#317387', 'sea', '#567795', '#915333'],
      'line-width': 1.8, 'line-dasharray': [3, 2]}},
    {id: 'geographic-names', type: 'symbol', filter: isKind('geography'), minzoom: 5.3,
      layout: {...labelLayout, 'text-size': 12}, paint: {...labelPaint, 'text-color': '#48665e'}},
    {id: 'realm-names', type: 'symbol', filter: isKind('realm'), maxzoom: 7,
      layout: {...labelLayout, 'text-size': 18, 'text-letter-spacing': 0.12}, paint: labelPaint},
    {id: 'modern-city-names', type: 'symbol', filter: ['all', isKind('modern-city'),
      ['step', ['zoom'], ['<=', ['get', 'tier'], 1], 6, true]],
      layout: {...labelLayout, 'text-size': 12}, paint: {...labelPaint, 'text-color': '#365668'}},
    {id: 'modern-province-names', type: 'symbol', filter: isKind('modern-province'),
      layout: {...labelLayout, 'text-size': 14}, paint: {...labelPaint, 'text-color': '#365668'}},
    {id: 'places', type: 'circle', filter: ['all', isKind('place'), placeFilter], paint: {
      'circle-color': placeColor, 'circle-radius': ['match', ['get', 'priority'], 0, 4.5, 2, 4, 3],
      'circle-stroke-color': '#fcf4da', 'circle-stroke-width': 1.3}},
    {id: 'place-names', type: 'symbol', filter: ['all', isKind('place'), placeFilter],
      layout: {...labelLayout, 'symbol-sort-key': ['get', 'priority'], 'text-anchor': 'top',
        'text-offset': [0, 0.5], 'text-size': 14}, paint: {...labelPaint, 'text-color': placeColor}},
  ];
  const switches = {
    'terrain-modern-names': ['modern-city-names'],
    'chk-prov-names': ['modern-province-names'],
    'chk-polities': ['realms', 'borders', 'realm-names'],
    'chk-terrain': ['rivers', 'lakes-and-shores', 'geographic-names'],
    'chk-corridors': ['roads'], 'chk-settlements': ['places', 'place-names'],
  };

  function style(exaggeration, regional = false) {
    const source = regional ? {...dem, bounds: [45, 0, 179.99999, 66.51325], maxzoom: 3,
      tiles: [new URL('assets/terrain/dem/', document.baseURI).href + '{z}/{x}/{y}.png']} : dem;
    return {
      version: 8,
      sources: {
        elevation: {...source}, shading: {...source},
        ocean: {type: 'geojson', data: 'assets/terrain/ocean-east-asia.geojson', attribution: 'Natural Earth'},
      },
      terrain: {source: 'elevation', exaggeration},
      sky: {'sky-color': '#a7c8d8', 'horizon-color': '#e0e8e3', 'fog-color': '#cbd8d0',
        'sky-horizon-blend': 0.65, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.82},

      layers: [
        {id: 'paper', type: 'background', paint: {'background-color': '#e9e4cf'}},
        {id: 'elevation-tints', type: 'color-relief', source: 'shading', paint: {
          'color-relief-color': ['interpolate', ['linear'], ['elevation'], ...elevationColors.flat()]}},
        {id: 'relief', type: 'hillshade', source: 'shading', paint: {
          'hillshade-shadow-color': '#445247', 'hillshade-highlight-color': 'rgba(255,244,211,0.32)',
          'hillshade-illumination-anchor': 'map', 'hillshade-illumination-direction': 315,
          'hillshade-accent-color': '#807b65', 'hillshade-exaggeration': 0.46}},
        {id: 'ocean', type: 'fill', source: 'ocean', paint: {'fill-color': '#a3c1c2'}},
      ],
    };
  }

  let loading;
  function loadRenderer() {
    if (!loading) {
      const script = document.createElement('script');
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = vendor + 'maplibre-gl.css';
      const load = el => new Promise((resolve, reject) => {
        el.onload = resolve;
        el.onerror = reject;
        document.head.appendChild(el);
      });
      const loadScript = async () => {
        const response = await fetch(vendor + 'maplibre-gl.js.gz');
        if (!response.ok) throw new Error('MapLibre HTTP ' + response.status);
        const bytes = await response.arrayBuffer();
        const packed = new Uint8Array(bytes)[0] === 0x1f;
        const body = packed ? new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')) : bytes;
        const url = URL.createObjectURL(new Blob([await new Response(body).arrayBuffer()], {type: 'text/javascript'}));
        try {
          script.src = url;
          await load(script);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      loading = Promise.all([loadScript(), load(css)]).catch(error => {
        script.remove(); css.remove(); loading = null;
        throw error;
      });
    }
    return loading;
  }

  class TerrainView {
    constructor(app) {
      this.app = app;
      this.frame = app.viewportFrame;
      this.host = document.getElementById('terrain-map');
      this.toggle = document.getElementById('terrain-toggle');
      this.top = document.getElementById('terrain-top');
      this.tools = document.getElementById('terrain-tools');
      this.status = document.getElementById('terrain-status');
      this.key = document.getElementById('terrain-elevation-key');
      this.key.querySelector('.elevation-swatches').replaceChildren(...elevationColors.map(([height, color]) => {
        const label = document.createElement('span');
        label.style.borderColor = color;
        label.textContent = height;
        return label;
      }));
      this.scale = document.getElementById('terrain-height-scale');
      const requested = Number(new URLSearchParams(location.search).get('heightScale'));
      this.heightScale = Number.isInteger(requested) && requested >= 1 && requested <= 100
        ? requested : Number(this.scale.defaultValue);
      this.scale.value = this.heightScale;
      this.scale.onchange = () => {
        if (!this.scale.validity.valid) {
          this.scale.reportValidity();
          this.scale.value = this.heightScale;
          return;
        }
        this.heightScale = this.scale.valueAsNumber;
        this.map.setTerrain({source: 'elevation', exaggeration: this.heightScale});
        const url = new URL(location.href);
        url.searchParams.set('heightScale', this.heightScale);
        history.replaceState(history.state, '', url);
      };
      this.revision = 0;
      this.toggle.onclick = () => this.active ? this.close() : this.open();
      this.top.onclick = () => {
        const map = this.map.stop();
        const closeView = localCamera(this.heightScale);
        map.jumpTo(map.getPitch() > 1 || Math.abs(map.getBearing()) > 1
          ? {pitch: 0, bearing: 0} : {...closeView, zoom: Math.max(map.getZoom(), closeView.zoom)});
      };
      document.getElementById('layers-popover').addEventListener('change', () => this.visibility());
    }

    text(zh, en) {
      return this.app.locale === 'en' ? en : this.app._zh(zh);
    }

    localize() {
      const title = this.text('3D 山河', '3D terrain');
      this.host.setAttribute('aria-label', title);
      this.toggle.textContent = this.active ? this.text('返回 2D', 'Back to 2D') : title;
      document.getElementById('terrain-heading').textContent = title;
      document.getElementById('terrain-scale-label').textContent = this.text('高度倍率', 'Height scale');
      document.getElementById('terrain-names-label').textContent = this.text('现代地名', 'Modern names');
      this.key.firstElementChild.textContent = this.text('海拔（米）', 'Elevation (m)');
      this.updateViewButton();
      if (this.active) this.updateStatus();
    }

    updateViewButton() {
      const tilted = this.map && (this.map.getPitch() > 1 || Math.abs(this.map.getBearing()) > 1);
      this.top.textContent = tilted ? this.text('恢复俯视', 'Reset orientation') : this.text('近看山势', 'Tilt view');
    }

    focusPlace(item) {
      const local = ['city', 'pass', 'gazetteer'].includes(item.kind);
      this.map.jumpTo({center: item.coord, ...(local ? localCamera(this.heightScale) : {zoom: 6, pitch: 44})});
    }

    message(value) {
      this.status.textContent = value;
      this.status.hidden = !value;
    }

    show(active) {
      this.active = active;
      this.host.hidden = !active;
      this.top.hidden = this.tools.hidden = this.key.hidden = true;
      this.frame.classList.toggle('is-terrain-3d', active);
      this.localize();
      this.toggle.setAttribute('aria-pressed', String(active));
    }

    async open() {
      const app = this.app;
      const session = ++this.revision;
      app._cancelCameraAnimation();
      const {x, y, w, h} = app.camera;
      const rect = app._getUnscaledSvgRect();
      const pxPerDegree = Math.min(rect.width / w, rect.height / h) * app.projector.scale;
      const baseZoom = Math.log2(360 * pxPerDegree / 512);
      const closeView = localCamera(this.heightScale);
      const camera = app.camera.zoom >= 4 ? {...closeView, zoom: Math.max(baseZoom, closeView.zoom)}
        : {zoom: baseZoom, pitch: 0, bearing: 0};
      this.regional = false;
      this.show(true);
      this.message(this.text('正在载入三维地形…', 'Loading terrain…'));
      try {
        await loadRenderer();
        if (this.revision !== session) return;
        const map = this.map = new maplibregl.Map({
          container: this.host, style: style(this.heightScale),
          center: app.projector.toGeo(x + w / 2, y + h / 2),
          ...camera, maxPitch: 78, minZoom: 1, maxZoom: 16, renderWorldCopies: false,
          dragRotate: true, pitchWithRotate: true, bearingSnap: 0, fadeDuration: 0,
          attributionControl: {compact: true},
        });
        this.observer = new ResizeObserver(() => map.resize());
        this.observer.observe(this.host);
        this.host.addEventListener('webglcontextlost', this.contextLost = () => {
          this.close(this.text('三维绘图中断，已返回原地图。', '3D rendering stopped. Returned to 2D.'));
        }, true);
        const useRegional = () => {
          if (this.map !== map || this.regional) return;
          this.regional = true;
          ++this.revision;
          clearTimeout(this.timer);
          clearTimeout(this.demTimer);
          this.historySource = null;
          this.ready = this.firstViewLoaded = this.sawTerrain = false;
          this.tools.hidden = true;
          map.setStyle(style(this.heightScale, true), {diff: false});
          this.updateStatus();
        };
        map.on('moveend', () => this.updateViewButton());
        map.on('style.load', () => {
          this.ready = true;
          this.top.hidden = this.tools.hidden = this.key.hidden = false;
          this.updateViewButton();
          this.scheduleYear();
          if (!this.regional) this.demTimer = setTimeout(useRegional, 7000);
        });
        map.on('error', event => {
          if (!this.active || this.map !== map) return;
          if (['elevation', 'shading'].includes(event.sourceId) || String(event.error).includes('terrarium')) {
            if (!this.regional) { useRegional(); return; }
            this.tileError = true;
            this.updateStatus();
          } else if (event.sourceId && event.sourceId === this.historySource) {
            this.yearError = true;
            this.updateStatus();
          } else {
            console.warn('3D 山河', event.error);
          }
        });
        map.on('sourcedata', event => {
          if (!this.sawTerrain && event.sourceId === 'elevation' && event.tile?.state === 'loaded') {
            clearTimeout(this.demTimer);
            this.sawTerrain = true;
            this.updateStatus();
          }
        });
        map.on('idle', () => {
          if (this.sawTerrain && !this.firstViewLoaded) {
            this.firstViewLoaded = true;
            this.updateStatus();
          }
        });
        map.on('click', e => this.inspect(e));

      } catch (error) {
        if (this.revision !== session) return;
        console.warn('3D 山河', error);
        this.close(this.text('三维地形无法启动，已返回原地图。', '3D terrain is unavailable. Returned to 2D.'));
      }
    }

    updateStatus() {
      if (this.tileError) this.message(this.text('高程暂缺，可返回 2D。', 'Elevation unavailable. You can return to 2D.'));
      else if (this.yearError) this.message(this.text('历史图层加载失败，请切年重试。', 'History unavailable. Change the year to retry.'));
      else if (this.regional) this.message(this.text('使用东亚低精度高程', 'Using regional low-resolution terrain'));
      else this.message(this.firstViewLoaded ? '' : this.text('正在载入高程…', 'Loading elevation…'));
    }

    visibility() {
      if (!this.historySource) return;
      const label = document.getElementById('terrain-modern-names').checked ? 'paired' : 'name';
      this.map.setLayoutProperty('place-names', 'text-field', ['get', label]);
      const places = ['all', isKind('place'), placeFilter];
      if (!document.getElementById('chk-corridors').checked) places.push(['!=', ['get', 'priority'], 2]);
      for (const layer of ['places', 'place-names']) this.map.setFilter(layer, places);
      for (const [id, layerIds] of Object.entries(switches)) {
        const value = document.getElementById(id).checked ? 'visible' : 'none';
        for (const layer of layerIds) this.map.setLayoutProperty(layer, 'visibility', value);
      }
    }

    scheduleYear() {
      if (!this.ready) return;
      const revision = ++this.revision;
      const app = this.app, year = app.year, dynasty = app.dynasties[app.dynastyIdx];
      const key = app._resolveSnapKey(dynasty, year);
      this.popup?.remove();
      // Discard the previous year's tile cache before fetching. Late worker
      // replies belong to a detached source and cannot reappear on this map.
      if (this.historySource) {
        for (const layer of historyLayers) this.map.removeLayer(layer.id);
        this.map.removeSource(this.historySource);
        this.historySource = null;
      }
      this.pending = true;
      this.yearError = false;
      this.updateStatus();
      clearTimeout(this.timer);
      this.timer = setTimeout(async () => {
        try {
          const snap = await app._fetchSnapshot(key);
          if (revision !== this.revision) return;
          if (!app.snapshots[key]) throw new Error('Missing snapshot ' + key);
          const data = historyData(app, dynasty, snap, year);
          this.historySource = 'atlas-year-' + revision;
          this.map.addSource(this.historySource, {type: 'geojson', data, tolerance: 0.3});
          for (const layer of historyLayers) this.map.addLayer({...layer, source: this.historySource});
        } catch (error) {
          if (revision !== this.revision) return;
          this.yearError = true;
          console.warn('3D 山河', error);
        }
        this.pending = false;
        this.visibility();
        this.updateStatus();
      }, 90);
    }

    inspect(e) {
      if (!this.historySource || this.pending) return;
      const {x, y} = e.point;
      const hits = this.map.queryRenderedFeatures([[x - 4, y - 4], [x + 4, y + 4]],
        {layers: ['place-names', 'places', 'roads', 'realms']});
      const hit = hits.find(f => f.properties.kind === 'place') || hits[0];
      const {name, modern, note, kind} = hit?.properties || {};
      const coord = kind === 'place' ? hit.geometry.coordinates : e.lngLat;
      if (!this.map.transform.isPointOnMapSurface(e.point, this.map.terrain)) return;
      const height = this.sawTerrain && !this.tileError && this.map.areTilesLoaded()
        ? this.map.queryTerrainElevation(coord) : null;
      const box = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = name || this.text('地形采样点', 'Terrain sample');
      box.appendChild(title);
      const altitude = height == null ? this.text('海拔暂缺', 'Elevation unavailable') : this.text('海拔约 ', 'Elevation ≈ ') + Math.round(height / this.heightScale) + ' m';
      for (const text of [altitude, modern && this.text('今址 · ', 'Today · ') + modern, note].filter(Boolean)) {
        const p = document.createElement('p'); p.textContent = text; box.appendChild(p);
      }
      if (kind === 'place') {
        const read = document.createElement('button');
        read.textContent = this.text('查看此地沿革', 'Place history');
        read.onclick = () => {
          this.popup.remove();
          this.frame.classList.add('terrain-reading');
          this.app.openGenealogyAt(...hit.geometry.coordinates, name);
        };
        box.appendChild(read);
      }
      this.popup?.remove();
      this.popup = new maplibregl.Popup({maxWidth: '245px'})
        .setLngLat(coord).setDOMContent(box).addTo(this.map);
    }

    close(reason = '') {
      ++this.revision;
      clearTimeout(this.timer);
      clearTimeout(this.demTimer);
      this.observer?.disconnect();
      if (this.contextLost) this.host.removeEventListener('webglcontextlost', this.contextLost, true);
      const map = this.map, app = this.app;
      const center = map?.getCenter(), zoom = map?.getZoom();
      this.ready = this.pending = this.tileError = this.yearError = this.sawTerrain = this.firstViewLoaded = false;
      this.historySource = null;
      this.show(false);
      this.popup?.remove();
      map?.remove();
      this.host.replaceChildren();
      this.map = this.popup = null;
      this.frame.classList.remove('terrain-reading');
      if (center) {
        app._cancelCameraAnimation();
        const rect = app._getUnscaledSvgRect(), ratio = app.camera.h / app.camera.w;
        const scale = 512 * 2 ** zoom / (360 * app.projector.scale);
        const w = Math.max(50, Math.min(1300, Math.min(rect.width, rect.height / ratio) / scale));
        const h = w * ratio, [cx, cy] = app.projector.toScreen(center.lng, center.lat);
        app.camera = {x: cx - w / 2, y: cy - h / 2, w, h, zoom: 1000 / w};
        app._applyCamera(true);
      }
      this.message(reason);
    }
  }

  window.atlasApp.terrainView = new TerrainView(window.atlasApp);
})();
