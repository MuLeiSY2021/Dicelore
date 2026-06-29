// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// packages/core/src/adapter/ruleRecall.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema, openSessionBackend } from "@dicelore/backend";
import { ruleUpsert } from "@dicelore/backend";
import { logAppend } from "@dicelore/backend";
import { metaGet } from "@dicelore/backend";
import { recallRules, recordTurnStart } from "./ruleRecall.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }

describe("rule 召回", () => {
  it("命中的 rule 内容进召回串", () => {
    const db = freshDb();
    ruleUpsert(db, { name: "战斗硬着陆", content: "战斗失败必须照后果结算,不得救场" });
    const ctx = recallRules(openSessionBackend(db), "我要发起战斗");
    expect(ctx).toContain("照后果结算");
  });

  it("无命中 → 空串", () => {
    const db = freshDb();
    expect(recallRules(openSessionBackend(db), "完全无关的闲聊")).toBe("");
  });
});

describe("turn_start_seq 记录", () => {
  it("写当前 MAX(seq)", () => {
    const db = freshDb();
    logAppend(db, { kind: "narrate", content: "x" }); // seq1
    const s = recordTurnStart(openSessionBackend(db), db);
    expect(s).toBe(1);
    expect(metaGet(db, "turn_start_seq")).toBe("1");
  });

  it("空 event 表 → 0", () => {
    const db = freshDb();
    expect(recordTurnStart(openSessionBackend(db), db)).toBe(0);
  });
});
