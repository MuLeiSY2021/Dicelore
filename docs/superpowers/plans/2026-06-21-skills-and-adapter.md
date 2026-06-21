# 组件3 Skills 包 + 组件4 adapter/输出层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把组件3(Skills v1 草稿)+组件4(adapter init/三 hook + 输出层呈现模型生成器)落进 `@dicelore/core`,拿到一个可跑的 Claude Code GM harness。

**Architecture:** 全并入 `@dicelore/core` 单包。读侧呈现模型生成器与 L3/hook 逻辑都做成**可单测纯 `.ts` 模块**;hook 入口为包内极薄 `.ts`(`node --import tsx` 运行,不拷进项目),`dicelore init` 写 `.claude/settings.json`(绝对路径指向包内 hook)+ `CLAUDE.md` 指针 + 拷 Skills markdown。快照接线、玩家渲染壳、eval-loop 出本期。

**Tech Stack:** TypeScript(ESM)、better-sqlite3、vitest、tsx、@modelcontextprotocol/sdk(已注册)。无构建步骤(tsx 直跑)。

> **实现期修正(2026-06-21,真实 CC harness 核实)**:Task 3/8 的 `settingsJson` 原产 `{mcpServers, hooks}`、init 把 MCP 写进 `.claude/settings.json`——**CC 不从 settings.json 读 mcpServers**(项目级 MCP 只认项目根 `.mcp.json`)。已改:`templates.ts` 拆出 `mcpJson({session})`(`type:"stdio"` + npx dicelore mcp + env),`settingsJson({hooksDir})` 只产 hooks;`init.ts` 额外写项目根 `.mcp.json`。测试相应更新(下方 Task 3/8 代码块为修正前的历史快照,以 spec 的「实现期修正」节 + 仓库现状为准)。

## Global Constraints

- 所有新代码落 `packages/core/`;`src/…` = `packages/core/src/…`,`skills/…` = `packages/core/skills/…`。命令在 `packages/core/` 下跑,或经 root 委托(`npm test`/`npm run dicelore`)。
- Node ≥ 20、ESM(`"type":"module"`)。源内相对 import **必须带 `.js` 后缀**(如 `./db.js`),即便文件是 `.ts`(现有约定)。
- 测试用 vitest;内存库 `openDb(":memory:")` + `initSchema(db)`(见现有 `store/*.test.ts` 风格)。
- 跨端铁律:hook 不用 bash;`settings.json` 用 exec form(`command:"node"`);路径用 Node 平台 API,不写死 POSIX;不踩 Windows `.cmd` shim(故不用 `npx` 当 command)。
- 内层不 import `adapter/`/`present/`;依赖单向向下。
- 提交频繁,每 Task 末提交;commit message 末尾加 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- **不做(留 TODO 钩子/别线)**:快照 `checkpoint()`/`restore()` 接线(注释占位)、玩家渲染壳、eval-loop、manifest 选 skill、L3 语义裁判 subagent、narrate 降级。

**可复用的已有内层能力(勿重造)**:`store/choice.ts`→`materializePendingChoice`/`getPendingChoice`;`store/rule.ts`→`ruleSearch(db,query,limit)`;`store/event.ts`→`eventAppend`/`eventSince(db,sinceSeq)`/`EventRow`/`EventKind`;`store/sheet.ts`→`sheetList(db,prefix)`/`Cell`;`store/db.ts`→`openDb`/`initSchema`/`DB`;`session/resolve.ts`→`openSession`/`metaGet`/`metaSet`/`sessionDbPath`。

---

## 波 1(可并发):呈现模型生成器 / Skills 草稿 / init 脚手架

### Task 1: 呈现模型生成器(`src/present/model.ts`)

**Files:**
- Create: `packages/core/src/present/model.ts`
- Test: `packages/core/src/present/model.test.ts`

**Interfaces:**
- Consumes: `store/db.ts`→`DB`;直接 SQL 读 `sheet`/`event` 表。
- Produces:
  ```ts
  interface EchoEntry   { seq: number; kind: "verdict" | "mutation" | "watcher_fired"; text: string }
  interface VisibleCell { entity: string; attr: string; value: string }
  interface ChoiceView  { prompt: string; options: { label: string; consequence: string }[]; seq: number }
  interface PresentationModel { mechanicalEcho: EchoEntry[]; statusMenu: VisibleCell[]; pendingChoice?: ChoiceView }
  function buildPresentationModel(db: DB, opts?: { turnStartSeq?: number }): PresentationModel
  ```

- [ ] **Step 1: 写失败测试**

```ts
// packages/core/src/present/model.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../store/db.js";
import { eventAppend } from "../store/event.js";
import { sheetSetRaw } from "../store/sheet.js";
import { sheetShow } from "../store/visibility.js";
import { stagePendingChoice, materializePendingChoice } from "../store/choice.js";
import { buildPresentationModel } from "./model.js";

function freshDb() {
  const db = openDb(":memory:");
  initSchema(db);
  return db;
}

describe("buildPresentationModel", () => {
  it("statusMenu 只含可见 cell:visible=1 或 __show_all 且 visible≠2", () => {
    const db = freshDb();
    sheetSetRaw(db, "张三", "HP", "30");          // 默认 visible=0,隐
    sheetSetRaw(db, "张三", "金币", "100", 1);     // 显式可见
    sheetSetRaw(db, "李四", "AC", "15");          // 隐
    sheetSetRaw(db, "李四", "暗值", "9", 2);       // 强制隐
    sheetShow(db, "李四");                        // __show_all → 暴露 李四 非暗值 cell
    const m = buildPresentationModel(db);
    const keys = m.statusMenu.map((c) => `${c.entity}.${c.attr}`).sort();
    expect(keys).toEqual(["张三.金币", "李四.AC"]); // 张三.HP 隐;李四.暗值(visible=2)不露;__show_all 标记本身不列
  });

  it("mechanicalEcho 取本轮 verdict/mutation/watcher_fired(按 turnStartSeq 圈区间)", () => {
    const db = freshDb();
    eventAppend(db, { kind: "narrate", content: "旧轮" });        // seq1,非机械类
    const cut = (db.prepare("SELECT MAX(seq) s FROM event").get() as { s: number }).s;
    eventAppend(db, { kind: "verdict", content: "命中", data_json: { winner: "a" } }); // seq2
    eventAppend(db, { kind: "narrate", content: "色彩" });        // seq3,不进 echo
    eventAppend(db, { kind: "mutation", content: "金钱 +3d100=74 → 77" }); // seq4
    const m = buildPresentationModel(db, { turnStartSeq: cut });
    expect(m.mechanicalEcho.map((e) => e.kind)).toEqual(["verdict", "mutation"]);
    expect(m.mechanicalEcho[1].text).toBe("金钱 +3d100=74 → 77");
  });

  it("pendingChoice 取最新 kind=choice 的 prompt+options", () => {
    const db = freshDb();
    stagePendingChoice(db, "怎么走?", [
      { label: "进", consequence: "遇敌" },
      { label: "退", consequence: "失机" },
    ]);
    const seq = materializePendingChoice(db)!;
    const m = buildPresentationModel(db);
    expect(m.pendingChoice?.prompt).toBe("怎么走?");
    expect(m.pendingChoice?.options).toHaveLength(2);
    expect(m.pendingChoice?.seq).toBe(seq);
  });

  it("无 choice event → pendingChoice 为 undefined", () => {
    const db = freshDb();
    expect(buildPresentationModel(db).pendingChoice).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/core && npx vitest run src/present/model.test.ts`
Expected: FAIL — `buildPresentationModel` 未定义 / 模块不存在。

- [ ] **Step 3: 写最小实现**

```ts
// packages/core/src/present/model.ts
import type { DB } from "../store/db.js";

export interface EchoEntry { seq: number; kind: "verdict" | "mutation" | "watcher_fired"; text: string }
export interface VisibleCell { entity: string; attr: string; value: string }
export interface ChoiceView { prompt: string; options: { label: string; consequence: string }[]; seq: number }
export interface PresentationModel {
  mechanicalEcho: EchoEntry[];
  statusMenu: VisibleCell[];
  pendingChoice?: ChoiceView;
}

const ECHO_KINDS = ["verdict", "mutation", "watcher_fired"] as const;

// 可见性判定(玩家视角):cell 可见 ⟺ visible=1 ∨ (entity 有 __show_all=1 ∧ visible≠2);
// __show_all 标记 cell 本身不进菜单。
function statusMenu(db: DB): VisibleCell[] {
  return db.prepare(
    `SELECT entity, attr, value FROM sheet
      WHERE attr != '__show_all'
        AND ( visible = 1
              OR ( visible != 2
                   AND entity IN (SELECT entity FROM sheet WHERE attr='__show_all' AND value='1') ) )
      ORDER BY entity, attr`,
  ).all() as VisibleCell[];
}

function mechanicalEcho(db: DB, turnStartSeq: number): EchoEntry[] {
  const rows = db.prepare(
    `SELECT seq, kind, content, data_json FROM event
      WHERE seq > ? AND kind IN ('verdict','mutation','watcher_fired') AND visible = 1
      ORDER BY seq`,
  ).all(turnStartSeq) as { seq: number; kind: EchoEntry["kind"]; content: string | null; data_json: string | null }[];
  return rows.map((r) => ({ seq: r.seq, kind: r.kind, text: echoText(r.content, r.data_json) }));
}

// v1:优先 event.content(裁决/mutation 工具已写人类可读串);缺则紧凑回退。富格式化留后续。
function echoText(content: string | null, dataJson: string | null): string {
  if (content && content.trim()) return content;
  return dataJson ?? "";
}

function pendingChoice(db: DB): ChoiceView | undefined {
  const row = db.prepare(
    "SELECT seq, data_json FROM event WHERE kind='choice' ORDER BY seq DESC LIMIT 1",
  ).get() as { seq: number; data_json: string | null } | undefined;
  if (!row || !row.data_json) return undefined;
  const d = JSON.parse(row.data_json) as { prompt: string; options: { label: string; consequence: string }[] };
  return { prompt: d.prompt, options: d.options, seq: row.seq };
}

export function buildPresentationModel(db: DB, opts: { turnStartSeq?: number } = {}): PresentationModel {
  const turnStartSeq = opts.turnStartSeq ?? lastTurnStart(db);
  return {
    mechanicalEcho: mechanicalEcho(db, turnStartSeq),
    statusMenu: statusMenu(db),
    pendingChoice: pendingChoice(db),
  };
}

// 未给 turnStartSeq:回退到「最近一条机械类 event 之前」近似本轮起点;无则 0(全量)。
function lastTurnStart(db: DB): number {
  const row = db.prepare(
    "SELECT MIN(seq) s FROM event WHERE kind IN ('verdict','mutation','watcher_fired')",
  ).get() as { s: number | null };
  return row.s === null ? 0 : row.s - 1;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd packages/core && npx vitest run src/present/model.test.ts`
Expected: PASS(4 passed)。

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/present/
git commit -m "feat(present): 输出层呈现模型生成器(读侧纯函数,按 visible 过滤)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Skills v1 完整首版草稿(`skills/**`)

**Files:**
- Create: `packages/core/skills/dicelore-gm-core/SKILL.md`
- Create: `packages/core/skills/dicelore-gm-core/references/{moves-full,consequences,visibility-play,reminders}.md`
- Create: `packages/core/skills/dicelore-flow-{gacha,contest,anka,explore}/SKILL.md`
- Test: `packages/core/src/adapter/skills-structure.test.ts`(结构校验)

**Interfaces:**
- Consumes: 无(纯 markdown + 一个扫描测试)。
- Produces: `skills/` 目录树,供 Task 5(init)拷贝。

本 Task 用「结构校验测试」作测试周期(措辞 eval-pending、不测内容质量)。

- [ ] **Step 1: 写失败测试(结构校验)**

```ts
// packages/core/src/adapter/skills-structure.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "skills");

function frontmatter(md: string): Record<string, string> {
  const m = /^---\n([\s\S]*?)\n---/.exec(md);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const FLOWS = ["gacha", "contest", "anka", "explore"];

describe("Skills 包结构", () => {
  it("gm-core SKILL.md 存在、frontmatter 含 name/description、body <500 行", () => {
    const p = join(SKILLS_DIR, "dicelore-gm-core", "SKILL.md");
    expect(existsSync(p)).toBe(true);
    const md = readFileSync(p, "utf8");
    const fm = frontmatter(md);
    expect(fm.name).toBe("dicelore-gm-core");
    expect(fm.description?.length ?? 0).toBeGreaterThan(0);
    expect(md.split("\n").length).toBeLessThan(500);
  });

  it("gm-core 四张 references 深表都在", () => {
    for (const r of ["moves-full", "consequences", "visibility-play", "reminders"]) {
      expect(existsSync(join(SKILLS_DIR, "dicelore-gm-core", "references", `${r}.md`))).toBe(true);
    }
  });

  it("四个 flow skill 都在、frontmatter name 对得上", () => {
    for (const f of FLOWS) {
      const p = join(SKILLS_DIR, `dicelore-flow-${f}`, "SKILL.md");
      expect(existsSync(p)).toBe(true);
      expect(frontmatter(readFileSync(p, "utf8")).name).toBe(`dicelore-flow-${f}`);
    }
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/core && npx vitest run src/adapter/skills-structure.test.ts`
Expected: FAIL — 文件不存在。

- [ ] **Step 3: 写 gm-core SKILL.md**(转写 [Skills包.md](../../wiki/04-子系统设计/Skills包.md) §1.2/§2/§3,措辞标 eval-pending)

```markdown
---
name: dicelore-gm-core
description: Use on EVERY turn of running an anko/anki (dice/vote-driven interactive fiction) session as GM — deciding whether to offer the player a choice or roll dice and which roll, respecting roll results without soft-landing, managing what the player can see, keeping a turn as one authored beat. Consult this even when the GM action seems simple.
---

<!-- 措辞 eval-pending:终稿靠 skill-creator eval-loop(harness 就绪后,复用 L3 信号作 assertions)。 -->

# Dicelore GM 核心

## Agenda 议程(北极星,凌驾一切)

0. **你是世界的诚实仲裁者,不是玩家的取悦者。**(Dicelore 特有、凌驾其余。)
1. 描绘一个会自己呼吸的世界——世界有自己的因果、数值与进程(world/sheet/watcher 驱动),不是为取悦玩家布置的背景板。
2. 让玩家的选择带来真实的后果——后果声明在先、骰子说了算;冒险感来自"选择有重量"。
3. 玩出来看会发生什么(play to find out)——不预先知道结局、不朝"满意的结局"叙事。

> F2 软着陆同时违背第 2、3 条;F1 跳骰违背第 3 条。Moves 是你唯一合法的动作类别,由封闭的 MCP 工具集机械兑现;下面只教"该用其中哪个"。

## Moves(GM 动作)+ 判定时机

两个极端都要防:**别什么都骰**(该让玩家做主时替玩家骰→剥夺能动性)/ **别什么都让选**(该交给运气/对抗时让玩家选→消解风险)。

### 闸 A · 谁拥有这个决定?(能动性)
- 玩家自主决策(往哪走、攻不攻、用什么策略)→ `resolve_choice`(后果必填、暂存到回合末物化)。
- 不是玩家自主(命中没、抽到啥、掉多少血)→ 进闸 B。

### 闸 B · 该不该骰?(不确定 ∧ 失败有意义)
- 结果不确定(可能失败)吗?∧ 失败/坏结果有真实后果吗?
  - 两者都是 → 骰(进形状表)。
  - 否则(必成/必败、失败只是"再来一次"、对故事无关)→ 别骰,直接 `narrate`(或与玩家商量)。

### 形状表 · 骰什么 → 哪个工具(镜像 resolver 二轴)
| 结果形状 | 工具 | 何时用 |
|---|---|---|
| label 叙事档位 | `resolve_outcome` | 结果是"哪一档后果/方向",GM 预设档位表 |
| verdict 胜负 | `resolve_contest` | 两方对抗 或 过线检定(DC=一边常数) |
| number 数值 | `sheet_update` 带骰 | 结果是具体数值变化(伤害/成长/资源) |
| content 抽内容 | `world_sample` | 从池子随机抽一行(卡/掉落/遭遇) |

### 两个补丁
- **安全 vs 冒险**:给"稳妥/冒险一掷"的 `resolve_choice`,玩家选了冒险才进闸 B 骰(玩家自选风险→buy-in)。
- **打平降级**:`resolve_choice` 平票且无所谓对错 → 降级 `resolve_outcome` 掷定。

### 派发到流程 skill
判明 genre 局面后让位对应流程 skill:抽卡→consult `dicelore-flow-gacha`;对抗→`dicelore-flow-contest`;安价/投票→`dicelore-flow-anka`;探索/情报→`dicelore-flow-explore`。Moves 管"走哪条路",流程 skill 管"这条路怎么走"。

> 全决策表 + 边角 case + worked examples → `references/moves-full.md`。

## Principles(怎么主持一轮)

- **F1 必掷骰**:该裁决处必经裁决工具——随机/取真值在引擎内、你给不出真值。识别该裁决的时机,别用散文绕过。*why*:玩家的风险感来自结果不可由你编造。
- **F2 双边护栏**:上边界 anti-讨好——骰出坏结果照后果叙述,不挽救、不淡化、不强行转圜。下边界 anti-死胡同——坏结果也不能退化成"什么都没发生",要咬下去并打开新局面(fail-forward)。*why*:失败被真实计入才有重量;但失败让故事停摆同样糟。手法 → `references/consequences.md`。
- **F3 选对方式**:谁拥有决定 → 谁来定结果(主力在上面 Moves 决策表)。
- **一轮范式**:① 像作者写一段,任何工具轮内可多次任意序穿插;② `narrate` 是散文 stream、非终结步骤;③ 非终局轮回合末必须留有暂存的 `resolve_choice`(否则把玩家晾着=违规);④ 只 narrate 色彩、不吐数值菜单(机械回显由输出层渲染,你吐=费 token 又易错)。
- **可见性**:① 开局 `sheet_show` 玩家自己人物卡一次(默认全隐);② 暗值用强制隐藏焊死,entity-show 也不揭;③ 别在 `narrate` 里吐出隐藏数值(好感度暗值/隐藏 DC/GM 私有信息);④ 揭示用 `show`(持久)、一次性瞥用 `reveal_once`。playbook → `references/visibility-play.md`。

## 补刀
工具出参可能带 `reminders`(L1 terse 反射,如"尊重结果,别软着陆")——它是你已内化教条的即时回声,按它校准本轮输出。丰富措辞 → `references/reminders.md`。
```

- [ ] **Step 4: 写四张 references 深表**

`packages/core/skills/dicelore-gm-core/references/moves-full.md`:
```markdown
# Moves 全决策表(深表)

<!-- 措辞 eval-pending。 -->
承接 SKILL.md 的两道闸 + 形状表,补边角 case 与 worked examples。

## 边角 case
- **连续检定**:每次检定都满足"不确定 ∧ 失败有意义"才掷;否则合并为一次或直接叙述。
- **群体目标逐个结算**:对每个目标分别 `resolve_contest` / `sheet_update`,不要一次掷骰套用全体。
- **隐藏 DC 检定**:DC 作为 `resolve_contest` 一边的常数 expr,不在 narrate 里吐出数值。

## Worked examples
- 玩家:"我去森林找猎物" → 闸 A 这是"找到什么"(非玩家自主)→ 闸 B 不确定且有意义 → 形状 label → `resolve_outcome`(猎物随机表)。
- 玩家:"我攻击哥布林" → 闸 B → 形状 verdict → `resolve_contest("{张三.攻击}","{哥布林.AC}")` → 据胜负 narrate,败方 `sheet_update` 带骰掉血。
- 玩家:"我往左还是往右?" 问 GM → 闸 A 玩家自主 → `resolve_choice` 给方向选项 + 各自后果。
```

`packages/core/skills/dicelore-gm-core/references/consequences.md`:
```markdown
# fail-forward 后果手法菜单(F2 下边界 craft)

<!-- 措辞 eval-pending。 -->
- **三档结果**:完全成功 / 部分成功带代价 / 失败有后果(零代价得手是例外,对齐 `resolve_outcome` 的 bands)。
- **软招 vs 硬招**:玩家只是看着你→软招(预告威胁、推进 Clock);送黄金机会或骰出失败→硬招(扣血、触发 Front)。
- **后果手法**:切退路 / 惩罚某类检定 / 失而复得付代价 / 施加 condition / 消耗资源 / 驱动末日钟。
- **"有时失败就是失败"**:不推进剧情的检定可直接失败,别硬造后果。
- 范本:PO 事先声明烈度边界(战斗照骰=硬、剧情不让一次脑抽团灭=软)再一致执行。
```

`packages/core/skills/dicelore-gm-core/references/visibility-play.md`:
```markdown
# 可见性 playbook

<!-- 措辞 eval-pending。 -->
- **开局**:对玩家自己人物卡 `sheet_show` 一次(默认全隐),否则玩家看不到自己。
- **暗值**:好感度暗值、隐藏 DC、GM 私有信息写入时用强制隐藏(visible=2),entity 级 show 也不揭。
- **reveal_once vs show**:一次性瞥/侦查/占卜/鉴定 → `reveal_once`(冻结副本披露、不入持久可见集);长效揭示 → `sheet_show`/`world_show`(持久,输出层每轮渲染实时值)。
- **红线**:别在 `narrate` 散文里吐出任何隐藏数值。
```

`packages/core/skills/dicelore-gm-core/references/reminders.md`:
```markdown
# 补刀丰富措辞表(L2)

<!-- 措辞 eval-pending:每条 = 触发情境 → 丰富提醒。终稿靠 eval-loop。 -->
| 触发情境 | 丰富提醒(讲 why) |
|---|---|
| 命中失败档/坏 verdict | 照后果叙述。软着陆会抽走玩家的风险感——失败被真实计入,胜利才有重量;但别让故事停摆,咬下去打开新局面。 |
| 后果已锁 | 叙述须与已锁后果一致——后果先于玩家可见即锁,事后改写=违背诚实仲裁。 |
| 该裁决处 | 走裁决工具,别用散文绕过——你给不出引擎内的真值,这正是抗编造的地基。 |
| 非终局轮将结束 | 留一个暂存的 `resolve_choice`,否则把玩家晾着、剥夺能动性。 |
```

- [ ] **Step 5: 写四个 flow skill**

`packages/core/skills/dicelore-flow-contest/SKILL.md`:
```markdown
---
name: dicelore-flow-contest
description: Use when resolving a contested action or skill check — combat hit, persuasion vs resistance, a check against a DC. Covers group targets and serial contests.
---
<!-- 措辞 eval-pending。建立在 gm-core 的 Moves 与裁决工具之上,不重复纪律。 -->
## 何时进入本流程
接 Moves 形状表的 verdict 行:两方对抗 或 过线检定。

## 一步步走
1. 取双方属性引用(`{张三.攻击}` vs `{哥布林.AC}`),DC=一边常数 expr。
2. 调 `resolve_contest`,引擎取真值+掷+比大小(你给不出真值)。
3. 据 winner `narrate`;败方后果可能 `sheet_update` 带骰(掉血)。
4. 群体目标逐个结算;连续对抗每次重判"不确定 ∧ 失败有意义"。

## 与本 genre 规则的接口
rule 域被动召回的战斗约束(由 hook 注入)在此套用。
```

`packages/core/skills/dicelore-flow-gacha/SKILL.md`:
```markdown
---
name: dicelore-flow-gacha
description: Use when the game involves drawing from a card/loot/gacha pool — rolling for rarity, fabricating drawn-card content, fusing or chaining card effects.
---
<!-- 措辞 eval-pending。 -->
## 何时进入本流程
接 Moves 形状表的 content 行:从池子随机抽。

## 一步步走
1. 确定池子与过滤条件(品质/类别),调 `world_sample` 随机抽一行(结果空间来自 store,你不编造抽到啥)。
2. 现编卡面内容时 `world_register` 写回 world(source=ai),保持结构。
3. 据抽到的卡 `narrate` 色彩;若涉及数值入卡 → `sheet_update`。
```

`packages/core/skills/dicelore-flow-anka/SKILL.md`:
```markdown
---
name: dicelore-flow-anka
description: Use when the player should drive the story through a choice or vote — branching decisions, "what do you do", safe-vs-risky options, anko/anki style prompts.
---
<!-- 措辞 eval-pending。 -->
## 何时进入本流程
接 Moves 闸 A:玩家自主决策。

## 一步步走
1. 给 `resolve_choice`,每个选项后果必填(后果先于玩家可见即锁)。
2. 选项暂存到回合末由 Stop hook 物化呈现给玩家;轮内可反复改、末次为准。
3. 安全 vs 冒险:玩家选了冒险才进闸 B 骰;平票无所谓对错 → 降级 `resolve_outcome`。
```

`packages/core/skills/dicelore-flow-explore/SKILL.md`:
```markdown
---
name: dicelore-flow-explore
description: Use when the player investigates, scouts, divines, or appraises — gathering information from the world, peeking at hidden things, searching lore.
---
<!-- 措辞 eval-pending。 -->
## 何时进入本流程
接探索/情报局面:查世界、瞥隐藏物。

## 一步步走
1. 查世界设定 → `world_search`。
2. 一次性瞥/侦查/占卜/鉴定 → `reveal_once`(冻结副本披露,不翻持久可见位)。
3. 长效揭示 → `sheet_show`/`world_show`。
4. 别在 narrate 吐出未揭示的隐藏数值。
```

- [ ] **Step 6: 跑测试确认通过**

Run: `cd packages/core && npx vitest run src/adapter/skills-structure.test.ts`
Expected: PASS(3 passed)。

- [ ] **Step 7: 提交**

```bash
git add packages/core/skills/ packages/core/src/adapter/skills-structure.test.ts
git commit -m "feat(skills): 组件3 Skills v1 完整首版草稿(gm-core + 四 references + 四 flow,措辞 eval-pending)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: init 模板(`src/adapter/templates.ts`)

**Files:**
- Create: `packages/core/src/adapter/templates.ts`
- Test: `packages/core/src/adapter/templates.test.ts`

**Interfaces:**
- Consumes: 无(纯字符串/对象生成)。
- Produces:
  ```ts
  function claudeMdPointer(): string
  function settingsJson(opts: { session: string; hooksDir: string }): object
  ```
  其中 `settingsJson` 产出 `{ mcpServers, hooks }`;hook 命令用 `command:"node", args:["--import","tsx", join(hooksDir, "<name>.ts")]`(绝对路径在 init 期填,见 Task 5)。

- [ ] **Step 1: 写失败测试**

```ts
// packages/core/src/adapter/templates.test.ts
import { describe, it, expect } from "vitest";
import { claudeMdPointer, settingsJson } from "./templates.js";

describe("init 模板", () => {
  it("CLAUDE.md 指针含诚实仲裁者 + consult gm-core", () => {
    const md = claudeMdPointer();
    expect(md).toContain("诚实仲裁者");
    expect(md).toContain("dicelore-gm-core");
  });

  it("settings.json 注册 dicelore MCP + 三 hook、exec form node、带 tsx loader", () => {
    const s = settingsJson({ session: "修仙团", hooksDir: "/abs/hooks" }) as any;
    expect(s.mcpServers.dicelore.env.DICELORE_SESSION).toBe("修仙团");
    expect(Object.keys(s.hooks).sort()).toEqual(["SessionStart", "Stop", "UserPromptSubmit"].sort());
    const stop = s.hooks.Stop[0].hooks[0];
    expect(stop.command).toBe("node");
    expect(stop.args).toEqual(["--import", "tsx", "/abs/hooks/turn-end.ts"]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/core && npx vitest run src/adapter/templates.test.ts`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 写实现**

```ts
// packages/core/src/adapter/templates.ts
import { join } from "node:path";

export function claudeMdPointer(): string {
  return [
    "## Dicelore GM",
    "",
    "你是 Dicelore GM——**世界的诚实仲裁者,不是玩家的取悦者**。",
    "每轮主持先 consult `dicelore-gm-core` skill;尊重骰子、声明后果在先、非终局轮留 `resolve_choice`。",
    "随机与取数全在 MCP 工具内执行,你只给引用、不编造真值。",
    "",
  ].join("\n");
}

// hook 命令:node --import tsx <abs>.ts(包内 hook 入口,跨端、原生 resolve core、不踩 .cmd shim)。
function hookCmd(hooksDir: string, name: string) {
  return { type: "command", command: "node", args: ["--import", "tsx", join(hooksDir, `${name}.ts`)] };
}

export function settingsJson(opts: { session: string; hooksDir: string }): object {
  const { session, hooksDir } = opts;
  return {
    mcpServers: {
      dicelore: { command: "npx", args: ["dicelore", "mcp"], env: { DICELORE_SESSION: session } },
    },
    hooks: {
      SessionStart: [{ hooks: [hookCmd(hooksDir, "session-start")] }],
      UserPromptSubmit: [{ hooks: [hookCmd(hooksDir, "turn-start")] }],
      Stop: [{ hooks: [hookCmd(hooksDir, "turn-end")] }],
    },
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd packages/core && npx vitest run src/adapter/templates.test.ts`
Expected: PASS(2 passed)。

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/adapter/templates.ts packages/core/src/adapter/templates.test.ts
git commit -m "feat(adapter): init 模板(CLAUDE.md 指针 + settings.json 生成)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 波 2(可并发):L3 检查 / 三 hook 逻辑 + 入口

### Task 4: L3 机械检查(`src/adapter/l3.ts`)

**Files:**
- Create: `packages/core/src/adapter/l3.ts`
- Test: `packages/core/src/adapter/l3.test.ts`

**Interfaces:**
- Consumes: `store/event.ts`→`EventRow`。
- Produces:
  ```ts
  interface L3Input {
    events: EventRow[];        // 本轮 event 区间
    transcriptHasText: boolean;// 本轮 transcript 是否有实质 assistant 文本
    pendingChoiceEmpty: boolean;
    hasGameEnd: boolean;
    stopHookActive: boolean;   // CC 标识本回合已被 hook block 过
  }
  interface L3Note { content: string }
  interface L3Result { block?: { reason: string }; notes: L3Note[] }
  function auditTurn(input: L3Input): L3Result
  ```

- [ ] **Step 1: 写失败测试**

```ts
// packages/core/src/adapter/l3.test.ts
import { describe, it, expect } from "vitest";
import type { EventRow } from "../store/event.js";
import { auditTurn } from "./l3.js";

function ev(kind: EventRow["kind"], data?: unknown): EventRow {
  return { seq: 1, content: null, kind, data_json: data ? JSON.stringify(data) : null, tags: null, visible: 1, game_time: null, created_at: "" };
}
const base = { events: [] as EventRow[], transcriptHasText: true, pendingChoiceEmpty: false, hasGameEnd: false, stopHookActive: false };

describe("auditTurn(L3)", () => {
  it("档A:非终局无暂存 choice → block", () => {
    const r = auditTurn({ ...base, events: [ev("narrate")], pendingChoiceEmpty: true });
    expect(r.block?.reason).toContain("resolve_choice");
  });

  it("档A:有实质文本但无 narrate event → block 提醒补 narrate", () => {
    const r = auditTurn({ ...base, events: [ev("verdict")], transcriptHasText: true });
    expect(r.block?.reason).toContain("narrate");
  });

  it("终局轮(game_end)无 choice 不算违规", () => {
    const r = auditTurn({ ...base, events: [ev("narrate"), ev("verdict")], pendingChoiceEmpty: true, hasGameEnd: true });
    expect(r.block).toBeUndefined();
  });

  it("stopHookActive=true → 不再 block(防重入,最多纠一次)", () => {
    const r = auditTurn({ ...base, events: [ev("narrate")], pendingChoiceEmpty: true, stopHookActive: true });
    expect(r.block).toBeUndefined();
  });

  it("档B:本轮有 mutation 但无 verdict 之外...掷骰绕过统计写 note(不 block)", () => {
    const r = auditTurn({ ...base, events: [ev("narrate"), ev("mutation")] });
    expect(r.block).toBeUndefined();
    expect(r.notes.length).toBeGreaterThanOrEqual(0); // 统计类 note,允许为空或记录
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/core && npx vitest run src/adapter/l3.test.ts`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 写实现**

```ts
// packages/core/src/adapter/l3.ts
import type { EventRow } from "../store/event.js";

export interface L3Input {
  events: EventRow[];
  transcriptHasText: boolean;
  pendingChoiceEmpty: boolean;
  hasGameEnd: boolean;
  stopHookActive: boolean;
}
export interface L3Note { content: string }
export interface L3Result { block?: { reason: string }; notes: L3Note[] }

// 档A:结构确凿、补救无歧义 → 当场 block;stopHookActive 防重入(最多纠一次)。
// 档B:语义/统计 → 只写 note 喂 eval-loop,不 block。
export function auditTurn(input: L3Input): L3Result {
  const notes: L3Note[] = [];
  const kinds = new Set(input.events.map((e) => e.kind));

  if (!input.stopHookActive) {
    if (input.pendingChoiceEmpty && !input.hasGameEnd) {
      return { block: { reason: "本轮未给玩家选择,请补 resolve_choice 再结束(非终局轮不能把玩家晾着)。" }, notes };
    }
    if (input.transcriptHasText && !kinds.has("narrate")) {
      return { block: { reason: "剧情请走 narrate(散文须落 event 才能审计/召回)。" }, notes };
    }
  }

  // 档B 统计:掷骰绕过率信号(本轮 verdict/mutation 数 vs narrate 数),写 note 供 eval。
  const mech = input.events.filter((e) => e.kind === "verdict" || e.kind === "mutation").length;
  const narr = input.events.filter((e) => e.kind === "narrate").length;
  if (mech > 0) notes.push({ content: `L3统计: 本轮机械事件=${mech} narrate=${narr}` });

  return { notes };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd packages/core && npx vitest run src/adapter/l3.test.ts`
Expected: PASS(5 passed)。

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/adapter/l3.ts packages/core/src/adapter/l3.test.ts
git commit -m "feat(adapter): L3 机械检查纯函数(档A block / 档B note,防重入)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: SessionStart 逻辑 + 入口(`src/adapter/sessionContext.ts` + `hooks/session-start.ts`)

**Files:**
- Create: `packages/core/src/adapter/sessionContext.ts`
- Create: `packages/core/src/adapter/hooks/session-start.ts`
- Test: `packages/core/src/adapter/sessionContext.test.ts`

**Interfaces:**
- Consumes: `store/db.ts`→`DB`;`session/resolve.ts`→`metaGet`。
- Produces: `function buildSessionContext(db: DB): string`(SessionStart 注入的 additionalContext 文本)。

- [ ] **Step 1: 写失败测试**

```ts
// packages/core/src/adapter/sessionContext.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../store/db.js";
import { metaSet } from "../session/resolve.js";
import { buildSessionContext } from "./sessionContext.js";

describe("buildSessionContext", () => {
  it("含 GM 身份 + Agenda 第0条 + 极简纪律", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const ctx = buildSessionContext(db);
    expect(ctx).toContain("诚实仲裁者");
    expect(ctx).toContain("dicelore-gm-core");
  });

  it("有团本调性 meta 时带上调性一句", () => {
    const db = openDb(":memory:");
    initSchema(db);
    metaSet(db, "tone", "黑暗修仙,慎用喜剧");
    expect(buildSessionContext(db)).toContain("黑暗修仙");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/core && npx vitest run src/adapter/sessionContext.test.ts`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 写实现 + 入口**

```ts
// packages/core/src/adapter/sessionContext.ts
import type { DB } from "../store/db.js";
import { metaGet } from "../session/resolve.js";

// 只注指路牌级:身份 + Agenda + 极简纪律 + 调性一句;教条本体靠 gm-core skill 触发载入。
export function buildSessionContext(db: DB): string {
  const tone = metaGet(db, "tone");
  const lines = [
    "你是 Dicelore GM——世界的诚实仲裁者,不是玩家的取悦者。",
    "Agenda:描绘会自己呼吸的世界 / 让选择带来真实后果 / 玩出来看会发生什么。",
    "纪律:别软着陆、该骰必骰、非终局轮留 resolve_choice、只 narrate 色彩不吐数值菜单。",
    "每轮主持先 consult dicelore-gm-core skill。",
  ];
  if (tone) lines.push(`团本调性:${tone}`);
  return lines.join("\n");
}
```

```ts
// packages/core/src/adapter/hooks/session-start.ts
// 薄入口:读 stdin(CC hook JSON,字段以实现期官方文档为准)→ openSession → 注 additionalContext。
import { openSession } from "../../session/resolve.js";
import { buildSessionContext } from "../sessionContext.js";

const { db } = openSession(); // env DICELORE_SESSION
const additionalContext = buildSessionContext(db);
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext },
}));
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd packages/core && npx vitest run src/adapter/sessionContext.test.ts`
Expected: PASS(2 passed)。

- [ ] **Step 5: 烟测入口可跑(env 隔离临时库)**

Run: `cd packages/core && DICELORE_SESSIONS_DIR=$(mktemp -d) DICELORE_SESSION=t node --import tsx src/adapter/hooks/session-start.ts`
Expected: 打出含 `additionalContext` 的 JSON,无报错。

- [ ] **Step 6: 提交**

```bash
git add packages/core/src/adapter/sessionContext.ts packages/core/src/adapter/sessionContext.test.ts packages/core/src/adapter/hooks/session-start.ts
git commit -m "feat(adapter): SessionStart 注入(身份+Agenda+极简纪律+调性)+ 入口

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: UserPromptSubmit 逻辑 + 入口(`src/adapter/ruleRecall.ts` + `hooks/turn-start.ts`)

**Files:**
- Create: `packages/core/src/adapter/ruleRecall.ts`
- Create: `packages/core/src/adapter/hooks/turn-start.ts`
- Test: `packages/core/src/adapter/ruleRecall.test.ts`

**Interfaces:**
- Consumes: `store/db.ts`→`DB`;`store/rule.ts`→`ruleSearch`;`store/event.ts`(读 MAX(seq));`session/resolve.ts`→`metaSet`/`metaGet`。
- Produces:
  ```ts
  function recallRules(db: DB, prompt: string): string   // 召回 rule 拼成 additionalContext(无命中→空串)
  function recordTurnStart(db: DB): number                // 写 session_meta.turn_start_seq = 当前 MAX(seq),返回值
  ```

- [ ] **Step 1: 写失败测试**

```ts
// packages/core/src/adapter/ruleRecall.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../store/db.js";
import { ruleUpsert } from "../store/rule.js";
import { eventAppend } from "../store/event.js";
import { metaGet } from "../session/resolve.js";
import { recallRules, recordTurnStart } from "./ruleRecall.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }

describe("rule 召回", () => {
  it("命中的 rule 内容进召回串", () => {
    const db = freshDb();
    ruleUpsert(db, { name: "战斗硬着陆", content: "战斗失败必须照后果结算,不得救场" });
    const ctx = recallRules(db, "我要发起战斗");
    expect(ctx).toContain("照后果结算");
  });

  it("无命中 → 空串", () => {
    const db = freshDb();
    expect(recallRules(db, "完全无关的闲聊")).toBe("");
  });
});

describe("turn_start_seq 记录", () => {
  it("写当前 MAX(seq)", () => {
    const db = freshDb();
    eventAppend(db, { kind: "narrate", content: "x" }); // seq1
    const s = recordTurnStart(db);
    expect(s).toBe(1);
    expect(metaGet(db, "turn_start_seq")).toBe("1");
  });

  it("空 event 表 → 0", () => {
    const db = freshDb();
    expect(recordTurnStart(db)).toBe(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/core && npx vitest run src/adapter/ruleRecall.test.ts`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 写实现 + 入口**

```ts
// packages/core/src/adapter/ruleRecall.ts
import type { DB } from "../store/db.js";
import { ruleSearch } from "../store/rule.js";
import { metaSet } from "../session/resolve.js";

// 被动 rule 召回:AI 只读、本地 FTS,远小于 UserPromptSubmit 30s 超时。
export function recallRules(db: DB, prompt: string, limit = 5): string {
  const hits = ruleSearch(db, prompt, limit);
  if (hits.length === 0) return "";
  return ["相关团本规则(被动召回,务必遵守):", ...hits.map((r) => `- ${r.name}: ${r.content}`)].join("\n");
}

// 记本轮起始 seq,供 Stop hook 圈本轮 event 区间。
export function recordTurnStart(db: DB): number {
  const row = db.prepare("SELECT MAX(seq) s FROM event").get() as { s: number | null };
  const seq = row.s ?? 0;
  metaSet(db, "turn_start_seq", String(seq));
  return seq;
}
```

```ts
// packages/core/src/adapter/hooks/turn-start.ts
// 薄入口:读 stdin.prompt(字段以实现期官方文档为准)→ rule 召回 + 记 seq → 注 additionalContext。
import { openSession } from "../../session/resolve.js";
import { recallRules, recordTurnStart } from "../ruleRecall.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const raw = await readStdin();
let prompt = "";
try { prompt = (JSON.parse(raw || "{}") as { prompt?: string }).prompt ?? ""; } catch { /* 容错 */ }

const { db } = openSession();
recordTurnStart(db);
// TODO(快照线): detectAndRestore(db, transcriptHead) —— 待并行 core 快照线落地接(adapter §8)。
const additionalContext = recallRules(db, prompt);
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext },
}));
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd packages/core && npx vitest run src/adapter/ruleRecall.test.ts`
Expected: PASS(4 passed)。

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/adapter/ruleRecall.ts packages/core/src/adapter/ruleRecall.test.ts packages/core/src/adapter/hooks/turn-start.ts
git commit -m "feat(adapter): UserPromptSubmit 被动 rule 召回 + turn_start_seq 记录 + 入口(快照检测留 TODO)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Stop 入口接线(`src/adapter/hooks/turn-end.ts`)

**Files:**
- Create: `packages/core/src/adapter/hooks/turn-end.ts`
- Test: `packages/core/src/adapter/turnEnd.test.ts`(测可抽出的纯逻辑 `collectTurnEnd`)
- Create: `packages/core/src/adapter/turnEnd.ts`(可测装配:圈区间 + 调 auditTurn + 物化)

**Interfaces:**
- Consumes: `store/event.ts`→`eventSince`/`eventAppend`;`store/choice.ts`→`getPendingChoice`/`materializePendingChoice`;`session/resolve.ts`→`metaGet`;`./l3.ts`→`auditTurn`。
- Produces:
  ```ts
  function runTurnEnd(db: DB, args: { transcriptHasText: boolean; stopHookActive: boolean }): { block?: { reason: string } }
  ```
  副作用:物化 pending_choice(若有)、写 L3 档B note event、(返回)档A block 决策。

- [ ] **Step 1: 写失败测试**

```ts
// packages/core/src/adapter/turnEnd.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../store/db.js";
import { eventAppend, eventSince } from "../store/event.js";
import { stagePendingChoice, getPendingChoice } from "../store/choice.js";
import { metaSet } from "../session/resolve.js";
import { runTurnEnd } from "./turnEnd.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }

describe("runTurnEnd(Stop 装配)", () => {
  it("有暂存 choice + narrate → 物化 choice、无 block", () => {
    const db = freshDb();
    metaSet(db, "turn_start_seq", "0");
    eventAppend(db, { kind: "narrate", content: "剧情" });
    stagePendingChoice(db, "走?", [{ label: "进", consequence: "遇敌" }]);
    const r = runTurnEnd(db, { transcriptHasText: true, stopHookActive: false });
    expect(r.block).toBeUndefined();
    expect(getPendingChoice(db)?.status).toBe("materialized");
    expect(eventSince(db, 0).some((e) => e.kind === "choice")).toBe(true);
  });

  it("非终局无 choice → 返回 block", () => {
    const db = freshDb();
    metaSet(db, "turn_start_seq", "0");
    eventAppend(db, { kind: "narrate", content: "剧情" });
    const r = runTurnEnd(db, { transcriptHasText: true, stopHookActive: false });
    expect(r.block?.reason).toContain("resolve_choice");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/core && npx vitest run src/adapter/turnEnd.test.ts`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 写实现 + 入口**

```ts
// packages/core/src/adapter/turnEnd.ts
import type { DB } from "../store/db.js";
import { eventSince, eventAppend } from "../store/event.js";
import { getPendingChoice, materializePendingChoice } from "../store/choice.js";
import { metaGet } from "../session/resolve.js";
import { auditTurn } from "./l3.js";

export function runTurnEnd(
  db: DB,
  args: { transcriptHasText: boolean; stopHookActive: boolean },
): { block?: { reason: string } } {
  const turnStartSeq = Number(metaGet(db, "turn_start_seq") ?? "0");
  const events = eventSince(db, turnStartSeq);
  const pc = getPendingChoice(db);
  const pendingChoiceEmpty = !pc || pc.status !== "staged";
  const hasGameEnd = events.some((e) => e.kind === "note" && (e.content ?? "").includes("game_end"));

  const result = auditTurn({
    events,
    transcriptHasText: args.transcriptHasText,
    pendingChoiceEmpty,
    hasGameEnd,
    stopHookActive: args.stopHookActive,
  });

  // ① 物化暂存 choice(若 staged)。
  if (pc && pc.status === "staged") materializePendingChoice(db);
  // ② 档B note 落 event(visible=0,喂 eval-loop)。
  for (const n of result.notes) eventAppend(db, { kind: "note", visible: 0, content: n.content });
  // ③ TODO(快照线): checkpoint(db, transcriptHead) —— 待并行 core 快照线落地接(adapter §8 ③)。

  return result.block ? { block: result.block } : {};
}
```

```ts
// packages/core/src/adapter/hooks/turn-end.ts
// 薄入口:读 stdin(transcript_path / stop_hook_active,字段以实现期官方文档为准)→ 装配 → decision JSON。
import { readFileSync } from "node:fs";
import { openSession } from "../../session/resolve.js";
import { runTurnEnd } from "../turnEnd.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const raw = await readStdin();
const input = (() => { try { return JSON.parse(raw || "{}"); } catch { return {}; } })() as
  { transcript_path?: string; stop_hook_active?: boolean };

// 本轮 transcript 是否有实质 assistant 文本(简化:文件非空即有;精确解析留实现期)。
let transcriptHasText = true;
try { if (input.transcript_path) transcriptHasText = readFileSync(input.transcript_path, "utf8").trim().length > 0; } catch { /* 容错 */ }

const { db } = openSession();
const r = runTurnEnd(db, { transcriptHasText, stopHookActive: Boolean(input.stop_hook_active) });
process.stdout.write(JSON.stringify(r.block ? { decision: "block", reason: r.block.reason } : {}));
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd packages/core && npx vitest run src/adapter/turnEnd.test.ts`
Expected: PASS(2 passed)。

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/adapter/turnEnd.ts packages/core/src/adapter/turnEnd.test.ts packages/core/src/adapter/hooks/turn-end.ts
git commit -m "feat(adapter): Stop 装配(物化 choice + L3 两档 + 档B note)+ 入口(快照写留 TODO)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 波 3:init 落地 + CLI 接线 + 北极星手验

### Task 8: `dicelore init`(`src/adapter/init.ts` + `cli.ts` 接线)

**Files:**
- Create: `packages/core/src/adapter/init.ts`
- Modify: `packages/core/src/cli.ts`(加 `init` 分支)
- Test: `packages/core/src/adapter/init.test.ts`

**Interfaces:**
- Consumes: `./templates.ts`→`claudeMdPointer`/`settingsJson`;Node `fs`/`path`/`url`。
- Produces: `function runInit(opts: { projectDir: string; session: string }): void`。

- [ ] **Step 1: 写失败测试**

```ts
// packages/core/src/adapter/init.test.ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "./init.js";

function tmpProject() { return mkdtempSync(join(tmpdir(), "dl-init-")); }

describe("dicelore init", () => {
  it("写 settings.json(注册 MCP + 三 hook 绝对路径)", () => {
    const dir = tmpProject();
    runInit({ projectDir: dir, session: "修仙团" });
    const s = JSON.parse(readFileSync(join(dir, ".claude", "settings.json"), "utf8"));
    expect(s.mcpServers.dicelore.env.DICELORE_SESSION).toBe("修仙团");
    const stopArgs: string[] = s.hooks.Stop[0].hooks[0].args;
    expect(stopArgs[0]).toBe("--import");
    expect(stopArgs[2].endsWith("turn-end.ts")).toBe(true);
    expect(stopArgs[2].startsWith("/")).toBe(true); // 绝对路径
  });

  it("拷 gm-core + 四 flow skill 进 .claude/skills/", () => {
    const dir = tmpProject();
    runInit({ projectDir: dir, session: "t" });
    expect(existsSync(join(dir, ".claude", "skills", "dicelore-gm-core", "SKILL.md"))).toBe(true);
    for (const f of ["gacha", "contest", "anka", "explore"]) {
      expect(existsSync(join(dir, ".claude", "skills", `dicelore-flow-${f}`, "SKILL.md"))).toBe(true);
    }
  });

  it("已有 CLAUDE.md → 追加而非覆盖", () => {
    const dir = tmpProject();
    writeFileSync(join(dir, "CLAUDE.md"), "# 原有内容\n");
    runInit({ projectDir: dir, session: "t" });
    const md = readFileSync(join(dir, "CLAUDE.md"), "utf8");
    expect(md).toContain("原有内容");
    expect(md).toContain("诚实仲裁者");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/core && npx vitest run src/adapter/init.test.ts`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 写实现 + CLI 接线**

```ts
// packages/core/src/adapter/init.ts
import { cpSync, mkdirSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { claudeMdPointer, settingsJson } from "./templates.js";

// 包根 = src/adapter/ 上两级。skills 真源在 <pkg>/skills,hook 入口在 <pkg>/src/adapter/hooks。
const ADAPTER_DIR = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(ADAPTER_DIR, "..", "..");
const SKILLS_SRC = join(PKG_ROOT, "skills");
const HOOKS_SRC = join(PKG_ROOT, "src", "adapter", "hooks");

const FLOWS = ["gacha", "contest", "anka", "explore"];

export function runInit(opts: { projectDir: string; session: string }): void {
  const { projectDir, session } = opts;
  const claudeDir = join(projectDir, ".claude");
  mkdirSync(claudeDir, { recursive: true });

  // settings.json:hook 用包内 hooks 绝对路径(node --import tsx,见 templates)。
  const settings = settingsJson({ session, hooksDir: HOOKS_SRC });
  writeFileSync(join(claudeDir, "settings.json"), JSON.stringify(settings, null, 2) + "\n");

  // skills:默认全装 gm-core + 全部四 flow(留 manifest 过滤接口位:将来按 opts.flows 子集)。
  const skillsDst = join(claudeDir, "skills");
  mkdirSync(skillsDst, { recursive: true });
  cpSync(join(SKILLS_SRC, "dicelore-gm-core"), join(skillsDst, "dicelore-gm-core"), { recursive: true });
  for (const f of FLOWS) {
    cpSync(join(SKILLS_SRC, `dicelore-flow-${f}`), join(skillsDst, `dicelore-flow-${f}`), { recursive: true });
  }

  // CLAUDE.md 指针:已存在则追加。
  const claudeMd = join(projectDir, "CLAUDE.md");
  const pointer = "\n" + claudeMdPointer();
  if (existsSync(claudeMd)) appendFileSync(claudeMd, pointer);
  else writeFileSync(claudeMd, pointer.trimStart());
}
```

`cli.ts` 加分支(在现有 `switch (cmd)` 内,`default` 之前):
```ts
  case "init": {
    const session = arg ?? "default";
    const { runInit } = await import("./adapter/init.js");
    runInit({ projectDir: process.cwd(), session });
    console.log(`已在 ${process.cwd()} 写入 .claude/(MCP + 三 hook + skills),会话=${session}`);
    break;
  }
```
> 注:`cli.ts` 现为同步 `switch`,顶层 `await import` 需把入口包进 `async` 或用动态 import 的 `.then`。若 `cli.ts` 顶层非 async,改用同步 `import { runInit } from "./adapter/init.js"`(置文件顶部)并直接调用。实现期二选一,保持 `cli.ts` 可跑。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd packages/core && npx vitest run src/adapter/init.test.ts`
Expected: PASS(3 passed)。

- [ ] **Step 5: 全量测试 + typecheck**

Run: `cd packages/core && npx vitest run && npm run typecheck`
Expected: 全绿(含组件1/2 既有测试 + 本期新测)。

- [ ] **Step 6: 提交**

```bash
git add packages/core/src/adapter/init.ts packages/core/src/adapter/init.test.ts packages/core/src/cli.ts
git commit -m "feat(adapter): dicelore init(写 .claude/settings.json + 拷 skills + CLAUDE.md 指针)+ CLI 接线

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: 北极星端到端手验(无自动化,记录结果)

**Files:** 无代码改动(手验 + 记录)。

**Interfaces:** Consumes 全部上述产物。

- [ ] **Step 1: 准备临时局 + 灌最小团本**

```bash
cd packages/core
export DICELORE_SESSIONS_DIR=$(mktemp -d)
export DICELORE_SESSION=harness-test
npx tsx src/cli.ts new harness-test
# 用一段临时脚本灌:一条 rule(战斗硬着陆)+ 一张玩家 sheet(并 sheet_show)。
npx tsx -e "import{openSession}from'./src/session/resolve.js';import{ruleUpsert}from'./src/store/rule.js';import{sheetSetRaw}from'./src/store/sheet.js';import{sheetShow}from'./src/store/visibility.js';const{db}=openSession();ruleUpsert(db,{name:'战斗硬着陆',content:'战斗失败必须照后果结算,不得救场'});sheetSetRaw(db,'玩家','HP','30');sheetShow(db,'玩家');console.log('灌注完成');"
```
Expected: 打出"灌注完成"。

- [ ] **Step 2: init 一个临时项目**

```bash
PROJ=$(mktemp -d); cd "$PROJ"
npx --prefix /home/mulei_sy/anko-driver dicelore init harness-test || (cd /home/mulei_sy/anko-driver/packages/core && npx tsx src/cli.ts init harness-test)
ls -R "$PROJ/.claude"
```
Expected: 见 `.claude/settings.json`、`.claude/skills/dicelore-gm-core/`、四 `dicelore-flow-*`。

- [ ] **Step 3: 烟测三 hook 入口(脱 CC、直跑)**

```bash
cd /home/mulei_sy/anko-driver/packages/core
echo '{}' | node --import tsx src/adapter/hooks/session-start.ts
echo '{"prompt":"我要发起战斗"}' | node --import tsx src/adapter/hooks/turn-start.ts
echo '{"stop_hook_active":false}' | node --import tsx src/adapter/hooks/turn-end.ts
```
Expected:
- session-start:JSON 含 GM 身份 additionalContext。
- turn-start:JSON additionalContext 含"照后果结算"(rule 召回命中)。
- turn-end:`{"decision":"block","reason":"...resolve_choice..."}`(本轮无 choice、非终局)。

- [ ] **Step 4: 在 init 过的项目里跑真实 Claude Code 主持一局**

手动:`cd "$PROJ" && claude`,扮演玩家走一轮("我要发起战斗"),核对:
- 开局 SessionStart 注入 GM 身份/Agenda 可见。
- 战斗输入触发 UserPromptSubmit 注入战斗 rule。
- AI 走 `resolve_contest`/`narrate`;若某轮不给 choice 且非终局 → Stop block 唤回。
- `npx tsx src/cli.ts inspect harness-test` 查 event:有 narrate/verdict/choice。
- 对该 .db 跑 `buildPresentationModel` 手查机械回显/状态菜单/待选项按 visible 正确。

- [ ] **Step 5: 记录手验结果**

把 Step 3/4 的实际输出贴进 PR/commit 说明或一个 `docs/superpowers/plans/` 旁注;失败项回对应 Task 修。**北极星达成 = 三 hook 注入生效 + choice 物化 + 缺 choice 被 block + 呈现模型按 visible 正确。**

---

## 自审记录(已对 spec 逐节核对)

- **§1 包布局**:Task 1(present)/2(skills)/3-8(adapter)/cli 接线全覆盖。
- **§2 呈现模型**:Task 1,含可见性判定(visible=1 ∨ __show_all∧≠2)、本轮区间、pendingChoice。
- **§3 三 hook**:Task 5(SessionStart)/6(UserPromptSubmit)/7(Stop);跨端铁律落 Task 3 templates(node exec form + tsx)。
- **§4 L3 两档**:Task 4(纯函数)+ Task 7(装配落 note/block)。
- **§5 init**:Task 3(模板)+ Task 8(落地);hook resolve core 方案已定(包内绝对路径 + node --import tsx)。
- **§6 Skills 草稿 + 测试策略**:Task 2(草稿 + 结构校验);TDD 覆盖 present/l3/templates/sessionContext/ruleRecall/turnEnd/init;eval 出本期(未建 Task,符合范围)。
- **§7 北极星验证**:Task 9。
- **§8 构建顺序**:波1=Task1-3、波2=Task4-7、波3=Task8-9。
- **不在范围**:快照接线在 Task 6/7 留 TODO 注释占位;玩家壳/eval/manifest 选 skill/语义裁判 未建 Task(符合 spec §0)。
- **类型一致性**:`PresentationModel`/`L3Input`/`L3Result`/`runTurnEnd` 跨 Task 引用一致;hook 入口统一 `node --import tsx <abs>.ts`、stdin/stdout JSON。
