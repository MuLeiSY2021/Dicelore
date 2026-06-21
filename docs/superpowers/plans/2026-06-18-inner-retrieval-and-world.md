# 内层检索与世界域 (Plan 2) Implementation Plan

> **路径迁移说明**（2026-06-21）：引擎已从 root `src/` 迁入 `packages/core/`(= `@dicelore/core`，对齐 monorepo 约定)。本计划为历史执行记录,下文所有 `src/…` 路径与 `npx vitest run src/…` 命令对应 `packages/core/src/…`(测试经 root `npm test` 委托执行)。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补完 Dicelore 内层地基的最后一块——world 域(散文 doc + 可抽样结构 pool)与 rule 域(版本化只读规则)的读写检索、FTS5+jieba 全文检索(event/world_doc/rule_doc,trigram 零依赖保底)、以及可见性写(show/reveal_once)。

**Architecture:** FTS 通用层 `src/store/fts.ts` 提供 mode 切换(jieba 主路径 / trigram 保底)、分词、MATCH query 构造与 DB 侧 index/search helper,完全自足不依赖 `db.ts`(避免循环);`db.ts` 仅在 `initSchema` 末尾调 FTS 通用层建三张虚表(与并行「快照线」的 snapshot 表互不重叠,改动集中加注释)。各业务域(event/world/rule)写入时同步喂 FTS 影子列,检索经 FTS + tag/LIKE 兜底召回。world `source` 列是 author/ai 迁移钩子;world_pool 整行存 `row_json` 不拍平,加权抽样在 TS 层(RNG 注入、可单测)。可见性写只改 `visible` 列 / append `kind=reveal` event,渲染判定留给 adapter。

**Tech Stack:** TypeScript (ESM, strict) · Node ≥20 · better-sqlite3(同步 SQLite,内置 FTS5)· @node-rs/jieba(预编译,写入分词)· vitest

## Global Constraints

- TypeScript strict 模式;ESM(`"type": "module"`,import 用 `.js` 后缀);Node ≥ 20。
- 数据层 SQLite 用 `better-sqlite3`(同步 API)。
- `@node-rs/jieba` 是预编译 npm 包(`npm i` 即用,不本地编译);v2.0.1 的 ESM API 是 `import { Jieba } from "@node-rs/jieba"` + `import { dict } from "@node-rs/jieba/dict.js"` → `Jieba.withDict(dict).cut(text): string[]`(顶层无 `cut`)。若 `npm install` 网络失败,走 WSL 代理:`export https_proxy=http://172.17.128.1:7897 http_proxy=http://172.17.128.1:7897`。
- **FTS 影子列 schema 不变**:每张 FTS 虚表恒为 `(text, raw UNINDEXED)`,jieba/trigram 只差 CREATE 的 `tokenize` 参数与写入是否分词;切 mode 需重建索引(v1 不做迁移)。
- **结构保真**:world_pool 整行存 `row_json` 不拍平;rule 整段读。
- **`db.ts` 是与并行「回合快照」线的唯一物理交叠点**:本 plan 对它的改动只在 `initSchema` 末尾建 FTS 虚表,集中并加醒目注释,便于对方 rebase;不动既有四域表结构。
- **一切运行期游戏态变更必经 store**(`world_register` 等不得绕过),否则快照覆盖不到。
- 引擎"哑":world_pool 数值不 clamp;FTS 表名是内部固定常量(非用户输入),SQL 插值安全。
- 每个 task 用 TDD:先写失败测试 → 跑红 → 最小实现 → 跑绿 → commit。
- 测试命令统一 `npx vitest run <path>`;每个 commit message 结尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

---

### Task 1: FTS 通用层·纯函数(mode / 分词 / query 构造)

**Files:**
- Modify: `package.json`(加 `@node-rs/jieba` 依赖)
- Create: `src/store/fts.ts`
- Test: `src/store/fts.test.ts`

**Interfaces:**
- Consumes: `@node-rs/jieba`
- Produces:
  - `type FtsMode = "jieba" | "trigram"`
  - `ftsMode(): FtsMode`(env `DICELORE_FTS_MODE==="trigram"` → trigram,否则 jieba)
  - `tokenizeForIndex(text: string, mode?: FtsMode): string`(jieba:`cut` 后空格连接;trigram:原文)
  - `escapeLike(s: string): string`(转义 `\ % _`)
  - `interface FtsQuery { match: string | null; like: string | null }`
  - `buildFtsQuery(query: string, mode?: FtsMode): FtsQuery`(jieba:分词→每词加双引号 OR 连接;trigram:≥3 字→原文 MATCH、<3 字→LIKE 兜底;空→全 null)

- [ ] **Step 1: 安装依赖**

Run: `npm i @node-rs/jieba`
Expected: 安装成功(本机直连即可;失败则先 export 代理再重试)。`package.json` 的 dependencies 出现 `@node-rs/jieba`。

- [ ] **Step 2: 写失败测试 `src/store/fts.test.ts`**

```ts
import { afterEach, describe, expect, test } from "vitest";
import { buildFtsQuery, escapeLike, ftsMode, tokenizeForIndex } from "./fts.js";

afterEach(() => { delete process.env.DICELORE_FTS_MODE; });

describe("ftsMode", () => {
  test("默认 jieba", () => { expect(ftsMode()).toBe("jieba"); });
  test("env 切 trigram", () => { process.env.DICELORE_FTS_MODE = "trigram"; expect(ftsMode()).toBe("trigram"); });
});

describe("tokenizeForIndex", () => {
  test("jieba:分词空格连接", () => {
    expect(tokenizeForIndex("我爱北京天安门", "jieba")).toBe("我 爱 北京 天安门");
  });
  test("trigram:原文不动", () => {
    expect(tokenizeForIndex("青云门派收弟子", "trigram")).toBe("青云门派收弟子");
  });
});

describe("buildFtsQuery", () => {
  test("jieba:单词加引号", () => {
    expect(buildFtsQuery("北京", "jieba")).toEqual({ match: '"北京"', like: null });
  });
  test("jieba:多词 OR 连接", () => {
    expect(buildFtsQuery("北京 天安门", "jieba")).toEqual({ match: '"北京" OR "天安门"', like: null });
  });
  test("trigram:≥3 字走 MATCH", () => {
    expect(buildFtsQuery("门派收", "trigram")).toEqual({ match: "门派收", like: null });
  });
  test("trigram:<3 字走 LIKE 兜底", () => {
    expect(buildFtsQuery("门派", "trigram")).toEqual({ match: null, like: "%门派%" });
  });
  test("空查询:全 null", () => {
    expect(buildFtsQuery("  ", "jieba")).toEqual({ match: null, like: null });
  });
});

describe("escapeLike", () => {
  test("转义 LIKE 通配符", () => {
    expect(escapeLike("a%b_c\\d")).toBe("a\\%b\\_c\\\\d");
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run src/store/fts.test.ts`
Expected: FAIL（`./fts.js` 模块不存在）

- [ ] **Step 4: 写实现 `src/store/fts.ts`(本 step 只写纯函数部分)**

```ts
import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict.js";

export type FtsMode = "jieba" | "trigram";

export function ftsMode(): FtsMode {
  return process.env.DICELORE_FTS_MODE === "trigram" ? "trigram" : "jieba";
}

let _jieba: Jieba | undefined;
function jieba(): Jieba {
  if (!_jieba) _jieba = Jieba.withDict(dict);
  return _jieba;
}

// 影子列文本:jieba 分词空格连接(unicode61 据此按空格切回 token);trigram 存原文。
export function tokenizeForIndex(text: string, mode: FtsMode = ftsMode()): string {
  if (mode === "trigram") return text;
  return jieba().cut(text).join(" ");
}

export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => "\\" + m);
}

export interface FtsQuery {
  match: string | null; // 走 `text MATCH ?`
  like: string | null; // 走 `raw LIKE ? ESCAPE '\'` 兜底
}

// jieba:查询词分词 → 每词双引号包裹(避开 FTS5 关键字/特殊符)、OR 连接,最大化召回 + bm25 排序。
// trigram:≥3 字直接 MATCH(子串可搜);<3 字 trigram 命不中 → 退 LIKE。
export function buildFtsQuery(query: string, mode: FtsMode = ftsMode()): FtsQuery {
  const q = query.trim();
  if (!q) return { match: null, like: null };
  if (mode === "trigram") {
    if ([...q].length >= 3) return { match: q, like: null };
    return { match: null, like: `%${escapeLike(q)}%` };
  }
  const tokens = jieba().cut(q).map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return { match: null, like: `%${escapeLike(q)}%` };
  const match = tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(" OR ");
  return { match, like: null };
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/store/fts.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/store/fts.ts src/store/fts.test.ts
git commit -m "feat(fts): jieba/trigram 通用层纯函数(mode/分词/query 构造)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: FTS DB 层 helper + db.ts 建虚表

**Files:**
- Modify: `src/store/fts.ts`(追加 DDL + index/delete/search helper)
- Modify: `src/store/db.ts`(`initSchema` 末尾建三张 FTS 虚表)
- Test: `src/store/fts_db.test.ts`
- Modify: `src/store/db.test.ts`(断言 FTS 虚表存在)

**Interfaces:**
- Consumes: `FtsMode`, `ftsMode`, `tokenizeForIndex`, `buildFtsQuery`(Task 1);`better-sqlite3` 的 `Database`
- Produces(均加在 `fts.ts`):
  - `const FTS_TABLES = ["event_fts", "world_doc_fts", "rule_doc_fts"] as const`
  - `ftsTableDDL(table: string, mode?: FtsMode): string`(返回 `CREATE VIRTUAL TABLE IF NOT EXISTS … USING fts5(text, raw UNINDEXED[, tokenize='trigram'])`)
  - `type FtsDB = Database.Database`
  - `ftsIndex(db: FtsDB, table: string, rowid: number, text: string): void`(先删同 rowid 再插,幂等 reindex;`raw` 存原 `text`、影子列存 `tokenizeForIndex(text)`)
  - `ftsDelete(db: FtsDB, table: string, rowid: number): void`
  - `interface FtsHit { rowid: number; raw: string }`
  - `ftsSearch(db: FtsDB, table: string, query: string, limit?: number): FtsHit[]`(match → `MATCH` + bm25 排序;like → `LIKE raw`;都无 → `[]`)

- [ ] **Step 1: 写失败测试 `src/store/fts_db.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import Database from "better-sqlite3";
import { FTS_TABLES, ftsDelete, ftsIndex, ftsSearch, ftsTableDDL } from "./fts.js";

let db: Database.Database;
beforeEach(() => { db = new Database(":memory:"); for (const t of FTS_TABLES) db.exec(ftsTableDDL(t, "jieba")); });
afterEach(() => { delete process.env.DICELORE_FTS_MODE; });

describe("ftsIndex + ftsSearch (jieba)", () => {
  test("index 后按 2 字词召回(命中 raw)", () => {
    ftsIndex(db, "world_doc_fts", 1, "青云门派收弟子");
    ftsIndex(db, "world_doc_fts", 2, "魔教长老议事");
    const hits = ftsSearch(db, "world_doc_fts", "门派");
    expect(hits).toEqual([{ rowid: 1, raw: "青云门派收弟子" }]);
  });
  test("多词 OR 召回多行", () => {
    ftsIndex(db, "world_doc_fts", 1, "青云门派收弟子");
    ftsIndex(db, "world_doc_fts", 2, "魔教长老议事");
    expect(ftsSearch(db, "world_doc_fts", "门派 长老").map((h) => h.rowid).sort()).toEqual([1, 2]);
  });
  test("reindex 同 rowid 不重复", () => {
    ftsIndex(db, "world_doc_fts", 1, "旧文本");
    ftsIndex(db, "world_doc_fts", 1, "青云门派");
    expect(ftsSearch(db, "world_doc_fts", "门派")).toEqual([{ rowid: 1, raw: "青云门派" }]);
    expect(ftsSearch(db, "world_doc_fts", "旧文本")).toEqual([]);
  });
  test("ftsDelete 移除", () => {
    ftsIndex(db, "world_doc_fts", 1, "青云门派");
    ftsDelete(db, "world_doc_fts", 1);
    expect(ftsSearch(db, "world_doc_fts", "门派")).toEqual([]);
  });
});

describe("trigram 保底", () => {
  test("≥3 字 MATCH、<3 字 LIKE 兜底", () => {
    const t = new Database(":memory:");
    t.exec(ftsTableDDL("world_doc_fts", "trigram"));
    ftsIndex(t, "world_doc_fts", 1, "青云门派收弟子");
    process.env.DICELORE_FTS_MODE = "trigram";
    expect(ftsSearch(t, "world_doc_fts", "门派收").map((h) => h.rowid)).toEqual([1]); // MATCH
    expect(ftsSearch(t, "world_doc_fts", "门派").map((h) => h.rowid)).toEqual([1]); // LIKE 兜底
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/store/fts_db.test.ts`
Expected: FAIL（`ftsTableDDL`/`ftsIndex`/`ftsSearch`/`ftsDelete`/`FTS_TABLES` 未导出）

- [ ] **Step 3: 在 `src/store/fts.ts` 追加 DB 层 helper**

在文件顶部 import 区追加:

```ts
import type Database from "better-sqlite3";
```

在文件末尾追加:

```ts
export const FTS_TABLES = ["event_fts", "world_doc_fts", "rule_doc_fts"] as const;

export type FtsDB = Database.Database;

// FTS 虚表恒为 (text, raw UNINDEXED);jieba/trigram 只差 tokenize 参数。
export function ftsTableDDL(table: string, mode: FtsMode = ftsMode()): string {
  const tk = mode === "trigram" ? ", tokenize='trigram'" : "";
  return `CREATE VIRTUAL TABLE IF NOT EXISTS ${table} USING fts5(text, raw UNINDEXED${tk})`;
}

// 幂等 reindex:standalone FTS5 表先删同 rowid 再插。raw 存原文供回展示,影子列存分词文本。
export function ftsIndex(db: FtsDB, table: string, rowid: number, text: string): void {
  db.prepare(`DELETE FROM ${table} WHERE rowid=?`).run(rowid);
  db.prepare(`INSERT INTO ${table}(rowid, text, raw) VALUES (?, ?, ?)`).run(rowid, tokenizeForIndex(text), text);
}

export function ftsDelete(db: FtsDB, table: string, rowid: number): void {
  db.prepare(`DELETE FROM ${table} WHERE rowid=?`).run(rowid);
}

export interface FtsHit {
  rowid: number;
  raw: string;
}

// table 是内部固定常量(FTS_TABLES),非用户输入 → 插值安全。
export function ftsSearch(db: FtsDB, table: string, query: string, limit = 20): FtsHit[] {
  const { match, like } = buildFtsQuery(query);
  if (match) {
    return db
      .prepare(`SELECT rowid, raw FROM ${table} WHERE text MATCH ? ORDER BY bm25(${table}) LIMIT ?`)
      .all(match, limit) as FtsHit[];
  }
  if (like) {
    return db
      .prepare(`SELECT rowid, raw FROM ${table} WHERE raw LIKE ? ESCAPE '\\' LIMIT ?`)
      .all(like, limit) as FtsHit[];
  }
  return [];
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/store/fts_db.test.ts`
Expected: PASS

- [ ] **Step 5: 在 `src/store/db.ts` 的 `initSchema` 末尾建 FTS 虚表**

先在 `db.ts` 顶部 import 区(`import Database from "better-sqlite3";` 下一行)追加:

```ts
import { FTS_TABLES, ftsTableDDL } from "./fts.js";
```

然后在 `initSchema` 函数体内、`db.exec(\`…\`)` 那条建四域表语句**之后**,追加(函数闭合 `}` 之前):

```ts
  // ===== FTS5 全文检索虚表(Plan 2)=====
  // 与并行「回合快照线」的 snapshot 表互不重叠;改动只在此集中,便于对方 rebase。
  for (const t of FTS_TABLES) db.exec(ftsTableDDL(t));
```

- [ ] **Step 6: 在 `src/store/db.test.ts` 追加 FTS 虚表断言**

在现有 `describe("schema", …)` 内,把"初始化建出四域表"那条 test 的表名循环数组补上 FTS 虚表,或新增一条 test:

```ts
  test("初始化建出 FTS 虚表", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    for (const t of ["event_fts", "world_doc_fts", "rule_doc_fts"]) {
      expect(names).toContain(t);
    }
  });
```

- [ ] **Step 7: 跑测试确认通过(含 db.test 无回归)**

Run: `npx vitest run src/store/fts_db.test.ts src/store/db.test.ts`
Expected: PASS（全部）

- [ ] **Step 8: Commit**

```bash
git add src/store/fts.ts src/store/fts_db.test.ts src/store/db.ts src/store/db.test.ts
git commit -m "feat(fts): DB 层 index/delete/search helper + db.ts 建三 FTS 虚表

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: event FTS 接线(写入同步 index + eventRecall)

**Files:**
- Modify: `src/store/event.ts`(`eventAppend` 同步 index、新增 `eventRecall`)
- Test: `src/store/event.test.ts`(追加 recall 用例)

**Interfaces:**
- Consumes: `DB`(`db.ts`);`ftsIndex`, `ftsSearch`, `escapeLike`(Task 1/2);现有 `EventRow`, `eventAppend`
- Produces:
  - `eventRecall(db: DB, query: string, opts?: { limit?: number }): EventRow[]`(FTS 召回 event_fts → 回 event 表取行,并入 `tags` LIKE 兜底,按 `seq` 排序)
  - `eventAppend` 行为扩展:`content` 非空时同步 `ftsIndex(db, "event_fts", seq, content)`

- [ ] **Step 1: 在 `src/store/event.test.ts` 追加失败测试**

在文件末尾、最后一个 `describe` 之后追加(并在顶部 import 补上 `eventRecall`):

```ts
import { eventAppend, eventRecall, eventSince } from "./event.js";

describe("eventRecall (FTS + tag 兜底)", () => {
  test("按内容 2 字词召回", () => {
    eventAppend(db, { kind: "narrate", content: "青云门派今日收徒" });
    eventAppend(db, { kind: "narrate", content: "城外风平浪静" });
    const hits = eventRecall(db, "门派");
    expect(hits.map((r) => r.content)).toEqual(["青云门派今日收徒"]);
  });
  test("content 为空的 event 不进 FTS、不报错", () => {
    eventAppend(db, { kind: "verdict", data_json: { winner: "a" } });
    expect(eventRecall(db, "门派")).toEqual([]);
  });
  test("tag LIKE 兜底(内容未命中、tag 命中)", () => {
    eventAppend(db, { kind: "narrate", content: "昨夜无事", tags: "剧情线,伏笔" });
    const hits = eventRecall(db, "剧情线");
    expect(hits.map((r) => r.content)).toEqual(["昨夜无事"]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/store/event.test.ts`
Expected: FAIL（`eventRecall` 未导出;FTS 召回为空）

- [ ] **Step 3: 修改 `src/store/event.ts`**

在顶部 import 区追加:

```ts
import { escapeLike, ftsIndex, ftsSearch } from "./fts.js";
```

把现有 `eventAppend` 的 `return Number(info.lastInsertRowid);` 改为(先取 seq、content 非空则 index、再返回):

```ts
  const seq = Number(info.lastInsertRowid);
  if (ev.content && ev.content.trim()) ftsIndex(db, "event_fts", seq, ev.content);
  return seq;
```

在文件末尾追加 `eventRecall`:

```ts
// FTS 召回 + tag LIKE 兜底。当前分支 seq 过滤由快照线/adapter 在上层接(§4.5.3),本层返回全量命中。
export function eventRecall(db: DB, query: string, opts: { limit?: number } = {}): EventRow[] {
  const limit = opts.limit ?? 20;
  const seqs = new Set<number>(ftsSearch(db, "event_fts", query, limit).map((h) => h.rowid));
  const tagRows = db
    .prepare("SELECT seq FROM event WHERE tags LIKE ? ESCAPE '\\' LIMIT ?")
    .all(`%${escapeLike(query)}%`, limit) as { seq: number }[];
  for (const r of tagRows) seqs.add(r.seq);
  if (seqs.size === 0) return [];
  const ids = [...seqs];
  const placeholders = ids.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM event WHERE seq IN (${placeholders}) ORDER BY seq`).all(...ids) as EventRow[];
}
```

- [ ] **Step 4: 跑测试确认通过(含原有 event 用例无回归)**

Run: `npx vitest run src/store/event.test.ts`
Expected: PASS（全部）

- [ ] **Step 5: Commit**

```bash
git add src/store/event.ts src/store/event.test.ts
git commit -m "feat(store): event FTS 接线(append 同步 index + eventRecall 含 tag 兜底)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: world store(doc 读写检索 + pool 加权抽样 + register)

**Files:**
- Create: `src/store/world.ts`
- Test: `src/store/world.test.ts`

**Interfaces:**
- Consumes: `DB`(`db.ts`);`ftsIndex`, `ftsSearch`(Task 1/2);`Rng`(`../dice/index.js`)
- Produces:
  - `interface WorldDoc { rowid: number; name: string; content: string; category: string | null; tags: string | null; visible: number }`
  - `worldDocUpsert(db, d: { name: string; content: string; category?: string; tags?: string; visible?: number }): number`(按 `name` 寻址:存在 UPDATE 否则 INSERT;返回 rowid;index `name+content+tags`)
  - `worldDocGet(db, name: string): WorldDoc | undefined`
  - `worldDocSearch(db, query: string, limit?: number): WorldDoc[]`(FTS 召回保 bm25 顺序)
  - `interface PoolAdd { pool: string; row: Record<string, unknown>; weight?: number; source?: "author" | "ai"; visible?: number }`
  - `worldPoolAdd(db, a: PoolAdd): number`(整行 `JSON.stringify(row)` 存 `row_json`,不拍平;返回 rowid)
  - `worldSample(db, pool: string, n: number, opts?: { filter?: Record<string, string | number>; rng?: Rng }): Record<string, unknown>[]`(`json_extract` 按列过滤 + TS 层加权无放回抽样,返回解析后的 row 对象)
  - `worldRegister(db, a: Omit<PoolAdd, "source">): number`(运行期 AI 写入,强制 `source="ai"`,= `worldPoolAdd` 带 ai 标记)

- [ ] **Step 1: 写失败测试 `src/store/world.test.ts`**

```ts
import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import {
  worldDocGet, worldDocSearch, worldDocUpsert,
  worldPoolAdd, worldRegister, worldSample,
} from "./world.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("world_doc", () => {
  test("upsert 后 get", () => {
    worldDocUpsert(db, { name: "青云门", content: "正道大派,坐落青云山", category: "门派" });
    expect(worldDocGet(db, "青云门")).toMatchObject({ name: "青云门", content: "正道大派,坐落青云山", category: "门派", visible: 0 });
  });
  test("同名 upsert 覆盖内容(不新增行)", () => {
    worldDocUpsert(db, { name: "青云门", content: "旧设定" });
    worldDocUpsert(db, { name: "青云门", content: "新设定" });
    expect(worldDocGet(db, "青云门")!.content).toBe("新设定");
    expect(db.prepare("SELECT COUNT(*) c FROM world_doc").get()).toMatchObject({ c: 1 });
  });
  test("FTS 搜索命中(含按 name 召回)", () => {
    worldDocUpsert(db, { name: "青云门", content: "正道大派" });
    worldDocUpsert(db, { name: "魔教", content: "邪道势力" });
    expect(worldDocSearch(db, "正道").map((d) => d.name)).toEqual(["青云门"]);
    expect(worldDocSearch(db, "魔教").map((d) => d.name)).toEqual(["魔教"]);
  });
  test("FTS 覆盖 tags(§5 tag 兜底召回)", () => {
    worldDocUpsert(db, { name: "青云门", content: "正道大派", tags: "仙侠,门派" });
    expect(worldDocSearch(db, "仙侠").map((d) => d.name)).toEqual(["青云门"]);
  });
  test("重 upsert 后旧内容搜不到(reindex)", () => {
    worldDocUpsert(db, { name: "青云门", content: "旧设定甲乙丙" });
    worldDocUpsert(db, { name: "青云门", content: "新设定丁戊己" });
    expect(worldDocSearch(db, "旧设定")).toEqual([]);
    expect(worldDocSearch(db, "新设定").map((d) => d.name)).toEqual(["青云门"]);
  });
});

describe("world_pool", () => {
  test("整行存 row_json 不拍平,抽样返回结构对象", () => {
    worldPoolAdd(db, { pool: "掉落", row: { 名称: "铁剑", 稀有度: "普通", 属性: { 攻击: 5 } } });
    const out = worldSample(db, "掉落", 1, { rng: () => 0 });
    expect(out[0]).toEqual({ 名称: "铁剑", 稀有度: "普通", 属性: { 攻击: 5 } });
  });
  test("加权抽样确定性(rng 注入)", () => {
    worldPoolAdd(db, { pool: "p", row: { n: "A" }, weight: 1 });
    worldPoolAdd(db, { pool: "p", row: { n: "B" }, weight: 1 });
    worldPoolAdd(db, { pool: "p", row: { n: "C" }, weight: 2 }); // total=4
    expect(worldSample(db, "p", 1, { rng: () => 0 })[0]).toEqual({ n: "A" });
    expect(worldSample(db, "p", 1, { rng: () => 0.99 })[0]).toEqual({ n: "C" });
  });
  test("无放回:抽 n 个不重复", () => {
    worldPoolAdd(db, { pool: "p", row: { n: "A" } });
    worldPoolAdd(db, { pool: "p", row: { n: "B" } });
    worldPoolAdd(db, { pool: "p", row: { n: "C" } });
    const seq = [0, 0, 0];
    let i = 0;
    const got = worldSample(db, "p", 3, { rng: () => seq[i++] });
    expect(got.map((r) => r.n).sort()).toEqual(["A", "B", "C"]);
  });
  test("n 超过池大小返回全部", () => {
    worldPoolAdd(db, { pool: "p", row: { n: "A" } });
    expect(worldSample(db, "p", 5, { rng: () => 0 })).toHaveLength(1);
  });
  test("filter 按 json_extract 列过滤", () => {
    worldPoolAdd(db, { pool: "掉落", row: { 名称: "铁剑", 类型: "武器" } });
    worldPoolAdd(db, { pool: "掉落", row: { 名称: "丹药", 类型: "消耗" } });
    const out = worldSample(db, "掉落", 5, { filter: { 类型: "武器" }, rng: () => 0 });
    expect(out.map((r) => r.名称)).toEqual(["铁剑"]);
  });
});

describe("world_register", () => {
  test("AI 现编写入 source=ai", () => {
    const id = worldRegister(db, { pool: "随机事件", row: { 事件: "遇袭" } });
    const row = db.prepare("SELECT source FROM world_pool WHERE rowid=?").get(id) as { source: string };
    expect(row.source).toBe("ai");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/store/world.test.ts`
Expected: FAIL（`./world.js` 模块不存在）

- [ ] **Step 3: 写实现 `src/store/world.ts`**

```ts
import type { Rng } from "../dice/index.js";
import type { DB } from "./db.js";
import { ftsIndex, ftsSearch } from "./fts.js";

export interface WorldDoc {
  rowid: number;
  name: string;
  content: string;
  category: string | null;
  tags: string | null;
  visible: number;
}

// 按 name 寻址(灌注不重名;AI/作者再写同名 = 覆盖)。name 无 UNIQUE 约束,代码层保证。
export function worldDocUpsert(
  db: DB,
  d: { name: string; content: string; category?: string; tags?: string; visible?: number },
): number {
  const existing = db.prepare("SELECT rowid FROM world_doc WHERE name=?").get(d.name) as { rowid: number } | undefined;
  let rowid: number;
  if (existing) {
    rowid = existing.rowid;
    db.prepare("UPDATE world_doc SET content=?, category=?, tags=?, visible=? WHERE rowid=?").run(
      d.content, d.category ?? null, d.tags ?? null, d.visible ?? 0, rowid,
    );
  } else {
    const info = db
      .prepare("INSERT INTO world_doc (name, content, category, tags, visible) VALUES (?, ?, ?, ?, ?)")
      .run(d.name, d.content, d.category ?? null, d.tags ?? null, d.visible ?? 0);
    rowid = Number(info.lastInsertRowid);
  }
  ftsIndex(db, "world_doc_fts", rowid, `${d.name}\n${d.content}${d.tags ? "\n" + d.tags : ""}`);
  return rowid;
}

export function worldDocGet(db: DB, name: string): WorldDoc | undefined {
  return db
    .prepare("SELECT rowid, name, content, category, tags, visible FROM world_doc WHERE name=?")
    .get(name) as WorldDoc | undefined;
}

export function worldDocSearch(db: DB, query: string, limit = 20): WorldDoc[] {
  const hits = ftsSearch(db, "world_doc_fts", query, limit);
  const stmt = db.prepare("SELECT rowid, name, content, category, tags, visible FROM world_doc WHERE rowid=?");
  return hits.map((h) => stmt.get(h.rowid) as WorldDoc).filter(Boolean);
}

export interface PoolAdd {
  pool: string;
  row: Record<string, unknown>;
  weight?: number;
  source?: "author" | "ai";
  visible?: number;
}

export function worldPoolAdd(db: DB, a: PoolAdd): number {
  const info = db
    .prepare("INSERT INTO world_pool (pool, row_json, weight, source, visible) VALUES (?, ?, ?, ?, ?)")
    .run(a.pool, JSON.stringify(a.row), a.weight ?? 1, a.source ?? "author", a.visible ?? 0);
  return Number(info.lastInsertRowid);
}

// 运行期 AI 现编(§4.3:source 是 author/ai 迁移钩子)。必经 store → 快照可覆盖。
export function worldRegister(db: DB, a: Omit<PoolAdd, "source">): number {
  return worldPoolAdd(db, { ...a, source: "ai" });
}

export function worldSample(
  db: DB,
  pool: string,
  n: number,
  opts: { filter?: Record<string, string | number>; rng?: Rng } = {},
): Record<string, unknown>[] {
  const rng = opts.rng ?? Math.random;
  let sql = "SELECT weight, row_json FROM world_pool WHERE pool=?";
  const args: (string | number)[] = [pool];
  if (opts.filter) {
    for (const [k, v] of Object.entries(opts.filter)) {
      sql += " AND json_extract(row_json, '$.' || ?) = ?";
      args.push(k, v);
    }
  }
  const rows = (db.prepare(sql).all(...args) as { weight: number; row_json: string }[]).map((r) => ({
    weight: r.weight,
    row: JSON.parse(r.row_json) as Record<string, unknown>,
  }));

  // 加权无放回抽样:每轮按剩余 weight 归一抽 1、移除,重复 n 次。
  const out: Record<string, unknown>[] = [];
  for (let k = 0; k < n && rows.length > 0; k++) {
    const total = rows.reduce((s, r) => s + r.weight, 0);
    let x = rng() * total;
    let i = 0;
    while (i < rows.length - 1 && x >= rows[i].weight) {
      x -= rows[i].weight;
      i++;
    }
    out.push(rows[i].row);
    rows.splice(i, 1);
  }
  return out;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/store/world.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/world.ts src/store/world.test.ts
git commit -m "feat(store): world doc 读写检索 + pool 加权抽样(RNG 注入)+ register

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: rule store(版本化读取 + 检索;AI 只读)

**Files:**
- Create: `src/store/rule.ts`
- Test: `src/store/rule.test.ts`

**Interfaces:**
- Consumes: `DB`(`db.ts`);`ftsIndex`, `ftsSearch`(Task 1/2)
- Produces:
  - `interface RuleDoc { rowid: number; name: string; content: string; category: string | null; version: number }`
  - `ruleUpsert(db, r: { name: string; content: string; category?: string }): number`(作者灌注/热更新:存在则覆盖 content 且 `version+1`,否则 INSERT `version=1`;返回 rowid;index `name+content`)
  - `ruleGet(db, name: string): RuleDoc | undefined`
  - `ruleSearch(db, query: string, limit?: number): RuleDoc[]`
  - 注:`rule.ts` **不暴露任何 AI 可写接口**(无 register)——反讨好红线,AI 只读([内层 §4.4](../../wiki/04-子系统设计/内层能力库.md))。

- [ ] **Step 1: 写失败测试 `src/store/rule.test.ts`**

```ts
import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import { ruleGet, ruleSearch, ruleUpsert } from "./rule.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("rule_doc", () => {
  test("首次 upsert version=1", () => {
    ruleUpsert(db, { name: "失败硬着陆", content: "判定失败必有代价", category: "裁决" });
    expect(ruleGet(db, "失败硬着陆")).toMatchObject({ name: "失败硬着陆", content: "判定失败必有代价", version: 1 });
  });
  test("热更新:同名再 upsert → 覆盖内容 + version 自增,不新增行", () => {
    ruleUpsert(db, { name: "失败硬着陆", content: "v1 内容" });
    ruleUpsert(db, { name: "失败硬着陆", content: "v2 内容" });
    expect(ruleGet(db, "失败硬着陆")).toMatchObject({ content: "v2 内容", version: 2 });
    expect(db.prepare("SELECT COUNT(*) c FROM rule_doc").get()).toMatchObject({ c: 1 });
  });
  test("FTS 检索(整段召回)", () => {
    ruleUpsert(db, { name: "失败硬着陆", content: "判定失败必有代价" });
    ruleUpsert(db, { name: "升级曲线", content: "经验与等级换算" });
    expect(ruleSearch(db, "代价").map((r) => r.name)).toEqual(["失败硬着陆"]);
  });
  test("热更新后旧内容搜不到(reindex)", () => {
    ruleUpsert(db, { name: "失败硬着陆", content: "旧表述甲乙丙" });
    ruleUpsert(db, { name: "失败硬着陆", content: "新表述丁戊己" });
    expect(ruleSearch(db, "旧表述")).toEqual([]);
    expect(ruleSearch(db, "新表述").map((r) => r.name)).toEqual(["失败硬着陆"]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/store/rule.test.ts`
Expected: FAIL（`./rule.js` 模块不存在）

- [ ] **Step 3: 写实现 `src/store/rule.ts`**

```ts
import type { DB } from "./db.js";
import { ftsIndex, ftsSearch } from "./fts.js";

export interface RuleDoc {
  rowid: number;
  name: string;
  content: string;
  category: string | null;
  version: number;
}

// 作者灌注 / 版本化热更新(§4.4)。AI 不可写 → 本文件不暴露 register/ai 接口。
export function ruleUpsert(db: DB, r: { name: string; content: string; category?: string }): number {
  const existing = db.prepare("SELECT rowid, version FROM rule_doc WHERE name=?").get(r.name) as
    | { rowid: number; version: number }
    | undefined;
  let rowid: number;
  if (existing) {
    rowid = existing.rowid;
    db.prepare("UPDATE rule_doc SET content=?, category=?, version=? WHERE rowid=?").run(
      r.content, r.category ?? null, existing.version + 1, rowid,
    );
  } else {
    const info = db
      .prepare("INSERT INTO rule_doc (name, content, category, version) VALUES (?, ?, ?, 1)")
      .run(r.name, r.content, r.category ?? null);
    rowid = Number(info.lastInsertRowid);
  }
  ftsIndex(db, "rule_doc_fts", rowid, `${r.name}\n${r.content}`);
  return rowid;
}

export function ruleGet(db: DB, name: string): RuleDoc | undefined {
  return db
    .prepare("SELECT rowid, name, content, category, version FROM rule_doc WHERE name=?")
    .get(name) as RuleDoc | undefined;
}

export function ruleSearch(db: DB, query: string, limit = 20): RuleDoc[] {
  const hits = ftsSearch(db, "rule_doc_fts", query, limit);
  const stmt = db.prepare("SELECT rowid, name, content, category, version FROM rule_doc WHERE rowid=?");
  return hits.map((h) => stmt.get(h.rowid) as RuleDoc).filter(Boolean);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/store/rule.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/rule.ts src/store/rule.test.ts
git commit -m "feat(store): rule 版本化读取 + FTS 检索(AI 只读,无 register)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 可见性写(sheet_show / world_show / reveal_once + 审计)

**Files:**
- Create: `src/store/visibility.ts`
- Test: `src/store/visibility.test.ts`

**Interfaces:**
- Consumes: `DB`(`db.ts`);`sheetGet`, `sheetSetRaw`(`./sheet.js`);`eventAppend`(`./event.js`)
- Produces:
  - `sheetShow(db, entity: string, attr?: string): void`(attr 级:`visible=1`,暗值 `visible=2` 焊死不改;entity 级:写策略 cell `(entity, __show_all, "1")`;均 append `kind=note`/`visible=0` 审计 event)
  - `worldShow(db, table: "world_doc" | "world_pool", rowid: number): void`(置 `visible=1` + 审计 event)
  - `interface RevealTarget { kind: "sheet"; entity: string; attr: string } | { kind: "world_doc"; rowid: number }`
  - `revealOnce(db, target: RevealTarget): number`(读目标当前值,append `kind=reveal`/`visible=1` event 存冻结副本到 `data_json`;**不碰目标 `visible`**;返回 seq)

- [ ] **Step 1: 写失败测试 `src/store/visibility.test.ts`**

```ts
import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import { sheetGet, sheetSetRaw } from "./sheet.js";
import { eventSince } from "./event.js";
import { worldDocUpsert } from "./world.js";
import { revealOnce, sheetShow, worldShow } from "./visibility.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("sheetShow", () => {
  test("attr 级置 visible=1 + 审计 note(对玩家隐)", () => {
    sheetSetRaw(db, "张三", "HP", "30", 0);
    sheetShow(db, "张三", "HP");
    expect(sheetGet(db, "张三", "HP")!.visible).toBe(1);
    const note = eventSince(db, 0).find((e) => e.kind === "note");
    expect(note!.visible).toBe(0);
  });
  test("暗值 visible=2 焊死,attr 级 show 不揭", () => {
    sheetSetRaw(db, "张三", "底牌", "杀招", 2);
    sheetShow(db, "张三", "底牌");
    expect(sheetGet(db, "张三", "底牌")!.visible).toBe(2);
  });
  test("entity 级写 __show_all 策略 cell", () => {
    sheetShow(db, "张三");
    expect(sheetGet(db, "张三", "__show_all")!.value).toBe("1");
  });
});

describe("worldShow", () => {
  test("置 world_doc.visible=1 + 审计", () => {
    const rowid = worldDocUpsert(db, { name: "青云门", content: "正道大派" });
    worldShow(db, "world_doc", rowid);
    expect(db.prepare("SELECT visible FROM world_doc WHERE rowid=?").get(rowid)).toMatchObject({ visible: 1 });
    expect(eventSince(db, 0).some((e) => e.kind === "note" && e.visible === 0)).toBe(true);
  });
});

describe("revealOnce", () => {
  test("sheet:append kind=reveal 可见 event 存冻结值,不碰目标 visible", () => {
    sheetSetRaw(db, "张三", "真名", "赵四", 0);
    const seq = revealOnce(db, { kind: "sheet", entity: "张三", attr: "真名" });
    const ev = eventSince(db, 0).find((e) => e.seq === seq)!;
    expect(ev.kind).toBe("reveal");
    expect(ev.visible).toBe(1);
    expect(JSON.parse(ev.data_json!)).toMatchObject({ kind: "sheet", entity: "张三", attr: "真名", value: "赵四" });
    // 目标底层仍隐
    expect(sheetGet(db, "张三", "真名")!.visible).toBe(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/store/visibility.test.ts`
Expected: FAIL（`./visibility.js` 模块不存在）

- [ ] **Step 3: 写实现 `src/store/visibility.ts`**

```ts
import type { DB } from "./db.js";
import { sheetGet, sheetSetRaw } from "./sheet.js";
import { eventAppend } from "./event.js";

// 可见性变更审计:kind=note、visible=0(对玩家隐),供 L3 / 回看(§4.2)。
function auditNote(db: DB, content: string): void {
  eventAppend(db, { kind: "note", content, visible: 0 });
}

// attr 级:指定 cell 置 1(暗值 visible=2 焊死,不揭);entity 级(省 attr):写长效策略 cell __show_all。
export function sheetShow(db: DB, entity: string, attr?: string): void {
  if (attr === undefined) {
    sheetSetRaw(db, entity, "__show_all", "1");
    auditNote(db, `揭示:${entity} 全卡(__show_all)`);
    return;
  }
  db.prepare("UPDATE sheet SET visible=1 WHERE entity=? AND attr=? AND visible!=2").run(entity, attr);
  auditNote(db, `揭示:${entity}.${attr}`);
}

export function worldShow(db: DB, table: "world_doc" | "world_pool", rowid: number): void {
  // table 是字面量联合类型(非用户自由输入)→ 插值安全。
  db.prepare(`UPDATE ${table} SET visible=1 WHERE rowid=?`).run(rowid);
  auditNote(db, `揭示:${table}#${rowid}`);
}

export type RevealTarget =
  | { kind: "sheet"; entity: string; attr: string }
  | { kind: "world_doc"; rowid: number };

// reveal_once:append 一条 kind=reveal 的可见 event,内容=目标此刻冻结副本;不碰目标自身 visible(底层仍隐)。
export function revealOnce(db: DB, target: RevealTarget): number {
  if (target.kind === "sheet") {
    const cell = sheetGet(db, target.entity, target.attr);
    if (!cell) throw new Error(`revealOnce: sheet cell 不存在 ${target.entity}.${target.attr}`);
    return eventAppend(db, {
      kind: "reveal",
      visible: 1,
      content: `${target.entity}.${target.attr} = ${cell.value}`,
      data_json: { kind: "sheet", entity: target.entity, attr: target.attr, value: cell.value },
    });
  }
  const doc = db.prepare("SELECT name, content FROM world_doc WHERE rowid=?").get(target.rowid) as
    | { name: string; content: string }
    | undefined;
  if (!doc) throw new Error(`revealOnce: world_doc#${target.rowid} 不存在`);
  return eventAppend(db, {
    kind: "reveal",
    visible: 1,
    content: doc.content,
    data_json: { kind: "world_doc", rowid: target.rowid, name: doc.name, content: doc.content },
  });
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/store/visibility.test.ts`
Expected: PASS

- [ ] **Step 5: 跑全量测试 + strict 编译兜底**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 所有测试 PASS;`tsc` 无输出(strict 编译全绿)。

- [ ] **Step 6: Commit**

```bash
git add src/store/visibility.ts src/store/visibility.test.ts
git commit -m "feat(store): 可见性写(sheet_show/world_show/reveal_once + 审计 event)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 本 plan 之外(留后续 plan)

- **MCP 工具面(组件2)**:把本层包成 `dicelore_*` 工具 + Zod schema;`sheet_show`/`world_show`/`reveal_once`/`world_register`/`world_sample`/`*_search` 等的薄包装与入出参 schema → [MCP工具面](../../wiki/04-子系统设计/MCP工具面.md)。
- **回合快照(ADR-0017,并行线)**:`snapshot` 表、IoC 参与者注册表、`checkpoint`/`restore`;`world.runtime`(source=ai 部分)与 `sheet`/`watcher` 注册为 participant。本 plan 只保证「一切运行期写经 store」这条铁律前提。
- **可见性渲染判定**:cell 可见 ⟺ `visible=1 ∨ (有 __show_all ∧ visible≠2)`;event 按 `visible` 过滤渲染 → 输出层(adapter,组件4)。
- **`eventRecall` 的当前分支 seq 过滤**(§4.5.3):由快照线/adapter 在上层按 head 祖先链 seq 集叠加,本层只做全量 FTS+tag 召回。
- **团本灌注 import**:把 manifest 的 world/rule 底料(CSV 卡池、markdown 规则)import 进库 → [团本与 manifest](../../wiki/04-子系统设计/团本与manifest.md)(本 plan 提供 `worldDocUpsert`/`worldPoolAdd`/`ruleUpsert` 落库原语)。
