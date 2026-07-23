/**
 * Map Data & Projections for 《指点江山》
 * Handles WGS84 Geodetic <-> SVG screen coordinate conversion (Haversine distance calculation)
 */

const MAP_CONFIG = {
  minLon: 73.0,
  maxLon: 135.0,
  minLat: 18.0,
  maxLat: 53.0,
  svgWidth: 840,
  svgHeight: 560
};

// 经纬度 -> SVG Canvas 像素投影
function lonLatToSvg(lon, lat, width = MAP_CONFIG.svgWidth, height = MAP_CONFIG.svgHeight) {
  // 简易契合中国版图比例微调的 Conic/Equirectangular 调整
  const normX = (lon - MAP_CONFIG.minLon) / (MAP_CONFIG.maxLon - MAP_CONFIG.minLon);
  // 维度修正曲线增加曲率感受
  const latFactor = Math.pow((MAP_CONFIG.maxLat - lat) / (MAP_CONFIG.maxLat - MAP_CONFIG.minLat), 0.94);

  const x = Math.round(normX * (width - 70) + 35);
  const y = Math.round(latFactor * (height - 65) + 30);
  return { x, y };
}

// SVG Canvas 像素 -> 真实 WGS84 经纬度
function svgToLonLat(x, y, width = MAP_CONFIG.svgWidth, height = MAP_CONFIG.svgHeight) {
  const normX = Math.max(0, Math.min(1, (x - 35) / (width - 70)));
  const normY = Math.max(0, Math.min(1, (y - 30) / (height - 65)));

  const lon = MAP_CONFIG.minLon + normX * (MAP_CONFIG.maxLon - MAP_CONFIG.minLon);
  const latRatio = Math.pow(normY, 1 / 0.94);
  const lat = MAP_CONFIG.maxLat - latRatio * (MAP_CONFIG.maxLat - MAP_CONFIG.minLat);
  return {
    lon: parseFloat(lon.toFixed(2)),
    lat: parseFloat(lat.toFixed(2))
  };
}

/**
 * 大圆距离公式 (Haversine Formula) 计算球面上两点之间的实际千米数 (PRD Sec 2.2)
 * @param {[number, number]} coord1 - [lon1, lat1]
 * @param {[number, number]} coord2 - [lon2, lat2]
 * @returns {number} 距离(km)
 */
function haversineDistance(coord1, coord2) {
  const R = 6371; // 地球平均半径 (km)
  const toRad = Math.PI / 180;

  const lon1 = coord1[0] * toRad;
  const lat1 = coord1[1] * toRad;
  const lon2 = coord2[0] * toRad;
  const lat2 = coord2[1] * toRad;

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// 历代中国主要参考特征地理线（长城、黄河、长江、大运河、丝绸之路）
const HISTORICAL_GEOMETRIES = {
  yellowRiver: [
    [96.0, 34.2], [99.5, 34.8], [102.5, 36.1], [104.2, 36.6], [106.2, 38.4],
    [107.0, 40.7], [111.2, 40.6], [111.5, 39.2], [110.5, 35.5], [111.0, 34.8],
    [113.8, 34.9], [116.5, 35.8], [118.5, 37.8]
  ],
  yangtzeRiver: [
    [91.0, 33.2], [97.5, 33.0], [99.8, 28.2], [104.5, 28.7], [106.6, 29.5],
    [111.3, 30.7], [114.3, 30.6], [116.2, 29.8], [118.8, 32.1], [121.5, 31.3]
  ],
  greatWall: [
    [98.3, 39.8], [100.2, 39.1], [106.0, 38.2], [110.2, 39.5], [113.5, 40.8],
    [116.5, 40.4], [119.8, 40.0]
  ],
  silkRoad: [
    [108.94, 34.26], [104.8, 35.5], [100.2, 39.1], [94.6, 40.1], [88.2, 42.9], [76.0, 39.4]
  ]
};

// 模式一 (看图猜朝代) 特色朝代完整绘制几何图形路径 (包含具体疆域折线 polygon 与内部焦点线索)
const DYNASTY_MAP_POLYGONS = {
  // 秦朝：偏关中、中原、巴蜀、江东、岭南，阴山长城为界
  qin_map: {
    polygons: [
      [[104, 36], [108, 40], [114, 40], [119, 40], [121, 37], [120, 34], [121, 31], [116, 23], [108, 22], [103, 26], [101, 30], [104, 36]]
    ],
    showGreatWall: true,
    showYellowRiver: true,
    showYangtze: true,
    capitalDot: [108.70, 34.33],
    specialTag: "万里的秦长城与南平百越"
  },
  // 西汉：囊括西域都护府狭长半岛
  han_map: {
    polygons: [
      [[74, 39], [88, 44], [96, 41], [100, 42], [112, 42], [122, 41], [122, 35], [121, 30], [116, 21], [107, 21], [100, 26], [101, 33], [95, 39], [76, 37], [74, 39]]
    ],
    showGreatWall: true,
    showSilkRoad: true,
    capitalDot: [108.94, 34.26],
    specialTag: "西域都护府与河西四郡"
  },
  // 盛唐：囊括中亚安西都护府、漠北单于都护府、交趾
  tang_map: {
    polygons: [
      [[68, 43], [82, 47], [95, 49], [112, 51], [126, 49], [131, 45], [122, 34], [121, 29], [110, 18], [101, 24], [98, 30], [92, 38], [70, 37], [68, 43]]
    ],
    showSilkRoad: true,
    showYellowRiver: true,
    showYangtze: true,
    capitalDot: [108.94, 34.26],
    specialTag: "从咸海到贝加尔湖安西与单于都护府"
  },
  // 元朝：极广大一统，吐蕃、极北漠北辽东
  yuan_map: {
    polygons: [
      [[75, 45], [92, 52], [120, 53], [134, 52], [134, 42], [122, 33], [121, 25], [116, 21], [99, 27], [85, 29], [79, 36], [75, 45]]
    ],
    capitalDot: [116.40, 39.90],
    specialTag: "宣政院辖吐蕃与庞大行省版图"
  },
  // 明朝永乐：奴儿干都司、长城防御带
  ming_map: {
    polygons: [
      [[97, 39], [106, 41], [118, 41], [129, 52], [134, 48], [124, 38], [121, 29], [115, 21], [101, 24], [97, 31], [97, 39]]
    ],
    showGreatWall: true,
    capitalDot: [116.40, 39.90],
    specialTag: "天子守国门·九边重镇防线"
  },
  // 地狱难度的五代十国 (后周时代)：北方长城缺【幽云十六州】(红色阴影属于辽国)，南方六国裂开
  five_dynasties_map: {
    isSplitMode: true,
    subRegs: [
      { name: "契丹大辽(占幽云)", color: "#95a5a6", points: [[113, 40], [122, 42], [123, 39], [116, 39], [113, 40]] },
      { name: "后周(中原主权)", color: "#e74c3c", points: [[105, 34], [112, 40], [118, 39], [120, 35], [115, 32], [108, 33], [105, 34]] },
      { name: "北汉", color: "#34495e", points: [[111, 37], [114, 40], [114, 37], [111, 37]] },
      { name: "南唐(金陵)", color: "#f1c40f", points: [[114, 32], [121, 32], [120, 28], [113, 27], [114, 32]] },
      { name: "吴越(钱塘)", color: "#2ecc71", points: [[119, 31], [122, 31], [121, 27], [119, 28], [119, 31]] },
      { name: "后蜀(成都)", color: "#9b59b6", points: [[101, 32], [108, 33], [107, 27], [101, 28], [101, 32]] },
      { name: "南汉(广州)", color: "#e67e22", points: [[107, 25], [116, 25], [115, 21], [108, 21], [107, 25]] }
    ],
    capitalDot: [114.30, 34.80],
    specialTag: "【五代十国割据】缺失幽云十六州 & 南方群雄裂缝"
  },
  // 地狱难度的东晋十六国
  jin_sixteen_map: {
    isSplitMode: true,
    subRegs: [
      { name: "前秦/北方十六国", color: "#e74c3c", points: [[75, 41], [118, 42], [121, 35], [112, 33], [104, 34], [75, 41]] },
      { name: "东晋偏安(建康)", color: "#16a085", points: [[108, 33], [121, 34], [122, 25], [108, 23], [108, 33]] }
    ],
    capitalDot: [118.79, 32.06],
    specialTag: "【东晋十六国】南北淮河淝水峙战"
  },
  // 三国鼎立
  three_kingdoms_map: {
    isSplitMode: true,
    subRegs: [
      { name: "曹魏(中原北方)", color: "#34495e", points: [[98, 37], [123, 42], [122, 33], [114, 32], [105, 33], [98, 37]] },
      { name: "蜀汉(巴蜀汉中)", color: "#e74c3c", points: [[100, 33], [109, 34], [107, 24], [99, 25], [100, 33]] },
      { name: "孙吴(江东交广)", color: "#27ae60", points: [[113, 32], [122, 32], [122, 23], [107, 21], [112, 27], [113, 32]] }
    ],
    capitalDot: [112.45, 34.62],
    specialTag: "【三国鼎立】魏蜀吴分割天下"
  }
};

window.MAP_HELPER = {
  lonLatToSvg,
  svgToLonLat,
  haversineDistance,
  HISTORICAL_GEOMETRIES,
  DYNASTY_MAP_POLYGONS
};
