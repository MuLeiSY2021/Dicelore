// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";
import { tmpdir, homedir } from "node:os";
import { defaultDataDir, resolveDataDir, applyConfigEnv, readMcpConfig, upsertMarketplace, upsertMcpServer, setMcpServerEnabled, removeMcpServer, resolveCustomMcpServers, type MarketplaceEntry, type McpServerEntry } from "./config.js";

// mock @dicelore/logs 的 getLogger，捕获 warn/error 调用
const warnSpy = vi.fn();
const errorSpy = vi.fn();
vi.mock("@dicelore/logs", () => ({
  getLogger: () => ({ warn: warnSpy, error: errorSpy, info: vi.fn(), debug: vi.fn() }),
}));

describe("defaultDataDir 三平台分支", () => {
  const origPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
  function setPlatform(p: string) {
    Object.defineProperty(process, "platform", { value: p, configurable: true });
  }
  afterEach(() => {
    Object.defineProperty(process, "platform", origPlatform);
  });

  it("darwin → ~/Library/Application Support/Dicelore", () => {
    setPlatform("darwin");
    expect(defaultDataDir()).toBe(join(homedir(), "Library/Application Support/Dicelore"));
  });

  it("win32 → APPDATA/Dicelore（有 APPDATA 用之）", () => {
    setPlatform("win32");
    const orig = process.env.APPDATA;
    process.env.APPDATA = "C:\\Users\\me\\AppData\\Roaming";
    try {
      expect(defaultDataDir()).toBe(join("C:\\Users\\me\\AppData\\Roaming", "Dicelore"));
    } finally {
      if (orig === undefined) delete process.env.APPDATA;
      else process.env.APPDATA = orig;
    }
  });

  it("win32 无 APPDATA → homedir/AppData/Roaming/Dicelore", () => {
    setPlatform("win32");
    const orig = process.env.APPDATA;
    delete process.env.APPDATA;
    try {
      expect(defaultDataDir()).toBe(join(homedir(), "AppData/Roaming", "Dicelore"));
    } finally {
      if (orig !== undefined) process.env.APPDATA = orig;
    }
  });

  it("linux 有 XDG_DATA_HOME → $XDG_DATA_HOME/dicelore", () => {
    setPlatform("linux");
    const orig = process.env.XDG_DATA_HOME;
    process.env.XDG_DATA_HOME = "/custom/xdg";
    try {
      expect(defaultDataDir()).toBe(join("/custom/xdg", "dicelore"));
    } finally {
      if (orig === undefined) delete process.env.XDG_DATA_HOME;
      else process.env.XDG_DATA_HOME = orig;
    }
  });

  it("linux 无 XDG_DATA_HOME → homedir/.local/share/dicelore", () => {
    setPlatform("linux");
    const orig = process.env.XDG_DATA_HOME;
    delete process.env.XDG_DATA_HOME;
    try {
      expect(defaultDataDir()).toBe(join(homedir(), ".local/share", "dicelore"));
    } finally {
      if (orig !== undefined) process.env.XDG_DATA_HOME = orig;
    }
  });
});

describe("resolveDataDir 优先级 flag > env > OS 默认", () => {
  it("--data-dir flag 优先", () => {
    const env = { DICELORE_DATA_DIR: "/from/env" };
    const got = resolveDataDir(["--data-dir", "/from/flag"], env);
    expect(got).toBe(resolve("/from/flag"));
  });

  it("无 flag 时用 env.DICELORE_DATA_DIR", () => {
    const env = { DICELORE_DATA_DIR: "/from/env" };
    const got = resolveDataDir([], env);
    expect(got).toBe(resolve("/from/env"));
  });

  it("无 flag 无 env → OS 默认（绝对路径）", () => {
    const got = resolveDataDir([], {});
    expect(got).toBe(resolve(defaultDataDir()));
    expect(isAbsolute(got)).toBe(true);
  });

  it("返回值始终是绝对路径（相对 flag 也 resolve）", () => {
    const got = resolveDataDir(["--data-dir", "rel/path"], {});
    expect(isAbsolute(got)).toBe(true);
    expect(got).toBe(resolve("rel/path"));
  });

  it("--data-dir 末尾无值不崩（视为无 flag，落 env/默认）", () => {
    const got = resolveDataDir(["--data-dir"], { DICELORE_DATA_DIR: "/e" });
    expect(got).toBe(resolve("/e"));
  });
});

describe("applyConfigEnv", () => {
  let dir: string;
  beforeEach(() => {
    warnSpy.mockClear();
    errorSpy.mockClear();
    dir = mkdtempSync(join(tmpdir(), "dl-config-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("文件不存在 → no-op，不报错不改 env", () => {
    const before = process.env.DL_TEST_NOFILE;
    expect(() => applyConfigEnv(dir)).not.toThrow();
    expect(process.env.DL_TEST_NOFILE).toBe(before);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("[env] 未设 KEY → 补写", () => {
    delete process.env.DL_TEST_UNSET;
    writeFileSync(join(dir, "config.toml"), '[env]\nDL_TEST_UNSET = "hello"\n');
    try {
      applyConfigEnv(dir);
      expect(process.env.DL_TEST_UNSET).toBe("hello");
    } finally {
      delete process.env.DL_TEST_UNSET;
    }
  });

  it("[env] 已设 KEY → 不覆盖", () => {
    process.env.DL_TEST_SET = "orig";
    writeFileSync(join(dir, "config.toml"), '[env]\nDL_TEST_SET = "override"\n');
    try {
      applyConfigEnv(dir);
      expect(process.env.DL_TEST_SET).toBe("orig");
    } finally {
      delete process.env.DL_TEST_SET;
    }
  });

  it("非字符串值 → String() 化后写入", () => {
    delete process.env.DL_TEST_NUM;
    writeFileSync(join(dir, "config.toml"), "[env]\nDL_TEST_NUM = 42\n");
    try {
      applyConfigEnv(dir);
      expect(process.env.DL_TEST_NUM).toBe("42");
    } finally {
      delete process.env.DL_TEST_NUM;
    }
  });

  it("[env] 里 DICELORE_KEY_MASTER → 忽略 + warn", () => {
    delete process.env.DICELORE_KEY_MASTER;
    writeFileSync(join(dir, "config.toml"), '[env]\nDICELORE_KEY_MASTER = "leaked"\n');
    try {
      applyConfigEnv(dir);
      expect(process.env.DICELORE_KEY_MASTER).toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      delete process.env.DICELORE_KEY_MASTER;
    }
  });

  it("非 [env] 小节 → 不注入 env", () => {
    delete process.env.DL_TEST_OTHER;
    writeFileSync(join(dir, "config.toml"), '[server]\nDL_TEST_OTHER = "x"\nport = 8080\n');
    try {
      applyConfigEnv(dir);
      expect(process.env.DL_TEST_OTHER).toBeUndefined();
    } finally {
      delete process.env.DL_TEST_OTHER;
    }
  });

  it("解析失败 → error + throw", () => {
    writeFileSync(join(dir, "config.toml"), "this is = = not valid toml [[[\n");
    expect(() => applyConfigEnv(dir)).toThrow();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("客制 MCP config.toml 读写（marketplaces / mcpServers）", () => {
  let dir: string;
  beforeEach(() => {
    warnSpy.mockClear();
    errorSpy.mockClear();
    dir = mkdtempSync(join(tmpdir(), "dl-mcp-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("文件不存在 → 空 marketplaces/mcpServers", () => {
    expect(readMcpConfig(dir)).toEqual({ marketplaces: [], mcpServers: [] });
    expect(resolveCustomMcpServers(dir)).toEqual({});
  });

  it("upsertMarketplace 写 [marketplaces.<name>] 并可回读", () => {
    const mkt: MarketplaceEntry = { name: "acme-mkt", source: "github", repo: "acme/mcp-market", ref: "v2.0" };
    upsertMarketplace(dir, mkt);
    const { marketplaces } = readMcpConfig(dir);
    expect(marketplaces).toEqual([mkt]);
  });

  it("upsertMarketplace 同名覆盖（不重复行）", () => {
    upsertMarketplace(dir, { name: "m", source: "github", repo: "a/b" });
    upsertMarketplace(dir, { name: "m", source: "url", url: "https://x/marketplace.json" });
    const { marketplaces } = readMcpConfig(dir);
    expect(marketplaces).toHaveLength(1);
    expect(marketplaces[0]).toEqual({ name: "m", source: "url", url: "https://x/marketplace.json" });
  });

  it("upsertMcpServer 写 [mcpServers.<name>] + env 子表并可回读", () => {
    const s: McpServerEntry = {
      name: "bocha",
      package: "@bocha/mcp-search@1.2.0",
      command: "npx",
      args: ["-y", "@bocha/mcp-search@1.2.0"],
      fromMarketplace: "acme-mkt",
      installed: true,
      enabled: true,
      outOfCanon: true,
      env: { BOCHA_API_KEY: "secret-value" },
    };
    upsertMcpServer(dir, s);
    const { mcpServers } = readMcpConfig(dir);
    expect(mcpServers).toEqual([s]);
  });

  it("直装 npm 包（无 fromMarketplace）读写", () => {
    const s: McpServerEntry = {
      name: "local-py-mcp",
      package: "some-py-mcp@0.4.0",
      command: "uvx",
      args: ["some-py-mcp@0.4.0"],
      installed: true,
      enabled: false,
      outOfCanon: true,
      env: { TOKEN: "t2" },
    };
    upsertMcpServer(dir, s);
    const got = readMcpConfig(dir).mcpServers[0];
    expect(got.fromMarketplace).toBeUndefined();
    expect(got).toEqual(s);
  });

  it("marketplaces 与 mcpServers 与既有 [env] 共存于同一文件（[env] 不丢）", () => {
    writeFileSync(join(dir, "config.toml"), '[env]\nDICELORE_FAKE_GM = "1"\n');
    upsertMarketplace(dir, { name: "m", source: "github", repo: "a/b" });
    upsertMcpServer(dir, {
      name: "s", package: "p@1", command: "npx", args: ["-y", "p@1"],
      installed: true, enabled: true, outOfCanon: true, env: {},
    });
    // [env] 仍能被 applyConfigEnv 消费
    delete process.env.DICELORE_FAKE_GM;
    try {
      applyConfigEnv(dir);
      expect(process.env.DICELORE_FAKE_GM).toBe("1");
    } finally {
      delete process.env.DICELORE_FAKE_GM;
    }
    expect(readMcpConfig(dir).marketplaces).toHaveLength(1);
    expect(readMcpConfig(dir).mcpServers).toHaveLength(1);
  });

  it("setMcpServerEnabled 切开关；不存在返回 false", () => {
    upsertMcpServer(dir, {
      name: "s", package: "p@1", command: "npx", args: ["-y", "p@1"],
      installed: true, enabled: true, outOfCanon: true, env: {},
    });
    expect(setMcpServerEnabled(dir, "s", false)).toBe(true);
    expect(readMcpConfig(dir).mcpServers[0].enabled).toBe(false);
    expect(setMcpServerEnabled(dir, "nope", true)).toBe(false);
  });

  it("removeMcpServer 删除；不存在返回 false", () => {
    upsertMcpServer(dir, {
      name: "s", package: "p@1", command: "npx", args: ["-y", "p@1"],
      installed: true, enabled: true, outOfCanon: true, env: {},
    });
    expect(removeMcpServer(dir, "s")).toBe(true);
    expect(readMcpConfig(dir).mcpServers).toHaveLength(0);
    expect(removeMcpServer(dir, "s")).toBe(false);
  });

  it("resolveCustomMcpServers 只取 enabled && installed，映射为 stdio 配置", () => {
    upsertMcpServer(dir, {
      name: "on", package: "p@1", command: "npx", args: ["-y", "p@1"],
      installed: true, enabled: true, outOfCanon: true, env: { K: "v" },
    });
    upsertMcpServer(dir, {
      name: "off", package: "q@1", command: "npx", args: ["-y", "q@1"],
      installed: true, enabled: false, outOfCanon: true, env: {},
    });
    upsertMcpServer(dir, {
      name: "uninstalled", package: "r@1", command: "npx", args: ["-y", "r@1"],
      installed: false, enabled: true, outOfCanon: true, env: {},
    });
    const resolved = resolveCustomMcpServers(dir);
    expect(Object.keys(resolved)).toEqual(["on"]);
    expect(resolved.on).toEqual({ type: "stdio", command: "npx", args: ["-y", "p@1"], env: { K: "v" } });
  });
});
