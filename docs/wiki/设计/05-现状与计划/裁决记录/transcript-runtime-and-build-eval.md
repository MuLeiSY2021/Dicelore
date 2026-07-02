# 裁决：transcript-runtime-and-build-eval —— 会话对话记录抽进 runtime（transcript 铸 UUID 权威 + rewind 注册器）+ build 侧 eval skill

- [ ] 用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 路线图项：里程碑一「团本构建链路 eval」新增需求。
> 来源：用户 2026-07-02——「agent 测试团本构建链路完整可用；要一份『作者说了什么→loregm 干了什么』的对话记录，既是回退入点又是评估 loregm 行为的入口；对话记录要和 dicegm 侧一致（jsonl）；落对话记录与退回是两侧一致的运行时逻辑、抽进 `harness/src/runtime`，只差工作目录；rewind 加 Register 构造器让 Rollback hook 进来实现兼容；db 侧基于 UUID 的回退要全局唯一、以 transcript 生成为准；把这个链路沉淀成一个 skill；dicelore-eval 改名避免误导。」
> 依赖：**[install-datadir-layout](install-datadir-layout.md)（已批准 2026-07-02）**——数据根 `$ROOT` 与会话路径单源 `sessionDir → $ROOT/sessions/<kind>/<id>`、config.toml `[env]`、`DICELORE_DATA_DIR`（废 `DICELORE_SESSIONS_DIR`）。本裁决 §1 transcript 落点、§5 前置、§7 eval `$` 均**从它派生**。内部有序 §1→§2→§3/§4→§5、§7（见「DAG 分解提示」）。

---

## 背景与目标（为什么）

build 侧 eval 要成立，得有一份**可监控、可回退的对话记录**：作者（CC）说了什么 → 构建 GM（loregm）干了什么。dicegm 侧早有这个——`DiceGm` 在会话目录落一份 `<id>_session.jsonl`（CC-transcript 风格：`turn` 头=玩家输入、`msg`=SDK 每条 tool_use/tool_result/result、`turn_end`/`error`）。会话目录路径由 install-datadir-layout 统一为 `$ROOT/sessions/<kind>/<id>`。**但 loregm 侧现在不落**：`LoreSession.handleMessage` 建 driver 时只传 `{mcpServer, openingPrompt, plugin, workspace}`，没穿 `sessionId`/`sessionsDir`，适配器 `sessionDir` 为空、退化全局 logger。

「落对话记录」和「退回」本质是**会话运行时关切、两侧一致、只差工作目录**（`dice/` vs `lore/`），却现在焊死在 `DiceGm`（对话记录写入）和 `backend/store`（退回）里。本裁决：

1. 把 jsonl 写入抽进 `harness/src/runtime`，两侧共用、参数化会话目录；**transcript 成为 UUID 唯一生成源**，并做成 **append-only 树 + HEAD 指针**（回退/分叉的真载体）。
2. rewind 做成 **IoC 注册器**（仿 `backend/store/snapshot.ts` 的 `SnapshotParticipant`）：`rewindTo(U)` **真的把 transcript 的 HEAD 移回 U**（`.jsonl` 回退落地）+ 广播领域 rollback hook 还原领域态。**db 侧退回锚到 transcript 铸的 UUID**（不再自成一套 seq/id 身份）。
3. loregm 由此开始落 jsonl。
4. 沉淀成 **`build-eval` skill**：用真实案例 md 驱动 loregm 建团本、读该 jsonl + Draft 检视面评估构建行为与团本质量。
5. `dicelore-eval` 改名 `play-eval`（配成对 play/build，避免误导别的 agent）。

**非目标**：不重写 dice 现有 seq-based 快照/restore（只 additive 加 UUID 锚点路径）；**transcript 层的 append-only 树 + HEAD 指针回退/分叉本裁决真实现**，但**不做**回退/切分支的**前端元动作 UI**、也不做 swipe（同父多子切换 UI）——那些留后续；不做格式转换能力。

---

## §1 runtime `transcript.ts`：抽出 jsonl 写入 + 铸 UUID（transcript = 唯一权威）

新增 `harness/src/runtime/transcript.ts`，把 `DiceGm` 的 `appendConversation`/`conversationPath`/`logMsg` 里落 jsonl 那部分抽出来：

```ts
export type SessionKind = "dice" | "lore";

// 会话目录路径单源（install-datadir-layout §2）：$ROOT/sessions/<kind>/<id>。
// 放 harness/runtime（transcript 邻居、backend-free），backend 组合根按需 import（互指仅组合根，架构页已许）。
export function sessionDir(dataDir: string, kind: SessionKind, sessionId: string): string; // = join(dataDir,"sessions",kind,sessionId)

export interface TranscriptInit {
  sessionDir: string;    // 已解析的会话目录（调用方经上面的 sessionDir() 算好传入；transcript 不自 import backend、不自拼数据根）
  sessionId: string;
}

// 会话对话记录：append-only 的 UUID 父子链**树**（回退/分叉的底座）；HEAD 指针指当前活动叶。
export class SessionTranscript {
  constructor(init: TranscriptInit);   // 打开已有会话则从 <sessionDir>/HEAD 恢复 head（缺则回落=末行 uuid，线性续）
  /** 落盘绝对路径：<sessionDir>/<sessionId>_session.jsonl（append-only，含所有分支） */
  readonly path: string;
  /** 当前活动叶 uuid（git HEAD 式），持久在 <sessionDir>/HEAD；空会话为 null。 */
  head(): string | null;
  // —— 追加类：parentUuid = 当前 head；写行后 head:=新 uuid 并落 HEAD（从 head 处生长/分叉） ——
  /** 回合头（作者/玩家输入）。返回本行 uuid。 */
  turn(header: { turnId: string; sessionId: string | null; model: string; input: string; plugin: string | null; ts: string }): string;
  /** 一条 SDK 消息。 */
  msg(idx: number, body: Record<string, unknown>): void;
  /** 回合末锚点。返回 uuid——**即 checkpoint 的 transcript_anchor**。 */
  turnEnd(turnId: string): string;
  /** 领域级/阶段错误行。 */
  error(obj: Record<string, unknown>): void;
  // —— 回退/分叉（.jsonl rewind 的真实现，供 §2 Rewind 调） ——
  /** uuid 是否在树里（扫 jsonl 的 uuid 集合）。 */
  hasNode(uuid: string): boolean;
  /** 把 HEAD 移到 uuid（校验 ∈树）并落盘。之后 append 即从此 uuid 分叉出新支。 */
  moveHead(uuid: string): void;
  /** 从 head 沿 parentUuid 走到根、正序返回**当前活动分支**的行（= 现历史所见；废弃分支不在内）。 */
  livePath(): Record<string, unknown>[];
}
```

**决策（拍定）：**
- **UUID 生成源唯一 = SessionTranscript**：每行 `crypto.randomUUID()` 铸全局唯一 `uuid`，带 `parentUuid = 当前 HEAD`（**不是"上一落盘行"**——回退后 HEAD 变，下一行就从 HEAD 分叉；空会话首行 parentUuid=null）。全项目**只有这里**铸这套 UUID。
- **HEAD 指针（git 式，回退底座）**：`<sessionDir>/HEAD` 一行存当前活动叶 uuid；每次 append 后 + `moveHead` 后都更新它。reopen 从 HEAD 恢复；HEAD 缺失/损坏则回落 = 末行 uuid（线性续，fail-soft）。
- **jsonl 是 append-only 树**：所有行（**含被回退废弃的分支**）永不删；「当前活动历史」由 `livePath()`（HEAD→根沿 parentUuid 走、反转）给出。废弃分支留在文件里作历史/审计（这正是"回退可再前进出新分支"的载体）。
- **行形状 = 现有字段 + 两个新字段**：现有 `{_:"turn",...}` / `{_:"msg",...}` **原字段不动**，每行前置 `uuid`/`parentUuid`。dice 侧 jsonl 是「加字段」非破坏——现有消费者按字段名读、不受影响。
- **路径 = 会话目录单源 + 文件名**：`path = join(sessionDir(dataDir,kind,id), \`${id}_session.jsonl\`)`。`sessionDir` 是 install-datadir-layout §2 统一的会话路径单源（`$ROOT/sessions/<kind>/<id>`）——**transcript 不自拼数据根、不 import backend**，收调用方算好的 `sessionDir`。dice/lore 只差传入的 `kind`。
- **写失败 fail-soft**：沿用现有 `try/catch + getLogger().error`（对话记录是可观测性、不是业务主路径，写不动不炸回合）。
- `mkdirSync(recursive)` 幂等建目录沿用现逻辑。

`DiceGm` 改造：删掉自己的 `appendConversation`/`conversationPath`/路径逻辑，改**持有一个 `SessionTranscript`**（`kind:"dice"`），`logMsg`/回合头/turn_end 改调它。**dice 侧行为等价**（除多出 uuid/parentUuid 字段）。

---

## §2 runtime `rewind.ts`：Rewind + RollbackHook 注册器（真回退 `.jsonl` 树 + 领域 hook）

新增 `harness/src/runtime/rewind.ts`，仿 `snapshot.ts` 的 `SnapshotParticipant` IoC 套路：

```ts
export interface RewindAnchor { uuid: string }   // = transcript 某回合末行的 uuid

// 领域侧把「怎么把自己的态还原到某锚点」注册进来。runtime 不 import 任何 backend。
export interface RollbackHook {
  readonly name: string;                          // 稳定键："dice-db" / "lore-draft"
  rollbackTo(anchor: RewindAnchor): void;         // 领域侧实现：找到锚点对应快照并还原
}

export class Rewind {
  constructor(transcript: SessionTranscript);
  register(hook: RollbackHook): void;             // ← 用户要的 Register 构造器：把 Rollback hook 进来
  /** 真回退：校验 uuid∈树 → 先逐 hook rollbackTo（领域态还原）→ 成功后 transcript.moveHead(uuid)
   *  （.jsonl 活动叶移回 uuid，下一轮 append 从此分叉）。这一步之前缺，是「.jsonl 回退没真实现」的根。 */
  rewindTo(uuid: string): void;
  /** 便捷：回退到「上一个回合末锚点」（现 dice /rewind 语义）。空则返回 undefined。 */
  rewindLast(): RewindAnchor | undefined;
}
```

**决策（拍定）：**
- **runtime 保持 backend-free**：`Rewind`/`RollbackHook` 不 import `backend/store`；领域态还原由**注册进来的 hook** 干（dice→db 快照、lore→Draft）。runtime 通用，两侧靠注册接入。
- **rewindTo 真的动 transcript（关键补正）**：`rewindTo(U)` = ① `transcript.hasNode(U)` 校验存在 → ② 按注册序逐 hook `rollbackTo({uuid:U})`（还原领域态）→ ③ 全部成功后 `transcript.moveHead(U)`（.jsonl 活动叶回到 U）。顺序讲究：**领域还原失败则不移 HEAD、抛错**，避免 transcript 与领域态错位。之后下一轮 append 的 `parentUuid=U`，自然长出新分支——这就是"回退 + 重生成"，此前只做①②漏了③。
- **rewindLast** = 取 transcript 上「HEAD 之前最近的 `turn_end` 锚」的 uuid，调 `rewindTo` 走它。
- 多 hook 按注册序 `rollbackTo`；跨 hook 原子性 best-effort（v1 每侧实际只注册一个 hook，跨 hook 原子留待有真需求，记 backlog）。

---

## §3 backend dice hook：snapshot 加 transcript_anchor + 包成 RollbackHook（additive）

现状：`checkpoint(db,{turnSeq})` 每回合末落一行 snapshot（`parent_id`=上一份、`turn_start/end_seq`=turnSeq、`blob_json`），`restore(db,snapshotId)` 整表覆写，`host.rewind()` 撤上一轮、`/sessions/:id/rewind` 202 `{snapshotId}`。**全部保留**，只做加法：

**决策（拍定）：**
1. **snapshot 表加一列** `transcript_anchor TEXT`（`db.ts` 的 `CREATE TABLE snapshot`）：记该 checkpoint 对应的 transcript 回合末 uuid。旧行 NULL（兼容）。
2. **checkpoint 收一个可选锚**：`CheckpointOpts` 加 `anchorUuid?: string`，INSERT 时写入 `transcript_anchor`。调用点（`turnEnd` 收尾，`index.ts:73` 所述）先从 `SessionTranscript.turnEnd()` 拿到本回合末 uuid，再传给 checkpoint——**权威方向：transcript 先铸、db 后锚**。
3. **新增按 uuid 定位的还原**：`snapshot.ts` 加 `restoreToAnchor(db, uuid)`：`SELECT id FROM snapshot WHERE transcript_anchor=?` → 复用现有 `restore(db,id)`。找不到抛 `no_snapshot_for_anchor`。
4. **dice RollbackHook**：在组合根（`sessionBackend.ts`/`index.ts`，与现 `registerSnapshotParticipant` 同处）把 `{ name:"dice-db", rollbackTo:({uuid})=>restoreToAnchor(db,uuid) }` 注册进该会话的 `Rewind`。
5. **`/rewind` 端点 additive 扩展**：可选 body `{ toUuid?: string }`。带 `toUuid` → 走 `rewind.rewindTo(toUuid)`（UUID 驱动）；不带 → 现有 `host.rewind()`（撤上一轮）**保持不变**、向后兼容。
6. **DiceSession/turnLoop 接线**：turn_end 时把 `SessionTranscript.turnEnd()` 返回的 uuid 作 `anchorUuid` 喂给 checkpoint。DiceGm 现已持 `SessionTranscript`（§1），uuid 由它出。

> 这样 snapshot 树**继承 transcript 树的形状**（audit `adapter与L3审计.md` 描述的设计落地）：anchor 唯一来源是 transcript UUID，db 不再自造身份。seq 区间字段保留（v2 branch 锚点用）。

---

## §4 lore 侧接线：LoreSession 穿 sessionId/sessionsDir → loregm 落 jsonl（+ Draft rollback hook）

**决策（拍定）：**
1. **`LoreSessionDeps` 加 `dataDir?: string`**（`backend/api/lore.ts` 从组合根拿已解析的 `$ROOT`，透传；install-datadir-layout 后 `$ROOT` 是唯一数据根，`sessionsDir` 概念并入）。
2. **`LoreSession.handleMessage` 建 driver 时补传 `sessionId: this.sessionId` + `dataDir`**（现只传 4 项）。适配器据 `sessionDir(dataDir,"lore",id)` 建 `SessionTranscript`，loregm 开始落 `$ROOT/sessions/lore/<id>/<id>_session.jsonl`。
   - `turnId` 沿用现有 `nextTurnId`（`<sid>-l<n>`）；`input`=作者指令 text；`model`=构建模型。
   - REST-only 不变：`handleMessage` 仍只返 `{turnId, error?}`，jsonl 是带外落盘（可观测性），不进 REST 返回。
3. **适配器算会话目录**：`AgentInit` 加可选 `kind?: SessionKind`（默认 `"dice"` 保兼容）；`sessionsDir` 字段随 install-datadir-layout 语义改为 `$ROOT`（数据根）。DiceGm 适配器据 `sessionDir(init.sessionsDir, init.kind, init.sessionId)` 算出会话目录、传给 `SessionTranscript`。（DiceGm 是共用 CC SDK 适配器，dice/lore 都用它——`kind` 决定 `sessions/<kind>/` 子目录。）
4. **lore Draft rollback hook（v1 最小实现）**：**注意分两层**——(a) **transcript 层回退对 lore 一样真生效**（`moveHead`/`livePath` 领域无关，lore 会话的 `.jsonl` 照样能回退+分叉）；(b) 仅 lore 的**领域态**（in-memory Draft，组合根 `loreReg` 持有）还原是 v1 占位：注册 `{ name:"lore-draft", rollbackTo }`，其 `rollbackTo` **记 warn 并 no-op**（Draft 无 per-turn 快照，真 Draft 还原需另设计），把「lore Draft 按轮快照/回退」记进 [backlog-后端]。**机制在位**（hook 已注册、rewindTo 会调它），Draft 真还原后续单独做。

> 判据：build-eval skill **只依赖 loregm 落 jsonl 对话记录**（§4.1–§4.3），不依赖 lore Draft 真回退（§4.4 占位即可）。故 §4.4 是可逆占位、不阻塞 eval。

---

## §5 `build-eval` skill：用真实案例 md 驱动 loregm 建团本 + 评估

新增 `.claude/skills/build-eval/SKILL.md`（build 侧，`play-eval` 的孪生）。**定「怎么 eval 构建链路」，不解释构建教条本身**（教条在 `dicelore-build-core`/`dicelore-build-pack`）。

**决策（拍定）：**

- **输入 = 一份真实案例 md**（`docs/research/scraped/*.md`；后续 DnD pdf 同法）。它**双重身份**：既是喂给 loregm 的**源素材**（经 `put_material` 上传），又是评判团本质量的**黄金参照**（对称 play-eval 的「对照系=真实案例语料（唯一）」）。
- **前置**：走 §7 的前置 skill 起后端——`install.sh` 铺 eval 数据根 `.dicelore-eval`（= `$ROOT`），`run.sh -f` 起真 LoreGm（`config.toml [env]` 里 `DICELORE_FAKE_GM=0`，`DICELORE_DATA_DIR=.dicelore-eval`）；`.mcp.json` 的 build-mcp 指同一 `$ROOT`（server 名 `dicelore-build`，工具 `mcp__dicelore-build__*`）。
- **跑一局构建（CC 当作者）**：
  1. `open_build_session` 起 sid。
  2. `put_material(sid, filename, localPath=<md 绝对路径>)` 流式上传源（大源不入 LLM 上下文）。
  3. **多轮对话**驱动 loregm 走 `dicelore-build-pack` 阶段（摸源→manifest→prologue→world→npc→cards→rules→fronts→state→validate→commit）：每轮 `send_to_builder(sid,name,text)` 发作者自然语言指令；**因 REST-only 不回散文，每轮后 `get_draft(sid)` 检视本轮 Draft 增量**判断 loregm 干了什么、进度如何。
  4. 收口：驱动 loregm `validate` + `commit`，`list_catalog`/`get_pack_files` 看已 commit 团本。
- **对话记录 = loregm 的 `<id>_session.jsonl`**（§1–§4 产出）：这是「作者说了什么（`_:"turn"`.input）→ loregm 干了什么（`_:"msg"` 的 tool_use/tool_result/result）」的权威记录。**skill 读它评估构建行为**（比 get_draft 增量更全：能看到 loregm 每步工具调用、摸源清洗过程、有没有凭空编造）。
- **评估两维**（对照 md 黄金参照，定性、不量化）：

  | 维度 | 抓什么信号（jsonl + Draft/pack） | 违规长啥样 |
  |---|---|---|
  | **A 构建行为**（对 `dicelore-build-core` 教条） | jsonl 里：先 Read/Grep/Bash 摸源再落笔？只声明（`dicelore_build_*`）不跑团（无 `resolve_*`/`narrate`）？一次一件、`validate` 收口？ | 没摸源就编；调了运行时裁决工具；跳过 validate 直接 commit |
  | **B 团本质量**（对源案例 md） | pack 有 manifest/prologue/world/npc/cards/rules/state 吗、开得起局吗？忠于 md 的门派/NPC/机制/威胁线吗？ | 缺 prologue/manifest 开不了局；捏造原著没有的设定；丢了 md 的核心桥段/机制 |

- **写报告（定性）**：落 `docs/reports/<YYYY-MM-DD>-build-<团本名>.md`（对齐 play-eval 报告约定）。含：对象（md 源 + sid + commit）、逐维裁决（证据挂 jsonl 行 uuid / Draft 片段 + vs 源案例差距）、整体（相比源案例哪到位/哪差）、`build_core_fix_hints`（可泛化的教条措辞建议）、findings 分流（A 措辞类当轮改 / B 架构类记 findings 路由设计）。
- **纪律**：对照真实案例、非凭空；玩家所见口径不适用（这是构建侧，判据是「团本可玩性 + 忠于素材」）；量化不可行→定性；别过拟合单个 md。

**skill description（触发词）**：跑 build eval、评估团本构建链路、看 loregm 构建得好不好、用真实案例 md 测团本构建、build-mcp eval——「用这个 md 测下团本构建」「构建 GM 造得怎么样」也触发；别手动一步步调 HTTP。

---

## §6 `dicelore-eval` → `play-eval` 改名

**决策（拍定）：**
- 目录 `.claude/skills/dicelore-eval/` → `.claude/skills/play-eval/`（`git mv`）；`SKILL.md` frontmatter `name: dicelore-eval` → `play-eval`，正文自指同步。
- 更新引用（共 5 处，grep `dicelore-eval` 全改）：`docs/audits/2026-06-25-全量体检/05-回溯-测试.md`、`docs/wiki/设计/05-现状与计划/backlog-core.md`、`docs/wiki/设计/04-子系统设计/Skills-eval.md`、`docs/reports/README.md`（+ 本裁决自身随交付更新）。
- `.mcp.json` 的 MCP server 名（`dicelore-play`/`dicelore-build`）**不改**（本就是 play/build 语义，不叫 dicelore-eval）。
- **不改 MCP 工具名 / 后端端点**（改名只涉 skill 层命名）。

---

## §7 eval 安装/启动脚本 + 两 eval 共用前置 skill（派生自 install-datadir-layout）

eval 的 `$` **就是 [install-datadir-layout](install-datadir-layout.md) 的 `$ROOT` 的一个 dev 实例**（默认 `.dicelore-eval`）：根下 `run.sh`+`config.toml`（不变的），`sessions/{dice,lore}`/`catalog.db`/`keys.db`/`logs/`（数据）。源码=仓库、不进 `$`。

**决策（拍定）：**
- **`install.sh`**（仓库根执行）：`bash install.sh [-d|--dir <安装目录>]`（默认 `.dicelore-eval`）。职责 = 铺一个 `$ROOT` 实例：
  - 建 `$ROOT` + 从 `config.example.toml` 拷出 `$ROOT/config.toml`（`[env]` 预置 `DICELORE_FAKE_GM = "0"`、`DICELORE_GM_MODEL`）+ 生成 `$ROOT/run.sh`（把 `git rev-parse --show-toplevel` 的仓库根路径**烙进去**）。
  - 把 `$ROOT` 加进 `.gitignore`（纯本地运行态）。
  - **不拷源码、不 npm install**（依赖复用仓库 `node_modules`）。**幂等**（重复跑不炸、不覆盖已有 `config.toml`）。
- **`run.sh`**（`cd $ROOT` 后执行）：`bash run.sh [-f|--force] [-p|--port <port>]`。
  - 起 `npx tsx <repo>/backend/src/server.ts`，`DICELORE_DATA_DIR=$PWD`（= `$ROOT`）；端口默认 8787（`config.toml [env] PORT` 或 `-p` 覆盖）。
  - `-f`：先强杀占用目标端口的进程（`lsof -ti:<port> | xargs -r kill`）再起；`-p`：换端口。
  - 起后轮询 `GET /diagnostics` 到 200 判就绪。
- **前置 skill（两 eval 共用）** `.claude/skills/eval-backend-setup/`：教 CC「eval 前怎么把测试后端跑起来」——
  - 教条：eval 前先在**仓库根** `bash install.sh` → `cd .dicelore-eval` → `bash run.sh -f` → 确认后端就绪 → 再开跑 play-eval / build-eval。
  - 说明 `.dicelore-eval` = 默认 eval 数据根；对话记录落 `$ROOT/sessions/<kind>/<id>/<id>_session.jsonl`；`.mcp.json` 的 MCP 指同一 `$ROOT`。
  - **play-eval / build-eval 的「前置：起后端」段改为引用本前置 skill**（不各自重述起后端步骤，单源）。
- **`.mcp.json`**：play-mcp/build-mcp 的 env `DICELORE_SESSIONS_DIR` → `DICELORE_DATA_DIR`（指 `.dicelore-eval`，与后端同 `$ROOT`）。

> 模板文件（`run.sh` 生成模板）落 `harness/eval-setup/run.sh.tmpl`；`install.sh` 落仓库根（贴合「仓库根执行」）。

---

## 验收（分节，交付 agent 逐节自验）

- **§1**：`transcript.ts` 单测——`turn/msg/turnEnd` 落对应行、uuid 全局唯一且 parentUuid 链成链、路径按 kind 拼对；DiceGm 改造后跑现有 dice 测试绿，jsonl 除多出 uuid/parentUuid 外字段不变。
- **§2**：`transcript` 回退单测——append 后 HEAD 前进 + 落 `<sessionDir>/HEAD`；`moveHead(U)` 后再 `turn()`，新行 `parentUuid==U`（**真分叉**，非线性续尾）；`livePath()` 只含活动分支、不含被回退废弃的行；reopen 从 HEAD 恢复、HEAD 缺失回落末行。`rewind` 单测——`register` 后 `rewindTo(U)` 先调 hook 再 `moveHead`；hook 抛错则 HEAD **不动**并上抛（不错位）；`rewindTo` 未知 uuid 抛错；`rewindLast` 取最近回合末锚。
- **§3**：snapshot 单测——`transcript_anchor` 列写入/查询；`restoreToAnchor` 按 uuid 还原到对应态；`/rewind` 带/不带 `toUuid` 两条路径；旧行为（撤上一轮）回归绿。
- **§4**：lore 集成——跑一轮 loregm 后 `<sessionsDir>/lore/sessions/<id>/<id>_session.jsonl` 出现非空、含 `turn`(作者 text)+`msg`(tool_use/tool_result/result)；`handleMessage` 仍返 `{turnId,error?}`。lore-draft hook 注册在位（rollbackTo no-op+warn 有单测）。
- **§5**：skill 撰写用 `/skill-creator`；**手动门**（`RUN_LIVE`/dogfood、烧 LLM）：真起后端+build-mcp，用一个 `docs/research/scraped/*.md` 跑完整构建对话 → jsonl 落盘 → 出一份 report。Workflow agent 只跑 skill 文档自查 + 相关 typecheck/test；live 部分主 agent 收尾标「待手动验证」。
- **§6**：`grep -r dicelore-eval` 无残留（除历史归档）；skill 目录改名后可被 Skill 工具触发。
- **§7**：`install.sh -d .dicelore-eval` 幂等铺出 `$ROOT`（含 run.sh/config.toml，`.gitignore` 收录，不拷源码）；`cd .dicelore-eval && bash run.sh -f` 起后端、`GET /diagnostics` 200；`-p` 换端口生效、`-f` 强杀占端口进程；前置 skill 可被 Skill 触发。**手动门**（起真后端、烧 LLM）随 §5 dogfood 一并跑。
- 全程：`typecheck:all` + `test:all` 绿；`--no-pager`；不 push。

---

## owns（预期触及，非独占）

- §1/§2：`harness/src/runtime/transcript.ts`(新)、`harness/src/runtime/rewind.ts`(新)、`harness/src/dicegm/DiceGm.ts`(改)、`harness/src/runtime/agent.ts`(加 `kind`)。
- §3：`backend/src/store/db.ts`(snapshot 加列)、`backend/src/store/snapshot.ts`(anchorUuid+restoreToAnchor)、`backend/src/sessionBackend.ts`/`backend/src/index.ts`(注册 dice hook)、`backend/src/api/dice.ts`(/rewind toUuid)、`backend/src/dicegm` turnEnd 接线。
- §4：`harness/src/loregm/LoreSession.ts`、`backend/src/api/lore.ts`。
- §5：`.claude/skills/build-eval/SKILL.md`(新)、`docs/reports/`。
- §6：`.claude/skills/play-eval/`(mv)、上列 5 处 doc。
- §7：`install.sh`(新·仓库根)、`harness/eval-setup/run.sh.tmpl`(新)、`.claude/skills/eval-backend-setup/SKILL.md`(新)、`.mcp.json`(env 名切 DATA_DIR)、`.gitignore`(收 `.dicelore-eval`)。

---

## DAG 分解提示（进波时炸成原子需求节点，别 1 裁决=1 节点）

- **N1 transcript-runtime**（§1）：抽 `transcript.ts` + 铸 UUID + **append-only 树/HEAD 指针/moveHead/livePath** + DiceGm 改造。**无依赖，先行**。
- **N2 rewind-register**（§2）：`rewind.ts` Rewind+RollbackHook + **rewindTo 真移 HEAD（.jsonl 回退落地）**。依赖 N1（transcript 的 moveHead/hasNode）。
- **N3 dice-anchor**（§3）：snapshot transcript_anchor + restoreToAnchor + dice hook + /rewind。依赖 N1（uuid 源）、N2（注册器）。
- **N4 lore-jsonl**（§4）：LoreSession 穿参 + loregm 落 jsonl + lore-draft hook 占位。依赖 N1（transcript）、N2（注册器）。
- **N5 build-eval-skill**（§5）：skill 撰写。依赖 N4（loregm 落 jsonl 才有对话记录可读）。
- **N6 rename**（§6）：`dicelore-eval`→`play-eval`。**无依赖，可与任意波并行**（纯改名，正则+git mv+测试兜底）。
- **N7 eval-setup**（§7）：`install.sh`/`run.sh.tmpl` + `eval-backend-setup` 前置 skill + `.mcp.json`/`.gitignore`。依赖 install-datadir-layout 的 N1/N3（数据根 + 组合根读 `DICELORE_DATA_DIR`）先合；与 N5 一起构成 build-eval 可跑的前置。

> N1 是全簇地基（transcript 是 UUID 唯一源）；N3/N4 并行（都只依赖 N1+N2）；N5 收尾依赖 N4；N7 依赖 install-datadir-layout 交付；N6 独立。**跨裁决序**：install-datadir-layout（数据根）须先落，本簇 §1/§4/§7 才有 `$ROOT/sessions/<kind>/<id>` 与 `DICELORE_DATA_DIR` 可依。

---

## 完成后（最终收尾阶段沉淀，非每波）

- 沉淀进 [`04-子系统设计/Skills-eval.md`](../../04-子系统设计/Skills-eval.md)（build-eval 与 play-eval 成对、构建侧 eval 口径）+ 新增/更新会话对话记录与 rewind 的子系统设计页（transcript 作 UUID 权威、rewind IoC 注册器、两侧共用）。
- 决策沉进对应设计页「决策与权衡」节（transcript 铸 UUID 权威、db 锚过去、rewind 注册器兼容层）+ `设计/决策变更日志.md`。
- 关 backlog（新增：lore Draft 按轮回退、跨 hook rollback 原子性 两条 follow-up）；勾路线图；现状 🚧→✅。
- 确认设计结论已进 wiki → 删本裁决文件。
