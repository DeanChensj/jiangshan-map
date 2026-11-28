/**
 * Jiangshan Atlas & Blog lightweight guestbook + errata feedback Worker (Cloudflare Worker + D1).
 *
 * Public endpoints:
 *   GET  /messages        — Returns approved public comments only (never private feedback, contacts, or IP hashes).
 *   POST /messages        — Stores a pending public comment or private errata feedback from allowed origins.
 *   GET  /admin           — Serves the self-contained moderation UI (contains zero embedded data).
 *
 * Admin endpoints (Authorization: Bearer <ADMIN_TOKEN>):
 *   GET   /admin/messages     — Lists messages with counts by status/kind.
 *   PATCH /admin/messages/:id — Moderates status or sets an author reply (private feedback cannot become approved).
 */
import { ADMIN_HTML } from './admin_html.js';

const BASE_ALLOWED_ORIGINS = [
  'https://deanchen.me',
  'http://deanchen.me',
  'https://www.deanchen.me',
  'http://www.deanchen.me',
];

const SITES = new Set(['jiangshan', 'blog']);
const KINDS = new Set(['comment', 'feedback']);
const LANGS = new Set(['zh', 'zh-tw', 'en']);
const STATUSES = new Set(['pending', 'approved', 'resolved', 'rejected']);
const PAGE_KEY_RE = /^[a-z0-9/_-]{1,120}$/i;

const MAX_BODY_BYTES = 4096;
const MAX_AUTHOR = 30;
const MAX_CONTACT = 100;
const MIN_CONTENT = 2;
const MAX_CONTENT = 1000;
const MAX_CONTEXT = 200;
const MAX_REPLY = 1000;
const RATE_LIMIT_SECONDS = 60;

function getAllowedOrigins(env) {
  const set = new Set(BASE_ALLOWED_ORIGINS);
  if (env && typeof env.EXTRA_ALLOWED_ORIGINS === 'string') {
    for (const raw of env.EXTRA_ALLOWED_ORIGINS.split(',')) {
      const origin = raw.trim();
      if (origin) set.add(origin);
    }
  }
  return set;
}

function senderOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin) return origin;
  try {
    return new URL(request.headers.get('Referer') || '').origin;
  } catch (_) {
    return '';
  }
}

function corsHeaders(origin, allowedOrigin) {
  const headers = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (allowedOrigin && origin === allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }
  return headers;
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] || 0) ^ (bb[i] || 0);
  }
  return diff === 0;
}

function isAuthorized(request, env) {
  const expected = env && typeof env.ADMIN_TOKEN === 'string' ? env.ADMIN_TOKEN : '';
  if (!expected) return { ok: false, status: 503, error: 'admin_not_configured' };
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return { ok: false, status: 401, error: 'unauthorized' };
  const provided = auth.slice(7).trim();
  if (!provided || !timingSafeEqual(provided, expected)) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }
  return { ok: true };
}

async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(String(salt || '') + '|' + ip);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function nowIsoUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function parsePositiveInt(raw, fallback, maxVal) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return maxVal ? Math.min(n, maxVal) : n;
}

async function notifyNewMessage(env, record) {
  const kindLabel = record.kind === 'feedback' ? '私密勘误' : '公开留言';
  const summaryLines = [
    `[江山时序] 收到新${kindLabel} (#${record.id})`,
    `站点/页面: ${record.site}/${record.page_key} (${record.lang})`,
    `昵称: ${record.author || '匿名访客'}`,
    record.context ? `视图上下文: ${record.context}` : '',
    record.contact ? `联系方式: ${record.contact}` : '',
    `内容:\n${record.content}`,
    `审核地址: https://feedback.deanchen.me/admin`,
  ].filter(Boolean);
  const textBody = summaryLines.join('\n');

  const tasks = [];

  if (env.NOTIFY_WEBHOOK_URL) {
    tasks.push(
      fetch(env.NOTIFY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textBody,
          msg_type: 'text',
          content: { text: textBody },
          record: {
            id: record.id,
            site: record.site,
            page_key: record.page_key,
            kind: record.kind,
            lang: record.lang,
            author: record.author,
            context: record.context,
            created_at: record.created_at,
          },
        }),
      }).catch(() => {})
    );
  }

  if (env.RESEND_API_KEY && env.NOTIFY_EMAIL_TO) {
    tasks.push(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.NOTIFY_EMAIL_FROM || 'feedback@deanchen.me',
          to: [env.NOTIFY_EMAIL_TO],
          subject: `[江山时序] 新${kindLabel} #${record.id} - ${record.author || '匿名访客'}`,
          text: textBody,
        }),
      }).catch(() => {})
    );
  }

  if (tasks.length) {
    await Promise.all(tasks);
  }
}

async function handlePublicGet(request, env, url, cors) {
  const site = url.searchParams.get('site') || 'jiangshan';
  const page = url.searchParams.get('page') || 'guestbook';
  if (!SITES.has(site)) return jsonResponse({ ok: false, error: 'invalid_site' }, 400, cors);
  if (!PAGE_KEY_RE.test(page)) return jsonResponse({ ok: false, error: 'invalid_page' }, 400, cors);

  const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 50);
  if (limit === null) return jsonResponse({ ok: false, error: 'invalid_limit' }, 400, cors);

  const beforeParam = url.searchParams.get('before');
  const before = beforeParam ? parsePositiveInt(beforeParam, null) : null;
  if (beforeParam && before === null) {
    return jsonResponse({ ok: false, error: 'invalid_before' }, 400, cors);
  }

  const sql = before
    ? `SELECT id, site, page_key, lang, author, content, reply, replied_at, created_at
       FROM messages
       WHERE site = ? AND page_key = ? AND kind = 'comment' AND status = 'approved' AND id < ?
       ORDER BY id DESC LIMIT ?`
    : `SELECT id, site, page_key, lang, author, content, reply, replied_at, created_at
       FROM messages
       WHERE site = ? AND page_key = ? AND kind = 'comment' AND status = 'approved'
       ORDER BY id DESC LIMIT ?`;

  const bindings = before ? [site, page, before, limit + 1] : [site, page, limit + 1];
  const res = await env.DB.prepare(sql).bind(...bindings).all();
  const rows = (res && res.results) || [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return jsonResponse(
    { ok: true, items, hasMore },
    200,
    {
      ...cors,
      'Cache-Control': 'public, max-age=30',
    }
  );
}

async function handlePublicPost(request, env, ctx, allowedOrigins, cors) {
  const origin = senderOrigin(request);
  if (!allowedOrigins.has(origin)) {
    return jsonResponse({ ok: false, error: 'forbidden_origin' }, 403, cors);
  }

  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: 'payload_too_large' }, 413, cors);
  }

  let body;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, error: 'payload_too_large' }, 413, cors);
    }
    body = JSON.parse(raw);
  } catch (_) {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400, cors);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ ok: false, error: 'invalid_body' }, 400, cors);
  }

  // Silent honeypot drop: bots filling hidden "website" field get a fake 201 without DB write.
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return jsonResponse({ ok: true, id: 0, status: 'pending' }, 201, cors);
  }

  const site = body.site === undefined ? 'jiangshan' : String(body.site);
  const page = body.page === undefined ? 'guestbook' : normalizeText(String(body.page));
  const kind = body.kind === undefined ? 'comment' : String(body.kind);
  const lang = body.lang === undefined ? 'zh' : String(body.lang);

  if (!SITES.has(site)) return jsonResponse({ ok: false, error: 'invalid_site' }, 400, cors);
  if (!PAGE_KEY_RE.test(page)) return jsonResponse({ ok: false, error: 'invalid_page' }, 400, cors);
  if (!KINDS.has(kind)) return jsonResponse({ ok: false, error: 'invalid_kind' }, 400, cors);
  if (!LANGS.has(lang)) return jsonResponse({ ok: false, error: 'invalid_lang' }, 400, cors);

  const author = normalizeText(body.author === undefined ? '' : body.author);
  if (author.length > MAX_AUTHOR) {
    return jsonResponse({ ok: false, error: 'author_too_long' }, 400, cors);
  }

  const contact = normalizeText(body.contact === undefined ? '' : body.contact);
  if (contact.length > MAX_CONTACT) {
    return jsonResponse({ ok: false, error: 'contact_too_long' }, 400, cors);
  }

  const contextRaw =
    body.context && typeof body.context === 'object' && !Array.isArray(body.context)
      ? JSON.stringify(body.context)
      : body.context === undefined
        ? ''
        : body.context;
  const context = normalizeText(contextRaw);
  if (context.length > MAX_CONTEXT) {
    return jsonResponse({ ok: false, error: 'context_too_long' }, 400, cors);
  }

  const content = normalizeText(body.content);
  if (content.length < MIN_CONTENT || content.length > MAX_CONTENT) {
    return jsonResponse({ ok: false, error: 'invalid_content_length' }, 400, cors);
  }

  const ipHeader =
    request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim();
  const ipHash = ipHeader ? await hashIp(ipHeader, env.IP_SALT || '') : '';

  if (ipHash) {
    const latest = await env.DB.prepare(
      'SELECT created_at FROM messages WHERE ip_hash = ? ORDER BY id DESC LIMIT 1'
    )
      .bind(ipHash)
      .first();
    if (latest && latest.created_at) {
      const elapsedMs = Date.now() - Date.parse(latest.created_at);
      if (Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < RATE_LIMIT_SECONDS * 1000) {
        return jsonResponse({ ok: false, error: 'rate_limited' }, 429, cors);
      }
    }
  }

  const country = (request.cf && request.cf.country) || 'XX';
  const createdAt = nowIsoUtc();

  const insertRes = await env.DB.prepare(
    `INSERT INTO messages
     (site, page_key, kind, lang, author, contact, content, context, status, reply, replied_at, ip_hash, country, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', '', ?, ?, ?)`
  )
    .bind(site, page, kind, lang, author, contact, content, context, ipHash, country, createdAt)
    .run();

  const insertedId = (insertRes && insertRes.meta && insertRes.meta.last_row_id) || 0;
  const record = {
    id: insertedId,
    site,
    page_key: page,
    kind,
    lang,
    author,
    contact,
    content,
    context,
    created_at: createdAt,
  };

  if (env.NOTIFY_WEBHOOK_URL || (env.RESEND_API_KEY && env.NOTIFY_EMAIL_TO)) {
    const notifyPromise = notifyNewMessage(env, record);
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(notifyPromise);
    } else {
      await notifyPromise;
    }
  }

  return jsonResponse({ ok: true, id: insertedId, status: 'pending' }, 201, cors);
}

async function handleAdminGet(request, env, url, cors) {
  const auth = isAuthorized(request, env);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, cors);

  const status = url.searchParams.get('status');
  const kind = url.searchParams.get('kind');
  const site = url.searchParams.get('site');

  if (status && !STATUSES.has(status)) {
    return jsonResponse({ ok: false, error: 'invalid_status' }, 400, cors);
  }
  if (kind && !KINDS.has(kind)) {
    return jsonResponse({ ok: false, error: 'invalid_kind' }, 400, cors);
  }
  if (site && !SITES.has(site)) {
    return jsonResponse({ ok: false, error: 'invalid_site' }, 400, cors);
  }

  const limit = parsePositiveInt(url.searchParams.get('limit'), 50, 100);
  if (limit === null) return jsonResponse({ ok: false, error: 'invalid_limit' }, 400, cors);

  const beforeParam = url.searchParams.get('before');
  const before = beforeParam ? parsePositiveInt(beforeParam, null) : null;
  if (beforeParam && before === null) {
    return jsonResponse({ ok: false, error: 'invalid_before' }, 400, cors);
  }

  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (kind) {
    where.push('kind = ?');
    params.push(kind);
  }
  if (site) {
    where.push('site = ?');
    params.push(site);
  }
  if (before) {
    where.push('id < ?');
    params.push(before);
  }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const listSql = `SELECT id, site, page_key, kind, lang, author, contact, content, context, status, reply, replied_at, country, created_at
                   FROM messages ${whereSql} ORDER BY id DESC LIMIT ?`;
  const listRes = await env.DB.prepare(listSql).bind(...params, limit).all();

  const countsRow = await env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN kind = 'comment' AND status = 'approved' THEN 1 ELSE 0 END) AS approved,
       SUM(CASE WHEN kind = 'feedback' THEN 1 ELSE 0 END) AS feedback,
       SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
     FROM messages`
  ).first();

  const counts = {
    total: Number((countsRow && countsRow.total) || 0),
    pending: Number((countsRow && countsRow.pending) || 0),
    approved: Number((countsRow && countsRow.approved) || 0),
    feedback: Number((countsRow && countsRow.feedback) || 0),
    rejected: Number((countsRow && countsRow.rejected) || 0),
  };

  return jsonResponse(
    { ok: true, items: (listRes && listRes.results) || [], counts },
    200,
    {
      ...cors,
      'Cache-Control': 'no-store',
    }
  );
}

async function handleAdminPatch(request, env, idRaw, cors) {
  const auth = isAuthorized(request, env);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, cors);

  const id = parsePositiveInt(idRaw, null);
  if (id === null) return jsonResponse({ ok: false, error: 'invalid_id' }, 400, cors);

  const existing = await env.DB.prepare(
    `SELECT id, site, page_key, kind, lang, author, contact, content, context, status, reply, replied_at, country, created_at
     FROM messages WHERE id = ?`
  )
    .bind(id)
    .first();

  if (!existing) {
    return jsonResponse({ ok: false, error: 'not_found' }, 404, cors);
  }

  let body;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, error: 'payload_too_large' }, 413, cors);
    }
    body = JSON.parse(raw);
  } catch (_) {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400, cors);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ ok: false, error: 'invalid_body' }, 400, cors);
  }

  let nextStatus = existing.status;
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !STATUSES.has(body.status)) {
      return jsonResponse({ ok: false, error: 'invalid_status' }, 400, cors);
    }
    nextStatus = body.status;
  }

  // Privacy guardrail: private feedback items must never transition to public approved status.
  if (existing.kind === 'feedback' && nextStatus === 'approved') {
    return jsonResponse({ ok: false, error: 'feedback_cannot_be_public' }, 400, cors);
  }

  let nextReply = existing.reply || '';
  let nextRepliedAt = existing.replied_at || '';
  if (body.reply !== undefined) {
    if (typeof body.reply !== 'string') {
      return jsonResponse({ ok: false, error: 'invalid_reply' }, 400, cors);
    }
    const cleaned = normalizeText(body.reply);
    if (cleaned.length > MAX_REPLY) {
      return jsonResponse({ ok: false, error: 'reply_too_long' }, 400, cors);
    }
    nextReply = cleaned;
    nextRepliedAt = cleaned ? nowIsoUtc() : '';
  }

  await env.DB.prepare(
    'UPDATE messages SET status = ?, reply = ?, replied_at = ? WHERE id = ?'
  )
    .bind(nextStatus, nextReply, nextRepliedAt, id)
    .run();

  const updated = {
    ...existing,
    status: nextStatus,
    reply: nextReply,
    replied_at: nextRepliedAt,
  };

  return jsonResponse(
    { ok: true, item: updated },
    200,
    {
      ...cors,
      'Cache-Control': 'no-store',
    }
  );
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = getAllowedOrigins(env);
    const isAdminApi = url.pathname === '/admin/messages' || url.pathname.startsWith('/admin/messages/');
    const matchedOrigin = allowedOrigins.has(origin)
      ? origin
      : isAdminApi && origin === url.origin
        ? origin
        : '';
    const cors = corsHeaders(origin, matchedOrigin);

    if (request.method === 'OPTIONS') {
      if (!matchedOrigin) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method === 'GET' && url.pathname === '/admin') {
      return new Response(ADMIN_HTML, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex',
        },
      });
    }

    if (url.pathname === '/messages') {
      if (request.method === 'GET') return handlePublicGet(request, env, url, cors);
      if (request.method === 'POST') return handlePublicPost(request, env, ctx, allowedOrigins, cors);
      return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, cors);
    }

    if (url.pathname === '/admin/messages') {
      if (request.method === 'GET') return handleAdminGet(request, env, url, cors);
      return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, cors);
    }

    if (url.pathname.startsWith('/admin/messages/')) {
      const idPart = url.pathname.slice('/admin/messages/'.length);
      if (request.method === 'PATCH' && idPart && !idPart.includes('/')) {
        return handleAdminPatch(request, env, idPart, cors);
      }
      return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, cors);
    }

    return new Response(null, { status: 404 });
  },
};
