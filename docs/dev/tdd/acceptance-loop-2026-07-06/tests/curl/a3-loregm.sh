#!/usr/bin/env bash
# A3 loregm 域子资源（as-delivered 据 1-backend-interface §3 / B5 制作页）
# 全部挂 /sessions/loregm/:id/*。loregm 无 start/rewind/usage（对称骨架里那些是 dicegm 独有）。
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
echo "━━━ A3 loregm 域子资源 ━━━"

LSID="$(new_loregm eval-制作)"

# —— drive-turn（REST only · usage 随响应内联·无 usage 事件则不带）——
resp=$(req -X POST "$BASE/sessions/loregm/$LSID/messages" -H 'content-type: application/json' -d '{"text":"造一个 NPC：守夜人"}')
check "loregm drive-turn POST /:id/messages →202{turnId[,usage]}" "$resp" --expect-status=202 --has turnId

# —— 会话不存在的领域错误体形状 {error:{code:NO_SESSION}}（§3·嵌套 error）——
resp=$(req -X POST "$BASE/sessions/loregm/no-such-session/messages" -H 'content-type: application/json' -d '{"text":"x"}')
check "loregm 会话不存在 POST /:id/messages →404{error:{code:NO_SESSION}}" "$resp" \
  --expect-status=404 --eq=error.code=NO_SESSION

# —— Draft 检视 ——
resp=$(req "$BASE/sessions/loregm/$LSID/draft")
check "loregm Draft 检视 GET /:id/draft →200{files,snapshot}" "$resp" --expect-status=200 --has files --has snapshot

# —— 素材上传（原始字节流·filename 经 query）——
resp=$(req -X POST "$BASE/sessions/loregm/$LSID/materials?filename=note.txt" --data-binary 'hello-素材')
check "loregm 素材上传 POST /:id/materials →200{path,bytes}" "$resp" --expect-status=200 --has path --has bytes

# —— Draft 校验（RT-FE11 · {issues:[{level,path,msg}]}）——
resp=$(req -X POST "$BASE/sessions/loregm/$LSID/draft/validate" -H 'content-type: application/json' -d '{}')
check "loregm Draft 校验 POST /:id/draft/validate →200{issues[]}" "$resp" --expect-status=200 --has issues

# —— 统一 config（两 kind 对称·loregm config 存内存态）——
resp=$(req "$BASE/sessions/loregm/$LSID/config")
check "loregm config GET /:id/config →200{model,spoilerTier}" "$resp" --expect-status=200 --has model --has spoilerTier
resp=$(req -X POST "$BASE/sessions/loregm/$LSID/config" -H 'content-type: application/json' -d '{"spoilerTier":"off"}')
check "loregm config POST /:id/config{spoilerTier} →200 更新后完整 config" "$resp" --expect-status=200 --eq=spoilerTier=off
# 会话不存在 → 404 NO_SESSION（嵌套 error）
resp=$(req "$BASE/sessions/loregm/no-such-session/config")
check "loregm config 会话不存在 →404{error:{code:NO_SESSION}}" "$resp" --expect-status=404 --eq=error.code=NO_SESSION

# —— WS 升级（loregm-ws 裁决已交付·5 类事件；首连帧可为 0=REST only）——
resp=$(node "$DIR/ws-probe.mjs" "$BASE/sessions/loregm/$LSID/ws" 2>&1 || true)
if printf '%s' "$resp" | grep -q 'ERROR'; then
  echo "  ✗ loregm WS 连接 GET /:id/ws 升级失败 — $resp"; FAIL=$((FAIL+1))
else
  echo "  ✓ loregm WS 连接 GET /:id/ws 升级成功（$resp·5 类事件见 §5.2）"; PASS=$((PASS+1))
fi

# —— 删除（200 {ok}·幂等）——
resp=$(req -X DELETE "$BASE/sessions/loregm/$LSID")
check "loregm 删除 DELETE /:id →200{ok}" "$resp" --expect-status=200 --eq=ok=true

echo "  → A3: pass=$PASS fail=$FAIL blocked=$BLOCKED"
