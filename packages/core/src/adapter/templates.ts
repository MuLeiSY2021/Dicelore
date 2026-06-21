// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// packages/core/src/adapter/templates.ts
import { join } from "node:path";

export function claudeMdPointer(): string {
  return [
    "## Dicelore GM",
    "",
    "你是 Dicelore GM——**世界的诚实仲裁者,不是玩家的取悦者**。",
    "每轮主持先 consult `dicelore-gm-core` skill;尊重骰子、声明后果在先、非终局轮留 `resolve_choice`。",
    "随机与取数全在 MCP 工具内执行,你只给引用、不编造真值。",
    "",
  ].join("\n");
}

// hook 命令:node --import tsx <abs>.ts(包内 hook 入口,跨端、原生 resolve core、不踩 .cmd shim)。
function hookCmd(hooksDir: string, name: string) {
  return { type: "command", command: "node", args: ["--import", "tsx", join(hooksDir, `${name}.ts`)] };
}

// 项目级 MCP server 归项目根 .mcp.json(CC 不从 .claude/settings.json 读 mcpServers)。
// command=npx dicelore mcp 是已发布包的预期形态;首启会话需用户批准项目级 server。
export function mcpJson(opts: { session: string }): object {
  return {
    mcpServers: {
      dicelore: {
        type: "stdio",
        command: "npx",
        args: ["dicelore", "mcp"],
        env: { DICELORE_SESSION: opts.session },
      },
    },
  };
}

// settings.json 只配 hooks(MCP 归 mcpJson / .mcp.json)。
export function settingsJson(opts: { hooksDir: string }): object {
  const { hooksDir } = opts;
  return {
    hooks: {
      SessionStart: [{ hooks: [hookCmd(hooksDir, "session-start")] }],
      UserPromptSubmit: [{ hooks: [hookCmd(hooksDir, "turn-start")] }],
      Stop: [{ hooks: [hookCmd(hooksDir, "turn-end")] }],
    },
  };
}
