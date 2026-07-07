# 第一步 B · 前端设计概览（据页状态机 · playwright 的锚）

> 属 `acceptance-loop` 第一步（前端 track）。据 [0-state-machines.md](0-state-machines.md) 的 B 页状态机，落**一套 html+css**——目的不是美术定稿，而是给每页**确定的结构 + 稳定选择器 + 关键交互**，作为第二步 playwright 驱动页状态机每条转移的锚。可承 wiki 视觉草图 [`玩家客户端-视觉草图/`](../../wiki/设计/04-子系统设计/玩家客户端-视觉草图/README.md)（home/play/build/config 四页 HTML·墨金）。
>
> **状态：脚手架**。下面是每页的结构/选择器**规约**（期望，来自状态机，先于实现）；`html+css 落地` 与逐页 playwright 由后续填（见 [2-tests.md](2-tests.md)）。

## 选择器约定

用 `data-testid` 挂稳定钩子（不依赖文案/class），playwright 只认它。命名 `data-testid="<page>-<element>"`，如 `nav-tab-play`、`catalog-start-btn`。

## 逐页结构 / 选择器规约

### B1 导航页 / 壳
- `nav-brand` 品牌；`nav-tab-{home,catalog,play,build,config}` 五页签；`nav-tab-play` 无活动会话时 `aria-disabled`（置灰）。
- `shell-runstatus`（运行态：model/mcp/notify ← health）；`shell-tools`（语言/明暗/强调色）。

### B2 主页
- `home-guide`（指南正文 + `home-manual-link` 使用手册链接）——**核心**。
- `home-recent-session`（**最近一个会话**摘要卡；无则隐藏/占位）；不出现全量列表。
- `home-quick-{catalog,build,config}` 快速入口。

### B3 团本目录页
- `catalog-list`（每项 `catalog-item` + `catalog-item-version` 版本下拉，默认最新）；空态 `catalog-empty`（引导导入/造示例）。
- `catalog-start-btn`（开始游戏 → 选版本 → 跳跑团）；`catalog-import-btn`（导入团本）；`catalog-edit-btn`（→制作页）。

### B4 跑团页
- **桌面沙盘壳**：整页为**单屏** `play-stage-shell`，页面本身不滚动；中央 `play-stage`（永不切走的跑团舞台）+ 左右 `play-dock-{left,right}`（被钉住的公开信息卡）+ 底部 `play-bay`（入口条，不承载常驻内容）。
- 左右停靠区不是单列，而是**可缩放栅格**；卡片默认按类型定尺寸：状态大卡、剧情线中卡、世界书/其他团数据小卡或横卡。
- `play-bay-btn-{session,status,plotline,world,other,config}` 六入口；点击后在**屏幕中央**弹 `play-bay-popover-{session,status,plotline,world,other,config}`，点浮窗外关闭。
- `play-session-item` 改挂在 `play-bay-popover-session` 内（`-date`/`-pack`/`-lastreply`），**不再要求顶栏 session bar**。
- `play-noSession-hint`（无活动会话 → 提示先导入/创建）。
- **玩家输入气泡独立于轮次卡**：`play-player-msg`（内含 `play-player-edit` / `play-player-delete`）。点 `edit` 后走**自动 rewind**，只保留提示 `play-rewind-note`；**不再出现显式 `play-rewind-btn/modal/confirm`**。`play-rewind-empty`（rewind 到头后的空态）；`play-archived`（归档态）。
- 未开场层 `play-kickoff-btn`；续玩层 `play-narration`（叙事流）、`play-input`（输入框）、`play-rollcard`（掷骰卡）、`play-choices`（选项按钮）、`play-error`、`play-gameend`（终局画面）。
- **卡片视图单位 = 一张 sheet**，不是字段：`play-card-status`（角色卡模板）、`play-card-plotline`（剧情线模板）、`play-card-world`（资料纸页模板）、`play-card-other`（其他团数据兜底模板）。
- 舞台配色与整体主题一致，不再做整块跳出的浅色纸面；长内容规则：状态类卡尽量完整展示；资料类卡默认摘要 + 展开，不做满屏工作区。
- AI 新披露信息进 `play-temp-stack`（临时位），不抢常驻位；常驻位不自动替换。

### B5 团本制作页
- 顶栏 session bar `build-sessionbar`（列构建会话）。
- 左导航 `build-nav-{lore,npc,pool,rule,state,front,plotline,foreshadow,anchor,relation,prologue,manifest}`（内容类型）；中央 `build-editor`；右栏 `build-assistant`（助手对话 + `-toolcalls` 显示调了哪些工具）、`build-validate-report`（error/warn 计数+定位）。
- 上下文条 `build-ctxbar`（团本名 + 草稿版本 + 校验/导入/导出）。

### B6 配置页
- 左导航 `config-nav-{general,network,mcp,model,theme,data,about}` 七子页。
- 子页视图 `config-subpage`；连接测试 `config-test-btn` → `config-test-{pending,ok,fail}` 三态。
- 关键控件：`config-model-select`、`config-agent-base`、`config-key-input`、`config-mcp-list`/`config-mcp-add`、`config-theme-*`、`config-data-readonly`（后端真值展示）。

## 落地状态

- [x] `frontend/` 下 5 页 html + 共享 `styles.css`/`app.js`（重构自 wiki 视觉草图），挂全上述 `data-testid`。见 [`frontend/README.md`](frontend/README.md)。
- [ ] 隐藏态（`play-noSession-hint`/`catalog-empty`/`play-input`/`play-gameend`/`config-test-*`/`play-bay-popover-*`）第三步据实际状态切换。
- [ ] 与状态机每条转移对应的可见状态可断言（供 playwright · 第二步）。
