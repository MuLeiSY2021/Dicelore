# tests/db/test_session.py
from __future__ import annotations

import json
from pathlib import Path

import pytest

from anko_db.session import Session, SessionInfo
from anko_db.rulebook import Rulebook

FIXTURES = Path(__file__).parent.parent / "fixtures" / "rulebooks" / "test_rbk"


class TestSessionCreate:
    def test_create_generates_id_and_db(self, tmp_path: Path):
        session = Session.create("test_rulebook", sessions_dir=tmp_path)
        assert session.info.session_id
        assert session.info.rulebook_id == "test_rulebook"
        assert session.info.db_path.exists()
        session.close()

    def test_create_writes_meta(self, tmp_path: Path):
        session = Session.create("test_rulebook", sessions_dir=tmp_path)
        row = session._store.query_one(
            "SELECT value FROM session_meta WHERE key = ?", ("rulebook_id",)
        )
        assert row is not None
        assert row["value"] == "test_rulebook"
        session.close()

    def test_create_two_sessions_have_different_ids(self, tmp_path: Path):
        s1 = Session.create("rb1", sessions_dir=tmp_path)
        s2 = Session.create("rb2", sessions_dir=tmp_path)
        assert s1.info.session_id != s2.info.session_id
        s1.close()
        s2.close()


class TestSessionLoad:
    def test_load_existing_session(self, tmp_path: Path):
        session = Session.create("my_rbk", sessions_dir=tmp_path)
        sid = session.info.session_id
        session.close()

        loaded = Session.load(sid, sessions_dir=tmp_path)
        assert loaded.info.session_id == sid
        assert loaded.info.rulebook_id == "my_rbk"
        loaded.close()

    def test_load_nonexistent_raises(self, tmp_path: Path):
        with pytest.raises(FileNotFoundError, match="Session"):
            Session.load("nonexistent", sessions_dir=tmp_path)


class TestSessionList:
    def test_list_sessions(self, tmp_path: Path):
        s1 = Session.create("rb1", sessions_dir=tmp_path)
        s2 = Session.create("rb2", sessions_dir=tmp_path)
        s1.close()
        s2.close()

        sessions = Session.list_sessions(sessions_dir=tmp_path)
        ids = [s.session_id for s in sessions]
        assert s1.info.session_id in ids
        assert s2.info.session_id in ids

    def test_list_empty_dir(self, tmp_path: Path):
        sessions = Session.list_sessions(sessions_dir=tmp_path)
        assert sessions == []


class TestStateCRUD:
    def test_state_set_and_get(self, tmp_path: Path):
        session = Session.create("rbk", sessions_dir=tmp_path)
        session.state_set("player.hp", 42)
        assert session.state_get("player.hp") == 42
        session.close()

    def test_state_get_missing_returns_none(self, tmp_path: Path):
        session = Session.create("rbk", sessions_dir=tmp_path)
        assert session.state_get("nonexistent") is None
        session.close()

    def test_state_set_overwrites(self, tmp_path: Path):
        session = Session.create("rbk", sessions_dir=tmp_path)
        session.state_set("player.hp", 42)
        session.state_set("player.hp", 30)
        assert session.state_get("player.hp") == 30
        session.close()

    def test_state_stores_complex_value(self, tmp_path: Path):
        session = Session.create("rbk", sessions_dir=tmp_path)
        data = {"name": "Grok", "stats": {"str": 16, "dex": 12}}
        session.state_set("npc.grok", data)
        assert session.state_get("npc.grok") == data
        session.close()


class TestNotesCRUD:
    def test_note_write_and_read(self, tmp_path: Path):
        session = Session.create("rbk", sessions_dir=tmp_path)
        session.note_write("plot_hook", "The old wizard mentioned a cave")
        assert session.note_read("plot_hook") == "The old wizard mentioned a cave"
        session.close()

    def test_note_read_missing_returns_none(self, tmp_path: Path):
        session = Session.create("rbk", sessions_dir=tmp_path)
        assert session.note_read("nonexistent") is None
        session.close()

    def test_note_write_overwrites(self, tmp_path: Path):
        session = Session.create("rbk", sessions_dir=tmp_path)
        session.note_write("plot_hook", "First version")
        session.note_write("plot_hook", "Updated version")
        assert session.note_read("plot_hook") == "Updated version"
        session.close()


class TestHistoryCRUD:
    def test_history_append_returns_turn(self, tmp_path: Path):
        session = Session.create("rbk", sessions_dir=tmp_path)
        turn = session.history_append(
            narrative="You hit the goblin",
            dice_results={"expression": "1d20+3", "total": 17},
            paradigm="dice_resolution",
            action="attack goblin",
        )
        assert turn == 1
        session.close()

    def test_history_auto_increments(self, tmp_path: Path):
        session = Session.create("rbk", sessions_dir=tmp_path)
        t1 = session.history_append("n1", None, "free_narration", "rest")
        t2 = session.history_append("n2", None, "free_narration", "walk")
        assert t1 == 1
        assert t2 == 2
        session.close()

    def test_history_get_by_turn(self, tmp_path: Path):
        session = Session.create("rbk", sessions_dir=tmp_path)
        session.history_append("You attack", {"total": 15}, "dice_resolution", "attack")
        row = session.history_get(turn=1)
        assert row is not None
        assert row["narrative"] == "You attack"
        assert row["paradigm_used"] == "dice_resolution"
        session.close()

    def test_history_get_last_n(self, tmp_path: Path):
        session = Session.create("rbk", sessions_dir=tmp_path)
        session.history_append("n1", None, "free_narration", "a1")
        session.history_append("n2", None, "free_narration", "a2")
        session.history_append("n3", None, "free_narration", "a3")
        rows = session.history_get(last_n=2)
        assert len(rows) == 2
        assert rows[0]["narrative"] == "n2"
        assert rows[1]["narrative"] == "n3"
        session.close()

    def test_history_get_missing_turn_returns_none(self, tmp_path: Path):
        session = Session.create("rbk", sessions_dir=tmp_path)
        assert session.history_get(turn=999) is None
        session.close()


class TestSessionImportRulebook:
    def test_import_rulebook_populates_knowledge(self, tmp_path: Path):
        session = Session.create("test_rbk", sessions_dir=tmp_path)
        rb = Rulebook.load(FIXTURES)
        session.import_rulebook(rb)
        from anko_db.knowledge import Knowledge
        k = Knowledge(session._store)
        results = k.search("荒野")
        assert len(results) >= 1
        session.close()

    def test_import_rulebook_stores_ai_guidelines(self, tmp_path: Path):
        session = Session.create("test_rbk", sessions_dir=tmp_path)
        rb = Rulebook.load(FIXTURES)
        session.import_rulebook(rb)
        row = session._store.query_one(
            "SELECT value FROM session_meta WHERE key = ?", ("ai_guidelines",)
        )
        assert row is not None
        assert "尊重骰子" in row["value"]
        session.close()

    def test_import_rulebook_stores_paradigm_overrides(self, tmp_path: Path):
        session = Session.create("test_rbk", sessions_dir=tmp_path)
        rb = Rulebook.load(FIXTURES)
        session.import_rulebook(rb)
        row = session._store.query_one(
            "SELECT value FROM session_meta WHERE key = ?", ("paradigm_overrides",)
        )
        assert row is not None
        overrides = json.loads(row["value"])
        assert "overrides" in overrides
        session.close()

    def test_import_rulebook_stores_csv_data_as_state(self, tmp_path: Path):
        session = Session.create("test_rbk", sessions_dir=tmp_path)
        rb = Rulebook.load(FIXTURES)
        session.import_rulebook(rb)
        items = session.state_get("data.items")
        assert items is not None
        assert len(items) == 3
        session.close()

    def test_import_rulebook_stores_frontmatter_as_state(self, tmp_path: Path):
        session = Session.create("test_rbk", sessions_dir=tmp_path)
        rb = Rulebook.load(FIXTURES)
        session.import_rulebook(rb)
        setting = session.state_get("world.setting")
        assert setting is not None
        assert setting["type"] == "region"
        session.close()
