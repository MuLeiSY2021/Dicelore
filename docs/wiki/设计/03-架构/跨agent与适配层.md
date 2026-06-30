# 跨 agent 与适配层

> **本页职责**：回答"v1 骑哪个 agent 基底、core 与基底绑定怎么切、hook 怎么承重、未来怎么演进到 GUI"。
> **上游依赖**：[总体架构](总体架构.md)、[技术选型 §6 基底 / §6.1 分发](技术选型.md)、[01 卡位重述](../01-业务与定位/问题域.md)。
> **状态**：🟢 已成型（2026-06-01；**2026-06-02 据定位重述重写**；**2026-06-20 修订 §6**：呈现层轴二从"未来层"提前为组件7「玩家客户端」、机制定为 Agent SDK headless host，[ADR-0018](../归档/历史决策日志.md)）。

---

## 0. 一句话

**core 是标准件，v1 骑定 Claude Code 基底、承重地用它的 hook / skill / subagent。** 框架的塑形能力，一部分活在与基底无关的标准载体里（MCP + markdown skill + SQLite + 团本），一部分**有意地、承重地**交给 Claude Code 的专属机制（hook 注入、subagent 裁判、skill 装载）。可移植性兑现在**模型层**（Claude Code model-agnostic，可接各种大模型，含国产）而非 agent 层。经玩家客户端（组件7、[ADR-0018](../归档/历史决策日志.md)）用 GUI 隐藏终端 / Claude Code（呈现层从未来层提前、机制 ＝ Agent SDK headless host）。这是 [01 卡位重述](../01-业务与定位/问题域.md) + [技术选型 §6](技术选型.md) 的落地。

> **与旧版的根本变化（2026-06-02）**：旧版把"可嫁接任意 agent、hook 仅可选优化、绝不依赖某 agent 专属能力"当立身。重述后——**可移植不是目标，效果 / 分发 / 低开发成本才是**：core 保持标准不锁死，但 v1 明确骑 Claude Code，**hook 从"可选降级"升为"承重"**（详见 §5）。

---

## 1. core（标准、不锁死） vs Claude Code 绑定（承重）

| | 内容 | 绑定 | 换基底时 |
|---|---|---|---|
| **core（标准件）** | `dicelore-mcp-server`（MCP 协议）、Skill 教条（markdown）、SQLite store + 团本 | 不绑——协议 / 格式标准 | 可搬（理论上） |
| **Claude Code 绑定（v1 承重）** | 安装配置（`.claude/` + `settings.json`：注册 MCP / 放 skill / 配 hook）、**hook（被动 rule 召回、L3 审计）**、（未来）裁判 subagent / GUI 包裹 | 绑 Claude Code | 需重做这层 |

> **可移植在模型层、不在 agent 层**：Claude Code 本身 model-agnostic，所以"窄绑一个 harness"不锁模型——用户真正在乎的"用哪个大模型"仍自由（含国产）。这就是重述后"可移植"的确切含义。

---

## 2. 三个塑形杠杆怎么落在基底上

[02 §4](../02-领域模型/核心概念.md) 的 L1/L2/L3，落到 Claude Code：

| 杠杆 | 载体 | 绑定 | 说明 |
|---|---|---|---|
| **L1 工具强制** | MCP 工具 schema | **core 标准** | MCP 标准，结构强制随工具走 |
| **L2 skill 教** | markdown 教条 | 内容 core 标准、**装载走 Claude Code skill 机制** | 教条本身可搬；放 `.claude/skills/` 由 Claude Code 装载 |
| **L3 + 被动注入** | Claude Code hook | **绑 Claude Code、v1 承重** | 被动 rule 召回、掷骰绕过 / 后果-叙事审计——靠 hook（watcher 到期已下沉为 `sheet_update` 就地触发、非 hook，[ADR-0013](../归档/历史决策日志.md)；裁判 subagent 降为未来，[ADR-0014](../归档/历史决策日志.md)） |

→ 与旧版差别：旧版说"L3 可缺、优雅降级"。**重述后 hook 承重**——被动 rule 召回是核心玩法的一部分（[内层 §4.4](../04-子系统设计/内层能力库.md)），不是可有可无的事后审计。我们用"绑 Claude Code"换"这些承重机制白嫖、不自研"。

---

## 3. hook：v1 承重机制（不再是可选优化）

Claude Code 的 hook 承担两类**核心**活（实现落 [04 adapter 与 L3 审计](../04-子系统设计/adapter与L3审计.md)）：

1. **被动 rule 召回**（回合开始 ＝ UserPromptSubmit）：AI 描述某情节时，hook 把相关 rule 约束注入本轮提示词（rule 被动拉取、AI 只读，[内层 §4.4](../04-子系统设计/内层能力库.md)）。
2. **L3 审计**（回合末 ＝ Stop）：物化暂存 choice；掷骰绕过率、后果-叙事一致性（机械层比对本轮——一个 agent 回合——的 verdict / mutation vs narrate；语义疑点 `block` ＋ reason 让主 agent 自纠，**不 spawn 独立裁判 subagent**，[ADR-0014](../归档/历史决策日志.md)）。

> **watcher 到期不在 hook**：旧版列的"timer 到期注入"已由 [ADR-0013](../归档/历史决策日志.md) 改为 `sheet_update` 写完就地触发（内层 / MCP 的 core 能力、不绑 Claude Code）——hook 承重因此再缩一项。

**跨端约束**（因 npm 包跨 Win/Mac/Linux 分发，[技术选型 §6.1](技术选型.md)）：
- **hook 脚本一律用 Node 写、不用 bash**——否则 Windows 跑不了。
- **路径平台感知**（app-data 目录），不写死 POSIX 路径。

---

## 4. skill 注入 = Claude Code 专属（唯一路径）

L2 教条内容是 core 标准件，但**装载走 Claude Code 的 skill 机制**：放 `.claude/skills/`，`settings.json` 配 MCP + hook。由 `dicelore` CLI 的 `init` 一键写好（[技术选型 §6.1](技术选型.md)）。

> 不再"因 agent 而异列多种注入方式"——v1 只认 Claude Code 这一条路。core 标准件保证未来换基底时教条本身可搬，但 **v1 不为别的 agent 做注入适配**。

---

## 5. 为什么接受"绑 Claude Code"（定位重述的核心取舍）

旧版红线"**绝不让核心塑形依赖某 agent 专属能力**"——**重述后翻掉**。新取舍：

- **可移植不是目标**（[01](../01-业务与定位/问题域.md) / [技术选型 §6](技术选型.md)）：为"嫁接任意 agent"做工程，是为不需要的东西付费、还牺牲效果。
- **绑 harness ≠ 绑模型 ≠ 闭环产品**：Claude Code model-agnostic（模型层仍可移植）；core 是开源标准件（未来可搬、不自跑模型）。绑的只是"用哪套 hook / skill / subagent 机制"。
- **承重 hook 白嫖**：被动 rule 召回、L3 审计这些自研太重（违低开发成本），Claude Code 现成（watcher 到期 / 裁判已分别下沉 sheet 引擎 / 降为未来，见 [ADR-0013](../归档/历史决策日志.md) / [ADR-0014](../归档/历史决策日志.md)）。
- **底线仍在**：core（MCP / Skill / SQLite / 团本）保持标准、不锁死——这是"未来想搬就能搬"的保险，也是和闭环产品的实质区别。

---

## 6. 两根正交轴（保留，呈现层具体化）

```
轴一（§1）：core 标准件   ⟂   Claude Code 绑定（承重交付）
轴二：       "用哪个模型"  ⟂   "玩家怎么看"
             模型层可移植(经 Claude Code)    呈现层(终端 → 未来 GUI)
```

- **轴一**：core 标准、交付绑基底——但"绑"是**有意承重**，非旧版"可选装法"。
- **轴二 · 呈现层 = 玩家客户端（组件7，[ADR-0018](../归档/历史决策日志.md)）**：v1 终端（`dicelore play` / `claude`）仍在，**并行推进 web 玩家客户端**——机制 ＝ **Agent SDK headless host**（用 `@anthropic-ai/claude-agent-sdk` ＝ 程序化 Claude Code 把 GM 作为库嵌进自建 Node 服务），而非 Tauri 包交互式终端。**这不离开轴一"骑定 Claude Code"**：三 hook / 进程内 MCP / skill 装载原样复用，只换宿主外壳（TUI → web）。一个编排契约（REST + 流式）套两种分发壳：**Tauri（个人向头等分发、开箱即用，壳内捎带后端的 Node sidecar）** / **Web（企业·多人向托管 ＝ [场景 B](../01-业务与定位/用户与场景.md)）**。GUI 仍读 SQLite store / `narrate` 展示人物卡 / 剧情 / 卡池，**与"哪个模型当 GM"正交**；与 core 则**单向依赖 + 一条变更通知缝**（core/MCP 写规范态时发信号、后端订阅推呈现增量，为反应式 / 性能，详见 [04 玩家客户端](../04-子系统设计/玩家客户端.md)）。详见 [总体架构 §7 组件7](总体架构.md)。

---

## 决策与权衡

> 本页核心决策的"为什么 + 否了什么"（只取与跨 agent / 适配相关的面）。历史全文见 [归档/历史决策日志](../归档/历史决策日志.md)（以本节为准）。

<details>
<summary><strong>定位重述：从"可嫁接任意 agent"到"易分发 + 骑定 Claude Code"</strong></summary>

**背景**：本页旧版把"**可嫁接任意 agent** + L3 hook 可选优雅降级"当立身卡位。重估真实优先级后发现这是把**手段误当目的**——真正要的是 ① 开源可分发性高（本机直接玩到）② 低安装成本 ③ 开发成本可控，在此之上最大化塑形效果；为不需要的可移植性做工程反而牺牲效果与开发成本。

**决策**（落在本页的适配面）：
- **可移植不再是目标**。v1 **骑定 Claude Code 作 agent 基底**（原生 skill / hook / MCP / subagent，正是塑形要用的原语，§1/§2）。
- **core 产物（MCP / Skill / SQLite / 团本）保持标准、不锁死**；**交付机制（hook 注入、subagent 裁判、skill 装载）明确绑 Claude Code 且承重**（§3/§4）。
- **hook 从"可选 L3 优化"升为承重机制**——被动 rule 召回 + L3 审计都靠它（§3/§5）；**翻掉**旧"绝不让核心依赖某 agent 专属能力"红线（§5）。
- "可接入各种大模型"在**模型层**兑现（Claude Code 本身 model-agnostic、含国产），故窄绑一个 harness 不锁模型（§1/§6 轴二）。

**后果**：与 AI Dungeon 类闭环产品的实质区别仍在（开源、不自跑模型、core 标准可搬）。

**被否**：① 嫁接任意 agent（过度工程，hook 类塑形难跨 agent 承重）；② 自研 agent runtime（太重，违低开发成本）；③ 全 Claude 原生连 core 也焊死（未来换基底 / 多人远程代价大）。

</details>

---

## 7. 本页**不**负责定的

- hook 脚本（Node）、`.claude/` 目录结构、裁判 subagent、L3 审计实现 → [04 adapter 与 L3 审计](../04-子系统设计/adapter与L3审计.md)
- `dicelore` CLI / npm 包 / 一键安装的实现 → [04-子系统设计](../04-子系统设计/) / [技术选型 §6.1](技术选型.md)
- 玩家客户端（组件7）的编排契约 / UI / 分发壳 / 变更通知缝 详细设计 → [04 玩家客户端](../04-子系统设计/玩家客户端.md)
- 多人论坛形态的远程部署（Streamable HTTP）→ 已弃（[场景 B](../01-业务与定位/用户与场景.md)，2026-06-25）
