# 玩家闸控明骰（BG3 式）设计 (Design)

> **状态**：🟢 已 brainstorming 定稿(2026-06-21)。
> **一句话**：把「掷骰这个动作的归属」从引擎交还给玩家——`resolve_*_open`（明骰）是**阻塞式** MCP 调用(仿 AskUserQuestion)，玩家在客户端点击触发、亮 DC、见证成败;点数仍由引擎在点击时计算(anti-F1 不破)。与之对照 `resolve_*_hidden`（暗骰）引擎自动掷。
> **上游权威**：[总体架构 §2 L1 名分流 / §4 resolver 二轴](../../wiki/03-架构/总体架构.md)、[MCP工具面.md](../../wiki/04-子系统设计/MCP工具面.md)(resolver 族)、[内层能力库.md](../../wiki/04-子系统设计/内层能力库.md)(pending_choice 槽 / dice / expr)、[adapter与L3审计.md](../../wiki/04-子系统设计/adapter与L3审计.md)、[Skills包.md](../../wiki/04-子系统设计/Skills包.md)(Moves)、[玩家客户端.md](../../wiki/04-子系统设计/玩家客户端.md) + [玩家客户端-接口.md](../../wiki/04-子系统设计/玩家客户端-接口.md)(线上契约) + [玩家客户端-视觉.md §8](../../wiki/04-子系统设计/玩家客户端-视觉.md)(本设计销其「掷骰式裁决 UI 待回填」)。
> **路径说明**：core = `packages/core/src/…`;线上契约 = `packages/shared/src/…`;后端 = `apps/orchestrator/`;前端 = `apps/web/`。
> **跨线**：core + skill 归 GM 运行时线(组件3/4);`packages/shared` 契约与组件7 线共用;UI + 阻塞/WS 桥接 + 宕机恢复归组件7 线。

---

## 0. 动机与立场

[01 §2c 语料](../../01-业务分析/调研-论坛语料痛点.md)外的一条参与感诉求:**若所有掷骰(战斗 / 检定)都由引擎自动决定,玩家会觉得「还不是 AI 直接决定我的命运」**。解法 = 把「掷骰这个**动作**」交还玩家(参与感),但「点数」仍归引擎(anti-F1)。这两件事**正交**:玩家点按钮 ≠ 玩家定数。形态对标博德之门——UI 点击 → 引擎掷 → 亮出 DC 与点数 → 成功/失败。

**不动的地基**：anti-F1(随机全在引擎、AI 与玩家都给不出真值);可见性(`visible` 列语义)。

---

## 1. 两条正交轴

| 轴 | 取值 | 归属 |
|---|---|---|
| **点数权威** | 引擎计算 | 恒引擎(anti-F1)。客户端篡改也伪造不了。 |
| **掷骰动作 + 透明度** | 明骰 / 暗骰 | 新增。明骰=玩家点击触发 + 亮 DC + 见证;暗骰=引擎自动掷、GM 替掷。 |

> **明骰 ⊥ 透明度（eval 厘清，2026-06-21）**：明骰的根本是「**玩家来掷**」（gating），**亮 DC 是默认、非铁律**——契约 `pendingRoll.dc` 本就可选（§6）。玩家主动行动但目标 DC 隐藏（敌人 AC 暗、隐藏检定线）→ **仍走明骰**（玩家掷、见证），但**不亮 DC**（卡显 `vs ???`）；透明度让位可见性（暗值焊死）。别因 DC 隐藏退回暗骰、把玩家这一拍夺走。此乃恶龙团语料 eval 暴露「明骰默认 vs 隐藏 AC」张力后的厘清，已落 gm-core §谁掷。

---

## 2. 工具面:明/暗各拆(L1 名分流，无布尔参)

承接 [总体架构 §2/§4](../../wiki/03-架构/总体架构.md)「给选项/掷骰用不同工具名分流」——**不给 `resolve_*` 加 `gated`/`visible` 布尔参,而是拆成不同工具名**,逼 GM 显式回答「这一掷是玩家的还是 GM 的」。

| 结果形状 | 暗骰(引擎自动掷) | 明骰(玩家闸控掷，阻塞) |
|---|---|---|
| **区间** label | `resolve_outcome_hidden` | `resolve_outcome_open` |
| **胜负** verdict | `resolve_contest_hidden` | `resolve_contest_open` |

- 现有 `resolve_outcome` / `resolve_contest` **重命名加 `_hidden`**(pre-1.0,为消歧值得改;`_hidden` 描述里讲明「引擎自动掷、非结果隐藏」)。
- `resolve_choice`(玩家选 label)不动——与明骰同属「玩家面向交互式 resolver」族,一个选、一个掷。
- 暗骰 schema/行为 = 现状不变(同步掷、回 verdict);明骰 schema 见 §6 + 下表入参同暗骰 + `awaiting:"player_roll"` 语义(§3)。

---

## 3. 明骰 = 阻塞式 MCP 调用(核心机制)

仿 AskUserQuestion:`resolve_*_open` 工具调用本身**阻塞**,结果作为**工具返回值**在**同一 GM 回合内**回给 GM——不跨回合、不经 Stop 物化。

**handler 注入 `awaitPlayerRoll(eventId): Promise<void>` 能力**:

- **能力存在(组件7)** → handler:① 持久化 `pending_roll`(规格:`shape`/`yourSide.expr`/`dc`/`bands`,**无结果**) → ② 经后端通知前端「待掷」 → ③ `await awaitPlayerRoll(eventId)` → ④ 玩家点击触发 → ⑤ core 此刻调 `commitPendingRoll` 掷 + 写 `kind=verdict` event → ⑥ **返回结果给 GM**(回合内)。
- **能力缺失(裸 CC)** → handler 当场立即 `commitPendingRoll` 掷、直接返回(不阻塞,降级)。两路都在回合内返回结果。

**core 侧落点**(本线可单测部分):
- `pending_roll` 槽(仿 [pending_choice](../../wiki/04-子系统设计/内层能力库.md));单行/按 eventId,status: `awaiting`→`committed`。
- `commitPendingRoll(db, eventId, rng?)`:读规格 → 掷(复用 dice/expr 求值)→ 写 verdict event(含 DC、点数、成败、`visible=1`)→ 槽置 committed → 返回结果。**纯函数、RNG 注入可单测**。
- `awaitPlayerRoll` 是 orchestrator 注入的**接缝**(core 只定接口);其阻塞/WS 桥接实现归组件7 线。

> 明骰 happy path **不碰 Stop hook**(结果回合内即返回);Stop 的 choice 物化/ L3 审计照旧,不受影响。

---

## 4. 通信流程(组件7 路径)

四角色:**👤玩家 / 🖥️前端(apps/web) / ⚙️后端 orchestrator(REST+WS + Agent SDK 驱动 GM + 进程内 dicelore MCP + 三 hook + 读 core db) / 🎲core 引擎(库,跑在后端进程内,写 .db) / 🤖GM(Claude,经 Agent SDK 被后端驱动)**。前端只跟后端说话;core 不是独立服务、在后端进程内;GM 被后端驱动。

```
回合 N(一个回合内完成，中途阻塞):
 ① 👤输入"我压价" ─POST /message─▶ ⚙️后端 ─Agent SDK─▶ 🤖GM 处理回合N
 ② 🤖GM 调 resolve_contest_open(你的说服 vs DC15)        ← 此调用【阻塞】，不返回
 ③ 🎲core handler: 持久化 pending_roll(规格,无结果) → 经后端向前端发"掷骰请求" → await
 ④ 🖥️前端: 先记日志(持久化,供宕机恢复) → 弹 BG3 掷骰卡
 ⑤ 👤点击[掷骰]
 ⑥ 🖥️前端 ─POST /sessions/{id}/roll {eventId}─▶ ⚙️后端 ─▶ 🎲core
 ⑦ 🎲core 引擎【此刻】掷(commitPendingRoll) → 写 verdict event → resolve ③ 的 await
 ⑧ ⚙️后端 ─WS roll_committed(18 vs15 成功)─▶ 🖥️前端: 骰子动画 + 成败高亮
 ⑨ 🎲core: resolve_contest_open 此刻【返回】"18 vs15 成功"给 🤖GM(回合N未结束)
 ⑩ 🤖GM 据结果接着叙述 ─WS narration_delta─▶ 前端 → 回合N 自然结束
```

与 `resolve_choice`(跨回合异步:GM 给选项→结束→玩家选→作下轮输入)的区别:明骰**回合内阻塞**,结果是工具返回值。两者都把能动性这一拍交还玩家,只是 choice 玩家提供「选了哪个」、明骰玩家只提供「我掷了」、值由引擎出。

**裸 CC 降级**:无前端可阻塞 → `resolve_*_open` 当场立即掷、直接返回(③⑦⑨ 合并,跳过 ④⑤⑥⑧⑩ 的人机往返)。无按钮无动效,不卡死。

---

## 5. 宕机恢复

`pending_roll` 落库(③)+ 前端记日志(④)= 双持久化。后端在 await 中崩溃时,阻塞调用 + GM 回合丢失。恢复:重启读到 `pending_roll` status=`awaiting` → 前端重连重弹掷骰卡 → 玩家掷 → 写 verdict → 把结果**作输入重驱 GM**(恢复路退化成异步喂,而非阻塞返回)。`pending_roll` 库 + verdict event 是真相源,结果总能补达。

> 恢复路的「重驱 GM」实现归组件7 线(orchestrator 持有 Agent SDK 会话);core 侧只保证 `pending_roll` 持久 + `commitPendingRoll` 幂等(已 committed 不重掷)。

---

## 6. `packages/shared` 线上契约新增(填 [接口§8](../../wiki/04-子系统设计/玩家客户端-接口.md) / [视觉§8](../../wiki/04-子系统设计/玩家客户端-视觉.md) 待回填)

- **snapshot 加** `pendingRoll: { eventId:number; shape:"outcome"|"contest"; label:string; yourSide:{ name:string; exprDisplay:string }; dc?:number; bands?:{label:string;min:number;max:number}[] } | null`(只含规格,无结果;`exprDisplay` 给前端展示如 `1d20+{说服}`,真值不下发)。
- **stream 加两条**：`roll_staged{ pendingRoll }`(弹卡)、`roll_committed{ eventId; rolls:number[]; total:number; dc?:number; outcome:"success"|"fail"|band-label }`(驱动动画 + 回显)。
- **REST 加** `POST /sessions/{id}/roll { eventId }` → `202 { turnId }`(仿 `POST /sessions/{id}/choices`)。
- 与组件7 线协调:这正是其 §8/B 标的「区间裁决 vs choice 物化关系待厘清」——**明骰=玩家闸控掷、choice=玩家选,两者并列于「玩家面向交互式 resolver」**。落地需在 `packages/shared` 加 schema(不与隔壁线撞 `choices`)。

---

## 7. gm-core skill 指引(教 GM 何时明/暗)

- **Moves 形状表加「谁掷」栏**:玩家主动行动的检定(你攻击/说服/潜行)→ **明骰**(交还命运决定权,participation);NPC/世界/暗检定(敌人攻击、暗感知、隐藏 DC)→ **暗骰**。
- **补一条 Principle**(一轮范式簇/F3 邻):默认把玩家主动行动的高风险掷做成明骰,别替玩家拍板开骰。
- 措辞 **eval-pending**(终稿靠 [skill-creator eval-loop](2026-06-21-skills-and-adapter-design.md),harness 就绪后)。

---

## 8. 组件7 UI(隔壁线建，本设计只定 §6 契约)

BG3 掷骰卡:亮「你的 说服 `1d20+{说服}` vs DC 15」→ 单按钮[掷骰] → 骰子动效 → 成功/失败高亮。消费 §6 的 `roll_staged`/`roll_committed`。

---

## 9. 不变量

- **anti-F1**:点数恒由 core 在点击时计算;前端只触发 + 播动画;客户端篡改伪造不了真值。
- **可见性**:明骰本就「亮」(DC/点数 `visible=1`);暗值、隐藏 DC 的检定走暗骰(`visible` 照旧)。明骰不碰暗值红线。

---

## 10. 实现分线

| 线 | 落点 |
|---|---|
| **本线(组件3/4 / core)** | 2 个 `_open` 工具 + `pending_roll` 槽 + `commitPendingRoll` + `awaitPlayerRoll` 接缝 + 现有两工具改名 `_hidden` + gm-core「谁掷」指引 |
| **`packages/shared` 契约** | §6 三处新增(与组件7 线共用,需协调不撞) |
| **组件7 线** | `POST /roll` 端点 + 阻塞/WS 桥接(`awaitPlayerRoll` 实现)+ BG3 掷骰卡 UI + 宕机恢复重驱 |

---

## 11. 出本设计(不在范围)

- 骰子动效美术 / 掷骰卡细节(组件7)。
- 明骰措辞终稿(eval-loop)。
- 多人安价下「谁来点这一掷」(未来,先单人)。
- 暗骰是否也需「结果不可见」的真隐藏变体(现 `_hidden` 仅指引擎自动掷、结果默认可见;真隐藏走 `visible` 参数,不新拆工具)。

---

## 12. 落档清单(本设计批准后)

- `docs/wiki/04-子系统设计/MCP工具面.md` — 4 个明/暗掷骰工具 + schema + 注解。
- `docs/wiki/04-子系统设计/内层能力库.md` — `pending_roll` 槽 + `commitPendingRoll` 语义 + `awaitPlayerRoll` 接缝。
- `docs/wiki/04-子系统设计/adapter与L3审计.md` — 明骰 happy path 不碰 Stop;裸 CC 降级 auto-commit;恢复重驱属组件7。
- `docs/wiki/04-子系统设计/Skills包.md` — gm-core Moves「谁掷」栏 + Principle。
- `docs/wiki/04-子系统设计/玩家客户端-接口.md` — §6 契约,销视觉§8/接口的「待回填」。
- `docs/wiki/05-决策记录-ADR/` — 新 ADR(玩家闸控明骰 / 明暗名分流 / 阻塞模型 / anti-F1 边界)。
