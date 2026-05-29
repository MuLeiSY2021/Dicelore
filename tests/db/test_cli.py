from __future__ import annotations

from pathlib import Path

from anko_db.cli import create_session, list_sessions

FIXTURES = Path(__file__).parent.parent / "fixtures" / "rulebooks" / "test_rbk"


class TestCreateSession:
    def test_create_returns_session_id(self, tmp_path: Path):
        sid = create_session(
            rulebook_id="test_rbk",
            sessions_dir=tmp_path,
            rulebooks_dir=FIXTURES.parent,
        )
        assert sid
        assert (tmp_path / f"{sid}.db").exists()

    def test_create_with_unknown_rulebook(self, tmp_path: Path):
        sid = create_session(
            rulebook_id="nonexistent",
            sessions_dir=tmp_path,
            rulebooks_dir=tmp_path,
        )
        assert sid

    def test_create_writes_config(self, tmp_path: Path):
        config_dir = tmp_path / "project"
        config_dir.mkdir()
        sid = create_session(
            rulebook_id="test_rbk",
            sessions_dir=tmp_path,
            rulebooks_dir=FIXTURES.parent,
            write_config=True,
            config_dir=config_dir,
        )
        config_path = config_dir / ".anko" / "config"
        assert config_path.exists()
        assert sid in config_path.read_text()


class TestListSessions:
    def test_list_empty(self, tmp_path: Path):
        sessions = list_sessions(sessions_dir=tmp_path)
        assert sessions == []

    def test_list_after_create(self, tmp_path: Path):
        create_session("rb1", sessions_dir=tmp_path, rulebooks_dir=FIXTURES.parent)
        sessions = list_sessions(sessions_dir=tmp_path)
        assert len(sessions) == 1
