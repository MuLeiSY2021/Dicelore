import { describe, it, expect } from "vitest";
import { PresentationSnapshotSchema, CLIENT_PROTOCOL } from "./index.js";

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
});
