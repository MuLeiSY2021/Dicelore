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
import { loreSearch, ruleSearch, logSince, getLogger, metaGet } from "@dicelore/core";
import { buildSnapshot } from "../dice/presentation.js";
import { getOrCreateHost, removeHost } from "../dice/registry.js";
import { TurnInProgressError } from "../dice/DiceSession.js";
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

  // 会话元信息(接口页 §2)。ended 读 session_meta「ended」(由 MCP game_end 工具落)——
  // 与 WS game_end 信号同源(DiceSession 亦读同 key),避免 REST 与 WS 终局态矛盾(RT-4)。
  app.get("/sessions/:id", (c) => {
    const id = c.req.param("id");
    const db = deps.openSession(id);
    const info: SessionInfo = { sessionId: id, ended: metaGet(db, "ended") !== undefined, title: id };
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
  debug?: boolean; // eval/裸 CC 明骰降级:传给 DiceSession 不注入 rollGate(core 立即掷)
  sessionsDir?: string; // GM raw 日志根目录(穿给 DiceSession→DiceGm);省略=不记日志
}

export function createLiveApp(deps: LiveDeps): Hono {
  const app = new Hono();
  const hostDeps = (id: string) => ({ db: deps.openSession?.(id), agentFactory: deps.agentFactory, skills: deps.skills, model: deps.model, baseline: deps.baseline, debug: deps.debug, sessionsDir: deps.sessionsDir });

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
    try {
      const { started } = await host.start();
      return c.json({ sessionId: id, started }, 202);
    } catch (e) {
      if (e instanceof TurnInProgressError) {
        getLogger().warn({ sessionId: id }, "start 时已有回合在跑,返回 409 turn_in_progress");
        return c.json({ code: "turn_in_progress" }, 409);
      }
      throw e;
    }
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

  // B2：叙述/事件历史回填(重连补 narrate)。?since=<seq> 取该 seq 之后的事件；
  // ?visibleOnly=true(默认)只回可见事件。返回 { events:[{seq,kind,text,data}] }(接口页 §2)。
  app.get("/sessions/:id/events", (c) => {
    const id = c.req.param("id");
    const since = Number(c.req.query("since") ?? "0") || 0;
    const visibleOnly = c.req.query("visibleOnly") !== "false";
    const db = getOrCreateHost(id, hostDeps(id)).db;
    const rows = logSince(db, since).filter((r) => (visibleOnly ? r.visible === 1 : true));
    const events = rows.map((r) => ({
      seq: r.seq,
      kind: r.kind,
      text: r.content ?? "",
      data: r.data_json ? JSON.parse(r.data_json) : undefined,
    }));
    return c.json({ events });
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

  // 会话元信息(接口页 §2)。ended 同 createApp:读 session_meta「ended」与 WS game_end 同源(RT-4)。
  app.get("/sessions/:id", (c) => {
    const id = c.req.param("id");
    const db = getOrCreateHost(id, hostDeps(id)).db;
    const info: SessionInfo = { sessionId: id, ended: metaGet(db, "ended") !== undefined, title: id };
    return c.json(info);
  });

  app.post("/sessions/:id/messages", async (c) => {
    const id = c.req.param("id");
    const body = MessageRequestSchema.parse(await c.req.json());
    const host = getOrCreateHost(id, hostDeps(id));
    try {
      const { turnId } = await host.handleMessage(body.text);
      return c.json({ turnId }, 202);
    } catch (e) {
      if (e instanceof TurnInProgressError) {
        getLogger().warn({ sessionId: id }, "messages 时已有回合在跑(双击/重发/并发),返回 409 turn_in_progress");
        return c.json({ code: "turn_in_progress" }, 409);
      }
      throw e;
    }
  });
  app.post("/sessions/:id/choices", async (c) => {
    const id = c.req.param("id");
    const body = ChoiceRequestSchema.parse(await c.req.json());
    const host = getOrCreateHost(id, hostDeps(id));
    // B1：走正式「玩家选择捕获」路径(§5)——落所选记录 + 据所选作下一回合输入,不再伪装成 [choice] 文本。
    try {
      const { turnId } = await host.handleChoice(body.eventId, body.optionIndex);
      return c.json({ turnId }, 202);
    } catch (e) {
      if (e instanceof TurnInProgressError) {
        getLogger().warn({ sessionId: id, eventId: body.eventId }, "choices 时已有回合在跑,返回 409 turn_in_progress");
        return c.json({ code: "turn_in_progress" }, 409);
      }
      getLogger().warn({ err: e, sessionId: id, eventId: body.eventId, optionIndex: body.optionIndex }, "无 pending choice,客户端误请求,返回 409");
      return c.json({ code: "no_pending_choice" }, 409);
    }
  });
  app.post("/sessions/:id/roll", async (c) => {
    const id = c.req.param("id");
    const body = RollRequestSchema.parse(await c.req.json());
    // RT-3：用 getOrCreateHost（而非 getHost）——进程重启后内存 registry 为空，
    // 若玩家点掷骰是重启后首个请求(尚未经 WS/presentation 重连建 host)，getHost 会返回 undefined → 误判 409。
    // 重建 host 后 handleRoll→resolveRoll 无 waiter 时走「立即掷」分支(见 PlayerRollGate.resolveRoll)落 verdict。
    const host = getOrCreateHost(id, hostDeps(id));
    // no_pending_roll 仅在库里确无此 eventId 的 pending_roll 时回(真正的无待掷)；
    // 重启后有 awaiting pending_roll 的正常掷骰会被 resolveRoll 立即掷掉、返回 true，不再误当并发冲突拒掉。
    if (!host.handleRoll(body.eventId)) return c.json({ code: "no_pending_roll" }, 409);
    return c.json({ turnId: id }, 202);
  });

  return app;
}
