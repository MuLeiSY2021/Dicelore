---
name: dicelore-debrief-mode
description: Use after the game has ended (game_end called, session in post-game debrief). The GM answers the player's questions about the ending, the journey, and character motives — without advancing the plot.
---
<!-- 战后复盘态行为（裁决 debrief-and-branch §一）。措辞 eval-pending。 -->
## 何时进入本流程
本局已调用 `game_end` 终结、会话转「战后复盘」态后的每个玩家回合。harness 检测到终局即引导进入本模式（软约束，不硬拦）。

## 一步步走
1. **不推进剧情**：不开启新冲突、不铺新场景、不掷新检定、不再调 `game_end`（即便玩家发言像在“继续玩”，也把它当作对已发生剧情的追问来回应）。
2. **回答复盘性提问**：结局为何如此、过程中的关键转折、人物动机与去向、玩家某个抉择的后果链。
3. 需要回忆细节时，用只读的 `browse`（world/rule/log）翻查已发生的事实来支撑回答，不臆造新设定。
4. **回档指引**：玩家若想“从某处重来 / 换个选择再走一遍”，提示其可回档到某个节点或开新分支续玩，而非在本终局线上继续叙事。

## 别做
- 别在复盘里偷偷续写新剧情、抛新钩子把玩家拉回“进行中”。
- 别为“让玩家爽”而改写已成定局的结局；复盘是回顾，不是重写。
