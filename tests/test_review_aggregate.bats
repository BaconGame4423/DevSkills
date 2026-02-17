#!/usr/bin/env bats
# Tests for lib/review-aggregate.sh

setup() {
  SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../lib" && pwd)"
  FIXTURES="$(cd "$(dirname "$BATS_TEST_FILENAME")/fixtures" && pwd)"
  TMPDIR=$(mktemp -d)

  # Copy persona outputs to temp dir
  cp "$FIXTURES/persona-outputs/planreview-pm.txt" "$TMPDIR/"
  cp "$FIXTURES/persona-outputs/planreview-critical.txt" "$TMPDIR/"
}

teardown() {
  rm -rf "$TMPDIR"
}

@test "aggregate counts issues correctly" {
  run bash "$SCRIPT_DIR/review-aggregate.sh" \
    --output-dir "$TMPDIR" \
    --id-prefix "PR" \
    --next-id 1
  [ "$status" -eq 0 ]

  TOTAL=$(echo "$output" | jq -r '.total')
  C=$(echo "$output" | jq -r '.C')
  H=$(echo "$output" | jq -r '.H')
  M=$(echo "$output" | jq -r '.M')
  L=$(echo "$output" | jq -r '.L')

  [ "$C" -eq 1 ]   # 1 critical from planreview-critical
  [ "$H" -eq 2 ]   # 1 from pm + 1 from critical
  [ "$M" -eq 2 ]   # 1 from pm + 1 from critical
  [ "$L" -eq 1 ]   # 1 from pm
  [ "$TOTAL" -eq 6 ]
}

@test "aggregate extracts verdicts" {
  run bash "$SCRIPT_DIR/review-aggregate.sh" \
    --output-dir "$TMPDIR" \
    --id-prefix "PR" \
    --next-id 1
  [ "$status" -eq 0 ]

  VERDICTS=$(echo "$output" | jq -r '.verdicts')
  echo "$VERDICTS" | grep -q "CONDITIONAL"
  echo "$VERDICTS" | grep -q "NO-GO"
}

@test "aggregate not converged with critical issues" {
  run bash "$SCRIPT_DIR/review-aggregate.sh" \
    --output-dir "$TMPDIR" \
    --id-prefix "PR" \
    --next-id 1
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.converged == false'
}

@test "aggregate converged with GO verdict only" {
  GODIR=$(mktemp -d)
  cp "$FIXTURES/persona-outputs/planreview-go.txt" "$GODIR/"

  run bash "$SCRIPT_DIR/review-aggregate.sh" \
    --output-dir "$GODIR" \
    --id-prefix "PR" \
    --next-id 1
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.converged == true'
  echo "$output" | jq -e '.total == 0'

  rm -rf "$GODIR"
}

@test "aggregate assigns sequential IDs" {
  run bash "$SCRIPT_DIR/review-aggregate.sh" \
    --output-dir "$TMPDIR" \
    --id-prefix "PR" \
    --next-id 5
  [ "$status" -eq 0 ]

  # next_id should be 5 + total issues
  NEXT=$(echo "$output" | jq -r '.next_id')
  TOTAL=$(echo "$output" | jq -r '.total')
  [ "$NEXT" -eq $((5 + TOTAL)) ]
}
