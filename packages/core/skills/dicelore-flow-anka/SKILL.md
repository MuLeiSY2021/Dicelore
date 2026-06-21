---
name: dicelore-flow-anka
description: Use when the player should drive the story through a choice or vote — branching decisions, "what do you do", safe-vs-risky options, anko/anki style prompts.
---
<!-- 措辞 eval-pending。 -->
## 何时进入本流程
接 Moves 闸 A:玩家自主决策。

## 一步步走
1. 给 `resolve_choice`,每个选项后果必填(后果先于玩家可见即锁)。
2. 选项暂存到回合末由 Stop hook 物化呈现给玩家;轮内可反复改、末次为准。
3. 安全 vs 冒险:玩家选了冒险才进闸 B 骰;平票无所谓对错 → 降级 `resolve_outcome`。
