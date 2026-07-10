// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { Agent, TurnInput, TurnEvent, BuildInvoke } from "../runtime/agent.js";

// 脚本化 lore 构建驱动：测试/联调用，不烧 LLM。对称 dice 侧 FakeDiceGm 教练档——
// 经组合根(api/lore)注入的 buildInvoke 通道调 dicelore_build_* 工具改 in-memory Draft，
// 让 FAKE_GM=1 下的构建会话产出**非空 Draft**(否则 echo 档不调工具 → Draft 恒空、GET /draft 空壳)。
//
// 一条「构建动作」= 一次构建工具调用。默认脚本(defaultBuildScript)写足一份最小可校验团本骨架:
// manifest + prologue + 一篇 lore + 一条 rule + 一格开局状态 —— toPackFiles/snapshot 立即非空。
export type BuildAction = { tool: string; args: unknown };
export type BuildScript = BuildAction[] | ((input: TurnInput) => BuildAction[]);

// 默认假构建脚本:按作者指令回声写入,累积出一份非空 Draft。每轮幂等键(manifest/prologue/lore/rule)覆盖写、
// 只有 set_state 追加,故多轮 send_to_builder 不会炸(与真构建 GM 多轮累积语义一致)。
export function defaultBuildScript(input: TurnInput): BuildAction[] {
  const t = (input.text ?? "").slice(0, 40) || "无题";
  return [
    { tool: "set_manifest", args: { name: "假构建团本", id: "fake-adventure" } },
    { tool: "set_prologue", args: { text: `你站在故事的起点。作者的指令是：「${t}」。` } },
    { tool: "write_lore", args: { name: "世界设定", content: `这是一个由假构建驱动写入的世界：${t}。` } },
    { tool: "write_rule", args: { name: "核心判定", content: "以 1d100 判定成败：51 及以上为成功。" } },
    { tool: "set_state", args: { cells: [{ entity: "玩家", kind: "player", attr: "HP", value: "20", visible: 1 }] } },
  ];
}

export class FakeLoreGm implements Agent {
  private readonly script: BuildScript;
  private readonly invoke?: BuildInvoke;

  // buildInvoke 缺省(未接线,如纯 catalog 单测)时退化为「只叙事、不写 Draft」——不炸,但 Draft 保持空。
  constructor(buildInvoke?: BuildInvoke, script: BuildScript = defaultBuildScript) {
    this.invoke = buildInvoke;
    this.script = script;
  }

  async *runTurn(input: TurnInput): AsyncIterable<TurnEvent> {
    const actions = typeof this.script === "function" ? this.script(input) : this.script;
    if (this.invoke) {
      for (const a of actions) {
        const r = this.invoke(a.tool, a.args);
        if (r?.isError) {
          yield { type: "error", message: `假构建工具 ${a.tool} 失败`, code: "build_tool_error" };
          return;
        }
      }
    }
    // REST only(RT-5):lore 不广播散文。产一段 narration + turn_end,供 LoreSession.handleMessage 收尾。
    yield { type: "narration", text: `（构建 GM）已按指令更新 Draft：${(input.text ?? "").slice(0, 40)}` };
    yield { type: "turn_end" };
  }
}
