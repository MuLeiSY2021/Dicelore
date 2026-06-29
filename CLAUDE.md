# CLAUDE.md — Dicelore 工作流程契约

> 本文件**只定"怎么干活与文档怎么流转"**，不解释项目。
> **项目是什么 / 为什么 / 怎么设计** → 全部走 wiki：先读 [`docs/wiki/`](docs/wiki/)（业务→概念→架构→决策→里程碑与问题）。每个 session 起手先看 [`06-里程碑与问题`](docs/wiki/06-里程碑与问题/) 了解现状与欠账。

---

## 文档分工（四处，各一职责，单源不重复）

| 位置 | 职责 | 性质 |
|------|------|------|
| [`docs/wiki/`](docs/wiki/) | **唯一权威知识库**：业务(01)/概念(02)/架构(03)/设计(04)/决策ADR(05)/里程碑(06) | 长存·稳定 |
| [`docs/wiki/06-里程碑与问题/backlog-{前端,后端,core}.md`](docs/wiki/06-里程碑与问题/) | **分层问题池**：所有未解决「欠账」按层(前端/后端/core)×类型(fix/feat)归类、去重、聚类成主题 | 长存·直到解决 |
| [`docs/wiki/06-里程碑与问题/路线图.md`](docs/wiki/06-里程碑与问题/路线图.md) | **有序批次**：从三池挑出来排「先做哪批」(第一批/第二批…) | **AI 维护**·可重排 |
| [`docs/wiki/06-里程碑与问题/里程碑.md`](docs/wiki/06-里程碑与问题/里程碑.md) | **宏大目标/愿景**：每个里程碑拆块、记怎么实现与进度（含未来 ⬜ 项） | 人工维护 · **AI 不得在无人干预下自行改动**；仅在人明确指导/调 `idea-to-roadmap` 抛点子时可追加未来目标块（⬜），不标 ✅、不改写已达成历史 |
| [`docs/todo/`](docs/todo/) | **在途交接**：本 session 做不完 / 下一 part 的活，指回 backlog 条目 | 临时·解决即删 |
| [`docs/superpowers/{specs,plans}`](docs/superpowers/) | superpowers 流程的草稿产物（spec / plan） | 临时·用完即删 |

---

## 怎么干活：调对应 skill（流程别在这复述）

干活的**流程已固化成 `.claude/skills/` 下的 skill**——闭环步骤、删草稿铁律、验收口径、并行隔离都写在对应 `SKILL.md` 里，**此处不复述，直接看 skill**。起手按下表挑一个调：

| skill | 何时调 |
|-------|--------|
| `idea-to-roadmap` | 任何想法先归里程碑海拔、再一路下沉到三池 + 路线图（点子入账起点） |
| `advance-milestone` | 推进里程碑 / 路线图下一批 |
| `refactor-frontend` / `refactor-backend` | 整理前端(`apps/web`) / 后端(`apps/orchestrator`)架构 |
| `fix-wiki-issues` | 修 wiki 内容问题（推导链断节 / 单源违例 / 页职责漂移 / 设计-实现漂移） |
| `organize-wiki` | 重排 / 扩张 wiki 结构层级（纯文档） |
| `spec-to-wiki` | superpowers spec/plan 知识沉淀进 wiki + 清草稿 |
| `autonomous-delivery-loop` | 上面 4 个推进 / 重构 skill 共用的 a→g 自主闭环骨架（也可单调） |
| `parallel-roadmap-delivery` | 把一批路线图项**不打扰用户地推到底**：编排者只分析/分解/对答/检查/合并、**永远派 subagent 执行**（能并行就 fan-out、纯串行也串行派 subagent 链）；决策账本 + nodes.jsonl DAG + subagent 自交 PR + 编排者检查合并。每个 subagent 内部跑 `autonomous-delivery-loop` |

**主线（口诀）**：想法先归里程碑海拔、一路下沉进 backlog 三池 + 路线图（`/idea-to-roadmap`）→ 在途进 `docs/todo/` / 草稿进 `docs/superpowers/` → 推进走 `advance-milestone`·`refactor-*` → 完事走 `spec-to-wiki`（先沉淀 wiki 才清草稿）。commit 先开分支、提交后 ff 合并回 main（不 push；push 由人单独指令）。

> 单源维护：流程契约只在 skill 的 `SKILL.md` 里是权威；改流程改对应 skill，别在本文件另起一套散文。

---

## 几条硬规矩（沿用 wiki [README](docs/wiki/README.md) 的「缜密」三规）

- **单向推导**：wiki 下游页只引用上游页（架构引业务，不反向）。要改上游才回头改下游。
- **单源**：一件事只在一处是权威。问题账只在 06；决策只在 ADR；设计只在对应页。别在多处复制，要么链接、要么沉淀。
- **CLAUDE.md 不解释项目**：任何"它是什么 / 为什么这么设计"的问题，答案在 wiki，不写进这里。
