// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFileLogger, getLogger, initGlobalLogger } from "./log.js";

// 等 pino write stream flush（文件写流异步落盘，给一小段时间确保写入完成）。
function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 50));
}

describe("createFileLogger 分级分文件 + dedupe 不变量", () => {
  it("error 只进 error.log；warn 不进 error.log（钉住 LEVEL_FILES 降序 + dedupe）", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dl-logs-"));
    const l = createFileLogger(dir);
    l.error("boom-error");
    l.warn("just-warn");
    l.info("just-info");
    l.debug("just-debug");
    await flush();

    const errorLog = readFileSync(join(dir, "error.log"), "utf8");
    expect(errorLog).toContain("boom-error");
    // dedupe：error 止于 error.log，不重复进更低级别文件
    expect(errorLog).not.toContain("just-warn");
    expect(errorLog).not.toContain("just-info");

    // warn.log 收 warn（>=warn 的 dedupe 落点），但不含 error（error 已被更高 stream 吃掉）
    const warnLog = readFileSync(join(dir, "warn.log"), "utf8");
    expect(warnLog).toContain("just-warn");
    expect(warnLog).not.toContain("boom-error");

    const infoLog = readFileSync(join(dir, "info.log"), "utf8");
    expect(infoLog).toContain("just-info");
    expect(infoLog).not.toContain("just-warn");
  });

  it("同目录两次 createFileLogger 返回同一实例（钉住 fd 泄漏防护缓存）", () => {
    const dir = mkdtempSync(join(tmpdir(), "dl-logs-cache-"));
    const a = createFileLogger(dir);
    const b = createFileLogger(dir);
    expect(a).toBe(b);
  });

  it("createFileLogger 建出四个分级文件", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dl-logs-files-"));
    const l = createFileLogger(dir);
    l.debug("x");
    await flush();
    for (const f of ["error.log", "warn.log", "info.log", "debug.log"]) {
      expect(existsSync(join(dir, f))).toBe(true);
    }
  });
});

describe("getLogger / initGlobalLogger 全局切换", () => {
  it("initGlobalLogger 后 getLogger() 返回切换后的 logger", () => {
    const dir = mkdtempSync(join(tmpdir(), "dl-logs-global-"));
    const switched = initGlobalLogger(dir);
    expect(getLogger()).toBe(switched);
  });
});
