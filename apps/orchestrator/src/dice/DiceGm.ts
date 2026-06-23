// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Agent, TurnInput, TurnEvent } from "../pkg/agent.js";
import { stripReasoning } from "../pkg/reasoning.js";

export interface DiceGmDeps {
  mcpServer: McpServer; // DiceSession 的 in-process MCP(已注入 onCanonWrite/rollGate)
  model?: string; // 默认 env DICELORE_GM_MODEL ?? "opus"
  systemPrompt?: string; // gm-core 教条(组件3);Phase 1 可选
}

// 真 GM 驱动：@anthropic-ai/claude-agent-sdk query()，in-process 挂 dicelore MCP。
// 鉴权沿用 env ANTHROPIC_BASE_URL/ANTHROPIC_AUTH_TOKEN(SDK 原生读)。不进单测(烧 LLM)。
export class DiceGm implements Agent {
  constructor(private deps: DiceGmDeps) {}

  async *runTurn(input: TurnInput): AsyncIterable<TurnEvent> {
    const model = this.deps.model ?? process.env.DICELORE_GM_MODEL ?? "opus";
    try {
      const options = {
        model,
        settingSources: [], // 不读本地 .claude;MCP/prompt 显式注入
        mcpServers: { dicelore: { type: "sdk", name: "dicelore", instance: this.deps.mcpServer } },
        systemPrompt: this.deps.systemPrompt,
        allowedTools: ["mcp__dicelore"], // 允许 dicelore 工具族(mcp__dicelore__*)
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
    }
  }
}
