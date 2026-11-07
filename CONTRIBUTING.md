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
├── data/atlas/              # Editable source of the polygon bundles: one GeoJSON file per snapshot, grouped by dynasty, plus index.json
├── js/
│   ├── app.js               # Core controller: Mercator projection, collision-free label layout, timeline, Trace Place, Person Chronicle & window.atlasAPI
│   ├── atlas_quiz.js        # Ancient Place Pinpoint Quiz module (deck construction, clue sanitization, SVG scoring rings & action chip)
│   ├── map_data.js          # 18 historical periods metadata, phase rules, ancient settlements, milestones, rivers, passes & transport corridors
│   ├── lore_data.js         # Imperial eras (CHINESE_ERA_SPANS), reigning monarchs, biographical routes, city lore (CITY_LORE), landmark events & gazetteer
│   ├── atlas_boot.js        # Generated from data/atlas/: initial snapshots for instant first-paint rendering
│   ├── atlas_snapshots.js   # Generated from data/atlas/: topology-deduplicated & VLQ delta-encoded polity/prefecture polygons (lazy-loaded on demand)
│   ├── china_geo_data.js    # VLQ delta-encoded modern provincial boundaries for the X-Ray reference layer
│   └── i18n_dict.js         # Chinese-English dictionary for historical polities, prefectures, cities, and milestones
├── skills/
│   └── jiangshan-atlas/     # Agent Skill (SKILL.md) & zero-dependency CLI screenshot/inspection tool (scripts/jiangshan.py)
└── scripts/
    ├── audit_prefectures.js # Zero-dependency prefecture-layer overlap / outside-polity audit against data/atlas/prefecture_baseline.json (--check in CI)
    ├── audit_topology.js    # Zero-dependency polity border gap/overlap audit against data/atlas/topology_baseline.json (--check in CI)
    ├── build_atlas.js       # Zero-dependency builder: data/atlas/ → atlas_snapshots.js + atlas_boot.js (--check in CI)
    ├── repair_topology.js   # Zero-dependency border repair: snaps core polity borders together and rewrites data/atlas/
    ├── sync_version.js      # Zero-dependency per-asset SHA-256 cache-busting synchronizer for index.html
    └── validate_atlas.js    # Zero-dependency automated data integrity, topology & E2E validation suite (--fast / full)
```

---

## Local Development & Validation Workflow

1. **Clone and Serve Locally**:
   Built with vanilla ES6 and SVG with zero runtime dependencies—simply serve the repository root with any static HTTP server. No npm install is needed to serve the checked-in site:
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

### Rebuilding Event Pinyin Search Keys

After editing milestone titles/sites in `js/map_data.js` or landmark titles/sites in `js/lore_data.js`, regenerate the checked-in `js/event_pinyin.js`:

```bash
npm ci --prefix scripts/search-pinyin --ignore-scripts --no-audit --no-fund
npm run build --prefix scripts/search-pinyin
npm run check --prefix scripts/search-pinyin
npm test --prefix scripts/search-pinyin
```

The isolated build tool pins `pinyin-pro`; the browser only loads generated strings. Rows follow the source event order, and CI rejects stale output after edits or reordering. Historical pronunciation overrides live in `scripts/search-pinyin/build.cjs`. Full or spaced pinyin, tone marks and `ü`/`v` are normalized only for the added event fallback (minimum four letters); Chinese/English, curated aliases and reign matching retain priority. Initial abbreviations (e.g. `njty`, `nbcty`, `aszl`) are also generated for complete title/location phrases and existing curated names found inside headlines. Headline pinyin keys also span punctuation within titles. Exact pinyin keys rank ahead of partial pinyin matches, followed by exact initials of at least four letters. If a search has no results, prefixes of at least two letters can return up to four event suggestions. Curated names win ties between equally short completions. The normal atlas validation still runs without npm dependencies.

The build tool's `EVENT_NAMES` and `EVENT_NAME_SYNONYMS` cover the sixteen audited abbreviation gaps (`jybsb`, `wsyd`, `nmzz`, `krzz`, `xmzzygm`, `flqy`, `wcqy`, `jwzz`, `qsqy`, `dycypzz`, `xhgm`, `jtqy`, `ypzz`, `hcqy`, `hjqy`, `tmzb`). `EVENT_NAMES` supplies concise names embedded in longer prose; `EVENT_NAME_SYNONYMS` maps alternate names to the source phrase: 土木之变 generates `tmzb` for 土木堡之变, alongside `tmbzb`. Extend these Chinese name lists and add an independent search regression for each addition; the initial strings themselves are generated. Broad names such as 鸦片战争 can match multiple dated events.

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
3. **Historical Polities & Regional Boundaries (`data/atlas/`)**:
   - Edit the GeoJSON sources in `data/atlas/`, then rebuild. `js/atlas_snapshots.js` and `js/atlas_boot.js` are generated; do not edit them by hand.
     ```bash
     node scripts/build_atlas.js           # Normalize formatting, rebuild both bundles, refresh index.html hashes
     node scripts/build_atlas.js --check   # CI: sources formatted and bundles up to date
     ```
   - Each snapshot is `data/atlas/<dynasty>/<snapshotKey>.geojson` (e.g. `zhanguo/s_zhanguo_b.geojson`): a FeatureCollection whose `snapshot` member holds the caption, note and the `polities` / `prefectures` / `regions` feature lists, in display order. A bare id such as `"燕"` names a feature in the same file; `"s_zhanguo_a/齐"` names a feature defined in another snapshot (ids therefore never contain `/`). Each feature is stored once, in the earliest snapshot that uses it, so editing it changes every snapshot that references it; to change a border for one phase only, copy the feature into that snapshot's file under a new id and point the list at it.
   - Coordinates are `[longitude, latitude]` with at most two decimals; the build closes rings and drops repeated points. A new snapshot must also be added to `order` in `data/atlas/index.json` (`boot` lists the snapshots bundled for first paint).
   - Historical frontiers (especially across steppe confederations, *Jimi* protectorates, Tubo, and the Western Regions) were dynamic transition zones rather than modern surveyed borders. When proposing boundary adjustments, please cite the reference atlas sheet in your PR description (e.g., Tan Qixiang's *The Historical Atlas of China* / 《中国历史地图集》 volume and plate).
   - Shared borders between adjacent polities or circuits should share vertex chains so boundaries remain gap-free and overlap-free at high zoom. CI counts, per snapshot, the vertices and edge midpoints where core polities (`main` / `rival` / `protectorate`; `neighbor` is excluded) overlap or leave a gap of under ~4 km, and fails if any count rises above `data/atlas/topology_baseline.json`. The baseline only goes down:
     ```bash
     node scripts/audit_topology.js                       # Worst snapshots
     node scripts/audit_topology.js --details s_tang_d2   # Mismatched polity pairs in one snapshot
     node scripts/audit_topology.js --update              # After fixing borders: lower the baseline and commit it
     ```
   - Prefectures (郡 / 州 / 府) of one snapshot should not overlap each other and should stay inside the snapshot's core polities. The map clips prefecture and first-level region lines to those polities, so overreach never shows, but CI still counts it on a 0.05° grid (overlapping cells, cells outside every core polity) and fails if any count rises above `data/atlas/prefecture_baseline.json`:
     ```bash
     node scripts/audit_prefectures.js                      # Worst snapshots
     node scripts/audit_prefectures.js --details s_xihan_a  # Overlapping pairs and prefectures outside the polities
     node scripts/audit_prefectures.js --update             # After fixing prefectures: lower the baseline and commit it
     ```
   - `scripts/repair_topology.js` fixes sliver gaps and shallow overlaps (under ~3 km) automatically. Polities are ranked `main` > `rival` > `protectorate`, then by area; lower-ranked borders snap onto higher-ranked ones and both sides get the same vertex chain. A change that would make any other snapshot sharing the feature worse, add spikes or pinch points to a border, or move a piece of territory wider than ~6 km, is skipped and reported. Deeper mismatches are listed for manual fixing.
     ```bash
     node scripts/repair_topology.js wudai           # Dry run for a dynasty directory (or snapshot keys)
     node scripts/repair_topology.js wudai --write   # Rewrite sources, rebuild bundles, lower the baseline
     ```
