// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "../db.js";
import { plotlineUpsert, plotlineGet, plotlineList, plotlineSetStatus } from "./plotline.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("plotline store", () => {
  test("upsert 后 get（默认 status=open）", () => {
    plotlineUpsert(db, { id: "护山之争", title: "护山之争", summary: "魔道入侵大阵" });
    expect(plotlineGet(db, "护山之争")).toMatchObject({
      id: "护山之争", title: "护山之争", summary: "魔道入侵大阵", status: "open", visible: 0,
    });
  });
  test("upsert 默认 visible=0；重复 upsert 不复位已 show 的 visible", () => {
    plotlineUpsert(db, { id: "p1", title: "剧情1" });
    expect(plotlineGet(db, "p1")!.visible).toBe(0);
    db.prepare("UPDATE plotline SET visible=1 WHERE id='p1'").run();
    plotlineUpsert(db, { id: "p1", title: "剧情1改", summary: "新摘要" }); // 二次 upsert
    expect(plotlineGet(db, "p1")!.visible).toBe(1); // show 过的 visible 不被 upsert 抹回 0
  });
  test("setStatus 改 resolved；list 返回全部", () => {
    plotlineUpsert(db, { id: "p1", title: "剧情1" });
    plotlineSetStatus(db, "p1", "resolved");
    expect(plotlineGet(db, "p1")!.status).toBe("resolved");
    expect(plotlineList(db).map((p) => p.id)).toEqual(["p1"]);
  });
});
