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
import { stripReasoning } from "../pkg/reasoning.js";
import { stageSkills, cleanupSkills } from "./skillStage.js";

let stageSeq = 0; // staged 目录命名,避免并发回合碰撞(不依赖随机/时间)

// 真 GM 驱动：@anthropic-ai/claude-agent-sdk query()，in-process 挂 dicelore MCP。
// 鉴权沿用 env ANTHROPIC_BASE_URL/ANTHROPIC_AUTH_TOKEN(SDK 原生读)。不进单测(烧 LLM)。
// CC SDK 适配器 = Agent 适配缝(AgentInit→Agent)的首个实现。
export class DiceGm implements Agent {
  constructor(private init: AgentInit) {}

  async *runTurn(input: TurnInput): AsyncIterable<TurnEvent> {
    const model = this.init.model ?? process.env.DICELORE_GM_MODEL ?? "opus";
    // skill 非空 → stage 会话本地副本,以该 cwd 起 agent 可加载 skill 供自助查阅(渐进披露);
    // 空 → 沿 ADR-0020 settingSources:[](不读本地 .claude)。教条已内联进 openingPrompt 作兜底,
    // staged skill 额外提供 references/ 等深层内容供 GM 按需 Read。
    const staged = this.init.skills.length > 0 ? stageSkills(`dg-${++stageSeq}`, this.init.skills) : undefined;
    try {
      const options = {
        model,
        settingSources: staged ? ["project"] : [], // staged 时读副本 cwd 的 .claude;否则不读本地
        ...(staged ? { cwd: staged } : {}),
        mcpServers: { dicelore: { type: "sdk", name: "dicelore", instance: this.init.mcpServer } },
        systemPrompt: this.init.openingPrompt,
        allowedTools: staged ? ["mcp__dicelore", "Skill", "Read"] : ["mcp__dicelore"],
      } as Parameters<typeof query>[0]["options"];

      for await (const msg of query({ prompt: input.text, options })) {
        if (msg.type === "assistant") {
          const content = (msg as { message?: { content?: { type: string; text?: string }[] } }).message?.content ?? [];
          const text = content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
          const narration = stripReasoning(text); // P6:剥推理类模型(DeepSeek-R1/GLM think)的思考段
          if (narration) yield { type: "narration", text: narration };
        } else if (msg.type === "result") {
          break; // 回合结束
        }
      }
      yield { type: "turn_end" };
    } catch (e) {
      yield { type: "error", message: e instanceof Error ? e.message : String(e) };
    } finally {
      if (staged) cleanupSkills(staged);
    }
  }
}
