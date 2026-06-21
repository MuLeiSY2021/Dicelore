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
