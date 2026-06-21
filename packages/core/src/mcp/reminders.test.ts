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
