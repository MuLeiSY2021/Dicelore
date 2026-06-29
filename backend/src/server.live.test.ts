// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { createLiveApp } from "./api/dice.js";
import { FakeDiceGm } from "@dicelore/harness";

describe("orchestrator 动作进", () => {
  it("POST /sessions/:id/messages → 202 {turnId}", async () => {
    const app = createLiveApp({ agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const res = await app.request("/sessions/s1/messages", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "我推门" }),
    });
    expect(res.status).toBe(202);
    expect((await res.json()).turnId).toBeTruthy();
  });

  it("GET /sessions/:id/presentation → §1 快照(含 pendingRoll:null)", async () => {
    const app = createLiveApp({ agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const res = await app.request("/sessions/sp/presentation");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.protocol).toBe("dicelore.client/1");
    expect(body.pendingRoll).toBeNull();
  });

  it("POST /sessions/:id/roll 无待掷 → 409", async () => {
    const app = createLiveApp({ agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    await app.request("/sessions/s2/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "x" }) });
    const res = await app.request("/sessions/s2/roll", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: 999 }) });
    expect(res.status).toBe(409);
  });
});
