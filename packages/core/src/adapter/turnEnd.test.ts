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
