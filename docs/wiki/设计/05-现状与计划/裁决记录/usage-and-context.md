# 裁决：usage-and-context —— 用量可见性 + 上下文管理

- [X] 用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 来源：acceptance-loop 第 1 轮 RT-FE14（foot 上下文占用%）+ RT-FE15（自动压缩）+ RT-FE17（bay-local session usage）。
> 用户 2026-07-08 定调：RT-FE15「复用 cc agent sdk 实现」；RT-FE14/17「扩 GET /usage 含 context+session」。
> 现状核实：Agent SDK `query()` 的 `result.usage` 已采集四类 token（`harness/src/runtime/agent.ts:16-21` TurnUsage）→ `recordUsage` 落库（`DiceSession.ts:145`）；但 `streamTurn.ts:41` 标「带外计量、不进玩家所见」——未广播前端。`buildQueryOptions`（`gmAssembly.ts:54-67`）未装配 compaction 选项。
>
> ⚠️ **前提依赖**：本裁决 §一「history 随回合累积」前提依赖 [gm-session-continuity](gm-session-continuity.md) 裁决——现状每回合开新 SDK session、LLM history **不跨回合累积**（`GmQueryOptions` 无 `resume`、SDK `session_id` 只进日志未存库）。必须先修续接（一个团本一个 SDK session），本裁决的 `contextTokens` 累积 / auto-compact / 自动丢弃老记录才有落点。**交付顺序：gm-session-continuity 先于本裁决进波。**

---

## 一、核心推导：上下文占用从现有 usage 即可算

每回合 `inputTokens + cacheReadTokens + cacheCreationTokens` = 本回合 prompt 总量 = **当前上下文 token 数**（system + history + new user，history 走 cache）。故：

```
contextTokens = inputTokens + cacheReadTokens + cacheCreationTokens   （最近一轮 usage）
contextWindow = model 的窗口大小（查表·见§四）
contextPct    = contextTokens / contextWindow
sessionTotal  = Σ 各轮 (inputTokens + outputTokens + cacheRead + cacheCreation)
```

**不需额外 SDK 能力**——现有落库的 usage 即可算全部三项。

## 二、扩 GET /usage（RT-FE14/17 数据源 · 规约§2 在建）

`GET /sessions/dicegm/{id}/usage` 扩返回：

```ts
{
  model: string,
  contextTokens: number,    // 当前上下文 token（最近一轮 input+cacheRead+cacheCreation）
  contextWindow: number,    // model 窗口大小（查表§四）
  contextPct: number,       // contextTokens / contextWindow
  sessionTotal: number,     // session 累计 token
  perTurn: TurnUsage[],     // 各轮 usage（对接 co-play per-turn 内联）
}
```

- 数据源：已落库的 `recordUsage`（无需新采集）+ `model windowSize` 表。
- `perTurn` 对接 [`co-play`](co-play.md) 裁决（per-turn 内联·RT-FE16 前端欠账）。

## 三、RT-FE14 foot 上下文占用%

- `class="foot"` 加「当前上下文占用百分比」= `contextPct`。
- 数据：从 `GET /usage` 或 `turn_ended.usage` WS（co-play）算。
- 占用高（>90%·C3 已定调）变红 + `play-context-hint`「即将触发压缩」提示（对接 RT-FE15 auto-compact）→ 玩家可手动 rewind / branch / 开新局（对接 RT-FE8）。

## 四、RT-FE15 自动压缩（复用 Agent SDK · 不自研）

> 查证（2026-07-09，2026-07-10 更正）：SDK 0.3.185 **有** auto-compact。配置在 **Settings** 类型（`sdk.d.ts:5985` `autoCompactEnabled` + `5785` `autoCompactWindow`）。07-09 原注「不在 query `Options` 类型」**已被推翻**——`Options.settings?: string | Settings`（`sdk.d.ts:1787`）走 flag settings 层、最高优先级、与 `settingSources:[]` 正交，可程序化注入（见下 C1 定调）。SDK 同时流式暴露压缩状态：`SDKStatusMessage`（`sdk.d.ts:3965`）`status: 'compacting'|'requesting'|null` + `compact_result?: 'success'|'failed'` + `compact_error?`，及 `SDKCompactBoundaryMessage`（`subtype:'compact_boundary'`）。

- **主方案**：依赖 SDK auto-compact（上下文接近窗口上限时 SDK 自动 summarize 旧回合）。dicelore **不自研压缩**。
- **C1 已定调（查证 2026-07-10）**：SDK `query()` 的 `Options.settings?: string | Settings`（`sdk.d.ts:1787`）走 **flag settings 层、最高优先级、与 `settingSources:[]` 正交**——即便不读盘上 settings，也可程序化传 settings 对象。故 `buildQueryOptions` 显式注入：
  ```ts
  settings: { autoCompactEnabled: true, autoCompactWindow: CONTEXT_WINDOW[model] }
  ```
  - **显式 `true`**（不依赖 SDK 默认是否开——`autoCompactEnabled?: boolean` 默认值 SDK 不明文，显式设以确定性）。
  - `autoCompactWindow` = `CONTEXT_WINDOW[model]`（§六表），与 foot 占用% 同口径。
  - **运行时开关 v1 不暴露前端**（机制最小化·对齐前端设计偏好）；默认开、经 harness config 调，不入 `POST …/config`。
- **降级方案**：若 SDK auto-compact（summarize）不适用/不可控 → dicelore 自实现「**自动丢弃老记录**」（滑动窗口：`contextPct` 超阈值时丢弃最早 LLM 回合，保留近期 + canon 辅助重建）。**不退化为手动 rewind**——玩家不应被 token 管理打断（机制最小化·对齐前端设计偏好）。依赖 [gm-session-continuity](gm-session-continuity.md) 续接的 LLM history 才有老回合可丢弃。
- 压缩/丢弃触发后，`contextTokens` 应下降（旧回合被 summarize 或丢弃）—— foot 占用% 可观测效果。
- **压缩前端反馈（提示 + 进度条 · 用户 2026-07-10 定调）**：压缩进行时前端必须提示「正在进行上下文压缩」+ 进度条。SDK 的 compaction 是 summarize 原子操作、**不暴露数值进度**，故进度条用 **indeterminate 动画**（非真实 %）。链路：
  - **WS 新增 `context_compacting` 消息**（dicegm 域 WS · §5 catalog 增第 11 类）：
    - 进入：harness 订阅 SDK 流、检 `SDKStatusMessage.status === 'compacting'` → 广播 `{type:"context_compacting", phase:"start"}` → 前端显提示 + indeterminate 进度条。
    - 完成：检 `compact_result === 'success'`（或 `SDKCompactBoundaryMessage`）→ 广播 `{type:"context_compacting", phase:"done", result:"success"|"failed"}` → 前端隐提示；成功后 `contextTokens` 回落（foot 占用% 可观测）。
    - 失败：`compact_result === 'failed'` + `compact_error` → 前端显失败 + 降级提示（可手动 rewind / branch / 开新局 · 对接 RT-FE8）。
  - **前端三段态**：foot 占用% > 90%（C3）→ 黄色 `play-context-hint`「即将触发压缩」→ 收到 `context_compacting start` → `play-context-compacting` 提示文案 + `play-context-progress` indeterminate 进度条 → 收到 `done` → 隐、占用% 回落。
  - **loregm 侧 v1 无**：loregm v1 不落库、无 `GET /usage`、无 auto-compact 透传；build 侧不显压缩提示。

## 五、RT-FE17 bay-local session usage

- **bay IA 拆分**：`bay-global`（五块导航·全局）+ `bay-local`（当前板块局部 button）。
- `bay-local` 加「当前 session 累计 token」= `sessionTotal`，数据从 `GET /usage`。
- 与 `bay-global` 的导航职能正交（对接 RT-FE1/RT-FE3 前端 IA 漂移）。

## 六、model windowSize 表（新·类似 co-play PRICING）

```ts
// 每个 model 的上下文窗口大小（token）。占位值，可按真实规格改——这是数据不是逻辑。
export const CONTEXT_WINDOW: Record<string, number> = {
  "claude-sonnet-5": 200_000,
  "claude-opus-4-8": 200_000,
  "claude-haiku-4-5-20251001": 200_000,
  default: 200_000,
};
```

- 位置：`packages/shared`（与 co-play `pricing.ts` 并列·前后端共用）【C2 已定】。

---

## 七、RT-FE19：用量详情浮窗的 mcp / memory 分项（并入自 [rollband-narration-and-loregm-api](rollband-narration-and-loregm-api.md) §三）

> 来源：RT-FE19（`play-bay-popover-usage` 已画作期望态：按 MCP 工具消耗分项 + 记忆占用分项）。rollband §三 已拍死设计、本节为权威落点（rollband §三 仅留指针）。

扩 `GET /sessions/dicegm/{id}/usage`（dicegm）返回 mcp 工具消耗分项 + prompt 各段占用分项：

```ts
{
  model, contextTokens, contextWindow, contextPct, sessionTotal, perTurn[],
  // 新增（RT-FE19）：
  memoryBreakdown?: { segment: string, tokens: number }[],    // prompt 各段占用
  mcpBreakdown?:    { tool: string, calls: number, tokens: number }[],  // MCP 工具消耗
}
```

- 两字段 `optional`（向后兼容；未实现时不下发）。
- **memoryBreakdown（v1 做）**：后端拼 prompt 时按段计 token（与 contextTokens 同口径 tokenizer）。段取自 `gmAssembly` 拼装组成：`systemPrompt`(signpost+prologue) / `narrativeMemory`(历史 event 召回) / `sheet`(状态 sheet 投影) / `foreshadow`(伏笔锚点召回) / `front`(Front/Clock 预置 watcher·GM 视角)。实现成本可控——拼 prompt 时本就有各段、只加计 token。
- **mcpBreakdown（v1 做·降级口径）**：SDK usage 为 per-turn 总量、不按工具拆，精确拆需后端自埋点（成本高、SDK 不暴露）。v1 降级：`calls` = 本 session 该工具调用次数（精确）、`tokens` = 该工具最近一次调用请求+响应估算 token（粗略）。前端浮窗显「工具 × 调用次数 × 估算 token」并标「估算」。精确按工具 token 拆分推后 v2。
- **loregm 侧 v1 不做**：loregm v1 usage 不落库、无 `GET /usage`（经 `POST /messages` 响应内联 per-turn usage）；mcp/memory 分项无聚合源、超前。前端 build 用量浮窗 v1 只显 per-turn 内联 usage。

---

## 待用户确认清单（全部已定调 · 2026-07-10）

| # | 项 | 定调 |
|---|----|------|
| C1 | SDK auto-compact 主动控制方式 + 默认值 | 经 `query()` `Options.settings`（flag 层·最高优先级·与 `settingSources:[]` 正交）注入 `{autoCompactEnabled:true, autoCompactWindow:CONTEXT_WINDOW[model]}`；显式 `true` 不依赖 SDK 默认；运行时开关 v1 不暴露前端 |
| C2 | model windowSize 表位置 | `packages/shared`（与 `pricing.ts` 并列） |
| C3 | foot 占用% 变红阈值 | 90%（>90% 黄色「即将触发压缩」提示） |

---

## 验收

- `GET /sessions/dicegm/{id}/usage` → 返回 `{model, contextTokens, contextWindow, contextPct, sessionTotal, perTurn, memoryBreakdown?, mcpBreakdown?}`。
- foot 显示 `contextPct`，>90%（C3）变红 + `play-context-hint`「即将触发压缩」提示。
- bay-local 显示 `sessionTotal`。
- `contextTokens` = 最近一轮 `input+cacheRead+cacheCreation`（手算核对）。
- 自动压缩：开启 autoCompact 后，长局跑到接近上限 → `contextTokens` 回落（旧回合被 summarize）。（C1 定调）
- **压缩前端反馈**：压缩中收到 WS `context_compacting {phase:"start"}` → 显 `play-context-compacting`「正在进行上下文压缩」+ `play-context-progress` indeterminate 进度条；`done` 后隐、占用% 回落；`failed` 显失败 + 降级提示。
- memoryBreakdown/mcpBreakdown 下发（RT-FE19）。
- 期望首跑见红（GET /usage 现未扩 + WS 无 context_compacting + 前端未实现 = 红）。

## owns（预期触及，非独占）

- backend：扩 `GET /usage` 返回 context+session+perTurn+memoryBreakdown+mcpBreakdown（数据源已有 recordUsage + gmAssembly 各段计 token）。
- `packages/shared`：`CONTEXT_WINDOW` 表 + `TurnUsage`（已有）。
- harness：`buildQueryOptions` 注入 `settings:{autoCompactEnabled:true, autoCompactWindow}`（C1）；订阅 `SDKStatusMessage`/`SDKCompactBoundaryMessage` → 上抛 `context_compacting` WS 事件；usage 已上抛（无需改）。
- 前端：foot 占用% + `play-context-hint`/`play-context-compacting`/`play-context-progress`（压缩提示+indeterminate 进度条）+ bay-local session usage + bay-global/bay-local IA 拆分 + co-play per-turn 落地（RT-FE16）。
- WS catalog（1-backend-interface §5）：新增第 11 类 `context_compacting`。
- **依赖 co-play**（per-turn usage WS 广播）+ **RT-FE18**（model 切换后 contextWindow 随 model 变）+ **gm-session-continuity 先行**（LLM history 跨回合累积·压缩才有老回合可 summarize）。

## 完成后

沉淀进 [04-子系统设计/玩家客户端-接口](../../04-子系统设计/玩家客户端-接口.md)（GET /usage 扩字段 + WS `context_compacting` 第 11 类）+ [玩家客户端-视觉](../../04-子系统设计/玩家客户端-视觉.md)（foot 占用% + 压缩提示/进度条 + bay-local usage + bay IA 拆分）+ 关 backlog RT-FE14/RT-FE15/RT-FE17/RT-FE19 + 勾路线图；rollband §三 随本裁决收口（仅留指针、内容权威落本节 §七）；删本裁决文件。
