#!/usr/bin/env node
/**
 * Zero-dependency CLI for moderating Jiangshan Atlas & Blog feedback.
 *
 * Usage:
 *   FEEDBACK_ADMIN_TOKEN=... node workers/feedback/admin.js pending
 *   FEEDBACK_ADMIN_TOKEN=... node workers/feedback/admin.js list [--status pending] [--kind comment] [--site jiangshan]
 *   FEEDBACK_ADMIN_TOKEN=... node workers/feedback/admin.js approve <id>
 *   FEEDBACK_ADMIN_TOKEN=... node workers/feedback/admin.js resolve <id>
 *   FEEDBACK_ADMIN_TOKEN=... node workers/feedback/admin.js reject <id>
 *   FEEDBACK_ADMIN_TOKEN=... node workers/feedback/admin.js reply <id> "<text>"
 */
import process from 'node:process';

const BASE = (process.env.FEEDBACK_API_BASE || 'https://feedback.deanchen.me').replace(/\/+$/, '');
const TOKEN = process.env.FEEDBACK_ADMIN_TOKEN || '';

function usage() {
  console.log(`Usage:
  FEEDBACK_ADMIN_TOKEN=<token> node workers/feedback/admin.js pending
  FEEDBACK_ADMIN_TOKEN=<token> node workers/feedback/admin.js list [--status S] [--kind K] [--site SITE]
  FEEDBACK_ADMIN_TOKEN=<token> node workers/feedback/admin.js approve <id>
  FEEDBACK_ADMIN_TOKEN=<token> node workers/feedback/admin.js resolve <id>
  FEEDBACK_ADMIN_TOKEN=<token> node workers/feedback/admin.js reject <id>
  FEEDBACK_ADMIN_TOKEN=<token> node workers/feedback/admin.js reply <id> "<text>"`);
}

async function request(path, opts = {}) {
  if (!TOKEN) {
    console.error('Error: FEEDBACK_ADMIN_TOKEN is not set.');
    process.exit(1);
  }
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Error (${res.status}): ${data.error || 'request_failed'}`);
    process.exit(1);
  }
  return data;
}

function printItems(data) {
  const { items = [], counts = {} } = data;
  console.log(
    `Counts: pending=${counts.pending || 0}, approved=${counts.approved || 0}, feedback=${counts.feedback || 0}, rejected=${counts.rejected || 0}, total=${counts.total || 0}`
  );
  if (!items.length) {
    console.log('(no matching messages)');
    return;
  }
  for (const item of items) {
    const head = `#${item.id} [${item.kind}/${item.status}] (${item.site}/${item.page_key}, ${item.lang}) ${item.author || '匿名访客'} @ ${item.created_at}`;
    console.log('\n' + head);
    if (item.context) console.log(`  context: ${item.context}`);
    if (item.contact) console.log(`  contact: ${item.contact}`);
    console.log(`  content: ${item.content}`);
    if (item.reply) console.log(`  reply (${item.replied_at}): ${item.reply}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (!cmd || cmd === '--help' || cmd === '-h') {
    usage();
    return;
  }

  if (cmd === 'pending') {
    const data = await request('/admin/messages?status=pending&limit=50');
    printItems(data);
    return;
  }

  if (cmd === 'list') {
    const params = new URLSearchParams({ limit: '50' });
    for (let i = 1; i < args.length; i += 2) {
      const flag = args[i];
      const val = args[i + 1];
      if (!val) break;
      if (flag === '--status') params.set('status', val);
      else if (flag === '--kind') params.set('kind', val);
      else if (flag === '--site') params.set('site', val);
    }
    const data = await request('/admin/messages?' + params.toString());
    printItems(data);
    return;
  }

  if (cmd === 'approve' || cmd === 'resolve' || cmd === 'reject') {
    const id = args[1];
    if (!id) {
      usage();
      process.exit(1);
    }
    const statusMap = { approve: 'approved', resolve: 'resolved', reject: 'rejected' };
    const data = await request(`/admin/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: statusMap[cmd] }),
    });
    console.log(`OK #${data.item.id} -> ${data.item.status}`);
    return;
  }

  if (cmd === 'reply') {
    const id = args[1];
    const replyText = args.slice(2).join(' ');
    if (!id || args.length < 3) {
      usage();
      process.exit(1);
    }
    const data = await request(`/admin/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: replyText }),
    });
    console.log(`OK #${data.item.id} reply saved`);
    return;
  }

  usage();
  process.exit(1);
}

main();
