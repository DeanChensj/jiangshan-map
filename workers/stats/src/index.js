/**
 * Jiangshan Atlas click & feature counter (Cloudflare Worker + Workers Analytics Engine).
 *
 * Write-only ingestion endpoint: POST /e with a small JSON batch from js/atlas_track.js.
 * Nothing is readable through this Worker; counts are queried with the Analytics Engine
 * SQL API using an account API token. No cookies, no IP addresses, no free text are stored.
 */

const ALLOWED_ORIGINS = new Set([
  'https://deanchen.me',
  'http://deanchen.me',
  'https://www.deanchen.me',
  'http://www.deanchen.me',
]);
const KINDS = new Set(['btn', 'feat', 'entry']);
const NAME_RE = /^[a-z0-9_.:-]{1,48}$/i;
const LANGS = new Set(['zh', 'zh-tw', 'en']);
const WIDTHS = new Set(['d', 't', 'm']);
const MAX_BODY_BYTES = 4096;
const MAX_EVENTS = 60;
const MAX_COUNT_PER_EVENT = 200;

// Beacons are no-cors requests. Browsers attach Origin to cross-origin POSTs, but fall
// back to the Referer origin in case one omits it.
function senderOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin) return origin;
  try {
    return new URL(request.headers.get('Referer') || '').origin;
  } catch (_) {
    return '';
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/e') {
      return new Response(null, { status: 404 });
    }
    if (!ALLOWED_ORIGINS.has(senderOrigin(request))) {
      return new Response(null, { status: 403 });
    }
    if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) {
      return new Response(null, { status: 413 });
    }

    let body;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
      body = JSON.parse(text);
    } catch (_) {
      return new Response(null, { status: 400 });
    }
    if (!body || body.v !== 1 || !Array.isArray(body.ev)) {
      return new Response(null, { status: 400 });
    }

    const lang = LANGS.has(body.l) ? body.l : 'other';
    const width = WIDTHS.has(body.w) ? body.w : 'other';
    const country = (request.cf && request.cf.country) || 'XX';

    for (const item of body.ev.slice(0, MAX_EVENTS)) {
      if (!Array.isArray(item) || item.length !== 3) continue;
      const [kind, name, count] = item;
      if (!KINDS.has(kind) || typeof name !== 'string' || !NAME_RE.test(name)) continue;
      const n = Math.min(MAX_COUNT_PER_EVENT, Math.max(1, Math.floor(Number(count) || 1)));
      env.CLICKS.writeDataPoint({
        indexes: [name],
        blobs: [kind, name, lang, width, country],
        doubles: [n],
      });
    }
    return new Response(null, { status: 204 });
  },
};
