# 04-子系统设计 TODO（已归档 → 06）

> **本页已归档（2026-06-21）**。原为「每页填充进度 + 已 locked 决策账本」草稿，内容已沉淀：
> - **已接受决策** → 对应设计页「决策与权衡」节；
> - **设计正文** → 04 各正式页（内层能力库 / MCP工具面 / Skills包 / adapter与L3审计 / 团本与manifest / 团本构建工具链 / 玩家客户端*）；
> - **未结 / 在途 / 未来项** → [05-现状与计划 · 问题总账](../05-现状与计划/问题总账.md)。
> 保留本页仅为不断旧链（含下方 resolver 二轴速查）。**新内容勿写这里**，进 06。

## resolver 二轴速查表（[MCP工具面](MCP工具面.md) 引用落点；权威概念见 [核心概念 §3](../02-领域模型/核心概念.md)）

resolver = 把未定局面产出一个「叙述者无法伪造」的结果并推动剧情（落 event / 可能写 sheet）。团本特有的只是参数/数据，不长新工具：

| 选择者＼结果形状 | **label** | **verdict** | **number** | **content** |
|---|---|---|---|---|
| **玩家选** | `resolve_choice` | — | — | —（挑卡＝choice 变体） |
| **随机选** | `resolve_outcome`（档位） | `resolve_contest`（比表达式；**DC＝比常数**） | `sheet_update` 带骰（状态骰下沉） | `world_sample`（卡池） |

> DC 不是独立 judge，是 contest 一边退化成常数；number 形状＝`sheet_update` 带骰；卡池抽＝`world_sample`。明/暗骰二轴（`_open`/`_hidden`）见 [MCP工具面](MCP工具面.md) 决策节。

## 各组件沉淀落点（历史索引）

| 组件 / 主题 | 现落点 |
|------------|--------|
| 组件1 内层能力库 | [内层能力库.md](内层能力库.md)（决策见其「决策与权衡」节） |
| event/watcher schema、timer→watcher | [内层能力库.md](内层能力库.md)（决策见其「决策与权衡」节） |
| 组件3 Skills 包 | [Skills包.md](Skills包.md)（决策见其「决策与权衡」节） |
| 工具面（前缀/裁决族/mutation/可见性工具/契约） | [MCP工具面.md](MCP工具面.md) |
| 团本构建台（组件5/6） | [团本与manifest.md](团本与manifest.md) / [团本构建工具链.md](团本构建工具链.md)（决策见各页「决策与权衡」节） |
| PbtA 对齐 + Agenda + Front/Clock | [Skills包.md](Skills包.md)（决策见其「决策与权衡」节） |
| 组件4 adapter + L3 + 输出层 | [adapter与L3审计.md](adapter与L3审计.md)（决策见其「决策与权衡」节） |
| 玩家闸控明骰（后端引擎侧） | [MCP工具面.md](MCP工具面.md)（决策见其「决策与权衡」节） |
| Skills eval-loop 工装 | [Skills-eval.md](Skills-eval.md) |

## 未结 / 在途项（已迁 06）
组件5/6 实现（import 未起，eval 暂手搓富种子）/ 组件7 剩余（快照串 UI、Phase 2 实时引擎面）/ 明骰组件7 线 / eval-loop 留项 / adapter 留下游 → [问题总账 P4·P5](../05-现状与计划/问题总账.md)。
