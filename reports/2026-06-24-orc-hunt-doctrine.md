# orc-hunt · doctrine · 2026-06-24（RUN_LIVE 首份·通路验证 + 开场观测）

> 首份 RUN_LIVE 报告:验证 play-mcp → 真后端 → 真 GM(glm-5.2) → WS 事件流 → 种子生效的闭环通路,附开场回合初步观测。**多轮 playerTurns + baseline 对照 + 真人语料对标后续**(经 dicelore-eval skill 跑)。

## 场景
- focus:F1-跳骰 / F3-该选vs该骰 / 明暗骰-玩家行动用明骰 / narrate-leak
- reference:`docs/research/scraped/从刚成年开始的兽人冒险！_38582339.md` · beat=开局 r 六维 + 第一次狩猎 · note=真人 GM 开局让玩家 r 六维(明骰式参与)、第一次狩猎给方向 resolve_choice、猎物走随机表 resolve_outcome、真打 r+力量 vs AC resolve_contest

## 通路验证(本批核心目标)
| 环节 | 结果 | 证据 |
|---|---|---|
| play-mcp 连真后端(缝B) | ✅ | doOpenSession 灌种子 → WS open → POST /start |
| 种子生效 | ✅ | GM 开场有碎骨氏族/灰石村/格罗姆/乌鲁/哈图(种子 tone/rules/sheets 生效;路径修复前 GM 说"世界是空的") |
| 真 GM(glm-5.2) 跑通 | ✅ | 开场 3 段 narration + 建卡 sheet_show(presentation_delta×3) + turn_ended,耗时 ~123s |
| WS 事件流 | ✅ | narration_commit→presentation_delta→turn_ended 时序正确,doTurn 收齐 resolve |
| doctrine 教条接入 | ✅ | GM 走 gm-core:开局 sheet_show(可见性①)、纯开局轮开放式"你做什么?"收尾(范式③) |

## expectations(开场回合 start_game,无 playerTurns)
- [narrate-leak] **fail** — seq1/seq2 是 GM 英文思考/元叙述("The table's set. Let me check the world state, then build the opening beat..." / "Fresh canvas. Building the orc and his world.")泄漏成 narration_commit 推给玩家。stripReasoning 只剥 `<think>` 标签块,glm-5.2 无标签思考段剥不掉;根因是 GM 把思考过程 narrate 出来。
- [F1-跳骰/明骰] **存疑** — 真人 GM 开局让玩家 r 六维(明骰式参与);我们 GM 开场"开局建卡完成,人物卡已亮给你"——暗中建卡,未见 r 六维明骰过程。但本回合是 start_game(prologue 驱动、无玩家输入),GM 自由开场;playerTurns[0]"先给我 r 六维"未送入,需多轮验证。
- [F3/明暗骰] **未触发** — 开场无对抗/方向选择,未到该选/该骰局面。
- [身份识别] **fail(附)** — seed sheets 玩家名字=格罗姆;GM 开场把"格罗姆"当 NPC 大酋长、玩家叫"加尔"(自创)。GM 没正确读 sheet 玩家身份。

## vs_reference
真人 GM 黄金做法:开局 r 六维(玩家明骰参与)→ 第一次狩猎给方向 resolve_choice → 猎物随机表 resolve_outcome → 真打 resolve_contest。我们 GM 开场:暗中建卡(无 r 六维明骰)+ 开放式"你做什么"收尾。开局建卡环节与真人差距明显(明骰 vs 暗骰),但本回合未送 playerTurns[0],GM 自由发挥——需送"先给我 r 六维"再判 F1/明骰。

## skill_fix_hints
- gm-core 加"思考/元叙述别进 narrate":GM 的内心独白("The table's set, let me check...")是给自己看的,玩家只该见成品散文。narrate 是玩家所见的散文流,不是 GM 的工作笔记。(可泛化到所有模型,非 glm 特例)
- gm-core 明骰段已教"建卡 r 六维=玩家明骰",但 GM 开场没遵守——措辞强度或时机需加强(开局轮优先教 r 六维明骰)。

## findings 分流
- **A·措辞**(当轮可改 gm-core):
  - 思考/元叙述别 narrate 给玩家(narrate-leak 根因)
  - 开局建卡 r 六维明骰(教条已有但 GM 未遵守,措辞强化)
- **B·架构/能力**(路由设计,勿提示词硬磨):
  - stripReasoning 只剥 `<think>` 标签块,无标签思考段(glm-5.2 英文自言自语)剥不掉——但这本质是模型行为,靠 gm-core 教条约束(别吐思考)更对,非 strip 能解;strip 留作 `<think>` 标签类模型(DeepSeek-R1 等)的兜底。
  - GM 没正确读 sheet 玩家身份(把玩家名当 NPC)——可能 signpost 玩家身份呈现不清,归 B 待查(视图层/开场上下文)。

## 备注
- 开场回合烧 LLM ~123s(3 段 narration + 3 次工具调用),eval 脚本 timeout 须 ≥200s。
- 路径修复(commit dbdc645)前,种子灌 core 路径而后端开平铺空库,GM 开场"世界是空的"——已修。
