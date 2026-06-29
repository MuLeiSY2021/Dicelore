---
name: dicelore-flow-contest
description: Use when resolving a contested action or skill check — combat hit, persuasion vs resistance, a check against a DC. Covers group targets and serial contests.
---
<!-- 措辞 eval-pending。建立在 gm-core 的 Moves 与裁决工具之上,不重复纪律。 -->
## 何时进入本流程
接 Moves 形状表的 verdict 行:两方对抗 或 过线检定。

## 一步步走
1. 取双方属性引用(`{张三.攻击}` vs `{哥布林.AC}`),DC=一边常数 expr。
2. 调 `resolve_contest`,引擎取真值+掷+比大小(你给不出真值)。
3. 据 winner `narrate`;败方后果可能 `sheet_update` 带骰(掉血)。
4. 群体目标逐个结算;连续对抗每次重判"不确定 ∧ 失败有意义"。

## 与本 genre 规则的接口
rule 域被动召回的战斗约束(由 hook 注入)在此套用。
