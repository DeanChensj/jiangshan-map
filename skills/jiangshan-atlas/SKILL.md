---
name: jiangshan-atlas
description: Locate historical Chinese events, classical poems, battles, and ancient places on the Jiangshan Historical Atlas (江山时序, 403 BCE – 2026 CE) by resolving a question into (year, place), generating an interactive deep-link URL, inspecting structured administrative context, and optionally rendering a high-resolution map screenshot. Use when the user asks about the time, location, territorial context, or administrative genealogy of a Chinese historical event, poem (e.g. "雪拥蓝关马不前"), person, or ancient place.
---

# Jiangshan Historical Atlas (`江山时序`) Skill

Use **江山时序 (Jiangshan Atlas)** to turn any question about Chinese history, classical literature, poetry, battles, or ancient geography into:
1. A clickable **interactive deep-link URL** (`?year=<YEAR>&place=<PLACE>`)
2. **Structured historical & administrative context (`--inspect`)** returning the exact reign era, regime (`polity`), macro-region (`道/路/行省`), prefecture (`郡/州/府`), modern province, nearest ancient city (with capital status and era-specific historical `remark`), and the 2,400-year city/pass overview (`lore` with bilingual `tag`/`desc` and `tagEn`/`descEn`)
3. An optional **high-resolution rendered map screenshot (`--out`)** showing dynastic territories, mountains/rivers, red pinpoint marker or multi-stop trajectory, and the 2,000-year administrative genealogy card (`点地溯源 · 古今政区沿革`).

## Workflow (Deduce Time & Place First → Inspect & Build URL → Optional Screenshot)

### Step 1: Deduce Historical `year` and Disambiguated `place` First (先考据年份与地点)
When a user asks about a historical event, classical novel scene, poem, battle, or idiom, the prompt often omits the exact year or uses a literary/event phrase (e.g., *"找到水浒传宋江江州劫法场的地方"*). **Before** building any URL or running the script, always deduce:

1. **Deduce the Historical Era & Representative Year (`先定年份`)**:
   - Identify the dynasty, reign period, and concrete integer year (`-403` to `2026`, negative for BCE, no year `0`) behind the event or literary setting.
   - *Literary / Novel scenes*: Map the story's setting to its historical reign era. For example,《水浒传》宋江刺配江州、浔阳楼题反诗、江州劫法场（白龙庙小聚义）is set in **Northern Song Emperor Huizong's Chongning era (北宋徽宗崇宁年间)** → `year=1102` (or `1110`).
   - *Classical poems / Battles*: Identify the year of composition or battle. For example, 韩愈《左迁至蓝关示侄孙湘》("雪拥蓝关马不前") was written during his exile in 唐宪宗元和十四年 → `year=819`.
   - *Pre-403 BCE events*: If an event occurred before 403 BCE (e.g., 牧野之战 1046 BCE / 鸣条之战 1600 BCE), clamp `year` to `-403` while explaining the actual date in prose.
   - *Multi-year trajectories*: When a route spans multiple years (e.g., Su Shi's lifetime exile stops or Wen Tianxiang's resistance campaign), deduce the chronological year for each stop (`year=1079,1080,1094,1097`).

2. **Deduce & Disambiguate the Canonical Place (`再定地点 · 古今消歧`)**:
   - Convert event phrases or literary scenes into the **canonical ancient settlement/landmark name** or **modern prefecture/county city name** (both **Chinese** and **English / Pinyin** are natively supported, with apostrophe/hyphen/space-insensitive matching):
     - **Strip event/action suffixes**: Never pass an event phrase like `place=江州劫法场` or `place=风雪山神庙`. Extract the actual geographic site (`浔阳` / `Xunyang` / `九江` / `Jiujiang`).
     - **Disambiguate cross-dynasty homonyms (同名异地)**: Check what a historical name referred to *in that specific era*. For example, `江州` in Qin/Han/Three Kingdoms (`巴郡江州`) was modern **重庆 (`Chongqing`)**, whereas `江州` in Eastern Jin, Tang, and Song (e.g., 白居易“江州司马”、宋江“刺配江州”) had its seat at **浔阳 (`Xunyang`)**, i.e., modern **江西九江 (`Jiujiang`)**.
     - **When in doubt, prefer unambiguous city/landmark names**: Pass a clean canonical ancient/poetic name (`浔阳`/`Xunyang`, `浔阳楼`, `梁山泊`/`Mount Liang`, `景阳冈`, `大名府`/`Daming`, `风波亭`, `蓝关`/`Lantian Pass`/`Languan`, `长安`/`Chang'an`/`Changan`, `赤壁`/`Red Cliffs`/`Chibi`, `京口`/`Jingkou`, `五丈原`/`Wuzhang Plains`, `马嵬坡`/`Mawei`, `白帝城`/`Baidicheng`, `采石矶`, `长平`/`Changping`, `巨鹿`/`Julu`, `垓下`/`Gaixia`, `官渡`/`Guandu`, `肥水`/`Fei River`, `牧野`/`Muye`, `鸣条`/`Mingtiao`, `崖山`/`Yamen`, `土木堡`/`Tumu`, `滕王阁`/`Tengwang Pavilion`, `黄鹤楼`, `岳阳楼`, `兰亭`, `瓜洲`, `轮台`, `寒山寺`, `卢沟桥`) OR its modern prefecture/county city name (`九江`/`Jiujiang`, `运城`/`Yuncheng`, `镇江`/`Zhenjiang`, `黄冈`/`Huanggang`, `宝鸡`/`Baoji`, `奉节`/`Fengjie`, `绍兴`/`Shaoxing`).
     - **Never** combine ancient and modern names with parentheses in a single token (write `place=浔阳`, `place=九江`, or `place=Xunyang`, never `place=浔阳(九江)`).

### Step 2: Construct the Deep-Link URL & Verify with `--inspect`
Once `(year, place)` are deduced, format the deep-link URL (do **NOT** guess longitude or latitude numbers):

```text
https://deanchen.me/jiangshan-map/?year=<YEAR>&place=<PLACE>
```

- **Single site (0D pinpoint)**: `year=<INT>&place=<SITE>` in Chinese or English/Pinyin (e.g., `?year=1102&place=浔阳`, `?year=819&place=蓝关`, or `?year=819&place=Lantian+Pass&lang=en`).
- **Multi-stop route (1D same-year / 4D multi-year trajectory)**: Pass comma-separated place names in chronological order (`place=剑外,巴峡,巫峡,襄阳,洛阳` with `year=763`, or `place=Huzhou,Huangzhou,Huizhou,Danzhou` with `year=1079,1080,1094,1097`). The atlas draws a curved crimson trajectory (`1` → `2` → `3`...), frames the camera bounding box, and lets the user click any numbered stop to jump to its year and open its 2,000-year administrative genealogy card.
- **Person Chronicle (`person=<FIGURE>&stop=<INDEX>`)**: Opens the curated multi-stop life & poetry trajectory (`点人溯事`) for any of the 113 curated historical figures (such as `sushi`, `zhugeliang`, `huoqubing`, `libai`, `caocao`, `xinqiji`, `xuanzang`, `wangyangming`, `zhangqian`, `dufu`, `baijuyi`, `hanyu`, `liuyuxi`, `yuefei`, `wentianxiang`, `zhenghe`, `banzhao`, `wangzhaojun`, `wenji`, `mulan`, `liqingzhao`, `qinshihuang`, `xiangyu`, `simamaqian`, `weiqing`, `banchao`, `zengguofan`, etc.) or any reigning monarch with ≥2 historical milestones in Chinese, English, or Pinyin (`?person=sushi` or `?person=sushi&stop=2`).
- **Optional `hover=<PREFECTURE>`**: Highlights one 州/府/郡 polygon of that year's snapshot and pops its tooltip (`江州 · 属 宋 · 今：江西省`). Supports both Chinese and English/Pinyin prefecture titles **in that era** (`hover=江州` or `hover=Jiangzhou` in 1102, `hover=黄州` or `hover=Huangzhou` in 1083, `hover=应天府` or `hover=Yingtian Fu` in 1415). Pair with `place` so the camera frames the prefecture (`?year=1102&place=浔阳&hover=江州`).
- **Optional `lang=zh-tw` / `lang=en`**: Renders the Traditional Chinese (`lang=zh-tw`) or English (`lang=en`) atlas UI when the user writes in Traditional Chinese or English, or asks for a Traditional Chinese / English map (`place`, `person`, and `hover` work in Simplified Chinese, Traditional Chinese, or English/Pinyin, e.g., `?year=741&place=長安&lang=zh-tw` or `?year=1082&place=Huangzhou&hover=Huangzhou&lang=en`).

Use `--inspect` to verify place or figure resolution and retrieve structured historical metadata (regime, circuit/province, prefecture, modern province, `nearestCity` with `isCapital` and era-specific `remark`, `lore` with 2,400-year city/pass overview `tag`/`desc`/`tagEn`/`descEn`, route distance, and `person` life events) as JSON without needing to read a screenshot:

```bash
python3 skills/jiangshan-atlas/scripts/jiangshan.py --year 1102 --place 浔阳 --hover 江州 --inspect
python3 skills/jiangshan-atlas/scripts/jiangshan.py --person sushi --stop 2 --inspect
```

| User Prompt | Step 1: Historical & Geographic Deduction (先考据) | Step 2: Deep-Link URL (后构建 URL) |
| :--- | :--- | :--- |
| *"找到水浒传宋江江州劫法场的地方"* | 《水浒传》宋江刺配江州、浔阳楼题反诗、劫法场背景为**北宋徽宗崇宁年间**（约 `1102` 年）；宋代江南西路**江州**治所为**浔阳**（今**江西九江**，非巴郡重庆） | `https://deanchen.me/jiangshan-map/?year=1102&place=浔阳&hover=江州` |
| *"雪拥蓝关马不前 当时是什么时间地点？"* | 韩愈于**唐宪宗元和十四年**（`819` 年）贬潮州途中经秦岭**蓝田关（蓝关）**（今陕西西安蓝田） | `https://deanchen.me/jiangshan-map/?year=819&place=蓝关` |
| *"杜甫《闻官军收河南河北》即从巴峡穿巫峡，便下襄阳向洛阳路线？"* | **唐代宗广德元年**（`763` 年）杜甫在剑外（四川梓州）闻叛乱平定，规划同年水陆返洛阳路线 | `https://deanchen.me/jiangshan-map/?year=763&place=剑外,巴峡,巫峡,襄阳,洛阳` |
| *"苏轼问汝平生功业，黄州惠州儋州贬谪路线？"* | 苏轼自乌台诗案（`1079` 湖州）起，历贬**黄州**（`1080`）、**惠州**（`1094`）、**儋州**（`1097`） | `https://deanchen.me/jiangshan-map/?year=1079,1080,1094,1097&place=湖州,黄州,惠州,儋州` |
| *"文天祥《过零丁洋》惶恐滩头说惶恐，零丁洋里叹零丁抗元路线？"* | 南宋末文天祥自**赣州**起兵（`1275`），撤退经江西万安**惶恐滩**（`1277`），于珠江口**零丁洋**被俘（`1278`），至**崖山**海战（`1279`） | `https://deanchen.me/jiangshan-map/?year=1275,1277,1278,1279&place=赣州,惶恐滩,零丁洋,崖山` |
| *"辛弃疾写京口北固亭怀古时天下局势如何？"* | **南宋宁宗开禧元年**（`1205` 年）辛弃疾任镇江知府，登**京口**（今江苏镇江）北固亭北望金朝 | `https://deanchen.me/jiangshan-map/?year=1205&place=京口` |
| *"苏轼写《记承天寺夜游》时黄州归哪里管？"* | **北宋神宗元丰六年**（`1083` 年）苏轼贬居淮南西路**黄州**（今湖北黄冈），高亮黄州州界 | `https://deanchen.me/jiangshan-map/?year=1083&place=黄州&hover=黄州` |
| *"Where was Su Shi exiled when he wrote the Red Cliff odes?"* | **Northern Song Yuanfeng 5** (`1082` CE), exiled at **Huangzhou** (`黄州`, modern Huanggang, Hubei), English UI | `https://deanchen.me/jiangshan-map/?year=1082&place=Huangzhou&lang=en` |

### Step 3 (Optional): Render a Map Screenshot On-Demand (`--out`)

Follow these three execution rules to keep responses fast and avoid wasted turns:
1. **Link & `--inspect` first, screenshot on-demand**: The deep-link URL and `--inspect` JSON are instantaneous and sufficient for most answers. Only pass `--out <PATH>` to render a PNG screenshot when the user asks for an image/map or when visual territorial/route comparison clearly adds value.
2. **Request network access upfront for remote renders**: When running inside a local checkout of `jiangshan-map` (or with `JIANGSHAN_REPO_ROOT` set), `--inspect` (~0.2s via Node) and `--out` (~3–5s) work completely offline. When running standalone without a local checkout, headless Chrome must fetch ~3 MB of map/terrain assets from `deanchen.me` (typically 6–12s): run with network access enabled from the start (do not try in an offline sandbox first) and set a synchronous wait/timeout of at least 10–15 seconds.
3. **Skip re-reading the generated PNG**: `jiangshan.py` automatically verifies the PNG header, dimensions (`>=800x500`), and pixel variance (exiting with code `1` on blank renders). Once it exits `0`, embed the PNG path directly in your response without calling an image-viewing tool unless you specifically need to inspect visual details on the canvas.

```bash
# 1. Inspect + single-site pinpoint screenshot (0D)
python3 skills/jiangshan-atlas/scripts/jiangshan.py \
  --year 1102 \
  --place 浔阳 \
  --hover 江州 \
  --inspect \
  --out /tmp/jiangshan_1102_xunyang.png

# 2. Same-year poetic trajectory (1D)
python3 skills/jiangshan-atlas/scripts/jiangshan.py \
  --year 763 \
  --place 剑外,巴峡,巫峡,襄阳,洛阳 \
  --inspect \
  --out /tmp/jiangshan_763_dufu_route.png

# 3. Multi-year historical trajectory (4D spacetime)
python3 skills/jiangshan-atlas/scripts/jiangshan.py \
  --year 1079,1080,1094,1097 \
  --place 湖州,黄州,惠州,儋州 \
  --inspect \
  --out /tmp/jiangshan_sushi_exile_route.png
```
