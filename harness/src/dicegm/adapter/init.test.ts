// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// packages/core/src/adapter/init.test.ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "./init.js";

function tmpProject() { return mkdtempSync(join(tmpdir(), "dl-init-")); }

describe("dicelore init", () => {
  it("写 .mcp.json(项目根,stdio dicelore + env)", () => {
    const dir = tmpProject();
    runInit({ projectDir: dir, session: "修仙团" });
    const m = JSON.parse(readFileSync(join(dir, ".mcp.json"), "utf8"));
    expect(m.mcpServers.dicelore.type).toBe("stdio");
    expect(m.mcpServers.dicelore.env.DICELORE_SESSION).toBe("修仙团");
  });

  it("写 settings.json(三 hook 绝对路径,不含 mcpServers)", () => {
    const dir = tmpProject();
    runInit({ projectDir: dir, session: "修仙团" });
    const s = JSON.parse(readFileSync(join(dir, ".claude", "settings.json"), "utf8"));
    expect(s.mcpServers).toBeUndefined();
    const stopArgs: string[] = s.hooks.Stop[0].hooks[0].args;
    expect(stopArgs[0]).toBe("--import");
    expect(stopArgs[2].endsWith("turn-end.ts")).toBe(true);
    expect(stopArgs[2].startsWith("/")).toBe(true); // 绝对路径
  });

  it("拷 gm-core + 四 flow skill 进 .claude/skills/", () => {
    const dir = tmpProject();
    runInit({ projectDir: dir, session: "t" });
    expect(existsSync(join(dir, ".claude", "skills", "dicelore-gm-core", "SKILL.md"))).toBe(true);
    for (const f of ["gacha", "contest", "anka", "explore"]) {
      expect(existsSync(join(dir, ".claude", "skills", `dicelore-flow-${f}`, "SKILL.md"))).toBe(true);
    }
  });

  it("已有 CLAUDE.md → 追加而非覆盖", () => {
    const dir = tmpProject();
    writeFileSync(join(dir, "CLAUDE.md"), "# 原有内容\n");
    runInit({ projectDir: dir, session: "t" });
    const md = readFileSync(join(dir, "CLAUDE.md"), "utf8");
    expect(md).toContain("原有内容");
    expect(md).toContain("诚实仲裁者");
  });
});
