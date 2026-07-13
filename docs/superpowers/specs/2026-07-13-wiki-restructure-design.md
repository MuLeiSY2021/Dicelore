# 设计文档:wiki 重构——从 `docs/wiki/` 迁到根 `wiki/`,三域重切

> 状态:brainstorming 产出,待用户复核。下一步 → writing-plans。
> 与 [`2026-07-13-docs-dev-reorg-design.md`](2026-07-13-docs-dev-reorg-design.md) 是姊妹 spec——本文档写作过程中发现"05-现状与计划"应整体迁出 wiki、归 `docs/dev/plan/` 永住,不再是本 wiki 的一个桶,已在本次修订中拿掉,详情见姊妹 spec。建议**先执行姊妹 spec(docs/dev 整理),再执行本 spec**,因为下面「开发指南」域链去现状与计划的地方要直接指向 `docs/dev/plan/` 的新路径。

## 1. 背景与问题诊断

当前 `docs/wiki/`(本文档写作时已被作者手动 `mv` 成 `docs/wiki-old/`,未 commit)存在四个叠加的问题:

1. **内容与代码现状脱节**——尤其 05-现状与计划 之外的页面,进度描述与实现有偏差。
2. **读者定位错了,行话太重**——"指南"域本应给玩家/作者/开发者三类使用者看,但页面里混了大量内部推导词(F1/F2/F3、L1/L2/L3、resolver 分类)和 🔭 未来态标记,新读者读不懂、也分不清"现在能用"和"规划中"。
3. **结构本身太复杂,不适合新读者**——"指南 / 设计"两域 + 设计域 01→05 编号推导链,是给 AI 维护者用的强约束,但顶层入口没有跟真正的新人分开。
4. **项目定位变了,旧结构从最上游就站不住**——dicelore 不再只是"安价框架",新定位是:

   > 由 MCP + Skill 赋能、拥有完善工具的、AI 文字冒险游戏(AI 当 GM、玩家扮演角色,核心服务对象是 RPG 机制——dice / sheet / rule)的、玩家与创作者双边平台。

   品类词本身不变(ADR-0022 的"文字冒险游戏"仍站得住),变的是**项目怎么描述自己**——MCP + Skill 原来是深埋在"04-子系统设计"里的实现细节,现在是定位层面的核心识别特征,不该在推导链第 4 层才第一次出现。

## 2. 设计原则(纪律留,桶重切)

**保留**(与项目定位无关的工程纪律):
- 单向推导:下游页只引用上游页。
- 单源:一件事只在一处是权威(术语表 / backlog / 决策节)。
- 一页一职责:每页开头一句"本页职责"。

**重切**:原"指南 / 设计"两域拆成三域,拆分轴不再是"使用者 vs 维护者",而是"**是否需要碰代码/理解架构**":

| 域 | 回答什么 | 给谁 | 会不会涉及代码/架构 |
|---|---|---|---|
| 项目介绍 | 是什么/为什么/服务谁/优势与局限/现在能做什么 | 所有人(入口) | 不涉及 |
| 玩家指南 / 作者指南 | 怎么装、怎么点、怎么造团本——纯任务操作 | 玩家 / 作者(内容创作者) | 不涉及 |
| 开发指南 | 概念/机制/架构/接口契约(现状与计划已迁出,见 §3 附注) | 开发者 / AI 维护者 | 涉及 |

原"作者"与"开发者"曾经被一起塞进"指南"域,现在明确拆开:作者是内容创作者(不碰代码),开发者是要懂架构接口的角色,后者连同原"开发者指南.md"里的接口规范/pack 格式/hook 契约整段并入「开发指南」域,不再归「指南」性质的域。

## 3. 新目录结构

```
wiki/
├── README.md                    ← Index 总览,链三域入口
├── 术语表.md                     ← 跨三域共享词汇单源(不归属某一域)
├── 从SillyTavern迁移/            ← 根级,服务从 SillyTavern 迁移过来的玩家与作者
│   ├── README.md
│   ├── 玩家侧.md                 ← 概念对照(人物卡/世界书/提示词控制 → dicelore 的团本/sheet/骰子机制)+ 体验差异预期
│   └── 作者侧.md                 ← world book/character card → dicelore 团本/sheet/rule 的内容迁移步骤
├── 预制团本说明/                 ← 根级,团本(Adventure)目录
│   ├── README.md                 ← 团本总览表
│   └── <逐团本一页>               ← 随团本数量增加逐步补充,每页:题材/机制特点/适合什么玩家
│
├── 项目介绍/                     ← 域一:所有人入口,不谈实现
│   ├── README.md
│   ├── 是什么与为什么.md          ← 新定位落地文本(见 §1 引用块)
│   ├── 服务谁.md                  ← 玩家/作者/开发者三类角色分流,链去对应域
│   ├── 优势与局限.md              ← 对比 prompt 范式 + 引 silly_tavern 对比调研实证(FG-all 0.42 vs FG-gen 0.27,见 docs/research/silly_tavern/)+ 诚实列当前局限,链 `docs/dev/plan/roadmap.md`;文末留一句"效果评估(token 消耗对比等)待项目跑起来后补充",不编造未发生的数据
│   └── 能力概览.md                ← 当下态为准,不夹带 🔭 未来态;未来去向统一链去 `docs/dev/plan/roadmap.md`
│
├── 玩家指南/                     ← 域二·玩家侧,按任务阶段拆,不碰代码
│   ├── README.md
│   ├── 安装与配置.md              ← 怎么装(整合包/自托管)、填 key + baseURL
│   ├── 开局与操作.md              ← 起一局、存读档、分支/rewind、终局复盘
│   └── 高级设置.md                ← spoiler 档等
│
├── 作者指南/                     ← 域二·作者侧,不碰代码
│   ├── README.md
│   ├── 构建台入门.md              ← 和 lore GM 对话造团本(Adventure)
│   ├── 发布与import.md
│   └── DIY自定义MCP接入.md        ← "怎么接入"的操作步骤;接口契约细节链去开发指南
│
└── 开发指南/                     ← 域三:给开发者 + AI,涉代码的都在这
    ├── README.md                 ← 01→04 推导链导航
    ├── 01-核心概念/               ← 领域模型:GM/角色扮演前提、四业务域(sheet/event/world/rule)、resolver 体系——纯概念词汇,不含机制实现细节
    ├── 02-MCP与Skill体系/         ← 新升格顶层区:工具面清单(原"MCP工具面.md")+ Skill 分层机制(原"Skills包.md")+ 原"三层约束"(L1 工具强制/L2 塑形教条/L3 审计——这套本质是 MCP+Skill 怎么落地保证机制不被绕过的描述,整段从"核心概念"搬来这里)
    ├── 03-架构/                   ← 组件/数据流/技术选型/跨 agent 适配
    ├── 04-子系统设计/             ← 剩余具体子系统:各端客户端、后端双路径、团本构建工具链;新并入原"开发者指南.md"的接口规范/pack 格式/hook 契约/storage-port
    └── 决策变更日志.md            ← 薄索引(时间线),决策详情继续内嵌各设计页「决策与权衡」节
```

不再保留"归档/"子目录——旧历史决策原文不迁移进新 wiki;`docs/wiki-old` 删除前 git log 里可查到原文,需要时直接翻历史,不在新 wiki 占位。**不再保留"05-现状与计划"这一桶**——它已整体迁出 wiki、永住 `docs/dev/plan/`(见姊妹 spec),开发指南域凡是要链"现状与计划"的地方,直接指向 `docs/dev/plan/roadmap.md` 等新路径,不在 wiki 内重复维护。

## 4. 内容迁移三原则

| 原则 | 适用范围 | 处理方式 |
|---|---|---|
| **直接搬** | 04-子系统设计的技术细节、决策变更日志 | 原样搬到新路径,内部链接改路径前缀 |
| **迁出不进 wiki** | 05-现状与计划(里程碑/路线图/backlog 三池/裁决记录/eval 报告) | 不进新 wiki,永住 `docs/dev/plan/`(见姊妹 spec `2026-07-13-docs-dev-reorg-design.md`);wiki 内所有指向它的链接改指 `docs/dev/plan/` 新路径 |
| **按新定位重写** | 原"01-业务与定位"→拆进「项目介绍」域各页;原"02-领域模型"里的三层约束(L1/L2/L3)→搬进「02-MCP与Skill体系」;玩家/作者指南全篇 | 按 §1 新定位内容重写,去掉与代码状态耦合的 jargon 和散落 🔭 标记(未来态统一收口到能力概览,链去 `docs/dev/plan/roadmap.md`) |
| **精简** | 术语表 | 砍掉纯内部实现黑话词条(F1/F2/F3 这类失败模式分类、纯代码层命名收编记录),只留三域读者跨页会真正碰到的词;被砍词条如仍有价值,移入对应设计页或 backlog,不在术语表重复维护 |

## 5. 下游引用联动(本轮一并改完)

初版设计只搜了 `.claude/skills/`,遗漏了大半——全仓 `grep -rl "docs/wiki"`(排除 `node_modules`/`.git`/`docs`)实际命中 **32 个文件**,分三类,处理方式不同:

### 5.1 纯文档引用(路径字符串直接替换 + 描述性文字同步)

路径 `docs/wiki` → `wiki`,且要检查"指南/设计两域"这类描述性文字是否需要同步改成"项目介绍/玩家指南/作者指南/开发指南"四路径描述,不能只换路径不换措辞:

- `/CLAUDE.md`(项目工作流契约)
- `README.md`、`README.zh-CN.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `TODO.md`
- `adventures/README.md`
- `packages/interface/README.md`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `harness/src/loregm/skills/dicelore-build-pack/references/format-cheatsheet.md`
- `.claude/skills/audit-project/SKILL.md`
- `.claude/skills/idea-to-roadmap/SKILL.md`
- `.claude/skills/play-eval/SKILL.md`
- `.claude/skills/acceptance-loop/SKILL.md`
- `.claude/skills/roadmap-delivery-workflow/SKILL.md`
- `.claude/skills/roadmap-delivery-workflow/references/organize-wiki.md`
- `.claude/skills/roadmap-delivery-workflow/references/fix-wiki-issues.md`
- `.claude/skills/roadmap-delivery-workflow/references/refactor-frontend.md`
- `.claude/skills/roadmap-delivery-workflow/references/advance-milestone.md`
- `.claude/skills/roadmap-delivery-workflow/references/refactor-backend.md`
- `.claude/skills/roadmap-delivery-workflow/references/spec-to-wiki.md`

### 5.2 代码里的功能性路径(改错会破坏工具链/前端,必须验证)

- **`scripts/gen-dep-graph.ts:44`** —— `const HTML = join(REPO_ROOT, "docs/wiki/设计/03-架构/dep-graph.html")`,依赖图生成脚本的真实读写路径。改成 `wiki/开发指南/03-架构/dep-graph.html`,且要确认该 html 文件本身随迁移一起搬过去(它是"直接搬"类内容,原样带过去)。
- **`frontend/src/features/home/HomePage.tsx:81`** —— 首页"查看手册"链接 `href="/docs/wiki/指南/README.md"`,真实用户会点。新结构里已经没有单一"指南/README.md"入口(拆成了「玩家指南/」「作者指南/」两个独立顶层)——**决策:改指向 `/wiki/README.md`(总览 Index)**,让用户从 Index 自己分流到玩家/作者指南,不在首页链接层面做二选一判断。

### 5.3 代码注释里的引用(顺手修正,含一个更早就存在的坏链接)

以下文件的注释引用 `docs/wiki`,不影响运行,但会误导以后读代码的人,顺手改成新路径对应位置:

- `backend/src/sessionBackend.ts:18`、`harness/src/index.ts:21`、`packages/interface/src/backend.ts:21`、`packages/interface/src/domain.ts:17`、`packages/interface/src/index.ts:12` —— 这五处全部指向 `docs/wiki/05-决策记录-ADR/README.md` ADR-0028。**这个路径在当前 `docs/wiki-old` 里根本不存在**——`git log -S "ADR-0028"` 能翻到提交 `acba494 docs(wiki): 彻底清除全 wiki「ADR」字样——归档已撤,决策唯一权威=设计页决策节`,说明独立 ADR 区早就被撤了,ADR-0028(依赖倒置建 storage-port / 组合根按会话注入 / 包级 harness↔backend 互指裁决——决策②③④)的原文现在就活在 `设计/03-架构/总体架构.md`「决策与权衡」节里,只是这五处注释没跟着改,一直挂了个死链接。本轮把这五处注释精确改成指向 `wiki/开发指南/03-架构/总体架构.md`「决策与权衡」节,不再是"改成新的坏路径"。
- `frontend/src/shell/Logo.tsx:11`、`frontend/src/styles/shell.css:2` —— 指向 `docs/wiki/04-子系统设计/玩家客户端-视觉草图/...`(缺"设计/"前缀,同样是旧坏链接的变体)。改成 `wiki/开发指南/04-子系统设计/玩家客户端-视觉草图/...`。

处理 5.3 时先确认这些注释指向的源文件(视觉草图 html、ADR-0028 原文)本身在迁移后确实落在新路径对应位置,再改注释,不要把注释改"对"了但目标文件其实没搬过去。

## 6. 旧 wiki 的收尾

`docs/wiki-old/` 在新 `wiki/` 内容迁移完成、下游引用全部改完并验证不断链后,**整体删除**。删除前它未 commit,git log 里本来就没有独立历史;若日后需要找回旧原文,只能靠本次迁移前的工作区状态或用户本机备份——**执行迁移前应确认这一点不是问题**(旧内容对应的 git 历史仅存在于更早的 `docs/wiki/` 提交记录里,那部分历史不受这次操作影响)。

## 7. 范围边界(本轮不做)

- 不在本轮做"效果评估/token 消耗对比"的实际测试——只在「优势与局限」页留一句待补充说明,数据留待项目跑起来后再议。
- 不在本轮重新讨论 ADR-0022 的品类词决策——本次只是把"MCP+Skill赋能"这个新增识别特征补进定位描述,不动"文字冒险游戏"这个品类词本身。
- 「预制团本说明/」的逐团本页面内容(每个团本具体怎么写)不在本设计文档展开,只定骨架(README + 逐团本页),具体内容留给实现阶段按现有团本(`adventures/` 目录)逐个补。
