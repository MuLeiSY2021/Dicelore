# docs/ — Dicelore 文档区

本目录是 Dicelore 的全部文档。各子目录一职责、性质不同（长存权威 vs 临时工件）：

| 子目录 | 职责 | 性质 |
|--------|------|------|
| [`wiki/`](wiki/) | **唯一权威知识库**。分两域：`指南/`（对使用者：玩家/作者/开发者）+ `设计/`（对内推导链：业务→领域→架构→子系统→现状）；顶层 `术语表.md`=全项目词条单源。改代码/文档前先对术语表确认命名。 | 长存·权威 |
| [`research/`](research/) | 调研原料（`scraped/` 真实安价案例语料等），喂构建库/作 eval 对照系。 | 长存·素材 |
| [`audits/`](audits/) | 项目体检报告（`audit-project` skill 的多角色推导链产物）。周期性产出，结论去重后落 wiki backlog。 | 周期·可归档 |
| [`reports/`](reports/) | 临时报告产物。长存的研究/可视化/eval 报告应沉淀进 `wiki/设计/` 对应区（如 dep-graph→设计/03、玩家分型调研→设计/01、eval 报告→设计/05），不留此处。 | 临时 |
| [`superpowers/`](superpowers/) | superpowers 流程的 spec/plan 草稿。用完即沉淀进 wiki 再清。 | 临时·用完即删 |
| [`todo/`](todo/) | 在途交接：本 session 做不完 / 下一 part 的活，指回 backlog 条目。 | 临时·解决即删 |
| [`refactor/`](refactor/) | 大重构的设计提案/施工图（如 wiki IA 重构提案）。落地后退役。 | 临时·用完即删 |
| [`delivery/`](delivery/) | 交付过程记录。 | 临时 |

> **工作流程契约**（怎么干活、文档怎么流转、调哪个 skill）见仓库根 [`CLAUDE.md`](../CLAUDE.md)。本文件只说"docs 各目录装什么"。
