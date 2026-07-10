// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, expect, test, beforeEach } from "vitest";
import { openDb, initSchema, type DB } from "@dicelore/backend";
import { logAppend } from "@dicelore/backend";
import { historyList } from "@dicelore/backend";
import { memoryToolDecls, memoryStdlibTools } from "./memory.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  initSchema(db);
});

describe("记忆工具标准库声明（A′ §6）", () => {
  test("每条声明都能编译为 ToolDef（无坏 sql）", () => {
    const tools = memoryStdlibTools();
    expect(tools.length).toBe(memoryToolDecls.length);
    const names = memoryToolDecls.map((d) => d.name);
    for (const n of ["mark_moment", "history_compact", "recall"]) {
      expect(names).toContain(n);
    }
    for (const t of tools) {
      expect(typeof t.name).toBe("string");
      expect(typeof t.handler).toBe("function");
    }
  });

  test("mark_moment 经 handler 把 log 行标 is_moment=1（走正典 markMoment）", () => {
    const seq = logAppend(db, { content: "关键抉择", kind: "narrate" });
    const markMoment = memoryStdlibTools().find((t) => t.name === "mark_moment")!;
    markMoment.handler(db, { seq });
    const row = db.prepare("SELECT is_moment FROM log WHERE seq=?").get(seq) as { is_moment: number };
    expect(row.is_moment).toBe(1);
  });

  test("history_compact 经 handler 写一条 history 摘要（created_seq=当前最大 log seq）", () => {
    logAppend(db, { content: "一", kind: "narrate" });
    const last = logAppend(db, { content: "二", kind: "narrate" });
    const compact = memoryStdlibTools().find((t) => t.name === "history_compact")!;
    compact.handler(db, { seq_from: 1, seq_to: 2, summary: "第一幕:伏笔X已埋" });
    const list = historyList(db);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ seq_from: 1, seq_to: 2, summary: "第一幕:伏笔X已埋", created_seq: last });
  });

  test("recall 命中 history 摘要（先查 history）", () => {
    const compact = memoryStdlibTools().find((t) => t.name === "history_compact")!;
    logAppend(db, { content: "平淡开场", kind: "narrate" });
    compact.handler(db, { seq_from: 1, seq_to: 1, summary: "主角埋下伏笔X" });
    const recall = memoryStdlibTools().find((t) => t.name === "recall")!;
    const out = recall.handler(db, { query: "伏笔X" }) as { result: { src: string; text: string }[] };
    expect(Array.isArray(out.result)).toBe(true);
    expect(out.result.some((r) => r.src === "history" && r.text.includes("伏笔X"))).toBe(true);
  });

  test("recall 命中 moment，且 moment/history 排在普通 log 之前", () => {
    const markMoment = memoryStdlibTools().find((t) => t.name === "mark_moment")!;
    const recall = memoryStdlibTools().find((t) => t.name === "recall")!;
    logAppend(db, { content: "路人甲提到宝剑", kind: "narrate" }); // seq 1, 普通 log
    const s2 = logAppend(db, { content: "主角拔出宝剑立誓", kind: "narrate" }); // seq 2, moment
    markMoment.handler(db, { seq: s2 });
    const out = recall.handler(db, { query: "宝剑" }) as { result: { src: string; seq: number }[] };
    expect(out.result).toHaveLength(2);
    // moment(pri=1) 排在普通 log(pri=2) 之前
    expect(out.result[0].src).toBe("moment");
    expect(out.result[0].seq).toBe(s2);
    expect(out.result[1].src).toBe("log");
  });

  test("recall 无命中回空数组", () => {
    logAppend(db, { content: "无关内容", kind: "narrate" });
    const recall = memoryStdlibTools().find((t) => t.name === "recall")!;
    const out = recall.handler(db, { query: "不存在的词" }) as { result: unknown[] };
    expect(out.result).toEqual([]);
  });
});
