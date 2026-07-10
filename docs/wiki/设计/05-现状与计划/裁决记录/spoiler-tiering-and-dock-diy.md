# 裁决：防剧透 spoiler 档 + visible 语义 + dock-card DIY 持久化（A 组）

- [ ] 用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> **来源**：[`docs/tdd/acceptance-loop-2026-07-06/findings.md`](../../../../../tdd/acceptance-loop-2026-07-06/findings.md) RT-FE9 / RT-FE10。
> **接口规约稿**：[`1-backend-interface.md`](../../../../../tdd/acceptance-loop-2026-07-06/1-backend-interface.md) §2 第 34 行（RT-FE9）。
> **性质**：RT-FE9 的防剧透/visible 设计。**本裁决推翻 findings 原文「零端点改动」与原型 `cfg-note`「强制隐藏值始终不显示·不破硬底线」**——经用户多轮澄清，visible 与 spoiler 是两个正交层面，stream 全量下发。RT-FE10 的设计实质已在 [`dock-card-template`](dock-card-template.md) §三/§四 定调，本裁决只做确认引用。

---

## §一 RT-FE9：visible 语义 + spoiler 防剧透档

### 两层正交模型（核心·拍死）

| 层面 | 是什么 | 谁定 | 取值 |
|------|--------|------|------|
| **visible（数据层）** | 「是否已披露给玩家」的标记。**双重角色**：① **AI 的 note**——AI 据此知道哪些能对玩家说、哪些要披露走工具（`reveal_once`/`sheet_show` 把 0→1）；② **dock-card 显示依据**——dock-card select 显 `visible=1`、隐 `visible=0` | 数据写入时（作者/GM/AI 工具） | `0` / `1` |
| **spoiler 档（呈现层）** | 纯前端渲染档位，**每种 GM 行为**按档渲染不同详细度 | 玩家切换（存 session-meta） | `严格` / `宽松` / `关闭` |

**两层正交**：visible 是数据标记（0/1），spoiler 是前端渲染档。visible=0 的数据在 stream 照发，前端按 spoiler 档 + dock-card 规则决定显不显、显多少。

### 现状

- [`SheetCellSchema`](../../../../../packages/shared/src/presentation.ts:16) `visible: z.number()`，store 写 `0` / `1`。
- `GET /events?visibleOnly=` 现为布尔参数。
- 术语表「可见性/visible」：对玩家是否可见标记，默认拒绝。
- 原型 `play.html:385` cfg-note「强制隐藏值始终不显示·防剧透只调额外过滤层·不破硬底线」——**本裁决推翻**：visible=0 不再是「永不下发硬底线」，stream 照发、前端按 spoiler/dock-card 渲染。

### 设计

**1. visible 语义（拍死·0/1）**

- `0` = **未披露**（暗值、GM 私藏、未揭示 cell、暗骰结果）。
- `1` = **已披露**（玩家可见）。
- **AI note 角色**：AI 看 `visible=0` 知道「这条没给玩家看，叙述里别直接说」；要披露走 `reveal_once`（快照披露一次）/ `sheet_show`（持久翻 visible=1）。
- **dock-card 显示依据**：dock-card select 默认显 `visible=1`、隐 `visible=0`（DIY 查询边界 = `visible=1`，对接 [`dock-card-template`](dock-card-template.md) §三 C3）。
- **不再有「硬底线永不下发」**：visible=0 的数据 stream 照发，前端按 spoiler 档 / dock-card 规则决定显不显。AI 能否剧透靠 L2 Principles 教（不剧透未披露内容）+ L1 工具（reveal 走工具），不靠后端截流。

**2. stream 全量下发（拍死）**

- WS stream + `GET /events` 回填**全量下发**，含 `visible=0` 的改动事件（sheet 改、暗骰结果等）——后端 stream/events 不做 visible 过滤。
- `visibleOnly` 查询参数：**废弃**（或保留但默认全量）。前端拿到全量后按 spoiler 档 + dock-card 规则本地渲染。
- 理由：visible 是 AI note + 前端渲染依据，数据要到前端才能按 spoiler 渲染；后端截流 = 前端拿不到数据无法按档显隐。

**3. spoiler 档（前端渲染层·拍死）**

- 三档：`严格` / `宽松` / `关闭`。
- **每种 GM 行为**在前端有渲染定义，按 spoiler 档渲染不同详细度。行为清单（非穷尽，前端实现时按原型 `play.html` 各 class 定义）：
  - **暗骰**（`hidden_roll`）：严格档显「进行了判定」隐结果/DC、关闭档显完整结果。
  - **sheet 改动**（`visible=0` 的 cell 改）：严格档不显、关闭档显。
  - **mechanics**（verdict/mutation/watcher_fired）：按档显隐/详略。
  - **reveal/watcher_fired 事件**：按档渲染。
  - narration stream（叙事）、choices（选项）、pendingRoll（明骰待掷）：**不受 spoiler 影响**（叙事/选项/明骰始终显，否则破坏可玩性）。
- 默认档：**严格**。
- 档位存 session-meta（key `spoiler_tier`，值 `strict`/`loose`/`off`），经统一 config 端点读写（见下「4」）。

**4. 档位读写端点（拍死·统一 session config）**

```
POST /sessions/{kind}/{id}/config
  body: { spoilerTier?: "strict"|"loose"|"off", model?: string, ... }   // 部分更新，只传要改的字段
  响应: 200 { model, spoilerTier, pendingModel?, ... }                    // 更新后的完整 config

GET /sessions/{kind}/{id}/config
  响应: 200 { model, spoilerTier, ... }                                   // 读完整 config
```

- `spoilerTier` 存 session-meta key `spoiler_tier`，**立即生效**（前端下次渲染按新档）。
- `model` 走同端点：设 `pendingModel`、**下回合生效**（保留 model-switch 语义）。
- body 是**部分更新**：只传要改的字段。
- 两 kind 对称（dicegm / loregm）。

**5. bay 全量浏览 visible=0 按需拉 + 分页（拍死）**

- bay 的 sheet group btn（chara/plotline/world/forms popover）：默认只拉 `visible=1` 的数据。
- **spoiler 关闭档**时，点 btn 才按需拉 `visible=0` 的全量数据。
- **sheet 数据量大 → 分页**（防卡）：按需拉端点支持分页参数（`?offset&limit` 或 entity 分组分页）。
- 端点：复用 `GET …/browse` 或扩 `GET …/presentation` 加 `includeHidden=true` + 分页参数（实现时定，对接 session-surface-flatten 拉平面）。**只在 spoiler=关闭 且 玩家点 btn 时**调用，非默认拉。

### 与已有裁决的联动

- [`a-prime-completion`](a-prime-completion.md) §7：plotline/foreshadow/lore 的 visible 语义不变（0/1），归 a-prime §7 管。本裁决只管 sheet cell visible + spoiler 档。
- [`dock-card-template`](dock-card-template.md) §三 C3：DIY 查询边界 `visible=1`——**不变**（dock-card 显 visible=1、隐 visible=0）。
- [`model-switch`](model-switch.md) §二：统一 session config 端点把 model 切换并入——`POST …/config {model}`。spoilerTier 与 model 同端点不同生效时机（立即 vs 下回合）。
- [`hidden-roll-and-loregm-ws`](hidden-roll-and-loregm-ws.md) §一：暗骰结果 `visible=0`、stream 照发、前端 spoiler 严格档隐结果/关闭档显——对接本裁决 spoiler 档。

### 决策与权衡

| 项 | 定调 | 理由 |
|----|------|------|
| C1 visible 值域 | `0` / `1` | 是否已披露是布尔；不取三值（之前 `{0,1,2}` 设计作废） |
| C2 visible 角色 | AI note + dock-card 显示依据 | 用户定调；AI 据此决定披露、dock-card 据此显隐 |
| C3 stream 下发 | 全量（含 visible=0），后端不过滤 | 数据要到前端才能按 spoiler 渲染；后端截流破渲染层 |
| C4 spoiler 档 | 前端渲染层，每行为按档渲染，与 visible 正交 | 用户定调；visible 是数据标记、spoiler 是渲染档 |
| C5 硬底线 | **取消**「visible=0 永不下发」 | stream 照发；防剧透靠前端 spoiler + AI Principles，非后端截流 |
| C6 bay visible=0 | 关闭档点 btn 按需拉 + 分页 | sheet 量大、全量拉卡；默认只拉 visible=1 |
| C7 默认档 | 严格 | 对接「默认拒绝」；玩家主动切才多看 |
| C8 档位持久化 | session-meta（`spoiler_tier`）| 会话级、跨设备保留、GM 可见 |
| C9 端点形状 | 统一 `POST /sessions/{kind}/{id}/config`（部分更新）| 用户定调；model 也并入 |
| C10 生效时机 | spoilerTier 立即、model 下回合 | 档位是前端渲染、立即；model 影响后端 GM、下回合 |
| C11 spoiler 影响范围 | 各 GM 行为；不碰 narration/choices/pendingRoll | 隐藏叙事/选项/明骰破坏可玩性 |

### 交付节点（炸成原子需求）

- **FE9-1**（前端）：spoiler 档开关（严格/宽松/关闭），默认严格；切换时 `POST …/config {spoilerTier}`；档位从 `GET …/config` 读。
- **FE9-2**（前端）：每种 GM 行为按 spoiler 档渲染（暗骰/sheet改/mechanics/...，照原型 `play.html` 各 class 定义）。
- **FE9-3**（前端）：dock-card select 按 visible 过滤（显 `visible=1`、隐 `visible=0`）。
- **FE9-4**（后端）：stream + `GET /events` 全量下发含 `visible=0`（废弃 `visibleOnly` 过滤或默认全量）。
- **FE9-5**（后端）：bay 按需拉 visible=0 端点 + 分页（`includeHidden=true` + `offset/limit`，仅 spoiler=关闭 且点 btn 时调）。
- **FE9-6**（后端 api）：挂 `GET/POST /sessions/{kind}/{id}/config` 端点；`spoilerTier` 存 session-meta 立即生效；`model` 走同端点（并入 model-switch）。**与 model-switch 修订同节点**。
- 依赖：FE9-6 与 model-switch 绑定同波；FE9-1/2 前端依赖 FE9-6；FE9-4/5 后端独立；FE9-2 暗骰渲染依赖 C 组 hidden-roll 裁决。

---

## §二 RT-FE10：dock-card DIY 模板 / 归档态持久化（确认引用）

### 现状

RT-FE10 的设计实质**已在 [`dock-card-template`](dock-card-template.md) 定调**：

- §三 C3：玩家 DIY 模板存 **localStorage**（仅本机、可改、仅查 `visible=1` 数据）。
- §四：archive 按钮 → **localStorage**，跨会话本机保留，不落后端。
- 作者预设模板走团本包 `tools/*.json`（toolgen，commit 进包、所有玩家共享、只读）。

### 本裁决确认

- RT-FE10 = dock-card-template §三 + §四 的**已定调内容**，无新决策。
- DIY 查询边界 `visible=1` 随本裁决 visible 语义（0/1）保持一致——**不变**。
- **不重复设计**——交付时直接按 dock-card-template 裁决实现即可。

### 交付节点

归入 dock-card-template 裁决的交付节点，本裁决不另起节点。仅登记「RT-FE10 已被 dock-card-template 覆盖」。

---

## 交付顺序与依赖

- RT-FE9 需后端 config 端点（FE9-6，与 model-switch 绑定同波）+ stream/events 全量下发（FE9-4）+ bay 按需拉端点（FE9-5）。
- FE9-2（行为渲染）暗骰部分依赖 C 组 hidden-roll 裁决批准。
- RT-FE10 实现依赖 dock-card-template 裁决已批准（已 [X]）→ 可进波；纯前端、与 RT-FE9 后端端点无关。
- **修正记录**：本裁决推翻了之前版本的 visible `{0,1,2}` 三值、「visible=0 硬底线永不下发」、「三档=visible阈值×mechanics显隐」设计——经用户多轮澄清作废，改为两层正交模型。
