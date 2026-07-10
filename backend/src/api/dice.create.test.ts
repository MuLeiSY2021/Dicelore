// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// session-surface-flatten 验收：dicegm 显式建会话 POST /sessions/dicegm + 旧路径 404。

import { describe, it, expect } from "vitest";
import { openCatalog, openDb, initSchema, commit, type DB } from "@dicelore/backend";
import { createLiveApp } from "./dice.js";
import { FakeDiceGm, removeHost } from "@dicelore/harness";

const PACK = [
  { path: "manifest.md", content: "# 凡人\n\n- id: f" },
  { path: "prologue.md", content: "你睁开眼。" },
  { path: "state/开局.csv", content: "entity,kind,attr,value,visible\n韩立,player,HP,12,1\n" },
];

function memSessions(): { open: (id: string) => DB; dbs: Map<string, DB> } {
  const dbs = new Map<string, DB>();
  const open = (id: string): DB => { let d = dbs.get(id); if (!d) { d = openDb(":memory:"); initSchema(d); dbs.set(id, d); } return d; };
  return { open, dbs };
}

describe("POST /sessions/dicegm 显式建会话（session-surface-flatten §三）", () => {
  it("无 catalog 注入 → 400 no_catalog", async () => {
    const app = createLiveApp({ agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const res = await app.request("/sessions/dicegm", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ teamId: "x" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("no_catalog");
  });

  it("缺 teamId → 400 bad_request", async () => {
    const catalog = openCatalog(":memory:");
    const app = createLiveApp({ catalog, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const res = await app.request("/sessions/dicegm", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("bad_request");
    catalog.close();
  });

  it("未知 teamId（无已发布版本）→ 400 unknown_team", async () => {
    const catalog = openCatalog(":memory:");
    const app = createLiveApp({ catalog, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const res = await app.request("/sessions/dicegm", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ teamId: "does-not-exist" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("unknown_team");
    catalog.close();
  });

  it("version 省略（默认最新版）→ 201 {sessionId, kind:'dicegm'}，随后 presentation 含导入态", async () => {
    const catalog = openCatalog(":memory:");
    const { adventureId } = commit(catalog, { name: "凡人", message: "init", files: PACK });
    const { open } = memSessions();
    const app = createLiveApp({ catalog, openSession: open, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const res = await app.request("/sessions/dicegm", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ teamId: adventureId }),
    });
    expect(res.status).toBe(201);
    const { sessionId, kind } = (await res.json()) as { sessionId: string; kind: string };
    expect(kind).toBe("dicegm");
    expect(sessionId).toBeTruthy();

    const snap = (await (await app.request(`/sessions/dicegm/${sessionId}/presentation`)).json()) as { sheets: { entity: string; cells: { attr: string; value: string }[] }[] };
    const hp = snap.sheets.find((g) => g.entity === "韩立")?.cells.find((c) => c.attr === "HP");
    expect(hp?.value).toBe("12");
    removeHost(sessionId);
    catalog.close();
  });

  it("显式 version 亦 201", async () => {
    const catalog = openCatalog(":memory:");
    const { adventureId, commitId } = commit(catalog, { name: "凡人", message: "init", files: PACK });
    const { open } = memSessions();
    const app = createLiveApp({ catalog, openSession: open, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const res = await app.request("/sessions/dicegm", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ teamId: adventureId, version: commitId }),
    });
    expect(res.status).toBe(201);
    const { sessionId } = (await res.json()) as { sessionId: string };
    removeHost(sessionId);
    catalog.close();
  });

  it("旧懒建路径 POST /sessions/:id/open → 404（破坏性改名·C1/C2 移除）", async () => {
    const catalog = openCatalog(":memory:");
    const app = createLiveApp({ catalog, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const res = await app.request("/sessions/s1/open", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ adventureId: "x", ref: "y" }),
    });
    expect(res.status).toBe(404);
    catalog.close();
  });
});
