# Native close-up detail

The Tang Chang’an–Luoyang regional pack contains 12 approximate site markers. Chang’an has Taiji Palace, Daming Palace, Xingqing Palace, Huaqing Palace, the Giant and Small Wild Goose Pagodas, Qinglong Temple and Xingjiao Temple. Luoyang has Yingtian Gate, Dingding Gate, White Horse Temple and Longmen Grottoes. These are site locations, not reconstructed building footprints or ancient street geometry. Intervals describe the layer's coverage, not each site's complete lifetime. Later historical periods still use the original web atlas data.

Search groups the sites by city and searches current names, historical aliases and city names in simplified/traditional Chinese and English. Selecting a site outside its available periods moves to an available year. The two city Explore actions frame the full regional pack at 750. Markers distinguish palaces (vermilion), gates (blue) and temples/grottoes (ochre), with a map legend.

Huaqing uses Tangquan Palace in 644–670, Wenquan Palace in 671–746 and Huaqing Palace in 747–755. Its palace-period marker ends before destruction in 756. Qinglong uses Linggan Temple in 618–620, Guanyin Temple in 662–710, Qinglong Temple in 711–844, Huguo Temple in 846–854 and Qinglong Temple in 855–907. The closure intervals 621–661 and 845 have no marker. Yingtian Gate uses the site's familiar name across the covered Tang years; its description explains historical renamings. Daming Palace's marker ends in 896.

The editable source is `assets/tang_focus.json`. The native exporter includes it in the data-version hash and produces `focus-sites.json` and GeoJSON. Add future regional packs through this source pipeline, with dates and an individual historical source for every site. Do not infer ancient streets from today's roads.

Coordinates are rounded Wikidata P625 facts (CC0), retrieved November 2, 2026. Each row includes its Wikidata identifier. Dates/context use original summaries of the following primary sources; the Big Wild Goose Pagoda's temple inception in Wikidata is not used as the pagoda's construction date.

- [Taiji Palace structured record](https://www.wikidata.org/wiki/Q10038732)
- [Daming Palace, China Culture](https://en.chinaculture.org/library/2008-02/15/content_36814.htm)
- [Giant Wild Goose Pagoda, India–China Encyclopedia, Ministry of External Affairs](https://www.mea.gov.in/images/pdf/India-ChinaEncyclopedia_Vol-1.pdf)
- [Small Wild Goose Pagoda, China Culture](https://en.chinaculture.org/library/2008-02/15/content_34684.htm)
- [White Horse Temple, China Culture](https://en.chinaculture.org/library/2008-02/15/content_34384.htm)
- [Longmen Grottoes, UNESCO](https://whc.unesco.org/en/list/1003/)
- [Xingqing Palace, National Museum of China](https://www.chnmuseum.cn/zp/zpml/gjwxbt/202008/t20200824_247155.shtml). Its coordinate uses the Wikidata point for today's park on the palace site, not an inferred ancient footprint.
- [Huaqing Palace, Shaanxi provincial gazetteer, Construction volume](https://dfz.shaanxi.gov.cn/zslm/fzzlk/xbsxsz/szdylpdf/201404/P020240923623109161543.pdf)
- [Qinglong Temple, Xi’an Cultural Heritage Administration](https://wwj.xa.gov.cn/xwzx/tzgg/1902288108237918209.html)
- Xingjiao Temple uses the Ministry of External Affairs encyclopedia linked above.
- [Yingtian Gate, Henan government cultural site](https://ytsc.rootinhenan.gov.cn/sitesources/ytsc/page_pc/hnly/fjms/article37896e9dc2fb4df6a6df0ff306b79ff2.html)
- [Dingding Gate, China National Silk Museum](https://iidos.cn/en/SilkRoadHeritage/info.aspx?itemid=10158&lcid=212)

Focused expansion checks: resource generation, 12 unique site IDs, 18 dated marker records, non-overlapping name intervals, Qinglong closure/name boundaries, glyph coverage and a native build/UI check. No new test suite or performance profile was added for this content expansion.

Prefecture labels use anchors already present in the web snapshots. Their display follows historical stage, layer settings, zoom and quiz visibility. Existing source restrictions in the root README remain applicable. No additional CHGIS county dataset is bundled in this iteration.

## Today reference

OpenFreeMap's public [TileJSON](https://tiles.openfreemap.org/planet) supplies vector tiles using the OpenMapTiles schema. The source is installed only on first enable; hidden layers do not replace the historical base. Roads begin at zoom 8, locality names at 9 and building footprints at 12. Coverage and accuracy depend on current OpenStreetMap data. Existing offline terrain remains the original relief image and becomes soft at city zoom.

The map visibly distinguishes and labels this layer as present-day reference. Links credit OpenFreeMap, © OpenMapTiles, and data from OpenStreetMap, including the copyright link. See the provider's [mobile integration guide](https://openfreemap.org/quick_start/) and [attribution requirements](https://openfreemap.org/). No bulk offline download is implemented.
