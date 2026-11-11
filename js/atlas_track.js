/**
 * Anonymous button & feature usage counter for Jiangshan Atlas (江山时序).
 *
 * Counts clicks on named controls and how often a few features are opened, keeps the
 * tallies in memory and sends one small beacon when the page is hidden. Nothing
 * identifying is collected: no cookies, no storage, no search text, no coordinates.
 *
 * Disabled outside deanchen.me and when Do Not Track / Global Privacy Control is on.
 * The receiving end is workers/stats (Cloudflare Worker + Workers Analytics Engine).
 */
(function () {
  'use strict';

  const ENDPOINT = 'https://stats.deanchen.me/e';
  const HOSTS = ['deanchen.me', 'www.deanchen.me'];
  const FLUSH_INTERVAL_MS = 60000;
  const MAX_EVENTS_PER_BEACON = 60;
  const NAME_RE = /^[a-z0-9_.:-]{1,48}$/i;
  const CLICK_SELECTOR =
    'button, a[id], input[id], [role="button"], [data-track], #milestone-list li, #genealogy-timeline li';
  // These buttons reopen the chronicle the reader just came from; that is not a new open.
  const RETURN_BUTTONS = ['act-return-person', 'act-return-story'];

  function slug(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '_')
      .slice(0, 48);
  }

  function personState(app) {
    const p = app.activePerson;
    return p && p.profiles && p.profiles.length ? p.profiles.map((x) => x.key).join(',') : '';
  }

  function personName(app) {
    const profiles = app.activePerson.profiles;
    if (profiles.length > 1) return slug('multi:' + profiles.map((p) => p.key).sort().join('.'));
    const p = profiles[0];
    return slug((p.isStory ? 'story' : p.isRelic ? 'relic' : 'person') + ':' + p.key);
  }

  function traceState(app) {
    const t = app.activeTrace;
    return t ? Number(t[0]).toFixed(2) + ',' + Number(t[1]).toFixed(2) : '';
  }

  function polityState(app) {
    const p = app.activePolity;
    if (p) return p.curated && p.key ? 'k:' + p.key : 'o:' + ((p.titles && p.titles[0]) || p.zh || '');
    return app.eraFocus ? 'era:' + app.eraFocus.dynastyKey : '';
  }

  function polityName(app) {
    const p = app.activePolity;
    if (!p) return 'polity:era';
    return p.curated && p.key ? slug('polity:' + p.key) : 'polity:other';
  }

  function timelineState(app) {
    const v = app._scrubberView;
    return !app.embed && v && v.end - v.start < 0.999 ? 'zoomed' : '';
  }

  // Each hook wraps one controller method. The app re-invokes most of them on its own
  // (after a lazy bundle loads, on every year change while a card is open, on re-render),
  // so a call is not a use. `state` returns '' while the view is closed and a stable key
  // while it is open, and a feature is counted only when that key changes. Hooks without
  // `state` are only ever called once per user action. Method names are checked in CI
  // (scripts/tests/suite_search_runtime.js) so a rename fails the build.
  const FEATURE_HOOKS = [
    { method: 'openPersonChronicle', state: personState, name: personName, skipOnReturn: true },
    { method: 'openGenealogyAt', state: traceState, name: () => 'place_card' },
    { method: 'openPolity', state: polityState, name: polityName },
    { method: '_setScrubberView', state: timelineState, name: () => 'timeline_zoom' },
    {
      method: '_finishChallenge',
      state: (app) => (app.challenge && app.challenge.finished ? 'done' : ''),
      name: () => 'quiz_finish',
    },
    { method: 'startChallenge', name: () => 'quiz_start' },
    {
      method: '_selectSearchResult',
      name: (app, args) => 'search:' + slug((args[0] && args[0].kind) || 'other'),
    },
  ];

  function controlName(el) {
    if (el.dataset && el.dataset.track) return slug(el.dataset.track);
    if (el.id) return slug(el.id);
    // State classes come and go; the first stable class names the control.
    const cls = Array.prototype.find.call(el.classList || [], (c) => !/^(is|has)-/.test(c));
    if (cls) return slug('c.' + cls);
    const host = el.parentElement && el.parentElement.closest('[id]');
    return host ? slug(el.tagName + '.' + host.id) : '';
  }

  function entryKind(search) {
    const q = new URLSearchParams(search);
    if (q.has('embed')) return 'embed';
    if (q.has('event')) return 'event';
    if (q.has('person') || q.has('journey')) {
      return (q.get('person') || '').indexOf(',') >= 0 ? 'multi' : 'person';
    }
    if (q.has('quiz')) return 'quiz';
    if (q.has('place') || q.has('hover') || q.has('trace')) return 'place';
    if (q.has('polity')) return 'polity';
    if (q.has('q')) return 'search';
    return q.has('year') ? 'year' : 'home';
  }

  function main() {
    if (HOSTS.indexOf(location.hostname) < 0) return;
    if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
    if (typeof navigator.sendBeacon !== 'function') return;

    const counts = new Map();
    const bump = (kind, name) => {
      if (!name || !NAME_RE.test(name)) return;
      const key = kind + '\u0000' + name;
      counts.set(key, (counts.get(key) || 0) + 1);
    };

    const flush = () => {
      if (!counts.size) return;
      const app = window.atlasApp;
      const w = window.innerWidth <= 640 ? 'm' : window.innerWidth <= 900 ? 't' : 'd';
      const entries = Array.from(counts.entries());
      counts.clear();
      for (let i = 0; i < entries.length; i += MAX_EVENTS_PER_BEACON) {
        const ev = entries.slice(i, i + MAX_EVENTS_PER_BEACON).map(([key, n]) => {
          const [kind, name] = key.split('\u0000');
          return [kind, name, n];
        });
        const body = JSON.stringify({ v: 1, l: (app && app.locale) || 'zh', w, ev });
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
      }
    };

    let returning = false;
    document.addEventListener(
      'click',
      (e) => {
        const el = e.target && e.target.closest ? e.target.closest(CLICK_SELECTOR) : null;
        if (!el) return;
        const name = controlName(el);
        bump('btn', name);
        if (RETURN_BUTTONS.indexOf(name) >= 0) {
          returning = true;
          setTimeout(() => {
            returning = false;
          }, 0);
        }
      },
      true
    );

    const wrap = (app, hook, orig) =>
      function (...args) {
        let before = '';
        try {
          before = hook.state ? hook.state(app) : '';
          // The view was closed since the last count, so reopening the same thing counts again.
          if (hook.state && !before) hook.last = '';
        } catch (_) {}
        const result = orig.apply(this, args);
        try {
          if (!hook.state) {
            bump('feat', hook.name(app, args));
          } else {
            const after = hook.state(app);
            if (after && after !== hook.last) {
              hook.last = after;
              if (!(hook.skipOnReturn && returning)) bump('feat', hook.name(app, args));
            }
          }
        } catch (_) {}
        return result;
      };

    let hooked = false;
    const hookApp = () => {
      const app = window.atlasApp;
      if (hooked || !app) return;
      hooked = true;
      const proto = Object.getPrototypeOf(app);
      for (const hook of FEATURE_HOOKS) {
        try {
          const { method } = hook;
          const wrapped = new WeakMap();
          let own = Object.prototype.hasOwnProperty.call(app, method) ? app[method] : undefined;
          // An accessor rather than a one-time wrap: the quiz methods are added to the
          // prototype only when its lazy bundle loads, and until then the property must
          // stay undefined because the app tests `typeof this.startChallenge`.
          Object.defineProperty(app, method, {
            configurable: true,
            enumerable: false,
            get() {
              const orig = own || proto[method];
              if (typeof orig !== 'function') return orig;
              let fn = wrapped.get(orig);
              if (!fn) {
                fn = wrap(app, hook, orig);
                wrapped.set(orig, fn);
              }
              return fn;
            },
            set(v) {
              own = v;
            },
          });
        } catch (_) {}
      }
    };

    bump('entry', entryKind(location.search));

    // A deferred script runs before DOMContentLoaded, which is when app.js creates the
    // controller. app.js listens on window and registered first, so listening on window
    // too (not document, which is dispatched earlier) runs right after the app exists.
    hookApp();
    window.addEventListener('DOMContentLoaded', () => {
      hookApp();
      setTimeout(hookApp, 0);
    });
    window.addEventListener('load', hookApp);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush);
    setInterval(flush, FLUSH_INTERVAL_MS);
  }

  if (typeof window !== 'undefined') {
    window.__ATLAS_TRACK_HOOKS = FEATURE_HOOKS.map((h) => h.method);
    if (typeof document !== 'undefined' && typeof location !== 'undefined') main();
  }
})();
