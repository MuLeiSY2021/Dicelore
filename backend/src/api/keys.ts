// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { Hono } from "hono";
import { getLogger } from "@dicelore/logs";
import type { DB } from "../store/db.js";
import { storeKey, getKeyMeta, listKeyMeta, deleteKey, KeyMasterMissingError } from "../store/keys.js";

// ═══════════════════════════════════════════════════════════════════════════
// SEC2 后端 key 托管端点（ADR-0027 定稿：统一后端托管，前端只存 key_id 引用）
//
//   POST   /keys      存一条 key（加密落库）→ 201 + { keyId, label, provider, createdAt }，不回明文
//   GET    /keys      列全部元信息 → { keys: KeyMeta[] }
//   GET    /keys/:id  取单条元信息 → KeyMeta（404 if 不存在），永不解密回明文
//   DELETE /keys/:id  删一条 → 204（404 if 本不存在）
//
// 加密/解密全在 store/keys.ts；本层只做路由 + 入参校验 + 主密钥缺失兜底。
// 挂载（server.ts app.route）归主 agent，本文件不碰 server.ts。
// ═══════════════════════════════════════════════════════════════════════════

export interface KeysDeps {
  db: DB;
  // 主密钥：直接传 string，或传 thunk 在请求时延迟读 env（便于测试 & 启动顺序无关）。
  master: string | (() => string);
}

function resolveMaster(m: KeysDeps["master"]): string {
  return typeof m === "function" ? m() : m;
}

export function createKeysApp(deps: KeysDeps): Hono {
  const app = new Hono();

  // 存：加密落库，回元信息（不回明文）。
  app.post("/keys", async (c) => {
    const body = (await c.req.json().catch((e: unknown) => {
      getLogger().warn({ err: e }, "POST /keys body 解析失败");
      return {};
    })) as { label?: unknown; provider?: unknown; secret?: unknown };

    const label = typeof body.label === "string" ? body.label.trim() : "";
    const provider = typeof body.provider === "string" ? body.provider.trim() : "";
    const secret = typeof body.secret === "string" ? body.secret : "";
    if (!label || !provider || !secret) {
      return c.json({ error: "缺少 label / provider / secret" }, 400);
    }

    try {
      const meta = storeKey(deps.db, { label, provider, secret }, resolveMaster(deps.master));
      return c.json(meta, 201);
    } catch (e: unknown) {
      if (e instanceof KeyMasterMissingError) {
        getLogger().error({ err: e }, "拒绝存 key：未配置 DICELORE_KEY_MASTER 主密钥");
        return c.json({ error: "服务器未配置 key 主密钥(DICELORE_KEY_MASTER)，无法加密托管" }, 503);
      }
      getLogger().error({ err: e }, "存 key 失败");
      return c.json({ error: e instanceof Error ? e.message : "存 key 失败" }, 500);
    }
  });

  // 列全部元信息。
  app.get("/keys", (c) => c.json({ keys: listKeyMeta(deps.db) }));

  // 取单条元信息（永不回明文）。
  app.get("/keys/:id", (c) => {
    const meta = getKeyMeta(deps.db, c.req.param("id"));
    if (!meta) return c.json({ error: "key 不存在" }, 404);
    return c.json(meta);
  });

  // 删一条。
  app.delete("/keys/:id", (c) => {
    const ok = deleteKey(deps.db, c.req.param("id"));
    if (!ok) return c.json({ error: "key 不存在" }, 404);
    return c.body(null, 204);
  });

  return app;
}
