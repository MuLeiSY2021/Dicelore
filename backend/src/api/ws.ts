// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { WebSocketServer } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { DB } from "@dicelore/interface";
import { openSessionBackend } from "@dicelore/backend";
import { getLogger } from "@dicelore/logs";
import { getOrCreateHost } from "@dicelore/harness";
import { restagePendingRolls, replayNarration } from "@dicelore/harness";
import type { AgentFactory, PluginRef, WsHub, WsLike } from "@dicelore/harness";
import type { LoreStreamMessage } from "@dicelore/shared";

export interface WsUpgradeDeps {
  openSession: (id: string) => DB;
  agentFactory: AgentFactory;
  plugin?: PluginRef;
  model?: string;
  baseline?: boolean; // eval baseline 对照:透传 DiceSession
  debug?: boolean; // eval/裸 CC 明骰降级:透传 DiceSession(不注入 rollGate)
  sessionsDir?: string; // GM raw 日志根目录:透传 DiceSession→DiceGm(否则 WS 路径 sessionLogger 退化全局,GM 日志刷屏全局 debug.log)
  // loregm 域 WS(loregm-ws 裁决 §二 C1)：复用同一 http upgrade，按会话 id 取该会话的 loregm WsHub。
  // 组合根(server.ts) 用 getLoreEntry(id)?.hub 接线；省略/返回 undefined = 会话不存在，拒绝升级。
  resolveLoreHub?: (id: string) => WsHub<LoreStreamMessage> | undefined;
}

// 会话 WS 升级挂到 http server——单一 upgrade 监听按路径路由 dicegm / loregm（两 kind 共用同一 wsHub 骨架）。
// 从原 startServer 内联块抽出；dicegm 行为不变，另接 loregm（loregm-ws 裁决 §二）。
export function attachWsUpgrade(server: unknown, deps: WsUpgradeDeps): void {
  const wss = new WebSocketServer({ noServer: true });
  (server as { on(ev: string, cb: (req: IncomingMessage, socket: Duplex, head: Buffer) => void): void }).on(
    "upgrade",
    (req, socket, head) => {
      const url = req.url ?? "";
      const dm = /^\/sessions\/dicegm\/([^/]+)\/ws(?:\?(.*))?$/.exec(url);
      if (dm) {
        wss.handleUpgrade(req, socket, head, (ws) => {
          const id = decodeURIComponent(dm[1]);
          const db = deps.openSession(id);
          // 组合根:绑定本局 db 的存储端口实例,注入 harness 会话(harness 不自开库/不自建 backend)。
          const host = getOrCreateHost(id, { db, backend: openSessionBackend(db), agentFactory: deps.agentFactory, plugin: deps.plugin, model: deps.model, baseline: deps.baseline, debug: deps.debug, sessionsDir: deps.sessionsDir });
          const wsLike = ws as unknown as WsLike;
          host.attachWs(wsLike);
          const since = new URLSearchParams(dm[2] ?? "").get("since");
          getLogger().info({ sessionId: id, since: since ?? undefined }, "WS 连接建立");
          restagePendingRolls(host); // 重连/重启 → 重弹未决掷骰卡
          // B2：重连带 ?since=<narrativeCursor> 时补叙述历史(无 since=首连,客户端走 snapshot+GET /events,不重发避重复)。
          if (since !== null) replayNarration(host, Number(since) || 0);
          ws.on("error", (err) => {
            // WS 传输层错误(对端异常/网络抖动);连接随后多会触发 close,此处只记不额外清理。
            getLogger().warn({ sessionId: id, err }, "WS 连接错误");
          });
          ws.on("close", (code?: number) => {
            getLogger().info({ sessionId: id, code }, "WS 连接断开");
            host.detachWs(wsLike);
          });
        });
        return;
      }
      // loregm 域 WS：接本会话的构建 WsHub（turn_started/turn_ended/toolcall/draft_delta/error）。
      const lm = /^\/sessions\/loregm\/([^/]+)\/ws(?:\?(.*))?$/.exec(url);
      if (lm) {
        const id = decodeURIComponent(lm[1]);
        const hub = deps.resolveLoreHub?.(id);
        if (!hub) {
          // 会话未建（或组合根未接线 resolveLoreHub）→ 拒绝升级（对齐 REST 侧 404 语义）。
          getLogger().warn({ sessionId: id }, "loregm WS 升级：会话不存在,拒绝升级");
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          const wsLike = ws as unknown as WsLike;
          hub.add(id, wsLike);
          getLogger().info({ sessionId: id }, "loregm WS 连接建立");
          ws.on("error", (err) => {
            getLogger().warn({ sessionId: id, err }, "loregm WS 连接错误");
          });
          ws.on("close", (code?: number) => {
            getLogger().info({ sessionId: id, code }, "loregm WS 连接断开");
            hub.remove(id, wsLike);
          });
        });
        return;
      }
      // 非会话 WS 路径(其它升级请求/探测)→ 拒绝升级。warn:非预期路径打到此处。
      getLogger().warn({ url }, "WS 升级路径不匹配 /sessions/{dicegm,loregm}/:id/ws,拒绝升级");
      socket.destroy();
    },
  );
}
