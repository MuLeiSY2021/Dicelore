# 决策账本（2026-06-26 扫描 · roadmap-delivery-workflow）

> 起手扫路线图剩余项 + 三池产出。可逆的自决记默认值；不可逆的攒批问用户。
> 维护：随波次推进回填；实现中浮现的新决策追加到 §浮现。

---

## 可逆（已自决，记默认值供回溯，无需用户）

- **[工作流：本地变体 vs GitHub PR]** 取**本地变体**：subagent 在 worktree 只编辑+自测、**不碰 git**；编排者做全部 git（建分支/提交/本地 ff 合并），**不 push、不开 PR**。理由：CLAUDE.md 明令「不 push；push 由人单独指令、提交后 ff 合并回 main」，**用户指令优先于 skill** 的 PR 模型。skill 的「CI 绿」闸由编排者本地跑 `test:all`+`typecheck:all` 替代。
- **[worktree node_modules]** symlink 主仓库 node_modules（root + 相关包）进 worktree，**不 npm install**。理由：避免重写 package-lock（教训 `[worktree npm lock 坑]`）+ 省装包时间。
- **[O1 同构 shared/logger 是否新建]** **不新建**。理由（实证）：core 已有 `packages/core/src/log.ts`（pino，node-only）、后端已接入；前端 `apps/web` **0 处裸 console** 且 web 不依赖 core——「同构、浏览器+node 通用」的前提不成立（无前端 console 要迁）。O-后端 ~80% 已接入，O2 仅剩 `mcp/main.ts` 1~2 处裸 console 待迁（cli.ts 面向终端**保留**）。⚠️ 路线图第三批 O1/O2/O-前端 的描述已对实现漂移——**待沉淀**：`roadmap-delivery-workflow`（wiki 内容修复变体） / `roadmap-delivery-workflow`（wiki 结构整理变体） 修正这段（设计-实现漂移）。
- **[wave-1 节点选择]** 取「决策-free + 文件不重叠 + 可逆」三线：core-eval 深化 / 前端散点 fix+清理 / 后端 RT-4+logger 收尾。理由：先验证本地并发流水线，meaty 但无产品决策。
- **[FE-start-contract 谁改]** 暂**不入 wave-1**。理由：缝 B `startGame` 契约（后端 `{turnId}` vs 前端 `{sessionId,started}`）跨前后端两文件、需协调，留 wave-2 由单线一并改（倾向后端统一回 turnId）。

## 不可逆（2026-06-26 checkpoint 一次问，PO 已裁——已定稿落 wiki）

- [x] **ADR-0026（终局机制）** → **定稿**（PO 修改：删"结束游戏"按钮、终局后直接进复盘模式给建议、回溯续命 v2；①GM自调②软判据③玩家结束权维持）。E1/E2/FE-end-lock **已解冻**。
- [x] **ADR-0027（多端整合包发版架构）** → **原样定稿**。FE-CLI-doc/SEC2/移动端依赖解除。
- [x] **SEC2 key 托管** → 后端托管经 ADR-0027 定稿确认，可进发版闸实现。
- [x] **D-NPC-2**（npc 披露）→ 默认暗、GM 逐项 show（现实现已满足）。
- [x] **D-NPC-3**（npc 关系）→ v1 走 relation 视图行；**v2 提成关系图谱**（入 core 未来池）。
- [ ] **S1/S2 承重绑定 ADR**（port 契约 + L3 跨 agent 表达 + 解绑触发条件）。**仍待**——第五批发版闸纯架构决策，未在本次 checkpoint 问（PO 未勾），下次进第五批前再攒。

> 第四批（E1/E2/FE-end-lock）+ 第五批部分（FE-CLI-doc/SEC2/移动端）**已解冻**，可进后续编排。**唯 S1/S2 承重 ADR 仍待**。

## 浮现（subagent 干活时回报；可逆即自决回填、不可逆攒下批）

- **[漂移A · logger]**（可逆，已自决+已沉 wiki）：core 已有 `log.ts`（pino node-only）、后端已接入、前端 0 console 不依赖 core → O1「同构 shared/logger」前提不成立。O-前端 moot、O1 宜降级。已落 backlog-core O2 + 路线图第三批注记，待 `roadmap-delivery-workflow`（wiki 内容修复变体）/`roadmap-delivery-workflow`（wiki 结构整理变体） 改措辞。
- **[漂移B · eval harness 路径]**（可逆，已沉 wiki）：真 harness 是 `packages/core/eval/{run,grade,batch,tool}.ts`（offline runTool），非 `src/eval/play-mcp.ts`；choose/roll/browse 是独立 dicelore-play MCP 包。已落 backlog-core F-harness-test + 路线图第一批注记。
- **[用户指示 · lore/构建侧 eval MCP]**（2026-06-26）：建 build-mcp.ts（对称 dice play-mcp，连 build HTTP/LoreSession，CC 当作者驱动构建 GM）+ 注册 `dicelore-build` 进 `.mcp.json` + `enabledMcpjsonServers`，让跑团+构建两侧都能 CC 驱动 eval。**时序：第三批剩余未完成（CO-采集/RT-1/O-后端）推完后做**。落 nodes.jsonl n20。
- **[SNAP-1 follow-up · 重开重载团本工具]**：v1 团本 tools 仅首次 import 装载，重开已存在 session 不重载（catalog 不在场）。持久化 toolDefs 或重开从 catalog 重derive 留 follow-up。
- **[团本tools 产品残余]**：作者声明工具是否需服务端可关开关（关联 FE-mcp-config v1 不接入裁决、ADR-0017 ⑤）。攒着，非阻塞。

---

## Wave 进度

- **Wave 1（2026-06-26）✅ 全合**：n1 eval 地板 / n2 前端 fix+清理 / n3 RT-4+logger。三线 ff 合入 main，四包测试全绿（core 450 / orch 83 / web 49 / shared 11）+ typecheck 0。worktree 已清。
- **Wave 2（2026-06-26）✅ 全合**：n4 NPC一等抽象(A1) / n5 玩家主线 e2e(单测层) / n6 RT-3 rollGate 重启死锁。三线 ff 合入 main，四包全绿（core 467 / orch 92 / web 64 / shared 11）+ typecheck 0。worktree 已清。缝B契约从 n6 剥出（避免与 n5 web 测试耦合）→ 留 wave3 n7。
  - **裁断 D-NPC-1（已接受）**：A1 为携带 kind 扩了引擎/store 原语（state.ts/mutate.ts/writeTool.ts 加可选 kind，向后兼容）。判定属「框架能力生长」非破 DT-9——DT-9 约束团本作者加工具不需改框架；A1 本身是框架能力建设。
  - **新增待裁（不阻塞，已入 backlog-core）**：D-NPC-2（npc 属性默认披露策略）/ D-NPC-3（npc 关系是否进 anchor 边表）——产品/承重决策，已用可逆默认，攒着到第四/五批一起问。
- **Wave 3（就绪派发）**：n7 缝B startGame 契约统一 / n9 TB-1 边界测试。n8（server.ts FAKE_GM 教练档接线）依赖 chromium 安装才有完整价值 → 暂缓（已入 backlog FE-e2e-browser）。

> **逼近用户决策 checkpoint 的预警**：wave 3 后，剩余 ready 独立线变少且多落在第四/五批（受 ADR-0026/0027 PO 复核 gate，或冻结中增强）。下一轮编排前宜攒一批 AskUserQuestion（ADR-0026/0027 复核 + D-NPC-2/3 + SEC2 key 形态）一次问清，再解冻第四/五批。
