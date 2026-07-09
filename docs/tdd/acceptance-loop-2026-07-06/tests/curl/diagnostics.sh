#!/usr/bin/env bash
# §6 配置 / 诊断（据 1-backend-interface §6 / B6 配置页）
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
echo "━━━ §6 配置 / 诊断 ━━━"

# —— 服务器真值 ——
resp=$(req "$BASE/diagnostics/health")
check "health GET /diagnostics/health →200{fakeGm,port,model,mcp.toolCount,notify,storage}" "$resp" --expect-status=200 --has fakeGm --has port --has model --has mcp --has notify --has storage

# —— 模型连接测试（FAKE 短路）——
resp=$(req -X POST "$BASE/diagnostics/model-test" -H 'content-type: application/json' -d '{}')
check "model-test POST /diagnostics/model-test →200{ok,fake}" "$resp" --expect-status=200 --has ok

# —— 自定义 MCP 测试（stdio + 命令存在性）——
resp=$(req -X POST "$BASE/diagnostics/mcp-test" -H 'content-type: application/json' -d '{"transport":"stdio","endpoint":"node"}')
check "mcp-test POST /diagnostics/mcp-test →200{ok}" "$resp" --expect-status=200 --has ok

# —— 自定义 MCP 登记 CRUD（RT8 待批准裁决）——
resp=$(req "$BASE/diagnostics/mcp-config")
check "RT8 自定义 MCP 列表 GET /diagnostics/mcp-config →200" "$resp" --expect-status=200
resp=$(req -X POST "$BASE/diagnostics/mcp-config" -H 'content-type: application/json' -d '{"instanceName":"x","package":"p@1","command":"npx","args":[],"env":{}}')
check "RT8 自定义 MCP 新增 POST /diagnostics/mcp-config →201" "$resp" --expect-status=201
# 红点 RT8：无 mcp-config 端点 → 404

# —— key 托管（依赖 DICELORE_KEY_MASTER·eval 需另设）——
KID="$(uid)"
resp=$(req -X POST "$BASE/keys" -H 'content-type: application/json' -d "{\"label\":\"eval-$KID\",\"provider\":\"openai\",\"secret\":\"sk-eval\"}")
check "key 存 POST /keys →201" "$resp" --expect-status=201
resp=$(req "$BASE/keys")
check "key 列表 GET /keys →200{keys}" "$resp" --expect-status=200 --has keys
# 删刚存的：从列表取 id
KUUID="$(jget "$resp" keys.0.keyId)"
resp=$(req -X DELETE "$BASE/keys/$KUUID")
check "key 删 DELETE /keys/:id →204" "$resp" --expect-status=204
# 红点：eval 未设 DICELORE_KEY_MASTER → POST 503（eval 环境限制·非被测 bug）；删级联 404

echo "  → §6: pass=$PASS fail=$FAIL blocked=$BLOCKED"
