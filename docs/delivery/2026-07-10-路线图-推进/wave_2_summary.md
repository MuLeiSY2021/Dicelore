# wave_2_summary（2026-07-10 · 后端 feature 契约层）

## 结果：16 节点全部交付并合入 main，集成后 typecheck:all + test:all 全绿

15 pass + 1 fail(fix-open-500，主 agent 返工后合入)。无一 blocked、无一冒泡不可逆决策（全照裁决实现）。

| 节点 | 裁决 | verdict | 备注 |
|------|------|---------|------|
| aprime-typed-state-tools | a-prime §4 | pass | 类型化 player/npc/world 读写工具 + 删裸 sheet_get/list，TOOLS 21→19 |
| aprime-memory-tools | a-prime §6 | pass | mark_moment/history_compact/recall（recall 用 LIKE，caveat：未转义 %/_）|
| aprime-presentation-view | a-prime §7 | pass | presentation 接叙事视图（plotline/foreshadow/lore）+ buildNarrativeChanges |
| custom-mcp-backend | custom-mcp-install | pass | config.toml marketplaces/mcpServers + install(npx) + 运行时 stdio 接入 + mcp-test |
| rollband-backend | rollband §一 | pass | RollBand plan+narration；worktree 隔离下 test 红是软链产物，合入后真绿 |
| loregm-validate | rollband §二 | pass | validateDraft + POST /sessions/loregm/{id}/draft/validate |
| hidden-roll-backend | hidden-roll §一 | pass | stream hidden_roll 类型 + resolve hidden 参立即掷 visible=0 |
| loregm-ws-backend | hidden-roll §二 | pass | LoreStreamMessage 五类 + loregm WS route + build hooks(toolcall/draft_delta) |
| spoiler-backend | spoiler §一 | pass | events/stream 全量下发含 visible=0 + bay includeHidden 分页（caveat：limit=0）|
| config-endpoint | model-switch+spoiler+usage | pass | 统一 GET/POST /sessions/{kind}/{id}/config（model 下回合 / spoilerTier 立即）|
| usage-stream-consumers | usage-stream §2+§3 | pass | dice turnLoop + lore handleMessage usage 累计 |
| usage-context-backend | usage-and-context | pass | CONTEXT_WINDOW + GET /usage 扩 context + memory/mcp breakdown + auto-compact + context_compacting WS |
| debrief-branch-backend | debrief-and-branch | pass | 复盘态(status=debrief)+debrief-mode skill + branch 三端点 + rewind 收窄 |
| fix-open-head-ref | RT-open-head-ref | pass | /sessions/dicegm version='head' 端点层解析（caveat：仅小写 head）|
| fix-open-500 | RT-open-500 | fail→修 | 见下 |
| distill-apply-skill | skill-corpus RD-3 | pass | SKILL.md Moves/Principles + references/randomness-narrative.md |

## fix-open-500 返工（唯一 fail）

对抗测试发现：畸形 CSV（state.visible 填非数值）能过 validatePack 表头校验，却在 importPack **物化期** `Number()`→NaN→SqliteError NOT NULL 崩，而节点原 catch 只抓 PackValidationError → 漏成 500。**主 agent 集成时返工**：catch 扩展——物化期错误同属「客户端所选包不可用」，一并映射 400 invalid_pack（非 500）+ 补回归测试（畸形 visible 包）。

## 集成冲突与解法（主 agent 逐支解，全为加法叠加）

- `backend/src/index.ts` barrel：typed-state/memory 各加导出 → 并集。
- `harness/mcp/handlers/resolver.ts`：rollband(plan-aware bandTruth) vs hidden-roll(加 context 返回) → 合并（用 bandTruth + 保留 context）。
- `packages/shared/src/stream.test.ts`：rollband(roll_staged band 必填) + hidden-roll(hidden_roll 判别) 各加用例 → 都保留。
- `harness/loregm/LoreSession.ts`：usage-consumers(usage 累计/返回) + loregm-ws(WS turn_started/ended/error) + config-endpoint(getConfig/setConfig/promotePendingModel) 三方叠加 → 合并全部。
- `backend/api/lore.ts`：loregm-ws(WsHub/BuildHooks) + loregm-validate(validateDraft) + config-endpoint(SessionConfigUpdateSchema) import 并集。
- `backend/api/presentation.ts`：aprime(buildNarrativeChanges) vs spoiler(visibleSheets/hiddenSheets) 各加函数 → 都保留。
- `backend/api/dice.ts`：config(SessionConfigUpdateSchema) + debrief(CreateBranchRequestSchema+branch 函数) + fix-open-head + fix-open-500(PackValidationError) import 四方并集。
- `packages/shared/src/rest.ts`：config(SpoilerTier/SessionConfig schemas) + debrief(Rewind/Branch schemas) 各加块 → 都保留（补 SessionConfigSchema 闭合）。
- **合并残留括号**：presentation.ts / LoreSession.ts 各多一个 `}`（方法/函数区合并残留），修正后 typecheck 绿。

## 交付的契约（供 Wave 3 前端依赖）

后端契约层全就位：`/sessions/{kind}/{id}/config`、RollBand plan/narration、hidden_roll WS、loregm WS 五类事件、draft/validate 端点、presentation 叙事投影、usage/context 端点 + context_compacting WS、branch/debrief 端点、防剧透全量下发。**Wave 3 前端 IA 重构可据此消费。**

## 记 backlog 的非阻断 caveat（fast-follow，见 backlog-后端 Wave2 caveat 块）

recall 未转义 %/_ · spoiler limit=0 falsy 短路 · fix-open-head 仅小写 head · validateDraft 对 manifest.md 级问题盲(Draft.toPackFiles 产 .md) · fileToDomainPath '/' 泄漏。

## 手动门（待测试·裁决暂留）

custom-mcp（npx 真拉/stdio）· hidden-roll/loregm-ws（e2e/dogfood）· usage-context（auto-compact 真回落）· debrief-branch（复盘 AI 行为）· distill RD-4（eval dogfood）。
