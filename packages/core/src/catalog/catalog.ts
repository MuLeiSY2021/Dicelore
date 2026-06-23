// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { createHash } from "node:crypto";
import { uuidv5 } from "./uuid.js";
import type { CatalogDB } from "./db.js";

export interface PackFile { path: string; content: string }
export interface CommitRow { id: string; tuanbenId: string; parent: string | null; message: string; createdAt: string }
export interface TuanbenSummary { id: string; name: string; head: string | null; tags: string[] }

export function resolveId(name: string): string { return uuidv5(name); }

function commitId(parent: string | null, message: string, files: PackFile[]): string {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  return createHash("sha1").update(`${parent ?? ""}\n${message}\n${JSON.stringify(sorted)}`).digest("hex");
}

export function commit(
  db: CatalogDB,
  a: { name: string; files: PackFile[]; message: string; createdAt?: string },
): { tuanbenId: string; commitId: string } {
  const tuanbenId = resolveId(a.name);
  const createdAt = a.createdAt ?? new Date().toISOString();
  const existing = db.prepare("SELECT head FROM tuanben WHERE id=?").get(tuanbenId) as { head: string | null } | undefined;
  const parent = existing?.head ?? null;
  const cid = commitId(parent, a.message, a.files);
  const tx = db.transaction(() => {
    if (!existing) {
      db.prepare("INSERT INTO tuanben (id, name, head, created_at) VALUES (?,?,?,?)").run(tuanbenId, a.name, cid, createdAt);
    } else {
      db.prepare("UPDATE tuanben SET head=? WHERE id=?").run(cid, tuanbenId);
    }
    db.prepare("INSERT OR IGNORE INTO commits (id, tuanben_id, parent, message, created_at) VALUES (?,?,?,?,?)")
      .run(cid, tuanbenId, parent, a.message, createdAt);
    const ins = db.prepare("INSERT OR REPLACE INTO file (commit_id, path, content) VALUES (?,?,?)");
    for (const f of a.files) ins.run(cid, f.path, f.content);
  });
  tx();
  return { tuanbenId, commitId: cid };
}

export function history(db: CatalogDB, tuanbenId: string): CommitRow[] {
  const row = db.prepare("SELECT head FROM tuanben WHERE id=?").get(tuanbenId) as { head: string | null } | undefined;
  const out: CommitRow[] = [];
  let cur = row?.head ?? null;
  const get = db.prepare("SELECT id, tuanben_id, parent, message, created_at FROM commits WHERE id=?");
  while (cur) {
    const c = get.get(cur) as { id: string; tuanben_id: string; parent: string | null; message: string; created_at: string } | undefined;
    if (!c) break;
    out.push({ id: c.id, tuanbenId: c.tuanben_id, parent: c.parent, message: c.message, createdAt: c.created_at });
    cur = c.parent;
  }
  return out;
}

// ref = tag label(先查) 或 commitId。
export function checkout(db: CatalogDB, tuanbenId: string, ref: string): PackFile[] {
  const tagged = db.prepare("SELECT commit_id FROM tag WHERE tuanben_id=? AND label=?").get(tuanbenId, ref) as { commit_id: string } | undefined;
  const cid = tagged?.commit_id ?? ref;
  return db.prepare("SELECT path, content FROM file WHERE commit_id=? ORDER BY path").all(cid) as PackFile[];
}

export function tag(db: CatalogDB, a: { tuanbenId: string; commitId: string; label: string }): void {
  db.prepare("INSERT OR REPLACE INTO tag (tuanben_id, label, commit_id) VALUES (?,?,?)").run(a.tuanbenId, a.label, a.commitId);
}

export function list(db: CatalogDB): TuanbenSummary[] {
  const rows = db.prepare("SELECT id, name, head FROM tuanben ORDER BY name").all() as { id: string; name: string; head: string | null }[];
  const tagsOf = db.prepare("SELECT label FROM tag WHERE tuanben_id=? ORDER BY label");
  return rows.map((r) => ({ ...r, tags: (tagsOf.all(r.id) as { label: string }[]).map((t) => t.label) }));
}
