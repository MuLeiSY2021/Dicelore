# 玩家客户端（组件7）— 视觉定稿后,下一步起手提示词

> **✅ 已消费（2026-06-21）**：选项 **A（出实现计划）已执行并合并 main**——见 [实现计划](../superpowers/plans/2026-06-21-player-client-v1-impl.md) 与接续 handoff [2026-06-21-player-client-after-v1-vertical-todo.md](2026-06-21-player-client-after-v1-vertical-todo.md)。**B（视觉 spec §8 回填）/ C（工程地基）未单独执行**：C 的 workspace 多包已随 A 落地（已建 `apps/web`/`apps/orchestrator`/`packages/shared`）；B 仍待做（见接续 handoff 的 F 项）。本文留作历史。
>
> **用途**：给**下一个 session** 的待办 + 起手提示词。视觉设计专轮已完成(2026-06-21,墨金主题 + 四页 IA 定稿、落 wiki + 草图 + spec)。接下来进**实现计划**。把下面「起手提示词」整段贴给新 session。
> **前一阶段产物**：[玩家客户端-视觉](../wiki/04-子系统设计/玩家客户端-视觉.md) + [定稿草图](../wiki/04-子系统设计/玩家客户端-视觉草图/) + [视觉 spec](../superpowers/specs/2026-06-21-player-client-visual-design.md)。

---

## 起手提示词（复制以下整段给新 session）

```
继续 dicelore「玩家客户端（组件7）」。设计 + 接口 + 视觉三轮均已定稿并落 wiki,现在出实现计划。先按顺序读这些权威文档,再动手:

- docs/wiki/04-子系统设计/玩家客户端.md（组件7 设计:三层 / 三流 / 通知缝 / 自定义 MCP / v1 竖切）
- docs/wiki/04-子系统设计/玩家客户端-接口.md（REST / 流式 WS·SSE / MCP→后端 notify webhook 契约）
- docs/wiki/04-子系统设计/玩家客户端-视觉.md（墨金设计语言 token / 字体 / 图标 / 外壳 IA / 四页面）
  └ 配套定稿草图:docs/wiki/04-子系统设计/玩家客户端-视觉草图/（home/play/build/config 四页 HTML + 截图）
- docs/wiki/05-决策记录-ADR/README.md → ADR-0018（立项五连）
- 旁证:docs/wiki/03-架构/总体架构.md §7 组件7、跨agent与适配层.md §6 轴二

我要做的是【从下面选,删掉不要的】:
A) 转 writing-plans,把视觉 spec + 组件7 设计/接口出成实现计划。注意硬排序:
   - 不阻塞、先规划:packages/shared 契约类型(镜像接口 §1-§5)、设计 token / 主题系统(墨金 + 明暗 + 可选强调色)、Lucide 图标接入、apps/web 外壳骨架(bar + 路由 + 四页面壳)、orchestrator 的 presentation.ts(呈现模型生成器,复用 adapter 纯逻辑)。
   - 硬阻塞:orchestrator 接 dicelore MCP（TOOLS / runTool / notify 出参）等【组件2 MCP 工具面】合并;团本制作页等【组件5 构建台 Web 门面】。
B) 先把视觉 spec §8「待回填」回填进 wiki 设计页/接口页再进实现:
   - 「状态显示」→「呈现台」改名 + 五域分开 + 自查/钉选 + style 预设 + 网格停靠 + 最小化;
   - 掷骰式裁决 UI（GM 给 d10 区间 → 单按钮丢骰）与 内层 resolve_* / 接口 choices 形状的关系厘清;
   - 会话定位为跑团页左活动轨自查源。
C) 先做 v1 竖切的工程地基:初始化 workspace 多包(root 不动 src/,加 apps/web + apps/orchestrator + packages/shared),搭最小可跑骨架。

请先确认你读到的设计/视觉与我的意图一致,再开工。
```

---

## 上下文速览（供人快速回忆）

**视觉已定**：墨金主题（深墨绿 `#0c211a` + 赤金 `#d4a83e`,token 化可换肤 + 明暗双态 + 可选强调色）· Playfair/Inter/JetBrains Mono 三档字体 · Lucide 线性图标 · 外壳 IA（bar + 四页;跑团=面板工作区,团本制作/配置=子页型）· 呈现台(网格停靠/钉选/style 预设) · d10 掷骰 + 圆形 PbtA 钟。四页定稿草图在 wiki。

**实现硬排序**（不变）：`packages/shared` / token 主题 / web 骨架 / `presentation.ts` 不阻塞、可先做;orchestrator 接 MCP **等组件2 合并**;团本制作页 **等组件5 Web 门面**。

**仍未做**：① 视觉 spec §8 的待回填(呈现台改名等)尚未同步进组件7 设计页/接口页;② 前端框架选型(React/Vue/Svelte)未定,留实现计划里定;③ 工程脚手架(workspace 多包)未起。

**v1 竖切目标**（不变）：orchestrator + web 跑通一个回合 GM↔玩家闭环（真 Agent SDK + 真 dicelore MCP + 真 SQLite,样式套墨金从简）。
