// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// eval harness 自测：覆盖 offline 驱动路径（eval/batch.ts·eval/tool.ts 共用的 runTool+TOOLS），
// 端到端跑 掷骰(roll) / 选择(choose) / 召回(browse) / 错误路径 / 场景枚举(list_scenarios)。
// 全程零 LLM、零真 MCP server——直接对内存 db 跑 runTool，与 harness 实跑同一引擎。
import { describe, it, expect, beforeEach } from "vitest";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import {
  openDb,
  initSchema,
  type DB,
  logSince,
  logRecall,
  loadScenario,
  rollFloor,
  closureFloor,
  openSessionBackend,
} from "@dicelore/backend";
import { makeTools } from "@dicelore/harness";
import { runTool } from "@dicelore/harness";

// 内置工具 handler 经注入的 SessionBackend 调存储——故工具须绑定到本测试的同一 db
// (storage-port ADR §4)。每次按当前 db 造工具，名字命中即取。
function tool(name: string) {
  const t = makeTools(openSessionBackend(db)).find((x) => x.name === name);
  if (!t) throw new Error(`测试 fixture 引用了不存在的工具: ${name}`);
  return t;
}

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  initSchema(db);
});

// ── list_scenarios 等价：枚举 backend/eval/scenarios 下全部场景，loadScenario 都能读、且 expects 合法 ──
describe("场景枚举（list_scenarios 等价：所有 scenario.json 可加载且 schema 合法）", () => {
  // scenario 数据随 eval 模块迁入 @dicelore/backend（backend/eval/scenarios/）。
  // 经 backend 包入口（src/index.ts）定位其包根，拼出数据目录——跨包稳健，不靠 core↔backend 的相对层级。
  const require = createRequire(import.meta.url);
  const backendPkgRoot = dirname(dirname(require.resolve("@dicelore/backend")));
  const scenariosDir = join(backendPkgRoot, "eval", "scenarios");
  const ids = readdirSync(scenariosDir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));

  it("至少有一个场景（兜底防空目录）", () => {
    expect(ids.length).toBeGreaterThan(0);
  });

  it.each(ids)("loadScenario(%s) 字段完整 + expects（若有）类型合法", (id) => {
    const s = loadScenario(id);
    expect(s.id).toBe(id);
    expect(s.playerTurns.length).toBeGreaterThan(0);
    expect(Array.isArray(s.focus)).toBe(true);
    if (s.expects) {
      if (s.expects.minVerdicts !== undefined) expect(typeof s.expects.minVerdicts).toBe("number");
      if (s.expects.closure !== undefined) expect(typeof s.expects.closure).toBe("boolean");
    }
  });
});

// ── roll 路径：resolve_outcome_hidden 经 runTool 真掷 → 落 verdict event → F1 地板看得见 ──
describe("掷骰路径（runTool resolve_outcome_hidden 真掷、落 verdict）", () => {
  it("成功掷骰 → structuredContent 带 roll/band + 落一条 verdict", async () => {
    const res = await runTool(db, tool("resolve_outcome_hidden"), {
      context: "命中检定",
      die: "1d20",
      bands: [{ min: 1, max: 20, label: "结果", plan: "命中要害", narration: "刀锋掠过" }],
    });
    expect(res.isError).toBeFalsy();
    const sc = res.structuredContent as { roll: number; event_id: number };
    expect(sc.roll).toBeGreaterThanOrEqual(1);
    expect(sc.roll).toBeLessThanOrEqual(20);
    const events = logSince(db, 0);
    expect(events.filter((e) => e.kind === "verdict").length).toBe(1);
  });

  it("掷骰后 F1 地板 pass（expects.minVerdicts=1 被满足）", async () => {
    await runTool(db, tool("resolve_outcome_hidden"), {
      context: "命中", die: "1d6", bands: [{ min: 1, max: 6, label: "r", plan: "", narration: "" }],
    });
    const f1 = rollFloor(logSince(db, 0), { minVerdicts: 1 });
    expect(f1.floor).toBe("pass");
  });
});

// ── choose 路径：resolve_choice 暂存待选项（玩家在分支处做主） ──
describe("选择路径（runTool resolve_choice 暂存待选项）", () => {
  it("staged=true + 回显 options", async () => {
    const res = await runTool(db, tool("resolve_choice"), {
      prompt: "往哪走？",
      options: [
        { label: "森林", consequence: "猎物多" },
        { label: "草原", consequence: "开阔" },
      ],
    });
    expect(res.isError).toBeFalsy();
    const sc = res.structuredContent as { staged: boolean; options: unknown[] };
    expect(sc.staged).toBe(true);
    expect(sc.options.length).toBe(2);
  });

  it("选项少于 2 → 错误路径（BAD_INPUT，不带 structuredContent）", async () => {
    const res = await runTool(db, tool("resolve_choice"), {
      prompt: "只有一个？",
      options: [{ label: "唯一", consequence: "x" }],
    });
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toBeUndefined();
  });
});

// ── browse 路径：narrate 落 event → logRecall 召回（GM 调取历史的检索面） ──
describe("召回路径（narrate 落 event → logRecall 命中）", () => {
  it("narrate 写入后可被 logRecall 检索到", async () => {
    await runTool(db, tool("narrate"), { text: "你坐在断锚酒馆最里的桌子，雨敲打着窗。" });
    const hits = logRecall(db, "断锚酒馆");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => (h.content ?? "").includes("断锚酒馆"))).toBe(true);
  });

  it("无匹配查询 → 空集（不抛）", () => {
    const hits = logRecall(db, "不存在的关键词xyz");
    expect(hits).toEqual([]);
  });
});

// ── 错误路径：未知工具 / 入参非法，runTool 走 errorEnvelope、绝不带 structuredContent ──
describe("错误路径（runTool errorEnvelope，绝不泄漏 structuredContent）", () => {
  it("入参缺必填字段 → isError + 字段级错误消息", async () => {
    const res = await runTool(db, tool("resolve_outcome_hidden"), { context: "缺 die 和 bands" });
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toBeUndefined();
    const body = JSON.parse(res.content[0].text) as { error: { code: string } };
    expect(body.error.code).toBe("BAD_INPUT");
  });

  it("die 非单骰串 → isError（引擎校验）", async () => {
    const res = await runTool(db, tool("resolve_outcome_hidden"), {
      context: "坏骰串", die: "abc", bands: [{ min: 1, max: 6, label: "r", plan: "", narration: "" }],
    });
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toBeUndefined();
  });
});

// ── 端到端：散文绕过掷骰 → F1 抓得住；收束信号 → F2 advisory ──
describe("端到端（F1/F2 地板在真 event 流上的行为）", () => {
  it("只 narrate 不掷骰但 expects.minVerdicts=1 → F1 fail（绕过被抓）", async () => {
    await runTool(db, tool("narrate"), { text: "你一刀砍翻了哥布林，它当场毙命。" });
    const f1 = rollFloor(logSince(db, 0), { minVerdicts: 1 });
    expect(f1.floor).toBe("fail");
    expect(f1.verdictCount).toBe(0);
  });

  it("含收束词的 narrate → F2 signalPresent=true（advisory）", async () => {
    await runTool(db, tool("narrate"), { text: "至此，这趟狩猎告一段落，你拖着猎物回营。" });
    const f2 = closureFloor(logSince(db, 0), { closure: true });
    expect(f2.signalPresent).toBe(true);
    expect(f2.floor).toBe("advisory");
  });
});
