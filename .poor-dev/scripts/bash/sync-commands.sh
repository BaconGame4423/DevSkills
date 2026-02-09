#!/bin/bash
# sync-commands.sh - Sync OpenCode commands/agents to Claude Code directories
# Usage: bash .poor-dev/scripts/bash/sync-commands.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$ROOT_DIR"

# Sync commands: .opencode/command/poor-dev.*.md → .claude/commands/
mkdir -p .claude/commands
# Remove stale symlinks
find .claude/commands -maxdepth 1 -type l ! -exec test -e {} \; -delete 2>/dev/null || true
for f in .opencode/command/poor-dev.*.md; do
  [ -f "$f" ] || continue
  target=".claude/commands/$(basename "$f")"
  ln -sf "../../$f" "$target"
done

# Sync agents: .opencode/agents/*.md → .claude/agents/
# Note: .claude/agents/ has its own platform-specific definitions.
# Only sync OpenCode agents that don't have a Claude Code equivalent.
# Since we maintain separate definitions for each platform, skip this sync.

echo "Synced $(ls -1 .claude/commands/poor-dev.*.md 2>/dev/null | wc -l) commands to .claude/commands/"
echo "Claude Code agents are maintained separately in .claude/agents/"
echo "Done."
