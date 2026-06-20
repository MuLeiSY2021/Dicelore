# Dicelore

> 给 AI agent 套上的 **GM 行为塑形框架**——服务安科 / 安价（中文骰子 / 投票驱动的互动小说跑团），对抗 LLM 的讨好本能，让它当一个尊重骰子、不软着陆的诚实主持人。

**Dicelore** 不自己跑模型、不绑定某套规则、不做闭环产品，而是给一个主流、可换底层模型的 AI agent（v1 骑定 Claude Code）套上一层"让它当好游戏主持人"的框架。

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

设计 wiki 见 [`docs/wiki/`](docs/wiki/)：业务分析 → 领域模型 → 架构 → 子系统设计 → 决策记录（ADR）。

## 状态

开发中——内层能力库（骰子引擎、expr 求值、四业务域 store、FTS 检索）已在 `main`；MCP 工具面、Skills 包、adapter 等组件按 wiki 推进。
