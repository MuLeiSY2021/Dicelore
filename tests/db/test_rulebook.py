# tests/db/test_rulebook.py
from __future__ import annotations

from pathlib import Path

import pytest

from anko_db.rulebook import Rulebook, RulebookData, RulebookManifest

FIXTURES = Path(__file__).parent.parent / "fixtures" / "rulebooks" / "test_rbk"


class TestManifestParsing:
    def test_load_manifest(self):
        rb = Rulebook.load(FIXTURES)
        assert rb.manifest.id == "test_rbk"
        assert rb.manifest.name == "测试规则书"
        assert rb.manifest.version == "0.1"

    def test_manifest_modules(self):
        rb = Rulebook.load(FIXTURES)
        assert rb.manifest.modules["phases"] is False
        assert rb.manifest.modules["constraints"] is True
        assert rb.manifest.modules["voting"] is True

    def test_missing_manifest_raises(self, tmp_path: Path):
        with pytest.raises(FileNotFoundError, match="manifest.md"):
            Rulebook.load(tmp_path)

    def test_invalid_manifest_raises(self, tmp_path: Path):
        manifest_dir = tmp_path / "bad_rbk"
        manifest_dir.mkdir()
        (manifest_dir / "manifest.md").write_text("---\nnot: valid\n---\n")
        with pytest.raises(ValueError, match="manifest"):
            Rulebook.load(manifest_dir)


class TestMarkdownLoading:
    def test_world_markdown_imported_to_knowledge(self):
        rb = Rulebook.load(FIXTURES)
        world_entries = [e for e in rb.knowledge_entries if e.category == "world"]
        assert len(world_entries) >= 1
        assert any("荒野" in e.content for e in world_entries)

    def test_frontmatter_extracted(self):
        rb = Rulebook.load(FIXTURES)
        assert len(rb.frontmatter_data) >= 1
        setting_key = [k for k in rb.frontmatter_data if "setting" in k][0]
        assert rb.frontmatter_data[setting_key]["type"] == "region"

    def test_manifest_body_imported_to_knowledge(self):
        rb = Rulebook.load(FIXTURES)
        meta_entries = [e for e in rb.knowledge_entries if e.category == "meta"]
        assert len(meta_entries) >= 1


class TestAILoading:
    def test_ai_guidelines_loaded(self):
        rb = Rulebook.load(FIXTURES)
        assert rb.ai_guidelines is not None
        assert "尊重骰子" in rb.ai_guidelines

    def test_ai_style_loaded(self):
        rb = Rulebook.load(FIXTURES)
        assert rb.ai_style is not None
        assert "兽人" in rb.ai_style


class TestParadigmOverrides:
    def test_paradigm_overrides_from_frontmatter(self):
        rb = Rulebook.load(FIXTURES)
        assert rb.paradigm_overrides is not None
        assert "overrides" in rb.paradigm_overrides
        assert rb.paradigm_overrides["overrides"]["combat"]["always_use"] == "dice_resolution"


class TestCSVLoading:
    def test_data_tables_loaded(self):
        rb = Rulebook.load(FIXTURES)
        assert "items" in rb.data_tables
        items = rb.data_tables["items"]
        assert len(items) == 3
        assert items[0]["name"] == "铁剑"

    def test_csv_rows_have_id(self):
        rb = Rulebook.load(FIXTURES)
        items = rb.data_tables["items"]
        assert all("id" in row for row in items)
