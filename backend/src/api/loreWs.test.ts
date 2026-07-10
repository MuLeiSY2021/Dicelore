// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, afterEach } from "vitest";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import { openCatalog } from "@dicelore/backend";
import type { LoreStreamMessage } from "@dicelore/shared";
import { createLoreApp, getLoreEntry } from "./lore.js";
import { attachWsUpgrade } from "./ws.js";
import { makeFakeAgentFactory } from "../server.js";

// loregm 域 WS（hidden-roll-and-loregm-ws 裁决 §二）端到端：起真 http server + attachWsUpgrade，
// FAKE_GM 假构建驱动一轮 send → WS 收 turn_started/toolcall/draft_delta/turn_ended。

interface Live { url: string; close: () => Promise<void> }

async function startLive(): Promise<Live> {
  const catalog = openCatalog(":memory:");
  const app = new Hono();
  app.route("/", createLoreApp({ catalog, agentFactory: makeFakeAgentFactory() }));
  const server = serve({ fetch: app.fetch, port: 0 });
  // 等待监听就绪拿到端口。
  const port = await new Promise<number>((resolve) => {
    const s = server as unknown as { address(): AddressInfo | string | null; once(ev: string, cb: () => void): void };
    const addr = s.address();
    if (addr && typeof addr !== "string") return resolve(addr.port);
    s.once("listening", () => resolve((s.address() as AddressInfo).port));
  });
  attachWsUpgrade(server, {
    openSession: () => { throw new Error("dice openSession 不应被 loregm WS 用到"); },
    agentFactory: makeFakeAgentFactory(),
    resolveLoreHub: (id) => getLoreEntry(id)?.hub,
  });
  const base = `http://127.0.0.1:${port}`;
  return {
    url: base,
    close: () => new Promise<void>((res) => { (server as unknown as { close(cb: () => void): void }).close(() => { catalog.close(); res(); }); }),
  };
}

let live: Live | undefined;
afterEach(async () => { await live?.close(); live = undefined; });

async function collectUntilTurnEnded(ws: WebSocket, timeoutMs = 4000): Promise<LoreStreamMessage[]> {
  const msgs: LoreStreamMessage[] = [];
  return await new Promise<LoreStreamMessage[]>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`超时；已收 ${msgs.length} 条: ${JSON.stringify(msgs)}`)), timeoutMs);
    ws.on("message", (data) => {
      const m = JSON.parse(String(data)) as LoreStreamMessage;
      msgs.push(m);
      if (m.type === "turn_ended") { clearTimeout(timer); resolve(msgs); }
    });
    ws.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

describe("GET /sessions/loregm/:id/ws（loregm 域 WS 端到端）", () => {
  it("连接后一轮 send → 收 turn_started/toolcall/draft_delta/turn_ended", async () => {
    live = await startLive();
    // 显式建会话。
    const created = await (await fetch(`${live.url}/sessions/loregm`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "凡人修仙" }),
    })).json() as { sessionId: string; kind: string };
    expect(created.kind).toBe("loregm");
    const id = created.sessionId;

    const ws = new WebSocket(`${live.url.replace("http", "ws")}/sessions/loregm/${id}/ws`);
    await new Promise<void>((res, rej) => { ws.on("open", () => res()); ws.on("error", rej); });

    const collected = collectUntilTurnEnded(ws);
    // 驱动一轮：假构建驱动写 manifest/prologue/lore/rule/state（经 hooks 发 toolcall+draft_delta）。
    const posted = await fetch(`${live.url}/sessions/loregm/${id}/messages`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "造一个凡人修仙团本" }),
    });
    expect(posted.status).toBe(202);

    const msgs = await collected;
    ws.close();

    expect(msgs[0].type).toBe("turn_started");
    expect(msgs[msgs.length - 1].type).toBe("turn_ended");
    const toolcalls = msgs.filter((m) => m.type === "toolcall");
    const deltas = msgs.filter((m) => m.type === "draft_delta");
    // 假构建脚本 5 个写工具 → 5 条 toolcall + 5 条 draft_delta。
    expect(toolcalls.length).toBe(5);
    expect(deltas.length).toBe(5);
    // toolcall 携带 tool/args/ok；draft_delta 携带递增 seq + 分域 section。
    expect(toolcalls.every((m) => m.type === "toolcall" && m.ok === true)).toBe(true);
    const sections = deltas.map((m) => (m.type === "draft_delta" ? m.changes[0].section : ""));
    expect(sections).toEqual(["manifest", "prologue", "world", "rules", "sheets"]);
    const seqs = deltas.map((m) => (m.type === "draft_delta" ? m.seq : -1));
    expect(seqs).toEqual([1, 2, 3, 4, 5]); // Draft.seq 递增
    // turn_ended.seq = 末次 Draft 修订号。
    const ended = msgs[msgs.length - 1];
    expect(ended.type === "turn_ended" && ended.seq).toBe(5);
  });

  it("会话不存在 → WS 升级被拒（连接关闭）", async () => {
    live = await startLive();
    const ws = new WebSocket(`${live.url.replace("http", "ws")}/sessions/loregm/does-not-exist/ws`);
    const outcome = await new Promise<string>((resolve) => {
      ws.on("open", () => resolve("open"));
      ws.on("error", () => resolve("error"));
      ws.on("close", () => resolve("close"));
    });
    expect(["error", "close"]).toContain(outcome); // 未建会话 → socket.destroy，不 open
  });
});
