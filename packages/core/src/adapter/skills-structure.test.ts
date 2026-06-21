// packages/core/src/adapter/skills-structure.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "skills");

function frontmatter(md: string): Record<string, string> {
  const m = /^---\n([\s\S]*?)\n---/.exec(md);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const FLOWS = ["gacha", "contest", "anka", "explore"];

describe("Skills 包结构", () => {
  it("gm-core SKILL.md 存在、frontmatter 含 name/description、body <500 行", () => {
    const p = join(SKILLS_DIR, "dicelore-gm-core", "SKILL.md");
    expect(existsSync(p)).toBe(true);
    const md = readFileSync(p, "utf8");
    const fm = frontmatter(md);
    expect(fm.name).toBe("dicelore-gm-core");
    expect(fm.description?.length ?? 0).toBeGreaterThan(0);
    expect(md.split("\n").length).toBeLessThan(500);
  });

  it("gm-core 四张 references 深表都在", () => {
    for (const r of ["moves-full", "consequences", "visibility-play", "reminders"]) {
      expect(existsSync(join(SKILLS_DIR, "dicelore-gm-core", "references", `${r}.md`))).toBe(true);
    }
  });

  it("四个 flow skill 都在、frontmatter name 对得上", () => {
    for (const f of FLOWS) {
      const p = join(SKILLS_DIR, `dicelore-flow-${f}`, "SKILL.md");
      expect(existsSync(p)).toBe(true);
      expect(frontmatter(readFileSync(p, "utf8")).name).toBe(`dicelore-flow-${f}`);
    }
  });
});
