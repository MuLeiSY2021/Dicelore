// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { TOOLS } from "./tools.js";

describe("TOOLS 注册表", () => {
  it("囊括全部 21 个工具,名字唯一", () => {
    const names = TOOLS.map((t) => t.name);
    expect(names).toHaveLength(21);
    expect(new Set(names).size).toBe(21);
    for (const n of [
      "resolve_choice", "resolve_outcome_hidden", "resolve_contest_hidden",
      "resolve_outcome_open", "resolve_contest_open",
      "sheet_get", "sheet_list", "sheet_update",
      "event_append", "event_recall", "watcher_set", "watcher_list",
      "world_search", "world_sample", "world_register", "rule_search",
      "sheet_show", "world_show", "reveal_once", "narrate", "game_end",
    ]) {
      expect(names).toContain(n);
    }
  });

  it("每个工具 description 含五段要素的关键词(功能/Args/Returns/use/错误)", () => {
    for (const t of TOOLS) {
      expect(t.description).toContain("Args");
      expect(t.description).toContain("Returns");
      expect(t.description).toContain("错误");
    }
  });

  it("annotations.openWorldHint 全 false;唯一 destructive 是 game_end", () => {
    expect(TOOLS.every((t) => t.annotations.openWorldHint === false)).toBe(true);
    const destructive = TOOLS.filter((t) => t.annotations.destructiveHint).map((t) => t.name);
    expect(destructive).toEqual(["game_end"]);
  });
});
