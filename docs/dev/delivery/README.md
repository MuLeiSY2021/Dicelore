# docs/delivery —— 并发路线图交付的运行记录

> 本目录由 [`roadmap-delivery-workflow`](../../.claude/skills/roadmap-delivery-workflow/SKILL.md) skill 产出与维护。
> 这里存的是**每一轮「推路线图」的事后可回溯记录**——和 [`docs/todo/`](../todo/)（在途交接·解决即删）性质不同，**长存、不随波结束删除**。

## 一轮一个目录

每次「推一轮路线图」开一个目录，名 `YYYY-MM-DD-路线图-推进/`（日期取起手那天）：

```
docs/delivery/2026-06-26-路线图-推进/
├── delivery_dag.md        # 本轮 DAG 设计:全图依赖 + 谁任务量过大要拆 + 分几波·每波几个 subagent + 热点文件冲突分析
├── decisions-pending.md   # 决策账本(可逆自决 / 不可逆攒批问用户 / 实现中浮现),跨波长存
├── wave_1_nodes.jsonl     # 第一波 roster:这波哪些 subagent 在跑(一行一节点,发波即冻结)
├── wave_1_summary.md      # 第一波复盘:推进了哪些 / subagent 撞到啥问题 / 编排者如何决断
├── wave_2_nodes.jsonl
├── wave_2_summary.md
└── …
```

## 三类文件，三种生命周期（别混）

| 文件 | 是什么 | 何时写/改 |
|------|--------|-----------|
| `delivery_dag.md` | **设计稿**：整轮怎么打（全图、谁太大要拆、怎么分波、热点文件冲突表） | 起手想清；运行时浮现的依赖修正回写。是计划，不是台账。 |
| `wave_N_nodes.jsonl` | **每波 roster**：第 N 波派出去的 subagent 清单（id/owns/depends_on/hotspot） | 派该波时写定，**发波即冻结**，下一波另起 `wave_{N+1}_nodes.jsonl`，不回头改。随派单发给本波每个 subagent。 |
| `wave_N_summary.md` | **每波复盘台账**：合了哪些 / subagent 撞到啥 / 编排者如何决断 | 该波合完才写。给下一轮编排回看，避免重蹈。 |

`wave_N_nodes.jsonl` 就是 `nodes.jsonl` 的本来用途——**「这一波谁在跑」的快照**，不是一张被原地反复改 `status` 的全局图。「哪些已合、推到哪一波」看各 `wave_N_summary.md`，不靠在 jsonl 里翻字段。

## 和 wiki 的分工

`wave_N_summary.md` 记**本轮交付的过程**（当时怎么权衡的、subagent 撞了啥）；wiki 记**项目的权威结论**（去过程化、决策最终是什么）。决策的「当时怎么权衡」进 summary，决策的「最终是什么」进 wiki(对应设计页「决策与权衡」节)。

## 和 `docs/dev/` 其他兄弟目录的分工

`docs/dev/` 下 `delivery/` 只管**交付批次运行记录本身**(一轮一目录、跑完即成历史,见上文);现状追踪(`plan/`，长存)、验收测试记录(`tdd/`)、在途交接(`todo/`)、eval 原始报告(`reports/`)是平级的兄弟目录，各自独立生命周期，不要把"delivery"泛化成整个 `docs/dev/` 的代称。
