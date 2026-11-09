#!/usr/bin/env node
/**
 * Real-Browser Responsive UI Geometry & Non-Overlap Audit for Jiangshan Atlas (江山时序)
 * Zero external npm dependencies — uses headless Chrome/Chromium (--dump-dom) across
 * Desktop (1280×800), Tablet (768×1024), and Mobile (375×812) viewports to verify:
 *   1. Timeline edge handles (#timeline-start / #timeline-end) & crop masks align with #scrubber-track
 *   2. Year/Era bubble (#scrubber-Bubble) stays visible, within viewport, and aligned at zoomed edges
 *   3. Mobile 2-row timeline header has zero overlap between playback controls, era bubble, and stepper
 *   4. Floating HUD controls (#nav-bar, #map-search-box, #map-key, #canvas-br-dock, #scrubber-dock)
 *      stay within viewport bounds without mutual collisions.
 */
'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TRANSPARENT_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function findChromeBinary() {
  const candidates = [process.env.CHROME_BIN || ''];
  const pwRoots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH || '',
    path.join(os.homedir(), '.cache', 'ms-playwright'),
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'),
  ];
  for (const root of pwRoots) {
    if (!root || !fs.existsSync(root)) continue;
    for (const dir of fs.readdirSync(root).sort().reverse()) {
      for (const rel of [
        'chrome-headless-shell-mac-arm64/chrome-headless-shell',
        'chrome-headless-shell-mac-x64/chrome-headless-shell',
        'chrome-headless-shell-linux64/chrome-headless-shell',
        'chrome-linux/chrome',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
      ]) {
        candidates.push(path.join(root, dir, rel));
      }
    }
  }
  for (const name of ['chrome-headless-shell', 'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try {
      const whichOut = execFileSync('which', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (whichOut) candidates.push(whichOut);
    } catch (_) {}
  }
  candidates.push(
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  );
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      try {
        fs.accessSync(c, fs.constants.X_OK);
        return c;
      } catch (_) {}
    }
  }
  return null;
}

const PROBE_SCRIPT = `
<script>
window.addEventListener('load', () => {
  const q = new URLSearchParams(window.location.search);
  const targetW = Number(q.get('audit_w')) || window.innerWidth;
  const targetH = Number(q.get('audit_h')) || window.innerHeight;
  if (window.innerWidth > targetW) {
    document.documentElement.style.width = targetW + 'px';
    document.body.style.width = targetW + 'px';
    window.dispatchEvent(new Event('resize'));
  }
  setTimeout(() => {
    const ctrl = window.atlas;
    const rectOf = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      return {
        left: Number(r.left.toFixed(2)),
        top: Number(r.top.toFixed(2)),
        right: Number(r.right.toFixed(2)),
        bottom: Number(r.bottom.toFixed(2)),
        width: Number(r.width.toFixed(2)),
        height: Number(r.height.toFixed(2)),
        visibility: cs.visibility,
        display: cs.display,
        opacity: Number(cs.opacity),
      };
    };
    const snapshotState = () => ({
      vw: targetW,
      vh: targetH,
      year: ctrl ? ctrl.year : null,
      scrubberView: ctrl && ctrl._scrubberView ? { ...ctrl._scrubberView } : null,
      navBar: rectOf('#nav-bar'),
      searchBox: rectOf('#map-search-box'),
      mapKey: rectOf('#map-key'),
      brDock: rectOf('#canvas-br-dock'),
      scrubberDock: rectOf('#scrubber-dock'),
      playbackGroup: rectOf('.playback-controls-group'),
      yearStepper: rectOf('.year-stepper'),
      track: rectOf('#scrubber-track'),
      edgeStart: rectOf('#timeline-start'),
      edgeEnd: rectOf('#timeline-end'),
      bubble: rectOf('#scrubber-Bubble'),
      handle: rectOf('#scrubber-handle'),
    });

    const states = {};
    states.initial = snapshotState();

    if (ctrl && typeof ctrl._setScrubberView === 'function') {
      const p80 = ctrl._yearToProgress(80);
      const p1756 = ctrl._yearToProgress(1756);
      ctrl._setScrubberView(p80, p1756);
      ctrl.jumpToYear(1756);
      states.zoomedRightEdge = snapshotState();

      ctrl._setScrubberView(p80, p1756);
      ctrl.jumpToYear(80);
      states.zoomedLeftEdge = snapshotState();

      ctrl._setScrubberView(0, 1);
      ctrl.jumpToYear(692);
      states.longEra692 = snapshotState();
    }

    const out = document.createElement('script');
    out.id = 'atlas-layout-probe-json';
    out.type = 'application/json';
    out.textContent = JSON.stringify(states);
    document.body.appendChild(out);
  }, 120);
});
</script>
`;

function createProbeHtml(rootDir) {
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const htmlLocal = indexHtml
    .replace(/<link[^>]+https?:\/\/[^>]+>\s*/g, '')
    .replace(/(<img[^>]+)\bsrc="https?:\/\/[^"]+"/g, `$1src="${TRANSPARENT_GIF}"`)
    .replace(
      /(<script\b[^>]*\bsrc="js\/app\.js)/,
      '  <script src="js/atlas_snapshots.js"></script>\n  <script src="js/i18n_dict.js"></script>\n$1'
    )
    .replace('</body>', `${PROBE_SCRIPT}\n</body>`);
  const tmpPath = path.join(rootDir, `_audit_layout_tmp_${process.pid}.html`);
  fs.writeFileSync(tmpPath, htmlLocal, 'utf8');
  return tmpPath;
}

function boxesOverlap(a, b, pad = 1) {
  if (!a || !b || a.width === 0 || b.width === 0 || a.display === 'none' || b.display === 'none') return false;
  return !(
    a.right <= b.left + pad ||
    a.left >= b.right - pad ||
    a.bottom <= b.top + pad ||
    a.top >= b.bottom - pad
  );
}

function runViewportProbe(chromeBin, tmpHtmlPath, width, height) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jiangshan-chrome-'));
  try {
    const dom = execFileSync(
      chromeBin,
      [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-networking',
        '--no-first-run',
        '--hide-scrollbars',
        `--user-data-dir=${userDataDir}`,
        `--window-size=${width},${height}`,
        '--virtual-time-budget=1500',
        '--dump-dom',
        `file://${tmpHtmlPath}?audit_w=${width}&audit_h=${height}`,
      ],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const m = dom.match(/<script id="atlas-layout-probe-json" type="application\/json">([\s\S]*?)<\/script>/);
    assert(m && m[1], `Failed to capture #atlas-layout-probe-json at viewport ${width}×${height}`);
    return JSON.parse(m[1]);
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

function verifyViewportStates(label, width, height, states) {
  for (const [stateName, st] of Object.entries(states)) {
    const ctx = `${label} (${width}×${height}) [${stateName}]`;
    assert(st.track && st.track.width > 100 && st.track.height >= 26, `${ctx}: #scrubber-track invalid rect ${JSON.stringify(st.track)}`);
    assert(st.edgeStart && st.edgeEnd, `${ctx}: missing timeline edge handles`);

    // 1. Edge handles must wrap #scrubber-track vertically with 2px top/bottom lip
    for (const [edgeName, edge] of [['#timeline-start', st.edgeStart], ['#timeline-end', st.edgeEnd]]) {
      assert(
        Math.abs(edge.top - (st.track.top - 2)) <= 1.5 && Math.abs(edge.bottom - (st.track.bottom + 2)) <= 1.5,
        `${ctx}: ${edgeName} (${edge.top}..${edge.bottom}) is misaligned with #scrubber-track (${st.track.top}..${st.track.bottom})`
      );
    }

    // 2. #scrubber-Bubble must always be visible and within horizontal viewport bounds
    assert(
      st.bubble && st.bubble.visibility === 'visible' && st.bubble.width >= 48 && st.bubble.height >= 14,
      `${ctx}: #scrubber-Bubble must remain visible, got ${JSON.stringify(st.bubble)}`
    );
    assert(
      st.bubble.left >= 0 && st.bubble.right <= width,
      `${ctx}: #scrubber-Bubble (${st.bubble.left}..${st.bubble.right}) overflows viewport width ${width}`
    );

    // 3. On mobile (<= 640px), #scrubber-Bubble in Row 1 must not overlap playback controls or year stepper
    if (width <= 640) {
      assert(
        !boxesOverlap(st.bubble, st.playbackGroup, 1),
        `${ctx}: mobile #scrubber-Bubble (${JSON.stringify(st.bubble)}) overlaps .playback-controls-group (${JSON.stringify(st.playbackGroup)})`
      );
      assert(
        !boxesOverlap(st.bubble, st.yearStepper, 1),
        `${ctx}: mobile #scrubber-Bubble (${JSON.stringify(st.bubble)}) overlaps .year-stepper (${JSON.stringify(st.yearStepper)})`
      );
    } else {
      // On desktop/tablet (> 640px), when playhead is at right edge (zoomedRightEdge), bubble must reach right edge of track
      if (stateName === 'zoomedRightEdge') {
        assert(
          Math.abs(st.bubble.right - st.track.right) <= 4,
          `${ctx}: desktop #scrubber-Bubble right (${st.bubble.right}) must align with #scrubber-track right (${st.track.right}) at right-edge year`
        );
      }
      if (stateName === 'zoomedLeftEdge') {
        assert(
          Math.abs(st.bubble.left - st.track.left) <= 4,
          `${ctx}: desktop #scrubber-Bubble left (${st.bubble.left}) must align with #scrubber-track left (${st.track.left}) at left-edge year`
        );
      }
    }

    // 4. Floating HUD controls must stay inside viewport and not overlap each other
    for (const [hudName, box] of [
      ['#nav-bar', st.navBar],
      ['#map-search-box', st.searchBox],
      ['#map-key', st.mapKey],
      ['#canvas-br-dock', st.brDock],
      ['#scrubber-dock', st.scrubberDock],
    ]) {
      assert(box && box.width > 0 && box.height > 0, `${ctx}: ${hudName} must be visible`);
      assert(
        box.left >= -1 && box.top >= -1 && box.right <= width + 1 && box.bottom <= height + 1,
        `${ctx}: ${hudName} (${JSON.stringify(box)}) overflows viewport ${width}×${height}`
      );
    }
    assert(!boxesOverlap(st.searchBox, st.mapKey, 2), `${ctx}: #map-search-box overlaps #map-key`);
    assert(!boxesOverlap(st.mapKey, st.brDock, 2), `${ctx}: #map-key overlaps #canvas-br-dock`);
    assert(!boxesOverlap(st.navBar, st.searchBox, 1), `${ctx}: #nav-bar overlaps #map-search-box`);
    assert(!boxesOverlap(st.mapKey, st.scrubberDock, 1), `${ctx}: #map-key overlaps #scrubber-dock`);
  }
}

function main() {
  const chromeBin = findChromeBinary();
  assert(chromeBin, 'Could not locate headless Chrome/Chromium binary for layout geometry audit');
  const tmpHtmlPath = createProbeHtml(ROOT);
  const t0 = Date.now();
  try {
    const viewports = [
      ['Desktop', 1280, 800],
      ['Tablet', 768, 1024],
      ['Mobile', 375, 812],
    ];
    for (const [label, w, h] of viewports) {
      const states = runViewportProbe(chromeBin, tmpHtmlPath, w, h);
      verifyViewportStates(label, w, h, states);
    }
    console.log(
      `✓ Responsive UI layout & non-overlap audit passed across Desktop (1280×800), Tablet (768×1024), and Mobile (375×812) in ${Date.now() - t0} ms`
    );
  } finally {
    if (fs.existsSync(tmpHtmlPath)) fs.unlinkSync(tmpHtmlPath);
  }
}

if (require.main === module) {
  main();
}
