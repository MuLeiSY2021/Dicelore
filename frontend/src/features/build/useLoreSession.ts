// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useRef, useState, useCallback } from "react";
import type { LoreStreamMessage } from "@dicelore/shared";
import { getDraft, type DraftView } from "@/features/build/api.js";

// 构建助手一次工具调用（loregm WS toolcall 事件，RT-FE12）。
export interface ToolCall { tool: string; args: unknown; result?: unknown; ok: boolean }

// loregm 域 WS 客户端（hidden-roll-and-loregm-ws 裁决 §二）：连 /sessions/loregm/:id/ws，
// 分发 5 类事件 + error（turn_started/turn_ended/toolcall/draft_delta/error）。
//   · toolcall   → 累进本轮工具流（构建助手「调了哪些工具」透视）+ 按 turnId 归档供 chat 尾行展示。
//   · draft_delta→ 即写即读：重拉 GET …/draft 刷新分域快照（构建工具改的 Draft commit 前只在这看得到）。
//   · turn_started/ended → 编排中态（generating）；ended 收尾时再兜底重拉一次 Draft（漏掉的 delta 补齐）。
//   · error      → 领域级构建出错（body.error 通道，前端 build-assistant-error 呈现）。
// sessionId 为 null（尚未建/选会话）时不连、状态全空。
export function useLoreSession(sessionId: string | null) {
  const [draft, setDraft] = useState<DraftView | null>(null);
  const [generating, setGenerating] = useState(false);
  const [seq, setSeq] = useState(0);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  // 本轮（generating 中）累进的工具流——构建助手「编排中」气泡实时显示。
  const [liveTools, setLiveTools] = useState<ToolCall[]>([]);
  // 按 turnId 归档的已完成轮工具流——供 chat 里该轮助手消息的「↳ tool·tool」尾行展示。
  const [toolsByTurn, setToolsByTurn] = useState<Record<string, ToolCall[]>>({});
  const currentTurn = useRef<string | null>(null);
  const sidRef = useRef(sessionId);

  const refresh = useCallback(() => {
    if (!sessionId) return;
    const sid = sessionId;
    getDraft(sid).then((v) => {
      if (sidRef.current !== sid) return;
      setDraft(v);
    }).catch(() => { /* 会话未建 / 网络抖动：保持旧态，不清空 */ });
  }, [sessionId]);

  useEffect(() => {
    sidRef.current = sessionId;
    // 切会话：清所有残留（旧会话 Draft/工具流/错误不闪现到新会话）。
    setDraft(null); setGenerating(false); setSeq(0); setError(null);
    setLiveTools([]); setToolsByTurn({}); currentTurn.current = null;
    if (!sessionId) return;
    refresh();

    let closed = false;
    let retry = 0;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handle = (e: MessageEvent) => {
      let msg: LoreStreamMessage;
      try { msg = JSON.parse(e.data) as LoreStreamMessage; } catch { return; }
      switch (msg.type) {
        case "turn_started":
          currentTurn.current = msg.turnId;
          setGenerating(true); setError(null); setLiveTools([]);
          break;
        case "toolcall": {
          const call: ToolCall = { tool: msg.tool, args: msg.args, result: msg.result, ok: msg.ok };
          setLiveTools((ts) => [...ts, call]);
          const tid = currentTurn.current;
          if (tid) setToolsByTurn((m) => ({ ...m, [tid]: [...(m[tid] ?? []), call] }));
          break;
        }
        case "draft_delta":
          setSeq(msg.seq);
          refresh(); // 即写即读：拉最新分域快照
          break;
        case "turn_ended":
          setSeq(msg.seq);
          setGenerating(false);
          currentTurn.current = null;
          refresh(); // 收尾兜底重拉（补齐可能漏掉的 delta）
          break;
        case "error":
          setGenerating(false);
          setError({ code: msg.code, message: msg.message });
          break;
        default: break;
      }
    };

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/sessions/loregm/${encodeURIComponent(sessionId)}/ws`);
      ws.onopen = () => { retry = 0; };
      ws.onmessage = handle;
      ws.onclose = () => {
        if (closed) return;
        const delay = Math.min(5000, 500 * 2 ** retry);
        retry += 1;
        timer = setTimeout(() => { refresh(); connect(); }, delay);
      };
    };
    connect();

    return () => { closed = true; if (timer) clearTimeout(timer); ws?.close(); };
  }, [sessionId, refresh]);

  return { draft, generating, seq, error, liveTools, toolsByTurn, refresh, clearError: () => setError(null) };
}
