// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { SessionTranscript } from "./transcript.js";

// 回退锚点:指向 transcript 树内某一节点 uuid。
export interface RewindAnchor {
  uuid: string;
}

// 领域态回退钩子:注册进 Rewind,回退时按注册序被调用,把各自领域态(sheets/db 等)
// 复位到锚点对应的时刻。任一钩子抛错则整次回退中止、transcript HEAD 不动(避免 transcript
// 与领域态错位)。
export interface RollbackHook {
  readonly name: string;
  rollbackTo(anchor: RewindAnchor): void;
}

// 把 transcript HEAD 的移动(真回退)与领域态回滚编排成一个原子步骤。
// 真回退 = 移 HEAD:先让所有 hook 复位领域态,全部成功后才 moveHead;
// 任一 hook 抛错则不移 HEAD、原样上抛。
export class Rewind {
  private readonly hooks: RollbackHook[] = [];

  constructor(private readonly transcript: SessionTranscript) {}

  register(hook: RollbackHook): void {
    this.hooks.push(hook);
  }

  // 回退到指定 uuid:
  // ① 不在树内则 throw(不动任何东西);
  // ② 按注册序逐 hook.rollbackTo({uuid})(任一抛错则不移 HEAD、原样上抛);
  // ③ 全部成功后 transcript.moveHead(uuid)。
  rewindTo(uuid: string): void {
    if (!this.transcript.hasNode(uuid)) {
      throw new Error(`rewindTo: uuid ${uuid} 不在 transcript 树内`);
    }
    const anchor: RewindAnchor = { uuid };
    for (const hook of this.hooks) {
      hook.rollbackTo(anchor);
    }
    this.transcript.moveHead(uuid);
  }

  // 回退到最近一个已完成回合末:从 livePath 尾往前找第一个 _==='turn_end' 行,
  // 但跳过当前 HEAD 自身(若它就是 turn_end 则取更早一个已完成回合末),取其 uuid
  // 调 rewindTo 并返回锚点;无则 undefined。
  rewindLast(): RewindAnchor | undefined {
    const path = this.transcript.livePath();
    const head = this.transcript.head();
    for (let i = path.length - 1; i >= 0; i--) {
      const line = path[i]!;
      if (line.uuid === head) continue; // 跳过当前 HEAD 自身
      if (line._ === "turn_end") {
        this.rewindTo(line.uuid);
        return { uuid: line.uuid };
      }
    }
    return undefined;
  }
}
