# 第四步 · 测试（大型 curl 脚本 + playwright）

> 属 `acceptance-loop` 第四步。据 [1-backend-interface.md](1-backend-interface.md)（curl）与 [1-frontend-overview.md](1-frontend-overview.md) + [`frontend/`](frontend/)（playwright）。**首跑都应见红**（铁律 2）；断言引 wiki 形状、不看代码输出（铁律 1）；假 GM 确定性、全程落盘、可复现（铁律 5）。
> **状态：curl track 已跑见红**（[`tests/curl-run-transcript.txt`](tests/curl-run-transcript.txt) · PASS=29 FAIL=13 BLOCKED=4）。13 红 = 11 已知 finding（RT1×2/RT6/RT7/RT-FE18×2/RT-FE8×2/RT-FE11/RT8×2·全待批准裁决）+ 2 新真 finding（RT-open-head-ref / RT-open-500·后端 robustness）+ 4 BLOCKED（RT-fake-gm-wiring·fake-GM 教练档未接 HTTP）。playwright track 待写。

## curl 脚本（bash · 遍历实体状态机每条转移）

起后端：`eval-backend-setup`（`DICELORE_FAKE_GM=1`，隔离数据根）。假 GM 走教练档（`FakeDiceGm` CanonScript）确定性驱动；loregm 侧确定性驱动若缺 = 本 skill 新造件（见 findings）。

**格式**（每条转移一段）：
```bash
# <转移ID> <人话>（据 1-backend-interface §<n>）
resp=$(curl -s -w '\n%{http_code}' <method> <url> <body>)
assert_status <期望码>            # 引 wiki
assert_shape '<期望 body 形状>'   # 引 wiki，不看代码现输出
# 红点: <该转移已知存疑处>
```

**A 实体机转移覆盖清单**（勾 = 已写脚本）：

- 会话生命周期（A1 · 两 kind）
  - [ ] 无→活跃 `POST /sessions/{kind}` → `201`（**首红：RT1 现无此端点**）
  - [ ] 列表 `GET /sessions/{kind}` → `{sessions[]}`（loregm **首红：RT6**）
  - [ ] 元信息 `GET /sessions/{kind}/{id}`（loregm **首红：RT7**；dicegm 验"桩"真伪）
  - [ ] 删除 `DELETE /sessions/{kind}/{id}`
  - [ ] 开场 `POST …/start`（幂等）
  - [ ] drive-turn `POST …/messages` → `202 {turnId, error?}`（loregm error-in-body）
  - [ ] rewind 到非起点 `POST …/rewind`（**RT3 无契约**）
  - [ ] rewind 到开头 ⇒ 状态转「空」（断言 `GET …/{id}` status=空）
- dicegm 域（A2）
  - [ ] choices `POST …/choices` → `202`（**RT2 语义必真跑定论**）
  - [ ] roll `POST …/roll` → `202`；无待掷 → `409`
  - [ ] presentation / events?since / browse
  - [ ] WS：连后先 snapshot，再逐条验 10 类消息（game_end **必验 RT-B3**）
- loregm 域（A3）
  - [ ] materials 上传（可选路径）→ 落盘；超限 `413`
  - [ ] draft 检视
- catalog（A4）
  - [ ] catalog / commit / files?ref=head / validate / tag
  - [ ] import（选版本·默认最新 → validatePack）
- 配置/诊断（§6）
  - [ ] health 真值形状 / model-test / mcp-test / keys / 限流 429

> 断言用可复用脚本判（`assert_status`/`assert_shape` helper），别肉眼看——快、稳、可跨轮重跑。

## playwright（据 1-frontend-overview 的 data-testid · 驱动页状态机每条转移）

**页机转移覆盖清单**：
- [ ] B1 导航/壳：所有页去顶栏、无 brand；底部 `app-bay`（默认聚焦出现，鼠标到底唤出 / `#baybar=show` 强制常驻）；bay 导航**默认跑团页收起、其他页展开**：展开态 `app-bay-nav-tabs` 横排 `nav-tab-{home,catalog,play,build,config}`（当前页 on）+ `app-bay-nav-collapse`(«) 收起；收起态 `app-bay-nav`(≡) 点开 `app-bay-popover-nav` 浮窗列 `nav-row-{home,catalog,play,build,config}`（当前页 on；`nav-row-play` 无活动会话置灰）+ `app-bay-nav-expand` 展开按钮 + 底 `shell-runstatus`；`config-bay-mode` 切聚焦出现/常驻/隐藏写 localStorage
- [ ] B2 主页：指南 + `home-manual-link` 存在；仅显示最近一个会话摘要（非全量）
- [ ] B3 目录：列表/空态；`catalog-start-btn`→选版本→跳跑团；`catalog-import-btn`
- [ ] B4 跑团：`play-noSession-hint`（含 `play-none-catalog`/`play-none-recent`）；`play-kickoff-pack` 团本信息卡 + `play-kickoff-btn`→续玩层；右侧 `play-dock-right` 单 dock + `play-dock-fold` 折叠；`app-bay` play 专属多入口（session/chara/plotline/world/forms/config/archive）+ `app-bay-nav` 在屏幕中央弹浮窗并点外关闭；团数据四类 = 数据浏览 `play-bay-popover-{chara,plotline,world,forms}`（`play-data-entry` 展开 · 非卡模板+钉选 · 对齐后端 sheets entity→cell）；`play-bay-popover-archive` 归档找回；`play-bay-popover-config` 含防剧透 + `play-observe-toggle` 透视 GM 动作；叙事流：玩家气泡 `play-player-msg`（右倾 · `edit`/`delete`/`more`[复制·分支]）= 轮锚点，narrate `prose`（serif 无框小说正文）≠ GM 正文回复 `play-gm-reply`（`.reply` **去边框/小字/淡色** · 署名「GM」淡化 · AI 多句不烦）≠ 暗骰 `mech`（带「暗骰」标 `play-hidden-roll` · **只说进行了判定、不显结果/DC** · 细节由防剧透分级），`divider` 带文案分节；**明骰内联 stream**（`play-roll-bands` 区间分档 1-3/4-6/7-9/0 不带剧透 + 居中 `play-roll-btn` + 投出后 `play-dice-result` 简化结果、命中档高亮 · **无弹窗**）；`play-choices` **浮在输入框上方**（非独占），`play-choices-hint` 示单/多选，点选项 toggle 选中、再点取消、点 send 提交（**无 own · 输入框即自定义**）；`edit` → `play-rewind-confirm`（inline 确认）→ 确认后才出 `play-rewind-note`（**不可省确认**）；`play-card-{status,plotline,world,other,custom}` = dock-card markdown 模板渲染器（`dc-meta` 数据选择器默认隐·编辑态显源码 + `dc-body` 渲染 markdown · 三按钮 `play-card-{edit,archive,fold}` · 去钉选）；`play-temp-stack` 承接新披露；终局 `play-postmortem-input` **复盘态（不遮罩 · 续玩层继续 · 可问 GM/分支回档）**；rewind 到头转 kickoff（无 rewind-empty）、归档不单列态；移动端 `layout=mobile` 右 dock 缩进输入上方横滚
- [ ] B5 制作：**无顶栏 sessionbar**（会话切换进 bay）；`build-ctxbar` 上下文条（团本名+草稿版本+校验/导入/导出）；左 `build-nav-{lore,npc,pool,rule,state,front,plotline,foreshadow,anchor,prologue,manifest}` 内容类型切换；`build-assistant` 助手对话 + `build-assistant-toolcalls` 显示调了哪些工具；`build-validate-btn`→`build-validate-report`（error/warn 计数+定位）；bay `build-bay-btn-session`→`build-bay-popover-session` 构建会话切换（`build-session-item`/`-date`/`-lastaction` + `build-session-new`）；flex 滚动（bbody calc 视口 + 子项 flex:none + min-height:0）
- [ ] B6 配置：七子页切换；连接测试三态

> playwright 待 `1-frontend-overview.md` 的 html+css 落地后才能跑（前端 track 依赖）。后端 track（curl）可先独立跑起来见红。
