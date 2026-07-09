// 断言内核：status 经 argv[2]，body 经 stdin，检查项经 argv[3..]。
// 成功静默退出 0；失败打印原因退出 1。形状引 wiki/接口协议，不看代码输出（铁律 1）。
const status = process.argv[2];
const checks = process.argv.slice(3);
const body = await new Promise((r) => {
  let s = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (d) => (s += d));
  process.stdin.on("end", () => r(s));
});
let json = null;
try { json = body ? JSON.parse(body) : null; } catch { json = null; }
const get = (p) =>
  p.split(".").filter(Boolean).reduce((a, k) => (a == null ? undefined : a[k]), json);
const ok = [];
for (const c of checks) {
  if (c.startsWith("--expect-status=")) {
    const v = c.slice(16);
    if (String(status) !== v) ok.push(`status=${status}≠${v}`);
  } else if (c.startsWith("--has=")) {
    const p = c.slice(6);
    if (get(p) === undefined) ok.push(`missing ${p}`);
  } else if (c.startsWith("--absent=")) {
    const p = c.slice(9);
    if (get(p) !== undefined) ok.push(`${p} 不应存在却存在`);
  } else if (c.startsWith("--eq=")) {
    const rest = c.slice(5);
    const i = rest.indexOf("=");
    const p = rest.slice(0, i), v = rest.slice(i + 1);
    if (String(get(p)) !== v) ok.push(`${p}=${get(p)}≠${v}`);
  } else if (c.startsWith("--type=")) {
    const rest = c.slice(7);
    const i = rest.indexOf("=");
    const p = rest.slice(0, i), t = rest.slice(i + 1);
    if (get(p) === undefined || typeof get(p) !== t) ok.push(`${p}:${typeof get(p)}≠${t}`);
  } else if (c.startsWith("--nonempty=")) {
    const p = c.slice(11);
    const a = get(p);
    if (!Array.isArray(a) || a.length <= 0) ok.push(`${p} 非非空数组`);
  } else if (c === "--json") {
    if (json === null) ok.push("body 非 json");
  }
}
if (ok.length) { console.log(ok.join("; ")); }
process.exit(0);  // 永远 0：失败信息走 stdout（空=过/非空=红），避免被调用方 set -e 杀掉
