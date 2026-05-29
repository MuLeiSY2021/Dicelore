"""Rulebook loading — manifest.md + markdown + CSV. No standalone YAML files."""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass, field
from io import StringIO
from pathlib import Path

import yaml

from anko_db.knowledge import KnowledgeEntry


@dataclass
class RulebookManifest:
    id: str
    name: str
    version: str
    description: str
    author: str
    modules: dict[str, bool] = field(default_factory=dict)


@dataclass
class RulebookData:
    manifest: RulebookManifest
    knowledge_entries: list[KnowledgeEntry] = field(default_factory=list)
    ai_guidelines: str | None = None
    ai_style: str | None = None
    paradigm_overrides: dict | None = None
    data_tables: dict[str, list[dict]] = field(default_factory=dict)
    frontmatter_data: dict[str, dict] = field(default_factory=dict)


_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


class Rulebook:
    @staticmethod
    def load(path: Path | str) -> RulebookData:
        path = Path(path)
        data = RulebookData(manifest=Rulebook._load_manifest(path))

        # manifest.md body → knowledge
        manifest_body = Rulebook._extract_manifest_body(path)
        if manifest_body:
            data.knowledge_entries.append(
                KnowledgeEntry(name="manifest", content=manifest_body, category="meta")
            )

        # world/ markdown → knowledge (FTS5)
        Rulebook._load_markdown_dir(path / "world", "world", data)

        # rules/ markdown → knowledge + frontmatter
        Rulebook._load_markdown_dir(path / "rules", "rules", data)

        # Extract paradigm_overrides from rules/paradigm.md frontmatter
        paradigm_key = "rules.paradigm"
        if paradigm_key in data.frontmatter_data:
            fm = data.frontmatter_data[paradigm_key]
            if "overrides" in fm:
                data.paradigm_overrides = fm

        # data/*.csv
        data_dir = path / "data"
        if data_dir.exists():
            for csv_file in sorted(data_dir.glob("*.csv")):
                data.data_tables[csv_file.stem] = Rulebook._load_csv(csv_file)

        # ai/guidelines.md and ai/style.md (not FTS5, direct injection)
        ai_dir = path / "ai"
        guidelines_path = ai_dir / "guidelines.md"
        if guidelines_path.exists():
            _, body = Rulebook._split_frontmatter(guidelines_path.read_text(encoding="utf-8"))
            data.ai_guidelines = body.strip()

        style_path = ai_dir / "style.md"
        if style_path.exists():
            _, body = Rulebook._split_frontmatter(style_path.read_text(encoding="utf-8"))
            data.ai_style = body.strip()

        return data

    @staticmethod
    def _load_manifest(rulebook_dir: Path) -> RulebookManifest:
        manifest_path = rulebook_dir / "manifest.md"
        if not manifest_path.exists():
            raise FileNotFoundError(f"manifest.md not found in {rulebook_dir}")
        content = manifest_path.read_text(encoding="utf-8")
        frontmatter, _ = Rulebook._split_frontmatter(content)
        if not frontmatter:
            raise ValueError("manifest.md has no frontmatter")
        required = ("id", "name", "version")
        for f in required:
            if f not in frontmatter:
                raise ValueError(f"manifest.md missing required field: {f}")
        return RulebookManifest(
            id=frontmatter["id"],
            name=frontmatter["name"],
            version=str(frontmatter["version"]),
            description=frontmatter.get("description", ""),
            author=frontmatter.get("author", ""),
            modules=frontmatter.get("modules", {}),
        )

    @staticmethod
    def _extract_manifest_body(rulebook_dir: Path) -> str | None:
        manifest_path = rulebook_dir / "manifest.md"
        _, body = Rulebook._split_frontmatter(manifest_path.read_text(encoding="utf-8"))
        return body.strip() or None

    @staticmethod
    def _load_markdown_dir(md_dir: Path, category: str, data: RulebookData) -> None:
        if not md_dir.exists():
            return
        for md_file in sorted(md_dir.glob("*.md")):
            content = md_file.read_text(encoding="utf-8")
            frontmatter, body = Rulebook._split_frontmatter(content)
            if frontmatter:
                key = f"{category}.{md_file.stem}"
                data.frontmatter_data[key] = frontmatter
            body_text = body.strip()
            if body_text:
                data.knowledge_entries.append(
                    KnowledgeEntry(name=md_file.stem, content=body_text, category=category)
                )

    @staticmethod
    def _split_frontmatter(content: str) -> tuple[dict, str]:
        match = _FRONTMATTER_RE.match(content)
        if match:
            frontmatter = yaml.safe_load(match.group(1)) or {}
            body = content[match.end():]
            return frontmatter, body
        return {}, content

    @staticmethod
    def _load_csv(csv_path: Path) -> list[dict]:
        text = csv_path.read_text(encoding="utf-8")
        reader = csv.DictReader(StringIO(text))
        return [row for row in reader]
