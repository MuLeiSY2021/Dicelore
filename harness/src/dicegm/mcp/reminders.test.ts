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
  it("resolve_outcome_hidden 命中最低档才提醒", () => {
    const input = { bands: [{ min: 1 }, { min: 51 }] };
    expect(remindersFor("resolve_outcome_hidden", { band: { min: 1 } }, input)).toEqual(["尊重结果,别软着陆"]);
    expect(remindersFor("resolve_outcome_hidden", { band: { min: 51 } }, input)).toEqual([]);
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
