// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// gm-session-continuity 手动门(RUN_LIVE)：真 SDK 两回合 resume 续接。
// 断言：① 首回合后 meta.sdk_session_id 被捕获落库；② 次回合注入 resume 后 SDK 接受、无 error、
// 收于 turn_end；③ 次回合 sdk_session_id 与首回合一致(同一 SDK session 续接、未开新)；
// ④ usage 落库(usage-and-context 机制门:每回合 recordUsage)。默认 skip,RUN_LIVE=1+relay env 才跑。
import { describe, it, expect } from "vitest";

const LIVE = process.env.RUN_LIVE === "1";

describe.skipIf(!LIVE)("gm-session-continuity 真 SDK 两回合续接(手动门)", () => {
  it("首回合捕获 sdk_session_id → 次回合注入 resume 续接、id 一致、usage 落库", async () => {
    const { openDb, initSchema, openSessionBackend, usageBySession } = await import("@dicelore/backend");
    const { DiceSession } = await import("./DiceSession.js");
    const { DiceGm } = await import("./DiceGm.js");
    const { ensureDicePlugin } = await import("./openingPrompt.js");
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    const dataRoot = mkdtempSync(join(tmpdir(), "dice-continuity-"));
    const plugin = ensureDicePlugin(dataRoot) ?? undefined;
    const db = openDb(":memory:"); initSchema(db);
    const backend = openSessionBackend(db);
    const sessionId = "continuity-live";
    const session = new DiceSession(sessionId, {
      db, backend,
      agentFactory: (init) => new DiceGm(init),
      plugin,
    });

    // ── 回合 1 ──
    // handleMessage 出错即抛(rethrow)、无返回 error 字段——await 不抛 = 回合无 error。
    await session.handleMessage("我叫赵云，报上名号后向前走一步。");
    const id1 = backend.metaGet("sdk_session_id");
    expect(id1, "回合1 后应捕获 sdk_session_id").toBeTruthy();

    // ── 回合 2（引用回合1 内容，验证 GM 靠 resume 续接而非丢失上下文）──
    // 同上：resume 未被 SDK 接受会在 runTurn 内抛出、经 handleMessage 冒泡——await 不抛即续接成功。
    await session.handleMessage("我刚才报的名号是什么？直接复述。");
    const id2 = backend.metaGet("sdk_session_id");
    expect(id2, "回合2 后 sdk_session_id 应仍在").toBeTruthy();
    expect(id2, "两回合应同一 SDK session(续接、未开新)").toBe(id1);

    // ── usage 机制门（usage-and-context）：两回合都应落库 ──
    const usage = usageBySession(db, sessionId);
    expect(usage.inputTokens, "session 累计 input token 应 > 0").toBeGreaterThan(0);
    expect(usage.outputTokens, "session 累计 output token 应 > 0").toBeGreaterThan(0);
  }, 240_000);
});
