# 裁决：model-switch —— stagebar 运行时 model 切换（下回合生效）

- [ ] 用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 来源：acceptance-loop 第 1 轮 RT-FE18（`class="stagebar"` 中间加 model 切换器、随时切）。
> 用户 2026-07-08 定调：「下回合生效」。
> 现状：model 在配置页模型连接子页设定（规约§6），`buildQueryOptions`（`gmAssembly.ts:29,54`）的 `model` 来自 `AgentInit.model`——会话启动时固定，运行中不可切。本裁决加运行时切换能力。

---

## 一、定调

- `class="stagebar"` 中间加 model 切换器，随时切。
- **下回合生效**：当前回合（生成中/待输入）继续用旧 model，下一回合 `drive-turn` 起用新 model。

## 二、接口

| 接口 | `POST /sessions/{kind}/{id}/model` |
|------|------|
| 请求 | `{ model: string }` |
| 响应 | `200 { model, effectiveAt: "next-turn" }` |
| 语义 | 设置 `pendingModel`；下回合 `drive-turn` 起生效 |

- 【拟·待确认 C1：独立 `POST /model` vs `PATCH /sessions/{kind}/{id} {model}`】推荐独立 `POST /model`（语义清晰、与 `rewind`/`branches` 等元动作端点一致）。
- `kind` ∈ dicegm|loregm【拟·待确认 C2：loregm 也支持？】推荐是——制作页 stagebar 同样可切。

## 三、下回合生效语义（实现）

- session 持有 `currentModel`（本回合用）+ `pendingModel`（下回合用·默认 undefined=不切）。
- `POST /model` 设 `pendingModel = body.model`。
- 下一回合 `drive-turn` 开始时：若 `pendingModel` 非空 → `currentModel = pendingModel`、`pendingModel = undefined`；`buildQueryOptions` 用新 `currentModel`。
- 当前回合已发出的 `query()` 不受影响（SDK 用旧 model 跑完）。

## 四、model 来源

- 切换器选项来自配置页模型连接子页设定的**可用 model 列表**（规约§6 模型连接：GM 模型下拉 + key/baseURL）。
- stagebar 切换器 = 该列表的下拉 + 当前 `currentModel` 高亮。

## 五、与 contextWindow 联动（对接 usage-and-context）

- 切 model 后，`contextWindow` 随新 model 变（`CONTEXT_WINDOW` 表·见 `usage-and-context` §四）。
- foot 占用% 用新 `contextWindow` 重算。
- 缓存：cache 按 model 绑定，切 model 后首回合 cache miss（`cacheReadTokens` 骤降、`contextTokens` 反映新 model 下重新构建的 prompt）——属正常、不特殊处理【拟·待确认 C3】。

---

## 待用户确认清单

| # | 项 | 推荐值 | 你的定调 |
|---|----|--------|----------|
| C1 | 接口形式 | 独立 `POST /sessions/{kind}/{id}/model` | |
| C2 | loregm 域是否也支持切 | 是（两 kind 都支持） | |
| C3 | 切 model 后 cache 失效是否特殊处理 | 不处理（cache 按 model 自然失效） | |

---

## 验收

- `POST /sessions/dicegm/{id}/model {model:"claude-haiku-4-5-20251001"}` → `200 {model, effectiveAt:"next-turn"}`。
- 当前回合 `usage.model` 仍为旧 model；下回合 `usage.model` 为新 model。
- `contextWindow` 随新 model 变（foot 占用% 重算）。
- 切 model 后首回合 `cacheReadTokens` 骤降（cache 失效·C3）。
- 期望首跑见红（无 `POST /model` 端点 = 红）。

## owns（预期触及，非独占）

- backend：`POST /sessions/{kind}/{id}/model` 端点 + session `currentModel`/`pendingModel` 状态。
- harness：`buildQueryOptions` 读 session `currentModel`（每回合）；`AgentInit.model` 退化为初始值。
- 前端：stagebar model 切换器（下拉 + 当前高亮）。
- **对接 `usage-and-context`**（contextWindow 随 model 变）+ **`session-surface-flatten`**（端点在 `/sessions/{kind}/{id}/model` 下）。

## 完成后

沉淀进 [04-子系统设计/玩家客户端-接口](../../04-子系统设计/玩家客户端-接口.md)（`POST …/model` + 下回合生效语义）+ [玩家客户端-视觉](../../04-子系统设计/玩家客户端-视觉.md)（stagebar model 切换器）+ 关 backlog RT-FE18 + 勾路线图；删本裁决文件。
