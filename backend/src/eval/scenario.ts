// eval 场景共享逻辑:Scenario 类型 + loadScenario + prepareSessionDb(灌种子+建临时 db)。
// run.ts(手动调试)与 orchestrator harness(自动闭环)共用。
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "../store/db.js";

const here = dirname(fileURLToPath(import.meta.url));
// scenarios 在 packages/core/eval/scenarios/(src/eval → ../../eval/scenarios)
const scenariosDir = join(here, "..", "..", "eval", "scenarios");

export interface ScenarioSeed {
  tone?: string;
  rules?: { name: string; content: string }[];
  sheets?: { entity: string; attr: string; value: string; show?: boolean }[];
}
export interface Scenario {
  id: string;
  title: string;
  focus: string[];
  reference: { file: string; beat: string; note: string };
  seed: ScenarioSeed;
  playerTurns: string[];
  // 机械地板期望（assertions 读它做确定性判定，零 LLM）。可选——缺省=不施加该地板。
  //   minVerdicts: F1 掷骰地板——本场景玩家序列里需检定的主动行动数，verdict 须 ≥ 此值且无散文绕过时序。
  //   closure:     F2 弱地板——本场景是否期望出现终局/收束信号（仅 advisory，不硬判）。
  expects?: { minVerdicts?: number; closure?: boolean };
}
export interface PreparedSession {
  db: DB;
  dbPath: string;
  scenario: Scenario;
  sessionsDir: string;
  sessionName: string;
}

export function loadScenario(scenarioId: string): Scenario {
  return JSON.parse(readFileSync(join(scenariosDir, `${scenarioId}.json`), "utf8")) as Scenario;
}

// 灌种子 + 建临时 db。env 须在 import core 前(openSession 读它定位库),故内部 dynamic import。
export async function prepareSessionDb(
  scenarioId: string,
  opts: { baseline?: boolean; sessionsDir?: string } = {},
): Promise<PreparedSession> {
  const scenario = loadScenario(scenarioId);
  const sessionsDir = opts.sessionsDir ?? mkdtempSync(join(tmpdir(), "dl-eval-"));
  const sessionName = `eval-${scenario.id}${opts.baseline ? "-baseline" : ""}`;
  process.env.DICELORE_DATA_DIR = sessionsDir;
  process.env.DICELORE_SESSION = sessionName;
  const { openSession, metaSet } = await import("../session/resolve.js");
  const { ruleUpsert } = await import("../store/world/rule.js");
  const { stateSet } = await import("../store/sheet/state.js");
  const { sheetShow } = await import("../store/sheet/visibility.js");
  const { db, path: dbPath } = openSession();
  if (scenario.seed.tone) metaSet(db, "tone", scenario.seed.tone);
  for (const r of scenario.seed.rules ?? []) ruleUpsert(db, { name: r.name, content: r.content });
  for (const s of scenario.seed.sheets ?? []) {
    stateSet(db, s.entity, s.attr, s.value);
    if (s.show) sheetShow(db, s.entity);
  }
  return { db, dbPath, scenario, sessionsDir, sessionName };
}
