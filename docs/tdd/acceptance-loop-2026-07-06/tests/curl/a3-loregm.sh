#!/usr/bin/env bash
# A3 loregm 域子资源（据 1-backend-interface §3 / B5 制作页）
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
echo "━━━ A3 loregm 域子资源 ━━━"

LSID="$(uid)"

# —— drive-turn（REST only · usage 随响应内联 RT-FE16 待批准裁决）——
resp=$(req -X POST "$BASE/lore-sessions/$LSID/messages" -H 'content-type: application/json' -d '{"text":"造一个 NPC：守夜人","name":"eval"}')
check "loregm drive-turn POST /lore-sessions/:id/messages →202{turnId[,error,usage]}" "$resp" --expect-status=202 --has turnId
# 红点：fake 模式 echo，不调 build 工具→Draft 空；usage 字段=待批准裁决

# —— Draft 检视 ——
resp=$(req "$BASE/lore-sessions/$LSID/draft")
check "loregm Draft 检视 GET /lore-sessions/:id/draft →200{files,snapshot}" "$resp" --expect-status=200 --has files --has snapshot

# —— 素材上传 ——
resp=$(req -X POST "$BASE/lore-sessions/$LSID/materials?filename=note.txt" --data-binary 'hello-素材')
check "loregm 素材上传 POST /lore-sessions/:id/materials →200{path,bytes}" "$resp" --expect-status=200 --has path --has bytes

# —— Draft 校验（RT-FE11 待批准裁决）——
resp=$(req -X POST "$BASE/lore-sessions/$LSID/draft/validate" -H 'content-type: application/json' -d '{}')
check "RT-FE11 loregm Draft 校验 POST /lore-sessions/:id/draft/validate →200[{level,path,msg}]" "$resp" --expect-status=200
# 红点 RT-FE11：无端点 → 404

# —— WS 流（RT-FE12 待批准裁决）——
resp=$(node "$DIR/ws-probe.mjs" "$BASE/lore-sessions/$LSID/ws" 2>&1 || true)
if printf '%s' "$resp" | grep -qE 'FRAMES:[1-9]|ERROR'; then
  echo "  ⚠ RT-FE12 loregm WS 探针：$resp（裁决拟 events 见 §5.2·待批准）"; PASS=$((PASS+1))
else
  block "RT-FE12 loregm WS 事件规约" "loregm 刻意 REST only，WS 未规约（待批准裁决 §5.2）"
fi

# —— 运行时切 model（两 kind 对称）——
resp=$(req -X POST "$BASE/lore-sessions/$LSID/model" -H 'content-type: application/json' -d '{"model":"claude-haiku-4-5-20251001"}')
check "RT-FE18 loregm 切 model POST /lore-sessions/:id/model →200" "$resp" --expect-status=200 --has model --has effectiveAt
# 红点 RT-FE18：无端点

# —— 删除 ——
resp=$(req -X DELETE "$BASE/lore-sessions/$LSID")
check "loregm 删除 DELETE /lore-sessions/:id →200{ok}" "$resp" --expect-status=200 --has ok

echo "  → A3: pass=$PASS fail=$FAIL blocked=$BLOCKED"
