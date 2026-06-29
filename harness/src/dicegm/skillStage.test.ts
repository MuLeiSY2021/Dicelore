// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stageSkills, cleanupSkills } from "./skillStage.js";

describe("skillStage", () => {
  const staged: string[] = [];
  afterEach(() => { for (const d of staged) cleanupSkills(d); staged.length = 0; });

  it("把源 skill 拷进 <root>/.claude/skills/<name> 并保留子目录", () => {
    const src = mkdtempSync(join(tmpdir(), "src-skill-"));
    writeFileSync(join(src, "SKILL.md"), "# gm-core\n纪律若干。");
    mkdirSync(join(src, "references"));
    writeFileSync(join(src, "references", "moves.md"), "招式表");

    const root = stageSkills("test1", [{ name: "dicelore-gm-core", srcDir: src }]);
    staged.push(root);

    const base = join(root, ".claude", "skills", "dicelore-gm-core");
    expect(readFileSync(join(base, "SKILL.md"), "utf8")).toContain("gm-core");
    expect(readFileSync(join(base, "references", "moves.md"), "utf8")).toBe("招式表");
    rmSync(src, { recursive: true, force: true });
  });

  it("cleanupSkills 删除 staged 目录;空 skills 仍建出 cwd 根", () => {
    const root = stageSkills("test2", []);
    expect(existsSync(join(root, ".claude", "skills"))).toBe(true);
    cleanupSkills(root);
    expect(existsSync(root)).toBe(false);
  });
});
