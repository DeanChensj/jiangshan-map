# Contributing to Chronicles of the Realm (江山时序)

<p align="left">
  <strong>English</strong> · <a href="CONTRIBUTING_ZH.md">简体中文 (Chinese)</a>
</p>

Thank you for your interest in **Chronicles of the Realm (`jiangshan-map`)**! This project aims to build a zero-dependency, historically rigorous interactive atlas of Chinese dynastic territories, administrative divisions, ancient cities, and historical journeys crafted in the aesthetic of traditional Chinese parchment cartography.

We welcome contributions of all kinds, including:
- **Historical & Geographic Corrections**: Fixing ancient place coordinates, refining prefecture/circuit evolution notes (`remark`), or adjusting dynastic phase transition years;
- **Historical Milestones & Site-Specific Events**: Adding chronological milestones, capital relocations, or site-specific landmark events (`PLACE_LANDMARK_EVENTS`);
- **Bilingual Translations & City Lore**: Improving English translations of historical proper nouns in [`js/i18n_dict.js`](js/i18n_dict.js) or expanding bilingual city epigraphs (`CITY_LORE`) in [`js/lore_data.js`](js/lore_data.js);
- **UI/UX, Accessibility & Performance**: Enhancing mobile touch gestures, keyboard accessibility (ARIA), and SVG rendering performance.

---

## Repository Structure

```text
├── index.html               # Main application page & semantic layout
├── llms.txt                 # Machine-readable protocol specification for LLMs & AI Agents
├── css/style.css            # Traditional parchment theme & responsive styles
├── js/
│   ├── app.js               # Core controller: Mercator projection, collision-free label layout, timeline, Trace Place, Person Chronicle & window.atlasAPI
│   ├── atlas_quiz.js        # Ancient Place Pinpoint Quiz module (deck construction, clue sanitization, SVG scoring rings & action chip)
│   ├── map_data.js          # 18 historical periods metadata, phase rules, ancient settlements, milestones, rivers, passes & transport corridors
│   ├── lore_data.js         # Imperial eras (CHINESE_ERA_SPANS), reigning monarchs, biographical routes, city lore (CITY_LORE), landmark events & gazetteer
│   ├── atlas_boot.js        # Pre-bundled initial snapshot (s_zhanguo) for instant first-paint rendering
│   ├── atlas_snapshots.js   # Topology-deduplicated & VLQ delta-encoded historical polity/prefecture polygons (lazy-loaded on demand)
│   ├── china_geo_data.js    # VLQ delta-encoded modern provincial boundaries for the X-Ray reference layer
│   └── i18n_dict.js         # Chinese-English dictionary for historical polities, prefectures, cities, and milestones
├── skills/
│   └── jiangshan-atlas/     # Agent Skill (SKILL.md) & zero-dependency CLI screenshot/inspection tool (scripts/jiangshan.py)
└── scripts/
    ├── sync_version.js      # Zero-dependency per-asset SHA-256 cache-busting synchronizer for index.html
    └── validate_atlas.js    # Zero-dependency automated data integrity, topology & E2E validation suite (--fast / full)
```

---

## Local Development & Validation Workflow

1. **Clone and Serve Locally**:
   Built with vanilla ES6 and SVG with zero runtime or npm dependencies—simply serve the repository root with any static HTTP server:
   ```bash
   git clone https://github.com/DeanChensj/jiangshan-map.git
   cd jiangshan-map
   python3 -m http.server 8000
   ```
   Then open `http://localhost:8000` in your browser (or `http://localhost:8000/?lang=en` for English UI).

2. **Sync Per-Asset Cache-Busting Hashes (After Editing `css/` or `js/`)**:
   `index.html` stamps each CSS/JS bundle (and lazy-loaded bundle attributes on `#atlas-app-script`) with an 8-character SHA-256 content hash:
   ```bash
   node scripts/sync_version.js
   ```

3. **Run the Automated Validation Suite**:
   During local iteration on UI, search, or data entries, use `--fast` for ~6-second feedback; before opening a Pull Request, run the full suite to also verify polygon topology, territorial exclusivity, and CLI/MCP smoke tests:
   ```bash
   node scripts/validate_atlas.js --fast   # Fast check: syntax, hashes, schemas, i18n & UI CUJs
   node scripts/validate_atlas.js          # Full suite: includes all polygon topology & subprocess checks
   ```

---

## Historical & Cartographic Conventions

1. **Ancient Settlements (`settlements` in `js/map_data.js`)**:
   - Coordinates follow `[longitude, latitude]` order (`WGS-84` / `CGCS2000`);
   - Hierarchy tiers: `isCapital: true` = imperial or regional regime capital; default (`tier` omitted) = major prefecture/circuit seat or strategic garrison; `tier: 2` = secondary prefecture or frontier outpost (progressively revealed on zoom);
   - If a settlement was founded, renamed, or abandoned mid-dynasty, specify `appear` and/or `vanish` years;
   - Every pre-modern settlement must include a concise historical `remark` (and its English translation in `js/i18n_dict.js`).
2. **Imperial Eras & Reigning Monarchs (`js/lore_data.js`)**:
   - Imperial era spans (`CHINESE_ERA_SPANS`) and reigning monarchs (`REIGNING_MONARCHS`) reside in `js/lore_data.js`. When adding or correcting reign dates, cross-check against standard chronological tables (*Zhongguo Lishi Jinian Biao*).
   - `CHINESE_ERA_SPANS` is the single reference chronology shown on the timeline and follows the *Zizhi Tongjian* convention (Cao Wei for the Three Kingdoms, Eastern Jin for the Sixteen Kingdoms, the Southern Dynasties for the Northern & Southern Dynasties, the Central Plains Five Dynasties, and Song alongside Liao/Jin/Xia). Co-existing regimes that kept their own eras (Shu Han, Sun Wu, the Northern Dynasties, Western Liang, Chen after 581, Liao, Jin, Western Xia, and Kublai's Yuan) live in `REGIONAL_ERA_TRACKS`; events are labeled with the era of the regime ruling their location.
   - If a milestone's subject is not the regime holding its pinned location (e.g. a Song–Jin treaty pinned on the Jin side of the border), set `"eraRegime": "reference"` or a `REGIONAL_ERA_TRACKS` regime name on that milestone in `js/map_data.js`.
3. **Historical Polities & Regional Boundaries (`js/atlas_snapshots.js`)**:
   - Historical frontiers (especially across steppe confederations, *Jimi* protectorates, Tubo, and the Western Regions) were dynamic transition zones rather than modern surveyed borders. When proposing boundary adjustments, please cite the reference atlas sheet in your PR description (e.g., Tan Qixiang's *The Historical Atlas of China* / 《中国历史地图集》 volume and plate).
   - Shared borders between adjacent polities or circuits should share vertex chains so boundaries remain gap-free and overlap-free at high zoom.
