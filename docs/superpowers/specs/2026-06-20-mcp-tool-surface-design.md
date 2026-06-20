# 组件2「MCP 工具面」设计 (Design)

> **状态**：🟢 已 brainstorming 定稿(2026-06-20)。
> **上游权威 spec**：[MCP工具面.md](../../wiki/04-子系统设计/MCP工具面.md)(§0 通用约定 / §1 resolver / §2 数据工具 / §3 可见性 / §4 narrate / §5 reminders / §6 终局 / §7 映射+annotations)、[内层能力库.md](../../wiki/04-子系统设计/内层能力库.md)(§1 三原子层 / §3 expr / §4 四域)、[技术选型.md](../../wiki/03-架构/技术选型.md) §1(Zod/SDK v1.x)/§4(stdio)。
> **本文档职责**:把上游 spec 的工具契约落成可实现的**模块边界、编排归属、接线方式、错误/reminders 实现位**。spec 已定的工具语义不复述。

---

## 0. 目标与范围

把内层(组件1,已在 main)包成一组 `dicelore_*` MCP 工具(stdio server),Zod in/out schema,**薄包装**内层原子。范围 = spec §7 工具清单:

- resolver 三件:`resolve_choice` / `resolve_outcome` / `resolve_contest`
- 数据工具:`sheet_get` / `sheet_list` / `sheet_update` / `event_append` / `event_recall` / `watcher_set` / `world_search` / `world_sample` / `world_register` / `rule_search`
- 可见性:`sheet_show` / `world_show` / `reveal_once`
- 输出/终局:`narrate` / `game_end`

**不在范围**(spec §7 末、跨agent/adapter):回滚/快照/branch/swipe(玩家元动作,hook 处理,不给 AI 工具)、玩家选择捕获、Stop hook 物化 choice、L3 审计、被动 rule 召回 hook、watcher payload 注入机制。

**先补两处内层缺口**(均属内层③层「裁决编排」,可单测、是薄包装的前置):
1. `resolveOutcome` / `resolveContest` 编排(③层,Plan1 只做了 `applyMutations` 一个③层函数)。
2. `pending_choice` 槽读写(`resolve_choice` 暂存语义,表已建、读写未实现)。

---

## 1. 架构总览

```
src/
  errors.ts              ★新:DiceloreError + code 枚举(叶子模块,无依赖)
  resolve/               ★新:③层裁决编排(脱 MCP、喂内存 db/RNG 可单测)
    outcome.ts             resolveOutcome(die, bands, rng?) → {roll, band}
    contest.ts             resolveContest(db, a, b, rng?)   → {a,b,winner}
  store/
    choice.ts            ★新:pending_choice 单行槽读写
    truncate.ts          ★新:CHARACTER_LIMIT 截断 helper(纯函数)
    (既有 sheet/event/watcher/mutate/world/rule/visibility/db 在已知触发点改抛 DiceloreError)
  mcp/                   ★新:外层工具面
    schemas.ts             每工具 Zod in(.strict()) / out schema
    reminders.ts           内置极小「结构触发→terse 提醒」表
    envelope.ts            成功/错误信封 + classify(e)→code + 截断套用
    runTool.ts             dispatch:校验→handler→reminders→成功信封 / catch→错误信封
    tools.ts               工具注册表 ToolDef[]
    handlers/*.ts          纯 handler:(db, input)=>out,失败 throw DiceloreError
    main.ts                bin:openSession(env)→db→McpServer→registerTool→stdio
```

**依赖单向向下**:`mcp/handlers` 吃 `resolve/`、`store/`、`errors`;`mcp/main` 吃 `session/openSession` + `mcp/tools` + SDK。内层不 import `mcp/`。

**handler / wiring 分离(核心约束)**:handler 是 `(db: DB, input) => out` 纯函数,失败 throw `DiceloreError`;**注入内存 db 即可脱 stdio 单测**。`runTool` 围绕 handler 加信封/reminders/错误捕获,可用假 handler 单测。`main.ts` 只做 openSession + 注册 + 连 transport,薄到不强求集成测。

---

## 2. 内层缺口(③层编排 + 槽)

### 2.1 `src/resolve/outcome.ts`

```ts
import type { Band, Rng } from "../dice/index.js";
export interface OutcomeResult { roll: number; die: string; band: Band; }
// 解析单骰串 "1d100"→rollDice(1,100,rng)→求和→rangeMap(roll, bands)。
// 不落 event(落 event 是 MCP handler 的事)。die 非法 → DiceloreError(DIE_INVALID)。
export function resolveOutcome(die: string, bands: Band[], rng?: Rng): OutcomeResult
```
- `die` 用就地正则 `^\s*(\d+)[dD](\d+)\s*$` 解析(不卷入 expr 文法,spec §1.2);非此形状 → `DIE_INVALID`。解析出 count/sides 后调 `rollDice`(其 count≥1/sides≥2 校验亦抛 `DIE_INVALID`)。
- `rangeMap` 的重叠/落空校验沿用,抛 `RANGE_INVALID`(见 §3)。

### 2.2 `src/resolve/contest.ts`

```ts
import type { ExprLedger } from "../expr/evaluate.js";
export interface ContestSide { name: string; ledger: ExprLedger; }
export interface ContestResult { a: ContestSide; b: ContestSide; winner: "a"|"b"|"tie"; }
// evalExpr(a.expr) / evalExpr(b.expr) 各回账本(getRef 取 sheet 真值)→比 total→winner。
export function resolveContest(
  db: DB,
  a: { name: string; expr: string },
  b: { name: string; expr: string },
  rng?: Rng,
): ContestResult
```
- `getRef = (e,a)=>sheetGet(db,e,a)?.value`(与 `applyMutations` 同构)。求值失败 → `evalExpr` 抛的 `DiceloreError`(EXPR_EVAL/ENTITY_NOT_FOUND/NOT_NUMERIC)透传。

### 2.3 `src/store/choice.ts`(pending_choice 单行槽)

```ts
export interface ChoiceOption { label: string; consequence: string; }
// 轮内反复调用末次覆盖(id=1 单行 upsert),status='staged'。不落 event。
export function stagePendingChoice(db: DB, prompt: string, options: ChoiceOption[]): void
export function getPendingChoice(db: DB): { prompt: string; options: ChoiceOption[]; status: string } | undefined
// 回合末 Stop hook 用(本组件不调,留接口):落 kind=choice、visible=1 event,status→materialized。
export function materializePendingChoice(db: DB): number | undefined
```
- MCP `resolve_choice` handler 只调 `stagePendingChoice`,出参 `{ staged:true, options }`(不含 event_id,spec §1.1)。
- `materializePendingChoice` 本组件不接线(归 adapter/Stop hook),但一并实现 + 单测,因它是槽语义闭环、纯内层、可单测。

---

## 3. 错误码:内层补 typed error

### 3.1 `src/errors.ts`(叶子模块)

```ts
export type DiceloreErrorCode =
  | "EXPR_EVAL"       // expr 解析/求值失败
  | "NOT_NUMERIC"     // 该掷/算术却给非数值
  | "RANGE_INVALID"   // 档位重叠 / 不全覆盖 / min>max / 落空
  | "ENTITY_NOT_FOUND"// 引用/目标实体不存在
  | "DIE_INVALID"     // 单骰串非法(resolve_outcome)
  | "NOT_FOUND"       // 通用目标缺失(pool/doc 等)
  | "INTERNAL";       // 未分类(兜底,不泄漏原始栈)
export class DiceloreError extends Error {
  code: DiceloreErrorCode;
  hint?: string;
  constructor(code: DiceloreErrorCode, message: string, hint?: string);
}
```

### 3.2 既有内层改抛点(message 原文保留 → 既有 `toThrow(/中文/)` 测试不破)

| 文件:函数 | 原 throw | 改 code |
|---|---|---|
| dice:`rollDice` | count/sides 非法 | `DIE_INVALID` |
| dice:`rangeMap` | 重叠/min>max/落空 | `RANGE_INVALID` |
| expr/evaluate:`evalExpr` | 引用不存在 | `ENTITY_NOT_FOUND` |
| expr/evaluate:`evalExpr` | 引用非数值 | `NOT_NUMERIC` |
| expr/parse:`parseExpr` | 文法非法 | `EXPR_EVAL` |
| store/mutate:`toNum` | 非数值算术 | `NOT_NUMERIC` |
| store/visibility:`revealOnce` | 目标缺失 | `ENTITY_NOT_FOUND` |

- `DiceloreError extends Error` 且保留 message,既有断言 message 的测试继续绿;新增断言 `e.code` 的测试。
- **不一次性铺满**:只改 spec §0 code 枚举涉及的已知触发点;其余内层错误经 `classify` 归 `INTERNAL`。

### 3.3 MCP 侧 `classify(e)`(envelope.ts)

```ts
// e instanceof DiceloreError → { code: e.code, message: e.message, hint: e.hint }
// 否则 → { code: "INTERNAL", message: "工具内部错误", hint: ... }(不回传原始 e.message,避免泄漏)
```

---

## 4. MCP 层(handler / wiring 分离)

### 4.1 SDK 与依赖(技术选型已锁 v1.x)

- 装 **`@modelcontextprotocol/sdk`**(v1.x,生产推荐;`main` 的 v2 拆包 pre-alpha 不用)+ **Zod v3**。
- `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"`、`import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"`。
- `registerTool(name, { title, description, inputSchema: ZodRawShape, outputSchema: ZodRawShape, annotations }, handler)`;handler 回 `{ content, structuredContent, isError? }`。
- npm install 网络失败走 WSL 代理:`export https_proxy=http://172.17.128.1:7897 http_proxy=同`。

### 4.2 `ToolDef`(tools.ts)

```ts
interface ToolDef<I, O> {
  name: string;                 // 无前缀;注册时加 dicelore_
  title: string;
  description: string;          // spec §0 五段:①功能 ②Args ③Returns ④use/don't ⑤错误
  inputSchema: z.ZodObject<...>;// .strict()
  outputSchema: z.ZodObject<...>;
  annotations: { readOnlyHint; destructiveHint; idempotentHint };  // openWorldHint 全 false
  reminders?: (out: O) => string[];  // 见 §5;无则不挂
  handler: (db: DB, input: I) => O;  // 纯,失败 throw DiceloreError
}
```
- `tools.ts` 导出 `TOOLS: ToolDef[]`,逐工具组合 schema(schemas.ts)+ handler(handlers/*.ts)+ annotations(spec §7.1)+ reminders(reminders.ts)。
- **outputSchema 必须囊括信封字段**:凡出参带 `event_id` / `reminders` / `truncated` / `has_more` / `next_offset` 的工具,其 `outputSchema` 必须显式声明这些字段(`reminders: z.array(z.string()).optional()` 等)。否则成功路径 `structuredContent` 也会被 SDK 拿 outputSchema 校验而 `-32602`(同 §4.3 错误路径的同一校验机制,只是成功路径无法靠"不带 structuredContent"规避)。

### 4.3 `runTool`(dispatch,可脱 SDK 单测)

```ts
function runTool(db, tool, rawInput): CallToolResult {
  try {
    const input = tool.inputSchema.parse(rawInput);   // ZodError → 视为 EXPR_EVAL/INTERNAL? → 走错误信封
    const out = tool.handler(db, input);
    const reminders = tool.reminders?.(out) ?? undefined;
    const sc = reminders?.length ? { ...out, reminders } : out;  // reminders 进 structuredContent(流③、只回 AI)
    return { content: [{ type:"text", text: JSON.stringify(out) }], structuredContent: sc };
  } catch (e) {
    const err = classify(e);
    return { isError: true, content: [{ type:"text", text: JSON.stringify({ error: err }) }] };  // ★不放 structuredContent
  }
}
```
- **成功路径**:`structuredContent` 回流③(AI 读结构化);`content[].text` 放同一份 JSON 供兼容(spec §0:out 不塞散文,这里 text 是结构化镜像非散文菜单)。
- **错误路径(SDK v1.x 硬约束)**:**绝不带 `structuredContent`**——SDK 即便 `isError:true` 也校验 `structuredContent` against `outputSchema`,带上即 `-32602`(实测确认)。结构化 `{error}` 只进 `content[].text`。
- 校验失败(`runTool` 内 `inputSchema.parse` 抛 ZodError)走同一错误信封,归 `code:"INTERNAL"`、message 列出非法/缺失字段。注:生产路径 SDK 在调 handler 前已按 `inputSchema` 校验入参,`runTool` 内 parse 是防御 + 脱 SDK 单测用,故 ZodError 主要出现在测试路径。

### 4.4 `main.ts`(stdio wiring)

```ts
const { db } = openSession();                 // env: DICELORE_SESSION / DICELORE_SESSIONS_DIR
const server = new McpServer({ name:"dicelore", version });
for (const t of TOOLS)
  server.registerTool(`dicelore_${t.name}`,
    { title:t.title, description:t.description,
      inputSchema:t.inputSchema.shape, outputSchema:t.outputSchema.shape, annotations:t.annotations },
    (args) => runTool(db, t, args));
await server.connect(new StdioServerTransport());
```
- npm script:`"dicelore:mcp": "tsx src/mcp/main.ts"`。

### 4.5 handler 薄包装映射(spec §7)

| 工具 | handler 调用 | 落 event |
|---|---|---|
| `resolve_choice` | `stagePendingChoice` | 否(回合末物化) |
| `resolve_outcome` | `resolveOutcome` + `eventAppend(kind:"verdict")` | verdict |
| `resolve_contest` | `resolveContest` + `eventAppend(kind:"verdict")` | verdict |
| `sheet_get`/`sheet_list` | `sheetGet`/`sheetList` | — |
| `sheet_update` | `applyMutations` | mutation(+watcher_fired) |
| `event_append`/`event_recall` | `eventAppend`/`eventRecall` | note/… |
| `watcher_set` | `watcherSet` | — |
| `world_search`/`sample`/`register` | `worldDocSearch`/`worldSample`/`worldRegister` | — |
| `rule_search` | `ruleSearch` | — |
| `sheet_show`/`world_show` | `sheetShow`/`worldShow` | note(审计,内层已落) |
| `reveal_once` | `revealOnce` | reveal |
| `narrate` | `eventAppend(kind:"narrate")` | narrate |
| `game_end` | `metaSet("ended",…)` + `eventAppend(kind:"note")` | note |

- 落 event 在 handler(非内层编排函数),因 event 是行动层副作用。`sheet_update` 的 mutation event 由 `applyMutations` 自落、handler 直接透传其 `event_id`。

---

## 5. reminders(reminders.ts,内置极小 terse 表)

spec §5:走流③、只回 AI、L1 底线。v1 只载**结构可证**的触发,不臆测语义:

| 工具 | 触发(结构) | terse 提醒 |
|---|---|---|
| `resolve_choice` | 恒(暂存即后果已锁) | "后续叙述须与已锁后果一致" |
| `resolve_outcome` | 命中**最低档**(bands 中 min 最小者) | "尊重结果,别软着陆" |
| `sheet_update` | `fired_watchers` 非空 | "watcher 已触发,本轮即时反应" |
| `resolve_contest` | — | 字段保留、默认 `[]`(不知哪边是玩家,不臆测) |
| `narrate` | 不挂(spec §5) | — |

- 富措辞归 Skills 包(L2),本表只 terse 底线;reminders 字段挂在出参(进 structuredContent)。

---

## 6. CHARACTER_LIMIT(truncate.ts,纯函数)

```ts
export function truncateText(s: string, limit = 25000): { text: string; truncated: boolean }
```
- 可变大出参工具(`sheet_list`/`world_search`/`event_recall`/`rule_search`)在 handler 拼装结果后套用,出参带 `truncated: boolean`。
- `sheet_list` 另有 `has_more` / `next_offset`(分页本就有,limit/offset 入参)。
- enforcement 归内层(本 helper),MCP 只在 handler 调。

---

## 7. game_end 终态

handler:`metaSet(db,"ended", JSON.stringify({reason,outcome,seq}))` + `eventAppend(db,{kind:"note", visible:0, data_json:{reason,outcome}})`。
- out:`{ ended:true, event_id }`。annotations:`destructiveHint:true`(spec §7.1 唯一 destructive)。
- `you_death` = 语义特例,走同工具 + reason(v1 不单列别名)。

---

## 8. 测试策略(TDD)

- **内层缺口**:`resolve/outcome`、`resolve/contest`、`store/choice`、`errors`、`store/truncate` — 喂内存 db(`openDb(":memory:")` + `initSchema`)+ 定种 RNG,纯单测。
- **既有内层改抛**:新增断言 `e.code` 的测试;既有 message 断言保持绿(回归)。
- **MCP handler**:注内存 db 直接单测(不起 stdio),验薄包装映射 + 落 event。
- **`runTool`**:用假 ToolDef/handler 单测信封 —— 成功带 structuredContent、**错误不带 structuredContent**(锁此不变量)、reminders 拼装、classify 映射。
- **schemas**:`.strict()` 拒多余字段、必填字段缺失报错。
- **`main.ts`**:不强求集成测(薄、副作用重);全部 task 后 `npx tsc --noEmit` 兜底。
- 每 task 一 commit,message 结尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`;每 task 跑 `npx vitest run`。

---

## 9. 与并行「回合快照线」协调

- **直接在 main 上执行**(worktree 隔离对 subagent 链不生效)。
- **不碰 docs/wiki 和 README.md**(本设计的两条 wiki 沉淀已在 brainstorming 阶段独立 commit 完成,实现期不再碰)。
- **db.ts 是唯一物理交叠点**:本组件**基本不需动 db.ts**(内层表已齐,`pending_choice` 表 Plan1 已建)。若确需动,改动集中 + 注释。
- 每 task review package 用「task-commit 父..task-commit」精确圈定;每次 `git add` 自己的文件,**绝不 `git add -A`**。
- FTS 测试避坑:检索测试用零重叠独有词,不依赖全局 env。

---

## 10. 模块边界自检(isolation & clarity)

| 模块 | 做什么 | 怎么用 | 依赖 |
|---|---|---|---|
| `errors` | 定 typed error + code | `throw new DiceloreError(code,msg,hint)` | 无 |
| `resolve/*` | ③层裁决编排 | `resolveOutcome/Contest(...)` | dice/expr/store |
| `store/choice` | pending_choice 槽读写 | `stage/get/materialize` | db/event |
| `store/truncate` | 出参截断 | `truncateText(s,limit)` | 无 |
| `mcp/schemas` | Zod in/out | `import { sheetGetIn,... }` | zod |
| `mcp/reminders` | terse 提醒表 | `remindersFor(name,out)` | 无 |
| `mcp/envelope` | 信封+classify+截断 | `successEnvelope/errorEnvelope/classify` | errors/truncate |
| `mcp/runTool` | dispatch | `runTool(db,tool,input)` | envelope/reminders |
| `mcp/tools` | 注册表 | `TOOLS` | schemas/handlers/reminders |
| `mcp/handlers/*` | 薄包装 | `(db,input)=>out` | resolve/store/errors |
| `mcp/main` | stdio 接线 | bin | session/tools/sdk |
