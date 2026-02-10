---
description: Run quality gates + 4-persona review + adversarial review with auto-fix loop
handoffs:
  - label: 修正実装
    agent: poor-dev.implement
    prompt: 品質レビューの指摘に基づいて修正を適用してください
    send: true
  - label: フェーズ完了レビュー
    agent: poor-dev.phasereview
    prompt: フェーズ完了レビューを実行してください
    send: true
---

## User Input

```text
$ARGUMENTS
```

## Quality Review Procedure (5 stages)

### STAGE 0: Quality Gates

Run automated quality gates before persona review:

```bash
# Detect project language and run appropriate commands:
# TypeScript/JavaScript: tsc --noEmit && eslint . --max-warnings 0 && prettier --check && npm test -- --coverage
# Python: mypy . && ruff lint && black --check . && pytest --cov
# Rust: cargo check && cargo clippy -- -D warnings && cargo fmt --check && cargo test
# Go: go vet ./... && golangci-lint run && gofmt -l . && go test ./... -cover
```

If gates fail, record failures as C or H severity and proceed to fix loop.

### STAGE 1-4: Review Loop

Loop STEP 1-4 until 0 issues. Safety: confirm with user after 10 iterations.

**STEP 1**: Spawn 4 NEW parallel sub-agents (never reuse — prevents context contamination).
  Personas: `qualityreview-qa`, `qualityreview-testdesign`, `qualityreview-code`, `qualityreview-security`.
  Instruction: "Review `$ARGUMENTS`. Output compact English YAML."
  - **Claude Code**: Task tool with subagent_type "general-purpose" for each.
  - **OpenCode**: `@qualityreview-qa`, `@qualityreview-testdesign`, `@qualityreview-code`, `@qualityreview-security`.

**STEP 2**: Run adversarial review, then aggregate all results. Count issues by severity (C/H/M/L).
  Adversarial judgments: APPROVED | NEEDS_CHANGES (add to issues) | HALLUCINATING (ignore).
  **3-strike rule**: Track adversarial rejections. After 3 strikes → abort and report failure.

**STEP 3**: Issues remain → STEP 4. Zero issues AND adversarial APPROVED/HALLUCINATING → done. 3 strikes → abort.

**STEP 4**: Spawn `review-fixer` sub-agent with aggregated issues (priority C→H→M→L). After fix → back to STEP 1.

### Progress Tracking

Record issue count per iteration.

### Iteration Output

```yaml
type: quality
target: $ARGUMENTS
n: 2
gates: {typecheck: pass, lint: pass, format: pass, test: pass}
i:
  H:
    - missing edge case test for null input (QA)
    - XSS vulnerability in render function (SEC)
  M:
    - function too complex, cyclomatic complexity 15 (CODE)
adversarial: NEEDS_CHANGES
strikes: 1
ps: {QA: CONDITIONAL, TESTDESIGN: GO, CODE: CONDITIONAL, SEC: NO-GO}
act: FIX
```

### Final Output (0 issues)

```yaml
type: quality
target: $ARGUMENTS
v: GO
n: 5
gates: {typecheck: pass, lint: pass, format: pass, test: pass}
adversarial: APPROVED
strikes: 1
log:
  - {n: 1, issues: 9, fixed: "gate failures, coverage"}
  - {n: 2, issues: 5, fixed: "XSS, null handling"}
  - {n: 3, issues: 3, fixed: "complexity, naming"}
  - {n: 4, issues: 1, fixed: "edge case test"}
  - {n: 5, issues: 0}
next: /poor-dev.phasereview
```

## Bugfix Postmortem (conditional)

Execute ONLY after loop completes with GO verdict. Skip if `FEATURE_DIR/bug-report.md` does not exist.

Determine FEATURE_DIR from `$ARGUMENTS` path.

### Postmortem Generation

1. Read `bug-report.md`, `investigation.md`, `fix-plan.md` from FEATURE_DIR.
2. Get diff: `git diff main...HEAD`
3. Generate `$FEATURE_DIR/postmortem.md`:

```markdown
# Postmortem: [BUG SHORT NAME]

**Date**: [DATE] | **Branch**: [BRANCH] | **Severity**: [C/H/M/L]
**Category**: [Logic Bug / Dependency / Environment / Regression / Concurrency / Data / Configuration]
**Resolution Time**: [intake → qualityreview completion]

## Summary
[1-2 line summary]

## Root Cause
[from investigation.md]

## 5 Whys
[from investigation.md]

## Fix Applied
- Changed files: [list]
- Change type: [logic fix / config change / dependency update / etc.]

## Impact
- Scope: [affected area]
- Duration: [when to when]

## Detection
- Found via: [user report / test failure / monitoring / etc.]

## Prevention
- [ ] [concrete prevention action 1]
- [ ] [concrete prevention action 2]

## Lessons Learned
- [lesson 1]
- [lesson 2]
```

### Update Bug Pattern Database

1. Read `bug-patterns.md`, determine next ID (BP-NNN).
2. Add row to Pattern Index + new pattern entry with: Category, Cause Pattern, Symptoms, Detection, Prevention, Past Occurrences.
3. Report postmortem path, root cause summary, prevention actions, new pattern ID.
