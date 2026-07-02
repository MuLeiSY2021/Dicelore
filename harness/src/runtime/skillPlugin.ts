// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { cpSync, mkdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { getLogger } from "@dicelore/logs";
import type { PluginRef } from "./agent.js";

// skill 加载「local plugin 按引用」的**共用物化 helper**(裁决 skill-loading-by-reference §1/§2)。
// 两侧(dice/lore)对称去重:各线根 openingPrompt 只负责定位母本线根,物化落数据根 + 版本感知
// 幂等逻辑全在此复用。
//
// 物化语义:
//  · 母本(srcDir,随包发的只读 skill 母本线根,含 .claude-plugin/plugin.json + skills/)
//    → 数据根 pluginRoot($/{role})。
//  · **一次性 + 版本感知**:目标 plugin.json 缺失、或其 version 低于/异于母本 → 从母本 cpSync
//    覆盖 skills/ + .claude-plugin/;version 相等则跳过(不重拷,化解每回合复制的病)。
//  · plugin 扫描只认 skills/、commands/、agents/、hooks/ + .claude-plugin/,同置的 sessions/ 被忽略。

// 半开的语义版本比较:母本 version 与目标不同(含母本更新/降级/损坏)即视为「需重刷」。
// 现只需「相等跳过、否则重刷」——严格版本序不必要(升级代码后首个 boot 自动重刷即达成 staleness 化解)。
function readVersion(pluginJsonPath: string): string | null {
  try {
    const raw = readFileSync(pluginJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

// 幂等 + 版本感知物化母本 skill plugin 到数据根,返回运行期 PluginRef。
//  · srcDir  = 母本线根绝对路径(须含 .claude-plugin/plugin.json;缺 = 母本定位失败 → 返 null)。
//  · dataRoot = 数据根 $(DICELORE_SESSIONS_DIR ?? ".")。
//  · role    = "dice" | "lore",物化目标 = <dataRoot>/<role>。
//  · skills  = 启用的 skill 名单(默认 "all")。
// 母本 plugin.json 不存在 → getLogger().error + 返 null(调用点据此 fail loud,不静默兜底)。
export function ensureSkillPlugin(
  srcDir: string | null,
  dataRoot: string,
  role: "dice" | "lore",
  skills: string[] | "all" = "all",
): PluginRef | null {
  if (!srcDir) {
    getLogger().error({ role, dataRoot }, "skill plugin 母本线根定位失败(srcDir=null),skill 无法加载");
    return null;
  }
  const srcManifest = join(srcDir, ".claude-plugin", "plugin.json");
  if (!existsSync(srcManifest)) {
    getLogger().error({ role, srcDir, srcManifest }, "skill plugin 母本 .claude-plugin/plugin.json 不存在,skill 无法加载");
    return null;
  }

  const pluginDir = join(dataRoot, role);
  const dstManifest = join(pluginDir, ".claude-plugin", "plugin.json");

  const srcVer = readVersion(srcManifest);
  const dstVer = existsSync(dstManifest) ? readVersion(dstManifest) : null;

  // 目标缺失、或版本与母本不一致 → 重刷(先清 skills/ + .claude-plugin/ 再拷,去陈旧子文件)。
  if (dstVer === null || dstVer !== srcVer) {
    try {
      mkdirSync(pluginDir, { recursive: true });
      rmSync(join(pluginDir, "skills"), { recursive: true, force: true });
      rmSync(join(pluginDir, ".claude-plugin"), { recursive: true, force: true });
      cpSync(join(srcDir, "skills"), join(pluginDir, "skills"), { recursive: true });
      cpSync(join(srcDir, ".claude-plugin"), join(pluginDir, ".claude-plugin"), { recursive: true });
      getLogger().info({ role, srcDir, pluginDir, srcVer, dstVer }, "skill plugin 物化到数据根(首次/版本刷新)");
    } catch (e) {
      getLogger().error({ err: e, role, srcDir, pluginDir }, "skill plugin 物化失败,skill 无法加载");
      return null;
    }
  }

  return { pluginDir, skills };
}
