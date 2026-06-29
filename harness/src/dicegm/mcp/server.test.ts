// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema, openSessionBackend } from "@dicelore/backend";
import { createMcpServer, wrapToolForTest, type CanonWriteEvent } from "./server.js";
import type { ToolDef } from "./tooldef.js";
import { z } from "zod";

describe("createMcpServer onCanonWrite 接缝", () => {
  it("返回 McpServer 实例且不崩", () => {
    const db = openDb(":memory:");
    initSchema(db);
    expect(createMcpServer(openSessionBackend(db), db, {})).toBeTruthy();
  });

  it("规范态写工具(event_append)成功后触发 onCanonWrite(kind/toolName/seq)", async () => {
    const db = openDb(":memory:");
    initSchema(db);
    const events: CanonWriteEvent[] = [];
    const invoke = wrapToolForTest(openSessionBackend(db), db, { onCanonWrite: (e: CanonWriteEvent) => events.push(e) });
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
    const invoke = wrapToolForTest(openSessionBackend(db), db, { onCanonWrite: (e: CanonWriteEvent) => events.push(e) });
    await invoke("sheet_get", { entity: "张三" });
    expect(events.length).toBe(0);
  });
});

describe("createMcpServer extraTools 接缝（声明式生成工具并入）", () => {
  function fakeReadTool(): ToolDef {
    return {
      name: "fake_board",
      title: "假板",
      description: "测试用",
      inputSchema: z.object({}).strict(),
      outputSchema: z.object({ result: z.unknown() }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      handler: () => ({ result: [{ ok: 1 }] }),
    };
  }

  it("extraTools 经 wrapToolForTest 可调", async () => {
    const db = openDb(":memory:");
    initSchema(db);
    const invoke = wrapToolForTest(openSessionBackend(db), db, {}, [fakeReadTool()]);
    const res = await invoke("fake_board", {});
    expect(res).toBeTruthy();
  });

  it("createMcpServer 接受 extraTools 不崩", () => {
    const db = openDb(":memory:");
    initSchema(db);
    expect(createMcpServer(openSessionBackend(db), db, {}, [fakeReadTool()])).toBeTruthy();
  });

  it("默认无 extraTools 时现有工具仍在（向后兼容）", async () => {
    const db = openDb(":memory:");
    initSchema(db);
    const invoke = wrapToolForTest(openSessionBackend(db), db, {});
    const res = await invoke("event_append", { kind: "narrate", content: "x" });
    expect(res).toBeTruthy();
  });
});
