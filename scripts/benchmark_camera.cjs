#!/usr/bin/env node
// Compare the checked-out application with a Git revision; no renderer overrides.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const url = process.env.ATLAS_URL || 'http://127.0.0.1:8765/';
const baseRef = process.env.CAMERA_BASE_REF || 'origin/main';
const duration = Number(process.env.CAMERA_DURATION || 3000);
const repetitions = Number(process.env.CAMERA_RUNS || 3);
const output = path.resolve(process.env.CAMERA_OUTPUT || '/tmp/jiangshan-camera-benchmark.json');
const root = path.resolve(__dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const baseline = Object.fromEntries(['js/app.js', 'css/style.css', 'index.html'].map(file => [file, git('show', `${baseRef}:${file}`)]));
const percentile = (values, q) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = {
    environment: {
      browser: browser.version(), platform: process.platform, arch: process.arch,
      headless: true, viewport: { width: 1440, height: 900 }, dpr: 2,
      duration, repetitions, baseCommit: git('rev-parse', baseRef).trim(),
      candidateCommit: git('rev-parse', 'HEAD').trim(),
      candidateDiff: git('diff', 'HEAD', '--', 'js/app.js', 'css/style.css', 'index.html'),
    },
    runs: [],
  };
  try {
    for (let repeat = 0; repeat < repetitions; repeat++) {
      for (const variant of repeat % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
        const context = await browser.newContext({ viewport: results.environment.viewport, deviceScaleFactor: 2 });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
          const request = new URL(route.request().url());
          if (![new URL(url).hostname, 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(request.hostname)) return route.abort();
          const file = request.pathname.replace(/^\//, '') || 'index.html';
          if (variant === 'baseline' && request.origin === new URL(url).origin && baseline[file]) {
            return route.fulfill({ body: baseline[file], contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
          }
          return route.continue();
        });
        await page.addInitScript(() => {
          window.cameraLongTasks = [];
          new PerformanceObserver(list => cameraLongTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
        });
        await page.goto(url + '?year=1415', { waitUntil: 'load' });
        await page.waitForFunction(() => window.atlasApp?._fullSnapshotsLoaded);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(600);
        const fonts = await page.evaluate(() => ({
          faces: [...document.fonts].reduce((counts, font) => {
            const key = `${font.family}:${font.status}`; counts[key] = (counts[key] || 0) + 1; return counts;
          }, {}),
          map: getComputedStyle(document.querySelector('.polity-caption')).fontFamily,
        }));
        if (!Object.keys(fonts.faces).some(key => key.includes('Noto Serif SC:loaded'))) throw new Error('Google Fonts did not load; comparison would use fallback fonts');
        await page.evaluate(() => {
          atlasApp.closeMilestoneBalloon();
          window.cameraTypographyCalls = 0;
          const original = atlasApp._rescaleSvgTypography;
          atlasApp._rescaleSvgTypography = function (...args) { cameraTypographyCalls++; return original.apply(this, args); };
          window.cameraLongTasks = [];
        });
        const cdp = await context.newCDPSession(page);
        await cdp.send('Performance.enable');
        const before = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
        const measured = await page.evaluate(async duration => {
          const camera = { ...atlasApp.camera }, frames = [];
          let previous, start;
          await new Promise(resolve => {
            const frame = time => {
              start ??= time;
              if (previous !== undefined) frames.push(time - previous);
              previous = time;
              const progress = (time - start) / duration;
              if (progress >= 1) return resolve();
              const k = Math.exp(0.45 * Math.sin(progress * Math.PI * 4));
              atlasApp.camera = {
                x: camera.x + camera.w * (1 - k) / 2,
                y: camera.y + camera.h * (1 - k) / 2,
                w: camera.w * k, h: camera.h * k, zoom: 1000 / (camera.w * k),
              };
              atlasApp._applyCamera();
              requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
          });
          return { frames, typographyCalls: cameraTypographyCalls, longtasks: cameraLongTasks.slice(), endTime: performance.now() };
        }, duration);
        const after = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
        // Include the deferred work explicitly instead of hiding it outside the benchmark.
        const settle = await page.evaluate(async endTime => {
          const before = cameraTypographyCalls;
          await new Promise(resolve => {
            const poll = () => atlasApp._cameraSettleTimer ? requestAnimationFrame(poll) : requestAnimationFrame(() => resolve());
            requestAnimationFrame(poll);
          });
          return {
            waitMs: performance.now() - endTime,
            typographyCalls: cameraTypographyCalls - before,
            typographyCurrent: Math.abs(atlasApp.camera.w - atlasApp._lastTypographyWidth) <= 0.05,
            moving: atlasApp.svg.classList.contains('is-camera-moving'),
            labelStroke: getComputedStyle(document.querySelector('.polity-caption')).stroke,
            longtasks: cameraLongTasks.filter(task => task.start >= endTime),
          };
        }, measured.endTime);
        if (!settle.typographyCurrent || settle.moving || settle.labelStroke === 'none' || errors.length) throw new Error(`Invalid settled state: ${JSON.stringify({ settle, errors })}`);
        const row = {
          variant, repeat, fonts, fps: measured.frames.length * 1000 / measured.frames.reduce((a, b) => a + b, 0),
          frameP95: percentile(measured.frames, 0.95), frameMax: Math.max(...measured.frames),
          layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
          scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
          ...measured, settle, errors,
        };
        results.runs.push(row);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, JSON.stringify(results, null, 2));
        console.log(JSON.stringify({ variant, repeat, fps: +row.fps.toFixed(1), p95: +row.frameP95.toFixed(1), longtasks: row.longtasks.length, typographyCalls: row.typographyCalls, settle }));
        await context.close();
      }
    }
    console.log(`Saved ${results.runs.length} samples to ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
