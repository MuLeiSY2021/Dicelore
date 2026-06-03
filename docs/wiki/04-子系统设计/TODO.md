# 04-子系统设计 TODO（草稿 / 进度追踪）

> 非正式页，追踪每页填充进度 + 已 locked 的设计决策（账本）。定稿进正式页。

## 内层能力库（组件1）— ✅ 已写定（2026-06-02），整页见 [内层能力库.md](内层能力库.md)

**已锁定**：

- [x] **内/外层切法 = C**：dice 引擎（纯函数）/ store CRUD / 裁决编排（吃 store+dice，可单测）三个原子层。
- [x] **sheet = `(entity, attr, value)` 三列**，每 cell 一标量；集合/关系靠 `attr` 的 `前缀:键` 约定（`库存:药水`、`声望:黑风寨`、`物品实例#1.耐久`）。值存文本，取数时 parseInt，非数值报错。
- [x] **world = `world_doc`(FTS 散文) + `world_pool`(row_json, weight, source)**；结构保真**不拍平**；按列过滤(json_extract)+加权抽样在 TS 裁决层；`source=author/ai` 当迁移钩子；register 可写 doc/pool。
- [x] **rule = `rule_doc`(FTS + version)**；被动整段读；结构小表（曲线/分档）拍平进散文 OK（不抽样、不过滤）。
- [x] **FTS5 = @node-rs/jieba 写入分词 + `unicode61` 影子列**；trigram 作零依赖保底（schema 不变可切换）。snippet 带空格无害（agent 整段读）。
- [x] **mutation 求值语义**：`算符 × 操作数` 2×2 派发（`+/-`×数值=标量算术 / ×词条=集合增减；`=`×数值=赋数 / ×词条=赋文本）；LHS 裸名归批次实体、RHS 引用强制显式；批量原子事务；账本标 `rolled|set`；引擎不 clamp。

- [x] **§1 骰子引擎（resolver 轮收口）**：分两层——**引擎 A**（纯、RNG 注入可单测）：`rollDice(count,sides,rng)` + `rangeMap(value,bands)`；**求值器 B**（内层、为引用碰 store）：`expr` 文法 `term(±term)*`、`{}` 界定引用，逐项调 A 求和、回账本。**砍** `dice_judge`（DC 折进 contest）/`dice_multi`（批量上移）/独立 `dice_contest`（=evalExpr×2+比大小）。**暴击** = `resolve_outcome` 档位表里定档，非引擎逻辑。

- [x] **event 域 schema（2026-06-02 锁定）**：
  - 一张统一 `event(seq[=FTS5 rowid], kind, content, data_json, tags, game_time?, created_at)`，`kind ∈ {narrate, verdict, mutation, note, timer_fired}`；`content` 走 FTS5(jieba) 只索引散文(narrate/note)、结构进 `data_json`(UNINDEXED)、`tags` 兜底召回。
  - **时间观拆分**：框架只拥有单调 `seq`（通用排序）；**"游戏时间/回合"是团本定义的 sheet 钟**（`世界.回合`/`世界.时间`），由团本 rule 推进、AI 用 `sheet_update` 改；**砍框架 turn 计数器**。
  - **L3 分组 = "一个 agent 回合"**（玩家输入→回合末 Stop hook，按 seq 圈定本轮 event）——机械范围，非游戏时间；narrate 不推进游戏时间。（2026-06-03 R1 重定义，取代旧"两个 narrate 标记间"——narrate 已升格 stream。）
  - `event.game_time?` = 写入时对 sheet 钟拍的可选快照(文本)，仅供回看展示/召回，框架不解释。
  - 溢出后续优化（压缩 / RAG），v1 不做。
- [x] **timer 单独表**：`timer(id, created_seq, fire_condition, payload, status)`；`fire_condition` = 对 sheet 钟的条件(`{世界.回合}>=15`)或文本(AI/hook 判)；**hook 在回合开始比对触发**（[03 TODO B](../03-架构/TODO.md)）；fired 后落一条 `event(kind=timer_fired)`、status→fired。属 event 域、域内两表。

**已写定**（见 [内层能力库.md](内层能力库.md) §6）：

- [x] **session 解析**：人类可读名 + `ANKO_SESSION` env 定位；开库自建四域 schema；`session_meta` 记团本 id+版本 / created_at / display_name / `schema_version`；建库灌注团本（import 归团本页）；瘦 CLI 管理。

## Skills 包（组件3）— ✅ 已写定（2026-06-03），整页见 [Skills包.md](Skills包.md)

**已锁定**：

- [x] **结构 = 两层**：常驻 **GM 核心 skill**（`anko-gm-core`：dispatcher + guideline + 补刀指针在 body，深表入 `references/`）+ **流程 skill 库**（`anko-flow-*` 各一独立 skill、manifest 选、genre-context 触发）。dispatcher+guideline 合在常驻核心（都"每轮必在"，拆开翻倍 under-trigger 风险）。
- [x] **dispatcher 形态 = 决策表**（非流程图）：**两道闸 + 形状表**。闸 A 谁拥有决定（自主→`resolve_choice`）；闸 B 该不该骰（公认裁决律：不确定∧失败有意义，否则别骰直接 narrate）；形状表镜像 resolver 二轴（label→`resolve_outcome`/verdict→`resolve_contest`/number→`sheet_update`带骰/content→`world_sample`）。补丁：安全vs冒险、打平降级。顶部立 anti 两极端（别什么都骰/别什么都选）。**扎 [01 §2c 语料](../01-业务分析/调研-论坛语料痛点.md) + 桌游公认律（Vincent Baker/AW）+ resolver 二轴三角证据。**
- [x] **guideline 组织 = F 轴 + 两新范式簇**：F1 必掷 / F2 别软着陆（恶龙团"分层范式"作可教范本）/ F3 薄（指 dispatcher）/ **一轮范式纪律**（作者式创作·narrate 非终结·非终局留暂存 choice·不吐数值菜单）/ **可见性纪律**（开局 show 玩家卡·暗值强制隐·别在 narrate 吐隐藏值）。写法：imperative + 讲 why、忌硬 MUST、串成"一轮怎么走"（skill-creator）。
- [x] **载体 = 焊进** `.claude/skills/`（[ADR-0012](../05-决策记录-ADR/)）：静态 markdown、走 Claude Code skill 装载（顺技术选型§2/跨agent§2、非回头路）。被否运行时 MCP 读取（=MCP 承载 L2 范畴错误）。
- [x] **补刀分工**：MCP `reminders` = 极小 L1 基线（terse 反射，归 [MCP工具面 §5](MCP工具面.md) 挂载点）；丰富措辞 + why = 焊进 guideline（L2，`references/reminders.md`）。v1 不让 hook 往 reminders 塞 L2 富文本。
- [x] **流程库起步清单**：`anko-flow-gacha`(world_sample)/`-contest`(resolve_contest)/`-anka`(resolve_choice)/`-explore`(world_search/reveal_once)；开放扩展。流程 skill 只编排已有工具调用序、不新增工具/不碰 schema/存储。

**印证 skill-creator（写进页面、未改决策）**：渐进式披露三级（metadata 恒在/body 触发载/references 按需，<500 行）；`description` 是唯一触发器且 under-trigger → 核心写 pushy 常驻描述、流程写 genre-context；**简单查询可能不触发** → 常驻*保证*（CLAUDE.md 指针/系统上下文/hook 强化）踢给 [adapter](adapter与L3审计.md)；措辞终稿靠 eval-loop（with/without baseline），**F1/F2/F3 可客观验证 → L3 审计信号（掷骰绕过率/后果-叙事一致）复用作 assertions**。

**跨页联动 / 留给下游**：注入与常驻保证 → [adapter 与 L3 审计](adapter与L3审计.md)；manifest 选 skill → [团本与 manifest](团本与manifest.md)；补刀字段挂载点 → [MCP工具面 §5](MCP工具面.md)；存储 → [内层能力库](内层能力库.md)。

## 工具面已定决策（✅ 已落 [MCP工具面](MCP工具面.md) 整页，2026-06-03）

- [x] 全员 **`anko_` 前缀**（防多 server 撞名）。
- [x] 裁决族统一 **`anko_resolve_*`**：`resolve_choice` / `resolve_outcome` / `resolve_contest`。
- [x] **三个裁决工具都写"裁决记录" event**（记机械结果，喂 L3 比对 `narrate` 的叙述）。
- [x] **sheet 读拆两工具**：`anko_sheet_get`（单 cell）+ `anko_sheet_list`（前缀扫，取整卡/整库存）。不用 `_like`（泄漏 SQL）。
- [x] **mutation 用结构化数组** `[{attr, op, expr}]`；`expr` 统一命名（弃 operand），值表达式用 B（字符串 DSL + `{}` 引用），随 op 多态，交内层求值器。
- [x] **mcp 用法教条 → [Skills包](Skills包.md)**：一个"工具选择决策树"skill（三条掷的路怎么选；F3 的 L2 二层保险）。
- [x] 是否为保 L1 再分出掷骰名（纯塑形取舍）→ **否**：合一 `sheet_update`，靠 L2+L3（[ADR-0007](../05-决策记录-ADR/)）。
- [x] `timer_set` 命名 → **`anko_timer_set`**（独立名、不挂 `event_` 前缀，与全 wiki 既有用法一致）。
- [x] **R1-R3 带来的工具面新增**（已落页）：`narrate` schema `{text,tags?}→{event_id,reminders?}`（无 game_time、stream）；`resolve_choice` 暂存语义（回合末 Stop hook 物化）；可见性工具 `sheet_show`/`world_show`/`reveal_once`（多态 sheet+world）；写工具可选 `visible` 参（`sheet_update` mutation / `event_append` / `world_register`）；**补刀 = 出参可选 `reminders` 字段**（内置 L1 基线 + Skills 增强，措辞归 Skills）；终局 `game_end`/`you_death`（v1 极简、复盘是饼）。
- [x] **接口契约补全（2026-06-03，/mcp-builder review）**：§0 加 5 条通用约定——`outputSchema`/`structuredContent` 落地、入参 `.strict()`、工具 `description` 属本页契约（非 L2）、失败路径信封 `{error:{code,message,hint}}`（触发条件归内层）、`CHARACTER_LIMIT` 封顶；`sheet_list` 加 `limit/offset/has_more`（分块非可见性限制）；`event_append.data_json` `z.any`→`z.unknown`；新增 **§7.1 工具注解表**（readOnly/destructive/idempotent，openWorld 全 false）；§2.2 互指 Skills dispatcher。**未越界**：注解/分页/错误信封/契约皆属工具接口、本页职责内，无需回头路。
- [x] **接缝对齐**：§5 `reminders` 删去"可由 guideline/hook 增补"、改为"只载内置 terse 表、v1 不运行时注入 L2"（对齐 [Skills 包 §5](Skills包.md) v1 裁定）；`narrate` 从承载工具移除（无客观结构触发位）。
- [x] **`shot` → `reveal_once` 全量改名回头路（2026-06-03）**：领域术语改名，按单向推导一次扫全——02（术语表/核心概念）、03（总体架构/TODO）、04（MCP工具面/Skills包/内层能力库/本 TODO）统一；ADR-0010 加历史注解（决策原文保留 `shot`、不重写）。理由：`shot` 单字、语义糊，`reveal_once` 与 `kind=reveal` 同源、与持久 `*_show` 成对照。

## resolver 模型（行动层核心，2026-06-02 锁定；resolver 概念待升格 → 见 [03 TODO](../03-架构/TODO.md) C）

**核心**：resolver = 把未定局面产出一个"叙述者无法伪造"的结果，并推动剧情（落 event / 可能写 sheet）。骰子引擎只是其下的逻辑机制；**玩家选择 = "选择者=玩家" 的 resolver**。

**2 轴穷尽表**（团特有的只是参数/数据，不长新工具）：

| 选择者＼结果形状 | **label** | **verdict** | **number** | **content** |
|---|---|---|---|---|
| **玩家选** | `resolve_choice` | — | — | —（挑卡＝choice 变体） |
| **随机选** | `resolve_outcome`（档位） | `resolve_contest`（比表达式；**DC＝比常数**） | `sheet_update` 带骰（状态骰下沉） | `world_sample`（卡池） |

**统一澄清**：DC 不是独立 judge，是 contest 一边退化成常数；number 形状＝sheet_update 带骰（已下沉）；卡池抽＝world_sample 也是 resolver（随机选 content，结果空间来自 store）。

**三个 resolve 工具 I/O**（`anko_resolve_*`；引用在引擎内取真值；产出落 event 回 `event_id`）：
- `resolve_choice`：req `{prompt, options:[{label, consequence(必填)}]}` → resp `{locked_options, event_id, awaiting:"player_pick"}`
- `resolve_outcome`：req `{context, die, bands:[{label,min,max,consequence}]}` → resp `{roll, die, band, event_id}`
- `resolve_contest`：req `{context, a:{name,expr}, b:{name,expr}}` → resp `{a:{rolls,refs,total}, b:{...}, winner, event_id}`
- （number）`sheet_update`：req `{entity, mutations:[{attr, op, expr}]}` → resp `{entity, applied:[{kind:rolled|set, old, rolls, delta, new}], event_id}`

**皱褶**：`resolve_choice` 是"锁后果 + 落 event"在前，**玩家实际选哪个是玩家下一轮**（同步调用拿不到人输入）→ `awaiting:"player_pick"`；"怎么捕获玩家输入（聊天/转轮/投票）" ＝ 模式/adapter 层，本页不定。

**值表达式 `expr`（2026-06-02 锁定）**：表示用 **B＝字符串 DSL + `{}` 界定引用**（`"1d20 + {张三.力量}"`、`"500 + 6d100"`、`"60"`）；**统一命名 `expr`**（弃 operand），用于 `resolve_contest.{a,b}.expr` 与 `sheet_update` mutation 的 `{attr,op,expr}`。`sheet_update` 里 `expr` 随 op 多态（值表达式 / 成员字面量 `小刀[*N]` / 文本字面量），求值器按 op+内容派发；`resolve_contest.expr` 恒为值表达式；`resolve_outcome.die` 是单骰串、不卷入。

## 跨域 / 上游联动

- timer 到期触发、被动 rule 召回 = hook 系 → 见 [03 TODO](../03-架构/TODO.md) A/B。
