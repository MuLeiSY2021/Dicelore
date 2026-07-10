// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CLIENT_PROTOCOL, type LoreStreamMessage } from "@dicelore/shared";
import type { AgentFactory, PluginRef, BuildInvoke } from "../runtime/agent.js";
import type { Session, TurnResult } from "../runtime/session.js";
import type { WsHub } from "../runtime/wsHub.js";

let loreTurnCounter = 0;
function nextTurnId(id: string): string { loreTurnCounter += 1; return `${id}-l${loreTurnCounter}`; }

export interface LoreSessionDeps {
  // 构建 MCP server 由组合根(backend/api/lore)建好注入(BUILD_TOOLS over Draft+Catalog)——
  // loregm 保持 backend-free、不自建 Draft/不 import createBuildMcpServer(storage-port:沿用注入 mcpServer 既有缝)。
  mcpServer: McpServer;
  agentFactory: AgentFactory; // 适配缝;真实现 = CC SDK 适配器挂构建 MCP + 构建 skill
  buildPrompt?: string; // 构建教条(→ openingPrompt;默认 env DICELORE_BUILD_PROMPT)
  plugin?: PluginRef; // 构建 skill plugin 引用(build-pack+build-core,boot 期物化到 $/lore);省略=不启 skill
  workspace?: string; // 素材工作区 cwd(build-agent-workspace 用;本裁决先立入参,接线属该裁决)
  dataDir?: string; // sessions 数据根(DD2 布局):透传为 AgentInit.sessionsDir,适配器据 sessionDir(dataDir,'lore',id) 落 <dataDir>/sessions/lore/<id>/<id>_session.jsonl 对话记录 + 分级日志;省略=不落 transcript(退化全局日志,对齐纯 catalog 单测)
  buildInvoke?: BuildInvoke; // fake 假构建驱动写 Draft 的通道(组合根 api/lore 注入 = (n,a)=>invokeBuildTool(ctx,n,a));真 DiceGm 忽略、透传给 AgentInit
  // loregm WS 广播(loregm-ws 裁决 §二)：组合根注入本会话的 WsHub<LoreStreamMessage> 时，
  // handleMessage 入口发 turn_started、出口发 turn_ended（中途 error 也发 error）。省略=不广播(REST-only 单测)。
  hub?: WsHub<LoreStreamMessage>;
  // turn_ended.seq 来源(=组合根持有的 Draft.seq，构建过程中被工具调用递增)。省略=0。
  currentSeq?: () => number;
}

// lore 构建运行单元:驱动 agent 挂注入的构建 MCP,无 rollGate/turn-end/canon-notify。
// 刻意不持有 gate/db/Draft —— 跑团插件结构上不在场(物理隔离);Draft 由组合根持有(draft 只读端点经组合根读)。
// loregm WS(loregm-ws 裁决 §二)：会话本身不持 hub，由组合根注入 deps.hub——
// handleMessage 入口/出口发 turn_started/turn_ended、中途 error 发 error（toolcall/draft_delta 由构建 hook 在组合根发）。
// WS 连接的挂载/摘除由组合根(api/lore + ws.ts)直接操作该 hub，不经 LoreSession（对比 dicegm 的 attachWs/detachWs）。
export class LoreSession implements Session {
  readonly kind = "lore" as const;
  readonly mcpServer: McpServer;
  constructor(public sessionId: string, private deps: LoreSessionDeps) {
    this.mcpServer = deps.mcpServer;
  }

  private emit(msg: LoreStreamMessage): void {
    this.deps.hub?.broadcast(this.sessionId, msg);
  }

  // 返回 {turnId, error?}:构建 agent 中途 error(LLM 失败/工具异常/FakeDiceGm error 档)不再被吞——
  // 循环捕获 ev.type==="error" 记 { message, code? }、turn_end 时不带 error。error 属领域级,
  // 调用方(api/lore POST messages、build-mcp doSendToBuilder)以 body.error 存在与否判成败(HTTP 保持 200/202)。
  async handleMessage(text: string): Promise<TurnResult> {
    const turnId = nextTurnId(this.sessionId);
    this.emit({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId });
    const driver = this.deps.agentFactory({
      mcpServer: this.mcpServer,
      openingPrompt: this.deps.buildPrompt ?? process.env.DICELORE_BUILD_PROMPT ?? "",
      plugin: this.deps.plugin,
      workspace: this.deps.workspace,
      // 可观测性:与 dicegm 同源——透传 sessionId + sessionsDir(=dataDir) + kind:'lore',
      // 适配器(DiceGm)据 sessionDir(dataDir,'lore',sessionId) 建 kind:'lore' 的 SessionTranscript,
      // loregm 对话记录落 <dataDir>/sessions/lore/<id>/<id>_session.jsonl(带外落盘,不改 REST 返回形状)。
      sessionId: this.sessionId,
      sessionsDir: this.deps.dataDir,
      kind: "lore",
      buildInvoke: this.deps.buildInvoke, // fake 假构建驱动写 Draft 的通道透传(真 DiceGm 忽略)
    });
    // REST 语义:跑完整轮构建反馈(narration/turn_end/error)即收尾,不向任何 WS 广播散文（散文不进 loregm WS 枚举）。
    // loregm WS 只发结构化事件：turn_started(上面)/toolcall+draft_delta(构建 hook)/error/turn_ended(下面)。
    let error: TurnResult["error"];
    for await (const ev of driver.runTurn({ text, turnId })) {
      if (ev.type === "error") { error = { message: ev.message, code: ev.code }; break; }
      if (ev.type === "turn_end") break;
    }
    if (error) this.emit({ protocol: CLIENT_PROTOCOL, type: "error", code: error.code ?? "build_error", message: error.message });
    // turn_ended 无论成败都发（一轮已跑完，客户端据 seq 回读 Draft）。
    this.emit({ protocol: CLIENT_PROTOCOL, type: "turn_ended", turnId, seq: this.deps.currentSeq?.() ?? 0 });
    return error ? { turnId, error } : { turnId };
  }
}
