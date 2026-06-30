// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema, openSessionBackend } from "@dicelore/backend";
import { logAppend, logSince } from "@dicelore/backend";
import { stagePendingChoice, getPendingChoice } from "@dicelore/backend";
import { metaSet } from "@dicelore/backend";
import { runTurnEnd } from "./turnEnd.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }

describe("runTurnEnd(Stop 装配)", () => {
  it("有暂存 choice + narrate → 物化 choice、无 block", () => {
    const db = freshDb();
    metaSet(db, "turn_start_seq", "0");
    logAppend(db, { kind: "narrate", content: "剧情" });
    stagePendingChoice(db, "走?", [{ label: "进", consequence: "遇敌" }]);
    const r = runTurnEnd(openSessionBackend(db), { transcriptHasText: true, stopHookActive: false });
    expect(r.block).toBeUndefined();
    expect(getPendingChoice(db)?.status).toBe("materialized");
    expect(logSince(db, 0).some((e) => e.kind === "choice")).toBe(true);
  });

  it("非终局无 choice → 返回 block", () => {
    const db = freshDb();
    metaSet(db, "turn_start_seq", "0");
    logAppend(db, { kind: "narrate", content: "剧情" });
    const r = runTurnEnd(openSessionBackend(db), { transcriptHasText: true, stopHookActive: false });
    expect(r.block?.reason).toContain("resolve_choice");
  });

  it("终局轮(game_end)无 choice → 豁免档A、不 block", () => {
    // 模拟 game_end 工具真实落库形态:note(visible=0,data_json) + metaSet("ended").
    // 旧实现嗅探 note.content "game_end" 恒 false,会把合法终局轮误判为'非终局把玩家晾着'而 block。
    const db = freshDb();
    metaSet(db, "turn_start_seq", "0");
    logAppend(db, { kind: "narrate", content: "决战" });
    logAppend(db, { kind: "note", visible: 0, data_json: { reason: "团灭", outcome: "全员阵亡" } });
    metaSet(db, "ended", JSON.stringify({ reason: "团灭", outcome: "全员阵亡", seq: 0 }));
    const r = runTurnEnd(openSessionBackend(db), { transcriptHasText: true, stopHookActive: false });
    expect(r.block).toBeUndefined();
  });
});
