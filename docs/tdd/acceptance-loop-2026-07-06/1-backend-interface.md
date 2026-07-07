# 第一步 A · 后端接口规约（据状态机 derive · `/sessions/{kind}` 对称面）

> 属 `acceptance-loop` 第一步（后端 track）。**据 [0-state-machines.md](0-state-machines.md) 每条转移 derive**；期望响应形状引 wiki（接口§=玩家客户端-接口.md、构建§=团本构建工具链.md），**不看代码输出**（铁律 1）。推导法 → skill `references/interface-and-tests.md`。
> **理想面对称**：会话是一个实体、按 `kind ∈ {dicegm, loregm}` 参数化——两 kind 共享生命周期骨架，域子资源各异，catalog 独立。内部 `Session`/`TurnResult` 已统一，HTTP 表皮也应对齐。**现状 `/sessions`(dicegm) vs `/lore-sessions`(loregm) 不对称 = 待拉平的红**（RT-ns）。
> 「现状」列对照真实路由、**非 wiki 状态列**（铁律 4）：✅ 在 / ❌ 缺 / ⚠️ 存疑或超前 / 🔀 存在但路径不对称。

## 1. 会话生命周期（两 kind 对称骨架）

对应 A1 会话生命周期机的转移。`{kind}` ∈ `dicegm` | `loregm`。

| 转移(A1) | 理想接口 | 请求 | 期望响应 | 现状（dicegm / loregm） |
|---|---|---|---|---|
| 无→活跃 创建 | `POST /sessions/{kind}` | dicegm `{teamId, version?}`（默认最新版）/ loregm `{name?}` | `201 {sessionId, kind}` | ❌ 两侧都缺显式新建（dicegm 懒建 `/open`；loregm 首次 `/messages`\|`/materials` 懒建）= **RT1** |
| （列表） | `GET /sessions/{kind}` | — | `{sessions: SessionSummary[]}`（含 kind/活动日期/title/packName/started/**最新回复**） | dicegm ✅ `GET /sessions`；loregm ❌ **无列表** = **RT6** |
| （元信息） | `GET /sessions/{kind}/{id}` | — | `{sessionId, kind, status(活跃/空/归档), title, ended}` | dicegm ✅（wiki 标"桩"待验）；loregm ❌ **无 meta** = **RT7** |
| 活跃→无 删除 | `DELETE /sessions/{kind}/{id}` | — | 删库+注销/删工作区 | dicegm ✅；loregm ✅ |
| 未开场→活跃 开场 | `POST /sessions/{kind}/{id}/start` | — | 幂等·流式开场（dicegm prologue；loregm 首轮/身份开场） | dicegm ✅ kickoff；loregm ⚠️ 是否有对称开场待定 |
| 活跃→活跃 drive-turn | `POST /sessions/{kind}/{id}/messages` | `{text}` | `202 {turnId, error?}`（loregm error 经 body、状态钉 202） | dicegm ✅；loregm ✅ |
| 活跃→空/活跃 rewind | `POST /sessions/{kind}/{id}/rewind` | `{toSeq?}`（省略/到头=空） | 回退到 seq | dicegm ⚠️ `/rewind` 有但**无契约**=**RT3**；loregm ❓ 未定 |

> 现状**命名不对称**（dicegm=`/sessions/*`、loregm=`/lore-sessions/*`）= **RT-ns**（破坏性改名，冒泡待裁决）。上表"理想接口"是拉平后的目标面，"现状"列记实际偏差。

## 2. dicegm 域子资源（对应 A2 回合循环 / B4 跑团页）

路径 `/sessions/dicegm/{id}/…`（现状在 `/sessions/{id}/…`）。

| 转移/需求 | 理想接口 | 期望响应 | wiki | 现状 |
|---|---|---|---|---|
| 待选→下一回合 | `POST …/choices {eventId, optionIndex}` | `202 {turnId}` | 接口§2 | ⚠️ 语义矛盾必真跑（绕路 vs 已修）=**RT2** |
| 明骰 | `POST …/roll {eventId}` | `202`；无待掷 `409` | 接口§2 | ✅ |
| 呈现快照 | `GET …/presentation` | §1 全量快照 | 接口§1/§2 | ✅ |
| 重连回填 | `GET …/events?since=&visibleOnly=` | `{events[]}` | 接口§2 | ✅（代码领先，wiki §2 待纠） |
| 源浏览 | `GET …/browse?source=world\|rule\|log&q=` | 命中条目 | 接口§9.4 | ✅ |
| WS 流 | `GET …/ws`（先 snapshot 再增量） | 10 类消息（见 §5） | 接口§3+4 | ✅（逐条待验） |
| 成本 | `GET …/usage` | 只读用量投影 | 里程碑二⬜ | ✅ 在建 |

## 3. loregm 域子资源（对应 A3 自由编排 / B5 制作页）

路径 `/sessions/loregm/{id}/…`（现状在 `/lore-sessions/{id}/…`）。

| 转移/需求 | 理想接口 | 期望响应 | wiki | 现状 |
|---|---|---|---|---|
| 上传素材（可选） | `POST …/materials`（原始字节流·`?filename`） | 落盘；超限 `413`+清半成品 | 构建§3/§6 | ✅ |
| 检视 Draft | `GET …/draft` | 分域结构化 Draft 回读 | 构建§6 | ✅ |
| 搜索（额外 MCP） | 经配置侧登记的额外 MCP | — | 视觉§6 | ❌ 未接运行时=**RT8** |

## 4. catalog 团本产物库（独立 · 对应 A4 / B3 团本目录页）

| 需求 | 接口 | 期望响应 | wiki | 现状 |
|---|---|---|---|---|
| 目录 | `GET /catalog` | 团本列表+版本概要 | 构建§6 | ✅ |
| 提交版本 | `POST /catalog/commit` | 新版本 | 构建§6 | ✅ |
| 版本包文件 | `GET /catalog/{id}/files?ref=head` | 全部包文件（head 端点解析） | 构建 D3 | ✅ |
| 整包校验 | `POST /catalog/validate` | `[{level,path,msg}]` | 构建§6/§1 | ✅ |
| 打标签 | `POST /catalog/{id}/tag` | 版本打标 | 构建§6 | ✅ |
| 开始游戏 import | （建 dicegm 会话时选版本·默认最新→ validatePack） | dicegm 就绪 | 构建§6/D3 | 依 RT1（无显式建会话） |

## 5. WS 消息目录（server→client · 对应 A2 转移的推送）

| `type` | payload | wiki | 现状 |
|---|---|---|---|
| `turn_started` | `{turnId}` | 接口§3+4 | 待验 |
| `narration_delta` | `{turnId,text}` | 接口§3+4 | ❌ 未实现（非 bug，token 级流式待接） |
| `narration_commit` | `{seq,text}` | 接口§3+4 | ⚠️ `seq` 语义债待验=**RT5** |
| `presentation_delta` | `{seq,changes}` | 接口§3+4 | ✅ |
| `choices` | §1 choices 形状 | 接口§3+4 | ✅ |
| `roll_staged` | `{pendingRoll}` | 接口§3+4 | ✅ |
| `roll_committed` | `{eventId,rolls,total,dc?,outcome}` | 接口§3+4 | ✅ |
| `turn_ended` | `{turnId,seq}` | 接口§3+4 | 待验 |
| `game_end` | `{reason,outcome}` | 接口§3+4 | ⚠️ 曾从不发，必验=**RT-B3** |
| `error` | `{code,message}` | 接口§3+4 | 待验 |

## 6. 配置 / 诊断（对应 B6 配置页 · 缝A/安全/成本）

| 需求 | 接口 | 期望响应 | wiki | 现状 |
|---|---|---|---|---|
| 服务器真值 | `GET /diagnostics/health` | `{port,fakeGm,model,mcp工具数,notify,sessionsDir,ftsMode}` | 接口§9.4 | ✅ |
| 模型连接测试 | `POST /diagnostics/model-test` | FAKE 短路 / 真模式探活辨 401/403 | 接口§9.4 | ✅ |
| 自定义 MCP 测试 | `POST /diagnostics/mcp-test` | SSE 可达 / stdio 命令存在 | 接口§9.4 | ✅ |
| key 托管 | `keys` CRUD | POST/GET/GET:id/DELETE | 里程碑二⬜/SEC2 | ✅ 在建 |
| 缝A 进程内回调 | `onCanonWrite`（v1 默认） | 规范态写→映射 delta/roll_committed | 接口§5.1 | ✅ |
| 缝A webhook | `POST /internal/notify` | `204` fire-and-forget | 接口§5.2 | ❌ 未来（非 bug） |
| 限流 | per-session | 60s/120 默认，超 `429`+`Retry-After` | server 限流 | ✅（阈值待验） |

---

## 拉平后的目标面（一句话）

```
/sessions/{kind}                     创建 / 列表          kind ∈ dicegm|loregm
/sessions/{kind}/{id}                元信息 / 删除
/sessions/{kind}/{id}/start          开场
/sessions/{kind}/{id}/messages       drive-turn
/sessions/{kind}/{id}/rewind         元动作（到头=空）
/sessions/dicegm/{id}/{choices,roll,presentation,events,browse,ws,usage}   dicegm 域子资源
/sessions/loregm/{id}/{materials,draft}                                     loregm 域子资源
/catalog, /catalog/{id}/{files,tag}, /catalog/{commit,validate}             独立产物库
/diagnostics/{health,model-test,mcp-test}, /keys, /internal/notify          配置/缝A
```

现状偏差集中在：**会话命名不对称（RT-ns）+ 两侧缺显式建会话（RT1）+ loregm 缺列表/元信息（RT6/RT7）**——这些是把 curl 断言指向"理想面"时会先红的点，正是本轮要暴露的。
