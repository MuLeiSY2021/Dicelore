# tests/db/test_knowledge.py
from __future__ import annotations

from pathlib import Path

from anko_db.knowledge import Knowledge, KnowledgeEntry
from anko_db.store import Store


class TestKnowledgeImport:
    def test_import_entries(self, tmp_path: Path):
        store = Store(tmp_path / "test.db")
        k = Knowledge(store)
        entries = [
            KnowledgeEntry(name="哥布林", content="一种小型绿色生物", category="monster"),
            KnowledgeEntry(name="兽人", content="强壮的战士种族", category="race"),
        ]
        count = k.import_entries(entries)
        assert count == 2
        store.close()

    def test_import_empty_list(self, tmp_path: Path):
        store = Store(tmp_path / "test.db")
        k = Knowledge(store)
        count = k.import_entries([])
        assert count == 0
        store.close()


class TestKnowledgeSearch:
    def test_search_finds_match(self, tmp_path: Path):
        store = Store(tmp_path / "test.db")
        k = Knowledge(store)
        k.import_entries([
            KnowledgeEntry(name="哥布林", content="小型绿色生物，擅长偷袭", category="monster"),
            KnowledgeEntry(name="兽人战士", content="强壮的战士，擅长近战", category="race"),
        ])
        results = k.search("绿色")
        assert len(results) >= 1
        assert results[0].name == "哥布林"
        store.close()

    def test_search_no_match_returns_empty(self, tmp_path: Path):
        store = Store(tmp_path / "test.db")
        k = Knowledge(store)
        k.import_entries([
            KnowledgeEntry(name="哥布林", content="小型绿色生物", category="monster"),
        ])
        results = k.search("恐龙")
        assert results == []
        store.close()

    def test_search_with_limit(self, tmp_path: Path):
        store = Store(tmp_path / "test.db")
        k = Knowledge(store)
        k.import_entries([
            KnowledgeEntry(name=f"生物{i}", content=f"第{i}种绿色生物", category="monster")
            for i in range(10)
        ])
        results = k.search("绿色", limit=3)
        assert len(results) <= 3
        store.close()
