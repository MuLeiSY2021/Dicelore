import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict.js";

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
