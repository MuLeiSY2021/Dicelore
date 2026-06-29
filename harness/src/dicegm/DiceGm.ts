// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Logger } from "pino";
import type { Agent, TurnInput, TurnEvent, AgentInit } from "../runtime/agent.js";
import { stageSkills, cleanupSkills } from "./skillStage.js";
import { buildQueryOptions } from "./gmAssembly.js";
import { getLogger, createFileLogger } from "@dicelore/logs";
import { appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

let stageSeq = 0; // staged 目录命名,避免并发回合碰撞(不依赖随机/时间)

// CO-采集:Agent SDK result.usage 字段名 → UsageInput 数字字段（纯函数,可 offline 单测）。
// SDK NonNullableUsage 形:{input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, …}。
// 缺省/非数字一律归零(SDK 偶尔不回 cache 维度);返回 token 计数子集,归因标签(turn/session/agent)由调用点补。
export interface ParsedUsage {
  inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number;
}
export function parseUsage(usage: unknown): ParsedUsage {
  const u = (usage ?? {}) as Record<string, unknown>;
  const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    inputTokens: n(u.input_tokens),
    outputTokens: n(u.output_tokens),
    cacheReadTokens: n(u.cache_read_input_tokens),
    cacheCreationTokens: n(u.cache_creation_input_tokens),
  };
}

// 真 GM 驱动：@anthropic-ai/claude-agent-sdk query()，in-process 挂 dicelore MCP。
// 鉴权沿用 env ANTHROPIC_BASE_URL/ANTHROPIC_AUTH_TOKEN(SDK 原生读)。不进单测(烧 LLM)。
// CC SDK 适配器 = Agent 适配缝(AgentInit→Agent)的首个实现。
//
// 可观测性双轨(均落 session 自包含文件夹 <sessionsDir>/dice/sessions/<sessionId>/):
//   · <sessionId>_session.jsonl = 对话记录(业务数据,CC transcript 风格,随文件夹迁移)
//   · {error,warn,info,debug}.log = 该 session 回合日志(pino 分级,调试用)
// 含玩家输入、staged skill、opts、systemPrompt、SDK 流出的每条消息(assistant text / tool_use / tool_result / result)。
// A1 后 DiceGm 不再消费 assistant text 当 narration(只取 result 结束),故这些 raw 仅进日志、不进玩家所见。
export class DiceGm implements Agent {
  private readonly sessionLogger: Logger;
  constructor(private init: AgentInit) {
    const d = this.sessionDir;
    this.sessionLogger = d ? createFileLogger(d) : getLogger(); // 无 sessionDir(lore/测试)退化为全局
  }

  // session 自包含文件夹:<sessionsDir>/dice/sessions/<sessionId>/{session.db, <sessionId>_session.jsonl, *.log}
  private get sessionDir(): string | undefined {
    const { sessionId, sessionsDir } = this.init;
    if (!sessionId || !sessionsDir) return undefined;
    return join(sessionsDir, "dice", "sessions", sessionId);
  }
  private get conversationPath(): string | undefined {
    const d = this.sessionDir;
    return d ? join(d, `${this.init.sessionId}_session.jsonl`) : undefined;
  }

  private logReady = false;
  private curTurnId = "?";

  // 对话记录:每行一 JSON 事件(turn/msg/turn_end/error/stage_error),CC transcript 风格,可回放/迁移。
  private appendConversation(obj: unknown): void {
    const p = this.conversationPath;
    if (!p) return;
    try {
      if (!this.logReady) { mkdirSync(dirname(p), { recursive: true }); this.logReady = true; }
      appendFileSync(p, JSON.stringify(obj) + "\n");
    } catch (e) { getLogger().error({ err: e }, "写 _session.jsonl 失败"); }
  }

  // SDK 单条消息:对话记录落原始结构,回合日志落可读摘要(result 用 info,余 debug)。
  private logMsg(idx: number, msg: unknown): void {
    const m = msg as { type?: string; subtype?: string; model?: string; session_id?: string; cwd?: string; message?: { content?: unknown[] }; content?: unknown[]; duration_ms?: number; usage?: unknown; result?: string };
    const type = m.type ?? "unknown";
    // thinking_tokens 逐 delta 是 SDK 流式 token 计数噪音(每 token 一条,单回合数千行刷屏 debug.log),
    // 无业务价值,完全跳过(不落 jsonl 对话记录、不落 debug.log)。
    if (type === "system" && m.subtype === "thinking_tokens") return;
    // system init 含巨量环境元数据(tools/slash_commands/agents/plugins 清单)——业务对话记录只留身份字段,砍掉几十KB噪音
    const body = (type === "system" && m.subtype === "init")
      ? { type, subtype: m.subtype, model: m.model, session_id: m.session_id, cwd: m.cwd }
      : m;
    this.appendConversation({ _: "msg", turnId: this.curTurnId, idx, ...body });
    const tag = `[msg#${idx} ${type}]`;
    if (type === "assistant") {
      const blocks = m.message?.content ?? [];
      if (blocks.length === 0) this.sessionLogger.debug({ idx, type }, `${tag} (empty)`);
      for (const b of blocks) {
        const blk = b as { type?: string; text?: string; name?: string; input?: unknown };
        if (blk.type === "text") this.sessionLogger.debug({ idx, kind: "text", text: blk.text ?? "" }, `${tag} text`);
        else if (blk.type === "tool_use") this.sessionLogger.debug({ idx, kind: "tool_use", name: blk.name, input: blk.input }, `${tag} tool_use`);
        else this.sessionLogger.debug({ idx, block: blk }, `${tag} ${blk.type ?? "?"}`);
      }
    } else if (type === "user") {
      const blocks = m.message?.content ?? m.content ?? [];
      if (blocks.length === 0) this.sessionLogger.debug({ idx, type }, `${tag} (empty)`);
      for (const b of blocks) {
        const blk = b as { type?: string; content?: unknown };
        if (blk.type === "tool_result") this.sessionLogger.debug({ idx, kind: "tool_result", content: blk.content }, `${tag} tool_result`);
        else this.sessionLogger.debug({ idx, block: blk }, `${tag} ${blk.type ?? "?"}`);
      }
    } else if (type === "result") {
      this.sessionLogger.info({ idx, subtype: m.subtype, duration_ms: m.duration_ms, usage: m.usage, result: m.result }, `${tag} result`);
    } else {
      this.sessionLogger.debug({ idx, msg: m }, `${tag} ${type}`);
    }
  }

  async *runTurn(input: TurnInput): AsyncIterable<TurnEvent> {
    const model = this.init.model ?? process.env.DICELORE_GM_MODEL ?? "glm-5.2";
    const turnId = input.turnId ?? "?";
    this.curTurnId = turnId;
    const ts = new Date().toISOString();
    const skillsMeta = this.init.skills.length ? this.init.skills.map((s) => `${s.name}<-${s.srcDir}`) : [];

    // ① 先落回合头(诊断价值最大)——在 stageSkills 之前,即使 stage 抛错也留痕。
    //    此前 stageSkills 在 log 头之前且无 try,抛错会吞掉全部日志 + 回合静默失败(日志不生成的根因)。
    this.sessionLogger.info({ turnId, session: this.init.sessionId ?? "?", model, input: input.text, skills: skillsMeta, ts }, `TURN ${turnId} start`);
    this.appendConversation({ _: "turn", turnId, sessionId: this.init.sessionId ?? null, model, input: input.text, skills: skillsMeta, ts });

    // ② stageSkills 包 try:失败降级 staged=undefined(走内联 doctrine),不阻断回合。
    //    skill 非空 → stage 会话本地副本,以该 cwd 起 agent 可加载 skill 供自助查阅(渐进披露);
    //    空 → 沿 ADR-0020 settingSources:[](不读本地 .claude)。教条已内联进 openingPrompt 作兜底。
    let staged: string | undefined;
    if (this.init.skills.length > 0) {
      try {
        staged = stageSkills(`dg-${++stageSeq}`, this.init.skills);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.sessionLogger.error({ err: e, turnId }, "stageSkills 失败,降级走内联 doctrine");
        this.appendConversation({ _: "stage_error", turnId, message: msg });
        staged = undefined;
      }
    }
    this.sessionLogger.info({ turnId, settingSources: staged ? "project" : "[]", allowedTools: staged ? "mcp__dicelore,Skill,Read" : "mcp__dicelore" }, "turn opts");
    this.sessionLogger.debug({ turnId, system: this.init.openingPrompt }, "[system]");
    // ③ 超时兜底:防真 LLM 卡死拖垮 eval/联调。默认 3min,DICELORE_GM_TIMEOUT_MS 可覆盖。
    // abort 触发后 SDK 停 query(抛 AbortError 或以 result 结束)→ catch 转 error 事件,回合脱困不卡死。
    const timeoutMs = Number(process.env.DICELORE_GM_TIMEOUT_MS ?? 180_000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`GM turn timeout (${timeoutMs / 1000}s)`)), timeoutMs);
    try {
      // SDK options 装配抽成纯函数(gmAssembly.buildQueryOptions),offline 可跑装配断言(TB-2)。
      // 这里仅把结构化结果 as 成 SDK 复杂签名 + 调 query()/消费消息流(副作用部分留 runTurn)。
      const options = buildQueryOptions({
        model,
        mcpServer: this.init.mcpServer,
        openingPrompt: this.init.openingPrompt,
        staged,
        abortController: controller,
      }) as unknown as Parameters<typeof query>[0]["options"];

      let msgIdx = 0;
      for await (const msg of query({ prompt: input.text, options })) {
        msgIdx += 1;
        this.logMsg(msgIdx, msg);
        // A1：assistant text(流③ GM 思考/口白)不当 narration —— 叙事单源走 narrate MCP event
        // → onCanonWrite → mapCanonWrite → narration_commit(接口页 §5.1/§10.1 A1)。
        // 这里只消费流到 result 为止取回合结束信号,不再 yield narration(避免 GM 思考泄漏进 narrate)。
        if (msg.type === "result") {
          // CO-采集:result 含本回合 usage(input/output/cache token)——上抛 usage 事件,
          // 由会话经注入的 SessionBackend.recordUsage 落库(DiceGm 不碰存储;storage-port:agent 存储无关)。
          const parsed = parseUsage((msg as { usage?: unknown }).usage);
          yield { type: "usage", usage: parsed, model };
          break; // 回合结束
        }
      }
      yield { type: "turn_end" };
      this.sessionLogger.info({ turnId, msgs: msgIdx }, `TURN ${turnId} end`);
      this.appendConversation({ _: "turn_end", turnId, msgs: msgIdx });
    } catch (e) {
      // 超时 abort 优先按超时报(更可读 + 可区分 code=gm_timeout,让前端识别「超时·可重试」);否则原样抛错信息。
      const isTimeout = controller.signal.aborted;
      const message = isTimeout
        ? `GM 回合超时(${timeoutMs / 1000}s)中止,已脱困`
        : (e instanceof Error ? e.message : String(e));
      this.sessionLogger.error({ err: e, turnId, aborted: isTimeout }, "GM runTurn 异常");
      this.appendConversation({ _: "error", turnId, message, code: isTimeout ? "gm_timeout" : undefined });
      yield { type: "error", message, code: isTimeout ? "gm_timeout" : undefined };
    } finally {
      clearTimeout(timer);
      if (staged) cleanupSkills(staged);
    }
  }
}
