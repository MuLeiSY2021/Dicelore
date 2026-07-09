# 裁决：usage-stream —— per-turn token 随 turn-end 信号走

- [x] 用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 路线图项：里程碑二 · CO 成本可观测性（前端可视化的后端契约部分）。
> 来源：用户 2026-06-30 纠偏——「per-turn 应放在跑团/构建团本页每一轮里，随 session 走，不单独查询」。本需求只做**让每回合 token 搭上 turn-end 信号**的后端+协议改动；前端内联渲染是 co-play / co-build。
> 已合 main 的 `GET /sessions/:id/usage` 聚合端点保留（未来总览用），与本需求不冲突。

## 设计（零不确定，仅剩代码实现）

### 1. 共享协议：`turn_ended` 加 usage 字段

`packages/shared/src/stream.ts` 的 `turn_ended` 变体加**可选** `usage` 字段（可选 = 向后兼容，旧消息/FAKE 无 usage 时前端容缺）：

```ts
z.object({ ...base, type: z.literal("turn_ended"), turnId: z.string(), seq: z.number(),
  usage: z.object({
    inputTokens: z.number(), outputTokens: z.number(),
    cacheReadTokens: z.number(), cacheCreationTokens: z.number(),
  }).optional() }),
```

字段语义 = **本回合**四类 token 合计（与 `TurnUsage` / `store/usage.ts UsageTotals` 同形）。

### 2. dice：turnLoop 本地累计、塞进 turn_ended

- `harness/src/dicegm/turnLoop.ts` 已收到 `onUsage?(usage, model)` 透传。在回合内**本地累加**每次 usage 事件的四类 token（不查库——turnLoop 已有的 onUsage 流就够），得本回合合计 `turnUsage`。
- 现有 `send({...type:"turn_ended", turnId, seq})` 改为带上 `usage: turnUsage`（无 usage 事件时省略该字段 / 给全零，按可选字段处理；**取省略**，与 schema optional 一致）。
- onUsage 落库（`DiceSession.onUsage`→`recordUsage`）行为**不变**，本需求只额外把同一份数据搭进流。

### 3. lore：handleMessage 累计、返回 {turnId, usage}

- `harness/src/loregm/LoreSession.ts` `handleMessage` 的 `for await (ev of driver.runTurn(...))` 循环里，**捕获 `ev.type==="usage"`** 累加本轮 usage（lore 现未处理 usage 事件，本需求补这一处累加）。
- 返回从 `{ turnId }` 扩成 `{ turnId, usage?: UsageTotals }`（无 usage 事件则不带）。
- **v1 不落库**：构建会话是临时 in-memory（RT-5 后 REST only），usage 仅随响应回前端内联显示，不进 SQLite。落库留 v2（若将来要构建侧成本总览）。
- `backend/src/api/lore.ts` 的 `POST /lore-sessions/:id/messages` 把 `session.handleMessage` 返回的 `{turnId, usage}` 原样 `c.json(..., 202)`。

## 验收

- shared：`turn_ended` schema 加 `usage` optional，旧用例（不带 usage）仍通过（向后兼容单测）。
- dice：单测——回合内喂多次 usage 事件，断言 `turn_ended.usage` = 各次四类 token 之和；无 usage 事件时 `turn_ended` 不含 usage 字段。
- lore：单测——driver 产 usage 事件时 `handleMessage` 返回含 usage；`POST /lore-sessions/:id/messages` 响应体含 usage。
- `typecheck:all` + `test:all` 全绿。

## owns（预期触及，非独占）

`packages/shared/src/stream.ts`、`harness/src/dicegm/turnLoop.ts`、`harness/src/loregm/LoreSession.ts`、`backend/src/api/lore.ts`（+各自 test）。

## 完成后

设计结论沉淀进 [04-子系统设计/后端双路径架构](../../04-子系统设计/后端双路径架构.md)（turn-end 信号携带 usage）+ 关 backlog CO 条目 + 勾路线图；删本裁决文件。
