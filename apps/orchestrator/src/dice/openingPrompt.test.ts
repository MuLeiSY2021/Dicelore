// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema, metaSet } from "@dicelore/core";
import { buildOpeningPrompt, buildBaselinePrompt } from "./openingPrompt.js";

describe("buildOpeningPrompt", () => {
  it("无 prologue:只 signpost(含 GM 身份 + consult gm-core)", () => {
    const db = openDb(":memory:"); initSchema(db);
    const p = buildOpeningPrompt(db);
    expect(p).toContain("Dicelore GM");
    expect(p).toContain("dicelore-gm-core");
    expect(p).not.toContain("团本开场");
    db.close();
  });
  it("有 prologue:signpost + 团本开场叠加", () => {
    const db = openDb(":memory:"); initSchema(db);
    metaSet(db, "prologue", "夜色如墨,你立于鹰愁涧口。");
    const p = buildOpeningPrompt(db);
    expect(p).toContain("Dicelore GM");          // signpost 层
    expect(p).toContain("团本开场");              // 分隔
    expect(p).toContain("夜色如墨,你立于鹰愁涧口。"); // prologue 层
    db.close();
  });
  it("buildBaselinePrompt 不含教条(纯 signpost+prologue)", () => {
    const db = openDb(":memory:"); initSchema(db);
    metaSet(db, "prologue", "夜色如墨。");
    const p = buildBaselinePrompt(db);
    expect(p).toContain("Dicelore GM");      // signpost 仍在
    expect(p).toContain("夜色如墨。");        // prologue 仍在
    expect(p).not.toContain("形状表");        // 教条去掉(形状表是教条独有,signpost 没有)
    db.close();
  });
});
