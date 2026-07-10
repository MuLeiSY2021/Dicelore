// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AgentFactory, PluginRef, BuildInvoke } from "../runtime/agent.js";
import type { Session, TurnResult } from "../runtime/session.js";
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
}

// lore 构建运行单元:驱动 agent 挂注入的构建 MCP,无 rollGate/turn-end/canon-notify。
// 刻意不持有 gate/db/Draft —— 跑团插件结构上不在场(物理隔离);Draft 由组合根持有(draft 只读端点经组合根读)。
// v1 lore 构建是 REST only:无 WS 端点接入(见 api/lore.ts,只 POST /lore-sessions/:id/messages),
// 故不持 hub/不广播——handleMessage 直接把 driver 跑到 turn_end、轮询/等待返回 {turnId, error?}。
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

  // 返回 {turnId, error?}:构建 agent 中途 error(LLM 失败/工具异常/FakeDiceGm error 档)不再被吞——
  // 循环捕获 ev.type==="error" 记 { message, code? }、turn_end 时不带 error。error 属领域级,
  // 调用方(api/lore POST messages、build-mcp doSendToBuilder)以 body.error 存在与否判成败(HTTP 保持 200/202)。
  async handleMessage(text: string): Promise<TurnResult> {
    this.promotePendingModel(); // model-switch：下回合生效——drive-turn 开始先提升 pending→current
    const turnId = nextTurnId(this.sessionId);
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
    // REST 语义:跑完整轮构建反馈(narration/turn_end/error)即收尾,不向任何 WS 广播。
    let error: TurnResult["error"];
    for await (const ev of driver.runTurn({ text, turnId })) {
      if (ev.type === "error") { error = { message: ev.message, code: ev.code }; break; }
      if (ev.type === "turn_end") break;
    }
    return error ? { turnId, error } : { turnId };
  }
}
