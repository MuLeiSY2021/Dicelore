# 05-现状与计划

> **本页职责**：全项目级的**进度总览 + 路线图 / backlog** 索引。回答两个问题——「我们走到哪了」（里程碑）、「还欠哪些账、先还哪个」（路线图有序批次 + 三个分层 backlog 池）。
> **与其它页的边界（单源规矩，勿重复）**：
> - 对应设计页「决策与权衡」节 = **已接受**的决策；条目一旦拍了方案就把决策写进对应设计页「决策与权衡」节，该条改标『→ 链对应设计页决策节』关闭。
> - `harness/eval-dicegm/findings.md` = **eval 专项** A/B 账本（措辞/架构缺口）；backlog 池把它**按主题卷上来**，细节仍留 findings.md。
> - 本页只做 **索引 / 状态**，不放权威方案正文。
> **上游依赖**：无（横切全项目）。**状态**：🚧 living（持续追加）。

---

## 怎么用这一节

1. **任何 session / 任何来源**冒出的点子，先由 `idea-to-roadmap` **归到它真正的海拔**——服务/扩张哪个里程碑（宏大目标·愿景）先归里程碑，再**一路下沉**落对应分层池（[前端](backlog-前端.md) / [后端](backlog-后端.md) / [core](backlog-core.md)，带固定字段），不再散落各处。
2. 同一架构病的多个症状在池内归到一个**主题**下——*N 个 ticket 常常是 1 个决策*；去重、聚类。
3. **编排进 [路线图](路线图.md)**：把池里的活排成有序批次（AI 维护、可重排）；**反复出现 / 随规模恶化**的主题最优先 → 开设计周期 + 把决策写进对应设计页「决策与权衡」节。
4. 拍了方案 → 把决策写进对应设计页「决策与权衡」节，对应池条目标『→ 链对应设计页决策节』关闭。
5. 达成节点 → 在 [里程碑](里程碑.md) 标 ✅（**完成态由人在真达成时定，AI 不擅自标**）。未来目标块（⬜）则由人或 `idea-to-roadmap`（受人调用即干预）追加。

| 子页 | 回答什么 | 性质 |
|------|----------|------|
| [里程碑](里程碑.md) | 宏大目标/愿景（未来 ⬜ + 已达成 ✅） | 人工维护 · AI 仅在人干预下追加 ⬜ |
| [路线图](路线图.md) | 还欠哪些账、先还哪个（有序批次） | 未来 · AI 维护·可重排 |
| [backlog-前端](backlog-前端.md) | `frontend/` issue 池（按主题 × fix/feat） | issue 池 · 广度无序 |
| [backlog-后端](backlog-后端.md) | `backend/` issue 池（HTTP/WS·会话生命周期·进程编排） | issue 池 · 广度无序 |
| [backlog-core](backlog-core.md) | core 层 issue 池（引擎/底层：`backend/` store·resolve·present·catalog·build·toolgen·expr·eval + `harness/` 运行时/mcp 工具面 + `packages/*` 纯库） | issue 池 · 广度无序 |

## 当前最高优先级（详见[路线图](路线图.md)）

1. **教条 + eval harness 闭环**（真 GM 接 gm-core skill 去 stopgap + mock 玩家↔真 Claude-GM 自动闭环，而非自导自演）——**meta 解阻塞**：不建它，一切「行为类/措辞类」结论都不可信 → **第一批**。见 [backlog-core 主题F](backlog-core.md) + [backlog-后端 G-后端-gmcore](backlog-后端.md)。
2. **主题A·GM 工具面可见性**（NPC/Front/plotline/foreshadow/张力看板的存储地基已建，但没暴露成 MCP 工具给 GM）——反复出现、随规模恶化 = **头号架构债的真正剩余**，走声明式 dogfooding → **第二批**。见 [backlog-core 主题A / A′](backlog-core.md)。
3. **收尾 fix**（`narration_commit.seq` 语义 / `GET /events` 重连 / 构建 skill 接进 LoreSession）→ **第三批**。见 [backlog-后端](backlog-后端.md)。
