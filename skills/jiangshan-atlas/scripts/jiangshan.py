#!/usr/bin/env python3
"""CLI helper for the jiangshan-atlas skill: builds deep-link URLs and renders map screenshots."""
import argparse
import glob
import os
import re
import shutil
import struct
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import zlib

PUBLIC_BASE_URL = os.environ.get(
    "JIANGSHAN_PUBLIC_URL", "https://deanchensj.github.io/jiangshan-map/"
)
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MIN_VALID_PNG_BYTES = 65_536


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
      shutil.which("google-chrome-stable") or "",
      shutil.which("google-chrome") or "",
      shutil.which("chrome-headless-shell") or "",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
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


def build_query(args):
  years = ",".join(
      str(int(y.strip()))
      for y in re.split(r"[,，、;\s]+", str(args.year).strip())
      if y.strip()
  )
  params = [("year", years)]
  if args.place:
    normalized = ",".join(
        p.strip()
        for p in re.split(r"\s*(?:,|，|、|→|->)\s*", args.place.strip())
        if p.strip()
    )
    params.append(("place", normalized))
  if args.hover:
    params.append(("hover", args.hover.strip()))
  if args.lang == "en":
    params.append(("lang", "en"))
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
        "Headless Chrome would produce a blank screenshot when offline or sandboxed. "
        "Set JIANGSHAN_REPO_ROOT=/path/to/jiangshan-map for offline rendering, "
        "or re-run with network access enabled."
    ) from exc


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
      index_path = os.path.join(repo_root, "index.html")
      tmp_html = os.path.join(repo_root, f"_snap_skill_tmp_{os.getpid()}.html")
      with open(index_path, "r", encoding="utf-8") as f:
        html = f.read()
      html_local = re.sub(r"<link[^>]+fonts\.googleapis\.com[^>]+>\s*", "", html)
      html_local = re.sub(
          r"<link[^>]+fonts\.gstatic\.com[^>]+>\s*", "", html_local
      )
      html_local = html_local.replace(
          '<script src="js/app.js',
          '<style>.fade-enter { animation: none !important; opacity: 1 !important; }</style>\n'
          '  <script src="js/atlas_snapshots.js"></script>\n'
          '  <script src="js/i18n_dict.js"></script>\n'
          '  <script src="js/app.js',
      )
      with open(tmp_html, "w", encoding="utf-8") as f:
        f.write(html_local)
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
            "--headless",
            "--disable-gpu",
            "--no-sandbox",
            "--hide-scrollbars",
            "--force-device-scale-factor=2",
            "--window-size=1440,900",
            "--virtual-time-budget=2000",
            f"--screenshot={abs_out}",
            target_url,
        ],
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
      description="Jiangshan Historical Atlas 2-parameter (year + place/route) CLI"
  )
  parser.add_argument(
      "--year",
      type=str,
      required=True,
      help="Historical year (-403 to 2026, negative for BCE) or comma-separated years for multi-year routes (e.g. 1079,1080,1094,1097)",
  )
  parser.add_argument(
      "--place",
      type=str,
      default="",
      help="Single place name (e.g. 蓝关) or comma-separated route (e.g. 剑外,巴峡,巫峡,襄阳,洛阳)",
  )
  parser.add_argument(
      "--hover",
      type=str,
      default="",
      help="Optional exact prefecture title to highlight with its tooltip (e.g. 应天府, 黄州)",
  )
  parser.add_argument(
      "--lang",
      choices=["zh", "en"],
      default="zh",
      help="UI language; 'en' renders the English atlas (place/hover stay in Chinese)",
  )
  parser.add_argument(
      "--out",
      type=str,
      default="",
      help="Optional output PNG path for rendered map screenshot",
  )
  args = parser.parse_args()

  query = build_query(args)
  public_url = f"https://deanchensj.github.io/jiangshan-map/?{query}"
  print(f"URL: {public_url}")

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
