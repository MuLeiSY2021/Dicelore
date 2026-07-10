#!/usr/bin/env bash
# §6 配置 / 诊断 / 客制 MCP（as-delivered 据 1-backend-interface §6 / B6 配置页）
# 客制 MCP 走 /mcp/* 独立面（取代旧 /diagnostics/mcp-config）；mcp-test 仍在 /diagnostics。
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
echo "━━━ §6 配置 / 诊断 / 客制 MCP ━━━"

# —— 服务器真值 ——
resp=$(req "$BASE/diagnostics/health")
check "health GET /diagnostics/health →200{fakeGm,port,model,mcp,notify,storage}" "$resp" \
  --expect-status=200 --has fakeGm --has port --has model --has mcp --has notify --has storage

# —— 模型连接测试（FAKE 短路）——
resp=$(req -X POST "$BASE/diagnostics/model-test" -H 'content-type: application/json' -d '{}')
check "model-test POST /diagnostics/model-test →200{ok,fake}" "$resp" --expect-status=200 --eq=ok=true --eq=fake=true

# —— 自定义 MCP 测试（结构化 stdio）——
# 测试环境无真 stdio MCP → 断言结构化失败形状 {ok:false,message}（§6.1·spec 许可）。
resp=$(req -X POST "$BASE/diagnostics/mcp-test" -H 'content-type: application/json' \
  -d '{"transport":"stdio","command":"dicelore-no-such-mcp-xyz"}')
check "mcp-test stdio 连不上真 MCP →502{ok:false,message}（结构化失败形状）" "$resp" \
  --expect-status=502 --eq=ok=false --has message
resp=$(req -X POST "$BASE/diagnostics/mcp-test" -H 'content-type: application/json' -d '{"transport":"stdio"}')
check "mcp-test stdio 缺 command →400{ok:false}" "$resp" --expect-status=400 --eq=ok=false

# —— 客制 MCP 面（/mcp/*·custom-mcp-install 取代旧 mcp-config）——
resp=$(req "$BASE/mcp/marketplaces")
check "列 marketplace 源 GET /mcp/marketplaces →200{marketplaces[]}" "$resp" --expect-status=200 --has marketplaces
resp=$(req -X POST "$BASE/mcp/marketplaces" -H 'content-type: application/json' -d '{}')
check "加 marketplace 缺 source →400{ok:false}" "$resp" --expect-status=400 --eq=ok=false
resp=$(req "$BASE/mcp/servers")
check "列已装客制 MCP GET /mcp/servers →200{servers[]}" "$resp" --expect-status=200 --has servers
resp=$(req -X POST "$BASE/mcp/install" -H 'content-type: application/json' -d '{}')
check "安装 缺 spec POST /mcp/install →400{ok:false}" "$resp" --expect-status=400 --eq=ok=false
resp=$(req -X POST "$BASE/mcp/servers/no-such-mcp/toggle" -H 'content-type: application/json' -d '{"enabled":true}')
check "启停 未找到 POST /mcp/servers/:name/toggle →404{ok:false}" "$resp" --expect-status=404 --eq=ok=false
resp=$(req -X DELETE "$BASE/mcp/servers/no-such-mcp")
check "删 未找到 DELETE /mcp/servers/:name →404{ok:false}" "$resp" --expect-status=404 --eq=ok=false

# —— key 托管（POST body {label,provider,secret}·DELETE →204）——
resp=$(req "$BASE/keys")
check "key 列表 GET /keys →200{keys[]}" "$resp" --expect-status=200 --has keys
resp=$(req -X POST "$BASE/keys" -H 'content-type: application/json' -d '{"label":"x"}')
check "key 存 缺参 POST /keys →400" "$resp" --expect-status=400
resp=$(req -X DELETE "$BASE/keys/no-such-key-id")
check "key 删 不存在 DELETE /keys/:id →404" "$resp" --expect-status=404

# —— key 存正路（201 KeyMeta）+ 级联删（204）——
# eval 后端的 DICELORE_KEY_MASTER 已配但非 32 字节（malformed）→ storeKey 抛「主密钥无效」→ 500，
# 无法走 201 正路（受测环境主密钥无效·不重启后端不可修）。
KID="$(uid)"
resp=$(req -X POST "$BASE/keys" -H 'content-type: application/json' -d "{\"label\":\"eval-$KID\",\"provider\":\"openai\",\"secret\":\"sk-eval\"}")
code="$(printf '%s' "$resp" | tail -n1)"
if [ "$code" = "201" ]; then
  check "key 存 POST /keys{label,provider,secret} →201{keyId}(不回明文)" "$resp" --expect-status=201 --has keyId --absent=secret
  KUUID="$(jget "$(req "$BASE/keys")" keys.0.keyId)"
  resp=$(req -X DELETE "$BASE/keys/$KUUID")
  check "key 删 DELETE /keys/:id →204" "$resp" --expect-status=204
else
  block "key 存正路 201{keyId} + 级联删 204" "eval 后端 DICELORE_KEY_MASTER 已配但非 32 字节(malformed)→storeKey 抛「主密钥无效」→ $code；不重启后端不可修(测试基建缺件)"
fi

echo "  → §6: pass=$PASS fail=$FAIL blocked=$BLOCKED"
