# 裁决：model-switch —— stagebar 运行时 model 切换（下回合生效）

- [X]  用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 来源：acceptance-loop 第 1 轮 RT-FE18（`class="stagebar"` 中间加 model 切换器、随时切）。
> 用户 2026-07-08 定调：「下回合生效」。
> **2026-07-10 修订**：原独立 `POST …/model` 端点**并入统一 session config 端点** `POST /sessions/{kind}/{id}/config`（部分更新 body）——与 [`spoiler-tiering-and-dock-diy`](spoiler-tiering-and-dock-diy.md) §一 RT-FE9 的防剧透档位同端点。model 仍下回合生效、spoilerTier 立即生效，同端点不同生效时机。C1 定调随之更新为「统一 config 端点」。
> 现状：model 在配置页模型连接子页设定（规约§6），`buildQueryOptions`（`gmAssembly.ts:29,54`）的 `model` 来自 `AgentInit.model`——会话启动时固定，运行中不可切。本裁决加运行时切换能力。

---

## 一、定调

- `class="stagebar"` 中间加 model 切换器，随时切。
- **下回合生效**：当前回合（生成中/待输入）继续用旧 model，下一回合 `drive-turn` 起用新 model。

## 二、接口

**统一 session config 端点**（model 与 spoilerTier 等会话级配置合并，部分更新）：

| 接口 | `POST /sessions/{kind}/{id}/config` |
| ---- | ----------------------------------- |
| 请求 | `{ model?: string, spoilerTier?: "strict"\|"loose"\|"off", ... }`（部分更新，只传要改字段） |
| 响应 | `200 { model, spoilerTier, pendingModel?, ... }`（更新后完整 config） |
| model 语义 | 设 `pendingModel`；下回合 `drive-turn` 起生效（`effectiveAt:"next-turn"`） |
| 读 | `GET /sessions/{kind}/{id}/config` → `200 { model, spoilerTier, ... }` |

- **C1 定调（2026-07-10 修订）**：统一 `POST …/config`（部分更新 body），**非**独立 `POST /model`。理由：会话级运行时配置（model / 防剧透档位 / 未来项）单端点收口，避免元动作端点 proliferate。与 `rewind`/`branches` 等纯元动作端点不同——那些是单次动作、config 是配置 bag。
- `kind` ∈ dicegm|loregm。**C2 定调**：是——两 kind 都支持（制作页 stagebar 同样可切；loregm 也持 config）。
- model 仍**下回合生效**（设 `pendingModel`，非立即）；spoilerTier **立即生效**（前端呈现过滤）。同端点不同生效时机。

## 三、下回合生效语义（实现）

- session 持有 `currentModel`（本回合用）+ `pendingModel`（下回合用·默认 undefined=不切）。
- `POST …/config {model}` 设 `pendingModel = body.model`（body 可能还带其它 config 字段如 spoilerTier，各自语义独立处理）。
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


| #  | 项                                 | 推荐值                                 | 你的定调 |
| -- | ---------------------------------- | -------------------------------------- | -------- |
| C1 | 接口形式                           | 统一`POST /sessions/{kind}/{id}/config`（部分更新·2026-07-10 修订） | ✅ 统一 config 端点（并入 spoilerTier 等） |
| C2 | loregm 域是否也支持切              | 是（两 kind 都支持）                   | ✅ 是 |
| C3 | 切 model 后 cache 失效是否特殊处理 | 不处理（cache 按 model 自然失效）      | ✅ 不处理 |

---

## 验收

- `POST /sessions/dicegm/{id}/config {model:"claude-haiku-4-5-20251001"}` → `200 {model, spoilerTier, pendingModel, ...}`（model 下回合生效）。
- 当前回合 `usage.model` 仍为旧 model；下回合 `usage.model` 为新 model。
- `contextWindow` 随新 model 变（foot 占用% 重算）。
- 切 model 后首回合 `cacheReadTokens` 骤降（cache 失效·C3）。
- 期望首跑见红（无 `POST …/config` 端点 = 红）。

## owns（预期触及，非独占）

- backend：`GET/POST /sessions/{kind}/{id}/config` 端点 + session `currentModel`/`pendingModel` 状态（+ spoilerTier 等 config 字段，与 spoiler-tiering 裁决同节点）。
- harness：`buildQueryOptions` 读 session `currentModel`（每回合）；`AgentInit.model` 退化为初始值。
- 前端：stagebar model 切换器（下拉 + 当前高亮）。
- **对接 `usage-and-context`**（contextWindow 随 model 变）+ **`session-surface-flatten`**（端点在 `/sessions/{kind}/{id}/config` 下）+ **`spoiler-tiering-and-dock-diy`**（同 config 端点共 spoilerTier）。

## 完成后

沉淀进 [04-子系统设计/玩家客户端-接口](../../04-子系统设计/玩家客户端-接口.md)（`POST …/config` + 下回合生效语义 + spoilerTier 立即生效）+ [玩家客户端-视觉](../../04-子系统设计/玩家客户端-视觉.md)（stagebar model 切换器）+ 关 backlog RT-FE18 + 勾路线图；删本裁决文件。
