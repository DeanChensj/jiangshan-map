(function () {
  'use strict';

  var STORAGE_KEY = 'jiangshan_topic_hant';
  var origTextMap = new WeakMap();
  var origTitle = document.title;
  var origAttrMap = new WeakMap();
  var hantLoadingPromise = null;
  var isHantActive = false;

  function toHansQuery(str) {
    if (window.ZH_HANT_CONV && typeof window.ZH_HANT_CONV.toHans === 'function') {
      return window.ZH_HANT_CONV.toHans(str);
    }
    return str;
  }

  // 1. Instant Table Filter
  function initTableFilters() {
    var inputs = document.querySelectorAll('[data-filter-table]');
    for (var i = 0; i < inputs.length; i++) {
      (function (input) {
        var tableId = input.getAttribute('data-filter-table');
        var table = document.getElementById(tableId);
        if (!table) return;
        var tbody = table.tBodies && table.tBodies[0];
        if (!tbody) return;
        var countEl = document.querySelector('[data-filter-count="' + tableId + '"]');
        var clearBtn = document.querySelector('[data-filter-clear="' + tableId + '"]');
        var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr:not(.filter-empty-row)'));
        var colCount = (table.tHead && table.tHead.rows[0] && table.tHead.rows[0].cells.length) || 5;

        var emptyRow = document.createElement('tr');
        emptyRow.className = 'filter-empty-row is-hidden';
        var emptyTd = document.createElement('td');
        emptyTd.colSpan = colCount;
        emptyTd.textContent = '未检索到匹配条目';
        emptyRow.appendChild(emptyTd);
        tbody.appendChild(emptyRow);

        var rowSearchText = rows.map(function (tr) {
          var extra = tr.getAttribute('data-search') || '';
          var txt = (extra + ' ' + (tr.textContent || '')).replace(/\s+/g, ' ').trim().toLowerCase();
          return txt;
        });

        var presetBtns = Array.prototype.slice.call(
          document.querySelectorAll('.filter-preset-btn[data-filter-preset-table="' + tableId + '"]')
        );

        function syncPresetButtons(rawQ) {
          if (!presetBtns.length) return;
          var normInput = rawQ ? toHansQuery(rawQ).toLowerCase() : '';
          for (var p = 0; p < presetBtns.length; p++) {
            var pVal = (presetBtns[p].getAttribute('data-filter-preset-val') || '').trim().toLowerCase();
            var normPreset = pVal ? toHansQuery(pVal).toLowerCase() : '';
            presetBtns[p].classList.toggle('is-active', normInput === normPreset);
          }
        }

        function applyFilter() {
          var rawQ = (input.value || '').trim().toLowerCase();
          var hansQ = rawQ ? toHansQuery(rawQ).toLowerCase() : '';
          var matched = 0;
          for (var j = 0; j < rows.length; j++) {
            var haystack = rowSearchText[j];
            var show = !rawQ || haystack.indexOf(rawQ) !== -1 || (hansQ && toHansQuery(haystack).indexOf(hansQ) !== -1);
            rows[j].classList.toggle('is-filtered-out', !show);
            if (show) matched++;
          }
          emptyRow.classList.toggle('is-hidden', matched > 0 || !rawQ);
          if (countEl) {
            var countZh = rawQ ? '匹配 ' + matched + ' / ' + rows.length + ' 项' : '共 ' + rows.length + ' 项';
            var conv = window.ZH_HANT_CONV;
            countEl.textContent = isHantActive && conv ? conv.toHant(countZh) : countZh;
            if (countEl.firstChild) {
              origTextMap.set(countEl.firstChild, countZh);
            }
          }
          if (clearBtn) {
            clearBtn.classList.toggle('is-hidden', !rawQ);
          }
          syncPresetButtons(rawQ);
        }

        input.addEventListener('input', applyFilter);
        if (clearBtn) {
          clearBtn.addEventListener('click', function () {
            input.value = '';
            applyFilter();
            input.focus();
          });
        }
        for (var k = 0; k < presetBtns.length; k++) {
          (function (btn) {
            btn.addEventListener('click', function () {
              var val = btn.getAttribute('data-filter-preset-val') || '';
              var conv = window.ZH_HANT_CONV;
              input.value = val && isHantActive && conv ? conv.toHant(val) : val;
              applyFilter();
            });
          })(presetBtns[k]);
        }
      })(inputs[i]);
    }
  }

  // 2. TOC Scroll-Spy
  function initTocScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.topic-toc .toc-link[href^="#"]'));
    if (!links.length) return;
    var linkById = Object.create(null);
    var targets = [];
    for (var i = 0; i < links.length; i++) {
      var id = (links[i].getAttribute('href') || '').slice(1);
      var target = id && document.getElementById(id);
      if (target) {
        linkById[id] = links[i];
        targets.push(target);
      }
    }
    if (!targets.length) return;

    function setActive(activeId) {
      for (var j = 0; j < links.length; j++) {
        links[j].classList.toggle('is-active', links[j] === linkById[activeId]);
      }
      var activeLink = linkById[activeId];
      if (activeLink && window.innerWidth < 1080 && activeLink.scrollIntoView) {
        try {
          activeLink.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
        } catch (_) {}
      }
    }

    setActive(targets[0].id);

    if (typeof IntersectionObserver !== 'function') return;
    var obs = new IntersectionObserver(
      function (entries) {
        for (var k = 0; k < entries.length; k++) {
          if (entries[k].isIntersecting) {
            setActive(entries[k].target.id);
            break;
          }
        }
      },
      { rootMargin: '-18% 0px -68% 0px', threshold: 0 }
    );
    for (var m = 0; m < targets.length; m++) {
      obs.observe(targets[m]);
    }
  }

  // 3. Lossless Simplified <-> Traditional Chinese Toggle (lazy-loads ../js/zh_hant.js)
  function getHantHash() {
    var scripts = document.querySelectorAll('script[data-v-hant]');
    if (scripts.length) return scripts[0].getAttribute('data-v-hant') || '';
    return '';
  }

  function loadZhHantLib() {
    if (window.ZH_HANT_CONV && typeof window.ZH_HANT_CONV.toHant === 'function') {
      return Promise.resolve(window.ZH_HANT_CONV);
    }
    if (hantLoadingPromise) return hantLoadingPromise;
    hantLoadingPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      var hash = getHantHash();
      s.src = '../js/zh_hant.js' + (hash ? '?v=' + encodeURIComponent(hash) : '');
      s.onload = function () {
        if (window.ZH_HANT_CONV) resolve(window.ZH_HANT_CONV);
        else reject(new Error('ZH_HANT_CONV not initialized'));
      };
      s.onerror = function () {
        hantLoadingPromise = null;
        reject(new Error('Failed to load ../js/zh_hant.js'));
      };
      document.head.appendChild(s);
    });
    return hantLoadingPromise;
  }

  function walkTextNodes(rootEl, fn) {
    if (!rootEl || typeof document.createTreeWalker !== 'function') return;
    var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = node.parentElement;
        while (p) {
          var tag = p.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE') {
            return NodeFilter.FILTER_REJECT;
          }
          if (
            p.classList &&
            (p.classList.contains('en-sub') ||
              p.classList.contains('stop-sub-en') ||
              p.classList.contains('no-hant'))
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          if (p === rootEl) break;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var nodes = [];
    var cur;
    while ((cur = walker.nextNode())) nodes.push(cur);
    for (var i = 0; i < nodes.length; i++) fn(nodes[i]);
  }

  function applyHantState(enableHant) {
    var conv = window.ZH_HANT_CONV;
    if (enableHant && !conv) return;
    var roots = document.querySelectorAll('header, .page-shell');
    for (var r = 0; r < roots.length; r++) {
      walkTextNodes(roots[r], function (textNode) {
        if (!origTextMap.has(textNode)) {
          origTextMap.set(textNode, textNode.nodeValue);
        }
        var baseVal = origTextMap.get(textNode);
        textNode.nodeValue = enableHant ? conv.toHant(baseVal) : baseVal;
      });
      var attrEls = roots[r].querySelectorAll('[placeholder], [title]');
      for (var a = 0; a < attrEls.length; a++) {
        var el = attrEls[a];
        if ((el.classList && el.classList.contains('no-hant')) || (el.closest && el.closest('.no-hant'))) {
          continue;
        }
        if (!origAttrMap.has(el)) {
          origAttrMap.set(el, {
            placeholder: el.getAttribute('placeholder'),
            title: el.getAttribute('title'),
          });
        }
        var saved = origAttrMap.get(el);
        if (saved.placeholder !== null) {
          el.setAttribute('placeholder', enableHant ? conv.toHant(saved.placeholder) : saved.placeholder);
        }
        if (saved.title !== null) {
          el.setAttribute('title', enableHant ? conv.toHant(saved.title) : saved.title);
        }
      }
    }
    document.title = enableHant ? conv.toHant(origTitle) : origTitle;
    document.documentElement.lang = enableHant ? 'zh-Hant' : 'zh-CN';
    isHantActive = enableHant;

    var btn = document.getElementById('act-topic-hant');
    if (btn) {
      btn.setAttribute('aria-pressed', enableHant ? 'true' : 'false');
      btn.textContent = enableHant ? '简' : '繁';
      btn.setAttribute('title', enableHant ? '切换回简体中文' : '切換為繁體中文');
    }
  }

  function readSavedHantPref() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var langParam = (params.get('lang') || '').toLowerCase();
      if (langParam === 'zh-tw' || langParam === 'zh-hant') return true;
      return window.localStorage && window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function writeSavedHantPref(val) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, val ? '1' : '0');
      }
    } catch (_) {}
  }

  function initHantToggle() {
    var btn = document.getElementById('act-topic-hant');
    if (btn) {
      btn.addEventListener('click', function () {
        var nextState = !isHantActive;
        if (nextState) {
          loadZhHantLib()
            .then(function () {
              applyHantState(true);
              writeSavedHantPref(true);
            })
            .catch(function () {});
        } else {
          applyHantState(false);
          writeSavedHantPref(false);
        }
      });
    }
    if (readSavedHantPref()) {
      loadZhHantLib()
        .then(function () {
          applyHantState(true);
        })
        .catch(function () {});
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTableFilters();
    initTocScrollSpy();
    initHantToggle();
  });
})();
