#!/usr/bin/env bats
# Tests for command variant resolution in pipeline-runner.sh

setup() {
  SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../lib" && pwd)"
  TMPDIR=$(mktemp -d)

  # Create minimal project structure
  mkdir -p "$TMPDIR/project/commands"
  mkdir -p "$TMPDIR/project/.poor-dev"
  mkdir -p "$TMPDIR/project/.opencode/command"
  mkdir -p "$TMPDIR/project/specs/001-test"

  # Create standard command files
  echo "# Standard specify" > "$TMPDIR/project/commands/poor-dev.specify.md"
  echo "# Standard plan" > "$TMPDIR/project/commands/poor-dev.plan.md"

  # Create simple variant
  echo "# Simple specify" > "$TMPDIR/project/commands/poor-dev.specify-simple.md"

  # Default config (no variant)
  echo '{}' > "$TMPDIR/project/.poor-dev/config.json"
}

teardown() {
  rm -rf "$TMPDIR"
}

@test "standard command resolves without variant" {
  # Test resolution logic extracted from pipeline-runner.sh
  PROJECT_DIR="$TMPDIR/project"
  STEP="specify"
  CMD_VARIANT=""
  COMMAND_FILE=""

  for candidate in \
    "$PROJECT_DIR/commands/poor-dev.${STEP}.md" \
    "$PROJECT_DIR/.opencode/command/poor-dev.${STEP}.md"; do
    if [[ -f "$candidate" ]]; then
      COMMAND_FILE="$candidate"
      break
    fi
  done

  [ -n "$COMMAND_FILE" ]
  [[ "$COMMAND_FILE" == *"commands/poor-dev.specify.md" ]]
}

@test "simple variant resolves when set" {
  PROJECT_DIR="$TMPDIR/project"
  STEP="specify"
  CMD_VARIANT="simple"
  COMMAND_FILE=""

  for candidate in \
    "$PROJECT_DIR/commands/poor-dev.${STEP}-${CMD_VARIANT}.md" \
    "$PROJECT_DIR/.opencode/command/poor-dev.${STEP}-${CMD_VARIANT}.md"; do
    if [[ -f "$candidate" ]]; then
      COMMAND_FILE="$candidate"
      break
    fi
  done

  [ -n "$COMMAND_FILE" ]
  [[ "$COMMAND_FILE" == *"poor-dev.specify-simple.md" ]]
}

@test "falls back to standard when variant not available" {
  PROJECT_DIR="$TMPDIR/project"
  STEP="plan"
  CMD_VARIANT="simple"
  COMMAND_FILE=""

  # Try variant first
  for candidate in \
    "$PROJECT_DIR/commands/poor-dev.${STEP}-${CMD_VARIANT}.md" \
    "$PROJECT_DIR/.opencode/command/poor-dev.${STEP}-${CMD_VARIANT}.md"; do
    if [[ -f "$candidate" ]]; then
      COMMAND_FILE="$candidate"
      break
    fi
  done

  # Fallback to standard
  if [[ -z "$COMMAND_FILE" ]]; then
    for candidate in \
      "$PROJECT_DIR/commands/poor-dev.${STEP}.md" \
      "$PROJECT_DIR/.opencode/command/poor-dev.${STEP}.md"; do
      if [[ -f "$candidate" ]]; then
        COMMAND_FILE="$candidate"
        break
      fi
    done
  fi

  [ -n "$COMMAND_FILE" ]
  [[ "$COMMAND_FILE" == *"commands/poor-dev.plan.md" ]]
}

@test "opencode command dir is used as fallback" {
  PROJECT_DIR="$TMPDIR/project"

  # Remove commands/ version, keep .opencode/ version
  rm "$PROJECT_DIR/commands/poor-dev.plan.md"
  echo "# opencode plan" > "$PROJECT_DIR/.opencode/command/poor-dev.plan.md"

  STEP="plan"
  COMMAND_FILE=""

  for candidate in \
    "$PROJECT_DIR/commands/poor-dev.${STEP}.md" \
    "$PROJECT_DIR/.opencode/command/poor-dev.${STEP}.md"; do
    if [[ -f "$candidate" ]]; then
      COMMAND_FILE="$candidate"
      break
    fi
  done

  [ -n "$COMMAND_FILE" ]
  [[ "$COMMAND_FILE" == *".opencode/command/poor-dev.plan.md" ]]
}
