---
name: acceptance-loop
description: 可用性验收循环（TDD+BDD 范例·前端驱动后端）——以真实用户身份端到端验 Dicelore 整套功能「对用户可不可用 + 有没有 bug」，问题落 backlog，重复到符合里程碑设想。outside-in 顺序：①状态机图（根）②前端原型 html+css（可见的共享样例·让开发者直接看到实际页面长什么样）③前端 overview（据原型回写·收口门）④后端接口协议（被前端数据需求驱动·补齐）⑤curl(bash)+playwright 首跑见红 ⑥开发到绿。核心反转：先让前端预览收口、再据此整理后端接口协议——接口服务于前端已定的数据需求，而非先定接口再硬塞前端。触发词：验收项目可用性、端到端测项目、跑起来看有没有 bug、里程碑验收、dogfood 一轮、acceptance-loop。用户只说"测测这个项目对用户可不可用""端到端验收看有没有 bug""按里程碑验收一遍"也务必用它——这类需求要的是**结构化 TDD+BDD 验收循环**，不是手搓一次性脚本、也不是跑 `*Test.ts` 单测。不适用：GM/构建质量定性报告（用 play-eval/build-eval）、静态只读体检（用 audit-project）、单点 bug 定位（用 systematic-debugging）。
---

# acceptance-loop（可用性验收循环 · TDD+BDD 范例 · 前端驱动后端）

单测（`*Test.ts`）证明"函数对"，但证明不了"用户能不能用整套东西、有没有 bug"。本 skill 补这一层：把**里程碑设想**当成期望，端到端把产品当真实用户走一遍，缺口/bug 落 backlog，循环到符合。

它同时是 **TDD+BDD 的范例**——BDD 的「共享样例」用**可见的前端原型**充当（让开发者/用户直接看到实际页面长什么样、怎么交互，先于任何文字契约对齐脑中行为），TDD 的「红→绿」用 curl+playwright 兜底。因为验收自己写、自己判，最大的风险是**自欺（作弊）**：把断言写宽、照代码回填期望、测试红了改断言。所以本 skill 的形制**用构造堵死作弊**，而不是靠"我保证"。

**核心反转（outside-in）**：先落可见的前端原型 → 据原型回写前端 overview → 前端预览收口 → 据前端已定的数据需求补齐后端接口协议。接口服务于前端，而非先定接口再硬塞前端。但**架构仍仲裁**——原型必须从状态机推导（不锚现有 React 代码），前端原型里冒出的、超出架构的数据需求 = finding（超前/新需求），不自动接受进接口。

> 本 skill 只定「怎么做验收」，不解释项目。里程碑设想 → [milestones.md](../../../docs/dev/plan/milestones.md)；接口/构建契约 → [玩家客户端-接口.md](../../../docs/wiki/设计/04-子系统设计/玩家客户端-接口.md) + [团本构建工具链.md](../../../docs/wiki/设计/04-子系统设计/团本构建工具链.md)；页面/视觉 → [玩家客户端-视觉.md](../../../docs/wiki/设计/04-子系统设计/玩家客户端-视觉.md)。前置起后端 → `eval-backend-setup`。
> **范例实例**（照它的形制做后续轮）：[`docs/dev/tdd/acceptance-loop-2026-07-06/`](../../../docs/dev/tdd/acceptance-loop-2026-07-06/README.md)。范例的 `frontend/index.html` 是 harness 逐态预览入口（开浏览器即看实际页面）。

## 五条铁律（防作弊 = TDD 纪律，贯穿全程）

这五条不是仪式，每条都堵一种具体的自欺方式——理解了"堵什么"，就知道什么时候不能偷懒：

1. **期望来自架构、先于实现**。期望从**架构意图 / wiki 契约 / 状态机**推导，写下、独立于代码。前端原型也是期望——它从页状态机推导而来，不是照现有 React 代码回填。一旦照"代码现在返回什么 / 现在页面长什么样"回填期望，验收就变成了给现状盖章——测了个寂寞。
2. **红先行**。每条断言/测试首跑必须能红。没见过它红，就不知道它到底在不在测东西——永远绿的断言是最隐蔽的空判据。
3. **绿只准改代码**。测试红了 → 改**被测代码**，或落 backlog 保留红。**改断言让它变绿 = 作弊**；万不得已要动期望，单列 diff 交用户复核，因为改期望等于偷偷挪动及格线。
4. **不信"实现状态列"**。wiki 里的 ✅/🚧/❌ 会过时、会自相矛盾（本项目已多次"过时已纠"）。别拿它当结论——**唯一 ground truth 是真跑**（curl / playwright / 假 GM 遍历）。可见的原型也不是 ground truth——它只是期望，跑起来对得上才算数。
5. **确定性 + 全程落盘**。Tier 0 走假 GM（`DICELORE_FAKE_GM=1`）确定性路径，transcript 落盘，让用户能亲自重跑得到同一结果——可复现是"没编造"的唯一硬证明。真 LLM（Tier 1）当忠实性锚点：验假 GM 没在测一个虚构系统，并抓脚本抓不到的涌现 bug。

## 工作流（前端驱动后端 · outside-in · 六步）

前五步写**规格 + 测试**（TDD 的"红"），第六步才**实现**（"绿"）。根是状态机，往下 **先走前端 track 到收口，再回头补后端 track**——前端先可见、后端后补协议。

**第零步 · 状态机图（总体设计的根）**
从 wiki 架构意图推导（不锚代码），画两类状态机：**实体状态机**（会话生命周期 + 域机 + catalog）与**页状态机**（各页一台）。这是后面所有原型、接口与测试的来源，先把动态图景定对，接口只是实体机每条转移的触发器、原型只是页机每条态的可见呈现。建模法与 Dicelore 现有模型 → [`references/state-machine-model.md`](references/state-machine-model.md)。**每轮从最新一轮的状态机出发精修、别从零重画**（重画必漂移）。

**第一步 · 前端原型先行（html+css · 可见的共享样例）**
据页状态机，落**一套 html+css 原型**（可承 wiki 视觉草图），配一个 `frontend/index.html` harness 按 `data-screen`/hash 逐页逐态预览——**开浏览器即看到实际页面长什么样、怎么交互**。这是 BDD 的共享样例：具体的、可见的，先于文字契约对齐所有人脑中行为。原型仍是期望（从页状态机推导，**不锚现有 React 代码**——铁律 1）。目的不是美术定稿，而是给每页**确定的结构 + 稳定 `data-testid` 选择器 + 关键交互**，同时充当后续 playwright spec 的 testid/视觉锚——**原型本身不被 playwright 跑**，它是期望（BDD 共享样例），不是被测目标。

**第二步 · 前端 overview（据原型回写）+ 收口门**
据已落地的原型**回写**前端设计概览：逐页结构/选择器/关键交互——选择器直接从原型 html 抄，不另起炉灶。这一步是「文档化原型」，让原型可被测试引用、可被后端推导。同时**列「前端数据需求清单」**：原型每个动态区域需要后端喂什么数据（如跑团页 dock-card 需 sheet cells、明骰需 per-band narrate、暗骰需 hidden 标记）→ 喂给第三步。
- **收口门**：原型能逐页逐态预览、开发者看了就懂无歧义、overview 与原型一致（选择器对得上）、数据需求清单成形 → 才进第三步。没收口就回头改原型，别急着写后端协议。

**第三步 · 后端接口协议（被前端数据需求驱动 · 补齐）**
据第二步的「前端数据需求清单」+ 实体状态机每条转移，derive 后端接口规约（`/sessions/{kind}` 对称面 + 域子资源 + catalog + 配置/诊断），每端点标期望响应形状（引 wiki），再对现有代码匹配（缺/多/存疑 = finding）。**前端驱动后端**：接口服务于前端已定的数据需求。**架构仲裁**：前端原型冒出的、超出实体机/wiki 的数据需求 = finding（超前/新需求，如 RT-FE14 上下文占用、RT-FE18 model 切换），落 backlog/裁决记录，不自动塞进接口。

**第四步 · curl 脚本（bash）+ playwright（红）**
- curl 脚本据接口协议，用假 GM 确定性**遍历实体状态机每条转移**，逐端点断言期望 status + body 形状（引 wiki，不看代码输出）。
- playwright 写**针对真前端（React app · vite dev server）的可执行规约**：据原型 + overview 的 `data-testid` + 后端接口/curl 的数据形状，驱动**页状态机每条转移**、断言可见状态。**原型 html+css 不是 playwright 的被测目标**——它是 BDD 共享样例（可见的期望 + testid 源），playwright 跑的是真前端 app。spec 首跑必红（真前端 IA/testid 未对齐原型 = finding，如 RT-FE1/RT-FE3），前端按原型重构到 testid 对齐 + 接真数据才绿。
- 两者**首跑都应见红**（铁律 2）。模式 → [`references/interface-and-tests.md`](references/interface-and-tests.md)。

**第五步 · 开发到测试全绿**
开发后端使 curl 脚本全绿、前端按原型重构到 testid 对齐 + 接真数据使 playwright 绿。只改代码不改断言（铁律 3）。红 = 被测 bug：**可逆小修当场改**；**重大/不可逆**（架构改、破坏性改名、需用户裁决）→ 落 backlog + 冒泡，不自作主张。分诊与归口 → [`references/interface-and-tests.md`](references/interface-and-tests.md)。

> 范例 0706 轮的实际产物顺序即为：状态机 → 前端原型(已落地) → 前端 overview(已落地) → 后端接口规约(已落地) → findings 表。后续轮照此 outside-in 推进。

## 产物、循环、分档

- **落盘**：一轮一目录 `docs/dev/tdd/acceptance-loop-<YYYY-MM-DD>/`（状态机 + 前端原型 `frontend/`(含 `index.html` 逐态预览) + 前端 overview + 后端接口规约 + curl + playwright + findings 表 + transcript）。
- **findings → backlog 三池**（core / 后端 / 前端），重排接 `idea-to-roadmap`；不可逆修复进 `decisions/` 待用户批准。**不改 `milestones.md`**（人工维护）。
- **分档控成本**：每轮先 Tier 0（假 GM，确定性、便宜、必跑）过了，再 Tier 1（真 LLM，深跑一局、贵）当锚点。
- **循环终点**：所有 curl/playwright 断言要么绿、要么已落 backlog 带理由，且期望集覆盖里程碑设想。
