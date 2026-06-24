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
    const msg = mapCanonWrite(this.enrich(evt));
    if (msg) this.hub.broadcast(this.sessionId, msg);
  }

  // 缝 A 出参贫信息补全：narrate / game_end 的工具出参不含展示所需内容(text / reason+outcome)，
  // 由会话从 store 按 seq / session_meta 取出注入 output,供 mapCanonWrite(纯映射器)消费。
  private enrich(evt: CanonWriteEvent): CanonWriteEvent {
    if (evt.kind === "event" && evt.toolName === "narrate") {
      const r = this.db.prepare("SELECT content FROM log WHERE seq=?").get(evt.seq) as { content: string | null } | undefined;
      return { ...evt, output: { ...(evt.output as object ?? {}), content: r?.content ?? "" } };
    }
    if (evt.kind === "game_end") {
      const raw = metaGet(this.db, "ended");
      const meta = raw ? (JSON.parse(raw) as { reason?: string; outcome?: string }) : {};
      return { ...evt, output: { ...(evt.output as object ?? {}), reason: meta.reason ?? "", outcome: meta.outcome ?? "" } };
    }
    return evt;
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

  // B1：玩家点选待选项的正式路径(接口页 §5「玩家选择捕获」)——
  // ① 据 eventId 读已物化 kind=choice event 的 options，取第 optionIndex 项；
  // ② 落一条「玩家所选」记录(kind=note·player_choice，供快照/历史复原)；
  // ③ 以所选 option 作下一回合 TurnInput(玩家视角的决定文本)——不伪装成 "[choice …]" 文本喂 handleMessage。
  async handleChoice(eventId: number, optionIndex: number): Promise<{ turnId: string }> {
    const row = this.db.prepare("SELECT data_json FROM log WHERE seq=? AND kind='choice'").get(eventId) as { data_json: string | null } | undefined;
    if (!row?.data_json) throw new Error(`handleChoice: 无此 choice event #${eventId}`);
    const parsed = JSON.parse(row.data_json) as { prompt?: string; options?: { label: string; consequence: string }[] };
    const opt = parsed.options?.[optionIndex];
    if (!opt) throw new Error(`handleChoice: choice #${eventId} 无 optionIndex=${optionIndex}`);
    // ② 落玩家所选记录(隐事件,不进玩家可见叙事；供重连/审计复原"玩家选了哪个")。
    this.db.prepare("INSERT INTO log (content, kind, data_json, visible) VALUES (?, 'note', ?, 0)")
      .run(opt.label, JSON.stringify({ player_choice: { eventId, optionIndex, label: opt.label, consequence: opt.consequence } }));
    // ③ 所选 option 作下一回合输入(玩家视角决定文本)。
    const turnId = nextTurnId(this.sessionId);
    const driver = this.deps.agentFactory(this.buildInit());
    await runTurn(
      { db: this.db, driver, hub: this.hub, sessionId: this.sessionId, turnId, runTurnEnd: (db) => this.turnEnd(db) },
      { text: opt.label },
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
