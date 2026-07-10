// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { CLIENT_PROTOCOL, type StreamMessage } from "@dicelore/shared";
import type { Agent, TurnInput, TurnUsage } from "./agent.js";
import type { WsHub } from "./wsHub.js";

export interface StreamTurnDeps {
  driver: Agent;
  hub: WsHub;
  sessionId: string;
  turnId: string;
  // agent 上抛的 token 用量(usage 事件)回调——会话经注入的 SessionBackend.recordUsage 落库。
  // 省略则丢弃(lore/裸测试不计量)。streamTurn 不碰存储,只把事件转交回调(agent 存储无关)。
  onUsage?: (usage: TurnUsage, model?: string) => void;
  // agent 上抛的 SDK session_id(sdk_session 事件)回调——会话 backend.metaSet("sdk_session_id",id) 存库,
  // 下回合 resume 续接(裁决 gm-session-continuity)。省略则丢弃(lore/裸测试不续接)。
  onSdkSession?: (id: string) => void;
}

// 驱动 Agent 事件流 → 广播 turn_started + 逐条 narration_commit；遇 error 发 error 并返回 errored。
// 不发 turn_ended——回合收尾由调用者按场景决定(dice 跑 turn-end hook,lore 直接结束)。
// 注：narration 分支当前生产中无路径可达——唯一生产调用方是 turnLoop(dice 路径),而 DiceGm 不再 yield
// narration(叙事走 narrate event→onCanonWrite,见 §10.1 A1);LoreSession 也不经此函数(它直接 for-await
// driver.runTurn(),见 loregm/LoreSession.ts)。保留该分支作通用骨架,仅 streamTurn.test 经 FakeDiceGm 命中。
// 返回的 seq 是回合内 narration 计数,dice 的 turn_ended.seq 由 turnLoop 取全局 log seq(§10.1 B4)。
export async function streamDriverTurn(deps: StreamTurnDeps, input: TurnInput): Promise<{ seq: number; errored: boolean }> {
  const { hub, sessionId, turnId } = deps;
  const send = (m: StreamMessage) => hub.broadcast(sessionId, m);
  send({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId });
  let seq = 0;
  try {
    for await (const ev of deps.driver.runTurn({ ...input, turnId: deps.turnId })) {
      if (ev.type === "narration") {
        seq += 1;
        send({ protocol: CLIENT_PROTOCOL, type: "narration_commit", seq, text: ev.text });
      } else if (ev.type === "usage") {
        deps.onUsage?.(ev.usage, ev.model); // 转交会话落库;不广播(带外计量,不进玩家所见)
      } else if (ev.type === "sdk_session") {
        deps.onSdkSession?.(ev.id); // 转交会话存 sdk_session_id;不广播(续接指针,不进玩家所见)
      } else if (ev.type === "context_compacting") {
        // 上下文压缩进行态(裁决 usage-and-context §四):广播给前端显/隐「正在进行上下文压缩」提示 + indeterminate 进度条。
        send({ protocol: CLIENT_PROTOCOL, type: "context_compacting", phase: ev.phase, ...(ev.result ? { result: ev.result } : {}), ...(ev.error ? { error: ev.error } : {}) });
      } else if (ev.type === "error") {
        // ev.code 由驱动给出可区分码(如 gm_timeout，让前端识别「超时·可重试」);省略则默认 gm_error。
        send({ protocol: CLIENT_PROTOCOL, type: "error", code: ev.code ?? "gm_error", message: ev.message });
        return { seq, errored: true };
      } else if (ev.type === "turn_end") {
        break;
      }
    }
  } catch (e) {
    send({ protocol: CLIENT_PROTOCOL, type: "error", code: "driver_error", message: e instanceof Error ? e.message : String(e) });
    return { seq, errored: true };
  }
  return { seq, errored: false };
}
