// src/mcp/handlers/io.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../../store/db.js";
import { sheetSetRaw, sheetGet } from "../../store/sheet.js";
import { worldDocUpsert } from "../../store/world.js";
import { eventSince } from "../../store/event.js";
import { metaGet } from "../../session/resolve.js";
import { ioTools } from "./io.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
const byName = (n: string) => ioTools.find((t) => t.name === n)!;

describe("io handlers", () => {
  it("sheet_show(attrs):翻 visible=1 + 落审计 note", () => {
    const db = freshDb();
    sheetSetRaw(db, "张三", "秘密", "卧底", 0);
    const out = byName("sheet_show").handler(db, { entity: "张三", attrs: ["秘密"] });
    expect(out.ok).toBe(true);
    expect(out.shown).toEqual(["秘密"]);
    expect(sheetGet(db, "张三", "秘密")?.visible).toBe(1);
    expect(eventSince(db, 0).some((e) => e.kind === "note")).toBe(true);
  });

  it("world_show(doc):按名解析 rowid 翻 visible", () => {
    const db = freshDb();
    const rowid = worldDocUpsert(db, { name: "密道", content: "通往地窖", visible: 0 });
    const out = byName("world_show").handler(db, { doc: "密道" });
    expect(out.ok).toBe(true);
    const row = db.prepare("SELECT visible FROM world_doc WHERE rowid=?").get(rowid) as { visible: number };
    expect(row.visible).toBe(1);
  });

  it("reveal_once(sheet):append kind=reveal 可见 event", () => {
    const db = freshDb();
    sheetSetRaw(db, "门", "状态", "上锁", 0);
    const out = byName("reveal_once").handler(db, { sheet: { entity: "门", attr: "状态" } });
    expect(typeof out.event_id).toBe("number");
    const reveals = eventSince(db, 0).filter((e) => e.kind === "reveal");
    expect(reveals).toHaveLength(1);
    expect(reveals[0].visible).toBe(1);
    expect(sheetGet(db, "门", "状态")?.visible).toBe(0); // 不碰底层 visible
  });

  it("narrate:落 kind=narrate visible=1 event", () => {
    const db = freshDb();
    const out = byName("narrate").handler(db, { text: "暮色漫过城墙", tags: ["黄昏"] });
    expect(typeof out.event_id).toBe("number");
    const evs = eventSince(db, 0).filter((e) => e.kind === "narrate");
    expect(evs).toHaveLength(1);
    expect(evs[0].visible).toBe(1);
  });

  it("game_end:写 meta ended + 落 note,出参 {ended,event_id}", () => {
    const db = freshDb();
    const out = byName("game_end").handler(db, { reason: "队伍全灭", outcome: "团灭结局" });
    expect(out.ended).toBe(true);
    expect(typeof out.event_id).toBe("number");
    const meta = JSON.parse(metaGet(db, "ended")!);
    expect(meta.reason).toBe("队伍全灭");
    expect(meta.seq).toBe(out.event_id);
    expect(eventSince(db, 0).filter((e) => e.kind === "note")).toHaveLength(1);
  });
});
