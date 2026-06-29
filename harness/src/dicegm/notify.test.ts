// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { mapCanonWrite } from "./notify.js";
import type { CanonWriteEvent } from "./mcp/server.js";

describe("mapCanonWrite", () => {
  it("resolve_contest_open(明骰 verdict) → roll_committed", () => {
    const evt: CanonWriteEvent = {
      kind: "event", seq: 30, toolName: "resolve_contest_open",
      output: { awaiting: "player_roll", a: { name: "张三", total: 18, rolls: [18] }, b: { name: "DC", total: 15, rolls: [] }, winner: "a", event_id: 30 },
    };
    const msg = mapCanonWrite(evt);
    expect(msg?.type).toBe("roll_committed");
    if (msg?.type === "roll_committed") {
      expect(msg.eventId).toBe(30);
      expect(msg.total).toBe(18);
      expect(msg.outcome).toBe("success");
    }
  });

  it("resolve_outcome_open → roll_committed(band 名作 outcome)", () => {
    const evt: CanonWriteEvent = {
      kind: "event", seq: 40, toolName: "resolve_outcome_open",
      output: { roll: 55, die: "1d100", band: { label: "成功" }, event_id: 40 },
    };
    const msg = mapCanonWrite(evt);
    expect(msg?.type).toBe("roll_committed");
    if (msg?.type === "roll_committed") expect(msg.outcome).toBe("成功");
  });

  // A1：narrate 是 narration 的单一来源 —— narrate event → narration_commit(text=event content)。
  it("narrate(kind=event) → narration_commit(text=event content, seq=全局 event seq)", () => {
    const evt: CanonWriteEvent = {
      kind: "event", seq: 18, toolName: "narrate",
      output: { event_id: 18, content: "门吱呀一声开了。" },
    };
    const msg = mapCanonWrite(evt);
    expect(msg?.type).toBe("narration_commit");
    if (msg?.type === "narration_commit") {
      expect(msg.seq).toBe(18); // 全局 event seq(对齐 narrativeCursor)
      expect(msg.text).toBe("门吱呀一声开了。");
    }
  });

  // B3：game_end 工具 → game_end 消息(前端 setGameEnd)。
  it("game_end(kind=game_end) → game_end 消息(reason/outcome)", () => {
    const evt: CanonWriteEvent = {
      kind: "game_end", seq: 99, toolName: "game_end",
      output: { ended: true, event_id: 99, reason: "团灭", outcome: "你死了" },
    };
    const msg = mapCanonWrite(evt);
    expect(msg?.type).toBe("game_end");
    if (msg?.type === "game_end") {
      expect(msg.reason).toBe("团灭");
      expect(msg.outcome).toBe("你死了");
    }
  });

  // A2：sheet_update(mutation) → presentation_delta(带 seq)。
  it("sheet_update(mutation) → presentation_delta(带 seq)", () => {
    const evt: CanonWriteEvent = { kind: "mutation", seq: 12, toolName: "sheet_update", output: {} };
    const msg = mapCanonWrite(evt);
    expect(msg?.type).toBe("presentation_delta");
    if (msg?.type === "presentation_delta") expect(msg.delta.seq).toBe(12);
  });

  // A2：event_append(可见旁注) → presentation_delta(机械回显，不塌成 narration)。
  it("event_append(kind=event) → presentation_delta", () => {
    const evt: CanonWriteEvent = {
      kind: "event", seq: 13, toolName: "event_append",
      output: { event_id: 13, fired_watchers: [] },
    };
    const msg = mapCanonWrite(evt);
    expect(msg?.type).toBe("presentation_delta");
    if (msg?.type === "presentation_delta") expect(msg.delta.seq).toBe(13);
  });

  // A2：reveal_once(reveal) → presentation_delta，reveal 信号不丢(带 reveal changes)。
  it("reveal_once(kind=reveal) → presentation_delta，带 reveal changes", () => {
    const evt: CanonWriteEvent = {
      kind: "reveal", seq: 14, toolName: "reveal_once",
      output: { event_id: 14 },
    };
    const msg = mapCanonWrite(evt);
    expect(msg?.type).toBe("presentation_delta");
    if (msg?.type === "presentation_delta") {
      expect(msg.delta.seq).toBe(14);
      expect(msg.delta.changes.reveal).toBeDefined();
    }
  });

  // A2：visibility(sheet_show/world_show) → presentation_delta。
  it("sheet_show(kind=visibility) → presentation_delta", () => {
    const evt: CanonWriteEvent = { kind: "visibility", seq: 15, toolName: "sheet_show", output: { shown: ["HP"], ok: true } };
    const msg = mapCanonWrite(evt);
    expect(msg?.type).toBe("presentation_delta");
    if (msg?.type === "presentation_delta") expect(msg.delta.seq).toBe(15);
  });

  // A2：choice_staged(resolve_choice) → presentation_delta，watcherFired 字段不误填。
  it("resolve_choice(kind=choice_staged) → presentation_delta", () => {
    const evt: CanonWriteEvent = {
      kind: "choice_staged", seq: 16, toolName: "resolve_choice",
      output: { staged: true, options: [{ label: "推门", consequence: "惊动" }] },
    };
    const msg = mapCanonWrite(evt);
    expect(msg?.type).toBe("presentation_delta");
    if (msg?.type === "presentation_delta") expect(msg.delta.seq).toBe(16);
  });
});
