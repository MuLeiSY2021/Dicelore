# 玩家客户端（组件7）v1 非阻塞竖切 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把组件7「不阻塞、可先做」的那部分落成可跑骨架——`packages/shared` 线上契约、core 公共入口、orchestrator 呈现层映射、`apps/web` 墨金主题 + Lucide + 外壳骨架，外加一个只读 REST 把呈现快照串通到浏览器。

**Architecture:** 三层（[玩家客户端 §1](../../wiki/04-子系统设计/玩家客户端.md)）。本计划只做**非阻塞竖切**：①`packages/shared` 用 zod schema 定义线上 DTO（接口页 §0-§6 的单一真相，TS 类型从 schema 推断）；② core 加 additive 公共 barrel，让 apps 能 import 纯函数 / 类型；③ orchestrator `presentation.ts` **复用** core 纯函数 `buildPresentationModel` 再映射成 shared 的线上快照形状（core 的 `PresentationModel` 与接口页 §1 线上形状**不同构**，映射是这一层的职责）；④ orchestrator 一个**只读** REST（`GET /presentation`、`GET /sessions/:id`）把快照吐给前端；⑤ `apps/web` = Vite+React+TS，墨金 token 主题系统 + Lucide 图标登记 + bar+路由+四页壳。

**Tech Stack:** TypeScript（ESM, `moduleResolution: Bundler`, 对齐 core）· zod（已是 core 依赖）· Node ≥20 · Vite + React 18 + react-router-dom v6 · lucide-react · vitest（对齐 core）· @testing-library/react + jsdom（web 冒烟）· better-sqlite3（orchestrator 读侧，复用 core）· Hono（orchestrator 只读 REST，轻量、内置测试 client）。

## Global Constraints

- **协议版本串**：前端↔后端 `dicelore.client/1`；MCP↔后端 `dicelore.notify/1`。每条消息/响应带 `protocol` 字段（[接口页 §0/§6](../../wiki/04-子系统设计/玩家客户端-接口.md)）。
- **类型单一真相**：线上 JSON 形状只在 `packages/shared` 定义一次，前端/后端/orchestrator 共用，禁重复定义（[接口页 §0 类型源](../../wiki/04-子系统设计/玩家客户端-接口.md)）。
- **几乎不改引擎**：`packages/core` 本计划只允许 **additive**（加 barrel + `exports`），不改任何现有引擎逻辑、不动 `src/store` 等纯逻辑（[玩家客户端 §0](../../wiki/04-子系统设计/玩家客户端.md)）。
- **可见性语义**：玩家投影只含 `visible=1`；`0`/`2` 不出现（[内层 §4.1](../../wiki/04-子系统设计/内层能力库.md)，core `present/model.ts` 已实现，本计划复用不重写）。
- **token 化无裸 hex**：web 全部颜色走 CSS 语义变量，换肤=换 token 组；字体三档（Playfair 标题 / Inter 界面 / JetBrains Mono 数据）；图标统一 Lucide 线性、禁 emoji（[视觉页 §1/§7](../../wiki/04-子系统设计/玩家客户端-视觉.md)）。
- **ESM + Bundler 解析**：所有新包 `"type": "module"`、tsconfig 对齐 core（`target ES2022` / `module ESNext` / `moduleResolution Bundler` / `strict`）。
- **本计划范围边界（硬阻塞，不做）**：orchestrator 接 Agent SDK + dicelore MCP + 三 hook + WS 流 + notify sink **等组件2 MCP 工具面合并**（[玩家客户端 §9](../../wiki/04-子系统设计/玩家客户端.md)）；团本制作页真实能力 **等组件5 Web 门面**；呈现台实时增量 / 掷骰裁决 / 揭示自动钉的**真实数据通路**随之阻塞。本计划只做静态壳 + 只读快照。
- **B 项不在本计划**：「状态显示→呈现台」改名、d10 区间裁决与 `choices`/`resolve_*` 形状的厘清属视觉 spec §8 待回填（[视觉页 §8](../../wiki/04-子系统设计/玩家客户端-视觉.md)），尚未回填进设计/接口页；本计划 `choices` **严格镜像接口页 §1 现状**（`{eventId, options:[{index,label,consequence}]}`），不引入区间语义。

---

## 文件结构（先锁分解）

```
packages/shared/                      ← 新增包 @dicelore/shared（纯 TS 契约，零运行时依赖除 zod）
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    protocol.ts                       ← 协议常量 CLIENT_PROTOCOL / NOTIFY_PROTOCOL
    presentation.ts                   ← §1 全量快照 + §4 presentation_delta schema
    rest.ts                           ← §2 REST 请求/响应 schema
    stream.ts                         ← §4 WS 消息目录（判别联合）
    notify.ts                         ← §5 webhook payload schema
    index.ts                          ← barrel 再导出全部
  src/*.test.ts                       ← 每文件配套 schema parse 测试

packages/core/                        ← 仅 additive
  package.json                        ← 加 "exports" 映射
  src/index.ts                        ← 新增 barrel：再导出 openDb/initSchema、buildPresentationModel 等公共面

apps/orchestrator/                    ← 新增包 @dicelore/orchestrator（只读竖切部分）
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    presentation.ts                   ← buildSnapshot(db, sessionId): 复用 core 纯函数 → shared 线上快照
    server.ts                         ← 只读 REST（Hono）：GET /presentation、GET /sessions/:id
  src/*.test.ts

apps/web/                             ← 新增包 @dicelore/web（Vite + React + TS）
  package.json
  tsconfig.json / tsconfig.node.json
  vite.config.ts
  vitest.config.ts
  index.html
  src/
    main.tsx                          ← 挂载 + 引 tokens.css + 字体
    App.tsx                           ← 路由 + 外壳布局
    styles/tokens.css                 ← 墨金暗/亮 token + 5 强调色 + 字体档
    theme/ThemeProvider.tsx           ← 明暗 / 强调色状态（data-* 属性写到 <html>）
    icons.ts                          ← Lucide 图标登记（§1.4 映射）
    shell/TopBar.tsx                  ← bar：品牌 + 四页导航 + 工具区
    pages/HomePage.tsx                ← 主页壳
    pages/PlayPage.tsx                ← 跑团壳（活动轨/中央/呈现台占位）
    pages/BuildPage.tsx               ← 团本制作壳
    pages/ConfigPage.tsx              ← 配置壳
  src/**/*.test.tsx                   ← 冒烟测试

根 package.json                        ← workspaces 已含 apps/* 与 packages/*，无需改；按需补根脚本
```

**分解理由**：`packages/shared` 按接口页章节切文件（改一章不动其它）；core 只加一个 barrel；orchestrator 把「映射」（`presentation.ts`，纯函数易测）与「传输」（`server.ts`）分开；web 把 token（CSS）/ 主题状态 / 图标登记 / 外壳 / 页面壳各自单一职责。

---

### Task 1: `packages/shared` 线上契约（zod schema + 推断类型）

接口页 §0-§6 的单一真相。用 zod 写 schema、`z.infer` 出 TS 类型；inbound（webhook / REST 请求）可运行时校验，outbound（快照 / WS）同源类型。

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/protocol.ts`
- Create: `packages/shared/src/presentation.ts`
- Create: `packages/shared/src/rest.ts`
- Create: `packages/shared/src/stream.ts`
- Create: `packages/shared/src/notify.ts`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/src/presentation.test.ts`, `packages/shared/src/notify.test.ts`, `packages/shared/src/stream.test.ts`

**Interfaces:**
- Consumes: 无（叶子包，仅依赖 zod）。
- Produces（后续任务依赖的导出，全部从 `@dicelore/shared` barrel 出）:
  - 常量 `CLIENT_PROTOCOL = "dicelore.client/1"`、`NOTIFY_PROTOCOL = "dicelore.notify/1"`
  - 类型 `SheetCell {attr:string; value:string; visible:number}`、`SheetGroup {entity:string; cells:SheetCell[]}`
  - 类型 `MechanicEntry {seq:number; kind:"verdict"|"mutation"|"watcher_fired"; text:string; data?:unknown}`
  - 类型 `ChoiceOption {index:number; label:string; consequence:string}`、`ChoicesView {eventId:number; options:ChoiceOption[]}`
  - 类型 `PresentationSnapshot {protocol:string; sessionId:string; seq:number; sheets:SheetGroup[]; mechanics:MechanicEntry[]; choices:ChoicesView|null; narrativeCursor:number}`
  - schema `PresentationSnapshotSchema`、`PresentationDeltaSchema`、`NotifyPayloadSchema`、`StreamMessageSchema`
  - 类型 `NotifyPayload`、`StreamMessage`、REST 请求/响应类型（见步骤代码）

- [ ] **Step 1: 建包骨架（package.json / tsconfig / vitest.config）**

`packages/shared/package.json`：

```json
{
  "name": "@dicelore/shared",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "zod": "^3.25.76" },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

`packages/shared/tsconfig.json`（对齐 core）：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

`packages/shared/vitest.config.ts`：

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
```

- [ ] **Step 2: 写协议常量 `src/protocol.ts`**

```ts
// 协议版本串（Global Constraints / 接口页 §0、§6）。破坏性变更进位。
export const CLIENT_PROTOCOL = "dicelore.client/1" as const;
export const NOTIFY_PROTOCOL = "dicelore.notify/1" as const;
```

- [ ] **Step 3: 写呈现模型 schema `src/presentation.ts`（接口页 §1 + §4 delta）**

```ts
import { z } from "zod";
import { CLIENT_PROTOCOL } from "./protocol.js";

// §1 机械回显可见种类（与 core EventKind 的机械子集对齐）
export const MechanicKind = z.enum(["verdict", "mutation", "watcher_fired"]);

export const SheetCellSchema = z.object({
  attr: z.string(),
  value: z.string(),
  visible: z.number(),
});
export const SheetGroupSchema = z.object({
  entity: z.string(),
  cells: z.array(SheetCellSchema),
});
export const MechanicEntrySchema = z.object({
  seq: z.number(),
  kind: MechanicKind,
  text: z.string(),
  data: z.unknown().optional(),
});
export const ChoiceOptionSchema = z.object({
  index: z.number(),
  label: z.string(),
  consequence: z.string(),
});
export const ChoicesViewSchema = z.object({
  eventId: z.number(),
  options: z.array(ChoiceOptionSchema),
});

// §1 全量快照（GET /presentation 与 WS 重连补齐）
export const PresentationSnapshotSchema = z.object({
  protocol: z.literal(CLIENT_PROTOCOL),
  sessionId: z.string(),
  seq: z.number(),
  sheets: z.array(SheetGroupSchema),
  mechanics: z.array(MechanicEntrySchema),
  choices: ChoicesViewSchema.nullable(),
  narrativeCursor: z.number(),
});

// §4 presentation_delta.changes（webhook 驱动的局部）
export const PresentationChangesSchema = z.object({
  sheets: z
    .array(SheetCellSchema.extend({ entity: z.string(), op: z.enum(["upsert", "remove"]) }))
    .optional(),
  mechanics: z.array(MechanicEntrySchema).optional(),
  reveal: z.array(z.object({ seq: z.number(), target: z.string(), text: z.string() })).optional(),
  watcherFired: z
    .array(z.object({ seq: z.number(), watcherId: z.number(), payload: z.string() }))
    .optional(),
});
export const PresentationDeltaSchema = z.object({
  seq: z.number(),
  changes: PresentationChangesSchema,
});

export type SheetCell = z.infer<typeof SheetCellSchema>;
export type SheetGroup = z.infer<typeof SheetGroupSchema>;
export type MechanicEntry = z.infer<typeof MechanicEntrySchema>;
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;
export type ChoicesView = z.infer<typeof ChoicesViewSchema>;
export type PresentationSnapshot = z.infer<typeof PresentationSnapshotSchema>;
export type PresentationDelta = z.infer<typeof PresentationDeltaSchema>;
```

- [ ] **Step 4: 写 REST schema `src/rest.ts`（接口页 §2）**

```ts
import { z } from "zod";

export const MessageRequestSchema = z.object({ text: z.string() });
export const MessageResponseSchema = z.object({ turnId: z.string() });
export const ChoiceRequestSchema = z.object({ eventId: z.number(), optionIndex: z.number() });
export const ChoiceResponseSchema = z.object({ turnId: z.string() });
export const CreateSessionRequestSchema = z.object({
  teamId: z.string().optional(),
  resume: z.string().optional(),
});
export const CreateSessionResponseSchema = z.object({ sessionId: z.string() });
export const SessionInfoSchema = z.object({
  sessionId: z.string(),
  ended: z.boolean(),
  title: z.string(),
});
export const EventRowSchema = z.object({
  seq: z.number(),
  kind: z.string(),
  text: z.string(),
  data: z.unknown().optional(),
});
export const EventsResponseSchema = z.object({ events: z.array(EventRowSchema) });

export type MessageRequest = z.infer<typeof MessageRequestSchema>;
export type MessageResponse = z.infer<typeof MessageResponseSchema>;
export type ChoiceRequest = z.infer<typeof ChoiceRequestSchema>;
export type ChoiceResponse = z.infer<typeof ChoiceResponseSchema>;
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>;
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
export type EventRow = z.infer<typeof EventRowSchema>;
export type EventsResponse = z.infer<typeof EventsResponseSchema>;
```

- [ ] **Step 5: 写 WS 消息目录 `src/stream.ts`（接口页 §4，判别联合）**

```ts
import { z } from "zod";
import { CLIENT_PROTOCOL } from "./protocol.js";
import { ChoicesViewSchema, PresentationDeltaSchema } from "./presentation.js";

const base = { protocol: z.literal(CLIENT_PROTOCOL) };

export const StreamMessageSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("turn_started"), turnId: z.string() }),
  z.object({ ...base, type: z.literal("narration_delta"), turnId: z.string(), text: z.string() }),
  z.object({ ...base, type: z.literal("narration_commit"), seq: z.number(), text: z.string() }),
  z.object({ ...base, type: z.literal("presentation_delta"), delta: PresentationDeltaSchema }),
  z.object({ ...base, type: z.literal("choices"), choices: ChoicesViewSchema }),
  z.object({ ...base, type: z.literal("turn_ended"), turnId: z.string(), seq: z.number() }),
  z.object({ ...base, type: z.literal("game_end"), reason: z.string(), outcome: z.string() }),
  z.object({ ...base, type: z.literal("error"), code: z.string(), message: z.string() }),
]);

export type StreamMessage = z.infer<typeof StreamMessageSchema>;
```

- [ ] **Step 6: 写 webhook payload `src/notify.ts`（接口页 §5）**

```ts
import { z } from "zod";
import { NOTIFY_PROTOCOL } from "./protocol.js";

export const NotifyKind = z.enum([
  "mutation", "event", "visibility", "reveal",
  "watcher_fired", "choice_staged", "game_end", "bulk",
]);

export const NotifyPayloadSchema = z.object({
  protocol: z.literal(NOTIFY_PROTOCOL),
  sessionId: z.string(),
  seq: z.number(),
  kind: NotifyKind,
  delta: z.record(z.unknown()).optional(), // bulk 时缺省/空，提示后端回读全量快照
});

export type NotifyKind = z.infer<typeof NotifyKind>;
export type NotifyPayload = z.infer<typeof NotifyPayloadSchema>;
```

- [ ] **Step 7: 写 barrel `src/index.ts`**

```ts
export * from "./protocol.js";
export * from "./presentation.js";
export * from "./rest.js";
export * from "./stream.js";
export * from "./notify.js";
```

- [ ] **Step 8: 写测试 `src/presentation.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { PresentationSnapshotSchema, CLIENT_PROTOCOL } from "./index.js";

describe("PresentationSnapshotSchema", () => {
  it("接受接口页 §1 形状的全量快照", () => {
    const ok = {
      protocol: CLIENT_PROTOCOL,
      sessionId: "s1",
      seq: 1234,
      sheets: [{ entity: "张三", cells: [{ attr: "HP", value: "12", visible: 1 }] }],
      mechanics: [{ seq: 1230, kind: "mutation", text: "金钱 +3d100=74 → 77" }],
      choices: { eventId: 1234, options: [{ index: 0, label: "推门进去", consequence: "惊动守卫" }] },
      narrativeCursor: 1228,
    };
    expect(PresentationSnapshotSchema.parse(ok)).toMatchObject({ sessionId: "s1" });
  });

  it("choices 可为 null", () => {
    const snap = PresentationSnapshotSchema.parse({
      protocol: CLIENT_PROTOCOL, sessionId: "s1", seq: 0,
      sheets: [], mechanics: [], choices: null, narrativeCursor: 0,
    });
    expect(snap.choices).toBeNull();
  });

  it("拒绝错误的 protocol", () => {
    expect(() =>
      PresentationSnapshotSchema.parse({
        protocol: "wrong", sessionId: "s1", seq: 0,
        sheets: [], mechanics: [], choices: null, narrativeCursor: 0,
      }),
    ).toThrow();
  });
});
```

`src/notify.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { NotifyPayloadSchema, NOTIFY_PROTOCOL } from "./index.js";

describe("NotifyPayloadSchema", () => {
  it("接受合法 mutation 通知", () => {
    const p = NotifyPayloadSchema.parse({
      protocol: NOTIFY_PROTOCOL, sessionId: "s1", seq: 1235, kind: "mutation", delta: { x: 1 },
    });
    expect(p.kind).toBe("mutation");
  });
  it("拒绝非法 kind", () => {
    expect(() =>
      NotifyPayloadSchema.parse({ protocol: NOTIFY_PROTOCOL, sessionId: "s1", seq: 1, kind: "nope" }),
    ).toThrow();
  });
});
```

`src/stream.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { StreamMessageSchema, CLIENT_PROTOCOL } from "./index.js";

describe("StreamMessageSchema", () => {
  it("按 type 判别 narration_delta", () => {
    const m = StreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "narration_delta", turnId: "t1", text: "你推开门",
    });
    expect(m.type).toBe("narration_delta");
  });
  it("拒绝未知 type", () => {
    expect(() =>
      StreamMessageSchema.parse({ protocol: CLIENT_PROTOCOL, type: "bogus" }),
    ).toThrow();
  });
});
```

- [ ] **Step 9: 安装依赖并跑测试**

Run: `npm install && npm run test -w @dicelore/shared`
Expected: 3 个测试文件全部 PASS（共 7 用例）。

- [ ] **Step 10: typecheck**

Run: `npm run typecheck -w @dicelore/shared`
Expected: 无错误退出（exit 0）。

- [ ] **Step 11: Commit**

```bash
git add packages/shared package.json package-lock.json
git commit -m "feat(shared): 玩家客户端线上契约 zod schema(接口页 §0-§6)"
```

---

### Task 2: `packages/core` 公共入口（additive barrel + exports）

orchestrator 要 import core 的 `openDb` / `initSchema` / `buildPresentationModel` 与类型。core 现无公共 barrel、package.json 无 `exports`。本任务**只加不改**。

**Files:**
- Create: `packages/core/src/index.ts`
- Modify: `packages/core/package.json`（加 `exports` / `main`）
- Test: `packages/core/src/index.test.ts`

**Interfaces:**
- Consumes: 现有 `src/store/db.ts` 的 `openDb(path:string):DB` / `initSchema(db:DB):void` / `type DB`；`src/present/model.ts` 的 `buildPresentationModel(db:DB, opts?:{turnStartSeq?:number}):PresentationModel` 与类型 `PresentationModel`/`EchoEntry`/`VisibleCell`/`ChoiceView`。
- Produces: `@dicelore/core` 可被 `import { openDb, initSchema, buildPresentationModel } from "@dicelore/core"` 消费，并导出上述类型。

- [ ] **Step 1: 写 barrel `src/index.ts`**

```ts
// @dicelore/core 公共面（additive；引擎纯逻辑反向零 import 本文件）。
export { openDb, initSchema, type DB } from "./store/db.js";
export {
  buildPresentationModel,
  type PresentationModel,
  type EchoEntry,
  type VisibleCell,
  type ChoiceView,
} from "./present/model.js";
```

- [ ] **Step 2: package.json 加 `exports` / `main`**

在 `packages/core/package.json` 顶层（`"private": true,` 之后）插入：

```json
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
```

- [ ] **Step 3: 写测试 `src/index.test.ts`（验证 barrel 可用 + 纯函数仍工作）**

```ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema, buildPresentationModel } from "./index.js";

describe("@dicelore/core barrel", () => {
  it("openDb + initSchema + 空库 buildPresentationModel 不崩、返回空投影", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const m = buildPresentationModel(db, { turnStartSeq: 0 });
    expect(m.statusMenu).toEqual([]);
    expect(m.mechanicalEcho).toEqual([]);
    expect(m.pendingChoice).toBeUndefined();
  });
});
```

- [ ] **Step 4: 跑测试**

Run: `npm run test -w @dicelore/core`
Expected: 全套现有测试 + 新增 `index.test.ts` PASS。

- [ ] **Step 5: typecheck**

Run: `npm run typecheck -w @dicelore/core`
Expected: exit 0。

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/index.test.ts packages/core/package.json
git commit -m "feat(core): additive 公共 barrel(openDb/initSchema/buildPresentationModel)"
```

---

### Task 3: `apps/orchestrator` 呈现层映射 `presentation.ts`

核心接缝：core 的 `PresentationModel`（`mechanicalEcho`/`statusMenu`/`pendingChoice`）与接口页 §1 线上形状（`sheets`/`mechanics`/`choices`/`narrativeCursor`）**不同构**。本层 = 复用 core 纯函数 + 映射成 shared 的 `PresentationSnapshot`。

**Files:**
- Create: `apps/orchestrator/package.json`
- Create: `apps/orchestrator/tsconfig.json`
- Create: `apps/orchestrator/vitest.config.ts`
- Create: `apps/orchestrator/src/presentation.ts`
- Test: `apps/orchestrator/src/presentation.test.ts`

**Interfaces:**
- Consumes: `@dicelore/core` 的 `openDb`/`initSchema`/`buildPresentationModel`/`type DB`；`@dicelore/shared` 的 `PresentationSnapshot`/`CLIENT_PROTOCOL`。
- Produces: `buildSnapshot(db: DB, sessionId: string): PresentationSnapshot`（Task 4/server.ts 消费）。

- [ ] **Step 1: 建包骨架**

`apps/orchestrator/package.json`：

```json
{
  "name": "@dicelore/orchestrator",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "dev": "tsx src/server.ts"
  },
  "dependencies": {
    "@dicelore/core": "*",
    "@dicelore/shared": "*",
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

`apps/orchestrator/tsconfig.json`（对齐 core）：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src"]
}
```

`apps/orchestrator/vitest.config.ts`：

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
```

- [ ] **Step 2: 先写失败测试 `src/presentation.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "@dicelore/core";
import { setSheetCell } from "@dicelore/core/dist/store/sheet.js"; // 见步骤注：用 store 直写播种
import { buildSnapshot } from "./presentation.js";

// 注：测试直接用 core 内部 store 写 API 播种最小态。若 setSheetCell 不在公共面，
// 改用 db.prepare(...).run(...) 原生插入（schema 见 src/store/db.ts）。
function seedCell(db: ReturnType<typeof openDb>, entity: string, attr: string, value: string) {
  db.prepare("INSERT INTO sheet (entity, attr, value, visible) VALUES (?,?,?,1)").run(entity, attr, value);
}
function seedEvent(db: ReturnType<typeof openDb>, kind: string, content: string) {
  db.prepare("INSERT INTO event (content, kind, visible) VALUES (?,?,1)").run(content, kind);
}

describe("buildSnapshot", () => {
  it("空库返回合法空快照", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const snap = buildSnapshot(db, "s1");
    expect(snap.protocol).toBe("dicelore.client/1");
    expect(snap.sessionId).toBe("s1");
    expect(snap.sheets).toEqual([]);
    expect(snap.mechanics).toEqual([]);
    expect(snap.choices).toBeNull();
    expect(snap.seq).toBe(0);
    expect(snap.narrativeCursor).toBe(0);
  });

  it("可见 sheet cell 按 entity 分组进 sheets", () => {
    const db = openDb(":memory:");
    initSchema(db);
    seedCell(db, "张三", "HP", "12");
    seedCell(db, "张三", "金钱", "77");
    const snap = buildSnapshot(db, "s1");
    expect(snap.sheets).toEqual([
      { entity: "张三", cells: [{ attr: "HP", value: "12", visible: 1 }, { attr: "金钱", value: "77", visible: 1 }] },
    ]);
  });

  it("机械 event 映射进 mechanics，narrate 推进 narrativeCursor", () => {
    const db = openDb(":memory:");
    initSchema(db);
    seedEvent(db, "narrate", "你推开门");          // seq 1
    seedEvent(db, "mutation", "金钱 +3d100=74 → 77"); // seq 2
    const snap = buildSnapshot(db, "s1");
    expect(snap.mechanics).toEqual([{ seq: 2, kind: "mutation", text: "金钱 +3d100=74 → 77" }]);
    expect(snap.narrativeCursor).toBe(1);
    expect(snap.seq).toBe(2);
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npm install && npm run test -w @dicelore/orchestrator`
Expected: FAIL —— `buildSnapshot` 未定义 / 模块缺失。

- [ ] **Step 4: 写实现 `src/presentation.ts`**

```ts
import type { DB } from "@dicelore/core";
import { buildPresentationModel } from "@dicelore/core";
import { CLIENT_PROTOCOL, type PresentationSnapshot, type SheetGroup } from "@dicelore/shared";

// core PresentationModel → 接口页 §1 线上快照。core 纯函数已按 visible 过滤(全为 visible=1)。
export function buildSnapshot(db: DB, sessionId: string): PresentationSnapshot {
  const model = buildPresentationModel(db, { turnStartSeq: 0 }); // 全量快照：取所有可见机械事实

  // statusMenu(VisibleCell[]) → 按 entity 分组、保序
  const groups: SheetGroup[] = [];
  const byEntity = new Map<string, SheetGroup>();
  for (const c of model.statusMenu) {
    let g = byEntity.get(c.entity);
    if (!g) { g = { entity: c.entity, cells: [] }; byEntity.set(c.entity, g); groups.push(g); }
    g.cells.push({ attr: c.attr, value: c.value, visible: 1 });
  }

  const choices = model.pendingChoice
    ? {
        eventId: model.pendingChoice.seq,
        options: model.pendingChoice.options.map((o, index) => ({
          index, label: o.label, consequence: o.consequence,
        })),
      }
    : null;

  return {
    protocol: CLIENT_PROTOCOL,
    sessionId,
    seq: maxSeq(db),
    sheets: groups,
    mechanics: model.mechanicalEcho.map((e) => ({ seq: e.seq, kind: e.kind, text: e.text })),
    choices,
    narrativeCursor: narrativeCursor(db),
  };
}

function maxSeq(db: DB): number {
  const r = db.prepare("SELECT MAX(seq) s FROM event").get() as { s: number | null };
  return r.s ?? 0;
}
function narrativeCursor(db: DB): number {
  const r = db.prepare("SELECT MAX(seq) s FROM event WHERE kind='narrate'").get() as { s: number | null };
  return r.s ?? 0;
}
```

> **关于测试播种的 import**：步骤 2 用原生 `db.prepare(...).run(...)` 播种（不依赖 core 是否导出 `setSheetCell`），故删掉那行 `setSheetCell` import。`sheet` / `event` 表结构见 [src/store/db.ts](../../../packages/core/src/store/db.ts) `initSchema`。

- [ ] **Step 5: 修正测试 import（删未用的 setSheetCell 行）并跑测试**

把 Step 2 里 `import { setSheetCell } ...` 那行删除（实现用原生插入播种，无需该 API）。

Run: `npm run test -w @dicelore/orchestrator`
Expected: 3 个用例全部 PASS。

- [ ] **Step 6: typecheck**

Run: `npm run typecheck -w @dicelore/orchestrator`
Expected: exit 0。

- [ ] **Step 7: Commit**

```bash
git add apps/orchestrator package.json package-lock.json
git commit -m "feat(orchestrator): presentation.ts 复用 core 纯函数映射成 §1 线上快照"
```

---

### Task 4: `apps/orchestrator` 只读 REST（`GET /presentation`、`GET /sessions/:id`）

把 Task 3 的快照串通到 HTTP，前端首屏可拉。**只做读侧**——动作进（`POST messages/choices`）、WS 流、notify sink、Agent SDK + MCP 接线**全部阻塞**（Global Constraints），本任务不碰。

**Files:**
- Create: `apps/orchestrator/src/server.ts`
- Test: `apps/orchestrator/src/server.test.ts`

**Interfaces:**
- Consumes: Task 3 `buildSnapshot(db, sessionId)`；`@dicelore/core` `openDb`/`initSchema`/`type DB`；`@dicelore/shared` `type SessionInfo`。
- Produces: `createApp(deps: { openSession: (id: string) => DB }): Hono`（可注入测试用内存 db）；`startServer(port: number): void`（生产入口，dev 脚本用）。

- [ ] **Step 1: 先写失败测试 `src/server.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema, type DB } from "@dicelore/core";
import { createApp } from "./server.js";

function memSessionFactory(): (id: string) => DB {
  const db = openDb(":memory:");
  initSchema(db);
  db.prepare("INSERT INTO sheet (entity, attr, value, visible) VALUES ('张三','HP','12',1)").run();
  return () => db;
}

describe("orchestrator 只读 REST", () => {
  it("GET /sessions/:id/presentation 返回 §1 快照", async () => {
    const app = createApp({ openSession: memSessionFactory() });
    const res = await app.request("/sessions/s1/presentation");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.protocol).toBe("dicelore.client/1");
    expect(body.sessionId).toBe("s1");
    expect(body.sheets[0]).toEqual({ entity: "张三", cells: [{ attr: "HP", value: "12", visible: 1 }] });
  });

  it("GET /sessions/:id 返回会话元信息", async () => {
    const app = createApp({ openSession: memSessionFactory() });
    const res = await app.request("/sessions/s1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ sessionId: "s1", ended: false });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm run test -w @dicelore/orchestrator`
Expected: FAIL —— `createApp` 未定义。

- [ ] **Step 3: 写实现 `src/server.ts`**

```ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { openDb, initSchema, type DB } from "@dicelore/core";
import type { SessionInfo } from "@dicelore/shared";
import { buildSnapshot } from "./presentation.js";

export interface ServerDeps {
  openSession: (sessionId: string) => DB; // 读侧句柄(每会话一文件；测试可注入内存库)
}

export function createApp(deps: ServerDeps): Hono {
  const app = new Hono();

  // 首屏 / 重连：全量呈现快照(接口页 §2)
  app.get("/sessions/:id/presentation", (c) => {
    const id = c.req.param("id");
    const db = deps.openSession(id);
    return c.json(buildSnapshot(db, id));
  });

  // 会话元信息(接口页 §2)。v1：终局/标题占位，待写侧接线后回填。
  app.get("/sessions/:id", (c) => {
    const id = c.req.param("id");
    const info: SessionInfo = { sessionId: id, ended: false, title: id };
    return c.json(info);
  });

  return app;
}

// 生产入口：每会话按 DICELORE_SESSIONS_DIR/{id}.db 打开(读侧)。
export function startServer(port: number): void {
  const dir = process.env.DICELORE_SESSIONS_DIR ?? ".";
  const app = createApp({
    openSession: (id) => {
      const db = openDb(`${dir}/${id}.db`);
      initSchema(db);
      return db;
    },
  });
  serve({ fetch: app.fetch, port });
  console.log(`[orchestrator] 只读 REST 监听 :${port}`);
}

// tsx src/server.ts 直接起
if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  startServer(Number(process.env.PORT ?? 8787));
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm install && npm run test -w @dicelore/orchestrator`
Expected: presentation + server 共 5 用例 PASS。

- [ ] **Step 5: typecheck**

Run: `npm run typecheck -w @dicelore/orchestrator`
Expected: exit 0。

- [ ] **Step 6: 手动冒烟（可选，确认能起）**

Run: `PORT=8787 npm run dev -w @dicelore/orchestrator` → 另开终端 `curl localhost:8787/sessions/demo/presentation`
Expected: 返回 JSON（demo.db 不存在时 initSchema 建空库，快照为空形状）。Ctrl-C 收。

- [ ] **Step 7: Commit**

```bash
git add apps/orchestrator package-lock.json
git commit -m "feat(orchestrator): 只读 REST(GET /presentation + /sessions/:id)"
```

---

### Task 5: `apps/web` 脚手架 + 墨金 token 主题系统

Vite+React+TS 初始化 + 全部颜色走 CSS 语义 token（暗/亮双态 + 5 强调色）+ 三档字体。无 CSS 框架（壳阶段不需要 dock/grid 库）。

**Files:**
- Create: `apps/web/package.json`、`apps/web/tsconfig.json`、`apps/web/tsconfig.node.json`、`apps/web/vite.config.ts`、`apps/web/vitest.config.ts`、`apps/web/index.html`
- Create: `apps/web/src/main.tsx`、`apps/web/src/styles/tokens.css`、`apps/web/src/theme/ThemeProvider.tsx`
- Test: `apps/web/src/theme/ThemeProvider.test.tsx`

**Interfaces:**
- Consumes: 无（web 入口）。后续 Task 6/7 消费本任务的 `ThemeProvider` 与 `useTheme`、tokens.css 变量。
- Produces:
  - `useTheme(): { mode: "dark"|"light"; accent: AccentName; setMode; setAccent }`，类型 `AccentName = "gold"|"copper"|"teal"|"crimson"|"indigo"`
  - `<ThemeProvider>`：把 `mode`→`<html data-theme>`、`accent`→`<html data-accent>`。
  - CSS 变量：`--bg/--surface/--surface2/--line/--line2/--text/--text2/--text3/--acc/--acc-h/--acc-soft/--acc-on/--ok/--warn/--err`，字体 `--font-display/--font-ui/--font-mono`。

- [ ] **Step 1: 建包骨架（package.json / tsconfig / vite / vitest / index.html）**

`apps/web/package.json`：

```json
{
  "name": "@dicelore/web",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@dicelore/shared": "*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0",
    "lucide-react": "^0.453.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

`apps/web/tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

> 注：`types` 含 `vitest/globals` + `@testing-library/jest-dom`，否则 `tsc --noEmit` 在测试文件报 `Cannot find name 'expect'`（运行时 `globals:true` 不影响类型检查）。

`apps/web/tsconfig.node.json`：

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

`apps/web/vite.config.ts`：

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/sessions": "http://localhost:8787" } }, // 开发期代理到 orchestrator
});
```

`apps/web/vitest.config.ts`：

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test-setup.ts"], include: ["src/**/*.test.tsx"] },
});
```

`apps/web/index.html`：

```html
<!doctype html>
<html lang="zh" data-theme="dark" data-accent="gold">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dicelore</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: 写 token 样式 `src/styles/tokens.css`（视觉页 §1.1/§1.2/§1.3，值逐字照抄）**

```css
:root,
[data-theme="dark"] {
  --bg: #0c211a;
  --surface: #122a22;
  --surface2: #18342a;
  --line: #25433a;
  --line2: #33574a;
  --text: #e9e3d1;
  --text2: #9aae9f;
  --text3: #62756a;
  --acc: #d4a83e;
  --acc-h: #e6bd5a;
  --acc-soft: #ecd28c;
  --acc-on: #13261d;
  --ok: #5fae7e;
  --warn: #d99a3a;
  --err: #cd5b4a;
  --font-display: "Playfair Display", serif;
  --font-ui: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}

[data-theme="light"] {
  --bg: #dde8de;
  --surface: #eef4ed;
  --surface2: #e6efe5;
  --line: #c8d8c9;
  --line2: #aec4af;
  --text: #123a2c;
  --text2: #4b6356;
  --text3: #7e9488;
  --acc: #937420;
  --acc-h: #a98a2c;
  --acc-soft: #6f561a;
  --acc-on: #fff;
}

/* 可选强调色（主题 token；data-accent 覆盖 --acc 组）。亮态 --acc-soft 取 acc 本色保对比 ≥4.5:1。 */
[data-accent="copper"] { --acc: #c47a3e; --acc-h: #d68f50; --acc-soft: #e0a667; --acc-on: #1c1209; }
[data-accent="teal"]   { --acc: #3aa896; --acc-h: #4cc0ad; --acc-soft: #7fd6c8; --acc-on: #06231f; }
[data-accent="crimson"]{ --acc: #b4453a; --acc-h: #cc5a4f; --acc-soft: #e08a82; --acc-on: #fff; }
[data-accent="indigo"] { --acc: #6f74e8; --acc-h: #868bf0; --acc-soft: #a9adf5; --acc-on: #fff; }

* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 14px;
}
:focus-visible { outline: 2px solid var(--acc); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
```

- [ ] **Step 3: 写 `src/theme/ThemeProvider.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "dark" | "light";
export type AccentName = "gold" | "copper" | "teal" | "crimson" | "indigo";

interface ThemeCtx {
  mode: ThemeMode;
  accent: AccentName;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentName) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [accent, setAccent] = useState<AccentName>("gold");

  useEffect(() => { document.documentElement.dataset.theme = mode; }, [mode]);
  useEffect(() => { document.documentElement.dataset.accent = accent; }, [accent]);

  return <Ctx.Provider value={{ mode, accent, setMode, setAccent }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return v;
}
```

- [ ] **Step 4: 写 `src/main.tsx`（暂挂一个占位，Task 6 换成 App）**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./theme/ThemeProvider.js";
import "./styles/tokens.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <div style={{ padding: 24, fontFamily: "var(--font-display)" }}>Dicelore</div>
    </ThemeProvider>
  </StrictMode>,
);
```

- [ ] **Step 5: 写测试 setup `src/test-setup.ts` 与 `src/theme/ThemeProvider.test.tsx`**

`src/test-setup.ts`：

```ts
import "@testing-library/jest-dom";
```

`src/theme/ThemeProvider.test.tsx`：

```tsx
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeProvider.js";

function Probe() {
  const { mode, accent, setMode, setAccent } = useTheme();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="accent">{accent}</span>
      <button onClick={() => setMode("light")}>light</button>
      <button onClick={() => setAccent("teal")}>teal</button>
    </div>
  );
}

it("默认 dark/gold，并写到 <html> data 属性", () => {
  render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(screen.getByTestId("mode").textContent).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.dataset.accent).toBe("gold");
});

it("切换 mode/accent 同步到 <html>", () => {
  render(<ThemeProvider><Probe /></ThemeProvider>);
  act(() => { screen.getByText("light").click(); });
  act(() => { screen.getByText("teal").click(); });
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(document.documentElement.dataset.accent).toBe("teal");
});
```

- [ ] **Step 6: 安装依赖并跑测试**

Run: `npm install && npm run test -w @dicelore/web`
Expected: 2 用例 PASS。

- [ ] **Step 7: typecheck + 起开发服冒烟（可选）**

Run: `npm run typecheck -w @dicelore/web`，再 `npm run dev -w @dicelore/web`
Expected: typecheck exit 0；浏览器开 Vite 地址见墨绿底 + Playfair「Dicelore」。

- [ ] **Step 8: Commit**

```bash
git add apps/web package.json package-lock.json
git commit -m "feat(web): Vite+React 脚手架 + 墨金 token 主题(暗/亮 + 5 强调色)"
```

---

### Task 6: `apps/web` Lucide 图标登记

统一 Lucide 线性、禁 emoji。集中一个 `icons.ts` 把视觉页 §1.4 的语义名映射到 lucide-react 组件，外壳/页面只引语义名。

**Files:**
- Create: `apps/web/src/icons.ts`
- Test: `apps/web/src/icons.test.tsx`

**Interfaces:**
- Consumes: `lucide-react`。
- Produces: `ICONS: Record<IconName, LucideIcon>`，类型 `IconName`（含 `home`/`dices`/`hammer`/`settings`/`book-open`/`scale`/`scroll-text`/`messages-square`/`layout-grid`/`pin`/`timer`/`eye`/`languages`/`moon`/`sun`/`palette`）。Task 7 用 `ICONS[name]` 取组件。

- [ ] **Step 1: 写 `src/icons.ts`（§1.4 映射，逐项照抄）**

```ts
import {
  Home, Dices, Hammer, Settings, BookOpen, Scale, ScrollText,
  MessagesSquare, LayoutGrid, Pin, Timer, Eye, Languages, Moon, Sun, Palette,
  type LucideIcon,
} from "lucide-react";

export type IconName =
  | "home" | "dices" | "hammer" | "settings"
  | "book-open" | "scale" | "scroll-text" | "messages-square"
  | "layout-grid" | "pin" | "timer" | "eye"
  | "languages" | "moon" | "sun" | "palette";

export const ICONS: Record<IconName, LucideIcon> = {
  home: Home,
  dices: Dices,
  hammer: Hammer,
  settings: Settings,
  "book-open": BookOpen,
  scale: Scale,
  "scroll-text": ScrollText,
  "messages-square": MessagesSquare,
  "layout-grid": LayoutGrid,
  pin: Pin,
  timer: Timer,
  eye: Eye,
  languages: Languages,
  moon: Moon,
  sun: Sun,
  palette: Palette,
};
```

- [ ] **Step 2: 写测试 `src/icons.test.tsx`**

```tsx
import { render } from "@testing-library/react";
import { ICONS } from "./icons.js";

it("每个语义名都映射到可渲染的 SVG 图标", () => {
  for (const name of Object.keys(ICONS) as (keyof typeof ICONS)[]) {
    const Icon = ICONS[name];
    const { container, unmount } = render(<Icon />);
    expect(container.querySelector("svg")).not.toBeNull();
    unmount();
  }
});
```

- [ ] **Step 3: 跑测试**

Run: `npm run test -w @dicelore/web`
Expected: icons 用例 + 已有 theme 用例全 PASS。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/icons.ts apps/web/src/icons.test.tsx
git commit -m "feat(web): Lucide 图标语义登记(视觉页 §1.4 映射)"
```

---

### Task 7: `apps/web` 外壳骨架（bar + 路由 + 四页壳）

bar（品牌 + 四页导航 + 工具区：语言/明暗/强调色）+ react-router 四路由 + 四个页面壳（主页/跑团/团本制作/配置静态占位，跑团页给出活动轨+中央+呈现台三栏空架）。

**Files:**
- Create: `apps/web/src/shell/TopBar.tsx`、`apps/web/src/shell/TopBar.css`
- Create: `apps/web/src/pages/HomePage.tsx`、`PlayPage.tsx`、`PlayPage.css`、`BuildPage.tsx`、`ConfigPage.tsx`
- Modify: `apps/web/src/App.tsx`（新建）、`apps/web/src/main.tsx`（换成挂 App）
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `react-router-dom`（`BrowserRouter`/`Routes`/`Route`/`NavLink`/`Outlet`）；Task 5 `useTheme`；Task 6 `ICONS`。
- Produces: `<App>`（含路由）；四个页面组件（默认导出）。

- [ ] **Step 1: 写 `src/shell/TopBar.tsx` + `TopBar.css`**

`TopBar.tsx`：

```tsx
import { NavLink } from "react-router-dom";
import { ICONS, type IconName } from "../icons.js";
import { useTheme } from "../theme/ThemeProvider.js";
import "./TopBar.css";

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "主页", icon: "home" },
  { to: "/play", label: "跑团", icon: "dices" },
  { to: "/build", label: "团本制作", icon: "hammer" },
  { to: "/config", label: "配置", icon: "settings" },
];

export function TopBar() {
  const { mode, setMode, accent, setAccent } = useTheme();
  const ModeIcon = ICONS[mode === "dark" ? "moon" : "sun"];
  const Languages = ICONS.languages;
  const Palette = ICONS.palette;
  const accents = ["gold", "copper", "teal", "crimson", "indigo"] as const;

  return (
    <header className="topbar">
      <span className="brand">Dicelore</span>
      <nav className="nav">
        {NAV.map(({ to, label, icon }) => {
          const Icon = ICONS[icon];
          return (
            <NavLink key={to} to={to} end={to === "/"} className="navitem">
              <Icon size={16} /> <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="tools">
        <button aria-label="语言"><Languages size={16} /></button>
        <button aria-label="明暗" onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
          <ModeIcon size={16} />
        </button>
        <button aria-label="强调色"><Palette size={16} /></button>
        <select aria-label="强调色选择" value={accent} onChange={(e) => setAccent(e.target.value as typeof accent)}>
          {accents.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
    </header>
  );
}
```

`TopBar.css`：

```css
.topbar {
  display: flex; align-items: center; gap: 24px;
  height: 48px; padding: 0 16px;
  background: var(--surface); border-bottom: 1px solid var(--line);
}
.brand { font-family: var(--font-display); font-weight: 700; font-size: 18px; color: var(--acc-soft); }
.nav { display: flex; gap: 4px; }
.navitem {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 6px;
  color: var(--text2); text-decoration: none;
}
.navitem:hover { background: var(--surface2); color: var(--text); }
.navitem.active { color: var(--acc-soft); background: var(--surface2); }
.tools { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.tools button {
  display: inline-flex; padding: 6px; border: none; border-radius: 6px;
  background: transparent; color: var(--text2); cursor: pointer;
}
.tools button:hover { background: var(--surface2); color: var(--text); }
.tools select {
  background: var(--surface2); color: var(--text); border: 1px solid var(--line);
  border-radius: 6px; padding: 4px 6px;
}
```

- [ ] **Step 2: 写四个页面壳**

`src/pages/HomePage.tsx`：

```tsx
export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontFamily: "var(--font-display)" }}>欢迎回到案上</h1>
      <p style={{ color: "var(--text2)" }}>继续上次 · 开新局 · 团本制作 · 配置（壳占位）</p>
    </main>
  );
}
```

`src/pages/PlayPage.tsx` + `PlayPage.css`（跑团三栏空架）：

```tsx
import "./PlayPage.css";

export default function PlayPage() {
  return (
    <div className="play">
      <aside className="rail" aria-label="活动轨">设定 / 规则 / 日志 / 会话</aside>
      <section className="center">叙事 + 打字（中央贯穿区占位）</section>
      <aside className="stage" aria-label="呈现台">呈现台（网格停靠占位 · 待 MCP 合并通真实数据）</aside>
    </div>
  );
}
```

`src/pages/PlayPage.css`：

```css
.play { display: grid; grid-template-columns: 56px 1fr 320px; height: 100%; }
.rail   { background: var(--surface);  border-right: 1px solid var(--line); padding: 12px 8px; color: var(--text3); font-size: 12px; }
.center { background: var(--bg);       padding: 24px; color: var(--text2); }
.stage  { background: var(--surface);  border-left: 1px solid var(--line);  padding: 16px; color: var(--text3); font-size: 12px; }
```

`src/pages/BuildPage.tsx`：

```tsx
export default function BuildPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontFamily: "var(--font-display)" }}>团本制作</h1>
      <p style={{ color: "var(--text2)" }}>组件5 Web 门面入壳（壳占位 · 待组件5 合并）</p>
    </main>
  );
}
```

`src/pages/ConfigPage.tsx`：

```tsx
export default function ConfigPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontFamily: "var(--font-display)" }}>配置</h1>
      <p style={{ color: "var(--text2)" }}>通用 / 服务与网络 / MCP 服务器 / 模型连接 / 主题外观 / 数据与存储（壳占位）</p>
    </main>
  );
}
```

- [ ] **Step 3: 写 `src/App.tsx`（路由 + 外壳）**

```tsx
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeProvider.js";
import { TopBar } from "./shell/TopBar.js";
import HomePage from "./pages/HomePage.js";
import PlayPage from "./pages/PlayPage.js";
import BuildPage from "./pages/BuildPage.js";
import ConfigPage from "./pages/ConfigPage.js";

function Shell() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ flex: 1, minHeight: 0 }}><Outlet /></div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<HomePage />} />
            <Route path="play" element={<PlayPage />} />
            <Route path="build" element={<BuildPage />} />
            <Route path="config" element={<ConfigPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
```

- [ ] **Step 4: 改 `src/main.tsx` 挂 App（替换 Task 5 的占位）**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import "./styles/tokens.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>,
);
```

> 注：`ThemeProvider` 现由 `App` 内部挂载，`main.tsx` 不再直接引它。

- [ ] **Step 5: 写测试 `src/App.test.tsx`（用 MemoryRouter 测导航与页面壳）**

> 把 `App.tsx` 拆出一个不含 `BrowserRouter` 的 `Shell`+`Routes` 片段不必要；测试改用 `MemoryRouter` 包一份等价路由树。为避免重复，给测试单独构造：

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeProvider.js";
import { TopBar } from "./shell/TopBar.js";
import HomePage from "./pages/HomePage.js";
import PlayPage from "./pages/PlayPage.js";

function tree(initial: string) {
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route element={<><TopBar /><Outlet /></>}>
            <Route index element={<HomePage />} />
            <Route path="play" element={<PlayPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

it("bar 渲染四个页面导航 + 品牌", () => {
  render(tree("/"));
  expect(screen.getByText("Dicelore")).toBeInTheDocument();
  for (const label of ["主页", "跑团", "团本制作", "配置"]) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
});

it("主页路由渲染主页壳", () => {
  render(tree("/"));
  expect(screen.getByText("欢迎回到案上")).toBeInTheDocument();
});

it("/play 路由渲染跑团三栏(活动轨 + 呈现台)", () => {
  render(tree("/play"));
  expect(screen.getByLabelText("活动轨")).toBeInTheDocument();
  expect(screen.getByLabelText("呈现台")).toBeInTheDocument();
});
```

- [ ] **Step 6: 跑测试**

Run: `npm run test -w @dicelore/web`
Expected: App(3) + icons(1) + theme(2) 全 PASS。

- [ ] **Step 7: typecheck + dev 冒烟**

Run: `npm run typecheck -w @dicelore/web`，再 `npm run dev -w @dicelore/web`
Expected: typecheck exit 0；浏览器见 bar（品牌+四导航+工具区），点击切页、切明暗/强调色生效。

- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): 外壳骨架(bar + 路由 + 主页/跑团/团本制作/配置 四页壳)"
```

---

## Self-Review

**Spec 覆盖**：接口页 §0（协议/类型源→protocol.ts + 全 schema）· §1 全量快照（PresentationSnapshotSchema + buildSnapshot）· §2 REST（rest.ts + server.ts 读侧两端点；写端点属阻塞，已在 Global Constraints 标注不做）· §4 WS 消息目录（stream.ts，类型就绪；推流属阻塞）· §4 delta（PresentationDeltaSchema）· §5 webhook（notify.ts；sink 接收属阻塞）· §6 版本（protocol 常量 + literal 校验）。视觉页 §1.1/1.2 token、§1.3 字体、§1.4 图标、§2 IA bar+四页、§4 跑团三栏壳、§9「可先做」清单全覆盖。阻塞项（MCP 接线/WS 推流/notify sink/团本制作真实能力/呈现台实时数据）与 B 项（呈现台改名、d10 裁决厘清）按选择（仅 A）显式排除并标注。

**占位扫描**：无 TBD/TODO/「类似上文」；每个 code step 给完整代码；server.ts 的 `title/ended` 是**有意的 v1 占位值**（已注明待写侧回填），非计划占位。

**类型一致**：`buildSnapshot(db, sessionId)` 签名在 Task 3 定义、Task 4 消费一致；`PresentationSnapshot`/`SheetGroup`/`ChoicesView` 在 shared 定义、orchestrator import 一致；`useTheme`/`AccentName`/`ICONS`/`IconName` 在 Task 5/6 定义、Task 7 消费一致；core barrel 导出的 `openDb`/`initSchema`/`buildPresentationModel` 与现有 `db.ts`/`model.ts` 真实签名一致（已核对源码）。

---

## Execution Handoff

见对话中的执行选择提示。
