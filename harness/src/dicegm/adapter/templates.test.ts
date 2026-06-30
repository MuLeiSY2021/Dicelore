// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { claudeMdPointer, settingsJson, mcpJson } from "./templates.js";

describe("init 模板", () => {
  it("CLAUDE.md 指针含诚实仲裁者 + consult gm-core", () => {
    const md = claudeMdPointer();
    expect(md).toContain("诚实仲裁者");
    expect(md).toContain("dicelore-gm-core");
  });

  it(".mcp.json 注册 dicelore(stdio + npx dicelore mcp + env)", () => {
    const m = mcpJson({ session: "修仙团" }) as any;
    expect(m.mcpServers.dicelore.type).toBe("stdio");
    expect(m.mcpServers.dicelore.command).toBe("npx");
    expect(m.mcpServers.dicelore.args).toEqual(["dicelore", "mcp"]);
    expect(m.mcpServers.dicelore.env.DICELORE_SESSION).toBe("修仙团");
  });

  it("settings.json 只配三 hook(exec form node + tsx loader)、不含 mcpServers", () => {
    const s = settingsJson({ hooksDir: "/abs/hooks" }) as any;
    expect(s.mcpServers).toBeUndefined(); // MCP 归 .mcp.json,CC 不从 settings 读
    expect(Object.keys(s.hooks).sort()).toEqual(["SessionStart", "Stop", "UserPromptSubmit"].sort());
    const stop = s.hooks.Stop[0].hooks[0];
    expect(stop.command).toBe("node");
    expect(stop.args).toEqual(["--import", "tsx", "/abs/hooks/turn-end.ts"]);
  });
});
