# 裁决：前端信息架构大重构（D 组·play 桌面沙盘 + bay 导航 + build 域机态）

- [X]  用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> **来源**：[`docs/tdd/acceptance-loop-2026-07-06/findings.md`](../../../../../tdd/acceptance-loop-2026-07-06/findings.md) RT-FE1 / RT-FE3 / RT-FE20。
> **期望态权威来源**：[`docs/tdd/acceptance-loop-2026-07-06/frontend/play.html`](../../../../../tdd/acceptance-loop-2026-07-06/frontend/play.html) + [`build.html`](../../../../../tdd/acceptance-loop-2026-07-06/frontend/build.html) + `styles.css` + `app.js`。**本裁决不重复原型已落的实现细节**（class 名 / DOM 结构 / 交互），只拍 IA 决策、组件清单、与后端契约的对接点、与已存裁决的交叉。实现以原型 html 为权威期望态、照搬移植。
> **现状**：仓库 React（`frontend/src/`）是另一套 IA——`Shell`+`TopBar` 顶栏常驻 nav + `PlayPage` 四栏工作区（rail/browse/center/stage）+ `BuildPage` 三栏缺项。grep `bay`/`dock`/`stagebar`/`app-bay` **零命中**。原型 IA 未落地。
> **性质**：承重前端重构（findings 标「设计漂移」）。属 `roadmap-delivery-workflow` 的 refactor-frontend 变体。

---

## §零 总定调


| 项              | 定调                                                                                                     | 理由                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| C1 IA 方向      | **采用原型 IA**（无顶栏 + 底部 `app-bay` 导航 + 桌面沙盘），**废弃** React 现状顶栏 + 工作区/工具面板 IA | 原型已完整设计且经 acceptance-loop 评审；React 现状是旧 IA 漂移  |
| C2 Shell 改造   | 去`TopBar`；`Shell` 只留 `<Outlet/>` + 全局 `<Bay/>` 组件                                                | 全局导航收进底部 bay（仿 mac 聚焦）；主题/语言收进 config 页     |
| C3 实现细节权威 | 原型 html 文件                                                                                           | 裁决只定 IA 决策 + 对接点；class 名 / DOM / 交互照搬原型，不重复 |
| C4 共用组件抽取 | `Bay` / `Popover` / `DockCard` / `DataEntry` 等抽共用                                                    | play/build 共用底部 bay + popover 机制                           |

---

## §一 RT-FE1：play 桌面沙盘 IA（A2）

### IA 骨架（拍死·照搬原型）

```
Shell（无顶栏）
└─ PlayPage
   ├─ stagebar          团本名 + 幕标 + model-switch（RT-FE18）+ sp
   ├─ sandbox
   │  ├─ stage > stream  叙事流（五态 data-screen 驱动整屏/续玩层）
   │  └─ dock.right      右钉栏 dock-card 模板渲染器
   ├─ split + foot       底部当前交互（五态互斥：choices/input/generating/roll/error/end）
   ├─ ctx-bar            上下文占用条（RT-FE14）
   └─ Bay（全局 fixed）   底部导航 + bay 按钮（session/chara/plotline/world/forms/config/archive/usage）
```

### 五态 `data-screen` 驱动（拍死）


| screen                                                | 整屏 / 续玩层        | 内容                                           |
| ----------------------------------------------------- | -------------------- | ---------------------------------------------- |
| `none`                                                | 整屏`.welc`          | 引导（去目录/制作 + 最近会话）+ noSession-hint |
| `kickoff`                                             | 整屏`.kc`            | 团本信息卡 + 大金按钮开场                      |
| `input` / `generating` / `roll` / `choices` / `error` | 续玩层沙盘           | stream + foot 五态互斥                         |
| `end`                                                 | 续玩层（**不遮罩**） | 终局复盘态：stream 尾 endmark + 复盘输入框     |

### stream 元素清单（拍死·照搬原型 class）

`divider` / `prose`（GM 叙述）/ `pmsg`（玩家气泡 + edit/delete/more）/ `rwconfirm`+`rwnote`（rewind 确认/提示）/ `reply`（GM 对玩家说话）/ `toolcall`（透视 GM 动作，`.stream.show-actions` 才显）/ `tempstack`（临时披露栈）/ `turn-usage`（回合尾内联 usage·RT-FE16）/ `mech`（机械回显含暗骰·RT-FE6）/ `bandtable`+`rollresult`（明骰内联·RT-FE5）/ `endmark`（终局·RT-FE7）。

### 关键呈现决策（拍死）


| 项                                     | 定调                                                                                                                       | 对接                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 明骰内联 stream                        | 掷骰前`.bandtable` 各档 label+区间（narration 隐藏防剧透）；掷骰后 `.rollresult` + 命中档 `.hit` 高亮、居中按钮变「已掷」  | RT-FE5（narration 数据源）                               |
| 暗骰 mech                              | `.mech` 单行简条「进行了判定」、不显结果/DC、右侧「防剧透·严格」标                                                        | RT-FE6（hidden_roll WS）+ RT-FE9（visible 硬底线）       |
| choices 浮输入框上方                   | `.choices-pop` 浮层叠在输入框上方、toggle 选中·send 提交·无单独确认                                                      | —                                                       |
| 终局复盘态不遮罩                       | `end` 态内联 stream 尾、续玩层继续、foot 切复盘输入框、可问 GM / 分支回档                                                  | RT-FE7（debrief-and-branch §一）+ RT-FE8（branch §二） |
| dock-card                              | markdown 模板渲染器（`dc-meta` 默认隐/编辑显 + `dc-body` 渲染 + 三按钮 edit/archive/fold + 去钉选/去圆角/dock 专属滚动条） | [`dock-card-template`](dock-card-template.md)（已批准）  |
| bay 四类数据                           | chara（sheet）/ plotline（narrative）/ world（lore/pool/rule）/ forms（Front/Clock/Anchor·DIY 入口），`data-entry` 展开   | RT-FE4（a-prime §7 presentation 接视图层）              |
| 归档找回                               | `bay-popover-archive`：归档卡 + restore；dock-card archive → 移入此                                                       | RT-FE10（dock-card-template §四 localStorage）          |
| ctx-bar / model-switch / usage popover | 上下文占用条 + stagebar model 切换 + bay-local usage 弹窗                                                                  | RT-FE14/17/18（usage-and-context / model-switch）        |
| 防剧透档位开关                         | bay-popover-config 含严格/宽松/关闭                                                                                        | RT-FE9（spoiler-tiering §一）                           |
| 透视 GM 动作                           | `play-observe-toggle` 切 `.stream.show-actions` 显 toolcall                                                                | —                                                       |

### 决策与权衡


| 项                       | 定调                                                                                 | 理由                                       |
| ------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| C5 去 stage 固定分类面板 | 废弃 React`.stage` 的 attr/clock/inv/reveal/pin 固定面板，改 dock-card markdown 模板 | dock-card-template 已定调；固定面板是旧 IA |
| C6 去 rail/browse 左栏   | 废弃 React`.rail`+`.browse`，数据浏览进 bay popover                                  | 原型无左栏；bay 四类数据 popover 替代      |
| C7 去次级 playbar        | 废弃 React`.playbar`（session select + rewind + 删），进 bay-session popover         | 原型无次级栏；session 切换进 bay           |
| C8 stream 单栏           | 叙事流单栏中央、不拆 narr/mech 分栏                                                  | 原型 stream 单栏、mech 内联                |

---

## §二 RT-FE3：bay 导航 IA（B1）

### 设计（拍死·照搬原型）

- **全局底部 `app-bay`**（fixed、仿 mac 聚焦出现）：`bay-tabs`（横排 `nav-tab-home/catalog/play/build/config` 图标+短名）+ `bay-nav-collapse`（«收起）+ `bay-nav-open`（≡直接展开）+ `bay-nav-expand`。
- **跑团页默认收起导航**（`body.bay-nav-collapsed`）、其他页展开。
- `bay-nav` popover 含 `nav-row-*` + `nav-status`（模型/MCP/notify 运行态）。
- **去顶栏**（见 §零 C2）；主题/语言收进 config 页。
- **滚动条墨金配色**：stream / dock 各自专属滚动条（墨金色调）。

### 决策与权衡


| 项               | 定调                           | 理由                                         |
| ---------------- | ------------------------------ | -------------------------------------------- |
| C9 导航位置      | 底部 app-bay（非顶栏）         | 原型定调；仿 mac 聚焦、跑团页沉浸            |
| C10 跑团页默认态 | 导航收起                       | 沉浸；其他页展开便于切换                     |
| C11 主题/语言    | 收进 config 页                 | 原型去顶栏；运行态 status 进 bay-nav popover |
| C12 滚动条       | 墨金配色、stream/dock 各自专属 | 原型定调（RT-FE3）                           |

---

## §三 RT-FE20：build 域机态 / 交互缺口（B5）

### IA 骨架（拍死·照搬原型）

```
BuildPage
├─ ctx（build-ctxbar）   团本名 + badge + 四按钮（validate/import/commit/export）
├─ bbody 三栏
│  ├─ sidenav           五域(lore/npc/pool/rule/state) + 叙事脚手架(front/plotline/foreshadow/anchor/relation) + 收口(prologue/manifest) + 素材(materials) + 进度(guideline-*)
│  ├─ main              内容卡（inline 编辑 + new/del）+ data-view 切换
│  └─ aside             构建助手 chat（toolcall + turn-usage + generating + error）+ cin + validate-report
└─ Bay（全局）
```

### 13 条缺口补齐（拍死·照搬原型）


| #  | 缺口                       | 原型补法                                                                                           | 对接                                                               |
| -- | -------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1  | relation nav               | sidenav「叙事脚手架」加`build-nav-relation` + `data-view="relation"` 关系图谱                      | [`a-prime-completion`](a-prime-completion.md) §5                  |
| 2  | 三态（活动/编排中/已导出） | `build-noSession-hint` / `build-generating`（流式 toolcall+cancel）/ `build-exported`（继续/去库） | RT-FE12（loregm WS toolcall/draft_delta）                          |
| 3  | loregm error UI            | `build-assistant-error`（body.error 通道、点校验报告可定位）                                       | RT-FE12 error 事件                                                 |
| 4  | 素材上传 UI                | `build-nav-materials` + `data-view="materials"`（拖拽区 + 列表 + 进度条）                          | `POST …/materials`（已实现）                                      |
| 5  | session status             | bay session popover`.sess-status`（active/archived）+ `lastaction`                                 | RT-FE13（SessionSummary.lastaction）+ session-surface-flatten §五 |
| 6  | 校验报告定位               | `build-validate-item[data-jump]` 点跳转对应 nav                                                    | RT-FE11（draft/validate 端点）                                     |
| 7  | 提交 vs 导出拆分           | `build-commit-btn`（提交版本到库·A3 归档）vs `build-export-btn`（导出 Pack 文件·A4）             | —                                                                 |
| 8  | guideline 阶段跳转         | `build-guideline-source/world/npc/rule/manifest` `.stg`（done/now/空）+ `data-goto`                | —                                                                 |
| 9  | sidenav overflow           | `flex:none;min-height:0;overflow:auto`                                                             | memory`[flex 滚动条修法]`                                          |
| 10 | 全绿态                     | `build-validate-ok`（零 err 零 warn·可提交）                                                      | RT-FE11                                                            |
| 11 | inline 编辑                | 每张内容卡`build-card-edit`/`build-card-del`/`build-card-new`（mtool 新建）                        | —                                                                 |
| 12 | 新建构建会话               | `build-new-modal`（name/flows/clock/entry + confirm）                                              | session-surface-flatten §三（POST /sessions/loregm）              |
| 13 | turn usage                 | `build-turn-usage` + `build-bay-popover-usage`                                                     | RT-FE16（co-build）+ RT-FE19（mcp/memory 分项·loregm v1 不做）    |

### 决策与权衡


| 项                | 定调                                               | 理由                                          |
| ----------------- | -------------------------------------------------- | --------------------------------------------- |
| C13 sidenav 七组  | 五域 + 叙事脚手架 + 收口 + 素材 + 进度             | 原型定调；覆盖 A′ 叙事层全域                 |
| C14 校验报告      | on-demand（RT-FE11 端点）+ 可跳转定位；WS 推送 v2  | RT-FE11 同步端点已覆盖                        |
| C15 提交/导出语义 | commit=提交版本到库（归档）、export=导出 Pack 文件 | 原型拆分；现状 React「导出」实为 commit、混淆 |
| C16 inline 编辑   | 内容卡 inline 编辑（非跳模态）                     | 原型定调；§2.2 Web 门面用户直改              |

---

## §四 与已存 / 本批裁决的交叉对接（前端依赖清单）

D 组前端重构**依赖大量后端 / 呈现层裁决先落**，进波顺序靠后：


| 前端组件                          | 依赖裁决                                                                                       | 状态                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------- |
| dock-card                         | [`dock-card-template`](dock-card-template.md)                                                  | ✅ 已批准                                 |
| 终局复盘态 / branch               | [`debrief-and-branch`](debrief-and-branch.md)                                                  | ✅ 已批准                                 |
| 会话面（建/列/meta/拉平）         | [`session-surface-flatten`](session-surface-flatten.md)                                        | ✅ 已批准                                 |
| model 切换                        | [`model-switch`](model-switch.md)                                                              | ✅ 已批准                                 |
| relation 工具                     | [`a-prime-completion`](a-prime-completion.md) §5                                              | ✅ 已批准                                 |
| plotline/world 投影               | [`a-prime-completion`](a-prime-completion.md) §7（RT-FE4）                                    | ✅ 已批准                                 |
| usage / context                   | [`usage-and-context`](usage-and-context.md)                                                    | ⚠️ 未批准（依赖 gm-session-continuity） |
| co-play / co-build / usage-stream | 对应裁决                                                                                       | ⚠️ 待查批准态                           |
| 防剧透三档                        | [`spoiler-tiering-and-dock-diy`](spoiler-tiering-and-dock-diy.md)（A 组·本批）                | ⚠️ 本批待批准                           |
| 明骰 narration                    | [`rollband-narration-and-loregm-api`](rollband-narration-and-loregm-api.md) §一（B 组·本批） | ⚠️ 本批待批准                           |
| loregm Draft 校验                 | [`rollband-narration-and-loregm-api`](rollband-narration-and-loregm-api.md) §二（B 组·本批） | ⚠️ 本批待批准                           |
| 暗骰 / loregm WS                  | [`hidden-roll-and-loregm-ws`](hidden-roll-and-loregm-ws.md)（C 组·本批）                      | ⚠️ 本批待批准                           |

---

## §五 交付节点（炸成原子需求·refactor-frontend 变体）

D 组是承重大重构，按页 + 组件切节点，各自 worktree 隔离：

- **D-1** Shell 改造：去 `TopBar`、加全局 `<Bay/>` 组件（底部 app-bay + nav-tabs + collapse/expand）。
- **D-2** PlayPage 桌面沙盘骨架：stagebar / sandbox（stage+dock）/ foot 五态 `data-screen` 驱动 / ctx-bar。
- **D-3** PlayPage stream 元素：prose/pmsg/reply/toolcall/tempstack/turn-usage + rewind 确认/提示。
- **D-4** PlayPage 明骰内联（bandtable+rollresult+hit）+ 暗骰 mech + choices 浮层 + 终局复盘态。
- **D-5** PlayPage dock-card（引 dock-card-template 裁决实现）。
- **D-6** PlayPage bay 四类数据 popover + 归档找回 + 防剧透档位开关 + 透视 toggle。
- **D-7** PlayPage model-switch / usage popover / ctx-bar（引对应裁决）。
- **D-8** BuildPage 三栏骨架 + sidenav 七组 + data-view 切换。
- **D-9** BuildPage 13 缺口补齐（三态/error UI/素材上传/session status/校验定位/提交导出拆分/guideline跳转/全绿/inline编辑/relation nav/新建会话/turn usage）。
- **D-10** 滚动条墨金配色（stream/dock 各自）。

### 依赖与进波顺序

- D-1（Shell/Bay）可先行（无后端依赖）。
- D-2/D-3（骨架+stream）依赖本批 A/B/C 裁决批准（明骰/暗骰/防剧透/turn-usage 数据源）。
- D-5（dock-card）依赖 dock-card-template（已批准）+ a-prime §7（plotline/world 投影）。
- D-6（bay 数据）依赖 a-prime §7 + session-surface-flatten。
- D-7 依赖 usage-and-context（未批准）+ model-switch（已批准）。
- D-8/D-9（build）依赖 session-surface-flatten + RT-FE11（B 组）+ RT-FE12（C 组）+ a-prime §5（relation）。
- → D 组整体进波靠后，待本批 A/B/C + usage-and-context 批准后分波推进。
- **承重提示**：D 组是前端大重构、跨多页多组件、与十几份裁决交叉 —— 进波前必须用户勾批准；建议按页（play 先、build 后）分波、不一次性铺开。
