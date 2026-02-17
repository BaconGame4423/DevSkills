#!/usr/bin/env bats
# Tests for lib/extract-output.sh

setup() {
  SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../lib" && pwd)"
  FIXTURES="$(cd "$(dirname "$BATS_TEST_FILENAME")/fixtures" && pwd)"
  TMPDIR=$(mktemp -d)
}

teardown() {
  rm -rf "$TMPDIR"
}

@test "extract opencode JSON format" {
  run bash "$SCRIPT_DIR/extract-output.sh" \
    "$FIXTURES/mock-dispatch/specify-opencode.txt" \
    "$TMPDIR/spec.md"
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.status == "ok"'
  echo "$output" | jq -e '.format == "opencode"'
  [ -f "$TMPDIR/spec.md" ]
  # Should not contain [BRANCH: ...] line
  ! grep -q '^\[BRANCH:' "$TMPDIR/spec.md"
  # Should contain spec content
  grep -q 'Feature Specification' "$TMPDIR/spec.md"
}

@test "extract claude plaintext format" {
  run bash "$SCRIPT_DIR/extract-output.sh" \
    "$FIXTURES/mock-dispatch/specify-claude.txt" \
    "$TMPDIR/spec.md"
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.status == "ok"'
  echo "$output" | jq -e '.format == "plaintext"'
  [ -f "$TMPDIR/spec.md" ]
  ! grep -q '^\[BRANCH:' "$TMPDIR/spec.md"
  grep -q 'Feature Specification' "$TMPDIR/spec.md"
}

@test "fail on missing file" {
  run bash "$SCRIPT_DIR/extract-output.sh" \
    "/nonexistent/file.txt" \
    "$TMPDIR/out.md"
  [ "$status" -eq 1 ]
  echo "$output" | jq -e '.error'
}

@test "fail on empty file" {
  touch "$TMPDIR/empty.txt"
  run bash "$SCRIPT_DIR/extract-output.sh" \
    "$TMPDIR/empty.txt" \
    "$TMPDIR/out.md"
  [ "$status" -eq 1 ]
  echo "$output" | jq -e '.error'
}

@test "creates parent directory if needed" {
  run bash "$SCRIPT_DIR/extract-output.sh" \
    "$FIXTURES/mock-dispatch/specify-claude.txt" \
    "$TMPDIR/nested/dir/spec.md"
  [ "$status" -eq 0 ]
  [ -f "$TMPDIR/nested/dir/spec.md" ]
}
