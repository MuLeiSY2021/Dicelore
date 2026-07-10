# wave_1_summary（2026-07-10 · 会话面拉平 + 独立地基契约）

## 结果：7/7 节点交付并合入 main，集成后 typecheck:all + test:all 全绿

| 节点 | 分支 | self-test | 对抗测试 | 合并 |
|------|------|-----------|----------|------|
| session-surface-flatten | wf-1 | ✅ typecheck+test | ✅ pass（13 业务用例：响应体 schema 严解/跨面串扰 404/packName 必填…）| ✅ |
| gm-session-continuity | wf-2 | ✅ | ✅ pass（透传缝端到端断言 options.resume）| ✅ |
| narrative-visible-column | wf-3 | ✅ | ✅ pass | ✅ |
| usage-stream-schema | wf-4 | ✅ | ✅ pass | ✅（ff 无冲突）|
| fix-eval-runsh-port | 具名分支 | ✅ | ✅ pass | ✅ |
| fix-fake-gm-wiring | wf-6 | ✅ | ✅ pass（15+5+6 例，实机 curl 四主线+lore）| ✅ |
| distill-corpus-research | wf-7 | ✅（纯文档）| ✅ pass | ✅ |

- 无一节点 blocked，无一冒泡不可逆决策（全部照裁决实现）。
- 无误提交 node_modules/package-lock。

## 集成冲突与解法（主 agent 当场解）

三处冲突，全在 **fake-gm (node-6) vs 会话面拉平 (node-1) / continuity (node-2)** 之间——因 fake-gm 在自己 worktree 里写的代码/测试基于**拉平前**表面：

1. **`lore.ts` `/messages` 懒建**：node-6 在 `!entry` 分支内联建 Draft/MCP/`buildInvoke`；node-1 按 C2 移除懒建改 404。
   → **解**：`/messages` 保留 node-1 的 404（C2 胜）；把 node-6 的 `buildInvoke`（假构建驱动写 Draft 的通道）**搬进 node-1 的显式建会话 `ensureLoreEntry`**——两者兼得：显式建会话时就接好假构建通道。
2. **`DiceSession.buildInit()` 返回的 AgentInit**：node-2 加 `resume`、node-6 加 `backend`。
   → **解**：合并两者，AgentInit 同时带 `resume`（continuity 续接）+ `backend`（fake 教练档写 canon）；保留 node-2 的 `onSdkSession` 存库方法。
3. **`agent.ts` AgentInit 接口 / `server.ts`**：自动合并成功（两处均纯加法：`resume?`+`backend?` 字段共存；fake agentFactory + flatten listSessions 接线共存）。

**集成后回归**：`server.fakeGm.test.ts`（node-6 的集成测）原打旧路由 `/lore-sessions/*`+`/sessions/:id` 懒建，拉平后全断（6 fail）。主 agent 修测到新表面：dice 五主线 `/sessions/dicegm/*`（getOrCreateHost 仍按需建 host、无需显式建）；lore 先 `POST /sessions/loregm` 拿 UUID + name 移到建会话时传。修后 backend 617 全绿。

## 交付的契约（供 Wave 2 依赖）

- **`/sessions/{kind}/*` 对称表面**已就位（dicegm 前缀化、loregm 改名删旧、显式建会话、loregm list/meta）。Wave 2 所有依赖 session-flatten 的节点（config-endpoint、debrief-branch、loregm-validate、loregm-ws、open fixes、usage-consumers）可就绪。
- **`turn_ended.usage` 可选字段**（shared/stream.ts）就位 → co-play/co-build（经 usage-consumers）可依赖。
- **叙事三表 visible 列**就位 → a-prime §7 presentation-view 可依赖。
- **AgentInit.resume + sdk_session 存库**就位（gm-session-continuity）→ usage-context-backend 可依赖。
- **CreateSessionRequest 已预留 resume 位**（node-1 与 node-2 协调）。

## 手动门（待测试·裁决暂留到收尾）

- gm-session-continuity：真 SDK 两回合续接行为（offline 只验装配）。
- fix-fake-gm-wiring：已实机 curl 验过四主线+lore（node-6 报告），可视为门已过大半；FE-e2e-browser 前置已备。
- distill-corpus-research：RD-1/RD-2 纯研究文档已成；RD-3(改 SKILL) 在 Wave 2、RD-4(eval) 是 dogfood 门。
