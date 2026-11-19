#!/usr/bin/env node
/**
 * scripts/build_extension.js —— 构建浏览器扩展包（零依赖）
 *
 * 把本仓库的静态站点打包为 MV3 新标签页扩展（Chrome / Edge / Firefox
 * 共用一份 manifest）。流程：
 *
 *   1. 清空并按白名单复制运行时文件到 dist/extension/
 *      （白名单与 .github/workflows/deploy-pages.yml 的部署规则对齐）
 *   2. 转换 index.html：移除 SEO/PWA/统计/远程字体等网站专属内容，
 *      注入本地字体样式与 extension/newtab.js（随机场景）
 *   3. 写入 manifest.json（来自 extension/manifest.template.json）
 *   4. 断言：无任何远程 script/link 引用、newtab.js 已注入、
 *      index.html 引用的本地资源均存在于包内
 *
 * 前置：先运行 node scripts/fetch_fonts.js 生成本地字体。
 * 用法：node scripts/build_extension.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXT = path.join(ROOT, 'extension');
const OUT = path.join(ROOT, 'dist', 'extension');

/* ------------------------------------------------------------------ */
/* 复制                                                                */
/* ------------------------------------------------------------------ */

const COPY_DIRS = ['css', 'js', 'assets/terrain', 'assets/icons', 'assets/audio'];
const COPY_FILES = [
  'index.html',
  'assets/favicon.svg',
  'assets/terrain_relief.webp',
  'LICENSE'
];
const COPY_FROM_EXT = [
  // [源（相对 extension/）, 目标（相对包根）]
  ['newtab.js', 'newtab.js'],
  ['assets/fonts', 'assets/fonts'],
  ['icons', 'icons'],
  ['manifest.template.json', 'manifest.json']
];

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true, filter: (p) => !p.includes('.DS_Store') });
}

/* ------------------------------------------------------------------ */
/* index.html 转换（逐行处理，对行号漂移免疫）                          */
/* ------------------------------------------------------------------ */

const removed = { canonical: 0, ogTwitter: 0, jsonLd: 0, pwa: 0, fonts: 0, analytics: 0 };

function transformIndexHtml(html) {
  const lines = html.split('\n');
  const out = [];
  let inJsonLd = false;
  let fontsLinkWritten = false;

  for (const raw of lines) {
    const line = raw.trim();

    // JSON-LD 结构化数据块（<script type="application/ld+json"> ... </script>）
    if (inJsonLd) {
      if (/<\/script>/.test(line)) inJsonLd = false;
      removed.jsonLd++;
      continue;
    }
    if (/<script\s+type="application\/ld\+json"/.test(line)) {
      if (!/<\/script>/.test(line)) inJsonLd = true;
      removed.jsonLd++;
      continue;
    }

    // canonical / hreflang
    if (/<link rel="canonical"/.test(line) || /<link rel="alternate" hreflang=/.test(line)) {
      removed.canonical++;
      continue;
    }
    // Open Graph / Twitter 卡片
    if (/<meta property="og:/.test(line) || /<meta name="twitter:/.test(line)) {
      removed.ogTwitter++;
      continue;
    }
    // PWA：manifest 链接、apple-touch-icon、PWA meta
    if (/<link rel="manifest"/.test(line) ||
        /<link rel="apple-touch-icon"/.test(line) ||
        /name="mobile-web-app-capable"/.test(line) ||
        /name="apple-mobile-web-app-/.test(line)) {
      removed.pwa++;
      continue;
    }
    // Google Fonts：preconnect 与远程样式 —— 首条替换为本地字体样式
    if (/rel="preconnect"[^>]*fonts\.(googleapis|gstatic)\.com/.test(line)) {
      removed.fonts++;
      continue;
    }
    if (/fonts\.googleapis\.com\/css2/.test(line)) {
      removed.fonts++;
      if (!fontsLinkWritten) {
        out.push('  <link rel="stylesheet" href="assets/fonts/fonts.css" />');
        fontsLinkWritten = true;
      }
      continue;
    }
    // 统计脚本：Vercount 与 Cloudflare Web Analytics（MV3 CSP 禁止远程脚本）
    if (/<!-- Analytics:/.test(line) ||
        /events\.vercount\.one/.test(line) ||
        /cloudflareinsights\.com/.test(line)) {
      removed.analytics++;
      continue;
    }

    // 站点脚本之前注入随机场景脚本（必须在任何 DOMContentLoaded 监听注册前执行）
    if (/src="js\/china_geo_data\.js/.test(line)) {
      out.push('  <script src="newtab.js"></script>');
    }

    out.push(raw);
  }

  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* 断言                                                                */
/* ------------------------------------------------------------------ */

function fail(msg) {
  console.error('✗ ' + msg);
  process.exit(1);
}

function assertTransformations() {
  const expect = { canonical: 4, ogTwitter: 13, pwa: 6, fonts: 4, analytics: 3 };
  const problems = [];
  if (removed.jsonLd < 2) problems.push('JSON-LD 块未移除');
  for (const [k, min] of Object.entries(expect)) {
    if (removed[k] < min) problems.push(`${k} 仅移除 ${removed[k]} 处（预期 ≥${min}），上游 index.html 结构可能已变化`);
  }
  if (problems.length) {
    fail('index.html 转换结果与预期不符：\n  - ' + problems.join('\n  - '));
  }
}

function assertPackage(outHtml) {
  // 1. 无远程 script/link 引用
  const remoteRefs = [...outHtml.matchAll(/<(script|link)\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => /https?:\/\//.test(tag));
  if (remoteRefs.length) {
    fail('仍存在远程 script/link 引用：\n  ' + remoteRefs.join('\n  '));
  }
  // 2. newtab.js 已注入
  if (!/src="newtab\.js"/.test(outHtml)) fail('newtab.js 未注入');
  // 3. 本地资源存在性（script src / link href，忽略 ?v= 指纹）
  const missing = [];
  for (const m of outHtml.matchAll(/<(script|link)\b[^>]*?(?:src|href)="([^"?]+)(?:\?[^"]*)?"/g)) {
    const ref = m[2];
    if (/^(https?:|data:|#)/.test(ref)) continue;
    if (!fs.existsSync(path.join(OUT, ref))) missing.push(ref);
  }
  if (missing.length) fail('包内缺失被引用的文件：\n  ' + [...new Set(missing)].join('\n  '));
  // 4. manifest 合法
  const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'));
  if (manifest.manifest_version !== 3 || manifest.chrome_url_overrides.newtab !== 'index.html') {
    fail('manifest.json 内容异常');
  }
  // 5. data-v-* 懒加载指纹对应的文件存在
  const appTag = outHtml.match(/<script id="atlas-app-script"[^>]*>/);
  if (appTag) {
    for (const m of appTag[0].matchAll(/data-v-([a-z]+)="([0-9a-f]{8})"/g)) {
      const map = { snapshots: 'atlas_snapshots', i18n: 'i18n_dict', lore: 'lore_detail', pinyin: 'event_pinyin', hant: 'zh_hant', quiz: 'atlas_quiz' };
      const file = path.join(OUT, 'js', (map[m[1]] || m[1]) + '.js');
      if (!fs.existsSync(file)) fail('懒加载文件缺失：' + file);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 报告                                                                */
/* ------------------------------------------------------------------ */

function dirSize(p) {
  let total = 0;
  for (const ent of fs.readdirSync(p, { withFileTypes: true })) {
    const fp = path.join(p, ent.name);
    total += ent.isDirectory() ? dirSize(fp) : fs.statSync(fp).size;
  }
  return total;
}

function report() {
  const fmt = (n) => (n / 1048576).toFixed(1) + ' MB';
  console.log('\n包体构成（dist/extension/）：');
  for (const ent of fs.readdirSync(OUT, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (ent.isDirectory()) {
      console.log(`  ${ent.name.padEnd(22)} ${fmt(dirSize(path.join(OUT, ent.name)))}`);
    }
  }
  const total = dirSize(OUT);
  const count = fs.readdirSync(OUT, { recursive: true }).filter((f) => fs.statSync(path.join(OUT, f)).isFile()).length;
  console.log(`  合计 ${count} 个文件，${fmt(total)}（商店 zip 压缩后通常显著更小）`);
}

/* ------------------------------------------------------------------ */

function main() {
  // 前置检查：本地字体已生成
  if (!fs.existsSync(path.join(EXT, 'assets', 'fonts', 'fonts.css'))) {
    fail('未找到本地字体，请先运行：node scripts/fetch_fonts.js');
  }

  // 1. 清空并复制
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const d of COPY_DIRS) copyDir(path.join(ROOT, d), path.join(OUT, d));
  for (const f of COPY_FILES) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
  for (const [src, dest] of COPY_FROM_EXT) copyDir(path.join(EXT, src), path.join(OUT, dest));

  // 2. 转换 index.html
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const outHtml = transformIndexHtml(html);
  fs.writeFileSync(path.join(OUT, 'index.html'), outHtml);

  // 3-5. 断言
  assertTransformations();
  assertPackage(outHtml);

  console.log('✓ index.html 转换：移除 canonical/hreflang ' + removed.canonical +
    '、og/twitter ' + removed.ogTwitter + '、JSON-LD ' + removed.jsonLd +
    '、PWA ' + removed.pwa + '、远程字体 ' + removed.fonts + '、统计 ' + removed.analytics + ' 处');
  console.log('✓ 已注入 newtab.js（随机场景）与本地字体样式');
  console.log('✓ 断言全部通过');
  report();
  console.log('\n加载方式：chrome://extensions → 开发者模式 → 加载已解压的扩展程序 → 选择 dist/extension');
}

main();
