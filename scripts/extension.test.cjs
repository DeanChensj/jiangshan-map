'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const newtabSource = fs.readFileSync(path.join(ROOT, 'extension/newtab.js'), 'utf8');
const fontsSource = fs.readFileSync(path.join(__dirname, 'fetch_fonts.js'), 'utf8');

function sceneAt({ search = '', storage, random = 0 } = {}) {
  let result;
  vm.runInNewContext(newtabSource, {
    URLSearchParams, location: { search }, window: {}, localStorage: storage,
    Math: Object.assign(Object.create(Math), { random: () => random }),
    history: { replaceState(_state, _title, url) { result = url; } },
  });
  return result;
}

function memoryStorage(initial = null) {
  let saved = initial;
  return {
    getItem() { return saved; },
    setItem(_key, value) { saved = value; },
  };
}

test('每次打开重新选场景，即使随机数相同也不会连续重复', () => {
  for (const random of [0, 0.5, 0.999999]) {
    const storage = memoryStorage();
    let previous;
    for (let i = 0; i < 100; i++) {
      const scene = sceneAt({ storage, random });
      assert.ok(scene.startsWith('index.html?'));
      assert.notEqual(scene, previous);
      previous = scene;
    }
  }
});

test('能选中所有 33 个场景，排除上次场景后仍覆盖其余场景', () => {
  const all = new Set(Array.from({ length: 33 }, (_, i) => sceneAt({ random: (i + 0.5) / 33 })));
  assert.equal(all.size, 33);
  for (const last of [0, 16, 32]) {
    const choices = new Set(Array.from({ length: 32 }, (_, i) => sceneAt({
      storage: memoryStorage(String(last)), random: (i + 0.5) / 32,
    })));
    assert.equal(choices.size, 32);
    assert.ok(!choices.has(sceneAt({ search: '?scene=' + last })));
    for (const choice of choices) assert.ok(all.has(choice));
  }
});

test('存储不可用或值损坏时仍能打开随机场景', () => {
  const throwingStorage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  for (const storage of [undefined, throwingStorage,
    ...['', '-1', '33', 'NaN', '1.5'].map(memoryStorage)]) {
    assert.equal(sceneAt({ storage, random: 0 }), 'index.html?year=-403');
  }
});

test('显式深链和调试入口不受随机选择影响，也不更改上次场景', () => {
  const storage = memoryStorage('16');
  assert.equal(sceneAt({ storage, search: '?year=741' }), undefined);
  assert.equal(sceneAt({ storage, search: '?person=sushi' }), undefined);
  assert.equal(sceneAt({ storage, search: '?scene=0' }), 'index.html?year=-403');
  assert.equal(sceneAt({ storage, search: '?scene=-1' }), 'index.html?year=2026');
  assert.equal(storage.getItem(), '16');
});

function face(family, weight, url) {
  return `@font-face {font-family: '${family}';font-weight: ${weight};src: url('${url}') format('woff2');}`;
}

async function generateFonts({ missingMa = false, force = false } = {}) {
  const writes = new Map();
  const downloads = [];
  const errors = [];
  const noto = ['400', '500'].map(w => face('Noto Sans SC', w, 'https://fonts.test/sans.woff2'))
    .concat(['400', '600', '700'].map(w => face('Noto Serif SC', w, 'https://fonts.test/serif.woff2'))).join('\n');
  const maUrl = 'https://fonts.test/l?kit=ma-subset&skey=123';
  const mockFs = {
    mkdirSync() {}, existsSync() { return false; }, readdirSync() { return []; },
    writeFileSync(file, content) { writes.set(file, content); },
  };
  await vm.runInNewContext(fontsSource, {
    __dirname, URL, Buffer,
    require: name => name === 'fs' ? mockFs : require(name),
    process: { argv: force ? ['--force'] : [], stdout: { write() {} }, exit() {} },
    console: { log() {}, error(message) { errors.push(message); } },
    fetch: async url => {
      if (url.startsWith('https://fonts.googleapis.com/')) {
        return { ok: true, text: async () => url.includes('Ma+Shan+Zheng')
          ? (missingMa ? '' : face('Ma Shan Zheng', '400', maUrl)) : noto };
      }
      downloads.push(url);
      return { ok: true, arrayBuffer: async () => Buffer.from('wOF2') };
    },
  });
  return { writes, downloads, errors, maUrl };
}

test('共用字体文件的不同字重均保留，普通和 --force 模式均只下载一次', async () => {
  for (const force of [false, true]) {
    const { writes, downloads, errors, maUrl } = await generateFonts({ force });
    assert.deepEqual(errors, []);
    assert.equal(downloads.length, 3);
    assert.equal(new Set(downloads).size, 3);
    assert.ok(downloads.includes(maUrl));
    const css = writes.get(path.join(ROOT, 'extension/assets/fonts/fonts.css'));
    assert.equal((css.match(/@font-face/g) || []).length, 6);
    for (const [family, weights] of [
      ['Noto Sans SC', ['400', '500']], ['Noto Serif SC', ['400', '600', '700']], ['Ma Shan Zheng', ['400']],
    ]) {
      for (const weight of weights) {
        assert.ok(css.includes(`font-family: '${family}';\n  font-style: normal;\n  font-weight: ${weight};`));
      }
    }
    for (const match of css.matchAll(/url\('([^']+)'\)/g)) {
      assert.ok(writes.has(path.join(ROOT, 'extension/assets/fonts', match[1])));
      assert.ok(!match[1].includes('?'));
    }
  }
});

test('缺少任一字体时失败，保留原有 fonts.css', async () => {
  const { writes, downloads, errors } = await generateFonts({ missingMa: true });
  assert.match(errors.join('\n'), /缺少字体声明：Ma Shan Zheng 400/);
  assert.equal(writes.size, 0);
  assert.equal(downloads.length, 0);
});
