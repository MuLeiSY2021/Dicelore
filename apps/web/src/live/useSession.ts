// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useRef, useState, useCallback } from "react";
import type { PresentationSnapshot, PendingRoll, StreamMessage } from "@dicelore/shared";
import {
  getPresentation, postMessage as apiPostMessage, postRoll as apiPostRoll, postChoice as apiPostChoice,
} from "../api/client.js";

export interface RevealCard { seq: number; target: string; text: string }
export interface GameEnd { reason: string; outcome: string }

// WS 客户端：连 /sessions/:id/ws，分发流消息(接口页 §3+4 全部 10 种)。
// 在原对账基础上补：生成中态(turn_started/ended)、错误提示(error)、终局(game_end)、揭示自动钉(presentation_delta.changes.reveal)、choice 闭环。
export function useSession(sessionId: string) {
  const [snapshot, setSnapshot] = useState<PresentationSnapshot | null>(null);
  const [narration, setNarration] = useState<string[]>([]);
  const [pendingRoll, setPendingRoll] = useState<PendingRoll | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameEnd, setGameEnd] = useState<GameEnd | null>(null);
  const [reveals, setReveals] = useState<RevealCard[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const refetch = useCallback(() => { getPresentation(sessionId).then(setSnapshot).catch(() => {}); }, [sessionId]);

  useEffect(() => {
    refetch();
    let closed = false;
    let retry = 0;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handle = (e: MessageEvent) => {
      let msg: StreamMessage;
      try { msg = JSON.parse(e.data) as StreamMessage; } catch { return; }
      switch (msg.type) {
        case "turn_started": setGenerating(true); setError(null); break;
        case "narration_commit": setNarration((n) => [...n, msg.text]); break;
        case "presentation_delta":
          for (const r of msg.delta.changes.reveal ?? []) {
            setReveals((prev) => (prev.some((x) => x.seq === r.seq) ? prev : [...prev, r]));
          }
          refetch();
          break;
        case "choices": refetch(); break;
        case "roll_staged": setPendingRoll(msg.pendingRoll); break;
        case "roll_committed": setPendingRoll(null); refetch(); break;
        case "turn_ended": setGenerating(false); break;
        case "game_end": setGenerating(false); setGameEnd({ reason: msg.reason, outcome: msg.outcome }); break;
        case "error": setGenerating(false); setError(msg.message || msg.code); break;
        default: break;
      }
    };

    // 连接 + 断线自动重连(指数退避，最长 5s)；重连后 refetch 全量对账补齐。
    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/sessions/${encodeURIComponent(sessionId)}/ws`);
      wsRef.current = ws;
      ws.onopen = () => { retry = 0; };
      ws.onmessage = handle;
      ws.onclose = () => {
        if (closed) return;
        const delay = Math.min(5000, 500 * 2 ** retry);
        retry += 1;
        timer = setTimeout(() => { refetch(); connect(); }, delay);
      };
    };
    connect();

    return () => { closed = true; if (timer) clearTimeout(timer); ws?.close(); };
  }, [sessionId, refetch]);

  const postMessage = useCallback((text: string) => { setGenerating(true); setError(null); return apiPostMessage(sessionId, text).catch((e: Error) => { setGenerating(false); setError(e.message); throw e; }); }, [sessionId]);
  const roll = useCallback((eventId: number) => { setError(null); return apiPostRoll(sessionId, eventId).catch((e: Error) => { setError(e.message); throw e; }); }, [sessionId]);
  const choose = useCallback((eventId: number, optionIndex: number) => { setGenerating(true); setError(null); return apiPostChoice(sessionId, eventId, optionIndex).catch((e: Error) => { setGenerating(false); setError(e.message); throw e; }); }, [sessionId]);
  const dismissReveal = useCallback((seq: number) => setReveals((prev) => prev.filter((r) => r.seq !== seq)), []);

  return { snapshot, narration, pendingRoll, generating, error, gameEnd, reveals, postMessage, roll, choose, dismissReveal };
}
