# 第一步 B · 前端设计概览（据页状态机 · playwright 的锚）

> 属 `acceptance-loop` 第一步（前端 track）。据 [0-state-machines.md](0-state-machines.md) 的 B 页状态机，落**一套 html+css**——目的不是美术定稿，而是给每页**确定的结构 + 稳定选择器 + 关键交互**，作为第二步 playwright 驱动页状态机每条转移的锚。可承 wiki 视觉草图 [`玩家客户端-视觉草图/`](../../wiki/设计/04-子系统设计/玩家客户端-视觉草图/README.md)（home/play/build/config 四页 HTML·墨金）。
>
> **状态：脚手架**。下面是每页的结构/选择器**规约**（期望，来自状态机，先于实现）；`html+css 落地` 与逐页 playwright 由后续填（见 [2-tests.md](2-tests.md)）。

## 选择器约定

用 `data-testid` 挂稳定钩子（不依赖文案/class），playwright 只认它。命名 `data-testid="<page>-<element>"`，如 `nav-tab-play`、`catalog-start-btn`。

## 逐页结构 / 选择器规约

### B1 导航页 / 壳（全局 bay · 去顶栏）
- **所有页去顶栏**：无 `<nav class="bar">`、无 brand；nav 收进底部 **`app-bay`**（全局 fixed · 仿 mac 聚焦出现，默认隐形，鼠标移到底部唤出；显隐模式在配置页 `config-bay-mode` 改：聚焦出现/常驻/隐藏）。
- **bay 导航默认展开/收起**：展开态 = 横排页签 `app-bay-nav-tabs`（`nav-tab-{home,catalog,play,build,config}` · **图标+短名** · 当前页 on）+ `app-bay-nav-collapse`（« 收起按钮）；收起态 = `app-bay-nav`（≡ 导航按钮 · **点击直接展开**，不绕浮窗）。**默认跑团页收起**（body `bay-nav-collapsed`，因 bay 已有 session/团数据/配置/归档 等入口）、**其他页展开**；`app-bay-popover-nav` 浮窗（`#bay=nav` 或 harness 开）内 `app-bay-nav-expand` 也可展开。
- **`app-bay-popover-nav`**：≡ 点开浮窗，列 `nav-row-{home,catalog,play,build,config}` 五页签（当前页 on；`nav-row-play` 无活动会话时 `aria-disabled`）+ `app-bay-nav-expand`（展开常驻导航）+ 底部 `shell-runstatus`（运行态：model/mcp/notify ← health）。
- **`app-bay` 其他入口**：play 页 `play-bay-btn-{session,chara,plotline,world,forms,config,archive}`，home/catalog/build 额外 `app-bay-config`（跳配置页），config 页仅导航。
- 主题/外观收进配置页（`config-nav-theme`）；`shell-theme` 不再常驻。`#baybar=show` 强制 bay 常驻（审核用）。滚动条墨金配色（`::-webkit-scrollbar`）。

### B2 主页
- `home-guide`（指南正文 + `home-manual-link` 使用手册链接）——**核心**。
- `home-recent-session`（**最近一个会话**摘要卡；无则隐藏/占位）；不出现全量列表。
- `home-quick-{catalog,build,config}` 快速入口。

### B3 团本目录页
- `catalog-list`（每项 `catalog-item` + `catalog-item-version` 版本下拉，默认最新）；空态 `catalog-empty`（引导导入/造示例）。
- `catalog-start-btn`（开始游戏 → 选版本 → 跳跑团）；`catalog-import-btn`（导入团本）；`catalog-edit-btn`（→制作页）。

### B4 跑团页
- **桌面沙盘壳** `play-stage-shell`：中央 `play-stage`（永不切走的跑团舞台：叙事流 + 底部当前交互）+ **右侧 `play-dock-right`**（单 dock · 钉住的公开信息卡 · `play-dock-fold` 可折叠，折叠后舞台全宽）。底部 `app-bay` 为全局浮条（见 B1），不占布局流。
- **play 页 bay 专属入口**（bay 内 `app-bay-nav` 之外）：`play-bay-btn-{session,chara,plotline,world,forms,config,archive}`。点击在**屏幕中央**弹 `play-bay-popover-{...}`，点浮窗外 / × 关闭。
  - `play-bay-popover-session`：列会话 `play-session-item`（`-date`/`-pack`/`-lastreply`，**RT9 最新回复字段待验**）。
  - **团数据四类 = 数据浏览**（非"卡模板+钉选 toggle"）：`play-bay-popover-{chara,plotline,world,forms}` 分别浏览 **人物卡**（sheet 域 entity→cell，`play-data-entry` 展开看 HP/金钱/位置等 cell）/ **剧情线**（narrative plotline/foreshadow，状态/节点/伏笔）/ **世界书**（world lore/pool，条目摘要）/ **其他表单**（Front/Clock/Anchor）。每条 `d-entry` 可展开。**对齐后端**：`GET /presentation` 现仅出 `sheets`（entity→cell），剧情线/世界书后端快照待扩（暂借 sheet cell 承载）。
  - `play-bay-popover-config`：跑团配置含**防剧透**（严格/宽松/关闭）、**透视 GM 动作**（`play-observe-toggle`，控制 `play-stream.show-actions` 显隐 toolcall）、紧凑卡片、外观入口。
  - `play-bay-popover-archive`：归档卡找回（见下）。
- **dock-card = markdown 模板渲染器**（归属前端呈现层）：每张卡 = `dc-meta`（**数据选择器 `select … where …` + markdown 模板源码 `${xx.xx}` 占位 · 默认隐藏 · 编辑态显源码**）+ `dc-body`（**渲染后的 markdown**：h4/ul/kv/tag · 数据运行时从 sheet 注入）。三按钮 `play-card-{edit,archive,fold}`（**编辑模板 / 归档 / 折叠**；**去"钉选"概念**——卡是数据呈现，非钉选）。去纯圆角（`border-radius:2px`）+ dock 专属滚动条。预设 `play-card-{status,plotline,world,other}` + `play-card-custom`（DIY）。
- **归档**：`play-card-archive` 归档卡（非硬删）→ 进 `play-bay-popover-archive`（bay 归档入口 `play-bay-btn-archive`），`play-archive-restore` 可找回。
- **可见性**：团本作者的强制隐藏标记（暗值）= 渲染层硬底线，模板不可注入；玩家侧「防剧透」（bay-config）只调额外过滤层，不破硬底线。
- `play-noSession-hint`（无活动会话）。
- **叙事流 `play-stream`（无脊线，靠分割线分节）**：玩家气泡 `play-player-msg`（右倾气泡，带 `play-player-edit`/`play-player-delete`/`play-player-more`[复制·分支]）= 一轮的锚点；**narrate `prose`**（小说正文 · serif/15.5/1.85/无框/max-width680 · AI 调 narrate MCP 产出）≠ **GM 正文回复 `play-gm-reply`**（`.reply` · **去边框/小字 11.5/淡色 text3/署名「GM」淡化** · AI 正常 text 回复，对话层/meta，非 narrate；**刻意轻量**——AI 可能来回多句，气泡多了会烦）≠ **暗骰 `mech`**（带「暗骰」标 · **只说「GM 进行了一次 XX 判定」，不显示结果/DC**；细节由 bay-config 防剧透分级控制：严格只说掷了、宽松露成败、关闭全显）≠ 披露 `play-temp-stack`。`divider` 分割线带文案（幕首 / 「以上历史·以下本轮」/ 待掷·区间裁决 / 终局·复盘）。点 `edit` → `play-rewind-confirm`（inline 确认「将丢弃其后 N 条回合」+ 确认/取消）→ 确认才 rewind、留 `play-rewind-note`（**不省略确认**）。
- **明骰 vs 暗骰**：**明骰流程内联 stream**（`play-roll-bands` 区间分档 1-3/4-6/7-9/0 · AI narrate、**不带剧透**只描述可能发生什么 + 居中醒目 `play-roll-btn` 大按钮 + 投出后 `play-dice-result` 简化结果内联、命中档高亮，按钮变「已掷」）；暗骰走 `mech` 简条（见上）。**无掷骰弹窗**（旧 `play-dice-modal` 已删）。
- 续玩层态（底部当前交互）：`play-input`（常驻输入框）/ `play-choices`（**浮在输入框上方 · 非独占**，选项**不含后果提示**；含 `play-choice-own`「自己写一句」自定义入口）/ `play-generating` / `play-rollreq`（居中醒目掷骰按钮）/ `play-error` / **`play-postmortem-input`（终局·复盘输入框，仍可对话）**。未开场 `play-kickoff-btn`（含 `play-kickoff-pack` 团本信息卡：题材/标题/简介/角色预览）。
- **终局 = 复盘态（不遮罩）**：GM 已知游戏结束进入复盘，不再推进剧情、回答玩家问题；续玩层继续可用，玩家可问 GM 或回到某轮玩家气泡「⋯ → 分支」回档。**无黑屏遮罩、无「新局/复盘」按钮**。rewind 到头 → 转 kickoff 态（无独立 rewind-empty）；归档不单列态。
- AI 新披露信息进 `play-temp-stack`（临时位），不抢常驻 dock 位。
- `play-noSession-hint`（无活动会话 · 含引导入口 `play-none-catalog` + 最近会话 `play-none-recent`，不空）。
- **移动端**（`layout=mobile`）：右 dock 缩进 stage 上方、横向滚动、每条 dock-card 可折叠。

### B5 团本制作页
- **会话切换进 bay**（对齐 play）：`build-bay-btn-session`→`build-bay-popover-session` 浮窗列构建会话（`build-session-item`/`build-session-date`/`build-session-lastaction` + `build-session-new`）；**无顶栏 sessionbar**。
- 上下文条 `build-ctxbar`（团本名 + 草稿版本 + 校验/导入/导出）。
- 左导航 `build-nav-{lore,npc,pool,rule,state,front,plotline,foreshadow,anchor,relation,prologue,manifest}`（内容类型）；中央 `build-editor`；右栏 `build-assistant`（助手对话 + `-toolcalls` 显示调了哪些工具）、`build-validate-report`（error/warn 计数+定位）。
- flex 滚动修法对齐 play（`bbody` calc 视口 + sidenav/aside `flex:none` + main/mbody/chat `min-height:0`）；内容卡 `border-radius:2px` 去纯圆角。

### B6 配置页
- 左导航 `config-nav-{general,network,mcp,model,theme,data,about}` 七子页。
- 子页视图 `config-subpage`；连接测试 `config-test-btn` → `config-test-{pending,ok,fail}` 三态。
- 关键控件：`config-model-select`、`config-agent-base`、`config-key-input`、`config-mcp-list`/`config-mcp-add`、`config-theme-*`、`config-data-readonly`（后端真值展示）。

## 落地状态

- [x] `frontend/` 下 5 页 html + 共享 `styles.css`/`app.js`（重构自 wiki 视觉草图），挂全上述 `data-testid`。见 [`frontend/README.md`](frontend/README.md)。
- [x] 本轮迭代已落地：去顶栏 + bay（导航默认跑团收起/其他展开 · ≡直接展开）、dock-card markdown 模板渲染器（edit/archive/fold · 去钉选）、明骰内联 stream / 暗骰 mech 分级、choices 浮层（toggle·send）、终局=复盘态不遮罩、团数据四类数据浏览、归档找回、滚动条墨金 + flex 滚动修法（play dock / build bbody 各自 calc 视口 + 子项 `flex:none` + 容器 `min-height:0`，卡去纯圆角 `border-radius:2px`）。
- [ ] 隐藏态（`play-noSession-hint`/`catalog-empty`/`play-input`/`play-postmortem-input`/`config-test-*`/`play-bay-popover-*`）第三步据实际状态切换。
- [ ] 与状态机每条转移对应的可见状态可断言（供 playwright · 第二步）。
