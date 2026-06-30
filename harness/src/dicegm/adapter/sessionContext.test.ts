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
import { metaSet } from "@dicelore/backend";
import { buildSessionContext } from "./sessionContext.js";

describe("buildSessionContext", () => {
  it("含 GM 身份 + Agenda 第0条 + 极简纪律", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const ctx = buildSessionContext(openSessionBackend(db));
    expect(ctx).toContain("诚实仲裁者");
    expect(ctx).toContain("dicelore-gm-core");
  });

  it("有团本调性 meta 时带上调性一句", () => {
    const db = openDb(":memory:");
    initSchema(db);
    metaSet(db, "tone", "黑暗修仙,慎用喜剧");
    expect(buildSessionContext(openSessionBackend(db))).toContain("黑暗修仙");
  });
});
