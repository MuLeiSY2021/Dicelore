# acceptance-loop curl 套件共享件。被各转移脚本 source。
# 纪律：断言引 wiki/接口协议形状（铁律 1）；红=被测 bug（铁律 3 不改断言）；
# BLOCKED = 测试基建缺件（非断言失败），记 finding。

BASE="${DICELORE_BASE:-http://127.0.0.1:8787}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSERT="$DIR/assert.mjs"
PASS=0; FAIL=0; BLOCKED=0

# curl 绕过 WSL 代理（localhost 不走 Clash）。返回 body + 末行 %{http_code}。
# 每次请求带唯一 x-session-id：限流中间件(§6.3)对无 :id 路径参数的请求(catalog/diagnostics/mcp/keys/建会话)
# 会退化到共享的 "global" 桶(120/60s)；反复跑整套会自陷 429(限流本身按设计工作、非契约失败、阈值待验)。
# 真实客户端天然携带会话/客户端标识——给这些无 :id 请求各自唯一标识，令其分到独立桶而非共享 global，
# 使整套可反复确定性跑到 FAIL=0。对有 :id 的会话子资源，限流取路由 :id 优先、此 header 被忽略，per-session 限流不受影响。
req() { curl -s --noproxy '*' -H "x-session-id: rl-$(date +%s%N)-$RANDOM" -w '\n%{http_code}' "$@"; }

# check <name> <resp> <checks...>   resp = body\n<code>
check() {
  local name="$1" resp="$2"; shift 2
  local code body msg
  code="$(printf '%s' "$resp" | tail -n1)"
  body="$(printf '%s' "$resp" | sed '$d')"
  msg="$(printf '%s' "$body" | node "$ASSERT" "$code" "$@" 2>&1)"
  if [ -z "$msg" ]; then
    echo "  ✓ $name"; PASS=$((PASS+1))
  else
    printf '  ✗ %s — %s [code=%s body=%.140s]\n' "$name" "$msg" "$code" "$body"; FAIL=$((FAIL+1))
  fi
}

# block <name> <reason>  测试基建缺件，非断言失败
block() { echo "  ⛔ $1 — BLOCKED: $2"; BLOCKED=$((BLOCKED+1)); }

# uid  生成唯一 id（fixture 用；断言本身确定性）
uid() { echo "eval$(date +%s%N)$RANDOM"; }

# jget <resp> <path>  从 resp（body\n code）取 json 字段值
jget() {
  local resp="$1" path="$2" body
  body="$(printf '%s' "$resp" | sed '$d')"
  printf '%s' "$body" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const v=process.argv[1].split(".").filter(Boolean).reduce((a,k)=>a==null?undefined:a[k],j);process.stdout.write(v==null?"":typeof v==="object"?JSON.stringify(v):String(v))}catch{process.stdout.write("")}})' "$path"
}

# ── as-delivered fixture 助手（接口页 §1/§4）────────────────────────────────
# dicegm 建会话须先 POST /catalog/commit 造包拿 adventureId，再把它作 teamId（否则 400）。
# fixture 本身非被测——用真实合法 pack 走正路建局，为 dicegm 域子资源测试铺台。

# commit_fixture — 提交 fixture-pack 一个新版本，echo "<adventureId> <commitId>"
commit_fixture() {
  local pack resp
  pack="$(cat "$DIR/fixture-pack.json")"
  resp=$(req -X POST "$BASE/catalog/commit" -H 'content-type: application/json' \
    -d "{\"name\":\"eval-fx-$(uid)\",\"message\":\"fixture\",\"files\":$pack}")
  printf '%s %s' "$(jget "$resp" adventureId)" "$(jget "$resp" commitId)"
}

# new_dicegm — commit_fixture + POST /sessions/dicegm{teamId} → echo sessionId
new_dicegm() {
  local ac aid resp
  ac="$(commit_fixture)"; aid="${ac%% *}"
  resp=$(req -X POST "$BASE/sessions/dicegm" -H 'content-type: application/json' -d "{\"teamId\":\"$aid\"}")
  jget "$resp" sessionId
}

# new_loregm [name] — POST /sessions/loregm{name?} → echo sessionId
new_loregm() {
  local resp
  resp=$(req -X POST "$BASE/sessions/loregm" -H 'content-type: application/json' -d "{\"name\":\"${1:-eval}\"}")
  jget "$resp" sessionId
}
