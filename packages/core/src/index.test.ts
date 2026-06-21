// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

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
