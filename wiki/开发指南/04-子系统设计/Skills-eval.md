# Skills eval-loop（gm-core 定向优化蓝本）

> **本页职责**：定 `dicelore-gm-core`（及流程 skill）的**定向优化方法与工装**——以**真实安价语料**为黄金标准、用可跑的 eval-loop 量化迭代 skill 措辞。这是 [Skills包 §6.1](../02-MCP与Skill体系/Skills包.md) 「措辞终稿靠 eval-loop」的落地蓝本，**未来每轮 skill 迭代以此为据**。
> **上游依赖**：[Skills包 §6.1](../02-MCP与Skill体系/Skills包.md)（F1/F2/F3 可客观验证 → L3 信号复用作 assertions）；[总体架构 §6 三流](../03-架构/总体架构.md)（玩家视图＝narrate 流 + 输出层面板）；[adapter §4 L3 两档](adapter与L3审计.md)；skill-creator（评测循环 / 反过拟合）；**eval 对照系=`docs/research` 真实案例**（评测对照系修订，非 with/without baseline，见设计页决策节）。
> **状态**：🟢 工装已落源码（2026-06-21，纯件在 `backend/src/{present/playerView,eval/assertions}` + eval 场景/断言，驱动 harness 在 `harness/eval-dicegm/`；结构见 [后端双路径架构](后端双路径架构.md)）。语义/对标真人的 grader 为规格 + 人/LLM 执行。**2026-06-24 RUN_LIVE 通路验证通过**：CC 经 [play-mcp](../../../docs/dev/plan/路线图.md) 连真后端跑 orc-hunt,真 GM(glm-5.2)+种子生效+WS 事件流闭环(见 [reports/](../../../docs/dev/reports/))。

---

## 0. 立场：把「好」锚定在真人安价实践上

gm-core 不是单次任务 skill——它的「输出」是**一整局多回合跑团**（工具调用 + narrate + 裁决）。所以 eval 不照 skill-creator 的「单 prompt → 评一次输出」，而是：**脚本场景驱动真 GM → 抓 .db/transcript → 玩家视图 + 两层评分**。其中评分的**黄金标准是 [真实安价语料](../../../docs/research/scraped/)**（兽人冒险 / 抽卡 / 恶龙团 三真串）——优化的「好」不是我们拍脑袋的断言，是**真人 GM 怎么跑这局**。

> **关键耦合澄清**：eval 跑分底座 = **CC 经 play-mcp 连真后端（backend）**——与 frontend 同构、测真实玩家路径,不另造 in-process harness(那会绕过后端 HTTP/WS 层)。narration 只经 WS 流式(`streamDriverTurn` 不落库),故玩家视图 = **WS narrations + HTTP presentation**(机械态快照:sheets/mechanics/choices/pendingRoll/ended);`buildPlayerView` 的 mock 契约(玩家只见 narrate+面板)现由真后端 WS+presentation 兑现。原「裸 CC harness 不依赖组件7」路线已弃——见本页「决策与权衡」节（play-mcp 作 eval 入口）。

---

## 1. 玩家视图（评分基准 = mock 组件7 渲染契约）

`buildPlayerView(db)`（[`backend/src/present/playerView.ts`](../../../backend/src/present/playerView.ts)）= 玩家**应该看到的全部**：

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
| **① 机械断言（地板）** | [`backend/src/eval/assertions.ts`](../../../backend/src/eval/assertions.ts) + [`l3.auditTurn`](adapter与L3审计.md) | **narrate 泄漏**（正文复述剧情＝玩家看不到+烧 token）、**漏 narrate**、**工具画像**（narrate/choice/mutation/**明骰 vs 暗骰** 计数）、F1 时序 | 客观、确定性、零 LLM、单测覆盖 |
| **② 参考式定性（核心）** | `grader.md` | 对标 `scenario.reference` 的**真人 GM 黄金做法**：F3 该选vs该骰、F2 软着陆、明暗骰选对、可见性不泄漏、与真人质量差距 | 语义、人/LLM、产 `skill_fix_hints` |

机械断言是兜底地板；**grader 是主职**——拿真人语料桥段当 gold standard，judge 我们的 GM 差在哪、给 gm-core 措辞的具体改建（反过拟合）。

---

## 3. 场景（各带语料 reference）

eval 场景（`backend/src/eval/` 的场景纯件，经 `harness/eval-dicegm/` 驱动），每个 = 种子（rules/sheets/tone）+ `playerTurns`（脚本玩家输入）+ **`reference`**（指向真串桥段 + `note`＝真人黄金做法）+ `focus`（重点失败模式）：

| 场景 | 语料 | 重点 |
|---|---|---|
| `orc-hunt` | 兽人冒险 | r 六维 / 方向 choice / 猎物随机表 / 玩家攻击明骰；F1·F3·明暗骰 |
| `gacha-draw` | 抽卡 | d100 品质 / world_sample / 融合检定；F1·明暗骰·不剧透 |
| `dragon-severity` | 恶龙团 | 坏结果照后果硬着陆 + fail-forward / 事先声明烈度；**F2 软着陆** |
| `explore-bargain` | 恶龙团 | 侦查 reveal / 安全vs冒险买入 / 压价对抗；F3·可见性·明暗骰 |

---

## 4. 工装与跑法

> **路线(2026-06-24 定)**：CC(Claude Code)经 **play-mcp**(stdio MCP,`harness/eval-dicegm/play-mcp.ts`)连真后端 play HTTP,**当玩家+评估者**;不再走「手动 claude/headless claude -p 喂 playerTurns」。
> **对照系(2026-06-29 改，评测对照系修订)**：对照 `docs/research` 真实案例（兽人/抽卡/恶龙团→喂构建库建团本→跑团→对照真实案例定性评判）。**废 doctrine-vs-baseline A/B**、**量化不可行→定性报告**。`DICELORE_BASELINE` 接线代码留作可选消融、不再当判据。

- `harness/eval-dicegm/run.ts`：场景就绪器——`prepareSessionDb` 灌种子 + `dicelore init` 临时项目 + 重写 `.mcp.json` 指本地 tsx(未发布期) + 打印全流程(手动调试用,自动闭环走 play-mcp)。
- **play-mcp**(`harness/eval-dicegm/play-mcp.ts`)：包后端 play HTTP 为 8 个 MCP 工具(list_scenarios/open_session/start_game/send_message/get_presentation/choose/roll/browse)。`send_message`/`start_game` 内部连 WS 收 `narration_commit`→`turn_ended`(narration 不落库、只流式),返回 GM 散文;`get_presentation` 取机械态快照。后端 URL/数据根 来自 env(`DICELORE_PLAY_URL`/`DICELORE_DATA_DIR`)。
- **play-eval skill**([`.claude/skills/play-eval/SKILL.md`](../../../.claude/skills/play-eval/SKILL.md))：教 CC 经 play-mcp 跑 **play 侧** eval（评 gm-core 教条下真 GM 跑团本）+ 写报告的流程 skill（起后端 → 配 play-mcp → 跑局 → 对照真实案例语料定性评估 → 写报告到 `docs/reports/`）。原名 `dicelore-eval`，2026-07-02 改 `play-eval`（配成对 play/build，避免误导）。
- **build-eval skill**([`.claude/skills/build-eval/SKILL.md`](../../../.claude/skills/build-eval/SKILL.md))：play-eval 的 **build 侧孪生**——用一份真实案例 md（`docs/research/scraped/*.md`，双身份=喂 loregm 的源素材 + 评团本质量的黄金参照）经 build-mcp 驱动真构建 GM（loregm）走完整构建（摸源→manifest→…→validate→commit），再读 loregm 的 `<id>_session.jsonl` 对话记录 + Draft/pack 当评测者，对照 md 出定性报告（A 构建行为 vs build-core 教条 / B 团本质量 vs 源 md）。对话记录=D4 让 loregm 落的 `$ROOT/sessions/lore/<id>/<id>_session.jsonl`（见 [后端双路径架构 D4](后端双路径架构.md)）——既是回退入点、又是评估 loregm 行为的原料。
- **eval-backend-setup skill**([`.claude/skills/eval-backend-setup/SKILL.md`](../../../.claude/skills/eval-backend-setup/SKILL.md))：play-eval / build-eval **共用前置**——教 CC eval 前把测试后端跑起来（仓库根 `bash install.sh` 铺隔离数据根 `.dicelore-eval` → `cd` 进去 `bash run.sh -f` 起真后端 → 确认就绪）。`.dicelore-eval` 是 [玩家客户端 D5](玩家客户端.md) 数据根的 dev 实例。
- `harness/eval-dicegm/run-live.ts`：RUN_LIVE 入口(经 play-mcp handler 跑 orc-hunt 验真 GM,冒烟用)。
- `harness/eval-dicegm/grade.ts` + `grader.md`：对 `.db`(+ transcript)跑 playerView + 机械断言 + 参考式定性。play-mcp 通路下 transcript 从 presentation 的 mechanics/choices 推断工具画像。
- **跑法**：CC 配 play-mcp(.mcp.json `DICELORE_PLAY_URL` 指 doctrine 后端)→ `list_scenarios`→`open_session`→`start_game`→逐轮 `send_message`+`get_presentation`+`choose`/`roll` → 按 `grader.md` 口径 + **对照 `docs/research` 真实案例**评估 → 写定性报告。**注意**:开场回合烧 LLM ~120s+,eval 脚本 timeout ≥200s。

**一轮 loop**：跑一局 → 对照真实案例 + grader 定性评判 → 据 `skill_fix_hints` 改 gm-core 措辞 → 重跑,直到接近真实案例里真人 GM 的表现。**对照真实案例**（非 with/without baseline）判教条价值，量化不可行→定性报告。

---

## 5. 边界与未来

- **经 play-mcp 连真后端（backend）、与 frontend 同构**：F1/F2/F3/明暗骰选对/可见性/narrate 泄漏 全可测;narration 经 WS 流式、presentation 取机械态,玩家视图=narrations+presentation(明骰玩家点击全流程除外——那要 frontend roll-gate,但「该明该暗」的工具选择从 presentation 的 roll event 即可判)。
- **narrate 泄漏措辞终稿**：行为对错由 `buildPlayerView` 已固化（玩家只见 narrate）；最终 skill 措辞与组件7 渲染契约对齐后收口。
- **措辞 eval-pending**：gm-core 现有措辞均待本 loop 迭代定稿（[Skills包 §6.1](../02-MCP与Skill体系/Skills包.md)）。

---

## 6. 决策与权衡

本页跑分底座的关键决策重述于此（历史全文见归档，以本节为准）。

### D1 · eval 经 play-mcp 连真后端（缝B）+ 后端 session 路径对齐 core

- **背景**：eval 跑分底座原定 = "裸 CC harness，不依赖组件7 orchestrator"（narrate 泄漏用 `buildPlayerView` mock 契约）。重定向为：CC 经**新 play-mcp**（stdio MCP）连真后端 play HTTP（缝B），当玩家 + 评估者——与 frontend 同构、测真实玩家路径，不另造 in-process harness（那会绕过后端 HTTP/WS 层、测不到缝B）。RUN_LIVE 首跑暴露真 bug：后端 session db 路径（平铺 `${dir}/${id}.db`）与 core `sessionDbPath`（`${dir}/dicelore/sessions/${id}.db`）不一致——种子灌到 core 路径、后端开平铺空库，种子全丢，GM 开场"世界是空的"。
- **决策**：
  1. **eval 经 play-mcp 连真后端（缝B）**：弃"裸 CC harness"路线。play-mcp 包后端 play HTTP 为 8 工具（list_scenarios/open_session/start_game/send_message/get_presentation/choose/roll/browse）；narration 只经 WS 流式（不落库），故 `send_message`/`start_game` 内部连 WS 收 `narration_commit`→`turn_ended` 返回 GM 散文，`get_presentation` 取机械态快照。玩家视图 = narrations(WS) + presentation(HTTP)。CC 当玩家 + 评估者。
  2. **后端 session db 路径对齐 core（以 core 为准，不绕过/降级）**：openSession 改用 core 路径规则；listSessionSummaries/deleteSession 同步对齐；core 补 export `sessionDbPath`/`openSession`（路径规则单源）。
- **对照系修订（2026-06-29，PO 复核已认可）**：原"两档对照 doctrine（带 gm-core）vs baseline（去教条）"作为"教条价值证据系"的地位**废除**。
  - **改为**：对照系 = **`docs/research/` 真实安价案例**（兽人冒险 / 抽卡 / 恶龙团，nmbxd 实跑串）。**闭环**：把真实案例喂进团本构建库 → 和 lore GM 对话建出团本 → 人工认可团本质量 → 让 Claude 的 skill + MCP 拿这个团本跑 eval → 落盘 eval 报告，对照真实案例评判 GM 表现。
  - **量化**：以目前认知**不可行** → 闭环产出**定性报告**（量化口径待探索），不强求"with 应显著低于 baseline"那类数值结论。
  - **理由**：doctrine-vs-baseline A/B（有无教条）回答的是"教条本身贡献几何"的消融问题；但真正要回答的是"我们的 AI GM 跑得像不像真实安价好作品"——这只能以真实人类跑出来的案例为对照系。baseline A/B 答非所问，且诱导"量化教条价值"的伪精确。
- **后果**：2026-06-24 RUN_LIVE 通路验证通过（orc-hunt doctrine 档，真 GM glm-5.2 + 种子生效 + WS 事件流闭环）。首份 finding：`stripReasoning` 只剥 `<think>` 标签块，glm-5.2 无标签英文思考段泄漏成 narration（narrate-leak），靠 gm-core 教条约束。
- **被否**：① in-process harness（绕过后端 HTTP/WS、测不到缝B）；② 后端保留平铺路径 + play-mcp 适配（违"以 core 为准"、留两套路径规则）；③ 保留 baseline A/B 作主证据系（答非所问）——`DICELORE_BASELINE` 接线代码可留作**可选消融实验**，但不再是教条价值的判据。

### D2 · build 侧 eval（团本构建链路）+ 共用前置 setup（2026-07-02）

- **背景**：play 侧 eval 评"真 GM 跑团本跑得好不好"已成型；但**团本构建链路**（作者 ↔ 构建 GM loregm 把素材造成团本）没有对称的 eval。用户诉求：agent 通过和 loregm 对话测团本构建链路完整可用，且要一份「作者说了什么 → loregm 干了什么」的对话记录，既是回退入点又是评估 loregm 行为的入口。
- **决策**：
  - **① build-eval = play-eval 的 build 侧孪生**：经 build-mcp（server `dicelore-build`，工具 `open_build_session`/`send_to_builder`/`put_material`/`get_draft`/`list_catalog`/`get_pack_files`）连真后端，CC 当作者驱动 loregm 走 `dicelore-build-pack` 全阶段建团本，再当评测者对照源 md 出定性报告。
  - **② 真实案例 md 双身份**：一份 `docs/research/scraped/*.md` 既是喂 loregm 的**源素材**（经 `put_material` 上传），又是评团本质量的**黄金参照**（对称 play 侧"对照系=真实案例语料唯一"）。
  - **③ 对话记录 = loregm 的 `<id>_session.jsonl`**（[后端双路径架构 D4](后端双路径架构.md) 让 loregm 落）：因构建 REST-only 不回散文，这份 jsonl（`turn`=作者指令、`msg`=loregm 每步 tool_use/tool_result/result）是评构建行为的权威原料（先摸源再落笔？只声明不跑团？一次一件+validate 收口？），也是回退入点。
  - **④ 两维定性评估**：A 构建行为（对 `dicelore-build-core`/`dicelore-build-pack` 教条）、B 团本质量（对源 md：可玩性 + 忠于素材）。报告落 `docs/reports/<日期>-build-<团本名>.md`，`build_core_fix_hints` 迭代教条、findings 分 A(措辞)/B(架构路由)。
  - **⑤ 共用前置 `eval-backend-setup` + 改名**：play/build 两 eval 起后端的步骤抽成 `eval-backend-setup` 前置 skill（`install.sh` 铺 `.dicelore-eval` 数据根 → `run.sh -f` 起真后端）；`dicelore-eval` 改名 `play-eval`（配成对，避免误导别的 agent）。
- **被否**：① build 侧只靠 `get_draft` 增量评构建（比 jsonl 对话记录浅——看不到 loregm 每步工具调用/摸源过程/有没有凭空编造）；② build-eval 各自重述起后端步骤（抽 `eval-backend-setup` 共用、单源）；③ 量化团本质量（同 play 侧，量化不可行→定性）。
- **手动门（待验证）**：真跑一局 build-eval（`RUN_LIVE` dogfood，烧 LLM）——真起后端 + build-mcp、用一个 scraped md 跑完整构建对话 → loregm 落 jsonl → 出一份 report。这是本链路的端到端实战验证。
