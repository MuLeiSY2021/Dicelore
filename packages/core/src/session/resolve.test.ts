// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { metaGet, openSession, sessionDbPath } from "./resolve.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "dicelore-")); process.env.DICELORE_SESSIONS_DIR = dir; });
afterEach(() => { delete process.env.DICELORE_SESSIONS_DIR; rmSync(dir, { recursive: true, force: true }); });

describe("session", () => {
  test("DICELORE_SESSIONS_DIR 覆盖根目录", () => {
    expect(sessionDbPath("修仙团")).toBe(join(dir, "dicelore", "sessions", "修仙团.db"));
  });
  test("openSession 建库 + 写 meta", () => {
    const s = openSession("修仙团");
    expect(s.name).toBe("修仙团");
    expect(metaGet(s.db, "display_name")).toBe("修仙团");
    expect(metaGet(s.db, "schema_version")).toBe("1");
    expect(metaGet(s.db, "created_at")).toBeTruthy();
  });
  test("不存在即建、再开同名复用", () => {
    openSession("团A").db.prepare("INSERT INTO state(entity,attr,value,visible) VALUES ('x','y','1',0)").run();
    const again = openSession("团A");
    expect(again.db.prepare("SELECT value FROM state WHERE entity='x'").get()).toMatchObject({ value: "1" });
  });
});
