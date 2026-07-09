# 裁决：A′ 落地收口 —— 叙事层数据模型半截工程补完

- [ ] 用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 来源：A′ 拱心石 spec（2026-06-21 草稿，已删——内容沉 wiki）：[核心概念 §2 D6](../02-领域模型/核心概念.md) + [内层能力库 §4.6/§4.7/§4.8](../04-子系统设计/内层能力库.md)。spec 全对，但开发到一半转去梳理项目包结构，留下半截工程：物理表骨架 + 视图 + 叙事八工具已落，**读写工具还停在旧 sheet 范式、叙事三表缺可见性/锚点/触发、front_omen/记忆工具/presentation 接视图层 未落**。本裁决把 7 条欠账 derive 到零不确定，待用户批准后进交付波。
> **TDD 纪律**：本裁决未批准前不开发（acceptance-loop 铁律：期望先于实现）。批准后按 roadmap-delivery-workflow 切 DAG、一欠账一节点 worktree 隔离交付。

---

## 欠账清单（7 条，按依赖序）

| # | 欠账 | 核心决策 | 依赖 |
|---|------|----------|------|
| 1 | 叙事三表补 `visible` 列 | visible 与 status 正交，同构 sheet 三态 | — |
| 2 | `front_omen` 子表物化 | 凶兆阶梯 = 阈值→payload，复用 watcher 边沿触发；payload 语义="凶兆意图"非成品散文 | front clock_ref |
| 3 | `plotline`/`foreshadow` 的 `anchors_json` + `foreshadow.surface_trigger` | 锚点关联实体/front；surface_trigger 到点浮现提醒 | — |
| 4 | state 类型化工具 + 删裸 `sheet_*` | player_card/npc_list/world_state + player_update/npc_update/world_update（kind 由工具名携带）；替代品就位后删 sheet_get/list/update | — |
| 5 | relation 工具 | relation_set/relation_query（社交张力结构化查询）| 4（共用类型化范式）|
| 6 | 记忆工具 | mark_moment/history_compact/recall（表已建）| — |
| 7 | presentation 接视图层（= RT-FE4 根）| buildSnapshot 接 lore/叙事表/视图；PresentationSnapshotSchema 加 plotlines/foreshadows/lore 字段 + delta | 1（叙事表 visible 先补）|

---

## §1 叙事三表补 visible 列

### 现状
front/plotline/foreshadow 建表只有 status、无 visible 列（`db.ts:75-86`）。核心概念 §2.4 已定：visible 与 status 正交，叙事三表要补 visible 同构 sheet。

### 设计
- 三表各加 `visible INTEGER NOT NULL DEFAULT 0` 列（0 默认隐 / 1 已 show / 2 强制隐暗值），与 state/lore/pool 同构。
- `show`/`reveal_once` 机制扩到叙事三表。叙事表是行级对象，show 粒度=整行（`show front X` → 该 front visible=1）【拟·C1】。
- 默认值：front 全程 visible=0（GM 工具不下发玩家）；plotline/foreshadow 默认 0，GM show 才示玩家。
- 快照 participant：叙事三表已注册（`snapshot.ts` defaultParticipants），加 visible 列后 capture/restore 自动含（整表 dump）。

### 验收
- 假 GM plant foreshadow（visible=0）→ GET /presentation 不含该 foreshadow → GM show → 含。
- front 始终不进玩家 snapshot。

---

## §2 front_omen 子表物化

### 现状
`front_omen` 表未建（spec §3 规定未落）。凶兆阶梯现仅团本包格式 `fronts/*.md`（frontmatter Clock + 阶梯表）+ `buildMcp.add_front` 接 omens，运行时未物化。团本与manifest D1 标"凶兆阶梯 → watcher 物化仍欠主题 A2"。

### 设计
- 新建 `front_omen` 表：
  ```sql
  front_omen(id INTEGER PK AUTOINCREMENT, front_id TEXT, threshold INTEGER,
             payload TEXT, fired INTEGER DEFAULT 0,
             FOREIGN KEY(front_id) REFERENCES front(id))
  ```
- import：`fronts/*.md` 凶兆阶梯表每行 → `front_omen` 一行（threshold + payload）。
- 触发：复用 watcher 边沿触发机制——front 的 clock（state clock_ref）推进时，比对 front_omen.threshold，越过未 fired 的 → 触发 payload 给 GM、`fired=1`。**不新建独立触发器**，用 front 专用重算函数（watcher 谓词扩展是 spec §6 正交欠账，不混）【拟·C2】。
- **payload 语义="凶兆意图"**（spec §6）：payload 是给 GM 的指令/意图，非成品散文——数值到点时实际场景常偏离预写设定，让 GM 据当前 scene 现编落地。GM 收到 payload 后 narrate 落地。

### 验收
- 团本 `fronts/X.md` 阶格 [3,6,9] → import 后 front_omen 三行 → clock 推进到 6 → threshold=3,6 两行 fired、payload 回 GM → GM narrate。

---

## §3 plotline/foreshadow 锚点 + surface_trigger

### 现状
spec §3 规定 plotline.anchors_json、foreshadow.surface_trigger + anchors_json，均未建（db.ts 只有 id/title/summary/status 等）。

### 设计
- `plotline` 加 `anchors_json TEXT`（JSON 数组，关联实体/front id）。
- `foreshadow` 加 `surface_trigger TEXT`（到点浮现提醒条件，谓词 expr）+ `anchors_json TEXT`。
- **anchors_json 语义**：plotline/foreshadow 关联的实体（state entity）或 front id，供 GM 检索"这条线牵涉谁"。
- **surface_trigger 语义**：foreshadow 的"到点浮现"——条件满足时提醒 GM 该伏笔可回收。走 watcher 谓词机制（与 front_omen 同机制；事件匹配"玩家选了 X"留 spec §6 谓词扩展）【拟·C3】。
- 工具：`plotline_open`/`foreshadow_plant` 入参加可选 anchors/surface_trigger。

### 验收
- plant foreshadow 带 surface_trigger `{玩家.境界}>=金丹` → 玩家升金丹 → GM 收提醒"伏笔 X 可回收"。

---

## §4 state 类型化工具 + 删裸 sheet_*

### 现状
state 表已加 kind 列，但读写工具还停在 kind 无关的裸 `sheet_get/list/update/show`（`harness/src/dicegm/mcp/handlers/sheet.ts`）。spec §5 说"替代品就位后删除"——替代品（player_card/npc_list 等）没落。

### 设计
- 类型化读：`player_card(entity)` / `npc_list(filter?)` / `world_state(entity?)`——kind 由工具名携带，查对应 kind 视图。
- 类型化写：`player_update(entity, mutations[])` / `npc_update` / `world_update`——kind 由工具名携带写 state。全声明式（ToolDecl→toolgen），守 DT-9。
- 删裸 `sheet_get`/`sheet_list`/`sheet_update`（替代品就位后）。**保留 `sheet_show`**（可见性工具，kind 无关通用）。
- 裸 `sheet_update` 的"任意 attr 即兴写"能力：类型化工具 attr 声明期固定（toolgen writeMatch :param 须 ASCII），即兴任意 attr 保留裸 `sheet_update` 作"即兴兜底"（写 kind=world），删 sheet_get/list（替为类型化读）【拟·C4】。AI 即兴写 npc 任意 attr 的张力（backlog-core A1 旁注）随本节决。

### 验收
- GM 调 npc_list → 返回 kind=npc 的 entity；调 npc_update 写 kind=npc；裸 sheet_get 调用 → tool-not-found（已删）；裸 sheet_update 仍可即兴写 kind=world。

---

## §5 relation 工具

### 现状
relation 视图已建（`views.ts`，rel_object 非空行），但无 relation_set/relation_query 工具。

### 设计
- `relation_set(subject, object, dim, value)`：写 state 行（rel_object/rel_dim 非空）。
- `relation_query(subject?|object?, dim?, op?, value?)`：查"X 的所有关系"/"谁对 Y 敌意≥N"。
- 全声明式，守 DT-9。
- relation 存储已在 state（rel_* 列），relation_set 是 state 写的包装；独立工具（语义清晰、查询侧独立）【拟·C5】。

### 验收
- relation_set(张三, 李四, 敌意, 50) → state 行 rel_object=李四 → relation_query(张三) 返回该关系。

---

## §6 记忆工具

### 现状
log+is_moment + history 表已建，但 mark_moment/history_compact/recall 工具未落。

### 设计
- `mark_moment(seq)`：标 log 行 is_moment=1（GM 标关键时刻）。
- `history_compact(seq_from, seq_to)`：agent 读一段 log、写一条 history 摘要（优先保留 moment）。触发时机=GM 手动调（agent 自判何时压缩）【拟·C6】。
- `recall(query)`：先查 history+moment、再兜底 FTS log。可声明式（纯 FTS 读）。
- 全声明式（recall 纯读可声明；mark_moment/history_compact 写原语 + 声明包装）。

### 验收
- GM mark_moment(seq=5) → log 行 is_moment=1 → history_compact(1,10) → history 一行摘要 → recall("伏笔X") 命中 history。

---

## §7 presentation 接视图层（= RT-FE4 根）

### 现状
`buildSnapshot`（`api/presentation.ts`）只取 state sheet cells（statusMenu），不接 lore/叙事表/视图。RT-FE4 finding：前端"剧情线/世界书浮窗"走 GET /presentation 或 WS delta 均拿不到 plotline/world。**根因**：A′ 视图层建了、presentation 层没接上。

### 设计（承接 acceptance-loop RT-FE4 讨论 + 用户 2026-07-08 倾向）
- **下发机制**：扩 `PresentationSnapshotSchema` 加 `plotlines?` / `foreshadows?` / `lore?` 字段 + `PresentationChangesSchema` 加对应 delta（upsert/remove）。不另起端点（dock-card dc-meta select 单源从 snapshot 取）。
- **玩家可见范围**（对接 RT-FE9 防剧透）：
  - plotline：`active`+`closed` 下发（剧情线是玩家已知主线走向）【拟·C7】；front 不下发（GM 工具）。
  - foreshadow：只下 `recalled` 且 `visible=1`（planted 剧透不下发、recalled 仍需 GM show——§4.6.1）。
  - lore：`visible=1` 下发。
- **buildSnapshot 接视图层**：plotline/foreshadow/lore 查询走 §4.7 视图或直接表（按 visible/status 过滤）。
- **dock-card `![front]` 组件**（dock-card-template §二）：front 不下发玩家 → 该组件仅 GM 视图/作者预览用【拟·C8】。
- **依赖**：§1（叙事三表 visible）先落，否则 recalled foreshadow 无法按 visible 过滤。

### 验收
- 假 GM plant foreshadow（planted,visible=0）→ snapshot.foreshadows 不含 → recall+show（recalled,visible=1）→ snapshot.foreshadows 含。
- plotline active/closed 进 snapshot.plotlines；front 不进。
- lore visible=1 进 snapshot.lore。
- WS delta：foreshadow recalled → delta.foreshadows 含 upsert。

---

## 待用户确认清单

| # | 项 | 推荐值 | 你的定调 |
|---|----|--------|----------|
| C1 | 叙事表 show 粒度 | 整行（叙事对象是整体）| |
| C2 | front_omen 触发实现 | front 专用重算（watcher 谓词扩展正交）| |
| C3 | foreshadow surface_trigger 机制 | watcher 谓词（事件匹配留谓词扩展）| |
| C4 | 裸 sheet_update 去留 | 保留作"即兴兜底"（写 kind=world），删 sheet_get/list | |
| C5 | relation 工具独立性 | 独立工具（语义清晰）| |
| C6 | history_compact 触发时机 | GM 手动调 | |
| C7 | plotline closed 是否下发玩家 | active+closed 都下发 | |
| C8 | dock-card front 组件消费者 | GM 视图/作者预览专属 | |

---

## 验收（整体）

- 7 条欠账各自 §验收 + TDD：acceptance-loop curl/playwright 先红后绿。
- 真跑（假 GM 确定性）验证 presentation 接视图层后玩家能拿到 plotline/foreshadow/lore。
- 期望首跑见红（欠账未实现 = 红）。

## owns（预期触及，非独占）

- `backend/src/store/db.ts`（建表加列：visible/anchors_json/surface_trigger/front_omen 表）
- `backend/src/store/narrative/*`（CRUD 扩 visible/anchors）
- `backend/src/store/sheet/visibility.ts`（show 扩叙事表）
- `backend/src/toolgen/*` + `backend/src/stdlib/*`（类型化工具/relation/记忆工具声明）
- `harness/src/dicegm/mcp/handlers/sheet.ts`（删裸 sheet_*）
- `packages/shared/src/presentation.ts`（snapshot schema 加字段）
- `backend/src/api/presentation.ts`（buildSnapshot 接视图层）
- `backend/src/store/views.ts`（视需补视图）
- 团本 import（`catalog/import.ts` front_omen 物化）

## 完成后

沉淀进 [04-子系统设计/内层能力库](../../04-子系统设计/内层能力库.md) §4.6/§4.7/§4.8（欠账转已落）+ [玩家客户端-接口](../../04-子系统设计/玩家客户端-接口.md)（presentation 扩字段·RT-FE4 收口）+ 关 backlog-core 主题 A′ / A2-A5 + 关 acceptance-loop RT-FE4 + 勾路线图；删本裁决文件 + 删 A′ spec 草稿。
