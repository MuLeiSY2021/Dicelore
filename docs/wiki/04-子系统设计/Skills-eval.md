# Skills eval-loop（gm-core 定向优化蓝本）

> **本页职责**：定 `dicelore-gm-core`（及流程 skill）的**定向优化方法与工装**——以**真实安价语料**为黄金标准、用可跑的 eval-loop 量化迭代 skill 措辞。这是 [Skills包 §6.1](Skills包.md) 「措辞终稿靠 eval-loop」的落地蓝本，**未来每轮 skill 迭代以此为据**。
> **上游依赖**：[Skills包 §6.1](Skills包.md)（F1/F2/F3 可客观验证 → L3 信号复用作 assertions）；[总体架构 §6 三流](../03-架构/总体架构.md)（玩家视图＝narrate 流 + 输出层面板）；[adapter §4 L3 两档](adapter与L3审计.md)；skill-creator（评测循环 / 反过拟合 / with-without baseline）。
> **状态**：🟢 工装已落源码（2026-06-21，`packages/core/{src/present/playerView,src/eval/assertions,eval/*}`）。语义/对标真人的 grader 为规格 + 人/LLM 执行。**2026-06-24 RUN_LIVE 通路验证通过**：CC 经 [play-mcp](../../06-里程碑与问题/路线图.md) 连真后端(缝B)跑 orc-hunt,真 GM(glm-5.2)+种子生效+WS 事件流闭环(见 [reports/](../../../reports/))。

---

## 0. 立场：把「好」锚定在真人安价实践上

gm-core 不是单次任务 skill——它的「输出」是**一整局多回合跑团**（工具调用 + narrate + 裁决）。所以 eval 不照 skill-creator 的「单 prompt → 评一次输出」，而是：**脚本场景驱动真 GM → 抓 .db/transcript → 玩家视图 + 两层评分**。其中评分的**黄金标准是 [真实安价语料](../../research/scraped/)**（兽人冒险 / 抽卡 / 恶龙团 三真串）——优化的「好」不是我们拍脑袋的断言，是**真人 GM 怎么跑这局**。

> **关键耦合澄清**：eval 跑分底座 = **CC 经 play-mcp 连真后端 orchestrator(缝B)**——与 web 同构、测真实玩家路径,不另造 in-process harness(那会绕过后端 HTTP/WS 层)。narration 只经 WS 流式(`streamDriverTurn` 不落库),故玩家视图 = **WS narrations + HTTP presentation**(机械态快照:sheets/mechanics/choices/pendingRoll/ended);`buildPlayerView` 的 mock 契约(玩家只见 narrate+面板)现由真后端 WS+presentation 兑现。原「裸 CC harness 不依赖组件7」路线已弃——见 [ADR](../05-决策记录-ADR/README.md)(play-mcp 作 eval 入口)。

---

## 1. 玩家视图（评分基准 = mock 组件7 渲染契约）

`buildPlayerView(db)`（[`src/present/playerView.ts`](../../../packages/core/src/present/playerView.ts)）= 玩家**应该看到的全部**：

```
PlayerView = {
  narration: 可见 narrate + reveal event（流① 剧情/披露，按 seq）,
  panel:     buildPresentationModel（流② 机械回显 + 状态菜单 + 待选项/待掷）,
}
```

**不含** GM 的 raw 聊天正文（流③只回 AI）、暗值/隐藏。这既是 eval 的评分基准，也是**组件7 将来该实现的渲染契约**（[玩家客户端-接口](玩家客户端-接口.md)）。判「玩家体验」只看 PlayerView；正文只用来抓泄漏/绕过。

---

## 2. 两层评分

| 层 | 工装 | 判什么 | 性质 |
|---|---|---|---|
| **① 机械断言（地板）** | [`src/eval/assertions.ts`](../../../packages/core/src/eval/assertions.ts) + [`l3.auditTurn`](adapter与L3审计.md) | **narrate 泄漏**（正文复述剧情＝玩家看不到+烧 token）、**漏 narrate**、**工具画像**（narrate/choice/mutation/**明骰 vs 暗骰** 计数）、F1 时序 | 客观、确定性、零 LLM、单测覆盖 |
| **② 参考式定性（核心）** | [`eval/grader.md`](../../../packages/core/eval/grader.md) | 对标 `scenario.reference` 的**真人 GM 黄金做法**：F3 该选vs该骰、F2 软着陆、明暗骰选对、可见性不泄漏、与真人质量差距 | 语义、人/LLM、产 `skill_fix_hints` |

机械断言是兜底地板；**grader 是主职**——拿真人语料桥段当 gold standard，judge 我们的 GM 差在哪、给 gm-core 措辞的具体改建（反过拟合）。

---

## 3. 场景（各带语料 reference）

[`eval/scenarios/*.json`](../../../packages/core/eval/scenarios/)，每个 = 种子（rules/sheets/tone）+ `playerTurns`（脚本玩家输入）+ **`reference`**（指向真串桥段 + `note`＝真人黄金做法）+ `focus`（重点失败模式）：

| 场景 | 语料 | 重点 |
|---|---|---|
| `orc-hunt` | 兽人冒险 | r 六维 / 方向 choice / 猎物随机表 / 玩家攻击明骰；F1·F3·明暗骰 |
| `gacha-draw` | 抽卡 | d100 品质 / world_sample / 融合检定；F1·明暗骰·不剧透 |
| `dragon-severity` | 恶龙团 | 坏结果照后果硬着陆 + fail-forward / 事先声明烈度；**F2 软着陆** |
| `explore-bargain` | 恶龙团 | 侦查 reveal / 安全vs冒险买入 / 压价对抗；F3·可见性·明暗骰 |

---

## 4. 工装与跑法

> **路线(2026-06-24 定)**：CC(Claude Code)经 **play-mcp**(stdio MCP,`apps/orchestrator/eval/play-mcp.ts`)连真后端 play HTTP,**当玩家+评估者**;不再走「手动 claude/headless claude -p 喂 playerTurns」。两档对照:doctrine(带 gm-core)vs baseline(`DICELORE_BASELINE=1` 去教条)。

- [`eval/run.ts`](../../../packages/core/eval/run.ts)：场景就绪器——`prepareSessionDb` 灌种子 + `dicelore init` 临时项目 + 重写 `.mcp.json` 指本地 tsx(未发布期) + 打印全流程(手动调试用,自动闭环走 play-mcp)。
- **play-mcp**([`apps/orchestrator/eval/play-mcp.ts`](../../../apps/orchestrator/eval/play-mcp.ts))：包后端 play HTTP 为 8 个 MCP 工具(list_scenarios/open_session/start_game/send_message/get_presentation/choose/roll/browse)。`send_message`/`start_game` 内部连 WS 收 `narration_commit`→`turn_ended`(narration 不落库、只流式),返回 GM 散文;`get_presentation` 取机械态快照。后端 URL/sessions_dir 来自 env(`DICELORE_PLAY_URL`/`DICELORE_SESSIONS_DIR`)。
- **dicelore-eval skill**([`.claude/skills/dicelore-eval/SKILL.md`](../../../.claude/skills/dicelore-eval/SKILL.md))：教 CC 经 play-mcp 跑 eval + 写报告的流程 skill(起后端两档 → 配 play-mcp → 跑局 → 按教条口径评估 → 写报告到 `reports/`)。
- [`eval/run-live.ts`](../../../apps/orchestrator/eval/run-live.ts)：RUN_LIVE 入口(经 play-mcp handler 跑 orc-hunt 验真 GM,冒烟用)。
- [`eval/grade.ts`](../../../packages/core/eval/grade.ts) + [`eval/grader.md`](../../../packages/core/eval/grader.md)：对 `.db`(+ transcript)跑 playerView + 机械断言 + 参考式定性。play-mcp 通路下 transcript 从 presentation 的 mechanics/choices 推断工具画像。
- **跑法**：CC 配 play-mcp(.mcp.json `DICELORE_PLAY_URL` 指 doctrine 或 baseline 后端)→ `list_scenarios`→`open_session`→`start_game`→逐轮 `send_message`+`get_presentation`+`choose`/`roll` → 按 [grader.md](../../../packages/core/eval/grader.md) 口径评估 → 写报告。**注意**:开场回合烧 LLM ~120s+,eval 脚本 timeout ≥200s。

**一轮 loop**：doctrine/baseline 各跑一局 → grader 对标语料 → 据 `skill_fix_hints` 改 gm-core 措辞 → 重跑比较,直到接近真人 GM。**with/without baseline** 证明教条增量价值。

---

## 5. 边界与未来

- **经 play-mcp 连真后端(缝B)、与 web 同构**：F1/F2/F3/明暗骰选对/可见性/narrate 泄漏 全可测;narration 经 WS 流式、presentation 取机械态,玩家视图=narrations+presentation(明骰玩家点击全流程除外——那要 web roll-gate,但「该明该暗」的工具选择从 presentation 的 roll event 即可判)。
- **narrate 泄漏措辞终稿**：行为对错由 `buildPlayerView` 已固化（玩家只见 narrate）；最终 skill 措辞与组件7 渲染契约对齐后收口。
- **措辞 eval-pending**：gm-core 现有措辞均待本 loop 迭代定稿（[Skills包 §6.1](Skills包.md)）。
