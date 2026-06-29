---
name: dicelore-flow-gacha
description: Use when the game involves drawing from a card/loot/gacha pool — rolling for rarity, fabricating drawn-card content, fusing or chaining card effects.
---
<!-- 措辞 eval-pending。 -->
## 何时进入本流程
接 Moves 形状表的 content 行:从池子随机抽。

## 一步步走
1. 确定池子与过滤条件(品质/类别),调 `world_sample` 随机抽一行(结果空间来自 store,你不编造抽到啥)。
2. 现编卡面内容时 `world_register` 写回 world(source=ai),保持结构。
3. 据抽到的卡 `narrate` 色彩;若涉及数值入卡 → `sheet_update`。
