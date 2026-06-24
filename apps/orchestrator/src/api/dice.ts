// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { Hono } from "hono";
import type { DB, CatalogDB } from "@dicelore/core";
import type { SessionInfo, SessionSummary } from "@dicelore/shared";
import { MessageRequestSchema, ChoiceRequestSchema, RollRequestSchema } from "@dicelore/shared";
import { loreSearch, ruleSearch, logSince } from "@dicelore/core";
import { buildSnapshot } from "../dice/presentation.js";
import { getOrCreateHost, getHost, removeHost } from "../dice/registry.js";
import type { AgentFactory, SkillRef } from "../pkg/agent.js";

export interface ServerDeps {
  openSession: (sessionId: string) => DB; // 读侧句柄(每会话一文件；测试可注入内存库)
  listSessions: () => SessionSummary[]; // 会话列表(主页继续上次/最近)
}

export function createApp(deps: ServerDeps): Hono {
  const app = new Hono();

  // 会话列表(主页继续上次 / 最近 Session)
  app.get("/sessions", (c) => c.json({ sessions: deps.listSessions() }));

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

// 实时引擎面：动作进(POST messages/choices/roll) + 首屏快照，经 registry/DiceSession。
export interface LiveDeps {
  agentFactory: AgentFactory;
  skills?: SkillRef[]; // dice 默认 gm-core(staged skill)
  model?: string; // GM 模型覆盖
  openSession?: (id: string) => DB; // 省略则 DiceSession 用内存库(测试)
  listSessions?: () => SessionSummary[]; // 会话列表(主页继续上次/最近);省略则空
  catalog?: CatalogDB; // 给「开局 import 团本」用
  deleteSession?: (id: string) => void; // 删 .db 文件(server 注入);省略则只注销内存
  baseline?: boolean; // eval baseline 对照:传给 DiceSession 切教条/skills 空
}

export function createLiveApp(deps: LiveDeps): Hono {
  const app = new Hono();
  const hostDeps = (id: string) => ({ db: deps.openSession?.(id), agentFactory: deps.agentFactory, skills: deps.skills, model: deps.model, baseline: deps.baseline });

  // 开新局:选一个团本版本 import → 物化运行库(信任闸门)。body {tuanbenId, ref}。
  app.post("/sessions/:id/open", async (c) => {
    const id = c.req.param("id");
    const body = (await c.req.json()) as { tuanbenId: string; ref: string };
    if (!deps.catalog) return c.json({ code: "no_catalog" }, 400);
    getOrCreateHost(id, { ...hostDeps(id), importFrom: { catalog: deps.catalog, tuanbenId: body.tuanbenId, ref: body.ref } });
    return c.json({ sessionId: id, imported: true }, 201);
  });

  // kickoff:「开始游戏」→ 开场回合(prologue 驱动、幂等),WS 流式开场叙事。
  app.post("/sessions/:id/start", async (c) => {
    const id = c.req.param("id");
    const host = getOrCreateHost(id, hostDeps(id));
    const { started } = await host.start();
    return c.json({ sessionId: id, started }, 202);
  });

  app.get("/sessions", (c) => c.json({ sessions: deps.listSessions?.() ?? [] }));

  // 删会话:注销内存 host + 删 .db 文件。
  app.delete("/sessions/:id", (c) => {
    const id = c.req.param("id");
    removeHost(id);
    deps.deleteSession?.(id);
    return c.json({ ok: true });
  });

  app.get("/sessions/:id/presentation", (c) => {
    const id = c.req.param("id");
    const host = getOrCreateHost(id, hostDeps(id));
    return c.json(buildSnapshot(host.db, id));
  });

  // 跑团页左活动轨自查源浏览(world/rule/log)。q 为空=列全量(读投影)；q 非空=FTS 检索。
  // 返回 { source, entries:[{name,tag,snippet,canPin}] }。rule 只查不钉(canPin=false)。
  app.get("/sessions/:id/browse", (c) => {
    const id = c.req.param("id");
    const source = c.req.query("source") ?? "world";
    const q = (c.req.query("q") ?? "").trim();
    const db = getOrCreateHost(id, hostDeps(id)).db;
    type Entry = { name: string; tag: string | null; snippet: string; canPin: boolean; ref: string };
    const snip = (s: string | null) => (s ?? "").replace(/\s+/g, " ").slice(0, 80);
    let entries: Entry[] = [];
    if (source === "rule") {
      const rows = q
        ? ruleSearch(db, q, 50)
        : (db.prepare("SELECT rowid, name, content, category, version FROM rule ORDER BY name LIMIT 100").all() as ReturnType<typeof ruleSearch>);
      entries = rows.map((r) => ({ name: r.name, tag: r.category, snippet: snip(r.content), canPin: false, ref: `rule:${r.name}` }));
    } else if (source === "log") {
      const rows = logSince(db, 0).filter((r) => r.visible === 1);
      entries = rows.slice(-100).reverse().map((r) => ({ name: `#${r.seq} ${r.kind}`, tag: r.kind, snippet: snip(r.content), canPin: false, ref: `log:${r.seq}` }));
    } else {
      const rows = q
        ? loreSearch(db, q, 50)
        : (db.prepare("SELECT rowid, name, content, category, tags, visible FROM lore ORDER BY name LIMIT 100").all() as ReturnType<typeof loreSearch>);
      entries = rows.map((r) => ({ name: r.name, tag: r.category ?? r.tags, snippet: snip(r.content), canPin: true, ref: `world:${r.name}` }));
    }
    return c.json({ source, entries });
  });

  app.get("/sessions/:id", (c) => {
    const id = c.req.param("id");
    const info: SessionInfo = { sessionId: id, ended: false, title: id };
    return c.json(info);
  });

  app.post("/sessions/:id/messages", async (c) => {
    const id = c.req.param("id");
    const body = MessageRequestSchema.parse(await c.req.json());
    const host = getOrCreateHost(id, hostDeps(id));
    const { turnId } = await host.handleMessage(body.text);
    return c.json({ turnId }, 202);
  });
  app.post("/sessions/:id/choices", async (c) => {
    const id = c.req.param("id");
    const body = ChoiceRequestSchema.parse(await c.req.json());
    const host = getOrCreateHost(id, hostDeps(id));
    const { turnId } = await host.handleMessage(`[choice ${body.eventId}#${body.optionIndex}]`);
    return c.json({ turnId }, 202);
  });
  app.post("/sessions/:id/roll", async (c) => {
    const id = c.req.param("id");
    const body = RollRequestSchema.parse(await c.req.json());
    const host = getHost(id);
    if (!host || !host.handleRoll(body.eventId)) return c.json({ code: "no_pending_roll" }, 409);
    return c.json({ turnId: id }, 202);
  });

  return app;
}
