// src/mcp/handlers/resolver.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../../store/db.js";
import { sheetSetRaw } from "../../store/sheet.js";
import { eventSince } from "../../store/event.js";
import { getPendingChoice } from "../../store/choice.js";
import { resolverTools } from "./resolver.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
const byName = (n: string) => resolverTools.find((t) => t.name === n)!;

const opts = [
  { label: "进", consequence: "遇敌" },
  { label: "退", consequence: "失机" },
];

describe("resolver handlers", () => {
  it("resolve_choice:暂存、不落 event、出参 {staged,options}", () => {
    const db = freshDb();
    const out = byName("resolve_choice").handler(db, { prompt: "怎么走?", options: opts });
    expect(out).toEqual({ staged: true, options: opts });
    expect(getPendingChoice(db)?.prompt).toBe("怎么走?");
    expect(eventSince(db, 0)).toHaveLength(0); // 不落 event
  });

  it("resolve_outcome_hidden:掷骰命中档位 + 落 kind=verdict event", () => {
    const db = freshDb();
    const out = byName("resolve_outcome_hidden").handler(db, {
      context: "撬锁",
      die: "1d100",
      bands: [
        { label: "失败", min: 1, max: 50, consequence: "触发警报" },
        { label: "成功", min: 51, max: 100, consequence: "无声打开" },
      ],
    });
    expect(out.roll).toBeGreaterThanOrEqual(1);
    expect(out.roll).toBeLessThanOrEqual(100);
    expect(["失败", "成功"]).toContain(out.band.label);
    expect(typeof out.event_id).toBe("number");
    const verdicts = eventSince(db, 0).filter((e) => e.kind === "verdict");
    expect(verdicts).toHaveLength(1);
  });

  it("resolve_contest_hidden:取真值比大小 + 落 verdict;winner 正确", () => {
    const db = freshDb();
    sheetSetRaw(db, "张三", "力量", "18");
    const out = byName("resolve_contest_hidden").handler(db, {
      context: "掰手腕",
      a: { name: "张三", expr: "{张三.力量}" },
      b: { name: "DC", expr: "10" },
    });
    expect(out.winner).toBe("a");
    expect(out.a.total).toBe(18);
    expect(out.b.total).toBe(10);
    expect(typeof out.event_id).toBe("number");
    expect(eventSince(db, 0).filter((e) => e.kind === "verdict")).toHaveLength(1);
  });

  it("in schema .strict():多余字段报错", () => {
    expect(() => byName("resolve_choice").inputSchema.parse({ prompt: "p", options: opts, extra: 1 })).toThrow();
  });
});
