/**
 * Master Controller for 《指点江山：中国历史地理挑战赛》
 * Integrates GeoQuiz, Heroes' GeoGuessr, and Conquest Strategy
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Global State
  const state = {
    currentView: 'viewLobby',
    dynasties: [],
    heroes: [],
    conquestScenarios: [],
    conquestRegions: {},

    // Mode 1 Quiz State
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

    // Mode 2 GeoGuessr State
    guessr: {
      heroIndex: 0,
      currentStep: 0, // 0: A, 1: B, 2: C
      placedCoords: [], // [{lon, lat}]
      stepErrorsKm: [],
      currentSelectedSvgPos: null,
      finished: false
    },

    // Mode 3 Conquest State
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

  // -------------------------------------------------------------
  // DATA LOADER WITH INSTANT FALLBACK
  // -------------------------------------------------------------
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
      console.warn('Fallback internal data loaded due to local fetch protocol:', e);
      state.dynasties = window.FALLBACK_DYNASTIES || [];
      state.heroes = window.FALLBACK_HEROES || [];
    }
  }

  await loadGameData();

  // -------------------------------------------------------------
  // AUDIO TOGGLE & VIEW NAVIGATION
  // -------------------------------------------------------------
  const btnToggleSound = document.getElementById('btnToggleSound');
  const soundLabel = document.getElementById('soundLabel');
  btnToggleSound.addEventListener('click', () => {
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

  document.getElementById('brandLobbyBtn').addEventListener('click', () => switchView('viewLobby'));
  document.getElementById('quizBackBtn').addEventListener('click', () => {
    clearInterval(state.quiz.timer);
    switchView('viewLobby');
  });
  document.getElementById('guessrBackBtn').addEventListener('click', () => switchView('viewLobby'));
  document.getElementById('conquestBackBtn').addEventListener('click', () => switchView('viewLobby'));

  // -------------------------------------------------------------
  // COMMON SVG GEOMETRY DRAWING FUNCTIONS
  // -------------------------------------------------------------
  function drawBaseChinaFeatures(svgEl, options = {}) {
    const { yellowRiver = true, yangtze = true, greatWall = false, silkRoad = false, modernProvinces = false } = options;
    const { lonLatToSvg, HISTORICAL_GEOMETRIES } = window.MAP_HELPER;

    // 清空现有元素
    svgEl.innerHTML = '';

    // 外框底纹与微弱地图轮廓
    const borderRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    borderRect.setAttribute('width', '840');
    borderRect.setAttribute('height', '560');
    borderRect.setAttribute('fill', '#090d12');
    borderRect.setAttribute('stroke', 'rgba(241,196,15,0.2)');
    borderRect.setAttribute('stroke-width', '2');
    svgEl.appendChild(borderRect);

    // 叠加上古经纬度星罗分布极淡虚线网
    for (let lat = 25; lat <= 50; lat += 8) {
      const p1 = lonLatToSvg(75, lat);
      const p2 = lonLatToSvg(132, lat);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
      line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
      line.setAttribute('stroke', 'rgba(255,255,255,0.04)');
      line.setAttribute('stroke-dasharray', '4,4');
      svgEl.appendChild(line);
    }

    // 绘制大运河/黄河
    if (yellowRiver) {
      const pts = HISTORICAL_GEOMETRIES.yellowRiver.map(c => lonLatToSvg(c[0], c[1]));
      const pathStr = 'M ' + pts.map(p => `${p.x},${p.y}`).join(' L ');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', pathStr);
      p.setAttribute('class', 'river-path');
      p.setAttribute('stroke', '#e67e22');
      p.setAttribute('stroke-width', '2.5');
      p.appendChild(createSvgTitle('几字形母亲河·黄河'));
      svgEl.appendChild(p);
    }

    // 绘制长江
    if (yangtze) {
      const pts = HISTORICAL_GEOMETRIES.yangtzeRiver.map(c => lonLatToSvg(c[0], c[1]));
      const pathStr = 'M ' + pts.map(p => `${p.x},${p.y}`).join(' L ');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', pathStr);
      p.setAttribute('class', 'river-path');
      p.setAttribute('stroke', '#3498db');
      p.setAttribute('stroke-width', '2.8');
      p.appendChild(createSvgTitle('天堑万古·长江'));
      svgEl.appendChild(p);
    }

    // 绘制长城
    if (greatWall) {
      const pts = HISTORICAL_GEOMETRIES.greatWall.map(c => lonLatToSvg(c[0], c[1]));
      const pathStr = 'M ' + pts.map(p => `${p.x},${p.y}`).join(' L ');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', pathStr);
      p.setAttribute('class', 'great-wall-path');
      p.appendChild(createSvgTitle('抵御匈奴游牧·万里长城'));
      svgEl.appendChild(p);
    }

    // 绘制丝绸之路
    if (silkRoad) {
      const pts = HISTORICAL_GEOMETRIES.silkRoad.map(c => lonLatToSvg(c[0], c[1]));
      const pathStr = 'M ' + pts.map(p => `${p.x},${p.y}`).join(' L ');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', pathStr);
      p.setAttribute('class', 'silk-road-path');
      p.appendChild(createSvgTitle('张骞凿空·陆上丝绸之路'));
      svgEl.appendChild(p);
    }

    // 现代省界薄膜对照勾勒
    if (modernProvinces) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'modern-grid-layer');
      // 简写主要现代省区代表图形
      const provPoints = [
        [[115, 38], [118, 38], [117, 36], [114, 36]], // 河北
        [[111, 37], [113, 37], [113, 35], [110, 35]], // 山西
        [[108, 34], [110, 34], [109, 32], [107, 32]], // 陕西
        [[103, 30], [106, 30], [105, 28], [102, 28]], // 四川
        [[113, 23], [116, 23], [115, 21], [112, 21]]  // 广东
      ];
      provPoints.forEach(poly => {
        const pts = poly.map(c => lonLatToSvg(c[0], c[1]));
        const polyEl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polyEl.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '));
        g.appendChild(polyEl);
      });
      svgEl.appendChild(g);
    }
  }

  function createSvgTitle(text) {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    t.textContent = text;
    return t;
  }

  // =============================================================
  // MODE 1: 看图猜朝代 (GEO-QUIZ)
  // =============================================================
  const quizDiffBtns = document.querySelectorAll('[data-quiz-diff]');
  quizDiffBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      quizDiffBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.quiz.difficulty = e.target.getAttribute('data-quiz-diff');
    });
  });

  document.getElementById('btnLaunchQuiz').addEventListener('click', () => {
    startQuizMode();
  });

  function startQuizMode() {
    state.quiz.score = 0;
    state.quiz.combo = 0;
    state.quiz.currentIndex = 0;

    // 按难度筛选
    const filtered = state.dynasties.filter(d => 
      state.quiz.difficulty === 'hell' ? d.difficulty === 'hell' : d.difficulty === 'standard'
    );
    // 随机洗牌取 5 关
    state.quiz.rounds = filtered.sort(() => Math.random() - 0.5).slice(0, 5);

    document.getElementById('quizModeBadgeLabel').textContent = 
      state.quiz.difficulty === 'hell' ? '看图猜朝代 · 【爆款】五代十国/乱世割据考题' : '看图猜朝代 · 大一统盛世难度';

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

    // 绘制基础水系与长城
    const svgEl = document.getElementById('quizMapSvg');
    const modernOverlay = document.getElementById('chkModernOverlay').checked;

    const dynastyConfig = window.MAP_HELPER.DYNASTY_MAP_POLYGONS[round.svgPathKey];
    drawBaseChinaFeatures(svgEl, {
      yellowRiver: dynastyConfig ? dynastyConfig.showYellowRiver : true,
      yangtze: true,
      greatWall: dynastyConfig ? dynastyConfig.showGreatWall : false,
      silkRoad: dynastyConfig ? dynastyConfig.showSilkRoad : false,
      modernProvinces: modernOverlay
    });

    // 绘制无标注朝代特征矢量疆域
    if (dynastyConfig) {
      if (dynastyConfig.isSplitMode) {
        // 多政权并立模式 (五代十国/三国/十六国)
        dynastyConfig.subRegs.forEach(sub => {
          const pts = sub.points.map(c => window.MAP_HELPER.lonLatToSvg(c[0], c[1]));
          const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          polygon.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '));
          polygon.setAttribute('fill', sub.color);
          polygon.setAttribute('fill-opacity', '0.52');
          polygon.setAttribute('stroke', '#ffd700');
          polygon.setAttribute('stroke-width', '2');
          polygon.appendChild(createSvgTitle(`隐去名线索部分`));
          svgEl.appendChild(polygon);
        });
      } else {
        // 大一统包络模式
        dynastyConfig.polygons.forEach(polyCoords => {
          const pts = polyCoords.map(c => window.MAP_HELPER.lonLatToSvg(c[0], c[1]));
          const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          polygon.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '));
          polygon.setAttribute('fill', round.color || '#e74c3c');
          polygon.setAttribute('fill-opacity', '0.45');
          polygon.setAttribute('stroke', round.borderColor || '#f1c40f');
          polygon.setAttribute('stroke-width', '2.5');
          polygon.setAttribute('filter', 'drop-shadow(0 0 12px rgba(241,196,15,0.4))');
          svgEl.appendChild(polygon);
        });
      }

      // 绘制都城脉冲原点
      if (dynastyConfig.capitalDot) {
        const capSvg = window.MAP_HELPER.lonLatToSvg(dynastyConfig.capitalDot[0], dynastyConfig.capitalDot[1]);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', capSvg.x); circle.setAttribute('cy', capSvg.y);
        circle.setAttribute('r', '7');
        circle.setAttribute('fill', '#ffd700');
        circle.setAttribute('stroke', '#e74c3c');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('class', 'capital-pulse');
        circle.appendChild(createSvgTitle('核心都城坐标原点'));
        svgEl.appendChild(circle);
      }
    }

    // 准备下方绝妙特征线索 Chips
    const clueChipsContainer = document.getElementById('quizClueChips');
    clueChipsContainer.innerHTML = '';
    (round.features || []).forEach(feat => {
      const chip = document.createElement('span');
      chip.className = 'clue-chip';
      chip.textContent = `🔍 线索: ${feat}`;
      clueChipsContainer.appendChild(chip);
    });

    // 渲染选项列表
    const optionsContainer = document.getElementById('quizOptionsContainer');
    optionsContainer.innerHTML = '';
    round.options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.className = 'btn-option-choice';
      btn.innerHTML = `<span><strong>${String.fromCharCode(65 + idx)}.</strong> ${optText}</span> <span>➔</span>`;
      btn.addEventListener('click', () => handleQuizOptionSelect(idx, btn));
      optionsContainer.appendChild(btn);
    });

    // 启动15s倒计时
    startQuizTimer();
  }

  // 现代大一统对照 Checkbox 实时重绘
  document.getElementById('chkModernOverlay').addEventListener('change', () => {
    if (state.currentView === 'viewQuiz') {
      const round = state.quiz.rounds[state.quiz.currentIndex];
      if (round) renderQuizRound();
    }
  });

  // 悬浮放大镜交互 (Magnifying Lens hover)
  const quizMapContainer = document.getElementById('quizMapContainer');
  const quizZoomLens = document.getElementById('quizZoomLens');
  const zoomLensSvg = document.getElementById('zoomLensSvg');

  quizMapContainer.addEventListener('mousemove', (e) => {
    const rect = quizMapContainer.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) {
      quizZoomLens.style.display = 'none';
      return;
    }

    quizZoomLens.style.display = 'block';
    quizZoomLens.style.left = `${relX - 70}px`;
    quizZoomLens.style.top = `${relY - 70}px`;

    // 将主 SVG 的 viewBox 动态同步给放大镜（2.3x 局部聚焦）
    const svgRatioX = 840 / rect.width;
    const svgRatioY = 560 / rect.height;
    const mapCenterSvgX = relX * svgRatioX;
    const mapCenterSvgY = relY * svgRatioY;

    const zoomW = 280;
    const zoomH = 186;
    zoomLensSvg.setAttribute('viewBox', `${mapCenterSvgX - zoomW / 2} ${mapCenterSvgY - zoomH / 2} ${zoomW} ${zoomH}`);
    zoomLensSvg.innerHTML = document.getElementById('quizMapSvg').innerHTML;
  });

  quizMapContainer.addEventListener('mouseleave', () => {
    quizZoomLens.style.display = 'none';
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
      // 高亮正确答案
      if (optionBtns[round.correctAnswer]) {
        optionBtns[round.correctAnswer].classList.add('correct');
      }
    }

    // 显示历史词条 Card
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
    document.getElementById('detailCardPeriod').textContent = `🕒 朝代时期: ${round.period} | 都城: ${round.capital.name}`;
    document.getElementById('detailCardDesc').textContent = round.description;
  }

  document.getElementById('btnNextQuizRound').addEventListener('click', () => {
    state.quiz.currentIndex++;
    renderQuizRound();
  });

  function showQuizFinalSummary() {
    openCanvasSharePoster({
      modeTitle: '模式一 · 看图猜朝代战报',
      rankTitle: state.quiz.score >= 550 ? '👑 十七史通手·地狱帝王天眼' : '📜 历史考据达人',
      metricLabel: '鉴图快问快答得分',
      metricVal: `${state.quiz.score} 分`,
      comment: `连胜最高达成 X${state.quiz.combo}！识别幽云十六州与南北南北朝极微精细疆域。`
    });
  }

  // =============================================================
  // MODE 2: 名将征途 (CHINA GEOGUESSR)
  // =============================================================
  document.getElementById('btnLaunchGuessr').addEventListener('click', () => {
    initGuessrMode();
  });

  function initGuessrMode() {
    switchView('viewGuessr');
    renderHeroCarousel();
    selectGuessrHero(0);
  }

  function renderHeroCarousel() {
    const strip = document.getElementById('heroCarouselStrip');
    strip.innerHTML = '';
    state.heroes.forEach((h, idx) => {
      const card = document.createElement('div');
      card.className = `hero-selector-card ${idx === state.guessr.heroIndex ? 'active' : ''}`;
      card.innerHTML = `
        <div class="hero-avatar-circle">${h.avatar}</div>
        <div>
          <div class="hero-name-mini">${h.name}</div>
          <div class="hero-title-mini">${h.title}</div>
        </div>
      `;
      card.addEventListener('click', () => selectGuessrHero(idx));
      strip.appendChild(card);
    });
  }

  function selectGuessrHero(heroIdx) {
    state.guessr.heroIndex = heroIdx;
    state.guessr.currentStep = 0;
    state.guessr.placedCoords = [];
    state.guessr.stepErrorsKm = [];
    state.guessr.finished = false;

    renderHeroCarousel();

    const hero = state.heroes[heroIdx];
    document.getElementById('heroBigAvatar').textContent = hero.avatar;
    document.getElementById('heroBigName').textContent = hero.name;
    document.getElementById('heroBigEra').textContent = `${hero.era} · ${hero.title}`;
    document.getElementById('heroQuote').textContent = hero.quote;
    document.getElementById('heroBioText').textContent = hero.bio;
    document.getElementById('guessrHeroTitle').textContent = hero.name;
    document.getElementById('btnShareGuessrScore').style.display = 'none';

    renderMilestoneSteps();
    drawGuessrBaseMap();
  }

  function renderMilestoneSteps() {
    const hero = state.heroes[state.guessr.heroIndex];
    const container = document.getElementById('milestonesList');
    container.innerHTML = '';

    hero.points.forEach((pt, idx) => {
      const div = document.createElement('div');
      const isDone = idx < state.guessr.currentStep;
      const isActive = idx === state.guessr.currentStep && !state.guessr.finished;

      div.className = `milestone-step-item ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`;
      const errText = state.guessr.stepErrorsKm[idx] !== undefined ? `📍 测量误差: ${state.guessr.stepErrorsKm[idx]} km` : '';

      div.innerHTML = `
        <div class="step-badge-tag">${pt.step}</div>
        <div style="font-size:14px; font-weight:700; color:#fff">${isDone || state.guessr.finished ? pt.label : '???（请在地图精准位置指点）'}</div>
        <div class="step-hint-text">💡 提示: ${pt.hint}</div>
        ${errText ? `<div class="step-error-score">${errText}</div>` : ''}
      `;
      container.appendChild(div);
    });
  }

  function drawGuessrBaseMap() {
    const svgEl = document.getElementById('guessrMapSvg');
    drawBaseChinaFeatures(svgEl, {
      yellowRiver: true,
      yangtze: true,
      greatWall: true,
      silkRoad: true
    });

    // 绑定地图点击选点事件
    const mapContainer = document.getElementById('guessrMapContainer');
    mapContainer.onclick = (e) => {
      if (state.guessr.finished) return;
      const rect = svgEl.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * 840;
      const clickY = ((e.clientY - rect.top) / rect.height) * 560;

      state.guessr.currentSelectedSvgPos = { x: clickX, y: clickY };
      const lonLat = window.MAP_HELPER.svgToLonLat(clickX, clickY);

      // 先移除现有临时选点 Marker
      const tempMarker = svgEl.querySelector('.temp-placed-pin');
      if (tempMarker) tempMarker.remove();

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'temp-placed-pin');

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', clickX); circle.setAttribute('cy', clickY);
      circle.setAttribute('r', '8');
      circle.setAttribute('class', 'pin-placed');
      g.appendChild(circle);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', clickX + 10); label.setAttribute('y', clickY - 8);
      label.setAttribute('fill', '#00f2fe');
      label.setAttribute('font-size', '12');
      label.setAttribute('font-weight', 'bold');
      label.textContent = `待指点坐标: [${lonLat.lon}°E, ${lonLat.lat}°N]`;
      g.appendChild(label);

      svgEl.appendChild(g);

      window.soundEngine.playStoneClick();
      document.getElementById('btnConfirmGuessPoint').textContent = 
        `📍 确认指点节点 [${lonLat.lon}°E, ${lonLat.lat}°N]`;
    };
  }

  // 确认指点坐标
  document.getElementById('btnConfirmGuessPoint').addEventListener('click', () => {
    if (state.guessr.finished) return;
    if (!state.guessr.currentSelectedSvgPos) {
      alert('请先在右侧矢量地图上点击选择一点！');
      return;
    }

    const hero = state.heroes[state.guessr.heroIndex];
    const targetPt = hero.points[state.guessr.currentStep];
    const playerLonLat = window.MAP_HELPER.svgToLonLat(
      state.guessr.currentSelectedSvgPos.x,
      state.guessr.currentSelectedSvgPos.y
    );

    // Haversine 公里数误差计算
    const distanceKm = window.MAP_HELPER.haversineDistance(
      [playerLonLat.lon, playerLonLat.lat],
      targetPt.coords
    );

    state.guessr.placedCoords.push(playerLonLat);
    state.guessr.stepErrorsKm.push(distanceKm);

    state.guessr.currentStep++;
    state.guessr.currentSelectedSvgPos = null;
    document.getElementById('btnConfirmGuessPoint').textContent = '📍 确认指点该点坐标';

    renderMilestoneSteps();

    if (state.guessr.currentStep >= 3) {
      finalizeGuessrEvaluation();
    }
  });

  function finalizeGuessrEvaluation() {
    state.guessr.finished = true;
    const hero = state.heroes[state.guessr.heroIndex];
    const svgEl = document.getElementById('guessrMapSvg');

    // 重新完整绘制并描绘 A -> B -> C 真实轨迹与激光对比
    drawBaseChinaFeatures(svgEl, { yellowRiver: true, yangtze: true, greatWall: true, silkRoad: true });

    const totalKm = state.guessr.stepErrorsKm.reduce((a, b) => a + b, 0);
    document.getElementById('guessrTotalKmText').textContent = `${totalKm} km`;

    // 大圆评级 (PRD Sec 2.2)
    let grade = 'S+';
    if (totalKm > 2000) grade = 'F';
    else if (totalKm > 1000) grade = 'C';
    else if (totalKm > 500) grade = 'B';
    else if (totalKm > 200) grade = 'A';
    else if (totalKm > 80) grade = 'S';

    document.getElementById('guessrCurrentGrade').textContent = grade;
    window.soundEngine.playGongWin();

    // 绘制真实 Milestone Target Pins & 玩家选择 Pins
    const targetSvgPts = hero.points.map(pt => window.MAP_HELPER.lonLatToSvg(pt.coords[0], pt.coords[1]));
    const playerSvgPts = state.guessr.placedCoords.map(c => window.MAP_HELPER.lonLatToSvg(c.lon, c.lat));

    // 绘制 A -> B -> C 激光流光轨迹
    const laserStr = 'M ' + targetSvgPts.map(p => `${p.x},${p.y}`).join(' L ');
    const laserPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    laserPath.setAttribute('d', laserStr);
    laserPath.setAttribute('class', 'laser-trajectory');
    svgEl.appendChild(laserPath);

    // 绘制真实标注点位
    targetSvgPts.forEach((p, idx) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y);
      circle.setAttribute('r', '9');
      circle.setAttribute('class', 'pin-target');
      svgEl.appendChild(circle);

      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', p.x + 12); txt.setAttribute('y', p.y + 4);
      txt.setAttribute('fill', '#ffd700');
      txt.setAttribute('font-weight', 'bold');
      txt.setAttribute('font-size', '13');
      txt.textContent = `史实: ${hero.points[idx].label}`;
      svgEl.appendChild(txt);
    });

    // 绘制玩家放置点位与连线误差线
    playerSvgPts.forEach((pp, idx) => {
      const tp = targetSvgPts[idx];
      const errLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      errLine.setAttribute('x1', pp.x); errLine.setAttribute('y1', pp.y);
      errLine.setAttribute('x2', tp.x); errLine.setAttribute('y2', tp.y);
      errLine.setAttribute('stroke', '#e74c3c');
      errLine.setAttribute('stroke-dasharray', '3,3');
      errLine.setAttribute('stroke-width', '2');
      svgEl.appendChild(errLine);

      const pCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      pCircle.setAttribute('cx', pp.x); pCircle.setAttribute('cy', pp.y);
      pCircle.setAttribute('r', '6');
      pCircle.setAttribute('class', 'pin-placed');
      svgEl.appendChild(pCircle);
    });

    document.getElementById('btnConfirmGuessPoint').textContent = `🏅 评估完成！总误差 ${totalKm} km (${grade})`;
    document.getElementById('btnShareGuessrScore').style.display = 'block';
  }

  document.getElementById('btnShareGuessrScore').addEventListener('click', () => {
    const hero = state.heroes[state.guessr.heroIndex];
    const totalKm = state.guessr.stepErrorsKm.reduce((a, b) => a + b, 0);
    const grade = document.getElementById('guessrCurrentGrade').textContent;

    openCanvasSharePoster({
      modeTitle: `模式二 · 名将征途 (${hero.name}) 战报`,
      rankTitle: `${grade} 级位差精度 · 历史空间天眼`,
      metricLabel: '三节点经纬度坐标误差',
      metricVal: `${totalKm} km`,
      comment: `在史实【${hero.points[0].label}】➔【${hero.points[1].label}】➔【${hero.points[2].label}】高光动线测量中直抵天煞！`
    });
  });

  // =============================================================
  // MODE 3: 天下大势 (TERRITORIAL CONQUEST)
  // =============================================================
  document.getElementById('btnLaunchConquest').addEventListener('click', () => {
    openScenarioPickerModal();
  });

  function openScenarioPickerModal() {
    const modal = document.getElementById('scenarioSelectModal');
    modal.classList.add('open');

    renderFactionChoices('five_dynasties_907');
  }

  document.getElementById('btnScenario5Dyn').addEventListener('click', () => {
    document.getElementById('btnScenario5Dyn').classList.add('active');
    document.getElementById('btnScenario3Kin').classList.remove('active');
    renderFactionChoices('five_dynasties_907');
  });

  document.getElementById('btnScenario3Kin').addEventListener('click', () => {
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

  document.getElementById('btnConfirmStartScenario').addEventListener('click', () => {
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

    // 统计已占领大区
    const myOwned = Object.values(state.conquest.ownership).filter(owner => owner === fac.id).length;
    state.conquest.unlockedRegionsCount = myOwned;
    document.getElementById('conquestUnifyCount').textContent = `${myOwned} / 24 大区`;
    document.getElementById('conquestPrestige').textContent = myOwned * 220 + state.conquest.gold;

    if (myOwned >= 24) {
      triggerGrandUnificationEnding();
    }
  }

  function renderConquestTopologyMap() {
    const svgEl = document.getElementById('conquestMapSvg');
    drawBaseChinaFeatures(svgEl, { yellowRiver: true, yangtze: true, greatWall: true });

    const playerFacId = state.conquest.playerFaction.id;

    // 绘制 24 大战略板块
    Object.values(state.conquestRegions).forEach(reg => {
      const ownerId = state.conquest.ownership[reg.id];
      const ownerFac = state.conquest.activeScenario.factions.find(f => f.id === ownerId);
      const fillColor = ownerFac ? ownerFac.color : '#2c3e50';
      const isPlayerOwned = ownerId === playerFacId;

      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', reg.svgPolygon);
      polygon.setAttribute('class', 'region-polygon');
      polygon.setAttribute('fill', fillColor);
      polygon.setAttribute('fill-opacity', isPlayerOwned ? '0.65' : '0.38');
      polygon.setAttribute('stroke', isPlayerOwned ? '#ffd700' : 'rgba(255,255,255,0.2)');
      polygon.setAttribute('stroke-width', isPlayerOwned ? '2.5' : '1.2');

      if (state.conquest.selectedRegionId === reg.id) {
        polygon.classList.add('selected-invade');
      }

      polygon.addEventListener('click', () => handleConquestRegionClick(reg));
      svgEl.appendChild(polygon);

      // 板块铭刻文字标记
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', reg.coords[0]); txt.setAttribute('y', reg.coords[1]);
      txt.setAttribute('fill', '#fff');
      txt.setAttribute('font-size', '13');
      txt.setAttribute('font-weight', 'bold');
      txt.setAttribute('text-anchor', 'middle');
      txt.style.pointerEvents = 'none';
      txt.textContent = reg.name;
      svgEl.appendChild(txt);

      // 防御关隘微型图标
      const passTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      passTxt.setAttribute('x', reg.coords[0]); passTxt.setAttribute('y', reg.coords[1] + 14);
      passTxt.setAttribute('fill', 'rgba(255,215,0,0.8)');
      passTxt.setAttribute('font-size', '9');
      passTxt.setAttribute('text-anchor', 'middle');
      passTxt.style.pointerEvents = 'none';
      passTxt.textContent = `🛡️${reg.defense}`;
      svgEl.appendChild(passTxt);
    });
  }

  function handleConquestRegionClick(region) {
    const playerFacId = state.conquest.playerFaction.id;
    const currentOwner = state.conquest.ownership[region.id];

    if (currentOwner === playerFacId) {
      document.getElementById('selectedRegionTargetText').textContent = `【${region.name}】（己方都防关隘：${region.pass}）`;
      document.getElementById('btnWarAttack').disabled = true;
      document.getElementById('btnDiplomacyBribe').disabled = true;
      return;
    }

    // 检查是否有己方领地邻接
    const neighbors = region.neighbors || [];
    const isAdjacent = neighbors.some(nId => state.conquest.ownership[nId] === playerFacId);

    if (!isAdjacent) {
      window.soundEngine.playErrorBuzz();
      alert(`无法越境发兵！【${region.name}】未与您现占领地相邻。必须先征讨邻接板块。`);
      return;
    }

    state.conquest.selectedRegionId = region.id;
    window.soundEngine.playStoneClick();
    renderConquestTopologyMap();

    const targetEl = document.getElementById('selectedRegionTargetText');
    targetEl.innerHTML = `🔥 目标【${region.name}】 (${region.ancientName})<br><span style="font-size:12px; color:#fff">守将坚壁：${region.pass} · 防御值 ${region.defense}</span>`;

    const btnWar = document.getElementById('btnWarAttack');
    const btnBribe = document.getElementById('btnDiplomacyBribe');

    btnWar.disabled = false;
    btnBribe.disabled = state.conquest.gold < 200;
  }

  // 武力征讨攻城问答推演
  document.getElementById('btnWarAttack').addEventListener('click', () => {
    const regId = state.conquest.selectedRegionId;
    if (!regId) return;
    const targetRegion = state.conquestRegions[regId];

    window.soundEngine.playWarDrum();

    // 弹出现场攻城古问答迷你测试
    const questions = [
      { q: `欲取关中【${targetRegion.name}】，必先攻破守卫中原与关中交界的要隘关卡？`, opts: ['潼关/虎牢关', '山海关', '嘉峪关', '剑门关'], ans: 0 },
      { q: `出兵【${targetRegion.name}】期间，粮草走廊经由长江与黄河哪一条古水系运输最佳？`, opts: ['运河古道与黄河水系', '多瑙河', '珠江口', '黑龙江'], ans: 0 }
    ];
    const qObj = questions[Math.floor(Math.random() * questions.length)];
    const chosen = prompt(`⚔️ 武力攻打【${targetRegion.name}】之战术问答：\n\n${qObj.q}\n\n1. ${qObj.opts[0]}\n2. ${qObj.opts[1]}\n3. ${qObj.opts[2]}\n4. ${qObj.opts[3]}\n\n请输入选项数字 (1-4)：`);

    if (chosen && parseInt(chosen.trim()) === (qObj.ans + 1)) {
      window.soundEngine.playSwordClash();
      // 成功吞并
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

  // 外交合纵劝降
  document.getElementById('btnDiplomacyBribe').addEventListener('click', () => {
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
  document.getElementById('btnDrawNextEvent').addEventListener('click', () => {
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
  // CANVAS SHARE POSTER CERTIFICATE GENERATOR (PRD SEC 5.1)
  // =============================================================
  function openCanvasSharePoster(data) {
    const modal = document.getElementById('sharePosterModal');
    modal.classList.add('open');

    const canvas = document.getElementById('posterCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // 深宣纸古典鎏金边框背景
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0f141c');
    grad.addColorStop(0.5, '#161b22');
    grad.addColorStop(1, '#0a0d12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 绘制四周鎏金暗纹双线框
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, W - 40, H - 40);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(28, 28, W - 56, H - 56);

    // 四角朱印纹样
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

    // 顶端国风大书标题
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 22px serif';
    ctx.fillText('御 赐 中国历史地理挑战战报', W / 2, 85);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px serif';
    ctx.fillText('《指点江山》', W / 2, 140);

    // 分割金线
    ctx.strokeStyle = 'rgba(241,196,15,0.4)';
    ctx.beginPath();
    ctx.moveTo(80, 165); ctx.lineTo(W - 80, 165);
    ctx.stroke();

    // 模式大标题与称号勋章
    ctx.fillStyle = '#8b949e';
    ctx.font = '16px sans-serif';
    ctx.fillText(data.modeTitle, W / 2, 210);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 32px serif';
    ctx.fillText(`“ ${data.rankTitle} ”`, W / 2, 270);

    // 核心数码千米/得分高亮大字
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

    // 经典历史评价长文框
    ctx.fillStyle = '#d1d8e0';
    ctx.font = '16px serif';
    const lines = wrapCanvasText(ctx, data.comment, W - 160);
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, 530 + i * 28);
    });

    // 底部专属方形阳文朱印章与二维码打卡标
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
    ctx.fillText('扫码或搜索 GitHub: DeanChensj/jiangshan-map', W / 2, 790);
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

  document.getElementById('btnClosePoster').addEventListener('click', () => {
    document.getElementById('sharePosterModal').classList.remove('open');
  });

  document.getElementById('btnDownloadPoster').addEventListener('click', () => {
    const canvas = document.getElementById('posterCanvas');
    const link = document.createElement('a');
    link.download = 'jiangshan_historical_map_certificate.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
});
