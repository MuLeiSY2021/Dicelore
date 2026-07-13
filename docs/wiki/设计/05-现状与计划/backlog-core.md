# backlog · core 层

> **本页职责**：core 层（引擎 / 数据层 / MCP 工具面 / gm-core / 团本构建引擎 / eval harness）的 **issue 池**——落点散在 `backend/`（store/resolve/present/catalog/build/toolgen/expr/eval）、`harness/`（mcp 工具面/dicegm/loregm/eval-*）、`packages/*`（纯库）。按**主题**聚类、按 **fix/feat** 标注，广度无序（先还哪个见 [路线图](路线图.md)）。
> **单源（勿重复）**：eval 细节仍在 [`harness/eval-dicegm/findings.md`](../../../harness/eval-dicegm/findings.md)，本页按主题**卷上来**；拍了方案 → 把决策写进对应设计页「决策与权衡」节，条目改标『→ 链对应设计页决策节』关闭；已达成 → 进 [里程碑](里程碑.md)。

## 状态图例
- ✅**确认** — 客观/架构事实，与「谁驱动」无关（已实测）。
- ⚠️**待真harness** — 行为/措辞类，**当前单人自演的结论不可信**，需 mock 玩家↔真 Claude-GM 才算数（见主题F）。
- 💡**设计待定** — 需开设计周期 / 把决策写进对应设计页「决策与权衡」节。
- 🔧**可即修** — 便宜引擎改动，随手可清。
- 🚧**在途** — 实现线进行中。
- 🔮**未来池** — 明确推迟。

## 字段约定
每条带：`类型(fix|feat)` · `来源` · `是否随规模恶化(✓/✓✓/✓✓✓/✗)` · `所属主题` · `下一步/依赖`。**反复出现 + 随规模恶化 = 最高架构优先级。**

---

## 主题F · eval harness 真实性 ⚠️→💡

> **路由**：F 是 meta 闸——**先建它，再跑剧本2/3 eval**，否则继续产污染数据。建好后，全项目所有 ⚠️ 项才可重新评定。
>
> **进度（2026-06-24 核对 → 闭环达成）**：faithful 真引擎工具链**已备**（`harness/eval-dicegm/` 下 `tool.ts`/`batch.ts`/`run.ts`/`grade.ts`/`grader.md`/`findings.md`）。自动闭环**已补**——经 **play-mcp**（CC 经它连真后端 play HTTP 当玩家+评估者，见对应设计页决策节），非原"子代理当 GM"方案。RUN_LIVE 通路验证通过（[reports](../../../reports/)）。F1 闭环；F2 终局观测待多轮跑。
>
> **覆盖范围（2026-06-25 用户点出）**：现 harness **只覆盖跑团(dice/play)侧**——跑一个剧本看 GM 行为。**构建团本(lore)侧零 eval**（F3）：作者经构建 GM 建团本 / import 映射 / 构建工具面可用性，全无客观验证。F3 是 F1 在 lore 侧的对称缺口，**编入第二批——接构建工具补全（H-build-tools）后接本项**；评估基建不齐则 lore 侧行为类结论同样不可信。
>
> **🔑 2026-06-29 方法论决策（待写进对应设计页决策节，修订对应设计页决策节）**：eval 的**对照系 = `docs/research/` 真实案例**（兽人冒险/抽卡/恶龙团→喂进团本构建库、和 lore GM 对话建出团本→人工认可→Claude skill+MCP 拿团本跑 eval→落盘 eval 报告）。**废 doctrine-vs-baseline A/B 对照**——不再以"去教条档"作教条价值的证据系。**量化以目前认知不可行 → 闭环产出定性报告**（量化口径待探索）。波及对应设计页决策节 + wiki 01 成功标准 / 04 Skills-eval·Skills包·团本构建工具链 + `harness/eval-dicegm/grader.md` + `play-eval` skill，**把决策写进对应设计页「决策与权衡」节后由它单源传播**（下方 baseline 欠账项一并作废）。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步 |
|---|------|------|------|:--:|--------|
| F1 | feat | **eval 是单人自导自演**（同一个我兼任即兴玩家 + GM），不是 mock 玩家 ↔ 独立 Claude-GM。后果：凡「GM 行为好不好 / gm-core 措辞够不够 / 缺口有多痛」的结论**全部不可信**（我不会违反自己内化的规则）；只有「架构能不能表达」的客观缺口幸存 | 用户指正 + session | — | ✅ 已闭环（方案改：CC 经 play-mcp 连真后端当玩家+评估者，非"子代理当GM"——见对应设计页决策节）；RUN_LIVE 通路验证通过（[reports](../../../reports/)） |
| F2 | feat | **game_end 由谁敲、何时敲** 未定：本局 game_end 是「driver 知道回合预算后的人为收尾」，污染；且忠实 gm-core AI 被教「别朝结局叙事」→ 真实下大概率**不主动收局**（只在死亡收）。终局判据缺失 | 用户追问 + session | — | 🟡 harness 闭环已建（play-mcp），待多轮跑测「真 GM 收不收局」；首份报告见 [reports](../../../reports/) |
| F3 | feat | **团本构建(lore)侧零 eval**：现 eval harness 只覆盖跑团(dice)侧（play-mcp 连真后端当玩家跑剧本），构建团本侧（LoreSession/构建 GM/组件5·6 import/构建工具面）无任何评估。后果：构建流程「作者↔构建 GM」交互质量、import 映射正确性、构建工具可用性**全无客观验证**——与 play 侧 F1 同等不可信 | 用户指正 | ✓（随构建能力扩展越痛） | 🟡 offline 部分 ✅ 达成（2026-06-26）：`backend/src/eval/loreScenario.ts`+`backend/src/eval/loreAssertions.ts`+`harness/eval-loregm/loreRun.ts`+`harness/eval-loregm/loreScenarios/frontier-saga.json`+`harness/eval-loregm/loreGrader.md`——确定性 mock 作者 `buildCalls`→`runBuildTool`→commit→`importPack`→`gradeLoreRun` 判运行库（零 LLM，7 测）。**真构建 GM 真 LLM 一局留「待测试」**——CC 驱动对称路径见 [N20-lore-eval-MCP](#)（本页主题F 新增）。终局场景 eval 随后补（依赖 E2 对应设计页决策节定稿落地） |
| F4 | feat | **真 GM 不遵守开局 r 六维教条**：eval 重跑（debug 模式明骰降级 L3 已修卡死炸弹）暴露——GM(glm-5.2)读了 SKILL.md「开局必须 r 六维明骰、禁 sheet_update 硬编数值」仍建世界空转（world_register×4 / sheet_update / world_search），0 次明骰，180s 超时。骰子链路虽修了卡死（L3）但 GM 不调=没激活。根因待分：教条措辞不够强制 vs 模型(glm-5.2)不遵守教条 vs 开局建世界优先级 | eval 重跑诊断 | ✓（骰子链路永远激活不了） | 🟡 待诊断：①教条更强措辞（开局第一步 r 六维、禁先建世界）②切真 Claude 模型隔离「模型行为 vs 教条」③多轮跑 |

> **2026-06-25 全量体检实证**（[findings](../../../audits/2026-06-25-全量体检/findings.yaml)）：主题F 被体检 P0/P2 多条命中——
> - **CROSS-LORE-EVAL（P0）** = F3 的体检反指（lore 侧零 eval 场景文件，eval scenarios/ 仅 4 个全 dice 侧）。
> - **QA-002（P0）**：F1"掷骰绕过率"无机械检测——`assertions.ts` `toolStats` 只按 event.kind 计数（verdictGated/verdictAuto），无"该骰却没骰"检测；`grade.ts` L60 注释"F1 时序校验"是 TODO 非实现；GM 遇对抗局面不调 `resolve_*`、纯 narrate 编结果时 `verdictCount=0` 不会被标记 fail。是 F1 闭环的**机械地板缺口**——eval 可被"不骰纯编"欺骗。
> - **QA-003（P0）**：F2 软着陆率无机械地板 + baseline 对照报告缺失——`assertions` 只有 `narrateLeak`/`missingNarrate`/`toolStats` 三个机械断言无 F2 检测；`harness/eval-dicegm/grader.md` L21 完全靠 LLM 判；`reports/` 仅一份 doctrine 报告无 baseline 对照。F2 的"做成了"判定目前完全不可信。
> - **QA-006（P2）**：eval harness 自身测试覆盖薄——`play-mcp.test.ts` 只测 open→start→send 闭环，不测 choose/roll/browse/列表完整性/错误路径；`doChoose`/`doRoll`/`doBrowse` 无任何测试调用。

### 主题F · 体检新增（机械地板 + harness 自测）

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| F1-floor | feat | **F1 机械地板缺失**（QA-002）：`assertions` 只统计 verdict 工具调用次数，无"该骰却没骰"检测；`grade.ts` L60 注释的 F1 时序校验是 TODO 非实现。GM 不调 `resolve_*` 纯 narrate 编结果时 `verdictCount=0` 不会被标记 fail——eval 可被"不骰纯编"欺骗，F1 假性 pass | 2026-06-25 全量体检 | ✓（随 eval 作发版依据越痛） | ✅ 已达成（2026-06-26）：`backend/src/eval/assertions.ts` 加 `rollFloor`——F1 掷骰绕过机械地板：① 计数地板（verdict 数 < `scenario.expects.minVerdicts` → fail，散文绕过/漏掷）② 时序地板（narrate 抢在所有 verdict 之前 = 先编结果后补掷 → fail）。`backend/src/eval/scenario.ts` 加 `expects.minVerdicts` 字段、4 场景声明、`harness/eval-dicegm/grade.ts` 接线。零 LLM、offline 可判 |
| F2-floor | feat | **F2 机械地板 + baseline 对照缺失**（QA-003）：F2 软着陆无机械检测全靠 grader LLM 判；`reports/` 仅 doctrine 报告无 baseline 对照——验收口径"with 应显著低于 baseline"无数据支撑；grader 自校准风险（讨好本能）在 harness 无实现 | 2026-06-25 全量体检 | ✓（同上） | ✅ 已达成（2026-06-26）：`backend/src/eval/assertions.ts` 加 `closureFloor`——F2 软着陆**弱**地板：floor 恒 `advisory`（绝不硬判 pass/fail），检 is_moment / 收束参考词 / game_time 推进任一即 signalPresent，缺信号给 advisory 提示评测者重点核 F2。`scenario.expects.closure` 声明。⚠️ **原"baseline 对照报告"欠账作废**（2026-06-29 决策废 doctrine-vs-baseline A/B，见主题F 决策注记）→ 改为**对照 `docs/research` 真实案例的定性 eval** |
| F-harness-test | fix | **eval harness 自身测试覆盖薄**（QA-006）：`play-mcp.test.ts` 只测 open→start→send 闭环，`doChoose`/`doRoll`/`doBrowse`（eval 驱动 GM 跑完一局的关键动作）无任何测试调用；`list_scenarios` 无测试验场景清单非空/符合 schema；`assertions.test.ts` 不测 `grade.ts` 端到端评分流程 | 2026-06-25 全量体检 | ✓ | ✅ 已达成（2026-06-26）：新建 `backend/src/eval/harness.test.ts`（15 用例）覆盖 offline 驱动 runTool 的 roll/choose/browse 等价路径 + 错误路径 + 枚举；`assertions.test.ts` 扩 F1/F2 正反例。⚠️ **实现实证/漂移**：backlog/路线图旧述提的 `src/eval/play-mcp.ts` 在引擎侧**不存在**——真 harness 驱动是 `harness/eval-dicegm/{run,grade,batch,tool}.ts`（offline `runTool` 路径，非 MCP），scenarios 在 `harness/eval-dicegm/scenarios/`；`choose/roll/browse/list_scenarios` 是独立 **dicelore-play MCP server** 接口，不在引擎 eval 内。F-harness-test 已落到 in-scope 的 `backend/src/eval/harness.test.ts` 覆盖等价 offline 驱动路径 |
| lore-format-research | feat | **构建素材格式处理（模型能力依赖）**：[build-agent-workspace](裁决记录/build-agent-workspace.md) §6——素材是否需转文本取决于构建模型（`DICELORE_GM_MODEL` 默认 `glm-5.2`）能否原生读该格式 | 用户 2026-07-01（build-workspace 裁决 §6） | ✗ | ✅ **已裁决作废**（2026-07-01 用户终裁，无 spike）：后端**不做格式转换、不提升模型读取能力**；skill 一律 `Read`/`Bash` 直读，模型读不了的自然不读；不支持的格式**由作者自己提前处理**成可读文本再上传。`materials/` 原样存原文、后端不预设归一化。详见裁决 §6 |
| N20-lore-eval-MCP | feat | **构建侧 CC 驱动 eval MCP（build-mcp）缺失**：F3 已补 lore offline mock harness（零 LLM），但缺「CC 当作者驱动真构建 GM」的对称路径——跑团侧已有 `dicelore-play` MCP（CC 经它连真后端当玩家驱动真 GM），构建侧无对应入口，真 LLM 一局无从跑。建 `harness/eval-loregm/build-mcp.ts`（对称 dice `play-mcp.ts`，连 build HTTP/LoreSession，CC 当作者驱动真构建 GM）+ 注册 `dicelore-build` 进 `.mcp.json` + `.claude/settings.local.json` enabledMcpjsonServers，让**跑团 + 构建两侧都能 CC 驱动 eval**。是 F3 offline mock 的 CC 驱动对称路径，喂 F3「真 LLM 一局」 | 用户 2026-06-26 指示 | ✓（lore 侧真 LLM eval 无入口） | ✅ 达成（2026-06-26）：`harness/eval-loregm/build-mcp.ts`（对称 dice `play-mcp.ts`，CC 当作者经 stdio MCP 连构建 HTTP 驱动构建 GM）暴露 5 工具 `open_build_session`/`send_to_builder`/`get_draft`/`list_catalog`/`get_pack_files`。因 RT-5 后 lore 是 **REST only、构建 GM 响应不经 REST 返回**，eval 模型=**作者发指令 + 检视产物**（catalog/draft）而非收 GM 散文。补 additive `GET /lore-sessions/:id/draft`（复用 `getLoreSession`+`Draft.toPackFiles`/snapshot，填「构建中途 Draft 检视」gap，不改既有端点）。集成测起真 lore 后端 + fake 构建 agent 直驱 `dicelore_build_*` 工具，不烧 LLM（backend 129 测）。已注册 `.mcp.json` + `settings.local.json` enabledMcpjsonServers `dicelore-build`，跑团(dicelore-play)+构建两侧均 CC 可驱动 eval。**真 LLM 构建 GM 一局留「待测试」**（同 F3 真 LLM 部分、dogfooding 真 LLM 一局）。浮现 follow-up [BE-checkout-head](backlog-后端.md#主题--团本构建组件56-)（fix·P3） |
| RT-fake-gm-wiring | feat | **fake-GM 教练档 CanonScript 未接 HTTP/env**：`server.ts:97,101-103` `DICELORE_FAKE_GM=1` 只接纯叙事 echo 档（不传 `{canon,backend}`）；教练档 CanonScript（驱动 roll/choice/gameEnd/narration/error，`FakeDiceGm.ts:29-39,51-57`）**仅测试** `new FakeDiceGm({backend,canon})` 可达、无 env/HTTP 开关；lore 侧更无假构建驱动（用同一 echo `FakeDiceGm` 不调 build MCP → Draft 恒空）。→ acceptance-loop Tier 0 curl 4 条 BLOCKED（掷骰/选择/终局/暗骰/WS-10类打不通）。**是 [FE-e2e-browser](backlog-前端.md) 前置**（路线图已列「server.ts FAKE_GM 工厂接教练档」） | acceptance-loop 0706 RT-fake-gm-wiring | ✓（挡 4 条 curl + e2e 五主线） | ✅ 已交付（2026-07-10·fix-fake-gm-wiring）：`server.ts` FAKE_GM agentFactory 按 env 选教练档 CanonScript（传 `{canon,backend}`）+ lore 侧假构建驱动接 build MCP；已实机 curl 验四主线+lore（wave_1）。**是 [FE-e2e-browser](backlog-前端.md) 前置·已备**。 |

---

## 主题A · 运行时缺少「叙事脚手架」一等抽象 💡

> **2026-06-25 全量体检实证**：**CROSS-TOOLGEN（P0）** = 本主题的头号债反指——toolgen 引擎已建（981 行 6 模块）但**零接线**（`present/` 有 `tensionBoard` 聚合但 grep across `harness/src/dicegm/mcp/` 零命中，未进 TOOLS 工具清单、未注册进 `createMcpServer`）；运行时工具清单 TOOLS 导出（mcp 工具面 barrel）里叙事域读工具不在其中。业务侧承诺"薄到近乎纯声明的 manifest"、spec 承诺 DT-9「团本扩展框架零改动」，实现却是"引擎建好但没接线、跑不通"——"半截工程比没做更危险"。守路线图第二批冻结令治理，链路跑通前一切 feat 冻结。见 [体检汇总 P0-1](../../../audits/2026-06-25-全量体检/06-汇总-合并.md)。
>
> **一句话病根**：同一概念在**团本作者层**有、在**运行时跑团层**塌缩成底层存储原语，AI 拿不到「以这个概念为单位」的**读（聚合视图）+ 写（生命周期操作）**。这是 conceptual integrity 问题，**跨多 session 反复命中、随回合数线性恶化** = 全项目头号架构债。建议**一个设计周期 + 把决策写进对应设计页「决策与权衡」节**统一解，**勿往 gm-core 提示词硬塞**。
>
> **想要**：`NPC` / `Front` / `plotline` / `foreshadow` 的运行时一等抽象（开/进行/收口状态 + 关联锚点 + 到点浮现提醒）+ **一张「未结张力」聚合视图**。Front/Clock（见设计页决策节）与 watcher（见设计页决策节）是部分地基，需评估**扩展 vs 新建**。
>
> **进度（2026-06-24 核对）·存储地基已完、工具面暴露未做**：A2-A5 的物理表 + store CRUD + `tensionBoard`/`frontOmenList` 聚合**均已建**（见主题A′ 进度）。**A1-A5 现在统一的真缺口不是"缺存储"，是"没暴露成 MCP 工具给 GM"**——聚合函数躺在 `present/` 层却没接进 `buildMcp`，GM 仍调不到「以概念为单位」的读；NPC 连一等表都没有。这把 A 主题从"建存储"收窄为"补视图层投影 + 暴露工具 + NPC 升一等"，依赖与路线见主题A′。
>
> **✅ 更新（2026-07-10 acceptance-loop 批·工具面暴露 + presentation 投影收口）**：A1（NPC 一等·2026-06-26）+ 叙事八工具（front/plotline/foreshadow/tension_board·2026-06-25，`stdlib/narration.ts`）已让 A2-A5 的 GM 读写可达；本轮 a-prime §4/§5/§6 补齐 state 类型化读写（删裸 sheet_get/list）+ relation + 记忆工具、§7 presentation 接叙事视图层（plotlines/foreshadows/lore 下发前端·RT-FE4 收口）、§1 叙事三表补 visible 列。**A2-A5「无工具暴露 / 调不到」缺口已闭**（设计沉 [内层 §4.6/§4.8](../04-子系统设计/内层能力库.md) + [MCP工具面](../04-子系统设计/MCP工具面.md) + [接口 D8](../04-子系统设计/玩家客户端-接口.md)）。剩 A6（NPC 双层值裁决侧）正交、留 resolver spec。

| # | 类型 | 缺口 | 现状（2026-06-24 核对） | 来源 | 恶化 |
|---|------|------|----------|------|:--:|
| A1 | feat | **NPC 无运行时一等概念**：团本层有（`world/npc/*.md` + sheets），运行时无「NPC」对象去读/操作 | ✅ **达成（2026-06-26）**：`mcp/stdlib/npc.ts` 声明 4 个 npc 写工具（`npc_register`/`npc_update_affinity`/`npc_update_hp`/`npc_set_identity`），全走声明式范式（ToolDecl→toolgenToToolDef→extraTools 注入），**零硬编码 handler 守 DT-9**；读侧＝已投影的 npc 视图。为让声明式 mutate 写出 `kind='npc'` 行，一次性补齐引擎/store 原语表达力：`store/state.ts`/`store/mutate.ts`/`toolgen/writeTool.ts` 加可选 `kind` 参（向后兼容、ON CONFLICT 不覆写 kind）——属「框架能力生长」非破 DT-9（DT-9 约束团本作者加工具不需改框架；A1 是框架能力建设，扩完后声明 npc 工具零 handler）。+17 测试，core 467 绿。spec/plan 见 `docs/superpowers/`。 | 另一 session | ✓ |
| A2 | feat | **Front/Clock 运行时不可见、不可管**：运行时 AI 无「Front」聚合对象去读/管（Front＝钟+凶兆阶梯+散文） | `front` 表 + `frontOmenList` 聚合**已建**，但**未暴露 MCP 工具**；`watcher_list` 可列底层 armed watcher＝D2✅ | 用户「需要 front」+ eval B6 | ✓✓ |
| A3 | feat | **多情节线/故事线追踪**：情节线不是任何实体属性 | `plotline` 表**已建**，**无工具暴露** | findings B1 + eval | ✓✓ |
| A4 | feat | **伏笔「埋—回收」闭环**：无 planted/recalled 状态、无到点提醒；`event_recall` 是全 log FTS，埋的 note 排不过叙事噪音 | `foreshadow` 表**已建**，**无 planted/recalled 状态机 + 无工具** | findings B2 + eval（13 条 note 硬当伏笔库） | ✓✓ |
| A5 | feat | **未结张力看板**：列「所有未结张力」无聚合视图；game_end 也不和解开放线程 | `tensionBoard` 聚合**已实现**（present 层），但**未接进 `buildMcp`**，GM 调不到 | findings B6 + eval（T30 实测散落） | ✓✓✓ |
| A6 | feat | **NPC 双层值（裁决侧）**：双层值**存储**没问题（表演层 cell 公开 + 真实层 cell 暗）；缺口在**裁决**——`resolve_contest` 每边只一个常数，编不了「表演叫价 vs 真实底线、差额即线索」（裁决侧正交，留 resolver spec） | margin 手解 | findings B5（已缩窄定义） | ✗ |

#### A1 旁 · NPC 产品决策（wave2 浮现 → 2026-06-26 PO 复核裁决）

- **D-NPC-2 NPC 属性默认披露策略**（✅ 采纳，2026-06-26 PO 复核）：**默认暗（`visible=0`），GM 逐项 `show` 揭示**——与现有 sheet 可见性模型一致（沿用 `stateSet` 默认 `visible=0`）。**当前实现已是此默认，故标"已满足/采纳"**，不阻塞 A1 v1。
- **D-NPC-3 NPC 关系建模**（✅ 裁决，2026-06-26 PO 复核）：**v1 走 relation 视图行**（npc 关系走 relation 视图行形态、**不进 anchor 边表**）；**v2 把 relation 提成关系图谱**——让 npc 关系图谱成为独立承重节点（可查询的边表）需升级数据形态，明确记 v2 方向（见 [未来池](#-未来池core-层--明确推迟别现在做)）。不阻塞 A1 v1（v1 用「relation 视图行」可逆默认）。

#### A1 / toolgen 旁 · 张力记录（留观察，非待办）

- **npc mutate 工具 attr 声明期固定**：toolgen `writeMatch :param` 须 ASCII、无法吃任意 attr——泛写若要支持任意 attr 需结构化 `mutations[]` 入参，而那等于硬编码 handler 破 DT-9。即兴任意 attr 仍可用裸 `sheet_update` 兜底，但裸 `sheet_update` 写 `kind=world` **不进 npc 视图**。这是「删除裸 sheet_update」与「npc 一等」之间的张力，留观察、暂不动。


### 主题A′ · 团本构建 ↔ 跑团 术语 / store 不对齐（地基级，需大改）💡⚠️🚧

> 同一病根的**更底层一面**：作者层（团本构建）与运行时（跑团）两侧**术语乱、概念不对齐**。最尖锐的是 **`sheet` 被当成「人物卡」，但它实质是「临时空间」（局内可变状态的临时载体）**——与团本侧设计不符。

- **类型** feat · **来源** 用户判断 + 多 session · **恶化** ✓✓✓（conceptual integrity / 地基级架构债，牵动四域 store 命名与语义、团本 import 映射、gm-core/flow 措辞）。
- **症结**：术语两侧各说各话；`sheet` 误名/误概念（人物卡 ≠ 临时空间）。
- **用户判断**：**跑团侧 store 方案有必要大改，至少与团本侧设计对齐**。应**先统一术语 + 重新概念化 sheet + store 对齐团本**，再谈主题A 的叙事脚手架（A 建在此之上）。
- **路由**：把决策写进对应设计页「决策与权衡」节（两侧术语统一表 + store 重构方案），**与团本构建（组件5/6，里程碑一在建）协同设计**，别两侧继续分叉。
- **落地方向（用户提案）**：给 MCP 加「叙事层」(几张表)、**废弃通用 `sheet`**，改为一组一等 kind/表：`player` / `npc` / `world` / `rule` / `watcher` / `front` / `pool`——每类有自己的表与工具，而非全塞进 `(entity,attr,value)` 通用格，直解「sheet 临时空间误当人物卡」根因。**待商榷**：① 与现四域(sheet/event/world/rule)如何重映射(world/rule/pool/watcher 已有、npc/player/front 需升一等)；② 原 sheet 的「临时空间」真实职责是否单列一类；③ 与团本 import(组件5/6)对齐。
- **进度（2026-06-24 重评）🚧 地基已完、工具面暴露未做**：方案已沉 wiki：[核心概念 §2 D6](../02-领域模型/核心概念.md) + [内层能力库 §4](../04-子系统设计/内层能力库.md)（拱心石＝物理表精简 + kind 视图 + 业务工具；非"每概念一张物理表"，relation/flag/clock 是 `state` 的行形态）；**7 条欠账已于 2026-07-10 交付收口**（见下「a-prime 半截工程收口」，裁决文件已删、设计沉 [内层 §4.6/§4.8](../04-子系统设计/内层能力库.md)）。
  - ✅ **改名段**已落 `main`：`sheet→state`(+`kind`/`rel_*`/`clock_*` 列)、`event→log`(+`is_moment`)、`world_doc→lore`、fts 随改（见设计页决策节）。
  - ✅ **补充改名** `rule_doc→rule`/`world_pool→pool` 已落。
  - ✅ **叙事/记忆物理表** `front`/`plotline`/`foreshadow`/`history`(+`anchor`) **已建** + store CRUD + `tensionBoard`/`frontOmenList` 聚合（present 层）。
  - ✅ **声明式工具生成层引擎** `toolgen/`（SQL 闸/视图定义/读写工具编译/写匹配防泄露）已建，6 模块 981 行 + 6 测试绿。
  - ✅ **视图层投影（①，2026-06-25 落地）**：spec §4 的 6 命名视图（`player`/`npc`/`world`/`relation`/`clock`/`tension_board`）经 `store/views.ts` `initViews(db)` 用 `defineView` 投影、接进 `initSchema` 末尾（全仓 freshDb 自动获得视图）；`tension_board` SQL UNION 四表（front/plotline/foreshadow/watcher → 统一 `kind/id/label/status`）。present 层 JS 聚合保留作上层业务面，SQL 视图作下游 toolgen 稳定列契约，单源不同层。core 405 测试 + tsc 全绿。**toolgen 读工具的前置闸已拆除**。
  - ✅ **②③ 接线 + 叙事层 dogfooding（2026-06-25 落地）**：① 适配层 `toolgen/toToolDef.ts` `toolgenToToolDef(decl)` 把 `compileTool` 产物适配成 MCP `ToolDef`（zod schema、出参包 `{result}`、读 `readOnlyHint=true`）；② 标准库声明 `mcp/stdlib/narration.ts`（front_open/plotline_open·advance·close/foreshadow_plant·recall·abandon/tension_board 八工具，**全用声明、零硬编码 handler**）；③ `createMcpServer(db, deps, extraTools?)` 加可选 `extraTools` 入口（DT-9 守约：现有 19 工具零改动），生成工具与 `TOOLS` 并列注册。dogfooding 集成测试验证经 server 端到端落库 + 承重墙不破（写经正典原语）+ 坏声明编译期被拒。core 425 测试 + tsc 全绿。**spec DT-9「新工具=新声明、框架 core 零改动」契约在框架标准库侧已兑现**。
    - ⚠️ **front_advance 撞 DSL 天花板（已知限制）**：推进 Front 的 clock 需跨 `state`(clock 行)↔`front`(clock_ref) JOIN，writeMatch 三模式（mutate/setStatus/insert）不支持 JOIN 写 → 无法纯声明。正是 spec §8 预言的「撞 DSL 天花板」。v1 不声明 `front_advance`；解法候选（留后续）：① 加 writeMatch 第四模式（clock 推进专用，绑 `front.clock_ref` 解析）；② 给 front_advance 留硬编码 handler（破 DT-9，下策）；③ 团本 flow skill 内分两步（先 query clock_ref 再 state mutate，但跨两次调用非原子）。记 backlog 待 DSL 扩展周期。
  - ✅ **团本侧声明装载（A′③ 收口，2026-06-26 落地）**：团本 pack `tools/*.json`（`ToolDecl[]`）→ `validatePack` Rule 8 守 DT-9（复用 toolgen `compileTool` 校验，拒 DROP/ATTACH/多语句/非叙事表 INSERT/子查询/同名/非 json）→ `catalog/import.ts` `importPack` 回传 `toolDefs` → `DiceSession` 经 `createMcpServer` extraTools 装载（**首次 import** 时）。core 501 测。**follow-up（产品残余，记本页主题A′ ④）**：作者声明工具是否需服务端可关开关（关联 [FE-mcp-config](backlog-前端.md) v1 不接入、快照设计页决策节 ⑤）。
  - **依赖链（单向）**：叙事层总纲(定视图契约) → 谓词扩展(step①建表✅) → toolgen(step②引擎✅) → 视图层投影✅(①拆闸) → **业务工具声明✅(②③ 框架标准库 dogfooding 跑通)** → 团本侧 tools 段装载✅(A′③ 收口)。
  - **④（follow-up，新增 2026-06-26）** feat：**作者声明工具的服务端开关**——团本作者在 manifest 声明的自定义 `tools:` 是否需服务端可配「接受/拒绝/开安全扫描」开关（v1 直接首次 import 装载、无开关）。关联 [FE-mcp-config](backlog-前端.md) v1 不接入运行时（推迟池）+ 快照设计页决策节 ⑤ MCP 包安全扫描规划。**v2 周期做**。
  - A6 裁决侧正交、留 resolver spec。
  - ✅ **a-prime 半截工程收口（2026-07-10 acceptance-loop 批）**：a-prime-completion 裁决 7 条欠账交付——§1 叙事三表补 visible 列 / §4 state 类型化读写工具（player/npc/world）+ 删裸 sheet_get/list（保留 sheet_update 兜底 + sheet_show·TOOLS 21→19）/ §5 relation_set·relation_query / §6 mark_moment·history_compact·recall / §7 presentation 接叙事视图层（plotlines/foreshadows/lore 下发·RT-FE4 收口）。§2/§3（front_omen 物理子表 / anchors_json+surface_trigger 列）**已被 narrate-hook-extension 的 spec 路线否决废弃**（front_omen=watcher 视图 / anchor 边表 / foreshadow=watcher 行，已落 main）。设计沉 [内层 §4.6/§4.8](../04-子系统设计/内层能力库.md) + [MCP工具面 决策节](../04-子系统设计/MCP工具面.md) + [接口 D8](../04-子系统设计/玩家客户端-接口.md)。**caveat**：recall 未转义 %/_（见 [backlog-后端 W2-recall-escape](backlog-后端.md)）。**主题A′ 至此收口**（裁决文件已删）。

---

## 主题 · 裁决 / 披露 / 终局 增强 💡

> **2026-06-25 全量体检实证**：**CROSS-END（P0）** = E1/E2 的体检反指——成功标准定总判据为"F1/F2/F3 被治住"但未定"一局何时算终局"；设计页决策节定了 game_end/you_death 唯二出口但"何时敲、由谁敲"未定；core `gameEndHandler`（`io.ts` L74-82）只落 note event + `metaSet(db,"ended")`——无任何触发条件校验（GM 调即终局）。eval harness 跑多少轮都无法回答"做成了"。违"AI 有讨好本能、不可信"立项前提。注：BE-007 的 `GET /sessions/:id` ended 硬编码 bug 是独立 fix（在 [backlog-后端](backlog-后端.md)），不依赖 E2 决策。见 [体检汇总 P0-2](../../../audits/2026-06-25-全量体检/06-汇总-合并.md)。
> **✅ 已裁决（2026-06-25 → 2026-06-26 PO 复核定稿，见对应设计页决策节）**：① 终局触发=**GM 自调 `game_end`**（gm-core 教条教"何时收场正当"，框架不硬拦——避免框架据 HP<=0 等硬条件误判"复活"等可逆状态触发终局）；② **软判据**（gm-core 教条用"Front 钟满 / 主线收束 / 玩家死亡"等叙事判据引 GM 自收，不用硬条件触发器），复活的交互靠 GM 教条自己判、不靠框架死规则；③ **玩家主动结束权**——玩家可随时主动结束游戏防 GM 永不收局（GM 讨好本能下真实风险）；④（**2026-06-26 PO 复核修改**）**game_end 后直接进复盘模式**——v1 **删除"结束游戏"按钮**，终局后进入复盘模式（GM 复盘 + 给行动建议，原"要 AI 建议"升为默认去向），从复盘模式可重开新局；**回溯续命留 v2**（状态回退到死亡前叙事继续，**非对话撤回**，依赖快照，见设计页决策节）。落进对应设计页决策节。

| # | 类型 | 问题 | 现状 | 来源 | 恶化 |
|---|------|------|------|------|:--:|
| B7 | feat | **「带修正 ∧ 分级」检定无原语**：`resolve_outcome`（分级 bands）die 只吃纯 `NdS`、加不了修正；`resolve_contest`（吃修正）只回二元胜负。GM 想「掷+加值→超出难度多少决定后果程度」两个工具都不趁手 | 把加值**手算烘进每条 band 阈值**，玩家明骰看到裸骰，加值一变就重算整表 | eval（兽人局**几乎每个明骰**都踩）✅ | ✓（随属性成长越痛） |
| C1 | feat | **分级线索披露**：`reveal_once` 只能整格快照（全有/全无）；「按检定档给不同信息量」表达不了 | 分级线索全塞进 outcome band consequence；50 回合探索局 **reveal_once 一次没用上** | eval B4 ✅ | ✗ |
| E1 | feat | **终局判据**：gm-core 教「别朝结局叙事」却没教「何时收局正当」→ 真 GM 可能永不收局或只死亡收 | ✅ 已裁决（见设计页决策节）：gm-core 加"终局判据"软教条；教条措辞仍待 F2 harness 多轮校准 | F2 + 用户 | — |
| E2 | feat | **终局机制（数据层）未设计**：缺让团本作者**在 rule 里配置终局条件**的机制；候选 watcher 谓词，但**「复活」如何算待商榷**（以死亡/HP≤0 作终局 watcher，遇复活 / 快照回滚就矛盾） | ✅ 已裁决（见设计页决策节）：不用硬条件触发器、走 GM 自调 + 软判据 + 玩家主动结束权 | 用户 | — |

**B7 解法草案**：`resolve_outcome` 增 `modifier?: expr`（引擎求值 `{ref}`+常数加到 roll 再 rangeMap），出参回 `roll/modifier/total/band`，玩家视图显「裸骰+加值=总值→档」。评估与 contest 合并为「掷值→(对抗线|档表)」单一抽象。
**C1 解法草案**：「按检定档披露分级线索散文」原语（线索 ≠ 实体属性 ≠ 世界条目）。
**E1 裁决（见设计页决策节·2026-06-26 PO 复核）**：gm-core 加"终局判据"软教条——Front 钟满 / 主线收束 / 玩家死亡作**引 GM 自收的判据**（非框架硬触发），教条措辞待 F2 harness 多轮跑测校准。
**E2 裁决（见设计页决策节·2026-06-26 PO 复核）**：**不用硬条件触发器**（避免复活等可逆状态误判触发终局），走 GM 自调 `game_end` + 软判据 + 玩家主动结束权；团本作者可在 rule 里写"终局判据"作 GM 教条输入（非自动触发 watcher）。**game_end 后直接进复盘模式**——v1 删"结束游戏"按钮，终局后进复盘模式（GM 复盘 + 行动建议）+ 重开新局入口；**回溯续命**（状态回退到死亡前叙事继续，**非对话撤回**，依赖快照，见设计页决策节）**留 v2**。与 E1 配套：**E2 = 机制上何时算终局，E1 = GM 叙事上何时收局**。

---

## 主题 · 快照/回滚（CROSS-SNAP）💡

> **2026-06-25 全量体检实证**：**CROSS-SNAP（P1）**——快照/回滚机制三层全断：① DB 层 `snapshot` 表未建（`db.ts` L23-102 initSchema 建表清单无 snapshot 表，L100 注释明示"并行未 rebase 进来"）；② 引擎无 `checkpoint()`/`restore(snapshotId)` 原语 + 无 `SnapshotParticipant` 注册表；③ 会话宿主 `DiceSession.turnEnd` 不调 `checkpoint()`、`UserPromptSubmit` hook 在 Phase 1 根本没接 Agent SDK；④ 前端 PlayPage 无回滚 UI（grep save/load/存档/读档/回滚/rollback/快照/undo/redo 零命中）。架构层（§3.2 + 快照设计页决策节 + 内层 §4.5 + adapter §8）设计自洽（快照表树形+transcript 锚、IoC 注册表、event 脊柱不入快照、branch 是 transcript 树自然产物），但实现零接线——"设计自洽但实现零接线"的活体断节。见 [体检汇总 P1-6](../../../audits/2026-06-25-全量体检/06-汇总-合并.md)。
> **✅ 已裁决（2026-06-25，见快照设计页决策节 v1 降预期）**：**v1 降预期**——v1 做**自动持久化（存档/读档）**，**手动回滚 / branch 留 v2**。终局续命（[E2](#) 回溯续命）、死错反悔、超时恢复（[RT-1](backlog-后端.md) 长期 restore）都留未来/v2。理由：v1 开放手动回滚需补 snapshot 表 + core 原语 + hook 接线 + REST 端点 + UI 五层，scope 过大且与终局机制（见设计页决策节）耦合；v1 先把"存档/读档"自动持久化做掉守"随时能玩"卖点，回滚/branch 等交互留 v2。
> **关联**：与 CROSS-TIMEOUT（[backlog-后端](backlog-后端.md)）超时半途状态叠加——超时后无 restore 兜底（长期方案 v2 依赖快照接线）；与 USER-002（[backlog-前端](backlog-前端.md)）终局后流程——v1 去掉"回滚"按钮只留三按钮（见 [FE-end-lock](backlog-前端.md)）。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| SNAP-1 | feat | **快照回滚三层全断**：snapshot 表未建、core 无 checkpoint/restore 原语、Stop 不写快照、前端无回滚 UI。玩家死错了想回上一回合无入口——"尊重骰子、不崩坏"卖点在"骰错了想反悔"诉求上落空；branch/swipe（快照设计页决策节上修进 v1）无法实现 | 2026-06-25 全量体检 | ✓（随回滚诉求越痛） | ✅ 已达成（2026-06-26）·已裁决（快照设计页决策节 v1 降预期）：**v1 自动持久化已落**——core `store/snapshot.ts`（snapshot 表全量整表 dump/回合 + `checkpoint()`/`restore()` + `SnapshotParticipant` IoC 注册表，v1 注册 sheet/world/watcher、rule 不注册、world restore 重建 `lore_fts`）；orch `DiceSession.turnEnd` 自动 checkpoint + `rewind()` 串行 + `POST /sessions/:id/rewind`（无快照 409）；web `client.postRewind` + `useSession.rewind` + PlayPage 读档按钮 + i18n。三包绿（core 477+/orch/web）。**v2 留**——手动回滚按钮 + branch/swipe + 终局续命 + 死错反悔 + 超时 restore 接线。**follow-up（记本表 SNAP-1-reload）**：v1 团本 tools/快照仅**首次 import 装载**，重开已存在 session **不重载团本工具**（catalog 不在场）——持久化/重开重载留 follow-up |
| SNAP-1-reload | feat | **重开 session 不重载团本工具**：SNAP-1 v1 团本自定义工具仅在**首次 import** 时经 `createMcpServer` extraTools 装载；重开一个已存在（已持久化）的 session 时 catalog 不在场，团本声明工具不重载——重开后 GM 调不到团本自定义工具 | SNAP-1 实现 follow-up（2026-06-26） | ✓（随团本工具普及越痛） | 🆕 待开发：session 重开路径需重新解析团本 manifest `tools:` 段并经 extraTools 重载（或把 toolDefs 随 session 持久化）。依赖 [A′③](#) 装载机制（✅） |

---

## 主题 · 多会话并发隔离（gate 进程单例）💡

> **2026-06-30 113-agent review 延后项**：`rollGate` 与明骰 gate 是**进程级模块单例**，与 per-session 注入设计（见设计页决策节）直接矛盾——backend 端口已按会话注入，唯独 gate 这条缝仍是全局。已裁 **v1 单人 stdio、多人 per-instance gate 留未来**（见设计页决策节），本主题把该欠账落成 concrete 条目（review 确认这是真竞态、非纯理论）。与 [主题S · S2](#主题s--战略风险--claude-code-承重绑定-) port 契约、[backlog-后端 G-后端-Phase2](backlog-后端.md) per-instance gate 硬化同源。

| # | 类型 | 问题 | 位置 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|------|:--:|--------|
| CONCURRENCY-gate | feat | **明骰 gate 进程级单例、多会话并发互相覆盖**：`PlayerRollGate` 本是 per-`DiceSession` 实例（闭包捕获本会话 hub/sessionId/waiters），但经 `createMcpServer→setRollGate(deps.rollGate)` 注入到 `mcp/rollGate.ts` 的进程级模块单例 `_gate`；resolver 明骰 handler（`outcomeOpenHandler`/`contestOpenHandler`）读的是全局 `getRollGate()`。后端 registry 同进程托管多会话，每个 `new DiceSession` 构造时 `setRollGate` 覆盖全局 → 最后构造的会话 gate 顶掉先建会话：A 会话明骰 `roll_staged` 广播进 B 的 hub、A 点掷骰落到 B 的 waiters。现有测试 `beforeEach(setRollGate(undefined))` 串行复位掩盖了这条生产竞态 | `harness/src/dicegm/mcp/rollGate.ts:15-17` + `mcp/server.ts:71` + `handlers/resolver.ts:65,74` + `DiceSession.ts:87-90` | 2026-06-30 113-agent review（Wave1 延后，跨 harness/backend、属已裁未来项，见设计页决策节） | ✓✓（多租户/eval 多会话并发放大） | 去模块级 `_gate`：`createMcpServer` 把 `rollGate` 闭包进 handler 工厂（`makeResolverTools(backend, rollGate)`）随会话注入，或 gate 签名带 sessionId 路由；补「两并发会话各自明骰互不串台」回归测试。**已裁 v1 单人可接受、多人必做（见设计页决策节）**——随 per-instance gate 硬化（[backlog-后端 G-后端-Phase2](backlog-后端.md)）一并解 |

---

## 主题 · storage-port 端口补缺（消除顶层裸 SQL）🔧

> **2026-06-30 113-agent review 延后项**：storage-port 设计（见设计页决策节）§2 定「harness 只依赖端口、backend 不暴露原始 db」，§4 接受的 4 处直连**仅限组合根**（`mcp/main.ts` + 3 hook 脚本）。但 harness 顶层会话路径（DiceSession/turnLoop/recovery/ruleRecall）与 backend `browse` 空 q 分支多处仍跑**裸 SQL**，根因＝**Store 端口面不全**：缺 `logHead/maxSeq`、`listPendingRolls(status)`、`narrativeCursor`、`loreList/ruleList`。端口补齐后这些裸 SQL 才能消除，否则 harness 焊死在 SQLite 表名/列名上，换存储/加 cache（端口核心收益）时全断。Wave1 各区报告此项「缺端口、修不动」而延后。与该设计页决策节 §2 承诺直接相悖。

| # | 类型 | 问题 | 位置 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|------|:--:|--------|
| PORT-store-reads | fix | **Store 端口缺只读方法，逼 harness/api 绕端口裸 SQL**：① `recordTurnStart` 收 `(backend, db)`、内部 `SELECT MAX(seq) FROM log` 取 head 再经端口写（`ruleRecall.ts:22`）；② DiceSession 顶层多处裸 SQL——`enrich` 读 log content（:102）、`handleChoice` 读 choice event + INSERT note（:174/187）、turnEnd 取 MAX(seq)（:259）；turnLoop 取 MAX(seq)（:39）、recovery 列 awaiting pending_roll（:19）；③ backend `browse` 空 q 列全量直裸查 rule/lore 表（`api/dice.ts:155/163`）、`presentation.ts:49/53` 裸 `SELECT MAX(seq)`。端口面缺口：`Store` 有 `logSince/getPendingChoice/getPendingRoll`（单条）但无 `logHead()/maxLogSeq()`、`listPendingRolls(status)`、`narrativeCursor()`、`loreList(limit)/ruleList(limit)` | `harness/src/dicegm/adapter/ruleRecall.ts:22` + `DiceSession.ts:68,102,174,187,259` + `turnLoop.ts:39` + `recovery.ts:19` + `backend/src/api/dice.ts:155,163` + `present/model.ts`(MAX seq) | 2026-06-30 113-agent review（Wave1 延后，缺端口跨层修不动） | ✓（换存储/加 cache 时全断；扩散中——多处自抄 maxSeq） | 给 `Store` 端口补 `logHead()/maxLogSeq()`、`listPendingRolls(status)`、`narrativeCursor()`、`loreList/ruleList(limit)`，由 `openSessionBackend` 闭包实现；`recordTurnStart` 去 db 参改 `backend.logHead()`，`handleChoice` 读用 `logSince/getPendingChoice`、写用 `logAppend`，`browse` 空 q 分支改调 `loreList/ruleList`；改完 `DiceSessionDeps` 可彻底不收 db（仅组合根 importPack 另议）。关联 [backlog-后端 RT-6 enrich 收口](backlog-后端.md) |

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
> - **CROSS-DEADLINK（P2）**：~~wiki 8 处死链引用已不存在的 `05-现状与计划/问题总账.md`~~ **✅ 已清（2026-06-30）**：问题总账（已被 backlog 三池取代）的死链全部按语境重指 backlog 三池；03/04 节内 `TODO.md` 已删（内容已沉淀进设计页决策节/backlog，未结项已在三池）。**仍剩**：M1-b (乙) eval 文件死链（grader.md/findings.md）。
> - **PROD-010（P2）**：定位漂移——品类词统一为"文字冒险游戏"、安科/安价升维为"载体"（见设计页决策节），但安科安价是什么页仍以安科/安价为"玩法/游戏类型"开篇、术语表"安科/安价"词条未升维为"载体"。
> - **PROD-011（P2）**：愿景 §4（美观/现代 UI/移动端/社区生态）无 backlog 承接、无验收口径——业务增愿景但下游 backlog 无条目、里程碑四"社区适配与持续迭代"是占位无拆块。
>
> 以上四项均属"业务动了、下游没跟"的 wiki 推导链系统性断节（见 [体检汇总 §共性病根 2](../../../audits/2026-06-25-全量体检/06-汇总-合并.md)），由 ``roadmap-delivery-workflow`（wiki 结构整理变体）` skill 处理，长期任务、无批次。建议把"定位漂移清理 + 死链修复 + 分型单源统一"单列一次 `roadmap-delivery-workflow`（wiki 结构整理变体） 专项。

| # | 类型 | 问题 | 来源 | 下一步 |
|---|------|------|------|--------|
| M1 | docs | **wiki 空间因快速迭代变乱**：多 session 高速迭代下，推导链页/决策节/设计页/06 出现冗余、过期、交叉错位（旧 TODO 锚点、计数/状态散落、设计页与实现漂移等；如 2026-06-23 定位升维后，愿景陈述在定位设计页决策节与 用户与场景 §4 轻微重复、待收拢单源） | 用户 | **由 ``roadmap-delivery-workflow`（wiki 结构整理变体）` skill 处理**（去重、对齐单源、修过期链接与计数、补设计-实现漂移）。**长期任务、持续进行**，非一次性。**需 `roadmap-delivery-workflow`（wiki 结构整理变体） 加注**：用户与场景 §1 D 分型加"v1 不实现、仅理论锚点"（[TB-4](#主题--测试边界体检新增) 裁决，见设计页决策节关联） |
| M1-a | docs | **玩家分型单源违例**（PROD-006）：术语表/调研页仍用旧"替代派/相棒派"二分，未跟用户与场景 §1 四类切面升维 | 2026-06-25 全量体检 | `roadmap-delivery-workflow`（wiki 结构整理变体） 专项：术语表"替代派/相棒派"词条改为"历史分型、已被四类切面取代（见用户与场景 §1）"；调研-期待与预测 §四 加注"本节为历史调研记录、现行分型见用户与场景 §1"。权威单源 = 用户与场景 §1 |
| M1-b | docs | **wiki 死链批量清理**——**(甲) `问题总账.md` 死链：✅ 已清（2026-06-30）**：问题总账（已被 backlog 三池取代）的死链全部按语境重指 `backlog-{core,前端,后端}.md`；`03-架构/TODO.md` + `04-子系统设计/TODO.md` 已删（resolver 二轴速查表抢救进 MCP工具面 §1、入站链重指设计页决策节、未结项已在三池）。**(乙) eval 文件死链**（仍剩）：`harness/eval-dicegm/grader.md` 与 `harness/eval-dicegm/findings.md` **实测不存在**，但 `04-子系统设计/Skills-eval.md`(L37/L65/L66)、`backlog-core` 本页 L4/L23 头注仍引用——需核实：A/B 对照口径已废（改对照真实案例定性报告，见主题F 决策注记）→ 倾向删 findings.md/grader.md 引用、改指 `play-eval` skill + `docs/research` | 2026-06-25 全量体检 + 2026-06-30 113-agent review W6 校验 | **(乙) 待办**：核实后删悬空引用、改指 play-eval skill + docs/research 对照口径 |
| M1-c | docs | **定位漂移**（PROD-010）：品类词统一为"文字冒险游戏"、安科/安价升维为"载体"（见设计页决策节），但下游（安科安价是什么页、术语表）仍以安科/安价为"玩法/品类"定义 | 2026-06-25 全量体检 | `roadmap-delivery-workflow`（wiki 结构整理变体） 专项：安科安价是什么页顶部加定位注记"本页定安科/安价这一载体的背景；品类词统一为文字冒险游戏、安科/安价是其首发载体，见对应设计页决策节"；术语表"安科/安价"词条加"载体"定性；不改玩法定义本身只升维定位层级 |
| M1-d | docs | **愿景 §4 无承接**（PROD-011）：用户与场景 §4 愿景（美观/移动端/社区生态）无 backlog 承接、无验收口径 | 2026-06-25 全量体检 | `roadmap-delivery-workflow`（wiki 结构整理变体） 专项：在用户与场景 §4 为每条愿景加"v1 边界"（美观现代 UI v1 做到墨金 token 全量已落地、社区生态 v1 不做里程碑四、移动端 v1 不做长期愿景 backlog 显式推迟）；**移动端从长期愿景提前到发版优先（安卓+Win）**（见设计页决策节裁决），需 `roadmap-delivery-workflow`（wiki 结构整理变体） 改用户与场景 §4 把"移动端适配长期愿景"改为"移动端 v1 发版优先（安卓+Win）、见对应设计页决策节"；客制化/社区生态进里程碑四占位拆块（人工维护） |
| M1-e | docs | **设计-实现漂移：stripReasoning 已删、wiki 仍描述为生效机制**（2026-06-30 113-review W6）：Wave1 已删 `harness/runtime/reasoning.ts`（`stripReasoning` 死代码，narration 改走 narrate event 后无生效点，见 [backlog-后端 BE-stripReasoning-wire](backlog-后端.md)），但 `04-子系统设计/后端双路径架构.md` 仍三处描述该函数为活机制：L29 目录注解列 `runtime/...reasoning`、L94 §9「`stripReasoning` 剥 think、接在 DiceGm narration 抽取」、L114 §⑧「`stripReasoning` 剥 think 段」（归档决策 README §⑧ 同步）。代码已无、wiki 单源页仍宣称「有此机制且接在某处」 | 2026-06-30 113-agent review（Wave1 删码后 wiki 未回改） | `fix-wiki-issues` 变体：改写 §9/§⑧/目录注解为「`stripReasoning` 已废弃/未接入——narration 改从 narrate event 来后无生效点；多模型 think 过滤若仍需，在真接入点（provider 适配层）重接并补集成测试」；与 [backlog-后端 BE-stripReasoning-wire](backlog-后端.md) 同步关闭（删码 + 改 wiki 一把过） |
| M1-f | docs | **设计-实现漂移：hook 文件形态 .mjs ↔ .ts**（2026-06-30 113-review W6）：`04-子系统设计/adapter与L3审计.md` §1 目录树（L39-41 `session-start.mjs`/`turn-start.mjs`/`turn-end.mjs`）+ settings.json 示意（L55-59 `node` 跑 `*.mjs`）+ §3.1/3.2/3.3 全程 `.mjs`，理由「Node 写、无 build step、避 .cmd shim」；但 `adapter/templates.ts:26` 实际生成 `command:"node" args:["--import","tsx",<abs>.ts]`，init 拷的也是 `.ts`。这对 `npx dicelore` 发布形态是真实运行期依赖前提（须把 tsx 列 dependency），wiki 权威页未记此形态变更 | 2026-06-30 113-agent review（实现改形态、上游页未回改） | `fix-wiki-issues` 变体二选一对齐：① tsx 入口定案 → 回改 adapter§1 `.mjs→.ts` + 命令形态 + 记 tsx 运行期依赖前提（发布包 tsx 须 dependency 非 devDependency）；② 发布形态应纯 `.mjs`（无 tsx）→ init/templates 改拷编译后 `.mjs`。无论哪条，消除 wiki↔代码形态分叉 |
| M1-g | docs | **单源张力：Skills-eval.md 内部对 buildPlayerView 自相矛盾**（2026-06-30 113-review W6）：同页两处口径打架——L13/L86「`buildPlayerView` 的 mock 契约现由真后端 WS+presentation **兑现**」「裸 CC harness 路线已弃」（即已被取代、退役）vs L19「`buildPlayerView(db)` = 玩家**应该看到的全部**」、L75「行为对错由 `buildPlayerView` **已固化**（玩家只见 narrate）」（即仍是活的评分契约）。读者无从判断 buildPlayerView 是退役 mock 还是现行权威；与 [backlog-后端 tensionBoard/playerView 孤儿模块](backlog-后端.md) 实证「present 层 playerView 当前无运行时消费者」叠加——若已被 WS+presentation 取代，wiki 应统一表述为「历史 mock 契约、现由真后端兑现，行为口径已迁 presentation」 | 2026-06-30 113-agent review | `fix-wiki-issues` 变体：统一 Skills-eval.md 对 buildPlayerView 的表述（退役 mock vs 活契约二选一并单源化），与 present 层 playerView 是否删（见 backlog-后端孤儿模块条）联动定 |
| M2 | refactor | **「团本」实体标识符未对齐英文定名 `Adventure`**：[术语表](../../术语表.md) 已定名团本英文 = `Adventure`，但代码标识符仍为拼音 `tuanben`（实体：`tuanbenId`/`TuanbenSummary`/`doGetPackFiles` 参数等，散见 `backend/src/catalog`·`build`、`backend/src/api/{lore,dice}.ts`、`frontend/src/api/client.ts` 及多处 e2e/测试）。**纯命名漂移、零行为变化** | 用户定名 2026-06-26 | 跨 backend/harness/frontend 正则批量改名 + 测试兜底（[机械改名用正则]，别上 SDD）：实体 `tuanben*`→`adventure*`；**文件层 `Pack`/`PackFile`、库 `Catalog` 语义不冲突、保留**；**禁复用 `Scenario`**（已被 eval 种子占用）。低优先、不阻塞功能 |

---

## 主题 · 测试边界（体检新增）🔧

> **2026-06-25 全量体检实证**：边界测试全缺是"改一处坏别处"的高回归风险区——无测试守则任何后端改动都可能默默 break 而测试全绿。见 [体检汇总 P1-12/P1-13](../../../audits/2026-06-25-全量体检/06-汇总-合并.md)。

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| TB-1 | feat | **并发/超时/重启恢复/注入四类边界测试全缺**（CROSS-BOUNDARY-TEST，P1）：grep concurren/race/parallel across test files 零命中——BE-002 并发竞态无测试；grep timeout/abort/recover across .test.ts（非 live）零命中——BE-001 超时半途状态无测试；recovery.test.ts 测了 restagePendingRolls 重弹正向路径但未测"waiters 空 + POST /roll 409 死锁"场景；grep inject/ssrf/恶意/注入 across test files 零命中——ARCH-009/BE-005/BE-006 注入无测试 | 2026-06-25 全量体检 | ✓✓（随代码增长回归风险线性升） | ✅ 已达成（2026-06-26，wave3）：新增 `harness/src/dicegm/boundary.test.ts`（15 用例），四类边界全覆盖——① **并发**：HTTP 409 `turn_in_progress` 映射 + inflight 释放后可再触发；② **超时**：当前行为**基线**（RT-1 未修——GM error 吞成 error 流、不发 turn_ended、inflight 释放，注释标 RT-1 修后断言变）；③ **重启**：contest 形 pending_roll 无 waiter 立即掷 + 端点幂等 + 未知 eventId 仍 409；④ **注入**：透传现状**基线**（SEC1 未做——文本不限长/不剥控制字符/不识别指令，原样进 GM，注释标 SEC1 落地后断言变）。依赖 RT-2（已达成）、[RT-3](backlog-后端.md)（已达成，wave2）。注：RT-1/SEC1 真修后回炉把基线断言改正向 |
| TB-2 | feat | **live 测试默认 skip 不进 CI**（CROSS-LIVE-TEST，P1）：`DiceGm.live.test.ts` L13-15 `describe.skipIf(!LIVE)` 默认 skip；FAKE_GM 走完全不同的 FakeDiceGm 类、不经过 DiceGm，故 FAKE_GM=1 也验不到 DiceGm 的 SDK 装配。DiceGm 的 SDK 适配（query/options/mcpServers/abortController/settingSources/allowedTools）是真 GM 调用链承重层，任何改动（升级 agent-sdk、调 options）都可能静默破坏——commit 30fdfb0 加超时兜底的动因就是 eval 卡死，是真 SDK 路径无回归保护的例证 | 2026-06-25 全量体检 | ✓（随 SDK 版本升级越痛） | 🔧 补：① 抽 DiceGm 的 SDK 装配逻辑（query options/mcpServers config/abortController）为纯函数，FAKE_GM 模式下跑装配断言（不烧 LLM、验 options 形状）；② 或加 mock SDK（mock `@anthropic-ai/claude-agent-sdk` 的 query）跑 DiceGm.runTurn 的非 LLM 部分；③ 真 LLM live 测试留 RUN_LIVE 手动跑，但发版前必跑一次（纳入发版前 checklist，见路线图第五批）。与 [主题S · S2](#主题s--战略风险--claude-code-承重绑定-) port 契约重构配套。 ✅ 达成（2026-06-26 wave4）：抽 `dice/gmAssembly.ts` 纯函数 `buildQueryOptions`（SDK options 装配：MCP 挂载/staged 门控/systemPrompt/model/abort 透传），`DiceGm.runTurn` 调它行为零变化；`gmAssembly.test.ts` 9 例 offline 装配断言（不 import SDK，验 options 形状）。真 LLM `live.test` 仍 `describe.skipIf(!LIVE)`（发版前手动跑，第五批 checklist）。 |
| TB-3 | feat | **lore WS 测试缺口**（BE-009-LORE-WS，P2）：lore.test.ts 只测 REST 端点，grep `lore.*ws|lore-sessions.*ws` across test files 零命中——BE-003 lore WS 缺失无测试（因实现就没有） | 2026-06-25 全量体检 | ✓ | 🔧 **随 v2 WS 补**（[RT-5](backlog-后端.md) 裁决 v1 不补 lore WS、推 v2）：v1 lore 走 REST only 删死代码无 WS 测试需求；v2 补 lore WS 时一并补 lore WS e2e 测试（构建台 WS 连接→turn_started→narration_commit→turn_ended） |
| TB-4 | feat | **D 流畅派无 backlog 承接且架构层无落点**（CROSS-D，P2）：用户与场景 §1 D 流畅派架构落点写"约束多智能体编排深度（agent 数/反馈轮次 vs 延迟 trade-off）"但 backlog 三池无相关条目；架构层（§5 + 裁判 subagent 设计页决策节）已把裁判 subagent 降为未来、v1 单 agent + Stop hook 脚本——当前架构无多智能体编排深度可言；玩家侧无延迟反馈护栏（无"已等 X 秒"/agent 轮次提示）；四切面本身未做定性验证（中国侧证据偏弱） | 2026-06-25 全量体检 | ✗ | ✅ 已裁决（2026-06-25）：**v1 不实现**（标理论锚点）；多智能体编排 v1 不实现；**流畅派透明化也是 v2**（见 v2 规划条目「前端过程透明化」）。🔧 ① 在用户与场景 §1 显式标注"D 分型架构落点 v1 不实现、仅作理论锚点"避免下游误以为已承接（需 `roadmap-delivery-workflow`（wiki 结构整理变体），见 [M1](#) 加注）；② 落地前在欧美+中国玩家中做定性验证。**v2 规划见未来池新增条目「前端过程透明化」** |
| TB-5 | feat | **skills-structure 测试不校验工具名与 MCP 注册表一致**（2026-06-30 113-review 延后）：`harness/src/dicegm/adapter/skills-structure.test.ts` 只断言 SKILL.md 存在/frontmatter name 对得上/body<500 行/四 references 在，**不检查 skill 正文反引号包裹的 `resolve_*`/`sheet_*`/`world_*` 工具名是否 ∈ 真实工具集**（`BUILTIN_TOOL_NAMES`）。正因缺这条断言，Wave1 修的三处裸名漂移（`resolve_outcome`/`resolve_contest` 等 open/hidden 拆分后留下的非法裸名）才能长期不被发现。skill 是注入 GM 的 live 教条、工具名错=运行期 tool-not-found，属关键路径 | 2026-06-30 113-agent review（Wave1 修了三处裸名、但缺机械守门防回归） | ✓（裸名漂移会反复进 imperative 步骤） | 加测试：扫 gm-core + 四 flow 的 SKILL.md/references，正则抓反引号 `resolve_*/sheet_*/world_*/event_*/reveal_once/narrate` token，断言每个 ∈ `BUILTIN_TOOL_NAMES`（从 `../mcp/tools.js` 导入）。该断言会立即标红任何后续裸名漂移 |

---

## 主题O · 可观测性 · 日志分级统一 💡🔧

> **一句话病根**：项目**无统一日志体系**——全仓仅 7 处裸 `console.*`（后端运行时只 `server.ts` 一条启动 log；core 集中在 `cli.ts` 面向终端输出 + `mcp/main.ts` 一条裸 error），**`packages/shared` 无 logger 基建**。后端 HTTP/WS/会话生命周期/编排/错误**全程零日志**（排障盲区）；core 引擎/MCP 运行时亦无结构化日志。随会话数/并发/排障需求**线性恶化**。
> **跨层难点（用户点出）**：引擎/MCP 与后端（backend）都跑、都要日志，各打各的没法对齐 → **抽统一 logging 模块到 `packages/shared`**，两侧共用同一分级约定与上下文（sessionId/turnId）。

| # | 类型 | 问题 | 现状 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|------|:--:|--------|
| O1 | feat | **统一 logging 模块**（2026-06-25 复核·描述严重过期）：~~无 logger~~——**引擎侧已有成熟 logger** `packages/logs/src/`（pino 分级文件 + `getLogger`/`initGlobalLogger`/`createFileLogger`，全仓 17+ 处用）。原「shared 无日志基建、抽同构 shared/logger」**误判**：`packages/shared` 是 schema 层（rest/ws 契约），logger 留 `packages/logs` 即可。真缺口收窄：① **前端 `frontend/` 零日志框架**（需 browser sink + 分级约定，真缺口）；② 引擎个别裸 console 补点（见 O2） | 裸 `console.*` 散点 | 用户 + grep + 2026-06-25 复核 | ✓ | **不新建 shared/logger**；logger 约定写 wiki（指向 `packages/logs`）；前端另起 browser sink 复用同分级约定。降 P2（核心基建已有） |
| O2 | feat | **引擎/运行时日志接入**（2026-06-25 复核·大半已做）：`backend/src/cli.ts` console 面向终端输出（**保留**）；`harness/src/dicegm/mcp/main.ts` 等裸 error 改走 `getLogger()`。grep 复核剩余裸 `console.*` 散点补走 logger 即可 | cli console 保留 / 少量裸 error | 同上 + 复核 | ✗ | ✅ 部分收尾（2026-06-26）：`harness/src/dicegm/mcp/main.ts` 启动错误走 `getLogger().error` + `initGlobalLogger(会话目录)`（写分级文件、不污染 stdio），保留一处 stderr 兜底（init 前抛错可见）；`cli.ts` 面向终端输出按设计保留。剩余裸 console 散点补点为低优先。⚠️ **实现实证/漂移**：O1 原「抽**同构** shared/logger、浏览器+node 通用」前提（前端有 console 要迁）**不成立**——引擎侧已有 `packages/logs/src/`（pino，**node-only**，分级文件），后端/harness 已接入；前端 `frontend/` **0 处裸 console** 且 web 不依赖引擎包。故 O-前端近乎 moot，O1 宜降级/重述为「现状已够，前端如需日志再加薄 browser logger」（建议 `roadmap-delivery-workflow`（wiki 结构整理变体）/`roadmap-delivery-workflow`（wiki 内容修复变体） 修正第三批 logger 段措辞） |

---

## 主题S · 战略风险 · Claude Code 承重绑定 💡

> **2026-06-25 全量体检实证**：**ARCH-004（P0）** = S1/S2 的体检反指——`DiceGm.ts` L10 直接 `import { query } from "@anthropic-ai/claude-agent-sdk"`、用 SDK 专属 `mcpServers` config/`settingSources`/`allowedTools`；`AgentFactory` 是 factory（产 agent 实例）非 port（承重层接口契约）——L3 hook 承重（被动 rule 召回 + 回合末审计）在 Phase 1 根本没接 Agent SDK，现靠 `turnLoop.runTurnEnd` 物化 choice 兜底。换 agent sdk 需重写整个 DiceGm。见 [体检汇总 P0-10](../../../audits/2026-06-25-全量体检/06-汇总-合并.md)。
> **PROD-008 反指**：「adapter 留下游」在 [backlog-后端](backlog-后端.md) / [backlog-前端](backlog-前端.md) 未来池各列一条（玩家选择捕获/语义自查轻推、GUI 前端壳），与本主题 S2 port 契约部分重叠——S2 port 契约落地后，adapter 留下游项范围会被吸收/收窄（已在两池未来池条目加注）。
>
> **一句话病根**：v1 把 L3 审计 / 被动 rule 召回押在 Claude Code hook 上（[技术选型 §6](../03-架构/技术选型.md) / [跨agent §3](../03-架构/跨agent与适配层.md) 定为"承重"）。core 虽称标准可搬，但"承重"即承认**实际不可搬**——CC 改 hook 语义 / SDK v2 breaking（已 pre-alpha）/ 付费策略 / 国内可用性任一变动都能让框架命门失重。这是用低开发成本换来的单点依赖，**对发版 / 商业化语境是供应商锁定风险**，当前未定价。
>
> **路由**：把决策写进对应设计页「决策与权衡」节，定**解绑触发条件** + 把承重层抽成 **port（adapter 接口契约，v1 单 Claude Code 实现、多 agent sdk 列未来）**——核心是回答 **L3 承重怎么跨 agent 表达**（被动 rule 召回 + 回合末审计，正是「hook 类塑形难跨 agent 承重」否决理由，见设计页决策节），并禁 `adapter/` 之外代码直接调 CC 专属 API。**不阻塞头号债链路，但发版前必决。**

| # | 类型 | 问题 | 来源 | 恶化 | 下一步/依赖 |
|---|------|------|------|:--:|--------|
| S1 | feat | **承重绑定无解绑预案 + 无抽象边界**：hook 承重但未写"何时该解绑"触发条件（CC 改 X / 商业化 Y / SLA Z）；`adapter/hooks/*` 已隔离但无契约保证业务代码不穿透。core"理论上可搬" ≠ 实际可搬 | 首席架构师评估 2026-06-25 | — | 💡 把决策写进对应设计页「决策与权衡」节：① 定解绑触发条件；② 立 hook 抽象接口位（v1 单实现、禁业务穿透）；③ 把"承重绑定"显式列为最高级架构风险。与 [跨agent §5](../03-架构/跨agent与适配层.md) 取舍对齐 |
| S2 | feat | **承重层 port 契约 + L3 跨 agent 承重未定**：用户提议把 hook/skill/subagent 承重层抽成 port，当前单 Claude Code adapter、多 agent sdk 列未来（harness 思想 L1/L2/L3 + 团本/SQLite store 不变，只把"绑哪个 agent"从硬绑松弛成 port + 默认 adapter）。病根＝**L3 承重（被动 rule 召回 + 回合末审计）跨 agent 无统一表达**——这正是「hook 类塑形难跨 agent 承重」否决理由（见设计页决策节），port 契约须正面解，否则 port 是空壳。是快照对冲思路从快照一项延到整个承重层；**不翻 agent 选型决策**（v1 单实现、多实现明确推迟）、不违 [跨agent §5](../03-架构/跨agent与适配层.md) 取舍（可移植兑现在模型层、port 是"未来想搬就能搬"的保险非 v1 目标） | 用户提议 2026-06-25（"从单点 Claude agent 改成适配多 agent；harness 思想确定，用适配器适配不同 agent sdk"） | ✗ | 💡 与 S1 同决策节：定 port 契约边界 + **L3 跨 agent 表达**（被动 rule 召回 + 回合末审计的 adapter 接口形状，与快照 adapter 对齐）；**当前不实现**，只立方向 |

---

## 🔮 未来池（core 层 · 明确推迟，别现在做）

- **NPC 关系图谱（D-NPC-3 v2）**：把 npc 关系从 v1 的 relation 视图行**提成关系图谱**——成为独立承重节点（可查询的 anchor 边表），需升级数据形态。v1 走 relation 视图行不进 anchor（[A1 旁 D-NPC-3 裁决](#a1-旁--npc-产品决策wave2-浮现--2026-06-26-po-复核裁决)，2026-06-26 PO 复核）。
- **状态回滚/分支**：反刷骰 config 旋钮（稳定键播种）；「进行中存档遇 rule 版本热更」的 `schema_version`/团本版本迁移语义（深 diff/merge）。来源：03 TODO G。
- **自研 agent runtime**：agent 选型被否项（见设计页决策节），对冲＝快照/core agent 无关；迟早面临，记未来。承重层 port 防腐方向见 [主题S · S2](#主题s--战略风险--claude-code-承重绑定-)。
- **团本构建台未来**：~~语义向量检索（FTS 起步够）~~ → **检索库（`build/retrieval/` 的 `ingest`/`search`，jieba+BM25）拟退役**：一旦给构建 agent 文件系统工作区，agentic 文件导航（Grep/Read/Bash）对 CC 架构优于切块 BM25（无语义优势且切块割裂）——见 [backlog-后端 H-build-workspace](backlog-后端.md) + [裁决 build-agent-workspace](裁决记录/build-agent-workspace.md)。深版本化迁移仍留。来源：04 TODO 组件5/6 + 用户 2026-07-01。
- **eval-loop 工装**：headless `claude -p` 多回合驱动确切 flag（实现期核实）——但**主线改走子代理 GM harness（主题F），此项大概率作废**。
- **`shop_pool` 视图 + `shop_buy` 工具**（数据层不阻塞）：当下走 choice 式文本菜单即可（团本富前端组件本体在 [backlog-前端](backlog-前端.md) 未来池）。来源：用户 2026-06-22（原声明式工具生成层 spec 已沉 [团本构建工具链 §7](../04-子系统设计/团本构建工具链.md)）。
- **AI 出图 MCP 工具** ⟶ **里程碑四**：给 GM 一个出图能力的声明式 MCP 工具（自然语言 → 图片）。subagent 编排见 [backlog-后端 未来池](backlog-后端.md)、前端展示见 [backlog-前端 未来池](backlog-前端.md)。来源：用户 2026-06-29。
- **团本携带/声明富 UI（数据层）** ⟶ **里程碑四**：团本「超开放富 UI（注入 HTML）」（[backlog-前端 未来池](backlog-前端.md)）的数据层——团本格式/import 如何携带并声明这些 UI。来源：用户 2026-06-29。
