// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { testStdioMcp, createDiagnosticsApp } from "./diagnostics.js";

// 客制 MCP stdio 连接测试(裁决 custom-mcp-install §七):真拉起子进程 + MCP 握手 + listTools。
// 用 node 夹具 echo-mcp.mjs(注册 1 个 echo 工具),无网络、真 spawn。
const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "__fixtures__", "echo-mcp.mjs");

const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("testStdioMcp — 客制 stdio MCP 连接 + listTools", () => {
  it("能拉起夹具 MCP 并列出工具(toolCount=1)", async () => {
    const r = await testStdioMcp(process.execPath, [FIXTURE]);
    expect(r.ok).toBe(true);
    expect(r.toolCount).toBe(1);
  }, 15000);

  it("坏命令 → ok:false", async () => {
    const r = await testStdioMcp(process.execPath, ["-e", "process.exit(1)"], {}, 5000);
    expect(r.ok).toBe(false);
  }, 15000);

  it("缺 command → ok:false", async () => {
    expect((await testStdioMcp("", [])).ok).toBe(false);
  });
});

describe("POST /diagnostics/mcp-test stdio 分支覆盖客制 MCP", () => {
  const app = () => createDiagnosticsApp({ port: 8787, fakeGm: false });

  it("stdio + command/args → 200 + toolCount", async () => {
    const res = await app().request("/diagnostics/mcp-test", json({ transport: "stdio", command: process.execPath, args: [FIXTURE] }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; toolCount: number };
    expect(body.ok).toBe(true);
    expect(body.toolCount).toBe(1);
  }, 15000);

  it("stdio 坏命令 → 502", async () => {
    const res = await app().request("/diagnostics/mcp-test", json({ transport: "stdio", command: process.execPath, args: ["-e", "process.exit(2)"] }));
    expect(res.status).toBe(502);
  }, 15000);

  it("stdio 缺 command → 400", async () => {
    const res = await app().request("/diagnostics/mcp-test", json({ transport: "stdio" }));
    expect(res.status).toBe(400);
  });

  it("stdio 回落 endpoint 字符串拆分(旧契约兼容)", async () => {
    const res = await app().request("/diagnostics/mcp-test", json({ transport: "stdio", endpoint: `${process.execPath} ${FIXTURE}` }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { toolCount: number }).toolCount).toBe(1);
  }, 15000);
});
