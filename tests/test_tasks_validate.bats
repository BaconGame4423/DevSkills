#!/usr/bin/env bats
# Tests for lib/tasks-validate.sh

setup() {
  SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../lib" && pwd)"
  TMPDIR=$(mktemp -d)
}

teardown() {
  rm -rf "$TMPDIR"
}

@test "valid tasks.md passes" {
  cat > "$TMPDIR/tasks.md" <<'EOF'
# Tasks: Test Feature

## Phase 1: Setup
- [ ] [T001] Create project structure in src/
  - files: src/**

## Phase 2: User Story 1
- [ ] [T002] [US1] Implement user model in src/models/user.ts
  - depends: [T001]
  - files: src/models/**
- [ ] [T003] [P] [US1] Implement auth service in src/services/auth.ts
  - depends: [T002]
  - files: src/services/**
EOF

  run bash "$SCRIPT_DIR/tasks-validate.sh" "$TMPDIR/tasks.md"
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.valid == true'
  echo "$output" | jq -e '.stats.tasks == 3'
  echo "$output" | jq -e '.stats.phases == 2'
}

@test "missing task ID is detected" {
  cat > "$TMPDIR/tasks.md" <<'EOF'
## Phase 1: Setup
- [ ] Create project structure
- [ ] [T001] Valid task
EOF

  run bash "$SCRIPT_DIR/tasks-validate.sh" "$TMPDIR/tasks.md"
  [ "$status" -eq 1 ]
  echo "$output" | jq -e '.valid == false'
  echo "$output" | jq -e '.stats.bad_format == 1'
}

@test "invalid depends reference is detected" {
  cat > "$TMPDIR/tasks.md" <<'EOF'
## Phase 1: Setup
- [ ] [T001] Create project structure
- [ ] [T002] Implement feature
  - depends: [T099]
EOF

  run bash "$SCRIPT_DIR/tasks-validate.sh" "$TMPDIR/tasks.md"
  [ "$status" -eq 1 ]
  echo "$output" | jq -e '.valid == false'
  echo "$output" | jq -e '.errors | length > 0'
}

@test "parallel marker without files generates warning" {
  cat > "$TMPDIR/tasks.md" <<'EOF'
## Phase 1: Setup
- [ ] [T001] [P] Create project structure
EOF

  run bash "$SCRIPT_DIR/tasks-validate.sh" "$TMPDIR/tasks.md"
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.warnings | length > 0'
}

@test "completed tasks are counted" {
  cat > "$TMPDIR/tasks.md" <<'EOF'
## Phase 1: Setup
- [X] [T001] Create project structure
- [ ] [T002] Install dependencies
EOF

  run bash "$SCRIPT_DIR/tasks-validate.sh" "$TMPDIR/tasks.md"
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.stats.tasks == 2'
}

@test "missing file returns error" {
  run bash "$SCRIPT_DIR/tasks-validate.sh" "/nonexistent/tasks.md"
  [ "$status" -eq 1 ]
}
