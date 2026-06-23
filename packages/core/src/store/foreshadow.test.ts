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
import { foreshadowUpsert, foreshadowGet, foreshadowList, foreshadowSetStatus } from "./foreshadow.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("foreshadow store", () => {
  test("upsert 后 get（默认 status=planted）", () => {
    foreshadowUpsert(db, { id: "井中影", content: "水中映出一张陌生的脸" });
    expect(foreshadowGet(db, "井中影")).toMatchObject({
      id: "井中影", content: "水中映出一张陌生的脸", status: "planted",
    });
  });
  test("setStatus 改 recalled；list 返回全部", () => {
    foreshadowUpsert(db, { id: "fs1", content: "伏笔1" });
    foreshadowSetStatus(db, "fs1", "recalled");
    expect(foreshadowGet(db, "fs1")!.status).toBe("recalled");
    expect(foreshadowList(db).map((f) => f.id)).toEqual(["fs1"]);
  });
});
