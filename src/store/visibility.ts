import type { DB } from "./db.js";
import { sheetGet, sheetSetRaw } from "./sheet.js";
import { eventAppend } from "./event.js";

// 可见性变更审计:kind=note、visible=0(对玩家隐),供 L3 / 回看(§4.2)。
function auditNote(db: DB, content: string): void {
  eventAppend(db, { kind: "note", content, visible: 0 });
}

// attr 级:指定 cell 置 1(暗值 visible=2 焊死,不揭);entity 级(省 attr):写长效策略 cell __show_all。
export function sheetShow(db: DB, entity: string, attr?: string): void {
  if (attr === undefined) {
    sheetSetRaw(db, entity, "__show_all", "1");
    auditNote(db, `揭示:${entity} 全卡(__show_all)`);
    return;
  }
  db.prepare("UPDATE sheet SET visible=1 WHERE entity=? AND attr=? AND visible!=2").run(entity, attr);
  auditNote(db, `揭示:${entity}.${attr}`);
}

export function worldShow(db: DB, table: "world_doc" | "world_pool", rowid: number): void {
  // table 是字面量联合类型(非用户自由输入)→ 插值安全。
  db.prepare(`UPDATE ${table} SET visible=1 WHERE rowid=?`).run(rowid);
  auditNote(db, `揭示:${table}#${rowid}`);
}

export type RevealTarget =
  | { kind: "sheet"; entity: string; attr: string }
  | { kind: "world_doc"; rowid: number };

// reveal_once:append 一条 kind=reveal 的可见 event,内容=目标此刻冻结副本;不碰目标自身 visible(底层仍隐)。
export function revealOnce(db: DB, target: RevealTarget): number {
  if (target.kind === "sheet") {
    const cell = sheetGet(db, target.entity, target.attr);
    if (!cell) throw new Error(`revealOnce: sheet cell 不存在 ${target.entity}.${target.attr}`);
    return eventAppend(db, {
      kind: "reveal",
      visible: 1,
      content: `${target.entity}.${target.attr} = ${cell.value}`,
      data_json: { kind: "sheet", entity: target.entity, attr: target.attr, value: cell.value },
    });
  }
  const doc = db.prepare("SELECT name, content FROM world_doc WHERE rowid=?").get(target.rowid) as
    | { name: string; content: string }
    | undefined;
  if (!doc) throw new Error(`revealOnce: world_doc#${target.rowid} 不存在`);
  return eventAppend(db, {
    kind: "reveal",
    visible: 1,
    content: doc.content,
    data_json: { kind: "world_doc", rowid: target.rowid, name: doc.name, content: doc.content },
  });
}
