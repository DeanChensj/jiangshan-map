# 贡献指南 · Contributing to Chronicles of the Realm (江山时序)

<p align="left">
  <a href="CONTRIBUTING.md">English</a> · <strong>简体中文</strong>
</p>

感谢你对 **江山时序 (`jiangshan-map`)** 的关注！本项目致力于构建一个零运行时依赖、兼具东方宣纸设色美学与历史地理严谨性的中国历代疆域与政区交互舆图。

欢迎任何形式的贡献，包括但不限于：
- **史料校勘与地名订正**：修正古地名经纬度偏差、补充州郡治所沿革说明（`remark`）或调整政权阶段起止年份；
- **重大历史事件与定点掌故补充**：增补各朝代编年节点、都城迁徙或城池定点历史大事（`PLACE_LANDMARK_EVENTS`）；
- **名城题记与多语言翻译优化**：扩充 [`js/lore_data.js`](js/lore_data.js) 中的名城风华判词（`CITY_LORE`），或完善 [`js/i18n_dict.js`](js/i18n_dict.js) 中的历史专有名词英文译名；
- **界面交互与性能改进**：优化移动端手势体验、键盘无障碍访问（ARIA）与 SVG 渲染性能。

---

## 目录结构说明

```text
├── index.html               # 应用主页面与语义化布局结构
├── llms.txt                 # 面向 LLM 与 AI Agent 的机器可读接入协议说明
├── css/style.css            # 宣纸水墨设色主题样式与响应式布局
├── data/atlas/              # 多边形产物的可编辑源数据：每个快照一个 GeoJSON 文件，按朝代分目录，另含 index.json
├── js/
│   ├── app.js               # 核心控制器：墨卡托投影、碰撞避让排布、时间轴、点地溯源、点人溯事与 window.atlasAPI
│   ├── atlas_quiz.js        # 古地名寻址挑战子模块（题库分层、线索脱敏、评分环与悬浮确认签）
│   ├── map_data.js          # 18 个历史时期元数据、阶段划分、古地名点位、重大历史事件、水系古泽、雄关与交通走廊
│   ├── lore_data.js         # 历代帝王年号（CHINESE_ERA_SPANS）、在位君主、人物生平行迹、名城风华题记（CITY_LORE）、定点大事与诗词名胜辞典
│   ├── atlas_boot.js        # 由 data/atlas/ 生成：首屏启动快照，保障首屏零等待渲染
│   ├── atlas_snapshots.js   # 由 data/atlas/ 生成：拓扑去重与 VLQ 无损增量编码的历史疆域/州道多边形数据（按需惰性加载与解码）
│   ├── china_geo_data.js    # VLQ 增量编码的现代省级行政区划轮廓参照层（古今透视镜）
│   └── i18n_dict.js         # 中英双语词典与历史专有名词对照表
├── skills/
│   └── jiangshan-atlas/     # Agent Skill 技能定义（SKILL.md）与零依赖 CLI 截图/查询脚本（scripts/jiangshan.py）
└── scripts/
    ├── audit_topology.js    # 零依赖政权边界缝隙/重叠审计，与 data/atlas/topology_baseline.json 比对（CI 中运行 --check）
    ├── repair_topology.js   # 零依赖边界修复：把核心政权边界吸附对齐并改写 data/atlas/
    ├── build_atlas.js       # 零依赖构建脚本：data/atlas/ → atlas_snapshots.js + atlas_boot.js（CI 中运行 --check）
    ├── sync_version.js      # 零依赖按文件 SHA-256 内容指纹同步脚本（自动更新 index.html 缓存参数）
    └── validate_atlas.js    # 零依赖自动化数据完整性、多边形拓扑与端到端 CUJ 校验脚本（支持 --fast）
```

---

## 本地开发与验证流程

1. **克隆仓库并启动本地预览**：
   本项目采用纯原生 ES6 + SVG 构建，无需安装任何 npm 依赖即可直接运行：
   ```bash
   git clone https://github.com/DeanChensj/jiangshan-map.git
   cd jiangshan-map
   python3 -m http.server 8000
   ```
   随后在浏览器访问 `http://localhost:8000`（英文界面可访问 `http://localhost:8000/?lang=en`）。

2. **同步静态与懒加载资源指纹（修改 `css/` 或 `js/` 后）**：
   `index.html` 按每个资源文件内容的 8 位 SHA-256 短哈希标记 `?v=` 与 `#atlas-app-script` 上的 `data-v-*` 属性，修改样式或脚本后运行：
   ```bash
   node scripts/sync_version.js
   ```

3. **运行自动化数据与拓扑校验**：
   日常迭代界面、检索或史料词条时可使用 `--fast` 进行秒级校验；提交 Pull Request 前请运行完整校验，覆盖全部多边形拓扑、疆域互斥采样与 CLI/MCP 冒烟测试：
   ```bash
   node scripts/validate_atlas.js --fast   # 秒级校验：语法、资源哈希、数据结构、双语与交互状态机
   node scripts/validate_atlas.js          # 完整校验：额外覆盖全量历史多边形拓扑与子进程冒烟测试
   ```

---

## 史料与数据校勘规范

1. **古地名点位（`js/map_data.js` 中的 `settlements`）**：
   - 坐标统一采用 `[经度, 纬度]`（`WGS-84` / `CGCS2000` 近似坐标）；
   - 层级定义：`isCapital: true` = 王朝/割据政权都城，无 `tier`（默认一级）= 核心州郡治所 / 雄关重镇，`tier: 2` = 次级州郡 / 边塞据点（随地图放大渐进显隐）；
   - 若某城池在朝代中后期始建、迁都或废弃，请设置 `appear` / `vanish` 年份字段；
   - 古代城池点位均需提供简明的 `remark` 治所沿革掌故，并在 `js/i18n_dict.js` 中补充对应英文翻译。
2. **帝王年号与在位君主（`js/lore_data.js`）**：
   - 年号表（`CHINESE_ERA_SPANS`）与在位君主世系表（`REIGNING_MONARCHS`）统一维护在 `js/lore_data.js` 中，新增或校订时请参考《中国历史纪年表》。
   - `CHINESE_ERA_SPANS` 是时间轴使用的唯一参考纪年，按《资治通鉴》惯例：三国用曹魏，东晋十六国用东晋，南北朝用南朝，五代用中原五代，宋辽金夏用宋。同时存在、自行纪年的政权（蜀汉、孙吴、北朝诸政权、西梁、581 年后的陈、辽、金、西夏、忽必烈的元）的年号表放在 `REGIONAL_ERA_TRACKS`；事件按事发地所属政权取年号。
   - 若某条大事的主角并非其定位点所属政权（例如宋金和议定位在金一侧边境），请在 `js/map_data.js` 中给这条大事加上 `"eraRegime": "reference"`，或填写 `REGIONAL_ERA_TRACKS` 中的政权名。
3. **历史疆域与政区多边形（`data/atlas/`）**：
   - 修改 `data/atlas/` 下的 GeoJSON 源文件后重新构建。`js/atlas_snapshots.js` 与 `js/atlas_boot.js` 是生成文件，请勿手工编辑。
     ```bash
     node scripts/build_atlas.js           # 规范化格式、重建两个产物并刷新 index.html 哈希
     node scripts/build_atlas.js --check   # CI：源文件格式规范且产物为最新
     ```
   - 每个快照对应 `data/atlas/<朝代>/<快照键>.geojson`（如 `zhanguo/s_zhanguo_b.geojson`）：这是一个 FeatureCollection，其 `snapshot` 字段保存标题、说明以及 `polities` / `prefectures` / `regions` 要素列表（按显示顺序）。裸 id（如 `"燕"`）指同一文件中的要素；`"s_zhanguo_a/齐"` 指定义在其他快照中的要素（因此 id 中不能含 `/`）。每个要素只存一份，放在最早使用它的快照里，修改它会同时影响所有引用它的快照；若只想改某一阶段的边界，请把该要素复制到对应快照文件中、换一个新 id，再让列表指向它。
   - 坐标为 `[经度, 纬度]`，最多两位小数；构建时会自动闭合 ring、去掉相邻重复点。新增快照时还需把它加入 `data/atlas/index.json` 的 `order`（`boot` 列出首屏内置的快照）。
   - 古代政权边界（尤其是草原游牧政权、羁縻都护府、吐蕃与西域等）在历史上多为依山川走势延伸的动态过渡带，提交边界调整时建议在 PR 中注明参考图集（如谭其骧主编《中国历史地图集》对应分册与图幅）。
   - 相邻政权与外围道/州级政区交界处应共用同一组自然曲线顶点链，确保放大检视时零缝隙、零重叠咬合。CI 会按快照统计核心政权（`main` / `rival` / `protectorate`，不含 `neighbor`）之间互相重叠或留有约 4 公里以内缝隙的顶点与边中点数，任一快照超过 `data/atlas/topology_baseline.json` 即失败。基线只降不升：
     ```bash
     node scripts/audit_topology.js                       # 列出问题最多的快照
     node scripts/audit_topology.js --details s_tang_d2   # 查看某个快照中有问题的政权对
     node scripts/audit_topology.js --update              # 修完边界后下调基线并一起提交
     ```
   - `scripts/repair_topology.js` 可自动修复约 3 公里以内的细缝与浅重叠：政权按 `main` > `rival` > `protectorate`、再按面积排序，低优先级边界吸附到高优先级边界上，双方共用同一组顶点。若某处改动会让共用该要素的其他快照变差，给边界新增尖刺、自相接触的点，或挪动宽于约 6 公里的一块领土，则跳过并报告；更深的错位会列出来留待人工修正。
     ```bash
     node scripts/repair_topology.js wudai           # 对某个朝代目录（或快照键）试运行，只输出报告
     node scripts/repair_topology.js wudai --write   # 改写源文件、重建产物并下调基线
     ```
