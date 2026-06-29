---
name: groom-backlog
description: 点子落盘 / 归类点子 / 落 backlog / 排路线图 / 这些点子归类一下。把用户抛来的一堆散点子逐条归类进 Dicelore 的分层 backlog 池(前端/后端/core × fix/feat),去重聚类,并编排进 AI 维护的路线图批次。轻量,只动 06。
---

# 点子归类 + 路线图编排（groom-backlog）

把散乱点子归位成结构化 backlog，并排出「先做哪批」。轻量、不发 subagent、不动代码。

## 输入
用户抛来的一堆散点子（可能混杂前端/后端/core、fix/feat、大小不一）。

## 流程

1. **逐条判定** `{层: 前端|后端|core, 类型: fix|feat}`
   - 前端 = `apps/web`（组件/渲染/路由/i18n/视觉）
   - 后端 = `apps/orchestrator`（HTTP·WS 接口/会话生命周期/编排）
   - core = `packages/core`(+`shared`)（引擎/数据层/MCP/gm-core/团本构建/eval）
2. **落对应池** `docs/wiki/06-里程碑与问题/backlog-<层>.md`
   - 补全字段：`类型(fix|feat)·来源·是否随规模恶化·所属主题·下一步/依赖`。
   - **去重聚类**：同一架构病的多个症状归到一个**主题**下（N 个 ticket 常是 1 个决策）；与既有条目比对，别重开。
3. **编排路线图** `docs/wiki/06-里程碑与问题/路线图.md`
   - 视优先级把条目编进/重排批次：**反复出现 + 随规模恶化 = 最高优先级**，进靠前批次。
   - 每批列「修哪些 fix / 提哪些 feat」，链接回三池条目。
4. **收尾：提交 + 合并 main（不 push）**
   落盘即闭环——开分支提交（`git checkout -b docs/backlog-<主题>`，message 用 `docs(backlog): ...` scoped 前缀），切回 main `git merge --ff-only <分支>`、删分支。**不向用户问"要提交吗"**，也**不 push**（push 由用户单独指令）。git 命令一律 `--no-pager`。

## 硬约束
- `路线图.md` 由 **AI 维护、可重排**；`里程碑.md` 人工维护、**AI 不动**（那是过去已达成时间线）。
- 只做归类/聚类/排序/编批，不直接动手实现——实现走 `advance-milestone` / `refactor-*`。
- **落盘即提交合并 main**：不停下来问用户；不 push。
- git 命令一律 `--no-pager`（否则 less 卡死 Bash 会话）。
