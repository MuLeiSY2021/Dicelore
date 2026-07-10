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
  postRewind as apiPostRewind, startGame as apiStartGame,
} from "@/features/play/api.js";

export interface RevealCard { seq: number; target: string; text: string }
export interface GameEnd { reason: string; outcome: string }

// WS 客户端：连 /sessions/dicegm/:id/ws，分发流消息(接口页 §3+4 全部 10 种)。
// 在原对账基础上补：生成中态(turn_started/ended)、错误提示(error)、终局(game_end)、揭示自动钉(presentation_delta.changes.reveal)、choice 闭环。
export function useSession(sessionId: string) {
  const [snapshot, setSnapshot] = useState<PresentationSnapshot | null>(null);
  const [narration, setNarration] = useState<string[]>([]);
  const [pendingRoll, setPendingRoll] = useState<PendingRoll | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // RT-1：错误 code 与 error 并列暴露——前端据 code 区分超时(gm_timeout，给重试/跳过入口)与其它错误。
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [gameEnd, setGameEnd] = useState<GameEnd | null>(null);
  const [reveals, setReveals] = useState<RevealCard[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  // RT-1 重试：记最近一次驱动 GM 回合的玩家输入（自由文本 / 选项点选 / 开场）。
  // 超时后「重试」= 重发它；「跳过」= 仅清错误不重发，玩家继续下一步。
  type LastInput = { kind: "message"; text: string } | { kind: "choice"; eventId: number; optionIndex: number } | { kind: "start" };
  const lastInputRef = useRef<LastInput | null>(null);
  // 当前会话 id 的 ref：迟到的旧会话异步回调（refetch / WS 消息）据此守卫，不污染新会话状态。
  const sidRef = useRef(sessionId);

  const refetch = useCallback(() => {
    getPresentation(sessionId).then((s) => { if (sidRef.current === sessionId) setSnapshot(s); }).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    // 切会话：先把 sidRef 指向新会话 + 重置所有残留状态（旧会话叙事/待掷/错误/终局/揭示不闪现到新会话）。
    sidRef.current = sessionId;
    setSnapshot(null);
    setNarration([]);
    setPendingRoll(null);
    setGenerating(false);
    setError(null);
    setErrorCode(null);
    setGameEnd(null);
    setReveals([]);
    refetch();
    let closed = false;
    let retry = 0;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handle = (e: MessageEvent) => {
      let msg: StreamMessage;
      try { msg = JSON.parse(e.data) as StreamMessage; } catch { return; }
      switch (msg.type) {
        case "turn_started": setGenerating(true); setError(null); setErrorCode(null); break;
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
        case "error": setGenerating(false); setError(msg.message || msg.code); setErrorCode(msg.code); break;
        default: break;
      }
    };

    // 连接 + 断线自动重连(指数退避，最长 5s)；重连后 refetch 全量对账补齐。
    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/sessions/dicegm/${encodeURIComponent(sessionId)}/ws`);
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

  const postMessage = useCallback((text: string) => {
    lastInputRef.current = { kind: "message", text };
    setGenerating(true); setError(null); setErrorCode(null);
    return apiPostMessage(sessionId, text).catch((e: Error) => { setGenerating(false); setError(e.message); throw e; });
  }, [sessionId]);
  const roll = useCallback((eventId: number) => { setError(null); setErrorCode(null); return apiPostRoll(sessionId, eventId).catch((e: Error) => { setError(e.message); throw e; }); }, [sessionId]);
  const choose = useCallback((eventId: number, optionIndex: number) => {
    lastInputRef.current = { kind: "choice", eventId, optionIndex };
    setGenerating(true); setError(null); setErrorCode(null);
    return apiPostChoice(sessionId, eventId, optionIndex).catch((e: Error) => { setGenerating(false); setError(e.message); throw e; });
  }, [sessionId]);
  // 开场：记为 lastInput 供超时后「重试」复发（startGame 内部 404 降级走 messages，前端无感）。
  const start = useCallback(() => {
    lastInputRef.current = { kind: "start" };
    setGenerating(true); setError(null); setErrorCode(null);
    return apiStartGame(sessionId).catch((e: Error) => { setGenerating(false); setError(e.message); throw e; });
  }, [sessionId]);
  // RT-1 重试：清错误后重发上一条驱动输入（自由文本 / 选项 / 开场）。无记录则等同跳过（仅清错误）。
  const retry = useCallback(() => {
    const last = lastInputRef.current;
    if (!last) { setError(null); setErrorCode(null); return Promise.resolve(); }
    if (last.kind === "message") return postMessage(last.text).then(() => undefined);
    if (last.kind === "choice") return choose(last.eventId, last.optionIndex).then(() => undefined);
    return start().then(() => undefined);
  }, [postMessage, choose, start]);
  // RT-1 跳过：放弃本回合，仅清错误态继续（不重发）。inflight 后端早已 finally 释放，可直接下一步。
  const skip = useCallback(() => { setError(null); setErrorCode(null); setGenerating(false); }, []);
  // 读档（SNAP-1 v1）：后端自动恢复最近快照（整表覆写 sheet/world/watcher），成功后 refetch 全量呈现对账。
  // 同时清掉残留的待掷/选项/终局/揭示——读回的是快照那一刻的「干净」回合边界态。
  const rewind = useCallback(() =>
    apiPostRewind(sessionId).then((r) => {
      setError(null); setErrorCode(null); setPendingRoll(null); setGameEnd(null); setReveals([]); refetch();
      return r;
    }).catch((e: Error) => { setError(e.message); throw e; }), [sessionId, refetch]);
  const dismissReveal = useCallback((seq: number) => setReveals((prev) => prev.filter((r) => r.seq !== seq)), []);

  return { snapshot, narration, pendingRoll, generating, error, errorCode, gameEnd, reveals, postMessage, start, roll, choose, rewind, retry, skip, dismissReveal };
}
