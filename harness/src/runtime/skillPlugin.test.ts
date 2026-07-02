// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ensureSkillPlugin } from "./skillPlugin.js";

// 裁决 skill-loading-by-reference §1/§2 的 plugin 物化 helper 纯 fs 单测:
// 幂等(version 相等跳过不重拷)、版本感知(母本 version 变→重刷)、母本定位失败返 null。
describe("ensureSkillPlugin（plugin 物化：幂等 + 版本感知 + fail loud）", () => {
  const tmps: string[] = [];
  afterEach(() => { for (const d of tmps) rmSync(d, { recursive: true, force: true }); tmps.length = 0; });

  // 造一个母本线根:<src>/.claude-plugin/plugin.json + <src>/skills/<name>/SKILL.md
  function makeSrc(version: string, skillName = "s1", skillBody = "# skill\n正文"): string {
    const src = mkdtempSync(join(tmpdir(), "src-plugin-")); tmps.push(src);
    mkdirSync(join(src, ".claude-plugin"), { recursive: true });
    writeFileSync(join(src, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "p", version, description: "d" }));
    mkdirSync(join(src, "skills", skillName), { recursive: true });
    writeFileSync(join(src, "skills", skillName, "SKILL.md"), skillBody);
    return src;
  }
  function newDataRoot(): string { const d = mkdtempSync(join(tmpdir(), "dataroot-")); tmps.push(d); return d; }

  it("首调物化 skills/ + .claude-plugin/plugin.json 到 <dataRoot>/<role>,返回 PluginRef", () => {
    const src = makeSrc("0.1.0");
    const dataRoot = newDataRoot();
    const ref = ensureSkillPlugin(src, dataRoot, "dice", "all");
    expect(ref).not.toBeNull();
    expect(ref!.pluginDir).toBe(join(dataRoot, "dice"));
    expect(ref!.skills).toBe("all");
    expect(existsSync(join(ref!.pluginDir, ".claude-plugin", "plugin.json"))).toBe(true);
    expect(readFileSync(join(ref!.pluginDir, "skills", "s1", "SKILL.md"), "utf8")).toContain("正文");
  });

  it("幂等:version 相等重复调不重拷(目标 mtime 不变)", async () => {
    const src = makeSrc("0.1.0");
    const dataRoot = newDataRoot();
    ensureSkillPlugin(src, dataRoot, "lore", "all");
    const dst = join(dataRoot, "lore", "skills", "s1", "SKILL.md");
    const mtime1 = statSync(dst).mtimeMs;
    // 稍等确保若真重拷 mtime 会变
    await new Promise((r) => setTimeout(r, 20));
    ensureSkillPlugin(src, dataRoot, "lore", "all");
    const mtime2 = statSync(dst).mtimeMs;
    expect(mtime2).toBe(mtime1); // 没重拷
  });

  it("版本感知:母本 version 变高 → 重刷覆盖(新内容落地、旧 skill 清掉)", () => {
    const dataRoot = newDataRoot();
    // v0.1.0:含 s1
    ensureSkillPlugin(makeSrc("0.1.0", "s1", "# s1 old"), dataRoot, "dice", "all");
    // v0.2.0:换成 s2(母本不含 s1)
    const ref = ensureSkillPlugin(makeSrc("0.2.0", "s2", "# s2 new"), dataRoot, "dice", "all");
    expect(ref).not.toBeNull();
    // 目标 plugin.json version 已刷到 0.2.0
    const dstJson = JSON.parse(readFileSync(join(ref!.pluginDir, ".claude-plugin", "plugin.json"), "utf8")) as { version: string };
    expect(dstJson.version).toBe("0.2.0");
    // 新 skill 落地、旧 skill 已清(重刷先 rm skills/)
    expect(existsSync(join(ref!.pluginDir, "skills", "s2", "SKILL.md"))).toBe(true);
    expect(existsSync(join(ref!.pluginDir, "skills", "s1", "SKILL.md"))).toBe(false);
  });

  it("母本 srcDir=null → 返 null(fail loud,不物化)", () => {
    const dataRoot = newDataRoot();
    expect(ensureSkillPlugin(null, dataRoot, "dice", "all")).toBeNull();
    expect(existsSync(join(dataRoot, "dice"))).toBe(false);
  });

  it("母本 .claude-plugin/plugin.json 不存在 → 返 null(定位失败 fail loud)", () => {
    const bogus = mkdtempSync(join(tmpdir(), "bogus-src-")); tmps.push(bogus);
    const dataRoot = newDataRoot();
    expect(ensureSkillPlugin(bogus, dataRoot, "lore", "all")).toBeNull();
    expect(existsSync(join(dataRoot, "lore"))).toBe(false);
  });
});
