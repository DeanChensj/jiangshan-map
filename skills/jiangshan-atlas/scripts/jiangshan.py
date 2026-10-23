#!/usr/bin/env python3
"""CLI helper for the jiangshan-atlas skill: builds deep-link URLs, inspects historical context, and renders map screenshots."""
import argparse
import glob
import html as html_lib
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zlib

PUBLIC_BASE_URL = os.environ.get(
    "JIANGSHAN_PUBLIC_URL", "https://deanchen.me/jiangshan-map/"
)
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MIN_VALID_PNG_BYTES = 65_536
TRANSPARENT_GIF_DATA_URI = (
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
)


def _discover_playwright_chromes():
  roots = [
      os.environ.get("PLAYWRIGHT_BROWSERS_PATH", ""),
      os.path.expanduser("~/.cache/ms-playwright"),
      os.path.expanduser("~/Library/Caches/ms-playwright"),
  ]
  patterns = [
      "chromium_headless_shell-*/chrome-*-shell-*/chrome-headless-shell",
      "chromium_headless_shell-*/chrome-*/chrome-headless-shell",
      "chromium-*/chrome-*/chrome",
      "chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
  ]
  found = []
  for root in roots:
    if not root or not os.path.isdir(root):
      continue
    for pat in patterns:
      matches = sorted(glob.glob(os.path.join(root, pat)), reverse=True)
      found.extend(matches)
  return found


def find_chrome():
  candidates = [
      os.environ.get("CHROME_BIN", ""),
      *_discover_playwright_chromes(),
      shutil.which("chromium") or "",
      shutil.which("chromium-browser") or "",
      shutil.which("chrome-headless-shell") or "",
      shutil.which("chrome") or "",
      *sorted(glob.glob("/usr/bin/*chrom*")),
      *sorted(glob.glob("/Applications/*Chrom*.app/Contents/MacOS/*")),
  ]
  for c in candidates:
    if c and os.path.isfile(c) and os.access(c, os.X_OK):
      return c
  return None


def find_local_repo_root():
  if os.environ.get("JIANGSHAN_FORCE_REMOTE") == "1":
    return None
  script_dir = os.path.dirname(os.path.abspath(__file__))
  candidates = [
      os.environ.get("JIANGSHAN_REPO_ROOT", ""),
      os.path.abspath(os.path.join(script_dir, "..", "..", "..")),
  ]
  for candidate in candidates:
    if (
        candidate
        and os.path.isfile(os.path.join(candidate, "index.html"))
        and os.path.isfile(os.path.join(candidate, "js", "app.js"))
    ):
      return candidate
  return None


def normalize_years(year_str):
  if not year_str:
    return ""
  return ",".join(
      str(int(y.strip()))
      for y in re.split(r"[,，、;\s]+", str(year_str).strip())
      if y.strip()
  )


def normalize_places(place_str):
  if not place_str:
    return ""
  return ",".join(
      p.strip()
      for p in re.split(r"\s*(?:,|，|、|→|->)\s*", place_str.strip())
      if p.strip()
  )


def build_query(args):
  params = []
  years = normalize_years(args.year)
  if years:
    params.append(("year", years))
  if getattr(args, "person", ""):
    params.append(("person", args.person.strip()))
    if getattr(args, "stop", None) is not None and args.stop >= 0:
      params.append(("stop", str(args.stop)))
  normalized_place = normalize_places(args.place)
  if normalized_place:
    params.append(("place", normalized_place))
  if args.hover:
    params.append(("hover", args.hover.strip()))
  if args.lang == "en":
    params.append(("lang", "en"))
  elif args.lang in ("zh-tw", "tw", "hk", "zh-hk", "zh-hant", "hant"):
    params.append(("lang", "zh-tw"))
  return urllib.parse.urlencode(params, safe=",")


def _check_remote_reachable(url):
  req = urllib.request.Request(
      url,
      method="HEAD",
      headers={"User-Agent": "jiangshan-atlas-cli/1.0"},
  )
  try:
    with urllib.request.urlopen(req, timeout=5) as resp:
      if resp.status >= 400:
        raise RuntimeError(f"HTTP {resp.status} from {url}")
  except Exception as exc:
    raise RuntimeError(
        f"Cannot reach {url} ({exc}). "
        "Headless browser rendering requires network access when no local repository is present. "
        "Set JIANGSHAN_REPO_ROOT=/path/to/jiangshan-map for offline rendering, "
        "or re-run with network access enabled."
    ) from exc


def _write_offline_html(repo_root):
  index_path = os.path.join(repo_root, "index.html")
  with open(index_path, "r", encoding="utf-8") as f:
    html = f.read()
  # Strip external stylesheet/preconnect links and external avatar images so
  # offline/sandboxed headless browsers never block on network timeouts.
  html_local = re.sub(r"<link[^>]+https?://[^>]+>\s*", "", html)
  html_local = re.sub(
      r'(<img[^>]+)\bsrc="https?://[^"]+"',
      rf'\1src="{TRANSPARENT_GIF_DATA_URI}"',
      html_local,
  )
  html_local = html_local.replace(
      '<script src="js/app.js',
      '<style>.fade-enter { animation: none !important; opacity: 1 !important; }</style>\n'
      '  <script src="js/atlas_snapshots.js"></script>\n'
      '  <script src="js/i18n_dict.js"></script>\n'
      '  <script src="js/app.js',
  )
  tmp_html = os.path.join(repo_root, f"_snap_skill_tmp_{os.getpid()}.html")
  try:
    with open(tmp_html, "w", encoding="utf-8") as f:
      f.write(html_local)
    return tmp_html
  except OSError:
    base_href = f'file://{os.path.abspath(repo_root).rstrip("/")}/'
    html_with_base = html_local.replace(
        "<head>", f'<head>\n  <base href="{base_href}">', 1
    )
    fd, fallback_html = tempfile.mkstemp(
        prefix="_snap_skill_tmp_", suffix=".html"
    )
    with os.fdopen(fd, "w", encoding="utf-8") as f:
      f.write(html_with_base)
    return fallback_html


def _chrome_env():
  env = os.environ.copy()
  env["DBUS_SESSION_BUS_ADDRESS"] = "disabled:"
  return env


def _chrome_common_flags():
  return [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-sync",
      "--no-first-run",
      "--disable-default-apps",
      "--disable-extensions",
      "--mute-audio",
      "--hide-scrollbars",
  ]


def _validate_inspect_result(data, args):
  if getattr(args, "person", "") and not data.get("person"):
    raise RuntimeError(
        f"Could not resolve historical figure '{args.person}' in the atlas. "
        "Use a canonical Chinese, English, or Pinyin figure name or key "
        "(e.g. sushi / 苏轼 / Su Shi, zhugeliang / 诸葛亮, libai / 李白)."
    )
  normalized_place = normalize_places(args.place)
  if not normalized_place:
    return
  stops = [s for s in normalized_place.split(",") if s]
  if len(stops) >= 2:
    resolved_route = data.get("route") or []
    resolved_places = {s.get("place") for s in resolved_route}
    missing = [s for s in stops if s not in resolved_places]
    if missing or len(resolved_route) < 2:
      raise RuntimeError(
          f"Could not resolve route stop(s) {missing or stops} in the atlas gazetteer. "
          "Use canonical ancient/modern Chinese, English, or Pinyin place names "
          "(e.g. 九江 / Jiujiang, 蓝关 / Lantian Pass, 长安 / Chang'an)."
      )
  elif not data.get("coord"):
    raise RuntimeError(
        f"Could not resolve place '{normalized_place}' in the atlas gazetteer. "
        "Use a canonical ancient/modern Chinese, English, or Pinyin place name "
        "(e.g. 九江 / Jiujiang, 蓝关 / Lantian Pass, 长安 / Chang'an)."
    )


def inspect_context(args, query, public_url):
  repo_root = find_local_repo_root()
  node_bin = shutil.which("node")
  normalized_years = normalize_years(args.year)
  normalized_place = normalize_places(args.place)

  if repo_root and node_bin:
    node_script = r"""
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = process.env.JS_REPO_ROOT;
const sandbox = {
  window: {},
  addEventListener: () => {},
  document: { addEventListener: () => {}, getElementById: () => null, querySelectorAll: () => [] },
  localStorage: { getItem: () => null, setItem: () => {} },
  history: { replaceState: () => {} },
  location: { origin: "https://deanchen.me", pathname: "/jiangshan-map/", search: "" },
  navigator: { language: process.env.JS_LANG === "en" ? "en-US" : "zh-CN" },
  performance: { now: () => 0 },
  requestAnimationFrame: () => {},
  URLSearchParams
};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const rel of [
  "js/china_geo_data.js",
  "js/map_data.js",
  "js/atlas_snapshots.js",
  "js/i18n_dict.js",
  "js/lore_data.js",
  "js/zh_hant.js",
  "js/app.js"
]) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), sandbox);
}
const ctrl = Object.create(sandbox.HistoricalAtlasController.prototype);
ctrl.minYear = -403;
ctrl.maxYear = 2026;
ctrl.year = 1102;
ctrl.locale = process.env.JS_LANG === "en" ? "en" : process.env.JS_LANG === "zh-tw" ? "zh-tw" : "zh";
ctrl.enLocale = sandbox.EN_LOCALE;
ctrl.dynasties = sandbox.DYNASTY_DATA;
ctrl.snapshots = sandbox.ATLAS_SNAPSHOTS;
ctrl.provinces = sandbox.PROVINCE_OUTLINES || [];
ctrl.projector = new sandbox.MercatorProjector(1000, 700, {
  west: 66,
  east: 142,
  south: 14,
  north: 55
});
ctrl._hydrateSnapshots();
ctrl.camera = { x: 0, y: 0, w: 1000, h: 700, zoom: 1 };
const res = ctrl.inspect({
  year: process.env.JS_YEAR || undefined,
  place: process.env.JS_PLACE || undefined,
  person: process.env.JS_PERSON || undefined,
  stop: process.env.JS_STOP !== "" ? Number(process.env.JS_STOP) : undefined
});
process.stdout.write(JSON.stringify(res));
"""
    env = os.environ.copy()
    env["JS_REPO_ROOT"] = repo_root
    env["JS_YEAR"] = normalized_years
    env["JS_PLACE"] = normalized_place
    env["JS_PERSON"] = (getattr(args, "person", "") or "").strip()
    env["JS_STOP"] = (
        str(args.stop)
        if getattr(args, "stop", None) is not None and args.stop >= 0
        else ""
    )
    env["JS_LANG"] = args.lang
    proc = subprocess.run(
        [node_bin, "-e", node_script],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode == 0 and proc.stdout.strip():
      data = json.loads(proc.stdout.strip())
      data["url"] = public_url
      _validate_inspect_result(data, args)
      return data

  chrome = find_chrome()
  if not chrome:
    raise RuntimeError(
        "Neither local Node.js nor headless Chrome/Chromium is available to run --inspect."
    )

  tmp_html = None
  try:
    if repo_root:
      tmp_html = _write_offline_html(repo_root)
      target_url = f"file://{tmp_html}?{query}"
    else:
      _check_remote_reachable(PUBLIC_BASE_URL)
      target_url = f"{PUBLIC_BASE_URL}?{query}"

    proc = subprocess.run(
        [
            chrome,
            *_chrome_common_flags(),
            "--virtual-time-budget=2000",
            "--dump-dom",
            target_url,
        ],
        env=_chrome_env(),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
      stderr_tail = (proc.stderr or "").strip()[-400:]
      raise RuntimeError(
          f"Headless Chrome --dump-dom exited with code {proc.returncode}: {stderr_tail}"
      )
    match = re.search(
        r'<script[^>]+id="atlas-inspect-json"[^>]*>(.*?)</script>',
        proc.stdout or "",
        re.DOTALL,
    )
    if not match or not match.group(1).strip():
      raise RuntimeError("Failed to extract #atlas-inspect-json from rendered DOM.")
    data = json.loads(html_lib.unescape(match.group(1).strip()))
    data["url"] = public_url
    _validate_inspect_result(data, args)
    return data
  finally:
    if tmp_html and os.path.exists(tmp_html):
      os.remove(tmp_html)


def _verify_screenshot_png(out_path):
  if not os.path.isfile(out_path):
    raise RuntimeError(f"Screenshot file was not created: {out_path}")

  file_size = os.path.getsize(out_path)
  with open(out_path, "rb") as f:
    data = f.read()

  if len(data) < 33 or data[:8] != PNG_SIGNATURE:
    raise RuntimeError(f"Invalid PNG header in {out_path}")

  pos = 8
  width = 0
  height = 0
  idat_parts = []
  while pos + 8 <= len(data):
    length = struct.unpack(">I", data[pos : pos + 4])[0]
    chunk_type = data[pos + 4 : pos + 8]
    chunk_data = data[pos + 8 : pos + 8 + length]
    pos += 12 + length
    if chunk_type == b"IHDR" and len(chunk_data) >= 8:
      width, height = struct.unpack(">II", chunk_data[:8])
    elif chunk_type == b"IDAT":
      idat_parts.append(chunk_data)
    elif chunk_type == b"IEND":
      break

  if width < 800 or height < 500 or not idat_parts:
    raise RuntimeError(
        f"Invalid screenshot dimensions ({width}x{height}) in {out_path}"
    )

  raw = zlib.decompress(b"".join(idat_parts))
  mid_start = len(raw) // 5
  mid_end = (len(raw) * 4) // 5
  sample = raw[mid_start:mid_end:37]
  varied = sum(1 for b in sample if b not in (0, 255))
  varied_ratio = varied / max(1, len(sample))

  if file_size < MIN_VALID_PNG_BYTES or varied_ratio < 0.05:
    raise RuntimeError(
        f"Rendered screenshot appears blank or unrendered "
        f"(size={file_size:,}B, varied_ratio={varied_ratio:.3f}). "
        "Ensure local repo assets or network access are available."
    )


def render_screenshot(query, out_path):
  chrome = find_chrome()
  if not chrome:
    raise RuntimeError(
        "No headless Chrome/Chromium binary found. Set CHROME_BIN to render screenshots."
    )

  repo_root = find_local_repo_root()
  tmp_html = None
  abs_out = os.path.abspath(out_path)
  try:
    if repo_root:
      tmp_html = _write_offline_html(repo_root)
      target_url = f"file://{tmp_html}?{query}"
    else:
      _check_remote_reachable(PUBLIC_BASE_URL)
      target_url = f"{PUBLIC_BASE_URL}?{query}"

    os.makedirs(os.path.dirname(abs_out), exist_ok=True)
    if os.path.exists(abs_out):
      os.remove(abs_out)

    proc = subprocess.run(
        [
            chrome,
            *_chrome_common_flags(),
            "--force-device-scale-factor=2",
            "--window-size=1440,900",
            "--virtual-time-budget=2000",
            f"--screenshot={abs_out}",
            target_url,
        ],
        env=_chrome_env(),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
      if os.path.exists(abs_out):
        os.remove(abs_out)
      stderr_tail = (proc.stderr or "").strip()[-400:]
      raise RuntimeError(
          f"Headless Chrome exited with code {proc.returncode}: {stderr_tail}"
      )

    try:
      _verify_screenshot_png(abs_out)
    except Exception:
      if os.path.exists(abs_out):
        os.remove(abs_out)
      raise
  finally:
    if tmp_html and os.path.exists(tmp_html):
      os.remove(tmp_html)


def main():
  parser = argparse.ArgumentParser(
      description="Jiangshan Historical Atlas CLI (year + place/route or person chronicle)"
  )
  parser.add_argument(
      "--year",
      type=str,
      default="",
      help="Historical year (-403 to 2026, negative for BCE) or comma-separated years for multi-year routes (e.g. 1079,1080,1094,1097)",
  )
  parser.add_argument(
      "--place",
      type=str,
      default="",
      help="Single place name or comma-separated route in Chinese, English, or Pinyin (e.g. 蓝关 / Lantian Pass, or 剑外,巴峡,巫峡,襄阳,洛阳 / Huzhou,Huangzhou,Huizhou,Danzhou)",
  )
  parser.add_argument(
      "--person",
      type=str,
      default="",
      help="Historical figure key or name in Chinese, English, or Pinyin (e.g. sushi / 苏轼 / Su Shi, zhugeliang / 诸葛亮, libai / 李白) to open the Person Chronicle trajectory",
  )
  parser.add_argument(
      "--stop",
      type=int,
      default=None,
      help="Optional 0-based event index when using --person (omit for full-map overview)",
  )
  parser.add_argument(
      "--hover",
      type=str,
      default="",
      help="Optional prefecture title in Chinese or English/Pinyin to highlight with its tooltip (e.g. 应天府 / Yingtian Fu, 黄州 / Huangzhou)",
  )
  parser.add_argument(
      "--lang",
      choices=["zh", "zh-tw", "en"],
      default="zh",
      help="UI language; 'zh-tw' renders Traditional Chinese, 'en' renders English",
  )
  parser.add_argument(
      "--inspect",
      action="store_true",
      help="Return structured JSON from atlasAPI.inspect (era, dynasty, polity, regions, prefectures, modernProvince, nearestCity with remark, lore, route, person) and verify resolution",
  )
  parser.add_argument(
      "--out",
      type=str,
      default="",
      help="Optional output PNG path for rendered map screenshot",
  )
  args = parser.parse_args()
  if not args.year.strip() and not args.person.strip():
    parser.error("Either --year or --person is required.")

  query = build_query(args)
  public_url = f"{PUBLIC_BASE_URL.rstrip('/')}/?{query}"
  print(f"URL: {public_url}")

  if args.inspect:
    try:
      info = inspect_context(args, query, public_url)
    except Exception as exc:  # pylint: disable=broad-except
      print(f"Error: {exc}", file=sys.stderr)
      return 1
    print(f"Inspect: {json.dumps(info, ensure_ascii=False)}")

  if args.out:
    try:
      render_screenshot(query, args.out)
    except Exception as exc:  # pylint: disable=broad-except
      print(f"Error: {exc}", file=sys.stderr)
      return 1
    print(f"Screenshot: {os.path.abspath(args.out)}")
  return 0


if __name__ == "__main__":
  sys.exit(main())
