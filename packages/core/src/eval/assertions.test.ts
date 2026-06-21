// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import type { EventRow } from "../store/event.js";
import { narrateLeak, missingNarrate, toolStats } from "./assertions.js";

function ev(kind: EventRow["kind"], content: string, data?: unknown): EventRow {
  return {
    seq: 0, content, kind,
    data_json: data ? JSON.stringify(data) : null,
    tags: null, visible: 1, game_time: null, created_at: "",
  };
}

describe("narrateLeak（正文复述 narrate = 浪费 token）", () => {
  it("正文逐字复述 narrate → leak=true、overlap 高", () => {
    const prose = "雨下了三天，没停的意思。你坐在断锚酒馆最里的桌子。";
    const r = narrateLeak({ assistantText: prose, narrateTexts: [prose] });
    expect(r.leak).toBe(true);
    expect(r.overlap).toBeGreaterThan(0.8);
  });

  it("正文为空（散文只进 narrate）→ leak=false", () => {
    const r = narrateLeak({ assistantText: "", narrateTexts: ["雨下了三天，没停的意思。你坐在断锚酒馆。"] });
    expect(r.leak).toBe(false);
    expect(r.assistantProse).toBe(0);
  });

  it("正文只有简短工具编排话（不复述剧情）→ leak=false", () => {
    const r = narrateLeak({
      assistantText: "好的，我来裁决这次说服。",
      narrateTexts: ["雨下了三天，没停的意思。你坐在断锚酒馆最里的那张桌子，后背贴着潮冷石墙。"],
    });
    expect(r.leak).toBe(false);
  });
});

describe("missingNarrate（漏 narrate）", () => {
  it("正文有实质剧情但本轮无 narrate event → true", () => {
    expect(missingNarrate({ assistantText: "你推开门，一股血腥味扑面而来，三个哥布林围着篝火。", narrateCount: 0 })).toBe(true);
  });
  it("有 narrate event → false", () => {
    expect(missingNarrate({ assistantText: "你推开门……", narrateCount: 1 })).toBe(false);
  });
  it("正文空白 + 无 narrate（纯工具轮）→ false（不算漏）", () => {
    expect(missingNarrate({ assistantText: "  ", narrateCount: 0 })).toBe(false);
  });
});

describe("toolStats（工具使用画像，供报告 + grader）", () => {
  it("按 kind 计数 + 明暗骰区分（verdict.data_json.gated）", () => {
    const events: EventRow[] = [
      ev("narrate", "x"),
      ev("verdict", "命中", { gated: true }),   // 明骰
      ev("verdict", "暗检定", { gated: false }), // 暗骰
      ev("choice", "怎么走", { options: [] }),
      ev("mutation", "掉血"),
    ];
    const s = toolStats(events);
    expect(s.narrate).toBe(1);
    expect(s.choice).toBe(1);
    expect(s.mutation).toBe(1);
    expect(s.verdictGated).toBe(1);   // 明骰
    expect(s.verdictAuto).toBe(1);    // 暗骰
  });
});
