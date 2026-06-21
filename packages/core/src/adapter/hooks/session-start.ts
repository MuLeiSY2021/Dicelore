// packages/core/src/adapter/hooks/session-start.ts
// 薄入口:读 stdin(CC hook JSON,字段以实现期官方文档为准)→ openSession → 注 additionalContext。
import { openSession } from "../../session/resolve.js";
import { buildSessionContext } from "../sessionContext.js";

const { db } = openSession(); // env DICELORE_SESSION
const additionalContext = buildSessionContext(db);
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext },
}));
