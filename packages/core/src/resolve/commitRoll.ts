import type { DB } from "../store/db.js";
import type { Rng } from "../dice/index.js";
import { eventAppend, eventSince } from "../store/event.js";
import { getPendingRoll, markRollCommitted } from "../store/pendingRoll.js";
import { resolveOutcome } from "./outcome.js";
import { resolveContest } from "./contest.js";
import { DiceloreError } from "../errors.js";

export type RollResult =
  | { eventId: number; shape: "outcome"; verdictSeq: number; roll: number; die: string; band: { label: string; consequence: string } }
  | { eventId: number; shape: "contest"; verdictSeq: number; a: { name: string; total: number; rolls: number[] }; b: { name: string; total: number; rolls: number[] }; winner: "a" | "b" | "tie" };

// 点击时掷:读规格 → 复用 resolveOutcome/resolveContest 掷 → 写 kind=verdict → 槽 committed → 返回。
// 幂等:已 committed 据 verdict event 重建(宕机恢复/重投不重掷)。
export function commitPendingRoll(db: DB, eventId: number, rng?: Rng): RollResult {
  const pr = getPendingRoll(db, eventId);
  if (!pr) throw new DiceloreError("ENTITY_NOT_FOUND", `commitPendingRoll: pending_roll#${eventId} 不存在`);
  if (pr.status === "committed" && pr.verdictSeq !== null) return rebuild(db, eventId, pr.shape, pr.verdictSeq);

  const spec = pr.spec as any;
  if (pr.shape === "outcome") {
    const r = resolveOutcome(spec.die, spec.bands, rng);
    const verdictSeq = eventAppend(db, {
      kind: "verdict", visible: 1, content: spec.context,
      data_json: { context: spec.context, die: r.die, roll: r.roll, band: r.band, gated: true },
    });
    markRollCommitted(db, eventId, verdictSeq);
    return { eventId, shape: "outcome", verdictSeq, roll: r.roll, die: r.die, band: { label: r.band.label, consequence: r.band.consequence ?? "" } };
  } else {
    const r = resolveContest(db, spec.a, spec.b, rng);
    const rolls = (s: typeof r.a) => s.ledger.terms.flatMap((t) => t.rolls ?? []);
    const a = { name: r.a.name, total: r.a.ledger.total, rolls: rolls(r.a) };
    const b = { name: r.b.name, total: r.b.ledger.total, rolls: rolls(r.b) };
    const verdictSeq = eventAppend(db, {
      kind: "verdict", visible: 1, content: spec.context,
      data_json: { context: spec.context, a: r.a, b: r.b, winner: r.winner, gated: true },
    });
    markRollCommitted(db, eventId, verdictSeq);
    return { eventId, shape: "contest", verdictSeq, a, b, winner: r.winner };
  }
}

// 据已落 verdict event 重建 RollResult(幂等路)。
function rebuild(db: DB, eventId: number, shape: "outcome" | "contest", verdictSeq: number): RollResult {
  const ev = eventSince(db, verdictSeq - 1).find((e) => e.seq === verdictSeq);
  if (!ev || !ev.data_json) throw new DiceloreError("ENTITY_NOT_FOUND", `commitPendingRoll: verdict#${verdictSeq} 缺失`);
  const d = JSON.parse(ev.data_json);
  if (shape === "outcome") {
    return { eventId, shape: "outcome", verdictSeq, roll: d.roll, die: d.die, band: { label: d.band.label, consequence: d.band.consequence ?? "" } };
  }
  const rolls = (s: any) => (s.ledger?.terms ?? []).flatMap((t: any) => t.rolls ?? []);
  return {
    eventId, shape: "contest", verdictSeq,
    a: { name: d.a.name, total: d.a.ledger.total, rolls: rolls(d.a) },
    b: { name: d.b.name, total: d.b.ledger.total, rolls: rolls(d.b) },
    winner: d.winner,
  };
}
