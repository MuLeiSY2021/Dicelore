#!/usr/bin/env bash
# A1 会话生命周期（两 kind 对称骨架 · as-delivered 据 1-backend-interface §1）
# 会话面已拉平：dicegm 全挂 /sessions/dicegm/*、loregm 全挂 /sessions/loregm/*；
# 旧 /sessions/*(裸) 与 /lore-sessions/* 已删、无别名。
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
echo "━━━ A1 会话生命周期（两 kind 对称骨架）━━━"

# —— dicegm 建会话：须先 commit 一个包拿 adventureId 作 teamId（§1/§4）——
AC="$(commit_fixture)"; AID="${AC%% *}"; CID="${AC##* }"
resp=$(req -X POST "$BASE/sessions/dicegm" -H 'content-type: application/json' -d "{\"teamId\":\"$AID\"}")
check "dicegm 显式建会话 POST /sessions/dicegm{teamId} →201{sessionId,kind}" "$resp" \
  --expect-status=201 --has sessionId --eq=kind=dicegm
DSID="$(jget "$resp" sessionId)"

# 建会话错误面（§1）：缺 teamId → 400 bad_request；无版本团本 → 400 unknown_team；拒包 → 400 invalid_pack
resp=$(req -X POST "$BASE/sessions/dicegm" -H 'content-type: application/json' -d '{}')
check "dicegm 建会话缺 teamId →400{code:bad_request}" "$resp" --expect-status=400 --eq=code=bad_request
resp=$(req -X POST "$BASE/sessions/dicegm" -H 'content-type: application/json' -d '{"teamId":"no-such-team-xyz"}')
check "dicegm 建会话团本不存在 →400{code:unknown_team}" "$resp" --expect-status=400 --eq=code=unknown_team

# —— loregm 建会话：POST /sessions/loregm{name?} →201 ——
resp=$(req -X POST "$BASE/sessions/loregm" -H 'content-type: application/json' -d '{"name":"eval-团本"}')
check "loregm 显式建会话 POST /sessions/loregm{name?} →201{sessionId,kind}" "$resp" \
  --expect-status=201 --has sessionId --eq=kind=loregm
LSID="$(jget "$resp" sessionId)"

# —— 列表（拉平面）——
resp=$(req "$BASE/sessions/dicegm")
check "dicegm 列表 GET /sessions/dicegm →200{sessions[]}" "$resp" --expect-status=200 --has sessions
resp=$(req "$BASE/sessions/loregm")
check "loregm 列表 GET /sessions/loregm →200{sessions[]}" "$resp" --expect-status=200 --has sessions

# —— 元信息（对称形状 {sessionId,kind,status,ended,title}）——
resp=$(req "$BASE/sessions/dicegm/$DSID")
check "dicegm 元信息 GET /sessions/dicegm/:id →200{sessionId,kind,status,ended,title}" "$resp" \
  --expect-status=200 --has sessionId --eq=kind=dicegm --has status --has ended --has title
resp=$(req "$BASE/sessions/loregm/$LSID")
check "loregm 元信息 GET /sessions/loregm/:id →200{...,status:active,ended:false}" "$resp" \
  --expect-status=200 --has sessionId --eq=kind=loregm --eq=status=active --eq=ended=false --has title

# —— 开场（dicegm 独有·幂等·WS 流式）——
resp=$(req -X POST "$BASE/sessions/dicegm/$DSID/start" -H 'content-type: application/json' -d '{}')
check "dicegm 开场 POST /sessions/dicegm/:id/start →202{turnId}" "$resp" --expect-status=202 --has turnId

# —— drive-turn ——
resp=$(req -X POST "$BASE/sessions/dicegm/$DSID/messages" -H 'content-type: application/json' -d '{"text":"你好"}')
check "dicegm drive-turn POST /sessions/dicegm/:id/messages →202{turnId}" "$resp" --expect-status=202 --has turnId
resp=$(req -X POST "$BASE/sessions/loregm/$LSID/messages" -H 'content-type: application/json' -d '{"text":"造一个 NPC"}')
check "loregm drive-turn POST /sessions/loregm/:id/messages →202{turnId}" "$resp" --expect-status=202 --has turnId

# —— rewind（dicegm 独有；已 start 过 → 有快照可撤上一轮 →202{snapshotId}）——
resp=$(req -X POST "$BASE/sessions/dicegm/$DSID/rewind" -H 'content-type: application/json' -d '{}')
check "dicegm rewind POST /sessions/dicegm/:id/rewind{} →202{snapshotId}（撤上一轮·覆盖当前分支）" "$resp" \
  --expect-status=202 --has snapshotId

# —— 删除（🟡 返回 200 {ok:true} 非 204）——
resp=$(req -X DELETE "$BASE/sessions/dicegm/$DSID")
check "dicegm 删除 DELETE /sessions/dicegm/:id →200{ok}" "$resp" --expect-status=200 --eq=ok=true
resp=$(req -X DELETE "$BASE/sessions/loregm/$LSID")
check "loregm 删除 DELETE /sessions/loregm/:id →200{ok}（幂等）" "$resp" --expect-status=200 --eq=ok=true

echo "  → A1: pass=$PASS fail=$FAIL blocked=$BLOCKED"
