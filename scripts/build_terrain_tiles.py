#!/usr/bin/env python3
"""Build parchment-toned hillshade tiles for the terrain layer.

Reads Terrarium-encoded elevation PNG tiles (Web Mercator XYZ, 256 px) from
--dem/{z}/{x}_{y}.png and writes 512 px tiles to assets/terrain/{z}/{x}/{y}.webp
plus assets/terrain/index.json listing every tile that contains land. A 512 px
tile at level z is shaded from the four 256 px elevation tiles at level z + 1,
so a screen needs a quarter of the requests for the same detail.

Elevation sources: SRTM (public domain) / Copernicus GLO-90 or AWS Terrain
Tiles derived from them. Only the rendered hillshade is published, never the
raw elevation grid, and the finest level stays coarser than 100 m per pixel.

Usage: python3 scripts/build_terrain_tiles.py --dem DIR [--zooms 5,6]  (add a level later with --zooms 7)
Requires numpy and Pillow.
"""
import argparse
import glob
import json
import math
import multiprocessing
import os
import shutil

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'terrain')
TILE = 512
DEM_TILE = 256

# Same palette as assets/terrain_relief.webp so tiles blend into the base image.
LIGHT = np.array([244, 236, 220], dtype=np.float32)
SHADOW = np.array([146, 124, 96], dtype=np.float32)
EARTH_M = 40075016.686


def decode(path):
  a = np.asarray(Image.open(path).convert('RGB'), dtype=np.float32)
  return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768


def hillshade(elev, zdem, top_row):
  """Shade an elevation mosaic whose first row is global pixel row top_row at DEM level zdem."""
  rows = top_row + np.arange(elev.shape[0]) + 0.5
  lat = np.degrees(np.arctan(np.sinh(math.pi - 2 * math.pi * rows / (DEM_TILE * 2**zdem))))
  px_m = EARTH_M / (DEM_TILE * 2**zdem) * np.cos(np.radians(lat))
  # Smaller scales flatten gradients, so exaggerate more as we zoom out.
  zf = 2.4 * 1.45 ** (9 - zdem)
  dzdy, dzdx = np.gradient(elev * zf)
  dzdx /= px_m[:, None]
  dzdy /= px_m[:, None]
  slope = np.arctan(np.hypot(dzdx, dzdy))
  aspect = np.arctan2(-dzdx, dzdy)

  def shade(az_deg, alt_deg):
    az, alt = math.radians(az_deg), math.radians(alt_deg)
    return np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)

  hs = 0.6 * shade(315, 40) + 0.2 * shade(270, 40) + 0.2 * shade(0, 40)
  t = np.clip(hs / math.sin(math.radians(40)), 0, 1) ** 1.6
  # Steep ground darkens regardless of aspect so ranges read as barriers.
  mass = 1 - 0.32 * np.clip(slope / math.radians(40), 0, 1)
  # Mild hypsometric darkening so plateaus read differently from basins.
  hyp = 1 - 0.16 * np.clip((elev - 400) / 2600, 0, 1)
  rgb = (SHADOW + (LIGHT - SHADOW) * t[..., None]) * (mass * hyp)[..., None]
  alpha = np.where(elev > 0, 255, 0).astype(np.uint8)
  return np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), alpha])


def _build_row(job):
  dem_dir, z, y, xs, have = job
  zd = z + 1
  written = []
  for x in xs:
    # 4x4 DEM tiles around the 2x2 block: one-tile apron so gradients are seamless.
    mosaic = np.zeros((4 * DEM_TILE, 4 * DEM_TILE), dtype=np.float32)
    for j in range(4):
      for i in range(4):
        tx, ty = 2 * x - 1 + i, 2 * y - 1 + j
        if (tx, ty) in have:
          mosaic[j * DEM_TILE:(j + 1) * DEM_TILE, i * DEM_TILE:(i + 1) * DEM_TILE] = decode(
              os.path.join(dem_dir, str(zd), f'{tx}_{ty}.png'))
    core = mosaic[DEM_TILE:3 * DEM_TILE, DEM_TILE:3 * DEM_TILE]
    if core.max() <= 0:
      continue
    rgba = hillshade(mosaic, zd, (2 * y - 1) * DEM_TILE)[DEM_TILE:3 * DEM_TILE, DEM_TILE:3 * DEM_TILE]
    out_dir = os.path.join(OUT, str(z), str(x))
    os.makedirs(out_dir, exist_ok=True)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(out_dir, f'{y}.webp'), 'WEBP', quality=74, method=6)
    written.append(f'{x}_{y}')
  return written


def build_level(dem_dir, z):
  files = glob.glob(os.path.join(dem_dir, str(z + 1), '*.png'))
  have = frozenset(tuple(int(v) for v in os.path.basename(f)[:-4].split('_')) for f in files)
  parents = {}
  for tx, ty in have:
    parents.setdefault(ty // 2, set()).add(tx // 2)
  shutil.rmtree(os.path.join(OUT, str(z)), ignore_errors=True)
  jobs = [(dem_dir, z, y, sorted(xs), have) for y, xs in sorted(parents.items())]
  with multiprocessing.Pool() as pool:
    return [t for row in pool.map(_build_row, jobs) for t in row]


# Mirrors MercatorProjector(1000, 700, {west: 66, east: 142, south: 14, north: 55}) in js/app.js
# and the #terrain-relief-img rect in index.html.
PROJ_W, PROJ_H, WEST, EAST, SOUTH, NORTH = 1000, 700, 66, 142, 14, 55
BASE_RECT = (-80, -40, 1160, 780)
BASE_PATH = os.path.join(ROOT, 'assets', 'terrain_relief.webp')


def _merc(lat):
  return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def build_base(dem_dir, zdem=6):
  """Re-render assets/terrain_relief.webp with the tile hillshade so zooming in keeps one style.

  Land comes from the DEM; sea pixels keep the existing image so the ocean tint is unchanged.
  """
  scale = min(PROJ_W / (EAST - WEST), PROJ_H / math.degrees(_merc(NORTH) - _merc(SOUTH)))
  pad_x = (PROJ_W - (EAST - WEST) * scale) / 2
  pad_y = (PROJ_H - math.degrees(_merc(NORTH) - _merc(SOUTH)) * scale) / 2

  def svg_to_geo(x, y):
    lon = (x - pad_x) / scale + WEST
    m = _merc(NORTH) - (y - pad_y) / (scale * math.degrees(1))
    return lon, math.degrees(2 * math.atan(math.exp(m)) - math.pi / 2)

  world = DEM_TILE * 2**zdem

  def geo_to_px(lon, lat):
    return (lon + 180) / 360 * world, (1 - _merc(lat) / math.pi) / 2 * world

  bx, by, bw, bh = BASE_RECT
  gx0, gy0 = geo_to_px(*svg_to_geo(bx, by))
  gx1, gy1 = geo_to_px(*svg_to_geo(bx + bw, by + bh))
  tx0, ty0 = int(gx0 // DEM_TILE) - 1, int(gy0 // DEM_TILE) - 1
  tx1, ty1 = int(gx1 // DEM_TILE) + 1, int(gy1 // DEM_TILE) + 1
  mosaic = np.zeros(((ty1 - ty0 + 1) * DEM_TILE, (tx1 - tx0 + 1) * DEM_TILE), dtype=np.float32)
  for ty in range(ty0, ty1 + 1):
    for tx in range(tx0, tx1 + 1):
      path = os.path.join(dem_dir, str(zdem), f'{tx}_{ty}.png')
      if os.path.exists(path):
        r, c = (ty - ty0) * DEM_TILE, (tx - tx0) * DEM_TILE
        mosaic[r:r + DEM_TILE, c:c + DEM_TILE] = decode(path)
  shaded = Image.fromarray(hillshade(mosaic, zdem, ty0 * DEM_TILE), 'RGBA')
  old = Image.open(BASE_PATH).convert('RGB')
  box = (gx0 - tx0 * DEM_TILE, gy0 - ty0 * DEM_TILE, gx1 - tx0 * DEM_TILE, gy1 - ty0 * DEM_TILE)
  land = shaded.resize(old.size, Image.LANCZOS, box=box)
  out = Image.composite(land.convert('RGB'), old, land.getchannel('A'))
  out.save(BASE_PATH, 'WEBP', quality=82, method=6)
  print(f'base: {old.size[0]}x{old.size[1]} from z{zdem}, {os.path.getsize(BASE_PATH) / 1048576:.2f} MB')


def main():
  ap = argparse.ArgumentParser()
  ap.add_argument('--dem', required=True)
  ap.add_argument('--zooms', default='5,6')
  ap.add_argument('--base', action='store_true', help='also re-render assets/terrain_relief.webp')
  args = ap.parse_args()
  if args.base:
    build_base(args.dem)
  index_path = os.path.join(OUT, 'index.json')
  index = {'tileSize': TILE, 'levels': {}}
  if os.path.exists(index_path):
    with open(index_path, encoding='utf-8') as f:
      prev = json.load(f)
    if prev.get('tileSize') == TILE:
      index = prev
  total = 0
  for z in (int(v) for v in args.zooms.split(',') if v):
    tiles = build_level(args.dem, z)
    index['levels'][str(z)] = sorted(tiles)
    size = sum(os.path.getsize(p) for p in glob.glob(os.path.join(OUT, str(z), '*', '*.webp')))
    total += size
    print(f'z{z}: {len(tiles)} land tiles, {size / 1048576:.1f} MB')
  with open(index_path, 'w', encoding='utf-8') as f:
    json.dump(index, f, separators=(',', ':'))
  print(f'built {total / 1048576:.1f} MB')


if __name__ == '__main__':
  main()
