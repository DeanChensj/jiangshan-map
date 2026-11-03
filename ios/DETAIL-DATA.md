# Native close-up detail

The first regional expansion is Tang Chang’an–Luoyang: Taiji Palace, Daming Palace, Giant and Small Wild Goose Pagodas, White Horse Temple and Longmen Grottoes. These are approximate site markers, not reconstructed building footprints or ancient street geometry. Intervals describe the pilot layer's historical coverage, not each site's complete lifetime. Daming Palace's marker ends in 896; the remaining pilot coverage ends in 907. Later historical periods still use the original web atlas data.

The editable source is `assets/tang_focus.json`. The native exporter includes it in the data-version hash and produces `focus-sites.json` and GeoJSON. Add future regional packs through this source pipeline, with dates and an individual historical source for every site. Do not infer ancient streets from today's roads.

Coordinates are rounded Wikidata P625 facts (CC0), retrieved November 2, 2026. Each row includes its Wikidata identifier. Dates/context use original summaries of the following primary sources; the Big Wild Goose Pagoda's temple inception in Wikidata is not used as the pagoda's construction date.

- [Taiji Palace structured record](https://www.wikidata.org/wiki/Q10038732)
- [Daming Palace, China Culture](https://en.chinaculture.org/library/2008-02/15/content_36814.htm)
- [Giant Wild Goose Pagoda, India–China Encyclopedia, Ministry of External Affairs](https://www.mea.gov.in/images/pdf/India-ChinaEncyclopedia_Vol-1.pdf)
- [Small Wild Goose Pagoda, China Culture](https://en.chinaculture.org/library/2008-02/15/content_34684.htm)
- [White Horse Temple, China Culture](https://en.chinaculture.org/library/2008-02/15/content_34384.htm)
- [Longmen Grottoes, UNESCO](https://whc.unesco.org/en/list/1003/)

Prefecture labels use anchors already present in the web snapshots. Their display follows historical stage, layer settings, zoom and quiz visibility. Existing source restrictions in the root README remain applicable. No additional CHGIS county dataset is bundled in this iteration.

## Today reference

OpenFreeMap's public [TileJSON](https://tiles.openfreemap.org/planet) supplies vector tiles using the OpenMapTiles schema. The source is installed only on first enable; hidden layers do not replace the historical base. Roads begin at zoom 8, locality names at 9 and building footprints at 12. Coverage and accuracy depend on current OpenStreetMap data. Existing offline terrain remains the original relief image and becomes soft at city zoom.

The map visibly distinguishes and labels this layer as present-day reference. Links credit OpenFreeMap, © OpenMapTiles, and data from OpenStreetMap, including the copyright link. See the provider's [mobile integration guide](https://openfreemap.org/quick_start/) and [attribution requirements](https://openfreemap.org/). No bulk offline download is implemented.
