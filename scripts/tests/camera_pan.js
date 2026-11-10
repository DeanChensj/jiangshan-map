'use strict';

const assert = require('assert');

// Steps the real _animateCameraTo on a hand-driven frame clock.
function runCameraPanChecks({ ControllerClass, sandbox }) {
  const saved = ['performance', 'requestAnimationFrame', 'cancelAnimationFrame'].map((k) => [k, sandbox[k]]);
  let now = 0;
  let pending = null;
  sandbox.performance = { now: () => now };
  sandbox.requestAnimationFrame = (cb) => ((pending = cb), 1);
  sandbox.cancelAnimationFrame = () => {};
  const fly = (target, opts) => {
    const ctrl = Object.create(ControllerClass.prototype);
    Object.assign(ctrl, {
      camera: { x: 350, y: 215, w: 500, h: 420, zoom: 2 },
      _prefetchTerrainForTarget() {},
      _applyCamera() {},
    });
    now = 0;
    ctrl._animateCameraTo(target, opts);
    // Camera x at a given time, as a 0..1 share of the whole move.
    const shareAt = (ms) => {
      now = ms;
      pending(now);
      return (ctrl.camera.x - 350) / (target.x - 350);
    };
    return { ctrl, shareAt };
  };
  try {
    // Default view to the far west: 0.76 viewport widths away.
    const far = fly({ x: -20, y: 120, w: 500, h: 420 });
    assert(far.ctrl._longPanMs > 850 && far.ctrl._longPanMs < 950, 'A long pan is given more time, scaled by distance');
    assert(far.shareAt(65) < 0.05, 'A long pan eases in instead of starting at full speed');
    assert(far.shareAt(650) < 1, 'A long pan is still under way when a short one would have landed');
    assert.strictEqual(far.shareAt(far.ctrl._longPanMs), 1);
    assert.strictEqual(far.ctrl.flyRaf, null);

    const near = fly({ x: 230, y: 215, w: 500, h: 420 });
    assert.strictEqual(near.ctrl._longPanMs, 0);
    assert(near.shareAt(65) > 0.25, 'A short pan keeps its immediate start');
    assert.strictEqual(near.shareAt(650), 1, 'A short pan keeps its duration');

    const zoom = fly({ x: -20, y: 120, w: 500, h: 420 }, { duration: 120, zoomInput: true });
    assert.strictEqual(zoom.ctrl._longPanMs, 0);
    assert.strictEqual(zoom.shareAt(120), 1, 'Zoom input is never slowed down');
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete sandbox[k];
      else sandbox[k] = v;
    }
  }
}

module.exports = { runCameraPanChecks };
