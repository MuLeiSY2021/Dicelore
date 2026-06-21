// packages/core/src/adapter/sessionContext.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../store/db.js";
import { metaSet } from "../session/resolve.js";
import { buildSessionContext } from "./sessionContext.js";

describe("buildSessionContext", () => {
  it("含 GM 身份 + Agenda 第0条 + 极简纪律", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const ctx = buildSessionContext(db);
    expect(ctx).toContain("诚实仲裁者");
    expect(ctx).toContain("dicelore-gm-core");
  });

  it("有团本调性 meta 时带上调性一句", () => {
    const db = openDb(":memory:");
    initSchema(db);
    metaSet(db, "tone", "黑暗修仙,慎用喜剧");
    expect(buildSessionContext(db)).toContain("黑暗修仙");
  });
});
