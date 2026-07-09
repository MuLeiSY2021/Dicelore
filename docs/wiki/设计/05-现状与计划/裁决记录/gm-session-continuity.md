# 裁决：gm-session-continuity —— 一个团本一个 SDK session（resume 续接 LLM history）

- [X]  用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 来源：核审 `usage-and-context` 裁决（RT-FE14/15/17）前提时发现重大缺陷。
> 用户 2026-07-09 定调：「肯定是一个 session 一个 agent；canon 只是辅助 mcp；历史记录是历史记录，直到一个团结束为止的所有东西才是记忆」。
> 现状核实（确凿·非推断）：
>
> - `DiceSession.ts:123` 注释「每回合新建一个 agent」，line 154/193/221 每回合 `agentFactory(buildInit())` 新建 DiceGm。
> - `DiceGm.ts:136` 调 `query({ prompt, options })`，options 来自 `buildQueryOptions`（`gmAssembly.ts`）。
> - `GmQueryOptions`（`gmAssembly.ts:28-40`）**无 `resume`/`sessionId`/`continue`/`forkSession` 字段**；`DiceGm.ts:126` 直接 `as` 成 SDK Options 也未补。
> - 整个 harness `grep -rn resume` **空**——从未续接。
> - SDK 流出的 `session_id` 只被 `DiceGm.ts:66,73` logMsg 记进日志，**未存库、未用于续接**；backend meta（`DiceSession.ts:76-80`）只有 adventure_id/ref/prologue/started/ended，**无 SDK session_id 字段**。
> - SDK `Options`（`sdk.d.ts:116`）明确：`resume?: string`「Session ID to resume. Loads the conversation history from the specified session」——续接靠传 `resume: <SDK session_id>`，dicelore 没传 = 每回合开新 session。
>
> **结论**：从第一回合起每回合都开新 SDK session，**LLM 对话历史完全不跨回合续接**。GM「记忆」被迫全靠每回合调 `mcp__dicelore` 工具（`event_recall`/`world_show`/`world_search`/`rule_search`）读 canon 重建。canon 扛起了本应由 LLM history 扛的记忆主载体职责，与其「辅助 MCP」定位不符。这是缺口、不是设计——没有任何「保存 SDK session_id 供下回合 resume」的代码路径。

---

## 一、核心定调：一个团本 = 一个 SDK session

- 一个团本（dicegm session）从开局到 game_end 贯穿**一个 SDK session**，LLM 对话历史连续续接，直到团结束。
- canon 回归**辅助 MCP**：`world_*`/`event_recall`/`rule_search` 仍是 GM 主动查的持久化世界态/事件/规则入口（机制不删），但不再是「被迫每回合全靠它恢复记忆」。narrate 写 canon（`narrate-hook-extension` 裁决）继续——canon 是叙事正典化，与 LLM history 正交。
- 续接手段 = SDK `resume: <sdk_session_id>`。**不自研历史管理**，复用 SDK transcript 续接能力。

## 二、session_id 采集（首回合）

- SDK 流出的消息中，`system` init（`subtype: "init"`）最早携带 `session_id`——`DiceGm.ts:73` 已在 logMsg 里取 `m.session_id`，证明该字段可达。
- **首回合**（`kickoff`，`DiceSession.ts:221`）query 流消费到 system init 时，取出 `session_id`，经新事件上抛给 DiceSession，由 DiceSession `backend.metaSet("sdk_session_id", id)` 存库。
- 采集点【拟·待确认 C1】：确认 system init 的 `session_id` 即 SDK transcript 的 session 标识（`resume` 接受的值）。若 result 消息更可靠则改从 result 取。实现时在首回合日志核对 `m.session_id` 与 SDK transcript 文件名一致即可证。
- 采集失败（极罕见·SDK 未流出 session_id）→ 视同未续接，本回合开新 session，下回合再尝试采集；不阻断。

## 三、resume 传递（后续回合）

- `GmQueryOptions` 加字段 `resume?: string`（`gmAssembly.ts`）。
- `BuildQueryOptionsArgs` 加 `resume?: string`，`buildQueryOptions` 透传进 `base.resume`。
- `AgentInit` 加 `resume?: string`（`agent.ts`）；`DiceSession.buildInit()`（`DiceSession.ts:124`）从 `backend.metaGet("sdk_session_id")` 取值注入：
  - 首回合（meta 无值）→ `resume` 省略 → SDK 开新 session → 采集成 session_id 存库。
  - 后续回合（meta 有值）→ `resume: <sdk_session_id>` → SDK 加载该 session 历史续接。
- `DiceGm.runTurn` 把 `this.init.resume` 透传给 `buildQueryOptions`（与 model/plugin 等并列）。
- **历史喂给机制**（查证 2026-07-09）：CC Agent SDK **无 `messages`/`history` 入参**——`Options` 全字段无 messages 字段，`prompt` 只收本轮输入（`string | AsyncIterable<SDKUserMessage>`）。SDK 是 agent-session 抽象：**历史由 SDK 自己持久化**（`persistSession` 默认 `true`，transcript 存 `~/.claude/projects/`，`sdk.d.ts:265`），dicelore 只传 `resume: <sdk_session_id>`，SDK 内部按 session_id 加载该 session 完整历史续接。**dicelore 不手动喂 messages、不管 transcript 文件路径**——只存一个 session_id 指针。可选 `sessionStore` 镜像到外部存储（本裁决不需要）。
- **C2 验证点**：① `buildQueryOptions` 未显式设 `persistSession` → 走默认 `true` ✅（SDK 自动存 transcript）；② 第二回合 `resume` 后 SDK 流出 system init `session_id` 与首回合一致 = 续接成功；③ 若 `~/.claude/projects/` 被外部清理致 resume 失败 → 走 §五 C4 降级。

## 四、DiceGm 实例生命周期（保持每回合 new）

- **不改成 session 级 DiceGm 单例**。resume 续接的是 SDK transcript（按 session_id + cwd 持久化），与 DiceGm 实例无关——跨实例 resume 可行。
- 保持现状「每回合 new DiceGm（`buildInit`）」+ 在 `buildInit` 注入 `resume`。最小改动、不动 DiceSession 生命周期。
- 「一个 session 一个 agent」= 语义层一个团本一个 SDK session（连续 history），**不强制**复用 DiceGm 实例。复用实例不带来额外收益（SDK 状态不在 DiceGm 实例里）。

## 五、生命周期与降级

- **团结束（game_end → 复盘态）**：session 仍 resume（复盘回合也依赖 history）。复用 `debrief-and-branch` 裁决的复盘态，不另开 SDK session。
- **重开一团（同 adventure 再来一局）**：新 DiceSession = 新 SDK session。`metaSet("sdk_session_id", ...)` 仅本 DiceSession 生命周期内有效；新局不带旧 sdk_session_id → 开新 session。【拟·待确认 C3：确认「重开」走新 DiceSession 而非复用——实现时核对开局路径】
- **resume 失败降级**【拟·待确认 C4】：transcript 丢失/损坏致 `resume` 抛错 → `DiceGm.runTurn` 的 catch（`DiceGm.ts:153`）捕获 → 清旧 `sdk_session_id`、本回合 fallback 开新 session + 记 error 日志、向玩家发可恢复 error 事件，**不阻断游戏**。代价：GM 本局失忆至 canon 能恢复的部分。实现时查证 SDK resume 失败的异常类型/错误码以精确识别（区别于一般 API 错误）。

## 六、为 RT-FE8（branch/rewind）铺垫（本裁决不实现）

`debrief-and-branch` 裁决定调：rewind = 覆盖当前分支、branch = copy 新 jsonl。SDK resume 机制为此提供基础（本裁决只做线性 resume，以下为后续对接点，不在本裁决实现）：

- **rewind**：SDK `resumeSessionAt?: string`（`sdk.d.ts:128`「resume up to and including this message UUID」）——可从特定回合点 resume，实现「回退到某回合」。
- **branch**：SDK `forkSession?: boolean`（`sdk.d.ts:133`「resumed sessions fork to a new session ID」）——resume 时 fork 到新 session_id，实现「copy 新 jsonl 分支」。

本裁决建立 resume 基础设施（session_id 存取 + resume 透传），RT-FE8 在其上加 `resumeSessionAt`/`forkSession` 两参数即可。

## 七、与 usage-and-context / RT-FE14·15·17 的关系（本裁决是其前提）

- 本裁决实现后，LLM history 随长局累积 → `contextTokens`（= 最近一轮 `input+cacheRead+cacheCreation`）随回合增长 → [`usage-and-context`](usage-and-context.md) §一前提（history 走 cache、占用随回合涨）才成立。
- 故 `usage-and-context` 裁决依赖本裁决先行。RT-FE15「auto-compact / 自动丢弃老记录」的压缩对象 = 本裁决续接累积的 LLM 老回合（非 canon）。
- **交付顺序**：本裁决先于 `usage-and-context` 进波。

---

## 待用户确认清单


| #  | 项                            | 推荐值                                                                                                                                                                                | 你的定调                                                  |
| -- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| C1 | SDK session_id 采集点         | system init 的`session_id`（最早·已有代码取到）                                                                                                                                      | system init 的`session_id`（最早·已有代码取到）          |
| C2 | 历史喂给机制 + persistSession | 已查证：SDK 无 messages 入参，靠`resume:session_id` 加载 SDK 自持久化 transcript（`persistSession` 默认 true）。dicelore 不喂 messages。待验：跨 DiceGm 实例 resume 能找到 transcript | 认可查证                                                  |
| C3 | 「重开一团」走新 DiceSession  | 是（新局不带旧 sdk_session_id，开新 SDK session）                                                                                                                                     | 是                                                        |
| C4 | resume 失败降级               | 清旧 id + fallback 开新 session + 记日志，不阻断（代价：本局失忆至 canon）                                                                                                            | resume 失败<br /><br />就报错提示历史记录丢失；需要开新局 |

---

## 验收

- 首回合（kickoff）后 `backend.metaGet("sdk_session_id")` 有值。
- 第二回合 `query` options 含 `resume: <该值>`（buildQueryOptions 装配断言可 offline 验）。
- 第二回合 SDK 流出的 system init `session_id` **与首回合一致** = 续接成功（日志核对）。
- **行为手测**：连续两回合，第二回合玩家发言引用第一回合内容，GM 无需调 `event_recall` 即能正确接续（证明 history 走 LLM 而非全靠 canon）。
- 长局多回合后 `contextTokens` 随回合增长（验证 `usage-and-context` 前提成立）。
- resume 失败降级：人为删除/损坏 transcript → 下回合 fallback 开新 session + error 日志、不崩。
- 期望首跑见红（现状无 resume 字段、无 session_id 存储 = 红）。

## owns（预期触及，非独占）

- `harness/src/runtime/agent.ts`：`AgentInit` 加 `resume?: string`。
- `harness/src/dicegm/gmAssembly.ts`：`GmQueryOptions` + `BuildQueryOptionsArgs` 加 `resume`，`buildQueryOptions` 透传。
- `harness/src/dicegm/DiceGm.ts`：首回合从 system init 取 `session_id` 上抛（新 TurnEvent 或复用 usage 通道扩展）；`runTurn` 透传 `init.resume`。
- `harness/src/dicegm/DiceSession.ts`：`buildInit` 注入 `resume`（从 meta 取）；首回合存 `sdk_session_id`（经 DiceGm 上抛）；resume 失败降级清旧 id。
- backend：meta 存 `sdk_session_id`（已有 metaSet/metaGet，无需新表）。
- **不动** canon MCP 工具集（`world_*`/`event_recall`/`rule_search` 保留，回归辅助）。
- **依赖**：`debrief-and-branch`（复盘态 session 仍 resume）、`usage-and-context`（本裁决为其前提）。

## 完成后

沉淀进 [04-子系统设计/玩家客户端-接口](../../04-子系统设计/玩家客户端-接口.md)（GM session 续接：sdk_session_id 存取 + resume 透传）+ 对应设计页「决策与权衡」节（一个团本一个 SDK session·canon 回归辅助）+ 关 backlog（新 backlog 项：GM session 续接缺口）+ 勾路线图；删本裁决文件。
