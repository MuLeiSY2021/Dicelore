// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { PresentationSnapshot, PendingRoll, StreamMessage, SessionConfig, SpoilerTier } from "@dicelore/shared";
import {
  getPresentation, postMessage as apiPostMessage, postRoll as apiPostRoll, postChoice as apiPostChoice,
  postRewind as apiPostRewind, startGame as apiStartGame,
  getConfig as apiGetConfig, postConfig as apiPostConfig, getUsage as apiGetUsage, createBranch as apiCreateBranch,
  getEvents as apiGetEvents, getSessionMeta as apiGetSessionMeta,
  type UsageReport,
} from "@/features/play/api.js";
import type { TurnUsage } from "@/features/cost/pricing.js";

export interface RevealCard { seq: number; target: string; text: string }
export interface GameEnd { reason: string; outcome: string }
// co-play：按回合分组的叙事块（turn_started 开新块 / narration_commit 追加 / turn_ended 落 usage）。
export interface Round { texts: string[]; usage?: TurnUsage; model?: string }
// 暗骰（RT-FE6）：GM 主动掷、结果 visible=0，走独立 hidden_roll 通知（非 pendingRoll）。前端按 spoiler 档渲染。
export interface HiddenRoll { eventId: number; label: string; result: number; dc?: number; band?: { label: string; consequence: string } }
// 明骰掷出后的结果（roll_committed），供 stream bandtable 的 rollresult 渲染（命中档高亮）。
export interface RollResult { eventId: number; rolls: number[]; total: number; dc?: number; outcome: string }

// WS 客户端：连 /sessions/dicegm/:id/ws，分发流消息（stream.ts 全部类型，含 hidden_roll / context_compacting）。
export function useSession(sessionId: string) {
  const [snapshot, setSnapshot] = useState<PresentationSnapshot | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [pendingRoll, setPendingRoll] = useState<PendingRoll | null>(null);
  const [rollResult, setRollResult] = useState<RollResult | null>(null);
  const [hiddenRolls, setHiddenRolls] = useState<HiddenRoll[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [gameEnd, setGameEnd] = useState<GameEnd | null>(null);
  // 复盘态（终局）持久来源：会话 status=debrief（game_end MCP 落 meta）。重连/回填后仍在，
  // 不依赖瞬时 WS game_end 帧（FAKE 教练档 game_end 只落 meta·不发帧）。
  const [debrief, setDebrief] = useState(false);
  const [reveals, setReveals] = useState<RevealCard[]>([]);
  const [config, setConfigState] = useState<SessionConfig | null>(null);
  const [usage, setUsage] = useState<UsageReport | null>(null);
  const [compacting, setCompacting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  type LastInput = { kind: "message"; text: string } | { kind: "choice"; eventId: number; optionIndex: number } | { kind: "start" };
  const lastInputRef = useRef<LastInput | null>(null);
  const sidRef = useRef(sessionId);

  const refetch = useCallback(() => {
    getPresentation(sessionId).then((s) => { if (sidRef.current === sessionId) setSnapshot(s); }).catch(() => {});
  }, [sessionId]);
  const refetchUsage = useCallback(() => {
    apiGetUsage(sessionId).then((u) => { if (sidRef.current === sessionId) setUsage(u); }).catch(() => {});
  }, [sessionId]);
  const refetchConfig = useCallback(() => {
    apiGetConfig(sessionId).then((c) => { if (sidRef.current === sessionId) setConfigState(c); }).catch(() => {});
  }, [sessionId]);
  // 暗骰缩略指示的**持久来源**：从事件流的 visible=0 verdict 派生（重连/回填后仍在历史里），
  // 与瞬时 WS hidden_roll 帧合并去重（帧=spoiler=off 实时增强）。严格档只显 label、不显 result/DC。
  const refetchHidden = useCallback(() => {
    apiGetEvents(sessionId).then((events) => {
      if (sidRef.current !== sessionId) return;
      const fromLog: HiddenRoll[] = events
        .filter((e) => e.kind === "verdict" && e.visible === 0)
        .map((e) => {
          const d = (e.data ?? {}) as { context?: string; roll?: number; band?: { label: string; consequence: string }; dc?: number };
          return { eventId: e.seq, label: d.context ?? e.text ?? "判定", result: d.roll ?? 0, dc: d.dc, band: d.band };
        });
      if (fromLog.length === 0) return;
      setHiddenRolls((prev) => {
        const seen = new Set(prev.map((x) => x.eventId));
        const merged = [...prev];
        for (const h of fromLog) if (!seen.has(h.eventId)) merged.push(h);
        return merged;
      });
    }).catch(() => {});
  }, [sessionId]);
  // 复盘态派生：GET /sessions/dicegm/:id → status=debrief 则进复盘（终局）。
  const refetchDebrief = useCallback(() => {
    apiGetSessionMeta(sessionId).then((m) => { if (sidRef.current === sessionId) setDebrief(m.status === "debrief"); }).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    sidRef.current = sessionId;
    setSnapshot(null);
    setRounds([]);
    setPendingRoll(null);
    setRollResult(null);
    setHiddenRolls([]);
    setGenerating(false);
    setError(null);
    setErrorCode(null);
    setGameEnd(null);
    setDebrief(false);
    setReveals([]);
    setUsage(null);
    setCompacting(false);
    refetch();
    refetchConfig();
    refetchUsage();
    refetchHidden();
    refetchDebrief();
    let closed = false;
    let retry = 0;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handle = (e: MessageEvent) => {
      let msg: StreamMessage;
      try { msg = JSON.parse(e.data) as StreamMessage; } catch { return; }
      switch (msg.type) {
        case "turn_started":
          setGenerating(true); setError(null); setErrorCode(null);
          setRounds((r) => [...r, { texts: [] }]);
          break;
        case "narration_commit":
          setRounds((r) => {
            if (r.length === 0) return [{ texts: [msg.text] }];
            const next = r.slice();
            next[next.length - 1] = { ...next[next.length - 1], texts: [...next[next.length - 1].texts, msg.text] };
            return next;
          });
          break;
        case "presentation_delta":
          for (const rv of msg.delta.changes.reveal ?? []) {
            setReveals((prev) => (prev.some((x) => x.seq === rv.seq) ? prev : [...prev, rv]));
          }
          refetch();
          break;
        case "choices": refetch(); break;
        case "roll_staged": setPendingRoll(msg.pendingRoll); setRollResult(null); break;
        case "roll_committed":
          setPendingRoll(null);
          setRollResult({ eventId: msg.eventId, rolls: msg.rolls, total: msg.total, dc: msg.dc, outcome: msg.outcome });
          refetch();
          break;
        case "hidden_roll":
          setHiddenRolls((prev) => (prev.some((x) => x.eventId === msg.eventId)
            ? prev
            : [...prev, { eventId: msg.eventId, label: msg.label, result: msg.result, dc: msg.dc, band: msg.band }]));
          break;
        case "turn_ended":
          setGenerating(false);
          if (msg.usage) {
            const u = msg.usage;
            setRounds((r) => {
              if (r.length === 0) return r;
              const next = r.slice();
              next[next.length - 1] = { ...next[next.length - 1], usage: u };
              return next;
            });
          }
          refetchUsage();
          refetchHidden();
          refetchDebrief();
          break;
        case "game_end": setGenerating(false); setGameEnd({ reason: msg.reason, outcome: msg.outcome }); break;
        case "error": setGenerating(false); setError(msg.message || msg.code); setErrorCode(msg.code); break;
        case "context_compacting": setCompacting(msg.phase === "start"); if (msg.phase === "done") refetchUsage(); break;
        default: break;
      }
    };

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
  }, [sessionId, refetch, refetchConfig, refetchUsage, refetchHidden, refetchDebrief]);

  // 兼容旧消费者：narration 扁平串（rounds 各回合 texts 展平）。
  const narration = useMemo(() => rounds.flatMap((r) => r.texts), [rounds]);

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
  const start = useCallback(() => {
    lastInputRef.current = { kind: "start" };
    setGenerating(true); setError(null); setErrorCode(null);
    return apiStartGame(sessionId).catch((e: Error) => { setGenerating(false); setError(e.message); throw e; });
  }, [sessionId]);
  const retry = useCallback(() => {
    const last = lastInputRef.current;
    if (!last) { setError(null); setErrorCode(null); return Promise.resolve(); }
    if (last.kind === "message") return postMessage(last.text).then(() => undefined);
    if (last.kind === "choice") return choose(last.eventId, last.optionIndex).then(() => undefined);
    return start().then(() => undefined);
  }, [postMessage, choose, start]);
  const skip = useCallback(() => { setError(null); setErrorCode(null); setGenerating(false); }, []);
  const rewind = useCallback(() =>
    apiPostRewind(sessionId).then((r) => {
      setError(null); setErrorCode(null); setPendingRoll(null); setGameEnd(null); setReveals([]); refetch();
      return r;
    }).catch((e: Error) => { setError(e.message); throw e; }), [sessionId, refetch]);
  const dismissReveal = useCallback((seq: number) => setReveals((prev) => prev.filter((r) => r.seq !== seq)), []);

  // model-switch：下回合生效（POST /config {model} → pendingModel）。乐观刷新 config。
  const setModel = useCallback((model: string) =>
    apiPostConfig(sessionId, { model }).then((c) => { setConfigState(c); return c; }).catch((e: Error) => { setError(e.message); throw e; }), [sessionId]);
  // spoiler 档：立即生效（POST /config {spoilerTier}）。
  const setSpoilerTier = useCallback((spoilerTier: SpoilerTier) =>
    apiPostConfig(sessionId, { spoilerTier }).then((c) => { setConfigState(c); return c; }).catch((e: Error) => { setError(e.message); throw e; }), [sessionId]);
  // 复盘态回档：从某 seq 新建分支续玩（debrief-and-branch §二）。
  const branch = useCallback((fromSeq?: number) =>
    apiCreateBranch(sessionId, fromSeq).then((r) => { refetch(); return r; }).catch((e: Error) => { setError(e.message); throw e; }), [sessionId, refetch]);

  return {
    snapshot, rounds, narration, pendingRoll, rollResult, hiddenRolls, generating, error, errorCode, gameEnd, debrief, reveals,
    config, usage, compacting,
    postMessage, start, roll, choose, rewind, retry, skip, dismissReveal, setModel, setSpoilerTier, branch, refetchUsage,
  };
}
