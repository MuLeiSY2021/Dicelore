"""anko_game MCP server — 6 scene-driven tools. No session management tools."""

from __future__ import annotations

import json
import os
from pathlib import Path

from mcp.server.fastmcp import FastMCP

from anko_db.knowledge import Knowledge
from anko_db.session import Session

mcp = FastMCP("anko_game")

_SESSIONS_DIR: Path = Path.home() / ".anko" / "sessions"
_current_session: Session | None = None


def _set_session(session: Session) -> None:
    """Set the current session. Used by tests and session resolution."""
    global _current_session
    _current_session = session


def _reset() -> None:
    """Reset current session. Used in tests."""
    global _current_session
    if _current_session is not None:
        _current_session.close()
        _current_session = None


def _resolve_session() -> Session:
    """Resolve current session from env var or .anko/config, lazy-init on first call."""
    global _current_session
    if _current_session is not None:
        return _current_session

    session_id = os.environ.get("ANKO_SESSION_ID")
    if not session_id:
        config_path = Path.cwd() / ".anko" / "config"
        if config_path.exists():
            for line in config_path.read_text().splitlines():
                if line.startswith("session_id="):
                    session_id = line.split("=", 1)[1].strip()
                    break

    if not session_id:
        raise RuntimeError(
            "No active session. Set ANKO_SESSION_ID env var or "
            "create .anko/config with session_id=<id>"
        )

    _current_session = Session.load(session_id, sessions_dir=_SESSIONS_DIR)
    return _current_session


def _get_session() -> Session:
    """Get current session, resolving if needed."""
    return _resolve_session()


@mcp.tool()
def state_get(key: str) -> object:
    """Read a state value by key. Supports nested keys like 'player.hp'."""
    return _get_session().state_get(key)


@mcp.tool()
def history_get(turn: int | None = None, last_n: int | None = None) -> dict | list[dict] | None:
    """Get history entry by turn number, or the last N entries."""
    return _get_session().history_get(turn=turn, last_n=last_n)


@mcp.tool()
def knowledge_search(query: str, limit: int = 10) -> list[dict]:
    """Search the knowledge base using full-text search."""
    session = _get_session()
    k = Knowledge(session._store)
    return [
        {"name": r.name, "content": r.content, "category": r.category}
        for r in k.search(query, limit=limit)
    ]


@mcp.tool()
def note_read(tag: str) -> str | None:
    """Read a narrative note by tag."""
    return _get_session().note_read(tag)


@mcp.tool()
def note_write(tag: str, content: str) -> dict:
    """Write or update a narrative note."""
    _get_session().note_write(tag, content)
    return {"tag": tag, "stored": True}


@mcp.tool()
def scene_narrate(
    narrative: str,
    scene_type: str = "general",
    state_changes: dict[str, object] | None = None,
) -> dict:
    """Record a narrative scene with optional state changes. No dice involved.

    For pure narration, rest scenes, and non-critical interactions.
    State changes are applied atomically with the narrative.
    """
    session = _get_session()

    applied = False
    if state_changes:
        for key, value in state_changes.items():
            session.state_set(key, value)
        applied = True

    turn = session.history_append(
        narrative=narrative,
        dice_results=None,
        paradigm="free_narration",
        action="narrate",
    )

    return {
        "paradigm": "free_narration",
        "recorded": True,
        "state_applied": applied,
        "turn": turn,
    }


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
