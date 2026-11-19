/**
 * 江山时序 · 新标签页 —— 随机场景注入
 *
 * 在站点脚本（js/app.js 等）加载之前运行：若当前 URL 没有深链参数，
 * 就用 history.replaceState 写入"随机场景"的查询串。站点自身的
 * _restoreFromQuery（js/atlas_api.js）会在 DOMContentLoaded 后照常解析
 * 这些参数，从而 100% 复用站内深链机制（含快照/词条懒加载等待）。
 *
 * 调试：URL 手动带 ?scene=N 可强制查看第 N 个场景（基于 0）。
 */
(function () {
  'use strict';

  // 随机场景清单（大致按年代排序）：q 为写入 URL 的查询串
  var SCENES = [
    { label: '战国开局 · 三家分晋', q: 'year=-403' },
    { label: '长平之战', q: 'year=-260&place=长平' },
    { label: '秦始皇一统六国行迹', q: 'person=qinshihuang' },
    { label: '秦扫六合 · 郡县天下', q: 'year=-221' },
    { label: '秦开岭南 · 置桂林象南海三郡', q: 'year=-214' },
    { label: '张骞凿空西域行迹', q: 'person=zhangqian' },
    { label: '西汉 · 霍去病开河西', q: 'year=-121' },
    { label: '西汉 · 经略西域', q: 'year=-100' },
    { label: '诸葛亮出山北伐行迹', q: 'person=zhugeliang' },
    { label: '赤壁之战', q: 'year=208&place=赤壁' },
    { label: '三国鼎立', q: 'year=250' },
    { label: '西晋 · 太康年间', q: 'year=300' },
    { label: '淝水之战', q: 'year=383&place=淝水' },
    { label: '南北朝对峙', q: 'year=500' },
    { label: '隋 · 大业开运河', q: 'year=605' },
    { label: '玄奘西行求法行迹', q: 'person=xuanzang' },
    { label: '唐置安西四镇', q: 'year=648' },
    { label: '李白仗剑壮游行迹', q: 'person=libai' },
    { label: '盛唐开元 · 长安', q: 'year=741&place=长安' },
    { label: '杜甫《闻官军收河南河北》归乡路', q: 'year=763&place=剑外,巴峡,巫峡,襄阳,洛阳' },
    { label: '韩愈 · 雪拥蓝关', q: 'year=819&place=蓝关' },
    { label: '五代十国', q: 'year=950' },
    { label: '北宋 · 东京梦华', q: 'year=1100' },
    { label: '苏轼宦海贬谪行迹', q: 'person=sushi' },
    { label: '南宋 · 临安', q: 'year=1200' },
    { label: '元设宣政院辖吐蕃', q: 'year=1288' },
    { label: '明永乐 · 两京十三布政使司', q: 'year=1415&place=应天府' },
    { label: '王阳明知行悟道行迹', q: 'person=wangyangming' },
    { label: '清中叶 · 疆域极盛', q: 'year=1800' },
    { label: '曾纪泽签约收复伊犁', q: 'year=1881' },
    { label: '民国 · 山河破碎与重建', q: 'year=1936' },
    { label: '抗战胜利 · 台湾光复', q: 'year=1945' },
    { label: '今日版图', q: 'year=2026' }
  ];

  var sp = new URLSearchParams(location.search);
  var idx;

  if (sp.has('scene')) {
    // 调试通道：?scene=N 强制指定场景
    idx = parseInt(sp.get('scene'), 10);
    if (!isFinite(idx)) return;
    idx = ((idx % SCENES.length) + SCENES.length) % SCENES.length;
  } else {
    // 已带显式深链参数（year/place/person/q 等）时不干预
    var EXPLICIT = ['year', 'place', 'person', 'event', 'journey', 'q',
      'trace', 'quiz', 'polity', 'lng', 'lat'];
    for (var i = 0; i < EXPLICIT.length; i++) {
      if (sp.has(EXPLICIT[i])) return;
    }
    // localStorage 在扩展的新标签页间共享，不需要额外权限。
    // 从其余场景中随机选择，避免连续两次打开相同场景。
    var last = -1;
    var storageKey = 'jiangshan-newtab-last-scene';
    try {
      var saved = localStorage.getItem(storageKey);
      if (saved !== null && /^\d+$/.test(saved) && Number(saved) < SCENES.length) {
        last = Number(saved);
      }
    } catch (e) { /* 存储不可用时仍可随机打开 */ }
    idx = Math.floor(Math.random() * (SCENES.length - (last >= 0 ? 1 : 0)));
    if (last >= 0 && idx >= last) idx++;
    try {
      localStorage.setItem(storageKey, String(idx));
    } catch (e) { /* 存储不可用时无法排除上次场景 */ }
  }

  var scene = SCENES[idx];
  try {
    history.replaceState(null, '', 'index.html?' + scene.q);
    if (window.console && console.info) {
      console.info('[新标签页] 随机场景 #' + idx + ' ' + scene.label);
    }
  } catch (e) {
    /* replaceState 失败时退回站点默认视图，不影响任何功能 */
  }
})();
