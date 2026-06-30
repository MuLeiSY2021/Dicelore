// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, beforeEach } from "vitest";
import { openDb, initSchema, type DB } from "../store/db.js";
import { revealKey } from "../store/keys.js";
import { createKeysApp } from "./keys.js";

const MASTER = "0".repeat(64);
const memDb = (): DB => { const d = openDb(":memory:"); initSchema(d); return d; };

const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("api/keys (SEC2 后端 key 托管端点：存/取元信息/删)", () => {
  let db: DB;
  beforeEach(() => { db = memDb(); });

  it("POST /keys 存 key → 201 + 回 key_id/元信息(不回明文)", async () => {
    const app = createKeysApp({ db, master: MASTER });
    const res = await app.request("/keys", json({ label: "我的 GLM", provider: "anthropic", secret: "sk-secret-xyz" }));
    expect(res.status).toBe(201);
    const body = await res.json() as { keyId: string; label: string; provider: string };
    expect(body.keyId).toBeTruthy();
    expect(body.label).toBe("我的 GLM");
    expect(body.provider).toBe("anthropic");
    // 响应体绝不回明文
    expect(JSON.stringify(body)).not.toContain("sk-secret-xyz");
  });

  it("POST 存的 key 在 DB 里是密文(端到端断言加密落库)", async () => {
    const app = createKeysApp({ db, master: MASTER });
    const secret = "sk-must-be-encrypted-at-rest";
    await app.request("/keys", json({ label: "x", provider: "p", secret }));
    const rows = db.prepare("SELECT * FROM api_key").all() as Record<string, unknown>[];
    expect(JSON.stringify(rows)).not.toContain(secret);
    // 但后端代发链路能解回
    const keyId = (rows[0] as { key_id: string }).key_id;
    expect(revealKey(db, keyId, MASTER)).toBe(secret);
  });

  it("GET /keys/:id 取元信息(不回明文/密文)", async () => {
    const app = createKeysApp({ db, master: MASTER });
    const stored = await (await app.request("/keys", json({ label: "L", provider: "anthropic", secret: "sk-1" }))).json() as { keyId: string };
    const res = await app.request(`/keys/${stored.keyId}`);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toMatchObject({ keyId: stored.keyId, label: "L", provider: "anthropic" });
    const s = JSON.stringify(body);
    expect(s).not.toContain("sk-1");
    expect(s).not.toContain("ciphertext");
    expect(s).not.toContain("secret");
  });

  it("GET /keys 列全部元信息(不回明文)", async () => {
    const app = createKeysApp({ db, master: MASTER });
    await app.request("/keys", json({ label: "a", provider: "p", secret: "sk-a" }));
    await app.request("/keys", json({ label: "b", provider: "p", secret: "sk-b" }));
    const res = await app.request("/keys");
    expect(res.status).toBe(200);
    const body = await res.json() as { keys: { label: string }[] };
    expect(body.keys.map((k) => k.label)).toEqual(["a", "b"]);
    const s = JSON.stringify(body);
    expect(s).not.toContain("sk-a");
    expect(s).not.toContain("sk-b");
  });

  it("GET /keys/:id 不存在 → 404", async () => {
    const app = createKeysApp({ db, master: MASTER });
    const res = await app.request("/keys/no-such-id");
    expect(res.status).toBe(404);
  });

  it("DELETE /keys/:id 删除 → 204；再删 → 404；删后取 404", async () => {
    const app = createKeysApp({ db, master: MASTER });
    const stored = await (await app.request("/keys", json({ label: "x", provider: "p", secret: "s" }))).json() as { keyId: string };
    const del = await app.request(`/keys/${stored.keyId}`, { method: "DELETE" });
    expect(del.status).toBe(204);
    expect((await app.request(`/keys/${stored.keyId}`, { method: "DELETE" })).status).toBe(404);
    expect((await app.request(`/keys/${stored.keyId}`)).status).toBe(404);
  });

  it("POST 缺 secret/label → 400(校验非法入参)", async () => {
    const app = createKeysApp({ db, master: MASTER });
    expect((await app.request("/keys", json({ provider: "p", secret: "s" }))).status).toBe(400);
    expect((await app.request("/keys", json({ label: "x", provider: "p" }))).status).toBe(400);
    expect((await app.request("/keys", json({ label: "", provider: "p", secret: "" }))).status).toBe(400);
  });

  it("未配置主密钥时 POST → 503(明确拒绝，绝不明文落库)", async () => {
    const app = createKeysApp({ db, master: "" });
    const res = await app.request("/keys", json({ label: "x", provider: "p", secret: "s" }));
    expect(res.status).toBe(503);
    // 没有任何行落库
    expect((db.prepare("SELECT COUNT(*) c FROM api_key").get() as { c: number }).c).toBe(0);
  });

  it("master 经 thunk 延迟读取(env 在请求时才解析)", async () => {
    let current = "";
    const app = createKeysApp({ db, master: () => current });
    expect((await app.request("/keys", json({ label: "x", provider: "p", secret: "s" }))).status).toBe(503);
    current = MASTER;
    expect((await app.request("/keys", json({ label: "y", provider: "p", secret: "s2" }))).status).toBe(201);
  });
});
