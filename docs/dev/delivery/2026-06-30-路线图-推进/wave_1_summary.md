# wave_1 复盘（2026-06-30）

5 个独立后端需求并发交付，**全部合入本地 main**（未 push）。Workflow task `wu7rhi51a`（10 agent / ~812k token）。

## 合了哪些

| 需求 | 结果 | 验收 |
|------|------|------|
| `usage-api` | `createUsageApp` GET /sessions/:id/usage 投影 store/usage 现成查询 | 3 单测；verdict concerns（仅「未挂载=死端点」，集成时主 agent 挂解决） |
| `key-host` | `store/keys.ts` AES-256-GCM 加密落库（env 主密钥+随机 IV+GCM tag），db.ts 加 api_key 表，createKeysApp 存/取/删 | 25 单测；verdict pass；非明文落库已断言 |
| `ssrf` | diagnostics model-test/mcp-test 发请求前 checkSsrf：node:net BlockList 挡私网/环回/元数据段 + 限 https + DNS 解析防 rebinding + IPv4-mapped 归一 | 37 单测；verdict pass |
| `ratelimit` | per-session 限流中间件（宽松默认 60s/120，env 收紧/关闭，429） | verdict pass |
| `rt1` | `store/turnRollback.ts`（turnStartSeq + rollbackAfterSeq 删 log+逆放 state），turnLoop errored 调回滚 | verdict concerns→接力修 |

## subagent 撞到啥 / 怎么决断

- **集成接线归主 agent**：`server.ts` 不归任何节点；主 agent 集成时挂 usage/keys 路由 + 限流中间件 + 全局 keys.db（commit e45e8d3）。`index.ts` key-host/rt1 双改 → git 自动合。
- **rt1 对抗审查抓到真 bug（FTS 孤儿）**：`rollbackAfterSeq` 删 log 不删 `log_fts` → 搜得到已删内容 + 无界增长。**起接力 agent 修**：确认 `log_fts.rowid===log.seq`，同事务复用 `ftsDelete` 清净；顺带修 CONCERN-3（单事件同 attr 倒序逆放）+ CONCERN-2 注释收紧 + 4 新测试。修后合入。
- **rt1 冒泡 1 不可逆决策**（residue=pending_roll/watcher 副作用是否结构化推前端）→ 主 agent 按可逆判据自决：本轮 log-only，结构化推前端归 backlog-前端 CROSS-ERR / v2 SNAP-1。
- 集成态全绿：typecheck:all 干净 + test:all（backend 73 文件、frontend 21、harness 36+1skip、shared/logs/interface/dice）。

## 验证「按需求切」新模型

5 需求各一 worktree 真并行，文件天然不重叠（除 index.ts git 自动合），server.ts 跨切面接线归主 agent——正是「按需求切、冲突集成时解」。worktree/分支已清。

## ⚠️ 待用户决断（裁决闸）

本轮交付**早于**「裁决文件+用户批准」闸的确立（用户 2026-06-30 中途立）。wave1 已成既成事实；**wave2/wave3（usage-stream / co-play / co-build / sec2-fe）是否补走裁决闸（写裁决文件→用户勾→再交付）待用户定**。
