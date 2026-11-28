/**
 * Self-contained moderation console served at GET /admin.
 * Contains zero embedded data; requires ADMIN_TOKEN to fetch or update messages.
 */
export const ADMIN_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>江山时序 · 留言与勘误审核</title>
  <style>
    :root {
      --bg: #f3eee4;
      --card: #fbf8f1;
      --ink: #2b2622;
      --ink-sec: #5d554c;
      --ink-muted: #8d847a;
      --vermilion: #b5452f;
      --hairline: rgba(43, 38, 34, 0.12);
      --serif: 'Noto Serif SC', 'Songti SC', 'SimSun', serif;
      --sans: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px 16px 48px;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 14px;
      line-height: 1.6;
    }
    .wrap {
      max-width: 860px;
      margin: 0 auto;
    }
    .topbar {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--hairline);
      margin-bottom: 18px;
    }
    h1 {
      margin: 0;
      font-family: var(--serif);
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .seal {
      color: var(--vermilion);
      margin-right: 8px;
    }
    .sub {
      margin: 2px 0 0;
      font-size: 12px;
      color: var(--ink-muted);
    }
    .card {
      background: var(--card);
      border: 1px solid var(--hairline);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 6px 20px rgba(43, 38, 34, 0.06);
    }
    .auth-box {
      max-width: 420px;
      margin: 48px auto 0;
    }
    .auth-box h2 {
      margin: 0 0 8px;
      font-family: var(--serif);
      font-size: 16px;
    }
    label {
      display: block;
      font-size: 12px;
      color: var(--ink-sec);
      margin-bottom: 6px;
    }
    input[type="password"],
    input[type="text"],
    textarea {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid rgba(43, 38, 34, 0.2);
      border-radius: 8px;
      background: #fffdf8;
      color: var(--ink);
      font: inherit;
      font-size: 13px;
    }
    input:focus, textarea:focus {
      outline: none;
      border-color: var(--vermilion);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .remember {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 10px 0 14px;
      font-size: 12px;
      color: var(--ink-sec);
      cursor: pointer;
    }
    button {
      font: inherit;
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 7px;
      border: 1px solid var(--hairline);
      background: var(--bg);
      color: var(--ink);
      cursor: pointer;
    }
    button:hover { border-color: rgba(43, 38, 34, 0.32); }
    button.primary {
      background: var(--vermilion);
      border-color: var(--vermilion);
      color: #fffaf3;
    }
    button.primary:hover { opacity: 0.92; }
    button.danger {
      color: #8c2d19;
      border-color: rgba(181, 69, 47, 0.35);
      background: rgba(181, 69, 47, 0.06);
    }
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
    }
    .tab.is-active {
      background: var(--ink);
      color: var(--card);
      border-color: var(--ink);
    }
    .notice {
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      margin-bottom: 12px;
      border: 1px solid var(--hairline);
      background: var(--card);
      color: var(--ink-sec);
    }
    .notice.is-error {
      color: #8c2d19;
      border-color: rgba(181, 69, 47, 0.35);
      background: rgba(181, 69, 47, 0.08);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .item {
      background: var(--card);
      border: 1px solid var(--hairline);
      border-radius: 10px;
      padding: 14px 16px;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 12px;
      color: var(--ink-muted);
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .tag {
      padding: 1px 7px;
      border-radius: 4px;
      border: 1px solid var(--hairline);
      background: var(--bg);
      color: var(--ink-sec);
      font-size: 11px;
    }
    .tag.kind-feedback {
      border-color: rgba(181, 69, 47, 0.35);
      color: var(--vermilion);
    }
    .author {
      font-weight: 600;
      color: var(--ink);
      font-size: 13px;
    }
    .content {
      margin: 0 0 10px;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--ink);
    }
    .private-line {
      font-size: 12px;
      color: var(--ink-sec);
      background: var(--bg);
      border-radius: 6px;
      padding: 6px 10px;
      margin-bottom: 8px;
      word-break: break-word;
    }
    .reply-box {
      margin: 8px 0 10px;
      padding: 8px 12px;
      border-left: 2px solid var(--vermilion);
      background: rgba(243, 238, 228, 0.65);
      border-radius: 0 6px 6px 0;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .reply-head {
      font-size: 11px;
      font-weight: 600;
      color: var(--vermilion);
      margin-bottom: 2px;
    }
    .reply-editor {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--hairline);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .hidden { display: none !important; }
    .empty {
      text-align: center;
      padding: 32px 16px;
      color: var(--ink-muted);
      font-size: 13px;
      background: var(--card);
      border: 1px dashed var(--hairline);
      border-radius: 10px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="topbar">
      <div>
        <h1><span class="seal">江山</span>留言与勘误审核</h1>
        <p class="sub">先审后显 · 私密勘误仅后台可见</p>
      </div>
      <div id="topbar-actions" class="row hidden">
        <button id="btn-refresh" type="button">刷新</button>
        <button id="btn-logout" type="button">退出</button>
      </div>
    </div>

    <div id="auth-view" class="card auth-box">
      <h2>验证管理令牌</h2>
      <form id="auth-form">
        <label for="token-input">ADMIN_TOKEN</label>
        <input id="token-input" type="password" autocomplete="current-password" required placeholder="输入管理令牌" />
        <label class="remember">
          <input id="remember-chk" type="checkbox" />
          <span>在本机浏览器记住令牌（localStorage）</span>
        </label>
        <button type="submit" class="primary">进入审核页</button>
      </form>
    </div>

    <div id="main-view" class="hidden">
      <div id="notice" class="notice hidden"></div>
      <div id="tabs" class="tabs"></div>
      <div id="list" class="list"></div>
    </div>
  </div>

  <script>
    (function () {
      'use strict';

      var STORAGE_KEY = 'jiangshan_feedback_admin_token';
      var state = {
        token: sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY) || '',
        filter: 'pending',
        items: [],
        counts: { pending: 0, approved: 0, feedback: 0, rejected: 0, total: 0 },
        editingId: null
      };

      var authView = document.getElementById('auth-view');
      var mainView = document.getElementById('main-view');
      var topActions = document.getElementById('topbar-actions');
      var noticeEl = document.getElementById('notice');
      var tabsEl = document.getElementById('tabs');
      var listEl = document.getElementById('list');

      function showNotice(msg, isError) {
        noticeEl.textContent = msg;
        noticeEl.className = 'notice' + (isError ? ' is-error' : '');
        noticeEl.classList.remove('hidden');
      }

      function clearNotice() {
        noticeEl.classList.add('hidden');
      }

      function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
      }

      function langLabel(code) {
        if (code === 'zh-tw') return '繁體';
        if (code === 'en') return 'EN';
        return '简中';
      }

      function statusLabel(st) {
        if (st === 'approved') return '已公开';
        if (st === 'resolved') return '已处理';
        if (st === 'rejected') return '已屏蔽';
        return '待审核';
      }

      async function api(path, opts) {
        var headers = Object.assign({ Authorization: 'Bearer ' + state.token }, (opts && opts.headers) || {});
        var res = await fetch(path, Object.assign({}, opts, { headers: headers }));
        var data = null;
        try { data = await res.json(); } catch (_) {}
        if (res.status === 401) {
          logout('令牌无效或已过期，请重新输入');
          throw new Error('unauthorized');
        }
        if (!res.ok) {
          throw new Error((data && data.error) || ('HTTP ' + res.status));
        }
        return data;
      }

      function logout(msg) {
        state.token = '';
        sessionStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY);
        authView.classList.remove('hidden');
        mainView.classList.add('hidden');
        topActions.classList.add('hidden');
        if (msg) alert(msg);
      }

      async function loadMessages() {
        clearNotice();
        var qs = '?limit=80';
        if (state.filter === 'pending') qs += '&status=pending';
        else if (state.filter === 'approved') qs += '&kind=comment&status=approved';
        else if (state.filter === 'feedback') qs += '&kind=feedback';
        else if (state.filter === 'rejected') qs += '&status=rejected';

        var data = await api('/admin/messages' + qs);
        state.items = data.items || [];
        state.counts = data.counts || state.counts;
        renderTabs();
        renderList();
      }

      async function patchMessage(id, payload, okMsg) {
        await api('/admin/messages/' + id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        state.editingId = null;
        await loadMessages();
        showNotice(okMsg, false);
      }

      function renderTabs() {
        var defs = [
          { key: 'pending', label: '待审核', count: state.counts.pending },
          { key: 'approved', label: '已公开', count: state.counts.approved },
          { key: 'feedback', label: '私密勘误', count: state.counts.feedback },
          { key: 'rejected', label: '已屏蔽', count: state.counts.rejected },
          { key: 'all', label: '全部', count: state.counts.total }
        ];
        tabsEl.textContent = '';
        defs.forEach(function (d) {
          var btn = el('button', 'tab' + (state.filter === d.key ? ' is-active' : ''), d.label + ' (' + (d.count || 0) + ')');
          btn.type = 'button';
          btn.addEventListener('click', function () {
            state.filter = d.key;
            state.editingId = null;
            loadMessages().catch(function (err) { showNotice(err.message, true); });
          });
          tabsEl.appendChild(btn);
        });
      }

      function renderList() {
        listEl.textContent = '';
        if (!state.items.length) {
          listEl.appendChild(el('div', 'empty', '当前列表暂无记录'));
          return;
        }
        state.items.forEach(function (item) {
          var card = el('article', 'item');
          var meta = el('div', 'meta');
          var tags = el('div', 'tags');

          tags.appendChild(el('span', 'tag', '#' + item.id));
          tags.appendChild(el('span', 'tag' + (item.kind === 'feedback' ? ' kind-feedback' : ''), item.kind === 'feedback' ? '私密勘误' : '公开留言'));
          tags.appendChild(el('span', 'tag', statusLabel(item.status)));
          tags.appendChild(el('span', 'tag', langLabel(item.lang)));
          tags.appendChild(el('span', 'tag', item.site + '/' + item.page_key));
          tags.appendChild(el('span', 'author', item.author || '匿名访客'));

          meta.appendChild(tags);
          meta.appendChild(el('span', '', item.created_at || ''));
          card.appendChild(meta);

          if (item.context) {
            card.appendChild(el('div', 'private-line', '视图上下文：' + item.context));
          }
          if (item.contact) {
            card.appendChild(el('div', 'private-line', '联系方式 · 仅后台可见：' + item.contact));
          }

          card.appendChild(el('p', 'content', item.content));

          if (item.reply) {
            var rBox = el('div', 'reply-box');
            rBox.appendChild(el('div', 'reply-head', '作者回复 · ' + (item.replied_at || '')));
            rBox.appendChild(el('div', '', item.reply));
            card.appendChild(rBox);
          }

          var actions = el('div', 'row');
          if (item.kind === 'comment') {
            if (item.status !== 'approved') {
              var btnApprove = el('button', 'primary', '通过并公开');
              btnApprove.type = 'button';
              btnApprove.addEventListener('click', function () {
                patchMessage(item.id, { status: 'approved' }, '#' + item.id + ' 已审核通过并公开').catch(function (err) {
                  showNotice(err.message, true);
                });
              });
              actions.appendChild(btnApprove);
            }
            var btnReply = el('button', '', item.reply ? '编辑回复' : '写回复');
            btnReply.type = 'button';
            btnReply.addEventListener('click', function () {
              state.editingId = state.editingId === item.id ? null : item.id;
              renderList();
            });
            actions.appendChild(btnReply);
          } else if (item.status !== 'resolved') {
            var btnResolve = el('button', 'primary', '标记已处理');
            btnResolve.type = 'button';
            btnResolve.addEventListener('click', function () {
              patchMessage(item.id, { status: 'resolved' }, '#' + item.id + ' 已标记为已处理（保持私密）').catch(function (err) {
                showNotice(err.message, true);
              });
            });
            actions.appendChild(btnResolve);
          }

          if (item.status !== 'rejected') {
            var btnReject = el('button', 'danger', '屏蔽');
            btnReject.type = 'button';
            btnReject.addEventListener('click', function () {
              patchMessage(item.id, { status: 'rejected' }, '#' + item.id + ' 已屏蔽').catch(function (err) {
                showNotice(err.message, true);
              });
            });
            actions.appendChild(btnReject);
          }
          card.appendChild(actions);

          if (state.editingId === item.id && item.kind === 'comment') {
            var form = el('form', 'reply-editor');
            var ta = el('textarea', '');
            ta.rows = 3;
            ta.maxLength = 1000;
            ta.placeholder = '输入作者回复内容（留空保存将清除回复）';
            ta.value = item.reply || '';

            var btns = el('div', 'row');
            var saveBtn = el('button', 'primary', '保存回复');
            saveBtn.type = 'submit';
            var cancelBtn = el('button', '', '取消');
            cancelBtn.type = 'button';
            cancelBtn.addEventListener('click', function () {
              state.editingId = null;
              renderList();
            });
            btns.appendChild(saveBtn);
            btns.appendChild(cancelBtn);
            form.appendChild(ta);
            form.appendChild(btns);
            form.addEventListener('submit', function (e) {
              e.preventDefault();
              patchMessage(item.id, { reply: ta.value.trim() }, '#' + item.id + ' 回复已更新').catch(function (err) {
                showNotice(err.message, true);
              });
            });
            card.appendChild(form);
          }

          listEl.appendChild(card);
        });
      }

      function enterMain() {
        authView.classList.add('hidden');
        mainView.classList.remove('hidden');
        topActions.classList.remove('hidden');
        loadMessages().catch(function (err) {
          if (err.message !== 'unauthorized') showNotice(err.message, true);
        });
      }

      document.getElementById('auth-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var token = document.getElementById('token-input').value.trim();
        if (!token) return;
        state.token = token;
        if (document.getElementById('remember-chk').checked) {
          localStorage.setItem(STORAGE_KEY, token);
          sessionStorage.removeItem(STORAGE_KEY);
        } else {
          sessionStorage.setItem(STORAGE_KEY, token);
          localStorage.removeItem(STORAGE_KEY);
        }
        enterMain();
      });

      document.getElementById('btn-refresh').addEventListener('click', function () {
        loadMessages().catch(function (err) { showNotice(err.message, true); });
      });

      document.getElementById('btn-logout').addEventListener('click', function () {
        logout();
      });

      if (state.token) {
        enterMain();
      }
    })();
  </script>
</body>
</html>
`;
