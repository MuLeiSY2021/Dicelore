# 宏大计划：每剧本一团本 × 50 回合长程 eval —— 交接 prompt

> **用途**：给执行 AI 的交接。目标 = 为三个真实语料剧本各搓一个**团本**，各跑 **~50 回合**长程游玩，**收集问题 → 挖根因 → 构思解法**。重点不在 skill 措辞（A 类已基本收敛），而在**长程才暴露的架构/能力缺口**（叙事脚手架：伏笔跨数十回合会否烂尾、多故事线会否缠成一团、NPC 无双层值在长局多痛……）。产出喂 `eval/findings.md` 的 B backlog → 下一设计周期。
>
> **现状**：GM 运行时 core（组件1/2/3/4）+ 玩家闸控明骰 + Skills eval-loop 工装均已合并在 main。**从 skill 看基本没问题了**（明暗骰/F1/F2/可见性 工具足够趁手、措辞迭代收敛）。本计划是去逼**架构层**的深水问题。

---

## 已有工装（直接复用，别重造）

- **faithful 驱动**：`packages/core/eval/tool.ts <db> <tool> '<jsonArgs>'` —— 对真 .db 执行一个 dicelore 工具（复用 runTool+TOOLS），**真随机掷骰/真抽样/narrate真落event/机械回显真算**。GM 经它驱动 = 真引擎，无需嵌套 claude/真 MCP。明骰无 gate→降级立即掷。
- **评分**：`eval/grade.ts <db> [--transcript <jsonl>] --scenario <id>` —— playerView（玩家视图=narrate+reveal流+面板）+ 机械断言（narrate泄漏/漏narrate/工具画像含明暗骰计数）。
- **黄金标准**：`docs/research/scraped/` 三真串（兽人冒险/抽卡/恶龙团）= 蓝本；`eval/grader.md` = 参考式定性评测规格（对标真人 GM、产 skill_fix_hints、反过拟合）。
- **分流账本**：`eval/findings.md` —— A·措辞（gm-core 可改）/ B·架构缺口（路由设计、勿提示词硬磨）。已记 6 条 B（多情节线/伏笔闭环/事件触发/分级线索/NPC双层值/GM钩子看板）。
- **教条**：`packages/core/skills/dicelore-gm-core/SKILL.md` + `dicelore-flow-*`。
- **工具入参真 schema**（速查须对齐，否则 eval/tool.ts 报 INTERNAL）：
  - `sheet_update {entity, mutations:[{attr, op, expr}]}`，op ∈ `+|-|=`（**不是 set**）
  - `sheet_list {entity, prefix?}`、`sheet_get {entity,attr}`、`sheet_show {entity,attr?}`
  - `resolve_choice {prompt, options:[{label,consequence}]}`(≥2)
  - `resolve_outcome_open|hidden {context, die, bands:[{label,min,max,consequence}]}`
  - `resolve_contest_open|hidden {context, a:{name,expr}, b:{name,expr}}`
  - `narrate {text, tags?}`、`reveal_once {target:{kind:"sheet",entity,attr}|{kind:"world_doc",rowid}}`
  - `world_search/world_sample/world_register`、`event_append {kind,content,visible?}`、`watcher_set`、`game_end {reason,outcome?}`

---

## 每个剧本要做的（兽人冒险 / 抽卡 / 恶龙团 各一遍）

### 步骤 1 · 搓团本（手搓富种子——组件5/6 import 未实现，别等）
- **精读对应真串**（`docs/research/scraped/<剧本>.md`，很大，按需读关键桥段），提炼：世界观设定、核心规则、NPC/玩家卡、卡池/随机表、预声明威胁线（Front/Clock→watcher）。
- 写一个**富种子脚本**（仿 `eval/run.ts` 的种子段，但充实得多；用 core store API：`ruleUpsert`/`sheetSetRaw`/`worldRegister`(或经 eval/tool.ts `world_register`)/`watcherSet`/`metaSet tone`），建库 + 灌团本。
- 这就是该剧本的「团本」。记录种子内容（供复现）。

### 步骤 2 · 跑 ~50 回合 faithful 长程局
- 你**兼任两角**：**玩家**（即兴、in-character、像真串里的玩家那样推进/试探/冒险）+ **GM**（严格按 gm-core + 流程 skill 主持）。
- GM 的**每个** dicelore 动作都**实际跑** `eval/tool.ts <db> ...` 拿真结果，用真结果继续。narrate 经工具落 event。
- **每 ~10 回合 checkpoint**：`eval/grade.ts` 出机械报告；记录到此为止的 narration + 工具画像；**摘要压缩**已发生剧情（防爆上下文）。这是长程任务，建议后台/长跑模式、分段推进。
- 全程**如实记下「想做但工具/架构给不了趁手支持」的每一刻**（B 信号），尤其叙事脚手架：埋的伏笔 N 回合后还记得回收吗?多条故事线追踪得过来吗?NPC 表里不一表达得了吗?

### 步骤 3 · 收集 → 挖根因 → 构思解法
对长局里冒出的**每个问题**：
1. **分流**：A·措辞（gm-core 文本可改）/ B·架构缺口（工具/抽象缺失）。
2. **挖根因**：为什么会这样?是 skill 没教、还是工具给不了、还是缺某个一等抽象?**对标蓝本**——真人 GM 在这桥段怎么不出这问题的?（`grader.md` 思路）
3. **构思解法**：A → 具体 gm-core 改句（反过拟合）；B → 新工具/新抽象/扩 watcher-Front 的**设计草案**（不写实现，给方向 + 为什么现架构不够 + 建议形态）。
4. 长程特有重点：**问题会不会随回合累积恶化**（伏笔越积越多无人回收、故事线越缠越乱）—— 这类「随规模恶化」的最值钱。

### 步骤 4 · 产出
- 每剧本一份报告：团本种子 + 50 回合关键日志摘要 + 问题清单（A/B + 根因 + 解法草案）。
- 更新 `eval/findings.md`：A 类标可改句、B 类补/细化架构缺口（带根因 + 解法方向 + 优先级）。
- **跨剧本综合**：哪些问题三剧本**反复出现** = 最高优先架构工作；哪些是单剧本特例。

---

## 纪律
- **faithful**：一切裁决/随机经 `eval/tool.ts` 真引擎，**不凭空假设结果**；玩家视图只认 narrate+reveal+面板。
- **对标蓝本**：「好/坏」锚定真人安价实践（三真串），非凭空断言。
- **B 不提示词硬磨**：架构缺口给设计草案、路由 backlog，**别往 gm-core 硬塞**（低效甚至无解——这是本计划的核心认知）。
- **A 反过拟合**：措辞改建要能泛化，不是只补本剧本特例。
- **如实**：别为「看起来对」修饰 GM 行为；问题越真越值钱。

---

## 起手提示词（复制以下整段给执行 AI）

```
为 dicelore 跑「每剧本一团本 × ~50 回合长程 eval」,目标是逼出长程才暴露的架构/能力缺口(叙事脚手架),不是磨 skill 措辞(那已基本收敛)。先读:
- packages/core/eval/findings.md(A/B 分流账本,已有 6 条 B)、eval/grader.md(对标语料评测)、eval/tool.ts + grade.ts(faithful 工装用法)
- packages/core/skills/dicelore-gm-core/SKILL.md + dicelore-flow-*(GM 教条,你主持要严格遵守)
- docs/research/scraped/ 三真串(兽人冒险/抽卡/恶龙团 = 黄金标准蓝本)
- docs/wiki/04-子系统设计/{团本与manifest,团本构建工具链}.md(团本应含什么;但 import 未实现,你手搓富种子)

对三个剧本各做一遍:① 精读真串→手搓富种子脚本(仿 eval/run.ts 种子段但充实:world/rule/NPC卡/卡池/Front-watcher,用 core store API 或 eval/tool.ts world_register)建该剧本团本;② 兼任即兴玩家 + 严格按 gm-core 的 GM,跑 ~50 回合 faithful 局——GM 每个动作实跑 `npx tsx eval/tool.ts <db> <tool> '<json>'`(cwd=packages/core)拿真结果继续,narrate 经工具落 event,每 ~10 回合 grade.ts 出报告 + 摘要压缩防爆上下文(长跑/后台/分段);③ 对每个问题:分流 A(措辞)/B(架构),挖根因(为什么?对标真人 GM 怎么不出此问题),构思解法(A=gm-core 改句反过拟合;B=新工具/抽象设计草案,不写实现);④ 出每剧本报告 + 更新 findings.md + 跨剧本综合(反复出现的 = 最高优先架构工作)。

纪律:faithful(经 eval/tool.ts 真引擎、不凭空假设);对标蓝本;B 类绝不往 gm-core 硬塞、只给设计草案路由 backlog;A 类反过拟合;如实别美化。工具入参真 schema 见 findings.md/本 todo(注意 sheet_update op 是 +|-|=)。50 回合是长程任务,checkpoint + 摘要推进。
```

---

## 注意（给执行 AI 的现实提醒）
- **规模**：50 回合 × 每回合多次 `eval/tool.ts` = 数百次进程 + 大量 token + 上下文压力。务必 checkpoint、摘要、分段；视情用后台/长运行模式。
- **嵌套 claude 不可用**：别试 `claude -p --dangerously-skip-permissions`(会被权限挡)。faithful 靠 `eval/tool.ts` 真引擎 + 你自己兼任 GM/玩家,足够。
- **团本 import 缺位**：你手搓的富种子**就是**该剧本团本;若顺手发现「手搓很痛」也是一条 finding（指向组件5/6 import 优先级）。
- **预期产出主要是 B**：从 skill 看已没大问题,所以长程暴露的多半是架构缺口——这正是要的。
