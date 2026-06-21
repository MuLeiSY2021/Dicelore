# 玩家闸控明骰（core 侧）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `@dicelore/core` 落地玩家闸控明骰的 core 侧——`pending_roll` 槽 + `commitPendingRoll`(幂等) + roll-gate 接缝 + 两个 `resolve_*_open` 阻塞工具 + 现有两工具改名 `_hidden` + gm-core「谁掷」skill 指引。

**Architecture:** 明骰 = 阻塞式 MCP 调用:handler 暂存 `pending_roll`(规格,无结果)→ 有 roll-gate(组件7 注入)则 await 玩家点击、无则当场降级 → `commitPendingRoll` 此刻掷 + 写 `kind=verdict` event → 回合内返回。点数恒由引擎在 commit 时算(anti-F1)。`commitPendingRoll` 复用既有 `resolveOutcome`/`resolveContest`(DRY),幂等(已 committed 据 verdict event 重建,供宕机恢复)。

**Tech Stack:** TypeScript(ESM)、better-sqlite3、vitest、tsx、@modelcontextprotocol/sdk。无构建步骤(tsx 直跑)。

## Global Constraints

- 上游权威:[玩家闸控明骰设计](2026-06-21-player-gated-roll-design.md)(§2 工具/§3 机制/§9 不变量)、[内层能力库 §3.3/§4.2](../../wiki/04-子系统设计/内层能力库.md)(`pending_roll`/`commitPendingRoll` 语义)、[MCP工具面](../../wiki/04-子系统设计/MCP工具面.md)(4 工具 schema)、[Skills包 §2.4](../../wiki/04-子系统设计/Skills包.md)。
- 所有改动落 `packages/core/`;`src/…` = `packages/core/src/…`,`skills/…` = `packages/core/skills/…`。
- ESM:源内相对 import **必须带 `.js` 后缀**(即便文件是 `.ts`)。测试用 vitest + `openDb(":memory:")` + `initSchema(db)`。
- **anti-F1 红线**:点数恒由引擎在 commit 时计算;`pending_roll` 只存规格、无结果;`commitPendingRoll` 接受注入 `rng` 仅供单测,生产默认 `Math.random`。
- **本计划范围边界(不做,归别线)**:`awaitPlayerRoll`/roll-gate 的**实现**(阻塞/WS 桥接)、`POST /sessions/{id}/roll` 端点、BG3 掷骰卡 UI、宕机恢复重驱 GM、`packages/shared` 线上契约 —— 全归**组件7 线**;本计划只造 core 接缝(`setRollGate`/`getRollGate`)、可单测原语、工具。
- 提交频繁,每 Task 末提交;commit message 末尾加 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。

**可复用的已有能力**:`store/db.ts`→`DB`/`openDb`/`initSchema`;`store/event.ts`→`eventAppend(db,{kind,content,data_json,visible})`/`eventSince`/`EventRow`;`resolve/outcome.ts`→`resolveOutcome(die,bands,rng?)→{roll,die,band}`;`resolve/contest.ts`→`resolveContest(db,a,b,rng?)→{a:{name,ledger},b:{name,ledger},winner}`;`dice/index.ts`→`Rng`;`mcp/handlers/resolver.ts`(现有 resolver 工具)、`mcp/runTool.ts`、`mcp/tools.ts`、`mcp/reminders.ts`。

---

## 文件结构（先锁分解）

```
packages/core/src/
  store/
    db.ts                 ← 改:initSchema 加 pending_roll 表
    pendingRoll.ts        ← 新:stagePendingRoll / getPendingRoll(仿 choice.ts)
    pendingRoll.test.ts   ← 新
  resolve/
    commitRoll.ts         ← 新:commitPendingRoll(db,eventId,rng?)→RollResult + RollResult 类型
    commitRoll.test.ts    ← 新
  mcp/
    rollGate.ts           ← 新:setRollGate/getRollGate 接缝(模块级单例)
    rollGate.test.ts      ← 新
    runTool.ts            ← 改:async,await handler(支持明骰 async handler)
    runTool.test.ts       ← 改:await
    schemas/resolver.ts   ← 改:现有 outcome/contest 名不变(schema 复用),加 *_open 的 out schema(带 awaiting)
    handlers/resolver.ts  ← 改:现有两工具 name→_hidden;加两 *_open async handler;注册
    handlers/resolver.test.ts ← 改:旧名→_hidden;加 *_open 测试
    reminders.ts          ← 改:case "resolve_outcome"→"resolve_outcome_hidden"(+_open 同挂)
    reminders.test.ts     ← 改:旧名→_hidden
    tools.test.ts         ← 改:工具清单加 _hidden/_open
  skills/dicelore-gm-core/
    SKILL.md              ← 改:Moves 加「谁掷」+ Principle(明骰默认簇)
    references/moves-full.md ← 改:补明/暗骰边角(可选,随 SKILL 改)
```

**分解理由**:`pending_roll` 槽(store 纯 CRUD)与 `commitPendingRoll`(③ 编排)分文件、各自可单测;roll-gate 接缝独立小模块;改名(T4)与加 `_open`(T5)都动 `handlers/resolver.ts`,**顺序执行**(先改名后加,避免交错);skill 是纯 markdown、独立。

---

### Task 1: `pending_roll` 槽（schema + stage/get）

**Files:**
- Modify: `packages/core/src/store/db.ts`（`initSchema` 加表）
- Create: `packages/core/src/store/pendingRoll.ts`
- Test: `packages/core/src/store/pendingRoll.test.ts`

**Interfaces:**
- Consumes: `store/db.ts`→`DB`。
- Produces:
  ```ts
  type RollShape = "outcome" | "contest";
  interface RollSpec { context: string; die?: string; bands?: unknown[]; a?: unknown; b?: unknown }
  interface PendingRollRow { eventId: number; shape: RollShape; spec: RollSpec; status: "awaiting" | "committed"; verdictSeq: number | null }
  function stagePendingRoll(db: DB, input: { shape: RollShape; spec: RollSpec }): number  // 返回 eventId(自增句柄)
  function getPendingRoll(db: DB, eventId: number): PendingRollRow | undefined
  function markRollCommitted(db: DB, eventId: number, verdictSeq: number): void
  ```

- [ ] **Step 1: 写失败测试**

```ts
// packages/core/src/store/pendingRoll.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "./db.js";
import { stagePendingRoll, getPendingRoll, markRollCommitted } from "./pendingRoll.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }

describe("pending_roll 槽", () => {
  it("stage 返回自增 eventId,get 回读规格、status=awaiting、verdictSeq=null", () => {
    const db = freshDb();
    const id = stagePendingRoll(db, { shape: "contest", spec: { context: "压价", a: { name: "你", expr: "1d20+{说服}" }, b: { name: "罗纳", expr: "15" } } });
    expect(typeof id).toBe("number");
    const row = getPendingRoll(db, id);
    expect(row?.shape).toBe("contest");
    expect(row?.status).toBe("awaiting");
    expect(row?.verdictSeq).toBeNull();
    expect((row?.spec as any).a.expr).toBe("1d20+{说服}");
  });

  it("多次 stage 各得不同 eventId", () => {
    const db = freshDb();
    const a = stagePendingRoll(db, { shape: "outcome", spec: { context: "x", die: "1d20", bands: [] } });
    const b = stagePendingRoll(db, { shape: "outcome", spec: { context: "y", die: "1d20", bands: [] } });
    expect(a).not.toBe(b);
  });

  it("markRollCommitted 置 committed + 记 verdictSeq", () => {
    const db = freshDb();
    const id = stagePendingRoll(db, { shape: "outcome", spec: { context: "x", die: "1d20", bands: [] } });
    markRollCommitted(db, id, 42);
    const row = getPendingRoll(db, id);
    expect(row?.status).toBe("committed");
    expect(row?.verdictSeq).toBe(42);
  });

  it("不存在的 eventId → undefined", () => {
    expect(getPendingRoll(freshDb(), 999)).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/core && npx vitest run src/store/pendingRoll.test.ts`
Expected: FAIL — 模块/表不存在。

- [ ] **Step 3: db.ts 加表**

在 `packages/core/src/store/db.ts` 的 `initSchema` 模板字符串内（`pending_choice` 表之后）加:

```sql
    CREATE TABLE IF NOT EXISTS pending_roll (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      shape TEXT NOT NULL,          -- 'outcome' | 'contest'
      spec_json TEXT NOT NULL,      -- 规格(无结果)
      status TEXT NOT NULL DEFAULT 'awaiting',  -- 'awaiting' | 'committed'
      verdict_seq INTEGER           -- commit 后链接 kind=verdict event 的 seq
    );
```

- [ ] **Step 4: 写 pendingRoll.ts**

```ts
// packages/core/src/store/pendingRoll.ts
import type { DB } from "./db.js";

export type RollShape = "outcome" | "contest";
export interface RollSpec { context: string; die?: string; bands?: unknown[]; a?: unknown; b?: unknown }
export interface PendingRollRow {
  eventId: number;
  shape: RollShape;
  spec: RollSpec;
  status: "awaiting" | "committed";
  verdictSeq: number | null;
}

// 暂存明骰规格(无结果),返回自增 event_id 作客户端句柄(契约 pendingRoll.eventId / POST /roll {eventId})。
export function stagePendingRoll(db: DB, input: { shape: RollShape; spec: RollSpec }): number {
  const info = db
    .prepare("INSERT INTO pending_roll (shape, spec_json, status) VALUES (?, ?, 'awaiting')")
    .run(input.shape, JSON.stringify(input.spec));
  return Number(info.lastInsertRowid);
}

export function getPendingRoll(db: DB, eventId: number): PendingRollRow | undefined {
  const row = db
    .prepare("SELECT event_id, shape, spec_json, status, verdict_seq FROM pending_roll WHERE event_id=?")
    .get(eventId) as
    | { event_id: number; shape: RollShape; spec_json: string; status: "awaiting" | "committed"; verdict_seq: number | null }
    | undefined;
  if (!row) return undefined;
  return {
    eventId: row.event_id,
    shape: row.shape,
    spec: JSON.parse(row.spec_json) as RollSpec,
    status: row.status,
    verdictSeq: row.verdict_seq,
  };
}

export function markRollCommitted(db: DB, eventId: number, verdictSeq: number): void {
  db.prepare("UPDATE pending_roll SET status='committed', verdict_seq=? WHERE event_id=?").run(verdictSeq, eventId);
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd packages/core && npx vitest run src/store/pendingRoll.test.ts`
Expected: PASS(4 passed)。

- [ ] **Step 6: 提交**

```bash
git add packages/core/src/store/pendingRoll.ts packages/core/src/store/pendingRoll.test.ts packages/core/src/store/db.ts
git commit -m "feat(core): pending_roll 槽(stage/get/commit 标记,明骰规格暂存)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `commitPendingRoll`（幂等掷骰落定）

**Files:**
- Create: `packages/core/src/resolve/commitRoll.ts`
- Test: `packages/core/src/resolve/commitRoll.test.ts`

**Interfaces:**
- Consumes: `store/pendingRoll.ts`→`getPendingRoll`/`markRollCommitted`/`RollShape`;`store/event.ts`→`eventAppend`/`eventSince`;`resolve/outcome.ts`→`resolveOutcome`;`resolve/contest.ts`→`resolveContest`;`dice/index.ts`→`Rng`。
- Produces:
  ```ts
  type RollResult =
    | { eventId: number; shape: "outcome"; verdictSeq: number; roll: number; die: string; band: { label: string; consequence: string } }
    | { eventId: number; shape: "contest"; verdictSeq: number; a: { name: string; total: number; rolls: number[] }; b: { name: string; total: number; rolls: number[] }; winner: "a" | "b" | "tie" };
  function commitPendingRoll(db: DB, eventId: number, rng?: Rng): RollResult
  ```

- [ ] **Step 1: 写失败测试**

```ts
// packages/core/src/resolve/commitRoll.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../store/db.js";
import { eventSince } from "../store/event.js";
import { sheetSetRaw } from "../store/sheet.js";
import { stagePendingRoll, getPendingRoll } from "../store/pendingRoll.js";
import { commitPendingRoll } from "./commitRoll.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };

describe("commitPendingRoll", () => {
  it("outcome:点击时掷 + 写 verdict + 命中档 + 槽 committed", () => {
    const db = freshDb();
    const id = stagePendingRoll(db, { shape: "outcome", spec: { context: "打听", die: "1d20", bands: [
      { label: "碰壁", min: 1, max: 10, consequence: "坏" }, { label: "顺", min: 11, max: 20, consequence: "好" },
    ] } });
    const r = commitPendingRoll(db, id, seq([0.99])); // floor(0.99*20)+1=20 → 顺
    expect(r.shape).toBe("outcome");
    if (r.shape === "outcome") { expect(r.roll).toBe(20); expect(r.band.label).toBe("顺"); }
    const verdicts = eventSince(db, 0).filter((e) => e.kind === "verdict");
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].visible).toBe(1);
    expect(getPendingRoll(db, id)?.status).toBe("committed");
  });

  it("contest:取真值比大小 + winner + 写 verdict", () => {
    const db = freshDb();
    sheetSetRaw(db, "你", "说服", "5");
    const id = stagePendingRoll(db, { shape: "contest", spec: { context: "压价", a: { name: "你", expr: "1d20+{你.说服}" }, b: { name: "罗纳", expr: "15" } } });
    const r = commitPendingRoll(db, id, seq([0.95])); // a: floor(0.95*20)+1=20 +5=25 vs b 15 → a 胜
    expect(r.shape).toBe("contest");
    if (r.shape === "contest") { expect(r.winner).toBe("a"); expect(r.a.total).toBe(25); }
    expect(eventSince(db, 0).filter((e) => e.kind === "verdict")).toHaveLength(1);
  });

  it("幂等:已 committed 再调不重掷,据 verdict event 重建同结果", () => {
    const db = freshDb();
    const id = stagePendingRoll(db, { shape: "outcome", spec: { context: "x", die: "1d20", bands: [
      { label: "a", min: 1, max: 20, consequence: "c" },
    ] } });
    const r1 = commitPendingRoll(db, id, seq([0.1]));
    const r2 = commitPendingRoll(db, id, seq([0.9])); // 不同 rng,但应返回 r1 的结果
    expect(r2).toEqual(r1);
    expect(eventSince(db, 0).filter((e) => e.kind === "verdict")).toHaveLength(1); // 只一条
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/core && npx vitest run src/resolve/commitRoll.test.ts`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 写实现**

```ts
// packages/core/src/resolve/commitRoll.ts
import type { DB } from "../store/db.js";
import type { Rng } from "../dice/index.js";
import { eventAppend, eventSince } from "../store/event.js";
import { getPendingRoll, markRollCommitted } from "../store/pendingRoll.js";
import { resolveOutcome } from "./outcome.js";
import { resolveContest } from "./contest.js";
import { DiceloreError } from "../errors.js";

export type RollResult =
  | { eventId: number; shape: "outcome"; verdictSeq: number; roll: number; die: string; band: { label: string; consequence: string } }
  | { eventId: number; shape: "contest"; verdictSeq: number; a: { name: string; total: number; rolls: number[] }; b: { name: string; total: number; rolls: number[] }; winner: "a" | "b" | "tie" };

// 点击时掷:读规格 → 复用 resolveOutcome/resolveContest 掷 → 写 kind=verdict → 槽 committed → 返回。
// 幂等:已 committed 据 verdict event 重建(宕机恢复/重投不重掷)。
export function commitPendingRoll(db: DB, eventId: number, rng?: Rng): RollResult {
  const pr = getPendingRoll(db, eventId);
  if (!pr) throw new DiceloreError("ENTITY_NOT_FOUND", `commitPendingRoll: pending_roll#${eventId} 不存在`);
  if (pr.status === "committed" && pr.verdictSeq !== null) return rebuild(db, eventId, pr.shape, pr.verdictSeq);

  const spec = pr.spec as any;
  if (pr.shape === "outcome") {
    const r = resolveOutcome(spec.die, spec.bands, rng);
    const verdictSeq = eventAppend(db, {
      kind: "verdict", visible: 1, content: spec.context,
      data_json: { context: spec.context, die: r.die, roll: r.roll, band: r.band, gated: true },
    });
    markRollCommitted(db, eventId, verdictSeq);
    return { eventId, shape: "outcome", verdictSeq, roll: r.roll, die: r.die, band: { label: r.band.label, consequence: r.band.consequence ?? "" } };
  } else {
    const r = resolveContest(db, spec.a, spec.b, rng);
    const rolls = (s: typeof r.a) => s.ledger.terms.flatMap((t) => t.rolls ?? []);
    const a = { name: r.a.name, total: r.a.ledger.total, rolls: rolls(r.a) };
    const b = { name: r.b.name, total: r.b.ledger.total, rolls: rolls(r.b) };
    const verdictSeq = eventAppend(db, {
      kind: "verdict", visible: 1, content: spec.context,
      data_json: { context: spec.context, a: r.a, b: r.b, winner: r.winner, gated: true },
    });
    markRollCommitted(db, eventId, verdictSeq);
    return { eventId, shape: "contest", verdictSeq, a, b, winner: r.winner };
  }
}

// 据已落 verdict event 重建 RollResult(幂等路)。
function rebuild(db: DB, eventId: number, shape: "outcome" | "contest", verdictSeq: number): RollResult {
  const ev = eventSince(db, verdictSeq - 1).find((e) => e.seq === verdictSeq);
  if (!ev || !ev.data_json) throw new DiceloreError("ENTITY_NOT_FOUND", `commitPendingRoll: verdict#${verdictSeq} 缺失`);
  const d = JSON.parse(ev.data_json);
  if (shape === "outcome") {
    return { eventId, shape: "outcome", verdictSeq, roll: d.roll, die: d.die, band: { label: d.band.label, consequence: d.band.consequence ?? "" } };
  }
  const rolls = (s: any) => (s.ledger?.terms ?? []).flatMap((t: any) => t.rolls ?? []);
  return {
    eventId, shape: "contest", verdictSeq,
    a: { name: d.a.name, total: d.a.ledger.total, rolls: rolls(d.a) },
    b: { name: d.b.name, total: d.b.ledger.total, rolls: rolls(d.b) },
    winner: d.winner,
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd packages/core && npx vitest run src/resolve/commitRoll.test.ts`
Expected: PASS(3 passed)。

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/resolve/commitRoll.ts packages/core/src/resolve/commitRoll.test.ts
git commit -m "feat(core): commitPendingRoll(点击时掷+写verdict+幂等重建,复用 resolveOutcome/Contest)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: roll-gate 接缝 + runTool 改 async

明骰 handler 要能 `await` 玩家点击。core 只造**接缝**:模块级 `setRollGate`/`getRollGate`——组件7 注入 gate 则阻塞,裸 CC 不注入则降级。同时 `runTool` 改 async 以 await 明骰 async handler。

**Files:**
- Create: `packages/core/src/mcp/rollGate.ts`
- Test: `packages/core/src/mcp/rollGate.test.ts`
- Modify: `packages/core/src/mcp/runTool.ts`（async + await handler）
- Modify: `packages/core/src/mcp/runTool.test.ts`（await）

**Interfaces:**
- Produces:
  ```ts
  type RollGate = (eventId: number) => Promise<void>;
  function setRollGate(g: RollGate | undefined): void
  function getRollGate(): RollGate | undefined
  // runTool 改:export async function runTool(db, tool, rawInput): Promise<CallToolResult>
  ```
- Consumes: 无新增。

- [ ] **Step 1: 写 rollGate 失败测试**

```ts
// packages/core/src/mcp/rollGate.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { setRollGate, getRollGate } from "./rollGate.js";

afterEach(() => setRollGate(undefined)); // 模块级单例,测试后复位

describe("roll-gate 接缝", () => {
  it("默认无 gate(裸 CC) → getRollGate 回 undefined", () => {
    expect(getRollGate()).toBeUndefined();
  });
  it("set 后 get 回同一函数", async () => {
    const g = async () => {};
    setRollGate(g);
    expect(getRollGate()).toBe(g);
  });
  it("set(undefined) 清除", () => {
    setRollGate(async () => {});
    setRollGate(undefined);
    expect(getRollGate()).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/core && npx vitest run src/mcp/rollGate.test.ts`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 写 rollGate.ts**

```ts
// packages/core/src/mcp/rollGate.ts
// 明骰阻塞接缝:组件7(orchestrator)注入 gate=「通知前端待掷 + await 玩家点击」;
// 裸 CC 不注入 → 明骰 handler 降级为立即 commit。core 只定接缝,不实现阻塞/WS。
export type RollGate = (eventId: number) => Promise<void>;

let _gate: RollGate | undefined;
export function setRollGate(g: RollGate | undefined): void { _gate = g; }
export function getRollGate(): RollGate | undefined { return _gate; }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd packages/core && npx vitest run src/mcp/rollGate.test.ts`
Expected: PASS(3 passed)。

- [ ] **Step 5: runTool 改 async + 更新其测试**

把 `packages/core/src/mcp/runTool.ts` 的 `runTool` 改为 async、await handler:

```ts
// packages/core/src/mcp/runTool.ts
import type { DB } from "../store/db.js";
import type { ToolDef } from "./tooldef.js";
import { successEnvelope, errorEnvelope, type CallToolResult } from "./envelope.js";
import { remindersFor } from "./reminders.js";

export async function runTool(db: DB, tool: ToolDef, rawInput: unknown): Promise<CallToolResult> {
  try {
    const input = tool.inputSchema.parse(rawInput); // 防御 + 脱 SDK 单测;ZodError 走错误信封(INTERNAL)
    const out = await tool.handler(db, input); // await:兼容 sync(直接值)与明骰 async(Promise)handler
    const reminders = remindersFor(tool.name, out, input);
    const sc = reminders.length ? { ...out, reminders } : out;
    return successEnvelope(out, sc);
  } catch (e) {
    return errorEnvelope(e);
  }
}
```

把 `packages/core/src/mcp/runTool.test.ts` 的 4 个用例改为 `async` + `await runTool(...)`,并加一个 async handler 用例。整文件替换为:

```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { runTool } from "./runTool.js";
import type { ToolDef } from "./tooldef.js";
import { DiceloreError } from "../errors.js";

const anns = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const db = {} as any;

function makeTool(over: Partial<ToolDef>): ToolDef {
  return {
    name: "echo", title: "Echo", description: "d",
    inputSchema: z.object({ x: z.number() }).strict(),
    outputSchema: z.object({ x: z.number() }).strict(),
    annotations: anns,
    handler: (_db, input) => ({ x: input.x }),
    ...over,
  } as ToolDef;
}

describe("runTool", () => {
  it("成功路径:带 structuredContent", async () => {
    const env = await runTool(db, makeTool({}), { x: 5 });
    expect(env.isError).toBeUndefined();
    expect(env.structuredContent).toEqual({ x: 5 });
  });

  it("await 异步 handler(明骰阻塞路)", async () => {
    const t = makeTool({ handler: async (_db, input) => ({ x: input.x + 1 }) });
    const env = await runTool(db, t, { x: 5 });
    expect(env.structuredContent).toEqual({ x: 6 });
  });

  it("reminders 拼进 structuredContent(用 resolve_choice 名触发恒提醒)", async () => {
    const t = makeTool({ name: "resolve_choice", handler: () => ({ staged: true }) });
    const env = await runTool(db, t, { x: 1 });
    expect((env.structuredContent as any).reminders).toEqual(["后续叙述须与已锁后果一致"]);
  });

  it("handler throw DiceloreError → 错误信封,无 structuredContent", async () => {
    const t = makeTool({ handler: () => { throw new DiceloreError("NOT_FOUND", "没了"); } });
    const env = await runTool(db, t, { x: 1 });
    expect(env.isError).toBe(true);
    expect("structuredContent" in env).toBe(false);
    expect(JSON.parse(env.content[0].text).error.code).toBe("NOT_FOUND");
  });

  it("ZodError(入参非法)→ 错误信封 INTERNAL", async () => {
    const env = await runTool(db, makeTool({}), { x: "not a number" });
    expect(env.isError).toBe(true);
    expect(JSON.parse(env.content[0].text).error.code).toBe("INTERNAL");
  });
});
```

> `mcp/main.ts` 注册处 `(args) => runTool(db, t, args) as any` 无需改:runTool 现返回 Promise,MCP SDK 原生支持 async 工具回调。

- [ ] **Step 6: 跑测试确认通过**

Run: `cd packages/core && npx vitest run src/mcp/runTool.test.ts src/mcp/rollGate.test.ts`
Expected: PASS(rollGate 3 + runTool 5)。

- [ ] **Step 7: 提交**

```bash
git add packages/core/src/mcp/rollGate.ts packages/core/src/mcp/rollGate.test.ts packages/core/src/mcp/runTool.ts packages/core/src/mcp/runTool.test.ts
git commit -m "feat(core): roll-gate 接缝(setRollGate/getRollGate)+ runTool 改 async

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 现有 resolve_outcome / resolve_contest 改名 `_hidden`

机械改名(暗骰=引擎自动掷)。**纯重命名,不改行为**;为 Task 5 加 `_open` 腾出清晰对照。

**Files:**
- Modify: `packages/core/src/mcp/handlers/resolver.ts`（两处 `name:` + 描述里的工具名）
- Modify: `packages/core/src/mcp/reminders.ts`（case 名）
- Modify: `packages/core/src/mcp/reminders.test.ts`、`packages/core/src/mcp/tools.test.ts`、`packages/core/src/mcp/handlers/resolver.test.ts`（引用名）

**Interfaces:**
- Produces: 工具名 `resolve_outcome_hidden` / `resolve_contest_hidden`（schema 与 handler 行为不变）。

- [ ] **Step 1: 改 handlers/resolver.ts 的两处 name**

`name: "resolve_outcome"` → `name: "resolve_outcome_hidden"`；`name: "resolve_contest"` → `name: "resolve_contest_hidden"`。
并把这两个工具 `description` 开头各加一句暗骰定位（消歧:引擎自动掷、非结果隐藏），例:
- outcome_hidden 描述前缀:`"【暗骰·引擎自动掷】掷单骰串并按档位表命中一档。…"`
- contest_hidden 描述前缀:`"【暗骰·引擎自动掷】两边各按 expr 求值比大小。…"`
- 同时把描述里互指的旧名更新:`(那用 resolve_outcome)`→`(那用 resolve_outcome_hidden)`、`(那用 resolve_contest)`→`(那用 resolve_contest_hidden)`、`don't:…(那用 resolve_outcome)` 等同步。

- [ ] **Step 2: 改 reminders.ts 的 case 名**

`case "resolve_outcome":` → `case "resolve_outcome_hidden":`（switch 其余不动;`resolve_contest` 本就走 default，无 case 需改，但注释 `// resolve_contest …` 可更新为 `resolve_contest_hidden`）。

- [ ] **Step 3: 改三个测试文件的引用名**

精确替换(old→new):
- `reminders.test.ts`:`remindersFor("resolve_outcome",` → `remindersFor("resolve_outcome_hidden",`（两处）;`remindersFor("resolve_contest",` → `remindersFor("resolve_contest_hidden",`;描述串里的 `resolve_outcome`/`resolve_contest` 文字同改。
- `tools.test.ts`:工具名清单数组里 `"resolve_outcome", "resolve_contest"` → `"resolve_outcome_hidden", "resolve_contest_hidden"`。
- `handlers/resolver.test.ts`:`byName("resolve_outcome")` → `byName("resolve_outcome_hidden")`;`byName("resolve_contest")` → `byName("resolve_contest_hidden")`;测试描述串同改。

- [ ] **Step 4: 跑相关测试确认仍绿（行为不变、只换名）**

Run: `cd packages/core && npx vitest run src/mcp/`
Expected: PASS（resolver/reminders/tools/runTool 全绿;数量与改名前一致）。

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/mcp/handlers/resolver.ts packages/core/src/mcp/reminders.ts packages/core/src/mcp/reminders.test.ts packages/core/src/mcp/tools.test.ts packages/core/src/mcp/handlers/resolver.test.ts
git commit -m "refactor(core): resolve_outcome/contest 改名 _hidden(暗骰=引擎自动掷,消歧)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 加 `resolve_outcome_open` / `resolve_contest_open`（明骰阻塞工具）

明骰 async handler:stage → 有 gate 则 await(组件7)、无则直接降级 → `commitPendingRoll` → 回合内返回结果 + `awaiting:"player_roll"`。

**Files:**
- Modify: `packages/core/src/mcp/schemas/resolver.ts`（加 4 个 *_open schema）
- Modify: `packages/core/src/mcp/handlers/resolver.ts`（加两 async handler + 注册 + import）
- Modify: `packages/core/src/mcp/reminders.ts`（_open 与 _hidden fallthrough 同挂）
- Modify: `packages/core/src/mcp/tools.test.ts`（清单加两 *_open）
- Test: `packages/core/src/mcp/handlers/resolver.test.ts`（加 *_open 用例）

**Interfaces:**
- Consumes: `store/pendingRoll.ts`→`stagePendingRoll`;`resolve/commitRoll.ts`→`commitPendingRoll`/`RollResult`;`mcp/rollGate.ts`→`getRollGate`;`errors.ts`→`DiceloreError`。
- Produces: 工具 `resolve_outcome_open` / `resolve_contest_open`,out 含 `awaiting:"player_roll"`。

- [ ] **Step 1: schemas/resolver.ts 加 *_open schema**

在 `packages/core/src/mcp/schemas/resolver.ts` 末尾加（复用已有 `resolveOutcomeIn`/`resolveContestIn`/`contestSideOut`）:

```ts
// ===== 明骰(玩家闸控、阻塞):入参同暗骰,出参加 awaiting 标记 =====
export const resolveOutcomeOpenIn = resolveOutcomeIn;
export const resolveOutcomeOpenOut = z.object({
  awaiting: z.literal("player_roll"),
  roll: z.number(),
  die: z.string(),
  band: z.object({ label: z.string(), consequence: z.string() }),
  event_id: z.number(),
  reminders: z.array(z.string()).optional(),
});
export const resolveContestOpenIn = resolveContestIn;
export const resolveContestOpenOut = z.object({
  awaiting: z.literal("player_roll"),
  a: contestSideOut,
  b: contestSideOut,
  winner: z.enum(["a", "b", "tie"]),
  event_id: z.number(),
  reminders: z.array(z.string()).optional(),
});
```

> `contestSideOut` 现为文件内 `const`,未 export——本步同时把它改为 `export const contestSideOut = …`(仅加 `export`,不改定义)。

- [ ] **Step 2: handlers/resolver.ts 加两 async handler + 注册**

文件顶部 import 加:
```ts
import { stagePendingRoll } from "../../store/pendingRoll.js";
import { commitPendingRoll } from "../../resolve/commitRoll.js";
import { getRollGate } from "../rollGate.js";
import { DiceloreError } from "../../errors.js";
import {
  resolveOutcomeOpenIn, resolveOutcomeOpenOut,
  resolveContestOpenIn, resolveContestOpenOut,
} from "../schemas/resolver.js";
```

加两 handler（注意 async）:
```ts
async function outcomeOpenHandler(db: DB, input: { context: string; die: string; bands: any[] }) {
  const eventId = stagePendingRoll(db, { shape: "outcome", spec: { context: input.context, die: input.die, bands: input.bands } });
  const gate = getRollGate();
  if (gate) await gate(eventId); // 组件7:通知前端待掷 + await 玩家点击;裸 CC 无 gate → 直接降级立即掷
  const r = commitPendingRoll(db, eventId);
  if (r.shape !== "outcome") throw new DiceloreError("INTERNAL", "commitPendingRoll shape 不符");
  return { awaiting: "player_roll" as const, roll: r.roll, die: r.die, band: r.band, event_id: r.verdictSeq };
}

async function contestOpenHandler(db: DB, input: { context: string; a: any; b: any }) {
  const eventId = stagePendingRoll(db, { shape: "contest", spec: { context: input.context, a: input.a, b: input.b } });
  const gate = getRollGate();
  if (gate) await gate(eventId);
  const r = commitPendingRoll(db, eventId);
  if (r.shape !== "contest") throw new DiceloreError("INTERNAL", "commitPendingRoll shape 不符");
  return { awaiting: "player_roll" as const, a: r.a, b: r.b, winner: r.winner, event_id: r.verdictSeq };
}
```

在 `resolverTools: ToolDef[]` 数组末尾加两条:
```ts
  {
    name: "resolve_outcome_open",
    title: "明骰·选项骰(玩家闸控)",
    description:
      "【明骰·玩家点击掷、亮 DC】入参同 resolve_outcome_hidden(context/die/bands)。阻塞:暂存待掷→玩家在客户端点击→引擎此刻掷→回合内返回 {awaiting:\"player_roll\", roll, die, band, event_id}。" +
      "use: 玩家主动行动的检定(交还掷骰动作 + 参与感)。don't: NPC/世界/暗检定(那用 resolve_outcome_hidden)。点数恒引擎算(anti-F1);裸 CC 无客户端时降级为立即掷。",
    inputSchema: resolveOutcomeOpenIn,
    outputSchema: resolveOutcomeOpenOut,
    annotations: anns(false),
    handler: outcomeOpenHandler,
  },
  {
    name: "resolve_contest_open",
    title: "明骰·对抗骰(玩家闸控)",
    description:
      "【明骰·玩家点击掷、亮 DC】入参同 resolve_contest_hidden(context/a/b,DC=一边常数 expr)。阻塞:暂存待掷→玩家点击→引擎此刻取真值+掷+比大小→回合内返回 {awaiting:\"player_roll\", a, b, winner, event_id}。" +
      "use: 玩家主动行动的对抗/检定。don't: NPC/世界/暗检定(那用 resolve_contest_hidden)。点数恒引擎算(anti-F1);裸 CC 降级立即掷。",
    inputSchema: resolveContestOpenIn,
    outputSchema: resolveContestOpenOut,
    annotations: anns(false),
    handler: contestOpenHandler,
  },
```

- [ ] **Step 3: reminders.ts 让 _open 与 _hidden 同挂提醒**

把 outcome 的 case 改为 fallthrough(两名共用同一提醒逻辑):
```ts
    case "resolve_outcome_hidden":
    case "resolve_outcome_open": {
      const mins: number[] = (input?.bands ?? []).map((b: any) => b.min);
      if (mins.length && out?.band && out.band.min === Math.min(...mins)) {
        return ["尊重结果,别软着陆"];
      }
      return [];
    }
```

- [ ] **Step 4: 写 *_open handler 失败测试**

在 `packages/core/src/mcp/handlers/resolver.test.ts` 末尾(describe 内)加（文件顶部按需 import `setRollGate`：`import { setRollGate } from "../rollGate.js";` 并在用例后复位）:

```ts
import { setRollGate } from "../rollGate.js";
import { eventSince } from "../../store/event.js";

describe("明骰 *_open", () => {
  it("resolve_outcome_open:无 gate(裸CC)→ 立即掷、回 awaiting + 落 verdict", async () => {
    const db = freshDb();
    setRollGate(undefined);
    const out = await byName("resolve_outcome_open").handler(db, {
      context: "打听", die: "1d20",
      bands: [{ label: "碰壁", min: 1, max: 10, consequence: "坏" }, { label: "顺", min: 11, max: 20, consequence: "好" }],
    });
    expect(out.awaiting).toBe("player_roll");
    expect(typeof out.roll).toBe("number");
    expect(out.band.label).toMatch(/碰壁|顺/);
    expect(eventSince(db, 0).filter((e) => e.kind === "verdict")).toHaveLength(1);
  });

  it("resolve_contest_open:无 gate → winner 产出 + 落 verdict", async () => {
    const db = freshDb();
    setRollGate(undefined);
    const out = await byName("resolve_contest_open").handler(db, {
      context: "压价", a: { name: "你", expr: "20" }, b: { name: "罗纳", expr: "1" },
    });
    expect(out.awaiting).toBe("player_roll");
    expect(out.winner).toBe("a"); // 20 vs 1
  });

  it("有 gate(组件7)→ handler await gate(eventId)后才掷", async () => {
    const db = freshDb();
    let gatedId: number | undefined;
    setRollGate(async (eventId) => { gatedId = eventId; });
    const out = await byName("resolve_outcome_open").handler(db, {
      context: "x", die: "1d20", bands: [{ label: "a", min: 1, max: 20, consequence: "c" }],
    });
    expect(gatedId).toBeGreaterThan(0); // gate 被以 eventId 调用过
    expect(out.awaiting).toBe("player_roll");
    setRollGate(undefined);
  });
});
```

> `freshDb()` / `byName(...)` 沿用该测试文件已有 helper（若 `byName` 未导出 handler 的 async 形态,无需改——handler 本就是函数,await 其返回即可）。

- [ ] **Step 5: 跑测试确认失败 → 实现已写 → 通过**

Run: `cd packages/core && npx vitest run src/mcp/handlers/resolver.test.ts`
Expected: 先因 Step1-3 未落而失败,落齐后 PASS(原有 + 明骰 3 用例)。

- [ ] **Step 6: tools.test.ts 清单加两 *_open**

把 `tools.test.ts` 工具名断言数组加 `"resolve_outcome_open", "resolve_contest_open"`（与 Task 4 已改的 `_hidden` 并列）。

Run: `cd packages/core && npx vitest run src/mcp/tools.test.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add packages/core/src/mcp/schemas/resolver.ts packages/core/src/mcp/handlers/resolver.ts packages/core/src/mcp/handlers/resolver.test.ts packages/core/src/mcp/reminders.ts packages/core/src/mcp/tools.test.ts
git commit -m "feat(core): resolve_outcome_open/contest_open 明骰阻塞工具(stage→gate?await:降级→commit→回合内返回)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: gm-core skill「谁掷」指引（明/暗骰）

把 [Skills包 §2.4](../../wiki/04-子系统设计/Skills包.md) 已落档的「谁掷」教进**实际 skill 文件**(措辞 eval-pending)。纯 markdown;以结构测试(<500 行)作测试周期。

**Files:**
- Modify: `packages/core/skills/dicelore-gm-core/SKILL.md`
- Test: `packages/core/src/adapter/skills-structure.test.ts`（已存在,跑确认 gm-core 仍 <500 行）

- [ ] **Step 1: SKILL.md 的 Moves 形状表后加「谁掷」小节**

在 `## Moves` 的「形状表」之后、「两个补丁」之前插入:

```markdown
### 谁掷？明骰 vs 暗骰(L1 工具名分流)
确定要骰之后,还要显式选「这一掷是玩家的还是 GM 的」——拆成不同工具名、非布尔参:
- **玩家主动行动的检定**(你攻击/说服/潜行)→ **明骰** `resolve_outcome_open` / `resolve_contest_open`:玩家在客户端点击掷、亮 DC、见证成败。把"掷骰这个动作"交还玩家=参与感(否则玩家觉得"还不是 AI 替我定命")。
- **NPC/世界/暗检定**(敌人攻击、暗感知、隐藏 DC)→ **暗骰** `resolve_*_hidden`:引擎自动掷。
- 点数恒由引擎算(明暗皆然,anti-F1);明暗只差"谁触发 + 透不透明"。明骰阻塞:玩家掷完结果回合内回你,再据成败叙述。
```

- [ ] **Step 2: Principles 加一条「明骰默认」**（在「一轮范式纪律」簇附近）

```markdown
- **明骰默认**(谁的命谁掷)：玩家主动行动的高风险掷,默认做成明骰、别替玩家拍板开骰——掷骰的"我来"这一拍是能动性的一部分;点数仍归引擎(anti-F1),玩家拿回的是"决定承担这一掷"。<sup>eval-pending</sup>
```

- [ ] **Step 3: 跑结构测试确认 gm-core 仍合法、<500 行**

Run: `cd packages/core && npx vitest run src/adapter/skills-structure.test.ts`
Expected: PASS(3 passed)。若超 500 行,把「谁掷」全决策细节下沉 `references/moves-full.md`、body 只留骨架。

- [ ] **Step 4: 提交**

```bash
git add packages/core/skills/dicelore-gm-core/SKILL.md
git commit -m "feat(skills): gm-core 加明/暗骰「谁掷」Moves + 明骰默认 Principle(eval-pending)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 全量回归 + 公共面对齐

确认全套测试 + typecheck 绿;若 `src/index.ts` barrel(组件7 线加的公共面)需导出明骰原语,additive 补。

**Files:**
- Modify(按需): `packages/core/src/index.ts`（若存在 barrel,additive 导出 `commitPendingRoll`/`stagePendingRoll`/`getPendingRoll`/`setRollGate`/`getRollGate`/`RollResult` 供 orchestrator）

- [ ] **Step 1: 全量测试 + typecheck**

Run: `cd packages/core && npx vitest run && npm run typecheck`
Expected: 全绿(组件1/2 既有 + 本计划新增),typecheck exit 0。

- [ ] **Step 2: 若 `packages/core/src/index.ts` 存在(组件7 线已加),additive 导出明骰公共面**

```ts
// 追加(不删既有导出):
export { stagePendingRoll, getPendingRoll, type PendingRollRow, type RollSpec, type RollShape } from "./store/pendingRoll.js";
export { commitPendingRoll, type RollResult } from "./resolve/commitRoll.js";
export { setRollGate, getRollGate, type RollGate } from "./mcp/rollGate.js";
```
> 若 `src/index.ts` 不存在(本线先于组件7 线落地),跳过此步——留组件7 线建 barrel 时一并导出。

- [ ] **Step 3: 提交（若有改动）**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): 公共 barrel additive 导出明骰原语(供 orchestrator)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 自审记录（已对 spec 逐节核对）

- **spec §2 工具面**：Task 4(改名 `_hidden`)+ Task 5(加 `_open`)= 4 工具齐;`resolve_choice` 不动。
- **spec §3 阻塞机制**：Task 1(`pending_roll` 槽)+ Task 2(`commitPendingRoll` 幂等)+ Task 3(roll-gate 接缝 + async runTool)+ Task 5(handler stage→gate?await:降级→commit→返回)。
- **spec §5 宕机恢复**：Task 2 `commitPendingRoll` 幂等(已 committed 据 verdict 重建)= 恢复正确性基石;重驱 GM 归组件7(本计划范围边界已注)。
- **spec §7 skill**：Task 6 gm-core「谁掷」+ Principle(eval-pending)。
- **spec §9 不变量**：anti-F1—点数恒 `commitPendingRoll` 内引擎算、`pending_roll` 无结果;可见性—verdict `visible=1`。
- **spec §10 分线**：本计划只 core(槽/commit/接缝/工具/skill/改名);`awaitPlayerRoll` 实现 / `POST /roll` / UI / 重驱 / `packages/shared` 契约 = 组件7 线(范围边界已注,Task 7 仅 additive 留导出)。
- **类型一致性**：`RollResult`(union by shape)/`PendingRollRow`/`RollSpec`/`RollGate` 跨 Task 引用一致;`commitPendingRoll(db,eventId,rng?)`、`stagePendingRoll(db,{shape,spec})→eventId`、`getRollGate()` 签名一致。
- **占位扫描**：无 TBD;`eval-pending` 是有意标记(措辞终稿留 eval-loop)。

