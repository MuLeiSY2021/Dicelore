# 组件3「Skills 包」+ 组件4「adapter + 输出层」设计 (Design)

> **状态**：🟢 已 brainstorming 定稿(2026-06-21)。
> **上游权威 spec**：[总体架构.md](../../wiki/03-架构/总体架构.md)(§5 塑形层③ / §6 一轮+三流 / §7 组件3·4)、[Skills包.md](../../wiki/04-子系统设计/Skills包.md)(全页:两层结构 / Moves 决策表 / Agenda+Principles / 补刀 L1L2 分工 / 焊进 `.claude/skills/`)、[adapter与L3审计.md](../../wiki/04-子系统设计/adapter与L3审计.md)(全页:`dicelore init` / 三承重 hook / L3 两档 / 输出层呈现模型生成器 / §8 快照)、[跨agent与适配层.md](../../wiki/03-架构/跨agent与适配层.md)(hook 承重、绑 Claude Code、Node 跨端约束)。决策账本:[TODO.md](../../wiki/04-子系统设计/TODO.md)(ADR-0012/0013/0014/0016/0017)。
> **本文档职责**:把上游 spec 的塑形教条与接线设计落成可实现的**包布局、模块边界、接口形状、测试策略、构建顺序**。上游已定的教条语义/hook 映射意图不复述,只定「怎么落地」。
> **路径说明**:引擎已迁入 `packages/core`(`@dicelore/core`,npm workspace:root 薄管理者 + 委托 scripts)。下文 `src/…` 对应 `packages/core/src/…`;`skills/…` 对应 `packages/core/skills/…`。组件3/4 **全并入 `@dicelore/core` 单包**(不新建 `packages/adapter`/`packages/skills`)——本期已拍待定点。

---

## 0. 目标与范围

按总体架构 §7 构建顺序,GM 运行时线已完成组件1(内层能力库)+组件2(MCP 工具面)。本期做**组件3 Skills 包**(L2 教条 markdown)+**组件4 adapter + 输出层呈现模型生成器**(TS),北极星 = **拿到一个可跑的 Claude Code GM harness**:`dicelore init` 一个项目 → 跑 `claude` 主持一局,三 hook 承重(开局注身份 / 回合开始召回 rule / 回合末物化 choice + L3 审计),输出层按 `visible` 生成呈现模型。

**范围**(四块,均落 `@dicelore/core`):

1. **Skills v1 完整首版草稿**(`skills/`):常驻 `dicelore-gm-core` + 四 `dicelore-flow-*`,措辞标 eval-pending。
2. **呈现模型生成器**(`src/present/`):读侧纯函数,按 `visible` 过滤,完整单测。
3. **adapter:`dicelore init`**(`src/adapter/init.ts`):写 `.claude/` + `settings.json` + `CLAUDE.md` 指针 + 拷 skills + 写三 hook 脚本。
4. **adapter:三承重 hook**(`src/adapter/hooks/*.mjs` + 可测 `src/adapter/*.ts` 逻辑):SessionStart / UserPromptSubmit / Stop。

**不在范围**(明确不做,留 TODO 钩子或别线):

- **快照 checkpoint/restore 接线**(adapter §3.3③/§8):core `checkpoint()`/`restore()` 属并行 P3 快照线(ADR-0017),core 内**尚未实现**(`store/db.ts:51` 仅占位注释)。本期 turn-start/turn-end **留 TODO 钩子**(注释 + 函数占位),待并行 core 快照线落地再接。
- **玩家呈现壳**(终端打印器 / GUI):是组件7 玩家客户端的活(独立线)。本期只交付呈现模型生成器(纯逻辑 + 稳定接口),**不做面向玩家的渲染消费者**。
- **eval-loop 工程**(Skills 措辞精修):用 skill-creator 的 with/without baseline + F1/F2/F3 assertions,需 harness 先跑 → **出本期**,harness 就绪后另起(§6.3)。
- **manifest 选 skill**(组件5/6):本期 `dicelore init` **默认全装**(gm-core 恒装 + 全部四 flow),留 manifest 过滤接口位。
- **L3 语义裁判 subagent**(ADR-0014):语义自查经下一轮轻推,降为未来。
- **narrate 降级**("talk 自动捕获"):v1 直用 MCP `narrate` + 漏 narrate 机械兜底,降级列未来。

**核对的已有内层能力(可直接复用,本期不重造)**:`materializePendingChoice`/`getPendingChoice`/`stagePendingChoice`(`store/choice.ts`)、`ruleSearch`(`store/rule.ts`,rule 域 FTS 召回)、`sheetShow`/`worldShow`/`revealOnce`(`store/visibility.ts`)、可见性列与过滤原语、`metaGet`/`openSession`(`session/resolve.ts`)。

---

## 1. 包布局与模块边界

```
packages/core/
├── skills/                              ★新:Skills v1 草稿「真源」(数据,非 src;init 拷进目标项目 .claude/skills/)
│   ├── dicelore-gm-core/
│   │   ├── SKILL.md                     body <500 行:Agenda(顶)+Moves 两道闸+形状表骨架+Principles 各簇+补刀指针
│   │   └── references/
│   │       ├── moves-full.md            全决策表 + 边角 case + worked examples
│   │       ├── consequences.md          fail-forward 后果手法菜单(F2 双边)
│   │       ├── visibility-play.md       可见性 playbook(开局 show / 暗值 / reveal_once vs show)
│   │       └── reminders.md             补刀丰富措辞表(触发情境 → 丰富提醒)
│   └── dicelore-flow-{gacha,contest,anka,explore}/
│       └── SKILL.md                     genre-context 描述 + 编排已有工具的 playbook
└── src/
    ├── present/
    │   ├── model.ts                     ★新:buildPresentationModel(db, opts?) → PresentationModel(纯函数)
    │   └── model.test.ts
    ├── adapter/
    │   ├── init.ts                      ★新:dicelore init 实现(写文件,可测产物)
    │   ├── init.test.ts
    │   ├── templates.ts                 ★新:settings.json / CLAUDE.md 指针 模板生成(纯函数)
    │   ├── l3.ts                        ★新:L3 机械检查纯函数(供 turn-end 调,可测)
    │   ├── l3.test.ts
    │   ├── sessionContext.ts            ★新:SessionStart additionalContext 组装(纯函数,读 db 概览)
    │   ├── ruleRecall.ts                ★新:turn-start rule 召回 + turn_start_seq 记录(薄,包 ruleSearch)
    │   └── hooks/
    │       ├── session-start.mjs        ★新:薄入口 shim(stdin → sessionContext → stdout additionalContext)
    │       ├── turn-start.mjs           ★新:薄入口 shim(stdin → ruleRecall → stdout additionalContext)
    │       └── turn-end.mjs             ★新:薄入口 shim(materialize + L3 → stdout decision JSON)
    └── cli.ts                           扩展:加 `init` 子命令(委托 adapter/init.ts)
```

**依赖单向向下**:`adapter/hooks/*.mjs`(薄入口)吃 `adapter/*.ts`(逻辑);`adapter/*.ts` 吃 `store/`、`session/`、`present/`;`present/` 只吃 `store/`。内层不 import `adapter/`/`present/`。**hook 逻辑全在可测 `.ts` 里,`.mjs` 只做 stdin/stdout 胶水**(便于单测逻辑、回避 hook 进程难测)。

---

## 2. 呈现模型生成器(`src/present/model.ts`,纯、TDD)

承接 [adapter §7.1](../../wiki/04-子系统设计/adapter与L3审计.md)。读侧纯逻辑,输入 session `.db`,输出结构化呈现模型(流②,零 token、不进 AI 上下文)。

```ts
interface EchoEntry   { seq: number; kind: "verdict" | "mutation" | "watcher_fired"; text: string; data?: unknown }
interface VisibleCell { entity: string; attr: string; value: string }
interface ChoiceView  { prompt: string; options: { label: string; consequence: string }[]; seq: number }

interface PresentationModel {
  mechanicalEcho: EchoEntry[]    // 本轮 verdict/mutation/watcher_fired event(机械回显)
  statusMenu:     VisibleCell[]  // 当前可见 sheet cells
  pendingChoice?: ChoiceView     // 最新 kind=choice event 的选项 + 已锁后果
}

function buildPresentationModel(db: DB, opts?: { turnStartSeq?: number }): PresentationModel
```

- **可见性判定**([03 §3.1](../../wiki/03-架构/总体架构.md)、`store/visibility.ts`):sheet cell 可见 ⟺ `visible=1` ∨(entity 有 `__show_all` ∧ `visible≠2`);event 按 `kind` 默认 + 显式覆盖。**GM 全见、玩家只见授权**;本生成器走玩家视角(按 `visible` 过滤)。
- `mechanicalEcho`:`turnStartSeq` 给定则圈本轮区间,否则取最近一轮;机械回显文本由 event `data_json` 的账本(`rolled|set`、verdict 结果)拼成("金钱 +3d100=74 → 77")。
- `pendingChoice`:读最新 `kind=choice` event 的 `data_json`(Stop hook 物化后落,§4)。
- **纯函数、零 LLM、完整单测**:喂内存 db、构造各可见性/账本组合断言输出。**组件7 单向依赖此生成器**(同一概念两渲染器,本期不做 GUI 消费者)。

---

## 3. adapter 三承重 hook(`src/adapter/hooks/*.mjs` 薄入口 + `src/adapter/*.ts` 可测逻辑)

承接 [adapter §3](../../wiki/04-子系统设计/adapter与L3审计.md)。一轮 = agent 自然回合,天然对齐 UserPromptSubmit(回合开始)↔ Stop(回合末)。

| 抽象 | CC 事件 | 入口 shim | 逻辑模块 | 读什么 | 注入/产出 |
|---|---|---|---|---|---|
| 开局上下文 | SessionStart | `session-start.mjs` | `sessionContext.ts` | `.db` 概览 + 团本调性 | `additionalContext`:GM 身份 + Agenda + 极简纪律 + 调性一句 |
| 回合开始 | UserPromptSubmit | `turn-start.mjs` | `ruleRecall.ts` | `stdin.prompt` + rule 域 FTS | `additionalContext`:相关 rule 约束;写 `session_meta.turn_start_seq` |
| 回合末 | Stop | `turn-end.mjs` | `l3.ts` + `materializePendingChoice` | `transcript_path` + 本轮 event 区间 + `pending_choice` 槽 | ① 物化 choice ② L3 两档(block / 写 note) |

**跨端铁律**([跨agent §3](../../wiki/03-架构/跨agent与适配层.md)):hook 一律 Node 写、不用 bash;`settings.json` 用 exec form(`command:"node"` + `args:[脚本路径]`,避 Windows `.cmd` shim);路径走 `${CLAUDE_PROJECT_DIR}` + Node 平台 API;与 MCP 共享 `DICELORE_SESSION` env 定位当前局。

### 3.1 session-start.mjs / sessionContext.ts(SessionStart)
读当前 `.db`(玩家卡概览、当前 sheet 钟)+ manifest 核心调性,组 `additionalContext`(身份 + Agenda 议程 + 极简纪律摘要 + 调性一句)。**只注指路牌级**,世界底料仍靠 AI 运行期 `world_search`。`--resume`/`--clear`/compact 后重跑 → 续局自动重注身份。`sessionContext.ts` 纯函数(吃 db → 返字符串)、可单测。

### 3.2 turn-start.mjs / ruleRecall.ts(UserPromptSubmit)= 被动 rule 召回(唯一职责)
读 `stdin.prompt` → 对 rule 域 FTS(复用 `ruleSearch`)召回相关条目 → `additionalContext` 注本轮。rule **AI 只读、被动拉**(守反讨好红线)。**纯本地 SQLite,远小于 30s 超时**(该事件超时短,脚本不得联网/重活)。顺带写 `session_meta.turn_start_seq`(供 Stop 圈本轮 event 区间)。
**快照 auto-sync 检测 = 留 TODO 钩子**(adapter §8):本期注释 + 函数占位 `// TODO(快照线): detectAndRestore(db, transcriptHead)`,不实现。

### 3.3 turn-end.mjs / l3.ts(Stop)= 物化 choice + L3 审计(两件事)
agent 回合自然结束跑。Stop hook 能 `decision:"block"`+reason 阻止停止让 agent 继续(档 A 地基),且能拿 `transcript_path` 读本轮对话。
- **① 物化暂存 choice**:复用 `materializePendingChoice(db)`(已实现,落 `kind=choice,visible=1` event、槽 `status→materialized`)。空且本轮无 `game_end` → 档 A 违规。
- **② L3 审计**:按 `turn_start_seq` 圈本轮 event 区间 + 读 transcript,调 `l3.ts` 机械检查(§4)。
- **防重入**:`stop_hook_active`(CC 提供)判断,**最多纠偏一次**;block 后 agent 仍未补则放行 + 记违规,绝不死循环。
- **快照写 = 留 TODO 钩子**(adapter §8 ③):本期注释 + 占位 `// TODO(快照线): checkpoint(db, transcriptHead)`,不实现。

---

## 4. L3 机械检查(`src/adapter/l3.ts`,纯、TDD)

承接 [adapter §4](../../wiki/04-子系统设计/adapter与L3审计.md) 两档烈度。**全机械、零 LLM、确定性、可单测**(喂 event 数组 + transcript 文本 → 返决策)。

| 档 | 信号 | 检测(机械) | 动作 |
|---|---|---|---|
| **A·block** | 非终局轮无暂存 choice | `pending_choice` 槽空 ∧ 本轮无 `game_end` | `decision:"block"` + reason"本轮未给玩家选择,请补 `resolve_choice` 再结束" |
| **A·block** | 漏 narrate | transcript 本轮有实质 assistant 文本 ∧ 本轮 event 无 `narrate` | block + reason"剧情请走 `narrate`(散文须落 event 才能审计/召回)" |
| **B·记录** | 疑似软着陆(F2) | 坏 verdict/失败档后叙述或 `sheet_update` 偏正向(语义性,机械只标风险点) | 写 `kind=note,visible=0` 审计 event,喂 eval-loop |
| **B·记录** | 该掷却用 `=`(F3) | `sheet_update` 账本 `kind=set` 比例异常 | 同上 |
| **B·记录** | 掷骰绕过率(F1) | 本轮 verdict/mutation 与其后 narrate 的 seq 关系统计 | 同上 |

- 档 A 结构确凿、补救无歧义 → 当场 block(破例,L3 本是事后兜底但此项值得当场纠)。
- 档 B 语义/统计、误报率高 → **v1 只记录、不 block**(避免打断叙事、违"L3 不阻止当下");纯写 note event 喂 eval-loop。
- `l3.ts` 导出纯函数:`auditTurn({ events, transcript, pendingChoiceEmpty, hasGameEnd, stopHookActive }) → { block?: { reason }, notes: NoteEvent[] }`。turn-end.mjs 据返回值写 stdout decision JSON / 落 note event。

---

## 5. `dicelore init`(`src/adapter/init.ts` + `templates.ts`,TDD 文件产物)

承接 [adapter §1/§2](../../wiki/04-子系统设计/adapter与L3审计.md)。`dicelore init` 在目标项目根写:

```
项目根/
├── CLAUDE.md            追加常驻 GM 指针(诚实仲裁者 + 每轮先 consult dicelore-gm-core + 尊重骰子/后果在先/非终局留 choice)
├── .mcp.json            注册 dicelore MCP server(type:stdio + env DICELORE_SESSION)— 见下「实现期修正」
└── .claude/
    ├── settings.json    只配三 hook(exec form node --import tsx + 包内 hook 绝对路径)
    ├── skills/          拷 skills/ 真源:dicelore-gm-core(恒装)+ 全部四 dicelore-flow-*(默认全装,留 manifest 过滤接口位)
    └── hooks/           (不拷;hook 入口留在包内 src/adapter/hooks/,settings.json 以绝对路径 + node --import tsx 引用)
```

> **实现期修正(2026-06-21,真实 CC 核实)**:原设计(承 [adapter §1](../../wiki/04-子系统设计/adapter与L3审计.md))把 MCP server 放 `.claude/settings.json` 的 `mcpServers`——**Claude Code 不从 settings.json 读 mcpServers**(官方文档:项目级 MCP 只认项目根 `.mcp.json`;settings.json 只读 hooks/permissions/model 等)。harness 实测印证:同文件里 hooks 生效、mcpServers 被忽略。**已改**:`dicelore init` 写项目根 `.mcp.json`(`type:"stdio"` + `command:"npx" args:["dicelore","mcp"]` + env),settings.json 只留 hooks。项目级 server 首启会话需用户批准。`templates.ts` 拆出 `mcpJson()`。**另一接缝**:`npx dicelore mcp` 需包补 `bin` 字段 + 发布/`npm link` 才能开箱即用(独立打包任务,本期未做;harness 临时改指本地 `node --import tsx .../mcp/main.ts`)。

- **常驻保证 = CLAUDE.md 指针 + SessionStart 注入**(ADR-0014):指路牌恒在、教条本体靠 skill 触发载入;**不每轮 UserPromptSubmit 强化**。
- **`templates.ts`**:纯函数生成 `.mcp.json`(`mcpJson`)+ `settings.json`(`settingsJson`,仅 hooks)+ `CLAUDE.md` 指针 → 可单测。
- **`init.ts`**:文件写入编排;`init.test.ts` 在临时目录跑 → 断言文件存在/内容正确/skills 拷全。已有 `CLAUDE.md` 时追加而非覆盖。
- **hook shim 如何 resolve core**:`.mjs` 需 import `@dicelore/core` 的逻辑模块。候选(实现期定):(i) init 期把 core 安装绝对路径写进 `.mjs`/settings.json;(ii) 依赖目标项目 node_modules 有 dicelore;(iii) settings.json 直接 `node <core 内置 hook 脚本绝对路径>`。**优先 (i)/(iii)**(回避 npx `.cmd` shim 坑 + node_modules 解析脆弱性)。本 spec 锁意图,确切形式留 plan。
- **CC hook stdin 字段名 / JSON 决策格式**:标[实现期官方文档核实](../../wiki/04-子系统设计/adapter与L3审计.md)(本 spec 定映射与意图)。

---

## 6. Skills v1 完整首版草稿 + 测试策略 + eval 边界

### 6.1 Skills v1 草稿(`skills/`,转写上游、措辞标 eval-pending)
结构在 [Skills包.md](../../wiki/04-子系统设计/Skills包.md) 已 🟢 定稿,本期 = 转写成可装载 markdown:

- **`dicelore-gm-core/SKILL.md`**(body <500 行):
  - `description` 写 pushy 常驻式("Use on **every turn** of running an anko/anki session as GM…")。
  - body 顺序:**Agenda 议程**(顶,四条,第 0 条"诚实仲裁者不取悦者"凌驾)→ **Moves**(闸 A 谁拥有决定 / 闸 B 该不该骰 / 形状表镜像 resolver 二轴 / 两补丁 / 派发流程 skill)→ **Principles**(F1 必掷 / F2 双边护栏 / fail-forward 手法 / F3 薄 / 一轮范式簇 / 可见性簇)→ 补刀指针。
- **`references/`** 四深表:`moves-full.md`(全决策表+边角 case+worked examples)、`consequences.md`(fail-forward 后果菜单)、`visibility-play.md`(可见性 playbook)、`reminders.md`(补刀丰富措辞表)。
- **四 `dicelore-flow-*/SKILL.md`**:genre-context 描述 + "何时进入/一步步走/与 genre 规则接口" 模板,**只编排已有 MCP 工具调用序、不新增工具/不碰 schema/存储**。
- 写法纪律(skill-creator):imperative + 讲 why、忌堆硬 MUST、串成"一轮怎么走"。

### 6.2 测试策略
- **TDD/可单测**(纯逻辑):呈现模型生成器(§2)、L3 机械检查(§4)、`templates.ts`、`sessionContext.ts`、`init.ts` 文件产物、`turn_start_seq` 记录。
- **副作用集成层**([adapter §8](../../wiki/04-子系统设计/adapter与L3审计.md) 注明不强求自动化):三 hook 在真实 CC 里的端到端注入、`additionalContext` 实际生效、`decision:block` 实际唤回 → 靠北极星手验。
- **Skills markdown**:本期不 eval(措辞 eval-pending);仅校验结构(文件齐、frontmatter 合法、<500 行)。

### 6.3 eval-loop(出本期,用 skill-creator,harness 就绪后)
Skills 措辞终稿靠 **skill-creator 的评测循环**:with(harness 跑 GM)/without baseline 对比 + 量化打分。**F1/F2/F3 可客观验证 → L3 审计信号(掷骰绕过率/后果-叙事一致/该 choice 处替玩家骰)直接复用作 assertions**。`dicelore-gm-core` 草稿结构本就对齐 skill-creator(渐进式披露三级、description 抗 under-trigger)。**需 harness 先跑 → 出本期**,harness 就绪后另起 eval 阶段;`run_loop.py`(description 触发率优化)harness 之外亦可跑。

---

## 7. 北极星验证(端到端手验)

1. `dicelore new <临时局>` 灌一个最小团本(几条 rule + 一张玩家 sheet),`dicelore init` 一个临时项目。
2. 跑 `claude`,主持一局,逐项确认:
   - **开局**:SessionStart 注入 GM 身份 + Agenda(transcript 可见)。
   - **rule 召回**:玩家说"我要战斗" → UserPromptSubmit 注入相关 rule 约束。
   - **choice 物化**:本轮 `resolve_choice` 暂存 → Stop 物化为 `kind=choice` event(`dicelore inspect` 可查)。
   - **L3 档 A**:故意一轮不给 choice 且非终局 → Stop `block` 唤回补 `resolve_choice`(`stop_hook_active` 防重入,最多一次)。
   - **呈现模型**:对 .db 跑 `buildPresentationModel` → 机械回显/状态菜单/待选项按 `visible` 正确(单测 + 手查)。

---

## 8. 构建顺序(C·并发波次,复用组件2 执行模式)

这些件大多互相独立(生成器 ⟂ Skills markdown ⟂ init 脚手架 ⟂ 各 hook),并发压缩 wall-clock:

- **波 1(并发)**:① 呈现模型生成器(§2,TDD) ｜ ② Skills v1 完整草稿(§6.1,纯转写) ｜ ③ init 脚手架 + templates(§5,TDD 产物)。三者无共享状态。
- **波 2(并发)**:三 hook —— `sessionContext.ts` + session-start.mjs ｜ `ruleRecall.ts` + turn-start.mjs ｜ `l3.ts`(TDD)+ turn-end.mjs。各薄壳 import 已有 core 能力 + 波1 ③ 的 shim 约定。
- **波 3**:端到端接线(init 拷波2 的 hooks)+ 北极星手验(§7)。

---

## 9. 本文档**不**负责定的(留下游/plan/实现期)

- 三 hook 的确切 CC stdin 字段名 / JSON 决策格式 → 实现期官方文档核实。
- hook shim resolve core 的确切形式((i)/(ii)/(iii) 取舍)→ plan/实现期。
- Skills 各教条的**终稿措辞** → eval-loop(§6.3,出本期)。
- 快照 `checkpoint()`/`restore()` 的 core 实现 → 并行 P3 快照线(ADR-0017),本期只留 TODO 钩子。
- 玩家呈现壳(终端/GUI)、玩家选择捕获 → 组件7(独立线)。
- manifest 选 skill / 版本迁移 → 组件5/6([团本与manifest.md](../../wiki/04-子系统设计/团本与manifest.md))。
