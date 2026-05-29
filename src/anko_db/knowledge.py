"""FTS5 full-text search and bulk import for the knowledge base."""

from __future__ import annotations

from dataclasses import dataclass

from anko_db.store import Store

# Minimum character count for FTS5 MATCH queries.
# SQLite's default FTS5 tokenizer splits on whitespace/ASCII punctuation,
# so single CJK words shorter than this threshold fall back to a LIKE scan.
_FTS5_MIN_QUERY_LEN = 3


@dataclass
class KnowledgeEntry:
    """A single knowledge base entry."""
    name: str
    content: str
    category: str


class Knowledge:
    """Full-text search over the knowledge FTS5 table."""

    def __init__(self, store: Store) -> None:
        self._store = store

    def import_entries(self, entries: list[KnowledgeEntry]) -> int:
        count = 0
        for entry in entries:
            self._store.execute(
                "INSERT INTO knowledge (name, content, category) VALUES (?, ?, ?)",
                (entry.name, entry.content, entry.category),
            )
            count += 1
        return count

    def search(self, query: str, limit: int = 10) -> list[KnowledgeEntry]:
        # SQLite's FTS5 default tokenizer splits on whitespace and ASCII
        # punctuation.  For short CJK strings (< 3 chars) MATCH produces no
        # results because each character is not a separate token.  Use a LIKE
        # scan as a fallback so that two-character (and single-character) CJK
        # queries still work correctly.
        if len(query) < _FTS5_MIN_QUERY_LEN:
            rows = self._store.query_all(
                "SELECT name, content, category FROM knowledge"
                " WHERE name LIKE ? OR content LIKE ? LIMIT ?",
                (f"%{query}%", f"%{query}%", limit),
            )
        else:
            rows = self._store.query_all(
                "SELECT name, content, category FROM knowledge"
                " WHERE knowledge MATCH ? ORDER BY rank LIMIT ?",
                (query, limit),
            )
        return [
            KnowledgeEntry(name=r["name"], content=r["content"], category=r["category"])
            for r in rows
        ]
