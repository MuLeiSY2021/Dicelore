// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// 测试夹具：一个最小 stdio MCP server（注册 1 个工具 echo），供 testStdioMcp 端到端验
// 「按 stdio 拉起 + 握手 + listTools」。真跑子进程、无网络。node backend/src/api/__fixtures__/echo-mcp.mjs
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "echo-mcp", version: "0.0.0" });
server.registerTool(
  "echo",
  { title: "Echo", description: "回声", inputSchema: { text: z.string() } },
  async (args) => ({ content: [{ type: "text", text: String(args.text ?? "") }] }),
);
await server.connect(new StdioServerTransport());
