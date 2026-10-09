# 江山时序 · Chronicles of the Realm

**中国历史疆域与政区交互式时间轴舆图（公元前 221 年 — 今）**  
**An Interactive Historical Atlas of China from the Qin Unification (221 BCE) to the Present**

[**在线体验 / Live Demo → https://deanchensj.github.io/jiangshan-map/**](https://deanchensj.github.io/jiangshan-map/)

---

## 中文介绍

**「江山时序」** 是一套零外部运行时依赖的纯前端交互式中国历史地图集。项目以宣纸设色舆图为视觉基调，涵盖从秦并天下（前 221 年）至今两千余年的疆域消长、一级行政大区（州 / 道 / 路 / 行省 / 布政使司 / 省）、二级郡县州府边界、古今名城沿革、重大历史事件空间锚点以及长城、运河、丝绸之路等交通动脉。

### 核心功能

1. **105 个高精度多阶段历史疆域快照**
   - 覆盖 **16 个历史时期**：秦、西汉、东汉、三国、西晋、东晋十六国、南北朝、隋、唐、五代十国、北宋（辽 / 西夏）、南宋（金 / 西夏 / 大蒙古国）、元、明、清、民国及现代。
   - 同一朝代内部按关键历史节点细分为多个版图演变阶段（如汉武帝开疆、三国三家归晋、东晋淝水之战与刘裕北伐、唐代安史之乱与藩镇割据、南宋绍兴和议与端平入洛、明代永乐极盛与万历九边等）。
2. **双层历史政区体系（大区常驻 + 州府悬停）**
   - **第一级行政大区**：图面清晰展示汉十三刺史部、唐开元十五道与天宝节度使、宋代诸路（如荆湖北路、江南东路、川峡四路）、元代行中书省、明代两京十三布政使司、清代省及将军辖区。
   - **第二级州郡府军（300+ 政区）**：保留精细州郡边界，鼠标悬停（或移动端轻点）即可高亮该州府并显示所属政权与今日对应的现代省份，兼顾图面整洁与信息深度。
3. **分级古今名城与自动避让排版**
   - 默认视图聚焦历代都城、陪都与重镇；放大视图（`Zoom >= 1.75x`）自动浮现各道、路、行省治所及边塞名城，并标注古今地名对照与历史典故。
   - 内置政权国号、一级政区与城池节点的空间碰撞检测，自动偏移避让，杜绝文字重叠。
4. **点地溯源（古今政区沿革追踪）**
   - 开启 **「点地溯源」** 后点击地图任意坐标，即时生成该地点从秦郡、汉州郡、唐道州、宋路府、元行省到明清府省的完整政区沿革时间表，并计算历代最近古城距离，点击任一朝代即可跳转对应舆图。
5. **双模式古地名挑战（十题计分授衔）**
   - **地图寻址**：给定某朝代古地名（如「建康」「临安」「奉元路」「天临路」），在隐去地名的历史底图上点击定址，按大圆球面距离（km）计算得分并绘制误差圈。
   - **古今对号**：结合地图落点提示，从四个现代城市选项中选出古地名对应的今日城市。十题结束后根据总分授予「太史令 · 舆图大家」「職方郎中」等传统官制封号。
6. **历史工程与交通走廊**
   - 动态按年代渲染秦汉明三代**长城**、隋唐与元明清**大运河**、**陆上丝绸之路**、**唐蕃古道**、**西南丝路（茶马古道）**及**郑和下西洋航线**。
7. **传统古琴雅乐伴奏**
   - 顶部内置 **「雅乐」** 播放器，收录《流水》《平沙落雁》《阳关三叠》《醉渔唱晚》《酒狂》五首公有领域传统古琴名曲，支持曲目切换与 Web Audio 五声音阶离线泛音合成兜底。
8. **全端适配与中英双语**
   - 支持中英双语（`中文` / `EN`）全量切换，涵盖全部 16 个朝代、105 个快照图例、百余座古城及政区词典。
   - 深度适配桌面端（滚轮缩放、方向键微调年份、空格播放）与移动端（双指捏合缩放、单指拖拽、轻点查州府、单行滑动工具栏）。

### 朝代与政区覆盖概览

| 时期 | 年代范围 | 快照数 | 一级政区层级 | 代表性阶段示例 |
| :--- | :--- | :---: | :--- | :--- |
| **秦** | 前221 — 前202 | 3 | 关中与诸郡大区 | 秦并六国、北击匈奴南征百越、秦末楚汉之际 |
| **西汉** | 前202 — 公元25 | 8 | 十三刺史部（州） | 汉初郡国并行、汉武帝开疆、西域都护府设立、新莽时期 |
| **东汉** | 25 — 220 | 6 | 十三州刺史部 | 光武中兴、班超经营西域、黄巾起义与州牧割据 |
| **三国** | 220 — 280 | 6 | 魏蜀吴三方州域 | 魏蜀吴鼎立、诸葛亮北伐、邓艾灭蜀 |
| **西晋** | 280 — 317 | 4 | 十九州 | 太康之治天下一统、八王之乱、永嘉之乱 |
| **东晋十六国** | 317 — 420 | 9 | 侨州与南北州域 | 祖逖北伐、前秦统一北方、淝水之战、刘裕北伐 |
| **南北朝** | 420 — 589 | 9 | 南北诸州 | 元嘉北伐、北魏孝文帝汉化、东西魏与北齐北周对峙 |
| **隋** | 589 — 618 | 4 | 州 / 郡 | 开皇平陈一统、大运河开通与炀帝西巡、隋末群雄 |
| **唐** | 618 — 907 | 12 | 贞观十道 / 开元十五道 / 节度使 | 贞观平突厥、龙朔极盛、开元盛世、安史之乱、元和中兴、河西归义军 |
| **五代十国** | 907 — 960 | 6 | 中原与十国大区 | 后梁后唐争霸、契丹南下燕云、周世宗柴荣北伐 |
| **北宋** | 960 — 1127 | 7 | 十五路 / 二十三路 | 北宋平定江南、澶渊之盟、宋夏庆历和议、联金灭辽与靖康之变 |
| **南宋** | 1127 — 1279 | 8 | 两浙、江南、荆湖、川峡等路 | 岳飞北伐、绍兴和议、蒙古灭金、钓鱼城之战、崖山海战 |
| **元** | 1279 — 1368 | 5 | 中书省、十行省与宣政院辖地 | 元平江南一统、四大汗国格局、元末红巾军起义 |
| **明** | 1368 — 1644 | 7 | 两京十三布政使司与九边重镇 | 洪武开国、永乐迁都与奴儿干都司、土木堡之变、万历三大征 |
| **清** | 1644 — 1912 | 9 | 十八省、东三省与边疆将军辖区 | 康熙平三藩收台湾、乾隆平定准部回部极盛、晚清条约与建省 |
| **民国 / 现代** | 1912 — 今 | 2 | 省 / 自治区 / 直辖市 / 特别行政区 | 民国行政区划、现代省级行政区划对照 |

### URL 参数直达（Deep Linking）

支持通过 URL 参数直接分享或打开特定历史时刻与功能模式：

- 指定年份：`?year=741`（唐开元二十九年）或 `?year=-119`（汉武帝漠北之战）
- 指定年份并弹出事件卡片：`?year=383&event=383`（淝水之战）
- 直接开启某坐标「点地溯源」：`?trace=108.94,34.26`（长安/西安历代沿革）
- 直接开启挑战模式：`?quiz=locate`（地图寻址）或 `?quiz=match`（古今对号）
- 默认英文界面：`?lang=en`

---

## English Introduction

**Chronicles of the Realm (`jiangshan-map`)** is a zero-dependency, pure front-end interactive historical atlas of China. Styled after traditional Chinese parchment cartography, it visualizes over two millennia of territorial evolution from the Qin unification (221 BCE) to the present day, complete with two-tier administrative divisions, ancient-to-modern city mappings, spatial event markers, historical corridors, and classical Guqin music.

### Key Features

1. **105 Multi-Stage Territorial Snapshots**
   - Covers **16 major historical eras**: Qin, Western Han, Eastern Han, Three Kingdoms, Western Jin, Eastern Jin & Sixteen Kingdoms, Northern & Southern Dynasties, Sui, Tang, Five Dynasties & Ten Kingdoms, Northern Song (with Liao & Western Xia), Southern Song (with Jin, Western Xia & Mongol Empire), Yuan, Ming, Qing, Republic of China, and Present.
   - Captures fine-grained intra-dynastic shifts (e.g., Emperor Wu of Han's western expansion, the Battle of Feishui in 383 CE, the An Lushan Rebellion and Tang circuit commissioners, the Song–Jin Treaty of Shaoxing, and the high-Qing frontier consolidations).
2. **Two-Tier Historical Administrative Hierarchy**
   - **First-Level Macro Regions**: Displays Han's 13 Inspectoral Regions (*Zhou*), Tang's 15 Circuits (*Dao*) and Jiedushi defense commands, Song's Circuits (*Lu*), Yuan's Branch Secretariats (*Xingsheng*), and Ming/Qing Provinces (*Sheng*) directly on the map with automatic collision avoidance.
   - **Second-Level Prefectures & Commanderies (300+ polygons)**: Preserves detailed prefecture (*Zhou / Fu / Jun*) boundaries derived from CHGIS and Hartwell datasets; hovering (or tapping on mobile) highlights the prefecture and reveals its ruling polity and modern provincial equivalent without cluttering the map.
3. **Zoom-Adaptive Historical Cities**
   - Displays imperial capitals and primary metropolises at default zoom, and reveals regional circuit seats and frontier garrisons when zoomed in (`Zoom >= 1.75x`), with ancient-to-modern name pairs and historical notes.
4. **Trace Place (Administrative Genealogy)**
   - Click any point on the map in **Trace Place** mode to generate a complete chronological genealogy of that location from Qin commanderies to Ming/Qing provinces, along with the nearest historical city in each era.
5. **Dual-Mode Geography Challenge**
   - **Map Locate**: Pinpoint an ancient city on an unlabeled historical map and earn points based on great-circle distance accuracy (km).
   - **Name Match**: Match an ancient city highlighted on the map to its modern counterpart in a 4-way multiple-choice quiz, earning traditional imperial court ranks at the end of 10 rounds.
6. **Historical Engineering & Trade Corridors**
   - Time-filtered rendering of the Great Wall (Qin, Han, Ming), the Grand Canal (Sui–Tang & Yuan–Qing), the overland Silk Road, the Tang–Tibet Ancient Road, the Southwest Tea-Horse Road, and Zheng He's Maritime Voyages.
7. **Classical Guqin Soundtrack (`雅乐`)**
   - Built-in player featuring five public-domain classical Guqin pieces (*Flowing Water*, *Wild Geese on the Sandbank*, *Parting at Yangguan*, *Drunken Fisherman*, and *Wine Madness*), with an automatic Web Audio pentatonic synthesizer fallback.
8. **Full Bilingual (`中文` / `EN`) & Mobile Touch Support**
   - Instant switching between Chinese and English across all UI controls, 105 snapshot legends, macro regions, prefectures, and 300+ cities.
   - Full mobile support with two-finger pinch-to-zoom, single-finger panning, tap-to-inspect tooltips, and a swipeable toolbar ribbon.

---

## Local Development / 本地运行

无需安装任何构建工具或打包器，克隆仓库后使用任意静态文件服务器即可运行：  
No build step or bundler required. Clone the repository and serve the root directory with any static HTTP server:

```bash
git clone https://github.com/DeanChensj/jiangshan-map.git
cd jiangshan-map
python3 -m http.server 8000
```

随后在浏览器打开 `http://localhost:8000`。  
Then open `http://localhost:8000` in your browser.

---

## Data Sources & License / 数据来源与开源协议

- **历史政权疆域基图 / Historical Polity Basemaps**: Derived from [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps) (GPL-3.0) with custom multi-phase historical refinements.
- **历史州郡与一级政区多边形 / Administrative Polygons**: Derived from **CHGIS** (China Historical Geographic Information System, Harvard Yenching Institute & Fudan University) and **Robert M. Hartwell** historical GIS datasets.
- **现代省界底图 / Modern Provincial Boundaries**: Derived from DataV GeoAtlas / AutoNavi open boundary data for historical-to-modern spatial reference.
- **古琴音频 / Classical Guqin Audio**: Public-domain recordings from Wikimedia Commons (*Liu Shui*, *Pingsha Luoyan*, *Yangguan Sandie*, *Zuiyu Changwan*, *Jiu Kuang*).
- **免责声明 / Disclaimer**: 地图中的历史疆域轮廓与州郡政区边界为示意性历史近似，旨在直观呈现各时期大致统治与管辖范围，非精确现代测绘边界。 / Historical boundaries are schematic approximations intended for educational and comparative visualization.
- **开源协议 / License**: Released under **GPL-3.0**.
