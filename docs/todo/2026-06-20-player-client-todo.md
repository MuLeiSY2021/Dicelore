# 玩家客户端（组件7）— 下个 session 起手提示词

> **用途**：本文件是给**下一个 session** 的待办 + 起手提示词。玩家客户端的 brainstorming 已定稿、设计已落 wiki + spec，**尚未进实现**。把下面「起手提示词」整段贴给新 session 即可接续。

---

## 起手提示词（复制以下整段给新 session）

```
继续 dicelore「玩家客户端（组件7）」的工作。设计已在上一个 session 定稿并落入 wiki + spec，请先按顺序读这些权威文档，再动手：

- docs/wiki/05-决策记录-ADR/README.md → ADR-0018（立项五连：GUI 提前 / Agent SDK headless host / 一契约两壳 / 玩家选择捕获 / 自定义 MCP 周边边界 + webhook 通知缝 + 几乎不改 src/）
- docs/wiki/04-子系统设计/玩家客户端.md（组件7 设计页）
- docs/wiki/04-子系统设计/玩家客户端-接口.md（REST / 流式 WS·SSE / MCP→后端 notify webhook 契约）
- docs/superpowers/specs/2026-06-20-player-client-design.md（实现落地：workspace 布局 / 模块边界 / v1 任务 + 上游排序）
- 旁证：docs/wiki/03-架构/总体架构.md §7 组件7、跨agent与适配层.md §6 轴二

我要做的是【从下面三选一，删掉不要的】：
A) 转 writing-plans，把上面 spec 出成实现计划。注意硬排序：接 dicelore MCP 那步等组件2（MCP 工具面）合并；先规划不阻塞的部分（packages/shared 契约类型 / orchestrator 的 presentation.ts / web 骨架）。
B) 先做「视觉设计专轮」——给玩家客户端定配色 / 排版 / TRPG 沉浸感，再进实现（可用 frontend-design 或视觉伴侣）。
C) 先把上一个 session 的 wiki + spec 改动提交 git。

请先确认你读到的设计与我的意图一致，再开工。
```

---

## 上下文速览（供人快速回忆）

**定位**：完整独立玩家客户端，= adapter（组件4，Claude Code TUI host）之外并列的 web host。
**三层**：编排后端（`apps/orchestrator`，Agent SDK headless = 程序化 Claude Code）/ 呈现 UI（`apps/web`，壳无关）/ 双分发壳（Tauri 个人 · Web 企业）。
**仓库**：同仓 workspace 多包（root 引擎包不动 `src/`，加 `apps/*` + `packages/*`）。
**与 core**：单向依赖、几乎不改 `src/`；**唯一例外** = 组件2 MCP server 加可选 notify 模块（webhook 通知缝，需与组件2 协调）。
**自定义 MCP**：周边能力、不碰规范态；权限闸 + L3 out-of-canon。

**已定但留实现**：接口字段名以 `packages/shared` 实现定稿；前端框架选型（React/Vue/Svelte）；视觉美术。
**推迟（fast-follow）**：Tauri 壳打包 + 登录引导、自定义 MCP 管理 UI、元动作（rewind/branch/swipe）UI、Web 多人鉴权/会话路由。

**v1 竖切**：orchestrator + web（浏览器连 localhost）跑通一个回合的 GM↔玩家闭环（真 Agent SDK + 真 MCP + 真 SQLite，样式从简）。

**硬阻塞**：orchestrator 接 MCP（`TOOLS`/`runTool`/notify 出参）**等组件2 合并**；`packages/shared` / `presentation.ts` / web 骨架不阻塞、可并行先做。

**未提交**：上一 session 的 wiki + spec 改动尚未 git commit（待用户决定）。
