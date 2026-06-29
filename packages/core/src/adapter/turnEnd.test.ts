// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// packages/core/src/adapter/turnEnd.test.ts
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
});
