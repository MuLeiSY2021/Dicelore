// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { SessionHost } from "./SessionHost.js";
import { FakeGmDriver } from "../gm/FakeGmDriver.js";

describe("SessionHost", () => {
  it("handleMessage 跑一回合：WS 收到 turn_started…turn_ended", async () => {
    const host = new SessionHost("s1", {
      driverFactory: () => new FakeGmDriver([{ type: "narration", text: "门开了。" }, { type: "turn_end" }]),
    });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    const { turnId } = await host.handleMessage("我推门");
    const types = sent.map((m) => m.type);
    expect(turnId).toBeTruthy();
    expect(types[0]).toBe("turn_started");
    expect(types).toContain("narration_commit");
    expect(types.at(-1)).toBe("turn_ended");
  });

  it("onCanonWrite 经 hub 推 presentation_delta", async () => {
    const host = new SessionHost("s1", { driverFactory: () => new FakeGmDriver([{ type: "turn_end" }]) });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    host.onCanonWrite({ kind: "mutation", seq: 7, toolName: "sheet_update", output: {} });
    expect(sent.find((m) => m.type === "presentation_delta")?.delta.seq).toBe(7);
  });

  it("handleRoll 对无待掷返回 false", () => {
    const host = new SessionHost("s1", { driverFactory: () => new FakeGmDriver([{ type: "turn_end" }]) });
    expect(host.handleRoll(999)).toBe(false);
  });
});
