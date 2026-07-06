// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sessionDir, SessionTranscript } from "./transcript.js";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "dl-transcript-"));
}
function readLines(dir: string, sessionId: string): any[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  if (files.length === 0) return [];
  const content = readFileSync(join(dir, files[0]!), "utf8").trim();
  if (!content) return [];
  return content.split("\n").map((l) => JSON.parse(l));
}

describe("sessionDir 纯函数(DD2 布局 sessions/kind/id)", () => {
  it("返回 join(dataDir, 'sessions', kind, id)", () => {
    expect(sessionDir("/data", "dice", "s1")).toBe(join("/data", "sessions", "dice", "s1"));
    expect(sessionDir("/data", "lore", "s2")).toBe(join("/data", "sessions", "lore", "s2"));
  });
});

describe("SessionTranscript append-only UUID 树 + HEAD", () => {
  let dir: string;
  beforeEach(() => { dir = tmp(); });

  it("初始 head()=null", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    expect(t.head()).toBeNull();
  });

  it("append 后 HEAD 前进 + 落 <sessionDir>/HEAD", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    const u1 = t.turn({ turnId: "t1" });
    expect(t.head()).toBe(u1);
    const headFile = join(dir, "HEAD");
    expect(existsSync(headFile)).toBe(true);
    expect(readFileSync(headFile, "utf8").trim()).toBe(u1);
    const u2 = t.turnEnd("t1");
    expect(t.head()).toBe(u2);
    expect(readFileSync(headFile, "utf8").trim()).toBe(u2);
  });

  it("每行前置 uuid/parentUuid,余字段原样(turn 行形状)", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    const u1 = t.turn({ turnId: "t1", sessionId: "s1", model: "m", input: "hi", plugin: null, ts: "2026" });
    const lines = readLines(dir, "s1");
    expect(lines).toHaveLength(1);
    expect(lines[0].uuid).toBe(u1);
    expect(lines[0].parentUuid).toBeNull();
    expect(lines[0]._).toBe("turn");
    expect(lines[0].turnId).toBe("t1");
    expect(lines[0].model).toBe("m");
    expect(lines[0].input).toBe("hi");
    expect(lines[0].ts).toBe("2026");
  });

  it("msg 行链在 turn 之后,parentUuid==前一行 uuid", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    const u1 = t.turn({ turnId: "t1" });
    t.msg(1, { _: "msg", turnId: "t1", idx: 1, type: "assistant" });
    const lines = readLines(dir, "s1");
    expect(lines).toHaveLength(2);
    expect(lines[1].parentUuid).toBe(u1);
    expect(lines[1]._).toBe("msg");
    expect(lines[1].idx).toBe(1);
  });

  it("moveHead(U) 后再 turn() 新行 parentUuid==U(真分叉)", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    const u1 = t.turn({ turnId: "t1" });
    const u2 = t.turnEnd("t1"); // head=u2
    t.moveHead(u1); // 回退到 u1
    expect(t.head()).toBe(u1);
    const u3 = t.turn({ turnId: "t2" });
    const lines = readLines(dir, "s1");
    const line3 = lines.find((l) => l.uuid === u3);
    expect(line3.parentUuid).toBe(u1); // 分叉自 u1,不是 u2
    // HEAD 文件也落 u3
    expect(readFileSync(join(dir, "HEAD"), "utf8").trim()).toBe(u3);
    void u2;
  });

  it("livePath() 只含活动分支,不含被回退废弃的行", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    const u1 = t.turn({ turnId: "t1" });
    const u2 = t.turnEnd("t1"); // 分支A: u1->u2
    t.moveHead(u1);
    const u3 = t.turn({ turnId: "t2" }); // 分支B: u1->u3
    const path = t.livePath();
    const uuids = path.map((r: any) => r.uuid);
    expect(uuids).toEqual([u1, u3]); // 正序,根到 HEAD
    expect(uuids).not.toContain(u2); // 废弃分支不含
  });

  it("moveHead 非树内 uuid 抛错", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    t.turn({ turnId: "t1" });
    expect(() => t.moveHead("not-a-real-uuid")).toThrow();
  });

  it("hasNode 命中/未命中", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    const u1 = t.turn({ turnId: "t1" });
    expect(t.hasNode(u1)).toBe(true);
    expect(t.hasNode("nope")).toBe(false);
  });

  it("reopen 从 HEAD 文件恢复 head", () => {
    const t1 = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    t1.turn({ turnId: "t1" });
    const u2 = t1.turnEnd("t1");
    const t2 = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    expect(t2.head()).toBe(u2);
    // 续写链在 u2 之后
    const u3 = t2.turn({ turnId: "t2" });
    const lines = readLines(dir, "s1");
    expect(lines.find((l) => l.uuid === u3).parentUuid).toBe(u2);
  });

  it("reopen HEAD 缺失 → 回落末行 uuid", () => {
    const t1 = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    t1.turn({ turnId: "t1" });
    const u2 = t1.turnEnd("t1");
    // 删 HEAD 文件
    rmSync(join(dir, "HEAD"));
    const t2 = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    expect(t2.head()).toBe(u2); // 回落末行
  });

  it("reopen HEAD 空文件 → head=null", () => {
    const t1 = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    t1.turn({ turnId: "t1" });
    writeFileSync(join(dir, "HEAD"), "");
    const t2 = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    expect(t2.head()).toBeNull();
  });

  it("error/turnEnd 行也铸 uuid 前进 HEAD", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    t.turn({ turnId: "t1" });
    t.error({ _: "error", turnId: "t1", message: "boom" });
    const lines = readLines(dir, "s1");
    expect(lines).toHaveLength(2);
    expect(lines[1]._).toBe("error");
    expect(lines[1].message).toBe("boom");
    expect(lines[1].uuid).toBeTruthy();
  });

  it("写失败 fail-soft 不抛(目录不可建:路径穿过普通文件)", () => {
    // 造一个普通文件,再把它当目录用 → mkdirSync/appendFileSync 同步抛 ENOTDIR(不 hang)。
    const filePath = join(dir, "blocker");
    writeFileSync(filePath, "x");
    const t = new SessionTranscript({ sessionDir: join(filePath, "deep"), sessionId: "s1" });
    expect(() => t.turn({ turnId: "t1" })).not.toThrow();
    expect(() => t.turnEnd("t1")).not.toThrow();
    expect(() => t.error({ _: "error" })).not.toThrow();
    // 写全失败 → head 仍为 null(append catch 在设 head 前返回)
    expect(t.head()).toBeNull();
  });
});
