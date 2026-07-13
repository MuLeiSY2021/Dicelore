# Wave 3 复盘（2026-07-02 · transcript-datadir-buildeval）

## 本波节点（3，依赖 W1/W2，文件域不重叠）
| 节点 | 分支 | 结果 |
|------|------|------|
| DD3 server-cli-converge | `DD3` | ✅ 合入 main |
| TR3 dice-anchor | `TR3` | ✅ 合入 main |
| TR4 lore-jsonl | `TR4` | ✅ 合入 main |

三节点对抗测试均 pass、无 blockedOnDependency。文件域完全不重叠、合并无冲突。

## 交付内容
- **DD3**：server.ts 收敛到单一数据根——`resolveDataDir` → 规范化写 `DICELORE_DATA_DIR`（供 openSession/appDataRoot/继承 env 的 MCP 子进程派生同根）→ `applyConfigEnv` → `ensureConfigExample` → `resolvePort`（config.toml `[env] PORT` 生效、真实 env/--port 优先）→ `initGlobalLogger(join(root,'logs'))`；catalog.db/keys.db 派生自 root；**彻底删** `DICELORE_SESSIONS_DIR`/`DICELORE_CATALOG` 读取。cli.ts 加 `serve` 命令、共用 resolveDataDir。resolve.ts `appDataRoot()` 复用 resolveDataDir（显式根压过遗留 SESSIONS_DIR，无显式根才兜底 SESSIONS_DIR 保 eval/旧脚本/单测）。live 冒烟：config.toml PORT=8931 生效、真实 PORT=8932 覆盖证优先级、各 artifact 落 $ROOT。
- **TR3**：snapshot 加 `transcript_anchor TEXT`（幂等 ALTER 迁移旧库）+ `restoreToAnchor(db,uuid)`；DiceSession.turnEnd 从 `transcript.head()` 取 anchorUuid 传 checkpoint（transcript 先铸、db 后锚）；DiceSession.rewindTo 建 Rewind + 注册 `dice-db` hook；`POST /rewind` 加可选 `{toUuid}`（带→UUID 回退，不带→旧 host.rewind() 向后兼容）；Snapshots 端口 additive 加 restoreToAnchor。
- **TR4**：LoreSessionDeps 加 dataDir；handleMessage 补传 sessionId+dataDir+kind:'lore' → loregm 落 `$ROOT/sessions/lore/<id>/<id>_session.jsonl`；`createLoreDraftHook` 注册（warn+no-op）。REST-only 不变。

## 集成收尾修复（主 agent）
- **修 DD3 冒泡的观测漂移**：`diagnostics.ts:151` 原读 `DICELORE_SESSIONS_DIR`，收敛后 server 只设 `DICELORE_DATA_DIR` → `/health` 会把 sessionsDir 报成 `'.'`。改为 `DICELORE_DATA_DIR ?? DICELORE_SESSIONS_DIR ?? '.'`。
- **记两条 follow-up 进 backlog-后端**：
  - **RT-7**：dice transcript 缺 `turn_end` 行（`DiceGm.turnEnd()` 在 `yield turn_end` 后，被 streamTurn break 的 `.return()` 跳过、不可达）→ `rewindLast` 对 dice 落空（TR3 用 `head()` 锚绕开、`rewindTo` 正常）。修：turn_end 落行责任上移 DiceSession。
  - **RT-8**：lore Draft 按轮快照/回退未实现（lore-draft hook v1 no-op）。

## 集成后全量验证（本地 main）
- `npm run typecheck` ✅（含 diagnostics 修复）· backend 585 测 ✅ · harness 213 测(1 skipped) ✅。

## 放行下游
- DD3 合入 → 解锁 **DD4**(refs-migration)、**TR7**(eval-setup)；TR4 合入 → 解锁 **TR5**(build-eval-skill)。→ Wave 4（末波）= {DD4, TR7, TR5}。
