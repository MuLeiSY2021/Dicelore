# 裁决：暗骰 WS 类型 + loregm 域 WS 事件规约（C 组·承重建模）

- [X]  用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> **来源**：[`docs/tdd/acceptance-loop-2026-07-06/findings.md`](../../../../../tdd/acceptance-loop-2026-07-06/findings.md) RT-FE6 / RT-FE12。
> **接口规约稿**：[`1-backend-interface.md`](../../../../../tdd/acceptance-loop-2026-07-06/1-backend-interface.md) §2 第 32 行（RT-FE6）、§5 第 80 行（`hidden_roll` 已规约占位·❌ 无实现）、§5.2（RT-FE12 草案五类）。
> **代码现状**：[`packages/shared/src/stream.ts:16-31`](../../../../../packages/shared/src/stream.ts) `StreamMessageSchema` 10 类全是 play 侧、**无 `hidden_roll`**；[`packages/shared/src/presentation.ts:43-50`](../../../../../packages/shared/src/presentation.ts) `PendingRoll.shape` 仅 `outcome|contest`；loregm 侧 [`backend/src/api/lore.ts`](../../../../../backend/src/api/lore.ts) REST-only、无 WS。
> **性质**：findings 标「先 brainstorm」——本裁决先自问自答关键歧义（不向用户提问），再拍死零不确定设计。

---

## §零 brainstorm 自问自答（不向用户提问·记录关键决断）

### Q1 暗骰走不走 `pendingRoll`？

- **问**：规约稿备选「shape 加 hidden 维度 / 独立 hidden:true」，pendingRoll 要不要承载暗骰？
- **答**：**不走 pendingRoll**。pendingRoll 语义是「待掷规格、等玩家掷」（`POST /roll {eventId}` 由玩家触发）。暗骰是 GM 主动掷、结果对玩家隐，**不等玩家、不待掷**——塞进 pendingRoll 语义错位（玩家看到 pendingRoll 却不能掷、或掷了看到结果都破暗骰）。
- **决断**：暗骰 = GM 调 `resolve_outcome` / `resolve_contest` 时带 `hidden:true` 入参 → 后端**立即掷**（同步 resolve、不 stage）→ 结果入 event（`visible=0`）+ 发 `hidden_roll` WS 通知玩家「进行了判定」（只给 label、不给结果/DC/档位）。pendingRoll 仅明骰、shape 不扩。

### Q2 暗骰结果怎么存、怎么防泄露？

- **问**：暗骰结果 event 的可见性？
- **答**：暗骰结果 event `visible=0`（未披露暗值），但 **stream 全量照发**（含完整结果）——对接 [`spoiler-tiering-and-dock-diy`](spoiler-tiering-and-dock-diy.md) §一：visible 是 AI note + dock-card 显示依据，**非后端截流硬底线**。前端按 spoiler 档渲染：严格档显「进行了判定」隐结果、关闭档显完整结果。dock-card 不显 `visible=0` 的暗骰结果（除非 AI 披露翻 `visible=1`）。`hidden_roll` WS **带完整结果**（该下发下发），前端 spoiler 决定渲染多少。

### Q3 loregm WS 用 WS / SSE / 轮询？

- **问**：构建页实时刷新走哪条通道？
- **答**：**复用 dicegm 的 WS 通道**（`GET /sessions/loregm/{id}/ws`）。理由：① WS 基础设施已建（`wsHub` / `api/ws.ts`），loregm 接入成本低；② SSE 单向、与 dicegm 机制分裂；③ 轮询延迟高、浪费（构建轮次可能跑几十秒）。复用 = 两 kind 同一 WS 骨架、事件类型不同。

### Q4 loregm WS 事件范围（v1 做哪几类）？

- **问**：§5.2 草案五类（turn_started/turn_ended/toolcall/draft_delta/validate_result）+ error，v1 全做？
- **答**：v1 做 **turn_started / turn_ended / toolcall / draft_delta / error** 五类；`validate_result` 推送**推后 v2**（RT-FE11 同步端点已覆盖 on-demand 校验，WS 推送是锦上添花、非必需）。

---

## §一 RT-FE6：暗骰 WS 类型 + resolve 工具 hidden 参数

### 现状

- `PendingRollSchema.shape: z.enum(["outcome","contest"])` —— 无 hidden 维度（本裁决定调**不加**，见 Q1）。
- `StreamMessageSchema`（stream.ts:16-31）10 类无 `hidden_roll`（规约稿 §5 第 80 行已占位、实现缺）。
- 暗骰无任何承载：GM 无法做"结果对玩家隐"的判定。

### 设计

**1. resolve 工具加 `hidden` 入参（拍死）**

- `resolve_outcome` / `resolve_contest` 工具入参加 `hidden?: boolean`（默认 `false`）。
- `hidden=true` 时：
  - 后端**立即掷**（不 stage pendingRoll、不等玩家 `POST /roll`）。
  - 结果入 event：`kind=roll`（或新增 `kind=hidden_roll`，见下）、`visible=0`（未披露暗值·stream 照发）。
  - 发 `hidden_roll` WS（见下）给玩家。
  - **不发** `roll_staged` / `roll_committed`（那是明骰流程）。
- `hidden=false`（默认）时：走现有明骰流程（stage pendingRoll → 玩家 roll → roll_committed）。

**2. WS 新增 `hidden_roll` 类型（拍死）**

```ts
// packages/shared/src/stream.ts  StreamMessageSchema 扩
| { type: "hidden_roll", eventId: number, label: string, result: ..., dc?: number, band?: ... }
```

- payload `{eventId, label, result, dc?, band?}` —— **带完整结果**（该下发下发）。后端不截流，前端按 spoiler 档决定渲染多少。
- `label` = 该判定的描述（如「GM 暗中检定 NPC 的谎言」），由 GM 调工具时声明。
- 前端按 spoiler 档渲染（对接 [`spoiler-tiering-and-dock-diy`](spoiler-tiering-and-dock-diy.md) §一）：严格档显「⚜ GM 进行了一次暗骰：{label}」隐 result/dc/band、关闭档显完整结果。

**3. 暗骰结果 event 的 kind（拍死）**

- 复用现有 `kind=roll` event、`visible=0`。不新增 `kind=hidden_roll` event —— event 层用 `visible=0` 区分即可，kind 统一为 `roll`（机械事实）。
- WS 层的 `hidden_roll` 是**通知类型**、event 层的 `roll` 是**存储类型**，两层不同名是期望的（通知不含结果、存储含结果但隐）。

**4. 前端呈现（对接 RT-FE1 A2 原型）**

- 暗骰 mech：stream 里 `hidden_roll` 按 spoiler 档渲染（对接 [`spoiler-tiering-and-dock-diy`](spoiler-tiering-and-dock-diy.md) §一）：严格档显「进行了判定」隐结果/DC、关闭档显完整结果。
- 明骰内联 stream（roll_staged/roll_committed）与暗骰互不干扰。

### 决策与权衡


| 项                     | 定调                                                       | 理由                                                               |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| C1 暗骰承载            | resolve 工具`hidden:true` 入参 + 立即掷 + `hidden_roll` WS | pendingRoll 语义错位（Q1）；暗骰不等玩家                           |
| C2 pendingRoll.shape   | **不扩** hidden 维度                                       | 暗骰不走 pendingRoll；shape 保持 outcome\|contest 仅明骰           |
| C3 hidden_roll payload | `{eventId,label,result,dc?,band?}` 带完整结果              | 该下发下发；前端 spoiler 决定渲染多少（对接 spoiler-tiering §一） |
| C4 暗骰结果 event      | `kind=roll` + `visible=0`、stream 照发                     | visible=0 是未披露标记非硬底线；stream 全量下发                    |
| C5 是否新增 event kind | 不新增`hidden_roll` event kind                             | 通知层 vs 存储层分开命名                                           |
| C6 暗骰与明骰流程隔离  | 暗骰不发 roll_staged/roll_committed                        | 那是明骰流程、混发会泄露                                           |

### 交付节点

- **FE6-1**（shared）：`StreamMessageSchema` 加 `hidden_roll` 类型。
- **FE6-2**（core/工具面）：`resolve_outcome` / `resolve_contest` 加 `hidden?:boolean` 入参；`hidden=true` 走立即掷路径、结果 event `visible=0`（未披露·stream 照发）。
- **FE6-3**（后端）：暗骰掷完发 `hidden_roll` WS（带完整结果）；不发 roll_staged/roll_committed。
- **FE6-4**（前端）：`hidden_roll` 按 spoiler 档渲染（严格档隐结果、关闭档显）。
- 依赖：与 RT-FE9（spoiler 档 + visible 0/1）联动——暗骰结果 visible=0 stream 照发、前端 spoiler 渲染；与 RT-FE5 正交。

---

## §二 RT-FE12：loregm 域 WS 事件规约

### 现状

- §5 WS 10 类仅 dicegm；loregm 域 WS 事件未规约。
- 制作页「构建助手 toolcalls 显示」+「即写即读 Draft 刷新」无事件源（现状只能轮询 `get_draft`）。
- §5.2 已有草案五类（turn_started/turn_ended/toolcall/draft_delta/validate_result）+ error，标【拟·待裁决】。

### 设计

**1. 通道（拍死·Q3）**

- 复用 dicegm WS 通道：`GET /sessions/loregm/{id}/ws`（随 RT-ns 拉平路径）。
- 同 `wsHub` 基础设施、同重连机制；loregm 事件类型独立枚举。

**2. 事件类型（拍死·Q4）**

v1 做五类 + error：


| `type`         | payload                     | 触发                                                                             | 说明                                      |
| -------------- | --------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------- |
| `turn_started` | `{turnId}`                  | `send_to_builder` 收到指令、开始一轮                                             | 同 dicegm 回合骨架                        |
| `turn_ended`   | `{turnId, seq}`             | build GM 一轮跑完                                                                | 对接`get_draft` 可回读                    |
| `toolcall`     | `{tool, args, result?, ok}` | build GM 每调一次`write_lore`/`add_npc`/`add_pool`/`write_rule`/`set_manifest`… | 前端「显示调了哪些工具」                  |
| `draft_delta`  | `{seq, changes}`            | build GM 写 Draft（onBuilderWrite hook）                                         | 即写即读刷新、对齐`GET …/draft` 分域结构 |
| `error`        | `{code, message}`           | 构建出错                                                                         | 同 dicegm                                 |

- `validate_result`（§5.2 草案第 5 类）**推后 v2**：RT-FE11 同步端点 `POST /draft/validate` 已覆盖 on-demand 校验；WS 自动推送校验报告是锦上添花、非 v1 必需。

**3. 实现靠 build GM 侧 hook（拍死）**

- `toolcall`：build-mcp 工具调用 hook（类似 dicegm 侧 `onCanonWrite` 缝A）。每次 build GM 调工具 → hook 发 `toolcall` WS。
- `draft_delta`：`onBuilderWrite` hook（Draft 写操作 → 映射分域 delta）。对齐 `GET …/draft` 的分域结构（`{files, snapshot}`）。
- `turn_started` / `turn_ended`：`send_to_builder` 入口 / 出口发。
- → 复用 dicegm 的缝A hook 模式，loregm 侧对称建一套。

**4. loregm WS 与 dicegm WS 的关系**

- 两 kind 同一 WS 骨架（`wsHub`）、**事件类型枚举不同**（dicegm 10 类 + hidden_roll；loregm 5 类）。
- 客户端按 `kind` 订阅对应枚举。
- `StreamMessageSchema` 扩为两 kind 的联合，或拆 `DiceStreamMessage` / `LoreStreamMessage` 两个 schema —— **定调拆两个 schema**（类型清晰、前端按 kind 切换）。

### 决策与权衡


| 项                  | 定调                                                    | 理由                             |
| ------------------- | ------------------------------------------------------- | -------------------------------- |
| C1 通道             | 复用 dicegm WS（`GET /sessions/loregm/{id}/ws`）        | 基础设施已建、低成本（Q3）       |
| C2 v1 事件范围      | turn_started/turn_ended/toolcall/draft_delta/error 五类 | validate_result 推后 v2（Q4）    |
| C3 toolcall 实现    | build-mcp 工具调用 hook                                 | 类缝A、对称 dicegm onCanonWrite  |
| C4 draft_delta 实现 | onBuilderWrite hook → 分域 delta                       | 即写即读、对齐 get_draft 分域    |
| C5 schema 拆分      | 拆 DiceStreamMessage / LoreStreamMessage                | 类型清晰、前端按 kind 切         |
| C6 validate_result  | v2                                                      | RT-FE11 同步端点已覆盖 on-demand |

### 交付节点

- **FE12-1**（shared）：拆 `LoreStreamMessageSchema`（5 类 + error），与 `DiceStreamMessage` 分离。
- **FE12-2**（后端 api/lore.ts）：挂 `GET /sessions/loregm/{id}/ws` 路由，接 `wsHub`。
- **FE12-3**（后端 build GM）：加 `onBuilderWrite` hook（→ draft_delta）+ build-mcp 工具调用 hook（→ toolcall）+ turn_started/turn_ended。
- **FE12-4**（前端 build.html）：构建助手 toolcalls 显示 + Draft 即写即读刷新（接 WS）。
- 依赖：session-surface-flatten（RT-ns 路径）先行或同波；wsHub 基础设施已就绪。

---

## 交付顺序与依赖总览

- RT-FE6：与 RT-FE9（spoiler 档 + visible 0/1·stream 全发）联动、与 RT-FE5 正交；可同波 RT-FE5/FE9。
- RT-FE12：依赖 session-surface-flatten（RT-ns）先行或同波；wsHub 已就绪。
- 两者正交，可分属不同波次。
- **承重提示**：RT-FE6 改 resolve 工具入参 + 新 WS 类型、RT-FE12 新建 loregm WS 通道 + 两套 hook —— 均属承重建模，进波前必须用户勾批准。
