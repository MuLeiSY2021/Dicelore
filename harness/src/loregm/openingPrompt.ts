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
import type { SkillRef } from "../runtime/agent.js";

// dicelore-build-pack skill 源目录解析(供 staged skill 整目录拷入构建 agent 的临时 cwd)。
// skill 真源随 lore 线归位在本角色线根 <pkg>/src/loregm/skills(本文件在 src/loregm,故同级 ./skills),
// 与跑团侧 gm-core 对称(见 dicegm/openingPrompt gmCoreDir,各线根 ./skills)。
function buildPackDir(): string | null {
  const candidates: string[] = [];
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(join(here, "skills", "dicelore-build-pack"));
  } catch (e) { getLogger().warn({ err: e }, "resolve harness skills 失败,走 cwd 兜底"); }
  candidates.push(`${process.cwd()}/harness/src/loregm/skills/dicelore-build-pack`);
  for (const d of candidates) if (existsSync(`${d}/SKILL.md`)) return d;
  // 兜底全落空：构建 agent 将拿不到 staged skill 教条(无声退化成无教条构建)——告警使其可观测。
  getLogger().warn({ candidates }, "dicelore-build-pack skill 目录解析失败,构建 agent 无 staged 教条");
  return null;
}

// dicelore-build-pack 作为 staged skill 的引用(server 注入 lore skills);
// 源目录不存在则返回 null(跑团侧 gmCoreSkill() 的同构处理)。
export function buildPackSkill(): SkillRef | null {
  const dir = buildPackDir();
  return dir ? { name: "dicelore-build-pack", srcDir: dir } : null;
}
