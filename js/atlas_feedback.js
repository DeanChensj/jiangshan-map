/**
 * Guestbook & Errata Feedback Modal (留言与勘误)
 * Lazy-loaded on demand when opening the feedback menu item.
 * Zero external dependencies, XSS-safe textContent rendering, no emojis.
 */
(function () {
  'use strict';

  const DEFAULT_API = 'https://feedback.deanchen.me';
  const CONTACT_EMAIL = 'deancsj@gmail.com';
  const GITHUB_ISSUES_URL = 'https://github.com/DeanChensj/jiangshan-map/issues';
  const PAGE_SIZE = 20;

  function apiBase() {
    if (typeof window !== 'undefined' && typeof window.__ATLAS_FEEDBACK_API__ === 'string' && window.__ATLAS_FEEDBACK_API__) {
      return window.__ATLAS_FEEDBACK_API__.replace(/\/+$/, '');
    }
    return DEFAULT_API;
  }

  function formatShortDate(isoStr) {
    if (!isoStr || typeof isoStr !== 'string') return '';
    return isoStr.slice(0, 10);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  class AtlasFeedbackMixin {
    _fbText(en, zh) {
      return this.locale === 'en' ? en : this._zh(zh);
    }

    _buildFeedbackContext() {
      const parts = [];
      if (Number.isFinite(this.year)) {
        parts.push(this.formatYear(this.year));
      }
      const d = this.dynasties && this.dynasties[this.dynastyIdx];
      if (d) {
        parts.push(this.dynastyName(d));
      }
      if (this.activePerson && Array.isArray(this.activePerson.profiles) && this.activePerson.profiles.length) {
        const names = this.activePerson.profiles
          .map((p) => (this.locale === 'en' ? p.en || p.zh : this._zh(p.zh || '')))
          .filter(Boolean);
        if (names.length) parts.push(names.join(' / '));
      } else if (this.activeTrace && this.activeTrace[2]) {
        const tr = this.activeTrace[2];
        const placeName = this.locale === 'en' ? tr.en || tr.zh : this._zh(tr.zh || '');
        if (placeName) parts.push(placeName);
      } else if (this.activePolity) {
        const pol = this.activePolity;
        const polName = this.locale === 'en' ? pol.en || pol.zh : this._zh(pol.zh || '');
        if (polName) parts.push(polName);
      }
      let summary = parts.join(' · ');
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        const q = window.location.search.slice(0, 80);
        if (q) summary = summary ? `${summary} (${q})` : q;
      }
      return summary.slice(0, 200);
    }

    _ensureFeedbackModalDom() {
      let modal = this._id('feedback-modal');
      if (modal) return modal;

      modal = el('div', 'feedback-modal is-hidden');
      modal.id = 'feedback-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'fb-modal-title');

      const dialog = el('div', 'feedback-dialog');

      // Header
      const head = el('div', 'fb-head');
      const titleGroup = el('div', 'fb-title-group');
      const title = el('h2', 'fb-title');
      title.id = 'fb-modal-title';
      const sub = el('p', 'fb-subtitle');
      sub.id = 'fb-modal-sub';
      titleGroup.appendChild(title);
      titleGroup.appendChild(sub);

      const closeBtn = el('button', 'fb-close-btn');
      closeBtn.type = 'button';
      closeBtn.id = 'act-feedback-close';
      closeBtn.innerHTML =
        '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><line x1="3.2" y1="3.2" x2="12.8" y2="12.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="12.8" y1="3.2" x2="3.2" y2="12.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

      head.appendChild(titleGroup);
      head.appendChild(closeBtn);
      dialog.appendChild(head);

      // Tabs
      const tabs = el('div', 'fb-tabs');
      tabs.setAttribute('role', 'tablist');
      const tabComment = el('button', 'fb-tab is-active');
      tabComment.type = 'button';
      tabComment.id = 'fb-tab-comment';
      tabComment.setAttribute('role', 'tab');
      tabComment.setAttribute('aria-selected', 'true');

      const tabFeedback = el('button', 'fb-tab');
      tabFeedback.type = 'button';
      tabFeedback.id = 'fb-tab-feedback';
      tabFeedback.setAttribute('role', 'tab');
      tabFeedback.setAttribute('aria-selected', 'false');

      tabs.appendChild(tabComment);
      tabs.appendChild(tabFeedback);
      dialog.appendChild(tabs);

      // Body
      const body = el('div', 'fb-body');

      // Panel 1: Public Guestbook
      const panelComment = el('div', 'fb-panel');
      panelComment.id = 'fb-panel-comment';

      const formComment = el('form', 'fb-form');
      formComment.id = 'fb-form-comment';

      const commentAuthor = el('input', 'fb-input');
      commentAuthor.id = 'fb-comment-author';
      commentAuthor.type = 'text';
      commentAuthor.maxLength = 30;
      commentAuthor.autocomplete = 'nickname';

      const commentContent = el('textarea', 'fb-textarea');
      commentContent.id = 'fb-comment-content';
      commentContent.rows = 3;
      commentContent.maxLength = 1000;
      commentContent.required = true;

      const hpComment = el('input', 'fb-hp');
      hpComment.type = 'text';
      hpComment.name = 'website';
      hpComment.tabIndex = -1;
      hpComment.autocomplete = 'off';
      hpComment.setAttribute('aria-hidden', 'true');

      const commentRow = el('div', 'fb-form-row');
      const commentHint = el('span', 'fb-hint');
      commentHint.id = 'fb-comment-hint';
      const commentCounter = el('span', 'fb-counter');
      commentCounter.id = 'fb-comment-counter';
      commentCounter.textContent = '0 / 1000';
      const commentMeta = el('div', 'fb-form-meta');
      commentMeta.appendChild(commentHint);
      commentMeta.appendChild(commentCounter);

      const commentSubmit = el('button', 'fb-submit-btn');
      commentSubmit.type = 'submit';
      commentSubmit.id = 'fb-comment-submit';

      commentRow.appendChild(commentMeta);
      commentRow.appendChild(commentSubmit);

      const commentNotice = el('div', 'fb-notice is-hidden');
      commentNotice.id = 'fb-comment-notice';
      commentNotice.setAttribute('role', 'status');

      formComment.appendChild(commentAuthor);
      formComment.appendChild(commentContent);
      formComment.appendChild(hpComment);
      formComment.appendChild(commentRow);
      formComment.appendChild(commentNotice);
      panelComment.appendChild(formComment);

      const listHead = el('div', 'fb-list-head');
      const listTitle = el('span', 'fb-list-title');
      listTitle.id = 'fb-list-title';
      listHead.appendChild(listTitle);
      panelComment.appendChild(listHead);

      const listEl = el('div', 'fb-list');
      listEl.id = 'fb-public-list';
      panelComment.appendChild(listEl);

      const loadMoreWrap = el('div', 'fb-more-wrap is-hidden');
      loadMoreWrap.id = 'fb-load-more-wrap';
      const loadMoreBtn = el('button', 'fb-more-btn');
      loadMoreBtn.type = 'button';
      loadMoreBtn.id = 'act-feedback-load-more';
      loadMoreWrap.appendChild(loadMoreBtn);
      panelComment.appendChild(loadMoreWrap);

      body.appendChild(panelComment);

      // Panel 2: Private Errata Feedback
      const panelFeedback = el('div', 'fb-panel is-hidden');
      panelFeedback.id = 'fb-panel-feedback';

      const ctxStrip = el('div', 'fb-ctx-strip');
      const ctxLabel = el('span', 'fb-ctx-text');
      ctxLabel.id = 'fb-ctx-text';
      const ctxPrivacy = el('span', 'fb-ctx-privacy');
      ctxPrivacy.id = 'fb-ctx-privacy';
      ctxStrip.appendChild(ctxLabel);
      ctxStrip.appendChild(ctxPrivacy);
      panelFeedback.appendChild(ctxStrip);

      const formFeedback = el('form', 'fb-form');
      formFeedback.id = 'fb-form-feedback';

      const fbContent = el('textarea', 'fb-textarea');
      fbContent.id = 'fb-errata-content';
      fbContent.rows = 4;
      fbContent.maxLength = 1000;
      fbContent.required = true;

      const fbContact = el('input', 'fb-input');
      fbContact.id = 'fb-errata-contact';
      fbContact.type = 'text';
      fbContact.maxLength = 100;

      const hpFeedback = el('input', 'fb-hp');
      hpFeedback.type = 'text';
      hpFeedback.name = 'website';
      hpFeedback.tabIndex = -1;
      hpFeedback.autocomplete = 'off';
      hpFeedback.setAttribute('aria-hidden', 'true');

      const fbRow = el('div', 'fb-form-row');
      const fbCounter = el('span', 'fb-counter');
      fbCounter.id = 'fb-errata-counter';
      fbCounter.textContent = '0 / 1000';
      const fbSubmit = el('button', 'fb-submit-btn');
      fbSubmit.type = 'submit';
      fbSubmit.id = 'fb-errata-submit';
      fbRow.appendChild(fbCounter);
      fbRow.appendChild(fbSubmit);

      const fbNotice = el('div', 'fb-notice is-hidden');
      fbNotice.id = 'fb-errata-notice';
      fbNotice.setAttribute('role', 'status');

      formFeedback.appendChild(fbContent);
      formFeedback.appendChild(fbContact);
      formFeedback.appendChild(hpFeedback);
      formFeedback.appendChild(fbRow);
      formFeedback.appendChild(fbNotice);
      panelFeedback.appendChild(formFeedback);

      body.appendChild(panelFeedback);
      dialog.appendChild(body);

      // Footer
      const foot = el('div', 'fb-foot');
      const copyEmailBtn = el('button', 'fb-foot-link');
      copyEmailBtn.type = 'button';
      copyEmailBtn.id = 'act-feedback-copy-email';

      const ghLink = el('a', 'fb-foot-link');
      ghLink.id = 'lnk-feedback-github';
      ghLink.href = GITHUB_ISSUES_URL;
      ghLink.target = '_blank';
      ghLink.rel = 'noopener noreferrer';
      ghLink.textContent = 'GitHub Issues';

      foot.appendChild(copyEmailBtn);
      foot.appendChild(ghLink);
      dialog.appendChild(foot);

      modal.appendChild(dialog);
      document.body.appendChild(modal);

      this._feedbackState = {
        tab: 'comment',
        items: [],
        hasMore: false,
        loading: false,
        loadedOnce: false,
        error: '',
        submitting: false,
      };

      // Events
      closeBtn.addEventListener('click', () => this._closeFeedbackModal());
      modal.addEventListener('pointerdown', (e) => {
        if (e.target === modal) this._closeFeedbackModal();
      });

      tabComment.addEventListener('click', () => this._switchFeedbackTab('comment'));
      tabFeedback.addEventListener('click', () => this._switchFeedbackTab('feedback'));

      commentContent.addEventListener('input', () => {
        commentCounter.textContent = `${commentContent.value.length} / 1000`;
      });
      fbContent.addEventListener('input', () => {
        fbCounter.textContent = `${fbContent.value.length} / 1000`;
      });

      formComment.addEventListener('submit', (e) => {
        e.preventDefault();
        this._submitFeedbackForm('comment');
      });
      formFeedback.addEventListener('submit', (e) => {
        e.preventDefault();
        this._submitFeedbackForm('feedback');
      });

      loadMoreBtn.addEventListener('click', () => {
        if (!this._feedbackState.items.length || this._feedbackState.loading) return;
        const last = this._feedbackState.items[this._feedbackState.items.length - 1];
        if (last && last.id) this._fetchPublicComments(last.id);
      });

      copyEmailBtn.addEventListener('click', () => {
        const copyFallback = () => {
          const ta = document.createElement('textarea');
          ta.value = CONTACT_EMAIL;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand('copy');
          } catch (_) {}
          document.body.removeChild(ta);
        };
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(CONTACT_EMAIL).catch(copyFallback);
        } else {
          copyFallback();
        }
        copyEmailBtn.textContent = this._fbText(`Copied: ${CONTACT_EMAIL}`, `已复制：${CONTACT_EMAIL}`);
        clearTimeout(this._fbCopyTimer);
        this._fbCopyTimer = setTimeout(() => {
          copyEmailBtn.textContent = `${CONTACT_EMAIL}`;
        }, 2200);
      });

      return modal;
    }

    _switchFeedbackTab(tab) {
      if (!this._feedbackState) return;
      this._feedbackState.tab = tab === 'feedback' ? 'feedback' : 'comment';
      const isComment = this._feedbackState.tab === 'comment';

      const tabComment = this._id('fb-tab-comment');
      const tabFeedback = this._id('fb-tab-feedback');
      const panelComment = this._id('fb-panel-comment');
      const panelFeedback = this._id('fb-panel-feedback');

      if (tabComment) {
        tabComment.classList.toggle('is-active', isComment);
        tabComment.setAttribute('aria-selected', isComment ? 'true' : 'false');
      }
      if (tabFeedback) {
        tabFeedback.classList.toggle('is-active', !isComment);
        tabFeedback.setAttribute('aria-selected', !isComment ? 'true' : 'false');
      }
      if (panelComment) panelComment.classList.toggle('is-hidden', !isComment);
      if (panelFeedback) panelFeedback.classList.toggle('is-hidden', isComment);
      this._updateFeedbackUi();
    }

    _updateFeedbackUi() {
      const modal = this._id('feedback-modal');
      if (!modal) return;

      const setText = (id, en, zh) => {
        const node = this._id(id);
        if (node) node.textContent = this._fbText(en, zh);
      };

      setText('fb-modal-title', 'Guestbook & Feedback', '留言与勘误');
      setText(
        'fb-modal-sub',
        'Notes published after review · Errata stay private',
        '公开留言经审核后显示 · 勘误仅作者可见'
      );

      const closeBtn = this._id('act-feedback-close');
      if (closeBtn) {
        const closeLbl = this._fbText('Close', '关闭');
        closeBtn.title = closeLbl;
        closeBtn.setAttribute('aria-label', closeLbl);
      }

      setText('fb-tab-comment', 'Guestbook', '访客留言');
      setText('fb-tab-feedback', 'Report Errata', '勘误反馈');

      const authorInp = this._id('fb-comment-author');
      if (authorInp) authorInp.placeholder = this._fbText('Name (optional)', '昵称（选填，默认匿名访客）');

      const commentTa = this._id('fb-comment-content');
      if (commentTa) {
        commentTa.placeholder = this._fbText(
          'Share a thought, suggestion, or reading note...',
          '写下使用体验、建议或读史随想…'
        );
      }

      setText('fb-comment-hint', 'Shown publicly after review', '审核通过后公开显示');
      setText('fb-comment-submit', 'Submit Note', '提交留言');
      setText('fb-list-title', 'Public Notes', '已公开留言');
      setText('act-feedback-load-more', 'Load more', '加载更多');

      const ctxStr = this._buildFeedbackContext();
      const ctxNode = this._id('fb-ctx-text');
      if (ctxNode) {
        const prefix = this._fbText('Current view: ', '当前视图：');
        ctxNode.textContent = ctxStr ? prefix + ctxStr : this._fbText('Current view: Atlas', '当前视图：全图');
      }
      setText('fb-ctx-privacy', 'Author-only · Never published', '仅作者可见，绝不公开');

      const errataTa = this._id('fb-errata-content');
      if (errataTa) {
        errataTa.placeholder = this._fbText(
          'Describe the place name, border, year, or historical source issue...',
          '请描述地名、边界、年份或史料出处问题…'
        );
      }
      const errataContact = this._id('fb-errata-contact');
      if (errataContact) {
        errataContact.placeholder = this._fbText(
          'Contact (optional, author-only)',
          '联系方式（选填，仅作者可见）'
        );
      }
      setText('fb-errata-submit', 'Send to Author', '发送给作者');

      const copyBtn = this._id('act-feedback-copy-email');
      if (copyBtn && !this._fbCopyTimer) {
        copyBtn.textContent = CONTACT_EMAIL;
        copyBtn.title = this._fbText('Click to copy email', '点击复制邮箱');
      }

      this._renderFeedbackList();
    }

    _renderFeedbackList() {
      const listEl = this._id('fb-public-list');
      const moreWrap = this._id('fb-load-more-wrap');
      if (!listEl || !this._feedbackState) return;

      const st = this._feedbackState;
      listEl.textContent = '';

      if (st.loading && !st.items.length) {
        listEl.appendChild(el('div', 'fb-empty', this._fbText('Loading notes...', '正在加载留言…')));
      } else if (st.error && !st.items.length) {
        listEl.appendChild(
          el(
            'div',
            'fb-empty',
            this._fbText(
              'Guestbook service is temporarily unreachable. Please try again later or email the author below.',
              '暂无法加载留言，请稍后再试或通过下方邮箱与 GitHub 联系作者。'
            )
          )
        );
      } else if (!st.items.length) {
        listEl.appendChild(
          el('div', 'fb-empty', this._fbText('No public notes yet.', '暂无已公开留言。'))
        );
      } else {
        for (const item of st.items) {
          const card = el('article', 'fb-item');
          const meta = el('div', 'fb-item-meta');
          const author = item.author && item.author.trim() ? item.author : this._fbText('Anonymous', '匿名访客');
          meta.appendChild(el('span', 'fb-item-author', author));
          meta.appendChild(el('span', 'fb-item-date', formatShortDate(item.created_at)));
          card.appendChild(meta);

          card.appendChild(el('p', 'fb-item-body', item.content || ''));

          if (item.reply) {
            const replyBox = el('div', 'fb-reply');
            const replyHead = el('div', 'fb-reply-head');
            replyHead.appendChild(el('span', 'fb-reply-label', this._fbText('Author reply', '作者回复')));
            if (item.replied_at) {
              replyHead.appendChild(el('span', 'fb-reply-date', formatShortDate(item.replied_at)));
            }
            replyBox.appendChild(replyHead);
            replyBox.appendChild(el('p', 'fb-reply-body', item.reply));
            card.appendChild(replyBox);
          }

          listEl.appendChild(card);
        }
      }

      if (moreWrap) {
        moreWrap.classList.toggle('is-hidden', !st.hasMore || st.loading);
      }
    }

    async _fetchPublicComments(beforeId) {
      const st = this._feedbackState;
      if (!st || st.loading) return;
      st.loading = true;
      st.error = '';
      this._renderFeedbackList();

      const qs = new URLSearchParams({
        site: 'jiangshan',
        page: 'guestbook',
        limit: String(PAGE_SIZE),
      });
      if (beforeId) qs.set('before', String(beforeId));

      try {
        const res = await fetch(`${apiBase()}/messages?${qs.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const incoming = Array.isArray(data && data.items) ? data.items : [];
        st.items = beforeId ? st.items.concat(incoming) : incoming;
        st.hasMore = Boolean(data && data.hasMore);
        st.loadedOnce = true;
      } catch (err) {
        st.error = err && err.message ? err.message : 'fetch_failed';
      } finally {
        st.loading = false;
        this._renderFeedbackList();
      }
    }

    async _submitFeedbackForm(kind) {
      const st = this._feedbackState;
      if (!st || st.submitting) return;

      const isComment = kind === 'comment';
      const contentEl = this._id(isComment ? 'fb-comment-content' : 'fb-errata-content');
      const noticeEl = this._id(isComment ? 'fb-comment-notice' : 'fb-errata-notice');
      const submitBtn = this._id(isComment ? 'fb-comment-submit' : 'fb-errata-submit');
      const formEl = this._id(isComment ? 'fb-form-comment' : 'fb-form-feedback');
      const hpEl = formEl ? formEl.querySelector('.fb-hp') : null;

      if (!contentEl || !noticeEl) return;
      const content = contentEl.value.trim();

      const showNotice = (msg, isError) => {
        noticeEl.textContent = msg;
        noticeEl.classList.toggle('is-error', Boolean(isError));
        noticeEl.classList.remove('is-hidden');
      };

      if (content.length < 2) {
        showNotice(
          this._fbText('Please enter at least 2 characters.', '请至少输入 2 个字。'),
          true
        );
        return;
      }

      const payload = {
        site: 'jiangshan',
        page: 'guestbook',
        kind,
        lang: this.locale || 'zh',
        content,
        website: hpEl ? hpEl.value : '',
      };

      if (isComment) {
        const authorEl = this._id('fb-comment-author');
        if (authorEl && authorEl.value.trim()) {
          payload.author = authorEl.value.trim();
        }
      } else {
        const contactEl = this._id('fb-errata-contact');
        if (contactEl && contactEl.value.trim()) {
          payload.contact = contactEl.value.trim();
        }
        const ctx = this._buildFeedbackContext();
        if (ctx) payload.context = ctx;
      }

      st.submitting = true;
      if (submitBtn) submitBtn.disabled = true;
      noticeEl.classList.add('is-hidden');

      try {
        const res = await fetch(`${apiBase()}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 429 || data.error === 'rate_limited') {
            showNotice(
              this._fbText('Too many submissions. Please wait a minute.', '提交过于频繁，请一分钟后再试。'),
              true
            );
          } else {
            showNotice(
              this._fbText(
                'Unable to submit right now. Please use email or GitHub below.',
                '暂时无法提交，可使用下方邮箱或 GitHub 联系作者。'
              ),
              true
            );
          }
          return;
        }

        contentEl.value = '';
        const counterEl = this._id(isComment ? 'fb-comment-counter' : 'fb-errata-counter');
        if (counterEl) counterEl.textContent = '0 / 1000';
        if (isComment) {
          const authorEl = this._id('fb-comment-author');
          if (authorEl) authorEl.value = '';
          showNotice(
            this._fbText(
              'Received. Your note will appear once approved.',
              '已收到，审核通过后将公开显示。'
            ),
            false
          );
        } else {
          const contactEl = this._id('fb-errata-contact');
          if (contactEl) contactEl.value = '';
          showNotice(
            this._fbText(
              'Errata received. Visible to the author only.',
              '勘误已收到，仅作者可见。'
            ),
            false
          );
        }
      } catch (_) {
        showNotice(
          this._fbText(
            'Unable to reach feedback service. Please use email or GitHub below.',
            '暂时无法连接留言服务，可使用下方邮箱或 GitHub 联系作者。'
          ),
          true
        );
      } finally {
        st.submitting = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    }

    openFeedbackModal(initialTab = 'comment') {
      if (typeof document === 'undefined') return false;
      const modal = this._ensureFeedbackModalDom();
      this._feedbackOpen = true;
      modal.classList.remove('is-hidden');
      this._switchFeedbackTab(initialTab);
      if (this._feedbackState && !this._feedbackState.loadedOnce) {
        this._fetchPublicComments();
      }
      return true;
    }

    _closeFeedbackModal() {
      if (!this._feedbackOpen) return false;
      this._feedbackOpen = false;
      const modal = this._id('feedback-modal');
      if (modal && modal.classList) modal.classList.add('is-hidden');
      return true;
    }
  }

  function install(Ctrl) {
    Ctrl._extendPrototype(AtlasFeedbackMixin);
  }

  if (typeof window === 'undefined') return;
  const readyCtrl = window.HistoricalAtlasController;
  if (readyCtrl && typeof readyCtrl._extendPrototype === 'function') {
    install(readyCtrl);
  } else {
    (window.__ATLAS_MIXINS = window.__ATLAS_MIXINS || []).push(install);
  }
})();
