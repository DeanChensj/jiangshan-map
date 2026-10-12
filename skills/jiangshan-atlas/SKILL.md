---
name: jiangshan-atlas
description: Locate historical Chinese events, classical poems, battles, and ancient places on the Jiangshan Historical Atlas (江山时序, 403 BCE – 2026 CE) by resolving a question into (year, place), generating an interactive deep-link URL, and optionally rendering a high-resolution map screenshot. Use when the user asks about the time, location, territorial context, or administrative genealogy of a Chinese historical event, poem (e.g. "雪拥蓝关马不前"), person, or ancient place.
---

# Jiangshan Historical Atlas (`江山时序`) Skill

Use **江山时序 (Jiangshan Atlas)** to turn any question about Chinese history, classical poetry, battles, or ancient geography into:
1. A clickable **interactive deep-link URL** (`?year=<YEAR>&place=<PLACE>`)
2. A **high-resolution rendered map screenshot** showing the dynastic territories, mountains/rivers, red pinpoint marker, 2,000-year administrative genealogy card (`点地溯源 · 古今政区沿革`), and timeline scrubber.

## Workflow (2-Parameter CUJ — Never Guess Coordinates!)

### Step 1: Resolve `year` and `place` from historical context
Do **NOT** guess longitude or latitude numbers. Only extract two values:
- `year` (single integer OR comma-separated integers, `-403` to `2026`, negative for BCE, no year `0`):
  - **Single year (`year=819` or `year=763`)**: Use a single integer for a single event or a multi-stop journey within the same year (scalar `year` automatically broadcasts to all stops in `place`).
  - **Multi-year trajectory (`year=1079,1080,1094,1097`)**: When a route spans multiple years (e.g. Su Shi's lifetime exile stops or Wen Tianxiang's resistance campaign), pass comma-separated years matching each stop in `place`. Each stop badge on the map is labeled with its year (`湖州 (1079)` → `黄州 (1080)` → `惠州 (1094)` → `儋州 (1097)`), and clicking any stop jumps the timeline to that stop's year.
  - If an event occurred before 403 BCE (e.g. 牧野之战 / 鸣条之战), clamp `year` to `-403` while explaining the actual historical date in prose.
- `place` (plain string — single site OR comma-separated multi-stop route):
  - **Single site (0D pinpoint)**: Pass a single clean place name — either the famous ancient/poetic name (`蓝关`, `长安`, `赤壁`, `京口`, `五丈原`, `马嵬坡`, `白帝城`, `采石矶`, `长平`, `巨鹿`, `垓下`, `官渡`, `肥水`, `牧野`, `鸣条`, `崖山`, `土木堡`, `滕王阁`, `黄鹤楼`, `岳阳楼`, `兰亭`, `瓜洲`, `轮台`, `寒山寺`, `卢沟桥`) OR a modern prefecture/county city name (`运城`, `镇江`, `黄冈`, `宝鸡`, `奉节`, `绍兴`, `九江`).
  - **Multi-stop route / poetic trajectory (1D / 4D path)**: Pass comma-separated place names in chronological order (`place=剑外,巴峡,巫峡,襄阳,洛阳` or `place=湖州,黄州,惠州,儋州`). The atlas automatically draws a curved crimson trajectory connecting all stops (`1` → `2` → `3`...), frames the camera bounding box, and lets the user click any numbered stop to jump to its year and open its 2,000-year administrative genealogy card.
  - **Never** combine ancient and modern names with parentheses in a single token (write `place=蓝关` or `place=运城`, never `place=鸣条(运城)`).

### Step 2: Construct the Deep-Link URL
Format the URL using `year` and `place`:

```text
https://deanchensj.github.io/jiangshan-map/?year=<YEAR>&place=<PLACE>
```

Examples:
- *"雪拥蓝关马不前 当时是什么时间地点？"* → `https://deanchensj.github.io/jiangshan-map/?year=819&place=蓝关`
- *"杜甫《闻官军收河南河北》即从巴峡穿巫峡，便下襄阳向洛阳路线？"* → `https://deanchensj.github.io/jiangshan-map/?year=763&place=剑外,巴峡,巫峡,襄阳,洛阳`
- *"苏轼问汝平生功业，黄州惠州儋州贬谪路线？"* → `https://deanchensj.github.io/jiangshan-map/?year=1079,1080,1094,1097&place=湖州,黄州,惠州,儋州`
- *"文天祥《过零丁洋》惶恐滩头说惶恐，零丁洋里叹零丁抗元路线？"* → `https://deanchensj.github.io/jiangshan-map/?year=1275,1277,1278,1279&place=赣州,惶恐滩,零丁洋,崖山`
- *"辛弃疾写京口北固亭怀古时天下局势如何？"* → `https://deanchensj.github.io/jiangshan-map/?year=1205&place=京口`

### Step 3: Render a Map Screenshot (When Headless Browser is Available)
Run the bundled `scripts/jiangshan.py` helper to render a PNG screenshot of the exact historical year and place (or single-year / multi-year route):

```bash
# 1. Single-site pinpoint (0D)
python3 skills/jiangshan-atlas/scripts/jiangshan.py \
  --year 819 \
  --place 蓝关 \
  --out /tmp/jiangshan_819_languan.png

# 2. Same-year poetic trajectory (1D)
python3 skills/jiangshan-atlas/scripts/jiangshan.py \
  --year 763 \
  --place 剑外,巴峡,巫峡,襄阳,洛阳 \
  --out /tmp/jiangshan_763_dufu_route.png

# 3. Multi-year historical trajectory (4D spacetime)
python3 skills/jiangshan-atlas/scripts/jiangshan.py \
  --year 1079,1080,1094,1097 \
  --place 湖州,黄州,惠州,儋州 \
  --out /tmp/jiangshan_sushi_exile_route.png
```

- If run inside a local checkout of `jiangshan-map`, the script renders offline against the local `index.html` in ~2 seconds.
- If run standalone outside the repository, the script automatically renders against `https://deanchensj.github.io/jiangshan-map/`.
- Embed the generated PNG screenshot in your response alongside the clickable deep-link URL.
