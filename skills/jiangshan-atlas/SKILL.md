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
- `year` (integer, `-403` to `2026`, negative for BCE, no year `0`):
  - If the event occurred before 403 BCE (e.g. 牧野之战 / 鸣条之战), clamp `year` to `-403` while explaining the actual historical date in prose.
- `place` (plain string):
  - Pass a single clean place name — either the famous ancient/poetic name (`蓝田关`, `长安`, `赤壁`, `京口`, `五丈原`, `马嵬坡`, `白帝城`, `采石矶`, `长平`, `巨鹿`, `垓下`, `官渡`, `肥水`, `牧野`, `鸣条`, `崖山`, `土木堡`, `滕王阁`, `黄鹤楼`, `岳阳楼`, `兰亭`, `瓜洲`, `轮台`, `寒山寺`, `卢沟桥`) OR a modern prefecture/county city name (`运城`, `镇江`, `黄冈`, `宝鸡`, `奉节`, `绍兴`, `九江`).
  - **Never** combine ancient and modern names with parentheses (write `place=蓝田关` or `place=运城`, never `place=鸣条(运城)`).

### Step 2: Construct the Deep-Link URL
Format the URL using `year` and `place`:

```text
https://deanchensj.github.io/jiangshan-map/?year=<YEAR>&place=<PLACE>
```

Examples:
- *"雪拥蓝关马不前 当时是什么时间地点？"* → `https://deanchensj.github.io/jiangshan-map/?year=819&place=蓝田关`
- *"辛弃疾写京口北固亭怀古时天下局势如何？"* → `https://deanchensj.github.io/jiangshan-map/?year=1205&place=京口`
- *"诸葛亮五丈原北伐在哪？"* → `https://deanchensj.github.io/jiangshan-map/?year=234&place=五丈原`
- *"苏轼赤壁怀古是在哪里写的？"* → `https://deanchensj.github.io/jiangshan-map/?year=1082&place=赤鼻矶`

### Step 3: Render a Map Screenshot (When Headless Browser is Available)
Run the bundled `scripts/jiangshan.py` helper to render a PNG screenshot of the exact historical year and place:

```bash
python3 skills/jiangshan-atlas/scripts/jiangshan.py \
  --year 819 \
  --place 蓝田关 \
  --out /tmp/jiangshan_819_languan.png
```

- If run inside a local checkout of `jiangshan-map`, the script renders offline against the local `index.html` in ~2 seconds.
- If run standalone outside the repository, the script automatically renders against `https://deanchensj.github.io/jiangshan-map/`.
- Embed the generated PNG screenshot in your response alongside the clickable deep-link URL.
