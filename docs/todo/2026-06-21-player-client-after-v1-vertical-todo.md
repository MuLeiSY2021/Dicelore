# 玩家客户端（组件7）— v1 非阻塞竖切已合并后,下一步 TODO

> **用途**：给**下一个 session** 的待办 + 起手提示词。上一阶段（2026-06-21）已出实现计划并执行落地、合并回 `main`。
> **本轮已完成**：[实现计划](../superpowers/plans/2026-06-21-player-client-v1-impl.md) 的**非阻塞竖切**全部 7 任务（见下「已完成」）。
> **前置 handoff（已消费）**：[2026-06-21-player-client-next-todo.md](2026-06-21-player-client-next-todo.md)（其选项 A 已执行；B/C 状态见下）。

---

## 已完成（已在 main,193 测试全绿）

| 包 / 模块 | 产物 |
|---|---|
| `packages/shared` | 接口页 §0-§6 线上契约（zod schema + 推断类型，单一真相） |
| `packages/core` | additive 公共 barrel（`openDb`/`initSchema`/`buildPresentationModel`，未改引擎） |
| `apps/orchestrator/src/presentation.ts` | core `PresentationModel` → 接口页 §1 线上快照映射 |
| `apps/orchestrator/src/server.ts` | **只读** REST：`GET /sessions/:id/presentation`、`GET /sessions/:id`（Hono） |
| `apps/web` | Vite+React+TS · 墨金 token 主题（暗/亮 + 5 强调色 + 三档字体）· Lucide 图标登记 · bar+四路由+四页**壳** |

---

## 起手提示词（复制以下整段给新 session）

```
继续 dicelore「玩家客户端（组件7）」。v1 非阻塞竖切已合并 main(shared 契约 / core barrel / orchestrator 只读 REST + presentation.ts / web 外壳骨架+墨金主题+Lucide)。先读权威文档与现状,再动手:

- docs/wiki/04-子系统设计/玩家客户端.md / 玩家客户端-接口.md / 玩家客户端-视觉.md（三轮定稿）
- docs/superpowers/plans/2026-06-21-player-client-v1-impl.md（上一轮实现计划 + 已完成范围）
- 现状代码：packages/shared、packages/core/src/index.ts、apps/orchestrator/src/{presentation,server}.ts、apps/web/src/**

我要做的是【从下面选,删掉不要的】:
D) 不阻塞·最划算:把只读快照串到 UI —— web 写一个 API client(fetch GET /sessions/:id/presentation),
   跑团页呈现台改用真实快照首屏渲染(sheets→人物属性面板 / mechanics→机械回显 / choices→选项按钮)。
   增量(WS presentation_delta)仍阻塞,先只做首屏全量。这一步把 T3/T4 串到肉眼可见。
E) 不阻塞·页面实质化:① 配置→主题外观子页接已有 useTheme(明暗/强调色立即可用);
   ② 主页继续上次卡片 + 最近 Session 列表(需 orchestrator 加只读 GET /sessions 列表端点);
   ③ 配置其余展示态子页(MCP 服务器/模型连接/数据与存储)骨架。
F) 文档回填(B 项,纯文档·随时可做):把视觉 spec §8 待回填同步进设计页/接口页 ——
   「状态显示→呈现台」改名 + 五域分开 + 自查/钉选;d10 区间裁决与 choices/resolve_* 形状厘清;会话定位为左活动轨自查源。

请先确认读到的现状与设计一致,再开工。
```

---

## 仍阻塞（不在下一轮·等上游合并）

- **跑团页实时通路**（narration 流式 / `presentation_delta` 增量 / `choices` 推送 / 掷骰裁决动效）+ orchestrator **写侧**（`POST messages`/`choices` + Agent SDK + dicelore MCP + 三 hook + WS 流 + notify sink）← **等组件2 MCP 工具面合并**。
- **团本制作页真实能力** ← **等组件5 Web 门面**。

---

## 上下文速览（供人快速回忆）

- **本轮范围边界**：只做「壳通 + 契约通 + 只读快照通」,页面内容多为占位——非未完成,是有意画的边界。
- **`choices` 形状**：本轮严格镜像接口页 §1 现状（`{eventId, options:[{index,label,consequence}]}`）,**未**引入 d10 区间语义（属 F/B 项待厘清）。
- **下一轮最划算**：D（把只读快照渲染到呈现台,让竖切肉眼可见）+ E①（主题外观子页,半小时把 ConfigPage 从占位变可用）。F 可与代码并行、零依赖。
- **前端框架**：React + Vite + TS（已定,见实现计划）。
