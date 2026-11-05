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
    assert(Math.abs(burst.nextWidth - Math.max(100, burst.width * Math.exp(-120 * 0.002))) < 1e-7);
    assert(Math.hypot(...burst.before.map((n, i) => n - burst.after[i])) < 1e-7, `Wheel anchor drifted: ${JSON.stringify(burst)}`);
    await page.waitForFunction(() => cameraChecks.apply === 1);
    // Merged main keeps text scale current in the coalesced zoom frame.
    assert.equal(await page.evaluate(() => cameraChecks.typography), 1);
    assert(await page.evaluate(() => Math.abs(atlasApp.camera.w - atlasApp._lastTypographyWidth) < 0.05));
    await settled(page);
    assert.equal(await page.evaluate(() => cameraChecks.typography), 1, 'Settling must not repeat current typography');
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
    // Preserve the existing wheel units, speed and per-event clamp. Native
    // ctrl+wheel pinch keeps its full scale, regardless of event grouping.
    const resetPose = async () => {
      await page.evaluate(() => {
        const a = atlasApp;
        a._cancelCameraAnimation();
        a.camera = { x: 0, y: 0, w: 1000, h: 700, zoom: 1 };
        a._applyCamera(true);
      });
      await settled(page);
    };
    const pinchDelta = -100 * Math.log(2);
    for (const [count, deltaY, deltaMode, ctrlKey, expected] of [
      [1, -100, 0, false, 1000 * Math.exp(-0.2)],
      [4, -25, 0, false, 1000 * Math.exp(-0.2)],
      [40, -2.5, 0, false, 1000 * Math.exp(-0.2)],
      [1, -3, 1, false, 1000 * Math.exp(-0.108)],
      [1, -100 / 240, 2, false, 1000 * Math.exp(-0.2)],
      [1, -440, 0, false, 1000 * Math.exp(-0.44)],
      [2, -220, 0, false, 1000 * Math.exp(-0.88)],
      [1, -20, 1, false, 1000 * Math.exp(-0.44)],
      [1, -2, 2, false, 1000 * Math.exp(-0.44)],
      [1, pinchDelta, 0, true, 500],
      [4, pinchDelta / 4, 0, true, 500],
      [40, pinchDelta / 40, 0, true, 500],
      [1, -100 * Math.log(10), 0, true, 100],
    ]) {
      await resetPose();
      const result = await page.evaluate(({ count, deltaY, deltaMode, ctrlKey, x, y }) => {
        const a = atlasApp, anchor = a._clientToSvgPoint(x, y);
        for (let i = 0; i < count; i++) a.svg.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY, deltaMode, ctrlKey,
        }));
        return { w: a.camera.w, before: anchor, after: a._clientToSvgPoint(x, y) };
      }, { count, deltaY, deltaMode, ctrlKey, x: Math.round(x), y: Math.round(y) });
      assert(Math.abs(result.w - expected) < 1e-7, 'Wheel/pinch mapping changed');
      assert(Math.hypot(...result.before.map((v, i) => v - result.after[i])) < 1e-7, 'Large wheel event moved the cursor anchor');
      await settled(page);
    }
    // High-resolution wheels retain sub-notch precision and reverse exactly.
    await resetPose();
    const fractional = await page.evaluate(({ x, y }) => {
      const send = deltaY => atlasApp.svg.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY,
      }));
      send(-0.5);
      const halfway = atlasApp.camera.w;
      send(0.5);
      return { halfway, final: atlasApp.camera.w };
    }, { x: Math.round(x), y: Math.round(y) });
    assert(Math.abs(fractional.halfway - 1000 * Math.exp(-0.001)) < 1e-7);
    assert(Math.abs(fractional.final - 1000) < 1e-7);
    await settled(page);
    // Repeated clamped wheel inputs reach the bounds and reverse normally.
    for (const [count, deltaY, expected] of [[20, -1e6, 100], [20, 1e6, 1300], [1, -100, 1300 * Math.exp(-0.2)]]) {
      await page.evaluate(({ count, deltaY, x, y }) => {
        for (let i = 0; i < count; i++) atlasApp.svg.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY,
        }));
      }, { count, deltaY, x: Math.round(x), y: Math.round(y) });
      await settled(page);
      assert(Math.abs(await page.evaluate(() => atlasApp.camera.w) - expected) < 1e-7);
      assert(await page.evaluate(() => Object.values(atlasApp.camera).every(Number.isFinite)));
    }
    // Real rapid keys preserve every increment, including reversed direction.
    await resetPose();
    for (let i = 0; i < 3; i++) await page.keyboard.press('+');
    await settled(page);
    assert(Math.abs(await page.evaluate(() => atlasApp.camera.w) - 1000 / 1.35 ** 3) < 1e-7);
    for (let i = 0; i < 3; i++) await page.keyboard.press('-');
    await settled(page);
    assert(Math.abs(await page.evaluate(() => atlasApp.camera.w) - 1000) < 1e-7);
    // Accumulated zoom preserves a non-central anchor in a letterboxed SVG.
    await resetPose();
    const anchorPoint = { x: Math.round(x - 80), y: Math.round(y - 40) };
    const anchored = await page.evaluate(({ x, y }) => {
      const a = atlasApp, before = a._clientToSvgPoint(x, y);
      for (let i = 0; i < 3; i++) a.zoomBy(1.35, x, y);
      return before;
    }, anchorPoint);
    await settled(page);
    const afterAnchor = await page.evaluate(({ x, y }) => atlasApp._clientToSvgPoint(x, y), anchorPoint);
    assert(Math.hypot(...anchored.map((v, i) => v - afterAnchor[i])) < 1e-7);
    // Manual input takes ownership from navigation; subsequent frames must
    // never restore the interrupted flight's old destination.
    for (const input of ['wheel', 'direct', 'pointer']) {
      await resetPose();
      await page.evaluate(() => atlasApp._animateCameraTo({ x: 200, y: 140, w: 500, h: 350 }));
      // Let the flight enter its moving state before interrupting it. A click
      // without a drag must still run the cleanup normally done at flight end.
      await page.waitForFunction(() => atlasApp.flyRaf !== null && atlasApp.svg.classList.contains('is-camera-moving'));
      if (input === 'pointer') {
        await page.mouse.move(x, y);await page.mouse.down();
      } else if (input === 'direct') {
        await page.evaluate(() => atlasApp.zoomBy(1.1, undefined, undefined, false));
      } else {
        await page.mouse.move(x, y);await page.mouse.wheel(0, -160);
        await page.waitForFunction(() => atlasApp.flyRaf === null);
      }
      assert(await page.evaluate(() => atlasApp.flyRaf === null && atlasApp._cameraTarget === null));
      const width = await page.evaluate(() => atlasApp.camera.w);
      if (input === 'pointer') await page.mouse.up();
      await page.waitForTimeout(180);await settled(page);
      assert.equal(await page.evaluate(() => atlasApp.camera.w), width, `${input} was overwritten by a stale flight`);
      const restored = await page.evaluate(() => {
        const a = atlasApp;
        return {
          moving: a.svg.classList.contains('is-camera-moving') || a.viewportFrame.classList.contains('is-camera-moving'),
          prefectureEvents: getComputedStyle(a.svg.querySelector('.prefecture-shape')).pointerEvents,
          casingDisplay: getComputedStyle(a.svg.querySelector('.province-boundary-casing')).display,
          typographyWidth: a._lastTypographyWidth,
        };
      });
      assert(!restored.moving, `${input} left the map stuck in its moving state`);
      assert.notEqual(restored.prefectureEvents, 'none', `${input} left prefecture hover disabled`);
      assert.notEqual(restored.casingDisplay, 'none', `${input} left boundary casings hidden`);
      assert(Math.abs(restored.typographyWidth - width) < 0.05, `${input} left label scaling stale`);
      await page.evaluate(() => { cameraChecks.hit = 0; });
      await page.mouse.move(x + 7, y + 7);
      await page.waitForFunction(() => cameraChecks.hit > 0);
    }
    // Keys interrupt navigation from the visible camera, rather than adding
    // their zoom to an unrelated navigation destination.
    await resetPose();
    const manualTarget = await page.evaluate(() => {
      const a = atlasApp;
      a._animateCameraTo({ x: 200, y: 140, w: 500, h: 350 });
      a.zoomBy(1.35);
      return a._cameraTarget.w;
    });
    assert(Math.abs(manualTarget - 1000 / 1.35) < 1e-7);
    await settled(page);
    assert(Math.abs(await page.evaluate(() => atlasApp.camera.w) - manualTarget) < 1e-7);
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
    await mp.evaluate(() => atlasApp._animateCameraTo({ ...atlasApp.camera, x: 100, y: 100 }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(35) });
    assert(await mp.evaluate(() => atlasApp.flyRaf === null && atlasApp._cameraTarget === null), 'Touch must interrupt navigation');
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
    console.log('Camera browser checks passed: wheel distance/units/bounds/anchoring, accumulated keys, interrupted flights, batching, settle/halos, pointerup/cancel, hover, resize, snapshot/languages, reset/city hit, mobile pinch/person pins.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
