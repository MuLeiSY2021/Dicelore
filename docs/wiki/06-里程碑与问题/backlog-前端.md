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

## 主题 · 玩家主线健壮性（体检新增）💡🔧

> **2026-06-25 全量体检实证**（[findings](../../../audits/2026-06-25-全量体检/findings.yaml)）：前端玩家主线被体检多条命中，属"缝 B 两侧都在假设对方接了、实际都没接"+ 错误吞没 + 状态残留系统性 gap（见 [体检汇总 §共性病根 3](../../../audits/2026-06-25-全量体检/06-汇总-合并.md)）。**随规模恶化**（玩家主线中后段回归无保障），挂第三批横切基建同期或第二批 dogfooding 顺手带。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| FE-CLI-doc | docs | **README "CLI 一键开玩"断节**（USER-001，P0）：README.md L60 承诺"CLI 一键脚手架即开玩"，但 `packages/core/src/cli.ts` switch(cmd) 只有 new/list/inspect/init 四命令，无 play/roll/choose；真玩必须起 orchestrator 后端 + web dev server + 浏览器，这条路径 README 没写给玩家。新玩家按 README 装完 CLI 直接卡死——"随时在线、低安装、本机直接玩到"卖点在当前实现下不成立 | 2026-06-25 全量体检 | ✗ | ✅ 已裁决（[ADR-0027](../05-决策记录-ADR/README.md) 草案）：**不补 CLI play**，CLI 退回**开发/会话管理**用途；走**多端发版架构**——server 纯后端可独立部署（docker-compose 给例子，发版只给 docker-compose 文件 url，部署见 wiki/README）+ **客户端前后端整合包**（安卓/Mac/Win/Linux，填 API key+base URL 即玩，配置文件可选本地后端、可启停本地后端）；**安卓+Win 优先**（严重建议）。🔧 ① README 明确标注"v1 通过整合包/自托管后端玩，CLI 仅会话管理/开发"并给整合包下载与自托管部署步骤；② 整合包打包含客户端 + 本地后端 sidecar（启停可控） |
| FE-end-lock | feat | **终局后玩家锁死无重开入口**（USER-002，P1）：`PlayPage.tsx` L365 玩家输入框 `disabled={!!gameEnd}`；L308 终局只渲染 end div，无任何"重开"按钮；grep i18n 无 restart/重来/再玩/新一局/重新开始 任何键。玩家死一次就卡死，违场景 A 卖点"随时能玩" | 2026-06-25 全量体检 | ✗ | ✅ 已裁决（[ADR-0026](../05-决策记录-ADR/README.md) 草案）：v1 终局后流程**去掉"回滚"按钮**（[SNAP-1](backlog-core.md) 快照 v1 降预期不做手动回滚）；只留**三按钮**——①结束游戏 ②重开新局（同团本开新 session）③要 AI 行动建议。**回溯续命（回退到死亡前叙事继续）留 v2**，依赖 [ADR-0017](../05-决策记录-ADR/README.md) 快照接线。🔧 PlayPage 终局态加三按钮；与 [backlog-core E2 ADR](backlog-core.md) 配套 |
| FE-err-swallow | fix | **错误吞没与错误通道不一致**（CROSS-ERR，P1） | 2026-06-25 全量体检 | ✓ | 🟡 **核心已做（2026-06-25，配套 RT-2）**：`client.ts` 加 `actionError` 把 409（`turn_in_progress`/`no_pending_roll`/`no_pending_choice`）译成可读中文；`useSession` 的 `postMessage`/`roll`/`choose` 失败 `setError(e.message)` 进 error 通道（`roll` 之前完全无 catch、静默吞），HTTP 错误现与 WS error 统一走 `.err` 渲染。+2 useSession 错误用例。**剩余增量（未做）**：① postMessage 失败时不清空 draft（现 `PlayPage` L122 `setDraft("")` 仍无条件，玩家重发需重输）；② roll 409 的"重试/刷新"按钮（现仅文案提示）。随后续顺手带。 |
| FE-ws-race | fix | **WS 重连竞态切会话状态残留**（FE-001，P2） | 2026-06-25 全量体检 | ✓ | ✅ **已做（2026-06-25）**：`useSession` 在 `sessionId` 变更时重置全部 state（snapshot/narration/pendingRoll/generating/error/gameEnd/reveals）+ `refetch` 加 `sidRef` 守卫（`if (sidRef.current === sessionId) setSnapshot(s)`，迟到旧会话 refetch 不覆盖新会话快照）。采方案①②（局限 useSession 内部，不动 PlayPage 父组件），未用方案③ key remount。+2 切会话竞态测试，web 48 测试绿。**FE-drag-residue（PlayPage hidden/mini/order 内存态切会话残留）未一并修**——独立留后续。 |
| FE-start-contract | fix | **缝B start 契约不一致**（FE-003，P1）：前端 `client.ts` L74-81 startGame 按 `{turnId: string}` 解析；后端 `dice.ts` L75-79 返回 `{sessionId, started}`——字段名语义都不同；当前不崩只因 PlayPage 不消费返回值，但 client.ts 类型契约是谎言（as 断言绕过 TS） | 2026-06-25 全量体检 | ✗ | 🔧 ① 后端 dice.ts 改为返回 `{turnId}` 与 messages/roll/choices 对齐（推荐——保持 turnId 语义一致）；② 或前端 client.ts 改为 `{sessionId, started}` 并更新调用方；③ 缝 B 契约建单源 schema（`shared/rest.ts`）前后端共用，避免 as 断言绕过 TS 检查 |
| FE-testModel-ok | fix | **testModel/testMcp 未校验 res.ok**（FE-004，P2）：`client.ts` L157-162 testModel 无 `if (!res.ok) throw` 检查；L163-168 testMcp 同样漏了；对比同文件其他函数（getPresentation L15、postMessage L31）都有 res.ok 守门——唯独 testModel/testMcp 漏了。后端返回 4xx（如 baseUrl 非法、SSRF 防护拒绝）时前端把错误响应体当成功结果解析，显示"连接失败 · undefined"或错误信息丢失 | 2026-06-25 全量体检 | ✗ | 🔧 client.ts L159/L164 加 `if (!res.ok) throw new Error("model-test 请求失败：${res.status}")` 与其他函数对齐。非阻塞但应修——错误处理一致性 |
| FE-md-xss | fix | **Markdown XSS 当前安全须防回归**（FE-006，P2）：`Markdown.tsx` L15-31 inline() 手写正则不转义 HTML；但实测 React JSX 子节点默认转义机制保护了所有渲染路径——`<strong>{m[1]}</strong>` 中 m[1] 是字符串 React 转义；grep 全仓无 dangerouslySetInnerHTML/innerHTML/eval——XSS 面实际不存在。**初判可疑、实测安全**——记录以免后续误改 Markdown.tsx 引入 dangerouslySetInnerHTML | 2026-06-25 全量体检 | ✗ | 🔧 ① 保持现状加注释明确"禁止引入 dangerouslySetInnerHTML，扩展链接/图片时须校验 href/src 协议（禁 javascript:）"；② 单测补"输入 `<script>alert(1)</script>` 验渲染为文本不执行"防回归 |
| FE-dead-code | fix | **死代码 RollCard/PresentationStage**（FE-009，P3）：`RollCard.tsx`/`PresentationStage.tsx` 全组件定义了独立掷骰卡/呈现台渲染，但 PlayPage 实际用内联的 .ranges/.mech div 与 .stage/.grid + Panel 组件；grep RollCard/PresentationStage 在 src/ 内除自身定义与测试外无其他引用——死代码；RollCard 的 d100 vs PlayPage 的 d10 不一致（死代码里的 bug 会误导维护者） | 2026-06-25 全量体检 | ✗ | 🔧 ① 删 RollCard.tsx + RollCard.test.tsx + PresentationStage.tsx + PresentationStage.css + PresentationStage.test.tsx；② 或若 PresentationStage 的只读快照渲染另有用途（如未来打印/导出场景），显式标注"仅用于 X 场景"并抽出共用逻辑。非阻塞 clean up 时一并处理 |
| FE-drag-residue | fix | **PlayPage 拖拽 localStorage 切会话残留**（FE-011，P3）：`PlayPage.tsx` L84 `orderKey = dicelore.stage.order.${sid}`；hidden/mini 状态是内存态、切会话不重置——与 FE-ws-race 竞态同源；removeSession 时不清该 sid 的 localStorage order key（小内存泄漏） | 2026-06-25 全量体检 | ✗ | 🔧 ① hidden/mini 在 sessionId 变更时重置（与 FE-ws-race 修复合并）；② removeSession 时清该 sid 的 localStorage order key；③ order 数组加 schema 校验（Array.isArray + 元素是 string）——非必须 try-catch 已兜底 |
| FE-mcp-config | feat | **自定义 MCP 配置摆设不联通后端**（FE-012，P2）：`useSettings` 存的 mcpServers 列表仅本地 localStorage；grep mcpServers across client.ts 无任何 API 调用把 mcpServers 发给后端；后端 DiceGm/LoreGm 启动时用的 MCP 是后端构造的固定 dicelore 核心 MCP；testMcp 只测单个 endpoint 连通性不注册到 GM 运行时。玩家在配置页精心配的自定义 MCP 实际跑团时 GM 调不到——配置无效却无提示，玩家以为"配了就能用"；与 ADR-0018 ⑤ 自定义 MCP 设计叠加——设计定了机制，配置到运行的链路断了 | 2026-06-25 全量体检 | ✗ | ✅ 已裁决（2026-06-25）：**v1 不接入留 v2**。🔧 v1 配置页标注"仅本地、不参与 GM 运行时"避免误导。**v2 规划四点**：① agent 经 skill 扫描 MCP 包安全性、不安全警告；② 服务端可配置是否接受自定义 MCP；③ 服务端可配置是否开 MCP 安全扫描（耗 token）；④ 后端可单独刷新 session 更新列表（turnover 后刷新） |
| FE-long-ctx | feat | **长对话无前端护栏**（CROSS-LONG-CONTEXT，P3）：PlayPage L122 `draft.trim()` 空输入守门 OK；但无输入长度限制（draft 无 maxLength）；useSession.ts L45 `setNarration((n) => [...n, msg.text])` 无上限无限增长；PlayPage L313 全量 map 渲染所有段落；DiceGm.ts L94 model 默认 "glm-5.2" + systemPrompt + openingPrompt + skills 全塞 context，长对局下 context 会爆。长对局玩家体验渐进退化（GM 变笨/超时增多/前端卡顿），无护栏提示"建议开新局" | 2026-06-25 全量体检 | ✓（随对局长度越痛） | 🔧 ① narration 数组加上限（如保留最近 200 条，更早的折叠/懒加载）或引入虚拟列表（react-window）；② Markdown 组件 memo 化（React.memo + text prop 比较）避免重渲染未变段落；③ 输入框 maxLength + 字数提示；④ 长对局触发"建议存档开新局"轻推（与 [backlog-core SNAP-1](backlog-core.md) 回滚/FE-end-lock 重开联动） |
| FE-e2e | feat | **e2e 玩家主线只覆盖开局段**（CROSS-E2E，P1）：`apps/web/e2e/play.spec.ts` 只一个 test 验证到 FAKE_GM 流式开场叙事 + 输入框出现即止；不覆盖掷骰闭环/选项闭环/终局/错误恢复/断线重连/长对局；FAKE_GM 只回固定文本不触发掷骰/选择/终局；单测同样集中 happy path（client.test.ts 只测 happy path，useSession.test.tsx 只测 narration_commit/roll_staged/roll_committed 三种 WS 消息）。玩家主线中后段回归无保障——改后端逻辑或前端交互可能默默 break 而测试全绿 | 2026-06-25 全量体检 | ✓✓（随玩家主线增长回归风险线性升） | 🔧 ① 扩 FAKE_GM 脚本按回合序列触发 roll_staged→choices→game_end 补 e2e 玩局闭环；② e2e 补掷骰闭环/选项闭环/终局/错误恢复/断线重连五条；③ 单测补 useSession 的 error/game_end/presentation_delta 消息 + WS 重连 + HTTP 失败 catch + 空输入/超长输入；④ 真跑一局 dogfooding（接真 GM）录完整玩家流作 smoke。挂第三批横切基建同期 |

---

## 主题 · 可观测性 · 日志分级统一 💡🔧

> **跨层主题**：病根与统一方案（抽同构 `shared/logger`）在 [backlog-core 主题O · O1](backlog-core.md)；本页挂前端侧症状条目，依赖 O1 落地后接入。前端跑在浏览器，**复用同一分级约定 + 上下文（sessionId）**，sink 走浏览器 console（可选远端上报）。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| O-前端 | feat | **前端日志分级覆盖**：`apps/web/src` 现 **0 日志**（无 console、无 logger），渲染/WS 重连/选项提交/错误全程无记录；按 `error/warn/info/debug` 分级覆盖 | 用户 | ✓ | 依赖 [backlog-core O1](backlog-core.md) 同构 logger 落地后接入；分级约定与 core/后端对齐 |

---

## 主题 · 成本可观测性（token / 金钱可视化）💡

> **跨层主题**：病根（采集 + 归因 + 接口）在 [backlog-后端 主题 · 成本可观测性](backlog-后端.md)；本页挂前端展示条目，依赖后端采集 + 归因 ADR + 查询接口落地。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| CO-前端-可视化 | feat | **token / 金钱消耗可视化**：新界面或跑团页内嵌——per-turn token 数 + 饼图按维度（agent / MCP 工具调用链 / turn）拆分 + 金钱换算（按模型单价）；现前端零成本感知 | 用户 2026-06-25 | ✗ | 依赖 [backlog-后端 CO-后端-采集/接口](backlog-后端.md) + 归因维度 ADR；饼图维度随 ADR 定（"每 mcp/skill"概念澄清后方知可拆维度） |

---

## 🔮 未来池（前端层 · 明确推迟，别现在做）

- **明骰交互终稿（前端）**：明骰交互终稿措辞（待 [backlog-core 主题F harness](backlog-core.md)）。来源：用户。
- **多人会话 UI**：（多人论坛形态已弃 2026-06-25，此项保留仅作历史记录——与 [backlog-后端 未来池](backlog-后端.md)口径对齐）。来源：用户。**2026-06-25 体检实证（PROD-005）**：单源清理——已弃决策已做，本项从原"明骰/多人（前端）"混合条拆出单独标注。
- **Tauri 壳打包**：桌面端打包。来源：用户。**2026-06-25 体检实证（PROD-005）**：从原混合条拆出独立。**关联多端整合包发版架构 ADR-0027（草案·待 PO 复核）**——Tauri 壳是整合包发版的桌面端形态之一（Mac/Win/Linux），与安卓端并列；整合包内含本地后端 sidecar 可启停。
- **团本富前端组件 / 题材交互 widget**：如聊天界面里可点选购买的「小商店」（点卡片买、看价）。当前**只有商店**有此需求 → 推迟，**不为单一用例建「团本 ship 自定义 UI」的超复杂扩展**。将来若要，走**廉价中间路**：框架内置**有限几种** presentation widget + 生成工具声明里加 `present:"shop"` 提示（框架拥有组件、有限集，非团本任意 UI）。**后端不阻塞**：`shop_pool` 视图 + `shop_buy` 工具当下走 choice 式文本菜单即可（数据层项见 [backlog-core 未来池](backlog-core.md)）。来源：用户 + [声明式工具生成层 spec](../../superpowers/specs/2026-06-22-声明式工具生成层-design.md)（2026-06-22）；主题G 关联。
- **adapter 留下游**：GUI 前端壳。来源：04 TODO adapter。**2026-06-25 体检实证（PROD-008）**：与 [backlog-core 主题S · S2](backlog-core.md) port 契约同源——S2 port 契约落地后本项范围会被吸收/收窄。
- **前端过程透明化**（v2 规划，来源 2026-06-25 裁决 [TB-4](backlog-core.md) CROSS-D）：D 流畅派透明化 v2 做——① **token 流式消耗显示**（per-turn token 实时计数，依赖 [CO-后端-采集](backlog-后端.md) 结构化 usage）；② **thinking 输出**展示（GM 思考过程可选展示，模型支持时）；③ **skill/MCP 调用前端显示**（可关/折叠/防剧透——只告知行为"团主正在看规则书""团主正在写角色卡"等**人性化行为描述**、不告知看的什么/调的哪个具体工具，避免剧透破坏沉浸）；④ **人性化行为描述**（把 GM 的工具调用映射成叙事化提示，如"团主正在翻阅设定集""团主正在推演你的命运"）。属 D 流畅派 v2 范畴，v1 不实现（[TB-4](backlog-core.md) 裁决 v1 仅理论锚点）。
- **移动端适配**：~~愿景 §4 长期愿景，v1 不做。~~ **2026-06-25 裁决上修（[ADR-0027](../05-决策记录-ADR/README.md) 草案·待 PO 复核）**：移动端从长期愿景**提前到发版优先（安卓+Win 严重建议优先）**，走多端整合包发版架构（整合包内含本地后端 sidecar）。来源：2026-06-25 全量体检（PROD-011）+ 裁决。**需 organize-wiki 改用户与场景 §4 把"移动端长期愿景"改为"v1 发版优先"**（见 [backlog-core M1-d](backlog-core.md)）。
