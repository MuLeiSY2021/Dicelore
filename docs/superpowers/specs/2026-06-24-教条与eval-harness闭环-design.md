# 教条接入收尾 + eval 入口（CC 经 MCP 连后端 play）

> **本 spec 职责**：定路线图第一批「教条 + eval 闭环」的实现设计。
> **上游**：[路线图第一批](../../wiki/06-里程碑与问题/路线图.md) + [backlog-core 主题F](../../wiki/06-里程碑与问题/backlog-core.md) + [backlog-后端 G-后端-gmcore](../../wiki/06-里程碑与问题/backlog-后端.md) + [ADR-0018](../../wiki/05-决策记录-ADR/README.md)/[ADR-0020](../../wiki/05-决策记录-ADR/README.md)。
> **状态**：设计已定（2026-06-24 修订：从 in-process harness 改为 CC 经 play-mcp 连真后端），待 plan。

## 1. 背景与目标

第一批是 meta 闸：不建真 eval 入口，所有「GM 行为/措辞」类结论不可信（主题F）。两件事是一条线——eval 要跑真 GM，真 GM 现靠 `openingPrompt` 内联教条 stopgap 兜底，须先正式接教条再开 eval。

**目标**：
1. 真 GM 接 gm-core skill（去 stopgap 依赖、RUN_LIVE 验证）。
2. **eval 入口 = CC 经 play-mcp 连真后端 play 接口**：CC 当玩家+评估者，经一个新 stdio MCP（play-mcp）调后端 play HTTP，和后端 DiceGm GM 对话、观察、写 eval 报告。替代 `run.ts` 的手动指引。
3. F2 终局观测纳入（game_end 谁敲、何时敲）。

## 2. 现状（已核对，不重复调研）

### 教条接入（代码已落，缺 RUN_LIVE）
- `server.ts:34` `gmCoreSkill()` → `diceSkills` → `DiceSession` → `DiceGm`。
- `DiceGm.runTurn`：skills 非空时 `stageSkills` 拷副本到 tmp cwd → `settingSources:["project"]` + `cwd:staged` + `allowedTools:["mcp__dicelore","Skill","Read"]` + in-process MCP（`type:"sdk"`）。
- `openingPrompt.ts`：`gmCoreSkill()` 返回 SkillRef；`gmCoreDoctrine()` 读 SKILL.md 内联进 openingPrompt 作「保证投递」兜底。
- gm-core SKILL.md 教条完整（Agenda/Moves/闸/形状表），自标「措辞 eval-pending 等 eval」。
- **缺**：RUN_LIVE 实测（教条是否真被 GM 加载、行为对不对）。

### 后端 play 接口（已全通，G-后端-缺端点✅）
- `apps/orchestrator/src/api/dice.ts`：HTTP `POST /sessions/:id/{open,start,messages,choices,roll}` + `GET /sessions/:id/{presentation,browse}` + `GET /sessions` + `DELETE /sessions/:id`；WS `/sessions/:id/ws` 流式叙述。
- **关键**：`DiceSession.handleMessage` 内 `await runTurn(...)`——**同步等 GM 本回合跑完才返回 turnId**；叙述经 WS 推送的同时落库（`logSince`/`presentation` 可查）。故 HTTP 请求/响应天然能拿本轮 GM 叙述/choice/roll，MCP 工具不需 WS。
- `host = getOrCreateHost(id, …)`（registry 管 DiceSession）；`agentFactory` 据-env 切 `DiceGm`/`FakeDiceGm`。

### eval 工具链（已备，缺 CC 入口）
- `run.ts`：准备场景 + 打印手动指引（手动 `claude` / headless `claude -p` 喂 playerTurns）——**手动、缺 CC 经 MCP 连后端的入口**。
- `tool.ts`/`batch.ts`：faithful 真引擎工具链（直接 `runTool`+`TOOLS`，不嵌套 claude/MCP）。
- `grade.ts` + `grader.md`：评分 + 定性对标。
- 4 scenarios（orc-hunt / explore-bargain / gacha-draw / dragon-severity）+ 1 seed。
- `packages/core/src/eval/scenario.ts`：`prepareSessionDb`/`loadScenario`（灌种子+建临时 db，已抽）。

## 3. 设计决断（自问自答）

**D1 路线与落点**：CC 经新 play-mcp（stdio MCP）连真后端 play HTTP，**不**用 in-process DiceGm harness。
- 测真后端（缝 B，与 web 同构）> 测 in-process 副本（缝 A）：in-process harness 绕过 HTTP/registry/DiceSession/turnLoop/turnEnd/importPack，绿 ≠ 真后端 play 对。eval 该测产品链路本身。
- `handleMessage` 同步等回合跑完 → MCP 请求/响应天然适配（`send_message` 后 `get_presentation` 即得本轮结果），不需 WS。
- MCP 是 CC 原生接口，避开 headless `claude -p` 的终端解析；比 in-process harness 更真实且更简单。
- 落 `apps/orchestrator/eval/play-mcp.ts`：play-mcp 是 stdio MCP server，内部 `fetch` 本机后端 HTTP（`localhost:PORT`）。不破 ADR-0018 单向依赖（orchestrator 内部，core→orchestrator 不反）。

**D2 驱动者**：CC 当玩家 + 评估者（经 play-mcp），**不**用固定 `playerTurns` 脚本。
- eval 本质「GM 像不像真人 GM」。CC（LLM）能反应式应对——GM 给 choice 它选、要 roll 它骰、软着陆它察觉记录、措辞不对它判断——远胜死脚本 + grade 规则。AI 评 AI，符合 AI 自主范式。
- `scenario.playerTurns` 降级为 CC 的**参考输入**（CC 可照念、可临场改），不强制。
- 代价：确定性逐字对照（同输入比）牺牲；但 baseline 仍可比**行为倾向**（CC 跑两套后端对照 GM 跳骰/软着陆/收局倾向）。

**D3 baseline 对照**：后端 env `DICELORE_BASELINE=1` → `server.ts` 用 `buildBaselinePrompt`（去 doctrine）替代 `buildOpeningPrompt`，且 `diceSkills` 切空。CC 跑两套后端（doctrine / baseline）对照。
- 现状坑：`buildOpeningPrompt` 无条件内联教条，`DiceSession.openingPrompt` 硬调它。baseline 须让后端真去掉 doctrine + 不 stage skill，才能分离「教条有无」。
- 接线：`DiceSessionDeps` 加 `baseline?: boolean`；`openingPrompt` getter 与 `buildInit` 的 skills 据 it 选。

**D4 F2 终局观测**：**不替 GM 收局**（保留 run.ts「driver 知道回合预算后人为收尾」是 F2 污染源的判断）。CC 跑完 playerTurns 即停，从 `get_presentation` 的 `ended` 状态 + CC 观察谁敲 `game_end`、第几回合收/未收。**不走 onCanonWrite**（那是 in-process 缝，HTTP 链路拿不到）。

**D5 RUN_LIVE**：CC 烧 LLM + 后端 GM 烧 LLM = 双层 RUN_LIVE。跑通即验证教条接入（staged skill 真被加载、GM 真按教条行为）+ 后端 play 链路通。不另设 live smoke。不进单测，opt-in。

**D6 评估闭环**：CC 自主写 eval 报告（markdown，落 `reports/`）。`grade.ts` 降级为 CC 的**数据工具**——CC 经 play-mcp 拿到 dbPath 后可调 `grade.ts` 取掷骰绕过率等量化数据，再自己定性。**不**做一键程序自动 grade。

## 4. 架构与数据流

```
① 后端 orchestrator (startServer) 起来:play HTTP 通;GM=DiceGm(或 DICELORE_FAKE_GM=1 fake);
   DICELORE_BASELINE=1 → buildBaselinePrompt + skills 空
② apps/orchestrator/eval/play-mcp.ts (新, stdio MCP server):
   包本机后端 play HTTP 为 MCP 工具(内部 fetch localhost:PORT)
   ├ list_scenarios                         读 core eval scenarios
   ├ open_session(scenarioId)               灌种子(prepareSessionDb)+建后端 session→sessionId
   ├ start_game                             POST /start(开场回合)
   ├ send_message(text) → turnId            POST /messages(await 回合跑完)
   ├ get_presentation → {narration,choice,roll,ended,…}  GET /presentation
   ├ choose(eventId,optionIndex)            POST /choices
   ├ roll(eventId)                          POST /roll
   └ browse(source,q)                       GET /browse
③ CC 连 play-mcp(.mcp.json 指 play-mcp stdio):
   读 scenario → open_session → start_game → 逐轮 send_message + get_presentation
   + choose/roll → 跑完写 eval 报告(GM 跳骰?软着陆?该选/该骰对?收局时机?)
④ F2:get_presentation.ended + CC 观察谁敲 game_end
⑤ baseline:后端 env 切,CC 跑两套对照行为倾向
```

**关键**：`handleMessage` 同步等回合跑完才返 turnId，故 `send_message` 后 `get_presentation` 即得本轮 GM 叙述/choice/roll，无需 WS（WS 是给 web 流式；MCP 请求/响应用快照）。

## 5. 改动清单

1. **新** `apps/orchestrator/eval/play-mcp.ts` — stdio MCP server，包本机后端 play HTTP 为 MCP 工具（D1）。
2. **改** `apps/orchestrator/src/server.ts` — 据 env `DICELORE_BASELINE` 传 `baseline` 给 `createLiveApp`/`attachWsUpgrade`，且据它切 `diceSkills` 空（D3）。
3. **改** `apps/orchestrator/src/api/dice.ts`（`LiveDeps`）/`DiceSession.ts`（`DiceSessionDeps`）— 加 `baseline?: boolean`；`DiceSession.openingPrompt` 与 `buildInit.skills` 据 it 选 `buildBaselinePrompt`/空 skills（D3）。
4. **改** `apps/orchestrator/src/dice/openingPrompt.ts` — `buildBaselinePrompt`（去 doctrine，仅 signpost+prologue）；`buildOpeningPrompt` 不变。（Task 2 已写）
5. **复用** `packages/core/src/eval/scenario.ts` — `prepareSessionDb`/`loadScenario`（play-mcp `open_session` 灌种子建后端 session 库用；Task 1 已做）。
6. **撤** 不建 in-process `harness.ts`/`transcript.ts`（D1 颠覆）；`grade.ts` 不改（作 CC 数据工具）。
7. **不改** `DiceGm`/后端 play 接口（已通）。

## 6. 测试策略

- play-mcp 本身不进单测（烧 LLM，且需后端起）。
- **可单测部分**（不烧 LLM）：
  - `buildBaselinePrompt` 不含教条（断言不含「形状表」，signpost 没有）、`buildOpeningPrompt` 含（Task 2，已写）。
  - `prepareSessionDb` 场景准备正确性（Task 1，已做）。
  - play-mcp 工具 HTTP 包装闭环：起 `FakeDiceGm` 后端 + test Hono server，测 `send_message → get_presentation` 拿到 FakeDiceGm 的叙述（集成测，不烧 LLM）。
- **真 LLM 验证**（opt-in，不进 CI）：起真后端 + CC 连 play-mcp 跑 orc-hunt 两档（doctrine / baseline），CC 写首份 eval 报告，喂 grader.md 定性。

## 7. 边界 / 不做

- 不建 in-process harness（D1 颠覆）。
- 不做固定脚本玩家（D2 颠覆）；CC 自主当玩家+评估者。
- 不替 GM 收局（D4）。
- 不自动化 eval 报告（CC 写，D6）。
- baseline 对照不逐字同输入比（CC 不确定），只比行为倾向。
- 不做 inline-only 三档对照（先两档够 F1；staged 渐进披露 vs 纯内联的分离留未来）。

## 8. 依赖与下游

- **依赖**：后端 play 接口已通（G-后端-缺端点✅）、ADR-0018（Agent 适配缝，DiceGm 在后端用着）、教条接入已落、`scenario.ts`（Task 1）。
- **下游**：本批建好后，三池所有 ⚠️（待真 eval）项可重新评定；gm-core SKILL.md「措辞 eval-pending」可进 eval-loop 调措辞；F2（E1/E2 终局）可测真 GM 收不收局。
- **沉淀**：完成后 → ADR（play-mcp 作 eval 入口、eval 用缝 B 的新决策）+ 04 设计页（eval 经 MCP 连后端）+ 关 backlog F1/F2/G-后端-gmcore。
