# 下一步（组件7 · 实时引擎面）— 给组件7 线的交接 todo + 起手提示词

> **用途**：给**组件7 线**（玩家客户端 / orchestrator 后端）的待办 + 起手提示词。组件7 v1 非阻塞竖切（`packages/shared` 契约 + 只读 REST + web 外壳）已落；本 todo 是它的**下一阶段：把 orchestrator 接成「实时引擎面」**——GM 叙述流式 / 掷骰裁决 / 回合推进。
>
> **缘起**：组件7 跑团页中央区标注「流式待组件2」。**那个前提条件已满足**——组件2（MCP 工具面）+ 组件4（三 hook）都已合并在 main。这套实时引擎面**不是组件2 的活、也不是 GM 运行时核心线（组件3/4）的活，是组件7 自己 orchestrator 后端的集成活**（[ADR-0018](../wiki/05-决策记录-ADR/README.md) §3）。现在不阻塞、可动手。

---

## 前提（已就绪，都在 main）

- **组件2 MCP 工具面**：stdio server（`npx dicelore mcp` / `node --import tsx packages/core/src/mcp/main.ts`），现 **20 个 `dicelore_*` 工具**（含本周期新加的明骰 `resolve_outcome_open`/`resolve_contest_open`）。
- **组件4 三 hook**：`packages/core/src/adapter/hooks/{session-start,turn-start,turn-end}.ts`（Node、`node --import tsx` 跑）+ `dicelore init`。
- **core 公共 barrel** `@dicelore/core`（`packages/core/src/index.ts`）已 additive 导出：`openDb`/`initSchema`/`DB`、`buildPresentationModel` 及类型、**明骰原语** `stagePendingRoll`/`getPendingRoll`/`commitPendingRoll`/`setRollGate`/`getRollGate` + 类型 `RollResult`/`RollGate`/`PendingRollRow`/`RollSpec`/`RollShape`。
- **MCP 注册位置已核实**：项目级 MCP 走**项目根 `.mcp.json`**（CC 不读 `.claude/settings.json` 的 `mcpServers`）；`dicelore init` 已据此产 `.mcp.json`。

---

## 本阶段范围（组件7 orchestrator 后端）

把 [组件7 v1 计划](../superpowers/plans/2026-06-21-player-client-v1-impl.md) Global Constraints 里「硬阻塞、本期不做」的那部分做出来：

1. **Agent SDK headless host**：用 `@anthropic-ai/claude-agent-sdk` 程序化驱动 GM（[ADR-0018](../wiki/05-决策记录-ADR/README.md) §2）。
2. **挂 dicelore MCP**：把组件2 的 MCP 接进 Agent SDK 的 `mcpServers`。**关键决策见下「明骰挂载」**。
3. **挂三 hook**：复用组件4 的 session-start/turn-start/turn-end（[adapter与L3审计](../wiki/04-子系统设计/adapter与L3审计.md)）。
4. **WS 流 + notify sink**：`narrate` token 流 + 回合事件走流式（[玩家客户端-接口 §4](../wiki/04-子系统设计/玩家客户端-接口.md)）；MCP 写规范态后 POST 到 notify-URL → 后端转 `presentation_delta`/`choices` 推前端（接口 §5/§6）。
5. **动作进**：`POST /message`、`POST /sessions/{id}/choices`（接口 §2），喂下一回合输入。

---

## ⚠️ 明骰挂载——一个必须先拍的架构决策

本周期新增了**玩家闸控明骰**（BG3 式，[设计](../superpowers/specs/2026-06-21-player-gated-roll-design.md) / [ADR-0019](../wiki/05-决策记录-ADR/README.md)）。明骰 `resolve_*_open` 是**阻塞式**工具：handler 暂存 `pending_roll` → `await` 一个 **roll-gate**（玩家点击）→ 引擎此刻掷 → 回合内返回。

core 侧已造好接缝 **`setRollGate(fn)`/`getRollGate()`**（模块级单例）。但它是 **core 进程内**的：

- **若 orchestrator 用 stdio 子进程挂 dicelore MCP** → MCP 在**另一个进程**，orchestrator 调不到 `setRollGate`，**明骰阻塞接不上**。
- **若 orchestrator in-process 挂 MCP**（ADR-0018 §2「进程内挂载为可选优化」）→ 同进程，`setRollGate` 可直接注入 → 明骰 gate 接通。

**in-process 挂载需要 core 导出一个 `createMcpServer(db)` 工厂**（目前 core 只有 stdio bin `src/mcp/main.ts`，无可编程工厂）。

**所以**：组件7 先定**走 in-process 还是 stdio**。
- 选 **in-process** → 跟 GM 运行时核心线（core）提一句「加 `createMcpServer(db)` 工厂」，那是 core 一个 **additive 导出**（很小、core 线很快能给）。
- 选 **stdio** → 基础实时引擎面照样能跑，但**明骰要另设跨进程 gate**（如 handler 在子进程里靠轮询 `pending_roll` 状态 + `POST /roll` 写库来解阻塞），或明骰暂时只走裸 CC 降级（立即掷、无点击）。

明骰要真正跑通，组件7 还需实现：**`awaitPlayerRoll`（通知前端待掷 + await 点击）** + **`POST /sessions/{id}/roll {eventId}`** + **BG3 掷骰卡 UI** + **宕机恢复重驱 GM**（读 `pending_roll` status=awaiting → 重弹卡 → 掷 → 结果作输入重驱）+ **`packages/shared` 契约**（`pendingRoll` snapshot / `roll_staged` / `roll_committed`，[接口 §1/§2/§4](../wiki/04-子系统设计/玩家客户端-接口.md) 已定形）。

---

## 起手提示词（复制以下整段给组件7 session）

```
继续 dicelore 组件7（玩家客户端 / orchestrator 后端）。v1 非阻塞竖切（packages/shared 契约 + 只读 REST + web 外壳）已合并。下一阶段 = 把 orchestrator 接成「实时引擎面」：Agent SDK headless host 驱动 GM + 挂 dicelore MCP（组件2，已合并，20 工具）+ 挂三 hook（组件4，已合并）+ WS 流 + notify sink。前提（组件2 MCP / 组件4 hook）都在 main，不阻塞。请先读权威文档再动手：

- docs/wiki/05-决策记录-ADR/README.md ADR-0018（组件7 立项:Agent SDK headless host / 编排契约 / 双分发壳）+ ADR-0019（玩家闸控明骰）
- docs/wiki/04-子系统设计/玩家客户端.md + 玩家客户端-接口.md（编排契约:REST §2 / WS §4 / notify §5）
- docs/superpowers/plans/2026-06-21-player-client-v1-impl.md（v1 已做的非阻塞部分 + Global Constraints 里「硬阻塞不做」清单 = 本阶段范围）
- docs/superpowers/specs/2026-06-21-player-gated-roll-design.md（明骰:阻塞式 + roll-gate 接缝 + anti-F1）
- @dicelore/core barrel（packages/core/src/index.ts）已导出 buildPresentationModel + 明骰原语（stagePendingRoll/getPendingRoll/commitPendingRoll/setRollGate/getRollGate）

进 brainstorming 前先拍这个架构决策：dicelore MCP 走 in-process 挂载还是 stdio 子进程？这决定明骰 roll-gate 怎么接——
- in-process:可直接 setRollGate 注入 gate;但需 GM 运行时核心线给 core 加 createMcpServer(db) 工厂（目前只有 stdio bin，无可编程工厂）。
- stdio:基础流式/裁决照跑,但明骰阻塞要另设跨进程 gate,或先只走裸 CC 降级。
拍完再按 superpowers 流程:brainstorming → writing-plans → 执行。

注意分线边界:MCP 工具本身（组件2）、三 hook（组件4）、明骰 core 原语都是现成积木、已在 main;本阶段是 orchestrator 把它们「接起来」+ 造 WS 流 / notify / 明骰 UI 与跨进程接线。若需要 core 加 createMcpServer(db) 工厂,跟 GM 运行时核心线提（additive 小活）。
```

---

## 给 GM 运行时核心线（组件3/4 / core）的回执

组件7 若选 **in-process 挂载**，core 需 additive 加：
```ts
// packages/core/src/mcp/server.ts(或并入 main.ts 重构)
export function createMcpServer(db: DB): McpServer  // 把 main.ts 的 registerTool 循环抽成工厂,供 orchestrator in-process 挂载 + setRollGate 注入
```
现状:`main.ts` 把 `openSession()→McpServer→registerTool→stdio` 写死在一起;抽出工厂即可，不改工具行为。等组件7 确认走 in-process 再做。
