# delivery_dag（2026-07-10 路线图推进 · acceptance-loop-2026-07-06 全量）

> 设计稿：全图依赖 + 分波 + 热点文件冲突。发某波时把该波 roster 冻结成 `wave_N_nodes.jsonl`。
> 一需求一节点、一 worktree、一 implement agent。前端渲染统一折进 frontend-ia-rebuild（见决策账本）。

## 波次总览（真实拓扑深度 ≈ 6 波，非 3；波次动态重算）

> **要紧**：下面「后端桶 / 前端桶」是**领域分组**，不是波。一波的定义（skill）= `depends_on` 已全合进 main 的就绪需求。桶内仍有依赖边（如 relation 依赖 typed-state、co-build 依赖 co-play、前端 sandbox 依赖 shell），故**每桶都会裂成多波**。真实波数按每次合并后**动态重算就绪集**得出，不预先冻死。

```
W1  offline roots（无依赖）：会话面拉平 / continuity / visible 列 / usage schema / 2 fix / 语料研究
     ↓ 合 main → /sessions/{kind}/ 表面 + shared schema 就位
W2  后端无依赖 + 仅依赖 W1 的一大批（见下表·depends_on 仅 W1 项 或空）
     ↓ 合 main → 后端契约/端点就位
W3  aprime-relation(依赖 typed-state) / co-play(依赖 usage-consumers)
W4  co-build(依赖 co-play) / fe-shell-bay(前端壳·依赖后端契约)
W5  fe-play-sandbox(拆 PlayPage 子组件文件) / fe-build-skeleton / fe-mcp-config
W6  play features 并行(各占一子组件文件) + fe-build-gaps + scrollbar
最终收尾  批量沉 wiki + 删裁决 + 全量 typecheck/test
```

**前端为何是串行链、不是一次 fan-out**：fe-play-* 全重写同一 `PlayPage.tsx`，并行 worktree 合并=巨型冲突。故 W5 的 fe-play-sandbox 先把 PlayPage **拆成子组件文件**（stream/roll/dock/bay/usage 各一文件），W6 的 feature 节点各占一个子文件才可真并行。

> 下面「Wave 2 / Wave 3」标题保留作**领域桶**读，节点的真实波位以各行 `depends_on` + 上面的 W1–W6 拓扑为准。

---

## Wave 1 — 会话面拉平 + 独立地基契约（offline · roots）

| id | 标题 | 层 | owns（预期触及·非独占） | depends_on |
|----|------|----|------------------------|------------|
| `session-surface-flatten` | HTTP 表皮拉平 `/sessions/{kind}/*`：dicegm 前缀化 + loregm 改名删旧 + 显式建会话(RT1·删懒建) + loregm list(RT6)/meta(RT7) + SessionSummary 统一(packName 不空·补 lastaction/lastReply) | backend+shared | `backend/src/api/dice.ts`, `backend/src/api/lore.ts`, `packages/shared/src/rest.ts`, `frontend/src/features/*/client.ts`, `backend/src/api/sessions.ts` | — |
| `gm-session-continuity` | 一团一 SDK session：resume 透传 + 首回合 session_id 存 meta + 后续注入 resume + 失败报错降级(C4) | core=harness | `harness/src/runtime/agent.ts`, `harness/src/dicegm/gmAssembly.ts`, `harness/src/dicegm/DiceGm.ts`, `harness/src/dicegm/DiceSession.ts` | — |
| `narrative-visible-column` | a-prime §1：front/plotline/foreshadow 加 `visible` 列 + show/reveal_once 扩到叙事三表 + 快照含 | backend | `backend/src/store/db.ts`, `backend/src/store/narrative/{front,plotline,foreshadow}.ts`, `backend/src/store/sheet/visibility.ts`, `backend/src/store/snapshot.ts` | — |
| `usage-stream-schema` | shared `turn_ended` 加可选 `usage{in,out,cacheRead,cacheCreation}`（向后兼容） | core=shared | `packages/shared/src/stream.ts` | — |
| `fix-eval-runsh-port` | `.dicelore-eval/run.sh` PORT 注释态崩：`read_config_port \|\| true` | core=harness | `harness/eval-setup/run.sh.tmpl`（或对应模板） | — |
| `fix-fake-gm-wiring` | server.ts FAKE_GM agentFactory 按 env 选教练档 CanonScript(传 canon/backend) + lore 侧假构建驱动 | core=backend+harness | `backend/src/server.ts`, `harness/src/dicegm/FakeDiceGm.ts`, lore 假构建驱动 | — |
| `distill-corpus-research` | dicegm-skill-corpus-distill RD-1+RD-2：读 3 份 scraped 语料产模式总结 md + skill diff 建议（offline·纯研究文档） | core=docs | `docs/research/randomness-narrative-patterns.md`（新）, 读 `docs/research/scraped/*`, `harness/src/dicegm/skills/dicelore-gm-core/SKILL.md`(读) | — |

**Wave 1 热点**：`lore.ts`/`dice.ts` 仅 session-surface-flatten 独占（其余节点不碰）→ 本波内几乎无冲突。

---

## Wave 2 — 后端 feature（建在拉平表面上 · offline 为主）

| id | 标题 | 层 | owns | depends_on |
|----|------|----|------|------------|
| `aprime-typed-state-tools` | a-prime §4：类型化 state 读写工具 + 删裸 sheet_get/list（留 sheet_update 兜底/sheet_show） | backend | `backend/src/toolgen/*`, `backend/src/stdlib/*`, `harness/src/dicegm/mcp/handlers/sheet.ts` | — |
| `aprime-relation-tools` | a-prime §5：relation_set/relation_query 声明式独立工具 | backend | `backend/src/toolgen/*`, `backend/src/stdlib/*`, `backend/src/store/views.ts` | aprime-typed-state-tools（范式复用） |
| `aprime-memory-tools` | a-prime §6：mark_moment/history_compact/recall | backend | `backend/src/toolgen/*`, `backend/src/stdlib/*`, `backend/src/store/fts.ts`(读) | — |
| `aprime-presentation-view` | a-prime §7(RT-FE4 根)：PresentationSnapshot/Changes 加 plotline/foreshadow/lore + buildSnapshot 接视图按可见范围过滤 | core=shared+backend | `packages/shared/src/presentation.ts`, `backend/src/api/presentation.ts`, `backend/src/store/views.ts` | narrative-visible-column(W1) |
| `usage-stream-consumers` | usage-stream §2+§3：dice turnLoop 累计塞 turn_ended.usage + lore handleMessage 返 {turnId,usage} + endpoint | core=harness+backend | `harness/src/dicegm/turnLoop.ts`, `harness/src/loregm/LoreSession.ts`, `backend/src/api/lore.ts` | usage-stream-schema(W1), session-surface-flatten(W1) |
| `config-endpoint` | 统一 `GET/POST /sessions/{kind}/{id}/config`（model+spoilerTier 部分更新；model 下回合生效/spoilerTier 立即）+ harness 每回合读 currentModel | backend+harness | `backend/src/api/sessions.ts`, `backend/src/api/lore.ts`, `backend/src/session/*`, `harness/src/dicegm/gmAssembly.ts` | session-surface-flatten(W1) |
| `debrief-branch-backend` | debrief 复盘态(status+debrief-mode skill+game_end 幂等) + branch 子资源(POST/GET/checkout) + rewind 收窄当前分支 | core=backend+harness | `backend/src/api/dice.ts`, `packages/shared/src/rest.ts`, `harness/src/dicegm/`(debrief-mode skill) | session-surface-flatten(W1) |
| `custom-mcp-backend` | config.toml `[marketplaces]/[mcpServers]` schema + marketplace add + install(npx -y) + 运行时 stdio 拉起合并工具 + mcp-test 覆盖 | core=backend+harness | `backend/src/config.ts`, `backend/src/api/*`, `harness/src/dicegm/gmAssembly.ts`, `backend/src/api/diagnostics.ts` | — |
| `rollband-backend` | rollband §一：RollBandSchema 加 plan+narration + 工具入参校验 + roll_staged 全量下发 + 命中档 plan 驱动机械 | core=shared+backend+harness | `packages/shared/src/presentation.ts`, `harness/src/dicegm/mcp/handlers/resolver.ts`, `backend/src/resolve/{commitRoll,contest}.ts`, `backend/src/present/playerView.ts` | — |
| `loregm-validate` | rollband §二(RT-FE11)：core validateDraft + `POST /sessions/loregm/{id}/draft/validate` | core=backend | `backend/src/build/pack/validate.ts`, `backend/src/build/draft.ts`, `backend/src/api/lore.ts` | session-surface-flatten(W1) |
| `hidden-roll-backend` | hidden-roll §一(RT-FE6)：stream 加 hidden_roll 类型 + resolve 加 hidden 参立即掷 + visible=0 event + WS emit | core=shared+backend+harness | `packages/shared/src/stream.ts`, `harness/src/dicegm/mcp/handlers/resolver.ts`, `backend/src/resolve/*`, `backend/src/api/ws.ts`, `harness/src/dicegm/notify.ts` | usage-stream-schema(W1·同文件 stream.ts) |
| `loregm-ws-backend` | hidden-roll §二(RT-FE12)：LoreStreamMessage 拆(5类) + loregm ws route + build hooks(toolcall/draft_delta/turn_started/ended) | core=shared+backend+harness | `packages/shared/src/stream.ts`, `backend/src/api/lore.ts`, `backend/src/api/ws.ts`, `backend/src/build/buildMcp.ts`, `harness/src/loregm/LoreSession.ts` | session-surface-flatten(W1) |
| `spoiler-backend` | spoiler §一(RT-FE9)后端：events/stream 全量下发含 visible=0(废 visibleOnly 默认过滤) + bay 按需拉 visible=0 分页端点 | backend | `backend/src/api/dice.ts`, `backend/src/present/playerView.ts`, `harness/src/dicegm/notify.ts`, `backend/src/api/presentation.ts` | — |
| `usage-context-backend` | usage-and-context 后端：CONTEXT_WINDOW 表 + GET /usage 扩 context 字段 + memory/mcp breakdown + auto-compact 注入 + context_compacting WS(第11类) | core=shared+backend+harness | `packages/shared/src/context-window.ts`(新), `backend/src/api/usage.ts`, `backend/src/store/usage.ts`, `harness/src/dicegm/gmAssembly.ts`, `backend/src/api/ws.ts`, `packages/shared/src/stream.ts` | gm-session-continuity(W1) |
| `fix-open-head-ref` | `/open {ref:head}` 500：端点层解析 head→commitId（同 BE-checkout-head） | backend | `backend/src/api/dice.ts`, `backend/src/catalog/*` | session-surface-flatten(W1) |
| `fix-open-500` | 无效包 /open → 4xx 结构化 error（importPack throw try/catch） | backend | `backend/src/api/dice.ts` | session-surface-flatten(W1) |
| `co-play` | 跑团页 per-turn token 内联：useSession rounds 分组 + cost/pricing.ts + PlayPage 内联脚注 | frontend | `frontend/src/features/play/useSession.ts`, `frontend/src/features/cost/pricing.ts`(新), `frontend/src/features/play/PlayPage.tsx` | usage-stream-consumers |
| `co-build` | 构建页 per-turn token 内联：api.ts 返回带 usage + BuildPage 内联（复用 pricing.ts） | frontend | `frontend/src/features/build/api.ts`, `frontend/src/features/build/BuildPage.tsx`, `frontend/src/features/cost/pricing.ts`(复用) | usage-stream-consumers, co-play(pricing.ts) |
| `distill-apply-skill` | dicegm-skill-corpus-distill RD-3：据建议改 SKILL.md + 新增 references/randomness-narrative.md | core=harness | `harness/src/dicegm/skills/dicelore-gm-core/SKILL.md`, `.../references/randomness-narrative.md`(新) | distill-corpus-research(W1) |

**Wave 2 热点**：
- `packages/shared/src/stream.ts`：usage-stream-schema(W1 已合) / hidden-roll / loregm-ws / usage-context 四处**加联合成员/可选字段**——纯加法、集成 trivial。
- `packages/shared/src/presentation.ts`：rollband(RollBand) + aprime-presentation(snapshot) 两处加法。
- `backend/src/api/dice.ts`：debrief-branch / spoiler / fix-open-head / fix-open-500 四处——主 agent 集成时解。
- `backend/src/api/lore.ts`：usage-stream-consumers / config-endpoint / loregm-validate / loregm-ws 四处——主 agent 集成时解。
- `backend/src/toolgen/*`+`stdlib/*`：aprime §4/§5/§6 三处——主 agent 集成时解。
- `harness/src/dicegm/gmAssembly.ts`：config-endpoint / custom-mcp / usage-context 三处。
- `frontend/src/features/cost/pricing.ts`：co-play + co-build 共建。

---

## Wave 3 — 前端 IA 重构 + 前端 feature 渲染（浏览器 e2e 门·代码交付后多标「待测试」）

> frontend-ia-rebuild 的 D2–D7 内部已覆盖 play 页 roll/choices/dock/bay/usage/ctx 的渲染（含 rollband/hidden-roll/spoiler/model-switch/usage 的前端呈现），D8–D9 覆盖 build 页。故本波 = ia-rebuild D 节点 + dock-card 渲染器 + mcp 配置前端。

| id | 标题 | 层 | owns | depends_on |
|----|------|----|------|------------|
| `fe-shell-bay` | D1+RT-FE3：去 TopBar，Shell 只留 Outlet + 全局底部 app-bay 导航（tabs/collapse/expand+nav-status，跑团页默认收起，主题/语言收进 config） | frontend | `frontend/src/shell/*`(去 TopBar), `frontend/src/shell/Bay.tsx`(新), `frontend/src/app/*`, `frontend/src/features/config/*` | (backend 契约 W1/W2) |
| `fe-play-sandbox` | D2：PlayPage 桌面沙盘骨架(stagebar/sandbox/foot 五态 data-screen/ctx-bar) | frontend | `frontend/src/features/play/PlayPage.tsx`, `frontend/src/styles/*` | fe-shell-bay |
| `fe-play-stream` | D3：stream 元素(divider/prose/pmsg/reply/toolcall/tempstack/turn-usage + rewind 确认) | frontend | `frontend/src/features/play/*` | fe-play-sandbox, co-play |
| `fe-play-roll-choices-end` | D4：明骰内联(bandtable+rollresult·rollband plan/narration 三档渲染) + 暗骰 mech + choices 浮层 + 终局复盘态不遮罩 | frontend | `frontend/src/features/play/*` | fe-play-sandbox, rollband-backend, hidden-roll-backend, spoiler-backend, debrief-branch-backend |
| `fe-play-dock-card` | D5+dock-card-template：dock-card markdown 模板渲染器(dc-meta 选择器/dc-body 插值/dial·bar/DIY vs 预设/visible=1 边界/archive localStorage/edit·archive·fold) | frontend | `frontend/src/features/play/*`(dock-card 渲染器·新), `frontend/src/features/play/Markdown.tsx` | fe-play-sandbox, aprime-presentation-view |
| `fe-play-bay-data` | D6：bay 四类数据 popover(chara/plotline/world/forms) + 归档找回 + 防剧透档位开关 + 透视 toggle | frontend | `frontend/src/features/play/*`, `frontend/src/shell/Bay.tsx` | fe-shell-bay, aprime-presentation-view, spoiler-backend, config-endpoint |
| `fe-play-usage-ctx` | D7：stagebar model-switch 下拉 + usage popover(mcp/memory 分项) + ctx-bar 占用条(>90% 变红+压缩提示) | frontend | `frontend/src/features/play/*` | fe-play-sandbox, config-endpoint, usage-context-backend |
| `fe-build-skeleton` | D8：BuildPage 三栏(ctx/bbody[sidenav\|main\|aside]) + sidenav 七组 + data-view 切换 | frontend | `frontend/src/features/build/BuildPage.tsx`, `frontend/src/features/build/*` | fe-shell-bay, session-surface-flatten |
| `fe-build-gaps` | D9：13 缺口补齐(relation nav/三态/loregm error UI/素材上传/session status/校验报告定位/提交vs导出/guideline 阶段/overflow/全绿态/inline 编辑/新建会话 modal/turn usage) + loregm 校验报告(RT-FE11 前端) + loregm WS toolcalls(RT-FE12 前端) | frontend | `frontend/src/features/build/*` | fe-build-skeleton, loregm-validate, loregm-ws-backend, co-build |
| `fe-scrollbar-inkgold` | D10：滚动条墨金配色(stream/dock 各自) | frontend | `frontend/src/styles/*` | fe-play-sandbox |
| `fe-mcp-config` | custom-mcp 前端两按钮(添加 marketplace + 安装) + 配置项 table + out-of-canon 徽 + 连接测试（重构旧 McpServers.tsx localStorage 模型） | frontend | `frontend/src/features/config/McpServers.tsx`, `frontend/src/shared/settings/useSettings.tsx` | custom-mcp-backend, fe-shell-bay |

**Wave 3 热点**：`PlayPage.tsx`/`useSession.ts`（多 D 节点+co-play）、`BuildPage.tsx`（D8/D9+co-build）、`Bay.tsx`（D1/D6/D7）、`styles/*`。前端节点内部依赖串行（D1→D2→D3..D7；D8→D9）。**几乎全部浏览器 e2e 门 → 代码交付后标「待测试」，chromium/dogfood 未就绪则退单测层。**

---

## 最终收尾（DAG 跑空后·一次性）

- 批量沉 wiki：17 份裁决 + 4 fix 的设计结论一次沉进对应设计页「决策与权衡」节 / 04 子系统设计；现状 🚧→✅ / 待测试；关 backlog；勾路线图。
- narrate-hook-extension：确认已沉 wiki（内层能力库/核心概念）→ 删裁决。
- 统一删本轮所有**已完全交付且无手动门**的裁决文件；有手动门的（gm-continuity/usage-context/skill-distill/hidden-roll/loregm-ws/frontend-ia/dock-card/debrief 前端/custom-mcp 前端）标「待测试」、裁决**暂留**到手动门过。
- 最终 `typecheck:all` + `test:all` 全绿。
