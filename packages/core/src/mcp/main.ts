// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { dirname } from "node:path";
import { openSession } from "../session/resolve.js";
import { initGlobalLogger, getLogger } from "../log.js";
import { createMcpServer } from "./server.js";

async function main() {
  const { db, path } = openSession(); // env: DICELORE_SESSION / DICELORE_SESSIONS_DIR
  // stdio server:日志必须走文件/stderr,绝不能进 stdout(会污染 JSON-RPC 协议流)。
  // 把全局 logger 切到会话文件夹的分级文件(createFileLogger 只写 *.log,不碰 stdout)。
  initGlobalLogger(dirname(path));
  const server = createMcpServer(db, {}); // stdio 路径无 onCanonWrite/rollGate(行为不变)
  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  // stdio server:启动失败错误经 logger 落文件 + stderr 兜底,均不进 stdout 的 JSON-RPC 流。
  getLogger().error({ err: e }, "dicelore mcp 启动失败");
  console.error("dicelore mcp 启动失败:", e); // logger 若在 init 前就抛(罕见),stderr 仍可见
  process.exit(1);
});
