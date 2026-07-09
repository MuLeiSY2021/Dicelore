# 裁决：co-build —— 构建团本页每轮内联 per-turn token

- [X]  用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 路线图项：里程碑二 · CO 前端可视化（构建团本页部分）。依赖 [usage-stream](usage-stream.md)（lore POST `{turnId, usage}` 契约）先合。
> 来源：用户 2026-06-30——「per-turn 放在构建团本页每一轮里，随 session 走」。复用 co-play 的 `pricing.ts`（先合 co-play、或本需求与 co-play 共建该文件，重叠合并时主 agent 解）。

## 设计（零不确定，仅剩代码实现）

### 1. build/api.ts：postBuildMessage 返回带 usage

`postBuildMessage` 返回类型从 `{ turnId: string }` 扩成 `{ turnId: string; usage?: UsageTotals }`（usage-stream 已让后端 POST 响应带 usage）。

### 2. BuildPage：构建轮消息内联 token

现状 `chat: {role:"a"|"u"; text}[]`，每次 `postBuildMessage` 返回后追加一条 assistant 消息（含 turnId 提示）。改为：该 assistant 消息附带本轮 usage——

- chat 条目类型加可选 `usage?: UsageTotals`。
- 收到 `{turnId, usage}` 后，把 usage 存进该条 chat 消息。
- 渲染该条消息时，末尾加一行小字脚注：`⟨{in+out} tok · ≈${estimateCostUsd}⟩`（复用 `features/cost/pricing.ts` 的 `estimateCostUsd`），无 usage 不显示；文案走 i18n（`build.usage.perTurn`）。

## 验收

- api 单测：`postBuildMessage` 解析 `{turnId, usage}`（含 usage / 不含 usage 两路）。
- BuildPage 渲染单测：返回含 usage 的构建轮显示 token+估价行；不含则不显示。
- `typecheck` + frontend `test` 绿；web 改动走 `/webapp-testing`（chromium 未装则退单测层）。

## owns（预期触及，非独占）

`frontend/src/features/build/api.ts`、`frontend/src/features/build/BuildPage.tsx` + i18n 键。复用 `frontend/src/features/cost/pricing.ts`（co-play 建；若并行则与 co-play 重叠、合并时解）。

## 完成后

沉淀进 [04-子系统设计/团本构建工具链](../../04-子系统设计/团本构建工具链.md)（构建轮成本内联）+ 关 backlog CO-前端条目 + 勾路线图；删本裁决文件。
