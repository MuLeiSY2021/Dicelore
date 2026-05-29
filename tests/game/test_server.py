from __future__ import annotations

from pathlib import Path

import pytest

from anko_db.cli import create_session
from anko_game.server import (
    history_get,
    knowledge_search,
    note_read,
    note_write,
    scene_narrate,
    state_get,
    _reset,
    _set_session,
)

FIXTURES = Path(__file__).parent.parent / "fixtures" / "rulebooks" / "test_rbk"


@pytest.fixture(autouse=True)
def isolate(tmp_path, monkeypatch):
    """Each test gets a fresh session via CLI create."""
    _reset()
    sid = create_session(
        rulebook_id="test_rbk",
        sessions_dir=tmp_path,
        rulebooks_dir=FIXTURES.parent,
    )
    from anko_db.session import Session
    session = Session.load(sid, sessions_dir=tmp_path)
    _set_session(session)
    yield
    _reset()


class TestStateGet:
    def test_state_get_existing(self):
        scene_narrate(
            narrative="You rest",
            state_changes={"player.hp": 42},
        )
        assert state_get("player.hp") == 42

    def test_state_get_missing(self):
        assert state_get("nonexistent") is None


class TestHistoryGet:
    def test_history_get_by_turn(self):
        scene_narrate(narrative="You attack the goblin")
        result = history_get(turn=1)
        assert result is not None
        assert result["narrative"] == "You attack the goblin"
        assert result["paradigm_used"] == "free_narration"

    def test_history_get_last_n(self):
        scene_narrate(narrative="Scene 1")
        scene_narrate(narrative="Scene 2")
        results = history_get(last_n=2)
        assert len(results) == 2

    def test_history_get_missing_turn(self):
        assert history_get(turn=999) is None


class TestKnowledgeSearch:
    def test_search_finds_rulebook_content(self):
        results = knowledge_search("荒野")
        assert len(results) >= 1


class TestNoteTools:
    def test_note_write_and_read(self):
        note_write("plot", "The wizard mentioned a cave")
        assert note_read("plot") == "The wizard mentioned a cave"

    def test_note_read_missing(self):
        assert note_read("nonexistent") is None


class TestSceneNarrate:
    def test_basic_narration(self):
        result = scene_narrate(narrative="The sun sets over the wasteland")
        assert result["paradigm"] == "free_narration"
        assert result["recorded"] is True
        assert result["state_applied"] is False
        assert result["turn"] == 1

    def test_narration_with_state_changes(self):
        result = scene_narrate(
            narrative="You rest and recover",
            state_changes={"player.hp": 50, "player.fatigue": 0},
        )
        assert result["paradigm"] == "free_narration"
        assert result["state_applied"] is True
        assert state_get("player.hp") == 50
        assert state_get("player.fatigue") == 0

    def test_narration_records_history(self):
        scene_narrate(narrative="Scene A", state_changes={"x": 1})
        scene_narrate(narrative="Scene B")
        row = history_get(turn=1)
        assert row["narrative"] == "Scene A"
        assert row["paradigm_used"] == "free_narration"

    def test_scene_type_parameter(self):
        result = scene_narrate(narrative="Combat!", scene_type="combat")
        assert result["paradigm"] == "free_narration"
