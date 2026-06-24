// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { openDb, initSchema, createMcpServer, buildPresentationModel, runTurnEnd, importPack, metaSet, metaGet, type DB, type CanonWriteEvent, type CatalogDB } from "@dicelore/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WsHub, type WsLike } from "../pkg/wsHub.js";
import { PlayerRollGate } from "./rollGate.js";
import { mapCanonWrite } from "./notify.js";
import { runTurn, type TurnEndResult } from "./turnLoop.js";
import { buildOpeningPrompt, buildBaselinePrompt } from "./openingPrompt.js";
import type { AgentFactory, AgentInit, SkillRef } from "../pkg/agent.js";
import type { Session } from "../pkg/session.js";

let turnCounter = 0; // 进程内自增,测试稳定(不依赖随机/时间)
function nextTurnId(sessionId: string): string { turnCounter += 1; return `${sessionId}-t${turnCounter}`; }

export interface DiceSessionDeps {
  db?: DB; // 省略则内存库(测试)
  agentFactory: AgentFactory; // 适配缝:据 AgentInit 产一个会话 agent(真=DiceGm,fake=FakeDiceGm)
  skills?: SkillRef[]; // 会话本地 staged skill(dice 默认 gm-core);省略=不 stage
  model?: string; // GM 模型覆盖
  importFrom?: { catalog: CatalogDB; tuanbenId: string; ref: string }; // 开局从 Catalog import 团本(信任闸门重验)→运行库
  baseline?: boolean; // eval baseline 对照:去 doctrine(buildBaselinePrompt) + 强制 skills 空,分离「教条有无」
}

// dice 跑团运行单元：db + in-process MCP(按实例注入 onCanonWrite/rollGate) + Agent + WsHub + turn-end hook。
export class DiceSession implements Session {
  readonly kind = "dice" as const;
  readonly db: DB;
  readonly hub = new WsHub();
  readonly gate: PlayerRollGate;
  readonly mcpServer: McpServer;
  constructor(public sessionId: string, private deps: DiceSessionDeps) {
    this.db = deps.db ?? (() => { const d = openDb(":memory:"); initSchema(d); return d; })();
    // 开局物化:从 Catalog import 选定团本版本(信任闸门重验)→ 本局运行库。仅空库时(避免重复 import)。
    if (deps.importFrom) {
      const empty = (this.db.prepare("SELECT COUNT(*) n FROM log").get() as { n: number }).n === 0;
      if (empty) {
        const { catalog, tuanbenId, ref } = deps.importFrom;
        const res = importPack(catalog, this.db, tuanbenId, ref);
        // 写 session_meta:团本关联 + prologue + 未开场。供 Play 列表/kickoff/开场prompt。
        metaSet(this.db, "tuanben_id", tuanbenId);
        metaSet(this.db, "ref", ref);
        if (res.tuanbenName) metaSet(this.db, "tuanben_name", res.tuanbenName);
        if (res.prologue) metaSet(this.db, "prologue", res.prologue);
        if (metaGet(this.db, "started") === undefined) metaSet(this.db, "started", "0");
      }
    }
    this.gate = new PlayerRollGate(this.db, this.hub, sessionId);
    this.mcpServer = createMcpServer(this.db, {
      onCanonWrite: (e) => this.onCanonWrite(e),
      rollGate: this.gate.gate,
    });
  }

  onCanonWrite(evt: CanonWriteEvent): void {
    const msg = mapCanonWrite(evt);
    if (msg) this.hub.broadcast(this.sessionId, msg);
  }

  attachWs(ws: WsLike): void { this.hub.add(this.sessionId, ws); }
  detachWs(ws: WsLike): void { this.hub.remove(this.sessionId, ws); }

  // 开场 prompt:baseline=纯 signpost+prologue(去教条);否则 signpost+教条+prologue。adapter 取它作 systemPrompt。
  get openingPrompt(): string {
    return this.deps.baseline ? buildBaselinePrompt(this.db) : buildOpeningPrompt(this.db);
  }

  // 据本会话状态组装 AgentInit(每回合新建一个 agent)。baseline 强制 skills 空(不 stage 教条)。
  private buildInit(): AgentInit {
    return { mcpServer: this.mcpServer, openingPrompt: this.openingPrompt, skills: this.deps.baseline ? [] : (this.deps.skills ?? []), model: this.deps.model };
  }

  async handleMessage(text: string): Promise<{ turnId: string }> {
    const turnId = nextTurnId(this.sessionId);
    const driver = this.deps.agentFactory(this.buildInit());
    await runTurn(
      { db: this.db, driver, hub: this.hub, sessionId: this.sessionId, turnId, runTurnEnd: (db) => this.turnEnd(db) },
      { text },
    );
    return { turnId };
  }

  // kickoff:「开始游戏」。未开场则以 prologue 为首轮 impetus 跑开场回合(无玩家输入)→ 流式开场叙事。幂等。
  async start(): Promise<{ started: boolean }> {
    if (metaGet(this.db, "started") === "1") return { started: false };
    const prologue = metaGet(this.db, "prologue") ?? "";
    const turnId = nextTurnId(this.sessionId);
    const driver = this.deps.agentFactory(this.buildInit());
    await runTurn(
      { db: this.db, driver, hub: this.hub, sessionId: this.sessionId, turnId, runTurnEnd: (db) => this.turnEnd(db) },
      { text: prologue || "[开始游戏]" },
    );
    metaSet(this.db, "started", "1");
    return { started: true };
  }

  handleRoll(eventId: number): boolean { return this.gate.resolveRoll(eventId); }

  private turnEnd(db: DB): TurnEndResult {
    runTurnEnd(db, { transcriptHasText: true, stopHookActive: false }); // 物化 choice + L3 审计
    const pc = buildPresentationModel(db, { turnStartSeq: 0 }).pendingChoice;
    if (!pc) return {};
    return {
      choices: { eventId: pc.seq, options: pc.options.map((o, index) => ({ index, label: o.label, consequence: o.consequence })) },
    };
  }
}
