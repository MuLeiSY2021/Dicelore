// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { getLogger } from "@dicelore/logs";
import type { PluginRef } from "../runtime/agent.js";
import { ensureSkillPlugin } from "../runtime/skillPlugin.js";

// lore skill 母本线根解析(<pkg>/src/loregm,含 .claude-plugin/plugin.json + skills/)。
// 本文件在 src/loregm,故母本线根 = 本文件所在目录,与跑团侧 diceSkillRoot 对称。
function loreSkillRoot(): string | null {
  const candidates: string[] = [];
  try {
    candidates.push(dirname(fileURLToPath(import.meta.url)));
  } catch (e) { getLogger().warn({ err: e }, "resolve lore skill 母本线根失败,走 cwd 兜底"); }
  candidates.push(`${process.cwd()}/harness/src/loregm`);
  for (const d of candidates) if (existsSync(join(d, ".claude-plugin", "plugin.json"))) return d;
  return null;
}

// lore skill plugin:boot 期幂等 + 版本感知物化母本(build-pack + build-core)到数据根 $/lore,
// 返回运行期 PluginRef(pluginDir=$/lore, skills:"all")。母本定位失败 → ensureSkillPlugin 内 fail loud 返 null。
// server.ts boot 时调一次,PluginRef 经 createLoreApp → LoreSession → AgentInit 传下。
export function ensureLorePlugin(dataRoot: string): PluginRef | null {
  return ensureSkillPlugin(loreSkillRoot(), dataRoot, "lore", "all");
}
