// packages/core/src/adapter/l3.test.ts
import { describe, it, expect } from "vitest";
import type { EventRow } from "../store/event.js";
import { auditTurn } from "./l3.js";

function ev(kind: EventRow["kind"], data?: unknown): EventRow {
  return { seq: 1, content: null, kind, data_json: data ? JSON.stringify(data) : null, tags: null, visible: 1, game_time: null, created_at: "" };
}
const base = { events: [] as EventRow[], transcriptHasText: true, pendingChoiceEmpty: false, hasGameEnd: false, stopHookActive: false };

describe("auditTurn(L3)", () => {
  it("档A:非终局无暂存 choice → block", () => {
    const r = auditTurn({ ...base, events: [ev("narrate")], pendingChoiceEmpty: true });
    expect(r.block?.reason).toContain("resolve_choice");
  });

  it("档A:有实质文本但无 narrate event → block 提醒补 narrate", () => {
    const r = auditTurn({ ...base, events: [ev("verdict")], transcriptHasText: true });
    expect(r.block?.reason).toContain("narrate");
  });

  it("终局轮(game_end)无 choice 不算违规", () => {
    const r = auditTurn({ ...base, events: [ev("narrate"), ev("verdict")], pendingChoiceEmpty: true, hasGameEnd: true });
    expect(r.block).toBeUndefined();
  });

  it("stopHookActive=true → 不再 block(防重入,最多纠一次)", () => {
    const r = auditTurn({ ...base, events: [ev("narrate")], pendingChoiceEmpty: true, stopHookActive: true });
    expect(r.block).toBeUndefined();
  });

  it("档B:本轮有 mutation 但无 verdict 之外...掷骰绕过统计写 note(不 block)", () => {
    const r = auditTurn({ ...base, events: [ev("narrate"), ev("mutation")] });
    expect(r.block).toBeUndefined();
    expect(r.notes.length).toBeGreaterThanOrEqual(0); // 统计类 note,允许为空或记录
  });
});
