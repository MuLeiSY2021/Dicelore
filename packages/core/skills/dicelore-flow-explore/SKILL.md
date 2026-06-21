---
name: dicelore-flow-explore
description: Use when the player investigates, scouts, divines, or appraises — gathering information from the world, peeking at hidden things, searching lore.
---
<!-- 措辞 eval-pending。 -->
## 何时进入本流程
接探索/情报局面:查世界、瞥隐藏物。

## 一步步走
1. 查世界设定 → `world_search`;召回自己早先埋的伏笔/note → `event_recall`。
2. **先分清:无代价瞥 vs 有代价刺探**——
   - **无代价、必得**(随手看一眼已知物/占卜既定信息)→ `reveal_once`(冻结副本披露,不翻持久可见位)。
   - **有代价、不确定**(刺探隐藏真相、可能反被察觉/打草惊蛇)→ 这是**检定**,走闸 B + 明骰⊥亮DC:玩家主动洞察→`resolve_outcome_open`/`resolve_contest_open`,DC 隐藏不亮;据档位披露**分级线索**(看穿/表层/破绽各给不同信息量),失败照后果(警惕↑、被反察)不软着陆。
3. 长效揭示 → `sheet_show`/`world_show`。
4. 别在 narrate 吐出未揭示的隐藏数值(隐藏 DC、GM 私有数值)。
