/**
 * Historical Lore, Reign Eras, Landmark Events, Strategic Passes, Guqin Tracks & Biographical Journeys
 * Decoupled from the view/projection controller (js/app.js) for modular maintenance.
 */
(function () {
  "use strict";
  window.ATLAS_LORE_DATA = {
  "CHINESE_ERA_SPANS": [
    [-403, "周威烈王", 23, "周威烈王", "King Weilie"],
    [-401, "周安王", 1, "周安王", "King An"],
    [-375, "周烈王", 1, "周烈王", "King Lie"],
    [-368, "周显王", 1, "周显王", "King Xian"],
    [-320, "周慎靓王", 1, "周慎靓王", "King Shenjing"],
    [-314, "周赧王", 1, "周赧王", "King Nan"],
    [-255, "秦昭襄王", 52, "秦昭襄王", "King Zhaoxiang"],
    [-250, "秦孝文王", 1, "秦孝文王", "King Xiaowen"],
    [-249, "秦庄襄王", 1, "秦庄襄王", "King Zhuangxiang"],
    [-246, "秦王政", 1, "秦王政", "King Zheng"],
    [-221, "秦始皇", 26, "秦始皇", "Qin Shi Huang"],
    [-209, "秦二世", 1, "秦二世", "Qin Er Shi"],
    [-206, "汉高帝", 1, "汉高帝", "Emp. Gaozu"],
    [-194, "西汉惠帝", 1, "西汉惠帝", "Emp. Hui"],
    [-187, "西汉高后", 1, "西汉高后", "Empress Lü"],
    [-179, "西汉文帝前元", 1, "西汉文帝", "Emp. Wen"],
    [-163, "西汉文帝后元", 1, "西汉文帝", "Emp. Wen"],
    [-156, "西汉景帝前元", 1, "西汉景帝", "Emp. Jing"],
    [-149, "西汉景帝中元", 1, "西汉景帝", "Emp. Jing"],
    [-143, "西汉景帝后元", 1, "西汉景帝", "Emp. Jing"],
    [-140, "西汉建元", 1, "西汉武帝", "Emp. Wu"],
    [-134, "西汉元光", 1, "西汉武帝", "Emp. Wu"],
    [-128, "西汉元朔", 1, "西汉武帝", "Emp. Wu"],
    [-122, "西汉元狩", 1, "西汉武帝", "Emp. Wu"],
    [-116, "西汉元鼎", 1, "西汉武帝", "Emp. Wu"],
    [-110, "西汉元封", 1, "西汉武帝", "Emp. Wu"],
    [-104, "西汉太初", 1, "西汉武帝", "Emp. Wu"],
    [-100, "西汉天汉", 1, "西汉武帝", "Emp. Wu"],
    [-96, "西汉太始", 1, "西汉武帝", "Emp. Wu"],
    [-92, "西汉征和", 1, "西汉武帝", "Emp. Wu"],
    [-88, "西汉后元", 1, "西汉武帝", "Emp. Wu"],
    [-86, "西汉始元", 1, "西汉昭帝", "Emp. Zhao"],
    [-80, "西汉元凤", 1, "西汉昭帝", "Emp. Zhao"],
    [-74, "西汉元平", 1, "西汉昭帝", "Emp. Zhao"],
    [-73, "西汉本始", 1, "西汉宣帝", "Emp. Xuan"],
    [-69, "西汉地节", 1, "西汉宣帝", "Emp. Xuan"],
    [-65, "西汉元康", 1, "西汉宣帝", "Emp. Xuan"],
    [-61, "西汉神爵", 1, "西汉宣帝", "Emp. Xuan"],
    [-57, "西汉五凤", 1, "西汉宣帝", "Emp. Xuan"],
    [-53, "西汉甘露", 1, "西汉宣帝", "Emp. Xuan"],
    [-49, "西汉黄龙", 1, "西汉宣帝", "Emp. Xuan"],
    [-48, "西汉初元", 1, "西汉元帝", "Emp. Yuan"],
    [-43, "西汉永光", 1, "西汉元帝", "Emp. Yuan"],
    [-38, "西汉建昭", 1, "西汉元帝", "Emp. Yuan"],
    [-33, "西汉竟宁", 1, "西汉元帝", "Emp. Yuan"],
    [-32, "西汉建始", 1, "西汉成帝", "Emp. Cheng"],
    [-28, "西汉河平", 1, "西汉成帝", "Emp. Cheng"],
    [-24, "西汉阳朔", 1, "西汉成帝", "Emp. Cheng"],
    [-20, "西汉鸿嘉", 1, "西汉成帝", "Emp. Cheng"],
    [-16, "西汉永始", 1, "西汉成帝", "Emp. Cheng"],
    [-12, "西汉元延", 1, "西汉成帝", "Emp. Cheng"],
    [-8, "西汉绥和", 1, "西汉成帝", "Emp. Cheng"],
    [-6, "西汉建平", 1, "西汉哀帝", "Emp. Ai"],
    [-2, "西汉元寿", 1, "西汉哀帝", "Emp. Ai"],
    [1, "西汉元始", 1, "西汉平帝", "Emp. Ping"],
    [6, "西汉居摄", 1, "西汉孺子婴", "Ruzi Ying"],
    [8, "西汉初始", 1, "西汉孺子婴", "Ruzi Ying"],
    [9, "新莽始建国", 1, "新莽王莽", "Wang Mang"],
    [14, "新莽天凤", 1, "新莽王莽", "Wang Mang"],
    [20, "新莽地皇", 1, "新莽王莽", "Wang Mang"],
    [23, "汉更始", 1, "汉更始帝", "Gengshi Emp."],
    [25, "东汉建武", 1, "东汉光武帝", "Emp. Guangwu"],
    [56, "东汉建武中元", 1, "东汉光武帝", "Emp. Guangwu"],
    [58, "东汉永平", 1, "东汉明帝", "Emp. Ming"],
    [76, "东汉建初", 1, "东汉章帝", "Emp. Zhang"],
    [84, "东汉元和", 1, "东汉章帝", "Emp. Zhang"],
    [87, "东汉章和", 1, "东汉章帝", "Emp. Zhang"],
    [89, "东汉永元", 1, "东汉和帝", "Emp. He"],
    [105, "东汉元兴", 1, "东汉和帝", "Emp. He"],
    [106, "东汉延平", 1, "东汉殇帝", "Emp. Shang"],
    [107, "东汉永初", 1, "东汉安帝", "Emp. An"],
    [114, "东汉元初", 1, "东汉安帝", "Emp. An"],
    [120, "东汉永宁", 1, "东汉安帝", "Emp. An"],
    [121, "东汉建光", 1, "东汉安帝", "Emp. An"],
    [122, "东汉延光", 1, "东汉安帝", "Emp. An"],
    [126, "东汉永建", 1, "东汉顺帝", "Emp. Shun"],
    [132, "东汉阳嘉", 1, "东汉顺帝", "Emp. Shun"],
    [136, "东汉永和", 1, "东汉顺帝", "Emp. Shun"],
    [142, "东汉汉安", 1, "东汉顺帝", "Emp. Shun"],
    [144, "东汉建康", 1, "东汉顺帝", "Emp. Shun"],
    [145, "东汉永憙", 1, "东汉冲帝", "Emp. Chong"],
    [146, "东汉本初", 1, "东汉质帝", "Emp. Zhi"],
    [147, "东汉建和", 1, "东汉桓帝", "Emp. Huan"],
    [150, "东汉和平", 1, "东汉桓帝", "Emp. Huan"],
    [151, "东汉元嘉", 1, "东汉桓帝", "Emp. Huan"],
    [153, "东汉永兴", 1, "东汉桓帝", "Emp. Huan"],
    [155, "东汉永寿", 1, "东汉桓帝", "Emp. Huan"],
    [158, "东汉延熹", 1, "东汉桓帝", "Emp. Huan"],
    [167, "东汉永康", 1, "东汉桓帝", "Emp. Huan"],
    [168, "东汉建宁", 1, "东汉灵帝", "Emp. Ling"],
    [172, "东汉熹平", 1, "东汉灵帝", "Emp. Ling"],
    [178, "东汉光和", 1, "东汉灵帝", "Emp. Ling"],
    [184, "东汉中平", 1, "东汉灵帝", "Emp. Ling"],
    [190, "东汉初平", 1, "东汉献帝", "Emp. Xian"],
    [194, "东汉兴平", 1, "东汉献帝", "Emp. Xian"],
    [196, "东汉建安", 1, "东汉献帝", "Emp. Xian"],
    [220, "魏黄初", 1, "魏文帝", "Emp. Wen of Wei"],
    [227, "魏太和", 1, "魏明帝", "Emp. Ming of Wei"],
    [233, "魏青龙", 1, "魏明帝", "Emp. Ming of Wei"],
    [237, "魏景初", 1, "魏明帝", "Emp. Ming of Wei"],
    [240, "魏正始", 1, "魏齐王", "Cao Fang"],
    [249, "魏嘉平", 1, "魏齐王", "Cao Fang"],
    [254, "魏正元", 1, "魏高贵乡公", "Cao Mao"],
    [256, "魏甘露", 1, "魏高贵乡公", "Cao Mao"],
    [260, "魏景元", 1, "魏元帝", "Emp. Yuan of Wei"],
    [264, "魏咸熙", 1, "魏元帝", "Emp. Yuan of Wei"],
    [265, "西晋泰始", 1, "西晋武帝", "Emp. Wu"],
    [275, "西晋咸宁", 1, "西晋武帝", "Emp. Wu"],
    [280, "西晋太康", 1, "西晋武帝", "Emp. Wu"],
    [290, "西晋永熙", 1, "西晋惠帝", "Emp. Hui"],
    [291, "西晋元康", 1, "西晋惠帝", "Emp. Hui"],
    [300, "西晋永康", 1, "西晋惠帝", "Emp. Hui"],
    [301, "西晋永宁", 1, "西晋惠帝", "Emp. Hui"],
    [302, "西晋太安", 1, "西晋惠帝", "Emp. Hui"],
    [304, "西晋永兴", 1, "西晋惠帝", "Emp. Hui"],
    [306, "西晋光熙", 1, "西晋惠帝", "Emp. Hui"],
    [307, "西晋永嘉", 1, "西晋怀帝", "Emp. Huai"],
    [313, "西晋建兴", 1, "西晋愍帝", "Emp. Min"],
    [317, "东晋建武", 1, "东晋元帝", "Emp. Yuan"],
    [318, "东晋太兴", 1, "东晋元帝", "Emp. Yuan"],
    [322, "东晋永昌", 1, "东晋元帝", "Emp. Yuan"],
    [323, "东晋太宁", 1, "东晋明帝", "Emp. Ming"],
    [326, "东晋咸和", 1, "东晋成帝", "Emp. Cheng"],
    [335, "东晋咸康", 1, "东晋成帝", "Emp. Cheng"],
    [343, "东晋建元", 1, "东晋康帝", "Emp. Kang"],
    [345, "东晋永和", 1, "东晋穆帝", "Emp. Mu"],
    [357, "东晋升平", 1, "东晋穆帝", "Emp. Mu"],
    [362, "东晋隆和", 1, "东晋哀帝", "Emp. Ai"],
    [363, "东晋兴宁", 1, "东晋哀帝", "Emp. Ai"],
    [366, "东晋太和", 1, "东晋废帝", "Emp. Fei"],
    [371, "东晋咸安", 1, "东晋简文帝", "Emp. Jianwen"],
    [373, "东晋宁康", 1, "东晋孝武帝", "Emp. Xiaowu"],
    [376, "东晋太元", 1, "东晋孝武帝", "Emp. Xiaowu"],
    [397, "东晋隆安", 1, "东晋安帝", "Emp. An"],
    [402, "东晋元兴", 1, "东晋安帝", "Emp. An"],
    [405, "东晋义熙", 1, "东晋安帝", "Emp. An"],
    [419, "东晋元熙", 1, "东晋恭帝", "Emp. Gong"],
    [420, "南朝宋永初", 1, "南朝宋武帝", "Emp. Wu of Liu Song"],
    [423, "南朝宋景平", 1, "南朝宋少帝", "Emp. Shao of Liu Song"],
    [424, "南朝宋元嘉", 1, "南朝宋文帝", "Emp. Wen of Liu Song"],
    [454, "南朝宋孝建", 1, "南朝宋孝武帝", "Emp. Xiaowu of Liu Song"],
    [457, "南朝宋大明", 1, "南朝宋孝武帝", "Emp. Xiaowu of Liu Song"],
    [465, "南朝宋泰始", 1, "南朝宋明帝", "Emp. Ming of Liu Song"],
    [472, "南朝宋泰豫", 1, "南朝宋明帝", "Emp. Ming of Liu Song"],
    [473, "南朝宋元徽", 1, "南朝宋后废帝", "Houfeidi of Liu Song"],
    [477, "北魏太和", 1, "北魏孝文帝", "Emp. Xiaowen of N. Wei"],
    [500, "北魏景明", 1, "北魏宣武帝", "Emp. Xuanwu of N. Wei"],
    [502, "南朝梁天监", 1, "南朝梁武帝", "Emp. Wu of Liang"],
    [520, "南朝梁普通", 1, "南朝梁武帝", "Emp. Wu of Liang"],
    [527, "南朝梁大通", 1, "南朝梁武帝", "Emp. Wu of Liang"],
    [529, "南朝梁中大通", 1, "南朝梁武帝", "Emp. Wu of Liang"],
    [535, "南朝梁大同", 1, "南朝梁武帝", "Emp. Wu of Liang"],
    [546, "南朝梁中大同", 1, "南朝梁武帝", "Emp. Wu of Liang"],
    [547, "南朝梁太清", 1, "南朝梁武帝", "Emp. Wu of Liang"],
    [550, "北齐天保", 1, "北齐文宣帝", "Emp. Wenxuan of N. Qi"],
    [557, "南朝陈永定", 1, "南朝陈武帝", "Emp. Wu of Chen"],
    [560, "南朝陈天嘉", 1, "南朝陈文帝", "Emp. Wen of Chen"],
    [566, "北周天和", 1, "北周武帝", "Emp. Wu of N. Zhou"],
    [569, "南朝陈太建", 1, "南朝陈宣帝", "Emp. Xuan of Chen"],
    [572, "北周建德", 1, "北周武帝", "Emp. Wu of N. Zhou"],
    [579, "北周大象", 1, "北周静帝", "Emp. Jing of N. Zhou"],
    [581, "隋开皇", 1, "隋文帝", "Emp. Wen"],
    [601, "隋仁寿", 1, "隋文帝", "Emp. Wen"],
    [605, "隋大业", 1, "隋炀帝", "Emp. Yang"],
    [617, "隋义宁", 1, "隋恭帝", "Emp. Gong"],
    [618, "唐武德", 1, "唐高祖", "Emp. Gaozu"],
    [627, "唐贞观", 1, "唐太宗", "Emp. Taizong"],
    [650, "唐永徽", 1, "唐高宗", "Emp. Gaozong"],
    [656, "唐显庆", 1, "唐高宗", "Emp. Gaozong"],
    [661, "唐龙朔", 1, "唐高宗", "Emp. Gaozong"],
    [664, "唐麟德", 1, "唐高宗", "Emp. Gaozong"],
    [666, "唐乾封", 1, "唐高宗", "Emp. Gaozong"],
    [668, "唐总章", 1, "唐高宗", "Emp. Gaozong"],
    [670, "唐咸亨", 1, "唐高宗", "Emp. Gaozong"],
    [674, "唐上元", 1, "唐高宗", "Emp. Gaozong"],
    [676, "唐仪凤", 1, "唐高宗", "Emp. Gaozong"],
    [679, "唐调露", 1, "唐高宗", "Emp. Gaozong"],
    [680, "唐永隆", 1, "唐高宗", "Emp. Gaozong"],
    [681, "唐开耀", 1, "唐高宗", "Emp. Gaozong"],
    [682, "唐永淳", 1, "唐高宗", "Emp. Gaozong"],
    [683, "唐弘道", 1, "唐高宗", "Emp. Gaozong"],
    [684, "唐嗣圣", 1, "唐中宗", "Emp. Zhongzong"],
    [685, "唐垂拱", 1, "唐睿宗", "Emp. Ruizong"],
    [689, "唐永昌", 1, "唐睿宗", "Emp. Ruizong"],
    [690, "武周天授", 1, "武周武则天", "Wu Zetian"],
    [692, "武周长寿", 1, "武周武则天", "Wu Zetian"],
    [694, "武周延载", 1, "武周武则天", "Wu Zetian"],
    [695, "武周天册万岁", 1, "武周武则天", "Wu Zetian"],
    [696, "武周万岁通天", 1, "武周武则天", "Wu Zetian"],
    [697, "武周神功", 1, "武周武则天", "Wu Zetian"],
    [698, "武周圣历", 1, "武周武则天", "Wu Zetian"],
    [700, "武周久视", 1, "武周武则天", "Wu Zetian"],
    [701, "武周长安", 1, "武周武则天", "Wu Zetian"],
    [705, "唐神龙", 1, "唐中宗", "Emp. Zhongzong"],
    [707, "唐景龙", 1, "唐中宗", "Emp. Zhongzong"],
    [710, "唐景云", 1, "唐睿宗", "Emp. Ruizong"],
    [712, "唐太极", 1, "唐睿宗", "Emp. Ruizong"],
    [713, "唐开元", 1, "唐玄宗", "Emp. Xuanzong"],
    [742, "唐天宝", 1, "唐玄宗", "Emp. Xuanzong"],
    [756, "唐至德", 1, "唐肃宗", "Emp. Suzong"],
    [758, "唐乾元", 1, "唐肃宗", "Emp. Suzong"],
    [760, "唐上元", 1, "唐肃宗", "Emp. Suzong"],
    [762, "唐宝应", 1, "唐肃宗", "Emp. Suzong"],
    [763, "唐广德", 1, "唐代宗", "Emp. Daizong"],
    [765, "唐永泰", 1, "唐代宗", "Emp. Daizong"],
    [766, "唐大历", 1, "唐代宗", "Emp. Daizong"],
    [780, "唐建中", 1, "唐德宗", "Emp. Dezong"],
    [784, "唐兴元", 1, "唐德宗", "Emp. Dezong"],
    [785, "唐贞元", 1, "唐德宗", "Emp. Dezong"],
    [805, "唐永贞", 1, "唐顺宗", "Emp. Shunzong"],
    [806, "唐元和", 1, "唐宪宗", "Emp. Xianzong"],
    [821, "唐长庆", 1, "唐穆宗", "Emp. Muzong"],
    [825, "唐宝历", 1, "唐敬宗", "Emp. Jingzong"],
    [827, "唐大和", 1, "唐文宗", "Emp. Wenzong"],
    [836, "唐开成", 1, "唐文宗", "Emp. Wenzong"],
    [841, "唐会昌", 1, "唐武宗", "Emp. Wuzong"],
    [847, "唐大中", 1, "唐宣宗", "Emp. Xuanzong (Xuan)"],
    [860, "唐咸通", 1, "唐懿宗", "Emp. Yizong"],
    [874, "唐乾符", 1, "唐僖宗", "Emp. Xizong"],
    [880, "唐广明", 1, "唐僖宗", "Emp. Xizong"],
    [881, "唐中和", 1, "唐僖宗", "Emp. Xizong"],
    [885, "唐光启", 1, "唐僖宗", "Emp. Xizong"],
    [888, "唐文德", 1, "唐僖宗", "Emp. Xizong"],
    [889, "唐龙纪", 1, "唐昭宗", "Emp. Zhaozong"],
    [890, "唐大顺", 1, "唐昭宗", "Emp. Zhaozong"],
    [892, "唐景福", 1, "唐昭宗", "Emp. Zhaozong"],
    [894, "唐乾宁", 1, "唐昭宗", "Emp. Zhaozong"],
    [898, "唐光化", 1, "唐昭宗", "Emp. Zhaozong"],
    [901, "唐天复", 1, "唐昭宗", "Emp. Zhaozong"],
    [904, "唐天祐", 1, "唐哀帝", "Emp. Ai"],
    [907, "后梁开平", 1, "后梁太祖", "Emp. Taizu of Later Liang"],
    [911, "后梁乾化", 1, "后梁太祖", "Emp. Taizu of Later Liang"],
    [915, "后梁贞明", 1, "后梁末帝", "Modi of Later Liang"],
    [921, "后梁龙德", 1, "后梁末帝", "Modi of Later Liang"],
    [923, "后唐同光", 1, "后唐庄宗", "Emp. Zhuangzong of Later Tang"],
    [926, "后唐天成", 1, "后唐明宗", "Emp. Mingzong of Later Tang"],
    [930, "后唐长兴", 1, "后唐明宗", "Emp. Mingzong of Later Tang"],
    [934, "后唐清泰", 1, "后唐末帝", "Modi of Later Tang"],
    [936, "后晋天福", 1, "后晋高祖", "Emp. Gaozu of Later Jin"],
    [944, "后晋开运", 1, "后晋出帝", "Chudi of Later Jin"],
    [947, "后汉天福", 12, "后汉高祖", "Emp. Gaozu of Later Han"],
    [948, "后汉乾祐", 1, "后汉隐帝", "Yindi of Later Han"],
    [951, "后周广顺", 1, "后周太祖", "Emp. Taizu of Later Zhou"],
    [954, "后周显德", 1, "后周世宗", "Emp. Shizong of Later Zhou"],
    [960, "北宋建隆", 1, "北宋太祖", "Emp. Taizu"],
    [963, "北宋乾德", 1, "北宋太祖", "Emp. Taizu"],
    [968, "北宋开宝", 1, "北宋太祖", "Emp. Taizu"],
    [976, "北宋太平兴国", 1, "北宋太宗", "Emp. Taizong"],
    [984, "北宋雍熙", 1, "北宋太宗", "Emp. Taizong"],
    [988, "北宋端拱", 1, "北宋太宗", "Emp. Taizong"],
    [990, "北宋淳化", 1, "北宋太宗", "Emp. Taizong"],
    [995, "北宋至道", 1, "北宋太宗", "Emp. Taizong"],
    [998, "北宋咸平", 1, "北宋真宗", "Emp. Zhenzong"],
    [1004, "北宋景德", 1, "北宋真宗", "Emp. Zhenzong"],
    [1008, "北宋大中祥符", 1, "北宋真宗", "Emp. Zhenzong"],
    [1017, "北宋天禧", 1, "北宋真宗", "Emp. Zhenzong"],
    [1022, "北宋乾兴", 1, "北宋真宗", "Emp. Zhenzong"],
    [1023, "北宋天圣", 1, "北宋仁宗", "Emp. Renzong"],
    [1032, "北宋明道", 1, "北宋仁宗", "Emp. Renzong"],
    [1034, "北宋景祐", 1, "北宋仁宗", "Emp. Renzong"],
    [1038, "北宋宝元", 1, "北宋仁宗", "Emp. Renzong"],
    [1040, "北宋康定", 1, "北宋仁宗", "Emp. Renzong"],
    [1041, "北宋庆历", 1, "北宋仁宗", "Emp. Renzong"],
    [1049, "北宋皇祐", 1, "北宋仁宗", "Emp. Renzong"],
    [1054, "北宋至和", 1, "北宋仁宗", "Emp. Renzong"],
    [1056, "北宋嘉祐", 1, "北宋仁宗", "Emp. Renzong"],
    [1064, "北宋治平", 1, "北宋英宗", "Emp. Yingzong"],
    [1068, "北宋熙宁", 1, "北宋神宗", "Emp. Shenzong"],
    [1078, "北宋元丰", 1, "北宋神宗", "Emp. Shenzong"],
    [1086, "北宋元祐", 1, "北宋哲宗", "Emp. Zhezong"],
    [1094, "北宋绍圣", 1, "北宋哲宗", "Emp. Zhezong"],
    [1098, "北宋元符", 1, "北宋哲宗", "Emp. Zhezong"],
    [1101, "北宋建中靖国", 1, "北宋徽宗", "Emp. Huizong"],
    [1102, "北宋崇宁", 1, "北宋徽宗", "Emp. Huizong"],
    [1107, "北宋大观", 1, "北宋徽宗", "Emp. Huizong"],
    [1111, "北宋政和", 1, "北宋徽宗", "Emp. Huizong"],
    [1118, "北宋重和", 1, "北宋徽宗", "Emp. Huizong"],
    [1119, "北宋宣和", 1, "北宋徽宗", "Emp. Huizong"],
    [1126, "北宋靖康", 1, "北宋钦宗", "Emp. Qinzong"],
    [1127, "南宋建炎", 1, "南宋高宗", "Emp. Gaozong"],
    [1131, "南宋绍兴", 1, "南宋高宗", "Emp. Gaozong"],
    [1163, "南宋隆兴", 1, "南宋孝宗", "Emp. Xiaozong"],
    [1165, "南宋乾道", 1, "南宋孝宗", "Emp. Xiaozong"],
    [1174, "南宋淳熙", 1, "南宋孝宗", "Emp. Xiaozong"],
    [1190, "南宋绍熙", 1, "南宋光宗", "Emp. Guangzong"],
    [1195, "南宋庆元", 1, "南宋宁宗", "Emp. Ningzong"],
    [1201, "南宋嘉泰", 1, "南宋宁宗", "Emp. Ningzong"],
    [1205, "南宋开禧", 1, "南宋宁宗", "Emp. Ningzong"],
    [1208, "南宋嘉定", 1, "南宋宁宗", "Emp. Ningzong"],
    [1225, "南宋宝庆", 1, "南宋理宗", "Emp. Lizong"],
    [1228, "南宋绍定", 1, "南宋理宗", "Emp. Lizong"],
    [1234, "南宋端平", 1, "南宋理宗", "Emp. Lizong"],
    [1237, "南宋嘉熙", 1, "南宋理宗", "Emp. Lizong"],
    [1241, "南宋淳祐", 1, "南宋理宗", "Emp. Lizong"],
    [1253, "南宋宝祐", 1, "南宋理宗", "Emp. Lizong"],
    [1259, "南宋开庆", 1, "南宋理宗", "Emp. Lizong"],
    [1260, "南宋景定", 1, "南宋理宗", "Emp. Lizong"],
    [1265, "南宋咸淳", 1, "南宋度宗", "Emp. Duzong"],
    [1275, "南宋德祐", 1, "南宋恭帝", "Emp. Gong"],
    [1276, "南宋景炎", 1, "南宋端宗", "Emp. Duanzong"],
    [1278, "南宋祥兴", 1, "南宋少帝", "Zhao Bing"],
    [1279, "元至元", 16, "元世祖", "Kublai Khan (Shizu)"],
    [1295, "元元贞", 1, "元成宗", "Emp. Chengzong"],
    [1297, "元大德", 1, "元成宗", "Emp. Chengzong"],
    [1308, "元至大", 1, "元武宗", "Emp. Wuzong"],
    [1312, "元皇庆", 1, "元仁宗", "Emp. Renzong"],
    [1314, "元延祐", 1, "元仁宗", "Emp. Renzong"],
    [1321, "元至治", 1, "元英宗", "Emp. Yingzong"],
    [1324, "元泰定", 1, "元泰定帝", "Taiding Emp."],
    [1328, "元天历", 1, "元文宗", "Emp. Wenzong"],
    [1330, "元至顺", 1, "元文宗", "Emp. Wenzong"],
    [1333, "元元统", 1, "元顺帝", "Emp. Huizong (Shundi)"],
    [1335, "元至元", 1, "元顺帝", "Emp. Huizong (Shundi)"],
    [1341, "元至正", 1, "元顺帝", "Emp. Huizong (Shundi)"],
    [1368, "明洪武", 1, "明太祖", "Hongwu Emp. (Taizu)"],
    [1399, "明建文", 1, "明惠帝", "Jianwen Emp. (Huidi)"],
    [1403, "明永乐", 1, "明成祖", "Yongle Emp. (Chengzu)"],
    [1425, "明洪熙", 1, "明仁宗", "Hongxi Emp. (Renzong)"],
    [1426, "明宣德", 1, "明宣宗", "Xuande Emp. (Xuanzong)"],
    [1436, "明正统", 1, "明英宗", "Zhengtong Emp. (Yingzong)"],
    [1450, "明景泰", 1, "明代宗", "Jingtai Emp. (Daizong)"],
    [1457, "明天顺", 1, "明英宗", "Tianshun Emp. (Yingzong)"],
    [1465, "明成化", 1, "明宪宗", "Chenghua Emp. (Xianzong)"],
    [1488, "明弘治", 1, "明孝宗", "Hongzhi Emp. (Xiaozong)"],
    [1506, "明正德", 1, "明武宗", "Zhengde Emp. (Wuzong)"],
    [1522, "明嘉靖", 1, "明世宗", "Jiajing Emp. (Shizong)"],
    [1567, "明隆庆", 1, "明穆宗", "Longqing Emp. (Muzong)"],
    [1573, "明万历", 1, "明神宗", "Wanli Emp. (Shenzong)"],
    [1620, "明泰昌", 1, "明光宗", "Taichang Emp. (Guangzong)"],
    [1621, "明天启", 1, "明熹宗", "Tianqi Emp. (Xizong)"],
    [1628, "明崇祯", 1, "明思宗", "Chongzhen Emp. (Sizong)"],
    [1644, "清顺治", 1, "清世祖", "Shunzhi Emp. (Shizu)"],
    [1662, "清康熙", 1, "清圣祖", "Kangxi Emp. (Shengzu)"],
    [1723, "清雍正", 1, "清世宗", "Yongzheng Emp. (Shizong)"],
    [1736, "清乾隆", 1, "清高宗", "Qianlong Emp. (Gaozong)"],
    [1796, "清嘉庆", 1, "清仁宗", "Jiaqing Emp. (Renzong)"],
    [1821, "清道光", 1, "清宣宗", "Daoguang Emp. (Xuanzong)"],
    [1851, "清咸丰", 1, "清文宗", "Xianfeng Emp. (Wenzong)"],
    [1862, "清同治", 1, "清穆宗", "Tongzhi Emp. (Muzong)"],
    [1875, "清光绪", 1, "清德宗", "Guangxu Emp. (Dezong)"],
    [1909, "清宣统", 1, "清逊帝", "Xuantong Emp. (Puyi)"],
    [1912, "民国", 1]
  ],
  "PLACE_LANDMARK_EVENTS": [
    {
      "dynastyKey": "zhanguo",
      "year": -350,
      "coord": [
        108.71,
        34.33
      ],
      "site": "咸阳",
      "siteEn": "Xianyang",
      "zh": "秦孝公与商鞅自栎阳迁都咸阳，废井田、设县制、统一度量衡",
      "en": "Duke Xiao of Qin and Shang Yang move the capital to Xianyang and launch the Second Reform"
    },
    {
      "dynastyKey": "qin",
      "year": -221,
      "coord": [
        108.71,
        34.33
      ],
      "site": "咸阳",
      "siteEn": "Xianyang",
      "zh": "秦始皇统一六国定都咸阳，收天下兵器铸十二金人",
      "en": "Qin Shi Huang unifies China with Xianyang as imperial capital"
    },
    {
      "dynastyKey": "qin",
      "year": -206,
      "coord": [
        109.21,
        34.37
      ],
      "site": "咸阳·鸿门",
      "siteEn": "Xianyang / Hongmen",
      "zh": "刘邦入关破咸阳约法三章；项羽于鸿门设宴",
      "en": "Liu Bang enters Xianyang; Xiang Yu hosts the Feast at Hongmen"
    },
    {
      "dynastyKey": "xihan",
      "year": -200,
      "coord": [
        108.94,
        34.26
      ],
      "site": "长安",
      "siteEn": "Chang'an",
      "zh": "萧何营建未央宫成，汉高祖自栎阳正式定都长安",
      "en": "Xiao He completes Weiyang Palace; Chang'an becomes Western Han capital"
    },
    {
      "dynastyKey": "xihan",
      "year": -91,
      "coord": [
        108.94,
        34.26
      ],
      "site": "长安",
      "siteEn": "Chang'an",
      "zh": "巫蛊之祸：江充构陷太子刘据，长安激战五日太子兵败自尽",
      "en": "Witchcraft Crisis (Wugu Affair) in Chang’an drives Crown Prince Liu Ju to rebellion and suicide"
    },
    {
      "dynastyKey": "xihan",
      "year": -74,
      "coord": [
        108.94,
        34.26
      ],
      "site": "长安",
      "siteEn": "Chang'an",
      "zh": "大将军霍光于未央宫奏废昌邑王刘贺，迎立汉宣帝开启昭宣中兴",
      "en": "Regent Huo Guang deposes Liu He at Weiyang Palace and enthrones Emperor Xuan of Han"
    },
    {
      "dynastyKey": "xihan",
      "year": 8,
      "coord": [
        108.94,
        34.26
      ],
      "site": "长安",
      "siteEn": "Chang'an",
      "zh": "王莽于长安篡汉建立新朝，推行王田私属改制",
      "en": "Wang Mang usurps the Han throne in Chang'an and founds the Xin Dynasty"
    },
    {
      "dynastyKey": "donghan",
      "year": 190,
      "coord": [
        108.94,
        34.26
      ],
      "site": "长安",
      "siteEn": "Chang'an",
      "zh": "董卓焚洛阳挟汉献帝西迁长安",
      "en": "Dong Zhuo forcibly relocates Emperor Xian to Chang'an"
    },
    {
      "dynastyKey": "sanguo",
      "year": 228,
      "coord": [
        108.94,
        34.26
      ],
      "site": "长安",
      "siteEn": "Chang'an",
      "zh": "诸葛亮首次北伐出祁山震动关中，魏明帝亲镇长安督师",
      "en": "Zhuge Liang launches his First Northern Expedition; Emperor Ming of Wei defends from Chang’an"
    },
    {
      "dynastyKey": "xijin",
      "year": 316,
      "coord": [
        108.94,
        34.26
      ],
      "site": "长安",
      "siteEn": "Chang'an",
      "zh": "刘曜攻陷长安，晋愍帝出降，西晋灭亡",
      "en": "Liu Yao captures Chang'an; Emperor Min surrenders, ending the Western Jin"
    },
    {
      "dynastyKey": "dongjin",
      "year": 351,
      "coord": [
        108.94,
        34.26
      ],
      "site": "长安",
      "siteEn": "Chang'an",
      "zh": "前秦定都长安，苻坚、王猛励精图治统一北方",
      "en": "Former Qin governs from Chang'an and unifies northern China under Fu Jian and Wang Meng"
    },
    {
      "dynastyKey": "nanbei",
      "year": 534,
      "coord": [
        108.94,
        34.26
      ],
      "site": "长安",
      "siteEn": "Chang'an",
      "zh": "宇文泰于长安立西魏，开创关陇集团与北周基业",
      "en": "Yuwen Tai establishes Western Wei at Chang'an, laying the foundation for Sui and Tang"
    },
    {
      "dynastyKey": "sui",
      "year": 582,
      "coord": [
        108.94,
        34.26
      ],
      "site": "大兴（长安）",
      "siteEn": "Daxing (Chang'an)",
      "zh": "隋文帝诏宇文恺于龙首原南营建大兴城（唐长安前身）",
      "en": "Emperor Wen of Sui commissions Yuwen Kai to build Daxing City (Tang Chang'an)"
    },
    {
      "dynastyKey": "tang",
      "year": 618,
      "coord": [
        108.94,
        34.26
      ],
      "site": "长安",
      "siteEn": "Chang'an",
      "zh": "李渊于长安太极殿称帝建唐，改大兴为长安",
      "en": "Li Yuan proclaims the Tang Dynasty at Taiji Palace in Chang'an"
    },
    {
      "dynastyKey": "tang",
      "year": 626,
      "coord": [
        108.94,
        34.26
      ],
      "site": "长安",
      "siteEn": "Chang'an",
      "zh": "玄武门之变，李世民即位为唐太宗，次年改元贞观",
      "en": "Xuanwu Gate Incident in Chang'an; Li Shimin ascends as Emperor Taizong"
    },
    {
      "dynastyKey": "tang",
      "year": 756,
      "coord": [
        114.57,
        38.14
      ],
      "site": "常山（真定）",
      "siteEn": "Changshan (Zhengding)",
      "zh": "颜杲卿、颜真卿举河北十七郡抗燕；常山陷落颜氏殉国，《祭侄文稿》所哀",
      "en": "Yan Gaoqing and Yan Zhenqing raise 17 Hebei commanderies; Changshan falls, the Yan clan dies"
    },
    {
      "dynastyKey": "tang",
      "year": 757,
      "coord": [
        115.65,
        34.41
      ],
      "site": "睢阳（商丘）",
      "siteEn": "Suiyang (Shangqiu)",
      "zh": "睢阳之战：张巡、许远数千人死守十月，屏障江淮财赋，城破殉国",
      "en": "Siege of Suiyang: Zhang Xun and Xu Yuan hold out ten months, shielding the Jianghuai tax base"
    },
    {
      "dynastyKey": "tang",
      "year": 759,
      "coord": [
        114.35,
        36.32
      ],
      "site": "邺城（相州）",
      "siteEn": "Yecheng (Xiangzhou)",
      "zh": "邺城之战：九节度围安庆绪，史思明来援唐军溃散，遂杀安庆绪称帝再陷洛阳",
      "en": "Battle of Yecheng: Shi Siming routs nine Tang governors, kills An Qingxu, takes the Yan throne"
    },
    {
      "dynastyKey": "tang",
      "year": 710,
      "coord": [
        108.94,
        34.26
      ],
      "site": "长安",
      "siteEn": "Chang'an",
      "zh": "唐隆政变李隆基诛韦后；713年发动先天政变开启开元盛世",
      "en": "Tanglong (710) and Xiantian (713) Coups: Li Longji eliminates Empress Wei and Princess Taiping"
    },
    {
      "dynastyKey": "tang",
      "year": 756,
      "coord": [
        108.94,
        34.26
      ],
      "site": "长安",
      "siteEn": "Chang'an",
      "zh": "安史叛军破潼关陷长安，玄宗奔蜀；次年郭子仪收复西京",
      "en": "An Lushan rebels capture Chang’an, sparking the Mawei Mutiny; Guo Ziyi retakes it in 757"
    },
    {
      "dynastyKey": "tang",
      "year": 835,
      "coord": [
        108.94,
        34.26
      ],
      "site": "长安",
      "siteEn": "Chang'an",
      "zh": "甘露之变：唐文宗与李训谋诛宦官事败，神策军血洗大明宫",
      "en": "Sweet Dew Incident in Daming Palace: failed plot against Qiu Shiliang leads to court purge"
    },
    {
      "dynastyKey": "tang",
      "year": 881,
      "coord": [
        108.94,
        34.26
      ],
      "site": "长安",
      "siteEn": "Chang'an",
      "zh": "黄巢起义军攻占长安称齐帝，唐僖宗奔蜀",
      "en": "Huang Chao captures Chang'an and proclaims the Qi regime"
    },
    {
      "dynastyKey": "ming",
      "year": 1369,
      "coord": [
        108.94,
        34.26
      ],
      "site": "西安府",
      "siteEn": "Xi'an",
      "zh": "徐达克奉元路，明廷改置西安府，始定“西安”之名",
      "en": "Ming general Xu Da captures Fengyuan and renames the prefecture Xi'an"
    },
    {
      "dynastyKey": "ming",
      "year": 1643,
      "coord": [
        108.94,
        34.26
      ],
      "site": "西安",
      "siteEn": "Xi'an",
      "zh": "李自成攻克西安，次年正月于西安建国号大顺",
      "en": "Li Zicheng captures Xi'an and proclaims the Dashun Dynasty"
    },
    {
      "dynastyKey": "roc",
      "year": 1936,
      "coord": [
        108.94,
        34.26
      ],
      "site": "西安",
      "siteEn": "Xi'an",
      "zh": "张学良、杨虎城发动西安事变，促成抗日民族统一战线",
      "en": "Xi'an Incident sparks the Second United Front against Japanese aggression"
    },
    {
      "dynastyKey": "zhanguo",
      "year": -403,
      "coord": [
        112.45,
        34.62
      ],
      "site": "洛邑（洛阳）",
      "siteEn": "Luoyi (Luoyang)",
      "zh": "周威烈王于洛邑初命晋大夫魏斯、赵籍、韩虔为诸侯（三家分晋）",
      "en": "King Weilie of Zhou formally recognizes Wei, Zhao, and Han as marquises at Luoyi"
    },
    {
      "dynastyKey": "donghan",
      "year": 25,
      "coord": [
        112.45,
        34.62
      ],
      "site": "洛阳",
      "siteEn": "Luoyang",
      "zh": "刘秀建立东汉定都洛阳，开启光武中兴",
      "en": "Liu Xiu establishes the Eastern Han with Luoyang as imperial capital"
    },
    {
      "dynastyKey": "donghan",
      "year": 68,
      "coord": [
        112.45,
        34.62
      ],
      "site": "洛阳",
      "siteEn": "Luoyang",
      "zh": "汉明帝于洛阳创建白马寺，为中国第一古刹",
      "en": "Emperor Ming of Han establishes White Horse Temple in Luoyang"
    },
    {
      "dynastyKey": "donghan",
      "year": 92,
      "coord": [
        112.45,
        34.62
      ],
      "site": "洛阳",
      "siteEn": "Luoyang",
      "zh": "永元之隆：汉和帝于洛阳诛除大将军窦宪外戚集团，东汉达极盛",
      "en": "Prosperity of Yongyuan: Emperor He overthrows Dou Xian’s clan in Luoyang, reaching Han zenith"
    },
    {
      "dynastyKey": "sanguo",
      "year": 220,
      "coord": [
        112.45,
        34.62
      ],
      "site": "洛阳",
      "siteEn": "Luoyang",
      "zh": "曹丕代汉称帝建立曹魏，定都洛阳",
      "en": "Cao Pi founds Cao Wei with Luoyang as capital"
    },
    {
      "dynastyKey": "sanguo",
      "year": 260,
      "coord": [
        112.45,
        34.62
      ],
      "site": "洛阳",
      "siteEn": "Luoyang",
      "zh": "甘露之变：魏帝曹髦率宿卫讨司马昭，于洛阳南阙下遇弑",
      "en": "Coup of Ganlu: Wei Emperor Cao Mao marches against Sima Zhao and is slain in Luoyang"
    },
    {
      "dynastyKey": "sanguo",
      "year": 265,
      "coord": [
        112.45,
        34.62
      ],
      "site": "洛阳",
      "siteEn": "Luoyang",
      "zh": "司马炎代魏建立西晋定都洛阳，280年灭吴一统",
      "en": "Sima Yan founds the Western Jin in Luoyang and reunifies China in 280"
    },
    {
      "dynastyKey": "xijin",
      "year": 311,
      "coord": [
        112.45,
        34.62
      ],
      "site": "洛阳",
      "siteEn": "Luoyang",
      "zh": "永嘉之乱：汉赵攻陷洛阳掳晋怀帝，衣冠南渡",
      "en": "Disaster of Yongjia: sack of Luoyang triggers the southward migration"
    },
    {
      "dynastyKey": "nanbei",
      "year": 493,
      "coord": [
        112.45,
        34.62
      ],
      "site": "洛阳",
      "siteEn": "Luoyang",
      "zh": "北魏孝文帝自平城迁都洛阳，推行汉化并开凿龙门石窟",
      "en": "Emperor Xiaowen of Northern Wei moves the capital to Luoyang and initiates Longmen Grottoes"
    },
    {
      "dynastyKey": "sui",
      "year": 605,
      "coord": [
        112.45,
        34.62
      ],
      "site": "东都洛阳",
      "siteEn": "Luoyang",
      "zh": "隋炀帝营建东都洛阳，以洛阳为中心开凿通济渠与永济渠",
      "en": "Emperor Yang of Sui builds the Eastern Capital Luoyang and launches the Grand Canal"
    },
    {
      "dynastyKey": "tang",
      "year": 690,
      "coord": [
        112.45,
        34.62
      ],
      "site": "神都洛阳",
      "siteEn": "Luoyang",
      "zh": "武则天改唐为周，定都神都洛阳",
      "en": "Wu Zetian proclaims the Zhou Dynasty with Luoyang as the Divine Capital"
    },
    {
      "dynastyKey": "wudai",
      "year": 923,
      "coord": [
        112.45,
        34.62
      ],
      "site": "洛阳",
      "siteEn": "Luoyang",
      "zh": "李存勖灭后梁建立后唐，定都洛阳",
      "en": "Li Cunxu founds Later Tang with Luoyang as imperial capital"
    },
    {
      "dynastyKey": "sanguo",
      "year": 229,
      "coord": [
        118.78,
        32.06
      ],
      "site": "建业",
      "siteEn": "Jianye (Nanjing)",
      "zh": "孙权自武昌迁都建业（今南京），正式称帝建立东吴",
      "en": "Sun Quan moves his capital to Jianye (Nanjing) and proclaims the Eastern Wu Empire"
    },
    {
      "dynastyKey": "xijin",
      "year": 280,
      "coord": [
        118.78,
        32.06
      ],
      "site": "建业",
      "siteEn": "Jianye (Nanjing)",
      "zh": "晋将王濬楼船下益州直抵建业，孙皓出降，三国归晋",
      "en": "Jin naval forces under Wang Jun capture Jianye, ending the Three Kingdoms"
    },
    {
      "dynastyKey": "wudai",
      "year": 926,
      "coord": [
        112.45,
        34.62
      ],
      "site": "洛阳",
      "siteEn": "Luoyang",
      "zh": "兴教门之变：郭从谦洛阳兵变弑后唐庄宗，李嗣源入洛即位",
      "en": "Xingjiao Gate Incident in Luoyang: Emperor Zhuangzong falls in mutiny and Li Siyuan ascends"
    },
    {
      "dynastyKey": "dongjin",
      "year": 317,
      "coord": [
        118.78,
        32.06
      ],
      "site": "建康",
      "siteEn": "Jiankang (Nanjing)",
      "zh": "司马睿渡江于建康建立东晋，开启六朝古都繁华",
      "en": "Sima Rui establishes the Eastern Jin in Jiankang (Nanjing)"
    },
    {
      "dynastyKey": "dongjin",
      "year": 322,
      "coord": [
        118.78,
        32.06
      ],
      "site": "建康",
      "siteEn": "Jiankang (Nanjing)",
      "zh": "王敦之乱：王敦自武昌顺江东下攻入建康，控制东晋朝政",
      "en": "Rebellion of Wang Dun: Wang Dun marches from Wuchang into Jiankang to control the Jin court"
    },
    {
      "dynastyKey": "dongjin",
      "year": 404,
      "coord": [
        118.78,
        32.06
      ],
      "site": "建康·京口",
      "siteEn": "Jiankang / Jingkou",
      "zh": "北府将刘裕自京口起兵克建康，讨平桓玄，开启北府兵掌权",
      "en": "Northern Garrison general Liu Yu rises at Jingkou, retakes Jiankang, and crushes Huan Xuan"
    },
    {
      "dynastyKey": "nanbei",
      "year": 420,
      "coord": [
        118.78,
        32.06
      ],
      "site": "建康",
      "siteEn": "Jiankang (Nanjing)",
      "zh": "刘裕代晋建宋，南朝宋齐梁陈四代皆都建康",
      "en": "Liu Yu founds Liu Song; Jiankang serves as capital of all four Southern Dynasties"
    },
    {
      "dynastyKey": "sui",
      "year": 589,
      "coord": [
        118.78,
        32.06
      ],
      "site": "建康",
      "siteEn": "Jiankang (Nanjing)",
      "zh": "隋军韩擒虎渡江克建康灭陈，结束近三百年南北分裂",
      "en": "Sui forces cross the Yangtze and capture Jiankang, reunifying China"
    },
    {
      "dynastyKey": "wudai",
      "year": 937,
      "coord": [
        118.78,
        32.06
      ],
      "site": "金陵",
      "siteEn": "Jinling (Nanjing)",
      "zh": "李昪于金陵建立南唐，词章书画冠绝十国",
      "en": "Li Bian founds Southern Tang in Jinling, cultural heart of the Ten Kingdoms"
    },
    {
      "dynastyKey": "nansong",
      "year": 1129,
      "coord": [
        118.78,
        32.06
      ],
      "site": "建康府",
      "siteEn": "Jiankang (Nanjing)",
      "zh": "南宋改江宁为建康府，为留都与长江防线核心枢要",
      "en": "Jiankang serves as auxiliary capital and Yangtze defense hub of Southern Song"
    },
    {
      "dynastyKey": "ming",
      "year": 1368,
      "coord": [
        118.78,
        32.06
      ],
      "site": "应天府",
      "siteEn": "Yingtian (Nanjing)",
      "zh": "朱元璋于应天府（南京）称帝建立明朝",
      "en": "Zhu Yuanzhang proclaims the Ming Dynasty in Yingtian (Nanjing)"
    },
    {
      "dynastyKey": "ming",
      "year": 1402,
      "coord": [
        118.78,
        32.06
      ],
      "site": "应天府",
      "siteEn": "Nanjing",
      "zh": "靖难之役：燕王朱棣攻克南京，即位为明成祖",
      "en": "Jingnan Campaign: Zhu Di captures Nanjing and ascends as the Yongle Emperor"
    },
    {
      "dynastyKey": "qing",
      "year": 1842,
      "coord": [
        118.78,
        32.06
      ],
      "site": "江宁（南京）",
      "siteEn": "Nanjing",
      "zh": "第一次鸦片战争清廷战败，于南京下关江面签署《南京条约》",
      "en": "Treaty of Nanjing signed after the First Opium War"
    },
    {
      "dynastyKey": "qing",
      "year": 1853,
      "coord": [
        118.78,
        32.06
      ],
      "site": "江宁（天京）",
      "siteEn": "Nanjing",
      "zh": "太平天国攻占江宁，改名天京并定都十一年",
      "en": "Taiping Heavenly Kingdom captures Jiangning and makes it its capital Tianjing"
    },
    {
      "dynastyKey": "qing",
      "year": 1861,
      "coord": [
        117.06,
        30.54
      ],
      "site": "安庆府",
      "siteEn": "Anqing",
      "zh": "安庆之战：曾国荃湘军合围两年攻克安庆，天京门户洞开",
      "en": "Siege of Anqing: Zeng Guoquan’s Xiang Army captures Anqing, opening the approach to Tianjing"
    },
    {
      "dynastyKey": "qing",
      "year": 1864,
      "coord": [
        118.78,
        32.06
      ],
      "site": "天京（江宁）",
      "siteEn": "Tianjing (Nanjing)",
      "zh": "曾国藩、曾国荃率湘军轰塌城墙攻陷天京，太平天国运动覆灭",
      "en": "Xiang Army under Zeng Guofan and Zeng Guoquan breaches Tianjing, ending the Taiping Kingdom"
    },
    {
      "dynastyKey": "roc",
      "year": 1912,
      "coord": [
        118.78,
        32.06
      ],
      "site": "南京",
      "siteEn": "Nanjing",
      "zh": "孙中山于南京就任中华民国临时大总统，宣告共和",
      "en": "Sun Yat-sen inaugurated in Nanjing as Provisional President of the Republic of China"
    },
    {
      "dynastyKey": "zhanguo",
      "year": -226,
      "coord": [
        116.4,
        39.9
      ],
      "site": "蓟城",
      "siteEn": "Ji (Beijing)",
      "zh": "秦将王翦、王贲攻拔燕都蓟城，燕王喜走保辽东",
      "en": "Qin generals Wang Jian and Wang Ben capture the Yan capital Ji; King Xi flees to Liaodong"
    },
    {
      "dynastyKey": "tang",
      "year": 755,
      "coord": [
        116.4,
        39.9
      ],
      "site": "范阳（幽州）",
      "siteEn": "Fanyang (Beijing)",
      "zh": "安禄山于范阳（幽州）起兵反唐，安史之乱爆发",
      "en": "An Lushan launches his rebellion from Fanyang (Youzhou / Beijing)"
    },
    {
      "dynastyKey": "wudai",
      "year": 938,
      "coord": [
        116.4,
        39.9
      ],
      "site": "幽州（辽南京）",
      "siteEn": "Youzhou (Beijing)",
      "zh": "后晋割燕云十六州，辽升幽州为南京析津府（陪都）",
      "en": "Liao elevates Youzhou to its Southern Capital, Nanjing Xijin Fu"
    },
    {
      "dynastyKey": "nansong",
      "year": 1153,
      "coord": [
        116.4,
        39.9
      ],
      "site": "金中都",
      "siteEn": "Zhongdu (Beijing)",
      "zh": "金海陵王完颜亮迁都燕京，定名金中都大兴府，首开北京帝都史",
      "en": "Jin ruler Wanyan Liang moves the imperial capital to Yanjing, renaming it Zhongdu"
    },
    {
      "dynastyKey": "nansong",
      "year": 1215,
      "coord": [
        116.4,
        39.9
      ],
      "site": "金中都",
      "siteEn": "Zhongdu (Beijing)",
      "zh": "成吉思汗蒙古大军攻占金中都",
      "en": "Genghis Khan's Mongol forces capture Jin Zhongdu"
    },
    {
      "dynastyKey": "nansong",
      "year": 1272,
      "coord": [
        116.4,
        39.9
      ],
      "site": "大都",
      "siteEn": "Dadu (Beijing)",
      "zh": "忽必烈营建元大都成，定为元朝国都，积水潭万艘漕船云集",
      "en": "Kublai Khan establishes Dadu (Khanbaliq) as capital of the Yuan Dynasty"
    },
    {
      "dynastyKey": "ming",
      "year": 1421,
      "coord": [
        116.4,
        39.9
      ],
      "site": "京师（北京）",
      "siteEn": "Beijing",
      "zh": "明成祖朱棣建北京紫禁城成，正式自南京迁都北京",
      "en": "Yongle Emperor completes the Forbidden City and moves the Ming capital to Beijing"
    },
    {
      "dynastyKey": "ming",
      "year": 1449,
      "coord": [
        116.4,
        39.9
      ],
      "site": "北京",
      "siteEn": "Beijing",
      "zh": "土木堡之变后瓦剌逼近京师，于谦指挥北京保卫战获胜",
      "en": "Yu Qian leads the successful Defense of Beijing after the Tumu Crisis"
    },
    {
      "dynastyKey": "ming",
      "year": 1457,
      "coord": [
        116.4,
        39.9
      ],
      "site": "北京",
      "siteEn": "Beijing",
      "zh": "夺门之变：石亨、徐有贞迎明英宗自南宫复辟，于谦含冤遇害",
      "en": "Wresting the Gate Coup: Emperor Yingzong is restored from the Southern Palace; Yu Qian is slain"
    },
    {
      "dynastyKey": "ming",
      "year": 1542,
      "coord": [
        116.4,
        39.9
      ],
      "site": "北京",
      "siteEn": "Beijing",
      "zh": "壬寅宫变：杨金英等宫女于乾清宫谋缢嘉靖帝未遂，帝移居西苑",
      "en": "RenYin Palace Rebellion: palace women led by Yang Jinying attempt to strangle Emperor Jiajing"
    },
    {
      "dynastyKey": "qing",
      "year": 1861,
      "coord": [
        116.4,
        39.9
      ],
      "site": "北京",
      "siteEn": "Beijing",
      "zh": "辛酉政变：慈禧、慈安两宫太后联结恭亲王奕訢诛肃顺等八大臣",
      "en": "Xinyou Coup in Beijing: Cixi and Ci’an ally with Prince Gong to oust the Eight Regents"
    },
    {
      "dynastyKey": "qing",
      "year": 1898,
      "coord": [
        116.4,
        39.9
      ],
      "site": "北京",
      "siteEn": "Beijing",
      "zh": "戊戌政变：慈禧太后囚光绪帝于瀛台，于菜市口杀戊戌六君子",
      "en": "Wuxu Coup in Beijing: Empress Dowager Cixi confines Emperor Guangxu and executes Six Gentlemen"
    },
    {
      "dynastyKey": "beisong",
      "year": 976,
      "coord": [
        114.35,
        34.79
      ],
      "site": "东京开封府",
      "siteEn": "Dongjing (Kaifeng)",
      "zh": "斧声烛影：宋太祖与晋王赵光义夜饮万岁殿暴崩，宋太宗即位",
      "en": "Candlelight and Axe-Sound Mystery at Wansui Hall: Emperor Taizu dies and Taizong ascends"
    },
    {
      "dynastyKey": "nansong",
      "year": 1129,
      "coord": [
        120.15,
        30.28
      ],
      "site": "杭州（临安）",
      "siteEn": "Hangzhou (Lin'an)",
      "zh": "苗刘兵变：苗傅、刘正彦于杭州逼宋高宗禅位，韩世忠勤王复辟",
      "en": "Miao-Liu Mutiny in Hangzhou: Miao Fu and Liu Zhengyan briefly depose Gaozong before restoration"
    },
    {
      "dynastyKey": "nansong",
      "year": 1194,
      "coord": [
        120.15,
        30.28
      ],
      "site": "临安府",
      "siteEn": "Lin'an (Hangzhou)",
      "zh": "绍熙内禅：赵汝愚、韩侂胄奉太皇太后旨于临安迫光宗禅位宁宗",
      "en": "Shaoxi Abdication in Lin’an: Zhao Ruyu and Han Tuozhou compel Guangzong to yield to Ningzong"
    },
    {
      "dynastyKey": "ming",
      "year": 1644,
      "coord": [
        116.4,
        39.9
      ],
      "site": "北京",
      "siteEn": "Beijing",
      "zh": "李自成破北京崇祯自缢；旋即清军入关定都北京",
      "en": "Li Zicheng captures Beijing; Qing forces soon enter and make Beijing their capital"
    },
    {
      "dynastyKey": "qing",
      "year": 1860,
      "coord": [
        116.4,
        39.9
      ],
      "site": "北京",
      "siteEn": "Beijing",
      "zh": "第二次鸦片战争英法联军攻入北京，劫掠并焚毁圆明园",
      "en": "Anglo-French forces enter Beijing and burn the Old Summer Palace (Yuanmingyuan)"
    },
    {
      "dynastyKey": "roc",
      "year": 1919,
      "coord": [
        116.4,
        39.9
      ],
      "site": "北京",
      "siteEn": "Beijing",
      "zh": "北京爆发五四爱国运动，揭开新民主主义革命序幕",
      "en": "May Fourth Movement erupts in Beijing"
    },
    {
      "dynastyKey": "roc",
      "year": 1949,
      "coord": [
        116.4,
        39.9
      ],
      "site": "北平（北京）",
      "siteEn": "Beijing",
      "zh": "北平和平解放，同年10月1日于北京天安门宣告新中国成立",
      "en": "Peaceful liberation of Beiping; founding of the PRC proclaimed at Tiananmen"
    },
    {
      "dynastyKey": "zhanguo",
      "year": -364,
      "coord": [
        114.35,
        34.79
      ],
      "site": "大梁",
      "siteEn": "Daliang (Kaifeng)",
      "zh": "魏惠王自安邑迁都大梁，开凿鸿沟连接黄河与淮泗水系",
      "en": "King Hui of Wei moves his capital to Daliang and excavates the Honggou Canal"
    },
    {
      "dynastyKey": "zhanguo",
      "year": -225,
      "coord": [
        114.35,
        34.79
      ],
      "site": "大梁",
      "siteEn": "Daliang (Kaifeng)",
      "zh": "秦将王贲引黄河鸿沟水灌大梁城，魏王假降，魏亡",
      "en": "Qin general Wang Ben floods Daliang to conquer the state of Wei"
    },
    {
      "dynastyKey": "sui",
      "year": 605,
      "coord": [
        114.35,
        34.79
      ],
      "site": "汴州",
      "siteEn": "Bianzhou (Kaifeng)",
      "zh": "通济渠贯通洛阳经汴州入淮，汴州跃升为天下漕运咽喉",
      "en": "Grand Canal makes Bianzhou (Kaifeng) the premier north-south waterway hub"
    },
    {
      "dynastyKey": "wudai",
      "year": 907,
      "coord": [
        114.35,
        34.79
      ],
      "site": "东都开封府",
      "siteEn": "Kaifeng",
      "zh": "朱温篡唐建后梁定都开封；后晋、后汉、后周皆都于此",
      "en": "Zhu Wen founds Later Liang in Kaifeng; four of the Five Dynasties make it their capital"
    },
    {
      "dynastyKey": "beisong",
      "year": 960,
      "coord": [
        114.35,
        34.79
      ],
      "site": "东京开封府",
      "siteEn": "Dongjing (Kaifeng)",
      "zh": "赵匡胤陈桥兵变，于东京开封府建立北宋",
      "en": "Zhao Kuangyin founds the Northern Song Dynasty with Dongjing (Kaifeng) as capital"
    },
    {
      "dynastyKey": "beisong",
      "year": 1127,
      "coord": [
        114.35,
        34.79
      ],
      "site": "东京汴梁",
      "siteEn": "Bianjing (Kaifeng)",
      "zh": "靖康之变：金军攻陷汴京，掳徽钦二帝北去，北宋灭亡",
      "en": "Jingkang Incident: Jurchen Jin forces capture Kaifeng, ending the Northern Song"
    },
    {
      "dynastyKey": "nansong",
      "year": 1214,
      "coord": [
        114.35,
        34.79
      ],
      "site": "金南京（汴京）",
      "siteEn": "Bianjing (Kaifeng)",
      "zh": "金宣宗避蒙古兵锋，自中都南迁都城至汴京",
      "en": "Emperor Xuanzong of Jin relocates the Jurchen capital south to Bianjing"
    },
    {
      "dynastyKey": "ming",
      "year": 1642,
      "coord": [
        114.35,
        34.79
      ],
      "site": "开封府",
      "siteEn": "Kaifeng",
      "zh": "李自成三围开封，黄河决口灌城，古城尽没于泥沙",
      "en": "Yellow River dike breach during the 1642 Siege of Kaifeng submerges the city"
    },
    {
      "dynastyKey": "sui",
      "year": 610,
      "coord": [
        120.15,
        30.28
      ],
      "site": "余杭（杭州）",
      "siteEn": "Hangzhou",
      "zh": "隋炀帝开江南河自京口达杭州，贯通大运河最南端",
      "en": "Sui completes the Jiangnan Canal terminating at Hangzhou"
    },
    {
      "dynastyKey": "wudai",
      "year": 907,
      "coord": [
        120.15,
        30.28
      ],
      "site": "杭州（西府）",
      "siteEn": "Hangzhou",
      "zh": "钱镠建立吴越国定都杭州，筑捍海塘、浚西湖，保境安民",
      "en": "Qian Liu establishes the Wuyue Kingdom in Hangzhou and builds the Qiantang seawall"
    },
    {
      "dynastyKey": "nansong",
      "year": 1138,
      "coord": [
        120.15,
        30.28
      ],
      "site": "临安府",
      "siteEn": "Lin'an (Hangzhou)",
      "zh": "宋高宗正式定临安府（杭州）为南宋行在（都城）",
      "en": "Emperor Gaozong establishes Lin'an (Hangzhou) as capital of the Southern Song"
    },
    {
      "dynastyKey": "nansong",
      "year": 1142,
      "coord": [
        120.15,
        30.28
      ],
      "site": "临安府",
      "siteEn": "Lin'an (Hangzhou)",
      "zh": "绍兴和议达成，岳飞于临安风波亭遇害",
      "en": "General Yue Fei is executed at Fengbo Pavilion in Lin'an"
    },
    {
      "dynastyKey": "nansong",
      "year": 1276,
      "coord": [
        120.15,
        30.28
      ],
      "site": "临安府",
      "siteEn": "Lin'an (Hangzhou)",
      "zh": "元军伯颜兵临临安，谢太后携宋恭帝奉玺出降",
      "en": "Yuan forces under Bayan reach Lin'an; the Southern Song court surrenders"
    },
    {
      "dynastyKey": "zhanguo",
      "year": -316,
      "coord": [
        104.06,
        30.67
      ],
      "site": "成都",
      "siteEn": "Chengdu",
      "zh": "秦将司马错由石牛道灭蜀置蜀郡，前311年张仪按咸阳规制筑成都城",
      "en": "Qin general Sima Cuo conquers Shu; Zhang Yi rebuilds Chengdu modeled on Xianyang"
    },
    {
      "dynastyKey": "zhanguo",
      "year": -256,
      "coord": [
        103.62,
        31
      ],
      "site": "都江堰·成都",
      "siteEn": "Dujiangyan / Chengdu",
      "zh": "蜀郡太守李冰凿离堆修筑都江堰，成都平原自此号“天府之国”",
      "en": "Shu Governor Li Bing builds the Dujiangyan Irrigation System, making Chengdu the Land of Plenty"
    },
    {
      "dynastyKey": "sanguo",
      "year": 221,
      "coord": [
        104.06,
        30.67
      ],
      "site": "成都",
      "siteEn": "Chengdu",
      "zh": "刘备于成都称帝建立蜀汉，拜诸葛亮为丞相",
      "en": "Liu Bei proclaims the Shu Han Empire in Chengdu with Zhuge Liang as Chancellor"
    },
    {
      "dynastyKey": "sanguo",
      "year": 263,
      "coord": [
        104.06,
        30.67
      ],
      "site": "成都",
      "siteEn": "Chengdu",
      "zh": "魏将邓艾偷渡阴平直抵成都，刘禅出降，蜀汉灭亡",
      "en": "Wei general Deng Ai marches through Yinping to Chengdu; Liu Shan surrenders"
    },
    {
      "dynastyKey": "tang",
      "year": 756,
      "coord": [
        104.06,
        30.67
      ],
      "site": "成都府（南京）",
      "siteEn": "Chengdu",
      "zh": "安史之乱唐玄宗幸蜀驻跸成都，后升益州为成都府",
      "en": "Emperor Xuanzong takes refuge in Chengdu during the An Lushan Rebellion"
    },
    {
      "dynastyKey": "wudai",
      "year": 907,
      "coord": [
        104.06,
        30.67
      ],
      "site": "成都",
      "siteEn": "Chengdu",
      "zh": "王建于成都建前蜀，后孟知祥复于成都建后蜀",
      "en": "Former Shu and Later Shu kingdoms successively govern from Chengdu"
    },
    {
      "dynastyKey": "beisong",
      "year": 1023,
      "coord": [
        104.06,
        30.67
      ],
      "site": "益州（成都）",
      "siteEn": "Chengdu",
      "zh": "北宋于成都设益州交子务，发行世界最早官方纸币“交子”",
      "en": "Northern Song establishes the Jiaozi Bureau in Chengdu, issuing the world’s first paper money"
    },
    {
      "dynastyKey": "donghan",
      "year": 208,
      "coord": [
        113.95,
        29.95
      ],
      "site": "赤壁·江夏",
      "siteEn": "Red Cliffs / Jiangxia",
      "zh": "孙刘联军于赤壁火攻大破曹操，奠定三国鼎立之局",
      "en": "Battle of Red Cliffs: Sun Quan and Liu Bei defeat Cao Cao by fire attack"
    },
    {
      "dynastyKey": "sanguo",
      "year": 221,
      "coord": [
        114.88,
        30.4
      ],
      "site": "武昌（今鄂州）",
      "siteEn": "Wuchang",
      "zh": "孙权自公安徙治鄂县，取“以武而昌”改名武昌",
      "en": "Sun Quan establishes Wuchang as his military and political capital on the Yangtze"
    },
    {
      "dynastyKey": "nansong",
      "year": 1134,
      "coord": [
        114.3,
        30.55
      ],
      "site": "鄂州（武昌）",
      "siteEn": "Ezhou (Wuhan)",
      "zh": "岳飞以鄂州为大本营，挥师北伐收复襄阳六郡",
      "en": "Yue Fei bases his Northern Expedition forces at Ezhou (Wuchang)"
    },
    {
      "dynastyKey": "qing",
      "year": 1911,
      "coord": [
        114.3,
        30.55
      ],
      "site": "武昌",
      "siteEn": "Wuchang (Wuhan)",
      "zh": "武昌起义爆发，打响辛亥革命第一枪，终结两千年帝制",
      "en": "Wuchang Uprising sparks the 1911 Xinhai Revolution, ending imperial rule in China"
    },
    {
      "dynastyKey": "donghan",
      "year": 207,
      "coord": [
        112.14,
        32.01
      ],
      "site": "襄阳·隆中",
      "siteEn": "Xiangyang",
      "zh": "刘备三顾茅庐请诸葛亮于襄阳隆中出山，定《隆中对》",
      "en": "Liu Bei visits Zhuge Liang three times at Longzhong near Xiangyang"
    },
    {
      "dynastyKey": "donghan",
      "year": 219,
      "coord": [
        112.14,
        32.01
      ],
      "site": "襄阳·樊城",
      "siteEn": "Xiangyang",
      "zh": "关羽北伐水淹七军，围曹仁于樊城、襄阳，威震华夏",
      "en": "Guan Yu floods the Seven Armies and besieges Xiangyang and Fancheng"
    },
    {
      "dynastyKey": "nansong",
      "year": 1273,
      "coord": [
        112.14,
        32.01
      ],
      "site": "襄阳",
      "siteEn": "Xiangyang",
      "zh": "襄樊之战：宋军孤城苦守襄阳六年，元军回回炮破樊城后降元",
      "en": "Six-year Siege of Xiangyang ends after Yuan forces deploy counterweight trebuchets"
    },
    {
      "dynastyKey": "xihan",
      "year": -111,
      "coord": [
        94.66,
        40.14
      ],
      "site": "敦煌",
      "siteEn": "Dunhuang",
      "zh": "汉武帝分酒泉置敦煌郡，筑玉门关、阳关扼丝路咽喉",
      "en": "Emperor Wu of Han establishes Dunhuang Commandery and the Yumen and Yangguan passes"
    },
    {
      "dynastyKey": "dongjin",
      "year": 366,
      "coord": [
        94.66,
        40.14
      ],
      "site": "敦煌",
      "siteEn": "Dunhuang",
      "zh": "沙门乐僔于敦煌鸣沙山东麓开凿莫高窟第一窟",
      "en": "Monk Yuezun carves the first cave at the Mogao Grottoes in Dunhuang"
    },
    {
      "dynastyKey": "tang",
      "year": 848,
      "coord": [
        94.66,
        40.14
      ],
      "site": "沙州（敦煌）",
      "siteEn": "Shazhou (Dunhuang)",
      "zh": "张议潮于沙州起义驱逐吐蕃，遣使奉表归唐，置归义军",
      "en": "Zhang Yichao leads the Dunhuang uprising and restores Tang rule as the Guiyi Circuit"
    },
    {
      "dynastyKey": "xihan",
      "year": -200,
      "coord": [
        113.3,
        40.08
      ],
      "site": "平城（大同）",
      "siteEn": "Pingcheng (Datong)",
      "zh": "白登之围：汉高祖刘邦于平城白登山被冒顿单于围困七日",
      "en": "Siege of Baideng: Emperor Gaozu of Han is besieged by Modu Chanyu at Pingcheng"
    },
    {
      "dynastyKey": "dongjin",
      "year": 398,
      "coord": [
        113.3,
        40.08
      ],
      "site": "平城（大同）",
      "siteEn": "Pingcheng (Datong)",
      "zh": "拓跋珪迁都平城称帝建北魏，开凿云冈石窟",
      "en": "Tuoba Gui moves the Northern Wei capital to Pingcheng and initiates the Yungang Grottoes"
    },
    {
      "dynastyKey": "sui",
      "year": 618,
      "coord": [
        119.41,
        32.39
      ],
      "site": "江都（扬州）",
      "siteEn": "Jiangdu (Yangzhou)",
      "zh": "宇文化及于江都发动兵变弑隋炀帝，隋朝覆亡",
      "en": "Yuwen Huaji assassinates Emperor Yang of Sui in Jiangdu (Yangzhou)"
    },
    {
      "dynastyKey": "tang",
      "year": 753,
      "coord": [
        119.41,
        32.39
      ],
      "site": "扬州",
      "siteEn": "Yangzhou",
      "zh": "鉴真和尚自扬州启航第六次东渡日本成功",
      "en": "Monk Jianzhen sets sail from Yangzhou on his successful sixth voyage to Japan"
    },
    {
      "dynastyKey": "qing",
      "year": 1645,
      "coord": [
        119.41,
        32.39
      ],
      "site": "扬州",
      "siteEn": "Yangzhou",
      "zh": "史可法率孤军死守扬州抗击清军，城破殉国",
      "en": "Ming loyalist Shi Kefa defends Yangzhou to the death against Qing forces"
    },
    {
      "dynastyKey": "qin",
      "year": -204,
      "coord": [
        113.26,
        23.13
      ],
      "site": "番禺（广州）",
      "siteEn": "Panyu (Guangzhou)",
      "zh": "赵佗于番禺自立为南越武王；前111年汉武帝平南越置南海郡",
      "en": "Zhao Tuo founds the Nanyue Kingdom at Panyu (Guangzhou); reconquered by Han in 111 BCE"
    },
    {
      "dynastyKey": "tang",
      "year": 714,
      "coord": [
        113.26,
        23.13
      ],
      "site": "广州",
      "siteEn": "Guangzhou",
      "zh": "唐廷于广州首设市舶使，总管南海番舶贸易",
      "en": "Tang establishes the first Maritime Trade Commissioner (Shibosi) in Guangzhou"
    },
    {
      "dynastyKey": "qing",
      "year": 1839,
      "coord": [
        113.26,
        23.13
      ],
      "site": "广州·虎门",
      "siteEn": "Guangzhou / Humen",
      "zh": "林则徐抵广州查禁鸦片，于虎门海滩当众销烟",
      "en": "Imperial Commissioner Lin Zexu destroys opium stocks at Humen near Guangzhou"
    },
    {
      "dynastyKey": "zhanguo",
      "year": -318,
      "coord": [
        110.92,
        34.63
      ],
      "site": "函谷关（今河南灵宝）",
      "siteEn": "Hangu Pass (Lingbao, Henan)",
      "zh": "楚、赵、魏、韩、燕五国合纵攻秦，至函谷关，秦出兵逆击，五国联军皆败走",
      "en": "Coalition of Chu, Zhao, Wei, Han, and Yan marches on Hangu Pass but is repulsed by Qin forces"
    },
    {
      "dynastyKey": "zhanguo",
      "year": -298,
      "coord": [
        110.92,
        34.63
      ],
      "site": "函谷关（今河南灵宝）",
      "siteEn": "Hangu Pass (Lingbao, Henan)",
      "zh": "齐孟尝君田文合韩、魏之师攻破函谷关，迫秦昭襄王割城求和",
      "en": "Lord Mengchang of Qi leads a Qi-Han-Wei coalition that storms Hangu Pass after three years"
    },
    {
      "dynastyKey": "qin",
      "year": -206,
      "coord": [
        110.33,
        33.62
      ],
      "site": "武关（今陕西丹凤）",
      "siteEn": "Wuguan Pass (Danfeng, Shaanxi)",
      "zh": "刘邦率楚军自南阳迂回攻破武关、峣关，先入关中降秦王子婴",
      "en": "Liu Bang breaches Wuguan Pass from Nanyang and enters Guanzhong to accept Qin’s surrender"
    },
    {
      "dynastyKey": "qin",
      "year": -204,
      "coord": [
        113.89,
        37.97
      ],
      "site": "井陉关·娘子关（今河北井陉）",
      "siteEn": "Jingxing / Niangzi Pass (Hebei)",
      "zh": "井陉之战：韩信出井陉口背水列阵，奇兵拔赵壁破赵军二十万",
      "en": "Battle of Jingxing: Han Xin deploys with his back to the river and routs 200,000 Zhao troops"
    },
    {
      "dynastyKey": "xihan",
      "year": -166,
      "coord": [
        106.32,
        35.85
      ],
      "site": "萧关（今宁夏固原东南）",
      "siteEn": "Xiaoguan Pass (Guyuan, Ningxia)",
      "zh": "匈奴老上单于率十四万骑破萧关，汉文帝遣三将军屯细柳备胡",
      "en": "Xiongnu Chanyu Laoshang breaches Xiaoguan Pass with 140,000 cavalry, alarming Chang’an"
    },
    {
      "dynastyKey": "xihan",
      "year": -111,
      "coord": [
        93.86,
        40.35
      ],
      "site": "玉门关·阳关（今甘肃敦煌）",
      "siteEn": "Yumen & Yangguan Passes (Dunhuang)",
      "zh": "汉武帝分置敦煌郡，筑玉门关与阳关，扼控丝绸之路南北咽喉",
      "en": "Emperor Wu establishes Yumen Pass and Yangguan Pass to command the Silk Road routes"
    },
    {
      "dynastyKey": "donghan",
      "year": 211,
      "coord": [
        110.25,
        34.54
      ],
      "site": "潼关（今陕西潼关）",
      "siteEn": "Tongguan Pass (Shaanxi)",
      "zh": "潼关之战：曹操北渡蒲阪津迂回渭南，以离间计大破马超韩遂",
      "en": "Battle of Tongguan: Cao Cao outflanks the pass and defeats the coalition of Ma Chao and Han Sui"
    },
    {
      "dynastyKey": "donghan",
      "year": 219,
      "coord": [
        106.12,
        33.11
      ],
      "site": "阳平关·定军山（今陕西勉县）",
      "siteEn": "Yangping Pass (Mianxian, Shaanxi)",
      "zh": "汉中之战：刘备据阳平关与定军山，黄忠阵斩夏侯渊尽取汉中",
      "en": "Hanzhong Campaign: Liu Bei takes Yangping Pass and Mount Dingjun; Huang Zhong slays Xiahou Yuan"
    },
    {
      "dynastyKey": "sanguo",
      "year": 263,
      "coord": [
        105.53,
        32.21
      ],
      "site": "剑门关（今四川剑阁）",
      "siteEn": "Jianmen Pass (Jiange, Sichuan)",
      "zh": "蜀汉大将军姜维自沓中疾退，凭剑门关天险拒钟会十万魏军",
      "en": "Shu general Jiang Wei holds the cliffs of Jianmen Pass against Zhong Hui’s 100,000 Wei troops"
    },
    {
      "dynastyKey": "tang",
      "year": 621,
      "coord": [
        113.32,
        34.82
      ],
      "site": "虎牢关（今河南荥阳汜水）",
      "siteEn": "Hulao Pass (Xingyang, Henan)",
      "zh": "虎牢之战：李世民率精骑据虎牢关生擒窦建德，王世充随即出降",
      "en": "Battle of Hulao: Li Shimin captures Dou Jiande at Hulao Pass, forcing Wang Shichong to yield"
    },
    {
      "dynastyKey": "tang",
      "year": 716,
      "coord": [
        114.34,
        25.32
      ],
      "site": "大庾岭梅关（今广东南雄北）",
      "siteEn": "Meiguan Pass (Dayu Ridge, Guangdong/Jiangxi)",
      "zh": "唐玄宗纳张九龄之议凿辟大庾岭梅关新路，贯通赣粤南北商道",
      "en": "Chancellor Zhang Jiuling excavates the Meiguan Pass road across Dayu Ridge, linking Gan and Yue"
    },
    {
      "dynastyKey": "tang",
      "year": 756,
      "coord": [
        110.25,
        34.54
      ],
      "site": "潼关（今陕西潼关）",
      "siteEn": "Tongguan Pass (Shaanxi)",
      "zh": "哥舒翰被迫出潼关中伏惨败，潼关失守，唐玄宗仓皇奔蜀",
      "en": "Geshu Han is ambushed outside Tongguan Pass; the pass falls and Emperor Xuanzong flees to Shu"
    },
    {
      "dynastyKey": "tang",
      "year": 819,
      "coord": [
        109.48,
        34.03
      ],
      "site": "蓝田关（今陕西蓝田）",
      "siteEn": "Lantian Pass (Lantian, Shaanxi)",
      "zh": "韩愈谏迎佛骨贬潮州，风雪逾蓝田关赋“雪拥蓝关马不前”名句",
      "en": "Exiled to Chaozhou, Han Yu crosses snowbound Lantian Pass and composes his famous quatrain"
    },
    {
      "dynastyKey": "beisong",
      "year": 980,
      "coord": [
        112.87,
        39.19
      ],
      "site": "雁门关（今山西代县北）",
      "siteEn": "Yanmen Pass (Daixian, Shanxi)",
      "zh": "雁门之战：杨业率骑自西陉出雁门关背奇袭，大破辽军斩萧咄李",
      "en": "Battle of Yanmen Pass: Song general Yang Ye leads a flanking cavalry strike to rout Liao forces"
    },
    {
      "dynastyKey": "ming",
      "year": 1372,
      "coord": [
        98.22,
        39.8
      ],
      "site": "嘉峪关（今甘肃嘉峪关）",
      "siteEn": "Jiayuguan Pass (Gansu)",
      "zh": "明将冯胜平定河西，于祁连峡谷最窄处筑嘉峪关，成明长城西端",
      "en": "Ming general Feng Sheng builds Jiayuguan Pass in the Hexi Corridor as the Great Wall’s west end"
    },
    {
      "dynastyKey": "ming",
      "year": 1449,
      "coord": [
        116.07,
        40.29
      ],
      "site": "居庸关·紫荆关（今北京昌平/河北易县）",
      "siteEn": "Juyong & Zijing Passes (Beijing / Hebei)",
      "zh": "土木之变后瓦剌逼紫荆、居庸二关，于谦督军严守内三关退敌",
      "en": "After the Tumu Crisis, Yu Qian fortifies Juyong and Zijing passes and repels Oirat forces"
    },
    {
      "dynastyKey": "ming",
      "year": 1644,
      "coord": [
        119.77,
        40.01
      ],
      "site": "山海关（今河北秦皇岛）",
      "siteEn": "Shanhai Pass (Qinhuangdao, Hebei)",
      "zh": "山海关大战：吴三桂开关纳多尔衮清军，联手击败李自成大顺军",
      "en": "Battle of Shanhai Pass: Wu Sangui opens the gates to Dorgon’s Qing army, defeating Li Zicheng"
    },
    {
      "dynastyKey": "xihan",
      "year": 4,
      "coord": [
        100.9,
        36.96
      ],
      "site": "西海郡龙夷城（今青海海晏）",
      "siteEn": "Longyi, Xihai Commandery (Haiyan, Qinghai)",
      "zh": "王莽于青海湖东岸置西海郡（治龙夷城），汉代郡县首次推进至青海湖畔",
      "en": "Wang Mang establishes Xihai Commandery east of Qinghai Lake with its seat at Longyi"
    },
    {
      "dynastyKey": "sanguo",
      "year": 260,
      "coord": [
        118.32,
        27.03
      ],
      "site": "建安（今福建建瓯）",
      "siteEn": "Jian'an (Jian'ou, Fujian)",
      "zh": "东吴景帝孙休析会稽南部置建安郡，治建安县，福建始设独立郡级建置",
      "en": "Sun Xiu of Eastern Wu carves Jian'an Commandery from southern Kuaiji in northern Fujian"
    },
    {
      "dynastyKey": "nanbei",
      "year": 540,
      "coord": [
        99.5,
        36.85
      ],
      "site": "伏俟城（今青海共和铁卜卡）",
      "siteEn": "Fusi City (Gonghe, Qinghai)",
      "zh": "吐谷浑首领夸吕始自称可汗，于青海湖西十五里营建王都伏俟城",
      "en": "Tuyuhun ruler Kualu proclaims himself Khagan and builds his royal capital at Fusi City"
    },
    {
      "dynastyKey": "wudai",
      "year": 927,
      "coord": [
        112.97,
        28.2
      ],
      "site": "潭州（今湖南长沙）",
      "siteEn": "Tan Zhou (Changsha, Hunan)",
      "zh": "后唐册封马殷为楚国王，马氏于潭州建南楚政权，兴茶铸币保境安民",
      "en": "Later Tang invests Ma Yin as King of Chu at Tan Zhou, founding the Southern Chu kingdom"
    },
    {
      "dynastyKey": "beisong",
      "year": 1032,
      "coord": [
        101.78,
        36.62
      ],
      "site": "青唐城（今青海西宁）",
      "siteEn": "Qingtang City (Xining, Qinghai)",
      "zh": "吐蕃唃厮啰部迁都青唐城（今西宁），建青唐政权并扼丝路青海道要冲",
      "en": "Tibetan ruler Gusiluo moves his capital to Qingtang (Xining) on the Qinghai Silk Road"
    },
    {
      "dynastyKey": "beisong",
      "year": 1053,
      "coord": [
        108.65,
        23.06
      ],
      "site": "昆仑关（今广西南宁）",
      "siteEn": "Kunlun Pass (Nanning, Guangxi)",
      "zh": "枢密副使狄青元宵夜袭昆仑关，于归仁铺大破侬智高，平定广南西路",
      "en": "Song general Di Qing launches a night raid through Kunlun Pass to defeat Nong Zhigao"
    },
    {
      "dynastyKey": "nansong",
      "year": 1276,
      "coord": [
        119.3,
        26.08
      ],
      "site": "福安府（今福建福州）",
      "siteEn": "Fu'an Prefecture (Fuzhou, Fujian)",
      "zh": "文天祥、张世杰、陆秀夫奉益王赵昰于福州称帝（宋端宗），升福安府抗元",
      "en": "Wen Tianxiang, Zhang Shijie, and Lu Xiufu enthrone Emperor Duanzong at Fuzhou against Yuan"
    },
    {
      "dynastyKey": "ming",
      "year": 1600,
      "coord": [
        106.82,
        27.81
      ],
      "site": "海龙屯（今贵州遵义）",
      "siteEn": "Hailongtun Fortress (Zunyi, Guizhou)",
      "zh": "万历平播之役：李化龙督八路明军攻克海龙屯，灭播州杨氏土司改土归流",
      "en": "Bozhou Campaign: Ming commander Li Hualong storms Hailongtun Fortress, ending Yang tusi rule"
    },
    {
      "dynastyKey": "qing",
      "year": 1678,
      "coord": [
        112.61,
        26.89
      ],
      "site": "衡州（今湖南衡阳）",
      "siteEn": "Heng Zhou (Hengyang, Hunan)",
      "zh": "吴三桂于湖南衡州称帝建国号大周，旋即病卒，清军随即反攻收复湖南",
      "en": "Wu Sangui proclaims the Zhou dynasty at Heng Zhou shortly before dying, turning the war"
    },
    {
      "dynastyKey": "zhanguo",
      "year": -249,
      "coord": [
        116.99,
        35.6
      ],
      "site": "鲁城（今山东曲阜）",
      "siteEn": "Lu Capital (Qufu, Shandong)",
      "zh": "楚考烈王伐鲁灭之，迁鲁顷公于莒，周公所封八百年鲁国绝祀",
      "en": "King Kaolie of Chu annexes Lu at Qufu, ending the 800-year state founded by the Duke of Zhou"
    },
    {
      "dynastyKey": "xihan",
      "year": -195,
      "coord": [
        116.99,
        35.6
      ],
      "site": "鲁县（今山东曲阜）",
      "siteEn": "Lu County (Qufu, Shandong)",
      "zh": "汉高祖刘邦自淮南还过鲁，以太牢祠孔子，开历代帝王亲祭孔子之始",
      "en": "Emperor Gaozu of Han offers the Grand Sacrifice to Confucius at Lu, starting imperial rites"
    },
    {
      "dynastyKey": "beisong",
      "year": 1008,
      "coord": [
        116.99,
        35.6
      ],
      "site": "曲阜（今山东曲阜）",
      "siteEn": "Qufu (Qufu, Shandong)",
      "zh": "宋真宗东封泰山毕亲幸曲阜谒孔庙，追谥孔子为玄圣文宣王",
      "en": "Emperor Zhenzong visits the Temple of Confucius at Qufu after the Mount Tai Fengshan rites"
    },
    {
      "dynastyKey": "wudai",
      "year": 952,
      "coord": [
        116.99,
        35.6
      ],
      "site": "曲阜（今山东曲阜）",
      "siteEn": "Qufu (Qufu, Shandong)",
      "zh": "后周太祖郭威平兖州后幸曲阜谒孔庙，称孔子“百世帝王之师”并亲行拜礼",
      "en": "Later Zhou Emperor Guo Wei visits Qufu and bows to Confucius as Teacher of Emperors for All Ages"
    },
    {
      "dynastyKey": "qing",
      "year": 1684,
      "coord": [
        116.99,
        35.6
      ],
      "site": "曲阜（今山东曲阜）",
      "siteEn": "Qufu (Qufu, Shandong)",
      "zh": "康熙帝南巡回銮亲幸曲阜孔庙，行三跪九叩大礼并御书“万世师表”匾额",
      "en": "Emperor Kangxi visits Qufu Temple of Confucius, performing full imperial rites and calligraphy"
    },
    {
      "dynastyKey": "zhanguo",
      "year": -375,
      "coord": [
        119.98,
        35.65
      ],
      "site": "琅琊（今山东青岛·黄岛）",
      "siteEn": "Langya (Qingdao, Shandong)",
      "zh": "越王勾践灭吴后北徙都琅琊望东海，至越王翳时始自琅琊南迁返吴",
      "en": "King Yi of Yue moves his capital south from Langya, ending Yue's northern maritime court era"
    },
    {
      "dynastyKey": "qin",
      "year": -219,
      "coord": [
        119.98,
        35.65
      ],
      "site": "琅琊台（今山东青岛·黄岛）",
      "siteEn": "Langya Terrace (Qingdao, Shandong)",
      "zh": "秦始皇东巡登琅琊山，留三月，徙三万户筑琅琊台立石颂秦德",
      "en": "Qin Shi Huang ascends Mount Langya, moving 30,000 households to build Langya Terrace and stele"
    },
    {
      "dynastyKey": "qin",
      "year": -210,
      "coord": [
        119.98,
        35.65
      ],
      "site": "琅琊（今山东青岛·黄岛）",
      "siteEn": "Langya (Qingdao, Shandong)",
      "zh": "秦始皇末次东巡至琅琊，遣方士徐福率童男女数千人入海求仙",
      "en": "On his final eastern tour at Langya, Qin Shi Huang sends Xu Fu across the sea for immortals"
    },
    {
      "dynastyKey": "xihan",
      "year": -106,
      "coord": [
        119.98,
        35.65
      ],
      "site": "琅琊台（今山东青岛·黄岛）",
      "siteEn": "Langya Terrace (Qingdao, Shandong)",
      "zh": "汉武帝东巡海上至琅琊，登琅琊台礼祠四时主，遣方士入海求蓬莱",
      "en": "Emperor Wu of Han tours the coast to Langya, sacrificing at Langya Terrace and seeking Penglai"
    },
    {
      "dynastyKey": "xihan",
      "year": 18,
      "coord": [
        119.98,
        35.65
      ],
      "site": "琅琊（今山东诸城·莒县）",
      "siteEn": "Langya (Zhucheng & Ju County, Shandong)",
      "zh": "琅琊人樊崇起兵反莽，义军以朱涂眉相别号“赤眉军”，终成覆莽主力",
      "en": "Fan Chong of Langya launches the Red Eyebrows uprising against Wang Mang's Xin dynasty"
    },
    {
      "dynastyKey": "xijin",
      "year": 307,
      "coord": [
        119.98,
        35.65
      ],
      "site": "琅琊国（今山东鲁东南）",
      "siteEn": "Langya Principality (SE Shandong)",
      "zh": "琅琊王司马睿采王导之策南渡镇建邺，偕琅琊王氏奠定东晋基业",
      "en": "Sima Rui, Prince of Langya, crosses south to Jianye with Wang Dao, founding the Eastern Jin"
    },
    {
      "dynastyKey": "beisong",
      "year": 1004,
      "coord": [
        117.18,
        29.27
      ],
      "site": "昌南镇（今江西景德镇）",
      "siteEn": "Changnan Town (Jingdezhen, Jiangxi)",
      "zh": "宋真宗景德元年诏昌南镇进御瓷底书“景德年制”，景德镇由此得名",
      "en": "Emperor Zhenzong decrees Changnan imperial porcelain bear the Jingde mark, naming Jingdezhen"
    },
    {
      "dynastyKey": "ming",
      "year": 1402,
      "coord": [
        117.18,
        29.27
      ],
      "site": "景德镇（今江西景德镇）",
      "siteEn": "Jingdezhen (Jingdezhen, Jiangxi)",
      "zh": "明廷于景德镇珠山置御器厂督造宫廷御瓷，永宣青花与成化斗彩冠绝天下",
      "en": "The Ming court establishes the Zhushan Imperial Kiln Factory at Jingdezhen for royal porcelain"
    },
    {
      "dynastyKey": "qing",
      "year": 1658,
      "coord": [
        129.48,
        44.58
      ],
      "site": "宁古塔（今黑龙江海林）",
      "siteEn": "Ningguta (Hailin, Heilongjiang)",
      "zh": "顺治丁酉科场案发，江南才子吴兆骞等流徙宁古塔，塞外苦寒渐兴文教",
      "en": "After the 1657 exam scandal, Jiangnan literati like Wu Zhaoqian are exiled to frontier Ningguta"
    },
    {
      "dynastyKey": "qing",
      "year": 1662,
      "coord": [
        129.48,
        44.58
      ],
      "site": "宁古塔城（今黑龙江海林）",
      "siteEn": "Ningguta Garrison (Hailin, Heilongjiang)",
      "zh": "清廷设镇守宁古塔等处将军，统辖松花江、乌苏里江至库页岛广袤边疆",
      "en": "The Qing court appoints the General of Ningguta to govern the frontier to Ussuri and Sakhalin"
    },
    {
      "dynastyKey": "dongjin",
      "year": 410,
      "coord": [
        118.48,
        36.68
      ],
      "site": "广固（今山东潍坊青州）",
      "siteEn": "Guanggu (Qingzhou, Weifang, Shandong)",
      "zh": "刘裕北伐攻克南燕都城广固，擒慕容超收复青齐之地",
      "en": "Liu Yu storms the Southern Yan capital Guanggu, capturing Murong Chao and recovering Shandong"
    },
    {
      "dynastyKey": "beisong",
      "year": 1048,
      "coord": [
        118.48,
        36.68
      ],
      "site": "青州（今山东潍坊青州）",
      "siteEn": "Qing Zhou (Weifang, Shandong)",
      "zh": "河北大水百万流民南奔，富弼知青州置场劝募赈活饥民五十余万",
      "en": "Prefect Fu Bi organizes relief in Qing Zhou for Hebei flood refugees, saving over 500,000 lives"
    },
    {
      "dynastyKey": "beisong",
      "year": 1076,
      "coord": [
        119.4,
        35.99
      ],
      "site": "密州（今山东潍坊诸城）",
      "siteEn": "Mi Zhou (Zhucheng, Weifang, Shandong)",
      "zh": "苏轼知密州筑超然台，丙辰中秋欢饮达旦赋《水调歌头》",
      "en": "Su Shi governs Mi Zhou, composing his Mid-Autumn masterpiece Prelude to Water Melody"
    },
    {
      "dynastyKey": "donghan",
      "year": 212,
      "coord": [
        105.84,
        32.44
      ],
      "site": "葭萌（今四川广元）",
      "siteEn": "Jiameng (Guangyuan, Sichuan)",
      "zh": "刘备自葭萌挥师南下与刘璋决裂，夺取涪城开启益州之战",
      "en": "Liu Bei marches south from Jiameng to break with Liu Zhang, launching his Yi Province campaign"
    },
    {
      "dynastyKey": "tang",
      "year": 624,
      "coord": [
        105.84,
        32.44
      ],
      "site": "利州（今四川广元）",
      "siteEn": "Li Zhou (Guangyuan, Sichuan)",
      "zh": "利州都督武士彟任上，武则天相传诞于利州嘉陵江畔",
      "en": "Empress Wu Zetian is traditionally born at Li Zhou while her father Wu Shiyue governs there"
    },
    {
      "dynastyKey": "beisong",
      "year": 980,
      "coord": [
        112.96,
        39.07
      ],
      "site": "代州雁门（今山西忻州代县）",
      "siteEn": "Dai Zhou & Yanmen (Daixian, Xinzhou, Shanxi)",
      "zh": "代州刺史杨业出雁门关背击辽军，杀辽驸马萧咄李获雁门大捷",
      "en": "Prefect Yang Ye leads cavalry behind Liao lines at Yanmen Pass, winning the Battle of Yanmen"
    },
    {
      "dynastyKey": "tang",
      "year": 756,
      "coord": [
        106.28,
        38.09
      ],
      "site": "灵武（今宁夏吴忠灵武）",
      "siteEn": "Lingwu (Wuzhong, Ningxia)",
      "zh": "长安失守，太子李亨北上朔方军治所灵武即位为唐肃宗号令平叛",
      "en": "Crown Prince Li Heng ascends the throne as Emperor Suzong at Lingwu to rally Tang forces"
    },
    {
      "dynastyKey": "beisong",
      "year": 1002,
      "coord": [
        106.28,
        38.09
      ],
      "site": "灵州（今宁夏吴忠灵武）",
      "siteEn": "Ling Zhou (Wuzhong, Ningxia)",
      "zh": "党项李继迁攻陷宋朔方重镇灵州，改灵州为西平府定为西夏陪都",
      "en": "Tangut leader Li Jiqian captures Ling Zhou, renaming it Xiping Prefecture as a Xia capital"
    },
    {
      "dynastyKey": "dongjin",
      "year": 384,
      "coord": [
        82.96,
        41.72
      ],
      "site": "龟兹（今新疆阿克苏库车）",
      "siteEn": "Kucha (Kuqa, Aksu, Xinjiang)",
      "zh": "前秦吕光攻破龟兹城，奉迎高僧鸠摩罗什东入凉州与长安译经",
      "en": "Former Qin general Lü Guang captures Kucha and escorts Buddhist master Kumarajiva east"
    },
    {
      "dynastyKey": "tang",
      "year": 648,
      "coord": [
        82.96,
        41.72
      ],
      "site": "龟兹（今新疆阿克苏库车）",
      "siteEn": "Kucha (Kuqa, Aksu, Xinjiang)",
      "zh": "唐阿史那社尔率军平定龟兹，移安西都护府于龟兹统辖安西四镇",
      "en": "Tang general Ashina She'er pacifies Kucha, where the Anxi Protectorate is relocated"
    },
    {
      "dynastyKey": "donghan",
      "year": 73,
      "coord": [
        79.92,
        37.11
      ],
      "site": "于阗（今新疆和田）",
      "siteEn": "Khotan (Hotan, Xinjiang)",
      "zh": "班超自鄯善西至于阗，诛匈奴使者降服于阗王广德复通西域南道",
      "en": "Ban Chao wins the allegiance of King Guangde of Khotan, reopening the southern Silk Road"
    },
    {
      "dynastyKey": "tang",
      "year": 675,
      "coord": [
        79.92,
        37.11
      ],
      "site": "于阗（今新疆和田）",
      "siteEn": "Khotan (Hotan, Xinjiang)",
      "zh": "唐廷于于阗置毗沙都督府，与龟兹、疏勒、碎叶并列安西四镇",
      "en": "The Tang court establishes the Pisha Area Command at Khotan among the Four Garrisons of Anxi"
    },
    {
      "dynastyKey": "tang",
      "year": 755,
      "coord": [
        129.15,
        44.05
      ],
      "site": "上京龙泉府（今黑龙江牡丹江宁安）",
      "siteEn": "Shangjing Longquanfu (Ning'an, Mudanjiang, Heilongjiang)",
      "zh": "渤海文王大钦茂迁都上京龙泉府，仿唐长安形制筑城号海东盛国",
      "en": "King Mun of Balhae moves his capital to Shangjing Longquanfu, modeled on Tang Chang'an"
    },
    {
      "dynastyKey": "wudai",
      "year": 926,
      "coord": [
        129.15,
        44.05
      ],
      "site": "忽汗城（今黑龙江牡丹江宁安）",
      "siteEn": "Huhancheng (Ning'an, Mudanjiang, Heilongjiang)",
      "zh": "辽太祖耶律阿保机围困渤海上京忽汗城，大諲譔出降改设东丹国",
      "en": "Liao founder Abaoji captures Huhancheng (Shangjing), ending Balhae and establishing Dongdan"
    },
    {
      "dynastyKey": "sanguo",
      "year": 244,
      "coord": [
        126.19,
        41.12
      ],
      "site": "丸都城（今吉林通化集安）",
      "siteEn": "Wandu City (Ji'an, Tonghua, Jilin)",
      "zh": "曹魏毌丘俭东征高句丽，登丸都山攻克高句丽王都丸都城刻石纪功",
      "en": "Cao Wei general Guanqiu Jian storms the Goguryeo capital at Wandu and carves a victory stele"
    },
    {
      "dynastyKey": "dongjin",
      "year": 414,
      "coord": [
        126.19,
        41.12
      ],
      "site": "国内城（今吉林通化集安）",
      "siteEn": "Guonei City (Ji'an, Tonghua, Jilin)",
      "zh": "高句丽长寿王于国都国内城立广开土境好太王碑，铭记开疆史事",
      "en": "King Jangsu of Goguryeo erects the Gwanggaeto Stele at Guonei City in modern Ji'an, Tonghua"
    },
    {
      "dynastyKey": "ming",
      "year": 1406,
      "coord": [
        106.75,
        21.97
      ],
      "site": "凭祥坡垒关（今广西崇左凭祥）",
      "siteEn": "Pingxiang Pass (Chongzuo, Guangxi)",
      "zh": "明征夷将军张辅率军自广西太平府凭祥度坡垒关（镇南关）南征",
      "en": "Ming general Zhang Fu marches from Taiping Prefecture through Pingxiang Pass into Jiaozhi"
    },
    {
      "dynastyKey": "nansong",
      "year": 1260,
      "coord": [
        116.18,
        42.36
      ],
      "site": "开平（今内蒙古锡林郭勒正蓝旗）",
      "siteEn": "Kaiping / Xanadu (Xilingol, Inner Mongolia)",
      "zh": "忽必烈于滦河上游开平即大汗位建元中统，旋升开平府为上都",
      "en": "Kublai Khan is enthroned as Great Khan at Kaiping, soon elevated to summer capital Shangdu"
    },
    {
      "dynastyKey": "qing",
      "year": 1691,
      "coord": [
        116.48,
        42.2
      ],
      "site": "多伦诺尔（今内蒙古锡林郭勒多伦）",
      "siteEn": "Dolon Nor (Xilingol, Inner Mongolia)",
      "zh": "康熙帝亲赴多伦诺尔会盟喀尔喀三部与漠南诸旗，编旗管辖漠北",
      "en": "Emperor Kangxi convenes the Dolon Nor Assembly, integrating the Khalkha Mongols into banners"
    },
    {
      "dynastyKey": "xihan",
      "year": -102,
      "coord": [
        101.06,
        41.95
      ],
      "site": "居延（今内蒙古阿拉善额济纳）",
      "siteEn": "Juyan (Ejin Banner, Alxa, Inner Mongolia)",
      "zh": "汉武帝遣路博德筑居延遮虏障屯田戍边，遗存万枚居延汉简",
      "en": "Emperor Wu dispatches Lu Bode to build the Juyan frontier forts, leaving 10,000 Han slips"
    },
    {
      "dynastyKey": "nansong",
      "year": 1226,
      "coord": [
        101.14,
        41.76
      ],
      "site": "黑水城（今内蒙古阿拉善额济纳）",
      "siteEn": "Khara-Khoto (Ejin Banner, Alxa, Inner Mongolia)",
      "zh": "成吉思汗末次亲征西夏首克黑水城，后元朝于此置亦集乃路",
      "en": "Genghis Khan captures the Western Xia fortress of Khara-Khoto on his final campaign"
    },
    {
      "dynastyKey": "beisong",
      "year": 1037,
      "coord": [
        103.85,
        30.08
      ],
      "site": "眉州（今四川眉山）",
      "siteEn": "Mei Zhou (Meishan, Sichuan)",
      "zh": "苏轼生于眉州眉山纱縠行，与苏洵、苏辙同出眉山并列唐宋八大家",
      "en": "Su Shi is born in Mei Zhou (Meishan), home to the Three Su literary masters of Northern Song"
    },
    {
      "dynastyKey": "nansong",
      "year": 1175,
      "coord": [
        117.94,
        28.45
      ],
      "site": "信州鹅湖（今江西上饶铅山）",
      "siteEn": "Goose Lake, Xin Zhou (Shangrao, Jiangxi)",
      "zh": "朱熹与陆九龄、陆九渊会讲于信州铅山鹅湖寺，史称“鹅湖之会”",
      "en": "Zhu Xi and Lu Jiuyuan debate Neo-Confucian philosophy at Goose Lake Temple in Shangrao"
    },
    {
      "dynastyKey": "nansong",
      "year": 1196,
      "coord": [
        117.94,
        28.45
      ],
      "site": "信州上饶（今江西上饶）",
      "siteEn": "Xin Zhou (Shangrao, Jiangxi)",
      "zh": "辛弃疾罢官隐居信州上饶带湖与瓢泉，赋豪放词抒恢复中原之志",
      "en": "Patriotic poet Xin Qiji resides in Shangrao for two decades, composing his greatest poems"
    },
    {
      "dynastyKey": "sanguo",
      "year": 229,
      "coord": [
        104.92,
        33.4
      ],
      "site": "武都（今甘肃陇南）",
      "siteEn": "Wudu (Longnan, Gansu)",
      "zh": "诸葛亮第三次北伐遣陈式进取武都、阴平二郡，收复陇南要冲",
      "en": "On his third northern expedition, Zhuge Liang captures Wudu and Yinping in modern Longnan"
    },
    {
      "dynastyKey": "qin",
      "year": -209,
      "coord": [
        119.14,
        33.5
      ],
      "site": "淮阴（今江苏淮安）",
      "siteEn": "Huaiyin (Huai'an, Jiangsu)",
      "zh": "韩信少时于淮阴受漂母饭信、胯下之辱，后仗剑从军拜汉大将军",
      "en": "Han Xin endures early hardship in Huaiyin before rising to become Han's supreme commander"
    },
    {
      "dynastyKey": "nansong",
      "year": 1135,
      "coord": [
        119.14,
        33.5
      ],
      "site": "楚州（今江苏淮安）",
      "siteEn": "Chu Zhou (Huai'an, Jiangsu)",
      "zh": "韩世忠与梁红玉屯兵楚州筑城抚民，扼守淮东门户十余年屏卫南宋",
      "en": "Han Shizhong and Liang Hongyu garrison Chu Zhou (Huai'an), defending the Huai frontier"
    },
    {
      "dynastyKey": "ming",
      "year": 1451,
      "coord": [
        119.14,
        33.5
      ],
      "site": "淮安府（今江苏淮安）",
      "siteEn": "Huai'an Prefecture (Huai'an, Jiangsu)",
      "zh": "明廷设漕运总督驻节淮安府城，统辖南北大运河四百万石漕粮北运",
      "en": "The Ming court establishes the Viceroy of Grain Transport at Huai'an on the Grand Canal"
    },
    {
      "dynastyKey": "xihan",
      "year": -138,
      "coord": [
        120.66,
        28.01
      ],
      "site": "东瓯（今浙江温州）",
      "siteEn": "Dong'ou (Wenzhou, Zhejiang)",
      "zh": "闽越围东瓯，汉武帝遣庄助发会稽兵浮海救东瓯并内徙其众于江淮",
      "en": "Emperor Wu of Han dispatches naval forces from Kuaiji to relieve Dong'ou (Wenzhou)"
    },
    {
      "dynastyKey": "nanbei",
      "year": 422,
      "coord": [
        120.66,
        28.01
      ],
      "site": "永嘉郡（今浙江温州）",
      "siteEn": "Yongjia Commandery (Wenzhou, Zhejiang)",
      "zh": "谢灵运出任永嘉太守，遍游永嘉楠溪江山水，开创中国古典山水诗派",
      "en": "Xie Lingyun governs Yongjia (Wenzhou), pioneering classical Chinese landscape poetry"
    },
    {
      "dynastyKey": "nansong",
      "year": 1130,
      "coord": [
        120.66,
        28.01
      ],
      "site": "温州（今浙江温州）",
      "siteEn": "Wen Zhou (Wenzhou, Zhejiang)",
      "zh": "金军渡江南侵搜山检海，宋高宗赵构自明州航海驻跸温州江心屿",
      "en": "Fleeing Jurchen Jin pursuit by sea, Emperor Gaozong of Song holds court at Wenzhou"
    },
    {
      "dynastyKey": "zhanguo",
      "year": -403,
      "coord": [
        120.75,
        30.75
      ],
      "site": "槜李（今浙江嘉兴）",
      "siteEn": "Zuili (Jiaxing, Zhejiang)",
      "zh": "吴越争霸古战场槜李（今嘉兴）归越国，扼杭嘉湖水网要冲",
      "en": "Site of the classic Wu-Yue battle of Zuili, Jiaxing guards the fertile northern Zhejiang plain"
    },
    {
      "dynastyKey": "ming",
      "year": 1555,
      "coord": [
        120.75,
        30.75
      ],
      "site": "嘉兴王江泾（今浙江嘉兴）",
      "siteEn": "Wangjiangjing, Jiaxing (Zhejiang)",
      "zh": "张经、卢镗与俞大猷统兵于嘉兴王江泾大破倭寇，获抗倭首捷",
      "en": "Ming commanders Zhang Jing and Yu Dayou crush Wokou pirates at Wangjiangjing in Jiaxing"
    },
    {
      "dynastyKey": "roc",
      "year": 1921,
      "coord": [
        120.75,
        30.75
      ],
      "site": "嘉兴南湖（今浙江嘉兴）",
      "siteEn": "South Lake, Jiaxing (Zhejiang)",
      "zh": "中共一大自上海转移至嘉兴南湖红船续会闭幕，宣告中国共产党成立",
      "en": "The First National Congress concludes aboard the Red Boat on South Lake in Jiaxing"
    },
    {
      "dynastyKey": "yuan",
      "year": 1358,
      "coord": [
        119.65,
        29.08
      ],
      "site": "婺州（今浙江金华）",
      "siteEn": "Wu Zhou (Jinhua, Zhejiang)",
      "zh": "朱元璋亲率大军攻克婺州改宁越府，延揽宋濂、王祎等浙东名儒",
      "en": "Zhu Yuanzhang captures Wu Zhou (Jinhua), recruiting Neo-Confucian scholars Song Lian and Wang Yi"
    },
    {
      "dynastyKey": "nansong",
      "year": 1129,
      "coord": [
        118.87,
        28.97
      ],
      "site": "衢州（今浙江衢州）",
      "siteEn": "Qu Zhou (Quzhou, Zhejiang)",
      "zh": "衍圣公孔端友负楷木圣像随宋高宗南渡，诏赐家衢州形成孔氏南宗",
      "en": "Duke Yansheng Kong Duanyou escorts sacred Confucian heirlooms south and settles in Quzhou"
    },
    {
      "dynastyKey": "yuan",
      "year": 1359,
      "coord": [
        119.92,
        28.45
      ],
      "site": "处州（今浙江丽水）",
      "siteEn": "Chu Zhou (Lishui, Zhejiang)",
      "zh": "朱元璋遣使入处州青田山中礼聘刘基（刘伯温）出山辅佐定天下",
      "en": "After capturing Chu Zhou (Lishui), Zhu Yuanzhang invites Liu Bowen of Qingtian to his court"
    },
    {
      "dynastyKey": "sanguo",
      "year": 220,
      "coord": [
        115.78,
        33.87
      ],
      "site": "谯县（今安徽亳州）",
      "siteEn": "Qiao County (Bozhou, Anhui)",
      "zh": "曹丕代汉建魏，尊曹氏故里谯县（今亳州）为陪都，列曹魏五都",
      "en": "Cao Pi designates the Cao clan's ancestral home of Qiao (Bozhou) among the Five Capitals of Wei"
    },
    {
      "dynastyKey": "yuan",
      "year": 1355,
      "coord": [
        115.78,
        33.87
      ],
      "site": "亳州（今安徽亳州）",
      "siteEn": "Bo Zhou (Bozhou, Anhui)",
      "zh": "刘福通迎韩林儿于亳州称帝，号小明王，建国大宋改元龙凤",
      "en": "Liu Futong enthrones Han Lin'er at Bozhou as Emperor of the restored Song Red Turban regime"
    },
    {
      "dynastyKey": "beisong",
      "year": 1121,
      "coord": [
        118.43,
        29.87
      ],
      "site": "徽州（今安徽黄山歙县）",
      "siteEn": "Hui Zhou (Shexian, Huangshan, Anhui)",
      "zh": "宋廷平定方腊起义后诏改歙州为徽州，统辖一府六县育徽州文化",
      "en": "After suppressing Fang La's uprising, the Song court renames She Zhou to Hui Zhou"
    },
    {
      "dynastyKey": "yuan",
      "year": 1357,
      "coord": [
        118.43,
        29.87
      ],
      "site": "徽州（今安徽黄山歙县）",
      "siteEn": "Hui Zhou (Shexian, Huangshan, Anhui)",
      "zh": "朱元璋克徽州访休宁名儒朱升，获“高筑墙、广积粮、缓称王”国策",
      "en": "At Huizhou, scholar Zhu Sheng counsels Zhu Yuanzhang to build high walls and store grain"
    },
    {
      "dynastyKey": "beisong",
      "year": 1071,
      "coord": [
        115.81,
        32.89
      ],
      "site": "颍州（今安徽阜阳）",
      "siteEn": "Ying Zhou (Fuyang, Anhui)",
      "zh": "欧阳修致仕退居颍州西湖畔，合藏书金石琴棋酒鹤自号六一居士",
      "en": "Ouyang Xiu retires beside West Lake in Ying Zhou (Fuyang) as the Six-One Lay Buddhist"
    },
    {
      "dynastyKey": "nansong",
      "year": 1140,
      "coord": [
        115.81,
        32.89
      ],
      "site": "顺昌府（今安徽阜阳）",
      "siteEn": "Shunchang Prefecture (Fuyang, Anhui)",
      "zh": "刘锜率八字军孤城坚守顺昌（今阜阳），以少击众大破金兀术主力",
      "en": "Song general Liu Qi defends Shunchang (Fuyang), routing Wuzhu's elite Jin iron cavalry"
    },
    {
      "dynastyKey": "nansong",
      "year": 1161,
      "coord": [
        119.18,
        34.59
      ],
      "site": "海州（今江苏连云港）",
      "siteEn": "Hai Zhou (Lianyungang, Jiangsu)",
      "zh": "魏胜于海州举义收复州城，会合宋水师李宝屡败金兵屏蔽淮海",
      "en": "Loyalist commander Wei Sheng recovers Hai Zhou (Lianyungang) and repels Jin forces"
    },
    {
      "dynastyKey": "wudai",
      "year": 958,
      "coord": [
        120.89,
        31.98
      ],
      "site": "通州（今江苏南通）",
      "siteEn": "Tong Zhou (Nantong, Jiangsu)",
      "zh": "后周世宗柴荣南征取江北十四州，升静海始建通州扼长江入海口",
      "en": "Later Zhou Emperor Chai Rong establishes Tong Zhou (Nantong) at the mouth of the Yangtze"
    },
    {
      "dynastyKey": "qing",
      "year": 1899,
      "coord": [
        120.89,
        31.98
      ],
      "site": "通州唐闸（今江苏南通）",
      "siteEn": "Tong Zhou / Nantong (Jiangsu)",
      "zh": "状元张謇于通州唐闸建成大生纱厂投产，兴办实业学堂开近代南通",
      "en": "Optimus scholar Zhang Jian opens the Dasheng Cotton Mill in Nantong, pioneering industry"
    },
    {
      "dynastyKey": "beisong",
      "year": 1024,
      "coord": [
        120.16,
        33.35
      ],
      "site": "楚州盐城（今江苏盐城）",
      "siteEn": "Yancheng (Jiangsu)",
      "zh": "范仲淹任西溪盐官倡议重修海堰，筑百里范公堤护淮南盐场良田",
      "en": "Fan Zhongyan initiates construction of the coastal Fan Gong Dike at Yancheng"
    },
    {
      "dynastyKey": "roc",
      "year": 1941,
      "coord": [
        120.16,
        33.35
      ],
      "site": "盐城（今江苏盐城）",
      "siteEn": "Yancheng (Jiangsu)",
      "zh": "皖南事变后新四军于江苏盐城重建军部，陈毅代军长、刘少奇政委",
      "en": "After the Southern Anhui Incident, the New Fourth Army rebuilds its headquarters at Yancheng"
    },
    {
      "dynastyKey": "ming",
      "year": 1604,
      "coord": [
        120.3,
        31.57
      ],
      "site": "无锡东林书院（今江苏无锡）",
      "siteEn": "Donglin Academy, Wuxi (Jiangsu)",
      "zh": "顾宪成、高攀龙于无锡重修东林书院讲学议政，撰“风声雨声”名联",
      "en": "Gu Xiancheng and Gao Panlong restore the Donglin Academy in Wuxi as a center of reform"
    },
    {
      "dynastyKey": "xihan",
      "year": -104,
      "coord": [
        105.97,
        31.56
      ],
      "site": "巴郡阆中（今四川南充阆中）",
      "siteEn": "Langzhong (Nanchong, Sichuan)",
      "zh": "巴郡阆中天文学家落下闳入长安造《太初历》，确立正月为岁首",
      "en": "Astronomer Luoxia Hong of Langzhong authors the Taichu Calendar under Emperor Wu of Han"
    },
    {
      "dynastyKey": "donghan",
      "year": 214,
      "coord": [
        105.97,
        31.56
      ],
      "site": "巴西阆中（今四川南充阆中）",
      "siteEn": "Langzhong, Baxi (Nanchong, Sichuan)",
      "zh": "刘备定益州后拜张飞为巴西太守镇守阆中七年，于宕渠大破张郃",
      "en": "Zhang Fei governs Baxi Commandery from Langzhong for seven years and defeats Zhang He"
    },
    {
      "dynastyKey": "beisong",
      "year": 1114,
      "coord": [
        104.64,
        28.77
      ],
      "site": "叙州（今四川宜宾）",
      "siteEn": "Xu Zhou (Yibin, Sichuan)",
      "zh": "宋政和四年改戎州为叙州，控扼金沙江与岷江汇合万里长江第一城",
      "en": "The Song court renames Rong Zhou to Xu Zhou (Yibin) at the headwaters of the Yangtze River"
    },
    {
      "dynastyKey": "tang",
      "year": 713,
      "coord": [
        103.77,
        29.55
      ],
      "site": "嘉州凌云山（今四川乐山）",
      "siteEn": "Jia Zhou (Leshan, Sichuan)",
      "zh": "海通禅师于嘉州三江汇流凌云山开凿弥勒大佛，历九十载至韦皋竣工",
      "en": "Monk Haitong begins carving the 71-meter Leshan Giant Buddha at the confluence in Jia Zhou"
    },
    {
      "dynastyKey": "sanguo",
      "year": 225,
      "coord": [
        105.44,
        28.89
      ],
      "site": "江阳（今四川泸州）",
      "siteEn": "Jiangyang (Luzhou, Sichuan)",
      "zh": "诸葛亮南征自成都率水师顺江至江阳（今泸州）会师，分兵平南中",
      "en": "Zhuge Liang sails down the Min River to Jiangyang (Luzhou) to assemble his southern expedition"
    },
    {
      "dynastyKey": "nansong",
      "year": 1243,
      "coord": [
        105.44,
        28.89
      ],
      "site": "泸州神臂城（今四川泸州）",
      "siteEn": "Shenbicheng, Lu Zhou (Luzhou, Sichuan)",
      "zh": "余玠筑泸州神臂城扼守长江上游，军民拉锯坚守抗蒙长达三十四年",
      "en": "Song commander Yu Jie fortifies Shenbicheng at Luzhou, resisting Mongol sieges for 34 years"
    },
    {
      "dynastyKey": "tang",
      "year": 815,
      "coord": [
        107.5,
        31.21
      ],
      "site": "通州（今四川达州）",
      "siteEn": "Tong Zhou (Dazhou, Sichuan)",
      "zh": "元稹左迁通州（今达州）司马，与江州司马白居易千里寄诗唱和",
      "en": "Poet Yuan Zhen serves in exile as Marshal of Tong Zhou (Dazhou), exchanging poems with Bai Juyi"
    },
    {
      "dynastyKey": "xihan",
      "year": -111,
      "coord": [
        102.26,
        27.89
      ],
      "site": "越嶲郡（今四川凉山西昌）",
      "siteEn": "Yuexi Commandery (Xichang, Liangshan, Sichuan)",
      "zh": "汉武帝开西南夷定邛都，置越嶲郡治邛都（今西昌）通川滇古道",
      "en": "Emperor Wu establishes Yuexi Commandery at Qiongdu (Xichang), opening the Sichuan-Yunnan road"
    },
    {
      "dynastyKey": "ming",
      "year": 1392,
      "coord": [
        102.26,
        27.89
      ],
      "site": "建昌卫（今四川凉山西昌）",
      "siteEn": "Jianchang Garrison (Xichang, Liangshan, Sichuan)",
      "zh": "蓝玉平建昌卫月鲁帖木儿之乱，明置四川行都司驻节建昌统川西南",
      "en": "General Lan Yu pacifies Jianchang (Xichang), seat of the Sichuan Branch Military Commission"
    },
    {
      "dynastyKey": "beisong",
      "year": 1021,
      "coord": [
        116.36,
        27.98
      ],
      "site": "抚州临川（今江西抚州）",
      "siteEn": "Linchuan, Fu Zhou (Fuzhou, Jiangxi)",
      "zh": "王安石诞于抚州临川，与同郡南丰曾巩双双名列“唐宋八大家”",
      "en": "Reformist statesman and poet Wang Anshi is born in Linchuan, Fuzhou (Jiangxi)"
    },
    {
      "dynastyKey": "ming",
      "year": 1598,
      "coord": [
        116.36,
        27.98
      ],
      "site": "抚州玉茗堂（今江西抚州）",
      "siteEn": "Yuming Hall, Fuzhou (Jiangxi)",
      "zh": "汤显祖于抚州临川玉茗堂写成《牡丹亭》，“临川四梦”冠绝明代剧坛",
      "en": "Playwright Tang Xianzu completes The Peony Pavilion at Yuming Hall in Linchuan, Fuzhou"
    },
    {
      "dynastyKey": "tang",
      "year": 820,
      "coord": [
        114.39,
        27.8
      ],
      "site": "袁州（今江西宜春）",
      "siteEn": "Yuan Zhou (Yichun, Jiangxi)",
      "zh": "韩愈由潮州量移袁州（今宜春）刺史，赎放质押奴婢七百余人兴学",
      "en": "Governing Yuan Zhou (Yichun), Han Yu frees over 700 bonded servants and promotes schooling"
    },
    {
      "dynastyKey": "ming",
      "year": 1637,
      "coord": [
        114.39,
        27.8
      ],
      "site": "袁州分宜（今江西宜春）",
      "siteEn": "Fenyi, Yuanzhou Prefecture (Yichun, Jiangxi)",
      "zh": "宋应星任袁州府分宜教谕期间刊印《天工开物》，总结百工技艺",
      "en": "While teaching in Yuanzhou Prefecture (Yichun), Song Yingxing publishes Tiangong Kaiwu"
    },
    {
      "dynastyKey": "beisong",
      "year": 1083,
      "coord": [
        119.01,
        25.43
      ],
      "site": "兴化军（今福建莆田）",
      "siteEn": "Xinghua Military Prefecture (Putian, Fujian)",
      "zh": "莆田木兰陂历三代接力合龙建成，拒咸蓄淡灌溉兴化平原万顷良田",
      "en": "The Mulan Weir irrigation project is completed in Putian, turning the plain into fertile fields"
    },
    {
      "dynastyKey": "ming",
      "year": 1562,
      "coord": [
        119.01,
        25.43
      ],
      "site": "兴化府（今福建莆田）",
      "siteEn": "Xinghua Prefecture (Putian, Fujian)",
      "zh": "戚继光率军疾驰入闽，连破横屿、林墩与平海卫倭巢收复莆田",
      "en": "General Qi Jiguang leads his army into Fujian, routing Wokou pirates to recover Putian"
    },
    {
      "dynastyKey": "donghan",
      "year": 208,
      "coord": [
        111.79,
        30.82
      ],
      "site": "当阳长坂（今湖北荆门当阳）",
      "siteEn": "Changban, Dangyang (Jingmen, Hubei)",
      "zh": "曹操精骑追刘备于当阳长坂，赵云单骑救主、张飞据水断桥",
      "en": "Cao Cao overtakes Liu Bei at Changban in Dangyang (Jingmen), where Zhao Yun rescues Liu Shan"
    },
    {
      "dynastyKey": "donghan",
      "year": 219,
      "coord": [
        111.79,
        30.82
      ],
      "site": "当阳麦城（今湖北荆门当阳）",
      "siteEn": "Maicheng, Dangyang (Jingmen, Hubei)",
      "zh": "吕蒙袭取江陵，关羽退保当阳麦城，年底突围至临沮漳乡遇害",
      "en": "Cut off after the fall of Jiangling, Guan Yu retreats to Maicheng in Dangyang before falling"
    },
    {
      "dynastyKey": "zhanguo",
      "year": -400,
      "coord": [
        113.38,
        31.69
      ],
      "site": "随邑（今湖北随州）",
      "siteEn": "Sui / Zeng State (Suizhou, Hubei)",
      "zh": "曾国（随国）立国汉东，曾侯乙墓六十五件青铜编钟冠绝先秦礼乐",
      "en": "The Marquis Yi of Zeng bronze chime bells at Suizhou showcase pre-Qin ritual music mastery"
    },
    {
      "dynastyKey": "ming",
      "year": 1412,
      "coord": [
        111.08,
        32.54
      ],
      "site": "均州武当山（今湖北十堰丹江口）",
      "siteEn": "Mount Wudang, Jun Zhou (Shiyan, Hubei)",
      "zh": "明成祖敕调军民三十万大修均州武当山，历十二年建成太和宫道场",
      "en": "Emperor Yongle mobilizes 300,000 artisans over twelve years to build Mount Wudang's temples"
    },
    {
      "dynastyKey": "ming",
      "year": 1476,
      "coord": [
        110.78,
        32.65
      ],
      "site": "郧阳府（今湖北十堰郧阳）",
      "siteEn": "Yunyang Prefecture (Shiyan, Hubei)",
      "zh": "都御史原杰抚治荆襄流民，于秦鄂豫交界置郧阳府并设郧阳抚治",
      "en": "Imperial Commissioner Yuan Jie establishes Yunyang Prefecture at Shiyan to settle migrants"
    },
    {
      "dynastyKey": "nansong",
      "year": 1225,
      "coord": [
        111.47,
        27.24
      ],
      "site": "宝庆府（今湖南邵阳）",
      "siteEn": "Baoqing Prefecture (Shaoyang, Hunan)",
      "zh": "宋理宗赵昀即位改元宝庆，以潜邸升邵州为宝庆府，控扼湘西南",
      "en": "Emperor Lizong of Song elevates his former fief Shao Zhou to Baoqing Prefecture (Shaoyang)"
    },
    {
      "dynastyKey": "qing",
      "year": 1842,
      "coord": [
        111.47,
        27.24
      ],
      "site": "宝庆邵阳（今湖南邵阳）",
      "siteEn": "Baoqing / Shaoyang (Hunan)",
      "zh": "邵阳人魏源据林则徐《四洲志》编成《海国图志》，倡师夷长技",
      "en": "Shaoyang scholar Wei Yuan compiles the Illustrated Treatise on the Maritime Kingdoms"
    },
    {
      "dynastyKey": "qin",
      "year": -206,
      "coord": [
        113.01,
        25.77
      ],
      "site": "郴县（今湖南郴州）",
      "siteEn": "Chen County (Chenzhou, Hunan)",
      "zh": "项羽尊楚怀王心为义帝并徙于江南郴县，旋密令英布弑之于郴江",
      "en": "Xiang Yu exiles Emperor Yi of Chu to Chen County (Chenzhou) and orders his assassination"
    },
    {
      "dynastyKey": "donghan",
      "year": 105,
      "coord": [
        113.01,
        25.77
      ],
      "site": "桂阳郴县（今湖南郴州）",
      "siteEn": "Chen County, Guiyang (Chenzhou, Hunan)",
      "zh": "桂阳郡郴县人蔡伦用树皮麻头改良造纸术奏上汉和帝，称“蔡侯纸”",
      "en": "Cai Lun of Guiyang Commandery (Chenzhou) presents his improved papermaking process to the court"
    },
    {
      "dynastyKey": "tang",
      "year": 748,
      "coord": [
        109.68,
        27.44
      ],
      "site": "龙标（今湖南怀化黔阳）",
      "siteEn": "Longbiao (Huaihua, Hunan)",
      "zh": "王昌龄贬龙标（今怀化）尉筑芙蓉楼，李白寄诗“随君直到夜郎西”",
      "en": "Poet Wang Changling is exiled to Longbiao (Huaihua), inspiring Li Bai's famous farewell poem"
    },
    {
      "dynastyKey": "roc",
      "year": 1945,
      "coord": [
        109.68,
        27.44
      ],
      "site": "芷江（今湖南怀化芷江）",
      "siteEn": "Zhijiang (Huaihua, Hunan)",
      "zh": "中国陆军总司令部于湖南芷江受降堂接受侵华日军今井武夫洽降",
      "en": "Chinese forces accept the preliminary surrender of Japanese troops in China at Zhijiang"
    },
    {
      "dynastyKey": "tang",
      "year": 677,
      "coord": [
        113.6,
        24.81
      ],
      "site": "韶州曹溪（今广东韶关）",
      "siteEn": "Caoxi, Shao Zhou (Shaoguan, Guangdong)",
      "zh": "禅宗六祖慧能驻锡韶州曹溪宝林寺弘法三十七年，口述《六祖坛经》",
      "en": "Sixth Patriarch Huineng teaches Chan Buddhism for 37 years at Baolin Temple in Shaoguan"
    },
    {
      "dynastyKey": "tang",
      "year": 716,
      "coord": [
        113.6,
        24.81
      ],
      "site": "韶州曲江（今广东韶关）",
      "siteEn": "Qujiang, Shao Zhou (Shaoguan, Guangdong)",
      "zh": "韶州曲江人张九龄主持开凿大庾岭梅关新道，打通南北商贸坦途",
      "en": "Chancellor Zhang Jiuling of Qujiang (Shaoguan) cuts the Meiguan Pass road over Dayu Ridge"
    },
    {
      "dynastyKey": "beisong",
      "year": 1118,
      "coord": [
        112.47,
        23.05
      ],
      "site": "肇庆府（今广东肇庆）",
      "siteEn": "Zhaoqing Prefecture (Zhaoqing, Guangdong)",
      "zh": "宋徽宗以潜邸端王升端州为肇庆府，亲书“肇庆府”御匾赐之",
      "en": "Emperor Huizong elevates his former fief Duan Zhou to Zhaoqing Prefecture and inscribes its name"
    },
    {
      "dynastyKey": "ming",
      "year": 1583,
      "coord": [
        112.47,
        23.05
      ],
      "site": "肇庆府（今广东肇庆）",
      "siteEn": "Zhaoqing Prefecture (Zhaoqing, Guangdong)",
      "zh": "利玛窦获准入驻两广总督驻地肇庆，绘成中文世界地图《山海舆地全图》",
      "en": "Jesuit Matteo Ricci settles at Zhaoqing and produces the first Chinese world map"
    },
    {
      "dynastyKey": "qing",
      "year": 1646,
      "coord": [
        112.47,
        23.05
      ],
      "site": "肇庆（今广东肇庆）",
      "siteEn": "Zhaoqing (Guangdong)",
      "zh": "桂王朱由榔于广东肇庆称帝改元永历，以肇庆为南明抗清中枢",
      "en": "Zhu Youlang, Prince of Gui, is proclaimed the Yongli Emperor at Zhaoqing to resist the Qing"
    },
    {
      "dynastyKey": "beisong",
      "year": 1023,
      "coord": [
        110.08,
        20.91
      ],
      "site": "雷州（今广东湛江雷州）",
      "siteEn": "Lei Zhou (Zhanjiang, Guangdong)",
      "zh": "北宋名相寇准贬雷州司户参军卒于任上，州民感其忠直建莱公祠",
      "en": "Former Song Chancellor Kou Zhun dies in exile at Lei Zhou (Zhanjiang), honored by a local shrine"
    },
    {
      "dynastyKey": "sui",
      "year": 589,
      "coord": [
        110.85,
        21.92
      ],
      "site": "高凉（今广东茂名高州）",
      "siteEn": "Gaoliang (Gaozhou, Maoming, Guangdong)",
      "zh": "岭南高凉冼夫人率百越诸州奉表归隋，隋文帝册封其为谯国夫人",
      "en": "Lady Xian of Gaoliang (Maoming) leads Lingnan into peaceful reunification under the Sui"
    },
    {
      "dynastyKey": "xihan",
      "year": -106,
      "coord": [
        111.28,
        23.48
      ],
      "site": "苍梧广信（今广西梧州）",
      "siteEn": "Guangxin, Cangwu (Wuzhou, Guangxi)",
      "zh": "汉武帝置交趾刺史部治苍梧郡广信县（今梧州），广信分界广东广西",
      "en": "Emperor Wu places the Jiaozhi Inspector at Guangxin (Wuzhou), dividing Guangdong and Guangxi"
    },
    {
      "dynastyKey": "ming",
      "year": 1470,
      "coord": [
        111.28,
        23.48
      ],
      "site": "梧州府（今广西梧州）",
      "siteEn": "Wuzhou Prefecture (Wuzhou, Guangxi)",
      "zh": "明廷于梧州设两广总督府与总镇府，统摄广东广西军政百余年",
      "en": "The Ming court establishes the Viceroy of Liangguang at Wuzhou to govern Guangdong and Guangxi"
    },
    {
      "dynastyKey": "xihan",
      "year": -111,
      "coord": [
        109.2,
        21.66
      ],
      "site": "合浦（今广西北海合浦）",
      "siteEn": "Hepu (Beihai, Guangxi)",
      "zh": "汉武帝平南越置合浦郡，合浦港成为汉代海上丝绸之路始发港",
      "en": "Emperor Wu establishes Hepu Commandery (Beihai), a primary port of the Han Maritime Silk Road"
    },
    {
      "dynastyKey": "donghan",
      "year": 103,
      "coord": [
        109.2,
        21.66
      ],
      "site": "合浦郡（今广西北海合浦）",
      "siteEn": "Hepu Commandery (Beihai, Guangxi)",
      "zh": "孟尝出任合浦太守革除滥采海珠弊政，不出岁余“去珠复还”",
      "en": "Grand Administrator Meng Chang reforms pearl-harvesting in Hepu, restoring the pearl beds"
    },
    {
      "dynastyKey": "tang",
      "year": 748,
      "coord": [
        109.18,
        18.36
      ],
      "site": "振州（今海南三亚崖州）",
      "siteEn": "Zhen Zhou (Yazhou, Sanya, Hainan)",
      "zh": "鉴真第五次东渡遇飓风漂至海南振州（今三亚），留大云寺传戒一年",
      "en": "Blown off course by a typhoon, Monk Jianzhen lands at Zhen Zhou (Sanya) and teaches for a year"
    },
    {
      "dynastyKey": "yuan",
      "year": 1295,
      "coord": [
        109.18,
        18.36
      ],
      "site": "崖州（今海南三亚崖州）",
      "siteEn": "Ya Zhou (Sanya, Hainan)",
      "zh": "黄道婆自崖州水南村习得黎族棉纺织绝技返松江，革新江南棉纺",
      "en": "After learning Li textile skills in Ya Zhou (Sanya), Huang Daopo revolutionizes cotton weaving"
    },
    {
      "dynastyKey": "donghan",
      "year": 32,
      "coord": [
        106.67,
        35.54
      ],
      "site": "高平第一城（今甘肃平凉）",
      "siteEn": "Gaoping (Pingliang, Gansu)",
      "zh": "汉光武帝刘秀亲征陇右至高平第一城（今平凉），会窦融兵合围隗嚣",
      "en": "Emperor Guangwu marches to Gaoping (Pingliang), joining Dou Rong's forces against Wei Xiao"
    },
    {
      "dynastyKey": "tang",
      "year": 787,
      "coord": [
        106.67,
        35.54
      ],
      "site": "平凉川（今甘肃平凉）",
      "siteEn": "Pingliang (Gansu)",
      "zh": "唐德宗遣浑瑊与吐蕃会盟于平凉川，吐蕃伏兵劫盟史称平凉劫盟",
      "en": "Tibetan forces ambush Tang envoy Hun Jian during treaty talks in the Ambush of Pingliang"
    },
    {
      "dynastyKey": "zhanguo",
      "year": -272,
      "coord": [
        107.64,
        35.71
      ],
      "site": "义渠（今甘肃庆阳）",
      "siteEn": "Yiqu / Beidi (Qingyang, Gansu)",
      "zh": "秦宣太后诱杀义渠戎王，起兵灭义渠国，于陇东置北地郡筑长城",
      "en": "Queen Dowager Xuan of Qin eliminates Yiqu, establishing Beidi Commandery at Qingyang"
    },
    {
      "dynastyKey": "beisong",
      "year": 1041,
      "coord": [
        107.64,
        35.71
      ],
      "site": "庆州（今甘肃庆阳）",
      "siteEn": "Qing Zhou (Qingyang, Gansu)",
      "zh": "范仲淹知庆州兼掌环庆路，抢筑大顺城稳固宋夏中路防线",
      "en": "Fan Zhongyan governs Qing Zhou (Qingyang) and builds Dashun Fortress against Western Xia"
    },
    {
      "dynastyKey": "donghan",
      "year": 69,
      "coord": [
        99.16,
        25.11
      ],
      "site": "永昌郡（今云南保山）",
      "siteEn": "Yongchang Commandery (Baoshan, Yunnan)",
      "zh": "哀牢王柳貌率五十余万口内属东汉，汉明帝置永昌郡（治今保山）",
      "en": "King Liumao of Ailao submits to Eastern Han, which establishes Yongchang Commandery at Baoshan"
    },
    {
      "dynastyKey": "ming",
      "year": 1382,
      "coord": [
        102.83,
        23.62
      ],
      "site": "临安府（今云南红河建水）",
      "siteEn": "Lin'an Prefecture (Jianshui, Honghe, Yunnan)",
      "zh": "明军平滇改临安路为临安府（治建水），拓建砖城文庙号滇南邹鲁",
      "en": "The Ming court establishes Lin'an Prefecture at Jianshui (Honghe) and builds its brick walls"
    },
    {
      "dynastyKey": "tang",
      "year": 779,
      "coord": [
        91.5,
        29.32
      ],
      "site": "桑耶寺（今西藏山南扎囊）",
      "siteEn": "Samye Monastery (Shannan, Tibet)",
      "zh": "赤松德赞迎莲花生与寂护于山南建成西藏首座佛法僧俱全桑耶寺",
      "en": "Tibetan Emperor Trisong Detsen completes Samye Monastery in Shannan, Tibet's first monastery"
    },
    {
      "dynastyKey": "yuan",
      "year": 1354,
      "coord": [
        91.77,
        29.24
      ],
      "site": "乃东（今西藏山南泽当）",
      "siteEn": "Nedong / Tsetang (Shannan, Tibet)",
      "zh": "帕木竹巴绛曲坚赞统一卫藏，以山南乃东（泽当）为首府建帕竹政权",
      "en": "Jangchub Gyaltsen unifies Central Tibet from Nedong in Shannan, founding the Phagmodrupa rule"
    },
    {
      "dynastyKey": "tang",
      "year": 644,
      "coord": [
        80.4,
        31.15
      ],
      "site": "象雄穹窿银城（今西藏阿里噶尔）",
      "siteEn": "Khyunglung, Zhangzhung (Ngari, Tibet)",
      "zh": "吐蕃赞普松赞干布亲征灭象雄王国，将藏西阿里高原并入吐蕃版图",
      "en": "Tibetan Emperor Songtsen Gampo conquers Zhangzhung, incorporating Ngari into the Tibetan Empire"
    },
    {
      "dynastyKey": "beisong",
      "year": 1042,
      "coord": [
        79.8,
        31.48
      ],
      "site": "古格托林寺（今西藏阿里札达）",
      "siteEn": "Tholing Monastery, Guge (Zanda, Ngari, Tibet)",
      "zh": "古格王室迎印度高僧阿底峡抵阿里托林寺译经，开启藏传佛教后弘期",
      "en": "The Guge court welcomes Indian master Atisha to Tholing Monastery in Ngari to translate sutras"
    },
    {
      "dynastyKey": "qing",
      "year": 1876,
      "coord": [
        121.2,
        37.3
      ],
      "site": "烟台芝罘（今山东烟台）",
      "siteEn": "Chefoo, Yantai (Yantai, Shandong)",
      "zh": "李鸿章于芝罘签订《烟台条约》，增开宜昌、芜湖、温州、北海通商",
      "en": "Li Hongzhang signs the Chefoo Convention at Yantai, opening four more treaty ports"
    },
    {
      "dynastyKey": "roc",
      "year": 1929,
      "coord": [
        117.02,
        25.08
      ],
      "site": "上杭古田（今福建龙岩）",
      "siteEn": "Gutian, Shanghang (Longyan, Fujian)",
      "zh": "红四军在闽西龙岩上杭召开古田会议，确立思想建党、政治建军原则",
      "en": "Gutian Conference in Longyan establishes the foundational principle of political army building"
    }
  ],
  "GUQIN_TRACKS": [
    {
      "zh": "流水",
      "en": "Flowing Water",
      "mp3": "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e0/Liu_Shui.ogg/Liu_Shui.ogg.mp3",
      "ogg": "https://upload.wikimedia.org/wikipedia/commons/e/e0/Liu_Shui.ogg"
    },
    {
      "zh": "平沙落雁",
      "en": "Wild Geese on the Sandbank",
      "mp3": "https://upload.wikimedia.org/wikipedia/commons/transcoded/5/5a/Pingsha_Luoyan.ogg/Pingsha_Luoyan.ogg.mp3",
      "ogg": "https://upload.wikimedia.org/wikipedia/commons/5/5a/Pingsha_Luoyan.ogg"
    },
    {
      "zh": "阳关三叠",
      "en": "Parting at Yangguan",
      "mp3": "https://upload.wikimedia.org/wikipedia/commons/transcoded/6/60/Guqin-Yangguan_Sandie.ogg/Guqin-Yangguan_Sandie.ogg.mp3",
      "ogg": "https://upload.wikimedia.org/wikipedia/commons/6/60/Guqin-Yangguan_Sandie.ogg"
    },
    {
      "zh": "醉渔唱晚",
      "en": "Drunken Fisherman",
      "mp3": "https://upload.wikimedia.org/wikipedia/commons/transcoded/5/52/Guqin-Zuiyu_Changwan.ogg/Guqin-Zuiyu_Changwan.ogg.mp3",
      "ogg": "https://upload.wikimedia.org/wikipedia/commons/5/52/Guqin-Zuiyu_Changwan.ogg"
    },
    {
      "zh": "酒狂",
      "en": "Wine Madness",
      "mp3": "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/8f/Jiu_Kuang.ogg/Jiu_Kuang.ogg.mp3",
      "ogg": "https://upload.wikimedia.org/wikipedia/commons/8/8f/Jiu_Kuang.ogg"
    }
  ],
  "HISTORICAL_JOURNEYS": [
    {
      "key": "qinshihuang",
      "dynastyKey": "zhanguo",
      "color": "#3d3934",
      "shortZh": "秦始皇扫六合",
      "shortEn": "Qin Shi Huang",
      "titleZh": "秦始皇一统六国行迹",
      "titleEn": "Qin Shi Huang's Unification Campaigns",
      "spanZh": "前238年 — 前221年（秦王政九年至二十六年）",
      "spanEn": "238 BCE – 221 BCE (Reign of King Zheng of Qin)",
      "stops": [
        {
          "year": -238,
          "eraZh": "秦王政九年",
          "ancientZh": "咸阳",
          "modernZh": "陕西咸阳",
          "ancientEn": "Xianyang",
          "modernEn": "Xianyang, Shaanxi",
          "coord": [
            108.71,
            34.33
          ],
          "labelPos": "bottom",
          "titleZh": "亲政平乱 · 蓄势东出",
          "titleEn": "Assuming Personal Rule & Grand Strategy",
          "descZh": "二十二岁的秦王政在故都雍城蕲年宫行冠礼亲政，旋即发兵平定长信侯嫪毐之乱，次年罢免相邦吕不韦。随后采纳大梁人尉缭、楚人李斯「远交近攻、先弱后强、各个击破」之策，倾关中与巴蜀之力，蓄势东出函谷关。",
          "descEn": "At age 22, King Zheng of Qin assumed personal rule, crushed Lao Ai’s rebellion, dismissed Chancellor Lü Buwei, and adopted Li Si and Wei Liao’s grand strategy to annex the six eastern states one by one.",
          "quoteZh": "「秦王为人，蜂准，长目，挚鸟膺，豺声，少恩而虎狼之心……诚得志于天下，天下皆为虏矣。」——《史记·秦始皇本纪》引尉缭语",
          "quoteEn": "“With the resources of Qin and the strategy of annexing the feudal lords, the whole world can be unified under one rule.” — Records of the Grand Historian (Shiji)"
        },
        {
          "year": -236,
          "eraZh": "秦王政十一年",
          "ancientZh": "邺城",
          "modernZh": "河北临漳西南",
          "ancientEn": "Ye (Yecheng)",
          "modernEn": "Linzhang, Hebei",
          "coord": [
            114.35,
            36.32
          ],
          "fromCoord": [
            108.71,
            34.33
          ],
          "via": [
            [
              110.35,
              34.62
            ],
            [
              112.5,
              35.5
            ]
          ],
          "labelPos": "bottom",
          "titleZh": "攻赵取邺 · 灭国序幕",
          "titleEn": "Capture of Ye — Opening the Unification Wars",
          "descZh": "趁赵燕交兵、赵军主力北上攻燕之际，秦王政命王翦、桓齮、杨端和三路大军东出伐赵，连拔邺城、阏与等九城。此役夺取赵国南部漳水门户，正式拉开秦灭六国十年统一战争的序幕。",
          "descEn": "Exploiting a war between Zhao and Yan, Qin generals Wang Jian, Huan Yi, and Yang Duanhe marched east and captured nine Zhao cities including Ye and Yanyu, opening the unification wars.",
          "quoteZh": "「十一年，王翦、桓齮、杨端和攻邺，取九城。」——《史记·秦始皇本纪》",
          "quoteEn": "“In the 11th year, Wang Jian, Huan Yi, and Yang Duanhe attacked Ye and took nine cities.” — Shiji"
        },
        {
          "year": -230,
          "eraZh": "秦王政十七年",
          "ancientZh": "新郑",
          "modernZh": "河南新郑",
          "ancientEn": "Xinzheng",
          "modernEn": "Xinzheng, Henan",
          "coord": [
            113.74,
            34.4
          ],
          "fromCoord": [
            108.71,
            34.33
          ],
          "via": [
            [
              110.35,
              34.62
            ],
            [
              112.45,
              34.62
            ]
          ],
          "labelPos": "bottom",
          "titleZh": "内史腾灭韩 · 六国首灭",
          "titleEn": "Conquest of Han — First of the Six States to Fall",
          "descZh": "韩国扼守函谷关外，为秦东进首冲。秦内史腾率军渡河急袭韩都新郑，一举俘虏韩王安，尽收其地设立颍川郡（治阳翟）。韩国成为战国七雄中第一个覆灭的诸侯国，秦军由此牢牢扼住中原腹心。",
          "descEn": "Commandery Governor Teng marched on the Han capital Xinzheng, captured King An of Han, and established Yingchuan Commandery. Han became the first of the six states to fall.",
          "quoteZh": "「十七年，内史腾攻韩，得韩王安，尽纳其地，以其地为郡，命曰颍川。」——《史记·秦始皇本纪》",
          "quoteEn": "“In the 17th year, Governor Teng attacked Han, captured King An, and made his territory Yingchuan Commandery.” — Shiji"
        },
        {
          "year": -228,
          "eraZh": "秦王政十九年",
          "ancientZh": "邯郸",
          "modernZh": "河北邯郸",
          "ancientEn": "Handan",
          "modernEn": "Handan, Hebei",
          "coord": [
            114.48,
            36.61
          ],
          "fromCoord": [
            113.74,
            34.4
          ],
          "via": [
            [
              114.15,
              35.55
            ]
          ],
          "labelPos": "top",
          "titleZh": "王翦克邯郸 · 破灭赵国",
          "titleEn": "Fall of Handan — Conquest of Zhao",
          "descZh": "赵国名将李牧屡挫秦军。秦军重金行反间计于赵王宠臣郭开，赵王迁自毁长城冤杀李牧、废司马尚。王翦遂猛攻大破赵军，于前228年攻克赵都邯郸，俘赵王迁；秦王政亲赴邯郸尽坑昔日母家仇人。赵公子嘉率宗族北奔代郡称代王。",
          "descEn": "After a Qin espionage plot induced King Qian of Zhao to execute his brilliant general Li Mu, Wang Jian shattered the Zhao army and captured Handan. Prince Jia fled north to establish the rump state of Dai.",
          "quoteZh": "「赵葱死，颜聚亡，后三月，王翦因急击，大破赵，杀赵葱，虏赵王迁及其将颜聚，遂灭赵。」——《战国策》及《史记》",
          "quoteEn": "“Wang Jian pressed the attack, shattered the Zhao forces, and captured King Qian, extinguishing Zhao.” — Shiji"
        },
        {
          "year": -226,
          "eraZh": "秦王政二十一年",
          "ancientZh": "蓟城",
          "modernZh": "北京西南",
          "ancientEn": "Jicheng (Yan Capital)",
          "modernEn": "Beijing",
          "coord": [
            116.32,
            39.9
          ],
          "fromCoord": [
            114.48,
            36.61
          ],
          "via": [
            [
              115.48,
              38.85
            ],
            [
              115.8,
              39.32
            ]
          ],
          "labelPos": "top",
          "titleZh": "图穷匕见与易水破燕 · 攻拔蓟城",
          "titleEn": "Battle of Yi River & Capture of Jicheng",
          "descZh": "秦军饮马易水，燕太子丹于前227年遣荆轲歌「风萧萧兮易水寒」入咸阳献督亢地图刺秦，图穷匕见未果。秦王政震怒，命王翦、辛胜率主力北伐，于易水之西大破燕代联军，前226年十月攻拔燕都蓟城。燕王喜斩太子丹首级献秦求和未果，退保辽东襄平。",
          "descEn": "After Jing Ke’s failed assassination attempt in Xianyang (227 BCE), Wang Jian crushed the Yan-Dai army west of the Yi River and captured the Yan capital Jicheng in 226 BCE. King Xi of Yan fled east to Liaodong.",
          "quoteZh": "「风萧萧兮易水寒，壮士一去兮不复还！」——《战国策·燕策三》",
          "quoteEn": "“The wind blows shrill and the Yi River is cold; once the hero departs, he shall never return!” — Intrigues of the Warring States"
        },
        {
          "year": -225,
          "eraZh": "秦王政二十二年",
          "ancientZh": "大梁",
          "modernZh": "河南开封",
          "ancientEn": "Daliang",
          "modernEn": "Kaifeng, Henan",
          "coord": [
            114.35,
            34.79
          ],
          "fromCoord": [
            108.71,
            34.33
          ],
          "via": [
            [
              110.35,
              34.62
            ],
            [
              112.45,
              34.62
            ]
          ],
          "labelPos": "bottom",
          "titleZh": "王贲水灌大梁 · 荡平魏国",
          "titleEn": "Flooding of Daliang — Conquest of Wei",
          "descZh": "魏都大梁城垣坚厚、护城河深广，易守难攻。王翦之子王贲率军南下攻魏，掘开黄河与鸿沟水渠引水灌城。浸灌三月，大梁城墙崩坏，魏王假出降被杀，秦尽收魏地设砀郡，三晋至此尽入于秦。",
          "descEn": "Facing the heavily fortified Wei capital of Daliang, Wang Ben diverted the Yellow River and Honggou Canal to flood the city for three months until its walls collapsed. King Jia surrendered, ending the state of Wei.",
          "quoteZh": "「二十二年，王贲攻魏，引河沟灌大梁，大梁城坏，其王请降，尽取其地。」——《史记·秦始皇本纪》",
          "quoteEn": "“In the 22nd year, Wang Ben attacked Wei, channeled the Yellow River to flood Daliang, and took all its land.” — Shiji"
        },
        {
          "year": -223,
          "eraZh": "秦王政二十四年",
          "ancientZh": "寿春",
          "modernZh": "安徽寿县",
          "ancientEn": "Shouchun",
          "modernEn": "Shouxian, Anhui",
          "coord": [
            116.78,
            32.58
          ],
          "fromCoord": [
            114.35,
            34.79
          ],
          "via": [
            [
              114.88,
              33.78
            ],
            [
              115.8,
              33.1
            ]
          ],
          "labelPos": "bottom",
          "titleZh": "王翦六十万破楚 · 攻克寿春",
          "titleEn": "Six Hundred Thousand Troops — Conquest of Chu",
          "descZh": "李信率二十万秦军伐楚先胜后败，为项燕所乘。秦王政亲赴频阳向老将王翦谢过，倾全国六十万大军托付王翦、蒙武。王翦坚壁不出以老楚师，待楚军东撤之际大举追击，于蕲南击杀项燕，攻克楚都寿春，俘楚王负刍，广袤楚地尽归于秦。",
          "descEn": "After Li Xin’s setback, King Zheng entrusted 600,000 troops to veteran general Wang Jian. Wearing down the Chu forces before striking decisively, Wang Jian captured Shouchun and King Fuchu, conquering Chu.",
          "quoteZh": "「王翦果代李信击荆……荆数挑战而秦不出。乃引而东。翦因举兵追之，令壮士击，大破荆军。」——《史记·白起王翦列传》",
          "quoteEn": "“Chu repeatedly challenged Qin to battle, yet Wang Jian held firm inside his ramparts until Chu retreated east, then struck with full force and routed them.” — Shiji"
        },
        {
          "year": -222,
          "eraZh": "秦王政二十五年",
          "ancientZh": "襄平",
          "modernZh": "辽宁辽阳",
          "ancientEn": "Xiangping (Liaodong)",
          "modernEn": "Liaoyang, Liaoning",
          "coord": [
            123.17,
            41.27
          ],
          "fromCoord": [
            116.32,
            39.9
          ],
          "via": [
            [
              118.9,
              40.05
            ],
            [
              121.1,
              41.1
            ]
          ],
          "labelPos": "top",
          "titleZh": "远征辽东 · 灭燕平代定江南",
          "titleEn": "Liaodong Campaign — Extinguishing Yan & Dai",
          "descZh": "王贲、李信挥师东北远征辽东，攻破襄平，俘燕王喜，燕国彻底灭亡；旋即回师北击代郡，俘代王嘉，赵氏余脉亦绝。同年南线王翦大军渡江平定楚国江南旧地，降服越君，置会稽郡。天下六国仅余东海之滨的齐国孤悬。",
          "descEn": "Wang Ben and Li Xin marched into Liaodong to capture King Xi of Yan at Xiangping, then turned west to capture King Jia of Dai, while Wang Jian pacified Jiangnan and established Kuaiji Commandery.",
          "quoteZh": "「二十五年，大兴兵，使王贲将，攻燕辽东，得燕王喜。还攻代，虏代王嘉。王翦遂定荆江南地。」——《史记·秦始皇本纪》",
          "quoteEn": "“In the 25th year, Wang Ben attacked Liaodong, captured King Xi of Yan, and returned to capture King Jia of Dai, while Wang Jian pacified Jiangnan.” — Shiji"
        },
        {
          "year": -221,
          "eraZh": "秦始皇二十六年",
          "ancientZh": "临淄",
          "modernZh": "山东淄博临淄",
          "ancientEn": "Linzi",
          "modernEn": "Zibo, Shandong",
          "coord": [
            118.35,
            36.82
          ],
          "fromCoord": [
            116.32,
            39.9
          ],
          "via": [
            [
              116.6,
              38.2
            ],
            [
              117,
              36.9
            ]
          ],
          "labelPos": "bottom",
          "titleZh": "六王毕 · 四海一（齐降天下一统）",
          "titleEn": "Surrender of Qi at Linzi — Empire Unified",
          "descZh": "齐相后胜受秦重金贿赂，劝齐王建不修战备、不援五国，仅于西界屯兵防秦。前221年，王贲、李信、蒙恬自燕地南下避开齐军西境主力，径直突入齐都临淄，齐王建不战出降。秦王政遂完成统一大业，定尊号「始皇帝」，废分封、设三十六郡，开创中国两千年大一统格局。",
          "descEn": "Bypassing Qi’s western border defenses, Wang Ben, Li Xin, and Meng Tian plunged south from Yan straight into Linzi. King Jian of Qi surrendered without a battle, completing the unification of China under the First Emperor.",
          "quoteZh": "「六王毕，四海一。」——杜牧《阿房宫赋》 · 「秦初并天下……法令由一统。」——《史记·秦始皇本纪》",
          "quoteEn": "“The six kings met their end, and the four seas became one.” — Du Mu, Rhapsody on Epang Palace"
        }
      ]
    },
    {
      "key": "zhangqian",
      "dynastyKey": "xihan",
      "color": "#a83b24",
      "shortZh": "张骞凿空西域",
      "shortEn": "Zhang Qian",
      "titleZh": "张骞凿空西域行迹",
      "titleEn": "Zhang Qian's Mission to the Western Regions",
      "spanZh": "前138年 — 前126年（西汉建元三年至元朔三年）",
      "spanEn": "138 BCE – 126 BCE (Western Han)",
      "stops": [
        {
          "year": -138,
          "eraZh": "建元三年",
          "coord": [
            108.94,
            34.26
          ],
          "labelPos": "top",
          "ancientZh": "长安",
          "modernZh": "陕西西安",
          "ancientEn": "Chang'an",
          "modernEn": "Xi'an, Shaanxi",
          "titleZh": "奉诏募使·发自长安",
          "titleEn": "Imperial Commission at Chang'an",
          "descZh": "汉武帝欲联合大月氏共击匈奴，张骞以郎应募，与堂邑氏胡奴甘父率百余人自长安出发西行。",
          "descEn": "Emperor Wu of Han sought an alliance with the Great Yuezhi against the Xiongnu; Zhang Qian volunteered and departed Chang'an with over a hundred men.",
          "quoteZh": "《史记·大宛列传》：“骞以郎应募，使月氏，与堂邑氏胡奴甘父俱出陇西。”",
          "quoteEn": "Records of the Grand Historian: \"Zhang Qian volunteered as a palace attendant to go as envoy to the Yuezhi, departing Longxi with Ganfu.\""
        },
        {
          "year": -138,
          "eraZh": "建元三年",
          "coord": [
            103.86,
            35.38
          ],
          "labelPos": "bottom",
          "ancientZh": "陇西",
          "modernZh": "甘肃临洮",
          "ancientEn": "Longxi",
          "modernEn": "Lintao, Gansu",
          "titleZh": "出陇西塞·踏入绝域",
          "titleEn": "Crossing the Longxi Frontier",
          "descZh": "自陇西郡出塞西渡黄河，踏入匈奴右贤王与浑邪王控扼的河西之地，由此西去万里皆属未知绝域。",
          "descEn": "Crossing the Han frontier at Longxi Commandery into the Xiongnu-held Hexi Corridor toward the uncharted Western Regions.",
          "quoteZh": "《汉书·张骞传》：“出陇西，径匈奴，匈奴得之。”",
          "quoteEn": "Book of Han: \"Departing Longxi, he passed through Xiongnu territory and was captured.\""
        },
        {
          "year": -138,
          "eraZh": "建元三年",
          "coord": [
            102.64,
            37.93
          ],
          "labelPos": "top",
          "ancientZh": "姑臧·河西",
          "modernZh": "甘肃武威",
          "ancientEn": "Guzang (Hexi)",
          "modernEn": "Wuwei, Gansu",
          "titleZh": "羁留匈奴·持节十载",
          "titleEn": "Detained by the Xiongnu for a Decade",
          "descZh": "途经河西走廊为匈奴骑兵截获，押送单于王庭。单于予妻生子，然张骞始终“持汉节不失”，羁留十余载待机西奔。",
          "descEn": "Captured in the Hexi Corridor and held for over ten years by the Xiongnu Chanyu, yet Zhang Qian never relinquished his Han imperial tally.",
          "quoteZh": "《史记·大宛列传》：“留骞十余岁，予妻，有子，然骞持汉节不失。”",
          "quoteEn": "Records of the Grand Historian: \"Detained over ten years and given a wife and son, yet Zhang Qian kept his Han imperial staff unblemished.\""
        },
        {
          "year": -129,
          "eraZh": "元光六年",
          "coord": [
            86.57,
            42.06
          ],
          "via": [
            [
              95.2,
              40.6
            ]
          ],
          "labelPos": "top",
          "ancientZh": "焉耆·北道",
          "modernZh": "新疆焉耆",
          "ancientEn": "Yanqi (Karasahr)",
          "modernEn": "Yanqi, Xinjiang",
          "titleZh": "乘隙脱走·疾驰西域北道",
          "titleEn": "Escape Along the Northern Tarim Oasis Route",
          "descZh": "匈奴监管渐宽，张骞与甘父乘隙逃脱，循天山南麓绿洲昼夜西驰数十日，穿越车师、焉耆、龟兹诸国。",
          "descEn": "Seizing a moment of lax guard, Zhang Qian and Ganfu escaped westward for dozens of days along the northern Tarim oases at the foot of the Tian Shan.",
          "quoteZh": "《史记·大宛列传》：“居匈奴中，益宽，骞因与其属亡乡月氏，西走数十日。”",
          "quoteEn": "Records of the Grand Historian: \"When surveillance eased, Zhang Qian fled with his men toward the Yuezhi, riding west for dozens of days.\""
        },
        {
          "year": -129,
          "eraZh": "元光六年",
          "coord": [
            71.78,
            40.38
          ],
          "via": [
            [
              78.5,
              40.9
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "大宛·贰师城",
          "modernZh": "费尔干纳盆地",
          "ancientEn": "Dayuan (Fergana)",
          "modernEn": "Fergana Valley",
          "titleZh": "越葱岭抵大宛·得发导译",
          "titleEn": "Crossing the Pamirs to Dayuan (Fergana)",
          "descZh": "翻越帕米尔高原（葱岭）抵达盛产汗血宝马的大宛国。大宛王久闻汉朝饶财欲通而不得，见张骞大喜，特派向导译员护送赴康居。",
          "descEn": "Crossing the Pamir Mountains into Fergana (Dayuan), whose king welcomed Zhang Qian warmly and provided guides and interpreters.",
          "quoteZh": "《史记·大宛列传》：“大宛闻汉之饶财，欲通不得，见骞，喜……为发导驿抵康居。”",
          "quoteEn": "Records of the Grand Historian: \"Dayuan had heard of Han wealth and rejoiced at meeting Zhang Qian, dispatching post-guides to escort him to Kangju.\""
        },
        {
          "year": -129,
          "eraZh": "元光六年",
          "coord": [
            68.78,
            40.85
          ],
          "labelPos": "top",
          "ancientZh": "康居",
          "modernZh": "锡尔河中游",
          "ancientEn": "Kangju (Sogdiana)",
          "modernEn": "Tashkent / Samarkand region",
          "titleZh": "经康居传致大月氏",
          "titleEn": "Relay Through Kangju to the Oxus",
          "descZh": "由大宛导驿护送至康居国，再由康居王庭遣骑护送南下妫水（阿姆河）流域的大月氏王庭。",
          "descEn": "Escorted through Kangju between the Syr Darya and Zeravshan rivers, and relayed southward toward the Amu Darya (Oxus).",
          "quoteZh": "《史记·大宛列传》：“抵康居，康居传致大月氏。”",
          "quoteEn": "Records of the Grand Historian: \"Reaching Kangju, he was relayed onward to the Great Yuezhi.\""
        },
        {
          "year": -128,
          "eraZh": "元朔元年",
          "coord": [
            66.9,
            36.76
          ],
          "labelPos": "bottom",
          "ancientZh": "大月氏·蓝氏城",
          "modernZh": "阿富汗巴尔赫",
          "ancientEn": "Great Yuezhi & Daxia",
          "modernEn": "Balkh, Afghanistan",
          "titleZh": "驻节大月氏与大夏·考索诸国",
          "titleEn": "Court of the Great Yuezhi & Bactria",
          "descZh": "抵阿姆河流域，大月氏已臣服大夏（巴克特里亚），土地肥美安乐，无意东还复仇。张骞驻留岁余，详考大夏、安息、身毒及蜀布竹杖商路。",
          "descEn": "In fertile Bactria, the Yuezhi no longer wished to return east against the Xiongnu. Staying over a year, Zhang Qian documented Parthia, India, and Sichuan trade goods.",
          "quoteZh": "《史记·大宛列传》：“留岁余，还，并南山，欲从羌中归。”",
          "quoteEn": "Records of the Grand Historian: \"After staying over a year, he headed back along the Southern Mountains to return through Qiang lands.\""
        },
        {
          "year": -127,
          "eraZh": "元朔二年",
          "coord": [
            79.92,
            37.11
          ],
          "via": [
            [
              73.5,
              36.8
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "于阗·南道",
          "modernZh": "新疆和田",
          "ancientEn": "Khotan (Yutian)",
          "modernEn": "Hotan, Xinjiang",
          "titleZh": "循昆仑南道东归·复陷匈奴",
          "titleEn": "Return via the Southern Tarim Route",
          "descZh": "为避匈奴控制的天山北道，返程改循昆仑山北麓西域南道，经莎车、于阗、楼兰，欲从羌中归汉，不意复为匈奴游骑所得。",
          "descEn": "To avoid Xiongnu patrols on the northern route, Zhang Qian returned along the Kunlun foothills via Yarkand and Khotan, but was captured again by Xiongnu horsemen.",
          "quoteZh": "《史记·大宛列传》：“并南山，欲从羌中归，复为匈奴所得。”",
          "quoteEn": "Records of the Grand Historian: \"Skirting the Southern Mountains to return via Qiang territory, he was captured once more by the Xiongnu.\""
        },
        {
          "year": -126,
          "eraZh": "元朔三年",
          "coord": [
            109.35,
            34.05
          ],
          "via": [
            [
              90.5,
              37.2
            ],
            [
              100.8,
              36.1
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "长安（归汉）",
          "modernZh": "陕西西安",
          "ancientEn": "Chang'an (Return)",
          "modernEn": "Xi'an, Shaanxi",
          "titleZh": "持节归朝·丝路凿空",
          "titleEn": "Return to Chang'an — Opening the Silk Road",
          "descZh": "元朔三年军臣单于死、匈奴内乱，张骞与胡妻及甘父逃归长安。出使十三载，百余人唯二人得还，封博望侯，史称“凿空”。",
          "descEn": "Amid Xiongnu succession turmoil in 126 BCE, Zhang Qian escaped back to Chang'an with Ganfu—only two survivors of the original hundred—opening the Silk Road.",
          "quoteZh": "《史记·大宛列传》：“初行时百余人，去十三岁，唯二人得还。”",
          "quoteEn": "Records of the Grand Historian: \"Of over a hundred men who set out, after thirteen years only two returned.\""
        }
      ]
    },
    {
      "key": "zhugeliang",
      "dynastyKey": "sanguo",
      "color": "#2c6b56",
      "shortZh": "诸葛亮出山北伐",
      "shortEn": "Zhuge Liang",
      "titleZh": "诸葛亮出山北伐行迹",
      "titleEn": "Zhuge Liang's Southern & Northern Campaigns",
      "spanZh": "207年 — 234年（东汉建安十二年至蜀汉建兴十二年）",
      "spanEn": "207 CE – 234 CE (Late Eastern Han to Three Kingdoms)",
      "stops": [
        {
          "year": 207,
          "eraZh": "建安十二年",
          "coord": [
            112.04,
            32
          ],
          "labelPos": "top",
          "ancientZh": "隆中（襄阳）",
          "modernZh": "湖北襄阳",
          "ancientEn": "Longzhong (Xiangyang)",
          "modernEn": "Xiangyang, Hubei",
          "titleZh": "三顾茅庐·隆中决策",
          "titleEn": "Three Visits to the Thatched Cottage — The Longzhong Plan",
          "descZh": "刘备驻新野，三诣襄阳城西二十里隆中草庐访诸葛亮。年二十七的孔明纵论天下大势，提出跨有荆益、保其岩阻、西和诸戎、南抚夷越、内修政理、待天下有变则命一上将将荆州之军向宛洛而身率益州之众出秦川的“隆中对”宏图。",
          "descEn": "At age twenty-seven in his cottage at Longzhong west of Xiangyang, Zhuge Liang received Liu Bei on his third visit and unveiled the Longzhong Plan: secure Jing and Yi provinces, ally with Eastern Wu, pacify the southern tribes, and launch a two-pronged northern offensive to restore the Han.",
          "quoteZh": "诸葛亮《出师表》：“臣本布衣，躬耕于南阳，苟全性命于乱世，不求闻达于诸侯。先帝不以臣卑鄙，猥自枉屈，三顾臣于草庐之中。”",
          "quoteEn": "Zhuge Liang, Former Chu Shi Biao: \"I was originally a commoner, tilling the fields in Nanyang... Yet the Late Emperor did not disdain my humble station and deigned to visit me thrice in my thatched cottage.\""
        },
        {
          "year": 208,
          "eraZh": "建安十三年",
          "coord": [
            115.98,
            29.71
          ],
          "via": [
            [
              114.3,
              30.55
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "柴桑·赤壁",
          "modernZh": "江西九江 / 湖北赤壁",
          "ancientEn": "Chaisang & Red Cliffs",
          "modernEn": "Jiujiang, Jiangxi / Chibi, Hubei",
          "titleZh": "奉使柴桑·联吴破曹",
          "titleEn": "Diplomatic Mission to Chaisang & Victory at Red Cliffs",
          "descZh": "曹操南下荆州、刘备败走当阳长坂，诸葛亮临危请命顺江东下柴桑说孙权，剖析曹军远来疲弊、北人不习水战之弊，促成孙刘同盟；旋于赤壁大破曹军，奠定三分天下之基。",
          "descEn": "As Cao Cao swept south through Jing Province, Zhuge Liang sailed down the Yangtze to Chaisang to persuade Sun Quan into an alliance; the allied forces burned Cao Cao’s fleet at the Red Cliffs, forging the tripartite balance.",
          "quoteZh": "《三国志·诸葛亮传》：“权大悦，即遣周瑜、程普、鲁肃等水军三万，随亮诣先主，并力拒曹公。”",
          "quoteEn": "Records of the Three Kingdoms: \"Sun Quan was greatly pleased and immediately dispatched Zhou Yu, Cheng Pu, and Lu Su with thirty thousand naval troops to join Liu Bei against Cao Cao.\""
        },
        {
          "year": 214,
          "eraZh": "建安十九年",
          "coord": [
            104.07,
            30.67
          ],
          "via": [
            [
              111.3,
              30.7
            ],
            [
              107.7,
              30.9
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "成都",
          "modernZh": "四川成都",
          "ancientEn": "Chengdu",
          "modernEn": "Chengdu, Sichuan",
          "titleZh": "溯江入蜀·会师成都",
          "titleEn": "Ascending the Yangtze into Shu & Taking Chengdu",
          "descZh": "刘备入蜀受阻于雒城，诸葛亮与张飞、赵云自荆州率军溯长江西上，分定江州、江阳、犍为诸郡，与刘备合围成都；刘璋出降，亮署左将军府事，修订《蜀科》，宽严相济治理巴蜀。",
          "descEn": "Leading reinforcements up the Yangtze Three Gorges with Zhang Fei and Zhao Yun, Zhuge Liang converged on Chengdu with Liu Bei, securing Yi Province and codifying the legal code of Shu.",
          "quoteZh": "《三国志·诸葛亮传》：“亮与张飞、赵云等率众泝江，分定郡县，与先主共围成都。成都平，以亮为军师将军。”",
          "quoteEn": "Records of the Three Kingdoms: \"Zhuge Liang, Zhang Fei, and Zhao Yun led forces up the Yangtze, pacifying commanderies and counties before joining Liu Bei to encircle Chengdu.\""
        },
        {
          "year": 221,
          "eraZh": "章武元年",
          "coord": [
            104.07,
            30.67
          ],
          "labelPos": "top",
          "ancientZh": "成都·武担山",
          "modernZh": "四川成都",
          "ancientEn": "Chengdu (Capital of Shu Han)",
          "modernEn": "Chengdu, Sichuan",
          "titleZh": "劝进昭烈·开府拜相",
          "titleEn": "Founding of Shu Han & Appointment as Imperial Chancellor",
          "descZh": "曹丕篡汉自立，诸葛亮与群臣劝进刘备于成都武担山之南即皇帝位，延续汉室正统；诸葛亮拜丞相、录尚书事、假节，总摄蜀汉朝政与盐铁锦官经济。",
          "descEn": "Following Cao Pi’s usurpation of the Han throne, Zhuge Liang advised Liu Bei to proclaim the continuation of Han in Chengdu, becoming Imperial Chancellor of Shu Han.",
          "quoteZh": "册丞相诏：“朕遭家不造，奉承大统，兢兢业业，不敢康宁，思靖百姓，惧未能绥。於戏！丞相亮其悉朕意。”",
          "quoteEn": "Imperial Edict of 221 CE: \"Having inherited the Great Succession in troubled times, I rely wholeheartedly upon Chancellor Liang to bring peace to the realm.\""
        },
        {
          "year": 223,
          "eraZh": "章武三年",
          "coord": [
            109.57,
            31.04
          ],
          "via": [
            [
              106.5,
              30.8
            ]
          ],
          "labelPos": "top",
          "ancientZh": "永安（白帝城）",
          "modernZh": "重庆奉节",
          "ancientEn": "Yong'an (Baidicheng)",
          "modernEn": "Fengjie, Chongqing",
          "titleZh": "白帝托孤·受命危难",
          "titleEn": "Entrustment of the Orphan Emperor at Baidicheng",
          "descZh": "夷陵之战后刘备病笃永安白帝城，自成都召诸葛亮赴行宫托孤，嘱以“嗣子可辅，辅之；如其不才，君可自取”。亮涕泣死节，回朝后开府治事、遣邓芝修好东吴，稳固危局。",
          "descEn": "Summoned to the dying Emperor Liu Bei’s bedside at Baidicheng, Zhuge Liang accepted the regency in tears, pledging unyielding loyalty until death and restoring the Wu alliance.",
          "quoteZh": "诸葛亮《出师表》：“受任于败军之际，奉命于危难之间，尔来二十有一年矣。”",
          "quoteEn": "Zhuge Liang, Former Chu Shi Biao: \"I received my appointment in the hour of defeat and accepted my mandate in the midst of peril—twenty-one years have passed since then.\""
        },
        {
          "year": 225,
          "eraZh": "建兴三年",
          "coord": [
            102.71,
            25.04
          ],
          "via": [
            [
              104.6,
              28.7
            ],
            [
              103.7,
              27.3
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "滇池（南中）",
          "modernZh": "云南昆明",
          "ancientEn": "Dianchi (Nanzhong)",
          "modernEn": "Kunming, Yunnan",
          "titleZh": "渡泸南征·七擒孟获",
          "titleEn": "Southern Campaign Across the Lu River — Pacifying Nanzhong",
          "descZh": "为解除北伐后顾之忧，诸葛亮率军自安上水路入越巂，五月渡泸水（金沙江），采马谡“攻心为上”之策，七擒七纵孟获，平定益州、永昌、牂牁、越巂四郡，皆即其渠帅而用之，终亮之世南方不复反。",
          "descEn": "Marching south across the Jinsha (Lu) River in summer 225 CE, Zhuge Liang adopted the strategy of \"winning hearts above all,\" capturing and releasing Meng Huo seven times to secure the southern frontier.",
          "quoteZh": "《汉晋春秋》：“亮笑，纵使更战，七纵七禽，而亮犹遣获。获止不去，曰：‘公，天威也，南人不复反矣。’”",
          "quoteEn": "Annals of Han and Jin: \"Captured and released seven times, Meng Huo bowed and refused to leave, saying: 'Your Excellency possesses the majesty of Heaven; the south will never rebel again.'\""
        },
        {
          "year": 227,
          "eraZh": "建兴五年",
          "coord": [
            107.02,
            33.07
          ],
          "via": [
            [
              104.1,
              30.7
            ],
            [
              105.5,
              32.2
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "汉中（沔阳）",
          "modernZh": "陕西汉中",
          "ancientEn": "Hanzhong (Mianyang)",
          "modernEn": "Hanzhong, Shaanxi",
          "titleZh": "进驻汉中·上出师表",
          "titleEn": "Garrisoning Hanzhong & Presenting the Chu Shi Biao",
          "descZh": "南中既定，诸葛亮率诸军北驻汉中沔阳，临发向后主刘禅奏呈千古名篇《出师表》，勉以亲贤臣远小人、兴复汉室还于旧都，以汉中为北伐大本营经略关陇。",
          "descEn": "Establishing his forward headquarters at Hanzhong, Zhuge Liang submitted his immortal Memorial on Deploying the Troops (Chu Shi Biao) to Emperor Liu Shan before marching north.",
          "quoteZh": "诸葛亮《出师表》：“今南方已定，兵甲已足，当奖率三军，北定中原，庶竭驽钝，攘除奸凶，兴复汉室，还于旧都。”",
          "quoteEn": "Zhuge Liang, Former Chu Shi Biao: \"Now the south is pacified and our armor is sufficient; I ought to lead the Three Armies to secure the Central Plains and restore the House of Han.\""
        },
        {
          "year": 228,
          "eraZh": "建兴六年",
          "coord": [
            105.72,
            34.58
          ],
          "via": [
            [
              106.2,
              33.8
            ]
          ],
          "labelPos": "top",
          "ancientZh": "祁山·天水",
          "modernZh": "甘肃礼县 / 天水",
          "ancientEn": "Mount Qi & Tianshui",
          "modernEn": "Lixian / Tianshui, Gansu",
          "titleZh": "一出祁山·收姜维失街亭",
          "titleEn": "First Expedition from Mount Qi — Recruiting Jiang Wei",
          "descZh": "声东击西由箕谷设疑兵、亲率大军攻祁山，戎阵整齐，南安、天水、安定三郡叛魏应亮，关中震响，收天水俊杰姜维；惜马谡违亮节度于街亭依山不下城，为张郃绝水道所破，亮拔西县千余家还汉中并自贬三等。",
          "descEn": "Debouching from Mount Qi in disciplined array, Zhuge Liang won over three Wei commanderies—shaking all Guanzhong and recruiting Jiang Wei—before Ma Su’s defeat at Jieting forced an orderly withdrawal.",
          "quoteZh": "《三国志·诸葛亮传》：“亮身率诸军攻祁山，戎阵整齐，赏罚肃而号令明，南安、天水、安定三郡叛魏应亮，关中响震。”",
          "quoteEn": "Records of the Three Kingdoms: \"Zhuge Liang led the armies in person to attack Mount Qi in disciplined ranks; Nanan, Tianshui, and Anding commanderies defected from Wei to join him, shaking all Guanzhong.\""
        },
        {
          "year": 231,
          "eraZh": "建兴九年",
          "coord": [
            105.38,
            34.22
          ],
          "labelPos": "bottom",
          "ancientZh": "卤城·木门道",
          "modernZh": "甘肃礼县 / 天水秦州",
          "ancientEn": "Lucheng & Mumen Trail",
          "modernEn": "Lixian / Tianshui, Gansu",
          "titleZh": "木牛流马·木门道射杀张郃",
          "titleEn": "Fourth Expedition — Victory at Lucheng & Mumen Ambush",
          "descZh": "始以木牛运粮四出祁山，于卤城大破司马懿主力，获甲首三千级、玄铠五千领；夏六月粮尽退军，司马懿遣名将张郃追至木门道，亮乘高布伏万弩齐发，射杀张郃。",
          "descEn": "Using wooden-ox transport on his fourth northern campaign, Zhuge Liang routed Sima Yi outside Lucheng and ambushed the pursuing Wei general Zhang He with massed crossbows in Mumen Gorge.",
          "quoteZh": "《三国志·诸葛亮传》：“亮粮尽退军，司马宣王遣张郃追之，郃进至木门，与亮军交战，飞矢中郃右膝，薨。”",
          "quoteEn": "Records of the Three Kingdoms: \"When Zhuge Liang withdrew for lack of grain, Sima Yi sent Zhang He in pursuit; at Mumen Trail, a flying bolt struck Zhang He in the right knee, and he perished.\""
        },
        {
          "year": 234,
          "eraZh": "建兴十二年",
          "coord": [
            107.63,
            34.34
          ],
          "via": [
            [
              107.02,
              33.07
            ],
            [
              107.5,
              33.8
            ]
          ],
          "labelPos": "top",
          "ancientZh": "五丈原（岐山）",
          "modernZh": "陕西宝鸡岐山",
          "ancientEn": "Wuzhang Plains (Qishan)",
          "modernEn": "Qishan, Baoji, Shaanxi",
          "titleZh": "出斜谷屯五丈原·秋风星落",
          "titleEn": "Final Stand on the Wuzhang Plains",
          "descZh": "春二月悉大众十万由褒斜道出斜谷，以流马运粮，据武功五丈原与司马懿对峙于渭水之南，分兵屯田久驻之基，百姓安堵军无私焉；相持百余日，八月积劳病逝于军中，年五十四，杨仪、姜维整军从容退入斜谷，留“死诸葛走生仲达”之谚。",
          "descEn": "Leading 100,000 troops through the Xie Valley to the Wuzhang Plains south of the Wei River, Zhuge Liang established military-agricultural colonies and held off Sima Yi for over a hundred days before passing away in camp at age fifty-four.",
          "quoteZh": "杜甫《蜀相》：“三顾频烦天下计，两朝开济老臣心。出师未捷身先死，长使英雄泪满襟。”",
          "quoteEn": "Du Fu, The Chancellor of Shu: \"Three visits sought his counsel for the realm; through two reigns the old minister’s heart sustained the state. Before the campaign triumphed he died in the field, forever filling heroes’ robes with tears.\""
        }
      ]
    },
    {
      "key": "xuanzang",
      "dynastyKey": "tang",
      "color": "#9c6317",
      "shortZh": "玄奘西行求法",
      "shortEn": "Xuanzang",
      "titleZh": "玄奘西行求法行迹",
      "titleEn": "Xuanzang's Pilgrimage to the Western Regions",
      "spanZh": "627年 — 645年（唐贞观元年至贞观十九年）",
      "spanEn": "627 CE – 645 CE (Tang Dynasty, Zhenguan Era)",
      "stops": [
        {
          "year": 627,
          "eraZh": "贞观元年",
          "coord": [
            108.94,
            34.26
          ],
          "labelPos": "top",
          "ancientZh": "长安",
          "modernZh": "陕西西安",
          "ancientEn": "Chang'an",
          "modernEn": "Xi'an, Shaanxi",
          "titleZh": "发足长安·孤身西迈",
          "titleEn": "Departing Chang'an for the West",
          "descZh": "为求《瑜伽师地论》梵本真义以释诸家纷歧，年二十八的玄奘大师自长安混迹灾民西出秦陇，立誓“不至天竺，终不东归一步”。",
          "descEn": "Seeking original Sanskrit texts of the Yogacara-bhumi-sastra, Master Xuanzang departed Chang'an alone, vowing never to take a step back eastward before reaching India.",
          "quoteZh": "《大慈恩寺三藏法师传》：“遂发足西行，自尔孑然孤游。”",
          "quoteEn": "Biography of the Tripitaka Master: \"Thus he set foot westward, traveling onward in solitary resolve.\""
        },
        {
          "year": 627,
          "eraZh": "贞观元年",
          "coord": [
            102.64,
            37.93
          ],
          "labelPos": "top",
          "ancientZh": "凉州",
          "modernZh": "甘肃武威",
          "ancientEn": "Liangzhou",
          "modernEn": "Wuwei, Gansu",
          "titleZh": "凉州开讲·昼伏夜行",
          "titleEn": "Preaching in Liangzhou & Night Crossing",
          "descZh": "抵河西都会凉州，受众僧礼请开讲《涅槃》《摄大乘论》月余，名震葱岭以东；因朝廷严禁私度边关，由慧威法师遣徒护送昼伏夜行西赴瓜州。",
          "descEn": "In Liangzhou, Xuanzang lectured for over a month to great acclaim; evading border bans, he traveled by night and hid by day toward Guazhou.",
          "quoteZh": "《大慈恩寺三藏法师传》：“凉州为河西都会，僧徒既多，请留开讲。”",
          "quoteEn": "Biography of the Tripitaka Master: \"Liangzhou was the metropolis of Hexi; its many monks entreated him to stay and lecture.\""
        },
        {
          "year": 627,
          "eraZh": "贞观元年",
          "coord": [
            95.78,
            40.52
          ],
          "labelPos": "bottom",
          "ancientZh": "瓜州·玉门关",
          "modernZh": "甘肃瓜州",
          "ancientEn": "Guazhou & Jade Gate",
          "modernEn": "Guazhou, Gansu",
          "titleZh": "夜渡葫芦河·闯莫贺延碛",
          "titleEn": "Crossing the Gobi of Moheyan",
          "descZh": "州吏李昌感其诚而暗撕通缉谍文。玄奘夜渡葫芦河、独闯五烽，于八百里莫贺延碛失手覆水，四夜五日滴水未进，绝处逢生终抵伊吾。",
          "descEn": "Crossing the Hulu River by night past five watchtowers, Xuanzang survived five days and four nights without water in the 800-li Moheyan Desert.",
          "quoteZh": "《大慈恩寺三藏法师传》：“莫贺延碛长八百余里，古曰沙河，上无飞鸟，下无走兽。”",
          "quoteEn": "Biography of the Tripitaka Master: \"The Moheyan Desert stretches over 800 li—no birds above, no beasts below.\""
        },
        {
          "year": 628,
          "eraZh": "贞观二年",
          "coord": [
            89.53,
            42.85
          ],
          "labelPos": "top",
          "ancientZh": "高昌王城",
          "modernZh": "新疆吐鲁番",
          "ancientEn": "Gaochang (Qocho)",
          "modernEn": "Turpan, Xinjiang",
          "titleZh": "高昌结义·修书通西域",
          "titleEn": "Sworn Brotherhood with the King of Gaochang",
          "descZh": "高昌王麴文泰虔礼挽留，玄奘水浆不涉三日以明西求大法之志；麴文泰感泣结为兄弟，修二十四封国书、备黄金百两与三十匹马护送西行。",
          "descEn": "Moved by Xuanzang’s three-day fast, King Qu Wentai became his sworn brother and provided 24 diplomatic letters and provisions for the Western Regions.",
          "quoteZh": "《大慈恩寺三藏法师传》：“任师西迈，乞垂早食……遂共结为兄弟。”",
          "quoteEn": "Biography of the Tripitaka Master: \"The King pledged to support his westward journey and swore brotherhood with him.\""
        },
        {
          "year": 628,
          "eraZh": "贞观二年",
          "coord": [
            82.96,
            41.72
          ],
          "labelPos": "bottom",
          "ancientZh": "屈支（龟兹）",
          "modernZh": "新疆库车",
          "ancientEn": "Kucha (Quzhi)",
          "modernEn": "Kuqa, Xinjiang",
          "titleZh": "驻锡龟兹·翻越凌山雪岭",
          "titleEn": "Kucha Oasis & Crossing the Icy Tian Shan",
          "descZh": "在龟兹与高僧木叉毱多论辩经义，因大雪封山逗留六十余日；开春后翻越积雪千尺的凌山（天山木扎尔特达坂），历经雪崩严寒出天山北麓。",
          "descEn": "Delayed two months in Kucha by winter snows, Xuanzang then scaled the glacial Muzart Pass of the Tian Shan.",
          "quoteZh": "《大唐西域记》：“山谷积雪，春夏合冻，虽时消泮，寻复结冰。”",
          "quoteEn": "Great Tang Records on the Western Regions: \"The mountain valleys are piled with snow, frozen through spring and summer.\""
        },
        {
          "year": 628,
          "eraZh": "贞观二年",
          "coord": [
            75.29,
            42.83
          ],
          "labelPos": "top",
          "ancientZh": "碎叶城",
          "modernZh": "吉尔吉斯斯坦托克马克",
          "ancientEn": "Suyab (Suiye)",
          "modernEn": "Tokmok, Kyrgyzstan",
          "titleZh": "过大清池·会西突厥叶护可汗",
          "titleEn": "Audience with the Western Turkic Khagan at Suyab",
          "descZh": "循大清池（伊塞克湖）西北行至碎叶城，恰逢西突厥统叶护可汗游猎。可汗设宴礼敬，命通解汉言及诸国语的摩咄达官率骑护送至迦毕试国境。",
          "descEn": "Passing Lake Issyk-Kul to Suyab, Xuanzang met Tong Yabghu Khagan of the Western Turks, who assigned a multilingual envoy to escort him south.",
          "quoteZh": "《大唐西域记》：“清池西北行五百余里至素叶水城，逢突厥叶护可汗方事畋游。”",
          "quoteEn": "Great Tang Records: \"Traveling 500 li northwest from the Clear Lake to Suyab, he met the Turkic Yabghu Khagan on a hunt.\""
        },
        {
          "year": 628,
          "eraZh": "贞观二年",
          "coord": [
            66.9,
            36.76
          ],
          "via": [
            [
              69.6,
              39.6
            ]
          ],
          "labelPos": "top",
          "ancientZh": "缚喝（大夏）",
          "modernZh": "阿富汗巴尔赫",
          "ancientEn": "Balkh (Fohe)",
          "modernEn": "Balkh, Afghanistan",
          "titleZh": "过铁门关·参礼小王舍城",
          "titleEn": "Through the Iron Gate to Balkh",
          "descZh": "经赭时（塔什干）、飒秣建（撒马尔罕），穿险峻铁门关，渡缚刍河（阿姆河）抵号称“小王舍城”的缚喝国，与般若羯罗法师切磋毗婆沙论。",
          "descEn": "Passing Samarkand and the Iron Gate Pass across the Oxus to Balkh (\"Little Rajagrha\"), studying Abhidharma texts at Nava Vihara.",
          "quoteZh": "《大唐西域记》：“缚喝国，伽蓝百有余所，僧徒三千余人。”",
          "quoteEn": "Great Tang Records: \"The Kingdom of Balkh has over a hundred monasteries and more than three thousand monks.\""
        },
        {
          "year": 629,
          "eraZh": "贞观三年",
          "coord": [
            71.52,
            34.01
          ],
          "labelPos": "bottom",
          "ancientZh": "健驮逻",
          "modernZh": "巴基斯坦白沙瓦",
          "ancientEn": "Gandhara (Purushapura)",
          "modernEn": "Peshawar, Pakistan",
          "titleZh": "越雪山礼大佛·入天竺求法",
          "titleEn": "Crossing the Hindu Kush into Gandhara & India",
          "descZh": "翻越大雪山（兴都库什山）、瞻礼梵衍那（巴米扬）石佛，入北天竺健驮逻故地；由此深游五印十余载，于那烂陀寺师从戒贤论师，并在曲女城十八国王大会立“真唯识量”。",
          "descEn": "Crossing the Hindu Kush past Bamiyan into Gandhara, beginning over a decade across India culminating at Nalanda Monastery and the Grand Assembly of Kanauj.",
          "quoteZh": "《大唐西域记》：“自古大圣贤，多生此国，作论诸师，亦多出此。”",
          "quoteEn": "Great Tang Records: \"Since antiquity, great sages and treatise-masters have arisen in this land of Gandhara.\""
        },
        {
          "year": 644,
          "eraZh": "贞观十八年",
          "coord": [
            79.92,
            37.11
          ],
          "via": [
            [
              74.8,
              36.9
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "于阗（瞿萨旦那）",
          "modernZh": "新疆和田",
          "ancientEn": "Khotan (Kustana)",
          "modernEn": "Hotan, Xinjiang",
          "titleZh": "越葱岭载经东归·奉表唐廷",
          "titleEn": "Return via Khotan & Memorial to Emperor Taizong",
          "descZh": "载梵本经论越帕米尔高原东归至于阗，遣使向唐太宗奉表陈情；此时大唐已平定高昌、设安西都护府，太宗降敕欣慰迎归，命沿途州县护送。",
          "descEn": "Returning across the Pamirs to Khotan with Sanskrit scriptures, Xuanzang sent a memorial to Emperor Taizong, who issued an imperial edict welcoming him home.",
          "quoteZh": "《进西域记表》：“冒越宪章，私往天竺……历览周游，一十七载。”",
          "quoteEn": "Memorial to the Throne: \"Having ventured beyond the border laws to India, I traveled and observed for seventeen years.\""
        },
        {
          "year": 645,
          "eraZh": "贞观十九年",
          "coord": [
            109.35,
            34.05
          ],
          "via": [
            [
              91,
              38.2
            ],
            [
              101.5,
              36.2
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "长安（归唐）",
          "modernZh": "陕西西安",
          "ancientEn": "Chang'an (Return)",
          "modernEn": "Xi'an, Shaanxi",
          "titleZh": "归至京师·开场译经撰记",
          "titleEn": "Triumphal Return to Chang'an & Translation Bureau",
          "descZh": "贞观十九年正月返抵长安，朱雀街数十万人瞻礼迎奉六百五十七部梵经；后于弘福寺、大慈恩寺主持译场十九载，译经七十五部，撰成《大唐西域记》十二卷。",
          "descEn": "Returning to Chang'an in 645 CE with 657 Sanskrit texts, Xuanzang led the imperial translation bureau for 19 years and compiled the Great Tang Records on the Western Regions.",
          "quoteZh": "《旧唐书·玄奘传》：“贞观十九年，归至京师，太宗见之大悦，与之谈论。”",
          "quoteEn": "Old Book of Tang: \"In the 19th year of Zhenguan he returned to the capital; Emperor Taizong met him with great joy.\""
        }
      ]
    },
    {
      "key": "libai",
      "dynastyKey": "tang",
      "color": "#2e5c8a",
      "shortZh": "李白仗剑壮游",
      "shortEn": "Li Bai",
      "titleZh": "李白仗剑壮游行迹",
      "titleEn": "Li Bai's Grand Travels Across Tang China",
      "spanZh": "701年 — 762年（武周长安元年至唐宝应元年）",
      "spanEn": "701 CE – 762 CE (High Tang Dynasty)",
      "stops": [
        {
          "year": 701,
          "eraZh": "长安元年",
          "coord": [
            75.29,
            42.83
          ],
          "labelPos": "top",
          "ancientZh": "碎叶城",
          "modernZh": "吉尔吉斯斯坦托克马克",
          "ancientEn": "Suyab (Anxi Protectorate)",
          "modernEn": "Tokmok, Kyrgyzstan",
          "titleZh": "诞于西域·安西碎叶",
          "titleEn": "Birth at Suyab in the Western Regions",
          "descZh": "长安元年（701年），李白诞于唐安西都护府碎叶城（今楚河流域托克马克附近），幼承丝路胡汉交融之风，五岁随父李客东迁入蜀。",
          "descEn": "Born in 701 CE at Suyab—one of the Four Garrisons of Anxi in the Chu River valley—Li Bai spent his earliest childhood on the Silk Road frontier before migrating with his family to Sichuan at age five.",
          "quoteZh": "范传正《唐左拾遗翰林学士李公新墓碑》：“隋末多难，一房被窜于碎叶，流离散落，隐易姓名。”",
          "quoteEn": "Fan Chuanzheng, New Tomb Inscription for Li Bai: \"Amid the turmoil at the end of Sui, his branch of the clan was exiled to Suyab, living incognito until returning to Shu in the Shenlong era.\""
        },
        {
          "year": 705,
          "eraZh": "神龙元年",
          "coord": [
            104.74,
            31.78
          ],
          "via": [
            [
              89.2,
              42.9
            ],
            [
              98.5,
              39.7
            ],
            [
              105.5,
              33
            ]
          ],
          "labelPos": "top",
          "ancientZh": "绵州昌隆（青莲）",
          "modernZh": "四川江油青莲镇",
          "ancientEn": "Qinglian, Mianzhou",
          "modernEn": "Jiangyou, Sichuan",
          "titleZh": "卜居青莲·大匡山读书",
          "titleEn": "Youth in Qinglian & Studying on Mount Dakuang",
          "descZh": "随父客居剑南道绵州昌隆县青莲乡（自号“青莲居士”）。少时博学广览、好剑术任侠，隐大匡山读书，后游成都、登峨眉，受道士司马承祯赞为“有仙风道骨，可与神游八极之表”，作《大鹏遇希有鸟赋》。",
          "descEn": "Settling in Qinglian in Mianzhou (whence his sobriquet \"Layman of Blue Lotus\"), young Li Bai practiced swordsmanship, studied on Mount Dakuang, climbed Mount Emei, and was praised by Taoist master Sima Chengzhen as having \"immortal bones.\"",
          "quoteZh": "李白《上安州裴长史书》：“五岁诵六甲，十岁观百家……十五观奇书，作赋凌相如。”",
          "quoteEn": "Li Bai, Letter to Administrator Pei of Anzhou: \"At five I recited the calendar classics; at ten I read the Hundred Schools; at fifteen I composed rhapsodies rivaling Sima Xiangru.\""
        },
        {
          "year": 724,
          "eraZh": "开元十二年",
          "coord": [
            111.45,
            30.69
          ],
          "via": [
            [
              104.07,
              30.67
            ],
            [
              106.55,
              29.56
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "渝州·荆门",
          "modernZh": "重庆 / 湖北宜都",
          "ancientEn": "Yuzhou & Jingmen Gorge",
          "modernEn": "Chongqing / Yidu, Hubei",
          "titleZh": "仗剑去国·辞亲出三峡",
          "titleEn": "Leaving Shu with Sword in Hand Through the Three Gorges",
          "descZh": "年二十四的李白怀济世远志“仗剑去国，辞亲远游”，自成都乘舟顺岷江下渝州，穿巫峡、出荆门，初见江汉平原天地壮阔，写下《峨眉山月歌》与《渡荆门送别》。",
          "descEn": "At twenty-four, Li Bai bade farewell to Sichuan and sailed down the Three Gorges past Jingmen into the vast Jianghan Plain, beginning his lifelong travels across the Tang Empire.",
          "quoteZh": "李白《渡荆门送别》：“山随平野尽，江入大荒流。月下飞天镜，云生结海楼。”",
          "quoteEn": "Li Bai, Farewell at Jingmen: \"Mountains vanish into the level plain; the Great River rolls into the boundless wild. Beneath the moon a celestial mirror flies; rising clouds weave ocean pavilions.\""
        },
        {
          "year": 726,
          "eraZh": "开元十四年",
          "coord": [
            119.41,
            32.39
          ],
          "via": [
            [
              113.1,
              29.37
            ],
            [
              116,
              29.7
            ],
            [
              118.8,
              32.06
            ]
          ],
          "labelPos": "top",
          "ancientZh": "金陵·扬州",
          "modernZh": "江苏南京 / 扬州",
          "ancientEn": "Jinling & Yangzhou",
          "modernEn": "Nanjing / Yangzhou, Jiangsu",
          "titleZh": "漫游吴越·散金三十万",
          "titleEn": "Grand Tour of Wu-Yue & Spending 300,000 Cash in Yangzhou",
          "descZh": "顺江东下，登庐山望瀑布、游金陵怀古，转赴繁华甲天下的淮南都会扬州与吴越诸郡，豪爽济困，“不逾一年，散金三十余万”，写就《望庐山瀑布》《静夜思》等千古绝唱。",
          "descEn": "Sailing down the lower Yangtze past Mount Lu and Jinling to prosperous Yangzhou, Li Bai generously aided destitute scholars—giving away over 300,000 coins within a year—and composed Quiet Night Thought.",
          "quoteZh": "李白《上安州裴长史书》：“曩昔东游维扬，不逾一年，散金三十余万，有落魄公子，悉皆济之。”",
          "quoteEn": "Li Bai: \"Formerly traveling east to Yangzhou, in less than a year I scattered more than three hundred thousand in gold, coming to the aid of every stranded gentleman.\""
        },
        {
          "year": 727,
          "eraZh": "开元十五年",
          "coord": [
            113.69,
            31.26
          ],
          "via": [
            [
              116.5,
              30.5
            ],
            [
              114.3,
              30.55
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "安陆·江夏",
          "modernZh": "湖北安陆 / 武汉",
          "ancientEn": "Anlu & Jiangxia (Yellow Crane Tower)",
          "modernEn": "Anlu / Wuhan, Hubei",
          "titleZh": "酒隐安陆·登临黄鹤楼",
          "titleEn": "Ten Years in Anlu & Farewell at Yellow Crane Tower",
          "descZh": "西归荆楚，赘于安陆故相许圉师孙女家，隐居白兆山桃花岩所谓“酒隐安陆，蹉跎十年”；其间频游江夏与襄阳，结交孟浩然，于黄鹤楼赋诗送其东下广陵。",
          "descEn": "Marrying into the family of former Chancellor Xu Yushi in Anlu, Li Bai made Mount Baizhao his home base for a decade, befriending Meng Haoran and seeing him off at the Yellow Crane Tower.",
          "quoteZh": "李白《黄鹤楼送孟浩然之广陵》：“故人西辞黄鹤楼，烟花三月下扬州。孤帆远影碧空尽，唯见长江天际流。”",
          "quoteEn": "Li Bai, Seeing Off Meng Haoran at Yellow Crane Tower: \"My old friend bids farewell to the west at Yellow Crane Tower, sailing down to Yangzhou in the misty blossoms of March.\""
        },
        {
          "year": 742,
          "eraZh": "天宝元年",
          "coord": [
            108.94,
            34.26
          ],
          "via": [
            [
              111,
              33.2
            ]
          ],
          "labelPos": "top",
          "ancientZh": "长安",
          "modernZh": "陕西西安",
          "ancientEn": "Chang'an",
          "modernEn": "Xi'an, Shaanxi",
          "titleZh": "奉诏入京·翰林待诏",
          "titleEn": "Summoned to Chang'an — Imperial Hanlin Academy",
          "descZh": "因道士吴筠及玉真公主举荐，唐玄宗降诏征召入京。李白高歌“仰天大笑出门去，我辈岂是蓬蒿人”西入长安，贺知章读《蜀道难》惊呼“谪仙人”，玄宗降辇步迎、供奉翰林，赋《清平调》三章。",
          "descEn": "Summoned to Chang’an by Emperor Xuanzong, Li Bai was hailed by He Zhizhang as a \"Banished Immortal\" upon reading The Hard Roads of Shu, and served in the Imperial Hanlin Academy.",
          "quoteZh": "李白《南陵别儿童入京》：“仰天大笑出门去，我辈岂是蓬蒿人！”",
          "quoteEn": "Li Bai, Parting from My Children at Nanling for the Capital: \"Throwing back my head with a great laugh I stride out the gate—how could men like us remain forever amid the mugwort?\""
        },
        {
          "year": 744,
          "eraZh": "天宝三载",
          "coord": [
            112.45,
            34.62
          ],
          "via": [
            [
              110.5,
              34.5
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "洛阳·梁宋",
          "modernZh": "河南洛阳 / 商丘开封",
          "ancientEn": "Luoyang & Liang-Song",
          "modernEn": "Luoyang / Kaifeng, Henan",
          "titleZh": "赐金放还·洛阳逢杜甫",
          "titleEn": "Leaving Court & Historic Meeting with Du Fu in Luoyang",
          "descZh": "因傲岸不羁遭权贵谗毁，玄宗“赐金放还”。李白东出长安至东都洛阳，与年三十三的杜甫初遇定交，复邀高适同游梁宋（开封、商丘），登吹台、猎孟诸，淋漓尽致展现盛唐双子星风采。",
          "descEn": "Granted gold to leave court in 744 CE, Li Bai traveled east to Luoyang where he met the younger Du Fu—a meeting hailed as the twin peaks of Tang poetry—and roamed the Liang-Song plains with Gao Shi.",
          "quoteZh": "杜甫《寄李十二白二十韵》：“乞归优诏许，遇我宿心亲。醉舞梁园夜，行歌泗水春。”",
          "quoteEn": "Du Fu, Twenty Rhymes Sent to Li Bai: \"Your plea to retire was granted by gracious edict; meeting me, our kindred hearts grew close—dancing drunk in Liang Garden by night, singing along the Si River in spring.\""
        },
        {
          "year": 745,
          "eraZh": "天宝四载",
          "coord": [
            116.59,
            35.41
          ],
          "via": [
            [
              114.35,
              34.79
            ]
          ],
          "labelPos": "top",
          "ancientZh": "齐鲁（兖州任城）",
          "modernZh": "山东济宁",
          "ancientEn": "Qilu (Rencheng, Yanzhou)",
          "modernEn": "Jining, Shandong",
          "titleZh": "东游齐鲁·梦游天姥",
          "titleEn": "Sojourn in Qilu & Dreaming of Mount Tianmu",
          "descZh": "寄家山东兖州任城，与杜甫携手同游齐鲁，访范十隐居、登泰山徂徕，于紫极宫受道箓；临别东鲁南游越中时赋《梦游天姥吟留别》，喊出“安能摧眉折腰事权贵，使我不得开心颜”之千古强音。",
          "descEn": "Making his family home in Rencheng (Shandong) and roaming Qilu with Du Fu, Li Bai composed Dreaming of Mount Tianmu: A Farewell Song before heading south.",
          "quoteZh": "李白《梦游天姥吟留别》：“安能摧眉折腰事权贵，使我不得开心颜！”",
          "quoteEn": "Li Bai, Dreaming of Mount Tianmu: \"How can I bow my brow and bend my waist to serve the powerful, denying myself a joyful heart and open brow?\""
        },
        {
          "year": 759,
          "eraZh": "乾元二年",
          "coord": [
            109.57,
            31.04
          ],
          "via": [
            [
              115.98,
              29.71
            ],
            [
              113,
              29.4
            ],
            [
              111.3,
              30.7
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "白帝城（夔州）",
          "modernZh": "重庆奉节",
          "ancientEn": "Baidicheng (Kuizhou)",
          "modernEn": "Fengjie, Chongqing",
          "titleZh": "长流夜郎·白帝遇赦还江陵",
          "titleEn": "Exile to Yelang & Imperial Pardon at Baidicheng",
          "descZh": "安史之乱起，李白怀平胡复国之志入永王李璘幕府，兵败后系浔阳狱，坐长流夜郎（黔中）；乾元二年春溯江行至巫山白帝城，忽逢关内大旱朝廷大赦天下，惊喜放舟东下江陵，写下《早发白帝城》。",
          "descEn": "Implicated in Prince Lin of Yong’s campaign during the An Lushan Rebellion, Li Bai was banished toward distant Yelang; reaching Baidicheng in spring 759 CE, he received an imperial amnesty and raced downstream to Jiangling.",
          "quoteZh": "李白《早发白帝城》：“朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。”",
          "quoteEn": "Li Bai, Departing Baidicheng at Dawn: \"At dawn I leave Baidicheng amid rainbow clouds; a thousand li to Jiangling I return in a single day. While gibbons on both banks cry without cease, my light skiff has already shot past ten thousand mountains.\""
        },
        {
          "year": 762,
          "eraZh": "宝应元年",
          "coord": [
            118.49,
            31.55
          ],
          "via": [
            [
              114.3,
              30.55
            ],
            [
              117,
              30.9
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "当涂（宣城郡）",
          "modernZh": "安徽马鞍山·当涂",
          "ancientEn": "Dangtu (Xuancheng)",
          "modernEn": "Dangtu, Ma'anshan, Anhui",
          "titleZh": "赋临路歌·终老当涂青山",
          "titleEn": "Final Song at Dangtu & Resting by Mount Qing",
          "descZh": "晚年漂泊金陵、宣城、秋浦之间，闻太尉李光弼统军讨史朝义，六十一岁仍请缨从军，行至金陵因病折返，依族叔当涂令李阳冰；宝应元年十一月赋《临路歌》绝笔，病逝于当涂，终葬谢朓曾游之青山。",
          "descEn": "After attempting at sixty-one to join Li Guangbi’s army against the rebels, an ailing Li Bai stayed with his kinsman Li Yangbing in Dangtu, composing his final Song Before the Road and passing away in late 762 CE.",
          "quoteZh": "李白《临路歌》：“大鹏飞兮振八裔，中天摧兮力不济。馀风激兮万世，游扶桑兮挂石袂。”",
          "quoteEn": "Li Bai, Song Before the Road: \"The Great Peng soared and shook the eight horizons; broken in mid-heaven, its strength gave out—yet its lingering wind stirs ten thousand generations.\""
        }
      ]
    },
    {
      "key": "sushi",
      "dynastyKey": "beisong",
      "color": "#1f6f8b",
      "shortZh": "苏轼宦海贬谪",
      "shortEn": "Su Shi",
      "titleZh": "苏轼宦海贬谪行迹",
      "titleEn": "Su Shi's Literary Exile Across Song China",
      "spanZh": "1056年 — 1101年（北宋嘉祐元年至建中靖国元年）",
      "spanEn": "1056 CE – 1101 CE (Northern Song Dynasty)",
      "stops": [
        {
          "year": 1056,
          "eraZh": "嘉祐元年",
          "coord": [
            103.85,
            30.05
          ],
          "labelPos": "bottom",
          "ancientZh": "眉州",
          "modernZh": "四川眉山",
          "ancientEn": "Meizhou",
          "modernEn": "Meishan, Sichuan",
          "titleZh": "弱冠出蜀·仗剑远游",
          "titleEn": "Leaving Meizhou for the Imperial Capital",
          "descZh": "年二十一的苏轼与弟苏辙随父苏洵自蜀中眉州启程，乘舟循岷江入长江，复由褒斜道越秦岭赴东京汴梁应试。",
          "descEn": "At age twenty-one, Su Shi set out from Meizhou in Sichuan with his father Su Xun and brother Su Zhe to take the imperial examinations in Kaifeng.",
          "quoteZh": "苏轼《初发嘉州》：“朝发鼓阗阗，西风猎画旃。故乡飘已远，往意浩无边。”",
          "quoteEn": "Su Shi, Departing Jiazhou: \"Morning drums thunder as the west wind snaps our painted banner; home drifts far behind, our aspirations boundless.\""
        },
        {
          "year": 1057,
          "eraZh": "嘉祐二年",
          "coord": [
            114.35,
            34.79
          ],
          "via": [
            [
              108.5,
              33.6
            ]
          ],
          "labelPos": "top",
          "ancientZh": "东京开封府",
          "modernZh": "河南开封",
          "ancientEn": "Dongjing Kaifeng",
          "modernEn": "Kaifeng, Henan",
          "titleZh": "金榜题名·名动京师",
          "titleEn": "Triumph at the Kaifeng Imperial Court",
          "descZh": "嘉祐二年春闱，主考官欧阳修读苏轼《刑赏忠厚之至论》惊喜击节，苏氏兄弟同科进士及第，文名震动汴京。",
          "descEn": "Chief examiner Ouyang Xiu marveled at Su Shi’s essay in the 1057 examination, proclaiming that the older generation must make way for this rising genius.",
          "quoteZh": "欧阳修《与梅圣俞书》：“读轼书，不觉汗出，快哉快哉！老夫当避路，放他出一头地也。”",
          "quoteEn": "Ouyang Xiu: \"Reading Su Shi’s essay brought beads of sweat in sheer delight—this old man must step aside and let him stand a head above!\""
        },
        {
          "year": 1061,
          "eraZh": "嘉祐六年",
          "coord": [
            107.39,
            34.52
          ],
          "labelPos": "top",
          "ancientZh": "凤翔府",
          "modernZh": "陕西凤翔",
          "ancientEn": "Fengxiang",
          "modernEn": "Fengxiang, Shaanxi",
          "titleZh": "初仕关中·签判凤翔",
          "titleEn": "First Official Post in Fengxiang",
          "descZh": "制科入第三等，授大理评事、签书凤翔府判官。初历地方吏治，兴修东湖、革除衙前弊政，作《喜雨亭记》《石鼓歌》。",
          "descEn": "Appointed magistrate-assessor in Fengxiang in Guanzhong, where he reformed corvée transport and composed Pavilion of Joyful Rain.",
          "quoteZh": "苏轼《喜雨亭记》：“使天而雨珠，寒者不得以为襦；使天而雨玉，饥者不得以为粟。”",
          "quoteEn": "Su Shi, Pavilion of Joyful Rain: \"Were Heaven to rain pearls, the cold could not wear them as coats; were it to rain jade, the hungry could not eat it as grain.\""
        },
        {
          "year": 1071,
          "eraZh": "熙宁四年",
          "coord": [
            120.15,
            30.28
          ],
          "via": [
            [
              114.6,
              32.8
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "杭州",
          "modernZh": "浙江杭州",
          "ancientEn": "Hangzhou",
          "modernEn": "Hangzhou, Zhejiang",
          "titleZh": "外放通判·寄情西湖",
          "titleEn": "Vice-Prefect of Hangzhou & West Lake",
          "descZh": "因上书直陈王安石新法之弊，自请外放任杭州通判（后于元祐四年再知杭州浚湖筑苏堤），巡行属县、赈济灾荒，留下无数西湖诗篇。",
          "descEn": "Opposing Wang Anshi’s New Policies, Su Shi requested provincial assignment as Vice-Prefect of Hangzhou, immortalizing West Lake in verse.",
          "quoteZh": "苏轼《饮湖上初晴后雨》：“欲把西湖比西子，淡妆浓抹总相宜。”",
          "quoteEn": "Su Shi: \"If I may compare West Lake to Lady Xishi, in light makeup or rich adornment she is equally peerless.\""
        },
        {
          "year": 1075,
          "eraZh": "熙宁八年",
          "coord": [
            119.4,
            35.99
          ],
          "labelPos": "top",
          "ancientZh": "密州",
          "modernZh": "山东诸城",
          "ancientEn": "Mizhou",
          "modernEn": "Zhucheng, Shandong",
          "titleZh": "知密州·超然豪放",
          "titleEn": "Governor of Mizhou — Birth of the Heroic Style",
          "descZh": "主动求调密州知州，抗旱捕蝗、收养弃婴；于超然台思念胞弟苏辙，写就《水调歌头·明月几时有》与《江城子·密州出猎》，开宋词豪放一派。",
          "descEn": "As Governor of Mizhou in Shandong, Su Shi pioneered the heroic ci-poetry style with \"When Will the Bright Moon Be\" and \"Hunting at Mizhou.\"",
          "quoteZh": "苏轼《水调歌头》：“人有悲欢离合，月有阴晴圆缺，此事古难全。但愿人长久，千里共婵娟。”",
          "quoteEn": "Su Shi, Prelude to Water Melody: \"Men have sorrow and joy, parting and reunion; the moon has clouds and clear skies, waxing and waning.\""
        },
        {
          "year": 1077,
          "eraZh": "熙宁十年",
          "coord": [
            117.18,
            34.26
          ],
          "labelPos": "top",
          "ancientZh": "徐州·湖州",
          "modernZh": "江苏徐州",
          "ancientEn": "Xuzhou & Huzhou",
          "modernEn": "Xuzhou, Jiangsu",
          "titleZh": "徐州抗洪·乌台诗案",
          "titleEn": "Flood Defense at Xuzhou & the Crow Terrace Case",
          "descZh": "知徐州时黄河决口迫城，苏轼布衣草履率禁军筑堤死守保住全城；元丰二年调知湖州，旋因诗文遭御史台弹劾逮赴汴京诏狱，史称“乌台诗案”。",
          "descEn": "After saving Xuzhou from Yellow River floods, Su Shi was arrested in 1079 over alleged satire in his poems and imprisoned in the Imperial Censorate (\"Crow Terrace Case\").",
          "quoteZh": "苏轼《狱中寄子由》：“是处青山可埋骨，他年夜雨独伤神。与君世世为兄弟，更结来生未了因。”",
          "quoteEn": "Su Shi, From Prison to Ziyou: \"Anywhere the green hills may bury my bones; in future years you will grieve alone in the night rain.\""
        },
        {
          "year": 1080,
          "eraZh": "元丰三年",
          "coord": [
            114.87,
            30.45
          ],
          "labelPos": "bottom",
          "ancientZh": "黄州",
          "modernZh": "湖北黄冈",
          "ancientEn": "Huangzhou",
          "modernEn": "Huanggang, Hubei",
          "titleZh": "贬谪黄州·东坡赤壁",
          "titleEn": "Exile in Huangzhou — Dongpo & the Red Cliffs",
          "descZh": "出狱后责授检校水部员外郎、黄州团练副使。躬耕城东荒坡自号“东坡居士”，于困顿中完成了精神蜕变，写出《定风波》《念奴娇·赤壁怀古》、前后《赤壁赋》与《寒食帖》。",
          "descEn": "Banished to Huangzhou on the Yangtze, he farmed the \"Eastern Slope\" (taking the name Dongpo) and composed his greatest masterpieces at the Red Cliffs.",
          "quoteZh": "苏轼《定风波》：“竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。”",
          "quoteEn": "Su Shi, Calming the Waves: \"Bamboo staff and straw sandals lighter than a steed—who fears? One straw cloak in misty rain for a lifetime.\""
        },
        {
          "year": 1094,
          "eraZh": "绍圣元年",
          "coord": [
            114.41,
            23.11
          ],
          "via": [
            [
              115.2,
              26.8
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "惠州",
          "modernZh": "广东惠州",
          "ancientEn": "Huizhou",
          "modernEn": "Huizhou, Guangdong",
          "titleZh": "再贬岭南·寓居惠州",
          "titleEn": "Banished South of the Nanling to Huizhou",
          "descZh": "元祐更化曾召还翰林学士、知杭州颖州扬州定州；绍圣元年哲宗亲政后新党复起，年近六旬的苏轼远贬岭南惠州安置，捐犀带助修东新桥、西新桥。",
          "descEn": "Following political reversals in 1094, the nearly sixty-year-old Su Shi was banished across the Nanling Mountains to Huizhou in Guangdong.",
          "quoteZh": "苏轼《食荔枝》：“日啖荔枝三百颗，不辞长作岭南人。”",
          "quoteEn": "Su Shi, Eating Lychees: \"Feasting on three hundred lychees a day, I would gladly remain a man of Lingnan forever.\""
        },
        {
          "year": 1097,
          "eraZh": "绍圣四年",
          "coord": [
            109.58,
            19.52
          ],
          "via": [
            [
              110.3,
              21.1
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "儋州",
          "modernZh": "海南儋州",
          "ancientEn": "Danzhou",
          "modernEn": "Danzhou, Hainan",
          "titleZh": "渡海琼州·敷文儋耳",
          "titleEn": "Across the Sea to Danzhou (Hainan Island)",
          "descZh": "六十二岁再贬琼州别驾、昌化军（儋州）安置。跨海抵天涯绝岛，居桄榔庵、食芋饮水、讲学授徒，开启琼州文教之风，培养出海南首位举人姜唐佐。",
          "descEn": "At sixty-two, banished across the Qiongzhou Strait to Hainan Island, where he lived in a palm-thatched hut and mentored Hainan’s first provincial graduate.",
          "quoteZh": "苏轼《六月二十日夜渡海》：“九死南荒吾不恨，兹游奇绝冠平生。”",
          "quoteEn": "Su Shi, Crossing the Sea at Night: \"Nine deaths in the southern wilds leave me no regret—this wondrous journey crowns my entire life.\""
        },
        {
          "year": 1101,
          "eraZh": "建中靖国元年",
          "coord": [
            119.97,
            31.81
          ],
          "via": [
            [
              114.9,
              25.8
            ],
            [
              117.2,
              29.8
            ]
          ],
          "labelPos": "top",
          "ancientZh": "常州",
          "modernZh": "江苏常州",
          "ancientEn": "Changzhou",
          "modernEn": "Changzhou, Jiangsu",
          "titleZh": "遇赦北归·终老毗陵",
          "titleEn": "Pardoned Return North & Final Rest in Changzhou",
          "descZh": "元符三年徽宗即位大赦北归，渡海经廉州、永州沿赣江北上；建中靖国元年七月廿八日病逝于常州顾塘桥孙氏馆，享年六十六岁。",
          "descEn": "Pardoned in 1100, Su Shi traveled north by boat and passed away in Changzhou in July 1101 at age sixty-six, summing up his life in a final self-portrait poem.",
          "quoteZh": "苏轼《自题金山画像》：“心似已灰之木，身如不系之舟。问汝平生功业，黄州惠州儋州。”",
          "quoteEn": "Su Shi, Inscription on My Portrait at Jinshan: \"My heart like ashen wood, my body an unmoored boat. Ask of my life’s achievements: Huangzhou, Huizhou, Danzhou.\""
        }
      ]
    },
    {
      "key": "wangyangming",
      "dynastyKey": "ming",
      "color": "#b33939",
      "shortZh": "王阳明知行悟道",
      "shortEn": "Wang Yangming",
      "titleZh": "王阳明知行悟道行迹",
      "titleEn": "Wang Yangming's Unity of Knowledge & Action",
      "spanZh": "1472年 — 1529年（明成化八年至嘉靖七年）",
      "spanEn": "1472 CE – 1529 CE (Ming Dynasty)",
      "stops": [
        {
          "year": 1472,
          "eraZh": "成化八年",
          "coord": [
            121.15,
            30.04
          ],
          "labelPos": "right",
          "ancientZh": "余姚",
          "modernZh": "浙江宁波余姚",
          "ancientEn": "Yuyao",
          "modernEn": "Yuyao, Ningbo, Zhejiang",
          "titleZh": "降生瑞云·志在圣贤",
          "titleEn": "Birth at Ruiyun Tower & Aspiration for Sagehood",
          "descZh": "王守仁诞生于浙江绍兴府余姚县瑞云楼，父王华次年高中状元。十一岁随祖父北上京师塾读，问塾师「何为第一等事」，师答「惟读书登第耳」，守仁昂然对曰：「登第恐未为第一等事，或读书学圣贤耳。」自幼立下成圣之志。",
          "descEn": "Born at Ruiyun Tower in Yuyao, Wang Shouren asked his tutor at age eleven what the highest pursuit in life was. Told it was passing the imperial exams, he replied: \"Passing exams is surely not the highest pursuit; learning to become a sage is.\"",
          "quoteZh": "王阳明少时语：“登第恐未为第一等事，或读书学圣贤耳。”——《王阳明先生年谱》",
          "quoteEn": "Young Wang Yangming: \"Passing the imperial examination is hardly the highest undertaking; reading to become a sage is.\""
        },
        {
          "year": 1489,
          "eraZh": "弘治二年",
          "coord": [
            117.97,
            28.45
          ],
          "via": [
            [
              119.64,
              29.08
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "广信",
          "modernZh": "江西上饶",
          "ancientEn": "Guangxin",
          "modernEn": "Shangrao, Jiangxi",
          "titleZh": "谒娄一斋·始闻格物",
          "titleEn": "Meeting Lou Liang at Guangxin & Inquiring into Gewu",
          "descZh": "十八岁自南昌迎妇归余姚，舟次江西广信（今上饶），特往拜谒崇仁学派大儒娄谅（娄一斋）。娄谅向其阐发宋儒格物穷理之旨，语以「圣人必可学而至」，守仁深相契合，自此笃志圣学，归后遍读考亭朱子遗书。",
          "descEn": "Returning from Nanchang at age eighteen, Wang visited Neo-Confucian master Lou Liang at Guangxin, who assured him that sagehood could truly be attained through learning and inquiry.",
          "quoteZh": "《明史·王守仁传》：“过广信，谒娄谅，语以圣人可学而至，遂深契之。”",
          "quoteEn": "History of Ming: \"Passing through Guangxin, he visited Lou Liang, who taught that sagehood can be learned, striking a deep chord in him.\""
        },
        {
          "year": 1492,
          "eraZh": "弘治五年",
          "coord": [
            116.4,
            39.9
          ],
          "via": [
            [
              118.8,
              32.06
            ],
            [
              117.2,
              36.65
            ]
          ],
          "labelPos": "top",
          "ancientZh": "京师",
          "modernZh": "北京",
          "ancientEn": "Jingshi (Beijing)",
          "modernEn": "Beijing",
          "titleZh": "格竹致疾·进士及第",
          "titleEn": "Investigating Bamboo & Passing the Metropolitan Exam",
          "descZh": "在京师欲依朱熹「即物穷理」之法穷究草木之理，与钱友同坐亭前面竹「格竹」七日七夜，理未得而劳神成疾，始疑外求之弊。弘治十二年（1499）赐进士及第，历任工部、刑部主事，究心兵法韬略与经世之学。",
          "descEn": "In Beijing, Wang meditated before bamboo for seven days trying to grasp its Neo-Confucian principle, falling ill and doubting externalism. In 1499 he passed the palace exam and served in the Ministries of Works and Justice.",
          "quoteZh": "《传习录》：“众人只说格物要依晦翁，何曾把他的说去用？我着实曾用来。”",
          "quoteEn": "Instructions for Practical Living: \"People say we must follow Zhu Xi in investigating things, yet who has truly practiced it? I genuinely tried for seven days.\""
        },
        {
          "year": 1506,
          "eraZh": "正德元年",
          "coord": [
            120.2,
            30.22
          ],
          "via": [
            [
              117.2,
              34.26
            ],
            [
              119.45,
              32.2
            ]
          ],
          "labelPos": "right",
          "ancientZh": "钱塘江",
          "modernZh": "浙江杭州钱塘江口",
          "ancientEn": "Qiantang River",
          "modernEn": "Hangzhou, Zhejiang",
          "titleZh": "廷杖下狱·投江脱险",
          "titleEn": "Flogged in Court & Escaping Assassins at Qiantang",
          "descZh": "正德元年，司礼监权宦刘瑾擅权，逮捕南京给事中戴铣等二十余人。守仁抗疏力救，触怒刘瑾，被廷杖四十下诏狱，谪贵州龙场驿丞。南下途经杭州钱塘江，刘瑾遣刺客尾随欲加害，守仁夜掷衣冠于江中留绝命诗诈死，乘海舟脱险。",
          "descEn": "For defending upright officials against eunuch dictator Liu Jin, Wang was flogged forty strokes, imprisoned, and banished to Guizhou. Pursued by Liu Jin’s assassins at Qiantang River, he faked his drowning at night to escape.",
          "quoteZh": "王阳明《泛海》：“险夷原不滞胸中，何异浮云过太空！夜静海涛三万里，月明飞锡下天风。”",
          "quoteEn": "Wang Yangming, Sailing the Sea: \"Danger and safety leave no trace in my breast, like floating clouds across the vast sky!\""
        },
        {
          "year": 1508,
          "eraZh": "正德三年",
          "coord": [
            106.59,
            26.84
          ],
          "via": [
            [
              115.9,
              28.68
            ],
            [
              112.9,
              28.19
            ],
            [
              109.6,
              27.2
            ]
          ],
          "labelPos": "left",
          "ancientZh": "龙场",
          "modernZh": "贵州贵阳修文",
          "ancientEn": "Longchang",
          "modernEn": "Xiuwen, Guiyang, Guizhou",
          "titleZh": "龙场大悟·创立心学",
          "titleEn": "Longchang Enlightenment & Philosophy of Mind",
          "descZh": "抵达贵州万山丛棘、瘴疠横行之龙场驿。居东洞石棺之中，日夜端居澄默，自问「圣人处此更有何道」。正德三年中夜忽然大悟格物致知之旨，彻见「圣人之道，吾性自足，向之求理于事物者误也」，继而倡「知行合一」，开五百年阳明心学。",
          "descEn": "Living in a stone cave in remote Guizhou, Wang meditated day and night on life and death. One midnight in 1508 he achieved sudden enlightenment: \"The Way of the Sages is complete within my own nature; seeking principles in external things was mistaken.\"",
          "quoteZh": "《王阳明年谱》：“圣人之道，吾性自足，向之求理于事物者误也。”",
          "quoteEn": "Chronicle of Wang Yangming: \"The Way of the Sages is self-sufficient within our own mind-nature; seeking principle outside in external things was an error.\""
        },
        {
          "year": 1510,
          "eraZh": "正德五年",
          "coord": [
            114.98,
            27.11
          ],
          "via": [
            [
              109.6,
              26.8
            ],
            [
              112.6,
              26.89
            ]
          ],
          "labelPos": "left",
          "ancientZh": "庐陵",
          "modernZh": "江西吉安",
          "ancientEn": "Luling",
          "modernEn": "Ji'an, Jiangxi",
          "titleZh": "知县庐陵·兴教善政",
          "titleEn": "Magistrate of Luling — Benevolent Governance",
          "descZh": "刘瑾伏诛前夕，守仁升任江西吉安府庐陵县知县。视事七月，不以威刑而重告谕，均徭役、息词讼、立十家牌保甲法，选里老敦厚者劝诫乡民，庐陵风俗翕然丕变，为日后经略江西奠定深厚民心。",
          "descEn": "Appointed magistrate of Luling County in Jiangxi, Wang governed through moral persuasion rather than harsh punishment, equalizing corvée labor and establishing community compacts.",
          "quoteZh": "王阳明《告谕庐陵父老》：“一念之善，即吉神佑之；一念之恶，即厉鬼随之。”",
          "quoteEn": "Proclamation to the Elders of Luling: \"A single good thought brings auspicious blessings; a single evil thought invites calamity.\""
        },
        {
          "year": 1517,
          "eraZh": "正德十二年",
          "coord": [
            114.93,
            25.83
          ],
          "via": [
            [
              115.05,
              26.45
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "赣州",
          "modernZh": "江西赣州",
          "ancientEn": "Ganzhou",
          "modernEn": "Ganzhou, Jiangxi",
          "titleZh": "巡抚南赣·破山中贼",
          "titleEn": "Governor of Southern Gan — Quelling Mountain Bandits",
          "descZh": "受兵部尚书王琼力荐，以左佥都御史巡抚南赣汀漳。自编选练民兵，严明赏罚，两年内连破詹师富、大帽山、横水、桶冈、浰头诸巢，荡平盘踞赣闽粤湘边界数十年之巨寇；继而颁《南赣乡约》、设崇义县，兴立社学教化百姓。",
          "descEn": "As Governor of Southern Gan, Wang trained local militias and eradicated decades-old bandit strongholds across the Jiangxi–Fujian–Guangdong border, then instituted the Southern Gan Community Compact.",
          "quoteZh": "王阳明《与杨仕德薛尚谦书》：“破山中贼易，破心中贼难。”",
          "quoteEn": "Letter to Yang Shide: \"It is easy to vanquish the bandits in the mountains, but hard to vanquish the bandits in the mind.\""
        },
        {
          "year": 1519,
          "eraZh": "正德十四年",
          "coord": [
            115.89,
            28.68
          ],
          "via": [
            [
              115.2,
              27.35
            ]
          ],
          "labelPos": "left",
          "ancientZh": "南昌",
          "modernZh": "江西南昌·鄱阳湖",
          "ancientEn": "Nanchang",
          "modernEn": "Nanchang & Poyang Lake, Jiangxi",
          "titleZh": "平宁王乱·奇兵定难",
          "titleEn": "Crushing Prince of Ning's Rebellion in 35 Days",
          "descZh": "六月，宁王朱宸濠于南昌起兵十万反叛，顺江东下围安庆、逼南京。守仁在丰城闻变，退保吉安特征集义军，施反间疑兵计迟滞叛军，随即乘虚直捣南昌老巢。宁王回救，两军决战于鄱阳湖黄家渡，守仁火攻大破叛军，仅三十五日生擒朱宸濠。",
          "descEn": "When Prince Zhu Chenhao rebelled with 100,000 troops, Wang rallied local forces in Ji’an, used deception to stall the rebels, stormed their base at Nanchang, and captured the prince after a fire-ship battle on Poyang Lake in just 35 days.",
          "quoteZh": "王阳明《擒获宸濠捷音疏》：“臣等仰仗天威，一鼓而克其巢穴，再战而擒其渠魁。”",
          "quoteEn": "Victory Memorial on Capturing Chenhao: \"With one drumbeat we stormed his lair; in the second battle we captured the rebel chief alive.\""
        },
        {
          "year": 1521,
          "eraZh": "正德十六年",
          "coord": [
            120.58,
            30
          ],
          "via": [
            [
              117.97,
              28.45
            ],
            [
              119.64,
              29.08
            ]
          ],
          "labelPos": "bottom",
          "ancientZh": "绍兴",
          "modernZh": "浙江绍兴",
          "ancientEn": "Shaoxing",
          "modernEn": "Shaoxing, Zhejiang",
          "titleZh": "致良知教·天泉证道",
          "titleEn": "Doctrine of Liangzhi & Tianquan Bridge Discourse",
          "descZh": "明世宗即位，封守仁新建伯，守仁归越城绍兴，于稽山书院、阳明洞聚徒讲学，正式揭出「致良知」三字教法，四方学者云集。嘉靖六年（1527）奉诏出征两广前夕，于天泉桥与大弟子钱德洪、王畿印证心学「四句教」，成心学传世纲领。",
          "descEn": "Enfeoffed as Earl of Xinjian, Wang lectured at Shaoxing and proclaimed the doctrine of \"Extending Innate Moral Knowledge\" (Zhi Liangzhi). On the eve of his Guangxi campaign in 1527, he delivered the Four-Sentence Teaching at Tianquan Bridge.",
          "quoteZh": "《天泉证道·四句教》：“无善无恶心之体，有善有恶意之动。知善知恶是良知，为善去恶是格物。”",
          "quoteEn": "Four-Sentence Teaching: \"Neither good nor evil is the substance of the mind; good and evil arise with the movement of intention. Knowing good and evil is innate knowledge; doing good and removing evil is the investigation of things.\""
        },
        {
          "year": 1529,
          "eraZh": "嘉靖七年冬",
          "coord": [
            114.36,
            25.4
          ],
          "via": [
            [
              115.89,
              28.68
            ],
            [
              111.2,
              24.5
            ],
            [
              108.32,
              23.4
            ],
            [
              112.5,
              24.8
            ]
          ],
          "labelPos": "left",
          "ancientZh": "南安",
          "modernZh": "江西南安府（今大余）",
          "ancientEn": "Nan'an",
          "modernEn": "Dayu, Ganzhou, Jiangxi",
          "titleZh": "此心光明·亦复何言",
          "titleEn": "Radiant Mind — Final Passing at Qinglongpu",
          "descZh": "嘉靖六年总督两广，不费一兵一卒招抚思恩、田州卢苏王受七万众，继以奇兵荡平断藤峡八寨瑶乱。次年冬肺疾加剧上疏乞归，十一月二十九日（公历1529年1月）舟次江西南安府大余县青龙铺。门人周积问遗言，先生微笑曰：「此心光明，亦复何言！」遂瞑目而逝。",
          "descEn": "After pacifying Guangxi’s Sien, Tianzhou, and Rattan Gorge rebellions, Wang fell gravely ill on his journey home. Passing away on a boat at Qinglongpu in Nan’an, he spoke his final words: \"This mind is luminous; what more is there to say?\"",
          "quoteZh": "王阳明临终遗言：“此心光明，亦复何言！”——《王阳明先生年谱》",
          "quoteEn": "Wang Yangming’s last words: \"This mind is luminous—what more is there to say!\""
        }
      ]
    }
  ],
  "STRATEGIC_PASSES": [
    {
      "key": "hanguguan",
      "ancientZh": "函谷关",
      "ancientEn": "Hangu Pass",
      "modernZh": "河南灵宝",
      "modernEn": "Lingbao, Henan",
      "coord": [
        110.92,
        34.63
      ],
      "appear": -403,
      "vanish": 200,
      "focusYear": -241,
      "align": "b",
      "rangeZh": "崤山 · 黄河大曲南岸",
      "rangeEn": "Mount Xiao & Yellow River Gorge",
      "chokepointZh": "西据关中高原，东临绝涧，南接秦岭，北塞黄河，因关在谷中深险如函得名，为战国秦汉“一夫当关，万夫莫开”之东大门。",
      "chokepointEn": "Set deep in a canyon between Mount Xiao, the Qinling Mountains, and the Yellow River; the impregnable eastern gateway of Qin and Western Han."
    },
    {
      "key": "tongguan",
      "ancientZh": "潼关",
      "ancientEn": "Tongguan Pass",
      "modernZh": "陕西潼关",
      "modernEn": "Tongguan, Shaanxi",
      "coord": [
        110.25,
        34.54
      ],
      "appear": 196,
      "focusYear": 756,
      "align": "b",
      "rangeZh": "秦岭北麓 · 黄河风陵渡南",
      "rangeEn": "Qinling Foothills & Yellow River Bend",
      "chokepointZh": "东汉建安年间代函谷关而兴，北临黄河、渭水、洛水三河交汇，南依秦岭绝壁，扼长安与洛阳两京咽喉，为汉唐以降关中第一锁钥。",
      "chokepointEn": "Established in the late Eastern Han at the confluence of the Yellow, Wei, and Luo rivers against the Qinling cliffs; the primary lock between Chang’an and Luoyang."
    },
    {
      "key": "wuguan",
      "ancientZh": "武关",
      "ancientEn": "Wuguan Pass",
      "modernZh": "陕西丹凤",
      "modernEn": "Danfeng, Shaanxi",
      "coord": [
        110.33,
        33.62
      ],
      "appear": -403,
      "focusYear": -206,
      "align": "r",
      "rangeZh": "秦岭东段 · 丹江峡谷",
      "rangeEn": "Eastern Qinling & Dan River Gorge",
      "chokepointZh": "居秦岭东段少习山峡谷，控丹江水陆通道，与函谷关、萧关、大散关并称“秦之四塞”，为江汉、南阳盆地入关中之南大门。",
      "chokepointEn": "One of the \"Four Fortresses of Qin\" guarding the Dan River gorge through the eastern Qinling Mountains, linking the Nanyang Basin with Guanzhong."
    },
    {
      "key": "dasanguan",
      "ancientZh": "大散关",
      "ancientEn": "Dasan Pass",
      "modernZh": "陕西宝鸡西南",
      "modernEn": "Baoji SW, Shaanxi",
      "coord": [
        106.95,
        34.28
      ],
      "appear": -403,
      "focusYear": 228,
      "align": "l",
      "rangeZh": "秦岭北麓 · 陈仓故道",
      "rangeEn": "Qinling North Slope & Chencang Road",
      "chokepointZh": "扼秦岭北麓清姜河谷与嘉陵江源头，为关中经陈仓道、故道出入汉中与巴蜀之咽喉，“楼船夜雪瓜洲渡，铁马秋风大散关”。",
      "chokepointEn": "Guards the northern entrance of the Chencang trail across the Qinling Mountains, the strategic hinge between Guanzhong, Hanzhong, and Sichuan."
    },
    {
      "key": "xiaoguan",
      "ancientZh": "萧关",
      "ancientEn": "Xiaoguan Pass",
      "modernZh": "宁夏固原东南",
      "modernEn": "Guyuan SE, Ningxia",
      "coord": [
        106.32,
        35.85
      ],
      "appear": -403,
      "focusYear": -166,
      "align": "l",
      "rangeZh": "六盘山（陇山） · 泾水谷道",
      "rangeEn": "Liupan Mountains & Jing River Corridor",
      "chokepointZh": "锁六盘山（古陇山）东麓泾水通道，为关中西北门户；汉文帝时匈奴入朝那萧关、唐宋防御吐蕃与西夏皆以此为要冲。",
      "chokepointEn": "Controls the Jing River corridor on the eastern flank of the Liupan Mountains, serving as the northwestern shield of Chang’an against steppe incursions."
    },
    {
      "key": "hulaoguan",
      "ancientZh": "虎牢关",
      "ancientEn": "Hulao Pass",
      "modernZh": "河南荥阳汜水",
      "modernEn": "Xingyang, Henan",
      "coord": [
        113.32,
        34.82
      ],
      "appear": -403,
      "focusYear": 621,
      "align": "t",
      "rangeZh": "嵩山北麓 · 黄河汜水交汇",
      "rangeEn": "Mount Song Foothills & Sishui Gorge",
      "chokepointZh": "又名汜水关、成皋关，北临黄河，南依嵩山邙岭，绝岸峻崖天然成隘，历为洛阳东境屏障，唐秦王李世民在此一战擒窦建德、降王世充。",
      "chokepointEn": "Also known as Sishui or Chenggao Pass; wedged between the Yellow River and the Mount Song bluffs as the eastern bulwark of Luoyang."
    },
    {
      "key": "jianmenguan",
      "ancientZh": "剑门关",
      "ancientEn": "Jianmen Pass",
      "modernZh": "四川剑阁",
      "modernEn": "Jiange, Sichuan",
      "coord": [
        105.53,
        32.21
      ],
      "appear": -316,
      "focusYear": 263,
      "align": "l",
      "rangeZh": "大剑山 · 蜀道金牛道",
      "rangeEn": "Dajian Mountain & Jinniu Shu Road",
      "chokepointZh": "大剑山七十二峰断崖绝壁相倚如门，诸葛亮在此垒石立剑阁，扼金牛道入蜀咽喉，“剑阁峥嵘而崔嵬，一夫当关，万夫莫开”。",
      "chokepointEn": "Built by Zhuge Liang in a sheer cliff gap of the Dajian Mountains along the Jinniu Shu Road; the northern lock of the Sichuan Basin."
    },
    {
      "key": "yangpingguan",
      "ancientZh": "阳平关",
      "ancientEn": "Yangping Pass",
      "modernZh": "陕西勉县西",
      "modernEn": "Mianxian W, Shaanxi",
      "coord": [
        106.12,
        33.11
      ],
      "appear": 191,
      "focusYear": 219,
      "align": "l",
      "rangeZh": "秦巴谷地 · 汉水上游",
      "rangeEn": "Upper Han River & Hanzhong West Gate",
      "chokepointZh": "北依秦岭，南临汉水与嘉陵江分水岭，与定军山隔江相望，为汉中盆地西大门及蜀汉北伐屯兵要塞。",
      "chokepointEn": "Guarding the western approach to the Hanzhong Basin opposite Mount Dingjun, linking the upper Han River with the Sichuan passes."
    },
    {
      "key": "yanmenguan",
      "ancientZh": "雁门关",
      "ancientEn": "Yanmen Pass",
      "modernZh": "山西代县北",
      "modernEn": "Daixian N, Shanxi",
      "coord": [
        112.87,
        39.19
      ],
      "appear": -403,
      "focusYear": -129,
      "align": "l",
      "rangeZh": "恒山 · 勾注山脊",
      "rangeEn": "Mount Heng & Gouzhu Ridge",
      "chokepointZh": "屹立恒山与吕梁山交汇之勾注山巅，南控晋阳（太原），北瞰塞外云朔草原，自赵武灵王李牧、汉卫青霍去病至宋杨业，历称“九塞尊崇第一关”。",
      "chokepointEn": "Perched atop the Gouzhu Ridge of the Hengshan range between the Datong steppe basin and Taiyuan; revered as the foremost of China’s Nine Frontier Passes."
    },
    {
      "key": "juyongguan",
      "ancientZh": "居庸关",
      "ancientEn": "Juyong Pass",
      "modernZh": "北京昌平西北",
      "modernEn": "Changping NW, Beijing",
      "coord": [
        116.07,
        40.29
      ],
      "appear": -403,
      "focusYear": 1449,
      "align": "l",
      "rangeZh": "太行军都陉 · 燕山交汇",
      "rangeEn": "Jundu Gorge, Taihang & Yanshan",
      "chokepointZh": "居“太行八陉”第八陉军都陉，关沟峡谷长四十里，两山夹峙、巨涧中流，自古为幽燕与北京西北第一天险。",
      "chokepointEn": "Controls the 20-km Jundu Gorge where the Taihang and Yanshan ranges meet, forming the northwestern bastion of Beijing."
    },
    {
      "key": "zijingguan",
      "ancientZh": "紫荆关",
      "ancientEn": "Zijing Pass",
      "modernZh": "河北易县西北",
      "modernEn": "Yixian NW, Hebei",
      "coord": [
        115.17,
        39.42
      ],
      "appear": -403,
      "focusYear": 1449,
      "align": "l",
      "rangeZh": "太行蒲阴陉 · 拒马河谷",
      "rangeEn": "Puyin Gorge, Taihang Mountains",
      "chokepointZh": "居“太行八陉”第七陉蒲阴陉，东达保定与华北平原，西通大同与宣府，与居庸关、倒马关并称明长城“内三关”。",
      "chokepointEn": "Situated in the Puyin Gorge of the Taihang Mountains; one of the Three Inner Passes protecting the North China Plain from the western plateau."
    },
    {
      "key": "niangziguan",
      "ancientZh": "娘子关（井陉）",
      "ancientEn": "Niangzi (Jingxing) Pass",
      "aliases": ["井陉关", "井陉口", "土门关", "苇泽关", "井陉"],
      "modernZh": "山西平定·河北井陉",
      "modernEn": "Pingding / Jingxing",
      "coord": [
        113.89,
        37.97
      ],
      "appear": -403,
      "focusYear": -204,
      "align": "b",
      "rangeZh": "太行井陉 · 绵河峡谷",
      "rangeEn": "Jingxing Gorge, Taihang Mountains",
      "chokepointZh": "古称苇泽关，扼“太行八陉”第五陉井陉狭道，“车不得方轨，骑不得成列”，韩信背水一战灭赵、唐平阳公主驻兵于此得名。",
      "chokepointEn": "Commands the narrow Jingxing Gorge through the central Taihang Mountains where Han Xin fought his famous Battle of Jingxing with his back to the river."
    },
    {
      "key": "shanhaiguan",
      "ancientZh": "山海关（渝关）",
      "ancientEn": "Shanhai Pass",
      "modernZh": "河北秦皇岛",
      "modernEn": "Qinhuangdao, Hebei",
      "coord": [
        119.77,
        40.01
      ],
      "appear": 583,
      "focusYear": 1644,
      "align": "r",
      "rangeZh": "燕山东端 · 辽西走廊临海处",
      "rangeEn": "Mount Yan & Bohai Coastal Corridor",
      "chokepointZh": "隋开皇三年筑临渝关，明洪武十四年徐达移建山海关，北倚燕山角山，南接渤海老龙头，扼辽西走廊入关唯一通道，号“天下第一关”。",
      "chokepointEn": "Wedged in the narrow coastal strip between the Yanshan Mountains and the Bohai Sea, guarding the Liaoxi Corridor as the \"First Pass Under Heaven.\""
    },
    {
      "key": "gubeikou",
      "ancientZh": "古北口",
      "ancientEn": "Gubeikou Pass",
      "modernZh": "北京密云东北",
      "modernEn": "Miyun NE, Beijing",
      "coord": [
        117.16,
        40.69
      ],
      "appear": 555,
      "focusYear": 1368,
      "align": "r",
      "rangeZh": "燕山中段 · 潮河峡谷",
      "rangeEn": "Yanshan Range & Chao River Gorge",
      "chokepointZh": "潮河劈开燕山蟠龙、卧虎二山形成之天险隘口，东顾山海，西援居庸，为蒙古草原南下直趋幽州之咽喉捷径。",
      "chokepointEn": "Carved through the Yanshan Mountains by the Chao River; the direct northern mountain gateway between the Mongolian steppe and Beijing."
    },
    {
      "key": "yumenguan",
      "ancientZh": "玉门关",
      "ancientEn": "Yumen Pass",
      "modernZh": "甘肃敦煌西北",
      "modernEn": "Dunhuang NW, Gansu",
      "coord": [
        93.86,
        40.35
      ],
      "appear": -111,
      "focusYear": -102,
      "align": "t",
      "rangeZh": "疏勒河谷 · 西域北道门户",
      "rangeEn": "Shule River & Northern Silk Road Gate",
      "chokepointZh": "汉武帝“列四郡、据两关”之一，因西域和田美玉由此输入中原得名，扼河西走廊通往西域北道之咽喉，“春风不度玉门关”。",
      "chokepointEn": "Established by Emperor Wu of Han at the western end of the Hexi Corridor, controlling the northern Silk Road route toward Hami and Turpan."
    },
    {
      "key": "yangguan",
      "ancientZh": "阳关",
      "ancientEn": "Yangguan Pass",
      "modernZh": "甘肃敦煌西南",
      "modernEn": "Dunhuang SW, Gansu",
      "coord": [
        94.06,
        39.93
      ],
      "appear": -111,
      "focusYear": 737,
      "align": "b",
      "rangeZh": "渥洼池南 · 西域南道门户",
      "rangeEn": "Southern Silk Road & Lop Nor Gate",
      "chokepointZh": "因居玉门关之南得名，扼河西走廊通往楼兰、鄯善、于阗之丝路南道门户，“劝君更尽一杯酒，西出阳关无故人”。",
      "chokepointEn": "Located south of Yumen Pass, guarding the southern Silk Road oasis route toward Loulan, Khotan, and the Pamir Mountains."
    },
    {
      "key": "jiayuguan",
      "ancientZh": "嘉峪关",
      "ancientEn": "Jiayuguan Pass",
      "modernZh": "甘肃嘉峪关",
      "modernEn": "Jiayuguan, Gansu",
      "coord": [
        98.22,
        39.8
      ],
      "appear": 1372,
      "focusYear": 1372,
      "align": "t",
      "rangeZh": "祁连山雪峰 · 黑山峡谷",
      "rangeEn": "Qilian Snow Peaks & Heishan Narrow",
      "chokepointZh": "明洪武五年冯胜择河西走廊最窄处（南北仅十五公里）筑关，南倚祁连终年积雪，北连黑山悬壁，为明代万里长城西端起点，号“天下第一雄关”。",
      "chokepointEn": "Built in 1372 at the narrowest 15-km waist of the Hexi Corridor between the Qilian snow peaks and Black Mountain; the western terminus of the Ming Great Wall."
    },
    {
      "key": "wushengguan",
      "ancientZh": "武胜关（冥阨）",
      "ancientEn": "Wusheng (Ming'e) Pass",
      "modernZh": "河南信阳·湖北广水",
      "modernEn": "Xinyang / Guangshui",
      "coord": [
        114.08,
        31.81
      ],
      "appear": -403,
      "focusYear": -506,
      "align": "r",
      "rangeZh": "大别山 · 桐柏山交界隘口",
      "rangeEn": "Dabie & Tongbai Mountain Saddle",
      "chokepointZh": "春秋称大隧、直辕、冥阨（义阳三关），扼淮河上游与江汉平原分水岭最低山口，历为中原南下武汉、荆襄之兵家必争通道。",
      "chokepointEn": "One of the Three Passes of Yiyang at the saddle between the Tongbai and Dabie mountains, controlling the north-south corridor between the Central Plains and the middle Yangtze."
    },
    {
      "key": "xianxiaguan",
      "ancientZh": "仙霞关",
      "ancientEn": "Xianxia Pass",
      "modernZh": "浙江江山·福建浦城",
      "modernEn": "Jiangshan, Zhejiang",
      "coord": [
        118.52,
        28.38
      ],
      "appear": 878,
      "focusYear": 878,
      "align": "l",
      "rangeZh": "仙霞岭 · 浙闽赣三省交界",
      "rangeEn": "Xianxia Ridge (Zhejiang-Fujian Border)",
      "chokepointZh": "唐乾符五年黄巢军自浙入闽刊山开道七百里，始通仙霞古道；崇山峻岭夹峙竹林石级，为钱塘江流域通往建州（福建）之唯一陆路锁钥。",
      "chokepointEn": "Cut through the Xianxia Mountains by Huang Chao’s army in 878 CE, guarding the mountain trail linking Zhejiang with Fujian."
    },
    {
      "key": "meiguan",
      "ancientZh": "梅关（大庾岭）",
      "ancientEn": "Meiguan (Dayu Ridge) Pass",
      "modernZh": "广东南雄·江西大余",
      "modernEn": "Nanxiong / Dayu",
      "coord": [
        114.34,
        25.32
      ],
      "appear": -214,
      "focusYear": 716,
      "align": "r",
      "rangeZh": "五岭大庾岭 · 赣粤古驿道",
      "rangeEn": "Dayu Ridge of the Five Ridges",
      "chokepointZh": "秦置横浦关，唐开元四年张九龄奉诏凿辟大庾岭新路，沟通长江水系章水与珠江水系浈水，成为唐宋明清南北商旅与文人迁谪第一驿道。",
      "chokepointEn": "Widened across the Dayu Ridge by Chancellor Zhang Jiuling in 716 CE to link the Gan and Pearl river basins across the Five Ridges."
    }
  ],
  "PLACE_GAZETTEER": [
    { "name": "洛邑", "aliases": ["成周", "东周王城", "洛京"], "modern": "河南洛阳", "coord": [112.45, 34.62], "zoom": 2.5 },
    { "name": "汴京", "aliases": ["东京汴梁", "汴梁", "东京", "汴州", "东都开封府", "大梁"], "modern": "河南开封", "coord": [114.35, 34.79], "zoom": 2.5 },
    { "name": "幽州", "aliases": ["辽南京", "析津府", "燕京", "蓟城", "幽燕"], "modern": "北京", "coord": [116.40, 39.90], "zoom": 2.5 },
    { "name": "蓝田关", "aliases": ["蓝关", "峣关", "蓝田", "蓝田县"], "modern": "陕西西安蓝田", "coord": [109.48, 34.03], "zoom": 2.6 },
    { "name": "马嵬坡", "aliases": ["马嵬驿", "马嵬", "兴平"], "modern": "陕西咸阳兴平", "coord": [108.35, 34.28], "zoom": 2.6 },
    { "name": "五丈原", "aliases": ["岐山", "眉县"], "modern": "陕西宝鸡岐山", "coord": [107.63, 34.23], "zoom": 2.6 },
    { "name": "陈仓", "aliases": ["宝鸡", "虢县"], "modern": "陕西宝鸡", "coord": [107.15, 34.36], "zoom": 2.5 },
    { "name": "街亭", "aliases": ["秦安", "陇城"], "modern": "甘肃天水秦安", "coord": [105.90, 35.02], "zoom": 2.6 },
    { "name": "定军山", "aliases": ["勉县", "沔阳"], "modern": "陕西汉中勉县", "coord": [106.67, 33.13], "zoom": 2.6 },
    { "name": "白帝城", "aliases": ["永安", "夔州", "奉节", "瞿塘峡", "夔门"], "modern": "重庆奉节", "coord": [109.57, 31.04], "zoom": 2.6 },
    { "name": "赤壁", "aliases": ["乌林", "赤壁市", "蒲圻"], "modern": "湖北咸宁赤壁", "coord": [113.90, 29.88], "zoom": 2.6 },
    { "name": "赤鼻矶", "aliases": ["东坡赤壁", "黄州赤壁", "黄冈"], "modern": "湖北黄冈", "coord": [114.88, 30.45], "zoom": 2.6 },
    { "name": "夷陵", "aliases": ["猇亭", "宜昌", "峡州"], "modern": "湖北宜昌", "coord": [111.29, 30.69], "zoom": 2.5 },
    { "name": "京口", "aliases": ["北固山", "北固亭", "金山寺", "南徐州", "润州", "镇江"], "modern": "江苏镇江", "coord": [119.45, 32.22], "zoom": 2.5 },
    { "name": "瓜洲", "aliases": ["瓜洲渡", "瓜洲古渡"], "modern": "江苏扬州邗江", "coord": [119.39, 32.26], "zoom": 2.6 },
    { "name": "采石矶", "aliases": ["采石", "牛渚", "马鞍山"], "modern": "安徽马鞍山", "coord": [118.46, 31.66], "zoom": 2.6 },
    { "name": "乌衣巷", "aliases": ["秦淮河", "石头城", "凤凰台", "夫子庙"], "modern": "江苏南京", "coord": [118.79, 32.02], "zoom": 2.6 },
    { "name": "寒山寺", "aliases": ["枫桥", "阊门"], "modern": "江苏苏州", "coord": [120.57, 31.31], "zoom": 2.6 },
    { "name": "兰亭", "aliases": ["沈园", "会稽山", "鉴湖", "剡溪"], "modern": "浙江绍兴", "coord": [120.50, 29.93], "zoom": 2.6 },
    { "name": "天姥山", "aliases": ["新昌", "剡中"], "modern": "浙江绍兴新昌", "coord": [120.98, 29.42], "zoom": 2.6 },
    { "name": "敬亭山", "aliases": ["宣州", "宣城"], "modern": "安徽宣城", "coord": [118.74, 30.99], "zoom": 2.5 },
    { "name": "桃花潭", "aliases": ["泾县"], "modern": "安徽宣城泾县", "coord": [118.18, 30.53], "zoom": 2.6 },
    { "name": "杏花村", "aliases": ["池州", "秋浦"], "modern": "安徽池州", "coord": [117.48, 30.66], "zoom": 2.6 },
    { "name": "醉翁亭", "aliases": ["琅琊山", "滁州"], "modern": "安徽滁州", "coord": [118.29, 32.28], "zoom": 2.6 },
    { "name": "滕王阁", "aliases": ["洪都", "豫章"], "modern": "江西南昌", "coord": [115.88, 28.68], "zoom": 2.6 },
    { "name": "琵琶亭", "aliases": ["浔阳楼", "浔阳江", "浔阳", "庐山", "江州", "九江"], "modern": "江西九江", "coord": [115.98, 29.71], "zoom": 2.5 },
    { "name": "黄鹤楼", "aliases": ["夏口", "鹦鹉洲"], "modern": "湖北武汉武昌", "coord": [114.30, 30.54], "zoom": 2.6 },
    { "name": "岳阳楼", "aliases": ["巴陵", "岳州", "岳阳", "君山"], "modern": "湖南岳阳", "coord": [113.09, 29.38], "zoom": 2.6 },
    { "name": "桃花源", "aliases": ["武陵", "朗州", "常德"], "modern": "湖南常德桃源", "coord": [111.48, 28.90], "zoom": 2.5 },
    { "name": "鹳雀楼", "aliases": ["蒲州", "蒲坂", "河中府", "永济"], "modern": "山西运城·永济", "coord": [110.28, 34.83], "zoom": 2.6 },
    { "name": "鸣条", "aliases": ["安邑", "河东", "解州", "运城"], "modern": "山西运城", "coord": [110.99, 35.03], "zoom": 2.5 },
    { "name": "牧野", "aliases": ["朝歌", "卫辉", "淇县", "新乡"], "modern": "河南新乡", "coord": [113.88, 35.30], "zoom": 2.5 },
    { "name": "长平", "aliases": ["高平", "丹水", "泽州", "晋城"], "modern": "山西晋城高平", "coord": [112.92, 35.80], "zoom": 2.6 },
    { "name": "巨鹿", "aliases": ["平乡", "广宗", "邢台"], "modern": "河北邢台巨鹿", "coord": [115.03, 37.22], "zoom": 2.6 },
    { "name": "大泽乡", "aliases": ["蕲县", "宿州"], "modern": "安徽宿州", "coord": [117.06, 33.53], "zoom": 2.6 },
    { "name": "垓下", "aliases": ["灵璧", "固镇", "阴陵", "乌江", "和县"], "modern": "安徽蚌埠固镇", "coord": [117.48, 33.32], "zoom": 2.6 },
    { "name": "白登", "aliases": ["白登山", "马邑", "朔州"], "modern": "山西大同", "coord": [113.38, 40.12], "zoom": 2.5 },
    { "name": "昆阳", "aliases": ["叶县", "平顶山"], "modern": "河南平顶山叶县", "coord": [113.35, 33.62], "zoom": 2.6 },
    { "name": "官渡", "aliases": ["中牟", "乌巢"], "modern": "河南郑州中牟", "coord": [114.02, 34.72], "zoom": 2.6 },
    { "name": "逍遥津", "aliases": ["合淝"], "modern": "安徽合肥", "coord": [117.29, 31.87], "zoom": 2.6 },
    { "name": "肥水", "aliases": ["淝水", "八公山", "寿春", "寿州", "寿县"], "modern": "安徽淮南寿县", "coord": [116.78, 32.57], "zoom": 2.6 },
    { "name": "陈桥驿", "aliases": ["陈桥", "封丘"], "modern": "河南新乡封丘", "coord": [114.43, 34.93], "zoom": 2.6 },
    { "name": "澶渊", "aliases": ["澶州", "开德府", "濮阳"], "modern": "河南濮阳", "coord": [115.03, 35.76], "zoom": 2.6 },
    { "name": "好水川", "aliases": ["隆德", "六盘山"], "modern": "宁夏固原隆德", "coord": [106.12, 35.62], "zoom": 2.6 },
    { "name": "朱仙镇", "aliases": ["郾城", "颍昌"], "modern": "河南开封祥符", "coord": [114.25, 34.62], "zoom": 2.6 },
    { "name": "钓鱼城", "aliases": ["合州", "合川"], "modern": "重庆合川", "coord": [106.28, 30.00], "zoom": 2.6 },
    { "name": "崖山", "aliases": ["厓山", "新会", "江门"], "modern": "广东江门新会", "coord": [113.06, 22.19], "zoom": 2.6 },
    { "name": "土木堡", "aliases": ["怀来", "宣府", "张家口"], "modern": "河北张家口怀来", "coord": [115.62, 40.38], "zoom": 2.6 },
    { "name": "宁远", "aliases": ["兴城", "觉华岛", "锦州", "松山"], "modern": "辽宁葫芦岛·兴城", "coord": [120.72, 40.62], "zoom": 2.5 },
    { "name": "萨尔浒", "aliases": ["赫图阿拉", "抚顺"], "modern": "辽宁抚顺", "coord": [124.28, 41.88], "zoom": 2.5 },
    { "name": "轮台", "aliases": ["北庭", "庭州", "吉木萨尔"], "modern": "新疆昌吉/乌鲁木齐", "coord": [87.62, 43.82], "zoom": 2.3 },
    { "name": "楼兰", "aliases": ["鄯善", "若羌"], "modern": "新疆巴音郭楞若羌", "coord": [89.92, 40.52], "zoom": 2.3 },
    { "name": "高昌", "aliases": ["高昌故城", "西州", "火州"], "modern": "新疆吐鲁番", "coord": [89.53, 42.85], "zoom": 2.3 },
    { "name": "交河故城", "aliases": ["交河", "车师前国", "吐鲁番"], "modern": "新疆吐鲁番", "coord": [89.07, 42.95], "zoom": 2.3 },
    { "name": "碎叶", "aliases": ["碎叶城", "托克马克"], "modern": "吉尔吉斯斯坦托克马克", "coord": [75.29, 42.83], "zoom": 2.3 },
    { "name": "燕然山", "aliases": ["燕然", "杭爱山"], "modern": "蒙古国杭爱山", "coord": [101.50, 47.50], "zoom": 2.0 },
    { "name": "狼居胥山", "aliases": ["狼居胥", "肯特山"], "modern": "蒙古国肯特山", "coord": [109.00, 48.00], "zoom": 2.0 },
    { "name": "威海卫", "aliases": ["刘公岛", "威海"], "modern": "山东威海", "coord": [122.12, 37.51], "zoom": 2.5 },
    { "name": "卢沟桥", "aliases": ["宛平", "宛平城"], "modern": "北京丰台", "coord": [116.21, 39.85], "zoom": 2.6 },
    { "name": "井冈山", "aliases": ["茨坪", "宁冈"], "modern": "江西吉安井冈山", "coord": [114.17, 26.57], "zoom": 2.5 },
    { "name": "遵义", "aliases": ["播州", "夜郎"], "modern": "贵州遵义", "coord": [106.93, 27.70], "zoom": 2.5 },
    { "name": "西柏坡", "aliases": ["平山"], "modern": "河北石家庄·平山", "coord": [113.95, 38.33], "zoom": 2.6 },
    { "name": "剑外", "aliases": ["梓州", "东川", "三台", "绵州", "绵阳"], "modern": "四川绵阳·三台", "coord": [105.09, 31.10], "zoom": 2.5 },
    { "name": "巴峡", "aliases": ["巴东", "云阳", "忠州", "万州"], "modern": "重庆奉节至忠县峡江", "coord": [109.10, 30.88], "zoom": 2.6 },
    { "name": "巫峡", "aliases": ["巫山", "神女峰", "大宁"], "modern": "重庆巫山至湖北巴东", "coord": [110.05, 31.05], "zoom": 2.6 },
    { "name": "西陵峡", "aliases": ["三峡", "秭归", "屈原故里"], "modern": "湖北宜昌秭归", "coord": [110.98, 30.83], "zoom": 2.6 },
    { "name": "江陵", "aliases": ["荆州", "郢都", "郢", "纪南城", "公安", "沙市"], "modern": "湖北荆州", "coord": [112.20, 30.35], "zoom": 2.5 },
    { "name": "襄阳", "aliases": ["襄州", "樊城", "襄樊", "鹿门山", "隆中", "古隆中"], "modern": "湖北襄阳", "coord": [112.14, 32.04], "zoom": 2.5 },
    { "name": "商州", "aliases": ["商洛", "商山", "上洛"], "modern": "陕西商洛", "coord": [109.94, 33.87], "zoom": 2.6 },
    { "name": "邓州", "aliases": ["穰县", "南阳", "宛城", "卧龙岗"], "modern": "河南南阳/邓州", "coord": [112.09, 32.69], "zoom": 2.5 },
    { "name": "潮州", "aliases": ["潮阳", "韩江", "潮汕", "汕头", "揭阳"], "modern": "广东潮州", "coord": [116.62, 23.66], "zoom": 2.5 },
    { "name": "黄州", "aliases": ["齐安", "黄冈"], "modern": "湖北黄冈", "coord": [114.88, 30.45], "zoom": 2.6 },
    { "name": "惠州", "aliases": ["祯州", "博罗", "罗浮山"], "modern": "广东惠州", "coord": [114.41, 23.09], "zoom": 2.5 },
    { "name": "儋州", "aliases": ["儋耳", "昌化军"], "modern": "海南儋州", "coord": [109.58, 19.52], "zoom": 2.5 },
    { "name": "永州", "aliases": ["零陵", "潇湘", "小石潭"], "modern": "湖南永州", "coord": [111.61, 26.42], "zoom": 2.5 },
    { "name": "柳州", "aliases": ["龙城", "马平", "柳江"], "modern": "广西柳州", "coord": [109.41, 24.33], "zoom": 2.5 },
    { "name": "零丁洋", "aliases": ["伶仃洋", "内伶仃", "深圳", "珠海"], "modern": "广东珠江口伶仃洋", "coord": [113.80, 22.42], "zoom": 2.6 },
    { "name": "惶恐滩", "aliases": ["万安", "吉州", "庐陵", "吉安"], "modern": "江西吉安万安", "coord": [114.78, 26.46], "zoom": 2.6 },
    { "name": "渭城", "aliases": ["咸阳", "咸阳古渡"], "modern": "陕西咸阳", "coord": [108.71, 34.33], "zoom": 2.6 },
    { "name": "灞桥", "aliases": ["灞水", "灞陵", "华清池", "骊山", "终南山"], "modern": "陕西西安", "coord": [109.06, 34.27], "zoom": 2.6 },
    { "name": "天门山", "aliases": ["博望山", "芜湖", "当涂"], "modern": "安徽芜湖/马鞍山", "coord": [118.35, 31.46], "zoom": 2.6 },
    { "name": "瓜步", "aliases": ["瓜步山", "六合"], "modern": "江苏南京六合", "coord": [118.88, 32.24], "zoom": 2.6 },
    { "name": "凉州", "aliases": ["武威", "姑臧"], "modern": "甘肃武威", "coord": [102.64, 37.93], "zoom": 2.4 },
    { "name": "甘州", "aliases": ["张掖", "删丹", "焉支山"], "modern": "甘肃张掖", "coord": [100.45, 38.93], "zoom": 2.4 },
    { "name": "肃州", "aliases": ["酒泉", "福禄"], "modern": "甘肃酒泉", "coord": [98.51, 39.74], "zoom": 2.4 },
    { "name": "沙州", "aliases": ["敦煌", "莫高窟", "鸣沙山", "月牙泉"], "modern": "甘肃酒泉敦煌", "coord": [94.66, 40.14], "zoom": 2.4 },
    { "name": "瓜州", "aliases": ["晋昌", "安西县"], "modern": "甘肃酒泉·瓜州", "coord": [95.78, 40.52], "zoom": 2.5 },
    { "name": "城濮", "aliases": ["鄄城", "临濮"], "modern": "山东菏泽鄄城", "coord": [115.51, 35.56], "zoom": 2.6 },
    { "name": "长勺", "aliases": ["莱芜", "钢城"], "modern": "山东济南莱芜", "coord": [117.68, 36.21], "zoom": 2.6 },
    { "name": "桂陵", "aliases": ["长垣"], "modern": "河南新乡长垣", "coord": [114.67, 35.20], "zoom": 2.6 },
    { "name": "马陵道", "aliases": ["马陵", "郯城"], "modern": "山东临沂郯城", "coord": [118.35, 34.61], "zoom": 2.6 },
    { "name": "崤山", "aliases": ["殽山", "崤函", "三门峡", "陕州"], "modern": "河南三门峡", "coord": [111.55, 34.58], "zoom": 2.6 },
    { "name": "柏举", "aliases": ["麻城", "举水"], "modern": "湖北黄冈麻城", "coord": [115.01, 31.17], "zoom": 2.6 },
    { "name": "井陉", "aliases": ["背水一战", "井陉口"], "modern": "河北石家庄井陉", "coord": [114.14, 38.03], "zoom": 2.6 },
    { "name": "濡须口", "aliases": ["濡须", "东关", "巢湖", "无为"], "modern": "安徽马鞍山含山", "coord": [117.88, 31.54], "zoom": 2.6 },
    { "name": "虎牢", "aliases": ["汜水", "成皋", "荥阳"], "modern": "河南郑州·荥阳", "coord": [113.24, 34.83], "zoom": 2.6 },
    { "name": "香积寺", "aliases": ["潏水", "神禾原"], "modern": "陕西西安长安区", "coord": [108.88, 34.10], "zoom": 2.6 },
    { "name": "睢阳", "aliases": ["宋州", "归德", "应天府", "商丘"], "modern": "河南商丘", "coord": [115.65, 34.44], "zoom": 2.5 },
    { "name": "蔡州", "aliases": ["汝南", "驻马店"], "modern": "河南驻马店汝南", "coord": [114.36, 33.00], "zoom": 2.6 },
    { "name": "野狐岭", "aliases": ["万全", "张北"], "modern": "河北张家口万全", "coord": [114.74, 40.98], "zoom": 2.6 },
    { "name": "三峰山", "aliases": ["禹州", "钧州", "阳翟"], "modern": "河南许昌禹州", "coord": [113.47, 34.15], "zoom": 2.6 },
    { "name": "鄱阳湖", "aliases": ["康山", "都昌", "九江口"], "modern": "江西九江鄱阳湖", "coord": [116.25, 29.22], "zoom": 2.5 },
    { "name": "台儿庄", "aliases": ["枣庄", "峄县"], "modern": "山东枣庄台儿庄", "coord": [117.73, 34.56], "zoom": 2.6 },
    { "name": "泰山", "aliases": ["岱宗", "岱岳", "奉高", "泰安"], "modern": "山东泰安", "coord": [117.10, 36.25], "zoom": 2.5 },
    { "name": "华山", "aliases": ["太华山", "华阴"], "modern": "陕西渭南华阴", "coord": [110.09, 34.48], "zoom": 2.6 },
    { "name": "嵩山", "aliases": ["中岳", "少林寺", "登封"], "modern": "河南郑州登封", "coord": [113.04, 34.48], "zoom": 2.6 },
    { "name": "衡山", "aliases": ["南岳", "回雁峰", "衡阳", "衡州"], "modern": "湖南衡阳", "coord": [112.69, 27.25], "zoom": 2.5 },
    { "name": "恒山", "aliases": ["北岳", "浑源", "悬空寺"], "modern": "山西大同浑源", "coord": [113.73, 39.67], "zoom": 2.5 },
    { "name": "湖州", "aliases": ["乌程", "吴兴", "苕溪"], "modern": "浙江湖州", "coord": [120.09, 30.89], "zoom": 2.6 },
    { "name": "新野", "aliases": ["博望坡", "博望"], "modern": "河南南阳新野", "coord": [112.36, 32.52], "zoom": 2.6 },
    { "name": "赣州", "aliases": ["虔州", "南康", "章贡", "郁孤台"], "modern": "江西赣州", "coord": [114.93, 25.85], "zoom": 2.5 },
    { "name": "梁山泊", "aliases": ["水泊梁山", "梁山", "蓼儿洼"], "modern": "山东济宁梁山", "coord": [116.09, 35.80], "zoom": 2.6 },
    { "name": "景阳冈", "aliases": ["阳谷", "阳谷县", "狮子楼"], "modern": "山东聊城阳谷", "coord": [115.92, 36.11], "zoom": 2.6 },
    { "name": "大名府", "aliases": ["北京大名府", "大名", "魏州", "天雄军"], "modern": "河北邯郸大名", "coord": [115.15, 36.28], "zoom": 2.5 },
    { "name": "风波亭", "aliases": ["岳王庙", "栖霞岭"], "modern": "浙江杭州西湖", "coord": [120.14, 30.25], "zoom": 2.6 },
    { "name": "罗布泊", "aliases": ["蒲昌海", "盐泽", "泑泽"], "modern": "新疆巴音郭楞若羌罗布泊", "coord": [90.45, 40.15], "zoom": 2.3 },
    { "name": "博斯腾湖", "aliases": ["敦薨之水", "鱼海", "巴格拉什湖"], "modern": "新疆巴音郭楞博湖", "coord": [87.05, 41.97], "zoom": 2.4 },
    { "name": "热海", "aliases": ["伊塞克湖", "大清池"], "modern": "吉尔吉斯斯坦伊塞克湖", "coord": [77.22, 42.39], "zoom": 2.3 },
    { "name": "巴尔喀什湖", "aliases": ["夷播海", "得嶷海"], "modern": "哈萨克斯坦巴尔喀什湖", "coord": [76.05, 45.85], "zoom": 2.1 },
    { "name": "居延海", "aliases": ["居延泽", "居延", "西海", "额济纳"], "modern": "内蒙古阿拉善额济纳", "coord": [101.25, 42.27], "zoom": 2.3 },
    { "name": "曲阜", "aliases": ["鲁城", "鲁都", "曲阜孔庙", "孔庙", "孔林", "杏坛", "阙里"], "modern": "山东济宁·曲阜", "coord": [116.99, 35.60], "zoom": 2.5 },
    { "name": "琅琊", "aliases": ["琅琊台", "琅邪", "琅邪台", "琅琊山", "诸城"], "modern": "山东青岛·黄岛", "coord": [119.98, 35.65], "zoom": 2.5 },
    { "name": "景德镇", "aliases": ["昌南镇", "昌南", "新平镇", "浮梁", "珠山御窑", "御器厂"], "modern": "江西景德镇", "coord": [117.18, 29.27], "zoom": 2.5 },
    { "name": "宁古塔", "aliases": ["宁古塔城", "宁古塔将军", "宁安", "旧街"], "modern": "黑龙江牡丹江·海林", "coord": [129.48, 44.58], "zoom": 2.3 },
    { "name": "青州", "aliases": ["潍坊", "广固", "益都", "青州府", "潍州", "北海郡"], "modern": "山东潍坊青州", "coord": [118.48, 36.68], "zoom": 2.5 },
    { "name": "密州", "aliases": ["诸城", "潍坊诸城", "高密", "东武", "超然台"], "modern": "山东潍坊诸城", "coord": [119.40, 35.99], "zoom": 2.5 },
    { "name": "利州", "aliases": ["广元", "葭萌", "葭萌关", "皇泽寺", "千佛崖", "绵谷"], "modern": "四川广元", "coord": [105.84, 32.44], "zoom": 2.5 },
    { "name": "代州", "aliases": ["忻州", "代县", "雁门郡", "秀容", "九原", "广武"], "modern": "山西忻州代县", "coord": [112.96, 39.07], "zoom": 2.5 },
    { "name": "灵州", "aliases": ["吴忠", "灵武", "西平府", "朔方节度使", "灵州卫"], "modern": "宁夏吴忠灵武", "coord": [106.28, 38.09], "zoom": 2.5 },
    { "name": "龟兹", "aliases": ["阿克苏", "库车", "屈支", "邱兹", "安西都护府", "姑墨", "温宿"], "modern": "新疆阿克苏库车", "coord": [82.96, 41.72], "zoom": 2.3 },
    { "name": "于阗", "aliases": ["和田", "和阗", "瞿萨旦那", "毗沙都督府", "于阗国"], "modern": "新疆和田", "coord": [79.92, 37.11], "zoom": 2.3 },
    { "name": "上京龙泉府", "aliases": ["牡丹江", "渤海上京", "龙泉府", "忽汗城", "渤海国", "东京城"], "modern": "黑龙江牡丹江宁安", "coord": [129.15, 44.05], "zoom": 2.3 },
    { "name": "国内城", "aliases": ["通化", "丸都城", "丸都", "集安", "高句丽王城", "好太王碑"], "modern": "吉林通化集安", "coord": [126.19, 41.12], "zoom": 2.4 },
    { "name": "太平府", "aliases": ["崇左", "左江", "丽江", "花山岩画"], "modern": "广西崇左", "coord": [107.36, 22.38], "zoom": 2.5 },
    { "name": "元上都", "aliases": ["锡林郭勒", "上都", "开平府", "开平", "多伦", "正蓝旗", "多伦诺尔"], "modern": "内蒙古锡林郭勒正蓝旗", "coord": [116.18, 42.36], "zoom": 2.3 },
    { "name": "黑水城", "aliases": ["阿拉善", "亦集乃路", "黑城", "定远营", "巴彦浩特"], "modern": "内蒙古阿拉善额济纳", "coord": [101.14, 41.76], "zoom": 2.3 },
    { "name": "眉州", "aliases": ["眉山", "通义郡", "三苏祠", "青神"], "modern": "四川眉山", "coord": [103.85, 30.08], "zoom": 2.5 },
    { "name": "信州", "aliases": ["上饶", "广信府", "广信", "鹅湖书院", "铅山", "带湖"], "modern": "江西上饶", "coord": [117.94, 28.45], "zoom": 2.5 },
    { "name": "武都", "aliases": ["陇南", "阶州", "武州", "祁山", "礼县", "阴平", "成州"], "modern": "甘肃陇南", "coord": [104.92, 33.40], "zoom": 2.5 },
    { "name": "淮安", "aliases": ["楚州", "淮阴", "山阳", "淮安府", "清江浦"], "modern": "江苏淮安", "coord": [119.14, 33.50], "zoom": 2.5 },
    { "name": "温州", "aliases": ["永嘉", "永嘉郡", "东瓯", "温州府", "江心屿", "瑞安"], "modern": "浙江温州", "coord": [120.66, 28.01], "zoom": 2.5 },
    { "name": "嘉兴", "aliases": ["秀州", "槜李", "由拳", "嘉兴府", "南湖"], "modern": "浙江嘉兴", "coord": [120.75, 30.75], "zoom": 2.5 },
    { "name": "婺州", "aliases": ["金华", "金华府", "东阳郡", "宁越府", "八咏楼"], "modern": "浙江金华", "coord": [119.65, 29.08], "zoom": 2.5 },
    { "name": "衢州", "aliases": ["三衢", "信安", "太末", "衢州府", "孔氏南宗"], "modern": "浙江衢州", "coord": [118.87, 28.97], "zoom": 2.5 },
    { "name": "处州", "aliases": ["丽水", "括州", "处州府", "青田", "龙泉"], "modern": "浙江丽水", "coord": [119.92, 28.45], "zoom": 2.5 },
    { "name": "亳州", "aliases": ["谯郡", "谯县", "谯城", "涡阳"], "modern": "安徽亳州", "coord": [115.78, 33.87], "zoom": 2.5 },
    { "name": "徽州", "aliases": ["黄山", "歙州", "新安郡", "徽州府", "歙县", "休宁", "婺源"], "modern": "安徽黄山歙县", "coord": [118.43, 29.87], "zoom": 2.5 },
    { "name": "颍州", "aliases": ["阜阳", "汝阴", "顺昌", "顺昌府", "颍州府", "颍州西湖"], "modern": "安徽阜阳", "coord": [115.81, 32.89], "zoom": 2.5 },
    { "name": "海州", "aliases": ["连云港", "朐山", "东海郡", "海州卫", "云台山"], "modern": "江苏连云港", "coord": [119.18, 34.59], "zoom": 2.5 },
    { "name": "南通", "aliases": ["通州", "静海", "崇川", "狼山", "通州直隶州"], "modern": "江苏南通", "coord": [120.89, 31.98], "zoom": 2.5 },
    { "name": "盐城", "aliases": ["盐渎", "瓢城", "西溪", "范公堤"], "modern": "江苏盐城", "coord": [120.16, 33.35], "zoom": 2.5 },
    { "name": "无锡", "aliases": ["梅里", "梁溪", "东林书院", "锡山", "惠山"], "modern": "江苏无锡", "coord": [120.30, 31.57], "zoom": 2.5 },
    { "name": "阆中", "aliases": ["南充", "保宁府", "果州", "顺庆府", "巴西郡", "阆州"], "modern": "四川南充阆中", "coord": [105.97, 31.56], "zoom": 2.5 },
    { "name": "叙州", "aliases": ["宜宾", "戎州", "僰道", "叙州府", "南溪", "李庄"], "modern": "四川宜宾", "coord": [104.64, 28.77], "zoom": 2.5 },
    { "name": "嘉州", "aliases": ["乐山", "嘉定府", "凌云寺", "乐山大佛"], "modern": "四川乐山", "coord": [103.77, 29.55], "zoom": 2.5 },
    { "name": "泸州", "aliases": ["江阳", "神臂城", "泸川", "泸州直隶州"], "modern": "四川泸州", "coord": [105.44, 28.89], "zoom": 2.5 },
    { "name": "达州", "aliases": ["宕渠", "绥定府", "通川", "巴渠"], "modern": "四川达州", "coord": [107.50, 31.21], "zoom": 2.5 },
    { "name": "建昌（西昌）", "aliases": ["凉山", "西昌", "越嶲", "越嶲郡", "嶲州", "邛都", "建昌卫", "宁远府"], "modern": "四川凉山西昌", "coord": [102.26, 27.89], "zoom": 2.4 },
    { "name": "抚州", "aliases": ["临川", "临汝", "抚州府", "玉茗堂", "拟岘台"], "modern": "江西抚州", "coord": [116.36, 27.98], "zoom": 2.5 },
    { "name": "袁州", "aliases": ["宜春", "袁州府", "分宜", "化成岩", "昌山"], "modern": "江西宜春", "coord": [114.39, 27.80], "zoom": 2.5 },
    { "name": "兴化（莆田）", "aliases": ["莆田", "兴化军", "兴化府", "莆阳", "木兰陂", "湄洲岛"], "modern": "福建莆田", "coord": [119.01, 25.43], "zoom": 2.5 },
    { "name": "当阳（荆门）", "aliases": ["荆门", "当阳", "长坂坡", "麦城", "荆门军", "荆门州", "玉泉寺"], "modern": "湖北荆门当阳", "coord": [111.79, 30.82], "zoom": 2.5 },
    { "name": "随州", "aliases": ["随国", "曾国", "随县", "汉东郡", "擂鼓墩"], "modern": "湖北随州", "coord": [113.38, 31.69], "zoom": 2.5 },
    { "name": "均州（武当）", "aliases": ["十堰", "均州", "武当山", "郧阳", "郧阳府", "太和山"], "modern": "湖北十堰丹江口", "coord": [111.08, 32.54], "zoom": 2.5 },
    { "name": "宝庆（邵阳）", "aliases": ["邵阳", "邵州", "宝庆府", "昭陵", "邵陵"], "modern": "湖南邵阳", "coord": [111.47, 27.24], "zoom": 2.5 },
    { "name": "郴州", "aliases": ["桂阳", "桂阳郡", "郴县", "苏仙岭", "义帝陵"], "modern": "湖南郴州", "coord": [113.01, 25.77], "zoom": 2.5 },
    { "name": "沅州（怀化）", "aliases": ["怀化", "沅州", "芷江", "龙标", "黔阳", "沅州府", "芙蓉楼"], "modern": "湖南怀化芷江", "coord": [109.68, 27.44], "zoom": 2.5 },
    { "name": "韶州", "aliases": ["韶关", "曲江", "始兴郡", "韶州府", "南华寺", "曹溪"], "modern": "广东韶关", "coord": [113.60, 24.81], "zoom": 2.5 },
    { "name": "肇庆（端州）", "aliases": ["肇庆", "端州", "高要", "肇庆府", "七星岩", "端溪"], "modern": "广东肇庆", "coord": [112.47, 23.05], "zoom": 2.5 },
    { "name": "雷州", "aliases": ["湛江", "海康", "徐闻", "雷州府", "广州湾"], "modern": "广东湛江雷州", "coord": [110.08, 20.91], "zoom": 2.4 },
    { "name": "高州", "aliases": ["茂名", "高凉", "高凉郡", "高州府", "潘州"], "modern": "广东茂名高州", "coord": [110.85, 21.92], "zoom": 2.4 },
    { "name": "梧州", "aliases": ["苍梧", "苍梧郡", "广信", "梧州府"], "modern": "广西梧州", "coord": [111.28, 23.48], "zoom": 2.5 },
    { "name": "合浦（廉州）", "aliases": ["北海", "合浦", "合浦郡", "廉州", "廉州府", "珠官"], "modern": "广西北海合浦", "coord": [109.20, 21.66], "zoom": 2.4 },
    { "name": "崖州", "aliases": ["三亚", "振州", "吉阳军", "崖州城", "天涯海角"], "modern": "海南三亚崖州", "coord": [109.18, 18.36], "zoom": 2.4 },
    { "name": "平凉（泾州）", "aliases": ["平凉", "泾州", "原州", "安定郡", "渭州", "平凉府", "崆峒山"], "modern": "甘肃平凉", "coord": [106.67, 35.54], "zoom": 2.5 },
    { "name": "庆州（庆阳）", "aliases": ["庆阳", "庆州", "环庆", "北地郡", "庆阳府", "义渠", "大顺城"], "modern": "甘肃庆阳", "coord": [107.64, 35.71], "zoom": 2.5 },
    { "name": "永昌（保山）", "aliases": ["保山", "永昌", "永昌郡", "永昌府", "哀牢", "不韦", "兰津渡"], "modern": "云南保山", "coord": [99.16, 25.11], "zoom": 2.4 },
    { "name": "临安府（建水）", "aliases": ["红河", "建水", "临安府", "临安路", "建水州", "步头"], "modern": "云南红河建水", "coord": [102.83, 23.62], "zoom": 2.4 },
    { "name": "山南（雅砻）", "aliases": ["山南", "雅砻", "泽当", "桑耶寺", "雍布拉康", "乃东", "帕竹"], "modern": "西藏山南乃东", "coord": [91.77, 29.24], "zoom": 2.3 },
    { "name": "古格（阿里）", "aliases": ["阿里", "古格", "象雄", "札达", "托林寺", "穹窿银城", "古格王朝"], "modern": "西藏阿里札达", "coord": [79.80, 31.48], "zoom": 2.3 },
    { "name": "烟台", "aliases": ["登州", "登州府", "芝罘", "之罘", "蓬莱", "蓬莱阁", "奇山所", "东莱"], "modern": "山东烟台", "coord": [121.20, 37.30], "zoom": 2.3 },
    { "name": "龙岩", "aliases": ["龙岩州", "新罗", "汀州", "汀州府", "长汀", "古田", "永定土楼"], "modern": "福建龙岩", "coord": [117.02, 25.08], "zoom": 2.3 },
    { "name": "三明", "aliases": ["宁化", "石壁", "宁化石壁", "尤溪", "沙县", "永安", "将乐", "南剑州"], "modern": "福建三明", "coord": [117.64, 26.26], "zoom": 2.3 },
    { "name": "武川镇", "aliases": ["武川", "北魏六镇", "六镇"], "modern": "内蒙古呼和浩特·武川", "coord": [111.65, 40.68], "zoom": 2.3 },
    { "name": "怀朔镇", "aliases": ["怀朔", "沃野镇"], "modern": "内蒙古包头·固阳", "coord": [109.84, 40.66], "zoom": 2.3 }
  ]
};
})();
