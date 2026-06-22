<p align="center">
  <img src="docs/wiki/04-子系统设计/玩家客户端-视觉草图/dicelore-logo-dark.png" alt="Dicelore" width="440">
</p>

<p align="center"><strong><em>A rose without thorns is too perfect to be true.</em></strong></p>

> 「虚拟太完美了，像一朵没有味道也没有刺的玫瑰。」

**Dicelore** 是 **agent 化的酒馆**——agentic 时代的角色扮演宿主。它把 AI 关进一个它改不了的世界，用骰子、外置状态和不讨好的诚实 GM，把「刺」（真正的对抗与后果）装回虚拟体验。

---

## 它在反抗什么

这句「虚拟太完美了，像一朵没有味道也没有刺的玫瑰」是我的一位朋友说的。她说出这句话的时候，我被狠狠打动了。

AI 有求必应，剧情永远顺遂——这不是服务好，这是失真。当成败来自 AI 的好意而非真正的随机，当失败总有台阶、坏结果总被悄悄洗白，玩家心里清楚：无论如何都不会真的输。风险感归零，「游戏」就退化成了「爽文」。

这个毛病不是某款产品做坏了，而是**提示词范式的结构必然**：状态活在 AI 的输出里，讨好本能就没有任何结构阻力——把再多世界书和指令塞进提示词，也无从阻止 AI 在关键时刻手下留情。（这个范式被 SillyTavern 等前辈做到了极致，也是 Dicelore 的灵感来源；我们要换的是范式本身，不是否定他们的工作。）

我相信 **agent 架构**是把「刺」装回去的那把钥匙：把状态外置在 AI 够不到的地方，把随机执行交给引擎，把 AI 关进一个它改不了的世界。于是我发起了这个开源项目。

诚实划界：Dicelore 只打「机制可信 / 有对抗」的赛道（安价 / TRPG / 有骰子的叙事游戏）。纯陪伴、角色拟真不是我们的战场——在那条赛道上，每加一层机制约束都是负担。

---

## 预览 · 玩家客户端

> agentic tavern 长这样——完整独立的 web 玩家客户端（组件7）：VSCode 式可拖拽组件工作区，**「墨金」主题**（深墨绿 + 描金，可换肤 + 明暗双态 + 可选强调色）。下面是设计定稿草图（实现推进中）。

![跑团页](docs/wiki/04-子系统设计/玩家客户端-视觉草图/play.png)

<p align="center"><em>跑团页：左活动轨 · 中央叙事/打字一体 · d10 掷骰 · 右「呈现台」(网格停靠面板) · 圆形 PbtA 倒计时钟</em></p>

<table>
<tr>
<td width="33%"><a href="docs/wiki/04-子系统设计/玩家客户端-视觉草图/home.html"><img src="docs/wiki/04-子系统设计/玩家客户端-视觉草图/home.png" alt="主页"></a><p align="center"><sub>主页 · 欢迎页</sub></p></td>
<td width="33%"><a href="docs/wiki/04-子系统设计/玩家客户端-视觉草图/build.html"><img src="docs/wiki/04-子系统设计/玩家客户端-视觉草图/build.png" alt="团本制作"></a><p align="center"><sub>团本制作 · 构建台</sub></p></td>
<td width="33%"><a href="docs/wiki/04-子系统设计/玩家客户端-视觉草图/config.html"><img src="docs/wiki/04-子系统设计/玩家客户端-视觉草图/config.png" alt="配置"></a><p align="center"><sub>配置 · MCP / 模型 / 主题</sub></p></td>
</tr>
</table>

<p align="center"><sub>设计语言与四页 IA → <a href="docs/wiki/04-子系统设计/玩家客户端-视觉.md">玩家客户端-视觉</a> · 可运行草图 → <a href="docs/wiki/04-子系统设计/玩家客户端-视觉草图/">视觉草图/</a></sub></p>

---

## 完美为何失真

LLM 当 GM 有个根本毛病：**讨好玩家**。表现为三种可观测的失败——

- **F1 跳骰**：该掷骰时直接编一个对玩家有利的结果；
- **F2 软着陆**：把坏结果偷偷洗白、不让失败咬下去；
- **F3 替玩家选**：该让玩家决策时自己替选。

这不是某个模型特别坏，而是提示词范式的体感终局：**状态活在 AI 的输出里，它想改就改，没有一本它够不到的账本**。

---

## 怎么把刺装回去

Dicelore 用**三层强制力冗余**把失败模式焊死：

- **L1 工具强制**：掷骰 / 随机 / 状态变更必须走工具，AI 绕不过；
- **L2 塑形教条**：Agenda → Principles → Moves 三段式 skill，教 AI 当好 GM；
- **L3 审计网**：事后抓违规。

权威游戏状态外置在 **AI 够不到的 SQLite** 里，分四业务域：`sheet`（人物卡 / 库存）· `event`（剧情事件）· `world`（世界设定 / 卡池）· `rule`（版本化只读规则）。

| | 提示词范式 | Dicelore（agentic） |
|---|---|---|
| 状态住哪 | AI 的输出里（context） | AI 够不到的 SQLite |
| 谁掷骰 / 取数 | AI 自己写个数字 | 引擎执行，AI 只给引用 |
| 世界查询 | 关键词触发整段注入 | 结构化检索（按需拉） |
| 加一项能力的代价 | context 变胖、token 涨 O(能力数) | 多一个工具，context 不涨 O(1) |
| 反 F1/F2（防跳骰/软着陆） | 靠 AI 自觉（结构上无法阻止） | 结构上 AI 拿不到真值 |

**提示词范式把世界塞进上下文，Dicelore 把 AI 关进一个它改不了的世界——这是代际差，不是优化差。**

---

## 现在能玩什么

- **现在可玩**：装好 Claude Code（可接各种大模型，含国产）+ `dicelore` CLI，本机一键脚手架即可跑**单人安价**——框架强制掷骰/给选项、维护人物卡与剧情状态，AI 据结果叙述且不软着陆。
- **在建中**：不依赖 Claude Code TUI、用 Claude Agent SDK 程序化驱动的**全栈玩家客户端**（自建后端 + 墨金主题 web 前端）。进度见 [里程碑](docs/wiki/06-里程碑与问题/里程碑.md)。

---

## 技术栈

- **TypeScript** + **better-sqlite3**（权威状态外置）
- **MCP**（`@modelcontextprotocol/sdk` v1.x + Zod v3）：内层能力库包成一组 `dicelore_*` 工具
- FTS5 + jieba 中文全文检索（trigram 零依赖保底）

## 开发

```bash
npm install              # 安装依赖
npm test                 # 运行测试（vitest）
npm run typecheck        # 类型检查
npm run dicelore -- new <团名>   # CLI：建 / 开一局会话
```

会话存档：平台 app-data 目录下 `dicelore/sessions/<名字>.db`，环境变量 `DICELORE_SESSIONS_DIR` 可覆盖根目录、`DICELORE_SESSION` 指定缺省会话名。

## 文档

设计 wiki 见 [`docs/wiki/`](docs/wiki/)：业务分析 → 领域模型 → 架构 → 子系统设计 → 决策记录（ADR）。玩家客户端的视觉设计与四页 IA 见 [玩家客户端-视觉](docs/wiki/04-子系统设计/玩家客户端-视觉.md)。

---

## 状态

开发中——内层能力库（骰子引擎、expr 求值、四业务域 store、FTS 检索）已在 `main`；MCP 工具面、Skills 包、adapter 等组件按 [里程碑](docs/wiki/06-里程碑与问题/里程碑.md) 推进。

---

## 许可证

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

Dicelore 采用 **GNU Affero 通用公共许可证 v3.0 或更高版本（AGPL-3.0-or-later）** 开源——见 [LICENSE](LICENSE)。

> Copyright (C) 2026 MuLeiSY2021

AGPL 的要点：任何人都可以自由使用、修改、分发；**但只要你修改了 Dicelore 并通过网络向用户提供服务（例如架设在线跑团站点），你就必须把对应的完整源码一并公开。**

## 贡献

欢迎贡献！提交 PR 即表示你同意：你的贡献将以与项目相同的 **AGPL-3.0-or-later** 授权并入。开发流程与约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。
