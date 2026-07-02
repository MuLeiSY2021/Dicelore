# wave_2 复盘（2026-07-02 · 里程碑一收尾波2）

## 合了哪些（均以含 skill-loading 的 main 为基线，cherry-pick 合入）
- **N2 `build-workspace-backend`**（`2f1180f`→合为 `ffd3351`）：每会话持久 workspace（`ensureWorkspace` 只建 `materials/`）+ 流式 `POST /lore-sessions/:id/materials`（octet-stream、filename 净化、`DICELORE_MATERIAL_MAX_MB` 默认 100 中途 413 清半成品、返 `{path,bytes}`）+ build-mcp `put_material`（localPath 流式、content 不进工具参数）+ **退役 BM25**（删 `backend/src/build/retrieval/` 整目录、摘 buildMcp ingest/search、BuildCtx 去 retrievalDb）+ 接线（server.ts 传 sessionsDir、LoreSession workspace 透传）。对抗测试 pass（含净化对抗、413 边界、60MB 流内存增量为负实证不整体入内存、幂等持久）。
- **N2b `build-pack-skill`**（`7814531`→合为 `8f5753b`）：`/skill-creator` 重写 `dicelore-build-pack` SKILL.md + extract-playbook.md 为 agentic 文件打法（阶段0 摸源+清洗分块、各阶段 Grep+Read→build_write_*，删 ingest/search 行）。对抗测试 pass（frontmatter/references 合规、零 ingest/search 残留）。
- **N3 `lore-error-shape`**（`d9e149a`→合为 `5dea4e2`）：`LoreSession.handleMessage` 返回 `{turnId, error?}`（不吞领域级 error）+ `runtime/session.ts` 新增 `TurnResult` 共享返回契约（dice 侧 `{turnId}` 是其子类型、零改动）+ api/lore.ts messages body 带 error?（HTTP 保持 202）+ build-mcp doSendToBuilder 透传 error。对抗测试 pass。

## 集成如何决断
1. **cherry-pick 顺序**：N2b（孤立文档，0 冲突）→ N2（15 文件，0 冲突）→ N3（7 文件，1 冲突）。三分支都基于 e2e104f，当前 main=7641fa4(+skill docs 不碰这些)，故 N2b/N2 干净。
2. **唯一冲突 `harness/eval-loregm/build-mcp.test.ts`**：N2 追加 put_material 测试块、N3 追加 doSendToBuilder error 测试块，都在文件尾 append，git 把共享的尾部 `});\n});` 当公共上下文合并、两 describe 体冲突。**解法：保留两个 describe、各自正确闭合**（在 put_material 块后补 `});`）。其他 3 个重叠文件（lore.ts / lore.test.ts / build-mcp.ts）git 自动合并成功。
3. **集成必修（跨节点缺陷）**：N2b 报告——`dicelore-build-core/SKILL.md`（N1 波1 创建）仍含 4 处 live ingest/search 指令，N2 删掉这俩工具后 GM 加载 build-core 会被指示调不存在的工具。这是 N1 逃逸缺陷、波次集成必修。已修（`2fc8540`）：素材导航改 `materials/` + Bash/Grep/Read，与 build-pack 一致。**教训**：一个节点删的工具/API，若被另一节点（或前波）创建的 skill/文档引用，集成时要全仓查残留——对抗测试节点换脑子发现了它。

## surfacedDecisions（均可逆、主 agent 自决，无需问用户）
- N3：`Session` 接口无 `handleMessage` 声明，裁决说「若共享签名则放宽 error?」——非共享，改为新增 `TurnResult` 共享类型，dice 零影响。可逆实现细节。
- N2：materials 端点 error 用 `{error:{code,message}}` + HTTP 400/413/500（IO 端点，非 200 构建反馈），与 lore-error-shape 的领域级 200+body 语义边界不同——集成确认口径一致（两者不冲突：一个是传输/IO 层，一个是构建回合领域层）。

## 手动门（RUN_LIVE / dogfood，烧真 LLM，Workflow 不跑，标待用户手动验证）
- **build-workspace 端到端 dogfood**：真起后端 + build-mcp，`put_material` 传兽人冒险源 → 驱动构建 agent 用 bash 清洗分块建团本 → `get_draft` 验 → `commit`。是「会话工作区 + agentic 文件构建」的首个真实验证。依赖 build-pack skill（已合）提供 agentic 文件教条。
- （波1 遗留）**skill-loading §0 live smoke**：真 query 验 plugin 加载 skill + 教条到达 GM。

## 全绿证据
typecheck:all EXIT=0（0 error）；test:all EXIT=0：frontend 99 / backend 544 / harness 184+1skip（1 skip=DiceGm.live RUN_LIVE）+ 各库；0 unhandled、0 失败文件。

## 状态流转（wiki 沉淀在最终收尾阶段批量做）
- build-agent-workspace（N2+N2b）：代码合入 → **待测试**（dogfood 手动门），裁决文件暂留。
- lore-build-robustness（§1/§2=N3 波2 + §3=波1 checkout-head）：全离线可判、无手动门 → **已归档**，裁决文件可删。
- skill-loading（波1）：**待测试**（§0 手动门），裁决暂留。
