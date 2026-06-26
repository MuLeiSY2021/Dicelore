# ADR 草案：storage-port（mcp↔后端存储解耦）

> 状态：**草案 / 设计中**（2026-06-26）。落地验证通过后沉淀进 [05-ADR](../wiki/05-决策记录-ADR/) 正式编号。
> 关联：[目标目录结构](目标目录结构.md)。本 ADR 是其 `packages/interface/` + backend/harness 拆分的「为什么 / 怎么接」单源。

---

## 1. 背景与触发

把 `core` grab-bag 拆成四根（`harness/backend/frontend/packages`）时撞到**包级循环依赖**：

```
backend/api  ──→  harness/DiceSession  ──→  harness/mcp  ──→  backend/store
   └──────────────────────── 环 ───────────────────────────────┘
```

`api`（后端）驱动会话、会话的 `mcp` 工具面直读 `store` → `@dicelore/backend` 与 `@dicelore/harness` 互相 import。
单纯搬文件解不掉——必须**断一条边**。

用户决策（2026-06-26）：**不靠挪位避环，而是建 storage-port**——因为目标本就是「agent 不直连 store、经接口声明存储，后端将来可加 cache / 远程 / 多租户」。这与项目 anti-F1 铁律（AI 只给引用、MCP 执行）同构，把它推进一层：**mcp 只声明存储意图、backend 执行**。

## 2. 决策

**依赖倒置**：在 `packages/interface`（中立包）定义 backend 面向 harness 的**端口接口**；`harness` 只依赖接口；`backend` 实现接口；**组合根 `backend/server.ts` 构造实现、按会话注入 harness**。

```
harness/mcp、DiceSession  ──→  packages/interface (端口类型)
backend/*                 ──实现──→  packages/interface
backend/server (组合根)   ──注入实现──→  harness 会话
```

断环原理：harness→backend 这条边被**反转**为 harness→interface←backend，只剩 backend→harness（组合根驱动会话）这一条方向边，无环。

## 3. 端口表面（据跨边界扫描 §scan 圈定）

按职责分组定义（一个会话拿到一束 db 已绑定的端口）：

> **命名约定**：接口按领域概念命名，**不带 `Port`/`I` 后缀**（那是 C#/Java 遗留装饰；TS 里接口与实现可同名共存，backend 直接 `class Store implements Store`）。「端口」只作架构叙述词，不进类型名。

| 接口 | 覆盖 | 来源模块 |
|---|---|---|
| `Store` | sheet/event(log)/world/rule/watcher/pendingChoice/pendingRoll/mutations + 相关 row 类型 | store（29 符号） |
| `Resolver` | resolveContest / resolveOutcome / commitPendingRoll | resolve |
| `Snapshots` | checkpoint / restore / latestSnapshot / listSnapshots | store/snapshot |
| `Catalog` | importPack（开局物化）+ catalog 读 | catalog |
| `Presentation` | buildPresentationModel | present |
| `Meta` | metaGet / metaSet | session（KV 部分） |
| `Toolgen` | toolgenToToolDef / ToolDecl | toolgen |

> `openSession` 的**路径策略**（appDataRoot 等）**不进端口**——它是宿主决策，归 `harness/runtime/paths.ts`（[目标结构](目标目录结构.md) 决策③）。`DB` 句柄类型也下沉 `packages/interface`（或继续由 better-sqlite3 类型表达），端口方法**不暴露原始 db**——db 由 backend 在构造端口实现时捕获，harness 调用方不传 db。

聚合：`interface` 导出 `SessionBackend = Store & Resolver & Snapshots & Catalog & Presentation & Meta & Toolgen`（按会话一个实例）。harness 的 `createMcpServer` / `DiceSession` 改收 `SessionBackend` 而非 `db + 直接 import`。

## 4. 组合根与生命周期

- `backend/` 提供 `openSessionBackend(db): SessionBackend`——把 store/resolve/present/... 的函数用闭包绑定 db，组装成实现对象。
- `backend/api` 开局：解析会话 db（经 `harness/runtime/paths`）→ `importPack`（`Catalog`，开局物化）→ `openSessionBackend(db)` → 传给 `harness` 的会话工厂建 `DiceSession`。
- `DiceSession`（harness）不再 `openDb` / 直接 import store；构造收 `SessionBackend`，`createMcpServer` 的 handler 经端口调用。

## 5. 迁移计划（增量、保绿、可逆中途）

分阶段，每阶段 typecheck+test 绿才进下一步：

1. **建 `packages/interface`**：先只放端口**类型**（从现 store/resolve/... 的签名抄）。零行为。
2. **store 等迁入 `backend/`**：store/resolve/present/snapshot/catalog/toolgen/eval/meta 物理挪进 `backend/`（暂仍可被 harness 直接 import，先不断环）——纯文件搬，绿。
3. **backend 实现端口** `openSessionBackend(db)`：组装实现对象，导出。
4. **harness 改经端口**：`createMcpServer` 与 `DiceSession` 收 `SessionBackend`，handler 把直接调用换成 `backend.xxx()`；删 harness→backend 的直接 import。**此步断环**。
5. **mcp/adapter/orchestrator 迁入 `harness/`**：mcp→dicegm/mcp、adapter 拆、pkg→runtime、dice→dicegm、lore→loregm。
6. **api/server 迁入 `backend/`**，组合根接线。
7. **溶解 core**、清 workspaces、全量绿。

> 第 1–3 步无悔可逆；第 4 步是断环关键、也是不可逆架构落点；第 5–7 是结构搬迁。中途任一步可停且仓库可编译。

## 6. 被否 / 备选

- **挪位避环**（api 放 harness）：能断环且零端口，但拿不到「后端可换存储 / 加 cache」的目标收益——用户明确要端口本身的价值，故否。
- **store 留 packages/**：backend 与 harness 都依赖 packages/store，无环、最省事，但 mcp 仍直连 store（要拆的耦合还在）——作为「先不做端口」的退路存在，本 ADR 选了做端口故不取。

## 7. 代价（睁眼接受）

- 端口表面大（~40 符号）、handler 全量改调用点——一次性重构成本高。
- 多一层间接（端口调用 vs 直接函数）——但都是进程内、无 IPC，可忽略。
- 端口与 store 函数签名要保持同步（store 改了端口要跟）——用 TS 类型让编译器盯住。
- 收益：backend 可换存储实现 / 加 cache / 远程化，harness 完全不知存储细节；且**断了 backend↔harness 环**，四根结构成立。
</content>
