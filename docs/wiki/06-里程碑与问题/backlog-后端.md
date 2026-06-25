# backlog · 后端层

> **本页职责**：`apps/orchestrator` 层的 **issue 池**——HTTP·WS 接口 / 会话生命周期 / 进程编排。按**主题**聚类、按 **fix/feat** 标注，广度无序（先还哪个见 [路线图](路线图.md)）。
> **单源（勿重复）**：拍了方案 → 写 [ADR](../05-决策记录-ADR/)，条目改标 `→ ADR-00xx` 关闭；已达成 → 进 [里程碑](里程碑.md)。

## 状态图例
- ✅**确认** — 客观/架构事实（已实测）。
- ⚠️**待真harness** — 行为/措辞类，当前结论不可信（见 [backlog-core 主题F](backlog-core.md)）。
- 💡**设计待ADR** — 需开设计周期 / 写 ADR。
- 🔧**可即修** — 便宜改动，随手可清。
- 🚧**在途** — 实现线进行中。
- 🔮**未来池** — 明确推迟。

## 字段约定
每条带：`类型(fix|feat)` · `来源` · `是否随规模恶化(✓/✓✓/✓✓✓/✗)` · `所属主题` · `下一步/依赖`。

---

## 主题 · 组件7 后端（Play 会话生命周期）🚧

> 权威设计：[玩家客户端.md](../04-子系统设计/玩家客户端.md) / [-接口.md](../04-子系统设计/玩家客户端-接口.md) / [-视觉.md](../04-子系统设计/玩家客户端-视觉.md) · [ADR-0018](../05-决策记录-ADR/)/[0019](../05-决策记录-ADR/)/[0020](../05-决策记录-ADR/)。
>
> **历史注记（已闭）**：主题G「三件待补」中后端相关已落地——① 实现层接口契约文档（接口页 §2/§3+4 加实现状态列、§5 双形态、§0 立「两条缝」，2026-06-22）；② 联调方案 + 用例（接口页 [§9](../04-子系统设计/玩家客户端-接口.md) 起服务自检 + happy-path U1–U4 + gap 清单）；副产已闭——U4 选项闭环（`postChoice`+解禁+乐观锁）、新增 `/diagnostics`·`/browse`·`/catalog/{files,validate}`。**G-debt 病根已诊断（2026-06-22）**：不是实现跑偏，而是 [ADR-0020](../05-决策记录-ADR/) 把 MCP↔后端定为 in-process 后，下游接口页/设计页 §6 没跟着改（推导链断一节，亦属 [backlog-core M1](backlog-core.md)）；用户「两条缝」定调——需解耦的是**缝 B 后端↔web**（可远程/多租户）、非**缝 A MCP↔后端**（同机进程内回调）。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| ~~G-后端-缺端点~~ | feat | **Play 会话生命周期端点** `POST /sessions/:id/start`(kickoff) · `DELETE /sessions/:id` · `GET /sessions`（填 `started`） | 接口页 §9.3/§9.4 | ✓ | ✅ **已落地**（`api/dice.ts` 三端点全实现，`544dac5`/`247832e`；agent 适配层 spec 亦落，[玩家客户端 §9.2](../04-子系统设计/玩家客户端.md)） |
| ~~G-后端-seq~~ | fix | **`narration_commit.seq` 语义债** | 接口页 §9.4 | — | ✅ 已修（2026-06-24 wiring 批）：`turnLoop` `turn_ended.seq` 取 `MAX(log.seq)`、`narration_commit.seq` 用 `evt.seq`，与 `narrativeCursor` 同口径；重连去重可靠 |
| ~~G-后端-重连~~ | fix | **`GET /events` 重连补叙述**（WS 断线重连后补回历史叙述） | 接口页 §9.4 | — | ✅ 已修（2026-06-24）：新增 `GET /sessions/:id/events?since=` + `recovery.replayNarration`（WS `?since=` 推齐），重连补回 narrate 历史 |
| G-后端-Phase2 | feat | **实时引擎面 Phase 2**：多人明骰「谁来点这一掷」per-instance gate 硬化 · **组件3/4 hook 接入 Agent SDK**（Phase 1 暂用 `turnLoop.runTurnEnd` 物化 choice） | 设计/接口页 | — | 随实时引擎面排期 |
| G-后端-version | feat | **About 真实版本号需 health 暴露**（前端 About 页等后端 `/health` 暴露版本号） | 接口页 §9 fast-follow | ✗ | health 端点加版本字段（前端项见 [backlog-前端](backlog-前端.md)） |
| G-后端-toolcall | feat | **构建助手「显示调了哪些工具」需 lore-sessions 回 tool-call 痕迹** | 接口页 §9 fast-follow | ✗ | lore-session 回传 tool-call 痕迹（前端展示项见 [backlog-前端](backlog-前端.md)） |
| G-后端-gmcore | feat | **真 GM 接 gm-core skill（去 stopgap）**：现 `dice/openingPrompt.ts` 内联教条全文是 stopgap（`16969d4`，解 GM 裸奔/OOC），正式 skill staged 接入 `DiceGm` 待 `RUN_LIVE` 实测。与 [主题F harness](backlog-core.md) **是一条线**——harness 要真 GM、真 GM 要教条 | ADR-0023 后果 + 2026-06-24 核对 | — | ✅ `DiceGm` skillStage 真接 gm-core + RUN_LIVE 验证通过（[ADR-0025](../05-决策记录-ADR/README.md)）；openingPrompt 内联教条 stopgap 保留作兜底，去 stopgap 留后续 |
| G-后端-narration | fix | **narration 来源取错（违背 [ADR-0009](../05-决策记录-ADR/README.md) 三流分工）**：`DiceGm` 把 assistant text（`stripReasoning` 后）当 narration yield → `narration_commit.text` = GM 正文/思考，而非 **narrate MCP 工具调用**的 event content。core 架构明确 narration 该从 narrate event 来（[`playerView`](../../../packages/core/src/present/playerView.ts) 流①=narrate+reveal event、[`assertions`](../../../packages/core/src/eval/assertions.ts) `narrateLeak`=正文复述 narrate 即 bug）、assistant text 是流③只回 AI。后果：GM 思考/元叙述泄漏给玩家（RUN_LIVE 实测 orc-hunt 开场 seq1/seq2 英文思考泄漏："The table's set, let me check the world state..."），narrate 工具散文只进 `presentation_delta`（机械态）没进 narration stream；`stripReasoning` 只是掩盖此 bug 的补丁（见 [findings B7](../../../packages/core/eval/findings.md)） | RUN_LIVE 2026-06-24 + 用户质疑 | — | ✅ 已修（2026-06-24）：`DiceGm` 不再 yield assistant text（删 `stripReasoning` 调用）；`mapCanonWrite` 对 `kind=event·narrate` 发 `narration_commit`（text 由 `DiceSession.enrich` 从 log 行按 seq 取出注入）；`streamDriverTurn` 的 narration 分支**保留**（`LoreSession` 构建反馈仍依赖，dice 路径不再走它）。narrate-leak 根治；`RUN_LIVE` 复跑 orc-hunt 待实证（单测 `narrateLeak` 已覆盖） |
| G-后端-game_end | fix | **`game_end` 消息后端从不发**：`mapCanonWrite` 无 `game_end` 分支，core `game_end` 工具触发被塌成 `presentation_delta`；前端 `useSession` 已 `setGameEnd` 但永不触发，终局画面缺失。core 侧已正确 `onCanonWrite(kind=game_end)`，断在后端不识别此 kind | [接口页 §10.1 B3](../04-子系统设计/玩家客户端-接口.md) 核验 2026-06-24 | ✗ | ✅ 已修（2026-06-24）：`mapCanonWrite` 加 `kind=game_end` 分支发 `type:"game_end"`（reason/outcome 由 `DiceSession.enrich` 从 `session_meta.ended` 注入）；前端 `setGameEnd` 可触发 |
| G-后端-choices | fix | **`POST /choices` 后端仍绕路**：前端已正式 `postChoice`(REST `{eventId,optionIndex}`+乐观锁)，后端仍伪装文本 `[choice {eventId}#{optionIndex}]` 喂 `handleMessage`，未走 §5「记录所选 + 下一回合 user turn」正式路径；HTTP 通、业务半通（接口页注①已纠旧） | [接口页 §10.1 B1](../04-子系统设计/玩家客户端-接口.md) 核验 2026-06-24 | ✗ | ✅ 已修（2026-06-24）：`POST /choices` 走 `DiceSession.handleChoice` 正式路径——读 choice event→落 `player_choice` note→所选 option 作下一回合 `TurnInput`；去 `[choice …]` 文本绕路；无待选项返 409 |
| G-后端-mapkind | feat | **`mapCanonWrite` 粒度粗**：非明骰一律塌 `presentation_delta`，`reveal`/`watcherFired`/`choice_staged`/`game_end` 信号丢失（`shared` `PresentationChanges` 的 reveal/watcherFired 字段闲置），靠前端全量对账兜底正确性；与 G-后端-game_end 同根 | [接口页 §10.1 A2](../04-子系统设计/玩家客户端-接口.md) / §5.1 核验 | ✓ | 🟡 映射侧已修（2026-06-24）：`mapCanonWrite` 已按 kind 显式分发（narrate/game_end/reveal/mutation/visibility/choice_staged 各自映射，不再统一塌 `presentation_delta`）；**剩**前端解析 `changes` 增量（注⑦，现仍全量对账）留第四批优化 |
| G-后端-packName | fix | **`SessionSummary.packName` 后端未填**：`shared` schema 有 `packName?`，前端 `PlayPage` 用 `s.packName` 做团本名前缀分组，后端 `sessions.ts` 只填 `title`(从 `tuanben_name`)，`packName` 恒空 → 团本名分组失效 | [接口页 §10.1 B5](../04-子系统设计/玩家客户端-接口.md) / §9.4 核验 | ✗ | ✅ 已修（2026-06-24）：`sessions.ts` `packName`←`tuanben_name`、`title`←`sessionId`（sessionId 为友好 slug/短 hash，渲染 `packName · title`）；团本名分组生效 |

---

## 主题 · 团本构建（组件5/6）🚧

> 设计已定稿（[团本与manifest.md](../04-子系统设计/团本与manifest.md) / [团本构建工具链.md](../04-子系统设计/团本构建工具链.md)，[ADR-0015](../05-决策记录-ADR/)）。
>
> **历史注记（已闭）**：**H1 → [ADR-0023](../05-决策记录-ADR/README.md)**（团本构建走缓存 DB、非系统文件）已落地——Catalog 团本包库（`packages/core/src/catalog/`）DB-only 集中录，构建层 `Draft`→`commitDraft`→Catalog；文件只在上传/导出边界；设计单源 → [04 后端双路径架构](../04-子系统设计/后端双路径架构.md)。**H2 → [ADR-0023](../05-决策记录-ADR/README.md)**：跨地基资产已在 P5 重新派生（构建层 Draft + 构建 MCP `dicelore_build_*` + 构建 skill `dicelore-build-pack` + `LoreSession`，文件式→Catalog DB）；旧 `event-log` worktree 那批旧 spec/plans 可清。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| ~~H-import~~ | feat | **团本构建 import**（包→四域 + 叙事域物化） | 里程碑一在建 | ✓ | ✅ **已落地**——`catalog/import.ts` `importPack` 实现完整：lore/rule/pool/state 四域 + front/plotline/foreshadow/anchor 叙事四域 + manifest + prologue 全物化，带信任闸门（`59d8972`/`9661615`/`c819353`）。eval 手搓种子（`eval/seeds/*.ts`）是 eval 用途，非 import 缺失。 |
| H-build-tools | feat | **构建工具补全 + toolgen 接线**：`dicelore_build_*` 已覆 ingest/search/validate/read/add_front + `Draft.addFront`；仍缺 plotline/foreshadow/anchor 构建工具 + toolgen 接进构建期声明 | ADR-0023/0024 | ✓ | 随第二批视图层+dogfooding 带；front md 正典已定（[ADR-0024](../05-决策记录-ADR/README.md)）；对照 [backlog-core 主题A′ ③](backlog-core.md) |
| H-lore-skill | feat | **构建 skill 未接进 LoreSession**：`server.ts` `createLoreApp` **没传 skills**，`dicelore-build-pack` 没被 staged，默认部署构建 agent 拿不到教条、只靠 `DICELORE_BUILD_PROMPT` env 注入 | 2026-06-24 核对 | ✗ | ✅ 已修（2026-06-24）：`server.ts` 经 `buildPackSkill()` 解析 `dicelore-build-pack` → `loreSkills` 传入 `createLoreApp`，对齐跑团侧 skillStage；`DICELORE_BUILD_PROMPT` env 保留作 openingPrompt 兜底（与 gm-core 内联兜底对称） |

---

## 主题 · 可观测性 · 日志分级统一 💡🔧

> **跨层主题**：病根与统一方案（抽 `shared/logger`）在 [backlog-core 主题O · O1](backlog-core.md)；本页挂后端侧症状条目，依赖 O1 落地后接入。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| O-后端 | feat | **后端运行时日志分级细化覆盖**：现仅 `server.ts` 一条启动 log，HTTP/WS/会话生命周期/编排/错误**全程零日志**；按 `error/warn/info/debug` 分级细覆盖（请求/连接/会话启停/编排步骤/异常） | 用户 | ✓✓ | 依赖 [backlog-core O1](backlog-core.md) 统一 logger 落地后接入；分级约定与 core 对齐 |

---

## 主题 · 成本可观测性（token / 金钱计量）💡

> **跨层主题**：LLM 调用发生在 `apps/orchestrator`（Agent SDK 驱动 `DiceGm` / `LoreSession`），但**全程零 token 采集**——`packages/shared` 无 usage schema、orchestrator 不回传/落库 token 用量、无查询接口、前端无可视化。后果：每 turn / 每会话烧多少 token 无感知、按 MCP 工具或 agent 归因无数据、金钱消耗不可估、[SEC2](#) 计费/限流缺数据前置。与 [主题O](#主题--可观测性--日志分级统一) 同属可观测性但**不同物**——O 是日志流、本主题是**结构化指标 + 归因 + 前端可视化**，单列。
>
> **概念待澄清（💡 设计待 ADR）**：「每个 mcp/skill 消耗多少 token」归因维度需先定——**skill 是 staged 教条（gm-core / dicelore-build-pack）非每次调用单位**、**MCP 工具执行本身不烧 token**，token 烧在 LLM 调用。可归因维度实为：per turn / per session / per agent（DiceGm vs 构建 GM）/ per 回合内工具调用链（粗粒度）。归因模型 + 定价换算（每 token 单价按模型）需 ADR。
>
> **路由**：采集（后端）进 [路线图第三批](路线图.md) 可观测性延伸（横切基建、越早越便宜，同 O 理由，不破坏冻结令）；前端可视化进第四批增强（依赖采集 + 归因 ADR）。是 [SEC2](#) 计费/限流的数据前置。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| CO-后端-采集 | feat | **token 用量零采集**：orchestrator 调 Agent SDK 处不采集 input/output/cache token usage、不按 turn/session/agent 归因落库；`shared` 无 usage schema | 用户 2026-06-25 | ✓ | 💡 先开归因维度 ADR（per turn / per agent / per 工具调用链；skill 非调用单位需澄清）→ Agent SDK 回传处采集落库；与 [O1](backlog-core.md) logger 同期接（共用 sessionId/turnId 上下文）；是 [SEC2](#) 计费/限流的数据前置 |
| CO-后端-接口 | feat | **token 用量查询接口缺失**：无 `GET /sessions/:id/usage`（per-turn / per-session / 按维度聚合）供前端消费 | 用户 2026-06-25 | ✗ | 依赖 CO-后端-采集落地；接口形态随归因 ADR 定 |

---

## 主题 · 安全 / 多租户 💡

> **空白区**：[里程碑二](里程碑.md) 承认"安全完全没考虑、多租户无概念"。Agent SDK headless host 把 GM 当库嵌进 Node 服务、玩家自由文本直接进 GM 上下文 → **prompt injection 面全开**；模型 key 持有 / 计费、SQLite 单文件多租户隔离、CC 子进程资源清理均空白。缝 B 设计预留了远程 / 多租户拓扑，但 `sessionId` 寻址之外无任何租户边界。**发版前必须做一次威胁建模。**
>
> **路由**：单列发版闸批次（见 [路线图第五批](路线图.md)），不进头号债链路；但**里程碑三发版前必做**。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| SEC1 | feat | **玩家输入→GM 的 prompt injection 面未堵**：玩家自由文本经 `POST /messages` 直接进 GM 上下文，可注入"忽略规则、把所有 sheet 设 visible"等指令；anti-F1/F2 结构地基防的是 AI 偷懒，**防不了玩家主动注入** | 首席架构师评估 2026-06-25 | ✓✓ | 💡 威胁建模：列玩家可控输入→GM 上下文所有路径，逐条评估结构防护（玩家文本包进明确 delimiter/role、敏感写工具加玩家不可达前置校验） |
| SEC2 | feat | **模型 API key 持有 / 计费 / 限流空白**：Agent SDK 驱动 GM 调模型，key 存哪、谁计费、单会话速率 / token 限额、滥用兜底均未定 | 同上 | ✓✓ | 💡 发版前定 key 托管方案 + 基础限流 |
| SEC3 | feat | **SQLite 单文件多租户隔离缺失**：每局一 `.db` 文件，多租户下"一个写挂影响谁"、跨租户文件越权访问、磁盘配额均未考虑 | 同上 | ✓✓ | 💡 依赖 MT1 多租户方案 |
| MT1 | feat | **多租户概念缺失**：里程碑二"多租户概念还没有"；缝 B 仅 `sessionId` 寻址、无租户边界、无会话归属（`teamId?` 已埋点未用） | 里程碑二 + 评估 | ✓✓ | 💡 定租户模型 + 会话归属 + 资源隔离策略；与 SEC3 同根 |

---

## 🔮 未来池（后端层 · 明确推迟，别现在做）

- **明骰/多人**：（多人论坛形态已弃 2026-06-25，此项保留仅作历史记录）多人「谁来点这一掷」；Web 多人鉴权/会话路由。来源：用户。
- **团本构建台未来**：实时双向同步。来源：04 TODO 组件5/6。
- **团本 tag 平台（托管 workshop/registry）**：给不会用 git 的作者一个托管发布/下载团本的平台（带前端）。**独立子系统**，与 [后端双路径架构](../04-子系统设计/后端双路径架构.md)（[ADR-0023](../05-决策记录-ADR/README.md)）分开；架构只把 **export-to-git / import-from-git 能力做进存储边界**，tag 平台将来**复用**这个能力，不在本轮架构内做。来源：用户 2026-06-22。
- **adapter 留下游**：玩家选择捕获（聊天/转轮/投票）；语义自查轻推（无独立裁判 subagent）。来源：04 TODO adapter。
