---
name: autonomous-delivery-loop
description: Dicelore 专属自主交付闭环。当要「自己推进、不提问」地把一批目标做完时用——无论是推进里程碑、修问题、还是重构某层。流程:现状↔目标差距分析→落 06 backlog→规划 DAG→调 superpowers 落 spec/plan(不提问)→从 main 切 worktree 发 subagent 批量实现→另起 subagent 从业务角度设计测试→验收(失败回炉、通过则沉淀 wiki+三处清场+合回 main)。这是 advance-milestone / fix-wiki-issues / refactor-frontend / refactor-backend 四个叶 skill 共用的骨架,也可单独调用。
---

# 自主交付闭环（autonomous-delivery-loop）

把 CLAUDE.md「执行模型」+「问题生命周期」固化成一条**默认不提问、自己推进到底**的闭环。叶 skill 引用本骨架、只覆盖差异点（问题从哪来 / 扫描范围 / 关注点 / 验收口径）。

## 何时用

- 接到「自己推进、不要提问，做完落 spec」类指令。
- 要把一批已锚定的目标（路线图某批 / 某层 backlog / 一组 wiki 问题）成体系地交付。
- 需要设计 + 多步实现 + 并发 subagent。

> **要把一批路线图项「不打扰用户地」推到底** → 上层用 [parallel-roadmap-delivery](../parallel-roadmap-delivery/SKILL.md)：它**永远派 subagent 执行**（能并行就 fan-out、纯串行就串行派一条 subagent 链，编排者自己不下场），**每个 subagent 在自己那条线里跑本 skill 的 a→g**。本 skill 是「一条线内部怎么干」的权威；编排者怎么分解/派发/检查/合并多条线、卡点怎么不打扰用户，在那个上层 skill。

> **纯机械改动例外**：若只是批量改名等无新行为的活，按 `[机械改名用正则]` 经验，跳过 heavy SDD，直接正则替换 + 测试兜底。

## 流程（a→g）

**默认全程不向用户提问**；遇歧义自行按 wiki + 代码现状决断（叶 skill 可声明覆盖此默认）。**卡住 / 困惑 / 拿不准时，不要憋着也不要回头问用户——去搜索**：调 `web-research-routing` skill（中文走博查、英文/日文走 jina、都不行回落 tavily）查文档/正典/同类实现，自己把疑问解掉再继续。

1. **① 现状↔目标差距分析**
   读相关 wiki（**必读 [06-里程碑与问题](../../../docs/wiki/06-里程碑与问题/)**：路线图 + 三池）+ 对应层代码，列出 gap 清单。

2. **② 落 06 backlog**
   把 gap 写进对应 `backlog-<层>.md` 池，带字段 `类型(fix|feat)·来源·是否随规模恶化·主题·下一步`；必要时编进 `路线图.md` 当前批。**反复出现 + 随规模恶化 = 最高优先级**。

3. **③ 规划 DAG**
   分析涉及哪些包（前端 `apps/web` / 后端 `apps/orchestrator` / core `packages/core`+`shared`），把任务拆成依赖图，标出可并发的波次。

4. **④ 调 superpowers 落 spec/plan（不提问，显式覆盖 brainstorming 的 gate）**
   需设计 → `superpowers:brainstorming`（**自问自答，不向用户提问**）落 spec；→ `superpowers:writing-plans` 落 plan 到 `docs/superpowers/plans/`。
   - **显式覆盖 brainstorming 的两个 gate**：brainstorming 自带「present design 求用户批准」与「user review spec」两个 gate——**本闭环全部覆盖、不执行**。设计方向已在 wiki（路线图批次 + backlog 条目 + ADR），自问自答决断后**直接 Write spec 并 commit**：不向用户呈现设计问「方向是否对 / 有无异议」、不停下等 spec review。spec self-review（自己查 placeholder / 内部一致性 / 范围 / 歧义，自己修）后**直接转 `writing-plans`**。
   - **为何**：本闭环的「默认不提问」是叶 skill 对 brainstorming gate 的显式覆盖；遇 brainstorming 的 HARD-GATE 以此为准，不回头问用户。用户要纠偏自会打断，不必主动设 gate。

5. **⑤ 切 worktree + 发 subagent**
   从 main 切 worktree（`superpowers:using-git-worktrees`，**每条并行线各一个 worktree**）；按 DAG 波次派 subagent（`superpowers:subagent-driven-development` / `superpowers:dispatching-parallel-agents`）批量实现。

6. **⑥ 回收 + 从业务角度设计测试**
   subagent 回收后，**另起 subagent 专门按这批 feat 的业务语义设计测试方案**（不是只跑现有测试，而是补出业务级用例）。

7. **⑦ 验收**
   `npm test` + `npm run typecheck`；web 改动**必须**走 `/webapp-testing`（example-skills:webapp-testing）。
   - **有问题 → 回 ②**（gap 重新入账，再来一轮）。
   - **通过 → 收尾**：
     1. 沉淀 wiki（决策→`05-决策记录-ADR` / 设计→`04-子系统设计` / 概念·架构→`02`·`03`；达成节点由人工进 `里程碑.md`）。
     2. 三处清场：关 backlog 条目（标 `→ADR-00xx` 或删）/ 路线图勾掉该批；删对应 `docs/todo/`；**确认知识已沉淀 wiki 后**才删 superpowers spec/plan。
     3. 合回 main：worktree 分支已提交则切 main `git merge --ff-only <分支>`（或 `--no-ff` 保留批次语义）、删分支；**不 push**（push 由用户单独指令）。

## 硬约束

- **并行隔离**：多条并行线各自 worktree，别挤主工作目录；提交用 scoped `git add <精确路径>`，别 `-A`（教训：`[worktree npm lock 坑]`）。
- **删 superpowers 草稿铁律**：先沉淀 wiki 才删；多份 plan 半途**整套留着**不删，全套落地 + 沉淀后统一清。
- **git 命令一律 `--no-pager`**（否则 less 卡死 Bash 会话）。
- **不 push**：合并到本地 main 即闭环终点；push 由用户单独指令（并发多 session 时远端 push 易撞车）。
- **声明完成前自验证**：`superpowers:verification-before-completion`——跑命令、看输出，证据在前、断言在后。
- **卡住就搜索、别问用户**：不提问 ≠ 卡死。解不开 / 困惑时调 `web-research-routing` skill 查（博查/jina/tavily），把疑问解掉再走，而不是回头问用户。
- **单源 / 单向推导**：沉淀时下游页只引上游页；一件事只在一处权威。
