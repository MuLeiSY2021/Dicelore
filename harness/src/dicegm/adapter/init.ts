// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// packages/core/src/adapter/init.ts
import { cpSync, mkdirSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { claudeMdPointer, settingsJson, mcpJson } from "./templates.js";

// 本文件在 src/dicegm/adapter/。dice 线 skills 真源在角色线根 src/dicegm/skills(ADAPTER_DIR/../skills),
// hook 入口在 src/dicegm/adapter/hooks(ADAPTER_DIR/hooks)。
const ADAPTER_DIR = dirname(fileURLToPath(import.meta.url));
const DICEGM_DIR = join(ADAPTER_DIR, "..");
const SKILLS_SRC = join(DICEGM_DIR, "skills");
const HOOKS_SRC = join(ADAPTER_DIR, "hooks");

const FLOWS = ["gacha", "contest", "anka", "explore"];

export function runInit(opts: { projectDir: string; session: string }): void {
  const { projectDir, session } = opts;
  const claudeDir = join(projectDir, ".claude");
  mkdirSync(claudeDir, { recursive: true });

  // .mcp.json:项目级 MCP server 归项目根(CC 不从 settings.json 读 mcpServers)。
  writeFileSync(join(projectDir, ".mcp.json"), JSON.stringify(mcpJson({ session }), null, 2) + "\n");

  // settings.json:只配三 hook(用包内 hooks 绝对路径,node --import tsx,见 templates)。
  const settings = settingsJson({ hooksDir: HOOKS_SRC });
  writeFileSync(join(claudeDir, "settings.json"), JSON.stringify(settings, null, 2) + "\n");

  // skills:默认全装 gm-core + 全部四 flow(留 manifest 过滤接口位:将来按 opts.flows 子集)。
  const skillsDst = join(claudeDir, "skills");
  mkdirSync(skillsDst, { recursive: true });
  cpSync(join(SKILLS_SRC, "dicelore-gm-core"), join(skillsDst, "dicelore-gm-core"), { recursive: true });
  for (const f of FLOWS) {
    cpSync(join(SKILLS_SRC, `dicelore-flow-${f}`), join(skillsDst, `dicelore-flow-${f}`), { recursive: true });
  }

  // CLAUDE.md 指针:已存在则追加。
  const claudeMd = join(projectDir, "CLAUDE.md");
  const pointer = "\n" + claudeMdPointer();
  if (existsSync(claudeMd)) appendFileSync(claudeMd, pointer);
  else writeFileSync(claudeMd, pointer.trimStart());
}
