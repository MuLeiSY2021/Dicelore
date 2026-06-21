// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { openSession } from "../session/resolve.js";
import { createMcpServer } from "./server.js";

async function main() {
  const { db } = openSession(); // env: DICELORE_SESSION / DICELORE_SESSIONS_DIR
  const server = createMcpServer(db, {}); // stdio 路径无 onCanonWrite/rollGate(行为不变)
  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  // stdio server:错误打到 stderr,不污染 stdout 的 JSON-RPC 流。
  console.error("dicelore mcp 启动失败:", e);
  process.exit(1);
});
