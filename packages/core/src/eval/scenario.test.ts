import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadScenario, prepareSessionDb } from "./scenario.js";
import { openDb } from "../store/db.js";

describe("eval scenario", () => {
  it("loadScenario 读 orc-hunt", () => {
    const s = loadScenario("orc-hunt");
    expect(s.id).toBe("orc-hunt");
    expect(s.playerTurns.length).toBeGreaterThan(0);
  });

  it("prepareSessionDb 建库并返回 db/scenario", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dl-eval-test-"));
    const prepared = await prepareSessionDb("orc-hunt", { sessionsDir: dir });
    expect(prepared.scenario.id).toBe("orc-hunt");
    expect(prepared.dbPath).toBeTruthy();
    expect(prepared.sessionsDir).toBe(dir);
    const db = openDb(prepared.dbPath);
    expect(db).toBeTruthy();
    db.close();
  });
});
