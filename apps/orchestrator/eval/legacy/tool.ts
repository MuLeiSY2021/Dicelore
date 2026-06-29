// eval/tool.ts — 对真 .db 执行一个 dicelore 工具(复用 runTool + TOOLS 注册表),写 event、回 JSON 结构化结果。
// 让 eval 的 GM 子agent 拿到真引擎结果(真随机掷骰 / 真 world_sample / narrate 真落 event / 机械回显真算),
// 使模拟局 faithful——不必嵌套 claude / 真 MCP server。明骰无 roll-gate → 降级立即掷(eval 够用)。
//   npx tsx eval/tool.ts <db> <toolName> '<jsonArgs>'
//   工具名可带或不带 dicelore_ 前缀。
import { openDb } from "../src/store/db.js";
import { TOOLS } from "../src/mcp/tools.js";
import { runTool } from "../src/mcp/runTool.js";

const [dbPath, rawName, jsonArgs] = process.argv.slice(2);
if (!dbPath || !rawName) {
  console.error("用法: npx tsx eval/tool.ts <db> <tool> '<jsonArgs>'");
  console.error("可用工具: " + TOOLS.map((t) => t.name).join(", "));
  process.exit(1);
}
const name = rawName.replace(/^dicelore_/, "");
const tool = TOOLS.find((t) => t.name === name);
if (!tool) {
  console.error(`未知工具: ${name}\n可用: ${TOOLS.map((t) => t.name).join(", ")}`);
  process.exit(1);
}

let args: unknown = {};
try { args = jsonArgs ? JSON.parse(jsonArgs) : {}; }
catch (e) { console.error(`jsonArgs 不是合法 JSON: ${(e as Error).message}`); process.exit(1); }

const db = openDb(dbPath); // db 由 run.ts 的 openSession 已建 schema + 灌种子
const res = await runTool(db, tool, args);
if (res.isError) {
  console.error("工具错误: " + (res.content?.[0]?.text ?? "(unknown)"));
  process.exit(2);
}
// structuredContent = 回 AI 的结构化结果(掷骰点数 / band / winner / staged 等)。
console.log(JSON.stringify(res.structuredContent ?? {}, null, 2));
