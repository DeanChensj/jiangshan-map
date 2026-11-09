#!/usr/bin/env node
/**
 * scripts/fetch_fonts.js —— 把 Google Fonts 的中文字体本地化（零依赖）
 *
 * 站点 index.html 引用了 3 个 Google Fonts 字体族（Noto Serif SC /
 * Noto Sans SC / Ma Shan Zheng）。浏览器扩展需要完全离线可用，本脚本
 * 用 Chrome UA 请求 Google Fonts CSS，解析其中的 @font-face 分片
 * （unicode-range 划分的 woff2），下载到 extension/assets/fonts/files/，
 * 并生成引用本地相对路径的 extension/assets/fonts/fonts.css。
 * 浏览器仍按 unicode-range 只加载用到的分片，行为与线上完全一致。
 *
 * 幂等：已存在的 woff2 分片跳过下载；--force 时全量重新下载。
 *
 * 用法：node scripts/fetch_fonts.js [--force]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const FONTS_DIR = path.join(ROOT, 'extension', 'assets', 'fonts');
const FILES_DIR = path.join(FONTS_DIR, 'files');
const CSS_OUT = path.join(FONTS_DIR, 'fonts.css');

// 与 index.html 中的两处 Google Fonts <link> 保持一致
const CSS_URLS = [
  'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@400;500&display=swap',
  'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&text=%20%26%27CDEFHJKMNPQRSTWYabcdefghilmnoprstuvxy%E4%B8%89%E4%B8%9C%E4%B8%AD%E4%BA%94%E4%BA%BA%E4%BB%A3%E5%85%83%E5%85%AD%E5%85%B3%E5%8C%97%E5%8D%81%E5%8D%8E%E5%8D%97%E5%92%8C%E5%94%90%E5%9B%BD%E5%AE%8B%E5%B1%B1%E5%BA%8F%E6%88%98%E6%97%B6%E6%98%8E%E6%99%8B%E6%9C%9D%E6%B0%91%E6%B1%89%E6%B1%9F%E6%B8%85%E7%A7%A6%E8%A5%BF%E9%9A%8B&display=swap'
];

// Chrome UA：让 Google Fonts 返回 woff2 + unicode-range 分片格式
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const FORCE = process.argv.includes('--force');

/** 从一段 @font-face CSS 中提取键值对声明 */
function parseDeclarations(block) {
  const decls = {};
  const re = /([a-zA-Z-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block))) decls[m[1].trim().toLowerCase()] = m[2].trim();
  return decls;
}

async function main() {
  if (typeof fetch !== 'function') {
    console.error('✗ 需要 Node 18+（全局 fetch）');
    process.exit(1);
  }

  fs.mkdirSync(FILES_DIR, { recursive: true });

  const outBlocks = [];
  const downloads = []; // { url, file }
  const seenFiles = new Set();
  const seenFaces = new Map();

  for (const cssUrl of CSS_URLS) {
    process.stdout.write(`→ 获取 CSS：${cssUrl.slice(0, 90)}…\n`);
    const res = await fetch(cssUrl, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`CSS 请求失败 ${res.status}：${cssUrl}`);
    const css = await res.text();

    const faceRe = /@font-face\s*\{([^}]*)\}/g;
    let face;
    while ((face = faceRe.exec(css))) {
      const decls = parseDeclarations(face[1]);
      const src = decls['src'] || '';
      // text= 子集可能使用 /l?... 地址；按 format 识别格式，不依赖 URL 后缀。
      const urlMatch = src.match(/url\(\s*['"]?(https:\/\/[^\s)'" ]+)['"]?\s*\)\s*format\(\s*['"]woff2['"]\s*\)/i);
      if (!urlMatch) throw new Error('无法解析 woff2 字体地址：' + src);
      const url = urlMatch[1];
      const parsedUrl = new URL(url);
      const basename = path.basename(parsedUrl.pathname);
      const file = 'files/' + (/^[\w.-]+\.woff2$/.test(basename) && !parsedUrl.search
        ? basename
        : createHash('sha256').update(url).digest('hex') + '.woff2');
      const family = (decls['font-family'] || '').replace(/^(['"])(.*)\1$/, '$2');
      const weight = decls['font-weight'] || '400';
      if (!seenFaces.has(family)) seenFaces.set(family, new Set());
      seenFaces.get(family).add(weight);

      outBlocks.push(
        '@font-face {\n' +
        `  font-family: '${family}';\n` +
        `  font-style: ${decls['font-style'] || 'normal'};\n` +
        `  font-weight: ${decls['font-weight'] || 400};\n` +
        `  src: url('${file}') format('woff2');\n` +
        (decls['unicode-range'] ? `  unicode-range: ${decls['unicode-range']};\n` : '') +
        `  font-display: ${decls['font-display'] || 'swap'};\n` +
        '}'
      );
      // 只去重下载，不去重 @font-face：同一可变字体文件可供多个字重使用。
      if (!seenFiles.has(file) && (FORCE || !fs.existsSync(path.join(FONTS_DIR, file)))) {
        downloads.push({ url, file: path.join(FONTS_DIR, file) });
      }
      seenFiles.add(file);
    }
  }

  if (outBlocks.length === 0) {
    throw new Error('未从 Google Fonts CSS 解析出任何 @font-face 分片');
  }
  const required = { 'Noto Sans SC': ['400', '500'], 'Noto Serif SC': ['400', '600', '700'], 'Ma Shan Zheng': ['400'] };
  for (const [family, weights] of Object.entries(required)) {
    for (const weight of weights) {
      if (!seenFaces.get(family)?.has(weight)) {
        throw new Error(`缺少字体声明：${family} ${weight}，未更新 fonts.css`);
      }
    }
  }

  // 并发下载（限 8）
  process.stdout.write(`→ 下载 ${downloads.length} 个 woff2 分片（已缓存 ${seenFiles.size - downloads.length} 个）\n`);
  let done = 0;
  const queue = downloads.slice();
  await Promise.all(Array.from({ length: Math.min(8, queue.length) }, async () => {
    while (queue.length) {
      const job = queue.shift();
      const res = await fetch(job.url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`woff2 下载失败 ${res.status}：${job.url}`);
      fs.writeFileSync(job.file, Buffer.from(await res.arrayBuffer()));
      process.stdout.write(`  ✓ ${path.basename(job.file)} (${++done}/${downloads.length})\n`);
    }
  }));

  const cssHeader =
    '/* 江山时序 · 本地化字体（由 scripts/fetch_fonts.js 生成，勿手改）\n' +
    ' * 来源：Google Fonts（Noto Serif SC / Noto Sans SC / Ma Shan Zheng，OFL-1.1 许可）\n' +
    ' * 与 index.html 原先引用的远程 CSS 等价，仅 url 改为本地相对路径。 */\n';
  fs.writeFileSync(CSS_OUT, cssHeader + outBlocks.join('\n') + '\n');

  const totalBytes = fs.readdirSync(FILES_DIR)
    .reduce((s, f) => s + fs.statSync(path.join(FILES_DIR, f)).size, 0);
  console.log(`✓ fonts.css：${outBlocks.length} 个 @font-face；woff2 共 ${seenFiles.size} 个，合计 ${(totalBytes / 1048576).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error('✗ ' + (err && err.message ? err.message : err));
  process.exit(1);
});
