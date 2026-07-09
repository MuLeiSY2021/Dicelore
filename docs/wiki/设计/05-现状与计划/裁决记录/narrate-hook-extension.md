# 裁决：叙事记忆层-谓词扩展（narrate-hook-extension）—— 触发归一 / 链接归一 / 谓词扩 has()

- [ ] 用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 来源：叙事记忆层-谓词扩展 spec（2026-06-22，superpowers 草稿，已删——内容沉 [内层能力库 §3.1/§4.2/§4.6](../../04-子系统设计/内层能力库.md)）。spec 三件套（触发归一 watcher+`source` / 链接归一 `anchor` 边表 / 谓词扩 `has()`）**已全量实现并落 main**（`backend/src/store/narrative/` + `store/world/anchor.ts` + `expr/predicate.ts` + `store/existsMatch.ts` + `expr/evaluate.ts` + `store/evalCtx.ts` + `harness/.../handlers/event.ts`）。
> **本裁决职责**：把 spec 的三条承重设计**正式确立为权威**（沉 [内层能力库 §3.1/§4.2/§4.6](../../04-子系统设计/内层能力库.md) 已完成），并**取代** [`a-prime-completion`](a-prime-completion.md) §2/§3 提出的相反存储方案（`front_omen` 物理子表 / `anchors_json`+`surface_trigger` 列）。因 spec 已实现，本裁决属「确立权威 + 覆盖冲突提案」性质，非待开发设计——批准后 a-prime §2/§3 标废弃、待 a-prime 整体收口时一并清理。
> **前置关系**：本裁决**先行**于 a-prime §2/§3。a-prime §2/§3 的存储方案与本裁决冲突，已被实现事实否决；a-prime 顶部已注本裁决先行（见 a-prime §2/§3 注记）。

---

## 一、三条承重设计（spec 为准 · 已实现）

### 1. 触发归一：所有触发 = 一张 `watcher` 表的行 + `source` 列

- 所有触发条件（凶兆阶梯 / foreshadow 浮现 / 临时提醒）统一为 `watcher` 表的行，加 `source` 列标归属（`'manual'` 缺省 / `'front:<id>'` / `'foreshadow:<id>'`）。
- `front_omen` **不是物理表、是 `watcher WHERE source='front:<id>'` 的视图**（`frontOmenList`，`store/narrative/front.ts`）—— spec DN-2。
- foreshadow 到点浮现 = 一条 `source='foreshadow:<id>'` 的 watcher 行（复用 watcher 边沿触发 + 谓词），**非** `surface_trigger` 列。
- `watcher_set` 工具入参不裸暴露 `source`（GM 不裸调归因）；`source` 由 front/foreshadow 预声明路径写入。

### 2. 链接归一：通用 `anchor` 边表（关系图谱），非 `anchors_json`

- `anchor(owner_table, owner_id, target_table, target_id, role)` 多态边表（`store/world/anchor.ts`），每行一条"挂靠"。
- owner ∈ {plotline, foreshadow}；target ∈ {entity, front, plotline, foreshadow}。`role` 自由提示标签（`antagonist`/`location`…，不枚举不强制）。
- **正查** `anchorsByOwner`（这条线牵涉谁）/ **反查** `anchorsByTarget`（谁挂某实体上 → 到点浮现）—— spec DN-3 定为关系图谱边表（支持反查），**非** 每表一个 `anchors_json` 列。
- 谓词集成 `{anchor:has(target=墨大夫)}`（见下）。

### 3. 谓词扩 `has()` 存在性匹配（spec §3 核心）

- 谓词除「值比较」（`{张三.HP} < 30`）外扩「存在性匹配」：`{ns:has(col OP val, …)}` → 该 canon 表是否存在命中所有 `col OP val` 合取的行 → bool。
- `ns ∈ {state, plotline, front, foreshadow, log, anchor}`；算符 `= != < <= > >=`，数值比较 `CAST … AS REAL` 防 SQLite 亲和陷阱。
- 值引用沿用 `{ns:key.attr}`（`{state:张三.HP}`，state 缺省可省 ns，向后兼容旧 `{张三.HP}`）。
- 落点：`expr/predicate.ts`（`HAS_RE` + `evalPredicate` has 分支，先于比较算符切分以免内层 `>=` 被误切）+ `store/existsMatch.ts`（`makeExistsMatch` 按 ns 路由表 + 列白名单校验）+ `expr/evaluate.ts`（`EvalCtx.existsMatch`）+ `store/evalCtx.ts`（`makeEvalCtx` 统一工厂）。

### 4. 重算点扩 + since 游标

- 重算点从「仅 `sheet_update` 写后」**扩到 `event_append`/log 写后**（`handlers/event.ts` appendHandler 在 `logAppend` 后调 `recomputeWatchers`），让 `has(log:…)` 类 watcher 能被新 log 触发。
- `repeat` × 单调匹配的 **since 游标**：repeat 且 `last_fired_seq` 非空的 watcher，log 类存在性匹配注入 `seq > last_fired_seq`（`existsMatch` sinceSeq），只认上次触发后的新 log，避免同一行重复触发永真。`once` 首次命中即 disarm。

---

## 二、取代 a-prime §2/§3（冲突提案废弃）

| | a-prime §2/§3（未批准·废弃） | 本裁决（spec · 已实现） |
|---|---|---|
| front_omen | 物理子表 `front_omen(id, front_id, threshold, payload, fired)` | `watcher` 视图（`source='front:<id>'` 过滤） |
| 链接挂靠 | `plotline`/`foreshadow` 各加 `anchors_json` 列 | 通用 `anchor` 边表（正反查） |
| foreshadow 浮现 | `foreshadow.surface_trigger` 列 | `source='foreshadow:<id>'` 的 watcher 行 |

- a-prime §2/§3 的存储方案**未被实现**；实现走 spec 路线（视图 + 边表 + watcher 行）。
- **批准本裁决后**：a-prime §2/§3 标记为「被 narrate-hook-extension 取代·废弃」，待 a-prime 整体收口时由其清理；a-prime §1（叙事三表 `visible` 列）/§4/§5/§6/§7 不受影响、仍为独立欠账。

---

## 三、验收（已实现 · 真跑复核）

- 已落 main + 单测：`narrative/watcher.test.ts`（log-has once/repeat+since）、`expr/predicate.test.ts`（has 走 existsMatch）、`store/views.ts` tension_board view、`narrative/front.ts` frontOmenList。
- **真跑复核（acceptance-loop 假 GM 确定性）**：埋 `{log:has(kind=choice, pick='驰援')}` repeat watcher → 玩家选驰援 → watcher 触发 payload 回 GM、`last_fired_seq` 推进；再选驰援 → since 游标只认新 log、再次触发。front clock 推进越过阈值 → `source=front:<id>` watcher 触发。`{anchor:has(target=墨大夫)}` 反查命中。

---

## owns

- `backend/src/store/narrative/{watcher,front,plotline,foreshadow}.ts`
- `backend/src/store/world/anchor.ts`
- `backend/src/expr/{predicate,evaluate}.ts` + `backend/src/store/{existsMatch,evalCtx}.ts`
- `harness/src/dicegm/mcp/handlers/event.ts`（appendHandler 重算点）

## 完成后

设计结论已沉 [内层能力库 §3.1（has()）/ §4.2（watcher.source + 重算点 + since）/ §4.6（anchor 边表 + front_omen 视图 + foreshadow 走 watcher）](../../04-子系统设计/内层能力库.md) + [核心概念 D5/D6](../../02-领域模型/核心概念.md)。本裁决批准后随 a-prime 整体收口时一并删除（裁决记录临时·交付后删）。
