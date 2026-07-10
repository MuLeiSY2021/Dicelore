// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 统一 config 端点验收（model-switch + spoiler-tiering）：
//   GET/POST /sessions/dicegm/{id}/config —— 部分更新 {model?, spoilerTier?}。
//   · POST{model} → 200 设 pendingModel；下回合 currentModel 变。
//   · POST{spoilerTier} → 立即生效。GET 读回完整 config。
//   · POST /sessions/loregm/{id}/config 对称（loregm 内存态；未建会话 → 404）。

import { describe, it, expect } from "vitest";
import { openCatalog, openDb, initSchema, commit, type DB } from "@dicelore/backend";
import { createLiveApp } from "./dice.js";
import { createLoreApp } from "./lore.js";
import { FakeDiceGm, removeHost } from "@dicelore/harness";
import type { SessionConfig } from "@dicelore/shared";

const PACK = [
  { path: "manifest.md", content: "# 凡人\n\n- id: f" },
  { path: "prologue.md", content: "你睁开眼。" },
  { path: "state/开局.csv", content: "entity,kind,attr,value,visible\n韩立,player,HP,12,1\n" },
];

function memSessions(): (id: string) => DB {
  const dbs = new Map<string, DB>();
  return (id: string): DB => { let d = dbs.get(id); if (!d) { d = openDb(":memory:"); initSchema(d); dbs.set(id, d); } return d; };
}

async function json<T>(p: Response | Promise<Response>): Promise<T> { return (await (await p).json()) as T; }

describe("dicegm 统一 config 端点（model-switch + spoiler-tiering）", () => {
  async function newDiceSession(): Promise<{ app: ReturnType<typeof createLiveApp>; id: string; catalog: DB }> {
    const catalog = openCatalog(":memory:");
    const { adventureId } = commit(catalog, { name: "凡人", message: "init", files: PACK });
    const app = createLiveApp({ catalog, openSession: memSessions(), model: "glm-init", agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const { sessionId } = await json<{ sessionId: string }>(app.request("/sessions/dicegm", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ teamId: adventureId }),
    }));
    return { app, id: sessionId, catalog };
  }

  it("GET 读回默认 config（model 回显初值、spoilerTier=strict）", async () => {
    const { app, id, catalog } = await newDiceSession();
    const cfg = await json<SessionConfig>(app.request(`/sessions/dicegm/${id}/config`));
    expect(cfg.model).toBe("glm-init");
    expect(cfg.spoilerTier).toBe("strict");
    expect(cfg.pendingModel).toBeUndefined();
    removeHost(id); catalog.close();
  });

  it("POST{model} → 200 设 pendingModel；下回合 currentModel 变", async () => {
    const { app, id, catalog } = await newDiceSession();
    const res = await app.request(`/sessions/dicegm/${id}/config`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "claude-haiku-4-5-20251001" }),
    });
    expect(res.status).toBe(200);
    const cfg = (await res.json()) as SessionConfig;
    expect(cfg.model).toBe("glm-init"); // 当前回合仍旧 model
    expect(cfg.pendingModel).toBe("claude-haiku-4-5-20251001");

    // 下回合 drive-turn（start）后 currentModel 生效。
    await app.request(`/sessions/dicegm/${id}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const after = await json<SessionConfig>(app.request(`/sessions/dicegm/${id}/config`));
    expect(after.model).toBe("claude-haiku-4-5-20251001");
    expect(after.pendingModel).toBeUndefined();
    removeHost(id); catalog.close();
  });

  it("POST{spoilerTier} 立即生效；GET 读回", async () => {
    const { app, id, catalog } = await newDiceSession();
    const res = await app.request(`/sessions/dicegm/${id}/config`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spoilerTier: "off" }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as SessionConfig).spoilerTier).toBe("off");
    const cfg = await json<SessionConfig>(app.request(`/sessions/dicegm/${id}/config`));
    expect(cfg.spoilerTier).toBe("off");
    removeHost(id); catalog.close();
  });

  it("非法 spoilerTier → 被 schema 拒（≥400，config 不变）", async () => {
    const { app, id, catalog } = await newDiceSession();
    const res = await app.request(`/sessions/dicegm/${id}/config`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spoilerTier: "bogus" }),
    });
    // 本仓约定：malformed body 经 SchemaName.parse 抛 ZodError（无全局 400 映射）→ Hono 默认 500。
    // 关键是被拒且不落库：GET 读回仍为默认 strict。
    expect(res.status).toBeGreaterThanOrEqual(400);
    const cfg = await json<SessionConfig>(app.request(`/sessions/dicegm/${id}/config`));
    expect(cfg.spoilerTier).toBe("strict");
    removeHost(id); catalog.close();
  });
});

describe("loregm 统一 config 端点（两 kind 对称·内存态）", () => {
  async function newLore(): Promise<{ app: ReturnType<typeof createLoreApp>; id: string; catalog: DB }> {
    const catalog = openCatalog(":memory:");
    const app = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const { sessionId } = await json<{ sessionId: string }>(app.request("/sessions/loregm", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "造团本" }),
    }));
    return { app, id: sessionId, catalog };
  }

  it("GET 读回默认 config；POST{spoilerTier} 立即生效", async () => {
    const { app, id, catalog } = await newLore();
    const cfg = await json<SessionConfig>(app.request(`/sessions/loregm/${id}/config`));
    expect(cfg.spoilerTier).toBe("strict");
    expect(cfg.model).toBeTruthy();

    const res = await app.request(`/sessions/loregm/${id}/config`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spoilerTier: "loose" }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as SessionConfig).spoilerTier).toBe("loose");
    catalog.close();
  });

  it("POST{model} → 设 pendingModel（loregm 下回合生效）", async () => {
    const { app, id, catalog } = await newLore();
    const res = await app.request(`/sessions/loregm/${id}/config`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "m-new" }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as SessionConfig).pendingModel).toBe("m-new");
    catalog.close();
  });

  it("未建会话 → 404", async () => {
    const catalog = openCatalog(":memory:");
    const app = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const get = await app.request("/sessions/loregm/nope/config");
    expect(get.status).toBe(404);
    const post = await app.request("/sessions/loregm/nope/config", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spoilerTier: "off" }),
    });
    expect(post.status).toBe(404);
    catalog.close();
  });
});
