// packages/core/src/adapter/init.ts
import { cpSync, mkdirSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { claudeMdPointer, settingsJson } from "./templates.js";

// 包根 = src/adapter/ 上两级。skills 真源在 <pkg>/skills,hook 入口在 <pkg>/src/adapter/hooks。
const ADAPTER_DIR = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(ADAPTER_DIR, "..", "..");
const SKILLS_SRC = join(PKG_ROOT, "skills");
const HOOKS_SRC = join(PKG_ROOT, "src", "adapter", "hooks");

const FLOWS = ["gacha", "contest", "anka", "explore"];

export function runInit(opts: { projectDir: string; session: string }): void {
  const { projectDir, session } = opts;
  const claudeDir = join(projectDir, ".claude");
  mkdirSync(claudeDir, { recursive: true });

  // settings.json:hook 用包内 hooks 绝对路径(node --import tsx,见 templates)。
  const settings = settingsJson({ session, hooksDir: HOOKS_SRC });
  writeFileSync(join(claudeDir, "settings.json"), JSON.stringify(settings, null, 2) + "\n");

  // skills:默认全装 gm-core + 全部四 flow(留 manifest 过滤接口位:将来按 opts.flows 子集)。
  const skillsDst = join(claudeDir, "skills");
  mkdirSync(skillsDst, { recursive: true });
  cpSync(join(SKILLS_SRC, "dicelore-gm-core"), join(skillsDst, "dicelore-gm-core"), { recursive: true });
  for (const f of FLOWS) {
    cpSync(join(SKILLS_SRC, `dicelore-flow-${f}`), join(skillsDst, `dicelore-flow-${f}`), { recursive: true });
  }

  // CLAUDE.md 指针:已存在则追加。
  const claudeMd = join(projectDir, "CLAUDE.md");
  const pointer = "\n" + claudeMdPointer();
  if (existsSync(claudeMd)) appendFileSync(claudeMd, pointer);
  else writeFileSync(claudeMd, pointer.trimStart());
}
