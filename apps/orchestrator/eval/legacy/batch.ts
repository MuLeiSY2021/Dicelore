// eval/batch.ts — faithful 批量驱动：一进程对真 .db 顺序执行一批 dicelore 工具调用，
// 复用 runTool + TOOLS（真随机/真抽样/narrate真落event/机械回显真算），省去逐个 npx 启动开销。
// 仍 faithful——同 eval/tool.ts 的真引擎，只是批量。两阶段用法保真：先跑掷骰批拿真结果，再据真结果跑 narrate 批。
//   npx tsx eval/batch.ts <db> <calls.json> [--log <transcript.jsonl>]
// calls.json = [{ "tool": "resolve_outcome_open", "args": {...} }, ...]（tool 名可带或不带 dicelore_ 前缀）
import { readFileSync, appendFileSync } from "node:fs";
import { openDb } from "../src/store/db.js";
import { TOOLS } from "../src/mcp/tools.js";
import { runTool } from "../src/mcp/runTool.js";

const [dbPath, callsPath] = process.argv.slice(2);
const logIdx = process.argv.indexOf("--log");
const logPath = logIdx > 0 ? process.argv[logIdx + 1] : undefined;
if (!dbPath || !callsPath) {
  console.error("用法: npx tsx eval/batch.ts <db> <calls.json> [--log <jsonl>]");
  process.exit(1);
}
const calls = JSON.parse(readFileSync(callsPath, "utf8")) as { tool: string; args?: unknown }[];
const db = openDb(dbPath);

for (let i = 0; i < calls.length; i++) {
  const { tool: rawName, args = {} } = calls[i];
  const name = rawName.replace(/^dicelore_/, "");
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) { console.log(`[${i}] ${rawName} => 未知工具`); continue; }
  const res = await runTool(db, tool, args);
  const out = res.isError
    ? { ERROR: res.content?.[0]?.text ?? "(unknown)" }
    : (res.structuredContent ?? {});
  console.log(`[${i}] ${name} => ${JSON.stringify(out)}`);
  if (logPath) appendFileSync(logPath, JSON.stringify({ i, tool: name, args, out }) + "\n");
}
