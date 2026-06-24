// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "@dicelore/core";
import { DiceSession } from "./DiceSession.js";
import { FakeDiceGm } from "./FakeDiceGm.js";
import type { AgentInit, Agent } from "../pkg/agent.js";

const memDb = () => { const d = openDb(":memory:"); initSchema(d); return d; };

describe("DiceSession", () => {
  it("handleMessage 跑一回合：WS 收到 turn_started…turn_ended", async () => {
    const host = new DiceSession("s1", {
      agentFactory: () => new FakeDiceGm([{ type: "narration", text: "门开了。" }, { type: "turn_end" }]),
    });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    const { turnId } = await host.handleMessage("我推门");
    const types = sent.map((m) => m.type);
    expect(turnId).toBeTruthy();
    expect(types[0]).toBe("turn_started");
    expect(types).toContain("narration_commit");
    expect(types.at(-1)).toBe("turn_ended");
  });

  it("onCanonWrite 经 hub 推 presentation_delta", async () => {
    const host = new DiceSession("s1", { agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    host.onCanonWrite({ kind: "mutation", seq: 7, toolName: "sheet_update", output: {} });
    expect(sent.find((m) => m.type === "presentation_delta")?.delta.seq).toBe(7);
  });

  it("handleRoll 对无待掷返回 false", () => {
    const host = new DiceSession("s1", { agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    expect(host.handleRoll(999)).toBe(false);
  });
});

describe("DiceSession baseline", () => {
  it("baseline:true → openingPrompt 去教条(不含形状表)", () => {
    const s = new DiceSession("t-bl-1", { agentFactory: () => ({ async *runTurn() {} }) as Agent, db: memDb(), baseline: true });
    expect(s.openingPrompt).toContain("Dicelore GM");
    expect(s.openingPrompt).not.toContain("形状表");
  });

  it("baseline:true → handleMessage 给 agentFactory 的 skills=[];非 baseline 用 deps.skills", async () => {
    let captured: AgentInit | null = null;
    const fac = (init: AgentInit): Agent => {
      captured = init;
      return { async *runTurn() { yield { type: "turn_end" } } };
    };
    const s = new DiceSession("t-bl-2", { agentFactory: fac, db: memDb(), baseline: true, skills: [{ name: "x", srcDir: "/x" }] });
    await s.handleMessage("hi");
    expect(captured!.skills).toEqual([]);

    const s2 = new DiceSession("t-bl-3", { agentFactory: fac, db: memDb(), skills: [{ name: "x", srcDir: "/x" }] });
    await s2.handleMessage("hi");
    expect(captured!.skills).toEqual([{ name: "x", srcDir: "/x" }]);
  });
});
