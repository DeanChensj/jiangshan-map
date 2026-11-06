# Bundled fonts

The app bundles static, content-subset Noto Sans SC, Noto Serif SC and Ma Shan Zheng fonts. Licenses are included beside the TTFs in `JiangshanAtlas/Resources/Fonts`. Fonts load offline and are registered with Core Text on launch.

Sources are the official Google Fonts repository:

- https://github.com/google/fonts/tree/main/ofl/notosanssc
- https://github.com/google/fonts/tree/main/ofl/notoserifsc
- https://github.com/google/fonts/tree/main/ofl/mashanzheng

The map's Latin/punctuation PBF glyphs are generated from the bundled Noto Serif SC Regular/Bold fonts with the official MapLibre Font Maker (`https://maplibre.org/font-maker/`). Chinese glyphs use the local CJK serif font. MapLibre and font licenses are bundled under `Resources/Glyphs`.

Optional regeneration requires an isolated Python environment with fontTools. Place the original variable/regular font and OFL files under `ios/.build/font-sources`, using the package-prefixed names expected by `scripts/prepare_ios_fonts.py`, then run that script. For PBF regeneration, place official Font Maker `sdfglyph.js` and `sdfglyph.wasm` under `ios/.build/font-maker`, and run `node scripts/prepare_ios_glyphs.cjs` from the repository root. Normal app preparation does not download or regenerate fonts.
