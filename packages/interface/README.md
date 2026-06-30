# @dicelore/interface — harness↔backend 跨层契约（中立包）

`harness`（agent 运行时）与 `backend`（存储/服务）之间的**中立契约层**：storage-port 的端口接口 `SessionBackend` + 它方法面引用的域类型 + 跨层共享的 `ToolDef`/`DB`。**依赖倒置**——双方都依赖此处、彼此不互相 import，借此断 backend↔harness 模块级环。在四根架构里属 `packages/`（纯库）。

> 为什么存在、端口表面怎么圈定 → 见 [`docs/wiki/05-决策记录-ADR/README.md`](../../docs/wiki/05-决策记录-ADR/README.md) ADR-0028（决策①②③）。

```
src/
  backend.ts   端口接口 SessionBackend（Store & Resolver & Meta & Usage & Snapshots & Presentation & Catalog 的聚合）
  domain.ts    SessionBackend 方法面引用的「域类型」（type-only，从 store/resolve/expr 下沉至此，避免 interface↔backend 环）
  index.ts     DB 句柄别名 + ToolDef/ToolAnnotations（跨工具面与 toolgen 两层）+ truncateText 助手；re-export domain/backend
```

依赖：叶包 `@dicelore/dice`（域类型引 `Rng`）+ `better-sqlite3`（`DB` 句柄类型，type-only）+ `zod`（`ToolDef.inputSchema` schema 类型）。`backend` 实现接口、`harness` 经注入的接口调存储——见 [ADR-0028 决策④ 组合根与生命周期](../../docs/wiki/05-决策记录-ADR/README.md)。

约定：接口按领域概念命名，**不带 `Port`/`I` 后缀**；端口方法**不收会话 `db` 参**（db 由 backend 在 `openSessionBackend(db)` 时闭包捕获）。唯一例外是 `Catalog.importPack` 收外部团本库句柄 `catalogDB` 作业务入参（非会话 db）。
