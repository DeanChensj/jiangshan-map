# feedback.deanchen.me — lightweight guestbook & errata feedback store

A zero-dependency Cloudflare Worker + D1 (SQLite) backend for public guestbook comments (moderated before display) and private errata feedback, shared across Jiangshan Atlas (`site=jiangshan`) and `deanchen.me` blog (`site=blog`).

## Endpoints

- `GET /messages?site=jiangshan&page=guestbook&limit=20&before=<id>`
  - Public read endpoint. Returns only `kind = 'comment' AND status = 'approved'`. Never exposes private `feedback`, `contact`, `context`, or `ip_hash`.
- `POST /messages`
  - Accepts `site`, `page`, `kind` (`comment` | `feedback`), `lang` (`zh` | `zh-tw` | `en`), `author`, `contact`, `content`, `context`, and honeypot `website`.
  - Requires `Origin` (or fallback `Referer` origin) in `deanchen.me` allowlist. Enforces 4 KB body cap, field length bounds, and 60 s per-IP cooldown (salted SHA-256 hash). Always writes with `status = 'pending'`.
- `GET /admin`
  - Self-contained parchment moderation page (contains no data; prompts for `ADMIN_TOKEN`).
- `GET /admin/messages` and `PATCH /admin/messages/:id`
  - Protected by `Authorization: Bearer <ADMIN_TOKEN>`. Private `feedback` items are prevented from transitioning to `approved`.

## Setup & Deploy

```bash
cd workers/feedback
npx wrangler login
npx wrangler d1 create jiangshan-feedback
# Paste the returned database_id into wrangler.toml

npx wrangler d1 execute jiangshan-feedback --remote --file=schema.sql

npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put IP_SALT

# Optional notifications (skipped automatically if unset):
# npx wrangler secret put NOTIFY_WEBHOOK_URL
# npx wrangler secret put RESEND_API_KEY
# npx wrangler secret put NOTIFY_EMAIL_TO

npx wrangler deploy
```

## Moderation

1. **Web console**: Open `https://feedback.deanchen.me/admin` and enter `ADMIN_TOKEN`.
2. **CLI**:
   ```bash
   export FEEDBACK_ADMIN_TOKEN="your-token"
   node workers/feedback/admin.js pending
   node workers/feedback/admin.js approve 12
   node workers/feedback/admin.js reply 12 "已修正"
   node workers/feedback/admin.js resolve 13
   node workers/feedback/admin.js reject 14
   ```

## Test

```bash
node workers/feedback/test.js   # zero dependencies; runs in CI
```

## Free Tier Limits

Cloudflare D1 Free plan includes 5M rows read/day, 100k rows written/day, and 5 GB storage. Workers Free plan includes 100k requests/day.
