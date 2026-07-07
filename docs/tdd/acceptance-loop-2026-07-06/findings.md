# findings（第 1 轮 · 待真跑定论 / 接口重构后归口 backlog）

> 属 `acceptance-loop`。红 = 期望（状态机/接口规约）与现状不符。真跑（curl/playwright）定论后去重归类落 backlog 三池；不可逆修复进 `裁决记录/` 待用户批准。**改代码不改断言**（铁律 3）。

| # | 类型 | finding | 归口（暂拟） |
|---|---|---|---|
| RT1 | ❌ 真缺口 | 两 kind 均缺显式建会话 `POST /sessions/{kind}`（dicegm 懒建 `/open`、loregm 首访懒建）→ "新会话/选团本/加载存档"入口断裂 | backlog-后端 会话生命周期 |
| RT2 | ⚠️ 必真跑 | dicegm `choices` 语义 wiki 自相矛盾（§2注① 绕路 vs §10.1核验 已修） | 待真跑定论 |
| RT3 | ⚠️ 超前无契约 | `rewind`（会话分支）代码已有、接口页§6 标 v1 未覆盖 → 期望无契约可依 | 补设计契约 or backlog |
| RT4 | ⚠️ 字段 | `SessionSummary.packName` 疑后端未填（团本名分组失效） | 真跑 → backlog |
| RT5 | ⚠️ 语义债 | `narration_commit.seq` 是否已统一为全局 event seq | WS 验 → backlog |
| RT6 | ⚠️ 对称缺口 | **loregm 缺会话列表**（对称于 dicegm list）→ 制作页顶栏 bar / 在建团本不可列 | 接口重构定稿 |
| RT7 | ⚠️ 对称缺口 | **loregm 缺显式 create / get-meta**（对称于 dicegm） | 接口重构定稿 |
| RT-ns | ⚠️ 架构对称 | `/sessions`(dicegm) vs `/lore-sessions`(loregm) **命名不对称**；理想 `/sessions/{kind}`；内部 `Session`/`TurnResult` 已统一，仅 HTTP 表皮分裂（破坏性改名，冒泡待裁决） | backlog-后端 / 主题A′ HTTP 面 |
| RT8 | ⚠️ 能力缺口/增强 | 配置侧额外 MCP 工具（含**搜索**）未接入 GM/loregm 运行时（`FE-mcp-config` v1-deferred） | backlog-前端 FE-mcp-config / 增强 |
| RT9 | ⚠️ 字段 | 跑团/制作页顶栏 session bar 需 {最近活动日期, 所属团本, **最新回复内容**}；`SessionSummary` 是否含"最新回复"待验（疑缺） | 真跑 → backlog |
| RT-B3 | ⚠️ 必验 | WS `game_end` 曾从不发（映射漏），核验标已修 → 必真跑验终局画面确能触发 | 真跑 → backlog |
