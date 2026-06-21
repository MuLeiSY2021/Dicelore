# 组件7 实时引擎面 Phase 1 设计（orchestrator live engine）

> **状态**：🟢 brainstorming 定稿（2026-06-21）。
> **一句话**：把 orchestrator 从「只读后端」接成「实时引擎面」——真 Agent SDK 驱动 GM + in-process 挂 dicelore MCP + 三 hook + WS 流 + 细粒度呈现增量 + 动作进，跑通一个 GM↔玩家回合闭环。
> **上游权威**：[ADR-0018](../../wiki/05-决策记录-ADR/README.md)（组件7 立项 / Agent SDK headless host / 编排契约）、[玩家客户端.md](../../wiki/04-子系统设计/玩家客户端.md)（三层 / 三流 / 通知缝）、[玩家客户端-接口.md](../../wiki/04-子系统设计/玩家客户端-接口.md)（REST §2 / WS §4 / notify §5）、[v1 竖切实现计划](2026-06-21-player-client-v1-impl.md)（已落的非阻塞部分 = 本设计的地基）、交接 [orchestrator-live-engine todo](../../todo/2026-06-21-orchestrator-live-engine.md)。
> **前提（已在 main）**：组件2 MCP 工具面（20 个 `dicelore_*`，stdio bin `packages/core/src/mcp/main.ts`）；组件4 三 hook（`packages/core/src/adapter/hooks/`）；core 公共 barrel（`buildPresentationModel` + 明骰原语 `commitPendingRoll`/`setRollGate`/`getRollGate`）。
> **架构前置决策（已拍）**：dicelore MCP 走 **in-process 挂载**（非 stdio 子进程）——理由见 §8。

---

## 1. 范围

**做（Phase 1）**：一个回合的实时闭环。

- core additive：`createMcpServer(db, deps)` 工厂 + `runTool` 写后回调接缝。
- orchestrator：Agent SDK headless host 驱动 GM（经 `GmDriver` 抽象）+ in-process 挂 dicelore MCP + 三 hook + WS 流（narration / presentation_delta / choices / 回合事件）+ 动作进（`POST /sessions/{id}/messages`、`POST /sessions/{id}/choices`）。

**不做（后续期，明确排除）**：

- **明骰**（`resolve_*_open` 阻塞 + `awaitPlayerRoll` gate + `POST /roll` + `pendingRoll`/`roll_staged`/`roll_committed` 契约 + BG3 掷骰卡 + 宕机恢复重驱）→ **Phase 2**（[明骰设计](2026-06-21-player-gated-roll-design.md)）。
- token 级逐字打字机 narration（见 §4 决策 A）。
- Tauri 壳、Web 多人鉴权 / 会话路由、世界/卡池浏览、元动作（rewind/branch/swipe）。

---

## 2. 模块结构

### 2.1 core additive（不改工具行为，纯新增）

```
packages/core/src/mcp/server.ts   ← 新增工厂
  export function createMcpServer(db: DB, deps?: McpServerDeps): McpServer
    把 main.ts 的「new McpServer + registerTool 循环」抽进来；接收 deps（见 §3.1）。
  main.ts 改为：createMcpServer(db, {}) + 接 StdioServerTransport（stdio 路径行为不变）。

packages/core/src/mcp/runTool.ts  ← 扩展
  runTool 在规范态写【成功后】调 deps.onCanonWrite?.(evt)（按实例传入，非模块全局）。
```

### 2.2 orchestrator（apps/orchestrator/src/）

```
gm/GmDriver.ts        GmDriver 接口 + TurnEvent / TurnInput 类型（§3.2）
gm/AgentSdkDriver.ts  真实现：包 @anthropic-ai/claude-agent-sdk（新增依赖），鉴权见 §6
gm/FakeGmDriver.ts    脚本化 fake（测试用，发预设事件序列）
session/SessionHost.ts  每 session 一个：持 db + MCP 实例 + GmDriver + 三 hook 接线 + WS 广播器
session/registry.ts     sessionId → SessionHost（多 session in-process，懒建）
live/turnLoop.ts        纯逻辑：消费 GmDriver 事件序列 → 调 hook / 广播 WS（注入 fake 可单测）
live/notify.ts          onCanonWrite 事件 → presentation_delta 映射（接口 §4/§5）
live/ws.ts              WS 连接管理 + 按 session 广播（接口 §3/§4）
server.ts               扩展：挂 WS 端点 + POST messages/choices（复用现有只读 REST + buildSnapshot）
presentation.ts         复用（buildSnapshot，首屏/重连全量）
```

---

## 3. 接缝与接口

### 3.1 core `McpServerDeps`（按实例注入，多 session 安全）

```ts
export interface CanonWriteEvent {
  kind: "mutation" | "event" | "visibility" | "reveal" | "watcher_fired" | "choice_staged" | "game_end";
  seq: number;            // 写后的 store seq
  toolName: string;       // 触发的 dicelore_* 工具
  output: unknown;        // 工具出参（event_id / fired_watchers / mutation 账本等，MCP 最知道改了啥）
}
export interface McpServerDeps {
  onCanonWrite?: (evt: CanonWriteEvent) => void;  // runTool 写规范态成功后同步调
  // Phase 2 预留：rollGate?: RollGate;（明骰阻塞 gate，本期不接）
}
```

> **为何按实例传入而非模块全局**：企业多 session 在**同一进程内**并发，模块级单例（如现有 `setRollGate`）会串台。工厂按 session 绑定 `db` + `deps`，每个 `SessionHost` 的 MCP 实例持自己的回调 → 隔离。Phase 2 接明骰 gate 时同法（把现有模块级 `setRollGate` 迁成实例注入，届时处理）。

### 3.2 orchestrator `GmDriver`

```ts
export interface TurnInput { text: string }
export type TurnEvent =
  | { type: "narration"; text: string }   // 一段散文（Phase 1 = narrate 工具调用粒度，见 §4-A）
  | { type: "turn_end" };                  // GM 本回合自然结束
export interface GmDriver {
  // 喂一回合输入，异步产出事件流。工具调用由 SDK 经 mcpServers 自行执行（不经此流转发），
  // 其规范态副作用走 core onCanonWrite 接缝捕获（§4）。
  runTurn(input: TurnInput): AsyncIterable<TurnEvent>;
}
```

---

## 4. 数据流（一个回合）

```
👤 POST /sessions/{id}/messages {text}
  → SessionHost.handleMessage(text)
  → turn-start hook（组件4，rule 召回）注入本轮
  → GmDriver.runTurn(input)  ── 异步事件流 ──┐
                                            │
  GM（经 Agent SDK）自己调 dicelore_* 工具（in-process MCP）
    → runTool 写 db 成功 → onCanonWrite(evt)
       → live/notify.ts 映射 → WS presentation_delta（人物卡/机械回显增量）
  TurnEvent: narration  → WS narration_commit（散文落定，§4-A）
  TurnEvent: turn_end   → turn-end hook（组件4：choice 物化 + L3 审计）
       → 若 staged choice → WS choices
       → WS turn_ended
       → 若 L3 block → 把 block reason 作下一轮注入重驱（沿用 adapter 既定行为）

👤 POST /sessions/{id}/choices {eventId, optionIndex}
  → 记录所选 → 作下一回合 runTurn 输入
```

**决策 A（narration 粒度）**：dicelore 散文经 `dicelore_narrate` 工具写 `kind=narrate` event（非 GM 自由文本）。Phase 1 按 **narrate 调用粒度**推 `narration_commit`（经 onCanonWrite 捕获 `kind=event` 且 narrate，或 driver 发 `narration` 事件）。**token 级逐字 `narration_delta` 推迟**——取决于 SDK 是否流式吐工具入参，未验证、不在 Phase 1 冒险。散文仍一段段实时到，只是无逐字动效。

**决策 B（呈现增量来源）**：呈现刷新走 core `onCanonWrite` 接缝（MCP 最知道改了啥），**不**从 GmDriver 转发工具调用——二者解耦、更可靠。首屏/重连仍用 `GET /presentation` 全量（已实现）。

---

## 5. 错误处理

- **GmDriver 异常 / SDK 失败**：SessionHost 捕获 → WS `error{code,message}` → 回合可重试；不崩进程（per-session try/catch，企业多 session 下一个 session 故障不波及别的）。
- **onCanonWrite 回调抛错**：吞掉并记日志，**不阻断 runTool 主流程**（呈现增量是尽力而为；首屏全量是兜底对账基准，与接口 §5「fire-and-forget」一致）。
- **L3 block**：沿用 adapter `turnEnd` 既定——block reason 作下一轮注入重驱 GM，不静默吞。
- **WS 断线**：客户端重连 = `GET /presentation` + `GET /events?since=` 补齐再续流（接口 §3 既定，前端已有首屏拉取）。

---

## 6. 鉴权 / 模型 / 传输

- **鉴权沿用 Claude Code 现配**（`~/.claude/settings.json` 的 `env`）：`ANTHROPIC_BASE_URL`（自建中转 relay）+ `ANTHROPIC_AUTH_TOKEN`。Agent SDK 原生读这两个 env。
- **密钥纪律**：token 是密钥，**只从 env 读，绝不写进代码 / 本 spec / 任何提交物**。提供 `apps/orchestrator/.env.example`（仅占位键名、无真值）+ README 说明「值从 `~/.claude/settings.json` 取或自配 relay」。orchestrator 启动时校验这两个 env 存在，缺失则明确报错（不静默连官方端点）。
- **GM 模型**：默认 `opus[1m]`（与 settings `model` 一致），`DICELORE_GM_MODEL` env 可覆盖。
- **传输**：WS（接口 §3/§4 的 `…/ws`）。SSE 作未来可选，本期不做。

---

## 7. 测试策略

- **纯逻辑单测（不烧 LLM）**：`turnLoop` / `notify` / `SessionHost` 用 **FakeGmDriver**（脚本化发 `narration`/`turn_end` + 用内存 db 直写模拟工具副作用触发 onCanonWrite），覆盖：narration 推送、写→`presentation_delta`、turn_end→choice 物化→`choices`、L3 block 重注入、错误→WS error。
- **core 单测**：`createMcpServer` + `onCanonWrite` 用内存 db，断言工具写后回调被调、payload 正确；`main.ts` stdio 路径回归不变。
- **集成冒烟（opt-in，不进 CI）**：真 Agent SDK + relay，跑一个真回合；带 `RUN_LIVE=1` 守卫。
- **端到端**：webapp-testing（Playwright）连 orchestrator（FakeGmDriver 后端或注入脚本），验前端 narration/呈现台/choices 实时渲染。

---

## 8. 架构决策记录：为何 in-process

企业多 session 并发下，stdio 子进程挂载 = 每 session 一个额外 Node 进程（内存/启动/FD 成本随 session 线性涨，几百 session 先到顶）。in-process：

- 单 session 开销低一个量级（无子进程，仅多一组对象 + db 句柄）；工具调用无 stdio IPC 跳。
- 横向扩展靠多 orchestrator 实例分片 session（webhook payload 带会话标识，接口 §5 已留路）；隔离放到实例级（per-session try/catch + 有界 N/实例）。
- 瓶颈是 LLM 推理（网络 I/O，秒级），同步 sqlite（微秒~毫秒）相对可忽略；重 FTS 真成瓶颈再丢 worker thread。
- 明骰（Phase 2）的 `setRollGate` 注入在 in-process 下零 hack。

代价：需 core `createMcpServer(db)` 工厂（§2.1，additive 小活，本设计含）；同进程共享 fate（用 per-session 错误边界 + 实例级隔离兜）。

---

## 9. 落档清单（本设计批准后）

- `docs/wiki/04-子系统设计/玩家客户端.md` §9.1 实现进度 → 追加 Phase 1 落地后状态。
- `docs/wiki/04-子系统设计/MCP工具面.md` → `createMcpServer(db, deps)` 工厂 + `onCanonWrite` 接缝（与组件2 协调，标 additive）。
- 视情况新增 ADR（in-process 挂载裁定 / onCanonWrite 接缝）。
- `docs/todo/` → Phase 2（明骰）交接更新。

---

## 10. 本设计**不**负责定的

- 接口具体字段名 / schema → [玩家客户端-接口](../../wiki/04-子系统设计/玩家客户端-接口.md) + `packages/shared`（已定形）。
- 明骰一切 → [明骰设计](2026-06-21-player-gated-roll-design.md) / Phase 2。
- 实现任务拆分 + 上游排序 → 紧接其后的 writing-plans 实现计划。
- 前端 narration/呈现台/choices 的视觉细节 → [玩家客户端-视觉](../../wiki/04-子系统设计/玩家客户端-视觉.md)。
