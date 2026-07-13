# 裁决：从真人跑团语料蒸馏「随机驱动叙事」改进 dicegm skill

- [X]  用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> **来源**：用户观察——dicegm skill 推进叙事时偏向「只给选项（`resolve_choice`）」，而真人跑团（安科/安价）里一半甚至以上剧情走向靠随机数（掷骰/抽卡）决定。需派 agent 基于 [`docs/research/scraped/`](../../../../../docs/research/scraped/) 真人跑团记录总结模式、沉淀进 skill。
> **性质**：**元 skill 改进任务**——用 agent 分析真人语料 → 蒸馏模式 → 改进 GM 教条（L2 Principles/Moves）。属 core 层 feat（skill 文本是运行时投递给 GM AI 的教条，影响所有后续 GM 行为，承重）。**本裁决只定义需求与流程，不即刻执行 agent 分析**——用户勾批准后进交付波。

---

## §一 背景与缺口

### 现状

- dicegm skill（[`harness/src/dicegm/skills/dicelore-gm-core/SKILL.md`](../../../../../harness/src/dicegm/skills/dicelore-gm-core/SKILL.md)）已教：
  - **Moves 决策表**：闸 A（能动性·谁拥有决定）→ 闸 B（该不该骰·不确定∧失败有意义）→ 形状表 → 谁掷明/暗骰。
  - **两个极端防护**：「别什么都骰」（该让玩家做主时替骰）/「别什么都让选」（该交运气时让选消解风险）。
  - **Principles**：F1 必掷骰、F2 双边护栏、F3 选对方式、一轮范式、明骰默认、可见性。
  - flow skills：gacha/contest/anka/explore。
  - 注释标 `eval-pending`：终稿靠 skill-creator eval-loop（harness 就绪后复用 L3 信号作 assertions）。

### 缺口（用户观察）

- skill 教了「该骰时骰」的**原则**，但缺从**真人跑团语料**提炼的「随机驱动叙事」**具体模式与榜样**。
- 实际跑起来 AI GM 倾向保守：推进叙事常走 `resolve_choice`（给选项），随机密度不足——与真人安科「一半以上剧情靠 r 决定」的体感差距大。
- 根因推测：原则是抽象的「该骰就骰」，缺①真人 GM「何时让 r、何时自己 r、何时 fy」的密度参照，②「骰出结果怎么接进剧情」的叙述手法榜样，③「用随机制造剧情转折」的 worked examples。AI 没榜样就回落到最安全的「给选项」。

### 数据源

[`docs/research/scraped/`](../../../../../docs/research/scraped/) 3 串 nmbxd 匿名版真人跑团记录（共 1.5M，`scrape.py` 爬取）：


| 文件                                   | 串   | 风格                     |
| -------------------------------------- | ---- | ------------------------ |
| `从刚成年开始的兽人冒险！_38582339.md` | 2021 | 西幻·dnd 风·r 六维建卡 |
| `总之，来抽卡吧_67916530.md`           | 2026 | 抽卡团·卡牌驱动         |
| `恶龙团_54995176.md`                   | 2023 | 西幻·苗床               |

格式：主串（GM 开场）+ 回复（GM 叙事 / 玩家 `r` 掷骰 / 玩家 `fy` 投票 / GM 据结果续写）。是真人安科/安价的完整链路样本。

---

## §二 需求：agent 分析语料 → 蒸馏模式 → 沉淀 skill

### agent 任务（拍死）

派一个 general-purpose agent，读 `docs/research/scraped/` 全部 3 个 md，产出**模式总结** + **skill 改进建议**。分析维度：

1. **随机密度量化**：统计各串里 `r`（掷骰）/ `fy`（投票）/ 纯叙事 的比例，量化「一半以上靠随机」的体感，对照 dicegm skill 现状的期望密度。
2. **随机触发时机**：真人 GM 何时让玩家 `r`（明骰·玩家主动行动/建卡）、何时自己 `r`（暗骰·NPC/世界/隐藏检定）、何时 `fy`（安价·投票定方向）。对照 skill 的闸 A/闸 B/谁掷表，找真人实践与 skill 教条的偏差。
3. **骰后叙述手法**：真人 GM 怎么把随机结果接进剧情——坏结果怎么咬下去（fail-forward）、好结果怎么不给满（防讨好）、随机制造意外转折怎么收。对照 F2 双边护栏 + `references/consequences.md`。
4. **随机驱动的剧情结构**：真人安科如何用一连串随机堆出剧情转折（建卡随机→遭遇随机→结果随机→新局面），而非 GM 预设剧本。对照「play to find out」Agenda。
5. **建卡/抽卡随机链路**：r 六维、抽卡等开局随机如何锚定后续剧情（对接 flow-gacha/建卡轮）。

### 产出物（拍死）

1. **模式总结文档**：落 [`docs/research/`](../../../../../docs/research/) `randomness-narrative-patterns.md`（长存·研究产物），含上述 5 维度的真人模式 + 引用串内具体帖段为证。
2. **skill 改进建议**：对照 `dicelore-gm-core/SKILL.md` 现状，列出具体改动点：
   - **Moves**：强化「别默认给选项」的倾向性——推进叙事时先问「这拍该不该骰」而非「给什么选项」，补真人密度参照。
   - **Principles**：F1 必掷骰补真人榜样（workie examples from scraped）。
   - **新增 reference**：`references/randomness-narrative.md`——真人模式总结 + worked examples（骰后叙述手法、随机转折），供 GM 查阅。
   - flow skills（gacha/contest/anka/explore）：仅当分析发现具体缺口才改，否则不动。
3. **eval case 候选**：从 scraped 提炼可复用 eval 场景（对接 skill-creator eval-loop）。

### 沉淀位置（拍死）

- 主改进落 `harness/src/dicegm/skills/dicelore-gm-core/`（SKILL.md + 新 reference）。
- 模式总结落 `docs/research/randomness-narrative-patterns.md`（研究产物长存，skill reference 引用它或内联精华）。
- **不动** loregm 侧 skill（这是 dicegm 专属问题）。

---

## §三 决策与权衡


| 项                 | 定调                                                      | 理由                                                                                             |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| C1 agent 类型      | general-purpose，不用 worktree                            | 纯读语料 + 产文档，不改代码；worktree 无益                                                       |
| C2 分析范围        | v1 只这 3 串（已有 scraped）                              | just-in-time；后续扩 scraped 走 backlog                                                          |
| C3 量化维度        | 随机密度（r/fy/叙事比例）+ 时机 + 手法 + 结构 + 链路      | 覆盖「为何偏给选项」根因；不只数比例                                                             |
| C4 沉淀主位        | dicelore-gm-core SKILL.md Moves/Principles + 新 reference | L2 教条是判断类唯一载体（memory anko-pbta-alignment）；原则+榜样双修                             |
| C5 新 reference 名 | `references/randomness-narrative.md`                      | 真人模式 + worked examples；与现有 consequences/moves-full/visibility-play 并列                  |
| C6 flow skills     | 默认不动，仅分析发现缺口才改                              | 避免 scope creep；先改核心                                                                       |
| C7 eval 验证       | skill-creator eval-loop（SKILL.md eval-pending 既定路径） | 对比改进前后 GM 骰/选项比例；用 scraped 场景作 eval case（memory：eval 对照真实案例非 baseline） |
| C8 模式总结去向    | `docs/research/randomness-narrative-patterns.md` 长存     | 研究产物；skill reference 内联精华 + 引用                                                        |
| C9 不可逆性        | 承重（skill 影响所有 GM 行为）→ 需用户批准               | L2 教条改全局 GM 行为；可逆但影响面大                                                            |

---

## §四 交付节点（炸成原子需求）

- **RD-1**（agent·研究）：读 `docs/research/scraped/` 3 md，按 §二 5 维度产出模式总结 → `docs/research/randomness-narrative-patterns.md`（含引用帖段为证）。
- **RD-2**（agent·对照）：对照 `dicelore-gm-core/SKILL.md` 现状，产出 skill 改进建议（具体改动点 + diff 草案）。
- **RD-3**（core·skill 改进）：据 RD-2 改 `dicelore-gm-core/SKILL.md`（Moves/Principles）+ 新增 `references/randomness-narrative.md`。
- **RD-4**（eval）：skill-creator eval-loop 验证改进——测试场景下 GM 骰/选项比例变化 + 用 scraped 场景作 eval case。
- **RD-5**（沉淀）：模式总结确认后，skill reference 内联精华；eval 结果回灌 skill 措辞（eval-pending 收口）。
- 依赖：RD-1/2 是 agent 研究（可独立先跑）；RD-3 依赖 RD-2 建议；RD-4 依赖 skill-creator eval-loop harness 就绪（SKILL.md 注释提到「harness 就绪后」）。

---

## §五 与已有裁决 / skill 的关系

- **dicelore-gm-core skill**（改进对象）：SKILL.md + references/{moves-full,consequences,visibility-play,reminders}.md。本裁决新增 `randomness-narrative.md` 与之并列。
- **skill-creator eval-loop**（验证路径）：SKILL.md 注释 `eval-pending` 既定——终稿靠 eval-loop 复用 L3 信号作 assertions。本裁决 RD-4 对接。
- **memory `anko-pbta-alignment`**：anko 与 PbtA 同构，「play to find out」「随机驱动」是正典锚点。本裁决从真人语料补正典落地模式。
- **memory `anko-driver-milestone-vision-language`**：eval 对照真实案例非 baseline——本裁决用 scraped 真人串作 eval case，契合。
- **不改**：loregm skill、flow skills（除非 RD-2 发现具体缺口）、可见性/防剧透裁决（正交）。

---

## §六 范围与风险

- **只定义不执行**：本裁决是需求与流程定义，agent 分析（RD-1/2）在用户勾批准后进交付波才跑。
- **语料局限**：3 串样本偏西幻/抽卡风，可能不代表全品类。v1 接受此局限；后续扩 scraped（`scrape.py` 支持加 THREADS）走 backlog。
- **量化主观性**：「一半以上靠随机」是体感，RD-1 量化时定义清楚 r/fy/叙事的计数口径（按帖、按剧情转折、按回合），避免数字游戏。
- **skill 改进边界**：只改「随机驱动叙事」维度，不顺手重构整个 skill（scope creep）。
