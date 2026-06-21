// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { openSession } from "../session/resolve.js";
import { TOOLS } from "./tools.js";
import { runTool } from "./runTool.js";

async function main() {
  const { db } = openSession(); // env: DICELORE_SESSION / DICELORE_SESSIONS_DIR
  const server = new McpServer({ name: "dicelore", version: "0.0.0" });

  for (const t of TOOLS) {
    server.registerTool(
      `dicelore_${t.name}`,
      {
        title: t.title,
        description: t.description,
        inputSchema: t.inputSchema.shape,
        outputSchema: t.outputSchema.shape,
        annotations: t.annotations,
      },
      (args: unknown) => runTool(db, t, args) as any,
    );
  }

  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  // stdio server:错误打到 stderr,不污染 stdout 的 JSON-RPC 流。
  console.error("dicelore mcp 启动失败:", e);
  process.exit(1);
});
