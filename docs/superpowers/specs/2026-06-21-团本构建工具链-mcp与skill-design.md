# 团本构建工具链：构建期 MCP + 构建 skill（设计）

> **状态**：草案（2026-06-21 brainstorming）
> **落地的 wiki 契约**：[组件5 团本构建工具链](../../wiki/04-子系统设计/团本构建工具链.md)、[组件6 团本与 manifest](../../wiki/04-子系统设计/团本与manifest.md)
> **对齐的实现约定**：[MCP工具面 §0 通用约定](../../wiki/04-子系统设计/MCP工具面.md)、[ADR-0015 构建台](../../wiki/05-决策记录-ADR/README.md)、[ADR-0018 玩家客户端/headless host](../../wiki/05-决策记录-ADR/README.md)

---

## 0. 问题陈述与缺口

`@dicelore/core` 现有代码**只为"跑团"负责**：内层四域 store、运行时 MCP（`dicelore_resolve_*` / `sheet_*` / `world_*` / `rule_search` / `narrate`）、运行时 skill（`dicelore-gm-core` / `dicelore-flow-*`）、`dicelore init` + 三 hook。**"造团本"在代码层完全空白**。

wiki 层面组件5/6 已🟢定稿，定了**意图与产物契约**，但缺**可落地的具体设计**：`dicelore_build_*` 的 Zod schema、读写层函数签名、`dicelore-build-pack` 的 SKILL.md、以及——最关键的——**后端怎么 bootstrap 一个构建会话**都没有。

本设计补这个缺口。

### 0.1 本 slice 范围

**纳入**：① 团本包读写层（CRUD + 校验器）；② 素材检索库最小版（切块 + FTS5/jieba）；③ 构建期 MCP 门面 `dicelore_build_*`；④ 构建 skill `dicelore-build-pack`；⑤ 双路径后端（core 工厂 + orchestrator `BuildHost` + server 入口）；⑥ Claude Code TUI 入口 `dicelore build-init`。

**不纳入（留后续 slice）**：构建期 **Web 门面**（本地 http 服务 + 可交互前端，[组件5 §2.2](../../wiki/04-子系统设计/团本构建工具链.md)）；语义向量检索；完整版本迁移工具（diff/merge）。本 slice 的"用户审阅"走对话 / `dicelore_build_read` 回读 / CLI，Web 门面后续接上即可（读写层不变）。

---

## 1. 第一性约束：两套场景物理隔离（invariant）

**构建期不得出现跑团 skill/工具；跑团时不得出现构建 skill/工具。** 这条**不能靠 skill description "自觉不触发"保证**——description 只决定触发、不决定是否在场。唯一可靠的隔离是**那套工具/skill 根本不被装载**。

本设计把隔离做成**三处物理分离**，使"装错"在结构上不可能：

1. **源目录分离**：运行时 skill 源 `packages/core/skills/`，构建 skill 源 `packages/core/build-skills/`（新增）。两个入口各只 glob 自己那个目录，不存在"一个 glob 把两套都拷进去"的可能。
2. **MCP 工具数组分离**：运行时 `TOOLS`（[tools.ts](../../../packages/core/src/mcp/tools.ts)）与构建 `BUILD_TOOLS`（新增）是两个独立数组，两个 server 入口各引各的，**编译期就不交叉**。
3. **后端 bootstrap 路径分离**：跑团 `SessionHost` 与构建 `BuildHost` 两个独立宿主类，各自只挂自己那套 MCP + skill + 插件（§5）。

> 这条约束驱动了 §5 的"两个独立宿主类"选择——隔离是**结构事实**，不是运行期纪律。

---

## 2. 代码落点（package 边界）

构建台 = "同一个 host 换装"——靠**注册哪套 MCP + 注入哪个 skill** 隔离，**非物理隔离**。故落在 core 内，复用基建：

```
packages/core/
├── src/
│   ├── build/
│   │   ├── pack/          ① 团本包读写层(纯逻辑 CRUD over 文件 + 校验器)
│   │   │   ├── manifest.ts  world.ts  npc.ts  pool.ts  param.ts
│   │   │   ├── sheet.ts  rule.ts  front.ts  read.ts
│   │   │   ├── validate.ts  layout.ts(包目录布局常量) csv.ts(列序/转义) frontmatter.ts
│   │   │   └── *.test.ts
│   │   └── retrieval/     ③ 素材检索库(切块 → 临时 SQLite+FTS5/jieba → 召回)
│   │       ├── ingest.ts  search.ts  chunk.ts  db.ts  *.test.ts
│   ├── mcp/
│   │   ├── build/         ② 构建期 MCP 门面
│   │   │   ├── tools.ts(BUILD_TOOLS)  build-main.ts(独立 stdio 入口)
│   │   │   ├── server.ts(createBuildMcpServer 工厂)
│   │   │   ├── handlers/{pack,retrieval}.ts   schemas/{pack,retrieval}.ts
│   │   │   └── *.test.ts
│   │   └── (现有运行时 mcp/* 不动)
│   └── adapter/
│       └── build-init.ts  (Claude Code TUI 入口,平行于 init.ts)
└── build-skills/
    └── dicelore-build-pack/
        ├── SKILL.md
        └── references/{extract-playbook,format-cheatsheet,validation-fixes}.md
```

- **复用基建零新依赖**：检索库直接复用 core 的 FTS5/jieba（[store/fts.ts](../../../packages/core/src/store/fts.ts)），切块入临时库（与成品包解耦，[组件5 §3](../../wiki/04-子系统设计/团本构建工具链.md)）。
- **读写层 + 校验器是 TS 纯函数模块**，不依赖 Agent SDK / MCP / Web，可单测（镜像内层能力库分层哲学）。

---

## 3. ① 团本包读写层（纯逻辑核心）

文件即真相、即写即读、无内存态（[ADR-0015](../../wiki/05-决策记录-ADR/README.md)）。每个函数吃进格式细节（CSV 列序、frontmatter、子目录布局），**调用者永不手搓 CSV 语法或 frontmatter**。

### 3.1 函数签名

所有写函数 `(packDir, args) → WriteResult`；`WriteResult = { file: string; warnings: ValidationIssue[] }`（每次写顺带跑该文件的局部校验，[组件5 §1](../../wiki/04-子系统设计/团本构建工具链.md)）。

```ts
// packDir = 团本目录根。函数内部决定写哪个子目录、哪个文件名。
interface ValidationIssue { level: "error" | "warn"; file: string; msg: string; hint?: string; }
interface WriteResult { file: string; warnings: ValidationIssue[]; }

// manifest.yaml —— 顶层声明(部分字段可增量 set,合并写回)
setManifest(packDir, m: {
  id?: string; version?: string; name?: string; description?: string;
  flows?: string[];        // 选用的流程 skill;校验"真实存在"见 §3.2
  clock?: string;          // 钟属性声明
  entry?: string;          // 开局引子(world doc 锚点或内联)
}): WriteResult;

// world/**/*.md —— 散文底料(世界观/门派/NPC人设)
writeWorldDoc(packDir, d: {
  path: string;            // world 下相对路径,如 "门派/黄枫谷.md"
  content: string;         // 散文正文
  tags?: string[]; visible?: 0 | 1; // frontmatter;visible 缺省隐(deny-by-default)
}): WriteResult;

// NPC = 人设散文 doc + 可选机械数值 sheet 卡(同 entity 名)
addNpc(packDir, n: {
  name: string;            // entity 名,人设落 world/npc/<name>.md
  persona: string;         // 人设/性格/动机/背景散文
  visible?: 0 | 1;
  sheet?: { attr: string; value: string; visible?: 0 | 1 | 2 }[]; // 关键 NPC 预置数值卡
}): WriteResult;

// pools/*.csv —— 卡池/随机池;整行存(不拍平),写对列序
addPool(packDir, p: {
  pool: string;            // 池名 → pools/<pool>.csv
  rows: Record<string, string | number>[]; // 每行任意列;weight/source/visible 元列可选
}): WriteResult;

// params/*.csv —— 分档表(label/min/max/consequence),列名对齐 resolve_outcome.bands
setParamBand(packDir, p: {
  table: string;           // → params/<table>.csv
  bands: { label: string; min: number; max: number; consequence: string }[];
}): WriteResult;

// sheets/*.csv —— 开局状态(entity,attr,value,visible)
setSheetCell(packDir, s: {
  file?: string;           // 默认 sheets/开局.csv
  cells: { entity: string; attr: string; value: string; visible?: 0 | 1 | 2 }[];
}): WriteResult;

// rules/*.md —— 机制规则,带 version frontmatter
writeRule(packDir, r: {
  name: string;            // → rules/<name>.md
  content: string; version: number;
}): WriteResult;

// fronts/*.md —— 阵线 + 倒计时钟 + 凶兆阶梯(每行→预声明 watcher)
addFront(packDir, f: {
  name: string;            // → fronts/<name>.md
  clock: string;           // 钟 attr
  min: number; max: number; mode: "once" | "repeat"; visible?: 0 | 1;
  stakes: string;          // 利害问题
  prose: string;           // 阵线散文
  ladder: { at: number; payload: string }[]; // 凶兆阶梯:钟值→触发 payload
}): WriteResult;

// 回读(即写即读审阅)
readPack(packDir, ref: { kind: "manifest" | "world" | "pool" | "param" | "sheet" | "rule" | "front"; id?: string }):
  { found: boolean; content: string; meta?: Record<string, unknown> };

// 整包校验
validatePack(packDir): { issues: ValidationIssue[]; ok: boolean };
```

### 3.2 校验器（贯穿每次写 + 整包跑）

`validatePack` 汇总，单次写函数复用其子检查。覆盖 [组件5 §1](../../wiki/04-子系统设计/团本构建工具链.md) 列的全部：

- **CSV 列合法**：表头匹配 [组件6 §4 列规范](../../wiki/04-子系统设计/团本与manifest.md)；`weight` 数值；`visible ∈ {0,1,2}`；`min ≤ max`、分档**不重叠且全覆盖**（复用内层 `rangeMap` 校验思路）。
- **`manifest.flows` 真实存在**：比对 `build-skills/` 注册表（构建期能看到的流程 skill 清单——注意是**校验"团本选的流程 skill 名"在框架已发布的 flow 集合里**，不是检查当前目录）。
- **`manifest.clock` 指向的 attr** 在 sheets / fronts 声明内或约定内。
- **引用完整性**：`entry` 锚点存在；param 表被引用列齐全；NPC 人设 doc 与其 sheet 卡 entity 名一致；front 的 `clock` 与 ladder 自洽（`at` 落在 [min,max]）。
- **路径/编码**：UTF-8；文件名无非法字符；落在正确子目录。
- **产物**：`ValidationIssue[]`（结构化、定位到文件），供门面回显（本 slice 经 MCP 出参 / CLI 回显；Web 高亮留后续）。

---

## 4. ③ 素材检索库（最小版）

承接 [组件5 §3](../../wiki/04-子系统设计/团本构建工具链.md)：几百万字原材料远超 agent 上下文 → 先建检索库、按阶段检索。**临时品、不进成品包、可弃。**

```ts
// 切块建库:源文件(小说/同人/设定集) → 切块 → 临时 SQLite + FTS5(jieba)
ingest(retrievalDb, src: { files?: string[]; text?: string }): { chunks: number };
//   files = agent 给的源文件路径(读盘切块);text = 直接粘贴的文本。
//   切块策略:按段落/标题边界,带 overlap;每块存 (chunk_id, source, ordinal, content) + FTS。

// 按阶段检索:复用运行时 FTS5/jieba 基建(store/fts.ts)
search(retrievalDb, q: { query: string; k?: number }): { chunks: { source: string; content: string; score: number }[] };
```

- **存储**：独立临时 SQLite（非成品包、非跑团 store），随构建会话可弃或缓存复用。
- **语义向量检索列未来**（与运行时 RAG spike 同档）；本 slice 只关键词 FTS5 + jieba。

---

## 5. ⑤ 双路径后端（第一性约束在运行期的兑现）

orchestrator（Agent SDK headless host，[组件7](../../wiki/04-子系统设计/玩家客户端.md)）**不读 `.claude/`**（[AgentSdkDriver.ts:30](../../../apps/orchestrator/src/gm/AgentSdkDriver.ts#L30) `settingSources: []`）：MCP 进程内注入、skill 显式塞 `systemPrompt`。故后端隔离是**"bootstrap 时挂哪套 MCP 实例 + 注入哪个 prompt"**。现有 [SessionHost](../../../apps/orchestrator/src/session/SessionHost.ts) 只有一条路径，本设计加第二条。

### 5.1 core 侧：两个 MCP 工厂（编译期不交叉）

```ts
// 已存在(运行时)
createMcpServer(db, { onCanonWrite, rollGate }): McpServer;   // 挂 TOOLS

// 新增(构建)
interface BuildCtx { packDir: string; retrievalDb: DB; }
createBuildMcpServer(ctx: BuildCtx, deps?: {}): McpServer;     // 挂 BUILD_TOOLS
```

skill 内容（gm-core / dicelore-build-pack）作为**可注入字符串**供 host 塞进 `systemPrompt`（headless 路径）；同一份 markdown 也是 Claude Code TUI 路径要拷的文件（§6）。

### 5.2 orchestrator 侧：两个独立宿主类

差异恰好落在**运行时专属插件**——构建一个都不要。两个独立类各自只 wire 自己世界的线（隔离=结构事实）：

| | `SessionHost`（跑团，已存在） | `BuildHost`（构建，新增） |
|---|---|---|
| 挂的 MCP | `createMcpServer` | `createBuildMcpServer` |
| 存储 | 一局 SQLite | 团本目录 + 检索临时库 |
| roll gate / 明骰 | ✅ | ❌ |
| turn-end hook（choice 物化 + L3） | ✅ | ❌ |
| canon-write notify（WS 广播） | ✅ | ❌（构建写文件、非规范态） |
| systemPrompt | gm-core | dicelore-build-pack |
| 共享 | `WsHub` + 瘦流式 helper（作者也要看 agent 流式产出） | 同左 |

> 共享的"瘦流式 helper"= 从现有 [turnLoop.ts](../../../apps/orchestrator/src/live/turnLoop.ts) 抽出与运行时插件无关的部分（驱动 driver、把 narration / tool 事件经 WsHub 流给前端）。运行时专属的 turn-end（choice 物化 / L3 / pending choice）留在 `SessionHost`。

### 5.3 server 侧：两个创建入口

- `POST /sessions` → 建 `SessionHost`（跑团），现有不动。
- `POST /build-sessions` → 建 `BuildHost`（构建），body 带 `packDir`。
- registry 各自登记对应宿主类型（或两张表）；WS `/sessions/:id/ws` 复用（两类会话都要流式）。

---

## 6. ⑥ Claude Code TUI 入口（裸 CC 路径）

与现有 [init.ts](../../../packages/core/src/adapter/init.ts) 平行，给不走 orchestrator、直接用 Claude Code TUI 造团本的作者：

- `dicelore build-init <pack-dir>`：在 `<pack-dir>` 写 `.claude/`——
  - `.mcp.json` 指向**构建 server**（`build-main.ts` stdio 入口，挂 `BUILD_TOOLS`）；
  - **只**从 `build-skills/` 拷 `dicelore-build-pack`，**不拷** gm-core / flow；
  - 构建期**不需要**运行时三 hook（choice 物化 / rule 召回 / L3 都是跑团概念）。
- CLI 主入口（[cli.ts](../../../packages/core/src/cli.ts)）加 `build-init` 分支。

---

## 7. ② 构建期 MCP 工具清单（typed per content）

走**按内容类型分的细粒度 typed CRUD**：每个工具把格式细节吃进去（skill-creator 的"深模块隐藏复杂度"），而"何时建什么、先建哪块、怎么抽取"的**判断**交给构建 skill（§8）。镜像运行时 L1（工具焊接）/ L2（skill 教判断）的分法。

全部对齐 [MCP工具面 §0](../../wiki/04-子系统设计/MCP工具面.md)：Zod `.strict()`；成功走 `structuredContent`；**错误走 `content[].text` 带 `{code,message,hint}`**（SDK 校验 outputSchema 的坑，§0 实测）；`description` 五段式（功能 / Args / Returns / use-示例 / 错误）。

| 工具（`dicelore_build_` 前缀） | 作用 | 包底层 | readOnly | idempotent |
|---|---|---|---|---|
| `ingest` | 喂源文件/文本、建检索库 | retrieval.ingest | false | false |
| `search` | 按阶段检索原文段 | retrieval.search | ✅ | false（随召回） |
| `set_manifest` | 写/增量改 manifest.yaml | pack.setManifest | false | ✅ |
| `write_world` | 写世界设定/门派散文 doc | pack.writeWorldDoc | false | ✅（同 path 覆盖） |
| `add_npc` | 加 NPC（人设散文 + 可选 sheet 卡） | pack.addNpc | false | ✅ |
| `add_pool` | 加卡池/随机池行 | pack.addPool | false | false（追加行） |
| `set_param_band` | 写分档表 | pack.setParamBand | false | ✅ |
| `set_sheet` | 写开局 sheet 初值 | pack.setSheetCell | false | ✅ |
| `write_rule` | 写机制规则（带 version） | pack.writeRule | false | ✅ |
| `add_front` | 加阵线 + 钟 + 凶兆阶梯 | pack.addFront | false | ✅ |
| `read` | 回读条目（即写即读审阅） | pack.readPack | ✅ | ✅ |
| `validate` | 整包校验 | pack.validatePack | ✅ | ✅ |

`openWorldHint` 全 false（封闭世界，唯一外部读是 `ingest` 读作者给的源文件，仍本机）。

### 7.1 入参 Schema（Zod，骨架）

in schema 即读写层函数 args 的 Zod 化，`.strict()`。出参信封 `{ file, warnings }` 或读取结果。示例：

```ts
const buildAddNpcIn = z.object({
  name: z.string(),
  persona: z.string(),
  visible: z.union([z.literal(0), z.literal(1)]).default(0),
  sheet: z.array(z.object({
    attr: z.string(), value: z.string(),
    visible: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  })).optional(),
}).strict();
const buildAddNpcOut = z.object({
  file: z.string(),
  warnings: z.array(z.object({
    level: z.enum(["error", "warn"]), file: z.string(), msg: z.string(), hint: z.string().optional(),
  })),
});

const buildValidateOut = z.object({
  ok: z.boolean(),
  issues: z.array(z.object({ level: z.enum(["error", "warn"]), file: z.string(), msg: z.string(), hint: z.string().optional() })),
});
```

其余工具同构（in = §3.1 函数 args；out = `WriteResult` 或读/校验结果）。错误 code 枚举沿用并扩展运行时：`CSV_COLUMN`（列不合法）/ `RANGE_INVALID`（分档重叠/不全覆盖）/ `FLOW_NOT_FOUND`（选了不存在的流程 skill）/ `REF_BROKEN`（引用完整性）/ `PATH_INVALID`（路径/编码）/ `ENTITY_MISMATCH`（NPC 散文与 sheet 卡 entity 名不一致）。

---

## 8. ④ 构建 skill `dicelore-build-pack`（渐进式披露）

按 skill-creator 三层：metadata 恒在 / SKILL.md body 触发载 / references 按需。**只编排已有工具调用序，不新增工具、不碰存储**（同流程 skill 纪律）。

### 8.1 description（pushy 触发）

锚定构建语境，写成 pushy 式（skill-creator 反 under-trigger）：

> "Use when turning source material (a novel, fan-content, a setting bible, or pasted lore) into a playable Dicelore campaign pack — extracting world/NPCs/pools/rules, filling a manifest, choosing flow skills. Trigger whenever the user wants to 做/造一个团本, 把设定/小说灌成 dicelore 团本, or build/author a campaign module, even if they don't say 'pack' explicitly."

### 8.2 SKILL.md body（<500 行）：5 阶段编排

承接 [组件5 §4](../../wiki/04-子系统设计/团本构建工具链.md)。每阶段节奏：`检索 → 调读写层产一块 → 审阅修正（对话/read/CLI）→ 确认进下一阶段`，**阶段间可回退**，校验贯穿全程。

0. **建库**：`ingest` 作者给的源材料。
1. **世界观 / 设定**：`search` 设定段 → `write_world` 产设定/门派 doc → 审阅。
2. **NPC**：`search` 人物段 → `add_npc`（人设散文，关键 NPC 加 sheet 卡）→ 审阅。
3. **卡池 / 随机池**：`search` 机缘/物品段 → `add_pool` 填池 → 审阅。
4. **机制规则**：`search` 体系段 → `write_rule` + `set_param_band` 分档 → 审阅。（含 fronts：`add_front` 预置阵线/钟/凶兆，按团本玩法。）
5. **manifest 收口**：据玩法选 `flows`、声明 `clock` / `entry` → `set_manifest` → **`validate` 整包校验**（零 error）→ 交付。

body 只留骨架 + 何时进哪阶段的判断；深表进 references。

### 8.3 references/

- `extract-playbook.md`：各阶段怎么从原文抽取（NPC 人设要素、卡池如何定品级/weight、分档怎么对齐三档结果 PbtA、front 凶兆阶梯怎么设计）。
- `format-cheatsheet.md`：各内容类型字段速查 + worked example（"这段原文 → 调哪个工具 → 给什么参数"）。
- `validation-fixes.md`：校验 error code → 怎么改（如 `RANGE_INVALID` → 补全/调档位区间）。

---

## 9. 测试策略

- **读写层 + 校验器**：纯函数单测（CRUD 正确落列/落目录/写对 frontmatter；校验命中各类 error code）。地板。
- **检索库**：切块 + 召回测试（给定查询命中预期片段）。
- **构建期 MCP**：handler 单测（in schema 校验、错误信封形状、`structuredContent` 成功路径）。
- **BuildHost**：宿主单测（挂对 MCP、不挂 roll gate / turn-end / notify；driverFactory 注入构建 prompt）——**断言隔离不变量**（构建会话里 `TOOLS` 不出现、`BUILD_TOOLS` 出现）。
- **构建 skill**：skill-creator eval-loop（丢一本真实小说端到端，人审产物质量 + `validate` 零 error），with/without baseline。

---

## 10. 本设计**不**负责定的

- 构建期 **Web 门面**（本地 http + 可交互前端 + 校验高亮）→ 后续 slice（读写层已为它备好，门面只是薄包装）。
- 语义向量检索 / 完整版本迁移工具（diff/merge）→ 未来。
- 成品包**落库存储 schema / FTS5 实现 / row_json 求值** → [内层能力库](../../wiki/04-子系统设计/内层能力库.md)（构建侧只产文件、不碰运行时 store）。
- 运行时任何东西（resolver / sheet_update / hook / 输出层）→ 现有运行时设计不动。
```
