#!/usr/bin/env python3
"""爬 nmbxd「跑团」版块(fid=111)列表 100 页, 按回复量取前 30, 输出候选清单。

每个串只取列表元数据(串号/标题/分类/时间/回复数/正文首句), 不爬全文 ——
全文爬取留给 scrape.py(按需对选中的串逐个 /Api/thread 抓)。

QPS 克制: DELAY 秒/请求, 100 页 ≈ 200 秒。支持断点续传(scraped/forum_all_threads.jsonl)。
Cookie 走 cookie_store 加密存储, 密码从环境变量 NMB_COOKIE_KEY 读。
"""

import json
import subprocess
import sys
import time
from pathlib import Path

from cookie_store import load_cookie

BASE_DIR = Path(__file__).parent
FID = 111  # 跑团版块 forum id (来自 web 页 var forum = {"id":"111","name":"跑团"})
MAX_PAGES = 100
DELAY = 2.0  # 秒/请求 —— QPS 限制
PROXY = "http://172.17.128.1:7897"
UA = ("Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36")

SCRAPED = BASE_DIR / "scraped"
RAW = SCRAPED / "forum_all_threads.jsonl"          # 中间产物(全部串元数据, 断点续传)
OUT = SCRAPED / "forum_top_candidates.md"          # 最终候选清单(入库)


def fetch_page(page: int, cookie: str, retries: int = 3):
    """抓一页版块列表, 返回 list[dict] 或 None/str(出错)。"""
    url = f"https://www.nmbxd1.com/Api/showf/id/{FID}/page/{page}"
    cmd = ["curl", "-s", "--compressed", "--proxy", PROXY, "-b", cookie,
           "--connect-timeout", "15", "--max-time", "30", "--retry", "2",
           "-H", f"user-agent: {UA}", url]
    for attempt in range(retries):
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
        if r.returncode != 0:
            print(f"\n  curl rc={r.returncode} stderr={r.stderr.strip()[:120]!r}", file=sys.stderr)
            if attempt < retries - 1:
                time.sleep(3); continue
            return None
        if not r.stdout:
            print(f"\n  curl 空输出 (rc=0)", file=sys.stderr)
            if attempt < retries - 1:
                time.sleep(3); continue
            return None
        try:
            data = json.loads(r.stdout)
        except json.JSONDecodeError:
            print(f"\n  JSON 解析失败 p{page}: {r.stdout[:80]!r}", file=sys.stderr)
            if attempt < retries - 1:
                time.sleep(3); continue
            return None
        if isinstance(data, str):
            return data  # "该板块不存在" 之类
        return data
    return None


def main():
    cookie = load_cookie()
    SCRAPED.mkdir(exist_ok=True)

    # 断点续传: 读已有 jsonl
    all_threads = []
    done_pages = 0
    if RAW.exists():
        for line in RAW.read_text(encoding="utf-8").splitlines():
            if line.strip():
                all_threads.append(json.loads(line))
        done_pages = len({t["_page"] for t in all_threads if "_page" in t})
        if done_pages:
            print(f"断点续传: 已有 {len(all_threads)} 串 / {done_pages} 页")

    with open(RAW, "a", encoding="utf-8") as f:
        consec_fail = 0
        for page in range(done_pages + 1, MAX_PAGES + 1):
            print(f"抓取第 {page}/{MAX_PAGES} 页...", end="", flush=True)
            data = fetch_page(page, cookie)
            if data is None:
                consec_fail += 1
                print(f" 失败(连续 {consec_fail} 次),跳过")
                if consec_fail >= 5:
                    print("连续 5 页失败,停止"); break
                time.sleep(DELAY); continue
            consec_fail = 0
            if isinstance(data, str):
                print(f" API 返回字符串: {data!r}, 停止"); break
            if not data:
                print(" 空页,结束"); break
            cnt = 0
            for t in data:
                rec = {
                    "_page": page,
                    "id": t.get("id"),
                    "title": t.get("title", ""),
                    "name": t.get("name", ""),  # 分类标签(串的版块归属)
                    "now": t.get("now", ""),
                    "reply_count": t.get("ReplyCount", 0),
                    "sage": t.get("sage", 0),
                    "content_head": (t.get("content", "") or "")[:200],
                }
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
                all_threads.append(rec)
                cnt += 1
            f.flush()
            print(f" {cnt} 串 (累计 {len(all_threads)})")
            if page < MAX_PAGES:
                time.sleep(DELAY)

    # 去重(同串号跨页重复时取回复数大的)
    seen = {}
    for t in all_threads:
        tid = t["id"]
        if tid is None:
            continue
        if tid not in seen or t["reply_count"] > seen[tid]["reply_count"]:
            seen[tid] = t
    uniq = list(seen.values())
    uniq.sort(key=lambda x: x["reply_count"], reverse=True)
    top30 = uniq[:30]

    # 候选清单 markdown
    pages_done = len({t["_page"] for t in all_threads if "_page" in t})
    lines = [
        f"# 跑团版块(fid=111)回复量前 30 候选团本",
        "",
        f"> 来源: nmbxd `/Api/showf/id/111/page/1..{MAX_PAGES}`",
        f"> 爬取日期: 2026-07-10 | 实际页数: {pages_done} | 去重后总串数: {len(uniq)}",
        f"> 用途: 补全 [`randomness-narrative-patterns.md`](randomness-narrative-patterns.md) §八 语料偏向(现仅 3 串偏西幻/抽卡/苗床)",
        "",
        "| 排名 | 串号 | 回复数 | 分类(name) | sage | 时间 | 标题 | 正文首句 |",
        "|------|------|--------|-----------|------|------|------|---------|",
    ]
    for i, t in enumerate(top30, 1):
        title = (t["title"] or "无标题").replace("|", "\\|") or "无标题"
        name = (t["name"] or "无名氏").replace("|", "\\|") or "无名氏"
        head = (t["content_head"] or "").replace("\n", " ").replace("|", "\\|")[:50]
        sage = "是" if t["sage"] else ""
        lines.append(f"| {i} | No.{t['id']} | {t['reply_count']} | {name} | {sage} | {t['now']} | {title} | {head} |")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\n输出: {OUT}")
    print(f"总去重串数: {len(uniq)}, 前 30 已写入")


if __name__ == "__main__":
    main()
