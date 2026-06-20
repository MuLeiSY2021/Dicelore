# adapter 与 L3 审计（组件4）

> **本页职责**：定"adapter（Claude Code 接线层）+ 玩家呈现"的详细设计——`dicelore init` 写的 `.claude/` 目录结构与 `settings.json`、**常驻保证机制**、**三个承重 hook 脚本（Node、跨端：SessionStart / UserPromptSubmit / Stop）各读什么·注入什么**、**L3 审计两档烈度**、`narrate` 取舍、**输出层呈现模型生成器**。这是把 core（MCP / Skill / SQLite / 团本）装进 Claude Code、并把机械事实呈现给玩家的安装层与读侧层。
> **上游依赖**：[跨agent与适配层](../03-架构/跨agent与适配层.md) 全页（hook 承重、绑 Claude Code、Node 跨端约束）；[总体架构 §5 塑形层 / §6 一轮+三流 / §7 组件4](../03-架构/总体架构.md)；[技术选型 §6/§6.1 骑 Claude Code + npm/`dicelore` CLI](../03-架构/技术选型.md)；[02 §4 L3 列](../02-领域模型/核心概念.md)。平级：[Skills 包 §1.1（常驻保证踢来）](Skills包.md)、[MCP 工具面（暂存/出参接缝）](MCP工具面.md)、[内层能力库 §4.2（event/watcher/pending_choice 槽）](内层能力库.md)。ADR：[0008 定位重述](../05-决策记录-ADR/README.md)、[0009 一轮+三流](../05-决策记录-ADR/README.md)、[0013 watcher 解绑 hook](../05-决策记录-ADR/README.md)、[0014 L3 兜底+hook 时序](../05-决策记录-ADR/README.md)。
> **状态**：🟢 已成型（2026-06-05 brainstorming；hook 事件映射经 Claude Code 能力核实，确切 stdin 字段 / JSON 决策格式以实现期官方文档为准；**2026-06-18 新增 §8**：快照 hook 与 CC /rewind 自动同步 + CLI 兜底，UserPromptSubmit 增检测/restore、Stop 增写快照——P3 细化，[ADR-0017](../05-决策记录-ADR/README.md)）。

---

## 0. 设计立场：adapter 是接线 + 读侧，不持教条

承接 [跨agent §1/§4](../03-架构/跨agent与适配层.md)：**adapter 只把 core 接到 Claude Code，自己不持有任何教条**（教条在 [Skills 包](Skills包.md)、schema 在 [MCP 工具面](MCP工具面.md)、存储在 [内层能力库](内层能力库.md)）。v1 **只认 Claude Code 一条注入路径**，不为别的 agent 做适配。

本页落 **四块**：

| 块 | 干什么 | 节 |
|---|---|---|
| **装** | `dicelore init` 写 `.claude/`（skill / settings.json / hook 脚本）+ `CLAUDE.md` 指针 | §1 |
| **常驻保证** | 让 GM 核心 skill"每轮都在"——指针 + 开局注入，不每轮强化 | §2 |
| **承重 hook + L3** | 三个 Node 脚本映到 Claude Code 事件；回合开始召回 rule、回合末物化 choice + 审计 | §3 / §4 |
| **玩家呈现** | 输出层呈现模型生成器（读 store/event、按 `visible` 过滤），前端壳正交分层 | §7 |

> **一个边界澄清**（[ADR-0013](../05-决策记录-ADR/README.md)）：旧骨架把"timer 到期注入"列为 hook 的活——**已撤**。watcher 到期由 `sheet_update` 写完**就地触发**（内层能力，不绑 Claude Code），不再经 hook。详见 §5。

---

## 1. 安装：`dicelore init` 写的 `.claude/` 结构 + `settings.json`

承接 [技术选型 §6.1](../03-架构/技术选型.md)（`npx dicelore init` 一步脚手架）。目录：

```
项目根/
├── CLAUDE.md                       # 常驻 GM 指针（init 写/追加，§2）
└── .claude/
    ├── settings.json               # 注册 Dicelore MCP server + 配三个 hook
    ├── skills/                     # L2 教条（Skills 包 §1，init 按 manifest 拷入）
    │   ├── dicelore-gm-core/           #   常驻 GM 核心（恒装）
    │   └── dicelore-flow-*/            #   manifest 选中的流程 skill
    └── hooks/                      # 承重 hook 脚本（Node、跨端，§3）
        ├── session-start.mjs       #   SessionStart
        ├── turn-start.mjs          #   UserPromptSubmit（回合开始）
        └── turn-end.mjs            #   Stop（回合末）
```

- **session `.db` 不在项目内**：每局一个 `.db` 在平台 app-data 目录（[内层 §6](内层能力库.md)），MCP server 与 hook 脚本**共享同一 `DICELORE_SESSION` env 定位当前局**（hook 进程继承 Claude Code 环境）。
- **`settings.json`（形态示意，确切 key 以实现期为准）**：

```jsonc
{
  "mcpServers": {                                  // 注册 core 的 MCP 工具面（组件2）
    "dicelore": { "command": "npx", "args": ["dicelore", "mcp"],
              "env": { "DICELORE_SESSION": "修仙团" } }
  },
  "hooks": {
    "SessionStart":     [{ "hooks": [{ "type": "command",
       "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/session-start.mjs"] }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command",
       "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/turn-start.mjs"] }] }],
    "Stop":             [{ "hooks": [{ "type": "command",
       "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/turn-end.mjs"] }] }]
  }
}
```

- **跨端铁律**（[跨agent §3](../03-架构/跨agent与适配层.md)、[技术选型 §6.1](../03-架构/技术选型.md)）：hook **用 Node 写、不用 bash**（Windows 无 bash）；用 **exec form**（`command:"node"` + `args:[脚本路径]`，避开 Windows `.cmd` shim 坑）；路径走 `${CLAUDE_PROJECT_DIR}` 占位符 + Node 平台 API，**不写死 POSIX**。
- hook 脚本是**薄壳**：`import` core 的内层库（`better-sqlite3`、FTS 召回、event/watcher/pending_choice 读写）直接读写同一 `.db`——与 MCP server 走同一套内层能力，不重复实现。

---

## 2. 常驻保证机制（Skills 包 §1.1 踢来）

[Skills 包 §1.1](Skills包.md) 指出：GM 核心 skill 靠 `description` 触发，而 skill **倾向 under-trigger**（简单一步查询可能根本不触发）——对"每轮都该在"的 GM 核心不保险。本页给**轻量组合**（[ADR-0014](../05-决策记录-ADR/README.md)）：

| 机制 | 形态 | 代价 | 取舍 |
|---|---|---|---|
| **CLAUDE.md 指针** | `init` 写一段"你是 Dicelore GM——**世界的诚实仲裁者、不是玩家的取悦者**；每轮主持先 consult `dicelore-gm-core` skill；尊重骰子、声明后果在先、非终局留 choice" | 极低（几行静态文本，恒在系统上下文） | ✅ 要 |
| **SessionStart 注入** | 开局 hook 注 `additionalContext`：GM 身份 + **Agenda 议程**（诚实仲裁者 + 描绘活世界 / 选择有后果 / play to find out）+ **极简**纪律摘要（别软着陆 / 该骰必骰 / 留 choice）+ 团本核心调性一句 | 低（开局一次） | ✅ 要 |
| ~~每轮 UserPromptSubmit 强化~~ | ~~每轮注 GM 摘要~~ | 中（token 每轮累积 + 与 skill body 重复） | ❌ **不要** |

**核心原则**：**指针（轻）恒在，教条本体（重）仍靠 skill 触发载入**。三处都只放"指路牌 + 最小纪律"，绝不把 `dicelore-gm-core` 的 body 复制进 hook——那既是 token 灾难，又抵消了 skill 的渐进式披露（[Skills 包 §0](Skills包.md)）。UserPromptSubmit 那轮留给**被动 rule 召回**（§3.2），不塞 GM 强化。

---

## 3. 三个承重 hook：抽象 → Claude Code 事件

[总体架构 §6](../03-架构/总体架构.md) 的"回合开始 / 回合末"映到 Claude Code 真实事件如下。**一轮 = agent 一个自然回合**（玩家输入 → 回合自然结束）天然对齐 UserPromptSubmit（回合开始）↔ Stop（回合末）。

| 抽象 | Claude Code 事件 | 触发时机 | 读什么（stdin + SQLite） | 注入 / 产出什么 |
|---|---|---|---|---|
| 开局上下文 | **SessionStart** | 启动 / `--resume` / `--clear` / compact 后 | session `.db`（概览）+ 团本核心调性 | `additionalContext`：GM 身份 + 极简纪律 + 调性（§2） |
| 回合开始 | **UserPromptSubmit** | 玩家提交输入、Claude 处理前 | `stdin.prompt`（玩家这轮说了什么）+ transcript head 锚 + rule 域 FTS 召回 | `additionalContext`：相关 rule 约束（§3.2）；记本轮起始 `seq`；**检测对话回退/分支 → 必要时 restore 快照对齐（§8）** |
| 回合末 | **Stop** | agent 完成响应、准备停止 | `transcript_path`（本轮对话）+ event 表（本轮 seq 区间）+ `pending_choice` 槽 | ① 物化 choice ② L3 审计：`decision:"block"`+reason（档 A）或写审计 event（档 B）（§3.3 / §4）**③ 写回合快照（锚定 transcript head，§8）** |

> watcher 到期**不在表内**——已下沉为 `sheet_update` 就地触发（§5）。

### 3.1 `session-start.mjs`（SessionStart）

开局/恢复时跑：读当前 `.db`（玩家卡概览、当前 sheet 钟）+ manifest 核心调性，吐 `additionalContext`（§2 的身份 + 极简纪律 + 调性一句）。**只注指路牌级内容**，团本世界底料仍靠 AI 运行期 `world_search` 按需取（[02 §5](../02-领域模型/核心概念.md)：设定不全量灌上下文）。`--resume` 会重跑此 hook → 续局自动重注身份（抗长会话冲淡）。

### 3.2 `turn-start.mjs`（UserPromptSubmit）= 被动 rule 召回（唯一职责）

承接 [跨agent §3](../03-架构/跨agent与适配层.md)、[内层 §4.4 rule 域](内层能力库.md)：

- 读 `stdin.prompt`（玩家这轮的输入）→ 对 **rule 域 FTS5(jieba)** 召回相关条目（"玩家要战斗" → 召回战斗硬着陆 rule）→ 经 `additionalContext` 注入**本轮**提示词。rule **AI 只读、被动拉**（守反讨好红线，AI 不能自查改 rule）。
- **纯本地 SQLite 查询**，远小于 UserPromptSubmit 的 **30s 超时**（该事件超时比其它 hook 短，故脚本不得联网、不得重活）。
- **顺带记本轮起始 `seq`**（写 `session_meta.turn_start_seq`）：供 Stop hook 圈定"本轮 event 区间"做 L3 审计。
- **顺带做快照 auto-sync 检测**（§8）：读 transcript 当前 head 锚，若它不是 `current_snapshot` 的后代（玩家 /rewind 过或切了分支）→ 先 `restore` 到 head 最近祖先对应的快照，再处理本轮 prompt。纯本地、仍在超时内。

> 为何 rule 召回在回合**开始**而非回合末：它要影响 AI **这一轮**的判断，得在 AI 处理前到位。旧 [总体架构 §6](../03-架构/总体架构.md) 一度把它列在 Stop hook 三件事里——但 Stop 只能 `reason` 让**当前**回合继续、注不进"下一轮"，故归位到 UserPromptSubmit（[ADR-0014](../05-决策记录-ADR/README.md)）。

### 3.3 `turn-end.mjs`（Stop）= 物化 choice + L3 审计（两件事）

agent 回合自然结束时跑。Stop hook **能** `decision:"block"`+reason 阻止停止、让 agent 继续（这是档 A 纠偏的地基），且能拿 `transcript_path` 读本轮完整对话。

**① 物化暂存 choice**（[ADR-0009](../05-决策记录-ADR/README.md)、[内层 §4.2 pending_choice 槽](内层能力库.md)）：
- 读 `pending_choice` 槽（`resolve_choice` 轮内反复调用、末次为准，落 SQLite 而非 MCP 内存，故 Stop 进程跨进程可读）。
- 非空 → 物化：落一条 `event(kind=choice、visible=1)`（选项 + 已锁后果，`seq` 早于玩家下轮 pick → L3 可验"后果在先"，anti-F2），槽 `status→materialized`。输出层（§7）据此 event 渲染待选项给玩家。
- 空 且本轮无 `game_end` → **档 A 违规**（把玩家晾着），见 §4。

**② L3 审计本轮**：按 `turn_start_seq` 圈定本轮 event 区间 + 读 transcript，做机械比对（§4）。

**③ 写回合快照**（[内层 §4.5](内层能力库.md)、§8）：在 ①②**之后**（故快照含已物化的 choice、本轮全部 mutation）调 core `checkpoint()`——锚定 transcript head UUID、`parent_id`=原 `current_snapshot`、记 `[turn_start_seq, turn_end_seq]`、遍历 participant 注册表 dump 可变态。若本轮被档 A `block`、agent 将继续，则**不写**（等真正回合末再写，避免半截回合入树）。

**防重入**：Stop hook 经 `stop_hook_active`（CC 提供，标识本回合已被 hook block 过）判断——**最多纠偏一次**；若 block 后 agent 仍未补，则放行 + 记违规，绝不死循环。

---

## 4. L3 审计：两档烈度（[ADR-0014](../05-决策记录-ADR/README.md)）

L3 守 [02 §4](../02-领域模型/核心概念.md)"事后兜底、不阻止当下"——但"非终局轮没留 choice"是 Stop hook 当场可机械确证、补救无歧义的，值得破例当场纠。故按**能否机械确证 + 补救是否无歧义**分两档：

| 档 | 信号 | 检测（机械、零 LLM） | 动作 |
|---|---|---|---|
| **A · block 当场纠偏** | 非终局轮无暂存 choice | `pending_choice` 槽空 ∧ 本轮无 `game_end` | `decision:"block"` + reason"本轮未给玩家选择，请补 `resolve_choice` 再结束" |
| **A · block 当场纠偏** | 漏 narrate | transcript 本轮有实质 assistant 文本 ∧ 本轮 event 无 `narrate` | block + reason"剧情请走 `narrate`（散文须落 event 才能审计 / 召回）" |
| **B · 只记录、不阻止** | 疑似软着陆（F2） | 坏 verdict / 失败档后，叙述或 `sheet_update` 偏正向（**语义性**，机械只能标风险点） | 写 `kind=note`、`visible=0` 审计 event，喂 [eval-loop](Skills包.md) |
| **B · 只记录** | 该掷却用 `=`（F3） | `sheet_update` 账本 `kind=set` 比例异常（[内层 §3.2](内层能力库.md)） | 同上 |
| **B · 只记录** | 掷骰绕过率（F1） | 本轮 verdict/mutation 与其后 narrate 的 seq 关系统计 | 同上 |

- **机械比对全在 `turn-end.mjs` 脚本里**（纯 Node、确定性、零 LLM、每轮跑）。读 event 表的账本（`rolled|set` 标记、verdict 结果）+ transcript 即可。
- **语义判断（软着陆与否）v1 不当场 block**：误报率高、会打断叙事、违"L3 不阻止当下"。纯记录喂 eval-loop（[Skills 包 §6.1](Skills包.md)：F1/F2/F3 是可客观验证的失败，L3 信号直接复用作 eval assertions）。
- **无独立裁判 subagent**（[ADR-0014](../05-决策记录-ADR/README.md)）：v1 不为语义判断 spawn 子 agent——它与"主 agent 被 block 唤回自查"职责重叠、多一次 LLM 往返、且触发还得绕 Claude Code 的实验特性。"让主 agent 自查软着陆"作为**未来强化**经下一轮 UserPromptSubmit 轻推实现（不打断当下）；独立裁判 subagent 降为未来 / 可选。

---

## 5. watcher 不在 hook（边界澄清）

[ADR-0013](../05-决策记录-ADR/README.md) 把旧 `timer`（时间到期、靠 hook 回合轮询）泛化为 **`watcher`（sheet 数据触发器）并从 hook 解绑**：

- 触发条件 = 任意 sheet 属性谓词（`{张三.HP} < 30`、`{世界.天} >= 18`，时间到期只是监视钟 attr 的特例）。
- **就地触发**：`sheet_update` 写完，内层引擎重算本批 entity 上挂的 watcher，命中则 payload 经 `sheet_update` **出参当轮回 AI** + 落 `event(kind=watcher_fired)`（[内层 §4.2](内层能力库.md)、[MCP §2.2/§2.3](MCP工具面.md)）。
- **edge-triggered**（跨越沿触发一次、条件解除才 re-arm）+ `mode` once/repeat，v1 无显式 cooldown。

→ 故 watcher **是内层 / MCP 的 core 能力、不绑 Claude Code、不经任何 hook**。本页 hook 栈因此只剩 §3 的三件事（开局 / rule 召回 / 物化+审计）。

---

## 6. `narrate`：v1 直用 + 漏 narrate 兜底（降级是未来）

承接 [总体架构 §4.1](../03-架构/总体架构.md)、[MCP §4](MCP工具面.md)、[ADR-0014](../05-决策记录-ADR/README.md)：

- **v1 `narrate` 作 MCP 工具直接用**：骑定 Claude Code，AI 能直接调 `dicelore_narrate`，无需任何降级。
- **真问题是"绕过"而非"不能调"**：AI 可能偷懒只在对话气泡里讲剧情、不调 `narrate` → 散文没进 event 表（没法 L3 审计、`event_recall` 召不回）。v1 **靠 §4 档 A 的"漏 narrate"机械检测兜底**（本轮有实质文本却无 narrate event → Stop block 提醒补），**不做自动捕获**。
- **降级（"talk + 自动捕获写 event"）是未来给非 Claude Code 基底的饼**：v1 不实现——它与显式 `narrate` 重复、且"哪段算剧情"边界模糊。本页只锚定其位置。

---

## 7. 输出层：呈现模型生成器（读侧）+ 正交前端壳

[总体架构 §7 组件4](../03-架构/总体架构.md) 把输出层归本组件、定为 **v1 一等概念**（[ADR-0009](../05-决策记录-ADR/README.md) 流②）。本页把它**上下拆开，只做上半**：

### 7.1 呈现模型生成器（本页定，v1 一等）
**读侧纯逻辑**：输入 = session `.db`，输出 = 一份**结构化呈现模型**——

```
呈现模型 = {
  机械回显:  本轮 verdict / mutation / watcher_fired event（"金钱 +3d100=74 → 77"）,
  状态菜单:  当前可见 sheet cells（按 §7.3 可见性判定）,
  待选项:    最新 kind=choice event 的选项 + 已锁后果,
}
```

- **按 `visible` 过滤**（[03 §3.1](../03-架构/总体架构.md)、[内层 §4.1/§4.2](内层能力库.md)）：cell 可见 ⟺ `visible=1` ∨（entity 有 `__show_all` ∧ `visible≠2`）；event 按 `kind` 默认 + 覆盖。**GM 全见、玩家只见授权**。
- **纯函数、可单测、零 LLM、不进 AI 上下文 = 零额外 token**（流②的本质：AI 只 `narrate` 色彩，数值菜单由它渲染）。

### 7.2 前端壳（正交分层，本期不做、不锁形态）
- 呈现模型的**消费者**——终端 TUI / 未来 GUI 都消费同一份模型。
- **GUI 是 v1 的真实目标**（命令行学习成本高），但**很正交、很重** → 本期**不做**，呈现模型生成器为它留**稳定接口**（[跨agent §6 轴二](../03-架构/跨agent与适配层.md)：未来 GUI 读 store 展示，与"哪个模型当 GM"正交）。
- v1 朴素消费者：最薄可以是 `dicelore play` 在回合末把呈现模型打印到旁路视图；**呈现模型先就绪、华丽壳等 GUI 阶段**。
- **边界澄清——运行时 GUI ≠ 构建期 Web**（[ADR-0015](../05-决策记录-ADR/README.md)）：本节"GUI 属未来"只约束**运行时游玩界面**（玩游戏 v1 仍走终端）。[团本构建工具链](团本构建工具链.md) 的**构建期 Web 门面**是另一回事——作者侧、构建期专属、有可交互前端，**v1 即做**；两者解耦（共享文件包 / `.db`，不共享前端），构建期 Web 早做不破本节的运行时裁定。

### 7.3 与 hook / 三流的接线（共享 SQLite，不直接 IPC）
- 呈现模型生成器**轮询 / 监听 `.db`**（event 表新 seq、`pending_choice` 物化）重算——与 Stop hook **靠共享 SQLite 解耦**，不直接进程通信。Stop hook 物化 choice → 落 `kind=choice` event → 生成器读出 → 壳渲染待选项。
- **三流归位**：流① `narrate` 走 Claude Code 对话气泡（AI 本就输出）+ 落 event；**流② = 本节呈现模型**（读 store/event 按 visible，零 token）；流③ resolver/`sheet_update` 结构化结果经 MCP 出参只回 AI（[MCP §0](MCP工具面.md)）。

---

## 8. 快照 hook：与 Claude Code /rewind 自动同步（[内层 §4.5](内层能力库.md)、[ADR-0017](../05-决策记录-ADR/README.md)）

回滚机制（快照树）是 [内层 §4.5](内层能力库.md) 的 agent 无关 core；**本节只定「对话回退 ↔ 快照」怎么关联**——这半吃 CC transcript 专属概念，故住 adapter。

### 8.1 核心洞察：transcript 是树，快照锚定其上即白拿 branch

CC 的对话记录（transcript jsonl）本身是 **UUID 父子链树**（/rewind 就是靠它回退 + 重生成出分支）。快照行 `transcript_anchor` 锚到回合末的消息 UUID → 快照树**继承 transcript 树的形状**，branch 不需额外机制（SillyTavern「checkpoint + 消息树」同构）。**回滚 / branch 不进 AI 工具面**（玩家元动作、非游戏动作；[MCP §7](MCP工具面.md) resolver 清单本就无它）。

### 8.2 两个既有 hook 承重（不新增 hook）

| 时机 | hook | 干什么 |
|---|---|---|
| **创建快照** | Stop（§3.3 ③） | 回合末 `checkpoint()`，锚定 head UUID、parent=原 head |
| **检测 + 恢复** | UserPromptSubmit（§3.2） | 读 transcript head；若非 `current_snapshot` 后代 → `restore` 到 head 最近祖先快照，再处理 prompt |

- **检测点为何在 UserPromptSubmit**：/rewind 本身可能不触发任何 hook，但玩家回退后**总要再说一句话** → turn-start 必跑。那一刻比对「transcript head 在哪 ↔ store 在哪」即可发现错位并对齐。
- **swipe / branch 自然落地**：玩家 /rewind 到 N-1 再发话 → head 落在 N-1 子树 → 检测到错位 → restore 到 N-1 → AI 重新生成 N（新 UUID、新快照、parent=N-1，老分支留存）。swipe **默认重掷**（[内层 §4.5.4](内层能力库.md)）。
- **与 CC 自带 file checkpoint 正交**：玩家一次 /rewind 回退对话（+ 可选 CC 自己的文件 checkpoint），本 hook 顺带把 store 对齐到同一对话位置——**统一 UX、机制各管各**（CC 管对话/文件、我们管 store）。

### 8.3 实现期待核实 + 兜底

- **吃 CC transcript 内部结构**（UUID 父子树；compact / `--clear` 后 UUID 是否存续、检测点确切 stdin 字段）→ 按本页惯例标**实现期官方文档核实**。
- **兜底 = 人类侧 CLI**：保留 `dicelore rewind [n]` / `dicelore checkpoints`（同源扩展 [内层 §6](内层能力库.md) 的瘦 CLI new/list/inspect），作 transcript 关联不可靠时的手动逃生口 + headless/调试入口。**auto-sync 是主 UX、CLI 是逃生阀**。
- **rule 带外不随回滚**：rule 不注册为快照 participant（[内层 §4.5.2](内层能力库.md)）→ 回滚永不碰 `rule_doc`，会话中途热更的 rule 自动留存；restore 出的状态始终跑**当前** rule。

---

- 工具 schema、补刀 `reminders` 挂载点 → [MCP 工具面](MCP工具面.md)；教条 / Moves / Principles 内容 → [Skills 包](Skills包.md)
- event/watcher/`pending_choice` 的**表 schema 与求值语义** → [内层能力库](内层能力库.md)（本页只定 hook 怎么读写它们）
- 确切的 Claude Code hook stdin 字段名 / JSON 决策格式 → 实现期官方文档核实（本页定映射与意图）
- manifest 怎么声明"选哪些流程 skill"、`dicelore init` 拷哪些 → [团本与 manifest](团本与manifest.md)
- 未来 **GUI 呈现层**的技术栈与界面、玩家选择的捕获方式（聊天 / 转轮 / 投票）、单/多人模式 → 未来 / 模式层
- 多人论坛安价的远程部署（Streamable HTTP）→ 未来（[场景 B](../01-业务分析/用户与场景.md)）
</content>
</invoke>
