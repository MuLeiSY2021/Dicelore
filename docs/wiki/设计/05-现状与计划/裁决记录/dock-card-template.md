# 裁决：dock-card-template —— dock-card 模板 canonical 语法 + 可视化边界 + 预设/DIY 边界

- [ ] 用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 来源：acceptance-loop 第 1 轮 RT-FE2（dock-card 呈现契约待 derive）+ RT-FE10（模板/归档态纯前端 localStorage·已定调）。
> 用户 2026-07-08 定调：「本轮 derive 完整 canonical」。
> 定性已决（RT-FE2）：dock-card = **前端呈现层 markdown 模板渲染器**，`dc-meta`=数据选择器（默认隐/编辑显源码）、`dc-body`=渲染后 markdown、三按钮 edit/archive/fold、去钉选、去圆角、dock 专属滚动条。

---

## 一、canonical 模板语法（完整 derive）

模板源码 = **数据选择器（dc-meta）+ markdown 体（dc-body 含插值）**。

### 1.1 数据选择器（dc-meta · YAML front matter 风格）

```
---
select: <entity>            # 必填·从哪个 entity 取（如 人物/剧情）
where: <attr> <op> <value>  # 可选·过滤·op ∈ ==,!=,>,<,contains
order: <attr>               # 可选·排序
limit: <n>                  # 可选·限量
---
```

- `select` 的 entity 来自 `GET /presentation` 的 `sheets[].entity`（对接 RT-FE4；RT-FE4 单独展开后可能扩 plotline/world entity）。
- 多选择器：可在 dc-meta 声明多个命名选择器（`selects: { alias: {select, where}, ... }`），dc-body 用 `${alias.attr}` 引用。【拟·待确认 C1：v1 单 select vs 多 selects？推荐 v1 单 select，多选 v2】

### 1.2 插值语法（dc-body markdown 内）

| 语法 | 语义 |
|------|------|
| `${<attr>}` | 当前记录的属性值 |
| `${#each <select>}}...${{/each}}` | 循环遍历选择器结果 |
| `${{<expr>}}...${{/if}}` | 条件块（expr 如 `${hp} < 10`）【拟·待确认 C1】 |

- 标量场景（select 命中单条）：`${attr}` 直接取该条属性。
- 列表场景（select 命中多条）：必须包在 `${#each}...${{/each}}` 内。

### 1.3 markdown 体

标准 markdown，插值替换后由 markdown 渲染器渲染（墨金主题）。

## 二、可视化组件边界（dial/bar/Front）

| 组件 | 语法 | 适用 | v1 |
|------|------|------|----|
| dial（刻度盘） | `![dial](<attr>)` | 数值 cell（0-100） | ✅ v1 |
| bar（进度条） | `![bar](<attr>)` | 数值 cell | ✅ v1 |
| Front（前沿卡） | `![front](<id>)` | front 数据（依赖 RT-FE4 投影） | ⚠️ 依赖 RT-FE4 单独展开 |

- 纯文本 cell（描述/状态/笔记）走标准 markdown 插值，无需特殊组件。
- 【拟·待确认 C2：v1 可视化 = dial/bar，Front 随 RT-FE4？推荐是】

## 三、作者预设 vs 玩家 DIY 边界

| | 作者预设模板 | 玩家 DIY 模板 |
|---|---|---|
| 来源 | 团本包 toolgen `tools/*.json`（作者制作页定义·commit 进包） | 前端 localStorage |
| 共享 | 所有玩家共享 | 仅本机 |
| 权限 | 只读 | 可改 |
| 数据查询 | 包内任意数据（作者授权） | 仅 `visible=1` 数据（受防剧透约束·对接 RT-FE9）【拟·待确认 C3】 |

- dock-card 编辑态：预设模板「另存为 DIY」才可改（不破坏包内只读）。
- DIY 查询边界【拟·待确认 C3】：DIY 模板 select 仅返回 `visible=1` 的 cell（对接 RT-FE9 前端按 visible 呈现）；预设模板不受此限（作者授权全量）。推荐是。

## 四、归档态（对接 RT-FE10）

- `archive` 按钮 → 卡片归档（纯前端 localStorage，跨会话本机保留）。
- 归档找回：`play-bay-popover-archive` → `play-archive-restore`。
- 不落后端（RT-FE10 已定调 localStorage）。

## 五、渲染数据源

- `GET /presentation` 的 `sheets`（entity→cell）注入 dc-meta select。
- **依赖 RT-FE4**（单独展开）：若 RT-FE4 扩 snapshot schema 加 plotline/world，dock-card 可 select 更多 entity；v1 先借 sheets 的 entity。

---

## 待用户确认清单

| # | 项 | 推荐值 | 你的定调 |
|---|----|--------|----------|
| C1 | v1 单 select vs 多 selects；是否支持条件块 `${{expr}}` | v1 单 select + 支持条件块 | |
| C2 | v1 可视化组件范围 | dial/bar（Front 随 RT-FE4） | |
| C3 | DIY 模板查询边界：仅 visible=1 vs 全量 | 仅 visible=1（对接 RT-FE9） | |

---

## 验收

- **作者预设模板**：包内 `tools/*.json` 定义模板 → 前端 dock 渲染 → 数据从 `sheets` 注入、插值替换正确。
- **玩家 DIY**：新建 dock-card → 编辑源码（dc-meta + dc-body）→ 预览渲染 → 保存 localStorage → 重载仍在。
- **可视化**：dial/bar 对数值 cell 渲染为刻度盘/进度条。
- **循环**：`${#each}...${{/each}}` 对多记录正确遍历。
- **防剧透**：DIY 模板 select 不返回 `visible≠1` cell（C3）。
- **归档**：archive → localStorage → 归档找回 restore。
- 期望首跑见红（前端未实现渲染器 = 红）。

## owns（预期触及，非独占）

- 前端：dock-card 渲染器（模板解析 + 插值 + markdown 渲染 + dial/bar 组件）、编辑态、归档、localStorage。
- 团本包 toolgen：作者预设模板 `tools/*.json` schema（模板源码字段）。
- **依赖 RT-FE4**（单独展开）：渲染数据源若扩 plotline/world，select entity 范围扩大。

## 完成后

沉淀进 [04-子系统设计/玩家客户端-视觉](../../04-子系统设计/玩家客户端-视觉.md)（dock-card 模板 canonical 语法 + 可视化边界 + 预设/DIY）+ [团本构建工具链](../../04-子系统设计/团本构建工具链.md)（`tools/*.json` 预设模板 schema）+ 关 backlog RT-FE2 + 勾路线图；删本裁决文件。
