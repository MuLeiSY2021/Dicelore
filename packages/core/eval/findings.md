# Skills eval findings — 分流账本

> 每轮 eval 的 finding **强制分两类**：**A·措辞**（gm-core 文本可改 → 当轮迭代）/ **B·架构·能力缺口**（GM 要的能力现工具/架构给不了 → 记此、路由设计，**不用提示词硬磨**）。判据：grader 看「现架构能否**趁手**满足 GM 的需求」——不能就是 B。

## A · 措辞（已在 gm-core 迭代）

| 轮 | 语料 | finding | 修法 | commit |
|---|---|---|---|---|
| iter1→2 | 兽人 | 建卡/属性掷被当引擎暗掷(真串里玩家自己打 r) | 归明骰「玩家掷自己的命」 | e970740 |
| iter1→2 | 兽人 | 开局轮被范式③逼收 choice | 范式③区分行动轮/纯开局轮 | e970740 |
| iter1→2 | 兽人 | 玩家已决断仍可能补造分叉 | 闸A加「已决断不补分叉」 | e970740 |
| iter1 | 恶龙 | 明骰「亮DC」vs 隐藏AC 冲突,退回暗骰夺走玩家掷 | 「明骰⊥亮DC」:隐藏DC时明骰照给玩家掷、不亮DC | ab99da5 |
| faithful | 探索压价 | flow-explore 漏 `event_recall`、未教「有代价刺探→隐藏DC检定而非 reveal_once」 | flow-explore 补伏笔召回 + 无代价瞥/有代价刺探分支 + 分级线索 | (本轮) |

## B · 架构 / 能力缺口（路由设计，勿提示词硬磨）

> **🟢 已由 faithful 局确认**(探索压价,GM 真跑 37 次 eval/tool.ts)：核心裁决纪律(明暗骰/F1/F2/可见性)工具支撑**足够趁手**;但**叙事脚手架是明显架构缺口**——全靠 hidden sheet 格 + note + FTS 召回硬凑,易烂尾易遗漏。**这正是「该改架构、非改提示词」的信号**(印证用户预判)。

| # | 缺口 | 现状硬凑 | 想要 |
|---|---|---|---|
| B1 | **多情节线/故事线追踪** | 拿隐藏 sheet 格 + 假实体(`剧情线.镇疑云`)当状态机;情节线不是任何实体的属性 | `plotline/thread` 一等抽象:开/进行/收口 + 关联锚点 |
| B2 | **伏笔「埋—回收」闭环** | `event_append note(visible:0)` 埋 + `event_recall` FTS 搜;无 planted/recalled 状态、无回收提醒 → 烂尾 | 伏笔可登记 + 状态机 + 到节点自动浮现「未回收」提醒 |
| B3 | **触发器只能盯数值阈值** | `watcher` 谓词只吃 sheet 数值(`{x}>=60`) | 事件/选项触发:「玩家选了进林」「诱饵进度到2→兜帽人登场」 |
| B4 | **分级线索披露** | `reveal_once` 只能快照 raw cell(要么泄全、要么泄数字);只好把线索塞进 band consequence | 「按检定档披露分级线索散文」原语(线索≠实体属性≠世界条目) |
| B5 | **NPC 表演层 vs 真实层双值** | `resolve_contest` 只能填一个常数底线;表达不了「叫价18/真实不在乎钱、差额即线索」 | NPC 属性带「表演层/真实层」双值 |
| B6 | **GM 待办/悬置钩子看板** | 未触发 watcher / 未回收伏笔 / 状态机 散在三处;`event_recall` 只能搜不能列「未结清单」 | 「当前所有未结张力」一览(GM 侧) |

> **路由**:B1-B6 攒成「叙事脚手架」设计周期——可能新 ADR + 新工具/抽象(plotline / 伏笔 lifecycle / 事件触发器 / 分级线索 / NPC 双层值)。**不在 gm-core 提示词里硬塞**(用户明示:低效甚至无解)。Front/Clock([ADR-0016]) 与 watcher 是部分地基,需评估扩展 vs 新建。

## 小核 nit（非架构、择机修）
- ✅**已修(2026-06-21)** Zod 校验失败一律包成笼统 `INTERNAL`(`sheet_update` op 传 `set`、band 漏 `consequence`、`sheet_show` 传 `attr` 应 `attrs` 都踩过)→ 现 `classify` 摊成字段级 `BAD_INPUT`(`path: 原因`),agent 可自纠。
- ✅**已修(2026-06-21)** `world_search` 出参不带 rowid→无法 reveal:现 `world_search` docs 带 `rowid`。
- ✅**已修(2026-06-21)** `watcher_list` 未暴露(armed watcher 只写不可读)→ 现新增只读工具 `watcher_list`。
- eval 子agent 提示词的工具速查须与真 schema 对齐(`op` 取值 `+|-|=`、`sheet_list` 用 `{entity,prefix?}`、band 必填 `consequence`、`sheet_show` 用 `attrs` 数组)。

## 备注

- faithful 跑法：GM 子agent 经 `eval/tool.ts <db> <tool> <args>` 调**真引擎**（真随机/真抽样/narrate真落event/机械回显真算）→ 真 .db → `grade.ts` 全量评 + `grader.md` 对标语料。
- A 类当轮闭环;B 类攒成下一设计周期 backlog。措辞终稿 eval-pending。
