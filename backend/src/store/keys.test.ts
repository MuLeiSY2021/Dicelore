// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, beforeEach } from "vitest";
import { openDb, initSchema, type DB } from "./db.js";
import { storeKey, getKeyMeta, listKeyMeta, deleteKey, revealKey, KeyMasterMissingError } from "./keys.js";

const memDb = (): DB => { const d = openDb(":memory:"); initSchema(d); return d; };

// 测试用主密钥(32 字节 hex)。生产由 env DICELORE_KEY_MASTER 提供。
const MASTER = "0".repeat(64);

describe("store/keys (SEC2 模型 key 后端托管：加密落库不明文)", () => {
  let db: DB;
  beforeEach(() => { db = memDb(); });

  it("storeKey 落库后返回 key_id + 元信息(不回明文)", () => {
    const meta = storeKey(db, { label: "我的 GLM", provider: "anthropic", secret: "sk-secret-12345" }, MASTER);
    expect(meta.keyId).toBeTruthy();
    expect(meta.label).toBe("我的 GLM");
    expect(meta.provider).toBe("anthropic");
    expect(meta.createdAt).toBeTruthy();
    // 元信息绝不含明文字段
    expect(JSON.stringify(meta)).not.toContain("sk-secret-12345");
  });

  it("key 在 DB 中是密文落库(原始行不含明文，断言加密)", () => {
    const secret = "sk-plaintext-should-never-persist";
    storeKey(db, { label: "x", provider: "anthropic", secret }, MASTER);
    // 直接读底层表所有列，断言无任何一列含明文
    const rows = db.prepare("SELECT * FROM api_key").all() as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    const allCells = JSON.stringify(rows);
    expect(allCells).not.toContain(secret);
    // 密文列存在且非空
    const r = rows[0] as { ciphertext: string };
    expect(typeof r.ciphertext).toBe("string");
    expect(r.ciphertext.length).toBeGreaterThan(0);
  });

  it("revealKey 用主密钥解回明文(代发链路用，非 GET 元信息端点)", () => {
    const secret = "sk-roundtrip-99";
    const meta = storeKey(db, { label: "x", provider: "anthropic", secret }, MASTER);
    expect(revealKey(db, meta.keyId, MASTER)).toBe(secret);
  });

  it("两次存同一明文，密文不同(随机 IV，非确定性加密)", () => {
    const a = storeKey(db, { label: "a", provider: "p", secret: "same" }, MASTER);
    const b = storeKey(db, { label: "b", provider: "p", secret: "same" }, MASTER);
    const ra = db.prepare("SELECT ciphertext FROM api_key WHERE key_id=?").get(a.keyId) as { ciphertext: string };
    const rb = db.prepare("SELECT ciphertext FROM api_key WHERE key_id=?").get(b.keyId) as { ciphertext: string };
    expect(ra.ciphertext).not.toBe(rb.ciphertext);
    // 但都能正确解回
    expect(revealKey(db, a.keyId, MASTER)).toBe("same");
    expect(revealKey(db, b.keyId, MASTER)).toBe("same");
  });

  it("错误主密钥解密失败(GCM 认证标签拒绝，不返回垃圾明文)", () => {
    const meta = storeKey(db, { label: "x", provider: "p", secret: "sek" }, MASTER);
    const wrong = "f".repeat(64);
    expect(() => revealKey(db, meta.keyId, wrong)).toThrow();
  });

  it("getKeyMeta 取单条元信息(不含明文/密文)", () => {
    const meta = storeKey(db, { label: "L", provider: "anthropic", secret: "s" }, MASTER);
    const got = getKeyMeta(db, meta.keyId);
    expect(got).toMatchObject({ keyId: meta.keyId, label: "L", provider: "anthropic" });
    expect(JSON.stringify(got)).not.toContain("ciphertext");
    expect(getKeyMeta(db, "no-such-id")).toBeNull();
  });

  it("listKeyMeta 列全部元信息(按创建序，不含密文)", () => {
    storeKey(db, { label: "a", provider: "p", secret: "1" }, MASTER);
    storeKey(db, { label: "b", provider: "p", secret: "2" }, MASTER);
    const list = listKeyMeta(db);
    expect(list).toHaveLength(2);
    expect(list.map((k) => k.label)).toEqual(["a", "b"]);
    for (const m of list) expect(Object.keys(m)).not.toContain("secret");
  });

  it("deleteKey 删除后取不到 / reveal 抛错", () => {
    const meta = storeKey(db, { label: "x", provider: "p", secret: "s" }, MASTER);
    expect(deleteKey(db, meta.keyId)).toBe(true);
    expect(getKeyMeta(db, meta.keyId)).toBeNull();
    expect(deleteKey(db, meta.keyId)).toBe(false); // 幂等：再删返回 false
    expect(() => revealKey(db, meta.keyId, MASTER)).toThrow();
  });

  it("缺主密钥时 storeKey/revealKey 抛 KeyMasterMissingError(明确不静默明文落库)", () => {
    expect(() => storeKey(db, { label: "x", provider: "p", secret: "s" }, "")).toThrow(KeyMasterMissingError);
    const meta = storeKey(db, { label: "x", provider: "p", secret: "s" }, MASTER);
    expect(() => revealKey(db, meta.keyId, "")).toThrow(KeyMasterMissingError);
  });

  it("主密钥非 32 字节时抛错(拒绝弱主密钥)", () => {
    expect(() => storeKey(db, { label: "x", provider: "p", secret: "s" }, "abcd")).toThrow();
  });

  it("密文被篡改时解密失败(GCM 认证标签防篡改，不返回垃圾明文)", () => {
    const meta = storeKey(db, { label: "x", provider: "p", secret: "tamper-me" }, MASTER);
    const r = db.prepare("SELECT ciphertext FROM api_key WHERE key_id=?").get(meta.keyId) as { ciphertext: string };
    const [iv, tag, data] = r.ciphertext.split(":");
    // 翻转密文体最后一个十六进制位 —— GCM final() 须因标签失配而抛错
    const flipped = data.slice(0, -1) + (data.slice(-1) === "0" ? "1" : "0");
    db.prepare("UPDATE api_key SET ciphertext=? WHERE key_id=?").run(`${iv}:${tag}:${flipped}`, meta.keyId);
    expect(() => revealKey(db, meta.keyId, MASTER)).toThrow();
  });

  it("密文格式损坏(非 iv:tag:data 三段)时抛错", () => {
    const meta = storeKey(db, { label: "x", provider: "p", secret: "s" }, MASTER);
    db.prepare("UPDATE api_key SET ciphertext=? WHERE key_id=?").run("not-a-valid-blob", meta.keyId);
    expect(() => revealKey(db, meta.keyId, MASTER)).toThrow();
  });

  it("空 secret 也加密落库、可解回(不退化为明文/跳过加密)", () => {
    const meta = storeKey(db, { label: "x", provider: "p", secret: "" }, MASTER);
    const r = db.prepare("SELECT ciphertext FROM api_key WHERE key_id=?").get(meta.keyId) as { ciphertext: string };
    // 仍是 iv:tag:data 三段密文结构
    expect(r.ciphertext.split(":")).toHaveLength(3);
    expect(revealKey(db, meta.keyId, MASTER)).toBe("");
  });
});
