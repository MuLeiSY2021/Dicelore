// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { validatePack } from "./validate.js";
import type { PackFile } from "../../catalog/catalog.js";

// ── helpers ────────────────────────────────────────────────────────────────
const VALID_MANIFEST_YAML = `id: test-pack
version: 1.0.0
name: 测试团本
flows:
  - dicelore-flow-gacha
clock: 世界.年
entry: world/设定.md#引子
`;

const PROLOGUE_FILE = { path: "prologue.md", content: "你是 GM。请根据团本设定开启这次游戏。" };

function hasError(files: PackFile[], substr: string): boolean {
  const r = validatePack(files);
  return r.issues.some((i) => i.level === "error" && i.msg.includes(substr));
}
function hasWarn(files: PackFile[], substr: string): boolean {
  const r = validatePack(files);
  return r.issues.some((i) => i.level === "warn" && i.msg.includes(substr));
}
function isOk(files: PackFile[]): boolean {
  return validatePack(files).ok;
}

// ── Rule 0 (baseline): empty pack ─────────────────────────────────────────
describe("validatePack – Rule 0: empty pack", () => {
  it("空包 → error", () => {
    expect(isOk([])).toBe(false);
    expect(hasError([], "空团本包")).toBe(true);
  });
});

// ── Rule 0b: unknown top-level segment ────────────────────────────────────
describe("validatePack – unknown top segment", () => {
  it("未知顶层路径段 → error", () => {
    expect(hasError([{ path: "evil/x.md", content: "" }], "未知顶层路径段")).toBe(true);
  });

  it("已知路径段 lore/rules/world/pools/params/sheets/fronts/manifest.yaml → ok (no unknown-seg error)", () => {
    const knownPaths = [
      { path: "lore/a.md", content: "ok" },
      { path: "rules/a.md", content: "ok" },
      { path: "world/a.md", content: "ok" },
      { path: "pools/a.csv", content: "名称,weight\nA,1\n" },
      { path: "params/a.csv", content: "label,min\nA,1\n" },
      { path: "sheets/a.csv", content: "entity,attr,value,visible\nX,hp,0,0\n" },
      { path: "fronts/a.md", content: "---\nclock: 世界.入侵\nmin: 0\nmax: 8\nmode: once\n---\n# 阵线\n" },
      { path: "manifest.yaml", content: VALID_MANIFEST_YAML },
      PROLOGUE_FILE,
    ];
    const r = validatePack(knownPaths);
    const unknownErrors = r.issues.filter((i) => i.level === "error" && i.msg.includes("未知顶层路径段"));
    expect(unknownErrors).toHaveLength(0);
  });
});

// ── Rule 1: manifest 必填字段 ─────────────────────────────────────────────
describe("validatePack – Rule 1: manifest required fields", () => {
  it("manifest.yaml 缺 id → error", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "name: 测试\nversion: 1.0.0\n" },
      { path: "lore/a.md", content: "ok" },
    ];
    expect(hasError(files, "manifest")).toBe(true);
    const r = validatePack(files);
    expect(r.issues.some((i) => i.level === "error" && /id/.test(i.msg))).toBe(true);
  });

  it("manifest.yaml 缺 name → error", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: test\nversion: 1.0.0\n" },
      { path: "lore/a.md", content: "ok" },
    ];
    const r = validatePack(files);
    expect(r.issues.some((i) => i.level === "error" && /name/.test(i.msg))).toBe(true);
  });

  it("version 格式非 semver → warn", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: test\nname: 测\nversion: bad-version\n" },
      { path: "lore/a.md", content: "ok" },
    ];
    expect(hasWarn(files, "version")).toBe(true);
  });

  it("version 合法 semver → no version warn", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: test\nname: 测\nversion: 2.3.1\n" },
      { path: "lore/a.md", content: "ok" },
    ];
    const r = validatePack(files);
    expect(r.issues.some((i) => i.msg.includes("version"))).toBe(false);
  });

  it("flows 非数组(是字符串) → error", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: test\nname: 测\nversion: 1.0.0\nflows: not-an-array\n" },
      { path: "lore/a.md", content: "ok" },
    ];
    const r = validatePack(files);
    expect(r.issues.some((i) => i.level === "error" && /flows/.test(i.msg))).toBe(true);
  });

  it("flows 合法数组 → no flows error", () => {
    const files: PackFile[] = [{ path: "manifest.yaml", content: VALID_MANIFEST_YAML }, { path: "lore/a.md", content: "ok" }];
    const r = validatePack(files);
    expect(r.issues.some((i) => i.level === "error" && /flows/.test(i.msg))).toBe(false);
  });

  it("完整合法的 manifest.yaml → ok（包含 entry 和 clock 引用的资源）", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: VALID_MANIFEST_YAML },
      { path: "world/设定.md", content: "设定内容\n## 引子\n故事开始了" },
      { path: "sheets/开局.csv", content: "entity,attr,value,visible\n世界,年,0,0\n" },
      PROLOGUE_FILE,
    ];
    expect(isOk(files)).toBe(true);
  });
});

// ── Rule 2: manifest.flows 引用完整性 ────────────────────────────────────
describe("validatePack – Rule 2: flows reference", () => {
  it("flows 引用的 skill 名不以 dicelore-flow- 开头 → warn 未知 flow", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\nflows:\n  - some-unknown-skill\n" },
      { path: "lore/a.md", content: "ok" },
    ];
    expect(hasWarn(files, "some-unknown-skill")).toBe(true);
  });

  it("flows 引用以 dicelore-flow- 开头 → no warn", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\nflows:\n  - dicelore-flow-gacha\n  - dicelore-flow-contest\n" },
      { path: "lore/a.md", content: "ok" },
    ];
    const r = validatePack(files);
    expect(r.issues.some((i) => i.level === "warn" && /flow/.test(i.msg))).toBe(false);
  });
});

// ── Rule 3: manifest.clock attr 存在性 ───────────────────────────────────
describe("validatePack – Rule 3: manifest.clock attr exists", () => {
  it("manifest.clock 声明的 attr 在 sheets/ 中不存在 → warn", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\nclock: 世界.年\n" },
      { path: "lore/a.md", content: "ok" },
    ];
    expect(hasWarn(files, "世界.年")).toBe(true);
  });

  it("manifest.clock 的 attr 在 sheets/开局.csv 中存在 → no clock-missing warn", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\nclock: 世界.年\n" },
      { path: "sheets/开局.csv", content: "entity,attr,value,visible\n世界,年,0,0\n" },
    ];
    const r = validatePack(files);
    // clock attr is "世界.年" meaning entity=世界, attr=年
    expect(r.issues.some((i) => i.msg.includes("世界.年") && i.msg.includes("未在"))).toBe(false);
  });

  it("manifest 无 clock 字段 → no clock warn", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\n" },
      { path: "lore/a.md", content: "ok" },
    ];
    const r = validatePack(files);
    expect(r.issues.some((i) => i.msg.includes("clock"))).toBe(false);
  });
});

// ── Rule 4: manifest.entry 锚点可解析 ────────────────────────────────────
describe("validatePack – Rule 4: manifest.entry", () => {
  it("entry 指向存在的 world doc（不带 #锚点）→ ok", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\nentry: world/设定.md\n" },
      { path: "world/设定.md", content: "设定内容" },
      PROLOGUE_FILE,
    ];
    expect(isOk(files)).toBe(true);
  });

  it("entry 指向存在的 world doc 带 #锚点 → ok", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\nentry: world/设定.md#引子\n" },
      { path: "world/设定.md", content: "设定内容\n## 引子\n故事开始了" },
      PROLOGUE_FILE,
    ];
    expect(isOk(files)).toBe(true);
  });

  it("entry 指向不存在的 world doc → error", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\nentry: world/不存在.md\n" },
      { path: "lore/a.md", content: "ok" },
    ];
    expect(hasError(files, "entry")).toBe(true);
  });

  it("entry 指向存在的 doc 但 #锚点不存在 → error", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\nentry: world/设定.md#不存在锚点\n" },
      { path: "world/设定.md", content: "设定内容，无此锚点" },
    ];
    expect(hasError(files, "entry")).toBe(true);
  });

  it("manifest 无 entry → no entry error", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\n" },
      { path: "lore/a.md", content: "ok" },
    ];
    const r = validatePack(files);
    expect(r.issues.some((i) => i.level === "error" && /entry/.test(i.msg))).toBe(false);
  });
});

// ── Rule 5: CSV 列合法 ────────────────────────────────────────────────────
describe("validatePack – Rule 5: CSV columns", () => {
  it("sheets/ CSV 缺 entity 列 → error", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\n" },
      { path: "sheets/开局.csv", content: "attr,value,visible\nhp,0,1\n" },
    ];
    expect(hasError(files, "entity/attr/value")).toBe(true);
  });

  it("sheets/ CSV 有 entity/attr/value → ok", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\n" },
      { path: "sheets/开局.csv", content: "entity,attr,value,visible\n韩立,hp,0,1\n" },
    ];
    const r = validatePack(files);
    expect(r.issues.some((i) => i.level === "error" && /entity\/attr\/value/.test(i.msg))).toBe(false);
  });

  // backward-compat: state/ CSV also needs entity/attr/value (existing rule)
  it("state/ CSV 缺 entity 列 → error (backward compat)", () => {
    const files: PackFile[] = [
      { path: "state/开局.csv", content: "foo,bar\n1,2\n" },
    ];
    expect(isOk(files)).toBe(false);
  });
});

// ── Rule 6: fronts/*.md frontmatter ──────────────────────────────────────
describe("validatePack – Rule 6: fronts frontmatter", () => {
  it("fronts/ 文件缺 clock 字段 → error", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\n" },
      { path: "fronts/入侵.md", content: "---\nmin: 0\nmax: 8\nmode: once\n---\n# 阵线\n" },
    ];
    expect(hasError(files, "clock")).toBe(true);
  });

  it("fronts/ 文件的 max 非数字 → error", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\n" },
      { path: "fronts/入侵.md", content: "---\nclock: 世界.入侵\nmin: 0\nmax: abc\nmode: once\n---\n# 阵线\n" },
    ];
    expect(hasError(files, "max")).toBe(true);
  });

  it("fronts/ 文件 min > max → error", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\n" },
      { path: "fronts/入侵.md", content: "---\nclock: 世界.入侵\nmin: 10\nmax: 5\nmode: once\n---\n# 阵线\n" },
    ];
    expect(hasError(files, "min")).toBe(true);
  });

  it("fronts/ 文件 mode 无效值 → error", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\n" },
      { path: "fronts/入侵.md", content: "---\nclock: 世界.入侵\nmin: 0\nmax: 8\nmode: invalid\n---\n# 阵线\n" },
    ];
    expect(hasError(files, "mode")).toBe(true);
  });

  it("fronts/ 文件凶兆阶梯行缺钟值列 → error", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\n" },
      {
        path: "fronts/入侵.md",
        content: "---\nclock: 世界.入侵\nmin: 0\nmax: 8\nmode: once\n---\n# 阵线\n\n## 凶兆阶梯\n\n| 凶兆 |\n|------|\n| 边境沦陷 |\n",
      },
    ];
    expect(hasError(files, "凶兆阶梯")).toBe(true);
  });

  it("fronts/ 文件合法 → ok", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\n" },
      {
        path: "fronts/入侵.md",
        content: "---\nclock: 世界.入侵\nmin: 0\nmax: 8\nmode: once\n---\n# 阵线\n\n## 凶兆阶梯\n\n| 钟值 | 凶兆（触发 payload） |\n|------|---------------------|\n| 3 | 边境沦陷 |\n",
      },
      PROLOGUE_FILE,
    ];
    expect(isOk(files)).toBe(true);
  });
});

// ── Rule 7: front clock attr 在 state/sheets 中定义 ──────────────────────
describe("validatePack – Rule 7: front clock attr reference integrity", () => {
  it("front 声明的 clock attr 不在 state/sheets 中 → warn", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\n" },
      {
        path: "fronts/入侵.md",
        content: "---\nclock: 世界.入侵进度\nmin: 0\nmax: 8\nmode: once\n---\n# 阵线\n",
      },
    ];
    // No sheets defining 世界.入侵进度
    expect(hasWarn(files, "世界.入侵进度")).toBe(true);
  });

  it("front 声明的 clock attr 存在于 sheets/ → no ref-integrity warn", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\n" },
      {
        path: "fronts/入侵.md",
        content: "---\nclock: 世界.入侵进度\nmin: 0\nmax: 8\nmode: once\n---\n# 阵线\n",
      },
      { path: "sheets/开局.csv", content: "entity,attr,value,visible\n世界,入侵进度,0,0\n" },
    ];
    const r = validatePack(files);
    const warnAboutClockAttr = r.issues.filter(
      (i) => i.level === "warn" && i.msg.includes("世界.入侵进度") && i.msg.includes("未在"),
    );
    expect(warnAboutClockAttr).toHaveLength(0);
  });
});

// ── Backward compat: old manifest.md format (from Draft.toPackFiles()) ───
describe("validatePack – backward compat with manifest.md (Draft format)", () => {
  it("使用旧 manifest.md 格式（Draft 产的包）→ ok（无 manifest.yaml 时跳过 yaml 校验）", () => {
    const files: PackFile[] = [
      { path: "manifest.md", content: "# 测试团本\n\n- id: test" },
      { path: "lore/a.md", content: "ok" },
      { path: "state/开局.csv", content: "entity,attr,value,visible\n韩立,hp,0,1\n" },
      PROLOGUE_FILE,
    ];
    expect(isOk(files)).toBe(true);
  });
});

// ── Rule 0c: prologue.md 必须存在 ────────────────────────────────────────
describe("validatePack – Rule 0c: prologue.md required", () => {
  it("缺 prologue.md → error", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\n" },
      { path: "lore/a.md", content: "ok" },
    ];
    expect(hasError(files, "prologue.md")).toBe(true);
    const r = validatePack(files);
    const prologueErr = r.issues.find((i) => i.level === "error" && i.file === "prologue.md");
    expect(prologueErr).toBeDefined();
    expect(prologueErr!.hint).toContain("dicelore_build_set_prologue");
  });

  it("有 prologue.md → 无 prologue error", () => {
    const files: PackFile[] = [
      { path: "manifest.yaml", content: "id: t\nname: 测\nversion: 1.0.0\n" },
      { path: "lore/a.md", content: "ok" },
      PROLOGUE_FILE,
    ];
    const r = validatePack(files);
    expect(r.issues.some((i) => i.level === "error" && i.file === "prologue.md")).toBe(false);
  });

  it("prologue.md 是合法顶层路径（无 unknown-seg error）", () => {
    const files: PackFile[] = [PROLOGUE_FILE];
    const r = validatePack(files);
    expect(r.issues.some((i) => i.msg.includes("未知顶层路径段") && i.file === "prologue.md")).toBe(false);
  });
});

// ── Rule 8: 作者面 tools/*.json 声明式工具（DT-9 安全闸门）────────────────
describe("validatePack – Rule 8: 作者面 tools/*.json", () => {
  function withTools(json: string): PackFile[] {
    return [PROLOGUE_FILE, { path: "lore/a.md", content: "ok" }, { path: "tools/作者工具.json", content: json }];
  }

  it("合法声明式工具（insert 叙事表 / mutate / 只读 SELECT）→ ok", () => {
    const json = JSON.stringify([
      { name: "plant_clue", desc: "埋线索", params: { id: "string", content: "string" }, sql: "INSERT INTO foreshadow (id, content) VALUES (:id, :content)" },
      { name: "gold_add", desc: "加钱", params: { who: "string", n: "int" }, sql: "UPDATE sheet SET 金币 = 金币 + :n WHERE entity = :who" },
      { name: "hp_query", desc: "查HP", params: { who: "string" }, sql: "SELECT value FROM state WHERE entity = :who AND attr = 'HP'" },
    ]);
    expect(isOk(withTools(json))).toBe(true);
  });

  it("tools/ 是合法顶层路径（无 unknown-seg error）", () => {
    const files = withTools(JSON.stringify([{ name: "t", sql: "SELECT 1" }]));
    const r = validatePack(files);
    expect(r.issues.some((i) => i.msg.includes("未知顶层路径段"))).toBe(false);
  });

  it("逃逸：DROP TABLE → error（toolgen 拒）", () => {
    const json = JSON.stringify([{ name: "evil", sql: "DROP TABLE state" }]);
    expect(hasError(withTools(json), "声明非法")).toBe(true);
    expect(isOk(withTools(json))).toBe(false);
  });

  it("逃逸：多语句 SELECT; DROP → error", () => {
    const json = JSON.stringify([{ name: "evil", params: { x: "string" }, sql: "SELECT value FROM state WHERE entity=:x; DROP TABLE state" }]);
    expect(isOk(withTools(json))).toBe(false);
  });

  it("逃逸：ATTACH DATABASE → error", () => {
    const json = JSON.stringify([{ name: "evil", sql: "ATTACH DATABASE 'x' AS y" }]);
    expect(isOk(withTools(json))).toBe(false);
  });

  it("逃逸：INSERT 非叙事表（state）→ error（matchWrite 只认 front/plotline/foreshadow）", () => {
    const json = JSON.stringify([{ name: "evil", params: { e: "string", a: "string", v: "string" }, sql: "INSERT INTO state (entity, attr, value) VALUES (:e, :a, :v)" }]);
    expect(isOk(withTools(json))).toBe(false);
  });

  it("逃逸：UPDATE 含子查询 → error", () => {
    const json = JSON.stringify([{ name: "evil", params: { who: "string" }, sql: "UPDATE sheet SET 金币 = (SELECT 1) WHERE entity = :who" }]);
    expect(isOk(withTools(json))).toBe(false);
  });

  it("坏 JSON → error", () => {
    expect(hasError(withTools("{ not json"), "解析失败")).toBe(true);
  });

  it("非数组 JSON → error", () => {
    expect(hasError(withTools('{"name":"t"}'), "数组")).toBe(true);
  });

  it("缺 name → error", () => {
    expect(hasError(withTools(JSON.stringify([{ sql: "SELECT 1" }])), "缺 name")).toBe(true);
  });

  it("缺 sql → error", () => {
    expect(hasError(withTools(JSON.stringify([{ name: "t" }])), "缺 sql")).toBe(true);
  });

  it("非 .json 文件 → error", () => {
    const files = [PROLOGUE_FILE, { path: "tools/x.txt", content: "[]" }];
    expect(hasError(files, "只接受 .json")).toBe(true);
  });

  it("跨文件同名工具 → error（查重）", () => {
    const files = [
      PROLOGUE_FILE,
      { path: "tools/a.json", content: JSON.stringify([{ name: "dup", sql: "SELECT 1" }]) },
      { path: "tools/b.json", content: JSON.stringify([{ name: "dup", sql: "SELECT 2" }]) },
    ];
    expect(hasError(files, "重复")).toBe(true);
  });
});
