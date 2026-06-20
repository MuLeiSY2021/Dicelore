# 组件2「MCP 工具面」实现计划 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把内层(组件1)包成一组 `dicelore_*` MCP 工具(stdio server),Zod in/out schema,薄包装内层原子。

**Architecture:** 先补两处内层缺口(`resolve/` ③层裁决编排 + `store/choice` pending_choice 槽),再补 typed error(`errors.ts` + 既有内层改抛),最后搭 MCP 外层(`mcp/`):handler 是 `(db,input)=>out` 纯函数(注内存 db 可单测),`runTool` 围绕 handler 加信封/reminders/错误捕获,`main.ts` 只做 openSession + 注册 + 连 stdio transport。依赖单向向下,内层不 import `mcp/`。

**Tech Stack:** TypeScript (ESM, `.js` 导入后缀)、`@modelcontextprotocol/sdk` v1.x、Zod v3、better-sqlite3 v12、vitest、tsx。

## Global Constraints

- 包名 `dicelore`;工具注册 ID 一律加 `dicelore_` 前缀;env 用 `DICELORE_SESSION` / `DICELORE_SESSIONS_DIR`。
- ESM:所有相对导入带 `.js` 后缀(如 `import { DB } from "../store/db.js"`)。
- 装 `@modelcontextprotocol/sdk@^1`(v1.x,**不用** v2 pre-alpha)+ `zod@^3`。
- **错误路径绝不带 `structuredContent`**(SDK v1.x 硬约束:即便 `isError:true` 也会拿 `structuredContent` 校验 `outputSchema` → `-32602`);结构化 `{error}` 只进 `content[].text`。
- 凡出参带 `event_id`/`reminders`/`truncated`/`has_more`/`next_offset` 的工具,其 `outputSchema` 必须显式声明这些字段(否则成功路径 `structuredContent` 也被 SDK 校验失败)。
- 入参 schema 一律 `.strict()`(`runTool` 内 `parse` 用全 strict 对象做防御 + 脱 SDK 单测;生产路径 SDK 已先按 `.shape` 校验)。
- `annotations.openWorldHint` 全部 `false`(封闭世界)。
- **既有内层改抛 `DiceloreError` 时 message 原文保留** → 既有 `toThrow(/中文/)` 测试不破。
- 每 task 一 commit,message 结尾加 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`;每 task 跑 `npx vitest run`;全部 task 后 `npx tsc --noEmit` 兜底。
- **直接在 main 上执行**;**不碰 `docs/wiki/` 与 README.md**;`db.ts` 基本不需动(表已齐);每次 `git add` 只加本 task 自己的文件,**绝不 `git add -A`**。
- FTS 检索测试用零重叠独有词,不依赖全局 env。

## 文件结构

```
src/
  errors.ts              ★新:DiceloreError + code 枚举(叶子,无依赖)
  resolve/
    outcome.ts           ★新:resolveOutcome(die, bands, rng?) → {roll, die, band}
    contest.ts           ★新:resolveContest(db, a, b, rng?) → {a, b, winner}
  store/
    choice.ts            ★新:pending_choice 单行槽 stage/get/materialize
    truncate.ts          ★新:truncateText(s, limit) 纯函数
    (dice/expr/store 既有文件:在已知触发点改抛 DiceloreError)
  mcp/                   ★新:外层工具面
    tooldef.ts           ToolDef 接口(叶子,无依赖)
    envelope.ts          classify(e) + successEnvelope / errorEnvelope
    reminders.ts         remindersFor(name, out, input) terse 表
    runTool.ts           dispatch:parse→handler→reminders→信封 / catch→错误信封
    schemas.ts           每工具 Zod in(.strict()) / out schema(逐 task 增长)
    handlers/
      resolver.ts        choice/outcome/contest handler + resolverTools: ToolDef[]
      sheet.ts           get/list/update handler + sheetTools
      event.ts           append/recall/watcher_set handler + eventTools
      world.ts           world_search/sample/register/rule_search + worldTools
      io.ts              sheet_show/world_show/reveal_once/narrate/game_end + ioTools
    tools.ts             export const TOOLS = [...resolverTools, ...]
    main.ts              bin:openSession→McpServer→registerTool→stdio
```

**依赖方向**:`mcp/handlers` → `resolve/`、`store/`、`errors`;`mcp/runTool` → `tooldef`、`envelope`、`reminders`;`mcp/tools` → `handlers/*`;`mcp/main` → `session` + `tools` + SDK。内层不 import `mcp/`。

---

## 阶段一:内层缺口 + typed error(脱 MCP,纯单测)

### Task 1: `src/errors.ts`(DiceloreError + code 枚举)

**Files:**
- Create: `src/errors.ts`
- Test: `src/errors.test.ts`

**Interfaces:**
- Consumes: 无(叶子模块)。
- Produces:
  - `type DiceloreErrorCode = "EXPR_EVAL" | "NOT_NUMERIC" | "RANGE_INVALID" | "ENTITY_NOT_FOUND" | "DIE_INVALID" | "NOT_FOUND" | "INTERNAL"`
  - `class DiceloreError extends Error { code: DiceloreErrorCode; hint?: string; constructor(code, message, hint?) }`

- [ ] **Step 1: 写失败测试**

```ts
// src/errors.test.ts
import { describe, it, expect } from "vitest";
import { DiceloreError } from "./errors.js";

describe("DiceloreError", () => {
  it("携带 code / message / hint,且是 Error 子类", () => {
    const e = new DiceloreError("DIE_INVALID", "骰子非法", "用 NdS");
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(DiceloreError);
    expect(e.code).toBe("DIE_INVALID");
    expect(e.message).toBe("骰子非法");
    expect(e.hint).toBe("用 NdS");
    expect(e.name).toBe("DiceloreError");
  });

  it("hint 可省略", () => {
    const e = new DiceloreError("INTERNAL", "boom");
    expect(e.hint).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/errors.test.ts`
Expected: FAIL（`Cannot find module './errors.js'`）

- [ ] **Step 3: 写最小实现**

```ts
// src/errors.ts
export type DiceloreErrorCode =
  | "EXPR_EVAL"        // expr 解析/求值失败
  | "NOT_NUMERIC"      // 该掷/算术却给非数值
  | "RANGE_INVALID"    // 档位重叠 / 不全覆盖 / min>max / 落空
  | "ENTITY_NOT_FOUND" // 引用/目标实体不存在
  | "DIE_INVALID"      // 单骰串非法(resolve_outcome)
  | "NOT_FOUND"        // 通用目标缺失(pool/doc 等)
  | "INTERNAL";        // 未分类(兜底,不泄漏原始栈)

export class DiceloreError extends Error {
  code: DiceloreErrorCode;
  hint?: string;
  constructor(code: DiceloreErrorCode, message: string, hint?: string) {
    super(message);
    this.name = "DiceloreError";
    this.code = code;
    this.hint = hint;
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/errors.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/errors.ts src/errors.test.ts
git commit -m "feat(errors): DiceloreError + code 枚举

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 既有内层改抛 DiceloreError

**Files:**
- Modify: `src/dice/index.ts`(`rollDice` / `rangeMap` throw)
- Modify: `src/expr/evaluate.ts`(`evalExpr` 两处 throw)
- Modify: `src/expr/parse.ts`(`parseExpr` / `parseTerm` 两处 throw)
- Modify: `src/store/mutate.ts`(`toNum` throw)
- Modify: `src/store/visibility.ts`(`revealOnce` 两处 throw)
- Test: 各文件既有 `*.test.ts`(新增 `e.code` 断言;既有 message 断言保持绿)

**Interfaces:**
- Consumes: `DiceloreError` from `../errors.js` / `../../errors.js`(按文件层级)。
- Produces: 无新签名;仅把上述 throw 的类型从 `Error` 换成 `DiceloreError`,**message 原文不变**。

改抛对照表:

| 文件:函数 | 原 throw message(保留) | 改 code |
|---|---|---|
| `dice/index.ts`:`rollDice` | `rollDice: count 必须 ≥1…` / `rollDice: sides 必须 ≥2…` | `DIE_INVALID` |
| `dice/index.ts`:`rangeMap` | `rangeMap: bands 为空` / `…min>max` / `…区间重叠…` / `…落空…` | `RANGE_INVALID` |
| `expr/evaluate.ts`:`evalExpr` | `evalExpr: 引用不存在 …` | `ENTITY_NOT_FOUND` |
| `expr/evaluate.ts`:`evalExpr` | `evalExpr: 引用非数值 …` | `NOT_NUMERIC` |
| `expr/parse.ts`:`parseExpr` | `parseExpr: 引用缺 '}' …` | `EXPR_EVAL` |
| `expr/parse.ts`:`parseTerm` | `parseExpr: 非法项 …` | `EXPR_EVAL` |
| `store/mutate.ts`:`toNum` | `applyMutations: …非数值,不能做算术` | `NOT_NUMERIC` |
| `store/visibility.ts`:`revealOnce` | `revealOnce: sheet cell 不存在 …` | `ENTITY_NOT_FOUND` |
| `store/visibility.ts`:`revealOnce` | `revealOnce: world_doc#… 不存在` | `ENTITY_NOT_FOUND` |

- [ ] **Step 1: 在 `src/dice/dice.test.ts` 增 `e.code` 断言(失败测试)**

```ts
// src/dice/dice.test.ts —— 追加(保留既有 message 断言)
import { DiceloreError } from "../errors.js";

it("rollDice 非法参数抛 DIE_INVALID", () => {
  try { rollDice(0, 6); } catch (e) {
    expect(e).toBeInstanceOf(DiceloreError);
    expect((e as DiceloreError).code).toBe("DIE_INVALID");
  }
});
it("rangeMap 落空抛 RANGE_INVALID", () => {
  try { rangeMap(999, [{ label: "a", min: 1, max: 10 }]); } catch (e) {
    expect((e as DiceloreError).code).toBe("RANGE_INVALID");
  }
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/dice/dice.test.ts`
Expected: FAIL（`code` 为 undefined,因仍抛原生 Error）

- [ ] **Step 3: 改 `src/dice/index.ts` throw 为 DiceloreError**

```ts
// src/dice/index.ts —— 顶部加
import { DiceloreError } from "../errors.js";

// rollDice 内:
if (!Number.isInteger(count) || count < 1) throw new DiceloreError("DIE_INVALID", `rollDice: count 必须 ≥1，收到 ${count}`);
if (!Number.isInteger(sides) || sides < 2) throw new DiceloreError("DIE_INVALID", `rollDice: sides 必须 ≥2，收到 ${sides}`);

// rangeMap 内:
if (bands.length === 0) throw new DiceloreError("RANGE_INVALID", "rangeMap: bands 为空");
if (sorted[i].min > sorted[i].max) throw new DiceloreError("RANGE_INVALID", `rangeMap: 档位 ${sorted[i].label} min>max`);
if (i > 0 && sorted[i].min <= sorted[i - 1].max) {
  throw new DiceloreError("RANGE_INVALID", `rangeMap: 档位区间重叠 ${sorted[i - 1].label}/${sorted[i].label}`);
}
if (!hit) throw new DiceloreError("RANGE_INVALID", `rangeMap: 值 ${value} 落空(无覆盖档位)`);
```

- [ ] **Step 4: 同法改 `expr/evaluate.ts` / `expr/parse.ts` / `store/mutate.ts` / `store/visibility.ts`**

```ts
// src/expr/evaluate.ts —— import { DiceloreError } from "../errors.js";
if (rawVal === undefined) throw new DiceloreError("ENTITY_NOT_FOUND", `evalExpr: 引用不存在 {${t.entity}.${t.attr}}`);
if (!Number.isFinite(num)) throw new DiceloreError("NOT_NUMERIC", `evalExpr: 引用非数值 {${t.entity}.${t.attr}}="${rawVal}"`);

// src/expr/parse.ts —— import { DiceloreError } from "../errors.js";
if (end === -1) throw new DiceloreError("EXPR_EVAL", `parseExpr: 引用缺 '}' — ${expr}`);
// parseTerm 末尾:
throw new DiceloreError("EXPR_EVAL", `parseExpr: 非法项 "${raw}"(只支持 NdS / 整数 / {实体.属性} 与 +/-)`);

// src/store/mutate.ts —— import { DiceloreError } from "../errors.js";
function toNum(raw: string, attr: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new DiceloreError("NOT_NUMERIC", `applyMutations: ${attr}="${raw}" 非数值,不能做算术`);
  return n;
}

// src/store/visibility.ts —— import { DiceloreError } from "../errors.js";
if (!cell) throw new DiceloreError("ENTITY_NOT_FOUND", `revealOnce: sheet cell 不存在 ${target.entity}.${target.attr}`);
if (!doc) throw new DiceloreError("ENTITY_NOT_FOUND", `revealOnce: world_doc#${target.rowid} 不存在`);
```

并在 `src/expr/evaluate.test.ts`、`src/expr/parse.test.ts`、`src/store/mutate.test.ts`、`src/store/visibility.test.ts` 各追加一条 `e.code` 断言(对应上表 code)。

- [ ] **Step 5: 跑全量测试确认既有 message 断言仍绿 + 新 code 断言通过**

Run: `npx vitest run`
Expected: PASS（既有 `toThrow(/中文/)` 因 message 不变继续绿;新 `code` 断言通过）

- [ ] **Step 6: Commit**

```bash
git add src/errors.ts src/dice/index.ts src/dice/dice.test.ts \
  src/expr/evaluate.ts src/expr/evaluate.test.ts src/expr/parse.ts src/expr/parse.test.ts \
  src/store/mutate.ts src/store/mutate.test.ts src/store/visibility.ts src/store/visibility.test.ts
git commit -m "refactor(errors): 既有内层已知触发点改抛 DiceloreError(message 原文保留)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `src/resolve/outcome.ts`(resolveOutcome ③层编排)

**Files:**
- Create: `src/resolve/outcome.ts`
- Test: `src/resolve/outcome.test.ts`

**Interfaces:**
- Consumes: `rollDice`, `type Band`, `type Rng` from `../dice/index.js`;`DiceloreError` from `../errors.js`。
- Produces:
  - `interface OutcomeResult { roll: number; die: string; band: Band; }`
  - `function resolveOutcome(die: string, bands: Band[], rng?: Rng): OutcomeResult`

- [ ] **Step 1: 写失败测试**

```ts
// src/resolve/outcome.test.ts
import { describe, it, expect } from "vitest";
import { resolveOutcome } from "./outcome.js";
import { DiceloreError } from "../errors.js";

const bands = [
  { label: "失败", min: 1, max: 50, consequence: "有后果" },
  { label: "成功", min: 51, max: 100, consequence: "得手" },
];

describe("resolveOutcome", () => {
  it("掷单骰并命中档位(定种 rng=0 → roll 1 → 失败档)", () => {
    const r = resolveOutcome("1d100", bands, () => 0);
    expect(r.roll).toBe(1);
    expect(r.die).toBe("1d100");
    expect(r.band.label).toBe("失败");
  });

  it("rng 接近 1 → 高 roll → 成功档", () => {
    const r = resolveOutcome("1d100", bands, () => 0.999);
    expect(r.roll).toBe(100);
    expect(r.band.label).toBe("成功");
  });

  it("非单骰串(含运算)抛 DIE_INVALID", () => {
    try { resolveOutcome("2d6+1", bands, () => 0); } catch (e) {
      expect((e as DiceloreError).code).toBe("DIE_INVALID");
    }
  });

  it("乱串抛 DIE_INVALID", () => {
    expect(() => resolveOutcome("abc", bands, () => 0)).toThrow(DiceloreError);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/resolve/outcome.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写最小实现**

```ts
// src/resolve/outcome.ts
import { rollDice, rangeMap, type Band, type Rng } from "../dice/index.js";
import { DiceloreError } from "../errors.js";

export interface OutcomeResult {
  roll: number;
  die: string;
  band: Band;
}

// 单骰串就地正则解析(不卷入 expr 文法);非此形状 → DIE_INVALID。
export function resolveOutcome(die: string, bands: Band[], rng?: Rng): OutcomeResult {
  const m = die.match(/^\s*(\d+)[dD](\d+)\s*$/);
  if (!m) throw new DiceloreError("DIE_INVALID", `resolveOutcome: 单骰串非法 "${die}"(只支持 NdS)`);
  const rolls = rollDice(Number(m[1]), Number(m[2]), rng); // count/sides 非法亦抛 DIE_INVALID
  const roll = rolls.reduce((a, b) => a + b, 0);
  const band = rangeMap(roll, bands); // 重叠/落空抛 RANGE_INVALID
  return { roll, die, band };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/resolve/outcome.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/resolve/outcome.ts src/resolve/outcome.test.ts
git commit -m "feat(resolve): resolveOutcome ③层编排(单骰串→rangeMap)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `src/resolve/contest.ts`(resolveContest ③层编排)

**Files:**
- Create: `src/resolve/contest.ts`
- Test: `src/resolve/contest.test.ts`

**Interfaces:**
- Consumes: `evalExpr`, `type ExprLedger`, `type RefGetter` from `../expr/evaluate.js`;`sheetGet` from `../store/sheet.js`;`type DB` from `../store/db.js`;`type Rng` from `../dice/index.js`。
- Produces:
  - `interface ContestSide { name: string; ledger: ExprLedger; }`
  - `interface ContestResult { a: ContestSide; b: ContestSide; winner: "a" | "b" | "tie"; }`
  - `function resolveContest(db: DB, a: { name: string; expr: string }, b: { name: string; expr: string }, rng?: Rng): ContestResult`

- [ ] **Step 1: 写失败测试**

```ts
// src/resolve/contest.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../store/db.js";
import { sheetSetRaw } from "../store/sheet.js";
import { resolveContest } from "./contest.js";
import { DiceloreError } from "../errors.js";

function freshDb() {
  const db = openDb(":memory:");
  initSchema(db);
  return db;
}

describe("resolveContest", () => {
  it("取 sheet 真值比大小 → winner a", () => {
    const db = freshDb();
    sheetSetRaw(db, "张三", "力量", "15");
    const r = resolveContest(db, { name: "张三", expr: "{张三.力量}" }, { name: "DC", expr: "10" });
    expect(r.a.ledger.total).toBe(15);
    expect(r.b.ledger.total).toBe(10);
    expect(r.winner).toBe("a");
  });

  it("相等 → tie", () => {
    const db = freshDb();
    const r = resolveContest(db, { name: "A", expr: "10" }, { name: "B", expr: "10" });
    expect(r.winner).toBe("tie");
  });

  it("引用不存在 → 透传 ENTITY_NOT_FOUND", () => {
    const db = freshDb();
    try { resolveContest(db, { name: "A", expr: "{无.无}" }, { name: "B", expr: "1" }); } catch (e) {
      expect((e as DiceloreError).code).toBe("ENTITY_NOT_FOUND");
    }
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/resolve/contest.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写最小实现**

```ts
// src/resolve/contest.ts
import { evalExpr, type ExprLedger, type RefGetter } from "../expr/evaluate.js";
import { sheetGet } from "../store/sheet.js";
import type { DB } from "../store/db.js";
import type { Rng } from "../dice/index.js";

export interface ContestSide {
  name: string;
  ledger: ExprLedger;
}
export interface ContestResult {
  a: ContestSide;
  b: ContestSide;
  winner: "a" | "b" | "tie";
}

export function resolveContest(
  db: DB,
  a: { name: string; expr: string },
  b: { name: string; expr: string },
  rng?: Rng,
): ContestResult {
  const getRef: RefGetter = (e, attr) => sheetGet(db, e, attr)?.value; // 与 applyMutations 同构
  const ctx = { rng, getRef };
  const la = evalExpr(a.expr, ctx); // 求值失败透传 DiceloreError
  const lb = evalExpr(b.expr, ctx);
  const winner = la.total > lb.total ? "a" : lb.total > la.total ? "b" : "tie";
  return { a: { name: a.name, ledger: la }, b: { name: b.name, ledger: lb }, winner };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/resolve/contest.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/resolve/contest.ts src/resolve/contest.test.ts
git commit -m "feat(resolve): resolveContest ③层编排(双 expr 求值比大小)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `src/store/choice.ts`(pending_choice 单行槽)

**Files:**
- Create: `src/store/choice.ts`
- Test: `src/store/choice.test.ts`

**Interfaces:**
- Consumes: `type DB` from `./db.js`;`eventAppend` from `./event.js`。
- Produces:
  - `interface ChoiceOption { label: string; consequence: string; }`
  - `function stagePendingChoice(db: DB, prompt: string, options: ChoiceOption[]): void`
  - `function getPendingChoice(db: DB): { prompt: string; options: ChoiceOption[]; status: string } | undefined`
  - `function materializePendingChoice(db: DB): number | undefined`

- [ ] **Step 1: 写失败测试**

```ts
// src/store/choice.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "./db.js";
import { eventSince } from "./event.js";
import { stagePendingChoice, getPendingChoice, materializePendingChoice } from "./choice.js";

function freshDb() {
  const db = openDb(":memory:");
  initSchema(db);
  return db;
}
const opts = [
  { label: "进", consequence: "遇敌" },
  { label: "退", consequence: "失机" },
];

describe("pending_choice 槽", () => {
  it("stage 后 get 回读,status=staged", () => {
    const db = freshDb();
    stagePendingChoice(db, "怎么走?", opts);
    const pc = getPendingChoice(db);
    expect(pc?.prompt).toBe("怎么走?");
    expect(pc?.options).toEqual(opts);
    expect(pc?.status).toBe("staged");
  });

  it("轮内反复 stage 末次覆盖(id=1 单行)", () => {
    const db = freshDb();
    stagePendingChoice(db, "A", opts);
    stagePendingChoice(db, "B", [{ label: "x", consequence: "y" }]);
    const pc = getPendingChoice(db);
    expect(pc?.prompt).toBe("B");
    expect(pc?.options).toHaveLength(1);
  });

  it("materialize 落 kind=choice/visible=1 event 并置 materialized", () => {
    const db = freshDb();
    stagePendingChoice(db, "怎么走?", opts);
    const seq = materializePendingChoice(db);
    expect(typeof seq).toBe("number");
    const evs = eventSince(db, 0).filter((e) => e.kind === "choice");
    expect(evs).toHaveLength(1);
    expect(evs[0].visible).toBe(1);
    expect(getPendingChoice(db)?.status).toBe("materialized");
  });

  it("空槽 get 回 undefined、materialize 回 undefined", () => {
    const db = freshDb();
    expect(getPendingChoice(db)).toBeUndefined();
    expect(materializePendingChoice(db)).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/store/choice.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写最小实现**

```ts
// src/store/choice.ts
import type { DB } from "./db.js";
import { eventAppend } from "./event.js";

export interface ChoiceOption {
  label: string;
  consequence: string;
}

// 轮内反复调用末次覆盖(id=1 单行 upsert),status='staged'。不落 event。
export function stagePendingChoice(db: DB, prompt: string, options: ChoiceOption[]): void {
  db.prepare(
    `INSERT INTO pending_choice (id, seq_staged, prompt, options_json, status)
     VALUES (1, NULL, ?, ?, 'staged')
     ON CONFLICT(id) DO UPDATE SET seq_staged=NULL, prompt=excluded.prompt,
       options_json=excluded.options_json, status='staged'`,
  ).run(prompt, JSON.stringify(options));
}

export function getPendingChoice(
  db: DB,
): { prompt: string; options: ChoiceOption[]; status: string } | undefined {
  const row = db.prepare("SELECT prompt, options_json, status FROM pending_choice WHERE id=1").get() as
    | { prompt: string; options_json: string; status: string }
    | undefined;
  if (!row) return undefined;
  return { prompt: row.prompt, options: JSON.parse(row.options_json) as ChoiceOption[], status: row.status };
}

// 回合末 Stop hook 用(本组件不接线):落 kind=choice、visible=1 event,status→materialized。
export function materializePendingChoice(db: DB): number | undefined {
  const pc = getPendingChoice(db);
  if (!pc) return undefined;
  const seq = eventAppend(db, {
    kind: "choice",
    visible: 1,
    content: pc.prompt,
    data_json: { prompt: pc.prompt, options: pc.options },
  });
  db.prepare("UPDATE pending_choice SET status='materialized', seq_staged=? WHERE id=1").run(seq);
  return seq;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/store/choice.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/choice.ts src/store/choice.test.ts
git commit -m "feat(store): pending_choice 单行槽 stage/get/materialize

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `src/store/truncate.ts`(CHARACTER_LIMIT 截断 helper)

**Files:**
- Create: `src/store/truncate.ts`
- Test: `src/store/truncate.test.ts`

**Interfaces:**
- Consumes: 无(纯函数)。
- Produces: `function truncateText(s: string, limit?: number): { text: string; truncated: boolean }`(默认 `limit = 25000`)。

- [ ] **Step 1: 写失败测试**

```ts
// src/store/truncate.test.ts
import { describe, it, expect } from "vitest";
import { truncateText } from "./truncate.js";

describe("truncateText", () => {
  it("短串不截断", () => {
    expect(truncateText("abc", 10)).toEqual({ text: "abc", truncated: false });
  });
  it("超限截断到 limit 长度并标 truncated", () => {
    const r = truncateText("x".repeat(50), 10);
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBe(10);
  });
  it("默认 limit=25000", () => {
    expect(truncateText("x".repeat(25001)).truncated).toBe(true);
    expect(truncateText("x".repeat(25000)).truncated).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/store/truncate.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写最小实现**

```ts
// src/store/truncate.ts
export function truncateText(s: string, limit = 25000): { text: string; truncated: boolean } {
  if (s.length <= limit) return { text: s, truncated: false };
  return { text: s.slice(0, limit), truncated: true };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/store/truncate.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/truncate.ts src/store/truncate.test.ts
git commit -m "feat(store): truncateText CHARACTER_LIMIT 截断 helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 阶段二:MCP 基建(信封 / reminders / dispatch,脱 SDK 单测)

### Task 7: 装 SDK + zod,`src/mcp/tooldef.ts` + `src/mcp/envelope.ts`

**Files:**
- Modify: `package.json`(deps 加 `@modelcontextprotocol/sdk` + `zod`)
- Create: `src/mcp/tooldef.ts`(ToolDef 接口)
- Create: `src/mcp/envelope.ts`(classify + successEnvelope + errorEnvelope)
- Test: `src/mcp/envelope.test.ts`

**Interfaces:**
- Consumes: `DiceloreError`, `type DiceloreErrorCode` from `../errors.js`;`z`, `type ZodObject` from `zod`;`type DB` from `../store/db.js`。
- Produces:
  - `tooldef.ts`:
    ```ts
    interface ToolAnnotations { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean; }
    interface ToolDef {
      name: string;                       // 无前缀;注册时加 dicelore_
      title: string;
      description: string;
      inputSchema: z.ZodObject<z.ZodRawShape>;
      outputSchema: z.ZodObject<z.ZodRawShape>;
      annotations: ToolAnnotations;
      handler: (db: DB, input: any) => any; // 纯,失败 throw DiceloreError
    }
    ```
  - `envelope.ts`:
    - `interface ErrShape { code: DiceloreErrorCode; message: string; hint?: string; }`
    - `function classify(e: unknown): ErrShape`
    - `function successEnvelope(out: unknown, structuredContent: unknown): CallToolResult`
    - `function errorEnvelope(e: unknown): CallToolResult`
    - 其中 `type CallToolResult = { content: { type: "text"; text: string }[]; structuredContent?: unknown; isError?: boolean }`(本地最小类型,避免强耦合 SDK 类型导出)。

- [ ] **Step 1: 装依赖**

Run: `npm install @modelcontextprotocol/sdk@^1 zod@^3`
Expected: `package.json` 的 `dependencies` 新增两项,无报错。

- [ ] **Step 2: 写失败测试**

```ts
// src/mcp/envelope.test.ts
import { describe, it, expect } from "vitest";
import { classify, successEnvelope, errorEnvelope } from "./envelope.js";
import { DiceloreError } from "../errors.js";

describe("classify", () => {
  it("DiceloreError → 透传 code/message/hint", () => {
    expect(classify(new DiceloreError("DIE_INVALID", "骰非法", "用 NdS"))).toEqual({
      code: "DIE_INVALID", message: "骰非法", hint: "用 NdS",
    });
  });
  it("非 DiceloreError → INTERNAL,不泄漏原始 message", () => {
    const r = classify(new Error("内部栈细节"));
    expect(r.code).toBe("INTERNAL");
    expect(r.message).not.toContain("内部栈细节");
  });
});

describe("信封", () => {
  it("successEnvelope:content text + structuredContent 都在", () => {
    const env = successEnvelope({ a: 1 }, { a: 1, reminders: ["x"] });
    expect(env.isError).toBeUndefined();
    expect(env.structuredContent).toEqual({ a: 1, reminders: ["x"] });
    expect(JSON.parse(env.content[0].text)).toEqual({ a: 1 });
  });
  it("errorEnvelope:isError 且绝不带 structuredContent", () => {
    const env = errorEnvelope(new DiceloreError("RANGE_INVALID", "档位错"));
    expect(env.isError).toBe(true);
    expect("structuredContent" in env).toBe(false);
    expect(JSON.parse(env.content[0].text)).toEqual({ error: { code: "RANGE_INVALID", message: "档位错" } });
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run src/mcp/envelope.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 4: 写 `tooldef.ts` + `envelope.ts`**

```ts
// src/mcp/tooldef.ts
import type { z } from "zod";
import type { DB } from "../store/db.js";

export interface ToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  outputSchema: z.ZodObject<z.ZodRawShape>;
  annotations: ToolAnnotations;
  handler: (db: DB, input: any) => any;
}
```

```ts
// src/mcp/envelope.ts
import { DiceloreError, type DiceloreErrorCode } from "../errors.js";

export interface ErrShape {
  code: DiceloreErrorCode;
  message: string;
  hint?: string;
}
export interface CallToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: unknown;
  isError?: boolean;
}

export function classify(e: unknown): ErrShape {
  if (e instanceof DiceloreError) {
    const out: ErrShape = { code: e.code, message: e.message };
    if (e.hint !== undefined) out.hint = e.hint;
    return out;
  }
  // 不回传原始 e.message,避免泄漏内部栈/路径。
  return { code: "INTERNAL", message: "工具内部错误", hint: "请检查入参或重试" };
}

export function successEnvelope(out: unknown, structuredContent: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(out) }],
    structuredContent,
  };
}

// ★错误路径:绝不带 structuredContent(SDK v1.x 即便 isError 也校验它 against outputSchema)。
export function errorEnvelope(e: unknown): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error: classify(e) }) }],
  };
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/mcp/envelope.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/mcp/tooldef.ts src/mcp/envelope.ts src/mcp/envelope.test.ts
git commit -m "feat(mcp): 装 SDK v1.x + zod;ToolDef 接口 + 信封(classify/success/error)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: `src/mcp/reminders.ts`(内置 terse 提醒表)

**Files:**
- Create: `src/mcp/reminders.ts`
- Test: `src/mcp/reminders.test.ts`

**Interfaces:**
- Consumes: 无(纯函数,按 tool name 字符串 dispatch)。
- Produces: `function remindersFor(name: string, out: any, input: any): string[]`
  - 触发表(spec §5,只载结构可证触发):

    | name | 触发(结构) | terse 提醒 |
    |---|---|---|
    | `resolve_choice` | 恒(暂存即后果已锁) | `"后续叙述须与已锁后果一致"` |
    | `resolve_outcome` | 命中最低档(`out.band.min === min(input.bands.map(b=>b.min))`) | `"尊重结果,别软着陆"` |
    | `sheet_update` | `out.fired_watchers?.length > 0` | `"watcher 已触发,本轮即时反应"` |
    | 其余(含 `resolve_contest`/`narrate`) | — | `[]` |

- [ ] **Step 1: 写失败测试**

```ts
// src/mcp/reminders.test.ts
import { describe, it, expect } from "vitest";
import { remindersFor } from "./reminders.js";

describe("remindersFor", () => {
  it("resolve_choice 恒提醒后果已锁", () => {
    expect(remindersFor("resolve_choice", { staged: true }, {})).toEqual(["后续叙述须与已锁后果一致"]);
  });
  it("resolve_outcome 命中最低档才提醒", () => {
    const input = { bands: [{ min: 1 }, { min: 51 }] };
    expect(remindersFor("resolve_outcome", { band: { min: 1 } }, input)).toEqual(["尊重结果,别软着陆"]);
    expect(remindersFor("resolve_outcome", { band: { min: 51 } }, input)).toEqual([]);
  });
  it("sheet_update 仅 fired_watchers 非空才提醒", () => {
    expect(remindersFor("sheet_update", { fired_watchers: [{ id: 1 }] }, {})).toEqual(["watcher 已触发,本轮即时反应"]);
    expect(remindersFor("sheet_update", { fired_watchers: [] }, {})).toEqual([]);
  });
  it("resolve_contest / narrate / 未知工具 → []", () => {
    expect(remindersFor("resolve_contest", {}, {})).toEqual([]);
    expect(remindersFor("narrate", {}, {})).toEqual([]);
    expect(remindersFor("sheet_get", {}, {})).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/mcp/reminders.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写最小实现**

```ts
// src/mcp/reminders.ts
// 内置极小「结构触发 → terse 提醒」表(spec §5);走流③、只回 AI、L1 底线。
// 富措辞归 Skills 包(L2),本表只 terse 底线。
export function remindersFor(name: string, out: any, input: any): string[] {
  switch (name) {
    case "resolve_choice":
      return ["后续叙述须与已锁后果一致"];
    case "resolve_outcome": {
      const mins: number[] = (input?.bands ?? []).map((b: any) => b.min);
      if (mins.length && out?.band && out.band.min === Math.min(...mins)) {
        return ["尊重结果,别软着陆"];
      }
      return [];
    }
    case "sheet_update":
      return out?.fired_watchers?.length ? ["watcher 已触发,本轮即时反应"] : [];
    default:
      return []; // resolve_contest 字段保留默认 []、narrate 不挂、读工具不挂
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/mcp/reminders.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mcp/reminders.ts src/mcp/reminders.test.ts
git commit -m "feat(mcp): 内置 terse reminders 表(choice/outcome/sheet_update)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `src/mcp/runTool.ts`(dispatch,假 ToolDef 单测)

**Files:**
- Create: `src/mcp/runTool.ts`
- Test: `src/mcp/runTool.test.ts`

**Interfaces:**
- Consumes: `type ToolDef` from `./tooldef.js`;`successEnvelope`, `errorEnvelope`, `type CallToolResult` from `./envelope.js`;`remindersFor` from `./reminders.js`;`type DB` from `../store/db.js`。
- Produces: `function runTool(db: DB, tool: ToolDef, rawInput: unknown): CallToolResult`
  - 流程:`tool.inputSchema.parse(rawInput)` → `tool.handler(db, input)` → `remindersFor(tool.name, out, input)` → `reminders.length ? {...out, reminders} : out` 作 `structuredContent` → `successEnvelope`;catch → `errorEnvelope`。

- [ ] **Step 1: 写失败测试**

```ts
// src/mcp/runTool.test.ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { runTool } from "./runTool.js";
import type { ToolDef } from "./tooldef.js";
import { DiceloreError } from "../errors.js";

const anns = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const db = {} as any; // 假 handler 不碰 db

function makeTool(over: Partial<ToolDef>): ToolDef {
  return {
    name: "echo",
    title: "Echo",
    description: "d",
    inputSchema: z.object({ x: z.number() }).strict(),
    outputSchema: z.object({ x: z.number() }).strict(),
    annotations: anns,
    handler: (_db, input) => ({ x: input.x }),
    ...over,
  } as ToolDef;
}

describe("runTool", () => {
  it("成功路径:带 structuredContent", () => {
    const env = runTool(db, makeTool({}), { x: 5 });
    expect(env.isError).toBeUndefined();
    expect(env.structuredContent).toEqual({ x: 5 });
  });

  it("reminders 拼进 structuredContent(用 resolve_choice 名触发恒提醒)", () => {
    const t = makeTool({ name: "resolve_choice", handler: () => ({ staged: true }) });
    const env = runTool(db, t, { x: 1 });
    expect((env.structuredContent as any).reminders).toEqual(["后续叙述须与已锁后果一致"]);
  });

  it("handler throw DiceloreError → 错误信封,无 structuredContent", () => {
    const t = makeTool({ handler: () => { throw new DiceloreError("NOT_FOUND", "没了"); } });
    const env = runTool(db, t, { x: 1 });
    expect(env.isError).toBe(true);
    expect("structuredContent" in env).toBe(false);
    expect(JSON.parse(env.content[0].text).error.code).toBe("NOT_FOUND");
  });

  it("ZodError(入参非法)→ 错误信封 INTERNAL", () => {
    const env = runTool(db, makeTool({}), { x: "not a number" });
    expect(env.isError).toBe(true);
    expect(JSON.parse(env.content[0].text).error.code).toBe("INTERNAL");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/mcp/runTool.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写最小实现**

```ts
// src/mcp/runTool.ts
import type { DB } from "../store/db.js";
import type { ToolDef } from "./tooldef.js";
import { successEnvelope, errorEnvelope, type CallToolResult } from "./envelope.js";
import { remindersFor } from "./reminders.js";

export function runTool(db: DB, tool: ToolDef, rawInput: unknown): CallToolResult {
  try {
    const input = tool.inputSchema.parse(rawInput); // 防御 + 脱 SDK 单测;ZodError 走错误信封(INTERNAL)
    const out = tool.handler(db, input);
    const reminders = remindersFor(tool.name, out, input);
    const sc = reminders.length ? { ...out, reminders } : out; // reminders 进 structuredContent(流③、只回 AI)
    return successEnvelope(out, sc);
  } catch (e) {
    return errorEnvelope(e); // 含 ZodError → classify 归 INTERNAL
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/mcp/runTool.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mcp/runTool.ts src/mcp/runTool.test.ts
git commit -m "feat(mcp): runTool dispatch(信封+reminders+错误捕获)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 阶段三:各域工具(schemas + handlers + ToolDef[],注内存 db 单测)

> **本阶段约定**:`schemas.ts` 逐域增长;每个 `handlers/*.ts` 既导出各 handler、也组合 schema+annotations 导出本域 `ToolDef[]`(供 Task 15 在 `tools.ts` 聚合)。handler 测试注内存 db、直接调 handler 断言「薄包装映射 + 落 event」;`resolve_*`/含随机的工具断言「结构正确 + event 落地」而非确定值(随机正确性已在 `resolve/*` 单测覆盖)。

### Task 10: resolver 域(`resolve_choice` / `resolve_outcome` / `resolve_contest`)

**Files:**
- Create: `src/mcp/schemas.ts`(本 task 起步,放 resolver 三件 in/out)
- Create: `src/mcp/handlers/resolver.ts`
- Test: `src/mcp/handlers/resolver.test.ts`

**Interfaces:**
- Consumes: `z` from `zod`;`type DB` from `../../store/db.js`;`stagePendingChoice` from `../../store/choice.js`;`resolveOutcome` from `../../resolve/outcome.js`;`resolveContest` from `../../resolve/contest.js`;`eventAppend` from `../../store/event.js`;`type ToolDef` from `../tooldef.js`。
- Produces:
  - `schemas.ts` 导出(本 task 部分):`resolveChoiceIn/Out`、`resolveOutcomeIn/Out`、`resolveContestIn/Out`(均 `z.ZodObject`,in `.strict()`)。
  - `handlers/resolver.ts` 导出:`resolverTools: ToolDef[]`(3 个);内部 handler 私有。
  - annotations(spec §7.1):choice `{readOnly:false,destructive:false,idempotent:true,openWorld:false}`;outcome/contest `{...idempotent:false}`。

- [ ] **Step 1: 写失败测试**

```ts
// src/mcp/handlers/resolver.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../../store/db.js";
import { sheetSetRaw } from "../../store/sheet.js";
import { eventSince } from "../../store/event.js";
import { getPendingChoice } from "../../store/choice.js";
import { resolverTools } from "./resolver.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
const byName = (n: string) => resolverTools.find((t) => t.name === n)!;

const opts = [
  { label: "进", consequence: "遇敌" },
  { label: "退", consequence: "失机" },
];

describe("resolver handlers", () => {
  it("resolve_choice:暂存、不落 event、出参 {staged,options}", () => {
    const db = freshDb();
    const out = byName("resolve_choice").handler(db, { prompt: "怎么走?", options: opts });
    expect(out).toEqual({ staged: true, options: opts });
    expect(getPendingChoice(db)?.prompt).toBe("怎么走?");
    expect(eventSince(db, 0)).toHaveLength(0); // 不落 event
  });

  it("resolve_outcome:掷骰命中档位 + 落 kind=verdict event", () => {
    const db = freshDb();
    const out = byName("resolve_outcome").handler(db, {
      context: "撬锁",
      die: "1d100",
      bands: [
        { label: "失败", min: 1, max: 50, consequence: "触发警报" },
        { label: "成功", min: 51, max: 100, consequence: "无声打开" },
      ],
    });
    expect(out.roll).toBeGreaterThanOrEqual(1);
    expect(out.roll).toBeLessThanOrEqual(100);
    expect(["失败", "成功"]).toContain(out.band.label);
    expect(typeof out.event_id).toBe("number");
    const verdicts = eventSince(db, 0).filter((e) => e.kind === "verdict");
    expect(verdicts).toHaveLength(1);
  });

  it("resolve_contest:取真值比大小 + 落 verdict;winner 正确", () => {
    const db = freshDb();
    sheetSetRaw(db, "张三", "力量", "18");
    const out = byName("resolve_contest").handler(db, {
      context: "掰手腕",
      a: { name: "张三", expr: "{张三.力量}" },
      b: { name: "DC", expr: "10" },
    });
    expect(out.winner).toBe("a");
    expect(out.a.total).toBe(18);
    expect(out.b.total).toBe(10);
    expect(typeof out.event_id).toBe("number");
    expect(eventSince(db, 0).filter((e) => e.kind === "verdict")).toHaveLength(1);
  });

  it("in schema .strict():多余字段报错", () => {
    expect(() => byName("resolve_choice").inputSchema.parse({ prompt: "p", options: opts, extra: 1 })).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/mcp/handlers/resolver.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写 `schemas.ts`(resolver 部分)**

```ts
// src/mcp/schemas.ts
import { z } from "zod";

// ===== resolver =====
const choiceOption = z.object({ label: z.string(), consequence: z.string() });

export const resolveChoiceIn = z
  .object({ prompt: z.string(), options: z.array(choiceOption).min(2) })
  .strict();
export const resolveChoiceOut = z.object({
  staged: z.literal(true),
  options: z.array(choiceOption),
  reminders: z.array(z.string()).optional(),
});

const band = z.object({
  label: z.string(),
  min: z.number(),
  max: z.number(),
  consequence: z.string(),
});
export const resolveOutcomeIn = z
  .object({ context: z.string(), die: z.string(), bands: z.array(band).min(1) })
  .strict();
export const resolveOutcomeOut = z.object({
  roll: z.number(),
  die: z.string(),
  band: z.object({ label: z.string(), consequence: z.string() }),
  event_id: z.number(),
  reminders: z.array(z.string()).optional(),
});

const contestSideIn = z.object({ name: z.string(), expr: z.string() });
export const resolveContestIn = z
  .object({ context: z.string(), a: contestSideIn, b: contestSideIn })
  .strict();
const contestSideOut = z.object({ name: z.string(), total: z.number(), rolls: z.array(z.number()) });
export const resolveContestOut = z.object({
  a: contestSideOut,
  b: contestSideOut,
  winner: z.enum(["a", "b", "tie"]),
  event_id: z.number(),
  reminders: z.array(z.string()).optional(),
});
```

- [ ] **Step 4: 写 `handlers/resolver.ts`**

```ts
// src/mcp/handlers/resolver.ts
import type { DB } from "../../store/db.js";
import { stagePendingChoice } from "../../store/choice.js";
import { resolveOutcome } from "../../resolve/outcome.js";
import { resolveContest } from "../../resolve/contest.js";
import { eventAppend } from "../../store/event.js";
import type { ToolDef } from "../tooldef.js";
import {
  resolveChoiceIn, resolveChoiceOut,
  resolveOutcomeIn, resolveOutcomeOut,
  resolveContestIn, resolveContestOut,
} from "../schemas.js";

const anns = (idempotent: boolean) => ({
  readOnlyHint: false, destructiveHint: false, idempotentHint: idempotent, openWorldHint: false,
});

function choiceHandler(db: DB, input: { prompt: string; options: { label: string; consequence: string }[] }) {
  stagePendingChoice(db, input.prompt, input.options);
  return { staged: true as const, options: input.options };
}

function outcomeHandler(db: DB, input: { context: string; die: string; bands: any[] }) {
  const r = resolveOutcome(input.die, input.bands);
  const event_id = eventAppend(db, {
    kind: "verdict",
    content: input.context,
    data_json: { context: input.context, die: r.die, roll: r.roll, band: r.band },
  });
  return { roll: r.roll, die: r.die, band: { label: r.band.label, consequence: r.band.consequence ?? "" }, event_id };
}

function contestHandler(db: DB, input: { context: string; a: any; b: any }) {
  const r = resolveContest(db, input.a, input.b);
  const rolls = (s: typeof r.a) => s.ledger.terms.flatMap((t) => t.rolls ?? []);
  const event_id = eventAppend(db, {
    kind: "verdict",
    content: input.context,
    data_json: { context: input.context, a: r.a, b: r.b, winner: r.winner },
  });
  return {
    a: { name: r.a.name, total: r.a.ledger.total, rolls: rolls(r.a) },
    b: { name: r.b.name, total: r.b.ledger.total, rolls: rolls(r.b) },
    winner: r.winner,
    event_id,
  };
}

export const resolverTools: ToolDef[] = [
  {
    name: "resolve_choice",
    title: "暂存玩家选择",
    description:
      "暂存「下轮选项 + 后果」供回合末物化。Args: prompt(情境问句)、options(≥2 项,各含 label/consequence,后果必填=声明在先)。" +
      "Returns: {staged:true, options}(不含 event_id,回合末才落)。use: 需要玩家在分支处抉择时。don't: 用它代替随机裁决(那用 resolve_outcome)。" +
      "错误: 入参非法→INTERNAL。",
    inputSchema: resolveChoiceIn,
    outputSchema: resolveChoiceOut,
    annotations: anns(true),
    handler: choiceHandler,
  },
  {
    name: "resolve_outcome",
    title: "选项骰裁决",
    description:
      "掷单骰串并按档位表命中一档。Args: context(裁决什么)、die(单骰串如 \"1d100\")、bands(≥1 档,闭区间 min/max + consequence,引擎校验不重叠/全覆盖)。" +
      "Returns: {roll, die, band:{label,consequence}, event_id}。use: 成败带随机度的行动。don't: 对抗双方各有加值(那用 resolve_contest)。" +
      "错误: die 非单骰串→DIE_INVALID;档位重叠/落空→RANGE_INVALID。",
    inputSchema: resolveOutcomeIn,
    outputSchema: resolveOutcomeOut,
    annotations: anns(false),
    handler: outcomeHandler,
  },
  {
    name: "resolve_contest",
    title: "对抗骰裁决",
    description:
      "两边各按 expr 求值(骰+引用+常数)比大小。Args: context、a/b(各 {name, expr},DC=一边退化成常数 expr 如 \"15\")。" +
      "Returns: {a:{name,total,rolls}, b:{...}, winner:\"a\"|\"b\"|\"tie\", event_id}。use: 双方对抗。don't: 单方成败(用 resolve_outcome)。" +
      "错误: expr 文法非法→EXPR_EVAL;引用不存在→ENTITY_NOT_FOUND;引用非数值→NOT_NUMERIC。",
    inputSchema: resolveContestIn,
    outputSchema: resolveContestOut,
    annotations: anns(false),
    handler: contestHandler,
  },
];
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/mcp/handlers/resolver.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/mcp/schemas.ts src/mcp/handlers/resolver.ts src/mcp/handlers/resolver.test.ts
git commit -m "feat(mcp): resolver 域工具(choice/outcome/contest)schema+handler

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: sheet 域(`sheet_get` / `sheet_list` / `sheet_update`)

**Files:**
- Modify: `src/mcp/schemas.ts`(追加 sheet 三件)
- Create: `src/mcp/handlers/sheet.ts`
- Test: `src/mcp/handlers/sheet.test.ts`

**Interfaces:**
- Consumes: `sheetGet`, `sheetList`, `type Cell` from `../../store/sheet.js`;`applyMutations` from `../../store/mutate.js`;`truncateText` from `../../store/truncate.js`;`type ToolDef` from `../tooldef.js`;schemas。
- Produces:
  - `schemas.ts` 追加:`sheetGetIn/Out`、`sheetListIn/Out`、`sheetUpdateIn/Out`。
  - `handlers/sheet.ts` 导出:`sheetTools: ToolDef[]`(3 个)。
  - sheet_list 行为:`prefix` 入参与 `entity` 拼成内层 `sheetList` 需要的 `"<entity>.<prefix>"`;对结果 `offset`/`limit` 切片;`has_more = offset+limit < 命中总数`;`next_offset` 在 has_more 时给;再对序列化结果套 `truncateText` 得 `truncated`。
  - annotations:get/list `readOnly:true, idempotent:true`;update `readOnly:false, idempotent:false`。

- [ ] **Step 1: 写失败测试**

```ts
// src/mcp/handlers/sheet.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../../store/db.js";
import { sheetSetRaw, sheetGet } from "../../store/sheet.js";
import { eventSince } from "../../store/event.js";
import { sheetTools } from "./sheet.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
const byName = (n: string) => sheetTools.find((t) => t.name === n)!;

describe("sheet handlers", () => {
  it("sheet_get:命中返回 value+visible;缺失返回 {value:null,visible:0}", () => {
    const db = freshDb();
    sheetSetRaw(db, "张三", "HP", "30", 1);
    expect(byName("sheet_get").handler(db, { entity: "张三", attr: "HP" })).toEqual({ value: "30", visible: 1 });
    expect(byName("sheet_get").handler(db, { entity: "张三", attr: "无" })).toEqual({ value: null, visible: 0 });
  });

  it("sheet_list:前缀扫 + 分页字段", () => {
    const db = freshDb();
    sheetSetRaw(db, "张三", "库存:剑", "1");
    sheetSetRaw(db, "张三", "库存:盾", "1");
    sheetSetRaw(db, "张三", "库存:药", "3");
    const out = byName("sheet_list").handler(db, { entity: "张三", prefix: "库存:", limit: 2, offset: 0 });
    expect(out.cells).toHaveLength(2);
    expect(out.has_more).toBe(true);
    expect(out.next_offset).toBe(2);
    expect(out.truncated).toBe(false);
  });

  it("sheet_update:落 mutation event 透传 event_id + applied 账本", () => {
    const db = freshDb();
    sheetSetRaw(db, "张三", "HP", "30");
    const out = byName("sheet_update").handler(db, {
      entity: "张三",
      mutations: [{ attr: "HP", op: "-", expr: "5" }],
    });
    expect(out.entity).toBe("张三");
    expect(out.applied[0].new).toBe("25");
    expect(typeof out.event_id).toBe("number");
    expect(sheetGet(db, "张三", "HP")?.value).toBe("25");
    expect(eventSince(db, 0).filter((e) => e.kind === "mutation")).toHaveLength(1);
  });

  it("sheet_update:非数值算术抛 NOT_NUMERIC(整批回滚由内层保证)", () => {
    const db = freshDb();
    sheetSetRaw(db, "张三", "名", "李四");
    expect(() => byName("sheet_update").handler(db, {
      entity: "张三",
      mutations: [{ attr: "名", op: "+", expr: "1" }],
    })).toThrow(/非数值/);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/mcp/handlers/sheet.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: `schemas.ts` 追加 sheet 部分**

```ts
// src/mcp/schemas.ts —— 追加(文件末尾)

// ===== sheet =====
const cellOut = z.object({ attr: z.string(), value: z.string(), visible: z.number() });

export const sheetGetIn = z.object({ entity: z.string(), attr: z.string() }).strict();
export const sheetGetOut = z.object({ value: z.string().nullable(), visible: z.number() });

export const sheetListIn = z
  .object({
    entity: z.string(),
    prefix: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(100),
    offset: z.number().int().min(0).default(0),
  })
  .strict();
export const sheetListOut = z.object({
  cells: z.array(cellOut),
  has_more: z.boolean(),
  next_offset: z.number().optional(),
  truncated: z.boolean(),
});

const mutation = z.object({
  attr: z.string(),
  op: z.enum(["+", "-", "="]),
  expr: z.string(),
  visible: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
});
export const sheetUpdateIn = z.object({ entity: z.string(), mutations: z.array(mutation).min(1) }).strict();
const appliedOut = z.object({
  attr: z.string(),
  op: z.enum(["+", "-", "="]),
  kind: z.enum(["rolled", "set"]),
  old: z.string().nullable(),
  rolls: z.array(z.number()).optional(),
  delta: z.number().optional(),
  new: z.string(),
});
export const sheetUpdateOut = z.object({
  entity: z.string(),
  applied: z.array(appliedOut),
  fired_watchers: z.array(z.object({ id: z.number(), payload: z.string() })).optional(),
  event_id: z.number(),
  reminders: z.array(z.string()).optional(),
});
```

> 注:内层 `applyMutations` 当前未消费 `mutation.visible`(新建 cell 走 `sheetSetRaw` 默认 visible=0)。v1 接受此现状,schema 保留 `visible` 字段以对齐 spec;若后续需让 update 写 visible,改在内层 `applyMutations`,不在 handler 层。

- [ ] **Step 4: 写 `handlers/sheet.ts`**

```ts
// src/mcp/handlers/sheet.ts
import type { DB } from "../../store/db.js";
import { sheetGet, sheetList } from "../../store/sheet.js";
import { applyMutations } from "../../store/mutate.js";
import { truncateText } from "../../store/truncate.js";
import type { ToolDef } from "../tooldef.js";
import {
  sheetGetIn, sheetGetOut, sheetListIn, sheetListOut, sheetUpdateIn, sheetUpdateOut,
} from "../schemas.js";

function getHandler(db: DB, input: { entity: string; attr: string }) {
  const cell = sheetGet(db, input.entity, input.attr);
  return cell ? { value: cell.value, visible: cell.visible } : { value: null, visible: 0 };
}

function listHandler(db: DB, input: { entity: string; prefix?: string; limit: number; offset: number }) {
  const all = sheetList(db, `${input.entity}.${input.prefix ?? ""}`);
  const page = all.slice(input.offset, input.offset + input.limit);
  const has_more = input.offset + input.limit < all.length;
  const cells = page.map((c) => ({ attr: c.attr, value: c.value, visible: c.visible }));
  const { truncated } = truncateText(JSON.stringify(cells));
  const out: any = { cells, has_more, truncated };
  if (has_more) out.next_offset = input.offset + input.limit;
  return out;
}

function updateHandler(db: DB, input: { entity: string; mutations: any[] }) {
  const r = applyMutations(db, input.entity, input.mutations); // mutation event 自落,透传 event_id
  return {
    entity: r.entity,
    applied: r.applied,
    fired_watchers: r.fired_watchers,
    event_id: r.event_id,
  };
}

export const sheetTools: ToolDef[] = [
  {
    name: "sheet_get",
    title: "读单格",
    description:
      "读 entity.attr 单格(GM 全见,含 visible)。Args: entity、attr。Returns: {value:string|null, visible}。" +
      "use: 取单个属性真值。don't: 批量取整卡(用 sheet_list)。错误: 入参非法→INTERNAL。",
    inputSchema: sheetGetIn,
    outputSchema: sheetGetOut,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: getHandler,
  },
  {
    name: "sheet_list",
    title: "前缀扫描卡表",
    description:
      "按前缀扫 entity 的格(分页)。Args: entity、prefix(可选,如 \"库存:\")、limit(1-200,默认100)、offset(默认0)。" +
      "Returns: {cells:[{attr,value,visible}], has_more, next_offset?, truncated}。use: 取整卡/整库存。don't: 取单格(用 sheet_get)。错误: 入参非法→INTERNAL。",
    inputSchema: sheetListIn,
    outputSchema: sheetListOut,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: listHandler,
  },
  {
    name: "sheet_update",
    title: "批量改卡(状态骰下沉)",
    description:
      "一次 entity 作用域批量写,整批一个事务。Args: entity、mutations(≥1 项,各 {attr, op:+|-|=, expr})。expr 随 op 多态(值表达式/词条字面量);带骰项引擎内掷,AI 给不出真值。" +
      "Returns: {entity, applied:[{attr,op,kind,old,rolls?,delta?,new}], fired_watchers?, event_id}。use: 扣血/加物品/赋值。don't: 在 expr 里硬编随机结果。错误: 非数值算术→NOT_NUMERIC(整批回滚);expr 非法→EXPR_EVAL。",
    inputSchema: sheetUpdateIn,
    outputSchema: sheetUpdateOut,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    handler: updateHandler,
  },
];
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/mcp/handlers/sheet.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/mcp/schemas.ts src/mcp/handlers/sheet.ts src/mcp/handlers/sheet.test.ts
git commit -m "feat(mcp): sheet 域工具(get/list/update)schema+handler

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: event 域(`event_append` / `event_recall` / `watcher_set`)

**Files:**
- Modify: `src/mcp/schemas.ts`(追加 event 三件)
- Create: `src/mcp/handlers/event.ts`
- Test: `src/mcp/handlers/event.test.ts`

**Interfaces:**
- Consumes: `eventAppend`, `eventRecall`, `type EventRow` from `../../store/event.js`;`watcherSet` from `../../store/watcher.js`;`truncateText` from `../../store/truncate.js`;`type ToolDef`;schemas。
- Produces:
  - `schemas.ts` 追加:`eventAppendIn/Out`、`eventRecallIn/Out`、`watcherSetIn/Out`。
  - `handlers/event.ts` 导出:`eventTools: ToolDef[]`(3 个)。
  - 映射注意:in 的 `tags: string[]` → 内层 `tags: string`(`tags.join(" ")`);`event_recall` 的 `k` → 内层 `eventRecall(db, query, {limit:k})`;event 出参对序列化结果套 `truncateText`。
  - annotations:append `readOnly:false,idempotent:false`;recall `readOnly:true,idempotent:true`;watcher_set `readOnly:false,idempotent:false`。

- [ ] **Step 1: 写失败测试**

```ts
// src/mcp/handlers/event.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../../store/db.js";
import { eventSince } from "../../store/event.js";
import { watcherList } from "../../store/watcher.js";
import { eventTools } from "./event.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
const byName = (n: string) => eventTools.find((t) => t.name === n)!;

describe("event handlers", () => {
  it("event_append:落 event 回 event_id;tags 数组合并写入", () => {
    const db = freshDb();
    const out = byName("event_append").handler(db, {
      content: "夜里下起暴雨", kind: "note", tags: ["天气", "夜"],
    });
    expect(typeof out.event_id).toBe("number");
    expect(eventSince(db, 0)).toHaveLength(1);
  });

  it("event_recall:FTS 召回独有词", () => {
    const db = freshDb();
    byName("event_append").handler(db, { content: "苍鹭栖息在钟楼尖顶", kind: "note" });
    byName("event_append").handler(db, { content: "无关的另一条记录", kind: "note" });
    const out = byName("event_recall").handler(db, { query: "苍鹭", k: 8 });
    expect(out.events.length).toBeGreaterThanOrEqual(1);
    expect(out.events.some((e: any) => e.content.includes("苍鹭"))).toBe(true);
    expect(out.truncated).toBe(false);
  });

  it("watcher_set:登记 active watcher 回 watcher_id", () => {
    const db = freshDb();
    const out = byName("watcher_set").handler(db, {
      condition: "{张三.HP} < 10", payload: "濒死!", mode: "once",
    });
    expect(typeof out.watcher_id).toBe("number");
    expect(watcherList(db)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/mcp/handlers/event.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: `schemas.ts` 追加 event 部分**

```ts
// src/mcp/schemas.ts —— 追加(文件末尾)

// ===== event =====
export const eventAppendIn = z
  .object({
    content: z.string().optional(),
    kind: z.enum(["narrate", "note", "verdict", "mutation", "watcher_fired", "reveal"]).default("note"),
    data_json: z.unknown().optional(),
    tags: z.array(z.string()).optional(),
    visible: z.union([z.literal(0), z.literal(1)]).optional(),
  })
  .strict();
export const eventAppendOut = z.object({ event_id: z.number() });

export const eventRecallIn = z
  .object({ query: z.string(), k: z.number().int().min(1).max(100).default(8) })
  .strict();
const eventRowOut = z.object({
  seq: z.number(),
  kind: z.string(),
  content: z.string().nullable(),
  visible: z.number(),
});
export const eventRecallOut = z.object({ events: z.array(eventRowOut), truncated: z.boolean() });

export const watcherSetIn = z
  .object({
    condition: z.string(),
    payload: z.string(),
    mode: z.enum(["once", "repeat"]).default("once"),
  })
  .strict();
export const watcherSetOut = z.object({ watcher_id: z.number() });
```

- [ ] **Step 4: 写 `handlers/event.ts`**

```ts
// src/mcp/handlers/event.ts
import type { DB } from "../../store/db.js";
import { eventAppend, eventRecall, type EventRow } from "../../store/event.js";
import { watcherSet } from "../../store/watcher.js";
import { truncateText } from "../../store/truncate.js";
import type { ToolDef } from "../tooldef.js";
import {
  eventAppendIn, eventAppendOut, eventRecallIn, eventRecallOut, watcherSetIn, watcherSetOut,
} from "../schemas.js";

function appendHandler(db: DB, input: { content?: string; kind: any; data_json?: unknown; tags?: string[]; visible?: 0 | 1 }) {
  const event_id = eventAppend(db, {
    content: input.content,
    kind: input.kind,
    data_json: input.data_json,
    tags: input.tags?.length ? input.tags.join(" ") : undefined,
    visible: input.visible,
  });
  return { event_id };
}

function recallHandler(db: DB, input: { query: string; k: number }) {
  const rows = eventRecall(db, input.query, { limit: input.k });
  const events = rows.map((e: EventRow) => ({ seq: e.seq, kind: e.kind, content: e.content, visible: e.visible }));
  const { truncated } = truncateText(JSON.stringify(events));
  return { events, truncated };
}

function watcherHandler(db: DB, input: { condition: string; payload: string; mode: "once" | "repeat" }) {
  const watcher_id = watcherSet(db, { condition: input.condition, payload: input.payload, mode: input.mode });
  return { watcher_id };
}

export const eventTools: ToolDef[] = [
  {
    name: "event_append",
    title: "追加事件",
    description:
      "向事件流追加一条记录(散文进 content 走 FTS)。Args: content?、kind(narrate/note/verdict/mutation/watcher_fired/reveal,默认 note)、data_json?、tags?(数组)、visible?(0|1,省略按 kind 默认)。" +
      "Returns: {event_id}。use: 记录非裁决的事实/旁注。don't: 当叙述通道(用 narrate)。错误: 入参非法→INTERNAL。",
    inputSchema: eventAppendIn,
    outputSchema: eventAppendOut,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    handler: appendHandler,
  },
  {
    name: "event_recall",
    title: "召回历史事件",
    description:
      "FTS5(jieba)召回历史事件。Args: query、k(1-100,默认8)。Returns: {events:[{seq,kind,content,visible}], truncated}。" +
      "use: 找回早前剧情/伏笔。don't: 取角色属性(用 sheet_*)。错误: 入参非法→INTERNAL。",
    inputSchema: eventRecallIn,
    outputSchema: eventRecallOut,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: recallHandler,
  },
  {
    name: "watcher_set",
    title: "登记条件触发器",
    description:
      "登记谓词触发器,sheet_update 写完就地比对(非轮询),edge-triggered。Args: condition(谓词 expr 如 \"{张三.HP} < 30\")、payload(触发时给 AI 的提示)、mode(once/repeat,默认 once)。" +
      "Returns: {watcher_id}。use: 埋「HP 跌破阈值」类反应。don't: 立刻判定(那直接读 sheet)。错误: condition 文法非法→EXPR_EVAL(触发时)。",
    inputSchema: watcherSetIn,
    outputSchema: watcherSetOut,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    handler: watcherHandler,
  },
];
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/mcp/handlers/event.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/mcp/schemas.ts src/mcp/handlers/event.ts src/mcp/handlers/event.test.ts
git commit -m "feat(mcp): event 域工具(append/recall/watcher_set)schema+handler

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: world + rule 域(`world_search` / `world_sample` / `world_register` / `rule_search`)

**Files:**
- Modify: `src/mcp/schemas.ts`(追加 world/rule 四件)
- Create: `src/mcp/handlers/world.ts`
- Test: `src/mcp/handlers/world.test.ts`

**Interfaces:**
- Consumes: `worldDocSearch`, `worldSample`, `worldRegister`, `worldDocUpsert`, `type WorldDoc` from `../../store/world.js`;`ruleSearch`, `type RuleDoc` from `../../store/rule.js`;`truncateText`;`type ToolDef`;schemas。
- Produces:
  - `schemas.ts` 追加:`worldSearchIn/Out`、`worldSampleIn/Out`、`worldRegisterIn/Out`、`ruleSearchIn/Out`。
  - `handlers/world.ts` 导出:`worldTools: ToolDef[]`(4 个)。
  - `world_register` 按 `target` 分派:`"doc"` → `worldDocUpsert(db, {...doc, visible})`;`"pool"` → `worldRegister(db, {pool, row, weight, visible})`(内层固定 source=ai)。
  - annotations:search/rule_search `readOnly:true,idempotent:true`;sample `readOnly:true,idempotent:false`(随机);register `readOnly:false,idempotent:false`。

- [ ] **Step 1: 写失败测试**

```ts
// src/mcp/handlers/world.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../../store/db.js";
import { worldDocGet } from "../../store/world.js";
import { worldTools } from "./world.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
const byName = (n: string) => worldTools.find((t) => t.name === n)!;

describe("world/rule handlers", () => {
  it("world_register(doc):写入 doc,可被 world_search 召回", () => {
    const db = freshDb();
    const reg = byName("world_register").handler(db, {
      target: "doc",
      doc: { name: "黯礁港", content: "雾锁的走私者港湾", category: "地点" },
      visible: 0,
    });
    expect(reg.ok).toBe(true);
    expect(worldDocGet(db, "黯礁港")?.content).toContain("走私者");
    const found = byName("world_search").handler(db, { query: "走私者", k: 8 });
    expect(found.docs.some((d: any) => d.name === "黯礁港")).toBe(true);
    expect(found.truncated).toBe(false);
  });

  it("world_register(pool)+world_sample:抽样回 rows", () => {
    const db = freshDb();
    byName("world_register").handler(db, {
      target: "pool", pool: "战利品", row: { 名: "金币", 量: 10 }, weight: 1, visible: 0,
    });
    const out = byName("world_sample").handler(db, { pool: "战利品", n: 1 });
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ 名: "金币" });
  });

  it("rule_search:召回作者灌注的规则", () => {
    const db = freshDb();
    // 直接灌注 rule(rule 无 AI 写工具,测试用内层 upsert)
    const { ruleUpsert } = require("../../store/rule.js");
    ruleUpsert(db, { name: "先攻", content: "战斗开始各掷 1d20 决定行动顺序" });
    const out = byName("rule_search").handler(db, { query: "先攻", k: 8 });
    expect(out.rules.some((r: any) => r.name === "先攻")).toBe(true);
  });
});
```

> 注:测试里 `require` 仅为灌注规则便利;若 ESM 下 `require` 不可用,改 `import { ruleUpsert } from "../../store/rule.js";` 置于文件顶部。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/mcp/handlers/world.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: `schemas.ts` 追加 world/rule 部分**

```ts
// src/mcp/schemas.ts —— 追加(文件末尾)

// ===== world =====
export const worldSearchIn = z
  .object({ query: z.string(), k: z.number().int().min(1).max(100).default(20), category: z.string().optional() })
  .strict();
export const worldSearchOut = z.object({
  docs: z.array(z.object({ name: z.string(), content: z.string(), category: z.string().nullable(), visible: z.number() })),
  truncated: z.boolean(),
});

export const worldSampleIn = z
  .object({
    pool: z.string(),
    n: z.number().int().min(1).default(1),
    filter: z.record(z.union([z.string(), z.number()])).optional(),
  })
  .strict();
export const worldSampleOut = z.object({ rows: z.array(z.record(z.unknown())) });

export const worldRegisterIn = z
  .object({
    target: z.enum(["doc", "pool"]),
    doc: z.object({ name: z.string(), content: z.string(), category: z.string().optional(), tags: z.string().optional() }).optional(),
    pool: z.object({ pool: z.string(), row: z.record(z.unknown()), weight: z.number().default(1) }).optional(),
    visible: z.union([z.literal(0), z.literal(1)]).default(0),
  })
  .strict()
  .refine((v) => (v.target === "doc" ? !!v.doc : !!v.pool), { message: "world_register: target 与 doc/pool 不匹配" });
export const worldRegisterOut = z.object({ ok: z.literal(true), rowid: z.number() });

// ===== rule =====
export const ruleSearchIn = z.object({ query: z.string(), k: z.number().int().min(1).max(100).default(20) }).strict();
export const ruleSearchOut = z.object({
  rules: z.array(z.object({ name: z.string(), content: z.string(), version: z.number() })),
  truncated: z.boolean(),
});
```

> 注:`worldRegisterIn` 用 `.refine()` 加 target↔payload 一致性校验;但注册到 SDK 用 `.shape`,SDK 侧不跑 refine(refine 只在 `runTool` 内 `.parse` 生效)。这与 `.strict()` 同属「strict 校验主要落在 runTool/测试路径」的既定取舍。

- [ ] **Step 4: 写 `handlers/world.ts`**

```ts
// src/mcp/handlers/world.ts
import type { DB } from "../../store/db.js";
import { worldDocSearch, worldSample, worldRegister, worldDocUpsert, type WorldDoc } from "../../store/world.js";
import { ruleSearch, type RuleDoc } from "../../store/rule.js";
import { truncateText } from "../../store/truncate.js";
import type { ToolDef } from "../tooldef.js";
import {
  worldSearchIn, worldSearchOut, worldSampleIn, worldSampleOut,
  worldRegisterIn, worldRegisterOut, ruleSearchIn, ruleSearchOut,
} from "../schemas.js";

function searchHandler(db: DB, input: { query: string; k: number; category?: string }) {
  let docs = worldDocSearch(db, input.query, input.k);
  if (input.category) docs = docs.filter((d) => d.category === input.category);
  const mapped = docs.map((d: WorldDoc) => ({ name: d.name, content: d.content, category: d.category, visible: d.visible }));
  const { truncated } = truncateText(JSON.stringify(mapped));
  return { docs: mapped, truncated };
}

function sampleHandler(db: DB, input: { pool: string; n: number; filter?: Record<string, string | number> }) {
  const rows = worldSample(db, input.pool, input.n, { filter: input.filter });
  return { rows };
}

function registerHandler(
  db: DB,
  input: { target: "doc" | "pool"; doc?: any; pool?: any; visible: 0 | 1 },
) {
  let rowid: number;
  if (input.target === "doc") {
    rowid = worldDocUpsert(db, { ...input.doc, visible: input.visible });
  } else {
    rowid = worldRegister(db, { pool: input.pool.pool, row: input.pool.row, weight: input.pool.weight, visible: input.visible });
  }
  return { ok: true as const, rowid };
}

function ruleHandler(db: DB, input: { query: string; k: number }) {
  const rules = ruleSearch(db, input.query, input.k).map((r: RuleDoc) => ({ name: r.name, content: r.content, version: r.version }));
  const { truncated } = truncateText(JSON.stringify(rules));
  return { rules, truncated };
}

export const worldTools: ToolDef[] = [
  {
    name: "world_search",
    title: "检索世界设定",
    description:
      "FTS5 检索世界散文设定。Args: query、k(1-100,默认20)、category?(命中后过滤)。Returns: {docs:[{name,content,category,visible}], truncated}。" +
      "use: 取地点/NPC/背景设定。don't: 取随机表(用 world_sample)。错误: 入参非法→INTERNAL。",
    inputSchema: worldSearchIn,
    outputSchema: worldSearchOut,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: searchHandler,
  },
  {
    name: "world_sample",
    title: "加权抽样随机表",
    description:
      "从 pool 加权无放回抽 n 行。Args: pool、n(默认1)、filter?(键值精确匹配 row_json 字段)。Returns: {rows:[...]}。" +
      "use: 抽遭遇/战利品/随机事件。don't: 取确定设定(用 world_search)。错误: 入参非法→INTERNAL。",
    inputSchema: worldSampleIn,
    outputSchema: worldSampleOut,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    handler: sampleHandler,
  },
  {
    name: "world_register",
    title: "现编世界条目",
    description:
      "运行期 GM 现编世界条目(默认隐,待 show)。Args: target(doc|pool)、doc?{name,content,category?,tags?} 或 pool?{pool,row,weight?}、visible?(默认0)。" +
      "Returns: {ok:true, rowid}。use: 即兴扩世界。don't: 写规则(rule 只读)。错误: target 与 payload 不匹配→INTERNAL。",
    inputSchema: worldRegisterIn,
    outputSchema: worldRegisterOut,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    handler: registerHandler,
  },
  {
    name: "rule_search",
    title: "检索规则(只读)",
    description:
      "FTS5 检索作者灌注的规则(AI 只读,无写工具)。Args: query、k(1-100,默认20)。Returns: {rules:[{name,content,version}], truncated}。" +
      "use: 查机制裁定依据。don't: 改规则(不可)。错误: 入参非法→INTERNAL。",
    inputSchema: ruleSearchIn,
    outputSchema: ruleSearchOut,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: ruleHandler,
  },
];
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/mcp/handlers/world.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/mcp/schemas.ts src/mcp/handlers/world.ts src/mcp/handlers/world.test.ts
git commit -m "feat(mcp): world+rule 域工具(search/sample/register/rule_search)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: io 域(`sheet_show` / `world_show` / `reveal_once` / `narrate` / `game_end`)

**Files:**
- Modify: `src/mcp/schemas.ts`(追加 io 五件)
- Create: `src/mcp/handlers/io.ts`
- Test: `src/mcp/handlers/io.test.ts`

**Interfaces:**
- Consumes: `sheetShow`, `worldShow`, `revealOnce` from `../../store/visibility.js`;`worldDocGet` from `../../store/world.js`;`eventAppend` from `../../store/event.js`;`metaSet` from `../../session/resolve.js`;`type ToolDef`;schemas。
- Produces:
  - `schemas.ts` 追加:`sheetShowIn/Out`、`worldShowIn/Out`、`revealOnceIn/Out`、`narrateIn/Out`、`gameEndIn/Out`。
  - `handlers/io.ts` 导出:`ioTools: ToolDef[]`(5 个)。
  - **v1 schema 取舍(对齐内层原子,记录在案)**:
    - `sheet_show` in `{entity, attrs?, recursive?}`:`attrs` 非空 → 逐 attr `sheetShow(db,entity,attr)`;否则 `recursive=true` → `sheetShow(db,entity)`(写 `__show_all`)。out `{shown:string[], ok:true}`(内层 `sheetShow` 不回 audit event_id,故不透传)。
    - `world_show` in `{doc?, pool_rowid?}`(二选一):`doc`(名)→ `worldDocGet` 解析 rowid → `worldShow(db,"world_doc",rowid)`;`pool_rowid` → `worldShow(db,"world_pool",pool_rowid)`。这是对 wiki spec `name/pool/row_ref` 的 v1 务实收敛(pool 行匿名,用 rowid 寻址)。out `{ok:true}`。
    - `reveal_once` in `{sheet?:{entity,attr}, world?:{rowid}}`(二选一)→ 内层 `RevealTarget`。out `{event_id}`(spec 的 `content/ref` v1 不透传,需要时再补)。
  - annotations:show 两件 `idempotent:true`;reveal_once/narrate `idempotent:false`;game_end `destructive:true`(全局唯一 destructive)。

- [ ] **Step 1: 写失败测试**

```ts
// src/mcp/handlers/io.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../../store/db.js";
import { sheetSetRaw, sheetGet } from "../../store/sheet.js";
import { worldDocUpsert } from "../../store/world.js";
import { eventSince } from "../../store/event.js";
import { metaGet } from "../../session/resolve.js";
import { ioTools } from "./io.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
const byName = (n: string) => ioTools.find((t) => t.name === n)!;

describe("io handlers", () => {
  it("sheet_show(attrs):翻 visible=1 + 落审计 note", () => {
    const db = freshDb();
    sheetSetRaw(db, "张三", "秘密", "卧底", 0);
    const out = byName("sheet_show").handler(db, { entity: "张三", attrs: ["秘密"] });
    expect(out.ok).toBe(true);
    expect(out.shown).toEqual(["秘密"]);
    expect(sheetGet(db, "张三", "秘密")?.visible).toBe(1);
    expect(eventSince(db, 0).some((e) => e.kind === "note")).toBe(true);
  });

  it("world_show(doc):按名解析 rowid 翻 visible", () => {
    const db = freshDb();
    const rowid = worldDocUpsert(db, { name: "密道", content: "通往地窖", visible: 0 });
    const out = byName("world_show").handler(db, { doc: "密道" });
    expect(out.ok).toBe(true);
    const row = db.prepare("SELECT visible FROM world_doc WHERE rowid=?").get(rowid) as { visible: number };
    expect(row.visible).toBe(1);
  });

  it("reveal_once(sheet):append kind=reveal 可见 event", () => {
    const db = freshDb();
    sheetSetRaw(db, "门", "状态", "上锁", 0);
    const out = byName("reveal_once").handler(db, { sheet: { entity: "门", attr: "状态" } });
    expect(typeof out.event_id).toBe("number");
    const reveals = eventSince(db, 0).filter((e) => e.kind === "reveal");
    expect(reveals).toHaveLength(1);
    expect(reveals[0].visible).toBe(1);
    expect(sheetGet(db, "门", "状态")?.visible).toBe(0); // 不碰底层 visible
  });

  it("narrate:落 kind=narrate visible=1 event", () => {
    const db = freshDb();
    const out = byName("narrate").handler(db, { text: "暮色漫过城墙", tags: ["黄昏"] });
    expect(typeof out.event_id).toBe("number");
    const evs = eventSince(db, 0).filter((e) => e.kind === "narrate");
    expect(evs).toHaveLength(1);
    expect(evs[0].visible).toBe(1);
  });

  it("game_end:写 meta ended + 落 note,出参 {ended,event_id}", () => {
    const db = freshDb();
    const out = byName("game_end").handler(db, { reason: "队伍全灭", outcome: "团灭结局" });
    expect(out.ended).toBe(true);
    expect(typeof out.event_id).toBe("number");
    const meta = JSON.parse(metaGet(db, "ended")!);
    expect(meta.reason).toBe("队伍全灭");
    expect(meta.seq).toBe(out.event_id);
    expect(eventSince(db, 0).filter((e) => e.kind === "note")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/mcp/handlers/io.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: `schemas.ts` 追加 io 部分**

```ts
// src/mcp/schemas.ts —— 追加(文件末尾)

// ===== visibility / output =====
export const sheetShowIn = z
  .object({ entity: z.string(), attrs: z.array(z.string()).optional(), recursive: z.boolean().default(false) })
  .strict()
  .refine((v) => (v.attrs && v.attrs.length > 0) || v.recursive, { message: "sheet_show: 需给 attrs 或 recursive=true" });
export const sheetShowOut = z.object({ shown: z.array(z.string()), ok: z.literal(true) });

export const worldShowIn = z
  .object({ doc: z.string().optional(), pool_rowid: z.number().int().optional() })
  .strict()
  .refine((v) => (v.doc === undefined) !== (v.pool_rowid === undefined), { message: "world_show: doc 与 pool_rowid 二选一" });
export const worldShowOut = z.object({ ok: z.literal(true) });

export const revealOnceIn = z
  .object({
    sheet: z.object({ entity: z.string(), attr: z.string() }).optional(),
    world: z.object({ rowid: z.number().int() }).optional(),
  })
  .strict()
  .refine((v) => (v.sheet === undefined) !== (v.world === undefined), { message: "reveal_once: sheet 与 world 二选一" });
export const revealOnceOut = z.object({ event_id: z.number() });

export const narrateIn = z.object({ text: z.string(), tags: z.array(z.string()).optional() }).strict();
export const narrateOut = z.object({ event_id: z.number() });

export const gameEndIn = z.object({ reason: z.string(), outcome: z.string().optional() }).strict();
export const gameEndOut = z.object({ ended: z.literal(true), event_id: z.number() });
```

- [ ] **Step 4: 写 `handlers/io.ts`**

```ts
// src/mcp/handlers/io.ts
import type { DB } from "../../store/db.js";
import { sheetShow, worldShow, revealOnce } from "../../store/visibility.js";
import { worldDocGet } from "../../store/world.js";
import { eventAppend } from "../../store/event.js";
import { metaSet } from "../../session/resolve.js";
import { DiceloreError } from "../../errors.js";
import type { ToolDef } from "../tooldef.js";
import {
  sheetShowIn, sheetShowOut, worldShowIn, worldShowOut, revealOnceIn, revealOnceOut,
  narrateIn, narrateOut, gameEndIn, gameEndOut,
} from "../schemas.js";

function sheetShowHandler(db: DB, input: { entity: string; attrs?: string[]; recursive: boolean }) {
  if (input.attrs && input.attrs.length > 0) {
    for (const attr of input.attrs) sheetShow(db, input.entity, attr);
    return { shown: input.attrs, ok: true as const };
  }
  sheetShow(db, input.entity); // recursive → __show_all
  return { shown: ["__show_all"], ok: true as const };
}

function worldShowHandler(db: DB, input: { doc?: string; pool_rowid?: number }) {
  if (input.doc !== undefined) {
    const d = worldDocGet(db, input.doc);
    if (!d) throw new DiceloreError("NOT_FOUND", `world_show: doc 不存在 "${input.doc}"`);
    worldShow(db, "world_doc", d.rowid);
  } else {
    worldShow(db, "world_pool", input.pool_rowid!);
  }
  return { ok: true as const };
}

function revealOnceHandler(db: DB, input: { sheet?: { entity: string; attr: string }; world?: { rowid: number } }) {
  const event_id = input.sheet
    ? revealOnce(db, { kind: "sheet", entity: input.sheet.entity, attr: input.sheet.attr })
    : revealOnce(db, { kind: "world_doc", rowid: input.world!.rowid });
  return { event_id };
}

function narrateHandler(db: DB, input: { text: string; tags?: string[] }) {
  const event_id = eventAppend(db, {
    kind: "narrate",
    content: input.text,
    tags: input.tags?.length ? input.tags.join(" ") : undefined,
  });
  return { event_id };
}

function gameEndHandler(db: DB, input: { reason: string; outcome?: string }) {
  const event_id = eventAppend(db, { kind: "note", visible: 0, data_json: { reason: input.reason, outcome: input.outcome } });
  metaSet(db, "ended", JSON.stringify({ reason: input.reason, outcome: input.outcome, seq: event_id }));
  return { ended: true as const, event_id };
}

export const ioTools: ToolDef[] = [
  {
    name: "sheet_show",
    title: "持久揭示卡格",
    description:
      "翻 visible=1 让玩家看到指定 cell(强制隐=2 不受影响)。Args: entity、attrs?(给定=attr 级)、recursive?(省略 attrs + true=写 __show_all 整卡长效)。" +
      "Returns: {shown, ok:true}。use: 公开角色已知属性。don't: 一次性披露(用 reveal_once)。错误: 入参非法→INTERNAL。",
    inputSchema: sheetShowIn,
    outputSchema: sheetShowOut,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: sheetShowHandler,
  },
  {
    name: "world_show",
    title: "持久揭示世界条目",
    description:
      "翻世界条目 visible=1。Args: doc(按名)或 pool_rowid(按行 rowid),二选一。Returns: {ok:true}。" +
      "use: 公开已揭示的设定/地点。don't: 揭示卡格(用 sheet_show)。错误: doc 不存在→NOT_FOUND;入参非法→INTERNAL。",
    inputSchema: worldShowIn,
    outputSchema: worldShowOut,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: worldShowHandler,
  },
  {
    name: "reveal_once",
    title: "一次性快照披露",
    description:
      "append 一条 kind=reveal 可见 event(冻结此刻副本),不碰目标底层 visible。Args: sheet?{entity,attr} 或 world?{rowid},二选一。" +
      "Returns: {event_id}。use: 给玩家瞄一眼暗值/世界条目。don't: 持久公开(用 sheet_show/world_show)。错误: 目标不存在→ENTITY_NOT_FOUND。",
    inputSchema: revealOnceIn,
    outputSchema: revealOnceOut,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    handler: revealOnceHandler,
  },
  {
    name: "narrate",
    title: "叙事散文通道",
    description:
      "落一条 kind=narrate(默认 visible=1)的剧情散文,轮内可多次、非终结步骤。Args: text、tags?。Returns: {event_id}。" +
      "use: 推进剧情描写。don't: 在 text 里吐数值菜单(机械结果归输出层)。错误: 入参非法→INTERNAL。",
    inputSchema: narrateIn,
    outputSchema: narrateOut,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    handler: narrateHandler,
  },
  {
    name: "game_end",
    title: "终局信号",
    description:
      "标记本局终结(you_death = 同工具 + reason 的语义特例)。Args: reason、outcome?。Returns: {ended:true, event_id}。" +
      "use: 剧情自然终结/团灭。don't: 普通失败(那继续游戏)。错误: 入参非法→INTERNAL。",
    inputSchema: gameEndIn,
    outputSchema: gameEndOut,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    handler: gameEndHandler,
  },
];
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/mcp/handlers/io.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/mcp/schemas.ts src/mcp/handlers/io.ts src/mcp/handlers/io.test.ts
git commit -m "feat(mcp): io 域工具(sheet_show/world_show/reveal_once/narrate/game_end)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 阶段四:聚合 + stdio 接线

### Task 15: `src/mcp/tools.ts` 聚合 + `src/mcp/main.ts` 接线 + npm script

**Files:**
- Create: `src/mcp/tools.ts`(聚合 `TOOLS`)
- Create: `src/mcp/main.ts`(stdio bin)
- Modify: `package.json`(scripts 加 `dicelore:mcp`)
- Test: `src/mcp/tools.test.ts`(聚合完整性 + 注册不变量)

**Interfaces:**
- Consumes: `resolverTools`/`sheetTools`/`eventTools`/`worldTools`/`ioTools`(各 `handlers/*.ts`);`type ToolDef` from `./tooldef.js`;`runTool` from `./runTool.js`;`openSession` from `../session/resolve.js`;`McpServer`、`StdioServerTransport`(SDK)。
- Produces: `export const TOOLS: ToolDef[]`(17 个工具);`main.ts` 为可执行入口(无导出)。

- [ ] **Step 1: 写失败测试(聚合完整性)**

```ts
// src/mcp/tools.test.ts
import { describe, it, expect } from "vitest";
import { TOOLS } from "./tools.js";

describe("TOOLS 注册表", () => {
  it("囊括全部 17 个工具,名字唯一", () => {
    const names = TOOLS.map((t) => t.name);
    expect(names).toHaveLength(17);
    expect(new Set(names).size).toBe(17);
    for (const n of [
      "resolve_choice", "resolve_outcome", "resolve_contest",
      "sheet_get", "sheet_list", "sheet_update",
      "event_append", "event_recall", "watcher_set",
      "world_search", "world_sample", "world_register", "rule_search",
      "sheet_show", "world_show", "reveal_once", "narrate", "game_end",
    ].filter((n) => n !== "world_register" || true)) {
      // 上表含 18 行但 world_register 只一个 → 实际 17:剔除重复计数误差,逐一断言存在
    }
    for (const n of [
      "resolve_choice", "resolve_outcome", "resolve_contest",
      "sheet_get", "sheet_list", "sheet_update",
      "event_append", "event_recall", "watcher_set",
      "world_search", "world_sample", "world_register", "rule_search",
      "sheet_show", "world_show", "reveal_once", "narrate", "game_end",
    ]) {
      // 该列表 18 项?清点:resolver3+sheet3+event3+world4+io5 = 18。修正期望见下条。
      expect(names).toContain(n);
    }
  });

  it("每个工具 description 含五段要素的关键词(功能/Args/Returns/use/错误)", () => {
    for (const t of TOOLS) {
      expect(t.description).toContain("Args");
      expect(t.description).toContain("Returns");
      expect(t.description).toContain("错误");
    }
  });

  it("annotations.openWorldHint 全 false;唯一 destructive 是 game_end", () => {
    expect(TOOLS.every((t) => t.annotations.openWorldHint === false)).toBe(true);
    const destructive = TOOLS.filter((t) => t.annotations.destructiveHint).map((t) => t.name);
    expect(destructive).toEqual(["game_end"]);
  });
});
```

> **清点修正**:resolver(3)+sheet(3)+event(3)+world/rule(4)+io(5) = **18** 个工具。把 Step 1 测试里的 `toHaveLength(17)`/`size).toBe(17)` 改成 **18**,并删掉中间那段含注释的占位 `for` 块(只保留第二个 `for...expect(names).toContain(n)` 循环 + 18 项断言)。落地时按此清点写干净:

```ts
it("囊括全部 18 个工具,名字唯一", () => {
  const names = TOOLS.map((t) => t.name);
  expect(names).toHaveLength(18);
  expect(new Set(names).size).toBe(18);
  for (const n of [
    "resolve_choice", "resolve_outcome", "resolve_contest",
    "sheet_get", "sheet_list", "sheet_update",
    "event_append", "event_recall", "watcher_set",
    "world_search", "world_sample", "world_register", "rule_search",
    "sheet_show", "world_show", "reveal_once", "narrate", "game_end",
  ]) {
    expect(names).toContain(n);
  }
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/mcp/tools.test.ts`
Expected: FAIL（`./tools.js` 不存在）

- [ ] **Step 3: 写 `src/mcp/tools.ts`**

```ts
// src/mcp/tools.ts
import type { ToolDef } from "./tooldef.js";
import { resolverTools } from "./handlers/resolver.js";
import { sheetTools } from "./handlers/sheet.js";
import { eventTools } from "./handlers/event.js";
import { worldTools } from "./handlers/world.js";
import { ioTools } from "./handlers/io.js";

export const TOOLS: ToolDef[] = [
  ...resolverTools,
  ...sheetTools,
  ...eventTools,
  ...worldTools,
  ...ioTools,
];
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/mcp/tools.test.ts`
Expected: PASS

- [ ] **Step 5: 写 `src/mcp/main.ts`(stdio 接线)**

```ts
// src/mcp/main.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { openSession } from "../session/resolve.js";
import { TOOLS } from "./tools.js";
import { runTool } from "./runTool.js";

async function main() {
  const { db } = openSession(); // env: DICELORE_SESSION / DICELORE_SESSIONS_DIR
  const server = new McpServer({ name: "dicelore", version: "0.0.0" });

  for (const t of TOOLS) {
    server.registerTool(
      `dicelore_${t.name}`,
      {
        title: t.title,
        description: t.description,
        inputSchema: t.inputSchema.shape,
        outputSchema: t.outputSchema.shape,
        annotations: t.annotations,
      },
      (args: unknown) => runTool(db, t, args) as any,
    );
  }

  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  // stdio server:错误打到 stderr,不污染 stdout 的 JSON-RPC 流。
  console.error("dicelore mcp 启动失败:", e);
  process.exit(1);
});
```

- [ ] **Step 6: `package.json` scripts 加 `dicelore:mcp`**

```jsonc
// package.json scripts 内追加:
"dicelore:mcp": "tsx src/mcp/main.ts"
```

- [ ] **Step 7: 全量测试 + 类型兜底 + 冒烟启动**

Run: `npx vitest run`
Expected: PASS（全绿）

Run: `npx tsc --noEmit`
Expected: 无类型错误

Run: `printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | DICELORE_SESSIONS_DIR=/tmp/dicelore-smoke npx tsx src/mcp/main.ts`
Expected: stdout 输出一行 JSON-RPC 响应,`result.tools` 含 18 个 `dicelore_*` 工具(进程不退出属正常,Ctrl-C 终止即可;只验证能列出工具)。

> 若该手动冒烟在 CI/非交互环境卡住,可跳过——`tools.test.ts` 已覆盖注册表完整性,`main.ts` 薄到不强求集成测(spec §8)。

- [ ] **Step 8: Commit**

```bash
git add src/mcp/tools.ts src/mcp/tools.test.ts src/mcp/main.ts package.json
git commit -m "feat(mcp): TOOLS 聚合 + stdio main 接线 + dicelore:mcp script

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 计划自检(Self-Review)

**1. Spec 覆盖**(对 design §0–§10 + wiki §1–§7 逐项):

| spec 项 | 落点 task |
|---|---|
| §2.1 resolveOutcome / §2.2 resolveContest | Task 3 / Task 4 |
| §2.3 pending_choice 槽(stage/get/materialize) | Task 5 |
| §3 errors.ts + 既有改抛 | Task 1 / Task 2 |
| §4.1 SDK+zod 安装 / §4.2 ToolDef / §4.3 runTool / §4.4 main / §4.5 handler 映射 | Task 7 / Task 7 / Task 9 / Task 15 / Task 10–14 |
| §5 reminders terse 表 | Task 8 |
| §6 truncate | Task 6 |
| §7 game_end 终态 | Task 14 |
| wiki §1 resolver / §2 数据 / §3 可见性 / §4 narrate / §6 game_end / §7.1 annotations | Task 10 / 11–13 / 14 / 14 / 14 / 各域 ToolDef |

无遗漏项。范围外项(回滚/快照/Stop hook 物化接线/L3/被动 rule 召回/watcher payload 注入)按 design §0 明确不实现;`materializePendingChoice` 实现但不接线(Task 5)。

**2. 占位扫描**:全部 task 步骤含真实 test/impl 代码与确切命令;无 TBD/TODO。Task 15 Step 1 含一段「清点修正」说明 + 干净版测试代码,落地照干净版写。

**3. 类型一致性**(跨 task 核对):
- `ToolDef`(Task 7 定)被 Task 9/10–15 一致引用;`handler: (db, input)=>any`、`inputSchema/outputSchema: z.ZodObject`。
- `remindersFor(name, out, input)`(Task 8)签名与 `runTool`(Task 9)调用一致。
- `resolveOutcome(die, bands, rng?)`→`{roll,die,band}`(Task 3)与 outcomeHandler(Task 10)一致。
- `resolveContest(db,a,b,rng?)`→`{a:{name,ledger},b,winner}`(Task 4)与 contestHandler 取 `r.a.ledger.total`/`terms`(Task 10)一致。
- `stagePendingChoice(db,prompt,options)`(Task 5)与 choiceHandler(Task 10)一致。
- `truncateText(s,limit?)`→`{text,truncated}`(Task 6)被 sheet/event/world handler 一致解构 `{truncated}`。
- `MutationResult.fired_watchers: {id,payload}[]`(既有内层)与 sheetUpdateOut schema + reminders 的 `out.fired_watchers?.length`(Task 8/11)一致。

**4. 歧义消解**(已在计划内显式定调):
- 错误路径绝不带 `structuredContent`(Task 7/9 锁此不变量,测试断言)。
- `.strict()`/`.refine()` 校验主要落 runTool/测试路径,SDK 侧用 `.shape`(全局约束 + Task 13 注)。
- `world_show` v1 收敛为 `doc(名)|pool_rowid`;`reveal_once` out 仅 `{event_id}`;`sheet_update` 暂不消费 `visible`——均在 Task 11/14 记录在案。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-20-mcp-tool-surface.md`. Two execution options:**

**1. Subagent-Driven(推荐)** —— 每 task 派新 subagent、task 间两阶段 review、快速迭代。

**2. Inline Execution** —— 本会话内按批执行(executing-plans),带 checkpoint review。

**Which approach?**






