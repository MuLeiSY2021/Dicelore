// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../store/db.js";
import { logSince } from "../store/event/record.js";
import { stateSet } from "../store/sheet/state.js";
import { stagePendingRoll, getPendingRoll } from "../store/interaction/pendingRoll.js";
import { commitPendingRoll } from "./commitRoll.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };

describe("commitPendingRoll", () => {
  it("outcome:点击时掷 + 写 verdict + 命中档 + 槽 committed;RT-FE5 命中档 plan 落 verdict + 出参", () => {
    const db = freshDb();
    const id = stagePendingRoll(db, { shape: "outcome", spec: { context: "打听", die: "1d20", bands: [
      { label: "碰壁", min: 1, max: 10, plan: "线索断绝", narration: "对方摇头" },
      { label: "顺", min: 11, max: 20, plan: "拿到关键地址", narration: "对方压低声音" },
    ] } });
    const r = commitPendingRoll(db, id, seq([0.99])); // floor(0.99*20)+1=20 → 顺
    expect(r.shape).toBe("outcome");
    if (r.shape === "outcome") {
      expect(r.roll).toBe(20); expect(r.band.label).toBe("顺");
      // 出参 consequence 携带命中档 plan(真相层·机械驱动源),非 narration。
      expect(r.band.consequence).toBe("拿到关键地址");
    }
    const verdicts = logSince(db, 0).filter((e) => e.kind === "verdict");
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].visible).toBe(1);
    // verdict data_json 存整档(含 plan+narration),供机械层据命中档 plan 驱动。
    const d = JSON.parse(verdicts[0].data_json!);
    expect(d.band.plan).toBe("拿到关键地址");
    expect(d.band.narration).toBe("对方压低声音");
    expect(getPendingRoll(db, id)?.status).toBe("committed");
  });

  it("contest:取真值比大小 + winner + 写 verdict", () => {
    const db = freshDb();
    stateSet(db, "你", "说服", "5");
    const id = stagePendingRoll(db, { shape: "contest", spec: { context: "压价", a: { name: "你", expr: "1d20+{你.说服}" }, b: { name: "罗纳", expr: "15" } } });
    const r = commitPendingRoll(db, id, seq([0.95])); // a: floor(0.95*20)+1=20 +5=25 vs b 15 → a 胜
    expect(r.shape).toBe("contest");
    if (r.shape === "contest") { expect(r.winner).toBe("a"); expect(r.a.total).toBe(25); }
    expect(logSince(db, 0).filter((e) => e.kind === "verdict")).toHaveLength(1);
  });

  it("幂等:已 committed 再调不重掷,据 verdict event 重建同结果", () => {
    const db = freshDb();
    const id = stagePendingRoll(db, { shape: "outcome", spec: { context: "x", die: "1d20", bands: [
      { label: "a", min: 1, max: 20, plan: "p", narration: "n" },
    ] } });
    const r1 = commitPendingRoll(db, id, seq([0.1]));
    const r2 = commitPendingRoll(db, id, seq([0.9])); // 不同 rng,但应返回 r1 的结果
    expect(r2).toEqual(r1);
    expect(logSince(db, 0).filter((e) => e.kind === "verdict")).toHaveLength(1); // 只一条
  });
});
