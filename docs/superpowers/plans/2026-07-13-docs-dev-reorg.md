# docs/dev 目录整理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `docs/delivery/05-现状与计划/`(用户已手动 mv 到此、未 commit)迁到新家 `docs/dev/plan/`(内部文件改英文名),`docs/delivery/` 收窄改名 `docs/dev/delivery/`,`docs/tdd/`、`docs/todo/`、`docs/reports/` 一并归拢进 `docs/dev/` 下平级,并把全仓所有引用这些旧路径/旧文件名的地方(skill 文件、顶层文档、生产代码注释)同步改掉。

**Architecture:** 纯文件系统重排 + 文本引用同步,不涉及任何运行时逻辑改动。先做物理搬迁(`mv`/`git mv`),再做引用文本修订,最后全仓验证无残留旧路径。

**Tech Stack:** Bash(`mv`/`git mv`)、Edit 工具做精确文本替换。

## Global Constraints

- 历史交付轮次目录(`2026-06-30-路线图-推进`、`2026-07-02-transcript-datadir-buildeval`、`2026-07-02-路线图-推进`、`2026-07-10-路线图-推进`)内部**任何文件内容一律不改**,只整体随父目录搬迁位置(spec §5:历史快照,不追溯改)。
- `milestones.md`(原 里程碑.md)正文**不得改动**——人工维护铁律,本轮只搬文件、改文件名,不动内容。
- 所有替换只处理**文件路径引用/文件名 token**,不改写使用"里程碑""路线图""裁决记录"作为**普通中文词汇/概念名**的prose(例如"达成的里程碑""裁决记录的零不确定设计"这类不带路径的自然语言提法保持不变)——只有明确指向文件/目录的 token(带 `.md` 后缀,或带 `/` 结尾的目录引用)才改成英文。
- git 命令一律加 `--no-pager`。
- 本计划涉及的编辑**只处理 docs/dev 相关的路径/文件名**;文件里同时存在的 `docs/wiki` 路径引用留给姊妹计划(wiki 重构)处理,不在本计划动它们。
- 不 push;完成后合并到本地 main 即止。

---

### Task 1: 迁移 05-现状与计划 → `docs/dev/plan/`(内部文件改英文名)

**Files:**
- Create: `docs/dev/plan/README.md`、`docs/dev/plan/milestones.md`、`docs/dev/plan/roadmap.md`、`docs/dev/plan/backlog-frontend.md`、`docs/dev/plan/backlog-backend.md`、`docs/dev/plan/backlog-core.md`、`docs/dev/plan/decisions/*`、`docs/dev/plan/eval-reports/*`
- Delete(via move): `docs/delivery/05-现状与计划/` 整个子树

**Interfaces:**
- Produces: `docs/dev/plan/{README.md,milestones.md,roadmap.md,backlog-frontend.md,backlog-backend.md,backlog-core.md}`、`docs/dev/plan/decisions/{README.md,custom-mcp-install.md,dicegm-skill-corpus-distill.md,gm-session-continuity.md,usage-and-context.md}`、`docs/dev/plan/eval-reports/README.md` —— 后续所有任务的文本编辑都引用这些新路径。

- [ ] **Step 1: 确认当前源目录内容,建目标目录**

Run:
```bash
find docs/delivery/05-现状与计划 -type f | sort
mkdir -p docs/dev/plan/decisions docs/dev/plan/eval-reports
```
Expected: 列出 `README.md`、`backlog-core.md`、`backlog-前端.md`、`backlog-后端.md`、`路线图.md`、`里程碑.md`、`裁决记录/{README.md,custom-mcp-install.md,dicegm-skill-corpus-distill.md,gm-session-continuity.md,usage-and-context.md}`、`eval报告/README.md` 共 12 个文件;`mkdir` 无输出(成功)。

- [ ] **Step 2: 逐文件搬迁 + 改名**

Run:
```bash
mv docs/delivery/05-现状与计划/README.md docs/dev/plan/README.md
mv docs/delivery/05-现状与计划/里程碑.md docs/dev/plan/milestones.md
mv docs/delivery/05-现状与计划/路线图.md docs/dev/plan/roadmap.md
mv docs/delivery/05-现状与计划/backlog-前端.md docs/dev/plan/backlog-frontend.md
mv docs/delivery/05-现状与计划/backlog-后端.md docs/dev/plan/backlog-backend.md
mv docs/delivery/05-现状与计划/backlog-core.md docs/dev/plan/backlog-core.md
mv docs/delivery/05-现状与计划/裁决记录/README.md docs/dev/plan/decisions/README.md
mv docs/delivery/05-现状与计划/裁决记录/custom-mcp-install.md docs/dev/plan/decisions/custom-mcp-install.md
mv docs/delivery/05-现状与计划/裁决记录/dicegm-skill-corpus-distill.md docs/dev/plan/decisions/dicegm-skill-corpus-distill.md
mv docs/delivery/05-现状与计划/裁决记录/gm-session-continuity.md docs/dev/plan/decisions/gm-session-continuity.md
mv docs/delivery/05-现状与计划/裁决记录/usage-and-context.md docs/dev/plan/decisions/usage-and-context.md
mv docs/delivery/05-现状与计划/eval报告/README.md docs/dev/plan/eval-reports/README.md
rmdir docs/delivery/05-现状与计划/裁决记录 docs/delivery/05-现状与计划/eval报告 docs/delivery/05-现状与计划
```
Expected: 所有 `mv`/`rmdir` 无输出(成功);若 `rmdir` 报 "Directory not empty" 说明漏搬文件,回头用 `find docs/delivery/05-现状与计划` 排查。

- [ ] **Step 3: 验证搬迁完整**

Run:
```bash
find docs/delivery -maxdepth 1 -type d
find docs/dev/plan -type f | sort
```
Expected: 第一条不再列出 `05-现状与计划`(只剩历史轮次目录 + `README.md`);第二条列出 12 个新路径文件,与 Step 1 数量一致。

---

### Task 2: `docs/delivery/` 剩余内容(历史轮次 + README)搬迁改名为 `docs/dev/delivery/`

**Files:**
- Modify(rename via `git mv`): `docs/delivery/` → `docs/dev/delivery/`(26 个已 tracked 文件,保留 git 历史)

**Interfaces:**
- Consumes: Task 1 完成后 `docs/delivery/` 只剩历史轮次目录 + `README.md`(无 `05-现状与计划` 残留)
- Produces: `docs/dev/delivery/README.md` + 4 个历史轮次目录,内容与 git 历史均保持原样

- [ ] **Step 1: 确认 `docs/delivery/` 现存 tracked 文件**

Run:
```bash
git ls-files docs/delivery | wc -l
```
Expected: `26`

- [ ] **Step 2: git mv 整个目录**

Run:
```bash
mkdir -p docs/dev
git mv docs/delivery docs/dev/delivery
```
Expected: 无报错;`git mv` 对已 tracked 的目录整体生效。

- [ ] **Step 3: 验证 rename 被 git 正确识别、历史轮次文件内容零改动**

Run:
```bash
git status --porcelain docs/dev/delivery docs/delivery | head -5
git diff --cached --stat docs/dev/delivery/2026-06-30-路线图-推进/ 2>/dev/null | tail -3
```
Expected: `git status` 只显示 `docs/dev/delivery/` 下的 `R` (renamed)条目,不显示 `docs/delivery/`(已不存在);`git diff --cached` 对历史轮次目录应为空输出或只显示 rename、无内容 diff(因为内容未改)。

---

### Task 3: `docs/tdd/`、`docs/todo/`、`docs/reports/` 搬迁进 `docs/dev/`(原样,不改名)

**Files:**
- Modify(rename via `git mv`): `docs/tdd/` → `docs/dev/tdd/`(44 个 tracked 文件)、`docs/reports/` → `docs/dev/reports/`(1 个 tracked 文件)
- Modify(plain `mv` + `git add`,因为未 tracked): `docs/todo/` → `docs/dev/todo/`(1 个文件)

**Interfaces:**
- Produces: `docs/dev/tdd/acceptance-loop-2026-07-06/...`、`docs/dev/todo/flows断链排查.md`、`docs/dev/reports/README.md`

- [ ] **Step 1: 搬 tdd 与 reports(已 tracked,用 git mv 保留历史)**

Run:
```bash
git mv docs/tdd docs/dev/tdd
git mv docs/reports docs/dev/reports
```
Expected: 无报错。

- [ ] **Step 2: 搬 todo(未 tracked,plain mv)**

Run:
```bash
mv docs/todo docs/dev/todo
git add docs/dev/todo
```
Expected: `mv` 无输出;`git add` 后 `git status --porcelain docs/dev/todo` 显示 `A` (added,因为原本就是未 tracked 的新文件)。

- [ ] **Step 3: 验证四个子目录都在 `docs/dev/` 下且原 `docs/` 顶层不再有这四个旧目录**

Run:
```bash
find docs -maxdepth 1 -type d | sort
find docs/dev -maxdepth 1 -type d | sort
```
Expected: 第一条只剩 `docs/dev`、`docs/research`、`docs/superpowers`、`docs/wiki-old`(wiki-old 由姊妹计划处理,不在本计划范围);第二条列出 `docs/dev/delivery`、`docs/dev/plan`、`docs/dev/reports`、`docs/dev/tdd`、`docs/dev/todo` 共 5 个。

---

### Task 4: 修订 `docs/dev/delivery/README.md`(移除死概念 ADR + 补充 dev/ 兄弟目录说明)

**Files:**
- Modify: `docs/dev/delivery/README.md`

- [ ] **Step 1: 修正"和 wiki 的分工"段的 ADR 死概念**

当前文件末尾一段(搬迁后路径为 `docs/dev/delivery/README.md`):

```markdown
## 和 wiki 的分工

`wave_N_summary.md` 记**本轮交付的过程**（当时怎么权衡的、subagent 撞了啥）；wiki 记**项目的权威结论**（去过程化、决策最终是什么）。决策的「当时怎么权衡」进 summary，决策的「最终是什么」进 ADR/wiki。
```

用 Edit 工具替换:

old_string:
```
`wave_N_summary.md` 记**本轮交付的过程**（当时怎么权衡的、subagent 撞了啥）；wiki 记**项目的权威结论**（去过程化、决策最终是什么）。决策的「当时怎么权衡」进 summary，决策的「最终是什么」进 ADR/wiki。
```

new_string:
```
`wave_N_summary.md` 记**本轮交付的过程**（当时怎么权衡的、subagent 撞了啥）；wiki 记**项目的权威结论**（去过程化、决策最终是什么）。决策的「当时怎么权衡」进 summary，决策的「最终是什么」进 wiki(对应设计页「决策与权衡」节)。

## 和 `docs/dev/` 其他兄弟目录的分工

`docs/dev/` 下 `delivery/` 只管**交付批次运行记录本身**(一轮一目录、跑完即成历史,见上文);现状追踪(`plan/`，长存)、验收测试记录(`tdd/`)、在途交接(`todo/`)、eval 原始报告(`reports/`)是平级的兄弟目录，各自独立生命周期，不要把"delivery"泛化成整个 `docs/dev/` 的代称。
```

- [ ] **Step 2: 验证**

Run:
```bash
grep -n "ADR" docs/dev/delivery/README.md
```
Expected: 无输出(该文件已不再提及 ADR)。

- [ ] **Step 3: Commit**

```bash
git add docs/dev/delivery/README.md
git commit -m "docs(dev): 修 delivery/README 里的 ADR 死链接概念 + 补 dev/ 兄弟目录说明"
```

---

### Task 5: 修订 `docs/dev/plan/README.md`(去掉"05"/编号自称 + 内部相对链接改英文名)

**Files:**
- Modify: `docs/dev/plan/README.md`

- [ ] **Step 1: 整篇替换(标题去编号 + 全部相对链接改英文文件名,wiki 侧的"04 / 02"编号提法不动,留给姊妹计划)**

old_string(当前完整内容,即 Task 1 搬迁后原样落在 `docs/dev/plan/README.md` 的全文):
```
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
3. **编排进 [路线图](路线图.md)**：把池里的活排成有序批次（AI 维护、可重排）；**反复出现 / 随规模恶化**的主题最优先。
4. **裁决**（想法→可交付的闸）：要交付某需求前，给它写一份 [裁决记录](裁决记录/) 里的**裁决文件**——详尽到「没有任何不确定项、仅剩代码实现」的设计 + 顶部用户批准勾。**路线图标「已裁决」必须链到它；没链接 / 用户没勾 = 视为未裁决**（见 [裁决记录 README](裁决记录/README.md)）。
5. 需求完成/归档 → 把最终设计结论沉淀进对应设计页（04 / 02 / 「决策与权衡」节）+ **删裁决文件** + 在 [里程碑](里程碑.md) 标 ✅（**完成态由人在真达成时定，AI 不擅自标**）。未来目标块（⬜）由人或 `idea-to-roadmap`（受人调用即干预）追加。

| 子页 | 回答什么 | 性质 |
|------|----------|------|
| [里程碑](里程碑.md) | 宏大目标/愿景（未来 ⬜ + 已达成 ✅） | 人工维护 · AI 仅在人干预下追加 ⬜ |
| [路线图](路线图.md) | 还欠哪些账、先还哪个（有序批次） | 未来 · AI 维护·可重排 |
| [裁决记录](裁决记录/) | 「已裁决」需求的零不确定详细设计 + 用户批准勾 | **临时**·交付后沉 wiki 并删 |
| [backlog-前端](backlog-前端.md) | `frontend/` issue 池（按主题 × fix/feat） | issue 池 · 广度无序 |
| [backlog-后端](backlog-后端.md) | `backend/` issue 池（HTTP/WS·会话生命周期·进程编排） | issue 池 · 广度无序 |
| [backlog-core](backlog-core.md) | core 层 issue 池（引擎/底层：`backend/` store·resolve·present·catalog·build·toolgen·expr·eval + `harness/` 运行时/mcp 工具面 + `packages/*` 纯库） | issue 池 · 广度无序 |

## 当前最高优先级（详见[路线图](路线图.md)）

1. **教条 + eval harness 闭环**（真 GM 接 gm-core skill 去 stopgap + mock 玩家↔真 Claude-GM 自动闭环，而非自导自演）——**meta 解阻塞**：不建它，一切「行为类/措辞类」结论都不可信 → **第一批**。见 [backlog-core 主题F](backlog-core.md) + [backlog-后端 G-后端-gmcore](backlog-后端.md)。
2. **主题A·GM 工具面可见性**（NPC/Front/plotline/foreshadow/张力看板的存储地基已建，但没暴露成 MCP 工具给 GM）——反复出现、随规模恶化 = **头号架构债的真正剩余**，走声明式 dogfooding → **第二批**。见 [backlog-core 主题A / A′](backlog-core.md)。
3. **收尾 fix**（`narration_commit.seq` 语义 / `GET /events` 重连 / 构建 skill 接进 LoreSession）→ **第三批**。见 [backlog-后端](backlog-后端.md)。
```

new_string:
```
# 现状与计划

> **本页职责**：全项目级的**进度总览 + 路线图 / backlog** 索引。回答两个问题——「我们走到哪了」（里程碑）、「还欠哪些账、先还哪个」（路线图有序批次 + 三个分层 backlog 池）。
> **与其它页的边界（单源规矩，勿重复）**：
> - 对应设计页「决策与权衡」节 = **已接受**的决策；条目一旦拍了方案就把决策写进对应设计页「决策与权衡」节，该条改标『→ 链对应设计页决策节』关闭。
> - `harness/eval-dicegm/findings.md` = **eval 专项** A/B 账本（措辞/架构缺口）；backlog 池把它**按主题卷上来**，细节仍留 findings.md。
> - 本页只做 **索引 / 状态**，不放权威方案正文。
> **位置**：`docs/dev/plan/`（原"05-现状与计划"，已整体迁出 wiki、长存于此，不再挂 wiki 推导链编号）。**状态**：🚧 living（持续追加）。

---

## 怎么用这一节

1. **任何 session / 任何来源**冒出的点子，先由 `idea-to-roadmap` **归到它真正的海拔**——服务/扩张哪个里程碑（宏大目标·愿景）先归里程碑，再**一路下沉**落对应分层池（[前端](backlog-frontend.md) / [后端](backlog-backend.md) / [core](backlog-core.md)，带固定字段），不再散落各处。
2. 同一架构病的多个症状在池内归到一个**主题**下——*N 个 ticket 常常是 1 个决策*；去重、聚类。
3. **编排进 [路线图](roadmap.md)**：把池里的活排成有序批次（AI 维护、可重排）；**反复出现 / 随规模恶化**的主题最优先。
4. **裁决**（想法→可交付的闸）：要交付某需求前，给它写一份 [裁决记录](decisions/) 里的**裁决文件**——详尽到「没有任何不确定项、仅剩代码实现」的设计 + 顶部用户批准勾。**路线图标「已裁决」必须链到它；没链接 / 用户没勾 = 视为未裁决**（见 [裁决记录 README](decisions/README.md)）。
5. 需求完成/归档 → 把最终设计结论沉淀进对应设计页（04 / 02 / 「决策与权衡」节）+ **删裁决文件** + 在 [里程碑](milestones.md) 标 ✅（**完成态由人在真达成时定，AI 不擅自标**）。未来目标块（⬜）由人或 `idea-to-roadmap`（受人调用即干预）追加。

| 子页 | 回答什么 | 性质 |
|------|----------|------|
| [里程碑](milestones.md) | 宏大目标/愿景（未来 ⬜ + 已达成 ✅） | 人工维护 · AI 仅在人干预下追加 ⬜ |
| [路线图](roadmap.md) | 还欠哪些账、先还哪个（有序批次） | 未来 · AI 维护·可重排 |
| [裁决记录](decisions/) | 「已裁决」需求的零不确定详细设计 + 用户批准勾 | **临时**·交付后沉 wiki 并删 |
| [backlog-frontend](backlog-frontend.md) | `frontend/` issue 池（按主题 × fix/feat） | issue 池 · 广度无序 |
| [backlog-backend](backlog-backend.md) | `backend/` issue 池（HTTP/WS·会话生命周期·进程编排） | issue 池 · 广度无序 |
| [backlog-core](backlog-core.md) | core 层 issue 池（引擎/底层：`backend/` store·resolve·present·catalog·build·toolgen·expr·eval + `harness/` 运行时/mcp 工具面 + `packages/*` 纯库） | issue 池 · 广度无序 |

## 当前最高优先级（详见[路线图](roadmap.md)）

1. **教条 + eval harness 闭环**（真 GM 接 gm-core skill 去 stopgap + mock 玩家↔真 Claude-GM 自动闭环，而非自导自演）——**meta 解阻塞**：不建它，一切「行为类/措辞类」结论都不可信 → **第一批**。见 [backlog-core 主题F](backlog-core.md) + [backlog-backend G-后端-gmcore](backlog-backend.md)。
2. **主题A·GM 工具面可见性**（NPC/Front/plotline/foreshadow/张力看板的存储地基已建，但没暴露成 MCP 工具给 GM）——反复出现、随规模恶化 = **头号架构债的真正剩余**，走声明式 dogfooding → **第二批**。见 [backlog-core 主题A / A′](backlog-core.md)。
3. **收尾 fix**（`narration_commit.seq` 语义 / `GET /events` 重连 / 构建 skill 接进 LoreSession）→ **第三批**。见 [backlog-backend](backlog-backend.md)。
```

- [ ] **Step 2: 验证**

Run:
```bash
grep -n "05-现状与计划\|backlog-前端\|backlog-后端\|里程碑\.md\|路线图\.md\|裁决记录/" docs/dev/plan/README.md
```
Expected: 无输出。

- [ ] **Step 3: Commit**

```bash
git add docs/dev/plan/README.md
git commit -m "docs(dev): plan/README 去掉 wiki 05 区编号自称 + 内部相对链接改英文文件名"
```

---

### Task 6: 修订顶层文档(CLAUDE.md 的 dev 相关部分 + README/README.zh-CN/CONTRIBUTING/SECURITY)

**Files:**
- Modify: `/CLAUDE.md`(仅 dev 相关行)、`README.md`、`README.zh-CN.md`、`CONTRIBUTING.md`、`SECURITY.md`

- [ ] **Step 1: CLAUDE.md —— 文档分工表里的 `docs/delivery/` 行**

old_string:
```
| [`docs/delivery/`](docs/delivery/) | **并发交付的运行记录**：一轮一目录（delivery_dag + decisions-pending + 每波冻结 wave_N_nodes.jsonl + wave_N_summary 复盘） | 长存·可回溯 |
```

new_string:
```
| [`docs/dev/delivery/`](docs/dev/delivery/) | **并发交付的运行记录**：一轮一目录（delivery_dag + decisions-pending + 每波冻结 wave_N_nodes.jsonl + wave_N_summary 复盘） | 长存·可回溯 |
| [`docs/dev/plan/`](docs/dev/plan/) | **现状与计划**：`milestones.md`(里程碑,人工维护)+ `roadmap.md`(路线图,AI 可重排)+ `backlog-{frontend,backend,core}.md`(三池)+ `decisions/`(裁决记录,零不确定项待批准)+ `eval-reports/` | 长存·持续维护 |
| [`docs/dev/tdd/`](docs/dev/tdd/) | 验收测试记录(acceptance-loop 范例轮次) | 长存·范例参照 |
```

- [ ] **Step 2: CLAUDE.md —— `roadmap-delivery-workflow` skill 描述行里的 `docs/delivery/<本轮>/`**

old_string:
```
工件落 `docs/delivery/<本轮>/`(delivery_dag+decisions-pending+每波冻结 wave_N_nodes.jsonl+wave_N_summary)
```

new_string:
```
工件落 `docs/dev/delivery/<本轮>/`(delivery_dag+decisions-pending+每波冻结 wave_N_nodes.jsonl+wave_N_summary)
```

- [ ] **Step 3: CLAUDE.md —— 文档分工表 `docs/todo/` 行路径**

old_string:
```
| [`docs/todo/`](docs/todo/) | **在途交接**：本 session 做不完 / 下一 part 的活，指回 backlog 条目 | 临时·解决即删 |
```

new_string:
```
| [`docs/dev/todo/`](docs/dev/todo/) | **在途交接**：本 session 做不完 / 下一 part 的活，指回 backlog 条目 | 临时·解决即删 |
```

- [ ] **Step 4: README.md —— Milestones 链接**

old_string:
```
*(In development — see [Milestones](docs/wiki/设计/05-现状与计划/里程碑.md) for progress.)*
```

new_string:
```
*(In development — see [Milestones](docs/dev/plan/milestones.md) for progress.)*
```

- [ ] **Step 5: README.zh-CN.md —— 里程碑链接**

old_string:
```
*（开发中——进度见 [里程碑](docs/wiki/设计/05-现状与计划/里程碑.md)。）*
```

new_string:
```
*（开发中——进度见 [里程碑](docs/dev/plan/milestones.md)。）*
```

- [ ] **Step 6: CONTRIBUTING.md —— 现状与计划片段**

old_string:
```
想了解「还欠哪些账、先做哪个」看 [`设计/05-现状与计划/`](docs/wiki/设计/05-现状与计划/)（路线图 + 三个 backlog 池）。
```

new_string:
```
想了解「还欠哪些账、先做哪个」看 [`docs/dev/plan/`](docs/dev/plan/)（路线图 + 三个 backlog 池）。
```

- [ ] **Step 7: SECURITY.md —— backlog-后端 链接**

old_string:
```
这些面的设计与进展见 [`docs/wiki/设计/05-现状与计划/backlog-后端.md`](docs/wiki/设计/05-现状与计划/backlog-后端.md) 的安全主题。
```

new_string:
```
这些面的设计与进展见 [`docs/dev/plan/backlog-backend.md`](docs/dev/plan/backlog-backend.md) 的安全主题。
```

- [ ] **Step 8: 验证**

Run:
```bash
grep -rn "docs/delivery/\|设计/05-现状与计划\|docs/wiki/设计/05" CLAUDE.md README.md README.zh-CN.md CONTRIBUTING.md SECURITY.md
```
Expected: 无输出。

- [ ] **Step 9: Commit**

```bash
git add CLAUDE.md README.md README.zh-CN.md CONTRIBUTING.md SECURITY.md
git commit -m "docs(dev): 顶层文档同步 docs/dev/{plan,delivery,todo} 新路径"
```

---

### Task 7: 修订 `.github/` 模板

**Files:**
- Modify: `.github/ISSUE_TEMPLATE/feature_request.yml`、`.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: feature_request.yml**

old_string:
```
        想了解项目当前的路线与欠账，见 [`docs/wiki/设计/05-现状与计划/`](../../docs/wiki/设计/05-现状与计划/)。
```

new_string:
```
        想了解项目当前的路线与欠账，见 [`docs/dev/plan/`](../../docs/dev/plan/)。
```

- [ ] **Step 2: PULL_REQUEST_TEMPLATE.md**

old_string:
```
<!-- 如 Closes #123，或指向 docs/wiki/设计/05-现状与计划/ 的 backlog 条目。 -->
```

new_string:
```
<!-- 如 Closes #123，或指向 docs/dev/plan/ 的 backlog 条目。 -->
```

- [ ] **Step 3: 验证 + Commit**

```bash
grep -rn "docs/wiki/设计/05" .github/
git add .github/ISSUE_TEMPLATE/feature_request.yml .github/PULL_REQUEST_TEMPLATE.md
git commit -m "docs(dev): github 模板同步 docs/dev/plan 新路径"
```
Expected: `grep` 无输出。

---

### Task 8: 修订 `.claude/skills/idea-to-roadmap/SKILL.md`(依赖最深,逐处路径 + 措辞同步)

**Files:**
- Modify: `.claude/skills/idea-to-roadmap/SKILL.md`

- [ ] **Step 1: frontmatter description 里的路径 + "只动"措辞**

old_string:
```
轻量、不发 subagent、不动代码，只动 docs/wiki/设计/05-现状与计划（+已定型时的裁决记录）。
```

new_string:
```
轻量、不发 subagent、不动代码，只动 docs/dev/plan（+已定型时的裁决记录）。
```

- [ ] **Step 2: 「1. 先归里程碑海拔」段的里程碑链接**

old_string:
```
- **全新的宏大目标/愿景** → 在 [`里程碑.md`](../../../docs/wiki/设计/05-现状与计划/里程碑.md) 追加一个新里程碑块，按页内既定格式「宏大目标 → 拆成块 → 怎么实现」写，块内项标 ⬜。
```

new_string:
```
- **全新的宏大目标/愿景** → 在 [`milestones.md`](../../../docs/dev/plan/milestones.md) 追加一个新里程碑块，按页内既定格式「宏大目标 → 拆成块 → 怎么实现」写，块内项标 ⬜。
```

- [ ] **Step 3: 「写权边界」段的 里程碑.md 提法(bare 文件名,不含路径)**

old_string:
```
**写权边界（要紧）**：里程碑.md 的铁律是「AI 不得在**无人干预**下自行改动」。用户调本 skill 抛点子**本身就是人工干预**，所以 skill 内**可以**写里程碑——但只追加/细化**未来目标块（⬜）与「怎么实现」**；**不擅自标 ✅ 完成、不改写已达成的历史**（完成态由人在真达成那一刻定）。
```

new_string:
```
**写权边界（要紧）**：`milestones.md` 的铁律是「AI 不得在**无人干预**下自行改动」。用户调本 skill 抛点子**本身就是人工干预**，所以 skill 内**可以**写里程碑——但只追加/细化**未来目标块（⬜）与「怎么实现」**；**不擅自标 ✅ 完成、不改写已达成的历史**（完成态由人在真达成那一刻定）。
```

- [ ] **Step 4: 「2. 下沉到 backlog 三池」段的路径**

old_string:
```
落 [`backlog-<层>.md`](../../../docs/wiki/设计/05-现状与计划/)。把上一步的里程碑块拆成具体 fix/feat，逐条判定 `{层, 类型}` 落对应池（层按**关注点**分，不只看目录——core 与后端都有落点在 `backend/`）：
```

new_string:
```
落 [`backlog-<层>.md`](../../../docs/dev/plan/)。把上一步的里程碑块拆成具体 fix/feat，逐条判定 `{层, 类型}` 落对应池（层按**关注点**分，不只看目录——core 与后端都有落点在 `backend/`）：
```

- [ ] **Step 5: 「3. 下沉到路线图」段的路径**

old_string:
```
落 [`路线图.md`](../../../docs/wiki/设计/05-现状与计划/路线图.md)。把池里的活按 [里程碑](../../../docs/wiki/设计/05-现状与计划/里程碑.md) 分节、编进/重排四态清单：**反复出现 + 随规模恶化 = 最高优先级**，进靠前批次。每项链接回三池条目 + 里程碑，并按四态归位：
```

new_string:
```
落 [`roadmap.md`](../../../docs/dev/plan/roadmap.md)。把池里的活按 [里程碑](../../../docs/dev/plan/milestones.md) 分节、编进/重排四态清单：**反复出现 + 随规模恶化 = 最高优先级**，进靠前批次。每项链接回三池条目 + 里程碑，并按四态归位：
```

- [ ] **Step 6: 「4. 下沉到裁决文档」段的两处路径**

old_string:
```
- **是** → 在 [`裁决记录/`](../../../docs/wiki/设计/05-现状与计划/裁决记录/) 落一份 `<需求名>.md`（格式对齐 [裁决记录 README](../../../docs/wiki/设计/05-现状与计划/裁决记录/README.md) 与同目录既有裁决文件）：
```

new_string:
```
- **是** → 在 [`decisions/`](../../../docs/dev/plan/decisions/) 落一份 `<需求名>.md`（格式对齐 [裁决记录 README](../../../docs/dev/plan/decisions/README.md) 与同目录既有裁决文件）：
```

- [ ] **Step 7: 结尾"别全量前置"段的 bare `裁决记录/` 提法**

old_string:
```
> **别全量前置**：只给**已设计到零不确定**的想法写裁决文档，不给一堆粗想法硬凑裁决（Fowler 返工坑——与 `roadmap-delivery-workflow`「just-in-time、不给 47 个路线图项全写」是同一条纪律）。两个 skill 共用 `裁决记录/` 目录 + 同一个用户批准闸——**谁把设计钉死到零不确定，谁就落裁决文档**；本 skill 落的是「随想法一起、上游就已定型」的那些，delivery 阶段1 补的是「交付前才定型」的那些。
```

new_string:
```
> **别全量前置**：只给**已设计到零不确定**的想法写裁决文档，不给一堆粗想法硬凑裁决（Fowler 返工坑——与 `roadmap-delivery-workflow`「just-in-time、不给 47 个路线图项全写」是同一条纪律）。两个 skill 共用 `decisions/` 目录 + 同一个用户批准闸——**谁把设计钉死到零不确定，谁就落裁决文档**；本 skill 落的是「随想法一起、上游就已定型」的那些，delivery 阶段1 补的是「交付前才定型」的那些。
```

- [ ] **Step 8: 「硬约束」段的 里程碑.md 提法**

old_string:
```
- **里程碑.md**：AI 不得在**无人干预**下自行改动；本 skill 由用户抛点子触发即干预，故可在其内追加/细化未来目标块（⬜）与「怎么实现」，但**不标 ✅、不改写已达成历史**。
- **路线图.md**：AI 维护、可重排。
```

new_string:
```
- **milestones.md**：AI 不得在**无人干预**下自行改动；本 skill 由用户抛点子触发即干预，故可在其内追加/细化未来目标块（⬜）与「怎么实现」，但**不标 ✅、不改写已达成历史**。
- **roadmap.md**：AI 维护、可重排。
```

- [ ] **Step 9: 验证**

Run:
```bash
grep -n "docs/wiki/设计/05\|里程碑\.md\|路线图\.md\|裁决记录/" .claude/skills/idea-to-roadmap/SKILL.md
```
Expected: 无输出(全部已改成新路径/新文件名;bare"里程碑""路线图"不带 `.md` 的纯词汇提法允许残留,不算问题——本步 grep 特意只匹配带后缀/斜杠的 token)。

- [ ] **Step 10: Commit**

```bash
git add .claude/skills/idea-to-roadmap/SKILL.md
git commit -m "docs(dev): idea-to-roadmap skill 同步 docs/dev/plan 新路径与文件名"
```

---

### Task 9: 修订 `.claude/skills/roadmap-delivery-workflow/SKILL.md`

**Files:**
- Modify: `.claude/skills/roadmap-delivery-workflow/SKILL.md`

- [ ] **Step 1: 阶段1 三段式总览代码块里的 `docs/delivery` 路径 + 裁决记录路径**

old_string:
```
  开本轮目录 docs/delivery/<YYYY-MM-DD-路线图-推进>/（长存·非 docs/todo；结构见该目录 README）
  扫路线图+三池 → 决策账本 decisions-pending.md（跨波长存）
     ├ 可逆：自己拍，记默认值
     └ 不可逆：攒进裁决文件 → 用户审清打勾批准
  裁决闸：本轮要交付的每个需求先有「经用户批准的裁决文件」(裁决记录/，零不确定项)
```

new_string:
```
  开本轮目录 docs/dev/delivery/<YYYY-MM-DD-路线图-推进>/（长存·非 docs/dev/todo；结构见该目录 README）
  扫路线图+三池 → 决策账本 decisions-pending.md（跨波长存）
     ├ 可逆：自己拍，记默认值
     └ 不可逆：攒进裁决文件 → 用户审清打勾批准
  裁决闸：本轮要交付的每个需求先有「经用户批准的裁决文件」(decisions/，零不确定项)
```

- [ ] **Step 2: 「决策账本」段起手开目录的路径**

old_string:
```
**起手第一件事**，开本轮目录 `docs/delivery/<YYYY-MM-DD-路线图-推进>/`（长存，结构见 [`docs/delivery/README`](../../../docs/delivery/README.md)），扫一遍路线图剩余项 + 三个 backlog 池，产出 `decisions-pending.md`（跨波长存）：
```

new_string:
```
**起手第一件事**，开本轮目录 `docs/dev/delivery/<YYYY-MM-DD-路线图-推进>/`（长存，结构见 [`docs/dev/delivery/README`](../../../docs/dev/delivery/README.md)），扫一遍路线图剩余项 + 三个 backlog 池，产出 `decisions-pending.md`（跨波长存）：
```

- [ ] **Step 3: 「铁律：一个路线图需求要进交付波」段的裁决记录路径(2 处)**

old_string:
```
**铁律：一个路线图需求要进交付波，必须先「已裁决」——即在 [`docs/wiki/设计/05-现状与计划/裁决记录/`](../../../docs/wiki/设计/05-现状与计划/裁决记录/) 有一份它的裁决文件、路线图挂了链接、且裁决文件顶部的用户批准勾已勾上。没链接 / 没勾 = 一律视为「未裁决」，不可进波。**（见 [裁决记录 README](../../../docs/wiki/设计/05-现状与计划/裁决记录/README.md)）
```

new_string:
```
**铁律：一个路线图需求要进交付波，必须先「已裁决」——即在 [`docs/dev/plan/decisions/`](../../../docs/dev/plan/decisions/) 有一份它的裁决文件、路线图挂了链接、且裁决文件顶部的用户批准勾已勾上。没链接 / 没勾 = 一律视为「未裁决」，不可进波。**（见 [裁决记录 README](../../../docs/dev/plan/decisions/README.md)）
```

- [ ] **Step 4: `wave_N_nodes.jsonl` 段落里 `docs/delivery/README` 引用**

old_string:
```
- **`wave_N_nodes.jsonl` 是「这一波谁在跑」的冻结快照，不是一张原地反复改 `status` 的全局图**（这点 [`docs/delivery/README`](../../../docs/delivery/README.md) 明确）。「哪些已合、推到哪一波、subagent 撞了啥」记进每波合完后写的 **`wave_N_summary.md`**，不靠在 jsonl 里翻字段。**就绪波次** = `delivery_dag.md` 里 `depends_on` 都已合进 main 的需求；冻结成下一个 `wave_{N+1}_nodes.jsonl` 喂给一个 Workflow。
```

new_string:
```
- **`wave_N_nodes.jsonl` 是「这一波谁在跑」的冻结快照，不是一张原地反复改 `status` 的全局图**（这点 [`docs/dev/delivery/README`](../../../docs/dev/delivery/README.md) 明确）。「哪些已合、推到哪一波、subagent 撞了啥」记进每波合完后写的 **`wave_N_summary.md`**，不靠在 jsonl 里翻字段。**就绪波次** = `delivery_dag.md` 里 `depends_on` 都已合进 main 的需求；冻结成下一个 `wave_{N+1}_nodes.jsonl` 喂给一个 Workflow。
```

- [ ] **Step 5: 「最终收尾阶段」段的沉淀描述(里程碑 + 裁决记录路径)**

old_string:
```
- **批量沉 wiki**：本轮**所有**已交付需求的设计结论一次沉进对应位置——决策→对应设计页「决策与权衡」节 / 设计→`04-子系统设计` / 概念·架构→`02`·`03`；现状 🚧→✅、关 backlog 条目、勾路线图（达成的宏大目标由人工进 `里程碑.md`）。**agent 调查中的现状结论也一并沉 wiki**（教训 `[调查要沉淀进wiki]`）。
- **统一删裁决文件**：确认每份裁决的设计结论都已进 wiki 后，**一次删掉本轮所有裁决文件**（`docs/wiki/设计/05-现状与计划/裁决记录/*.md`，过渡稿不长存、留着是双写漂移源）+ 路线图对应项「已裁决」链接转「已归档」。
```

new_string:
```
- **批量沉 wiki**：本轮**所有**已交付需求的设计结论一次沉进对应位置——决策→对应设计页「决策与权衡」节 / 设计→`04-子系统设计` / 概念·架构→`02`·`03`；现状 🚧→✅、关 backlog 条目、勾路线图（达成的宏大目标由人工进 `milestones.md`）。**agent 调查中的现状结论也一并沉 wiki**（教训 `[调查要沉淀进wiki]`）。
- **统一删裁决文件**：确认每份裁决的设计结论都已进 wiki 后，**一次删掉本轮所有裁决文件**（`docs/dev/plan/decisions/*.md`，过渡稿不长存、留着是双写漂移源）+ 路线图对应项「已裁决」链接转「已归档」。
```

- [ ] **Step 6: a→g 闭环①现状↔目标差距分析 段的 wiki 路径**

old_string:
```
1. **① 现状↔目标差距分析**
   读相关 wiki（**必读 [设计/05-现状与计划](../../../docs/wiki/设计/05-现状与计划/)**：路线图 + 三池）+ 对应层代码，列出 gap 清单。
```

new_string:
```
1. **① 现状↔目标差距分析**
   读相关 wiki + **必读 [现状与计划](../../../docs/dev/plan/)**（路线图 + 三池）+ 对应层代码，列出 gap 清单。
```

- [ ] **Step 7: ⑦验收 收尾段的 里程碑.md + docs/todo 路径**

old_string:
```
     - **单独跑**：① 沉淀 wiki（决策→对应设计页「决策与权衡」节 / 设计→`04-子系统设计` / 概念·架构→`02`·`03`；达成节点由人工进 `里程碑.md`）② 三处清场（关 backlog / 路线图勾掉 / 删 `docs/todo/`；**确认沉淀 wiki 后**才删 superpowers spec/plan）③ 合回 main：`git merge --ff-only <分支>`、删分支；**不 push**。
```

new_string:
```
     - **单独跑**：① 沉淀 wiki（决策→对应设计页「决策与权衡」节 / 设计→`04-子系统设计` / 概念·架构→`02`·`03`；达成节点由人工进 `milestones.md`）② 三处清场（关 backlog / 路线图勾掉 / 删 `docs/dev/todo/`；**确认沉淀 wiki 后**才删 superpowers spec/plan）③ 合回 main：`git merge --ff-only <分支>`、删分支；**不 push**。
```

- [ ] **Step 8: 验证**

Run:
```bash
grep -n "docs/delivery\|docs/wiki/设计/05\|裁决记录/\|里程碑\.md\|docs/todo/" .claude/skills/roadmap-delivery-workflow/SKILL.md
```
Expected: 无输出。

- [ ] **Step 9: Commit**

```bash
git add .claude/skills/roadmap-delivery-workflow/SKILL.md
git commit -m "docs(dev): roadmap-delivery-workflow skill 同步 docs/dev/{plan,delivery,todo} 新路径"
```

---

### Task 10: 修订 `roadmap-delivery-workflow/references/` 下 5 个文件

**Files:**
- Modify: `advance-milestone.md`、`organize-wiki.md`、`refactor-backend.md`、`refactor-frontend.md`、`spec-to-wiki.md`(均在 `.claude/skills/roadmap-delivery-workflow/references/`)

- [ ] **Step 1: advance-milestone.md —— 两处路径**

old_string:
```
| 问题从哪来 | `docs/wiki/设计/05-现状与计划/路线图.md` 的**下一批** + 三个 backlog 池 |
```

new_string:
```
| 问题从哪来 | `docs/dev/plan/roadmap.md` 的**下一批** + 三个 backlog 池 |
```

再对同文件做第二处替换:

old_string:
```
| 专属关注点 | 现状↔`里程碑.md` 的差距；把差距转成 feat 落池/排批；跨包 DAG |
```

new_string:
```
| 专属关注点 | 现状↔`milestones.md` 的差距；把差距转成 feat 落池/排批；跨包 DAG |
```

再对同文件做第三、四处替换(两行分别提到"起手先读路线图"和"收尾提示更新里程碑"):

old_string:
```
- 起手先读路线图第一批（若空，先按优先级从三池编一批）。`里程碑.md` 是过去时、人工维护，**只读不改**——达成节点等人工记。
```

new_string:
```
- 起手先读路线图第一批（若空，先按优先级从三池编一批）。`milestones.md` 是过去时、人工维护，**只读不改**——达成节点等人工记。
```

old_string:
```
- 收尾沉淀时，达成的大节点提示用户去更新 `里程碑.md`（AI 不自行改）。
```

new_string:
```
- 收尾沉淀时，达成的大节点提示用户去更新 `milestones.md`（AI 不自行改）。
```

- [ ] **Step 2: organize-wiki.md**

old_string:
```
- `里程碑.md` 人工维护，**不改**。
```

new_string:
```
- `milestones.md` 人工维护，**不改**。
```

- [ ] **Step 3: refactor-backend.md**

old_string:
```
| 问题从哪来 | `docs/wiki/设计/05-现状与计划/backlog-后端.md` |
```

new_string:
```
| 问题从哪来 | `docs/dev/plan/backlog-backend.md` |
```

- [ ] **Step 4: refactor-frontend.md**

old_string:
```
| 问题从哪来 | `docs/wiki/设计/05-现状与计划/backlog-前端.md` |
```

new_string:
```
| 问题从哪来 | `docs/dev/plan/backlog-frontend.md` |
```

- [ ] **Step 5: spec-to-wiki.md**

old_string:
```
   - **达成的大节点** → 提示用户记入 `06/里程碑.md`（人工维护，AI 不自行改）。
```

new_string:
```
   - **达成的大节点** → 提示用户记入 `docs/dev/plan/milestones.md`（人工维护，AI 不自行改）。
```

(注:原文写"`06/里程碑.md`"——"06"这个编号在当前 wiki 结构里从未真实存在过,是历史遗留的另一处编号漂移,顺手一并修正为真实路径,不再用编号占位。)

- [ ] **Step 6: 验证**

Run:
```bash
cd .claude/skills/roadmap-delivery-workflow/references
grep -n "docs/wiki/设计/05\|里程碑\.md\|裁决记录/\|06/里程碑" advance-milestone.md organize-wiki.md refactor-backend.md refactor-frontend.md spec-to-wiki.md
cd /home/mulei/dicelore
```
Expected: 无输出。

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/roadmap-delivery-workflow/references/advance-milestone.md .claude/skills/roadmap-delivery-workflow/references/organize-wiki.md .claude/skills/roadmap-delivery-workflow/references/refactor-backend.md .claude/skills/roadmap-delivery-workflow/references/refactor-frontend.md .claude/skills/roadmap-delivery-workflow/references/spec-to-wiki.md
git commit -m "docs(dev): roadmap-delivery-workflow references 同步 docs/dev/plan 新路径,顺手修一处 06 编号漂移"
```

---

### Task 11: 修订 `.claude/skills/audit-project/SKILL.md`

**Files:**
- Modify: `.claude/skills/audit-project/SKILL.md`

- [ ] **Step 1: 「阶段 3·归类入池」段的池路径 + backlog 层名**

old_string:
```
基于 `findings.yaml`，按 `layer` 字段落 backlog 三池 `docs/wiki/06-里程碑与问题/backlog-<层>.md`：
- `前端`→backlog-前端、`后端`→backlog-后端、`core`→backlog-core
```

new_string:
```
基于 `findings.yaml`，按 `layer` 字段落 backlog 三池 `docs/dev/plan/backlog-<层>.md`：
- `前端`→backlog-frontend、`后端`→backlog-backend、`core`→backlog-core
```

(注:原文路径写"`docs/wiki/06-里程碑与问题`"——"06"和"里程碑与问题"都不对应当前任何真实路径,是历史遗留的编号/命名漂移,本步一并修正为真实路径。)

- [ ] **Step 2: 「阶段 4·重排路线图」段的路线图提法**

old_string:
```
**调用 `idea-to-roadmap` skill** 把新落账条目编进/重排 `路线图.md`：推导断节 + 随规模恶化的 = 最高优先级，进靠前批次。
```

new_string:
```
**调用 `idea-to-roadmap` skill** 把新落账条目编进/重排 `roadmap.md`：推导断节 + 随规模恶化的 = 最高优先级，进靠前批次。
```

- [ ] **Step 3: PROD 角色 prompt 段的路径(编号 01/02/06 三处都对不上当前真实结构)**

old_string:
```
任务：读 docs/wiki/01-业务分析、02-领域模型、06-里程碑与问题/路线图.md（路线图 + backlog 三池 + 里程碑），产出【锚定单】+ 产品自扫漏洞，写到 {{AUDIT_DIR}}/00-锚定-产品.md，按角色文档模板。
```

new_string:
```
任务：读 docs/wiki/项目介绍、docs/wiki/开发指南/01-核心概念、docs/dev/plan/roadmap.md（路线图 + backlog 三池 + 里程碑），产出【锚定单】+ 产品自扫漏洞，写到 {{AUDIT_DIR}}/00-锚定-产品.md，按角色文档模板。
```

(注:本步把"01-业务分析"改成姊妹 wiki 重构 spec 里定的「项目介绍」域、"02-领域模型"改成「开发指南/01-核心概念」、"06-里程碑与问题"改成真实的 `docs/dev/plan/roadmap.md`——三处都是历史编号漂移,借这次机会一并修正,不再等 wiki 计划二次改这一行。)

- [ ] **Step 4: 结尾"路线图/里程碑维护铁律"段**

old_string:
```
- `路线图.md` AI 维护可重排；`里程碑.md` 人工维护、AI 不动。
```

new_string:
```
- `roadmap.md` AI 维护可重排；`milestones.md` 人工维护、AI 不动。
```

- [ ] **Step 5: 验证**

Run:
```bash
grep -n "docs/wiki/06\|docs/wiki/01-业务分析\|backlog-前端\|backlog-后端\|里程碑\.md\|路线图\.md" .claude/skills/audit-project/SKILL.md
```
Expected: 无输出。

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/audit-project/SKILL.md
git commit -m "docs(dev): audit-project skill 同步 docs/dev/plan 新路径,顺手修三处编号漂移"
```

---

### Task 12: 修订 `.claude/skills/acceptance-loop/SKILL.md` + `references/interface-and-tests.md`

**Files:**
- Modify: `.claude/skills/acceptance-loop/SKILL.md`、`.claude/skills/acceptance-loop/references/interface-and-tests.md`

- [ ] **Step 1: acceptance-loop/SKILL.md —— 里程碑链接(其余两个链接指 04-子系统设计,留给姊妹 wiki 计划改,本步只改里程碑那一段)**

old_string:
```
> 本 skill 只定「怎么做验收」，不解释项目。里程碑设想 → [里程碑.md](../../../docs/wiki/设计/05-现状与计划/里程碑.md)；接口/构建契约 → [玩家客户端-接口.md](../../../docs/wiki/设计/04-子系统设计/玩家客户端-接口.md) + [团本构建工具链.md](../../../docs/wiki/设计/04-子系统设计/团本构建工具链.md)；页面/视觉 → [玩家客户端-视觉.md](../../../docs/wiki/设计/04-子系统设计/玩家客户端-视觉.md)。前置起后端 → `eval-backend-setup`。
```

new_string:
```
> 本 skill 只定「怎么做验收」，不解释项目。里程碑设想 → [milestones.md](../../../docs/dev/plan/milestones.md)；接口/构建契约 → [玩家客户端-接口.md](../../../docs/wiki/设计/04-子系统设计/玩家客户端-接口.md) + [团本构建工具链.md](../../../docs/wiki/设计/04-子系统设计/团本构建工具链.md)；页面/视觉 → [玩家客户端-视觉.md](../../../docs/wiki/设计/04-子系统设计/玩家客户端-视觉.md)。前置起后端 → `eval-backend-setup`。
```

- [ ] **Step 2: "范例实例"一行的 tdd 路径**

old_string:
```
> **范例实例**（照它的形制做后续轮）：[`docs/tdd/acceptance-loop-2026-07-06/`](../../../docs/tdd/acceptance-loop-2026-07-06/README.md)。范例的 `frontend/index.html` 是 harness 逐态预览入口（开浏览器即看实际页面）。
```

new_string:
```
> **范例实例**（照它的形制做后续轮）：[`docs/dev/tdd/acceptance-loop-2026-07-06/`](../../../docs/dev/tdd/acceptance-loop-2026-07-06/README.md)。范例的 `frontend/index.html` 是 harness 逐态预览入口（开浏览器即看实际页面）。
```

- [ ] **Step 3: "产物、循环、分档"段的落盘路径 + backlog/裁决记录/里程碑提法**

old_string:
```
- **落盘**：一轮一目录 `docs/tdd/acceptance-loop-<YYYY-MM-DD>/`（状态机 + 前端原型 `frontend/`(含 `index.html` 逐态预览) + 前端 overview + 后端接口规约 + curl + playwright + findings 表 + transcript）。
- **findings → backlog 三池**（core / 后端 / 前端），重排接 `idea-to-roadmap`；不可逆修复进 `裁决记录/` 待用户批准。**不改 `里程碑.md`**（人工维护）。
```

new_string:
```
- **落盘**：一轮一目录 `docs/dev/tdd/acceptance-loop-<YYYY-MM-DD>/`（状态机 + 前端原型 `frontend/`(含 `index.html` 逐态预览) + 前端 overview + 后端接口规约 + curl + playwright + findings 表 + transcript）。
- **findings → backlog 三池**（core / 后端 / 前端），重排接 `idea-to-roadmap`；不可逆修复进 `decisions/` 待用户批准。**不改 `milestones.md`**（人工维护）。
```

- [ ] **Step 4: interface-and-tests.md —— findings 归口段的 backlog 层名 + 裁决记录**

old_string:
```
**findings 归口**：core → `backlog-core`；HTTP/会话/编排 → `backlog-后端`；玩家主线/前端 → `backlog-前端`；harness 自身真实性 → backlog-core 主题F。去重归类后重排接 `idea-to-roadmap`；不可逆修复写 `裁决记录/` 待用户批准。
```

new_string:
```
**findings 归口**：core → `backlog-core`；HTTP/会话/编排 → `backlog-backend`；玩家主线/前端 → `backlog-frontend`；harness 自身真实性 → backlog-core 主题F。去重归类后重排接 `idea-to-roadmap`；不可逆修复写 `decisions/` 待用户批准。
```

- [ ] **Step 5: interface-and-tests.md —— 第三步段落里的一处 backlog/裁决记录提法**

old_string:
```
- **前端驱动后端**：接口服务于前端已定的数据需求。**架构仲裁**：前端原型冒出的、超出实体机/wiki 的数据需求 = finding（超前/新需求），落 backlog/裁决记录，不自动塞进接口。范例：RT-FE14 上下文占用、RT-FE18 model 运行时切换都是前端冒出的新需求，归口裁决而非直接进协议。
```

new_string:
```
- **前端驱动后端**：接口服务于前端已定的数据需求。**架构仲裁**：前端原型冒出的、超出实体机/wiki 的数据需求 = finding（超前/新需求），落 backlog/decisions，不自动塞进接口。范例：RT-FE14 上下文占用、RT-FE18 model 运行时切换都是前端冒出的新需求，归口裁决而非直接进协议。
```

- [ ] **Step 6: 验证**

Run:
```bash
grep -n "docs/tdd/\|docs/wiki/设计/05\|里程碑\.md\|裁决记录/\|backlog-前端\|backlog-后端" .claude/skills/acceptance-loop/SKILL.md .claude/skills/acceptance-loop/references/interface-and-tests.md
```
Expected: 无输出。

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/acceptance-loop/SKILL.md .claude/skills/acceptance-loop/references/interface-and-tests.md
git commit -m "docs(dev): acceptance-loop skill 同步 docs/dev/{plan,tdd} 新路径"
```

---

### Task 13: 修订生产代码注释里的 backlog 层名(5 处纯文本提及)

**Files:**
- Modify: `backend/src/api/diagnostics.ts:44`、`backend/src/api/lore.ts:61`、`backend/src/api/lore.test.ts:693`、`backend/src/store/turnRollback.ts:15`、`harness/src/dicegm/turnLoop.ts:58`

- [ ] **Step 1: diagnostics.ts**

old_string:
```
// ── SSRF 白名单（SEC2，见 backlog-后端）─────────────────────────────────
```

new_string:
```
// ── SSRF 白名单（SEC2，见 backlog-backend）─────────────────────────────────
```

- [ ] **Step 2: lore.ts**

old_string:
```
// follow-up(记 backlog-后端「lore Draft 按轮快照/回退」):真正实现 Draft 的 per-turn checkpoint + restore。
```

new_string:
```
// follow-up(记 backlog-backend「lore Draft 按轮快照/回退」):真正实现 Draft 的 per-turn checkpoint + restore。
```

- [ ] **Step 3: lore.test.ts**

old_string:
```
    //  端点接线 + 实例刷新属 follow-up,见 backlog-后端「lore Draft 按轮快照/回退」。)
```

new_string:
```
    //  端点接线 + 实例刷新属 follow-up,见 backlog-backend「lore Draft 按轮快照/回退」。)
```

- [ ] **Step 4: turnRollback.ts**

old_string:
```
// 背景（backlog-后端 RT-1）：GM 超时兜底现为「脱困不恢复」——超时/error 触发 abort 后
```

new_string:
```
// 背景（backlog-backend RT-1）：GM 超时兜底现为「脱困不恢复」——超时/error 触发 abort 后
```

- [ ] **Step 5: turnLoop.ts**

old_string:
```
    // 记一条 warn 供运维/日志核对；结构化推给前端属 UI 接线（backlog-前端 CROSS-ERR），不在此处挂。
```

new_string:
```
    // 记一条 warn 供运维/日志核对；结构化推给前端属 UI 接线（backlog-frontend CROSS-ERR），不在此处挂。
```

- [ ] **Step 6: 验证**

Run:
```bash
grep -rn "backlog-前端\|backlog-后端" backend/src harness/src
```
Expected: 无输出。

- [ ] **Step 7: Commit**

```bash
git add backend/src/api/diagnostics.ts backend/src/api/lore.ts backend/src/api/lore.test.ts backend/src/store/turnRollback.ts harness/src/dicegm/turnLoop.ts
git commit -m "docs(dev): 生产代码注释里的 backlog 层名同步英文命名"
```

---

### Task 14: 全仓最终验证

**Files:** 无(只读校验)

- [ ] **Step 1: 全仓扫描残留旧路径**

Run:
```bash
grep -rl "docs/delivery\|docs/tdd/\|docs/todo/\|docs/reports/\|设计/05-现状与计划\|backlog-前端\|backlog-后端\|裁决记录/" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs . 2>/dev/null
```
Expected: 无输出。若有输出,说明本计划的 Task 6-13 有遗漏,回头补上对应 Edit。

- [ ] **Step 2: 确认 docs/ 顶层最终状态**

Run:
```bash
find docs -maxdepth 1 -type d | sort
find docs/dev -maxdepth 1 -type d | sort
```
Expected: 第一条为 `docs`、`docs/dev`、`docs/research`、`docs/superpowers`、`docs/wiki-old`(wiki-old 留给姊妹计划处理);第二条为 `docs/dev/delivery`、`docs/dev/plan`、`docs/dev/reports`、`docs/dev/tdd`、`docs/dev/todo`。

- [ ] **Step 3: 跑一次全量 typecheck 确认代码注释改动没有破坏语法**

Run:
```bash
npm run typecheck --silent 2>&1 | tail -20
```
Expected: 无 TypeScript 报错(本计划只改了注释字符串,不应产生任何编译错误;若报错,说明某个 Edit 不小心动到了代码而非注释,需要回查对应 Task)。

- [ ] **Step 4: 确认所有历史交付轮次目录内容零改动**

Run:
```bash
git log --oneline -1 --stat -- docs/dev/delivery/2026-06-30-路线图-推进/ docs/dev/delivery/2026-07-02-transcript-datadir-buildeval/ docs/dev/delivery/2026-07-02-路线图-推进/ docs/dev/delivery/2026-07-10-路线图-推进/ | head -30
```
Expected: 只应看到本计划 Task 2 的一次 rename 提交,不应看到额外的 content diff(若某历史轮次文件被意外改动,需要用 `git checkout` 还原该文件到 rename 前的内容)。

- [ ] **Step 5: 最终确认所有任务的 commit 都已完成,不 push**

Run:
```bash
git log --oneline -15
git status --porcelain
```
Expected: 看到本计划各 Task 的提交记录依次排开;`git status` 干净(无未提交改动)。**不执行 `git push`**——push 由用户单独指令。

