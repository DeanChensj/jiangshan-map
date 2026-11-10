'use strict';

const assert = require('assert');

// Drives the real _fadePolityChanges with minimal path stand-ins; how the blend looks is a browser check.
function runPolityTransitionChecks({ ControllerClass, sandbox }) {
  const makeShape = (d) => {
    const el = {
      attrs: { d, fill: '#b5452f', class: 'polity-shape main' },
      style: {},
      animations: [],
      getAttribute: (k) => el.attrs[k] ?? null,
      setAttribute: (k, v) => (el.attrs[k] = v),
      animate: (keyframes) => {
        const animation = { keyframes };
        el.animations.push(animation);
        return animation;
      },
      remove: () => group.children.splice(group.children.indexOf(el), 1),
    };
    return el;
  };
  const group = {
    children: [],
    animate() {},
    get firstChild() {
      return this.children[0] || null;
    },
    insertBefore(el, ref) {
      this.children.splice(ref ? this.children.indexOf(ref) : this.children.length, 0, el);
    },
  };
  const fade = (prev, next, state = {}) => {
    group.children = next.slice();
    Object.assign(Object.create(ControllerClass.prototype), state)._fadePolityChanges(prev, next, group);
  };
  const previousMatchMedia = sandbox.window.matchMedia;
  let reduced = false;
  sandbox.window.matchMedia = () => ({ matches: reduced });
  try {
    const A = 'M10 10H110V80H10Z';
    const B = 'M40 10H140V80H40Z';
    const C = 'M60 10H160V80H60Z';

    const kept = makeShape(C);
    const grown = makeShape(B);
    const before = makeShape(A);
    fade([before, makeShape(C)], [grown, kept]);
    const opacity = (el) => [...el.animations[0].keyframes.opacity];
    assert.deepStrictEqual(opacity(grown), [0, 1], 'A changed polity must fade in');
    assert.deepStrictEqual(opacity(before), [1, 0.6, 0], 'Its previous fill fades out above linear so the overlap keeps its tint');
    assert.strictEqual(kept.animations.length, 0, 'An unchanged polity must stay still');
    assert.deepStrictEqual(group.children, [before, grown, kept], 'The outgoing shape sits beneath the new ones');
    assert.strictEqual(before.attrs['aria-hidden'], 'true', 'The outgoing shape is skipped by the next render');
    assert.strictEqual(before.style.pointerEvents, 'none');
    before.animations[0].onfinish();
    assert.deepStrictEqual(group.children, [grown, kept], 'The outgoing shape is removed once faded');

    const scrubbed = makeShape(B);
    fade([makeShape(A)], [scrubbed], { isScrubbing: true });
    assert.strictEqual(scrubbed.animations.length, 0, 'Dragging the timeline must skip the fade');

    reduced = true;
    const still = makeShape(B);
    fade([makeShape(A)], [still]);
    assert.strictEqual(still.animations.length, 0, 'Reduced motion must skip the fade');
    assert.deepStrictEqual(group.children, [still]);
  } finally {
    if (previousMatchMedia === undefined) delete sandbox.window.matchMedia;
    else sandbox.window.matchMedia = previousMatchMedia;
  }
}

module.exports = { runPolityTransitionChecks };
