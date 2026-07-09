# 裁决：session-surface-flatten —— 会话面对称拉平 /sessions/ {kind}

- [X]  用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 来源：acceptance-loop 第 1 轮 RT-ns（命名不对称）+ RT1（两侧缺显式建会话）+ RT6（loregm 缺列表）+ RT7（loregm 缺 meta）。四项一组，都是会话面对称问题。
> 用户 2026-07-08 定调：「本轮拉平 /sessions/{kind}」。
> 内部 `Session`/`TurnResult` 已统一（仅 HTTP 表皮分裂），本裁决把 HTTP 表皮也拉平。

---

## 一、目标面（kind 参数化对称）

会话是一个实体、按 `kind ∈ {dicegm, loregm}` 参数化。两 kind 共享生命周期骨架，域子资源各异：

```
/sessions/{kind}                     创建 / 列表
/sessions/{kind}/{id}                元信息 / 删除
/sessions/{kind}/{id}/start          开场
/sessions/{kind}/{id}/messages       drive-turn
/sessions/{kind}/{id}/rewind         覆盖当前分支
/sessions/dicegm/{id}/{choices,roll,presentation,events,browse,ws,usage,branches}   dicegm 域子资源
/sessions/loregm/{id}/{materials,draft,draft/validate,ws}                           loregm 域子资源
```

## 二、破坏性改名映射


| 现状                                                 | 拉平后                                    |
| ---------------------------------------------------- | ----------------------------------------- |
| `GET /sessions`（dicegm 列表）                       | `GET /sessions/dicegm`                    |
| `POST /sessions/{id}/open`（dicegm 懒建）            | `POST /sessions/dicegm`（显式建·见§三） |
| `/sessions/{id}`（dicegm meta/删除）                 | `/sessions/dicegm/{id}`                   |
| `/sessions/{id}/{choices,roll,...}`（dicegm 子资源） | `/sessions/dicegm/{id}/{...}`             |
| `/lore-sessions`（loregm 列表·缺）                  | `GET /sessions/loregm`（补·见§四）      |
| `/lore-sessions/{id}`（loregm meta·缺）             | `GET /sessions/loregm/{id}`（补·见§五） |
| `/lore-sessions/{id}/{materials,draft}`              | `/sessions/loregm/{id}/{...}`             |

## 三、补显式建会话（RT1）


| 接口        | `POST /sessions/{kind}`                                               |
| ----------- | --------------------------------------------------------------------- |
| dicegm 请求 | `{teamId, version?}`（version 省略=默认最新版→ validatePack 信任闸） |
| loregm 请求 | `{name?}`（团本工作名）                                               |
| 响应        | `201 {sessionId, kind}`                                               |

- **移除懒建**：dicegm `/open` 懒建、loregm 首访 `/messages`\|`/materials` 懒建 —— 一律改为显式 `POST /sessions/{kind}` 先建会话再操作。【拟·待确认 C2：懒建是否保留为兜底？倾向完全移除，单源。】

## 四、补 loregm 列表（RT6）

`GET /sessions/loregm` → `{sessions: SessionSummary[]}`

- 对称于 dicegm `GET /sessions/dicegm`。
- 制作页 bay session 列构建会话（活动日期/团本/最新动作）= 此端点。

## 五、补 loregm meta（RT7）

`GET /sessions/loregm/{id}` → `{sessionId, kind, status, title, ended}`

- 对称于 dicegm meta。
- `status` 取值对齐 A1：`{活跃, 空, 归档}`（loregm 无战后复盘态——复盘是 dicegm 域特有）。

## 六、SessionSummary 统一形状（两 kind 共用）

```ts
{ sessionId, kind, status, title, packName?, started, lastActionAt, lastReply?, lastaction? }
```

- dicegm 已有大部分字段；loregm 新补。
- `lastaction`（最新动作·RT-FE13）/ `lastReply`（最新回复·RT9）一并补，供 bay session 呈现。【拟·待确认 C3：lastaction/lastReply/packName 哪些必填、哪些可空？】

## 七、迁移策略【拟·待确认 C1】

- **v1 直接改（破坏性、不保留别名）**：旧 `/lore-sessions/*` 路由删除、不保留 307 过渡别名。
- 理由：开发期、无外部消费者、单源；保留别名 = 双写漂移源。
- 前端 `client.ts` 同步改所有端点路径；curl/playwright 断言路径同步改。
- 【拟】若需过渡别名，加 `/lore-sessions/* → /sessions/loregm/*` 的 307——倾向**不加**。

---

## 待用户确认清单


| #  | 项                                                       | 推荐值                         | 你的定调           |
| -- | -------------------------------------------------------- | ------------------------------ | ------------------ |
| C1 | 迁移策略：v1 直接改 / 保留 /lore-sessions 过渡别名       | 直接改·不加别名               | 直接改·不加别名   |
| C2 | 懒建（/open、首访懒建）是否保留为兜底                    | 完全移除（单源）               | 完全移除           |
| C3 | SessionSummary 的 lastaction/lastReply/packName 哪些必填 | 全部可空（按 kind 有意义则填） | packName可不能空啊 |

---

## 验收

- `POST /sessions/dicegm` `{teamId,version?}` → `201 {sessionId,kind:"dicegm"}`；`POST /sessions/loregm` `{name?}` → `201 {sessionId,kind:"loregm"}`（RT1 闭）。
- `GET /sessions/loregm` → `200 {sessions:[...]}`（RT6 闭）。
- `GET /sessions/loregm/{id}` → `200 {sessionId,kind,status,title,ended}`（RT7 闭）。
- 旧 `GET /lore-sessions` → `404`（破坏性改名生效·C1）。
- dicegm 子资源 `GET /sessions/dicegm/{id}/presentation` → `200`（路径拉平）。
- 期望来自本裁决 + 规约目标面，**首跑见红**（后端未拉平 = 红）。

## owns（预期触及，非独占）

- backend 路由层：dicegm 路由前缀加 `/dicegm`、loregm `/lore-sessions/*` → `/sessions/loregm/*`、loregm 列表/meta 新增、显式建会话端点。
- `packages/shared`：`SessionSummary` schema 统一（含 lastaction/lastReply）。
- 前端 `client.ts`：所有端点路径改 + 显式建会话调用点。
- curl/playwright：断言路径改。
- **可能与 RT-FE8（branches 子资源）重叠**——branches 在 `/sessions/dicegm/{id}/branches` 下，本裁决只定前缀拉平，branches 接口见 `debrief-and-branch` §二。

## 完成后

沉淀进 [04-子系统设计/玩家客户端-接口](../../04-子系统设计/玩家客户端-接口.md)（`/sessions/{kind}` 对称面 + 显式建会话 + loregm 列表/meta）+ 关 backlog RT-ns/RT1/RT6/RT7 + 勾路线图；删本裁决文件。
