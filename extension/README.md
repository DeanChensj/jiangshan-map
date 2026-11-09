# 江山时序 · 新标签页扩展

把「江山时序」交互历史舆图打包为浏览器扩展（Chrome / Edge / Firefox 通用 MV3）：
**每次打开新标签页，走进中国历史的某一年**——随机选择 33 个精选场景之一，连续打开不重复
（历代疆域、经典战役地点、人物行迹），并完整保留站内全部交互功能
（时间轴拖动、点地溯源、万能搜索、人物行迹播放、舆图寻址挑战、中英双语等）。

## 构建与安装

```bash
# 一次性：本地化 Google Fonts（203 个 woff2 文件，约 10MB，产物提交入库）
node scripts/fetch_fonts.js

# 构建（输出 dist/extension/，约 40MB）
node scripts/build_extension.js

# 回归验证（随机场景、字体解析与下载去重，无需联网）
node --test scripts/extension.test.cjs
```

本地体验：
1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`），开启「开发者模式」
2. 「加载已解压的扩展程序」→ 选择 `dist/extension/`
3. 打开新标签页（`Cmd/Ctrl + T`）——随机场景自动加载
4. 调试特定场景：地址栏输入 `chrome-extension://<扩展ID>/index.html?scene=N`（N 为 0–32）

Firefox：`about:debugging#/runtime/this-firefox` → 「临时载入附加组件」→ 选 `dist/extension/manifest.json`。

## 工作原理

- `extension/newtab.js` 在站点脚本加载**之前**运行：URL 无深链参数时，用
  `history.replaceState` 写入随机场景的查询串（`?year=-403`、`?person=sushi` 等）。
  站点自身的深链解析 `_restoreFromQuery`（js/atlas_api.js）随后照常处理，
  100% 复用站内机制（含快照/词条懒加载等待），对站点代码零侵入。
- `scripts/build_extension.js` 按白名单复制运行时文件（对齐 deploy-pages.yml 的
  部署规则），并对 index.html 做构建期转换：
  - 移除 Vercount / Cloudflare 统计脚本（MV3 禁止远程脚本）
  - Google Fonts 外链 → 本地 `assets/fonts/fonts.css`（woff2 按 unicode-range 分片）
  - 移除 SEO（canonical / og / twitter / JSON-LD）与 PWA 声明（扩展内无意义）
  - 注入 `newtab.js`
  - 站点源文件**不做任何修改**，`git pull` 上游后再跑一次构建即可同步更新
- 用 `localStorage` 记录上次场景，在其余场景中随机选择；存储不可用时退回普通随机。
- manifest 零权限声明（无 permissions / host_permissions），商店审核最简。

## 发布前必读：许可证与署名

本项目是 [DeanChensj/jiangshan-map](https://github.com/DeanChensj/jiangshan-map)
（GPL-3.0）的**非官方衍生**。发布扩展时必须：

1. **Fork 本仓库到你的账号**，以 GPL-3.0 发布源码（保留根目录 LICENSE，勿删）
2. 扩展包内已随附原项目 `LICENSE`（构建脚本自动复制）
3. 商店描述中注明：基于开源项目「江山时序」（jiangshan-map）衍生，链接原仓库与
   [在线版](https://deanchen.me/jiangshan-map/)，命名避免与原项目混淆
4. manifest 的 `homepage_url` 已指向原仓库，请保留

## 商店上架步骤（概要）

| 商店 | 入口 | 注意 |
|---|---|---|
| Chrome Web Store | [开发者信息中心](https://chrome.google.com/webstore/devconsole)（一次性 $5） | zip 上传 `dist/extension`（勿 zip 进外层目录）；审核通常数小时至数天 |
| Firefox Add-ons | [AMO](https://addons.mozilla.org/developers/) | 同一份包可直接上传；manifest 已含 gecko id |
| Edge Add-ons | [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge) | 审核较慢 |

截图与促销图可参考 jizhi-mod 的 store-assets 布局（1280×800 截图 5 张起、1400×560 促销图）。
