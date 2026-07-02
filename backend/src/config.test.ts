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
import { defaultDataDir, resolveDataDir, applyConfigEnv } from "./config.js";

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
