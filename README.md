<p align="center">
  <img src="docs/wiki/04-子系统设计/玩家客户端-视觉草图/dicelore-logo-dark.png" alt="Dicelore" width="440">
</p>

> 给 AI agent 套上的 **GM 行为塑形框架**——服务安科 / 安价（中文骰子 / 投票驱动的互动小说跑团），对抗 LLM 的讨好本能，让它当一个尊重骰子、不软着陆的诚实主持人。

**Dicelore** 不自己跑模型、不绑定某套规则、不做闭环产品，而是给一个主流、可换底层模型的 AI agent（v1 骑定 Claude Code）套上一层"让它当好游戏主持人"的框架。

## 预览 · 玩家客户端

> 完整独立的 web 玩家客户端（组件7）——VSCode 式可拖拽组件工作区,**「墨金」主题**(深墨绿 + 描金,可换肤 + 明暗双态 + 可选强调色)。下面是设计定稿草图(实现推进中)。

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

## 它解决什么

LLM 当 GM 有个根本毛病：**讨好玩家**。表现为三种可观测的失败——

- **F1 跳骰**：该掷骰时直接编一个对玩家有利的结果；
- **F2 软着陆**：把坏结果偷偷洗白、不让失败咬下去；
- **F3 替玩家选**：该让玩家决策时自己替选。

Dicelore 用**三层强制力冗余**把这些焊死：

- **L1 工具强制**：掷骰 / 随机 / 状态变更必须走工具，AI 绕不过；
- **L2 塑形教条**：Agenda → Principles → Moves 三段式 skill，教 AI 当好 GM；
- **L3 审计网**：事后抓违规。

权威游戏状态外置在 AI 够不到的 SQLite 里，分**四业务域**：`sheet`（人物卡 / 库存）· `event`（剧情事件）· `world`（世界设定 / 卡池）· `rule`（版本化只读规则）。

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

## 状态

开发中——内层能力库（骰子引擎、expr 求值、四业务域 store、FTS 检索）已在 `main`；MCP 工具面、Skills 包、adapter 等组件按 wiki 推进。

## 许可证

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

Dicelore 采用 **GNU Affero 通用公共许可证 v3.0 或更高版本（AGPL-3.0-or-later）** 开源——见 [LICENSE](LICENSE)。

> Copyright (C) 2026 MuLeiSY2021

AGPL 的要点：任何人都可以自由使用、修改、分发；**但只要你修改了 Dicelore 并通过网络向用户提供服务（例如架设在线跑团站点），你就必须把对应的完整源码一并公开。**

**双授权 / 商业授权**：上述 AGPL 条款约束的是社区使用者，**不约束版权持有人**。如果你希望在闭源 / 专有产品中使用 Dicelore 而不承担 AGPL 的开源义务，可联系 **MuLeiSY2021 <mulei_sy@qq.com>** 洽谈单独的商业授权。

## 贡献

欢迎贡献！提交 PR 即表示你同意：你的贡献将以与项目相同的 **AGPL-3.0-or-later** 授权并入。开发流程与约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。
