# 组件7「玩家客户端」实现设计 (Design)

> **状态**：🟢 已 brainstorming 定稿（2026-06-20）。
> **上游权威 spec**：[玩家客户端.md](../../wiki/04-子系统设计/玩家客户端.md)（§0 范围 / §1 总览 / §2 编排后端 / §3 数据流 / §5 选择捕获 / §6 通知缝 / §7 双壳 / §8 自定义MCP / §9 v1）、[玩家客户端-接口.md](../../wiki/04-子系统设计/玩家客户端-接口.md)（§1 呈现模型 / §2 REST / §3-4 流式 / §5 webhook）、[ADR-0018](../../wiki/05-决策记录-ADR/README.md)、[总体架构 §6/§7](../../wiki/03-架构/总体架构.md)、[跨agent §6](../../wiki/03-架构/跨agent与适配层.md)、[adapter §7 呈现模型生成器](../../wiki/04-子系统设计/adapter与L3审计.md)、[MCP工具面](../../wiki/04-子系统设计/MCP工具面.md)。
> **本文档职责**：把上游 spec 落成可实现的**模块边界、workspace 布局、接线方式、唯一 `packages/core` 触点的协调、v1 竖切任务 + 上游排序**。wiki 已定的语义不复述。

---

## 0. 目标与范围

把组件7（玩家客户端）落地为 workspace 多包：**编排后端**（Agent SDK headless host）+ **呈现 UI**（web）+ **wire 契约包**，对 `@dicelore/core` 引擎 **单向依赖、几乎不改**（唯一例外 = 组件2 加可选 notify 模块）。

**v1 竖切**（[玩家客户端 §9](../../wiki/04-子系统设计/玩家客户端.md)）：orchestrator + web（浏览器连 localhost）跑通**一个回合**的 GM↔玩家闭环（真 Agent SDK + 真 dicelore MCP + 真 SQLite，样式从简）。**推迟**：Tauri 壳打包、自定义 MCP 管理 UI、视觉美术、元动作 UI、Web 多人托管。

---

## 1. workspace 布局

```
dicelore/                     ← 薄 workspace root（private,只管 workspaces + 委托 scripts）
  packages/
    core/                     ← 引擎(组件1-6) = @dicelore/core；本组件只在组件2 加 notify 模块(§4)
      src/
    shared/                   ← wire 契约 TS 类型(§2) = @dicelore/shared
  apps/
    orchestrator/             ← Node 服务(§3)
    web/                      ← 浏览器 UI(§5)
    desktop/                  ← Tauri 壳(§6，fast-follow)
```

- root `package.json` 为 `private` workspace 管理者（`workspaces: ["apps/*","packages/*"]` + 委托 scripts）；引擎已从 root `src/` 迁入 `packages/core`，对齐主流 monorepo 约定（薄 root + 库在 `packages/`，apps 为部署单元）。
- 依赖方向：`apps/*` → `@dicelore/core` + `@dicelore/shared`；引擎反向零 import。
- `apps/web` 是壳无关纯前端（给 base URL + WS 端点即跑）；`apps/desktop` 仅打包 web 构建 + spawn orchestrator sidecar。

---

## 2. `packages/shared`（wire 契约类型）

把 [接口页](../../wiki/04-子系统设计/玩家客户端-接口.md) 的形状导出为 TS 类型，前后端共用：

- `PresentationSnapshot` / `PresentationDelta`（§1 呈现模型 + §4 changes）。
- `WsServerMessage`（`turn_started` / `narration_delta` / `narration_commit` / `presentation_delta` / `choices` / `turn_ended` / `game_end` / `error` 的判别联合）。
- `RestReq/Resp`（`player_message` / `player_choice` / `presentation` / `events` / `session`）。
- `NotifyPayload`（§5，`kind` 联合 + `delta`）。
- `PROTOCOL = "dicelore.client/1"` / `"dicelore.notify/1"` 常量。

纯类型 + 常量，无运行时依赖。

---

## 3. `apps/orchestrator`（编排后端）

模块（各自可单测、注入假依赖脱端到端）：

| 模块 | 职责 | 依赖 |
|---|---|---|
| `session.ts` | `openSession(env)` → db（读侧）；会话生命周期 | 引擎 `session/` |
| `agent.ts` | 起 Agent SDK 会话：配 `mcpServers`（dicelore stdio + notify-URL env + 自定义）、hooks、systemPrompt/skills、`canUseTool` | `@anthropic-ai/claude-agent-sdk` |
| `hooks.ts` | SessionStart/UPS/Stop 注册（Agent SDK API），**hook 内纯逻辑从 adapter 复用**（rule 召回 / choice 物化 / L3 审计） | adapter 纯逻辑、引擎 store |
| `presentation.ts` | 全量快照（复用 adapter §7 呈现模型生成器，按 `visible` 过滤）+ 把 notify payload 转 `presentation_delta` | adapter 生成器、引擎 store |
| `notify-sink.ts` | 收 MCP webhook（§5 端点 + token 校验）→ 喂 `presentation.ts` → 经 `ws.ts` 推 | shared `NotifyPayload` |
| `http.ts` / `ws.ts` | REST 端点（§2 接口）+ WS/SSE server（§3-4 消息）；动作转 Agent SDK user turn，narrate 流转 `narration_delta` | shared 契约 |
| `main.ts` | bin：组装上述 + 起监听 | 全部 |

- **MCP 挂载**：默认组件2 标准 stdio（附 `DICELORE_NOTIFY_URL` + token env）；进程内挂载为可选优化（用直接回调替代 webhook）。
- **narrate 流**：Agent SDK 的 assistant text stream → `narration_delta`；narrate event 落库 → `narration_commit`。
- **choice 捕获**（[玩家客户端 §5](../../wiki/04-子系统设计/玩家客户端.md)）：Stop hook 物化 → `choices`；`POST /choices` → 记录所选 + 下一 user turn。

---

## 4. 组件2 notify 模块（唯一 `packages/core` 触点）

[玩家客户端 §6](../../wiki/04-子系统设计/玩家客户端.md) 的缝，落在组件2 MCP server：

- **位置**：`packages/core/src/mcp/` 新增 `notify.ts`（叶子 + env 读取），在 `runTool` 成功路径后**据出参拼 `delta` + POST**（fire-and-forget）。
- **门控**：`DICELORE_NOTIFY_URL` 未配 → no-op（Claude Code / stdio 路径零影响）。
- **不改既有工具语义**：纯 additive 包装,挂在 dispatch 之后；自定义 MCP（非本 server）天然不发。
- **协调**：组件2 已合并（`packages/core`），`runTool` 出参已含 `event_id` / `fired_watchers` / mutation 账本（[MCP工具面 §4.2/§4.3](../../wiki/04-子系统设计/MCP工具面.md)），notify 模块只读不改；**改动集中在新文件 + dispatch 后一个 hook 点**，评审 package 精确圈定。

---

## 5. `apps/web`（呈现 UI，先不谈美术）

| 模块 | 职责 |
|---|---|
| `transport.ts` | REST 客户端 + WS/SSE 连接（重连：先 `GET /presentation` + `/events?since=` 补齐再续流，按 `seq`/`narrativeCursor` 去重） |
| `store.ts` | 前端状态：应用 `presentation_delta` 增量、合并快照 |
| `panels/`（叙述区 / 状态面板 / 机械回显 / 待选项 / 输入框） | 渲染三流（流① narration / 流② presentation / choices） |

- 框架选型（React/Vue/Svelte）+ 视觉 → 留视觉轮 / 实现期定；本 spec 只定信息架构与数据接线。

---

## 6. `apps/desktop`（Tauri 壳，fast-follow）

- 打包 `apps/web` 构建 + spawn `apps/orchestrator` 单二进制 sidecar（`bun --compile` / Node SEA，分 OS）。
- webview 连 localhost orchestrator（同浏览器路径）；一次性 Claude 登录引导。
- **不在 v1 竖切**——竖切的 web-in-浏览器即 Tauri 要包之物。

---

## 7. v1 竖切任务 + 上游排序

1. **`packages/shared`**：契约类型（§2）——无上游阻塞，先行。
2. **组件2 notify 模块**（§4）——组件2 已合并（`packages/core`），可直接对真 `runTool` 出参实现 + 单测。
3. **orchestrator**：`presentation.ts`（复用 adapter 生成器，可先单测）→ `agent.ts`/`hooks.ts`（接 Agent SDK）→ `notify-sink.ts` → `http.ts`/`ws.ts` → `main.ts`。
4. **web**：`transport.ts` → `store.ts` → panels。
5. **端到端**：浏览器连 localhost 跑通一个回合。

> **硬排序点**：进程内/标准 stdio 挂载都依赖组件2 的 `TOOLS`/`runTool` + notify 出参；组件2 已合并（`packages/core`），orchestrator 接 MCP 那步可直接进行。`presentation.ts` / `packages/shared` / web 骨架不阻塞，可并行先做。

---

## 8. 测试策略（TDD）

- `packages/shared`：类型编译 + 判别联合穷尽性。
- `presentation.ts`：喂内存 db（`openDb(":memory:")` + initSchema）+ 定可见性，验全量快照与 delta 转换。
- `notify.ts`（组件2）：假 `runTool` 出参 → 验 payload 形状 + URL 未配 no-op。
- `hooks.ts`：复用 adapter 纯逻辑的单测；host 注册薄、不强求集成测。
- `transport.ts`：假 WS/REST，验重连补齐 + `seq` 去重。
- `main.ts` / 端到端：薄、副作用重，不强求自动化；竖切手验一个回合 + `npx tsc --noEmit` 兜底。

---

## 9. 协调与边界

- **不碰 `docs/wiki`**（本设计的 wiki 沉淀已在 brainstorming 阶段独立 commit）。
- **`packages/core` 唯一改动 = 组件2 notify 模块**（§4）——改动集中在新文件 `src/mcp/notify.ts` + dispatch 后一个 hook 点，`git add` 自己的文件，绝不 `git add -A`。
- workspace 布局（薄 `private` root + `packages/core` 引擎 + `packages/shared`）已落地；`apps/*` 在新目录，与引擎物理隔离。
- 其余全在 `apps/*` + `packages/*` 新目录，物理隔离。

---

## 10. 模块边界自检

| 模块 | 做什么 | 依赖 |
|---|---|---|
| `packages/shared` | wire 契约类型 | 无 |
| `orchestrator/presentation` | 全量快照 + delta 转换 | adapter 生成器 / store |
| `orchestrator/agent`+`hooks` | Agent SDK 接线 + hook 复用 | SDK / adapter 纯逻辑 |
| `orchestrator/notify-sink` | 收 webhook → 推流 | shared |
| `orchestrator/http`+`ws` | REST + 流式 | shared |
| `@dicelore/core` src/mcp/notify（组件2） | 规范态写后发 webhook | env / runTool 出参 |
| `web/transport`+`store` | 连接/重连 + 增量合并 | shared |
| `web/panels` | 渲染三流 | store |
