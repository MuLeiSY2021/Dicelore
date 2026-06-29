// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { WsHub } from "./wsHub.js";
import { streamDriverTurn } from "./streamTurn.js";
import { FakeDiceGm } from "../dicegm/FakeDiceGm.js";

describe("streamDriverTurn", () => {
  it("广播 turn_started + narration,返回 seq,不发 turn_ended", async () => {
    const hub = new WsHub();
    const sent: { type: string }[] = [];
    hub.add("s1", { send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 } as never);
    const driver = new FakeDiceGm(() => [{ type: "narration", text: "一段散文" }, { type: "turn_end" }]);
    const r = await streamDriverTurn({ driver, hub, sessionId: "s1", turnId: "s1-t1" }, { text: "hi" });
    expect(r).toEqual({ seq: 1, errored: false });
    const types = sent.map((m) => m.type);
    expect(types).toContain("turn_started");
    expect(types).toContain("narration_commit");
    expect(types).not.toContain("turn_ended");
  });

  it("driver error → errored:true", async () => {
    const hub = new WsHub();
    const driver = new FakeDiceGm(() => [{ type: "error", message: "boom" }]);
    const r = await streamDriverTurn({ driver, hub, sessionId: "s2", turnId: "t" }, { text: "x" });
    expect(r.errored).toBe(true);
  });
});
