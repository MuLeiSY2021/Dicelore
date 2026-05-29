from __future__ import annotations

from pathlib import Path

from anko_db.store import Store


class TestStoreInit:
    def test_creates_db_file(self, tmp_path: Path):
        db_path = tmp_path / "test.db"
        store = Store(db_path)
        assert db_path.exists()
        store.close()

    def test_schema_tables_exist(self, tmp_path: Path):
        store = Store(tmp_path / "test.db")
        rows = store.query_all(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        table_names = [r["name"] for r in rows]
        assert "session_meta" in table_names
        assert "state" in table_names
        assert "history" in table_names
        assert "notes" in table_names
        store.close()

    def test_knowledge_fts5_table_exists(self, tmp_path: Path):
        store = Store(tmp_path / "test.db")
        rows = store.query_all(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge'"
        )
        assert len(rows) == 1
        store.close()

    def test_reopen_preserves_data(self, tmp_path: Path):
        db_path = tmp_path / "test.db"
        store = Store(db_path)
        store.execute(
            "INSERT INTO session_meta (key, value) VALUES (?, ?)",
            ("test_key", "test_value"),
        )
        store.close()

        store2 = Store(db_path)
        row = store2.query_one("SELECT value FROM session_meta WHERE key = ?", ("test_key",))
        assert row is not None
        assert row["value"] == "test_value"
        store2.close()


class TestStoreQueries:
    def test_execute_and_query_one(self, tmp_path: Path):
        store = Store(tmp_path / "test.db")
        store.execute(
            "INSERT INTO session_meta (key, value) VALUES (?, ?)",
            ("k1", "v1"),
        )
        row = store.query_one("SELECT * FROM session_meta WHERE key = ?", ("k1",))
        assert row == {"key": "k1", "value": "v1"}
        store.close()

    def test_query_one_returns_none_when_missing(self, tmp_path: Path):
        store = Store(tmp_path / "test.db")
        row = store.query_one("SELECT * FROM session_meta WHERE key = ?", ("missing",))
        assert row is None
        store.close()

    def test_query_all_returns_list(self, tmp_path: Path):
        store = Store(tmp_path / "test.db")
        store.execute("INSERT INTO session_meta (key, value) VALUES (?, ?)", ("a", "1"))
        store.execute("INSERT INTO session_meta (key, value) VALUES (?, ?)", ("b", "2"))
        rows = store.query_all("SELECT * FROM session_meta ORDER BY key")
        assert len(rows) == 2
        assert rows[0]["key"] == "a"
        assert rows[1]["key"] == "b"
        store.close()

    def test_context_manager(self, tmp_path: Path):
        db_path = tmp_path / "test.db"
        with Store(db_path) as store:
            store.execute("INSERT INTO session_meta (key, value) VALUES (?, ?)", ("x", "y"))
        with Store(db_path) as store:
            row = store.query_one("SELECT value FROM session_meta WHERE key = ?", ("x",))
            assert row is not None
            assert row["value"] == "y"
