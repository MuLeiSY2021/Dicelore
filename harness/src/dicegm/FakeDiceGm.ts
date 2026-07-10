// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { SessionBackend } from "@dicelore/interface";
import { resolveOutcome, type Band } from "@dicelore/dice";
import { getRollGate } from "./mcp/rollGate.js";
import type { Agent, TurnInput, TurnEvent } from "../runtime/agent.js";

// 脚本化 GM 驱动：测试用，不烧 LLM。
//
// 两档能力：
//  ① 纯叙事档(Script)——产 narration/turn_end/error 流事件(原始用法,server.ts 默认工厂)。
//  ② 教练档(CanonScript + db)——除流事件外，还能让 fake GM「调工具」产 canon 写入：
//     · roll  → stagePendingRoll + await 模块级 rollGate(DiceSession 注入)→ 触发 roll_staged 广播 + 挂起等 POST /roll
//     · choice→ 落一条已物化 kind=choice event；DiceSession.turnEnd 的 runTurnEnd/buildPresentationModel
//               会把它读成 pendingChoice → turnLoop 广播 choices
//     · game_end→ 落 game_end note + metaSet("ended") → 这里不直接发 WS，
//               (game_end 的 WS 由真 MCP 工具经 onCanonWrite 发；fake 档用 emitGameEnd 让 DiceSession 自行映射，
//                见下方注：教练档主要服务「五条玩家主线」的后端集成/e2e 驱动)。
// 这样无真 LLM 也能端到端跑通：掷骰/选择/终局/错误/重连五条玩家主线。
type Script = TurnEvent[] | ((input: TurnInput) => TurnEvent[]);

// 一条「GM 在回合内做的事」——可以是产出一段流事件，也可以是一次 canon 写入。
export type CanonAction =
  | { type: "narration"; text: string }
  | { type: "error"; message: string; code?: string }
  // 明骰：暂存待掷 + await rollGate(玩家在客户端点掷才解开)。flow 等同 resolve_outcome_open。
  | { type: "roll"; context: string; die?: string; bands?: { label: string; min: number; max: number }[] }
  // 暗骰：引擎自动掷(不经 gate、不挂起),就地落 kind=verdict event。flow 等同 resolve_outcome_hidden。
  // bands 须全覆盖骰面(resolveOutcome 用 rangeMap 校验不重叠/无空缺),缺省给一张 1d100 的二档全覆盖表。
  | { type: "hiddenRoll"; context: string; die?: string; bands?: Band[] }
  // 选择：落一条 kind=choice event，回合末由 runTurnEnd/buildPresentationModel 物化成 choices。
  | { type: "choice"; prompt: string; options: { label: string; consequence: string }[] }
  // 终局：落 game_end note + 写 session_meta.ended（reason/outcome 供快照/映射取出）。
  | { type: "gameEnd"; reason: string; outcome?: string };

export type CanonScript = CanonAction[] | ((input: TurnInput) => CanonAction[]);

// 默认「教练档」canon(FAKE_GM=1 时 server.ts 装它)——按玩家发言关键字派发到五条主线,
// 让无真 LLM 也能 curl/e2e 打通掷骰(明骰)/暗骰/选择/终局/错误。关键字命中顺序:
// 「暗骰」先于「骰」(暗骰串含「骰」),避免被明骰分支抢走。无命中 → 纯叙事回声 + turn_end。
export function defaultCoachCanon(input: TurnInput): CanonAction[] {
  const t = input.text ?? "";
  if (/暗骰|暗掷|hidden/i.test(t)) {
    return [
      { type: "narration", text: `（GM）你说：「${t}」。我在幕后为你摇动骰子……` },
      { type: "hiddenRoll", context: "暗中裁决", die: "1d100", bands: [
        { label: "失败", min: 1, max: 50, consequence: "事与愿违" },
        { label: "成功", min: 51, max: 100, consequence: "如你所愿" },
      ] },
    ];
  }
  if (/掷骰|检定|判定|骰|\broll\b/i.test(t)) {
    return [
      { type: "narration", text: `（GM）你说：「${t}」。命运悬于一掷,请掷骰。` },
      { type: "roll", context: "命运检定", die: "1d100", bands: [
        { label: "失败", min: 1, max: 50 },
        { label: "成功", min: 51, max: 100 },
      ] },
    ];
  }
  if (/选择|选项|抉择|岔路|choice/i.test(t)) {
    return [
      { type: "narration", text: `（GM）你说：「${t}」。前路分作两条。` },
      { type: "choice", prompt: "走哪条路？", options: [
        { label: "推门直入", consequence: "或将惊动守卫" },
        { label: "绕行后窗", consequence: "耗时但隐蔽" },
      ] },
    ];
  }
  if (/结束|终局|收场|game.?end|the end/i.test(t)) {
    return [
      { type: "narration", text: `（GM）你说：「${t}」。故事在此落下帷幕。` },
      { type: "gameEnd", reason: "玩家主动收场", outcome: "本局结束" },
    ];
  }
  if (/报错|错误|出错|\berror\b/i.test(t)) {
    return [{ type: "error", message: "（GM）模拟的回合错误,已脱困", code: "gm_error" }];
  }
  return [{ type: "narration", text: `（GM）你说：「${t}」。门吱呀一声开了。` }];
}

export class FakeDiceGm implements Agent {
  // 纯叙事档：仅产流事件(不碰存储)。
  private readonly script?: Script;
  // 教练档：产 canon 写入(经注入的 SessionBackend 端口,不直连存储自由函数)。
  private readonly canon?: CanonScript;
  private readonly backend?: SessionBackend;

  // 重载式构造：
  //  · new FakeDiceGm(script)                — 纯叙事档(向后兼容 server.ts 与既有单测)。
  //  · new FakeDiceGm({ canon, backend })    — 教练档：驱动 roll/choice/game_end 五条主线。
  constructor(arg: Script | { canon: CanonScript; backend: SessionBackend }) {
    if (Array.isArray(arg) || typeof arg === "function") {
      this.script = arg;
    } else {
      this.canon = arg.canon;
      this.backend = arg.backend;
    }
  }

  async *runTurn(input: TurnInput): AsyncIterable<TurnEvent> {
    // ── 教练档：执行 canon 动作 ──────────────────────────────────────────
    if (this.canon) {
      const backend = this.backend!;
      const actions = typeof this.canon === "function" ? this.canon(input) : this.canon;
      for (const a of actions) {
        switch (a.type) {
          case "narration":
            yield { type: "narration", text: a.text };
            break;
          case "error":
            yield { type: "error", message: a.message, code: a.code };
            return;
          case "roll": {
            // 暂存待掷 → await rollGate(eventId) → commitPendingRoll(落 verdict)。完全复刻 core
            // resolve_outcome_open 的明骰 flow(outcomeHandler：stage → await gate → commit)。
            // 生产路径：DiceSession 注入 PlayerRollGate.gate → 广播 roll_staged + 挂起等 POST /roll,
            // 玩家点掷(resolveRoll 解开 waiter)后本 handler 续跑 commit;debug/裸 CC 无 gate → 立即掷(降级)。
            // bands 须全覆盖骰面(commitPendingRoll 用 resolveOutcome/rangeMap 校验),缺省给 1d100 二档全覆盖表。
            const eventId = backend.stagePendingRoll({
              shape: "outcome",
              spec: { context: a.context, die: a.die ?? "1d100", bands: a.bands ?? [
                { label: "失败", min: 1, max: 50 },
                { label: "成功", min: 51, max: 100 },
              ] },
            });
            const gate = getRollGate();
            if (gate) await gate(eventId); // 挂起直到玩家点掷(POST /roll → resolveRoll)
            backend.commitPendingRoll(eventId); // 点掷(或无 gate 降级)后提交:掷 + 落 kind=verdict + 槽 committed
            break;
          }
          case "hiddenRoll": {
            // 暗骰：引擎就地掷 + 落 kind=verdict event(复刻 core resolve_outcome_hidden 的 outcomeHandler)。
            // 不经 gate、不挂起——结果 event visible=0(对玩家隐,未披露暗值)。玩家不参与掷。
            const die = a.die ?? "1d100";
            const bands = a.bands ?? [
              { label: "失败", min: 1, max: 50, consequence: "事与愿违" },
              { label: "成功", min: 51, max: 100, consequence: "如你所愿" },
            ];
            const r = resolveOutcome(die, bands);
            backend.logAppend({
              kind: "verdict",
              content: a.context,
              data_json: { context: a.context, die: r.die, roll: r.roll, band: r.band },
              visible: 0,
            });
            break;
          }
          case "choice":
            // 落一条已物化的 kind=choice event。DiceSession.turnEnd 经 buildPresentationModel
            // 读到 pendingChoice → turnLoop 广播 choices(下一回合 POST /choices 闭环)。
            backend.logAppend({ content: a.prompt, kind: "choice", data_json: { prompt: a.prompt, options: a.options }, visible: 1 });
            break;
          case "gameEnd": {
            // 落 game_end note + 写 ended 元。reason/outcome 由 DiceSession.enrich 从 session_meta 取出。
            const seq = backend.logAppend({ kind: "note", data_json: { reason: a.reason, outcome: a.outcome }, visible: 0 });
            backend.metaSet("ended", JSON.stringify({ reason: a.reason, outcome: a.outcome, seq }));
            break;
          }
          default:
            break;
        }
      }
      yield { type: "turn_end" };
      return;
    }

    // ── 纯叙事档：原始流事件(向后兼容) ──────────────────────────────────
    const events = typeof this.script === "function" ? this.script(input) : (this.script ?? []);
    for (const e of events) yield e;
  }
}
