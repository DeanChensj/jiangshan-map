#!/usr/bin/env node
// Optional browser regression checks. Runtime application has no npm dependencies.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const baseUrl = process.env.ATLAS_URL || 'http://127.0.0.1:8765/';
const output = process.env.CAMERA_TEST_OUTPUT;
const errors = [];
async function settled(page) {
  await page.waitForFunction(() => !atlasApp.flyRaf && atlasApp._camRaf === null && atlasApp._cameraSettleTimer === null);
}
async function load(page, query = '?year=1415') {
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return [new URL(baseUrl).hostname, 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(host)
      ? route.continue() : route.abort();
  });
  await page.goto(baseUrl + query, { waitUntil: 'load' });
  await page.waitForFunction(() => window.atlasApp?._fullSnapshotsLoaded);
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await load(page);
    const initial = await page.evaluate(() => {
      window.cameraChecks = { apply: 0, typography: 0, hit: 0 };
      for (const [method, counter] of [['_applyCamera', 'apply'], ['_rescaleSvgTypography', 'typography']]) {
        const original = atlasApp[method];
        atlasApp[method] = function (...args) { cameraChecks[counter]++; return original.apply(this, args); };
      }
      const hit = document.elementsFromPoint.bind(document);
      document.elementsFromPoint = (...args) => { cameraChecks.hit++; return hit(...args); };
      return {
        camera: { ...atlasApp.camera },
        mapFont: getComputedStyle(document.querySelector('.polity-caption')).fontFamily,
        uiFont: getComputedStyle(document.querySelector('#nav-bar')).fontFamily,
      };
    });
    assert(!initial.mapFont.includes('Noto'), 'SVG labels must not resolve to the remote Noto font');
    assert(initial.uiFont.includes('Noto'), 'UI font stack must remain unchanged');

    // Many wheel events in one task must preserve the cursor anchor and render once.
    const burst = await page.evaluate(() => {
      const a = atlasApp, r = a.svg.getBoundingClientRect();
      // MouseEvent client coordinates are integer CSS pixels in Chrome.
      const x = Math.round(r.left + r.width * 0.41), y = Math.round(r.top + r.height * 0.53);
      const anchor = a._clientToSvgPoint(x, y), width = a.camera.w;
      cameraChecks.apply = cameraChecks.typography = 0;
      for (let i = 0; i < 12; i++) a.svg.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY: -10,
      }));
      return { before: anchor, after: a._clientToSvgPoint(x, y), width, nextWidth: a.camera.w, calls: cameraChecks.apply };
    });
    assert.equal(burst.calls, 0);
    assert(Math.abs(burst.nextWidth - burst.width * Math.exp(-0.24)) < 1e-7);
    assert(Math.hypot(...burst.before.map((n, i) => n - burst.after[i])) < 1e-7, `Wheel anchor drifted: ${JSON.stringify(burst)}`);
    await page.waitForFunction(() => cameraChecks.apply === 1);
    assert.equal(await page.evaluate(() => cameraChecks.typography), 0);
    await settled(page);
    assert.equal(await page.evaluate(() => cameraChecks.typography), 1, 'Finish must restore typography once');
    assert(await page.evaluate(() => Math.abs(atlasApp.camera.w - atlasApp._lastTypographyWidth) < 0.05));
    assert.notEqual(await page.locator('.polity-caption').first().evaluate(el => getComputedStyle(el).stroke), 'none');

    // End/cancel must flush the last pointer position before its queued frame runs.
    const box = await page.locator('#atlas-svg').boundingBox();
    const x = box.x + box.width * 0.5, y = box.y + box.height * 0.5;
    for (const endType of ['pointerup', 'pointercancel']) {
      await page.mouse.move(x, y);
      await page.mouse.down();
      const end = await page.evaluate(({ x, y, endType }) => {
        const a = atlasApp, pointerId = [...a.activePointers.keys()][0];
        const before = a.camera.x;
        for (const dx of [10, 30, 60]) a.svg.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true, pointerId, pointerType: 'mouse', clientX: x + dx, clientY: y, buttons: 1,
        }));
        const queued = a._camRaf !== null;
        a.svg.dispatchEvent(new PointerEvent(endType, { bubbles: true, pointerId, pointerType: 'mouse', clientX: x + 60, clientY: y }));
        return { queued, before, after: a.camera.x, rendered: a.svg.viewBox.baseVal.x, pending: a._camRaf, pointers: a.activePointers.size };
      }, { x, y, endType });
      assert(end.queued && end.after !== end.before);
      assert(Math.abs(end.after - end.rendered) <= 0.051, `${endType} lost the final move`);
      assert.equal(end.pending, null);
      assert.equal(end.pointers, 0);
      await page.mouse.up();
      await settled(page);
    }

    // Real mouse input: no hover hit-testing while dragging, then hover resumes.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.evaluate(() => { cameraChecks.hit = 0; });
    await page.mouse.move(x + 100, y + 30, { steps: 12 });
    assert.equal(await page.evaluate(() => cameraChecks.hit), 0);
    await page.mouse.up();
    await settled(page);
    await page.mouse.move(x + 105, y + 35);
    assert(await page.evaluate(() => cameraChecks.hit > 0), 'Hover must resume');

    // A panel/layout resize must invalidate the cached viewport during motion.
    await page.evaluate(() => { atlasApp.zoomBy(1.1, undefined, undefined, false); atlasApp.svg.style.width = '85%'; });
    await page.waitForFunction(() => atlasApp._cameraViewportRect === null);
    const resized = await page.evaluate(() => {
      atlasApp.zoomBy(1.1, undefined, undefined, false);
      return { cached: atlasApp._cameraViewportRect.width, actual: atlasApp.svg.getBoundingClientRect().width };
    });
    assert.equal(resized.cached, resized.actual);
    await page.evaluate(() => { atlasApp.svg.style.width = ''; });
    await settled(page);

    // New content during a pending zoom must not leave old labels/snapshots behind.
    await page.evaluate(() => { atlasApp.zoomBy(1.1, undefined, undefined, false); atlasApp.jumpToYear(741); });
    await settled(page);
    await page.waitForFunction(() => atlasApp.lastRenderedSnap === atlasApp.snapshots[atlasApp.activeSnapKey]);
    assert.equal(await page.evaluate(() => atlasApp.year), 741);
    await page.evaluate(() => atlasApp._ensureEnglishLocale());
    for (const locale of ['en', 'zh-tw', 'zh']) {
      await page.evaluate(locale => { atlasApp.locale = locale; atlasApp.applyLocale(); }, locale);
      await settled(page);
      assert(await page.locator('.polity-caption').count() > 0);
    }
    await page.evaluate(() => { atlasApp.jumpToYear(1415); atlasApp.resetCamera(); });
    await settled(page);
    assert(Math.abs(await page.evaluate(() => atlasApp.camera.w) - initial.camera.w) < 0.05);

    // Click a visible city using its actual screen position; verify geographic targeting.
    const city = await page.evaluate(() => {
      const svg = atlasApp.svg.getBoundingClientRect();
      for (const n of document.querySelectorAll('.settlement-node')) {
        const name = n.querySelector('.name'); if (!name) continue;
        const r = name.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (r.width && x > svg.left + 80 && x < svg.right - 80 && y > svg.top + 120 && y < svg.bottom - 180 && document.elementFromPoint(x, y)?.closest('.settlement-node') === n) {
          return { x, y, lng: +n.dataset.lng, lat: +n.dataset.lat };
        }
      }
    });
    assert(city, 'No visible city available for click test');
    await page.mouse.click(city.x, city.y);
    await page.waitForFunction(() => atlasApp.activeTrace !== null);
    const trace = await page.evaluate(() => atlasApp.activeTrace);
    assert(Math.hypot(trace[0] - city.lng, trace[1] - city.lat) < 0.001, 'City click drifted');
    await page.evaluate(() => atlasApp.closeGenealogyCard());
    await settled(page);
    if (output) {
      fs.mkdirSync(output, { recursive: true });
      await page.screenshot({ path: path.join(output, 'desktop-rest.png') });
    }
    await context.close();

    // Native multi-touch pinch, portrait resize, and person-pin typography on mobile.
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const mp = await mobile.newPage();
    await load(mp, '?person=sushi');
    const mb = await mp.locator('#atlas-svg').boundingBox();
    const mx = mb.x + mb.width / 2, my = mb.y + mb.height * 0.4;
    const beforePinch = await mp.evaluate(() => atlasApp.camera.w);
    const cdp = await mobile.newCDPSession(mp);
    const points = d => [{ x: mx - d, y: my, id: 1 }, { x: mx + d, y: my, id: 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(35) });
    for (const d of [45, 55, 65]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(d) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await settled(mp);
    assert(await mp.evaluate(() => atlasApp.camera.w) < beforePinch, 'Pinch did not zoom');
    assert.equal(await mp.evaluate(() => atlasApp.activePointers.size), 0);
    assert(await mp.evaluate(() => atlasApp.camera.w === atlasApp._lastTypographyWidth));
    assert(await mp.locator('.journey-node').count() > 0);
    await mp.setViewportSize({ width: 844, height: 390 });
    await mp.evaluate(() => atlasApp.zoomBy(1.1, undefined, undefined, false));
    await settled(mp);
    assert(await mp.evaluate(() => !atlasApp.svg.classList.contains('is-camera-moving')));
    if (output) await mp.screenshot({ path: path.join(output, 'mobile-route.png') });
    await mobile.close();
    assert.deepEqual(errors, [], 'Browser errors');
    console.log('Camera browser checks passed: wheel anchor/batching, settle/halos, pointerup/cancel, hover, resize, snapshot/languages, reset/city hit, mobile pinch/person pins.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
