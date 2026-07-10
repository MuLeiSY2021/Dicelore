// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { DB } from "@dicelore/interface";
import type { SessionInfo, SessionSummary } from "@dicelore/shared";
import { MessageRequestSchema, ChoiceRequestSchema, RollRequestSchema, CreateSessionRequestSchema, SessionConfigUpdateSchema, CreateBranchRequestSchema } from "@dicelore/shared";
import { loreSearch, ruleSearch, logSince, metaGet, openSessionBackend, openDb, initSchema, list, MAIN_BRANCH, branchDbKey, currentBranch, listBranches, checkoutBranch, createBranch, PackValidationError } from "@dicelore/backend";
import { getLogger } from "@dicelore/logs";
import { buildSnapshot } from "./presentation.js";
import { getOrCreateHost, removeHost, TurnInProgressError, type AgentFactory, type PluginRef } from "@dicelore/harness";

// CatalogDB 只是团本库 DB 句柄别名(=interface DB);组合根经它给「开局 import 团本」。
type CatalogDB = DB;

// 测试兜底:无注入 openSession 时建内存库(原 DiceSession 自开库逻辑上移至组合根)。
function memoryDb(): DB { const d = openDb(":memory:"); initSchema(d); return d; }

// 实时引擎面(dicegm)：动作进(POST messages/choices/roll) + 首屏快照，经 registry/DiceSession。
// HTTP 表皮拉平(session-surface-flatten)：全部挂 /sessions/dicegm/*，与 loregm 对称。
export interface LiveDeps {
  agentFactory: AgentFactory;
  plugin?: PluginRef; // dice skill plugin(gm-core+flows,boot 期物化到 $/dice)
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
  // 组合根:解析本局 db(注入的 openSession,省略则内存库 for 测试)→ openSessionBackend(db) 建存储端口实例 →
  // 把 {db, backend} 注入 harness 的 DiceSession(harness 不自开库/不自建 backend,守 storage-port ADR §4)。
  //
  // 分支感知(debrief-and-branch §二)：host 绑定的是「当前分支」的 db，而非恒等于 sessionId 的库。
  // 当前分支存 main 分支 db 的 session_meta；main 分支 db 键=sessionId(向后兼容既有 session.db)。
  // checkout/新建分支后主动 removeHost(id)，令下次请求经此重建 host、绑定新的当前分支库。
  const openBranch = (sessionId: string, branchId: string): DB =>
    deps.openSession ? deps.openSession(branchDbKey(sessionId, branchId)) : memoryDb();
  const resolveDb = (id: string): DB => {
    if (!deps.openSession) return memoryDb();
    const mainDb = deps.openSession(id);
    const cur = currentBranch(mainDb);
    return cur === MAIN_BRANCH ? mainDb : deps.openSession(branchDbKey(id, cur));
  };
  const hostDeps = (id: string) => {
    const db = resolveDb(id);
    return { db, backend: openSessionBackend(db), agentFactory: deps.agentFactory, plugin: deps.plugin, model: deps.model, baseline: deps.baseline, debug: deps.debug, sessionsDir: deps.sessionsDir };
  };

  // 显式建会话(session-surface-flatten §三)：POST /sessions/dicegm {teamId, version?} → 201 {sessionId,kind}。
  // 取代旧 POST /sessions/:id/open 懒建(C2 完全移除)：服务端生成 sessionId、选团本版本 import → 物化运行库(信任闸门)。
  // version 省略或显式传 "head"(wiki 缺省/客户端自然值) = 默认最新版：core checkout 不认 "head" 字符串,
  // 此处先从 catalog head 解析 commitId(同 BE-checkout-head 端点层解析,不动 core 语义,RT-open-head-ref)。
  app.post("/sessions/dicegm", async (c) => {
    const body = CreateSessionRequestSchema.parse(await c.req.json());
    if (!deps.catalog) {
      getLogger().warn("建 dicegm 会话:无 catalog 注入,返回 400 no_catalog");
      return c.json({ code: "no_catalog" }, 400);
    }
    if (!body.teamId) {
      return c.json({ code: "bad_request", message: "teamId 必填" }, 400);
    }
    // "head" 与省略同义,都解析为 catalog head commitId;仅真实 tag label / commitId 直接透传给 checkout。
    const explicitVersion = body.version && body.version !== "head" ? body.version : undefined;
    const ref = explicitVersion ?? list(deps.catalog).find((a) => a.id === body.teamId)?.head ?? undefined;
    if (!ref) {
      return c.json({ code: "unknown_team", message: "团本不存在或无已发布版本" }, 400);
    }
    const id = randomUUID();
    // 信任闸门(importPack)在 DiceSession 构造期同步重验团本包;拒包 throw PackValidationError。
    // RT-open-500:捕获→映射 400 {code:"invalid_pack",issues:[…]},把结构化校验失败原因回客户端,
    // 而非 uncaught → 500。host 未入注册表(create 回调 throw 前 map.set 未执行),无需清理。
    try {
      getOrCreateHost(id, { ...hostDeps(id), importFrom: { catalog: deps.catalog, adventureId: body.teamId, ref } });
    } catch (e) {
      if (e instanceof PackValidationError || (e != null && typeof e === "object" && (e as { code?: unknown }).code === "invalid_pack")) {
        const issues = (e as PackValidationError).issues ?? [];
        getLogger().warn({ sessionId: id, teamId: body.teamId, issues }, "建 dicegm 会话:团本包信任闸门拒包,返回 400 invalid_pack");
        return c.json({ code: "invalid_pack", issues }, 400);
      }
      // RT-open-500 补齐:畸形包能过 validatePack 表头校验、却在 importPack 物化期抛(如 state.visible/pools.weight
      // 填非数值→Number()=NaN→better-sqlite3 绑 NULL→NOT NULL 约束 SqliteError)。物化期异常同属「客户端所选包不可用」
      // =客户端错误,一并映射 400 invalid_pack(而非 uncaught→500);issues 带物化错误信息。host 未入注册表无需清理。
      const msg = e instanceof Error ? e.message : String(e);
      getLogger().warn({ sessionId: id, teamId: body.teamId, err: e }, "建 dicegm 会话:团本包物化期错误,映射 400 invalid_pack(非 500)");
      return c.json({ code: "invalid_pack", issues: [{ path: "pack", msg }] }, 400);
    }
    getLogger().info({ sessionId: id, teamId: body.teamId, ref }, "建 dicegm 会话:import 团本");
    return c.json({ sessionId: id, kind: "dicegm" }, 201);
  });

  // kickoff:「开始游戏」→ 开场回合(prologue 驱动、幂等),WS 流式开场叙事。
  app.post("/sessions/dicegm/:id/start", async (c) => {
    const id = c.req.param("id");
    const host = getOrCreateHost(id, hostDeps(id));
    try {
      const { turnId } = await host.start();
      return c.json({ turnId }, 202);
    } catch (e) {
      if (e instanceof TurnInProgressError) {
        getLogger().warn({ sessionId: id }, "start 时已有回合在跑,返回 409 turn_in_progress");
        return c.json({ code: "turn_in_progress" }, 409);
      }
      getLogger().error({ sessionId: id, err: e }, "start 未预期异常,抛给 Hono(500)");
      throw e;
    }
  });

  app.get("/sessions/dicegm", (c) => c.json({ sessions: deps.listSessions?.() ?? [] }));

  // 统一 session config（model-switch + spoiler-tiering + usage-and-context 三份裁决协同）。
  //   GET  → 200 {model, spoilerTier, pendingModel?}（读回完整 config）。
  //   POST → 200 更新后完整 config；body 部分更新 {model?, spoilerTier?}：
  //          · model     设 pendingModel、下回合 drive-turn 起生效（buildInit 读 current_model）；
  //          · spoilerTier 存 session_meta、立即生效（前端渲染层消费）。
  // config-endpoint 节点独占本端点——其余 feature 节点勿另建 config 路由。
  app.get("/sessions/dicegm/:id/config", (c) => {
    const host = getOrCreateHost(c.req.param("id"), hostDeps(c.req.param("id")));
    return c.json(host.getConfig());
  });
  app.post("/sessions/dicegm/:id/config", async (c) => {
    const id = c.req.param("id");
    const body = SessionConfigUpdateSchema.parse(await c.req.json());
    const host = getOrCreateHost(id, hostDeps(id));
    host.setConfig(body);
    getLogger().info({ sessionId: id, update: body }, "更新 dicegm session config（model 下回合生效 / spoilerTier 立即）");
    return c.json(host.getConfig());
  });

  // 删会话:注销内存 host + 删 .db 文件。
  app.delete("/sessions/dicegm/:id", (c) => {
    const id = c.req.param("id");
    removeHost(id);
    deps.deleteSession?.(id);
    getLogger().info({ sessionId: id }, "删会话:注销内存 host + 删 .db 文件");
    return c.json({ ok: true });
  });

  app.get("/sessions/dicegm/:id/presentation", (c) => {
    const id = c.req.param("id");
    const host = getOrCreateHost(id, hostDeps(id));
    // spoiler-tiering §一.5：includeHidden=true 时全量含 visible=0（bay 关闭档点 btn 按需拉），offset/limit 分页。
    const includeHidden = c.req.query("includeHidden") === "true";
    const limitRaw = c.req.query("limit");
    const offset = Number(c.req.query("offset") ?? "0") || 0;
    const limit = limitRaw !== undefined ? Number(limitRaw) || undefined : undefined;
    return c.json(buildSnapshot(host.db, id, includeHidden ? { includeHidden, offset, limit } : {}));
  });

  // B2：叙述/事件历史回填(重连补 narrate)。?since=<seq> 取该 seq 之后的事件；
  // spoiler-tiering §一.2 FE9-4：默认全量下发含 visible=0（暗骰结果/隐藏 sheet 改等）——后端不做 visible 截流。
  // visibleOnly 参数保留(向后兼容)但默认全量：仅 ?visibleOnly=true 时才只回可见事件。
  // 返回 { events:[{seq,kind,text,data,visible}] }(接口页 §2)——带 visible 供前端按 spoiler 档渲染。
  app.get("/sessions/dicegm/:id/events", (c) => {
    const id = c.req.param("id");
    const since = Number(c.req.query("since") ?? "0") || 0;
    const visibleOnly = c.req.query("visibleOnly") === "true";
    const db = getOrCreateHost(id, hostDeps(id)).db;
    const rows = logSince(db, since).filter((r) => (visibleOnly ? r.visible === 1 : true));
    const events = rows.map((r) => ({
      seq: r.seq,
      kind: r.kind,
      text: r.content ?? "",
      data: r.data_json ? JSON.parse(r.data_json) : undefined,
      visible: r.visible,
    }));
    return c.json({ events });
  });

  // 跑团页左活动轨自查源浏览(world/rule/log)。q 为空=列全量(读投影)；q 非空=FTS 检索。
  // 返回 { source, entries:[{name,tag,snippet,canPin}] }。rule 只查不钉(canPin=false)。
  app.get("/sessions/dicegm/:id/browse", (c) => {
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

  // 会话元信息(接口页 §2)。ended 读 session_meta「ended」(由 MCP game_end 工具落)——
  // 与 WS game_end 信号同源(DiceSession 亦读同 key),避免 REST 与 WS 终局态矛盾(RT-4)。
  // 对称形状(session-surface-flatten §五)：{sessionId, kind, status, ended, title}。
  // debrief-and-branch §一：game_end 后不直接归档而转「战后复盘」态 → status="debrief"（ended 仍为 true）。
  app.get("/sessions/dicegm/:id", (c) => {
    const id = c.req.param("id");
    const db = getOrCreateHost(id, hostDeps(id)).db;
    const ended = metaGet(db, "ended") !== undefined;
    const info: SessionInfo = { sessionId: id, kind: "dicegm", status: ended ? "debrief" : "active", ended, title: id };
    return c.json(info);
  });

  app.post("/sessions/dicegm/:id/messages", async (c) => {
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
      getLogger().error({ sessionId: id, err: e }, "messages 未预期异常,抛给 Hono(500)");
      throw e;
    }
  });
  app.post("/sessions/dicegm/:id/choices", async (c) => {
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
  app.post("/sessions/dicegm/:id/roll", async (c) => {
    const id = c.req.param("id");
    const body = RollRequestSchema.parse(await c.req.json());
    // RT-3：用 getOrCreateHost（而非 getHost）——进程重启后内存 registry 为空，
    // 若玩家点掷骰是重启后首个请求(尚未经 WS/presentation 重连建 host)，getHost 会返回 undefined → 误判 409。
    // 重建 host 后 handleRoll→resolveRoll 无 waiter 时走「立即掷」分支(见 PlayerRollGate.resolveRoll)落 verdict。
    const host = getOrCreateHost(id, hostDeps(id));
    // no_pending_roll 仅在库里确无此 eventId 的 pending_roll 时回(真正的无待掷)；
    // 重启后有 awaiting pending_roll 的正常掷骰会被 resolveRoll 立即掷掉、返回 true，不再误当并发冲突拒掉。
    if (!host.handleRoll(body.eventId)) {
      getLogger().warn({ sessionId: id, eventId: body.eventId }, "roll:库内无此 pending_roll,返回 409 no_pending_roll");
      return c.json({ code: "no_pending_roll" }, 409);
    }
    // roll 不开新回合(handleRoll 只 resolve 已在 WS 驱动回合内的 pending_roll、返回 boolean),
    // 故无真 turnId 可返——返 { ok: true } 而非把 sessionId 充作 turnId 误导调用方。
    return c.json({ ok: true }, 202);
  });

  // ── 会话分支（debrief-and-branch §二）───────────────────────────────────
  // 分支需持久化会话库（openSession 注入）；纯内存测试无库则 400 no_session_store。
  // 新建分支 = 复制当前分支 db（截断到 fromSeq）→ 新分支自动成当前分支（C7）；removeHost 令下次请求重绑。
  app.post("/sessions/dicegm/:id/branches", async (c) => {
    const id = c.req.param("id");
    if (!deps.openSession) return c.json({ code: "no_session_store" }, 400);
    let body: { fromSeq?: number; name?: string } = {};
    try { body = CreateBranchRequestSchema.parse(await c.req.json()); } catch { /* 空/非法 body → 默认到当前 seq */ }
    const res = createBranch(deps.openSession(id), openBranch, id, body);
    removeHost(id);
    getLogger().info({ sessionId: id, branchId: res.branchId, fromSeq: res.fromSeq }, "新建会话分支(复制当前分支→自动成当前分支)");
    return c.json(res, 201);
  });

  // 列分支：{currentBranchId, branches:[{branchId,name,createdAt,seq,isCurrent}]}。无库 → 只 main 空态。
  app.get("/sessions/dicegm/:id/branches", (c) => {
    const id = c.req.param("id");
    if (!deps.openSession) return c.json({ currentBranchId: MAIN_BRANCH, branches: [] });
    return c.json(listBranches(deps.openSession(id), openBranch, id));
  });

  // 切换当前分支 + 返回该分支 presentation 快照。未知分支 → 404 unknown_branch。
  app.post("/sessions/dicegm/:id/branches/:branchId/checkout", (c) => {
    const id = c.req.param("id");
    const branchId = c.req.param("branchId");
    if (!deps.openSession) return c.json({ code: "no_session_store" }, 400);
    if (!checkoutBranch(deps.openSession(id), branchId)) {
      getLogger().warn({ sessionId: id, branchId }, "checkout:未知分支,返回 404 unknown_branch");
      return c.json({ code: "unknown_branch" }, 404);
    }
    removeHost(id);
    const host = getOrCreateHost(id, hostDeps(id)); // 现绑定切换后的当前分支库
    getLogger().info({ sessionId: id, branchId }, "checkout:切换当前分支+重算快照");
    return c.json({ branchId, presentation: buildSnapshot(host.db, id) });
  });

  // SNAP-1 读档（ADR-0017 v1：自动恢复最近快照，非手动回滚按钮/branch/续命——那些 v2）。
  // TR3 additive：可选 body {toUuid?}。
  //   · 带 toSeq → host.rewindToSeq(toSeq)：在当前分支截断到该 seq(其后事件丢弃、领域态复位到最近快照)；202 {seq}。
  //   · 带 toUuid → host.rewindTo(toUuid)：按 transcript 节点 uuid 回退(领域态经 dice-db RollbackHook + 移 HEAD)；
  //                 成功 202 {uuid}；uuid 不在 transcript 树内 → 404 unknown_anchor；该锚点无 db 快照 → 409 no_snapshot_for_anchor。
  //   · 皆不带 → 现有 host.rewind()(撤上一轮·最近快照)，向后兼容：202 {snapshotId} / 无快照 409 no_snapshot。
  // 有回合在跑 → 409 turn_in_progress。
  app.post("/sessions/dicegm/:id/rewind", async (c) => {
    const id = c.req.param("id");
    const host = getOrCreateHost(id, hostDeps(id));
    // body 可空/非法：容错解析，缺 toSeq/toUuid 即走旧路径（既有客户端发 {} 或空 body 均兼容）。
    let toUuid: string | undefined;
    let toSeq: number | undefined;
    try {
      const body = (await c.req.json()) as { toUuid?: unknown; toSeq?: unknown } | null;
      if (body && typeof body.toUuid === "string" && body.toUuid.length > 0) toUuid = body.toUuid;
      if (body && typeof body.toSeq === "number" && Number.isFinite(body.toSeq)) toSeq = body.toSeq;
    } catch { /* 空/非法 body → 走旧路径 */ }

    try {
      if (toSeq !== undefined) {
        // debrief-and-branch §二.4：rewind 覆盖「当前分支」——截断当前分支 jsonl 到 toSeq，不新增/改其它分支。
        await host.rewindToSeq(toSeq);
        return c.json({ seq: toSeq }, 202);
      }
      if (toUuid) {
        const r = await host.rewindTo(toUuid);
        return c.json({ uuid: r.uuid }, 202);
      }
      const res = await host.rewind();
      if (!res) return c.json({ code: "no_snapshot" }, 409);
      return c.json({ snapshotId: res.snapshotId }, 202);
    } catch (e) {
      if (e instanceof TurnInProgressError) {
        getLogger().warn({ sessionId: id }, "rewind 时已有回合在跑,返回 409 turn_in_progress");
        return c.json({ code: "turn_in_progress" }, 409);
      }
      const msg = e instanceof Error ? e.message : String(e);
      // toUuid 路径的可预期失败映射（避免 500）：锚点不在树内 / 该锚点无 db 快照。
      if (msg.includes("no_snapshot_for_anchor")) {
        getLogger().warn({ sessionId: id, toUuid }, "rewind:锚点无对应 db 快照,返回 409 no_snapshot_for_anchor");
        return c.json({ code: "no_snapshot_for_anchor" }, 409);
      }
      if (msg.includes("不在 transcript 树内") || msg.includes("no_transcript")) {
        getLogger().warn({ sessionId: id, toUuid }, "rewind:锚点 uuid 不在 transcript 树内,返回 404 unknown_anchor");
        return c.json({ code: "unknown_anchor" }, 404);
      }
      getLogger().error({ sessionId: id, err: e }, "rewind 未预期异常,抛给 Hono(500)");
      throw e;
    }
  });

  return app;
}
