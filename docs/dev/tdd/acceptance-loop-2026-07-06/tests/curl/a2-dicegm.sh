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

# ═══ fake 教练档关键字驱动的正路径主线（DICELORE_FAKE_GM=1·defaultCoachCanon）═══
# 关键字触发五主线，HTTP 可观测：明骰/选择/终局/暗骰。参照 backend/src/server.fakeGm.test.ts。

# —— 选择主线：「选择」→ presentation.choices 现两选项 → POST /choices →202 收尾 ——
CSID="$(new_dicegm)"
req -X POST "$BASE/sessions/dicegm/$CSID/messages" -H 'content-type: application/json' -d '{"text":"我该如何选择"}' >/dev/null
resp=$(req "$BASE/sessions/dicegm/$CSID/presentation")
check "选择主线 presentation.choices 现≥2 选项+eventId" "$resp" \
  --expect-status=200 --has choices.eventId --nonempty=choices.options
CEID="$(jget "$resp" choices.eventId)"
resp=$(req -X POST "$BASE/sessions/dicegm/$CSID/choices" -H 'content-type: application/json' -d "{\"eventId\":$CEID,\"optionIndex\":1}")
check "选择主线 POST /:id/choices{eventId,optionIndex} →202{turnId}（走正式选择捕获）" "$resp" --expect-status=202 --has turnId

# —— 明骰主线：「掷骰」挂 rollGate → POST /roll 解 gate、回合收尾、verdict 落库(visible=1) ——
# message 阻塞在 gate 上、eventId 走 WS roll_staged 帧 → 由 roll-flow.mjs 编排（见该文件）。
RSID="$(new_dicegm)"
RF="$(timeout 40 node "$DIR/roll-flow.mjs" "$BASE" "$RSID" roll 2>&1 || true)"
if printf '%s' "$RF" | grep -q 'ROLL=202' && printf '%s' "$RF" | grep -q 'MSG=202'; then
  echo "  ✓ 明骰主线 POST messages 挂 rollGate → POST /roll →202 解 gate → messages 回合收尾（$RF）"; PASS=$((PASS+1))
else
  printf '  ✗ 明骰主线 roll gate 编排 — %s\n' "$RF"; FAIL=$((FAIL+1))
fi
resp=$(req "$BASE/sessions/dicegm/$RSID/events?since=0")
check "明骰主线 掷骰落 verdict(可见·visible=1) GET /:id/events" "$resp" \
  --expect-status=200 --eq=events.0.kind=verdict --eq=events.0.visible=1

# —— 暗骰主线：「暗骰」→ GM 立即掷、verdict visible=0（对玩家隐·不入 visible 面/mechanics）——
# 纯 WS hidden_roll 帧（携完整 result/band）在 fake 路径不必发（fakeGm.test 只验 DB visible=0）；
# 此处以 REST 可观测口径验防剧透行为：events 全量含 visible=0、visibleOnly 截流、presentation 不投影。
HSID="$(new_dicegm)"
resp=$(req -X POST "$BASE/sessions/dicegm/$HSID/messages" -H 'content-type: application/json' -d '{"text":"我要暗骰查探"}')
check "暗骰主线 POST messages「暗骰」→202" "$resp" --expect-status=202 --has turnId
resp=$(req "$BASE/sessions/dicegm/$HSID/events?since=0")
check "暗骰主线 verdict 落库 visible=0（全量面含）GET /:id/events" "$resp" \
  --expect-status=200 --eq=events.0.kind=verdict --eq=events.0.visible=0
resp=$(req "$BASE/sessions/dicegm/$HSID/events?since=0&visibleOnly=true")
check "暗骰主线 visibleOnly=true 截掉暗骰 verdict（events 空）" "$resp" --expect-status=200 --absent=events.0
resp=$(req "$BASE/sessions/dicegm/$HSID/presentation")
check "暗骰主线 presentation.mechanics 不投影暗骰 verdict（对玩家隐）" "$resp" --expect-status=200 --absent=mechanics.0

# —— 终局主线：「结束」→ game_end MCP → 转复盘态（GET meta status=debrief·ended=true）——
ESID="$(new_dicegm)"
req -X POST "$BASE/sessions/dicegm/$ESID/messages" -H 'content-type: application/json' -d '{"text":"我想结束游戏"}' >/dev/null
resp=$(req "$BASE/sessions/dicegm/$ESID")
check "终局主线 GET /:id →status:debrief·ended:true（game_end 后转复盘态不归档）" "$resp" \
  --expect-status=200 --eq=ended=true --eq=status=debrief

# —— hidden_roll 纯 WS 帧断言（携完整 {eventId,label,result,dc?,band?}）——
# fake 教练档暗骰走引擎立即掷、不发 roll_staged/hidden_roll 帧（stream.ts §28 注：暗骰不走 pendingRoll）；
# hidden_roll 帧的全量下发(断言 result/band 存在·防剧透交前端 spoiler 档) 属真 GM/前端渲染路径，
# 移交 playwright b4 覆盖（协调者接受此项留 blocked）。REST 可观测的暗骰防剧透行为已在上方转 PASS。
block "hidden_roll 纯 WS 帧断言（含 result/band）" \
  "fake 教练档暗骰走引擎立即掷、不发 hidden_roll 帧；WS 帧全量下发断言移交 playwright b4（暗骰防剧透 REST 口径已转 PASS）"

echo "  → A2: pass=$PASS fail=$FAIL blocked=$BLOCKED"
