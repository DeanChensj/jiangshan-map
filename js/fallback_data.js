/**
 * Standalone Local File Protocol Fallback Data
 * Guarantees zero-fetch-error operation when double clicking index.html directly in file browser.
 */

window.FALLBACK_DYNASTIES = [
  {
    "id": "five_dynasties_later_zhou",
    "name": "五代十国·后周与割据 (Later Zhou & Ten Kingdoms)",
    "period": "公元 951 - 960 年 (五代极值乱世)",
    "capital": { "name": "东京开封府", "coords": [114.30, 34.80] },
    "difficulty": "hell",
    "color": "#e74c3c",
    "borderColor": "#ff0055",
    "svgPathKey": "five_dynasties_map",
    "features": ["北部缺失【幽云十六州】（已被石敬瑭割让给契丹大辽）", "南方并存南唐、吴越、前蜀/后蜀、南汉、楚国、荆南", "山西为后汉余脉【北汉】"],
    "hints": ["【爆款考点】北有契丹辽国占领长城要隘，北方中原为后周，南方南唐与吴越夹江对峙", "柴荣世宗两征南唐、北伐幽燕"],
    "options": ["三国割据", "十六国时期", "五代十国 (后周时期)", "南宋与金对峙"],
    "correctAnswer": 2,
    "description": "朱温灭唐后中原历经梁、唐、晋、汉、周五代替换，北方缺幽云十六州，南方十国蜂起，是中国历史上极具辨识度的割据断层。"
  },
  {
    "id": "western_han",
    "name": "西汉 (Western Han Dynasty)",
    "period": "公元前 202 - 公元 8 年",
    "capital": { "name": "长安", "coords": [108.94, 34.26] },
    "difficulty": "standard",
    "color": "#c0392b",
    "borderColor": "#f1c40f",
    "svgPathKey": "han_map",
    "features": ["设置西域都护府（新疆地区第一次纳入版图）", "张骞出使丝绸之路", "河西四郡"],
    "hints": ["设河西四郡（武威、张掖、酒泉、敦煌）", "汉武帝北伐匈奴"],
    "options": ["东汉", "西汉", "唐朝", "元朝"],
    "correctAnswer": 1,
    "description": "刘邦建立汉朝，至汉武帝时期张骞通西域，设立西域都护府，版图向西北大幅度拓展。"
  },
  {
    "id": "tang",
    "name": "唐朝盛唐 (Tang Dynasty)",
    "period": "公元 618 - 907 年",
    "capital": { "name": "长安", "coords": [108.94, 34.26] },
    "difficulty": "standard",
    "color": "#e67e22",
    "borderColor": "#ffd700",
    "svgPathKey": "tang_map",
    "features": ["安西都护府直达咸海", "单于都护府涵盖漠北"],
    "hints": ["天可汗时代"],
    "options": ["隋朝", "明朝", "唐朝", "清朝"],
    "correctAnswer": 2,
    "description": "李世民创设贞观之治，万国来朝。"
  },
  {
    "id": "three_kingdoms",
    "name": "三国鼎立 (Three Kingdoms Era)",
    "period": "公元 220 - 280 年",
    "capital": { "name": "洛阳/成都/建业", "coords": [112.45, 34.62] },
    "difficulty": "hell",
    "color": "#d35400",
    "borderColor": "#f39c12",
    "svgPathKey": "three_kingdoms_map",
    "features": ["曹魏据北方", "蜀汉缩据巴蜀", "孙吴领江东"],
    "hints": ["赤壁之战后三分天下"],
    "options": ["楚汉相争", "三国鼎立", "南北朝", "春秋战国"],
    "correctAnswer": 1,
    "description": "魏蜀吴三分天下。"
  }
];

window.FALLBACK_HEROES = [
  {
    "id": "han_xin",
    "name": "韩信",
    "title": "国士无双 · 兵仙",
    "era": "汉初 (楚汉相争)",
    "avatar": "⚔️",
    "quote": "“臣请自择三十万人，为大王破楚。”",
    "bio": "淮阴少年，寄食漂母；胯下之辱未磨其志。入蜀拜大将军，背水一战灭赵，长乐宫落幕。",
    "points": [
      { "step": "📍 节点 A：籍贯出生地", "label": "淮阴 (今江苏淮安)", "coords": [119.02, 33.62], "hint": "位于淮河流域、京杭大运河枢纽，古称淮阴。" },
      { "step": "⚔️ 节点 B：绝世战役·背水一战", "label": "井陉关 (今河北石家庄井陉)", "coords": [114.10, 38.03], "hint": "太行八刑之五，连接山西与河北的隘口。" },
      { "step": "☠️ 节点 C：功成身殒·长乐钟室", "label": "汉长安城 (今陕西西安)", "coords": [108.94, 34.26], "hint": "关中平原腹地，汉代都城咸阳之南。" }
    ]
  },
  {
    "id": "yue_fei",
    "name": "岳飞",
    "title": "精忠报国 · 武圣",
    "era": "南宋",
    "avatar": "🛡️",
    "quote": "“待从头、收拾旧山河，朝天阙！”",
    "bio": "率岳家军北伐，郾城大破拐子马，风波亭冤狱下死。",
    "points": [
      { "step": "📍 节点 A：故里相州", "label": "汤阴 (今河南安阳)", "coords": [114.36, 35.92], "hint": "安阳市南郊。" },
      { "step": "⚔️ 节点 B：郾城大捷", "label": "郾城 (今河南漯河)", "coords": [114.01, 33.58], "hint": "豫中平原。" },
      { "step": "☠️ 节点 C：风波亭", "label": "临安风波亭 (今浙江杭州)", "coords": [120.15, 30.27], "hint": "西子湖畔。" }
    ]
  },
  {
    "id": "zhuge_liang",
    "name": "诸葛亮",
    "title": "鞠躬尽瘁 · 忠武侯",
    "era": "三国",
    "avatar": "🪶",
    "quote": "“鞠躬尽瘁，死而后已。”",
    "bio": "三顾茅庐定三分天下，星陨五丈原。",
    "points": [
      { "step": "📍 节点 A：隆中隐居", "label": "隆中 (今湖北襄阳)", "coords": [112.01, 32.01], "hint": "汉水之南。" },
      { "step": "⚔️ 节点 B：赤壁大捷", "label": "赤壁 (今湖北咸宁)", "coords": [113.90, 29.87], "hint": "长江中游南岸。" },
      { "step": "☠️ 节点 C：星陨五丈原", "label": "五丈原 (今陕西宝鸡)", "coords": [107.77, 34.25], "hint": "渭河南岸高台。" }
    ]
  }
];
