---
name: acceptance-loop
description: 可用性验收循环（TDD 范例）——以真实用户身份端到端验 Dicelore 整套功能「对用户可不可用 + 有没有 bug」，问题落 backlog，重复到符合里程碑设想。四步 TDD：①状态机图（总体设计的根）②后端接口规约（据状态机）+ 前端设计概览（一套 html+css 落地）③大型 curl 测试脚本（据接口规约·bash）+ playwright（据 html+css）④开发后端使 curl 全绿、开发前端使 playwright 绿。触发词：验收项目可用性、端到端测项目、跑起来看有没有 bug、里程碑验收、dogfood 一轮、acceptance-loop。用户只说"测测这个项目对用户可不可用""端到端验收看有没有 bug""按里程碑验收一遍"也务必用它——这类需求要的是**结构化 TDD 验收循环**，不是手搓一次性脚本、也不是跑 `*Test.ts` 单测。不适用：GM/构建质量定性报告（用 play-eval/build-eval）、静态只读体检（用 audit-project）、单点 bug 定位（用 systematic-debugging）。
---

# acceptance-loop（可用性验收循环 · TDD 范例）

单测（`*Test.ts`）证明"函数对"，但证明不了"用户能不能用整套东西、有没有 bug"。本 skill 补这一层：把**里程碑设想**当成期望，端到端把产品当真实用户走一遍，缺口/bug 落 backlog，循环到符合。

它同时是 **TDD 的范例**——因为验收自己写、自己判，最大的风险是**自欺（作弊）**：把断言写宽、照代码回填期望、测试红了改断言。所以本 skill 的形制**用构造堵死作弊**，而不是靠"我保证"。

> 本 skill 只定「怎么做验收」，不解释项目。里程碑设想 → [里程碑.md](../../../docs/wiki/设计/05-现状与计划/里程碑.md)；接口/构建契约 → [玩家客户端-接口.md](../../../docs/wiki/设计/04-子系统设计/玩家客户端-接口.md) + [团本构建工具链.md](../../../docs/wiki/设计/04-子系统设计/团本构建工具链.md)；页面/视觉 → [玩家客户端-视觉.md](../../../docs/wiki/设计/04-子系统设计/玩家客户端-视觉.md)。前置起后端 → `eval-backend-setup`。
> **范例实例**（照它的形制做后续轮）：[`docs/tdd/acceptance-loop-2026-07-06/`](../../../docs/tdd/acceptance-loop-2026-07-06/README.md)。

## 五条铁律（防作弊 = TDD 纪律，贯穿全程）

这五条不是仪式，每条都堵一种具体的自欺方式——理解了"堵什么"，就知道什么时候不能偷懒：

1. **期望来自架构、先于实现**。期望从**架构意图 / wiki 契约**推导，写下、独立于代码。一旦照"代码现在返回什么"回填期望，验收就变成了给现状盖章——测了个寂寞。
2. **红先行**。每条断言/测试首跑必须能红。没见过它红，就不知道它到底在不在测东西——永远绿的断言是最隐蔽的空判据。
3. **绿只准改代码**。测试红了 → 改**被测代码**，或落 backlog 保留红。**改断言让它变绿 = 作弊**；万不得已要动期望，单列 diff 交用户复核，因为改期望等于偷偷挪动及格线。
4. **不信"实现状态列"**。wiki 里的 ✅/🚧/❌ 会过时、会自相矛盾（本项目已多次"过时已纠"）。别拿它当结论——**唯一 ground truth 是真跑**（curl / playwright / 假 GM 遍历）。
5. **确定性 + 全程落盘**。Tier 0 走假 GM（`DICELORE_FAKE_GM=1`）确定性路径，transcript 落盘，让用户能亲自重跑得到同一结果——可复现是"没编造"的唯一硬证明。真 LLM（Tier 1）当忠实性锚点：验假 GM 没在测一个虚构系统，并抓脚本抓不到的涌现 bug。

## 四步工作流

前三步写**规格 + 测试**（TDD 的"红"），第四步才**实现**（"绿"）。根是状态机，往下 fork 成后端 track 与前端 track。

**第零步 · 状态机图（总体设计的根）**
从 wiki 架构意图推导（不锚代码），画两类状态机：**实体状态机**（会话生命周期 + 域机 + catalog）与**页状态机**（各页一台）。这是后面所有接口与测试的来源，先把动态图景定对，接口只是它每条转移的触发器。建模法与 Dicelore 现有模型 → [`references/state-machine-model.md`](references/state-machine-model.md)。**每轮从最新一轮的状态机出发精修、别从零重画**（重画必漂移）。

**第一步 · 后端接口规约 + 前端设计概览**
- 后端接口规约：据状态机每条转移 derive 出应有接口（`/sessions/{kind}` 对称面 + 域子资源 + catalog + 配置/诊断），每端点标期望响应形状（引 wiki），再对现有代码匹配（缺/多/存疑 = finding）。
- 前端设计概览：据页状态机落**一套 html+css**（可承 wiki 视觉草图），定各页结构/选择器/关键交互——是 playwright 的锚。
- 详细推导法 → [`references/interface-and-tests.md`](references/interface-and-tests.md)。

**第二步 · 大型 curl 脚本（bash）+ playwright（红）**
- curl 脚本据接口规约，用假 GM 确定性**遍历实体状态机每条转移**，逐端点断言期望 status + body 形状（引 wiki，不看代码输出）。
- playwright 据落地 html+css，驱动页状态机每条转移、断言可见状态。
- 两者**首跑都应见红**（铁律 2）。模式 → [`references/interface-and-tests.md`](references/interface-and-tests.md)。

**第三步 · 开发到测试全绿**
开发后端使 curl 脚本全绿、前端使 playwright 绿。只改代码不改断言（铁律 3）。红 = 被测 bug：**可逆小修当场改**；**重大/不可逆**（架构改、破坏性改名、需用户裁决）→ 落 backlog + 冒泡，不自作主张。分诊与归口 → [`references/interface-and-tests.md`](references/interface-and-tests.md)。

## 产物、循环、分档

- **落盘**：一轮一目录 `docs/tdd/acceptance-loop-<YYYY-MM-DD>/`（状态机 + 接口规约 + 前端概览 + curl + playwright + findings 表 + transcript）。
- **findings → backlog 三池**（core / 后端 / 前端），重排接 `idea-to-roadmap`；不可逆修复进 `裁决记录/` 待用户批准。**不改 `里程碑.md`**（人工维护）。
- **分档控成本**：每轮先 Tier 0（假 GM，确定性、便宜、必跑）过了，再 Tier 1（真 LLM，深跑一局、贵）当锚点。
- **循环终点**：所有 curl/playwright 断言要么绿、要么已落 backlog 带理由，且期望集覆盖里程碑设想。
