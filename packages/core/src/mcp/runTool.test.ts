import { describe, it, expect } from "vitest";
import { z } from "zod";
import { runTool } from "./runTool.js";
import type { ToolDef } from "./tooldef.js";
import { DiceloreError } from "../errors.js";

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

  it("handler throw DiceloreError → 错误信封,无 structuredContent", async () => {
    const t = makeTool({ handler: () => { throw new DiceloreError("NOT_FOUND", "没了"); } });
    const env = await runTool(db, t, { x: 1 });
    expect(env.isError).toBe(true);
    expect("structuredContent" in env).toBe(false);
    expect(JSON.parse(env.content[0].text).error.code).toBe("NOT_FOUND");
  });

  it("ZodError(入参非法)→ 错误信封 INTERNAL", async () => {
    const env = await runTool(db, makeTool({}), { x: "not a number" });
    expect(env.isError).toBe(true);
    expect(JSON.parse(env.content[0].text).error.code).toBe("INTERNAL");
  });
});
