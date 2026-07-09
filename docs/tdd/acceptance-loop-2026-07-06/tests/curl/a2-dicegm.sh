#!/usr/bin/env bash
# A2 dicegm 域子资源（据 1-backend-interface §2 / B4 跑团页）
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
echo "━━━ A2 dicegm 域子资源 ━━━"

# fixture：懒建 dicegm session 并跑一回合（fake 纯叙事档 echo）
DSID="$(uid)"
req -X POST "$BASE/sessions/$DSID/messages" -H 'content-type: application/json' -d '{"text":"推进剧情"}' >/dev/null

# —— 呈现快照 ——
resp=$(req "$BASE/sessions/$DSID/presentation")
check "呈现快照 GET /:id/presentation →200（含 sheets·plotline/world=RT-FE4 待扩）" "$resp" --expect-status=200
# 红点 RT-FE4：现仅 sheets，缺 plotline/world 投影

# —— 重连回填 ——
resp=$(req "$BASE/sessions/$DSID/events?since=0")
check "重连回填 GET /:id/events?since= →200{events[]}" "$resp" --expect-status=200 --has events
resp=$(req "$BASE/sessions/$DSID/events?since=0&visibleOnly=true")
check "防剧透 visibleOnly=true 仍 200{events[]}" "$resp" --expect-status=200 --has events

# —— 源浏览 ——
resp=$(req "$BASE/sessions/$DSID/browse?source=world&q=")
check "源浏览 GET /:id/browse?source=world →200{source,entries}" "$resp" --expect-status=200 --has source --has entries

# —— 用量投影（RT-FE14/17 待批准裁决）——
resp=$(req "$BASE/sessions/$DSID/usage")
check "RT-FE14/17 用量 GET /:id/usage →200{model,contextTokens,contextWindow,contextPct,sessionTotal,perTurn}" "$resp" --expect-status=200 --has model --has contextTokens --has contextWindow --has contextPct --has sessionTotal --has perTurn
# 红点：base 聚合已合 main，但 context/session/perTurn 扩=待批准裁决 → 字段缺

# —— 运行时切 model（RT-FE18 待批准裁决）——
resp=$(req -X POST "$BASE/sessions/$DSID/model" -H 'content-type: application/json' -d '{"model":"claude-haiku-4-5-20251001"}')
check "RT-FE18 运行时切 model POST /:id/model →200{model,effectiveAt}" "$resp" --expect-status=200 --has model --has effectiveAt
# 红点 RT-FE18：无端点 → 404

# —— 明骰/暗骰：需 fake-GM 教练档挂起 pendingRoll ——
block "明骰 POST /:id/roll →202；无待掷 409（含 per-band narration RT-FE5）" "fake-GM 教练档 CanonScript 未接 HTTP/env，无法挂起 pendingRoll（缺件·见 findings）"
block "暗骰 WS hidden_roll + PendingRoll.hidden 标记（RT-FE6）" "同上：教练档未接 HTTP"

# —— choices：需 pendingChoice（教练档）——
block "choices POST /:id/choices →202（RT2 语义必真跑）" "fake-GM 教练档未接 HTTP，无法挂起 pendingChoice"

# —— 分支（RT-FE8 待批准裁决）——
resp=$(req -X POST "$BASE/sessions/$DSID/branches" -H 'content-type: application/json' -d '{}')
check "RT-FE8 分支新建 POST /:id/branches →201{branchId}" "$resp" --expect-status=201 --has branchId
resp=$(req "$BASE/sessions/$DSID/branches")
check "RT-FE8 分支列表 GET /:id/branches →200" "$resp" --expect-status=200
# 红点 RT-FE8：无 branches 端点 → 404

# —— WS 流：首连无 since= 不重发（by design·客户端走 GET /events 取 snapshot）——
resp=$(node "$DIR/ws-probe.mjs" "$BASE/sessions/$DSID/ws" 2>&1 || true)
if printf '%s' "$resp" | grep -q 'ERROR'; then
  echo "  ✗ WS 连接 GET /:id/ws 升级失败 — $resp"; FAIL=$((FAIL+1))
else
  echo "  ✓ WS 连接 GET /:id/ws 升级成功（首连无 since= 不重发=by design·frames 可为 0）"; PASS=$((PASS+1))
fi
block "WS 10 类消息逐条验（game_end 必验 RT-B3）" "fake-GM 教练档未接 HTTP，roll_staged/choices/hidden_roll/game_end 无法触发；turn_started/narration_commit/turn_ended 可达但需协调 drive-turn；?since=N 重连补叙述历史未测"

echo "  → A2: pass=$PASS fail=$FAIL blocked=$BLOCKED"
