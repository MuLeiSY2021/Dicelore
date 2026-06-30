// RUN_LIVE:经 play-mcp handler 连真后端跑 orc-hunt 通路验证,烧真 glm-5.2。
// 不进单测。手动跑(从仓库根):npx tsx harness/eval-dicegm/run-live.ts
import { doOpenSession, doStartGame, doSendMessage, doGetPresentation } from "./play-mcp.js";

process.env.DICELORE_PLAY_URL ??= "http://127.0.0.1:8787";
process.env.DICELORE_SESSIONS_DIR ??= "/tmp/dl-eval-doctrine";

const scenario = process.argv[2] ?? "orc-hunt";
console.log(`[run-live] scenario=${scenario} play=${process.env.DICELORE_PLAY_URL} dir=${process.env.DICELORE_SESSIONS_DIR}`);

const sid = await doOpenSession(scenario);
console.log(`[run-live] sessionId=${sid}`);

const start = await doStartGame(sid);
console.log(`[run-live] === 开场 narrations (turnEnded=${start.turnEnded}) ===`);
for (const n of start.narrations) console.log(n);

const pres = await doGetPresentation(sid) as { choices?: unknown[] };
console.log(`[run-live] === presentation: choices=${pres.choices?.length ?? 0} ===`);

// 推一拍玩家行动(按场景 orc-hunt:去森林)
const send = await doSendMessage(sid, "我拔剑警戒，慢慢推门进去看看。");
console.log(`[run-live] === 第2轮 narrations (turnEnded=${send.turnEnded}) ===`);
for (const n of send.narrations) console.log(n);

const pres2 = await doGetPresentation(sid) as { choices?: unknown[] };
console.log(`[run-live] === presentation2: choices=${pres2.choices?.length ?? 0} ===`);
console.log("[run-live] done");
