// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, beforeEach } from "vitest";
import { openDb, initSchema, metaGet, setRollGate } from "@dicelore/core";
import { FakeDiceGm } from "./FakeDiceGm.js";
import { DiceSession } from "./DiceSession.js";
import type { TurnEvent } from "../pkg/agent.js";

// ── 向后兼容：纯叙事档(server.ts 默认工厂 + 既有单测用法) ────────────────────
describe("FakeDiceGm 纯叙事档", () => {
  it("按脚本异步吐出事件序列", async () => {
    const script: TurnEvent[] = [{ type: "narration", text: "你推门进去。" }, { type: "turn_end" }];
    const drv = new FakeDiceGm(script);
    const got: TurnEvent[] = [];
    for await (const e of drv.runTurn({ text: "我推门" })) got.push(e);
    expect(got).toEqual(script);
  });

  it("脚本可按输入定制(函数形式)", async () => {
    const drv = new FakeDiceGm((input) => [{ type: "narration", text: `收到:${input.text}` }, { type: "turn_end" }]);
    const got: TurnEvent[] = [];
    for await (const e of drv.runTurn({ text: "压价" })) got.push(e);
    expect(got[0]).toEqual({ type: "narration", text: "收到:压价" });
  });
});

const memDb = () => { const d = openDb(":memory:"); initSchema(d); return d; };

// 每个 case 前清模块级 rollGate(createMcpServer 会按本会话 gate 重设;残留 gate 会串台)。
beforeEach(() => setRollGate(undefined));

// ── 教练档：驱动五条玩家主线(无真 LLM)。经真 DiceSession + WsHub 端到端验证。 ──
describe("FakeDiceGm 教练档：五条玩家主线", () => {
  // 主线①：掷骰
  it("roll 动作 → 暂存待掷 + 经 PlayerRollGate 广播 roll_staged，玩家点掷后回合收尾", async () => {
    const db = memDb();
    const host = new DiceSession("s-roll", {
      db,
      agentFactory: () => new FakeDiceGm({ db, canon: [
        { type: "narration", text: "你扑向高墙。" },
        { type: "roll", context: "翻越高墙", die: "1d20", bands: [{ label: "成功", min: 11, max: 20 }] },
      ] }),
    });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });

    // runTurn 在 await rollGate 处挂起(roll_staged 已广播)；先拿到挂起的 promise。
    const turnP = host.handleMessage("我要翻墙");
    await new Promise((r) => setTimeout(r, 0)); // 让微任务跑完:roll_staged 已发、gate 已挂起
    const staged = sent.find((m) => m.type === "roll_staged");
    expect(staged).toBeTruthy();
    expect(staged.pendingRoll.label).toBe("翻越高墙");

    // 玩家点掷 → 解开 gate → 引擎掷 + 回合收尾。
    expect(host.handleRoll(staged.pendingRoll.eventId)).toBe(true);
    const { turnId } = await turnP;
    expect(turnId).toBeTruthy();

    const types = sent.map((m) => m.type);
    expect(types[0]).toBe("turn_started");
    expect(types).toContain("narration_commit");
    expect(types).toContain("roll_staged");
    expect(types.at(-1)).toBe("turn_ended");
  });

  // 主线②：选择
  it("choice 动作 → 回合末物化 pendingChoice → 广播 choices(供 POST /choices 闭环)", async () => {
    const db = memDb();
    const host = new DiceSession("s-choice", {
      db,
      agentFactory: () => new FakeDiceGm({ db, canon: [
        { type: "narration", text: "门口分叉。" },
        { type: "choice", prompt: "走哪条路？", options: [
          { label: "推门进去", consequence: "惊动守卫" },
          { label: "绕到后窗", consequence: "耗时但隐蔽" },
        ] },
      ] }),
    });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });

    await host.handleMessage("我环顾四周");
    const choices = sent.find((m) => m.type === "choices");
    expect(choices).toBeTruthy();
    expect(choices.choices.options.map((o: any) => o.label)).toEqual(["推门进去", "绕到后窗"]);

    // 闭环：玩家选第 2 项 → handleChoice 落「玩家所选」记录 + 据所选作下一回合输入。
    const r = await host.handleChoice(choices.choices.eventId, 1);
    expect(r.turnId).toBeTruthy();
    const chosen = db.prepare("SELECT data_json FROM log WHERE kind='note' AND data_json LIKE '%player_choice%'").get() as { data_json: string } | undefined;
    expect(JSON.parse(chosen!.data_json).player_choice).toMatchObject({ optionIndex: 1, label: "绕到后窗" });
  });

  // 主线③：终局(game_end)
  it("gameEnd 动作 → 落 ended 元(REST ended 真值);onCanonWrite(game_end) 映射出 WS game_end", async () => {
    const db = memDb();
    const host = new DiceSession("s-end", {
      db,
      agentFactory: () => new FakeDiceGm({ db, canon: [
        { type: "narration", text: "巨龙的爪贯穿了你。" },
        { type: "gameEnd", reason: "团灭", outcome: "你死了" },
      ] }),
    });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });

    await host.handleMessage("我冲向巨龙");
    // 终局态落 session_meta.ended（与 REST GET /sessions/:id 的 ended 标志同源,RT-4）。
    const ended = metaGet(db, "ended");
    expect(ended).toBeTruthy();
    const meta = JSON.parse(ended!) as { reason: string; outcome: string; seq: number };
    expect(meta).toMatchObject({ reason: "团灭", outcome: "你死了" });

    // WS game_end 由 MCP game_end 工具经 onCanonWrite 发(fake 直写 db 不过工具,故这里手动驱动映射,
    // 验证 reason/outcome 由 DiceSession.enrich 从 session_meta 补出 → game_end 消息)。
    host.onCanonWrite({ kind: "game_end", seq: meta.seq, toolName: "game_end", output: { ended: true, event_id: meta.seq } });
    const ge = sent.find((m) => m.type === "game_end");
    expect(ge).toMatchObject({ reason: "团灭", outcome: "你死了" });
  });

  // 主线④：错误恢复
  it("error 动作 → 广播 error 且不再发 turn_ended;互斥释放后可开新回合", async () => {
    const db = memDb();
    let first = true;
    const host = new DiceSession("s-err", {
      db,
      agentFactory: () => first
        ? (first = false, new FakeDiceGm({ db, canon: [{ type: "error", message: "GM 回合超时,已脱困" }] }))
        : new FakeDiceGm({ db, canon: [{ type: "narration", text: "你重整旗鼓。" }] }),
    });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });

    await host.handleMessage("我施法");
    const err = sent.find((m) => m.type === "error");
    expect(err).toBeTruthy();
    expect(err.message).toContain("脱困");
    // errored 回合不发 turn_ended(streamDriverTurn errored 提前返回)。
    expect(sent.find((m) => m.type === "turn_ended")).toBeUndefined();

    // 互斥已在 finally 释放 → 下一回合可正常跑(错误恢复)。
    sent.length = 0;
    const r = await host.handleMessage("我换个法子");
    expect(r.turnId).toBeTruthy();
    expect(sent.map((m) => m.type)).toContain("narration_commit");
    expect(sent.at(-1).type).toBe("turn_ended");
  });

  // 主线⑤：断线重连
  it("重连:detach 旧 ws + attach 新 ws,新连接收到新回合全部流消息(旧连接不再收)", async () => {
    const db = memDb();
    const host = new DiceSession("s-reconn", {
      db,
      agentFactory: () => new FakeDiceGm({ db, canon: [{ type: "narration", text: "重连后的新叙事。" }] }),
    });
    const oldWs: any[] = [];
    const newWs: any[] = [];
    const wsOld = { send: (d: string) => oldWs.push(JSON.parse(d)), readyState: 1 };
    host.attachWs(wsOld);

    // 模拟断线:摘掉旧 ws,挂上新 ws。
    host.detachWs(wsOld);
    host.attachWs({ send: (d: string) => newWs.push(JSON.parse(d)), readyState: 1 });

    await host.handleMessage("重连后我继续");
    expect(newWs.map((m) => m.type)).toEqual(expect.arrayContaining(["turn_started", "narration_commit", "turn_ended"]));
    expect(oldWs).toHaveLength(0); // 旧连接已摘除,不再收
  });
});
