// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openCatalog, openDb, initSchema, metaGet, type DB } from "@dicelore/backend";
import { createLoreApp } from "./lore.js";
import { createLiveApp } from "./dice.js";
import { FakeDiceGm } from "@dicelore/harness";

describe("Play 生命周期: open→session_meta→kickoff(幂等)→delete", () => {
  it("open 写团本名/prologue/started=0;start 跑开场且幂等;delete 200", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([]) });
    const cRes = await lore.request("/catalog/commit", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "魔道", message: "i", files: [
        { path: "manifest.md", content: "# 魔道" },
        { path: "prologue.md", content: "夜色如墨,你立于鹰愁涧口。" },
        { path: "state/开局.csv", content: "entity,kind,attr,value,visible\n旅人,player,HP,9,1\n" },
      ] }),
    });
    const { tuanbenId, commitId } = (await cRes.json()) as { tuanbenId: string; commitId: string };

    const dbs = new Map<string, DB>();
    const openSession = (id: string): DB => { let d = dbs.get(id); if (!d) { d = openDb(":memory:"); initSchema(d); dbs.set(id, d); } return d; };
    const live = createLiveApp({
      catalog, openSession,
      agentFactory: () => new FakeDiceGm(() => [{ type: "narration", text: "夜风掠过崖口。" }, { type: "turn_end" }]),
    });

    await live.request("/sessions/plife1/open", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tuanbenId, ref: commitId }),
    });
    const db = dbs.get("plife1")!;
    expect(metaGet(db, "tuanben_name")).toBe("魔道");
    expect(metaGet(db, "prologue")).toBe("夜色如墨,你立于鹰愁涧口。");
    expect(metaGet(db, "started")).toBe("0");

    const r1 = (await (await live.request("/sessions/plife1/start", { method: "POST" })).json()) as { turnId: string };
    expect(r1.turnId).toBeTruthy(); // 缝B 契约统一:start 返回 {turnId}——拿到 turnId 即已开局
    expect(metaGet(db, "started")).toBe("1");
    const r2 = (await (await live.request("/sessions/plife1/start", { method: "POST" })).json()) as { turnId: string };
    expect(r2.turnId).toBe(r1.turnId); // 幂等:不重跑开场,回同一开场 turnId

    const del = await live.request("/sessions/plife1", { method: "DELETE" });
    expect(del.status).toBe(200);
    catalog.close();
  });
});
