# stats.deanchen.me — anonymous click counter

A write-only Cloudflare Worker that receives batched counts from `js/atlas_track.js` and stores them in Workers Analytics Engine (dataset `jiangshan_clicks`).

## What is collected

Each data point is one counter from one page view:

| Column | Meaning | Example |
| :-- | :-- | :-- |
| `blob1` | kind (see below) | `btn` |
| `blob2` | name | `act-step-next`, `story:anshi` |
| `blob3` | UI language | `zh`, `zh-tw`, `en` |
| `blob4` | viewport bucket | `d` (> 900 px), `t` (≤ 900 px), `m` (≤ 640 px) |
| `blob5` | country from Cloudflare (`request.cf.country`) | `CN` |
| `double1` | count in that batch | `2` |

The three kinds:

- **`btn`** — clicks on a named control. The name is the element's `data-track`, else its `id`, else `c.<first class>`, else `<tag>.<id of the nearest ancestor>` (e.g. `li.milestone-list` for a row in the chronicle pane). Drags (panning the map, scrubbing the timeline) are not clicks and are not counted.
- **`feat`** — a feature was opened: `person:<key>`, `multi:<keys>`, `story:<key>`, `relic:<key>`, `place_card`, `polity:<key>` / `polity:other` / `polity:era`, `timeline_zoom`, `quiz_start`, `quiz_finish`, `search:<result kind>`. Counted once per open, not per internal call: the app re-invokes these methods when lazy bundles finish loading and on every year change. Returning to a chronicle from a place card is not a new open. A view restored from a deep link counts as one open.
- **`entry`** — what kind of link the visitor landed on: `home`, `year`, `person`, `multi`, `event`, `place`, `polity`, `quiz`, `search`, `embed`.

No cookies, no local storage, no IP addresses, no search text, no coordinates. The tracker is off outside `deanchen.me` and when Do Not Track or Global Privacy Control is enabled. Visitors with a content blocker may not be counted.

## Who can reach it

The endpoint is public by necessity (every visitor's browser posts to it), but it is write-only:

- Only `POST /e` is accepted; everything else returns 404, so nothing can be read through it.
- Requests whose `Origin` (or, if absent, `Referer`) is not `deanchen.me` get 403.
- Bodies over 4 KB, more than 60 events, malformed names, or unknown kinds are dropped; one event's count is capped at 200.
- Reading the data requires a Cloudflare API token with **Account Analytics: Read**.

Like any client-side analytics, someone determined could still forge counts by replaying requests with a spoofed `Origin`. For extra protection, add a Cloudflare WAF rate-limiting rule on `stats.deanchen.me` (e.g. 30 requests / 10 s per IP).

## Test

```bash
node workers/stats/test.js   # zero dependencies; also runs in CI
```

## Deploy

```bash
cd workers/stats
npx wrangler login      # once, opens the browser
npx wrangler deploy     # creates stats.deanchen.me (Custom Domain); the dataset appears on first write
```

Until the Worker is deployed the site's beacons simply fail; nothing on the page depends on them.

## Query

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/analytics_engine/sql" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  --data "SELECT blob1 AS kind, blob2 AS name, SUM(_sample_interval * double1) AS clicks
          FROM jiangshan_clicks
          WHERE timestamp > NOW() - INTERVAL '7' DAY
          GROUP BY kind, name ORDER BY clicks DESC LIMIT 50"
```

## Limits

Analytics Engine keeps 90 days of data. The Workers Free plan includes 100k requests per day, and Analytics Engine 100k data points written and 10k queries per day. A page view sends one request per flush and writes one data point per distinct name it touched, so a busy day can exceed the free write allowance; check usage in the Cloudflare dashboard after the first few days.
