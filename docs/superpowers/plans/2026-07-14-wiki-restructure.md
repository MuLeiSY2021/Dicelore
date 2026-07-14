# wiki 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `docs/wiki-old/`(旧两域 wiki,已被作者 mv、未 commit)重建成项目根目录 `wiki/`(三域:项目介绍/玩家指南+作者指南/开发指南 + 两个根级文件夹),按 `docs/superpowers/specs/2026-07-13-wiki-restructure-design.md` 的骨架落地,同步改全仓 24 个下游引用文件(`docs/wiki`→`wiki`路径 + 顺手清理"05-决策记录-ADR"死概念、"06-里程碑与问题"错编号等历史漂移),完成后删除 `docs/wiki-old/`。

**Architecture:** 三类工作并行/顺序结合——①「直接搬」桶(03-架构/04-子系统设计/决策变更日志/01-核心概念)靠 sed 规则做路径深度重算,不重写内容;②「新写/重写」桶(项目介绍四页、玩家/作者指南、SillyTavern迁移、02-MCP与Skill体系)按结构化 brief 撰写;③下游引用同步(24 文件)+ 收尾删除旧 wiki + 全仓验证。

**Tech Stack:** `git mv` + `sed`(路径重算)+ Edit 工具(精确文本替换/新写内容)。

## Global Constraints

- **单向推导**:wiki 下游页只引用上游页(开发指南可被项目介绍/指南引用,反向不行)。
- **单源**:术语表在 `wiki/术语表.md`;问题账已不在 wiki(在 `docs/dev/plan/`,本轮只改链接指向它,不搬内容)。
- **一页一职责**:每个新写页面开头一句"本页职责"。
- **不编造未发生的效果数据**:「优势与局限」页只引用已有的 `docs/research/silly_tavern/` 调研结论,不假造 token/性能对比数字。
- **milestones.md 人工维护铁律不变**(本轮不涉及,已在姊妹 dev-reorg 计划处理)。
- **历史决策原文不迁移**:`docs/wiki-old/设计/归档/`(如有)、旧决策原文不搬进新 wiki,`docs/wiki-old` 删除前 git log 里可查(`docs/wiki` 的历史提交不受本轮影响)。
- git 命令一律加 `--no-pager`;不 push;完成后合并到本地 main 即止。
- 本计划**不**处理 `docs/research/silly_tavern/` 或 `docs/wiki-old` 之外任何用户可能在并发会话里操作的内容——发现无关改动(如另一会话新建的 spec 文件)一律不碰。

---

## 第一部分:直接搬桶(路径深度重算)

### 深度换算表(写死供后续任务引用,不必每个任务重推)

| 场景 | 旧相对路径模式(相对 `设计/03-架构/`或`设计/04-子系统设计/`内文件) | 新相对路径(相对 `wiki/开发指南/03-架构/`或`wiki/开发指南/04-子系统设计/`内文件) |
|---|---|---|
| 引用「项目介绍」域(旧01-业务与定位) | `../01-业务与定位/` | `../../项目介绍/` |
| 引用「01-核心概念」域(旧02-领域模型) | `../02-领域模型/` | `../01-核心概念/` |
| 引用同桶内 `MCP工具面.md`(裸文件名) | `MCP工具面.md` | `../02-MCP与Skill体系/MCP工具面.md` |
| 引用同桶内 `Skills包.md`(裸文件名) | `Skills包.md` | `../02-MCP与Skill体系/Skills包.md` |
| 引用「现状与计划」(旧05,已迁 docs/dev/plan) | `../05-现状与计划/` | `../../../docs/dev/plan/` |
| 引用顶层术语表 | `../../术语表.md` | `../../术语表.md`(**不变**,深度恰好相同) |
| 桶内其他裸文件名互链(如 `团本与manifest.md`) | 裸文件名 | **不变**(同目录搬迁,裸引用继续有效) |
| `../03-架构/` / `../04-子系统设计/` 互链 | 同名 | **不变**(两桶都保持原编号、原 sibling 关系) |
| 指向仓库代码/研究资料的深相对路径(`backend/`、`harness/`、`frontend/`、`packages/`、`docs/research/`、`reports/`→`docs/dev/reports/`、`.claude/skills/`) | N 个 `../` | **N-1 个** `../`(新目录比旧目录浅一层:`wiki/开发指南/X/` 比 `docs/wiki-old/设计/X/` 少一层嵌套);若目标是 `reports/`,额外把目标改成 `docs/dev/reports/` |
| 决策变更日志(`开发指南/决策变更日志.md`,桶内非嵌套页)引用 `04-子系统设计/xxx.md`(无 `../`) | 同名 | **不变**(决策变更日志在新旧结构里都是 `开发指南/`/`设计/` 根下的直接子文件,sibling 关系不变) |

### Task 1: 建三域骨架 + 两个根级新文件夹的空壳

**Files:**
- Create: `wiki/README.md`(占位,内容留 Task 15 补)、`wiki/术语表.md`(占位,内容留 Task 14 补)
- Create(空目录+各自 README 占位): `wiki/项目介绍/`、`wiki/玩家指南/`、`wiki/作者指南/`、`wiki/开发指南/`、`wiki/从SillyTavern迁移/`、`wiki/预制团本说明/`

- [ ] **Step 1: 建目录骨架**

Run:
```bash
mkdir -p wiki/项目介绍 wiki/玩家指南 wiki/作者指南 \
  wiki/开发指南/01-核心概念 wiki/开发指南/02-MCP与Skill体系 wiki/开发指南/03-架构 wiki/开发指南/04-子系统设计 \
  wiki/从SillyTavern迁移 wiki/预制团本说明
```
Expected: 无输出,目录全部创建成功(`find wiki -type d | sort` 应列出以上全部 + `wiki` 本身)。

- [ ] **Step 2: 验证**

Run:
```bash
find wiki -type d | sort
```
Expected:
```
wiki
wiki/从SillyTavern迁移
wiki/作者指南
wiki/开发指南
wiki/开发指南/01-核心概念
wiki/开发指南/02-MCP与Skill体系
wiki/开发指南/03-架构
wiki/开发指南/04-子系统设计
wiki/玩家指南
wiki/预制团本说明
wiki/项目介绍
```

(本任务不 commit——空目录 git 不追踪,等后续任务填进文件后自然一起进 git。)

---

### Task 2: 直接搬 `设计/03-架构/` → `开发指南/03-架构/`(含 dep-graph.html)

**Files:**
- Modify(git mv,保留历史): `docs/wiki-old/设计/03-架构/{README.md,总体架构.md,技术选型.md,跨agent与适配层.md,dep-graph.html}` → `wiki/开发指南/03-架构/`

**Interfaces:**
- Consumes: Task 1 的目录骨架
- Produces: `wiki/开发指南/03-架构/{README.md,总体架构.md,技术选型.md,跨agent与适配层.md,dep-graph.html}`,内部链接按深度换算表重算完毕

- [ ] **Step 1: mv 五个文件(`docs/wiki-old` 是普通 `mv` 产物、从未 `git add` 过,`git mv` 会因"source not under version control"直接报错——用 plain `mv` + 事后 `git add` 新路径,原路径的删除记录本来就已经在 git 里挂着,不用额外处理)**

Run:
```bash
mv docs/wiki-old/设计/03-架构/README.md wiki/开发指南/03-架构/README.md
mv docs/wiki-old/设计/03-架构/总体架构.md wiki/开发指南/03-架构/总体架构.md
mv docs/wiki-old/设计/03-架构/技术选型.md wiki/开发指南/03-架构/技术选型.md
mv "docs/wiki-old/设计/03-架构/跨agent与适配层.md" "wiki/开发指南/03-架构/跨agent与适配层.md"
mv docs/wiki-old/设计/03-架构/dep-graph.html wiki/开发指南/03-架构/dep-graph.html
git add wiki/开发指南/03-架构
```
Expected: 无报错。

- [ ] **Step 2: 按深度换算表重算路径(sed 批量处理,四个 .md 文件)**

Run:
```bash
cd wiki/开发指南/03-架构
sed -i \
  -e 's|\.\./01-业务与定位/|../../项目介绍/|g' \
  -e 's|\.\./02-领域模型/|../01-核心概念/|g' \
  README.md 总体架构.md 技术选型.md "跨agent与适配层.md"
cd /home/mulei/dicelore
```
Expected: 无输出。

- [ ] **Step 3: 人工核查深相对路径(仅总体架构.md 提及代码路径为 prose 非链接,预期本步无需改;若发现有超链接指代码,记下待 Step4 验证)**

Run:
```bash
grep -n "\.\./\.\./\.\./" wiki/开发指南/03-架构/*.md
```
Expected: 无输出(03-架构四页据 Explore 摘要只以 prose 提及代码路径,不含深相对路径超链接;若有输出,人工核对是否为需要 N-1 调整的深链接)。

- [ ] **Step 4: 验证内部链接目标存在**

Run:
```bash
grep -on "\.\./\.\./项目介绍/[^)）\`]*\|\.\./01-核心概念/[^)）\`]*" wiki/开发指南/03-架构/*.md | sort -u
```
Expected: 列出若干 `../../项目介绍/...` 和 `../01-核心概念/...` 引用(具体文件名待 Task 5/Task 8 落地后才存在,本步只是记录、不要求此刻就能 resolve——留一份清单供 Task 15 最终验证时统一检查断链)。

- [ ] **Step 5: Commit**

```bash
git add wiki/开发指南/03-架构 docs/wiki-old/设计/03-架构
git commit -m "docs(wiki): 直接搬 03-架构→开发指南/03-架构,按深度换算表重算跨域相对路径"
```

---

### Task 3: 直接搬 `设计/04-子系统设计/`(除 MCP工具面.md、Skills包.md)→ `开发指南/04-子系统设计/`

**Files:**
- Modify(git mv): `docs/wiki-old/设计/04-子系统设计/{README.md,团本与manifest.md,团本构建工具链.md,玩家客户端.md,玩家客户端-接口.md,玩家客户端-视觉.md,后端双路径架构.md,内层能力库.md,adapter与L3审计.md,Skills-eval.md,玩家客户端-视觉草图/}` → `wiki/开发指南/04-子系统设计/`

**Interfaces:**
- Consumes: Task 1 骨架、Task 2 的 03-架构 已落位(供互链校验)
- Produces: `wiki/开发指南/04-子系统设计/` 下 10 个文件 + 1 个视觉草图子目录,内部链接重算完毕(含 MCP工具面.md/Skills包.md 出桶后的引用改写)

- [ ] **Step 1: mv 十项(9 文件 + 1 目录,plain mv + git add,理由同 Task2 Step1),MCP工具面.md 与 Skills包.md 不在此列(留 Task 4)**

Run:
```bash
cd docs/wiki-old/设计/04-子系统设计
mv README.md ../../../../wiki/开发指南/04-子系统设计/README.md
mv 团本与manifest.md ../../../../wiki/开发指南/04-子系统设计/团本与manifest.md
mv 团本构建工具链.md ../../../../wiki/开发指南/04-子系统设计/团本构建工具链.md
mv 玩家客户端.md ../../../../wiki/开发指南/04-子系统设计/玩家客户端.md
mv 玩家客户端-接口.md ../../../../wiki/开发指南/04-子系统设计/玩家客户端-接口.md
mv 玩家客户端-视觉.md ../../../../wiki/开发指南/04-子系统设计/玩家客户端-视觉.md
mv 后端双路径架构.md ../../../../wiki/开发指南/04-子系统设计/后端双路径架构.md
mv 内层能力库.md ../../../../wiki/开发指南/04-子系统设计/内层能力库.md
mv adapter与L3审计.md ../../../../wiki/开发指南/04-子系统设计/adapter与L3审计.md
mv Skills-eval.md ../../../../wiki/开发指南/04-子系统设计/Skills-eval.md
mv 玩家客户端-视觉草图 ../../../../wiki/开发指南/04-子系统设计/玩家客户端-视觉草图
cd /home/mulei/dicelore
git add wiki/开发指南/04-子系统设计
```
Expected: 无报错。

- [ ] **Step 2: 按深度换算表重算(跨域引用 + MCP工具面/Skills包出桶引用)**

Run:
```bash
cd wiki/开发指南/04-子系统设计
sed -i \
  -e 's|\.\./01-业务与定位/|../../项目介绍/|g' \
  -e 's|\.\./02-领域模型/|../01-核心概念/|g' \
  -e 's|\.\./05-现状与计划/|../../../docs/dev/plan/|g' \
  -e 's|(MCP工具面\.md)|(../02-MCP与Skill体系/MCP工具面.md)|g' \
  -e 's|(Skills包\.md)|(../02-MCP与Skill体系/Skills包.md)|g' \
  -e 's|`MCP工具面\.md`|`../02-MCP与Skill体系/MCP工具面.md`|g' \
  -e 's|`Skills包\.md`|`../02-MCP与Skill体系/Skills包.md`|g' \
  README.md 团本与manifest.md 团本构建工具链.md 玩家客户端.md 玩家客户端-接口.md 玩家客户端-视觉.md 后端双路径架构.md 内层能力库.md adapter与L3审计.md Skills-eval.md
cd /home/mulei/dicelore
```
Expected: 无输出。

- [ ] **Step 3: 验证 MCP工具面.md/Skills包.md 裸引用清零**

Run:
```bash
grep -rn "[^/]MCP工具面\.md\|[^/]Skills包\.md" wiki/开发指南/04-子系统设计/*.md
```
Expected: 无输出(所有引用都应带 `../02-MCP与Skill体系/` 前缀;若有输出说明 sed 模式没覆盖到某种 markdown 语法写法,需要人工补一条 sed 规则或手动 Edit)。

- [ ] **Step 4: 深相对路径 N-1 调整——玩家客户端-视觉.md 的直链代码路径**

`玩家客户端-视觉.md` 里有两条**直接超链接**指向仓库代码(非 prose),原文:
```
../../../../backend/src/store/sheet/visibility.ts
../../../../backend/src/store
```
用 Edit 工具在 `wiki/开发指南/04-子系统设计/玩家客户端-视觉.md` 里把这两处 `../../../../` 改成 `../../../`(旧目录深度 4,新目录深度 3,少一层):

old_string 出现处按 Read 工具打开该文件定位 `../../../../backend/src/store/sheet/visibility.ts` 和 `../../../../backend/src/store` 两处精确上下文后逐条 Edit,替换成 `../../../backend/src/store/sheet/visibility.ts` 和 `../../../backend/src/store`。

- [ ] **Step 5: 深相对路径 N-1 调整 + 目标改名——Skills-eval.md 的多处深链接**

`Skills-eval.md` 里的深相对路径链接需要两类调整:(a) 单纯少一层 `../`;(b) 若指向 `reports/` 需改成 `docs/dev/reports/`(该目录已在姊妹 dev-reorg 计划里搬迁)。用 Read 工具打开 `wiki/开发指南/04-子系统设计/Skills-eval.md` 定位以下原文模式,逐条用 Edit 精确替换:

- `../../../research/scraped/` → `../../research/scraped/`(少一层,repo-root 相对目标不变,仍是 `docs/research/scraped/`)
- `../../../../backend/src/present/playerView.ts` → `../../../backend/src/present/playerView.ts`
- `../../../../backend/src/eval/assertions.ts` → `../../../backend/src/eval/assertions.ts`
- `../../../harness/eval-dicegm/grader.md` → `../../harness/eval-dicegm/grader.md`
- `../../../../.claude/skills/play-eval/SKILL.md` → `../../../.claude/skills/play-eval/SKILL.md`
- `../../../../.claude/skills/build-eval/SKILL.md` → `../../../.claude/skills/build-eval/SKILL.md`
- `../../../../.claude/skills/eval-backend-setup/SKILL.md` → `../../../.claude/skills/eval-backend-setup/SKILL.md`
- `../../../../reports/` → `../../../docs/dev/reports/`(少一层 **且** 目标改名,因为 reports/ 已经不在旧位置,搬进了 `docs/dev/reports/`)
- `../../../../harness/eval-dicegm/run.ts` → `../../../harness/eval-dicegm/run.ts`

- [ ] **Step 6: 验证深链接目标真实存在**

Run:
```bash
cd wiki/开发指南/04-子系统设计
test -f ../../../backend/src/store/sheet/visibility.ts && echo "OK: visibility.ts"
test -d ../../../backend/src/store && echo "OK: store dir"
test -d ../../research/scraped && echo "OK: research/scraped"
test -f ../../../backend/src/present/playerView.ts && echo "OK: playerView.ts"
test -f ../../../backend/src/eval/assertions.ts && echo "OK: assertions.ts"
test -f ../../harness/eval-dicegm/grader.md && echo "OK: grader.md"
test -f ../../../.claude/skills/play-eval/SKILL.md && echo "OK: play-eval SKILL"
test -f ../../../.claude/skills/build-eval/SKILL.md && echo "OK: build-eval SKILL"
test -f ../../../.claude/skills/eval-backend-setup/SKILL.md && echo "OK: eval-backend-setup SKILL"
test -d ../../../docs/dev/reports && echo "OK: docs/dev/reports"
test -f ../../../harness/eval-dicegm/run.ts && echo "OK: run.ts"
cd /home/mulei/dicelore
```
Expected: 全部 10 行 `OK: ...` 都打印(任何一条缺失说明对应 Edit 算错了层数,回头核对)。

- [ ] **Step 7: Commit**

```bash
git add wiki/开发指南/04-子系统设计 docs/wiki-old/设计/04-子系统设计
git commit -m "docs(wiki): 直接搬 04-子系统设计(除MCP工具面/Skills包)→开发指南/04-子系统设计,重算深相对路径"
```

---

### Task 4: 升格 `02-MCP与Skill体系`——合并 MCP工具面.md + Skills包.md + 从核心概念.md 抽出的三层约束

**Files:**
- Modify(git mv): `docs/wiki-old/设计/04-子系统设计/{MCP工具面.md,Skills包.md}` → `wiki/开发指南/02-MCP与Skill体系/`
- Create: `wiki/开发指南/02-MCP与Skill体系/README.md`

**Interfaces:**
- Consumes: Task 3 完成(04-子系统设计已落位,可交叉验证反向链接)
- Produces: `wiki/开发指南/02-MCP与Skill体系/{README.md,MCP工具面.md,Skills包.md}`

- [ ] **Step 1: mv 两个文件(plain mv + git add,理由同 Task2 Step1)**

Run:
```bash
mv "docs/wiki-old/设计/04-子系统设计/MCP工具面.md" "wiki/开发指南/02-MCP与Skill体系/MCP工具面.md"
mv "docs/wiki-old/设计/04-子系统设计/Skills包.md" "wiki/开发指南/02-MCP与Skill体系/Skills包.md"
git add "wiki/开发指南/02-MCP与Skill体系"
```
Expected: 无报错。

- [ ] **Step 2: 按深度换算表重算这两个文件内部的跨域引用**

Run:
```bash
cd "wiki/开发指南/02-MCP与Skill体系"
sed -i \
  -e 's|\.\./01-业务与定位/|../../项目介绍/|g' \
  -e 's|\.\./02-领域模型/|../01-核心概念/|g' \
  -e 's|\.\./05-现状与计划/|../../../docs/dev/plan/|g' \
  "MCP工具面.md" "Skills包.md"
cd /home/mulei/dicelore
```

注意:这两个文件原来位于 `设计/04-子系统设计/`(深度同 03-架构/04-子系统设计),现在挪到 `开发指南/02-MCP与Skill体系/`——**深度不变**(还是 `wiki/开发指南/X/` 两层),所以上面这条换算表跟 Task2/3 一致,直接复用;但这两个文件原来对**同桶兄弟文件**(如 `内层能力库.md`、`团本与manifest.md`)的裸引用,现在这些兄弟文件搬去了 `../04-子系统设计/`(不再同目录),需要额外一条 sed:

Run:
```bash
cd "wiki/开发指南/02-MCP与Skill体系"
sed -i \
  -e 's|(内层能力库\.md)|(../04-子系统设计/内层能力库.md)|g' \
  -e 's|(adapter与L3审计\.md)|(../04-子系统设计/adapter与L3审计.md)|g' \
  -e 's|(团本与manifest\.md)|(../04-子系统设计/团本与manifest.md)|g' \
  -e 's|(团本构建工具链\.md)|(../04-子系统设计/团本构建工具链.md)|g' \
  -e 's|`内层能力库\.md`|`../04-子系统设计/内层能力库.md`|g' \
  -e 's|`adapter与L3审计\.md`|`../04-子系统设计/adapter与L3审计.md`|g' \
  -e 's|`团本与manifest\.md`|`../04-子系统设计/团本与manifest.md`|g' \
  -e 's|`团本构建工具链\.md`|`../04-子系统设计/团本构建工具链.md`|g' \
  "MCP工具面.md" "Skills包.md"
cd /home/mulei/dicelore
```
Expected: 两组命令均无输出。

- [ ] **Step 3: 读取核心概念.md,摘出"三层约束 L1/L2/L3"整段原文,准备并入(下一步用)**

Run:
```bash
grep -n "L1\|L2\|L3\|工具强制\|塑形教条\|审计" docs/wiki-old/设计/02-领域模型/核心概念.md | head -30
```
Expected: 定位三层约束段落的起止行号,供 Step 4 精确摘录。

- [ ] **Step 4: 写 `wiki/开发指南/02-MCP与Skill体系/README.md`**

用 Read 工具打开 `docs/wiki-old/设计/02-领域模型/核心概念.md` 确认 Step 3 定位的三层约束段落完整原文,连同它引用的任何"决策与权衡"细节一并摘录。本页内容结构:

```markdown
# MCP 与 Skill 体系

> **本页职责**：回答"完善工具怎么落地"——MCP 工具面清单 + Skill 分层机制 + 两者怎么组合成 L1/L2/L3 三层约束,保证 GM 机制不被绕过。这是「项目介绍」里"MCP+Skill赋能"这句定位的技术落点。
> **上游依赖**：[项目介绍/是什么与为什么](../../项目介绍/是什么与为什么.md)、[01-核心概念](../01-核心概念/核心概念.md)。

## 三层约束(从核心概念迁来,原文见 docs/wiki-old 历史提交)

<此处完整粘贴 Step 3 定位到的 L1 工具强制 / L2 塑形教条 / L3 审计 原文,不删减、不改写,只搬位置>

## MCP 工具面

见 [MCP工具面.md](MCP工具面.md)。

## Skill 分层机制

见 [Skills包.md](Skills包.md)。
```

用 Write 工具创建该文件,三层约束段落的具体文字以 Step 3 读到的原文为准(此处不重复摘录,执行者必须先 Read 原文再落笔,不得凭记忆改写)。

- [ ] **Step 5: 验证**

Run:
```bash
ls "wiki/开发指南/02-MCP与Skill体系/"
grep -c "L1\|L2\|L3" "wiki/开发指南/02-MCP与Skill体系/README.md"
```
Expected: 列出 3 个文件(README.md/MCP工具面.md/Skills包.md);grep 计数 >0(确认三层约束内容确实写进去了)。

- [ ] **Step 6: Commit**

```bash
git add "wiki/开发指南/02-MCP与Skill体系" docs/wiki-old/设计/04-子系统设计
git commit -m "docs(wiki): 升格 02-MCP与Skill体系——合并MCP工具面+Skills包+核心概念的三层约束"
```

---

### Task 5: 直接搬 `02-领域模型/核心概念.md` → `开发指南/01-核心概念/核心概念.md`,抽出 §4.2 三层约束到 Task4 已建好的 02-MCP与Skill体系

**Files:**
- Modify(git mv): `docs/wiki-old/设计/02-领域模型/{README.md,核心概念.md}` → `wiki/开发指南/01-核心概念/`
- Modify: `wiki/开发指南/02-MCP与Skill体系/README.md`(已在 Task4 建好,本任务把 §4.2 原文接进它的"三层约束"节——若 Task4 Step4 已经从本文件读取并写入,本任务确认无重复/无遗漏即可,不重复写)

**Interfaces:**
- Consumes: Task 4 已把 §4.2 内容写入 `02-MCP与Skill体系/README.md`(若 Task4 执行时尚未到本任务,顺序应是:先做本 Task5 Step1 的 git mv,再回头确认 Task4 Step3-4 读的是搬迁后的路径`wiki/开发指南/01-核心概念/核心概念.md`——**实际执行顺序建议:Task4 的 Step3(grep 定位)/Step4(摘录写入) 在本 Task5 的 Step1(git mv) 之后跑**,即先搬文件,再从新路径摘录;若 DAG 调度把 Task4/5 分进不同并行节点,派发时把本 Task5 列为 Task4 的前置依赖)

- [ ] **Step 1: mv 两个文件(plain mv + git add,理由同 Task2 Step1)**

Run:
```bash
mv docs/wiki-old/设计/02-领域模型/README.md wiki/开发指南/01-核心概念/README.md
mv docs/wiki-old/设计/02-领域模型/核心概念.md wiki/开发指南/01-核心概念/核心概念.md
git add wiki/开发指南/01-核心概念
```
Expected: 无报错。

- [ ] **Step 2: 从核心概念.md 里删除 §4.2 三层约束整节(已搬进 02-MCP与Skill体系)**

用 Edit 工具删除以下整段(即原文件第 159-179 行"### 4.2 三种强度杠杆..."整节,含表格,到"本节只定概念..."那句结束):

old_string:
```
### 4.2 三种强度杠杆：L1 / L2 / L3（与三段式正交）

> **关键认知：L1/L2/L3 不是第四层，而是和"三层"正交的另一个轴。** 三层（数据/行动/塑形）= 系统**由哪些部件构成**；L1/L2/L3 = 塑形这件事**靠什么强度达成**。

三种杠杆，可靠性递减、适用对象不同：

- **L1 工具强制**：借行动层那些**必经工具**，让正确行为在结构上不可绕过——必掷骰、声明后果在先、给选项/掷骰用不同工具名分流。最硬，但只能管"能被结构卡住"的部分。
- **L2 skill / Principles 教**：塑形层本体（Agenda / Principles / Moves 三段式，见 §4.1）。教 AI 何时用哪种裁决、别软着陆、怎么判断"该选还是该骰"。可被忽视，但是**判断类问题的唯一载体**。
- **L3 Hook 审计**：事后比对、抓违规（掷骰绕过率、声明后果与叙事是否一致）。兜底，不阻止当下。

**三失败 × 三杠杆的主次矩阵**（★ = 主力）：

| 失败模式 | L1 工具强制 | L2 skill 教 | L3 Hook 审计 |
|---|---|---|---|
| **F1 跳骰** | ★ 必掷 | 流程 skill | 绕过率审计 |
| **F2 软着陆** | ★ 声明后果在先 | 禁令措辞 | 后果-叙事比对 |
| **F3 选错方式** | 工具名分流 | ★ 决策框架（靠教） | 错配抽查 |

→ **可靠性 L1 > L2 > L3，但越靠"判断"的失败（F3）越只能靠教（L2）。** 这正是项目重心落在"用提示词教 AI 当 GM"而非堆代码的原因：能结构化卡住的（F1/F2 的硬约束）尽量下沉到 L1，卡不住的判断（F3）交给 L2。

> 本节只定概念。skill / Principles 的具体注入机制、Hook 的实现、工具响应"补刀"的形态，留给 03/04（见 §7）。

## 5. 两个研究级难题：明确隔离，v1 用朴素版
```

new_string:
```
> 三层约束(L1 工具强制/L2 skill 教/L3 Hook 审计)已搬去 [02-MCP与Skill体系](../02-MCP与Skill体系/README.md)——那套讲的是"塑形这件事靠什么强度达成的机制",属 MCP+Skill 落地细节,不再留在纯概念页。

## 5. 两个研究级难题：明确隔离，v1 用朴素版
```

- [ ] **Step 3: 按深度换算表重算本页其余跨域引用**

Run:
```bash
cd wiki/开发指南/01-核心概念
sed -i \
  -e 's|\.\./01-业务与定位/|../../项目介绍/|g' \
  -e 's|\.\./05-现状与计划/|../../../docs/dev/plan/|g' \
  -e 's|(\.\./04-子系统设计/MCP工具面\.md)|(../02-MCP与Skill体系/MCP工具面.md)|g' \
  -e 's|(\.\./04-子系统设计/Skills包\.md)|(../02-MCP与Skill体系/Skills包.md)|g' \
  -e 's|\[Skills 包\](\.\./04-子系统设计/Skills包\.md)|[Skills 包](../02-MCP与Skill体系/Skills包.md)|g' \
  核心概念.md README.md
cd /home/mulei/dicelore
```
Expected: 无输出。`../03-架构/`、`../04-子系统设计/`(不含 MCP工具面/Skills包的)、`../../术语表.md` 均**不变**(同深度 sibling,已在深度换算表标注)。

- [ ] **Step 4: 验证 §4.2 确实删除且新指引落地**

Run:
```bash
grep -n "4\.2\|三种强度杠杆" wiki/开发指南/01-核心概念/核心概念.md
grep -n "MCP工具面\.md\|Skills包\.md" wiki/开发指南/01-核心概念/核心概念.md
```
Expected: 第一条无输出(§4.2 标题已删);第二条若有输出,路径都应带 `../02-MCP与Skill体系/` 前缀。

- [ ] **Step 5: Commit**

```bash
git add wiki/开发指南/01-核心概念 docs/wiki-old/设计/02-领域模型
git commit -m "docs(wiki): 直接搬 02-领域模型→开发指南/01-核心概念,抽 §4.2 三层约束去 02-MCP与Skill体系"
```

---

### Task 6: 直接搬 `设计/决策变更日志.md` → `开发指南/决策变更日志.md`

**Files:**
- Modify(git mv): `docs/wiki-old/设计/决策变更日志.md` → `wiki/开发指南/决策变更日志.md`

**Interfaces:**
- Consumes: 无(本文件的内链是同深度 sibling 引用,深度换算表标注为"不变")

- [ ] **Step 1: mv(plain mv + git add,理由同 Task2 Step1)**

Run:
```bash
mv docs/wiki-old/设计/决策变更日志.md wiki/开发指南/决策变更日志.md
git add wiki/开发指南/决策变更日志.md
```
Expected: 无报错。

- [ ] **Step 2: 验证内部链接不需要改(裸 `04-子系统设计/xxx.md` 引用在新结构下依然是合法 sibling 路径)**

Run:
```bash
grep -n "04-子系统设计/" wiki/开发指南/决策变更日志.md
test -f wiki/开发指南/04-子系统设计/后端双路径架构.md && echo "OK: 目标文件存在"
test -f wiki/开发指南/04-子系统设计/团本构建工具链.md && echo "OK: 目标文件存在"
```
Expected: 列出 18 条记录里引用 `04-子系统设计/xxx.md` 的行;两条 `test` 都打印 OK(证明裸 sibling 路径在新结构下确实解析得通,不需要改)。

- [ ] **Step 3: 检查是否有引用 `MCP工具面.md` 决策节(该文件已挪出 04-子系统设计)**

Run:
```bash
grep -n "MCP工具面" wiki/开发指南/决策变更日志.md
```
Expected: 若有输出(据 Explore 摘要,决策变更日志有一条链 `04-子系统设计/MCP工具面.md`「决策节」),用 Edit 把该行的 `04-子系统设计/MCP工具面.md` 改成 `02-MCP与Skill体系/MCP工具面.md`(去掉中间那一段,因为决策变更日志和 02-MCP与Skill体系 现在也是 `开发指南/` 下的直接 sibling,同深度不变)。

- [ ] **Step 4: Commit**

```bash
git add wiki/开发指南/决策变更日志.md docs/wiki-old/设计
git commit -m "docs(wiki): 直接搬 决策变更日志→开发指南/决策变更日志,修一处MCP工具面出桶引用"
```

---

### Task 7: 拆 `指南/开发者指南.md`——开发者向内容并入 04-子系统设计/README,作者向内容(§2.2)重写成作者指南新页

原文件(126 行,已在 §0 全文读出)自称"使用视角投影"、内容大部分是对既有设计页的二次索引(§1.1→玩家客户端-接口.md、§1.2→后端双路径架构.md、§1.4→MCP工具面.md、§1.5→团本与manifest.md 的合同已经权威存在)。不重复造一份"接口规范速查"跟设计页打架,只把**这份页面独有、别处没有的内容**(§0 两条缝速查表、§3 开发/联调示例、§2.2 自定义MCP的作者操作步骤)分别落位。

**Files:**
- Modify: `wiki/开发指南/04-子系统设计/README.md`(追加"开发者速查"节)
- Create: `wiki/作者指南/DIY自定义MCP接入.md`
- Delete(逻辑上,通过 git mv 到 docs/wiki-old 之外即完成,原文件本身不再单独存在于新 wiki): 无需额外操作,原文件已在 `docs/wiki-old/指南/开发者指南.md`,本任务只搬"值"、不搬"壳",原文件随 Task 16(删 docs/wiki-old)一并清场

**Interfaces:**
- Consumes: Task 3 已把 `04-子系统设计/README.md` 搬到位

- [ ] **Step 1: 给 `wiki/开发指南/04-子系统设计/README.md` 追加"开发者速查"节**

用 Read 工具打开当前 `wiki/开发指南/04-子系统设计/README.md`(Task3 搬迁后的版本),在文件末尾追加以下内容(用 Edit 工具在文件末尾插入,不改动已有内容):

```markdown

## 开发者速查:两条缝 + 联调起服务

扩展前先分清两条接口缝(详细契约见各权威页,本节只给速查表 + 起服务命令):

| 缝 | 谁 ↔ 谁 | 拓扑 | 机制 | 该不该远程化 | 权威页 |
|---|---|---|---|---|---|
| **缝 A** | dicelore MCP(agent 工具面)↔ 编排后端 | 永远同机同进程 | 进程内 `onCanonWrite` 回调(HTTP webhook 是跨进程未来形态) | 不需要 | [玩家客户端-接口 §0/§5](玩家客户端-接口.md) |
| **缝 B** | 编排后端 ↔ 呈现 UI(web) | web 可远程、未来多租户 | REST + WS,按 `sessionId` 寻址 | 需要 | [玩家客户端-接口 §1-4](玩家客户端-接口.md) |

storage-port(`SessionBackend`,harness↔backend 之间)见 [后端双路径架构](后端双路径架构.md);MCP 工具面(运行时+构建期)见 [MCP工具面](../02-MCP与Skill体系/MCP工具面.md);团本 pack 格式见 [团本与manifest](团本与manifest.md);声明式自定义工具(`sqlGuard`/视图编译/工具编译)见 [团本构建工具链 §7](团本构建工具链.md);CC hook 三件套(SessionStart/UserPromptSubmit/Stop)见 [adapter与L3审计](adapter与L3审计.md)。

**本地联调起服务:**

```bash
# 后端:FAKE_GM 跳过真 LLM,纯脚本 GM,适合联调
DICELORE_FAKE_GM=1 PORT=8787 npm run dev -w @dicelore/backend
# 前端:Vite dev,把 /sessions 代理到 :8787
npm run dev -w @dicelore/frontend
```

连通自检:`GET /sessions/demo/presentation` 应回全量快照(空局=空 sheets/mechanics、`choices:null`);浏览器开 `/play` 应建立 `ws://…/sessions/demo/ws`。真 GM 联调去掉 `DICELORE_FAKE_GM`、配 `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN`;真 SDK 集成冒烟另设 `RUN_LIVE=1` opt-in(避免常规测试烧 token)。四个 happy-path 用例见 [玩家客户端-接口 §9.2](玩家客户端-接口.md)。
```

- [ ] **Step 2: 写 `wiki/作者指南/DIY自定义MCP接入.md`**

内容取自原 `开发者指南.md` §2.2,改写成操作步骤口吻(去掉"开发者关注点"这类工程视角措辞,换成"你要做什么"):

```markdown
# DIY 自定义 MCP 接入

> **本页职责**：怎么给你的团本接一个外部 MCP server(联网检索、配图等周边能力),给 GM 用。
> **边界**：自定义 MCP **不得碰规范态**(不能改 sheet/event/world/rule)——它的产出只作叙述/note 流回,不发呈现通知、副作用不进快照、走权限闸、归 out-of-canon 审计。这条边界是硬约束,不是建议。
> 更深的工程细节(hook 契约、审计实现)见 [开发指南/04-子系统设计/adapter与L3审计](../开发指南/04-子系统设计/adapter与L3审计.md)、[玩家客户端 §8](../开发指南/04-子系统设计/玩家客户端.md)——本页只讲你需要做的操作。

## 什么时候需要它

你的团本想给 GM 加一个本身没有的能力——比如联网查资料、生成一张配图——又不想（也不该）让这个能力直接改动游戏的权威状态,就用自定义 MCP。

## 怎么接

(此处按 [作者指南/构建台入门](构建台入门.md) 里配置页的实际 UI 操作步骤撰写——填 marketplace 地址/装包/在 config 里声明,具体表单字段以当前实现为准,执行本任务时用 Read 工具核对 `frontend/src/features/config/` 或对应配置页组件,不要凭空编造字段名。)

## 记住这条边界

接完之后,你的自定义 MCP 能读到游戏正在发生什么(供它给出相关的内容),但**改不了** sheet(人物卡)、event(剧情记录)、world(设定卡池)、rule(规则)。它给 GM 的是"参考资料",不是"篡改权限"。
```

(注:"怎么接"这一节故意留了"执行时核对实际 UI"的指引而非编造具体表单字段——这是当前前端配置页实现细节,写计划这一刻没有把该组件读全,执行者必须先读实际代码/UI 再落笔,不能照抄旧开发者指南的工程视角描述。)

- [ ] **Step 3: 验证**

Run:
```bash
ls wiki/作者指南/
grep -n "sqlGuard\|CC hook\|SessionStart" wiki/作者指南/DIY自定义MCP接入.md
```
Expected: 第一条列出 `DIY自定义MCP接入.md`;第二条**无输出**(工程黑话没有泄漏进作者向页面)。

- [ ] **Step 4: Commit**

```bash
git add wiki/开发指南/04-子系统设计/README.md wiki/作者指南/DIY自定义MCP接入.md
git commit -m "docs(wiki): 拆开发者指南——开发者速查并入04-子系统设计README,自定义MCP接入重写进作者指南"
```

---

### Task 8: 精简术语表 → `wiki/术语表.md`

**Files:**
- Create: `wiki/术语表.md`(内容源自 `docs/wiki-old/术语表.md`,精简后落新路径)
- Modify(via move,原文件成为历史,不再单独存在于新 wiki): `docs/wiki-old/术语表.md` 内容迁完后本身留给 Task16 随 `docs/wiki-old` 一并删除

**Interfaces:**
- Produces: `wiki/术语表.md`,供全 wiki 及下游引用文件链接

- [ ] **Step 1: 砍掉 8 个纯内部黑话/失败模式分类/命名收编记录词条**

用 Read 工具打开 `docs/wiki-old/术语表.md` 确认原文,删除以下词条整行(表格行):
- `F1 跳过骰子`
- `F2 不尊重结果`
- `F3 选错处理方式`
- `裁决骰 / 数值骰`
- `Front / Clock 大小写（概念 vs 实现层）`
- `已落地改名登记（canonical + 收编旧名）`
- `强制隐藏标记`(内容可留一句"暗值 cell 即使 entity-show 也不露"并入"show"词条,不必单独一行)
- `访问画像`

以及以下 2 个偏"旧业务定位"性质的词条(新定位下这类内容归"项目介绍"域讨论,不留在跨域术语表):
- `服务器位 GM`
- `替代派 / 相棒派`

其余全部保留(含"两副担子/记账担子/失控倾向"——这三条解释架构为什么这么分层,是跨域读者会碰到的概念,不算纯内部黑话)。

- [ ] **Step 2: 精简 `sheet 域`/`event 域` 两条词条的"收编变体"尾巴**

`sheet 域（逻辑层 vs 物理表 state）` 和 `event 域（逻辑层 vs 物理表 log）` 两条词条保留**核心定义**(canonical 逻辑名 vs 物理表名的区分),删掉"收编变体（逻辑层应改 sheet）：`StateCell`/`Draft.setState()`/…"这类纯代码层旧命名清单(那是给 AI 改名时查的收编记录,不是读者需要理解的概念,该类内容若仍有价值,记入对应设计页或 backlog,不在术语表重复维护)。

- [ ] **Step 3: 路径前缀改写——`设计/xxx` → `开发指南/xxx`,`设计/01-业务与定位/xxx` → `../项目介绍/xxx`**

Run:
```bash
mkdir -p wiki
cp docs/wiki-old/术语表.md wiki/术语表.md
cd wiki
sed -i \
  -e 's|设计/01-业务与定位/|项目介绍/|g' \
  -e 's|设计/02-领域模型/|开发指南/01-核心概念/|g' \
  -e 's|设计/03-架构/|开发指南/03-架构/|g' \
  -e 's|设计/04-子系统设计/Skills包\.md|开发指南/02-MCP与Skill体系/Skills包.md|g' \
  -e 's|设计/04-子系统设计/MCP工具面\.md|开发指南/02-MCP与Skill体系/MCP工具面.md|g' \
  -e 's|设计/04-子系统设计/|开发指南/04-子系统设计/|g' \
  -e 's|设计/05-现状与计划/裁决记录/|../docs/dev/plan/decisions/|g' \
  -e 's|设计/05-现状与计划/|../docs/dev/plan/|g' \
  术语表.md
cd /home/mulei/dicelore
```
Expected: 无输出。

- [ ] **Step 4: 应用 Step1/Step2 的删减(用 Edit 工具在 `wiki/术语表.md` 上做,基于 Step3 已改好路径的版本)**

按 Step1/Step2 列出的词条,逐条用 Edit 删除对应表格行(整行删除,`old_string`=该行完整文本,`new_string`=空)。

- [ ] **Step 5: 更新页头"上游依赖"**

old_string:
```
> **上游依赖**：[核心概念](设计/02-领域模型/核心概念.md)。
```
new_string:
```
> **上游依赖**：[核心概念](开发指南/01-核心概念/核心概念.md)。
```

- [ ] **Step 6: 验证——不留旧路径 + 词条数量核对**

Run:
```bash
grep -n "设计/" wiki/术语表.md
echo "---词条数量---"
grep -c "^| \*\*" wiki/术语表.md
```
Expected: 第一条无输出(所有 `设计/` 前缀已改写);第二条应比原文件(逐行数一下原文件有多少 `| **` 开头行)少 10 条(8 个纯黑话 + 2 个旧定位词条)。

- [ ] **Step 7: Commit**

```bash
git add wiki/术语表.md
git commit -m "docs(wiki): 精简术语表——砍10个纯黑话/旧定位词条,路径改指新wiki结构"
```

---

## 第二部分:新写/重写内容(结构化 brief,非逐句代写)

> 以下每个任务给的是**结构要求 + 素材来源**,不是最终成稿文字——执行者必须先 Read 素材来源里点名的具体文件,再据结构要求组织成文,不能凭空编造事实、不能照抄旧文件的行话原文。每个任务的"验收硬性检查"是机械可判定的(grep 有没有黑话残留、链接目标存不存在),内容质量的软性判断(是否讲清楚了)留给执行者判断力,但必须满足硬性检查才算过。

### Task 9: 撰写「项目介绍」域四页

**Files:**
- Create: `wiki/项目介绍/README.md`、`wiki/项目介绍/是什么与为什么.md`、`wiki/项目介绍/服务谁.md`、`wiki/项目介绍/优势与局限.md`、`wiki/项目介绍/能力概览.md`

**素材来源(执行前必须 Read):**
- 新定位原文(见 spec `docs/superpowers/specs/2026-07-13-wiki-restructure-design.md` §1 引用块):"由 MCP + Skill 赋能、拥有完善工具的、AI 文字冒险游戏(AI 当 GM、玩家扮演角色,核心服务对象是 RPG 机制——dice/sheet/rule)的、玩家与创作者双边平台"
- `docs/wiki-old/设计/01-业务与定位/安科安价是什么.md`、`问题域.md`、`用户与场景.md`、`成功标准.md`(旧定位内容,按新定位**重写**,不是直接搬——旧文件里"安价框架"式的自我描述要被新定位取代,具体哪些措辞过时以 §1 新定位原文为准判断)
- README.zh-CN.md 现有的"为什么会有它"段(F1/F2/F3 三种失败模式的**用户视角**表述,可作"是什么与为什么"页参考,但注意本页读者是所有人、不是开发者,别把 F1/F2/F3 这种编号直接甩给读者,用自然语言讲"跳骰/软着陆/替选"这三种表现)
- `docs/research/silly_tavern/架构调研/02-论文结论.md`(FG-all 0.42 vs FG-gen 0.27 那组数据出处,供"优势与局限"页引用)、`docs/research/silly_tavern/与dicelore架构对比.md`(架构哲学对比表,供同页参考)

- [ ] **Step 1: 写 `README.md`(域导航)**

一句话本域职责 + 四页各回答什么问题的小表,链去下面三页。

- [ ] **Step 2: 写 `是什么与为什么.md`**

结构:是什么(新定位原文落地,讲清楚 MCP+Skill赋能/完善工具/玩家与创作者双边平台/AI当GM+玩家角色扮演+核心服务RPG机制)→ 为什么(F1/F2/F3 三种失败模式的自然语言讲法,不出现"F1/F2/F3"编号,直接讲"跳骰子直接编结果""骰出坏结果又偷偷圆回来""该让你选却替你定了"这三种表现)→ Dicelore 的答案(agent架构/权威状态外置,不需要提"L1/L2/L3"内部编号,用"工具强制/教AI怎么当GM/事后审计"这种自然语言)。

- [ ] **Step 3: 写 `服务谁.md`**

玩家/作者/开发者三类角色各自"要解决什么问题",每类给 1-2 句 + 链去对应域入口(`../玩家指南/README.md`、`../作者指南/README.md`、`../开发指南/README.md`)。

- [ ] **Step 4: 写 `优势与局限.md`**

三段式(对比 prompt 范式 + 引 silly_tavern 调研实证 + 诚实列局限):
1. 对比表格:prompt范式(万域界式)vs dicelore(工具派)——状态住哪/谁掷骰/加能力代价/防跳骰软着陆靠什么,可参考 `与dicelore架构对比.md` 的"〇一句话画像"表格改写(不整段照搬,提炼成对普通读者友好的版本)。
2. 引用 `02-论文结论.md` 的 FG-all/FG-gen 对照数据(0.42 vs 0.27,p值等,如实引用不夸大),说明"结构化+工具"路线有实证支持。
3. 诚实列当前局限——链 `../开发指南/../../docs/dev/plan/roadmap.md`(注意此链接从 `wiki/项目介绍/` 出发到 repo 根 `docs/dev/plan/`,相对路径是 `../docs/dev/plan/roadmap.md`,只需一层 `../`,执行时用 `test -f` 核实)。文末留一句:"效果评估(token 消耗对比等)待项目跑起来后补充",不编造未发生的数据。

- [ ] **Step 5: 写 `能力概览.md`**

当下态为准,不夹带 🔭 未来态标记;结构按"玩家能做什么/作者能做什么"两小节,未来方向统一一句话链去 `../docs/dev/plan/roadmap.md`,不在本页正文散落"开发中"这类穿插注释。

- [ ] **Step 6: 验证——四页硬性检查**

Run:
```bash
grep -rn "F1\|F2\|F3\|L1\|L2\|L3\|🔭\|安价框架" wiki/项目介绍/
```
Expected: 无输出(编号黑话和旧定位措辞都不该出现在项目介绍域)。

Run:
```bash
grep -rln "../docs/dev/plan" wiki/项目介绍/ | while read f; do
  grep -on "\.\./docs/dev/plan/[a-zA-Z_.-]*" "$f" | while read link; do
    path=$(echo "$link" | sed 's|.*\.\./||')
    test -f "$path" && echo "OK: $link (in $f)" || echo "BROKEN: $link (in $f)"
  done
done
```
Expected: 全部 `OK:`,没有 `BROKEN:`。

- [ ] **Step 7: Commit**

```bash
git add wiki/项目介绍
git commit -m "docs(wiki): 新写项目介绍域四页——新定位落地+优势局限+能力概览"
```

---

### Task 10: 撰写「玩家指南」域三页(+README)

**Files:**
- Create: `wiki/玩家指南/README.md`、`wiki/玩家指南/安装与配置.md`、`wiki/玩家指南/开局与操作.md`、`wiki/玩家指南/高级设置.md`

**素材来源(执行前必须 Read):**
- `docs/wiki-old/指南/玩家指南.md`(113 行,全文——按任务阶段拆开重写,去掉散落的 🔭/进度 hedge,只写"现在能怎么做")
- 涉及"整合包🔭尚未就绪、当前走自托管+浏览器"这类进度描述——不要把这种实现状态穿插进操作步骤,操作步骤只写**当下真实可走的路径**;如果某功能确实还没实现,不写它,而不是写"这个还没做好"这种半成品提示语

- [ ] **Step 1: 写 `README.md`(域导航)**

三页各回答什么问题的小表。

- [ ] **Step 2: 写 `安装与配置.md`**

内容取原文件"1. 怎么装"+"2. 填 API key + baseURL"两节,重写成不含进度 hedge 的操作步骤(整合包/自托管两条路径均如实描述当前状态,若某条路径当前不可用就不写它,别写"未来会有")。

- [ ] **Step 3: 写 `开局与操作.md`**

内容取原文件"3. 起一局"节 + 存读档/分支/rewind/终局复盘相关操作(若原文件没写全,读 `wiki/开发指南/04-子系统设计/玩家客户端-接口.md` 的 D5/D9 决策节确认这些功能的真实当前状态,只写已落地的操作)。

- [ ] **Step 4: 写 `高级设置.md`**

spoiler 档等玩家可调设置项,取原文件相关段落(若原文件未覆盖,读 `wiki/开发指南/04-子系统设计/玩家客户端-接口.md` D8 决策节确认 spoiler 档机制后,用玩家能懂的语言描述"这个设置项是干什么的",不用"visible"这种数据层内部词)。

- [ ] **Step 5: 验证**

Run:
```bash
grep -rn "visible\|F1\|F2\|F3\|🔭\|resolver\|watcher" wiki/玩家指南/
```
Expected: 无输出(数据层内部词、失败模式编号、未来态标记都不该出现在玩家指南)。

- [ ] **Step 6: Commit**

```bash
git add wiki/玩家指南
git commit -m "docs(wiki): 新写玩家指南三页——去jargon去🔭,只写当下可操作步骤"
```

---

### Task 11: 撰写「作者指南」剩余两页(+README)

**Files:**
- Create: `wiki/作者指南/README.md`、`wiki/作者指南/构建台入门.md`、`wiki/作者指南/发布与import.md`

**Interfaces:**
- Consumes: Task 7 已创建 `wiki/作者指南/DIY自定义MCP接入.md`,本任务补齐同域另外三个文件

**素材来源(执行前必须 Read):**
- `docs/wiki-old/指南/作者指南.md`(106 行,全文)
- `wiki/开发指南/04-子系统设计/团本与manifest.md`(团本包格式,供"发布与import"页链接权威细节,不重复照抄)
- `wiki/开发指南/04-子系统设计/团本构建工具链.md`(构建台设计,供"构建台入门"页参考真实交互流程)

- [ ] **Step 1: 写 `README.md`(域导航,四页——含 Task7 的 DIY自定义MCP接入.md)**

- [ ] **Step 2: 写 `构建台入门.md`**

怎么和 lore GM 对话造团本(Adventure),取原文件相关节;深细节(manifest schema、CSV 列规范)链去 `../开发指南/04-子系统设计/团本与manifest.md`,本页只讲操作流程。

- [ ] **Step 3: 写 `发布与import.md`**

怎么把造好的团本 import 进运行库开玩,取原文件相关节;pack 格式细节链去 `../开发指南/04-子系统设计/团本与manifest.md`。

- [ ] **Step 4: 验证**

Run:
```bash
grep -rn "sqlGuard\|toolgen\|storage-port\|SessionBackend" wiki/作者指南/
```
Expected: 无输出(纯工程实现词不该出现在作者指南)。

- [ ] **Step 5: Commit**

```bash
git add wiki/作者指南
git commit -m "docs(wiki): 新写作者指南剩余两页(构建台入门/发布与import)+域README"
```

---

### Task 12: 撰写「从SillyTavern迁移」根级文件夹(玩家侧+作者侧)

**Files:**
- Create: `wiki/从SillyTavern迁移/README.md`、`wiki/从SillyTavern迁移/玩家侧.md`、`wiki/从SillyTavern迁移/作者侧.md`

**素材来源(执行前必须 Read):**
- `docs/research/silly_tavern/与dicelore架构对比.md`(全文,架构哲学对比——给作者侧概念对照用)
- `docs/research/silly_tavern/万域界结构分析.md`(全文,SillyTavern 预制团本的五层结构——给作者侧"你原来的角色卡对应我们这边什么"用)
- `docs/research/silly_tavern/架构调研/05-迁移方案.md`(机制逐项迁移映射表——**本页只借它的"映射思路",不照搬其深度工程细节**;05 页本身是给"未来做迁移工具"这个工程特性用的研究素材,不是给终端作者看的操作指南,两者的抽象层级完全不同)

**范围边界(要紧):**这两个新页面是**实用、任务导向**的迁移入门(Diátaxis 意义上的 how-to guide),**不是**深度工程映射文档(那是 `docs/research/silly_tavern/架构调研/` 已经有的东西,继续留在那)。执行者必须把"05-迁移方案.md"里 L1/L2/L3、COT Phase 拆解这类工程黑话**完全过滤掉**,只提炼"你原来这么做的,现在这么做"的对照。

- [ ] **Step 1: 写 `README.md`(分玩家侧/作者侧两个入口)**

- [ ] **Step 2: 写 `玩家侧.md`**

结构:你在 SillyTavern 熟悉的东西(人物卡/世界书/提示词控制)在 dicelore 对应什么(团本/sheet/骰子机制)+ 体验差异预期(骰子会真的让你输、GM 不会临时改剧情讨好你)。用玩家能懂的语言,不出现 L1/L2/L3、COT、regex 这类工程词。

- [ ] **Step 3: 写 `作者侧.md`**

结构:概念对照表(world book→lore、character card 设定→lore+pool、变量提取机制→sheet_update 工具)+ 具体迁移步骤(照抄你的世界观设定文字进 `lore/*.md`、机制数值整理进 `pools/*.csv`/`state/*.csv`,详细格式链 [作者指南/构建台入门](../作者指南/构建台入门.md))+ 一句"深度技术对比见 `docs/research/silly_tavern/`,面向开发者"给想深挖的人。

- [ ] **Step 4: 验证**

Run:
```bash
grep -rn "L1\|L2\|L3\|COT\|regex\|Phase [0-9]" wiki/从SillyTavern迁移/
```
Expected: 无输出。

- [ ] **Step 5: Commit**

```bash
git add wiki/从SillyTavern迁移
git commit -m "docs(wiki): 新写从SillyTavern迁移(玩家侧/作者侧),过滤深度工程黑话"
```

---

### Task 13: 撰写「预制团本说明」根级文件夹

**Files:**
- Create: `wiki/预制团本说明/README.md`

**素材来源:**
- `adventures/README.md`(确认现状:**当前 `adventures/` 目录暂无任何预制团本**,只有目录格式约定,"现暂无预制内容"是原文明确写的)

**范围调整(重要,与原 spec §7 假设不同):**原 spec 假设"按现有团本逐个补页",但核实 `adventures/` 目录**实际是空的**(无任何 `<slug>/` 子目录)——本任务**不产出任何逐团本页面**,只写一份诚实的 README 说明当前没有预制团本、格式约定在哪、未来团本发布后再逐个补页。

- [ ] **Step 1: 写 `README.md`**

```markdown
# 预制团本说明

> **本页职责**：列出随项目分发的预制团本(Adventure)。

**当前没有预制团本**——`adventures/` 目录只定了格式约定,还没有实际内容(seed 步骤待补,见 [开发指南/04-子系统设计/团本与manifest](../开发指南/04-子系统设计/团本与manifest.md))。

未来发布预制团本后,本页会逐个列出:题材、机制特点、适合什么玩家,每个团本一页。
```

- [ ] **Step 2: 验证**

Run:
```bash
test -f wiki/预制团本说明/README.md && echo OK
find adventures -maxdepth 1 -type d | grep -v "^adventures$" | wc -l
```
Expected: `OK`;第二条应为 `0`(确认现状真是空的,若不为0说明执行时 adventures/ 已经有团本了,需要回头改本页内容为逐团本列表,不能仍写"当前没有")。

- [ ] **Step 3: Commit**

```bash
git add wiki/预制团本说明
git commit -m "docs(wiki): 新写预制团本说明——如实反映adventures/目前为空"
```

---

### Task 14: 写 `wiki/README.md`(总览 Index)

**Files:**
- Create: `wiki/README.md`

- [ ] **Step 1: 写总览页,链三域 + 两个根级文件夹 + 术语表**

```markdown
# Dicelore Wiki

> 本项目的唯一权威知识库。

## 三域

| 域 | 给谁 | 回答什么 |
|---|---|---|
| [项目介绍](项目介绍/) | 所有人 | 是什么/为什么/服务谁/优势与局限/现在能做什么 |
| [玩家指南](玩家指南/) | 玩家 | 怎么装、怎么玩一局 |
| [作者指南](作者指南/) | 团本作者 | 怎么造团本、DIY 接入 |
| [开发指南](开发指南/) | 开发者 / AI | 概念/机制/架构/接口契约,涉代码的都在这 |

## 其他

- [从SillyTavern迁移](从SillyTavern迁移/) —— 从 SillyTavern 过来的玩家/作者看这里
- [预制团本说明](预制团本说明/) —— 随项目分发的团本列表
- [术语表](术语表.md) —— 全 wiki 词条单源

## 现状与计划

不在本 wiki 内——见 [`docs/dev/plan/`](../docs/dev/plan/)(里程碑/路线图/backlog 三池)。
```

- [ ] **Step 2: 验证所有链接目标存在**

Run:
```bash
for d in 项目介绍 玩家指南 作者指南 开发指南 从SillyTavern迁移 预制团本说明; do
  test -d "wiki/$d" && echo "OK: $d" || echo "BROKEN: $d"
done
test -f wiki/术语表.md && echo "OK: 术语表.md" || echo "BROKEN: 术语表.md"
test -d docs/dev/plan && echo "OK: docs/dev/plan" || echo "BROKEN: docs/dev/plan"
```
Expected: 全部 `OK:`。

- [ ] **Step 3: Commit**

```bash
git add wiki/README.md
git commit -m "docs(wiki): 写wiki根README总览Index"
```

---

## 第三部分:下游引用同步 + 收尾

### Task 15: 下游引用同步(27 个文件:`docs/wiki`→`wiki` 路径改写 + 顺手清理"05-决策记录-ADR"死概念/"06-里程碑与问题"错编号历史漂移)

背景:全仓 `docs/wiki` 引用 24 处 + 独立的"05-决策记录-ADR"死概念引用(部分与前者重叠)。这些死链接指向的真实决策内容已核实:**ADR-0028**(依赖倒置/storage-port/组合根)→`总体架构.md`「决策与权衡」节;**ADR-0025**(eval 对照系修订)→`Skills-eval.md`「决策与权衡」D1 节。

**Files(逐一列出,分四类):**

#### 15.1 纯文档引用(路径 + 措辞同步)

- [ ] **`.claude/skills/acceptance-loop/SKILL.md`**——把余下的 `../../../docs/wiki/设计/04-子系统设计/玩家客户端-接口.md`、`团本构建工具链.md`、`玩家客户端-视觉.md` 三处路径改成 `../../../wiki/开发指南/04-子系统设计/xxx.md`(去 `docs/`、去 `设计/`,插入 `开发指南/`)。

- [ ] **`.claude/skills/audit-project/SKILL.md`**——两处:(a) 第 188 行 `项目锚点：docs/wiki/03-架构/、04-子系统设计/、05-决策记录-ADR/、apps/orchestrator、packages/。` 改成 `项目锚点：wiki/开发指南/03-架构/、04-子系统设计/、决策变更日志.md、apps/orchestrator、packages/。`(05-决策记录-ADR 死概念删除,决策权威已是决策变更日志);(b) 第 132 行把 `docs/wiki/项目介绍、docs/wiki/开发指南/01-核心概念` 的 `docs/` 前缀去掉,变成 `wiki/项目介绍、wiki/开发指南/01-核心概念`。

- [ ] **`.claude/skills/play-eval/SKILL.md`**——三处:
  - 第 21 行 `[ADR-0025 修订](../../../docs/wiki/05-决策记录-ADR/README.md)` → `[Skills-eval 决策与权衡 D1](../../../wiki/开发指南/04-子系统设计/Skills-eval.md)`(ADR-0025 真身已核实,是"对照系修订"决策,住在 Skills-eval.md D1 节)。
  - 第 60 行、137 行 `[backlog-core 主题F](../../../docs/wiki/06-里程碑与问题/backlog-core.md)` → `[backlog-core 主题F](../../../docs/dev/plan/backlog-core.md)`(06 编号从未真实存在,backlog-core 已在姊妹 dev-reorg 计划迁到 docs/dev/plan)。

- [ ] **`.claude/skills/roadmap-delivery-workflow/references/fix-wiki-issues.md`**——`| 扫描范围 | `docs/wiki/`（多为文档改动 + 少量代码核对） |` 改成 `| 扫描范围 | `wiki/`（多为文档改动 + 少量代码核对） |`。

- [ ] **`.claude/skills/roadmap-delivery-workflow/references/organize-wiki.md`**——`1. **通读** `docs/wiki/`（六区：01 业务 / 02 概念 / 03 架构 / 04 设计 / 05 ADR / 06 里程碑与问题）。` 改成 `1. **通读** `wiki/`（三域:项目介绍 / 玩家指南+作者指南 / 开发指南;开发指南内 01-核心概念/02-MCP与Skill体系/03-架构/04-子系统设计）。`(原"六区"编号从未真实对应过当前结构,顺手修正)。

- [ ] **`.claude/skills/roadmap-delivery-workflow/references/refactor-backend.md`**——`[玩家客户端-接口页](../../../../docs/wiki/04-子系统设计/) §9` 改成 `[玩家客户端-接口页](../../../../wiki/开发指南/04-子系统设计/) §9`。

- [ ] **`.claude/skills/roadmap-delivery-workflow/references/refactor-frontend.md`**——同上模式,`docs/wiki/04-子系统设计/` → `wiki/开发指南/04-子系统设计/`。

- [ ] **`.claude/skills/roadmap-delivery-workflow/references/spec-to-wiki.md`**——三处:
  - `docs/wiki/05-决策记录-ADR/`(追加一条 ADR) → 改成 `对应设计页「决策与权衡」节(追加一条 details 块)`(独立 ADR 区早已撤,不该再指引"追加一条 ADR")。
  - `docs/wiki/04-子系统设计/` → `wiki/开发指南/04-子系统设计/`。
  - `docs/wiki/02-领域模型/` · `03-架构/` → `wiki/开发指南/01-核心概念/` · `03-架构/`。

- [ ] **`.github/ISSUE_TEMPLATE/config.yml`**——`https://github.com/MuLeiSY2021/Dicelore/tree/main/docs/wiki` → `https://github.com/MuLeiSY2021/Dicelore/tree/main/wiki`。

- [ ] **`.github/PULL_REQUEST_TEMPLATE.md`**——`[`docs/wiki/`](../docs/wiki/) 对应页` → `[`wiki/`](../wiki/) 对应页`。

- [ ] **`CONTRIBUTING.md`**——`代码与设计说明都在 [`docs/wiki/`](docs/wiki/)，分两域：[`指南/`](docs/wiki/指南/)（面向玩家/作者/开发者的使用者文档）+ [`设计/`](docs/wiki/设计/)（业务→领域→架构→子系统→现状的内部推导链）。**改任何代码或文档前，先对 [`术语表`](docs/wiki/术语表.md) 确认命名**` 整句改成 `代码与设计说明都在 [`wiki/`](wiki/)，分三域：[`项目介绍/`](wiki/项目介绍/)（所有人）+ [`玩家指南/`](wiki/玩家指南/)/[`作者指南/`](wiki/作者指南/)（任务向）+ [`开发指南/`](wiki/开发指南/)（涉代码的推导链）。**改任何代码或文档前，先对 [`术语表`](wiki/术语表.md) 确认命名**`。

- [ ] **`TODO.md`**——`docs/wiki/术语表.md` → `wiki/术语表.md`;`docs/wiki/设计/04-子系统设计/玩家客户端-视觉草图/` → `wiki/开发指南/04-子系统设计/玩家客户端-视觉草图/`。

- [ ] **`adventures/README.md`**——`详见 wiki [后端双路径架构 §4](../docs/wiki/04-子系统设计/后端双路径架构.md)。` 改成 `详见 wiki [后端双路径架构 §4](../wiki/开发指南/04-子系统设计/后端双路径架构.md)。`(原文缺"设计/"前缀 + 假设 wiki 在 docs/ 下,两个问题一并修正)。

- [ ] **`packages/interface/README.md`**——两处 ADR-0028 死链接,都改成指向 `wiki/开发指南/03-架构/总体架构.md`「决策与权衡」节:`[`docs/wiki/05-决策记录-ADR/README.md`](../../docs/wiki/05-决策记录-ADR/README.md) ADR-0028（决策①②③）` → `[总体架构「决策与权衡」节](../../wiki/开发指南/03-架构/总体架构.md) ADR-0028 原决策①②③`;`[ADR-0028 决策④ 组合根与生命周期](../../docs/wiki/05-决策记录-ADR/README.md)` → `[总体架构「决策与权衡」节 ADR-0028 决策④ 组合根与生命周期](../../wiki/开发指南/03-架构/总体架构.md)`。

- [ ] **`harness/src/loregm/skills/dicelore-build-pack/references/format-cheatsheet.md`**——`权威来源：`docs/wiki/04-子系统设计/团本与manifest.md`。` → `权威来源：`wiki/开发指南/04-子系统设计/团本与manifest.md`。`。

#### 15.2 顶层 README(两份,内容多处重叠,逐条处理)

- [ ] **`README.md`**——把全部 `docs/wiki/` 前缀改 `wiki/`(去 docs/);`docs/wiki/指南/` 相关三处(Player Guide/Author Guide/Developer Guide 链接)拆开改成 `wiki/玩家指南/README.md`、`wiki/作者指南/README.md`、`wiki/开发指南/README.md`(不再有单一"指南/"入口,Developer Guide 措辞按新定位调整成"开发指南");`docs/wiki/设计/决策变更日志.md` → `wiki/开发指南/决策变更日志.md`；`docs/wiki/术语表.md` → `wiki/术语表.md`；图片路径 `docs/wiki/设计/04-子系统设计/玩家客户端-视觉草图/*.png|*.html` → `wiki/开发指南/04-子系统设计/玩家客户端-视觉草图/*.png|*.html`；末尾"两域"描述句改成"三域+两个根级文件夹"描述,呼应 CONTRIBUTING.md 的改法。

- [ ] **`README.zh-CN.md`**——同 README.md 的每一类修改,中文版逐条对应处理(指南三链接、决策变更日志、术语表、图片路径、两域→三域描述)。

#### 15.3 代码里的功能性路径(必须验证,改错会破坏工具链/前端)

- [ ] **`scripts/gen-dep-graph.ts`**——`const HTML = join(REPO_ROOT, "docs/wiki/设计/03-架构/dep-graph.html")` → `const HTML = join(REPO_ROOT, "wiki/开发指南/03-架构/dep-graph.html")`。跑一次验证:

```bash
npm run gen-dep-graph 2>&1 | tail -10
```
Expected: 脚本成功读写 `wiki/开发指南/03-架构/dep-graph.html`(该文件已在 Task2 搬到位),不报"文件不存在"。

- [ ] **`frontend/src/features/home/HomePage.tsx`**——`href="/docs/wiki/指南/README.md"` → `href="/wiki/README.md"`(决策:指向总览 Index,不做二选一判断,见 spec §5.2)。

#### 15.4 代码注释(顺手修正,含 4 处已确认的 ADR-0028 死链接)

- [ ] **`backend/src/sessionBackend.ts`**——`// 见 docs/wiki/05-决策记录-ADR/README.md ADR-0028。` → `// 见 wiki/开发指南/03-架构/总体架构.md「决策与权衡」节 ADR-0028。`

- [ ] **`harness/src/index.ts`**——`// 裁决见 docs/wiki/05-决策记录-ADR/README.md ADR-0028(后果段·包级 harness↔backend 互指接受为 composition-root 边界)。` → `// 裁决见 wiki/开发指南/03-架构/总体架构.md「决策与权衡」节 ADR-0028(后果段·包级 harness↔backend 互指接受为 composition-root 边界)。`

- [ ] **`packages/interface/src/backend.ts`**——两处:`接线已定稿(ADR-0028)`(不含路径,不用改)保留;`// 见 docs/wiki/05-决策记录-ADR/README.md ADR-0028(决策②③④)。` → `// 见 wiki/开发指南/03-架构/总体架构.md「决策与权衡」节 ADR-0028(决策②③④)。`

- [ ] **`packages/interface/src/domain.ts`**——`// 见 docs/wiki/05-决策记录-ADR/README.md ADR-0028(决策②③)。` → `// 见 wiki/开发指南/03-架构/总体架构.md「决策与权衡」节 ADR-0028(决策②③)。`

- [ ] **`packages/interface/src/index.ts`**——同上模式。

- [ ] **`frontend/src/shell/Logo.tsx`**——`docs/wiki/04-子系统设计/玩家客户端-视觉草图/logo.html` → `wiki/开发指南/04-子系统设计/玩家客户端-视觉草图/logo.html`。

- [ ] **`frontend/src/styles/shell.css`**——`docs/wiki/设计/04-子系统设计/玩家客户端-视觉草图/*.html` → `wiki/开发指南/04-子系统设计/玩家客户端-视觉草图/*.html`。

- [ ] **验证(本任务收尾,处理完 15.1-15.4 全部条目后跑)**:

```bash
grep -rln "docs/wiki\|05-决策记录-ADR\|06-里程碑与问题" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs . 2>/dev/null
```
Expected: 无输出。

- [ ] **Commit**:

```bash
git add -A .claude .github CONTRIBUTING.md README.md README.zh-CN.md TODO.md adventures backend frontend harness packages scripts
git commit -m "docs(wiki): 全仓27文件同步docs/wiki→wiki路径,顺手清理05-决策记录-ADR死概念+06编号错漂移"
```

---

### Task 16: 删除 `docs/wiki-old`,全仓最终验证

**Files:** 删除 `docs/wiki-old/` 剩余内容(应该只剩空目录或已全部搬空)

- [ ] **Step 1: 确认 `docs/wiki-old` 已经空了(所有内容都搬完了)**

Run:
```bash
find docs/wiki-old -type f
```
Expected: 无输出(Task2-8 的 git mv 应该已经把所有文件搬空;若有输出,列出还剩的文件,回头确认是不是漏搬——尤其检查有没有"归档/"子目录残留,若有,按 spec §3 决定"不迁移进新wiki",直接连同 docs/wiki-old 一起删,不必先搬再删)。

- [ ] **Step 2: 删除 `docs/wiki-old` 目录**

Run:
```bash
rm -rf docs/wiki-old
git add -A docs/wiki-old
git status --porcelain docs/wiki-old
```
Expected: `git status` 无输出(目录已不存在,git 也确认清空)。

- [ ] **Step 2b: 补 stage 最初 `docs/wiki` 原路径的删除记录(这批从会话一开始就是 unstaged deletion,一直没随任何一次 commit 收进去,必须在最终收尾时一并 stage 提交,否则 `docs/wiki/*` 会在 git 历史里同时"删除未提交"又"新内容已在 wiki/ 出现",状态不干净)**

Run:
```bash
git status --porcelain docs/wiki | head -3
git add docs/wiki
git status --porcelain docs/wiki
```
Expected: 第一条列出多行 ` D docs/wiki/...`(unstaged deletion);`git add` 后第二条应全部变成 `D docs/wiki/...`(staged deletion,前面没有空格);若第一条本来就没有输出(说明这批删除已经在更早的操作里被别的会话/步骤处理掉了),后两条自然也不会有输出,不是问题。

- [ ] **Step 3: 全仓最终扫描**

Run:
```bash
grep -rln "docs/wiki\b" --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null
```
Expected: 无输出。

- [ ] **Step 4: 全部内部 wiki 链接断链检查**

Run:
```bash
for f in $(find wiki -name "*.md"); do
  dir=$(dirname "$f")
  grep -oE '\]\([^)]+\.md\)' "$f" | sed -E 's/\]\((.+)\)/\1/' | while read link; do
    case "$link" in
      http*) continue ;;
    esac
    target="$dir/$link"
    if [ ! -f "$target" ]; then
      echo "BROKEN in $f: $link"
    fi
  done
done
```
Expected: 无输出(若有 `BROKEN` 行,逐条排查——可能是某深度换算漏算,回头修对应 Task 的 sed 规则或 Edit)。

- [ ] **Step 5: typecheck + 全量测试确认代码改动没破坏语法**

Run:
```bash
npm run typecheck --silent 2>&1 | tail -25
```
Expected: 无报错。

- [ ] **Step 6: 最终确认 commit 历史 + 干净工作区**

Run:
```bash
git log --oneline -20
git status --porcelain
```
Expected: 看到本计划 Task1-16 的提交依次排开;`git status` 干净。**不 push**。

- [ ] **Step 7: 若一切通过,最终 Commit(删除动作本身)**

```bash
git commit -m "docs(wiki): 删除docs/wiki-old,新wiki(wiki/)完全接管"
```
