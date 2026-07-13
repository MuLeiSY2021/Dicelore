# 设计文档:`docs/dev` 目录整理——delivery 改名容器、05 区改英文名迁出、tdd/todo/reports 归拢

> 状态:brainstorming 产出,待用户复核。与 [`2026-07-13-wiki-restructure-design.md`](2026-07-13-wiki-restructure-design.md) 是姊妹 spec——后者把 `设计/05-现状与计划` 从 wiki 里搬出来的落点,就是本 spec 定的新家。两份 spec 有共享的下游引用文件,实现时要合并成一次编辑,见 §6.4。

## 1. 背景

写 wiki 重构 spec 时发现:用户已经手动把 `docs/wiki/设计/05-现状与计划/` mv 到 `docs/delivery/05-现状与计划/`(未 commit)。追问后确认——这块内容(里程碑/路线图/backlog 三池/裁决记录/eval 报告)性质是**长存、持续维护的现状追踪**,和 `delivery/`"一轮一目录、跑完即成历史"的临时性正相反,不该塞进 `delivery/` 内部,需要一个新的、跟 `delivery/` 平级的家。

顺带发现 `docs/` 顶层还散落着 `tdd/`(验收测试记录)、`todo/`(在途交接)、`reports/`(eval 原始报告)——这几个和"05 区"、"delivery 运行记录"其实是同一大类:**开发过程留痕**,不是长存知识(那部分是 `wiki/` 和 `research/`)。用"delivery"当整个大类的容器名不准确,改名 `dev` 更贴切。

## 2. 新结构

```
docs/
├── dev/                                  ← 新容器,装一切"开发过程产物"
│   ├── delivery/                         ← 收窄回本义:一轮一目录的交付 DAG 跑批记录
│   │   ├── README.md                     ← 原 docs/delivery/README.md,末尾"和 wiki 的分工"段修订(见 §4)
│   │   ├── 2026-06-30-路线图-推进/        ← 历史轮次,原样搬,内部链接不改(见 §5)
│   │   ├── 2026-07-02-transcript-datadir-buildeval/
│   │   ├── 2026-07-02-路线图-推进/
│   │   └── 2026-07-10-路线图-推进/
│   ├── plan/                             ← 原"05-现状与计划",与 delivery/ 平级(不是它的子集),内部文件改英文名
│   │   ├── README.md
│   │   ├── milestones.md                 ← 原 里程碑.md(人工维护铁律不变,AI 不擅自改正文)
│   │   ├── roadmap.md                    ← 原 路线图.md
│   │   ├── backlog-frontend.md           ← 原 backlog-前端.md
│   │   ├── backlog-backend.md            ← 原 backlog-后端.md
│   │   ├── backlog-core.md               ← 不变(已是英文)
│   │   ├── decisions/                    ← 原 裁决记录/(内部各文件名已是英文,不变:custom-mcp-install.md 等)
│   │   └── eval-reports/                 ← 原 eval报告/
│   ├── tdd/                              ← 原 docs/tdd/ 原样搬入,不改名
│   ├── todo/                             ← 原 docs/todo/ 原样搬入,不改名
│   └── reports/                          ← 原 docs/reports/ 原样搬入,不改名
├── research/                             ← 不动(长存调研知识,"从SillyTavern迁移"wiki页要引用这里)
├── superpowers/                          ← 不动(brainstorm/plan 草稿,用完即删,生命周期比其他几个短得多)
└── wiki-old/                             ← 走姊妹 spec 处理,不在本 spec 范围内
```

## 3. 重命名对照表

| 旧路径 | 新路径 |
|---|---|
| `docs/delivery/05-现状与计划/README.md` | `docs/dev/plan/README.md` |
| `docs/delivery/05-现状与计划/里程碑.md` | `docs/dev/plan/milestones.md` |
| `docs/delivery/05-现状与计划/路线图.md` | `docs/dev/plan/roadmap.md` |
| `docs/delivery/05-现状与计划/backlog-前端.md` | `docs/dev/plan/backlog-frontend.md` |
| `docs/delivery/05-现状与计划/backlog-后端.md` | `docs/dev/plan/backlog-backend.md` |
| `docs/delivery/05-现状与计划/backlog-core.md` | `docs/dev/plan/backlog-core.md`(纯移动,文件名不变) |
| `docs/delivery/05-现状与计划/裁决记录/*` | `docs/dev/plan/decisions/*`(纯移动,内部文件名不变) |
| `docs/delivery/05-现状与计划/eval报告/README.md` | `docs/dev/plan/eval-reports/README.md` |
| `docs/delivery/README.md` + 4 个历史轮次目录 | `docs/dev/delivery/`(纯移动,不改名不改内部链接) |
| `docs/tdd/*` | `docs/dev/tdd/*`(纯移动) |
| `docs/todo/*` | `docs/dev/todo/*`(纯移动) |
| `docs/reports/*` | `docs/dev/reports/*`(纯移动) |

## 4. 内容修订(不只是搬家)

- **`docs/dev/delivery/README.md`**(原 `docs/delivery/README.md`)末尾"和 wiki 的分工"一段写着"决策的「最终是什么」进 ADR/wiki"——`ADR` 是遗留死概念(独立 ADR 区早被撤了,见姊妹 spec §5.3 挖到的同一个坑,`git log -S "ADR-0028"` 可查),顺手改成"进 wiki(对应设计页「决策与权衡」节)"。同时补一句说明:现在 `docs/dev/` 下 `delivery/` 只管交付批次运行记录本身,`plan/`(现状与计划,长存)、`tdd/`、`todo/`、`reports/` 是平级的兄弟目录,不要把"delivery"泛化成整个 `dev/` 的代称。
- **`docs/dev/plan/README.md`**(原 `05-现状与计划/README.md`)——检查内部是否有"05""编号"这类自称(它原来是 wiki 01→05 推导链的第 5 环,现在挪出 wiki 后不再需要编号定位自己),按新身份改写导言。

## 5. 历史交付记录保持原样

`docs/dev/delivery/` 下已有的 4 个历史轮次目录(`2026-06-30-路线图-推进`、`2026-07-02-transcript-datadir-buildeval`、`2026-07-02-路线图-推进`、`2026-07-10-路线图-推进`)内部链的旧路径(如指向 `docs/wiki/设计/05-现状与计划/里程碑.md` 的引用)**保持原样,不跟着改**——这些文件是历史快照,记录的是"那一刻真实发生了什么",不为了让链接保持可点击而回头篡改历史记录。只搬目录位置(`docs/delivery/` → `docs/dev/delivery/`),不改目录内任何文件的内容。

## 6. 下游引用联动

全仓搜索命中的文件,分四类:

### 6.1 skill 文件(路径 + 概念表述都要改,依赖最深的一类)

- **`.claude/skills/idea-to-roadmap/SKILL.md`** —— description 和正文明确写"只动 `docs/wiki/设计/05-现状与计划`(+已定型时的裁决记录)"、多处 `[里程碑.md](../../../docs/wiki/设计/05-现状与计划/里程碑.md)` 这类相对路径链接。改成指向 `docs/dev/plan/milestones.md` 等新路径,措辞里"只动 docs/wiki/设计/05-现状与计划"改成"只动 docs/dev/plan"。
- **`.claude/skills/roadmap-delivery-workflow/SKILL.md`** —— 对 05 区运作机制(裁决闸「路线图需求进波前必须在裁决记录/有经批准的裁决文件」、批量沉淀时机、`里程碑.md`/`路线图.md` 人工维护铁律)依赖最深,逐处路径替换后要重读一遍确认语义没破(尤其"沉进 wiki"这类表述——05 区内容本身不进 wiki 了,只有"决策结论"沉设计页,"现状"沉 `docs/dev/plan`,这两件事描述时不能再混叙)。
- **`.claude/skills/roadmap-delivery-workflow/references/advance-milestone.md`**、`organize-wiki.md`、`refactor-backend.md`、`refactor-frontend.md`、`spec-to-wiki.md` —— 各自引用 `里程碑.md`/`backlog-后端.md`/`backlog-前端.md` 等,路径 + 文件名一并改。
- **`.claude/skills/audit-project/SKILL.md`** —— 引用"路线图 + backlog 三池 + 里程碑"和具体文件名,同上处理。
- **`.claude/skills/acceptance-loop/SKILL.md`** 及其 `references/interface-and-tests.md` —— 引用"裁决记录/""backlog-后端/backlog-前端"这类概念性提法(部分是完整路径、部分是纯文本提及),按新命名同步。

### 6.2 顶层文档

`/CLAUDE.md`、`README.md`、`README.zh-CN.md`、`CONTRIBUTING.md`、`SECURITY.md` —— 这几个文件同时出现在姊妹 spec(wiki 路径)和本 spec(dev 路径)的清单里,**实现时对同一文件的两类改动要合并成一次编辑**,不要分两轮改。

### 6.3 生产代码注释(纯文本提及,非完整路径,风险最低)

- `backend/src/api/diagnostics.ts:44`、`backend/src/api/lore.ts:61`、`backend/src/api/lore.test.ts:693`、`backend/src/store/turnRollback.ts:15`、`harness/src/dicegm/turnLoop.ts:58` —— 各处只是提到"backlog-后端"或"backlog-前端"这两个词作为标签(不含完整路径),直接文本替换成"backlog-backend"/"backlog-frontend"。

### 6.4 与姊妹 spec(wiki 重构)的重叠提醒

`CLAUDE.md`、`README.md`、`README.zh-CN.md`、`.claude/skills/audit-project/SKILL.md`、`.claude/skills/idea-to-roadmap/SKILL.md`、`.claude/skills/roadmap-delivery-workflow/SKILL.md` 及其 5 个 `references/` 文件——这些文件在姊妹 spec §5 和本 spec §6 都出现。执行顺序建议:**先做本 spec(docs/dev 整理),再做 wiki 重构**,因为 wiki 重构里"开发指南"域的内容会引用 `docs/dev/plan/` 的新路径(比如"能力概览.md"链去"现状与计划"就该直接链新路径,不必先链旧路径再改一次)。若两份 plan 分别执行,处理这些重叠文件时对照另一份 spec 的清单,一次改完两类路径,不要来回两轮编辑。

## 7. 范围边界(本轮不做)

- 不重新设计 `roadmap-delivery-workflow` 的三段式流程本身(决策账本/DAG 切分/worktree 隔离/裁决闸),只改它引用的路径与文件名,流程逻辑不动。
- `docs/research/`、`docs/superpowers/` 不动——前者是长存调研知识,后者生命周期极短、不需要归进 `dev/`。
- 不追溯修改 `docs/dev/delivery/` 下历史轮次目录的任何文件内容(见 §5)。
