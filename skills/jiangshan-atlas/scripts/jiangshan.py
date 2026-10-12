#!/usr/bin/env python3
"""CLI helper for the jiangshan-atlas skill: builds deep-link URLs and renders map screenshots."""
import argparse
import os
import re
import shutil
import subprocess
import sys
import urllib.parse

PUBLIC_BASE_URL = "https://deanchensj.github.io/jiangshan-map/"

CHROME_CANDIDATES = [
    os.environ.get("CHROME_BIN", ""),
    "/usr/local/google/home/deanchen/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell",
    shutil.which("chromium") or "",
    shutil.which("chromium-browser") or "",
    shutil.which("google-chrome-stable") or "",
    shutil.which("google-chrome") or "",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]


def find_chrome():
  for c in CHROME_CANDIDATES:
    if c and os.path.isfile(c) and os.access(c, os.X_OK):
      return c
  return None


def find_local_repo_root():
  script_dir = os.path.dirname(os.path.abspath(__file__))
  candidate = os.path.abspath(os.path.join(script_dir, "..", "..", ".."))
  if os.path.isfile(os.path.join(candidate, "index.html")) and os.path.isfile(
      os.path.join(candidate, "js", "app.js")
  ):
    return candidate
  return None


def build_query(args):
  params = [("year", str(args.year))]
  if args.place:
    params.append(("place", args.place.strip()))
  if args.lng is not None and args.lat is not None:
    params.append(("lng", f"{args.lng:.2f}"))
    params.append(("lat", f"{args.lat:.2f}"))
  if args.zoom is not None:
    params.append(("zoom", f"{args.zoom:.2f}"))
  return urllib.parse.urlencode(params)


def render_screenshot(query, out_path):
  chrome = find_chrome()
  if not chrome:
    raise RuntimeError("No headless Chrome/Chromium binary found. Set CHROME_BIN to render screenshots.")

  repo_root = find_local_repo_root()
  tmp_html = None
  try:
    if repo_root:
      index_path = os.path.join(repo_root, "index.html")
      tmp_html = os.path.join(repo_root, "_snap_skill_tmp.html")
      with open(index_path, "r", encoding="utf-8") as f:
        html = f.read()
      html_local = re.sub(r"<link[^>]+fonts\.googleapis\.com[^>]+>\s*", "", html)
      html_local = re.sub(r"<link[^>]+fonts\.gstatic\.com[^>]+>\s*", "", html_local)
      with open(tmp_html, "w", encoding="utf-8") as f:
        f.write(html_local)
      target_url = f"file://{tmp_html}?{query}"
    else:
      target_url = f"{PUBLIC_BASE_URL}?{query}"

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    subprocess.run(
        [
            chrome,
            "--headless",
            "--disable-gpu",
            "--no-sandbox",
            "--hide-scrollbars",
            "--force-device-scale-factor=2",
            "--window-size=1440,900",
            "--virtual-time-budget=2000",
            f"--screenshot={os.path.abspath(out_path)}",
            target_url,
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
  finally:
    if tmp_html and os.path.exists(tmp_html):
      os.remove(tmp_html)


def main():
  parser = argparse.ArgumentParser(description="Jiangshan Historical Atlas deep-link & screenshot CLI")
  parser.add_argument("--year", type=int, required=True, help="Historical year (-403 to 2026, negative for BCE)")
  parser.add_argument("--place", type=str, default="", help="Plain ancient or modern place name (e.g. 蓝田关, 京口, 运城)")
  parser.add_argument("--lng", type=float, default=None, help="Optional longitude override")
  parser.add_argument("--lat", type=float, default=None, help="Optional latitude override")
  parser.add_argument("--zoom", type=float, default=None, help="Optional zoom override (1.0 to 8.0)")
  parser.add_argument("--out", type=str, default="", help="Optional output PNG path for rendered map screenshot")
  args = parser.parse_args()

  query = build_query(args)
  public_url = f"{PUBLIC_BASE_URL}?{query}"
  print(f"URL: {public_url}")

  if args.out:
    render_screenshot(query, args.out)
    print(f"Screenshot: {os.path.abspath(args.out)}")


if __name__ == "__main__":
  sys.exit(main())
