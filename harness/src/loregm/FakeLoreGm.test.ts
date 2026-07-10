// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openCatalog, Draft, invokeBuildTool, type BuildCtx } from "@dicelore/backend";
import { FakeLoreGm, defaultBuildScript } from "./FakeLoreGm.js";
import type { TurnEvent, BuildInvoke } from "../runtime/agent.js";

// 组合根等价装配:Draft + ctx + buildInvoke(=真 api/lore 注入的同一通道)。
function wire(): { draft: Draft; buildInvoke: BuildInvoke } {
  const catalog = openCatalog(":memory:");
  const draft = new Draft();
  const ctx: BuildCtx = { catalog, draft, name: "假构建团本" };
  return { draft, buildInvoke: (n, a) => invokeBuildTool(ctx, n, a) };
}

async function drain(agent: FakeLoreGm, text: string): Promise<TurnEvent[]> {
  const out: TurnEvent[] = [];
  for await (const e of agent.runTurn({ text })) out.push(e);
  return out;
}

describe("FakeLoreGm 假构建驱动", () => {
  it("经 buildInvoke 调构建工具 → Draft 非空(toPackFiles/snapshot 有内容)", async () => {
    const { draft, buildInvoke } = wire();
    expect(draft.toPackFiles().length).toBe(0); // 起步空

    const events = await drain(new FakeLoreGm(buildInvoke), "造一个江湖团本");

    // Draft 被写满:manifest + prologue + lore + rule + state。
    const files = draft.toPackFiles();
    expect(files.length).toBeGreaterThan(0);
    const paths = files.map((f) => f.path);
    expect(paths.some((p) => p.includes("manifest"))).toBe(true);
    expect(paths.some((p) => p.includes("prologue"))).toBe(true);
    const snap = draft.snapshot();
    expect(snap.manifest?.name).toBe("假构建团本");
    expect(Object.keys(snap.world).length).toBeGreaterThan(0); // 至少一篇 lore
    expect(Object.keys(snap.rules).length).toBeGreaterThan(0); // 至少一条 rule

    // 收尾:narration + turn_end(REST only,不广播)。
    expect(events.at(-1)).toEqual({ type: "turn_end" });
    expect(events.some((e) => e.type === "narration")).toBe(true);
  });

  it("多轮 send 累积到同一 Draft 不炸(幂等键覆盖 + state 追加)", async () => {
    const { draft, buildInvoke } = wire();
    const agent = new FakeLoreGm(buildInvoke);
    await drain(agent, "第一轮");
    await drain(agent, "第二轮");
    const snap = draft.snapshot();
    expect(snap.manifest?.name).toBe("假构建团本"); // 幂等覆盖,未重复报错
    expect(snap.sheets.cells.length).toBeGreaterThanOrEqual(2); // set_state 追加了两轮
  });

  it("buildInvoke 缺省(未接线)→ 只叙事、不写 Draft、不炸", async () => {
    const draft = new Draft();
    const events = await drain(new FakeLoreGm(undefined), "无通道");
    expect(draft.toPackFiles().length).toBe(0);
    expect(events.at(-1)).toEqual({ type: "turn_end" });
  });

  it("buildInvoke 返回 isError → 冒 error 事件、提前中止", async () => {
    const events = await drain(new FakeLoreGm(() => ({ isError: true })), "触发失败");
    expect(events[0]).toMatchObject({ type: "error", code: "build_tool_error" });
    expect(events.some((e) => e.type === "turn_end")).toBe(false);
  });

  it("defaultBuildScript 按作者指令回声,产 5 个构建动作", () => {
    const actions = defaultBuildScript({ text: "凡人修仙" });
    expect(actions.map((a) => a.tool)).toEqual(["set_manifest", "set_prologue", "write_lore", "write_rule", "set_state"]);
  });
});
