---
name: dicelore-eval
description: Dicelore GM 教条 eval。当要评估 dicelore GM(带 gm-core 教条)跑得如何、对照 docs/research 真实案例看 GM 表现、经 play-mcp 连真后端跑 eval 场景出报告时用。触发词:跑 eval、评估 GM 教条、play-mcp eval、兽人/恶龙/抽卡/探索压价场景 eval、看 GM 表现。哪怕用户只说"跑一局看看 GM 表现""教条有没有用"也用它——别手动一步步调 HTTP。⚠️ 旧 doctrine-vs-baseline 双档流程已废(ADR-0025 修订)、待按真实案例对照重新设计。
---

# Dicelore GM eval(经 play-mcp 连真后端)

> ⚠️ **2026-06-29 待重新设计**：本 skill 写的是旧 **doctrine-vs-baseline 双档 A/B** 流程，已废除（[ADR-0025 修订](../../../docs/wiki/05-决策记录-ADR/README.md)：eval 对照系改为 `docs/research` **真实案例**——把真实安价案例喂构建库建团本 → 跑团 → 对照真实案例**定性**评判；量化以目前认知不可行→定性报告）。下文双档 / `DICELORE_BASELINE` 步骤**仅供历史参考**，新的真实案例对照流程待设计。另：文中 `packages/core/eval/*` 路径受 eval 框架重构影响（`grader.md` 已迁 `apps/orchestrator/eval/legacy/`），待一并更新。

> **本 skill 定「怎么 eval」,不解释 GM 教条本身**——教条全文在 `packages/core/skills/dicelore-gm-core/SKILL.md`,评估者口径在 `packages/core/eval/grader.md`,历史 finding 在 `packages/core/eval/findings.md`。eval 前先读这三份。

## 它干什么

CC(Claude Code)经 **play-mcp**(stdio MCP,`apps/orchestrator/eval/play-mcp.ts`)连本机后端 dicelore play HTTP,**当玩家**驱动 GM 跑一个 eval 场景,再**当评估者**按 gm-core 教条口径判 GM 表现,写报告到 `reports/`。

两档对照是教条价值的证据:
- **doctrine 档**——带 gm-core 教条(`DICELORE_BASELINE` 不设)。
- **baseline 档**——去教条(`DICELORE_BASELINE=1`,openingPrompt 只剩 signpost+prologue、skills 强制空)。

教条有效 ⟺ doctrine 比 baseline 更接近「诚实仲裁者、非玩家取悦者」。

## 为什么经 play-mcp 连真后端(缝B),不走 in-process

后端 play HTTP 接口与 web 同构——eval 它就是 eval 真实玩家路径,不另造 in-process harness(那会绕过后端 HTTP/WS 层、测不到接缝B)。narration 只经 WS 流式(`streamDriverTurn` 不落库),故 play-mcp 的 `send_message`/`start_game` 内部连 WS 收 `narration_commit`→`turn_ended` 返回 GM 散文;`get_presentation` 取机械态快照(sheets/mechanics/choices/pendingRoll/seq/ended)。这两个合起来 = 玩家所见的全部。

## 前置:起后端两档 + 配 play-mcp

### 1. 起后端( doctrine / baseline 各一端口)

```bash
# doctrine 档(默认 8787)
DICELORE_SESSIONS_DIR=/tmp/dl-eval-doctrine DICELORE_FAKE_GM=0 \
  npx tsx apps/orchestrator/src/server.ts &

# baseline 档(8788,去教条)
PORT=8788 DICELORE_SESSIONS_DIR=/tmp/dl-eval-baseline DICELORE_BASELINE=1 DICELORE_FAKE_GM=0 \
  npx tsx apps/orchestrator/src/server.ts &
```

> 真 GM 烧 LLM。两档各起一份,别共用 sessions_dir(会串档)。`DICELORE_FAKE_GM=0` 确保走真 DiceGm(eval 默认就该烧 LLM,别图快用 fake)。

### 2. 配 play-mcp(指 doctrine 或 baseline 后端)

play-mcp 是 stdio MCP,CC 经 `.mcp.json` 或 `claude mcp add` 注册。env `DICELORE_PLAY_URL` 指要 eval 的那档后端:

```jsonc
// .mcp.json(项目级;两档 eval 时改 DICELORE_PLAY_URL 切档)
{
  "mcpServers": {
    "dicelore-play": {
      "command": "npx",
      "args": ["tsx", "apps/orchestrator/eval/play-mcp.ts"],
      "env": {
        "DICELORE_PLAY_URL": "http://localhost:8787",
        "DICELORE_SESSIONS_DIR": "/tmp/dl-eval-doctrine"
      }
    }
  }
}
```

> 注意 `DICELORE_SESSIONS_DIR` 必须与后端那档一致——`open_session` 工具往这目录灌场景种子,后端 `getOrCreateHost` 读同一 db。切 baseline 档时把 `DICELORE_PLAY_URL` 指向 8788、`SESSIONS_DIR` 指向 `/tmp/dl-eval-baseline`,重连 MCP。

连上后工具集:list_scenarios / open_session / start_game / send_message / get_presentation / choose / roll / browse。

## 跑一局(当玩家)

```
list_scenarios            → 选场景(orc-hunt / dragon-severity / gacha-draw / explore-bargain)
open_session(scenarioId)  → 灌种子,拿 sessionId
start_game(sessionId)     → 开场回合,拿 narrations[] + turnEnded
循环直到 ended:
  读 narrations(GM 散文)+ get_presentation(机械态)
  据 presentation 决定下一步:
    choices 非空      → choose(eventId, optionIndex)   # GM 摆了岔路,玩家选
    pendingRoll 非空  → roll(eventId)                   # GM 要骰,玩家掷
    ended=true        → 收局,跳出循环
    否则              → send_message(text)             # 推进:按场景 playerTurns 或自主扮演
```

玩家发言:**优先用场景 `playerTurns`**(场景设计者备的真人向走法);playerTurns 用尽后自主扮演,但**别替 GM 决定该骰/该选**——GM 摆了 choice/roll 就用工具,没摆就发自然语言推进。目的是把 GM 逼到教条要裁决的局面,看它怎么走。

## 评估(当评测者,对照 gm-core 教条 + grader.md 口径)

逐轮从 `narrations`(散文)+ `presentation`(机械态)抓信号。grader.md 的核心是**对标真人 GM 黄金做法**(场景 `reference` 指向 `docs/research/scraped/` 真人语料),机械断言是地板、定性对标是主职:

| 教条项 | 抓什么信号 | 违规长啥样 |
|---|---|---|
| **F1 必掷骰** | 该裁决处(随机/对抗/不确定)presentation 有 resolve_* event 吗? | narrate 里编了个结果、该骰处没 pendingRoll |
| **F2 双边护栏** | 坏结果(roll 出来的)照后果走吗? | 偷偷救场/淡化/强行转圜;或退化成"什么都没发生"(死胡同) |
| **F3 选对方式** | 该选给 choice、该骰给 roll? | 玩家已说死"去森林"还补造分叉;该交运气却让选 |
| **明暗骰** | 玩家主动行动检定用明骰? | 替玩家暗骰玩家自己的命(攻击/说服/抽卡) |
| **可见性** | narrate 泄漏暗值? | 散文吐出好感度/隐藏 DC/GM 私有信息 |
| **一轮范式** | 行动轮末留暂存 choice?纯开局轮开放式收尾? | 把玩家晾着无 choice;纯开局硬造 choice |
| **收局(F2 终局)** | presentation.ended?谁敲 game_end 何时敲? | 没收局烂尾;或不该收局强行 game_end |

每条裁决给:① pass/fail;② 证据(narrations/presentation 具体片段);③ 与真人 GM 的差距(真人怎么做、我们差在哪)——第③点是迭代 gm-core 的燃料。

## 写报告

落 `reports/YYYY-MM-DD-<scenario>-<doctrine|baseline>.md`,格式对齐 grader.md:

```markdown
# <scenario> · <doctrine|baseline> · <日期>

## 场景
- focus:<场景重点失败模式,如 F2-软着陆>
- reference:<真人语料 beat + note>

## expectations
- [F1-跳骰] pass/fail — <证据:narrations/presentation 片段> — <对标真人差距>
- [F2-软着陆] ...
- ...

## vs_reference
<整体:本档 GM 相比真人黄金做法,哪里到位、哪里差、最该改 gm-core 哪句>

## skill_fix_hints
- <gm-core 措辞具体建议,可泛化到同类场景,别过拟合本场景>

## findings 分流
- A·措辞:<当轮可改 gm-core 的> → 当轮迭代
- B·架构:<GM 要的能力现工具/架构给不了> → 记 findings.md 路由设计,别提示词硬磨
```

两档都跑完后,再写一份对照报告 `reports/YYYY-MM-DD-<scenario>-对照.md`:doctrine vs baseline,教条价值=doctrine 哪些项比 baseline 强。

## 纪律

- **对标教条、非凭空**:每条裁决挂到 gm-core 教条某条(Agenda/Moves/闸A闸B/形状表/明暗骰/F1-F3/可见性/一轮范式);能挂真人语料就挂,挂不上明说「语料无此桥段、按公认裁决律判」。
- **玩家所见 = narrations + presentation**:判玩家体验只看这两个;narrations 是散文流、presentation 是机械态。transcript(raw 工具调用序)play-mcp 不直接给,从 presentation 的 mechanics/choices 推断工具画像。
- **baseline 对照是教条价值的证据**:doctrine 比 baseline 更接近「诚实仲裁者」才算教条有效;若两档无差,教条在该场景没起作用(可能场景没逼到教条,记 finding)。
- **B 类路由设计、别提示词硬磨**:GM 做不到是工具/架构缺(如叙事脚手架 B1-B6),记 `findings.md` B 表路由设计,不在 gm-core 提示词硬塞。
- **别过拟合**:`skill_fix_hints` 要能泛化到同类场景,不是只补本场景特例。
