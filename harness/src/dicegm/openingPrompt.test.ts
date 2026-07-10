// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { openDb, initSchema, metaSet, openSessionBackend } from "@dicelore/backend";
import { buildOpeningPrompt, buildBaselinePrompt, ensureDicePlugin } from "./openingPrompt.js";

describe("buildOpeningPrompt（signpost + prologue，教条已退役内联）", () => {
  it("无 prologue:只 signpost(含 GM 身份 + consult gm-core signpost)", () => {
    const db = openDb(":memory:"); initSchema(db);
    const p = buildOpeningPrompt(openSessionBackend(db));
    expect(p).toContain("Dicelore GM");
    expect(p).toContain("dicelore-gm-core"); // signpost 层的「先 consult gm-core」指路,非教条正文
    expect(p).not.toContain("团本开场");
    db.close();
  });
  it("有 prologue:signpost + 团本开场叠加", () => {
    const db = openDb(":memory:"); initSchema(db);
    metaSet(db, "prologue", "夜色如墨,你立于鹰愁涧口。");
    const p = buildOpeningPrompt(openSessionBackend(db));
    expect(p).toContain("Dicelore GM");          // signpost 层
    expect(p).toContain("团本开场");              // 分隔
    expect(p).toContain("夜色如墨,你立于鹰愁涧口。"); // prologue 层
    db.close();
  });
  // 退役内联兜底回归:buildOpeningPrompt 不再拼 gm-core 教条正文(形状表是教条独有,signpost 没有)。
  it("不含 gm-core 教条正文(=signpost+prologue,教条只经 plugin skill 投递)", () => {
    const db = openDb(":memory:"); initSchema(db);
    metaSet(db, "prologue", "夜色如墨。");
    const p = buildOpeningPrompt(openSessionBackend(db));
    expect(p).not.toContain("形状表");   // 教条独有段,内联已退役
    expect(p).not.toContain("闸 A");     // 教条独有段
    db.close();
  });
  it("buildBaselinePrompt = buildOpeningPrompt(教条既已退役内联,两者等同,别名过渡)", () => {
    const db = openDb(":memory:"); initSchema(db);
    metaSet(db, "prologue", "夜色如墨。");
    const backend = openSessionBackend(db);
    expect(buildBaselinePrompt(backend)).toBe(buildOpeningPrompt(backend));
    db.close();
  });

  // debrief-and-branch §一.3：game_end(meta ended 已置)后叠加战后复盘指令，切复盘行为(软约束)。
  it("战后复盘态:ended 已置 → 叠加复盘指令(不推进剧情)；未置则不含", () => {
    const db = openDb(":memory:"); initSchema(db);
    metaSet(db, "prologue", "夜色如墨。");
    const backend = openSessionBackend(db);
    expect(buildOpeningPrompt(backend)).not.toContain("战后复盘模式");
    metaSet(db, "ended", JSON.stringify({ reason: "团灭", seq: 3 }));
    const p = buildOpeningPrompt(backend);
    expect(p).toContain("战后复盘模式");
    expect(p).toContain("不推进剧情");
    db.close();
  });
});

describe("ensureDicePlugin（母本物化到数据根 + fail loud）", () => {
  it("母本存在时首调物化 + 返回 PluginRef(pluginDir=<root>/dice, skills:'all')", () => {
    const root = mkdtempSync(join(tmpdir(), "dice-plugin-"));
    try {
      const ref = ensureDicePlugin(root);
      // CI 下 harness/src/dicegm 母本(.claude-plugin/plugin.json + skills/)必须存在
      expect(ref).not.toBeNull();
      expect(ref!.pluginDir).toBe(join(root, "dice"));
      expect(ref!.skills).toBe("all");
      expect(existsSync(join(ref!.pluginDir, ".claude-plugin", "plugin.json"))).toBe(true);
      expect(existsSync(join(ref!.pluginDir, "skills", "dicelore-gm-core", "SKILL.md"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
