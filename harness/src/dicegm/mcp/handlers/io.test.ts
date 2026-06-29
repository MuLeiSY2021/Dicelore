// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// src/mcp/handlers/io.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema, openSessionBackend } from "@dicelore/backend";
import { stateGet, stateSet } from "@dicelore/backend";
import { loreUpsert } from "@dicelore/backend";
import { logSince } from "@dicelore/backend";
import { metaGet } from "@dicelore/backend";
import { makeIoTools } from "./io.js";
import { DiceloreError } from "@dicelore/errors";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
// 内置工具 handler 经注入 SessionBackend 调存储——按 db 造工具、handler 忽略传入的 db 形参。
const byName = (db: any, n: string) => makeIoTools(openSessionBackend(db)).find((t) => t.name === n)!;

describe("io handlers", () => {
  it("sheet_show(attrs):翻 visible=1 + 落审计 note + 出参含 audit_event_id", () => {
    const db = freshDb();
    stateSet(db, "张三", "秘密", "卧底", 0);
    const out = byName(db, "sheet_show").handler(db, { entity: "张三", attrs: ["秘密"] });
    expect(out.ok).toBe(true);
    expect(out.shown).toEqual(["秘密"]);
    expect(stateGet(db, "张三", "秘密")?.visible).toBe(1);
    const notes = logSince(db, 0).filter((e) => e.kind === "note");
    expect(notes).toHaveLength(1);
    expect(typeof out.audit_event_id).toBe("number");
    expect(out.audit_event_id).toBe(notes[0].seq);
  });

  it("sheet_show(recursive):翻 __show_all + 出参含 audit_event_id", () => {
    const db = freshDb();
    const out = byName(db, "sheet_show").handler(db, { entity: "李四", recursive: true });
    expect(out.ok).toBe(true);
    expect(out.shown).toEqual(["__show_all"]);
    const notes = logSince(db, 0).filter((e) => e.kind === "note");
    expect(notes).toHaveLength(1);
    expect(typeof out.audit_event_id).toBe("number");
    expect(out.audit_event_id).toBe(notes[0].seq);
  });

  it("world_show(doc):按名解析 rowid 翻 visible + 出参含 audit_event_id", () => {
    const db = freshDb();
    const rowid = loreUpsert(db, { name: "密道", content: "通往地窖", visible: 0 });
    const out = byName(db, "world_show").handler(db, { doc: "密道" });
    expect(out.ok).toBe(true);
    const row = db.prepare("SELECT visible FROM lore WHERE rowid=?").get(rowid) as { visible: number };
    expect(row.visible).toBe(1);
    const notes = logSince(db, 0).filter((e) => e.kind === "note");
    expect(notes).toHaveLength(1);
    expect(typeof out.audit_event_id).toBe("number");
    expect(out.audit_event_id).toBe(notes[0].seq);
  });

  it("world_show(pool_rowid):按 rowid 翻 visible + 出参含 audit_event_id", () => {
    const db = freshDb();
    const out = byName(db, "world_show").handler(db, { pool_rowid: 1 });
    expect(out.ok).toBe(true);
    const notes = logSince(db, 0).filter((e) => e.kind === "note");
    expect(notes).toHaveLength(1);
    expect(typeof out.audit_event_id).toBe("number");
    expect(out.audit_event_id).toBe(notes[0].seq);
  });

  it("reveal_once(sheet):append kind=reveal 可见 event", () => {
    const db = freshDb();
    stateSet(db, "门", "状态", "上锁", 0);
    const out = byName(db, "reveal_once").handler(db, { sheet: { entity: "门", attr: "状态" } });
    expect(typeof out.event_id).toBe("number");
    const reveals = logSince(db, 0).filter((e) => e.kind === "reveal");
    expect(reveals).toHaveLength(1);
    expect(reveals[0].visible).toBe(1);
    expect(stateGet(db, "门", "状态")?.visible).toBe(0); // 不碰底层 visible
  });

  it("narrate:落 kind=narrate visible=1 event", () => {
    const db = freshDb();
    const out = byName(db, "narrate").handler(db, { text: "暮色漫过城墙", tags: ["黄昏"] });
    expect(typeof out.event_id).toBe("number");
    const evs = logSince(db, 0).filter((e) => e.kind === "narrate");
    expect(evs).toHaveLength(1);
    expect(evs[0].visible).toBe(1);
  });

  it("game_end:写 meta ended + 落 note,出参 {ended,event_id}", () => {
    const db = freshDb();
    const out = byName(db, "game_end").handler(db, { reason: "队伍全灭", outcome: "团灭结局" });
    expect(out.ended).toBe(true);
    expect(typeof out.event_id).toBe("number");
    const meta = JSON.parse(metaGet(db, "ended")!);
    expect(meta.reason).toBe("队伍全灭");
    expect(meta.seq).toBe(out.event_id);
    expect(logSince(db, 0).filter((e) => e.kind === "note")).toHaveLength(1);
  });

  it("下沉校验:形状违例抛 DiceloreError(原 schema refine)", () => {
    const db = freshDb();
    // sheet_show 既无 attrs 又非 recursive
    expect(() => byName(db, "sheet_show").handler(db, { entity: "张三", recursive: false })).toThrow(DiceloreError);
    // world_show doc/pool_rowid 非二选一(都不给)
    expect(() => byName(db, "world_show").handler(db, {})).toThrow(DiceloreError);
    // world_show doc 不存在 → NOT_FOUND
    expect(() => byName(db, "world_show").handler(db, { doc: "查无此条" })).toThrow(DiceloreError);
    // reveal_once sheet/world 非二选一(都给)
    expect(() => byName(db, "reveal_once").handler(db, {
      sheet: { entity: "门", attr: "状态" }, world: { rowid: 1 },
    })).toThrow(DiceloreError);
  });
});
