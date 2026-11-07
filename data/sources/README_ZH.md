# 出处

[English](README.md)

这里记录地图上各条史实的出处。文件只存于仓库，网站不会加载，补多少条都不影响页面速度。

## 文件

| 文件 | 内容 |
| --- | --- |
| `works.json` | 书目：短 id → `{ zh, en?, kind, url? }`，`kind` 为 `primary`（史籍）、`secondary`（今人著作）、`dataset`（数据库）或 `web` |
| `<dynasty>.json` | 该朝代的大事、地标事件与城邑出处，如 `tang.json` |
| `journeys.json` | 人物行迹站点的出处 |
| `persons.json` | 人物小传的出处 |
| `baseline.json` | 审计上线前已有、暂未补出处的记录。由脚本生成，只减不增 |

有了第一条出处再新建文件，空文件不必提交。

## 记录键

| 键 | 对应数据 |
| --- | --- |
| `milestone:<dynasty>:<year>` | `js/map_data.js` 中 `DYNASTY_DATA[].milestones` |
| `settlement:<dynasty>:<ancient>` | `DYNASTY_DATA[].settlements`；同朝代重名的第二处起加 `-2`、`-3` |
| `event:<id>` | `js/lore_data.js` 中 `PLACE_LANDMARK_EVENTS[].id` |
| `journey:<key>:<year>` | `HISTORICAL_JOURNEYS[].stops`；同一行迹同年的第二站起加 `-2`、`-3` |
| `person:<key>` | `PERSON_PROFILES` |

地标事件的 `id` 形如 `tang:692`，同朝代同年已有时依次加字母：`tang:692b`。id 一经提交就固定，事件的年份或地点改了也不改 id。

## 格式

```json
{
  "milestone:tang:692": [{ "w": "zztj", "loc": "卷205 唐纪二十一 长寿元年十月" }]
}
```

每条出处只能有这几个字段：

- `w`：书目 id，须已登记在 `works.json`
- `loc`：卷次、篇名或页码
- `url`：可选，在线原文
- `note`：可选，简短说明（如诸书记载的分歧）

一个键一行，键按字母排序。运行 `node scripts/audit_sources.js --fix` 会自动整理。

## 规则

- **每条出处都须由人对照原书核实。** 不要提交 AI 工具生成、未经核对的出处。
- 只注明书名与卷次或页码，不摘抄原文。
- 新增的大事、地标事件、城邑、行迹站点或人物必须附出处，否则 CI 不通过。
- 补完出处后运行 `node scripts/audit_sources.js --update`，把 `baseline.json` 一并提交。

```bash
node scripts/audit_sources.js                # 覆盖率
node scripts/audit_sources.js --by-dynasty   # 按朝代查看覆盖率
node scripts/audit_sources.js --check        # CI
node scripts/audit_sources.js --fix          # 整理格式
node scripts/audit_sources.js --update       # 下调基线
```
