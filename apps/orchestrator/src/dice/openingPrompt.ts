// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { buildSessionContext, getLogger } from "@dicelore/core";
import type { SessionBackend } from "@dicelore/interface";
import type { SkillRef } from "../pkg/agent.js";

// gm-core skill 源目录解析(供内联兜底读 SKILL.md + staged skill 取整目录)。
function gmCoreDir(): string | null {
  const candidates: string[] = [];
  try {
    const req = createRequire(import.meta.url);
    candidates.push(req.resolve("@dicelore/core").replace(/src[/\\]index\.ts$/, "skills/dicelore-gm-core"));
  } catch (e) { getLogger().warn({ err: e }, "resolve @dicelore/core 失败,走 cwd 兜底"); }
  candidates.push(`${process.cwd()}/packages/core/skills/dicelore-gm-core`);
  for (const d of candidates) if (existsSync(`${d}/SKILL.md`)) return d;
  return null;
}

// gm-core 作为 staged skill 的引用(server 注入 dice skills);源目录不存在则返回 null(只走内联兜底)。
export function gmCoreSkill(): SkillRef | null {
  const dir = gmCoreDir();
  return dir ? { name: "dicelore-gm-core", srcDir: dir } : null;
}

// 开场 prompt = 引擎 signpost(GM 身份/Agenda/纪律) + gm-core 教条全文 + 团本 prologue(AD-2 叠加)。
//
// gm-core 教条内联进 systemPrompt 作**保证投递**兜底(即便 staged skill 加载不通,GM 仍有教条入戏);
// staged skill(见 DiceGm)在此之上额外提供 references/ 深层内容供 GM 按需 Read(渐进披露)。
function gmCoreDoctrine(): string {
  const dir = gmCoreDir();
  if (!dir) return "";
  try {
    const raw = readFileSync(`${dir}/SKILL.md`, "utf8");
    return raw.replace(/^---[\s\S]*?---\s*/, "").replace(/<!--[\s\S]*?-->/g, "").trim();
  } catch (e) { getLogger().warn({ err: e }, "读 SKILL.md 失败,返回空字符串兜底"); return ""; }
}

let _doctrine: string | null = null;
function doctrine(): string { return (_doctrine ??= gmCoreDoctrine()); }

export function buildOpeningPrompt(backend: SessionBackend): string {
  const signpost = buildSessionContext(backend);
  const prologue = backend.metaGet("prologue");
  const core = doctrine();
  const head = core ? `${signpost}\n\n---\n\n${core}` : signpost;
  return prologue ? `${head}\n\n---\n\n# 团本开场\n\n${prologue}` : head;
}

// baseline 系统提示:signpost + prologue,**不含 gm-core 教条**(用于 harness baseline 对照,
// 分离"教条有无")。与 buildOpeningPrompt 的区别仅是去掉 doctrine 段。
export function buildBaselinePrompt(backend: SessionBackend): string {
  const signpost = buildSessionContext(backend);
  const prologue = backend.metaGet("prologue");
  return prologue ? `${signpost}\n\n---\n\n# 团本开场\n\n${prologue}` : signpost;
}
