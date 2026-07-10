// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// RT-fake-gm-wiring 集成测:DICELORE_FAKE_GM=1 的 Agent 工厂(makeFakeAgentFactory)经 HTTP
// (createLiveApp/createLoreApp,app.request 等价 curl)端到端打通五主线 + lore Draft 非空。
// 覆盖 acceptance-loop Tier 0 的 curl 四条(掷骰/选择/终局/暗骰)+ lore 假构建。
import { describe, it, expect, afterEach } from "vitest";
import { openDb, initSchema, openCatalog, type DB } from "@dicelore/backend";
import { removeHost } from "@dicelore/harness";
import { createLiveApp } from "./api/dice.js";
import { createLoreApp } from "./api/lore.js";
import { makeFakeAgentFactory } from "./server.js";

// 每 session 一个持久内存库(app.request 跨请求复用同库,供检视 pending_roll/verdict)。
function sessionStore(): { openSession: (id: string) => DB; dbOf: (id: string) => DB } {
  const map = new Map<string, DB>();
  const openSession = (id: string) => {
    let db = map.get(id);
    if (!db) { db = openDb(":memory:"); initSchema(db); map.set(id, db); }
    return db;
  };
  return { openSession, dbOf: (id) => openSession(id) };
}

const usedIds = new Set<string>();
function liveApp() {
  const { openSession, dbOf } = sessionStore();
  const app = createLiveApp({ agentFactory: makeFakeAgentFactory(), openSession, listSessions: () => [] });
  return { app, dbOf };
}
async function post(app: ReturnType<typeof createLiveApp>, path: string, body: unknown) {
  return app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

afterEach(() => { for (const id of usedIds) removeHost(id); usedIds.clear(); });

describe("FAKE_GM 工厂经 HTTP 打通 dice 五主线", () => {
  it("暗骰:POST messages「暗骰」→ 引擎立即掷,presentation.mechanics 现 verdict", async () => {
    const { app, dbOf } = liveApp(); const id = "fk-hidden"; usedIds.add(id);
    const res = await post(app, `/sessions/${id}/messages`, { text: "我要暗骰查探" });
    expect(res.status).toBe(202);
    const snap = await (await app.request(`/sessions/${id}/presentation`)).json();
    const verdicts = snap.mechanics.filter((m: { kind: string }) => m.kind === "verdict");
    expect(verdicts.length).toBeGreaterThan(0);
    // 未挂起明骰(暗骰不占 pending_roll)。
    const pr = dbOf(id).prepare("SELECT COUNT(*) c FROM pending_roll WHERE status='awaiting'").get() as { c: number };
    expect(pr.c).toBe(0);
  });

  it("选择:POST messages「选择」→ presentation.choices 现两选项", async () => {
    const { app } = liveApp(); const id = "fk-choice"; usedIds.add(id);
    await post(app, `/sessions/${id}/messages`, { text: "我该如何选择" });
    const snap = await (await app.request(`/sessions/${id}/presentation`)).json();
    expect(snap.choices).toBeTruthy();
    expect(snap.choices.options.length).toBeGreaterThanOrEqual(2);
    // 闭环:POST /choices 选第 2 项 → 下一回合(默认叙事)正常收尾。
    const cr = await post(app, `/sessions/${id}/choices`, { eventId: snap.choices.eventId, optionIndex: 1 });
    expect(cr.status).toBe(202);
  });

  it("终局:POST messages「结束」→ GET /sessions/:id ended:true", async () => {
    const { app } = liveApp(); const id = "fk-end"; usedIds.add(id);
    await post(app, `/sessions/${id}/messages`, { text: "我想结束游戏" });
    const info = await (await app.request(`/sessions/${id}`)).json();
    expect(info.ended).toBe(true);
  });

  it("掷骰(明骰):POST messages「掷骰」挂起待掷 → POST /roll 落 verdict、回合收尾", async () => {
    const { app, dbOf } = liveApp(); const id = "fk-roll"; usedIds.add(id);
    // 明骰经 rollGate 挂起 → 不能先 await messages(会等 POST /roll)。先并发发起、轮询到 awaiting pending_roll。
    const msgP = post(app, `/sessions/${id}/messages`, { text: "我要掷骰翻墙" });
    let eventId: number | undefined;
    for (let i = 0; i < 50 && eventId === undefined; i++) {
      await new Promise((r) => setTimeout(r, 5));
      const row = dbOf(id).prepare("SELECT event_id FROM pending_roll WHERE status='awaiting' ORDER BY event_id DESC LIMIT 1").get() as { event_id: number } | undefined;
      eventId = row?.event_id;
    }
    expect(eventId).toBeTruthy();
    const rr = await post(app, `/sessions/${id}/roll`, { eventId });
    expect(rr.status).toBe(202);
    expect((await msgP).status).toBe(202); // 掷骰解开 gate → 回合收尾
    const pr = dbOf(id).prepare("SELECT status, verdict_seq FROM pending_roll WHERE event_id=?").get(eventId) as { status: string; verdict_seq: number | null };
    expect(pr.status).toBe("committed");
    expect(pr.verdict_seq).not.toBeNull();
  });

  it("纯叙事:POST messages 无关键字 → 202 收尾,不产 mechanics/choices(叙事经 WS narration_commit,不落 REST 快照)", async () => {
    const { app } = liveApp(); const id = "fk-narr"; usedIds.add(id);
    const res = await post(app, `/sessions/${id}/messages`, { text: "我环顾四周" });
    expect(res.status).toBe(202);
    const snap = await (await app.request(`/sessions/${id}/presentation`)).json();
    // 纯叙事回合不产裁决/选择(fake 教练档 narration 是 WS-only 流事件,五主线 WS 验证见 FakeDiceGm.test.ts)。
    expect(snap.mechanics).toEqual([]);
    expect(snap.choices).toBeNull();
  });
});

describe("FAKE_GM 工厂经 HTTP 让 lore Draft 非空", () => {
  it("POST /lore-sessions/:id/messages → GET /draft 有内容(假构建驱动写 Draft)", async () => {
    const catalog = openCatalog(":memory:");
    const app = createLoreApp({ catalog, agentFactory: makeFakeAgentFactory() });
    const id = "fk-lore";
    const res = await app.request(`/lore-sessions/${id}/messages`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "造一个江湖团本", name: "假构建团本" }),
    });
    expect(res.status).toBe(202);
    const draftRes = await app.request(`/lore-sessions/${id}/draft`);
    expect(draftRes.status).toBe(200);
    const body = await draftRes.json();
    expect(body.files.length).toBeGreaterThan(0);
    expect(body.snapshot.manifest.name).toBe("假构建团本");
  });
});
