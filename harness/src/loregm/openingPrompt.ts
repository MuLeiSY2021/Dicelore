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
// build-pack skill 真源本阶段仍在 packages/core/build-skills/(物理迁 harness/loregm/skills 留后续阶段);
// 经 import.meta.url 上溯 monorepo 根定位,再 cwd 兜底——不再 require.resolve("@dicelore/core")
// (5b 后无人消费 @dicelore/core barrel,好让 5c 干净溶解 core)。
function buildPackDir(): string | null {
  const candidates: string[] = [];
  try {
    // 本文件 harness/src/loregm/openingPrompt.ts → 上溯四级到 monorepo 根。
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
    candidates.push(join(root, "packages", "core", "build-skills", "dicelore-build-pack"));
  } catch (e) { getLogger().warn({ err: e }, "resolve build-pack 源目录失败,走 cwd 兜底"); }
  candidates.push(`${process.cwd()}/packages/core/build-skills/dicelore-build-pack`);
  for (const d of candidates) if (existsSync(`${d}/SKILL.md`)) return d;
  return null;
}

// dicelore-build-pack 作为 staged skill 的引用(server 注入 lore skills);
// 源目录不存在则返回 null(跑团侧 gmCoreSkill() 的同构处理)。
export function buildPackSkill(): SkillRef | null {
  const dir = buildPackDir();
  return dir ? { name: "dicelore-build-pack", srcDir: dir } : null;
}
