// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// dicegm-skill-corpus-distill RD-4 行为抽查(RUN_LIVE)：改进后的 gm-core 教条(强化「先问该不该骰」)
// 面对一个明显含不确定/风险的玩家动作时，是否**恰当发起掷骰**(resolve_*→pending_roll/verdict)，
// 而非退化为「只给选项」。非严格统计 eval(那是 play-eval 研究)，只作 proportionate 行为证据。
import { describe, it, expect } from "vitest";

const LIVE = process.env.RUN_LIVE === "1";

describe.skipIf(!LIVE)("RD-4 教条改进行为抽查(手动门·spot-check)", () => {
  it("含风险不确定的动作 → GM 恰当发起掷骰(而非只给选项)", async () => {
    const { openDb, initSchema, openSessionBackend } = await import("@dicelore/backend");
    const { DiceSession } = await import("./DiceSession.js");
    const { DiceGm } = await import("./DiceGm.js");
    const { ensureDicePlugin } = await import("./openingPrompt.js");
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    const dataRoot = mkdtempSync(join(tmpdir(), "dice-rd4-"));
    const plugin = ensureDicePlugin(dataRoot) ?? undefined;
    const db = openDb(":memory:"); initSchema(db);
    const backend = openSessionBackend(db);
    // debug=true：不注入 rollGate，明骰走「立即掷」降级(否则 await 永不来的 POST /roll 卡死)。
    const session = new DiceSession("rd4-live", {
      db, backend, agentFactory: (init) => new DiceGm(init), plugin, debug: true,
    });

    // handleMessage 出错即抛(rethrow)、无返回 error 字段——await 不抛 = 回合无 error。
    await session.handleMessage("我猛地用肩膀撞向这扇沉重的橡木门，想把它一次撞开。");

    // 观测：本回合是否产生了掷骰痕迹(pending_roll 行 或 kind=verdict 事件)。
    const pr = db.prepare("SELECT COUNT(*) c FROM pending_roll").get() as { c: number };
    const verdicts = db.prepare("SELECT COUNT(*) c FROM log WHERE kind='verdict'").get() as { c: number };
    const rolled = pr.c > 0 || verdicts.c > 0;
    // 打印观测供人读(骰/叙事各是什么)。
    const logs = db.prepare("SELECT kind, substr(content,1,60) c FROM log ORDER BY seq").all();
    console.log("RD-4 观测: pending_roll=", pr.c, "verdict=", verdicts.c, "| log:", JSON.stringify(logs));
    expect(rolled, "撞门这类含风险不确定动作，改进后的 GM 应发起掷骰(pending_roll 或 verdict)，而非只给选项").toBe(true);
  }, 180_000);
});
