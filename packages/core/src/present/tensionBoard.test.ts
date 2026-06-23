// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { beforeEach, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "../store/db.js";
import { frontUpsert, frontSetStatus } from "../store/front.js";
import { plotlineUpsert } from "../store/plotline.js";
import { foreshadowUpsert, foreshadowSetStatus } from "../store/foreshadow.js";
import { watcherSet } from "../store/watcher.js";
import { tensionBoard } from "./tensionBoard.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

test("只列未结张力：active front / open|active plotline / planted foreshadow / armed watcher", () => {
  frontUpsert(db, { id: "f1", name: "活线" });
  frontUpsert(db, { id: "f2", name: "已了" }); frontSetStatus(db, "f2", "spent");
  plotlineUpsert(db, { id: "p1", title: "开着的" });               // open
  foreshadowUpsert(db, { id: "fs1", content: "埋着" });            // planted
  foreshadowUpsert(db, { id: "fs2", content: "已收" }); foreshadowSetStatus(db, "fs2", "recalled");
  watcherSet(db, { condition: "{世界.年} > 100", payload: "x" });   // armed

  const b = tensionBoard(db);
  expect(b.fronts.map((f) => f.id)).toEqual(["f1"]);              // 不含 spent f2
  expect(b.plotlines.map((p) => p.id)).toEqual(["p1"]);
  expect(b.foreshadows.map((f) => f.id)).toEqual(["fs1"]);        // 不含 recalled fs2
  expect(b.watchers.length).toBe(1);
});
