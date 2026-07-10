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

  // 裁决 usage-and-context §四：agent 上抛 context_compacting → streamTurn 广播 WS。
  it("context_compacting start/done 事件 → 广播对应 WS 消息", async () => {
    const hub = new WsHub();
    const sent: { type: string; phase?: string; result?: string; error?: string }[] = [];
    hub.add("s3", { send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 } as never);
    const driver = new FakeDiceGm(() => [
      { type: "context_compacting", phase: "start" },
      { type: "context_compacting", phase: "done", result: "success" },
      { type: "turn_end" },
    ]);
    await streamDriverTurn({ driver, hub, sessionId: "s3", turnId: "s3-t1" }, { text: "hi" });
    const cc = sent.filter((m) => m.type === "context_compacting");
    expect(cc).toEqual([
      { protocol: expect.anything(), type: "context_compacting", phase: "start" },
      { protocol: expect.anything(), type: "context_compacting", phase: "done", result: "success" },
    ]);
  });

  it("context_compacting done failed → 广播携带 result:failed + error", async () => {
    const hub = new WsHub();
    const sent: { type: string; phase?: string; result?: string; error?: string }[] = [];
    hub.add("s4", { send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 } as never);
    const driver = new FakeDiceGm(() => [
      { type: "context_compacting", phase: "start" },
      { type: "context_compacting", phase: "done", result: "failed", error: "boom" },
      { type: "turn_end" },
    ]);
    await streamDriverTurn({ driver, hub, sessionId: "s4", turnId: "s4-t1" }, { text: "hi" });
    const done = sent.find((m) => m.type === "context_compacting" && m.phase === "done");
    expect(done).toMatchObject({ phase: "done", result: "failed", error: "boom" });
  });
});
