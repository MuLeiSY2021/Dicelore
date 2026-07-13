# 第三步 · 后端接口协议（as-delivered · `/sessions/{kind}` 对称面）

> **本轮（2026-07-10）已据交付裁决更新到 as-delivered 契约**：原文件是交付前按 wiki 推导写的「理想面」；本轮据**已批准并合入 main 的裁决**（session-surface-flatten / model-switch / spoiler-tiering-and-dock-diy / usage-and-context / usage-stream / rollband-narration-and-loregm-api / hidden-roll-and-loregm-ws / debrief-and-branch / custom-mcp-install / a-prime-completion）+ **实际交付代码**（`backend/src/api/{dice,lore,sessions,usage,ws,diagnostics,mcp,keys}.ts` + `packages/shared/src/{rest,stream,presentation,context-window}.ts`）逐端点核对，改写为已交付真实形状。**代码为准**（裁决与代码不一致处见文末「裁决 vs 代码」）。下游 curl 测试据本页重写。
>
> 属 `acceptance-loop` 第三步（后端 track）。「现状」列语义更新为交付态：✅ 已交付并对齐 / ⚠️ 已交付但有语义/计数存疑（待真跑） / ❌ 未实现 / 🟡 交付形状与旧规约不同（curl 需按新形状写）。RT-* 标签保留作历史归口锚点。

## 1. 会话生命周期（两 kind 对称骨架）

对应 A1 会话生命周期机。`{kind}` ∈ `dicegm` | `loregm`。**会话面已拉平**（session-surface-flatten 已交付）：dicegm 全挂 `/sessions/dicegm/*`、loregm 全挂 `/sessions/loregm/*`；旧 `/sessions/*`(dicegm 裸) 与 `/lore-sessions/*` 已删、**无别名**。

| 转移(A1) | 接口 | 请求 | 期望响应 | 现状 |
|---|---|---|---|---|
| 无→活跃 创建(dicegm) | `POST /sessions/dicegm` | `{teamId, version?}`（version 省略/`"head"`=默认最新版） | `201 {sessionId, kind:"dicegm"}` | ✅ 显式建（旧 `POST /:id/open` 懒建已删）。错误：无 catalog 注入 `400 {code:"no_catalog"}`；缺 teamId `400 {code:"bad_request"}`；团本不存在 `400 {code:"unknown_team"}`；信任闸门拒包/物化失败 `400 {code:"invalid_pack", issues:[…]}` |
| 无→活跃 创建(loregm) | `POST /sessions/loregm` | `{name?}`（团本工作名，省略=「未命名团本」） | `201 {sessionId, kind:"loregm"}` | ✅ 显式建（旧首访懒建已删） |
| （列表·dicegm） | `GET /sessions/dicegm` | — | `{sessions: SessionSummary[]}` | ✅。SessionSummary=`{sessionId, kind, status, title, packName(不可空·C3), started?, lastActionAt?, lastReply?, lastaction?}`。**注**：`listSessionSummaries` 实际只填 `{sessionId,kind,title,status,packName,started,lastActionAt}`；`lastReply`/`lastaction`（RT9/RT-FE13）留 schema 位、后端未回填=**⚠️ 契约位空** |
| （列表·loregm） | `GET /sessions/loregm` | — | `{sessions: SessionSummary[]}` | ✅ 已交付（对称 dicegm；实际内容依组合根注入的 `listSessions?`，省略则空） |
| （元信息·dicegm） | `GET /sessions/dicegm/{id}` | — | `{sessionId, kind:"dicegm", status, ended, title}` | ✅。`status`=`ended`(session_meta「ended」由 game_end MCP 落) ? `"debrief"` : `"active"`；`title`=id |
| （元信息·loregm） | `GET /sessions/loregm/{id}` | — | `{sessionId, kind:"loregm", status, ended:false, title}` | ✅。`status`=在内存 registry(活跃)→`"active"` 否则→`"archived"`；loregm 无复盘态 `ended` 恒 false |
| 活跃→无 删除(dicegm) | `DELETE /sessions/dicegm/{id}` | — | `200 {ok:true}` | ✅ 注销内存 host + 删 .db 文件。🟡 **返回 200 `{ok:true}` 非 204** |
| 活跃→无 删除(loregm) | `DELETE /sessions/loregm/{id}` | — | `200 {ok:true}`（幂等） | ✅ 从 loreReg 删条目（释放 in-memory Draft） |
| 未开场→活跃 开场 | `POST /sessions/dicegm/{id}/start` | — | `202 {turnId}`；已有回合在跑 `409 {code:"turn_in_progress"}` | ✅ dicegm kickoff（幂等·WS 流式开场）。🟡 **loregm 无对称 `/start`**——loregm 开场即首个 `POST …/messages`（对称骨架仅 dicegm 有 start） |
| 活跃→活跃 drive-turn(dicegm) | `POST /sessions/dicegm/{id}/messages` | `{text}` | `202 {turnId}`；`409 {code:"turn_in_progress"}` | ✅。dicegm usage 不在响应体（经 WS `turn_ended.usage`） |
| 活跃→活跃 drive-turn(loregm) | `POST /sessions/loregm/{id}/messages` | `{text}` | `202 {turnId}` \| `{turnId, error}`（领域级错误·状态仍 202） \| `{turnId, usage}`（success 轮内联本轮四类 token·usage-stream §3·v1 不落库）；会话不存在 `404 {error:{code:"NO_SESSION", message}}` | ✅（usage-stream 已交付：usage 随响应内联，无 usage 事件则不带） |
| 活跃→回退 rewind(dicegm) | `POST /sessions/dicegm/{id}/rewind` | `{toSeq?}` \| `{toUuid?}` \| 空 | `{toSeq}`→`202 {seq}`（截断当前分支到该 seq）；`{toUuid}`→`202 {uuid}`（transcript 节点回退）；空/非法 body→`202 {snapshotId}`（撤上一轮）；无快照 `409 {code:"no_snapshot"}`；锚点无 db 快照 `409 {code:"no_snapshot_for_anchor"}`；锚点不在 transcript 树 `404 {code:"unknown_anchor"}`；有回合在跑 `409 {code:"turn_in_progress"}` | ✅ 已补契约（RT3 解）。rewind 覆盖**当前分支**（debrief-and-branch §二.4）。🟡 **loregm 无 rewind 端点** |

## 2. dicegm 域子资源（对应 A2 回合循环 / B4 跑团页）

路径 `/sessions/dicegm/{id}/…`。

| 转移/需求 | 接口 | 请求 → 期望响应 | 现状 |
|---|---|---|---|
| 待选→下一回合 | `POST …/choices` | `{eventId, optionIndex}` → `202 {turnId}`；无 pending choice `409 {code:"no_pending_choice"}`；有回合在跑 `409 {code:"turn_in_progress"}` | ✅（走正式玩家选择捕获路径，非伪装 [choice] 文本；RT2 已修） |
| 明骰 | `POST …/roll` | `{eventId}` → `202 {ok:true}`；无待掷 `409 {code:"no_pending_roll"}` | ✅。🟡 **返回 `{ok:true}` 非 `{turnId}`**（roll 只 resolve WS 驱动回合内的 pending_roll、不开新回合，无真 turnId）。`pendingRoll` 形状（经 WS `roll_staged` / snapshot 恢复）：`{eventId, shape:"outcome"\|"contest", label, yourSide:{name,exprDisplay}, dc?, bands?:[{label,min,max,plan,narration}]}`——**per-band `plan`(AI 真实计划·可含暗值)+`narration`(玩家可见)** 均全量下发（RT-FE5·A′ 已交付，显隐交前端 spoiler 档） |
| 呈现快照 | `GET …/presentation` | `?includeHidden=&offset=&limit=` → PresentationSnapshot | ✅ 全量。快照含 `{protocol, sessionId, seq, sheets, mechanics, choices, narrativeCursor, pendingRoll, plotlines, foreshadows, lore}`——**plotlines/foreshadows/lore 叙事层视图投影已交付**（RT-FE4 收口·A′；走 `*_visible` 命名视图防剧透）。`includeHidden=true` 时 sheets 从 state 表全量取（含 visible=0，bay 关闭档按需拉），offset/limit 对扁平 cell 分页 |
| 重连回填 | `GET …/events` | `?since=&visibleOnly=` → `{events:[{seq,kind,text,data?,visible}]}` | ✅。🟡 **默认全量下发含 visible=0**（spoiler-tiering §一.2·后端不截流）；`visibleOnly=true` 才只回可见事件（保留向后兼容·默认全量·修正原「零端点/硬底线」定调 RT-FE9） |
| 源浏览 | `GET …/browse` | `?source=world\|rule\|log&q=` → `{source, entries:[{name,tag,snippet,canPin,ref}]}` | ✅。q 空=列全量投影，q 非空=FTS 检索；rule/log `canPin=false`，world `canPin=true` |
| 用量投影 | `GET …/usage` | `?rows=1` → UsageReport | ✅ 已合 main（含扩展）。形状=`{session:UsageTotals, byTurn:{}, byAgent:{}, model, contextTokens, contextWindow, contextPct, sessionTotal, perTurn:[], rows?(仅 ?rows=1), memoryBreakdown?, mcpBreakdown?}`——context/session/perTurn 扩已交付（RT-FE14/17·usage-and-context §二）；`memoryBreakdown`/`mcpBreakdown`(RT-FE19) 留 optional 契约位·v1 无聚合源→不下发 |
| 运行时切 model + 防剧透档 | `GET/POST …/config` | GET → `200 {model, spoilerTier, pendingModel?}`；POST `{model?, spoilerTier?}` → `200` 更新后完整 config | ✅ **统一 config 端点已交付**（取代旧 `POST …/model`；model-switch + spoiler-tiering + usage-and-context 三裁决协同）。`model` 设 pendingModel·**下回合生效**；`spoilerTier`(`strict\|loose\|off`) 存 session_meta·**立即生效** |
| 分支·新建 | `POST …/branches` | `{fromSeq?, name?}` → `201 {branchId, sessionId, fromSeq, isCurrent:true}`；无库 `400 {code:"no_session_store"}` | ✅ 已交付（debrief-and-branch §二·RT-FE8）。复制当前分支（截断到 fromSeq）→ 新分支自动成当前分支 |
| 分支·列表 | `GET …/branches` | — → `{currentBranchId, branches:[{branchId,name,createdAt,seq,isCurrent}]}` | ✅。无库 → 只 `{currentBranchId:"main", branches:[]}` 空态 |
| 分支·切换 | `POST …/branches/{branchId}/checkout` | — → `200 {branchId, presentation}`；未知分支 `404 {code:"unknown_branch"}`；无库 `400 {code:"no_session_store"}` | ✅。切当前分支 + 返该分支 presentation 快照 |
| 战后复盘 | 复用 `game_end` MCP（GM AI 调用后转复盘态不归档） | game_end 现有返回 + 会话 `status:"debrief"`（ended 仍 true） | ✅（debrief-and-branch §一 C1：game_end 后不直接归档、转「战后复盘」态；status 见 §1 元信息） |
| WS 流 | `GET …/ws` | 先 snapshot 再增量（`?since=` 补叙述历史） | ✅（见 §5·12 类；逐条待真跑验） |

## 3. loregm 域子资源（对应 A3 自由编排 / B5 制作页）

路径 `/sessions/loregm/{id}/…`。

| 转移/需求 | 接口 | 请求 → 期望响应 | 现状 |
|---|---|---|---|
| 上传素材 | `POST …/materials` | 原始字节流(application/octet-stream)·文件名经 `?filename=` 或 `X-Material-Filename` header → `{path:"materials/<name>", bytes}` | ✅。文件名非法 `400 {error:{code:"bad_material_name"}}`；空 body `400 {error:{code:"empty_body"}}`；超 `DICELORE_MATERIAL_MAX_MB`(默认 100) `413 {error:{code:"material_too_large"}}`（流式掐断+清半成品）；sessionsDir 未接线 `500 {error:{code:"no_workspace"}}`；写盘失败 `500 {error:{code:"material_write_failed"}}`。**注**：materials 是 IO 端点、按 sessionId 落盘、不强制先建会话 |
| 检视 Draft | `GET …/draft` | — → `{files:PackFile[], snapshot}`（toPackFiles=将提交的包文件·snapshot=分域结构化回读） | ✅。会话不存在 `404 {error:{code:"NO_SESSION"}}` |
| Draft 校验 | `POST …/draft/validate` | 无 body → `{issues:[{level,path,msg}]}`（活跃期 Draft·path 用 Draft 分域路径如 world.lore.x/manifest.meta·非文件路径） | ✅ 已交付（RT-FE11；复用 core `validateDraft`）。会话不存在 `404 {error:{code:"NO_SESSION"}}` |
| 运行时切 model + 档位 | `GET/POST …/config` | 同 dicegm（GET → `{model,spoilerTier,pendingModel?}`；POST `{model?,spoilerTier?}` → 更新后完整 config） | ✅ 已交付（两 kind 统一端点·C2）。loregm 无 session.db、config 存内存态；会话不存在 `404 {error:{code:"NO_SESSION"}}` |
| WS 流 | `GET …/ws` | loregm 域 WS 事件（见 §5.2·5 类） | ✅ 已交付（loregm-ws 裁决 §二）。会话不存在/未接线 resolveLoreHub → 拒绝升级 |
| 搜索（额外 MCP） | 经 `/mcp/*` 登记的客制 MCP 运行时注入 | — | ✅ 登记端点已交付（见 §6·RT8）；运行时工具表注入见 harness |

> **loregm 无 `GET …/usage`**：per-turn usage 经 `POST …/messages` 响应内联（usage-stream §3·v1 不落库·无聚合源）。用量浮窗 session 累计/上下文圆盘（build-context-dial）v1 无源→前端侧超前项，非后端端点。

## 4. catalog 团本产物库（独立 · 对应 A4 / B3 团本目录页）

| 需求 | 接口 | 请求 → 期望响应 | 现状 |
|---|---|---|---|
| 目录 | `GET /catalog` | — → `{adventure: [...]}` | ✅。🟡 **响应 key = `adventure`**（含 `id`/`head` 等；非 `sessions`/`catalog`） |
| 提交版本 | `POST /catalog/commit` | `{name, message, files:PackFile[]}` → `201` 新版本 | ✅ |
| 版本包文件 | `GET /catalog/{adventureId}/files` | `?ref=head`（缺省=head·端点层从 catalog list 解析 head commitId 再 checkout） → `{files:PackFile[]}`（未知/空团本→`{files:[]}`） | ✅（BE-checkout-head：core checkout 不认 "head" 关键字，端点层先解析） |
| 整包校验 | `POST /catalog/validate` | `{files:PackFile[]}` → validatePack 结果 `[{level,path,msg}]` | ✅ |
| 打标签 | `POST /catalog/{adventureId}/tag` | `{commitId, label}` → `201 {ok:true}` | ✅ |
| 开始游戏 import | 建 dicegm 会话时选版本（`POST /sessions/dicegm {teamId, version?}`·默认最新→validatePack 信任闸门） | dicegm 就绪(201) | ✅（见 §1·import 在 DiceSession 构造期同步重验） |

## 5. dicegm 域 WS 消息目录（server→client）

`GET /sessions/dicegm/{id}/ws`。`StreamMessageSchema` 判别联合，**12 个成员**（每条带 `protocol`）：

| `type` | payload | 现状 |
|---|---|---|
| `turn_started` | `{turnId}` | ✅ |
| `narration_delta` | `{turnId, text}` | ❌ 未实现（非 bug·token 级流式待接） |
| `narration_commit` | `{seq, text}` | ⚠️ `seq` 语义债待验（RT5） |
| `presentation_delta` | `{delta:{seq, changes}}` | ✅。changes 含 sheets/mechanics/reveal/watcherFired + **plotlines/foreshadows/lore（op=upsert\|remove·A′ 叙事增量）** |
| `choices` | `{choices:{eventId, options:[{index,label,consequence}]}}` | ✅ |
| `roll_staged` | `{pendingRoll}`（形状见 §2·含 bands.plan/narration） | ✅ |
| `roll_committed` | `{eventId, rolls:[], total, dc?, outcome}` | ✅ |
| `hidden_roll` | `{eventId, label, result, dc?, band?:{label,consequence}}` | ✅ 已交付（RT-FE6）。🟡 **携带完整 result/dc/band**（非仅 {eventId,label}）——GM 主动掷、event visible=0，前端按 spoiler 档决定显多少（严格档只显 label） |
| `turn_ended` | `{turnId, seq, usage?:{inputTokens,outputTokens,cacheReadTokens,cacheCreationTokens}}` | ✅（usage optional·向后兼容·usage-stream §1·RT-FE16） |
| `game_end` | `{reason, outcome}` | ⚠️ 曾从不发·必真跑验（RT-B3） |
| `error` | `{code, message}` | ✅ |
| `context_compacting` | `{phase:"start"\|"done", result?:"success"\|"failed", error?}` | ✅ 已交付（usage-and-context §四）。上下文压缩进行态；SDK 不暴露数值进度→无 progress 字段。**注**：代码注释称其「第 11 类」，但含 hidden_roll 后 schema 实为 12 成员（见文末计数存疑） |

### 5.2 loregm 域 WS 事件（制作页构建助手 · loregm-ws 裁决已交付）

`GET /sessions/loregm/{id}/ws`。`LoreStreamMessageSchema` 判别联合，**5 个成员**（与 dicegm 共用 wsHub 骨架、枚举不同）：

| `type` | payload | 说明 |
|---|---|---|
| `turn_started` | `{turnId}` | send_to_builder 收指令、开始一轮 |
| `turn_ended` | `{turnId, seq}` | build GM 一轮跑完（seq=Draft 修订号·对接 get_draft 回读） |
| `toolcall` | `{tool, args, result?, ok}` | build GM 每调一次构建工具（前端「显示调了哪些工具」·onToolcall hook） |
| `draft_delta` | `{seq, changes:[{section}]}` | build GM 写 Draft（onBuilderWrite hook·即写即读刷新·对齐 GET …/draft 分域） |
| `error` | `{code, message}` | 构建出错 |

> 🟡 **`validate_result` 事件未交付**（旧规约 §5.2「拟」列过）：推后 v2；on-demand 校验由同步端点 `POST …/draft/validate`（RT-FE11）覆盖。

## 6. 配置 / 诊断 / 客制 MCP（对应 B6 配置页 · 缝A/安全/成本）

### 6.1 诊断自检（`/diagnostics/*`）

| 需求 | 接口 | 期望响应 | 现状 |
|---|---|---|---|
| 服务器真值 | `GET /diagnostics/health` | `{protocol, fakeGm, port, model:{gm,configured,baseUrl}, mcp:{name,transport,toolCount,running}, notify:{url,configured}, storage:{sessionsDir,ftsMode}}` | ✅ |
| 模型连接测试 | `POST /diagnostics/model-test` | `{baseUrl?, key?, gm?}` → FAKE 短路 `{ok,fake:true,latencyMs,message}`；真模式对 `<base>/v1/models` 探活辨 401/403；SSRF 白名单拒 `400` | ✅（SSRF 防护已交付：挡私网/环回/元数据段·限 https·DNS rebinding 防护） |
| 自定义 MCP 测试 | `POST /diagnostics/mcp-test` | stdio：`{transport:"stdio", command, args?, env?}`（回落 `endpoint` 空白拆分）→ 真拉起+握手+listTools·`{ok,toolCount,latencyMs,message}`(ok?200:502)·缺 command `400`；SSE：`{endpoint}` → HTTP 可达性·SSRF 拒 `400` | ✅ **已支持结构化 stdio**（custom-mcp-install §七） |
| key 托管 | `POST/GET /keys` · `GET/DELETE /keys/{id}` | POST `{label,provider,secret}` → `201` KeyMeta(不回明文)·缺参 `400`·无主密钥 `503`；GET `/keys` → `{keys:KeyMeta[]}`；GET `/keys/{id}` → KeyMeta(`404` 不存在)；DELETE → `204`(`404` 本不存在) | ✅（SEC2·ADR-0027） |

> 🟡 **旧 `GET/POST/PUT/DELETE/PATCH /diagnostics/mcp-config[/{instance}]` 已不存在**——被 §6.2 的 `/mcp/*` 端点族 + `config.toml` 收敛取代（custom-mcp-install §五）；`mcp-test` 仍留在 `/diagnostics`。

### 6.2 客制 MCP 安装（`/mcp/*` · custom-mcp-install 已交付·取代旧 mcp-config）

| 需求 | 接口 | 请求 → 期望响应 | 现状 |
|---|---|---|---|
| 加 marketplace（按钮①） | `POST /mcp/marketplaces` | `{source(GitHub slug/URL/直连 .json URL), name?}` → `{ok:true, marketplace, mcps:ManifestMcp[]}`；源非法/拉清单失败 `400 {ok:false,message}` | ✅ |
| 列 marketplace 源 | `GET /mcp/marketplaces` | — → `{marketplaces:[...]}` | ✅ |
| 安装（按钮②） | `POST /mcp/install` | `{spec, name?, command?, args?, env?}`（marketplace 装 `spec="<mcp>@<marketplace>"`；直装 `spec="<pkg>@<ver>"`）→ npx -y 预拉 → `{ok:true, server:McpServerEntry, message}`；缺 spec `400`；缺必填 env `400`；清单无此 MCP `404`；预拉失败 `502` | ✅。🟡 **安装路径 = `POST /mcp/install`**（非 `/mcp/servers`） |
| 列已装客制 MCP | `GET /mcp/servers` | — → `{servers:McpServerEntry[]}`（含 `enabled`/`outOfCanon`/`fromMarketplace?`/`installed`） | ✅ |
| 启停开关 | `POST /mcp/servers/{name}/toggle` | `{enabled}` → `{ok:true, name, enabled}`；未找到 `404 {ok:false}` | ✅。🟡 **切开关 = POST `/toggle`**（非 `PATCH /mcp/servers/{name}`） |
| 删客制 MCP | `DELETE /mcp/servers/{name}` | — → `{ok:true, name}`；未找到 `404 {ok:false}` | ✅ |

### 6.3 缝A / 限流（不变）

| 需求 | 接口 | 期望响应 | 现状 |
|---|---|---|---|
| 缝A 进程内回调 | `onCanonWrite`（v1 默认） | 规范态写→映射 delta/roll_committed | ✅ |
| 缝A webhook | `POST /internal/notify` | `204` fire-and-forget | ❌ 未来（非 bug） |
| 限流 | per-session | 60s/120 默认·超 `429`+`Retry-After` | ✅（阈值待验） |

---

## as-delivered 目标面（一句话）

```
/sessions/dicegm                                  创建({teamId,version?}→201) / 列表
/sessions/dicegm/{id}                             元信息(status:active|debrief) / 删除(200 {ok})
/sessions/dicegm/{id}/start                        开场(202 {turnId})           ← dicegm 独有
/sessions/dicegm/{id}/messages                     drive-turn(202 {turnId})
/sessions/dicegm/{id}/rewind                       {toSeq?|toUuid?|空}→202；覆盖当前分支
/sessions/dicegm/{id}/{choices,roll,presentation,events,browse,ws,usage,config}   dicegm 域子资源
/sessions/dicegm/{id}/branches[/{bid}/checkout]    分支 新建/列表/切换
game_end MCP（复用·调用后转复盘态不归档·status=debrief）

/sessions/loregm                                  创建({name?}→201) / 列表
/sessions/loregm/{id}                             元信息(status:active|archived) / 删除(200 {ok})
/sessions/loregm/{id}/messages                     drive-turn(202 {turnId|turnId,error|turnId,usage})
/sessions/loregm/{id}/{materials,draft,draft/validate,ws,config}   loregm 域子资源（无 start/rewind/usage）

/catalog, /catalog/{id}/{files,tag}, /catalog/{commit,validate}    独立产物库（GET /catalog→{adventure}）
/diagnostics/{health,model-test,mcp-test}, /keys[/{id}]            诊断 + key 托管
/mcp/{marketplaces,install,servers[/{name}[/toggle]]}             客制 MCP 安装（取代旧 mcp-config）
/internal/notify                                                  缝A webhook（未来）
```

## 裁决 vs 代码 · 交付形状与旧规约差异（curl 编写要点）

以下为**核对代码后确认的、与旧「理想面」规约或裁决初稿不同**的真实形状（🟡=需按代码写测试；不影响功能对错、但断言字段/码需照此）：

1. **`POST …/roll` 返回 `{ok:true}` 而非 `{turnId}`**——roll 只 resolve WS 回合内的 pending_roll、不开新回合，无真 turnId 可返；状态仍 202。
2. **会话 DELETE 返回 `200 {ok:true}` 而非 204**（dicegm/loregm 皆然）；对比 `DELETE /keys/{id}` 才是 204。
3. **`GET /catalog` 响应 key = `adventure`**（非 `sessions`/`catalog`）。
4. **WS `hidden_roll` 携带完整结果** `{eventId, label, result, dc?, band?}`——旧规约 §5 草案写「只 `{eventId,label}`·不显结果/DC」。裁决 hidden-roll 定调「防剧透=前端渲染层」，故后端全量下发、显隐交前端 spoiler 档（与 spoiler-tiering「stream 全发·非硬底线」一致）。测试应断言 result/band 存在，而非缺席。
5. **dicegm WS 成员实为 12 个**（含 hidden_roll + context_compacting），但 `stream.ts` 代码注释仍称 context_compacting 为「第 11 类」——计数注释未随 hidden_roll 增补更新（文档计数债，非功能 bug）。
6. **loregm WS 无 `validate_result` 事件**（旧 §5.2「拟」列过）——推后 v2；由同步端点 `POST …/draft/validate` 覆盖。实际交付 5 类：turn_started/turn_ended/toolcall/draft_delta/error。
7. **loregm 无 `/start`、无 `/rewind`、无 `/usage` 端点**——对称骨架里 start/rewind/usage 是 dicegm 域独有；loregm 开场即首个 `/messages`、用量随 messages 响应内联。
8. **客制 MCP 端点是 `/mcp/*` 独立面，非 `/diagnostics/mcp-config`**：安装=`POST /mcp/install`（非 `POST /mcp/servers`）、启停=`POST /mcp/servers/{name}/toggle`（非 `PATCH`）。裁决 custom-mcp-install 只描述「按钮①/②」行为、未钉死路径字符串，代码路径为准。旧规约的 `/diagnostics/mcp-config` 路由**从未实现**、已被取代。`mcp-test` 仍在 `/diagnostics/mcp-test` 且已支持结构化 stdio。
9. **loregm/NO_SESSION 错误体形状 = `{error:{code,message}}`**（嵌套 error 对象），dicegm 侧多为 `{code}`（扁平）——两域错误体形状不完全一致，测试按各端点实际写。
10. **SessionSummary `lastReply`/`lastaction` 字段后端未回填**（RT9/RT-FE13）：schema 有位、`listSessionSummaries` 只回 `{sessionId,kind,title,status,packName,started,lastActionAt}`。测试勿断言 lastReply/lastaction 有值。
