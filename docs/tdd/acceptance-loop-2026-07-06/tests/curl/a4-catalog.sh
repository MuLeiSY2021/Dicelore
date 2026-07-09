#!/usr/bin/env bash
# A4 catalog 团本产物库（据 1-backend-interface §4 / B3 团本目录页）
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
echo "━━━ A4 catalog 团本产物库 ━━━"

# —— 目录 ——
resp=$(req "$BASE/catalog")
check "目录 GET /catalog →200{adventure[]}" "$resp" --expect-status=200 --has adventure

# —— 提交版本（fixture 合法 pack）——
PACK="$(cat "$DIR/fixture-pack.json")"
resp=$(req -X POST "$BASE/catalog/commit" -H 'content-type: application/json' -d "{\"name\":\"eval-fixture-$(uid)\",\"message\":\"fixture\",\"files\":$PACK}")
check "提交版本 POST /catalog/commit →201{adventureId,commitId}" "$resp" --expect-status=201 --has adventureId --has commitId
AID="$(jget "$resp" adventureId)"
CID="$(jget "$resp" commitId)"
echo "    fixture adventureId=$AID commitId=$CID"

# —— 版本包文件（ref=head · 端点层解析 head）——
resp=$(req "$BASE/catalog/$AID/files?ref=head")
check "版本包文件 GET /catalog/:id/files?ref=head →200{files[]非空}" "$resp" --expect-status=200 --has files --nonempty=files

# —— 整包校验 ——
resp=$(req -X POST "$BASE/catalog/validate" -H 'content-type: application/json' -d "{\"files\":$PACK}")
check "整包校验 POST /catalog/validate →200{ok}" "$resp" --expect-status=200 --has ok

# —— 打标签 ——
resp=$(req -X POST "$BASE/catalog/$AID/tag" -H 'content-type: application/json' -d "{\"commitId\":\"$CID\",\"label\":\"v-eval\"}")
check "打标签 POST /catalog/:id/tag →201" "$resp" --expect-status=201

# —— 开始游戏 import（合法 pack + commitId ref → 201 正路）——
OSID="$(uid)"
resp=$(req -X POST "$BASE/sessions/$OSID/open" -H 'content-type: application/json' -d "{\"adventureId\":\"$AID\",\"ref\":\"$CID\"}")
check "import 开局 POST /sessions/:id/open{adventureId,ref=commitId} →201{sessionId,imported}" "$resp" --expect-status=201 --has sessionId --has imported

# —— F-open-head-ref：ref="head" 应与 /files 端点一致解析（现状 checkout 不认 head → 500）——
OSID2="$(uid)"
resp=$(req -X POST "$BASE/sessions/$OSID2/open" -H 'content-type: application/json' -d "{\"adventureId\":\"$AID\",\"ref\":\"head\"}")
check "F-open-head-ref POST /:id/open{ref=head} →201（端点应解析 head·对齐 /files）" "$resp" --expect-status=201 --has imported
# 红点 F-open-head-ref：core checkout 不认 "head" 字符串 → 空包 → 500（/files 端点手动解析 head 但 /open→importPack 未解析·不一致）

# —— F-open-500：无效包应 4xx 不该 500 崩 ——
BADRESP=$(req -X POST "$BASE/catalog/commit" -H 'content-type: application/json' -d "{\"name\":\"eval-bad-$(uid)\",\"message\":\"bad\",\"files\":[{\"path\":\"evil/x.md\",\"content\":\"\"}]}")
BADAID="$(jget "$BADRESP" adventureId)"
BADCID="$(jget "$BADRESP" commitId)"
BSID="$(uid)"
resp=$(req -X POST "$BASE/sessions/$BSID/open" -H 'content-type: application/json' -d "{\"adventureId\":\"$BADAID\",\"ref\":\"$BADCID\"}")
check "F-open-500 无效包 POST /:id/open →4xx（应结构化拒·非 500）" "$resp" --expect-status=400
# 红点 F-open-500：无效包 importPack throw 未捕获 → 500（应 4xx + 结构化 error）

echo "  → A4: pass=$PASS fail=$FAIL blocked=$BLOCKED"
