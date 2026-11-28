// Zero-dependency checks for the feedback Worker: node workers/feedback/test.js
import assert from 'node:assert';
import worker from './src/index.js';

function createMockD1() {
  const rows = [];
  let nextId = 1;

  function pick(row, cols) {
    const out = {};
    for (const c of cols) out[c] = row[c];
    return out;
  }

  return {
    rows,
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      let bindings = [];
      const stmt = {
        bind(...args) {
          bindings = args;
          return stmt;
        },
        async first() {
          if (normalized.startsWith('SELECT created_at FROM messages WHERE ip_hash = ?')) {
            const [ipHash] = bindings;
            const match = rows.filter((r) => r.ip_hash === ipHash).sort((a, b) => b.id - a.id)[0];
            return match ? { created_at: match.created_at } : null;
          }
          if (normalized.startsWith('SELECT COUNT(*) AS total')) {
            return {
              total: rows.length,
              pending: rows.filter((r) => r.status === 'pending').length,
              approved: rows.filter((r) => r.kind === 'comment' && r.status === 'approved').length,
              feedback: rows.filter((r) => r.kind === 'feedback').length,
              rejected: rows.filter((r) => r.status === 'rejected').length,
            };
          }
          if (normalized.includes('FROM messages WHERE id = ?')) {
            const [id] = bindings;
            const row = rows.find((r) => r.id === id);
            if (!row) return null;
            return pick(row, [
              'id',
              'site',
              'page_key',
              'kind',
              'lang',
              'author',
              'contact',
              'content',
              'context',
              'status',
              'reply',
              'replied_at',
              'country',
              'created_at',
            ]);
          }
          throw new Error('Unhandled first() SQL: ' + normalized);
        },
        async all() {
          if (normalized.includes("kind = 'comment' AND status = 'approved'")) {
            const hasBefore = normalized.includes('AND id < ?');
            const [site, pageKey] = bindings;
            const before = hasBefore ? bindings[2] : null;
            const limit = hasBefore ? bindings[3] : bindings[2];
            const filtered = rows
              .filter(
                (r) =>
                  r.site === site &&
                  r.page_key === pageKey &&
                  r.kind === 'comment' &&
                  r.status === 'approved' &&
                  (!hasBefore || r.id < before)
              )
              .sort((a, b) => b.id - a.id)
              .slice(0, limit)
              .map((r) =>
                pick(r, ['id', 'site', 'page_key', 'lang', 'author', 'content', 'reply', 'replied_at', 'created_at'])
              );
            return { results: filtered };
          }
          if (normalized.startsWith('SELECT id, site, page_key, kind, lang, author, contact')) {
            let idx = 0;
            const whereMatch = normalized.match(/WHERE (.+?) ORDER BY/);
            const clauses = whereMatch ? whereMatch[1].split(' AND ') : [];
            let filtered = rows.slice();
            for (const c of clauses) {
              const val = bindings[idx++];
              if (c === 'status = ?') filtered = filtered.filter((r) => r.status === val);
              else if (c === 'kind = ?') filtered = filtered.filter((r) => r.kind === val);
              else if (c === 'site = ?') filtered = filtered.filter((r) => r.site === val);
              else if (c === 'id < ?') filtered = filtered.filter((r) => r.id < val);
            }
            const limit = bindings[idx];
            const results = filtered
              .sort((a, b) => b.id - a.id)
              .slice(0, limit)
              .map((r) =>
                pick(r, [
                  'id',
                  'site',
                  'page_key',
                  'kind',
                  'lang',
                  'author',
                  'contact',
                  'content',
                  'context',
                  'status',
                  'reply',
                  'replied_at',
                  'country',
                  'created_at',
                ])
              );
            return { results };
          }
          throw new Error('Unhandled all() SQL: ' + normalized);
        },
        async run() {
          if (normalized.startsWith('INSERT INTO messages')) {
            const [site, page_key, kind, lang, author, contact, content, context, ip_hash, country, created_at] =
              bindings;
            const row = {
              id: nextId++,
              site,
              page_key,
              kind,
              lang,
              author,
              contact,
              content,
              context,
              status: 'pending',
              reply: '',
              replied_at: '',
              ip_hash,
              country,
              created_at,
            };
            rows.push(row);
            return { meta: { last_row_id: row.id } };
          }
          if (normalized.startsWith('UPDATE messages SET status = ?, reply = ?, replied_at = ? WHERE id = ?')) {
            const [status, reply, replied_at, id] = bindings;
            const row = rows.find((r) => r.id === id);
            if (row) {
              row.status = status;
              row.reply = reply;
              row.replied_at = replied_at;
            }
            return { meta: { changes: row ? 1 : 0 } };
          }
          throw new Error('Unhandled run() SQL: ' + normalized);
        },
      };
      return stmt;
    },
  };
}

const DB = createMockD1();
const env = {
  DB,
  ADMIN_TOKEN: 'secret-admin-token',
  IP_SALT: 'test-salt',
};

function call(path, { method = 'GET', headers = {}, body } = {}, customEnv = env, ctx = undefined) {
  return worker.fetch(
    new Request('https://feedback.deanchen.me' + path, {
      method,
      headers,
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }),
    customEnv,
    ctx
  );
}

// 1. Admin UI page contains no data, no emojis, valid inline JS, and noindex header
{
  const res = await call('/admin');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('X-Robots-Tag'), 'noindex');
  const html = await res.text();
  assert.ok(html.includes('ADMIN_TOKEN'));
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(html), 'admin HTML must contain no emojis');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, 'admin HTML includes inline script');
  new Function(scriptMatch[1]);
}

// 2. CORS preflight
{
  const okOpt = await call('/messages', {
    method: 'OPTIONS',
    headers: { Origin: 'https://deanchen.me' },
  });
  assert.strictEqual(okOpt.status, 204);
  assert.strictEqual(okOpt.headers.get('Access-Control-Allow-Origin'), 'https://deanchen.me');

  const badOpt = await call('/messages', {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example' },
  });
  assert.strictEqual(badOpt.status, 403);
}

// 3. Reject foreign origins, bad payloads, and honeypot bots
{
  const foreign = await call('/messages', {
    method: 'POST',
    headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    body: { content: 'hello world' },
  });
  assert.strictEqual(foreign.status, 403);

  const oversized = await call('/messages', {
    method: 'POST',
    headers: { Origin: 'https://deanchen.me', 'Content-Type': 'application/json' },
    body: 'x'.repeat(5000),
  });
  assert.strictEqual(oversized.status, 413);

  const tooShort = await call('/messages', {
    method: 'POST',
    headers: { Origin: 'https://deanchen.me', 'Content-Type': 'application/json' },
    body: { content: 'a' },
  });
  assert.strictEqual(tooShort.status, 400);

  const badLang = await call('/messages', {
    method: 'POST',
    headers: { Origin: 'https://deanchen.me', 'Content-Type': 'application/json' },
    body: { lang: 'fr', content: 'Bonjour!' },
  });
  assert.strictEqual(badLang.status, 400);

  const honeypot = await call('/messages', {
    method: 'POST',
    headers: { Origin: 'https://deanchen.me', 'Content-Type': 'application/json' },
    body: { content: 'spam message', website: 'https://spam.example' },
  });
  assert.strictEqual(honeypot.status, 201);
  assert.strictEqual((await honeypot.json()).id, 0);
  assert.strictEqual(DB.rows.length, 0, 'honeypot submissions do not write to DB');
}

// 4. Create public comments (pending) & private errata feedback, verify rate limit & notifications
{
  const post1 = await call('/messages', {
    method: 'POST',
    headers: {
      Origin: 'https://deanchen.me',
      'CF-Connecting-IP': '1.2.3.4',
      'Content-Type': 'application/json',
    },
    body: {
      site: 'jiangshan',
      page: 'guestbook',
      kind: 'comment',
      lang: 'zh-tw',
      author: '關中書生',
      content: '點地溯源功能非常實用！',
    },
  });
  assert.strictEqual(post1.status, 201);
  const p1 = await post1.json();
  assert.strictEqual(p1.id, 1);
  assert.strictEqual(p1.status, 'pending');

  // Same IP within 60s triggers 429 rate limit
  const rateLimited = await call('/messages', {
    method: 'POST',
    headers: {
      Origin: 'https://deanchen.me',
      'CF-Connecting-IP': '1.2.3.4',
      'Content-Type': 'application/json',
    },
    body: { content: 'duplicate rapid post' },
  });
  assert.strictEqual(rateLimited.status, 429);

  // Different IP submits another comment + private feedback + blog comment
  const post2 = await call('/messages', {
    method: 'POST',
    headers: {
      Origin: 'https://deanchen.me',
      'CF-Connecting-IP': '5.6.7.8',
      'Content-Type': 'application/json',
    },
    body: {
      site: 'jiangshan',
      page: 'guestbook',
      kind: 'comment',
      lang: 'en',
      author: 'Historian',
      content: 'Great interactive timeline for Tang dynasty!',
    },
  });
  assert.strictEqual(post2.status, 201);

  const post3 = await call('/messages', {
    method: 'POST',
    headers: {
      Referer: 'https://deanchen.me/jiangshan-map/?year=741',
      'CF-Connecting-IP': '9.9.9.9',
      'Content-Type': 'application/json',
    },
    body: {
      site: 'jiangshan',
      page: 'guestbook',
      kind: 'feedback',
      lang: 'zh',
      contact: 'reader@example.com',
      context: '741年 · 唐 · 长安',
      content: '岭南道有两处地名缩放后略微重叠。',
    },
  });
  assert.strictEqual(post3.status, 201);

  const post4 = await call('/messages', {
    method: 'POST',
    headers: {
      Origin: 'https://deanchen.me',
      'CF-Connecting-IP': '10.0.0.1',
      'Content-Type': 'application/json',
    },
    body: {
      site: 'blog',
      page: '/history/atlas/story',
      kind: 'comment',
      lang: 'zh',
      content: '博客测试留言。',
    },
  });
  assert.strictEqual(post4.status, 201);
}

// 5. Public GET hides pending comments & all private feedback
{
  const res = await call('/messages?site=jiangshan&page=guestbook');
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.deepStrictEqual(data.items, []);
  assert.strictEqual(data.hasMore, false);
}

// 6. Admin auth checks & moderation workflow
{
  const unconf = await call('/admin/messages', {}, { DB });
  assert.strictEqual(unconf.status, 503);

  const noAuth = await call('/admin/messages');
  assert.strictEqual(noAuth.status, 401);

  const badAuth = await call('/admin/messages', {
    headers: { Authorization: 'Bearer wrong-token' },
  });
  assert.strictEqual(badAuth.status, 401);

  const adminList = await call('/admin/messages?status=pending', {
    headers: { Authorization: 'Bearer secret-admin-token' },
  });
  assert.strictEqual(adminList.status, 200);
  const listData = await adminList.json();
  assert.strictEqual(listData.counts.total, 4);
  assert.strictEqual(listData.counts.pending, 4);
  assert.strictEqual(listData.items.length, 4);
  assert.strictEqual('ip_hash' in listData.items[0], false, 'ip_hash is never exposed even in admin API');

  // Guardrail: private feedback (#3) cannot be marked approved/public
  const forbidPublic = await call('/admin/messages/3', {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer secret-admin-token',
      'Content-Type': 'application/json',
    },
    body: { status: 'approved' },
  });
  assert.strictEqual(forbidPublic.status, 400);
  assert.strictEqual((await forbidPublic.json()).error, 'feedback_cannot_be_public');

  // Resolve private feedback (#3)
  const resolveRes = await call('/admin/messages/3', {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer secret-admin-token',
      'Content-Type': 'application/json',
    },
    body: { status: 'resolved' },
  });
  assert.strictEqual(resolveRes.status, 200);
  assert.strictEqual((await resolveRes.json()).item.status, 'resolved');

  // Approve #1 with reply, approve #2
  const approve1 = await call('/admin/messages/1', {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer secret-admin-token',
      'Content-Type': 'application/json',
    },
    body: { status: 'approved', reply: '感謝支持！' },
  });
  assert.strictEqual(approve1.status, 200);
  const a1 = (await approve1.json()).item;
  assert.strictEqual(a1.status, 'approved');
  assert.strictEqual(a1.reply, '感謝支持！');
  assert.ok(a1.replied_at);

  const approve2 = await call('/admin/messages/2', {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer secret-admin-token',
      'Content-Type': 'application/json',
    },
    body: { status: 'approved' },
  });
  assert.strictEqual(approve2.status, 200);
}

// 7. Public GET returns approved jiangshan comments with pagination & strict field projection
{
  const page1Res = await call('/messages?site=jiangshan&page=guestbook&limit=1', {
    headers: { Origin: 'https://deanchen.me' },
  });
  assert.strictEqual(page1Res.status, 200);
  assert.strictEqual(page1Res.headers.get('Access-Control-Allow-Origin'), 'https://deanchen.me');
  const page1 = await page1Res.json();
  assert.strictEqual(page1.hasMore, true);
  assert.strictEqual(page1.items.length, 1);
  assert.strictEqual(page1.items[0].id, 2);
  assert.strictEqual(page1.items[0].lang, 'en');
  assert.strictEqual('contact' in page1.items[0], false);
  assert.strictEqual('ip_hash' in page1.items[0], false);

  const page2Res = await call('/messages?site=jiangshan&page=guestbook&limit=1&before=2');
  const page2 = await page2Res.json();
  assert.strictEqual(page2.hasMore, false);
  assert.strictEqual(page2.items.length, 1);
  assert.strictEqual(page2.items[0].id, 1);
  assert.strictEqual(page2.items[0].reply, '感謝支持！');
}

// 8. Optional webhook + Resend notification dispatch via ctx.waitUntil
{
  const notified = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    notified.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response('ok', { status: 200 });
  };
  try {
    const bgTasks = [];
    const ctx = { waitUntil: (p) => bgTasks.push(p) };
    const notifyEnv = {
      ...env,
      NOTIFY_WEBHOOK_URL: 'https://hooks.example/notify',
      RESEND_API_KEY: 're_test_123',
      NOTIFY_EMAIL_TO: 'deancsj@gmail.com',
    };
    const res = await call(
      '/messages',
      {
        method: 'POST',
        headers: {
          Origin: 'https://deanchen.me',
          'CF-Connecting-IP': '11.22.33.44',
          'Content-Type': 'application/json',
        },
        body: { kind: 'feedback', content: '通知测试勘误。' },
      },
      notifyEnv,
      ctx
    );
    assert.strictEqual(res.status, 201);
    await Promise.all(bgTasks);
    assert.strictEqual(notified.length, 2);
    assert.strictEqual(notified[0].url, 'https://hooks.example/notify');
    assert.strictEqual(notified[1].url, 'https://api.resend.com/emails');
    assert.deepStrictEqual(notified[1].body.to, ['deancsj@gmail.com']);
  } finally {
    globalThis.fetch = origFetch;
  }
}

console.log('✓ feedback Worker: public/private separation, moderation, pagination, rate limit, and notifications OK');
