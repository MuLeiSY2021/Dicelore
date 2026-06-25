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
| FE-CLI-doc | docs | **README "CLI 一键开玩"断节**（USER-001，P0）：README.md L60 承诺"CLI 一键脚手架即开玩"，但 `packages/core/src/cli.ts` switch(cmd) 只有 new/list/inspect/init 四命令，无 play/roll/choose；真玩必须起 orchestrator 后端 + web dev server + 浏览器，这条路径 README 没写给玩家。新玩家按 README 装完 CLI 直接卡死——"随时在线、低安装、本机直接玩到"卖点在当前实现下不成立 | 2026-06-25 全量体检 | ✗ | ⏳ **待裁决（见体检汇总 §未决问题 4）**：改文档对齐实现 vs 补 CLI play 子命令对齐文档？属产品决策（v1 玩家入口形态）。① README 明确标注"v1 当前通过 web 客户端玩，CLI 仅会话管理"并给 web 启动步骤（orchestrator + vite dev）；② 或补 CLI 的 play 子命令（连后端或内嵌后端起局）。属发版闸前必对齐的文档-实现一致性 |
| FE-end-lock | feat | **终局后玩家锁死无重开/回滚入口**（USER-002，P1）：`PlayPage.tsx` L365 玩家输入框 `disabled={!!gameEnd}`；L308 终局只渲染 end div，无任何"重开/回滚"按钮；grep i18n 无 restart/重来/再玩/新一局/重新开始 任何键。玩家死一次就卡死，违场景 A 卖点"随时能玩" | 2026-06-25 全量体检 | ✗ | 🔧 PlayPage 终局态加"重开本团本（新会话）/ 回滚到上一快照（若 [backlog-core SNAP-1](backlog-core.md) 接线）/ 回主页"三按钮；或至少"再来一局"一键用同团本开新 session。与 [backlog-core E2 ADR](backlog-core.md) 配套设计终局后玩家流程 |
| FE-err-swallow | fix | **错误吞没与错误通道不一致**（CROSS-ERR，P1）：`PlayPage.tsx` L122 `postMessage(draft.trim()).catch(() => {})` 吞错、L337 `choose(...).catch(() => setChosen(null))`、L351 `roll(...).catch(() => {})` 完全静默；useSession 的 WS error 有 setError 通道但 HTTP 路径错误不进 error 通道，两套错误通道割裂。玩家发消息/掷骰/选选项静默失败无反馈——最坏情况玩家以为发出去了但 GM 没响应；与 [backlog-后端 RT-3 rollGate 409 死锁](backlog-后端.md) 叠加玩家连"无待掷"提示都看不到 | 2026-06-25 全量体检 | ✓（随网络抖动/后端重启场景越痛） | 🔧 ① catch 改为 `catch((e) => { setError(e instanceof Error ? e.message : String(e)); })` 把 HTTP 错误进 error 通道；② postMessage 失败时不要清空 draft（把 `setDraft("")` 挪到 .then 里）让玩家能重发；③ roll 的 409 特殊处理显示"无待掷骰，可能后端已重启/会话状态已变"并给"重试/刷新"选项 |
| FE-ws-race | fix | **WS 重连竞态切会话状态残留**（FE-001，P2）：`useSession.ts` L62-79 connect() 的 onclose 调度 `setTimeout(() => { refetch(); connect(); }, delay)`；refetch 返回慢时切会话后旧 refetch 的 `.then(setSnapshot)` 仍会跑——setSnapshot 不绑 sessionId 无条件更新当前 hook 实例 state；narration/pendingRoll/reveals 等数组状态在切会话时不重置。玩家在会话栏切换会话时：新会话短暂闪现旧会话呈现快照、旧会话 narration 段落残留、旧会话 pendingRoll 残留（新会话显示掷骰按钮但本局无待掷，点击 409） | 2026-06-25 全量体检 | ✓（随会话切换频次越痛） | 🔧 ① useSession 在 sessionId 变更时重置所有 state（narration=[]、pendingRoll=null、reveals=[]、gameEnd=null、error=null、generating=false）；② refetch 的 .then 里加 sessionId 守卫 `if (currentSidRef.current === sessionId) setSnapshot(s)`；③ 或将 useSession 拆成 key=sessionId 的子组件（React 自动 remount 清 state，最干净）。与 FE-drag-residue 合并修 |
| FE-start-contract | fix | **缝B start 契约不一致**（FE-003，P1）：前端 `client.ts` L74-81 startGame 按 `{turnId: string}` 解析；后端 `dice.ts` L75-79 返回 `{sessionId, started}`——字段名语义都不同；当前不崩只因 PlayPage 不消费返回值，但 client.ts 类型契约是谎言（as 断言绕过 TS） | 2026-06-25 全量体检 | ✗ | 🔧 ① 后端 dice.ts 改为返回 `{turnId}` 与 messages/roll/choices 对齐（推荐——保持 turnId 语义一致）；② 或前端 client.ts 改为 `{sessionId, started}` 并更新调用方；③ 缝 B 契约建单源 schema（`shared/rest.ts`）前后端共用，避免 as 断言绕过 TS 检查 |
| FE-testModel-ok | fix | **testModel/testMcp 未校验 res.ok**（FE-004，P2）：`client.ts` L157-162 testModel 无 `if (!res.ok) throw` 检查；L163-168 testMcp 同样漏了；对比同文件其他函数（getPresentation L15、postMessage L31）都有 res.ok 守门——唯独 testModel/testMcp 漏了。后端返回 4xx（如 baseUrl 非法、SSRF 防护拒绝）时前端把错误响应体当成功结果解析，显示"连接失败 · undefined"或错误信息丢失 | 2026-06-25 全量体检 | ✗ | 🔧 client.ts L159/L164 加 `if (!res.ok) throw new Error("model-test 请求失败：${res.status}")` 与其他函数对齐。非阻塞但应修——错误处理一致性 |
| FE-md-xss | fix | **Markdown XSS 当前安全须防回归**（FE-006，P2）：`Markdown.tsx` L15-31 inline() 手写正则不转义 HTML；但实测 React JSX 子节点默认转义机制保护了所有渲染路径——`<strong>{m[1]}</strong>` 中 m[1] 是字符串 React 转义；grep 全仓无 dangerouslySetInnerHTML/innerHTML/eval——XSS 面实际不存在。**初判可疑、实测安全**——记录以免后续误改 Markdown.tsx 引入 dangerouslySetInnerHTML | 2026-06-25 全量体检 | ✗ | 🔧 ① 保持现状加注释明确"禁止引入 dangerouslySetInnerHTML，扩展链接/图片时须校验 href/src 协议（禁 javascript:）"；② 单测补"输入 `<script>alert(1)</script>` 验渲染为文本不执行"防回归 |
| FE-dead-code | fix | **死代码 RollCard/PresentationStage**（FE-009，P3）：`RollCard.tsx`/`PresentationStage.tsx` 全组件定义了独立掷骰卡/呈现台渲染，但 PlayPage 实际用内联的 .ranges/.mech div 与 .stage/.grid + Panel 组件；grep RollCard/PresentationStage 在 src/ 内除自身定义与测试外无其他引用——死代码；RollCard 的 d100 vs PlayPage 的 d10 不一致（死代码里的 bug 会误导维护者） | 2026-06-25 全量体检 | ✗ | 🔧 ① 删 RollCard.tsx + RollCard.test.tsx + PresentationStage.tsx + PresentationStage.css + PresentationStage.test.tsx；② 或若 PresentationStage 的只读快照渲染另有用途（如未来打印/导出场景），显式标注"仅用于 X 场景"并抽出共用逻辑。非阻塞 clean up 时一并处理 |
| FE-drag-residue | fix | **PlayPage 拖拽 localStorage 切会话残留**（FE-011，P3）：`PlayPage.tsx` L84 `orderKey = dicelore.stage.order.${sid}`；hidden/mini 状态是内存态、切会话不重置——与 FE-ws-race 竞态同源；removeSession 时不清该 sid 的 localStorage order key（小内存泄漏） | 2026-06-25 全量体检 | ✗ | 🔧 ① hidden/mini 在 sessionId 变更时重置（与 FE-ws-race 修复合并）；② removeSession 时清该 sid 的 localStorage order key；③ order 数组加 schema 校验（Array.isArray + 元素是 string）——非必须 try-catch 已兜底 |
| FE-mcp-config | feat | **自定义 MCP 配置摆设不联通后端**（FE-012，P2）：`useSettings` 存的 mcpServers 列表仅本地 localStorage；grep mcpServers across client.ts 无任何 API 调用把 mcpServers 发给后端；后端 DiceGm/LoreGm 启动时用的 MCP 是后端构造的固定 dicelore 核心 MCP；testMcp 只测单个 endpoint 连通性不注册到 GM 运行时。玩家在配置页精心配的自定义 MCP 实际跑团时 GM 调不到——配置无效却无提示，玩家以为"配了就能用"；与 ADR-0018 ⑤ 自定义 MCP 设计叠加——设计定了机制，配置到运行的链路断了 | 2026-06-25 全量体检 | ✗ | ⏳ **待裁决（见体检汇总 §未决问题 7）**：自定义 MCP 配置 v1 是否接入 GM 运行时？① 若接入——后端加"自定义 MCP 注册"端点（POST /diagnostics/mcp/register 或开局带 mcpServers 配置），前端 client.ts 把 settings.mcpServers 发给后端；与 [backlog-后端 SEC1](backlog-后端.md) 鉴权叠加（恶意客户端可注册窃密 MCP）；② 若不接入——配置页显式标注"v1 自定义 MCP 配置仅本地存储、不参与 GM 运行时"加提示避免误导 |
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
- **Tauri 壳打包**：桌面端打包。来源：用户。**2026-06-25 体检实证（PROD-005）**：从原混合条拆出独立。
- **团本富前端组件 / 题材交互 widget**：如聊天界面里可点选购买的「小商店」（点卡片买、看价）。当前**只有商店**有此需求 → 推迟，**不为单一用例建「团本 ship 自定义 UI」的超复杂扩展**。将来若要，走**廉价中间路**：框架内置**有限几种** presentation widget + 生成工具声明里加 `present:"shop"` 提示（框架拥有组件、有限集，非团本任意 UI）。**后端不阻塞**：`shop_pool` 视图 + `shop_buy` 工具当下走 choice 式文本菜单即可（数据层项见 [backlog-core 未来池](backlog-core.md)）。来源：用户 + [声明式工具生成层 spec](../../superpowers/specs/2026-06-22-声明式工具生成层-design.md)（2026-06-22）；主题G 关联。
- **adapter 留下游**：GUI 前端壳。来源：04 TODO adapter。**2026-06-25 体检实证（PROD-008）**：与 [backlog-core 主题S · S2](backlog-core.md) port 契约同源——S2 port 契约落地后本项范围会被吸收/收窄。
- **移动端适配**：愿景 §4 长期愿景，v1 不做。来源：2026-06-25 全量体检（PROD-011）。**显式推迟**——用户与场景 §4 愿景"适配移动端"在 v1 无 backlog 承接，此条作未来池锚点，避免下游误以为已排期。
