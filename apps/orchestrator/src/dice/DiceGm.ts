// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Agent, TurnInput, TurnEvent, AgentInit } from "../pkg/agent.js";
import { stageSkills, cleanupSkills } from "./skillStage.js";
import { appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

let stageSeq = 0; // staged 目录命名,避免并发回合碰撞(不依赖随机/时间)

// 真 GM 驱动：@anthropic-ai/claude-agent-sdk query()，in-process 挂 dicelore MCP。
// 鉴权沿用 env ANTHROPIC_BASE_URL/ANTHROPIC_AUTH_TOKEN(SDK 原生读)。不进单测(烧 LLM)。
// CC SDK 适配器 = Agent 适配缝(AgentInit→Agent)的首个实现。
//
// GM raw 日志(可观测性):AgentInit 带 sessionId+sessionsDir 时,把每回合的全部 raw 落
// <sessionsDir>/dicelore/sessions/<sessionId>.gm.log——含玩家输入、staged skill、opts、
// systemPrompt(openingPrompt)、以及 SDK 流出的每条消息(assistant 正文 text / tool_use 名+入参 /
// tool_result / result 用量)。A1 后 DiceGm 不再消费 assistant text 当 narration(只取 result 结束),
// 故这些 raw 仅进日志、不进玩家所见。日志写失败不影响回合。
export class DiceGm implements Agent {
  constructor(private init: AgentInit) {}

  private get logPath(): string | undefined {
    const { sessionId, sessionsDir } = this.init;
    if (!sessionId || !sessionsDir) return undefined;
    return join(sessionsDir, "dicelore", "sessions", `${sessionId}.gm.log`);
  }

  private logReady = false;
  private log(line: string): void {
    const p = this.logPath;
    if (!p) return;
    try {
      if (!this.logReady) { mkdirSync(dirname(p), { recursive: true }); this.logReady = true; }
      appendFileSync(p, line + "\n");
    } catch { /* 日志失败不影响回合 */ }
  }

  // 把 SDK 流出的单条消息结构化记一行(未知形状兜底 JSON.stringify,保 raw 不丢)。
  private logMsg(idx: number, msg: unknown): void {
    const m = msg as { type?: string; message?: { content?: unknown[] }; content?: unknown[]; subtype?: string; duration_ms?: number; usage?: unknown; result?: string };
    const type = m.type ?? "unknown";
    const tag = `[msg#${idx} ${type}]`;
    if (type === "assistant") {
      const blocks = m.message?.content ?? [];
      if (blocks.length === 0) this.log(`${tag} (empty)`);
      for (const b of blocks) {
        const blk = b as { type?: string; text?: string; name?: string; input?: unknown };
        if (blk.type === "text") this.log(`${tag} text: ${blk.text ?? ""}`);
        else if (blk.type === "tool_use") this.log(`${tag} tool_use: ${blk.name} input=${JSON.stringify(blk.input)}`);
        else this.log(`${tag} ${blk.type ?? "?"}: ${JSON.stringify(blk)}`);
      }
    } else if (type === "user") {
      const blocks = m.message?.content ?? m.content ?? [];
      if (blocks.length === 0) this.log(`${tag} (empty)`);
      for (const b of blocks) {
        const blk = b as { type?: string; content?: unknown };
        if (blk.type === "tool_result") this.log(`${tag} tool_result: ${typeof blk.content === "string" ? blk.content : JSON.stringify(blk.content)}`);
        else this.log(`${tag} ${blk.type ?? "?"}: ${JSON.stringify(blk)}`);
      }
    } else if (type === "result") {
      this.log(`${tag} subtype=${m.subtype ?? "?"} duration_ms=${m.duration_ms ?? "?"} usage=${JSON.stringify(m.usage ?? {})}`);
      if (m.result) this.log(`${tag} result_text: ${m.result}`);
    } else {
      this.log(`${tag} ${JSON.stringify(msg)}`);
    }
  }

  async *runTurn(input: TurnInput): AsyncIterable<TurnEvent> {
    const model = this.init.model ?? process.env.DICELORE_GM_MODEL ?? "glm-5.2";
    // skill 非空 → stage 会话本地副本,以该 cwd 起 agent 可加载 skill 供自助查阅(渐进披露);
    // 空 → 沿 ADR-0020 settingSources:[](不读本地 .claude)。教条已内联进 openingPrompt 作兜底,
    // staged skill 额外提供 references/ 等深层内容供 GM 按需 Read。
    const staged = this.init.skills.length > 0 ? stageSkills(`dg-${++stageSeq}`, this.init.skills) : undefined;
    const turnId = input.turnId ?? "?";
    const iso = () => new Date().toISOString();
    this.log(`\n===== ${iso()} TURN ${turnId} start | session=${this.init.sessionId ?? "?"} | model=${model} =====`);
    this.log(`[input] ${input.text}`);
    this.log(`[skills] ${this.init.skills.length ? this.init.skills.map((s) => `${s.name}<-${s.srcDir}`).join(", ") : "(none)"}`);
    this.log(`[opts] settingSources=${staged ? "project" : "[]"} allowedTools=${staged ? "mcp__dicelore,Skill,Read" : "mcp__dicelore"}`);
    this.log(`[system] ${this.init.openingPrompt}`);
    // GM 回合超时兜底:防真 LLM 卡死拖垮 eval/联调。默认 3min,DICELORE_GM_TIMEOUT_MS 可覆盖。
    // abort 触发后 SDK 停 query(抛 AbortError 或以 result 结束)→ catch 转 error 事件,回合脱困不卡死。
    const timeoutMs = Number(process.env.DICELORE_GM_TIMEOUT_MS ?? 180_000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`GM turn timeout (${timeoutMs / 1000}s)`)), timeoutMs);
    try {
      const options = {
        model,
        settingSources: staged ? ["project"] : [], // staged 时读副本 cwd 的 .claude;否则不读本地
        ...(staged ? { cwd: staged } : {}),
        mcpServers: { dicelore: { type: "sdk", name: "dicelore", instance: this.init.mcpServer } },
        systemPrompt: this.init.openingPrompt,
        allowedTools: staged ? ["mcp__dicelore", "Skill", "Read"] : ["mcp__dicelore"],
        abortController: controller,
      } as Parameters<typeof query>[0]["options"];

      let msgIdx = 0;
      for await (const msg of query({ prompt: input.text, options })) {
        msgIdx += 1;
        this.logMsg(msgIdx, msg);
        // A1：assistant text(流③ GM 思考/口白)不当 narration —— 叙事单源走 narrate MCP event
        // → onCanonWrite → mapCanonWrite → narration_commit(接口页 §5.1/§10.1 A1)。
        // 这里只消费流到 result 为止取回合结束信号,不再 yield narration(避免 GM 思考泄漏进 narrate)。
        if (msg.type === "result") {
          break; // 回合结束
        }
      }
      yield { type: "turn_end" };
      this.log(`===== ${iso()} TURN ${turnId} end | msgs=${msgIdx} =====`);
    } catch (e) {
      // 超时 abort 优先按超时报(更可读);否则原样抛错信息。
      const message = controller.signal.aborted
        ? `GM 回合超时(${timeoutMs / 1000}s)中止,已脱困`
        : (e instanceof Error ? e.message : String(e));
      this.log(`[ERROR] ${message}`);
      yield { type: "error", message };
    } finally {
      clearTimeout(timer);
      if (staged) cleanupSkills(staged);
    }
  }
}
