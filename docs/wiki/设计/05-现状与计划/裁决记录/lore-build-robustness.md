---
title: 裁决 · lore-build-robustness（组件5/6 余下）
---

# 裁决：lore-build-robustness —— 团本构建组件5/6 余下（构建 MCP + Skill 侧健壮性收尾）

- [ ] 用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 路线图项：里程碑一 · 地基「团本构建 组件5/6 余下（构建 MCP + 构建 Skill）」。此前该项标「已裁决」却无链接裁决文件（铁律 = 实为未裁决的历史欠账）——本文件补齐。
> **范围界定（要紧）**：组件5/6 **核心已建成** ✅（构建 MCP `dicelore_build_*`、构建 skill `dicelore-build-pack`、`importPack` 四域+叙事域物化、toolgen 引擎/视图/叙事标准库、团本自定义 `tools:` import 装载）。本裁决只收「构建侧健壮性 4 条收尾」；**源摄入重设计（工作区+agentic 文件）另见 [build-agent-workspace](build-agent-workspace.md)**。
> backlog：[BE-lore-error-shape / BE-lore-test-gap / BE-lore-prompt-fallback / BE-checkout-head](../backlog-后端.md)（本裁决合并这 4 条为一个交付单元）。
> 来源：2026-06-30 113-agent review（前 3 条）+ 2026-06-26 N20 浮现（BE-checkout-head）；2026-07-01 用户要求补裁决文件。
> **协同**：与 [build-agent-workspace](build-agent-workspace.md) 文件重叠——① BE-lore-error-shape 与其同触 `LoreSession.handleMessage`/`api/lore.ts`；② BE-lore-prompt-fallback 读的 SKILL 正文正是其重写对象。**若两裁决同波交付，重叠合并由主 agent 集成时解**；若分波，本裁决可先行（不依赖工作区）。

---

## 背景（顺带修一处 wiki 漂移）

组件5/6 核心已完工，[04 团本构建工具链 §7 line 133](../../04-子系统设计/团本构建工具链.md) 仍写「🚧 仍欠：团本自定义 `tools:` 段 import 装载」——**已 stale**（[backlog-core 主题A′③](../backlog-core.md) 记该项 2026-06-26 ✅）。交付本裁决时**顺手把 04 那句现状改为 ✅**（见「完成后」）。

「余下」= 构建侧四处健壮性缺口，均为 backlog 已详列、行为待钉死的小改，构成一个内聚的「构建 MCP/Skill/LoreSession 收尾」交付单元。

---

## 设计（零不确定，仅剩代码实现）

### 1. BE-lore-error-shape：`handleMessage` 不再吞 error

- **现状**：`harness/src/loregm/LoreSession.ts` `handleMessage` 的 `for await (ev of driver.runTurn)` 对 `turn_end` 与 `error` 一视同仁 `break`，然后无条件 `return { turnId }`；`backend/src/api/lore.ts` 据此无条件返回。构建 agent 中途 error（LLM 失败/工具异常/`FakeDiceGm` error 档）时调用方无从区分。
- **改**：
  - `LoreSession.handleMessage` 返回类型 `{ turnId: string }` → `{ turnId: string; error?: { message: string; code?: string } }`。循环内捕获 `ev.type === "error"` 时记下 `{ message: ev.message, code: ev.code }`，`turn_end` 时不带 error。
  - `Session` 接口（`harness/src/runtime/session.ts`）中 lore 的返回类型同步放宽（若 `Session.handleMessage` 是共享签名，用可选 `error?` 向后兼容，dice 侧不产 error 字段、零影响）。
  - `api/lore.ts` `POST /lore-sessions/:id/messages`：**返回体带 `error?`**——`{ turnId, error? }`。**HTTP 状态决策（钉死）**：turn 已实际跑完（turnId 有效），error 属**领域级**而非传输级 → **保持 HTTP 200/202 现状不变，靠 body 的 `error` 字段标失败**（不改成 5xx——5xx 语义是"请求没被处理"，与"跑了但 GM 出错"不符）。调用方（build-mcp / 前端构建台）以 `body.error` 存在与否判成败。
  - build-mcp `doSendToBuilder`（`harness/eval-loregm/build-mcp.ts`）返回类型加 `error?` 透传（`send_to_builder` 结果 JSON 带 error 时作者可见），不吞。

### 2. BE-lore-prompt-fallback：loregm 教条保证投递内联兜底

- **现状**：dicegm 侧 `openingPrompt.ts` 把 gm-core 教条内联进 systemPrompt 作兜底（staged skill 加载不通仍有教条）；loregm 侧只有 `buildPackSkill()`（返 staged ref 或 null），**无等价内联兜底**。`LoreSession.ts` openingPrompt = `deps.buildPrompt ?? env.DICELORE_BUILD_PROMPT ?? ""`，常态 env 未设 → 全靠 staged skill；`buildPackDir()` 因目录布局变动返 null 时 agent 拿到**空白 system prompt**，无声退化成无教条构建。
- **改**：`harness/src/loregm/openingPrompt.ts` 加 `buildOpeningPrompt(): string`，对称 dicegm `gmCoreDoctrine`——读 `dicelore-build-pack/SKILL.md` 正文（剥 frontmatter）作 buildPrompt 默认值；解析失败返回一段**最小内联兜底教条**（一句话：「你在构建团本，把素材提炼成 Dicelore 团本包，只声明不跑团」）而非空串。`LoreSession` openingPrompt 解析链改为 `deps.buildPrompt ?? env.DICELORE_BUILD_PROMPT ?? buildOpeningPrompt()`（去掉 `?? ""` 空兜底）。`server.ts` 组合根据此传值。
- **协同**：`buildOpeningPrompt()` 读的是**当前** SKILL 正文；若与 [build-agent-workspace](build-agent-workspace.md) 同波（那边重写 SKILL），读到的即重写后版本，无冲突。

### 3. BE-lore-test-gap：`LoreSession.test.ts` 补投递 + error 收尾覆盖

- 加用例：`agentFactory` 捕获传入的 `AgentInit`，**断言** `deps.buildPrompt`（或 §2 的内联兜底）透传为 `init.openingPrompt`、`deps.skills` 透传为 `init.skills`（现测 `() => new FakeDiceGm()` 忽略 init，空 prompt 退化不会被捕获）。
- 加用例：`FakeDiceGm` error 档驱动 `handleMessage`，**断言**返回 `{ turnId, error: {...} }`（配 §1 验 error 不被吞）。

### 4. BE-checkout-head：`GET /catalog/:id/files?ref=head` 解析（小、独立）

- **现状**：端点默认 `ref ?? "head"`，但 core `checkout` 只认 tag label / commitId、**不认 "head" 关键字**，默认查 head 返回 `[]`。
- **改（钉死在端点层，不动 core checkout 语义）**：`api/lore.ts`（或 catalog 端点所在）在 `ref` 省略或等于 `"head"` 时，**先从 catalog list 取该 adventure 的 head commitId**，再用它调 `checkout`。core `checkout` 契约不变（最小侵入）。

---

## 验收

- `npm run typecheck` + `npm test`（backend/harness）全绿。
- **§1**：`LoreSession.test.ts` error 档用例验返回带 `error`；`api/lore.ts` 端点测验 error 轮 body 含 `error`、成功轮不含；build-mcp `build-mcp.test.ts` 验 `doSendToBuilder` 透传 error。
- **§2**：`openingPrompt.test.ts`（loregm）验 `buildOpeningPrompt()` 剥 frontmatter 返 SKILL 正文；SKILL 解析失败返非空最小兜底。
- **§3**：`LoreSession.test.ts` 新增投递断言（buildPrompt/skills 透传）通过。
- **§4**：catalog files 端点测验 `ref=head` / 省略 `ref` 返 head commit 的文件（非 `[]`）。
- 回归：dice 侧零改动确认（`Session` 返回类型放宽为可选 `error?`，dice 路径不产该字段）。

## owns（预期触及，非独占）

- `harness/src/loregm/LoreSession.ts`（handleMessage error 捕获 + 返回 shape）+ `LoreSession.test.ts`（§1/§3）
- `harness/src/loregm/openingPrompt.ts`（§2 buildOpeningPrompt 内联兜底）+ `openingPrompt.test.ts`
- `harness/src/runtime/session.ts`（`Session.handleMessage` 返回类型放宽 error?，若共享）
- `backend/src/api/lore.ts`（§1 端点 error 透传 + §4 ref=head 解析）+ 端点测
- `backend/src/server.ts`（§2 openingPrompt 解析链接线）
- `harness/eval-loregm/build-mcp.ts`（§1 doSendToBuilder error 透传）+ `build-mcp.test.ts`
- `docs/wiki/设计/04-子系统设计/团本构建工具链.md`（line 133 stale 现状改 ✅）

## 完成后

- 沉淀进 [04-子系统设计/团本构建工具链](../../04-子系统设计/团本构建工具链.md)：① line 133「🚧 仍欠 tools: import」改 ✅（漂移修正）；② 「决策与权衡」节补一句「lore 构建 REST-only 的 error 经 body `error` 字段回、教条内联兜底保证投递」。
- 关 backlog [BE-lore-error-shape / BE-lore-test-gap / BE-lore-prompt-fallback / BE-checkout-head](../backlog-后端.md)（→ 已达成）。
- 勾路线图该项（未裁决 → 已归档链路）。
- **删本裁决文件**（过渡稿，内容已落 wiki）。
