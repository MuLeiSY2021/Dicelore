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
    tag(src, { adventureId: r1.adventureId, commitId: r2.commitId, label: "v1.0" });

    const dir = mkdtempSync(join(tmpdir(), "git-"));
    const { head } = exportGit(src, r1.adventureId, dir);
    expect(head).toMatch(/^[0-9a-f]{40}$/); // 真 git commit sha
    expect(existsSync(join(dir, ".git", "objects"))).toBe(true);
    expect(readFileSync(join(dir, ".git", "HEAD"), "utf8")).toContain("refs/heads/main");
    expect(existsSync(join(dir, ".git", "refs", "tags", "v1.0"))).toBe(true);

    const dst = openCatalog(":memory:");
    const imp = importGit(join(dir, ".git"), dst, "凡人");
    expect(imp.commits).toBe(2);
    const h = history(dst, imp.adventureId);
    expect(h.map((c) => c.message)).toEqual(["edit", "init"]); // newest first
    // 最新版内容一致
    const top = checkout(dst, imp.adventureId, h[0].id);
    expect(top.find((f) => f.path === "lore/世界.md")?.content).toBe("# v2");
    expect(top.find((f) => f.path === "rules/a.md")?.content).toBe("规则");
    // 旧版内容一致
    expect(checkout(dst, imp.adventureId, h[1].id).find((f) => f.path === "lore/世界.md")?.content).toBe("# v1");
    // tag 读回 → checkout(label) 命中最新版
    expect(checkout(dst, imp.adventureId, "v1.0").find((f) => f.path === "lore/世界.md")?.content).toBe("# v2");

    src.close(); dst.close();
  });

  it("created_at 往返还原:export→import 后各 commit 的 created_at 与原始一致(非 1970)", () => {
    const src = openCatalog(":memory:");
    const r1 = commit(src, { name: "时间", files: [{ path: "lore/a.md", content: "v1" }], message: "init", createdAt: "2026-03-15T08:30:00.000Z" });
    commit(src, { name: "时间", files: [{ path: "lore/a.md", content: "v2" }], message: "edit", createdAt: "2026-04-20T12:00:00.000Z" });

    const dir = mkdtempSync(join(tmpdir(), "git-ts-"));
    exportGit(src, r1.adventureId, dir);
    const dst = openCatalog(":memory:");
    const imp = importGit(join(dir, ".git"), dst, "时间");
    const h = history(dst, imp.adventureId); // newest first
    // git commit 时间精度到秒,比对秒级 unix 时间
    const sec = (iso: string) => Math.floor(Date.parse(iso) / 1000);
    expect(sec(h[0].createdAt)).toBe(sec("2026-04-20T12:00:00.000Z"));
    expect(sec(h[1].createdAt)).toBe(sec("2026-03-15T08:30:00.000Z"));
    // 断言不再退化为 epoch
    expect(h[0].createdAt.startsWith("1970")).toBe(false);
    expect(h[1].createdAt.startsWith("1970")).toBe(false);
    src.close(); dst.close();
  });

  it("tag 往返:含特殊字符内容的版本 export→import 后 tag 标签仍指向正确版本(checkoutMatches 路径)", () => {
    const src = openCatalog(":memory:");
    // 内容含逗号/引号/换行/CJK,压住 checkoutMatches 的逐字节比对路径
    const tricky = '行1,"含逗号与引号"\n行2\t制表符\n钟值=5';
    const r1 = commit(src, { name: "标签", files: [{ path: "pools/x.csv", content: tricky }, { path: "lore/a.md", content: "底料" }], message: "v1", createdAt: "2026-01-01" });
    const r2 = commit(src, { name: "标签", files: [{ path: "pools/x.csv", content: tricky }, { path: "lore/a.md", content: "底料 v2" }], message: "v2", createdAt: "2026-01-02" });
    tag(src, { adventureId: r1.adventureId, commitId: r1.commitId, label: "stable" }); // 标到旧版,验证非 head

    const dir = mkdtempSync(join(tmpdir(), "git-tag-"));
    exportGit(src, r1.adventureId, dir);
    const dst = openCatalog(":memory:");
    const imp = importGit(join(dir, ".git"), dst, "标签");
    // tag 应指向旧版(r1),其 lore/a.md 内容为 "底料"、pools 内容逐字节一致
    const tagged = checkout(dst, imp.adventureId, "stable");
    expect(tagged.find((f) => f.path === "lore/a.md")?.content).toBe("底料");
    expect(tagged.find((f) => f.path === "pools/x.csv")?.content).toBe(tricky);
    // 确认确实区分了两版(head 是 v2)
    void r2;
    src.close(); dst.close();
  });

  it.skipIf(!hasGit())("导出的仓库可被真 git 读(git log / git tag)", () => {
    const src = openCatalog(":memory:");
    const r1 = commit(src, { name: "魔道", files: [{ path: "lore/a.md", content: "v1" }], message: "init", createdAt: "2026-01-01" });
    const r2 = commit(src, { name: "魔道", files: [{ path: "lore/a.md", content: "v2" }], message: "edit", createdAt: "2026-01-02" });
    tag(src, { adventureId: r1.adventureId, commitId: r2.commitId, label: "v1.0" });
    const dir = mkdtempSync(join(tmpdir(), "gitreal-"));
    exportGit(src, r1.adventureId, dir);
    const log = execFileSync("git", ["-C", dir, "log", "--format=%s"], { encoding: "utf8" }).trim().split("\n");
    expect(log).toEqual(["edit", "init"]);
    const tags = execFileSync("git", ["-C", dir, "tag"], { encoding: "utf8" }).trim();
    expect(tags).toBe("v1.0");
    src.close();
  });
});
