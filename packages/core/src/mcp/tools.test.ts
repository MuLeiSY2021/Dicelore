import { describe, it, expect } from "vitest";
import { TOOLS } from "./tools.js";

describe("TOOLS 注册表", () => {
  it("囊括全部 18 个工具,名字唯一", () => {
    const names = TOOLS.map((t) => t.name);
    expect(names).toHaveLength(18);
    expect(new Set(names).size).toBe(18);
    for (const n of [
      "resolve_choice", "resolve_outcome_hidden", "resolve_contest_hidden",
      "sheet_get", "sheet_list", "sheet_update",
      "event_append", "event_recall", "watcher_set",
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
