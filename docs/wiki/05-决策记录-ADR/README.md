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

## ADR-0004 业务驱动设计

- **决策**：架构从业务分析**重新推导**，以单向推导链（业务 → 概念 → 架构 → 决策）为唯一地基。
- **后果**：获得干净、自洽的推导链，不被任何早期产物锚定。

## ADR-0005 数据层重构为四业务域（部分取代 ADR-0003）

- **背景**：ADR-0003 按"访问模式"分三存储（状态/事件/剧本）。设计推进暴露两问题：① world（作者世界底料）与 rule（绑住 GM 的规则合同）业务上完全不同，却被糊成一张"剧本表"；② "剧本表只读"假设过强——语料显示 GM 会运行期现编世界内容、规则也需热更新。
- **决策**：数据层一级轴改为**四业务域**（sheet / event / world / rule）；ADR-0003 的"访问模式"降为**二级轴**（每域怎么 CRUD）。world 可写（作者灌注 + GM 现编）；rule 只由**人类**写（作者版本化 + 团主/管理员实时），**AI 对 rule 只读**——让被规则卡住的 AI 能改规则 = 给讨好本能松绑。
- **后果**：取代 ADR-0003 的"三存储"部分；"agent 即引擎、v1 不上 ML"不变。落地见 [核心概念 §2](../02-领域模型/核心概念.md) 与 [总体架构](../03-架构/总体架构.md)。

## ADR-0006 全栈语言由 Python 改为 TypeScript

- **背景**：mcp-builder 官方推荐 TS（SDK 一等公民、强类型、MCPB 打包、生成质量），且路线图的多人远程（Streamable HTTP）是 TS 主场；项目正从零重推、无既有资产绑定，切语言成本最低。
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
- **后果**：新增"**回合快照**"为 v1 数据层一等机制。**与 [ADR-0010](#) 的 reveal_once「快照」同词不同物**——后者是 event 域的"可见性冻结副本披露（单 cell / 单条目）"，本条是**整局状态的 checkpoint**，文档中须明确区分避免混淆。落 [03 §3.2](../03-架构/总体架构.md)（新增）＋ [03 TODO G](../03-架构/TODO.md)；快照存储形态（全量 / 增量 / COW）、watcher 运行时态序列化、与 Stop hook 回合边界的接线归 [04](../04-子系统设计/) / 未来。**触及 [ADR-0008](#) 的"被否·自研 agent runtime（太重）"**：用户提"迟早面临自研 agent"——本 ADR **不翻 ADR-0008**，但把"快照机制做成 agent 无关的 MCP/core hook"作为**对冲**（即便将来换基底 / 自研 agent，快照能力随 core 走、不重做，符合 [ADR-0008](#) 的"core 不锁死"），自研 agent 本身仍记为未来待议。**骰子边界**（`packages/core/src/dice`）：快照下"掷骰结果进 event"**不再是回滚的正确性要求**，但仍是 **branch 的正确性要求**（swipe 时换结果重掷 vs 沿用同掷——产品决策），边界建议实现期立。**被否**：① 逆运算 / undo log（破坏性写＋级联难逆）；② 纯重放（确定性税）；③ 把回滚绑死 Claude Code 自带 checkpoint（回滚不了 store，且违 core 不锁死）。
- **细化落地（2026-06-18 第二轮 brainstorming，"实现待 04"诸项收敛）**：
  - **存储形态 = 全量快照行 / 回合（解耦子系统）**：新增 `snapshot(id, parent_id, transcript_anchor, turn_start_seq, turn_end_seq, blobs_json, created_at)` 表，**不碰四域 schema**。否增量 / COW（状态小、不值复杂度）。
  - **IoC 参与者注册表（解耦快照与各模块）**：快照 core **零编译期依赖**具体域——各模块注册 `SnapshotParticipant{name, capture(), restore()}`，`checkpoint` 遍历收集、`restore` 派发覆写。**范围 = 哪些模块注册（config 化）**：v1 注册 sheet / world.runtime / watcher；**rule 不注册 → 自动不随回合回滚**（"范围不含 rule"从硬编码变注册事实）；团本自定义域注册即入快照、不碰快照代码。**"watcher 运行时态序列化"开放项消解**（整表 dump、restore 整体覆写、不逆级联）。
  - **event 是时间线脊柱、不入快照**：append-only、永不删；当前分支 event 历史 = 快照祖先链的 `[start,end]` seq 区间拼接 → **无需 `branch_id` 列**。
  - **branch 进 v1**（原"属未来"上修）：快照 `transcript_anchor` 锚 CC transcript UUID 树 → 快照树继承其形状，branch 是自然产物。**swipe 默认重掷**（从上一快照重生成、自然新掷骰；沿用同掷需钉骰＝确定性税，已否）。**dice 不外部播种**（结果已落 event、按 UUID 播种破 agent 无关边界）；反刷骰＝稳定键播种记**未来 config 旋钮**（键用 core seq/snapshot id、非 UUID）。
  - **回滚触发 = auto-sync Claude Code /rewind**：Stop hook 写快照、UserPromptSubmit hook 检测 transcript head 错位→restore 对齐；**不进 AI 工具面**（玩家元动作）。**兜底 = 人类侧 CLI**（`dicelore rewind`，transcript 关联不可靠时的逃生口）。机制（快照 core）agent 无关、关联检测吃 CC 专属（住 adapter）——**比"人类 CLI 回滚"更精确的 [ADR-0008](#) 对冲**。
  - **rule 带外与回滚交互**：rule 不注册 participant → restore 永不碰 rule、热更自动留存、restore 出的态跑当前 rule。
  - 落 [内层 §4.5](../04-子系统设计/内层能力库.md)（快照 core）＋ [adapter §8 / §3.1 / §3.3](../04-子系统设计/adapter与L3审计.md)（hook 接线）＋ [MCP §7](../04-子系统设计/MCP工具面.md)（不进工具面）＋ [03 §3.2](../03-架构/总体架构.md)（指针更新）。

## ADR-0018 玩家客户端立项：GUI 呈现层提前 + Agent SDK headless host + Tauri/Web 双分发 + 自定义 MCP 周边接入

- **背景**：要给项目做一个"比较好看、开箱即用"的玩家前端。回到架构发现这触及一条被冻结的前提——[跨agent §6](../03-架构/跨agent与适配层.md) 轴二把"用 GUI 隐藏终端 / Claude Code"列为**未来层**，机制只泛设想为"Tauri 那类轻量壳"；[adapter（组件4）](../04-子系统设计/adapter与L3审计.md) 也只做 Claude Code TUI 接线 + 终端输出层渲染器，且明示"运行时 GUI 属未来"。重估两点：① 目标用户（[用户与场景](../01-业务分析/用户与场景.md)：只会丢一整本小说进去、不惯命令行 / web）真正要的是**开箱即用**，GUI 不该再拖到未来；② "把 Claude Code 藏在壳后"有比"Tauri 包交互式终端"更干净的解——**Agent SDK（程序化 Claude Code）headless 嵌进自建服务**。这要把呈现层从"未来层"提前，并立一个新子系统。
- **决策**（五连，构成"玩家客户端" ＝ **组件7**、运行时玩家侧，与 [adapter（组件4）](../04-子系统设计/adapter与L3审计.md) 的 Claude Code TUI 接线**并列**）：
  - **① GUI 呈现层提前、立"玩家客户端"为组件7**：[跨agent §6](../03-架构/跨agent与适配层.md) 轴二的"未来 GUI"上修为**近期推进项**；v1 终端（`claude` / `dicelore play`）仍在，web 客户端并行推进。新增 [总体架构 §7](../03-架构/总体架构.md) 组件7。
  - **② host ＝ Agent SDK headless，不离轴一"骑定 Claude Code"**：用 `@anthropic-ai/claude-agent-sdk`（＝程序化的 Claude Code）把 GM 作为库嵌进自建 Node 服务（编排后端）；**三 hook（SessionStart / UserPromptSubmit / Stop）、MCP（保持组件2 标准 stdio server ＝ Claude Code 同款，进程内挂载为可选优化）、skill 装载全部原样复用** [ADR-0008](#) / [ADR-0014](#) 既定机制，只把宿主外壳从 TUI 换成可编程驱动。**不翻 [ADR-0008](#) 的"自研 agent runtime 被否"**——这不是自研 runtime，是骑同一个 Claude Code 的程序化入口（恰是 [ADR-0008](#)"骑定 Claude Code"的另一种宿主形态）。
  - **③ 一个编排契约 + 两种分发壳**：编排后端对外暴露**传输无关契约** ＝ **REST**（动作进：玩家输入 / 选项 pick；呈现模型快照出）**＋ 流式通道（WS / SSE）**（`narrate` token 流 + 回合事件）——因 `narrate` 是 stream（[ADR-0009](#)），纯 REST 接不住。**呈现 UI 一份代码**，套两壳：**Tauri（个人向头等分发、开箱即用）**——壳内捎带 orchestrator 的 **Node sidecar**（`bun --compile` / Node SEA 单二进制、分 OS 预编译），本机 SQLite / 密钥 / 单会话；**Web（企业·多人向 ＝ [场景 B](../01-业务分析/用户与场景.md) 远程部署）**——orchestrator 托管、服务器集中持密钥、需会话路由 + 鉴权。**推进 [跨agent §6](../03-架构/跨agent与适配层.md)**：Tauri 壳从"未来层泛指"升为**头等分发目标**，且明确壳内包 **orchestrator**（非包交互式终端）。两壳一律走 localhost / 网络 **HTTP + WS**，**不用 Tauri 私有 IPC**（免维护两套传输）。
  - **④ 玩家选择捕获落地**：[adapter](../04-子系统设计/adapter与L3审计.md) 悬置的"玩家怎么选 choice"在客户端定为**一条 wire 消息**（前端发 `player_choice`，后端记录所选并作下一回合输入）；[ADR-0009](#) 的 anti-F2"后果先于玩家可见即锁"不变（Stop hook 物化 choice 仍早于玩家 pick）。
  - **⑤ 自定义 MCP ＝ 周边能力、不得碰规范态**：Agent SDK 的 `mcpServers` 原生吃 stdio / HTTP / 进程内，把用户登记的自定义 MCP **merge 进同一 map** 即可（合 [跨agent §1](../03-架构/跨agent与适配层.md)"core ＝ MCP 标准件、不锁死"）。**但划边界**：自定义 MCP 仅作**周边**（设定查询 / 联网检索 / 配图 / 氛围），其产出**作叙述 / note 流回**；**规范态（sheet / event / world / 裁决）仍只走 dicelore 自己的 `sheet_update` / `resolve_*`**，以保 L3 审计、watcher、可见性、快照（[ADR-0017](#)）不破。手段：**权限闸**（Agent SDK `canUseTool` / permission hook——Tauri 本机 ＝ 用户自担如装插件，远程 MCP 额外提示"联网 / 数据外流"）；**L3 把自定义工具调用归 out-of-canon**（仍落 event 留痕，但不参与"掷骰绕过率"等对规范态的比对）。外部副作用不进快照 / rewind 撤不回——同 [ADR-0017](#) 铁律对一切副作用的既有限制。团本 manifest（[组件6](../04-子系统设计/团本与manifest.md)）未来可声明推荐 / 依赖的 MCP，留钩子、不展开。
- **后果**：新增"**玩家客户端**"为 v1 运行时玩家侧子系统（组件7）。落 [跨agent §6](../03-架构/跨agent与适配层.md)（轴二上修：GUI 提前、机制定为 Agent SDK headless、Tauri 升头等分发）、[总体架构 §7 / §8](../03-架构/总体架构.md)（加组件7）、新页 [04 玩家客户端](../04-子系统设计/玩家客户端.md)（编排后端契约 / 呈现 UI / 双分发壳 / 自定义 MCP 接入）。**adapter（组件4）不动**其 Claude Code TUI 接线裁定——TUI 与 web 是两个 host，共享同一 core + MCP + hook 设计。**组件7 对 `@dicelore/core` 引擎单向依赖、几乎不改引擎**（`apps/*` 消费 core 公共面：MCP `TOOLS` / `runTool`、呈现模型生成器、hook 处理逻辑；引擎反向零 import）。**唯一触及 `packages/core` 的是通知缝**——为下述 webhook 给组件2 MCP server 加一个**可选 notify 模块**（additive、config-gated、不改既有工具语义）。**非完全正交**——为反应式呈现 / 性能留一条**变更通知缝**，机制 ＝ **MCP 的可选 config-gated 出站 webhook**：MCP 做规范态写（`sheet_update` / `event_append` / `sheet_show` / `reveal_once` …）后，向**配置的呈现 notify-URL** POST 一条变更增量（payload 自带 delta，后端多数时不必回读整表）；**URL 未配 ＝ no-op**，保留 Claude Code / 标准 stdio 路径不变，故**同一个标准 MCP server 同时服务两个 host**（Claude Code 不配 URL、web 编排后端配 URL）。这是对**抽象 notify-sink（URL + POST 契约）的依赖、非对客户端代码的依赖**（loose coupling，类同 webhook；URL 未配即普通 MCP server、不破协议合规）。`restore` / `branch` 这类整表变更同走此缝发 bulk 信号；自定义 MCP（out-of-canon）不发此通知（同 ⑤ 边界）；多人 Web 部署下 payload 须带会话标识供后端路由 / 授权。**代价**：MCP 多一个 config + 轻 HTTP 客户端、localhost 多一跳（可忽略）、与后端各持一个 SQLite 连接（WAL 并发读写无碍，且 payload 带 delta 故后端少回读）；进程内挂载时可用直接回调替代 HTTP，但 webhook 是跨进程的通用缝。实现模块边界另见 superpowers spec。**v1 竖切 ＝ orchestrator + web（浏览器连 localhost）跑通一个回合的 GM↔玩家闭环**（真 Agent SDK + 真 MCP + 真 SQLite，样式从简）；Tauri 壳、自定义 MCP 管理 UI、视觉美术轮、Web 多人托管均为后续。**被否**：① GUI 继续留未来层（违开箱即用诉求、目标用户不惯命令行 / web）；② Tauri 壳包**交互式终端**（把 TUI 塞 webview 还要解析终端输出——比 headless Agent SDK 脏）；③ 自研 agent runtime（太重，[ADR-0008](#) 已否；Agent SDK 既是 Claude Code 程序化入口就够）；④ 自定义 MCP 可改规范态（会穿透 L3 审计 / 可见性 / 快照，须重设计审计覆盖，收益不抵）；⑤ Tauri 私有 IPC 作传输（两套传输，违"一个契约"）；⑥ orchestrator 用 Rust 重写做真 Tauri 后端（丢 Agent SDK ＝ 丢 hook / MCP / skill 复用红利）。

## ADR-0019 玩家闸控明骰：明/暗骰名分流 + 阻塞式 resolver + anti-F1 边界

- **背景**：[01 §2c 语料](../01-业务分析/调研-论坛语料痛点.md)外的一条参与感诉求——**若所有掷骰（战斗 / 检定）都由引擎自动决定，玩家会觉得「还不是 AI 直接决定我的命运」**。解法 = 把「掷骰这个**动作**」交还玩家（参与感、对标博德之门：UI 点击 → 引擎掷 → 亮 DC 与点数 → 成败），但「点数」仍归引擎（anti-F1）。两件事**正交**：玩家点按钮 ≠ 玩家定数。不动的地基 = anti-F1（随机全在引擎、AI 与玩家都给不出真值）+ 可见性（`visible` 列语义）。
- **决策**（六连）：
  - **① 两条正交轴**：**点数权威恒引擎**（anti-F1，客户端篡改伪造不了真值）；**掷骰动作 + 透明度**新增一轴——明骰 = 玩家点击触发 + 亮 DC + 见证，暗骰 = 引擎自动掷 / GM 替掷。
  - **② L1 名分流、无布尔参**：承接 [总体架构 §2/§4](../03-架构/总体架构.md)「给掷骰用不同工具名分流」——**不给 `resolve_*` 加 `gated`/`visible` 布尔参**，而是 `resolve_outcome`（区间 label）/ `resolve_contest`（胜负 verdict）各拆 `_hidden`（暗、引擎自动掷）/ `_open`（明、玩家闸控掷）；**现有两工具重命名加 `_hidden`**（pre-1.0 为消歧值得改，`_hidden` 描述里讲明「引擎自动掷、非结果隐藏」）。`resolve_choice`（玩家选 label）不动——与明骰同属「玩家面向交互式 resolver」族，一个选、一个掷。
  - **③ 明骰 = 阻塞式 MCP 调用**（仿 [AskUserQuestion](../03-架构/跨agent与适配层.md)）：`resolve_*_open` 工具调用本身**阻塞**，结果作为**工具返回值**在**同一 GM 回合内**回给 GM——**不跨回合、不经 Stop 物化**。handler 注入 `awaitPlayerRoll(eventId): Promise<void>` 接缝：能力存在（组件7）→ 持久化 `pending_roll`（规格、无结果）→ 通知前端待掷 → await → 玩家点击 → core 此刻掷 + 写 `kind=verdict` event → 回合内返回；happy path 不碰 Stop hook（choice 物化 / L3 审计照旧不受影响）。
  - **④ anti-F1 边界**：**点数恒由 core 在玩家点击时计算**；前端只触发 + 播骰子动画 + 成败高亮；客户端篡改 / 伪造不了真值。明骰本就「亮」（DC / 点数 `visible=1`），不碰暗值红线；暗值 / 隐藏 DC 走暗骰（`visible` 照旧）。
  - **⑤ 裸 CC 降级**：无 `awaitPlayerRoll` 能力（无前端可阻塞）→ handler 当场立即 `commitPendingRoll` 掷、直接返回（不阻塞、跳过人机往返）。无按钮无动效，不卡死。两路都在回合内返回结果。
  - **⑥ 落点分线**：**core**（组件3/4 / 本线）= `pending_roll` 槽（仿 [pending_choice](../04-子系统设计/内层能力库.md)，status `awaiting`→`committed`）+ `commitPendingRoll(db, eventId, rng?)`（纯函数、RNG 注入可单测、**幂等**：已 committed 不重掷）+ `awaitPlayerRoll` 接缝（core 只定接口）+ 现有两工具改名 `_hidden` + gm-core「谁掷」指引；**阻塞 / WS 桥接 + `POST /sessions/{id}/roll` 端点 + BG3 掷骰卡 UI + 宕机恢复重驱 GM** 归**组件7 线**（[ADR-0018](#)）；**`packages/shared` 契约**（与组件7 共用、需协调不撞 `choices`）加 snapshot `pendingRoll`（规格、无结果、`exprDisplay` 不下发真值）+ stream `roll_staged`/`roll_committed` + `POST /roll`。
- **本 ADR 对应 spec**：已归档（明骰设计的决策与机制已沉淀于本 ADR 及下列落点）。**未越界**：core 落点（槽 / commit / 接缝）属 core 标准件、不绑 Claude Code（阻塞 / WS 实现注入才绑组件7 宿主，同既有边界）。落 [MCP工具面](../04-子系统设计/MCP工具面.md)（4 个明 / 暗掷骰工具 + schema）、[内层能力库](../04-子系统设计/内层能力库.md)（`pending_roll` + `commitPendingRoll` + `awaitPlayerRoll`）、[adapter与L3审计](../04-子系统设计/adapter与L3审计.md)（明骰不碰 Stop / 裸 CC auto-commit / 恢复重驱归组件7）、[Skills包](../04-子系统设计/Skills包.md)（gm-core Moves「谁掷」栏 + Principle）、[玩家客户端-接口 §8](../04-子系统设计/玩家客户端-接口.md)（销视觉 §8 / 接口「待回填」）。**被否**：① `resolve_*` 加 `gated`/`visible` 布尔参（消歧靠 L1 工具名分流，符 [总体架构 §2/§4](../03-架构/总体架构.md)）；② 明骰走 Stop 物化跨回合（破「回合内见证成败」、与 choice 同构反而丢阻塞返回这一拍）；③ 把点数下放客户端 / 前端播种（破 anti-F1，客户端可伪造真值）。

---

## ADR-0020 组件7 实时引擎面：dicelore MCP in-process 挂载 + onCanonWrite 写后接缝 + GmDriver 抽象

- **背景**：[ADR-0018](#) 立组件7，把 orchestrator 接成「实时引擎面」（GM 叙述流式 / 呈现增量 / 掷骰裁决）。两个实现决策须拍：① dicelore MCP 怎么挂进 Agent SDK——stdio 子进程 vs in-process；② 呈现增量怎么从「MCP 写规范态」反应式驱动；③ GM 驱动怎么接、怎么测（真 Claude 经 Agent SDK，非确定 / 烧 token）。
- **决策**：
  - **① in-process 挂载**（非 stdio 子进程）：`mcpServers:{dicelore:{type:"sdk",instance: createMcpServer(db,deps)}}`。**理由**：企业多 session 并发下，stdio = 每 session 一个额外 Node 子进程（内存 / 启动 / FD 随 session 线性涨），in-process 单 session 开销低一个量级、工具调用无 IPC 跳；瓶颈是 LLM 推理（网络 I/O 秒级），同步 sqlite（微秒~毫秒）可忽略；扩展靠多 orchestrator 实例**分片 session**（webhook payload 带会话标识，[接口 §5](../04-子系统设计/玩家客户端-接口.md)），隔离放实例级（per-session try/catch + 有界 N/实例）；明骰 gate 注入零 hack。承接 ADR-0018「进程内挂载为可选优化」，本期定为**默认**。
  - **② core additive 工厂 + onCanonWrite 写后接缝**：core 加 `createMcpServer(db, deps)`（抽 `main.ts` 的 registerTool 循环；`main.ts` stdio 路径行为不变），在工具处理器**外层包**——工具写规范态成功后回调 `deps.onCanonWrite(evt)`（**不进 `runTool`**，引擎纯逻辑零改动；按实例注入、多 session 安全）。orchestrator 据 `onCanonWrite` 映射 `presentation_delta`（普通写，web refetch 全量对账）/ `roll_committed`（`resolve_*_open` 明骰 verdict）。`deps.rollGate` 经工厂接既有模块级 `setRollGate`（[ADR-0019](#) 的 `awaitPlayerRoll` 接缝）——单人；多 session/多人 per-instance gate 化为未来。详见 [MCP工具面](../04-子系统设计/MCP工具面.md)。
  - **③ GmDriver 抽象**：orchestrator 依赖抽象 `GmDriver`；真实现 `AgentSdkDriver` 包 `@anthropic-ai/claude-agent-sdk` 的 `query()`，测试用脚本化 `FakeGmDriver` → 整个回合循环 / WS / notify / 明骰 gate **全程不烧 LLM 可单测**；真 SDK 跑通另设 `RUN_LIVE=1` opt-in 集成冒烟。Agent SDK 鉴权沿用 env `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN`（密钥只读 env、不入库）。
- **后果**：组件7 实时引擎面 **Phase 1（含单人明骰）实现并合并 `main`**（[玩家客户端 §9.2](../04-子系统设计/玩家客户端.md)），Playwright 端到端实测通过（浏览器发消息 → WS narration 流回）。落 [玩家客户端 §9.2](../04-子系统设计/玩家客户端.md)、[MCP工具面](../04-子系统设计/MCP工具面.md)（工厂 + 接缝）。设计 / 计划：实时引擎面 Phase 1 设计 / 实现计划。**下一阶段**（交接 todo）：多人明骰 per-instance gate 硬化、组件3/4 hook 接入 Agent SDK（Phase 1 用 `turnLoop.runTurnEnd` 物化 choice）、BG3 动效精修、团本制作页（组件5）。**被否**：① stdio 默认挂载（多 session 子进程 sprawl 先到顶、明骰跨进程 gate 须 hack）；② onCanonWrite 写进 `runTool`（破「不改引擎」边界；外层包同样拿得到出参）；③ orchestrator 直接耦合 Agent SDK 不抽 GmDriver（测试须 mock SDK 内部、脆、烧 token）。

## ADR-0021 定位对齐：从「agentic 时代的角色扮演宿主」到「前后端交互界面（开发中）+ 跑团特化 agent 套件」

- **背景**：ADR-0021 初稿把定位升维为「agentic 时代的角色扮演宿主」，核心命题收敛为「把对抗（刺）装回虚拟体验」。进一步梳理后，发现这个定位仍不够精确：它没有区分**界面/平台层**（通用、可接任意 agent / model）与**跑团 agent 套件**（机制特化、有取舍）这两层。原表述「角色扮演宿主」易被误读为只面向角色扮演品类，且对「平台通用性」与「套件特化性」的关系不清晰。
- **决策**：① 定位调整为「**可对接多 agent、多 model 的前后端交互界面（开发中）+ 跑团特化的 agent 套件**」；② 使命重述为「服务想**玩**文字冒险游戏的玩家和想**写**文字冒险剧本的作者」；③ **品类边界重述为套件取舍而非产品级拒绝**——跑团套件的强制掷骰 / 外置状态在纯陪伴场景里是负担（套件特化取舍），但界面 / 平台层通用、不把陪伴列为产品级非目标；④ **新增愿景**：美观 / 优雅 / 现代化的 UI；尽最大可能兼容客制化与社区生态；适配移动端是长期愿景；⑤ 叙事姿态：不点名酒馆 / SillyTavern（讲「提示词范式」），品类词统一「文字冒险游戏」；⑥ 放弃商业化沿用（AGPL-3.0-or-later，无双授权）。
- **后果**：问题域 §一句话 / §6.3、成功标准 §3 非目标、用户与场景增 §4 愿景，均按此口径对齐。**下游技术设计（02/03/04）不变**；三层约束（L1/L2/L3）、GM 塑形（F1/F2/F3）、数据层四域架构全部保留。**被否**：① 保持「角色扮演宿主」——易被误读为只服务角色扮演品类，不能清晰表达界面通用性；② 将「不覆盖纯陪伴品类」列为产品级非目标——过度限定平台层，与界面通用定位矛盾。

---

## 待决策（记录但未定，勿当结论引用）

- ~~**注入机制**：guideline 规则是"安装时焊进 skill 本体" vs "运行时 MCP 读取"~~ → **已由 [ADR-0012](#adr-0012-guideline-载体焊进-skill-本体静态-markdown非运行时-mcp-读取) 决议**：焊进 skill 本体（静态 markdown，走 Claude Code skill 装载）。
- ~~**resolve_choice 是否两阶段**~~ → **已由 [ADR-0009](#adr-0009-narrate-升格散文-stream--一轮范式-agent-回合--输出层三流) 决议**：暂存（轮内可改写）+ 回合末 Stop hook 物化，落地"声明后果在先"。
- **骰面语义**：是否给骰子引擎加"零基(0–9)"模式，还是约定映射。
- ~~**回合分支（branch / swipe）是否 v1**~~ → **已细化（[ADR-0017](#) "细化落地 2026-06-18"）**：branch **进 v1**（快照锚 transcript UUID 树、branch 是自然产物）；**swipe 默认重掷**（从上一快照重生成、不钉骰、不外部播种；反刷骰=稳定键播种记未来 config）。
- ~~**快照存储形态**~~ → **已细化（[ADR-0017](#) "细化落地 2026-06-18"）**：全量快照行 / 回合（解耦子系统）+ **IoC 参与者注册表**（watcher 整表 dump，"运行时态序列化"开放项消解）；接线 = Stop 写 / UserPromptSubmit 检测 restore（[adapter §8](../04-子系统设计/adapter与L3审计.md)）。
- ~~**rule 带外变更与回滚的交互**~~ → **回滚交互已细化**（[ADR-0017](#)：rule 不注册为快照 participant → restore 永不碰 rule、热更自动留存）；**仅"进行中存档遇 rule 版本热更的迁移语义"（`schema_version` / 团本版本迁移）仍待**未来。
- **自研 agent**（呼应 [ADR-0008](#) 被否项）：记为未来待议；对冲已细化（[ADR-0017](#)）= **快照 core agent 无关、仅"对话回退↔快照"关联检测吃基底专属、住 adapter**，换基底只重写关联 hook。
