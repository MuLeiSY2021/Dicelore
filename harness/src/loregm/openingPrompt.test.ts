// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ensureLorePlugin } from "./openingPrompt.js";

describe("ensureLorePlugin（母本物化到数据根 + build-core 对称 gm-core）", () => {
  it("母本存在时首调物化 + 返回 PluginRef(pluginDir=<root>/lore, skills:'all')", () => {
    const root = mkdtempSync(join(tmpdir(), "lore-plugin-"));
    try {
      const ref = ensureLorePlugin(root);
      // CI 下 harness/src/loregm 母本(.claude-plugin/plugin.json + skills/)必须存在
      expect(ref).not.toBeNull();
      expect(ref!.pluginDir).toBe(join(root, "lore"));
      expect(ref!.skills).toBe("all");
      expect(existsSync(join(ref!.pluginDir, ".claude-plugin", "plugin.json"))).toBe(true);
      // build-pack + build-core 两个 skill 都物化到位(skills:'all' 一并加载)
      expect(existsSync(join(ref!.pluginDir, "skills", "dicelore-build-pack", "SKILL.md"))).toBe(true);
      expect(existsSync(join(ref!.pluginDir, "skills", "dicelore-build-core", "SKILL.md"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
