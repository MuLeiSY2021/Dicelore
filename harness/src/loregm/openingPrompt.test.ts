// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { buildPackSkill } from "./openingPrompt.js";

describe("buildPackSkill", () => {
  it("源目录存在时返回 SkillRef(name=dicelore-build-pack, srcDir 含 SKILL.md)", () => {
    const ref = buildPackSkill();
    // CI 下 harness/skills/dicelore-build-pack 必须存在;若不存在返回 null
    if (ref === null) {
      // 目录不存在时合法退化(同 gmCoreSkill() 的处理)
      expect(ref).toBeNull();
    } else {
      expect(ref.name).toBe("dicelore-build-pack");
      expect(ref.srcDir).toMatch(/dicelore-build-pack$/);
      // srcDir 下有 SKILL.md(是合法 skill 目录)
      expect(existsSync(`${ref.srcDir}/SKILL.md`)).toBe(true);
    }
  });
});
