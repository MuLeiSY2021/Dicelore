import { describe, it, expect } from "vitest";
import { openDb, initSchema, type DB } from "@dicelore/core";
import { createApp } from "./server.js";

function memSessionFactory(): (id: string) => DB {
  const db = openDb(":memory:");
  initSchema(db);
  db.prepare("INSERT INTO sheet (entity, attr, value, visible) VALUES ('张三','HP','12',1)").run();
  return () => db;
}

describe("orchestrator 只读 REST", () => {
  it("GET /sessions/:id/presentation 返回 §1 快照", async () => {
    const app = createApp({ openSession: memSessionFactory() });
    const res = await app.request("/sessions/s1/presentation");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.protocol).toBe("dicelore.client/1");
    expect(body.sessionId).toBe("s1");
    expect(body.sheets[0]).toEqual({ entity: "张三", cells: [{ attr: "HP", value: "12", visible: 1 }] });
  });

  it("GET /sessions/:id 返回会话元信息", async () => {
    const app = createApp({ openSession: memSessionFactory() });
    const res = await app.request("/sessions/s1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ sessionId: "s1", ended: false });
  });
});
