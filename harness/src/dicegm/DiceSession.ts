// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { createMcpServer, type CanonWriteEvent } from "./mcp/server.js";
import { runTurnEnd } from "./adapter/turnEnd.js";
import { getLogger } from "@dicelore/logs";
import type { DB, SessionBackend } from "@dicelore/interface";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WsHub, type WsLike } from "../runtime/wsHub.js";
import { PlayerRollGate } from "./rollGate.js";
import { mapCanonWrite } from "./notify.js";
import { runTurn, type TurnEndResult } from "./turnLoop.js";
import { buildOpeningPrompt, buildBaselinePrompt } from "./openingPrompt.js";
import type { AgentFactory, AgentInit, PluginRef, TurnUsage } from "../runtime/agent.js";
import type { Session } from "../runtime/session.js";
import { sessionDir, SessionTranscript } from "../runtime/transcript.js";
import { Rewind } from "../runtime/rewind.js";

let turnCounter = 0; // 进程内自增,测试稳定(不依赖随机/时间)
function nextTurnId(sessionId: string): string { turnCounter += 1; return `${sessionId}-t${turnCounter}`; }

// RT-2 会话级并发互斥：同会话已有回合在跑时，并发的 handleMessage/handleChoice/start 抛此错误。
// 双击/重发/WS 重连+REST 同时触发不再双开回合（GM 上下文 + DB 写竞态）。API 层映射 409 turn_in_progress。
export class TurnInProgressError extends Error {
  readonly code = "turn_in_progress" as const;
  constructor(sessionId: string) {
    super(`会话 ${sessionId} 已有回合在进行中，拒绝并发回合`);
    this.name = "TurnInProgressError";
  }
}

export interface DiceSessionDeps {
  db: DB; // 组合根注入(backend 侧 openSession→openDb);harness 不自开库(storage-port ADR §4)
  backend: SessionBackend; // 组合根注入(openSessionBackend(db));所有存储读写经它,不直连 backend 自由函数
  agentFactory: AgentFactory; // 适配缝:据 AgentInit 产一个会话 agent(真=DiceGm,fake=FakeDiceGm)
  plugin?: PluginRef; // skill plugin 引用(dice 默认 gm-core+flows,boot 期物化到 $/dice);省略=不启 skill
  model?: string; // GM 模型覆盖
  importFrom?: { catalog: DB; adventureId: string; ref: string }; // 开局从 Catalog import 团本(信任闸门重验)→运行库
  baseline?: boolean; // eval baseline 对照:去教条(buildBaselinePrompt) + 强制 plugin 空,分离「教条有无」
  debug?: boolean; // eval/裸 CC 明骰降级:不注入 rollGate,core outcomeOpenHandler 走「无 gate 立即掷」分支(否则 await 永不来的 POST /roll 卡死)
  sessionsDir?: string; // GM raw 日志根目录(日志落 <dir>/dicelore/sessions/<sessionId>.gm.log);省略=不记日志
}

// dice 跑团运行单元：注入的 db+backend + in-process MCP(按实例注入 onCanonWrite/rollGate) + Agent + WsHub + turn-end hook。
export class DiceSession implements Session {
  readonly kind = "dice" as const;
  readonly db: DB;
  /** 注入的会话存储端口(db 已绑定)——所有存储读写经它,不直连 backend 自由函数(storage-port ADR §4)。 */
  readonly backend: SessionBackend;
  readonly hub = new WsHub();
  readonly gate?: PlayerRollGate;
  readonly mcpServer: McpServer;
  private inflight = false; // RT-2：本会话是否已有回合在跑（并发互斥标记）
  constructor(public sessionId: string, private deps: DiceSessionDeps) {
    this.db = deps.db; // 组合根注入,不自开库(harness 零 import backend 开库函数)
    this.backend = deps.backend; // 组合根注入的存储端口实例(openSessionBackend(db))
    // 开局物化:从 Catalog import 选定团本版本(信任闸门重验)→ 本局运行库。仅空库时(避免重复 import)。
    // 团本声明的自定义工具(tools/*.json → toolgen 编译)。首次 import 时由 importPack 回传,
    // 经下面 createMcpServer 的 extraTools 装载进本 session 的 MCP(守 DT-9:作者只能声明式 SQL 工具)。
    // ⚠️ v1 仅首次 import(db 空)装载;重开已存在 session 不重载团本工具(catalog 此时不在场)——
    // 持久化/重开重载留 follow-up(见 backlog 主题A′)。
    let extraTools: Parameters<typeof createMcpServer>[3] = [];
    if (deps.importFrom) {
      const empty = (this.db.prepare("SELECT COUNT(*) n FROM log").get() as { n: number }).n === 0;
      if (empty) {
        const { catalog, adventureId, ref } = deps.importFrom;
        const res = this.backend.importPack(catalog, adventureId, ref);
        extraTools = res.toolDefs;
        // 写 session_meta:团本关联 + prologue + 未开场。供 Play 列表/kickoff/开场prompt。
        this.backend.metaSet("adventure_id", adventureId);
        this.backend.metaSet("ref", ref);
        if (res.adventureName) this.backend.metaSet("adventure_name", res.adventureName);
        if (res.prologue) this.backend.metaSet("prologue", res.prologue);
        if (this.backend.metaGet("started") === undefined) this.backend.metaSet("started", "0");
        getLogger().info({ sessionId, adventureId, ref, adventureName: res.adventureName, extraTools: extraTools.length }, "会话开局:import 团本→运行库");
      }
    }
    // debug 模式不建 gate:core outcomeOpenHandler 的 `if(gate) await gate` 走 false 分支立即掷(降级),
    // 避免裸 CC/eval 下 await 一个永不来的 POST /roll 卡死整回合。生产(有前端)默认建 gate 等玩家掷。
    if (!deps.debug) {
      this.gate = new PlayerRollGate(this.backend, this.hub, sessionId);
    }
    this.mcpServer = createMcpServer(this.backend, this.db, {
      onCanonWrite: (e) => this.onCanonWrite(e),
      ...(this.gate ? { rollGate: this.gate.gate } : {}),
    }, extraTools);
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
      const raw = this.backend.metaGet("ended");
      const meta = raw ? (JSON.parse(raw) as { reason?: string; outcome?: string }) : {};
      return { ...evt, output: { ...(evt.output as object ?? {}), reason: meta.reason ?? "", outcome: meta.outcome ?? "" } };
    }
    return evt;
  }

  attachWs(ws: WsLike): void { this.hub.add(this.sessionId, ws); }
  detachWs(ws: WsLike): void { this.hub.remove(this.sessionId, ws); }

  // 开场 prompt:baseline=纯 signpost+prologue(去教条);否则 signpost+教条+prologue。adapter 取它作 systemPrompt。
  get openingPrompt(): string {
    return this.deps.baseline ? buildBaselinePrompt(this.backend) : buildOpeningPrompt(this.backend);
  }

  // 据本会话状态组装 AgentInit(每回合新建一个 agent)。baseline 强制 plugin 空(不加载 gm-core 教条 skill)。
  // gm-session-continuity:一个团本一个 SDK session——从 meta 取 sdk_session_id 注入 resume:
  //   首回合(meta 无值)→ resume=undefined → buildQueryOptions 省略 → SDK 开新 session;
  //   后续回合(meta 有值)→ resume=<sdk_session_id> → SDK 按此 id 加载该 session 完整 LLM 历史续接。
  // 重开一团(新 DiceSession/新库)不带旧 id → 开新 session(C3);跨 DiceGm 实例 resume 靠 SDK 自持久化 transcript。
  private buildInit(): AgentInit {
    return { mcpServer: this.mcpServer, openingPrompt: this.openingPrompt, plugin: this.deps.baseline ? undefined : this.deps.plugin, model: this.deps.model, resume: this.backend.metaGet("sdk_session_id"), sessionId: this.sessionId, sessionsDir: this.deps.sessionsDir };
  }

  // gm-session-continuity:DiceGm 从 SDK system init 取 session_id 上抛(sdk_session 事件)→ 这里存库,
  // 下回合 buildInit 读它注入 resume 续接。幂等(续接不换 id,存同值无害);带外旁路,失败只记日志不阻断回合。
  private onSdkSession(id: string): void {
    try {
      this.backend.metaSet("sdk_session_id", id);
    } catch (e) {
      getLogger().error({ err: e, sessionId: this.sessionId }, "存 sdk_session_id 失败(不阻断回合)");
    }
  }

  // RT-2：串行化所有「跑回合」入口。已有回合在跑则抛 TurnInProgressError（拒绝并发、不双开），
  // finally 释放——即使回合内抛错也不会卡死后续回合。检查在任何 DB 读/写之前（最外层守门）。
  private async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inflight) throw new TurnInProgressError(this.sessionId);
    this.inflight = true;
    try {
      return await fn();
    } finally {
      this.inflight = false;
    }
  }

  // agent 上抛的 token 用量经端口落库(per-turn + per-agent 双采,agent='gm')。
  // DiceGm 只 parseUsage 上抛 usage 事件,不碰存储;此处经注入 backend.recordUsage 落同一会话库
  // (storage-port:harness 不自开短连接、不直 import recordUsage)。计量是带外旁路,失败只记日志不阻断回合。
  private onUsage(turnId: string, usage: TurnUsage, model?: string): void {
    try {
      this.backend.recordUsage({ sessionId: this.sessionId, turnId, agent: "gm", model, ...usage });
    } catch (e) {
      getLogger().error({ err: e, turnId }, "采集 usage 落库失败(不阻断回合)");
    }
  }

  async handleMessage(text: string): Promise<{ turnId: string }> {
    return this.runExclusive(async () => {
      const turnId = nextTurnId(this.sessionId);
      const driver = this.deps.agentFactory(this.buildInit());
      getLogger().info({ sessionId: this.sessionId, turnId, kind: "message" }, "回合开始(玩家发言)");
      try {
        await runTurn(
          { db: this.db, driver, hub: this.hub, sessionId: this.sessionId, turnId, runTurnEnd: (db) => this.turnEnd(db), onUsage: (u, m) => this.onUsage(turnId, u, m), onSdkSession: (id) => this.onSdkSession(id) },
          { text },
        );
      } catch (e) {
        getLogger().error({ sessionId: this.sessionId, turnId, kind: "message", err: e }, "回合异常(玩家发言)");
        throw e;
      }
      getLogger().info({ sessionId: this.sessionId, turnId, kind: "message" }, "回合结束(玩家发言)");
      return { turnId };
    });
  }

  // B1：玩家点选待选项的正式路径(接口页 §5「玩家选择捕获」)——
  // ① 据 eventId 读已物化 kind=choice event 的 options，取第 optionIndex 项；
  // ② 落一条「玩家所选」记录(kind=note·player_choice，供快照/历史复原)；
  // ③ 以所选 option 作下一回合 TurnInput(玩家视角的决定文本)——不伪装成 "[choice …]" 文本喂 handleMessage。
  async handleChoice(eventId: number, optionIndex: number): Promise<{ turnId: string }> {
    return this.runExclusive(async () => {
      const row = this.db.prepare("SELECT data_json FROM log WHERE seq=? AND kind='choice'").get(eventId) as { data_json: string | null } | undefined;
      if (!row?.data_json) {
        // 客户端误请求(无此 choice event)——上层 API 映射 409 no_pending_choice 并 warn;此处 debug 记明确失败模式,避免双 warn。
        getLogger().debug({ sessionId: this.sessionId, eventId }, "handleChoice: 无此 choice event");
        throw new Error(`handleChoice: 无此 choice event #${eventId}`);
      }
      const parsed = JSON.parse(row.data_json) as { prompt?: string; options?: { label: string; consequence: string }[] };
      const opt = parsed.options?.[optionIndex];
      if (!opt) {
        getLogger().debug({ sessionId: this.sessionId, eventId, optionIndex }, "handleChoice: choice 无此 optionIndex");
        throw new Error(`handleChoice: choice #${eventId} 无 optionIndex=${optionIndex}`);
      }
      // ② 落玩家所选记录(隐事件,不进玩家可见叙事；供重连/审计复原"玩家选了哪个")。
      this.db.prepare("INSERT INTO log (content, kind, data_json, visible) VALUES (?, 'note', ?, 0)")
        .run(opt.label, JSON.stringify({ player_choice: { eventId, optionIndex, label: opt.label, consequence: opt.consequence } }));
      // ③ 所选 option 作下一回合输入(玩家视角决定文本)。
      const turnId = nextTurnId(this.sessionId);
      const driver = this.deps.agentFactory(this.buildInit());
      getLogger().info({ sessionId: this.sessionId, turnId, kind: "choice", eventId, optionIndex }, "回合开始(玩家选择)");
      try {
        await runTurn(
          { db: this.db, driver, hub: this.hub, sessionId: this.sessionId, turnId, runTurnEnd: (db) => this.turnEnd(db), onUsage: (u, m) => this.onUsage(turnId, u, m), onSdkSession: (id) => this.onSdkSession(id) },
          { text: opt.label },
        );
      } catch (e) {
        getLogger().error({ sessionId: this.sessionId, turnId, kind: "choice", err: e }, "回合异常(玩家选择)");
        throw e;
      }
      getLogger().info({ sessionId: this.sessionId, turnId, kind: "choice" }, "回合结束(玩家选择)");
      return { turnId };
    });
  }

  // kickoff:「开始游戏」。未开场则以 prologue 为首轮 impetus 跑开场回合(无玩家输入)→ 流式开场叙事。幂等。
  // 缝B 契约统一(FE-start-contract):返回 { turnId }——开局即首回合,turnId 是开局回合标识。
  // 幂等再调:已开场则不重跑,回上次落库的开场 turnId(拿到 turnId 即已开局,无需 started 字段)。
  async start(): Promise<{ turnId: string }> {
    return this.runExclusive(async () => {
      const prior = this.backend.metaGet("kickoff_turn");
      if (this.backend.metaGet("started") === "1") {
        getLogger().info({ sessionId: this.sessionId, turnId: prior ?? this.sessionId }, "kickoff 幂等:已开场,返回既有开场 turnId");
        return { turnId: prior ?? this.sessionId };
      }
      const prologue = this.backend.metaGet("prologue") ?? "";
      const turnId = nextTurnId(this.sessionId);
      const driver = this.deps.agentFactory(this.buildInit());
      getLogger().info({ sessionId: this.sessionId, turnId, kind: "kickoff" }, "回合开始(开场)");
      try {
        await runTurn(
          { db: this.db, driver, hub: this.hub, sessionId: this.sessionId, turnId, runTurnEnd: (db) => this.turnEnd(db), onUsage: (u, m) => this.onUsage(turnId, u, m), onSdkSession: (id) => this.onSdkSession(id) },
          { text: prologue || "[开始游戏]" },
        );
      } catch (e) {
        getLogger().error({ sessionId: this.sessionId, turnId, kind: "kickoff", err: e }, "回合异常(开场)");
        throw e;
      }
      this.backend.metaSet("started", "1");
      this.backend.metaSet("kickoff_turn", turnId);
      getLogger().info({ sessionId: this.sessionId, turnId, kind: "kickoff" }, "回合结束(开场)");
      return { turnId };
    });
  }

  handleRoll(eventId: number): boolean { return this.gate?.resolveRoll(eventId) ?? false; }

  // TR3：为本会话开一个 transcript 视图（文件态，backend-free）。sessionsDir 缺省（lore/测试）→ undefined。
  // 每次新建（recoverHead 读盘）以看到 DiceGm 本回合刚落的 HEAD——不缓存陈旧 _head。
  private openTranscript(): SessionTranscript | undefined {
    const dir = this.deps.sessionsDir;
    if (!dir) return undefined;
    return new SessionTranscript({ sessionDir: sessionDir(dir, this.kind, this.sessionId), sessionId: this.sessionId });
  }

  // SNAP-1 读档（ADR-0017 v1：自动恢复最近一份快照，非手动回滚/branch）。
  // 无快照（开局未跑过一回合）→ 返回 false，API 层映射 409；有则整体覆写 sheet/world/watcher 域并返回快照 id。
  // 串行进 runExclusive：restore 整表覆写与回合写 DB 不能并发（同 handleMessage 的并发互斥）。
  async rewind(): Promise<{ snapshotId: number } | null> {
    return this.runExclusive(async () => {
      const snap = this.backend.latestSnapshot();
      if (!snap) {
        getLogger().warn({ sessionId: this.sessionId }, "rewind:库内无快照(未跑过回合),返回 null");
        return null;
      }
      this.backend.restore(snap.id);
      getLogger().info({ sessionId: this.sessionId, snapshotId: snap.id }, "rewind:已恢复最近快照");
      return { snapshotId: snap.id };
    });
  }

  // TR3：回退到指定 transcript 节点 uuid（权威方向 transcript 先铸、db 后锤）。
  // 为本会话建 Rewind(transcript) 并注册 dice-db RollbackHook（rollbackTo → restoreToAnchor(db,uuid)），
  // 经 rewind.rewindTo：① uuid 不在树内 → 抛错；② dice-db 复位领域态（无锤则抛 no_snapshot_for_anchor，
  // HEAD 不动）；③ 全成功后移 transcript HEAD。串行进 runExclusive（restore 覆写与回合写 DB 不并发）。
  async rewindTo(uuid: string): Promise<{ uuid: string }> {
    return this.runExclusive(async () => {
      const transcript = this.openTranscript();
      if (!transcript) throw new Error("no_transcript"); // 无 sessionsDir：本会话无 transcript，无法按 uuid 回退
      const rewind = new Rewind(transcript);
      rewind.register({ name: "dice-db", rollbackTo: ({ uuid }) => this.backend.restoreToAnchor(uuid) });
      rewind.rewindTo(uuid);
      getLogger().info({ sessionId: this.sessionId, uuid }, "rewindTo:已按 transcript uuid 回退(领域态+HEAD)");
      return { uuid };
    });
  }

  private turnEnd(_db: DB): TurnEndResult {
    runTurnEnd(this.backend, { transcriptHasText: true, stopHookActive: false }); // 物化 choice + L3 审计
    // SNAP-1：回合边界自动落一份全量快照（存档语义）。turnSeq = 当前最大 log seq（对齐 narrativeCursor 口径）。
    // 在 runTurnEnd 后取——choice 物化等回合末写已落库，快照覆盖完整回合态。
    // TR3：anchorUuid = 本回合末 transcript HEAD（DiceGm 已落 turn/msg 行、HEAD 前进）——transcript 先铸、db 后锤。
    // 无 transcript（无 sessionsDir/测试）→ undefined → transcript_anchor 列 NULL（向后兼容 seq-based 路径）。
    const maxSeq = (this.db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number | null }).s ?? 0;
    const anchorUuid = this.openTranscript()?.head() ?? undefined;
    this.backend.checkpoint({ turnSeq: maxSeq, anchorUuid });
    const pc = this.backend.buildPresentationModel({ turnStartSeq: 0 }).pendingChoice;
    if (!pc) return {};
    return {
      choices: { eventId: pc.seq, options: pc.options.map((o, index) => ({ index, label: o.label, consequence: o.consequence })) },
    };
  }
}
