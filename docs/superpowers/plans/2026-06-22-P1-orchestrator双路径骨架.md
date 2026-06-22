# P1 · orchestrator 双路径骨架重构 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有 dice-only 的 orchestrator 内部重排成「边(`api/`) / 宿主级共享(`pkg/`) / 路径专属(`dice/`)」三分布局，抽出 `Session`/`Agent`/`SessionRegistry` 接口与 `streamDriverTurn`/`WsHub` 共享原语，为 lore 路径(P5)留好接缝——**行为完全不变，现有测试全绿**。

**Architecture:** 纯重构(rename + move + import 重连 + 接口抽取)，零新业务逻辑。`packages/core` 引擎边界不动([BD-11](../specs/2026-06-22-后端双路径架构-design.md))。dice 专属码(SessionHost/AgentSdkDriver/live/*)收进 `dice/` 并改名(DiceSession/DiceGm/...)；两路径共吃的接口与原语进 `pkg/`。每个 Task 末跑全套测试确认零行为漂移。

**Tech Stack:** TypeScript ESM(`.js` import 后缀)、Hono、ws、vitest、`@dicelore/core`、`@dicelore/shared`。

## Global Constraints

- **行为不变(承重)**：本 plan 不改任何运行时行为/路由/消息协议——`/sessions/*` 路由、WS `/sessions/:id/ws`、消息类型全保持原样。验证靠**现有测试套不改断言地全绿**。路由改 `/play/*` 等是后续事(会动前端),不在 P1。
- **每个 `.ts` 文件头**保留 AGPL 版权注释块(照抄现有文件 1-8 行)。
- **`import` 用 `.js` 后缀**(ESM NodeNext)。
- **测试命令**：`cd apps/orchestrator && npx vitest run`(全套)；类型检查 `npx tsc --noEmit`。每个 Task 末两者都跑、都绿才提交。
- **移动文件用 `git mv`** 保留历史；移动后只改 import 路径与符号名,**不动逻辑**。
- **`pkg/` 不依赖 `dice/`**(单向：`api/`→`pkg/`+`dice/`；`dice/`→`pkg/`；`pkg/` 自足)。构造 path-specific 对象(DiceSession)由调用方做,`pkg/` 只持有接口与泛型原语。
- 命名：`pkg/` 暂用此名(spec §7.4 留了 `kernel/` 备选,本 plan 用 `pkg/`,改名是后续纯重命名,不阻塞)。

---

## 文件结构(重构后 orchestrator src)

```
apps/orchestrator/src/
├── api/
│   ├── dice.ts          # createApp + createDiceApp(原 createLiveApp)——/sessions 路由(路由路径不变)
│   └── ws.ts            # attachWsUpgrade(ws 升级处理,从 startServer 抽出)
├── pkg/
│   ├── agent.ts         # Agent 接口 + TurnInput + TurnEvent(原 gm/GmDriver.ts)
│   ├── session.ts       # Session 接口 + SessionKind(新)
│   ├── registry.ts      # SessionRegistry<S> 接口 + InMemorySessionRegistry<S>(泛型,path-agnostic)
│   ├── streamTurn.ts    # streamDriverTurn(从 turnLoop 抽出的瘦流式 helper,新)
│   └── wsHub.ts         # WsHub + WsLike(原 live/ws.ts,逐字)
├── dice/
│   ├── DiceGm.ts        # 原 gm/AgentSdkDriver.ts(class AgentSdkDriver→DiceGm)
│   ├── FakeDiceGm.ts    # 原 gm/FakeGmDriver.ts(class FakeGmDriver→FakeDiceGm)
│   ├── DiceSession.ts   # 原 session/SessionHost.ts(class SessionHost→DiceSession, implements Session)
│   ├── registry.ts      # dice 专属单例 + getOrCreateHost/getHost(背后是 InMemorySessionRegistry<DiceSession>)
│   ├── turnLoop.ts      # 原 live/turnLoop.ts(runTurn 改调 streamDriverTurn)
│   ├── rollGate.ts      # 原 live/rollGate.ts(逐字)
│   ├── notify.ts        # 原 live/notify.ts(逐字)
│   ├── recovery.ts      # 原 recovery.ts(逐字,改 import 路径)
│   ├── presentation.ts  # 原 presentation.ts(逐字)
│   └── sessions.ts      # 原 sessions.ts(逐字)——dice 局列表
└── server.ts            # startServer 组装(import 路径更新 + 用 api/ws.ts)
```

> `gm/`、`live/`、`session/` 三个旧目录在重构后清空删除。

---

### Task 1: agent 层 — `pkg/agent.ts` + `dice/DiceGm.ts` + `dice/FakeDiceGm.ts`

把 GM driver 接口改名 `GmDriver`→`Agent` 移入 `pkg/`,两个实现移入 `dice/` 并改名。这是命名重定的根(后续 Task 都依赖 `pkg/agent.js`)。

**Files:**
- Create: `apps/orchestrator/src/pkg/agent.ts`(原 `gm/GmDriver.ts` 内容,`GmDriver`→`Agent`)
- Create: `apps/orchestrator/src/dice/DiceGm.ts`(原 `gm/AgentSdkDriver.ts`)
- Create: `apps/orchestrator/src/dice/FakeDiceGm.ts`(原 `gm/FakeGmDriver.ts`)
- Delete: `gm/GmDriver.ts`、`gm/AgentSdkDriver.ts`、`gm/FakeGmDriver.ts`
- Move tests: `gm/FakeGmDriver.test.ts`→`dice/FakeDiceGm.test.ts`、`gm/AgentSdkDriver.live.test.ts`→`dice/DiceGm.live.test.ts`
- Modify(改 import + 符号): `live/turnLoop.ts`、`session/SessionHost.ts`、`server.ts`

**Interfaces:**
- Produces: `interface Agent { runTurn(input: TurnInput): AsyncIterable<TurnEvent> }`、`interface TurnInput { text: string }`、`type TurnEvent`(三态,同原)；`class DiceGm implements Agent`(`DiceGmDeps`)、`class FakeDiceGm implements Agent`。
- Consumes: 无(根)。

- [ ] **Step 1: 建 `pkg/agent.ts`**

Create `apps/orchestrator/src/pkg/agent.ts`(AGPL 头 + 下列；仅接口名 `GmDriver`→`Agent`):

```ts
export interface TurnInput { text: string }

export type TurnEvent =
  | { type: "narration"; text: string } // 一段散文(Phase 1 = narrate 工具调用粒度)
  | { type: "turn_end" } // GM 本回合自然结束
  | { type: "error"; message: string }; // 驱动/SDK 错误

export interface Agent {
  runTurn(input: TurnInput): AsyncIterable<TurnEvent>;
}
```

- [ ] **Step 2: `git mv` 两个实现到 `dice/` 并改名**

```bash
cd apps/orchestrator
mkdir -p src/dice
git mv src/gm/AgentSdkDriver.ts src/dice/DiceGm.ts
git mv src/gm/FakeGmDriver.ts src/dice/FakeDiceGm.ts
git mv src/gm/AgentSdkDriver.live.test.ts src/dice/DiceGm.live.test.ts
git mv src/gm/FakeGmDriver.test.ts src/dice/FakeDiceGm.test.ts
git rm src/gm/GmDriver.ts
```

- [ ] **Step 3: 改 `dice/DiceGm.ts`**

import 行与类名改为:

```ts
import type { Agent, TurnInput, TurnEvent } from "../pkg/agent.js";

export interface DiceGmDeps {
  mcpServer: McpServer; // DiceSession 的 in-process MCP(已注入 onCanonWrite/rollGate)
  model?: string; // 默认 env DICELORE_GM_MODEL ?? "opus"
  systemPrompt?: string; // gm-core 教条(组件3);Phase 1 可选
}

export class DiceGm implements Agent {
  constructor(private deps: DiceGmDeps) {}
  // runTurn 方法体逐字不变(仅类名/Deps 名已改)
```

(其余 `runTurn` 实现、`query` import、`McpServer` import 保持原样。)

- [ ] **Step 4: 改 `dice/FakeDiceGm.ts`**

```ts
import type { Agent, TurnInput, TurnEvent } from "../pkg/agent.js";

type Script = TurnEvent[] | ((input: TurnInput) => TurnEvent[]);

export class FakeDiceGm implements Agent {
  constructor(private script: Script) {}
  async *runTurn(input: TurnInput): AsyncIterable<TurnEvent> {
    const events = typeof this.script === "function" ? this.script(input) : this.script;
    for (const e of events) yield e;
  }
}
```

- [ ] **Step 5: 改测试 import**

- `dice/FakeDiceGm.test.ts`:`import { FakeGmDriver } from "./FakeGmDriver.js"` → `import { FakeDiceGm } from "./FakeDiceGm.js"`；`import type { TurnEvent } from "./GmDriver.js"` → `from "../pkg/agent.js"`；正文 `FakeGmDriver`→`FakeDiceGm`。
- `dice/DiceGm.live.test.ts`:`AgentSdkDriver`→`DiceGm`、import 路径 `./AgentSdkDriver.js`→`./DiceGm.js`(该 import 在文件内)；若引用 `GmDriver` 类型改 `../pkg/agent.js`。

- [ ] **Step 6: 改其余 importer(临时跨目录,Task 2-7 再收拢)**

- `live/turnLoop.ts:12`:`import type { GmDriver, TurnInput } from "../gm/GmDriver.js"` → `import type { Agent, TurnInput } from "../pkg/agent.js"`；正文 `GmDriver`→`Agent`(`RunTurnDeps.driver` 类型)。
- `session/SessionHost.ts:16`:`import type { GmDriver } from "../gm/GmDriver.js"` → `import type { Agent } from "../pkg/agent.js"`；正文 `GmDriver`→`Agent`(`SessionHostDeps.driverFactory` 返回类型)。
- `server.ts`:`import type { GmDriver } from "./gm/GmDriver.js"`→`import type { Agent } from "./pkg/agent.js"`；`import { AgentSdkDriver } from "./gm/AgentSdkDriver.js"`→`import { DiceGm } from "./dice/DiceGm.js"`；`import { FakeGmDriver } from "./gm/FakeGmDriver.js"`→`import { FakeDiceGm } from "./dice/FakeDiceGm.js"`；正文 `GmDriver`→`Agent`、`new AgentSdkDriver(`→`new DiceGm(`、`new FakeGmDriver(`→`new FakeDiceGm(`。
- `server.live.test.ts:12`:`import { FakeGmDriver } from "./gm/FakeGmDriver.js"`→`import { FakeDiceGm } from "./dice/FakeDiceGm.js"`；正文 `FakeGmDriver`→`FakeDiceGm`。

- [ ] **Step 7: 全套测试 + 类型检查绿**

Run: `cd apps/orchestrator && npx vitest run && npx tsc --noEmit`
Expected: 全 PASS、类型零错误(`gm/` 目录已空)。

- [ ] **Step 8: 提交**

```bash
git add -A apps/orchestrator/src
git commit -m "refactor(orchestrator): Agent 接口入 pkg/、DiceGm/FakeDiceGm 入 dice/(改名,行为不变)"
```

---

### Task 2: `pkg/wsHub.ts` — 移 `live/ws.ts`

`WsHub`/`WsLike` 是两路径共吃的传输原语,逐字移入 `pkg/`。

**Files:**
- Move: `live/ws.ts`→`pkg/wsHub.ts`(内容逐字不变)
- Move test: `live/ws.test.ts`→`pkg/wsHub.test.ts`
- Modify(改 import 路径): `session/SessionHost.ts`、`live/rollGate.ts`、`live/turnLoop.ts`、`recovery.ts`、`live/rollGate.test.ts`、`live/turnLoop.test.ts`、`recovery.test.ts`

**Interfaces:**
- Produces: `class WsHub`、`interface WsLike`(同原,路径变 `pkg/wsHub.js`)。
- Consumes: 无。

- [ ] **Step 1: `git mv`**

```bash
cd apps/orchestrator
mkdir -p src/pkg
git mv src/live/ws.ts src/pkg/wsHub.ts
git mv src/live/ws.test.ts src/pkg/wsHub.test.ts
```

- [ ] **Step 2: 改 `pkg/wsHub.test.ts` 自引用**

`import { WsHub } from "./ws.js"` → `import { WsHub } from "./wsHub.js"`。

- [ ] **Step 3: 改所有 importer 路径**

逐个把 `ws.js` 引用改向 `pkg/wsHub.js`:
- `session/SessionHost.ts:12`:`from "../live/ws.js"` → `from "../pkg/wsHub.js"`。
- `live/rollGate.ts:12`:`from "./ws.js"` → `from "../pkg/wsHub.js"`。
- `live/turnLoop.ts:13`:`from "./ws.js"` → `from "../pkg/wsHub.js"`。
- `recovery.ts:13`:`from "./live/ws.js"` → `from "./pkg/wsHub.js"`。
- `live/rollGate.test.ts:12`:`from "./ws.js"` → `from "../pkg/wsHub.js"`。
- `live/turnLoop.test.ts:13`:`from "./ws.js"` → `from "../pkg/wsHub.js"`。
- `recovery.test.ts:12`:`from "./live/ws.js"` → `from "./pkg/wsHub.js"`。

- [ ] **Step 4: 全套测试 + 类型检查绿**

Run: `cd apps/orchestrator && npx vitest run && npx tsc --noEmit`
Expected: 全 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A apps/orchestrator/src
git commit -m "refactor(orchestrator): WsHub 移入 pkg/wsHub(逐字,改 import 路径)"
```

---

### Task 3: `pkg/streamTurn.ts`(抽出瘦流式 helper) + `dice/turnLoop.ts`

从 `turnLoop.runTurn` 抽出与回合末 hook 无关的「驱动 Agent → 广播 turn_started/narration_commit/error」核心成 `streamDriverTurn`(两路径共吃,lore P5 也要看 agent 流式产出);`runTurn` 改调它 + 跑 dice 专属 turn-end。**行为不变**(现有 turnLoop 测试不改断言地绿)。这是旧设计 §1 harvest 的瘦流式 helper。

**Files:**
- Create: `apps/orchestrator/src/pkg/streamTurn.ts`(新)
- Create: `apps/orchestrator/src/pkg/streamTurn.test.ts`(新)
- Move + refactor: `live/turnLoop.ts`→`dice/turnLoop.ts`(`runTurn` 改调 `streamDriverTurn`)
- Move test: `live/turnLoop.test.ts`→`dice/turnLoop.test.ts`
- Modify(改 import 路径): `session/SessionHost.ts`

**Interfaces:**
- Produces:
  - `interface StreamTurnDeps { driver: Agent; hub: WsHub; sessionId: string; turnId: string }`
  - `streamDriverTurn(deps: StreamTurnDeps, input: TurnInput): Promise<{ seq: number; errored: boolean }>` — 发 `turn_started` + 逐条 `narration_commit`;遇 error 发 `error` 并返回 `errored:true`;**不发 `turn_ended`**(留调用者)。
  - `dice/turnLoop.ts`:`runTurn(deps: RunTurnDeps, input): Promise<void>`、`interface RunTurnDeps`、`interface TurnEndResult`(签名同原)。
- Consumes: `Agent`/`TurnInput`(`pkg/agent.js`,T1)、`WsHub`(`pkg/wsHub.js`,T2)。

- [ ] **Step 1: 写 `pkg/streamTurn.test.ts`(失败测试)**

Create `apps/orchestrator/src/pkg/streamTurn.test.ts`(AGPL 头 +):

```ts
import { describe, it, expect } from "vitest";
import { WsHub } from "./wsHub.js";
import { streamDriverTurn } from "./streamTurn.js";
import { FakeDiceGm } from "../dice/FakeDiceGm.js";

describe("streamDriverTurn", () => {
  it("广播 turn_started + narration,返回 seq,不发 turn_ended", async () => {
    const hub = new WsHub();
    const sent: { type: string }[] = [];
    hub.add("s1", { send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 } as never);
    const driver = new FakeDiceGm(() => [{ type: "narration", text: "一段散文" }, { type: "turn_end" }]);
    const r = await streamDriverTurn({ driver, hub, sessionId: "s1", turnId: "s1-t1" }, { text: "hi" });
    expect(r).toEqual({ seq: 1, errored: false });
    const types = sent.map((m) => m.type);
    expect(types).toContain("turn_started");
    expect(types).toContain("narration_commit");
    expect(types).not.toContain("turn_ended");
  });

  it("driver error → errored:true", async () => {
    const hub = new WsHub();
    const driver = new FakeDiceGm(() => [{ type: "error", message: "boom" }]);
    const r = await streamDriverTurn({ driver, hub, sessionId: "s2", turnId: "t" }, { text: "x" });
    expect(r.errored).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd apps/orchestrator && npx vitest run src/pkg/streamTurn.test.ts`
Expected: FAIL(`Cannot find module './streamTurn.js'`)

- [ ] **Step 3: 实现 `pkg/streamTurn.ts`**

Create `apps/orchestrator/src/pkg/streamTurn.ts`(AGPL 头 +):

```ts
import { CLIENT_PROTOCOL, type StreamMessage } from "@dicelore/shared";
import type { Agent, TurnInput } from "./agent.js";
import type { WsHub } from "./wsHub.js";

export interface StreamTurnDeps {
  driver: Agent;
  hub: WsHub;
  sessionId: string;
  turnId: string;
}

// 驱动 Agent 事件流 → 广播 turn_started + 逐条 narration_commit;遇 error 发 error 并返回 errored。
// 不发 turn_ended——回合收尾由调用者按场景决定(dice 跑 turn-end hook,lore 直接结束)。
export async function streamDriverTurn(deps: StreamTurnDeps, input: TurnInput): Promise<{ seq: number; errored: boolean }> {
  const { hub, sessionId, turnId } = deps;
  const send = (m: StreamMessage) => hub.broadcast(sessionId, m);
  send({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId });
  let seq = 0;
  try {
    for await (const ev of deps.driver.runTurn(input)) {
      if (ev.type === "narration") {
        seq += 1;
        send({ protocol: CLIENT_PROTOCOL, type: "narration_commit", seq, text: ev.text });
      } else if (ev.type === "error") {
        send({ protocol: CLIENT_PROTOCOL, type: "error", code: "gm_error", message: ev.message });
        return { seq, errored: true };
      } else if (ev.type === "turn_end") {
        break;
      }
    }
  } catch (e) {
    send({ protocol: CLIENT_PROTOCOL, type: "error", code: "driver_error", message: e instanceof Error ? e.message : String(e) });
    return { seq, errored: true };
  }
  return { seq, errored: false };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd apps/orchestrator && npx vitest run src/pkg/streamTurn.test.ts`
Expected: PASS(2 用例)

- [ ] **Step 5: `git mv` turnLoop 入 dice/ + 改 import**

```bash
cd apps/orchestrator
git mv src/live/turnLoop.ts src/dice/turnLoop.ts
git mv src/live/turnLoop.test.ts src/dice/turnLoop.test.ts
```

改 `dice/turnLoop.ts` import 区(顶部):

```ts
import { CLIENT_PROTOCOL, type StreamMessage } from "@dicelore/shared";
import type { DB } from "@dicelore/core";
import type { Agent, TurnInput } from "../pkg/agent.js";
import type { WsHub } from "../pkg/wsHub.js";
import { streamDriverTurn } from "../pkg/streamTurn.js";
```

`RunTurnDeps`/`TurnEndResult` 定义不变(`driver: Agent`)。`runTurn` 函数体替换为(复用 helper):

```ts
export async function runTurn(deps: RunTurnDeps, input: TurnInput): Promise<void> {
  const { seq, errored } = await streamDriverTurn(deps, input);
  if (errored) return;
  const send = (m: StreamMessage) => deps.hub.broadcast(deps.sessionId, m);
  const res = deps.runTurnEnd(deps.db);
  if (res.choices) send({ protocol: CLIENT_PROTOCOL, type: "choices", choices: res.choices });
  send({ protocol: CLIENT_PROTOCOL, type: "turn_ended", turnId: deps.turnId, seq });
}
```

- [ ] **Step 6: 改 `dice/turnLoop.test.ts` import**

`from "./turnLoop.js"` 保持(同目录);`import { FakeGmDriver } from "../gm/FakeGmDriver.js"` → `import { FakeDiceGm } from "./FakeDiceGm.js"`(已同 dice/ 目录),正文 `FakeGmDriver`→`FakeDiceGm`;`import { WsHub } from "./ws.js"` → `from "../pkg/wsHub.js"`。

- [ ] **Step 7: 改 `session/SessionHost.ts` import**

`import { runTurn, type TurnEndResult } from "../live/turnLoop.js"` → `from "../dice/turnLoop.js"`。

- [ ] **Step 8: 全套测试 + 类型检查绿**

Run: `cd apps/orchestrator && npx vitest run && npx tsc --noEmit`
Expected: 全 PASS(含原 turnLoop 测试回归 + 新 streamTurn 2 用例)。

- [ ] **Step 9: 提交**

```bash
git add -A apps/orchestrator/src
git commit -m "refactor(orchestrator): 抽出 streamDriverTurn 入 pkg/、turnLoop 入 dice/(行为不变)"
```

---

### Task 4: `dice/rollGate.ts` + `dice/notify.ts` — 移 dice 专属横切

`PlayerRollGate`(明骰门)与 `mapCanonWrite`(规范写→流消息)是 dice 跑团专属,逐字移入 `dice/`。

**Files:**
- Move: `live/rollGate.ts`→`dice/rollGate.ts`、`live/notify.ts`→`dice/notify.ts`(逐字)
- Move tests: `live/rollGate.test.ts`→`dice/rollGate.test.ts`、`live/notify.test.ts`→`dice/notify.test.ts`
- Modify(改 import 路径): `session/SessionHost.ts`、`recovery.ts`

**Interfaces:**
- Produces: `class PlayerRollGate`、`mapCanonWrite`(同原,路径变 `dice/`)。
- Consumes: `WsHub`(`pkg/wsHub.js`)。

- [ ] **Step 1: `git mv`**

```bash
cd apps/orchestrator
git mv src/live/rollGate.ts src/dice/rollGate.ts
git mv src/live/rollGate.test.ts src/dice/rollGate.test.ts
git mv src/live/notify.ts src/dice/notify.ts
git mv src/live/notify.test.ts src/dice/notify.test.ts
```

此时 `live/` 应已空,删除目录(若残留空目录):`rmdir src/live 2>/dev/null || true`。

- [ ] **Step 2: 改 `dice/rollGate.ts` import**

`import type { WsHub } from "./ws.js"` → `from "../pkg/wsHub.js"`。

- [ ] **Step 3: 改 `dice/rollGate.test.ts` import**

`import { WsHub } from "./ws.js"` → `from "../pkg/wsHub.js"`;`import { PlayerRollGate } from "./rollGate.js"` 保持(同目录)。

- [ ] **Step 4: 改 `dice/notify.test.ts` import**

`import { mapCanonWrite } from "./notify.js"` 保持(同目录)。(notify.ts 本身无相对 import,无需改。)

- [ ] **Step 5: 改 `session/SessionHost.ts` import**

- `import { PlayerRollGate } from "../live/rollGate.js"` → `from "../dice/rollGate.js"`。
- `import { mapCanonWrite } from "../live/notify.js"` → `from "../dice/notify.js"`。

- [ ] **Step 6: 改 `recovery.ts` + `recovery.test.ts` import**

- `recovery.ts:12`:`import type { PlayerRollGate } from "./live/rollGate.js"` → `from "./dice/rollGate.js"`。(recovery.ts 的 WsHub import 已在 T2 改成 `./pkg/wsHub.js`。)
- `recovery.test.ts:13`:`import { PlayerRollGate } from "./live/rollGate.js"` → `from "./dice/rollGate.js"`。(其 WsHub import 已在 T2 改成 `./pkg/wsHub.js`。)

- [ ] **Step 7: 全套测试 + 类型检查绿**

Run: `cd apps/orchestrator && npx vitest run && npx tsc --noEmit`
Expected: 全 PASS。

- [ ] **Step 8: 提交**

```bash
git add -A apps/orchestrator/src
git commit -m "refactor(orchestrator): rollGate/notify 移入 dice/(逐字,改 import)"
```

---

### Task 5: session 层 — `pkg/session.ts` + `pkg/registry.ts` + `dice/DiceSession.ts` + `dice/registry.ts`

抽 `Session` 接口与泛型 `SessionRegistry`(path-agnostic,多租户/跨机接入点)入 `pkg/`;`SessionHost`→`DiceSession`(implements Session)移入 `dice/`;dice 专属 registry 单例背靠泛型 InMemory 实现。

**Files:**
- Create: `apps/orchestrator/src/pkg/session.ts`(新)
- Create: `apps/orchestrator/src/pkg/registry.ts`(新,泛型)
- Create: `apps/orchestrator/src/pkg/registry.test.ts`(新)
- Move + rename: `session/SessionHost.ts`→`dice/DiceSession.ts`(`SessionHost`→`DiceSession`、`SessionHostDeps`→`DiceSessionDeps`、implements Session)
- Move + rewrite: `session/registry.ts`→`dice/registry.ts`(背靠 InMemorySessionRegistry)
- Move test: `session/SessionHost.test.ts`→`dice/DiceSession.test.ts`
- Modify(改 import): `server.ts`

**Interfaces:**
- Produces:
  - `type SessionKind = "dice" | "lore"`;`interface Session { readonly sessionId: string; readonly kind: SessionKind }`(P1 最小契约——见下注)
  - `interface SessionRegistry<S extends Session = Session> { getOrCreate(id: string, create: () => S): S; get(id: string): S | undefined }`
  - `class InMemorySessionRegistry<S extends Session = Session> implements SessionRegistry<S>`
  - `class DiceSession implements Session`(`sessionId`、`kind="dice"`、`DiceSessionDeps`、原 SessionHost 全部成员)
  - `dice/registry.ts`:`getOrCreateHost(sessionId, deps: DiceSessionDeps): DiceSession`、`getHost(sessionId): DiceSession | undefined`(签名同原,实现委托 InMemorySessionRegistry)
- Consumes: `Agent`(`pkg/agent.js`)、其余 core/shared 同原 SessionHost。

> **P1 narrowing(注)**：spec §7.3 的 `Session` 含 `start()/stop()`;但现有 SessionHost 构造即就绪、无显式生命周期。为 behavior-preserving,P1 的 `Session` 只立**身份契约**(`sessionId`+`kind`),`start/stop` 等生命周期待 LoreSession(P5)/跨机实现需要时再加。这是有意的最小子集,不是遗漏。

- [ ] **Step 1: 建 `pkg/session.ts`**

Create `apps/orchestrator/src/pkg/session.ts`(AGPL 头 +):

```ts
export type SessionKind = "dice" | "lore";

// 运行单元最小身份契约。生命周期(start/stop)待跨机/lore 实现需要时扩(spec §7.3)。
export interface Session {
  readonly sessionId: string;
  readonly kind: SessionKind;
}
```

- [ ] **Step 2: 写 `pkg/registry.test.ts`(失败测试)**

Create `apps/orchestrator/src/pkg/registry.test.ts`(AGPL 头 +):

```ts
import { describe, it, expect } from "vitest";
import { InMemorySessionRegistry } from "./registry.js";
import type { Session } from "./session.js";

const mk = (id: string): Session => ({ sessionId: id, kind: "dice" });

describe("InMemorySessionRegistry", () => {
  it("getOrCreate 首次建、二次复用同实例", () => {
    const reg = new InMemorySessionRegistry<Session>();
    let calls = 0;
    const a = reg.getOrCreate("s1", () => { calls += 1; return mk("s1"); });
    const b = reg.getOrCreate("s1", () => { calls += 1; return mk("s1"); });
    expect(a).toBe(b);
    expect(calls).toBe(1);
  });
  it("get 未知返回 undefined", () => {
    expect(new InMemorySessionRegistry<Session>().get("x")).toBeUndefined();
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `cd apps/orchestrator && npx vitest run src/pkg/registry.test.ts`
Expected: FAIL(`Cannot find module './registry.js'`)

- [ ] **Step 4: 实现 `pkg/registry.ts`**

Create `apps/orchestrator/src/pkg/registry.ts`(AGPL 头 +):

```ts
import type { Session } from "./session.js";

// 会话注册表:多租户/跨机接入点。构造 path-specific 会话由调用方经 create 回调做,
// 注册表本身 path-agnostic(不 import 任何路径实现)。P1 只 InMemory 单机实现。
export interface SessionRegistry<S extends Session = Session> {
  getOrCreate(sessionId: string, create: () => S): S;
  get(sessionId: string): S | undefined;
}

export class InMemorySessionRegistry<S extends Session = Session> implements SessionRegistry<S> {
  private map = new Map<string, S>();
  getOrCreate(sessionId: string, create: () => S): S {
    let s = this.map.get(sessionId);
    if (!s) { s = create(); this.map.set(sessionId, s); }
    return s;
  }
  get(sessionId: string): S | undefined { return this.map.get(sessionId); }
}
```

- [ ] **Step 5: 运行确认通过**

Run: `cd apps/orchestrator && npx vitest run src/pkg/registry.test.ts`
Expected: PASS(2 用例)

- [ ] **Step 6: `git mv` SessionHost→DiceSession + 改名/implements**

```bash
cd apps/orchestrator
git mv src/session/SessionHost.ts src/dice/DiceSession.ts
git mv src/session/SessionHost.test.ts src/dice/DiceSession.test.ts
```

改 `dice/DiceSession.ts`:import 区(WsHub/rollGate/notify/turnLoop 路径在前序 Task 已分别就位,本 Task 校正到 dice/相对 + pkg/);加 `Session` import;类改名 + implements:

```ts
import { openDb, initSchema, createMcpServer, buildPresentationModel, runTurnEnd, type DB, type CanonWriteEvent } from "@dicelore/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WsHub, type WsLike } from "../pkg/wsHub.js";
import type { Agent } from "../pkg/agent.js";
import type { Session } from "../pkg/session.js";
import { PlayerRollGate } from "./rollGate.js";
import { mapCanonWrite } from "./notify.js";
import { runTurn, type TurnEndResult } from "./turnLoop.js";

export interface DiceSessionDeps {
  db?: DB;
  driverFactory: (host: DiceSession) => Agent;
}

export class DiceSession implements Session {
  readonly kind = "dice" as const;
  readonly db: DB;
  readonly hub = new WsHub();
  readonly gate: PlayerRollGate;
  readonly mcpServer: McpServer;
  constructor(public sessionId: string, private deps: DiceSessionDeps) {
    // 构造体逐字不变(driverFactory 形参类型已为 DiceSession)
```

(其余成员 `onCanonWrite`/`attachWs`/`detachWs`/`handleMessage`/`handleRoll`/`turnEnd` 逐字不变;`handleMessage` 内 `this.deps.driverFactory(this)` 不变。)

- [ ] **Step 7: 改 `dice/DiceSession.test.ts` import**

`import { SessionHost } from "./SessionHost.js"` → `import { DiceSession } from "./DiceSession.js"`;`import { FakeGmDriver } from "../gm/FakeGmDriver.js"` → `import { FakeDiceGm } from "./FakeDiceGm.js"`;正文 `SessionHost`→`DiceSession`、`FakeGmDriver`→`FakeDiceGm`。

- [ ] **Step 8: 重写 `dice/registry.ts`(委托 InMemorySessionRegistry)**

```bash
git mv src/session/registry.ts src/dice/registry.ts
rmdir src/session 2>/dev/null || true
```

`dice/registry.ts` 内容改为:

```ts
import { InMemorySessionRegistry } from "../pkg/registry.js";
import { DiceSession, type DiceSessionDeps } from "./DiceSession.js";

// dice 跑团会话单例注册表(背靠泛型 InMemory 实现)。签名同原,server 调用方不变。
const registry = new InMemorySessionRegistry<DiceSession>();

export function getOrCreateHost(sessionId: string, deps: DiceSessionDeps): DiceSession {
  return registry.getOrCreate(sessionId, () => new DiceSession(sessionId, deps));
}
export function getHost(sessionId: string): DiceSession | undefined { return registry.get(sessionId); }
```

- [ ] **Step 9: 改 `server.ts` import**

- `import { getOrCreateHost, getHost } from "./session/registry.js"` → `from "./dice/registry.js"`。
- `import type { SessionHost } from "./session/SessionHost.js"` → `import type { DiceSession } from "./dice/DiceSession.js"`;正文所有 `SessionHost`→`DiceSession`(`LiveDeps.driverFactory`、`hostDeps`、`startServer` 内的 driverFactory 类型注解)。

- [ ] **Step 10: 全套测试 + 类型检查绿**

Run: `cd apps/orchestrator && npx vitest run && npx tsc --noEmit`
Expected: 全 PASS(`session/` 目录已空删除)。

- [ ] **Step 11: 提交**

```bash
git add -A apps/orchestrator/src
git commit -m "refactor(orchestrator): Session/SessionRegistry 接口入 pkg/、DiceSession+dice registry 入 dice/"
```

---

### Task 6: 移 `recovery` / `presentation` / `sessions` 入 `dice/`

三者都是 dice 跑团专属(宕机恢复重弹掷骰卡 / 呈现快照 / 局列表),从 src 根移入 `dice/`。

**Files:**
- Move: `recovery.ts`→`dice/recovery.ts`、`presentation.ts`→`dice/presentation.ts`、`sessions.ts`→`dice/sessions.ts`(逐字)
- Move tests: `recovery.test.ts`→`dice/recovery.test.ts`、`presentation.test.ts`→`dice/presentation.test.ts`
- Modify(改 import 路径): `server.ts`、`server.test.ts`

**Interfaces:**
- Produces: `restagePendingRolls`、`buildSnapshot`、`listSessionSummaries`(同原,路径变 `dice/`)。
- Consumes: `PlayerRollGate`/`WsHub`(recovery)。

- [ ] **Step 1: `git mv`**

```bash
cd apps/orchestrator
git mv src/recovery.ts src/dice/recovery.ts
git mv src/recovery.test.ts src/dice/recovery.test.ts
git mv src/presentation.ts src/dice/presentation.ts
git mv src/presentation.test.ts src/dice/presentation.test.ts
git mv src/sessions.ts src/dice/sessions.ts
```

- [ ] **Step 2: 改 `dice/recovery.ts` import(现已同 dice/ 目录)**

- `import type { PlayerRollGate } from "./dice/rollGate.js"` → `from "./rollGate.js"`。
- `import type { WsHub } from "./pkg/wsHub.js"` → `from "../pkg/wsHub.js"`。

- [ ] **Step 3: 改 `dice/recovery.test.ts` import**

- `import { WsHub } from "./pkg/wsHub.js"` → `from "../pkg/wsHub.js"`。
- `import { PlayerRollGate } from "./dice/rollGate.js"` → `from "./rollGate.js"`。
- `import { restagePendingRolls } from "./recovery.js"` 保持(同目录)。

> `dice/presentation.ts`/`dice/sessions.ts` 无相对 import,移动后无需改;`dice/presentation.test.ts` 的 `import { buildSnapshot } from "./presentation.js"` 同目录、保持。

- [ ] **Step 4: 改 `server.ts` import 路径**

- `import { buildSnapshot } from "./presentation.js"` → `from "./dice/presentation.js"`。
- `import { listSessionSummaries } from "./sessions.js"` → `from "./dice/sessions.js"`。
- `import { restagePendingRolls } from "./recovery.js"` → `from "./dice/recovery.js"`。

- [ ] **Step 5: 改 `server.test.ts` import 路径**

- `import { listSessionSummaries } from "./sessions.js"` → `from "./dice/sessions.js"`。
- (`import { createApp } from "./server.js"` 暂不动,T7 再改。)

- [ ] **Step 6: 全套测试 + 类型检查绿**

Run: `cd apps/orchestrator && npx vitest run && npx tsc --noEmit`
Expected: 全 PASS(src 根此时只剩 `server.ts` + 其测试)。

- [ ] **Step 7: 提交**

```bash
git add -A apps/orchestrator/src
git commit -m "refactor(orchestrator): recovery/presentation/sessions 移入 dice/"
```

---

### Task 7: 拆传输层 — `api/dice.ts` + `api/ws.ts` + 瘦身 `server.ts`

把 `server.ts` 里的 Hono app 工厂(`createApp`/`createLiveApp`,路由路径**不变**)移入 `api/dice.ts`,WS 升级处理抽成 `api/ws.ts` 的 `attachWsUpgrade`;`server.ts` 只剩 `startServer` 组装 + 直跑入口。

**Files:**
- Create: `apps/orchestrator/src/api/dice.ts`(`ServerDeps`/`createApp`/`LiveDeps`/`createLiveApp`,从 server.ts 搬,改 import 路径)
- Create: `apps/orchestrator/src/api/ws.ts`(`attachWsUpgrade`,从 startServer 抽出)
- Modify: `apps/orchestrator/src/server.ts`(只留 startServer + 直跑入口)
- Modify(改 import 路径): `server.test.ts`、`server.live.test.ts`

**Interfaces:**
- Produces:
  - `api/dice.ts`:`createApp(deps: ServerDeps): Hono`、`createLiveApp(deps: LiveDeps): Hono`、`interface ServerDeps`、`interface LiveDeps`(签名同原)。
  - `api/ws.ts`:`interface WsUpgradeDeps { openSession: (id: string) => DB; driverFactory: (host: DiceSession) => Agent }`、`attachWsUpgrade(server: unknown, deps: WsUpgradeDeps): void`。
  - `server.ts`:`startServer(port: number): void`(同原签名)。
- Consumes: `getOrCreateHost`/`getHost`(dice/registry)、`buildSnapshot`(dice/presentation)、`listSessionSummaries`(dice/sessions)、`restagePendingRolls`(dice/recovery)、`DiceSession`(dice/DiceSession)、`Agent`(pkg/agent)、`DiceGm`/`FakeDiceGm`(dice/)。

- [ ] **Step 1: 建 `api/dice.ts`**

Create `apps/orchestrator/src/api/dice.ts`(AGPL 头 +;把 server.ts 的 `ServerDeps`/`createApp`/`LiveDeps`/`createLiveApp` 整段搬来,import 区如下,函数体逐字不变):

```ts
import { Hono } from "hono";
import type { DB } from "@dicelore/core";
import type { SessionInfo, SessionSummary } from "@dicelore/shared";
import { MessageRequestSchema, ChoiceRequestSchema, RollRequestSchema } from "@dicelore/shared";
import { buildSnapshot } from "../dice/presentation.js";
import { getOrCreateHost, getHost } from "../dice/registry.js";
import type { DiceSession } from "../dice/DiceSession.js";
import type { Agent } from "../pkg/agent.js";

// ServerDeps + createApp + LiveDeps + createLiveApp —— 整段从原 server.ts 搬来,函数体不变。
// (createLiveApp 的 LiveDeps.driverFactory 类型 SessionHost→DiceSession;openSession/listSessions 同原。)
```

> 搬运时 `LiveDeps.driverFactory: (host: SessionHost) => GmDriver` 已在 T1/T5 改为 `(host: DiceSession) => Agent`;`ServerDeps`/`createApp` 不依赖这两者。路由字符串(`/sessions`、`/sessions/:id/...`)**逐字不变**。

- [ ] **Step 2: 建 `api/ws.ts`**

Create `apps/orchestrator/src/api/ws.ts`(AGPL 头 +):

```ts
import { WebSocketServer } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { DB } from "@dicelore/core";
import { getOrCreateHost } from "../dice/registry.js";
import { restagePendingRolls } from "../dice/recovery.js";
import type { DiceSession } from "../dice/DiceSession.js";
import type { Agent } from "../pkg/agent.js";

export interface WsUpgradeDeps {
  openSession: (id: string) => DB;
  driverFactory: (host: DiceSession) => Agent;
}

// dice 会话 WS 升级(/sessions/:id/ws)挂到 http server——从原 startServer 内联块抽出,行为不变。
export function attachWsUpgrade(server: unknown, deps: WsUpgradeDeps): void {
  const wss = new WebSocketServer({ noServer: true });
  (server as { on(ev: string, cb: (req: IncomingMessage, socket: Duplex, head: Buffer) => void): void }).on(
    "upgrade",
    (req, socket, head) => {
      const m = /^\/sessions\/([^/]+)\/ws$/.exec(req.url ?? "");
      if (!m) { socket.destroy(); return; }
      wss.handleUpgrade(req, socket, head, (ws) => {
        const id = decodeURIComponent(m[1]);
        const host = getOrCreateHost(id, { db: deps.openSession(id), driverFactory: deps.driverFactory });
        const wsLike = ws as unknown as { send(d: string): void; readyState: number };
        host.attachWs(wsLike);
        restagePendingRolls(host); // 重连/重启 → 重弹未决掷骰卡
        ws.on("close", () => host.detachWs(wsLike));
      });
    },
  );
}
```

- [ ] **Step 3: 瘦身 `server.ts`**

把 `server.ts` 整文件替换为(AGPL 头 +):

```ts
import { serve } from "@hono/node-server";
import { openDb, initSchema } from "@dicelore/core";
import { createLiveApp } from "./api/dice.js";
import { attachWsUpgrade } from "./api/ws.js";
import { listSessionSummaries } from "./dice/sessions.js";
import type { DiceSession } from "./dice/DiceSession.js";
import type { Agent } from "./pkg/agent.js";
import { DiceGm } from "./dice/DiceGm.js";
import { FakeDiceGm } from "./dice/FakeDiceGm.js";

export function startServer(port: number): void {
  const dir = process.env.DICELORE_SESSIONS_DIR ?? ".";
  const openSession = (id: string) => { const db = openDb(`${dir}/${id}.db`); initSchema(db); return db; };
  // DICELORE_FAKE_GM=1：脚本化假 GM(端到端测试,不烧 LLM)；否则真 Agent SDK。
  const driverFactory: (host: DiceSession) => Agent = process.env.DICELORE_FAKE_GM === "1"
    ? () => new FakeDiceGm((input) => [{ type: "narration", text: `（GM）你说：「${input.text}」。门吱呀一声开了。` }, { type: "turn_end" }])
    : (host) => new DiceGm({ mcpServer: host.mcpServer });

  const app = createLiveApp({ driverFactory, openSession, listSessions: () => listSessionSummaries(dir) });
  const server = serve({ fetch: app.fetch, port });
  attachWsUpgrade(server, { openSession, driverFactory });
  console.log(`[orchestrator] live :${port}`);
}

// tsx src/server.ts 直接起
if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  startServer(Number(process.env.PORT ?? 8787));
}
```

- [ ] **Step 4: 改 `server.test.ts` + `server.live.test.ts` import**

- `server.test.ts:15`:`import { createApp } from "./server.js"` → `from "./api/dice.js"`。(其 `listSessionSummaries` 已在 T6 改 `./dice/sessions.js`。)
- `server.live.test.ts:11`:`import { createLiveApp } from "./server.js"` → `from "./api/dice.js"`。(其 `FakeGmDriver`→`FakeDiceGm` 已在 T1 改。)

- [ ] **Step 5: 全套测试 + 类型检查绿**

Run: `cd apps/orchestrator && npx vitest run && npx tsc --noEmit`
Expected: 全 PASS、类型零错误。最终 src 根只剩 `server.ts`(+其两测试),`api/`/`pkg/`/`dice/` 三分到位。

- [ ] **Step 6: 提交**

```bash
git add -A apps/orchestrator/src
git commit -m "refactor(orchestrator): 拆 api/dice + api/ws,server.ts 仅留 startServer 组装"
```

---

## P1 验收

- [ ] **全量测试 + 类型检查(orchestrator)**

Run: `cd apps/orchestrator && npx vitest run && npx tsc --noEmit`
Expected: 全绿、类型零错误。

- [ ] **目录结构确认**

Run: `cd apps/orchestrator && find src -type f -name '*.ts' | sort`
Expected: 匹配「文件结构」节的三分布局;`gm/`、`live/`、`session/` 三旧目录不再存在。

- [ ] **行为不变确认**：所有现有测试**断言未改**(只改了 import 路径与符号名)。若任何断言被迫改动,说明行为漂移——停下排查。

**交付物**：orchestrator src 重排成 `api/`(薄路由) + `pkg/`(Session/Agent/SessionRegistry 接口 + streamDriverTurn + WsHub) + `dice/`(DiceSession/DiceGm/FakeDiceGm + 跑团横切)三分;命名重定(SessionHost→DiceSession、GmDriver→Agent、AgentSdkDriver→DiceGm、FakeGmDriver→FakeDiceGm);为 P5 LoreSession 与 P2 Catalog 留好 `pkg/` 共享接缝。**行为零变化**。

---

## Self-Review(写完核对)

- **spec 覆盖**：本 plan 实现 spec §7.4 目录布局(api/pkg/dice 三分)+ §7.2 命名重定 + §7.3 `Session`/`Agent`/`SessionRegistry` 接口(P1 取最小子集,Session 仅身份契约,见 T5 注)+ §9 keep 项「streamDriverTurn 抽出」。**未覆盖(按设计不在 P1)**：lore/ 目录(P5)、Catalog(P2)、路由改 `/play/*`(动前端,后续)、Session.start/stop(待 lore/跨机)。
- **占位扫描**：无 TBD;移动文件用 `git mv` + 显式 import 改写清单(每条给出 `行号:旧→新`);新/改逻辑文件(pkg/agent、pkg/streamTurn、pkg/session、pkg/registry、dice/turnLoop runTurn、api/ws、server.ts)给全码。
- **类型一致**：`Agent`/`TurnInput`/`TurnEvent`(pkg/agent)贯穿 DiceGm/FakeDiceGm/streamTurn/turnLoop/DiceSession;`DiceSession`/`DiceSessionDeps` 在 dice/registry、api/dice、api/ws、server.ts 一致;`SessionRegistry<S>` 泛型不 import 路径实现(pkg 不依赖 dice)。
- **依赖单向**：`api/`→`pkg/`+`dice/`;`dice/`→`pkg/`;`pkg/` 自足(registry 经 `create` 回调避免 import DiceSession)。✓

---

## 执行交接

Plan 完成,保存于 `docs/superpowers/plans/2026-06-22-P1-orchestrator双路径骨架.md`。两种执行方式:

1. **Subagent-Driven(推荐)** — 每 Task 派新 subagent,Task 间复审,快迭代。
2. **Inline Execution** — 本会话内按 executing-plans 批量执行 + 检查点复审。

> 本 plan 是纯重构、Task 强顺序依赖(每步靠全套测试绿兜底),**Inline 顺跑**亦稳妥。选哪种?

