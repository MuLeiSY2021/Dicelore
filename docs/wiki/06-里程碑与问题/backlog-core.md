# backlog · core 层

> **本页职责**：`packages/core`（+`packages/shared`）层的 **issue 池**——引擎 / 数据层 / MCP 工具面 / gm-core / 团本构建引擎 / eval harness。按**主题**聚类、按 **fix/feat** 标注，广度无序（先还哪个见 [路线图](路线图.md)）。
> **单源（勿重复）**：eval 细节仍在 [`packages/core/eval/findings.md`](../../../packages/core/eval/findings.md)，本页按主题**卷上来**；拍了方案 → 写 [ADR](../05-决策记录-ADR/)，条目改标 `→ ADR-00xx` 关闭；已达成 → 进 [里程碑](里程碑.md)。

## 状态图例
- ✅**确认** — 客观/架构事实，与「谁驱动」无关（已实测）。
- ⚠️**待真harness** — 行为/措辞类，**当前单人自演的结论不可信**，需 mock 玩家↔真 Claude-GM 才算数（见主题F）。
- 💡**设计待ADR** — 需开设计周期 / 写 ADR。
- 🔧**可即修** — 便宜引擎改动，随手可清。
- 🚧**在途** — 实现线进行中。
- 🔮**未来池** — 明确推迟。

## 字段约定
每条带：`类型(fix|feat)` · `来源` · `是否随规模恶化(✓/✓✓/✓✓✓/✗)` · `所属主题` · `下一步/依赖`。**反复出现 + 随规模恶化 = 最高架构优先级。**

---

## 主题F · eval harness 真实性 ⚠️→💡

> **路由**：F 是 meta 闸——**先建它，再跑剧本2/3 eval**，否则继续产污染数据。建好后，全项目所有 ⚠️ 项才可重新评定。
>
> **进度（2026-06-24 核对 → 闭环达成）**：faithful 真引擎工具链**已备**（`eval/tool.ts`/`batch.ts`/`run.ts`/`grade.ts`/`grader.md`/`findings.md`）。自动闭环**已补**——经 **play-mcp**（CC 经它连真后端 play HTTP 当玩家+评估者，见 [ADR-0025](../05-决策记录-ADR/README.md)），非原"子代理当 GM"方案。RUN_LIVE 通路验证通过（[reports](../../../reports/)）。F1 闭环；F2 终局观测待多轮跑。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步 |
|---|------|------|------|:--:|--------|
| F1 | feat | **eval 是单人自导自演**（同一个我兼任即兴玩家 + GM），不是 mock 玩家 ↔ 独立 Claude-GM。后果：凡「GM 行为好不好 / gm-core 措辞够不够 / 缺口有多痛」的结论**全部不可信**（我不会违反自己内化的规则）；只有「架构能不能表达」的客观缺口幸存 | 用户指正 + session | — | ✅ 已闭环（方案改：CC 经 play-mcp 连真后端当玩家+评估者，非"子代理当GM"——见 [ADR-0025](../05-决策记录-ADR/README.md)）；RUN_LIVE 通路验证通过（[reports](../../../reports/)） |
| F2 | feat | **game_end 由谁敲、何时敲** 未定：本局 game_end 是「driver 知道回合预算后的人为收尾」，污染；且忠实 gm-core AI 被教「别朝结局叙事」→ 真实下大概率**不主动收局**（只在死亡收）。终局判据缺失 | 用户追问 + session | — | 🟡 harness 闭环已建（play-mcp），待多轮跑测「真 GM 收不收局」；首份报告见 [reports](../../../reports/) |

---

## 主题A · 运行时缺少「叙事脚手架」一等抽象 💡

> **一句话病根**：同一概念在**团本作者层**有、在**运行时跑团层**塌缩成底层存储原语，AI 拿不到「以这个概念为单位」的**读（聚合视图）+ 写（生命周期操作）**。这是 conceptual integrity 问题，**跨多 session 反复命中、随回合数线性恶化** = 全项目头号架构债。建议**一个 ADR + 一个设计周期**统一解，**勿往 gm-core 提示词硬塞**。
>
> **想要**：`NPC` / `Front` / `plotline` / `foreshadow` 的运行时一等抽象（开/进行/收口状态 + 关联锚点 + 到点浮现提醒）+ **一张「未结张力」聚合视图**。Front/Clock（[ADR-0016](../05-决策记录-ADR/)）与 watcher（[ADR-0013](../05-决策记录-ADR/)）是部分地基，需评估**扩展 vs 新建**。
>
> **进度（2026-06-24 核对）·存储地基已完、工具面暴露未做**：A2-A5 的物理表 + store CRUD + `tensionBoard`/`frontOmenList` 聚合**均已建**（见主题A′ 进度）。**A1-A5 现在统一的真缺口不是"缺存储"，是"没暴露成 MCP 工具给 GM"**——聚合函数躺在 `present/` 层却没接进 `buildMcp`，GM 仍调不到「以概念为单位」的读；NPC 连一等表都没有。这把 A 主题从"建存储"收窄为"补视图层投影 + 暴露工具 + NPC 升一等"，依赖与路线见主题A′。

| # | 类型 | 缺口 | 现状（2026-06-24 核对） | 来源 | 恶化 |
|---|------|------|----------|------|:--:|
| A1 | feat | **NPC 无运行时一等概念**：团本层有（`world/npc/*.md` + sheets），运行时无「NPC」对象去读/操作 | `state` 表有 `player`/`npc`/`world` kind 区分但**无 npc 一等表/工具**，仍散格 | 另一 session | ✓ |
| A2 | feat | **Front/Clock 运行时不可见、不可管**：运行时 AI 无「Front」聚合对象去读/管（Front＝钟+凶兆阶梯+散文） | `front` 表 + `frontOmenList` 聚合**已建**，但**未暴露 MCP 工具**；`watcher_list` 可列底层 armed watcher＝D2✅ | 用户「需要 front」+ eval B6 | ✓✓ |
| A3 | feat | **多情节线/故事线追踪**：情节线不是任何实体属性 | `plotline` 表**已建**，**无工具暴露** | findings B1 + eval | ✓✓ |
| A4 | feat | **伏笔「埋—回收」闭环**：无 planted/recalled 状态、无到点提醒；`event_recall` 是全 log FTS，埋的 note 排不过叙事噪音 | `foreshadow` 表**已建**，**无 planted/recalled 状态机 + 无工具** | findings B2 + eval（13 条 note 硬当伏笔库） | ✓✓ |
| A5 | feat | **未结张力看板**：列「所有未结张力」无聚合视图；game_end 也不和解开放线程 | `tensionBoard` 聚合**已实现**（present 层），但**未接进 `buildMcp`**，GM 调不到 | findings B6 + eval（T30 实测散落） | ✓✓✓ |
| A6 | feat | **NPC 双层值（裁决侧）**：双层值**存储**没问题（表演层 cell 公开 + 真实层 cell 暗）；缺口在**裁决**——`resolve_contest` 每边只一个常数，编不了「表演叫价 vs 真实底线、差额即线索」（裁决侧正交，留 resolver spec） | margin 手解 | findings B5（已缩窄定义） | ✗ |

### 主题A′ · 团本构建 ↔ 跑团 术语 / store 不对齐（地基级，需大改）💡⚠️🚧

> 同一病根的**更底层一面**：作者层（团本构建）与运行时（跑团）两侧**术语乱、概念不对齐**。最尖锐的是 **`sheet` 被当成「人物卡」，但它实质是「临时空间」（局内可变状态的临时载体）**——与团本侧设计不符。

- **类型** feat · **来源** 用户判断 + 多 session · **恶化** ✓✓✓（conceptual integrity / 地基级架构债，牵动四域 store 命名与语义、团本 import 映射、gm-core/flow 措辞）。
- **症结**：术语两侧各说各话；`sheet` 误名/误概念（人物卡 ≠ 临时空间）。
- **用户判断**：**跑团侧 store 方案有必要大改，至少与团本侧设计对齐**。应**先统一术语 + 重新概念化 sheet + store 对齐团本**，再谈主题A 的叙事脚手架（A 建在此之上）。
- **路由**：开 ADR（两侧术语统一表 + store 重构方案），**与团本构建（组件5/6，里程碑一在建）协同设计**，别两侧继续分叉。
- **落地方向（用户提案）**：给 MCP 加「叙事层」(几张表)、**废弃通用 `sheet`**，改为一组一等 kind/表：`player` / `npc` / `world` / `rule` / `watcher` / `front` / `pool`——每类有自己的表与工具，而非全塞进 `(entity,attr,value)` 通用格，直解「sheet 临时空间误当人物卡」根因。**待商榷**：① 与现四域(sheet/event/world/rule)如何重映射(world/rule/pool/watcher 已有、npc/player/front 需升一等)；② 原 sheet 的「临时空间」真实职责是否单列一类；③ 与团本 import(组件5/6)对齐。
- **进度（2026-06-24 重评）🚧 地基已完、工具面暴露未做**：方案见 spec [运行时数据层重构-叙事层](../../superpowers/specs/2026-06-21-运行时数据层重构-叙事层-design.md)（拱心石＝物理表精简 + kind 视图 + 业务工具；非"每概念一张物理表"，relation/flag/clock 是 `state` 的行形态）。
  - ✅ **改名段**已落 `main`：`sheet→state`(+`kind`/`rel_*`/`clock_*` 列)、`event→log`(+`is_moment`)、`world_doc→lore`、fts 随改（[ADR-0021](../05-决策记录-ADR/)）。
  - ✅ **补充改名** `rule_doc→rule`/`world_pool→pool` 已落。
  - ✅ **叙事/记忆物理表** `front`/`plotline`/`foreshadow`/`history`(+`anchor`) **已建** + store CRUD + `tensionBoard`/`frontOmenList` 聚合（present 层）。
  - ✅ **声明式工具生成层引擎** `toolgen/`（SQL 闸/视图定义/读写工具编译/写匹配防泄露）已建，6 模块 981 行 + 6 测试绿。
  - 🚧 **仍欠（真正的剩余 = 工具面暴露，非存储）**：
    - ① **视图层未投影**：叙事层 spec §4 的 `npc`/`player`/`world`/`relation`/`tension_board` 命名视图未建 → toolgen 读工具无基视图可 `CREATE VIEW`，是 step②/③ 的**前置闸**。
    - ② **业务 MCP 工具未暴露**：`tensionBoard`/front/plotline/foreshadow 聚合已在 present 层但**没接进 `buildMcp`**，GM 调不到「以概念为单位」的读；NPC 无一等抽象（A1-A5 主体）。**已拍板走声明式 dogfooding**（守 spec DT-9「团本扩展框架零改动」契约），先补视图层再声明。
    - ③ **toolgen 零接线**：引擎已通但**不进 `createMcpServer`/不进团本 import/无 dogfooding step③**（用本层声明出 front/plotline/foreshadow 业务工具）—— spec 承诺的「新剧本=新声明+新 flow、框架代码零改动」目前跑不通，团本扩展机制未对作者开放。
  - **依赖链（单向，被原路线图掩盖）**：叙事层总纲(定视图契约) → 谓词扩展(step①建表✅) → toolgen(step②引擎✅但视图契约未兑现) → 业务工具声明(step③❌)。**视图层是闸**，须先落地才能 dogfooding。
  - A6 裁决侧正交、留 resolver spec。

---

## 主题 · 裁决 / 披露 / 终局 增强 💡

| # | 类型 | 问题 | 现状 | 来源 | 恶化 |
|---|------|------|------|------|:--:|
| B7 | feat | **「带修正 ∧ 分级」检定无原语**：`resolve_outcome`（分级 bands）die 只吃纯 `NdS`、加不了修正；`resolve_contest`（吃修正）只回二元胜负。GM 想「掷+加值→超出难度多少决定后果程度」两个工具都不趁手 | 把加值**手算烘进每条 band 阈值**，玩家明骰看到裸骰，加值一变就重算整表 | eval（兽人局**几乎每个明骰**都踩）✅ | ✓（随属性成长越痛） |
| C1 | feat | **分级线索披露**：`reveal_once` 只能整格快照（全有/全无）；「按检定档给不同信息量」表达不了 | 分级线索全塞进 outcome band consequence；50 回合探索局 **reveal_once 一次没用上** | eval B4 ✅ | ✗ |
| E1 | feat | **终局判据**：gm-core 教「别朝结局叙事」却没教「何时收局正当」→ 真 GM 可能永不收局或只死亡收 | 无 | F2 + 用户 | — |
| E2 | feat | **终局机制（数据层）未设计**：缺让团本作者**在 rule 里配置终局条件**的机制；候选 watcher 谓词，但**「复活」如何算待商榷**（以死亡/HP≤0 作终局 watcher，遇复活 / 快照回滚就矛盾） | 用户 | — | — |

**B7 解法草案**：`resolve_outcome` 增 `modifier?: expr`（引擎求值 `{ref}`+常数加到 roll 再 rangeMap），出参回 `roll/modifier/total/band`，玩家视图显「裸骰+加值=总值→档」。评估与 contest 合并为「掷值→(对抗线|档表)」单一抽象。
**C1 解法草案**：「按检定档披露分级线索散文」原语（线索 ≠ 实体属性 ≠ 世界条目）。
**E1**：给 gm-core 加「终局判据」话术（A 类，**待 harness 能验证再动**）/ 或做成显式收局提示。
**E2 解法方向（待商榷）**：把终局条件做成团本一等内容（类比 Front/Clock 凶兆阶梯，但触发的是 `game_end`）——rule/manifest 声明 + watcher 谓词候选；须解决与**可逆状态**的交互：复活、回合快照回滚（[ADR-0017](../05-决策记录-ADR/)）下「死亡终局」不应误触发或须可撤销。与 E1 配套：**E2 = 机制上何时算终局，E1 = GM 叙事上何时收局**。需 ADR。

---

## 主题 · 维护 🧹

| # | 类型 | 问题 | 来源 | 下一步 |
|---|------|------|------|--------|
| M1 | docs | **wiki 空间因快速迭代变乱**：多 session 高速迭代下，推导链页/ADR/设计页/06 出现冗余、过期、交叉错位（旧 TODO 锚点、计数/状态散落、设计页与实现漂移等；如 2026-06-23 定位升维后，愿景陈述在 ADR-0022 与 用户与场景 §4 轻微重复、待收拢单源） | 用户 | **由 `organize-wiki` skill 处理**（去重、对齐单源、修过期链接与计数、补设计-实现漂移）。**长期任务、持续进行**，非一次性 |

---

## 🔮 未来池（core 层 · 明确推迟，别现在做）

- **状态回滚/分支**：反刷骰 config 旋钮（稳定键播种）；「进行中存档遇 rule 版本热更」的 `schema_version`/团本版本迁移语义（深 diff/merge）。来源：03 TODO G。
- **自研 agent runtime**：[ADR-0008](../05-决策记录-ADR/) 被否项，对冲＝快照/core agent 无关；迟早面临，记未来。
- **团本构建台未来**：语义向量检索（FTS 起步够）、深版本化迁移。来源：04 TODO 组件5/6。
- **eval-loop 工装**：headless `claude -p` 多回合驱动确切 flag（实现期核实）——但**主线改走子代理 GM harness（主题F），此项大概率作废**。
- **`shop_pool` 视图 + `shop_buy` 工具**（数据层不阻塞）：当下走 choice 式文本菜单即可（团本富前端组件本体在 [backlog-前端](backlog-前端.md) 未来池）。来源：用户 + [声明式工具生成层 spec](../../superpowers/specs/2026-06-22-声明式工具生成层-design.md)（2026-06-22）。
