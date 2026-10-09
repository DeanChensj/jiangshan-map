# 江山时序 · Chronicles of the Realm

Interactive historical atlas of China from the Qin unification (221 BCE) to the present, featuring prefecture-level administrative overlays, place-name genealogy, historical routes, and quiz challenges in Chinese and English.

## Features

- **Multi-stage Dynastic Territories**: 45 historical snapshots from 221 BCE to the present (Qin, Western Han, Eastern Han, Three Kingdoms, Western Jin, Eastern Jin & Sixteen Kingdoms, Northern & Southern Dynasties, Sui, Tang, Five Dynasties & Ten Kingdoms, Northern Song, Southern Song / Jin / Mongol, Yuan, Ming, Qing, Republic of China, and Present).
- **Administrative Prefectures**: Prefecture and commandery polygons (CHGIS / Hartwell) with modern province comparison on hover.
- **Trace Place (点地溯源)**: Click any point on the map to inspect its administrative genealogy from Qin commanderies through Ming/Qing prefectures.
- **Historical Routes**: Great Wall (Qin, Han, Ming), Grand Canal (Sui–Tang & Yuan–Qing), Silk Road, Tang–Tibet Ancient Road, and Zheng He’s Maritime Voyages.
- **Challenge Mode**: Locate ancient cities on the map by distance or match ancient and modern place names in 4-choice rounds.
- **Bilingual UI**: Switch between Chinese (`中文`) and English (`EN`) at any time.

## Run Locally

```bash
git clone https://github.com/DeanChensj/jiangshan-map.git
cd jiangshan-map
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Data Sources & License

- Historical polity outlines derived from [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps) (GPL-3.0).
- Historical prefecture polygons derived from CHGIS (Harvard Yenching Institute) & Robert M. Hartwell datasets.
- Borders are schematic approximations intended for educational and comparative visualization. Released under **GPL-3.0**.
