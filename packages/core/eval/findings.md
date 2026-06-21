# Skills eval findings — 分流账本

> 每轮 eval 的 finding **强制分两类**：**A·措辞**（gm-core 文本可改 → 当轮迭代）/ **B·架构·能力缺口**（GM 要的能力现工具/架构给不了 → 记此、路由设计，**不用提示词硬磨**）。判据：grader 看「现架构能否**趁手**满足 GM 的需求」——不能就是 B。

## A · 措辞（已在 gm-core 迭代）

| 轮 | 语料 | finding | 修法 | commit |
|---|---|---|---|---|
| iter1→2 | 兽人 | 建卡/属性掷被当引擎暗掷(真串里玩家自己打 r) | 归明骰「玩家掷自己的命」 | e970740 |
| iter1→2 | 兽人 | 开局轮被范式③逼收 choice | 范式③区分行动轮/纯开局轮 | e970740 |
| iter1→2 | 兽人 | 玩家已决断仍可能补造分叉 | 闸A加「已决断不补分叉」 | e970740 |
| iter1 | 恶龙 | 明骰「亮DC」vs 隐藏AC 冲突,退回暗骰夺走玩家掷 | 「明骰⊥亮DC」:隐藏DC时明骰照给玩家掷、不亮DC | ab99da5 |

## B · 架构 / 能力缺口（路由设计，勿提示词硬磨）

> 候选/待观察（eval 多迭代中确认是否真缺、现架构能否趁手覆盖）：

- **叙事脚手架:伏笔 / 故事线 / 情节线管理**。现部分覆盖：`event(kind=note,visible=0)`=私货伏笔、`watcher`+Front/Clock([ADR-0016])=预声明威胁线、`world_register`=现编设定。**待 eval 确认**：GM 要「埋伏笔→后续回收」「追踪多条开放故事线」时,note/watcher/Front 是否**趁手**?若否 → 真缺口,可能要：① 伏笔/线索一等结构(payoff 追踪);② 故事线/情节看板工具。→ 路由新 ADR / 新工具,不在 gm-core 硬塞。
- （后续 eval 发现的 B 类追加于此）

## 备注

- faithful 跑法：GM 子agent 经 `eval/tool.ts <db> <tool> <args>` 调**真引擎**（真随机/真抽样/narrate真落event/机械回显真算）→ 真 .db → `grade.ts` 全量评 + `grader.md` 对标语料。
- A 类当轮闭环;B 类攒成下一设计周期 backlog。措辞终稿 eval-pending。
