// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../store/db.js";
import { createMcpServer, wrapToolForTest, type CanonWriteEvent } from "./server.js";

describe("createMcpServer onCanonWrite 接缝", () => {
  it("返回 McpServer 实例且不崩", () => {
    const db = openDb(":memory:");
    initSchema(db);
    expect(createMcpServer(db, {})).toBeTruthy();
  });

  it("规范态写工具(event_append)成功后触发 onCanonWrite(kind/toolName/seq)", async () => {
    const db = openDb(":memory:");
    initSchema(db);
    const events: CanonWriteEvent[] = [];
    const invoke = wrapToolForTest(db, { onCanonWrite: (e) => events.push(e) });
    await invoke("event_append", { kind: "narrate", content: "你推门进去" });
    expect(events.length).toBe(1);
    expect(events[0].kind).toBe("event");
    expect(events[0].toolName).toBe("event_append");
    expect(events[0].seq).toBeGreaterThan(0);
  });

  it("非规范态写工具(sheet_get 只读)不触发 onCanonWrite", async () => {
    const db = openDb(":memory:");
    initSchema(db);
    const events: CanonWriteEvent[] = [];
    const invoke = wrapToolForTest(db, { onCanonWrite: (e) => events.push(e) });
    await invoke("sheet_get", { entity: "张三" });
    expect(events.length).toBe(0);
  });
});
