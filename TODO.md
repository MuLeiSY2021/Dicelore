你接手一个进行中的任务：为 **Dicelore**（给 AI 套 GM 行为塑形框架的文字冒险引擎，仓库根 `/home/mulei/dicelore`）打磨一个名为 **`acceptance-loop` 的验收 skill 及其首轮实例的前端原型**。原 agent 已完成大量工作，现处于「前端原型评审迭代」阶段。

## 背景与约定（务必先读）
- **skill 已建**：`.claude/skills/acceptance-loop/`（`SKILL.md` + `references/`）。它是「可用性验收循环·TDD 范例」，四步：①状态机图（根）②后端接口规约+前端设计概览(html/css) ③大型 curl 脚本+playwright ④开发到测试全绿。**五条防作弊铁律**：期望先于实现·红先行·绿只准改代码·不信 wiki「实现状态列」·确定性+落盘。
- **首轮工件目录**：`docs/dev/tdd/acceptance-loop-2026-07-06/`，分件：`0-state-machines.md`（状态机=根，A 实体 A1-4 / B 页 B1-6）、`1-backend-interface.md`（`/sessions/{kind}` 对称接口规约）、`1-frontend-overview.md`（selector 规约）、`2-tests.md`（curl/playwright 骨架·待写）、`findings.md`（RT1-9 缺口）、`frontend/`（前端原型）、`README.md`（索引+交接点）。
- **工作方式**：就地改（不开 worktree）；**只在用户明确要求时才 commit**（当前**尚未 commit** 任何东西）；改代码前对 `docs/wiki/术语表.md` 确认命名。

## 当前正在做：前端原型（`docs/dev/tdd/acceptance-loop-2026-07-06/frontend/`）
「墨金」主题（深墨绿+描金），重构自 wiki 视觉草图 `docs/wiki/设计/04-子系统设计/玩家客户端-视觉草图/`。文件：`styles.css`(共享) `app.js`(共享行为) `index.html`(harness) `home/catalog/play/build/config.html`(5 成品页) `README.md`。

**已确立的关键约定（勿违背，都是用户逐条纠正出来的）**：
1. **index.html = 预览 harness**：左侧列「页面→状态」，中间 iframe 加载 `page#state`，切换逻辑只在 index。**其他 5 页是成品页**——无预览标题/注释/页内切换下拉，全幅 `appshell`，只靠 hash 响应状态。
2. **一个视图只干一件事，状态绝不叠**：play 历史流（叙述/GM回复/机械/揭示=过去日志可共存）与底部当前交互（待输入/待掷/待选/生成中/错误=互斥只一个）分离；整屏态（无会话/未开场/终局）独占。掷骰 modal 待掷→点「掷！」才出结果。
3. **hash 驱动**：`#s=X` 走 `[data-screen]` 单状态（play/catalog），`#v=X` 走 `[data-nav]` 子页（build/config）。**坑**：`[hidden]{display:none!important}` 必须在（否则 class/内联 display 压过 hidden，切换失效）。全挂 `data-testid`（供后续 playwright）。
4. play 特有：顶栏 session bar（列所有会话·活动日期/团本/最新回复）、**透视 GM 动作**开关（叙述 vs 叙述+MCP调用）、**叙述 vs GM回复两通道**（GM回复=OOC对玩家可见，如聊规则——此点触及后端三流模型，是待记的设计 finding）、富呈现台（五域+叙事脚手架 front/clock/plotline/foreshadow/tension_board）。
5. build 侧栏按最新域集（五域 + 叙事脚手架 + prologue/manifest），内容类型可切。config 七子页全可切 + 连接测试三态。catalog 点「开始游戏」弹选版本 modal（默认最新）。

**预览方式**：仓库根起静态服务 `python3 -m http.server 8099 --bind 127.0.0.1 --directory docs/dev/tdd/acceptance-loop-2026-07-06/frontend`，浏览器开 `http://localhost:8099/index.html`（原 session 可能已在跑，端口占用就换个口）。

## 待用户拍板的缺口（上一轮审计出，勿擅自全做）
- **G1**：A1「空(rewind到头)/归档」无独立视图 + play 无 rewind 控件（状态机/接口有 `/rewind`，UI 缺）。原 agent 建议至少补这个。
- **G2**：build 未像 play 那样把 loregm 域机(待输入/编排中/校验/提交)做成可切状态（现为内容域工作台）——建法取向问题，待用户定。
- **G3**：usage/成本无前端面板（里程碑二 ⬜，未来）。
- **G4**：小——config 未显示 `health.fakeGm`；build 缺 relation 视图。

## 你接手后
先开预览、对着 index harness 逐页/逐态过一遍，确认「状态切换真生效、无叠加、成品页无预览壳」。然后等用户就 G1–G4 的取舍给指示；用户之前节奏是「给出具体产物→他评审→逐条纠正」。**别 push，别开 worktree，改动别 commit 除非他说。** 更大图景：这是四步 TDD 的「第一步·前端」，第零(状态机)+第一后端(接口规约)已就位，第二(curl/playwright)、第三(开发到绿)还没开始。