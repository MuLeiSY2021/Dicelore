import type { DB } from "./db.js";
import { eventAppend } from "./event.js";

export interface ChoiceOption {
  label: string;
  consequence: string;
}

// 轮内反复调用末次覆盖(id=1 单行 upsert),status='staged'。不落 event。
export function stagePendingChoice(db: DB, prompt: string, options: ChoiceOption[]): void {
  db.prepare(
    `INSERT INTO pending_choice (id, seq_staged, prompt, options_json, status)
     VALUES (1, NULL, ?, ?, 'staged')
     ON CONFLICT(id) DO UPDATE SET seq_staged=NULL, prompt=excluded.prompt,
       options_json=excluded.options_json, status='staged'`,
  ).run(prompt, JSON.stringify(options));
}

export function getPendingChoice(
  db: DB,
): { prompt: string; options: ChoiceOption[]; status: string } | undefined {
  const row = db.prepare("SELECT prompt, options_json, status FROM pending_choice WHERE id=1").get() as
    | { prompt: string; options_json: string; status: string }
    | undefined;
  if (!row) return undefined;
  return { prompt: row.prompt, options: JSON.parse(row.options_json) as ChoiceOption[], status: row.status };
}

// 回合末 Stop hook 用(本组件不接线):落 kind=choice、visible=1 event,status→materialized。
export function materializePendingChoice(db: DB): number | undefined {
  const pc = getPendingChoice(db);
  if (!pc) return undefined;
  const seq = eventAppend(db, {
    kind: "choice",
    visible: 1,
    content: pc.prompt,
    data_json: { prompt: pc.prompt, options: pc.options },
  });
  db.prepare("UPDATE pending_choice SET status='materialized', seq_staged=? WHERE id=1").run(seq);
  return seq;
}
