// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { beforeEach, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import { anchorAdd, anchorsByOwner, anchorsByTarget } from "./anchor.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

test("正查 owner / 反查 target", () => {
  anchorAdd(db, { owner_table: "plotline", owner_id: "护山之争", target_table: "entity", target_id: "墨大夫", role: "antagonist" });
  anchorAdd(db, { owner_table: "foreshadow", owner_id: "井中影", target_table: "entity", target_id: "墨大夫" });
  expect(anchorsByOwner(db, "plotline", "护山之争").map((a) => a.target_id)).toEqual(["墨大夫"]);
  // 反查：挂在墨大夫上的所有线/伏笔（A4 到点浮现）
  expect(anchorsByTarget(db, "entity", "墨大夫").map((a) => a.owner_id).sort()).toEqual(["井中影", "护山之争"]);
});
