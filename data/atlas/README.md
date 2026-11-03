# data/atlas · Historical polygon sources

This directory is the editable source of `js/atlas_snapshots.js` and `js/atlas_boot.js`. Each `<dynasty>/<snapshot>.geojson` file is one map snapshot. `scripts/build_atlas.js` turns them into the bundles; see [CONTRIBUTING.md](../../CONTRIBUTING.md) for the editing workflow.

本目录是 `js/atlas_snapshots.js` 与 `js/atlas_boot.js` 的可编辑源数据，每个 `<朝代>/<快照>.geojson` 对应一个地图快照。编辑流程见 [CONTRIBUTING_ZH.md](../../CONTRIBUTING_ZH.md)。

## Provenance · 数据来源

- **Polity outlines** (`polities`) are derived from [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps) (GPL-3.0).
- **Prefecture-level boundaries** (`prefectures`, `regions`) and **Warring States territories** are derived from **CHGIS V6** (Fairbank Center for Chinese Studies, Harvard University & Center for Historical Geographical Studies, Fudan University) and the **Robert M. Hartwell China Historical GIS** datasets.
- All geometry has since been simplified (0.01° precision) and hand-adjusted, with Tan Qixiang's *The Historical Atlas of China* (谭其骧主编《中国历史地图集》) as the main reference. Boundaries are schematic approximations, not surveyed borders.
- The source of each individual feature is not yet recorded.

## License · 许可

- Boundaries derived from **CHGIS V6** and the **Hartwell China Historical GIS** remain under their original terms: **academic, non-commercial use only; no redistribution of the original datasets**. They are **not** licensed under GPL-3.0. If you need the original data, obtain it from the official CHGIS / Harvard Dataverse distribution rather than from this repository.
- Cite CHGIS as: *CHGIS, Version: 6. © Fairbank Center for Chinese Studies of Harvard University and the Center for Historical Geographical Studies at Fudan University, 2016.*
- Everything else in this directory follows the repository license (GPL-3.0).

源自 CHGIS V6 与 Hartwell China Historical GIS 的边界数据仍受其原始条款约束（仅限学术、非商业用途，不得再分发原始数据集），不适用 GPL-3.0；如需原始数据，请从 CHGIS / Harvard Dataverse 官方渠道获取。其余内容遵循仓库的 GPL-3.0 许可。
