---
name: roadmap-delivery-workflow
description: Dicelore 路线图/里程碑交付与 wiki 维护的统一上层 skill——调用后主 agent 不手搓派发,而是编写并运行一个 Workflow 脚本跑并发交付。当要「推进里程碑/路线图、整理前端(frontend)或后端(backend)架构、修 wiki 内容问题(链断/单源违例/设计-实现漂移)、重排 wiki 结构、沉淀 spec 进 wiki、把这几批做完、尽量别问我」时用。六个旧独立 skill(advance-milestone/refactor-frontend/refactor-backend/fix-wiki-issues/organize-wiki/spec-to-wiki)已全部并入本 skill,按需求挑 references/ 差异点文档。三段式:阶段1(交互)决策账本+一次问完不可逆决策+按需求切 DAG(一需求一节点,不按文件),工件落 docs/delivery/<本轮>/(delivery_dag+decisions-pending+每波冻结 wave_N_nodes.jsonl+wave_N_summary,长存);阶段2(后台 Workflow)对一个就绪波次 pipeline 每节点[worktree 隔离实现跑 a→g→对抗测试→自验],缺依赖/不可逆决策一律冒泡;阶段3(交互)逐节点检查通过才合进本地 main(文件重叠的冲突主 agent 集成时解)+写 wave_N_summary,释放下游起下一波;**wiki 沉淀+删裁决集中到全 DAG 跑空后的「最终收尾阶段」一次做,不分散到每波**(跨波裁决分波沉会写一半、且撞后续波热点页)。合并权独占主 agent,不 push。下层 a→g 闭环作每个 implement agent 的 prompt 内核,也可单线单独跑。
---

# 路线图交付工作流（roadmap-delivery-workflow）

**调用本 skill 后，主 agent 不亲自用 Agent 工具一个个派 subagent，而是编写并运行一个 Workflow 脚本来跑整套并发交付。** skill 本身仍是一份指导：它告诉你怎么把路线图拆成波次、怎么把一个波次写成 Workflow 脚本、跑完怎么检查合并。

本 skill 含**两层**，单源都在这一份里：

- **上层·编排执行（Workflow 化）**：把「分解 → 派发 → 实现 → 测试 → 自验」这段**机械、可并行、吃 token 的中段**交给一个后台 Workflow 确定性地跑；把「问用户 → 检查 → 合并 main → 沉淀」这段**需要人类信任边界**的两头留在交互的主 agent 手里。
- **下层·一条线内部怎么干**：单条交付线的 **a→g 自主交付闭环**（见文末「一条线内部怎么干」节）。它作为每个 Workflow `implement` agent 的 prompt 内核被引用；**也可脱离 Workflow、当单线自主闭环单独跑**（只跑 a→g）。

**为什么用 Workflow 而不是主 agent 手搓派发**：主 agent 的上下文是稀缺资源——它要装下整张 DAG、跨波决策、所有节点的检查状态。手搓 fan-out 时，每个 subagent 的实现细节、SendMessage 往返都挤进主 agent 上下文，几十条线一铺开就爆。Workflow 把 fan-out + 实现 + 测试 + 自验隔离进后台脚本里确定性执行（`pipeline`/`parallel` 原生表达依赖与并发、每个 `agent()` 的实现上下文互不污染），主 agent 只在脚本跑完拿回**结构化结果**做检查与合并。**确定性 + 并行 + token 规模都归 Workflow，人类信任边界归主 agent**——这就是改造的全部要点。

**它不追求「零卡点」**。业界 spec-driven 工具（GitHub spec-kit 的 `/clarify`、Kiro、BMAD）都试过「实现前一次性问清所有歧义」，但 Martin Fowler 实测的结论是：消不掉——非确定性、以及「只有写到那里才暴露的歧义」是 LLM 编码的固有属性，任何前置规划都抓不到。所以本 skill 的目标是**把打扰用户的频率压到最低**：Workflow 内 agent 解不了 / 浮现不可逆决策就冒泡回主 agent，主 agent 能定的（可逆）自己定，定不了的（不可逆）才攒起来在阶段1/3 问用户。

## 何时用 / 何时不用

- ✅ 用户要「推进路线图 / 别老问我 / 把这几批做完」——**不管能不能并行都用**：能并行就让 Workflow `pipeline`/`parallel` 一个波次铺开，纯串行就一波一节点、波间合并释放。执行永远在 Workflow 的 agent，不在主 agent。
- ✅ 只要把**一条**已锚定的线自主交付到底、不值得开 Workflow → 直接跑文末「一条线内部怎么干」的 a→g（跳过分解/波次/合并那套上层）。
- ❌ 用户让你**直接**做一件具体小事（「帮我修这个 typo / 加个 console.log / 看下这段为什么报错」）→ 直接做，别为单个动作套整个 Workflow。
- ❌ 纯机械批量改（改名等无新行为）→ 正则替换 + 测试兜底（教训 `[机械改名用正则]`），别上这套。
- ⚠️ **Workflow 是显式 opt-in 的重武器**（会派几十个 agent、烧大量 token）。只有用户用「推进路线图 / 把这几批做完 / 别老问我」这类话**明确要了这种规模**，才生成 Workflow；否则按上一条直接做或先问。

## 需求路由：所有交付 / 维护需求都走本 skill

旧的 `advance-milestone` / `refactor-frontend` / `refactor-backend` / `fix-wiki-issues` / `organize-wiki` / `spec-to-wiki` 六个独立 skill 已**全部收进本 skill**——不再单独置 skill，按需求类型挑一份 `references/` 差异点文档、走对应跑法：

| 需求 | 跑法 | 差异点 reference |
|------|------|------------------|
| 推进里程碑 / 推路线图下一批 / 落 feat | 一批→三段式 Workflow；单条→a→g | [advance-milestone](references/advance-milestone.md) |
| 整理前端架构（`frontend`） | 同上 | [refactor-frontend](references/refactor-frontend.md) |
| 整理后端架构（`backend`） | 同上 | [refactor-backend](references/refactor-backend.md) |
| 修 wiki 内容问题（链断 / 单源违例 / 设计-实现漂移 / 过期链接计数） | 单线 a→g（多纯文档，⑤可裁剪） | [fix-wiki-issues](references/fix-wiki-issues.md) |
| 重排 / 扩张 wiki 结构层级 | **轻量纯文档**（不开 Workflow、不动代码） | [organize-wiki](references/organize-wiki.md) |
| superpowers spec/plan 知识沉淀进 wiki + 清草稿 | **轻量纯文档**（也是三段式阶段3 收尾的同一套） | [spec-to-wiki](references/spec-to-wiki.md) |

挑法：**问题从哪来 / 扫描范围 / 关注点 / 验收口径**这几个差异点看 reference，**怎么干**（三段式 / a→g / 轻量纯文档）看本 SKILL.md。core 层 feat 无专属重构变体，走 advance-milestone 变体。

## 三段式总览

```
阶段1（交互·主 agent，不进 Workflow）
  开本轮目录 docs/dev/delivery/<YYYY-MM-DD-路线图-推进>/（长存·非 docs/dev/todo；结构见该目录 README）
  扫路线图+三池 → 决策账本 decisions-pending.md（跨波长存）
     ├ 可逆：自己拍，记默认值
     └ 不可逆：攒进裁决文件 → 用户审清打勾批准
  裁决闸：本轮要交付的每个需求先有「经用户批准的裁决文件」(decisions/，零不确定项)
     └ 没链接裁决文件 / 没勾 = 视为未裁决，不可进波
  按原子需求切 DAG → delivery_dag.md（**一份裁决炸成 1..N 个原子需求节点，非 1 裁决=1 节点**；全图依赖 depends_on+谁太大要拆+热点文件冲突；**波次是拓扑结果、动态推出，别按领域桶预先拍死几波**）
  挑出「就绪波次」= 依赖已全合进 main 的【已裁决】需求 → 冻结成 wave_N_nodes.jsonl（发波即冻结，不回改）
        ↓ 把 {wave, 已拍不可逆决策} 作 args
阶段2（后台 Workflow）— 主 agent 调 Workflow({script, args})
  pipeline(wave, implement, test, selfverify)：节点波内并发、各自过三 stage
     implement: agent(节点边界 + a→g 内核 + 已拍决策, {isolation:'worktree', schema})
                → 在自己 worktree 提交到分支、产 diff + 自测结果
     test:      另起 agent 对抗性业务级测试（换脑子）→ verdict
     selfverify:typecheck/test 汇总 + 自查
  缺依赖 / 浮现不可逆决策 → 不能问用户 → 塞进结构化返回 surfacedDecisions[] 冒泡
        ↓ return {perNode:{branch, diff摘要, verdict, surfacedDecisions}}
阶段3（交互·主 agent）
  逐节点检查：typecheck/test 绿 + diff 审 + 契约符合
     通过 → 集成进本地 main（重叠冲突主 agent 当场解）→ wave_N_summary.md 记复盘（**本波不沉 wiki**）
     不过 → 起接力 subagent 改 / 回炉
  冒泡的不可逆决策 → AskUserQuestion → 回灌账本
  合并即释放下游 → 重算就绪波次 → 冻结下一个 wave_N_nodes.jsonl → 回阶段2（循环到 DAG 跑空）
  全程不 push（push 由用户单独指令）

最终收尾阶段（DAG 跑空后·一次性·交互·主 agent）——**wiki 沉淀集中在这里，不分散到每波**
  批量沉 wiki：本轮所有已交付需求的设计结论一次性沉进对应设计页「决策与权衡」节 + 决策变更日志（现状 🚧→✅、关 backlog、勾路线图/里程碑）
  确认设计结论已进 wiki → **统一删掉本轮所有裁决文件**（过渡稿不长存）
  最终跑一次全量 typecheck:all + test:all 绿 → 收尾
```

贯穿全程的分工：**主 agent 管「两头 + 跨需求的事」（决策、分解、问用户、检查、集成合并、沉淀），Workflow 的 agent 管「一个需求内的事」（设计、写码、自测、对抗测试）**。合并权独占主 agent——那是质量闸，也是用户的信任边界（用户最终面对的是 main）。**主 agent 不亲自 author 功能实现**（那是各需求 agent 的活），但**集成是它的核心职责**：把各分支合进 main、解重叠改动的冲突、补跨切面接线（如 `server.ts` 挂路由）。它的 review = 合并结果正确 + 每个需求真交付。

## 灵魂：可逆性判据——决定一个卡点该不该打扰用户

整个 skill 能成立的根。遇到任何决策点，先问：**「这决定错了，撤回代价大吗？」** 答案决定动作：

| 决策的可逆性 | 典型 | 动作 |
|---|---|---|
| **可逆**：错了改回来很便宜 | 内部 schema、实现选择、命名、测试设计、纯加法 | **选最合理的默认，记一笔，继续——不问**（Workflow 内 agent 自决） |
| **混合**：一部分无悔、一部分是权衡 | SSRF 防护（挡私网 IP 段=纯安全无悔；放行哪些外部 host=产品权衡） | **先交付无悔的那半**，只把不可逆的残余冒泡 |
| **不可逆**：错了影响用户能做什么、或撤回伤筋动骨 | 产品范围、承重架构、外部可见行为、计费、多租户、安全策略边界 | Workflow 内 → **冒泡进 surfacedDecisions，不自拍**；主 agent 阶段1/3 → **攒进账本，一次问用户** |

为什么这条是灵魂：复盘发现 6 个「卡点」里只有 1 个真不可逆，其余要么纯技术（自己就能判），要么有无悔子集。**把可逆的也拿去问用户，就是不必要的打扰**。判据把「凭直觉停下」换成「按可逆性决定停不停」。

> **Workflow 后台跑、不能 `AskUserQuestion`**——这条铁律强化了判据：Workflow 内的 agent 遇到不可逆决策**没有「问用户」这个选项**，只能冒泡。所以判据在 Workflow 里退化成二元：可逆→自决；不可逆→冒泡。问用户只发生在交互的阶段1/3。

## 阶段1（交互·主 agent）：决策账本 + DAG 分解

### 决策账本：把「每次卡」压成「卡一次大的」

**起手第一件事**，开本轮目录 `docs/dev/delivery/<YYYY-MM-DD-路线图-推进>/`（长存，结构见 [`docs/dev/delivery/README`](../../../docs/dev/delivery/README.md)），扫一遍路线图剩余项 + 三个 backlog 池，产出 `decisions-pending.md`（跨波长存）：

```markdown
# 决策账本（YYYY-MM-DD 扫描）
## 可逆（已自决，记默认值供回溯，无需用户）
- [token 归因维度] 取 per-turn + per-agent 双采。理由：raw log 已有 usage，双维成本低。
## 不可逆（攒着，一次问用户）
- [ ] 快照 v1 是否开放回滚 UI？无悔地基（snapshot 表 + checkpoint 原语）先建；开不开放=产品决策。
- [ ] 多租户 key 后端托管方案？（ADR-0027 草案待用户复核）
## 实现中浮现（Workflow 冒泡上来后回填，可逆即自决、不可逆攒下一批问）
```

不可逆项攒够一批，**一次** `AskUserQuestion` 问完（推荐项排第一、标 Recommended）。用户拍完，回填账本。已拍板的不可逆决策会作为 `args` 抄给 Workflow，让每个 agent 照着做、不再各自瞎拍。

### 裁决闸：要交付的需求先有「经用户批准的裁决文件」

**铁律：一个路线图需求要进交付波，必须先「已裁决」——即在 [`docs/dev/plan/decisions/`](../../../docs/dev/plan/decisions/) 有一份它的裁决文件、路线图挂了链接、且裁决文件顶部的用户批准勾已勾上。没链接 / 没勾 = 一律视为「未裁决」，不可进波。**（见 [裁决记录 README](../../../docs/dev/plan/decisions/README.md)）

- **裁决文件 = 该需求详尽到「没有任何不确定项、仅剩代码实现」的设计**：所有产品 / 承重 / 外部可见行为 / 边界 / 安全策略决策都拍定写死。它顶部留 `- [ ] 用户已批准本裁决` 勾。
- **裁决粒度 ≠ 节点粒度（要紧，别混）**：一份裁决是「设计 + 一次批准」的单元，常覆盖一个**需求簇**；进 DAG 时它按自己的 §设计小节**炸成 1..N 个原子需求节点**。裁决里写「本裁决合并这几条为一个交付单元」纯是**审批 / 设计**的措辞，**不等于一个 DAG 节点**——**别 1 裁决 = 1 节点**（怎么炸见下「DAG 分解」前提① 补的机械分解法）。
- 上面的「不可逆决策一次问清」就发生在**写裁决文件**这一步——把决策攒进完整设计让用户**一次审清、打勾**，比零散 AskUserQuestion 更整。可逆细节仍在文件里自决写死。
- **just-in-time，不全量前置**：只为**本轮要交付的**需求写裁决文件，不给 47 个路线图项全写（Fowler 实测的返工坑）。裁决文件给的是「做什么 + 怎么设计」的零不确定终稿；交付 agent 的 a→g 只做「照着实现 + TDD」，不再自己发明设计。
- **生命周期**：用户勾批准 → 进波交付 → **全轮所有波次交付完**、在「最终收尾阶段」把最终设计一次性沉淀进 wiki（设计页）→ **统一删裁决文件**（**非每波删，过渡稿不长存**）。

### DAG 分解：把路线图项拆成「一个需求一个节点」

**分解单位是功能 / 需求，不是文件。** 一个原子需求 = 一个节点 = 一个 agent = 一个 worktree，独立从设计到自测干到底。路线图上一项往往是个需求簇（如「后端 API 硬化」= usage 端点 / key 托管 / SSRF 白名单 / 限流 四个独立需求）——摊平成一个个**能独立陈述、独立验收**的原子需求，每个派一个 agent。**分解只能主 agent 做**（要全局需求视角 + 需求间依赖关系）。三条前提：

**① 切到「单一原子需求」粒度——太重就再拆细需求，绝不按文件打包。** 一个节点应恰好是「一个能独立陈述、独立验收的需求」。需求太重（一个 agent 扛不动 / 验收口径裹了好几件事）→ **继续拆成更细的子需求**，按依赖排进 DAG。**绝不要因为「几个需求会碰同一个文件」就把它们捏成一个节点**——那是把本该并行的独立需求人为耦合、diff 难审、职责糊成一团（反面教训：把 usage/key/SSRF/限流 四需求并成一个「后端节点」只因它们都在 `server.ts` 挂路由）。文件重叠是**集成时**的事（见下「文件冲突」），不是分解时的约束。可以有几十个 worktree，一需求一个，互不等待。

**① 补·裁决文件是粒度陷阱：从它炸开，别 1 裁决=1 节点。** 一份裁决常把多个需求写成「一个交付单元」（那是**审批 / 设计**的措辞，不是节点边界）。进 DAG 时要**逐条走它的每个 §设计小节**，对每节问「能否独立陈述 + 独立验收」——能→各自成节点候选；只有到「比一个完整需求更细的碎片」（前提③的地板）才回并。裁决内部的先后（A 的产物喂 B）连成 **DAG 边**，不是合并成一个节点的理由；裁决自己都标「小、独立」的小节，尤其别顺手并进邻居。**一份裁决炸开后节点数常是裁决数的数倍，这是正常且期望的**——别一见「3 份裁决」就下意识切成 3 个节点。

**② 测试节点分两种，只有一种能独立拆出去。**
   - **TDD 单测**（红-绿-重构）→ **不能拆**，和实现同节点（同一个 `implement` agent 在 a→g 里红绿一起长）。
   - **对抗性/业务级/集成测试** → **能且应该**拆成 pipeline 下游 stage（`test`，依赖 `implement` 先完成）。换个 agent 脑子才有对抗性。这正是 a→g 第⑥步。

**③ 别拆到「单一需求」以下——那才是负收益。** 原子需求是地板：比「一个完整需求」更细的切分（把一个端点拆成「写函数」+「写测试」两节点）只增集成开销、零收益。**需求多没关系**（几十个并发跑、主 agent 逐个集成），但每个节点都得是个**完整需求**、diff 一眼能审完，不是半拉子。Workflow 内每个 agent 自跑 `test:all`+`typecheck`，主 agent 的检查看 diff + 契约 + 合并结果。

**文件冲突怎么办：集成时由主 agent 解，不靠拆分规避。** 兄弟需求各在自己 worktree 改文件，**即使碰同一文件也互不干扰**（worktree 隔离）。它们各自交付一条分支；主 agent 在阶段3 把分支**逐条**集成进 main，**重叠改动产生的合并冲突由主 agent 当场解**——这是集成的正常一环、主 agent 的核心职责，不是设计时要用「打包成一个节点」去躲的东西。跨切面的接线（如往 `server.ts` 挂多条新路由）天然落在集成点，正好归主 agent 在合并时统一做。

**波次是 DAG 的拓扑层，不是你挑的分区——一波 = 此刻 `depends_on` 已全合进 main 的所有节点。** 波数不是设计时拍的一个数，而是把依赖图拓扑排序后**自然剥出来的层数**（≈ 图的最长依赖链深度）：你读出它，不预选它。所以别把节点按领域/层先归成几堆（前端一堆、后端一堆）再管这几堆叫「波」——领域分组会掩盖堆内的依赖边，一发就发现「同波」节点其实在互等，或在抢同一个正被重写的文件。判据一句话：**合法的波内部零依赖边**。操作上，`delivery_dag.md` 只把每个节点的 `depends_on` 标准确、不预冻波数；按阶段3「重算就绪波次」每次合并后剥下一层。（这是前提①补「别一见 N 份裁决就切 N 节点」的波次版：别一见 N 个领域就切 N 波。）

分解先落成本轮目录的 **`delivery_dag.md`**（设计稿：全图依赖 `depends_on` + 谁太大要拆 + 热点文件冲突表；**波次是这张图的拓扑结果、动态推出，不在此预先拍死几波**）。发某一波时，把该波 roster **冻结**成 **`wave_N_nodes.jsonl`**（一行一个**需求**，发波即冻结、不回头改）：

```jsonl
{"id":"usage-api","title":"GET /sessions/:id/usage 查询端点","depends_on":[],"owns":["backend/src/api/usage.ts","...test"]}
{"id":"key-host","title":"SEC2 后端 key 托管端点","depends_on":[],"owns":["backend/src/api/keys.ts","backend/src/store/keys.ts","db.ts"]}
{"id":"ssrf","title":"model-test/mcp-test SSRF 白名单","depends_on":[],"owns":["backend/src/api/diagnostics.ts"]}
```

- **`owns` = 这个需求预期触及的文件**（供主 agent 集成时预判冲突点），**不是独占**——兄弟需求可与它重叠，重叠处合并时解。
- **`depends_on` = 需求 / 契约依赖**（如前端可视化依赖后端 usage 端点的契约先定），**不是文件依赖**。
- **`wave_N_nodes.jsonl` 是「这一波谁在跑」的冻结快照，不是一张原地反复改 `status` 的全局图**（这点 [`docs/dev/delivery/README`](../../../docs/dev/delivery/README.md) 明确）。「哪些已合、推到哪一波、subagent 撞了啥」记进每波合完后写的 **`wave_N_summary.md`**，不靠在 jsonl 里翻字段。**就绪波次** = `delivery_dag.md` 里 `depends_on` 都已合进 main 的需求；冻结成下一个 `wave_{N+1}_nodes.jsonl` 喂给一个 Workflow。

## 阶段2（后台 Workflow）：一个就绪波次的 pipeline

主 agent 把就绪波次 + 已拍不可逆决策作 `args`，调 `Workflow({script, args})`。脚本骨架（按需改，别照抄死）：

```javascript
export const meta = {
  name: 'roadmap-wave',
  description: '并发交付路线图一个就绪波次：每节点 worktree 隔离实现→对抗测试→自验',
  phases: [
    { title: 'Implement', detail: '每节点一个 agent,worktree 隔离,跑 a→g 实现+TDD 单测' },
    { title: 'Verify', detail: '换 agent 补对抗性业务级测试 + 汇总自验' },
  ],
}

const NODES = args.wave            // [{id,title,owns,goal,acceptance}, ...] 同波互不依赖
const DECISIONS = args.decisions   // 已拍板的不可逆决策,抄给每个 agent

const A_TO_G = `【一条线内部怎么干 a→g】<把文末 a→g 闭环正文嵌在这里>`

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    nodeId: { type: 'string' },
    branch: { type: 'string', description: '本节点提交到的分支名,主 agent 据此 ff 合 main' },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    selfTest: { type: 'object', properties: { typecheck: {type:'boolean'}, unit: {type:'boolean'} } },
    blockedOnDependency: { type: ['string','null'], description: '缺的依赖节点 id;没有则 null,绝不自造' },
    surfacedDecisions: { type: 'array', items: { type: 'object', properties: {
      question:{type:'string'}, why:{type:'string'}, reversible:{const:false} } } },
  },
  required: ['nodeId','branch','summary','selfTest','surfacedDecisions'],
}
const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    nodeId: { type: 'string' },
    businessCasesAdded: { type: 'array', items: { type: 'string' } },
    verdict: { enum: ['pass','fail'] },
    failures: { type: 'array', items: { type: 'string' } },
  },
  required: ['nodeId','verdict'],
}

const results = await pipeline(
  NODES,
  // stage implement —— 一需求一 worktree 隔离,放心并发(文件重叠的冲突留主 agent 集成时解)
  (node) => agent(
    `你负责这一个需求:${node.title}。目标:${node.goal}。验收:${node.acceptance}。
     预期碰这些文件(非独占,兄弟需求可能也碰、重叠由主 agent 集成时解):${JSON.stringify(node.owns)}。
     已拍板的不可逆决策(照做,别重拍):${JSON.stringify(DECISIONS)}。
     在你的 worktree 里跑下面 a→g 的设计→TDD 实现→自测,提交到分支 ${node.id}。
     缺依赖就在 blockedOnDependency 里报、绝不自造;浮现不可逆决策塞进 surfacedDecisions、绝不自拍。
     ${A_TO_G}`,
    { label: `impl:${node.id}`, phase: 'Implement', isolation: 'worktree', schema: IMPL_SCHEMA }
  ),
  // stage test —— 换个脑子,对抗性业务级测试(a→g 第⑥步)
  (impl, node) => impl?.blockedOnDependency
    ? impl                                   // 缺依赖的节点不测,原样冒泡给主 agent
    : agent(
        `从外部业务视角对抗性地测节点 ${node.id}(${node.title})。别只跑现有测试,补出业务级用例,
         真去证伪它的实现。分支 ${impl.branch} 已有实现+单测。`,
        { label: `test:${node.id}`, phase: 'Verify', schema: VERDICT_SCHEMA }
      ).then(v => ({ ...impl, verdict: v })),
)

return { perNode: results.filter(Boolean) }
```

**为什么是 `pipeline` 不是先 `parallel` 再 `parallel`**：pipeline 无 stage 间 barrier——节点 A 的实现一完成就立刻进它的对抗测试，不用等节点 B 的实现。波内最慢的单节点链决定墙钟，而不是「最慢实现 + 最慢测试」之和。这正是「出生即就绪、不 await」在 Workflow 里的原生表达。

**几条 Workflow 内的硬规矩**（写进脚本/prompt）：
- **每个 implement agent `isolation:'worktree'`**：一需求一 worktree，各自并发改文件，**即使碰同一文件也互不干扰**（worktree 隔离）。重叠改动的合并冲突**不在这里规避**，留给主 agent 阶段3 集成时解。
- **不能问用户**：Workflow 后台跑、`AskUserQuestion` 用不了。不可逆决策一律 `surfacedDecisions` 冒泡，可逆的自决。
- **缺依赖不自造**：报 `blockedOnDependency`、原样返回。自造 = 和另一节点重复造、合并时撞车。这是运行时 DAG 修正的信号（有些依赖只在写码时才浮现），主 agent 收到后回写 `delivery_dag.md`（补需求 / 改依赖序）。
- **agent 不碰共享 git**：只在自己 worktree 提交到自己分支。合并权、main 仍独占主 agent。这是 memory 铁律 `[禁止 subagent 碰 git]` 的精确化（不是推翻）：worktree 内提交自己分支 ≠ 碰共享 main/注册表。**记得据此更新那条 memory。**
- **规模档（可选）**：用户给了 `+Nk` token 目标时，可用 `budget` 缩放每节点的对抗测试轮数或 loop-until-dry;没给就单轮。

## 阶段3（交互·主 agent）：检查 + 合并 + 释放下游

Workflow 返回 `{perNode:[...]}` 后，主 agent **逐节点**走质量闸（合并权独占在这，是人类信任边界）：

1. **缺依赖的节点**（`blockedOnDependency != null`）→ 不合，回写 `delivery_dag.md`（补需求 / 改依赖序），下一波 roster 重排。
2. **三关检查**：① 自验绿（`selfTest.typecheck && test` + `verdict==='pass'`）② diff 审（改动范围贴合需求、没顺手改无关东西、没 stub/假实现；可挂 `requesting-code-review` / `/code-review`）③ 契约符合（达成派单验收口径，web 改动走 `/webapp-testing`）。
3. 三关过 → **集成进本地 main**（顺序由依赖图定）：首条可 `git merge --ff-only`；后续分支若与已合内容有重叠改动会分叉，用 `git merge <分支>` 真合并、**主 agent 当场解冲突**（冲突是集成常态，不是异常；跨切面接线如 `server.ts` 挂新路由也在此一并补）。合完跑一次 `typecheck:all`+`test:all` 确认集成后仍绿 → 该需求计入本波 `wave_N_summary.md`（合了哪些 / subagent 撞了啥 / 怎么决断）。
4. 三关不过 → 起接力 subagent 按失败项改（Workflow 已返回、agent 已退，所以是新起 subagent 靠返回结果接力），改完重检。

**冒泡的不可逆决策**（各节点 `surfacedDecisions` 汇总）→ 攒一批 `AskUserQuestion` 问用户 → 回灌账本 + 落 ADR/backlog → 影响到的节点下一波带着新决策重跑。

**每波不沉 wiki（本轮改动 2026-07·要紧）**：每波阶段3 只做「检查 → 合 main → 写 `wave_N_summary.md`（过程复盘）→ 释放下游」，**不**在每波沉淀 wiki、**不**删裁决文件——wiki 权威沉淀 + 删裁决全部推到下面的「最终收尾阶段」一次做。理由：① 一份裁决常**跨多波**交付（如 §3 在波1、§1/§2 在波2），分波沉会只写一半、裁决文件也删不掉；② 沉淀是文档密集操作、与后续波的代码改动撞**同一批热点页**，中途沉易冲突/被打断；③ 批量一次沉才能保证 wiki 单源一致、裁决文件在其内容**全部**落 wiki 后统一删。（`wave_N_summary.md` 是 delivery 过程记录、每波仍照写，**不是** wiki 权威沉淀，别混。）

**合并即释放下游**：被满足的节点转 `ready` → 重算就绪波次 → 回阶段2 为下一波起新 Workflow。循环到 DAG 跑空。

## 最终收尾阶段（DAG 跑空后·一次性）：批量沉 wiki + 删裁决 + 全量验证

**本轮唯一的 wiki 沉淀点**。所有波次都合进 main、DAG 跑空后，主 agent 一次性做全部沉淀：

- **批量沉 wiki**：本轮**所有**已交付需求的设计结论一次沉进对应位置——决策→对应设计页「决策与权衡」节 / 设计→`04-子系统设计` / 概念·架构→`02`·`03`；现状 🚧→✅、关 backlog 条目、勾路线图（达成的宏大目标由人工进 `milestones.md`）。**agent 调查中的现状结论也一并沉 wiki**（教训 `[调查要沉淀进wiki]`）。
- **统一删裁决文件**：确认每份裁决的设计结论都已进 wiki 后，**一次删掉本轮所有裁决文件**（`docs/dev/plan/decisions/*.md`，过渡稿不长存、留着是双写漂移源）+ 路线图对应项「已裁决」链接转「已归档」。
- **带手动门的需求**：需 `RUN_LIVE` / dogfood 等**手动门**的需求，沉淀时标「待测试」（非「已归档」），其裁决文件**暂留**到手动门过（手动门可能触发设计微调，裁决是那时依据）。
- **最终跑一次全量** `typecheck:all` + `test:all` 绿，确认全轮集成后仍绿 → 收尾。

> 主 agent 的 git 仍守：`--no-pager`（否则 less 卡死会话 `[git pager 卡死 Bash]`）；**不 push**（合并到本地 main 即终点,push 由用户单独指令,并发多 session 远端易撞车）。CI（`.github/workflows/ci.yml`）一身两任:本地检查的参照 + 将来发版闸。

---

# 一条线内部怎么干：a→g 自主交付闭环

> 上面是**编排执行上层**（三段式 + Workflow）。这一节是**下层**——一条已锚定交付线从差距分析到沉淀的全过程。它**作为每个 Workflow `implement` agent 的 prompt 内核**被嵌入（上面 `A_TO_G` 常量）；**也可脱离 Workflow、当单线自主闭环单独跑**（由你一个 agent 从头跑到尾）。
>
> **在 Workflow 内跑时**：agent 只跑 ①→④ + 实现 + ⑦自测，**不**自己 fan-out（⑤）、不自己合 main（⑦收尾的合并归主 agent 阶段3）、不问用户（不可逆决策冒泡）。**单独跑时**：含 ⑤ 自己 fan-out、⑦ 自己合本地 main。

## 流程（a→g）

**默认全程不向用户提问**；遇歧义自行按 wiki + 代码现状决断。**卡住 / 困惑 / 拿不准时，不要憋着也别回头问用户——去搜索**：调 `web-research-routing` skill（中文走博查、英文/日文走 jina、都不行回落 tavily）查文档/正典/同类实现，自己把疑问解掉再继续。（牵出**新产品决策**的不可逆歧义：在 Workflow 内→冒泡 `surfacedDecisions`；单独跑→自己判可逆性，可逆自决、不可逆才停下问。）

1. **① 现状↔目标差距分析**
   读相关 wiki + **必读 [现状与计划](../../../docs/dev/plan/)**（路线图 + 三池）+ 对应层代码，列出 gap 清单。

2. **② 落 06 backlog**
   把 gap 写进对应 `backlog-<层>.md` 池，带字段 `类型(fix|feat)·来源·是否随规模恶化·主题·下一步`；必要时编进 `路线图.md` 当前批。**反复出现 + 随规模恶化 = 最高优先级**。

3. **③ 规划（节点内子步骤排序）**
   分析涉及哪些包（前端 `frontend` / 后端 `backend` / core 引擎层 `backend/src` + 纯库 `packages/*` + 工具面 `harness`），排子步骤。（全局 DAG 已由主 agent 在阶段1 分解完，这里只排这条线内部。）

4. **④ 调 superpowers 落 spec/plan（不提问，显式覆盖 brainstorming 的 gate）**
   需设计 → `superpowers:brainstorming`（**自问自答，不向用户提问**）落 spec；→ `superpowers:writing-plans` 落 plan 到 `docs/superpowers/plans/`。
   - **显式覆盖 brainstorming 的两个 gate**：brainstorming 自带「present design 求批准」与「user review spec」两个 gate——**本闭环全部覆盖、不执行**。设计方向已在 wiki（路线图批次 + backlog + ADR）+ 派单边界 + 已拍决策里，自问自答决断后**直接 Write spec**：不向用户呈现设计、不停下等 review。spec self-review（自查 placeholder / 内部一致性 / 范围 / 歧义，自己修）后**直接转 `writing-plans`**。
   - **为何**：「默认不提问」是对 brainstorming gate 的显式覆盖；遇 HARD-GATE 以此为准。用户要纠偏自会打断（Workflow 内则靠主 agent 阶段3 检查兜底）。

5. **⑤ 实现（单独跑时:切 worktree + 发 subagent）**
   单独跑：从 main 切 worktree（`superpowers:using-git-worktrees`，每条并行线各一个）；按子 DAG 派 subagent 实现。
   - **在 Workflow 内**：这一步是上层做的——agent 已被 `isolation:'worktree'` 放进隔离 worktree，直接实现即可，不再自己 fan-out。

6. **⑥ 从业务角度设计测试**
   **另起 agent 专门按这批 feat 的业务语义设计测试方案**（不是只跑现有测试，而是补出业务级、对抗性用例）。在 Workflow 内即 `test` stage。

7. **⑦ 验收**
   `npm test` + `npm run typecheck`；web 改动**必须**走 `/webapp-testing`。
   - **有问题 → 回 ②**（gap 重新入账，再来一轮）。
   - **通过 → 收尾**：
     - **单独跑**：① 沉淀 wiki（决策→对应设计页「决策与权衡」节 / 设计→`04-子系统设计` / 概念·架构→`02`·`03`；达成节点由人工进 `milestones.md`）② 三处清场（关 backlog / 路线图勾掉 / 删 `docs/dev/todo/`；**确认沉淀 wiki 后**才删 superpowers spec/plan）③ 合回 main：`git merge --ff-only <分支>`、删分支；**不 push**。
     - **在 Workflow 内**：agent 跑到「自测通过、提交到自己分支」就把结果结构化返回、退出。⑦ 的「检查 + 合 main + 沉淀」由主 agent 阶段3 做。

## 硬约束（贯穿两层）

- **并行隔离**：多条并行线各自 worktree（Workflow 内靠 `isolation:'worktree'`），别挤主工作目录；提交用 scoped `git add <精确路径>`，别 `-A`（教训 `[worktree npm lock 坑]`）。
- **删 superpowers 草稿铁律**：先沉淀 wiki 才删；多份 plan 半途**整套留着**，全套落地 + 沉淀后统一清。
- **git 命令一律 `--no-pager`**（否则 less 卡死 Bash 会话）。
- **不 push**：合并到本地 main 即闭环终点；push 由用户单独指令。
- **声明完成前自验证**：`superpowers:verification-before-completion`——跑命令、看输出，证据在前、断言在后。
- **卡住就搜索、别问用户**：不提问 ≠ 卡死。解不开调 `web-research-routing`（博查/jina/tavily），把疑问解掉再走。
- **Workflow 内不能问用户**：不可逆决策冒泡、可逆自决；问用户只在交互的阶段1/3。
- **合并权 + main 独占主 agent**：Workflow 的 agent 只在自己 worktree 提交自己分支，绝不碰共享 main / worktree 注册表。
- **单源 / 单向推导**：沉淀时下游页只引上游页；一件事只在一处权威。
