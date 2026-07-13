# spec 沉淀进 wiki（spec-to-wiki 变体）

> **轻量纯文档分支**：把 `docs/superpowers/{specs,plans}` 的临时知识搬进 wiki（永久权威），然后清场。**不走三段式 Workflow、不动代码**——直接按下面流程做。（在三段式交付里，阶段3 收尾的「沉 wiki + 清场」就是这套；单独沉淀草稿时也走它。）

## 流程

1. **读** 目标 spec/plan，识别其中的知识类型并定去向：
   - **决策（为什么这么选）** → `docs/wiki/05-决策记录-ADR/`（追加一条 ADR）。
   - **设计（某层/组件怎么设计）** → `docs/wiki/04-子系统设计/` 对应页。
   - **概念 / 架构** → `docs/wiki/02-领域模型/` · `03-架构/`。
   - **达成的大节点** → 提示用户记入 `docs/dev/plan/milestones.md`（人工维护，AI 不自行改）。
2. **沉淀**：按单向推导（下游只引上游）、单源（一事一处权威）写进 wiki；别在多处复制。
3. **关账**：对应 backlog 条目标 `→ADR-00xx` 或删；删对应 `docs/todo/`。
4. **清草稿（铁律）**：**必须先确认知识已沉淀进 wiki（步骤 2）才能删** superpowers spec/plan——沉淀在前、删除在后。
5. **收尾：提交 + 合并 main（不 push）**：落盘即闭环——开分支提交（`docs(wiki): ...` scoped 前缀）、切 main `git merge --ff-only <分支>`、删分支。**不问用户、不 push**；git 命令一律 `--no-pager`。

## 硬约束
- **多步实现的多份 plan（P1/P2…）只完成一部分时，整套 spec/plan 留着别删**，直到全部落地 + 沉淀 wiki 才统一清场。
- 没沉淀就删 = 丢知识。顺序永远「沉淀 wiki → 才清 superpowers」。
