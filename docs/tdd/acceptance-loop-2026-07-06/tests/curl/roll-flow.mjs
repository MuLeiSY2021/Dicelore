// 掷骰/暗骰主线的 HTTP+WS 编排探针（fake 教练档关键字驱动）。
// 明骰经 rollGate 挂起 → POST /messages 会阻塞直到 POST /roll 解 gate，故 message 请求由本 helper 持有，
// 不能在 bash 里 await。eventId 来自 WS roll_staged 帧（presentation.pendingRoll 恒 null·Phase 1）。
// 用法: node roll-flow.mjs <baseHttp> <sessionId> <roll|hidden>
// 输出（单行·供 bash 解析）:
//   roll   → EVENTID=<n> ROLL=<httpCode> MSG=<httpCode> COMMITTED=<0|1>
//   hidden → HIDDEN=<json|NONE> MSG=<httpCode>
//   失败   → ERROR:<原因>
const [, , base, sid, mode] = process.argv;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wsUrl = `${base}/sessions/dicegm/${sid}/ws`.replace(/^http/, "ws");
const frames = [];
const ws = new WebSocket(wsUrl);
ws.addEventListener("message", (e) => {
  try { frames.push(JSON.parse(typeof e.data === "string" ? e.data : "{}")); } catch { /* ignore */ }
});
try {
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", () => rej(new Error("ws open failed")));
    setTimeout(() => rej(new Error("ws open timeout")), 5000);
  });
} catch (e) {
  console.log(`ERROR:${e.message}`); process.exit(0);
}
const postMsg = (text) =>
  fetch(`${base}/sessions/dicegm/${sid}/messages`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }),
  });
const find = (t) => frames.find((f) => f.type === t);

if (mode === "roll") {
  const msgP = postMsg("我要掷骰翻墙"); // 阻塞在 roll gate 上
  let evid;
  for (let i = 0; i < 120 && evid === undefined; i++) {
    await sleep(50);
    const f = frames.find((f) => f.type === "roll_staged" && f.pendingRoll);
    if (f) evid = f.pendingRoll.eventId;
  }
  if (evid === undefined) { console.log("ERROR:no roll_staged frame"); process.exit(0); }
  const rr = await fetch(`${base}/sessions/dicegm/${sid}/roll`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: evid }),
  });
  const msg = await msgP; // 解 gate 后回合收尾
  // 等 roll_committed 帧（掷骰落 verdict）
  for (let i = 0; i < 40 && !find("roll_committed"); i++) await sleep(50);
  const committed = find("roll_committed") ? 1 : 0;
  console.log(`EVENTID=${evid} ROLL=${rr.status} MSG=${msg.status} COMMITTED=${committed}`);
  ws.close(); process.exit(0);
}

if (mode === "hidden") {
  // 暗骰:GM 立即掷、结果 visible=0，走 WS hidden_roll 帧（非 pendingRoll，message 不阻塞）。
  const msg = await postMsg("我要暗骰查探");
  let hf;
  for (let i = 0; i < 80 && !hf; i++) { await sleep(50); hf = find("hidden_roll"); }
  console.log(hf ? `HIDDEN=${JSON.stringify(hf)} MSG=${msg.status}` : `HIDDEN=NONE MSG=${msg.status}`);
  ws.close(); process.exit(0);
}
console.log("ERROR:unknown mode"); process.exit(0);
