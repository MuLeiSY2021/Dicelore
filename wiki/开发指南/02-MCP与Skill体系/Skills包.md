# Skills 包（组件3）

> **本页职责**：定"Skills 包"（塑形层 **L2 本体**、可移植 GM 教条）的详细设计——**包结构**（常驻 GM 核心 + 按团本流程库）、**Moves 决策逻辑**（F3 主力：该选/该骰/哪种骰）、**Agenda 议程**（北极星）+ **Principles 教条**（F1/**F2 双边护栏** + 一轮范式 + 可见性纪律）、**补刀措辞**的 L1/L2 分工、**载体**（焊进 `.claude/skills/`）。这是项目差异化的灵魂所在（[项目介绍/是什么与为什么](../../项目介绍/是什么与为什么.md)：治"失控倾向"靠 L2 教）。
> **上游依赖**：[02 §4 塑形层 / 三失败×三杠杆矩阵](../01-核心概念/核心概念.md)；[总体架构 §5 塑形层③ / §6 一轮+三流](../03-架构/总体架构.md)；[技术选型 §2 MCP+Skill](../03-架构/技术选型.md)；[跨agent §2/§4 装载走 Claude Code skill 机制](../03-架构/跨agent与适配层.md)；Principles 焊进（见本页「决策与权衡」节）。平级：[MCP 工具面](MCP工具面.md)（skill 要教 AI 用的工具 + 补刀挂载点）、[内层能力库](../04-子系统设计/内层能力库.md)（仅参考，Skills 不碰存储）。
> **状态**：🟢 已成型（2026-06-03 brainstorming；Moves 决策逻辑扎 [项目介绍/是什么与为什么](../../项目介绍/是什么与为什么.md) + 桌游公认裁决律，结构印证 skill-creator 最佳实践）。

---

## 0. 设计立场：常驻纪律 vs 按团本流程（为什么是两层）

塑形层 L2 落到 Claude Code 的 skill 机制（[跨agent §2](../03-架构/跨agent与适配层.md)），而 skill 是 **`description` 触发** 的、且有"倾向 **under-trigger**（该用不用）"的通病（skill-creator）。这条机制特性把 L2 教条天然劈成两类，决定了包的形态：

| | 谁需要它 | 何时在上下文 | 形态结论 |
|---|---|---|---|
| **常驻纪律** | **每一轮都是 GM 工作**——判断该选该骰、别软着陆、可见性、一轮范式，轮轮都要 | 必须**始终在场**，不能等关键词命中（否则纪律会断档） | 收进**一个常驻 GM 核心 skill** |
| **按团本流程** | 因团而异——抽卡团要抽卡流、战斗团要对抗流，纯安价团两者都不要 | 该流程相关时才载（别让纯安价团背着对抗教条、撑爆上下文） | 拆成**流程 skill 库**，manifest 选、场景触发 |

> **这正是 skill-creator 的"渐进式披露"在本项目的落点**：① metadata（name+desc）恒在 → 两类 skill 的描述都常驻；② SKILL.md body 触发时载 → GM 核心 body = 常驻纪律；③ bundled `references/` 按需 → 深表（全决策表/措辞表/可见性 playbook）+ 各流程 playbook 仅相关时读。

**本页锁定的 4 个决策**（详见各节 + 本页「决策与权衡」节）：

1. **结构 = 两层**：常驻 GM 核心 skill ＋ manifest 选的流程 skill 库（§1）。
2. **Principles 组织 = F 轴（F2 升级为 fail-forward 双边护栏）+ 两新范式簇**，沿 02 §4 矩阵、串成"一轮怎么走"（§3）。
3. **载体 = 焊进** `.claude/skills/`（静态 markdown，顺上游、非回头路）（§6）。
4. **Moves 形态 = 决策表**（两道闸 + 形状表，镜像 resolver 二轴）（§2）。
5. **教条三段式 = Agenda → Principles → Moves**（借自 PbtA）；Agenda 四条（第 0 条"诚实仲裁者"为 Dicelore 特有、凌驾其余）置于 GM 核心 body 顶（§1.2）。

---

## 1. 包结构：常驻 GM 核心 skill ＋ 流程 skill 库

```
.claude/skills/
├── dicelore-gm-core/                ← 常驻：每轮 GM 工作的操作教条（框架预设，恒装）
│   ├── SKILL.md                 ← body（<500 行）：Agenda 议程（顶）+ Moves 决策表 + Principles 纪律 + 补刀指针
│   └── references/              ← 按需深表
│       ├── moves-full.md        ← 全决策表 + 边角 case + worked examples（§2）
│       ├── consequences.md      ← fail-forward 后果手法菜单（坏结果怎么变有趣，§3 F2 双边）
│       ├── visibility-play.md   ← 可见性 playbook：开局 show / 暗值 / reveal_once vs show（§3 可见性簇）
│       └── reminders.md         ← 补刀丰富措辞表（触发→丰富提醒，§5）
└── dicelore-flow-*/                 ← 流程库：manifest 选哪些、init 只拷被选中的
    ├── dicelore-flow-gacha/SKILL.md     抽卡流（world_sample）
    ├── dicelore-flow-contest/SKILL.md   对抗流（resolve_contest）
    ├── dicelore-flow-anka/SKILL.md      安价流（resolve_choice）
    └── dicelore-flow-explore/SKILL.md   探索流（world_search / reveal_once）
```

- **GM 核心 = 常驻"交警"**：Moves + Principles **合在一个 skill**——它俩都"每轮必在"，拆成两个都要 always-trigger 只会把 under-trigger 风险翻倍、增协调成本。Moves 判完"这是抽卡局面"就**派发到对应流程 skill**（名副其实）。
- **流程 skill = 各 genre 的 playbook**：每流程一独立 skill、自带 genre-context 描述、相关时触发。manifest"选 skill" ＝ `dicelore init` 只把被选中的拷进 `.claude/skills/`（[团本与 manifest](../04-子系统设计/团本与manifest.md) 定选择接口；本页只定 skill 侧形状，§4）。
- **GM 核心是框架预设、恒装**；流程库是**可扩展开放集**——新 genre 加一个 `dicelore-flow-*` 即可，不动核心。

### 1.1 `description` 是唯一触发器——两种写法

skill-creator：**`description` 是 skill 被不被调用的首要机制，且模型倾向 under-trigger，描述要"pushy"**。故两类 skill 的描述写法分明：

- **GM 核心（要"每轮都在"）**：描述写成**覆盖全部 GM 动作**的常驻式，例：
  > "Use on **every turn** of running an anko/anka (dice/vote-driven interactive fiction) session as GM: deciding whether to offer the player a choice or roll dice and which roll, respecting roll results without soft-landing, managing what the player can see. Consult this even when the GM action seems simple."
- **流程 skill（要"genre 相关才触发"）**：描述锚定该 genre 的触发语境，例（抽卡流）：
  > "Use when the game involves drawing from a card/loot/gacha pool — rolling for rarity, fabricating drawn-card content, fusing or chaining card effects."

> **⚠️ 常驻的*保证*不能只靠 description**：skill-creator 明确——**简单一步查询可能根本不触发 skill**。对"每轮 GM 工作"这种应当恒在的核心，光靠触发不保险。**常驻保证机制**（`dicelore init` 写 `CLAUDE.md` 指针 / 系统上下文 / hook 每轮强化）属 **[adapter 与 L3 审计](../04-子系统设计/adapter与L3审计.md) / [跨agent §4](../03-架构/跨agent与适配层.md)**——本页只**定内容与结构**，并把描述写到**最大化触发**。

### 1.2 GM 核心 body 的顶层：Agenda 议程（为什么坐在这）

承接 [02 §4.1 三段式](../01-核心概念/核心概念.md)：塑形教条 = **Agenda（为什么）→ Principles（怎么，§3）→ Moves（做什么，§2）**。Agenda 是 GM 核心 body 的**最顶**、凌驾一切的北极星，开局也经 SessionStart 注入（[adapter §2](../04-子系统设计/adapter与L3审计.md)）：

0. **你是世界的诚实仲裁者，不是玩家的取悦者。**（Dicelore 特有、凌驾其余——人类 GM 无讨好病，这是 Dicelore 与 PbtA 的分水岭。）
1. **描绘一个会自己呼吸的世界**——世界有自己的因果、数值与进程（world / sheet / watcher 驱动），不是为取悦玩家布置的背景板。
2. **让玩家的选择带来真实的后果**——后果声明在先、骰子说了算；冒险感来自"选择有重量"。
3. **玩出来看会发生什么（play to find out）**——不预先知道结局、不朝"满意的结局"叙事；由骰子、watcher、玩家选择共同决定。

> **Agenda 是 F 轴的"为什么"根**：F2 软着陆同时违背第 2、3 条，F1 跳骰违背第 3 条——把禁令升级为"违背了你来这里的根本目的"。**"Moves 是 GM 唯一合法动作"** 这条 PbtA 铁律在 Dicelore 由 [MCP 工具面](MCP工具面.md) 的封闭工具集（L1）机械兑现，Moves（§2）只教"该用其中哪个"。

---

## 2. Moves（GM 动作）+ 判定时机：F3 主力（该选 / 该骰 / 哪种骰）

承接 [02 §4 矩阵](../01-核心概念/核心概念.md)（F3「选错方式」主力靠 **L2 教**）+ [总体架构 §6 数据流](../03-架构/总体架构.md)。这是 GM 核心 body 的头号内容。

**它要治的失败（F3，双向）**——直接来自 [项目介绍/是什么与为什么](../../项目介绍/是什么与为什么.md)观测：

> AI 容易走两个极端:**什么都骰**（该让玩家做主时替玩家骰 → 剥夺能动性）/ **什么都让选**（该交给运气/对抗时让玩家选 → 消解风险感）。

Moves 的形态 = **两道闸 + 形状表**（非流程图——流程图太刚硬、且裁决路由本非严格线性；skill-creator 反对硬结构、要教判断）。证据三角：[项目介绍/是什么与为什么](../../项目介绍/是什么与为什么.md) + 桌游公认裁决律 + 已锁 [resolver 二轴](MCP工具面.md)。

### 2.1 闸门 A · 谁拥有这个决定？（能动性）

- 玩家**自主决策**（往哪走、攻不攻、用什么策略）→ **`resolve_choice`**（后果必填、暂存到回合末物化）。
  - 锚：兽人团"附近的森林 / 去草原抓 / 在路上蹲人"方向选项让玩家选。
- 不是玩家自主（命中没、抽到啥、掉多少血）→ 进**闸门 B**。

### 2.2 闸门 B · 该不该骰？（判定时机 / When to make a move：不确定 ∧ 失败有意义）

桌游圈被反复引用的铁律（Vincent Baker《Apocalypse World》系，独立设计圈共识）：**"每次要求掷骰，都应意味着*无论结果如何*都有有趣的事发生；若结果对故事不重要、或失败会让故事停摆，就别让人掷。"** 落成两问：

- 结果**不确定**吗（可能失败）？ ∧ 失败/坏结果**有真实后果**吗？
  - **两者都是 → 骰**（进 §2.3 形状表）。
  - **否则**（必成/必败、失败只是"再来一次"、对故事无关）→ **别骰，直接 `narrate`**（或与玩家商量）。这治"什么都骰"的过度——剥夺节奏与能动性。

### 2.3 形状表 · 骰什么 → 哪个工具（镜像 resolver 二轴）

每行带"何时/为什么"判据 + 语料锚（教判断、非死记）：

| 结果形状 | 工具 | 何时用（判据） | 语料锚（[项目介绍/是什么与为什么](../../项目介绍/是什么与为什么.md)） |
|---|---|---|---|
| **label** 叙事档位 | `resolve_outcome` | 结果是"哪一档后果/方向"，GM 预设档位表 | 兽人团"找到什么猎物"随机表 |
| **verdict** 胜负 | `resolve_contest` | 两方**对抗** 或 **过线检定**（DC＝一边退化成常数） | 命中 `r+力量` vs AC；融合检定 vs 50/90 |
| **number** 数值 | `sheet_update` 带骰 | 结果是**具体数值变化**（伤害/成长/资源增减） | roll HP 上升量、开局 roll 六维、掉血 |
| **content** 抽内容 | `world_sample` | 从**池子**随机抽一行（卡/掉落/遭遇/随机表） | 抽卡团 d100 定品质抽卡池 |

> **注**：`sheet_update` 带骰是"状态骰下沉"（见设计页决策节），其 L1 工具名摩擦已没（不再有独立 `roll_value` 逼 AI 分辨"该掷还是该设"），**全靠本表 L2 教 + L3 账本审计兜**——Moves 在此承担的塑形权重最高。

### 2.4 谁掷？明骰 vs 暗骰（L1 工具名分流，GM 须显式选）<sup>eval-pending</sup>

形状表定了"骰什么"，还差一问:**这一掷是玩家的，还是 GM/世界的?** 承接 玩家闸控明骰设计 §1/§2——`resolve_outcome` / `resolve_contest` 各按"谁掷"**拆成不同 L1 工具名**(`_open` / `_hidden`)，不加布尔参，逼 GM 在调用处显式回答这一问，而非默认替玩家拍板。

| 谁掷 | 局面 | 工具（L1 名分流） | 行为 |
|---|---|---|---|
| **明骰**（玩家闸控） | **玩家主动行动**的检定——你攻击 / 你说服 / 你潜行，命运握在玩家自己手里 | `resolve_outcome_open` / `resolve_contest_open` | 把"掷骰这个动作"交还玩家:客户端亮 DC、玩家点击触发、见证成败。**点数仍由引擎在点击时算（anti-F1 不破）** |
| **暗骰**（引擎自动） | **NPC / 世界 / 暗检定**——敌人攻击你、暗感知、隐藏 DC 的检定，不归玩家做主 | `resolve_outcome_hidden` / `resolve_contest_hidden` | 引擎自动掷、GM 替掷，回合内同步返回 verdict |

- **这是 L1 工具名分流，不是参数开关**——选 `_open` 还是 `_hidden` 就是 GM 对"谁拥有这一掷"的显式表态(镜像 [resolver 二轴](MCP工具面.md):一轴是结果形状 outcome/contest，正交的另一轴才是明/暗谁掷)。
- **明骰是阻塞式调用**:`resolve_*_open` 阻塞到玩家点击、结果作工具返回值在同回合内回给 GM(机制详 设计 §3)。裸 CC 无前端时自动降级为立即掷。
- **可见性正交**:明骰本就"亮"(DC/点数 `visible=1`);要真隐藏结果仍走 `visible`，不靠这一分流。明暗轴只管"谁掷"。

> 现编卡 / 抽内容(`world_sample`)与数值骰(`sheet_update`)暂不入明暗分流——v1 只对玩家面向的 outcome/contest 裁决拆 `_open`(先单人，详 设计 §11)。

### 2.5 两个混合 / 降级补丁

不必非选即骰——语料与裁决律都点到的两种常见复合：

- **安全 vs 冒险**：给"稳妥选项 / 冒险一掷"的 `resolve_choice`，玩家**选了冒险才进闸门 B 骰**。既给能动性又给风险买入（narrative dice 共识：玩家自己选择承担风险 → buy-in）。
- **打平降级**：`resolve_choice` 平票且"无所谓对错" → 降级 `resolve_outcome` 掷定（兽人团"你们咋刚好平票呢"→"直接 r 也行"）。

### 2.6 派发到流程 skill

Moves 判明 genre 局面后，把细节让位给对应流程 skill（§4）：判出"这是抽卡" → consult `dicelore-flow-gacha`；"这是对抗" → `dicelore-flow-contest`。**Moves 管"走哪条路"，流程 skill 管"这条路怎么一步步走"。**

> 全决策表（含边角 case：连续检定、群体目标逐个结算、检定隐藏 DC 等）+ worked examples（"玩家说 X → Moves 判 Y → 调 Z"）放 `references/moves-full.md`，body 只留上面骨架（守 <500 行）。

---

## 3. Principles 教条：F 轴 + 两新范式簇，串成"一轮怎么走"

承接 [02 §4 三失败×L2](../01-核心概念/核心概念.md)。Principles 是 02 §4 矩阵的 **L2 列**，故**主轴沿用 F1/F2/F3**（可直接回指上游）；本轮（2026-06-03 R1/R2）新概念让它**长出两簇新纪律**。**业务域是错的轴**（那是 §2 Moves 和 §4 流程的轴；纪律是行为问题、非数据域问题）。

**写法纪律（skill-creator）**：**imperative + 讲 why、忌堆硬 MUST**；呈现上**顺着"一轮怎么走"**串，让 AI 读成"怎么主持一轮"而非"一串禁令"。

| 簇 | 治什么 | 要点（讲 why） |
|---|---|---|
| **F1 必掷骰** | 跳过骰子 | 该裁决处**必经裁决工具**——随机/取真值在引擎内、AI 给不出真值（L1 已焊，[03 §4](../03-架构/总体架构.md)）；Principles 教"识别该裁决的时机、别用散文绕过"。*why*：玩家的风险感来自结果不可由 GM 编造。 |
| **F2 双边护栏** | 不尊重结果（两向） | **上边界 anti-讨好**：骰出坏结果照后果叙述，不挽救、不淡化、不强行转圜（`resolve_*` 后果必填且先于玩家可见即锁，L1）。**下边界 anti-死胡同**（借 PbtA fail-forward）：坏结果也不能退化成"什么都没发生"——要咬下去并**打开新局面**。*why*：失败被真实计入胜利才有重量；但失败让故事停摆同样糟。锚：恶龙团"大失败→一尾巴拍死 NPC"。详手法 → `references/consequences.md`。 |
| **fail-forward 手法**（F2 下边界 craft） | 失败如何推进 | **三档结果**（完全 / 部分成功带代价 / 失败有后果，零代价得手是例外，对齐 `resolve_outcome` 的 bands）；**软招 vs 硬招**（玩家只是看着你→软招：预告威胁、推进 Clock；送黄金机会或骰出失败→硬招：扣血、触发 Front）；**后果手法菜单**（切退路 / 惩罚某类检定 / 失而复得付代价 / 施加 condition / 消耗资源 / 驱动末日钟）；**"有时失败就是失败"**（不推进剧情的检定可直接失败，别硬造后果）。借自 PbtA / Gnome Stew，详表 → `references/consequences.md`。 |
| **F3 选对方式** | 选错处理 | **薄**——指向 §2 Moves 决策表（F3 主力在那）。此处只留一句纲领："谁拥有决定 → 谁来定结果"。 |
| **一轮范式纪律**（R1 新） | 范式漂移 | ① **像作者写一段**：任何工具轮内可多次任意序穿插；② **`narrate` 是散文 stream、非终结步骤**；③ **非终局轮回合末必须留有暂存 `resolve_choice`**（否则把玩家晾着＝违规，L3 当场查）；④ **只 narrate 色彩、不吐数值菜单**（机械回显由输出层流②渲染，AI 吐＝费 token 又易错）。 |
| **可见性纪律**（R2 新） | 暗值泄漏 / 该露不露 | ① **开局 `sheet_show` 玩家自己人物卡一次**（默认全隐）；② **暗值用强制隐藏（`visible=2`）焊死**，entity-show 也不揭；③ **别在 `narrate` 散文里吐出隐藏数值**（好感度暗值、隐藏 DC、GM 私有信息）；④ 揭示用 `show`（持久）/ 一次性瞥用 `reveal_once`（快照）。详 playbook → `references/visibility-play.md`。 |
| **明骰默认簇**（R3 新）<sup>eval-pending</sup> | 替玩家拍板开骰 | **玩家主动行动的高风险掷，默认做成明骰**(`resolve_*_open`)——别替玩家把骰子掷了再把结果端上来。识别"这是玩家在替自己冒险"(你攻、你说服、你潜行)就走 `_open`，把"掷"这个动作交还玩家;NPC/世界/暗检定才走 `_hidden`(§2.4)。*why*:语料里的参与感诉求——"若所有掷骰都由引擎自动定，玩家会觉得还不是 AI 直接决定我的命运"；让玩家亲手点下那一掷、亮着 DC 见证成败，风险才有重量、能动性才落地("决定自己的命运")。**点数仍归引擎(anti-F1)**——交还的是动作、不是真值。镜像 [resolver 二轴](MCP工具面.md) 的明/暗轴，详 设计 §1/§7。 |

> **恶龙团的"分层范式"是 F2 的可教范本**（[项目介绍/是什么与为什么](../../项目介绍/是什么与为什么.md)）：PO **事先声明烈度边界**（"巨龙传奇抗性，失败可改成功一天三次；剧情大部分不强求严重失败"）再**一致执行**——战斗照骰（硬）、剧情选择不让一次脑抽团灭（软）。Principles 把"该硬的硬、该兜的兜、且事先声明"教成 GM 的分寸感，而非一刀切"永远硬着陆"。

---

## 4. 流程 skill 库：形态与接口

承接项目"流程库"取向。每个流程 skill 是某 genre 的**操作 playbook**，**建立在 §2 Moves 与裁决工具之上**，不重复纪律（纪律在 GM 核心）。

**一个流程 skill 的结构模板**（以对抗流为例）：

```markdown
---
name: dicelore-flow-contest
description: Use when resolving a contested action or skill check —
  combat hit, persuasion vs resistance, a check against a DC. （genre-context 触发）
---
## 何时进入本流程        ← 接 Moves 形状表的 verdict 行
## 一步步走
  1. 取双方属性引用（{张三.攻击} vs {哥布林.AC}），DC＝一边常数 expr
  2. 调 resolve_contest，引擎取真值+掷+比大小（AI 给不出真值）
  3. 据 winner narrate；败方后果可能 sheet_update 带骰（掉血）
  4. 群体目标逐个结算 / 连续对抗的处理
## 与本 genre 规则的接口   ← rule 域被动召回的约束在此套用（hook 注入，非本页）
```

**与裁决工具/Moves 的调用关系**：流程 skill **只编排已有 MCP 工具的调用序**（哪个工具、给什么引用、产出后怎么 narrate / 写 sheet），**不新增工具、不碰 schema**（schema 归 [MCP 工具面](MCP工具面.md)）、**不碰存储**（归 [内层能力库](../04-子系统设计/内层能力库.md)）。

**流程清单（v1 起步 + 开放扩展）**：

| 流程 skill | 主裁决工具 | 对应 genre | 锚 |
|---|---|---|---|
| `dicelore-flow-gacha` | `world_sample`（+ `world_register` 现编卡） | 抽卡 | 抽卡团 |
| `dicelore-flow-contest` | `resolve_contest`（+ `sheet_update` 后果） | 战斗/检定 | 兽人团 |
| `dicelore-flow-anka` | `resolve_choice`（暂存→物化） | 安价/投票 | 通用 |
| `dicelore-flow-explore` | `world_search` / `reveal_once`（侦查/鉴定/占卜） | 探索/情报 | — |

> **manifest 怎么声明"选哪些 skill"、版本迁移** → [团本与 manifest](../04-子系统设计/团本与manifest.md)（本页只定 skill 侧的接口形状：一个 `dicelore-flow-*` 目录 + genre-context 描述 + 编排已有工具）。

---

## 5. 补刀措辞：MCP 基线（L1） vs Skills 丰富版（L2）的分工

承接 [MCP 工具面 §5](MCP工具面.md)（已定**字段 + 触发位**，把"措辞"踢给本页）+ [03 §2/§4.1/§5](../03-架构/总体架构.md)（L1/L2 混合）。

| | 谁说 | 形态 | 触发 |
|---|---|---|---|
| **MCP `reminders`（L1 基线）** | MCP server 内置一张**极小**的"结构触发→短提醒"表 | **terse 反射**、绕不过（如：命中失败档→"尊重结果，别软着陆"；后果已锁→"叙述须与已锁后果一致"） | 客观结构条件（失败档、账本异常） |
| **Skills Principles（L2 丰富版）** | 本包 Principles + `references/reminders.md` 措辞表 | **doctrine + why**（"别软着陆为什么伤能动性…"），AI 已内化 | 始终在场（常驻核心） |

**不打架的关键**：reminder 是 AI **已内化教条**的即时回声（terse pointer），Principles 是教条本身——前者是后者的子集，不矛盾。**v1 不让 hook 往 `reminders` 字段塞富文本**：MCP §5 那句"可由 Principles/hook 增补"读作"**AI 用内化 doctrine 增补自己的输出**"，**不是运行时把 L2 富文本拼进 MCP 出参**（否则又把 L2 漏进 MCP 承载、违 [技术选型 §2](../03-架构/技术选型.md)）。

> 丰富措辞表（每条＝触发情境 → 丰富提醒文案）落 `references/reminders.md`，**最终文案靠 §6 的 eval-loop 调**；本页只定**分工边界与触发情境**，不定 eval-tune 后的终稿。

---

## 6. 载体与装载：焊进 `.claude/skills/`（见本页「决策与权衡」节）

承接 [技术选型 §2](../03-架构/技术选型.md)（Skill 承载 L2）+ [跨agent §2/§4](../03-架构/跨agent与适配层.md)（L2 教条放 `.claude/skills/`、走 Claude Code skill 机制装载）。

- **决策 = 安装时焊进 skill 本体**（静态 markdown，`dicelore init` 写进 `.claude/skills/`），**非"运行时 MCP 读取"**。
  - **顺上游、非回头路**：上游已蕴含焊进；只需**本页决策**收口原"待决策"。
  - **被否「运行时 MCP 读取 Principles」**：会让 **MCP 承载 L2 = 范畴错误**（正是 [03 §5](../03-架构/总体架构.md) 警告的"把正交轴误当一层"），且须开回头路改 [技术选型 §2](../03-架构/技术选型.md)。
- **core 标准 / 装载绑定的边界**（[跨agent §1](../03-架构/跨agent与适配层.md)）：**教条内容（markdown）是 core 标准件、未来可搬**；**装载机制绑 Claude Code skill**。换基底时教条本身不动，重做装载层。
- **被动 rule 召回 ≠ Principles**：rule 是 **rule 数据域**、由 hook 被动注入（[跨agent §3](../03-架构/跨agent与适配层.md)）；Principles 是 L2 静态教条。别混。

### 6.1 措辞迭代：eval-loop（对照真实案例）

Principles / Moves / 措辞表的**最终措辞**不在本页拍死——按 skill-creator 的**评测循环**在实现期迭代：**对照 `docs/research` 真实案例**定性评判（评测对照系修订：废 with/without baseline A/B、量化不可行→定性报告，见设计页决策节）。**F1/F2/F3 是可客观验证的失败**（项目本就有 L3 审计：**掷骰绕过率、后果-叙事一致性**），故 **L3 审计信号可直接复用作 eval assertions**（"该掷处真掷了吗？坏结果软着陆了吗？该 choice 处替玩家骰了吗？"）。本页定 **content-area 与结构**，留终稿措辞给实现期评测。

> **eval-loop 工装已落源码、方法已成蓝本** → [Skills eval-loop](../04-子系统设计/Skills-eval.md)：玩家视图（`buildPlayerView`）当评分基准、机械断言（`backend/src/eval/assertions`）当地板、**真人安价语料（[`docs/research/scraped`](../../../docs/research/scraped/)）当 grader 黄金标准**、4 场景各带语料 reference。未来每轮 gm-core 措辞迭代以此为据。

---

## 决策与权衡

本页两条关键决策的"为什么 + 被否"重述于此（历史全文见归档，以本节为准）。

### D1 · guideline（Principles）载体 = 焊进 skill 本体（静态 markdown），非运行时 MCP 读取

- **背景**：填 L2 教条（dispatcher/guideline/补刀措辞）的载体时，曾在"安装时焊进 skill 本体（`dicelore init` 写进 `.claude/skills/` 的静态 markdown）"与"运行时 MCP 读取（MCP 工具 / `reminders` 动态供给）"两候选间待决——该选择直接决定 Skills 包形态。
- **决策**：**焊进 skill 本体**。guideline 作静态 markdown，走 [跨agent §2/§4](../03-架构/跨agent与适配层.md) 既定的 Claude Code skill 装载路径（放 `.claude/skills/`）。**这不是回头路**——[技术选型 §2](../03-架构/技术选型.md)（Skill 承载 L2 / MCP 承载 L1）+ 跨agent §2（L2 教条放 `.claude/skills/` 装载）已蕴含焊进；本决策只把原"待决策"升格收口，不改 02/03。
- **后果**：教条内容（markdown）是 **core 标准件、未来可搬**；装载机制绑 Claude Code skill。补刀分工随之确定——MCP `reminders` 只内置极小 L1 基线（terse 反射），丰富措辞活在焊进的 guideline 里（L2）；v1 不让 hook 往 `reminders` 塞 L2 富文本（详 §5）。
- **被否**：**运行时 MCP 读取 guideline**——会让 MCP 承载 L2 = 范畴错误（[03 §5](../03-架构/总体架构.md) 警告"把正交轴误当一层"），且须开回头路改 [技术选型 §2](../03-架构/技术选型.md)。
- **后续改名注解**：`guideline` 已统一更名为 **Principles**（PbtA 术语对齐，见 D2；语义不变）。

### D2 · 全盘对齐 PbtA 术语 + 新增 Agenda 议程层 + F2 双边护栏（fail-forward）+ Front/Clock 团本内容类型

- **背景**：04 全区定稿后做了一轮英文 TRPG 设计正典调研（PbtA / Dungeon World 的 Agenda·Principles·Moves、Alexandrian 节点式剧本、Gnome Stew 的 fail-forward、AW Fronts/Clocks），与现架构逐层比对。结论：Dicelore 独立重建出的 GM 塑形架构本质就是 PbtA 最硬核的分支——差别只在 PbtA 靠社会约定让人类 GM 自律，而 Dicelore 面对的"GM"是有讨好本能、无社交羞耻心的 LLM，凡 PbtA 信任 GM 自律之处 Dicelore 都须机械强制。比对暴露三处可落地缺口（F2 只防单边、缺顶层 Agenda、团本无"会自己推进的威胁"单元）+ 一处术语未对齐。
- **决策（五连）**：
  1. **术语全盘对齐**：有 PbtA 强对应物的升为一等术语——`guideline → Principles`、`dispatcher 形状表 + 两道闸 → Moves + 判定时机`、`resolve_outcome 三档结果对齐（完全/部分/失败）`（工具名不改，仅文档对齐）。**边界 = 保留独有抽象**：`resolver 二轴` / `四业务域` / `三层 L1·L2·L3` / `F1·F2·F3 失败诊断` / `watcher` 保留原名，不为对齐硬套 PbtA 壳。
  2. **新增 Agenda 议程层**：L2 教条采三段式 **Agenda（为什么）→ Principles（怎么）→ Moves（做什么）**。Agenda 四条，第 0 条"诚实仲裁者"为 Dicelore 特有、凌驾其余（§1.2）；其余三条借自 DW。Agenda 给 F 轴提供"为什么"的根。
  3. **F2 升级为双边护栏**：坏结果既不能被洗成好结果（上边界 anti-讨好），也不能退化成"什么都没发生"（下边界 anti-死胡同，借 PbtA fail-forward）。引入可教 craft（三档结果 / 软招·硬招 / 后果手法菜单 / Clock / "有时失败就是失败"），落 Principles + `references/consequences.md`（§3）。
  4. **新增 Front/Clock 团本内容类型**：建在已有 `watcher` + `sheet 钟`之上，非新底层机制；把"团本预声明 watcher"从原"留未来"裁定**提前纳入 v1**（PbtA 正典表明 Front 是作者备团的核心单元）。格式与 import 映射归 [团本与 manifest](../04-子系统设计/团本与manifest.md)。
  5. **定位陈述 + 洋葱层旁证**（纯阐释，不改结构）：定位陈述（Dicelore = PbtA 纪律的机械强制版）入 02；AW 的"洋葱层优雅坍缩"≈ Dicelore 的"L2 漏 → L1 工具地板兜底 → L3 审计网"入 03。
- **后果**：塑形层教条从两段式（guideline + dispatcher）升为**三段式（Agenda / Principles / Moves）**；团本多一类"会自己上发条"的 Front/Clock 内容；F2 有了可教的 fail-forward 手法表。
- **被否**：① 只锚注不改名（框架不吸收新结构，放弃 Agenda / Front 的实际收益）；② 最大化套壳（连 resolver 二轴 / 四域 / F 轴也套 PbtA 词——用为人类设计的词去装 Dicelore 针对 AI 的独有机制，损失精度）；③ Front 仍留未来（放弃作者备团核心单元，与正典背离）。

---

## 本页**不**负责定的

- **skill 怎么注入 / 常驻的*保证*机制**（CLAUDE.md 指针、系统上下文、hook 强化、`narrate` 降级）→ [adapter 与 L3 审计](../04-子系统设计/adapter与L3审计.md) / [跨agent §4](../03-架构/跨agent与适配层.md)
- **manifest 如何声明"选哪些流程 skill"、版本迁移** → [团本与 manifest](../04-子系统设计/团本与manifest.md)（本页只定 skill 侧接口形状）
- **工具入参/出参 schema、补刀的*结构挂载点*（`reminders` 字段）** → [MCP 工具面](MCP工具面.md)（本页只定**措辞**与触发情境）
- **表 schema、`expr` 文法、`visible` 列存储 / 强制隐藏标记 / `reveal_once` 写入语义** → [内层能力库](../04-子系统设计/内层能力库.md)（Skills 不碰存储）
- **L3 Hook / 裁判 subagent 实现、eval-loop 工程** → [adapter 与 L3 审计](../04-子系统设计/adapter与L3审计.md) / 实现期
