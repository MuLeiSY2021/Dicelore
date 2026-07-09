#!/usr/bin/env bash
# A1 会话生命周期（两 kind 对称骨架 · 据 1-backend-interface §1）
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
echo "━━━ A1 会话生命周期（两 kind 对称骨架）━━━"

# —— 创建：理想面 POST /sessions/{kind} → 201 ——
resp=$(req -X POST "$BASE/sessions/dicegm" -H 'content-type: application/json' -d '{"adventureId":"x"}')
check "RT1 dicegm 显式建会话 POST /sessions/dicegm →201{sessionId,kind}" "$resp" --expect-status=201 --has sessionId --has kind
# 红点 RT1：现无此端点（懒建）→ 404

resp=$(req -X POST "$BASE/sessions/loregm" -H 'content-type: application/json' -d '{"name":"x"}')
check "RT1 loregm 显式建会话 POST /sessions/loregm →201{sessionId,kind}" "$resp" --expect-status=201 --has sessionId --has kind

# —— 列表 ——
resp=$(req "$BASE/sessions")
check "dicegm 列表 GET /sessions →200{sessions[]}" "$resp" --expect-status=200 --has sessions
resp=$(req "$BASE/lore-sessions")
check "RT6 loregm 列表 GET /lore-sessions →200{sessions[]}" "$resp" --expect-status=200 --has sessions
# 红点 RT6：loregm 无列表 → 404

# —— fixture：用现状懒建拿一个 dicegm session（非被测）——
DSID="$(uid)"
resp=$(req -X POST "$BASE/sessions/$DSID/messages" -H 'content-type: application/json' -d '{"text":"你好"}')
check "[fixture] dicegm 懒建+drive-turn POST /messages →202{turnId}" "$resp" --expect-status=202 --has turnId

# —— 元信息 ——
resp=$(req "$BASE/sessions/$DSID")
check "dicegm 元信息 GET /sessions/:id →200{sessionId,ended,title}" "$resp" --expect-status=200 --has sessionId --has ended --has title
resp=$(req "$BASE/lore-sessions/$DSID")
check "RT7 loregm 元信息 GET /lore-sessions/:id →200{sessionId,kind,status,title,ended}" "$resp" --expect-status=200 --has sessionId --has kind --has status
# 红点 RT7：loregm 无 meta → 404

# —— 开场（幂等）——
resp=$(req -X POST "$BASE/sessions/$DSID/start" -H 'content-type: application/json' -d '{}')
check "dicegm 开场 POST /:id/start →202{turnId}（幂等）" "$resp" --expect-status=202 --has turnId
# 红点：裸 session 未 import 团本 / 已有回合在跑 → 可能 409

# —— rewind（RT3 无契约）——
resp=$(req -X POST "$BASE/sessions/$DSID/rewind" -H 'content-type: application/json' -d '{}')
check "RT3 rewind POST /:id/rewind →202（覆盖当前分支·到头=空）" "$resp" --expect-status=202
# 红点 RT3：无契约；现状 409 no_snapshot

# —— 删除 ——
resp=$(req -X DELETE "$BASE/sessions/$DSID")
check "dicegm 删除 DELETE /sessions/:id →200{ok}" "$resp" --expect-status=200 --has ok

echo "  → A1: pass=$PASS fail=$FAIL blocked=$BLOCKED"
