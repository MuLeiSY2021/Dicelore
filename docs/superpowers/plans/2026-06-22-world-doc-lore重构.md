# world_doc → lore 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 把运行时存储的 `world_doc` 表/概念重命名为 `lore`：表 `world_doc`→`lore`、虚表 `world_doc_fts`→`lore_fts`、`store/world.ts` 内的 `worldDocUpsert/Get/Search`→`loreUpsert/Get/Search`、`WorldDoc` 接口→`Lore`。**`world_pool` 表 / `worldPoolAdd` / `worldSample` 完全不动**（卡池域，非散文底料）。expr/watcher 引用约定不变。这是数据层 phase-1 最后一个改名。

**Architecture:** 就地两段改名（同 event→log，非复制并存）。① **Task 1 = 表名 `world_doc`→`lore`**（连同 `world_doc_fts`→`lore_fts`、所有内嵌 SQL、以及 `visibility.ts`/`io.ts` 里 `"world_doc"` 这个**内部目标判别串**→`"lore"`），**函数/类型名暂留 `worldDoc*`/`WorldDoc`**——调用经不变函数命中改名后的 `lore` 表，全程绿。② **Task 2 = 标识符改名**（`worldDoc*`→`lore*`、`WorldDoc`→`Lore` + 全 importers），**就地**（`worldDoc*` 留在 `store/world.ts`，不抽新文件；`world.ts` 同时保有 `worldPool*`，最小改动）。

**Tech Stack:** TypeScript（ESM）、better-sqlite3、Vitest、`tsc --noEmit`。

## Global Constraints

- **不改 `src/expr/*`**。
- **`world_pool` 域全不动**：`db.ts` 的 `world_pool` 表、`store/world.ts` 的 `worldPoolAdd`/`worldSample`、相关测试，**保持原样**。本 plan 只迁 `world_doc` 部分。
- **MCP 工具名保留**：`world_search`/`world_sample`/`world_register`/`world_show` 工具名、`mcp/schemas/world.ts` 的 schema 变量名（`worldSearchOut` 等）、`schemas/world.ts`/`handlers/world.ts` **文件名**——全不动，只改 handler 内部的 import/函数调用。
- **`"world_doc"` 判别串**：`visibility.ts`/`io.ts` 里 `worldShow`/`RevealTarget` 用 `"world_doc"`|`"world_pool"` 区分披露目标——这是**内部判别串、非工具 schema 枚举、无外部消费方**（grep 确认只写不读解析）。改 `"world_doc"`→`"lore"` 保持一致，**不影响工具契约**。`"world_pool"` 不动。
- 每个任务结束：`npm test`（基线 45 文件 210 测试）+ `npm run typecheck` 绿，scoped commit（`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`），不 `git add -A`。
- worktree `.claude/worktrees/world-lore`（已 npm install、基线绿）。

---

### Task 1: 表名 `world_doc`→`lore` + `world_doc_fts`→`lore_fts`（函数名暂留）

**Files:**
- Modify: `packages/core/src/store/db.ts`（`CREATE TABLE world_doc` → `lore`；**`world_pool` 表不动**）
- Modify: `packages/core/src/store/fts.ts`（`FTS_TABLES` 里 `"world_doc_fts"`→`"lore_fts"`）
- Modify: `packages/core/src/store/world.ts`（`worldDoc*` 函数内部 SQL `FROM/INTO world_doc`→`lore`；`ftsIndex/ftsSearch(db,"world_doc_fts",...)`→`"lore_fts"`；函数/类型名暂留）
- Modify: `packages/core/src/store/visibility.ts`（`worldShow` 的 SQL `FROM world_doc`→`lore`；`worldShow` 参数类型联合 `"world_doc"|"world_pool"`→`"lore"|"world_pool"`；`RevealTarget` 的 `kind:"world_doc"`→`"lore"`；错误消息与写入的 `data_json.kind` 里的 `"world_doc"`→`"lore"`）
- Modify: `packages/core/src/mcp/handlers/io.ts`（`worldShow(db,"world_doc",...)` 的字符串实参 `"world_doc"`→`"lore"`）
- Modify（测试内联 SQL / 表名断言 / 判别串）：`packages/core/src/store/db.test.ts`（表名数组 `"world_doc"`→`"lore"`、FTS 数组 `"world_doc_fts"`→`"lore_fts"`）、`packages/core/src/store/fts_db.test.ts`（若引用 `world_doc_fts` 字面量则改 `lore_fts`）、`packages/core/src/store/visibility.test.ts`（`"world_doc"` 判别串 / `FROM lore` 相关断言）

**Interfaces:**
- Produces：底层表已是 `lore`、虚表 `lore_fts`；判别串 `"lore"`。函数/类型名本任务**不变**（仍 `worldDocUpsert/Get/Search`、`WorldDoc`），下层表已切。

- [ ] **Step 1: 先改 `db.test.ts` 表断言（红）**

把 `db.test.ts` 表名数组里的 `"world_doc"`→`"lore"`、FTS 数组 `"world_doc_fts"`→`"lore_fts"`（`"world_pool"` 不动）。

- [ ] **Step 2: 跑确认红**

Run: `cd packages/core && npx vitest run src/store/db.test.ts`
Expected: FAIL（断言期望 `lore`/`lore_fts` 表存在，但 schema 仍建 `world_doc`/`world_doc_fts`）

- [ ] **Step 3: 改表名 + FTS + 所有 SQL/判别串**

1. `db.ts`：`CREATE TABLE IF NOT EXISTS world_doc (...)` → `lore`（**`world_pool` 表保持原样**）。
2. `fts.ts`：`FTS_TABLES` 的 `"world_doc_fts"`→`"lore_fts"`（其余不动）。
3. `world.ts`：`worldDoc*` 函数内部 `INSERT INTO world_doc`/`SELECT ... FROM world_doc`→`lore`；`ftsIndex(db,"world_doc_fts",...)` 与 `ftsSearch(db,"world_doc_fts",...)`→`"lore_fts"`。函数名 `worldDocUpsert/Get/Search`、`WorldDoc` 接口**保留**。`worldPoolAdd`/`worldSample` 不碰。
4. `visibility.ts`：`worldShow` 内 `FROM world_doc`→`FROM lore`；参数类型联合 `"world_doc"|"world_pool"`→`"lore"|"world_pool"`；`RevealTarget` 的 `kind:"world_doc"`→`"lore"`；错误消息与 `data_json.kind` 的 `"world_doc"`→`"lore"`。`"world_pool"` 全留。
5. `io.ts`：`worldShow(db,"world_doc",...)` 的实参 `"world_doc"`→`"lore"`。
6. 测试内联：`fts_db.test.ts`/`visibility.test.ts` 里 `"world_doc"`/`"world_doc_fts"` 字面量随之改（`world_pool` 相关不动）。

- [ ] **Step 4: 跑全套绿**

Run: `cd packages/core && npm test && npm run typecheck`
Expected: 45 文件 210 测试绿；tsc 干净。

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/store/db.ts packages/core/src/store/fts.ts packages/core/src/store/world.ts packages/core/src/store/visibility.ts packages/core/src/mcp/handlers/io.ts packages/core/src/store/db.test.ts packages/core/src/store/fts_db.test.ts packages/core/src/store/visibility.test.ts
git commit -m "refactor(store): world_doc 表→lore + world_doc_fts→lore_fts + 判别串（函数名暂留）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 标识符改名 `worldDoc*`→`lore*`、`WorldDoc`→`Lore`（就地，不抽新文件）

**Files:**
- Modify: `packages/core/src/store/world.ts`（`worldDocUpsert/worldDocGet/worldDocSearch`→`loreUpsert/loreGet/loreSearch`；`interface WorldDoc`→`Lore`。**`worldPoolAdd`/`worldSample`/`PoolAdd` 等不动**，仍留本文件）
- Modify（importers：函数/类型名替换，导入路径仍 `./world.js`/`../store/world.js`——文件名不变）：`packages/core/src/mcp/handlers/world.ts`（`worldDocSearch`/`worldDocUpsert`/`WorldDoc`）、`packages/core/src/mcp/handlers/io.ts`（`worldDocGet`）、`packages/core/eval/seeds/orc-hunt-seed.ts`（`worldDocUpsert` ×5）
- Modify（测试）：`packages/core/src/store/world.test.ts`（worldDoc* 用例改名；worldPool 用例不动）、`packages/core/src/mcp/handlers/world.test.ts`、`packages/core/src/mcp/handlers/io.test.ts`

**Interfaces:**
- Consumes：Task 1 的 `lore` 表。
- Produces：`store/world.ts` 导出 `loreUpsert(db, d): number`、`loreGet(db, name): Lore | undefined`、`loreSearch(db, query, limit?): Lore[]`、`interface Lore`。`worldPoolAdd`/`worldSample` 不变（同文件并存）。

- [ ] **Step 1: 纯改名（无新行为，先实现再跑全套回归）**

在 `store/world.ts`：`worldDocUpsert`→`loreUpsert`、`worldDocGet`→`loreGet`、`worldDocSearch`→`loreSearch`、`interface WorldDoc`→`interface Lore`（及其引用）。`worldPoolAdd`/`worldSample`/pool 相关标识符**不动**。

- [ ] **Step 2: 改全部 importers + 测试**

对 `mcp/handlers/world.ts`、`mcp/handlers/io.ts`、`eval/seeds/orc-hunt-seed.ts` 及测试 `store/world.test.ts`、`mcp/handlers/world.test.ts`、`mcp/handlers/io.test.ts`：把 `worldDocUpsert/Get/Search`→`lore*`、`WorldDoc`→`Lore`。导入路径仍 `world.js`（文件名不变）。worldPool 相关不动。

- [ ] **Step 3: 跑全套回归 + 改名残余自检**

Run: `cd packages/core && npm test && npm run typecheck`
Expected: 45 文件 210 测试绿；tsc 干净。
Run: `grep -rn "worldDocUpsert\|worldDocGet\|worldDocSearch\|WorldDoc\b\|world_doc" src eval`
Expected: 无输出（`world_pool`/`worldPool*`/`worldSample` 不在此模式内，保留正常；若 schemas/world.ts 有 `worldSearchOut` 等不匹配本 grep）。

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor(store): worldDoc* 标识符改名 lore*（就地，world_pool 不动）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage：** `world_doc`→`lore` 表 ✓（T1）；`world_doc_fts`→`lore_fts` ✓（T1）；`worldDoc*`→`lore*`、`WorldDoc`→`Lore` ✓（T2）；`world_pool` 域不动 ✓（约束）；expr 不动 ✓。
- **保留项**：MCP 工具名 `world_*`、schemas/world.ts 变量名与文件名 ✓（约束）。
- **不在本 plan**：`store/world.ts` 拆成 `lore.ts` + `pool.ts`（cosmetic 结构整理，留后续）；lore 的 `category`/`tags`/双层等语义增强（视图层及之后）。

**为何就地改名不复制：** world_doc 中等耦合（visibility/io/handler 读写），复制并存会让中间态不一致；就地（表名先行、标识符后行）每段绿、且 worldDoc* 留 world.ts 最小改动。

**判别串注意：** `"world_doc"`→`"lore"` 是内部判别串（无外部消费），与工具 schema 无关——T1 已把 visibility/io 的串与 SQL 一起改，避免"判别串说 lore、schema 仍 world_doc"之类只发生在内部、不破工具契约。

**类型一致性：** T2 `WorldDoc`→`Lore` 在 world.ts 定义，handlers/world.ts（含 `WorldDoc` 类型引用）、io.ts、seeds、测试同步；`worldPool*`/`worldSample` 全程不在改名集内。
