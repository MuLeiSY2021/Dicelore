# 裁决：usage-and-context —— 用量可见性 + 上下文管理

- [ ] 用户已批准本裁决（勾上前视为未裁决，不可进交付波）

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

> 查证（2026-07-09）：SDK 0.3.185 **有** auto-compact，但配置在 **Settings** 类型（`sdk.d.ts:5985` `autoCompactEnabled` + `5785` `autoCompactWindow`），**不在 query `Options` 类型**。dicelore 当前 `settingSources: []`（不读盘上 settings）→ 走 SDK 默认 auto-compact 行为。主动控制需经 settings 通道，非 `buildQueryOptions` options。

- **主方案**：依赖 SDK 默认 auto-compact（上下文接近窗口上限时 SDK 自动 summarize 旧回合）。dicelore **不自研压缩**。主动开关经 settings 通道透传 `autoCompactEnabled`【拟·待确认 C1：settings 透传方式 + SDK 默认值（默认开?）】。
- **降级方案**：若 SDK auto-compact（summarize）不适用/不可控 → dicelore 自实现「**自动丢弃老记录**」（滑动窗口：`contextPct` 超阈值时丢弃最早 LLM 回合，保留近期 + canon 辅助重建）。**不退化为手动 rewind**——玩家不应被 token 管理打断（机制最小化·对齐前端设计偏好）。依赖 [gm-session-continuity](gm-session-continuity.md) 续接的 LLM history 才有老回合可丢弃。
- 压缩/丢弃触发后，`contextTokens` 应下降（旧回合被 summarize 或丢弃）—— foot 占用% 可观测效果。

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

- 位置【拟·待确认 C2】：`packages/shared`（与 co-play `pricing.ts` 并列）或 harness config。推荐 shared（前后端共用）。

---

## 待用户确认清单

| # | 项 | 推荐值 | 你的定调 |
|---|----|--------|----------|
| C1 | SDK auto-compact 主动控制方式 + 默认值 | 已查证：`autoCompactEnabled` 是 **Settings** 字段非 query Options；dicelore `settingSources:[]` 走默认。待查：settings 透传方式 + 默认是否开 | |
| C2 | model windowSize 表位置 | `packages/shared`（与 pricing.ts 并列） | |
| C3 | foot 占用% 变红阈值 | 80% | 90% |

---

## 验收

- `GET /sessions/dicegm/{id}/usage` → 返回 `{model, contextTokens, contextWindow, contextPct, sessionTotal, perTurn}`。
- foot 显示 `contextPct`，>90%（C3）变红 + `play-context-hint`「即将触发压缩」提示。
- bay-local 显示 `sessionTotal`。
- `contextTokens` = 最近一轮 `input+cacheRead+cacheCreation`（手算核对）。
- 自动压缩：开启 autoCompact 后，长局跑到接近上限 → `contextTokens` 回落（旧回合被 summarize）。（C1 确认后）
- 期望首跑见红（GET /usage 现未扩 + 前端未实现 = 红）。

## owns（预期触及，非独占）

- backend：扩 `GET /usage` 返回 context+session+perTurn（数据源已有 recordUsage）。
- `packages/shared`：`CONTEXT_WINDOW` 表 + `TurnUsage`（已有）。
- harness：`buildQueryOptions` 透传 autoCompact（C1）；usage 已上抛（无需改）。
- 前端：foot 占用% + bay-local session usage + bay-global/bay-local IA 拆分 + co-play per-turn 落地（RT-FE16）。
- **依赖 co-play**（per-turn usage WS 广播）+ **RT-FE18**（model 切换后 contextWindow 随 model 变）。

## 完成后

沉淀进 [04-子系统设计/玩家客户端-接口](../../04-子系统设计/玩家客户端-接口.md)（GET /usage 扩字段）+ [玩家客户端-视觉](../../04-子系统设计/玩家客户端-视觉.md)（foot 占用% + bay-local usage + bay IA 拆分）+ 关 backlog RT-FE14/RT-FE15/RT-FE17 + 勾路线图；删本裁决文件。
