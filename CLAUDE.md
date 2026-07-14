# CLAUDE.md — Dicelore 工作流程契约

> 本文件**只定"怎么干活与文档怎么流转"**，不解释项目。
> **项目是什么 / 为什么 / 怎么设计** → 全部走 wiki。wiki 分三域：[`wiki/项目介绍/`](wiki/项目介绍/)（所有人：是什么/为什么/服务谁/优势与局限）+ [`wiki/玩家指南/`](wiki/玩家指南/)/[`wiki/作者指南/`](wiki/作者指南/)（任务向：给玩家/作者，不碰代码）+ [`wiki/开发指南/`](wiki/开发指南/)（对内推导链：核心概念→MCP与Skill体系→架构→子系统→现状，给开发者/AI）；另有两个根级文件夹 [`wiki/从SillyTavern迁移/`](wiki/从SillyTavern迁移/)、[`wiki/预制团本说明/`](wiki/预制团本说明/)。
> **每个 session 起手先做两件事**：① 读 [`wiki/术语表.md`](wiki/术语表.md)——全项目术语单源，**改任何代码/文档前先对术语表确认命名是否 canonical**（项目曾因命名不一致误导：团本英文=Adventure、sheet↔state、event↔log 等已统一，写错名 = 制造新漂移、误导后人）；② 看 [`docs/dev/plan/`](docs/dev/plan/) 了解现状与欠账。

---

## 文档分工（各一职责，单源不重复）

| 位置 | 职责 | 性质 |
|------|------|------|
| [`wiki/`](wiki/) | **唯一权威知识库**，三域：`项目介绍/`(所有人) + `玩家指南/`/`作者指南/`(任务向,不碰代码) + `开发指南/`(01-核心概念/02-MCP与Skill体系/03-架构/04-子系统设计,涉代码的都在这)；顶层 `术语表.md`=词条单源；决策内嵌设计页「决策与权衡」节 + `开发指南/决策变更日志.md`(薄索引)（**无独立 ADR 区、历史归档已撤；散落的 `ADR-00xx` 编号只作历史标签，权威以设计页决策节为准**） | 长存·稳定 |
| [`docs/dev/plan/backlog-{frontend,backend,core}.md`](docs/dev/plan/) | **分层问题池**：所有未解决「欠账」按层(前端/后端/core)×类型(fix/feat)归类、去重、聚类成主题 | 长存·直到解决 |
| [`docs/dev/plan/roadmap.md`](docs/dev/plan/roadmap.md) | **有序批次**：从三池挑出来排「先做哪批」(第一批/第二批…)；四态(未裁决→未完成→待测试→已归档)，**「已裁决」必须链 [裁决记录](docs/dev/plan/decisions/) 里经用户批准的裁决文件，没链=未裁决** | **AI 维护**·可重排 |
| [`docs/dev/plan/decisions/`](docs/dev/plan/decisions/) | **「已裁决」需求的零不确定详细设计 + 用户批准勾**（详尽到仅剩代码实现）；全轮交付完在最终收尾阶段统一沉 wiki 并删 | **临时**·交付后删 |
| [`docs/dev/plan/milestones.md`](docs/dev/plan/milestones.md) | **宏大目标/愿景**：每个里程碑拆块、记怎么实现与进度（含未来 ⬜ 项） | 人工维护 · **AI 不得在无人干预下自行改动**；仅在人明确指导/调 `idea-to-roadmap` 抛点子时可追加未来目标块（⬜），不标 ✅、不改写已达成历史 |
| [`docs/dev/delivery/`](docs/dev/delivery/) | **并发交付的运行记录**：一轮一目录（delivery_dag + decisions-pending + 每波冻结 wave_N_nodes.jsonl + wave_N_summary 复盘） | 长存·可回溯 |
| [`docs/dev/tdd/`](docs/dev/tdd/) | 验收测试记录(acceptance-loop 范例轮次) | 长存·范例参照 |
| [`docs/dev/todo/`](docs/dev/todo/) | **在途交接**：本 session 做不完 / 下一 part 的活，指回 backlog 条目 | 临时·解决即删 |
| [`docs/superpowers/{specs,plans}`](docs/superpowers/) | superpowers 流程的草稿产物（spec / plan） | 临时·用完即删 |

---

## 怎么干活：调对应 skill（流程别在这复述）

干活的**流程已固化成 `.claude/skills/` 下的 skill**——闭环步骤、删草稿铁律、验收口径、并行隔离都写在对应 `SKILL.md` 里，**此处不复述，直接看 skill**。起手按下表挑一个调：

| skill | 何时调 |
|-------|--------|
| `idea-to-roadmap` | 任何想法先归里程碑海拔、再一路下沉到三池 + 路线图（点子入账起点） |
| `roadmap-delivery-workflow` | **路线图/里程碑交付与 wiki 维护的统一 skill**——旧 `advance-milestone` / `refactor-frontend` / `refactor-backend` / `fix-wiki-issues` / `organize-wiki` / `spec-to-wiki` 六个已**全部并入**，按需求挑 [`references/`](.claude/skills/roadmap-delivery-workflow/references/) 差异点。调用后主 agent 不手搓派发，而是编写并运行一个 Workflow 脚本跑并发交付。三段式——阶段1(交互)决策账本+不可逆决策攒进**裁决文件**(decisions/，零不确定项)由用户审清打勾批准+**按需求切 DAG**(一需求一节点,不按文件)；工件落 `docs/dev/delivery/<本轮>/`(delivery_dag+decisions-pending+每波冻结 wave_N_nodes.jsonl+wave_N_summary)；**只有「已裁决」(链了经批准裁决文件)的需求能进波**；阶段2(后台 Workflow)对一个就绪波次 pipeline 每节点[worktree 隔离实现跑 a→g→对抗测试→自验]、缺依赖/不可逆决策一律冒泡；阶段3(交互)逐节点检查(typecheck/test 绿+diff+契约)通过才合进本地 main(文件重叠的冲突主 agent 集成时解)+写 wave_N_summary、释放下游起下一波；**沉 wiki+删裁决集中到全 DAG 跑空后的「最终收尾阶段」一次做(不分散到每波)**。合并权独占主 agent，不 push。下层 a→g 闭环作 implement agent 的 prompt 内核；wiki 结构重排 / spec 沉淀走轻量纯文档分支；也可单线单独跑 |

**主线（口诀）**：想法先归里程碑海拔、一路下沉进 backlog 三池 + 路线图（`/idea-to-roadmap`）→ 在途进 `docs/dev/todo/` / 草稿进 `docs/superpowers/` → 推进 / 重构 / 修 wiki / 沉淀**都走 `roadmap-delivery-workflow`**（按需求挑 `references/` 差异点；wiki 结构重排与 spec 沉淀走其轻量纯文档分支，先沉淀 wiki 才清草稿）。commit 先开分支、提交后 ff 合并回 main（不 push；push 由人单独指令）。

> 单源维护：流程契约只在 skill 的 `SKILL.md` 里是权威；改流程改对应 skill，别在本文件另起一套散文。

---

## 几条硬规矩（沿用 wiki [README](wiki/README.md) 的「缜密」三规）

- **单向推导**：wiki 下游页只引用上游页（架构引业务，不反向）。要改上游才回头改下游。
- **单源**：一件事只在一处是权威。问题账只在 `docs/dev/plan/`；**决策内嵌对应设计页的「决策与权衡」节**（不再有独立 ADR 区，历史归档已撤，薄变更日志在 `wiki/开发指南/决策变更日志.md`）；设计只在对应页；术语只在顶层 `术语表.md`。别在多处复制，要么链接、要么沉淀。
- **CLAUDE.md 不解释项目**：任何"它是什么 / 为什么这么设计"的问题，答案在 wiki，不写进这里。
