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

export function settingsJson(opts: { session: string; hooksDir: string }): object {
  const { session, hooksDir } = opts;
  return {
    mcpServers: {
      dicelore: { command: "npx", args: ["dicelore", "mcp"], env: { DICELORE_SESSION: session } },
    },
    hooks: {
      SessionStart: [{ hooks: [hookCmd(hooksDir, "session-start")] }],
      UserPromptSubmit: [{ hooks: [hookCmd(hooksDir, "turn-start")] }],
      Stop: [{ hooks: [hookCmd(hooksDir, "turn-end")] }],
    },
  };
}
