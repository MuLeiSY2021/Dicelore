#!/usr/bin/env python3
"""Cookie 加密存储 —— 密码从环境变量 ``NMB_COOKIE_KEY`` 读，cookie 加密成二进制 ``.cookie.enc``。

文件格式: ``[16 字节 salt][Fernet token]``（二进制）。
解密: 读文件 → 取 salt → scrypt 派生 32 字节 key → Fernet 解 token → cookie 字符串。

用法:
    export NMB_COOKIE_KEY='你的密码'
    echo 'cookie串' | python3 cookie_store.py encrypt   # 加密写入 .cookie.enc
    python3 cookie_store.py test                          # 验证解密
"""

import base64
import os
import sys
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

BASE_DIR = Path(__file__).parent
COOKIE_ENC = BASE_DIR / ".cookie.enc"
SALT_LEN = 16


def _derive_key(password: str, salt: bytes) -> bytes:
    """scrypt 从密码 + salt 派生 Fernet 所需的 url-safe base64 32 字节 key。"""
    kdf = Scrypt(salt=salt, length=32, n=2 ** 15, r=8, p=1)
    return base64.urlsafe_b64encode(kdf.derive(password.encode("utf-8")))


def encrypt_cookie(cookie: str, password: str) -> bytes:
    salt = os.urandom(SALT_LEN)
    key = _derive_key(password, salt)
    token = Fernet(key).encrypt(cookie.encode("utf-8"))
    return salt + token


def decrypt_cookie(data: bytes, password: str) -> str:
    if len(data) < SALT_LEN + 1:
        raise ValueError("cookie 文件损坏(过短)")
    salt, token = data[:SALT_LEN], data[SALT_LEN:]
    key = _derive_key(password, salt)
    try:
        return Fernet(key).decrypt(token).decode("utf-8")
    except InvalidToken:
        raise SystemExit("解密失败: 密码错误或文件损坏 (检查 NMB_COOKIE_KEY)")


def load_cookie() -> str:
    """供爬取脚本调用: 从环境变量取密码, 解密 .cookie.enc。"""
    pw = os.environ.get("NMB_COOKIE_KEY")
    if not pw:
        raise SystemExit("环境变量 NMB_COOKIE_KEY 未设置")
    if not COOKIE_ENC.exists():
        raise SystemExit(f"找不到加密 cookie: {COOKIE_ENC}")
    return decrypt_cookie(COOKIE_ENC.read_bytes(), pw)


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "test"
    if cmd == "encrypt":
        pw = os.environ.get("NMB_COOKIE_KEY")
        if not pw:
            raise SystemExit("先 export NMB_COOKIE_KEY")
        cookie = sys.stdin.read().strip()
        if not cookie:
            raise SystemExit("从 stdin 读不到 cookie")
        COOKIE_ENC.write_bytes(encrypt_cookie(cookie, pw))
        os.chmod(COOKIE_ENC, 0o600)
        print(f"已加密写入 {COOKIE_ENC} ({COOKIE_ENC.stat().st_size} bytes, 权限 0600)")
    elif cmd == "test":
        c = load_cookie()
        print(f"解密成功: cookie 长度 {len(c)} 字符, 末尾片段 ...{c[-24:]}")
    else:
        raise SystemExit(f"未知命令 {cmd}, 用 encrypt|test")


if __name__ == "__main__":
    main()
