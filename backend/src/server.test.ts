// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, initSchema, metaSet, type DB } from "@dicelore/backend";
import { createLiveApp } from "./api/dice.js";
import { listSessionSummaries } from "./api/sessions.js";
import { FakeDiceGm, removeHost } from "@dicelore/harness";

function memSessionFactory(): (id: string) => DB {
  const db = openDb(":memory:");
  initSchema(db);
  db.prepare("INSERT INTO state (entity, attr, value, visible) VALUES ('张三','HP','12',1)").run();
  return () => db;
}

// 终局会话:session_meta 写「ended」(MCP game_end 工具落)→ GET /sessions/:id 应返回 ended:true。
function endedSessionFactory(): (id: string) => DB {
  const db = openDb(":memory:");
  initSchema(db);
  metaSet(db, "ended", JSON.stringify({ reason: "you_death", outcome: "战死", seq: 7 }));
  return () => db;
}

const fakeFactory = () => new FakeDiceGm([{ type: "turn_end" }]);

// createApp 已删(生产 server 从不挂载,只读 REST 路径走 createLiveApp);只读 REST 用例改对
// createLiveApp 发请求(注入 openSession 内存库),覆盖真正跑生产的那份只读路由(接口页 §2)。
describe("orchestrator 只读 REST", () => {
  // createLiveApp 用进程级 host registry,跨用例复用同 id 会串库;每例后注销。
  afterEach(() => { for (const id of ["s1", "dead", "slist"]) removeHost(id); });

  it("GET /sessions/:id/presentation 返回 §1 快照", async () => {
    const app = createLiveApp({ agentFactory: fakeFactory, openSession: memSessionFactory(), listSessions: () => [] });
    const res = await app.request("/sessions/dicegm/s1/presentation");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.protocol).toBe("dicelore.client/1");
    expect(body.sessionId).toBe("s1");
    expect(body.sheets[0]).toEqual({ entity: "张三", cells: [{ attr: "HP", value: "12", visible: 1 }] });
  });

  it("GET /sessions/:id 返回会话元信息", async () => {
    const app = createLiveApp({ agentFactory: fakeFactory, openSession: memSessionFactory(), listSessions: () => [] });
    const res = await app.request("/sessions/dicegm/s1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ sessionId: "s1", kind: "dicegm", ended: false });
  });

  it("GET /sessions/:id 终局会话(meta ended 已落)→ ended:true(RT-4,与 WS game_end 同源)", async () => {
    const app = createLiveApp({ agentFactory: fakeFactory, openSession: endedSessionFactory(), listSessions: () => [] });
    const res = await app.request("/sessions/dicegm/dead");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ sessionId: "dead", ended: true });
  });

  it("GET /sessions 返回会话列表", async () => {
    const app = createLiveApp({
      agentFactory: fakeFactory,
      openSession: memSessionFactory(),
      listSessions: () => [{ sessionId: "demo", kind: "dicegm", title: "demo", status: "active", packName: "demo" }],
    });
    const res = await app.request("/sessions/dicegm");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions[0].sessionId).toBe("demo");
  });
});

describe("listSessionSummaries", () => {
  it("枚举 session 子目录并按名排序映射成 summaries", () => {
    const dir = mkdtempSync(join(tmpdir(), "dicelore-sessions-"));
    try {
      mkdirSync(join(dir, "beta"));
      mkdirSync(join(dir, "alpha"));
      writeFileSync(join(dir, "beta", "session.db"), "");
      writeFileSync(join(dir, "alpha", "session.db"), "");
      writeFileSync(join(dir, "notes.txt"), ""); // 散落文件,非 session 子目录,忽略
      const got = listSessionSummaries(dir, "dicegm");
      expect(got).toEqual([
        { sessionId: "alpha", kind: "dicegm", title: "alpha", status: "active", packName: "alpha", lastActionAt: expect.any(Number) },
        { sessionId: "beta", kind: "dicegm", title: "beta", status: "active", packName: "beta", lastActionAt: expect.any(Number) },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("目录不存在返回 []", () => {
    expect(listSessionSummaries(join(tmpdir(), "dicelore-nope-does-not-exist"), "dicegm")).toEqual([]);
  });
});
