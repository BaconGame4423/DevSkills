#!/usr/bin/env bats
# Tests for lib/pipeline-state.sh

setup() {
  SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../lib" && pwd)"
  TMPDIR=$(mktemp -d)
  FD="$TMPDIR/specs/001-test"
  mkdir -p "$FD"
}

teardown() {
  rm -rf "$TMPDIR"
}

@test "init creates pipeline-state.json" {
  run bash "$SCRIPT_DIR/pipeline-state.sh" init "$FD" "feature" '["specify","plan","implement"]'
  [ "$status" -eq 0 ]
  [ -f "$FD/pipeline-state.json" ]

  FLOW=$(jq -r '.flow' "$FD/pipeline-state.json")
  [ "$FLOW" = "feature" ]

  CURRENT=$(jq -r '.current' "$FD/pipeline-state.json")
  [ "$CURRENT" = "specify" ]

  STATUS=$(jq -r '.status' "$FD/pipeline-state.json")
  [ "$STATUS" = "active" ]
}

@test "complete-step advances current" {
  bash "$SCRIPT_DIR/pipeline-state.sh" init "$FD" "feature" '["specify","plan","implement"]' > /dev/null
  run bash "$SCRIPT_DIR/pipeline-state.sh" complete-step "$FD" "specify"
  [ "$status" -eq 0 ]

  CURRENT=$(jq -r '.current' "$FD/pipeline-state.json")
  [ "$CURRENT" = "plan" ]

  COMPLETED=$(jq -r '.completed | length' "$FD/pipeline-state.json")
  [ "$COMPLETED" -eq 1 ]
}

@test "set-status updates status and reason" {
  bash "$SCRIPT_DIR/pipeline-state.sh" init "$FD" "feature" '["specify"]' > /dev/null
  run bash "$SCRIPT_DIR/pipeline-state.sh" set-status "$FD" "paused" "NO-GO verdict"
  [ "$status" -eq 0 ]

  STATUS=$(jq -r '.status' "$FD/pipeline-state.json")
  [ "$STATUS" = "paused" ]

  REASON=$(jq -r '.pauseReason' "$FD/pipeline-state.json")
  [ "$REASON" = "NO-GO verdict" ]
}

@test "set-approval and clear-approval" {
  bash "$SCRIPT_DIR/pipeline-state.sh" init "$FD" "feature" '["specify"]' > /dev/null
  bash "$SCRIPT_DIR/pipeline-state.sh" set-approval "$FD" "gate" "specify" > /dev/null

  STATUS=$(jq -r '.status' "$FD/pipeline-state.json")
  [ "$STATUS" = "awaiting-approval" ]

  bash "$SCRIPT_DIR/pipeline-state.sh" clear-approval "$FD" > /dev/null
  STATUS=$(jq -r '.status' "$FD/pipeline-state.json")
  [ "$STATUS" = "active" ]
}

@test "set-pipeline replaces steps" {
  bash "$SCRIPT_DIR/pipeline-state.sh" init "$FD" "bugfix" '["bugfix"]' > /dev/null
  bash "$SCRIPT_DIR/pipeline-state.sh" complete-step "$FD" "bugfix" > /dev/null
  run bash "$SCRIPT_DIR/pipeline-state.sh" set-pipeline "$FD" '["bugfix","plan","implement"]'
  [ "$status" -eq 0 ]

  CURRENT=$(jq -r '.current' "$FD/pipeline-state.json")
  [ "$CURRENT" = "plan" ]
}

@test "read returns empty object for missing file" {
  run bash "$SCRIPT_DIR/pipeline-state.sh" read "$TMPDIR/nonexistent"
  [ "$status" -eq 0 ]
  [ "$output" = "{}" ]
}
