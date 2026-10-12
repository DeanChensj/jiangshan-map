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
  years = ",".join(
      str(int(y.strip()))
      for y in re.split(r"[,，、;\s]+", str(args.year).strip())
      if y.strip()
  )
  params = [("year", years)]
  if args.place:
    normalized = ",".join(
        p.strip() for p in re.split(r"\s*(?:,|，|、|→|->)\s*", args.place.strip()) if p.strip()
    )
    params.append(("place", normalized))
  return urllib.parse.urlencode(params, safe=",")


def render_screenshot(query, out_path):
  chrome = find_chrome()
  if not chrome:
    raise RuntimeError(
        "No headless Chrome/Chromium binary found. Set CHROME_BIN to render screenshots."
    )

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
      "--out",
      type=str,
      default="",
      help="Optional output PNG path for rendered map screenshot",
  )
  args = parser.parse_args()

  query = build_query(args)
  public_url = f"{PUBLIC_BASE_URL}?{query}"
  print(f"URL: {public_url}")

  if args.out:
    render_screenshot(query, args.out)
    print(f"Screenshot: {os.path.abspath(args.out)}")


if __name__ == "__main__":
  sys.exit(main())
