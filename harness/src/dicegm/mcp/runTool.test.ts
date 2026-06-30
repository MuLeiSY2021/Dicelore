// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { runTool } from "./runTool.js";
import type { ToolDef } from "./tooldef.js";
import { DiceloreError } from "@dicelore/errors";

const anns = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const db = {} as any;

function makeTool(over: Partial<ToolDef>): ToolDef {
  return {
    name: "echo", title: "Echo", description: "d",
    inputSchema: z.object({ x: z.number() }).strict(),
    outputSchema: z.object({ x: z.number() }).strict(),
    annotations: anns,
    handler: (_db, input) => ({ x: input.x }),
    ...over,
  } as ToolDef;
}

describe("runTool", () => {
  it("成功路径:带 structuredContent", async () => {
    const env = await runTool(db, makeTool({}), { x: 5 });
    expect(env.isError).toBeUndefined();
    expect(env.structuredContent).toEqual({ x: 5 });
  });

  it("await 异步 handler(明骰阻塞路)", async () => {
    const t = makeTool({ handler: async (_db, input) => ({ x: input.x + 1 }) });
    const env = await runTool(db, t, { x: 5 });
    expect(env.structuredContent).toEqual({ x: 6 });
  });

  it("reminders 拼进 structuredContent(用 resolve_choice 名触发恒提醒)", async () => {
    const t = makeTool({ name: "resolve_choice", handler: () => ({ staged: true }) });
    const env = await runTool(db, t, { x: 1 });
    expect((env.structuredContent as any).reminders).toEqual(["后续叙述须与已锁后果一致"]);
  });

  it("resolve_outcome_hidden 命中最低档:经 runTool 挂上反软着陆提醒(band 已被裁,靠 out.roll 反查)", async () => {
    // 模拟真实暗骰 handler 出参:band 只剩 {label,consequence}(无 min),roll 落最低档区间。
    const t = makeTool({
      name: "resolve_outcome_hidden",
      inputSchema: z.object({
        context: z.string(), die: z.string(),
        bands: z.array(z.object({ label: z.string(), min: z.number(), max: z.number(), consequence: z.string() })),
      }).strict(),
      outputSchema: z.object({
        roll: z.number(), die: z.string(),
        band: z.object({ label: z.string(), consequence: z.string() }), event_id: z.number(),
        reminders: z.array(z.string()).optional(),
      }),
      handler: (_db, input: any) => ({ roll: 10, die: input.die, band: { label: "败", consequence: "x" }, event_id: 1 }),
    });
    const input = { context: "c", die: "1d100", bands: [{ label: "败", min: 1, max: 50, consequence: "x" }, { label: "成", min: 51, max: 100, consequence: "y" }] };
    const env = await runTool(db, t, input);
    expect((env.structuredContent as any).reminders).toEqual(["尊重结果,别软着陆"]);
  });

  it("handler throw DiceloreError → 错误信封,无 structuredContent", async () => {
    const t = makeTool({ handler: () => { throw new DiceloreError("NOT_FOUND", "没了"); } });
    const env = await runTool(db, t, { x: 1 });
    expect(env.isError).toBe(true);
    expect("structuredContent" in env).toBe(false);
    expect(JSON.parse(env.content[0].text).error.code).toBe("NOT_FOUND");
  });

  it("ZodError(入参非法)→ 错误信封 BAD_INPUT,message 含字段路径", async () => {
    const env = await runTool(db, makeTool({}), { x: "not a number" });
    expect(env.isError).toBe(true);
    const err = JSON.parse(env.content[0].text).error;
    expect(err.code).toBe("BAD_INPUT");
    expect(err.message).toContain("x");
  });
});
