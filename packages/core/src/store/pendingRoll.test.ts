// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "./db.js";
import { stagePendingRoll, getPendingRoll, markRollCommitted } from "./pendingRoll.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }

describe("pending_roll 槽", () => {
  it("stage 返回自增 eventId,get 回读规格、status=awaiting、verdictSeq=null", () => {
    const db = freshDb();
    const id = stagePendingRoll(db, { shape: "contest", spec: { context: "压价", a: { name: "你", expr: "1d20+{说服}" }, b: { name: "罗纳", expr: "15" } } });
    expect(typeof id).toBe("number");
    const row = getPendingRoll(db, id);
    expect(row?.shape).toBe("contest");
    expect(row?.status).toBe("awaiting");
    expect(row?.verdictSeq).toBeNull();
    expect((row?.spec as any).a.expr).toBe("1d20+{说服}");
  });

  it("多次 stage 各得不同 eventId", () => {
    const db = freshDb();
    const a = stagePendingRoll(db, { shape: "outcome", spec: { context: "x", die: "1d20", bands: [] } });
    const b = stagePendingRoll(db, { shape: "outcome", spec: { context: "y", die: "1d20", bands: [] } });
    expect(a).not.toBe(b);
  });

  it("markRollCommitted 置 committed + 记 verdictSeq", () => {
    const db = freshDb();
    const id = stagePendingRoll(db, { shape: "outcome", spec: { context: "x", die: "1d20", bands: [] } });
    markRollCommitted(db, id, 42);
    const row = getPendingRoll(db, id);
    expect(row?.status).toBe("committed");
    expect(row?.verdictSeq).toBe(42);
  });

  it("不存在的 eventId → undefined", () => {
    expect(getPendingRoll(freshDb(), 999)).toBeUndefined();
  });
});
