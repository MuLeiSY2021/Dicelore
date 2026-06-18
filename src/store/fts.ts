import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict.js";
import type Database from "better-sqlite3";

export type FtsMode = "jieba" | "trigram";

export function ftsMode(): FtsMode {
  return process.env.ANKO_FTS_MODE === "trigram" ? "trigram" : "jieba";
}

let _jieba: Jieba | undefined;
function jieba(): Jieba {
  if (!_jieba) _jieba = Jieba.withDict(dict);
  return _jieba;
}

// 影子列文本:jieba 分词空格连接(unicode61 据此按空格切回 token);trigram 存原文。
export function tokenizeForIndex(text: string, mode: FtsMode = ftsMode()): string {
  if (mode === "trigram") return text;
  return jieba().cut(text).join(" ");
}

export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => "\\" + m);
}

export interface FtsQuery {
  match: string | null; // 走 `text MATCH ?`
  like: string | null; // 走 `raw LIKE ? ESCAPE '\'` 兜底
}

// jieba:查询词分词 → 每词双引号包裹(避开 FTS5 关键字/特殊符)、OR 连接,最大化召回 + bm25 排序。
// trigram:≥3 字直接 MATCH(子串可搜);<3 字 trigram 命不中 → 退 LIKE。
export function buildFtsQuery(query: string, mode: FtsMode = ftsMode()): FtsQuery {
  const q = query.trim();
  if (!q) return { match: null, like: null };
  if (mode === "trigram") {
    if ([...q].length >= 3) return { match: q, like: null };
    return { match: null, like: `%${escapeLike(q)}%` };
  }
  const tokens = jieba().cut(q).map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return { match: null, like: `%${escapeLike(q)}%` };
  const match = tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(" OR ");
  return { match, like: null };
}

export const FTS_TABLES = ["event_fts", "world_doc_fts", "rule_doc_fts"] as const;

export type FtsDB = Database.Database;

// FTS 虚表恒为 (text, raw UNINDEXED);jieba/trigram 只差 tokenize 参数。
export function ftsTableDDL(table: string, mode: FtsMode = ftsMode()): string {
  const tk = mode === "trigram" ? ", tokenize='trigram'" : "";
  return `CREATE VIRTUAL TABLE IF NOT EXISTS ${table} USING fts5(text, raw UNINDEXED${tk})`;
}

// 从 sqlite_master 探查虚表 DDL,判断是否为 trigram 模式(不依赖 env)。
// 若表不存在则抛出错误(编程错误:拼写错误或在 initSchema 前调用)。
function tableMode(db: FtsDB, table: string): FtsMode {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE name=?").get(table) as { sql: string } | undefined;
  if (!row) throw new Error(`fts table not found: ${table}`);
  if (/tokenize\s*=\s*'trigram'/i.test(row.sql)) return "trigram";
  return "jieba";
}

// 幂等 reindex:standalone FTS5 表先删同 rowid 再插。raw 存原文供回展示,影子列存分词文本。
export function ftsIndex(db: FtsDB, table: string, rowid: number, text: string): void {
  const mode = tableMode(db, table);
  db.prepare(`DELETE FROM ${table} WHERE rowid=?`).run(rowid);
  db.prepare(`INSERT INTO ${table}(rowid, text, raw) VALUES (?, ?, ?)`).run(rowid, tokenizeForIndex(text, mode), text);
}

export function ftsDelete(db: FtsDB, table: string, rowid: number): void {
  db.prepare(`DELETE FROM ${table} WHERE rowid=?`).run(rowid);
}

export interface FtsHit {
  rowid: number;
  raw: string;
}

// table 是内部固定常量(FTS_TABLES),非用户输入 → 插值安全。
// mode 从虚表 DDL 读取(tableMode),不依赖全局 env → index 与 search 一致。
export function ftsSearch(db: FtsDB, table: string, query: string, limit = 20): FtsHit[] {
  const mode = tableMode(db, table);
  const { match, like } = buildFtsQuery(query, mode);
  if (match) {
    return db
      .prepare(`SELECT rowid, raw FROM ${table} WHERE text MATCH ? ORDER BY bm25(${table}) LIMIT ?`)
      .all(match, limit) as FtsHit[];
  }
  if (like) {
    return db
      .prepare(`SELECT rowid, raw FROM ${table} WHERE raw LIKE ? ESCAPE '\\' LIMIT ?`)
      .all(like, limit) as FtsHit[];
  }
  return [];
}
