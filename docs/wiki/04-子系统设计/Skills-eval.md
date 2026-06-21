# Skills eval-loop（gm-core 定向优化蓝本）

> **本页职责**：定 `dicelore-gm-core`（及流程 skill）的**定向优化方法与工装**——以**真实安价语料**为黄金标准、用可跑的 eval-loop 量化迭代 skill 措辞。这是 [Skills包 §6.1](Skills包.md) 「措辞终稿靠 eval-loop」的落地蓝本，**未来每轮 skill 迭代以此为据**。
> **上游依赖**：[Skills包 §6.1](Skills包.md)（F1/F2/F3 可客观验证 → L3 信号复用作 assertions）；[总体架构 §6 三流](../03-架构/总体架构.md)（玩家视图＝narrate 流 + 输出层面板）；[adapter §4 L3 两档](adapter与L3审计.md)；skill-creator（评测循环 / 反过拟合 / with-without baseline）。
> **状态**：🟢 工装已落源码（2026-06-21，`packages/core/{src/present/playerView,src/eval/assertions,eval/*}`）。语义/对标真人的 grader 为规格 + 人/LLM 执行。

---

## 0. 立场：把「好」锚定在真人安价实践上

gm-core 不是单次任务 skill——它的「输出」是**一整局多回合跑团**（工具调用 + narrate + 裁决）。所以 eval 不照 skill-creator 的「单 prompt → 评一次输出」，而是：**脚本场景驱动真 GM → 抓 .db/transcript → 玩家视图 + 两层评分**。其中评分的**黄金标准是 [真实安价语料](../../research/scraped/)**（兽人冒险 / 抽卡 / 恶龙团 三真串）——优化的「好」不是我们拍脑袋的断言，是**真人 GM 怎么跑这局**。

> **关键耦合澄清**：eval 跑分底座 = **裸 CC harness**（组件2 MCP + 组件4 三 hook，均已合并），**不依赖组件7 orchestrator**。唯一例外：**narrate 泄漏**的「正确行为」取决于组件7 渲染契约（玩家看 narrate 流、不看 GM raw 正文）——本 eval 用 `buildPlayerView` **mock 这个契约**（玩家视图只认 narrate + 面板），故 narrate 泄漏也能在裸 CC 上量化、不必等组件7。

---

## 1. 玩家视图（评分基准 = mock 组件7 渲染契约）

`buildPlayerView(db)`（[`src/present/playerView.ts`](../../../packages/core/src/present/playerView.ts)）= 玩家**应该看到的全部**：

```
PlayerView = {
  narration: 可见 narrate + reveal event（流① 剧情/披露，按 seq）,
  panel:     buildPresentationModel（流② 机械回显 + 状态菜单 + 待选项/待掷）,
}
```

**不含** GM 的 raw 聊天正文（流③只回 AI）、暗值/隐藏。这既是 eval 的评分基准，也是**组件7 将来该实现的渲染契约**（[玩家客户端-接口](玩家客户端-接口.md)）。判「玩家体验」只看 PlayerView；正文只用来抓泄漏/绕过。

---

## 2. 两层评分

| 层 | 工装 | 判什么 | 性质 |
|---|---|---|---|
| **① 机械断言（地板）** | [`src/eval/assertions.ts`](../../../packages/core/src/eval/assertions.ts) + [`l3.auditTurn`](adapter与L3审计.md) | **narrate 泄漏**（正文复述剧情＝玩家看不到+烧 token）、**漏 narrate**、**工具画像**（narrate/choice/mutation/**明骰 vs 暗骰** 计数）、F1 时序 | 客观、确定性、零 LLM、单测覆盖 |
| **② 参考式定性（核心）** | [`eval/grader.md`](../../../packages/core/eval/grader.md) | 对标 `scenario.reference` 的**真人 GM 黄金做法**：F3 该选vs该骰、F2 软着陆、明暗骰选对、可见性不泄漏、与真人质量差距 | 语义、人/LLM、产 `skill_fix_hints` |

机械断言是兜底地板；**grader 是主职**——拿真人语料桥段当 gold standard，judge 我们的 GM 差在哪、给 gm-core 措辞的具体改建（反过拟合）。

---

## 3. 场景（各带语料 reference）

[`eval/scenarios/*.json`](../../../packages/core/eval/scenarios/)，每个 = 种子（rules/sheets/tone）+ `playerTurns`（脚本玩家输入）+ **`reference`**（指向真串桥段 + `note`＝真人黄金做法）+ `focus`（重点失败模式）：

| 场景 | 语料 | 重点 |
|---|---|---|
| `orc-hunt` | 兽人冒险 | r 六维 / 方向 choice / 猎物随机表 / 玩家攻击明骰；F1·F3·明暗骰 |
| `gacha-draw` | 抽卡 | d100 品质 / world_sample / 融合检定；F1·明暗骰·不剧透 |
| `dragon-severity` | 恶龙团 | 坏结果照后果硬着陆 + fail-forward / 事先声明烈度；**F2 软着陆** |
| `explore-bargain` | 恶龙团 | 侦查 reveal / 安全vs冒险买入 / 压价对抗；F3·可见性·明暗骰 |

---

## 4. 工装与跑法

- [`eval/run.ts`](../../../packages/core/eval/run.ts)：场景就绪器——灌种子 + `dicelore init` 临时项目 + 重写 `.mcp.json` 指本地 tsx（未发布期）+ `--baseline`（去 gm-core 作对照）+ 打印全流程。
- 驱动 GM（择一）：手动 `claude` 逐条贴 `playerTurns`；或 headless `claude -p`（多回合 `--resume` 串，确切 flag 实现期核实）。
- [`eval/grade.ts`](../../../packages/core/eval/grade.ts)：对捕获的 `.db`（+ `--transcript`）跑 playerView + 机械断言 → 报告。**立即可跑**（可直接评既有 harness 会话）。
- grader（[`eval/grader.md`](../../../packages/core/eval/grader.md)）：把 grade 报告 + 玩家视图 + transcript + 对应语料桥段，喂 LLM/人 → 定性裁决 + `skill_fix_hints`。

**一轮 loop**：`run.ts`（with / baseline 各一）→ 驱动 GM → `grade.ts` → grader 对标语料 → 据 `skill_fix_hints` 改 gm-core 措辞 → 重跑比较，直到接近真人 GM。**with/without baseline** 证明 skill 增量价值。

---

## 5. 边界与未来

- **裸 CC 底座、零碰组件7**：F1/F2/F3/明暗骰选对/可见性/narrate 泄漏 全可现在测（明骰玩家点击全流程除外——那要组件7 roll-gate，但「该明该暗」的工具选择从 event 即可判）。
- **narrate 泄漏措辞终稿**：行为对错由 `buildPlayerView` 已固化（玩家只见 narrate）；最终 skill 措辞与组件7 渲染契约对齐后收口。
- **措辞 eval-pending**：gm-core 现有措辞均待本 loop 迭代定稿（[Skills包 §6.1](Skills包.md)）。
