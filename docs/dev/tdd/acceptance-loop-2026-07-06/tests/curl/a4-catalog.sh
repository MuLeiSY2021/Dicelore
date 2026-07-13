#!/usr/bin/env bash
# A4 catalog 团本产物库（as-delivered 据 1-backend-interface §4 / B3 团本目录页）
# catalog 独立于会话面；GET /catalog →{adventure}（key=adventure）；import 在建 dicegm 会话时选版本。
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
echo "━━━ A4 catalog 团本产物库 ━━━"

# —— 目录（🟡 响应 key = adventure）——
resp=$(req "$BASE/catalog")
check "目录 GET /catalog →200{adventure[]}" "$resp" --expect-status=200 --has adventure

# —— 提交版本（fixture 合法 pack）——
PACK="$(cat "$DIR/fixture-pack.json")"
resp=$(req -X POST "$BASE/catalog/commit" -H 'content-type: application/json' \
  -d "{\"name\":\"eval-fixture-$(uid)\",\"message\":\"fixture\",\"files\":$PACK}")
check "提交版本 POST /catalog/commit →201{adventureId,commitId}" "$resp" --expect-status=201 --has adventureId --has commitId
AID="$(jget "$resp" adventureId)"
CID="$(jget "$resp" commitId)"
echo "    fixture adventureId=$AID commitId=$CID"

# —— 版本包文件（ref=head · 端点层解析 head）——
resp=$(req "$BASE/catalog/$AID/files?ref=head")
check "版本包文件 GET /catalog/:id/files?ref=head →200{files[]非空}" "$resp" --expect-status=200 --has files --nonempty=files

# —— 整包校验（ValidateReport {ok,issues}）——
resp=$(req -X POST "$BASE/catalog/validate" -H 'content-type: application/json' -d "{\"files\":$PACK}")
check "整包校验 POST /catalog/validate →200{ok,issues}" "$resp" --expect-status=200 --has ok --has issues

# —— 打标签 ——
resp=$(req -X POST "$BASE/catalog/$AID/tag" -H 'content-type: application/json' -d "{\"commitId\":\"$CID\",\"label\":\"v-eval\"}")
check "打标签 POST /catalog/:id/tag →201{ok}" "$resp" --expect-status=201 --eq=ok=true

# —— 开始游戏 import：建 dicegm 会话时选版本（合法 pack + version=commitId → 201 正路）——
resp=$(req -X POST "$BASE/sessions/dicegm" -H 'content-type: application/json' -d "{\"teamId\":\"$AID\",\"version\":\"$CID\"}")
check "import 建局 POST /sessions/dicegm{teamId,version=commitId} →201{sessionId,kind}" "$resp" \
  --expect-status=201 --has sessionId --eq=kind=dicegm

# —— version=head / 省略应与 /files 一致解析（端点层解析 head·BE-checkout-head）——
resp=$(req -X POST "$BASE/sessions/dicegm" -H 'content-type: application/json' -d "{\"teamId\":\"$AID\",\"version\":\"head\"}")
check "import 建局 version=head →201（端点层解析 head·对齐 /files）" "$resp" --expect-status=201 --has sessionId

# —— 信任闸门：畸形/无效包应结构化拒（400 invalid_pack·非 500）——
BADRESP=$(req -X POST "$BASE/catalog/commit" -H 'content-type: application/json' \
  -d "{\"name\":\"eval-bad-$(uid)\",\"message\":\"bad\",\"files\":[{\"path\":\"evil/x.md\",\"content\":\"\"}]}")
BADAID="$(jget "$BADRESP" adventureId)"
resp=$(req -X POST "$BASE/sessions/dicegm" -H 'content-type: application/json' -d "{\"teamId\":\"$BADAID\"}")
check "信任闸门 无效包建局 →400{code:invalid_pack,issues}" "$resp" --expect-status=400 --eq=code=invalid_pack --nonempty=issues

echo "  → A4: pass=$PASS fail=$FAIL blocked=$BLOCKED"
