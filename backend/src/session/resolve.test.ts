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
import { join, resolve } from "node:path";
import { metaGet, openSession, sessionDbPath } from "./resolve.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "dicelore-")); process.env.DICELORE_SESSIONS_DIR = dir; });
afterEach(() => { delete process.env.DICELORE_SESSIONS_DIR; rmSync(dir, { recursive: true, force: true }); });

describe("单根收敛:appDataRoot 复用 resolveDataDir(DD3)", () => {
  const orig = { data: process.env.DICELORE_DATA_DIR, sessions: process.env.DICELORE_SESSIONS_DIR };
  afterEach(() => {
    if (orig.data === undefined) delete process.env.DICELORE_DATA_DIR; else process.env.DICELORE_DATA_DIR = orig.data;
    if (orig.sessions === undefined) delete process.env.DICELORE_SESSIONS_DIR; else process.env.DICELORE_SESSIONS_DIR = orig.sessions;
  });

  test("无 DICELORE_SESSIONS_DIR 时走 resolveDataDir(DICELORE_DATA_DIR)", () => {
    delete process.env.DICELORE_SESSIONS_DIR;
    process.env.DICELORE_DATA_DIR = "/data/root-a";
    expect(sessionDbPath("团", "dice")).toBe(join(resolve("/data/root-a"), "sessions", "dice", "团", "session.db"));
  });

  test("显式 DICELORE_DATA_DIR 压过遗留 DICELORE_SESSIONS_DIR(单根,不再两套)", () => {
    process.env.DICELORE_SESSIONS_DIR = "/legacy/sess";
    process.env.DICELORE_DATA_DIR = "/data/root-b";
    expect(sessionDbPath("团", "dice")).toBe(join(resolve("/data/root-b"), "sessions", "dice", "团", "session.db"));
  });

  test("仅遗留 DICELORE_SESSIONS_DIR(无 DATA_DIR)仍兜底honored(eval/旧脚本)", () => {
    delete process.env.DICELORE_DATA_DIR;
    process.env.DICELORE_SESSIONS_DIR = "/legacy/only";
    expect(sessionDbPath("团", "dice")).toBe(join("/legacy/only", "sessions", "dice", "团", "session.db"));
  });
});

describe("session", () => {
  test("DICELORE_SESSIONS_DIR 覆盖根目录(DD2 布局 sessions/kind/id + session 自包含文件夹)", () => {
    expect(sessionDbPath("修仙团")).toBe(join(dir, "sessions", "dice", "修仙团", "session.db"));
    expect(sessionDbPath("修仙团", "lore")).toBe(join(dir, "sessions", "lore", "修仙团", "session.db"));
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
