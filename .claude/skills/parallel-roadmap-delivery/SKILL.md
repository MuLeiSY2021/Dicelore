---
name: parallel-roadmap-delivery
description: Dicelore 路线图的「并发编排」上层 skill。当用户要「一路推进路线图 / 尽量别问我 / 把这几批做完」、且有多条无依赖的线可同时推时用。在 [autonomous-delivery-loop](../autonomous-delivery-loop/SKILL.md) 单线闭环之上加：可逆性判据(决定哪些卡点自己拍、哪些攒着批量问用户)、把路线图递归分解成沿文件缝切的原子节点(落 nodes.jsonl DAG)、按依赖就绪派发 subagent(出生即就绪不 await)、subagent 自主交付一条线(自写 spec/plan + push 自己分支 + 开 PR + 缺依赖就问不自造)、编排者检查 PR(CI 绿+diff+契约)通过才合并并释放下游。单线或纯串行依赖链不要用本 skill——退回 autonomous-delivery-loop,别套并发开销。
---

# 并发路线图交付（parallel-roadmap-delivery）

[autonomous-delivery-loop](../autonomous-delivery-loop/SKILL.md) 把**一条线**从差距分析推到合并。但当用户说「别老问我、一路推下去」时，真正卡住推进的不是某条线本身——是**每条线撞到决策点就回头问人**。这个 skill 解决的就是这件事：让编排者管多条线并行，并且**自己消化掉绝大多数决策**，只在真正不可逆的地方才打扰用户。

**它不追求「零卡点」**。业界 spec-driven 工具（GitHub spec-kit 的 `/clarify`、Kiro、BMAD）都试过「实现前一次性问清所有歧义」，但 Martin Fowler 实测的结论是：消不掉——因为非确定性、以及「只有写到那里才暴露的歧义」（比如某个写操作撞上 DSL 表达力天花板）是 LLM 编码的固有属性，任何前置规划都抓不到。所以本 skill 的目标是**把打扰频率压到最低**，而不是归零：可逆的全自己扛，不可逆的攒成一批问，浮现的边做边判。

## 何时用 / 何时不用

- ✅ 用户要「推进路线图 / 别老问我 / 把这几批做完」，**且有 ≥2 条无依赖的线**（如后端 fix + 前端 fix + e2e）能同时推。
- ❌ 单条线、或全是串行依赖链 → 用 [autonomous-delivery-loop](../autonomous-delivery-loop/SKILL.md)，并发开销不划算。
- ❌ 纯机械批量改（改名等无新行为）→ 正则替换 + 测试兜底（教训 `[机械改名用正则]`），别上这套。

## 流程总览

```
扫路线图 → 决策账本 ── 可逆的：自己拍，记默认值
                    └ 不可逆的：攒一批 → 一次 AskUserQuestion → 用户拍
   ↓
DAG 分解：把路线图项拆成沿缝切的原子节点 → 写 nodes.jsonl（每节点:产出哪个PR/依赖哪些PR/独占哪些文件）
   ↓
按依赖派发（编排者攥 DAG，节点的依赖 PR 全合了才派它——出生即就绪，不 await）：
   编排者开 worktree + 派 subagent（带上 nodes.jsonl，它知道自己的上下游）
        ↑ 小歧义 SendMessage 塞回决策（subagent 不死、零文档）
        ├ 缺依赖 → 停、问编排者（绝不自造）→ 等那个 PR / 修 DAG
        └ 大歧义 → 写 PROGRESS.md 兜底 → 等用户裁 → 接力
   ↓
   subagent 自交：push 自己分支 → gh pr create → 报「PR #N 待检」→ 返回（不自合、不碰 main）
   ↓
   编排者检查（CI 绿 + diff 审 + 契约符合）→ 通过才 gh pr merge → 释放下游 → 沉淀 wiki
   ↓
下一批就绪节点（实现中浮现的不可逆决策 → 攒进账本，下个 checkpoint 一起问）
```

记住一条贯穿全程的分工：**编排者管「跨线的事」（分解、决策、派发、检查、合并、问用户），subagent 管「一条线内的事」（设计、写码、自测、push 自己分支、开 PR）**。合并权独占在编排者——那是质量闸，也是用户的信任边界。下面每节都是这条分工的展开。

## 灵魂：可逆性判据——决定一个卡点该不该打扰用户

这是整个 skill 能成立的根。遇到任何决策点，先问一句：**「这决定错了，撤回代价大吗？」** 答案决定动作：

| 决策的可逆性 | 典型 | 动作 |
|---|---|---|
| **可逆**：错了改回来很便宜 | 内部 schema、实现选择、命名、测试设计、纯加法 | **选最合理的默认，记一笔，继续——不问** |
| **混合**：一部分无悔、一部分是权衡 | SSRF 防护（挡私网 IP 段=纯安全无悔；放行哪些外部 host=产品权衡） | **先交付无悔的那半**，只把不可逆的残余攒进账本 |
| **不可逆**：错了影响用户能做什么、或撤回伤筋动骨 | 产品范围、承重架构、外部可见行为、计费、多租户、安全策略边界 | **攒进账本，不停下**，继续做不依赖它的活 |

为什么这条是灵魂：上一轮真实复盘发现，6 个「卡点」里只有 1 个真不可逆，其余要么纯技术（自己就能判，比如「这是不是死代码」「撞没撞天花板」），要么有无悔子集。**把可逆的也拿去问用户，就是不必要的打扰**。判据的作用就是把「凭直觉停下」换成「按可逆性决定停不停」，阈值显式调高。

> 注意「攒，不是停」。攒进账本继续干别的，而不是停在原地等。技术歧义自己消化，只有牵出**新的产品决策**时才进账本。

## 决策账本：把「每次卡」压成「卡一次大的」

**起手第一件事**，扫一遍路线图剩余项 + 三个 backlog 池，产出 `docs/todo/decisions-pending.md`：

```markdown
# 决策账本（YYYY-MM-DD 扫描）
## 可逆（已自决，记默认值供回溯，无需用户）
- [token 归因维度] 取 per-turn + per-agent 双采。理由：raw log 已有 usage，双维成本低。
## 不可逆（攒着，一次问用户）
- [ ] 快照 v1 是否开放回滚 UI？无悔地基（snapshot 表 + checkpoint 原语）我先建；开不开放=产品决策。
- [ ] 多租户 key 后端托管方案？（ADR-0027 草案待用户复核）
## 实现中浮现（subagent 干活时回报，可逆即自决回填、不可逆攒下一批）
```

不可逆项攒够一批，**一次** `AskUserQuestion` 问完（推荐项排第一、标 Recommended）。用户拍完，回填账本 + 落 ADR/backlog。**这一步就是 spec-kit `/clarify` 的等价物，但只问真正不可逆的那几个**，不是把所有歧义都堆给用户。

这一步也划定了 spec/plan 的边界：**不全量前置写 spec/plan**。Fowler 实测过那个坑——给 47 个路线图项全写 spec，产出的文档量比代码还大，大半在实现时返工，评审还过载。只对「已裁决 + 当批要做」的线写，而且交给做那条线的 subagent 自己写（见下）。

## DAG 分解：把路线图项拆成「沿缝切的原子节点」

路线图上一项不是一个节点——它本身是个子 DAG（改 schema → 实现 → 业务级测试 → 文档）。把这些子 DAG 摊平，让全局 DAG 的叶子都是「一个小 PR = 一个 subagent 的小负担」。节点越原子，subagent 上下文越轻、PR 越好审、并行度越高——这就是几十个 subagent 同时铺开的来源。

但「越细越好」有三条会反咬的前提，分解时必须守：

**① 沿文件/模块的缝切，不是凭感觉切细。** 「拆细 → merge 简单」只在**兄弟节点不碰同一文件**时成立。反例：把一个 feat 拆 5 个 PR 但都改 `server.ts`——你没让合并变简单，你制造了 5 次冲突。所以分解的第一约束是**给每个节点划清文件归属、兄弟节点文件不重叠**。这需要全局视角，所以**分解只能编排者做**，单个 subagent 看不到别人动哪些文件、无法自己拍粒度。

**② 测试节点分两种，只有一种能独立拆出去。**
   - **TDD 单测**（红-绿-重构）→ **不能拆**，和实现同节点。红绿循环要在同一上下文里看着测试和实现一起长，拆开就断了。
   - **对抗性/业务级/集成测试** → **能且应该**拆成下游独立节点（依赖实现节点先合）。这正是 autonomous-delivery-loop 第⑥步「另起 subagent 从外部视角补业务用例」——换个脑子才有对抗性。
   你说的「测试需求拆测试 PR」指的是第二种。

**③ 别拆过头——合并+检查是串行的，给粒度设了地板。** 写能并行，但「检查 PR + 合并」串行（合并权独占在编排者）。拆 50 个原子节点 = 50 次串行检查合并，编排开销会超过节点本身的活。**缓解**：CI 在每个 PR 上自动跑 `test:all`，编排者的检查主要看 diff + 契约（不必每次手动重跑全量测试）；真正贵的是「人审 diff」，所以**节点要小到 diff 一眼能审完**，而不是小到无意义。

分解产出一张 **DAG，落成 `docs/todo/nodes.jsonl`**（一行一个节点）：

```jsonl
{"id":"n1","title":"视图层投影","produces":"PR-view-layer","depends_on":[],"owns":["packages/core/src/store/views.ts","...views.test.ts"],"status":"ready"}
{"id":"n2","title":"业务工具声明+接线","produces":"PR-toolgen-wire","depends_on":["n1"],"owns":["packages/core/src/mcp/stdlib/*","...toToolDef.ts"],"status":"blocked"}
{"id":"n3","title":"叙事工具业务级测试","produces":"PR-narr-tests","depends_on":["n2"],"owns":["...dogfooding.test.ts"],"status":"blocked"}
```

**这张 jsonl 随派单一起发给每个 subagent**——不只是编排者自己看。为什么给 subagent 全图：它干活中「发现缺东西」时，能先自查「我缺的是不是 `n7` 的产出？」——如果是，它知道这不是该自己造的、而是个已知上游，上报时能直接说「我依赖 n7、它还没合」，编排者裁定更快。没有全图，subagent 只能看到自己的 `owns`，缺了东西分不清「该自己加」还是「别人正在做」，就会去重复造。`status` 字段由编排者随合并推进维护（`blocked`→`ready`→`in_flight`→`merged`），是调度的真相源。

## 调度：按依赖派发，节点「出生即就绪」——不要 await

经典 DAG runner（Airflow、CI）让节点自己 `await` 上游，因为没人看着。**但这里有智能调度器——就是编排者，而且后台 subagent 完成时编排者会自动收到通知被唤起。** 所以不要让 subagent shell-await 上游 PR：

- **会撞墙**：Bash 单次调用上限 10 分钟，上游 PR 合得慢，await 循环会被杀，或跨回合空转烧 context、白占一个并发槽（总共才 ~10-16 个）。
- **没必要**：编排者攥着依赖图，**某节点依赖的 PR 全合并了，才派这个节点的 subagent**。它一启动，依赖已经在 main 里——**永远不需要等**。同样的依赖序、同样的并行度，但零空转、不撞墙、决策也好注入（没有 head-down 卡在 await 里的 subagent）。

**派出去的 subagent 得到（编排者只给边界、不给 plan）**：要达成什么、验收口径、已拍板的不可逆决策（从账本抄）、**独占哪些文件**、依赖的 PR 已在 main（所以放心用）。然后 subagent **自己** brainstorm → 写 spec/plan → TDD 实现。

> **为什么 spec/plan 归 subagent 自己写**：plan 的价值是「给执行者的契约」，而 subagent 就是执行者。编排者隔空写一份再传过去，等于把「想清楚的人」和「照着做的人」切成两个上下文、必有损耗，还掉进 spec-kit「前置规划→返工」的坑。产 plan 的和用 plan 的是同一个 agent，plan 才在为实现服务。

## subagent 自交付：开发 → push 自己分支 → 开 PR → 报告

每个 subagent 在自己 worktree 里走完 [autonomous-delivery-loop](../autonomous-delivery-loop/SKILL.md) 的设计→实现→自测，然后：

1. `git push` **自己的分支**（不是 main）→ `gh pr create` 开 PR。
2. 报告「PR #N 待检」给编排者，**返回**。**不自己合、不碰 main、不 await 别人。**

**两条会浮现的情况，subagent 必须停下问编排者、不许自己解**：
- **缺依赖**（写到一半发现要的东西还没有）→ **停、上报、绝不自己造**。自己造 = 和另一条线重复造同一个东西、两个 PR 撞车。编排者裁定：要么「那是 PR #7，我等它合了再让你继续」，要么「好发现，这是新节点，我派人做、你这条依赖它」——这就是**运行时 DAG 修正**（有些依赖只在写码时才浮现，前置分解抓不到）。
- **不可逆/跨线歧义** → 上报。可逆的线内歧义自己拍、攒成批。

**subagent 能碰的 git 只有「push 自己分支 + 开 PR」这个最小集**——各推各的 ref，零竞争，不碰共享的 main/worktree 注册表。这是 memory 铁律 `[禁止 subagent 碰 git]` 的**精确化**（不是推翻）：合并权、main、worktree 注册表仍独占在编排者。**记得据此更新那条 memory。**

**决策怎么回到 subagent**：
- **小歧义**（编排者秒判）→ subagent `SendMessage` 问 → 编排者 `SendMessage` 塞回 → 它接着干，**全程活着、零文档**。这是默认路径。
- **大歧义**（要等用户裁、窗口可能几小时）→ subagent 写 `PROGRESS.md`（已改文件/改到哪/卡在哪/裁决后下一步）后返回；用户裁完，编排者起新 subagent 靠它接力。**PROGRESS.md 只是长等待/意外退出的兜底，不是日常。**

## 编排者检查 + 合并：质量闸 + DAG 推进

PR 给编排者**检查，通过才合**——这是合并权独占在编排者的意义，也是人类信任边界（用户最终面对的是 main）。三关：

1. **CI 绿**：`gh pr checks <N>` —— `test:all` + `typecheck:all` 必须过。CI 是自动闸，省掉编排者手动重跑全量。
2. **diff 审查**：范围对不对、有没有越界改别条线的文件、有没有 stub/假实现。可挂 `requesting-code-review` / `/code-review`。
3. **契约符合**：达成了派单时的验收口径（含 web 改动走 `/webapp-testing`）。

三关过 → `gh pr merge`（顺序由依赖图定，后合的 PR 若 main 已动需 rebase——沿缝切则自动干净，真撞了让那条 subagent 自己解，它最懂自己的改动）。**合并即释放下游**：被它满足的节点现在「就绪」，编排者派下一批。

不过关 → `SendMessage` 打回还活着的 subagent 改（已返回则接力）。

**合并后编排者收尾**（这部分仍是编排者的活，不下放）：沉淀 wiki（现状 🚧→✅、关 backlog 条目、勾路线图、spec/plan 整套落地才清）。**subagent 调查中的现状结论也要沉 wiki**，别只留在 PR 描述里（教训 `[调查要沉淀进wiki]`——反复漏的点）。

> 编排者的 git 操作仍守：`--no-pager`（否则 less 卡死会话 `[git pager 卡死 Bash]`）。`gh pr merge` 用 GitHub 串行化 main、各分支零竞争——这正是「subagent 能自己 push」成立的前提（推的是各自的 ref，不是同一个 main）。

CI 一身三任：每个 PR 的自动闸、合并前置、发版闸 gate 载体（`.github/workflows/ci.yml` 已建）。

## 与单线 skill 的边界（单源）

本 skill 只定「多线怎么并、卡点怎么不打扰人」。**一条线内部的流程**（差距分析 → 落 backlog → 设计 → 实现 → 验收 → 沉淀）权威在 [autonomous-delivery-loop](../autonomous-delivery-loop/SKILL.md)，这里不复述。subagent 跑的就是那一套。改单线流程改那个 skill，别在这另起一套。
