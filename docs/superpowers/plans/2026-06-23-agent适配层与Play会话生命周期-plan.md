# Agent 适配层 + Play 会话生命周期 实现计划

> 按 superpowers:executing-plans 逐 Task；每 Task TDD + `npm test`/`tsc` 绿 + commit。
> **上游 spec**：[2026-06-23-agent适配层与Play会话生命周期-design](../specs/2026-06-23-agent适配层与Play会话生命周期-design.md)（AD-1~7）。

> **状态(2026-06-24)：✅ 全 9 Task 落地**。AgentInit/AgentFactory/SkillRef + skillStage + DiceGm 吃 AgentInit(staged skill)
> + DiceSession/LoreSession/ws/dice/lore/server 全线 driverFactory→agentFactory；prologue import / session_meta /
> kickoff `/start` / `GET·DELETE /sessions` 均在。orchestrator 45 测试 + core 254 + web 19 e2e(真服务器)全绿。
> **遗留(单点)**：staged-skill 活体加载效果待 `RUN_LIVE` 实测裁定(spec Task3「降级兜底」)——当前教条已内联进
> openingPrompt 作**保证投递**,即便 staged 不通 GM 仍有教条,下行风险有界。沉淀 → [后端双路径架构](../../wiki/04-子系统设计/后端双路径架构.md)。

**Goal:** 把 `Agent` 抽成适配缝（`AgentInit`/`AgentFactory`），gm-core 终于接进跑团 GM（openingPrompt=signpost+prologue + skill 会话副本可达）；据新 Play 流程补 prologue import / session_meta / kickoff `/start` / `GET·DELETE /sessions`。

**Architecture:** orchestrator `pkg/agent` 加 AgentInit/AgentFactory；`DiceGm` 升级吃 AgentInit（openingPrompt+skills+mcpServer+model）+ skill staging；`DiceSession` 造 AgentInit；core `import` 接出 prologue → session_meta；新 kickoff/sessions 端点。**CC SDK = 首个适配器（DiceGm 保留名，ClaudeCodeAgent 改名作 cosmetic 后续，减并行合并冲突）。**

**Tech Stack:** TS ESM、@anthropic-ai/claude-agent-sdk、Hono、better-sqlite3、vitest。

## Global Constraints
- 不动前端文件（前端 agent 并行）；本线只 orchestrator + core。
- AGPL 头；`.js` import；测试 `cd apps/orchestrator|packages/core && npx vitest run <p>`。
- 源 skill `packages/core/skills/` 只读、不改；prologue 不物化进 store（只 session_meta）。
- 现有跑团/明骰/notify 行为不变（回归绿）。

---

## Phase 1 · Agent 适配缝 + gm-core 接入

### Task 1: `pkg/agent.ts` 加 AgentInit / SkillRef / AgentFactory
**Files:** Modify `apps/orchestrator/src/pkg/agent.ts`；Test `pkg/agent.test.ts`(类型存在性轻测可省，靠 tsc)
**Interfaces:** Produces `interface SkillRef { name:string; srcDir:string }`、`interface AgentInit { mcpServer: McpServer; openingPrompt:string; skills: SkillRef[]; model?:string }`、`type AgentFactory = (init:AgentInit)=>Agent`。保留 Agent/TurnInput/TurnEvent。

- [ ] Step1: 追加类型(import McpServer type)。
- [ ] Step2: `npx tsc --noEmit` 绿。
- [ ] Step3: commit `feat(agent): AgentInit/SkillRef/AgentFactory 适配缝类型`

### Task 2: `dice/skillStage.ts` — 会话本地 skill 副本
**Files:** Create `apps/orchestrator/src/dice/skillStage.ts` + `skillStage.test.ts`
**Interfaces:** Produces `stageSkills(sessionId:string, skills:SkillRef[]): string`(建 `<tmp>/dicelore-skills-<sid>/.claude/skills/<name>` 拷 srcDir,返回该 cwd 根)、`cleanupSkills(dir:string):void`。
- [ ] Step1 测试:给一个临时 srcDir(含 SKILL.md) → stageSkills → 目标 `.claude/skills/<name>/SKILL.md` 存在,返回路径含 `.claude` 父。
- [ ] Step2 跑红。Step3 实现(node:fs cpSync/mkdirSync/rmSync)。Step4 绿。Step5 commit `feat(dice): skillStage 会话本地 skill 副本`

### Task 3: `DiceGm` 升级吃 AgentInit + skill staging + openingPrompt
**Files:** Modify `dice/DiceGm.ts`；Modify `dice/DiceGm.live.test.ts`(若引用 deps)
**Interfaces:** `DiceGm` 构造改吃 `AgentInit`（mcpServer/openingPrompt/skills/model）。runTurn: 首次 stage skills(若 skills 非空)→ query options:`systemPrompt=openingPrompt`、`settingSources` 指 staged cwd（skills 非空时）否则 `[]`、`allowedTools` 加 dicelore + Skill/Read、`cwd` = staged 根；turn 末/实例销毁清理。
> **降级兜底**：若 staged-skill 加载实测不通 → openingPrompt 末追加 SKILL.md 正文（保教条）。实现期跑 `RUN_LIVE` 决定;默认走 staged。
- [ ] Step1: 改 `DiceGmDeps`→ `AgentInit`(或令 DiceGm 直接吃 AgentInit)。Step2: runTurn 接 stageSkills + options。Step3: tsc + 现有测试绿(FakeDiceGm 不变)。Step4: commit

### Task 4: `pkg/openingPrompt.ts` — 组装 signpost + prologue
**Files:** Create `apps/orchestrator/src/dice/openingPrompt.ts` + test（注:buildSessionContext 在 core,orchestrator 调 `@dicelore/core` 导出）
**Interfaces:** Produces `buildOpeningPrompt(db:DB, prologue?:string): string` = `buildSessionContext(db)` + (prologue? `\n\n---\n\n`+prologue : "")。
- 需 core 导出 `buildSessionContext`(查;未导出则补)。
- [ ] Step1 测试:有/无 prologue 两形态。Step2 红。Step3 实现。Step4 绿。Step5 commit

### Task 5: `DiceSession` 造 AgentInit + 注入 AgentFactory；server 接线
**Files:** Modify `dice/DiceSession.ts`、`dice/registry.ts`、`api/dice.ts`、`server.ts`
**Interfaces:** `DiceSessionDeps.agentFactory: AgentFactory`(替 driverFactory)、`skills: SkillRef[]`(dice 默认 gm-core);`DiceSession` 内造 `AgentInit{mcpServer, openingPrompt: buildOpeningPrompt(db, prologueFromMeta), skills, model}` 传 factory。server: `agentFactory = fake? FakeAdapter : (init)=>new DiceGm(init)`;gm-core SkillRef 指 `<core>/skills/dicelore-gm-core`。
- [ ] Step1-4: 改 + 现有 server/session 测试改造(driverFactory→agentFactory)绿。Step5 commit

---

## Phase 2 · Play 会话生命周期

### Task 6: core import 接出 prologue + manifest name
**Files:** Modify `packages/core/src/catalog/import.ts` + `import.test.ts`
**Interfaces:** `ImportResult` 加 `prologue?: string`、`tuanbenName?: string`;`importPack` 识别包根 `prologue.md`(不物化、回传)、`manifest.md` H1(团本名回传)。`prologue.md` 加进 KNOWN_TOP(根文件白名单)避免 validate 拒。
- [ ] Step1 测试:含 prologue.md 的包 → res.prologue 命中、不进 store。Step2 红。Step3 实现(topSeg=='manifest.md'同款根文件处理)。Step4 绿(+改现有 toEqual 形状)。Step5 commit

### Task 7: open 写 session_meta(团本名/prologue/ref/started=0)
**Files:** Modify `dice/DiceSession.ts`(importFrom 时 metaSet)、确认 core 有 `metaSet`(session/resolve.ts;无则补导出)
**Interfaces:** import 后 `metaSet(db,"tuanben_name",..)/("prologue",..)/("tuanben_id",..)/("ref",..)/("started","0")`。
- [ ] Step1-4: DiceSession importFrom 块加 metaSet;测试 open 后 metaGet 命中。Step5 commit

### Task 8: kickoff `POST /sessions/:id/start`
**Files:** Modify `dice/DiceSession.ts`(加 `start()`)、`api/dice.ts`(端点)
**Interfaces:** `DiceSession.start(): Promise<{started:boolean}>` — `metaGet started!=1` → 以 prologue 为 TurnInput 跑 runTurn(经 streamDriverTurn)→ 置 started=1;幂等。`api`: `app.post("/sessions/:id/start")` → getOrCreateHost + host.start()。
- [ ] Step1 测试:start → WS turn_started/narration/turn_ended + started=1;二次 start 幂等(不重跑)。Step2 红。Step3 实现。Step4 绿。Step5 commit

### Task 9: `GET /sessions` 加料 + `DELETE /sessions/:id`
**Files:** Modify `dice/sessions.ts`(listSessionSummaries 读每库 session_meta)、`api/dice.ts`(DELETE)、`dice/registry.ts`(evict)
**Interfaces:** `listSessionSummaries(dir)` 返回 `{sessionId, tuanbenName?, status, started, updatedAt?}`(开每个 .db 读 meta);`DELETE /sessions/:id` → registry evict + 删 `${dir}/${id}.db` + hub detach。
- [ ] Step1-4: 测试列表带 tuanbenName、DELETE 后消失。Step5 commit

---

## 验收
- `cd packages/core && npx vitest run && tsc --noEmit`；`cd apps/orchestrator && npx vitest run && tsc --noEmit` 全绿。
- DiceSession 经 AgentFactory(AgentInit) 起 GM;openingPrompt 含 signpost(+prologue);gm-core 经 staged skill 可达(或注入兜底)。
- kickoff /start 幂等开场;GET /sessions 带团本名;DELETE 生效;prologue 只在 session_meta、不进 store。
- 现有跑团/明骰/notify 回归绿。
