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
