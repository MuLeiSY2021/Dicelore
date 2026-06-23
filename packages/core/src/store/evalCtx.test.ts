// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { expect, test } from "vitest";
import { openDb, initSchema } from "./db.js";
import { stateSet } from "./state.js";
import { plotlineUpsert } from "./plotline.js";
import { makeEvalCtx } from "./evalCtx.js";

test("getRef: 裸名 与 state: 前缀都走 state", () => {
  const db = openDb(":memory:"); initSchema(db);
  stateSet(db, "张三", "HP", "20");
  const ctx = makeEvalCtx(db);
  expect(ctx.getRef("张三", "HP")).toBe("20");
  expect(ctx.getRef("state:张三", "HP")).toBe("20");
});

test("ctx 带 existsMatch", () => {
  const db = openDb(":memory:"); initSchema(db);
  plotlineUpsert(db, { id: "p", title: "t", status: "open" });
  const ctx = makeEvalCtx(db);
  expect(ctx.existsMatch!("plotline", [{ col: "status", op: "=", val: "open" }])).toBe(true);
});
