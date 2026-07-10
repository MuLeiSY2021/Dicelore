#!/usr/bin/env bash
# A2 dicegm 域子资源（as-delivered 据 1-backend-interface §2 / B4 跑团页）
# 全部挂 /sessions/dicegm/:id/*。
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
echo "━━━ A2 dicegm 域子资源 ━━━"

# fixture：建局 + 开场（fake GM 纯叙事档），为子资源铺台
SID="$(new_dicegm)"
req -X POST "$BASE/sessions/dicegm/$SID/start" -H 'content-type: application/json' -d '{}' >/dev/null
req -X POST "$BASE/sessions/dicegm/$SID/messages" -H 'content-type: application/json' -d '{"text":"推进剧情"}' >/dev/null

# —— 呈现快照（A′ 全量含 plotlines/foreshadows/lore 投影）——
resp=$(req "$BASE/sessions/dicegm/$SID/presentation")
check "呈现快照 GET /:id/presentation →200{protocol,sheets,mechanics,choices,...}" "$resp" \
  --expect-status=200 --has protocol --has sheets --has mechanics --has choices

# —— 重连回填（默认全量含 visible=0；visibleOnly=true 才截流）——
resp=$(req "$BASE/sessions/dicegm/$SID/events?since=0")
check "重连回填 GET /:id/events?since= →200{events[]}（默认全量含 visible=0）" "$resp" --expect-status=200 --has events
resp=$(req "$BASE/sessions/dicegm/$SID/events?since=0&visibleOnly=true")
check "防剧透 visibleOnly=true 仍 200{events[]}" "$resp" --expect-status=200 --has events

# —— 源浏览 ——
resp=$(req "$BASE/sessions/dicegm/$SID/browse?source=world&q=")
check "源浏览 GET /:id/browse?source=world →200{source,entries}" "$resp" --expect-status=200 --eq=source=world --has entries

# —— 用量投影（usage-and-context §二 · RT-FE14/17）——
resp=$(req "$BASE/sessions/dicegm/$SID/usage")
check "用量 GET /:id/usage →200{model,contextTokens,contextWindow,contextPct,sessionTotal,perTurn}" "$resp" \
  --expect-status=200 --has model --has contextTokens --has contextWindow --has contextPct --has sessionTotal --has perTurn

# —— 统一 config（取代旧 /:id/model；GET/POST）——
resp=$(req "$BASE/sessions/dicegm/$SID/config")
check "config GET /:id/config →200{model,spoilerTier}" "$resp" --expect-status=200 --has model --has spoilerTier
resp=$(req -X POST "$BASE/sessions/dicegm/$SID/config" -H 'content-type: application/json' \
  -d '{"spoilerTier":"loose","model":"claude-haiku-4-5-20251001"}')
check "config POST /:id/config{model,spoilerTier} →200 更新后完整 config（model 设 pendingModel·spoilerTier 立即）" "$resp" \
  --expect-status=200 --has model --eq=spoilerTier=loose --has pendingModel

# —— 分支（debrief-and-branch §二 · RT-FE8）——
resp=$(req -X POST "$BASE/sessions/dicegm/$SID/branches" -H 'content-type: application/json' -d '{}')
check "分支新建 POST /:id/branches →201{branchId,sessionId,fromSeq,isCurrent}" "$resp" \
  --expect-status=201 --has branchId --has fromSeq --eq=isCurrent=true
BID="$(jget "$resp" branchId)"
resp=$(req "$BASE/sessions/dicegm/$SID/branches")
check "分支列表 GET /:id/branches →200{currentBranchId,branches[]}" "$resp" \
  --expect-status=200 --has currentBranchId --nonempty=branches
resp=$(req -X POST "$BASE/sessions/dicegm/$SID/branches/$BID/checkout" -H 'content-type: application/json' -d '{}')
check "分支切换 POST /:id/branches/:bid/checkout →200{branchId,presentation}" "$resp" \
  --expect-status=200 --eq=branchId="$BID" --has presentation
resp=$(req -X POST "$BASE/sessions/dicegm/$SID/branches/no-such-branch/checkout" -H 'content-type: application/json' -d '{}')
check "分支切换未知分支 →404{code:unknown_branch}" "$resp" --expect-status=404 --eq=code=unknown_branch

# —— 明骰/暗骰负路径（无待掷 → 409·确定性）——
resp=$(req -X POST "$BASE/sessions/dicegm/$SID/roll" -H 'content-type: application/json' -d '{"eventId":999}')
check "明骰 POST /:id/roll 无待掷 →409{code:no_pending_roll}" "$resp" --expect-status=409 --eq=code=no_pending_roll
resp=$(req -X POST "$BASE/sessions/dicegm/$SID/choices" -H 'content-type: application/json' -d '{"eventId":999,"optionIndex":0}')
check "choices POST /:id/choices 无待选 →409{code:no_pending_choice}" "$resp" --expect-status=409 --eq=code=no_pending_choice

# —— WS 升级（首连 snapshot 后增量；帧数可为 0=by design）——
resp=$(node "$DIR/ws-probe.mjs" "$BASE/sessions/dicegm/$SID/ws" 2>&1 || true)
if printf '%s' "$resp" | grep -q 'ERROR'; then
  echo "  ✗ WS 连接 GET /:id/ws 升级失败 — $resp"; FAIL=$((FAIL+1))
else
  echo "  ✓ WS 连接 GET /:id/ws 升级成功（$resp）"; PASS=$((PASS+1))
fi

# —— 暗骰/明骰正路径 + WS 12 类逐条：需 fake-GM 教练档挂起 pendingRoll/choice ——
block "roll_staged/hidden_roll(含 result/band) + game_end WS 逐条验" \
  "fake-GM 教练档 CanonScript 未接 HTTP/env，无法经 HTTP 触发挂起 pendingRoll/pendingChoice；staged-roll 正路径与 hidden_roll 全量下发(断言 result/band 存在)需该缺件"

echo "  → A2: pass=$PASS fail=$FAIL blocked=$BLOCKED"
