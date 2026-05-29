"""Integration test: CLI create → load rulebook → scene_narrate → persist → reload."""

from __future__ import annotations

import json
from pathlib import Path

from anko_db.cli import create_session
from anko_db.knowledge import Knowledge
from anko_db.session import Session

FIXTURES = Path(__file__).parent.parent / "fixtures" / "rulebooks" / "test_rbk"


class TestFullFlow:
    def test_create_rulebook_scene_narrate_persist_reload(self, tmp_path: Path):
        # 1. CLI creates session with rulebook
        sid = create_session(
            rulebook_id="test_rbk",
            sessions_dir=tmp_path,
            rulebooks_dir=FIXTURES.parent,
        )
        assert sid

        # 2. Load session
        session = Session.load(sid, sessions_dir=tmp_path)

        # 3. Verify rulebook data was imported
        k = Knowledge(session._store)
        assert len(k.search("荒野")) >= 1

        items = session.state_get("data.items")
        assert items is not None
        assert len(items) == 3

        # 4. Use scene_narrate pattern (state + history together)
        session.state_set("player.name", "Groknak")
        session.state_set("player.hp", 42)
        session.history_append(
            narrative="Groknak attacks the goblin",
            dice_results={"expression": "1d20+3", "total": 17},
            paradigm="dice_resolution",
            action="attack goblin",
        )
        session.note_write("plot_hook", "The goblin fled toward the cave")

        # 5. Verify before close
        assert session.state_get("player.name") == "Groknak"
        assert session.state_get("player.hp") == 42

        # 6. Close and reload
        session.close()
        reloaded = Session.load(sid, sessions_dir=tmp_path)

        # 7. Verify everything persists
        assert reloaded.state_get("player.name") == "Groknak"
        assert reloaded.state_get("player.hp") == 42

        row = reloaded.history_get(turn=1)
        assert row["narrative"] == "Groknak attacks the goblin"
        assert row["dice_results"]["total"] == 17

        assert reloaded.note_read("plot_hook") == "The goblin fled toward the cave"

        k2 = Knowledge(reloaded._store)
        assert len(k2.search("荒野")) >= 1

        overrides_row = reloaded._store.query_one(
            "SELECT value FROM session_meta WHERE key = ?", ("paradigm_overrides",)
        )
        overrides = json.loads(overrides_row["value"])
        assert overrides["overrides"]["combat"]["always_use"] == "dice_resolution"

        reloaded.close()

    def test_cli_write_config(self, tmp_path: Path):
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
