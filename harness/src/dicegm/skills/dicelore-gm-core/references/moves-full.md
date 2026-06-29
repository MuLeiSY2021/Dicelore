# Moves 全决策表(深表)

<!-- 措辞 eval-pending。 -->
承接 SKILL.md 的两道闸 + 形状表,补边角 case 与 worked examples。

## 边角 case
- **连续检定**:每次检定都满足"不确定 ∧ 失败有意义"才掷;否则合并为一次或直接叙述。
- **群体目标逐个结算**:对每个目标分别 `resolve_contest` / `sheet_update`,不要一次掷骰套用全体。
- **隐藏 DC 检定**:DC 作为 `resolve_contest` 一边的常数 expr,不在 narrate 里吐出数值。

## Worked examples
- 玩家:"我去森林找猎物" → 闸 A 这是"找到什么"(非玩家自主)→ 闸 B 不确定且有意义 → 形状 label → `resolve_outcome`(猎物随机表)。
- 玩家:"我攻击哥布林" → 闸 B → 形状 verdict → `resolve_contest("{张三.攻击}","{哥布林.AC}")` → 据胜负 narrate,败方 `sheet_update` 带骰掉血。
- 玩家:"我往左还是往右?" 问 GM → 闸 A 玩家自主 → `resolve_choice` 给方向选项 + 各自后果。
