// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openCatalog } from "./db.js";
import { commit, tag, checkout, history } from "./catalog.js";
import { exportGit, importGit } from "./git.js";

function hasGit(): boolean {
  try { execFileSync("git", ["--version"], { stdio: "ignore" }); return true; } catch { return false; }
}

describe("git 单向投影 export/import round-trip", () => {
  it("DB 线性史 → 真 git 仓库 → 读回新 DB,内容一致", () => {
    const src = openCatalog(":memory:");
    const r1 = commit(src, { name: "凡人", files: [{ path: "lore/世界.md", content: "# v1" }], message: "init", createdAt: "2026-01-01" });
    const r2 = commit(src, { name: "凡人", files: [{ path: "lore/世界.md", content: "# v2" }, { path: "rules/a.md", content: "规则" }], message: "edit", createdAt: "2026-01-02" });
    tag(src, { tuanbenId: r1.tuanbenId, commitId: r2.commitId, label: "v1.0" });

    const dir = mkdtempSync(join(tmpdir(), "git-"));
    const { head } = exportGit(src, r1.tuanbenId, dir);
    expect(head).toMatch(/^[0-9a-f]{40}$/); // 真 git commit sha
    expect(existsSync(join(dir, ".git", "objects"))).toBe(true);
    expect(readFileSync(join(dir, ".git", "HEAD"), "utf8")).toContain("refs/heads/main");
    expect(existsSync(join(dir, ".git", "refs", "tags", "v1.0"))).toBe(true);

    const dst = openCatalog(":memory:");
    const imp = importGit(join(dir, ".git"), dst, "凡人");
    expect(imp.commits).toBe(2);
    const h = history(dst, imp.tuanbenId);
    expect(h.map((c) => c.message)).toEqual(["edit", "init"]); // newest first
    // 最新版内容一致
    const top = checkout(dst, imp.tuanbenId, h[0].id);
    expect(top.find((f) => f.path === "lore/世界.md")?.content).toBe("# v2");
    expect(top.find((f) => f.path === "rules/a.md")?.content).toBe("规则");
    // 旧版内容一致
    expect(checkout(dst, imp.tuanbenId, h[1].id).find((f) => f.path === "lore/世界.md")?.content).toBe("# v1");
    // tag 读回 → checkout(label) 命中最新版
    expect(checkout(dst, imp.tuanbenId, "v1.0").find((f) => f.path === "lore/世界.md")?.content).toBe("# v2");

    src.close(); dst.close();
  });

  it.skipIf(!hasGit())("导出的仓库可被真 git 读(git log / git tag)", () => {
    const src = openCatalog(":memory:");
    const r1 = commit(src, { name: "魔道", files: [{ path: "lore/a.md", content: "v1" }], message: "init", createdAt: "2026-01-01" });
    const r2 = commit(src, { name: "魔道", files: [{ path: "lore/a.md", content: "v2" }], message: "edit", createdAt: "2026-01-02" });
    tag(src, { tuanbenId: r1.tuanbenId, commitId: r2.commitId, label: "v1.0" });
    const dir = mkdtempSync(join(tmpdir(), "gitreal-"));
    exportGit(src, r1.tuanbenId, dir);
    const log = execFileSync("git", ["-C", dir, "log", "--format=%s"], { encoding: "utf8" }).trim().split("\n");
    expect(log).toEqual(["edit", "init"]);
    const tags = execFileSync("git", ["-C", dir, "tag"], { encoding: "utf8" }).trim();
    expect(tags).toBe("v1.0");
    src.close();
  });
});
