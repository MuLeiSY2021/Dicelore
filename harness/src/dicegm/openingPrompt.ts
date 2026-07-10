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
import { buildSessionContext } from "./adapter/sessionContext.js";
import { getLogger } from "@dicelore/logs";
import type { SessionBackend } from "@dicelore/interface";
import type { PluginRef } from "../runtime/agent.js";
import { ensureSkillPlugin } from "../runtime/skillPlugin.js";

// dice skill 母本线根解析(<pkg>/src/dicegm,含 .claude-plugin/plugin.json + skills/)。
// 本文件在 src/dicegm,故母本线根 = 本文件所在目录;cwd 兜底供 tsx 跑源码/异常定位失败时。
function diceSkillRoot(): string | null {
  const candidates: string[] = [];
  try {
    candidates.push(dirname(fileURLToPath(import.meta.url)));
  } catch (e) { getLogger().warn({ err: e }, "resolve dice skill 母本线根失败,走 cwd 兜底"); }
  candidates.push(`${process.cwd()}/harness/src/dicegm`);
  for (const d of candidates) if (existsSync(join(d, ".claude-plugin", "plugin.json"))) return d;
  return null;
}

// dice skill plugin:boot 期幂等 + 版本感知物化母本(gm-core + 4 flows)到数据根 $/dice,
// 返回运行期 PluginRef(pluginDir=$/dice, skills:"all")。母本定位失败 → ensureSkillPlugin 内 fail loud 返 null。
// server.ts boot 时调一次,PluginRef 经 DiceSession → AgentInit 传下。
export function ensureDicePlugin(dataRoot: string): PluginRef | null {
  return ensureSkillPlugin(diceSkillRoot(), dataRoot, "dice", "all");
}

// 战后复盘指令（debrief-and-branch §一.3，C2 skill=debrief-mode）。
// harness 检测 game_end(session_meta「ended」已置)→ 后续 AI 回合叠加此指令切复盘行为。
// 软约束(C3=忽略)：不硬禁 roll_staged/choices/game_end，仅靠 prompt 引导 AI 不推进剧情。
// 与 skills/dicelore-debrief-mode/SKILL.md 同源(该 skill 经 dice plugin 物化、渐进披露；此处内联同旨指令确保生效)。
export const DEBRIEF_DIRECTIVE =
  "# 战后复盘模式（本局已终结）\n\n" +
  "本局已调用 game_end 终结，进入战后复盘。此后你的职责是**复盘**，不是继续游戏：\n" +
  "- 不推进剧情、不开启新冲突、不铺设新场景；\n" +
  "- 回答玩家对结局、过程、人物动机、关键抉择的提问；\n" +
  "- 需要回忆细节时可调只读工具 browse（world/rule/log）辅助回答；\n" +
  "- 玩家若想从某个节点重来，提示其可回档/开新分支续玩，而非在本终局线继续。";

// 开场 prompt = 引擎 signpost(GM 身份/Agenda/纪律) + 团本 prologue(AD-2 叠加)。
//
// 教条不再内联(裁决 skill-loading-by-reference §2 退役内联兜底):gm-core 教条只经 plugin 加载的
// dicelore-gm-core skill 单路径投递。plugin 母本定位/加载失败 = 系统 bug,由 ensureDicePlugin 内
// getLogger().error + 返 null(fail loud),不再退回内联教条。
//
// 战后复盘(debrief-and-branch §一)：session_meta「ended」已置 → 叠加 DEBRIEF_DIRECTIVE 切复盘行为。
export function buildOpeningPrompt(backend: SessionBackend): string {
  const signpost = buildSessionContext(backend);
  const prologue = backend.metaGet("prologue");
  const base = prologue ? `${signpost}\n\n---\n\n# 团本开场\n\n${prologue}` : signpost;
  if (backend.metaGet("ended") !== undefined) return `${base}\n\n---\n\n${DEBRIEF_DIRECTIVE}`;
  return base;
}

// baseline 系统提示。教条既已退役内联,buildOpeningPrompt(=signpost+prologue)已等同原 buildBaselinePrompt——
// baseline 对照改由「plugin 传 undefined = 不加载 gm-core skill = 无教条」达成(见 DiceSession/gmAssembly)。
// 本别名留一个过渡周期不删,避免外部消费者(index 导出)骤断。
export const buildBaselinePrompt = buildOpeningPrompt;
