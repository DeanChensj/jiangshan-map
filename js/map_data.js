/**
 * High-Precision D3.js GIS Projection & Instant Synchronous GeoJSON Loader for 《指点江山》
 */

const MAP_CONFIG = {
  svgWidth: 900,
  svgHeight: 580,
  centerLat: 36.0,
  rotateLon: -105.0,
  parallels: [25.0, 47.0],
  scale: 880
};

const GIS_STORE = {
  chinaGeo: (typeof window !== 'undefined' && window.CHINA_GEO_DATA) ? window.CHINA_GEO_DATA : null,
  worldGeo: null,
  loaded: (typeof window !== 'undefined' && !!window.CHINA_GEO_DATA),
  loadPromise: null
};

let d3Projection = null;
let d3PathGenerator = null;

function initD3Projection(width = MAP_CONFIG.svgWidth, height = MAP_CONFIG.svgHeight) {
  if (typeof d3 === 'undefined') {
    return null;
  }
  const scale = width * (MAP_CONFIG.scale / 900);
  d3Projection = d3.geoConicEqualArea()
    .rotate([MAP_CONFIG.rotateLon, 0])
    .center([0, MAP_CONFIG.centerLat])
    .parallels(MAP_CONFIG.parallels)
    .scale(scale)
    .translate([width / 2 + 10, height / 2 - 5]);

  d3PathGenerator = d3.geoPath().projection(d3Projection);
  return d3Projection;
}

initD3Projection();

function lonLatToSvg(lon, lat, width = MAP_CONFIG.svgWidth, height = MAP_CONFIG.svgHeight) {
  if (d3Projection) {
    const pt = d3Projection([lon, lat]);
    if (pt && !isNaN(pt[0]) && !isNaN(pt[1])) {
      return { x: Math.round(pt[0] * 10) / 10, y: Math.round(pt[1] * 10) / 10 };
    }
  }
  const minLon = 73.0, maxLon = 135.0;
  const minLat = 18.0, maxLat = 53.0;
  const normX = (lon - minLon) / (maxLon - minLon);
  const latFactor = Math.pow((maxLat - lat) / (maxLat - minLat), 0.94);
  return {
    x: Math.round(normX * (width - 70) + 35),
    y: Math.round(latFactor * (height - 65) + 30)
  };
}

function svgToLonLat(x, y, width = MAP_CONFIG.svgWidth, height = MAP_CONFIG.svgHeight) {
  if (d3Projection && typeof d3Projection.invert === 'function') {
    const inv = d3Projection.invert([x, y]);
    if (inv && !isNaN(inv[0]) && !isNaN(inv[1])) {
      return {
        lon: parseFloat(inv[0].toFixed(3)),
        lat: parseFloat(inv[1].toFixed(3))
      };
    }
  }
  const minLon = 73.0, maxLon = 135.0;
  const minLat = 18.0, maxLat = 53.0;
  const normX = Math.max(0, Math.min(1, (x - 35) / (width - 70)));
  const normY = Math.max(0, Math.min(1, (y - 30) / (height - 65)));
  const lon = minLon + normX * (maxLon - minLon);
  const latRatio = Math.pow(normY, 1 / 0.94);
  const lat = maxLat - latRatio * (maxLat - minLat);
  return {
    lon: parseFloat(lon.toFixed(3)),
    lat: parseFloat(lat.toFixed(3))
  };
}

function haversineDistance(coord1, coord2) {
  const R = 6371;
  const toRad = Math.PI / 180;
  const lon1 = coord1[0] * toRad;
  const lat1 = coord1[1] * toRad;
  const lon2 = coord2[0] * toRad;
  const lat2 = coord2[1] * toRad;
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const HISTORICAL_GEOMETRIES = {
  yellowRiver: [
    [96.0, 34.2], [97.5, 34.6], [99.5, 34.8], [100.8, 35.8], [102.5, 36.1],
    [104.2, 36.6], [105.8, 37.5], [106.3, 38.6], [107.0, 40.7], [108.5, 40.8],
    [111.2, 40.6], [111.5, 39.2], [110.8, 37.6], [110.5, 35.5], [111.0, 34.8],
    [112.5, 34.9], [113.8, 34.9], [115.6, 35.2], [116.5, 35.8], [118.5, 37.8]
  ],
  yangtzeRiver: [
    [91.0, 33.2], [94.5, 33.5], [97.5, 33.0], [99.8, 28.2], [100.5, 26.8],
    [102.8, 26.6], [104.5, 28.7], [106.6, 29.5], [108.8, 30.8], [111.3, 30.7],
    [112.5, 29.9], [114.3, 30.6], [116.2, 29.8], [118.8, 32.1], [120.8, 32.0], [121.8, 31.3]
  ],
  greatWall: [
    [98.3, 39.8], [100.2, 39.1], [102.6, 37.9], [106.0, 38.2], [108.2, 38.8],
    [110.2, 39.5], [112.5, 40.4], [114.5, 40.8], [116.3, 40.4], [118.1, 40.2], [119.8, 40.0]
  ],
  silkRoad: [
    [108.94, 34.26], [105.5, 34.6], [104.8, 35.5], [102.6, 37.9], [100.2, 39.1],
    [98.3, 39.8], [94.6, 40.1], [88.2, 42.9], [80.2, 41.2], [76.0, 39.4]
  ],
  grandCanal: [
    [116.40, 39.90], [117.2, 39.1], [116.3, 37.4], [116.5, 35.8],
    [117.2, 34.3], [119.0, 33.6], [119.4, 32.4], [120.2, 30.3]
  ]
};

const STRATEGIC_ZONE_PROVINCES = {
  guanzhong: ['陕西', '宁夏'],
  hedong: ['山西'],
  hebei: ['河北', '天津'],
  youyan: ['北京'],
  zhongyuan: ['河南'],
  shandong: ['山东'],
  huainan: ['安徽'],
  jiangdong: ['江苏', '上海'],
  wuyue: ['浙江'],
  bashu: ['四川', '重庆'],
  jingchu: ['湖北', '湖南'],
  longyou: ['甘肃'],
  hexizoulang: [],
  xiyu: ['新疆'],
  mobei: ['内蒙古'],
  liaodong: ['辽宁', '吉林', '黑龙江'],
  fujian: ['福建'],
  qianzhong: ['贵州'],
  yunlin: ['云南'],
  lingnan: ['广东', '广西'],
  hainan: ['海南'],
  tubo: ['西藏', '青海'],
  suishi: [],
  taiwan: ['台湾']
};

const DYNASTY_PROVINCES_CONFIG = {
  qin: {
    title: '秦朝统一疆域',
    coreKeywords: ['陕西', '河南', '山西', '河北', '山东', '湖北', '湖南', '四川', '重庆', '江苏', '安徽', '浙江', '江西', '广东', '广西', '北京', '天津'],
    specialNote: '阴山长城为界 · 南平百越设立南海象郡桂林郡'
  },
  western_han: {
    title: '西汉武帝巅峰疆域 (含西域都护府)',
    coreKeywords: ['陕西', '甘肃', '新疆', '宁夏', '河南', '山西', '河北', '山东', '湖北', '湖南', '四川', '重庆', '江苏', '安徽', '浙江', '江西', '广东', '广西', '贵州', '云南', '北京', '天津', '辽宁'],
    specialNote: '设立西域都护府 (今新疆全境) · 通河西四郡'
  },
  tang: {
    title: '大唐开元盛世万国版图',
    coreKeywords: ['陕西', '甘肃', '新疆', '宁夏', '青海', '内蒙古', '山西', '河南', '河北', '山东', '湖北', '湖南', '四川', '重庆', '江苏', '安徽', '浙江', '江西', '福建', '广东', '广西', '贵州', '云南', '辽宁', '吉林', '北京', '天津'],
    specialNote: '安西都护府直达中亚咸海 · 单于与安北都护府涵盖漠北'
  },
  yuan: {
    title: '大元大一统行省版图',
    coreKeywords: ['北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '陕西', '甘肃', '青海', '宁夏', '新疆', '西藏', '四川', '重庆', '河南', '山东', '江苏', '安徽', '浙江', '江西', '湖北', '湖南', '福建', '广东', '广西', '贵州', '云南', '海南', '台湾'],
    specialNote: '宣政院直辖吐蕃 (西藏首次归入中央) · 庞大行省体制'
  },
  ming: {
    title: '大明永乐极盛版图',
    coreKeywords: ['北京', '天津', '河北', '山西', '山东', '河南', '陕西', '江苏', '安徽', '浙江', '江西', '湖北', '湖南', '福建', '广东', '广西', '贵州', '云南', '四川', '重庆', '辽宁', '吉林', '黑龙江', '海南'],
    specialNote: '天子守国门 · 九边重镇与东北奴儿干都司'
  },
  five_dynasties_later_zhou: {
    title: '五代十国割据乱世 (后周时期)',
    splitFactions: [
      { name: '契丹大辽 (占幽云十六州)', color: '#95a5a6', keywords: ['北京', '天津', '内蒙古', '辽宁'] },
      { name: '后周 (中原正统)', color: '#e74c3c', keywords: ['河南', '陕西', '山东', '安徽', '河北'] },
      { name: '北汉 (太行要塞)', color: '#34495e', keywords: ['山西'] },
      { name: '南唐 (金陵富庶)', color: '#f1c40f', keywords: ['江苏', '江西', '安徽', '湖北', '湖南'] },
      { name: '吴越 (保境安民)', color: '#2ecc71', keywords: ['浙江', '上海'] },
      { name: '后蜀 (天府之国)', color: '#9b59b6', keywords: ['四川', '重庆'] },
      { name: '南汉 (岭南珠江)', color: '#e67e22', keywords: ['广东', '广西', '海南'] }
    ]
  },
  sixteen_kingdoms_eastern_jin: {
    title: '东晋十六国南北分峙',
    splitFactions: [
      { name: '前秦/北方十六国 (苻坚)', color: '#e74c3c', keywords: ['陕西', '山西', '河南', '河北', '山东', '甘肃', '宁夏', '新疆', '四川', '北京', '天津', '内蒙古'] },
      { name: '东晋偏安 (衣冠南渡建康)', color: '#16a085', keywords: ['江苏', '浙江', '安徽', '江西', '湖北', '湖南', '福建', '广东', '广西', '上海'] }
    ]
  },
  three_kingdoms: {
    title: '三国鼎立决战神州',
    splitFactions: [
      { name: '曹魏 (据北方九州)', color: '#34495e', keywords: ['河南', '陕西', '山西', '河北', '山东', '甘肃', '宁夏', '北京', '天津', '辽宁', '安徽', '江苏'] },
      { name: '蜀汉 (据益州祁山)', color: '#e74c3c', keywords: ['四川', '重庆', '云南', '贵州'] },
      { name: '孙吴 (据水师江东)', color: '#27ae60', keywords: ['浙江', '江西', '湖北', '湖南', '福建', '广东', '广西', '上海', '海南'] }
    ]
  }
};

function loadGISData() {
  if (window.CHINA_GEO_DATA) {
    GIS_STORE.chinaGeo = window.CHINA_GEO_DATA;
    if (window.WORLD_GEO_DATA && typeof topojson !== 'undefined' && window.WORLD_GEO_DATA.objects) {
      GIS_STORE.worldGeo = topojson.feature(window.WORLD_GEO_DATA, window.WORLD_GEO_DATA.objects.countries);
    }
    GIS_STORE.loaded = true;
    return Promise.resolve(GIS_STORE);
  }

  if (GIS_STORE.loaded) {
    return Promise.resolve(GIS_STORE);
  }
  if (GIS_STORE.loadPromise) {
    return GIS_STORE.loadPromise;
  }

  GIS_STORE.loadPromise = Promise.all([
    fetch('data/china_provinces.json').then(r => r.json()),
    fetch('data/world_countries.json').then(r => r.json()).catch(() => null)
  ]).then(([chinaData, worldData]) => {
    GIS_STORE.chinaGeo = chinaData;
    if (worldData && typeof topojson !== 'undefined' && worldData.objects && worldData.objects.countries) {
      GIS_STORE.worldGeo = topojson.feature(worldData, worldData.objects.countries);
    }
    GIS_STORE.loaded = true;
    return GIS_STORE;
  }).catch(err => {
    console.error('Failed loading GIS GeoJSON:', err);
    GIS_STORE.loaded = false;
    return GIS_STORE;
  });

  return GIS_STORE.loadPromise;
}

window.MAP_HELPER = {
  MAP_CONFIG,
  initD3Projection,
  lonLatToSvg,
  svgToLonLat,
  haversineDistance,
  HISTORICAL_GEOMETRIES,
  STRATEGIC_ZONE_PROVINCES,
  DYNASTY_PROVINCES_CONFIG,
  loadGISData,
  getD3Projection: () => d3Projection,
  getD3PathGenerator: () => d3PathGenerator,
  getGISStore: () => GIS_STORE
};
