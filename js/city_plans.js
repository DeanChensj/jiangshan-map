/* Archaeological city detail on the atlas's existing SVG camera. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const ROOT = 'assets/historical-cities/';
  // Coarse load/zoom gates only; published reconstruction bounds come from catalog.json.
  const AREAS = [[108.87, 34.19, 109.01, 34.32], [112.42, 34.62, 112.53, 34.72]];
  const ORDER = ['ward', 'garden', 'imperial', 'palace', 'precinct', 'market', 'granary', 'water-area', 'waterway', 'canal', 'street', 'wall', 'gate', 'bridge', 'monument', 'temple', 'site'];
  const node = (tag, attrs = {}, parent) => {
    const el = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    if (parent) parent.appendChild(el);
    return el;
  };

  class HistoricalCityPlans {
    constructor(app) {
      this.app = app;
      this.group = document.getElementById('grp-city-plans');
      this.toggle = document.getElementById('chk-city-plans');
      this.badge = document.getElementById('city-plan-status');
      this.card = document.getElementById('city-plan-card');
      this.toggle.addEventListener('change', () => this.update());
      document.getElementById('act-close-city-plan').addEventListener('click', () => this.close());
      this.badge.addEventListener('click', () => {
        if (this.error) {
          this.error = null; this.pending = null;
          if (this.retryCity) this.focus(this.retryCity);
          else this.update();
        }
        else this.inspect(null);
      });
      for (const el of [this.badge, this.card]) el.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
      });
      for (const id of ['changan', 'luoyang']) {
        const button = document.getElementById('city-plan-' + id);
        button.addEventListener('click', () => this.focus(id));
        button.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation(); });
      }
      this.active = [];
      this.localize();
    }

    text(zh, en) { return this.app.locale === 'en' ? en : this.app._zh(zh); }
    name(p) { return this.app.locale === 'en' ? p.titleEn : this.app.locale === 'zh-tw' ? p.titleHant : p.title; }
    inPeriod() { return this.app.year >= 742 && this.app.year <= 755; }
    minCameraWidth(x, y) {
      const [lng, lat] = this.app.projector.toGeo(x, y);
      const near = AREAS.some(b => lng >= b[0] - .2 && lng <= b[2] + .2 && lat >= b[1] - .2 && lat <= b[3] + .2);
      return this.inPeriod() && this.toggle.checked && near ? 1000 / 1500 : Math.min(100, this.app.camera.w);
    }

    load() {
      if (this.pending) return this.pending;
      const versions = document.getElementById('atlas-app-script').dataset;
      this.pending = Promise.all([
        ['catalog.json', 'vCityCatalog'], ['cities.geojson', 'vCityData'], ['labels.geojson', 'vCityLabels'],
      ].map(async ([file, key]) => {
        const url = new URL(ROOT + file, document.baseURI);
        if (versions[key]) url.searchParams.set('v', versions[key]);
        const response = await fetch(url);
        if (!response.ok) throw new Error(file + ': ' + response.status);
        return response.json();
      })).then(([catalog, geometry, labels]) => {
        this.catalog = catalog;
        this.features = new Map(geometry.features.map(f => [f.id, f]));
        this.views = catalog.cities.map(city => {
          const [w, s, e, n] = city.bounds;
          const [x1, y1] = this.app.projector.toScreen(w, n);
          const [x2, y2] = this.app.projector.toScreen(e, s);
          return { city, bounds: [x1, y1, x2, y2], labels: labels.features.filter(f => f.properties.city === city.id), geometry: geometry.features.filter(f => f.properties.city === city.id) };
        });
        return this.views;
      });
      return this.pending;
    }

    async focus(id) {
      const token = this.focusToken = (this.focusToken || 0) + 1;
      this.app.stopAutoplay();
      this.toggle.checked = true;
      if (!this.inPeriod()) this.app.jumpToYear(750);
      this.app._closeLayersPopover();
      this.app.closeGenealogyCard();
      this.app.closeMilestoneBalloon();
      const year = this.app.year;
      if (this.error) this.pending = null;
      this.error = null;
      this.retryCity = id;
      try {
        const loading = this.load();
        this.showStatus();
        await loading;
        if (this.focusToken !== token || this.app.year !== year) return;
        this.retryCity = null;
        const view = this.views.find(v => v.city.id === id);
        const [x1, y1, x2, y2] = view.bounds;
        const aspect = this.app._getViewportAspect();
        const w = Math.max((x2 - x1) / .86, (y2 - y1) / aspect / .86);
        this.app._animateCameraTo({ x: (x1 + x2 - w) / 2, y: (y1 + y2 - w * aspect) / 2, w, h: w * aspect });
      } catch (error) { this.error = error; this.showStatus(); }
    }

    path(geometry) {
      const line = points => points.map((p, i) => {
        const [x, y] = this.app.projector.toScreen(...p);
        return (i ? 'L' : 'M') + x.toFixed(6) + ' ' + y.toFixed(6);
      }).join('');
      return geometry.type === 'Polygon' ? geometry.coordinates.map(r => line(r) + 'Z').join('') : line(geometry.coordinates);
    }

    build(view) {
      const group = node('g', { 'data-city': view.city.id }, this.group);
      view.nodes = [];
      for (const feature of view.geometry.slice().sort((a, b) => ORDER.indexOf(a.properties.kind) - ORDER.indexOf(b.properties.kind))) {
        const { kind } = feature.properties;
        if (!ORDER.includes(kind)) continue;
        const attrs = { class: 'city-feature city-' + kind, 'data-city-feature': feature.id, 'data-rank': feature.properties.rank };
        if (feature.geometry.type === 'Point') {
          const [x, y] = this.app.projector.toScreen(...feature.geometry.coordinates);
          const g = node('g', { ...attrs, transform: `translate(${x},${y})` }, group);
          const hit = node('circle', { class: 'city-point-hit' }, g);
          const dot = node('circle', {}, g);
          view.nodes.push({ feature, el: g, hit, dot });
        } else {
          const el = node('path', { ...attrs, d: this.path(feature.geometry) }, group);
          view.nodes.push({ feature, el });
        }
      }
      view.labelNodes = view.labels.filter(f => ORDER.includes(f.properties.kind)).map(f => {
        const [x, y] = this.app.projector.toScreen(...f.geometry.coordinates);
        const el = node('text', { class: 'city-label city-label-' + f.properties.kind, 'data-city-feature': f.properties.featureID, 'text-anchor': 'middle' }, group);
        return { feature: f, el, x, y };
      });
      view.group = group;
    }

    update(rect) {
      const { camera, projector, viewportFrame, svg } = this.app;
      const eligible = this.inPeriod() && this.toggle.checked && !this.app.challenge && camera.zoom >= 70;
      if (eligible && !this.catalog && !this.error && !this.pending) {
        const corners = [projector.toGeo(camera.x, camera.y), projector.toGeo(camera.x + camera.w, camera.y + camera.h)];
        if (AREAS.some(b => corners[0][0] <= b[2] && corners[1][0] >= b[0] && corners[1][1] <= b[3] && corners[0][1] >= b[1])) {
          this.load().then(() => this.update()).catch(error => { this.error = error; this.showStatus(); });
        }
      }
      this.active = eligible && this.views ? this.views.filter(v => {
        const [x1, y1, x2, y2] = v.bounds;
        return this.app.year >= v.city.from && this.app.year <= v.city.until && x1 < camera.x + camera.w && x2 > camera.x && y1 < camera.y + camera.h && y2 > camera.y;
      }) : [];
      const active = this.active.length > 0;
      this.group.classList.toggle('is-hidden', !active);
      if (viewportFrame.classList.contains('has-city-plan') !== active) this.app._invalidateTypographyLayout();
      viewportFrame.classList.toggle('has-city-plan', active);
      if (this.views) for (const view of this.views) {
        const visible = this.active.includes(view);
        if (visible && !view.group) this.build(view);
        if (view.group) view.group.classList.toggle('is-hidden', !visible);
      }
      this.showStatus();
      if (!active || (this.selected && !this.active.some(v => v.city.id === this.selected.properties.city))) this.close();
      if (!active) return;
      rect = rect || svg.getBoundingClientRect();
      const scale = Math.min(rect.width / camera.w, rect.height / camera.h);
      const tileZoom = Math.log2(projector.scale * scale * 360 / 512);
      const occupied = [];
      const padX = (rect.width - camera.w * scale) / 2, padY = (rect.height - camera.h * scale) / 2;
      for (const view of this.active) {
        for (const item of view.nodes) {
          const p = item.feature.properties;
          item.el.classList.toggle('is-hidden', this.app.year < p.from || this.app.year > p.until);
          if (item.dot) {
            item.dot.setAttribute('r', (p.kind === 'gate' || p.kind === 'bridge' ? 3 : 3.6) / scale);
            item.hit.setAttribute('r', 10 / scale);
          }
        }
        for (const item of view.labelNodes.slice().sort((a, b) => a.feature.properties.rank - b.feature.properties.rank)) {
          const p = item.feature.properties;
          const min = p.kind === 'ward' ? 12.5 : p.kind === 'canal' ? 12 : ['gate', 'bridge', 'precinct', 'monument', 'temple', 'site', 'street'].includes(p.kind) ? 11.4 : 10.5;
          const size = ['palace', 'market', 'imperial', 'granary'].includes(p.kind) ? 13 : 11;
          const title = this.name(p) || '';
          const width = [...title].reduce((n, c) => n + (/[^\x00-\xff]/.test(c) ? size : size * .55), 0) + 8;
          const x = (item.x - camera.x) * scale + padX, y = (item.y - camera.y) * scale + padY;
          const point = ['gate', 'bridge', 'monument', 'temple', 'site'].includes(p.kind);
          const offsets = point ? [[0, 17], [0, -10], [width / 2 + 9, 4], [-width / 2 - 9, 4]] : [[0, 4]];
          let placed = null;
          if (tileZoom >= min && this.app.year >= p.from && this.app.year <= p.until) for (const [dx, dy] of offsets) {
            const b = [x + dx - width / 2, y + dy - size, x + dx + width / 2, y + dy + 4];
            if (b[0] < 4 || b[2] > rect.width - 4 || b[1] < 4 || b[3] > rect.height - 4) continue;
            if (occupied.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
            occupied.push(b); placed = [dx, dy]; break;
          }
          item.el.classList.toggle('is-hidden', !placed);
          if (!placed) continue;
          item.el.textContent = title;
          item.el.setAttribute('transform', `translate(${item.x},${item.y}) scale(${1 / scale})`);
          item.el.setAttribute('x', placed[0]);
          item.el.setAttribute('y', placed[1]);
          item.el.setAttribute('font-size', size);
        }
      }
    }

    showStatus() {
      const visible = this.inPeriod() && this.toggle.checked && (this.active.length || this.error || (this.pending && !this.catalog));
      this.badge.classList.toggle('is-hidden', !visible);
      this.badge.textContent = this.error ? this.text('城坊图载入失败 · 点击重试', 'City detail could not load · Retry') : !this.catalog ? this.text('正在载入城坊图…', 'Loading city detail…') : this.active.map(v => this.name(v.city)).join(' · ') + this.text(' · 约750年示意 · 史料与图例', ' · c. 750 schematic · Evidence & legend');
    }

    hit(x, y) {
      if (!this.active.length) return null;
      const el = document.elementsFromPoint(x, y).map(el => el.closest && el.closest('[data-city-feature]')).find(Boolean);
      return el ? this.features.get(el.dataset.cityFeature) : null;
    }
    tap(x, y) {
      const feature = this.hit(x, y);
      if (!feature) return false;
      this.inspect(feature);
      return true;
    }

    inspect(feature) {
      if (!this.active.length) return;
      this.selected = feature;
      this.card.classList.remove('is-hidden');
      this.app.viewportFrame.classList.add('has-city-inspector');
      this.group.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
      if (feature) this.group.querySelectorAll('[data-city-feature="' + feature.id + '"]').forEach(el => el.classList.add('is-selected'));
      const p = feature ? feature.properties : this.active[0].city;
      document.getElementById('city-plan-heading').textContent = this.name(p);
      document.getElementById('city-plan-description').textContent = feature ? this.text(p.detail, p.detailEn) + '\n' + this.text('约750年 · 位置误差参考 ', 'c. 750 · placement allowance ') + p.uncertaintyM + this.text('米（非统计置信范围）', ' m (not a statistical confidence bound)') + (p.sourceLocator ? '\n' + p.sourceLocator : '') : this.text('742–755年浏览范围内的约750年考古格局示意，非逐年复原或精确测绘。虚线表示概略边界；小点为遗址，未复原建筑轮廓。', 'Generalized archaeological layout c. 750, shown during 742–755; not a year-by-year reconstruction or precise survey. Dashed edges are approximate, and dots mark sites without building footprints.');
      const list = document.getElementById('city-plan-sources');
      list.replaceChildren();
      for (const source of this.catalog.sources.filter(s => !feature || p.sourceIDs.split('|').includes(s.id))) {
        const a = document.createElement('a');
        a.textContent = this.text(source.title, source.titleEn); a.href = source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; list.appendChild(a);
      }
      document.getElementById('city-plan-legend').classList.toggle('is-hidden', Boolean(feature));
    }

    close() {
      const open = !this.card.classList.contains('is-hidden');
      this.card.classList.add('is-hidden');
      this.app.viewportFrame.classList.remove('has-city-inspector');
      this.selected = null;
      this.group.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
      return open;
    }

    localize() {
      document.getElementById('lbl-city-plans').textContent = this.text('盛唐城坊（742–755）', 'Tang city detail (742–755)');
      document.getElementById('act-close-city-plan').setAttribute('aria-label', this.text('关闭城坊史料', 'Close city evidence'));
      document.getElementById('city-plan-audit').textContent = this.text('方法、史料与缺项 ↗', 'Method, evidence & gaps ↗');
      document.getElementById('city-plan-download').textContent = this.text('下载 GeoJSON · CC0', 'Download GeoJSON · CC0');
      const legend = document.getElementById('city-plan-legend');
      legend.replaceChildren();
      for (const [kind, zh, en] of [['palace', '宫苑', 'Palaces'], ['market', '市与仓城', 'Markets / granary'], ['ward', '里坊', 'Wards'], ['street', '古代街道', 'Ancient streets'], ['water', '水系与局部渠段', 'Water / canal sections'], ['gate', '城门与桥', 'Gates / bridge'], ['site', '寺院与殿址', 'Temples / hall sites'], ['garden', '园苑概位', 'Garden areas']]) {
        const span = document.createElement('span'), swatch = document.createElement('i');
        swatch.className = 'city-key-' + kind; span.append(swatch, document.createTextNode(this.text(zh, en))); legend.appendChild(span);
      }
      this.showStatus();
      if (!this.card.classList.contains('is-hidden')) this.inspect(this.selected);
      this.update();
    }
  }
  window.HistoricalCityPlans = HistoricalCityPlans;
})();
