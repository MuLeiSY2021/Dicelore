# 内层地基·确定性核心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零搭建 Dicelore 的 TS 内层能力库的确定性核心——骰子引擎、expr 求值器/谓词、sheet/event/watcher store、applyMutations 批量写、session 解析建库——全部可单测、不依赖 MCP、不引入全文检索。

**Architecture:** 三个单向依赖的原子层(① dice 纯函数 / ② SQLite store CRUD / ③ expr 求值与 mutation 编排),外加 session 解析层。随机源(dice)是唯一不可交给 AI 的能力(anti-F1 物理根),通过 RNG 注入做确定性单测。状态全部外置到每局一个 `.db`(better-sqlite3 同步 API)。watcher 在每次 `applyMutations` 写完就地重算触发,不轮询。

**Tech Stack:** TypeScript (ESM, strict) · Node ≥20 · better-sqlite3(同步 SQLite,原生 FTS5)· vitest(测试)· tsx(运行 CLI/脚本)

## Global Constraints

- TypeScript strict 模式;ESM(`"type": "module"`);Node ≥ 20。
- 数据层 SQLite 用 `better-sqlite3`(同步 API,[技术选型 §1](../../wiki/03-架构/技术选型.md))。
- **本 plan 不引入 `@node-rs/jieba` 与 FTS5 虚表**——event/world/rule 的全文检索归 Plan 2;本 plan 的 event 表是普通表(只 append + 按 seq/kind 读)。
- 跨端:路径用 Node 平台 API(`os.homedir()` / `path.join`),不写死 POSIX([跨agent §3](../../wiki/03-架构/跨agent与适配层.md))。
- `expr` 文法只 `+`/`-`、左到右、无 `*` `/` 括号([内层 §3.1](../../wiki/04-子系统设计/内层能力库.md))。
- 引擎"哑":不 clamp 数值;非数值做算术 → 报错 + 整批回滚。
- 每个 task 用 TDD:先写失败测试 → 跑红 → 最小实现 → 跑绿 → commit。
- 测试命令统一 `npx vitest run <path>`。

---

### Task 1: 项目脚手架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`(追加 node_modules / dist)
- Create: `src/smoke.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: 可运行的 `npx vitest run` 环境;ESM + strict TS。

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "dicelore",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "vitest run",
    "dicelore": "tsx src/cli.ts"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: 写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 写 vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
```

- [ ] **Step 4: 追加 .gitignore**

确保文件含以下两行(若已存在 .gitignore 则追加,不要删原有内容):

```
node_modules/
dist/
```

- [ ] **Step 5: 写冒烟测试 `src/smoke.test.ts`**

```ts
import { expect, test } from "vitest";

test("smoke: toolchain runs", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 6: 安装依赖并跑测试**

Run: `npm install && npx vitest run src/smoke.test.ts`
Expected: 1 passed。若 `better-sqlite3` 安装触发原生编译失败,先 `npm i -g node-gyp` 或确认有 build-essential,再重试。

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore src/smoke.test.ts
git commit -m "chore: TS 脚手架(vitest + better-sqlite3 + tsx)"
```

---

### Task 2: 骰子引擎(原子层①)

**Files:**
- Create: `src/dice/index.ts`
- Test: `src/dice/dice.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `type Rng = () => number`(返回 [0,1))
  - `interface Band { label: string; min: number; max: number; consequence?: string }`
  - `rollDice(count: number, sides: number, rng?: Rng): number[]`
  - `rangeMap(value: number, bands: Band[]): Band`

- [ ] **Step 1: 写失败测试 `src/dice/dice.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { rangeMap, rollDice, type Band } from "./index.js";

describe("rollDice", () => {
  test("注入定种子 rng → 确定性", () => {
    const rng = () => 0.5; // floor(0.5*6)+1 = 4
    expect(rollDice(3, 6, rng)).toEqual([4, 4, 4]);
  });
  test("count 与范围", () => {
    const seq = [0, 0.999999, 0.5];
    let i = 0;
    const rng = () => seq[i++];
    expect(rollDice(3, 20, rng)).toEqual([1, 20, 11]);
  });
  test("校验 count≥1", () => {
    expect(() => rollDice(0, 6)).toThrow();
  });
  test("校验 sides≥2", () => {
    expect(() => rollDice(1, 1)).toThrow();
  });
});

describe("rangeMap", () => {
  const bands: Band[] = [
    { label: "fail", min: 1, max: 10 },
    { label: "ok", min: 11, max: 20 },
  ];
  test("命中档", () => {
    expect(rangeMap(5, bands).label).toBe("fail");
    expect(rangeMap(11, bands).label).toBe("ok");
  });
  test("落空报错", () => {
    expect(() => rangeMap(21, bands)).toThrow();
  });
  test("区间重叠报错", () => {
    expect(() => rangeMap(5, [
      { label: "a", min: 1, max: 10 },
      { label: "b", min: 10, max: 20 },
    ])).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/dice/dice.test.ts`
Expected: FAIL（`./index.js` 模块不存在）

- [ ] **Step 3: 写实现 `src/dice/index.ts`**

```ts
export type Rng = () => number;

export interface Band {
  label: string;
  min: number;
  max: number;
  consequence?: string;
}

export function rollDice(count: number, sides: number, rng: Rng = Math.random): number[] {
  if (!Number.isInteger(count) || count < 1) throw new Error(`rollDice: count 必须 ≥1，收到 ${count}`);
  if (!Number.isInteger(sides) || sides < 2) throw new Error(`rollDice: sides 必须 ≥2，收到 ${sides}`);
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(Math.floor(rng() * sides) + 1);
  return out;
}

export function rangeMap(value: number, bands: Band[]): Band {
  if (bands.length === 0) throw new Error("rangeMap: bands 为空");
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].min > sorted[i].max) throw new Error(`rangeMap: 档位 ${sorted[i].label} min>max`);
    if (i > 0 && sorted[i].min <= sorted[i - 1].max) {
      throw new Error(`rangeMap: 档位区间重叠 ${sorted[i - 1].label}/${sorted[i].label}`);
    }
  }
  const hit = bands.find((b) => value >= b.min && value <= b.max);
  if (!hit) throw new Error(`rangeMap: 值 ${value} 落空(无覆盖档位)`);
  return hit;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/dice/dice.test.ts`
Expected: PASS（全部）

- [ ] **Step 5: Commit**

```bash
git add src/dice/
git commit -m "feat(dice): rollDice + rangeMap(RNG 注入、可单测)"
```

---

### Task 3: expr 解析(值表达式 → 项)

**Files:**
- Create: `src/expr/parse.ts`
- Test: `src/expr/parse.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `type TermKind = "dice" | "int" | "ref"`
  - `interface Term { kind: TermKind; sign: 1 | -1; raw: string; count?: number; sides?: number; intValue?: number; entity?: string; attr?: string }`
  - `parseExpr(expr: string): Term[]`(解析 `"1d20 + {张三.力量} - 2"`,不求值)

- [ ] **Step 1: 写失败测试 `src/expr/parse.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { parseExpr } from "./parse.js";

describe("parseExpr", () => {
  test("骰子 + 引用 - 整数", () => {
    const terms = parseExpr("1d20 + {张三.力量} - 2");
    expect(terms).toEqual([
      { kind: "dice", sign: 1, raw: "1d20", count: 1, sides: 20 },
      { kind: "ref", sign: 1, raw: "{张三.力量}", entity: "张三", attr: "力量" },
      { kind: "int", sign: -1, raw: "2", intValue: 2 },
    ]);
  });
  test("纯常数", () => {
    expect(parseExpr("60")).toEqual([{ kind: "int", sign: 1, raw: "60", intValue: 60 }]);
  });
  test("引用属性带前缀冒号(库存:药水)", () => {
    const terms = parseExpr("{张三.库存:药水}");
    expect(terms[0]).toMatchObject({ kind: "ref", entity: "张三", attr: "库存:药水" });
  });
  test("非法 token 报错", () => {
    expect(() => parseExpr("1d20 * 2")).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/expr/parse.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写实现 `src/expr/parse.ts`**

```ts
export type TermKind = "dice" | "int" | "ref";

export interface Term {
  kind: TermKind;
  sign: 1 | -1;
  raw: string;
  count?: number;
  sides?: number;
  intValue?: number;
  entity?: string;
  attr?: string;
}

// 先把引用 {…} 整体保护起来，再按顶层 +/- 切分
export function parseExpr(expr: string): Term[] {
  const tokens: { sign: 1 | -1; body: string }[] = [];
  let i = 0;
  let sign: 1 | -1 = 1;
  let buf = "";
  const flush = () => {
    const body = buf.trim();
    if (body) tokens.push({ sign, body });
    buf = "";
  };
  while (i < expr.length) {
    const c = expr[i];
    if (c === "{") {
      const end = expr.indexOf("}", i);
      if (end === -1) throw new Error(`parseExpr: 引用缺 '}' — ${expr}`);
      buf += expr.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    if (c === "+" || c === "-") {
      flush();
      sign = c === "+" ? 1 : -1;
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  flush();

  return tokens.map(({ sign, body }) => parseTerm(sign, body));
}

function parseTerm(sign: 1 | -1, raw: string): Term {
  const ref = raw.match(/^\{(.+?)\.(.+)\}$/);
  if (ref) return { kind: "ref", sign, raw, entity: ref[1], attr: ref[2] };
  const dice = raw.match(/^(\d+)[dD](\d+)$/);
  if (dice) return { kind: "dice", sign, raw, count: Number(dice[1]), sides: Number(dice[2]) };
  if (/^\d+$/.test(raw)) return { kind: "int", sign, raw, intValue: Number(raw) };
  throw new Error(`parseExpr: 非法项 "${raw}"(只支持 NdS / 整数 / {实体.属性} 与 +/-）`);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/expr/parse.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/expr/parse.ts src/expr/parse.test.ts
git commit -m "feat(expr): 值表达式解析(NdS/int/{ref}、只 ±)"
```

---

### Task 4: expr 求值(evalExpr + 账本)

**Files:**
- Create: `src/expr/evaluate.ts`
- Test: `src/expr/evaluate.test.ts`

**Interfaces:**
- Consumes: `parseExpr`, `Term`(Task 3);`rollDice`, `Rng`(Task 2)
- Produces:
  - `type RefGetter = (entity: string, attr: string) => string | undefined`(返回 sheet 原始文本值或 undefined)
  - `interface EvalCtx { rng?: Rng; getRef: RefGetter }`
  - `interface ExprTerm { kind: TermKind; raw: string; sign: 1 | -1; rolls?: number[]; refValue?: number; value: number }`
  - `interface ExprLedger { total: number; terms: ExprTerm[] }`
  - `evalExpr(expr: string, ctx: EvalCtx): ExprLedger`

- [ ] **Step 1: 写失败测试 `src/expr/evaluate.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { evalExpr } from "./evaluate.js";

const getRef = (e: string, a: string) => ({ "张三|力量": "7", "张三|状态": "活着" }[`${e}|${a}`]);

describe("evalExpr", () => {
  test("骰子+引用-整数,账本与总和", () => {
    const led = evalExpr("1d20 + {张三.力量} - 2", { rng: () => 0.5, getRef }); // 1d20=11
    expect(led.total).toBe(11 + 7 - 2);
    expect(led.terms).toHaveLength(3);
    expect(led.terms[0]).toMatchObject({ kind: "dice", rolls: [11], value: 11, sign: 1 });
    expect(led.terms[1]).toMatchObject({ kind: "ref", refValue: 7, value: 7 });
    expect(led.terms[2]).toMatchObject({ kind: "int", value: 2, sign: -1 });
  });
  test("引用缺失 → 报错", () => {
    expect(() => evalExpr("{李四.力量}", { getRef })).toThrow();
  });
  test("引用非数值 → 报错", () => {
    expect(() => evalExpr("{张三.状态}", { getRef })).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/expr/evaluate.test.ts`
Expected: FAIL

- [ ] **Step 3: 写实现 `src/expr/evaluate.ts`**

```ts
import { rollDice, type Rng } from "../dice/index.js";
import { parseExpr, type TermKind } from "./parse.js";

export type RefGetter = (entity: string, attr: string) => string | undefined;
export interface EvalCtx {
  rng?: Rng;
  getRef: RefGetter;
}

export interface ExprTerm {
  kind: TermKind;
  raw: string;
  sign: 1 | -1;
  rolls?: number[];
  refValue?: number;
  value: number;
}

export interface ExprLedger {
  total: number;
  terms: ExprTerm[];
}

export function evalExpr(expr: string, ctx: EvalCtx): ExprLedger {
  const terms: ExprTerm[] = parseExpr(expr).map((t) => {
    if (t.kind === "dice") {
      const rolls = rollDice(t.count!, t.sides!, ctx.rng);
      const value = rolls.reduce((a, b) => a + b, 0);
      return { kind: t.kind, raw: t.raw, sign: t.sign, rolls, value };
    }
    if (t.kind === "int") {
      return { kind: t.kind, raw: t.raw, sign: t.sign, value: t.intValue! };
    }
    const rawVal = ctx.getRef(t.entity!, t.attr!);
    if (rawVal === undefined) throw new Error(`evalExpr: 引用不存在 {${t.entity}.${t.attr}}`);
    const num = Number(rawVal);
    if (!Number.isFinite(num)) throw new Error(`evalExpr: 引用非数值 {${t.entity}.${t.attr}}="${rawVal}"`);
    return { kind: t.kind, raw: t.raw, sign: t.sign, refValue: num, value: num };
  });
  const total = terms.reduce((sum, t) => sum + t.sign * t.value, 0);
  return { total, terms };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/expr/evaluate.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/expr/evaluate.ts src/expr/evaluate.test.ts
git commit -m "feat(expr): evalExpr 求值器(回账本 total+terms,喂 L3)"
```

---

### Task 5: 谓词求值(evalPredicate → bool)

**Files:**
- Create: `src/expr/predicate.ts`
- Test: `src/expr/predicate.test.ts`

**Interfaces:**
- Consumes: `evalExpr`, `EvalCtx`(Task 4)
- Produces:
  - `type CmpOp = "<" | "<=" | ">" | ">=" | "==" | "!="`
  - `evalPredicate(pred: string, ctx: EvalCtx): boolean`(解析 `"{张三.HP} < 30"`,两边各跑 evalExpr 比大小)

- [ ] **Step 1: 写失败测试 `src/expr/predicate.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { evalPredicate } from "./predicate.js";

const getRef = (e: string, a: string) => ({ "张三|HP": "20", "世界|天": "18" }[`${e}|${a}`]);

describe("evalPredicate", () => {
  test("小于成立", () => {
    expect(evalPredicate("{张三.HP} < 30", { getRef })).toBe(true);
  });
  test("大于等于成立", () => {
    expect(evalPredicate("{世界.天} >= 18", { getRef })).toBe(true);
  });
  test("不等于", () => {
    expect(evalPredicate("{张三.HP} != 20", { getRef })).toBe(false);
  });
  test("两边都是表达式", () => {
    expect(evalPredicate("{张三.HP} <= {世界.天}", { getRef })).toBe(false);
  });
  test("缺比较算符报错", () => {
    expect(() => evalPredicate("{张三.HP}", { getRef })).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/expr/predicate.test.ts`
Expected: FAIL

- [ ] **Step 3: 写实现 `src/expr/predicate.ts`**

```ts
import { evalExpr, type EvalCtx } from "./evaluate.js";

export type CmpOp = "<" | "<=" | ">" | ">=" | "==" | "!=";
const OPS: CmpOp[] = ["<=", ">=", "==", "!=", "<", ">"]; // 长算符优先匹配

export function evalPredicate(pred: string, ctx: EvalCtx): boolean {
  let op: CmpOp | undefined;
  let idx = -1;
  for (const candidate of OPS) {
    const at = pred.indexOf(candidate);
    if (at !== -1) {
      op = candidate;
      idx = at;
      break;
    }
  }
  if (!op) throw new Error(`evalPredicate: 缺比较算符 — "${pred}"`);
  const left = evalExpr(pred.slice(0, idx).trim(), ctx).total;
  const right = evalExpr(pred.slice(idx + op.length).trim(), ctx).total;
  switch (op) {
    case "<": return left < right;
    case "<=": return left <= right;
    case ">": return left > right;
    case ">=": return left >= right;
    case "==": return left === right;
    case "!=": return left !== right;
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/expr/predicate.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/expr/predicate.ts src/expr/predicate.test.ts
git commit -m "feat(expr): evalPredicate(watcher 条件,两边 evalExpr 比大小)"
```

---

### Task 6: DB 开库 + 四域 schema 初始化

**Files:**
- Create: `src/store/db.ts`
- Test: `src/store/db.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `type DB = Database.Database`(re-export better-sqlite3 类型)
  - `openDb(path: string): DB`(`:memory:` 用于测试)
  - `initSchema(db: DB): void`(幂等建四域表 + pending_choice 槽;event 为普通表、无 FTS)

- [ ] **Step 1: 写失败测试 `src/store/db.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { initSchema, openDb } from "./db.js";

describe("schema", () => {
  test("初始化建出四域表", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    for (const t of ["sheet", "event", "watcher", "world_doc", "world_pool", "rule_doc", "session_meta", "pending_choice"]) {
      expect(names).toContain(t);
    }
  });
  test("幂等:重复 initSchema 不报错", () => {
    const db = openDb(":memory:");
    initSchema(db);
    expect(() => initSchema(db)).not.toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/store/db.test.ts`
Expected: FAIL

- [ ] **Step 3: 写实现 `src/store/db.ts`**

```ts
import Database from "better-sqlite3";

export type DB = Database.Database;

export function openDb(path: string): DB {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

// 幂等建表。event 在本 plan 是普通表(全文检索归 Plan 2)。
export function initSchema(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sheet (
      entity TEXT NOT NULL, attr TEXT NOT NULL, value TEXT NOT NULL,
      visible INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (entity, attr)
    );
    CREATE TABLE IF NOT EXISTS event (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT, kind TEXT NOT NULL, data_json TEXT, tags TEXT,
      visible INTEGER NOT NULL DEFAULT 1, game_time TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS watcher (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_seq INTEGER, condition TEXT NOT NULL, payload TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'once', armed INTEGER NOT NULL DEFAULT 1,
      last_fired_seq INTEGER, status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS world_doc (
      name TEXT, content TEXT, category TEXT, tags TEXT, visible INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS world_pool (
      pool TEXT, row_json TEXT, weight REAL NOT NULL DEFAULT 1, source TEXT NOT NULL DEFAULT 'author',
      visible INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS rule_doc (
      name TEXT, content TEXT, category TEXT, version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS session_meta ( key TEXT PRIMARY KEY, value TEXT );
    CREATE TABLE IF NOT EXISTS pending_choice (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      seq_staged INTEGER, prompt TEXT, options_json TEXT, status TEXT
    );
  `);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/store/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/db.ts src/store/db.test.ts
git commit -m "feat(store): 开库 + 四域 schema 幂等初始化(event 暂普通表)"
```

---

### Task 7: sheet store(get / list / setRaw)

**Files:**
- Create: `src/store/sheet.ts`
- Test: `src/store/sheet.test.ts`

**Interfaces:**
- Consumes: `DB`, `openDb`, `initSchema`(Task 6)
- Produces:
  - `interface Cell { entity: string; attr: string; value: string; visible: number }`
  - `sheetGet(db: DB, entity: string, attr: string): Cell | undefined`
  - `sheetList(db: DB, prefix: string): Cell[]`(`prefix` 形如 `"张三."` 取整卡、`"张三.库存:"` 取整库存)
  - `sheetSetRaw(db: DB, entity: string, attr: string, value: string, visible?: number): void`(UPSERT,不解析 expr;visible 缺省保留旧值或 0)

- [ ] **Step 1: 写失败测试 `src/store/sheet.test.ts`**

```ts
import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import { sheetGet, sheetList, sheetSetRaw } from "./sheet.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("sheet store", () => {
  test("set 后 get", () => {
    sheetSetRaw(db, "张三", "力量", "7", 1);
    expect(sheetGet(db, "张三", "力量")).toEqual({ entity: "张三", attr: "力量", value: "7", visible: 1 });
  });
  test("UPSERT 覆盖值,缺省 visible 保留旧值", () => {
    sheetSetRaw(db, "张三", "HP", "30", 1);
    sheetSetRaw(db, "张三", "HP", "20");
    expect(sheetGet(db, "张三", "HP")).toMatchObject({ value: "20", visible: 1 });
  });
  test("list 按前缀(整卡 / 库存子集)", () => {
    sheetSetRaw(db, "张三", "力量", "7");
    sheetSetRaw(db, "张三", "库存:药水", "3");
    sheetSetRaw(db, "李四", "力量", "5");
    expect(sheetList(db, "张三.").map((c) => c.attr).sort()).toEqual(["力量", "库存:药水"]);
    expect(sheetList(db, "张三.库存:").map((c) => c.attr)).toEqual(["库存:药水"]);
  });
  test("get 缺失返回 undefined", () => {
    expect(sheetGet(db, "无", "无")).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/store/sheet.test.ts`
Expected: FAIL

- [ ] **Step 3: 写实现 `src/store/sheet.ts`**

```ts
import type { DB } from "./db.js";

export interface Cell {
  entity: string;
  attr: string;
  value: string;
  visible: number;
}

export function sheetGet(db: DB, entity: string, attr: string): Cell | undefined {
  const row = db.prepare("SELECT entity, attr, value, visible FROM sheet WHERE entity=? AND attr=?").get(entity, attr);
  return row as Cell | undefined;
}

// prefix 形如 "张三." 或 "张三.库存:"。约定:prefix 以 "." 分隔 entity 与 attr 前缀。
export function sheetList(db: DB, prefix: string): Cell[] {
  const dot = prefix.indexOf(".");
  if (dot === -1) throw new Error(`sheetList: prefix 需含 '.'(如 "张三." )— 收到 "${prefix}"`);
  const entity = prefix.slice(0, dot);
  const attrPrefix = prefix.slice(dot + 1);
  const rows = db
    .prepare("SELECT entity, attr, value, visible FROM sheet WHERE entity=? AND attr LIKE ? ESCAPE '\\' ORDER BY attr")
    .all(entity, likePrefix(attrPrefix));
  return rows as Cell[];
}

function likePrefix(p: string): string {
  const escaped = p.replace(/[\\%_]/g, (m) => "\\" + m);
  return escaped + "%";
}

export function sheetSetRaw(db: DB, entity: string, attr: string, value: string, visible?: number): void {
  if (visible === undefined) {
    db.prepare(
      `INSERT INTO sheet (entity, attr, value, visible) VALUES (?, ?, ?, 0)
       ON CONFLICT(entity, attr) DO UPDATE SET value=excluded.value`,
    ).run(entity, attr, value);
  } else {
    db.prepare(
      `INSERT INTO sheet (entity, attr, value, visible) VALUES (?, ?, ?, ?)
       ON CONFLICT(entity, attr) DO UPDATE SET value=excluded.value, visible=excluded.visible`,
    ).run(entity, attr, value, visible);
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/store/sheet.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/sheet.ts src/store/sheet.test.ts
git commit -m "feat(store): sheet get/list(前缀扫)/setRaw(UPSERT)"
```

---

### Task 8: event store(append + 读区间)

**Files:**
- Create: `src/store/event.ts`
- Test: `src/store/event.test.ts`

**Interfaces:**
- Consumes: `DB`(Task 6)
- Produces:
  - `type EventKind = "narrate" | "verdict" | "mutation" | "note" | "watcher_fired" | "reveal" | "choice"`
  - `interface EventInput { content?: string; kind: EventKind; data_json?: unknown; tags?: string; visible?: number; game_time?: string }`
  - `interface EventRow { seq: number; content: string | null; kind: EventKind; data_json: string | null; tags: string | null; visible: number; game_time: string | null; created_at: string }`
  - `eventAppend(db: DB, ev: EventInput): number`(返回 seq;visible 缺省按 kind:note=0、其余=1)
  - `eventSince(db: DB, sinceSeq: number): EventRow[]`(取 seq > sinceSeq 的事件,供 L3 圈本轮)

- [ ] **Step 1: 写失败测试 `src/store/event.test.ts`**

```ts
import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import { eventAppend, eventSince } from "./event.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("event store", () => {
  test("append 返回单调 seq", () => {
    const s1 = eventAppend(db, { kind: "narrate", content: "天黑了" });
    const s2 = eventAppend(db, { kind: "verdict", data_json: { winner: "a" } });
    expect(s2).toBe(s1 + 1);
  });
  test("visible 默认按 kind(note=0、narrate=1)", () => {
    eventAppend(db, { kind: "note", content: "GM 私记" });
    eventAppend(db, { kind: "narrate", content: "可见" });
    const rows = eventSince(db, 0);
    expect(rows.find((r) => r.kind === "note")!.visible).toBe(0);
    expect(rows.find((r) => r.kind === "narrate")!.visible).toBe(1);
  });
  test("data_json 往返", () => {
    eventAppend(db, { kind: "mutation", data_json: { applied: [{ attr: "HP", delta: -5 }] } });
    const row = eventSince(db, 0)[0];
    expect(JSON.parse(row.data_json!)).toEqual({ applied: [{ attr: "HP", delta: -5 }] });
  });
  test("eventSince 只取区间后", () => {
    eventAppend(db, { kind: "narrate", content: "a" });
    const mark = eventAppend(db, { kind: "narrate", content: "b" });
    eventAppend(db, { kind: "narrate", content: "c" });
    expect(eventSince(db, mark).map((r) => r.content)).toEqual(["c"]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/store/event.test.ts`
Expected: FAIL

- [ ] **Step 3: 写实现 `src/store/event.ts`**

```ts
import type { DB } from "./db.js";

export type EventKind = "narrate" | "verdict" | "mutation" | "note" | "watcher_fired" | "reveal" | "choice";

export interface EventInput {
  content?: string;
  kind: EventKind;
  data_json?: unknown;
  tags?: string;
  visible?: number;
  game_time?: string;
}

export interface EventRow {
  seq: number;
  content: string | null;
  kind: EventKind;
  data_json: string | null;
  tags: string | null;
  visible: number;
  game_time: string | null;
  created_at: string;
}

function defaultVisible(kind: EventKind): number {
  return kind === "note" ? 0 : 1;
}

export function eventAppend(db: DB, ev: EventInput): number {
  const visible = ev.visible ?? defaultVisible(ev.kind);
  const info = db
    .prepare(
      "INSERT INTO event (content, kind, data_json, tags, visible, game_time) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      ev.content ?? null,
      ev.kind,
      ev.data_json === undefined ? null : JSON.stringify(ev.data_json),
      ev.tags ?? null,
      visible,
      ev.game_time ?? null,
    );
  return Number(info.lastInsertRowid);
}

export function eventSince(db: DB, sinceSeq: number): EventRow[] {
  return db.prepare("SELECT * FROM event WHERE seq > ? ORDER BY seq").all(sinceSeq) as EventRow[];
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/store/event.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/event.ts src/store/event.test.ts
git commit -m "feat(store): event append(seq 单调、visible 按 kind)+ eventSince"
```

---

### Task 9: watcher store(创建 / 列 / 就地重算)

**Files:**
- Create: `src/store/watcher.ts`
- Test: `src/store/watcher.test.ts`

**Interfaces:**
- Consumes: `DB`(Task 6);`evalPredicate`, `EvalCtx`(Task 5);`eventAppend`(Task 8)
- Produces:
  - `interface WatcherRow { id: number; condition: string; payload: string; mode: "once" | "repeat"; armed: number; status: string }`
  - `watcherSet(db: DB, opts: { condition: string; payload: string; mode?: "once" | "repeat"; created_seq?: number }): number`
  - `watcherList(db: DB): WatcherRow[]`(只 `status='active'`)
  - `recomputeWatchers(db: DB, ctx: EvalCtx): { id: number; payload: string }[]`(对所有 active watcher:`armed ∧ condition` → 触发(落 watcher_fired event、armed→0、once 则 status→fired);`¬armed ∧ ¬condition ∧ repeat` → re-arm。返回本次触发列表)

- [ ] **Step 1: 写失败测试 `src/store/watcher.test.ts`**

```ts
import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import { recomputeWatchers, watcherList, watcherSet } from "./watcher.js";
import { eventSince } from "./event.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

const ctxWith = (hp: number) => ({ getRef: (_e: string, _a: string) => String(hp) });

describe("watcher", () => {
  test("条件满足 → 触发一次、落 watcher_fired、armed→0", () => {
    watcherSet(db, { condition: "{张三.HP} < 30", payload: "濒死!" });
    const fired = recomputeWatchers(db, ctxWith(20));
    expect(fired).toEqual([{ id: 1, payload: "濒死!" }]);
    expect(eventSince(db, 0).some((r) => r.kind === "watcher_fired")).toBe(true);
    // 再次重算(仍满足)不重复触发(edge)
    expect(recomputeWatchers(db, ctxWith(20))).toEqual([]);
  });
  test("once 触发后 status→fired,不再出现在 active 列表", () => {
    watcherSet(db, { condition: "{张三.HP} < 30", payload: "x", mode: "once" });
    recomputeWatchers(db, ctxWith(20));
    expect(watcherList(db)).toHaveLength(0);
  });
  test("repeat 条件解除后 re-arm,可再次触发", () => {
    watcherSet(db, { condition: "{张三.HP} < 30", payload: "low", mode: "repeat" });
    expect(recomputeWatchers(db, ctxWith(20))).toHaveLength(1); // 触发
    expect(recomputeWatchers(db, ctxWith(50))).toHaveLength(0); // 解除 → re-arm
    expect(recomputeWatchers(db, ctxWith(20))).toHaveLength(1); // 再触发
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/store/watcher.test.ts`
Expected: FAIL

- [ ] **Step 3: 写实现 `src/store/watcher.ts`**

```ts
import { evalPredicate, type EvalCtx } from "../expr/predicate.js";
import { eventAppend } from "./event.js";
import type { DB } from "./db.js";

export interface WatcherRow {
  id: number;
  condition: string;
  payload: string;
  mode: "once" | "repeat";
  armed: number;
  status: string;
}

export function watcherSet(
  db: DB,
  opts: { condition: string; payload: string; mode?: "once" | "repeat"; created_seq?: number },
): number {
  const info = db
    .prepare(
      "INSERT INTO watcher (created_seq, condition, payload, mode, armed, status) VALUES (?, ?, ?, ?, 1, 'active')",
    )
    .run(opts.created_seq ?? null, opts.condition, opts.payload, opts.mode ?? "once");
  return Number(info.lastInsertRowid);
}

export function watcherList(db: DB): WatcherRow[] {
  return db.prepare("SELECT * FROM watcher WHERE status='active'").all() as WatcherRow[];
}

// edge-triggered:armed∧cond→触发；¬armed∧¬cond∧repeat→re-arm。
export function recomputeWatchers(db: DB, ctx: EvalCtx): { id: number; payload: string }[] {
  const fired: { id: number; payload: string }[] = [];
  for (const w of watcherList(db)) {
    const cond = evalPredicate(w.condition, ctx);
    if (w.armed === 1 && cond) {
      const seq = eventAppend(db, { kind: "watcher_fired", content: w.payload, data_json: { watcher_id: w.id } });
      if (w.mode === "once") {
        db.prepare("UPDATE watcher SET armed=0, last_fired_seq=?, status='fired' WHERE id=?").run(seq, w.id);
      } else {
        db.prepare("UPDATE watcher SET armed=0, last_fired_seq=? WHERE id=?").run(seq, w.id);
      }
      fired.push({ id: w.id, payload: w.payload });
    } else if (w.armed === 0 && !cond && w.mode === "repeat") {
      db.prepare("UPDATE watcher SET armed=1 WHERE id=?").run(w.id);
    }
  }
  return fired;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/store/watcher.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/watcher.ts src/store/watcher.test.ts
git commit -m "feat(store): watcher 创建/列/就地重算(edge-triggered + once/repeat)"
```

---

### Task 10: applyMutations(批量写 + 账本 + 触发 watcher)

**Files:**
- Create: `src/store/mutate.ts`
- Test: `src/store/mutate.test.ts`

**Interfaces:**
- Consumes: `DB`(6);`sheetGet`/`sheetSetRaw`(7);`evalExpr`/`EvalCtx`/`RefGetter`(4);`eventAppend`(8);`recomputeWatchers`(9);`Rng`(2)
- Produces:
  - `type MutOp = "+" | "-" | "=";`
  - `interface Mutation { attr: string; op: MutOp; expr: string }`
  - `interface MutationApplied { attr: string; op: MutOp; expr: string; kind: "rolled" | "set"; old: string | null; rolls?: number[]; delta?: number; new: string }`
  - `interface MutationResult { entity: string; applied: MutationApplied[]; fired_watchers: { id: number; payload: string }[]; event_id: number }`
  - `applyMutations(db: DB, entity: string, mutations: Mutation[], opts?: { rng?: Rng }): MutationResult`
  - 派发规则(op × expr 类型):值表达式 `+`/`-` → 标量算术(读旧值数字 ± evalExpr);`=` → 赋数(evalExpr,带骰先掷);词条字面量 `小刀*N` 配 `+`/`-` → 集合增减(`attr:词条` cell ±N,减到 0 删);词条配 `=` → 赋文本。`kind`:含骰子=`rolled`,否则 `set`。整批一个事务,任一项报错回滚。LHS `attr` 裸名归本 entity;`expr` 中 `{}` 引用从 db 读真值。

- [ ] **Step 1: 写失败测试 `src/store/mutate.test.ts`**

```ts
import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import { sheetGet, sheetSetRaw } from "./sheet.js";
import { applyMutations } from "./mutate.js";
import { watcherSet } from "./watcher.js";
import { eventSince } from "./event.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("applyMutations", () => {
  test("标量减(带骰)→ rolled 账本 + 写回", () => {
    sheetSetRaw(db, "张三", "HP", "30");
    const r = applyMutations(db, "张三", [{ attr: "HP", op: "-", expr: "1d6" }], { rng: () => 0 }); // 1d6=1
    expect(r.applied[0]).toMatchObject({ attr: "HP", kind: "rolled", old: "30", new: "29", rolls: [1] });
    expect(sheetGet(db, "张三", "HP")!.value).toBe("29");
  });
  test("赋数(=,无骰)→ set 账本", () => {
    const r = applyMutations(db, "张三", [{ attr: "金币", op: "=", expr: "100" }]);
    expect(r.applied[0]).toMatchObject({ kind: "set", old: null, new: "100" });
  });
  test("引用他者属性", () => {
    sheetSetRaw(db, "李四", "力量", "5");
    const r = applyMutations(db, "张三", [{ attr: "攻击", op: "=", expr: "{李四.力量} + 2" }]);
    expect(r.applied[0].new).toBe("7");
  });
  test("集合增(词条) → attr:词条 +N", () => {
    applyMutations(db, "张三", [{ attr: "库存", op: "+", expr: "药水*3" }]);
    expect(sheetGet(db, "张三", "库存:药水")!.value).toBe("3");
  });
  test("集合减到 0 删 cell", () => {
    sheetSetRaw(db, "张三", "库存:药水", "2");
    applyMutations(db, "张三", [{ attr: "库存", op: "-", expr: "药水*2" }]);
    expect(sheetGet(db, "张三", "库存:药水")).toBeUndefined();
  });
  test("赋文本", () => {
    const r = applyMutations(db, "张三", [{ attr: "状态", op: "=", expr: "中毒" }]);
    expect(r.applied[0].new).toBe("中毒");
  });
  test("非数值算术 → 整批回滚", () => {
    sheetSetRaw(db, "张三", "状态", "活着");
    expect(() => applyMutations(db, "张三", [
      { attr: "HP", op: "=", expr: "10" },
      { attr: "状态", op: "-", expr: "1" },
    ])).toThrow();
    expect(sheetGet(db, "张三", "HP")).toBeUndefined(); // 回滚:第一项也没写进
  });
  test("写完触发 watcher,结果带 fired_watchers", () => {
    sheetSetRaw(db, "张三", "HP", "30");
    watcherSet(db, { condition: "{张三.HP} < 10", payload: "濒死" });
    const r = applyMutations(db, "张三", [{ attr: "HP", op: "=", expr: "5" }]);
    expect(r.fired_watchers).toEqual([{ id: 1, payload: "濒死" }]);
    expect(eventSince(db, 0).some((e) => e.kind === "mutation")).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/store/mutate.test.ts`
Expected: FAIL

- [ ] **Step 3: 写实现 `src/store/mutate.ts`**

```ts
import type { Rng } from "../dice/index.js";
import { evalExpr, type RefGetter } from "../expr/evaluate.js";
import type { DB } from "./db.js";
import { sheetGet, sheetSetRaw } from "./sheet.js";
import { eventAppend } from "./event.js";
import { recomputeWatchers } from "./watcher.js";

export type MutOp = "+" | "-" | "=";

export interface Mutation {
  attr: string;
  op: MutOp;
  expr: string;
}

export interface MutationApplied {
  attr: string;
  op: MutOp;
  expr: string;
  kind: "rolled" | "set";
  old: string | null;
  rolls?: number[];
  delta?: number;
  new: string;
}

export interface MutationResult {
  entity: string;
  applied: MutationApplied[];
  fired_watchers: { id: number; payload: string }[];
  event_id: number;
}

// 词条字面量:形如 "药水*3"(成员名*数量)或 "药水"(数量默认 1)
function parseMember(expr: string): { name: string; qty: number } | null {
  const m = expr.match(/^(.+?)\*(\d+)$/);
  if (m) return { name: m[1].trim(), qty: Number(m[2]) };
  if (/^\{.*\}$/.test(expr) || /[+\-]/.test(expr) || /^\d+$/.test(expr) || /^\d+[dD]\d+$/.test(expr)) return null;
  return { name: expr.trim(), qty: 1 };
}

export function applyMutations(
  db: DB,
  entity: string,
  mutations: Mutation[],
  opts?: { rng?: Rng },
): MutationResult {
  const getRef: RefGetter = (e, a) => sheetGet(db, e, a)?.value;
  const ctx = { rng: opts?.rng, getRef };

  const txn = db.transaction(() => {
    const applied: MutationApplied[] = [];
    for (const m of mutations) {
      const member = (m.op === "+" || m.op === "-" || m.op === "=") ? parseMember(m.expr) : null;

      // 词条分支:集合增减 / 赋文本
      if (member && (m.op === "+" || m.op === "-")) {
        const cellAttr = `${m.attr}:${member.name}`;
        const old = sheetGet(db, entity, cellAttr)?.value ?? null;
        const oldN = old === null ? 0 : toNum(old, cellAttr);
        const next = oldN + (m.op === "+" ? member.qty : -member.qty);
        if (next <= 0) db.prepare("DELETE FROM sheet WHERE entity=? AND attr=?").run(entity, cellAttr);
        else sheetSetRaw(db, entity, cellAttr, String(next));
        applied.push({ attr: cellAttr, op: m.op, expr: m.expr, kind: "set", old, delta: m.op === "+" ? member.qty : -member.qty, new: String(Math.max(next, 0)) });
        continue;
      }
      if (member && m.op === "=") {
        const old = sheetGet(db, entity, m.attr)?.value ?? null;
        sheetSetRaw(db, entity, m.attr, member.name);
        applied.push({ attr: m.attr, op: m.op, expr: m.expr, kind: "set", old, new: member.name });
        continue;
      }

      // 值表达式分支:标量算术 / 赋数
      const led = evalExpr(m.expr, ctx);
      const hasDice = led.terms.some((t) => t.kind === "dice");
      const old = sheetGet(db, entity, m.attr)?.value ?? null;
      let nextNum: number;
      if (m.op === "=") {
        nextNum = led.total;
      } else {
        const oldN = old === null ? 0 : toNum(old, m.attr);
        nextNum = oldN + (m.op === "+" ? led.total : -led.total);
      }
      sheetSetRaw(db, entity, m.attr, String(nextNum));
      applied.push({
        attr: m.attr, op: m.op, expr: m.expr,
        kind: hasDice ? "rolled" : "set",
        old, rolls: hasDice ? led.terms.flatMap((t) => t.rolls ?? []) : undefined,
        delta: m.op === "=" ? undefined : (m.op === "+" ? led.total : -led.total),
        new: String(nextNum),
      });
    }
    const event_id = eventAppend(db, { kind: "mutation", data_json: { entity, applied } });
    const fired_watchers = recomputeWatchers(db, ctx);
    return { entity, applied, fired_watchers, event_id };
  });

  return txn();
}

function toNum(raw: string, attr: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`applyMutations: ${attr}="${raw}" 非数值,不能做算术`);
  return n;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/store/mutate.test.ts`
Expected: PASS（含回滚用例:better-sqlite3 的 `db.transaction` 抛错自动回滚）

- [ ] **Step 5: Commit**

```bash
git add src/store/mutate.ts src/store/mutate.test.ts
git commit -m "feat(store): applyMutations(op×expr 派发、原子事务、账本、触发 watcher)"
```

---

### Task 11: session 解析 + 建库 + 瘦 CLI

**Files:**
- Create: `src/session/resolve.ts`
- Create: `src/cli.ts`
- Test: `src/session/resolve.test.ts`

**Interfaces:**
- Consumes: `openDb`/`initSchema`(6)
- Produces:
  - `sessionDbPath(name: string): string`(平台 app-data:`DICELORE_SESSIONS_DIR` 覆盖,否则 `os.homedir()` 下平台约定目录 + `dicelore/sessions/<name>.db`)
  - `openSession(name?: string): { db: DB; name: string; path: string }`(env `DICELORE_SESSION` 缺省名;开库 + initSchema + 写 session_meta 的 created_at/display_name/schema_version)
  - `metaGet(db, key)` / `metaSet(db, key, value)`
  - CLI:`new <name>` / `list` / `inspect <name>`

- [ ] **Step 1: 写失败测试 `src/session/resolve.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { metaGet, openSession, sessionDbPath } from "./resolve.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "dicelore-")); process.env.DICELORE_SESSIONS_DIR = dir; });
afterEach(() => { delete process.env.DICELORE_SESSIONS_DIR; rmSync(dir, { recursive: true, force: true }); });

describe("session", () => {
  test("DICELORE_SESSIONS_DIR 覆盖根目录", () => {
    expect(sessionDbPath("修仙团")).toBe(join(dir, "dicelore", "sessions", "修仙团.db"));
  });
  test("openSession 建库 + 写 meta", () => {
    const s = openSession("修仙团");
    expect(s.name).toBe("修仙团");
    expect(metaGet(s.db, "display_name")).toBe("修仙团");
    expect(metaGet(s.db, "schema_version")).toBe("1");
    expect(metaGet(s.db, "created_at")).toBeTruthy();
  });
  test("不存在即建、再开同名复用", () => {
    openSession("团A").db.prepare("INSERT INTO sheet VALUES ('x','y','1',0)").run();
    const again = openSession("团A");
    expect(again.db.prepare("SELECT value FROM sheet WHERE entity='x'").get()).toMatchObject({ value: "1" });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/session/resolve.test.ts`
Expected: FAIL

- [ ] **Step 3: 写实现 `src/session/resolve.ts`**

```ts
import { mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { initSchema, openDb, type DB } from "../store/db.js";

const SCHEMA_VERSION = "1";

function appDataRoot(): string {
  if (process.env.DICELORE_SESSIONS_DIR) return process.env.DICELORE_SESSIONS_DIR;
  const home = homedir();
  switch (platform()) {
    case "win32": return process.env.APPDATA ?? join(home, "AppData", "Roaming");
    case "darwin": return join(home, "Library", "Application Support");
    default: return process.env.XDG_DATA_HOME ?? join(home, ".local", "share");
  }
}

export function sessionDbPath(name: string): string {
  return join(appDataRoot(), "dicelore", "sessions", `${name}.db`);
}

export function metaGet(db: DB, key: string): string | undefined {
  const row = db.prepare("SELECT value FROM session_meta WHERE key=?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function metaSet(db: DB, key: string, value: string): void {
  db.prepare(
    "INSERT INTO session_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  ).run(key, value);
}

export function openSession(name?: string): { db: DB; name: string; path: string } {
  const sessionName = name ?? process.env.DICELORE_SESSION ?? "default";
  const path = sessionDbPath(sessionName);
  mkdirSync(dirname(path), { recursive: true });
  const db = openDb(path);
  initSchema(db);
  if (!metaGet(db, "created_at")) metaSet(db, "created_at", new Date().toISOString());
  metaSet(db, "display_name", sessionName);
  metaSet(db, "schema_version", SCHEMA_VERSION);
  return { db, name: sessionName, path };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/session/resolve.test.ts`
Expected: PASS

- [ ] **Step 5: 写瘦 CLI `src/cli.ts`**

```ts
import { readdirSync } from "node:fs";
import { dirname } from "node:path";
import { metaGet, openSession, sessionDbPath } from "./session/resolve.js";

const [cmd, arg] = process.argv.slice(2);

switch (cmd) {
  case "new": {
    if (!arg) throw new Error("用法: dicelore new <name>");
    const s = openSession(arg);
    console.log(`已建/打开会话 ${s.name} → ${s.path}`);
    break;
  }
  case "list": {
    const dir = dirname(sessionDbPath("_"));
    let files: string[] = [];
    try { files = readdirSync(dir).filter((f) => f.endsWith(".db")); } catch { /* 目录不存在 */ }
    console.log(files.length ? files.map((f) => "  " + f.replace(/\.db$/, "")).join("\n") : "(无会话)");
    break;
  }
  case "inspect": {
    if (!arg) throw new Error("用法: dicelore inspect <name>");
    const { db } = openSession(arg);
    const sheets = (db.prepare("SELECT COUNT(*) c FROM sheet").get() as { c: number }).c;
    const events = (db.prepare("SELECT COUNT(*) c FROM event").get() as { c: number }).c;
    console.log(`会话 ${arg}: 团本=${metaGet(db, "team_id") ?? "(未灌注)"} sheets=${sheets} events=${events}`);
    break;
  }
  default:
    console.log("命令: new <name> | list | inspect <name>");
}
```

- [ ] **Step 6: 手动验证 CLI**

Run: `DICELORE_SESSIONS_DIR=$(mktemp -d) npx tsx src/cli.ts new 测试团 && DICELORE_SESSIONS_DIR=$(mktemp -d) npx tsx src/cli.ts list`
Expected: 第一条打印"已建/打开会话 测试团 → …";list 命令打印会话名或"(无会话)"(注:两条用了不同临时目录,list 显示"(无会话)"正常,只验证不报错)。

- [ ] **Step 7: 跑全量测试确认无回归**

Run: `npx vitest run`
Expected: 所有 task 的测试全 PASS

- [ ] **Step 8: Commit**

```bash
git add src/session/ src/cli.ts
git commit -m "feat(session): env 定位 + 建库 + session_meta + 瘦 CLI(new/list/inspect)"
```

---

## 本 plan 之外(留后续 plan)

- **Plan 2 检索与世界域**:FTS5 + `@node-rs/jieba` 影子列、event/rule 全文搜索、`world_doc`/`world_pool` 读写、`world_sample` 加权抽样、`world_register`、`reveal_once`/`show` 可见性写。
- **后续**:MCP 工具面(组件2,把本层包成 `dicelore_*` 工具 + Zod schema)、Skills 包(组件3,markdown)、adapter(组件4,hook + 呈现模型生成器)、团本 import + 构建台(组件5/6)。
- 本 plan 的 `sheet.visible` 列与 `pending_choice` 槽已建表,但其写/读语义(`sheet_show`/物化)归 MCP/adapter plan。
