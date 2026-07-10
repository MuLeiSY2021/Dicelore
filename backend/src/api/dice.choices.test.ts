// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema, type DB } from "@dicelore/backend";
import { createLiveApp } from "./dice.js";
import { removeHost } from "@dicelore/harness";
import { FakeDiceGm } from "@dicelore/harness";
import type { Agent } from "@dicelore/harness";

// B1：POST /choices 走正式路径(handleChoice)——不再伪装 [choice] 文本喂 handleMessage。
describe("POST /sessions/:id/choices(正式路径)", () => {
  it("据所选 option 作下一回合输入，返回 202 + turnId", async () => {
    const id = "choice-api-1";
    removeHost(id); // 清掉可能的旧 host(注册表为模块级)
    const db: DB = openDb(":memory:"); initSchema(db);
    db.prepare("INSERT INTO log (content, kind, data_json, visible) VALUES (?, 'choice', ?, 1)")
      .run("门口分叉", JSON.stringify({ prompt: "门口分叉", options: [
        { label: "推门进去", consequence: "惊动守卫" },
        { label: "绕到后窗", consequence: "耗时但隐蔽" },
      ] }));
    const eventId = (db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number }).s;

    let captured = "";
    const agentFactory = (): Agent => ({ async *runTurn(input) { captured = input.text; yield { type: "turn_end" }; } });
    const app = createLiveApp({ agentFactory, openSession: () => db });

    const res = await app.request(`/sessions/dicegm/${id}/choices`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, optionIndex: 1 }),
    });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.turnId).toBeTruthy();
    expect(captured).toContain("绕到后窗"); // 下一回合输入来自所选 option
    expect(captured).not.toMatch(/^\[choice /); // 不是伪装文本
    removeHost(id);
  });

  it("无此 choice → 409 no_pending_choice", async () => {
    const id = "choice-api-2";
    removeHost(id);
    const db: DB = openDb(":memory:"); initSchema(db);
    const app = createLiveApp({ agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]), openSession: () => db });
    const res = await app.request(`/sessions/dicegm/${id}/choices`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: 999, optionIndex: 0 }),
    });
    expect(res.status).toBe(409);
    removeHost(id);
  });
});
