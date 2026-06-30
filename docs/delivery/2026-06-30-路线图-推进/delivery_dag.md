# 本轮 DAG 设计（2026-06-30 路线图推进）

> 本轮范围（用户经 AskUserQuestion 选定）：里程碑二 CO 前端可视化 + 里程碑四 SEC2 key 托管 + RT-1 中期回合级事务（SEC1/SEC3/MT1/S1/S2 推 v2）。
> 打底先行（已合 main）：归档撤除后的 ADR 死链/词汇清理、路线图状态漂移、路径命名对齐、wiki TODO 归 backlog、CONTRIBUTING + GitHub 社区文件。

## 分解单位 = 需求（不按文件）

**反面教训（false start）**：首轮把 usage/key/SSRF/限流 四需求**并成一个「后端节点 BE-1」**，理由是它们都在 `server.ts` 挂路由。用户纠偏：撞文件不是打包理由——按需求切、文件冲突集成时主 agent 解。据此重切 + 重构了 skill（分解单位文件→需求）。

## 全图

```
wave1（5 独立需求，文件天然不重叠，server.ts 挂载归主 agent 集成时做）
  usage-api    backend/src/api/usage.ts                    GET /sessions/:id/usage 查询端点
  key-host     backend/src/api/keys.ts + store/keys.ts+db.ts  SEC2 key 托管(AES-256-GCM)
  ssrf         backend/src/api/diagnostics.ts              model-test/mcp-test SSRF 白名单
  ratelimit    backend/src/api/rateLimit.ts                per-session 限流中间件
  rt1          harness/turnLoop.ts + backend/store/turnRollback.ts  RT-1 中期回合级事务

wave2（co-viz 经用户纠偏重设计:per-turn 随 session 流走、内联每一轮,非查询面板）
  usage-stream packages/shared/stream.ts + harness/turnLoop.ts,DiceSession.ts + backend/api/lore.ts
               per-turn token 搭上 turn-end 信号(dice turn_ended + lore POST 响应)
  sec2-fe      frontend config/* + useSettings + client.ts  前端只存 key 引用 + 代发

wave3（依赖 usage-stream 的契约）
  co-play      frontend/play/{useSession,PlayPage}          跑团页每轮内联 per-turn token
  co-build     frontend/build/{api,BuildPage}               构建团本页每轮内联
```

## 热点文件冲突（集成时主 agent 解，不靠拆分规避）

- `backend/src/server.ts`：wave1 四个后端需求都要挂路由/中间件 → **不归任何节点**，主 agent 集成时统一挂（已做：e45e8d3）。
- `backend/src/index.ts`：key-host + rt1 都加 barrel export → git 自动合（非相邻行）。
- `frontend/src/shared/api/client.ts`：co-viz/sec2-fe 都加方法 → wave3/wave2 集成时主 agent 解。

## 裁决闸（2026-06-30 用户新立，本轮中途引入）

用户中途确立：要交付的需求须先有「经用户批准的裁决文件」（[裁决记录/](../../wiki/设计/05-现状与计划/裁决记录/)）。**本轮 wave1 在此闸确立前已交付**——属历史；wave2/wave3 是否补走裁决闸待用户定（见 wave_1_summary 末「待用户决断」）。
