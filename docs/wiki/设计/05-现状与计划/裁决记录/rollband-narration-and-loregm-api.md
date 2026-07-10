# 裁决：明骰档位叙事 + loregm Draft 校验 + usage 分项（B 组·中量新裁决）

- [ ] 用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> **来源**：[`docs/tdd/acceptance-loop-2026-07-06/findings.md`](../../../../../tdd/acceptance-loop-2026-07-06/findings.md) RT-FE5 / RT-FE11 / RT-FE19。
> **接口规约稿**：[`1-backend-interface.md`](../../../../../tdd/acceptance-loop-2026-07-06/1-backend-interface.md) §2 第 32 行（RT-FE5 期望形状）、§3 第 52 行（RT-FE11）、第 132/135 行 + §3 注（RT-FE19 超前·不进接口）。
> **性质**：三条接口 / schema 缺口，需拍设计但不算承重建模。RT-FE5/FE11 已落 [`backlog-后端`](../backlog-后端.md) 未裁决；RT-FE19 未落 backlog（仅 findings 行）。本裁决拍死后合并进交付波。

---

## §一 RT-FE5：明骰 per-band narration（RollBand 加 narration 字段）

### 现状

- [`RollBandSchema`](../../../../../packages/shared/src/presentation.ts:42) = `{ label, min, max }` —— 只有档位标签与区间，**缺每档命中后的叙事文本**。
- 前端明骰内联 stream 各档 narrate 无数据源（`play-roll-bands` 各档叙事空）。
- 规约稿 §2 第 32 行已写期望形状：`bands:[{label,min,max,narration}]`。

### A/B 抉择

| 方案 | 做法 | 优劣 |
|------|------|------|
| **A（定调）** | `RollBand` 加 `narration: string` 字段，GM 在 `roll_staged` 声明 bands 时每档带叙事 | 数据就位于档位、前端直接渲染；对接「声明后果在先」（骰前锁定每档后果叙事，防 F2 软着陆） |
| B | 不加字段，档位叙事走 narration stream 末段（掷骰后 GM 即兴写命中档叙事） | 违反「声明后果在先」——骰后才写后果=软着陆温床；且 narration stream 是骰后整体叙事、无档位对应 |

**定调 A**。理由：与项目核心反讨好机制（声明后果在先、F2 双边护栏）一致；档位叙事骰前声明 = 结构性防软着陆。

### 设计

**1. schema 扩展（拍死）**

```ts
// packages/shared/src/presentation.ts
export const RollBandSchema = z.object({
  label: z.string(),
  min: z.number(),
  max: z.number(),
  narration: z.string(),   // 新增：该档命中后的叙事文本（骰前声明）
});
```

- `narration` 为**必填**（非 optional）——档位必须带后果叙事，否则校验失败（对接「声明后果在先」铁律）。
- 向后兼容：现有已 stage 的 pendingRoll 无 `narration` 字段会 schema 校验失败 → 需 GM 重新 stage。这是期望行为（旧数据本就不合规）。

**2. narration 文本来源（拍死）**

- 来源 = **GM 调 `resolve_outcome` / `roll_staged` 工具时声明**。GM 在掷骰前为每档写后果叙事（如档位「大胜 / 勉强 / 惨败」各一段）。
- 文本由 GM AI 即兴生成、受 Principles 约束（声明后果在先、不软着陆）。**非团本包预设**（档位是 GM 按当前局势声明的，非作者预写）。
- 骰出后前端按命中档（roll 结果落 `min..max` 区间）渲染该档 `narration`。

**3. 前端呈现（对接 RT-FE1 A2 原型）**

- 明骰内联 stream：掷骰前各档显示 `label + 区间`（narration 隐藏，防剧透未命中档）；掷骰后只显示命中档的 `narration`（简化结果）。
- 未命中档的 narration **不显示**（避免剧透其他可能后果）。

### 决策与权衡

| 项 | 定调 | 理由 |
|----|------|------|
| C1 方案 | A（RollBand 加 narration 字段） | 声明后果在先；数据就位 |
| C2 narration 必填性 | 必填 | 档位无后果叙事 = 软着陆温床，校验拒 |
| C3 文本来源 | GM 即兴声明（非团本预设） | 档位按局势动态声明，作者无法预写所有情形 |
| C4 未命中档呈现 | 隐藏 narration | 防剧透其他后果 |

### 交付节点

- **FE5-1**（shared）：`RollBandSchema` 加 `narration: string` 必填。
- **FE5-2**（core/工具面）：`resolve_outcome` / `roll_staged` 工具入参 bands 每档要求 `narration`；缺失则校验失败。
- **FE5-3**（后端 present）：pendingRoll 投影时下发 bands 含 narration。
- **FE5-4**（前端）：明骰内联 stream 掷骰前显档位标签、掷骰后显命中档 narration。
- 依赖：无后端承重依赖；与 RT-FE6（暗骰）正交。

---

## §二 RT-FE11：loregm Draft 期校验端点

### 现状

- §3 loregm 域无 validate；§4 `POST /catalog/validate` 仅对**已提交包**（checkout 得到的 Pack）。
- 制作页"校验报告"在活跃 Draft 期（未提交）无端点可调 → error/warn 无法即时反馈。
- [`backend/src/api/lore.ts`](../../../../../backend/src/api/lore.ts) 是 REST-only，无 `/draft/validate`。

### 目标

活跃期 Draft（in-memory / 工作区未提交态）可即时校验，返形状与 `/catalog/validate` 一致 `[{level,path,msg}]`。

### 设计

**1. 端点（拍死）**

```
POST /sessions/loregm/{id}/draft/validate
  请求: 无 body（校验该 session 当前 Draft）
  响应: 200 { issues: [{level, path, msg}] }
        level ∈ "error" | "warn"
```

- 路径在 session-surface-flatten 拉平后的 `/sessions/loregm/{id}/draft/validate`（现状 `/lore-sessions/{id}/draft/validate`，随 RT-ns 改名一并拉平）。
- **无副作用**：只读校验，不改 Draft。
- 幂等：多次调返同结果（Draft 未变时）。

**2. 校验逻辑复用（拍死）**

- 复用 core 的 `validatePack` 规则集（与 `/catalog/validate` 同一套 Rule 0c / 必填文件 / schema 规则）。
- 但 Draft 是**分域结构**（`get_draft` 返回的 `{files, snapshot}` 分域回读），非 Pack 文件树。→ core 需暴露 `validateDraft(draft)` 入口，把分域 Draft 喂给同一套规则、或在 Draft 侧序列化成临时 Pack 形状再 `validatePack`。
- **返形状漂移定调**：`path` 用 **Draft 分域路径**（如 `world.lore.张三`、`rule.核心规则`、`manifest.meta`），非文件路径（如 `world/lore/张三.md`）。因为 Draft 期还没物化成文件，分域路径对作者更直观。`/catalog/validate` 仍用文件路径（已提交包是文件树）——两端口 path 形态不同是期望的（对应不同态）。

**3. 与 WS 的关系**

- 本端点是**同步 HTTP**（客户端主动调、即拿结果）。
- §5.2 草案的 `validate_result` WS 事件（RT-FE12）是**异步推送**（构建轮次结束时自动推校验结果）。两者互补：本端点用于"作者随时点校验"（on-demand），WS 用于"每轮结束自动出报告"。RT-FE11 只管本端点；WS 推送归 RT-FE12。

### 决策与权衡

| 项 | 定调 | 理由 |
|----|------|------|
| C1 端点路径 | `POST /sessions/loregm/{id}/draft/validate` | 对称 `/catalog/validate`；随 RT-ns 拉平 |
| C2 校验逻辑 | 复用 `validatePack` 规则集，经 `validateDraft` 入口 | 单源规则、不另造校验器 |
| C3 path 形态 | Draft 分域路径（非文件路径） | Draft 未物化成文件；分域路径对作者直观 |
| C4 同步 vs 推送 | 本端点同步 on-demand；WS 推送归 RT-FE12 | 互补、不替代 |
| C5 无副作用 | 只读、幂等 | 校验不应改 Draft |

### 交付节点

- **FE11-1**（core）：暴露 `validateDraft(draft)` 入口，复用 `validatePack` 规则、返 `[{level,path,msg}]`，path 用分域路径。
- **FE11-2**（后端 api/lore.ts）：挂 `POST /draft/validate` 路由，调 `validateDraft`。
- **FE11-3**（前端 build.html）：校验报告 UI 调本端点、展示 issues 分级。
- 依赖：session-surface-flatten（RT-ns 拉平路径）先行或同波；core validateDraft 可独立。

---

## §三 RT-FE19：usage 详情浮窗的 mcp / memory 分项

### 现状

- [`usage-and-context`](usage-and-context.md) §二 定调 `GET /sessions/dicegm/{id}/usage` 返 `{model, contextTokens, contextWindow, contextPct, sessionTotal, perTurn[]}` —— **无 mcp / memory 分项**（该裁决未批准 [ ]）。
- 前端用量详情弹窗（`play-bay-popover-usage`）已画作期望态：按 MCP 工具消耗分项 + 记忆占用分项（叙事记忆 / 状态 sheet / 伏笔锚点）。
- 规约稿第 132 行标 RT-FE19「超前·不进接口·待裁决扩 `GET /usage`」；loregm 侧 v1 不落库、无 `GET /usage`，mcp/memory 分项对 loregm 同样超前。

### 目标

扩 `GET /usage`（dicegm）返回 mcp 工具消耗分项 + prompt 各段（记忆/sheet/伏笔/锚点）占用分项，供前端用量浮窗渲染。

### 设计

**1. 扩展字段（拍死）**

```ts
// GET /sessions/dicegm/{id}/usage 响应扩
{
  model, contextTokens, contextWindow, contextPct, sessionTotal, perTurn[],
  // 新增（RT-FE19）：
  memoryBreakdown?: { segment: string, tokens: number }[],   // prompt 各段占用
  mcpBreakdown?:    { tool: string, calls: number, tokens: number }[],  // MCP 工具消耗
}
```

- 两字段 `optional`（向后兼容；未实现时不下发）。

**2. memoryBreakdown 实现（拍死·v1 做）**

- 后端拼 prompt 时按段计 token。段取自 `gmAssembly` 拼装的组成：
  - `systemPrompt`（signpost + prologue）
  - `narrativeMemory`（叙事记忆 / 历史 event 召回）
  - `sheet`（状态 sheet 投影）
  - `foreshadow`（伏笔锚点召回）
  - `front`（Front/ Clock 预置 watcher，GM 视角）
- 每段拼装后用 tokenizer 估 token（与 contextTokens 同口径），填入 `memoryBreakdown`。
- **实现成本可控**：后端拼 prompt 时本就有各段、只需加计 token。tokenizer 复用现有 usage 采集的同款。

**3. mcpBreakdown 实现（拍死·v1 做·降级口径）**

- Agent SDK 的 usage 通常是 **per-turn 总量**、不按工具拆。要精确按工具拆 token 需后端自埋点（拦截每次 MCP tool call 的请求/响应 token）——成本高且 SDK 不直接暴露。
- **降级定调**：v1 的 `mcpBreakdown` 按 **工具调用次数 + 该工具最近一次调用的估算 token** 填，非精确累计。
  - `calls` = 本 session 该工具调用次数（后端可精确计）。
  - `tokens` = 该工具最近一次调用的请求+响应估算 token（粗略）。
- 前端浮窗显示"工具 × 调用次数 × 估算 token"，标注「估算」。
- 精确按工具 token 拆分推后 v2（需 SDK 支持或自埋点）。

**4. loregm 侧（拍死·v1 不做）**

- loregm v1 usage 不落库、无 `GET /usage`（经 `POST /messages` 响应内联 per-turn usage）。
- loregm 的 mcp/memory 分项**v1 不做**——无聚合源。前端 build 用量浮窗 v1 只显 per-turn 内联 usage，不显 mcp/memory 分项。
- 与规约稿 §3 注「loregm 用量详情浮窗 session 累计 / 上下文占用圆盘 = 超前」一致。

### 与 usage-and-context 裁决的联动

- 本节内容（`memoryBreakdown` / `mcpBreakdown`）**待并入 [`usage-and-context`](usage-and-context.md) 新增 §七**（批准时一并写入）。
- 因 usage-and-context 本身未批准 [ ]、且依赖 `gm-session-continuity` 先行 → RT-FE19 进波顺序绑定 usage-and-context：两者同批批准、同波交付。
- 本裁决只定义 RT-FE19 的设计，不绕过 usage-and-context 的批准闸。

### 决策与权衡

| 项 | 定调 | 理由 |
|----|------|------|
| C1 memoryBreakdown v1 | 做（后端按 prompt 段计 token） | 成本可控；前端已画期望态 |
| C2 mcpBreakdown v1 | 做·降级口径（calls + 最近一次估算 token） | SDK 不支持精确按工具拆；降级比不做强 |
| C3 mcpBreakdown 精确化 | 推后 v2 | 需 SDK 支持或自埋点，成本高 |
| C4 loregm 侧 | v1 不做 | 无聚合源（v1 不落库） |
| C5 字段 optional | 是 | 向后兼容；未实现不下发 |
| C6 与 usage-and-context 绑定 | 同批批准、同波交付 | RT-FE19 是扩它、不绕闸 |

### 交付节点

- **FE19-1**（后端 present/assembly）：拼 prompt 时按段计 token，填 `memoryBreakdown`。
- **FE19-2**（后端）：计 MCP 工具调用次数 + 最近一次估算 token，填 `mcpBreakdown`。
- **FE19-3**（后端 api）：`GET /usage` 响应扩两 optional 字段。
- **FE19-4**（前端）：用量详情弹窗渲染 mcp/memory 分项（mcp 标「估算」）。
- 依赖：usage-and-context 裁决批准 + gm-session-continuity 先行。

---

## 交付顺序与依赖总览

- RT-FE5：无承重依赖，可独立进波（shared schema + core 工具 + 前端）。
- RT-FE11：依赖 session-surface-flatten（RT-ns 路径拉平）先行或同波；core validateDraft 可独立。
- RT-FE19：绑定 usage-and-context（未批准）+ gm-session-continuity 先行；进波顺序最后。
- 三条彼此正交，可分属不同波次。
