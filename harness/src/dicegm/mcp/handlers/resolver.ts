// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// src/mcp/handlers/resolver.ts
// ported ops(choice/contest/pendingRoll/commit/logAppend)经注入 SessionBackend 调用；
// resolveOutcome(纯函数·无 db)住中立叶包 @dicelore/dice(storage-port ADR §3 单骰串不进端口)。
import type { SessionBackend } from "@dicelore/interface";
import { resolveOutcome } from "@dicelore/dice";
import { getRollGate } from "../rollGate.js";
import { DiceloreError } from "@dicelore/errors";
import type { ToolDef } from "../tooldef.js";
import {
  resolveChoiceIn, resolveChoiceOut,
  resolveOutcomeIn, resolveOutcomeOut,
  resolveContestIn, resolveContestOut,
  resolveOutcomeOpenIn, resolveOutcomeOpenOut,
  resolveContestOpenIn, resolveContestOpenOut,
} from "../schemas/resolver.js";

const anns = (idempotent: boolean) => ({
  readOnlyHint: false, destructiveHint: false, idempotentHint: idempotent, openWorldHint: false,
});

// 命中档「真实后果文本」：RT-FE5 起 = plan(真相层·驱动机械);向后兼容旧单一 consequence。
function bandTruth(band: { plan?: string; consequence?: string }): string {
  return band.plan ?? band.consequence ?? "";
}

/** 内置裁决工具集（handler 闭包持注入的 SessionBackend）。 */
export function makeResolverTools(backend: SessionBackend): ToolDef[] {
  function choiceHandler(_: unknown, input: { prompt: string; options: { label: string; consequence: string }[] }) {
    backend.stagePendingChoice(input.prompt, input.options);
    return { staged: true as const, options: input.options };
  }

  function outcomeHandler(_: unknown, input: { context: string; die: string; bands: any[] }) {
    const r = resolveOutcome(input.die, input.bands);
    // data_json 存整档(含 plan+narration)——命中档 plan 是机械驱动源(RT-FE5 FE5-3)。
    // 暗骰:结果 event visible=0(对玩家隐、未披露暗值;stream 照发,前端按 spoiler 档渲染)。
    const event_id = backend.logAppend({
      kind: "verdict",
      content: input.context,
      visible: 0,
      data_json: { context: input.context, die: r.die, roll: r.roll, band: r.band },
    });
    // 出参 band.consequence = 命中档真实后果计划(plan);向后兼容旧单一 consequence 字段。context 供暗骰 WS emit。
    return { roll: r.roll, die: r.die, band: { label: r.band.label, consequence: bandTruth(r.band) }, event_id, context: input.context };
  }

  function contestHandler(_: unknown, input: { context: string; a: any; b: any }) {
    const r = backend.resolveContest(input.a, input.b);
    const rolls = (s: typeof r.a) => s.ledger.terms.flatMap((t) => t.rolls ?? []);
    // 暗骰:结果 event visible=0(对玩家隐;stream 照发,前端按 spoiler 档渲染)。
    const event_id = backend.logAppend({
      kind: "verdict",
      content: input.context,
      visible: 0,
      data_json: { context: input.context, a: r.a, b: r.b, winner: r.winner },
    });
    return {
      a: { name: r.a.name, total: r.a.ledger.total, rolls: rolls(r.a) },
      b: { name: r.b.name, total: r.b.ledger.total, rolls: rolls(r.b) },
      winner: r.winner,
      event_id,
      context: input.context,
    };
  }

  async function outcomeOpenHandler(_: unknown, input: { context: string; die: string; bands: any[] }) {
    const eventId = backend.stagePendingRoll({ shape: "outcome", spec: { context: input.context, die: input.die, bands: input.bands } });
    const gate = getRollGate();
    if (gate) await gate(eventId); // 组件7:通知前端待掷 + await 玩家点击;裸 CC 无 gate → 直接降级立即掷
    const r = backend.commitPendingRoll(eventId);
    if (r.shape !== "outcome") throw new DiceloreError("INTERNAL", "commitPendingRoll shape 不符");
    return { awaiting: "player_roll" as const, roll: r.roll, die: r.die, band: r.band, event_id: r.verdictSeq };
  }

  async function contestOpenHandler(_: unknown, input: { context: string; a: any; b: any }) {
    const eventId = backend.stagePendingRoll({ shape: "contest", spec: { context: input.context, a: input.a, b: input.b } });
    const gate = getRollGate();
    if (gate) await gate(eventId);
    const r = backend.commitPendingRoll(eventId);
    if (r.shape !== "contest") throw new DiceloreError("INTERNAL", "commitPendingRoll shape 不符");
    return { awaiting: "player_roll" as const, a: r.a, b: r.b, winner: r.winner, event_id: r.verdictSeq };
  }

  return [
  {
    name: "resolve_choice",
    title: "暂存玩家选择",
    description:
      "暂存「下轮选项 + 后果」供回合末物化。Args: prompt(情境问句)、options(≥2 项,各含 label/consequence,后果必填=声明在先)。" +
      "Returns: {staged:true, options}(不含 event_id,回合末才落)。use: 需要玩家在分支处抉择时。don't: 用它代替随机裁决(那用 resolve_outcome_hidden)。" +
      "错误: 入参非法→BAD_INPUT。",
    inputSchema: resolveChoiceIn,
    outputSchema: resolveChoiceOut,
    annotations: anns(true),
    handler: choiceHandler,
  },
  {
    name: "resolve_outcome_hidden",
    title: "选项骰裁决",
    description:
      "【暗骰·引擎自动掷】掷单骰串并按档位表命中一档。Args: context(裁决什么)、die(单骰串如 \"1d100\")、bands(≥1 档,闭区间 min/max + plan(真实后果计划·驱动机械·可含暗值/剧透) + narration(玩家可见叙述·可留白),引擎校验不重叠/全覆盖)。" +
      "Returns: {roll, die, band:{label,consequence}, event_id}。use: 成败带随机度的行动。don't: 对抗双方各有加值(那用 resolve_contest_hidden)。" +
      "错误: die 非单骰串→DIE_INVALID;档位重叠/落空→RANGE_INVALID。",
    inputSchema: resolveOutcomeIn,
    outputSchema: resolveOutcomeOut,
    annotations: anns(false),
    handler: outcomeHandler,
  },
  {
    name: "resolve_contest_hidden",
    title: "对抗骰裁决",
    description:
      "【暗骰·引擎自动掷】两边各按 expr 求值(骰+引用+常数)比大小。Args: context、a/b(各 {name, expr},DC=一边退化成常数 expr 如 \"15\")。" +
      "Returns: {a:{name,total,rolls}, b:{...}, winner:\"a\"|\"b\"|\"tie\", event_id}。use: 双方对抗。don't: 单方成败(用 resolve_outcome_hidden)。" +
      "错误: expr 文法非法→EXPR_EVAL;引用不存在→ENTITY_NOT_FOUND;引用非数值→NOT_NUMERIC。",
    inputSchema: resolveContestIn,
    outputSchema: resolveContestOut,
    annotations: anns(false),
    handler: contestHandler,
  },
  {
    name: "resolve_outcome_open",
    title: "明骰·选项骰(玩家闸控)",
    description:
      "【明骰·玩家点击掷、亮 DC】阻塞式玩家闸控掷。Args: 同 resolve_outcome_hidden(context/die/bands)。" +
      "Returns: 暂存待掷→玩家在客户端点击→引擎此刻掷→回合内返回 {awaiting:\"player_roll\", roll, die, band, event_id}。" +
      "use: 玩家主动行动的检定(交还掷骰动作 + 参与感)。don't: NPC/世界/暗检定(那用 resolve_outcome_hidden)。点数恒引擎算(anti-F1);裸 CC 无客户端时降级为立即掷。" +
      "错误: die 非单骰串→DIE_INVALID;档位重叠/落空→RANGE_INVALID。",
    inputSchema: resolveOutcomeOpenIn,
    outputSchema: resolveOutcomeOpenOut,
    annotations: anns(false),
    handler: outcomeOpenHandler,
  },
  {
    name: "resolve_contest_open",
    title: "明骰·对抗骰(玩家闸控)",
    description:
      "【明骰·玩家点击掷、亮 DC】阻塞式玩家闸控对抗。Args: 同 resolve_contest_hidden(context/a/b,DC=一边常数 expr)。" +
      "Returns: 暂存待掷→玩家点击→引擎此刻取真值+掷+比大小→回合内返回 {awaiting:\"player_roll\", a, b, winner, event_id}。" +
      "use: 玩家主动行动的对抗/检定。don't: NPC/世界/暗检定(那用 resolve_contest_hidden)。点数恒引擎算(anti-F1);裸 CC 降级立即掷。" +
      "错误: expr 文法非法→EXPR_EVAL;引用不存在→ENTITY_NOT_FOUND;引用非数值→NOT_NUMERIC。",
    inputSchema: resolveContestOpenIn,
    outputSchema: resolveContestOpenOut,
    annotations: anns(false),
    handler: contestOpenHandler,
  },
  ];
}
