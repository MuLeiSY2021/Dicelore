# frontend · 墨金原型（据 B 页状态机重构 · acceptance-loop 第一步·前端）

据 [`../0-state-machines.md`](../0-state-machines.md) 的 B 页状态机、[`../1-frontend-overview.md`](../1-frontend-overview.md) 的 selector 规约，重构自 wiki 视觉草图 [`玩家客户端-视觉草图/`](../../../wiki/设计/04-子系统设计/玩家客户端-视觉草图/README.md)。**纯静态原型、无后端接线**（第三步接）——目的 = 给 playwright 稳定的结构 + `data-testid` 锚。

## 文件

| 文件 | 页 | 对应状态机 |
|---|---|---|
| `styles.css` | 共享墨金 token + 外壳(bar/nav/tools) + sidenav + session bar | — |
| `app.js` | lucide + 明暗切换 + 强调色板 | — |
| `home.html` | 主页 | B2（指南为主 + 最近一个会话摘要，**非全量列表**） |
| `catalog.html` | 团本目录页 | B3（跑团入口 · 选版本默认最新 · 导入 · 空态） |
| `play.html` | 跑团页 | B4（顶栏 session bar + 投影 dicegm 域机 A2） |
| `build.html` | 团本制作页 | B5（顶栏 session bar + 投影 loregm 域机 A3） |
| `config.html` | 配置页 | B6（七子页 + 连接测试三态） |

## 据当前设计对草图做的改动

- **新增 `catalog.html`**（草图无）——团本目录是跑团入口。
- **主页**从"继续上次大卡 + 快速入口 + **最近 Session 全量列表**"改为"**指南为主 + 最近一个会话摘要**"（全量会话挪到跑团/制作页顶栏 bar）。
- **跑团/制作页**加**顶栏 session bar**（滚动列所有会话：活动日期/团本/最新回复）；跑团页加 `play-noSession-hint`。
- 导航从 4 页签加到 5（+团本）。
- 全页挂 `data-testid`（见 `../1-frontend-overview.md`），playwright 只认它。

## 看

浏览器直接开各 `*.html`（静态、无需服务）。主题/色板可点。

## 待办（第二/三步）

- [ ] playwright 据这些 `data-testid` 写页机转移 spec（`../2-tests.md`）。
- [ ] 第三步：接后端真数据（替换静态占位），使 playwright 绿。
- [ ] 隐藏态（`play-noSession-hint` / `catalog-empty` / `play-input` / `play-gameend` / `config-test-*`）第三步据实际状态切换。
