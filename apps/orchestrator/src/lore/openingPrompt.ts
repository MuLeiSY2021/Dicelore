// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import type { SkillRef } from "../pkg/agent.js";

// dicelore-build-pack skill 源目录解析(供 staged skill 整目录拷入构建 agent 的临时 cwd)。
// 路径解析策略与 gmCoreDir() 同构:先 require.resolve @dicelore/core 换 build-skills 路径,
// 再 cwd 兜底。
function buildPackDir(): string | null {
  const candidates: string[] = [];
  try {
    const req = createRequire(import.meta.url);
    candidates.push(req.resolve("@dicelore/core").replace(/src[/\\]index\.ts$/, "build-skills/dicelore-build-pack"));
  } catch { /* resolve 失败走 cwd 兜底 */ }
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
