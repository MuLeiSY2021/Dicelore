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
import type { AgentFactory, PluginRef, BuildInvoke, TurnUsage } from "../runtime/agent.js";
import type { Session, TurnResult } from "../runtime/session.js";
import type { WsHub } from "../runtime/wsHub.js";
import type { SessionConfig, SessionConfigUpdate, SpoilerTier } from "@dicelore/shared";
import { getLogger } from "@dicelore/logs";

let loreTurnCounter = 0;
function nextTurnId(id: string): string { loreTurnCounter += 1; return `${id}-l${loreTurnCounter}`; }

// DiceGm 的模型回退链同源默认（init.model ?? env ?? "glm-5.2"）——loregm 无 deps.model，getConfig 回显同一有效值。
const DEFAULT_GM_MODEL = "glm-5.2";

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
  // 统一 session config（model-switch + spoiler-tiering，两 kind 都支持——C2）。loregm 无 session.db，
  // 故 config 存内存态（会话对象生命周期内有效；进程重启后 loreReg 空、会话本就需重建，无持久化需求）。
  //   · currentModel —— 本回合生效模型（未设 → 回退 env / 默认，与 DiceGm 一致）。
  //   · pendingModel —— 已排队、下回合起切的模型（model 下回合生效）。
  //   · spoilerTier  —— 防剧透档（默认 strict），立即生效。
  private currentModel?: string;
  private pendingModel?: string;
  private spoilerTier: SpoilerTier = "strict";
  constructor(public sessionId: string, private deps: LoreSessionDeps) {
    this.mcpServer = deps.mcpServer;
  }

  private emit(msg: LoreStreamMessage): void {
    this.deps.hub?.broadcast(this.sessionId, msg);
  }

  // model-switch：下回合生效——drive-turn 开始时若有 pending 则提升为 current 并清空。
  private promotePendingModel(): void {
    if (this.pendingModel) {
      this.currentModel = this.pendingModel;
      this.pendingModel = undefined;
      getLogger().info({ sessionId: this.sessionId, model: this.currentModel }, "loregm model 切换生效（pending→current，本回合起）");
    }
  }

  // 统一 config 读（GET /sessions/loregm/{id}/config）。
  getConfig(): SessionConfig {
    const model = this.currentModel ?? process.env.DICELORE_GM_MODEL ?? DEFAULT_GM_MODEL;
    return { model, spoilerTier: this.spoilerTier, ...(this.pendingModel ? { pendingModel: this.pendingModel } : {}) };
  }

  // 统一 config 写（POST /sessions/loregm/{id}/config，部分更新）：model 下回合生效、spoilerTier 立即生效。
  setConfig(update: SessionConfigUpdate): void {
    if (update.model !== undefined) this.pendingModel = update.model;
    if (update.spoilerTier !== undefined) this.spoilerTier = update.spoilerTier;
  }
  }

  // 返回 {turnId, error?}:构建 agent 中途 error(LLM 失败/工具异常/FakeDiceGm error 档)不再被吞——
  // 循环捕获 ev.type==="error" 记 { message, code? }、turn_end 时不带 error。error 属领域级,
  // 调用方(api/lore POST messages、build-mcp doSendToBuilder)以 body.error 存在与否判成败(HTTP 保持 200/202)。
  async handleMessage(text: string): Promise<TurnResult> {
    this.promotePendingModel(); // model-switch：下回合生效——drive-turn 开始先提升 pending→current
    const turnId = nextTurnId(this.sessionId);
    this.emit({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId });
    const driver = this.deps.agentFactory({
      mcpServer: this.mcpServer,
      openingPrompt: this.deps.buildPrompt ?? process.env.DICELORE_BUILD_PROMPT ?? "",
      plugin: this.deps.plugin,
      workspace: this.deps.workspace,
      model: this.currentModel, // model-switch：切换后的模型（未切 → undefined，DiceGm 回退 env/默认）
      // 可观测性:与 dicegm 同源——透传 sessionId + sessionsDir(=dataDir) + kind:'lore',
      // 适配器(DiceGm)据 sessionDir(dataDir,'lore',sessionId) 建 kind:'lore' 的 SessionTranscript,
      // loregm 对话记录落 <dataDir>/sessions/lore/<id>/<id>_session.jsonl(带外落盘,不改 REST 返回形状)。
      sessionId: this.sessionId,
      sessionsDir: this.deps.dataDir,
      kind: "lore",
      buildInvoke: this.deps.buildInvoke, // fake 假构建驱动写 Draft 的通道透传(真 DiceGm 忽略)
    });
    // REST 语义:跑完整轮构建反馈(narration/turn_end/error)即收尾,散文不进 loregm WS 枚举。
    // loregm WS 只发结构化事件：turn_started(上面)/toolcall+draft_delta(构建 hook)/error/turn_ended(下面)。
    // usage-stream §3:循环捕获 ev.type==="usage" 累加本轮四类 token，随响应内联回前端(v1 不落库);无 usage 事件则不带。
    let error: TurnResult["error"];
    let usage: TurnUsage | undefined;
    for await (const ev of driver.runTurn({ text, turnId })) {
      if (ev.type === "error") { error = { message: ev.message, code: ev.code }; break; }
      if (ev.type === "usage") {
        usage ??= { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
        usage.inputTokens += ev.usage.inputTokens;
        usage.outputTokens += ev.usage.outputTokens;
        usage.cacheReadTokens += ev.usage.cacheReadTokens;
        usage.cacheCreationTokens += ev.usage.cacheCreationTokens;
        continue;
      }
      if (ev.type === "turn_end") break;
    }
    if (error) this.emit({ protocol: CLIENT_PROTOCOL, type: "error", code: error.code ?? "build_error", message: error.message });
    // turn_ended 无论成败都发（一轮已跑完，客户端据 seq 回读 Draft）。
    this.emit({ protocol: CLIENT_PROTOCOL, type: "turn_ended", turnId, seq: this.deps.currentSeq?.() ?? 0 });
    if (error) return { turnId, error };
    return usage ? { turnId, usage } : { turnId };
  }
}
