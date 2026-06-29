// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getLogger } from "@dicelore/logs";
import type { SkillRef } from "../runtime/agent.js";

// 会话本地 skill 副本(spec AD-3):把源 skill 目录整拷进一个临时 cwd 的 `.claude/skills/<name>`,
// 让适配器以该 cwd 起 agent(settingSources:["project"])时能加载到这些 skill 供自助查阅
// (harness 自调 Read/Skill,渐进披露)。源 skill 只读;副本用完即清(cleanupSkills)。
// 「副本」是关键:harness 若热更 skill 只动副本,不污染源(用户洞察)。
export function stageSkills(key: string, skills: SkillRef[]): string {
  const root = join(tmpdir(), `dicelore-skills-${key}`);
  const skillsDir = join(root, ".claude", "skills");
  mkdirSync(skillsDir, { recursive: true });
  for (const s of skills) cpSync(s.srcDir, join(skillsDir, s.name), { recursive: true });
  return root;
}

export function cleanupSkills(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch (e) { getLogger().warn({ err: e, dir }, "cleanup skill 副本失败(已删/不存在),预期降级"); }
}
