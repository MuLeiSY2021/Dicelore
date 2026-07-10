// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { PresentationSnapshotSchema, PresentationChangesSchema, PendingRollSchema, CLIENT_PROTOCOL } from "./index.js";

describe("PresentationSnapshotSchema", () => {
  it("接受接口页 §1 形状的全量快照", () => {
    const ok = {
      protocol: CLIENT_PROTOCOL,
      sessionId: "s1",
      seq: 1234,
      sheets: [{ entity: "张三", cells: [{ attr: "HP", value: "12", visible: 1 }] }],
      mechanics: [{ seq: 1230, kind: "mutation", text: "金钱 +3d100=74 → 77" }],
      choices: { eventId: 1234, options: [{ index: 0, label: "推门进去", consequence: "惊动守卫" }] },
      narrativeCursor: 1228,
    };
    expect(PresentationSnapshotSchema.parse(ok)).toMatchObject({ sessionId: "s1" });
  });

  it("choices 可为 null", () => {
    const snap = PresentationSnapshotSchema.parse({
      protocol: CLIENT_PROTOCOL, sessionId: "s1", seq: 0,
      sheets: [], mechanics: [], choices: null, narrativeCursor: 0,
    });
    expect(snap.choices).toBeNull();
  });

  it("拒绝错误的 protocol", () => {
    expect(() =>
      PresentationSnapshotSchema.parse({
        protocol: "wrong", sessionId: "s1", seq: 0,
        sheets: [], mechanics: [], choices: null, narrativeCursor: 0,
      }),
    ).toThrow();
  });

  it("PendingRoll 只含规格无结果；快照 pendingRoll 可省略", () => {
    const pr = PendingRollSchema.parse({
      eventId: 12, shape: "contest", label: "说服守卫",
      yourSide: { name: "张三", exprDisplay: "1d20+{说服}" }, dc: 15,
    });
    expect(pr.eventId).toBe(12);
    // 快照不带 pendingRoll 仍合法(nullish)
    const snap = PresentationSnapshotSchema.parse({
      protocol: CLIENT_PROTOCOL, sessionId: "s1", seq: 0,
      sheets: [], mechanics: [], choices: null, narrativeCursor: 0,
    });
    expect(snap.pendingRoll ?? null).toBeNull();
  });

  it("§7(A′) 接受叙事层字段 plotlines/foreshadows/lore", () => {
    const snap = PresentationSnapshotSchema.parse({
      protocol: CLIENT_PROTOCOL, sessionId: "s1", seq: 0,
      sheets: [], mechanics: [], choices: null, narrativeCursor: 0,
      plotlines: [{ id: "pl1", title: "追查", status: "active" }],
      foreshadows: [{ id: "fs1", content: "断剑", status: "recalled" }],
      lore: [{ name: "青云门", content: "正道大派" }],
    });
    expect(snap.plotlines).toHaveLength(1);
    expect(snap.foreshadows?.[0]?.id).toBe("fs1");
    expect(snap.lore?.[0]?.name).toBe("青云门");
    // 三字段可省略(旧客户端兼容)
    const bare = PresentationSnapshotSchema.parse({
      protocol: CLIENT_PROTOCOL, sessionId: "s1", seq: 0,
      sheets: [], mechanics: [], choices: null, narrativeCursor: 0,
    });
    expect(bare.plotlines).toBeUndefined();
  });
});

describe("PresentationChangesSchema §7(A′) 叙事增量", () => {
  it("接受 plotlines/foreshadows/lore 的 op=upsert/remove", () => {
    const c = PresentationChangesSchema.parse({
      plotlines: [{ id: "pl1", title: "追查", status: "active", op: "upsert" }],
      foreshadows: [{ id: "fs1", content: "断剑", status: "recalled", op: "upsert" }],
      lore: [{ name: "青云门", content: "正道大派", op: "remove" }],
    });
    expect(c.foreshadows?.[0]?.op).toBe("upsert");
    expect(c.lore?.[0]?.op).toBe("remove");
  });
});
