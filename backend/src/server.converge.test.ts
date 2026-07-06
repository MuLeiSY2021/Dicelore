// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePort, ensureConfigExample } from "./server.js";

describe("resolvePort 解析(--port flag > PORT env > 8787)", () => {
  it("--port flag 优先", () => {
    expect(resolvePort(["--port", "9001"], { PORT: "8000" })).toBe(9001);
  });
  it("无 flag 用 PORT env", () => {
    expect(resolvePort([], { PORT: "8000" })).toBe(8000);
  });
  it("无 flag 无 env → 默认 8787", () => {
    expect(resolvePort([], {})).toBe(8787);
  });
  it("--port 末尾无值不崩,落 env/默认", () => {
    expect(resolvePort(["--port"], { PORT: "8123" })).toBe(8123);
  });
});

describe("ensureConfigExample 铺设幂等", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "dl-cfgex-")); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it("首次铺 config.example.toml(含 [env] 注释 + lower_snake 预留小节)", () => {
    ensureConfigExample(root);
    const p = join(root, "config.example.toml");
    expect(existsSync(p)).toBe(true);
    const raw = readFileSync(p, "utf8");
    expect(raw).toContain("[env]");
    expect(raw).toContain("PORT");
    // 预留 lower_snake 小节示例(未来非 env 配置落点)
    expect(raw).toMatch(/\[[a-z][a-z_]*\]/);
  });

  it("已存在 → 不覆盖(幂等,保留用户改动)", () => {
    const p = join(root, "config.example.toml");
    writeFileSync(p, "# user-edited\n");
    ensureConfigExample(root);
    expect(readFileSync(p, "utf8")).toBe("# user-edited\n");
  });

  it("数据根不存在时先建目录再铺", () => {
    const nested = join(root, "deep", "nested");
    ensureConfigExample(nested);
    expect(existsSync(join(nested, "config.example.toml"))).toBe(true);
  });
});
