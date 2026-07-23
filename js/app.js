/**
 * Master Controller for 《指点江山：中国历史地理挑战赛》
 * Fixed High-Contrast D3 GIS Map & Guaranteed Clickable Strategy Theater
 */

document.addEventListener('DOMContentLoaded', async () => {
  const state = {
    currentView: 'viewLobby',
    dynasties: [],
    heroes: [],
    conquestScenarios: [],
    conquestRegions: {},
    gisLoaded: false,

    layers: {
      provinces: true,
      rivers: true
    },

    quiz: {
      difficulty: 'standard', // standard | hell
      rounds: [],
      currentIndex: 0,
      score: 0,
      combo: 0,
      timer: null,
      timeLeft: 15,
      answered: false
    },

    conquest: {
      activeScenario: null,
      playerFaction: null,
      ownership: {}, // regionId -> factionId
      selectedRegionId: null,
      gold: 500,
      troops: 30, // 万
      morale: 90,
      turnYear: 1,
      unlockedRegionsCount: 0
    }
  };

  async function loadGameData() {
    try {
      const [dynRes, heroRes, regionRes] = await Promise.all([
        fetch('data/dynasties.json'),
        fetch('data/heroes.json'),
        fetch('data/regions_graph.json')
      ]);
      state.dynasties = await dynRes.json();
      state.heroes = await heroRes.json();
      const regData = await regionRes.json();
      state.conquestScenarios = regData.scenarios;
      state.conquestRegions = regData.regions;
    } catch (e) {
      console.warn('Fallback internal game data:', e);
      state.dynasties = window.FALLBACK_DYNASTIES || [];
      state.heroes = window.FALLBACK_HEROES || [];
    }

    try {
      await window.MAP_HELPER.loadGISData();
      state.gisLoaded = true;
    } catch (e) {
      console.warn('GIS GeoJSON fallback error:', e);
    }
  }

  await loadGameData();

  // -------------------------------------------------------------
  // AUDIO TOGGLE & VIEW NAVIGATION
  // -------------------------------------------------------------
  const btnToggleSound = document.getElementById('btnToggleSound');
  const soundLabel = document.getElementById('soundLabel');
  btnToggleSound?.addEventListener('click', () => {
    const isMuted = window.soundEngine.toggleMuted();
    soundLabel.textContent = isMuted ? '乐效: 关' : '乐效: 开';
    document.getElementById('audioWaveVisualizer').style.opacity = isMuted ? '0.3' : '1';
  });

  function switchView(targetViewId) {
    window.soundEngine.playStoneClick();
    document.querySelectorAll('.game-view').forEach(v => v.classList.remove('active'));
    const targetEl = document.getElementById(targetViewId);
    if (targetEl) targetEl.classList.add('active');
    state.currentView = targetViewId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.getElementById('brandLobbyBtn')?.addEventListener('click', () => switchView('viewLobby'));
  document.getElementById('quizBackBtn')?.addEventListener('click', () => {
    clearInterval(state.quiz.timer);
    switchView('viewLobby');
  });
  document.getElementById('conquestBackBtn')?.addEventListener('click', () => switchView('viewLobby'));

  // Achievements Modal
  const ACHIEVEMENTS_DATA = [
    { title: '秦皇一统', desc: '辨识大秦三十六郡版图，万里长城始筑', icon: '👑', unlocked: true },
    { title: '汉武都护', desc: '考据西域都护府与河西四郡商路要隘', icon: '📜', unlocked: true },
    { title: '大唐万国', desc: '掌控安西都护府大一统海纳百川版图', icon: '⛩️', unlocked: true },
    { title: '割据辨误', desc: '区分幽云十六州与北方后周割据红线', icon: '⚔️', unlocked: false },
    { title: '三国鼎立', desc: '魏蜀吴三分天下关隘防线洞若观火', icon: '🛡️', unlocked: false },
    { title: '潼关要隘', desc: '准确锁死中原与关中交界雄关咽喉', icon: '🏔️', unlocked: false },
    { title: '混一宇内', desc: '天下大势完成 24 大战略要区全部吞并', icon: '🏆', unlocked: false },
    { title: '舆图大宗师', desc: '看图猜朝代单局总分突破 520 分', icon: '🦅', unlocked: false },
    { title: '指点江山', desc: '通晓二十四史中原及四夷地理关隘', icon: '🗺️', unlocked: false }
  ];

  document.getElementById('btnAchievements')?.addEventListener('click', () => {
    window.soundEngine.playStoneClick();
    const modal = document.getElementById('achievementsModal');
    const grid = document.getElementById('achievementsGrid');
    if (!grid || !modal) return;
    grid.innerHTML = '';
    ACHIEVEMENTS_DATA.forEach(a => {
      const card = document.createElement('div');
      card.style.cssText = `
        background: ${a.unlocked ? 'rgba(241,196,15,0.12)' : 'rgba(255,255,255,0.03)'};
        border: 1px solid ${a.unlocked ? 'var(--gold-emperor)' : 'rgba(255,255,255,0.08)'};
        border-radius: 12px;
        padding: 12px;
        opacity: ${a.unlocked ? '1' : '0.45'};
      `;
      card.innerHTML = `
        <div style="font-size:24px; margin-bottom:6px">${a.icon}</div>
        <strong style="color:${a.unlocked ? '#ffd700' : '#8b949e'}; font-size:14px">${a.title}</strong>
        <span style="font-size:10px; float:right; color:${a.unlocked ? '#2ecc71' : '#8b949e'}">${a.unlocked ? '✓ 已获得' : '🔒 未解锁'}</span>
        <p style="font-size:11px; color:var(--text-secondary); margin-top:6px">${a.desc}</p>
      `;
      grid.appendChild(card);
    });
    modal.classList.add('open');
  });

  document.getElementById('btnCloseAchievements')?.addEventListener('click', () => {
    document.getElementById('achievementsModal')?.classList.remove('open');
  });

  // Top Bar Modern Overlay Sync
  const chkModernOverlay = document.getElementById('chkModernOverlay');
  chkModernOverlay?.addEventListener('change', (e) => {
    state.layers.provinces = e.target.checked;
    const mapBtn = document.getElementById('btnToggleProvinces');
    if (mapBtn) mapBtn.classList.toggle('active', state.layers.provinces);
    if (state.currentView === 'viewQuiz') renderQuizRound();
  });

  // -------------------------------------------------------------
  // HIGH-CONTRAST D3.JS GIS MAP ENGINE
  // -------------------------------------------------------------
  function drawD3GISBaseMap(svgEl, options = {}) {
    const {
      yellowRiver = true,
      yangtze = true,
      greatWall = true,
      silkRoad = false,
      grandCanal = false,
      modernProvinces = true,
      customProvincesFill = null,
      onProvinceHover = null,
      onProvinceClick = null
    } = options;

    const { getGISStore, getD3PathGenerator, HISTORICAL_GEOMETRIES, lonLatToSvg } = window.MAP_HELPER;
    const gisStore = getGISStore();
    const pathGen = getD3PathGenerator();

    svgEl.innerHTML = '';
    const width = 900;
    const height = 580;

    const rootG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    rootG.setAttribute('class', 'gis-map-root');
    svgEl.appendChild(rootG);

    // Dark high-contrast deep space ocean canvas
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', width);
    bgRect.setAttribute('height', height);
    bgRect.setAttribute('fill', '#070a10');
    rootG.appendChild(bgRect);

    // Subtle Meridian & Parallel Grid Lines
    const gridG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridG.setAttribute('class', 'map-canvas-grid');
    for (let lon = 75; lon <= 135; lon += 10) {
      const p1 = lonLatToSvg(lon, 16);
      const p2 = lonLatToSvg(lon, 53);
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', p1.x); l.setAttribute('y1', p1.y);
      l.setAttribute('x2', p2.x); l.setAttribute('y2', p2.y);
      l.setAttribute('stroke', 'rgba(0, 242, 254, 0.07)');
      l.setAttribute('stroke-dasharray', '4,5');
      gridG.appendChild(l);
    }
    for (let lat = 20; lat <= 50; lat += 8) {
      const p1 = lonLatToSvg(72, lat);
      const p2 = lonLatToSvg(136, lat);
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', p1.x); l.setAttribute('y1', p1.y);
      l.setAttribute('x2', p2.x); l.setAttribute('y2', p2.y);
      l.setAttribute('stroke', 'rgba(0, 242, 254, 0.07)');
      l.setAttribute('stroke-dasharray', '4,5');
      gridG.appendChild(l);
    }
    rootG.appendChild(gridG);

    // Layer 1: Official High-Precision Chinese Provinces GeoJSON
    const chinaG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chinaG.setAttribute('class', 'china-provinces-layer');

    if (gisStore.chinaGeo && gisStore.chinaGeo.features && typeof d3 !== 'undefined' && pathGen) {
      gisStore.chinaGeo.features.forEach(feat => {
        const provName = feat.properties ? (feat.properties.name || feat.properties.fullname || '') : '';
        const dStr = pathGen(feat);
        if (!dStr) return;

        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', dStr);
        pathEl.setAttribute('class', 'province-path');

        let fill = '#101724';
        let opacity = '0.92';
        let stroke = modernProvinces ? 'rgba(0, 242, 254, 0.48)' : 'rgba(255,255,255,0.08)';
        let strokeWidth = modernProvinces ? '1.5' : '1.0';

        if (customProvincesFill) {
          const customStyle = customProvincesFill(provName, feat);
          if (customStyle) {
            if (customStyle.fill) fill = customStyle.fill;
            if (customStyle.opacity) opacity = customStyle.opacity;
            if (customStyle.stroke) stroke = customStyle.stroke;
            if (customStyle.strokeWidth) strokeWidth = customStyle.strokeWidth;
          }
        }

        pathEl.setAttribute('fill', fill);
        pathEl.setAttribute('fill-opacity', opacity);
        pathEl.setAttribute('stroke', stroke);
        pathEl.setAttribute('stroke-width', strokeWidth);
        pathEl.dataset.province = provName;

        if (onProvinceHover) {
          pathEl.addEventListener('mouseenter', (evt) => onProvinceHover(provName, feat, evt));
          pathEl.addEventListener('mousemove', (evt) => onProvinceHover(provName, feat, evt));
          pathEl.addEventListener('mouseleave', (evt) => onProvinceHover(null, null, evt));
        }
        if (onProvinceClick) {
          pathEl.addEventListener('pointerdown', (evt) => {
            evt.stopPropagation();
            onProvinceClick(provName, feat, evt);
          });
        }

        chinaG.appendChild(pathEl);

        // Render Modern Province Pin Label with anti-collision spacing offsets
        if (modernProvinces && pathGen && provName) {
          const centerPt = pathGen.centroid(feat);
          if (centerPt && !isNaN(centerPt[0]) && !isNaN(centerPt[1])) {
            const shortName = provName.replace(/省|市|壮族|维吾尔|回族|特别行政区|自治区/g, '');
            const OFFSETS = {
              '北京': { dx: -4, dy: -8 },
              '天津': { dx: 16, dy: 8 },
              '上海': { dx: 14, dy: 4 },
              '香港': { skip: true },
              '澳门': { skip: true },
              '江苏': { dx: -6, dy: -4 },
              '浙江': { dx: 4, dy: 6 },
              '安徽': { dx: -4, dy: 2 },
              '河北': { dx: -12, dy: 4 }
            };
            const cfg = OFFSETS[shortName] || { dx: 0, dy: 0 };
            if (!cfg.skip) {
              const txtEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
              txtEl.setAttribute('x', centerPt[0] + (cfg.dx || 0));
              txtEl.setAttribute('y', centerPt[1] + 3 + (cfg.dy || 0));
              txtEl.setAttribute('class', 'modern-prov-label');
              txtEl.setAttribute('text-anchor', 'middle');
              txtEl.textContent = shortName;
              chinaG.appendChild(txtEl);
            }
          }
        }
      });
    }
    rootG.appendChild(chinaG);

    // Layer 2: Natural Rivers & Historical Passes Lines
    const riverG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    riverG.setAttribute('class', 'natural-features-layer');

    const drawPolyline = (coordsList, color, widthLine, dashArray, titleText) => {
      const pts = coordsList.map(c => lonLatToSvg(c[0], c[1]));
      const pathStr = 'M ' + pts.map(p => `${p.x},${p.y}`).join(' L ');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', pathStr);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', color);
      p.setAttribute('stroke-width', widthLine);
      if (dashArray) p.setAttribute('stroke-dasharray', dashArray);
      p.setAttribute('filter', `drop-shadow(0 0 6px ${color})`);
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = titleText;
      p.appendChild(title);
      riverG.appendChild(p);
    };

    if (yellowRiver) {
      drawPolyline(HISTORICAL_GEOMETRIES.yellowRiver, '#e67e22', '3.0', null, '几字形中华母亲河 · 黄河');
    }
    if (yangtze) {
      drawPolyline(HISTORICAL_GEOMETRIES.yangtzeRiver, '#3498db', '3.2', null, '天堑千古 · 长江万古流');
    }
    if (greatWall) {
      drawPolyline(HISTORICAL_GEOMETRIES.greatWall, '#e74c3c', '3.5', '6,4', '抵御游牧骑兵 · 秦汉明万里长城');
    }
    if (silkRoad) {
      drawPolyline(HISTORICAL_GEOMETRIES.silkRoad, '#f1c40f', '2.4', '8,4', '张骞凿空西域 · 陆上丝绸之路');
    }
    if (grandCanal) {
      drawPolyline(HISTORICAL_GEOMETRIES.grandCanal, '#2ecc71', '2.4', '4,3', '隋唐大运河 · 贯通南北血脉');
    }

    rootG.appendChild(riverG);

    // Layer 3: Ancient Capital Pins
    const capitalG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    capitalG.setAttribute('class', 'historical-capitals-layer');
    const FAMOUS_STRONGHOLDS = [
      { name: '咸阳/长安', coords: [108.94, 34.26], tag: '古都' },
      { name: '洛阳城', coords: [112.45, 34.62], tag: '神都' },
      { name: '开封府', coords: [114.30, 34.80], tag: '东京' },
      { name: '燕京/大都', coords: [116.40, 39.90], tag: '帝都' },
      { name: '金陵/建康', coords: [118.79, 32.06], tag: '六朝' },
      { name: '潼关天险', coords: [110.28, 34.54], tag: '天险' },
      { name: '虎牢关', coords: [113.15, 34.82], tag: '要隘' },
      { name: '剑门关', coords: [105.57, 32.25], tag: '蜀道' }
    ];

    FAMOUS_STRONGHOLDS.forEach(st => {
      const pos = lonLatToSvg(st.coords[0], st.coords[1]);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', pos.x); dot.setAttribute('cy', pos.y);
      dot.setAttribute('r', st.tag === '古都' || st.tag === '帝都' ? '5.5' : '3.8');
      dot.setAttribute('fill', '#ffd700');
      dot.setAttribute('stroke', '#000');
      dot.setAttribute('stroke-width', '1.5');
      dot.style.pointerEvents = 'none';
      capitalG.appendChild(dot);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', pos.x + 7); label.setAttribute('y', pos.y + 4);
      label.setAttribute('fill', '#ffe066');
      label.setAttribute('font-size', '10');
      label.setAttribute('font-weight', 'bold');
      label.style.pointerEvents = 'none';
      label.style.textShadow = '0 1px 3px #000';
      label.textContent = st.name;
      capitalG.appendChild(label);
    });

    rootG.appendChild(capitalG);

    attachD3Zoom(svgEl, rootG, options.btnReset, options.btnZoomIn, options.btnZoomOut);

    return { rootG, chinaG, riverG, capitalG };
  }

  function attachD3Zoom(svgEl, rootG, btnReset, btnZoomIn, btnZoomOut) {
    if (typeof d3 === 'undefined') return;
    const svg = d3.select(svgEl);
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .filter((evt) => {
        // Prevent D3 drag zoom from swallowing simple pointer clicks
        return evt.type !== 'pointerdown' && evt.type !== 'mousedown' || evt.button === 0;
      })
      .on('zoom', (event) => {
        d3.select(rootG).attr('transform', event.transform);
      });

    svg.call(zoom);

    if (btnZoomIn) {
      btnZoomIn.onclick = () => svg.transition().duration(260).call(zoom.scaleBy, 1.4);
    }
    if (btnZoomOut) {
      btnZoomOut.onclick = () => svg.transition().duration(260).call(zoom.scaleBy, 0.7);
    }
    if (btnReset) {
      btnReset.onclick = () => svg.transition().duration(360).call(zoom.transform, d3.zoomIdentity);
    }
  }

  function showFloatingTooltip(tooltipEl, title, coordsStr, desc, evt) {
    if (!tooltipEl) return;
    tooltipEl.classList.remove('hidden');
    tooltipEl.innerHTML = `
      <div class="tactical-tooltip-title">${title}</div>
      <div class="tactical-tooltip-coords">${coordsStr}</div>
      <div class="tactical-tooltip-desc">${desc}</div>
    `;
    const container = tooltipEl.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top - 14;
      tooltipEl.style.left = `${Math.max(100, Math.min(rect.width - 100, x))}px`;
      tooltipEl.style.top = `${Math.max(65, y)}px`;
    }
  }

  function hideFloatingTooltip(tooltipEl) {
    if (tooltipEl) tooltipEl.classList.add('hidden');
  }

  // =============================================================
  // MODE 1: 看图猜朝代 (GEO-QUIZ HIGH-CONTRAST EMPIRE MAP)
  // =============================================================
  const quizDiffBtns = document.querySelectorAll('[data-quiz-diff]');
  quizDiffBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      quizDiffBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.quiz.difficulty = e.target.getAttribute('data-quiz-diff');
    });
  });

  document.getElementById('btnLaunchQuiz')?.addEventListener('click', () => {
    startQuizMode();
  });

  function startQuizMode() {
    state.quiz.score = 0;
    state.quiz.combo = 0;
    state.quiz.currentIndex = 0;

    const filtered = state.dynasties.filter(d =>
      state.quiz.difficulty === 'hell' ? d.difficulty === 'hell' : d.difficulty === 'standard'
    );
    state.quiz.rounds = filtered.sort(() => Math.random() - 0.5).slice(0, 5);

    document.getElementById('quizModeBadgeLabel').textContent =
      state.quiz.difficulty === 'hell' ? '看图猜朝代 · 【爆款割据】南北朝/五代十国乱世考题' : '看图猜朝代 · 极盛大一统疆域辨识';

    switchView('viewQuiz');
    renderQuizRound();
  }

  function renderQuizRound() {
    clearInterval(state.quiz.timer);
    const round = state.quiz.rounds[state.quiz.currentIndex];
    if (!round) {
      showQuizFinalSummary();
      return;
    }

    state.quiz.answered = false;
    state.quiz.timeLeft = 15;

    document.getElementById('quizCurrentProgress').textContent = `${state.quiz.currentIndex + 1} / ${state.quiz.rounds.length}`;
    document.getElementById('quizScoreText').textContent = state.quiz.score;
    document.getElementById('quizComboText').textContent = `X${state.quiz.combo} COMBO`;
    document.getElementById('quizDetailCard').style.display = 'none';

    const svgEl = document.getElementById('quizMapSvg');
    const tooltipEl = document.getElementById('quizTooltip');
    const dynastyConfig = window.MAP_HELPER.DYNASTY_PROVINCES_CONFIG[round.id];

    // High-Contrast Empire Hues: Active Empire Provinces vs Inactive Shadow Provinces
    const customProvinceFill = (provName) => {
      if (!dynastyConfig) return null;

      if (dynastyConfig.splitFactions) {
        for (const fac of dynastyConfig.splitFactions) {
          const match = fac.keywords.some(kw => provName.includes(kw));
          if (match) {
            return {
              fill: fac.color,
              opacity: '0.85',
              stroke: '#ffd700',
              strokeWidth: '2.2'
            };
          }
        }
        return { fill: '#0a0e16', opacity: '0.94', stroke: 'rgba(255,255,255,0.06)', strokeWidth: '0.8' };
      } else if (dynastyConfig.coreKeywords) {
        const isCore = dynastyConfig.coreKeywords.some(kw => provName.includes(kw));
        if (isCore) {
          return {
            fill: round.color || '#e74c3c',
            opacity: '0.82',
            stroke: round.borderColor || '#ffd700',
            strokeWidth: '2.5'
          };
        }
        return { fill: '#090d14', opacity: '0.95', stroke: 'rgba(255,255,255,0.06)', strokeWidth: '0.8' };
      }
      return null;
    };

    drawD3GISBaseMap(svgEl, {
      yellowRiver: state.layers.rivers,
      yangtze: state.layers.rivers,
      greatWall: round.features && round.features.some(f => f.includes('长城')),
      silkRoad: round.features && round.features.some(f => f.includes('丝绸之路') || f.includes('都护府')),
      modernProvinces: state.layers.provinces,
      customProvincesFill: customProvinceFill,
      btnReset: document.getElementById('btnQuizZoomReset'),
      btnZoomIn: document.getElementById('btnQuizZoomIn'),
      btnZoomOut: document.getElementById('btnQuizZoomOut'),
      onProvinceHover: (provName, feat, evt) => {
        if (!provName) {
          hideFloatingTooltip(tooltipEl);
          return;
        }
        showFloatingTooltip(
          tooltipEl,
          provName,
          `历史考证 :: 局域观察`,
          `观察当前省份边缘边界。若被高亮着色，代表其在目标时代属于中原主权或割据大郡。`,
          evt
        );
      }
    });

    // 绘制都城脉冲标志
    if (round.capital && round.capital.coords) {
      const rootG = svgEl.querySelector('.gis-map-root');
      if (rootG) {
        const capPt = window.MAP_HELPER.lonLatToSvg(round.capital.coords[0], round.capital.coords[1]);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', capPt.x); circle.setAttribute('cy', capPt.y);
        circle.setAttribute('r', '9');
        circle.setAttribute('fill', '#ffd700');
        circle.setAttribute('stroke', '#e74c3c');
        circle.setAttribute('stroke-width', '2.5');
        circle.setAttribute('class', 'capital-pulse');
        rootG.appendChild(circle);
      }
    }

    // 渲染下方特征线索 Chips
    const clueChipsContainer = document.getElementById('quizClueChips');
    clueChipsContainer.innerHTML = '';
    (round.features || []).forEach(feat => {
      const chip = document.createElement('span');
      chip.className = 'clue-chip';
      chip.textContent = `🔍 关键考点: ${feat}`;
      clueChipsContainer.appendChild(chip);
    });

    // 渲染 4 个答题选项
    const optionsContainer = document.getElementById('quizOptionsContainer');
    optionsContainer.innerHTML = '';
    round.options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.className = 'btn-option-choice';
      btn.innerHTML = `<span><strong>${String.fromCharCode(65 + idx)}.</strong> ${optText}</span> <span>➔</span>`;
      btn.addEventListener('click', () => handleQuizOptionSelect(idx, btn));
      optionsContainer.appendChild(btn);
    });

    startQuizTimer();
  }

  document.getElementById('btnToggleProvinces')?.addEventListener('click', (e) => {
    state.layers.provinces = !state.layers.provinces;
    e.target.classList.toggle('active', state.layers.provinces);
    const topChk = document.getElementById('chkModernOverlay');
    if (topChk) topChk.checked = state.layers.provinces;
    if (state.currentView === 'viewQuiz') renderQuizRound();
  });
  document.getElementById('btnToggleRivers')?.addEventListener('click', (e) => {
    state.layers.rivers = !state.layers.rivers;
    e.target.classList.toggle('active', state.layers.rivers);
    if (state.currentView === 'viewQuiz') renderQuizRound();
  });

  function startQuizTimer() {
    const timerBar = document.getElementById('quizTimerBar');
    timerBar.style.width = '100%';
    const totalMs = 15000;
    const startTime = Date.now();

    state.quiz.timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainRatio = Math.max(0, (totalMs - elapsed) / totalMs);
      timerBar.style.width = `${remainRatio * 100}%`;
      state.quiz.timeLeft = Math.ceil((totalMs - elapsed) / 1000);

      if (remainRatio <= 0) {
        clearInterval(state.quiz.timer);
        handleQuizTimeout();
      }
    }, 80);
  }

  function handleQuizOptionSelect(selectedIndex, selectedBtn) {
    if (state.quiz.answered) return;
    state.quiz.answered = true;
    clearInterval(state.quiz.timer);

    const round = state.quiz.rounds[state.quiz.currentIndex];
    const isRight = selectedIndex === round.correctAnswer;
    const optionBtns = document.querySelectorAll('.btn-option-choice');

    if (isRight) {
      window.soundEngine.playGongWin();
      selectedBtn.classList.add('correct');
      state.quiz.combo++;
      const timeBonus = Math.round(state.quiz.timeLeft * 8);
      state.quiz.score += (100 + state.quiz.combo * 30 + timeBonus);
      document.getElementById('quizScoreText').textContent = state.quiz.score;
      document.getElementById('quizComboText').textContent = `X${state.quiz.combo} COMBO!`;
    } else {
      window.soundEngine.playErrorBuzz();
      selectedBtn.classList.add('wrong');
      document.getElementById('quizMapContainer').classList.add('screen-shake');
      setTimeout(() => document.getElementById('quizMapContainer').classList.remove('screen-shake'), 500);
      state.quiz.combo = 0;
      document.getElementById('quizComboText').textContent = `X0 COMBO`;
      if (optionBtns[round.correctAnswer]) {
        optionBtns[round.correctAnswer].classList.add('correct');
      }
    }

    showQuizDetailCard(round);
  }

  function handleQuizTimeout() {
    if (state.quiz.answered) return;
    state.quiz.answered = true;
    window.soundEngine.playErrorBuzz();
    state.quiz.combo = 0;
    const round = state.quiz.rounds[state.quiz.currentIndex];
    const optionBtns = document.querySelectorAll('.btn-option-choice');
    if (optionBtns[round.correctAnswer]) {
      optionBtns[round.correctAnswer].classList.add('correct');
    }
    showQuizDetailCard(round);
  }

  function showQuizDetailCard(round) {
    const card = document.getElementById('quizDetailCard');
    card.style.display = 'block';
    document.getElementById('detailCardName').textContent = round.name;
    document.getElementById('detailCardPeriod').textContent = `🕒 朝代时期: ${round.period} | 核心都城: ${round.capital.name}`;
    document.getElementById('detailCardDesc').textContent = round.description;

    const nextBtn = document.getElementById('btnNextQuizRound');
    if (nextBtn) {
      const isLastRound = state.quiz.currentIndex >= state.quiz.rounds.length - 1;
      nextBtn.textContent = isLastRound ? '查看真经通关结算战报 👑' : '下一关 ➔';
    }
  }

  document.getElementById('btnNextQuizRound')?.addEventListener('click', () => {
    state.quiz.currentIndex++;
    renderQuizRound();
  });

  function showQuizFinalSummary() {
    openCanvasSharePoster({
      modeTitle: '模式一 · 看图猜朝代真经战报',
      rankTitle: state.quiz.score >= 520 ? '👑 舆图大宗师 · GIS 天眼历史观' : '📜 鉴图学徒达人',
      metricLabel: '五关疆域图鉴辨识积分',
      metricVal: `${state.quiz.score} 分`,
      comment: `在大一统西域都护府与五代十国割据界线微观辨识中创下 X${state.quiz.combo} 连胜！`
    });
  }

  // =============================================================
  // MODE 3: 天下大势 (TERRITORIAL CONQUEST WITH GUARANTEED TARGET CHIPS)
  // =============================================================
  document.getElementById('btnLaunchConquest')?.addEventListener('click', () => {
    openScenarioPickerModal();
  });

  function openScenarioPickerModal() {
    const modal = document.getElementById('scenarioSelectModal');
    modal.classList.add('open');
    renderFactionChoices('five_dynasties_907');
  }

  document.getElementById('btnScenario5Dyn')?.addEventListener('click', () => {
    document.getElementById('btnScenario5Dyn').classList.add('active');
    document.getElementById('btnScenario3Kin').classList.remove('active');
    renderFactionChoices('five_dynasties_907');
  });

  document.getElementById('btnScenario3Kin')?.addEventListener('click', () => {
    document.getElementById('btnScenario3Kin').classList.add('active');
    document.getElementById('btnScenario5Dyn').classList.remove('active');
    renderFactionChoices('three_kingdoms_220');
  });

  let selectedScenarioObj = null;
  let selectedFactionObj = null;

  function renderFactionChoices(scenarioId) {
    selectedScenarioObj = state.conquestScenarios.find(s => s.id === scenarioId);
    const container = document.getElementById('factionsPickContainer');
    container.innerHTML = '';

    selectedScenarioObj.factions.forEach((fac, idx) => {
      const card = document.createElement('div');
      card.style.cssText = `
        background: var(--bg-card);
        border: 1.5px solid ${idx === 0 ? fac.color : 'rgba(255,255,255,0.1)'};
        border-radius: 12px;
        padding: 12px;
        cursor: pointer;
      `;
      if (idx === 0) selectedFactionObj = fac;

      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px">
          <span style="width:14px; height:14px; border-radius:50%; background:${fac.color}; display:inline-block"></span>
          <strong style="color:#fff">${fac.name}</strong>
          <span style="font-size:10px; padding:2px 6px; border-radius:4px; background:rgba(241,196,15,0.2); color:#ffd700">${fac.diff}</span>
        </div>
        <p style="font-size:11.5px; color:var(--text-secondary); margin-top:6px">${fac.desc}</p>
      `;

      card.addEventListener('click', () => {
        container.querySelectorAll('div').forEach(c => c.style.borderColor = 'rgba(255,255,255,0.1)');
        card.style.borderColor = fac.color;
        selectedFactionObj = fac;
      });

      container.appendChild(card);
    });
  }

  document.getElementById('btnConfirmStartScenario')?.addEventListener('click', () => {
    document.getElementById('scenarioSelectModal').classList.remove('open');
    startConquestGame(selectedScenarioObj, selectedFactionObj);
  });

  function startConquestGame(scenario, playerFaction) {
    state.conquest.activeScenario = scenario;
    state.conquest.playerFaction = playerFaction;
    state.conquest.ownership = { ...scenario.initialOwnership };
    state.conquest.gold = 500;
    state.conquest.troops = 32;
    state.conquest.morale = 95;
    state.conquest.turnYear = 1;
    state.conquest.selectedRegionId = null;

    switchView('viewConquest');
    updateConquestHUD();
    renderConquestTopologyMap();
  }

  function updateConquestHUD() {
    const fac = state.conquest.playerFaction;
    document.getElementById('playerFlagDot').style.background = fac.color;
    document.getElementById('playerFactionName').textContent = fac.name;
    document.getElementById('scenarioTitleBadge').textContent = state.conquest.activeScenario.name;

    document.getElementById('resGold').textContent = state.conquest.gold;
    document.getElementById('resTroops').textContent = `${state.conquest.troops}万`;
    document.getElementById('resMorale').textContent = state.conquest.morale;
    document.getElementById('conquestTurnText').textContent = `第 ${state.conquest.turnYear} 年`;

    const myOwned = Object.values(state.conquest.ownership).filter(owner => owner === fac.id).length;
    state.conquest.unlockedRegionsCount = myOwned;
    document.getElementById('conquestUnifyCount').textContent = `${myOwned} / 24 大区`;
    document.getElementById('conquestPrestige').textContent = myOwned * 220 + state.conquest.gold;

    renderInvadableTargetChips();

    if (myOwned >= 24) {
      triggerGrandUnificationEnding();
    }
  }

  // Create fast selectable buttons for adjacent frontiers in command panel
  function renderInvadableTargetChips() {
    const playerFacId = state.conquest.playerFaction.id;
    const invadableZones = [];

    Object.values(state.conquestRegions).forEach(reg => {
      const ownerId = state.conquest.ownership[reg.id];
      if (ownerId === playerFacId) return;

      const neighbors = reg.neighbors || [];
      const isAdjacent = neighbors.some(nId => state.conquest.ownership[nId] === playerFacId);
      if (isAdjacent) {
        invadableZones.push(reg);
      }
    });

    const targetContainer = document.getElementById('selectedRegionTargetText');
    if (!targetContainer) return;

    let html = `<div style="font-size:12px; color:var(--gold-emperor); margin-bottom:8px">⚔️ 己方直连相邻敌对/中立板块 (快捷点击出兵):</div>`;
    html += `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px">`;

    invadableZones.forEach(z => {
      const ownerId = state.conquest.ownership[z.id];
      const ownerFac = state.conquest.activeScenario.factions.find(f => f.id === ownerId);
      const facName = ownerFac ? ownerFac.name : '中立';
      const isSelected = state.conquest.selectedRegionId === z.id;

      html += `<button class="target-zone-chip ${isSelected ? 'selected' : ''}" data-zone-id="${z.id}" style="
        background: ${isSelected ? 'rgba(0,242,254,0.25)' : 'rgba(255,255,255,0.06)'};
        border: 1px solid ${isSelected ? '#00f2fe' : 'rgba(255,215,0,0.35)'};
        color: ${isSelected ? '#00f2fe' : '#ffffff'};
        padding: 5px 10px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      ">⚔️ ${z.name} (${facName})</button>`;
    });

    html += `</div>`;

    if (state.conquest.selectedRegionId) {
      const cur = state.conquestRegions[state.conquest.selectedRegionId];
      if (cur) {
        const ownerFac = state.conquest.activeScenario.factions.find(f => f.id === state.conquest.ownership[cur.id]);
        html += `<div style="font-size:13px; color:#00f2fe; background:rgba(0,242,254,0.1); padding:8px; border-radius:6px">
          当前选中要冲: <strong>${cur.name}</strong> (${cur.ancientName})<br>
          势力: ${ownerFac ? ownerFac.name : '中立'} | 守关: ${cur.pass} | 防御 ${cur.defense}
        </div>`;
      }
    } else {
      html += `<div style="font-size:12px; color:var(--text-secondary)">点击上方任意大区标签或在左侧地图点击进行选择...</div>`;
    }

    targetContainer.innerHTML = html;

    // Attach target chip events
    targetContainer.querySelectorAll('.target-zone-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const zId = e.target.getAttribute('data-zone-id');
        const reg = state.conquestRegions[zId];
        if (reg) handleConquestRegionClick(reg);
      });
    });
  }

  function renderConquestTopologyMap() {
    const svgEl = document.getElementById('conquestMapSvg');
    const tooltipEl = document.getElementById('conquestTooltip');
    const playerFacId = state.conquest.playerFaction.id;

    const customConquestFill = (provName) => {
      for (const [zoneId, provList] of Object.entries(window.MAP_HELPER.STRATEGIC_ZONE_PROVINCES)) {
        const isMatch = provList.some(kw => provName.includes(kw));
        if (isMatch) {
          const ownerFactionId = state.conquest.ownership[zoneId];
          const ownerFac = state.conquest.activeScenario.factions.find(f => f.id === ownerFactionId);
          const isPlayerOwned = ownerFactionId === playerFacId;
          const isSelectedTarget = state.conquest.selectedRegionId === zoneId;

          const baseColor = ownerFac ? ownerFac.color : '#2c3e50';
          return {
            fill: baseColor,
            opacity: isSelectedTarget ? '0.92' : (isPlayerOwned ? '0.80' : '0.52'),
            stroke: isSelectedTarget ? '#00f2fe' : (isPlayerOwned ? '#ffd700' : 'rgba(255,255,255,0.22)'),
            strokeWidth: isSelectedTarget ? '3.2' : (isPlayerOwned ? '2.0' : '1.1')
          };
        }
      }
      return { fill: '#0a0e16', opacity: '0.45', stroke: 'rgba(255,255,255,0.06)' };
    };

    drawD3GISBaseMap(svgEl, {
      yellowRiver: true,
      yangtze: true,
      greatWall: true,
      modernProvinces: true,
      customProvincesFill: customConquestFill,
      btnReset: document.getElementById('btnConquestZoomReset'),
      btnZoomIn: document.getElementById('btnConquestZoomIn'),
      btnZoomOut: document.getElementById('btnConquestZoomOut'),
      onProvinceHover: (provName, feat, evt) => {
        if (!provName) {
          hideFloatingTooltip(tooltipEl);
          return;
        }
        let matchedZone = null;
        for (const [zoneId, provList] of Object.entries(window.MAP_HELPER.STRATEGIC_ZONE_PROVINCES)) {
          if (provList.some(kw => provName.includes(kw))) {
            matchedZone = state.conquestRegions[zoneId];
            break;
          }
        }
        if (matchedZone) {
          const ownerId = state.conquest.ownership[matchedZone.id];
          const ownerFac = state.conquest.activeScenario.factions.find(f => f.id === ownerId);
          showFloatingTooltip(
            tooltipEl,
            `${matchedZone.name} (${provName})`,
            `隶属割据割据: ${ownerFac ? ownerFac.name : '中立自守'}`,
            `关隘守防: ${matchedZone.pass} | 守值 ${matchedZone.defense} | 粮赋 ${matchedZone.wealth}`,
            evt
          );
        } else {
          showFloatingTooltip(tooltipEl, provName, `边陲防御`, `各部游牧及沿海边卫。`, evt);
        }
      },
      onProvinceClick: (provName) => {
        for (const [zoneId, provList] of Object.entries(window.MAP_HELPER.STRATEGIC_ZONE_PROVINCES)) {
          if (provList.some(kw => provName.includes(kw))) {
            const reg = state.conquestRegions[zoneId];
            if (reg) handleConquestRegionClick(reg);
            break;
          }
        }
      }
    });

    // Draw Big Macro-Region Stronghold Shields on Map
    const rootG = svgEl.querySelector('.gis-map-root');
    if (rootG) {
      Object.values(state.conquestRegions).forEach(reg => {
        const ownerId = state.conquest.ownership[reg.id];
        const isPlayerOwned = ownerId === playerFacId;
        const isSelected = state.conquest.selectedRegionId === reg.id;
        const pos = window.MAP_HELPER.lonLatToSvg(reg.coords[0], reg.coords[1]);

        const gZone = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gZone.setAttribute('class', 'macro-zone-badge');
        gZone.style.cursor = 'pointer';

        // Shield circle background
        const cBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        cBg.setAttribute('cx', pos.x); cBg.setAttribute('cy', pos.y - 4);
        cBg.setAttribute('r', isSelected ? '18' : '15');
        cBg.setAttribute('fill', isSelected ? '#00f2fe' : (isPlayerOwned ? '#c0392b' : '#1e272c'));
        cBg.setAttribute('stroke', isSelected ? '#ffffff' : (isPlayerOwned ? '#ffd700' : 'rgba(255,255,255,0.4)'));
        cBg.setAttribute('stroke-width', '1.8');
        gZone.appendChild(cBg);

        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', pos.x); txt.setAttribute('y', pos.y);
        txt.setAttribute('fill', '#ffffff');
        txt.setAttribute('font-size', '11');
        txt.setAttribute('font-weight', 'bold');
        txt.setAttribute('text-anchor', 'middle');
        txt.textContent = reg.name;
        gZone.appendChild(txt);

        const defTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        defTxt.setAttribute('x', pos.x); defTxt.setAttribute('y', pos.y + 14);
        defTxt.setAttribute('fill', isSelected ? '#00f2fe' : '#ffd700');
        defTxt.setAttribute('font-size', '9');
        defTxt.setAttribute('text-anchor', 'middle');
        defTxt.textContent = `🛡️${reg.defense}`;
        gZone.appendChild(defTxt);

        gZone.addEventListener('pointerdown', (evt) => {
          evt.stopPropagation();
          handleConquestRegionClick(reg);
        });

        rootG.appendChild(gZone);
      });
    }
  }

  function handleConquestRegionClick(region) {
    const playerFacId = state.conquest.playerFaction.id;
    const currentOwner = state.conquest.ownership[region.id];

    if (currentOwner === playerFacId) {
      state.conquest.selectedRegionId = null;
      window.soundEngine.playStoneClick();
      updateConquestHUD();
      renderConquestTopologyMap();
      const btnWar = document.getElementById('btnWarAttack');
      const btnBribe = document.getElementById('btnDiplomacyBribe');
      if (btnWar) btnWar.disabled = true;
      if (btnBribe) btnBribe.disabled = true;
      return;
    }

    const neighbors = region.neighbors || [];
    const isAdjacent = neighbors.some(nId => state.conquest.ownership[nId] === playerFacId);

    if (!isAdjacent) {
      window.soundEngine.playErrorBuzz();
      alert(`无法越境发兵！【${region.name}】未与您现有领地相邻。必须先攻占直连板块。`);
      return;
    }

    state.conquest.selectedRegionId = region.id;
    window.soundEngine.playStoneClick();
    updateConquestHUD();
    renderConquestTopologyMap();

    const btnWar = document.getElementById('btnWarAttack');
    const btnBribe = document.getElementById('btnDiplomacyBribe');
    if (btnWar) btnWar.disabled = false;
    if (btnBribe) btnBribe.disabled = state.conquest.gold < 200;
  }

  // 武力征讨攻城问答推演 (替换原生 prompt)
  document.getElementById('btnWarAttack')?.addEventListener('click', () => {
    const regId = state.conquest.selectedRegionId;
    if (!regId) return;
    const targetRegion = state.conquestRegions[regId];

    window.soundEngine.playWarDrum();

    const questions = [
      { q: `欲取关中要害【${targetRegion.name}】(${targetRegion.ancientName})，必先攻破守卫中原与关中交界的哪一座第一雄关要隘？`, opts: ['潼关 / 虎牢关', '山海关', '嘉峪关', '剑门关'], ans: 0 },
      { q: `大军远征攻打【${targetRegion.name}】期间，粮草走廊经由黄河与南北大运河哪一条古水系联运效率最佳？`, opts: ['隋唐大运河与黄河干流', '多瑙河', '珠江水系', '黑龙江'], ans: 0 },
      { q: `战略要地【${targetRegion.name}】周围要隘守将号称 ${targetRegion.pass}，防御能力达到 ${targetRegion.defense} 点，宜采用何种步骑战法攻城？`, opts: ['包围绝粮待要塞内乱', '硬骑冲撞悬崖', '孤军夜渡绝壁不带粮', '放弃主力退回交趾'], ans: 0 }
    ];
    const qObj = questions[Math.floor(Math.random() * questions.length)];

    const modal = document.getElementById('battleCouncilModal');
    const badge = document.getElementById('battleTargetRegionBadge');
    const promptEl = document.getElementById('battleQuestionPrompt');
    const container = document.getElementById('battleOptionsContainer');

    if (!modal || !container) return;
    badge.textContent = `目标要冲: 【${targetRegion.name}】(守值 ${targetRegion.defense})`;
    promptEl.textContent = qObj.q;
    container.innerHTML = '';

    qObj.opts.forEach((optText, idx) => {
      const b = document.createElement('button');
      b.className = 'btn-option-choice';
      b.innerHTML = `<span><strong>${String.fromCharCode(65 + idx)}.</strong> ${optText}</span> <span>⚔️ 发兵攻打</span>`;
      b.addEventListener('click', () => {
        modal.classList.remove('open');
        const isRight = idx === qObj.ans;
        if (isRight) {
          window.soundEngine.playSwordClash();
          state.conquest.ownership[regId] = state.conquest.playerFaction.id;
          state.conquest.gold += targetRegion.wealth * 2;
          state.conquest.troops += 3;
          state.conquest.selectedRegionId = null;
          alert(`🎉 捷报！武力破城，大败敌军，攻占【${targetRegion.name}】！获得库金 +${targetRegion.wealth * 2}`);
        } else {
          window.soundEngine.playErrorBuzz();
          state.conquest.troops = Math.max(5, state.conquest.troops - 4);
          state.conquest.morale = Math.max(30, state.conquest.morale - 10);
          alert(`💥 攻城失利！敌阵死守 ${targetRegion.pass}，兵马损失 4 万，军心动摇。`);
        }
        updateConquestHUD();
        renderConquestTopologyMap();
      });
      container.appendChild(b);
    });

    modal.classList.add('open');
  });

  document.getElementById('btnCancelBattle')?.addEventListener('click', () => {
    document.getElementById('battleCouncilModal')?.classList.remove('open');
  });

  // 外交合纵劝降
  document.getElementById('btnDiplomacyBribe')?.addEventListener('click', () => {
    const regId = state.conquest.selectedRegionId;
    if (!regId) return;
    const targetRegion = state.conquestRegions[regId];

    if (state.conquest.gold < 200) return;
    state.conquest.gold -= 200;

    window.soundEngine.playGongWin();
    state.conquest.ownership[regId] = state.conquest.playerFaction.id;
    state.conquest.selectedRegionId = null;

    alert(`🤝 外交金钱纳贡成效！【${targetRegion.name}】节度使举城降纳，染色归附！`);
    updateConquestHUD();
    renderConquestTopologyMap();
  });

  // 抽年度随机事件卡
  document.getElementById('btnDrawNextEvent')?.addEventListener('click', () => {
    window.soundEngine.playStoneClick();
    state.conquest.turnYear++;

    const events = [
      { title: '【中原大旱，买粮救灾】', desc: '库金金币 -50，但天下百姓归心，军心上涨 +10 点。', goldDelta: -50, moraleDelta: 10 },
      { title: '【太行雪灾，敌营减员】', desc: '北方要隘大雪封山，沿边异势防御值暂时削弱！', goldDelta: 30, moraleDelta: 5 },
      { title: '【江淮盐铁贡银丰盈】', desc: '朝廷盐铁专卖大获全胜，国库拨入纯金 +180 两！', goldDelta: 180, moraleDelta: 0 },
      { title: '【古运河疏浚，通航畅达】', desc: '南北物流大涨，兵马补给 +5 万精锐归营。', goldDelta: 60, moraleDelta: 8 }
    ];

    const ev = events[Math.floor(Math.random() * events.length)];
    state.conquest.gold = Math.max(0, state.conquest.gold + ev.goldDelta);
    state.conquest.morale = Math.min(100, state.conquest.morale + ev.moraleDelta);

    document.getElementById('eventCardTitle').textContent = ev.title;
    document.getElementById('eventCardDesc').textContent = ev.desc;

    updateConquestHUD();
  });

  function triggerGrandUnificationEnding() {
    window.soundEngine.playGongWin();
    openCanvasSharePoster({
      modeTitle: `模式三 · ${state.conquest.activeScenario.name} 独霸九洲`,
      rankTitle: `👑 改元建号 · 开国神武大皇帝`,
      metricLabel: '24 大战略要区统一度',
      metricVal: '100% 混一宇内',
      comment: `历经 ${state.conquest.turnYear} 年血战角逐，成功统一关中、中原、巴蜀、江东全部二十四大区！`
    });
  }

  // =============================================================
  // CANVAS SHARE POSTER CERTIFICATE GENERATOR
  // =============================================================
  function openCanvasSharePoster(data) {
    const modal = document.getElementById('sharePosterModal');
    modal?.classList.add('open');

    const canvas = document.getElementById('posterCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0f141c');
    grad.addColorStop(0.5, '#161b22');
    grad.addColorStop(1, '#0a0d12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, W - 40, H - 40);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(28, 28, W - 56, H - 56);

    const drawCornerSeal = (x, y) => {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(x - 12, y - 12, 24, 24);
      ctx.strokeStyle = '#ffd700';
      ctx.strokeRect(x - 10, y - 10, 20, 20);
    };
    drawCornerSeal(38, 38);
    drawCornerSeal(W - 38, 38);
    drawCornerSeal(38, H - 38);
    drawCornerSeal(W - 38, H - 38);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 22px serif';
    ctx.fillText('御 赐 中国历史地理挑战战报', W / 2, 85);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px serif';
    ctx.fillText('《指点江山》', W / 2, 140);

    ctx.strokeStyle = 'rgba(241,196,15,0.4)';
    ctx.beginPath();
    ctx.moveTo(80, 165); ctx.lineTo(W - 80, 165);
    ctx.stroke();

    ctx.fillStyle = '#8b949e';
    ctx.font = '16px sans-serif';
    ctx.fillText(data.modeTitle, W / 2, 210);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 32px serif';
    ctx.fillText(`“ ${data.rankTitle} ”`, W / 2, 270);

    ctx.fillStyle = 'rgba(241,196,15,0.12)';
    ctx.beginPath();
    ctx.arc(W / 2, 390, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#8b949e';
    ctx.font = '15px sans-serif';
    ctx.fillText(data.metricLabel, W / 2, 350);

    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(data.metricVal, W / 2, 405);

    ctx.fillStyle = '#d1d8e0';
    ctx.font = '16px serif';
    const lines = wrapCanvasText(ctx, data.comment, W - 160);
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, 530 + i * 28);
    });

    ctx.fillStyle = '#c0392b';
    ctx.fillRect(W / 2 - 45, 660, 90, 90);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(W / 2 - 40, 665, 80, 80);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px serif';
    ctx.fillText('指点', W / 2, 700);
    ctx.fillText('江山', W / 2, 730);

    ctx.fillStyle = '#8b949e';
    ctx.font = '13px sans-serif';
    ctx.fillText('GitHub: DeanChensj/jiangshan-map', W / 2, 790);
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    const words = text.split('');
    const lines = [];
    let currentLine = '';
    words.forEach(char => {
      const testLine = currentLine + char;
      const width = ctx.measureText(testLine).width;
      if (width > maxWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    });
    lines.push(currentLine);
    return lines;
  }

  document.getElementById('btnClosePoster')?.addEventListener('click', () => {
    document.getElementById('sharePosterModal')?.classList.remove('open');
  });

  document.getElementById('btnDownloadPoster')?.addEventListener('click', () => {
    const canvas = document.getElementById('posterCanvas');
    const link = document.createElement('a');
    link.download = 'jiangshan_historical_map_certificate.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
});
