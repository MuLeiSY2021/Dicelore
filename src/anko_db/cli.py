"""Session management CLI — create, list. Not exposed as MCP tools."""

from __future__ import annotations

from pathlib import Path

from anko_db.rulebook import Rulebook
from anko_db.session import Session


def create_session(
    rulebook_id: str,
    sessions_dir: Path | None = None,
    rulebooks_dir: Path | None = None,
    write_config: bool = False,
    config_dir: Path | None = None,
) -> str:
    """Create a new session, optionally load rulebook and write config file."""
    session = Session.create(rulebook_id, sessions_dir=sessions_dir)

    rulebooks_dir = rulebooks_dir or Path.home() / ".anko" / "rulebooks"
    rulebook_path = rulebooks_dir / rulebook_id
    if rulebook_path.exists():
        rb = Rulebook.load(rulebook_path)
        session.import_rulebook(rb)

    session_id = session.info.session_id
    session.close()

    if write_config:
        config_dir = config_dir or Path.cwd()
        config_path = config_dir / ".anko" / "config"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(f"session_id={session_id}\n")

    return session_id


def list_sessions(sessions_dir: Path | None = None) -> list[dict]:
    """List all sessions as dicts."""
    infos = Session.list_sessions(sessions_dir=sessions_dir)
    return [
        {
            "session_id": info.session_id,
            "rulebook_id": info.rulebook_id,
            "created_at": info.created_at,
        }
        for info in infos
    ]


def main() -> None:
    """CLI entry point: anko-session create|list."""
    import argparse

    parser = argparse.ArgumentParser(prog="anko-session", description="Manage anko game sessions")
    sub = parser.add_subparsers(dest="command", required=True)

    create_p = sub.add_parser("create", help="Create a new session")
    create_p.add_argument("rulebook_id", help="Rulebook to load")
    create_p.add_argument("--sessions-dir", type=Path, default=None)
    create_p.add_argument("--rulebooks-dir", type=Path, default=None)
    create_p.add_argument("--write-config", action="store_true", help="Write .anko/config in CWD")

    list_p = sub.add_parser("list", help="List sessions")
    list_p.add_argument("--sessions-dir", type=Path, default=None)

    args = parser.parse_args()

    if args.command == "create":
        sid = create_session(
            rulebook_id=args.rulebook_id,
            sessions_dir=args.sessions_dir,
            rulebooks_dir=args.rulebooks_dir,
            write_config=args.write_config,
        )
        print(sid)
    elif args.command == "list":
        for s in list_sessions(sessions_dir=args.sessions_dir):
            print(f"{s['session_id']}  {s['rulebook_id']}  {s['created_at']}")
