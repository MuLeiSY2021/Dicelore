// src/mcp/handlers/resolver.ts
import type { DB } from "../../store/db.js";
import { stagePendingChoice } from "../../store/choice.js";
import { resolveOutcome } from "../../resolve/outcome.js";
import { resolveContest } from "../../resolve/contest.js";
import { eventAppend } from "../../store/event.js";
import { stagePendingRoll } from "../../store/pendingRoll.js";
import { commitPendingRoll } from "../../resolve/commitRoll.js";
import { getRollGate } from "../rollGate.js";
import { DiceloreError } from "../../errors.js";
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

function choiceHandler(db: DB, input: { prompt: string; options: { label: string; consequence: string }[] }) {
  stagePendingChoice(db, input.prompt, input.options);
  return { staged: true as const, options: input.options };
}

function outcomeHandler(db: DB, input: { context: string; die: string; bands: any[] }) {
  const r = resolveOutcome(input.die, input.bands);
  const event_id = eventAppend(db, {
    kind: "verdict",
    content: input.context,
    data_json: { context: input.context, die: r.die, roll: r.roll, band: r.band },
  });
  return { roll: r.roll, die: r.die, band: { label: r.band.label, consequence: r.band.consequence ?? "" }, event_id };
}

function contestHandler(db: DB, input: { context: string; a: any; b: any }) {
  const r = resolveContest(db, input.a, input.b);
  const rolls = (s: typeof r.a) => s.ledger.terms.flatMap((t) => t.rolls ?? []);
  const event_id = eventAppend(db, {
    kind: "verdict",
    content: input.context,
    data_json: { context: input.context, a: r.a, b: r.b, winner: r.winner },
  });
  return {
    a: { name: r.a.name, total: r.a.ledger.total, rolls: rolls(r.a) },
    b: { name: r.b.name, total: r.b.ledger.total, rolls: rolls(r.b) },
    winner: r.winner,
    event_id,
  };
}

async function outcomeOpenHandler(db: DB, input: { context: string; die: string; bands: any[] }) {
  const eventId = stagePendingRoll(db, { shape: "outcome", spec: { context: input.context, die: input.die, bands: input.bands } });
  const gate = getRollGate();
  if (gate) await gate(eventId); // 组件7:通知前端待掷 + await 玩家点击;裸 CC 无 gate → 直接降级立即掷
  const r = commitPendingRoll(db, eventId);
  if (r.shape !== "outcome") throw new DiceloreError("INTERNAL", "commitPendingRoll shape 不符");
  return { awaiting: "player_roll" as const, roll: r.roll, die: r.die, band: r.band, event_id: r.verdictSeq };
}

async function contestOpenHandler(db: DB, input: { context: string; a: any; b: any }) {
  const eventId = stagePendingRoll(db, { shape: "contest", spec: { context: input.context, a: input.a, b: input.b } });
  const gate = getRollGate();
  if (gate) await gate(eventId);
  const r = commitPendingRoll(db, eventId);
  if (r.shape !== "contest") throw new DiceloreError("INTERNAL", "commitPendingRoll shape 不符");
  return { awaiting: "player_roll" as const, a: r.a, b: r.b, winner: r.winner, event_id: r.verdictSeq };
}

export const resolverTools: ToolDef[] = [
  {
    name: "resolve_choice",
    title: "暂存玩家选择",
    description:
      "暂存「下轮选项 + 后果」供回合末物化。Args: prompt(情境问句)、options(≥2 项,各含 label/consequence,后果必填=声明在先)。" +
      "Returns: {staged:true, options}(不含 event_id,回合末才落)。use: 需要玩家在分支处抉择时。don't: 用它代替随机裁决(那用 resolve_outcome_hidden)。" +
      "错误: 入参非法→INTERNAL。",
    inputSchema: resolveChoiceIn,
    outputSchema: resolveChoiceOut,
    annotations: anns(true),
    handler: choiceHandler,
  },
  {
    name: "resolve_outcome_hidden",
    title: "选项骰裁决",
    description:
      "【暗骰·引擎自动掷】掷单骰串并按档位表命中一档。Args: context(裁决什么)、die(单骰串如 \"1d100\")、bands(≥1 档,闭区间 min/max + consequence,引擎校验不重叠/全覆盖)。" +
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
