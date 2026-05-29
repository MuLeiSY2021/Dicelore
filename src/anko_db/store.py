"""SQLite connection management and schema initialization."""

from __future__ import annotations

import sqlite3
from pathlib import Path


class Store:
    """Manages a single SQLite database file for a session."""

    def __init__(self, db_path: Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn: sqlite3.Connection = sqlite3.connect(str(self.db_path))
        self._conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS session_meta (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS state (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            );

            CREATE TABLE IF NOT EXISTS history (
                turn INTEGER PRIMARY KEY AUTOINCREMENT,
                narrative TEXT,
                dice_results TEXT,
                paradigm_used TEXT,
                player_action TEXT,
                timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS knowledge USING fts5(
                name, content, category
            );

            CREATE TABLE IF NOT EXISTS notes (
                tag TEXT PRIMARY KEY,
                content TEXT,
                updated TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            );
        """)
        self._conn.commit()

    def execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        cursor = self._conn.execute(sql, params)
        self._conn.commit()
        return cursor

    def query_one(self, sql: str, params: tuple = ()) -> dict | None:
        cursor = self._conn.execute(sql, params)
        row = cursor.fetchone()
        return dict(row) if row else None

    def query_all(self, sql: str, params: tuple = ()) -> list[dict]:
        cursor = self._conn.execute(sql, params)
        return [dict(row) for row in cursor.fetchall()]

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None

    def __enter__(self) -> Store:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()
