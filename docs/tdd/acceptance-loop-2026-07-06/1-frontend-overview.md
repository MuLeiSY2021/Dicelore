# 第二步 · 前端 overview（据第一步原型回写 · playwright 的锚）

> 属 `acceptance-loop` 第二步（前端 track）。据 [0-state-machines.md](0-state-machines.md) 的 B 页状态机，对已落地的 [`frontend/`](frontend/) 原型**回写**——每页**确定的结构 + 稳定 `data-testid` 选择器 + 关键交互**，作为第四步 playwright 驱动页状态机每条转移的锚。选择器直接从原型 html 抄，不另起炉灶。可承 wiki 视觉草图 [`玩家客户端-视觉草图/`](../../wiki/设计/04-子系统设计/玩家客户端-视觉草图/README.md)（home/play/build/config 四页 HTML·墨金）。
>
> 本步同时产出**前端数据需求清单**（每个动态区域需后端喂什么），喂给第三步后端接口协议。**收口门**：原型逐态可预览 + overview 与原型选择器对得上 + 数据需求清单成形，才进第三步。
> **状态：收口**——双向核对通过：①html→overview 229 个 testid 全覆盖(含 `{a,b,c}` 模式展开) ②overview→html 声称的 testid 全在原型中(余 `dc-body`/`dc-meta`=class 名、`home-visited`=localStorage、`play-dice-modal`=已删历史名、`play-archive-restore`/`play-session-pack`=标期望·原型待补)。本轮修整：dock-card 命名分裂(`dc-*`→`play-card-*`)已改、31 处漏记已补、`play-stage`(html 无)已并 `play-stage-shell`、`play-session-pack`/`play-archive-restore` 多写已标期望。选择器以 html 为源(铁律·不另起炉灶)。页机转移↔selector 断言映射见 [2-tests.md](2-tests.md) B1–B6；隐藏态切换留第五步。

## 选择器约定

用 `data-testid` 挂稳定钩子（不依赖文案/class），playwright 只认它。命名 `data-testid="<page>-<element>"`，如 `nav-tab-play`、`catalog-start-btn`。

## 逐页结构 / 选择器规约

### B1 导航页 / 壳（全局 bay · 去顶栏）
- **所有页去顶栏**：无 `<nav class="bar">`、无 brand；nav 收进底部 **`app-bay`**（全局 fixed · 仿 mac 聚焦出现，默认隐形，鼠标移到底部唤出；显隐模式在配置页 `config-bay-mode` 改：聚焦出现/常驻/隐藏）。
- **bay 导航默认展开/收起**：展开态 = 横排页签 `app-bay-nav-tabs`（`nav-tab-{home,catalog,play,build,config}` · **图标+短名** · 当前页 on）+ `app-bay-nav-collapse`（« 收起按钮）；收起态 = `app-bay-nav`（≡ 导航按钮 · **点击直接展开**，不绕浮窗）。**默认跑团页收起**（body `bay-nav-collapsed`，因 bay 已有 session/团数据/配置/归档 等入口）、**其他页展开**；`app-bay-popover-nav` 浮窗（`#bay=nav` 或 harness 开）内 `app-bay-nav-expand` 也可展开。
- **`app-bay-popover-nav`**：≡ 点开浮窗，列 `nav-row-{home,catalog,play,build,config}` 五页签（当前页 on；`nav-row-play` 无活动会话时 `aria-disabled`）+ `app-bay-nav-expand`（展开常驻导航）+ 底部 `shell-runstatus`（运行态：model/mcp/notify ← health）。
- **`app-bay` 其他入口**：play 页 `play-bay-btn-{session,chara,plotline,world,forms,config,archive,usage}`（usage→用量详情浮窗），build 页 `build-bay-btn-{session,usage}`，home/catalog/build 额外 `app-bay-config`（跳配置页），config 页仅导航。
- 主题/外观收进配置页（`config-nav-theme`）；`shell-theme` 不再常驻。`#baybar=show` 强制 bay 常驻（审核用）。滚动条墨金配色（`::-webkit-scrollbar`）。

### B2 主页
- `home-guide`（指南正文 + `home-manual-link` 使用手册链接 `<a>` → wiki 指南）——**核心**。
- `home-hello`（问候语 · JS 按时段 + 首访/回访分支 · localStorage `home-visited`）。
- `home-recent-session`（**最近一个会话**摘要卡，整卡 `<a href="play.html">` · 内 `home-recent-continue` 继续按钮）；不出现全量列表。无会话首访走空态 `home-empty-session`（`#s=empty` · 隐藏 resume + 首访欢迎 + 烫金主按钮 `home-start-cta` → catalog）。
- `home-quick-{catalog,build,config}` 快速入口（catalog 卡 `featured` 标「推荐开局」强 CTA）。
- `home-runstatus`（角落运行态徽章 · model/mcp/notify）。落地页强制 bay 常驻（首站新手找得到导航）。

### B3 团本目录页
- `catalog-list`（每项 `catalog-item`：题材 tag + 角色预览 chip + `catalog-item-session` 续玩提示 + `catalog-item-version` 版本入口（点开 modal）+ `catalog-edit-btn`→`<a href="build.html?id=">` + `catalog-delete-btn` + `catalog-start-btn`）；空态 `catalog-empty`（引导导入 `catalog-import-btn-empty` / 造示例 `catalog-sample-btn`）；加载骨架 `catalog-loading`（`#s=loading`）。
- `catalog-search` / `catalog-filter`（按名/题材实时过滤）。
- `catalog-import-btn` → `catalog-import-modal`（导入流程：`catalog-import-drop`/`catalog-import-file` 选文件 → `catalog-import-log` validatePack 校验日志（ok/warn/err 着色）→ `catalog-import-confirm` 入库 · A4 信任闸）。
- `catalog-start-btn` → `catalog-version-modal`（`catalog-version-packname` 参数化团本名 + `catalog-version-list` 每 `catalog-version-opt` 带 changelog + 可展开 `vdiff`（`+`/`-` 着色）→ `catalog-version-confirm` 跳跑团）。

### B4 跑团页
- **桌面沙盘壳** `play-stage-shell`：中央舞台区（永不切走的跑团舞台：叙事流 + 底部当前交互）+ **右侧 `play-dock-right`**（单 dock · 钉住的公开信息卡 · `play-dock-fold` 可折叠，折叠后舞台全宽）。底部 `app-bay` 为全局浮条（见 B1），不占布局流。
- **play 页 bay 专属入口**（bay 内 `app-bay-nav` 之外）：`play-bay-btn-{session,chara,plotline,world,forms,config,archive}`。点击在**屏幕中央**弹 `play-bay-popover-{...}`，点浮窗外 / × 关闭。
  - `play-bay-popover-session`：列会话 `play-session-item`（`play-session-date`/`play-session-lastreply`，**RT9 最新回复字段待验**；`play-session-pack` 所属团本=期望·原型待补）。
  - **团数据四类 = 数据浏览**（非"卡模板+钉选 toggle"）：`play-bay-popover-{chara,plotline,world,forms}` 分别浏览 **人物卡**（sheet 域 entity→cell，`play-data-entry` 展开看 HP/金钱/位置等 cell）/ **剧情线**（narrative plotline/foreshadow，状态/节点/伏笔）/ **世界书**（world lore/pool，条目摘要）/ **其他表单**（Front/Clock/Anchor）。每条 `d-entry` 可展开。**对齐后端**：`GET /presentation` 现仅出 `sheets`（entity→cell），剧情线/世界书后端快照待扩（暂借 sheet cell 承载）。
  - `play-bay-popover-config`：跑团配置含**防剧透**（严格/宽松/关闭）、**透视 GM 动作**（`play-observe-toggle`，控制 `play-stream.show-actions` 显隐 toolcall）、紧凑卡片、外观入口。
  - `play-bay-popover-archive`：归档卡找回（见下）。
- **dock-card = markdown 模板渲染器**（归属前端呈现层）：每张卡 = `play-card-meta`（class `dc-meta`·**数据选择器 `select … where …` + markdown 模板源码 `${xx.xx}` 占位 · 默认隐藏 · 编辑态显源码**）+ `play-card-body`（class `dc-body`·**渲染后的 markdown**：h4/ul/kv/tag · 数据运行时从 sheet 注入）。三按钮 `play-card-{edit,archive,fold}`（**编辑模板 / 归档 / 折叠**；**去"钉选"概念**——卡是数据呈现，非钉选）。去纯圆角（`border-radius:2px`）+ dock 专属滚动条。预设 `play-card-{status,plotline,world,other}` + `play-card-custom`（DIY）。
- **归档**：`play-card-archive` 归档卡（非硬删）→ 进 `play-bay-popover-archive`（bay 归档入口 `play-bay-btn-archive`·空态 `play-archive-empty`），`play-archive-restore` 找回=期望·原型待补。
- **可见性**：团本作者的强制隐藏标记（暗值）= 渲染层硬底线，模板不可注入；玩家侧「防剧透」（bay-config）只调额外过滤层，不破硬底线。
- `play-noSession-hint`（无活动会话）。
- **叙事流 `play-stream`（无脊线，靠分割线分节）**：玩家气泡 `play-player-msg`（右倾气泡，带 `play-player-edit`/`play-player-delete`/`play-player-more`[复制·分支]）= 一轮的锚点；**narrate `prose`**（小说正文 · serif/15.5/1.85/无框/max-width680 · AI 调 narrate MCP 产出）≠ **GM 正文回复 `play-gm-reply`**（`.reply` · **去边框/小字 11.5/淡色 text3/署名「GM」淡化** · AI 正常 text 回复，对话层/meta，非 narrate；**刻意轻量**——AI 可能来回多句，气泡多了会烦）≠ **暗骰 `mech`**（带「暗骰」标 `play-hidden-roll` · **只说「GM 进行了一次 XX 判定」，不显示结果/DC**；细节由 bay-config 防剧透分级控制：严格只说掷了、宽松露成败、关闭全显）≠ 披露 `play-temp-stack`。`divider` 分割线带文案（幕首 / 「以上历史·以下本轮」/ 待掷·区间裁决 / 终局·复盘）。点 `edit` → `play-rewind-confirm`（inline 确认「将丢弃其后 N 条回合」+ `play-rewind-go` 确认 / `play-rewind-cancel` 取消）→ 确认才 rewind、留 `play-rewind-note`（**不省略确认**）。
- **明骰 vs 暗骰**：**明骰流程内联 stream**（`play-roll-bands` 区间分档 1-3/4-6/7-9/0 · AI narrate、**不带剧透**只描述可能发生什么 + 居中醒目 `play-roll-btn` 大按钮 + 投出后 `play-dice-result` 简化结果内联、命中档高亮，按钮变「已掷」）；暗骰走 `mech` 简条（见上）。**无掷骰弹窗**（旧 `play-dice-modal` 已删）。
- 续玩层态（底部当前交互）：`play-input`（常驻输入框）/ `play-choices`（**浮在输入框上方 · 非独占**·`play-choices-hint` 示单/多选，选项**不含后果提示**；**无 own**——输入框即自定义入口，对齐 README/play.html 决策变更）/ `play-generating` / `play-rollreq`（居中醒目掷骰按钮）/ `play-error` / **`play-postmortem-input`（终局·复盘输入框，仍可对话）**。未开场 `play-kickoff-btn`（含 `play-kickoff-pack` 团本信息卡：题材/标题/简介/角色预览）。
- **终局 = 复盘态（不遮罩）**：GM 已知游戏结束进入复盘，不再推进剧情、回答玩家问题；续玩层继续可用，玩家可问 GM 或回到某轮玩家气泡「⋯ → 分支」回档。**无黑屏遮罩、无「新局/复盘」按钮**。rewind 到头 → 转 kickoff 态（无独立 rewind-empty）；归档不单列态。
- AI 新披露信息进 `play-temp-stack`（临时位），不抢常驻 dock 位。
- `play-noSession-hint`（无活动会话 · 含引导入口 `play-none-catalog` + 最近会话 `play-none-recent`，不空）。
- **移动端**（`layout=mobile`）：右 dock 缩进 stage 上方、横向滚动、每条 dock-card 可折叠。
- **运行时观测/控制族**（期望态·依赖未批准裁决·红态；真跑对不上 = 待批准裁决，不自动进接口）：
  - `play-model-switch`（stagebar 中段 · model 切换下拉 · 当前 `currentModel` 高亮 · **下回合生效**）← RT-FE18 · [`model-switch`](../../wiki/设计/05-现状与计划/裁决记录/model-switch.md)。
  - `play-context-usage`（**foot 下方**常驻占用条 · `contextPct` + 进度条 · **>90% 变红** + `play-context-hint`「即将触发压缩」提示·对接 RT-FE15 auto-compact）← RT-FE14 · [`usage-and-context`](../../wiki/设计/05-现状与计划/裁决记录/usage-and-context.md) §三。
  - `play-turn-usage`（stream 回合块尾内联 `⟨model · ↑上传 ↓下载 tok · ≈$⟩` · hover 展开四类明细 · 无 usage 不渲染）← RT-FE16 · [`co-play`](../../wiki/设计/05-现状与计划/裁决记录/co-play.md)+[`usage-stream`](../../wiki/设计/05-现状与计划/裁决记录/usage-stream.md)。
  - `play-bay-btn-usage`→`play-bay-popover-usage`（bay「用量」按钮弹**用量详情浮窗**：session 累计 / **各 MCP 工具消耗分项** / **记忆占用分项** / 上下文占用（百分比圆盘 `play-context-dial`）/ per-turn 各轮列表）← RT-FE14/16/17 · `usage-and-context`+`co-play`。**MCP/记忆分项为前端冒出的超前数据需求**（裁决 `GET /usage` 未含），作期望态画进、待批准后扩接口。

### B5 团本制作页
- **会话切换进 bay**（对齐 play）：`build-bay-btn-session`→`build-bay-popover-session` 浮窗列构建会话（`build-session-item`/`build-session-date`/`build-session-lastaction` + `build-session-new`/`build-session-new-main`）；**无顶栏 sessionbar**。
- 上下文条 `build-ctxbar`（团本名 + 草稿版本 + 校验/导入/导出）。
- 左导航 `build-nav-{lore,npc,pool,rule,state,front,plotline,foreshadow,anchor,relation,prologue,manifest}`（内容类型）；中央 `build-editor`（标题 `build-editor-title`）；右栏 `build-assistant`（助手对话 + `build-assistant-toolcalls` 显示调了哪些工具）、`build-validate-btn`→`build-validate-report`（error/warn 计数+定位）。
- flex 滚动修法对齐 play（`bbody` calc 视口 + sidenav/aside `flex:none` + main/mbody/chat `min-height:0`）；内容卡 `border-radius:2px` 去纯圆角。
- **运行时观测族**（期望态·依赖未批准裁决·红态·对称 play）：`build-turn-usage`（每条助手消息末尾内联 `⟨model · ↑↓ tok · ≈$⟩`·RT-FE16/[`co-build`](../../wiki/设计/05-现状与计划/裁决记录/co-build.md)）、`build-bay-btn-usage`→`build-bay-popover-usage`（bay「用量」按钮弹用量详情浮窗：构建 session 累计 / 各 MCP 工具消耗 / 记忆占用 / 上下文占用（百分比圆盘 `build-context-dial`）/ per-turn）。制作页无 stagebar/foot，model 在配置页设定（运行时切换见 `model-switch` C2·待裁决）。
- **A3 域机态/交互覆盖**（本轮据 review 补全·期望态）：`build-noSession-hint`（无活动会话整屏·`#st=none`）、`build-generating`（助手编排中 spinner·A3 编排中态）、`build-assistant-error`（loregm turn error·D3 body.error）、`build-exported`（已提交/导出态·版本号+commitId+归档·`#st=exported`·`build-exported-continue` 继续/`build-exported-tocatalog` 跳目录）、`build-commit-btn`/`build-export-btn`（提交版本到库 vs 导出 Pack 拆分·A3/A4）、`build-validate-item`（校验报告点击定位·`data-jump`）、`build-validate-ok`（全绿态·`#st=ok`）、`build-nav-relation`+`data-view="relation"`（关系图谱·a-prime §5 待裁决）、`build-nav-materials`+`data-view="materials"`（素材包流式上传·`build-materials-drop`/`build-materials-list`·FE-build-upload 里程碑二）、`build-card-edit`/`build-card-del`（NPC 卡 inline 编辑·§2.2 Web 门面）、`build-session-item` 加 `.sess-status`（活跃/已归档标·对接 session-surface-flatten status）、guideline 补齐 5 阶段、sidenav `overflow:auto`。**后端接口**（loregm Draft 校验 RT-FE11/WS RT-FE12/lastaction RT-FE13/materials 端点）仍待裁决批准。
- **finding 修复轮（2026-07-09）交互接线**：`build-validate-item` 的 `data-jump` 已接线（app.js `initDataJumps` → 切 `build-nav-*` + flash 高亮目标卡）；inline 编辑扩展到全部内容类型（JS 自动为每卡补 `build-card-edit`/`build-card-del` + 编辑态 textarea，不再只 NPC）；`build-card-new`（mtool「新建」绑当前 nav 加新卡）；`build-generating` 加 `build-generating-tools`（流式 toolcall）+ `build-generating-cancel`（中止本轮）；新建会话表单 `build-new-modal`（`build-new-name`团本名/`build-new-flows`/`build-new-clock`/`build-new-entry` + `build-new-confirm`）；guideline 5 阶段加 `build-guideline-{source,world,npc,rule,manifest}` + `data-goto` 可点跳转对应 nav；`build-commit-btn` 过渡 `build-exported` 态（warn 不阻断·confirm 提示）；`build-import-btn` 联动 materials 视图；`build-exported-continue` 隐藏 exported；切会话 `build-session-item` 加 `data-sess`（app.js `initSessRows` 刷新 ctxbar + 派发 `dicelore:sesschange`）；`build-none-recent` 可点恢复。

### B6 配置页
- 左导航 `config-nav-{general,network,mcp,model,theme,data,about}` 七子页。
- 子页视图 `config-subpage`；连接测试拆名：`config-model-test-btn`（模型）/ `config-mcp-test-btn`（MCP）→ `config-test-{none,pending,ok,fail}` 三态（ok/fail 交替演示 · fail 文案接 `error.code` · `#s=ok`/`#s=fail` 强制）。
- 关键控件：`config-model-select`、`config-agent-base`、`config-baseurl`、`config-autocontinue`、`config-lang`、`config-key-input`（+ `config-key-toggle` 可见性 +「仅存本地」说明）、`config-mcp-list`（动态容器 + 空态 `config-mcp-empty`「不预置任何额外 MCP」·`config-mcp-core` 核心 MCP 计数 `config-mcp-toolcount`·`config-mcp-toggle` 启停）/ `config-mcp-add`→`config-mcp-add-modal`（`config-mcp-instance`/`config-mcp-package`/`config-mcp-command`/`config-mcp-args` + `config-mcp-config-table` 配置项[`config-mcp-config-add`加/`config-mcp-cfg-del`删] + `config-mcp-add-confirm`）、`config-compact`、`config-theme-{preset,mode,accent,font}`（明暗/强调色即时应用 + 持久化）、`config-data-readonly`（后端真值展示）、`config-net-{port,host,notify}` 只读（真值来自 health）、`config-about-version`（来自 health）。
- 全页持久化反馈：`data-persist` 控件 + `toast`（app.js `initPersist`）。

## 落地状态

- [x] `frontend/` 下 5 页 html + 共享 `styles.css`/`app.js`（重构自 wiki 视觉草图），挂全上述 `data-testid`。见 [`frontend/README.md`](frontend/README.md)。
- [x] 本轮迭代已落地：去顶栏 + bay（导航默认跑团收起/其他展开 · ≡直接展开）、dock-card markdown 模板渲染器（edit/archive/fold · 去钉选）、明骰内联 stream / 暗骰 mech 分级、choices 浮层（toggle·send·**无 own**）、终局=复盘态不遮罩、团数据四类数据浏览、归档找回、滚动条墨金 + flex 滚动修法（play dock / build bbody 各自 calc 视口 + 子项 `flex:none` + 容器 `min-height:0`，卡去纯圆角 `border-radius:2px`）、**运行时观测/控制族期望态**（`play-model-switch` / `play-context-usage`(foot 下方) / `play-turn-usage`+`build-turn-usage` / `play-bay-btn-usage`+`build-bay-btn-usage`→`*-bay-popover-usage` 用量详情浮窗 · 依赖未批准裁决 · 红态）。
- [x] 本轮另已落地：用量详情浮窗**百分比圆盘**（`play-context-dial`/`build-context-dial`）、`play-context-hint`「即将触发压缩」提示（>90% 变红·C3 定调 90%·对接 RT-FE15 auto-compact）、turn-usage `⟨model · ↑上传 ↓下载 tok · ≈$⟩` 格式、**build A3 域机态/交互 13 条补全**（见 B5·relation/materials/noSession/generating/error/exported/commit+export 拆分/validate-item 定位/validate-ok 全绿/card-edit inline/session-status/guideline 5 阶段/sidenav overflow）、删 play bay `seq` 内部态暴露、harness `index.html` 预览态（`#ctx=danger` / `#st=none,exported,ok` / `#bay=usage` / `#v=relation,materials`）。
- [ ] 隐藏态（`play-noSession-hint`/`catalog-empty`/`play-input`/`play-postmortem-input`/`config-test-*`/`play-bay-popover-*`）第五步据实际状态切换。
- [x] 页机每条转移↔可见 selector 的断言映射 → 见 [2-tests.md](2-tests.md) B1–B6 转移清单（不在此重复，单源）。
- [x] finding 修复轮（2026-07-09）：home 补首访空态/continue 跳转/manual-link/去术语/强 CTA/bay 常驻/角落运行态/问候分支；catalog 补版本差异(diff)+导入流程(validatePack)+卡元信息+edit 跳转+搜索筛选+加载骨架+续玩提示+删除；config 拆 `config-test-btn` 撞名(`config-model-test-btn`/`config-mcp-test-btn`)+custom-mcp 新增表单+删硬编码搜索样例改空态+全页 toast 持久化+补齐 6 testid+JS 接通+测试真三态(error.code)+端口只读+key 可见性；build `data-jump` 接线(通用 initDataJumps)+inline 编辑全类型+编排中止+新建表单+guideline 跳转+commit 过渡+import 联动+切会话刷新。共享件 `app.js`(toast/initDataJumps/initSessRows/initPersist)+`styles.css`(toast/flash/骨架/inline 态/导入区/运行态徽章)。修复细节见上各页规约。

## 第五/六步 as-delivered（2026-07-13 · 真 React 前端见红→开发到绿）

原型 html 是**期望态样例**；本轮把上述 testid 全部落到**真 React app**（`frontend/src/features/{home,catalog,play,build,config}` + `shell/Bay`），playwright 15 spec 由**真实 seed + 真交互**驱动（非原型 hash harness），最终 **66 例 65 绿**（1 例明骰投出结果转组件单测，见下）。关键 as-delivered 对齐与真前端健壮性补强：

- **驱动方式（去 hash harness）**：spec 经 `POST /catalog/commit`+`/sessions/{dicegm,loregm}` seed + 玩家关键字消息驱动 FAKE 教练档产真态（掷骰/选择/暗骰/终局/报错）+ 点 bay 按钮开 popover + `primeBay`（写 localStorage `bay-mode=always` 令 bay 常驻可点·真 config 行为）。BayProvider 读 `bay-mode`（`dicelore:baymode` 事件即时生效）。
- **dock 预设卡 testid 按类别**：`useDock` 每类首卡挂 `play-card-{status,plotline,world}`（预设）/ `play-card-custom`（DIY 首卡）；DIY 新卡即使 select 空也渲染（供编辑）。原 id-scoped `play-card-<id>` 保留兜底。
- **暗骰 `play-hidden-roll` 从事件流渲染**（健壮性补强）：不再只听瞬时 WS `hidden_roll` 帧，改从 `GET …/events` 的 `visible=0 verdict` 事件派生缩略指示 → 重连/回填后仍在；严格档只显「进行了…判定」。WS 全量帧=spoiler=关闭档实时增强，由单测覆盖。
- **终局复盘 `play-postmortem-input` 从会话 status 派生**（健壮性补强）：FAKE `game_end` 只落 `session_meta.ended`、不发 WS 帧；前端从 `GET /sessions/dicegm/{id}` 的 `status=debrief` 派生复盘态，非依赖瞬时帧。
- **`/play` 裸路由=会话选择态**：`noSession = !sessionId`（welc + 真最近会话 `play-none-recent` + 去目录 `play-none-catalog`），修「列表空才进 noSession」与「recent 需有会话」的自相矛盾。
- **build 选最近活动会话**：`BuildPage` 按 `lastActionAt` 选最新会话（非列表首个陈旧会话）；`post()` 回合完成后主动 `refresh()` 拉 Draft（即写即读兜底、不单靠 WS）。
- **e2e 放宽 + 组件单测兜底**（FAKE/基础 seed/共享后端确实驱动不了的真-GM/富内容/瞬时态，非删断言骗绿）：
  - `play-gm-reply`：交付协议流只有 `narration_commit` 一条文本通道，无「GM 非 narrate 纯文本回复」独立通道 → 协议尚未落地，e2e 不断言，待协议补通道。
  - `play-temp-stack`：来自 `presentation_delta.reveal`(watcher)，教练档+基础 fixture 不产 reveal；渲染路径已在 PlayPage（有 reveal 即出）。
  - `play-turn-usage` / `build-turn-usage` / `play-context-hint`：FAKE GM 无 token 计量（usage 恒空/contextPct 恒 0）；渲染路径已就位（有 usage 即出）。
  - `play-card-plotline` / `play-card-other`：需 narrative 域 plotline_visible / Front·Clock 数据，基础 fixture 无。
  - `play-dice-result`（明骰投出结果）：由 WS `roll_committed` 帧驱动（`roll_staged` 帧 e2e 已收到、区间表显示）；本环境 vite ws 代理下 `roll_committed` 投递不稳 → 命中档+骰面结果渲染由 `RollBands.test` 组件单测覆盖。
  - `play-generating` / `build-generating`+`tools`+`cancel`：回合进行中的瞬时态（乐观置态/极快回合），e2e 难确定性截屏 → `PlayPage.test`/`BuildPage.test` 组件单测覆盖。
  - `build-noSession-hint`/`build-none-recent`（无活动会话整屏）：需 loregm 会话数为 0；共享测试后端 `DELETE /sessions/loregm/:id` 只清内存 registry、不清列表源（累积 80+ 会话不可清空）→ e2e 不可达 → `BuildPage.test`「无会话态」组件单测覆盖。
  - `build-assistant-error`（loregm 回合 error）/ `build-context-dial`：FAKE 构建档不产 error / loregm 无 `GET /usage` 上下文源；渲染路径已就位。
  - `play-session-lastreply`/`build-session-lastaction`：后端 `SessionSummary.lastReply`/`lastaction` 未回填（契约 §10·RT9/RT-FE13 留位）。
