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
>
> **覆盖范围（2026-06-25 用户点出）**：现 harness **只覆盖跑团(dice/play)侧**——跑一个剧本看 GM 行为。**构建团本(lore)侧零 eval**（F3）：作者经构建 GM 建团本 / import 映射 / 构建工具面可用性，全无客观验证。F3 是 F1 在 lore 侧的对称缺口，**编入第二批——接构建工具补全（H-build-tools）后接本项**；评估基建不齐则 lore 侧行为类结论同样不可信。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步 |
|---|------|------|------|:--:|--------|
| F1 | feat | **eval 是单人自导自演**（同一个我兼任即兴玩家 + GM），不是 mock 玩家 ↔ 独立 Claude-GM。后果：凡「GM 行为好不好 / gm-core 措辞够不够 / 缺口有多痛」的结论**全部不可信**（我不会违反自己内化的规则）；只有「架构能不能表达」的客观缺口幸存 | 用户指正 + session | — | ✅ 已闭环（方案改：CC 经 play-mcp 连真后端当玩家+评估者，非"子代理当GM"——见 [ADR-0025](../05-决策记录-ADR/README.md)）；RUN_LIVE 通路验证通过（[reports](../../../reports/)） |
| F2 | feat | **game_end 由谁敲、何时敲** 未定：本局 game_end 是「driver 知道回合预算后的人为收尾」，污染；且忠实 gm-core AI 被教「别朝结局叙事」→ 真实下大概率**不主动收局**（只在死亡收）。终局判据缺失 | 用户追问 + session | — | 🟡 harness 闭环已建（play-mcp），待多轮跑测「真 GM 收不收局」；首份报告见 [reports](../../../reports/) |
| F3 | feat | **团本构建(lore)侧零 eval**：现 eval harness 只覆盖跑团(dice)侧（play-mcp 连真后端当玩家跑剧本），构建团本侧（LoreSession/构建 GM/组件5·6 import/构建工具面）无任何评估。后果：构建流程「作者↔构建 GM」交互质量、import 映射正确性、构建工具可用性**全无客观验证**——与 play 侧 F1 同等不可信 | 用户指正 | ✓（随构建能力扩展越痛） | 🟡 第二批：接构建工具补全（H-build-tools）后接本项；评估形态待定：mock 作者↔真构建 GM，或复用 play-mcp 模式经 build HTTP 驱动 |
| F4 | feat | **真 GM 不遵守开局 r 六维教条**：eval 重跑（debug 模式明骰降级 L3 已修卡死炸弹）暴露——GM(glm-5.2)读了 SKILL.md「开局必须 r 六维明骰、禁 sheet_update 硬编数值」仍建世界空转（world_register×4 / sheet_update / world_search），0 次明骰，180s 超时。骰子链路虽修了卡死（L3）但 GM 不调=没激活。根因待分：教条措辞不够强制 vs 模型(glm-5.2)不遵守教条 vs 开局建世界优先级 | eval 重跑诊断 | ✓（骰子链路永远激活不了） | 🟡 待诊断：①教条更强措辞（开局第一步 r 六维、禁先建世界）②切真 Claude 模型隔离「模型行为 vs 教条」③多轮跑 |

> **2026-06-25 全量体检实证**（[findings](../../../audits/2026-06-25-全量体检/findings.yaml)）：主题F 被体检 P0/P2 多条命中——
> - **CROSS-LORE-EVAL（P0）** = F3 的体检反指（lore 侧零 eval 场景文件，eval scenarios/ 仅 4 个全 dice 侧）。
> - **QA-002（P0）**：F1"掷骰绕过率"无机械检测——`assertions.ts` `toolStats` 只按 event.kind 计数（verdictGated/verdictAuto），无"该骰却没骰"检测；`grade.ts` L60 注释"F1 时序校验"是 TODO 非实现；GM 遇对抗局面不调 `resolve_*`、纯 narrate 编结果时 `verdictCount=0` 不会被标记 fail。是 F1 闭环的**机械地板缺口**——eval 可被"不骰纯编"欺骗。
> - **QA-003（P0）**：F2 软着陆率无机械地板 + baseline 对照报告缺失——`assertions` 只有 `narrateLeak`/`missingNarrate`/`toolStats` 三个机械断言无 F2 检测；`grader.md` L21 完全靠 LLM 判；`reports/` 仅一份 doctrine 报告无 baseline 对照。F2 的"做成了"判定目前完全不可信。
> - **QA-006（P2）**：eval harness 自身测试覆盖薄——`play-mcp.test.ts` 只测 open→start→send 闭环，不测 choose/roll/browse/列表完整性/错误路径；`doChoose`/`doRoll`/`doBrowse` 无任何测试调用。

### 主题F · 体检新增（机械地板 + harness 自测）

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| F1-floor | feat | **F1 机械地板缺失**（QA-002）：`assertions` 只统计 verdict 工具调用次数，无"该骰却没骰"检测；`grade.ts` L60 注释的 F1 时序校验是 TODO 非实现。GM 不调 `resolve_*` 纯 narrate 编结果时 `verdictCount=0` 不会被标记 fail——eval 可被"不骰纯编"欺骗，F1 假性 pass | 2026-06-25 全量体检 | ✓（随 eval 作发版依据越痛） | 🔧 补：① `assertions` 加 F1 时序校验实现（verdict.seq 应早于描述它的 narrate.seq，narrate 在所有 verdict 之前＝可疑绕过）；② `scenario.json` 加 `expects` 字段标"此回合应触发对抗"，assertions 比对预期 vs 实际 verdict 数；③ `grader.md` 对抗性 rubric 具体化（默认怀疑"是不是没骰就编结果"）；④ 人评一致性抽查流程落地。挂在第一批 F2 收尾深化或紧随 |
| F2-floor | feat | **F2 机械地板 + baseline 对照缺失**（QA-003）：F2 软着陆无机械检测全靠 grader LLM 判；`reports/` 仅 doctrine 报告无 baseline 对照——验收口径"with 应显著低于 baseline"无数据支撑；grader 自校准风险（讨好本能）在 harness 无实现 | 2026-06-25 全量体检 | ✓（同上） | 🔧 补：① baseline 对照跑测（每场景跑 doctrine + baseline 各 N 局，`reports/` 落对照报告）；② F2 加弱机械地板（坏结果后 narrate 出现"幸好/不过/但是"转折词作 grader 参考非硬判）；③ grader 对抗性 rubric + 人评抽查落地；④ F1 的"存疑"也需多轮跑测才能定。挂在第一批 F2 收尾深化或紧随 |
| F-harness-test | fix | **eval harness 自身测试覆盖薄**（QA-006）：`play-mcp.test.ts` 只测 open→start→send 闭环，`doChoose`/`doRoll`/`doBrowse`（eval 驱动 GM 跑完一局的关键动作）无任何测试调用；`list_scenarios` 无测试验场景清单非空/符合 schema；`assertions.test.ts` 不测 `grade.ts` 端到端评分流程 | 2026-06-25 全量体检 | ✓ | 🔧 补：① play-mcp.test.ts 补 choose/roll/browse happy path（FAKE_GM 触发后用 doChoose/doRoll 推进）；② 补错误路径（后端 500/WS error/turn 未 ended）；③ 补 list_scenarios 测试验非空 + 每场景符合 scenario schema；④ assertions.test.ts 补 grade.ts 端到端（fixture db + transcript 验报告结构）。非阻塞但发版闸前应补 |

---

## 主题A · 运行时缺少「叙事脚手架」一等抽象 💡

> **2026-06-25 全量体检实证**：**CROSS-TOOLGEN（P0）** = 本主题的头号债反指——toolgen 引擎已建（981 行 6 模块）但**零接线**（`present/` 有 `tensionBoard` 聚合但 grep across `packages/core/src/mcp/` 零命中，未进 TOOLS 工具清单、未注册进 `createMcpServer`）；`packages/core/src/index.ts` L37 导出 TOOLS 是运行时工具清单，叙事域读工具不在其中。业务侧承诺"薄到近乎纯声明的 manifest"、spec 承诺 DT-9「团本扩展框架零改动」，实现却是"引擎建好但没接线、跑不通"——"半截工程比没做更危险"。守路线图第二批冻结令治理，链路跑通前一切 feat 冻结。见 [体检汇总 P0-1](../../../audits/2026-06-25-全量体检/06-汇总-合并.md)。
>
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

> **2026-06-25 全量体检实证**：**CROSS-END（P0）** = E1/E2 的体检反指——成功标准定总判据为"F1/F2/F3 被治住"但未定"一局何时算终局"；ADR-0009 定了 game_end/you_death 唯二出口但"何时敲、由谁敲"未定；core `gameEndHandler`（`io.ts` L74-82）只落 note event + `metaSet(db,"ended")`——无任何触发条件校验（GM 调即终局）。eval harness 跑多少轮都无法回答"做成了"。违"AI 有讨好本能、不可信"立项前提。注：BE-007 的 `GET /sessions/:id` ended 硬编码 bug 是独立 fix（在 [backlog-后端](backlog-后端.md)），不依赖 E2 ADR。见 [体检汇总 P0-2](../../../audits/2026-06-25-全量体检/06-汇总-合并.md)。
> ⏳ **待裁决（见体检汇总 §未决问题 2）**：终局机制"何时敲/由谁敲"——PO 给了候选（N 回合 / 主线 Front 钟满 / 玩家死亡三选一），但"框架据 sheet 钟/watcher 自动敲防讨好 vs GM 自调"是架构决策，须 E2 ADR 定，不宜 AI 代断。

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

## 主题 · 快照/回滚（CROSS-SNAP）💡

> **2026-06-25 全量体检实证**：**CROSS-SNAP（P1）**——快照/回滚机制三层全断：① DB 层 `snapshot` 表未建（`db.ts` L23-102 initSchema 建表清单无 snapshot 表，L100 注释明示"并行未 rebase 进来"）；② core 无 `checkpoint()`/`restore(snapshotId)` 原语 + 无 `SnapshotParticipant` 注册表；③ orchestrator `DiceSession.turnEnd` 不调 `checkpoint()`、`UserPromptSubmit` hook 在 Phase 1 根本没接 Agent SDK；④ 前端 PlayPage 无回滚 UI（grep save/load/存档/读档/回滚/rollback/快照/undo/redo 零命中）。架构层（§3.2 + ADR-0017 + 内层 §4.5 + adapter §8）设计自洽（快照表树形+transcript 锚、IoC 注册表、event 脊柱不入快照、branch 是 transcript 树自然产物），但实现零接线——"设计自洽但实现零接线"的活体断节。见 [体检汇总 P1-6](../../../audits/2026-06-25-全量体检/06-汇总-合并.md)。
> ⏳ **待裁决（见体检汇总 §未决问题 1）**：ADR-0017 快照/回滚 v1 是否对玩家开放？若开放需补 snapshot 表 + core 原语 + Stop/UserPromptSubmit hook 接线 + REST 端点 + UI 五层；若不开放需 ADR-0017 + 完整使用闭环显式降预期（"v1 自动持久化、手动回滚 v2"）。这是架构决策，不宜 AI 代断。
> **关联**：与 CROSS-TIMEOUT（[backlog-后端](backlog-后端.md)）超时半途状态叠加——超时后无 restore 兜底；与 USER-002（[backlog-前端](backlog-前端.md)）终局后玩家流程合并设计：死局后"回滚到上一快照 / 重开 / 主页"三选。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| SNAP-1 | feat | **快照回滚三层全断**：snapshot 表未建、core 无 checkpoint/restore 原语、Stop 不写快照、前端无回滚 UI。玩家死错了想回上一回合无入口——"尊重骰子、不崩坏"卖点在"骰错了想反悔"诉求上落空；branch/swipe（ADR-0017 上修进 v1）无法实现 | 2026-06-25 全量体检 | ✓（随回滚诉求越痛） | 💡 待裁决 v1 是否开放：若开放——① 并行"快照线"rebase 进 `db.ts` initSchema（建 snapshot 表 + `session_meta.current_snapshot_id`）；② core 补 `checkpoint()`/`restore(snapshotId)` + `SnapshotParticipant` 注册表（v1 注册 sheet/world.runtime/watcher，rule 不注册）；③ orchestrator `DiceSession.turnEnd` 调 `checkpoint()`；④ 前端 PlayPage 加"回滚到上一快照"按钮（REST `POST /sessions/:id/rewind`）。若不开放——ADR-0017 + 完整使用闭环显式降预期 |

---

## 主题 · 可见性 / L3 审计链 🔧

> 承接 [总体架构 §3.1](../03-架构/总体架构.md) 可见性三件套（`visible` 列 / show 持久揭示 / reveal_once 快照）的**审计回路**——show 写 `kind=note` 审计 event 供 L3/回看。本主题挂审计链断点。

| # | 类型 | 问题 | 现状 | 来源 | 恶化 | 下一步 |
|---|------|------|------|------|:--:|--------|
| V1 | fix | **`sheet_show`/`world_show` 审计 event_id 不回 AI**：[总体架构 §3.1](../03-架构/总体架构.md) 承诺 show 写 `kind=note` 审计 event 供 L3/回看，但工具出参无 `audit_event_id`，AI 无法串联审计链（审计 event 内部写了但不回 AI） | `mcp/handlers/io.ts` show 出参无 event_id | [接口页 §10.1 C1](../04-子系统设计/玩家客户端-接口.md) 核验 2026-06-24 | ✗ | ✅ 已修（2026-06-24）：`visibility.ts` `sheetShow`/`worldShow` 返回审计 note seq（`logAppend` rowid），`io.ts` 出参加 `audit_event_id`（照 `reveal_once` 模式）；schema+工具 description 同步。多 attrs 取末次 seq 作上界 |

---

## 主题 · 维护 🧹

> **2026-06-25 全量体检实证**：M1 wiki 整理范畴被体检多条命中（文档/推导断节类）——
> - **PROD-006（P2）**：玩家分型单源违例——术语表 L42 仍单列"替代派/相棒派"词条作现行定义、调研-期待与预测 §四 仍以旧二分为正文组织，未跟用户与场景 §1 四类切面升维。
> - **CROSS-DEADLINK（P2）**：wiki 8 处死链引用已不存在的 `06-里程碑与问题/问题总账.md`（已被 backlog 三池取代）——MCP工具面、04 TODO、03 TODO、团本构建工具链、玩家客户端-接口、ADR README、后端双路径架构 §10、MCP工具面 §2.3。
> - **PROD-010（P2）**：定位漂移——ADR-0022 品类词统一为"文字冒险游戏"、安科/安价升维为"载体"，但安科安价是什么页仍以安科/安价为"玩法/游戏类型"开篇、术语表"安科/安价"词条未升维为"载体"。
> - **PROD-011（P2）**：愿景 §4（美观/现代 UI/移动端/社区生态）无 backlog 承接、无验收口径——业务增愿景但下游 backlog 无条目、里程碑四"社区适配与持续迭代"是占位无拆块。
>
> 以上四项均属"业务动了、下游没跟"的 wiki 推导链系统性断节（见 [体检汇总 §共性病根 2](../../../audits/2026-06-25-全量体检/06-汇总-合并.md)），由 `organize-wiki` skill 处理，长期任务、无批次。建议把"定位漂移清理 + 死链修复 + 分型单源统一"单列一次 organize-wiki 专项。

| # | 类型 | 问题 | 来源 | 下一步 |
|---|------|------|------|--------|
| M1 | docs | **wiki 空间因快速迭代变乱**：多 session 高速迭代下，推导链页/ADR/设计页/06 出现冗余、过期、交叉错位（旧 TODO 锚点、计数/状态散落、设计页与实现漂移等；如 2026-06-23 定位升维后，愿景陈述在 ADR-0022 与 用户与场景 §4 轻微重复、待收拢单源） | 用户 | **由 `organize-wiki` skill 处理**（去重、对齐单源、修过期链接与计数、补设计-实现漂移）。**长期任务、持续进行**，非一次性 |
| M1-a | docs | **玩家分型单源违例**（PROD-006）：术语表/调研页仍用旧"替代派/相棒派"二分，未跟用户与场景 §1 四类切面升维 | 2026-06-25 全量体检 | organize-wiki 专项：术语表"替代派/相棒派"词条改为"历史分型、已被四类切面取代（见用户与场景 §1）"；调研-期待与预测 §四 加注"本节为历史调研记录、现行分型见用户与场景 §1"。权威单源 = 用户与场景 §1 |
| M1-b | docs | **wiki 8 处死链**（CROSS-DEADLINK）：引用已不存在的 `问题总账.md`（已被 backlog 三池取代） | 2026-06-25 全量体检 | organize-wiki 专项：批量改 8 处死链 `问题总账.md` → 对应 `backlog-{core,前端,后端}.md` 或 `路线图.md`（按引用语境定） |
| M1-c | docs | **定位漂移**（PROD-010）：ADR-0022 品类词统一为"文字冒险游戏"、安科/安价升维为"载体"，但下游（安科安价是什么页、术语表）仍以安科/安价为"玩法/品类"定义 | 2026-06-25 全量体检 | organize-wiki 专项：安科安价是什么页顶部加定位注记"本页定安科/安价这一载体的背景；品类词统一为文字冒险游戏、安科/安价是其首发载体，见 ADR-0022"；术语表"安科/安价"词条加"载体"定性；不改玩法定义本身只升维定位层级 |
| M1-d | docs | **愿景 §4 无承接**（PROD-011）：用户与场景 §4 愿景（美观/移动端/社区生态）无 backlog 承接、无验收口径 | 2026-06-25 全量体检 | organize-wiki 专项：在用户与场景 §4 为每条愿景加"v1 边界"（美观现代 UI v1 做到墨金 token 全量已落地、社区生态 v1 不做里程碑四、移动端 v1 不做长期愿景 backlog 显式推迟）；移动端进 backlog-前端 未来池显式推迟（见 [backlog-前端](backlog-前端.md)）；客制化/社区生态进里程碑四占位拆块（人工维护） |

---

## 主题 · 测试边界（体检新增）🔧

> **2026-06-25 全量体检实证**：边界测试全缺是"改一处坏别处"的高回归风险区——无测试守则任何后端改动都可能默默 break 而测试全绿。见 [体检汇总 P1-12/P1-13](../../../audits/2026-06-25-全量体检/06-汇总-合并.md)。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| TB-1 | feat | **并发/超时/重启恢复/注入四类边界测试全缺**（CROSS-BOUNDARY-TEST，P1）：grep concurren/race/parallel across test files 零命中——BE-002 并发竞态无测试；grep timeout/abort/recover across .test.ts（非 live）零命中——BE-001 超时半途状态无测试；recovery.test.ts 测了 restagePendingRolls 重弹正向路径但未测"waiters 空 + POST /roll 409 死锁"场景；grep inject/ssrf/恶意/注入 across test files 零命中——ARCH-009/BE-005/BE-006 注入无测试 | 2026-06-25 全量体检 | ✓✓（随代码增长回归风险线性升） | 🔧 补：① 并发测试（BE-002）：FakeDiceGm 慢回合 + 双发 POST /messages 验串行化或 409 turn_in_progress；② 超时测试（BE-001）：FakeDiceGm 模拟 abort 验半途状态 + 恢复路径（依赖 [backlog-后端 CROSS-TIMEOUT](backlog-后端.md) 修复）；③ 重启死锁测试（ARCH-007）：扩 recovery.test.ts 模拟 waiters 空 + pending_roll 在 + POST /roll 验 409 或恢复（依赖 [backlog-后端 CROSS-GATE](backlog-后端.md) 修复）；④ 注入测试（ARCH-009/BE-005/BE-006）：玩家输入"忽略指令"验 GM 是否被诱导；model-test 带内网 baseUrl 验拒绝；validatePack 带注入 prologue 验 warn/reject。挂第三批横切基建同期 |
| TB-2 | feat | **live 测试默认 skip 不进 CI**（CROSS-LIVE-TEST，P1）：`DiceGm.live.test.ts` L13-15 `describe.skipIf(!LIVE)` 默认 skip；FAKE_GM 走完全不同的 FakeDiceGm 类、不经过 DiceGm，故 FAKE_GM=1 也验不到 DiceGm 的 SDK 装配。DiceGm 的 SDK 适配（query/options/mcpServers/abortController/settingSources/allowedTools）是真 GM 调用链承重层，任何改动（升级 agent-sdk、调 options）都可能静默破坏——commit 30fdfb0 加超时兜底的动因就是 eval 卡死，是真 SDK 路径无回归保护的例证 | 2026-06-25 全量体检 | ✓（随 SDK 版本升级越痛） | 🔧 补：① 抽 DiceGm 的 SDK 装配逻辑（query options/mcpServers config/abortController）为纯函数，FAKE_GM 模式下跑装配断言（不烧 LLM、验 options 形状）；② 或加 mock SDK（mock `@anthropic-ai/claude-agent-sdk` 的 query）跑 DiceGm.runTurn 的非 LLM 部分；③ 真 LLM live 测试留 RUN_LIVE 手动跑，但发版前必跑一次（纳入发版闸 checklist，见路线图第五批）。与 [主题S · S2](#主题s--战略风险--claude-code-承重绑定-) port 契约重构配套 |
| TB-3 | feat | **lore WS 测试缺口**（BE-009-LORE-WS，P2）：lore.test.ts 只测 REST 端点，grep `lore.*ws|lore-sessions.*ws` across test files 零命中——BE-003 lore WS 缺失无测试（因实现就没有） | 2026-06-25 全量体检 | ✓ | 🔧 待 [backlog-后端 BE-003](backlog-后端.md) 修复后补 lore WS e2e 测试（构建台 WS 连接→turn_started→narration_commit→turn_ended） |
| TB-4 | feat | **D 流畅派无 backlog 承接且架构层无落点**（CROSS-D，P2）：用户与场景 §1 D 流畅派架构落点写"约束多智能体编排深度（agent 数/反馈轮次 vs 延迟 trade-off）"但 backlog 三池无相关条目；架构层（§5 + ADR-0014）已把裁判 subagent 降为未来、v1 单 agent + Stop hook 脚本——当前架构无多智能体编排深度可言；玩家侧无延迟反馈护栏（无"已等 X 秒"/agent 轮次提示）；四切面本身未做定性验证（中国侧证据偏弱） | 2026-06-25 全量体检 | ✗ | ⏳ **待裁决（见体检汇总 §未决问题 3）**：D 流畅派 v1 是否实现？① 若实现——开 backlog 定"延迟预算/agent 数上限/反馈轮次"架构约束 + 玩家侧延迟反馈（计时/进度/agent 轮次提示）；② 若不实现——在用户与场景 §1 显式标注"D 分型架构落点 v1 不实现、仅作理论锚点"避免下游误以为已承接；③ 落地前在欧美+中国玩家中做定性验证 |

---

## 主题O · 可观测性 · 日志分级统一 💡🔧

> **一句话病根**：项目**无统一日志体系**——全仓仅 7 处裸 `console.*`（后端运行时只 `server.ts` 一条启动 log；core 集中在 `cli.ts` 面向终端输出 + `mcp/main.ts` 一条裸 error），**`packages/shared` 无 logger 基建**。后端 HTTP/WS/会话生命周期/编排/错误**全程零日志**（排障盲区）；core 引擎/MCP 运行时亦无结构化日志。随会话数/并发/排障需求**线性恶化**。
> **跨层难点（用户点出）**：core（引擎/MCP）与后端（orchestrator）都跑、都要日志，各打各的没法对齐 → **抽统一 logging 模块到 `packages/shared`**，两侧共用同一分级约定与上下文（sessionId/turnId）。

| # | 类型 | 问题 | 现状 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|------|:--:|--------|
| O1 | feat | **统一 logging 模块缺失**：无 logger（pino/winston/自研均可）、无分级约定、shared 无日志基建；core/后端/前端无法对齐（前端 `apps/web` 亦 0 日志） | 裸 `console.*`、`shared` 空 | 用户 + grep 实测 | ✓✓ | 抽 `shared/logger`：`error/warn/info/debug` 分级 + 可配 level + 结构化 + sessionId/turnId 上下文 + **须同构**（浏览器 + node 通用，前端可复用同一模块与分级约定）；定级约定写 wiki（04 或 03）；轻量、可不开 ADR |
| O2 | feat | **core 运行时日志接入**：engine/mcp 运行时无结构化日志；`cli.ts` 的 console 是面向终端用户输出（**保留**），`mcp/main.ts` 裸 error 改走 logger | cli console 保留 / mcp 裸 error | 同上 | ✓ | 依赖 O1；core 侧运行时（非 CLI 面向人输出）统一走 logger |

---

## 主题S · 战略风险 · Claude Code 承重绑定 💡

> **2026-06-25 全量体检实证**：**ARCH-004（P0）** = S1/S2 的体检反指——`DiceGm.ts` L10 直接 `import { query } from "@anthropic-ai/claude-agent-sdk"`、用 SDK 专属 `mcpServers` config/`settingSources`/`allowedTools`；`AgentFactory` 是 factory（产 agent 实例）非 port（承重层接口契约）——L3 hook 承重（被动 rule 召回 + 回合末审计）在 Phase 1 根本没接 Agent SDK，现靠 `turnLoop.runTurnEnd` 物化 choice 兜底。换 agent sdk 需重写整个 DiceGm。见 [体检汇总 P0-10](../../../audits/2026-06-25-全量体检/06-汇总-合并.md)。
> **PROD-008 反指**：「adapter 留下游」在 [backlog-后端](backlog-后端.md) / [backlog-前端](backlog-前端.md) 未来池各列一条（玩家选择捕获/语义自查轻推、GUI 前端壳），与本主题 S2 port 契约部分重叠——S2 port 契约落地后，adapter 留下游项范围会被吸收/收窄（已在两池未来池条目加注）。
>
> **一句话病根**：v1 把 L3 审计 / 被动 rule 召回押在 Claude Code hook 上（[技术选型 §6](../03-架构/技术选型.md) / [跨agent §3](../03-架构/跨agent与适配层.md) 定为"承重"）。core 虽称标准可搬，但"承重"即承认**实际不可搬**——CC 改 hook 语义 / SDK v2 breaking（已 pre-alpha）/ 付费策略 / 国内可用性任一变动都能让框架命门失重。这是用低开发成本换来的单点依赖，**对发版 / 商业化语境是供应商锁定风险**，当前未定价。
>
> **路由**：开 ADR 定**解绑触发条件** + 把承重层抽成 **port（adapter 接口契约，v1 单 Claude Code 实现、多 agent sdk 列未来）**——核心是回答 **L3 承重怎么跨 agent 表达**（被动 rule 召回 + 回合末审计，正是 [ADR-0008](../05-决策记录-ADR/) 否①「hook 类塑形难跨 agent 承重」的理由），并禁 `adapter/` 之外代码直接调 CC 专属 API。**不阻塞头号债链路，但发版前必决。**

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| S1 | feat | **承重绑定无解绑预案 + 无抽象边界**：hook 承重但未写"何时该解绑"触发条件（CC 改 X / 商业化 Y / SLA Z）；`adapter/hooks/*` 已隔离但无契约保证业务代码不穿透。core"理论上可搬" ≠ 实际可搬 | 首席架构师评估 2026-06-25 | — | 💡 开 ADR：① 定解绑触发条件；② 立 hook 抽象接口位（v1 单实现、禁业务穿透）；③ 把"承重绑定"显式列为最高级架构风险。与 [跨agent §5](../03-架构/跨agent与适配层.md) 取舍对齐 |
| S2 | feat | **承重层 port 契约 + L3 跨 agent 承重未定**：用户提议把 hook/skill/subagent 承重层抽成 port，当前单 Claude Code adapter、多 agent sdk 列未来（harness 思想 L1/L2/L3 + 团本/SQLite store 不变，只把"绑哪个 agent"从硬绑松弛成 port + 默认 adapter）。病根＝**L3 承重（被动 rule 召回 + 回合末审计）跨 agent 无统一表达**——这正是 [ADR-0008](../05-决策记录-ADR/) 否①「hook 类塑形难跨 agent 承重」的理由，port 契约须正面解，否则 port 是空壳。是 [ADR-0017](../05-决策记录-ADR/) 快照对冲思路从快照一项延到整个承重层；**不翻 ADR-0008**（v1 单实现、多实现明确推迟）、不违 [跨agent §5](../03-架构/跨agent与适配层.md) 取舍（可移植兑现在模型层、port 是"未来想搬就能搬"的保险非 v1 目标） | 用户提议 2026-06-25（"从单点 Claude agent 改成适配多 agent；harness 思想确定，用适配器适配不同 agent sdk"） | ✗ | 💡 与 S1 同 ADR：定 port 契约边界 + **L3 跨 agent 表达**（被动 rule 召回 + 回合末审计的 adapter 接口形状，与 [ADR-0017](../05-决策记录-ADR/) 快照 adapter 对齐）；**当前不实现**，只立方向 |

---

## 🔮 未来池（core 层 · 明确推迟，别现在做）

- **状态回滚/分支**：反刷骰 config 旋钮（稳定键播种）；「进行中存档遇 rule 版本热更」的 `schema_version`/团本版本迁移语义（深 diff/merge）。来源：03 TODO G。
- **自研 agent runtime**：[ADR-0008](../05-决策记录-ADR/) 被否项，对冲＝快照/core agent 无关；迟早面临，记未来。承重层 port 防腐方向见 [主题S · S2](#主题s--战略风险--claude-code-承重绑定-)。
- **团本构建台未来**：语义向量检索（FTS 起步够）、深版本化迁移。来源：04 TODO 组件5/6。
- **eval-loop 工装**：headless `claude -p` 多回合驱动确切 flag（实现期核实）——但**主线改走子代理 GM harness（主题F），此项大概率作废**。
- **`shop_pool` 视图 + `shop_buy` 工具**（数据层不阻塞）：当下走 choice 式文本菜单即可（团本富前端组件本体在 [backlog-前端](backlog-前端.md) 未来池）。来源：用户 + [声明式工具生成层 spec](../../superpowers/specs/2026-06-22-声明式工具生成层-design.md)（2026-06-22）。
