// WS 探针：连 ws://…/<sid>/ws，收 2.5s 帧，打印 "FRAMES:<n>" + 各帧 type。
// 用法: node ws-probe.mjs <http-url-of-ws-endpoint>
const url = process.argv[2].replace(/^http/, "ws");
let n = 0;
const types = [];
const ws = new WebSocket(url);
const done = () => { console.log(`FRAMES:${n} TYPES:${types.join(",")}`); process.exit(0); };
ws.addEventListener("open", () => { /* 服务器先发 snapshot */ });
ws.addEventListener("message", (e) => {
  n++;
  try { const o = JSON.parse(typeof e.data === "string" ? e.data : "{}"); types.push(o.type ?? "?"); } catch { types.push("raw"); }
});
ws.addEventListener("error", (e) => { console.log(`ERROR:${e.message ?? "ws"}`); process.exit(1); });
setTimeout(done, 2500);
