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
| G-后端-seq | fix | **`narration_commit.seq` 语义债** | 接口页 §9.4 | — | 随会话生命周期 spec 一并理清 |
| G-后端-重连 | fix | **`GET /events` 重连补叙述**（WS 断线重连后补回历史叙述） | 接口页 §9.4 | — | 同上 |
| G-后端-Phase2 | feat | **实时引擎面 Phase 2**：多人明骰「谁来点这一掷」per-instance gate 硬化 · **组件3/4 hook 接入 Agent SDK**（Phase 1 暂用 `turnLoop.runTurnEnd` 物化 choice） | 设计/接口页 | — | 随实时引擎面排期 |
| G-后端-version | feat | **About 真实版本号需 health 暴露**（前端 About 页等后端 `/health` 暴露版本号） | 接口页 §9 fast-follow | ✗ | health 端点加版本字段（前端项见 [backlog-前端](backlog-前端.md)） |
| G-后端-toolcall | feat | **构建助手「显示调了哪些工具」需 lore-sessions 回 tool-call 痕迹** | 接口页 §9 fast-follow | ✗ | lore-session 回传 tool-call 痕迹（前端展示项见 [backlog-前端](backlog-前端.md)） |
| G-后端-gmcore | feat | **真 GM 接 gm-core skill（去 stopgap）**：现 `dice/openingPrompt.ts` 内联教条全文是 stopgap（`16969d4`，解 GM 裸奔/OOC），正式 skill staged 接入 `DiceGm` 待 `RUN_LIVE` 实测。与 [主题F harness](backlog-core.md) **是一条线**——harness 要真 GM、真 GM 要教条 | ADR-0023 后果 + 2026-06-24 核对 | — | ✅ `DiceGm` skillStage 真接 gm-core + RUN_LIVE 验证通过（[ADR-0025](../05-决策记录-ADR/README.md)）；openingPrompt 内联教条 stopgap 保留作兜底，去 stopgap 留后续 |

---

## 主题 · 团本构建（组件5/6）🚧

> 设计已定稿（[团本与manifest.md](../04-子系统设计/团本与manifest.md) / [团本构建工具链.md](../04-子系统设计/团本构建工具链.md)，[ADR-0015](../05-决策记录-ADR/)）。
>
> **历史注记（已闭）**：**H1 → [ADR-0023](../05-决策记录-ADR/README.md)**（团本构建走缓存 DB、非系统文件）已落地——Catalog 团本包库（`packages/core/src/catalog/`）DB-only 集中录，构建层 `Draft`→`commitDraft`→Catalog；文件只在上传/导出边界；设计单源 → [04 后端双路径架构](../04-子系统设计/后端双路径架构.md)。**H2 → [ADR-0023](../05-决策记录-ADR/README.md)**：跨地基资产已在 P5 重新派生（构建层 Draft + 构建 MCP `dicelore_build_*` + 构建 skill `dicelore-build-pack` + `LoreSession`，文件式→Catalog DB）；旧 `event-log` worktree 那批旧 spec/plans 可清。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| ~~H-import~~ | feat | **团本构建 import**（包→四域 + 叙事域物化） | 里程碑一在建 | ✓ | ✅ **已落地**——`catalog/import.ts` `importPack` 实现完整：lore/rule/pool/state 四域 + front/plotline/foreshadow/anchor 叙事四域 + manifest + prologue 全物化，带信任闸门（`59d8972`/`9661615`/`c819353`）。eval 手搓种子（`eval/seeds/*.ts`）是 eval 用途，非 import 缺失。 |
| H-build-tools | feat | **构建工具补全 + toolgen 接线**：`dicelore_build_*` 已覆 ingest/search/validate/read/add_front + `Draft.addFront`；仍缺 plotline/foreshadow/anchor 构建工具 + toolgen 接进构建期声明 | ADR-0023/0024 | ✓ | 随第二批视图层+dogfooding 带；front md 正典已定（[ADR-0024](../05-决策记录-ADR/README.md)）；对照 [backlog-core 主题A′ ③](backlog-core.md) |
| H-lore-skill | feat | **构建 skill 未接进 LoreSession**：`server.ts` `createLoreApp` **没传 skills**，`dicelore-build-pack` 没被 staged，默认部署构建 agent 拿不到教条、只靠 `DICELORE_BUILD_PROMPT` env 注入 | 2026-06-24 核对 | ✗ | `createLoreApp` 接 skills 参数（对齐跑团侧 `DiceGm` 的 skillStage） |

---

## 主题 · 可观测性 · 日志分级统一 💡🔧

> **跨层主题**：病根与统一方案（抽 `shared/logger`）在 [backlog-core 主题O · O1](backlog-core.md)；本页挂后端侧症状条目，依赖 O1 落地后接入。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| O-后端 | feat | **后端运行时日志分级细化覆盖**：现仅 `server.ts` 一条启动 log，HTTP/WS/会话生命周期/编排/错误**全程零日志**；按 `error/warn/info/debug` 分级细覆盖（请求/连接/会话启停/编排步骤/异常） | 用户 | ✓✓ | 依赖 [backlog-core O1](backlog-core.md) 统一 logger 落地后接入；分级约定与 core 对齐 |

---

## 🔮 未来池（后端层 · 明确推迟，别现在做）

- **明骰/多人**：多人安价「谁来点这一掷」；Web 多人鉴权/会话路由。来源：用户。
- **团本构建台未来**：实时双向同步。来源：04 TODO 组件5/6。
- **团本 tag 平台（托管 workshop/registry）**：给不会用 git 的作者一个托管发布/下载团本的平台（带前端）。**独立子系统**，与 [后端双路径架构](../04-子系统设计/后端双路径架构.md)（[ADR-0023](../05-决策记录-ADR/README.md)）分开；架构只把 **export-to-git / import-from-git 能力做进存储边界**，tag 平台将来**复用**这个能力，不在本轮架构内做。来源：用户 2026-06-22。
- **adapter 留下游**：玩家选择捕获（聊天/转轮/投票）；语义自查轻推（无独立裁判 subagent）。来源：04 TODO adapter。
