// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// play-mcp 集成测:起 FakeDiceGm 后端 + 调 handler 验 open→start→send→presentation 闭环。不烧 LLM。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { serve } from "@hono/node-server";
import { createLiveApp } from "@dicelore/backend";
import { attachWsUpgrade } from "@dicelore/backend";
import { FakeDiceGm } from "@dicelore/harness";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, initSchema } from "@dicelore/backend";
import { doOpenSession, doStartGame, doSendMessage } from "./play-mcp.js";

let server: ReturnType<typeof serve>;
beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "dl-pmcp-"));
  process.env.DICELORE_SESSIONS_DIR = dir;
  const openSession = (id: string) => { const d = openDb(`${dir}/${id}.db`); initSchema(d); return d; };
  const agentFactory = () => new FakeDiceGm([{ type: "narration", text: "门开了。" }, { type: "turn_end" }]);
  const app = createLiveApp({ agentFactory, openSession });
  server = serve({ fetch: app.fetch, port: 0 });
  attachWsUpgrade(server, { openSession, agentFactory }); // WS 升级:narration 经 WS 流式
  process.env.DICELORE_PLAY_URL = `http://localhost:${(server.address() as { port: number }).port}`;
});
afterAll(() => {
  server.close();
  delete process.env.DICELORE_PLAY_URL;
  delete process.env.DICELORE_SESSIONS_DIR;
});

describe("play-mcp handlers", () => {
  it("open→start→send 闭环经 WS 拿 GM 散文", async () => {
    const sid = await doOpenSession("orc-hunt");
    expect(sid).toBeTruthy();
    const startRes = await doStartGame(sid);
    expect(startRes.narrations.length).toBeGreaterThan(0);
    const sendRes = await doSendMessage(sid, "去森林");
    expect(sendRes.narrations).toContain("门开了。");
    expect(sendRes.turnEnded).toBe(true);
  });
});
