# Moves 全决策表(深表)

<!-- 措辞 eval-pending。 -->
承接 SKILL.md 的两道闸 + 形状表,补边角 case 与 worked examples。

## 边角 case
- **连续检定**:每次检定都满足"不确定 ∧ 失败有意义"才掷;否则合并为一次或直接叙述。
- **群体目标逐个结算**:对每个目标分别 `resolve_contest_open`/`resolve_contest_hidden`(按「谁掷」二分) / `sheet_update`,不要一次掷骰套用全体。
- **隐藏 DC 检定**:玩家主动行动但目标 DC/对手值隐藏 → 仍用**明骰** `resolve_contest_open`(玩家掷、见证),DC 作为一边常数 expr 但不亮(卡显 `vs ???`)、也不在 narrate 里吐出数值;纯 NPC/暗检定才用 `resolve_contest_hidden`。

## Worked examples
- 玩家:"我去森林找猎物" → 闸 A 这是"找到什么"(非玩家自主)→ 闸 B 不确定且有意义 → 形状 label → 暗骰 `resolve_outcome_hidden`(猎物随机表,引擎自动掷)。
- 玩家:"我攻击哥布林" → 闸 B → 形状 verdict → 玩家主动行动=明骰 `resolve_contest_open`(a=`{张三.攻击}`、b=`{哥布林.AC}`,玩家点击掷) → 据胜负 narrate,败方 `sheet_update` 带骰掉血。
- 玩家:"我往左还是往右?" 问 GM → 闸 A 玩家自主 → `resolve_choice` 给方向选项 + 各自后果。
