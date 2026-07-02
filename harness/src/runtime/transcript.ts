// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getLogger } from "@dicelore/logs";

// 一 session 的自包含文件夹路径(backend-free 纯函数,不碰 appDataRoot/env)。
// DD2 布局:join(dataDir, 'sessions', kind, id)——sessions 顶层、kind 次级、id 叶级。
// backend 侧会话物理路径统一走本函数(backend import harness),与 DiceGm/transcript 落点完全一致。
export type TranscriptKind = "dice" | "lore";
export function sessionDir(dataDir: string, kind: TranscriptKind, id: string): string {
  return join(dataDir, "sessions", kind, id);
}

// jsonl 一行:现 DiceGm 行形状({_,turnId,...} 等)前置 uuid/parentUuid 铸成 append-only 父子链树。
interface TranscriptLine {
  uuid: string;
  parentUuid: string | null;
  [k: string]: unknown;
}

// append-only UUID 父子链树 + HEAD 指针(持久化 <sessionDir>/HEAD 文件)。
// 每次 append 铸 randomUUID、parentUuid=当前 HEAD、写行(JSON.stringify+\n)后 HEAD:=新 uuid 并落 HEAD 文件。
// moveHead 可把 HEAD 挪回树内任一节点 → 下一次 append 从该处分叉(真分支)。
// livePath 从 HEAD 沿 parentUuid 回溯到根、正序返回活动分支行(废弃分支不含)。
// 写失败 fail-soft(try/catch + getLogger().error,不抛)——落盘是可观测性,不该拖垮回合。
export class SessionTranscript {
  private readonly dir: string;
  private readonly sessionId: string;
  private readonly jsonlPath: string;
  private readonly headPath: string;
  private ready = false;
  private _head: string | null = null;

  constructor(init: { sessionDir: string; sessionId: string }) {
    this.dir = init.sessionDir;
    this.sessionId = init.sessionId;
    this.jsonlPath = join(this.dir, `${this.sessionId}_session.jsonl`);
    this.headPath = join(this.dir, "HEAD");
    this._head = this.recoverHead();
  }

  head(): string | null {
    return this._head;
  }

  // turn/msg/turnEnd/error 均经此:铸 uuid、parentUuid=当前 HEAD、写行、HEAD 前进 + 落文件。
  private append(body: Record<string, unknown>): string {
    const uuid = randomUUID();
    const line: TranscriptLine = { uuid, parentUuid: this._head, ...body };
    try {
      if (!this.ready) { mkdirSync(this.dir, { recursive: true }); this.ready = true; }
      appendFileSync(this.jsonlPath, JSON.stringify(line) + "\n");
      this._head = uuid;
      writeFileSync(this.headPath, uuid);
    } catch (e) {
      getLogger().error({ err: e }, "写 _session.jsonl / HEAD 失败");
    }
    return uuid;
  }

  turn(header: Record<string, unknown>): string {
    return this.append({ _: "turn", ...header });
  }
  msg(idx: number, body: Record<string, unknown>): string {
    return this.append({ idx, ...body });
  }
  turnEnd(turnId: string, extra: Record<string, unknown> = {}): string {
    return this.append({ _: "turn_end", turnId, ...extra });
  }
  error(obj: Record<string, unknown>): string {
    return this.append({ _: "error", ...obj });
  }

  // 扫 jsonl 收全部 uuid 集合(reopen/moveHead 校验用;无缓存,append-only 文件重扫廉价且诚实)。
  private uuidSet(): Set<string> {
    const set = new Set<string>();
    for (const l of this.readAll()) set.add(l.uuid);
    return set;
  }

  hasNode(uuid: string): boolean {
    return this.uuidSet().has(uuid);
  }

  // 把 HEAD 挪到树内任一节点(校验 ∈ 树)→ 写 HEAD 文件 + 内存 head;非树内抛错。
  moveHead(uuid: string): void {
    if (!this.hasNode(uuid)) {
      throw new Error(`moveHead: uuid ${uuid} 不在 transcript 树内`);
    }
    this._head = uuid;
    try {
      if (!this.ready) { mkdirSync(this.dir, { recursive: true }); this.ready = true; }
      writeFileSync(this.headPath, uuid);
    } catch (e) {
      getLogger().error({ err: e }, "写 HEAD 失败");
    }
  }

  // 从 HEAD 沿 parentUuid 回溯到根、正序返回活动分支行(根→HEAD)。废弃分支的行不含。
  livePath(): TranscriptLine[] {
    if (this._head === null) return [];
    const byUuid = new Map<string, TranscriptLine>();
    for (const l of this.readAll()) byUuid.set(l.uuid, l);
    const chain: TranscriptLine[] = [];
    let cur: string | null = this._head;
    const seen = new Set<string>();
    while (cur !== null) {
      if (seen.has(cur)) break; // 环兜底(理论不该有)
      seen.add(cur);
      const line = byUuid.get(cur);
      if (!line) break;
      chain.push(line);
      cur = line.parentUuid;
    }
    return chain.reverse();
  }

  // 读全部行(fail-soft:读不到/坏行跳过,返回可解析行)。
  private readAll(): TranscriptLine[] {
    try {
      if (!existsSync(this.jsonlPath)) return [];
      const raw = readFileSync(this.jsonlPath, "utf8");
      const out: TranscriptLine[] = [];
      for (const l of raw.split("\n")) {
        const s = l.trim();
        if (!s) continue;
        try {
          const parsed = JSON.parse(s) as TranscriptLine;
          if (parsed && typeof parsed.uuid === "string") out.push(parsed);
        } catch { /* 坏行跳过 */ }
      }
      return out;
    } catch (e) {
      getLogger().error({ err: e }, "读 _session.jsonl 失败");
      return [];
    }
  }

  // 构造时恢复 head:HEAD 文件在(非空)→ 恢复;缺 → 回落末行 uuid;空文件 → null。
  private recoverHead(): string | null {
    try {
      if (existsSync(this.headPath)) {
        const raw = readFileSync(this.headPath, "utf8").trim();
        return raw === "" ? null : raw;
      }
    } catch (e) {
      getLogger().error({ err: e }, "读 HEAD 失败");
    }
    // HEAD 缺失:回落 jsonl 末行 uuid(无行则 null)
    const lines = this.readAll();
    return lines.length > 0 ? lines[lines.length - 1]!.uuid : null;
  }
}
