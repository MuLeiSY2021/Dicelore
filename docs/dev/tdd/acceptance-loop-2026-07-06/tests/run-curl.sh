#!/usr/bin/env bash
# 跑全部 curl 转移脚本（acceptance-loop 第四步 · Tier 0 假 GM 确定性）。
# 前置：.dicelore-eval 后端已起（DICELORE_FAKE_GM=1，端口 8787，health 200）。
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# 就绪校验
code="$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' "${DICELORE_BASE:-http://127.0.0.1:8787}/diagnostics/health" 2>/dev/null || echo 000)"
if [ "$code" != "200" ]; then
  echo "后端未就绪（health=$code）。先：cd .dicelore-eval && DICELORE_FAKE_GM=1 bash run.sh -f -p 8787" >&2
  exit 1
fi

GP=0; GF=0; GB=0
for s in a1-lifecycle a2-dicegm a3-loregm a4-catalog diagnostics; do
  echo
  TP=0; TF=0; TB=0
  # 各脚本内部 source common.sh 会重置计数器；用子 shell 隔离并回传统计
  out=$(bash "curl/$s.sh" 2>&1) || true
  echo "$out"
  # 从末行抓 pass/fail/blocked
  line="$(echo "$out" | grep -oE 'pass=[0-9]+ fail=[0-9]+ blocked=[0-9]+' | tail -1)"
  TP="${line##*pass=}"; TP="${TP%% *}"
  TF="${line##*fail=}"; TF="${TF%% *}"
  TB="${line##*blocked=}"; TB="${TB## }"
  GP=$((GP+${TP:-0})); GF=$((GF+${TF:-0})); GB=$((GB+${TB:-0}))
done

echo
echo "════════════════════════════════════════"
echo "  总计：PASS=$GP  FAIL=$GF  BLOCKED=$GB"
echo "════════════════════════════════════════"
echo "红=被测 bug（铁律3 不改断言→改代码或落 backlog）；BLOCKED=测试基建缺件（记 finding）。"
[ "$GF" -eq 0 ] || exit 0  # 见红是第四步预期，不因红退出非零
exit 0
