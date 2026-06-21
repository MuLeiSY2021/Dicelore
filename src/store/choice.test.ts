import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "./db.js";
import { eventSince } from "./event.js";
import { stagePendingChoice, getPendingChoice, materializePendingChoice } from "./choice.js";

function freshDb() {
  const db = openDb(":memory:");
  initSchema(db);
  return db;
}
const opts = [
  { label: "进", consequence: "遇敌" },
  { label: "退", consequence: "失机" },
];

describe("pending_choice 槽", () => {
  it("stage 后 get 回读,status=staged", () => {
    const db = freshDb();
    stagePendingChoice(db, "怎么走?", opts);
    const pc = getPendingChoice(db);
    expect(pc?.prompt).toBe("怎么走?");
    expect(pc?.options).toEqual(opts);
    expect(pc?.status).toBe("staged");
  });

  it("轮内反复 stage 末次覆盖(id=1 单行)", () => {
    const db = freshDb();
    stagePendingChoice(db, "A", opts);
    stagePendingChoice(db, "B", [{ label: "x", consequence: "y" }]);
    const pc = getPendingChoice(db);
    expect(pc?.prompt).toBe("B");
    expect(pc?.options).toHaveLength(1);
  });

  it("materialize 落 kind=choice/visible=1 event 并置 materialized", () => {
    const db = freshDb();
    stagePendingChoice(db, "怎么走?", opts);
    const seq = materializePendingChoice(db);
    expect(typeof seq).toBe("number");
    const evs = eventSince(db, 0).filter((e) => e.kind === "choice");
    expect(evs).toHaveLength(1);
    expect(evs[0].visible).toBe(1);
    expect(getPendingChoice(db)?.status).toBe("materialized");
  });

  it("空槽 get 回 undefined、materialize 回 undefined", () => {
    const db = freshDb();
    expect(getPendingChoice(db)).toBeUndefined();
    expect(materializePendingChoice(db)).toBeUndefined();
  });
});
