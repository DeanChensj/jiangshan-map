/**
 * Route A Locate Quiz Result Poster Renderer & Share Modal for Jiangshan Atlas (江山时序).
 * Lazy-loaded on demand when clicking "分享战绩图" on the quiz completion card so
 * first-paint bundle size stays unchanged and geometry stays single-source-of-truth.
 */
(function () {
  'use strict';

  const POSTER_W = 750;
  const POSTER_H = 1000;
  const SHARE_URL_DISPLAY = 'deanchen.me/jiangshan-map/?quiz=locate';
  const SHARE_URL_FULL = 'https://deanchen.me/jiangshan-map/?quiz=locate';
  const TERRAIN_ASSET_PATH = 'assets/terrain_relief_mobile.webp';
  const POSTER_RIVER_NAMES = new Set([
    'Jinsha',
    'Chang Jiang',
    'Yangtze',
    'Yangtze Estuary',
    'Huang',
  ]);

  // ISO-18004 Version 3-L (29x29) encoding https://deanchen.me/jiangshan-map/?quiz=locate
  const QR_MATRIX = [
    '11111110010010010011001111111',
    '10000010001111111101101000001',
    '10111010111010001000101011101',
    '10111010011100111010001011101',
    '10111010001001110111001011101',
    '10000010010001011011001000001',
    '11111110101010101010101111111',
    '00000000111011101100000000000',
    '11101111101101010101111000100',
    '11101100101100100100111001001',
    '11011010110001100100001000111',
    '00011000000101001110101010010',
    '00001110000011111101111001011',
    '10110100100110100110011001001',
    '01101010010110001110000111011',
    '01101001011011110111110101010',
    '11001011010111000100111001011',
    '01001101000100001000111001101',
    '10011111001000000010011110011',
    '01111000011111010101100001010',
    '10111011000011001101111110000',
    '00000000011010001101100010111',
    '11111110100011000011101011011',
    '10000010101111111110100011011',
    '10111010101001011100111110010',
    '10111010000011001001100110111',
    '10111010101001100101000111001',
    '10000010100101111101101100010',
    '11111110110011011110100110011',
  ];

  // Fallback outer ring used only if s_roc_d is unavailable in offline/minimal harnesses.
  const FALLBACK_MONGOLIA_RING = [
    [87.8, 49.2],
    [92.2, 50.8],
    [99.0, 52.1],
    [104.5, 50.3],
    [111.5, 49.6],
    [119.9, 46.8],
    [116.2, 45.4],
    [111.5, 44.0],
    [106.0, 42.0],
    [98.8, 42.6],
    [91.0, 45.2],
    [87.8, 49.2],
  ];

  const DEG = Math.PI / 180;
  const RAD_TO_DEG = 180 / Math.PI;
  const SERIF = '"Noto Serif SC", "Songti SC", "STSong", Georgia, serif';
  const CALLI = '"Ma Shan Zheng", "STKaiti", "KaiTi", ' + SERIF;
  const SANS = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

  let terrainCache = null;
  let terrainLoadPromise = null;
  let lastRenderState = null;
  let modalCtrlRef = null;
  let modalRefs = null;
  let escListenerAttached = false;
  let copyTimer = null;

  function loadTerrainImage() {
    if (terrainCache && terrainCache.complete && terrainCache.naturalWidth > 0) {
      return Promise.resolve(terrainCache);
    }
    if (typeof Image === 'undefined') return Promise.resolve(null);
    if (!terrainLoadPromise) {
      terrainLoadPromise = new Promise((resolve) => {
        const img = new Image();
        let settled = false;
        const finish = (val) => {
          if (settled) return;
          settled = true;
          if (!val) terrainLoadPromise = null;
          resolve(val);
        };
        const timer = setTimeout(() => finish(null), 3500);
        img.onload = () => {
          clearTimeout(timer);
          terrainCache = img;
          finish(img);
        };
        img.onerror = () => {
          clearTimeout(timer);
          finish(null);
        };
        img.src = TERRAIN_ASSET_PATH;
      });
    }
    return terrainLoadPromise;
  }

  function ensurePosterAssets(ctrl) {
    const snapPromise =
      ctrl && typeof ctrl._ensureDynastySnapshots === 'function'
        ? ctrl._ensureDynastySnapshots('roc', 's_roc_d').catch(() => null)
        : Promise.resolve(null);
    return Promise.all([snapPromise, loadTerrainImage()]);
  }

  function zhText(ctrl, text) {
    if (!text || typeof text !== 'string') return text || '';
    if (ctrl && typeof ctrl._zh === 'function') return ctrl._zh(text);
    return text;
  }

  function uiLabel(ctrl, key, fallback) {
    if (ctrl && typeof ctrl.uiStr === 'function') return ctrl.uiStr(key, fallback);
    return fallback;
  }

  function formatAncZh(ctrl, settlement) {
    const raw = settlement ? settlement.ancient : '';
    const stripped =
      ctrl && typeof ctrl._stripPromptParenthetical === 'function'
        ? ctrl._stripPromptParenthetical(raw)
        : String(raw || '').replace(/（[^）]*）|\([^)]*\)/g, '').trim();
    return zhText(ctrl, stripped);
  }

  function formatAncEn(ctrl, dynasty, settlement) {
    const raw = settlement && settlement.ancientEn
      ? settlement.ancientEn
      : dynasty && (dynasty.key === 'roc' || dynasty.key === 'prc')
        ? ctrl && typeof ctrl.trModernCity === 'function'
          ? ctrl.trModernCity(settlement.ancient)
          : settlement.ancient
        : ctrl && typeof ctrl.trTerm === 'function'
          ? ctrl.trTerm(settlement && settlement.ancient)
          : settlement && settlement.ancient;
    return ctrl && typeof ctrl._stripPromptParenthetical === 'function'
      ? ctrl._stripPromptParenthetical(raw)
      : String(raw || '').replace(/\s*\([^)]*\)/g, '').trim();
  }

  function formatDynEn(ctrl, dynasty) {
    if (!dynasty) return '';
    const enDyn =
      ctrl && ctrl.enLocale && ctrl.enLocale.dynasties && ctrl.enLocale.dynasties[dynasty.key];
    const shortName = (enDyn && (enDyn.short || enDyn.name)) || dynasty.title || dynasty.key || '';
    return shortName === 'Warring States' ? 'Warring' : shortName;
  }

  function rankMetaForScore(ctrl, score) {
    let key = 'title_0';
    let fallback = '江湖行客 · 不妨多逛逛时间轴';
    if (score >= 85) {
      key = 'title_850';
      fallback = '太史令 · 舆图大家';
    } else if (score >= 65) {
      key = 'title_650';
      fallback = '职方郎中 · 熟稔疆理';
    } else if (score >= 40) {
      key = 'title_400';
      fallback = '州郡从事 · 略通古今';
    }
    const raw = uiLabel(ctrl, key, fallback);
    const sepIdx = raw.indexOf(' · ');
    if (sepIdx === -1) return { rankTitle: raw, rankSub: '' };
    return {
      rankTitle: raw.slice(0, sepIdx).trim(),
      rankSub: raw.slice(sepIdx + 3).trim(),
    };
  }

  function buildPosterData(ctrl) {
    const q = (ctrl && ctrl.challenge) || {};
    const deck = Array.isArray(q.deck) ? q.deck : [];
    const history = Array.isArray(q.history) ? q.history : [];
    const locale = (ctrl && ctrl.locale) || 'zh';
    const en = locale === 'en';
    const items = [];

    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      if (!entry || !entry.settlement) continue;
      const d = entry.dynasty || {};
      const s = entry.settlement;
      if (!Array.isArray(s.coord) || !Array.isArray(entry.guess)) continue;
      items.push({
        idx: i + 1,
        dynKey: d.key || '',
        dynZh: zhText(ctrl, d.badge || d.title || ''),
        dynEn: formatDynEn(ctrl, d),
        ancZh: formatAncZh(ctrl, s),
        ancEn: formatAncEn(ctrl, d, s),
        ans: s.coord,
        guess: entry.guess,
        km: Math.round(Number(entry.km) || 0),
        pts: Number(entry.pts) || 0,
      });
    }

    const total = Number(q.score) || 0;
    const roundCount = deck.length || items.length || 5;
    const maxTotal = roundCount * 20;
    const avgKm = items.length
      ? Math.round(items.reduce((acc, it) => acc + it.km, 0) / items.length)
      : 0;
    const best = items.length
      ? items.reduce((a, b) => (b.km < a.km ? b : a), items[0])
      : null;
    const rank = rankMetaForScore(ctrl, total);

    return {
      locale,
      en,
      items,
      total,
      maxTotal,
      roundCount,
      avgKm,
      best,
      rankTitle: rank.rankTitle,
      rankSub: rank.rankSub,
    };
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawParchmentBase(ctx, W, H, inset) {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#f7f2e7');
    grad.addColorStop(1, '#efe7d8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    let seed = 4032026;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 650; i++) {
      ctx.fillStyle = i % 3 === 0 ? 'rgba(130,108,82,0.032)' : 'rgba(255,252,245,0.22)';
      ctx.fillRect(rand() * W, rand() * H, 1.4, 1.4);
    }
    ctx.strokeStyle = 'rgba(43,38,34,0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(inset + 0.5, inset + 0.5, W - inset * 2 - 1, H - inset * 2 - 1);
  }

  function drawHeader(ctx, ctrl, data, yDiv) {
    const en = data.en;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#b5452f';
    ctx.font = en ? `700 24px ${SERIF}` : `400 30px ${CALLI}`;
    const brand = en ? uiLabel(ctrl, 'brand_seal', 'Jiangshan Atlas') : zhText(ctrl, '江山时序');
    const brandTitle = en && brand === '江山时序' ? 'Jiangshan Atlas' : brand;
    ctx.fillText(brandTitle, 48, 70);
    const bw = ctx.measureText(brandTitle).width;

    ctx.fillStyle = '#5d554c';
    ctx.font = `500 15px ${SERIF}`;
    ctx.fillText(
      en ? '·  Locate Quiz' : zhText(ctrl, '·  舆图寻址小试'),
      48 + bw + 12,
      71
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = '#8d847a';
    ctx.font = `500 13.5px ${SERIF}`;
    const roundZh = data.roundCount === 5 ? '五' : data.roundCount === 10 ? '十' : String(data.roundCount);
    ctx.fillText(
      en ? `${data.roundCount} Rounds` : zhText(ctrl, `${roundZh}题定疆理`),
      702,
      71
    );

    ctx.strokeStyle = 'rgba(43,38,34,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(48, yDiv);
    ctx.lineTo(702, yDiv);
    ctx.stroke();
  }

  function collectLandRings(ctrl) {
    const rings = [];
    const pushShape = (shape) => {
      if (!shape || !shape.coordinates) return;
      if (shape.type === 'Polygon') {
        if (shape.coordinates[0] && shape.coordinates[0].length >= 3) {
          rings.push(shape.coordinates[0]);
        }
      } else if (shape.type === 'MultiPolygon') {
        for (const poly of shape.coordinates) {
          if (poly && poly[0] && poly[0].length >= 3) rings.push(poly[0]);
        }
      }
    };

    const provs = typeof window !== 'undefined' ? window.PROVINCE_OUTLINES : null;
    if (Array.isArray(provs)) {
      for (const p of provs) {
        if (!p || String(p.code) === '100000_JD') continue;
        const polyList = p.rings;
        if (!Array.isArray(polyList)) continue;
        for (const poly of polyList) {
          if (poly && poly[0] && poly[0].length >= 3) rings.push(poly[0]);
        }
      }
    }

    const snaps = ctrl && ctrl.snapshots;
    if (snaps && Array.isArray(snaps.neighbors)) {
      for (const nb of snaps.neighbors) {
        if (nb && nb.shape) pushShape(nb.shape);
      }
    }

    const rocSnap = snaps && snaps.s_roc_d;
    const mongoliaPol =
      rocSnap && Array.isArray(rocSnap.polities)
        ? rocSnap.polities.find((p) => p && p.title === '蒙古人民共和国')
        : null;
    if (mongoliaPol && mongoliaPol.shape) {
      pushShape(mongoliaPol.shape);
    } else {
      rings.push(FALLBACK_MONGOLIA_RING);
    }

    return rings;
  }

  function collectPosterRivers(ctrl) {
    const lines = [];
    const hydro = (ctrl && ctrl.hydroData) || (typeof window !== 'undefined' ? window.HYDRO_DATA : null);
    const rivers = hydro && Array.isArray(hydro.rivers) ? hydro.rivers : [];
    for (const riv of rivers) {
      if (!riv || !POSTER_RIVER_NAMES.has(riv.name)) continue;
      if (riv.vanish !== undefined && riv.vanish < 2000) continue;
      for (const seg of riv.lines || []) {
        if (Array.isArray(seg) && seg.length >= 2) lines.push(seg);
      }
    }
    return lines;
  }

  function createProjector(ctrl, mx, my, mw, mh) {
    const proj = ctrl && ctrl.projector;
    let toSvg;
    if (proj && typeof proj.toScreen === 'function') {
      toSvg = ([lng, lat]) => proj.toScreen(lng, lat);
    } else {
      const latToMerc = (lat) => Math.log(Math.tan(Math.PI * 0.25 + lat * DEG * 0.5));
      const B = { west: 66, east: 142, south: 14, north: 55 };
      const spanLng = B.east - B.west;
      const spanLat = (latToMerc(B.north) - latToMerc(B.south)) * RAD_TO_DEG;
      const mScale = Math.min(1000 / spanLng, 700 / spanLat);
      const mPadX = (1000 - spanLng * mScale) * 0.5;
      const mPadY = (700 - spanLat * mScale) * 0.5;
      const northMerc = latToMerc(B.north);
      toSvg = ([lng, lat]) => [
        (lng - B.west) * mScale + mPadX,
        (northMerc - latToMerc(lat)) * RAD_TO_DEG * mScale + mPadY,
      ];
    }

    const vx0 = 32;
    const vy0 = 16;
    const vw = 944;
    const vh = 618;
    const fitScale = Math.min(mw / vw, mh / vh);
    const fitOx = (mw - vw * fitScale) * 0.5 - vx0 * fitScale;
    const fitOy = (mh - vh * fitScale) * 0.5 - vy0 * fitScale;
    const svgToLocal = ([sx, sy]) => [fitOx + sx * fitScale, fitOy + sy * fitScale];
    const projLocal = (coord) => svgToLocal(toSvg(coord));
    const projBox = (coord) => {
      const p = projLocal(coord);
      return [mx + p[0], my + p[1]];
    };
    return { fitScale, svgToLocal, projLocal, projBox };
  }

  function drawHero(ctx, ctrl, data) {
    const en = data.en;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#2b2622';
    ctx.font = en ? `700 34px ${SERIF}` : `700 46px ${SERIF}`;
    const mainTitle = data.rankTitle;
    if (en) ctx.fillText(mainTitle, 48, 170, 460);
    else ctx.fillText(mainTitle, 48, 170);

    const titleW = en ? Math.min(ctx.measureText(mainTitle).width, 460) : ctx.measureText(mainTitle).width;
    if (data.rankSub) {
      ctx.fillStyle = '#5d554c';
      ctx.font = en ? `500 16px ${SERIF}` : `500 20px ${SERIF}`;
      if (en) ctx.fillText(data.rankSub, 48, 194, 460);
      else ctx.fillText(`·  ${data.rankSub}`, 48 + titleW + 12, 167, Math.max(120, 505 - titleW));
    }

    ctx.fillStyle = '#7a7066';
    ctx.font = `500 14.5px ${SANS}`;
    let summaryText;
    if (data.best) {
      const bestLabel = en
        ? `${data.best.dynEn} · ${data.best.ancEn} ${data.best.km} km`
        : `${data.best.dynZh}·${data.best.ancZh} ${data.best.km} km`;
      summaryText = en
        ? `Mean Error ${data.avgKm} km  ·  Best ${bestLabel}`
        : zhText(ctrl, `平均误差 ${data.avgKm} km  ·  最佳一针 ${bestLabel}`);
    } else {
      summaryText = en
        ? `Mean Error ${data.avgKm} km`
        : zhText(ctrl, `平均误差 ${data.avgKm} km`);
    }
    ctx.fillText(summaryText, 48, en ? 218 : 208, 495);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#8d847a';
    ctx.font = `500 16px ${SANS}`;
    const denom = `/ ${data.maxTotal}`;
    const denomW = ctx.measureText(denom).width;
    ctx.fillText(denom, 702, 178);
    ctx.fillStyle = '#b5452f';
    ctx.font = `700 50px ${SERIF}`;
    ctx.fillText(String(data.total), 702 - denomW - 7, 180);
  }

  function drawMapSection(ctx, ctrl, data, includeTerrain) {
    const en = data.en;
    const mx = 48;
    const my = 232;
    const mw = 654;
    const mh = 432;

    ctx.save();
    roundRectPath(ctx, mx, my, mw, mh, 10);
    ctx.fillStyle = '#cddbd8';
    ctx.fill();
    ctx.clip();

    const { fitScale, svgToLocal, projLocal, projBox } = createProjector(ctrl, mx, my, mw, mh);
    const landCanvas = document.createElement('canvas');
    landCanvas.width = mw;
    landCanvas.height = mh;
    const landCtx = landCanvas.getContext('2d');

    if (landCtx) {
      const rings = collectLandRings(ctrl);
      landCtx.clearRect(0, 0, mw, mh);
      landCtx.save();
      landCtx.beginPath();
      for (const ring of rings) {
        const pts = ring.map(projLocal);
        let area = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          area += (pts[i + 1][0] - pts[i][0]) * (pts[i + 1][1] + pts[i][1]);
        }
        if (area < 0) pts.reverse();
        for (let i = 0; i < pts.length; i++) {
          if (i === 0) landCtx.moveTo(pts[i][0], pts[i][1]);
          else landCtx.lineTo(pts[i][0], pts[i][1]);
        }
        landCtx.closePath();
      }
      landCtx.fillStyle = '#efe8da';
      landCtx.fill('nonzero');
      landCtx.strokeStyle = '#efe8da';
      landCtx.lineWidth = 2.6;
      landCtx.lineJoin = 'round';
      landCtx.stroke();

      if (includeTerrain && terrainCache && terrainCache.complete && terrainCache.naturalWidth > 0) {
        landCtx.globalCompositeOperation = 'source-atop';
        landCtx.globalAlpha = 0.72;
        const [tx0, ty0] = svgToLocal([-80, -40]);
        landCtx.drawImage(terrainCache, tx0, ty0, 1160 * fitScale, 780 * fitScale);
      }
      landCtx.restore();

      ctx.save();
      ctx.shadowColor = 'rgba(72, 92, 94, 0.30)';
      ctx.shadowBlur = 2.5;
      ctx.drawImage(landCanvas, mx, my);
      ctx.restore();
    }

    // Trunk rivers
    const rivers = collectPosterRivers(ctrl);
    ctx.strokeStyle = 'rgba(74, 130, 144, 0.68)';
    ctx.lineWidth = 1.7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const line of rivers) {
      ctx.beginPath();
      for (let i = 0; i < line.length; i++) {
        const [px, py] = projBox(line[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Quiz pins & error lines
    for (const it of data.items) {
      const [gx, gy] = projBox(it.guess);
      const [ax, ay] = projBox(it.ans);

      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(184, 50, 42, 0.76)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(251, 243, 228, 0.88)';
      ctx.beginPath();
      ctx.arc(ax, ay, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2b2118';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.arc(ax, ay, 5.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#2b2118';
      ctx.beginPath();
      ctx.arc(ax, ay, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#b8322a';
      ctx.strokeStyle = '#fbf3e4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(gx, gy, 4.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Best pin highlight + callout pill with dynasty
    if (data.best) {
      const [bx, by] = projBox(data.best.ans);
      ctx.strokeStyle = 'rgba(184, 50, 42, 0.45)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(bx, by, 12, 0, Math.PI * 2);
      ctx.stroke();

      const bestText = en
        ? `Best · ${data.best.dynEn} · ${data.best.ancEn} ${data.best.km} km`
        : zhText(ctrl, `最佳 · ${data.best.dynZh}·${data.best.ancZh} ${data.best.km} km`);
      ctx.font = `600 12.5px ${SERIF}`;
      const bw = Math.min(260, ctx.measureText(bestText).width + 18);
      const bh = 24;
      let lx = bx + 16;
      if (lx + bw > mx + mw - 10) lx = bx - bw - 16;
      lx = Math.max(mx + 10, lx);
      const ly = Math.max(my + 10, Math.min(my + mh - bh - 36, by - bh / 2));

      ctx.fillStyle = 'rgba(250, 246, 237, 0.94)';
      roundRectPath(ctx, lx, ly, bw, bh, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(184, 50, 42, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#b5452f';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(bestText, lx + 9, ly + bh / 2, bw - 18);
    }

    // Map Legend Pill
    const legW = en ? 222 : 186;
    const legY = my + mh - 23;
    ctx.fillStyle = 'rgba(250, 246, 237, 0.92)';
    roundRectPath(ctx, mx + 12, my + mh - 34, legW, 22, 11);
    ctx.fill();
    ctx.strokeStyle = 'rgba(43, 38, 34, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#b8322a';
    ctx.beginPath();
    ctx.arc(mx + 25, legY, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5d554c';
    ctx.font = `500 11.5px ${SANS}`;
    ctx.fillText(en ? 'Guess' : zhText(ctrl, '落针'), mx + 33, legY);

    const txLeg = mx + (en ? 84 : 74);
    ctx.strokeStyle = '#2b2118';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(txLeg, legY, 3.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#2b2118';
    ctx.beginPath();
    ctx.arc(txLeg, legY, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5d554c';
    ctx.fillText(en ? 'Target' : zhText(ctrl, '城址'), txLeg + 8, legY);

    const exLeg = mx + (en ? 144 : 124);
    ctx.save();
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = '#b8322a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(exLeg, legY);
    ctx.lineTo(exLeg + 14, legY);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#5d554c';
    ctx.fillText(en ? 'Error' : zhText(ctrl, '误差'), exLeg + 19, legY);

    ctx.restore();
    ctx.strokeStyle = 'rgba(43, 38, 34, 0.14)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, mx, my, mw, mh, 10);
    ctx.stroke();
  }

  function dotStyle(pts) {
    if (pts === 20) return { fill: '#b5452f', hollow: false, txt: '#b5452f' };
    if (pts >= 16) return { fill: '#c6952b', hollow: false, txt: '#9a6b12' };
    if (pts >= 10) return { fill: '#8a7c6c', hollow: false, txt: '#5d554c' };
    if (pts > 0) return { fill: '#c7beb1', hollow: false, txt: '#8d847a' };
    return { fill: '#b4aa9e', hollow: true, txt: '#a3998e' };
  }

  function drawTimelineStrip(ctx, data) {
    const items = data.items;
    if (!items.length) return;
    const stripX = 48;
    const stripW = 654;

    if (!data.en || items.length <= 5) {
      const compact = items.length <= 5;
      const colW = stripW / Math.max(1, items.length);
      const maxColW = Math.floor(colW - (compact ? 12 : 6));
      const dotY = compact ? 730 : 732;
      if (items.length > 1) {
        ctx.strokeStyle = 'rgba(43, 38, 34, 0.11)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(stripX + colW * 0.5, dotY);
        ctx.lineTo(stripX + stripW - colW * 0.5, dotY);
        ctx.stroke();
      }
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const cx = stripX + colW * (i + 0.5);
        const ds = dotStyle(it.pts);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#7a7066';
        ctx.font = data.en
          ? `500 11.5px ${SANS}`
          : `500 ${compact ? 12.5 : 11.5}px ${SANS}`;
        ctx.fillText(data.en ? it.dynEn : it.dynZh, cx, compact ? 702 : 708, maxColW);

        ctx.fillStyle = '#f3ece0';
        ctx.beginPath();
        ctx.arc(cx, dotY, compact ? 10.5 : 9.5, 0, Math.PI * 2);
        ctx.fill();
        if (ds.hollow) {
          ctx.strokeStyle = ds.fill;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(cx, dotY, compact ? 7.8 : 7.2, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = ds.fill;
          ctx.beginPath();
          ctx.arc(cx, dotY, compact ? 8.2 : 7.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = '#2b2622';
        ctx.font = data.en
          ? `600 14px ${SERIF}`
          : `600 ${compact ? 15.5 : 13.5}px ${SERIF}`;
        ctx.fillText(data.en ? it.ancEn : it.ancZh, cx, 758, maxColW);
        ctx.fillStyle = ds.txt;
        ctx.font = `600 ${compact ? (data.en ? 11.5 : 12) : 11.5}px ${SANS}`;
        ctx.fillText(compact ? `${it.km} km · +${it.pts}` : `+${it.pts}`, cx, compact ? 782 : 779, maxColW);
      }
    } else {
      const colW = stripW / 5;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const r = i < 5 ? 0 : 1;
        const c = i % 5;
        const cx = stripX + colW * (c + 0.5);
        const rowBase = 696 + r * 62;
        const ds = dotStyle(it.pts);

        ctx.font = `500 11px ${SANS}`;
        const dw = Math.min(ctx.measureText(it.dynEn).width, 102);
        const pairW = 10 + 5 + dw;
        const dotCx = cx - pairW * 0.5 + 5;

        if (ds.hollow) {
          ctx.strokeStyle = ds.fill;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(dotCx, rowBase, 4.4, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = ds.fill;
          ctx.beginPath();
          ctx.arc(dotCx, rowBase, 4.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#7a7066';
        ctx.fillText(it.dynEn, dotCx + 10, rowBase, 102);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#2b2622';
        ctx.font = `600 13px ${SERIF}`;
        ctx.fillText(it.ancEn, cx, rowBase + 19, 122);

        ctx.fillStyle = ds.txt;
        ctx.font = `600 11px ${SANS}`;
        ctx.fillText(`+${it.pts}`, cx, rowBase + 36);
      }
    }
  }

  function drawFooterQR(ctx, ctrl, data) {
    const divY = 828;
    const en = data.en;

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(43,38,34,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(48, divY);
    ctx.lineTo(702, divY);
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#2b2622';
    ctx.font = `700 20px ${SERIF}`;
    ctx.fillText(
      uiLabel(ctrl, 'quiz_poster_cta', '测测你在古代能当几品官？'),
      48,
      divY + 46,
      530
    );

    ctx.fillStyle = '#5d554c';
    ctx.font = `400 14px ${SANS}`;
    ctx.fillText(
      uiLabel(ctrl, 'quiz_poster_sub', '扫码开启五题古地名寻址小试'),
      48,
      divY + 76,
      530
    );

    ctx.fillStyle = '#8d847a';
    ctx.font = `500 12.5px ${MONO}`;
    ctx.fillText(SHARE_URL_DISPLAY, 48, divY + 104);

    const qx = 601;
    const qy = divY + 18;
    const qs = 101;
    const cell = 3;
    const qPad = 7;
    ctx.fillStyle = '#fffdf8';
    roundRectPath(ctx, qx, qy, qs, qs, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(43,38,34,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#2b2622';
    for (let r = 0; r < QR_MATRIX.length; r++) {
      const rowStr = QR_MATRIX[r];
      for (let c = 0; c < rowStr.length; c++) {
        if (rowStr[c] === '1') {
          ctx.fillRect(qx + qPad + c * cell, qy + qPad + r * cell, cell, cell);
        }
      }
    }
  }

  function paintCanvas(canvas, ctrl, data, includeTerrain) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawParchmentBase(ctx, POSTER_W, POSTER_H, 20);
    drawHeader(ctx, ctrl, data, 102);
    drawHero(ctx, ctrl, data);
    drawMapSection(ctx, ctrl, data, includeTerrain);
    drawTimelineStrip(ctx, data);
    drawFooterQR(ctx, ctrl, data);
  }

  function render(ctrl, opts = {}) {
    const data = buildPosterData(ctrl);
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return { canvas: null, dataUrl: '', data };
    }
    const canvas = document.createElement('canvas');
    canvas.width = POSTER_W;
    canvas.height = POSTER_H;
    const tryTerrain = opts.includeTerrain !== false;
    paintCanvas(canvas, ctrl, data, tryTerrain);

    let dataUrl = '';
    try {
      dataUrl = canvas.toDataURL('image/png');
    } catch (_) {
      // file:// origins taint canvas after drawing a local raster image; fall back to clean vector terrain.
      if (tryTerrain) {
        paintCanvas(canvas, ctrl, data, false);
        try {
          dataUrl = canvas.toDataURL('image/png');
        } catch (__) {
          dataUrl = '';
        }
      }
    }
    lastRenderState = { canvas, dataUrl, data };
    return lastRenderState;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => {
      if (!canvas) {
        resolve(null);
        return;
      }
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      } else {
        resolve(null);
      }
    });
  }

  function ensureModalDom() {
    if (modalRefs && modalRefs.root && modalRefs.root.isConnected) return modalRefs;
    if (typeof document === 'undefined' || !document.body) return null;

    const root = document.createElement('div');
    root.id = 'quiz-poster-modal';
    root.className = 'quiz-poster-modal is-hidden';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'quiz-poster-modal-title');
    root.innerHTML =
      '<div class="quiz-poster-dialog">' +
      '  <div class="quiz-poster-head">' +
      '    <div class="quiz-poster-title-group">' +
      '      <span id="quiz-poster-kicker" class="mode-pill is-active"></span>' +
      '      <h3 id="quiz-poster-modal-title" class="quiz-poster-title"></h3>' +
      '    </div>' +
      '    <button id="act-poster-close" class="icon-close" type="button">' +
      '      <svg class="ico-svg" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
      '        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      '      </svg>' +
      '    </button>' +
      '  </div>' +
      '  <div class="quiz-poster-stage">' +
      '    <img id="quiz-poster-preview" class="quiz-poster-img" alt="" />' +
      '  </div>' +
      '  <div class="quiz-poster-foot">' +
      '    <div class="quiz-poster-actions">' +
      '      <button id="act-poster-download" class="action-btn accent" type="button"></button>' +
      '      <button id="act-poster-copy" class="action-btn subtle is-hidden" type="button"></button>' +
      '      <button id="act-poster-share" class="action-btn subtle is-hidden" type="button"></button>' +
      '    </div>' +
      '    <div id="quiz-poster-hint" class="quiz-poster-hint"></div>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(root);

    modalRefs = {
      root,
      kicker: root.querySelector('#quiz-poster-kicker'),
      title: root.querySelector('#quiz-poster-modal-title'),
      closeBtn: root.querySelector('#act-poster-close'),
      preview: root.querySelector('#quiz-poster-preview'),
      dlBtn: root.querySelector('#act-poster-download'),
      copyBtn: root.querySelector('#act-poster-copy'),
      shareBtn: root.querySelector('#act-poster-share'),
      hint: root.querySelector('#quiz-poster-hint'),
    };

    root.addEventListener('click', (e) => {
      if (e.target === root) close();
    });
    modalRefs.closeBtn.addEventListener('click', close);

    modalRefs.dlBtn.addEventListener('click', () => {
      if (!lastRenderState || !lastRenderState.dataUrl) return;
      const a = document.createElement('a');
      a.download = `jiangshan-quiz-${lastRenderState.data.total}.png`;
      a.href = lastRenderState.dataUrl;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    modalRefs.copyBtn.addEventListener('click', () => {
      if (!lastRenderState || !lastRenderState.canvas) return;
      if (!navigator.clipboard || typeof window.ClipboardItem !== 'function') return;
      try {
        const blobPromise = canvasToBlob(lastRenderState.canvas);
        navigator.clipboard
          .write([new window.ClipboardItem({ 'image/png': blobPromise })])
          .then(() => {
            if (copyTimer) clearTimeout(copyTimer);
            const c = modalCtrlRef;
            modalRefs.copyBtn.textContent = uiLabel(c, 'quiz_poster_copied', '已复制 ✓');
            copyTimer = setTimeout(() => {
              if (modalRefs && modalRefs.copyBtn) {
                modalRefs.copyBtn.textContent = uiLabel(modalCtrlRef, 'quiz_poster_copy', '复制图片');
              }
            }, 1800);
          })
          .catch(() => {});
      } catch (_) {}
    });

    modalRefs.shareBtn.addEventListener('click', () => {
      if (!lastRenderState || !lastRenderState.canvas || typeof navigator.share !== 'function') return;
      canvasToBlob(lastRenderState.canvas).then((blob) => {
        if (!blob || typeof File !== 'function') return;
        const filename = `jiangshan-quiz-${lastRenderState.data.total}.png`;
        const file = new File([blob], filename, { type: 'image/png' });
        if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
          return;
        }
        navigator
          .share({
            files: [file],
            title: uiLabel(modalCtrlRef, 'quiz_poster_title', '舆图寻址战绩图'),
            url: SHARE_URL_FULL,
          })
          .catch(() => {});
      });
    });

    if (!escListenerAttached && typeof document.addEventListener === 'function') {
      escListenerAttached = true;
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalRefs && !modalRefs.root.classList.contains('is-hidden')) {
          close();
        }
      });
    }

    return modalRefs;
  }

  function applyModalLocale(ctrl, refs, data) {
    refs.kicker.textContent = uiLabel(ctrl, 'quiz_poster_kicker', '舆图寻址');
    refs.title.textContent = uiLabel(ctrl, 'quiz_poster_title', '战绩藏书票');
    const closeLbl = uiLabel(ctrl, 'quiz_poster_close', '关闭');
    refs.closeBtn.title = closeLbl;
    refs.closeBtn.setAttribute('aria-label', closeLbl);
    refs.preview.alt = uiLabel(ctrl, 'quiz_poster_title', '舆图寻址战绩图');
    refs.dlBtn.textContent = uiLabel(ctrl, 'quiz_poster_save', '保存图片');
    refs.copyBtn.textContent = uiLabel(ctrl, 'quiz_poster_copy', '复制图片');
    refs.shareBtn.textContent = uiLabel(ctrl, 'quiz_poster_share', '系统分享…');
    refs.hint.textContent = uiLabel(ctrl, 'quiz_poster_hint', '手机端也可长按图片直接保存');

    const canCopy =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.clipboard) &&
      typeof window !== 'undefined' &&
      typeof window.ClipboardItem === 'function';
    refs.copyBtn.classList.toggle('is-hidden', !canCopy);

    refs.shareBtn.classList.add('is-hidden');
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      typeof File === 'function' &&
      lastRenderState &&
      lastRenderState.canvas
    ) {
      canvasToBlob(lastRenderState.canvas).then((blob) => {
        if (!blob || !refs || !refs.shareBtn) return;
        const testFile = new File([blob], `jiangshan-quiz-${data.total}.png`, {
          type: 'image/png',
        });
        try {
          if (navigator.canShare({ files: [testFile] })) {
            refs.shareBtn.classList.remove('is-hidden');
          }
        } catch (_) {}
      });
    }

    if (ctrl && ctrl.locale === 'zh-tw' && typeof ctrl._applyZhHantDom === 'function') {
      ctrl._applyZhHantDom(refs.root);
    }
  }

  function renderIntoModal(ctrl) {
    modalCtrlRef = ctrl;
    const refs = ensureModalDom();
    if (!refs) return null;
    const res = render(ctrl);
    refs.preview.src = res.dataUrl;
    applyModalLocale(ctrl, refs, res.data);
    refs.root.classList.remove('is-hidden');
    return res;
  }

  function open(ctrl) {
    modalCtrlRef = ctrl;
    return ensurePosterAssets(ctrl).then(() => {
      if (ctrl && ctrl.challenge && !ctrl.challenge.finished) return null;
      return renderIntoModal(ctrl);
    });
  }

  function close() {
    if (copyTimer) {
      clearTimeout(copyTimer);
      copyTimer = null;
    }
    if (modalRefs && modalRefs.root) {
      modalRefs.root.classList.add('is-hidden');
    }
  }

  function refreshIfOpen(ctrl) {
    if (!modalRefs || !modalRefs.root || modalRefs.root.classList.contains('is-hidden')) {
      return Promise.resolve(null);
    }
    return ensurePosterAssets(ctrl).then(() => renderIntoModal(ctrl));
  }

  if (typeof window !== 'undefined') {
    window.JiangshanQuizPoster = {
      buildPosterData,
      render,
      open,
      close,
      refreshIfOpen,
    };
  }
})();
