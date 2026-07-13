# 决策账本（2026-06-30 扫描 · roadmap-delivery-workflow 新一轮）

> 范围：里程碑二 CO 前端可视化 + 里程碑四 SEC2 key 托管 + RT-1 中期回合级事务。
> 前置：归档撤除 + ADR 清除 + 漂移打底已合 main（2026-06-30）。基线绿（typecheck:all + test:all exit 0）。

---

## 可逆（已自决，记默认值供回溯，无需用户）

- **[usage HTTP 端点形状]** 取 `GET /sessions/:id/usage` 回 `{ byTurn: [...], byAgent: [...], session: totals, rows?: list }`，复用 `store/usage.ts` 现成 `usageByTurn/Agent/Session/listUsage`。理由：查询面已齐，端点只做投影；只读、可逆。
- **[金钱换算单价来源]** 前端按模型单价表换算（前端常量/配置），后端只回 raw token 数。理由：单价随模型/汇率变，放前端便于改；后端不耦合计费。可逆。
- **[SEC2 key 落库形态]** 后端托管：key 落库（SQLite，至少不明文——env 主密钥 + 对称加密或 OS keychain 视实现），前端只存 `key_id` 引用、client.ts 调后端代发（ADR-0027 定稿口径）。具体加密实现由 implement agent 选最简稳妥方案。可逆（内部存储细节）。
- **[SSRF 白名单]** 无悔半先交付：model-test/mcp-test 的 baseUrl/endpoint **挡私网/环回/元数据 IP 段（127/10/172.16-31/192.168/169.254/::1 等）+ 限 https**。放行哪些外部 host=配置项（默认放行用户已配的 baseURL host），不写死。理由：挡私网=纯安全无悔；放行清单交配置。
- **[SEC2 限流]** per-session 基础速率/配额，默认宽松值（实现 agent 定合理默认），env 可覆盖。可逆。
- **[RT-1 回合级回滚原语放哪]** 新建 `backend/src/store/turnRollback.ts`：`turnStartSeq(db)` 读 MAX(seq)、`rollbackAfterSeq(db, seq)` 删 `log WHERE seq > seq` + 回滚受影响 state（复用 SNAP-1 同根思路，但走 DELETE 非快照 restore）。理由：与 snapshot.ts（v1 自动持久化）分属两机制，中期事务用轻量 DELETE。可逆。
- **[BE 节点合一]** usage 端点 + SEC2 key/SSRF/限流 合成一个 backend 节点（都改 backend/src/api + server.ts 挂载），避免兄弟节点撞 server.ts。理由：沿缝切第一约束（同波兄弟不碰同文件）。

## 不可逆（攒着，一次问用户）

- （本轮无新增）SEC2 经 ADR-0027 定稿口径已确认、RT-1 中期已裁决——用户本轮 AskUserQuestion 已划定范围（SEC1/SEC3/MT1/S1/S2 推 v2）。无需再问。

## 浮现（subagent 干活时回报；可逆即自决回填、不可逆攒下批）

- （待 Workflow 冒泡回填）
