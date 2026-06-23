# 设计：Agent 适配层 + Play 会话生命周期

> **状态**：草案（2026-06-23，brainstorming 收敛，用户授权全权定稿）。
> **一句话**：把 `Agent` 抽成**适配缝**——dicelore 把架构侧契约（MCP 工具面 + 开场prompt + skill 集 + model）打包成 `AgentInit` 交给适配器，各 agent runtime（Claude Code SDK 首个、Vercel AI SDK 后续）实现 `Agent` 反向适配我们；并据新 Play 流程（团本页 → 「开始游戏」kickoff → 续玩）补齐**会话生命周期**（prologue 开场、session 列表/删除、团本名关联）。
> **上游**：[后端双路径架构](../../wiki/04-子系统设计/后端双路径架构.md)（[ADR-0023]）、[跨agent与适配层](../../wiki/03-架构/跨agent与适配层.md)（[ADR-0018]，本 spec 演进它）、[MCP工具面](../../wiki/04-子系统设计/MCP工具面.md)、[ADR-0020]（in-process MCP，本 spec 小幅修订）、[ADR-0022]（多 agent/多 model 定位）。
> **下游**：前端团本页 + Play 页（归前端 agent，本 spec 出 API 契约）。
> **不在本 spec**：团本作者工具/检索库（`feat/build-tools` 线）、声明式运行时工具生成（`feat/tool-gen` 线）、前端 UI 实现。

---

## 1. 背景

- **病根**：跑团 GM（orchestrator `DiceGm` = `@anthropic-ai/claude-agent-sdk`）`settingSources:[]` + 不传 systemPrompt → 既不自动载 gm-core skill、也没被喂开场指路牌 → 退化成通用叙事者。skill（`packages/core/skills/dicelore-gm-core`）在、`buildSessionContext` 指路牌在，但 orchestrator 这条路**没接线**。
- **定位**：[ADR-0022] 要「可对接多 agent / 多 model」。现状是单一 claude-agent-sdk 绑定。需把 agent 层抽成适配缝，CC SDK 降为**首个适配器**（不废），多 runtime 可插。
- **新 Play 流程**（用户与前端 agent 定）：团本页选团本 →「开始游戏」大金按钮 → 后端建 session/import → **GM 开场回合（prologue 驱动、无玩家输入）流式吐开场叙事** → 出现输入框续玩。每团本根目录带 `prologue.md`（团本侧开场 prompt，build agent 产）。

---

## 2. 决策（本轮收敛，全权定）

| # | 决策 | 理由 |
|---|---|---|
| AD-1 | **适配粒度 A（窄）**：`Agent` 适配器只担「驱动一回合：{MCP 工具面 + 开场prompt + skill 访问 + model} → narration/error/turn_end 事件流」。turn-end 物化/L3、notify、明骰 gate **仍 orchestrator 拥有** | 对齐现状（L3 本在 turnLoop）；接入成本低；承重逻辑留 dicelore 侧、不要求每 agent 实现 |
| AD-2 | **开场prompt 叠加 A**：`openingPrompt = buildSessionContext(引擎 signpost) + prologue.md(团本)` | 引擎管「怎么当 GM」(指向 gm-core skill)、团本管「这是什么世界」；各一层、单源 |
| AD-3 | **CC SDK 为首个适配器、不废**；`Agent` 接口 + `AgentInit` + `AgentFactory` 立适配缝；Vercel AI SDK 等后续 | 兑现 ADR-0022；演进 [ADR-0018]「v1 骑定 CC」→「适配缝 + CC 首个」 |
| AD-4 | **skill 可达 = 会话本地副本 + 适配器载**：`ClaudeCodeAgent` 开局把**源 skill 拷一份**进会话临时 `.claude/skills/`，SDK 据此加载（agent 自调 + 渐进披露 references/）。源 `packages/core/skills/` 唯一权威 | 对齐 skill 机制（自调非注入）；副本隔离 + 源不被 harness auto-update 污染；保渐进披露 |
| AD-5 | **修订 [ADR-0020]**：in-process MCP 不变；放开「**每会话受控 staged skills 目录**」的加载（非读项目 `.claude`）。`settingSources` 由 `[]` 改为指向会话 staged 目录（仅 skills） | gm-core 自调必须能加载 skill；staged 目录是受控副本、非读不可信项目配置 |
| AD-6 | **kickoff = 无输入 GM 开场回合**：`POST /sessions/:id/start` 以 prologue 为首轮 impetus 驱动一回合 → WS 流式开场叙事；session_meta 标 `started`、幂等 | 「开始游戏」按钮语义；prologue 是 prompt 非成品文，需 GM 跑出叙事 |
| AD-7 | **session ↔ 团本关联** 存 session_meta（团本名 + tuanbenId + ref + prologue + started）；`GET /sessions` 带团本名前缀、`DELETE /sessions/:id` 可删 | Play 页列表/删除/空态跳转所需 |

---

## 3. 适配缝（`Agent` + `AgentInit` + `AgentFactory`）

```ts
// dicelore 架构侧 → 适配器 的一次性构造契约
interface AgentInit {
  mcpServer: McpServer;     // in-process dicelore 工具面(L1)
  openingPrompt: string;    // buildSessionContext + prologue.md(AD-2)
  skills: SkillRef[];       // 源 skill 引用(dice: gm-core[+flows] / lore: dicelore-build-pack)(L2)
  model?: string;           // 多模型
}
interface SkillRef { name: string; srcDir: string } // 源目录(packages/core/skills/<name> 或 build-skills/<name>)

interface Agent { runTurn(input: TurnInput): AsyncIterable<TurnEvent>; } // 粒度 A,签名不变
type AgentFactory = (init: AgentInit) => Agent;
```

- **适配器**：
  - `ClaudeCodeAgent`（= 现 `DiceGm` 升级，`@anthropic-ai/claude-agent-sdk`，首个）：构造时 stage skills（AD-4）+ `query()` 挂 `mcpServer`、`systemPrompt=openingPrompt`、`model`、`settingSources` 指 staged 目录、`allowedTools` 含 dicelore + Skill/Read（让其自调 skill）。
  - `AiSdkAgent`（Vercel AI SDK，后续，多 provider）——本 spec 留接口，不实现。
- **`DiceSession`/`LoreSession`** 不再直接 `new DiceGm`：组装 `AgentInit`（拼 openingPrompt + 选 skill 集 + model）→ 调注入的 `AgentFactory`。适配器只见 `AgentInit`，与 session 解耦。
- 现 `driverFactory: (host)=>Agent` → 升级为 `agentFactory: (init)=>Agent` + host 造 init。

## 4. 开场prompt 组装（AD-2）

`openingPrompt(db) = buildSessionContext(db)  +  "\n\n---\n\n"  +  prologue`
- `buildSessionContext`（已有）：GM 身份/Agenda/纪律/「每轮 consult dicelore-gm-core skill」/调性。
- `prologue`：团本 `prologue.md` 正文，import 时存进 session_meta（§6），开局时取。
- 缺 prologue（旧团本/未带）→ 只用 signpost，不报错。

## 5. skill 可达（AD-4/AD-5）

`ClaudeCodeAgent` 构造时：
1. 建会话临时目录 `<tmp>/dicelore-skills-<sessionId>/.claude/skills/`。
2. 把 `init.skills` 每个 `srcDir` **拷贝**进去（含 SKILL.md + references/）。
3. `query()` options：`settingSources: ["project"]` + `cwd` 指该临时目录（仅暴露 staged skills，不碰真实项目 .claude）；`allowedTools` 加入 Skill/Read（agent 能触发载入 + 读 references）。
4. 会话结束清理临时目录。
- **降级兜底**：若 SDK staged-skill 加载实测不通，回退「把 SKILL.md 正文塞进 openingPrompt 末」（丢渐进披露，但保教条到位）——实现期 TDD 决定走哪条。
- 源 `packages/core/skills/` 唯一权威；副本只读；harness 若 auto-update 改的是副本、随会话弃，不回灌源（回灌走 dicelore repo 的 eval-loop 显式做）。

---

## 6. Play 会话生命周期（新流程）

### 6.1 流程
团本页（列 catalog）选团本 →「开始游戏」→ 后端 `open`(建库 import) + 返回 sessionId → 前端连 WS + `start`(kickoff) → GM 开场叙事流式 → 出输入框续玩。Play 页亦可列既有 session 续玩；无 session → 提示去团本页。

### 6.2 session_meta（开局写）
import/open 时写入：`tuanben_id`、`tuanben_name`、`ref`、`prologue`、`started=0`、`created_at`、`updated_at`。（session_meta 是 KV 表，逐键存。）

### 6.3 import 接出 prologue（core）
`importPack` 识别包根 `prologue.md`（与 manifest.md 并列、非顶层目录）→ 不物化进 store，而是**回传**给调用方（`ImportResult.prologue?: string`），由 orchestrator 写 session_meta。manifest.md 的 name 也一并回传作团本名兜底。

### 6.4 kickoff（AD-6）
`DiceSession.start()`：若 `session_meta.started!=1` → 以 prologue 为首轮 impetus 跑一回合（`runTurn` 经 `streamDriverTurn`，TurnInput.text = 内部开场信号/prologue 引子）→ WS 流式开场叙事 → 置 `started=1`。已 started 幂等返回。常规续玩仍 `handleMessage(text)`。

### 6.5 API 契约（给前端 agent）
| 端点 | 行为 |
|---|---|
| `GET /catalog` | 列团本（已有） |
| `POST /sessions/:id/open` `{tuanbenId, ref}` | 建库 import + 写 session_meta（团本名/prologue/ref）（扩现有） |
| `POST /sessions/:id/start` | **新**：kickoff 开场回合（幂等），WS 流式开场叙事 |
| `POST /sessions/:id/messages` `{text}` | 续玩回合（已有） |
| `GET /sessions` | **改**：返回 `[{sessionId, tuanbenName, status, started, updatedAt}]`（团本名前缀；源 session_meta，非裸 .db 文件名） |
| `DELETE /sessions/:id` | **新**：删 session（删 .db + registry 注销 + hub 断开） |

### 6.6 会话列表来源
`GET /sessions` 改为扫 sessions 目录的 .db、逐个读其 `session_meta`（tuanben_name/started/updated_at）拼摘要；空目录 → `[]`（前端据此引导去团本页）。

---

## 7. 范围 / 欠账 / 波及

- **IN**：`Agent` 适配缝（AgentInit/AgentFactory/ClaudeCodeAgent）、开场prompt 组装、skill staging、kickoff `/start`、prologue import、session_meta 关联、`GET /sessions` 加料、`DELETE /sessions`。**gm-core 终于接进跑团 GM**（AD-3/4 落地的副产）。
- **OUT**：`AiSdkAgent` 实现（留接口）；前端 UI（团本页/Play 改造，归前端 agent）；团本作者工具/检索（build-tools 线）；声明式工具生成（tool-gen 线）。
- **波及 wiki**：演进 [跨agent与适配层 §0/§1]（v1 骑定 CC → 适配缝 + CC 首个）；修订 [ADR-0020]（settingSources 放开 staged skills）；新 ADR（agent 适配层）。
- **并行协调**：本线动 `apps/orchestrator/{pkg/agent,dice/*,api/dice,server}` + `core/catalog/import` + `session_meta`，与前端 agent 在 `api/dice`/`server`/`lore` 有重叠面——worktree 隔离开发，合 main 时逐文件对账。

## 8. 验收

- **适配缝**：`DiceSession` 经 `AgentFactory(AgentInit)` 起 GM；`ClaudeCodeAgent` 换成假实现时 session 行为不变（接口未泄漏 SDK）。
- **gm-core 真接入**：跑团 GM 的 systemPrompt 含 signpost+prologue，且能 consult gm-core skill（staged 加载或注入兜底）——真 GM 行为带规则纪律（待真 LLM 实测）。
- **kickoff**：`POST /sessions/:id/start` → WS 收到 `turn_started→narration_commit→turn_ended` 开场叙事；二次 start 幂等不重跑。
- **会话生命周期**：`open` 后 session_meta 有团本名/prologue；`GET /sessions` 列出带团本名；`DELETE` 后该 session 消失。
- **回归**：core + orchestrator 全测试绿、tsc 0；现有跑团/明骰/notify 行为不变。
- **单源**：源 skill 不被改；prologue 不物化进 store（只 session_meta）。

