// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openCatalog } from "./db.js";
import { commit, history, checkout, resolveId, tag, list } from "./catalog.js";

const files = (n: number) => [{ path: "manifest.md", content: `# v${n}` }];

describe("catalog commit/history/checkout", () => {
  it("commit 建录 + 线性史 + checkout 取快照", () => {
    const db = openCatalog(":memory:");
    const r1 = commit(db, { name: "凡人", files: files(1), message: "init", createdAt: "2026-01-01" });
    const r2 = commit(db, { name: "凡人", files: files(2), message: "edit", createdAt: "2026-01-02" });
    expect(r1.tuanbenId).toBe(resolveId("凡人"));
    expect(r2.tuanbenId).toBe(r1.tuanbenId);
    const h = history(db, r1.tuanbenId);
    expect(h.map((c) => c.message)).toEqual(["edit", "init"]); // newest first
    expect(h[0].parent).toBe(r1.commitId);
    expect(checkout(db, r1.tuanbenId, r2.commitId)[0].content).toBe("# v2");
    expect(checkout(db, r1.tuanbenId, r1.commitId)[0].content).toBe("# v1");
    db.close();
  });
});

describe("catalog tag/list", () => {
  it("tag 后 checkout(label) 命中、list 列出团本+tags", () => {
    const db = openCatalog(":memory:");
    const r = commit(db, { name: "魔道", files: files(1), message: "init", createdAt: "2026-01-01" });
    tag(db, { tuanbenId: r.tuanbenId, commitId: r.commitId, label: "v1.0" });
    expect(checkout(db, r.tuanbenId, "v1.0")[0].content).toBe("# v1");
    const ls = list(db);
    expect(ls.find((t) => t.id === r.tuanbenId)?.tags).toContain("v1.0");
    db.close();
  });
});
