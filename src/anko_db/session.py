"""Session lifecycle, state/history/notes CRUD, and rulebook import."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from anko_db.store import Store

if TYPE_CHECKING:
    pass

_DEFAULT_SESSIONS_DIR = Path.home() / ".local" / "share" / "anko_driver" / "sessions"


def _resolve_sessions_dir(sessions_dir: Path | None) -> Path:
    d = sessions_dir if sessions_dir is not None else _DEFAULT_SESSIONS_DIR
    d.mkdir(parents=True, exist_ok=True)
    return d


@dataclass
class SessionInfo:
    session_id: str
    rulebook_id: str
    created_at: str
    db_path: Path


class Session:
    """Main API for anko_db — wraps a Store and provides all session-level operations."""

    def __init__(self, store: Store, info: SessionInfo) -> None:
        self._store = store
        self.info = info

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    @classmethod
    def create(cls, rulebook_id: str, sessions_dir: Path | None = None) -> Session:
        """Create a new session with a fresh SQLite database."""
        sessions_dir = _resolve_sessions_dir(sessions_dir)
        session_id = uuid.uuid4().hex[:12]
        db_path = sessions_dir / f"{session_id}.db"
        store = Store(db_path)

        created_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        store.execute(
            "INSERT OR REPLACE INTO session_meta (key, value) VALUES (?, ?)",
            ("rulebook_id", rulebook_id),
        )
        store.execute(
            "INSERT OR REPLACE INTO session_meta (key, value) VALUES (?, ?)",
            ("created_at", created_at),
        )

        info = SessionInfo(
            session_id=session_id,
            rulebook_id=rulebook_id,
            created_at=created_at,
            db_path=db_path,
        )
        return cls(store, info)

    @classmethod
    def load(cls, session_id: str, sessions_dir: Path | None = None) -> Session:
        """Load an existing session by ID."""
        sessions_dir = _resolve_sessions_dir(sessions_dir)
        db_path = sessions_dir / f"{session_id}.db"
        if not db_path.exists():
            raise FileNotFoundError(f"Session '{session_id}' not found at {db_path}")

        store = Store(db_path)
        row_rb = store.query_one(
            "SELECT value FROM session_meta WHERE key = ?", ("rulebook_id",)
        )
        row_ca = store.query_one(
            "SELECT value FROM session_meta WHERE key = ?", ("created_at",)
        )
        rulebook_id = row_rb["value"] if row_rb else ""
        created_at = row_ca["value"] if row_ca else ""

        info = SessionInfo(
            session_id=session_id,
            rulebook_id=rulebook_id,
            created_at=created_at,
            db_path=db_path,
        )
        return cls(store, info)

    @staticmethod
    def list_sessions(sessions_dir: Path | None = None) -> list[SessionInfo]:
        """Scan sessions_dir for *.db files and return a list of SessionInfo."""
        sessions_dir = _resolve_sessions_dir(sessions_dir)
        result: list[SessionInfo] = []
        for db_path in sorted(sessions_dir.glob("*.db")):
            session_id = db_path.stem
            try:
                store = Store(db_path)
                row_rb = store.query_one(
                    "SELECT value FROM session_meta WHERE key = ?", ("rulebook_id",)
                )
                row_ca = store.query_one(
                    "SELECT value FROM session_meta WHERE key = ?", ("created_at",)
                )
                store.close()
                result.append(
                    SessionInfo(
                        session_id=session_id,
                        rulebook_id=row_rb["value"] if row_rb else "",
                        created_at=row_ca["value"] if row_ca else "",
                        db_path=db_path,
                    )
                )
            except Exception:
                pass
        return result

    # ------------------------------------------------------------------
    # State CRUD
    # ------------------------------------------------------------------

    def state_get(self, key: str) -> object:
        """Read a value from the state table; returns None if key doesn't exist."""
        row = self._store.query_one(
            "SELECT value FROM state WHERE key = ?", (key,)
        )
        if row is None:
            return None
        return json.loads(row["value"])

    def state_set(self, key: str, value: object) -> None:
        """Write a value to the state table (INSERT OR REPLACE)."""
        self._store.execute(
            "INSERT OR REPLACE INTO state (key, value) VALUES (?, ?)",
            (key, json.dumps(value)),
        )

    # ------------------------------------------------------------------
    # Notes CRUD
    # ------------------------------------------------------------------

    def note_read(self, tag: str) -> str | None:
        """Read a note by tag; returns None if tag doesn't exist."""
        row = self._store.query_one(
            "SELECT content FROM notes WHERE tag = ?", (tag,)
        )
        return row["content"] if row else None

    def note_write(self, tag: str, content: str) -> None:
        """Write a note (INSERT OR REPLACE)."""
        self._store.execute(
            "INSERT OR REPLACE INTO notes (tag, content) VALUES (?, ?)",
            (tag, content),
        )

    # ------------------------------------------------------------------
    # History CRUD
    # ------------------------------------------------------------------

    def history_append(
        self,
        narrative: str,
        dice_results: object | None,
        paradigm: str,
        action: str,
    ) -> int:
        """Append a history entry; returns the turn number (lastrowid)."""
        dice_json = json.dumps(dice_results) if dice_results is not None else None
        cursor = self._store.execute(
            "INSERT INTO history (narrative, dice_results, paradigm_used, player_action) VALUES (?, ?, ?, ?)",
            (narrative, dice_json, paradigm, action),
        )
        return cursor.lastrowid

    def history_get(
        self,
        turn: int | None = None,
        last_n: int | None = None,
    ) -> dict | list[dict] | None:
        """
        Retrieve history entries.

        - turn: return a single row dict, or None if not found.
        - last_n: return a list of the most recent N rows in chronological order.
        - Neither: return None.
        """
        if turn is not None:
            row = self._store.query_one(
                "SELECT * FROM history WHERE turn = ?", (turn,)
            )
            if row is None:
                return None
            if row.get("dice_results") is not None:
                row["dice_results"] = json.loads(row["dice_results"])
            return row

        if last_n is not None:
            rows = self._store.query_all(
                "SELECT * FROM history ORDER BY turn DESC LIMIT ?", (last_n,)
            )
            # Reverse to chronological order
            rows = list(reversed(rows))
            for row in rows:
                if row.get("dice_results") is not None:
                    row["dice_results"] = json.loads(row["dice_results"])
            return rows

        return None

    # ------------------------------------------------------------------
    # Rulebook import
    # ------------------------------------------------------------------

    def import_rulebook(self, rulebook: object) -> None:
        """Import a RulebookData object into this session."""
        # Deferred imports to avoid circular dependencies
        from anko_db.rulebook import RulebookData  # noqa: F401
        from anko_db.knowledge import Knowledge

        rb: RulebookData = rulebook  # type: ignore[assignment]

        # Import knowledge entries
        knowledge = Knowledge(self._store)
        knowledge.import_entries(rb.knowledge_entries)

        # Store ai_guidelines, ai_style in session_meta
        if rb.ai_guidelines is not None:
            self._store.execute(
                "INSERT OR REPLACE INTO session_meta (key, value) VALUES (?, ?)",
                ("ai_guidelines", rb.ai_guidelines),
            )
        if rb.ai_style is not None:
            self._store.execute(
                "INSERT OR REPLACE INTO session_meta (key, value) VALUES (?, ?)",
                ("ai_style", rb.ai_style),
            )

        # Store paradigm_overrides as JSON in session_meta
        if rb.paradigm_overrides is not None:
            self._store.execute(
                "INSERT OR REPLACE INTO session_meta (key, value) VALUES (?, ?)",
                ("paradigm_overrides", json.dumps(rb.paradigm_overrides)),
            )

        # Store data_tables as state keys: data.<table_name>
        for table_name, table_data in (rb.data_tables or {}).items():
            self.state_set(f"data.{table_name}", table_data)

        # Store frontmatter_data as state
        for key, value in (rb.frontmatter_data or {}).items():
            self.state_set(key, value)

    # ------------------------------------------------------------------
    # Lifecycle helpers
    # ------------------------------------------------------------------

    def close(self) -> None:
        self._store.close()

    def __enter__(self) -> Session:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()
