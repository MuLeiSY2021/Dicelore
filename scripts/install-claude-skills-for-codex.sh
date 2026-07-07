#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${SOURCE_DIR:-$REPO_ROOT/.claude/skills}"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
TARGET_ROOT="${TARGET_ROOT:-$CODEX_HOME/skills}"
PREFIX="${PREFIX:-dicelore-}"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source skills dir not found: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$TARGET_ROOT"

echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_ROOT"
echo "Prefix: $PREFIX"

count=0
for skill_dir in "$SOURCE_DIR"/*; do
  [[ -d "$skill_dir" ]] || continue
  [[ -f "$skill_dir/SKILL.md" ]] || continue

  base_name="$(basename "$skill_dir")"
  skill_name="${PREFIX}${base_name}"
  target_dir="$TARGET_ROOT/$skill_name"
  target_file="$target_dir/SKILL.md"
  source_skill="$skill_dir/SKILL.md"

  mkdir -p "$target_dir"

  raw_desc="$(awk '/^description:[[:space:]]*/{sub(/^description:[[:space:]]*/, "", $0); print; exit}' "$source_skill" || true)"
  if [[ -z "${raw_desc:-}" ]]; then
    raw_desc="Imported wrapper for $base_name from $SOURCE_DIR"
  fi

  cat > "$target_file" <<WRAP
---
name: $skill_name
description: $raw_desc
---

# Imported Wrapper: $skill_name

This wrapper maps a project-local Claude skill into Codex skill discovery.

## Source of Truth
- Source skill file: $source_skill
- Source skill directory: $skill_dir
- Project root: $REPO_ROOT

## Required Execution Steps
1. Read the source skill file above fully before taking task actions.
2. If the source skill references extra files (for example in \`references/\`), read those from the source skill directory.
3. Resolve any project-relative links against project root: \`$REPO_ROOT\`.
4. Follow source skill instructions as the authoritative content.

## Notes
- This wrapper intentionally avoids copying the original skill docs, so updates in \`.claude/skills\` stay effective.
- Remove this wrapper by deleting: \`$target_dir\`.
WRAP

  ((count+=1))
  echo "Installed wrapper: $skill_name"
done

echo "Installed $count wrapper skills into $TARGET_ROOT"
echo "Restart Codex to pick up new skills."
