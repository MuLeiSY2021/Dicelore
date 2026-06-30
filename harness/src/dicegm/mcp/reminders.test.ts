// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { remindersFor } from "./reminders.js";

describe("remindersFor", () => {
  it("resolve_choice 恒提醒后果已锁", () => {
    expect(remindersFor("resolve_choice", { staged: true }, {})).toEqual(["后续叙述须与已锁后果一致"]);
  });
  it("resolve_outcome_hidden 命中最低档才提醒(按 out.roll 反查 input.bands)", () => {
    // 真实 handler 出参:band 被裁成 {label,consequence}(无 min),靠 out.roll 反查命中档。
    const input = { bands: [{ label: "败", min: 1, max: 50 }, { label: "成", min: 51, max: 100 }] };
    const lowHit = { roll: 30, band: { label: "败", consequence: "x" } };
    const highHit = { roll: 80, band: { label: "成", consequence: "y" } };
    expect(remindersFor("resolve_outcome_hidden", lowHit, input)).toEqual(["尊重结果,别软着陆"]);
    expect(remindersFor("resolve_outcome_hidden", highHit, input)).toEqual([]);
    // open 变体同口径
    expect(remindersFor("resolve_outcome_open", { awaiting: "player_roll", roll: 30 }, input)).toEqual(["尊重结果,别软着陆"]);
  });
  it("sheet_update 仅 fired_watchers 非空才提醒", () => {
    expect(remindersFor("sheet_update", { fired_watchers: [{ id: 1 }] }, {})).toEqual(["watcher 已触发,本轮即时反应"]);
    expect(remindersFor("sheet_update", { fired_watchers: [] }, {})).toEqual([]);
  });
  it("resolve_contest_hidden / narrate / 未知工具 → []", () => {
    expect(remindersFor("resolve_contest_hidden", {}, {})).toEqual([]);
    expect(remindersFor("narrate", {}, {})).toEqual([]);
    expect(remindersFor("sheet_get", {}, {})).toEqual([]);
  });
});
