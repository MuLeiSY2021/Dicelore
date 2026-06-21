#!/usr/bin/env python3
"""Scrape nmbxd threads via API, extract key fields, format as markdown."""

import json
import os
import re
import sys
import time
import html
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

BASE_DIR = Path(__file__).parent
COOKIE_FILE = BASE_DIR / ".cookie"
PROXY = "http://172.17.128.1:7897"
DELAY = 2  # seconds between requests
MAX_PAGES = 100

THREADS = {
    "38582339": "从刚成年开始的兽人冒险！",
    "67916530": "总之，来抽卡吧",
    "54995176": "恶龙团",
}

# Fields to extract (mapping from user's CSS class names to API JSON keys)
# h-threads-info-title    -> title
# h-threads-info-email    -> name
# h-threads-info-createdat -> now
# h-threads-info-uid      -> user_hash  (UID is 名字)
# h-threads-info-id       -> id         (id is 串号)
# h-threads-content       -> content


def load_cookie():
    return COOKIE_FILE.read_text().strip()


def clean_content(raw_html: str) -> str:
    """Convert HTML content to clean markdown-ish text."""
    if not raw_html:
        return ""
    text = raw_html
    # <br /> or <br> -> newline
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    # <font color="...">text</font> -> **text** (greentext style)
    text = re.sub(r'<font[^>]*>(.*?)</font>', r'\1', text, flags=re.DOTALL)
    # <a href="...">text</a> -> text
    text = re.sub(r'<a[^>]*>(.*?)</a>', r'\1', text, flags=re.DOTALL)
    # remaining HTML tags
    text = re.sub(r"<[^>]+>", "", text)
    # HTML entities
    text = html.unescape(text)
    # collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def format_post(post: dict, is_op: bool = False) -> str:
    """Format a single post as markdown."""
    uid = post.get("user_hash", "")
    post_id = post.get("id", "")
    title = post.get("title", "")
    name = post.get("name", "")
    now = post.get("now", "")
    content = clean_content(post.get("content", ""))

    prefix = "【主串】" if is_op else ""
    lines = []
    lines.append(f"### {prefix}No.{post_id}")
    lines.append(f"- UID: {uid}")
    lines.append(f"- 时间: {now}")
    if title and title != "无标题":
        lines.append(f"- 标题: {title}")
    if name and name != "无名氏":
        lines.append(f"- 分类: {name}")
    lines.append("")
    lines.append(content)
    lines.append("")
    lines.append("---")
    return "\n".join(lines)


def fetch_page(thread_id: str, page: int, cookie: str, retries: int = 3) -> dict | None:
    """Fetch one page from the API with retry."""
    url = f"https://www.nmbxd1.com/Api/thread?id={thread_id}&page={page}"
    import subprocess
    cmd = [
        "curl", "-s", "--compressed",
        "--proxy", PROXY,
        "-b", cookie,
        "--connect-timeout", "15",
        "--max-time", "30",
        "--retry", "2",
        "-H", "user-agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36",
        url
    ]
    for attempt in range(retries):
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
            if result.returncode != 0:
                if attempt < retries - 1:
                    print(f"  重试 {attempt+1}/{retries}...", end="", flush=True)
                    time.sleep(3)
                    continue
                print(f"  curl error: {result.stderr.strip()}", file=sys.stderr)
                return None
            try:
                data = json.loads(result.stdout)
            except json.JSONDecodeError:
                if attempt < retries - 1:
                    print(f"  重试 {attempt+1}/{retries}...", end="", flush=True)
                    time.sleep(3)
                    continue
                print(f"  JSON parse error for page {page}", file=sys.stderr)
                return None
            if not data.get("success", True):
                print(f"  API error: {data.get('error', 'unknown')}", file=sys.stderr)
                return None
            return data
        except subprocess.TimeoutExpired:
            if attempt < retries - 1:
                print(f"  超时重试 {attempt+1}/{retries}...", end="", flush=True)
                time.sleep(3)
                continue
            print(f"  超时", file=sys.stderr)
            return None


def scrape_thread(thread_id: str, thread_name: str, cookie: str):
    """Scrape all pages of a thread and write markdown."""
    out_dir = BASE_DIR / "scraped"
    out_dir.mkdir(exist_ok=True)

    safe_name = re.sub(r'[\\/:*?"<>|]', '_', thread_name)
    out_file = out_dir / f"{safe_name}_{thread_id}.md"

    # Check existing progress
    existing_pages = 0
    all_posts = []
    if out_file.exists():
        existing_content = out_file.read_text(encoding="utf-8")
        # Count existing page markers
        existing_pages = existing_content.count("<!-- page ")
        if existing_pages > 0:
            print(f"  已有 {existing_pages} 页数据，继续追加...")
        else:
            existing_pages = 0

    print(f"开始抓取: {thread_name} (No.{thread_id}), 目标 {MAX_PAGES} 页")

    with open(out_file, "a", encoding="utf-8") as f:
        if existing_pages == 0:
            f.write(f"# {thread_name}\n\n")
            f.write(f"> 串号: No.{thread_id}\n\n")

        for page in range(max(1, existing_pages + 1), MAX_PAGES + 1):
            print(f"  抓取第 {page}/{MAX_PAGES} 页...", end="", flush=True)
            data = fetch_page(thread_id, page, cookie)
            if data is None:
                print(" 失败，停止")
                break

            replies = data.get("Replies", [])
            # Filter Tips bot
            real_replies = [r for r in replies if r.get("id") != 9999999]
            if not real_replies:
                print(" 无有效回复，结束")
                break

            f.write(f"<!-- page {page} -->\n\n")

            # On first page, include the OP
            if page == 1 and existing_pages == 0:
                f.write(format_post(data, is_op=True))
                f.write("\n\n")

            for reply in real_replies:
                f.write(format_post(reply))
                f.write("\n")

            f.flush()
            print(f" {len(real_replies)} 条回复")

            if page < MAX_PAGES:
                time.sleep(DELAY)

    print(f"完成: {out_file}")
    return out_file


def main():
    cookie = load_cookie()

    for thread_id, thread_name in THREADS.items():
        try:
            scrape_thread(thread_id, thread_name, cookie)
        except KeyboardInterrupt:
            print("\n用户中断")
            break
        except Exception as e:
            print(f"  错误: {e}")
            continue


if __name__ == "__main__":
    main()
