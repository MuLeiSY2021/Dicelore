# backlog · 前端层

> **本页职责**：`apps/web` 层的 **issue 池**——组件 / 渲染 / 路由 / i18n / 视觉。按**主题**聚类、按 **fix/feat** 标注，广度无序（先还哪个见 [路线图](路线图.md)）。
> **单源（勿重复）**：拍了方案 → 写 [ADR](../05-决策记录-ADR/)，条目改标 `→ ADR-00xx` 关闭；已达成 → 进 [里程碑](里程碑.md)。

## 状态图例
- ✅**确认** — 客观/架构事实（已实测）。
- ⚠️**待真harness** — 行为/措辞类，当前结论不可信（见 [backlog-core 主题F](backlog-core.md)）。
- 💡**设计待ADR** — 需开设计周期 / 写 ADR。
- 🔧**可即修** — 便宜改动，随手可清。
- 🚧**在途** — 实现线进行中。
- 🔮**未来池** — 明确推迟。

## 字段约定
每条带：`类型(fix|feat)` · `来源` · `是否随规模恶化(✓/✓✓/✓✓✓/✗)` · `所属主题` · `下一步/依赖`。

---

## 主题 · 组件7 前端（fast-follow）🔮/🔧

> 权威设计：[玩家客户端.md](../04-子系统设计/玩家客户端.md) / [-接口.md](../04-子系统设计/玩家客户端-接口.md) / [-视觉.md](../04-子系统设计/玩家客户端-视觉.md) · [ADR-0018](../05-决策记录-ADR/)/[0019](../05-决策记录-ADR/)。
>
> **历史注记（已闭）**：**③ 美术风格统一定稿**（2026-06-23 前端墨金重构落地）——墨金 token 全量、Logo 实现标准、配置 7 子页统一表单、跑团页对齐，沉淀进 [视觉页 §9.1](../04-子系统设计/玩家客户端-视觉.md)；web 39 单测 + 19 Playwright e2e 全绿、FAKE_GM 真服务器联调 + 四页 subagent 验收通过。只读快照串 UI（`GET /sessions/:id/presentation` → 呈现台首屏）、配置→主题外观接 `useTheme`、前端补齐 5/10 消息（生成中/收尾/错误/终局 + WS 断线重连）、U4 选项闭环前端侧（`postChoice`+解禁+乐观锁）均已落地。主题G 视觉线落地完结。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| G-前端-bg3 | feat | **BG3 掷骰动效精修** | 接口页 §9 fast-follow | ✗ | 🔮 已记，随实时引擎面带 |
| G-前端-拖拽 | feat | **面板拖拽 / 缩放** | fast-follow | ✗ | 🔮 已记 |
| G-前端-逐字 | feat | **token 级逐字 narration**（前端渲染侧） | fast-follow | ✗ | 🔮 已记，与后端 token 流配套 |
| G-前端-toolcall | feat | **构建助手「显示调了哪些工具」**（前端展示） | fast-follow | ✗ | 🔮 依赖后端 lore-sessions 回 tool-call 痕迹（见 [backlog-后端](backlog-后端.md)） |
| ~~G-前端-导航置灰~~ | fix | **跑团导航无活动会话置灰** | fast-follow | ✗ | ✅ 已修（2026-06-24）：TopBar 无活动会话时 `/play` 置灰（`aria-disabled`+`pointer-events:none`） |
| ~~G-前端-i18n~~ | fix | **build 页若干硬编码中文走 i18n** | fast-follow | ✗ | ✅ 已修（2026-06-24）：BuildPage 9 处硬编码走 `t()`，i18n 加 12 key（中/英） |
| G-前端-About | feat | **About 真实版本号** | fast-follow | ✗ | 🔮 依赖后端 health 暴露版本号（见 [backlog-后端](backlog-后端.md)） |

---

## 主题 · 可观测性 · 日志分级统一 💡🔧

> **跨层主题**：病根与统一方案（抽同构 `shared/logger`）在 [backlog-core 主题O · O1](backlog-core.md)；本页挂前端侧症状条目，依赖 O1 落地后接入。前端跑在浏览器，**复用同一分级约定 + 上下文（sessionId）**，sink 走浏览器 console（可选远端上报）。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| O-前端 | feat | **前端日志分级覆盖**：`apps/web/src` 现 **0 日志**（无 console、无 logger），渲染/WS 重连/选项提交/错误全程无记录；按 `error/warn/info/debug` 分级覆盖 | 用户 | ✓ | 依赖 [backlog-core O1](backlog-core.md) 同构 logger 落地后接入；分级约定与 core/后端对齐 |

---

## 🔮 未来池（前端层 · 明确推迟，别现在做）

- **明骰/多人（前端）**：明骰交互终稿（措辞待 [backlog-core 主题F harness](backlog-core.md)）；多人会话 UI；Tauri 壳打包。来源：用户。
- **团本富前端组件 / 题材交互 widget**：如聊天界面里可点选购买的「小商店」（点卡片买、看价）。当前**只有商店**有此需求 → 推迟，**不为单一用例建「团本 ship 自定义 UI」的超复杂扩展**。将来若要，走**廉价中间路**：框架内置**有限几种** presentation widget + 生成工具声明里加 `present:"shop"` 提示（框架拥有组件、有限集，非团本任意 UI）。**后端不阻塞**：`shop_pool` 视图 + `shop_buy` 工具当下走 choice 式文本菜单即可（数据层项见 [backlog-core 未来池](backlog-core.md)）。来源：用户 + [声明式工具生成层 spec](../../superpowers/specs/2026-06-22-声明式工具生成层-design.md)（2026-06-22）；主题G 关联。
- **adapter 留下游**：GUI 前端壳。来源：04 TODO adapter。
