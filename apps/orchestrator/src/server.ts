import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { openDb, initSchema, type DB } from "@dicelore/core";
import type { SessionInfo } from "@dicelore/shared";
import { buildSnapshot } from "./presentation.js";

export interface ServerDeps {
  openSession: (sessionId: string) => DB; // 读侧句柄(每会话一文件；测试可注入内存库)
}

export function createApp(deps: ServerDeps): Hono {
  const app = new Hono();

  // 首屏 / 重连：全量呈现快照(接口页 §2)
  app.get("/sessions/:id/presentation", (c) => {
    const id = c.req.param("id");
    const db = deps.openSession(id);
    return c.json(buildSnapshot(db, id));
  });

  // 会话元信息(接口页 §2)。v1：终局/标题占位，待写侧接线后回填。
  app.get("/sessions/:id", (c) => {
    const id = c.req.param("id");
    const info: SessionInfo = { sessionId: id, ended: false, title: id };
    return c.json(info);
  });

  return app;
}

// 生产入口：每会话按 DICELORE_SESSIONS_DIR/{id}.db 打开(读侧)。
export function startServer(port: number): void {
  const dir = process.env.DICELORE_SESSIONS_DIR ?? ".";
  const app = createApp({
    openSession: (id) => {
      const db = openDb(`${dir}/${id}.db`);
      initSchema(db);
      return db;
    },
  });
  serve({ fetch: app.fetch, port });
  console.log(`[orchestrator] 只读 REST 监听 :${port}`);
}

// tsx src/server.ts 直接起
if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  startServer(Number(process.env.PORT ?? 8787));
}
