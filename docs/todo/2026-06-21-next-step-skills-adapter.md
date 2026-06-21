# 下一步（组件3 Skills 包 / 组件4 adapter）— 下个 session 起手提示词

> **用途**：给**下一个 session** 的待办 + 起手提示词。组件1（内层能力库）+ 组件2（MCP 工具面）已实现并合并；引擎已迁入 `packages/core`（= `@dicelore/core`）。按总体架构 §7 构建顺序，GM 运行时侧下一步 = **组件3 Skills 包** 与 **组件4 adapter + 输出层渲染器**（两者 wiki 设计均 🟢 已定稿）。把下面「起手提示词」整段贴给新 session 即可接续。
>
> **注意**：组件7（玩家客户端）不在此线——它有独立 todo（[2026-06-20-player-client-todo.md](2026-06-20-player-client-todo.md)）、归另一条线。

---

## 起手提示词（复制以下整段给新 session）

```
继续 dicelore 的 GM 运行时建设。组件1（内层能力库）+ 组件2（MCP 工具面）已实现并合并在 main，引擎在 packages/core（@dicelore/core，npm workspace：root 薄管理者 + 委托 scripts，`npm test` / `npm run dicelore:mcp` 经 root 委托）。下一步是组件3（Skills 包）与组件4（adapter + 输出层渲染器），wiki 设计已定稿。请先按顺序读权威文档，再动手：

- docs/wiki/03-架构/总体架构.md §5 塑形层 / §6 一轮+三流 / §7 组件3·4
- docs/wiki/04-子系统设计/Skills包.md（组件3：常驻 GM 核心 skill + 流程库 / Moves 决策表 / Agenda+Principles / 补刀 L1L2 分工 / 焊进 .claude/skills/）
- docs/wiki/04-子系统设计/adapter与L3审计.md（组件4：dicelore init 写 .claude/ + settings.json / 三承重 hook（SessionStart·UserPromptSubmit·Stop，Node）/ L3 两档烈度 / 输出层呈现模型生成器）
- docs/wiki/03-架构/跨agent与适配层.md（hook 承重、绑 Claude Code、Node 跨端约束）
- docs/wiki/04-子系统设计/TODO.md（组件3/4 已锁定决策账本：ADR-0012/0013/0014/0016/0017）
- 参考已建组件2 的 spec/plan：docs/superpowers/specs/2026-06-20-mcp-tool-surface-design.md + plans/2026-06-20-mcp-tool-surface.md（注意顶部路径迁移横幅：src/ → packages/core/src/）

进 brainstorming 前，先帮我拍这几个因 monorepo 搬迁而新出现的待定点（wiki 设计文档早于 packages/core 迁移）：
1. 落点：组件4 的 adapter（TS：hook 脚本 + dicelore init CLI + 输出层呈现模型生成器）放哪——并入 @dicelore/core，还是新建 packages/adapter？组件3 的 Skills（markdown 教条）放哪——packages/skills/ 还是仓库根 .claude/skills/（被 dicelore init 拷贝/软链）？
2. 先后：组件3 Skills 的措辞终稿靠 eval-loop（需可运行 GM = adapter+MCP），而组件4 adapter 要装 Skills——鸡蛋问题。建议先搭组件4 adapter 骨架（装 MCP + 注入初版纪律 + hook + 输出层）拿到可跑的 Claude Code GM harness，再据它 eval-loop 精修组件3 Skills；或先出组件3 初版（不 eval）→ 组件4 → 回头 eval。让我确认顺序。
3. 输出层呈现模型生成器（adapter §7，读侧纯逻辑、按 visible 过滤、可单测）与组件7 玩家客户端的 presentation 生成器是「同一概念两个渲染器」——注意复用边界，别和组件7 线重复造（但组件7 不归本线，仅留接口意识）。

确认范围与顺序、拍完上面三点后，按 superpowers 流程走：brainstorming（若需）→ writing-plans → subagent-driven-development（组件2 那套并发波次执行模式可复用）。组件4 的 hook/CLI/init 是副作用重的集成层（adapter 设计 §8 已注明不强求自动化测试）；输出层生成器、L3 比对纯逻辑、Skills 的 F1/F2/F3 assertions 可 TDD/eval。

请先确认你读到的设计与意图一致，再开工。
```

---

## 上下文速览（供人快速回忆）

**已完成**：
- 组件1 内层能力库（dice 引擎 / 四域 store / resolve 编排 / session / errors）— plans 2026-06-17 + 2026-06-18。
- 组件2 MCP 工具面（18 个 `dicelore_*` 工具，stdio server）— plan 2026-06-20，已并发波次执行 + 端到端验证全部可调用。
- 仓库结构搬迁：引擎 `src/` → `packages/core`，root 转薄 workspace 管理者（对齐主流 monorepo 约定）。
- 文档清理：删历史输入页、清退 anko_* 旧 Python 痕迹、ADR-0004 改写为「业务驱动设计」。

**下一步候选（GM 运行时线）**：
- **组件3 Skills 包**（L2 GM 教条，markdown）：常驻 `dicelore-gm-core`（Moves+Agenda+Principles）+ 流程库 `dicelore-flow-*`（gacha/contest/anka/explore）。焊进 `.claude/skills/`。设计见 [Skills包.md](../wiki/04-子系统设计/Skills包.md)。
- **组件4 adapter + 输出层渲染器**（TS）：`dicelore init` 写 `.claude/` + `settings.json`；三承重 hook（SessionStart 注入身份纪律 / UserPromptSubmit 被动 rule 召回 / Stop 物化 pending_choice + L3 审计）；L3 两档烈度（A block / B 记录）；输出层呈现模型生成器（读 SQLite、按 `visible` 过滤、零 token、可单测）。设计见 [adapter与L3审计.md](../wiki/04-子系统设计/adapter与L3审计.md)。

**关键依赖/接缝**：
- adapter 三 hook 复用内层：Stop 物化 `materializePendingChoice`（packages/core，已实现）；L3 比对读 event 域；rule 召回走 FTS。
- Skills 的补刀 = MCP `reminders`（L1 terse，已在组件2 实现）+ Principles `references/reminders.md`（L2，组件3 写）。
- 输出层生成器 与 组件7 玩家客户端 presentation 是同一概念两渲染器——留复用意识，但组件7 不归本线。

**留待下个 session 拍的待定点**：见上方起手提示词第 1–3 条（monorepo 落点 / 组件3·4 先后 / 输出层复用边界）。

**未决**：组件5/6（团本构建台 + manifest）设计已定稿（[团本与manifest.md](../wiki/04-子系统设计/团本与manifest.md) / [团本构建工具链.md](../wiki/04-子系统设计/团本构建工具链.md)），作者侧线，待排期。
