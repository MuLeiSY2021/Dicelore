// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openCatalog } from "../catalog/db.js";
import { Draft } from "./draft.js";
import { invokeBuildTool, type BuildCtx } from "./buildMcp.js";

function ctx(): BuildCtx {
  return { catalog: openCatalog(":memory:"), draft: new Draft(), name: "凡人" };
}

// ── validate ─────────────────────────────────────────────────────────────────
describe("dicelore_build_validate", () => {
  it("空 draft → ok=false（空团本包）", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "validate", {});
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as { ok: boolean; issues: unknown[] };
    // draft 无文件 → validate 报空包错误
    expect(out.ok).toBe(false);
    expect(out.issues.length).toBeGreaterThan(0);
    c.catalog.close();
  });

  it("有合法内容的 draft → ok=true", () => {
    const c = ctx();
    invokeBuildTool(c, "write_lore", { name: "设定", content: "江南正道。" });
    invokeBuildTool(c, "set_prologue", { text: "游戏开始。" });
    const r = invokeBuildTool(c, "validate", {});
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as { ok: boolean; issues: unknown[] };
    expect(out.ok).toBe(true);
    c.catalog.close();
  });

  it("issues 字段存在且是数组", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "validate", {});
    const out = JSON.parse(r.content[0].text) as { ok: boolean; issues: unknown[] };
    expect(Array.isArray(out.issues)).toBe(true);
    c.catalog.close();
  });
});

// ── read ─────────────────────────────────────────────────────────────────────
describe("dicelore_build_read", () => {
  it("无 section 参数 → 回读全部域内容", () => {
    const c = ctx();
    invokeBuildTool(c, "set_manifest", { name: "凡人修仙传", id: "fanren" });
    invokeBuildTool(c, "write_lore", { name: "黄枫谷", content: "正道" });
    invokeBuildTool(c, "write_rule", { name: "修炼", content: "练气→筑基" });
    const r = invokeBuildTool(c, "read", {});
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as Record<string, unknown>;
    expect(out).toHaveProperty("manifest");
    expect(out).toHaveProperty("world");
    expect(out).toHaveProperty("rules");
    c.catalog.close();
  });

  it("section=manifest → 只返回 manifest 字段", () => {
    const c = ctx();
    invokeBuildTool(c, "set_manifest", { name: "凡人修仙传", id: "fanren" });
    const r = invokeBuildTool(c, "read", { section: "manifest" });
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as Record<string, unknown>;
    expect(out).toHaveProperty("manifest");
    expect(out).not.toHaveProperty("lore");
    c.catalog.close();
  });

  it("section=world → 返回 world 键（lore/world 域）", () => {
    const c = ctx();
    invokeBuildTool(c, "write_lore", { name: "山门", content: "山门巍峨。" });
    const r = invokeBuildTool(c, "read", { section: "world" });
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as Record<string, unknown>;
    expect(out).toHaveProperty("world");
    c.catalog.close();
  });

  it("section=rules → 返回 rules 键", () => {
    const c = ctx();
    invokeBuildTool(c, "write_rule", { name: "炼丹", content: "入门炼丹。" });
    const r = invokeBuildTool(c, "read", { section: "rules" });
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as Record<string, unknown>;
    expect(out).toHaveProperty("rules");
    c.catalog.close();
  });

  it("section=pools → 返回 pools 键", () => {
    const c = ctx();
    invokeBuildTool(c, "add_pool", { pool: "灵根", rows: [{ 名称: "天灵根" }] });
    const r = invokeBuildTool(c, "read", { section: "pools" });
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as Record<string, unknown>;
    expect(out).toHaveProperty("pools");
    c.catalog.close();
  });

  it("section=fronts → 返回 fronts 键", () => {
    const c = ctx();
    invokeBuildTool(c, "add_front", {
      id: "invasion",
      name: "魔道入侵",
      clock_attr: "世界.入侵进度",
      clock_min: 0,
      clock_max: 8,
      omens: [{ threshold: 4, payload: "边境沦陷" }],
    });
    const r = invokeBuildTool(c, "read", { section: "fronts" });
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as Record<string, unknown>;
    expect(out).toHaveProperty("fronts");
    c.catalog.close();
  });

  it("非法 section 值 → isError", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "read", { section: "bogus" });
    expect(r.isError).toBe(true);
    c.catalog.close();
  });
});

// ── add_front ─────────────────────────────────────────────────────────────────
describe("dicelore_build_add_front", () => {
  it("写出 fronts/<id>.md — frontmatter 含 clock/min/max/mode", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "add_front", {
      id: "invasion",
      name: "魔道入侵",
      clock_attr: "世界.入侵进度",
      clock_min: 0,
      clock_max: 8,
      clock_mode: "once",
      omens: [
        { threshold: 3, payload: "边境小镇沦陷的消息传来" },
        { threshold: 6, payload: "黄枫谷外围弟子折损" },
        { threshold: 8, payload: "魔道破阵，正面决战" },
      ],
    });
    expect(r.isError).toBeFalsy();

    // 通过 toPackFiles 检查产出
    const files = c.draft.toPackFiles();
    const front = files.find((f) => f.path === "fronts/invasion.md");
    expect(front).toBeDefined();

    // frontmatter 含 clock/min/max/mode
    expect(front!.content).toMatch(/^---/);
    expect(front!.content).toContain("clock: 世界.入侵进度");
    expect(front!.content).toContain("min: 0");
    expect(front!.content).toContain("max: 8");
    expect(front!.content).toContain("mode: once");
    c.catalog.close();
  });

  it("凶兆阶梯表格包含每个 threshold + payload", () => {
    const c = ctx();
    invokeBuildTool(c, "add_front", {
      id: "inv2",
      name: "天雷降临",
      clock_attr: "世界.天雷",
      clock_min: 0,
      clock_max: 6,
      omens: [
        { threshold: 2, payload: "初现征兆" },
        { threshold: 4, payload: "雷声隆隆" },
        { threshold: 6, payload: "天雷落地" },
      ],
    });

    const files = c.draft.toPackFiles();
    const front = files.find((f) => f.path === "fronts/inv2.md");
    expect(front).toBeDefined();
    const content = front!.content;
    // body 含凶兆阶梯表格行
    expect(content).toContain("| 2 |");
    expect(content).toContain("初现征兆");
    expect(content).toContain("| 4 |");
    expect(content).toContain("雷声隆隆");
    expect(content).toContain("| 6 |");
    expect(content).toContain("天雷落地");
    c.catalog.close();
  });

  it("name 写入 body 标题", () => {
    const c = ctx();
    invokeBuildTool(c, "add_front", {
      id: "inv3",
      name: "灵脉枯竭",
      clock_attr: "世界.灵脉",
      clock_min: 0,
      clock_max: 4,
      omens: [{ threshold: 2, payload: "灵气稀薄" }],
    });
    const files = c.draft.toPackFiles();
    const front = files.find((f) => f.path === "fronts/inv3.md");
    expect(front!.content).toContain("灵脉枯竭");
    c.catalog.close();
  });

  it("stakes 若提供则出现在 body 利害问题里", () => {
    const c = ctx();
    invokeBuildTool(c, "add_front", {
      id: "inv4",
      name: "妖族侵扰",
      stakes: "门派能否抵挡妖族入侵？",
      clock_attr: "世界.妖族",
      clock_min: 0,
      clock_max: 5,
      omens: [{ threshold: 3, payload: "边境告急" }],
    });
    const files = c.draft.toPackFiles();
    const front = files.find((f) => f.path === "fronts/inv4.md");
    expect(front!.content).toContain("门派能否抵挡妖族入侵？");
    c.catalog.close();
  });

  it("validate 通过 fronts 的 Rule 6 校验", () => {
    const c = ctx();
    // 先添加 sheets 定义 clock attr，避免 Rule 7 警告影响 ok
    invokeBuildTool(c, "set_state", {
      cells: [{ entity: "世界", kind: "world", attr: "入侵进度", value: "0" }],
    });
    invokeBuildTool(c, "add_front", {
      id: "invv",
      name: "入侵",
      clock_attr: "世界.入侵进度",
      clock_min: 0,
      clock_max: 8,
      clock_mode: "once",
      omens: [{ threshold: 4, payload: "告急" }],
    });
    const vr = invokeBuildTool(c, "validate", {});
    const vout = JSON.parse(vr.content[0].text) as { ok: boolean; issues: { level: string; file: string; msg: string }[] };
    // Rule 6 errors (clock missing, min>max, bad mode) should NOT be present
    const rule6errors = vout.issues.filter((i) => i.level === "error" && i.file.startsWith("fronts/"));
    expect(rule6errors).toHaveLength(0);
    c.catalog.close();
  });

  it("缺必填字段 id → isError", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "add_front", {
      name: "魔道入侵",
      clock_attr: "世界.入侵进度",
      clock_min: 0,
      clock_max: 8,
      omens: [],
    });
    expect(r.isError).toBe(true);
    c.catalog.close();
  });

  it("多次调用同 id → 后者覆盖（只有一个文件）", () => {
    const c = ctx();
    invokeBuildTool(c, "add_front", {
      id: "dup",
      name: "第一版",
      clock_attr: "世界.钟",
      clock_min: 0,
      clock_max: 4,
      omens: [{ threshold: 2, payload: "第一次" }],
    });
    invokeBuildTool(c, "add_front", {
      id: "dup",
      name: "第二版",
      clock_attr: "世界.钟",
      clock_min: 0,
      clock_max: 4,
      omens: [{ threshold: 2, payload: "第二次" }],
    });
    const files = c.draft.toPackFiles().filter((f) => f.path === "fronts/dup.md");
    expect(files).toHaveLength(1);
    expect(files[0].content).toContain("第二版");
    c.catalog.close();
  });
});

// ── add_plotline ──────────────────────────────────────────────────────────────
describe("dicelore_build_add_plotline", () => {
  it("写出 plotlines/main.csv，含 id/title/summary/status 列", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "add_plotline", {
      rows: [{ id: "p1", title: "黄枫谷危机", summary: "妖兽袭谷", status: "open" }],
    });
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as { ok: boolean };
    expect(out.ok).toBe(true);
    const file = c.draft.toPackFiles().find((f) => f.path === "plotlines/main.csv");
    expect(file).toBeDefined();
    // 首行列头固定为 id,title,summary,status
    expect(file!.content).toMatch(/^id,title,summary,status\n/);
    expect(file!.content).toContain("p1");
    expect(file!.content).toContain("黄枫谷危机");
    expect(file!.content).toContain("妖兽袭谷");
    c.catalog.close();
  });

  it("summary/status 可省略", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "add_plotline", { rows: [{ id: "p2", title: "只有标题" }] });
    expect(r.isError).toBeFalsy();
    const file = c.draft.toPackFiles().find((f) => f.path === "plotlines/main.csv");
    expect(file!.content).toContain("p2");
    expect(file!.content).toContain("只有标题");
    c.catalog.close();
  });

  it("多次调用追加行（非幂等）", () => {
    const c = ctx();
    invokeBuildTool(c, "add_plotline", { rows: [{ id: "a", title: "甲" }] });
    invokeBuildTool(c, "add_plotline", { rows: [{ id: "b", title: "乙" }] });
    const file = c.draft.toPackFiles().find((f) => f.path === "plotlines/main.csv");
    expect(file!.content).toContain("甲");
    expect(file!.content).toContain("乙");
    c.catalog.close();
  });

  it("缺必填字段 title → isError", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "add_plotline", { rows: [{ id: "x" }] });
    expect(r.isError).toBe(true);
    c.catalog.close();
  });

  it("空 rows → isError", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "add_plotline", { rows: [] });
    expect(r.isError).toBe(true);
    c.catalog.close();
  });

  it("validate 不报 plotlines CSV 列错误", () => {
    const c = ctx();
    invokeBuildTool(c, "set_prologue", { text: "开场。" });
    invokeBuildTool(c, "add_plotline", { rows: [{ id: "p1", title: "主线" }] });
    const vr = invokeBuildTool(c, "validate", {});
    const vout = JSON.parse(vr.content[0].text) as { ok: boolean; issues: { level: string; file: string }[] };
    expect(vout.issues.some((i) => i.level === "error" && i.file.startsWith("plotlines/"))).toBe(false);
    c.catalog.close();
  });
});

// ── add_foreshadow ──────────────────────────────────────────────────────────────
describe("dicelore_build_add_foreshadow", () => {
  it("写出 foreshadows/main.csv，含 id/content/status 列", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "add_foreshadow", {
      rows: [{ id: "f1", content: "墙上挂着一柄古剑", status: "planted" }],
    });
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as { ok: boolean };
    expect(out.ok).toBe(true);
    const file = c.draft.toPackFiles().find((f) => f.path === "foreshadows/main.csv");
    expect(file).toBeDefined();
    expect(file!.content).toMatch(/^id,content,status\n/);
    expect(file!.content).toContain("f1");
    expect(file!.content).toContain("墙上挂着一柄古剑");
    c.catalog.close();
  });

  it("status 可省略", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "add_foreshadow", { rows: [{ id: "f2", content: "无状态伏笔" }] });
    expect(r.isError).toBeFalsy();
    const file = c.draft.toPackFiles().find((f) => f.path === "foreshadows/main.csv");
    expect(file!.content).toContain("无状态伏笔");
    c.catalog.close();
  });

  it("多次调用追加行（非幂等）", () => {
    const c = ctx();
    invokeBuildTool(c, "add_foreshadow", { rows: [{ id: "f1", content: "一" }] });
    invokeBuildTool(c, "add_foreshadow", { rows: [{ id: "f2", content: "二" }] });
    const file = c.draft.toPackFiles().find((f) => f.path === "foreshadows/main.csv");
    expect(file!.content).toContain("一");
    expect(file!.content).toContain("二");
    c.catalog.close();
  });

  it("缺必填字段 content → isError", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "add_foreshadow", { rows: [{ id: "x" }] });
    expect(r.isError).toBe(true);
    c.catalog.close();
  });

  it("空 rows → isError", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "add_foreshadow", { rows: [] });
    expect(r.isError).toBe(true);
    c.catalog.close();
  });

  it("validate 不报 foreshadows CSV 列错误", () => {
    const c = ctx();
    invokeBuildTool(c, "set_prologue", { text: "开场。" });
    invokeBuildTool(c, "add_foreshadow", { rows: [{ id: "f1", content: "伏笔" }] });
    const vr = invokeBuildTool(c, "validate", {});
    const vout = JSON.parse(vr.content[0].text) as { ok: boolean; issues: { level: string; file: string }[] };
    expect(vout.issues.some((i) => i.level === "error" && i.file.startsWith("foreshadows/"))).toBe(false);
    c.catalog.close();
  });
});

// ── add_anchor ──────────────────────────────────────────────────────────────────
describe("dicelore_build_add_anchor", () => {
  it("写出 anchors/main.csv，含 owner/target/role 列", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "add_anchor", {
      rows: [{ owner_table: "npc", owner_id: "墨大夫", target_table: "plotline", target_id: "p1", role: "推动者" }],
    });
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as { ok: boolean };
    expect(out.ok).toBe(true);
    const file = c.draft.toPackFiles().find((f) => f.path === "anchors/main.csv");
    expect(file).toBeDefined();
    expect(file!.content).toMatch(/^owner_table,owner_id,target_table,target_id,role\n/);
    expect(file!.content).toContain("墨大夫");
    expect(file!.content).toContain("推动者");
    c.catalog.close();
  });

  it("role 可省略", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "add_anchor", {
      rows: [{ owner_table: "npc", owner_id: "甲", target_table: "foreshadow", target_id: "f1" }],
    });
    expect(r.isError).toBeFalsy();
    const file = c.draft.toPackFiles().find((f) => f.path === "anchors/main.csv");
    expect(file!.content).toContain("foreshadow");
    c.catalog.close();
  });

  it("多次调用追加行（非幂等）", () => {
    const c = ctx();
    invokeBuildTool(c, "add_anchor", { rows: [{ owner_table: "npc", owner_id: "甲", target_table: "plotline", target_id: "p1" }] });
    invokeBuildTool(c, "add_anchor", { rows: [{ owner_table: "npc", owner_id: "乙", target_table: "plotline", target_id: "p2" }] });
    const file = c.draft.toPackFiles().find((f) => f.path === "anchors/main.csv");
    expect(file!.content).toContain("p1");
    expect(file!.content).toContain("p2");
    c.catalog.close();
  });

  it("缺必填字段 target_id → isError", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "add_anchor", {
      rows: [{ owner_table: "npc", owner_id: "甲", target_table: "plotline" }],
    });
    expect(r.isError).toBe(true);
    c.catalog.close();
  });

  it("空 rows → isError", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "add_anchor", { rows: [] });
    expect(r.isError).toBe(true);
    c.catalog.close();
  });

  it("validate 不报 anchors CSV 列错误", () => {
    const c = ctx();
    invokeBuildTool(c, "set_prologue", { text: "开场。" });
    invokeBuildTool(c, "add_anchor", {
      rows: [{ owner_table: "npc", owner_id: "甲", target_table: "plotline", target_id: "p1" }],
    });
    const vr = invokeBuildTool(c, "validate", {});
    const vout = JSON.parse(vr.content[0].text) as { ok: boolean; issues: { level: string; file: string }[] };
    expect(vout.issues.some((i) => i.level === "error" && i.file.startsWith("anchors/"))).toBe(false);
    c.catalog.close();
  });
});

// ── set_prologue ──────────────────────────────────────────────────────────────
describe("dicelore_build_set_prologue", () => {
  it("返回 { ok: true }，draft 产出 prologue.md", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "set_prologue", { text: "游戏开始，请 GM 开场。" });
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0].text) as { ok: boolean };
    expect(out.ok).toBe(true);
    const prologueFile = c.draft.toPackFiles().find((f) => f.path === "prologue.md");
    expect(prologueFile).toBeDefined();
    expect(prologueFile!.content).toBe("游戏开始，请 GM 开场。");
    c.catalog.close();
  });

  it("多次调用 → 后者覆盖，只有一个 prologue.md", () => {
    const c = ctx();
    invokeBuildTool(c, "set_prologue", { text: "第一版开场。" });
    invokeBuildTool(c, "set_prologue", { text: "第二版开场。" });
    const prologueFiles = c.draft.toPackFiles().filter((f) => f.path === "prologue.md");
    expect(prologueFiles).toHaveLength(1);
    expect(prologueFiles[0].content).toBe("第二版开场。");
    c.catalog.close();
  });

  it("缺 text 字段 → isError", () => {
    const c = ctx();
    const r = invokeBuildTool(c, "set_prologue", {});
    expect(r.isError).toBe(true);
    c.catalog.close();
  });

  it("设置 prologue 后 validate 不再报 prologue 缺失错误", () => {
    const c = ctx();
    invokeBuildTool(c, "write_lore", { name: "设定", content: "世界观。" });
    invokeBuildTool(c, "set_prologue", { text: "GM，请开始游戏！" });
    const vr = invokeBuildTool(c, "validate", {});
    const vout = JSON.parse(vr.content[0].text) as { ok: boolean; issues: { level: string; file: string; msg: string }[] };
    expect(vout.issues.some((i) => i.file === "prologue.md" && i.level === "error")).toBe(false);
    expect(vout.ok).toBe(true);
    c.catalog.close();
  });
});
