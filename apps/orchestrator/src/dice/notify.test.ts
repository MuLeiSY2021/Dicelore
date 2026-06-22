// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { mapCanonWrite } from "./notify.js";
import type { CanonWriteEvent } from "@dicelore/core";

describe("mapCanonWrite", () => {
  it("resolve_contest_open(明骰 verdict) → roll_committed", () => {
    const evt: CanonWriteEvent = {
      kind: "event", seq: 30, toolName: "resolve_contest_open",
      output: { awaiting: "player_roll", a: { name: "张三", total: 18, rolls: [18] }, b: { name: "DC", total: 15, rolls: [] }, winner: "a", event_id: 30 },
    };
    const msg = mapCanonWrite(evt);
    expect(msg?.type).toBe("roll_committed");
    if (msg?.type === "roll_committed") {
      expect(msg.eventId).toBe(30);
      expect(msg.total).toBe(18);
      expect(msg.outcome).toBe("success");
    }
  });

  it("resolve_outcome_open → roll_committed(band 名作 outcome)", () => {
    const evt: CanonWriteEvent = {
      kind: "event", seq: 40, toolName: "resolve_outcome_open",
      output: { roll: 55, die: "1d100", band: { label: "成功" }, event_id: 40 },
    };
    const msg = mapCanonWrite(evt);
    expect(msg?.type).toBe("roll_committed");
    if (msg?.type === "roll_committed") expect(msg.outcome).toBe("成功");
  });

  it("普通规范态写 → presentation_delta(带 seq)", () => {
    const evt: CanonWriteEvent = { kind: "mutation", seq: 12, toolName: "sheet_update", output: {} };
    const msg = mapCanonWrite(evt);
    expect(msg?.type).toBe("presentation_delta");
    if (msg?.type === "presentation_delta") expect(msg.delta.seq).toBe(12);
  });
});
