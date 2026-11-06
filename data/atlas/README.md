# data/atlas · Historical polygon sources

> **Approximate boundaries, not surveyed borders.** These polygons are schematic reconstructions for illustrating broad historical jurisdictions. They are not the product of scientific surveying and should not be cited as precise or authoritative borders.
>
> **近似边界，非测绘成果。** 本目录中的多边形为示意性复原，用于直观呈现历史上大致的管辖范围，并非科学测绘成果，请勿作为精确或权威的边界依据引用。

This directory is the editable source of `js/atlas_snapshots.js` and `js/atlas_boot.js`. Each `<dynasty>/<snapshot>.geojson` file is one map snapshot. `scripts/build_atlas.js` turns them into the bundles; see [CONTRIBUTING.md](../../CONTRIBUTING.md) for the editing workflow.

本目录是 `js/atlas_snapshots.js` 与 `js/atlas_boot.js` 的可编辑源数据，每个 `<朝代>/<快照>.geojson` 对应一个地图快照。编辑流程见 [CONTRIBUTING_ZH.md](../../CONTRIBUTING_ZH.md)。

## Provenance · 数据来源

The original import scripts are not in this repository, so provenance is reconstructed from the project's early documentation:

- **Prefecture-level boundaries** (`prefectures`: commanderies, prefectures and superior prefectures, i.e. 郡 / 州 / 府) are derived from **CHGIS V6** (Fairbank Center for Chinese Studies, Harvard University & Center for Historical Geographical Studies, Fudan University) and the **Robert M. Hartwell China Historical GIS** datasets.
- **Polity outlines** (`polities`) are derived from [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps) (GPL-3.0).
- **First-level divisions** (`regions`: 刺史部 / 道 / 路 / 省, etc.) are drawn by hand from historical texts; the source of their early versions was not recorded. Most do not share boundaries with the prefecture layer.
- All geometry has since been simplified (0.01° precision) and hand-adjusted against historical texts, with Tan Qixiang's *The Historical Atlas of China* (谭其骧主编《中国历史地图集》) as the main reference for checking; no map images or data from that atlas are included in this repository. Boundaries are schematic approximations, not surveyed borders. The source of each individual feature is not recorded.

原始导入脚本不在仓库中，以上来源依据项目早期文档整理：郡 / 州 / 府级边界（`prefectures`）源自 CHGIS V6 与 Hartwell 数据；政权轮廓（`polities`）源自 historical-basemaps（GPL-3.0）；一级政区（`regions`）依据史籍手工绘制，早期版本来源未记录。所有几何此后均经过简化，并依据史籍、参照谭图核对后手工调整；本仓库不包含谭图的任何图像或数据。

## License · 许可

- Boundaries derived from **CHGIS V6** and the **Hartwell China Historical GIS** remain under their original terms: **academic, non-commercial use only; do not redistribute**. They are **not** licensed under GPL-3.0. Do not republish them from this repository; if you need prefecture boundaries, obtain them from the official CHGIS / Harvard Dataverse distribution. `scripts/export_geojson.js` leaves this layer out unless run with `--with-prefectures`.
- Cite CHGIS as: *CHGIS, Version: 6. © Fairbank Center for Chinese Studies of Harvard University and the Center for Historical Geographical Studies at Fudan University, 2016.*
- Everything else in this directory follows the repository license (GPL-3.0).
- **Attribution**: when reusing these boundaries, maps or screenshots, credit **江山时序 Jiangshan Atlas** (https://github.com/DeanChensj/jiangshan-map) and the upstream sources above.

源自 CHGIS V6 与 Hartwell China Historical GIS 的边界数据仍受其原始条款约束（仅限学术、非商业用途，不得再分发），不适用 GPL-3.0；请勿从本仓库转载，如需郡州府边界，请从 CHGIS / Harvard Dataverse 官方渠道获取。`scripts/export_geojson.js` 默认不导出该图层，加 `--with-prefectures` 参数才会导出。其余内容遵循仓库的 GPL-3.0 许可。转载或引用这些边界、地图或截图时，请注明「江山时序 Jiangshan Atlas」（https://github.com/DeanChensj/jiangshan-map）及上述原始数据来源。
