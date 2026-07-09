# acceptance-loop curl 套件共享件。被各转移脚本 source。
# 纪律：断言引 wiki/接口协议形状（铁律 1）；红=被测 bug（铁律 3 不改断言）；
# BLOCKED = 测试基建缺件（非断言失败），记 finding。

BASE="${DICELORE_BASE:-http://127.0.0.1:8787}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSERT="$DIR/assert.mjs"
PASS=0; FAIL=0; BLOCKED=0

# curl 绕过 WSL 代理（localhost 不走 Clash）。返回 body + 末行 %{http_code}。
req() { curl -s --noproxy '*' -w '\n%{http_code}' "$@"; }

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
