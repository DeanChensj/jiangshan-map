// Zero-dependency checks for the ingestion Worker: node workers/stats/test.js
import assert from 'node:assert';
import worker from './src/index.js';

const points = [];
const env = { CLICKS: { writeDataPoint: (p) => points.push(p) } };

const BATCH = {
  v: 1,
  l: 'en',
  w: 'm',
  ev: [
    ['btn', 'act-music', 3],
    ['feat', 'story:anshi', 1],
    ['btn', 'bad name!', 1],
    ['evil', 'x', 1],
    ['feat', 'quiz_start', 99999],
  ],
};

function post({ path = '/e', method = 'POST', headers = { Origin: 'https://deanchen.me' }, body = JSON.stringify(BATCH) } = {}) {
  return worker.fetch(
    new Request('https://stats.deanchen.me' + path, {
      method,
      headers,
      body: method === 'POST' ? body : undefined,
    }),
    env
  );
}

assert.strictEqual((await post()).status, 204);
assert.strictEqual(points.length, 3, 'malformed names and unknown kinds are dropped');
assert.deepStrictEqual(points[0], {
  indexes: ['act-music'],
  blobs: ['btn', 'act-music', 'en', 'm', 'XX'],
  doubles: [3],
});
assert.deepStrictEqual(points[2].doubles, [200], 'one event is capped at 200');

points.length = 0;
assert.strictEqual((await post({ headers: { Referer: 'http://deanchen.me/jiangshan-map/?year=741' } })).status, 204);
assert.strictEqual(points.length, 3, 'a missing Origin falls back to the Referer origin');

points.length = 0;
assert.strictEqual((await post({ headers: { Origin: 'https://evil.example' } })).status, 403);
assert.strictEqual((await post({ headers: { Origin: 'https://evil.example', Referer: 'https://deanchen.me/' } })).status, 403);
assert.strictEqual((await post({ headers: {} })).status, 403);
assert.strictEqual((await post({ method: 'GET' })).status, 404);
assert.strictEqual((await post({ path: '/' })).status, 404);
assert.strictEqual((await post({ body: 'not json' })).status, 400);
assert.strictEqual((await post({ body: JSON.stringify({ v: 2, ev: [] }) })).status, 400);
assert.strictEqual((await post({ body: 'x'.repeat(5000) })).status, 413);
assert.strictEqual(points.length, 0, 'rejected requests write nothing');

console.log('✓ stats Worker: accepts valid batches, rejects foreign origins and malformed input');
