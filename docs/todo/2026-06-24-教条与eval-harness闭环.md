# 在途交接 · 教条 + eval harness 闭环（路线图第一批）

> **性质**：路线图**第一批 · 教条 + harness 闭环**（meta 闸）的交接。本 session 已完成现状调研 + brainstorm 设计决断，**spec/plan/实现未做**，从这里接。
> **指回**：[路线图 第一批](../wiki/06-里程碑与问题/路线图.md) · [backlog-后端 G-后端-gmcore](../wiki/06-里程碑与问题/backlog-后端.md) · [backlog-core 主题F · F1/F2](../wiki/06-里程碑与问题/backlog-core.md)。
> **解决即删**（CLAUDE.md 问题生命周期③）。

---

## 一、这批是什么

meta 闸——不建真 harness，一切「GM 行为好不好 / gm-core 措辞够不够 / 缺口有多痛」的结论全部不可信（现 eval 是单人自导自演）。三件事：
1. **真 GM 接 gm-core skill**（去 stopgap）+ RUN_LIVE 验证。
2. **真 eval harness**：子代理当 GM + mock 玩家程序，每动作经 `eval/tool.ts`/`batch.ts` 调真引擎，补自动闭环。
3. **F2 终局观测**：game_end 由谁敲、何时敲纳入观测。

用户已拍板：**先接教条再建 harness**（二者是一条线——harness 要真 GM、真 GM 要教条）。

---

## 二、现状（本 session 调研结论，别重复查）

### 教条接入——代码已落，只差 RUN_LIVE 实测
- `server.ts:34` `gmCoreSkill()` 已传进 `diceSkills` → `DiceGm`。
- `DiceGm.runTurn`：skills 非空时 `stageSkills` 拷副本到 tmp cwd、`settingSources:["project"]`、`cwd:staged`、`allowedTools:["mcp__dicelore","Skill","Read"]`、in-process MCP（`type:"sdk"` instance）——**staged skill 渐进披露链路已通**。
- `openingPrompt.ts`：`gmCoreDoctrine()` 读 SKILL.md 内联进 systemPrompt 作"保证投递"兜底；`gmCoreSkill()` 返回 SkillRef。
- `gm-core SKILL.md` 教条完整（Agenda/Moves/闸 A·B/形状表），自标"措辞 eval-pending，等 harness"。
- ⚠️ **坑**：`buildOpeningPrompt` **无条件**内联教条 → 现在的 `--baseline` 仍带教条、不是纯裸对照。

### eval harness——faithful 工具链已备，缺自动闭环
- `eval/run.ts` = 准备场景（灌种子 + init 项目 + 重写 `.mcp.json` 指本地 tsx）+ **打印手动指引**（手动 `claude`/headless `claude -p` 喂 playerTurns）。
- `eval/tool.ts`/`batch.ts` = faithful 真引擎工具链（直接 `runTool`+`TOOLS`，不嵌套 claude/MCP）。
- 4 scenarios（orc-hunt / explore-bargain / gacha-draw / dragon-severity）+ 1 seed（orc-hunt-seed.ts）。
- `grade.ts` + `grader.md` 评分；`reports/` 存报告；`findings.md` 结论账本。
- **缺**：自动 GM 驱动 + mock 玩家 + 自动 grade 闭环。

---

## 三、设计决断（本 session brainstorm 自问自答，待落 spec）

| Q | 决断 | 理由 |
|---|------|------|
| **路线/落点** | 复用 `DiceGm`，harness 落 **`apps/orchestrator/eval/`** | DiceGm+Agent 适配缝本就是为这个设计的；in-process MCP+staged 教条+真引擎=最 faithful。headless `claude -p` 路线要解析终端输出、串 `--resume`、stdio 子进程，更脏更脆。落 orchestrator 不破 ADR-0018 单向：`core.createMcpServer`+`core.eval.{scenarios,grade}`+`orchestrator.DiceGm` 全 core→orchestrator。依赖倒置是过度设计。 |
| **mock 玩家** | 固定 `playerTurns` 脚本（scenario 已有） | 重点在"mock"（确定性、不抢戏、可复现），不在"智能"。LLM 玩家引入"玩家好坏"噪音污染 GM 评测，YAGNI。 |
| **baseline 对照** | 两档：`doctrine`（staged skill+内联兜底）vs `baseline`（openingPrompt 去 doctrine，纯 signpost+prologue） | 直接对应 F1"带教条是否更接近真人 GM"。**须修 `buildOpeningPrompt` 让 baseline 真去 doctrine**（现状无条件内联是坑）。 |
| **F2 终局观测** | harness **不替 GM 收局**（run.ts 现"driver 知道回合预算后人为收尾"正是 F2 污染源，必去）；mock 玩家跑完即停，transcript 记 `game_end` 调用 + 收局时机（第几回合/未收局） | 观测"真 GM 到底收不收局、谁敲"。 |
| **RUN_LIVE** | harness 本身烧真 LLM（真 DiceGm+真 Claude）= **就是 RUN_LIVE** | 跑通即验证教条接入。不另设 live smoke。不进单测，opt-in。 |
| **评分闭环** | 一键 `npx tsx eval/harness.ts <scenario> [--baseline]`：跑完自动调 `grade.ts` 出报告到 `reports/` | `findings.md` 结论性人工提炼，不自动化。 |

### 架构

```
apps/orchestrator/eval/harness.ts  (新)
  ├─ 1. 复用 core.eval 场景准备:灌种子 → 建临时 db (从 run.ts 抽出复用函数)
  ├─ 2. core.createMcpServer(db, { onCanonWrite: evt => transcript.push(evt) })  ← ADR-0020 现成缝,收工具调用痕迹
  ├─ 3. DiceGm(AgentInit{ mcpServer, openingPrompt, skills: doctrine?[gmCoreSkill()]:[] })
  ├─ 4. mock 玩家: for turn of scenario.playerTurns → gm.runTurn(turn) → 收 narration + turn_end
  ├─ 5. transcript(回合散文 + onCanonWrite 工具痕迹 + game_end 时机) → jsonl
  └─ 6. 调 core.eval.grade.ts → reports/<scenario>-<mode>.md
```

**关键复用**：工具调用观测走 `onCanonWrite` 回调（ADR-0020 现成缝），不改 `DiceGm` 事件类型——GM 每调 `sheet_update`/`resolve_*`/`narrate`/`game_end` 写规范态，回调落 transcript。F2 的 `game_end` 时机、grade 的"掷骰绕过率"都从这取。

### 涉及改动
1. **新** `apps/orchestrator/eval/harness.ts` — 自动闭环驱动。
2. **抽** `run.ts` 场景准备逻辑为可复用函数（harness 与 run.ts 共用）；run.ts 保留作"手动调试"入口。
3. **改** `buildOpeningPrompt` 支持 `baseline` 模式（去 doctrine），或 harness 直接构造不含 doctrine 的 prompt。
4. **改** `grade.ts` 接受 harness 产出的 transcript 格式（若现格式不兼容）。
5. 不改 `DiceGm`（onCanonWrite 缝已够）。

### 测试边界
- harness 不进单测（烧 LLM）。
- **可单测部分**抽出来用 `FakeDiceGm`（不烧 LLM）跑通闭环骨架：场景准备函数、transcript 格式化、baseline prompt 构造、grade 输入解析。
- 真 LLM 验证 = opt-in 跑一次 orc-hunt 两档对照，出首份 report。

---

## 四、待做步骤（autonomous-delivery-loop ④→⑦，从这里接）

1. **④ 落 spec**：把上面的设计决断 + 架构写成 `docs/superpowers/specs/2026-06-24-教条与eval-harness闭环-design.md`（调 `superpowers:brainstorming` 已完成自问自答，直接落文）；spec self-review；用户 review。
2. **④ 落 plan**：调 `superpowers:writing-plans` 拆任务到 `docs/superpowers/plans/`。
3. **⑤ 实现**：从 main 切 worktree（`superpowers:using-git-worktrees`），按 plan 派 subagent 实现（新 harness.ts + 抽 run.ts + 改 openingPrompt/grade）。**本 session 已在 worktree `groom-backlog-reroute`**（含重评 commit `fc59ac3`），实现可续用或另开。
4. **⑥ 测试**：另起 subagent 按业务语义设计测试（FakeDiceGm 闭环骨架 + 可单测部分）。
5. **⑦ 验收**：`npm test` + `npm run typecheck`；opt-in 跑一次真 LLM orc-hunt 两档对照。
6. **⑦ 沉淀 + 清场**：
   - 沉淀 wiki：教条接入收口（[ADR-0020](../wiki/05-决策记录-ADR/) §9.2 补 RUN_LIVE 实测结论）+ harness 设计（[04 玩家客户端](../wiki/04-子系统设计/玩家客户端.md) 或 eval 专页）+ F2 观测结论进 [backlog-core 主题F](../wiki/06-里程碑与问题/backlog-core.md)。
   - 关 backlog：`G-后端-gmcore` / `F1` / `F2` 标完成或 `→ADR`。
   - 路线图第一批勾掉。
   - 删本 todo + 对应 superpowers spec/plan（**沉淀在前、删除在后**铁律）。
   - 合回 main。
7. **闸的意义**：本批建好后，三池所有 ⚠️（待真harness）项才可重新评定——这是解锁第二批及后续行为类结论的前提。

---

## 五、关键约束 / 坑

- **单向依赖**：harness 在 orchestrator，import core 的 scenarios/grade/createMcpServer；core 不得反向 import orchestrator（ADR-0018）。
- **不替 GM 收局**：F2 的核心是观测真 GM 收不收局，harness 任何"人为收尾"都是污染。
- **baseline 须真裸**：`buildOpeningPrompt` 无条件内联教条是坑，baseline 档必须去 doctrine 才是有效对照。
- **onCanonWrite 缝**：工具调用观测走它，别改 DiceGm 事件类型（守 ADR-0020「不改引擎」边界）。
- **烧 LLM**：harness 真 LLM 跑不进单测，归 opt-in（`RUN_LIVE=1` 或专门 npm script）；可单测部分用 FakeDiceGm 抽离。
- **worktree npm lock 坑**：若实现期 `npm install`，scoped `git add <精确路径>`，别 `-A`/`-u`（会带 lock 文件）。
- **git 一律 `--no-pager`**（否则 less 卡死 Bash）。
