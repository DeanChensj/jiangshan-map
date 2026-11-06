'use strict';
/**
 * Small raster helpers for topology checks (zero dependencies). Masks are Uint8Array grids with
 * one byte per cell; cell (i, j) covers [x0 + i·res, x0 + (i+1)·res) × (y1 - (j+1)·res, y1 - j·res].
 */

function makeGrid(bbox, res) {
  const [x0, y0, x1, y1] = bbox;
  const w = Math.max(1, Math.ceil((x1 - x0) / res));
  const h = Math.max(1, Math.ceil((y1 - y0) / res));
  return { x0, y1, res, w, h };
}

/** Fills the cells whose centers lie inside the polygons (even-odd over all rings) with `value`. */
function rasterize(grid, polygons, mask = new Uint8Array(grid.w * grid.h), value = 1) {
  const { x0, y1, res, w, h } = grid;
  const rows = Array.from({ length: h }, () => []);
  for (const rings of polygons) {
    for (const ring of rings) {
      for (let i = 0, n = ring.length; i < n - 1; i++) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[i + 1];
        if (ay === by) continue;
        // Rows whose center line y = y1 - (j + 0.5)·res crosses the edge (half-open in y).
        const lo = Math.min(ay, by);
        const hi = Math.max(ay, by);
        const jFrom = Math.max(0, Math.ceil((y1 - hi) / res - 0.5));
        const jTo = Math.min(h - 1, Math.floor((y1 - lo) / res - 0.5));
        for (let j = jFrom; j <= jTo; j++) {
          const y = y1 - (j + 0.5) * res;
          if (y < lo || y >= hi) continue;
          rows[j].push(ax + ((y - ay) * (bx - ax)) / (by - ay));
        }
      }
    }
  }
  for (let j = 0; j < h; j++) {
    const xs = rows[j].sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const iFrom = Math.max(0, Math.ceil((xs[k] - x0) / res - 0.5));
      const iTo = Math.min(w - 1, Math.floor((xs[k + 1] - x0) / res - 0.5));
      for (let i = iFrom; i <= iTo; i++) mask[j * w + i] = value;
    }
  }
  return mask;
}

/**
 * Square dilate (any set cell within radius r) or erode (all cells within radius r set) of a 0/1
 * mask, separable with running sums so the cost does not depend on r. Cells outside count as 0.
 */
function morph(mask, w, h, r, isMax) {
  if (r <= 0) return mask.slice();
  const win = 2 * r + 1;
  const pass = (src, len, count, stride, step) => {
    const dst = new Uint8Array(src.length);
    for (let line = 0; line < count; line++) {
      const base = line * stride;
      let sum = 0;
      for (let k = 0; k < Math.min(r, len); k++) sum += src[base + k * step];
      for (let k = 0; k < len; k++) {
        const add = k + r;
        const drop = k - r - 1;
        if (add < len) sum += src[base + add * step];
        if (drop >= 0) sum -= src[base + drop * step];
        dst[base + k * step] = isMax ? (sum > 0 ? 1 : 0) : sum === win ? 1 : 0;
      }
    }
    return dst;
  };
  const rowsDone = pass(mask, w, h, w, 1);
  return pass(rowsDone, h, w, 1, w);
}

const dilate = (mask, w, h, r) => morph(mask, w, h, r, true);
const erode = (mask, w, h, r) => morph(mask, w, h, r, false);

module.exports = { makeGrid, rasterize, dilate, erode };
