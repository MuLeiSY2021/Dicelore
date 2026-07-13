# frontend · 墨金原型（据 B 页状态机 · acceptance-loop 第一步·前端）

据 [`../0-state-machines.md`](../0-state-machines.md) 的 B 页状态机、[`../1-frontend-overview.md`](../1-frontend-overview.md) 的 selector 规约，重构自 wiki 视觉草图 [`玩家客户端-视觉草图/`](../../../wiki/设计/04-子系统设计/玩家客户端-视觉草图/README.md)。**纯静态原型、无后端接线**（第三步接）——目的 = 给 playwright 稳定的结构 + `data-testid` 锚。

## 文件

| 文件 | 页 | 对应状态机 |
|---|---|---|
| `styles.css` | 共享墨金 token + 全局 `app-bay`（仿 mac 聚焦出现）+ popover + 滚动条墨金 | — |
| `app.js` | lucide / 明暗 / 强调色板 / bay popover / `data-screen` 切换 / hash 深链 | — |
| `home.html` | 主页（指南 + 最近会话摘要） | B2 |
| `catalog.html` | 团本目录（选版本默认最新 · 导入 · 空态） | B3 |
| `play.html` | 跑团页（桌面沙盘：stage + 右 dock + 全局 bay） | B4 · dicegm A2 |
| `build.html` | 团本制作页（内容类型切换 + 助手 + 校验） | B5 · loregm A3 |
| `config.html` | 配置页（七子页 + 连接测试三态） | B6 |

## 关键设计（本轮迭代）

- **全局去顶栏 + bay**：所有页无 brand/nav；nav 收进底部 `app-bay`（仿 mac 聚焦出现，可配 focus/always/hidden）。bay 导航默认**跑团页收起 / 其他页展开**（横排页签图标+短名），≡ 直接展开、« 收起。
- **dock-card = markdown 模板渲染器**：`dc-meta`（数据选择器 `select…where` + 模板源码 `${}`）默认隐、编辑态显；`dc-body` 渲染后 markdown；三按钮 edit/archive/fold（**去钉选**）。dock 专属滚动条（卡 `flex:none` 不压缩、溢出滚）。
- **明骰 vs 暗骰**：明骰内联 stream（区间分档 narrate + 居中按钮 + 投出后简化结果，**无弹窗**）；暗骰 `mech` 只说进行了判定、不显结果/DC，防剧透分级。
- **choices**：浮在输入框上方（非独占），toggle 选中 / send 提交 / 无 own（输入框即自定义）。
- **终局 = 复盘态**（不遮罩）：续玩层继续，可问 GM / 分支回档。删 rewind-empty（转 kickoff）、archived。
- **bay 团数据拆四类数据浏览**：人物卡 / 剧情线 / 世界书 / 其他表单 各自浮窗浏览数据（`d-entry` 展开），非"卡模板+钉选"。对齐后端 `GET /presentation`（仅 sheets；剧情线/世界书待扩快照，见 findings RT-FE4）。
- **归档找回**：卡归档（非硬删）→ bay 归档浮窗可恢复。
- **叙事流**：narrate `prose`（serif 无框）≠ GM 正文回复 `.reply`（去边框/小字/淡色）≠ 暗骰 `mech`；玩家气泡 = 轮锚点，edit 有 inline 确认。
- **build 页对齐 play 滚动机制**：`bbody` 去 fixed `410px`、改 `flex:1;min-height:0` + shell `height:100vh`；sidenav/aside `flex:none` 不被压缩；main/mbody/chat `min-height:0` 让溢出滚动而非压扁子项（同 play dock 修法，见 memory `anko-driver-flex-scroll-fix`）；内容卡 `border-radius:2px` 去纯圆角。
- **build 会话切换进 bay**（对齐 play）：删顶栏 `sessionbar`，改 bay `build-bay-btn-session`→`build-bay-popover-session` 浮窗列构建会话（`build-session-item`/`-date`/`-lastaction` + `build-session-new`）；顶部只留 `build-ctxbar` 上下文条。
- **运行时观测/控制族**（期望态·依赖未批准裁决·红态）：stagebar 中段 `play-model-switch`（model 切换·下回合生效·RT-FE18）、foot 下方常驻 `play-context-usage`（上下文占用%·>80% 变红·RT-FE14）、stream 回合块尾 `play-turn-usage` / `build-turn-usage`（per-turn：model+↑上传+↓下载+估价·RT-FE16/co-build）、bay `play-bay-btn-usage`/`build-bay-btn-usage`→`*-bay-popover-usage`（用量详情浮窗：session 累计 / 各 MCP 消耗 / 记忆占用 / 上下文 / per-turn·RT-FE14/16/17）。静态占位，交互/真数据待第五步。

## 看

浏览器直接开各 `*.html`（静态、无需服务）；或用 harness `index.html` 按状态/浮窗逐态预览。主题/色板可点。

## 待办（第四/五步）

- [ ] playwright 据这些 `data-testid` 写页机转移 spec（`../2-tests.md`）。
- [ ] 第五步：接后端真数据（替换静态占位），使 playwright 绿。
- [ ] 隐藏态（`play-noSession-hint` / `catalog-empty` / `play-input` / `play-postmortem-input` / `config-test-*` / `play-bay-popover-*`）第五步据实际状态切换。
