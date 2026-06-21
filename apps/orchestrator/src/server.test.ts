import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, initSchema, type DB } from "@dicelore/core";
import { createApp } from "./server.js";
import { listSessionSummaries } from "./sessions.js";

function memSessionFactory(): (id: string) => DB {
  const db = openDb(":memory:");
  initSchema(db);
  db.prepare("INSERT INTO sheet (entity, attr, value, visible) VALUES ('张三','HP','12',1)").run();
  return () => db;
}

describe("orchestrator 只读 REST", () => {
  it("GET /sessions/:id/presentation 返回 §1 快照", async () => {
    const app = createApp({ openSession: memSessionFactory(), listSessions: () => [] });
    const res = await app.request("/sessions/s1/presentation");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.protocol).toBe("dicelore.client/1");
    expect(body.sessionId).toBe("s1");
    expect(body.sheets[0]).toEqual({ entity: "张三", cells: [{ attr: "HP", value: "12", visible: 1 }] });
  });

  it("GET /sessions/:id 返回会话元信息", async () => {
    const app = createApp({ openSession: memSessionFactory(), listSessions: () => [] });
    const res = await app.request("/sessions/s1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ sessionId: "s1", ended: false });
  });

  it("GET /sessions 返回会话列表", async () => {
    const app = createApp({
      openSession: memSessionFactory(),
      listSessions: () => [{ sessionId: "demo", title: "demo", status: "active" }],
    });
    const res = await app.request("/sessions");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions[0].sessionId).toBe("demo");
  });
});

describe("listSessionSummaries", () => {
  it("枚举 *.db 文件并按文件名排序映射成 summaries", () => {
    const dir = mkdtempSync(join(tmpdir(), "dicelore-sessions-"));
    try {
      writeFileSync(join(dir, "beta.db"), "");
      writeFileSync(join(dir, "alpha.db"), "");
      writeFileSync(join(dir, "notes.txt"), "");
      const got = listSessionSummaries(dir);
      expect(got).toEqual([
        { sessionId: "alpha", title: "alpha", status: "active" },
        { sessionId: "beta", title: "beta", status: "active" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("目录不存在返回 []", () => {
    expect(listSessionSummaries(join(tmpdir(), "dicelore-nope-does-not-exist"))).toEqual([]);
  });
});
