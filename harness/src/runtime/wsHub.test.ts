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
import { CLIENT_PROTOCOL, type StreamMessage } from "@dicelore/shared";

function fakeWs() { const sent: string[] = []; return { sent, send: (d: string) => sent.push(d), readyState: 1 }; }
const msg: StreamMessage = { protocol: CLIENT_PROTOCOL, type: "turn_ended", turnId: "t1", seq: 5 };

describe("WsHub", () => {
  it("广播到该 session 的所有连接，序列化为 JSON", () => {
    const hub = new WsHub();
    const a = fakeWs(), b = fakeWs();
    hub.add("s1", a); hub.add("s1", b);
    hub.broadcast("s1", msg);
    expect(JSON.parse(a.sent[0]).type).toBe("turn_ended");
    expect(b.sent.length).toBe(1);
  });

  it("不串台到别的 session；remove 后不再收", () => {
    const hub = new WsHub();
    const a = fakeWs(), other = fakeWs();
    hub.add("s1", a); hub.add("s2", other);
    hub.remove("s1", a);
    hub.broadcast("s1", msg);
    expect(a.sent.length).toBe(0);
    expect(other.sent.length).toBe(0);
  });

  it("跳过非 OPEN(readyState!=1)的连接", () => {
    const hub = new WsHub();
    const closed = { sent: [] as string[], send(d: string) { this.sent.push(d); }, readyState: 3 };
    hub.add("s1", closed);
    hub.broadcast("s1", msg);
    expect(closed.sent.length).toBe(0);
  });
});
