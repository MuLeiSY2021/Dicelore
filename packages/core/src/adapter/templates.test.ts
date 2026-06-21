// packages/core/src/adapter/templates.test.ts
import { describe, it, expect } from "vitest";
import { claudeMdPointer, settingsJson } from "./templates.js";

describe("init 模板", () => {
  it("CLAUDE.md 指针含诚实仲裁者 + consult gm-core", () => {
    const md = claudeMdPointer();
    expect(md).toContain("诚实仲裁者");
    expect(md).toContain("dicelore-gm-core");
  });

  it("settings.json 注册 dicelore MCP + 三 hook、exec form node、带 tsx loader", () => {
    const s = settingsJson({ session: "修仙团", hooksDir: "/abs/hooks" }) as any;
    expect(s.mcpServers.dicelore.env.DICELORE_SESSION).toBe("修仙团");
    expect(Object.keys(s.hooks).sort()).toEqual(["SessionStart", "Stop", "UserPromptSubmit"].sort());
    const stop = s.hooks.Stop[0].hooks[0];
    expect(stop.command).toBe("node");
    expect(stop.args).toEqual(["--import", "tsx", "/abs/hooks/turn-end.ts"]);
  });
});
