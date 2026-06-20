# MCP 工具面（组件2）

> **本页职责**：定"外层 MCP 工具面"的详细设计——裁决工具（resolver 三件）+ 数据工具 + 可见性工具 + `narrate` 的**入参/出参 schema（Zod）**、补刀形态、内层原子→外层工具的组合映射。这是 L1 塑形的焊接位。
> **上游依赖**：[总体架构 §2 两层工具 / §3 数据工具 / §3.1 可见性 / §4 裁决 / §4.1 narrate / §6 一轮+三流](../03-架构/总体架构.md)；[技术选型 §1 Zod / §4 stdio](../03-架构/技术选型.md)；[02 §2 四业务域+要点5 / §3 行动层](../02-领域模型/核心概念.md)；[ADR-0007 状态骰下沉 / 0009 narrate 升格 / 0010 可见性](../05-决策记录-ADR/)；求值与存储语义 → [内层能力库](内层能力库.md)。
> **状态**：🟢 已成型（2026-06-03 brainstorming；R1-R3 上游落地后解冻填充）。

---

## 0. 命名与通用约定

- **`dicelore_` 前缀是实际注册 ID**（防多 server 撞名）：`dicelore_resolve_choice`、`dicelore_sheet_update`……本页正文为简洁**一律写无前缀名**，实际工具 ID 加 `dicelore_`。
- **expr 全程是字符串、MCP 不解析**（[内层 §3.1](内层能力库.md)、[ADR](../05-决策记录-ADR/)）：凡 `expr` 字段都是 `"1d20 + {张三.力量}"` 这样的串，MCP 原样透传给内层求值器，本层不拆。
- **AI 只给引用、不给真实数值**（铁律，[03 §4](../03-架构/总体架构.md)）：靠 expr 的 `{实体.属性}` 约定 + 内层引擎取真值；**schema 不强卡**（自由串拦不住硬编数字），降级为 L2 教 + L3 账本审计（与状态骰下沉同构，[ADR-0007](../05-决策记录-ADR/)）。
- **通用出参信封（成功路径）**：多数工具回 `{ ...本工具结果, event_id?, reminders? }`。`event_id` = 该操作落的 event 行；`reminders` = 补刀（§5）。
- **一轮时序**（[03 §6](../03-架构/总体架构.md)）：工具**轮内可多次、任意顺序**调用；`resolve_choice` 是**暂存**（回合末经 Stop hook 物化）、`narrate` 是**散文 stream**，其余即时返回即时生效。
- **三流归属**：resolver / `sheet_update` 的**结构化结果回 AI**（流③，本页 schema 即流③形状）；玩家看到的机械回显 + 菜单由**输出层**读 store/event 渲染（流②，非本页）。
- **接口契约（本页定骨架，实现期补全文案）**：
  - **out ＝ MCP `outputSchema`**：各工具 out 形状即注册期 `outputSchema`，经 `structuredContent` 回 AI（流③），**不塞进 `content[].text` 当散文**。
  - **入参一律 `.strict()`**：in schema 默认禁多余字段，未列字段报错而非静默吞（自由度只在 `expr` 串内，字段集本身收紧）。
  - **工具 `description`/`title` 属本页契约、非 L2**：MCP description 注册期固定、skill 改不动，必含五段——①一句功能 ②Args 逐参 ③Returns（＝outputSchema 形状）④1–2 条 use / don't-use 示例 ⑤错误说明。本页 schema 是其骨架；与补刀**措辞**（L2，归 [Skills 包](Skills包.md)）分属两层、别混。
  - **失败路径信封**：出错回 MCP `isError: true` + `content` 带可执行 message，并附结构化 `{ error: { code, message, hint } }`。`code` 枚举：`EXPR_EVAL`（求值失败）/`NOT_NUMERIC`（该掷/算术却给非数值）/`RANGE_INVALID`（档位重叠或不全覆盖）/`ENTITY_NOT_FOUND` 等。**触发条件归 [内层能力库](内层能力库.md)**，本页只定信封 + code 枚举 +「message 必可执行」。`reminders` **不**兼任错误通道。
    - **实现约束（SDK v1.x 实测，2026-06）**：错误信封的结构化 `{ error }` **必须序列化进 `content[].text`、绝不放 `structuredContent`**。因 `@modelcontextprotocol/sdk` 即便 `isError: true` 也会拿 `structuredContent` 去校验该工具的 `outputSchema`（成功形状），带上即触发 `-32602` 校验失败（社区实测确认、官方维护者认证此为唯一规避）。故成功路径用 `structuredContent`（流③），错误路径只用 `content` text 承载结构化 error。
  - **CHARACTER_LIMIT 封顶**：回可变大文本的工具（`sheet_list`/`world_search`/`event_recall` 等）出参封顶 ~25k 字符，超出则截断 + `truncated: true` + 续取提示。**enforcement 归内层**，本页定字段约定。

---

## 1. 裁决工具（resolver）schema

承接 [02 §3](../02-领域模型/核心概念.md)、[03 §4](../03-架构/总体架构.md) 与 [resolver 二轴表](TODO.md)。三个独立裁决工具——共性：**随机/取真值全在引擎内执行，AI 给不出也改不了真实结果**（anti-F1/F2），且**各落一条"裁决记录"event 供 L3 比对叙述**。

### 1.1 `resolve_choice`（玩家选 label；暂存、回合末物化）

```ts
// in
{
  prompt: z.string(),                         // 抛给玩家的情境问句
  options: z.array(z.object({
    label: z.string(),                        // 选项文案
    consequence: z.string(),                  // 该选项后果——必填 ＝「声明后果在先」(L1, anti-F2)
  })).min(2),
}
// out（暂存确认，非玩家选择）
{ staged: true, options: [...同上], }          // 不含 event_id：event 在回合末物化时才落
```

- **暂存语义**（[ADR-0009](../05-决策记录-ADR/)）：本调用只把"下轮选项+后果"暂存进会话态，**轮内可反复调用改写、末次为准**；AI 的回合自然结束时，**Stop hook 物化**——落一条选项+后果 event（seq 在玩家 pick 之前 → L3 可验"后果在先"）、由输出层呈现给玩家。
- **玩家选择怎么回收**＝模式/adapter 层（聊天/转轮/投票），**非本页**（[adapter](adapter与L3审计.md)）；本页只负责到"暂存 + 物化信号"。
- **非终局轮回合末必须留有暂存 choice**，否则 L3 判违规（[03 §5/§6](../03-架构/总体架构.md)）。

### 1.2 `resolve_outcome`（随机选 label：选项骰/档位）

```ts
// in
{
  context: z.string(),                        // 这是在裁决什么（落 event + L3 用）
  die: z.string(),                            // 单骰串，如 "1d100"
  bands: z.array(z.object({
    label: z.string(),
    min: z.number(), max: z.number(),         // 闭区间；内层校验不重叠/全覆盖（rangeMap）
    consequence: z.string(),                  // 预声明后果（anti-F2）
  })).min(1),
}
// out
{ roll: z.number(), die, band: {label, consequence}, event_id }
```

- 引擎掷 `die` → `rangeMap` 命中一档（[内层 §2](内层能力库.md)）。**暴击不是引擎逻辑**，是档位表里的一档（如 `{label:"完美",min:96,max:100}`）。
- `die` 是单骰串、不卷入 expr 文法（只 resolver_contest / sheet_update 用 expr）。
- **三档结果（PbtA 对齐，[ADR-0016](../05-决策记录-ADR/README.md)）**：`bands` 是团本/AI 定义"三档结果"的落点——典型应是**完全成功 / 部分成功（成功但有代价）/ 失败（有后果）**而非二元成败，"零代价完全得手"是窄档、非默认。每档 `consequence` 即该档的 fail-forward 后果（[Skills 包 §3](Skills包.md)）。

### 1.3 `resolve_contest`（随机选 verdict：对抗骰）

```ts
// in
{
  context: z.string(),
  a: z.object({ name: z.string(), expr: z.string() }),   // expr 如 "1d20 + {张三.力量}"
  b: z.object({ name: z.string(), expr: z.string() }),   // DC＝一边退化成常数 expr "15"
}
// out（带账本，喂 L3）
{
  a: { rolls: number[], refs: {…取到的真值}, total: number },
  b: { … },
  winner: "a" | "b" | "tie",
  event_id,
}
```

- 两边都是**完整 expr 串**（骰子+引用+常数）；内层求值器各自取真值+掷+求和→比大小，回**账本**（每项 `rolled/ref/int` 标注，[内层 §3.1](内层能力库.md)）。DC 不是独立 judge，是一边为常数。

---

## 2. 数据工具 schema

承接 [03 §3 四域表](../03-架构/总体架构.md)。读工具不落 event；写工具落对应 event（mutation/note）。

### 2.1 sheet 读：`sheet_get` / `sheet_list`

```ts
sheet_get:  { entity: z.string(), attr: z.string() }            → { value: string|null, visible: 0|1|2 }
sheet_list: { entity: z.string(), prefix: z.string().optional(),
              limit: z.number().int().min(1).max(200).default(100),
              offset: z.number().int().min(0).default(0) }
          → { cells: [{attr, value, visible}], has_more: boolean, next_offset?: number }
//   prefix 走前缀扫：`张三.`取整卡、`张三.库存:`取整库存（[内层 §4.1](内层能力库.md)）。不用 `_like`（泄漏 SQL）。
//   limit 是上下文分块、非可见性限制：AI 可翻页取全貌（可见性只由 visible 列控制，不冲突“GM 全见”）。
```

- **AI 读到的是含 `visible` 的全貌（GM 全见）**；`visible` 仅供输出层过滤玩家所见，不限制 AI 读取。

### 2.2 sheet 写：`sheet_update`（批量、状态骰下沉于此）

```ts
// in —— 一次 entity 作用域批量写，整批一个事务（原子）
{
  entity: z.string(),
  mutations: z.array(z.object({
    attr: z.string(),                         // LHS 裸名，归本批次 entity
    op:   z.enum(["+", "-", "="]),
    expr: z.string(),                         // 值表达式 / 词条字面量；随 op 多态（[内层 §3.2](内层能力库.md)）
    visible: z.union([z.literal(0),z.literal(1),z.literal(2)]).optional(),
                                              // 省略：新建 cell 默认 0(隐)、已存 cell 不变；2＝强制隐(暗值)
  })).min(1),
}
// out —— 账本，每项标 rolled|set，喂 L3
{
  entity,
  applied: [{ attr, op, kind: "rolled"|"set", old, rolls?: number[], delta?, new }],
  fired_watchers?: [{ watcher_id, payload, condition }],  // 本次写就地触发的 watcher（[ADR-0013](../05-决策记录-ADR/)）→ AI 当轮即时反应
  event_id,                                   // 落一条 kind=mutation event（每个触发的 watcher 另落一条 kind=watcher_fired）
}
```

- **状态骰已下沉**（[ADR-0007](../05-决策记录-ADR/)）：带骰项（`HP-2d6`）引擎内掷、AI 给不出真值；纯赋值/集合增减同批，**整批原子**，非数值算术报错+整批回滚。
- "该掷却用了 `=`/裸 set" 的 L1 摩擦已降级 → L2 教（[Skills 包 §2 Moves 形状表](Skills包.md)，该页自述此处塑形权重最高）+ L3 据 `kind` 标记审计。

### 2.3 event：`event_append` / `event_recall` / `watcher_set`

```ts
event_append: {
  content: z.string().optional(),             // 散文进 content 走 FTS
  kind: z.enum(["narrate","note","verdict","mutation","watcher_fired","reveal"]).default("note"),
  data_json: z.unknown().optional(), tags: z.array(z.string()).optional(),
  visible: z.union([z.literal(0),z.literal(1)]).optional(),  // 省略＝按 kind 默认（[内层 §4.2](内层能力库.md)）
} → { event_id }

event_recall: { query: z.string(), k: z.number().default(8), kind?: ... } → { events: [...] }
//   FTS5(jieba) 召回（[内层 §5](内层能力库.md)）；AI 自读，不靠高亮片段。

watcher_set: {                                // 命名 dicelore_watcher_set（独立名；泛化并取代旧 timer_set，[ADR-0013](../05-决策记录-ADR/)）
  condition: z.string(),                      // §3.1 谓词 expr "{张三.HP} < 30"、"{世界.天} >= 18"（求值 bool）
  payload:   z.string(),                      // 触发时给 AI 的提示文本
  mode:      z.enum(["once","repeat"]).default("once"),
} → { watcher_id }
//   引擎只登记；**触发＝sheet_update 写完就地比对、非 hook 轮询**：命中经 sheet_update 出参回 AI + 落 kind=watcher_fired。
//   edge-triggered（跨越沿触发、条件解除才 re-arm），v1 无显式 cooldown。详见 [内层 §4.2](内层能力库.md)。
```

> `narrate` 虽落 event，但作为输出通道单列 §4，不在此。

### 2.4 world：`world_search` / `world_sample` / `world_register`

```ts
world_search: { query: z.string(), k?: z.number(), category?: z.string() }
            → { docs: [{name, content, category, visible}] }     // FTS5 散文设定
world_sample: { pool: z.string(), n: z.number().default(1), filter?: z.record(z.string()) }
            → { rows: [{row_json, weight, source}] }              // 加权抽样在 TS 层（content resolver）
world_register: {                                                 // GM 现编（source=ai）
  target: z.enum(["doc","pool"]),
  doc?:  { name, content, category?, tags? },
  pool?: { pool, row_json, weight?: z.number().default(1) },
  visible: z.union([z.literal(0),z.literal(1)]).optional().default(0),  // 现编默认隐，待 show
} → { ok: true }
```

### 2.5 rule：`rule_search`（只读）

```ts
rule_search: { query: z.string(), k?: z.number() } → { rules: [{name, content, version}] }
```

- **AI 对 rule 只读**（反讨好红线，[02 §2](../02-领域模型/核心概念.md)）；无写工具。被动召回（hook 注入）属 [跨agent §3](../03-架构/跨agent与适配层.md)。

---

## 3. 可见性工具 schema（`sheet_show` / `world_show` / `reveal_once`）

承接 [03 §3.1](../03-架构/总体架构.md)、[ADR-0010](../05-决策记录-ADR/)。GM 用这三个工具控制"玩家能看到什么"；输出层据 `visible` 过滤渲染。

```ts
// 持久揭示（翻 visible=1，输出层渲染实时值）
sheet_show: {
  entity: z.string(),
  attrs: z.array(z.string()).optional(),      // 给定＝attr 级；省略 + recursive＝entity 级
  recursive: z.boolean().default(false),      // entity 级递归：写 __show_all 策略（长效、覆盖未来 attr）
  visible: z.boolean().default(true),         // false＝un-show 兜底（边角）
} → { shown: [...], audit_event_id }          // 强制隐(=2) 的 cell 不受 recursive 影响
world_show: {
  name?: z.string(), pool?: z.string(), row_ref?: z.string(),
  recursive: z.boolean().default(false),
} → { shown: [...], audit_event_id }
//   show 各写一条 kind=note、visible=0（对玩家隐）的审计 event（"第 N seq 揭示了 X"），供 L3/回看。

// 一次性快照披露（不翻持久可见位；多态：sheet cell | world 条目）
reveal_once: {
  sheet?: z.object({ entity: z.string(), attr: z.string() }),   // 二选一
  world?: z.object({ name?: z.string(), pool?: z.string(), row_ref?: z.string() }),
} → { ref, content, event_id }                // append 一条 kind=reveal 的可见 event（冻结副本）
//   sheet（值暗变）→ 玩家见旧值、下次 reveal_once 才刷新；world（基本静态）→ 一次性披露、不入持久可见集。
```

---

## 4. `narrate` 输出通道 schema

承接 [03 §4.1](../03-架构/总体架构.md)、[ADR-0009](../05-决策记录-ADR/)：散文 stream、轮内可多次、**非终结步骤**。

```ts
narrate: {
  text: z.string(),                           // AI 组织好的剧情散文
  tags: z.array(z.string()).optional(),       // 召回辅助
} → { event_id, reminders? }                  // 落一条 kind=narrate、默认 visible=1 的 event
```

- **无 `game_time`**（time 不升格，[ADR-0011](../05-决策记录-ADR/)）；不带"本回合裁决引用"（L3 靠"一个 agent 回合"窗口机械圈定，[内层 §4.2](内层能力库.md)）。
- `narrate` 只**承接 + 记录**散文，不生成叙事；机械结果由输出层渲染（流②），AI 不在 `text` 里吐数值菜单。
- **降级形态**（chat 原生 talk + 自动捕获写 event）→ [adapter](adapter与L3审计.md)。

---

## 5. 补刀形态（`reminders` 字段）

承接 [03 §2/§4.1/§5](../03-架构/总体架构.md)（L1/L2 混合）。

- **挂载点**：塑形相关工具的出参带可选 `reminders: string[]`（走流③、**只回 AI**、是反讨好提醒，不进玩家输出层）。承载工具：`resolve_outcome`/`resolve_contest`（掷出坏结果时）、`sheet_update`（账本异常时）、`resolve_choice`（后果已锁时）。**`narrate` 不挂 reminder**（散文通道、无客观结构触发位）。
- **填充（混合）**：MCP server 内置一张**极小的"结构触发 → 短提醒"表**作 L1 底线（如命中失败档 → "尊重结果，别软着陆"；后果已锁 → "后续叙述须与已锁后果一致"）；本字段**只载这张内置 terse 表**。**丰富措辞归 [Skills 包](Skills包.md)（L2）**，由 AI 内化为 doctrine 后体现在**自身输出**——**v1 不在运行时把 L2 富文本拼进本字段**（详 [Skills 包 §5](Skills包.md)）。
- 本页只定**字段 + 触发位**；具体**措辞**与触发表条目 → [Skills 包](Skills包.md)。

---

## 6. 终局信号（`game_end` / `you_death`）

承接 [03 §6](../03-架构/总体架构.md)（唯二非 choice 收尾）。v1 极简：

```ts
game_end: { reason: z.string(), outcome?: z.string() } → { ended: true, event_id }
//   you_death ＝ game_end 的语义特例（可走同工具 + reason，或单列别名）。
```

- 标记本局终结、回合末**不要求**留暂存 choice；此后"AI 陪玩家复盘"属**饼/future**，v1 不展开。

---

## 7. 内层原子 → 外层工具映射 + 工具清单

承接 [03 §2](../03-架构/总体架构.md)"不是 1:1 暴露"：外层是内层原子的**有意组合 + L1 包装**。

| 外层工具（`dicelore_` 前缀） | 调用的内层原子 | 落 event | 备注 |
|---|---|---|---|
| `resolve_choice` | 会话态暂存（无引擎） | 回合末物化时落 | 暂存、回合末 Stop hook 物化 |
| `resolve_outcome` | 骰子引擎 `rollDice`+`rangeMap` | verdict | 选项骰 |
| `resolve_contest` | 求值器 `evalExpr`×2 + 比大小 | verdict | 对抗骰；DC=常数 expr |
| `sheet_get`/`sheet_list` | store 读 | — | 含 visible 全貌回 AI |
| `sheet_update` | `applyMutations`（带骰调引擎） | mutation | 批量原子、状态骰下沉 |
| `event_append`/`event_recall` | event store + FTS | note/… | — |
| `watcher_set` | watcher 表登记 | —（触发时 watcher_fired） | sheet_update 就地比对、非 hook |
| `world_search`/`sample`/`register` | world store + FTS + 加权抽样 | — | sample=content resolver |
| `rule_search` | rule store + FTS | — | 只读 |
| `sheet_show`/`world_show` | store 翻 visible（+__show_all） | note（审计、隐） | 持久揭示 |
| `reveal_once` | 读目标 + append reveal event | reveal | 多态、快照副本 |
| `narrate` | event 追加 | narrate | 散文 stream |
| `game_end` | 会话态终态标记 | note | 终局 |

> **裸骰子永居内层、AI 调不到**——限制工具面本身即 L1（[03 §2](../03-架构/总体架构.md)）。

> **回滚 / 快照不在本工具面**（[ADR-0017](../05-决策记录-ADR/)、[内层 §4.5](内层能力库.md)、[adapter §8](adapter与L3审计.md)）：撤回 / branch / swipe 是**玩家元动作、非游戏动作**——快照由 Stop hook 写、回滚由 UserPromptSubmit hook auto-sync（兜底 CLI），**不给 AI 工具**（防 AI 把回滚当叙事手段滥用）。故上表无 `rollback` / `checkpoint` 类工具。

### 7.1 工具注解（MCP annotations）

> `openWorldHint` 全局 `false`（封闭世界、无外部实体），下表略。

| 工具 | readOnlyHint | destructiveHint | idempotentHint |
|---|---|---|---|
| `sheet_get`/`sheet_list`/`world_search`/`event_recall`/`rule_search` | ✅ | false | ✅ |
| `world_sample` | ✅ | false | false（随机抽样） |
| `sheet_update` | false | false | `=` 幂等 / `+`/`-` 非幂等 |
| `event_append` | false | false | false（每调用新行） |
| `narrate` | false | false | false（每调用新行） |
| `resolve_outcome` / `resolve_contest` | false | false | false（含随机） |
| `resolve_choice` | false | false | ✅（暂存、末次为准） |
| `sheet_show` / `world_show` | false | false | ✅ |
| `reveal_once` | false | false | false（每次新 reveal） |
| `world_register` | false | false | false |
| `watcher_set` | false | false | false |
| `game_end` | false | **true** | false |

---

## 本页**不**负责定的

- 表 schema、FTS5、`expr` 文法与求值、`visible` 列存储/强制隐藏标记/`reveal_once`=reveal 的写入语义 → [内层能力库](内层能力库.md)
- 错误的**触发条件**（求值失败、`rangeMap` 校验、非数值算术）与 **CHARACTER_LIMIT 截断的 enforcement** → [内层能力库](内层能力库.md)（本页只定错误信封 + code 枚举 + 截断字段约定）
- 教条内容（别软着陆怎么写）、补刀**措辞**与触发表条目、工具选择决策树 skill → [Skills 包](Skills包.md)（本页只定补刀的**结构挂载点**）
- 各 agent 的工具注册、`narrate` 降级、Stop hook（物化 choice + L3 审计）、被动 rule 召回 hook、watcher 触发 payload 怎么经 `sheet_update` 出参回 AI、玩家输入捕获 → [adapter 与 L3 审计](adapter与L3审计.md) / [跨agent与适配层](../03-架构/跨agent与适配层.md)
- 玩家选择的捕获方式（聊天 / 转轮 / 投票）、单/多人模式 → 模式/adapter 层
