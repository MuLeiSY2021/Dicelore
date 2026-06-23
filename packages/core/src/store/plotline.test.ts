// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import { plotlineUpsert, plotlineGet, plotlineList, plotlineSetStatus } from "./plotline.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("plotline store", () => {
  test("upsert 后 get（默认 status=open）", () => {
    plotlineUpsert(db, { id: "护山之争", title: "护山之争", summary: "魔道入侵大阵" });
    expect(plotlineGet(db, "护山之争")).toMatchObject({
      id: "护山之争", title: "护山之争", summary: "魔道入侵大阵", status: "open",
    });
  });
  test("setStatus 改 resolved；list 返回全部", () => {
    plotlineUpsert(db, { id: "p1", title: "剧情1" });
    plotlineSetStatus(db, "p1", "resolved");
    expect(plotlineGet(db, "p1")!.status).toBe("resolved");
    expect(plotlineList(db).map((p) => p.id)).toEqual(["p1"]);
  });
});
