---
name: play-eval
description: Dicelore GM 教条 eval——评估带 gm-core 教条的真 GM 跑一个团本跑得好不好，对照 docs/research 真实安价案例（语料）出定性报告。用法：给一个**已备好的团本(Adventure) URI** + 一份**真实案例语料 URI**，经 play-mcp 连真后端当玩家驱动 GM 跑一局、再当评测者对照语料判表现。触发词：跑 eval、评估 GM 教条、看 GM 表现好不好、对照真实案例跑团本、play-mcp eval。哪怕用户只说"跑这个团本看看 GM 表现""教条有没有用"也用它——别手动一步步调 HTTP。
---

# Dicelore GM eval（跑团本 · 对照真实案例 · 定性报告）

> **本 skill 定「怎么 eval」，不解释 GM 教条本身**——教条全文在 gm-core skill（`dicelore-gm-core/SKILL.md`），评测者裁决口径在 grader（见下「现状/路径」），历史 finding 在 findings.md。eval 前先读教条 + grader。

## 输入（用户给两个 URI）

1. **团本 / Adventure URI**——**用户提前备好**的完整团本 pack（由真实案例经 lore GM 建成、人工认可过；建团本是**人工前置**、不在本 skill）。
2. **语料 / 真实案例 URI**——该团本对应的真人安价实跑串，在 `docs/research/scraped/`（兽人冒险 / 抽卡 / 恶龙团）。**这是评判的对照系**。

> 用户会说"测哪个团本"，给出 `(adva_uri, corpus_uri)`。本 skill 跑那个团本、对照那份语料。

## 它干什么

CC（Claude Code）经 **play-mcp**（stdio MCP）连本机后端 dicelore play HTTP，把**用户备好的团本**载入一个 play 会话，**当玩家**驱动真 GM（带 gm-core 教条）跑一局，再**当评测者**对照**真实案例语料**判 GM 表现，写**定性报告**。

- **对照系 = 真实案例语料（唯一）**：教条价值 / GM 好不好，看它跑得**像不像真人 GM 在同一题材里的黄金做法**。**不做 doctrine-vs-baseline A/B 对照**（[ADR-0025 修订](../../../docs/wiki/05-决策记录-ADR/README.md)：有无教条的消融答非所问；`DICELORE_BASELINE` 接线代码留作可选消融、不再当判据）。
- **量化以目前认知不可行 → 产出定性报告**：不声称"GM 满分"，也不靠数值分；给"对照真人语料，哪到位 / 哪差 / 最该改 gm-core 哪句"。

## 为什么经 play-mcp 连真后端（缝B），不走 in-process

后端 play HTTP 接口与 web 同构——eval 它就是 eval 真实玩家路径，不另造 in-process harness（那会绕过后端 HTTP/WS 层、测不到接缝B）。narration 只经 WS 流式（不落库），故 play-mcp 的 `send_message`/`start_game` 内部连 WS 收 `narration_commit`→`turn_ended` 返回 GM 散文；`get_presentation` 取机械态快照（sheets/mechanics/choices/pendingRoll/seq/ended）。这两个合起来 = 玩家所见的全部。

## 前置：起后端（单档·真 GM）+ 配 play-mcp

**只起一档**（doctrine，带教条、真 GM 烧 LLM）——不再起 baseline 第二档：

```bash
DICELORE_DATA_DIR=/tmp/dl-eval DICELORE_FAKE_GM=0 \
  npx tsx backend/src/server.ts &
```

> `DICELORE_FAKE_GM=0` 确保走真 DiceGm（eval 默认就该烧 LLM，别图快用 fake）。

play-mcp 经 `.mcp.json` 注册，`DICELORE_PLAY_URL` 指该后端、`DICELORE_DATA_DIR` 与后端一致：

```jsonc
{
  "mcpServers": {
    "dicelore-play": {
      "command": "npx",
      "args": ["tsx", "harness/eval-dicegm/play-mcp.ts"],
      "env": { "DICELORE_PLAY_URL": "http://localhost:8787", "DICELORE_DATA_DIR": "/tmp/dl-eval" }
    }
  }
}
```

## 载入团本起会话（⚠️ tooling 缺口，见下）

要 eval **用户备好的团本 pack**，得把它导入后端、拿到 `sessionId`，再用 play-mcp 的 `start_game`/`send_message` 驱动该 session：

1. **import 团本 pack**（`adva_uri` → 后端 catalog/import，物化进 session db）→ 拿 `sessionId`。
2. 之后用 play-mcp 工具按 `sessionId` 驱动（`start_game`/`send_message`/`get_presentation`/`choose`/`roll`）。

> ⚠️ **当前 harness 缺口**：play-mcp 的 `open_session` **只灌 eval 场景种子**（`prepareSessionDb(scenarioId)`，轻量 seed），**不能载入完整团本 pack**。跑团本 eval 需补一条「import pack → sessionId」通路（小工具或脚本步骤），或复用构建侧 `build-mcp` + catalog import。**实现前先 verify 当前 backend 的 import→session 机制**（refactor 进行中、路径在动，见末尾）。落 backlog：见 [backlog-core 主题F](../../../docs/wiki/06-里程碑与问题/backlog-core.md)。

## 跑一局（当玩家）

```
start_game(sessionId)     → 开场回合，拿 narrations[] + turnEnded
循环直到 ended：
  读 narrations（GM 散文）+ get_presentation（机械态）
  据 presentation 决定下一步：
    choices 非空      → choose(eventId, optionIndex)   # GM 摆了岔路，玩家选
    pendingRoll 非空  → roll(eventId)                   # GM 要骰，玩家掷
    ended=true        → 收局，跳出
    否则              → send_message(text)             # 自然语言推进
```

玩家发言：**贴着真实案例语料里玩家那侧的走法**推进（语料就是真人怎么玩的）；**别替 GM 决定该骰/该选**——GM 摆了 choice/roll 就用工具，没摆就发自然语言。目的是把 GM 逼到教条要裁决的局面，看它怎么走、和真人 GM 在语料同一桥段怎么走比。

## 评估（当评测者，对照真实案例语料）

逐轮从 `narrations`（散文）+ `presentation`（机械态）抓信号。**对照系是语料里真人 GM 的黄金做法**；机械断言是地板，**对照真人语料的定性判断是主职**：

| 教条项 | 抓什么信号 | 违规长啥样 |
|---|---|---|
| **F1 必掷骰** | 该裁决处（随机/对抗/不确定）presentation 有 resolve_* event 吗？ | narrate 里编了个结果、该骰处没 pendingRoll |
| **F2 双边护栏** | 坏结果（roll 出来的）照后果走吗？ | 偷偷救场/淡化/强行转圜；或退化成"什么都没发生"（死胡同） |
| **F3 选对方式** | 该选给 choice、该骰给 roll？ | 玩家已说死"去森林"还补造分叉；该交运气却让选 |
| **明暗骰** | 玩家主动行动检定用明骰？ | 替玩家暗骰玩家自己的命（攻击/说服/抽卡） |
| **可见性** | narrate 泄漏暗值？ | 散文吐出好感度/隐藏 DC/GM 私有信息 |
| **一轮范式** | 行动轮末留暂存 choice？纯开局轮开放式收尾？ | 把玩家晾着无 choice；纯开局硬造 choice |
| **收局（F2 终局）** | presentation.ended？谁敲 game_end 何时敲？ | 没收局烂尾；或不该收局强行 game_end |

每条裁决给：① pass/fail（机械地板可判的）；② 证据（narrations/presentation 具体片段）；③ **与语料里真人 GM 的差距**（真人在同类桥段怎么做、我们差在哪）——第③点是定性主职、也是迭代 gm-core 的燃料。

## 写报告（定性）

落 `reports/YYYY-MM-DD-<团本名>.md`：

```markdown
# <团本名> · <日期>

## 对象
- 团本：<adva_uri>
- 语料：<corpus_uri>（真人案例 + 重点对照桥段）

## 逐项裁决（对照语料）
- [F1-跳骰] pass/fail — <证据：narrations/presentation 片段> — <vs 语料真人差距>
- [F2-软着陆] ...
- ...

## vs 真实案例（整体）
<本团本一局里，GM 相比语料真人黄金做法：哪到位、哪差、最该改 gm-core 哪句>

## skill_fix_hints
- <gm-core 措辞具体建议，能泛化到同类场景、别过拟合本团本>

## findings 分流
- A·措辞：<当轮可改 gm-core 的> → 当轮迭代
- B·架构：<GM 要的能力现工具/架构给不了> → 记 findings.md 路由设计，别提示词硬磨
```

## 纪律

- **对照真实案例语料、非凭空**：每条裁决挂到 gm-core 教条某条（Agenda/Moves/闸A闸B/形状表/明暗骰/F1-F3/可见性/一轮范式）；能挂语料桥段就挂，挂不上明说「语料无此桥段、按公认裁决律判」。
- **玩家所见 = narrations + presentation**：判玩家体验只看这两个；transcript（raw 工具调用序）play-mcp 不直接给，从 presentation 的 mechanics/choices 推断工具画像。
- **量化不可行 → 定性**：不给数值分、不声称"满分"；给"对照真人语料的差距 + 该改哪句"。**不做 baseline A/B**（教条价值 = 跑得像不像语料真人，不是有无教条的消融）。
- **B 类路由设计、别提示词硬磨**：GM 做不到是工具/架构缺（如叙事脚手架），记 `findings.md` B 表路由设计，不在 gm-core 提示词硬塞。
- **别过拟合**：`skill_fix_hints` 要能泛化到同类场景，不是只补本团本特例。

## 现状 / 路径（⚠️ eval 框架重构进行中）

storage-port 重构正在溶解 `packages/core`，eval 文件搬了家、仍在动。**调本 skill 前先 verify 当前位置**（`find . -name <file> -not -path '*/node_modules/*'`）：

- 后端入口：`backend/src/server.ts`（原 `apps/orchestrator/src/server.ts`）
- eval 场景/逻辑：`backend/eval/scenarios/*.json`、`backend/src/eval/{scenario,assertions,loreScenario,loreAssertions}.ts`
- play-mcp / run-live：`harness/eval-dicegm/{play-mcp,run-live}.ts`；build-mcp：`harness/eval-loregm/build-mcp.ts`
- grader 口径：`harness/eval-dicegm/grader.md`（**待重新归位**——旧 baseline 痕迹也在里头，用时按本 skill 的真实案例对照口径过滤）

**两个待补**（落 [backlog-core 主题F](../../../docs/wiki/06-里程碑与问题/backlog-core.md)）：① import 团本 pack → play session 的通路（本 skill「载入团本」步依赖它）；② grader.md 从 legacy 重新归位 + 去 baseline 痕迹。
