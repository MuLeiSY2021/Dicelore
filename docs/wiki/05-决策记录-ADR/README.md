# 决策记录（ADR）

> **本页职责**：追加式记录"为什么这么选"。每条 = 背景 / 决策 / 后果。只记**已接受**的决策；待定的列在文末"待决策"。
> **上游依赖**：无（横切全项目）。

---

## ADR-0001 废弃旧 Phase 2（5 场景工具 + 代码强制范式）

- **背景**：旧设计把"范式"做成代码枚举、用更多 MCP 工具去约束 AI。这是在 L1（结构强制）加码，而项目真正缺的是 L2（流程引导）。
- **决策**：删除 5 个场景驱动工具与代码范式系统；范式降级为 Skill 里的教学词汇。
- **后果**：重心从"加工具"转向"造 Skill"。已在 git 历史与 2026-05-29 spec 落地。

## ADR-0002 行为塑形三层模型（数据 / 行动 / 塑形）

- **背景**：设计一度"零碎混乱"，根因是三个层被同时设计。
- **决策**：明确分三层，一次只设计一层；下游引用上游，不反向。
- **后果**：成为 [核心概念](../02-领域模型/核心概念.md) 与本 wiki 的组织主轴。

## ADR-0003 数据层按访问模式分三存储，v1 不上 ML

- **背景**：纠结"结构化 vs KV"原地打转；又有上 MongoDB/RAG/embedding 的冲动。
- **决策**：按**访问模式**分状态/事件/剧本三表；**agent 即引擎**，v1 只用 SQLite（KV+FTS5），语义召回/世界设定理解隔离为 spike。
- **后果**：复杂度可控；两个研究级难题不拖死主线。

## ADR-0004 业务驱动重新设计，旧 spec / 代码降级为历史输入

- **背景**：现有代码与早期 spec 是边想边写的产物，结构不够缜密。
- **决策**：架构从业务分析**重新推导**，允许与现有代码分歧；旧 spec/代码进 [99-历史输入](../99-历史输入/)，只作参考。
- **后果**：获得干净的推导链；现有代码按新架构择优复用，而非被它锚定。

## ADR-0005 数据层重构为四业务域（部分取代 ADR-0003）

- **背景**：ADR-0003 按"访问模式"分三存储（状态/事件/剧本）。设计推进暴露两问题：① world（作者世界底料）与 rule（绑住 GM 的规则合同）业务上完全不同，却被糊成一张"剧本表"；② "剧本表只读"假设过强——语料显示 GM 会运行期现编世界内容、规则也需热更新。
- **决策**：数据层一级轴改为**四业务域**（sheet / event / world / rule）；ADR-0003 的"访问模式"降为**二级轴**（每域怎么 CRUD）。world 可写（作者灌注 + GM 现编）；rule 只由**人类**写（作者版本化 + 团主/管理员实时），**AI 对 rule 只读**——让被规则卡住的 AI 能改规则 = 给讨好本能松绑。
- **后果**：取代 ADR-0003 的"三存储"部分；"agent 即引擎、v1 不上 ML"不变。落地见 [核心概念 §2](../02-领域模型/核心概念.md) 与 [总体架构](../03-架构/总体架构.md)。

## ADR-0006 全栈语言由 Python 改为 TypeScript

- **背景**：v1 初定 Python 全栈，头号理由是"复用现有 Python 代码"。重估发现：现有代码里 `anko_db` schema 本就要按四业务域重写、两个 MCP server 本就要重建，真正可复用的只有 trivial 的掷骰引擎。同时 mcp-builder 官方推荐 TS（SDK 一等公民、强类型、MCPB 打包、生成质量），且路线图的多人远程（Streamable HTTP）是 TS 主场。
- **决策**：切**全栈 TypeScript**（Core + MCP + 团本生成器）；数据层用 `better-sqlite3`（原生 FTS5）。趁"从零重建 MCP"的节点切，成本最低。维护者 TS / Python 均在学习中，学习成本对等。
- **后果**：放弃 trivial 的 Python dice 引擎（移植成本极小）；未来多人远程不必换语言；Skills（markdown）不受影响。落地见 [技术选型 §1](../03-架构/技术选型.md)。

## ADR-0007 状态骰下沉：`roll_value` 并入 `sheet_update`

- **背景**：[总体架构](../03-架构/总体架构.md) §4 原把"状态骰"（骰子±sheet 数值→写回）做成独立掷骰工具 `roll_value`。但 [核心概念 §3.1](../02-领域模型/核心概念.md) 早有洞察——"状态骰不是独立子系统，是 sheet 域的读写器"；且一回合的状态变更往往是 entity 作用域的**一批**（掉血 + 得物 + 升级），拆成多次 `roll_value`/`sheet_set` 既啰嗦又丢"一拍"的原子性。
- **决策**：砍独立 `roll_value`；状态骰**下沉**为数据写工具 `sheet_update` 的"带骰形态"——一次 entity 批量写 `[{attr, op, expr}]`，带骰项在**引擎内掷**（保 anti-F1），整批原子，账本每项标 `rolled | set`。`sheet_set` 一并并入（= 只含 `=` 的批次）。
- **后果**：更贴核心概念 §3.1；缩工具面（独立裁决工具 4→3）；mcp 上属 **workflow tool**（对 mcp-builder"默认铺满细粒度 API"的有意背离，理由是塑形要工具受控）。**代价**：原 `roll_value` 工具名"逼 AI 分辨该掷还是该设"的 L1 结构摩擦消失，降级为 L2 教 + L3 抓（靠账本 `rolled/set` 标记）——方向与 [02 §4](../02-领域模型/核心概念.md) 矩阵一致（F3 主力靠教）。**被否**：维持三骰独立工具。落地见 [总体架构 §4.2](../03-架构/总体架构.md)、[内层能力库 §4](../04-子系统设计/内层能力库.md)。

## ADR-0008 定位重述：从"可嫁接任意 agent"到"易分发 + 骑 Claude Code"

- **背景**：01 / 技术选型 / 跨agent 原把"**可嫁接任意 agent** + L3 hook 可选优雅降级"当立身卡位。重估真实优先级后发现这是把**手段误当目的**：真正要的是 ① 开源**可分发性高**（本机直接玩到）② **低安装成本**（别好几 G、最好一键）③ **开发成本可控**，在此之上**最大化塑形效果**——为不需要的可移植性做工程，反而牺牲效果与开发成本。
- **决策**：**可移植不再是目标**。v1 **骑定 Claude Code 作 agent 基底**（原生 skill / hook / MCP / subagent，正是塑形要用的原语）；**core 产物（MCP / Skill / SQLite / 团本）保持标准、不锁死**；交付机制（hook 注入、subagent 裁判、skill 装载）**明确绑 Claude Code 且承重**。"可接入各种大模型"在**模型层**兑现（Claude Code 本身 model-agnostic，含国产）。分发 = npm 包 + `dicelore` CLI、跨端（Win/Mac/Linux）预编译；未来 GUI 取代终端。
- **后果**：hook 从"可选 L3 优化"升为**承重机制**（被动 rule 召回 + timer 到期都靠它）；**翻掉**旧"绝不让核心依赖某 agent 专属能力"红线。与 AI Dungeon 类闭环产品的实质区别仍在（开源、不自跑模型、core 标准可搬）。**被否**：① 嫁接任意 agent（过度工程、hook 类塑形难跨 agent 承重）；② 自研 agent runtime（太重，违低开发成本）；③ 全 Claude 原生连 core 也焊死（未来换基底 / 多人远程代价大）。落地见 [问题域 §0/§1](../01-业务分析/问题域.md)、[技术选型 §6/§6.1](../03-架构/技术选型.md)、[跨agent与适配层](../03-架构/跨agent与适配层.md)（整页重写）。

## ADR-0009 narrate 升格散文 stream + 一轮范式（= agent 回合）+ 输出层三流

- **背景**：[总体架构](../03-架构/总体架构.md) §4.1 原把 `narrate` 当"一回合的终结步骤"（一轮一次、卡成时序锚点）。填 [04 MCP工具面](../04-子系统设计/MCP工具面.md) 时发现与真实跑团流不符——AI 一轮内**像作者写一段**，`narrate` 是可多次穿插的 stream，其余工具也可多次任意序调用。且现行 prompt 惯例让 AI 自己吐"状态菜单"，**占 token 又易错**。
- **决策**：
  - **一轮 = agent 一个自然回合**（玩家输入 → 回合自然结束）；轮内**任何 MCP 调用可重复任意次、任意顺序**。`narrate` = 散文 stream、**非终结步骤**。
  - `resolve_choice` = **暂存**下轮选项+后果（轮内可反复改写、末次为准），**回合末经 Stop hook 物化呈现**给玩家（anti-F2 仍立：后果先于玩家可见即锁，改写在玩家看见前）。
  - **输出层升格 v1 一等概念**：hook/CLI 渲染器读 store/event、按 `visible` 过滤，渲染机械回显 + 状态菜单 + 待选项给玩家；**AI 不吐数值菜单、只 narrate 色彩**（零额外 token）。**三流分工**：① narrate 散文 → 对话 + AI 上下文；② 输出层渲染 → 玩家（不进 AI 上下文）；③ resolver/sheet_update 结构化结果 → 只回 AI（最小 token）。
  - **L3 窗口重定义 = 一个 agent 回合**（Stop hook 审计本轮 event）；取代旧"两个 narrate 标记之间"（narrate 已成 stream）。**新硬规矩**：非终局轮回合末必须留有暂存 `resolve_choice`，否则违规。**唯二终局出口**：`game_end` / `you_death`。
- **后果**：修订 [总体架构 §4.1/§5/§6/§7/§8](../03-架构/总体架构.md)、[02 §6](../02-领域模型/核心概念.md)、[内层 §4.2](../04-子系统设计/内层能力库.md)（L3 窗口）。narrate / `game_end` schema、Stop hook 实现归 04 / [跨agent](../03-架构/跨agent与适配层.md)。**被否**：narrate 作单次终结步骤（与作者式多次穿插的真实创作流不符，且逼 AI 吐状态菜单费 token）。

## ADR-0010 可见性模型：`visible` 列 + show 白名单 + shot 快照（合入 event）

> **改名注解（2026-06-03）**：本 ADR 内的工具 `shot` 已统一更名为 **`reveal_once`**（领域术语回头路，全 wiki 一致；语义不变）。下文决策原文保留 `shot` 作历史记录。

- **背景**：ADR-0009 的输出层"流②"要按"玩家可见性"过滤渲染，但项目此前无可见性概念；且跑团有**暗值（好感度暗值）/ 隐藏 DC / GM 私有信息**需求。
- **决策**：**deny-by-default 的白名单可见性**（GM 全见，显式授权玩家所见）。
  - **存储 = `visible` 列**：sheet / `world_doc` / `world_pool` / `event` 各加一列（用列、不用键前缀，免撞 `前缀:键` 约定）。sheet 三态：`0` 默认隐 / `1` 已 show / `2` 强制隐（暗值）。
  - **默认**：world / sheet 全隐；event 按 `kind`——散文与机械事实（narrate/verdict/mutation/timer_fired/reveal）默认可见、GM 注记（note）默认隐，`event_append` 可覆盖。
  - **show（持久揭示，渲染实时值）**：`sheet_show` / `world_show`，**attr 级**或 **entity 级递归**（长效、覆盖未来新增 attr）；带 `强制隐藏(=2)` 标记的 cell 即使 entity-show 也不露——防暗值泄漏。玩家自己人物卡默认隐，AI 开局 show 一次。每次 show 写一条 `kind=note`、`visible=0`（对玩家隐）的审计 event。
  - **shot（快照披露，中优先级，多态）**：把某隐藏**目标**（sheet cell **或 world 条目**）此刻内容**以冻结副本披露一次** = **append 一条 `kind=reveal` 的可见 event**；不翻目标 `visible`（底层仍隐）。对 sheet（值暗变）→"玩家见旧值、下次 shot 才刷新"自动成立；对（基本静态的）world → 一次性披露、不入持久可见集。**用 event 域实现"副本"**。
  - **un-show 降边角**：`shot` 顶掉"情报重新成谜"主需求；罕见"曾持久 show 要收回"由 `sheet_show` 传 `visible=false` 兜底，不做一等公民。
- **后果**：落 [02 §2 要点5 / 术语表](../02-领域模型/核心概念.md)、[03 §3.1](../03-架构/总体架构.md)、[内层四域 schema](../04-子系统设计/内层能力库.md)。`shot` 粒度暂定单 cell（待实现表现再定）。**被否**：① 默认可见（泄漏暗值）；② 纯 `前缀:键` 约定存可见性（撞既有约定）；③ entity-show 无强制隐藏标记（会泄漏暗值）。

## ADR-0011 time 不升格：留 `sheet_update` + skill 声明钟属性

- **背景**：ADR-0009 的 timer / hook 机制要比对"游戏时间"，需确认 time 是否该升格为独立通道（曾考虑 `time_set` / `time_advance` / `time_timer` 工具族）。
- **决策**：**time 不升格**。游戏内时间 / 回合 = sheet 的某 attr（如 `世界.时间`），用 `sheet_update` 写（可带骰）；**哪个 attr 是"钟"由团本 rule / skill 声明**，框架不写死、不内置回合概念，自身只保留单调事件序号 `seq`。`timer_set` 登记到期、hook 每轮读该钟 attr 比对触发。
- **后果**：几乎不改页（[术语表「sheet 钟」](../02-领域模型/术语表.md) 早是此口径）；[03 §3](../03-架构/总体架构.md) 顺手点明。**镜像 [ADR-0007](#)（状态骰下沉）**——同属"不为一类 sheet 写单设独立工具"。**被否（待观测再议）**：专用 `time_*` 独立通道 + "该走时间却没走"的 L1 审计——**仅当测试证实"时间乱流逝"是 AI 本能失败模式时再升格**，当前判收益不抵复杂度。

## ADR-0012 guideline 载体：焊进 skill 本体（静态 markdown），非运行时 MCP 读取

> **改名注解（2026-06-17）**：本 ADR 内的 `guideline` 已统一更名为 **Principles**（PbtA 术语对齐回头路，见 [ADR-0016](#)；语义不变）。下文决策原文保留 `guideline` 作历史记录。

- **背景**：填 [04 Skills 包](../04-子系统设计/Skills包.md) 需先拍 L2 教条（dispatcher/guideline/补刀措辞）的载体——"待决策"原列两个候选：① **安装时焊进 skill 本体**（`dicelore init` 写进 `.claude/skills/` 的静态 markdown）vs ② **运行时 MCP 读取**（MCP 工具/`reminders` 动态供给）。该选择直接决定 Skills 包形态。
- **决策**：**焊进 skill 本体**（候选①）。guideline 作静态 markdown，走 [跨agent §2/§4](../03-架构/跨agent与适配层.md) 既定的 Claude Code skill 装载路径（放 `.claude/skills/`）。**这不是回头路**——[技术选型 §2](../03-架构/技术选型.md)（**Skill 承载 L2 / MCP 承载 L1**）+ 跨agent §2（**L2 教条放 `.claude/skills/` 装载**）**已蕴含焊进**；本 ADR 只把原"待决策"升格收口，不改 02/03。
- **后果**：教条内容（markdown）是 **core 标准件、未来可搬**；装载机制绑 Claude Code skill（[跨agent §1](../03-架构/跨agent与适配层.md) 的 core/绑定边界）。**补刀分工随之确定**：MCP `reminders` 只内置极小 L1 基线（terse 反射），丰富措辞活在焊进的 guideline 里（L2）；**v1 不让 hook 往 `reminders` 塞 L2 富文本**——MCP §5"可由 guideline/hook 增补"读作"AI 用内化 doctrine 增补输出"。**被否**：运行时 MCP 读取 guideline——会让 **MCP 承载 L2 = 范畴错误**（[03 §5](../03-架构/总体架构.md) 警告"把正交轴误当一层"），且须开回头路改 [技术选型 §2](../03-架构/技术选型.md)。**措辞终稿**留实现期 eval-loop（with/without baseline；可复用 L3 审计信号作 assertions）调，非本 ADR 范围。落地见 [04 Skills 包 §6](../04-子系统设计/Skills包.md)。

## ADR-0013 `timer` 升格为 `watcher`（sheet 数据触发器），从 hook 解绑

- **背景**：[ADR-0011](#) 把游戏时间留在 sheet 钟，`timer_set` 仅"对钟 attr 的到期条件"，到期靠 hook 每轮回合开始轮询（[跨agent §3](../03-架构/跨agent与适配层.md)、[03 TODO B](../03-架构/TODO.md)）。填 [04 adapter](../04-子系统设计/adapter与L3审计.md) 时反推：既然 time 已与对话回合解绑（只是 sheet 的一个 attr），"到期"本质就是"**某 sheet 属性满足某谓词**"，时间到期只是其中一个特例——没理由特化成时间专属，更没理由绑在对话回合 hook 上轮询。[语料 c](../01-业务分析/调研-论坛语料痛点.md)（倒计时埋点、漏触发金獾）也只是"属性满足条件就触发"的子集。
- **决策**：`timer` **泛化为 `watcher`（sheet 数据触发器），并从 Claude Code hook 解绑、下沉为内层引擎 / MCP 的 core 能力**。
  - **条件 ＝ sheet 谓词**：`{张三.HP} < 30`、`{世界.天} >= 18`（时间型 ＝ 监视钟 attr 的特例）。复用 [expr 文法](../04-子系统设计/内层能力库.md) ＋ **新增比较算符** `< <= > >= == !=`（求值出 bool）；**不加乘除**——百分比 / 相对时间由 AI 创建时读真值算成绝对值填入（GM 全见可 `sheet_get`）。
  - **就地触发**：`sheet_update` 写完，引擎重算本次 entity 上挂的 watcher，满足则触发。**不再 hook 轮询**。
  - **出口双管**：① `sheet_update` 出参带 `fired_watchers`（watcher_id ＋ payload）→ AI **当轮即时**反应；② 落 `event(kind=watcher_fired)` 供回看 / 输出层 / L3。payload ＝ 给 AI 的提示文本（框架只提醒、不替演）。
  - **去抖 ＝ edge-triggered**：仅"不满足→满足"跨越沿触发一次；须条件先解除（disarm）才能再 arming。`mode`：`once`（触发即永久失效）/ `repeat`（可反复 re-arm）。**v1 不做显式 cooldown**。
  - **命名 / 创建**：`dicelore_timer_set`→`dicelore_watcher_set`；event kind `timer_fired`→`watcher_fired`；timer 表→watcher 表（加 `mode` / `armed`）。v1 由 **AI 用工具创建**；团本 / rule 预声明 watcher 留未来。
- **后果**：**hook 承重再缩一项**——timer 不再是 hook 的活，"回合开始 hook（UserPromptSubmit）"只剩被动 rule 召回（见 [ADR-0014](#)）；**core 边界更干净**——watcher 与基底无关、不绑 Claude Code，比 timer-on-hook 更符合"core 不锁死"；**expr 升格为可求值谓词**（[内层 §3.1](../04-子系统设计/内层能力库.md) 扩比较、返回 bool）。落地：[03 §3/§5/§6](../03-架构/总体架构.md)、[跨agent §2/§3](../03-架构/跨agent与适配层.md)、[内层 §3.1/§4.2](../04-子系统设计/内层能力库.md)、[MCP §2.2/§2.3/§7](../04-子系统设计/MCP工具面.md)。**修正 [ADR-0008](#)**"timer 到期靠 hook"的表述（追加式，不回改其正文）。**被否**：① 维持 timer 时间专属 ＋ hook 轮询（无谓特化、绑 hook）；② level-triggered（满足即触发 → 刷屏）；③ 显式 cooldown（edge ＋ mode 已够，徒增 seq / 钟单位之争，待"反复横跳"实证再议）。

## ADR-0014 L3 兜底动作分两档烈度；无独立裁判 subagent；hook 回合时序定稿

- **背景**：填 [04 adapter](../04-子系统设计/adapter与L3审计.md) 把 [ADR-0009](#) 的"L3 ＝ Stop hook 审计"落到具体动作时，需定：判违规后做什么、烈度多大、要不要真·裁判 subagent、回合开始 / 末各 hook 干什么。
- **决策**：
  - **违规两档烈度**：**档 A（block 当场纠偏）＝ 结构确凿、补救无歧义**——① 非终局轮没留暂存 choice、② 本轮有实质散文输出却没走 `narrate`（散文没进 event ＝ 没法审计 / 召回）；Stop hook `decision:"block"` ＋ reason 让 agent 当回合补，靠 `stop_hook_active` 防重入（最多纠一次，仍缺则放行 ＋ 记违规）。**档 B（只记录、不阻止当下）＝ 需语义判断或仅统计偏差**——疑似软着陆（坏结果后叙述 / 数值偏正向）、该掷却用 `=`（账本 set 比例）、掷骰绕过率；写 `kind=note` 审计 event 喂 [eval-loop](../04-子系统设计/Skills包.md)，守 [02 §4](../02-领域模型/核心概念.md) 事后兜底。
  - **无独立裁判 subagent**：机械比对（缺 choice、漏 narrate、账本统计）由 **Stop hook 纯 Node 脚本**做（零 LLM、确定性）。**语义判断（软着陆与否）v1 不当场 block**（误报率高、打断叙事、违"L3 不阻止当下"），纯记录；"让主 agent 自查"经**下一轮 UserPromptSubmit 轻推**实现（列未来强化），仍**不 spawn 独立裁判 subagent**（与主 agent 自纠职责重叠、成本高、依赖实验特性）——降为未来 / 可选。
  - **hook 回合时序定稿**：**SessionStart** ＝ 开局上下文 ＋ 常驻身份注入；**UserPromptSubmit（回合开始）** ＝ 仅被动 rule 召回（timer 已由 [ADR-0013](#) 摘走）；**Stop（回合末）** ＝ ① 物化暂存 choice ② L3 审计。**修正 [03 §6](../03-架构/总体架构.md)**：rule 召回从 Stop 三件事里拆出、归回合开始（旧 §6 把它误列在 Stop 下，而 Stop 无法注入"下一轮"）。
  - **narrate 不自动捕获**：v1 `narrate` 作 MCP 工具直接用，Stop hook 机械兜底"漏 narrate"（本轮有大段 assistant 文本却无 narrate event）；"talk 自动捕获写 event"是未来非 CC 基底的饼。
  - **常驻保证**：`dicelore init` 写 `CLAUDE.md` 指针 ＋ SessionStart 注入身份 / 极简纪律摘要；**不每轮 UserPromptSubmit 强化**（教条本体仍靠 skill 触发载入，hook 只放指路牌，避免 token 累积 ＋ 与 skill body 重复）。
- **后果**：落 [03 §5/§6](../03-架构/总体架构.md)、[跨agent §2/§3](../03-架构/跨agent与适配层.md)、[04 adapter 全页](../04-子系统设计/adapter与L3审计.md)；收口 [Skills包 §1.1](../04-子系统设计/Skills包.md) 踢来的"常驻保证机制"。**被否**：① 一致性问题也 block（误报率高、打断叙事、违 L3 事后兜底）；② 真·裁判 subagent（与主 agent 自纠重叠、成本高、依赖实验特性）；③ 每轮 hook 注全摘要（token 灾难、抵消渐进式披露）。

## ADR-0015 团本构建台：文件包为真相 + 可交互 Web 门面 + 即写即读 + 分阶段 + FTS 素材检索

- **背景**：填 [04 团本与 manifest](../04-子系统设计/团本与manifest.md) / [团本构建工具链](../04-子系统设计/团本构建工具链.md) 两页骨架时，需先定"普通用户怎么造出团本"。靶心是**降低作者门槛**——目标用户"只会丢一整本《凡人修仙传》进去"，不会手写 manifest / CSV / frontmatter。这要求一组架构选择：产物形态、CRUD 对象、审阅界面、并发真相模型、构建节奏、超长素材怎么喂。
- **决策**（六连，构成"团本构建台"＝作者侧、构建期专属、与运行时分开）：
  - **① 产物 = MD+CSV 文件包**（非 SQLite 草稿库）：CRUD 对象是文件包条目；贴合 [技术选型 §5](../03-架构/技术选型.md)"MD 主体 + CSV → import 建库"既定假设，对 git / 版本化 / 分发友好（[团本与 manifest §1](../04-子系统设计/团本与manifest.md)）。
  - **② 审阅 = 可交互 Web 门面**：本地轻量 http 服务 + 前端，渲染"团本说明书"且允许用户直接增删改条目。最降门槛（用户自己点改，不必每改都绕回对话）。**明确与运行时游玩界面解耦**——[adapter 页](../04-子系统设计/adapter与L3审计.md) 的"运行时 GUI 属未来"不变，玩游戏 v1 仍走终端；此 Web 仅作者构建期用。
  - **③ 真相 = 文件包、双门面即写即读**：agent（MCP 门面 `dicelore_build_*`）与用户（Web 门面）都对文件做结构化 CRUD；每次操作即写即重读渲染；**无内存态、无 WebSocket 实时同步**（用户刷新见 agent 改动）。两门面共享同一套**读写层 + 校验器**（纯逻辑、可单测，镜像 [内层能力库](../04-子系统设计/内层能力库.md) 分层）。
  - **④ 构建模式 = 同一 Claude Code 换装**：加载构建 skill + 构建 MCP，而非运行时那套 `resolve_*` / `sheet_update`。
  - **⑤ 节奏 = 分阶段·边建边审**：①世界观→②NPC→③卡池→④机制→⑤选 flow+manifest 收口；每阶段 agent 产一块、用户即时审阅修正再进下一阶段，阶段间可回退。错误早发现、长小说可分块喂、贴即写即读回路。
  - **⑥ 素材 = 先建检索库、按阶段检索**：整本小说切块建库，每阶段 agent 按需检索相关片段。**起步关键词 FTS5 + jieba**（复用运行时基建、零新依赖），**语义向量列未来**（与 RAG spike 同档）。检索库是构建期临时品、不进成品包。
- **后果**：[04 组件5/组件6](../04-子系统设计/) 两页从骨架定稿；新增"团本构建台"为作者侧子系统；[adapter 页](../04-子系统设计/adapter与L3审计.md) 补一句"构建期 Web ≠ 运行时 GUI"的澄清（不改其运行时裁定）。**未越界**：读写层/检索库属 core 标准件、不绑 Claude Code（构建 skill / MCP 注册才绑基底，同既有边界）。**被否**：① SQLite 草稿库为产物（偏离 MD+CSV 假设、对 git 不友好）；② 静态 HTML 只读预览 / 纯终端文本视图（审阅体验弱于可交互，长团本尤甚）；③ 实时双向同步（要双向同步 + 冲突处理，最重、scope 易爆，即写即读已够）；④ 一把梭末尾总审（错误集中末尾、长文上下文压力大）；⑤ 用户喂浓缩二手材料（门槛回升，违"丢一整本"愿景）；⑥ 自主分块全文通读（token 重、慢，且与分阶段检索相比无额外收益）。

## ADR-0016 全盘对齐 PbtA 术语 + 新增 Agenda 层 + F2 双边护栏（fail-forward）+ Front/Clock 团本内容类型

- **背景**：04 全区定稿后做了一轮英文 TRPG 设计正典调研（PbtA / Dungeon World 的 Agenda·Principles·Moves、Alexandrian 节点式剧本、Gnome Stew 的 fail-forward、五房间地下城、AW Fronts/Clocks），与现架构逐层比对。结论：**Dicelore 独立重建出的 GM 塑形架构，本质就是 PbtA 最硬核的分支**——差别只在 PbtA 靠社会约定让人类 GM 自律，而 Dicelore 面对的"GM"是有讨好本能、无社交羞耻心的 LLM，凡 PbtA 信任 GM 自律之处 Dicelore 都须机械强制。比对暴露三处可落地缺口（F2 只防单边、缺顶层 Agenda、团本无"会自己推进的威胁"单元）+ 一处术语未对齐。决定全盘对齐。
- **决策**（五连）：
  - **① 术语全盘对齐**：有 PbtA 强对应物的升为一等术语——`guideline → Principles（原则）`、`dispatcher 形状表 + 两道闸 → Moves（动作）+ 判定时机`、`resolve_outcome 概念对齐三档结果（完全/部分/失败）`（**工具名不改**，仅文档对齐）。**边界 = 保留独有抽象**：Dicelore 独有的更强 / 正交抽象（`resolver 二轴` / `四业务域` / `三层 L1·L2·L3` / `F1·F2·F3 失败模式诊断` / **`watcher` 底层触发器**）**保留原名不动**，不为对齐硬套 PbtA 壳。
  - **② 新增 Agenda 议程层**：塑形层 L2 教条采 PbtA 三段式 **Agenda（为什么）→ Principles（怎么）→ Moves（做什么）**。Agenda 四条，**第 0 条"你是世界的诚实仲裁者，不是玩家的取悦者"为 Dicelore 特有、凌驾其余**（人类 GM 无讨好病，这是 Dicelore 与 PbtA 的分水岭，也是定位陈述的祈使版）；其余三条（描绘活世界 / 让选择有真后果 / play to find out）借自 DW。Agenda 给 F 轴提供"为什么"的根——F2 同时违背"后果要真"与"不预定结局"。
  - **③ F2 升级为双边护栏**：坏结果**既不能被洗成好结果**（上边界 = anti-讨好，原 F2）、**也不能退化成"什么都没发生"**（下边界 = anti-死胡同，借自 PbtA fail-forward）。引入可教 craft（三档结果 / 软招·硬招 / 后果手法菜单 / 末日钟=Clock / "有时失败就是失败"），落 Principles + `references/consequences.md`。
  - **④ 新增 Front/Clock 团本内容类型**：`Clock`（倒计时钟）= sheet 钟 attr + 监视它的 watcher 的封装；`Front`（阵线）= 名字 + 利害 + Clock + 阶梯凶兆表，落地为一组**预声明 watcher**。建在已有 `watcher` + `sheet 钟`之上，**非新底层机制**。**推进 [ADR-0013](#)**：把"团本预声明 watcher"从其"留未来"裁定**提前纳入 v1**——PbtA 正典表明 Front（预置威胁 + 倒计时）是作者备团的核心单元，非锦上添花；watcher 底层早已就绪，只差团本预声明入口。组件6 定 `fronts/*.md` 格式 + 包→四域 import 映射（frontmatter 钟→sheet、凶兆阶梯→预声明 watcher、阵线散文→world_doc）。
  - **⑤ 定位陈述 + 洋葱层旁证**（纯阐释，不改结构）：定位陈述（Dicelore = PbtA 纪律的机械强制版）入 [02 §4](../02-领域模型/核心概念.md)；AW 的"洋葱层优雅坍缩"≈ Dicelore 的"L2 漏 → L1 工具地板兜底 → L3 审计网"（Dicelore 轴 = 强制力冗余，AW 轴 = 规则复杂度回退）入 [03 三层节](../03-架构/总体架构.md)。
- **回头路纪律**：按单向推导 02 → 03 → 04 一次扫全 `guideline→Principles` / `dispatcher→Moves`；**旧 ADR（0012 等）正文不回改**，在 [ADR-0012](#) 顶部加改名注解（沿用 [ADR-0010](#) 的 `shot→reveal_once` 风格）。**[01 调研-期待与预测](../01-业务分析/调研-期待与预测.md) 里的 `dispatcher` 是外部开发者（meyomeyome）做法的引用、与 Dicelore 术语巧合同词，不在改名范围。**
- **后果**：落 02（术语表 / 核心概念）、03（总体架构 / TODO）、04（Skills包 / 团本与manifest / MCP工具面 / adapter / 内层 / TODO / README）、05（本 ADR + 0012 注解）。塑形层教条从两段式（guideline + dispatcher）升为**三段式（Agenda / Principles / Moves）**；团本多一类"会自己上发条"的 Front/Clock 内容；F2 有了可教的 fail-forward 手法表。**被否**：① 只锚注不改名（框架不吸收新结构，放弃 Agenda / Front 的实际收益）；② 最大化套壳（连 resolver 二轴 / 四域 / F 轴也套 PbtA 词——用为人类设计的词去装 Dicelore 针对 AI 的独有机制，损失精度）；③ Front 仍留未来（放弃作者备团的核心单元，与正典背离）。

## ADR-0017 状态回滚 = 回合快照（checkpoint），非逆运算 / 非纯重放；快照机制下沉 MCP/core hook

- **背景**：用户深度体验 SillyTavern 后提三个问题（用网络语"口胡"=信口开河编情节 / 偷换扭曲规则取胜作隐喻）：**P1 缺剧情大纲**（情节全靠 AI 即兴）、**P2 数值/规则随心意致出戏**、**P3 状态回滚**（撤回 / 删除当前对话回合时，存储状态须逆回上一回合）。逐一核对：**P1 已被 [ADR-0016](#) 的 Front/Clock 覆盖**（解药不是写死大纲＝railroading，而是"会自己上发条"的长程压力对象给 AI 即兴施加引力）；**P2 已被 [ADR-0005](#)（rule 只读）/ 状态归属（随机与取数全在 MCP 内、AI 只给引用）/ [02 §4](../02-领域模型/核心概念.md) 的 F1·F2·F3 覆盖**（守纪律即可、非新工作）。**唯 P3 是新决策**。用户另提两点关联意图：(a) "迟早会面临**自研 agent** 这个命题"；(b) 设想"**所有需开发的 MCP + 我们自有的那几个 MCP，提供一个 hook 来支持快照模式**"。
- **决策**（回合快照）：
  - **回滚机制 = 快照（snapshot per 回合），否逆运算、否纯重放。**
    - **被否·逆运算 / undo log**：撞破坏性写（`sheet_update` 的 UPSERT 覆盖旧值，不另存就逆不回）＋ watcher 级联效果难逆、`once` watcher 须手动 re-arm。业界应用层基本不碰，只在 DB 内核用。
    - **被否·纯重放（fold events）**：回滚要从头重算 → 强加"**确定性税**"（骰子必须钉进 event、watcher 重算不准重掷）。
    - **选定·快照**：每个**回合边界**（[ADR-0009](#) 定义的 agent 自然回合）存一份游戏状态；撤回当前回合 ＝ 丢当前、加载上一份。**O(1) 回滚，且把骰子非确定性问题直接消掉**（存结果、不重算）。Dicelore 单局状态小（几张 sheet / event / 账本），快照成本可忽略——故 Claude Code 那种要快照整个文件树的场景都用快照，Dicelore 更无负担。**业界主流佐证**：Claude Code（每个 user prompt 一个 checkpoint、快照式、独立于 git、存会话 jsonl）、Cursor、SillyTavern（checkpoint＋消息树分支）回滚一律用快照而非逆运算；DB 界的 checkpoint＋WAL ＝ 快照＋事件日志。
  - **快照范围 ＝ 游戏推进态**：sheet 全表（含 `visible`）＋ world（运行期 AI 现编部分）＋ event（到该 `seq`）＋ **watcher 运行时态**（`armed` / `fired` / `mode`）＋ `seq` 指针。**不含 rule**——rule 人类侧写、版本化（[ADR-0005](#)，AI 只读），其变更走**带外**，不随游戏回合回滚。
  - **机制下沉 MCP / core 层 hook**：快照 / 回滚做成**内层 core ＋ MCP 层的统一能力（快照 hook）**，所有自有 MCP 复用，**不绑 Claude Code**——与 Claude Code 自带的 file checkpoint **正交、互不依赖**（CC 的 checkpoint 管文件、管不了我们的 store）。兑现用户设想 (b)。
  - **铁律（普适，与机制无关）**：**凡逃出"被记录边界"的状态变更都救不回来。** Claude Code 官方明示其 checkpoint 回滚不了 bash 副作用 / DB / API / MCP 外部状态（故跑这类命令前必请授权）。翻译到 Dicelore ＝ **一切游戏状态变更必须走 store 记录通道**；AI 不得在 prompt / `narrate` 散文里直接改数，dice 不得在 watcher 重算里偷掷。守此，快照即完备。
  - **event log 保留作分支底物**：框架只拥有单调 `seq`（[内层「时间观」](../04-子系统设计/内层能力库.md)）。保留 event **不为重放，而为未来 branch / swipe**——酒馆品类真正想要的"不满意当前回合→从上一快照开新分支重生成"，而非只能删了重来；外加审计回看。branch 属未来，但"快照＋event"底物使其廉价。
- **后果**：新增"**回合快照**"为 v1 数据层一等机制。**与 [ADR-0010](#) 的 reveal_once「快照」同词不同物**——后者是 event 域的"可见性冻结副本披露（单 cell / 单条目）"，本条是**整局状态的 checkpoint**，文档中须明确区分避免混淆。落 [03 §3.2](../03-架构/总体架构.md)（新增）＋ [03 TODO G](../03-架构/TODO.md)；快照存储形态（全量 / 增量 / COW）、watcher 运行时态序列化、与 Stop hook 回合边界的接线归 [04](../04-子系统设计/) / 未来。**触及 [ADR-0008](#) 的"被否·自研 agent runtime（太重）"**：用户提"迟早面临自研 agent"——本 ADR **不翻 ADR-0008**，但把"快照机制做成 agent 无关的 MCP/core hook"作为**对冲**（即便将来换基底 / 自研 agent，快照能力随 core 走、不重做，符合 [ADR-0008](#) 的"core 不锁死"），自研 agent 本身仍记为未来待议。**骰子边界**（`src/dice`）：快照下"掷骰结果进 event"**不再是回滚的正确性要求**，但仍是 **branch 的正确性要求**（swipe 时换结果重掷 vs 沿用同掷——产品决策），边界建议实现期立。**被否**：① 逆运算 / undo log（破坏性写＋级联难逆）；② 纯重放（确定性税）；③ 把回滚绑死 Claude Code 自带 checkpoint（回滚不了 store，且违 core 不锁死）。
- **细化落地（2026-06-18 第二轮 brainstorming，"实现待 04"诸项收敛）**：
  - **存储形态 = 全量快照行 / 回合（解耦子系统）**：新增 `snapshot(id, parent_id, transcript_anchor, turn_start_seq, turn_end_seq, blobs_json, created_at)` 表，**不碰四域 schema**。否增量 / COW（状态小、不值复杂度）。
  - **IoC 参与者注册表（解耦快照与各模块）**：快照 core **零编译期依赖**具体域——各模块注册 `SnapshotParticipant{name, capture(), restore()}`，`checkpoint` 遍历收集、`restore` 派发覆写。**范围 = 哪些模块注册（config 化）**：v1 注册 sheet / world.runtime / watcher；**rule 不注册 → 自动不随回合回滚**（"范围不含 rule"从硬编码变注册事实）；团本自定义域注册即入快照、不碰快照代码。**"watcher 运行时态序列化"开放项消解**（整表 dump、restore 整体覆写、不逆级联）。
  - **event 是时间线脊柱、不入快照**：append-only、永不删；当前分支 event 历史 = 快照祖先链的 `[start,end]` seq 区间拼接 → **无需 `branch_id` 列**。
  - **branch 进 v1**（原"属未来"上修）：快照 `transcript_anchor` 锚 CC transcript UUID 树 → 快照树继承其形状，branch 是自然产物。**swipe 默认重掷**（从上一快照重生成、自然新掷骰；沿用同掷需钉骰＝确定性税，已否）。**dice 不外部播种**（结果已落 event、按 UUID 播种破 agent 无关边界）；反刷骰＝稳定键播种记**未来 config 旋钮**（键用 core seq/snapshot id、非 UUID）。
  - **回滚触发 = auto-sync Claude Code /rewind**：Stop hook 写快照、UserPromptSubmit hook 检测 transcript head 错位→restore 对齐；**不进 AI 工具面**（玩家元动作）。**兜底 = 人类侧 CLI**（`dicelore rewind`，transcript 关联不可靠时的逃生口）。机制（快照 core）agent 无关、关联检测吃 CC 专属（住 adapter）——**比"人类 CLI 回滚"更精确的 [ADR-0008](#) 对冲**。
  - **rule 带外与回滚交互**：rule 不注册 participant → restore 永不碰 rule、热更自动留存、restore 出的态跑当前 rule。
  - 落 [内层 §4.5](../04-子系统设计/内层能力库.md)（快照 core）＋ [adapter §8 / §3.1 / §3.3](../04-子系统设计/adapter与L3审计.md)（hook 接线）＋ [MCP §7](../04-子系统设计/MCP工具面.md)（不进工具面）＋ [03 §3.2](../03-架构/总体架构.md)（指针更新）。

---

## 待决策（记录但未定，勿当结论引用）

- ~~**注入机制**：guideline 规则是"安装时焊进 skill 本体" vs "运行时 MCP 读取"~~ → **已由 [ADR-0012](#adr-0012-guideline-载体焊进-skill-本体静态-markdown非运行时-mcp-读取) 决议**：焊进 skill 本体（静态 markdown，走 Claude Code skill 装载）。
- ~~**resolve_choice 是否两阶段**~~ → **已由 [ADR-0009](#adr-0009-narrate-升格散文-stream--一轮范式-agent-回合--输出层三流) 决议**：暂存（轮内可改写）+ 回合末 Stop hook 物化，落地"声明后果在先"。
- **骰面语义**：是否给骰子引擎加"零基(0–9)"模式，还是约定映射。
- ~~**回合分支（branch / swipe）是否 v1**~~ → **已细化（[ADR-0017](#) "细化落地 2026-06-18"）**：branch **进 v1**（快照锚 transcript UUID 树、branch 是自然产物）；**swipe 默认重掷**（从上一快照重生成、不钉骰、不外部播种；反刷骰=稳定键播种记未来 config）。
- ~~**快照存储形态**~~ → **已细化（[ADR-0017](#) "细化落地 2026-06-18"）**：全量快照行 / 回合（解耦子系统）+ **IoC 参与者注册表**（watcher 整表 dump，"运行时态序列化"开放项消解）；接线 = Stop 写 / UserPromptSubmit 检测 restore（[adapter §8](../04-子系统设计/adapter与L3审计.md)）。
- ~~**rule 带外变更与回滚的交互**~~ → **回滚交互已细化**（[ADR-0017](#)：rule 不注册为快照 participant → restore 永不碰 rule、热更自动留存）；**仅"进行中存档遇 rule 版本热更的迁移语义"（`schema_version` / 团本版本迁移）仍待**未来。
- **自研 agent**（呼应 [ADR-0008](#) 被否项）：记为未来待议；对冲已细化（[ADR-0017](#)）= **快照 core agent 无关、仅"对话回退↔快照"关联检测吃基底专属、住 adapter**，换基底只重写关联 hook。
