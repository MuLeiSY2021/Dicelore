# 决策账本（2026-07-10 扫描）

> 本轮 = 推进 **acceptance-loop-2026-07-06** 产出：全部 17 份**已勾批准**裁决 + 4 个 0706「无需裁决」的 fix。
> 来源 findings：[`docs/tdd/acceptance-loop-2026-07-06/findings.md`](../../tdd/acceptance-loop-2026-07-06/findings.md)。

## 关键事实（阶段1 摸底结论）

- **17 份裁决全部 `[X]` 已批准**——所有产品/承重/外部可见行为/边界/安全策略决策都已在裁决文件里拍定写死。**故本轮阶段1 无向用户提问的不可逆决策**（设计评审闸已在「写裁决 + 用户勾」时过完）。
- **narrate-hook-extension 代码已落 main**（走 spec 路线，Jun 29–30）：watcher.source / anchor 边表 / has() 谓词均已实现 + 单测。它**不产实现节点**，只在最终收尾沉 wiki + 随 a-prime 收口删裁决。它已否决 a-prime §2/§3（物理表方案），a-prime §2/§3 **不产实现节点**。
- 其余裁决 + 4 fix 全部**未交付**（各 agent grep 核实）。

## 可逆（已自决，记默认值供回溯，无需用户）

- **[会话面拉平作单节点]** `session-surface-flatten` 的 6 个 §小节（路由改名/显式建/loregm list/meta/SessionSummary schema）**捏成一个节点**。理由：它是**单一 HTTP 表皮重构需求**，子部分不可独立交付（路由还是 `/lore-sessions` 时无法加 `/sessions/loregm/{id}` meta），且全部重写 dice.ts+lore.ts+client.ts 同 3 文件，拆成并行 worktree = 纯冲突无收益。属前提③「地板即单一需求」，非按文件打包。
- **[统一 config 端点作单节点]** `POST/GET /sessions/{kind}/{id}/config` 被 model-switch + spoiler-tiering + usage-and-context 三份裁决共同需要 → **合成一个后端节点 `config-endpoint`**，一次交付所有字段（model / spoilerTier），三裁决协同、勿并发各写。skill 明示。
- **[前端 feature 节点折进 frontend-ia-rebuild]** rollband/hidden-roll/spoiler/model-switch/usage 的**前端渲染**部分，与 frontend-ia-rebuild 的 D2–D7（play 桌面沙盘含 roll/choices/dock/bay/usage/ctx 渲染）是**同一份工作**。故前端渲染统一由 frontend-ia-rebuild 的 D-节点交付，不另起重复前端节点。
- **[usage-stream 排 Wave 2]** 虽是根，但其 lore 侧改 handleMessage/endpoint 与 session-flatten 重写 lore.ts 撞，且端点路径随 flatten 变 → 排在 flatten 合入后（Wave 2），避免 lore.ts 冲突。
- **[a-prime toolgen/stdlib 三工具同波]** §4/§5/§6（typed-state/relation/memory）共享 toolgen/*+stdlib/*，同波交付、集成时主 agent 解重叠。
- **[open 系 fix 排 flatten 之后]** fix-open-head-ref / fix-open-500 改 dice.ts /open 路径，session-flatten 重写该文件（/open 懒建改显式建）→ 排 Wave 2 建在拉平后的表面上。

## 不可逆（本轮无——全部已在裁决批准闸拍定）

- 无。所有不可逆决策已随各裁决文件由用户一次审清打勾。

## 实现中浮现（Workflow 冒泡上来后回填）

- （待各波 surfacedDecisions 回填）

## 手动门清单（这些需 RUN_LIVE/dogfood/浏览器 e2e，最终收尾标「待测试」、裁决暂留）

- **gm-session-continuity**：resume 续接行为需真起两回合 SDK session 验（offline 只能验装配）。
- **usage-and-context**：auto-compact 回落 / context_compacting WS 需真长会话；foot%/浮窗需浏览器 e2e。
- **dicegm-skill-corpus-distill**：eval-loop / settle 需 dogfood 烧 LLM（依赖 skill-creator eval-loop harness）。
- **rollband §三 / usage §七**：memory/mcp 分项真实 token 需 dogfood。
- **hidden-roll / loregm-ws**：暗骰全链 + loregm WS 事件流需 e2e / dogfood。
- **frontend-ia-rebuild 全部 + dock-card-template**：浏览器 e2e（chromium + 真后端 + dogfood）。
- **debrief 前端 / branch 前端 / custom-mcp 前端两按钮**：浏览器 e2e。
