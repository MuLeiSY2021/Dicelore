---
title: 裁决 · skill-loading-by-reference（skill 加载按引用统一，退役 cpSync 暂存）
---

# 裁决：skill-loading-by-reference —— dice+lore 统一改用 SDK 原生 `plugins`+`skills` 按引用加载 skill

- [ ] 用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 路线图项：里程碑一 · 地基（承重机制清理 + [build-agent-workspace](build-agent-workspace.md) 的使能前置）。
> backlog：[H-skill-loading](../backlog-后端.md)（新增）。
> 来源：用户 2026-07-01——审 [build-agent-workspace](build-agent-workspace.md) 时提出「skill 别拷进 workspace，用同一套加载机制、复制同步太耗」；查证 SDK `0.3.185` 已原生支持按引用加载后拍定「两侧一起迁、彻底统一」。
> **下游依赖**：[build-agent-workspace](build-agent-workspace.md) 的「cwd=workspace + skill 从固定源加载」直接建在本裁决之上——**本裁决须先行或同波**（build-agent-workspace `blockedBy` 本项）。

---

## 背景（为什么改）

现状（`harness/src/dicegm/`）：每回合 `DiceGm.runTurn` 调 `stageSkills`（`skillStage.ts`：`cpSync` 把 skill 源目录整拷进 `tmpdir/.claude/skills/`），设 `cwd=staged` 让 `settingSources:["project"]` 扫到，`allowedTools` 含 `"Skill"`，`finally` 再 `cleanupSkills` 删。lore 侧对称（`buildPackSkill()`）。

三个病：
1. **每回合复制**：`cpSync` 整个 skill 目录 + 回合末删，纯为让 SDK 扫到 `.claude/skills`（dice 根本不在 cwd 做文件操作）。
2. **cwd 被绑架**：`settingSources:["project"]` 把 skill 发现绑死 cwd/.claude——[build-agent-workspace](build-agent-workspace.md) 想把 cwd 设成素材工作区就撞车，被迫再拷一份 skill 进 workspace。
3. **用废弃 API**：SDK `0.3.185` 明标 `allowedTools:['Skill']` **已废弃**（sdk.d.ts:1285），官方改用 `skills` 选项开关。

SDK 原生能力（已查证 sdk.d.ts）：
- `plugins?: [{ type:'local', path }]`（:1683/:3766）——从**任意固定路径**按引用加载本地 plugin，plugin 内 bundle skills，**与 cwd 完全解耦**、零复制。
- `skills?: string[] | 'all'`（:1845）——「开启 skill 的单一入口」，无需再往 `allowedTools` 塞 `'Skill'`；`[]`=全不启（baseline）。
- `settingSources` 与 plugins 正交（:1822）；`[]` = SDK 隔离模式（不读盘上 settings），plugins 照常加载。

**决定**：dice+lore 都改用 `plugins`+`skills` 按引用加载，**退役 `stageSkills`/`cpSync`/`cleanupSkills` 全套 + 去 `allowedTools` 里的 `'Skill'`**。skill 从固定源目录（各角色线根打成 local plugin）加载，一份不拷；cwd 交还给业务（dice 无所谓、lore 用 workspace）。

---

## 设计（零不确定，仅剩代码实现）

### 0. 先决 de-risk（交付第一步，非门）

写一个**最小 smoke**（可 `RUN_LIVE` 手动、非 CI 门）：`query({prompt, options:{ plugins:[{type:'local', path:<角色线根>}], skills:['dicelore-gm-core'], settingSources:[], cwd:<任意> }})`，确认 system init 消息的 `skills` 清单含该 skill、且 `Skill` 工具可调。**目的**：钉死「local plugin + `skills` + `settingSources:[]`」在 `0.3.185` 下确实加载 skill（本裁决唯一残留经验性未知点）。若 plugin 需额外清单字段，据实修 §2 的 `plugin.json`。

### 1. skill 打成 local plugin + 安装期物化到数据根（用户 2026-07-01 定）

**运行期 plugin 不指源码树，而是物化到数据根**（`DICELORE_SESSIONS_DIR ?? "."`，即 DB/sessions 所在的 `$`——与 `$/dice/sessions`、`$/lore/sessions/<id>/workspace` 同置）：

- **物化目标**（= 用户命名的 `$/dice/skills`、`$/lore/skills`）：
  - `$/dice/`（pluginRoot）：`$/dice/skills/<skill>/SKILL.md`（gm-core + 4 flows）+ `$/dice/.claude-plugin/plugin.json`。
  - `$/lore/`（pluginRoot）：`$/lore/skills/dicelore-build-pack/SKILL.md` + `$/lore/.claude-plugin/plugin.json`。
  - plugin 扫描只认 `skills/`/`commands/`/`agents/`/`hooks/` + `.claude-plugin/`，同置的 `sessions/` 子树被忽略、无副作用。
- **物化源**（随包发的只读母本）：现 skill 已在 `harness/src/dicegm/skills/*`、`harness/src/loregm/skills/*`（正好 CC plugin 的 `skills/` 布局）；给源树各线根补一份 `.claude-plugin/plugin.json` 作母本清单：
  - `harness/src/dicegm/.claude-plugin/plugin.json` → `{ "name": "dicelore-dice", "version": "0.1.0", "description": "Dicelore 跑团 GM skills（gm-core + flows）" }`
  - `harness/src/loregm/.claude-plugin/plugin.json` → `{ "name": "dicelore-lore", "version": "0.1.0", "description": "Dicelore 团本构建 skills（build-pack）" }`
- **物化时机 = server 启动幂等 + 版本感知**（**一次性**，不是每回合/每会话——那是被否掉的 `stageSkills`）：boot 时 `ensureSkillPlugin(dataRoot, role)`：目标 `$/{role}/.claude-plugin/plugin.json` 缺失、或其 `version` 低于母本 → 从母本（`import.meta.url` 定位，见 §2）`cpSync` 覆盖 `skills/` + `.claude-plugin/`；否则跳过。一次性、随版本自动刷新，**化解 copy 的 staleness**（升级代码后首个 boot 自动重刷）。`import.meta.url` 只在 boot seed 时用一次、不进热路径。
- **为什么物化到数据根而非直接指源码**：① 所有运行态数据（DB/sessions/workspace/skills）归同一可配置根，代码树位置变实现细节（docker 只读代码层友好）；② plugin 路径是干净稳定的绝对路径、不掺 `.ts` 兄弟文件；③ 与现有 `$/dice`、`$/lore` 布局一致。代价（staleness）已由版本感知幂等重刷化解。
- **dice 的 4 个 flow skill（gacha/contest/explore/anka）借此一并可用**（现 `stageSkills` 只拷 gm-core、flow 够不到；物化整个 `skills/` + `skills:'all'` 全可见，供 gm-core 教条渐进披露）。
- **发版/打包**：`@dicelore/harness` 是 workspace 包、`main`/`exports` 指 `./src/*.ts`、**无 dist、tsx 跑源码**——母本（`src/.../skills/**` + `.claude-plugin/**`）作数据文件随整合包/docker 发出，boot 时物化到挂载的数据卷 `$`。未来若引入编译/打包成 dist，母本这些非 TS 资源须被构建步显式拷入（此隐患今已存在于 SKILL.md）。

### 2. skill 源解析 + 物化：SkillRef → PluginRef

- `harness/src/runtime/agent.ts`：`SkillRef {name, srcDir}` **改/增** `PluginRef { pluginDir: string; skills: string[] | "all" }`（`pluginDir`=**物化后的数据根 pluginRoot 绝对路径**，如 `$/dice`；`skills`=启用的 skill 名单）。`AgentInit.skills: SkillRef[]` 换成 `AgentInit.plugin?: PluginRef`（可空=不启 skill，对齐 baseline）。
- **物化 + 解析函数**：`harness/src/dicegm/openingPrompt.ts` `gmCoreSkill()` / `harness/src/loregm/openingPrompt.ts` `buildPackSkill()` **改成 `ensureDicePlugin(dataRoot)` / `ensureLorePlugin(dataRoot)`**，返回 `PluginRef | null`：
  1. 用现 `gmCoreDir()`/`buildPackDir()` 的候选逻辑（`dirname(fileURLToPath(import.meta.url))` + cwd 兜底）定位**母本线根**（`harness/src/{dice,lore}gm`，校验其 `.claude-plugin/plugin.json` 在）；
  2. 幂等 + 版本感知物化到 `$/{role}`（§1 `ensureSkillPlugin` 逻辑，可即此函数内联）；
  3. 返回 `{ pluginDir: <$/dice 或 $/lore>, skills: "all"（dice，含 flows）/ ["dicelore-build-pack"]（lore） }`。母本定位失败返 null（沿现退化：仅走 openingPrompt 内联教条）。
- **dataRoot 入参**：组合根 `server.ts` 已有 `dir`（`DICELORE_SESSIONS_DIR ?? "."`），传给 `ensure*Plugin(dir)`。
- **内联教条兜底保留**：`gmCoreDoctrine`（dice）与 lore 的等价兜底（见 [lore-build-robustness](lore-build-robustness.md) §2 `buildOpeningPrompt`）**继续存在**——plugin 加载失败时 systemPrompt 仍有教条，不无声退化。语义从「staged 失败兜底」泛化为「plugin 加载失败兜底」。

### 3. `buildQueryOptions` 改造（gmAssembly.ts）

- `BuildQueryOptionsArgs`：删 `staged`，加 `plugin?: PluginRef`、`workspace?: string`（后者为 build-agent-workspace 预留，本裁决先把入参和分支立好；lore 传 workspace 的接线属 [build-agent-workspace](build-agent-workspace.md)）。
- 装配（钉死）：
  - `plugin` 非空 → `plugins = [{ type:"local", path: plugin.pluginDir }]`、`skills = plugin.skills`；`plugin` 为空 → `plugins` 省略、`skills = []`（baseline：skill 全不启）。
  - `allowedTools` **去掉 `"Skill"`**：dice=`["mcp__dicelore","Read"]`（保留 Read 供渐进披露读 skill 引用文件）；`workspace` 非空（lore）=`["mcp__dicelore","Read","Bash","Grep","Glob","Write","Edit"]`（见 build-agent-workspace）。
  - `settingSources` 恒 `[]`（不读盘上 settings；plugins 正交加载）——**去掉原 `staged?["project"]:[]` 分支**。
  - `cwd`：`workspace` 非空 → `workspace`；否则省略（dice 用 SDK 默认 `process.cwd()`，无所谓——不再需要 staged cwd）。
- `GmQueryOptions` 接口：`settingSources` 恒 `[]`；加 `plugins?`、`skills?`；`cwd?` 保留。

### 4. `DiceGm.runTurn` 改造（DiceGm.ts）

- **删** `stageSkills` 调用（含 `stageSeq`、try/`stage_error` 降级块）与 `finally` 的 `cleanupSkills`；删 `import { stageSkills, cleanupSkills }`。
- 据 `init.plugin` 调 `buildQueryOptions({ ..., plugin: this.init.plugin, workspace: this.init.workspace })`。
- 回合头日志 `skills`/`opts` 字段改记 `plugin`（pluginDir + skills 名单）/`settingSources:[]`/`allowedTools`（去 Skill）——保留可观测。
- `init.plugin` 为空时（baseline / 无 plugin）行为 = 无 skill、纯内联教条。

### 5. 删 `skillStage.ts` + 组合根接线

- **删** `harness/src/dicegm/skillStage.ts` + `skillStage.test.ts`（若有）。
- `backend/src/server.ts`：`gmCoreSkill()`/`buildPackSkill()` 改为 `ensureDicePlugin(dir)`/`ensureLorePlugin(dir)`（`dir`=`DICELORE_SESSIONS_DIR`；boot 时幂等物化 + 返 `PluginRef|null`）；`diceSkills`/`loreSkills`（`SkillRef[]`）换成 `dicePlugin`/`lorePlugin`（`PluginRef|undefined`）；经 dice deps（`createDiceApp`?/`attachWsUpgrade`）与 `createLoreApp` 传下。`DICELORE_BASELINE==="1"` 时 plugin 传 `undefined`（baseline：skill 全关，现行为不变）。
- dice 侧会话装配处（`server.ts` 组装 `AgentInit` 的地方 / DiceSession）：`skills` 字段换 `plugin`。

### 6. 导出与类型面（harness index）

- `@dicelore/harness` 导出：`SkillRef` → `PluginRef`（若外部无消费者可直接改名；有则并存一个过渡周期——**本仓内 grep 确认消费者仅 server.ts + openingPrompt**，故直接改）。

---

## 验收

- `npm run typecheck` + `npm test`（backend/harness）全绿；删 `skillStage.ts` 后无悬空 import。
- **纯装配单测**（`gmAssembly.test.ts`，不烧 LLM）：`plugin` 非空 → options 含 `plugins:[{type:'local',path}]` + `skills` + `settingSources:[]` + `allowedTools` **不含 `"Skill"`**；`plugin` 为空 → `skills:[]`、无 plugins（baseline）；`workspace` 非空 → `cwd=workspace` + 放开 Bash/Grep/… （与 build-agent-workspace 合并断言）。
- **plugin 物化单测**（纯 fs）：`ensureDicePlugin(tmp)`/`ensureLorePlugin(tmp)` 首调把母本 `skills/` + `.claude-plugin/plugin.json` 物化到 `tmp/{role}`、返回的 `pluginDir` 下 `.claude-plugin/plugin.json` + `skills/<name>/SKILL.md` 在；**幂等**（重复调不重拷、version 相等跳过）；**版本感知**（母本 version 高于目标 → 重刷覆盖）；母本定位失败返 null。
- **DiceGm 无 stage 回归**：`DiceGm` 不再引用 `stageSkills`/`cleanupSkills`（grep 断言 / 编译期）；baseline 档（plugin=undefined）行为不变。
- **de-risk smoke**（§0，`RUN_LIVE` 手动）：真 query 加载到 skill、`Skill` 可调。
- **flow skill 可用回归**（可选，随 gm eval）：gm-core 教条引用的 flow skill 现能被 agent 渐进披露调起（迁移前够不到）。

## owns（预期触及，非独占）

- `harness/src/runtime/agent.ts`（SkillRef→PluginRef、AgentInit.skills→plugin）
- `harness/src/dicegm/gmAssembly.ts` + `gmAssembly.test.ts`（staged→plugin/workspace 分支）
- `harness/src/dicegm/DiceGm.ts`（删 stage/cleanup、改装配）
- **删** `harness/src/dicegm/skillStage.ts`（+ 测试）
- `harness/src/dicegm/openingPrompt.ts` + `harness/src/loregm/openingPrompt.ts`（`gmCoreSkill`/`buildPackSkill` → `ensureDicePlugin(dataRoot)`/`ensureLorePlugin(dataRoot)`：母本定位 + 幂等版本感知物化 + 返 PluginRef；物化 helper 可抽 `harness/src/runtime` 共用）
- **新增源码母本** `harness/src/dicegm/.claude-plugin/plugin.json` + `harness/src/loregm/.claude-plugin/plugin.json`（随包发、作物化母本清单）
- `backend/src/server.ts`（skills[]→plugin 注入、baseline 分支）
- dice 会话装配处（AgentInit.skills→plugin 透传）+ 相关端点/WS 接线
- harness index 导出（PluginRef）

## 完成后

- 沉淀进 [04-子系统设计](../../04-子系统设计/)：跑团/构建 skill 加载改「local plugin 按引用 + `skills` 开关、退役 cpSync 暂存」的「决策与权衡」节（含「废弃 `allowedTools:['Skill']`、cwd 与 skill 发现解耦」要点）；ADR 风格薄记进 [决策变更日志](../../决策变更日志.md)。
- 关 backlog [H-skill-loading](../backlog-后端.md)（→ 已达成）。
- 勾路线图该项；解除 [build-agent-workspace](build-agent-workspace.md) 的 blockedBy。
- **删本裁决文件**（过渡稿，内容已落 wiki）。
