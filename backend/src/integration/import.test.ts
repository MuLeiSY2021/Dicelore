// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import {
  openDb,
  initSchema,
  loreGet,
  ruleGet,
  stateGet,
  watcherList,
  openCatalog,
  commit,
  tag,
  importPack,
  validatePack,
  parseFront,
} from "@dicelore/backend";

const PACK = [
  { path: "manifest.md", content: "# 凡人修仙传\n\n- id: fanren" },
  { path: "prologue.md", content: "你是 GM，请开始游戏。" },
  { path: "lore/黄枫谷.md", content: "黄枫谷乃江南正道。" },
  { path: "rules/修炼体系.md", content: "练气→筑基→结丹" },
  { path: "pools/灵根.csv", content: "名称,品级,weight\n天灵根,上品,1\n五灵根,下品,51\n" },
  { path: "state/开局.csv", content: "entity,kind,attr,value,visible\n韩立,player,资质,五灵根,1\n墨大夫,npc,好感度,0,2\n" },
];

describe("importPack", () => {
  it("checkout 某版本 → 物化 lore/rule/pool/state 到运行库", () => {
    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "凡人修仙传", files: PACK, message: "init", createdAt: "2026-01-01" });
    const run = openDb(":memory:"); initSchema(run);
    const res = importPack(cat, run, r.tuanbenId, r.commitId);
    expect(res).toMatchObject({ lore: 1, rules: 1, pools: 2, stateCells: 2, fronts: 0, plotlines: 0, foreshadows: 0, anchors: 0 });
    expect(res.tuanbenName).toBe("凡人修仙传"); // manifest H1
    expect(loreGet(run, "黄枫谷")?.content).toBe("黄枫谷乃江南正道。");
    expect(ruleGet(run, "修炼体系")?.content).toBe("练气→筑基→结丹");
    expect((run.prepare("SELECT COUNT(*) n FROM pool").get() as { n: number }).n).toBe(2);
    const cell = run.prepare("SELECT kind, value, visible FROM state WHERE entity='墨大夫' AND attr='好感度'").get() as { kind: string; value: string; visible: number };
    expect(cell).toEqual({ kind: "npc", value: "0", visible: 2 });
    cat.close(); run.close();
  });

  it("prologue.md 回传(不物化进 store)", () => {
    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "魔道", files: [
      { path: "manifest.md", content: "# 魔道" },
      { path: "prologue.md", content: "夜色如墨,你立于鹰愁涧口。" },
      { path: "lore/x.md", content: "甲" },
    ], message: "init", createdAt: "2026-01-01" });
    const run = openDb(":memory:"); initSchema(run);
    const res = importPack(cat, run, r.tuanbenId, r.commitId);
    expect(res.prologue).toBe("夜色如墨,你立于鹰愁涧口。");
    expect(res.tuanbenName).toBe("魔道");
    // prologue 不进 lore/store
    expect((run.prepare("SELECT COUNT(*) n FROM lore").get() as { n: number }).n).toBe(1);
    cat.close(); run.close();
  });

  it("checkout(tag label) 也能物化", () => {
    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "x", files: [{ path: "lore/a.md", content: "甲" }, { path: "prologue.md", content: "开场。" }], message: "init", createdAt: "2026-01-01" });
    tag(cat, { tuanbenId: r.tuanbenId, commitId: r.commitId, label: "v1" });
    const run = openDb(":memory:"); initSchema(run);
    importPack(cat, run, r.tuanbenId, "v1");
    expect(loreGet(run, "a")?.content).toBe("甲");
    cat.close(); run.close();
  });

  it("validatePack:空包 / 未知路径段 / state 缺列 → ok=false", () => {
    expect(validatePack([]).ok).toBe(false);
    expect(validatePack([{ path: "evil/x.md", content: "" }]).ok).toBe(false);
    expect(validatePack([{ path: "state/x.csv", content: "foo,bar\n1,2\n" }]).ok).toBe(false);
    expect(validatePack([{ path: "lore/x.md", content: "ok" }, { path: "prologue.md", content: "开场。" }]).ok).toBe(true);
  });

  it("importPack 对坏包抛错(信任闸门)", () => {
    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "bad", files: [{ path: "evil/x.md", content: "" }], message: "init", createdAt: "2026-01-01" });
    const run = openDb(":memory:"); initSchema(run);
    expect(() => importPack(cat, run, r.tuanbenId, r.commitId)).toThrow(/信任闸门/);
    cat.close(); run.close();
  });
});

// ── parseFront 单元测试 ───────────────────────────────────────────────────────
const FRONT_MD = `---
clock: 世界.入侵进度
min: 0
max: 8
mode: once
visible: 1
---

# 入侵威胁

| 钟值 | 凶兆 |
| ---- | ---- |
| 3 | 凶兆①：斥候出现在边境。 |
| 6 | 凶兆②：大军压境。 |
| 8 | 凶兆③（终局）：城陷。 |
`;

describe("parseFront", () => {
  it("解析 frontmatter 字段", () => {
    const r = parseFront(FRONT_MD);
    expect(r).not.toBeNull();
    expect(r!.clock).toBe("世界.入侵进度");
    expect(r!.min).toBe(0);
    expect(r!.max).toBe(8);
    expect(r!.mode).toBe("once");
    expect(r!.visible).toBe(1);
  });

  it("解析 H1 为 name", () => {
    const r = parseFront(FRONT_MD);
    expect(r!.name).toBe("入侵威胁");
  });

  it("解析凶兆阶梯为 omens 数组", () => {
    const r = parseFront(FRONT_MD);
    expect(r!.omens).toHaveLength(3);
    expect(r!.omens[0]).toEqual({ threshold: 3, payload: "凶兆①：斥候出现在边境。" });
    expect(r!.omens[1]).toEqual({ threshold: 6, payload: "凶兆②：大军压境。" });
    expect(r!.omens[2]).toEqual({ threshold: 8, payload: "凶兆③（终局）：城陷。" });
  });

  it("无 visible 时默认为 undefined", () => {
    const noVisible = FRONT_MD.replace("visible: 1\n", "");
    const r = parseFront(noVisible);
    expect(r!.visible).toBeUndefined();
  });

  it("无凶兆表时 omens 为空数组", () => {
    const noTable = `---\nclock: 世界.进度\nmin: 0\nmax: 4\nmode: once\n---\n# 威胁\n无凶兆。\n`;
    const r = parseFront(noTable);
    expect(r!.omens).toEqual([]);
  });

  it("无 frontmatter 时返回 null", () => {
    expect(parseFront("# 只有标题\n")).toBeNull();
  });
});

// ── front 完整物化（Clock 初始化 + 凶兆→watcher）────────────────────────────
const FRONT_FILE_CONTENT = `---
clock: 世界.入侵进度
min: 0
max: 8
mode: once
visible: 1
---

# 入侵威胁

| 钟值 | 凶兆 |
| ---- | ---- |
| 3 | 凶兆①：斥候出现在边境。 |
| 6 | 凶兆②：大军压境。 |
| 8 | 凶兆③（终局）：城陷。 |
`;

describe("importPack front 物化(Clock init + 凶兆→watcher)", () => {
  function buildPack() {
    return [
      { path: "prologue.md", content: "GM 请开场。" },
      { path: "manifest.md", content: "# 侵略之战" },
      { path: "fronts/invasion.md", content: FRONT_FILE_CONTENT },
    ];
  }

  it("front 表有行：id / name / clock_ref 正确", () => {
    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "侵略之战", files: buildPack(), message: "init", createdAt: "2026-01-01" });
    const run = openDb(":memory:"); initSchema(run);
    importPack(cat, run, r.tuanbenId, r.commitId);
    const front = run.prepare("SELECT id, name, clock_ref FROM front WHERE id='invasion'").get() as { id: string; name: string; clock_ref: string } | undefined;
    expect(front).toBeDefined();
    expect(front!.name).toBe("入侵威胁");
    expect(front!.clock_ref).toBe("世界.入侵进度");
    cat.close(); run.close();
  });

  it("Clock 初始化：state 行 value=min，visible=1，clock_min/max/mode 正确", () => {
    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "侵略之战", files: buildPack(), message: "init", createdAt: "2026-01-01" });
    const run = openDb(":memory:"); initSchema(run);
    importPack(cat, run, r.tuanbenId, r.commitId);
    const cell = run.prepare(
      "SELECT value, visible, clock_min, clock_max, clock_mode FROM state WHERE entity='世界' AND attr='入侵进度'"
    ).get() as { value: string; visible: number; clock_min: number; clock_max: number; clock_mode: string } | undefined;
    expect(cell).toBeDefined();
    expect(cell!.value).toBe("0");      // min=0
    expect(cell!.visible).toBe(1);
    expect(cell!.clock_min).toBe(0);
    expect(cell!.clock_max).toBe(8);
    expect(cell!.clock_mode).toBe("once");
    cat.close(); run.close();
  });

  it("凶兆阶梯 → 每行一条 active watcher，condition/payload/mode/source 正确", () => {
    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "侵略之战", files: buildPack(), message: "init", createdAt: "2026-01-01" });
    const run = openDb(":memory:"); initSchema(run);
    importPack(cat, run, r.tuanbenId, r.commitId);
    const watchers = watcherList(run).filter((w) => w.source === "front:invasion");
    expect(watchers).toHaveLength(3);
    expect(watchers[0].condition).toBe("{世界.入侵进度} >= 3");
    expect(watchers[0].payload).toBe("凶兆①：斥候出现在边境。");
    expect(watchers[0].mode).toBe("once");
    expect(watchers[1].condition).toBe("{世界.入侵进度} >= 6");
    expect(watchers[2].condition).toBe("{世界.入侵进度} >= 8");
    cat.close(); run.close();
  });

  it("ImportResult.fronts 计数正确", () => {
    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "侵略之战", files: buildPack(), message: "init", createdAt: "2026-01-01" });
    const run = openDb(":memory:"); initSchema(run);
    const res = importPack(cat, run, r.tuanbenId, r.commitId);
    expect(res.fronts).toBe(1);
    cat.close(); run.close();
  });
});

// ── 作者面 tools/*.json：import → 编译 → 装载（DT-9 作者侧）─────────────────
import { foreshadowList, stateSet, stateGet as stateGetCell, openSessionBackend } from "@dicelore/backend";
import { wrapToolForTest } from "@dicelore/harness";
import { BUILTIN_TOOL_NAMES } from "@dicelore/harness";

describe("importPack 作者面 tools/*.json（DT-9）", () => {
  const TOOLS_JSON = JSON.stringify([
    { name: "author_plant", desc: "作者埋伏笔", params: { id: "string", content: "string" }, sql: "INSERT INTO foreshadow (id, content) VALUES (:id, :content)" },
    { name: "author_gold", desc: "作者加钱", params: { who: "string", n: "int" }, sql: "UPDATE sheet SET 金币 = 金币 + :n WHERE entity = :who" },
  ]);
  function buildPack() {
    return [
      { path: "prologue.md", content: "GM 开场。" },
      { path: "manifest.md", content: "# 带工具的团本" },
      { path: "tools/author.json", content: TOOLS_JSON },
    ];
  }

  it("import 回传 toolDefs：编译为运行时 ToolDef（不物化进 store）", () => {
    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "带工具的团本", files: buildPack(), message: "init", createdAt: "2026-01-01" });
    const run = openDb(":memory:"); initSchema(run);
    const res = importPack(cat, run, r.tuanbenId, r.commitId);
    expect(res.toolDefs.map((t) => t.name).sort()).toEqual(["author_gold", "author_plant"]);
    // tools 不进 store：无意外 lore/state 行
    expect((run.prepare("SELECT COUNT(*) n FROM foreshadow").get() as { n: number }).n).toBe(0);
    cat.close(); run.close();
  });

  it("装载链路：import → createMcpServer(extraTools) → 调用落库 + 承重墙不破", async () => {
    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "带工具的团本", files: buildPack(), message: "init", createdAt: "2026-01-01" });
    const run = openDb(":memory:"); initSchema(run);
    const res = importPack(cat, run, r.tuanbenId, r.commitId);
    // 仿 DiceSession：把 import 出的 toolDefs 经 extraTools 注入 MCP
    const invoke = wrapToolForTest(openSessionBackend(run), run, {}, res.toolDefs);
    // 作者写工具：埋伏笔（落 foreshadow 表）
    const plant = (await invoke("author_plant", { id: "fs1", content: "断剑" })) as { isError?: boolean };
    expect(plant.isError).toBeFalsy();
    expect(foreshadowList(run)).toHaveLength(1);
    expect(foreshadowList(run)[0]).toMatchObject({ id: "fs1", content: "断剑" });
    // 作者 mutate 工具：经 applyMutations 正典路径加钱
    stateSet(run, "韩立", "金币", "10");
    const gold = (await invoke("author_gold", { who: "韩立", n: 5 })) as { isError?: boolean };
    expect(gold.isError).toBeFalsy();
    expect(stateGetCell(run, "韩立", "金币")?.value).toBe("15");
    // 承重墙不破：框架标准工具仍可调（作者工具是叠加，非替换）
    expect(BUILTIN_TOOL_NAMES.includes("sheet_update")).toBe(true);
    cat.close(); run.close();
  });

  it("坏声明（DROP）在信任闸门被拒：importPack 抛错", () => {
    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "恶意团本", files: [
      { path: "prologue.md", content: "开场。" },
      { path: "tools/evil.json", content: JSON.stringify([{ name: "evil", sql: "DROP TABLE state" }]) },
    ], message: "init", createdAt: "2026-01-01" });
    const run = openDb(":memory:"); initSchema(run);
    expect(() => importPack(cat, run, r.tuanbenId, r.commitId)).toThrow(/信任闸门/);
    cat.close(); run.close();
  });
});
