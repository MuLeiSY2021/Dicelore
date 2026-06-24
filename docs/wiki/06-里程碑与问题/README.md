# 06-里程碑与问题

> **本页职责**：全项目级的**进度总览 + 路线图 / backlog** 索引。回答两个问题——「我们走到哪了」（里程碑）、「还欠哪些账、先还哪个」（路线图有序批次 + 三个分层 backlog 池）。
> **与其它页的边界（单源规矩，勿重复）**：
> - 各节 `TODO.md`（如 [03](../03-架构/TODO.md)/[04](../04-子系统设计/TODO.md)）= **节内** 做没做完的流水，本页不抄，只在里程碑里引「某节已定稿」。
> - [05-决策记录 ADR](../05-决策记录-ADR/) = **已接受**的决策；条目一旦拍了方案就写成 ADR，该条改标「→ ADR-00xx」关闭。
> - `packages/core/eval/findings.md` = **eval 专项** A/B 账本（措辞/架构缺口）；backlog 池把它**按主题卷上来**，细节仍留 findings.md。
> - 本页只做 **索引 / 状态**，不放权威方案正文。
> **上游依赖**：无（横切全项目）。**状态**：🚧 living（持续追加）。

---

## 怎么用这一节

1. **任何 session / 任何来源**冒出的点子，先由 `groom-backlog` **归类落对应分层池**（[前端](backlog-前端.md) / [后端](backlog-后端.md) / [core](backlog-core.md)，带固定字段），不再散落各处。
2. 同一架构病的多个症状在池内归到一个**主题**下——*N 个 ticket 常常是 1 个决策*；去重、聚类。
3. **编排进 [路线图](路线图.md)**：把池里的活排成有序批次（AI 维护、可重排）；**反复出现 / 随规模恶化**的主题最优先 → 开 ADR + 设计周期。
4. 拍了方案 → 写 ADR，对应池条目标 `→ ADR-00xx` 关闭。
5. 达成节点 → 进 [里程碑](里程碑.md)（**人工维护，AI 不动**）。

| 子页 | 回答什么 | 性质 |
|------|----------|------|
| [里程碑](里程碑.md) | 项目走到哪了（已达成的大节点时间线） | 过去 · 人工维护 |
| [路线图](路线图.md) | 还欠哪些账、先还哪个（有序批次） | 未来 · AI 维护·可重排 |
| [backlog-前端](backlog-前端.md) | `apps/web` issue 池（按主题 × fix/feat） | issue 池 · 广度无序 |
| [backlog-后端](backlog-后端.md) | `apps/orchestrator` issue 池 | issue 池 · 广度无序 |
| [backlog-core](backlog-core.md) | `packages/core`(+`shared`) issue 池 | issue 池 · 广度无序 |

## 当前最高优先级（详见[路线图](路线图.md)）

1. **教条 + eval harness 闭环**（真 GM 接 gm-core skill 去 stopgap + mock 玩家↔真 Claude-GM 自动闭环，而非自导自演）——**meta 解阻塞**：不建它，一切「行为类/措辞类」结论都不可信 → **第一批**。见 [backlog-core 主题F](backlog-core.md) + [backlog-后端 G-后端-gmcore](backlog-后端.md)。
2. **主题A·GM 工具面可见性**（NPC/Front/plotline/foreshadow/张力看板的存储地基已建，但没暴露成 MCP 工具给 GM）——反复出现、随规模恶化 = **头号架构债的真正剩余**，走声明式 dogfooding → **第二批**。见 [backlog-core 主题A / A′](backlog-core.md)。
3. **收尾 fix**（`narration_commit.seq` 语义 / `GET /events` 重连 / 构建 skill 接进 LoreSession）→ **第三批**。见 [backlog-后端](backlog-后端.md)。
