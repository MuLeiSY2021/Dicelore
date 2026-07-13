#!/bin/bash
# 自动续传 wrapper: 跑 scrape.py, 若第三串(55224255)中断(连续5次失败)则等5分钟续传,
# 直到第三串正常结束(无有效回复=爬到尾)或跑满6轮。
cd /home/mulei/dicelore/docs/research
export NMB_COOKIE_KEY='psw030704'
LOG=/tmp/scrape_wrap.log

for round in $(seq 1 6); do
  echo "=== 第 $round 轮 $(date '+%m-%d %H:%M') ===" >> "$LOG"
  python3 -u scrape.py >> "$LOG" 2>&1
  tail15=$(tail -15 "$LOG")
  # 第三串正常结束: 末尾含 55224255 完成 + "无有效回复"
  if echo "$tail15" | grep -q "55224255.md" && echo "$tail15" | grep -q "无有效回复，结束"; then
    echo "=== 第三串正常完成, 退出 ===" >> "$LOG"
    break
  fi
  # 中断: 末尾含 "连续 5 次失败"
  if echo "$tail15" | grep -q "连续 5 次失败"; then
    pages=$(grep -c '<!-- page ' scraped/目标是正常毕业_55224255.md)
    echo "=== 第 $round 轮中断(已爬 $pages 页), 5 分钟后续传 ===" >> "$LOG"
    sleep 300
    continue
  fi
  echo "=== 未知状态, 停止 ===" >> "$LOG"
  break
done
echo "=== wrapper 结束 $(date '+%m-%d %H:%M') ===" >> "$LOG"
