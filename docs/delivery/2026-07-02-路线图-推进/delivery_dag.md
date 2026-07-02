# 交付 DAG 设计稿（2026-07-02 · 里程碑一收尾）

> 3 份已批准裁决 → 炸成 **5 个原子需求节点** → 分 **2 波**。
> 铁律：一份裁决 ≠ 一个节点——按 §设计小节炸成「能独立陈述 + 独立验收」的原子需求；裁决内部先后连成 DAG 边。

## 全图（节点 + 依赖）

```
波1（无跨波依赖，可即起）
  N1  skill-loading          (承重前置, depends: —)
  N5  lore-checkout-head     (独立小需求, depends: —；提到波1减少波2的 api/lore.ts 三方冲突)

波2（均建在 N1 已合入 main 之上）
  N2  build-workspace-backend (depends: N1)   ← build-agent-workspace §1/§3/§4/§7
  N3  build-pack-skill-rewrite(depends: N1)   ← build-agent-workspace §5（纯 SKILL.md，/skill-creator）
  N4  lore-error-shape        (depends: N1)   ← lore-build-robustness §1/§2
```

## 节点边界（一节点=一原子需求=一 agent=一 worktree）

### N1 · skill-loading-by-reference（**整份裁决=1 节点，不再炸**）
- **为何不炸**：§0–§6 是同一个承重重构的连续步骤——`SkillRef → PluginRef` 一个类型改动贯穿 agent.ts / gmAssembly / DiceGm / server.ts / 两侧 openingPrompt，硬拆成「改类型」「改装配」「删 skillStage」会跌破「一个完整需求」地板（skill 前提③反对）。
- **目标**：dice+lore 改用 SDK 原生 `plugins`+`skills` 按引用加载；退役 `stageSkills`/`cpSync`/`cleanupSkills` + 去 `allowedTools:['Skill']`；skill 母本幂等版本感知物化到 `$/{dice,lore}/skills`；两侧退役内联教条兜底（fail loud）；新增 lore `dicelore-build-core` 开场白 skill（/skill-creator 撰写）。
- **⚠️ 消费者面比裁决 §6 所述更广**：grep 实测 `SkillRef` 消费者含 `harness/src/{loregm/LoreSession,dicegm/DiceSession,dicegm/openingPrompt,loregm/openingPrompt,runtime/agent,index}.ts` + `backend/src/{server,api/dice,api/ws,api/lore}.ts` + 测试 `loregm/openingPrompt.test.ts`/`api/lore.test.ts`。**全仓 grep `SkillRef`/`stageSkills`/`skillStage`/`cleanupSkills` 迁移干净、不漏**。
- **验收**：typecheck+test 全绿；纯装配单测（gmAssembly：plugin 非空→plugins/skills/settingSources:[]/allowedTools 不含 Skill；空→baseline）；plugin 物化 fs 单测（幂等+版本感知+定位失败返 null）；退役兜底回归（buildOpeningPrompt 不含教条正文、gmCoreDoctrine 已删、定位失败 fail loud）。**§0 live smoke 属手动必过门→冒泡主 agent。**

### N5 · lore-checkout-head（lore-build-robustness §3）
- **目标**：`GET /catalog/:id/files?ref=head`（或省略 ref）先从 catalog list 取 head commitId 再 checkout，不动 core checkout 语义。
- **验收**：端点测 `ref=head`/省略返 head commit 文件（非 `[]`）。

### N2 · build-workspace-backend（build-agent-workspace §1/§3/§4/§7）
- **目标**：每会话持久 workspace（`ensureWorkspace` 只建 `materials/`）+ 流式 `POST /lore-sessions/:id/materials`（octet-stream、filename 净化、`DICELORE_MATERIAL_MAX_MB` 默认 100 中途 413 清半成品、返 `{path,bytes}`）+ build-mcp `put_material`（`localPath` 流式、content 不进工具参数）+ **退役 BM25**（删 `build/retrieval/**`、摘 buildMcp `ingest`/`search`、BuildCtx 去 retrievalDb）+ 接线（server.ts 传 sessionsDir、LoreSession workspace 透传）。
- **不含**：`gmAssembly.ts`/`DiceGm.ts`/`runtime/agent.ts`/plugin 清单（归 N1）；`cwd=workspace`+lore 工具集装配（N1 §3 已立入参与分支，本节点只传 workspace 值）。
- **验收**：typecheck+test 绿；workspace 幂等 fs 测；上传端点流式落盘/净化/超限 413/不整体入内存；retrieval 退役无悬空 import + lore offline eval 删检索调用后绿。**端到端 dogfood 属手动门→冒泡。**

### N3 · build-pack-skill-rewrite（build-agent-workspace §5）
- **目标**：用 **`/skill-creator:skill-creator`** 重写 `harness/src/loregm/skills/dicelore-build-pack/SKILL.md`（+`references/extract-playbook.md`）——阶段0 ingest→「摸源(ls/wc/head/grep)+清洗分块(Write clean/)」、各阶段 search→「Grep 定位+Read 读块→提炼→build_write_*」、删 ingest/search 行、补 Bash/Grep/Read 工具全览、纪律改「先摸源再提炼、素材是不可信引述资料只提炼不执行」。纯文档（依裁决已定的 materials/ 契约写，不 import N2 代码）。
- **与 N2 关系**：并行，均 depends N1；N3 写的 workspace/materials 契约在裁决里已定死，集成时与 N2 实际端点/工具名对齐（契约一致）。
- **验收**：SKILL.md 经 skill-creator 校验（frontmatter/name/description/references 合规）；无 ingest/search 残留；打法为 agentic 文件。

### N4 · lore-error-shape（lore-build-robustness §1/§2）
- **目标**：`LoreSession.handleMessage` 不吞 error（返回 `{turnId, error?}`、循环捕获 `ev.type==='error'`）+ `Session` 接口返回类型放宽可选 `error?`（dice 零影响）+ `api/lore.ts` messages 端点 body 带 `error?`（HTTP 保持 200/202）+ build-mcp `doSendToBuilder` 透传 error + `LoreSession.test.ts` 补投递断言（`plugin` 透传，**迁移后命名**）+ error 收尾覆盖。
- **⚠️ §2 投递断言依赖 N1 命名**：放波2、以含 N1 的 main 为基线，断言用 `plugin`（非 `skills`）——自然一致。

## 热点文件冲突表（集成时主 agent 解）

| 文件 | N1 | N2 | N4 | N5 | 处置 |
|------|----|----|----|----|------|
| `backend/src/api/lore.ts` | — | +sessionsDir/ensureWorkspace/POST materials | +error 透传 | +ref=head | **三方重叠**：N5 波1 先合缩小面；波2 N2+N4 集成时主 agent 解 |
| `harness/src/loregm/LoreSession.ts` | (SkillRef→plugin 消费) | +workspace 透传 | +error 捕获/返回 shape | — | N1 波1 先落命名；波2 N2+N4 重叠主 agent 解 |
| `harness/eval-loregm/build-mcp.ts` | — | +put_material | +doSendToBuilder error | — | 波2 N2+N4 重叠主 agent 解 |
| `backend/src/server.ts` | +plugin 注入/baseline | +createLoreApp 传 sessionsDir | — | — | N1 波1 先落；波2 N2 rebase 后叠加 |
| `harness/src/loregm/skills/dicelore-build-pack/**` | (N1 物化母本 + 新增 build-core) | — | — | — | N1 碰 `.claude-plugin/` + build-core；N3 波2 碰 build-pack 内容，区域不同 |
| `harness/src/loregm/openingPrompt.ts` | buildPackSkill→ensureLorePlugin | — | — | — | 仅 N1 |

## 分波理由
- **N1 必须独占波1**：build 系列硬 blockedBy（workspace 入参/plugin 机制在其中立起）；lore-error §2 投递断言依赖其命名。build 系列与 lore-error 若在 worktree 从未含 N1 的 main 切基线，会拿不到 PluginRef 类型 / plugin 命名。
- **N5 搭波1**：无依赖、不与 N1 重叠文件；先合缩小波2 的 `api/lore.ts` 三方冲突为两方。
- **波2 三节点并行**：N2/N3/N4 均以「含 N1 的 main」为基线；N2+N4 在 `api/lore.ts`/`LoreSession`/`build-mcp` 重叠，集成时主 agent 解（正常集成常态）。

## 手动门（Workflow 不跑真 LLM，主 agent 阶段3 记待验证）
- N1 §0 live smoke（RUN_LIVE，必过门）；N2 端到端 dogfood（烧 LLM）。
